import { QUESTIONS } from "./questions.js";

const AI_ENDPOINT = "https://quiz-duelo-ai.gustavomarsan.workers.dev/";
const MEDIA_MANIFEST_URL = "./assets/media/manifest.json";
const TOTAL = 16;
const FETCH_TIMEOUT_MS = 28000;
const RETRY_DELAY_MS = 2200;
const MAX_GENERATION_ATTEMPTS = 2;
const MAX_POOL = 1200;
const MAX_HISTORY = 3000;

const CURRENT_KEY = "burrquizzzCurrentEpisodeV3";
const NEXT_KEY = "burrquizzzNextEpisodeV3";
const POOL_KEY = "burrquizzzQuestionPoolV3";
const HISTORY_KEY = "burrquizzzPlayedQuestionsV3";
const LEGACY_HISTORY_KEYS = [
  "burrquizzzPlayedQuestionsV2",
  "burrquizzzQuestionArchive"
];

const STATIC_QUESTIONS = QUESTIONS.map(cloneQuestion).filter(isValidQuestion);
const gameScreen = document.querySelector("#screen-game");
const setupScreen = document.querySelector("#screen-solo-setup");
const startButton = document.querySelector("#startSoloButton");

let activeEpisode = null;
let mediaItems = [];
let generationPromise = null;
let generationQueued = false;
let episodeStarted = false;
let recordedEpisodeId = "";
let setupWasActive = setupScreen?.classList.contains("active") || false;

boot();

async function boot() {
  migrateHistory();
  restoreStartButton();
  observeFlow();

  mediaItems = await loadMediaItems();
  const cached = consumeNextEpisode();
  const first = isFreshEpisode(cached)
    ? cached
    : buildLocalEpisode("initial");

  applyEpisode(first, cached ? "prefetched" : "local-fresh");
  ensureNextEpisode();
  queueGeneration();
}

function observeFlow() {
  if (!gameScreen || !setupScreen) return;

  const observer = new MutationObserver(() => {
    const gameActive = gameScreen.classList.contains("active");
    const setupActive = setupScreen.classList.contains("active");

    if (gameActive && activeEpisode) {
      episodeStarted = true;
      recordEpisode(activeEpisode);
      ensureNextEpisode();
      queueGeneration();
    }

    if (episodeStarted && setupActive && !setupWasActive) {
      activateNextEpisode();
    }

    setupWasActive = setupActive;
  });

  observer.observe(gameScreen, { attributes: true, attributeFilter: ["class"] });
  observer.observe(setupScreen, { attributes: true, attributeFilter: ["class"] });
}

function restoreStartButton() {
  if (!startButton) return;
  startButton.disabled = false;
  startButton.textContent = "Começar";
  document.documentElement.dataset.episodeLoading = "background";
}

function applyEpisode(episode, source) {
  const discoveries = normalizeQuestions(episode?.discoveries);
  if (discoveries.length !== TOTAL || containsInternalDuplicates(discoveries)) {
    throw new Error("Episódio inválido ou com perguntas repetidas.");
  }

  const normalized = {
    id: episode.id || `episode-${crypto.randomUUID()}`,
    source,
    title: String(episode.title || "Perguntas novas, finalmente").trim(),
    subtitle: String(episode.subtitle || "Sem reciclar o que você já jogou").trim(),
    host: String(episode.host || "Nico").trim(),
    intro: String(episode.intro || "O acervo foi conferido antes de abrir a rodada.").trim(),
    outro: String(episode.outro || "Estas perguntas agora saem da fila.").trim(),
    discoveries,
    blocks: normalizeBlocks(episode.blocks, discoveries)
  };

  activeEpisode = normalized;
  recordedEpisodeId = "";
  QUESTIONS.splice(0, QUESTIONS.length, ...discoveries);
  localStorage.setItem(CURRENT_KEY, JSON.stringify(normalized));
  window.BURRQUIZZZ_EPISODE = normalized;
  document.documentElement.dataset.questionSource = source;
  document.documentElement.dataset.episodeDelivery = source;
  document.documentElement.dataset.episodeReady = "true";
  document.documentElement.dataset.noRepeatEngine = "v3-strict";
  restoreStartButton();
  window.dispatchEvent(new CustomEvent("burrquizzz:episode-ready", { detail: normalized }));
}

