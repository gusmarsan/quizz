// Burrquizzz v1.82 — banco curado e expandido.
// Mantém os 1.000 itens-base e 100 visuais como fonte, adiciona os lotes editoriais
// e aplica a curadoria antes de expor o banco ao jogo.

import batch01 from "./question-bank/batch-01.js?v=2.4.0";
import batch02 from "./question-bank/batch-02.js?v=2.4.0";
import batch03 from "./question-bank/batch-03.js?v=2.4.0";
import batch04 from "./question-bank/batch-04.js?v=2.4.0";
import batch05 from "./question-bank/batch-05.js?v=2.4.0";
import batch06 from "./question-bank/batch-06.js?v=2.4.0";
import batch07 from "./question-bank/batch-07.js?v=2.4.0";
import batch08 from "./question-bank/batch-08.js?v=2.4.0";
import batch09 from "./question-bank/batch-09.js?v=2.4.0";
import batch10 from "./question-bank/batch-10.js?v=2.4.0";
import batch11 from "./question-bank/batch-11.js?v=2.4.0";
import batch12 from "./question-bank/batch-12.js?v=2.4.0";
import batch13 from "./question-bank/batch-13.js?v=2.4.0";
import batch14 from "./question-bank/batch-14.js?v=2.4.0";
import batch15 from "./question-bank/batch-15.js?v=2.4.0";
import batch16 from "./question-bank/batch-16.js?v=2.4.0";
import batch17a from "./question-bank/batch-17a.js?v=2.4.0";
import batch17b from "./question-bank/batch-17b.js?v=2.4.0";
import batch18a from "./question-bank/batch-18a.js?v=2.4.0";
import batch18b from "./question-bank/batch-18b.js?v=2.4.0";
import batch19 from "./question-bank/batch-19.js?v=2.4.0";
import batch20 from "./question-bank/batch-20.js?v=2.4.0";
import v181Questions from "./question-bank/batch-v181.js?v=1.81";
import v182DadoDolabellaQuestions from "./question-bank/batch-v182-dado-dolabella.js?v=1.82";
import visualQuestions from "./question-bank/visual-batch.js?v=2.5.1";

const BASE_QUESTIONS = [
  ...batch01,
  ...batch02,
  ...batch03,
  ...batch04,
  ...batch05,
  ...batch06,
  ...batch07,
  ...batch08,
  ...batch09,
  ...batch10,
  ...batch11,
  ...batch12,
  ...batch13,
  ...batch14,
  ...batch15,
  ...batch16,
  ...batch17a,
  ...batch17b,
  ...batch18a,
  ...batch18b,
  ...batch19,
  ...batch20
];

const stripAccents = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase();

function isComicQuestion(question) {
  const category = stripAccents(question?.category);
  return category.includes("hq") || category.includes("quadrinh");
}

function isCuriousComicQuestion(question) {
  if (!isComicQuestion(question)) return true;
  if (String(question?.id || "").startsWith("v181-")) return true;

  const prompt = stripAccents(question?.prompt);
  return /poder|habilidade|fraqueza|estranh|inusitad|bizar|absurd|curios|improvavel|ridicul|peculiar/.test(prompt);
}

function isGenericGameQuestion(question) {
  const category = stripAccents(question?.category);
  if (!category.includes("game") && !category.includes("videogame")) return true;

  const prompt = stripAccents(question?.prompt);
  return !/estudio|desenvolved|publisher|publicador|publicadora|empresa que criou|empresa responsavel|produzido por|produzida por/.test(prompt);
}

function capitalizeAnswerItem(value) {
  if (typeof value !== "string" || !value) return value;
  return value.replace(/^([^\p{L}]*)(\p{Ll})/u, (_, prefix, letter) => (
    `${prefix}${letter.toLocaleUpperCase("pt-BR")}`
  ));
}

function normalizeAnswerCapitalization(question) {
  const normalized = { ...question };

  if (Array.isArray(question?.options)) {
    normalized.options = question.options.map(capitalizeAnswerItem);
  }

  if (Array.isArray(question?.rightItems)) {
    normalized.rightItems = question.rightItems.map(capitalizeAnswerItem);
  }

  if (Array.isArray(question?.matches)) {
    normalized.matches = question.matches.map(capitalizeAnswerItem);
  }

  return normalized;
}

