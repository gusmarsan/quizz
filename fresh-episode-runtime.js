import { QUESTIONS } from "./questions.js";

const AI_ENDPOINT = "https://quiz-duelo-ai.gustavomarsan.workers.dev/";
const MEDIA_MANIFEST_URL = "./assets/media/manifest.json";
const RECENT_STORAGE_KEY = "quizDuelRecentAIQuestions";
const ARCHIVE_STORAGE_KEY = "burrquizzzQuestionArchive";
const EPISODE_STORAGE_KEY = "burrquizzzCurrentEpisode";
const NEXT_EPISODE_STORAGE_KEY = "burrquizzzNextEpisode";
const TOTAL_DISCOVERIES = 16;
const MAX_HISTORY = 320;
const MAX_ATTEMPTS = 2;

let refreshPromise = null;
let mediaCache = null;
let resultsWasActive = false;

window.BURRQUIZZZ_EPISODES = {
  ensureFresh: (previousQuestions = QUESTIONS) => ensureFreshEpisode(previousQuestions),
  signature: (items = QUESTIONS) => episodeSignature(items)
};

observeResults();

function observeResults() {
  const resultsScreen = document.querySelector("#screen-results");
  if (!resultsScreen) return;

  const check = () => {
    const active = resultsScreen.classList.contains("active");
    if (active && !resultsWasActive) prepareNextPlayableEpisode();
    resultsWasActive = active;
  };

  new MutationObserver(check).observe(resultsScreen, {
    attributes: true,
    attributeFilter: ["class"]
  });
  check();
}

async function prepareNextPlayableEpisode() {
  const button = document.querySelector("#playAgainButton");
  const originalText = button?.textContent || "Novo episódio";
  const previousQuestions = QUESTIONS.map(copyQuestion);

  if (button) {
    button.disabled = true;
    button.textContent = "Preparando perguntas novas...";
  }

  try {
    await ensureFreshEpisode(previousQuestions);
    document.documentElement.dataset.freshEpisodeReady = "true";
    if (button) button.textContent = originalText;
  } catch (error) {
    console.error("Não foi possível preparar um episódio diferente.", error);
    document.documentElement.dataset.freshEpisodeReady = "false";
    showToast("Não consegui criar perguntas novas agora. Tente novamente em instantes.");
    if (button) button.textContent = "Tentar novo episódio";
  } finally {
    if (button) button.disabled = false;
  }
}

function ensureFreshEpisode(previousQuestions = QUESTIONS) {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const previousPrompts = new Set(previousQuestions.map((item) => normalize(item?.prompt)).filter(Boolean));
    const previousSignature = episodeSignature(previousQuestions);

    let candidate = await waitForPreparedEpisode(1800);
    if (candidate && isFreshCandidate(candidate, previousPrompts, previousSignature)) {
      localStorage.removeItem(NEXT_EPISODE_STORAGE_KEY);
      return applyEpisode(candidate);
    }

    localStorage.removeItem(NEXT_EPISODE_STORAGE_KEY);
    const mediaItems = await loadMediaItems();
    let lastError = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
        const episode = await requestEpisode(mediaItems);
        if (!isFreshCandidate(episode, previousPrompts, previousSignature)) {
          throw new Error("A IA devolveu perguntas do episódio anterior.");
        }
        return applyEpisode(episode);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("Não foi possível gerar um episódio diferente.");
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

async function waitForPreparedEpisode(timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const episode = readPreparedEpisode();
    if (episode) return episode;
    await sleep(180);
  }
  return readPreparedEpisode();
}

function readPreparedEpisode() {
  try {
    const stored = JSON.parse(localStorage.getItem(NEXT_EPISODE_STORAGE_KEY) || "null");
    return stored?.episode || null;
  } catch {
    localStorage.removeItem(NEXT_EPISODE_STORAGE_KEY);
    return null;
  }
}

async function requestEpisode(mediaItems) {
  const response = await fetch(AI_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      count: TOTAL_DISCOVERIES,
      recentQuestions: getFullHistory(),
      mediaItems
    })
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.details || data?.error || `O gerador respondeu com status ${response.status}.`);
  }

  return normalizeEpisode(await response.json());
}

function normalizeEpisode(data) {
  const source = data?.episode || data || {};
  const sourceBlocks = Array.isArray(source.blocks) ? source.blocks : [];
  const rawDiscoveries = Array.isArray(source.discoveries)
    ? source.discoveries
    : sourceBlocks.flatMap((block) => Array.isArray(block?.discoveries) ? block.discoveries : []);
  const discoveries = validateQuestions(rawDiscoveries);

  if (discoveries.length !== TOTAL_DISCOVERIES) {
    throw new Error("O episódio novo não trouxe 16 descobertas válidas.");
  }

  return {
    id: source.id || `episode-${crypto.randomUUID()}`,
    title: String(source.title || "Cultura inútil de altíssimo nível").trim(),
    subtitle: String(source.subtitle || "Uma seleção de fatos estranhos, pop e surpreendentes").trim(),
    host: String(source.host || "Nico").trim(),
    intro: String(source.intro || "Prepare-se para mais dezesseis descobertas de utilidade questionável.").trim(),
    outro: String(source.outro || "Agora você sabe mais coisas inúteis do que alguns minutos atrás.").trim(),
    blocks: normalizeBlocks(sourceBlocks, discoveries),
    discoveries
  };
}

