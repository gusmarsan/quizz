import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { QUESTIONS } from "./questions.js";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCtZKE8YL2xC0hj0eWWrtGsuYCLEleLjoQ",
  authDomain: "batalha-naval-gus.firebaseapp.com",
  projectId: "batalha-naval-gus",
  storageBucket: "batalha-naval-gus.firebasestorage.app",
  messagingSenderId: "530937327103",
  appId: "1:530937327103:web:ab1bd4538f1af6c2b70bca"
};

const ROOM_COLLECTION = "battleshipRooms";
const GAME_TYPE = "burrquizzz";
const NAME_STORAGE_KEY = "quizDuelPlayerName";
const QUESTION_MS = 30000;
const FEEDBACK_MS = 2600;
const TOTAL_DISCOVERIES = 16;

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

let firebaseApp = null;
let auth = null;
let db = null;
let user = null;
let roomCode = null;
let roomReference = null;
let roomData = null;
let roomUnsubscribe = null;
let role = null;
let startingRoom = false;
let currentRoundKey = "";
let questions = [];
let renderedIndex = -1;
let currentIndex = 0;
let currentPhase = "";
let loop = null;
let locked = false;
let localAnswers = {};
let transitionPending = false;
let resultsShown = false;

boot();

function boot() {
  hideTechnicalSetup();
  interceptOnlineFlow();
  window.setTimeout(handleInviteUrl, 120);
}

function hideTechnicalSetup() {
  const firebaseButton = $("#firebaseButton");
  if (firebaseButton) firebaseButton.style.display = "none";

  const dialog = $("#firebaseDialog");
  if (dialog) dialog.setAttribute("aria-hidden", "true");

  const onlineCardTitle = $("#onlineModeButton .mode-title");
  const onlineCardCopy = $("#onlineModeButton .mode-copy");
  if (onlineCardTitle) onlineCardTitle.textContent = "Jogar em dupla";
  if (onlineCardCopy) onlineCardCopy.textContent = "30 segundos por pergunta ou resultado assim que os dois responderem.";
}

function interceptOnlineFlow() {
  captureClick("#onlineModeButton", () => {
    $("#onlineName").value = getSavedName();
    showScreen("screen-online-menu");
  });

  captureClick("#createRoomButton", createRoom);
  captureClick("#joinRoomButton", joinRoom);
  captureClick("#copyRoomCodeButton", shareRoom);
  captureClick("#leaveRoomButton", () => leaveRoom(true));
  captureClick("#startDuelButton", () => {});

  const duelCountField = $("#duelCountField");
  const startDuelButton = $("#startDuelButton");
  if (duelCountField) duelCountField.classList.add("hidden");
  if (startDuelButton) startDuelButton.classList.add("hidden");

  $("#playAgainButton")?.addEventListener("click", (event) => {
    if (!roomCode) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (role === "host") createRoom();
    else {
      cleanupRoomState(false);
      showScreen("screen-online-menu");
    }
  }, true);

  $("#resultsHomeButton")?.addEventListener("click", (event) => {
    if (!roomCode) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    leaveRoom(true);
  }, true);

  $("#homeButton")?.addEventListener("click", (event) => {
    if (!roomCode) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    leaveRoom(true);
  }, true);
}

function captureClick(selector, handler) {
  $(selector)?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    Promise.resolve(handler(event)).catch(showError);
  }, true);
}

async function ensureFirebase() {
  if (user && db) return;

  if (!firebaseApp) {
    firebaseApp = initializeApp(FIREBASE_CONFIG, "burrquizzz-online");
    auth = getAuth(firebaseApp);
    db = getFirestore(firebaseApp);
  }

  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch {
    // A persistência pode já ter sido definida por outra aba.
  }

  if (!auth.currentUser) await signInAnonymously(auth);
  user = auth.currentUser;
  if (!user) throw new Error("Não foi possível entrar no modo dupla.");
}

