import { QUESTIONS } from "./questions.js";

// Snapshot do banco completo para o duelo.
// Este módulo é carregado antes do motor offline-first reduzir QUESTIONS
// ao episódio de 16 perguntas usado pelo solo.
export const DUEL_QUESTIONS = QUESTIONS.map((question) =>
  JSON.parse(JSON.stringify(question))
);
