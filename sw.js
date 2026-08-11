const CACHE_PREFIX = "burrquizzz-pwa-";
const CACHE_NAME = `${CACHE_PREFIX}v1.53`;
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest?v=1.53",
  "./pwa-runtime.js?v=1.53",
  "./brand-v11.css?v=1.53",
  "./styles.css?v=1.53",
  "./visual-polish.css?v=1.53",
  "./duel-results-v061.css?v=1.53",
  "./game-responsive-v07.css?v=1.53",
  "./solo-feedback-v074.css?v=1.53",
  "./mobile-viewport-lock-v081.css?v=1.53",
  "./mobile-game-fit-v114.css?v=1.53",
  "./mobile-game-fit-v114.js?v=1.53",
  "./countdown-v12.css?v=1.53",
  "./lobby-v15.css?v=1.53",
  "./lobby-players-v15.css?v=1.53",
  "./home-preview-2.css?v=1.53",
  "./setup-screens-approved.css?v=1.53",
  "./production-v1.css?v=1.53",
  "./button-typography-v112.css?v=1.53",
  "./pull-refresh-v113.css?v=1.53",
  "./avatar-profile-v114.css?v=1.53",
  "./avatar-profile-v114.js?v=1.53",
  "./ui-copy-v114.js?v=1.53",
  "./app.js?v=1.53",
  "./online-runtime-v231.js?v=1.53",
  "./duel-results-v061.js?v=1.53",
  "./ai-bootstrap.js?v=1.53",
  "./metrics-runtime-v09.js?v=1.53",
  "./questions.js?v=1.53",
  "./duel-question-bank-v252.js?v=1.53",
  "./firebase-config.js",
  "./duel-rematch-v06.js?v=1.53",
  "./assets/home/burrquizzz-pub-background.png",
  "./assets/resultado/resultado-background.png",
  "./assets/resultado/resultado-laurels.png",
  "./assets/resultado/resultado-marquee-frame.png",
  "./icons/icon-192.png?v=1.53",
  "./icons/icon-512.png?v=1.53",
  "./icons/maskable-512.png?v=1.53",
  "./icons/apple-touch-icon.png?v=1.53",
  "./icons/burrquizzz-icon.svg?v=1.53"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
          }
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
