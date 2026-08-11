/* Burrquizzz — UI copy refinements + Home variations */

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
