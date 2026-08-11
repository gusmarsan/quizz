/* Burrquizzz PWA runtime.
   The release number comes from release-gate.js instead of being hardcoded here. */

const getReleaseVersion = () => window.BurrquizzzReleaseGate?.currentVersion || window.BURRQUIZZZ_VERSION || "current";
const PULL_REFRESH_THRESHOLD = 72;
const PULL_REFRESH_MAX = 118;
const PULL_REFRESH_BLOCKED_SCREENS = new Set(["screen-game", "screen-countdown"]);
const HAD_CONTROLLER_AT_BOOT = "serviceWorker" in navigator && Boolean(navigator.serviceWorker.controller);

const appendStylesheetOnce = (needle, path) => {
  if (document.querySelector(`link[href*="${needle}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `./${path}?v=${encodeURIComponent(getReleaseVersion())}`;
  document.head.appendChild(link);
};

appendStylesheetOnce("mobile-viewport-lock-v081.css", "mobile-viewport-lock-v081.css");
appendStylesheetOnce("brand-v11.css", "brand-v11.css");
appendStylesheetOnce("pull-refresh-v113.css", "pull-refresh-v113.css");
appendStylesheetOnce("avatar-profile-v114.css", "avatar-profile-v114.css");
appendStylesheetOnce("mobile-game-fit-v114.css", "mobile-game-fit-v114.css");
appendStylesheetOnce("countdown-v12.css", "countdown-v12.css");

const countdownValue = document.querySelector("#countdownValue");
if (countdownValue) {
  const syncCountdownPresentation = () => {
    countdownValue.classList.toggle("is-go", countdownValue.textContent.trim().toUpperCase() === "JÁ");
  };
  syncCountdownPresentation();
  new MutationObserver(syncCountdownPresentation).observe(countdownValue, {
    childList: true,
    characterData: true,
    subtree: true
  });
}

const refreshReleaseMetadata = () => {
  const version = getReleaseVersion();
  const manifestLink = document.querySelector('link[rel="manifest"]');
  if (manifestLink) manifestLink.href = `./manifest.webmanifest?v=${encodeURIComponent(version)}`;

  const pngIcon = document.querySelector('link[rel="icon"][type="image/png"]');
  if (pngIcon) pngIcon.href = `./icons/icon-192.png?v=${encodeURIComponent(version)}`;

  const svgIcon = document.querySelector('link[rel="icon"][type="image/svg+xml"]');
  if (svgIcon) svgIcon.href = `./icons/burrquizzz-icon.svg?v=${encodeURIComponent(version)}`;

  const appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
  if (appleIcon) appleIcon.href = `./icons/apple-touch-icon.png?v=${encodeURIComponent(version)}`;

  const brandMark = document.querySelector(".brand-mark");
  if (brandMark) {
    brandMark.textContent = "Bz";
    brandMark.setAttribute("aria-hidden", "true");
  }

  const brandText = document.querySelector(".brand-text");
  if (brandText) brandText.textContent = "Burrquizzz";

  const versionBadge = document.querySelector("#burrAppVersion");
  if (versionBadge) {
    versionBadge.textContent = `v${version}`;
    versionBadge.title = `Burrquizzz versão ${version}`;
    versionBadge.setAttribute("aria-label", `Versão ${version}`);
  }
};

const loadAvatarProfile = () => import(`./avatar-profile-v114.js?v=${encodeURIComponent(getReleaseVersion())}`)
  .catch((error) => console.warn("Perfil: módulo de foto não pôde ser carregado.", error));

const loadMobileGameFit = () => import(`./mobile-game-fit-v114.js?v=${encodeURIComponent(getReleaseVersion())}`)
  .catch((error) => console.warn("Jogo: ajuste de viewport não pôde ser carregado.", error));

const ensurePullRefreshIndicator = () => {
  let indicator = document.querySelector("#burrPullRefresh");
  if (indicator) return indicator;

  indicator = document.createElement("div");
  indicator.id = "burrPullRefresh";
  indicator.setAttribute("role", "status");
  indicator.setAttribute("aria-live", "polite");
  indicator.innerHTML = '<span class="pull-refresh__icon" aria-hidden="true">↓</span><span class="pull-refresh__label">Puxe para atualizar</span>';
  document.body.appendChild(indicator);
  return indicator;
};

const setPullRefreshState = (state, label) => {
  const indicator = ensurePullRefreshIndicator();
  const text = indicator.querySelector(".pull-refresh__label");
  const icon = indicator.querySelector(".pull-refresh__icon");

  indicator.classList.remove("is-visible", "is-ready", "is-refreshing");
  if (state !== "hidden") indicator.classList.add("is-visible");
  if (state === "ready") indicator.classList.add("is-ready");
  if (state === "refreshing") indicator.classList.add("is-refreshing");

  if (text) text.textContent = label;
  if (icon) icon.textContent = state === "refreshing" ? "↻" : "↓";
};

const getActiveScreen = () => document.querySelector(".screen.active");

const canPullRefresh = (screen, eventTarget) => {
  if (!screen || PULL_REFRESH_BLOCKED_SCREENS.has(screen.id)) return false;
  if (screen.scrollTop > 0) return false;
  if (eventTarget instanceof Element && eventTarget.closest("input, textarea, select, [contenteditable='true']")) return false;
  return true;
};

let pullGesture = null;
let refreshInProgress = false;
let controllerReloaded = false;
let serviceWorkerRegistration = null;

const clearPullGesture = (keepIndicator = false) => {
  if (pullGesture?.screen) {
    pullGesture.screen.style.setProperty("--pull-refresh-distance", "0px");
    pullGesture.screen.classList.remove("pull-refresh-target");
  }
  document.body.classList.remove("pull-refresh-dragging");
  pullGesture = null;
  if (!keepIndicator && !refreshInProgress) setPullRefreshState("hidden", "Puxe para atualizar");
};

const reloadWithLatestVersion = async () => {
  if (refreshInProgress) return;
  refreshInProgress = true;
  setPullRefreshState("refreshing", "Atualizando…");

  try {
    if (window.BurrquizzzReleaseGate?.check) {
      await window.BurrquizzzReleaseGate.check({ block: false });
      if (window.BurrquizzzReleaseGate.updating) return;
    } else if (serviceWorkerRegistration) {
      await serviceWorkerRegistration.update();
      if (serviceWorkerRegistration.waiting) {
        serviceWorkerRegistration.waiting.postMessage({ type: "SKIP_WAITING" });
      }
    }
  } catch (error) {
    console.warn("PWA: não foi possível verificar a atualização antes de recarregar.", error);
  }

  window.setTimeout(() => window.location.reload(), 260);
};

const setupPullToRefresh = () => {
  if (!("ontouchstart" in window) && navigator.maxTouchPoints < 1) return;
  ensurePullRefreshIndicator();

  document.addEventListener("touchstart", (event) => {
    if (refreshInProgress || event.touches.length !== 1) return;

    const screen = getActiveScreen();
    if (!canPullRefresh(screen, event.target)) return;

    const touch = event.touches[0];
    pullGesture = {
      screen,
      startX: touch.clientX,
      startY: touch.clientY,
      distance: 0,
      dragging: false
    };
  }, { passive: true });

  document.addEventListener("touchmove", (event) => {
    if (!pullGesture || refreshInProgress || event.touches.length !== 1) return;
    if (getActiveScreen() !== pullGesture.screen || pullGesture.screen.scrollTop > 0) {
      clearPullGesture();
      return;
    }

    const touch = event.touches[0];
    const deltaX = touch.clientX - pullGesture.startX;
    const deltaY = touch.clientY - pullGesture.startY;

    if (deltaY <= 0) {
      if (pullGesture.dragging) clearPullGesture();
      return;
    }

    if (!pullGesture.dragging) {
      if (deltaY < 9 || Math.abs(deltaY) <= Math.abs(deltaX) * 1.15) return;
      pullGesture.dragging = true;
      pullGesture.screen.classList.add("pull-refresh-target");
      document.body.classList.add("pull-refresh-dragging");
    }

    event.preventDefault();
    const distance = Math.min(PULL_REFRESH_MAX, deltaY * .56);
    pullGesture.distance = distance;
    pullGesture.screen.style.setProperty("--pull-refresh-distance", `${distance}px`);

    if (distance >= PULL_REFRESH_THRESHOLD) {
      setPullRefreshState("ready", "Solte para atualizar");
    } else {
      setPullRefreshState("pulling", "Puxe para atualizar");
    }
  }, { passive: false });

  const finishPull = () => {
    if (!pullGesture) return;
    const shouldRefresh = pullGesture.dragging && pullGesture.distance >= PULL_REFRESH_THRESHOLD;
    clearPullGesture(shouldRefresh);
    if (shouldRefresh) reloadWithLatestVersion();
  };

  document.addEventListener("touchend", finishPull, { passive: true });
  document.addEventListener("touchcancel", () => clearPullGesture(), { passive: true });
};

const initializeUiRuntime = () => {
  refreshReleaseMetadata();
  setupPullToRefresh();
  loadAvatarProfile();
  loadMobileGameFit();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeUiRuntime, { once: true });
} else {
  initializeUiRuntime();
}

window.BurrquizzzReleaseGate?.ready?.then(() => refreshReleaseMetadata()).catch(() => {});

const registerCurrentWorker = async () => {
  if (!("serviceWorker" in navigator)) return;
  if (window.BurrquizzzReleaseGate?.updating) return;

  try {
    if (window.BurrquizzzReleaseGate?.ready) {
      await window.BurrquizzzReleaseGate.ready;
    }
    if (window.BurrquizzzReleaseGate?.updating) return;

    const version = getReleaseVersion();
    const registration = await navigator.serviceWorker.register(`./sw.js?v=${encodeURIComponent(version)}`, {
      scope: "./",
      updateViaCache: "none"
    });
    serviceWorkerRegistration = registration;
    await registration.update();
    if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
  } catch (error) {
    console.warn("PWA: service worker não pôde ser registrado.", error);
  }
};

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (window.BurrquizzzReleaseGate?.updating) return;
    if (!HAD_CONTROLLER_AT_BOOT || controllerReloaded) return;
    controllerReloaded = true;
    setPullRefreshState("refreshing", "Atualização pronta…");
    window.setTimeout(() => window.location.reload(), 180);
  });

  window.addEventListener("load", registerCurrentWorker, { once: true });
}
