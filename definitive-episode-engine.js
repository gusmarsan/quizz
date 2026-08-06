import { QUESTIONS } from "./questions.js";

const AI_ENDPOINT = "https://quiz-duelo-ai.gustavomarsan.workers.dev/";
const MEDIA_MANIFEST_URL = "./assets/media/manifest.json";
const TOTAL = 16;
const FETCH_TIMEOUT_MS = 24000;
const MEDIA_TIMEOUT_MS = 4500;
const RETRY_DELAY_MS = 1400;
const MAX_GENERATION_ATTEMPTS = 4;
const MAX_POOL = 1200;
const MAX_HISTORY = 3000;
const HISTORY_BATCH_SIZE = 5;
const MAX_HISTORY_BATCHES = 50;
const STOP_WORDS = new Set([
  "qual", "quais", "quem", "como", "onde", "quando", "porque", "por", "que", "com", "sem",
  "uma", "umas", "uns", "para", "dos", "das", "nas", "nos", "este", "esta", "esse", "essa",
  "foi", "era", "sao", "tem", "teve", "nome", "chamado", "chamada", "ficou", "conhecido",
  "aparece", "filme", "serie", "musica", "programa", "alternativa", "correta", "imagem"
]);

const CURRENT_KEY = "burrquizzzCurrentEpisodeV3";
const LEGACY_CURRENT_KEY = "burrquizzzCurrentEpisode";
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
const questionText = document.querySelector("#questionText");

let activeEpisode = null;
let mediaItems = [];
let generationPromise = null;
let generationQueued = false;
let episodeStarted = false;
let setupWasActive = setupScreen?.classList.contains("active") || false;
let recordedPrompts = new Set();

document.documentElement.dataset.episodeReady = "false";
document.documentElement.dataset.noRepeatEngine = "v3-strict-resilient";

window.addEventListener("burrquizzz:retry-generation", () => {
  void prepareEpisodeForPlay("manual-retry");
});

void boot();

async function boot() {
  migrateHistory();
  restoreStartButton();
  observeFlow();
  signalPreparing("Conferindo o acervo e o histórico de perguntas.");

  mediaItems = await loadMediaItems();

  const cached = consumeNextEpisode();
  if (isFreshEpisode(cached)) {
    applyEpisode(cached, "prefetched");
  } else {
    const local = tryBuildLocalEpisode("initial");
    if (local) {
      applyEpisode(local, "local-fresh");
    } else {
      await prepareEpisodeForPlay("initial-generation");
    }
  }

  if (activeEpisode) {
    ensureNextEpisode();
    queueGeneration();
  }
}

