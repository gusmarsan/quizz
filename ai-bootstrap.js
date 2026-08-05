import { QUESTIONS } from "./questions.js";

const AI_ENDPOINT = "https://quiz-duelo-ai.gustavomarsan.workers.dev/";
const RECENT_STORAGE_KEY = "quizDuelRecentAIQuestions";
const AI_QUESTION_COUNT = 20;
const MAX_RECENT_QUESTIONS = 40;

const startButton = document.querySelector("#startSoloButton");
const originalButtonText = startButton?.textContent || "Começar";

prepareAIQuestions();

async function prepareAIQuestions() {
  setLoadingState(true);

  try {
    const recentQuestions = getRecentQuestions();
    const response = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        count: AI_QUESTION_COUNT,
        recentQuestions
      })
    });

    if (!response.ok) {
      throw new Error(`O gerador respondeu com status ${response.status}.`);
    }

    const data = await response.json();
    const generatedQuestions = validateQuestions(data?.questions);

    if (generatedQuestions.length < AI_QUESTION_COUNT) {
      throw new Error("O gerador não devolveu perguntas suficientes.");
    }

    QUESTIONS.splice(0, QUESTIONS.length, ...generatedQuestions);
    saveRecentQuestions(generatedQuestions.map((question) => question.prompt));
    document.documentElement.dataset.questionSource = "ai";
  } catch (error) {
    console.warn("Não foi possível carregar perguntas da IA. O banco local será usado.", error);
    document.documentElement.dataset.questionSource = "local";
  } finally {
    setLoadingState(false);
  }
}

function validateQuestions(items) {
  if (!Array.isArray(items)) return [];

  return items
    .filter((item) => {
      return Boolean(
        item &&
        typeof item.prompt === "string" &&
        typeof item.category === "string" &&
        Array.isArray(item.options) &&
        item.options.length === 4 &&
        Number.isInteger(item.correctIndex) &&
        item.correctIndex >= 0 &&
        item.correctIndex <= 3
      );
    })
    .map((item, index) => ({
      id: item.id || `ai-${Date.now()}-${index}`,
      type: "multiple_choice",
      category: item.category.trim() || "Curiosidades",
      prompt: item.prompt.trim(),
      options: item.options.map((option) => String(option).trim()),
      correctIndex: item.correctIndex,
      explanation: typeof item.explanation === "string" ? item.explanation.trim() : "",
      tone: "estranho_pop"
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
  localStorage.setItem(
    RECENT_STORAGE_KEY,
    JSON.stringify(unique.slice(-MAX_RECENT_QUESTIONS))
  );
}

function setLoadingState(isLoading) {
  if (!startButton) return;

  startButton.disabled = isLoading;
  startButton.textContent = isLoading
    ? "Criando perguntas absurdamente importantes..."
    : originalButtonText;
}
