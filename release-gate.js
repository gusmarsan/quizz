/* Burrquizzz release gate
   Checks the published release before exposing the app. If a newer release is
   available, it updates the Service Worker and reloads before the Home appears.
   Offline use always falls back to the installed bundle. */
(() => {
  // A versão canônica não depende mais da query string do index. Isso permite
  // publicar hotfixes como 1.81 sem deixar um HTML antigo preso em loop de update.
  const bundledVersion = "1.9";

  const root = document.documentElement;
  const VERSION_STORAGE_KEY = "burrquizzz-installed-version";
  const REFRESH_PARAM = "_burr_refresh";
  const VERSION_CHECK_TIMEOUT = 2800;
  const UPDATE_WAIT_TIMEOUT = 4800;

  let currentVersion = bundledVersion;
  let checkingPromise = null;
  let updateInProgress = false;
  let readyResolved = false;
  let resolveReady;

  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });

  root.classList.add("burr-release-checking");

  const gateStyle = document.createElement("style");
  gateStyle.dataset.burrReleaseGate = "true";
  gateStyle.textContent = `
    html.burr-release-checking,
    html.burr-release-checking body,
    html.burr-release-updating,
    html.burr-release-updating body {
      min-height: 100%;
      background: #061117;
    }

    html.burr-release-checking body {
      opacity: 0 !important;
    }

    html.burr-release-updating body {
      opacity: 1 !important;
    }

    html.burr-release-updating body > :not(#burrReleaseGate) {
      visibility: hidden !important;
    }

    #burrReleaseGate {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: grid;
      place-items: center;
      padding: 28px;
      color: #f5f0e6;
      background:
        radial-gradient(circle at 50% 35%, rgba(226,169,59,.12), transparent 22rem),
        linear-gradient(145deg,#030a0e,#0b1d26 52%,#061117);
      font-family: "DM Sans", "Trebuchet MS", "Segoe UI", sans-serif;
      text-align: center;
    }

    #burrReleaseGate .burr-release-gate__content {
      display: grid;
      justify-items: center;
      gap: 13px;
    }

    #burrReleaseGate .burr-release-gate__star {
      color: #f1c45c;
      font-size: 1.55rem;
      filter: drop-shadow(0 5px 12px rgba(226,169,59,.34));
      animation: burr-release-pulse 900ms ease-in-out infinite alternate;
    }

    #burrReleaseGate strong {
      font-size: .9rem;
      font-weight: 800;
      letter-spacing: .055em;
      text-transform: uppercase;
    }

    #burrReleaseGate small {
      color: #d7cab2;
      font-size: .72rem;
      font-weight: 500;
    }

    @keyframes burr-release-pulse {
      from { opacity: .55; transform: scale(.92) rotate(-5deg); }
      to { opacity: 1; transform: scale(1.08) rotate(5deg); }
    }

    @media (prefers-reduced-motion: reduce) {
      #burrReleaseGate .burr-release-gate__star { animation: none; }
    }
  `;
  document.head.appendChild(gateStyle);

  const onceBodyExists = () => {
    if (document.body) return Promise.resolve(document.body);
    return new Promise((resolve) => {
      document.addEventListener("DOMContentLoaded", () => resolve(document.body), { once: true });
    });
  };

  const cleanRefreshMarker = () => {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has(REFRESH_PARAM)) return;
      url.searchParams.delete(REFRESH_PARAM);
      const clean = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState(window.history.state, "", clean);
    } catch {
      // Cosmetic cleanup only.
    }
  };

  const markReady = (version = currentVersion) => {
    currentVersion = version || currentVersion;
    try {
      localStorage.setItem(VERSION_STORAGE_KEY, currentVersion);
    } catch {
      // Storage is optional; the bundled version remains available in memory.
    }

    root.classList.remove("burr-release-checking", "burr-release-updating");
    document.querySelector("#burrReleaseGate")?.remove();
    cleanRefreshMarker();

    if (!readyResolved) {
      readyResolved = true;
      resolveReady(currentVersion);
    }
  };

  const showUpdating = async (version) => {
    updateInProgress = true;
    root.classList.remove("burr-release-checking");
    root.classList.add("burr-release-updating");

    await onceBodyExists();
    let overlay = document.querySelector("#burrReleaseGate");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "burrReleaseGate";
      overlay.setAttribute("role", "status");
      overlay.setAttribute("aria-live", "polite");
      overlay.innerHTML = `
        <div class="burr-release-gate__content">
          <span class="burr-release-gate__star" aria-hidden="true">★</span>
          <strong>Atualizando Burrquizzz…</strong>
          <small>Preparando a versão ${version}</small>
        </div>
      `;
      document.body.appendChild(overlay);
    }
  };

  const fetchPublishedVersion = async () => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), VERSION_CHECK_TIMEOUT);

    try {
      const url = new URL("./version.json", window.location.href);
      url.searchParams.set("_", String(Date.now()));
      const response = await fetch(url.href, {
        cache: "no-store",
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`version.json respondeu ${response.status}`);

      const data = await response.json();
      const version = String(data?.version || "").trim();
      if (!/^\d+(?:\.\d+)+$/.test(version)) throw new Error("versão publicada inválida");
      return version;
    } finally {
      window.clearTimeout(timer);
    }
  };

  const hardReload = (version) => {
    const url = new URL(window.location.href);
    url.searchParams.set(REFRESH_PARAM, `${version}-${Date.now()}`);
    window.location.replace(url.href);
  };

  const waitForWorkerState = (worker) => {
    if (!worker || ["installed", "activated", "redundant"].includes(worker.state)) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const timer = window.setTimeout(finish, UPDATE_WAIT_TIMEOUT);
      worker.addEventListener("statechange", () => {
        if (["installed", "activated", "redundant"].includes(worker.state)) {
          window.clearTimeout(timer);
          finish();
        }
      });
    });
  };

  const installPublishedRelease = async (publishedVersion) => {
    await showUpdating(publishedVersion);

    if (!("serviceWorker" in navigator)) {
      hardReload(publishedVersion);
      return;
    }

    let controllerChanged = false;
    const controllerPromise = new Promise((resolve) => {
      const timer = window.setTimeout(resolve, UPDATE_WAIT_TIMEOUT);
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        controllerChanged = true;
        window.clearTimeout(timer);
        resolve();
      }, { once: true });
    });

    try {
      const swUrl = new URL("./sw.js", window.location.href);
      swUrl.searchParams.set("v", publishedVersion);

      const registration = await navigator.serviceWorker.register(swUrl.href, {
        scope: "./",
        updateViaCache: "none"
      });

      await registration.update().catch(() => {});

      if (registration.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }

      const worker = registration.installing || registration.waiting;
      if (worker) {
        await waitForWorkerState(worker);
        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
      }

      await controllerPromise;
    } catch (error) {
      console.warn("Release gate: atualização do Service Worker não pôde ser concluída antes da recarga.", error);
    }

    // Even without controllerchange, the cache-busted navigation forces a fresh
    // document request. The new worker will take control on this or the next load.
    if (!controllerChanged) {
      await new Promise((resolve) => window.setTimeout(resolve, 120));
    }
    hardReload(publishedVersion);
  };

  const checkForLatest = ({ block = false } = {}) => {
    if (updateInProgress) return Promise.resolve(currentVersion);
    if (checkingPromise) return checkingPromise;

    if (block) root.classList.add("burr-release-checking");

    checkingPromise = (async () => {
      try {
        const publishedVersion = await fetchPublishedVersion();
        if (publishedVersion !== bundledVersion) {
          await installPublishedRelease(publishedVersion);
          return publishedVersion;
        }

        markReady(publishedVersion);
        return publishedVersion;
      } catch (error) {
        // Offline, captive portal or transient network failure: never block use.
        console.warn("Release gate: usando a versão instalada porque a versão publicada não pôde ser consultada.", error);
        markReady(bundledVersion);
        return bundledVersion;
      } finally {
        checkingPromise = null;
      }
    })();

    return checkingPromise;
  };

  const api = {
    get bundledVersion() { return bundledVersion; },
    get currentVersion() { return currentVersion; },
    get updating() { return updateInProgress; },
    ready,
    check: checkForLatest
  };

  window.BurrquizzzReleaseGate = api;
  window.BURRQUIZZZ_VERSION = bundledVersion;

  // Initial gate: the Home remains hidden until the version check succeeds,
  // times out, or confirms that offline fallback is necessary.
  checkForLatest({ block: true }).then((version) => {
    window.BURRQUIZZZ_VERSION = version;
  });

  // An installed PWA can be resumed without reloading the document. Re-check on
  // foreground so tapping the icon later still catches a newly published build.
  let foregroundTimer = 0;
  const queueForegroundCheck = () => {
    if (document.visibilityState !== "visible" || updateInProgress) return;
    window.clearTimeout(foregroundTimer);
    foregroundTimer = window.setTimeout(() => checkForLatest({ block: false }), 180);
  };

  document.addEventListener("visibilitychange", queueForegroundCheck);
  window.addEventListener("online", queueForegroundCheck);
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) queueForegroundCheck();
  });
})();
