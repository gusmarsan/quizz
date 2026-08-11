const CACHE_PREFIX = "burrquizzz-pwa-";
const CACHE_NAME = `${CACHE_PREFIX}v1.5-2`;
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest?v=1.2",
  "./manifest.webmanifest?v=1.5",
  "./pwa-runtime.js?v=1.2",
  "./brand-v11.css?v=1.2",
  "./styles.css?v=1.0",
  "./visual-polish.css?v=1.0",
  "./duel-results-v061.css?v=1.0",
  "./game-responsive-v07.css?v=1.0",
  "./solo-feedback-v074.css?v=1.0",
  "./mobile-viewport-lock-v081.css?v=1.2",
  "./mobile-game-fit-v114.css?v=1.2-fit3",
  "./mobile-game-fit-v114.js?v=1.2-fit3",
  "./countdown-v12.css?v=1.2",
  "./lobby-v15.css?v=1.5",
  "./lobby-players-v15.css?v=1.5.1",
  "./home-preview-2.css?v=1.0",
  "./setup-screens-approved.css?v=1.0",
  "./production-v1.css?v=1.0",
  "./button-typography-v112.css?v=1.14.2",
  "./pull-refresh-v113.css?v=1.2",
  "./avatar-profile-v114.css?v=1.2",
  "./avatar-profile-v114.js?v=1.2",
  "./ui-copy-v114.js?v=1.2.5",
  "./app.js?v=1.0",
  "./online-runtime-v231.js?v=1.0",
  "./duel-results-v061.js?v=1.0",
  "./ai-bootstrap.js?v=1.0",
  "./metrics-runtime-v09.js?v=1.0",
  "./questions.js?v=1.0",
  "./duel-question-bank-v252.js?v=1.0",
  "./firebase-config.js",
  "./duel-rematch-v06.js?v=0.8.1",
  "./assets/home/burrquizzz-pub-background.png",
  "./assets/resultado/resultado-background.png",
  "./assets/resultado/resultado-laurels.png",
  "./assets/resultado/resultado-marquee-frame.png",
  "./icons/icon-192.png?v=1.2",
  "./icons/icon-192.png?v=1.5",
  "./icons/icon-512.png?v=1.2",
  "./icons/icon-512.png?v=1.5",
  "./icons/maskable-512.png?v=1.2",
  "./icons/maskable-512.png?v=1.5",
  "./icons/apple-touch-icon.png?v=1.2",
  "./icons/apple-touch-icon.png?v=1.5",
  "./icons/burrquizzz-icon.svg?v=1.2",
  "./icons/burrquizzz-icon.svg?v=1.5"
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
