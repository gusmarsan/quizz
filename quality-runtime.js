import { QUESTIONS } from "./questions.js";

const AI_ENDPOINT_PART = "quiz-duelo-ai.gustavomarsan.workers.dev";
const EPISODE_STORAGE_KEY = "burrquizzzCurrentEpisode";
const NEXT_EPISODE_STORAGE_KEY = "burrquizzzNextEpisode";
const ARCHIVE_STORAGE_KEY = "burrquizzzQuestionArchive";
const REPORTS_STORAGE_KEY = "burrquizzzAnswerReports";
const MAX_ARCHIVE_ITEMS = 320;
const MAX_REPORTS = 100;
const MAX_GENERATION_ATTEMPTS = 2;

const nativeFetch = window.fetch.bind(window);
let reportButton = null;
let reportDialog = null;
let currentPrompt = "";

installFetchGuard();
installEpisodeArchive();
installReportInterface();

function installFetchGuard() {
  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url || "";
    const method = String(init?.method || (typeof input !== "string" ? input?.method : "GET") || "GET").toUpperCase();

    if (method !== "POST" || !url.includes(AI_ENDPOINT_PART)) {
      return nativeFetch(input, init);
    }

    const originalBody = parseBody(init?.body);
    const priorItems = buildPriorItems(originalBody.recentQuestions);
    let recentQuestions = priorItems.map(formatHistoryItem).slice(-MAX_ARCHIVE_ITEMS);
    let lastResponse = null;
    let lastText = "";

    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
      const response = await nativeFetch(input, {
        ...init,
        body: JSON.stringify({
          ...originalBody,
          recentQuestions
        })
      });

      lastResponse = response;
      lastText = await response.text();
      if (!response.ok) return rebuildResponse(response, lastText);

      const data = safeJson(lastText);
      const discoveries = extractDiscoveries(data);
      const duplicates = findNearDuplicates(discoveries, priorItems);

      if (!duplicates.length) {
        document.documentElement.dataset.repetitionGuard = attempt ? "retried" : "clear";
        return rebuildResponse(response, lastText);
      }

      document.documentElement.dataset.repetitionGuard = "blocked";
      recentQuestions = uniqueStrings([
        ...recentQuestions,
        ...discoveries.map((item) => formatHistoryItem(toHistoryItem(item)))
      ]).slice(-MAX_ARCHIVE_ITEMS);
    }

    console.warn("O episódio foi rejeitado por repetir descobertas recentes.");
    return new Response(JSON.stringify({
      ok: false,
      error: "O episódio repetiu descobertas recentes.",
      details: "A proteção antirrepetição rejeitou duas versões consecutivas."
    }), {
      status: 409,
      headers: responseHeaders(lastResponse)
    });
  };
}

function installEpisodeArchive() {
  window.addEventListener("burrquizzz:episode-ready", (event) => {
    const discoveries = Array.isArray(event.detail?.discoveries) ? event.detail.discoveries : [];
    const combined = [...readArchive(), ...discoveries.map(toHistoryItem)];
    writeArchive(dedupeHistory(combined).slice(-MAX_ARCHIVE_ITEMS));
    document.documentElement.dataset.questionArchiveSize = String(readArchive().length);
  });
}