async function createRoom() {
  const button = $("#createRoomButton");
  const originalText = button?.textContent || "Criar sala";
  setButtonBusy(button, true, "Criando sala...");

  try {
    await ensureFirebase();
    const name = saveName($("#onlineName")?.value) || "Jogador 1";
    const selected = getCurrentQuestions();
    if (selected.length !== TOTAL_DISCOVERIES) {
      throw new Error("O episódio ainda está sendo preparado. Aguarde alguns segundos e tente novamente.");
    }

    const code = await makeAvailableRoomCode();
    const reference = doc(db, ROOM_COLLECTION, code);
    await setDoc(reference, {
      gameType: GAME_TYPE,
      version: 2,
      status: "waiting",
      hostUid: user.uid,
      createdAt: serverTimestamp(),
      startAt: null,
      round: 1,
      currentIndex: 0,
      phase: "waiting",
      questionStartedAt: null,
      feedbackStartedAt: null,
      player1: { uid: user.uid, name },
      player2: null,
      questions: selected,
      answers: {}
    });

    role = "host";
    connectRoom(code);
  } finally {
    setButtonBusy(button, false, originalText);
  }
}

async function joinRoom() {
  const button = $("#joinRoomButton");
  const originalText = button?.textContent || "Entrar na sala";
  setButtonBusy(button, true, "Entrando...");

  try {
    await ensureFirebase();
    const name = saveName($("#onlineName")?.value) || "Jogador 2";
    const code = normalizeRoomCode($("#roomCodeInput")?.value);
    if (code.length !== 6) throw new Error("Digite o código de 6 caracteres.");

    const reference = doc(db, ROOM_COLLECTION, code);
    const snapshot = await getDoc(reference);
    if (!snapshot.exists() || snapshot.data()?.gameType !== GAME_TYPE) {
      throw new Error("Sala não encontrada.");
    }

    const data = snapshot.data();
    if (data.player1?.uid === user.uid) {
      role = "host";
    } else if (data.player2 && data.player2.uid !== user.uid) {
      throw new Error("Esta sala já está completa.");
    } else {
      await updateDoc(reference, {
        player2: { uid: user.uid, name }
      });
      role = "guest";
    }

    connectRoom(code);
  } finally {
    setButtonBusy(button, false, originalText);
  }
}

function connectRoom(code) {
  cleanupRoomState(false);
  roomCode = code;
  roomReference = doc(db, ROOM_COLLECTION, code);
  history.replaceState(null, "", roomInviteUrl(code));
  renderLobby();

  roomUnsubscribe = onSnapshot(roomReference, (snapshot) => {
    if (!snapshot.exists()) {
      showToast("A sala foi encerrada");
      cleanupRoomState(false);
      showScreen("screen-home");
      return;
    }

    roomData = snapshot.data();
    transitionPending = false;
    renderLobby();

    if (role === "host" && roomData.status === "waiting" && roomData.player2 && !startingRoom) {
      startingRoom = true;
      const startAt = Date.now() + 4200;
      updateDoc(roomReference, {
        status: "playing",
        startAt,
        currentIndex: 0,
        phase: "question",
        questionStartedAt: startAt,
        feedbackStartedAt: null
      }).catch(showError).finally(() => {
        startingRoom = false;
      });
    }

    if (roomData.status === "playing") {
      const nextRoundKey = `${roomData.round || 1}-${roomData.startAt || 0}`;
      if (nextRoundKey !== currentRoundKey) {
        currentRoundKey = nextRoundKey;
        startOnlineGame();
      }
    }

    if (roomData.status === "finished" && currentRoundKey) {
      showOnlineResults();
    }
  }, showError);
}

function renderLobby() {
  if (!roomCode || roomData?.status === "playing" || roomData?.status === "finished") return;
  showScreen("screen-lobby");

  const codeCard = $("#copyRoomCodeButton");
  const codeText = $("#lobbyRoomCode");
  if (codeText) codeText.textContent = roomCode;
  if (codeCard) {
    const small = $("small", codeCard);
    const label = $("span", codeCard);
    if (label) label.textContent = "Convite da sala";
    if (small) small.textContent = "Compartilhar link";
  }

  $("#playerOneName").textContent = roomData?.player1?.name || getSavedName() || "Você";
  $("#playerTwoName").textContent = roomData?.player2?.name || "Aguardando...";
  $("#playerTwoDot")?.classList.toggle("online", Boolean(roomData?.player2));

  const hint = $("#lobbyHint");
  if (hint) {
    hint.textContent = roomData?.player2
      ? "A outra pessoa entrou. O duelo começa automaticamente. São 30 segundos por pergunta."
      : "Compartilhe o convite. O jogo começa assim que a outra pessoa entrar.";
  }
}

