import { QUESTIONS } from "./questions.js";

const HOSTS = [
  { name: "Nico", line: "Hoje tem cultura pop, histórias improváveis e conhecimento de utilidade rigorosamente duvidosa." },
  { name: "Vera", line: "Prepare a memória: algumas descobertas podem desbloquear lembranças que estavam quietas desde os anos 90." },
  { name: "Duda", line: "Respira fundo. O mundo é mais estranho, pop e maravilhoso do que parece." },
  { name: "Otto", line: "Separei detalhes tão específicos que saber a resposta talvez seja um pouco preocupante." },
  { name: "Augusto", line: "Bem-vindo a uma seleção cuidadosa de fatos que você não precisava saber — até agora." }
];

const EPISODE_TITLES = [
  "O mundo é mais estranho do que parece",
  "Cultura inútil de altíssimo nível",
  "Você não precisava saber disso",
  "Nostalgia, caos e conhecimento duvidoso",
  "Fatos para interromper qualquer churrasco",
  "A internet, a TV e outras decisões questionáveis",
  "Coisas que realmente aconteceram",
  "Memórias desbloqueadas com sucesso"
];

let bypassNextStart = false;
let overlay;

applyBurrquizzzIdentity();
createEpisodeOverlay();
interceptSoloStart();

function applyBurrquizzzIdentity() {
  document.title = "Burrquizzz";

  const brandText = document.querySelector(".brand-text");
  if (brandText) brandText.textContent = "Burrquizzz";

  const brandMark = document.querySelector(".brand-mark");
  if (brandMark) brandMark.textContent = "B";

  const questionLabel = document.querySelector(".score-chip small");
  if (questionLabel?.textContent.trim() === "PERGUNTA") {
    questionLabel.textContent = "DESCOBERTA";
  }

  const heroTitle = document.querySelector("#screen-home h1");
  if (heroTitle) heroTitle.innerHTML = "Vale saber.<br>Vale rir.<br>Vale descobrir.";

  const heroCopy = document.querySelector("#screen-home .hero-copy");
  if (heroCopy) {
    heroCopy.textContent = "Jogue sozinho ou dispute em dois celulares. As descobertas mudam, o conhecimento inútil se acumula.";
  }

  const features = document.querySelectorAll(".home-features span");
  if (features[0]) features[0].textContent = "Descobertas geradas por IA";
  if (features[1]) features[1].textContent = "Cultura pop e bizarrices";
}

