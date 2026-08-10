const BURRQUIZZZ_VERSION = "1.1";

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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", refreshReleaseMetadata, { once: true });
} else {
  refreshReleaseMetadata();
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`./sw.js?v=${BURRQUIZZZ_VERSION}`, { scope: "./", updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch((error) => console.warn("PWA: service worker não pôde ser registrado.", error));
  });
}
