const STORAGE_KEY = "burrquizzzResponseTimeSeconds";
export const RESPONSE_TIME_OPTIONS = Object.freeze([20, 25, 30]);
export const DEFAULT_RESPONSE_TIME_SECONDS = 20;

function normalizeSeconds(value, fallback = DEFAULT_RESPONSE_TIME_SECONDS) {
  const seconds = Number(value);
  return RESPONSE_TIME_OPTIONS.includes(seconds) ? seconds : fallback;
}

export function getResponseTimeSeconds() {
  try {
    return normalizeSeconds(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_RESPONSE_TIME_SECONDS;
  }
}

export function getResponseTimeMs() {
  return getResponseTimeSeconds() * 1000;
}

export function getDuelResponseTimeSeconds(roomData) {
  return normalizeSeconds(roomData?.responseTimeSeconds, DEFAULT_RESPONSE_TIME_SECONDS);
}

export function getDuelResponseTimeMs(roomData) {
  return getDuelResponseTimeSeconds(roomData) * 1000;
}

export function setResponseTimeSeconds(value) {
  const seconds = normalizeSeconds(value);
  try {
    localStorage.setItem(STORAGE_KEY, String(seconds));
  } catch {
    // O jogo continua com a escolha em memória nesta sessão.
  }

  window.dispatchEvent(new CustomEvent("burrquizzz:response-time-change", {
    detail: { seconds, ms: seconds * 1000 }
  }));
  return seconds;
}

function ensureStylesheet() {
  if (document.querySelector('link[data-burr-settings-v19]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./settings-v19.css?v=1.9";
  link.dataset.burrSettingsV19 = "true";
  document.head.appendChild(link);
}

function showOnlyScreen(screenId) {
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.toggle("active", screen.id === screenId);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function syncTimeOptions(root) {
  const selected = getResponseTimeSeconds();
  root.querySelectorAll("[data-response-time]").forEach((button) => {
    const active = Number(button.dataset.responseTime) === selected;
    button.classList.toggle("is-selected", active);
    button.setAttribute("aria-checked", String(active));
  });
  const value = root.querySelector("#settingsTimeValue");
  if (value) value.textContent = `${selected} segundos`;
}

export function mountSettingsUi() {
  if (typeof document === "undefined" || !document.body) return;
  if (document.querySelector("#screen-settings")) return;

  ensureStylesheet();
  const home = document.querySelector("#screen-home");
  const shell = document.querySelector(".app-shell");
  if (!home || !shell) return;

  const gear = document.createElement("button");
  gear.id = "homeSettingsButton";
  gear.className = "home-settings-button";
  gear.type = "button";
  gear.setAttribute("aria-label", "Abrir configurações");
  gear.title = "Configurações";
  gear.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5Z"/>
      <path d="M19.15 13.7a7.9 7.9 0 0 0 .05-1.7 7.9 7.9 0 0 0-.05-1.7l2-1.55-1.9-3.3-2.35.95a8.1 8.1 0 0 0-2.95-1.7L13.6 2h-3.8l-.35 2.7A8.1 8.1 0 0 0 6.5 6.4l-2.35-.95-1.9 3.3 2 1.55A7.9 7.9 0 0 0 4.2 12c0 .58.02 1.15.05 1.7l-2 1.55 1.9 3.3 2.35-.95a8.1 8.1 0 0 0 2.95 1.7L9.8 22h3.8l.35-2.7a8.1 8.1 0 0 0 2.95-1.7l2.35.95 1.9-3.3-2-1.55Z"/>
    </svg>`;
  home.appendChild(gear);

  const settings = document.createElement("section");
  settings.id = "screen-settings";
  settings.className = "screen settings-screen";
  settings.setAttribute("aria-labelledby", "settingsTitle");
  settings.innerHTML = `
    <div class="settings-v19__ambient" aria-hidden="true"></div>
    <div class="settings-v19__content">
      <button id="settingsBackButton" class="back-link settings-v19__back" type="button">← Voltar</button>
      <header class="settings-v19__header">
        <p class="eyebrow">Burrquizzz</p>
        <h2 id="settingsTitle">Configurações</h2>
        <p>Ajuste a partida do seu jeito.</p>
      </header>

      <article class="settings-v19__card">
        <div class="settings-v19__card-heading">
          <span class="settings-v19__card-icon" aria-hidden="true">⏱</span>
          <div>
            <h3>Tempo de resposta</h3>
            <p>Escolha quanto tempo cada pergunta fica disponível.</p>
          </div>
        </div>

        <div class="settings-time-options" role="radiogroup" aria-label="Tempo de resposta">
          <button class="settings-time-option" type="button" role="radio" data-response-time="20">
            <strong>20</strong><span>segundos</span>
          </button>
          <button class="settings-time-option" type="button" role="radio" data-response-time="25">
            <strong>25</strong><span>segundos</span>
          </button>
          <button class="settings-time-option" type="button" role="radio" data-response-time="30">
            <strong>30</strong><span>segundos</span>
          </button>
        </div>

        <div class="settings-v19__saved">
          <span>Selecionado</span>
          <strong id="settingsTimeValue">20 segundos</strong>
        </div>
        <p class="settings-v19__note">A escolha fica salva neste aparelho. No duelo online, vale o tempo definido por quem cria a sala.</p>
      </article>
    </div>`;
  shell.appendChild(settings);

  gear.addEventListener("click", () => {
    syncTimeOptions(settings);
    showOnlyScreen("screen-settings");
  });

  settings.querySelector("#settingsBackButton")?.addEventListener("click", () => {
    showOnlyScreen("screen-home");
  });

  settings.querySelectorAll("[data-response-time]").forEach((button) => {
    button.addEventListener("click", () => {
      setResponseTimeSeconds(Number(button.dataset.responseTime));
      syncTimeOptions(settings);
    });
  });

  syncTimeOptions(settings);
}

if (typeof document !== "undefined") {
  if (document.body) mountSettingsUi();
  else document.addEventListener("DOMContentLoaded", mountSettingsUi, { once: true });
}
