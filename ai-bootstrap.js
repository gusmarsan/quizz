import "./episode-intro.js";
import "./episode-sync.js";
import { QUESTIONS } from "./questions.js";

const AI_ENDPOINT = "https://quiz-duelo-ai.gustavomarsan.workers.dev/";
const RECENT_STORAGE_KEY = "quizDuelRecentAIQuestions";
const EPISODE_STORAGE_KEY = "burrquizzzCurrentEpisode";
const AI_QUESTION_COUNT = 20;
const MAX_RECENT_QUESTIONS = 50;

const startButton = document.querySelector("#startSoloButton");
const originalButtonText = startButton?.textContent || "Começar";

prepareAIQuestions();

async function prepareAIQuestions() {
  setLoadingState(true);

  try {
    const recentQuestions = getRecentQuestions();
    const response = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: AI_QUESTION_COUNT, recentQuestions })
    });

    if (!response.ok) throw new Error(`O gerador respondeu com status ${response.status}.`);

    const data = await response.json();
    const episode = normalizeEpisode(data);
    const generatedQuestions = validateQuestions(episode.discoveries);

    if (generatedQuestions.length < AI_QUESTION_COUNT) {
      throw new Error("O gerador não devolveu descobertas suficientes.");
    }

    const normalizedEpisode = { ...episode, discoveries: generatedQuestions };
    QUESTIONS.splice(0, QUESTIONS.length, ...generatedQuestions);
    saveRecentQuestions(generatedQuestions.map((question) => question.prompt));
    saveEpisode(normalizedEpisode);
    document.documentElement.dataset.questionSource = "ai";
    window.dispatchEvent(new CustomEvent("burrquizzz:episode-ready", { detail: normalizedEpisode }));
  } catch (error) {
    console.warn("Não foi possível carregar o episódio da IA. O banco local será usado.", error);
    localStorage.removeItem(EPISODE_STORAGE_KEY);
    document.documentElement.dataset.questionSource = "local";
  } finally {
    setLoadingState(false);
  }
}

function normalizeEpisode(data) {
  if (data?.episode && Array.isArray(data.episode.discoveries)) {
    return {
      id: data.episode.id || `episode-${crypto.randomUUID()}`,
      title: String(data.episode.title || "O mundo é mais estranho do que parece").trim(),
      subtitle: String(data.episode.subtitle || "Conhecimento de utilidade rigorosamente duvidosa").trim(),
      host: String(data.episode.host || "Nico").trim(),
      intro: String(data.episode.intro || "Prepare-se para descobrir coisas que você não precisava saber — até agora.").trim(),
      outro: String(data.episode.outro || "Agora você sabe mais coisas inúteis do que alguns minutos atrás.").trim(),
      discoveries: data.episode.discoveries
    };
  }

  return {
    id: `episode-${crypto.randomUUID()}`,
    title: "Cultura inútil de altíssimo nível",
    subtitle: "Uma seleção de fatos estranhos, pop e surpreendentes",
    host: "Nico",
    intro: "Hoje tem cultura pop, histórias improváveis e conhecimento de utilidade rigorosamente duvidosa.",
    outro: "Agora você sabe mais coisas inúteis do que alguns minutos atrás.",
    discoveries: Array.isArray(data?.questions) ? data.questions : []
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
    .map((item, index) => ({
      id: item.id || `ai-${Date.now()}-${index}`,
      type: "multiple_choice",
      category: item.category.trim() || "Mundo Bizarro",
      difficulty: ["facil", "media", "dificil"].includes(item.difficulty) ? item.difficulty : "media",
      prompt: item.prompt.trim(),
      options: item.options.map((option) => String(option).trim()),
      correctIndex: item.correctIndex,
      explanation: typeof item.explanation === "string" ? item.explanation.trim() : "",
      tone: "burrquizzz"
    }));
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
    ? "Criando descobertas absurdamente importantes..."
    : originalButtonText;
}
