import { QUESTIONS } from "./questions.js";
import { LEGENDARY_QUESTIONS } from "./legendary-questions-v071.js";

const USED_KEY = "burrquizzzLegendaryUsedV071";
const CURRENT_KEYS = ["burrquizzzCurrentEpisodeV5", "burrquizzzCurrentEpisode"];
const MAX_USED = LEGENDARY_QUESTIONS.length;

boot();

function boot() {
  document.documentElement.dataset.legendaryPoolSize = String(LEGENDARY_QUESTIONS.length);
  syncUniverseCount();

  upgradeLegendary(window.BURRQUIZZZ_EPISODE);

  window.addEventListener("burrquizzz:rarities-ready", (event) => {
    upgradeLegendary(event.detail);
  });
}

function upgradeLegendary(episode) {
  if (!episode || !Array.isArray(episode.discoveries)) return;

  const legendaryIndex = episode.discoveries.findIndex(
    (question) => question?.rarity === "legendary"
  );

  if (legendaryIndex < 0) return;

  const current = episode.discoveries[legendaryIndex];
  if (current?.legendaryExclusive) {
    syncQuestionBank(episode, legendaryIndex, current);
    return;
  }

  const replacement = pickLegendary(episode.id || "episode");
  if (!replacement) return;

  const injected = {
    ...cloneQuestion(replacement),
    rarity: "legendary",
    legendaryExclusive: true,
    replacedQuestionId: String(current?.id || ""),
    replacedQuestionPrompt: String(current?.prompt || "")
  };

  episode.discoveries[legendaryIndex] = injected;
  replaceInBlocks(episode, current, injected);
  syncQuestionBank(episode, legendaryIndex, injected, current);
  persistEpisode(episode);

  document.documentElement.dataset.legendaryExclusiveActive = "true";
  document.documentElement.dataset.legendaryQuestionId = injected.id;

  window.BURRQUIZZZ_EPISODE = episode;
  window.dispatchEvent(
    new CustomEvent("burrquizzz:legendary-exclusive-ready", {
      detail: { episode, question: injected }
    })
  );
}

function pickLegendary(episodeId) {
  const used = readUsed();
  const usedSet = new Set(used);
  let candidates = LEGENDARY_QUESTIONS.filter((question) => !usedSet.has(question.id));

  if (!candidates.length) {
    candidates = [...LEGENDARY_QUESTIONS];
    used.length = 0;
  }

  const seed = hash(`${episodeId}|${Date.now()}|${used.length}`);
  const selected = candidates[seed % candidates.length];
  if (!selected) return null;

  used.push(selected.id);
  localStorage.setItem(USED_KEY, JSON.stringify(used.slice(-MAX_USED)));
  return selected;
}

function syncQuestionBank(episode, index, replacement, previous = null) {
  let targetIndex = -1;

  if (previous?.id) {
    targetIndex = QUESTIONS.findIndex((question) => question?.id === previous.id);
  }

  if (targetIndex < 0 && previous?.prompt) {
    const prompt = normalize(previous.prompt);
    targetIndex = QUESTIONS.findIndex((question) => normalize(question?.prompt) === prompt);
  }

  if (targetIndex < 0 && QUESTIONS.length === episode.discoveries.length) {
    targetIndex = index;
  }

  if (targetIndex < 0) return;
  QUESTIONS.splice(targetIndex, 1, cloneQuestion(replacement));
}

function replaceInBlocks(episode, previous, replacement) {
  if (!Array.isArray(episode.blocks)) return;

  const previousId = String(previous?.id || "");
  const previousPrompt = normalize(previous?.prompt);

  for (const block of episode.blocks) {
    if (!Array.isArray(block?.discoveries)) continue;

    const index = block.discoveries.findIndex((question) => {
      if (previousId && String(question?.id || "") === previousId) return true;
      return previousPrompt && normalize(question?.prompt) === previousPrompt;
    });

    if (index >= 0) block.discoveries[index] = cloneQuestion(replacement);
  }
}

function persistEpisode(episode) {
  for (const key of CURRENT_KEYS) {
    try {
      localStorage.setItem(key, JSON.stringify(episode));
    } catch {
      // A rodada em memória continua válida mesmo se o armazenamento falhar.
    }
  }
}

function readUsed() {
  try {
    const value = JSON.parse(localStorage.getItem(USED_KEY) || "[]");
    return Array.isArray(value)
      ? value.map(String).filter((id) => LEGENDARY_QUESTIONS.some((q) => q.id === id))
      : [];
  } catch {
    return [];
  }
}

function syncUniverseCount() {
  const normalCount = Number(document.documentElement.dataset.offlineQuestionCount || 0);
  if (normalCount > 0) {
    document.documentElement.dataset.questionUniverseSize = String(
      normalCount + LEGENDARY_QUESTIONS.length
    );
  }
}

function cloneQuestion(question) {
  return {
    ...question,
    options: Array.isArray(question?.options) ? [...question.options] : []
  };
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hash(value) {
  let result = 2166136261;
  for (const character of String(value)) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}
