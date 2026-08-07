import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const file = (relativePath) => path.join(root, relativePath);
const read = (relativePath) => fs.readFileSync(file(relativePath), "utf8");
const write = (relativePath, content) => fs.writeFileSync(file(relativePath), content, "utf8");

function replaceRequired(content, search, replacement, label) {
  const matched = search instanceof RegExp ? search.test(content) : content.includes(search);
  if (!matched) throw new Error(`Trecho não encontrado: ${label}`);
  if (search instanceof RegExp) search.lastIndex = 0;
  return content.replace(search, replacement);
}

// 1) Firebase sai do caminho crítico: o runtime online continua carregado no mesmo ponto,
// mas o SDK só é baixado quando o usuário realmente cria/entra em uma sala.
let online = read("online-runtime-v231.js");

online = replaceRequired(
  online,
  /^import \{ initializeApp \} from "https:\/\/www\.gstatic\.com\/firebasejs\/12\.11\.0\/firebase-app\.js";\nimport \{[\s\S]*?\} from "https:\/\/www\.gstatic\.com\/firebasejs\/12\.11\.0\/firebase-firestore\.js";\n/,
  `let initializeApp;\nlet getAuth;\nlet signInAnonymously;\nlet setPersistence;\nlet browserLocalPersistence;\nlet getFirestore;\nlet doc;\nlet getDoc;\nlet setDoc;\nlet deleteDoc;\nlet onSnapshot;\nlet runTransaction;\nlet serverTimestamp;\n`,
  "imports estáticos do Firebase"
);

online = replaceRequired(
  online,
  "let recentDuelQuestionIds = loadRecentDuelQuestionIds();\n",
  "let recentDuelQuestionIds = loadRecentDuelQuestionIds();\nlet firebaseSdkPromise = null;\nlet rematchRuntimePromise = null;\n",
  "estado do runtime online"
);

const firebaseLoader = `function loadFirebaseSdk() {\n  if (!firebaseSdkPromise) {\n    firebaseSdkPromise = Promise.all([\n      import(\"https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js\"),\n      import(\"https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js\"),\n      import(\"https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js\")\n    ]).then(([appModule, authModule, firestoreModule]) => {\n      initializeApp = appModule.initializeApp;\n      getAuth = authModule.getAuth;\n      signInAnonymously = authModule.signInAnonymously;\n      setPersistence = authModule.setPersistence;\n      browserLocalPersistence = authModule.browserLocalPersistence;\n      getFirestore = firestoreModule.getFirestore;\n      doc = firestoreModule.doc;\n      getDoc = firestoreModule.getDoc;\n      setDoc = firestoreModule.setDoc;\n      deleteDoc = firestoreModule.deleteDoc;\n      onSnapshot = firestoreModule.onSnapshot;\n      runTransaction = firestoreModule.runTransaction;\n      serverTimestamp = firestoreModule.serverTimestamp;\n    }).catch((error) => {\n      firebaseSdkPromise = null;\n      throw error;\n    });\n  }\n\n  return firebaseSdkPromise;\n}\n\nfunction loadRematchRuntime() {\n  if (!rematchRuntimePromise) {\n    rematchRuntimePromise = import(\"./duel-rematch-v06.js?v=0.8.1\").catch((error) => {\n      rematchRuntimePromise = null;\n      console.warn(\"Não foi possível preparar a revanche agora.\", error);\n      return null;\n    });\n  }\n  return rematchRuntimePromise;\n}\n\n`;

online = replaceRequired(
  online,
  "async function ensureFirebase() {\n  if (user && db) return;\n\n",
  `${firebaseLoader}async function ensureFirebase() {\n  if (user && db) {\n    void loadRematchRuntime();\n    return;\n  }\n\n  await loadFirebaseSdk();\n  void loadRematchRuntime();\n\n`,
  "ensureFirebase"
);

write("online-runtime-v231.js", online);

// 2) O motor offline passa a reutilizar o mesmo pool já normalizado/clonado.
// A seleção, o embaralhamento, o histórico e as regras continuam intocados.
let offline = read("offline-first-episode-engine.js");

