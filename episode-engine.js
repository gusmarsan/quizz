import { QUESTIONS } from "./questions.js";

const AI_ENDPOINT = "https://quiz-duelo-ai.gustavomarsan.workers.dev/";
const MEDIA_MANIFEST_URL = "./assets/media/manifest.json";
const EPISODE_STORAGE_KEY = "burrquizzzCurrentEpisode";
const NEXT_EPISODE_STORAGE_KEY = "burrquizzzNextEpisode";
const POOL_STORAGE_KEY = "burrquizzzQuestionPoolV2";
const PLAYED_STORAGE_KEY = "burrquizzzPlayedQuestionsV2";
const LEGACY_ARCHIVE_KEY = "burrquizzzQuestionArchive";
const REPORTS_STORAGE_KEY = "burrquizzzAnswerReports";
const TOTAL_DISCOVERIES = 16;
const MAX_POOL_ITEMS = 800;
const MAX_PLAYED_ITEMS = 1200;
const MAX_AI_HISTORY = 140;
const NEXT_EPISODE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const STATIC_QUESTIONS = QUESTIONS.map((question) => cloneQuestion(question));
const startButton = document.querySelector("#startSoloButton");
const gameScreen = document.querySelector("#screen-game");
const soloSetupScreen = document.querySelector("#screen-solo-setup");
const originalButtonText = startButton?.textContent || "Começar";

let activeEpisode = null;
let mediaItems = [];
let generationPromise = null;
let episodeHasStarted = false;
let recordedEpisodeId = "";
let setupWasActive = soloSetupScreen?.classList.contains("active") || false;

boot();

function boot() {
  makeStartImmediate();
  observeEpisodeFlow();

  const cached = consumeNextEpisode();
  const firstEpisode = isCompleteEpisode(cached)
    ? cached
    : buildInstantEpisode(null, "instant");

  applyEpisode(firstEpisode, cached ? "cache" : "instant");
  guaranteeNextEpisode();

  loadMediaItems().then((items) => {
    mediaItems = items;
    prepareFreshEpisode();
  });
}

function makeStartImmediate() {
  if (!startButton) return;
  startButton.disabled = false;
  startButton.textContent = originalButtonText;
  document.documentElement.dataset.episodeLoading = "background";
}

function observeEpisodeFlow() {
  if (!gameScreen || !soloSetupScreen) return;

  const observer = new MutationObserver(() => {
    const gameIsActive = gameScreen.classList.contains("active");
    const setupIsActive = soloSetupScreen.classList.contains("active");

    if (gameIsActive && activeEpisode) {
      episodeHasStarted = true;
      recordPlayedEpisode(activeEpisode);
      guaranteeNextEpisode();
      prepareFreshEpisode();
    }

    if (episodeHasStarted && setupIsActive && !setupWasActive) {
      activateNextEpisode();
    }

    setupWasActive = setupIsActive;
  });

  observer.observe(gameScreen, { attributes: true, attributeFilter: ["class"] });
  observer.observe(soloSetupScreen, { attributes: true, attributeFilter: ["class"] });
}

function applyEpisode(episode, source) {
  const discoveries = normalizeQuestions(episode?.discoveries);
  if (discoveries.length !== TOTAL_DISCOVERIES) {
    throw new Error("O episódio não contém 16 descobertas válidas.");
  }

  const normalizedEpisode = {
    id: episode.id || `episode-${crypto.randomUUID()}`,
    title: String(episode.title || "Cultura inútil de altíssimo nível").trim(),
    subtitle: String(episode.subtitle || "Dezesseis descobertas prontas para jogar").trim(),
    host: String(episode.host || "Nico").trim(),
    intro: String(episode.intro || "O episódio já está pronto. Pode entrar.").trim(),
    outro: String(episode.outro || "Você saiu sabendo coisas que não pretendia aprender.").trim(),
    blocks: normalizeBlocks(episode.blocks, discoveries),
    discoveries
  };

  activeEpisode = normalizedEpisode;
  recordedEpisodeId = "";
  QUESTIONS.splice(0, QUESTIONS.length, ...discoveries);
  localStorage.setItem(EPISODE_STORAGE_KEY, JSON.stringify(normalizedEpisode));
  window.BURRQUIZZZ_EPISODE = normalizedEpisode;
  document.documentElement.dataset.questionSource = source;
  document.documentElement.dataset.episodeDelivery = source;
  document.documentElement.dataset.episodeBlocks = "4";
  document.documentElement.dataset.episodeReady = "true";
  document.documentElement.dataset.visualDiscoveries = String(
    discoveries.filter((question) => question.type === "image_choice").length
  );
  makeStartImmediate();
  window.dispatchEvent(new CustomEvent("burrquizzz:episode-ready", { detail: normalizedEpisode }));
}

