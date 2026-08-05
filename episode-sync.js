const EPISODE_STORAGE_KEY = "burrquizzzCurrentEpisode";

let currentEpisode = readEpisode();

window.addEventListener("burrquizzz:episode-ready", (event) => {
  currentEpisode = event.detail || readEpisode();
});

const observer = new MutationObserver(() => {
  const overlay = document.querySelector(".burr-episode-overlay");
  if (!overlay || overlay.hidden) return;
  applyEpisode(overlay, currentEpisode || readEpisode());
});

observer.observe(document.documentElement, {
  subtree: true,
  attributes: true,
  attributeFilter: ["hidden"]
});

function readEpisode() {
  try {
    const stored = JSON.parse(localStorage.getItem(EPISODE_STORAGE_KEY) || "null");
    return stored && typeof stored === "object" ? stored : null;
  } catch {
    return null;
  }
}

function applyEpisode(overlay, episode) {
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

function episodeLabel(id) {
  const digits = String(id || "").replace(/\D/g, "").slice(-3);
  if (digits) return `EPISÓDIO ${digits.padStart(3, "0")}`;
  return `EPISÓDIO ${String(Math.floor(100 + Math.random() * 900))}`;
}