function activateNextEpisode() {
  let next = consumeNextEpisode();

  if (!isFreshEpisode(next)) {
    next = buildLocalEpisode("rotation");
  }

  try {
    applyEpisode(next, next?.source || "strict-rotation");
  } catch (error) {
    console.warn("Episódio armazenado rejeitado pela barreira antirrepetição.", error);
    applyEpisode(buildLocalEpisode("recovery"), "strict-recovery");
  }

  ensureNextEpisode();
  queueGeneration();
}

function ensureNextEpisode() {
  const stored = readJson(NEXT_KEY);
  if (isFreshEpisode(stored) && isDifferentFromActive(stored)) {
    document.documentElement.dataset.nextEpisodeReady = "true";
    return stored;
  }

  try {
    const local = buildLocalEpisode("rotation");
    storeNextEpisode(local);
    return local;
  } catch (error) {
    document.documentElement.dataset.nextEpisodeReady = "waiting-ai";
    queueGeneration();
    return null;
  }
}

function buildLocalEpisode(source) {
  const history = getHistory();
  const active = normalizeQuestions(activeEpisode?.discoveries);
  const pool = getPool();

  const eligible = pool.filter((candidate) => {
    if (active.some((item) => isDuplicate(candidate, item))) return false;
    return !history.some((item) => isDuplicate(candidate, item));
  });

  const selected = selectBalanced(eligible, TOTAL);
  if (selected.length !== TOTAL) {
    throw new Error(`Só há ${selected.length} perguntas realmente inéditas disponíveis.`);
  }

  return {
    id: `episode-${source}-${crypto.randomUUID()}`,
    source,
    title: "Mais um episódio sem repeteco",
    subtitle: "O histórico inteiro foi conferido antes da seleção",
    host: "Nico",
    intro: "Pergunta repetida tentou entrar, mas foi barrada na porta.",
    outro: "Estas dezesseis agora também entram para o histórico.",
    discoveries: selected,
    blocks: normalizeBlocks([], selected)
  };
}

function queueGeneration() {
  if (generationPromise) {
    generationQueued = true;
    return generationPromise;
  }

  generationPromise = generateFreshInventory()
    .catch((error) => {
      console.warn("A IA não respondeu a tempo. O acervo local continua funcionando.", error);
      document.documentElement.dataset.backgroundGeneration = "fallback";
    })
    .finally(() => {
      generationPromise = null;
      if (generationQueued) {
        generationQueued = false;
        setTimeout(queueGeneration, RETRY_DELAY_MS);
      }
    });

  return generationPromise;
}

async function generateFreshInventory() {
  document.documentElement.dataset.backgroundGeneration = "running";
  let acceptedTotal = 0;

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const payload = {
      count: TOTAL,
      recentQuestions: getAIHistory(),
      mediaItems,
      strictNoRepeat: true,
      requestNonce: crypto.randomUUID()
    };

    const data = await fetchWithTimeout(payload);
    const generated = normalizeQuestions(
      data?.episode?.discoveries ||
      data?.questions ||
      data?.episode?.blocks?.flatMap((block) => block?.discoveries || [])
    );

    const accepted = acceptFreshQuestions(generated);
    if (accepted.length) {
      mergeIntoPool(accepted);
      acceptedTotal += accepted.length;
    }

    const candidate = buildCandidateFromGenerated(data?.episode, accepted);
    if (candidate && isFreshEpisode(candidate) && isDifferentFromActive(candidate)) {
      storeNextEpisode(candidate);
      document.documentElement.dataset.backgroundGeneration = "ready";
      document.documentElement.dataset.generatedFreshCount = String(acceptedTotal);
      return candidate;
    }

    const local = tryBuildLocalEpisode();
    if (local) {
      storeNextEpisode(local);
      document.documentElement.dataset.backgroundGeneration = "ready";
      document.documentElement.dataset.generatedFreshCount = String(acceptedTotal);
      return local;
    }

    if (attempt < MAX_GENERATION_ATTEMPTS) await delay(RETRY_DELAY_MS);
  }

  throw new Error("A IA não produziu perguntas inéditas suficientes após duas tentativas.");
}