function validateQuestions(items) {
  if (!Array.isArray(items)) return [];

  return items
    .filter((item) => Boolean(
      item &&
      typeof item.prompt === "string" &&
      typeof item.category === "string" &&
      Array.isArray(item.options) &&
      item.options.length === 4 &&
      Number.isInteger(item.correctIndex) &&
      item.correctIndex >= 0 &&
      item.correctIndex <= 3
    ))
    .slice(0, TOTAL_DISCOVERIES)
    .map((item, index) => {
      const isImage = item.type === "image_choice" && typeof item.image === "string" && item.image.trim();
      return {
        id: item.id || `ai-${crypto.randomUUID()}`,
        type: isImage ? "image_choice" : "multiple_choice",
        category: item.category.trim() || "Mundo Bizarro",
        difficulty: ["facil", "media", "dificil"].includes(item.difficulty) ? item.difficulty : "media",
        blockIndex: Math.floor(index / 4),
        blockPosition: index % 4,
        isGrandFinal: index === TOTAL_DISCOVERIES - 1,
        prompt: item.prompt.trim(),
        options: item.options.map((option) => String(option).trim()),
        correctIndex: item.correctIndex,
        explanation: typeof item.explanation === "string" ? item.explanation.trim() : "",
        ...(isImage ? {
          mediaId: String(item.mediaId || "").trim(),
          image: item.image.trim(),
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
    { id: "bizarro", title: "👽 Mundo Bizarro", intro: "A partir daqui, a realidade perde qualquer compromisso com o bom senso." },
    { id: "final", title: "⭐ Grande Final", intro: "Quatro últimas descobertas. A derradeira veio para causar discussão." }
  ];

  return defaults.map((fallback, index) => {
    const source = blocks[index] || {};
    return {
      id: String(source.id || fallback.id).trim(),
      title: String(source.title || fallback.title).trim(),
      intro: String(source.intro || fallback.intro).trim(),
      startIndex: index * 4,
      endIndex: index * 4 + 3,
      discoveries: questions.slice(index * 4, index * 4 + 4).map((question) => question.id)
    };
  });
}

function isFreshCandidate(episode, previousPrompts, previousSignature) {
  const normalized = normalizeEpisode(episode);
  if (episodeSignature(normalized.discoveries) === previousSignature) return false;
  return normalized.discoveries.every((item) => !previousPrompts.has(normalize(item.prompt)));
}

function applyEpisode(episode) {
  const normalized = normalizeEpisode(episode);
  QUESTIONS.splice(0, QUESTIONS.length, ...normalized.discoveries);
  localStorage.setItem(EPISODE_STORAGE_KEY, JSON.stringify(normalized));
  localStorage.removeItem(NEXT_EPISODE_STORAGE_KEY);
  saveHistory(normalized.discoveries);
  window.BURRQUIZZZ_EPISODE = normalized;
  document.documentElement.dataset.questionSource = "ai";
  document.documentElement.dataset.episodeDelivery = "fresh-after-results";
  window.dispatchEvent(new CustomEvent("burrquizzz:episode-ready", { detail: normalized }));
  return normalized;
}

function getFullHistory() {
  const prompts = [];

  try {
    const recent = JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY) || "[]");
    if (Array.isArray(recent)) prompts.push(...recent.filter((item) => typeof item === "string"));
  } catch {
    localStorage.removeItem(RECENT_STORAGE_KEY);
  }

  try {
    const archive = JSON.parse(localStorage.getItem(ARCHIVE_STORAGE_KEY) || "[]");
    if (Array.isArray(archive)) {
      archive.forEach((item) => {
        if (typeof item === "string") prompts.push(item);
        else if (typeof item?.prompt === "string") prompts.push(item.prompt);
      });
    }
  } catch {
    localStorage.removeItem(ARCHIVE_STORAGE_KEY);
  }

  prompts.push(...QUESTIONS.map((item) => item?.prompt).filter(Boolean));
  return uniqueNormalized(prompts).slice(-MAX_HISTORY);
}

function saveHistory(discoveries) {
  const combined = [...getFullHistory(), ...discoveries.map((item) => item.prompt)];
  localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(uniqueNormalized(combined).slice(-MAX_HISTORY)));
}

async function loadMediaItems() {
  if (mediaCache) return mediaCache;

  try {
    const response = await fetch(`${MEDIA_MANIFEST_URL}?v=3`, { cache: "no-store" });
    if (!response.ok) throw new Error("Catálogo indisponível");
    const manifest = await response.json();
    mediaCache = Array.isArray(manifest?.items)
      ? manifest.items.filter((item) => item?.status === "ready" && item?.type === "image")
      : [];
  } catch {
    mediaCache = [];
  }

  return mediaCache;
}

function episodeSignature(items) {
  const discoveries = Array.isArray(items?.discoveries) ? items.discoveries : items;
  if (!Array.isArray(discoveries)) return "";
  return discoveries.map((item) => normalize(item?.prompt)).filter(Boolean).join("||");
}

function uniqueNormalized(items) {
  const seen = new Set();
  const result = [];
  items.forEach((item) => {
    const text = String(item || "").trim();
    const key = normalize(text);
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(text);
  });
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

function copyQuestion(question) {
  return { ...question, options: Array.isArray(question?.options) ? [...question.options] : [] };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("visible"), 3200);
}