async function shareRoom() {
  if (!roomCode) return;
  const url = roomInviteUrl(roomCode);
  const shareData = {
    title: "Burrquizzz em dupla",
    text: `Entre na minha sala do Burrquizzz: ${roomCode}`,
    url
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }

  await navigator.clipboard.writeText(url);
  showToast("Link da sala copiado");
}

async function startOnlineGame() {
  stopGameLoop();
  questions = Array.isArray(roomData?.questions) ? roomData.questions : [];
  if (questions.length !== TOTAL_DISCOVERIES) {
    showError(new Error("A sala não contém um episódio válido."));
    return;
  }

  renderedIndex = -1;
  currentIndex = Number(roomData.currentIndex || 0);
  currentPhase = "";
  locked = false;
  localAnswers = roomData?.answers?.[user.uid] || {};
  resultsShown = false;

  const opponent = role === "host" ? roomData.player2 : roomData.player1;
  $("#opponentName").textContent = opponent?.name || "Adversário";
  $("#opponentBadge")?.classList.remove("hidden");

  await runCountdown(roomData.startAt || Date.now());
  showScreen("screen-game");
  runGameLoop();
}

function runCountdown(startAt) {
  showScreen("screen-countdown");
  $("#countdownMessage").textContent = "30 segundos ou até os dois responderem.";

  return new Promise((resolve) => {
    const tick = () => {
      const remaining = startAt - Date.now();
      if (remaining <= 0) {
        $("#countdownValue").textContent = "JÁ";
        window.setTimeout(resolve, 280);
        return;
      }
      $("#countdownValue").textContent = String(Math.max(1, Math.ceil(remaining / 1000)));
      requestAnimationFrame(tick);
    };
    tick();
  });
}

function bothPlayersAnswered(data, index) {
  const firstUid = data?.player1?.uid;
  const secondUid = data?.player2?.uid;
  return Boolean(
    firstUid &&
    secondUid &&
    data?.answers?.[firstUid]?.[index] !== undefined &&
    data?.answers?.[secondUid]?.[index] !== undefined
  );
}

function runGameLoop() {
  const tick = () => {
    if (!roomData) return;
    if (roomData.status === "finished") {
      showOnlineResults();
      return;
    }
    if (roomData.status !== "playing") return;

    const now = Date.now();
    const index = Math.max(0, Number(roomData.currentIndex || 0));
    const phase = roomData.phase === "feedback" ? "feedback" : "question";
    const questionStartedAt = Number(roomData.questionStartedAt || roomData.startAt || now);
    const feedbackStartedAt = Number(roomData.feedbackStartedAt || now);

    if (now < questionStartedAt) {
      loop = requestAnimationFrame(tick);
      return;
    }

    if (index >= questions.length) {
      requestNextQuestion(Math.max(0, questions.length - 1));
      loop = requestAnimationFrame(tick);
      return;
    }

    if (renderedIndex !== index) {
      renderedIndex = index;
      currentIndex = index;
      currentPhase = "question";
      renderQuestion(questions[index], index);
    }

    if (phase === "question") {
      currentPhase = "question";
      const elapsed = Math.max(0, now - questionStartedAt);
      const ratio = Math.max(0, 1 - elapsed / QUESTION_MS);
      $("#timerBar").style.transform = `scaleX(${ratio})`;

      if (bothPlayersAnswered(roomData, index) || elapsed >= QUESTION_MS) {
        requestFeedback(index);
      }
    } else {
      $("#timerBar").style.transform = "scaleX(0)";
      if (currentPhase !== "feedback") {
        currentPhase = "feedback";
        showFeedback(index);
      }
      if (now - feedbackStartedAt >= FEEDBACK_MS) requestNextQuestion(index);
    }

    loop = requestAnimationFrame(tick);
  };

  tick();
}