function observeFlow() {
  if (gameScreen && setupScreen) {
    const screenObserver = new MutationObserver(() => {
      const gameActive = gameScreen.classList.contains("active");
      const setupActive = setupScreen.classList.contains("active");

      if (gameActive && activeEpisode) {
        episodeStarted = true;
        recordVisibleQuestion();
        ensureNextEpisode();
        queueGeneration();
      }

      if (episodeStarted && setupActive && !setupWasActive) {
        void activateNextEpisode();
      }

      setupWasActive = setupActive;
    });

    screenObserver.observe(gameScreen, { attributes: true, attributeFilter: ["class"] });
    screenObserver.observe(setupScreen, { attributes: true, attributeFilter: ["class"] });
  }

  if (questionText) {
    new MutationObserver(() => {
      if (gameScreen?.classList.contains("active")) recordVisibleQuestion();
    }).observe(questionText, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }
}

function restoreStartButton() {
  if (!startButton) return;
  startButton.disabled = false;
  startButton.textContent = "Começar";
  document.documentElement.dataset.episodeLoading = "background";
}

async function prepareEpisodeForPlay(reason) {
  if (activeEpisode && document.documentElement.dataset.episodeReady === "true") {
    return activeEpisode;
  }

  signalPreparing(
    reason === "manual-retry"
      ? "Tentando novamente criar um episódio realmente inédito."
      : "O acervo local acabou. Criando novas perguntas sem repetir as anteriores."
  );

  try {
    const candidate = await requestGeneratedCandidate();
    applyEpisode(candidate, candidate?.source || "ai-strict");
    ensureNextEpisode();
    queueGeneration();
    return candidate;
  } catch (error) {
    signalError(error);
    return null;
  }
}

function applyEpisode(episode, source) {
  const discoveries = normalizeQuestions(episode?.discoveries);
  if (discoveries.length !== TOTAL || containsInternalDuplicates(discoveries)) {
    throw new Error("O episódio recebido não tem 16 perguntas inéditas válidas.");
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
  recordedPrompts = new Set();
  QUESTIONS.splice(0, QUESTIONS.length, ...discoveries);
  localStorage.setItem(CURRENT_KEY, JSON.stringify(normalized));
  localStorage.setItem(LEGACY_CURRENT_KEY, JSON.stringify(normalized));
  window.BURRQUIZZZ_EPISODE = normalized;

  document.documentElement.dataset.questionSource = source;
  document.documentElement.dataset.episodeDelivery = source;
  document.documentElement.dataset.episodeReady = "true";
  document.documentElement.dataset.episodeState = "ready";
  document.documentElement.dataset.noRepeatEngine = "v3-strict-resilient";
  delete document.documentElement.dataset.episodeError;

  restoreStartButton();
  window.dispatchEvent(new CustomEvent("burrquizzz:episode-ready", { detail: normalized }));
}

async function activateNextEpisode() {
  signalPreparing("Separando o próximo episódio sem repetir perguntas.");

  let next = consumeNextEpisode();
  if (!isFreshEpisode(next) || !isDifferentFromActive(next)) {
    next = tryBuildLocalEpisode("rotation");
  }

  if (!next) {
    try {
      next = await requestGeneratedCandidate();
    } catch (error) {
      signalError(error);
      return;
    }
  }

  try {
    applyEpisode(next, next?.source || "strict-rotation");
  } catch (error) {
    console.warn("O próximo episódio foi rejeitado pela barreira antirrepetição.", error);
    const recovery = tryBuildLocalEpisode("recovery");
    if (recovery) {
      applyEpisode(recovery, "strict-recovery");
    } else {
      try {
        const generated = await requestGeneratedCandidate();
        applyEpisode(generated, generated?.source || "ai-recovery");
      } catch (generationError) {
        signalError(generationError);
        return;
      }
    }
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

  localStorage.removeItem(NEXT_KEY);
  const local = tryBuildLocalEpisode("rotation");
  if (local) {
    storeNextEpisode(local);
    return local;
  }

  document.documentElement.dataset.nextEpisodeReady = "waiting-ai";
  queueGeneration();
  return null;
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
    throw new Error(`Só há ${selected.length} perguntas locais realmente inéditas.`);
  }

  return {
    id: `episode-${source}-${crypto.randomUUID()}`,
    source,
    title: "Mais um episódio sem repeteco",
    subtitle: "O histórico inteiro foi conferido antes da seleção",
    host: "Nico",
    intro: "Pergunta repetida tentou entrar, mas foi barrada na porta.",
    outro: "As perguntas vistas nesta rodada agora também entram para o histórico.",
    discoveries: selected,
    blocks: normalizeBlocks([], selected)
  };
}

function tryBuildLocalEpisode(source) {
  try {
    return buildLocalEpisode(source);
  } catch {
    return null;
  }
}

function queueGeneration() {
  if (generationPromise) {
    generationQueued = true;
    return generationPromise;
  }

  generationPromise = generateFreshCandidate()
    .then((candidate) => {
      if (candidate) storeNextEpisode(candidate);
      document.documentElement.dataset.backgroundGeneration = "ready";
      return candidate;
    })
    .catch((error) => {
      console.warn("A geração em segundo plano não ficou pronta.", error);
      document.documentElement.dataset.backgroundGeneration = "fallback";
      return null;
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

function requestGeneratedCandidate() {
  if (generationPromise) return generationPromise;

  generationPromise = generateFreshCandidate()
    .finally(() => {
      generationPromise = null;
      if (generationQueued) {
        generationQueued = false;
        setTimeout(queueGeneration, RETRY_DELAY_MS);
      }
    });

  return generationPromise;
}

async function generateFreshCandidate() {
  document.documentElement.dataset.backgroundGeneration = "running";
  let acceptedInventory = [];

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    signalProgress(
      `Gerando perguntas inéditas: tentativa ${attempt} de ${MAX_GENERATION_ATTEMPTS}.`
    );

    const payload = {
      count: TOTAL,
      recentQuestions: getAIHistory(),
      mediaItems,
      strictNoRepeat: true,
      requestNonce: crypto.randomUUID()
    };

    try {
      const data = await fetchWithTimeout(payload);
      const generated = normalizeQuestions(
        data?.episode?.discoveries ||
        data?.questions ||
        data?.episode?.blocks?.flatMap((block) => block?.discoveries || [])
      );

      const accepted = acceptFreshQuestions(generated, acceptedInventory);
      acceptedInventory = dedupeQuestions([...acceptedInventory, ...accepted]);

      if (accepted.length) mergeIntoPool(accepted);

      const generatedCandidate = buildCandidateFromInventory(
        data?.episode,
        acceptedInventory
      );
      if (generatedCandidate) {
        document.documentElement.dataset.generatedFreshCount = String(
          acceptedInventory.length
        );
        return generatedCandidate;
      }

      const pooledCandidate = tryBuildLocalEpisode("pool-fresh");
      if (pooledCandidate) {
        document.documentElement.dataset.generatedFreshCount = String(
          acceptedInventory.length
        );
        return pooledCandidate;
      }
    } catch (error) {
      console.warn(`Tentativa ${attempt} de geração falhou.`, error);
      if (attempt === MAX_GENERATION_ATTEMPTS) throw error;
    }

    if (attempt < MAX_GENERATION_ATTEMPTS) await delay(RETRY_DELAY_MS);
  }

  throw new Error(
    "Não foi possível reunir 16 perguntas inéditas agora. Tente novamente em instantes."
  );
}

async function fetchWithTimeout(payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`O gerador respondeu com status ${response.status}.`);
    }

    return await response.json();
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("A geração ultrapassou o limite de tempo.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function acceptFreshQuestions(items, pending = []) {
  const history = getHistory();
  const pool = getPool();
  const active = normalizeQuestions(activeEpisode?.discoveries);
  const accepted = [];

  for (const question of normalizeQuestions(items)) {
    const existing = [...history, ...pool, ...active, ...pending, ...accepted];
    if (existing.some((item) => isDuplicate(question, item))) continue;
    accepted.push(question);
  }

  return accepted;
}

function buildCandidateFromInventory(source, inventory) {
  const discoveries = selectBalanced(inventory, TOTAL);
  if (discoveries.length !== TOTAL) return null;

  const candidate = {
    id: `episode-ai-${crypto.randomUUID()}`,
    source: "ai-strict",
    title: source?.title || "Episódio inédito",
    subtitle: source?.subtitle || "A IA criou e a barreira antirrepetição aprovou",
    host: source?.host || "Nico",
    intro: source?.intro || "Tudo novo por aqui.",
    outro: source?.outro || "As perguntas vistas agora também saem da fila.",
    discoveries,
    blocks: normalizeBlocks(source?.blocks, discoveries)
  };

  return isFreshEpisode(candidate) && isDifferentFromActive(candidate)
    ? candidate
    : null;
}

function recordVisibleQuestion() {
  const prompt = String(questionText?.textContent || "").trim();
  if (!prompt || prompt === "Pergunta" || recordedPrompts.has(normalize(prompt))) return;

  const question = normalizeQuestions(activeEpisode?.discoveries)
    .find((item) => normalize(item.prompt) === normalize(prompt));
  if (!question) return;

  recordedPrompts.add(normalize(prompt));
  const existing = getHistory();
  const addition = historyItem(question);
  if (!existing.some((item) => isDuplicate(addition, item))) {
    existing.push(addition);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(existing.slice(-MAX_HISTORY)));
  }

  document.documentElement.dataset.playedQuestionCount = String(existing.length);

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
  const rows = getHistory().slice(-250).map((item) => {
    const answer = item.answer ? ` | Resposta: ${item.answer}` : "";
    return `Pergunta: ${item.prompt}${answer}`;
  });

  const batches = [];
  for (let index = 0; index < rows.length; index += HISTORY_BATCH_SIZE) {
    batches.push(rows.slice(index, index + HISTORY_BATCH_SIZE).join("\n"));
  }

  return batches.slice(-MAX_HISTORY_BATCHES);
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

  localStorage.setItem(NEXT_KEY, JSON.stringify({
    ...episode,
    storedAt: Date.now()
  }));
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
  return discoveries.every(
    (question) => !history.some((item) => isDuplicate(question, item))
  );
}

function isDifferentFromActive(episode) {
  if (!activeEpisode) return true;

  const active = normalizeQuestions(activeEpisode.discoveries);
  return normalizeQuestions(episode?.discoveries).every(
    (question) => !active.some((item) => isDuplicate(question, item))
  );
}

function containsInternalDuplicates(items) {
  return items.some(
    (item, index) => items.slice(0, index).some((prior) => isDuplicate(item, prior))
  );
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
  const sameFingerprint = Boolean(
    fpA && fpB && fpA !== "::" && fpB !== "::" && fpA === fpB
  );

  return sameFingerprint
    || (sameAnswer && intersection >= 2 && containment >= 0.46)
    || (intersection >= 4 && containment >= 0.68)
    || (intersection >= 5 && jaccard >= 0.52);
}

function fingerprint(item) {
  const promptTokens = [...meaningfulTokens(normalize(item?.prompt))].sort();
  const answerTokens = [
    ...meaningfulTokens(normalize(questionAnswer(item) || item?.answer))
  ].sort();

  return `${promptTokens.slice(0, 12).join("-")}::${answerTokens
    .slice(0, 5)
    .join("-")}`;
}

function meaningfulTokens(value) {
  return new Set(
    normalize(value)
      .split(" ")
      .filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
  );
}

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
    title:
      source[index]?.title ||
      ["Aquecimento", "Cultura pop", "Mundo bizarro", "Grande Final"][index],
    intro: source[index]?.intro || "Quatro descobertas inéditas.",
    discoveries: discoveries.slice(index * 4, index * 4 + 4)
  }));
}

