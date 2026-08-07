import { QUESTIONS } from "./questions.js";

const SAFE_PLACEHOLDER = "Digite sua resposta";

sanitizeQuestions(QUESTIONS);
installDomGuard();

window.addEventListener("burrquizzz:episode-ready", (event) => {
  sanitizeEpisode(event.detail);
  sanitizeQuestions(QUESTIONS);
  sanitizeVisibleInput();
});

function sanitizeEpisode(episode) {
  if (!episode || typeof episode !== "object") return;

  sanitizeQuestions(episode.discoveries);

  if (Array.isArray(episode.blocks)) {
    episode.blocks.forEach((block) => sanitizeQuestions(block?.discoveries));
  }
}

function sanitizeQuestions(items) {
  if (!Array.isArray(items)) return;

  items.forEach((question) => {
    if (question?.type === "text_input") {
      question.placeholder = SAFE_PLACEHOLDER;
    }
  });
}

function sanitizeVisibleInput() {
  const input = document.querySelector("#textAnswerInput");
  if (input && input.placeholder !== SAFE_PLACEHOLDER) {
    input.placeholder = SAFE_PLACEHOLDER;
  }
}

function installDomGuard() {
  const boot = () => {
    sanitizeVisibleInput();

    const observer = new MutationObserver(sanitizeVisibleInput);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
}