async function requestFeedback(index) {
  if (transitionPending || !roomReference) return;
  transitionPending = true;
  const now = Date.now();

  try {
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(roomReference);
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      if (data.status !== "playing") return;
      if (Number(data.currentIndex || 0) !== index) return;
      if (data.phase === "feedback") return;

      const startedAt = Number(data.questionStartedAt || data.startAt || now);
      const expired = now - startedAt >= QUESTION_MS;
      if (!bothPlayersAnswered(data, index) && !expired) return;

      transaction.update(roomReference, {
        phase: "feedback",
        feedbackStartedAt: now
      });
    });
  } catch (error) {
    console.warn("Não foi possível mostrar o resultado agora.", error);
  } finally {
    transitionPending = false;
  }
}

async function requestNextQuestion(index) {
  if (transitionPending || !roomReference) return;
  transitionPending = true;
  const now = Date.now();

  try {
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(roomReference);
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      if (data.status !== "playing") return;
      if (Number(data.currentIndex || 0) !== index) return;
      if (data.phase !== "feedback") return;

      const feedbackStartedAt = Number(data.feedbackStartedAt || now);
      if (now - feedbackStartedAt < FEEDBACK_MS) return;

      const nextIndex = index + 1;
      if (nextIndex >= questions.length) {
        transaction.update(roomReference, {
          status: "finished",
          finishedAt: now
        });
        return;
      }

      transaction.update(roomReference, {
        currentIndex: nextIndex,
        phase: "question",
        questionStartedAt: now,
        feedbackStartedAt: null
      });
    });
  } catch (error) {
    console.warn("Não foi possível avançar para a próxima pergunta.", error);
  } finally {
    transitionPending = false;
  }
}

function renderQuestion(question, index) {
  locked = false;
  $("#questionNumber").textContent = String(index + 1);
  $("#questionTotal").textContent = String(questions.length);
  $("#questionCategory").textContent = question.category || "Burrquizzz";
  $("#questionType").textContent = question.type === "image_choice" ? "Imagem" : "Escolha";
  $("#questionText").textContent = question.prompt;
  updateOwnScore();

  const feedback = $("#feedbackBanner");
  feedback.textContent = "";
  feedback.className = "feedback-banner";

  const support = $("#questionSupport");
  const supportText = question.supportText || question.imageCredit || "";
  support.textContent = supportText;
  support.classList.toggle("hidden", !supportText);

  const imageWrap = $("#questionImageWrap");
  const image = $("#questionImage");
  if (question.image) {
    image.src = question.image;
    image.alt = question.prompt;
    imageWrap.classList.remove("hidden");
  } else {
    image.removeAttribute("src");
    image.alt = "";
    imageWrap.classList.add("hidden");
  }

  const area = $("#answersArea");
  area.innerHTML = "";
  const stack = document.createElement("div");
  stack.className = "answers-stack";

  question.options.forEach((option, optionIndex) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "answer-button";
    button.dataset.answerIndex = String(optionIndex);
    button.innerHTML = `<span class="answer-letter">${String.fromCharCode(65 + optionIndex)}</span><span>${escapeHtml(option)}</span>`;
    button.addEventListener("click", () => submitAnswer(optionIndex));
    stack.appendChild(button);
  });

  area.appendChild(stack);

  const existing = roomData?.answers?.[user.uid]?.[index] || localAnswers[index];
  if (existing) {
    localAnswers[index] = existing;
    lockAnswers();
    showSentState(existing);
  }
}

