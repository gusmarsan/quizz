/* Burrquizzz v1.14 — UI copy refinements */

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
