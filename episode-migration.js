const ENGINE_VERSION_KEY = "burrquizzzEpisodeEngineVersion";
const CURRENT_VERSION = "instant-rotation-v2";

if (localStorage.getItem(ENGINE_VERSION_KEY) !== CURRENT_VERSION) {
  localStorage.removeItem("burrquizzzNextEpisode");
  localStorage.setItem(ENGINE_VERSION_KEY, CURRENT_VERSION);
  document.documentElement.dataset.episodeEngineMigrated = "true";
}