function normalizeQuestions(items) {
  if (!Array.isArray(items)) return [];
  return dedupeQuestions(items.map(normalizeQuestion).filter(isValidQuestion));
}

function normalizeQuestion(question) {
  const options = Array.isArray(question?.options)
    ? question.options.map((item) => String(item).trim())
    : [];
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
    typeof question.prompt === "string" &&
    question.prompt.length >= 8 &&
    Array.isArray(question.options) &&
    question.options.length === 4 &&
    question.options.every(
      (option) => typeof option === "string" && option.trim()
    ) &&
    Number.isInteger(question.correctIndex) &&
    question.correctIndex >= 0 &&
    question.correctIndex < 4
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MEDIA_TIMEOUT_MS);

  try {
    const response = await fetch(`${MEDIA_MANIFEST_URL}?v=2.0.1`, {
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) return [];

    const data = await response.json();
    return Array.isArray(data)
      ? data
      : Array.isArray(data?.items)
        ? data.items
        : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function signalPreparing(message) {
  document.documentElement.dataset.episodeReady = "false";
  document.documentElement.dataset.episodeState = "preparing";
  delete document.documentElement.dataset.episodeError;
  window.dispatchEvent(new CustomEvent("burrquizzz:episode-preparing", {
    detail: { message }
  }));
}

function signalProgress(message) {
  document.documentElement.dataset.episodeState = "preparing";
  window.dispatchEvent(new CustomEvent("burrquizzz:episode-progress", {
    detail: { message }
  }));
}

function signalError(error) {
  const message = error instanceof Error
    ? error.message
    : "Não foi possível preparar o episódio.";

  document.documentElement.dataset.episodeReady = "false";
  document.documentElement.dataset.episodeState = "error";
  document.documentElement.dataset.episodeError = message;
  document.documentElement.dataset.backgroundGeneration = "error";

  console.error("Falha ao preparar episódio do Burrquizzz.", error);
  window.dispatchEvent(new CustomEvent("burrquizzz:episode-error", {
    detail: { message }
  }));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
