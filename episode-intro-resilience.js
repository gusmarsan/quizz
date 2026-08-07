const WATCHDOG_MS = 35000;

let watchdog = null;
let lastMessage = "Preparando o episódio.";

bindWhenReady();
window.addEventListener("burrquizzz:episode-preparing", (event) => {
  setPreparing(event.detail?.message || "Preparando o episódio.");
});
window.addEventListener("burrquizzz:episode-progress", (event) => {
  setPreparing(event.detail?.message || "Gerando perguntas inéditas.");
});
window.addEventListener("burrquizzz:episode-error", (event) => {
  setError(event.detail?.message || "Não foi possível preparar o episódio.");
});
window.addEventListener("burrquizzz:episode-ready", () => {
  setReady();
});

function bindWhenReady() {
  const bind = () => {
    const overlay = document.querySelector(".burr-episode-overlay");
    const button = document.querySelector("#burrEnterStudio");
    if (!overlay || !button) {
      setTimeout(bind, 50);
      return;
    }

    button.addEventListener("click", handleRetryClick, true);

    const observer = new MutationObserver(() => {
      if (overlay.hidden) {
        clearWatchdog();
        return;
      }

      const state = document.documentElement.dataset.episodeState;
      if (document.documentElement.dataset.episodeReady === "true") {
        setReady();
      } else if (state === "error") {
        setError(document.documentElement.dataset.episodeError);
      } else {
        setPreparing(lastMessage);
      }
    });

    observer.observe(overlay, { attributes: true, attributeFilter: ["hidden"] });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind, { once: true });
  } else {
    bind();
  }
}

function handleRetryClick(event) {
  const state = document.documentElement.dataset.episodeState;
  const timedOut = document.documentElement.dataset.episodeWatchdog === "expired";
  if (state !== "error" && !timedOut) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  document.documentElement.dataset.episodeWatchdog = "retrying";
  setPreparing("Tentando novamente criar 16 perguntas inéditas.");
  window.dispatchEvent(new CustomEvent("burrquizzz:retry-generation"));
}

function setPreparing(message) {
  lastMessage = String(message || "Preparando o episódio.");
  const status = document.querySelector("#burrReadyStatus");
  const button = document.querySelector("#burrEnterStudio");
  if (!status || !button) return;

  status.textContent = lastMessage;
  status.classList.remove("ready", "error");
  button.disabled = true;
  button.textContent = "Só mais um instante";
  startWatchdog();
}

function setReady() {
  clearWatchdog();
  delete document.documentElement.dataset.episodeWatchdog;

  const status = document.querySelector("#burrReadyStatus");
  const button = document.querySelector("#burrEnterStudio");
  if (!status || !button) return;

  status.textContent = "Tudo pronto. O episódio pode começar.";
  status.classList.add("ready");
  status.classList.remove("error");
  button.disabled = false;
  button.textContent = "Começar episódio";
}

function setError(message) {
  clearWatchdog();
  document.documentElement.dataset.episodeWatchdog = "expired";

  const status = document.querySelector("#burrReadyStatus");
  const button = document.querySelector("#burrEnterStudio");
  if (!status || !button) return;

  status.textContent = String(message || "Não foi possível preparar o episódio agora.");
  status.classList.add("error");
  status.classList.remove("ready");
  button.disabled = false;
  button.textContent = "Tentar novamente";
  ensureErrorStyle();
}

function startWatchdog() {
  clearWatchdog();
  watchdog = setTimeout(() => {
    if (document.documentElement.dataset.episodeReady === "true") return;
    setError("A preparação está demorando mais que o esperado. Tente novamente.");
  }, WATCHDOG_MS);
}

function clearWatchdog() {
  if (!watchdog) return;
  clearTimeout(watchdog);
  watchdog = null;
}

function ensureErrorStyle() {
  if (document.querySelector("#burrIntroResilienceStyle")) return;
  const style = document.createElement("style");
  style.id = "burrIntroResilienceStyle";
  style.textContent = `
    .burr-ready-status.error {
      color: #ffd6df;
      font-weight: 800;
    }
  `;
  document.head.appendChild(style);
}
