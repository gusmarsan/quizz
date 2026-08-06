import { QUESTIONS } from "./questions.js";

const AI_ENDPOINT = "https://quiz-duelo-ai.gustavomarsan.workers.dev/";
const POLICY_VERSION = "1.85";
const TOTAL_DISCOVERIES = 16;
const MIN_QUESTIONS_BETWEEN_REPEATS = 100;
const QUESTION_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const MAX_REPLENISH_ATTEMPTS = 3;
const MAX_POOL_ITEMS = 800;
const PLAYED_STORAGE_KEY = "burrquizzzPlayedQuestionsV2";
const POOL_STORAGE_KEY = "burrquizzzQuestionPoolV2";
const NEXT_EPISODE_STORAGE_KEY = "burrquizzzNextEpisode";
const CURRENT_EPISODE_STORAGE_KEY = "burrquizzzCurrentEpisode";
const POLICY_STORAGE_KEY = "burrquizzzFreshnessPolicyVersion";

const BASE_QUESTIONS = QUESTIONS.map(cloneQuestion).filter(isValidQuestion);
const startButton = document.querySelector("#startSoloButton");
const originalButtonText = startButton?.textContent || "Começar";

updateVersionBadge();
const processedEpisodes = new Set();
const repairPromises = new Map();

initializePolicy();
window.addEventListener("burrquizzz:episode-ready", (event) => {
  enforceFreshEpisode(event.detail);
});

function updateVersionBadge() {
  const badge = document.querySelector("#burrAppVersion");
  if (badge) {
    badge.textContent = `v${POLICY_VERSION}`;
    badge.title = `Burrquizzz versão ${POLICY_VERSION}`;
    badge.setAttribute("aria-label", `Versão ${POLICY_VERSION}`);
  }
  document.documentElement.dataset.appVersion = POLICY_VERSION;
}

function initializePolicy() {
  const previousPolicy = localStorage.getItem(POLICY_STORAGE_KEY);
  if (previousPolicy !== POLICY_VERSION) {
    localStorage.removeItem(NEXT_EPISODE_STORAGE_KEY);
    localStorage.setItem(POLICY_STORAGE_KEY, POLICY_VERSION);
  }

  document.documentElement.dataset.freshnessPolicy = POLICY_VERSION;
  document.documentElement.dataset.repeatGap = String(MIN_QUESTIONS_BETWEEN_REPEATS);
  document.documentElement.dataset.repeatCooldownHours = "24";
}

function enforceFreshEpisode(episode) {
  if (!episode || !Array.isArray(episode.discoveries)) return;
  if (episode.id && processedEpisodes.has(episode.id)) return;

  const history = readPlayedHistory();
  const result = buildFreshSelection(episode, history);

  if (result.selected.length >= TOTAL_DISCOVERIES) {
    applyFreshSelection(episode, result.selected, result.mode, history, false);
    return;
  }

  replenishAndRepair(episode, history);
}

function buildFreshSelection(episode, history, extraQuestions = []) {
  const recentHistory = history.slice(-MIN_QUESTIONS_BETWEEN_REPEATS);
  const dailyHistory = history.filter((item) => (
    item.playedAt > 0 && Date.now() - item.playedAt < QUESTION_COOLDOWN_MS
  ));
  const blockedHistory = mergeHistory(recentHistory, dailyHistory);
  const original = normalizeQuestions(episode.discoveries);
  const pool = dedupeQuestions([
    ...original,
    ...extraQuestions,
    ...readArray(POOL_STORAGE_KEY),
    ...BASE_QUESTIONS
  ]);
  const rankedPool = rankCandidates(pool, history);
  const selected = [];
  const categoryCount = new Map();

  for (const question of original) {
    addQuestionIfFresh(question, selected, categoryCount, blockedHistory, true);
  }

  fillEpisode(rankedPool, selected, categoryCount, blockedHistory, true);

  let mode = "strict";
  if (selected.length < TOTAL_DISCOVERIES) {
    mode = "semantic-relaxed";
    fillEpisode(rankedPool, selected, categoryCount, blockedHistory, false);
  }

  return { selected, mode };
}

