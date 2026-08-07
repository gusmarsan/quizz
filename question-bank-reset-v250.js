// Limpeza única para a entrada do novo banco visual v2.5.0.
// Remove apenas episódios/estoques montados com o banco anterior.
// Preserva histórico jogado, nome, Firebase, pontuação e demais preferências.
const RESET_MARKER = "burrquizzzQuestionBankResetV250";

if (localStorage.getItem(RESET_MARKER) !== "done") {
  [
    "burrquizzzCurrentEpisode",
    "burrquizzzNextEpisode",
    "burrquizzzCurrentEpisodeV3",
    "burrquizzzNextEpisodeV3",
    "burrquizzzQuestionPoolV3",
    "burrquizzzCurrentEpisodeV4",
    "burrquizzzNextEpisodeV4",
    "burrquizzzQuestionPoolV4",
    "burrquizzzCurrentEpisodeV5",
    "burrquizzzNextEpisodeV5",
    "burrquizzzQuestionPoolV5"
  ].forEach((key) => localStorage.removeItem(key));

  localStorage.setItem(RESET_MARKER, "done");
}
