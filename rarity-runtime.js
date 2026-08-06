import { QUESTIONS } from "./questions.js";

const EPISODE_STORAGE_KEY = "burrquizzzCurrentEpisode";
const RARITY_VALUES = new Set(["common", "rare", "legendary"]);

let lastLegendaryPrompt = "";

applyCurrentEpisodeRarities();
installRarityPresentation();
window.addEventListener("burrquizzz:episode-ready", (event) => {
  applyEpisodeRarities(event.detail);
});

function applyCurrentEpisodeRarities() {
  const episode = window.BURRQUIZZZ_EPISODE || readEpisode();
  if (episode?.discoveries?.length) {
    applyEpisodeRarities(episode);
    return;
  }

  const temporaryEpisode = {
    id: "startup-local",
    discoveries: QUESTIONS
  };
  assignRarities(temporaryEpisode);
}

function applyEpisodeRarities(episode) {
  if (!episode || !Array.isArray(episode.discoveries)) return;

  assignRarities(episode);
  syncQuestionBank(episode.discoveries);

  const rareCount = episode.discoveries.filter((item) => item.rarity === "rare").length;
  const legendaryCount = episode.discoveries.filter((item) => item.rarity === "legendary").length;
  episode.raritySummary = { rareCount, legendaryCount };

  localStorage.setItem(EPISODE_STORAGE_KEY, JSON.stringify(episode));
  window.BURRQUIZZZ_EPISODE = episode;
  document.documentElement.dataset.rareDiscoveries = String(rareCount);
  document.documentElement.dataset.legendaryDiscoveries = String(legendaryCount);
  window.dispatchEvent(new CustomEvent("burrquizzz:rarities-ready", { detail: episode }));
  syncVisibleRarity();
}

function assignRarities(episode) {
  const discoveries = episode.discoveries;
  if (!Array.isArray(discoveries) || discoveries.length < 4) return;

  discoveries.forEach((item) => {
    item.rarity = "common";
  });

  const seedText = `${episode.id || "episode"}|${discoveries.map((item) => item.prompt).join("|")}`;
  const seed = hash(seedText);
  const candidates = discoveries
    .map((_, index) => index)
    .filter((index) => index >= 2 && index < discoveries.length - 1);
  const ordered = seededShuffle(candidates, seed);
  const hasLegendary = seed % 3 === 0 && ordered.length >= 3;

  let cursor = 0;
  if (hasLegendary) {
    discoveries[ordered[cursor]].rarity = "legendary";
    cursor += 1;
  }

  let rareCount = 0;
  while (cursor < ordered.length && rareCount < 2) {
    const index = ordered[cursor];
    cursor += 1;
    if (discoveries[index].rarity !== "common") continue;
    discoveries[index].rarity = "rare";
    rareCount += 1;
  }
}

function syncQuestionBank(discoveries) {
  const byId = new Map(discoveries.map((item) => [item.id, item]));
  const byPrompt = new Map(discoveries.map((item) => [normalize(item.prompt), item]));

  QUESTIONS.forEach((question) => {
    const source = byId.get(question.id) || byPrompt.get(normalize(question.prompt));
    question.rarity = RARITY_VALUES.has(source?.rarity) ? source.rarity : "common";
  });
}

function installRarityPresentation() {
  const boot = () => {
    const questionText = document.querySelector("#questionText");
    if (!questionText) return;

    new MutationObserver(syncVisibleRarity).observe(questionText, {
      childList: true,
      characterData: true,
      subtree: true
    });

    syncVisibleRarity();
    injectStyles();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
}

function syncVisibleRarity() {
  const prompt = document.querySelector("#questionText")?.textContent?.trim() || "";
  const question = findQuestion(prompt);
  const card = document.querySelector("#screen-game .question-card");
  const meta = document.querySelector("#screen-game .question-meta");
  if (!card || !meta) return;

  let badge = document.querySelector("#burrRarityBadge");
  if (!badge) {
    badge = document.createElement("span");
    badge.id = "burrRarityBadge";
    meta.appendChild(badge);
  }

  const rarity = RARITY_VALUES.has(question?.rarity) ? question.rarity : "common";
  card.classList.toggle("burr-question-rare", rarity === "rare");
  card.classList.toggle("burr-question-legendary", rarity === "legendary");

  if (rarity === "common") {
    badge.hidden = true;
    badge.className = "burr-rarity-badge";
    return;
  }

  badge.hidden = false;
  badge.className = `burr-rarity-badge ${rarity}`;
  badge.textContent = rarity === "legendary" ? "✦ Lendária" : "◆ Rara";

  if (rarity === "legendary" && normalize(prompt) !== lastLegendaryPrompt) {
    lastLegendaryPrompt = normalize(prompt);
    card.classList.remove("burr-legendary-arrival");
    requestAnimationFrame(() => card.classList.add("burr-legendary-arrival"));
    window.setTimeout(() => card.classList.remove("burr-legendary-arrival"), 1000);
  }
}

function findQuestion(prompt) {
  const key = normalize(prompt);
  if (!key) return null;
  const episode = window.BURRQUIZZZ_EPISODE || readEpisode();
  return episode?.discoveries?.find((item) => normalize(item.prompt) === key)
    || QUESTIONS.find((item) => normalize(item.prompt) === key)
    || null;
}

function readEpisode() {
  try {
    return JSON.parse(localStorage.getItem(EPISODE_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function seededShuffle(items, seed) {
  const result = [...items];
  let state = seed || 1;
  for (let index = result.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const swapIndex = state % (index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function hash(value) {
  let result = 2166136261;
  for (const character of String(value)) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function injectStyles() {
  if (document.querySelector("#burrRarityStyles")) return;
  const style = document.createElement("style");
  style.id = "burrRarityStyles";
  style.textContent = `
    .burr-rarity-badge { margin-left:auto; padding:6px 9px; border-radius:999px; font-size:.67rem; font-weight:900; letter-spacing:.04em; white-space:nowrap; }
    .burr-rarity-badge.rare { background:#e8ddff; color:#58259b; }
    .burr-rarity-badge.legendary { background:linear-gradient(135deg,#ffe269,#ff9f43); color:#3d2400; box-shadow:0 0 0 3px rgba(255,190,64,.17); }
    .question-card.burr-question-rare { box-shadow:0 18px 50px rgba(91,45,150,.13); }
    .question-card.burr-question-legendary { outline:3px solid #ffc53d; box-shadow:0 22px 65px rgba(255,166,31,.25); }
    .question-card.burr-legendary-arrival { animation:burrLegendaryArrival .9s ease both; }
    @keyframes burrLegendaryArrival {
      0% { transform:scale(.97); filter:brightness(.85); }
      55% { transform:scale(1.018); filter:brightness(1.12); }
      100% { transform:none; filter:none; }
    }
  `;
  document.head.appendChild(style);
}