async function submitAnswer(selectedIndex) {
  if (locked || currentPhase !== "question" || !roomReference) return;
  locked = true;
  lockAnswers();

  const question = questions[currentIndex];
  const startedAt = Number(roomData.questionStartedAt || roomData.startAt || Date.now());
  const elapsedMs = Math.max(0, Math.min(QUESTION_MS, Date.now() - startedAt));
  if (elapsedMs >= QUESTION_MS) return;

  const payload = {
    value: selectedIndex,
    correct: selectedIndex === question.correctIndex,
    elapsedMs: Math.round(elapsedMs),
    answeredAt: Date.now()
  };

  try {
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(roomReference);
      if (!snapshot.exists()) throw new Error("A sala foi encerrada.");
      const data = snapshot.data();
      if (data.status !== "playing" || data.phase === "feedback") return;
      if (Number(data.currentIndex || 0) !== currentIndex) return;

      const answers = data.answers || {};
      const mine = answers[user.uid] || {};
      if (mine[currentIndex]) return;

      transaction.update(roomReference, {
        answers: {
          ...answers,
          [user.uid]: {
            ...mine,
            [currentIndex]: payload
          }
        }
      });
    });

    localAnswers[currentIndex] = payload;
    showSentState(payload);
    requestFeedback(currentIndex);
  } catch (error) {
    locked = false;
    $$("#answersArea .answer-button").forEach((button) => { button.disabled = false; });
    showError(error);
  }
}

function showSentState(answer) {
  const feedback = $("#feedbackBanner");
  feedback.textContent = `Resposta enviada em ${(answer.elapsedMs / 1000).toFixed(1).replace(".", ",")}s. Aguardando a outra pessoa.`;
  feedback.className = "feedback-banner";
}

function showFeedback(index) {
  const question = questions[index];
  const answer = roomData?.answers?.[user.uid]?.[index] || localAnswers[index] || null;
  localAnswers[index] = answer || localAnswers[index];
  lockAnswers();

  $$("#answersArea .answer-button").forEach((button) => {
    const optionIndex = Number(button.dataset.answerIndex);
    if (optionIndex === question.correctIndex) button.classList.add("correct");
    if (answer && optionIndex === Number(answer.value) && optionIndex !== question.correctIndex) {
      button.classList.add("wrong");
    }
  });

  const explanation = question.explanation || `Resposta: ${question.options[question.correctIndex]}.`;
  const feedback = $("#feedbackBanner");
  if (!answer) {
    feedback.textContent = `Tempo esgotado — ${explanation}`;
    feedback.className = "feedback-banner bad";
  } else if (answer.correct) {
    feedback.textContent = `Certo! — ${explanation}`;
    feedback.className = "feedback-banner good";
  } else {
    feedback.textContent = `Resposta incorreta — ${explanation}`;
    feedback.className = "feedback-banner bad";
  }

  updateOwnScore();
}

function lockAnswers() {
  locked = true;
  $$("#answersArea .answer-button").forEach((button) => { button.disabled = true; });
}

function updateOwnScore() {
  const answers = roomData?.answers?.[user?.uid] || localAnswers;
  const score = Object.values(answers || {}).filter((answer) => answer?.correct).length;
  $("#currentScore").textContent = String(score);
}

function showOnlineResults() {
  if (!roomData || !user || resultsShown) return;
  resultsShown = true;
  stopGameLoop();

  const players = [roomData.player1, roomData.player2].filter(Boolean);
  const results = players.map((player) => playerResult(player));
  results.sort((a, b) => b.correct - a.correct || a.time - b.time);

  const winner = results[0];
  const tied = results.length === 2 && results[0].correct === results[1].correct && results[0].time === results[1].time;
  $("#resultEyebrow").textContent = "Resultado do duelo";
  $("#resultTitle").textContent = tied
    ? "Empate absurdo"
    : winner?.uid === user.uid
      ? "Você venceu"
      : `${winner?.name || "Adversário"} venceu`;
  $("#resultSubtitle").textContent = "Mais acertos vencem. O menor tempo decide em caso de empate.";
  $("#soloStats").classList.add("hidden");
  $("#duelScoreboard").classList.remove("hidden");
  $("#playAgainButton").textContent = role === "host" ? "Criar nova sala" : "Jogar novamente";

  renderScoreRow($("#scorePlayerOne"), results[0], true);
  renderScoreRow($("#scorePlayerTwo"), results[1], false);
  showScreen("screen-results");
}

