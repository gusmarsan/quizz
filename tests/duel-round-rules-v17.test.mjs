import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDuelQuestionRound,
  canStartDuelRoom,
  calculateDuelOutcome,
  getConfiguredDuelQuestionCount,
  getDuelResultAction
} from "../duel-round-rules-v17.js";

const questions = (count) => Array.from({ length: count }, (_, index) => ({ id: `q-${index}` }));
const answer = (correct, elapsedMs) => ({ correct, elapsedMs });
const answers = (entries) => Object.fromEntries(entries.map((entry, index) => [index, entry]));

function room(count, firstAnswers, secondAnswers, extra = {}) {
  return {
    questionCount: count,
    roundConfigured: true,
    questions: questions(count),
    player1: { uid: "p1", name: "Jogador 1" },
    player2: { uid: "p2", name: "Jogador 2" },
    answers: {
      p1: answers(firstAnswers),
      p2: answers(secondAnswers)
    },
    ...extra
  };
}

test("aceita rodadas configuradas de 4 e 16 perguntas", () => {
  assert.equal(getConfiguredDuelQuestionCount(room(4, [], [])), 4);
  assert.equal(getConfiguredDuelQuestionCount(room(16, [], [])), 16);
});

test("rejeita rodada pendente ou com quantidade divergente", () => {
  assert.equal(getConfiguredDuelQuestionCount({ roundConfigured: false, questions: [] }), 0);
  assert.equal(getConfiguredDuelQuestionCount({ questionCount: 4, roundConfigured: true, questions: questions(3) }), 0);
});

test("mantém compatibilidade com salas antigas de 16 perguntas", () => {
  assert.equal(getConfiguredDuelQuestionCount({ questions: questions(16) }), 16);
});

test("só inicia quando jogador 2 e configuração válida coexistem", () => {
  const configured = room(4, [], []);
  configured.status = "waiting";
  assert.equal(canStartDuelRoom(configured), true);
  assert.equal(canStartDuelRoom({ ...configured, player2: null }), false);
  assert.equal(canStartDuelRoom({ ...configured, roundConfigured: false }), false);
  assert.equal(canStartDuelRoom({ ...configured, status: "playing" }), false);
});

test("monta exatamente 4 ou 16 perguntas e prioriza as ainda não usadas", () => {
  const bank = Array.from({ length: 20 }, (_, index) => ({
    id: `bank-${index}`,
    type: "multiple_choice",
    prompt: `Pergunta ${index}`,
    options: ["A", "B", "C", "D"],
    correctIndex: 0
  }));

  const quick = buildDuelQuestionRound(bank, 4, [], () => .5, "test");
  const normal = buildDuelQuestionRound(bank, 16, quick, () => .5, "test");
  assert.equal(quick.length, 4);
  assert.equal(normal.length, 16);
  assert.equal(normal.some((question) => quick.some((used) => used.id === question.id)), false);
});

test("mais acertos vence", () => {
  const outcome = calculateDuelOutcome(room(4,
    [answer(true, 900), answer(true, 900), answer(true, 900), answer(false, 900)],
    [answer(true, 500), answer(true, 500), answer(false, 500), answer(false, 500)]
  ));
  assert.equal(outcome.winnerUid, "p1");
  assert.equal(outcome.loserUid, "p2");
  assert.equal(outcome.results[0].correct, 3);
});

test("menor tempo vence quando os acertos são iguais", () => {
  const outcome = calculateDuelOutcome(room(4,
    [answer(true, 1200), answer(true, 1200), answer(false, 1200), answer(false, 1200)],
    [answer(true, 800), answer(true, 800), answer(false, 800), answer(false, 800)]
  ));
  assert.equal(outcome.winnerUid, "p2");
  assert.equal(outcome.tied, false);
});

test("empate exige acertos e tempo exatamente iguais", () => {
  const shared = [answer(true, 800), answer(true, 900), answer(false, 700), answer(false, 600)];
  const outcome = calculateDuelOutcome(room(4, shared, shared));
  assert.equal(outcome.tied, true);
  assert.equal(outcome.winnerUid, null);
  assert.equal(outcome.loserUid, null);
});

test("somente o perdedor pede revanche e o vencedor aceita", () => {
  const outcome = calculateDuelOutcome(room(4,
    [answer(true, 700), answer(true, 700), answer(true, 700), answer(false, 700)],
    [answer(true, 700), answer(false, 700), answer(false, 700), answer(false, 700)]
  ));

  assert.equal(getDuelResultAction(outcome, {}, "p1"), "new-duel");
  assert.equal(getDuelResultAction(outcome, {}, "p2"), "request-rematch");
  assert.equal(getDuelResultAction(outcome, { p2: true }, "p1"), "accept-rematch");
  assert.equal(getDuelResultAction(outcome, { p2: true }, "p2"), "waiting-rematch");
});

test("em empate ambos seguem para um novo duelo", () => {
  const shared = [answer(true, 800), answer(false, 800), answer(false, 800), answer(false, 800)];
  const outcome = calculateDuelOutcome(room(4, shared, shared));
  assert.equal(getDuelResultAction(outcome, {}, "p1"), "new-duel");
  assert.equal(getDuelResultAction(outcome, {}, "p2"), "new-duel");
});
