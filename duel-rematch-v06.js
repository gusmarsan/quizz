import { getApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  onSnapshot,
  runTransaction
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { QUESTIONS } from "./questions.js";

const FIREBASE_APP_NAME = "burrquizzz-online-v231";
const ROOM_COLLECTION = "battleshipRooms";
const GAME_TYPE = "burrquizzz";
const TOTAL_QUESTIONS = 16;
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
    return;
  }

  const playerUids = [data.player1?.uid, data.player2?.uid].filter(Boolean);
  if (!playerUids.includes(uid)) return;

  const requests = data.rematchRequests || {};
  const mine = requests[uid] === true;
  const opponentUid = playerUids.find((playerUid) => playerUid !== uid);
  const opponentRequested = Boolean(opponentUid && requests[opponentUid] === true);

  if (mine && opponentRequested) {
    button.disabled = true;
    button.textContent = "Preparando revanche...";
  } else if (mine) {
    button.disabled = true;
    button.textContent = "Aguardando adversário";
  } else if (opponentRequested) {
    button.disabled = false;
    button.textContent = "Aceitar revanche";
  } else {
    button.disabled = false;
    button.textContent = "Pedir revanche";
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

      const playerUids = [data.player1?.uid, data.player2?.uid].filter(Boolean);
      if (!playerUids.includes(context.user.uid) || playerUids.length !== 2) {
        throw new Error("Esta revanche não está disponível.");
      }

      const requests = {
        ...(data.rematchRequests || {}),
        [context.user.uid]: true
      };
      const bothAccepted = playerUids.every((uid) => requests[uid] === true);

      if (!bothAccepted) {
        transaction.update(reference, { rematchRequests: requests });
        return;
      }

      const nextQuestions = buildQuestionRound(data.questions || []);
      if (nextQuestions.length !== TOTAL_QUESTIONS) {
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

function buildQuestionRound(previousQuestions) {
  const previousIds = new Set(previousQuestions.map(questionIdentity));
  const available = QUESTIONS.filter(
    (question) => question && Array.isArray(question.options) && question.options.length === 4
  );

  const fresh = shuffle(available.filter((question) => !previousIds.has(questionIdentity(question))));
  const fallback = shuffle(available.filter((question) => previousIds.has(questionIdentity(question))));

  return [...fresh, ...fallback]
    .slice(0, TOTAL_QUESTIONS)
    .map((question, index) => ({
      id: String(question.id || `rematch-${Date.now()}-${index}`),
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

function questionIdentity(question) {
  return String(question?.id || question?.prompt || "");
}

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
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
