import { QUESTIONS } from "./questions.js";

const EPISODE_STORAGE_KEY = "burrquizzzCurrentEpisode";
const QUESTION_MS = 18000;
const FEEDBACK_MS = 2300;
const BLOCK_TRANSITION_MS = 1700;
const TOTAL_DISCOVERIES = 16;

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

let running = false;
let questions = [];
let currentIndex = 0;
let score = 0;
let answers = [];
let startedAt = 0;
let timer = null;
let feedbackTimer = null;
let transition = null;

prepareSetup();
interceptStudioEntry();

function prepareSetup() {
  const fieldset = $("#screen-solo-setup fieldset");
  if (!fieldset) return;

  const segmented = $(".segmented", fieldset);
  if (segmented) {
    segmented.innerHTML = `
      <label class="burr-fixed-count">
        <input type="radio" name="soloCount" value="16" checked />
        <span>16 descobertas</span>
      </label>
    `;
  }

  const legend = $("legend", fieldset);
  if (legend) legend.textContent = "Formato do episódio";
}

function interceptStudioEntry() {
  const startButton = $("#startSoloButton");
  if (!startButton) return;

  startButton.addEventListener("click", (event) => {
    const episodeOverlay = $(".burr-episode-overlay");
    const isStudioEntry = episodeOverlay?.hidden !== false;
    const available = QUESTIONS.filter(isSupportedDiscovery);

    if (!isStudioEntry || available.length < TOTAL_DISCOVERIES) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    startEpisode(available.slice(0, TOTAL_DISCOVERIES));
  }, true);
}

async function startEpisode(selected) {
  stopRuntime();
  running = true;
  questions = selected;
  currentIndex = 0;
  score = 0;
  answers = [];

  $("#opponentBadge")?.classList.add("hidden");
  await showBlockTransition(getBlock(0), 0, true);
  showGameScreen();
  startDiscovery();
}

