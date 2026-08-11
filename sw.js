const CACHE_PREFIX = "burrquizzz-pwa-";
const CACHE_REVISION = "question-bank-181";
const RELEASE_VERSION = (() => {
  try {
    return new URL(self.location.href).searchParams.get("v") || "current";
  } catch {
    return "current";
  }
})();
const CACHE_NAME = `${CACHE_PREFIX}v${RELEASE_VERSION}-${CACHE_REVISION}`;
const versioned = (path) => `${path}?v=${encodeURIComponent(RELEASE_VERSION)}`;

const APP_SHELL = [
  "./",
  "./index.html",
  "./version.json",
  versioned("./release-gate.js"),
  versioned("./manifest.webmanifest"),
  versioned("./pwa-runtime-v154.js"),
  versioned("./ui-copy-v154.js"),
  versioned("./brand-v11.css"),
  versioned("./styles.css"),
  versioned("./visual-polish.css"),
  versioned("./duel-results-v061.css"),
  versioned("./game-responsive-v07.css"),
  versioned("./solo-feedback-v074.css"),
  versioned("./mobile-viewport-lock-v081.css"),
  versioned("./mobile-game-fit-v114.css"),
  versioned("./mobile-game-fit-v114.js"),
  versioned("./countdown-v12.css"),
  versioned("./lobby-v15.css"),
  versioned("./lobby-players-v15.css"),
  versioned("./home-preview-2.css"),
  versioned("./setup-screens-approved.css"),
  versioned("./production-v1.css"),
  versioned("./button-typography-v112.css"),
  versioned("./pull-refresh-v113.css"),
  versioned("./avatar-profile-v114.css"),
  versioned("./avatar-profile-v114.js"),
  versioned("./app.js"),
  versioned("./online-runtime-v231.js"),
  versioned("./duel-results-v061.js"),
  versioned("./duel-round-rules-v17.js"),
  "./duel-round-rules-v17.js?v=1.7",
  versioned("./ai-bootstrap.js"),
  versioned("./metrics-runtime-v09.js"),
  versioned("./questions.js"),
  versioned("./duel-question-bank-v252.js"),
  versioned("./question-bank/batch-v181.js"),
  "./firebase-config.js",
  versioned("./duel-rematch-v06.js"),
  "./assets/home/burrquizzz-pub-background.png",
  "./assets/game/game-background-infinite.png",
  "./assets/resultado/resultado-background.png",
  "./assets/resultado/resultado-laurels.png",
  "./assets/resultado/resultado-marquee-frame.png",
  versioned("./icons/icon-192.png"),
  versioned("./icons/icon-512.png"),
  versioned("./icons/maskable-512.png"),
  versioned("./icons/apple-touch-icon.png"),
  versioned("./icons/burrquizzz-icon.svg")
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

async function cachedReleaseFallback(request) {
  const exact = await caches.match(request);
  if (exact) return exact;

  try {
    const fallbackUrl = new URL(request.url);
    if (fallbackUrl.origin !== self.location.origin) return undefined;
    fallbackUrl.searchParams.set("v", RELEASE_VERSION);
    return caches.match(fallbackUrl.href);
  } catch {
    return undefined;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: "no-store" });
        if (response && response.ok) {
          const copy = response.clone();
          const cache = await caches.open(CACHE_NAME);
          await cache.put("./index.html", copy);
        }
        return response;
      } catch {
        return (await caches.match("./index.html")) || (await caches.match("./"));
      }
    })());
    return;
  }

  event.respondWith((async () => {
    try {
      // Online always means fresh: bypass the browser HTTP cache as well as the
      // Service Worker cache. The returned response refreshes the offline shell.
      const response = await fetch(request, { cache: "no-store" });
      if (response && response.ok) {
        const copy = response.clone();
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, copy);
      }
      return response;
    } catch {
      return cachedReleaseFallback(request);
    }
  })());
});
