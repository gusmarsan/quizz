const SOLO_SECONDS = 18;
const DUEL_SECONDS = 30;

boot();

function boot() {
  const timerTrack = document.querySelector(".timer-track");
  const timerBar = document.querySelector("#timerBar");
  const answersArea = document.querySelector("#answersArea");

  if (timerTrack && timerBar) {
    prepareTimer(timerTrack, timerBar);
  }

  if (answersArea) {
    syncMatchLabels(answersArea);
    new MutationObserver(() => syncMatchLabels(answersArea)).observe(answersArea, {
      childList: true,
      subtree: true
    });
  }
}

function prepareTimer(track, bar) {
  track.setAttribute("role", "progressbar");
  track.setAttribute("aria-label", "Tempo restante da pergunta");
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", "100");
  track.setAttribute("aria-valuenow", "100");
  track.setAttribute("aria-valuetext", `${getTotalSeconds()} segundos restantes`);
  bar.setAttribute("aria-hidden", "true");

  let lastSecond = null;
  let lastPercent = null;

  const sync = () => {
    const ratio = readScaleX(bar.style.transform);
    const percent = Math.max(0, Math.min(100, Math.round(ratio * 100)));
    const totalSeconds = getTotalSeconds();
    const seconds = Math.max(0, Math.min(totalSeconds, Math.ceil(ratio * totalSeconds)));

    if (percent !== lastPercent) {
      track.setAttribute("aria-valuenow", String(percent));
      lastPercent = percent;
    }

    if (seconds !== lastSecond) {
      const unit = seconds === 1 ? "segundo restante" : "segundos restantes";
      track.setAttribute("aria-valuetext", `${seconds} ${unit}`);
      lastSecond = seconds;
    }
  };

  new MutationObserver(sync).observe(bar, {
    attributes: true,
    attributeFilter: ["style"]
  });

  const gameScreen = document.querySelector("#screen-game");
  if (gameScreen) {
    new MutationObserver(() => {
      if (!gameScreen.classList.contains("active")) return;
      lastSecond = null;
      lastPercent = null;
      sync();
    }).observe(gameScreen, {
      attributes: true,
      attributeFilter: ["class"]
    });
  }

  sync();
}

function readScaleX(transform) {
  const match = String(transform || "").match(/scaleX\(([-+]?\d*\.?\d+)\)/i);
  if (!match) return 1;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : 1;
}

function getTotalSeconds() {
  return getRoomCode() ? DUEL_SECONDS : SOLO_SECONDS;
}

function getRoomCode() {
  return String(new URL(location.href).searchParams.get("room") || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

function syncMatchLabels(scope) {
  scope.querySelectorAll(".match-row").forEach((row, index) => {
    const left = row.querySelector(".match-left");
    const select = row.querySelector("select");
    if (!left || !select) return;

    if (!left.id) {
      left.id = `match-left-${index}-${uniqueSuffix(row)}`;
    }

    select.setAttribute("aria-labelledby", left.id);
    select.removeAttribute("aria-label");
  });
}

function uniqueSuffix(row) {
  const text = String(row.querySelector(".match-left")?.textContent || "item");
  let hash = 2166136261;
  for (const character of text) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
