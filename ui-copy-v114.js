/* Burrquizzz — UI copy refinements + Home variations + v1.5 lobby */

const RELEASE_VERSION = "1.5";

/* v1.5: load the redesigned duel lobby after legacy styles so it wins the cascade. */
if (!document.querySelector('link[data-burr-lobby-v15]')) {
  const lobbyStyles = document.createElement("link");
  lobbyStyles.rel = "stylesheet";
  lobbyStyles.href = `./lobby-v15.css?v=${RELEASE_VERSION}`;
  lobbyStyles.dataset.burrLobbyV15 = "true";
  document.head.appendChild(lobbyStyles);
}

function applyReleaseMetadata() {
  const badge = document.querySelector("#burrAppVersion");
  if (badge) {
    if (badge.textContent !== `v${RELEASE_VERSION}`) badge.textContent = `v${RELEASE_VERSION}`;
    if (badge.title !== `Burrquizzz versão ${RELEASE_VERSION}`) badge.title = `Burrquizzz versão ${RELEASE_VERSION}`;
    if (badge.getAttribute("aria-label") !== `Versão ${RELEASE_VERSION}`) badge.setAttribute("aria-label", `Versão ${RELEASE_VERSION}`);
  }

  const manifest = document.querySelector('link[rel="manifest"]');
  if (manifest) manifest.href = `./manifest.webmanifest?v=${RELEASE_VERSION}`;

  const pngIcon = document.querySelector('link[rel="icon"][type="image/png"]');
  if (pngIcon) pngIcon.href = `./icons/icon-192.png?v=${RELEASE_VERSION}`;

  const svgIcon = document.querySelector('link[rel="icon"][type="image/svg+xml"]');
  if (svgIcon) svgIcon.href = `./icons/burrquizzz-icon.svg?v=${RELEASE_VERSION}`;

  const appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
  if (appleIcon) appleIcon.href = `./icons/apple-touch-icon.png?v=${RELEASE_VERSION}`;
}

applyReleaseMetadata();
window.addEventListener("load", () => window.setTimeout(applyReleaseMetadata, 80), { once: true });

const releaseBadge = document.querySelector("#burrAppVersion");
if (releaseBadge) {
  const releaseObserver = new MutationObserver(applyReleaseMetadata);
  releaseObserver.observe(releaseBadge, { childList: true, subtree: true, attributes: true, attributeFilter: ["title", "aria-label"] });
}

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

/* Home: five rotating opening lines. The current position is persisted so the
   sequence keeps moving even after closing and reopening the installed PWA. */
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

/* Home background: move the actual illustration layer upward. Using transform
   makes the change visible regardless of how background-size: cover crops the
   source image. The scale keeps the lower edge covered after the translation. */
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
