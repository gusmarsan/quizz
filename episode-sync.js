const EPISODE_STORAGE_KEY = "burrquizzzCurrentEpisode";

let currentEpisode = readEpisode();

window.addEventListener("burrquizzz:episode-ready", (event) => {
  currentEpisode = event.detail || readEpisode();
});

const observer = new MutationObserver(() => {
  const episode = currentEpisode || readEpisode();

  const overlay = document.querySelector(".burr-episode-overlay");
  if (overlay && !overlay.hidden) applyEpisodeIntro(overlay, episode);

  const resultsScreen = document.querySelector("#screen-results");
  if (resultsScreen?.classList.contains("active")) applyEpisodeOutro(resultsScreen, episode);
});

observer.observe(document.documentElement, {
  subtree: true,
  attributes: true,
  attributeFilter: ["hidden", "class"]
});

function readEpisode() {
  try {
    const stored = JSON.parse(localStorage.getItem(EPISODE_STORAGE_KEY) || "null");
    return stored && typeof stored === "object" ? stored : null;
  } catch {
    return null;
  }
}

function applyEpisodeIntro(overlay, episode) {
  if (!episode) return;

  const number = overlay.querySelector("#burrEpisodeNumber");
  const title = overlay.querySelector("#burrEpisodeTitle");
  const host = overlay.querySelector("#burrEpisodeHost");
  const opening = overlay.querySelector("#burrEpisodeOpening");

  if (number) number.textContent = episodeLabel(episode.id);
  if (title && episode.title) title.textContent = episode.title;
  if (host && episode.host) host.textContent = episode.host;
  if (opening) {
    const parts = [episode.subtitle, episode.intro].filter(Boolean);
    opening.textContent = parts.join(" — ");
  }
}

function applyEpisodeOutro(resultsScreen, episode) {
  if (!episode?.outro) return;

  const subtitle = resultsScreen.querySelector("#resultSubtitle");
  if (!subtitle) return;

  const originalResult = subtitle.dataset.resultSummary || subtitle.textContent.trim();
  if (originalResult && !subtitle.dataset.resultSummary) {
    subtitle.dataset.resultSummary = originalResult;
  }

  subtitle.innerHTML = "";

  const summary = document.createElement("span");
  summary.className = "burr-result-summary";
  summary.textContent = subtitle.dataset.resultSummary || originalResult;

  const outro = document.createElement("strong");
  outro.className = "burr-episode-outro";
  outro.textContent = episode.outro;

  subtitle.append(summary, outro);
  ensureOutroStyles();
}

function ensureOutroStyles() {
  if (document.querySelector("#burrEpisodeOutroStyles")) return;

  const style = document.createElement("style");
  style.id = "burrEpisodeOutroStyles";
  style.textContent = `
    .burr-result-summary,
    .burr-episode-outro {
      display: block;
    }

    .burr-episode-outro {
      max-width: 520px;
      margin: 18px auto 0;
      padding: 16px 18px;
      border-radius: 16px;
      background: rgba(17, 61, 150, .08);
      font-size: 1.04rem;
      line-height: 1.45;
    }
  `;
  document.head.appendChild(style);
}

function episodeLabel(id) {
  const digits = String(id || "").replace(/\D/g, "").slice(-3);
  if (digits) return `EPISÓDIO ${digits.padStart(3, "0")}`;
  return `EPISÓDIO ${String(Math.floor(100 + Math.random() * 900))}`;
}
