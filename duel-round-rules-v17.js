export const DUEL_QUESTION_COUNTS = Object.freeze([4, 16]);
export const MAX_DUEL_QUESTIONS = 16;

export function isValidDuelQuestionCount(value) {
  return DUEL_QUESTION_COUNTS.includes(Number(value));
}

export function duelModeForCount(value) {
  return Number(value) === 4 ? "quick" : Number(value) === 16 ? "normal" : null;
}

export function duelQuestionIdentity(question) {
  return String(
    typeof question === "string" ? question : question?.id || question?.prompt || ""
  );
}

export function buildDuelQuestionRound(
  questionBank,
  questionCount,
  previousQuestions = [],
  random = Math.random,
  idPrefix = "duel"
) {
  if (!isValidDuelQuestionCount(questionCount)) return [];

  const previousIds = new Set(previousQuestions.map(duelQuestionIdentity));
  const available = (Array.isArray(questionBank) ? questionBank : []).filter((question) =>
    question &&
    (question.type === "multiple_choice" || question.type === "image_choice" || !question.type) &&
    Array.isArray(question.options) &&
    question.options.length === 4 &&
    Number.isInteger(Number(question.correctIndex)) &&
    Number(question.correctIndex) >= 0 &&
    Number(question.correctIndex) < 4
  );

  const shuffle = (items) => {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
  };

  const fresh = shuffle(available.filter((question) => !previousIds.has(duelQuestionIdentity(question))));
  const fallback = shuffle(available.filter((question) => previousIds.has(duelQuestionIdentity(question))));

  return [...fresh, ...fallback].slice(0, questionCount).map((question, index) => ({
    id: String(question.id || `${idPrefix}-${Date.now()}-${index}`),
    type: question.type === "image_choice" ? "image_choice" : "multiple_choice",
    category: String(question.category || "Burrquizzz"),
    difficulty: String(question.difficulty || "media"),
    prompt: String(question.prompt || ""),
    options: question.options.map(String),
    correctIndex: Number(question.correctIndex),
    explanation: String(question.explanation || ""),
    image: String(question.image || ""),
    imageCredit: String(question.imageCredit || ""),
    supportText: String(question.supportText || "")
  }));
}

export function getConfiguredDuelQuestionCount(roomData) {
  const questions = Array.isArray(roomData?.questions) ? roomData.questions : [];
  const explicitCount = Number(roomData?.questionCount);

  if (
    roomData?.roundConfigured !== false &&
    isValidDuelQuestionCount(explicitCount) &&
    questions.length === explicitCount
  ) {
    return explicitCount;
  }

  // Salas anteriores à v1.7 não tinham configuração explícita e sempre
  // carregavam 16 perguntas. Elas continuam válidas durante a transição.
  if (
    roomData?.roundConfigured === undefined &&
    roomData?.questionCount === undefined &&
    questions.length === 16
  ) {
    return 16;
  }

  return 0;
}

export function isDuelRoundConfigured(roomData) {
  return getConfiguredDuelQuestionCount(roomData) > 0;
}

export function canStartDuelRoom(roomData) {
  return Boolean(
    roomData?.status === "waiting" &&
    roomData?.player2?.uid &&
    isDuelRoundConfigured(roomData)
  );
}

export function calculateDuelOutcome(roomData, questionMs = 30000) {
  const questionCount = getConfiguredDuelQuestionCount(roomData);
  const players = [roomData?.player1, roomData?.player2].filter((player) => player?.uid);
  if (!questionCount || players.length !== 2) return null;

  const results = players.map((player) => {
    const answers = roomData?.answers?.[player.uid] || {};
    const entries = Array.from({ length: questionCount }, (_, index) => answers[index]).filter(Boolean);
    const correct = entries.filter((answer) => answer?.correct).length;
    const answeredTime = entries.reduce(
      (sum, answer) => sum + Number(answer?.elapsedMs || questionMs),
      0
    );
    const missing = Math.max(0, questionCount - entries.length);

    return {
      uid: player.uid,
      name: player.name || "Jogador",
      correct,
      time: answeredTime + missing * questionMs
    };
  });

  results.sort((first, second) => second.correct - first.correct || first.time - second.time);
  const tied = results[0].correct === results[1].correct && results[0].time === results[1].time;

  return {
    questionCount,
    results,
    tied,
    winnerUid: tied ? null : results[0].uid,
    loserUid: tied ? null : results[1].uid
  };
}

export function getDuelResultAction(outcome, rematchRequests, uid) {
  if (!outcome || !outcome.results.some((result) => result.uid === uid)) return null;
  if (outcome.tied) return "new-duel";

  const loserRequested = Boolean(
    outcome.loserUid && rematchRequests?.[outcome.loserUid] === true
  );

  if (uid === outcome.loserUid) return loserRequested ? "waiting-rematch" : "request-rematch";
  if (uid === outcome.winnerUid) return loserRequested ? "accept-rematch" : "new-duel";
  return null;
}
