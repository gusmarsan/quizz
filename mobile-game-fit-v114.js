/* Burrquizzz v1.14 — viewport scroll reset for long mobile questions */

const gameScreen = document.querySelector("#screen-game");
const questionNumber = document.querySelector("#questionNumber");

function resetGameScroll() {
  if (!gameScreen) return;
  gameScreen.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

if (gameScreen && questionNumber) {
  const observer = new MutationObserver(() => {
    requestAnimationFrame(resetGameScroll);
  });

  observer.observe(questionNumber, {
    childList: true,
    characterData: true,
    subtree: true
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && gameScreen.classList.contains("active")) {
      requestAnimationFrame(resetGameScroll);
    }
  });
}