function guaranteeNextEpisode() {
  const stored = readNextEpisode();
  if (isCompleteEpisode(stored) && isFreshAgainstActive(stored)) {
    document.documentElement.dataset.nextEpisodeReady = "true";
    return stored;
  }

  const fallback = buildInstantEpisode(activeEpisode, "rotation");
  storeNextEpisode(fallback, "rotation");
  return fallback;
}

async function prepareFreshEpisode() {
  if (generationPromise) return generationPromise;

  generationPromise = (async () => {
    try {
      document.documentElement.dataset.backgroundGeneration = "running";
      const response = await fetch(AI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: TOTAL_DISCOVERIES,
          recentQuestions: getAIHistory(),
          mediaItems
        })
      });

      if (!response.ok) throw new Error(`O gerador respondeu com status ${response.status}.`);
      const generatedEpisode = normalizeEpisodeResponse(await response.json());
      const generatedQuestions = normalizeQuestions(generatedEpisode.discoveries);
      if (generatedQuestions.length !== TOTAL_DISCOVERIES) {
        throw new Error("A geração em segundo plano não trouxe 16 descobertas válidas.");
      }

      mergeIntoPool(generatedQuestions);

      const candidate = {
        ...generatedEpisode,
        discoveries: generatedQuestions,
        blocks: normalizeBlocks(generatedEpisode.blocks, generatedQuestions)
      };

      if (isFreshAgainstHistory(candidate) && isFreshAgainstActive(candidate)) {
        storeNextEpisode(candidate, "ai-background");
      } else {
        storeNextEpisode(buildInstantEpisode(activeEpisode, "pool"), "pool");
      }

      document.documentElement.dataset.backgroundGeneration = "ready";
    } catch (error) {
      console.warn("A geração em segundo plano não ficou pronta. A rotação local continuará disponível.", error);
      document.documentElement.dataset.backgroundGeneration = "fallback";
      guaranteeNextEpisode();
    } finally {
      generationPromise = null;
    }
  })();

  return generationPromise;
}

function activateNextEpisode() {
  const next = consumeNextEpisode() || buildInstantEpisode(activeEpisode, "rotation");

  try {
    applyEpisode(next, next?.source || "prefetched");
  } catch (error) {
    console.warn("O próximo episódio armazenado era inválido. A rotação local foi usada.", error);
    applyEpisode(buildInstantEpisode(activeEpisode, "rotation"), "rotation");
  }

  guaranteeNextEpisode();
  prepareFreshEpisode();
}

function buildInstantEpisode(excludedEpisode, source) {
  const pool = getQuestionPool();
  const excludedKeys = new Set(
    normalizeQuestions(excludedEpisode?.discoveries).map(questionKey)
  );
  const reports = readArray(REPORTS_STORAGE_KEY);
  const reportedPrompts = reports.map((item) => String(item?.prompt || "")).filter(Boolean);
  const history = getCombinedHistory();
  const historyPosition = new Map();

  history.forEach((item, index) => {
    historyPosition.set(item.key, index);
  });

  const eligible = pool.filter((question) => {
    if (excludedKeys.has(questionKey(question))) return false;
    return !reportedPrompts.some((prompt) => isNearDuplicate(question, { prompt, answer: "" }));
  });

  const recentHistory = history.slice(-240);
  const completelyFresh = eligible.filter((question) => {
    const key = questionKey(question);
    return !historyPosition.has(key)
      && !recentHistory.some((previous) => isNearDuplicate(question, previous));
  });

  const exactUnseen = eligible.filter((question) => !historyPosition.has(questionKey(question)));
  let selectionSource;

  if (completelyFresh.length >= TOTAL_DISCOVERIES) {
    selectionSource = completelyFresh;
  } else if (exactUnseen.length >= TOTAL_DISCOVERIES) {
    selectionSource = exactUnseen;
  } else {
    selectionSource = [...eligible].sort((a, b) => {
      const lastA = historyPosition.has(questionKey(a)) ? historyPosition.get(questionKey(a)) : -1;
      const lastB = historyPosition.has(questionKey(b)) ? historyPosition.get(questionKey(b)) : -1;
      return lastA - lastB || Math.random() - 0.5;
    });
  }

  const selected = selectBalanced(selectionSource, TOTAL_DISCOVERIES);
  if (selected.length !== TOTAL_DISCOVERIES) {
    throw new Error("O acervo local não tem descobertas suficientes para montar o episódio.");
  }

  return {
    id: `episode-${source}-${crypto.randomUUID()}`,
    source,
    title: source === "instant" ? "Pronto para começar" : "Mais um episódio sem repeteco",
    subtitle: "O acervo gira primeiro; a IA abastece os próximos em segundo plano",
    host: "Nico",
    intro: "Nada de esperar uma eternidade: as descobertas já estavam separadas para você.",
    outro: "Estas dezesseis entram para o histórico e saem da fila dos próximos episódios.",
    blocks: normalizeBlocks([], selected),
    discoveries: selected
  };
}

