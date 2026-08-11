import { DEFAULT_FIREBASE_CONFIG } from "./firebase-config.js";
import { QUESTIONS } from "./questions.js";

const QUESTION_MS = 18000;
const FEEDBACK_MS = 2200;
const ROUND_MS = QUESTION_MS + FEEDBACK_MS;
const FIREBASE_STORAGE_KEY = "quizDuelFirebaseConfig";
const NAME_STORAGE_KEY = "quizDuelPlayerName";

const QUESTION_MAP = new Map(QUESTIONS.map((question) => [question.id, question]));

const state = {
  mode: null,
  playerName: "",
  questions: [],
  currentIndex: 0,
  answers: [],
  score: 0,
  questionStartedAt: 0,
  questionTimer: null,
  feedbackTimer: null,
  instanceId: sessionStorage.getItem("quizDuelInstanceId") || crypto.randomUUID(),
  firebase: null,
  serverOffset: 0,
  roomCode: null,
  room: null,
  isHost: false,
  roomUnsubscribe: null,
  renderedOnlineIndex: -1,
  onlineLoop: null,
  onlinePhaseKey: null,
  answerCache: {},
  currentLocked: false,
  currentInputDraft: null
};

sessionStorage.setItem("quizDuelInstanceId", state.instanceId);

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const screens = $$(".screen");
const elements = {
  homeButton: $("#homeButton"),
  firebaseButton: $("#firebaseButton"),
  homeUserInitial: $("#homeUserInitial"),
  homeUserName: $("#homeUserName"),
  soloModeButton: $("#soloModeButton"),
  onlineModeButton: $("#onlineModeButton"),
  startSoloButton: $("#startSoloButton"),
  createRoomButton: $("#createRoomButton"),
  joinRoomButton: $("#joinRoomButton"),
  leaveRoomButton: $("#leaveRoomButton"),
  copyRoomCodeButton: $("#copyRoomCodeButton"),
  startDuelButton: $("#startDuelButton"),
  duelCount: $("#duelCount"),
  soloName: $("#soloName"),
  onlineName: $("#onlineName"),
  roomCodeInput: $("#roomCodeInput"),
  lobbyRoomCode: $("#lobbyRoomCode"),
  playerOneName: $("#playerOneName"),
  playerTwoName: $("#playerTwoName"),
  playerOneState: $("#playerOneState"),
  playerTwoState: $("#playerTwoState"),
  playerTwoDot: $("#playerTwoDot"),
  duelCountField: $("#duelCountField"),
  lobbyHint: $("#lobbyHint"),
  countdownValue: $("#countdownValue"),
  countdownMessage: $("#countdownMessage"),
  questionNumber: $("#questionNumber"),
  questionTotal: $("#questionTotal"),
  questionCategory: $("#questionCategory"),
  questionType: $("#questionType"),
  questionText: $("#questionText"),
  questionSupport: $("#questionSupport"),
  questionImageWrap: $("#questionImageWrap"),
  questionImage: $("#questionImage"),
  answersArea: $("#answersArea"),
  timerBar: $("#timerBar"),
  currentScore: $("#currentScore"),
  feedbackBanner: $("#feedbackBanner"),
  opponentBadge: $("#opponentBadge"),
  opponentName: $("#opponentName"),
  resultEyebrow: $("#resultEyebrow"),
  resultTitle: $("#resultTitle"),
  resultSubtitle: $("#resultSubtitle"),
  resultCorrect: $("#resultCorrect"),
  resultAverage: $("#resultAverage"),
  soloStats: $("#soloStats"),
  duelScoreboard: $("#duelScoreboard"),
  scorePlayerOne: $("#scorePlayerOne"),
  scorePlayerTwo: $("#scorePlayerTwo"),
  playAgainButton: $("#playAgainButton"),
  resultsHomeButton: $("#resultsHomeButton"),
  firebaseDialog: $("#firebaseDialog"),
  firebaseConfigInput: $("#firebaseConfigInput"),
  firebaseStatus: $("#firebaseStatus"),
  saveFirebaseButton: $("#saveFirebaseButton"),
  clearFirebaseButton: $("#clearFirebaseButton"),
  toast: $("#toast")
};

function showScreen(id) {
  screens.forEach((screen) => screen.classList.toggle("active", screen.id === id));
  if (id === "screen-home") refreshHomeIdentity();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function refreshHomeIdentity() {
  const savedName = getSavedName();
  const displayName = savedName || "jogador";
  if (elements.homeUserName) elements.homeUserName.textContent = displayName;
  if (elements.homeUserInitial) elements.homeUserInitial.textContent = displayName.charAt(0).toLocaleUpperCase("pt-BR");
}

function toast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  clearTimeout(toast.timeout);
  toast.timeout = setTimeout(() => elements.toast.classList.remove("visible"), 2600);
}