function installReportInterface() {
  const boot = () => {
    const feedback = document.querySelector("#feedbackBanner");
    const questionText = document.querySelector("#questionText");
    if (!feedback || !questionText || document.querySelector("#burrReportAnswer")) return;

    reportButton = document.createElement("button");
    reportButton.id = "burrReportAnswer";
    reportButton.type = "button";
    reportButton.className = "burr-report-answer";
    reportButton.textContent = "Reportar resposta";
    feedback.insertAdjacentElement("afterend", reportButton);

    reportDialog = createReportDialog();
    reportButton.addEventListener("click", openReportDialog);

    const observer = new MutationObserver(() => syncCurrentQuestion());
    observer.observe(questionText, { childList: true, characterData: true, subtree: true });
    syncCurrentQuestion();
    injectStyles();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
}

function syncCurrentQuestion() {
  currentPrompt = document.querySelector("#questionText")?.textContent?.trim() || "";
  if (!reportButton) return;
  const reported = readReports().some((item) => normalize(item.prompt) === normalize(currentPrompt));
  reportButton.disabled = !currentPrompt || reported;
  reportButton.textContent = reported ? "Resposta reportada" : "Reportar resposta";
}

function openReportDialog() {
  const question = findCurrentQuestion();
  if (!question || !reportDialog) return;

  reportDialog.dataset.questionId = question.id || "";
  reportDialog.querySelector("#burrReportPrompt").textContent = question.prompt;
  reportDialog.querySelector("#burrReportCorrect").textContent = `Resposta indicada: ${question.options?.[question.correctIndex] || "não informada"}`;
  reportDialog.showModal();
}

function createReportDialog() {
  const dialog = document.createElement("dialog");
  dialog.id = "burrReportDialog";
  dialog.className = "burr-report-dialog";
  dialog.innerHTML = `
    <form method="dialog">
      <button class="burr-report-close" value="cancel" aria-label="Fechar">×</button>
      <p class="burr-report-kicker">AJUDE O CURADOR</p>
      <h2>O que está errado?</h2>
      <p id="burrReportPrompt" class="burr-report-prompt"></p>
      <p id="burrReportCorrect" class="burr-report-correct"></p>
      <div class="burr-report-reasons">
        <button type="button" data-report-reason="Resposta errada">Resposta errada</button>
        <button type="button" data-report-reason="Pergunta ambígua">Pergunta ambígua</button>
        <button type="button" data-report-reason="Explicação incorreta">Explicação incorreta</button>
        <button type="button" data-report-reason="Imagem incompatível">Imagem incompatível</button>
      </div>
    </form>
  `;

  dialog.querySelectorAll("[data-report-reason]").forEach((button) => {
    button.addEventListener("click", () => saveReport(button.dataset.reportReason));
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  document.body.appendChild(dialog);
  return dialog;
}

function saveReport(reason) {
  const question = findCurrentQuestion();
  if (!question) return;

  const episode = readEpisode();
  const reports = readReports();
  const report = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    reason,
    episodeId: episode?.id || "",
    episodeTitle: episode?.title || "",
    questionId: question.id || "",
    prompt: question.prompt,
    category: question.category || "",
    type: question.type || "multiple_choice",
    options: Array.isArray(question.options) ? question.options : [],
    correctIndex: Number.isInteger(question.correctIndex) ? question.correctIndex : null,
    correctAnswer: question.options?.[question.correctIndex] || "",
    explanation: question.explanation || "",
    mediaId: question.mediaId || "",
    image: question.image || ""
  };

  localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify([...reports, report].slice(-MAX_REPORTS)));
  writeArchive(dedupeHistory([...readArchive(), toHistoryItem(question)]).slice(-MAX_ARCHIVE_ITEMS));
  localStorage.removeItem(NEXT_EPISODE_STORAGE_KEY);
  document.documentElement.dataset.reportedAnswers = String(readReports().length);
  reportDialog?.close();
  syncCurrentQuestion();
  showToast("Resposta reportada e bloqueada nos próximos episódios");
}

function findCurrentQuestion() {
  const promptKey = normalize(currentPrompt);
  if (!promptKey) return null;

  const episode = readEpisode();
  const episodeQuestions = Array.isArray(episode?.discoveries) ? episode.discoveries : [];
  return episodeQuestions.find((item) => normalize(item.prompt) === promptKey)
    || QUESTIONS.find((item) => normalize(item.prompt) === promptKey)
    || null;
}

function buildPriorItems(requestRecent) {
  const requestItems = Array.isArray(requestRecent)
    ? requestRecent.map((prompt) => ({ prompt: String(prompt), answer: "", category: "" }))
    : [];
  const reportItems = readReports().map((item) => ({
    prompt: item.prompt,
    answer: item.correctAnswer || "",
    category: item.category || ""
  }));
  return dedupeHistory([...readArchive(), ...requestItems, ...reportItems]).slice(-MAX_ARCHIVE_ITEMS);
}

function extractDiscoveries(data) {
  if (Array.isArray(data?.episode?.discoveries)) return data.episode.discoveries;
  if (Array.isArray(data?.episode?.blocks)) {
    return data.episode.blocks.flatMap((block) => Array.isArray(block?.discoveries) ? block.discoveries : []);
  }
  return Array.isArray(data?.questions) ? data.questions : [];
}

function findNearDuplicates(discoveries, priorItems) {
  const matches = [];
  discoveries.forEach((item) => {
    const current = toHistoryItem(item);
    const duplicate = priorItems.find((prior) => isNearDuplicate(current, prior));
    if (duplicate) matches.push({ current: current.prompt, previous: duplicate.prompt });
  });
  return matches;
}

function isNearDuplicate(a, b) {
  const normalizedA = normalize(a.prompt);
  const normalizedB = normalize(b.prompt);
  if (!normalizedA || !normalizedB) return false;
  if (normalizedA === normalizedB) return true;

  const tokensA = significantTokens(a.prompt);
  const tokensB = significantTokens(b.prompt);
  const shared = [...tokensA].filter((token) => tokensB.has(token)).length;
  const overlap = shared / Math.max(1, Math.min(tokensA.size, tokensB.size));
  const sameAnswer = a.answer && b.answer && normalize(a.answer) === normalize(b.answer);

  return (shared >= 3 && overlap >= 0.72) || (sameAnswer && shared >= 2 && overlap >= 0.55);
}

function significantTokens(value) {
  const ignored = new Set([
    "qual", "quais", "quem", "como", "onde", "quando", "porque", "este", "esta", "esse", "essa",
    "destes", "destas", "abaixo", "sobre", "imagem", "objeto", "filme", "musica", "serie", "programa",
    "alternativa", "correta", "verdadeira", "seguinte", "nome", "ficou", "conhecido", "aparece"
  ]);
  return new Set(normalize(value).split(" ").filter((token) => token.length >= 4 && !ignored.has(token)));
}

function toHistoryItem(item) {
  const options = Array.isArray(item?.options) ? item.options : [];
  const correctIndex = Number(item?.correctIndex);
  return {
    prompt: String(item?.prompt || "").trim(),
    answer: Number.isInteger(correctIndex) ? String(options[correctIndex] || "").trim() : String(item?.answer || "").trim(),
    category: String(item?.category || "").trim()
  };
}

function formatHistoryItem(item) {
  const parts = [`Pergunta: ${item.prompt}`];
  if (item.answer) parts.push(`Resposta: ${item.answer}`);
  if (item.category) parts.push(`Tema: ${item.category}`);
  return parts.join(" | ");
}

function dedupeHistory(items) {
  const seen = new Set();
  const result = [];
  items.forEach((item) => {
    const clean = toHistoryItem(item);
    const key = `${normalize(clean.prompt)}|${normalize(clean.answer)}`;
    if (!clean.prompt || seen.has(key)) return;
    seen.add(key);
    result.push(clean);
  });
  return result;
}

function readArchive() {
  return readArray(ARCHIVE_STORAGE_KEY).map(toHistoryItem).filter((item) => item.prompt);
}

function writeArchive(items) {
  localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(items.slice(-MAX_ARCHIVE_ITEMS)));
}

