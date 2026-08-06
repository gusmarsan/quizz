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
window.addEventListener("burrquizzz:episode-ready", syncEpisodeState);

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
  if (features[0]) features[0].textContent = "Descobertas sempre renovadas";
  if (features[1]) features[1].textContent = "Cultura pop e bizarrices";
}

function createEpisodeOverlay() {
  overlay = document.createElement("div");
  overlay.className = "burr-episode-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <section class="burr-episode-card" role="dialog" aria-modal="true" aria-labelledby="burrEpisodeTitle">
      <p class="burr-studio-label">ANTES DE COMEÇAR</p>
      <div class="burr-episode-number" id="burrEpisodeNumber">EPISÓDIO 000</div>
      <h2 id="burrEpisodeTitle">O mundo é mais estranho do que parece</h2>
      <p class="burr-host-line"><span>Com</span> <strong id="burrEpisodeHost">Nico</strong></p>
      <p class="burr-opening" id="burrEpisodeOpening"></p>

      <div class="burr-rules-card" aria-label="Regras do jogo">
        <h3>Como funciona</h3>
        <div class="burr-rules-grid">
          <div><strong>16</strong><span>descobertas</span></div>
          <div><strong>4</strong><span>blocos</span></div>
          <div><strong>18s</strong><span>para responder</span></div>
          <div><strong>1</strong><span>resposta correta</span></div>
        </div>
        <p>Acertou, soma um ponto. A última descoberta é a Grande Final e ganha alguns segundos extras.</p>
      </div>

      <p class="burr-ready-status" id="burrReadyStatus" aria-live="polite">Leia as regras enquanto o estúdio organiza o episódio.</p>
      <button class="primary-button burr-enter-button" id="burrEnterStudio" type="button">Começar episódio</button>
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
      overflow-y: auto;
      padding: 24px;
      background:
        radial-gradient(circle at 20% 20%, rgba(255, 215, 64, .25), transparent 34%),
        radial-gradient(circle at 80% 75%, rgba(255, 91, 132, .24), transparent 38%),
        linear-gradient(145deg, #081f54, #133f99 55%, #6b238e);
    }
    .burr-episode-overlay[hidden] { display: none; }
    .burr-episode-card {
      width: min(100%, 620px);
      padding: clamp(26px, 6vw, 46px);
      border: 3px solid rgba(255,255,255,.85);
      border-radius: 30px;
      text-align: center;
      color: #fff;
      background: rgba(8, 24, 68, .78);
      box-shadow: 0 28px 80px rgba(0,0,0,.38), inset 0 0 0 7px rgba(255,255,255,.06);
      backdrop-filter: blur(15px);
    }
    .burr-studio-label {
      margin: 0 0 8px;
      font-size: .74rem;
      font-weight: 900;
      letter-spacing: .18em;
      color: #ffdc55;
    }
    .burr-episode-number {
      font-size: .78rem;
      font-weight: 800;
      letter-spacing: .12em;
      opacity: .72;
    }
    .burr-episode-card h2 {
      max-width: 520px;
      margin: 12px auto 0;
      font-size: clamp(1.9rem, 7vw, 3.35rem);
      line-height: 1;
      letter-spacing: -.04em;
    }
    .burr-host-line {
      margin: 15px 0 0;
      font-size: .94rem;
      opacity: .88;
    }
    .burr-host-line strong { color: #ffdc55; }
    .burr-opening {
      max-width: 470px;
      margin: 13px auto 20px;
      font-size: .96rem;
      line-height: 1.5;
      color: rgba(255,255,255,.86);
    }
    .burr-rules-card {
      padding: 20px;
      border: 1px solid rgba(255,255,255,.25);
      border-radius: 22px;
      background: rgba(255,255,255,.1);
      text-align: left;
    }
    .burr-rules-card h3 {
      margin: 0 0 14px;
      font-size: .82rem;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: #ffdc55;
    }
    .burr-rules-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 9px;
    }
    .burr-rules-grid div {
      min-width: 0;
      padding: 13px 8px;
      border-radius: 15px;
      background: rgba(5,20,60,.48);
      text-align: center;
    }
    .burr-rules-grid strong {
      display: block;
      font-size: 1.45rem;
      line-height: 1;
      color: #fff;
    }
    .burr-rules-grid span {
      display: block;
      margin-top: 6px;
      font-size: .66rem;
      line-height: 1.2;
      color: rgba(255,255,255,.72);
    }
    .burr-rules-card > p {
      margin: 14px 2px 0;
      font-size: .78rem;
      line-height: 1.45;
      color: rgba(255,255,255,.76);
    }
    .burr-ready-status {
      min-height: 20px;
      margin: 17px 0 10px;
      font-size: .77rem;
      font-weight: 750;
      color: rgba(255,255,255,.72);
    }
    .burr-ready-status.ready { color: #baf7d2; }
    .burr-enter-button, .burr-cancel-button { width: 100%; }
    .burr-enter-button:disabled { cursor: wait; opacity: .72; }
    .burr-cancel-button { margin-top: 10px; color: #fff; }
    body.burr-overlay-open { overflow: hidden; }
    @media (max-width: 520px) {
      .burr-episode-overlay { padding: 14px; align-items: start; }
      .burr-episode-card { margin: 12px 0; padding: 24px 18px; border-radius: 24px; }
      .burr-rules-grid { grid-template-columns: repeat(2, 1fr); }
    }
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
  const episode = window.BURRQUIZZZ_EPISODE || readStoredEpisode();
  const fallbackHost = HOSTS[Math.floor(Math.random() * HOSTS.length)];
  const episodeNumber = String(Math.floor(100 + Math.random() * 900));
  const hostName = String(episode?.host || fallbackHost.name);
  const opening = String(episode?.intro || fallbackHost.line);
  const title = String(episode?.title || chooseEpisodeTitle());

  overlay.querySelector("#burrEpisodeNumber").textContent = `EPISÓDIO ${episodeNumber}`;
  overlay.querySelector("#burrEpisodeTitle").textContent = title;
  overlay.querySelector("#burrEpisodeHost").textContent = hostName;
  overlay.querySelector("#burrEpisodeOpening").textContent = opening;
  overlay.hidden = false;
  document.body.classList.add("burr-overlay-open");
  syncEpisodeState();
}

function syncEpisodeState() {
  if (!overlay) return;
  const ready = document.documentElement.dataset.episodeReady === "true" && QUESTIONS.length >= 16;
  const enterButton = overlay.querySelector("#burrEnterStudio");
  const status = overlay.querySelector("#burrReadyStatus");

  enterButton.disabled = !ready;
  enterButton.textContent = ready ? "Começar episódio" : "Só mais um instante";
  status.textContent = ready
    ? "Tudo pronto. O episódio pode começar."
    : "Leia as regras enquanto o estúdio organiza o episódio.";
  status.classList.toggle("ready", ready);

  if (ready && !overlay.hidden) enterButton.focus();
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

function readStoredEpisode() {
  try {
    return JSON.parse(localStorage.getItem("burrquizzzCurrentEpisode") || "null");
  } catch {
    return null;
  }
}

function enterStudio() {
  if (document.documentElement.dataset.episodeReady !== "true" || QUESTIONS.length < 16) return;
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
