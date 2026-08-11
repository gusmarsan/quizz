import { getApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  onSnapshot,
  runTransaction
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { DUEL_QUESTIONS } from "./duel-question-bank-v252.js";
import {
  buildDuelQuestionRound,
  calculateDuelOutcome,
  duelModeForCount,
  getConfiguredDuelQuestionCount,
  getDuelResultAction
} from "./duel-round-rules-v17.js?v=1.7";

const FIREBASE_APP_NAME = "burrquizzz-online-v231";
const ROOM_COLLECTION = "battleshipRooms";
const GAME_TYPE = "burrquizzz";
const QUESTION_MS = 30000;
const REMATCH_COUNTDOWN_MS = 4200;

let watchedCode = "";
let watchedRoom = null;
let unsubscribe = null;
let requesting = false;

boot();

function boot() {
  document.addEventListener("click", interceptRematchClick, true);

  const resultsScreen = document.querySelector("#screen-results");
  if (resultsScreen) {
    new MutationObserver(() => {
      if (resultsScreen.classList.contains("active")) watchCurrentRoom();
    }).observe(resultsScreen, { attributes: true, attributeFilter: ["class"] });
  }
}

function interceptRematchClick(event) {
  const button = event.target.closest?.("#playAgainButton");
  if (!button) return;

  const resultsScreen = document.querySelector("#screen-results");
  const code = getRoomCode();
  if (!code || !resultsScreen?.classList.contains("active")) return;
  if (button.dataset.duelAction === "new-duel") return;

  event.preventDefault();
  event.stopImmediatePropagation();
  requestRematch().catch(showError);
}

function getFirebaseContext() {
  try {
    const app = getApp(FIREBASE_APP_NAME);
    const auth = getAuth(app);
    const user = auth.currentUser;
    if (!user) return null;
    return { db: getFirestore(app), user };
  } catch {
    return null;
  }
}

function watchCurrentRoom() {
  const code = getRoomCode();
  const context = getFirebaseContext();
  if (!code || !context) return;

  if (code === watchedCode && unsubscribe) {
    renderRematchState(watchedRoom, context.user.uid);
    return;
  }

  unsubscribe?.();
  watchedCode = code;
  watchedRoom = null;

  const reference = doc(context.db, ROOM_COLLECTION, code);
  unsubscribe = onSnapshot(reference, (snapshot) => {
    watchedRoom = snapshot.exists() ? snapshot.data() : null;
    renderRematchState(watchedRoom, context.user.uid);
  }, (error) => console.warn("Não foi possível acompanhar a revanche.", error));
}

function renderRematchState(data, uid) {
  const button = document.querySelector("#playAgainButton");
  if (!button || !data || data.gameType !== GAME_TYPE) return;

  if (data.status !== "finished") {
    button.disabled = true;
    button.textContent = "Preparando revanche...";
    button.dataset.duelAction = "preparing-rematch";
    return;
  }

  const outcome = calculateDuelOutcome(data, QUESTION_MS);
  if (!outcome || !outcome.results.some((result) => result.uid === uid)) return;
  const requests = data.rematchRequests || {};
  const action = getDuelResultAction(outcome, requests, uid);

  if (action === "new-duel") {
    button.disabled = false;
    button.textContent = "Jogar novamente";
    button.dataset.duelAction = "new-duel";
  } else if (action === "waiting-rematch") {
    button.disabled = true;
    button.textContent = "Aguardando adversário";
    button.dataset.duelAction = "waiting-rematch";
  } else if (action === "request-rematch") {
    button.disabled = false;
    button.textContent = "Pedir revanche";
    button.dataset.duelAction = "request-rematch";
  } else if (action === "accept-rematch") {
    button.disabled = false;
    button.textContent = "Aceitar revanche";
    button.dataset.duelAction = "accept-rematch";
  } else {
    button.disabled = false;
    button.textContent = "Jogar novamente";
    button.dataset.duelAction = "new-duel";
  }
}

async function requestRematch() {
  if (requesting) return;
  requesting = true;

  const context = getFirebaseContext();
  const code = getRoomCode();
  const button = document.querySelector("#playAgainButton");

  if (!context || !code) {
    requesting = false;
    throw new Error("Não foi possível recuperar esta sala.");
  }

  if (button) {
    button.disabled = true;
    button.textContent = "Confirmando revanche...";
  }

  const reference = doc(context.db, ROOM_COLLECTION, code);

  try {
    await runTransaction(context.db, async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists()) throw new Error("A sala foi encerrada.");

      const data = snapshot.data();
      if (data.gameType !== GAME_TYPE || data.status !== "finished") return;

      const outcome = calculateDuelOutcome(data, QUESTION_MS);
      if (!outcome || !outcome.results.some((result) => result.uid === context.user.uid)) {
        throw new Error("Esta revanche não está disponível.");
      }

      if (outcome.tied) return;
      const requests = data.rematchRequests || {};
      const loserRequested = requests[outcome.loserUid] === true;

      if (context.user.uid === outcome.loserUid && !loserRequested) {
        transaction.update(reference, {
          rematchRequests: { [outcome.loserUid]: true }
        });
        return;
      }

      if (context.user.uid !== outcome.winnerUid || !loserRequested) return;

      const questionCount = getConfiguredDuelQuestionCount(data);
      const nextQuestions = buildDuelQuestionRound(
        DUEL_QUESTIONS,
        questionCount,
        data.questions || [],
        Math.random,
        "rematch"
      );
      if (nextQuestions.length !== questionCount) {
        throw new Error("Não há perguntas suficientes para iniciar a revanche.");
      }

      const startAt = Date.now() + REMATCH_COUNTDOWN_MS;
      transaction.update(reference, {
        status: "playing",
        round: Number(data.round || 1) + 1,
        startAt,
        currentIndex: 0,
        phase: "question",
        questionStartedAt: startAt,
        feedbackStartedAt: null,
        finishedAt: null,
        questionCount,
        duelMode: duelModeForCount(questionCount),
        roundConfigured: true,
        questions: nextQuestions,
        answers: {},
        rematchRequests: {}
      });
    });
  } finally {
    requesting = false;
    watchCurrentRoom();
  }
}

function getRoomCode() {
  return String(new URL(location.href).searchParams.get("room") || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

function showError(error) {
  console.error(error);
  const toast = document.querySelector("#toast");
  if (!toast) return;
  toast.textContent = error?.message || "Não foi possível iniciar a revanche.";
  toast.classList.add("visible");
  clearTimeout(showError.timer);
  showError.timer = window.setTimeout(() => toast.classList.remove("visible"), 4200);
}