function replenishAndRepair(episode, history) {
  const repairKey = episode.id || "current";
  if (repairPromises.has(repairKey)) return repairPromises.get(repairKey);

  setStartWaiting(true);
  document.documentElement.dataset.freshnessGuard = "replenishing";

  const promise = (async () => {
    const generated = [];

    for (let attempt = 1; attempt <= MAX_REPLENISH_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetch(AI_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            count: TOTAL_DISCOVERIES,
            recentQuestions: history.slice(-120).map(formatHistoryForAI),
            mediaItems: []
          })
        });

        if (!response.ok) throw new Error(`Status ${response.status}`);
        const questions = extractGeneratedQuestions(await response.json());
        generated.push(...questions);
        mergeIntoPool(questions);

        const result = buildFreshSelection(episode, history, generated);
        if (result.selected.length >= TOTAL_DISCOVERIES) {
          applyFreshSelection(episode, result.selected, result.mode, history, true);
          setStartWaiting(false);
          return true;
        }
      } catch (error) {
        console.warn(`Tentativa ${attempt} de renovar o episódio falhou.`, error);
      }
    }

    document.documentElement.dataset.freshnessGuard = "insufficient-pool";
    if (startButton) startButton.textContent = "Aguardando perguntas novas";
    console.warn("O episódio foi bloqueado para evitar perguntas repetidas antes do intervalo mínimo.");
    return false;
  })().finally(() => {
    repairPromises.delete(repairKey);
  });

  repairPromises.set(repairKey, promise);
  return promise;
}

function applyFreshSelection(episode, selected, mode, history, redispatch) {
  const normalized = selected.slice(0, TOTAL_DISCOVERIES).map((question, index) => ({
    ...cloneQuestion(question),
    blockIndex: Math.floor(index / 4),
    blockPosition: index % 4,
    isGrandFinal: index === TOTAL_DISCOVERIES - 1
  }));

  episode.discoveries.splice(0, episode.discoveries.length, ...normalized);
  episode.blocks = refreshBlocks(episode.blocks, normalized);
  QUESTIONS.splice(0, QUESTIONS.length, ...normalized.map(cloneQuestion));
  window.BURRQUIZZZ_EPISODE = episode;
  localStorage.setItem(CURRENT_EPISODE_STORAGE_KEY, JSON.stringify(episode));

  if (episode.id) processedEpisodes.add(episode.id);
  document.documentElement.dataset.freshnessGuard = mode;
  document.documentElement.dataset.freshQuestions = String(normalized.length);
  document.documentElement.dataset.playedQuestionCount = String(history.length);

  if (redispatch) {
    window.dispatchEvent(new CustomEvent("burrquizzz:episode-ready", { detail: episode }));
  }
}

function fillEpisode(candidates, selected, categoryCount, blockedHistory, checkSemanticSimilarity) {
  for (const question of candidates) {
    addQuestionIfFresh(
      question,
      selected,
      categoryCount,
      blockedHistory,
      checkSemanticSimilarity
    );
    if (selected.length >= TOTAL_DISCOVERIES) return;
  }
}

function addQuestionIfFresh(
  question,
  selected,
  categoryCount,
  blockedHistory,
  checkSemanticSimilarity
) {
  if (!isValidQuestion(question) || selected.length >= TOTAL_DISCOVERIES) return false;

  const promptKey = questionPromptKey(question);
  if (selected.some((item) => questionPromptKey(item) === promptKey)) return false;
  if (blockedHistory.some((item) => item.promptKey === promptKey)) return false;

  if (checkSemanticSimilarity) {
    if (selected.some((item) => isNearDuplicate(question, historyFromQuestion(item)))) return false;
    if (blockedHistory.some((item) => isNearDuplicate(question, item))) return false;
  }

  const category = normalize(question.category || "geral");
  const used = categoryCount.get(category) || 0;
  if (used >= 3 && selected.length < TOTAL_DISCOVERIES - 3) return false;

  selected.push(cloneQuestion(question));
  categoryCount.set(category, used + 1);
  return true;
}

