const startButton = document.querySelector("#startSoloButton");

// A rotação agora é preparada por episode-engine.js antes do clique. Este
// arquivo permanece apenas para neutralizar estados antigos armazenados em cache.
function restoreStartButton() {
  if (!startButton) return;
  if (/buscando|preparando|carregando/i.test(startButton.textContent || "")) {
    startButton.textContent = "Começar";
  }
  startButton.disabled = false;
}

restoreStartButton();

if (startButton) {
  new MutationObserver(restoreStartButton).observe(startButton, {
    attributes: true,
    childList: true,
    characterData: true,
    subtree: true
  });
}
