import { QUESTIONS } from "./questions.js";

const fixes = {
  q021: {
    options: ["Morcego", "Ornitorrinco", "Capivara", "Tamanduá"],
    correctIndex: 1
  },
  q027: {
    correctIndex: 2
  }
};

QUESTIONS.forEach((question) => {
  const fix = fixes[question.id];
  if (!fix) return;
  Object.assign(question, fix);
});
