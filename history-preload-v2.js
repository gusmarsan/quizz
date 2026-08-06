const TARGET_KEY = "burrquizzzPlayedQuestionsV3";
const SOURCES = ["burrquizzzPlayedQuestionsV2", "burrquizzzQuestionArchive"];

try {
  const current = read(TARGET_KEY);
  if (!current.length) {
    const collected = [];
    const seen = new Set();

    for (const key of SOURCES) {
      for (const item of read(key)) {
        const prompt = String(item?.prompt || item?.question || "").trim();
        const answer = String(item?.answer || item?.correctAnswer || "").trim();
        if (!prompt) continue;
        const normalized = normalize(`${prompt} ${answer}`);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        collected.push({
          prompt,
          answer,
          category: String(item?.category || ""),
          fingerprint: `legacy::${hash(normalized)}`,
          playedAt: Number(item?.playedAt || 0)
        });
      }
    }

    if (collected.length) {
      localStorage.setItem(TARGET_KEY, JSON.stringify(collected.slice(-3000)));
    }
  }
} catch (error) {
  console.warn("O histórico antigo não pôde ser preparado.", error);
}

function read(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hash(value) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}
