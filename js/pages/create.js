(function () {
  const DEFAULT_PREVIEW_TEXT = "Image preview area";
  const UPLOAD_LIMIT_MODAL_TIMEOUT_MS = 1800;
  let uploadLimitModalTimer = null;

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

  function mergeImageSelections(existingFiles, incomingFiles) {
    const merged = [];
    const seenKeys = new Set();
    const source = [...(Array.isArray(existingFiles) ? existingFiles : []), ...(Array.isArray(incomingFiles) ? incomingFiles : [])];

    source.forEach((file) => {
      if (!file) return;
      const key = [file.name, file.size, file.lastModified, file.type].join("::");
      if (seenKeys.has(key)) return;
      seenKeys.add(key);
      merged.push(file);
    });

    return merged;
  }

  function closeUploadLimitModal() {
    const modal = document.getElementById("upload-limit-modal");
    if (!modal) return;
    modal.hidden = true;
    if (uploadLimitModalTimer) {
      window.clearTimeout(uploadLimitModalTimer);
      uploadLimitModalTimer = null;
    }
  }

  function openUploadLimitModal(maxImages) {
    const modal = document.getElementById("upload-limit-modal");
    const message = document.getElementById("upload-limit-modal-message");
    if (!modal || !message) return;

    message.textContent = `You can only upload a maximum of ${maxImages} photos`;
    modal.hidden = false;

    if (uploadLimitModalTimer) {
      window.clearTimeout(uploadLimitModalTimer);
    }
    uploadLimitModalTimer = window.setTimeout(() => {
      closeUploadLimitModal();
    }, UPLOAD_LIMIT_MODAL_TIMEOUT_MS);
  }

  function bindUploadLimitModal() {
    const modal = document.getElementById("upload-limit-modal");
    if (!modal) return;

    modal.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-close-upload-limit='true']")) {
        closeUploadLimitModal();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) {
        closeUploadLimitModal();
      }
    });
  }

  function renderPreview(preview, files) {
    resetPreview(preview);
    const safeFiles = Array.isArray(files) ? files.filter(Boolean) : [];
    if (!safeFiles.length) return;

    const objectUrls = safeFiles.map((file) => URL.createObjectURL(file));
    preview.dataset.objectUrls = JSON.stringify(objectUrls);
    preview.classList.add("has-image");
    preview.classList.toggle("has-multiple", objectUrls.length > 1);

    preview.innerHTML = `
      <div class="image-preview-grid${objectUrls.length === 1 ? " image-preview-grid--single" : ""}">
        ${objectUrls
          .map(
            (url, index) => `
              <figure class="image-preview-item">
                <img src="${url}" alt="Selected upload preview ${index + 1}" />
                <button
                  type="button"
                  class="image-preview-remove"
                  data-remove-image-index="${index}"
                  aria-label="Remove image ${index + 1}"
                  title="Remove image"
                >
                  &times;
                </button>
              </figure>
            `
          )
          .join("")}
      </div>
    `;
  }

  function setupImagePreview(input, preview, options) {
    input.addEventListener("change", () => {
      const incomingFiles = getImageFiles(input);
      if (!incomingFiles.length) return;

      const maxImages = Number(window.ClashlyTakes.MAX_IMAGES_PER_TAKE || 2);
      const previousFiles = options && typeof options.getFiles === "function" ? options.getFiles() : [];
      const mergedFiles = mergeImageSelections(previousFiles, incomingFiles);
      let nextFiles = mergedFiles;

      if (mergedFiles.length > maxImages) {
        openUploadLimitModal(maxImages);
        nextFiles =
          previousFiles.length >= maxImages
            ? previousFiles.slice(0, maxImages)
            : mergedFiles.slice(0, maxImages);
      }

      const imageValidation = window.ClashlyTakes.validateImageFiles(nextFiles);
      if (!imageValidation.valid) {
        input.value = "";
        setStatus(imageValidation.error, "error");
        return;
      }

      if (options && typeof options.setFiles === "function") {
        options.setFiles(nextFiles);
      }

      input.value = "";
      renderPreview(preview, nextFiles);
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
    let selectedImageFiles = [];

    const maxChars = window.ClashlyTakes.MAX_CONTENT_LENGTH;
    updateCount(textarea, countEl, maxChars);
    textarea.addEventListener("input", () => {
      setStatus("", "");
      updateCount(textarea, countEl, maxChars);
    });
    categorySelect.addEventListener("change", () => setStatus("", ""));
    setupImagePreview(imageInput, preview, {
      getFiles: () => selectedImageFiles,
      setFiles: (files) => {
        selectedImageFiles = Array.isArray(files) ? files : [];
      },
    });
    bindUploadLimitModal();

    preview.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const removeButton = target.closest("[data-remove-image-index]");
      if (!removeButton) return;

      event.preventDefault();
      const index = Number(removeButton.getAttribute("data-remove-image-index"));
      if (!Number.isFinite(index) || index < 0) return;

      selectedImageFiles = selectedImageFiles.filter((_, fileIndex) => fileIndex !== index);
      renderPreview(preview, selectedImageFiles);
      setStatus("", "");
    });
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

      const imageFiles = Array.isArray(selectedImageFiles) ? selectedImageFiles : [];
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
        selectedImageFiles = [];
        imageInput.value = "";
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
