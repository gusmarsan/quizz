import batch001025 from "./visual/visual-001-025.js";
import batch026050 from "./visual/visual-026-050.js";
import batch051075 from "./visual/visual-051-075.js";
import batch076100 from "./visual/visual-076-100.js";

export const VISUAL_QUESTIONS = [
  ...batch001025,
  ...batch026050,
  ...batch051075,
  ...batch076100
];

// As páginas, licenças e créditos originais continuam nos metadados da pergunta.
// A imagem exibida no jogo é a cópia WebP padronizada e versionada no próprio projeto.
VISUAL_QUESTIONS.forEach((question) => {
  question.remoteImage = question.image;
  question.image = `./assets/visual-quiz/${question.id}.webp`;
});

const ids = new Set(VISUAL_QUESTIONS.map((question) => question.id));
const prompts = new Set(VISUAL_QUESTIONS.map((question) => question.prompt.trim().toLowerCase()));
const images = new Set(VISUAL_QUESTIONS.map((question) => question.imageFile));

if (VISUAL_QUESTIONS.length !== 100) {
  throw new Error(`Banco visual incompleto: ${VISUAL_QUESTIONS.length}/100.`);
}

if (ids.size !== 100 || prompts.size !== 100 || images.size !== 100) {
  throw new Error("Banco visual contém ID, enunciado ou imagem duplicada.");
}

export default VISUAL_QUESTIONS;
