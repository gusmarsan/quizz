import { QUESTIONS as DUEL_SOURCE_QUESTIONS } from "./questions.js?duel-bank=0.7432";

// Banco exclusivo do modo em dupla.
// A query string força uma instância separada de questions.js, portanto o duelo
// não compartilha o array que o motor do solo reduz ao episódio ativo de 16 perguntas.
// Isso mantém os dois modos independentes: o solo pode rotacionar seu episódio sem
// alterar o estoque usado para criar salas e revanches.
export const DUEL_QUESTIONS = DUEL_SOURCE_QUESTIONS.map((question) =>
  JSON.parse(JSON.stringify(question))
);
