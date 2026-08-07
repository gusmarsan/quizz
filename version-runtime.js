const APP_VERSION = "0.7433";

mountVersion();

function mountVersion() {
  const boot = () => {
    const existing = document.querySelector("#burrAppVersion");
    if (existing) {
      existing.textContent = `v${APP_VERSION}`;
      existing.title = `Burrquizzz versão ${APP_VERSION}`;
      existing.setAttribute("aria-label", `Versão ${APP_VERSION}`);
      document.documentElement.dataset.appVersion = APP_VERSION;
      return;
    }

    const version = document.createElement("div");
    version.id = "burrAppVersion";
    version.className = "burr-app-version";
    version.textContent = `v${APP_VERSION}`;
    version.title = `Burrquizzz versão ${APP_VERSION}`;
    version.setAttribute("aria-label", `Versão ${APP_VERSION}`);
    document.body.appendChild(version);

    const style = document.createElement("style");
    style.id = "burrVersionStyles";
    style.textContent = `
      .burr-app-version {
        position: fixed;
        right: 10px;
        bottom: 8px;
        z-index: 16000;
        padding: 4px 7px;
        border: 1px solid rgba(255,255,255,.22);
        border-radius: 999px;
        background: rgba(7,24,65,.58);
        color: rgba(255,255,255,.76);
        font: 800 .6875rem/1 system-ui, sans-serif;
        letter-spacing:.05em;
        box-shadow:0 4px 12px rgba(0,0,0,.1);
        backdrop-filter:blur(8px);
        pointer-events:none;
      }
      @media (max-width: 520px) {
        .burr-app-version { right:7px; bottom:6px; opacity:.76; }
      }
    `;
    document.head.appendChild(style);
    document.documentElement.dataset.appVersion = APP_VERSION;
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
}
