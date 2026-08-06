const WATCHDOG_MS = 110000;

let watchdog = null;
let lastMessage = "";

window.addEventListener("burrquizzz:episode-preparing", (event) => {
  lastMessage = String(event.detail?.message || "Preparando o episódio.");
  renderState("preparing", lastMessage);
});

window.addEventListener("burrquizzz:episode-progress", (event) => {
  lastMessage = String(event.detail?.message || "Gerando perguntas inéditas.");
  renderState("preparing", lastMessage);
});

window.addEventListener("burrquizzz:episode-ready", () => {
  clearWatchdog();
  renderState("ready", "Tudo pronto. O episódio pode começar.");
});

window.addEventListener("burrquizzz:episode-error", (event) => {
  clearWatchdog();
  lastMessage = String(
    event.detail?.message ||
    "Não foi possível preparar 16 perguntas inéditas agora."
  );
  renderState("error", lastMessage);
});

document.addEventListener("click", (event) => {
  const button = event.target.closest?.("#burrEnterStudio");
  if (!button || button.dataset.episodeAction !== "retry") return;

  event.preventDefault();
  event.stopImmediatePropagation();

  button.dataset.episodeAction = "waiting";
  button.disabled = true;
  button.textContent = "Tentando novamente";
  updateStatus("Reabrindo a geração de perguntas inéditas.", "preparing");
  armWatchdog();

  window.dispatchEvent(new CustomEvent("burrquizzz:retry-generation"));
}, true);

const overlayObserver = new MutationObserver(() => {
  const overlay = getOverlay();
  if (!overlay || overlay.hidden) {
    clearWatchdog();
    return;
  }

  renderFromDocumentState();
});

overlayObserver.observe(document.documentElement, {
  subtree: true,
  attributes: true,
  attributeFilter: ["hidden"]
});

function renderFromDocumentState() {
  const state = document.documentElement.dataset.episodeState;
  const ready = document.documentElement.dataset.episodeReady === "true";

  if (ready || state === "ready") {
    renderState("ready", "Tudo pronto. O episódio pode começar.");
    return;
  }

  if (state === "error") {
    renderState(
      "error",
      document.documentElement.dataset.episodeError ||
      "Não foi possível preparar 16 perguntas inéditas agora."
    );
    return;
  }

  renderState(
    "preparing",
    lastMessage ||
    "Conferindo o histórico e preparando perguntas inéditas."
  );
}

function renderState(state, message) {
  const overlay = getOverlay();
  if (!overlay || overlay.hidden) return;

  const button = overlay.querySelector("#burrEnterStudio");
  if (!button) return;

  if (state === "ready") {
    clearWatchdog();
    button.disabled = false;
    button.textContent = "Começar episódio";
    delete button.dataset.episodeAction;
    updateStatus(message, "ready");
    return;
  }

  if (state === "error") {
    button.disabled = false;
    button.textContent = "Tentar novamente";
    button.dataset.episodeAction = "retry";
    updateStatus(`${message} Toque para tentar novamente.`, "error");
    return;
  }

  button.disabled = true;
  button.textContent = "Preparando episódio";
  button.dataset.episodeAction = "waiting";
  updateStatus(message, "preparing");
  armWatchdog();
}

function updateStatus(message, state) {
  const status = getOverlay()?.querySelector("#burrReadyStatus");
  if (!status) return;

  status.textContent = message;
  status.classList.toggle("ready", state === "ready");
  status.classList.toggle("error", state === "error");
}

function armWatchdog() {
  clearWatchdog();
  watchdog = setTimeout(() => {
    if (document.documentElement.dataset.episodeReady === "true") return;

    document.documentElement.dataset.episodeState = "error";
    document.documentElement.dataset.episodeError =
      "A preparação demorou mais do que deveria.";
    renderState("error", "A preparação demorou mais do que deveria.");
  }, WATCHDOG_MS);
}

function clearWatchdog() {
  clearTimeout(watchdog);
  watchdog = null;
}

function getOverlay() {
  return document.querySelector(".burr-episode-overlay");
}

const style = document.createElement("style");
style.textContent = `
  .burr-ready-status.error {
    color: #ffd0d8;
  }
`;
document.head.appendChild(style);
