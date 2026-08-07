// Limpeza única dos conteúdos antigos armazenados pelo próprio fluxo atual.
// Não altera mecânica, histórico jogado, tempo, salas, pontuação ou regras antirrepetição.
const RESET_MARKER = "burrquizzzQuestionBankResetV240";

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