function selectBalanced(items, count) {
  const shuffled = shuffle(dedupeQuestions(items));
  const selected = [];
  const categoryCount = new Map();

  for (const question of shuffled) {
    const category = normalize(question.category || "geral");
    const used = categoryCount.get(category) || 0;
    if (used >= 3) continue;
    selected.push(cloneQuestion(question));
    categoryCount.set(category, used + 1);
    if (selected.length === count) return selected;
  }

  for (const question of shuffled) {
    if (selected.some((item) => questionKey(item) === questionKey(question))) continue;
    selected.push(cloneQuestion(question));
    if (selected.length === count) break;
  }

  return selected;
}

function getQuestionPool() {
  const stored = readArray(POOL_STORAGE_KEY);
  return dedupeQuestions([
    ...STATIC_QUESTIONS,
    ...stored,
    ...normalizeQuestions(activeEpisode?.discoveries),
    ...normalizeQuestions(readNextEpisode()?.discoveries)
  ]).filter(isValidQuestion);
}

function mergeIntoPool(newQuestions) {
  const merged = dedupeQuestions([
    ...readArray(POOL_STORAGE_KEY),
    ...normalizeQuestions(newQuestions)
  ]).slice(-MAX_POOL_ITEMS);
  localStorage.setItem(POOL_STORAGE_KEY, JSON.stringify(merged));
  document.documentElement.dataset.questionPoolSize = String(
    dedupeQuestions([...STATIC_QUESTIONS, ...merged]).length
  );
}

function recordPlayedEpisode(episode) {
  if (!episode?.id || recordedEpisodeId === episode.id) return;
  recordedEpisodeId = episode.id;

  const existing = readArray(PLAYED_STORAGE_KEY)
    .map(normalizeHistoryItem)
    .filter((item) => item.prompt);

  const additions = normalizeQuestions(episode.discoveries).map((question) => ({
    key: questionKey(question),
    prompt: question.prompt,
    answer: question.options[question.correctIndex] || "",
    category: question.category || "",
    playedAt: Date.now()
  }));

  const merged = [...existing];
  additions.forEach((addition) => {
    const priorIndex = merged.findIndex((item) => item.key === addition.key);
    if (priorIndex >= 0) merged.splice(priorIndex, 1);
    merged.push(addition);
  });

  localStorage.setItem(PLAYED_STORAGE_KEY, JSON.stringify(merged.slice(-MAX_PLAYED_ITEMS)));
  document.documentElement.dataset.playedQuestionCount = String(merged.length);
}

function getCombinedHistory() {
  const played = readArray(PLAYED_STORAGE_KEY).map(normalizeHistoryItem);
  const legacy = readArray(LEGACY_ARCHIVE_KEY).map(normalizeHistoryItem);
  const reports = readArray(REPORTS_STORAGE_KEY).map((item) => normalizeHistoryItem({
    prompt: item?.prompt,
    answer: item?.correctAnswer,
    category: item?.category,
    playedAt: 0
  }));

  const result = [];
  const seen = new Set();
  [...legacy, ...reports, ...played].forEach((item) => {
    if (!item.prompt || seen.has(item.key)) return;
    seen.add(item.key);
    result.push(item);
  });
  return result.slice(-MAX_PLAYED_ITEMS);
}

function getAIHistory() {
  return getCombinedHistory()
    .slice(-MAX_AI_HISTORY)
    .map((item) => {
      const parts = [`Pergunta: ${item.prompt}`];
      if (item.answer) parts.push(`Resposta: ${item.answer}`);
      if (item.category) parts.push(`Tema: ${item.category}`);
      return parts.join(" | ");
    });
}

function isFreshAgainstHistory(episode) {
  const history = getCombinedHistory().slice(-320);
  const discoveries = normalizeQuestions(episode?.discoveries);
  return discoveries.length === TOTAL_DISCOVERIES
    && discoveries.every((question) => !history.some((item) => isNearDuplicate(question, item)));
}

