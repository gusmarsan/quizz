import { QUESTIONS } from "./questions.js";
import { LEGENDARY_QUESTIONS } from "./legendary-questions-v071.js";

const SOLO_FEEDBACK_MS = 4200;
const LEGACY_SOLO_FEEDBACK_MS = 2200;
const PROMPT_INDEX = new Map(
  [...QUESTIONS, ...LEGENDARY_QUESTIONS].map((question) => [normalize(question.prompt), question])
);

patchSoloFeedbackDelay();
boot();

function patchSoloFeedbackDelay() {
  if (window.__burrSoloFeedbackV074DelayPatched) return;
  window.__burrSoloFeedbackV074DelayPatched = true;

  const nativeSetTimeout = window.setTimeout.bind(window);
  window.setTimeout = (callback, delay, ...args) => {
    let effectiveDelay = delay;

    if (Number(delay) === LEGACY_SOLO_FEEDBACK_MS && isSoloAdvanceCallback(callback)) {
      effectiveDelay = SOLO_FEEDBACK_MS;
    }

    return nativeSetTimeout(callback, effectiveDelay, ...args);
  };
}

function isSoloAdvanceCallback(callback) {
  if (typeof callback !== "function") return false;
  try {
    const source = Function.prototype.toString.call(callback);
    return source.includes("state.currentIndex += 1") && source.includes("startSoloQuestion");
  } catch {
    return false;
  }
}

function boot() {
  const start = () => {
    const gameScreen = document.querySelector("#screen-game");
    const card = document.querySelector("#screen-game .question-card");
    const banner = document.querySelector("#feedbackBanner");
    const questionText = document.querySelector("#questionText");
    const opponentBadge = document.querySelector("#opponentBadge");

    if (!gameScreen || !card || !banner || !questionText || !opponentBadge) return;

    const panel = createPanel();
    card.appendChild(panel);

    const sync = () => syncFeedback({ gameScreen, card, banner, questionText, opponentBadge, panel });

    new MutationObserver(sync).observe(banner, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"]
    });

    new MutationObserver(() => resetPanel(card, banner, panel)).observe(questionText, {
      childList: true,
      characterData: true,
      subtree: true
    });

    new MutationObserver(sync).observe(gameScreen, {
      attributes: true,
      attributeFilter: ["class"]
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
}

function createPanel() {
  const panel = document.createElement("section");
  panel.id = "soloFeedbackPanel";
  panel.className = "solo-feedback-panel";
  panel.hidden = true;
  panel.setAttribute("role", "status");
  panel.setAttribute("aria-live", "polite");
  panel.setAttribute("aria-atomic", "true");
  return panel;
}

function syncFeedback({ gameScreen, card, banner, questionText, opponentBadge, panel }) {
  const isSolo = gameScreen.classList.contains("active") && opponentBadge.classList.contains("hidden");
  const isGood = banner.classList.contains("good");
  const isBad = banner.classList.contains("bad");
  const sourceText = String(banner.textContent || "").trim();

  if (!isSolo || (!isGood && !isBad) || !sourceText) {
    resetPanel(card, banner, panel);
    return;
  }

  const question = PROMPT_INDEX.get(normalize(questionText.textContent));
  const timedOut = /^tempo esgotado/i.test(sourceText);
  const correct = isGood;
  const answer = getCorrectAnswer(question, sourceText);
  const explanation = getExplanation(question);
  const elapsed = getElapsed(sourceText);

  panel.className = `solo-feedback-panel ${correct ? "good" : timedOut ? "timeout" : "bad"}`;
  panel.innerHTML = `
    <div class="solo-feedback-heading">
      <strong class="solo-feedback-status">${correct ? "ACERTOU! 🎯" : timedOut ? "TEMPO ESGOTADO ⏱️" : "ERROU! 💥"}</strong>
      ${elapsed ? `<span class="solo-feedback-time">${escapeHtml(elapsed)}</span>` : ""}
    </div>
    ${answer ? `<div class="solo-feedback-answer"><span>Resposta</span><strong>${escapeHtml(answer)}</strong></div>` : ""}
    ${explanation ? `<p class="solo-feedback-explanation">${escapeHtml(explanation)}</p>` : ""}
  `;
  panel.hidden = false;
  card.classList.add("solo-feedback-visible");
  banner.classList.add("solo-feedback-source");
  banner.setAttribute("aria-hidden", "true");
}

function resetPanel(card, banner, panel) {
  panel.hidden = true;
  panel.innerHTML = "";
  panel.className = "solo-feedback-panel";
  card.classList.remove("solo-feedback-visible");
  banner.classList.remove("solo-feedback-source");
  banner.removeAttribute("aria-hidden");
}

function getCorrectAnswer(question, sourceText) {
  if (question?.type === "multiple_choice" || question?.type === "image_choice") {
    return question.options?.[question.correctIndex] || "";
  }

  if (question?.type === "text_input") {
    return question.acceptedAnswers?.[0] || "";
  }

  if (question?.type === "match_columns") {
    return "Associações corretas";
  }

  const explicit = sourceText.match(/(?:Resposta certa|Resposta aceita):\s*(.+)$/i);
  if (explicit?.[1]) return explicit[1].trim();

  const highlighted = document.querySelector("#answersArea .answer-button.correct span:last-child");
  return String(highlighted?.textContent || "").trim();
}

function getExplanation(question) {
  if (!question) return "";
  if (question.explanation) return String(question.explanation).trim();
  if (question.supportText) return String(question.supportText).trim();

  if (question.type === "match_columns") {
    return question.leftItems
      ?.map((left, index) => `${left} → ${question.matches?.[index] || ""}`)
      .filter(Boolean)
      .join(" • ") || "";
  }

  return "";
}

function getElapsed(sourceText) {
  const match = sourceText.match(/\b(\d+(?:[,.]\d+)?s)\b/i);
  return match ? `Respondida em ${match[1].replace(".", ",")}` : "";
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
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
