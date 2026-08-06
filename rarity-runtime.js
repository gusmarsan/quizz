import { QUESTIONS } from "./questions.js";

const EPISODE_STORAGE_KEY = "burrquizzzCurrentEpisode";
const RARITY_VALUES = new Set(["common", "rare", "legendary"]);

let lastLegendaryPrompt = "";
let currentQuestion = null;
const raritySession = {
  episodeId: "",
  seen: new Set(),
  answered: new Set(),
  rareTotal: 0,
  rareCorrect: 0,
  legendaryTotal: 0,
  legendaryCorrect: 0
};

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
  syncQuestionBank(temporaryEpisode.discoveries);
}

function applyEpisodeRarities(episode) {
  if (!episode || !Array.isArray(episode.discoveries)) return;

  assignRarities(episode);
  syncQuestionBank(episode.discoveries);

  const rareCount = episode.discoveries.filter((item) => item.rarity === "rare").length;
  const legendaryCount = episode.discoveries.filter((item) => item.rarity === "legendary").length;
  episode.raritySummary = { rareCount, legendaryCount };

  if (raritySession.episodeId !== episode.id) resetRaritySession(episode.id);

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
    const feedback = document.querySelector("#feedbackBanner");
    const results = document.querySelector("#screen-results");
    if (!questionText) return;

    new MutationObserver(syncVisibleRarity).observe(questionText, {
      childList: true,
      characterData: true,
      subtree: true
    });

    if (feedback) {
      new MutationObserver(recordVisibleAnswer).observe(feedback, {
        attributes: true,
        attributeFilter: ["class"],
        childList: true,
        characterData: true,
        subtree: true
      });
    }

    if (results) {
      new MutationObserver(() => {
        if (results.classList.contains("active")) renderRarityResult();
      }).observe(results, { attributes: true, attributeFilter: ["class"] });
    }

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

  currentQuestion = question;
  registerVisibleQuestion(question);

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

function registerVisibleQuestion(question) {
  if (!question || !["rare", "legendary"].includes(question.rarity)) return;
  const key = questionKey(question);
  if (!key || raritySession.seen.has(key)) return;

  raritySession.seen.add(key);
  if (question.rarity === "rare") raritySession.rareTotal += 1;
  if (question.rarity === "legendary") raritySession.legendaryTotal += 1;
}

function recordVisibleAnswer() {
  if (!currentQuestion || !["rare", "legendary"].includes(currentQuestion.rarity)) return;
  const feedback = document.querySelector("#feedbackBanner");
  if (!feedback) return;

  const hasVerdict = feedback.classList.contains("good") || feedback.classList.contains("bad");
  if (!hasVerdict) return;

  const key = questionKey(currentQuestion);
  if (!key || raritySession.answered.has(key)) return;
  raritySession.answered.add(key);

  if (!feedback.classList.contains("good")) return;
  if (currentQuestion.rarity === "rare") raritySession.rareCorrect += 1;
  if (currentQuestion.rarity === "legendary") raritySession.legendaryCorrect += 1;
}

function renderRarityResult() {
  const resultsPanel = document.querySelector("#screen-results .results-panel");
  const playAgain = document.querySelector("#playAgainButton");
  if (!resultsPanel || !playAgain) return;

  let card = document.querySelector("#burrRarityResult");
  if (!card) {
    card = document.createElement("div");
    card.id = "burrRarityResult";
    card.className = "burr-rarity-result";
    playAgain.insertAdjacentElement("beforebegin", card);
  }

  const parts = [];
  if (raritySession.rareTotal) {
    parts.push(`◆ Raras: ${raritySession.rareCorrect}/${raritySession.rareTotal}`);
  }
  if (raritySession.legendaryTotal) {
    parts.push(raritySession.legendaryCorrect
      ? "✦ Você acertou a lendária"
      : "✦ A lendária escapou desta vez");
  }

  card.hidden = !parts.length;
  card.innerHTML = parts.map((text) => `<span>${escapeHtml(text)}</span>`).join("");
}

function resetRaritySession(episodeId) {
  raritySession.episodeId = episodeId || "";
  raritySession.seen.clear();
  raritySession.answered.clear();
  raritySession.rareTotal = 0;
  raritySession.rareCorrect = 0;
  raritySession.legendaryTotal = 0;
  raritySession.legendaryCorrect = 0;
  currentQuestion = null;
  lastLegendaryPrompt = "";
}

function findQuestion(prompt) {
  const key = normalize(prompt);
  if (!key) return null;
  const episode = window.BURRQUIZZZ_EPISODE || readEpisode();
  return episode?.discoveries?.find((item) => normalize(item.prompt) === key)
    || QUESTIONS.find((item) => normalize(item.prompt) === key)
    || null;
}

function questionKey(question) {
  return `${normalize(question?.prompt)}|${normalize(question?.options?.[question?.correctIndex])}`;
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
    .burr-rarity-result { display:flex; flex-wrap:wrap; justify-content:center; gap:8px; margin:14px 0 18px; }
    .burr-rarity-result[hidden] { display:none; }
    .burr-rarity-result span { padding:8px 11px; border-radius:999px; background:#f1eaff; color:#55248f; font-size:.72rem; font-weight:850; }
    .burr-rarity-result span:last-child:not(:first-child) { background:#fff1c6; color:#674000; }
    @keyframes burrLegendaryArrival {
      0% { transform:scale(.97); filter:brightness(.85); }
      55% { transform:scale(1.018); filter:brightness(1.12); }
      100% { transform:none; filter:none; }
    }
  `;
  document.head.appendChild(style);
}