function rankCandidates(items, history) {
  const lastPosition = new Map();
  history.forEach((item, index) => {
    lastPosition.set(item.promptKey, index);
  });

  return shuffle(items).sort((a, b) => {
    const positionA = lastPosition.has(questionPromptKey(a))
      ? lastPosition.get(questionPromptKey(a))
      : -1;
    const positionB = lastPosition.has(questionPromptKey(b))
      ? lastPosition.get(questionPromptKey(b))
      : -1;
    return positionA - positionB;
  });
}

function readPlayedHistory() {
  return readArray(PLAYED_STORAGE_KEY)
    .map(normalizeHistoryItem)
    .filter((item) => item.prompt)
    .slice(-1200);
}

function mergeHistory(...groups) {
  const result = [];
  const seen = new Set();
  groups.flat().forEach((item) => {
    const identity = `${item.promptKey}|${item.playedAt}`;
    if (!item.prompt || seen.has(identity)) return;
    seen.add(identity);
    result.push(item);
  });
  return result;
}

function normalizeHistoryItem(item) {
  const prompt = String(item?.prompt || "").trim();
  const answer = String(item?.answer || item?.correctAnswer || "").trim();
  return {
    prompt,
    promptKey: normalize(prompt),
    answer,
    category: String(item?.category || "").trim(),
    playedAt: Number(item?.playedAt || 0)
  };
}

function historyFromQuestion(question) {
  return normalizeHistoryItem({
    prompt: question?.prompt,
    answer: questionAnswer(question),
    category: question?.category
  });
}

function formatHistoryForAI(item) {
  const parts = [`Pergunta: ${item.prompt}`];
  if (item.answer) parts.push(`Resposta: ${item.answer}`);
  if (item.category) parts.push(`Tema: ${item.category}`);
  return parts.join(" | ");
}

function extractGeneratedQuestions(data) {
  const episode = data?.episode || {};
  const blocks = Array.isArray(episode.blocks) ? episode.blocks : [];
  const discoveries = Array.isArray(episode.discoveries)
    ? episode.discoveries
    : blocks.flatMap((block) => Array.isArray(block?.discoveries) ? block.discoveries : []);
  return normalizeQuestions(discoveries);
}

function mergeIntoPool(newQuestions) {
  const merged = dedupeQuestions([
    ...readArray(POOL_STORAGE_KEY),
    ...normalizeQuestions(newQuestions)
  ]).slice(-MAX_POOL_ITEMS);
  localStorage.setItem(POOL_STORAGE_KEY, JSON.stringify(merged));
}

function setStartWaiting(waiting) {
  if (!startButton) return;
  startButton.disabled = waiting;
  startButton.textContent = waiting ? "Preparando perguntas novas..." : originalButtonText;
}

function refreshBlocks(blocks, questions) {
  const sourceBlocks = Array.isArray(blocks) ? blocks : [];
  return [0, 1, 2, 3].map((index) => {
    const source = sourceBlocks[index] || {};
    return {
      ...source,
      startIndex: index * 4,
      endIndex: index * 4 + 3,
      discoveries: questions.slice(index * 4, index * 4 + 4).map((question) => question.id)
    };
  });
}

function normalizeQuestions(items) {
  if (!Array.isArray(items)) return [];
  return items.filter(isValidQuestion).map(cloneQuestion);
}

function dedupeQuestions(items) {
  const result = [];
  const seen = new Set();
  items.forEach((item) => {
    if (!isValidQuestion(item)) return;
    const key = questionPromptKey(item);
    if (seen.has(key)) return;
    seen.add(key);
    result.push(cloneQuestion(item));
  });
  return result;
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

function questionPromptKey(question) {
  return normalize(question?.prompt || "");
}

function questionAnswer(question) {
  const options = Array.isArray(question?.options) ? question.options : [];
  return options[Number(question?.correctIndex)] || question?.answer || "";
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
