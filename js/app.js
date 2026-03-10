(function () {
  const page = document.body.dataset.page || "";
  const topNavEl = document.getElementById("top-nav");
  const bottomNavEl = document.getElementById("bottom-nav");
  const CREATE_EVENT = "clashly:take-created";
  const CREATE_MODAL_ID = "create-modal";
  const DEFAULT_PREVIEW_TEXT = "Image preview area";

  const desktopLinks = [
    { id: "home", label: "Home", href: "index.html" },
    { id: "search", label: "Search", href: "search.html" },
    { id: "trending", label: "Trending", href: "index.html#trending" },
    { id: "controversial", label: "Controversial", href: "index.html#controversial" },
    { id: "create", label: "Create", href: "create.html", opensModal: true },
    { id: "profile", label: "Profile", href: "profile.html" },
  ];

  const mobileLinks = [
    { id: "home", label: "Home", href: "index.html" },
    { id: "search", label: "Search", href: "search.html" },
    { id: "create", label: "Create", href: "create.html", opensModal: true },
    { id: "profile", label: "Profile", href: "profile.html" },
  ];

  function shouldUseCreateModal() {
    return page !== "auth" && page !== "profile-setup" && page !== "create";
  }

  function resolveActiveNavLink(id) {
    if (page === "take" || page === "home" || page === "hashtag") return id === "home";
    return id === page;
  }

  function renderIcon(id) {
    const icons = {
      home: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 10.5 12 3l9 7.5"></path>
          <path d="M5.5 9.5V21h13V9.5"></path>
        </svg>
      `,
      trending: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 16l5-5 4 4 7-8"></path>
          <path d="M20 11V7h-4"></path>
        </svg>
      `,
      search: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6"></circle>
          <path d="m20 20-4.2-4.2"></path>
        </svg>
      `,
      controversial: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 3v10"></path>
          <path d="M12 18.5v.5"></path>
          <path d="M10 21h4"></path>
          <path d="M5 7h14"></path>
        </svg>
      `,
      create: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 5v14"></path>
          <path d="M5 12h14"></path>
        </svg>
      `,
      profile: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M20 21a8 8 0 0 0-16 0"></path>
          <circle cx="12" cy="8" r="4"></circle>
        </svg>
      `,
    };

    return icons[id] || icons.home;
  }

  function buildDesktopLink(link) {
    const activeClass = resolveActiveNavLink(link.id) ? "is-active" : "";
    const modalAttr = link.opensModal && shouldUseCreateModal() ? ' data-open-create-modal="true"' : "";

    return `
      <li>
        <a class="desktop-nav__link ${activeClass}" href="${link.href}"${modalAttr}>
          <span class="desktop-nav__icon">${renderIcon(link.id)}</span>
          <span class="desktop-nav__label">${link.label}</span>
        </a>
      </li>
    `;
  }

  function buildMobileLink(link) {
    const activeClass = resolveActiveNavLink(link.id) ? "is-active" : "";
    const modalAttr = link.opensModal && shouldUseCreateModal() ? ' data-open-create-modal="true"' : "";
    return `<a class="bottom-nav__link ${activeClass}" href="${link.href}"${modalAttr}>${link.label}</a>`;
  }

  function buildTopNav() {
    if (!topNavEl) return;

    topNavEl.innerHTML = `
      <div class="top-nav__inner">
        <a class="brand" href="index.html" aria-label="Clashly home">
          <span class="brand__mark" aria-hidden="true">
            <img src="assets/clashly-mark.svg" alt="" />
          </span>
          <span>Clashly</span>
        </a>
        <nav class="desktop-nav" aria-label="Primary navigation">
          <ul class="desktop-nav__list">
            ${desktopLinks.map(buildDesktopLink).join("")}
          </ul>
        </nav>
        <div class="top-nav__actions">
          <button id="nav-logout-btn" class="nav-logout-btn" type="button">Log out</button>
        </div>
      </div>
    `;
  }

  function buildBottomNav() {
    if (!bottomNavEl) return;
    bottomNavEl.innerHTML = `<div class="bottom-nav__inner">${mobileLinks.map(buildMobileLink).join("")}</div>`;
  }

  async function handleLogout() {
    if (!window.ClashlyAuth) return;

    try {
      const { error } = await window.ClashlyAuth.signOut();
      if (error) {
        console.error("[Clashly] Logout failed.", error);
        return;
      }

      window.location.replace("auth.html");
    } catch (error) {
      console.error("[Clashly] Logout failed.", error);
    }
  }

  function setLogoutVisibility(isVisible) {
    const logoutBtn = document.getElementById("nav-logout-btn");
    if (!logoutBtn) return;
    logoutBtn.classList.toggle("is-hidden", !isVisible);
  }

  async function syncAuthUi() {
    if (!window.ClashlySession) return;

    const sessionState = await window.ClashlySession.resolveSession();
    setLogoutVisibility(Boolean(sessionState.user));
  }

  function bindLogoutActions() {
    const logoutButtons = [document.getElementById("nav-logout-btn"), document.getElementById("logout-trigger")];
    logoutButtons.forEach((button) => {
      if (!button) return;
      button.addEventListener("click", handleLogout);
    });
  }

  function getCreateModalMarkup() {
    return `
      <div id="${CREATE_MODAL_ID}" class="composer-modal" hidden>
        <div class="composer-modal__backdrop" data-close-create-modal="true"></div>
        <section class="composer composer-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="create-modal-title">
          <header class="composer-head">
            <div class="composer-head__meta">
              <p class="composer-kicker">New take</p>
              <h2 id="create-modal-title" class="page-title">Drop your take</h2>
              <p class="composer-subtitle">Post straight into the live feed. Keep it sharp, readable, and worth debating.</p>
            </div>
            <button type="button" class="btn btn--ghost composer-modal__close" data-close-create-modal="true">Close</button>
          </header>

          <div class="composer-layout">
            <form class="composer-form" id="create-modal-form" novalidate>
              <label for="create-modal-text" class="field-label">Your take</label>
              <textarea
                id="create-modal-text"
                class="take-textarea"
                name="take"
                rows="6"
                maxlength="180"
                placeholder="What's your take?"
              ></textarea>

              <p class="composer-note">Lead with a clear opinion. Strong takes usually work best when they can be argued with immediately. You can add up to three hashtags.</p>

              <div class="composer-media">
                <label for="create-modal-image" class="field-label">Optional image</label>
                <input
                  id="create-modal-image"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                />
                <p class="composer-hint">One image max. JPG, PNG, or WEBP up to 5MB.</p>
                <div class="image-preview-placeholder" id="create-modal-preview">${DEFAULT_PREVIEW_TEXT}</div>
              </div>

              <p id="create-modal-status" class="status-message" hidden></p>

              <footer class="composer-actions">
                <p class="char-count" id="create-modal-count">0 / 180</p>
                <button id="create-modal-submit" type="submit" class="btn btn--primary">Post Take</button>
              </footer>
            </form>

            <aside class="composer-side" aria-label="Posting guide">
              <section class="composer-detail">
                <h3 class="composer-detail__title">Shape the take</h3>
                <ul class="composer-detail__list">
                  <li><strong>State a position</strong><span>Make the opening line strong enough to pull an agree or disagree instantly.</span></li>
                  <li><strong>Keep it singular</strong><span>One angle is stronger in-feed than a thread of half-finished points.</span></li>
                  <li><strong>Leave room for pushback</strong><span>The best takes invite response, not explanation.</span></li>
                </ul>
              </section>

              <section class="composer-detail">
                <h3 class="composer-detail__title">Format rules</h3>
                <ul class="composer-detail__list">
                  <li><strong>180 characters max</strong><span>Shorter usually reads harder and travels better in the feed.</span></li>
                  <li><strong>Up to 3 hashtags</strong><span>Use tags only when they sharpen discovery, not as filler.</span></li>
                  <li><strong>One image max</strong><span>Use visuals only when they strengthen the opinion.</span></li>
                  <li><strong>Posts go live fast</strong><span>Once posted, your take is available for voting and replies immediately.</span></li>
                </ul>
              </section>
            </aside>
          </div>
        </section>
      </div>
    `;
  }

  function buildCreateModal() {
    if (!shouldUseCreateModal() || document.getElementById(CREATE_MODAL_ID)) return;
    document.body.insertAdjacentHTML("beforeend", getCreateModalMarkup());
  }

  function getCreateModalElements() {
    return {
      modal: document.getElementById(CREATE_MODAL_ID),
      form: document.getElementById("create-modal-form"),
      textarea: document.getElementById("create-modal-text"),
      count: document.getElementById("create-modal-count"),
      imageInput: document.getElementById("create-modal-image"),
      preview: document.getElementById("create-modal-preview"),
      status: document.getElementById("create-modal-status"),
      submit: document.getElementById("create-modal-submit"),
    };
  }

  function setCreateStatus(message, type) {
    const { status } = getCreateModalElements();
    if (!status) return;

    status.hidden = !message;
    status.textContent = message || "";
    status.classList.remove("is-error", "is-success");
    if (type === "error") status.classList.add("is-error");
    if (type === "success") status.classList.add("is-success");
  }

  function updateCreateCount() {
    const { textarea, count } = getCreateModalElements();
    if (!textarea || !count || !window.ClashlyTakes) return;
    count.textContent = `${textarea.value.length} / ${window.ClashlyTakes.MAX_CONTENT_LENGTH}`;
  }

  function resetCreatePreview() {
    const { preview } = getCreateModalElements();
    if (!preview) return;
    const objectUrl = preview.dataset.objectUrl || "";
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      delete preview.dataset.objectUrl;
    }

    preview.classList.remove("has-image");
    preview.textContent = DEFAULT_PREVIEW_TEXT;
  }

  function resetCreateForm() {
    const { form } = getCreateModalElements();
    if (!form) return;
    form.reset();
    resetCreatePreview();
    updateCreateCount();
    setCreateStatus("", "");
  }

  function openCreateModal() {
    const { modal, textarea } = getCreateModalElements();
    if (!modal) return;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => {
      if (textarea) textarea.focus();
    }, 40);
  }

  function closeCreateModal() {
    const { modal } = getCreateModalElements();
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = "";
  }

  function bindCreateModal() {
    if (!shouldUseCreateModal()) return;
    const elements = getCreateModalElements();
    if (!elements.modal || !elements.form || !window.ClashlyTakes || !window.ClashlySession) return;

    updateCreateCount();

    elements.textarea.addEventListener("input", () => {
      setCreateStatus("", "");
      updateCreateCount();
    });

    elements.imageInput.addEventListener("change", () => {
      const file = elements.imageInput.files && elements.imageInput.files[0];
      if (!file) {
        resetCreatePreview();
        return;
      }

      const validation = window.ClashlyTakes.validateImageFile(file);
      if (!validation.valid) {
        elements.imageInput.value = "";
        resetCreatePreview();
        setCreateStatus(validation.error, "error");
        return;
      }

      resetCreatePreview();
      const objectUrl = URL.createObjectURL(file);
      elements.preview.dataset.objectUrl = objectUrl;
      elements.preview.classList.add("has-image");
      elements.preview.innerHTML = `<img src="${objectUrl}" alt="Selected upload preview" />`;
      setCreateStatus("", "");
    });

    elements.form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setCreateStatus("", "");

      const content = elements.textarea.value;
      const contentError = window.ClashlyTakes.validateTakeContent(content);
      if (contentError) {
        setCreateStatus(contentError, "error");
        return;
      }

      const imageFile = elements.imageInput.files && elements.imageInput.files[0] ? elements.imageInput.files[0] : null;
      const imageValidation = window.ClashlyTakes.validateImageFile(imageFile);
      if (!imageValidation.valid) {
        setCreateStatus(imageValidation.error, "error");
        return;
      }

      const sessionState = await window.ClashlySession.resolveSession();
      if (!sessionState.user) {
        window.location.replace("auth.html");
        return;
      }

      elements.submit.disabled = true;
      elements.submit.textContent = "Posting...";

      try {
        const createResult = await window.ClashlyTakes.createTake({
          userId: sessionState.user.id,
          content,
          imageFile,
        });

        if (createResult.error) {
          throw createResult.error;
        }

        setCreateStatus("Take posted.", "success");
        window.dispatchEvent(
          new CustomEvent(CREATE_EVENT, {
            detail: {
              take: createResult.take || null,
            },
          })
        );
        window.setTimeout(() => {
          resetCreateForm();
          closeCreateModal();
        }, 240);
      } catch (error) {
        const message = window.ClashlyUtils.reportError("Create modal post failed.", error, "Could not post take.");
        setCreateStatus(message, "error");
      } finally {
        elements.submit.disabled = false;
        elements.submit.textContent = "Post Take";
      }
    });

    document.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-open-create-modal='true']");
      if (trigger) {
        event.preventDefault();
        openCreateModal();
        return;
      }

      const closeTrigger = event.target.closest("[data-close-create-modal='true']");
      if (closeTrigger) {
        event.preventDefault();
        closeCreateModal();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !elements.modal.hidden) {
        closeCreateModal();
      }
    });
  }

  function boot() {
    buildTopNav();
    buildBottomNav();
    buildCreateModal();
    bindLogoutActions();
    bindCreateModal();
    syncAuthUi();
    window.addEventListener("clashly:auth-state", syncAuthUi);

    window.ClashlyApp = {
      page,
      openCreateModal,
      createEventName: CREATE_EVENT,
    };
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