async function fetchWithTimeout(payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) throw new Error(`Gerador respondeu com status ${response.status}.`);
    return await response.json();
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Tempo limite de geração excedido.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function acceptFreshQuestions(items) {
  const history = getHistory();
  const pool = getPool();
  const active = normalizeQuestions(activeEpisode?.discoveries);
  const accepted = [];

  for (const question of normalizeQuestions(items)) {
    const existing = [...history, ...pool, ...active, ...accepted];
    if (existing.some((item) => isDuplicate(question, item))) continue;
    accepted.push(question);
  }

  return accepted;
}

function buildCandidateFromGenerated(source, accepted) {
  if (accepted.length < TOTAL) return null;
  const discoveries = selectBalanced(accepted, TOTAL);
  if (discoveries.length !== TOTAL) return null;

  return {
    id: `episode-ai-${crypto.randomUUID()}`,
    source: "ai-strict",
    title: source?.title || "Episódio inédito",
    subtitle: source?.subtitle || "A IA criou; a barreira antirrepetição aprovou",
    host: source?.host || "Nico",
    intro: source?.intro || "Tudo novo por aqui.",
    outro: source?.outro || "Agora estas também saem da fila.",
    discoveries,
    blocks: normalizeBlocks(source?.blocks, discoveries)
  };
}

function tryBuildLocalEpisode() {
  try {
    return buildLocalEpisode("pool-fresh");
  } catch {
    return null;
  }
}

function recordEpisode(episode) {
  if (!episode?.id || recordedEpisodeId === episode.id) return;
  recordedEpisodeId = episode.id;

  const existing = getHistory();
  const additions = normalizeQuestions(episode.discoveries).map((question) => historyItem(question));
  const merged = [...existing];

  for (const addition of additions) {
    if (merged.some((item) => isDuplicate(addition, item))) continue;
    merged.push(addition);
  }

  localStorage.setItem(HISTORY_KEY, JSON.stringify(merged.slice(-MAX_HISTORY)));
  document.documentElement.dataset.playedQuestionCount = String(merged.length);

  const storedNext = readJson(NEXT_KEY);
  if (!isFreshEpisode(storedNext)) localStorage.removeItem(NEXT_KEY);
}

function getHistory() {
  return readArray(HISTORY_KEY)
    .map(normalizeHistoryItem)
    .filter((item) => item.prompt)
    .slice(-MAX_HISTORY);
}

function migrateHistory() {
  if (readArray(HISTORY_KEY).length) return;

  const migrated = [];
  for (const key of LEGACY_HISTORY_KEYS) {
    for (const item of readArray(key)) {
      const normalized = normalizeHistoryItem(item);
      if (!normalized.prompt) continue;
      if (migrated.some((prior) => isDuplicate(normalized, prior))) continue;
      migrated.push(normalized);
    }
  }

  if (migrated.length) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(migrated.slice(-MAX_HISTORY)));
  }
}

function getAIHistory() {
  return getHistory().slice(-500).map((item) => {
    const answer = item.answer ? ` | Resposta: ${item.answer}` : "";
    return `Pergunta: ${item.prompt}${answer} | Assinatura: ${item.fingerprint || fingerprint(item)}`;
  });
}

function getPool() {
  return dedupeQuestions([
    ...STATIC_QUESTIONS,
    ...normalizeQuestions(readArray(POOL_KEY)),
    ...normalizeQuestions(readJson(NEXT_KEY)?.discoveries)
  ]);
}

