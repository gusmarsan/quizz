import { QUESTIONS } from "./questions.js";

const TOTAL_DISCOVERIES = 16;
const LAST_SIGNATURE_KEY = "burrquizzzLastSoloSignature";
const SOLO_HISTORY_KEY = "burrquizzzSoloPlayedQuestions";
const EPISODE_STORAGE_KEY = "burrquizzzCurrentEpisode";
const MAX_HISTORY = 320;

// Capturado antes de qualquer resposta assíncrona da IA substituir QUESTIONS.
const LOCAL_QUESTION_BANK = QUESTIONS
  .filter(isSupportedQuestion)
  .map(copyQuestion);

let bypassNextClick = false;
let preparing = false;

document.addEventListener("click", interceptSoloStart, true);

async function interceptSoloStart(event) {
  const button = event.target instanceof Element
    ? event.target.closest("#startSoloButton")
    : null;

  if (!button || bypassNextClick || button.disabled || preparing) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  preparing = true;
  const originalText = button.textContent || "Começar";
  button.disabled = true;
  button.textContent = "Buscando 16 perguntas novas...";

  try {
    let selected = currentPlayableQuestions();
    const previousSignature = localStorage.getItem(LAST_SIGNATURE_KEY) || "";
    const currentSignature = episodeSignature(selected);
    const source = document.documentElement.dataset.questionSource || "";
    const mustReplace =
      selected.length !== TOTAL_DISCOVERIES ||
      source.startsWith("local") ||
      (previousSignature && currentSignature === previousSignature);

    if (mustReplace) {
      selected = await tryFreshAI(selected, previousSignature);
    }

    if (
      selected.length !== TOTAL_DISCOVERIES ||
      (previousSignature && episodeSignature(selected) === previousSignature)
    ) {
      selected = applyRotatingLocalEpisode(previousSignature);
    }

    rememberEpisode(selected);

    button.disabled = false;
    button.textContent = originalText;
    bypassNextClick = true;
    button.click();
    queueMicrotask(() => {
      bypassNextClick = false;
    });
  } catch (error) {
    console.error("Não foi possível preparar perguntas novas para o modo solo.", error);
    const selected = applyRotatingLocalEpisode(
      localStorage.getItem(LAST_SIGNATURE_KEY) || ""
    );
    rememberEpisode(selected);

    button.disabled = false;
    button.textContent = originalText;
    showToast("Usei outro conjunto do banco local para não repetir a partida.");
    bypassNextClick = true;
    button.click();
    queueMicrotask(() => {
      bypassNextClick = false;
    });
  } finally {
    preparing = false;
  }
}

async function tryFreshAI(previousQuestions, previousSignature) {
  const manager = window.BURRQUIZZZ_EPISODES;
  if (!manager?.ensureFresh) return [];

  try {
    await manager.ensureFresh(previousQuestions);
    const candidate = currentPlayableQuestions();
    if (
      candidate.length === TOTAL_DISCOVERIES &&
      episodeSignature(candidate) !== previousSignature
    ) {
      return candidate;
    }
  } catch (error) {
    console.warn("A IA não entregou um episódio solo diferente. Usando rotação local.", error);
  }

  return [];
}

function applyRotatingLocalEpisode(previousSignature) {
  if (LOCAL_QUESTION_BANK.length < TOTAL_DISCOVERIES) {
    throw new Error("O banco local não contém perguntas suficientes.");
  }

  const history = readSoloHistory();
  const historySet = new Set(history.map(normalize));
  const previousPrompts = new Set(
    currentPlayableQuestions().map((item) => normalize(item.prompt))
  );

  let pool = LOCAL_QUESTION_BANK.filter((item) => {
    const key = normalize(item.prompt);
    return !historySet.has(key) && !previousPrompts.has(key);
  });

  // Quando o histórico completar uma volta pelo banco, inicia outro ciclo,
  // mas continua excluindo toda a partida imediatamente anterior.
  if (pool.length < TOTAL_DISCOVERIES) {
    pool = LOCAL_QUESTION_BANK.filter(
      (item) => !previousPrompts.has(normalize(item.prompt))
    );
  }

  let selected = shuffle(pool).slice(0, TOTAL_DISCOVERIES).map(copyQuestion);

  if (
    selected.length < TOTAL_DISCOVERIES ||
    (previousSignature && episodeSignature(selected) === previousSignature)
  ) {
    selected = shuffle(LOCAL_QUESTION_BANK)
      .filter((item) => !previousPrompts.has(normalize(item.prompt)))
      .slice(0, TOTAL_DISCOVERIES)
      .map(copyQuestion);
  }

  if (selected.length !== TOTAL_DISCOVERIES) {
    throw new Error("Não foi possível separar 16 perguntas locais diferentes.");
  }

  QUESTIONS.splice(0, QUESTIONS.length, ...selected);

  const episode = buildLocalEpisode(selected);
  localStorage.setItem(EPISODE_STORAGE_KEY, JSON.stringify(episode));
  window.BURRQUIZZZ_EPISODE = episode;
  document.documentElement.dataset.questionSource = "local-rotating";
  document.documentElement.dataset.episodeDelivery = "rotating-local-fallback";
  window.dispatchEvent(new CustomEvent("burrquizzz:episode-ready", { detail: episode }));

  return selected;
}