function saveName(name) {
  const clean = String(name || "").trim().slice(0, 18);
  if (clean) localStorage.setItem(NAME_STORAGE_KEY, clean);
  return clean;
}

function getSavedName() {
  return localStorage.getItem(NAME_STORAGE_KEY) || "";
}

function stopTimers() {
  clearInterval(state.questionTimer);
  clearTimeout(state.feedbackTimer);
  cancelAnimationFrame(state.onlineLoop);
  state.questionTimer = null;
  state.feedbackTimer = null;
  state.onlineLoop = null;
}

function resetRoundState() {
  stopTimers();
  state.questions = [];
  state.currentIndex = 0;
  state.answers = [];
  state.score = 0;
  state.questionStartedAt = 0;
  state.renderedOnlineIndex = -1;
  state.onlinePhaseKey = null;
  state.answerCache = {};
  state.currentLocked = false;
  state.currentInputDraft = null;
}

function normalizeCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function pickQuestions(count) {
  return shuffle(QUESTIONS).slice(0, count);
}

function formatTime(ms) {
  return `${(ms / 1000).toFixed(1).replace(".", ",")}s`;
}

function getQuestionTypeLabel(type) {
  if (type === "image_choice") return "Imagem";
  if (type === "text_input") return "Digite";
  if (type === "match_columns") return "Associe";
  return "Escolha";
}

function lockInteractiveArea() {
  state.currentLocked = true;
  $$("button, input, select", elements.answersArea).forEach((node) => {
    node.disabled = true;
  });
}

function revealSupport(text = "") {
  if (!text) {
    elements.questionSupport.textContent = "";
    elements.questionSupport.classList.add("hidden");
  } else {
    elements.questionSupport.textContent = text;
    elements.questionSupport.classList.remove("hidden");
  }
}

function revealImage(question) {
  if (question.image) {
    elements.questionImage.src = question.image;
    elements.questionImage.alt = question.prompt;
    elements.questionImageWrap.classList.remove("hidden");
  } else {
    elements.questionImage.removeAttribute("src");
    elements.questionImage.alt = "";
    elements.questionImageWrap.classList.add("hidden");
  }
}

function renderQuestionShell(question, index, total) {
  elements.questionNumber.textContent = String(index + 1);
  elements.questionTotal.textContent = String(total);
  elements.questionCategory.textContent = question.category;
  elements.questionType.textContent = getQuestionTypeLabel(question.type);
  elements.questionText.textContent = question.prompt;
  elements.currentScore.textContent = String(state.score);
  elements.feedbackBanner.textContent = "";
  elements.feedbackBanner.className = "feedback-banner";
  revealSupport(question.supportText || "");
  revealImage(question);
  elements.answersArea.innerHTML = "";
  state.currentLocked = false;
}

function getCurrentQuestion() {
  return state.questions[state.currentIndex];
}

function getChoiceLetter(index) {
  return String.fromCharCode(65 + index);
}

function renderChoiceQuestion(question, existingAnswer = null) {
  const wrap = document.createElement("div");
  wrap.className = "answers-stack";
  question.options.forEach((option, optionIndex) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "answer-button";
    button.dataset.answerIndex = String(optionIndex);
    button.innerHTML = `
      <span class="answer-letter">${getChoiceLetter(optionIndex)}</span>
      <span>${escapeHtml(option)}</span>
    `;
    button.addEventListener("click", () => {
      if (state.currentLocked) return;
      submitCurrentAnswer(optionIndex);
    });
    wrap.appendChild(button);
  });
  elements.answersArea.appendChild(wrap);
  if (existingAnswer) applyChoiceReveal(question, existingAnswer.value, true);
}

function renderTextInputQuestion(question, existingAnswer = null) {
  const wrap = document.createElement("div");
  wrap.className = "input-card";
  wrap.innerHTML = `
    <p>Digite a resposta e toque em enviar.</p>
    <input id="textAnswerInput" type="text" placeholder="${escapeHtml(question.placeholder || "Digite aqui")}" />
    <div class="submit-row">
      <button id="textSubmitButton" class="primary-button" type="button">Enviar resposta</button>
      <button id="textClearButton" class="ghost-button" type="button">Limpar</button>
    </div>
  `;
  elements.answersArea.appendChild(wrap);

  const input = $("#textAnswerInput");
  const submit = $("#textSubmitButton");
  const clear = $("#textClearButton");

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") submit.click();
  });
  submit.addEventListener("click", () => {
    if (state.currentLocked) return;
    submitCurrentAnswer(input.value);
  });
  clear.addEventListener("click", () => {
    if (state.currentLocked) return;
    input.value = "";
    input.focus();
  });

  if (existingAnswer) {
    input.value = existingAnswer.value || "";
    lockInteractiveArea();
  } else if (state.currentInputDraft) {
    input.value = state.currentInputDraft;
  }

  input.addEventListener("input", () => {
    state.currentInputDraft = input.value;
  });
}

