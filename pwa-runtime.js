const mobileViewportStyles = document.createElement("link");
mobileViewportStyles.rel = "stylesheet";
mobileViewportStyles.href = "./mobile-viewport-lock-v081.css?v=0.8.1";
document.head.appendChild(mobileViewportStyles);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js", { scope: "./" })
      .catch((error) => console.warn("PWA: service worker não pôde ser registrado.", error));
  });
}
