// Hotfix v0.7431: evita que o modo solo fique preso em "JÁ".
// O app legado encerra a contagem com sleep(450). Neste ponto específico,
// usamos requestAnimationFrame para não depender de patches/timers globais.

const previousSetTimeout = window.setTimeout.bind(window);
const previousClearTimeout = window.clearTimeout.bind(window);
const rafTimers = new Map();
let nextRafTimerId = -7431000;

window.setTimeout = function burrquizzzSetTimeout(callback, delay = 0, ...args) {
  const countdown = document.querySelector("#screen-countdown");
  const countdownValue = document.querySelector("#countdownValue");
  const isSoloFinalCountdown =
    Number(delay) === 450 &&
    countdown?.classList.contains("active") &&
    String(countdownValue?.textContent || "").trim().toUpperCase() === "JÁ";

  if (!isSoloFinalCountdown) {
    return previousSetTimeout(callback, delay, ...args);
  }

  const timerId = nextRafTimerId--;
  let frames = 0;

  const tick = () => {
    if (!rafTimers.has(timerId)) return;
    frames += 1;

    // Mantém o "JÁ" visível por pelo menos dois frames e então libera
    // imediatamente a transição para a primeira pergunta.
    if (frames >= 2) {
      rafTimers.delete(timerId);
      if (typeof callback === "function") callback(...args);
      else Function(String(callback))();
      return;
    }

    const rafId = requestAnimationFrame(tick);
    rafTimers.set(timerId, rafId);
  };

  const rafId = requestAnimationFrame(tick);
  rafTimers.set(timerId, rafId);
  return timerId;
};

window.clearTimeout = function burrquizzzClearTimeout(timerId) {
  if (rafTimers.has(timerId)) {
    cancelAnimationFrame(rafTimers.get(timerId));
    rafTimers.delete(timerId);
    return;
  }
  previousClearTimeout(timerId);
};

document.documentElement.dataset.soloCountdownFix = "v0.7431";
