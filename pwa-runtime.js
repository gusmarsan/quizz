const mobileViewportStyles = document.createElement("link");
mobileViewportStyles.rel = "stylesheet";
mobileViewportStyles.href = "./mobile-viewport-lock-v081.css?v=1.0";
document.head.appendChild(mobileViewportStyles);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js?v=1.0", { scope: "./", updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch((error) => console.warn("PWA: service worker não pôde ser registrado.", error));
  });
}