function renderMatchQuestion(question, existingAnswer = null) {
  const wrap = document.createElement("div");
  wrap.className = "match-card";
  const options = shuffle(question.rightItems);
  wrap.innerHTML = `<p>Ligue as colunas escolhendo a opção correspondente para cada item da esquerda.</p>`;
  const rows = document.createElement("div");
  rows.className = "match-rows";

  question.leftItems.forEach((leftItem, index) => {
    const row = document.createElement("div");
    row.className = "match-row";
    const select = document.createElement("select");
    select.dataset.matchIndex = String(index);
    select.innerHTML = `<option value="">Selecione...</option>` +
      options.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join("");
    row.innerHTML = `<div class="match-left">${escapeHtml(leftItem)}</div>`;
    row.appendChild(select);
    rows.appendChild(row);
  });

  wrap.appendChild(rows);
  const submitRow = document.createElement("div");
  submitRow.className = "submit-row";
  submitRow.innerHTML = `
    <button id="matchSubmitButton" class="primary-button" type="button">Enviar resposta</button>
    <button id="matchClearButton" class="ghost-button" type="button">Limpar</button>
  `;
  wrap.appendChild(submitRow);
  elements.answersArea.appendChild(wrap);

  $("#matchSubmitButton").addEventListener("click", () => {
    if (state.currentLocked) return;
    const values = $$("select", wrap).map((select) => select.value);
    submitCurrentAnswer(values);
  });
  $("#matchClearButton").addEventListener("click", () => {
    if (state.currentLocked) return;
    $$("select", wrap).forEach((select) => {
      select.value = "";
    });
  });

  if (existingAnswer) {
    $$("select", wrap).forEach((select, idx) => {
      select.value = existingAnswer.value?.[idx] || "";
    });
    lockInteractiveArea();
  }
}

function renderQuestion(question, index, total, existingAnswer = null) {
  renderQuestionShell(question, index, total);
  if (question.type === "multiple_choice" || question.type === "image_choice") {
    renderChoiceQuestion(question, existingAnswer);
  } else if (question.type === "text_input") {
    renderTextInputQuestion(question, existingAnswer);
  } else if (question.type === "match_columns") {
    renderMatchQuestion(question, existingAnswer);
  }
}

function applyChoiceReveal(question, selectedValue, alreadyLocked = false) {
  if (!alreadyLocked) lockInteractiveArea();
  $$(".answer-button", elements.answersArea).forEach((button) => {
    const index = Number(button.dataset.answerIndex);
    if (index === question.correctIndex) button.classList.add("correct");
    if (selectedValue !== null && selectedValue !== undefined && index === Number(selectedValue) && index !== question.correctIndex) {
      button.classList.add("wrong");
    }
  });
}

function evaluateAnswer(question, rawValue) {
  if (question.type === "multiple_choice" || question.type === "image_choice") {
    return { value: Number(rawValue), correct: Number(rawValue) === question.correctIndex, reveal: `Resposta certa: ${question.options[question.correctIndex]}` };
  }
  if (question.type === "text_input") {
    const normalized = normalizeText(rawValue);
    const accepted = (question.acceptedAnswers || []).some((answer) => normalizeText(answer) === normalized);
    return { value: String(rawValue || "").trim(), correct: accepted, reveal: `Resposta aceita: ${question.acceptedAnswers[0]}` };
  }
  if (question.type === "match_columns") {
    const submitted = Array.isArray(rawValue) ? rawValue : [];
    const expected = question.matches || [];
    const correct = submitted.length === expected.length && submitted.every((item, idx) => item === expected[idx]);
    const reveal = question.leftItems.map((left, idx) => `${left} → ${expected[idx]}`).join(" • ");
    return { value: submitted, correct, reveal };
  }
  return { value: rawValue, correct: false, reveal: "" };
}

function showFeedbackText(correct, text, extra) {
  elements.feedbackBanner.textContent = extra ? `${text} — ${extra}` : text;
  elements.feedbackBanner.className = `feedback-banner ${correct ? "good" : "bad"}`;
}

function getSelectedRadioValue(name) {
  return Number(document.querySelector(`input[name="${name}"]:checked`)?.value || 10);
}

function goHome() {
  stopTimers();
  resetRoundState();
  state.mode = null;
  state.playerName = getSavedName();
  elements.soloName.value = getSavedName();
  elements.onlineName.value = getSavedName();
  showScreen("screen-home");
}