function playerResult(player) {
  const answers = roomData?.answers?.[player.uid] || {};
  const entries = Object.values(answers);
  const correct = entries.filter((answer) => answer?.correct).length;
  const answeredTime = entries.reduce((sum, answer) => sum + Number(answer?.elapsedMs || QUESTION_MS), 0);
  const missing = Math.max(0, questions.length - entries.length);
  return {
    uid: player.uid,
    name: player.name || "Jogador",
    correct,
    time: answeredTime + missing * QUESTION_MS
  };
}

function renderScoreRow(element, result, winner) {
  if (!element || !result) return;
  element.className = `score-row${winner ? " winner" : ""}`;
  element.innerHTML = `<strong>${escapeHtml(result.name)}${result.uid === user.uid ? " (você)" : ""}</strong><span>${result.correct}/${questions.length} acertos</span><span>${(result.time / 1000).toFixed(1).replace(".", ",")}s</span>`;
}

async function leaveRoom(removeRoom) {
  const reference = roomReference;
  const shouldDelete = removeRoom && role === "host" && reference;
  cleanupRoomState(false);

  if (shouldDelete) {
    try { await deleteDoc(reference); } catch { /* A sala pode já ter expirado. */ }
  }

  history.replaceState(null, "", location.pathname);
  showScreen("screen-home");
}

function cleanupRoomState(clearUrl = true) {
  roomUnsubscribe?.();
  roomUnsubscribe = null;
  stopGameLoop();
  roomCode = null;
  roomReference = null;
  roomData = null;
  role = null;
  startingRoom = false;
  currentRoundKey = "";
  questions = [];
  localAnswers = {};
  transitionPending = false;
  resultsShown = false;
  if (clearUrl) history.replaceState(null, "", location.pathname);
}

function stopGameLoop() {
  cancelAnimationFrame(loop);
  loop = null;
}

function getCurrentQuestions() {
  return QUESTIONS
    .filter((question) => question && Array.isArray(question.options) && question.options.length === 4)
    .slice(0, TOTAL_DISCOVERIES)
    .map((question, index) => ({
      id: String(question.id || `online-${Date.now()}-${index}`),
      type: question.type === "image_choice" ? "image_choice" : "multiple_choice",
      category: String(question.category || "Burrquizzz"),
      difficulty: String(question.difficulty || "media"),
      prompt: String(question.prompt || ""),
      options: question.options.map((option) => String(option)),
      correctIndex: Number(question.correctIndex),
      explanation: String(question.explanation || ""),
      image: String(question.image || ""),
      imageCredit: String(question.imageCredit || ""),
      supportText: String(question.supportText || "")
    }));
}

async function makeAvailableRoomCode() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = makeRoomCode();
    const snapshot = await getDoc(doc(db, ROOM_COLLECTION, code));
    if (!snapshot.exists()) return code;
  }
  throw new Error("Não foi possível criar uma sala agora.");
}

function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "BQ";
  for (let index = 0; index < 4; index += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function normalizeRoomCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function roomInviteUrl(code) {
  const url = new URL(location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("room", code);
  return url.toString();
}

function handleInviteUrl() {
  const code = normalizeRoomCode(new URL(location.href).searchParams.get("room"));
  if (!code) return;
  $("#onlineName").value = getSavedName();
  $("#roomCodeInput").value = code;
  showScreen("screen-online-menu");
  $("#roomCodeInput")?.focus();
}

function showScreen(id) {
  $$(".screen").forEach((screen) => screen.classList.toggle("active", screen.id === id));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function getSavedName() {
  return localStorage.getItem(NAME_STORAGE_KEY) || "";
}

function saveName(value) {
  const name = String(value || "").trim().replace(/\s+/g, " ").slice(0, 18);
  if (name) localStorage.setItem(NAME_STORAGE_KEY, name);
  return name;
}

function setButtonBusy(button, busy, text) {
  if (!button) return;
  button.disabled = busy;
  button.textContent = text;
}

function showToast(message) {
  const toast = $("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("visible"), 3000);
}

function showError(error) {
  console.error(error);
  showToast(error?.message || "Não foi possível concluir esta ação.");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