function showGameScreen() {
  $$(".screen").forEach((screen) => {
    screen.classList.toggle("active", screen.id === "screen-game");
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function startDiscovery() {
  if (!running) return;

  const question = questions[currentIndex];
  const block = getBlock(currentIndex);
  const blockPosition = currentIndex % 4;
  const isFinal = currentIndex === questions.length - 1;

  renderProgress(block, blockPosition, isFinal);
  renderQuestion(question, isFinal);
  startedAt = performance.now();
  animateTimer(isFinal ? 21000 : QUESTION_MS);
}

function renderProgress(block, blockPosition, isFinal) {
  let progress = $("#burrBlockProgress");
  if (!progress) {
    progress = document.createElement("div");
    progress.id = "burrBlockProgress";
    progress.className = "burr-block-progress";
    const gameHeader = $("#screen-game .game-header");
    gameHeader?.insertAdjacentElement("afterend", progress);
  }

  const blockNumber = Math.floor(currentIndex / 4) + 1;
  const percentage = ((currentIndex + 1) / questions.length) * 100;
  const progressScale = Math.min(1, Math.max(0, percentage / 100));
  progress.innerHTML = `
    <div class="burr-block-progress-copy">
      <strong>${isFinal ? "⭐ Grande Final" : escapeHtml(block.title)}</strong>
      <span>Bloco ${blockNumber}/4 · ${blockPosition + 1}/4</span>
    </div>
    <div class="burr-episode-track"><span style="transform:scaleX(${progressScale})"></span></div>
  `;
}

function renderQuestion(question, isFinal) {
  $("#questionNumber").textContent = String(currentIndex + 1);
  $("#questionTotal").textContent = String(questions.length);
  $("#questionCategory").textContent = isFinal ? "GRANDE FINAL" : question.category;
  $("#questionType").textContent = question.type === "image_choice" ? "Imagem" : "Escolha";
  $("#questionText").textContent = question.prompt;
  $("#currentScore").textContent = String(score);

  const card = $("#screen-game .question-card");
  card?.classList.toggle("burr-grand-final", isFinal);

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

  question.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "answer-button";
    button.dataset.answerIndex = String(index);
    button.innerHTML = `<span class="answer-letter">${String.fromCharCode(65 + index)}</span><span>${escapeHtml(option)}</span>`;
    button.addEventListener("click", () => answer(index));
    stack.appendChild(button);
  });

  area.appendChild(stack);
}

function animateTimer(duration) {
  clearInterval(timer);
  const bar = $("#timerBar");
  const tick = () => {
    const elapsed = performance.now() - startedAt;
    const ratio = Math.max(0, 1 - elapsed / duration);
    bar.style.transform = `scaleX(${ratio})`;
    if (elapsed >= duration) answer(null, true);
  };
  tick();
  timer = setInterval(tick, 40);
}

function answer(selected, timedOut = false) {
  if (!running || $("#answersArea .answer-button:disabled")) return;
  clearInterval(timer);

  const question = questions[currentIndex];
  const elapsedMs = timedOut ? QUESTION_MS : performance.now() - startedAt;
  const correct = selected === question.correctIndex;

  $$("#answersArea .answer-button").forEach((button) => {
    button.disabled = true;
    const index = Number(button.dataset.answerIndex);
    if (index === question.correctIndex) button.classList.add("correct");
    if (selected !== null && index === selected && !correct) button.classList.add("wrong");
  });

  if (correct) score += 1;
  answers.push({ correct, elapsedMs });
  $("#currentScore").textContent = String(score);
  $("#timerBar").style.transform = "scaleX(0)";

  const feedback = $("#feedbackBanner");
  const explanation = question.explanation || `Resposta certa: ${question.options[question.correctIndex]}`;
  if (timedOut) {
    feedback.textContent = `Tempo esgotado — ${explanation}`;
    feedback.className = "feedback-banner bad";
  } else if (correct) {
    feedback.textContent = `Certo! ${(elapsedMs / 1000).toFixed(1).replace(".", ",")}s — ${explanation}`;
    feedback.className = "feedback-banner good";
  } else {
    feedback.textContent = `Resposta incorreta — ${explanation}`;
    feedback.className = "feedback-banner bad";
  }

  feedbackTimer = setTimeout(advance, FEEDBACK_MS);
}

async function advance() {
  currentIndex += 1;

  if (currentIndex >= questions.length) {
    showResults();
    return;
  }

  if (currentIndex % 4 === 0) {
    await showBlockTransition(getBlock(currentIndex), Math.floor(currentIndex / 4), false);
    showGameScreen();
  }

  startDiscovery();
}

function getBlock(index) {
  const episode = readEpisode();
  const blockIndex = Math.floor(index / 4);
  const stored = episode?.blocks?.[blockIndex];
  if (stored) return stored;

  const fallbacks = [
    { title: "📼 Rebobina!", intro: "Memórias desbloqueadas. Não nos responsabilizamos pelo que aparecer." },
    { title: "🎸 Aumenta o volume", intro: "Histórias musicais que merecem ser ouvidas — ou questionadas." },
    { title: "👽 Mundo Bizarro", intro: "A partir daqui, a realidade perde qualquer compromisso com o bom senso." },
    { title: "⭐ Grande Final", intro: "Quatro últimas descobertas. A derradeira veio para causar discussão." }
  ];
  return fallbacks[blockIndex] || fallbacks[0];
}

function showBlockTransition(block, blockIndex, first) {
  return new Promise((resolve) => {
    if (!transition) createTransition();

    const label = $("#burrBlockLabel", transition);
    const title = $("#burrBlockTitle", transition);
    const intro = $("#burrBlockIntro", transition);
    const next = $("#burrBlockNext", transition);

    label.textContent = blockIndex === 3 ? "GRANDE FINAL" : `BLOCO ${blockIndex + 1} DE 4`;
    title.textContent = block.title;
    intro.textContent = block.intro || "Prepare-se para mais quatro descobertas de utilidade questionável.";
    next.textContent = first ? "O episódio começa agora" : "Próximo bloco";

    transition.hidden = false;
    requestAnimationFrame(() => transition.classList.add("visible"));

    setTimeout(() => {
      transition.classList.remove("visible");
      setTimeout(() => {
        transition.hidden = true;
        resolve();
      }, 220);
    }, BLOCK_TRANSITION_MS);
  });
}

function createTransition() {
  transition = document.createElement("div");
  transition.className = "burr-block-transition";
  transition.hidden = true;
  transition.innerHTML = `
    <div class="burr-block-transition-card">
      <p id="burrBlockLabel"></p>
      <h2 id="burrBlockTitle"></h2>
      <p id="burrBlockIntro"></p>
      <small id="burrBlockNext"></small>
    </div>
  `;
  document.body.appendChild(transition);

  const style = document.createElement("style");
  style.textContent = `
    .burr-fixed-count { width: 100%; }
    .burr-fixed-count span { width: 100%; }
    .burr-block-progress { margin: 14px 0 12px; }
    .burr-block-progress-copy { display:flex; justify-content:space-between; gap:12px; align-items:center; margin-bottom:7px; font-size:.78rem; }
    .burr-block-progress-copy strong { text-transform:uppercase; letter-spacing:.06em; }
    .burr-block-progress-copy span { opacity:.7; white-space:nowrap; }
    .burr-episode-track { height:7px; overflow:hidden; border-radius:999px; background:rgba(17,61,150,.12); }
    .burr-episode-track span { display:block; width:100%; height:100%; border-radius:inherit; background:linear-gradient(90deg,#143f99,#7b2aa8,#ff4778); transform-origin:left center; transition:transform .35s ease; }
    .question-card.burr-grand-final { outline:3px solid #ffcc33; outline-offset:3px; box-shadow:0 18px 46px rgba(4,31,86,.2); }
    .question-card.burr-grand-final .category-chip { background:#ffcc33; color:#281700; }
    .burr-block-transition { position:fixed; inset:0; z-index:12000; display:grid; place-items:center; padding:24px; background:radial-gradient(circle at 20% 20%,rgba(255,211,61,.27),transparent 35%),linear-gradient(145deg,#071b4d,#173f96 55%,#76248e); color:#fff; opacity:0; transition:opacity .22s ease; }
    .burr-block-transition[hidden] { display:none; }
    .burr-block-transition.visible { opacity:1; }
    .burr-block-transition-card { width:min(100%,620px); text-align:center; padding:42px 30px; border:0; border-radius:20px; background:#0b285f; box-shadow:0 24px 70px rgba(0,0,0,.32); transform:scale(.96); transition:transform .28s ease; }
    .burr-block-transition.visible .burr-block-transition-card { transform:scale(1); }
    #burrBlockLabel { margin:0 0 14px; color:#ffdb55; font-weight:900; font-size:.78rem; letter-spacing:.08em; }
    #burrBlockTitle { margin:0; font-size:clamp(2.3rem,9vw,4.7rem); line-height:.98; letter-spacing:-.03em; }
    #burrBlockIntro { max-width:470px; margin:22px auto; font-size:1.08rem; line-height:1.5; color:rgba(255,255,255,.88); }
    #burrBlockNext { font-weight:800; text-transform:uppercase; letter-spacing:.1em; opacity:.65; }
  `;
  document.head.appendChild(style);
}

function showResults() {
  stopRuntime(false);

  const totalTime = answers.reduce((sum, answer) => sum + answer.elapsedMs, 0);
  const average = answers.length ? totalTime / answers.length : 0;
  const ratio = score / questions.length;

  $("#resultEyebrow").textContent = "Burrômetro";
  $("#resultTitle").textContent = ratio >= .85 ? "Inutilmente brilhante" : ratio >= .6 ? "Cultura duvidosa em alta" : ratio >= .35 ? "Sobreviveu ao episódio" : "Agora você sabe mais";
  $("#resultSubtitle").textContent = ratio >= .85
    ? "Seu domínio de informações desnecessárias merece respeito e talvez alguma preocupação."
    : ratio >= .6
      ? "Você foi bem. Claramente passou tempo demais prestando atenção nas coisas certas — ou erradas."
      : ratio >= .35
        ? "Não foi um massacre intelectual. E as histórias boas vieram justamente das que você errou."
        : "O Burrquizzz não julga. Ele apenas registra que você entrou sabendo pouco e saiu perigosamente informado.";
  $("#resultCorrect").textContent = `${score}/${questions.length}`;
  $("#resultAverage").textContent = `${(average / 1000).toFixed(1).replace(".", ",")}s`;
  $("#soloStats").classList.remove("hidden");
  $("#duelScoreboard").classList.add("hidden");
  $("#playAgainButton").textContent = "Novo episódio";

  $$(".screen").forEach((screen) => screen.classList.toggle("active", screen.id === "screen-results"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function stopRuntime(clear = true) {
  clearInterval(timer);
  clearTimeout(feedbackTimer);
  running = false;
  if (clear) {
    questions = [];
    answers = [];
  }
}

function readEpisode() {
  try {
    return JSON.parse(localStorage.getItem(EPISODE_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function isSupportedDiscovery(item) {
  return item && (item.type === "multiple_choice" || item.type === "image_choice") && Array.isArray(item.options) && item.options.length === 4;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
