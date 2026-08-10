const BURRQUIZZZ_VERSION = "1.13";
const PULL_REFRESH_THRESHOLD = 72;
const PULL_REFRESH_MAX = 118;
const PULL_REFRESH_BLOCKED_SCREENS = new Set(["screen-game", "screen-countdown"]);
const HAD_CONTROLLER_AT_BOOT = "serviceWorker" in navigator && Boolean(navigator.serviceWorker.controller);

const mobileViewportStyles = document.createElement("link");
mobileViewportStyles.rel = "stylesheet";
mobileViewportStyles.href = `./mobile-viewport-lock-v081.css?v=${BURRQUIZZZ_VERSION}`;
document.head.appendChild(mobileViewportStyles);

const brandStyles = document.createElement("link");
brandStyles.rel = "stylesheet";
brandStyles.href = `./brand-v11.css?v=${BURRQUIZZZ_VERSION}`;
document.head.appendChild(brandStyles);

const refreshReleaseMetadata = () => {
  const manifestLink = document.querySelector('link[rel="manifest"]');
  if (manifestLink) manifestLink.href = `./manifest.webmanifest?v=${BURRQUIZZZ_VERSION}`;

  const pngIcon = document.querySelector('link[rel="icon"][type="image/png"]');
  if (pngIcon) pngIcon.href = `./icons/icon-192.png?v=${BURRQUIZZZ_VERSION}`;

  const svgIcon = document.querySelector('link[rel="icon"][type="image/svg+xml"]');
  if (svgIcon) svgIcon.href = `./icons/burrquizzz-icon.svg?v=${BURRQUIZZZ_VERSION}`;

  const appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
  if (appleIcon) appleIcon.href = `./icons/apple-touch-icon.png?v=${BURRQUIZZZ_VERSION}`;

  const brandMark = document.querySelector(".brand-mark");
  if (brandMark) {
    brandMark.textContent = "Bz";
    brandMark.setAttribute("aria-hidden", "true");
  }

  const brandText = document.querySelector(".brand-text");
  if (brandText) brandText.textContent = "Burrquizzz";

  const versionBadge = document.querySelector("#burrAppVersion");
  if (versionBadge) {
    versionBadge.textContent = `v${BURRQUIZZZ_VERSION}`;
    versionBadge.title = `Burrquizzz versão ${BURRQUIZZZ_VERSION}`;
    versionBadge.setAttribute("aria-label", `Versão ${BURRQUIZZZ_VERSION}`);
  }
};

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
    const registration = serviceWorkerRegistration || await navigator.serviceWorker?.getRegistration("./");
    if (registration) {
      await registration.update();
      if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
  } catch (error) {
    console.warn("PWA: não foi possível verificar a atualização antes de recarregar.", error);
  }

  window.setTimeout(() => window.location.reload(), 320);
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

const watchServiceWorkerUpdates = (registration) => {
  serviceWorkerRegistration = registration;

  registration.addEventListener("updatefound", () => {
    const installing = registration.installing;
    if (!installing) return;

    installing.addEventListener("statechange", () => {
      if (installing.state === "installed" && navigator.serviceWorker.controller) {
        setPullRefreshState("refreshing", "Nova versão encontrada…");
      }
    });
  });
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    refreshReleaseMetadata();
    setupPullToRefresh();
  }, { once: true });
} else {
  refreshReleaseMetadata();
  setupPullToRefresh();
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!HAD_CONTROLLER_AT_BOOT || controllerReloaded) return;
    controllerReloaded = true;
    setPullRefreshState("refreshing", "Atualização pronta…");
    window.setTimeout(() => window.location.reload(), 180);
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`./sw.js?v=${BURRQUIZZZ_VERSION}`, { scope: "./", updateViaCache: "none" })
      .then((registration) => {
        watchServiceWorkerUpdates(registration);
        return registration.update();
      })
      .catch((error) => console.warn("PWA: service worker não pôde ser registrado.", error));
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && serviceWorkerRegistration) {
      serviceWorkerRegistration.update().catch(() => {});
    }
  });
}
