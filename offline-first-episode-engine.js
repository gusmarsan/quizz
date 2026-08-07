import { QUESTIONS } from "./questions.js";

const AI_ENDPOINT = "https://quiz-duelo-ai.gustavomarsan.workers.dev/";
const TOTAL = 16;
const FETCH_TIMEOUT_MS = 18000;
const MAX_POOL = 1200;
const MAX_HISTORY = 3000;

const CURRENT_KEY = "burrquizzzCurrentEpisodeV5";
const LEGACY_CURRENT_KEY = "burrquizzzCurrentEpisode";
const NEXT_KEY = "burrquizzzNextEpisodeV5";
const POOL_KEY = "burrquizzzQuestionPoolV5";
const HISTORY_KEY = "burrquizzzPlayedQuestionsV3";
const LEGACY_HISTORY_KEYS = [
  "burrquizzzPlayedQuestionsV2",
  "burrquizzzQuestionArchive"
];

const STATIC_QUESTIONS = QUESTIONS.map(cloneQuestion).filter(isValidQuestion);
const gameScreen = document.querySelector("#screen-game");
const setupScreen = document.querySelector("#screen-solo-setup");
const questionText = document.querySelector("#questionText");
const startButton = document.querySelector("#startSoloButton");

let activeEpisode = null;
let generationPromise = null;
let episodeStarted = false;
let setupWasActive = setupScreen?.classList.contains("active") || false;
let recordedPrompts = new Set();

boot();

function boot() {
  migrateHistory();
  observeFlow();
  restoreStartButton();

  const cached = consumeNextEpisode();
  const first = isPlayableEpisode(cached) && isDifferentFromActive(cached)
    ? cached
    : buildLocalEpisode("initial");

  applyEpisode(first, cached ? "prefetched-local" : "offline-first");
  ensureNextEpisode();
  queueBackgroundGeneration();
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
        queueBackgroundGeneration();
      }

      if (episodeStarted && setupActive && !setupWasActive) {
        activateNextEpisode();
      }

      setupWasActive = setupActive;
    });

    screenObserver.observe(gameScreen, {
      attributes: true,
      attributeFilter: ["class"]
    });
    screenObserver.observe(setupScreen, {
      attributes: true,
      attributeFilter: ["class"]
    });
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

function activateNextEpisode() {
  const stored = consumeNextEpisode();
  const next = isPlayableEpisode(stored) && isDifferentFromActive(stored)
    ? stored
    : buildLocalEpisode("rotation");

  applyEpisode(next, stored ? "prefetched-local" : "offline-rotation");
  ensureNextEpisode();
  queueBackgroundGeneration();
}

function applyEpisode(episode, source) {
  const discoveries = normalizeQuestions(episode?.discoveries);
  if (discoveries.length !== TOTAL || containsInternalDuplicates(discoveries)) {
    throw new Error("O episódio local não contém 16 perguntas válidas e diferentes.");
  }

  const normalizedEpisode = {
    id: episode.id || `episode-${crypto.randomUUID()}`,
    source,
    title: String(episode.title || "Rodada pronta").trim(),
    subtitle: String(
      episode.subtitle || "Perguntas locais disponíveis imediatamente"
    ).trim(),
    host: String(episode.host || "Nico").trim(),
    intro: String(
      episode.intro || "A partida não depende de conexão com o gerador."
    ).trim(),
    outro: String(
      episode.outro || "As perguntas exibidas entram para o histórico."
    ).trim(),
    discoveries,
    blocks: normalizeBlocks(episode.blocks, discoveries)
  };

  activeEpisode = normalizedEpisode;
  recordedPrompts = new Set();
  QUESTIONS.splice(0, QUESTIONS.length, ...discoveries.map(cloneQuestion));

  localStorage.setItem(CURRENT_KEY, JSON.stringify(normalizedEpisode));
  localStorage.setItem(LEGACY_CURRENT_KEY, JSON.stringify(normalizedEpisode));
  window.BURRQUIZZZ_EPISODE = normalizedEpisode;

  document.documentElement.dataset.questionSource = source;
  document.documentElement.dataset.episodeDelivery = source;
  document.documentElement.dataset.episodeReady = "true";
  document.documentElement.dataset.episodeState = "ready";
  document.documentElement.dataset.noRepeatEngine = "v5-offline-first";
  document.documentElement.dataset.offlineQuestionCount = String(STATIC_QUESTIONS.length);
  delete document.documentElement.dataset.episodeError;

  restoreStartButton();
  window.dispatchEvent(
    new CustomEvent("burrquizzz:episode-ready", { detail: normalizedEpisode })
  );
}