async function runCountdown(message = "A rodada vai começar", targetServerTime = null) {
  showScreen("screen-countdown");
  elements.countdownMessage.textContent = message;

  if (targetServerTime) {
    return new Promise((resolve) => {
      const tick = () => {
        const remaining = targetServerTime - getServerNow();
        if (remaining <= 0) {
          elements.countdownValue.textContent = "JÁ";
          resolve();
          return;
        }
        elements.countdownValue.textContent = String(Math.max(1, Math.ceil(remaining / 1000)));
        requestAnimationFrame(tick);
      };
      tick();
    });
  }

  for (let number = 3; number >= 1; number -= 1) {
    elements.countdownValue.textContent = String(number);
    await sleep(700);
  }
  elements.countdownValue.textContent = "JÁ";
  await sleep(450);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function startSolo() {
  const name = saveName(elements.soloName.value) || "Jogador";
  const count = getSelectedRadioValue("soloCount");
  state.mode = "solo";
  state.playerName = name;
  resetRoundState();
  state.questions = pickQuestions(count);

  await runCountdown("Vai começar o caos enciclopédico");
  showScreen("screen-game");
  elements.opponentBadge.classList.add("hidden");
  startSoloQuestion();
}

function startSoloQuestion() {
  const question = getCurrentQuestion();
  state.currentInputDraft = null;
  state.questionStartedAt = performance.now();
  renderQuestion(question, state.currentIndex, state.questions.length);
  animateSoloTimer();
}

function animateSoloTimer() {
  clearInterval(state.questionTimer);
  const tick = () => {
    const elapsed = performance.now() - state.questionStartedAt;
    const ratio = Math.max(0, 1 - elapsed / QUESTION_MS);
    elements.timerBar.style.transform = `scaleX(${ratio})`;
    if (elapsed >= QUESTION_MS) {
      submitCurrentAnswer(null, true);
    }
  };
  tick();
  state.questionTimer = setInterval(tick, 40);
}

function submitCurrentAnswer(rawValue, timedOut = false) {
  const question = getCurrentQuestion();
  if (state.mode === "solo") {
    answerSolo(question, rawValue, timedOut);
  } else if (state.mode === "online") {
    submitOnlineAnswer(question, rawValue, timedOut);
  }
}

function answerSolo(question, rawValue, timedOut = false) {
  if (state.currentLocked) return;
  clearInterval(state.questionTimer);
  lockInteractiveArea();

  const elapsedMs = timedOut ? QUESTION_MS : Math.min(QUESTION_MS, performance.now() - state.questionStartedAt);
  const result = timedOut ? { value: null, correct: false, reveal: getRevealText(question) } : evaluateAnswer(question, rawValue);

  if (question.type === "multiple_choice" || question.type === "image_choice") applyChoiceReveal(question, result.value, true);
  if (result.correct) state.score += 1;
  state.answers.push({ questionId: question.id, value: result.value, correct: result.correct, elapsedMs });
  elements.currentScore.textContent = String(state.score);
  elements.timerBar.style.transform = "scaleX(0)";

  if (timedOut) showFeedbackText(false, "Tempo esgotado", getRevealText(question));
  else if (result.correct) showFeedbackText(true, `Certo! ${formatTime(elapsedMs)}`, "");
  else showFeedbackText(false, "Resposta incorreta", result.reveal);

  state.feedbackTimer = setTimeout(() => {
    state.currentIndex += 1;
    if (state.currentIndex >= state.questions.length) showSoloResults();
    else startSoloQuestion();
  }, FEEDBACK_MS);
}

function getRevealText(question) {
  if (question.type === "multiple_choice" || question.type === "image_choice") return `Resposta certa: ${question.options[question.correctIndex]}`;
  if (question.type === "text_input") return `Resposta aceita: ${question.acceptedAnswers[0]}`;
  if (question.type === "match_columns") return question.leftItems.map((left, idx) => `${left} → ${question.matches[idx]}`).join(" • ");
  return "";
}

function showSoloResults() {
  stopTimers();
  const totalTime = state.answers.reduce((sum, answer) => sum + answer.elapsedMs, 0);
  const average = state.answers.length ? totalTime / state.answers.length : 0;
  const ratio = state.score / state.questions.length;

  elements.resultEyebrow.textContent = "Resultado solo";
  elements.resultTitle.textContent = ratio >= .8 ? "Mandou muito bem" : ratio >= .5 ? "Boa rodada" : "Dá para melhorar";
  elements.resultSubtitle.textContent = `${state.playerName}, você sobreviveu a um mix de curiosidades inúteis, cultura pop e nostalgia.`;
  elements.resultCorrect.textContent = `${state.score}/${state.questions.length}`;
  elements.resultAverage.textContent = formatTime(average);
  elements.soloStats.classList.remove("hidden");
  elements.duelScoreboard.classList.add("hidden");
  elements.playAgainButton.textContent = "Jogar novamente";
  showScreen("screen-results");
}

function getStoredFirebaseConfig() {
  const stored = localStorage.getItem(FIREBASE_STORAGE_KEY);
  if (stored) {
    try { return JSON.parse(stored); } catch { localStorage.removeItem(FIREBASE_STORAGE_KEY); }
  }
  return DEFAULT_FIREBASE_CONFIG;
}

function validateFirebaseConfig(config) {
  const required = ["apiKey", "authDomain", "databaseURL", "projectId", "appId"];
  return config && required.every((key) => typeof config[key] === "string" && config[key].trim());
}

async function ensureFirebase(showDialogOnFailure = true) {
  if (state.firebase) return true;
  const config = getStoredFirebaseConfig();
  if (!validateFirebaseConfig(config)) {
    if (showDialogOnFailure) openFirebaseDialog();
    return false;
  }

  try {
    const [{ initializeApp }, authModule, databaseModule] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js")
    ]);
    const app = initializeApp(config);
    const auth = authModule.getAuth(app);
    await authModule.signInAnonymously(auth);
    const db = databaseModule.getDatabase(app);
    state.firebase = {
      app, auth, db,
      ref: databaseModule.ref,
      get: databaseModule.get,
      set: databaseModule.set,
      update: databaseModule.update,
      remove: databaseModule.remove,
      onValue: databaseModule.onValue,
      runTransaction: databaseModule.runTransaction,
      onDisconnect: databaseModule.onDisconnect
    };

    const offsetRef = state.firebase.ref(db, ".info/serverTimeOffset");
    state.firebase.onValue(offsetRef, (snapshot) => { state.serverOffset = snapshot.val() || 0; });
    elements.firebaseButton.textContent = "Online configurado";
    return true;
  } catch (error) {
    console.error(error);
    state.firebase = null;
    elements.firebaseStatus.textContent = firebaseErrorMessage(error);
    if (showDialogOnFailure) openFirebaseDialog();
    return false;
  }
}

