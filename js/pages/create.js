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

  async function populateCategories(selectEl) {
    if (!selectEl || !window.ClashlyCategories) return;

    selectEl.innerHTML = `<option value="">Loading categories...</option>`;

    try {
      const result = await window.ClashlyCategories.fetchCategories();
      if (result.error) throw result.error;

      const categories = result.categories || [];
      if (!categories.length) {
        selectEl.innerHTML = `<option value="">No categories available</option>`;
        return;
      }

      selectEl.innerHTML = [
        `<option value="">Select category</option>`,
        ...categories.map(
          (category) =>
            `<option value="${window.ClashlyUtils.escapeHtml(category.slug)}">${window.ClashlyUtils.escapeHtml(
              category.name
            )}</option>`
        ),
      ].join("");
    } catch (error) {
      selectEl.innerHTML = `<option value="">Could not load categories</option>`;
    }
  }

  function resetPreview(preview) {
    const objectUrls = (() => {
      try {
        return JSON.parse(preview.dataset.objectUrls || "[]");
      } catch {
        return [];
      }
    })();
    objectUrls.forEach((url) => {
      if (url) URL.revokeObjectURL(url);
    });
    delete preview.dataset.objectUrls;
    preview.classList.remove("has-image");
    preview.classList.remove("has-multiple");
    preview.textContent = DEFAULT_PREVIEW_TEXT;
  }

  function getImageFiles(input) {
    return Array.from((input && input.files) || []).filter(Boolean);
  }

  function renderPreview(preview, files) {
    resetPreview(preview);
    const safeFiles = Array.isArray(files) ? files.filter(Boolean) : [];
    if (!safeFiles.length) return;

    const objectUrls = safeFiles.map((file) => URL.createObjectURL(file));
    preview.dataset.objectUrls = JSON.stringify(objectUrls);
    preview.classList.add("has-image");
    preview.classList.toggle("has-multiple", objectUrls.length > 1);

    if (objectUrls.length === 1) {
      preview.innerHTML = `<img src="${objectUrls[0]}" alt="Selected upload preview" />`;
      return;
    }

    preview.innerHTML = `
      <div class="image-preview-grid">
        ${objectUrls
          .map((url, index) => `<img src="${url}" alt="Selected upload preview ${index + 1}" />`)
          .join("")}
      </div>
    `;
  }

  function setupImagePreview(input, preview) {
    input.addEventListener("change", () => {
      const files = getImageFiles(input);
      if (!files.length) {
        resetPreview(preview);
        return;
      }

      const imageValidation = window.ClashlyTakes.validateImageFiles(files);
      if (!imageValidation.valid) {
        input.value = "";
        resetPreview(preview);
        setStatus(imageValidation.error, "error");
        return;
      }

      const maxImages = Number(window.ClashlyTakes.MAX_IMAGES_PER_TAKE || 2);
      renderPreview(preview, files.slice(0, maxImages));
      setStatus("", "");
    });
  }

  async function initCreatePage() {
    if (!window.ClashlyTakes || !window.ClashlySession || !window.ClashlyCategories) return;

    const textarea = document.getElementById("take-text");
    const countEl = document.getElementById("char-count");
    const categorySelect = document.getElementById("take-category");
    const imageInput = document.getElementById("take-image");
    const preview = document.getElementById("image-preview");
    const form = document.getElementById("take-form");
    const submitBtn = document.getElementById("post-take-btn");

    if (!textarea || !countEl || !categorySelect || !imageInput || !preview || !form || !submitBtn) return;

    const maxChars = window.ClashlyTakes.MAX_CONTENT_LENGTH;
    updateCount(textarea, countEl, maxChars);
    textarea.addEventListener("input", () => {
      setStatus("", "");
      updateCount(textarea, countEl, maxChars);
    });
    categorySelect.addEventListener("change", () => setStatus("", ""));
    setupImagePreview(imageInput, preview);
    await populateCategories(categorySelect);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setStatus("", "");

      const content = textarea.value;
      const contentError = window.ClashlyTakes.validateTakeContent(content);
      if (contentError) {
        setStatus(contentError, "error");
        return;
      }

      const categoryError = window.ClashlyTakes.validateCategory(categorySelect.value);
      if (categoryError) {
        setStatus(categoryError, "error");
        return;
      }

      const imageFiles = getImageFiles(imageInput);
      const imageValidation = window.ClashlyTakes.validateImageFiles(imageFiles);
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
          categorySlug: categorySelect.value,
          imageFiles,
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