function buildLocalEpisode(source) {
  const pool = getPool();
  if (pool.length < TOTAL) {
    throw new Error(`O banco local tem apenas ${pool.length} perguntas válidas.`);
  }

  const history = getHistory();
  const playedAtByPrompt = new Map(
    history.map((item) => [normalizePrompt(item.prompt), Number(item.playedAt || 0)])
  );
  const activePrompts = getPromptSet(activeEpisode?.discoveries);

  const available = pool.filter(
    (question) => !activePrompts.has(normalizePrompt(question.prompt))
  );

  const unseen = shuffle(
    available.filter(
      (question) => !playedAtByPrompt.has(normalizePrompt(question.prompt))
    )
  );

  const previouslySeen = shuffle(
    available.filter(
      (question) => playedAtByPrompt.has(normalizePrompt(question.prompt))
    )
  ).sort((a, b) => {
    const timeA = playedAtByPrompt.get(normalizePrompt(a.prompt)) || 0;
    const timeB = playedAtByPrompt.get(normalizePrompt(b.prompt)) || 0;
    return timeA - timeB;
  });

  const selected = selectBalanced(unseen, TOTAL);
  fillSelection(selected, previouslySeen, TOTAL);

  if (selected.length < TOTAL) {
    fillSelection(selected, pool, TOTAL);
  }

  if (selected.length !== TOTAL) {
    throw new Error("Não foi possível montar uma rodada local completa.");
  }

  const reusedCount = selected.filter((question) =>
    playedAtByPrompt.has(normalizePrompt(question.prompt))
  ).length;

  return {
    id: `episode-${source}-${crypto.randomUUID()}`,
    source: reusedCount ? "offline-oldest-first" : "offline-unseen",
    title: reusedCount ? "Rodada pronta para jogar" : "Perguntas ainda não vistas",
    subtitle: reusedCount
      ? `${reusedCount} pergunta(s) antiga(s) voltaram porque o estoque inédito terminou`
      : "Todas as perguntas desta rodada são novas neste navegador",
    host: "Nico",
    intro: reusedCount
      ? "O jogo priorizou as perguntas vistas há mais tempo e não esperou pela internet."
      : "O banco local foi carregado sem depender do gerador externo.",
    outro: "As perguntas exibidas agora recebem uma nova data no histórico.",
    discoveries: selected,
    blocks: normalizeBlocks([], selected)
  };
}

function ensureNextEpisode() {
  const stored = readJson(NEXT_KEY);
  if (isPlayableEpisode(stored) && isDifferentFromActive(stored)) {
    document.documentElement.dataset.nextEpisodeReady = "true";
    return stored;
  }

  localStorage.removeItem(NEXT_KEY);
  const local = buildLocalEpisode("next");
  storeNextEpisode(local);
  return local;
}

function storeNextEpisode(episode) {
  if (!isPlayableEpisode(episode) || !isDifferentFromActive(episode)) {
    return false;
  }

  localStorage.setItem(
    NEXT_KEY,
    JSON.stringify({ ...episode, storedAt: Date.now() })
  );
  document.documentElement.dataset.nextEpisodeReady = "true";
  return true;
}

function consumeNextEpisode() {
  const episode = readJson(NEXT_KEY);
  localStorage.removeItem(NEXT_KEY);
  return episode;
}

function queueBackgroundGeneration() {
  if (generationPromise) return generationPromise;

  document.documentElement.dataset.backgroundGeneration = "running";
  generationPromise = generateInventoryInBackground()
    .then((accepted) => {
      document.documentElement.dataset.backgroundGeneration = accepted.length
        ? "ready"
        : "no-new-items";
      document.documentElement.dataset.generatedFreshCount = String(accepted.length);
      if (accepted.length) ensureNextEpisode();
      return accepted;
    })
    .catch((error) => {
      console.warn(
        "O gerador externo falhou, mas o jogo continua com o banco local.",
        error
      );
      document.documentElement.dataset.backgroundGeneration = "unavailable";
      return [];
    })
    .finally(() => {
      generationPromise = null;
    });

  return generationPromise;
}

