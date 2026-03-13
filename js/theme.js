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
    const isDark = theme === DARK;
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      const labelEl = button.querySelector("[data-theme-label]");
      if (labelEl) {
        labelEl.textContent = label;
      } else {
        if (!button.hasAttribute("data-theme-switch")) {
          button.textContent = label;
        }
      }
      button.setAttribute("aria-label", label);
      button.dataset.themeState = theme;
      if (button.hasAttribute("data-theme-switch")) {
        button.setAttribute("aria-checked", isDark ? "true" : "false");
      }
    });
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
    updateToggleLabel();
  }

  // Default to light mode unless the user has explicitly chosen a theme before.
  applyTheme(readStoredTheme() || LIGHT);
  bindToggle();

  window.ClashlyTheme = {
    applyTheme,
    toggleTheme,
    getActiveTheme,
  };

  document.addEventListener("DOMContentLoaded", boot);
})();
