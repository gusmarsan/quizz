import "./episode-intro.js";
import "./episode-sync.js";
import "./block-runtime.js";
import { QUESTIONS } from "./questions.js";

const AI_ENDPOINT = "https://quiz-duelo-ai.gustavomarsan.workers.dev/";
const MEDIA_MANIFEST_URL = "./assets/media/manifest.json";
const RECENT_STORAGE_KEY = "quizDuelRecentAIQuestions";
const EPISODE_STORAGE_KEY = "burrquizzzCurrentEpisode";
const NEXT_EPISODE_STORAGE_KEY = "burrquizzzNextEpisode";
const NEXT_EPISODE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const AI_QUESTION_COUNT = 16;
const MAX_RECENT_QUESTIONS = 50;

const startButton = document.querySelector("#startSoloButton");
const gameScreen = document.querySelector("#screen-game");
const soloSetupScreen = document.querySelector("#screen-solo-setup");
const originalButtonText = startButton?.textContent || "Começar";

let mediaItemsCache = [];
let prefetchPromise = null;
let hasStartedEpisode = false;

observeEpisodeFlow();
prepareAIQuestions();

async function prepareAIQuestions() {
  setLoadingState(true);

  try {
    mediaItemsCache = await loadMediaItems();
    const cachedEpisode = consumeNextEpisode();

    if (cachedEpisode) {
      applyEpisode(cachedEpisode);
      document.documentElement.dataset.episodeDelivery = "cache";
      return;
    }

    const episode = await requestEpisode(getRecentQuestions(), mediaItemsCache);
    applyEpisode(episode);
    document.documentElement.dataset.episodeDelivery = "live";
  } catch (error) {
    console.warn("Não foi possível carregar o episódio da IA. O banco local será usado.", error);
    localStorage.removeItem(EPISODE_STORAGE_KEY);
    document.documentElement.dataset.questionSource = "local";
  } finally {
    setLoadingState(false);
  }
}

async function requestEpisode(recentQuestions, mediaItems) {
  const response = await fetch(AI_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      count: AI_QUESTION_COUNT,
      recentQuestions,
      mediaItems
    })
  });

  if (!response.ok) throw new Error(`O gerador respondeu com status ${response.status}.`);
  return normalizeEpisode(await response.json());
}

function applyEpisode(episode) {
  const generatedQuestions = validateQuestions(episode.discoveries);

  if (generatedQuestions.length < AI_QUESTION_COUNT) {
    throw new Error("O gerador não devolveu 16 descobertas válidas.");
  }

  const normalizedEpisode = {
    ...episode,
    blocks: normalizeBlocks(episode.blocks, generatedQuestions),
    discoveries: generatedQuestions
  };

  QUESTIONS.splice(0, QUESTIONS.length, ...generatedQuestions);
  saveRecentQuestions(generatedQuestions.map((question) => question.prompt));
  saveEpisode(normalizedEpisode);
  document.documentElement.dataset.questionSource = "ai";
  document.documentElement.dataset.visualDiscoveries = String(
    generatedQuestions.filter((question) => question.type === "image_choice").length
  );
  document.documentElement.dataset.episodeBlocks = "4";
  window.dispatchEvent(new CustomEvent("burrquizzz:episode-ready", { detail: normalizedEpisode }));
}

function observeEpisodeFlow() {
  if (!gameScreen || !soloSetupScreen) return;

  const observer = new MutationObserver(() => {
    if (gameScreen.classList.contains("active")) {
      hasStartedEpisode = true;
      window.setTimeout(() => prepareNextEpisode(), 1200);
      return;
    }

    if (hasStartedEpisode && soloSetupScreen.classList.contains("active")) {
      activatePreparedEpisode();
    }
  });

  observer.observe(gameScreen, { attributes: true, attributeFilter: ["class"] });
  observer.observe(soloSetupScreen, { attributes: true, attributeFilter: ["class"] });
}

async function prepareNextEpisode() {
  if (prefetchPromise || readNextEpisode()) return prefetchPromise;

  prefetchPromise = (async () => {
    try {
      const episode = await requestEpisode(getRecentQuestions(), mediaItemsCache);
      const checkedQuestions = validateQuestions(episode.discoveries);
      if (checkedQuestions.length !== AI_QUESTION_COUNT) {
        throw new Error("O próximo episódio não trouxe 16 descobertas válidas.");
      }

      const prepared = {
        ...episode,
        blocks: normalizeBlocks(episode.blocks, checkedQuestions),
        discoveries: checkedQuestions
      };

      localStorage.setItem(NEXT_EPISODE_STORAGE_KEY, JSON.stringify({
        createdAt: Date.now(),
        episode: prepared
      }));
      document.documentElement.dataset.nextEpisodeReady = "true";

      if (hasStartedEpisode && soloSetupScreen?.classList.contains("active")) {
        activatePreparedEpisode();
      }
    } catch (error) {
      console.warn("O próximo episódio não pôde ser preparado em segundo plano.", error);
      document.documentElement.dataset.nextEpisodeReady = "false";
    } finally {
      prefetchPromise = null;
    }
  })();

  return prefetchPromise;
}