function mergeIntoPool(items) {
  const merged = dedupeQuestions([
    ...normalizeQuestions(readArray(POOL_KEY)),
    ...normalizeQuestions(items)
  ]).slice(-MAX_POOL);
  localStorage.setItem(POOL_KEY, JSON.stringify(merged));
  document.documentElement.dataset.questionPoolSize = String(
    dedupeQuestions([...STATIC_QUESTIONS, ...merged]).length
  );
}

function storeNextEpisode(episode) {
  if (!isFreshEpisode(episode) || !isDifferentFromActive(episode)) return false;
  localStorage.setItem(NEXT_KEY, JSON.stringify({ ...episode, storedAt: Date.now() }));
  document.documentElement.dataset.nextEpisodeReady = "true";
  return true;
}

function consumeNextEpisode() {
  const episode = readJson(NEXT_KEY);
  localStorage.removeItem(NEXT_KEY);
  return episode;
}

function isFreshEpisode(episode) {
  const discoveries = normalizeQuestions(episode?.discoveries);
  if (discoveries.length !== TOTAL || containsInternalDuplicates(discoveries)) return false;
  const history = getHistory();
  return discoveries.every((question) => !history.some((item) => isDuplicate(question, item)));
}

function isDifferentFromActive(episode) {
  if (!activeEpisode) return true;
  const active = normalizeQuestions(activeEpisode.discoveries);
  return normalizeQuestions(episode?.discoveries)
    .every((question) => !active.some((item) => isDuplicate(question, item)));
}

function containsInternalDuplicates(items) {
  return items.some((item, index) => items.slice(0, index).some((prior) => isDuplicate(item, prior)));
}

