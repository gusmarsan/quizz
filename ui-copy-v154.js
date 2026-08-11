/* Burrquizzz — UI copy refinements + Home variations.
   Release metadata comes from release-gate.js; no release number is hardcoded here. */

const RELEASE_VERSION = window.BurrquizzzReleaseGate?.currentVersion || window.BURRQUIZZZ_VERSION || "current";

const appendStylesheetOnce = (selector, href, dataKey) => {
  if (document.querySelector(selector)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  if (dataKey) link.dataset[dataKey] = "true";
  document.head.appendChild(link);
};

appendStylesheetOnce(
  'link[data-burr-lobby-v15], link[href*="lobby-v15.css"]',
  `./lobby-v15.css?v=${encodeURIComponent(RELEASE_VERSION)}`,
  "burrLobbyV15"
);

appendStylesheetOnce(
  'link[data-burr-lobby-players-v15], link[href*="lobby-players-v15.css"]',
  `./lobby-players-v15.css?v=${encodeURIComponent(RELEASE_VERSION)}`,
  "burrLobbyPlayersV15"
);

function applyReleaseMetadata() {
  const version = window.BurrquizzzReleaseGate?.currentVersion || window.BURRQUIZZZ_VERSION || RELEASE_VERSION;
  const badge = document.querySelector("#burrAppVersion");
  if (badge) {
    badge.textContent = `v${version}`;
    badge.title = `Burrquizzz versão ${version}`;
    badge.setAttribute("aria-label", `Versão ${version}`);
  }

  const manifest = document.querySelector('link[rel="manifest"]');
  if (manifest) manifest.href = `./manifest.webmanifest?v=${encodeURIComponent(version)}`;

  const pngIcon = document.querySelector('link[rel="icon"][type="image/png"]');
  if (pngIcon) pngIcon.href = `./icons/icon-192.png?v=${encodeURIComponent(version)}`;

  const svgIcon = document.querySelector('link[rel="icon"][type="image/svg+xml"]');
  if (svgIcon) svgIcon.href = `./icons/burrquizzz-icon.svg?v=${encodeURIComponent(version)}`;

  const appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
  if (appleIcon) appleIcon.href = `./icons/apple-touch-icon.png?v=${encodeURIComponent(version)}`;
}

applyReleaseMetadata();
window.BurrquizzzReleaseGate?.ready?.then(() => applyReleaseMetadata()).catch(() => {});
window.addEventListener("load", () => window.setTimeout(applyReleaseMetadata, 80), { once: true });

const answersArea = document.querySelector("#answersArea");

function normalizeAnswerActionCopy(scope = document) {
  scope.querySelectorAll?.("#textSubmitButton, #matchSubmitButton").forEach((button) => {
    if (button.textContent !== "RESPONDER") button.textContent = "RESPONDER";
  });
}

normalizeAnswerActionCopy();

if (answersArea) {
  const observer = new MutationObserver(() => normalizeAnswerActionCopy(answersArea));
  observer.observe(answersArea, { childList: true, subtree: true });
}

const HOME_TAGLINES = [
  ["Cabeça afiada.", "Direito de se gabar."],
  ["Perguntas na mesa.", "Glória em jogo."],
  ["Teste a memória.", "Exiba a moral."],
  ["Curiosidades soltas.", "Ego em alta."],
  ["Vale saber tudo.", "Vale se achar um pouco."]
];

const HOME_TAGLINE_INDEX_KEY = "burrquizzz-home-tagline-index";
const homeScreen = document.querySelector("#screen-home");
const homeTagline = document.querySelector("#screen-home .real-home__tagline");

function renderHomeTagline(index) {
  if (!homeTagline) return;
  const [firstLine, secondLine] = HOME_TAGLINES[index];
  homeTagline.replaceChildren(
    document.createTextNode(firstLine),
    document.createElement("br"),
    document.createTextNode(secondLine)
  );
}

function advanceHomeTagline() {
  if (!homeTagline) return;
  const saved = Number.parseInt(localStorage.getItem(HOME_TAGLINE_INDEX_KEY) ?? "-1", 10);
  const next = Number.isInteger(saved) ? (saved + 1) % HOME_TAGLINES.length : 0;
  localStorage.setItem(HOME_TAGLINE_INDEX_KEY, String(next));
  renderHomeTagline(next);
}

if (homeScreen && homeTagline) {
  let wasActive = homeScreen.classList.contains("active");
  advanceHomeTagline();

  const homeObserver = new MutationObserver(() => {
    const isActive = homeScreen.classList.contains("active");
    if (isActive && !wasActive) advanceHomeTagline();
    wasActive = isActive;
  });

  homeObserver.observe(homeScreen, { attributes: true, attributeFilter: ["class"] });
}

/* Keep the Home crowd visibly raised. */
const homeCompositionStyle = document.createElement("style");
homeCompositionStyle.dataset.burrHomeComposition = "raised-crowd-v2";
homeCompositionStyle.textContent = `
  #screen-home .real-home__background {
    background-position: center 64% !important;
    transform: translate3d(0, -36px, 0) scale(1.10) !important;
    transform-origin: center center !important;
  }

  @media (max-width: 680px) {
    #screen-home .real-home__background {
      background-position: 54% 60% !important;
      transform: translate3d(0, -52px, 0) scale(1.14) !important;
    }
  }

  @media (max-width: 680px) and (max-height: 760px) {
    #screen-home .real-home__background {
      transform: translate3d(0, -46px, 0) scale(1.14) !important;
    }
  }
`;
document.head.appendChild(homeCompositionStyle);