function firebaseErrorMessage(error) {
  const code = error?.code || "";
  if (code.includes("api-key-not-valid")) return "A chave da API não é válida.";
  if (code.includes("operation-not-allowed")) return "Ative o login anônimo no Firebase Authentication.";
  if (code.includes("permission-denied")) return "As regras do Realtime Database bloquearam o acesso.";
  if (code.includes("network")) return "Não foi possível conectar ao Firebase.";
  return "Não foi possível iniciar o modo online. Confira a configuração.";
}

function openFirebaseDialog() {
  const config = getStoredFirebaseConfig();
  elements.firebaseConfigInput.value = config ? JSON.stringify(config, null, 2) : "";
  elements.firebaseStatus.textContent = config ? "Há uma configuração salva neste navegador." : "O modo solo funciona mesmo sem Firebase.";
  elements.firebaseDialog.showModal();
}

async function saveFirebaseConfig() {
  try {
    const config = JSON.parse(elements.firebaseConfigInput.value);
    if (!validateFirebaseConfig(config)) throw new Error("missing-fields");
    localStorage.setItem(FIREBASE_STORAGE_KEY, JSON.stringify(config));
    state.firebase = null;
    const ok = await ensureFirebase(false);
    if (!ok) return;
    elements.firebaseStatus.textContent = "Configuração salva e conexão concluída.";
    toast("Firebase conectado");
    setTimeout(() => elements.firebaseDialog.close(), 650);
  } catch (error) {
    elements.firebaseStatus.textContent = error.message === "missing-fields"
      ? "Preencha apiKey, authDomain, databaseURL, projectId e appId."
      : "O texto não está em formato JSON válido.";
  }
}

function clearFirebaseConfig() {
  localStorage.removeItem(FIREBASE_STORAGE_KEY);
  state.firebase = null;
  elements.firebaseConfigInput.value = "";
  elements.firebaseStatus.textContent = "Configuração apagada.";
  elements.firebaseButton.textContent = "Configurar online";
}

function getServerNow() {
  return Date.now() + state.serverOffset;
}

function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function roomRef(code, child = "") {
  const suffix = child ? `/${child}` : "";
  return state.firebase.ref(state.firebase.db, `quizRooms/${code}${suffix}`);
}

async function createRoom() {
  const name = saveName(elements.onlineName.value) || "Jogador 1";
  if (!(await ensureFirebase())) return;
  state.mode = "online";
  state.playerName = name;
  state.isHost = true;
  resetRoundState();

  let code = makeRoomCode();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const snapshot = await state.firebase.get(roomRef(code));
    if (!snapshot.exists()) break;
    code = makeRoomCode();
  }

  const selectedIds = pickQuestions(20).map((question) => question.id);
  const now = getServerNow();
  const room = {
    status: "lobby",
    hostInstanceId: state.instanceId,
    createdAt: now,
    questionIds: selectedIds,
    questionCount: 15,
    players: {
      [state.instanceId]: { name, joinedAt: now, connected: true }
    }
  };

  await state.firebase.set(roomRef(code), room);
  state.roomCode = code;
  watchRoom(code);
  const playerRef = roomRef(code, `players/${state.instanceId}/connected`);
  state.firebase.onDisconnect(playerRef).set(false);
  showScreen("screen-lobby");
}