function isFreshAgainstActive(episode) {
  if (!activeEpisode) return true;
  const active = normalizeQuestions(activeEpisode.discoveries);
  const candidate = normalizeQuestions(episode?.discoveries);
  return candidate.length === TOTAL_DISCOVERIES
    && candidate.every((question) => !active.some((item) => isNearDuplicate(question, item)));
}

function isNearDuplicate(question, historyItem) {
  const promptA = normalize(question?.prompt || "");
  const promptB = normalize(historyItem?.prompt || "");
  if (!promptA || !promptB) return false;
  if (promptA === promptB) return true;

  const tokensA = significantTokens(promptA);
  const tokensB = significantTokens(promptB);
  const shared = [...tokensA].filter((token) => tokensB.has(token)).length;
  const overlap = shared / Math.max(1, Math.min(tokensA.size, tokensB.size));
  const answerA = normalize(questionAnswer(question));
  const answerB = normalize(historyItem?.answer || "");
  const sameAnswer = Boolean(answerA && answerB && answerA === answerB);

  return (shared >= 3 && overlap >= 0.72)
    || (sameAnswer && shared >= 2 && overlap >= 0.5);
}

function significantTokens(value) {
  const ignored = new Set([
    "qual", "quais", "quem", "como", "onde", "quando", "porque", "este", "esta", "esse", "essa",
    "destes", "destas", "abaixo", "sobre", "imagem", "objeto", "filme", "musica", "serie", "programa",
    "alternativa", "correta", "verdadeira", "seguinte", "nome", "ficou", "conhecido", "aparece"
  ]);
  return new Set(normalize(value).split(" ").filter((token) => token.length >= 4 && !ignored.has(token)));
}

function normalizeEpisodeResponse(data) {
  const source = data?.episode || {};
  const blocks = Array.isArray(source.blocks) ? source.blocks : [];
  const discoveries = Array.isArray(source.discoveries)
    ? source.discoveries
    : blocks.flatMap((block) => Array.isArray(block?.discoveries) ? block.discoveries : []);

  return {
    id: source.id || `episode-ai-${crypto.randomUUID()}`,
    source: "ai-background",
    title: String(source.title || "O mundo é mais estranho do que parece").trim(),
    subtitle: String(source.subtitle || "Conhecimento de utilidade rigorosamente duvidosa").trim(),
    host: String(source.host || "Nico").trim(),
    intro: String(source.intro || "Prepare-se para descobrir coisas que você não precisava saber.").trim(),
    outro: String(source.outro || "Agora você sabe mais coisas inúteis do que antes.").trim(),
    blocks,
    discoveries
  };
}

function normalizeQuestions(items) {
  if (!Array.isArray(items)) return [];

  return items.filter(isValidQuestion).slice(0, TOTAL_DISCOVERIES).map((item, index) => {
    const isImage = item.type === "image_choice" && typeof item.image === "string" && item.image.trim();
    const options = item.options.map((option) => String(option).trim());
    return {
      ...cloneQuestion(item),
      id: item.id || `question-${crypto.randomUUID()}`,
      type: isImage ? "image_choice" : "multiple_choice",
      category: String(item.category || "Mundo Bizarro").trim(),
      difficulty: ["facil", "media", "dificil"].includes(item.difficulty) ? item.difficulty : "media",
      blockIndex: Math.floor(index / 4),
      blockPosition: index % 4,
      isGrandFinal: index === TOTAL_DISCOVERIES - 1,
      prompt: String(item.prompt).trim(),
      options,
      correctIndex: Number(item.correctIndex),
      explanation: String(item.explanation || `Resposta: ${options[Number(item.correctIndex)]}.`).trim(),
      ...(isImage ? {
        mediaId: String(item.mediaId || "").trim(),
        image: String(item.image).trim(),
        imageCredit: String(item.imageCredit || "").trim(),
        imageSource: String(item.imageSource || "").trim(),
        supportText: String(item.supportText || item.imageCredit || "").trim()
      } : {})
    };
  });
}

