export const DUEL_QUESTION_COUNTS = Object.freeze([4, 16]);
export const MAX_DUEL_QUESTIONS = 16;

const DUEL_QUESTION_CYCLE_STORAGE_KEY = "quizDuelQuestionCycleV2";

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

function isEligibleDuelQuestion(question) {
  return Boolean(
    question &&
    (question.type === "multiple_choice" || question.type === "image_choice" || !question.type) &&
    Array.isArray(question.options) &&
    question.options.length === 4 &&
    Number.isInteger(Number(question.correctIndex)) &&
    Number(question.correctIndex) >= 0 &&
    Number(question.correctIndex) < 4
  );
}

function uniqueQuestionIds(items) {
  const ids = [];
  const seen = new Set();

  for (const item of Array.isArray(items) ? items : []) {
    const id = duelQuestionIdentity(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }

  return ids;
}

function canUseLocalStorage() {
  return typeof localStorage !== "undefined";
}

function loadDuelQuestionCycle() {
  if (!canUseLocalStorage()) return { cycleIds: [], recentIds: [] };

  try {
    const stored = JSON.parse(localStorage.getItem(DUEL_QUESTION_CYCLE_STORAGE_KEY) || "null");
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
      return { cycleIds: [], recentIds: [] };
    }

    return {
      cycleIds: uniqueQuestionIds(stored.cycleIds),
      recentIds: uniqueQuestionIds(stored.recentIds).slice(-MAX_DUEL_QUESTIONS)
    };
  } catch {
    return { cycleIds: [], recentIds: [] };
  }
}

function saveDuelQuestionCycle(state) {
  if (!canUseLocalStorage()) return;

  try {
    localStorage.setItem(DUEL_QUESTION_CYCLE_STORAGE_KEY, JSON.stringify({
      cycleIds: uniqueQuestionIds(state?.cycleIds),
      recentIds: uniqueQuestionIds(state?.recentIds).slice(-MAX_DUEL_QUESTIONS)
    }));
  } catch {
    // O duelo continua funcionando mesmo se o armazenamento local estiver indisponível.
  }
}

function rememberPlayedDuelRound(roundQuestions) {
  const selectedIds = uniqueQuestionIds(roundQuestions);
  if (!selectedIds.length || !canUseLocalStorage()) return;

  const state = loadDuelQuestionCycle();
  const cycle = [...state.cycleIds];
  const known = new Set(cycle);

  selectedIds.forEach((id) => {
    if (known.has(id)) return;
    known.add(id);
    cycle.push(id);
  });

  saveDuelQuestionCycle({
    cycleIds: cycle,
    recentIds: selectedIds
  });
}

export function buildDuelQuestionRound(
  questionBank,
  questionCount,
  previousQuestions = [],
  random = Math.random,
  idPrefix = "duel"
) {
  if (!isValidDuelQuestionCount(questionCount)) return [];

  const available = (Array.isArray(questionBank) ? questionBank : []).filter(isEligibleDuelQuestion);
  if (available.length < questionCount) return [];

  const availableIds = new Set(available.map(duelQuestionIdentity));
  const persisted = loadDuelQuestionCycle();
  const persistedCycleIds = persisted.cycleIds.filter((id) => availableIds.has(id));
  const explicitPreviousIds = uniqueQuestionIds(previousQuestions).filter((id) => availableIds.has(id));
  const recentIds = uniqueQuestionIds([
    ...persisted.recentIds,
    ...explicitPreviousIds
  ]).filter((id) => availableIds.has(id));

  let cycleIds = uniqueQuestionIds([...persistedCycleIds, ...explicitPreviousIds]);
  let usedIds = new Set(cycleIds);
  let fresh = available.filter((question) => !usedIds.has(duelQuestionIdentity(question)));

  // Quando todo o banco já passou, inicia um novo ciclo mantendo a rodada mais
  // recente bloqueada. Assim o ciclo recomeça sem repetir imediatamente o que
  // acabou de aparecer.
  if (fresh.length === 0 && usedIds.size) {
    cycleIds = [...recentIds];
    usedIds = new Set(cycleIds);
    fresh = available.filter((question) => !usedIds.has(duelQuestionIdentity(question)));
  }

  const shuffle = (items) => {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
  };

  const shuffledFresh = shuffle(fresh);
  const freshSelected = shuffledFresh.slice(0, questionCount);
  const stillNeeded = questionCount - freshSelected.length;

  let fallbackSelected = [];
  if (stillNeeded > 0) {
    const recentBlock = new Set(recentIds);
    const olderUsed = shuffle(
      available.filter((question) => {
        const id = duelQuestionIdentity(question);
        return usedIds.has(id) && !recentBlock.has(id);
      })
    );
    const recentUsed = shuffle(
      available.filter((question) => recentBlock.has(duelQuestionIdentity(question)))
    );
    fallbackSelected = [...olderUsed, ...recentUsed].slice(0, stillNeeded);
  }

  const rawSelected = [...freshSelected, ...fallbackSelected];
  if (rawSelected.length !== questionCount) return [];

  return rawSelected.map((question, index) => ({
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
  let configuredCount = 0;

  if (
    roomData?.roundConfigured !== false &&
    isValidDuelQuestionCount(explicitCount) &&
    questions.length === explicitCount
  ) {
    configuredCount = explicitCount;
  } else if (
    roomData?.roundConfigured === undefined &&
    roomData?.questionCount === undefined &&
    questions.length === 16
  ) {
    // Salas anteriores à v1.7 não tinham configuração explícita e sempre
    // carregavam 16 perguntas. Elas continuam válidas durante a transição.
    configuredCount = 16;
  }

  // Cada navegador registra a rodada somente depois que ela realmente começou.
  // Assim host e convidado levam o próprio histórico para futuros duelos, mesmo
  // quando trocam de papel, sem consumir perguntas de salas canceladas.
  if (configuredCount && (roomData?.status === "playing" || roomData?.status === "finished")) {
    rememberPlayedDuelRound(questions);
  }

  return configuredCount;
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
