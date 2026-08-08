if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js", { scope: "./" })
      .catch((error) => console.warn("PWA: service worker não pôde ser registrado.", error));
  });
}