function normalizeBlocks(blocks, questions) {
  const defaults = [
    { id: "rebobina", title: "📼 Rebobina!", intro: "Memórias desbloqueadas. Não nos responsabilizamos pelo que aparecer." },
    { id: "volume", title: "🎸 Aumenta o volume", intro: "Histórias musicais que merecem ser ouvidas — ou questionadas." },
    { id: "bizarro", title: "👽 Mundo Bizarro", intro: "A realidade perde qualquer compromisso com o bom senso." },
    { id: "final", title: "⭐ Grande Final", intro: "Quatro últimas descobertas. A derradeira veio para causar discussão." }
  ];

  return defaults.map((fallback, index) => {
    const source = Array.isArray(blocks) ? blocks[index] : null;
    return {
      id: String(source?.id || fallback.id).trim(),
      title: String(source?.title || fallback.title).trim(),
      intro: String(source?.intro || fallback.intro).trim(),
      startIndex: index * 4,
      endIndex: index * 4 + 3,
      discoveries: questions.slice(index * 4, index * 4 + 4).map((question) => question.id)
    };
  });
}

async function loadMediaItems() {
  try {
    const response = await fetch(`${MEDIA_MANIFEST_URL}?v=3`, { cache: "no-store" });
    if (!response.ok) return [];
    const manifest = await response.json();
    if (!Array.isArray(manifest?.items)) return [];
    return manifest.items
      .filter((item) => item?.status === "ready" && item?.type === "image")
      .map((item) => ({
        id: String(item.id || "").trim(),
        type: "image",
        status: "ready",
        universe: String(item.universe || "Isso Existiu").trim(),
        title: String(item.title || "").trim(),
        subject: String(item.subject || "").trim(),
        imageUrl: String(item.imageUrl || "").trim(),
        sourcePage: String(item.sourcePage || "").trim(),
        credit: String(item.credit || "").trim(),
        tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
        questionSeeds: Array.isArray(item.questionSeeds) ? item.questionSeeds.map(String) : []
      }))
      .filter((item) => item.id && item.title && item.imageUrl);
  } catch {
    return [];
  }
}

function storeNextEpisode(episode, source) {
  localStorage.setItem(NEXT_EPISODE_STORAGE_KEY, JSON.stringify({
    createdAt: Date.now(),
    source,
    episode: { ...episode, source }
  }));
  document.documentElement.dataset.nextEpisodeReady = "true";
  document.documentElement.dataset.nextEpisodeSource = source;
}

function readNextEpisode() {
  try {
    const stored = JSON.parse(localStorage.getItem(NEXT_EPISODE_STORAGE_KEY) || "null");
    if (!stored?.episode || !Number.isFinite(stored.createdAt)) return null;
    if (Date.now() - stored.createdAt > NEXT_EPISODE_MAX_AGE_MS) {
      localStorage.removeItem(NEXT_EPISODE_STORAGE_KEY);
      return null;
    }
    return { ...stored.episode, source: stored.source || stored.episode.source || "cache" };
  } catch {
    localStorage.removeItem(NEXT_EPISODE_STORAGE_KEY);
    return null;
  }
}

function consumeNextEpisode() {
  const episode = readNextEpisode();
  if (episode) localStorage.removeItem(NEXT_EPISODE_STORAGE_KEY);
  return episode;
}

function isCompleteEpisode(episode) {
  return normalizeQuestions(episode?.discoveries).length === TOTAL_DISCOVERIES;
}

function isValidQuestion(item) {
  return Boolean(
    item
    && typeof item.prompt === "string"
    && item.prompt.trim()
    && typeof item.category === "string"
    && Array.isArray(item.options)
    && item.options.length === 4
    && item.options.every((option) => String(option).trim())
    && Number.isInteger(Number(item.correctIndex))
    && Number(item.correctIndex) >= 0
    && Number(item.correctIndex) <= 3
  );
}

function dedupeQuestions(items) {
  const result = [];
  const seen = new Set();
  items.forEach((item) => {
    if (!isValidQuestion(item)) return;
    const key = questionKey(item);
    if (seen.has(key)) return;
    seen.add(key);
    result.push(cloneQuestion(item));
  });
  return result;
}

function questionKey(question) {
  return `${normalize(question?.prompt || "")}|${normalize(questionAnswer(question))}`;
}

function questionAnswer(question) {
  const options = Array.isArray(question?.options) ? question.options : [];
  return options[Number(question?.correctIndex)] || question?.answer || "";
}

function normalizeHistoryItem(item) {
  const prompt = String(item?.prompt || "").trim();
  const answer = String(item?.answer || item?.correctAnswer || "").trim();
  return {
    key: item?.key || `${normalize(prompt)}|${normalize(answer)}`,
    prompt,
    answer,
    category: String(item?.category || "").trim(),
    playedAt: Number(item?.playedAt || 0)
  };
}

function cloneQuestion(question) {
  return JSON.parse(JSON.stringify(question));
}

function readArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    localStorage.removeItem(key);
    return [];
  }
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