offline = replaceRequired(
  offline,
  "let recordedPrompts = new Set();\n\nboot();\n",
  "let recordedPrompts = new Set();\nlet cachedPool = null;\n\nwindow.addEventListener(\"storage\", (event) => {\n  if (event.key === POOL_KEY) cachedPool = null;\n});\n\nboot();\n",
  "estado do pool offline"
);

offline = replaceRequired(
  offline,
  `function getPool() {\n  return dedupeQuestions([\n    ...STATIC_QUESTIONS,\n    ...normalizeQuestions(readArray(POOL_KEY))\n  ]);\n}\n\nfunction mergeIntoPool(items) {\n  const merged = dedupeQuestions([\n    ...normalizeQuestions(readArray(POOL_KEY)),\n    ...normalizeQuestions(items)\n  ]).slice(-MAX_POOL);\n\n  localStorage.setItem(POOL_KEY, JSON.stringify(merged));\n  document.documentElement.dataset.questionPoolSize = String(\n    dedupeQuestions([...STATIC_QUESTIONS, ...merged]).length\n  );\n}\n`,
  `function getPool() {\n  if (!cachedPool) {\n    cachedPool = dedupeQuestions([\n      ...STATIC_QUESTIONS,\n      ...normalizeQuestions(readArray(POOL_KEY))\n    ]);\n  }\n  return cachedPool;\n}\n\nfunction mergeIntoPool(items) {\n  const merged = dedupeQuestions([\n    ...normalizeQuestions(readArray(POOL_KEY)),\n    ...normalizeQuestions(items)\n  ]).slice(-MAX_POOL);\n\n  localStorage.setItem(POOL_KEY, JSON.stringify(merged));\n  cachedPool = dedupeQuestions([...STATIC_QUESTIONS, ...merged]);\n  document.documentElement.dataset.questionPoolSize = String(cachedPool.length);\n}\n`,
  "getPool/mergeIntoPool"
);

write("offline-first-episode-engine.js", offline);

// 3) O badge de versão já existe no HTML; mantém-se apenas o dataset técnico no bootstrap.
let bootstrap = read("ai-bootstrap.js");
bootstrap = replaceRequired(
  bootstrap,
  'import "./offline-first-episode-engine.js?v=0.7433";',
  'import "./offline-first-episode-engine.js?v=0.8.1";',
  "cache-buster do motor offline"
);
bootstrap = replaceRequired(
  bootstrap,
  'import "./version-runtime.js?v=0.8";',
  'document.documentElement.dataset.appVersion = "0.8.1";',
  "runtime redundante de versão"
);
write("ai-bootstrap.js", bootstrap);

// 4) Atualiza somente a identificação técnica da release e deixa a revanche fora do carregamento inicial.
let index = read("index.html");
index = replaceRequired(index, "Burrquizzz versão 0.8", "Burrquizzz versão 0.8.1", "title da versão");
index = replaceRequired(index, 'aria-label="Versão 0.8"', 'aria-label="Versão 0.8.1"', "aria da versão");
index = replaceRequired(index, ">v0.8</div>", ">v0.8.1</div>", "texto da versão");
index = replaceRequired(index, 'src="ai-bootstrap.js?v=0.8"', 'src="ai-bootstrap.js?v=0.8.1"', "bootstrap no index");
index = replaceRequired(index, 'src="online-runtime-v231.js?v=0.7432"', 'src="online-runtime-v231.js?v=0.8.1"', "runtime online no index");
index = replaceRequired(
  index,
  '  <script type="module" src="duel-rematch-v06.js?v=0.7432"></script>\n',
  "",
  "revanche no carregamento inicial"
);
write("index.html", index);

// 5) Arquivo agora redundante: o HTML já contém o badge e o bootstrap mantém o dataset.
if (fs.existsSync(file("version-runtime.js"))) fs.rmSync(file("version-runtime.js"));

console.log("Performance cleanup v0.8.1 aplicado.");
