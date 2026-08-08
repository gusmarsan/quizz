const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCtZKE8YL2xC0hj0eWWrtGsuYCLEleLjoQ",
  authDomain: "batalha-naval-gus.firebaseapp.com",
  projectId: "batalha-naval-gus",
  storageBucket: "batalha-naval-gus.firebasestorage.app",
  messagingSenderId: "530937327103",
  appId: "1:530937327103:web:ab1bd4538f1af6c2b70bca"
};

const METRICS_COLLECTION = "battleshipRooms";
const METRIC_TYPE = "burrquizzz-metric-v1";
const APP_VERSION = "0.9";
const INSTALL_ID_KEY = "burrquizzzInstallIdV09";
const NAME_STORAGE_KEY = "quizDuelPlayerName";
const HEARTBEAT_MS = 30000;

let firebasePromise = null;
let db = null;
let auth = null;
let user = null;
let setDoc = null;
let doc = null;
let serverTimestamp = null;
let activeGame = null;
let lastScreenId = document.querySelector(".screen.active")?.id || "";
let heartbeatTimer = null;

const pageSessionId = crypto.randomUUID();
const installId = getOrCreateInstallId();

boot();

function boot() {
  document.querySelectorAll(".screen").forEach((screen) => {
    new MutationObserver(handleScreenChange).observe(screen, {
      attributes: true,
      attributeFilter: ["class"]
    });
  });

  ["#questionNumber", "#questionTotal", "#currentScore"].forEach((selector) => {
    const node = document.querySelector(selector);
    if (node) new MutationObserver(captureLiveState).observe(node, { childList: true, subtree: true, characterData: true });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && activeGame) void writeHeartbeat();
  });

  window.addEventListener("pagehide", () => {
    if (activeGame) void writeHeartbeat();
  });
}

function getOrCreateInstallId() {
  let value = localStorage.getItem(INSTALL_ID_KEY);
  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(INSTALL_ID_KEY, value);
  }
  return value;
}

function handleScreenChange() {
  const nextScreenId = document.querySelector(".screen.active")?.id || "";
  if (!nextScreenId || nextScreenId === lastScreenId) return;

  const previousScreenId = lastScreenId;
  lastScreenId = nextScreenId;

  if (nextScreenId === "screen-game" && !activeGame) {
    window.setTimeout(() => void startMetricGame(), 80);
    return;
  }

  if (activeGame && previousScreenId === "screen-game") {
    if (nextScreenId === "screen-results") void finishMetricGame("completed");
    else void finishMetricGame("left_game");
  }
}

function detectMode() {
  const opponent = document.querySelector("#opponentBadge");
  return opponent && !opponent.classList.contains("hidden") ? "duel" : "solo";
}

function getPlayerName() {
  return String(
    localStorage.getItem(NAME_STORAGE_KEY) ||
    document.querySelector("#soloName")?.value ||
    document.querySelector("#onlineName")?.value ||
    "Jogador"
  ).trim().slice(0, 18) || "Jogador";
}

function readNumber(selector) {
  const value = Number.parseInt(document.querySelector(selector)?.textContent || "0", 10);
  return Number.isFinite(value) ? value : 0;
}

function captureLiveState() {
  if (!activeGame) return;
  activeGame.lastQuestion = Math.max(activeGame.lastQuestion, readNumber("#questionNumber"));
  activeGame.questionsTotal = Math.max(activeGame.questionsTotal, readNumber("#questionTotal"));
  activeGame.score = Math.max(activeGame.score, readNumber("#currentScore"));
}

async function startMetricGame() {
  if (activeGame || !document.querySelector("#screen-game.active")) return;

  const now = Date.now();
  const gameId = `metric_${crypto.randomUUID()}`;
  activeGame = {
    gameId,
    startedAtClient: now,
    playerName: getPlayerName(),
    mode: detectMode(),
    questionsTotal: readNumber("#questionTotal"),
    lastQuestion: readNumber("#questionNumber"),
    score: readNumber("#currentScore")
  };

  await writeMetric({
    gameType: METRIC_TYPE,
    metricSchema: 1,
    appVersion: APP_VERSION,
    installId,
    pageSessionId,
    gameId,
    playerName: activeGame.playerName,
    mode: activeGame.mode,
    uid: null,
    status: "playing",
    startedAt: timestamp(),
    startedAtClient: now,
    lastSeenAt: timestamp(),
    lastSeenAtClient: now,
    endedAt: null,
    endedAtClient: null,
    durationSeconds: 0,
    questionsTotal: activeGame.questionsTotal,
    lastQuestion: activeGame.lastQuestion,
    score: activeGame.score,
    device: /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? "mobile" : "desktop",
    launchMode: window.matchMedia?.("(display-mode: standalone)")?.matches ? "pwa" : "browser"
  });

  clearInterval(heartbeatTimer);
  heartbeatTimer = window.setInterval(() => void writeHeartbeat(), HEARTBEAT_MS);
}

async function writeHeartbeat() {
  if (!activeGame) return;
  captureLiveState();
  const now = Date.now();
  await writeMetric({
    lastSeenAt: timestamp(),
    lastSeenAtClient: now,
    durationSeconds: Math.max(0, Math.round((now - activeGame.startedAtClient) / 1000)),
    questionsTotal: activeGame.questionsTotal,
    lastQuestion: activeGame.lastQuestion,
    score: activeGame.score
  });
}

async function finishMetricGame(status) {
  if (!activeGame) return;
  const finished = activeGame;
  captureLiveState();
  clearInterval(heartbeatTimer);
  heartbeatTimer = null;
  activeGame = null;

  const now = Date.now();
  await writeMetricFor(finished.gameId, {
    status,
    endedAt: timestamp(),
    endedAtClient: now,
    lastSeenAt: timestamp(),
    lastSeenAtClient: now,
    durationSeconds: Math.max(0, Math.round((now - finished.startedAtClient) / 1000)),
    questionsTotal: finished.questionsTotal,
    lastQuestion: finished.lastQuestion,
    score: finished.score
  });
}

function timestamp() {
  return serverTimestamp ? serverTimestamp() : null;
}

async function ensureFirebase() {
  if (db && user) return;
  if (!firebasePromise) {
    firebasePromise = Promise.all([
      import("https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js")
    ]).then(async ([appModule, authModule, firestoreModule]) => {
      const app = appModule.initializeApp(FIREBASE_CONFIG, "burrquizzz-metrics-v09");
      auth = authModule.getAuth(app);
      try {
        await authModule.setPersistence(auth, authModule.browserLocalPersistence);
      } catch {
        // A persistência pode já estar configurada.
      }
      if (!auth.currentUser) await authModule.signInAnonymously(auth);
      user = auth.currentUser;
      db = firestoreModule.getFirestore(app);
      doc = firestoreModule.doc;
      setDoc = firestoreModule.setDoc;
      serverTimestamp = firestoreModule.serverTimestamp;
    }).catch((error) => {
      firebasePromise = null;
      throw error;
    });
  }
  await firebasePromise;
}

async function writeMetric(fields) {
  if (!activeGame) return;
  await writeMetricFor(activeGame.gameId, fields);
}

async function writeMetricFor(gameId, fields) {
  try {
    await ensureFirebase();
    await setDoc(doc(db, METRICS_COLLECTION, gameId), {
      ...fields,
      uid: user?.uid || null
    }, { merge: true });
  } catch (error) {
    console.warn("Métrica do Burrquizzz não pôde ser registrada.", error);
  }
}
