(function () {
  const DEFAULT_PREVIEW_TEXT = "Image preview area";

  function setStatus(message, type) {
    const statusEl = document.getElementById("composer-status");
    if (!statusEl) return;

    statusEl.hidden = !message;
    statusEl.textContent = message || "";
    statusEl.classList.remove("is-error", "is-success");
    if (type === "error") statusEl.classList.add("is-error");
    if (type === "success") statusEl.classList.add("is-success");
  }

  function updateCount(textarea, countEl, maxChars) {
    const length = textarea.value.length;
    countEl.textContent = `${length} / ${maxChars}`;
  }

  function resetPreview(preview) {
    preview.classList.remove("has-image");
    preview.textContent = DEFAULT_PREVIEW_TEXT;
  }

  function setupImagePreview(input, preview) {
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (!file) {
        resetPreview(preview);
        return;
      }

      const imageValidation = window.ClashlyTakes.validateImageFile(file);
      if (!imageValidation.valid) {
        input.value = "";
        resetPreview(preview);
        setStatus(imageValidation.error, "error");
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      preview.classList.add("has-image");
      preview.innerHTML = `<img src="${objectUrl}" alt="Selected upload preview" />`;
      setStatus("", "");
    });
  }

  async function initCreatePage() {
    if (!window.ClashlyTakes || !window.ClashlySession) return;

    const textarea = document.getElementById("take-text");
    const countEl = document.getElementById("char-count");
    const imageInput = document.getElementById("take-image");
    const preview = document.getElementById("image-preview");
    const form = document.getElementById("take-form");
    const submitBtn = document.getElementById("post-take-btn");

    if (!textarea || !countEl || !imageInput || !preview || !form || !submitBtn) return;

    const maxChars = window.ClashlyTakes.MAX_CONTENT_LENGTH;
    updateCount(textarea, countEl, maxChars);
    textarea.addEventListener("input", () => {
      setStatus("", "");
      updateCount(textarea, countEl, maxChars);
    });
    setupImagePreview(imageInput, preview);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setStatus("", "");

      const content = textarea.value;
      const contentError = window.ClashlyTakes.validateTakeContent(content);
      if (contentError) {
        setStatus(contentError, "error");
        return;
      }

      const imageFile = imageInput.files && imageInput.files[0] ? imageInput.files[0] : null;
      const imageValidation = window.ClashlyTakes.validateImageFile(imageFile);
      if (!imageValidation.valid) {
        setStatus(imageValidation.error, "error");
        return;
      }

      const sessionState = await window.ClashlySession.resolveSession();
      if (!sessionState.user) {
        window.location.replace("auth.html");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Posting...";

      try {
        const createResult = await window.ClashlyTakes.createTake({
          userId: sessionState.user.id,
          content,
          imageFile,
        });

        if (createResult.error) {
          throw createResult.error;
        }

        form.reset();
        resetPreview(preview);
        updateCount(textarea, countEl, maxChars);
        setStatus("Take posted. Redirecting to feed...", "success");
        window.setTimeout(() => {
          window.location.replace("index.html#new");
        }, 350);
      } catch (error) {
        const message = window.ClashlyUtils.reportError("Create page post failed.", error, "Could not post take.");
        setStatus(message, "error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Post Take";
      }
    });
  }

  document.addEventListener("DOMContentLoaded", initCreatePage);
})();
