const APP_VERSION = "1.8";

mountVersion();

function mountVersion() {
  const boot = () => {
    if (document.querySelector("#burrAppVersion")) return;

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
        color: rgba(255,255,255,.72);
        font: 800 .62rem/1 system-ui, sans-serif;
        letter-spacing: .05em;
        box-shadow: 0 4px 14px rgba(0,0,0,.12);
        backdrop-filter: blur(8px);
        pointer-events: none;
      }
      @media (max-width: 520px) {
        .burr-app-version { right: 7px; bottom: 6px; opacity: .72; }
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