function createEpisodeOverlay() {
  overlay = document.createElement("div");
  overlay.className = "burr-episode-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <section class="burr-episode-card" role="dialog" aria-modal="true" aria-labelledby="burrEpisodeTitle">
      <p class="burr-studio-label">BURRQUIZZZ APRESENTA</p>
      <div class="burr-episode-number" id="burrEpisodeNumber">EPISÓDIO 000</div>
      <div class="burr-episode-icon" aria-hidden="true">✦</div>
      <h2 id="burrEpisodeTitle">O mundo é mais estranho do que parece</h2>
      <p class="burr-host-line"><span>Com</span> <strong id="burrEpisodeHost">Nico</strong></p>
      <p class="burr-opening" id="burrEpisodeOpening"></p>
      <button class="primary-button burr-enter-button" id="burrEnterStudio" type="button">Entrar no estúdio</button>
      <button class="ghost-button burr-cancel-button" id="burrCancelEpisode" type="button">Voltar</button>
    </section>
  `;
  document.body.appendChild(overlay);

  const style = document.createElement("style");
  style.textContent = `
    .burr-episode-overlay {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: grid;
      place-items: center;
      padding: 24px;
      background:
        radial-gradient(circle at 20% 20%, rgba(255, 215, 64, .25), transparent 34%),
        radial-gradient(circle at 80% 75%, rgba(255, 91, 132, .24), transparent 38%),
        linear-gradient(145deg, #081f54, #133f99 55%, #6b238e);
    }
    .burr-episode-overlay[hidden] { display: none; }
    .burr-episode-card {
      width: min(100%, 560px);
      padding: clamp(28px, 7vw, 54px);
      border: 3px solid rgba(255,255,255,.85);
      border-radius: 30px;
      text-align: center;
      color: #fff;
      background: rgba(8, 24, 68, .76);
      box-shadow: 0 28px 80px rgba(0,0,0,.38), inset 0 0 0 7px rgba(255,255,255,.06);
      backdrop-filter: blur(15px);
    }
    .burr-studio-label {
      margin: 0 0 10px;
      font-size: .76rem;
      font-weight: 900;
      letter-spacing: .18em;
      color: #ffdc55;
    }
    .burr-episode-number {
      font-size: .86rem;
      font-weight: 800;
      letter-spacing: .12em;
      opacity: .8;
    }
    .burr-episode-icon {
      margin: 18px auto 10px;
      font-size: 3rem;
      color: #ffdc55;
      text-shadow: 0 0 22px rgba(255,220,85,.65);
    }
    .burr-episode-card h2 {
      margin: 0;
      font-size: clamp(2rem, 8vw, 3.7rem);
      line-height: .98;
      letter-spacing: -.04em;
    }
    .burr-host-line {
      margin: 22px 0 0;
      font-size: 1rem;
      opacity: .88;
    }
    .burr-host-line strong { color: #ffdc55; }
    .burr-opening {
      max-width: 430px;
      margin: 18px auto 28px;
      font-size: 1.08rem;
      line-height: 1.55;
      color: rgba(255,255,255,.9);
    }
    .burr-enter-button, .burr-cancel-button { width: 100%; }
    .burr-cancel-button { margin-top: 10px; color: #fff; }
    body.burr-overlay-open { overflow: hidden; }
  `;
  document.head.appendChild(style);

  overlay.querySelector("#burrEnterStudio").addEventListener("click", enterStudio);
  overlay.querySelector("#burrCancelEpisode").addEventListener("click", closeOverlay);
}

function interceptSoloStart() {
  const startButton = document.querySelector("#startSoloButton");
  if (!startButton) return;

  startButton.addEventListener("click", (event) => {
    if (bypassNextStart) {
      bypassNextStart = false;
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    openEpisode();
  }, true);
}

function openEpisode() {
  const host = HOSTS[Math.floor(Math.random() * HOSTS.length)];
  const title = chooseEpisodeTitle();
  const episodeNumber = String(Math.floor(100 + Math.random() * 900));

  overlay.querySelector("#burrEpisodeNumber").textContent = `EPISÓDIO ${episodeNumber}`;
  overlay.querySelector("#burrEpisodeTitle").textContent = title;
  overlay.querySelector("#burrEpisodeHost").textContent = host.name;
  overlay.querySelector("#burrEpisodeOpening").textContent = host.line;
  overlay.hidden = false;
  document.body.classList.add("burr-overlay-open");
  overlay.querySelector("#burrEnterStudio").focus();
}

function chooseEpisodeTitle() {
  const categories = QUESTIONS.slice(0, 20).map((question) => String(question.category || "").toLowerCase());
  const joined = categories.join(" ");

  if (/nostalgia|anos 80|anos 90|retrô/.test(joined)) return "Memórias desbloqueadas com sucesso";
  if (/internet|tecnologia|games/.test(joined)) return "A internet era um lugar muito estranho";
  if (/cinema|filme|tv|televisão/.test(joined)) return "A cultura pop tomou decisões questionáveis";
  if (/música|rock|banda/.test(joined)) return "Aumente o volume e desconfie de tudo";

  return EPISODE_TITLES[Math.floor(Math.random() * EPISODE_TITLES.length)];
}

function enterStudio() {
  closeOverlay();
  const startButton = document.querySelector("#startSoloButton");
  if (!startButton) return;
  bypassNextStart = true;
  startButton.click();
}

function closeOverlay() {
  overlay.hidden = true;
  document.body.classList.remove("burr-overlay-open");
}
