(function () {
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  let currentUserEmail = "";
  let deleteInFlight = false;

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function setEmailStatus(message, type) {
    const statusEl = document.getElementById("settings-email-status");
    if (!statusEl) return;

    statusEl.hidden = !message;
    statusEl.textContent = message || "";
    statusEl.classList.remove("is-error", "is-success");
    if (type === "error") statusEl.classList.add("is-error");
    if (type === "success") statusEl.classList.add("is-success");
  }

  function setDeleteStatus(message, type) {
    const statusEl = document.getElementById("settings-delete-status");
    if (!statusEl) return;

    statusEl.hidden = !message;
    statusEl.textContent = message || "";
    statusEl.classList.remove("is-error", "is-success");
    if (type === "error") statusEl.classList.add("is-error");
    if (type === "success") statusEl.classList.add("is-success");
  }

  function getDeleteModalElements() {
    return {
      modal: document.getElementById("settings-delete-modal"),
      confirmBtn: document.getElementById("settings-delete-confirm"),
      cancelBtn: document.getElementById("settings-delete-cancel"),
    };
  }

  function openDeleteModal() {
    const { modal, confirmBtn } = getDeleteModalElements();
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add("has-settings-confirm-open");
    window.requestAnimationFrame(() => {
      modal.classList.add("is-open");
      if (confirmBtn) confirmBtn.focus();
    });
  }

  function closeDeleteModal() {
    if (deleteInFlight) return;
    const { modal } = getDeleteModalElements();
    if (!modal) return;
    modal.classList.remove("is-open");
    document.body.classList.remove("has-settings-confirm-open");
    window.setTimeout(() => {
      if (!modal.classList.contains("is-open")) {
        modal.hidden = true;
      }
    }, 180);
  }

  function getEmailUpdateErrorMessage(error) {
    const message = String((error && error.message) || "").toLowerCase();
    if (!message) return "Could not update email.";
    if (message.includes("same") || message.includes("already") || message.includes("in use")) {
      return "That email is already in use. Try another email address.";
    }
    if (message.includes("invalid")) {
      return "Enter a valid email address.";
    }
    if (message.includes("rate limit")) {
      return "Too many attempts. Please wait and try again.";
    }
    return "Could not update email.";
  }

  async function handleEmailChangeSubmit(event) {
    event.preventDefault();
    if (!window.ClashlyAuth) return;

    const input = document.getElementById("settings-new-email");
    const submitBtn = document.getElementById("settings-email-submit");
    if (!(input instanceof HTMLInputElement) || !(submitBtn instanceof HTMLButtonElement)) return;

    const nextEmail = normalizeEmail(input.value);
    if (!nextEmail || !EMAIL_PATTERN.test(nextEmail)) {
      setEmailStatus("Enter a valid email address.", "error");
      return;
    }

    if (currentUserEmail && nextEmail === normalizeEmail(currentUserEmail)) {
      setEmailStatus("Enter a different email address.", "error");
      return;
    }

    setEmailStatus("", "");
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending...";

    try {
      const result = await window.ClashlyAuth.updateEmail(nextEmail);
      if (result.error) {
        throw result.error;
      }

      setEmailStatus("Confirmation sent. Check your inbox to complete this email change.", "success");
      input.value = "";
    } catch (error) {
      setEmailStatus(getEmailUpdateErrorMessage(error), "error");
      window.ClashlyUtils.reportError("Settings email update failed.", error, "Could not update email.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Send confirmation";
    }
  }

  async function handleDeleteAccount() {
    if (!window.ClashlyAuth) return;

    const deleteBtn = document.getElementById("settings-delete-account");
    const { confirmBtn, cancelBtn } = getDeleteModalElements();
    if (!(deleteBtn instanceof HTMLButtonElement) || !(confirmBtn instanceof HTMLButtonElement)) return;

    deleteInFlight = true;
    setDeleteStatus("", "");
    deleteBtn.disabled = true;
    confirmBtn.disabled = true;
    if (cancelBtn instanceof HTMLButtonElement) cancelBtn.disabled = true;
    confirmBtn.textContent = "Deleting...";
    deleteBtn.textContent = "Deleting...";

    try {
      const result = await window.ClashlyAuth.deleteOwnAccount();
      if (result.error) {
        throw result.error;
      }

      deleteInFlight = false;
      closeDeleteModal();
      setDeleteStatus("Account deleted. Redirecting...", "success");
      try {
        await window.ClashlyAuth.signOut();
      } catch {
        // Session may already be invalid after deletion.
      }
      window.location.replace("auth.html");
    } catch (error) {
      setDeleteStatus("Could not delete account. Please try again.", "error");
      window.ClashlyUtils.reportError("Delete account failed.", error, "Could not delete account.");
      deleteInFlight = false;
      deleteBtn.disabled = false;
      deleteBtn.textContent = "Delete account";
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Yes";
      if (cancelBtn instanceof HTMLButtonElement) cancelBtn.disabled = false;
    }
  }

  async function initSettingsPage() {
    try {
      if (!window.ClashlySession) return;

      const sessionState = await window.ClashlySession.resolveSession();
      const user = sessionState.user || null;
      if (!user) {
        window.location.replace("auth.html");
        return;
      }
      currentUserEmail = user.email || "";

      const emailEl = document.getElementById("settings-user-email");
      if (emailEl) {
        emailEl.textContent = currentUserEmail || "Unknown account";
      }

      const emailForm = document.getElementById("settings-email-form");
      if (emailForm) {
        emailForm.addEventListener("submit", handleEmailChangeSubmit);
      }

      const deleteBtn = document.getElementById("settings-delete-account");
      if (deleteBtn) {
        deleteBtn.addEventListener("click", () => {
          openDeleteModal();
        });
      }

      const { modal, confirmBtn } = getDeleteModalElements();
      if (confirmBtn) {
        confirmBtn.addEventListener("click", () => {
          handleDeleteAccount().catch(() => {});
        });
      }

      if (modal) {
        document.addEventListener("click", (event) => {
          const target = event.target;
          if (!(target instanceof Element)) return;
          const closeTrigger = target.closest("[data-close-delete-modal='true']");
          if (!closeTrigger) return;
          event.preventDefault();
          closeDeleteModal();
        });

        document.addEventListener("keydown", (event) => {
          if (event.key !== "Escape") return;
          if (modal.hidden) return;
          closeDeleteModal();
        });
      }
    } finally {
      if (window.ClasheLoader) {
        window.ClasheLoader.release("page-data");
      }
    }
  }

  document.addEventListener("DOMContentLoaded", initSettingsPage);
})();