function isDuplicate(a, b) {
  const promptA = normalize(a?.prompt);
  const promptB = normalize(b?.prompt);
  if (!promptA || !promptB) return false;
  if (promptA === promptB) return true;

  const answerA = normalize(questionAnswer(a) || a?.answer);
  const answerB = normalize(questionAnswer(b) || b?.answer);
  const tokensA = meaningfulTokens(`${promptA} ${answerA}`);
  const tokensB = meaningfulTokens(`${promptB} ${answerB}`);
  const intersection = [...tokensA].filter((token) => tokensB.has(token)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  const jaccard = intersection / Math.max(1, union);
  const containment = intersection / Math.max(1, Math.min(tokensA.size, tokensB.size));
  const sameAnswer = Boolean(answerA && answerB && answerA === answerB);
  const fpA = a?.fingerprint || fingerprint(a);
  const fpB = b?.fingerprint || fingerprint(b);

  return fpA === fpB
    || (sameAnswer && intersection >= 2 && containment >= 0.46)
    || (intersection >= 4 && containment >= 0.68)
    || (intersection >= 5 && jaccard >= 0.52);
}

function fingerprint(item) {
  const promptTokens = [...meaningfulTokens(normalize(item?.prompt))].sort();
  const answerTokens = [...meaningfulTokens(normalize(questionAnswer(item) || item?.answer))].sort();
  return `${promptTokens.slice(0, 12).join("-")}::${answerTokens.slice(0, 5).join("-")}`;
}

function meaningfulTokens(value) {
  const ignored = STOP_WORDS;
  return new Set(
    normalize(value)
      .split(" ")
      .filter((token) => token.length >= 3 && !ignored.has(token))
  );
}

const STOP_WORDS = new Set([
  "qual", "quais", "quem", "como", "onde", "quando", "porque", "por", "que", "com", "sem",
  "uma", "umas", "uns", "para", "dos", "das", "nas", "nos", "este", "esta", "esse", "essa",
  "foi", "era", "sao", "tem", "teve", "nome", "chamado", "chamada", "ficou", "conhecido",
  "aparece", "filme", "serie", "musica", "programa", "alternativa", "correta", "imagem"
]);

function selectBalanced(items, count) {
  const shuffled = shuffle(dedupeQuestions(items));
  const selected = [];
  const categories = new Map();

  for (const question of shuffled) {
    const category = normalize(question.category || "geral");
    const used = categories.get(category) || 0;
    if (used >= 3) continue;
    selected.push(cloneQuestion(question));
    categories.set(category, used + 1);
    if (selected.length === count) return selected;
  }

  for (const question of shuffled) {
    if (selected.some((item) => isDuplicate(question, item))) continue;
    selected.push(cloneQuestion(question));
    if (selected.length === count) break;
  }

  return selected;
}

function normalizeBlocks(blocks, discoveries) {
  const source = Array.isArray(blocks) ? blocks : [];
  return [0, 1, 2, 3].map((index) => ({
    id: source[index]?.id || `block-${index + 1}`,
    title: source[index]?.title || ["Aquecimento", "Cultura pop", "Mundo bizarro", "Grande Final"][index],
    intro: source[index]?.intro || "Quatro descobertas inéditas.",
    discoveries: discoveries.slice(index * 4, index * 4 + 4)
  }));
}

function normalizeQuestions(items) {
  if (!Array.isArray(items)) return [];
  return dedupeQuestions(items.map(normalizeQuestion).filter(isValidQuestion));
}

function normalizeQuestion(question) {
  const options = Array.isArray(question?.options) ? question.options.map((item) => String(item).trim()) : [];
  const correctIndex = Number(question?.correctIndex);
  const prompt = String(question?.prompt || "").trim();
  const type = question?.type === "image_choice" ? "image_choice" : "multiple_choice";
  const mediaId = String(question?.mediaId || "").trim();
  const media = mediaItems.find((item) => item.id === mediaId);

  return {
    ...question,
    id: String(question?.id || `q-${crypto.randomUUID()}`),
    type,
    mediaId,
    image: question?.image || media?.imageUrl || "",
    category: String(question?.category || "Cultura pop").trim(),
    difficulty: String(question?.difficulty || "media").trim(),
    prompt,
    options,
    correctIndex,
    explanation: String(question?.explanation || "").trim()
  };
}

function isValidQuestion(question) {
  return Boolean(
    question &&
    typeof question.prompt === "string" && question.prompt.length >= 8 &&
    Array.isArray(question.options) && question.options.length === 4 &&
    question.options.every((option) => typeof option === "string" && option.trim()) &&
    Number.isInteger(question.correctIndex) && question.correctIndex >= 0 && question.correctIndex < 4
  );
}

function dedupeQuestions(items) {
  const result = [];
  for (const item of items) {
    if (!isValidQuestion(item)) continue;
    if (result.some((prior) => isDuplicate(item, prior))) continue;
    result.push(cloneQuestion(item));
  }
  return result;
}

function historyItem(question) {
  return {
    prompt: String(question.prompt || ""),
    answer: questionAnswer(question),
    category: String(question.category || ""),
    fingerprint: fingerprint(question),
    playedAt: Date.now()
  };
}

function normalizeHistoryItem(item) {
  const prompt = String(item?.prompt || item?.question || "").trim();
  const answer = String(item?.answer || item?.correctAnswer || "").trim();
  return {
    prompt,
    answer,
    category: String(item?.category || ""),
    fingerprint: String(item?.fingerprint || fingerprint({ prompt, answer })),
    playedAt: Number(item?.playedAt || 0)
  };
}

function questionAnswer(question) {
  const options = Array.isArray(question?.options) ? question.options : [];
  return String(options[Number(question?.correctIndex)] || "").trim();
}

function cloneQuestion(question) {
  return JSON.parse(JSON.stringify(question));
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function readArray(key) {
  const value = readJson(key);
  return Array.isArray(value) ? value : [];
}

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

async function loadMediaItems() {
  try {
    const response = await fetch(`${MEDIA_MANIFEST_URL}?v=2.0`, { cache: "no-store" });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
  } catch {
    return [];
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
