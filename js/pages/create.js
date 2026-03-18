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
    const objectUrls = JSON.parse(preview.dataset.objectUrls || "[]");
    objectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    delete preview.dataset.objectUrls;
    preview.classList.remove("has-image");
    preview.classList.remove("image-preview-placeholder--split");
    preview.textContent = DEFAULT_PREVIEW_TEXT;
  }

  function renderPreview(preview, files) {
    const safeFiles = Array.from(files || []).filter(Boolean);
    if (!safeFiles.length) {
      resetPreview(preview);
      return;
    }

    const objectUrls = safeFiles.map((file) => URL.createObjectURL(file));
    preview.dataset.objectUrls = JSON.stringify(objectUrls);
    preview.classList.add("has-image");

    if (objectUrls.length === 1) {
      preview.classList.remove("image-preview-placeholder--split");
      preview.innerHTML = `<img src="${objectUrls[0]}" alt="Selected upload preview" />`;
      return;
    }

    preview.classList.add("image-preview-placeholder--split");
    preview.innerHTML = objectUrls
      .map(
        (objectUrl, index) => `
          <div class="image-preview-placeholder__slot">
            <img src="${objectUrl}" alt="Selected upload preview ${index + 1}" />
          </div>
        `
      )
      .join("");
  }

  function mergeSelectedFiles(existingFiles, incomingFiles, maxFiles) {
    const merged = [];
    const seenKeys = new Set();

    [...Array.from(existingFiles || []), ...Array.from(incomingFiles || [])].forEach((file) => {
      if (!file) return;
      const key = [file.name, file.size, file.lastModified].join(":");
      if (seenKeys.has(key)) return;
      seenKeys.add(key);
      merged.push(file);
    });

    return merged.slice(0, Math.max(0, Number(maxFiles || 0)) || 0);
  }

  function setupImagePreview(input, preview, state) {
    input.addEventListener("change", () => {
      const files = Array.from(input.files || []).filter(Boolean);
      if (!files.length) {
        return;
      }

      const maxFiles = Number(window.ClashlyTakes.MAX_IMAGES_PER_TAKE || 2);
      const mergedFiles = mergeSelectedFiles(state.selectedFiles, files, maxFiles + files.length);
      const imageValidation = window.ClashlyTakes.validateImageFiles(mergedFiles);
      if (!imageValidation.valid) {
        input.value = "";
        setStatus(imageValidation.error, "error");
        return;
      }

      state.selectedFiles = mergedFiles;
      resetPreview(preview);
      renderPreview(preview, state.selectedFiles);
      input.value = "";
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

    const composerState = {
      selectedFiles: [],
    };

    const maxChars = window.ClashlyTakes.MAX_CONTENT_LENGTH;
    updateCount(textarea, countEl, maxChars);
    textarea.addEventListener("input", () => {
      setStatus("", "");
      updateCount(textarea, countEl, maxChars);
    });
    categorySelect.addEventListener("change", () => setStatus("", ""));
    setupImagePreview(imageInput, preview, composerState);
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

      const imageFiles = composerState.selectedFiles.slice();
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
        composerState.selectedFiles = [];
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
