import { QUESTIONS } from "./questions.js";

// Compatibilidade com versões anteriores. A preparação e a rotação dos
// episódios agora ficam a cargo de episode-engine.js, sempre em segundo plano.
window.BURRQUIZZZ_EPISODES = {
  ensureFresh: async () => window.BURRQUIZZZ_EPISODE || {
    discoveries: QUESTIONS.slice(0, 16)
  },
  signature: (items = QUESTIONS) => {
    const discoveries = Array.isArray(items?.discoveries) ? items.discoveries : items;
    if (!Array.isArray(discoveries)) return "";
    return discoveries
      .map((item) => normalize(item?.prompt))
      .filter(Boolean)
      .join("||");
  }
};

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