async function joinRoom() {
  const name = saveName(elements.onlineName.value) || "Jogador 2";
  const code = normalizeCode(elements.roomCodeInput.value);
  if (code.length !== 6) {
    toast("Digite o código de 6 caracteres");
    return;
  }
  if (!(await ensureFirebase())) return;

  const snapshot = await state.firebase.get(roomRef(code));
  if (!snapshot.exists()) {
    toast("Sala não encontrada");
    return;
  }

  const room = snapshot.val();
  if (room.status !== "lobby") {
    toast("A partida desta sala já começou");
    return;
  }

  const activePlayers = Object.entries(room.players || {}).filter(([, player]) => player?.connected !== false);
  const alreadyInRoom = Boolean(room.players?.[state.instanceId]);
  if (activePlayers.length >= 2 && !alreadyInRoom) {
    toast("Esta sala já está cheia");
    return;
  }

  state.mode = "online";
  state.playerName = name;
  state.isHost = room.hostInstanceId === state.instanceId;
  state.roomCode = code;
  resetRoundState();

  await state.firebase.update(roomRef(code, `players/${state.instanceId}`), {
    name,
    joinedAt: getServerNow(),
    connected: true
  });
  const playerRef = roomRef(code, `players/${state.instanceId}/connected`);
  state.firebase.onDisconnect(playerRef).set(false);
  watchRoom(code);
  showScreen("screen-lobby");
}

function watchRoom(code) {
  state.roomUnsubscribe?.();
  state.roomUnsubscribe = state.firebase.onValue(roomRef(code), (snapshot) => {
    if (!snapshot.exists()) {
      if (state.roomCode === code) {
        toast("A sala foi encerrada");
        leaveRoom(false);
      }
      return;
    }

    state.room = snapshot.val();
    state.isHost = state.room.hostInstanceId === state.instanceId;
    const roomAnswers = state.room?.answers?.[state.instanceId] || {};
    Object.entries(roomAnswers).forEach(([index, answer]) => { state.answerCache[index] = answer; });
    renderLobby();
    if (state.room.status === "playing" && state.onlinePhaseKey !== "playing-started") {
      state.onlinePhaseKey = "playing-started";
      startOnlineGame();
    }
  });
}

function activePlayerEntries(room = state.room) {
  return Object.entries(room?.players || {})
    .filter(([, player]) => player?.connected !== false)
    .sort(([, a], [, b]) => (a.joinedAt || 0) - (b.joinedAt || 0));
}

function renderLobby() {
  if (!state.room) return;
  const players = activePlayerEntries();
  const first = players[0]?.[1];
  const second = players[1]?.[1];
  elements.lobbyRoomCode.textContent = state.roomCode || "------";
  elements.playerOneName.textContent = first?.name || "Aguardando...";
  elements.playerTwoName.textContent = second?.name || "Aguardando...";
  elements.playerTwoDot.classList.toggle("online", Boolean(second));
  if (elements.playerOneState) {
    elements.playerOneState.textContent = first ? "Conectado" : "Aguardando";
    elements.playerOneState.classList.toggle("is-online", Boolean(first));
  }
  if (elements.playerTwoState) {
    elements.playerTwoState.textContent = second ? "Conectado" : "Aguardando";
    elements.playerTwoState.classList.toggle("is-online", Boolean(second));
  }
  elements.duelCount.value = String(state.room.questionCount || 15);
  elements.duelCount.disabled = !state.isHost;
  elements.duelCountField.classList.toggle("hidden", !state.isHost);

  if (state.isHost) {
    elements.startDuelButton.classList.remove("hidden");
    elements.startDuelButton.disabled = players.length !== 2;
    elements.startDuelButton.textContent = players.length === 2 ? "Começar duelo" : "Aguardando adversário";
    elements.lobbyHint.textContent = players.length === 2 ? "Os dois jogadores estão prontos." : "Abra o jogo em outro navegador, celular ou aba anônima para testar.";
  } else {
    elements.startDuelButton.classList.add("hidden");
    elements.lobbyHint.textContent = "Aguardando o criador da sala começar.";
  }
}

async function updateDuelCount() {
  if (!state.isHost || !state.roomCode) return;
  await state.firebase.set(roomRef(state.roomCode, "questionCount"), Number(elements.duelCount.value));
}

async function startDuel() {
  if (!state.isHost || activePlayerEntries().length !== 2) return;
  const count = Number(state.room.questionCount || elements.duelCount.value || 15);
  const selectedIds = pickQuestions(count).map((question) => question.id);
  const startAt = getServerNow() + 4500;
  await state.firebase.update(roomRef(state.roomCode), {
    status: "playing",
    questionIds: selectedIds,
    questionCount: count,
    startAt,
    endedAt: null,
    answers: null
  });
}

async function startOnlineGame() {
  resetRoundState();
  state.mode = "online";
  const room = state.room;
  state.questions = (room.questionIds || []).map((id) => QUESTION_MAP.get(id)).filter(Boolean);
  const players = activePlayerEntries(room);
  const opponent = players.find(([id]) => id !== state.instanceId)?.[1];
  elements.opponentName.textContent = opponent?.name || "Adversário";
  elements.opponentBadge.classList.remove("hidden");
  if (getServerNow() < room.startAt) await runCountdown("Mesmas perguntas. Mesma pressão.", room.startAt);
  showScreen("screen-game");
  runOnlineLoop();
}

