const resultsScreen = document.querySelector("#screen-results");
const resultsPanel = resultsScreen?.querySelector(".results-panel");
const duelScoreboard = document.querySelector("#duelScoreboard");
const soloStats = document.querySelector("#soloStats");
const resultTitle = document.querySelector("#resultTitle");
const homeAvatar = document.querySelector("#homeUserInitial");

if (resultsScreen && resultsPanel && duelScoreboard && soloStats) {
  const scheduleEnhance = () => requestAnimationFrame(enhanceResultsIdentity);

  new MutationObserver(scheduleEnhance).observe(resultsScreen, {
    attributes: true,
    attributeFilter: ["class"]
  });

  [duelScoreboard, soloStats].forEach((target) => {
    new MutationObserver(scheduleEnhance).observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"]
    });
  });

  scheduleEnhance();
}

function enhanceResultsIdentity() {
  if (!resultsScreen?.classList.contains("active")) return;

  if (!soloStats?.classList.contains("hidden")) {
    enhanceSoloIdentity();
    resultsPanel?.classList.add("result-identity-v16");
    resultsPanel?.classList.remove("duel-results-v061");
    return;
  }

  if (!duelScoreboard?.classList.contains("hidden")) enhanceDuelIdentity();
}

function enhanceSoloIdentity() {
  const name = document.querySelector("#resultSoloName")?.textContent?.trim() || "Jogador";
  const avatar = document.querySelector("#resultSoloAvatar");
  syncAvatar(avatar, name, true);
  soloStats?.setAttribute("aria-label", `Desempenho de ${name}`);
}

function enhanceDuelIdentity() {
  const rows = [
    document.querySelector("#scorePlayerOne"),
    document.querySelector("#scorePlayerTwo")
  ].filter(Boolean);

  if (rows.length !== 2) return;

  if (rows.every((row) => row.querySelector(".duel-score-number"))) {
    rows.forEach((row) => {
      const avatar = row.querySelector(".result-player-avatar");
      const name = row.querySelector(".duel-player-name")?.textContent?.trim() || "Jogador";
      syncAvatar(avatar, name, avatar?.hasAttribute("data-local-avatar"));
    });
    resultsPanel?.classList.add("duel-results-v061", "result-identity-v16");
    return;
  }

  const parsedRows = rows.map(parseOriginalScoreRow);
  if (parsedRows.some((row) => !row)) return;

  const tied = /empate/i.test(resultTitle?.textContent || "");
  const sameScore = parsedRows[0].correct === parsedRows[1].correct;
  duelScoreboard.classList.toggle("is-tie", tied);

  rows.forEach((row, index) => {
    if (tied) row.classList.remove("winner");
    const data = parsedRows[index];
    const localPlayer = /\(você\)/i.test(data.name);
    const displayName = data.name.replace(/\s*\(você\)\s*/i, "").trim();
    const winner = row.classList.contains("winner");
    const status = tied ? "Empate" : winner ? (sameScore ? "Venceu no tempo" : "Vencedor") : "2º lugar";

    row.innerHTML = `
      <span class="result-player-avatar"${localPlayer ? " data-local-avatar" : ""} aria-hidden="true">${escapeHtml(getInitials(displayName))}</span>
      <strong class="duel-player-name" title="${escapeHtml(displayName)}">${escapeHtml(displayName)}</strong>
      <span class="duel-score-number">${data.correct}<span class="duel-score-total">/${data.total}</span></span>
      <span class="duel-score-label">acertos</span>
      <span class="duel-score-time">${escapeHtml(data.time)}</span>
      <span class="duel-player-status">${status}</span>
    `;

    syncAvatar(row.querySelector(".result-player-avatar"), displayName, localPlayer);
  });

  duelScoreboard.setAttribute(
    "aria-label",
    `Placar final: ${parsedRows[0].name}, ${parsedRows[0].correct} acertos; ${parsedRows[1].name}, ${parsedRows[1].correct} acertos.`
  );
  resultsPanel?.classList.add("duel-results-v061", "result-identity-v16");
}

function syncAvatar(target, name, localPlayer) {
  if (!target) return;
  const initials = getInitials(name);
  if (target.textContent !== initials) target.textContent = initials;

  if (localPlayer && homeAvatar?.classList.contains("has-photo") && homeAvatar.style.backgroundImage) {
    target.style.backgroundImage = homeAvatar.style.backgroundImage;
    target.classList.add("has-photo");
    return;
  }

  target.style.removeProperty("background-image");
  target.classList.remove("has-photo");
}

function getInitials(name) {
  const parts = String(name || "Jogador").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "J";
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts.at(-1).charAt(0) : "";
  return `${first}${last}`.toLocaleUpperCase("pt-BR");
}

function parseOriginalScoreRow(row) {
  if (!row) return null;

  if (row.querySelector(".duel-score-number")) {
    const name = row.querySelector(".duel-player-name")?.textContent?.trim();
    const scoreText = row.querySelector(".duel-score-number")?.textContent || "";
    const scoreMatch = scoreText.match(/(\d+)\s*\/\s*(\d+)/);
    return name && scoreMatch ? {
      name: row.querySelector("[data-local-avatar]") ? `${name} (você)` : name,
      correct: Number(scoreMatch[1]),
      total: Number(scoreMatch[2]),
      time: row.querySelector(".duel-score-time")?.textContent?.trim() || ""
    } : null;
  }

  const name = row.querySelector("strong")?.textContent?.trim();
  const spans = [...row.querySelectorAll(":scope > span")];
  const scoreText = spans[0]?.textContent?.trim() || "";
  const timeText = spans[1]?.textContent?.trim() || "";
  const scoreMatch = scoreText.match(/(\d+)\s*\/\s*(\d+)/);

  if (!name || !scoreMatch) return null;

  return {
    name,
    correct: Number(scoreMatch[1]),
    total: Number(scoreMatch[2]),
    time: timeText ? `Tempo total ${timeText}` : ""
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
