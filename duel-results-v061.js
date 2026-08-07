const resultsScreen = document.querySelector("#screen-results");
const resultsPanel = resultsScreen?.querySelector(".results-panel");
const duelScoreboard = document.querySelector("#duelScoreboard");
const resultTitle = document.querySelector("#resultTitle");

if (resultsScreen && resultsPanel && duelScoreboard) {
  const scheduleEnhance = () => requestAnimationFrame(enhanceDuelResults);

  new MutationObserver(scheduleEnhance).observe(resultsScreen, {
    attributes: true,
    attributeFilter: ["class"]
  });

  new MutationObserver(scheduleEnhance).observe(duelScoreboard, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"]
  });

  scheduleEnhance();
}

function enhanceDuelResults() {
  if (!resultsScreen?.classList.contains("active")) return;
  if (duelScoreboard?.classList.contains("hidden")) {
    resultsPanel?.classList.remove("duel-results-v061");
    return;
  }

  const rows = [
    document.querySelector("#scorePlayerOne"),
    document.querySelector("#scorePlayerTwo")
  ].filter(Boolean);

  if (rows.length !== 2) return;

  const parsedRows = rows.map(parseOriginalScoreRow);
  if (parsedRows.some((row) => !row)) return;

  const tied = /empate/i.test(resultTitle?.textContent || "");
  const sameScore = parsedRows[0].correct === parsedRows[1].correct;

  rows.forEach((row, index) => {
    if (row.querySelector(".duel-score-number")) return;

    if (tied) row.classList.remove("winner");

    const status = tied
      ? "Empate"
      : index === 0
        ? (sameScore ? "Venceu no tempo" : "Vencedor")
        : "2º lugar";

    const data = parsedRows[index];
    row.innerHTML = `
      <span class="duel-player-status">${status}</span>
      <strong class="duel-player-name">${escapeHtml(data.name)}</strong>
      <span class="duel-score-number">${data.correct}<span class="duel-score-total">/${data.total}</span></span>
      <span class="duel-score-label">acertos</span>
      <span class="duel-score-time">${escapeHtml(data.time)}</span>
    `;
  });

  duelScoreboard.setAttribute(
    "aria-label",
    `Placar final: ${parsedRows[0].name}, ${parsedRows[0].correct} acertos; ${parsedRows[1].name}, ${parsedRows[1].correct} acertos.`
  );
  resultsPanel.classList.add("duel-results-v061");
}

function parseOriginalScoreRow(row) {
  if (!row) return null;

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