function runOnlineLoop() {
  stopTimers();
  const loop = () => {
    if (!state.room || state.room.status !== "playing") return;
    const elapsed = getServerNow() - state.room.startAt;
    if (elapsed < 0) {
      state.onlineLoop = requestAnimationFrame(loop);
      return;
    }
    const total = state.questions.length;
    const index = Math.floor(elapsed / ROUND_MS);
    const roundElapsed = elapsed % ROUND_MS;
    if (index >= total) {
      finishOnlineGame();
      return;
    }
    const phase = roundElapsed < QUESTION_MS ? "question" : "feedback";
    if (state.renderedOnlineIndex !== index) {
      state.renderedOnlineIndex = index;
      state.currentIndex = index;
      state.currentInputDraft = null;
      const existingAnswer = state.answerCache[index] || null;
      renderQuestion(state.questions[index], index, total, existingAnswer);
      if (existingAnswer && (state.questions[index].type === "multiple_choice" || state.questions[index].type === "image_choice")) {
        applyChoiceReveal(state.questions[index], existingAnswer.value, true);
      }
    }
    const ratio = phase === "question" ? Math.max(0, 1 - roundElapsed / QUESTION_MS) : 0;
    elements.timerBar.style.transform = `scaleX(${ratio})`;
    const phaseKey = `${phase}-${index}`;
    if (phase === "feedback" && state.onlinePhaseKey !== phaseKey) {
      state.onlinePhaseKey = phaseKey;
      showOnlineFeedback(index);
    } else if (phase === "question" && state.onlinePhaseKey !== phaseKey) {
      state.onlinePhaseKey = phaseKey;
    }
    state.onlineLoop = requestAnimationFrame(loop);
  };
  loop();
}

async function submitOnlineAnswer(question, rawValue, timedOut = false) {
  if (state.currentLocked) return;
  if (timedOut) { lockInteractiveArea(); return; }
  const index = state.currentIndex;
  const roundStartAt = state.room.startAt + index * ROUND_MS;
  const elapsedMs = Math.max(0, Math.min(QUESTION_MS, getServerNow() - roundStartAt));
  if (elapsedMs >= QUESTION_MS) return;
  const evaluated = evaluateAnswer(question, rawValue);
  const answerPayload = {
    value: evaluated.value,
    correct: evaluated.correct,
    elapsedMs: Math.round(elapsedMs),
    answeredAt: getServerNow()
  };
  const answerRef = roomRef(state.roomCode, `answers/${state.instanceId}/${index}`);
  const transaction = await state.firebase.runTransaction(answerRef, (current) => {
    if (current !== null) return current;
    return answerPayload;
  });
  const answer = transaction.snapshot.val();
  if (!transaction.committed || !answer) return;
  state.answerCache[index] = answer;
  lockInteractiveArea();
  if (question.type === "multiple_choice" || question.type === "image_choice") applyChoiceReveal(question, answer.value, true);
  if (answer.correct) {
    const correctCount = Object.values(state.answerCache).filter((item) => item?.correct).length;
    state.score = correctCount;
    elements.currentScore.textContent = String(state.score);
    showFeedbackText(true, `Resposta enviada em ${formatTime(answer.elapsedMs)}`, "");
  } else {
    showFeedbackText(false, "Resposta registrada", "");
  }
}

function showOnlineFeedback(index) {
  const question = state.questions[index];
  const answer = state.answerCache[index] || null;
  lockInteractiveArea();
  if (question.type === "multiple_choice" || question.type === "image_choice") applyChoiceReveal(question, answer?.value ?? null, true);
  if (!answer) showFeedbackText(false, "Tempo esgotado", getRevealText(question));
  else if (answer.correct) showFeedbackText(true, `Certo! ${formatTime(answer.elapsedMs)}`, "");
  else showFeedbackText(false, "Resposta incorreta", getRevealText(question));
}

async function finishOnlineGame() {
  stopTimers();
  if (state.room?.status !== "finished" && state.isHost && state.roomCode) {
    await state.firebase.update(roomRef(state.roomCode), { status: "finished", endedAt: getServerNow() });
  }
  const fresh = await state.firebase.get(roomRef(state.roomCode));
  if (fresh.exists()) state.room = fresh.val();
  showOnlineResults();
}

function playerResult(instanceId, player) {
  const answers = state.room?.answers?.[instanceId] || {};
  const entries = Object.values(answers);
  const correct = entries.filter((answer) => answer?.correct).length;
  const time = entries.reduce((sum, answer) => sum + (answer?.elapsedMs || QUESTION_MS), 0) + (state.questions.length - entries.length) * QUESTION_MS;
  return { instanceId, name: player?.name || "Jogador", correct, time };
}