function distributeV181CorrectAnswer(question) {
  const id = String(question?.id || "");
  if (
    !id.startsWith("v181-") ||
    question?.type !== "multiple_choice" ||
    !Array.isArray(question?.options) ||
    question.options.length !== 4
  ) {
    return question;
  }

  const currentCorrectIndex = Number(question.correctIndex);
  if (!Number.isInteger(currentCorrectIndex) || currentCorrectIndex < 0 || currentCorrectIndex > 3) {
    return question;
  }

  const numericId = Number(id.split("-").at(-1));
  const targetIndex = Number.isFinite(numericId) ? Math.max(0, numericId - 1) % 4 : 0;
  if (targetIndex === currentCorrectIndex) return question;

  const correctAnswer = question.options[currentCorrectIndex];
  const distractors = question.options.filter((_, index) => index !== currentCorrectIndex);
  const options = [...distractors];
  options.splice(targetIndex, 0, correctAnswer);

  return {
    ...question,
    options,
    correctIndex: targetIndex
  };
}

function prepareQuestion(question) {
  return distributeV181CorrectAnswer(normalizeAnswerCapitalization(question));
}

function applyEditorialPolicy(question) {
  return isCuriousComicQuestion(question) && isGenericGameQuestion(question);
}

const BASE_WITHOUT_LEGACY_IMAGES = BASE_QUESTIONS.filter(
  (question) => question.type !== "image_choice"
);

const CURATED_BASE = BASE_WITHOUT_LEGACY_IMAGES
  .filter(applyEditorialPolicy)
  .map(prepareQuestion);

const CURATED_V181 = v181Questions
  .filter(applyEditorialPolicy)
  .map(prepareQuestion);

const CURATED_V182_DADO = v182DadoDolabellaQuestions
  .filter(applyEditorialPolicy)
  .map(prepareQuestion);

const CURATED_VISUALS = visualQuestions
  .filter(applyEditorialPolicy)
  .map(prepareQuestion);

export const QUESTIONS = [
  ...CURATED_BASE,
  ...CURATED_V181,
  ...CURATED_V182_DADO,
  ...CURATED_VISUALS
];

if (BASE_QUESTIONS.length !== 1000) {
  throw new Error(`Banco-base incompleto: ${BASE_QUESTIONS.length}/1000.`);
}

if (visualQuestions.length !== 100) {
  throw new Error(`Banco visual incompleto: ${visualQuestions.length}/100.`);
}

if (v181Questions.length !== 70) {
  throw new Error(`Lote v1.81 incompleto: ${v181Questions.length}/70.`);
}

if (v182DadoDolabellaQuestions.length !== 10) {
  throw new Error(`Lote Dado Dolabella incompleto: ${v182DadoDolabellaQuestions.length}/10.`);
}

const v181CategoryCounts = CURATED_V181.reduce((counts, question) => {
  counts[question.category] = (counts[question.category] || 0) + 1;
  return counts;
}, {});

[
  "Cinema B e trash",
  "Cinema cult",
  "Rock e synth pop dos anos 80",
  "Escolinha do Professor Raimundo",
  "Viva o Gordo",
  "Fórmulas do cotidiano",
  "HQs e curiosidades"
].forEach((category) => {
  if (v181CategoryCounts[category] !== 10) {
    throw new Error(`Lote v1.81 incompleto em ${category}: ${v181CategoryCounts[category] || 0}/10.`);
  }
});

const answerPositionCounts = CURATED_V181.reduce((counts, question) => {
  counts[question.correctIndex] = (counts[question.correctIndex] || 0) + 1;
  return counts;
}, [0, 0, 0, 0]);

if (Math.max(...answerPositionCounts) - Math.min(...answerPositionCounts) > 1) {
  throw new Error(`Distribuição de respostas v1.81 desequilibrada: ${answerPositionCounts.join("/")}.`);
}

const ids = QUESTIONS.map((question) => String(question?.id || ""));
if (new Set(ids).size !== ids.length) {
  throw new Error("O banco ativo contém IDs de perguntas duplicados.");
}

const displayedAnswerLists = QUESTIONS.flatMap((question) => [
  ...(Array.isArray(question.options) ? question.options : []),
  ...(Array.isArray(question.rightItems) ? question.rightItems : [])
]);

const lowerCaseAnswer = displayedAnswerLists.find((answer) => /^[^\p{L}]*\p{Ll}/u.test(String(answer)));
if (lowerCaseAnswer) {
  throw new Error(`Item de resposta começa com caixa-baixa: ${lowerCaseAnswer}`);
}

if (typeof window !== "undefined") {
  window.BURRQUIZZZ_VERSION = "1.82";
}

if (typeof document !== "undefined") {
  Promise.resolve().then(() => {
    const badge = document.querySelector("#burrAppVersion");
    if (!badge) return;
    badge.textContent = "v1.82";
    badge.title = "Burrquizzz versão 1.82";
    badge.setAttribute("aria-label", "Versão 1.82");
  });
}