async function generateInventoryInBackground() {
  const payload = {
    count: TOTAL,
    recentQuestions: getHistory()
      .slice(-250)
      .map((item) => `Pergunta: ${item.prompt}`),
    mediaItems: [],
    strictNoRepeat: false,
    requestNonce: crypto.randomUUID()
  };

  const data = await fetchWithTimeout(payload);
  const generated = normalizeQuestions(
    data?.episode?.discoveries ||
      data?.questions ||
      data?.episode?.blocks?.flatMap((block) => block?.discoveries || [])
  );

  const blocked = getPromptSet([
    ...getHistory(),
    ...getPool(),
    ...(activeEpisode?.discoveries || [])
  ]);
  const accepted = [];

  for (const question of generated) {
    const prompt = normalizePrompt(question.prompt);
    if (!prompt || blocked.has(prompt)) continue;
    blocked.add(prompt);
    accepted.push(question);
  }

  if (accepted.length) mergeIntoPool(accepted);
  return accepted;
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
      throw new Error("A geração em segundo plano ultrapassou o limite de tempo.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function recordVisibleQuestion() {
  const prompt = String(questionText?.textContent || "").trim();
  const promptKey = normalizePrompt(prompt);

  if (!promptKey || promptKey === "pergunta" || recordedPrompts.has(promptKey)) {
    return;
  }

  const question = activeEpisode?.discoveries?.find(
    (item) => normalizePrompt(item.prompt) === promptKey
  );
  if (!question) return;

  recordedPrompts.add(promptKey);

  const history = getHistory().filter(
    (item) => normalizePrompt(item.prompt) !== promptKey
  );
  history.push(historyItem(question));
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
  document.documentElement.dataset.playedQuestionCount = String(history.length);

  const stored = readJson(NEXT_KEY);
  if (!isDifferentFromHistorySnapshot(stored, history)) {
    localStorage.removeItem(NEXT_KEY);
    ensureNextEpisode();
  }
}

function isDifferentFromHistorySnapshot(episode, history) {
  if (!isPlayableEpisode(episode)) return false;
  const newestPrompts = new Set(
    history.slice(-TOTAL).map((item) => normalizePrompt(item.prompt))
  );
  return episode.discoveries.every(
    (question) => !newestPrompts.has(normalizePrompt(question.prompt))
  );
}

function getHistory() {
  return readArray(HISTORY_KEY)
    .map(normalizeHistoryItem)
    .filter((item) => item.prompt)
    .slice(-MAX_HISTORY);
}

function migrateHistory() {
  if (readArray(HISTORY_KEY).length) return;

  const migratedByPrompt = new Map();

  for (const key of LEGACY_HISTORY_KEYS) {
    for (const item of readArray(key)) {
      const normalized = normalizeHistoryItem(item);
      const promptKey = normalizePrompt(normalized.prompt);
      if (!promptKey) continue;

      const current = migratedByPrompt.get(promptKey);
      if (!current || normalized.playedAt >= current.playedAt) {
        migratedByPrompt.set(promptKey, normalized);
      }
    }
  }

  const migrated = [...migratedByPrompt.values()]
    .sort((a, b) => a.playedAt - b.playedAt)
    .slice(-MAX_HISTORY);

  if (migrated.length) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(migrated));
  }
}