function showOnlineResults() {
  const players = activePlayerEntries(state.room);
  const results = players.map(([id, player]) => playerResult(id, player));
  results.sort((a, b) => b.correct - a.correct || a.time - b.time);
  const winner = results[0];
  const tied = results.length === 2 && results[0].correct === results[1].correct && results[0].time === results[1].time;
  elements.resultEyebrow.textContent = "Resultado do duelo";
  elements.resultTitle.textContent = tied ? "Empate absurdo" : winner?.instanceId === state.instanceId ? "Você venceu" : `${winner?.name || "Adversário"} venceu`;
  elements.resultSubtitle.textContent = tied ? "Mesmo número de acertos e o mesmo tempo total." : "Mais acertos vencem. O menor tempo decide em caso de empate.";
  elements.soloStats.classList.add("hidden");
  elements.duelScoreboard.classList.remove("hidden");
  elements.playAgainButton.textContent = "Pedir revanche";
  renderScoreRow(elements.scorePlayerOne, results[0], true);
  renderScoreRow(elements.scorePlayerTwo, results[1], false);
  showScreen("screen-results");
}

function renderScoreRow(element, result, isWinner) {
  if (!result) {
    element.innerHTML = "<strong>Aguardando resultado...</strong>";
    element.className = "score-row";
    return;
  }
  element.className = `score-row${isWinner ? " winner" : ""}`;
  element.innerHTML = `<strong>${escapeHtml(result.name)}${result.instanceId === state.instanceId ? " (você)" : ""}</strong><span>${result.correct}/${state.questions.length} acertos</span><span>${formatTime(result.time)}</span>`;
}

async function rematchOnline() {
  if (!state.roomCode || !state.room) { goHome(); return; }
  if (state.isHost) {
    await state.firebase.update(roomRef(state.roomCode), { status: "lobby", startAt: null, endedAt: null, answers: null });
  }
  state.onlinePhaseKey = null;
  resetRoundState();
  showScreen("screen-lobby");
  renderLobby();
}

async function leaveRoom(removeIfHost = true) {
  stopTimers();
  state.roomUnsubscribe?.();
  state.roomUnsubscribe = null;
  if (state.firebase && state.roomCode) {
    try {
      if (state.isHost && removeIfHost) await state.firebase.remove(roomRef(state.roomCode));
      else await state.firebase.update(roomRef(state.roomCode, `players/${state.instanceId}`), { connected: false });
    } catch (error) { console.warn(error); }
  }
  state.roomCode = null;
  state.room = null;
  state.isHost = false;
  state.onlinePhaseKey = null;
  goHome();
}

function playAgain() {
  if (state.mode === "solo") showScreen("screen-solo-setup");
  else if (state.mode === "online") rematchOnline();
  else goHome();
}

elements.homeButton.addEventListener("click", () => { if (state.roomCode) leaveRoom(); else goHome(); });
$$("[data-go-home]").forEach((button) => button.addEventListener("click", goHome));

elements.soloModeButton.addEventListener("click", () => { elements.soloName.value = getSavedName(); showScreen("screen-solo-setup"); });
elements.onlineModeButton.addEventListener("click", async () => { elements.onlineName.value = getSavedName(); showScreen("screen-online-menu"); ensureFirebase(false); });
elements.startSoloButton.addEventListener("click", startSolo);
elements.createRoomButton.addEventListener("click", createRoom);
elements.joinRoomButton.addEventListener("click", joinRoom);
elements.leaveRoomButton.addEventListener("click", () => leaveRoom());
elements.startDuelButton.addEventListener("click", startDuel);
elements.duelCount.addEventListener("change", updateDuelCount);
elements.playAgainButton.addEventListener("click", playAgain);
elements.resultsHomeButton.addEventListener("click", () => { if (state.roomCode) leaveRoom(); else goHome(); });

elements.copyRoomCodeButton.addEventListener("click", async () => { if (!state.roomCode) return; await navigator.clipboard.writeText(state.roomCode); toast("Código copiado"); });
elements.roomCodeInput.addEventListener("input", (event) => { event.target.value = normalizeCode(event.target.value); });
elements.firebaseButton.addEventListener("click", openFirebaseDialog);
elements.saveFirebaseButton.addEventListener("click", saveFirebaseConfig);
elements.clearFirebaseButton.addEventListener("click", clearFirebaseConfig);

elements.firebaseDialog.addEventListener("click", (event) => {
  const rect = elements.firebaseDialog.getBoundingClientRect();
  const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  if (!inside) elements.firebaseDialog.close();
});

window.addEventListener("beforeunload", () => { stopTimers(); });

elements.soloName.value = getSavedName();
elements.onlineName.value = getSavedName();
if (validateFirebaseConfig(getStoredFirebaseConfig())) elements.firebaseButton.textContent = "Online configurado";
showScreen("screen-home");