function activatePreparedEpisode() {
  const episode = consumeNextEpisode();
  if (!episode) return false;

  try {
    applyEpisode(episode);
    document.documentElement.dataset.episodeDelivery = "prefetched";
    document.documentElement.dataset.nextEpisodeReady = "false";
    return true;
  } catch (error) {
    console.warn("O episódio pré-carregado era inválido e foi descartado.", error);
    return false;
  }
}

function readNextEpisode() {
  try {
    const stored = JSON.parse(localStorage.getItem(NEXT_EPISODE_STORAGE_KEY) || "null");
    if (!stored?.episode || !Number.isFinite(stored.createdAt)) return null;
    if (Date.now() - stored.createdAt > NEXT_EPISODE_MAX_AGE_MS) {
      localStorage.removeItem(NEXT_EPISODE_STORAGE_KEY);
      return null;
    }
    return stored.episode;
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

async function loadMediaItems() {
  try {
    const response = await fetch(`${MEDIA_MANIFEST_URL}?v=2`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Catálogo de mídia indisponível: ${response.status}`);
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
  } catch (error) {
    console.warn("O catálogo de imagens não pôde ser carregado. O episódio seguirá apenas com texto.", error);
    return [];
  }
}

function normalizeEpisode(data) {
  if (data?.episode) {
    const blocks = Array.isArray(data.episode.blocks) ? data.episode.blocks : [];
    const discoveries = Array.isArray(data.episode.discoveries)
      ? data.episode.discoveries
      : blocks.flatMap((block) => Array.isArray(block?.discoveries) ? block.discoveries : []);

    return {
      id: data.episode.id || `episode-${crypto.randomUUID()}`,
      title: String(data.episode.title || "O mundo é mais estranho do que parece").trim(),
      subtitle: String(data.episode.subtitle || "Conhecimento de utilidade rigorosamente duvidosa").trim(),
      host: String(data.episode.host || "Nico").trim(),
      intro: String(data.episode.intro || "Prepare-se para descobrir coisas que você não precisava saber — até agora.").trim(),
      outro: String(data.episode.outro || "Agora você sabe mais coisas inúteis do que alguns minutos atrás.").trim(),
      blocks,
      discoveries
    };
  }

  return {
    id: `episode-${crypto.randomUUID()}`,
    title: "Cultura inútil de altíssimo nível",
    subtitle: "Uma seleção de fatos estranhos, pop e surpreendentes",
    host: "Nico",
    intro: "Hoje tem cultura pop, histórias improváveis e conhecimento de utilidade rigorosamente duvidosa.",
    outro: "Agora você sabe mais coisas inúteis do que alguns minutos atrás.",
    blocks: [],
    discoveries: Array.isArray(data?.questions) ? data.questions : []
  };
}

function normalizeBlocks(blocks, questions) {
  const defaults = [
    { id: "rebobina", title: "📼 Rebobina!", intro: "Memórias desbloqueadas. Não nos responsabilizamos pelo que aparecer." },
    { id: "volume", title: "🎸 Aumenta o volume", intro: "Histórias musicais que merecem ser ouvidas — ou questionadas." },
    { id: "bizarro", title: "👽 Mundo Bizarro", intro: "A partir daqui, a realidade perde qualquer compromisso com o bom senso." },
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
    .slice(0, AI_QUESTION_COUNT)
    .map((item, index) => {
      const isImage = item.type === "image_choice" && typeof item.image === "string" && item.image.trim();
      return {
        id: item.id || `ai-${Date.now()}-${index}`,
        type: isImage ? "image_choice" : "multiple_choice",
        category: item.category.trim() || "Mundo Bizarro",
        difficulty: ["facil", "media", "dificil"].includes(item.difficulty) ? item.difficulty : "media",
        blockIndex: Math.floor(index / 4),
        blockPosition: index % 4,
        isGrandFinal: index === AI_QUESTION_COUNT - 1,
        prompt: item.prompt.trim(),
        options: item.options.map((option) => String(option).trim()),
        correctIndex: item.correctIndex,
        explanation: typeof item.explanation === "string" ? item.explanation.trim() : "",
        tone: "burrquizzz",
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

function getRecentQuestions() {
  try {
    const stored = JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY) || "[]");
    return Array.isArray(stored)
      ? stored.filter((item) => typeof item === "string").slice(-MAX_RECENT_QUESTIONS)
      : [];
  } catch {
    localStorage.removeItem(RECENT_STORAGE_KEY);
    return [];
  }
}

function saveRecentQuestions(newQuestions) {
  const combined = [...getRecentQuestions(), ...newQuestions];
  const unique = [...new Set(combined.map((item) => item.trim()).filter(Boolean))];
  localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(unique.slice(-MAX_RECENT_QUESTIONS)));
}

function saveEpisode(episode) {
  localStorage.setItem(EPISODE_STORAGE_KEY, JSON.stringify(episode));
  window.BURRQUIZZZ_EPISODE = episode;
}

function setLoadingState(isLoading) {
  if (!startButton) return;
  startButton.disabled = isLoading;
  startButton.textContent = isLoading
    ? "Criando e conferindo as descobertas..."
    : originalButtonText;
}
