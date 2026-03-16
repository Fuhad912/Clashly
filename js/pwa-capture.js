// pwa-capture.js — must load in <head> before any other scripts.
// Chrome fires beforeinstallprompt early in page load, often before
// body scripts parse. This captures it immediately and stores it so
// app.js can pick it up whenever it initialises.
(function () {
  window.__pwaInstallPrompt = null;
  window.__pwaInstallConsumed = false;

  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    window.__pwaInstallPrompt = event;
    // Re-dispatch a named event so app.js can react whether it loaded
    // before or after this fires.
    window.dispatchEvent(
      new CustomEvent("clashly:install-prompt-ready", { detail: event })
    );
  });

  window.addEventListener("appinstalled", function () {
    window.__pwaInstallPrompt = null;
    window.__pwaInstallConsumed = true;
    window.dispatchEvent(new CustomEvent("clashly:app-installed"));
  });
})();