function readReports() {
  return readArray(REPORTS_STORAGE_KEY).filter((item) => item && typeof item.prompt === "string");
}

function readArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    localStorage.removeItem(key);
    return [];
  }
}

function readEpisode() {
  try {
    return JSON.parse(localStorage.getItem(EPISODE_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function parseBody(body) {
  if (typeof body !== "string") return {};
  try {
    const parsed = JSON.parse(body);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function safeJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function rebuildResponse(response, text) {
  return new Response(text, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders(response)
  });
}

function responseHeaders(response) {
  const headers = new Headers(response?.headers || {});
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json; charset=UTF-8");
  return headers;
}

function uniqueStrings(items) {
  return [...new Set(items.map((item) => String(item).trim()).filter(Boolean))];
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
  window.setTimeout(() => toast.classList.remove("visible"), 3000);
}

function injectStyles() {
  if (document.querySelector("#burrQualityStyles")) return;
  const style = document.createElement("style");
  style.id = "burrQualityStyles";
  style.textContent = `
    .burr-report-answer { display:block; margin:10px 0 0 auto; padding:7px 2px; border:0; background:transparent; color:inherit; font:inherit; font-size:.76rem; font-weight:750; text-decoration:underline; text-underline-offset:3px; opacity:.58; cursor:pointer; }
    .burr-report-answer:hover { opacity:1; }
    .burr-report-answer:disabled { cursor:default; text-decoration:none; opacity:.38; }
    .burr-report-dialog { width:min(calc(100% - 32px),500px); border:0; border-radius:24px; padding:0; color:#101c3d; box-shadow:0 28px 90px rgba(0,0,0,.35); }
    .burr-report-dialog::backdrop { background:rgba(4,14,43,.72); backdrop-filter:blur(4px); }
    .burr-report-dialog form { position:relative; padding:28px; }
    .burr-report-close { position:absolute; top:12px; right:15px; border:0; background:transparent; font-size:1.8rem; line-height:1; cursor:pointer; opacity:.55; }
    .burr-report-kicker { margin:0 0 7px; color:#6c2ba5; font-size:.72rem; font-weight:900; letter-spacing:.14em; }
    .burr-report-dialog h2 { margin:0 0 16px; font-size:1.65rem; }
    .burr-report-prompt { margin:0 0 10px; font-weight:750; line-height:1.45; }
    .burr-report-correct { margin:0 0 20px; font-size:.86rem; opacity:.7; }
    .burr-report-reasons { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .burr-report-reasons button { min-height:54px; padding:10px 12px; border:1px solid rgba(16,28,61,.16); border-radius:14px; background:#f4f6fc; color:inherit; font:inherit; font-weight:750; cursor:pointer; }
    .burr-report-reasons button:hover { border-color:#6c2ba5; background:#f8f1ff; }
    @media (max-width:520px) { .burr-report-reasons { grid-template-columns:1fr; } }
  `;
  document.head.appendChild(style);
}
