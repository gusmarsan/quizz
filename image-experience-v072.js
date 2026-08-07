import { getApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const FIREBASE_APP_NAME = "burrquizzz-online-v231";
const ROOM_COLLECTION = "battleshipRooms";
const PRELOAD_ID = "burrNextVisualPreload";

let soloRound = [];
let duelQuestions = [];
let duelCurrentIndex = -1;
let watchedRoomCode = "";
let unsubscribeRoom = null;
let capturedSliceRestore = null;

boot();

function boot() {
  injectStyles();
  prepareQuestionImage();
  installSoloRoundCapture();
  observeQuestionChanges();
  observeScreenChanges();
  ensureDuelWatch();
}

function prepareQuestionImage() {
  const image = document.querySelector("#questionImage");
  if (!image) return;

  image.removeAttribute("loading");
  image.decoding = "async";
  image.alt = "";

  image.addEventListener("load", () => setImageState("ready"));
  image.addEventListener("error", () => setImageState("error"));

  new MutationObserver(() => {
    const wrap = document.querySelector("#questionImageWrap");
    const src = image.getAttribute("src") || "";
    if (!src || wrap?.classList.contains("hidden")) {
      image.alt = "";
      setImageState("idle");
      return;
    }

    image.removeAttribute("loading");
    image.decoding = "async";
    image.alt = getCurrentImageAlt();
    setImageState(image.complete && image.naturalWidth > 0 ? "ready" : "loading");
  }).observe(image, { attributes: true, attributeFilter: ["src", "alt", "loading"] });
}

function installSoloRoundCapture() {
  const button = document.querySelector("#startSoloButton");
  if (!button) return;

  button.addEventListener("click", () => {
    restoreArraySlice();
    const originalSlice = Array.prototype.slice;

    Array.prototype.slice = function patchedSlice(start, end) {
      const result = originalSlice.apply(this, arguments);

      if (
        start === 0 &&
        [10, 15, 16].includes(Number(end)) &&
        looksLikeQuestionArray(this) &&
        looksLikeQuestionArray(result)
      ) {
        soloRound = result.map(cloneQuestion);
        preloadNextVisual(soloRound, -1);
      }

      return result;
    };

    capturedSliceRestore = () => {
      if (Array.prototype.slice !== originalSlice) Array.prototype.slice = originalSlice;
      capturedSliceRestore = null;
    };

    window.setTimeout(restoreArraySlice, 0);
  }, true);
}

function restoreArraySlice() {
  capturedSliceRestore?.();
}

function observeQuestionChanges() {
  const questionText = document.querySelector("#questionText");
  if (!questionText) return;

  new MutationObserver(() => {
    syncQuestionImageAccessibility();
    updateSoloPreload();
    updateDuelPreload();
    ensureDuelWatch();
  }).observe(questionText, {
    childList: true,
    characterData: true,
    subtree: true
  });
}

function observeScreenChanges() {
  document.querySelectorAll(".screen").forEach((screen) => {
    new MutationObserver(() => {
      if (!screen.classList.contains("active")) return;
      ensureDuelWatch();
      if (screen.id === "screen-game") {
        syncQuestionImageAccessibility();
        updateSoloPreload();
        updateDuelPreload();
      }
    }).observe(screen, { attributes: true, attributeFilter: ["class"] });
  });
}

function updateSoloPreload() {
  if (!soloRound.length || getRoomCode()) return;
  const prompt = normalize(document.querySelector("#questionText")?.textContent);
  if (!prompt) return;

  const index = soloRound.findIndex((question) => normalize(question.prompt) === prompt);
  if (index >= 0) preloadNextVisual(soloRound, index);
}

function updateDuelPreload() {
  if (!duelQuestions.length || !getRoomCode()) return;
  const prompt = normalize(document.querySelector("#questionText")?.textContent);
  let index = duelCurrentIndex;

  if (prompt) {
    const promptIndex = duelQuestions.findIndex((question) => normalize(question.prompt) === prompt);
    if (promptIndex >= 0) index = promptIndex;
  }

  preloadNextVisual(duelQuestions, index);
}

function preloadNextVisual(items, currentIndex) {
  const nextVisual = findNextVisual(items, currentIndex);
  setPreload(nextVisual?.image || "");
}

function findNextVisual(items, currentIndex) {
  for (let index = Math.max(-1, currentIndex) + 1; index < items.length; index += 1) {
    const question = items[index];
    if (question?.image) return question;
  }
  return null;
}

function setPreload(url) {
  let link = document.querySelector(`#${PRELOAD_ID}`);

  if (!url) {
    link?.remove();
    return;
  }

  if (!link) {
    link = document.createElement("link");
    link.id = PRELOAD_ID;
    link.rel = "preload";
    link.as = "image";
    document.head.appendChild(link);
  }

  if (link.href !== new URL(url, document.baseURI).href) link.href = url;
}

function ensureDuelWatch() {
  const code = getRoomCode();
  if (!code) {
    unsubscribeRoom?.();
    unsubscribeRoom = null;
    watchedRoomCode = "";
    duelQuestions = [];
    duelCurrentIndex = -1;
    return;
  }

  if (code === watchedRoomCode && unsubscribeRoom) return;

  let app;
  try {
    app = getApp(FIREBASE_APP_NAME);
  } catch {
    return;
  }

  unsubscribeRoom?.();
  watchedRoomCode = code;

  const reference = doc(getFirestore(app), ROOM_COLLECTION, code);
  unsubscribeRoom = onSnapshot(reference, (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.data();
    duelQuestions = Array.isArray(data.questions) ? data.questions.map(cloneQuestion) : [];
    duelCurrentIndex = Math.max(0, Number(data.currentIndex || 0));

    const gameActive = document.querySelector("#screen-game")?.classList.contains("active");
    if (gameActive) updateDuelPreload();
    else if (data.status === "playing") preloadNextVisual(duelQuestions, -1);
  }, () => {
    // O preload é otimização. Uma falha aqui não interfere no duelo.
  });
}

function syncQuestionImageAccessibility() {
  const image = document.querySelector("#questionImage");
  const wrap = document.querySelector("#questionImageWrap");
  if (!image || !wrap || wrap.classList.contains("hidden") || !image.getAttribute("src")) return;
  image.removeAttribute("loading");
  image.decoding = "async";
  image.alt = getCurrentImageAlt();
}

function getCurrentImageAlt() {
  const prompt = normalize(document.querySelector("#questionText")?.textContent);
  const candidates = getRoomCode() ? duelQuestions : soloRound;
  const current = candidates.find((question) => normalize(question.prompt) === prompt);
  const explicitAlt = String(current?.imageAlt || "").trim();
  return explicitAlt || "Imagem necessária para responder à pergunta";
}

function setImageState(state) {
  const wrap = document.querySelector("#questionImageWrap");
  if (!wrap) return;
  wrap.dataset.imageState = state;
  wrap.setAttribute("aria-busy", state === "loading" ? "true" : "false");
}

function getRoomCode() {
  return String(new URL(location.href).searchParams.get("room") || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

function looksLikeQuestionArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every((item) =>
    item && typeof item === "object" && typeof item.prompt === "string" && Array.isArray(item.options)
  );
}

function cloneQuestion(question) {
  return {
    ...question,
    options: Array.isArray(question?.options) ? [...question.options] : []
  };
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function injectStyles() {
  if (document.querySelector("#burrImageExperienceV072Styles")) return;

  const style = document.createElement("style");
  style.id = "burrImageExperienceV072Styles";
  style.textContent = `
    #screen-game .question-image-wrap {
      position: relative;
      display: grid;
      width: 100%;
      height: clamp(220px, 42vw, 390px);
      padding: 10px;
      place-items: center;
      overflow: hidden;
      border: 1px solid #d7e3f0;
      border-radius: var(--radius-lg);
      background: #f4f8fd;
    }

    #screen-game .question-image-wrap.hidden {
      display: none !important;
    }

    #screen-game .question-image-wrap img {
      display: block;
      width: 100%;
      height: 100%;
      max-width: 100%;
      max-height: 100%;
      aspect-ratio: auto !important;
      object-fit: contain !important;
      object-position: center;
      background: transparent;
    }

    #screen-game .question-image-wrap[data-image-state="loading"]::after {
      content: "Carregando imagem…";
      position: absolute;
      inset: auto 12px 10px;
      color: #617b9d;
      font-size: .72rem;
      font-weight: 800;
      text-align: center;
      pointer-events: none;
    }

    #screen-game .question-image-wrap[data-image-state="error"] img {
      visibility: hidden;
    }

    #screen-game .question-image-wrap[data-image-state="error"]::after {
      content: "Não foi possível carregar a imagem";
      color: #7a4450;
      font-size: .82rem;
      font-weight: 800;
      text-align: center;
    }

    @media (max-width: 680px) {
      #screen-game .question-image-wrap {
        height: clamp(180px, 52vw, 300px);
        padding: 8px;
      }
    }

    @media (max-height: 740px) {
      #screen-game .question-image-wrap {
        height: clamp(150px, 32vh, 240px);
      }
    }

    @media (orientation: landscape) and (max-height: 560px) {
      #screen-game .question-image-wrap {
        width: min(100%, 520px);
        height: clamp(130px, 38vh, 210px);
        margin-inline: auto;
        padding: 6px;
      }
    }
  `;
  document.head.appendChild(style);
}