function getPool() {
  return dedupeQuestions([
    ...STATIC_QUESTIONS,
    ...normalizeQuestions(readArray(POOL_KEY))
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

function isPlayableEpisode(episode) {
  const discoveries = normalizeQuestions(episode?.discoveries);
  return discoveries.length === TOTAL && !containsInternalDuplicates(discoveries);
}

function isDifferentFromActive(episode) {
  if (!activeEpisode) return true;
  const activePrompts = getPromptSet(activeEpisode.discoveries);
  return normalizeQuestions(episode?.discoveries).every(
    (question) => !activePrompts.has(normalizePrompt(question.prompt))
  );
}

function containsInternalDuplicates(items) {
  const seen = new Set();
  for (const item of items) {
    const key = normalizePrompt(item.prompt);
    if (!key || seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

function selectBalanced(items, count) {
  const selected = [];
  const categoryCounts = new Map();

  for (const question of items) {
    const category = normalizePrompt(question.category || "geral");
    const used = categoryCounts.get(category) || 0;
    if (used >= 3 && selected.length < count - 3) continue;

    selected.push(cloneQuestion(question));
    categoryCounts.set(category, used + 1);
    if (selected.length === count) break;
  }

  fillSelection(selected, items, count);
  return selected;
}

function fillSelection(selected, candidates, count) {
  const selectedPrompts = getPromptSet(selected);

  for (const question of candidates) {
    if (selected.length >= count) return;
    const key = normalizePrompt(question.prompt);
    if (!key || selectedPrompts.has(key)) continue;

    selected.push(cloneQuestion(question));
    selectedPrompts.add(key);
  }
}

function normalizeBlocks(blocks, discoveries) {
  const source = Array.isArray(blocks) ? blocks : [];
  return [0, 1, 2, 3].map((index) => ({
    id: source[index]?.id || `block-${index + 1}`,
    title:
      source[index]?.title ||
      ["Aquecimento", "Cultura pop", "Mundo bizarro", "Grande Final"][index],
    intro: source[index]?.intro || "Quatro perguntas.",
    discoveries: discoveries.slice(index * 4, index * 4 + 4)
  }));
}

function normalizeQuestions(items) {
  if (!Array.isArray(items)) return [];
  return dedupeQuestions(items.map(normalizeQuestion).filter(isValidQuestion));
}

function normalizeQuestion(question) {
  const type = ["multiple_choice", "image_choice", "text_input", "match_columns"]
    .includes(question?.type)
    ? question.type
    : "multiple_choice";

  const normalized = {
    ...cloneQuestion(question),
    id: String(question?.id || `q-${crypto.randomUUID()}`),
    type,
    category: String(question?.category || "Cultura pop").trim(),
    difficulty: String(question?.difficulty || "media").trim(),
    prompt: String(question?.prompt || "").trim(),
    explanation: String(question?.explanation || "").trim()
  };

  if (type === "multiple_choice" || type === "image_choice") {
    normalized.options = Array.isArray(question?.options)
      ? question.options.map((item) => String(item).trim())
      : [];
    normalized.correctIndex = Number(question?.correctIndex);
    normalized.image = String(question?.image || "").trim();
  }

  if (type === "text_input") {
    normalized.acceptedAnswers = Array.isArray(question?.acceptedAnswers)
      ? question.acceptedAnswers.map((item) => String(item).trim()).filter(Boolean)
      : [];
    normalized.placeholder = String(question?.placeholder || "Digite a resposta").trim();
  }

  if (type === "match_columns") {
    normalized.leftItems = stringArray(question?.leftItems);
    normalized.rightItems = stringArray(question?.rightItems);
    normalized.matches = stringArray(question?.matches);
  }

  return normalized;
}

function isValidQuestion(question) {
  if (!question || typeof question.prompt !== "string" || question.prompt.trim().length < 8) {
    return false;
  }

  if (question.type === "multiple_choice" || question.type === "image_choice") {
    return Boolean(
      Array.isArray(question.options) &&
        question.options.length === 4 &&
        question.options.every((option) => typeof option === "string" && option.trim()) &&
        Number.isInteger(Number(question.correctIndex)) &&
        Number(question.correctIndex) >= 0 &&
        Number(question.correctIndex) < 4
    );
  }

  if (question.type === "text_input") {
    return Boolean(
      Array.isArray(question.acceptedAnswers) &&
        question.acceptedAnswers.length > 0 &&
        question.acceptedAnswers.every((answer) => typeof answer === "string" && answer.trim())
    );
  }

  if (question.type === "match_columns") {
    return Boolean(
      Array.isArray(question.leftItems) &&
        Array.isArray(question.rightItems) &&
        Array.isArray(question.matches) &&
        question.leftItems.length > 0 &&
        question.leftItems.length === question.matches.length &&
        question.rightItems.length >= question.matches.length
    );
  }

  return false;
}

function dedupeQuestions(items) {
  const result = [];
  const seen = new Set();

  for (const item of items) {
    if (!isValidQuestion(item)) continue;
    const key = normalizePrompt(item.prompt);
    if (!key || seen.has(key)) continue;

    seen.add(key);
    result.push(cloneQuestion(item));
  }

  return result;
}

function historyItem(question) {
  return {
    prompt: String(question.prompt || ""),
    answer: questionAnswer(question),
    category: String(question.category || ""),
    playedAt: Date.now()
  };
}

function normalizeHistoryItem(item) {
  return {
    prompt: String(item?.prompt || item?.question || "").trim(),
    answer: String(item?.answer || item?.correctAnswer || "").trim(),
    category: String(item?.category || "").trim(),
    playedAt: Number(item?.playedAt || 0)
  };
}

function questionAnswer(question) {
  if (question.type === "multiple_choice" || question.type === "image_choice") {
    return String(question.options?.[Number(question.correctIndex)] || "").trim();
  }
  if (question.type === "text_input") {
    return String(question.acceptedAnswers?.[0] || "").trim();
  }
  if (question.type === "match_columns") {
    return stringArray(question.matches).join(" | ");
  }
  return "";
}

function getPromptSet(items) {
  const result = new Set();
  for (const item of Array.isArray(items) ? items : []) {
    const key = normalizePrompt(item?.prompt || item?.question);
    if (key) result.add(key);
  }
  return result;
}

function normalizePrompt(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stringArray(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

function cloneQuestion(question) {
  return JSON.parse(JSON.stringify(question));
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

function restoreStartButton() {
  if (!startButton) return;
  startButton.disabled = false;
  startButton.textContent = "Começar";
}