function buildLocalEpisode(discoveries) {
  const definitions = [
    {
      id: "rebobina",
      title: "📼 Rebobina!",
      intro: "Memórias desbloqueadas. Não nos responsabilizamos pelo que aparecer."
    },
    {
      id: "volume",
      title: "🎸 Aumenta o volume",
      intro: "Histórias pop que merecem ser ouvidas — ou questionadas."
    },
    {
      id: "bizarro",
      title: "👽 Mundo Bizarro",
      intro: "A realidade perdeu qualquer compromisso com o bom senso."
    },
    {
      id: "final",
      title: "⭐ Grande Final",
      intro: "Quatro últimas descobertas para encerrar o caos."
    }
  ];

  return {
    id: `local-${crypto.randomUUID()}`,
    title: "Uma rodada que você ainda não jogou",
    subtitle: "Dezesseis descobertas escolhidas sem repetir a partida anterior",
    host: "Nico",
    intro: "O arquivo foi revirado para trazer outro conjunto de descobertas.",
    outro: "Mais dezesseis informações de utilidade rigorosamente questionável.",
    blocks: definitions.map((block, index) => ({
      ...block,
      startIndex: index * 4,
      endIndex: index * 4 + 3,
      discoveries: discoveries
        .slice(index * 4, index * 4 + 4)
        .map((item) => item.id)
    })),
    discoveries
  };
}

function rememberEpisode(items) {
  const signature = episodeSignature(items);
  if (signature) localStorage.setItem(LAST_SIGNATURE_KEY, signature);

  const combined = [
    ...readSoloHistory(),
    ...items.map((item) => String(item.prompt || "").trim()).filter(Boolean)
  ];

  const unique = [];
  const seen = new Set();
  combined.forEach((prompt) => {
    const key = normalize(prompt);
    if (!key || seen.has(key)) return;
    seen.add(key);
    unique.push(prompt);
  });

  localStorage.setItem(
    SOLO_HISTORY_KEY,
    JSON.stringify(unique.slice(-MAX_HISTORY))
  );
}

function readSoloHistory() {
  try {
    const stored = JSON.parse(localStorage.getItem(SOLO_HISTORY_KEY) || "[]");
    return Array.isArray(stored)
      ? stored.filter((item) => typeof item === "string")
      : [];
  } catch {
    localStorage.removeItem(SOLO_HISTORY_KEY);
    return [];
  }
}

function currentPlayableQuestions() {
  return QUESTIONS
    .filter(isSupportedQuestion)
    .slice(0, TOTAL_DISCOVERIES)
    .map(copyQuestion);
}

function isSupportedQuestion(item) {
  return Boolean(
    item &&
    typeof item.prompt === "string" &&
    Array.isArray(item.options) &&
    item.options.length === 4 &&
    Number.isInteger(item.correctIndex) &&
    item.correctIndex >= 0 &&
    item.correctIndex <= 3
  );
}

function copyQuestion(item) {
  return {
    ...item,
    id: item.id || `local-${crypto.randomUUID()}`,
    type: item.type === "image_choice" ? "image_choice" : "multiple_choice",
    category: String(item.category || "Burrquizzz"),
    prompt: String(item.prompt || "").trim(),
    options: Array.isArray(item.options) ? item.options.map(String) : [],
    explanation: String(item.explanation || "")
  };
}

function episodeSignature(items) {
  return items
    .map((item) => normalize(item?.prompt))
    .filter(Boolean)
    .join("||");
}

function shuffle(items) {
  const result = items.map(copyQuestion);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
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

function showToast(message) {
  const toast = document.querySelector("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("visible"), 3200);
}
