(function () {
  const STORAGE_KEY = "clashly-theme";
  const LIGHT = "light";
  const DARK = "dark";

  function readStoredTheme() {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return stored === DARK || stored === LIGHT ? stored : "";
    } catch (error) {
      return "";
    }
  }

  function detectPreferredTheme() {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return DARK;
    }
    return LIGHT;
  }

  function getActiveTheme() {
    return document.documentElement.dataset.theme === DARK ? DARK : LIGHT;
  }

  function applyTheme(theme) {
    const nextTheme = theme === DARK ? DARK : LIGHT;
    document.documentElement.dataset.theme = nextTheme;

    try {
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch (error) {
      // Ignore storage failures and keep the in-memory theme.
    }

    updateToggleLabel();
  }

  function toggleTheme() {
    applyTheme(getActiveTheme() === DARK ? LIGHT : DARK);
  }

  function updateToggleLabel() {
    const theme = getActiveTheme();
    const label = theme === DARK ? "Light mode" : "Dark mode";
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.textContent = label;
      button.setAttribute("aria-label", label);
      button.dataset.themeState = theme;
    });
  }

  function ensureToggleButton() {
    if (!document.body || document.querySelector("[data-theme-toggle]")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "theme-toggle";
    button.setAttribute("data-theme-toggle", "true");
    document.body.appendChild(button);
    updateToggleLabel();
  }

  function bindToggle() {
    document.addEventListener("click", (event) => {
      const toggle = event.target.closest("[data-theme-toggle]");
      if (!toggle) return;
      event.preventDefault();
      toggleTheme();
    });
  }

  function boot() {
    ensureToggleButton();
    updateToggleLabel();
  }

  applyTheme(readStoredTheme() || detectPreferredTheme());
  bindToggle();

  window.ClashlyTheme = {
    applyTheme,
    toggleTheme,
    getActiveTheme,
  };

  document.addEventListener("DOMContentLoaded", boot);
})();
