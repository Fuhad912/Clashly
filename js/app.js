(function () {
  const page = document.body.dataset.page || "";
  const topNavEl = document.getElementById("top-nav");
  const bottomNavEl = document.getElementById("bottom-nav");
  const CREATE_EVENT = "clashly:take-created";
  const CREATE_MODAL_ID = "create-modal";
  const DEFAULT_PREVIEW_TEXT = "Image preview area";
  const NOTIFICATIONS_DRAWER_ID = "notifications-drawer";
  const DESKTOP_NOTIFICATIONS_QUERY = "(min-width: 1025px)";
  let notificationsUserId = "";
  let notificationsItems = [];

  const desktopLinks = [
    { id: "home", label: "Home", href: "index.html" },
    { id: "search", label: "Search", href: "search.html" },
    { id: "explore", label: "Explore", href: "explore.html" },
    { id: "notifications", label: "Notifications", href: "notifications.html" },
    { id: "create", label: "Create", href: "create.html", opensModal: true },
    { id: "profile", label: "Profile", href: "profile.html" },
    { id: "settings", label: "Settings", href: "settings.html" },
  ];

  const mobileLinks = [
    { id: "home", label: "Home", href: "index.html" },
    { id: "explore", label: "Explore", href: "explore.html" },
    { id: "create", label: "Create", href: "create.html", opensModal: true },
    { id: "notifications", label: "Notifications", href: "notifications.html" },
    { id: "profile", label: "Profile", href: "profile.html" },
  ];

  function shouldUseCreateModal() {
    return page !== "auth" && page !== "profile-setup" && page !== "create";
  }

  function shouldUseNotificationsDrawer() {
    return page !== "auth" && page !== "profile-setup" && page !== "notifications";
  }

  function isDesktopViewport() {
    return window.matchMedia(DESKTOP_NOTIFICATIONS_QUERY).matches;
  }

  function resolveActiveNavLink(id) {
    if (page === "take" || page === "home" || page === "hashtag") return id === "home";
    if (page === "search") return id === "explore";
    if (page === "category") return id === "explore";
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
      explore: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="8"></circle>
          <path d="M12 8.2v3.8l2.8 2.1"></path>
        </svg>
      `,
      search: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6"></circle>
          <path d="m20 20-4.2-4.2"></path>
        </svg>
      `,
      notifications: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 4.5a4.5 4.5 0 0 1 4.5 4.5v2.2c0 .92.24 1.82.7 2.61l1 1.72c.34.59-.08 1.3-.76 1.3H6.56c-.68 0-1.1-.71-.76-1.3l1-1.72c.46-.79.7-1.69.7-2.61V9A4.5 4.5 0 0 1 12 4.5Z"></path>
          <path d="M10.3 18.5a1.9 1.9 0 0 0 3.4 0"></path>
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
      settings: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3.1"></circle>
          <path d="M19 12a7 7 0 0 0-.07-.99l2.11-1.65-2-3.46-2.54 1a7.24 7.24 0 0 0-1.71-.99l-.38-2.69h-4l-.38 2.69a7.24 7.24 0 0 0-1.71.99l-2.54-1-2 3.46 2.11 1.65A7 7 0 0 0 5 12c0 .34.02.67.07.99L2.96 14.64l2 3.46 2.54-1c.52.41 1.1.74 1.71.99l.38 2.69h4l.38-2.69c.61-.25 1.19-.58 1.71-.99l2.54 1 2-3.46-2.11-1.65c.05-.32.07-.65.07-.99Z"></path>
        </svg>
      `,
    };

    return icons[id] || icons.home;
  }

  function buildDesktopLink(link) {
    const activeClass = resolveActiveNavLink(link.id) ? "is-active" : "";
    const modalAttr = link.opensModal && shouldUseCreateModal() ? ' data-open-create-modal="true"' : "";
    const notificationsAttr =
      link.id === "notifications" && shouldUseNotificationsDrawer() ? ' data-open-notifications-drawer="true"' : "";

    return `
      <li>
        <a class="desktop-nav__link ${activeClass}" href="${link.href}"${modalAttr}${notificationsAttr}>
          <span class="desktop-nav__icon desktop-nav__icon--${link.id}">${renderIcon(link.id)}</span>
          <span class="desktop-nav__label">${link.label}</span>
        </a>
      </li>
    `;
  }

  function buildMobileLink(link) {
    const activeClass = resolveActiveNavLink(link.id) ? "is-active" : "";
    const createClass = link.id === "create" ? " bottom-nav__link--create" : "";
    const modalAttr = link.opensModal && shouldUseCreateModal() ? ' data-open-create-modal="true"' : "";
    return `
      <a class="bottom-nav__link ${activeClass}${createClass}" href="${link.href}"${modalAttr} aria-label="${link.label}">
        <span class="bottom-nav__icon bottom-nav__icon--${link.id}" aria-hidden="true">${renderIcon(link.id)}</span>
      </a>
    `;
  }

  function buildTopNav() {
    if (!topNavEl) return;

    topNavEl.innerHTML = `
      <div class="top-nav__inner">
        <a class="brand" href="index.html" aria-label="Clashe home">
          <span class="brand__mark" aria-hidden="true">
            <img src="assets/clashly-mark.svg" alt="" />
          </span>
          <span>Clashe</span>
        </a>
        <nav class="desktop-nav" aria-label="Primary navigation">
          <ul class="desktop-nav__list">
            ${desktopLinks.map(buildDesktopLink).join("")}
          </ul>
        </nav>
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
    const logoutButtons = [document.getElementById("nav-logout-btn"), document.getElementById("logout-trigger")];
    logoutButtons.forEach((logoutBtn) => {
      if (!logoutBtn) return;
      logoutBtn.classList.toggle("is-hidden", !isVisible);
    });
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
            <button type="button" class="btn btn--ghost composer-modal__close" data-close-create-modal="true">X</button>
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
                <label for="create-modal-category" class="field-label">Category</label>
                <select id="create-modal-category" name="category" required>
                  <option value="">Loading categories...</option>
                </select>
                <p class="composer-hint">Choose the main lane this take belongs in.</p>
              </div>

              <div class="composer-media">
                <p class="field-label">Optional image</p>
                <label for="create-modal-image" class="composer-upload">
                  <span class="composer-upload__icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M12 5v9"></path>
                      <path d="M8.5 8.5 12 5l3.5 3.5"></path>
                      <path d="M5 15.5v1.75A1.75 1.75 0 0 0 6.75 19h10.5A1.75 1.75 0 0 0 19 17.25V15.5"></path>
                    </svg>
                  </span>
                  <span class="composer-upload__copy">
                    <strong>Add image</strong>
                  </span>
                </label>
                <input
                  id="create-modal-image"
                  class="composer-upload__input"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                />
                <p class="composer-hint">One image max.</p>
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
      categorySelect: document.getElementById("create-modal-category"),
      imageInput: document.getElementById("create-modal-image"),
      preview: document.getElementById("create-modal-preview"),
      status: document.getElementById("create-modal-status"),
      submit: document.getElementById("create-modal-submit"),
    };
  }

  function getNotificationsDrawerMarkup() {
    return `
      <div id="${NOTIFICATIONS_DRAWER_ID}" class="notifications-drawer" hidden>
        <button type="button" class="notifications-drawer__backdrop" aria-label="Close notifications" data-close-notifications-drawer="true"></button>
        <section class="notifications-drawer__panel" role="dialog" aria-modal="true" aria-labelledby="notifications-drawer-title">
          <header class="notifications-drawer__head">
            <h2 id="notifications-drawer-title" class="notifications-drawer__title">Notifications</h2>
            <button type="button" class="notifications-drawer__close" aria-label="Close notifications" data-close-notifications-drawer="true">X</button>
          </header>
          <p id="notifications-drawer-state" class="feed-state" hidden></p>
          <div id="notifications-drawer-list" class="notifications-drawer__list" aria-label="Notifications list"></div>
          <article id="notifications-drawer-empty" class="notification-empty" hidden>
            <p class="notification-empty__eyebrow">Quiet for now</p>
            <h3 class="notification-empty__title">Your notification floor is empty.</h3>
            <p class="notification-empty__text">Once people interact with your takes and profile, your stream will show up here.</p>
          </article>
        </section>
      </div>
    `;
  }

  function getNotificationsDrawerElements() {
    return {
      drawer: document.getElementById(NOTIFICATIONS_DRAWER_ID),
      state: document.getElementById("notifications-drawer-state"),
      list: document.getElementById("notifications-drawer-list"),
      empty: document.getElementById("notifications-drawer-empty"),
    };
  }

  function buildNotificationsDrawer() {
    if (!shouldUseNotificationsDrawer() || document.getElementById(NOTIFICATIONS_DRAWER_ID)) return;
    document.body.insertAdjacentHTML("beforeend", getNotificationsDrawerMarkup());
  }

  function setNotificationsDrawerState(message, type) {
    const { state } = getNotificationsDrawerElements();
    if (!state) return;

    state.hidden = !message;
    state.textContent = message || "";
    state.classList.remove("is-error", "is-success");
    if (type === "error") state.classList.add("is-error");
    if (type === "success") state.classList.add("is-success");
  }

  function renderNotificationAvatar(item) {
    const actor = item.actor || null;
    if (actor && actor.avatar_url) {
      return `<span class="notification-item__avatar"><img src="${window.ClashlyUtils.escapeHtml(actor.avatar_url)}" alt="@${window.ClashlyUtils.escapeHtml(
        actor.username || "user"
      )} avatar" /></span>`;
    }

    const fallback = actor && actor.username ? window.ClashlyProfiles.initialsFromUsername(actor.username) : "CL";
    return `<span class="notification-item__avatar">${window.ClashlyUtils.escapeHtml(fallback)}</span>`;
  }

  function renderNotificationsDrawerList() {
    const { list, empty } = getNotificationsDrawerElements();
    if (!list || !empty) return;

    if (!notificationsItems.length) {
      list.innerHTML = "";
      empty.hidden = false;
      return;
    }

    empty.hidden = true;
    list.innerHTML = notificationsItems
      .map((item) => {
        const actorUsername = item.actor && item.actor.username ? `@${item.actor.username}` : "@user";
        const time = window.ClashlyUtils.formatRelativeTime(item.created_at);
        const unreadClass = item.is_read ? "" : " is-unread";
        const snippet = item.snippet ? `<p class="notification-item__snippet">${window.ClashlyUtils.escapeHtml(item.snippet)}</p>` : "";

        return `
          <a
            class="notification-item${unreadClass}"
            href="${window.ClashlyUtils.escapeHtml(item.href)}"
            data-notification-id="${window.ClashlyUtils.escapeHtml(item.id)}"
          >
            ${renderNotificationAvatar(item)}
            <span class="notification-item__body">
              <span class="notification-item__message">${window.ClashlyUtils.escapeHtml(item.message)}</span>
              ${snippet}
              <span class="notification-item__meta">
                <span class="notification-item__actor">${window.ClashlyUtils.escapeHtml(actorUsername)}</span>
                <span class="notification-item__time">${window.ClashlyUtils.escapeHtml(time)}</span>
              </span>
            </span>
            <span class="notification-item__state" aria-hidden="true"></span>
          </a>
        `;
      })
      .join("");
  }

  async function markNotificationsDrawerRead(notificationIds) {
    if (!notificationsUserId || !window.ClashlyNotifications) return;
    const ids = Array.isArray(notificationIds) ? notificationIds : [];
    if (!ids.length) return;
    await window.ClashlyNotifications.markNotificationsRead(notificationsUserId, ids);
    notificationsItems = notificationsItems.map((item) => {
      if (!ids.includes(item.id)) return item;
      return { ...item, is_read: true };
    });
    renderNotificationsDrawerList();
  }

  async function loadNotificationsDrawer() {
    if (!window.ClashlySession || !window.ClashlyNotifications) return;

    setNotificationsDrawerState("Loading notifications...", "");
    const sessionState = await window.ClashlySession.resolveSession();
    notificationsUserId = sessionState.user ? sessionState.user.id : "";

    if (!notificationsUserId) {
      window.location.replace("auth.html");
      return;
    }

    const result = await window.ClashlyNotifications.fetchNotifications(notificationsUserId, { limit: 25 });
    if (result.error) {
      const message = window.ClashlyUtils.reportError(
        "Notifications drawer load failed.",
        result.error,
        "Could not load notifications."
      );
      setNotificationsDrawerState(message, "error");
      notificationsItems = [];
      renderNotificationsDrawerList();
      return;
    }

    notificationsItems = result.notifications || [];
    setNotificationsDrawerState("", "");
    renderNotificationsDrawerList();

    const unreadIds = notificationsItems.filter((item) => !item.is_read).map((item) => item.id);
    if (unreadIds.length) {
      window.setTimeout(() => {
        markNotificationsDrawerRead(unreadIds).catch(() => {});
      }, 180);
    }
  }

  function openNotificationsDrawer() {
    const { drawer } = getNotificationsDrawerElements();
    if (!drawer) return;
    drawer.hidden = false;
    drawer.classList.add("is-open");
    document.body.classList.add("has-notifications-drawer-open");
    loadNotificationsDrawer().catch((error) => {
      const message = window.ClashlyUtils.reportError("Notifications drawer load failed.", error, "Could not load notifications.");
      setNotificationsDrawerState(message, "error");
    });
  }

  function closeNotificationsDrawer() {
    const { drawer } = getNotificationsDrawerElements();
    if (!drawer) return;
    drawer.classList.remove("is-open");
    document.body.classList.remove("has-notifications-drawer-open");
    window.setTimeout(() => {
      if (!drawer.classList.contains("is-open")) {
        drawer.hidden = true;
      }
    }, 260);
  }

  function bindNotificationsDrawer() {
    if (!shouldUseNotificationsDrawer()) return;
    const elements = getNotificationsDrawerElements();
    if (!elements.drawer || !elements.list) return;

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const openTrigger = target.closest("[data-open-notifications-drawer='true']");
      if (openTrigger && isDesktopViewport()) {
        event.preventDefault();
        openNotificationsDrawer();
        return;
      }

      const closeTrigger = target.closest("[data-close-notifications-drawer='true']");
      if (closeTrigger) {
        event.preventDefault();
        closeNotificationsDrawer();
        return;
      }

      const item = target.closest("#notifications-drawer-list [data-notification-id]");
      if (!item) return;

      const notificationId = item.getAttribute("data-notification-id") || "";
      if (!notificationId) return;
      markNotificationsDrawerRead([notificationId]).catch(() => {});
      closeNotificationsDrawer();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !elements.drawer.hidden) {
        closeNotificationsDrawer();
      }
    });
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

  async function populateCreateCategories() {
    const { categorySelect } = getCreateModalElements();
    if (!categorySelect || !window.ClashlyCategories) return;

    categorySelect.innerHTML = `<option value="">Loading categories...</option>`;

    try {
      const result = await window.ClashlyCategories.fetchCategories();
      if (result.error) {
        throw result.error;
      }

      const categories = result.categories || [];
      if (!categories.length) {
        categorySelect.innerHTML = `<option value="">No categories available</option>`;
        return;
      }

      categorySelect.innerHTML = [
        `<option value="">Select category</option>`,
        ...categories.map(
          (category) =>
            `<option value="${window.ClashlyUtils.escapeHtml(category.slug)}">${window.ClashlyUtils.escapeHtml(
              category.name
            )}</option>`
        ),
      ].join("");
    } catch (error) {
      categorySelect.innerHTML = `<option value="">Could not load categories</option>`;
      setCreateStatus(window.ClashlyUtils.reportError("Create modal categories load failed.", error, "Could not load categories."), "error");
    }
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
    if (!elements.modal || !elements.form || !window.ClashlyTakes || !window.ClashlySession || !window.ClashlyCategories) return;

    updateCreateCount();
    populateCreateCategories();

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

      const categoryError = window.ClashlyTakes.validateCategory(elements.categorySelect.value);
      if (categoryError) {
        setCreateStatus(categoryError, "error");
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
          categorySlug: elements.categorySelect.value,
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
    buildNotificationsDrawer();
    bindLogoutActions();
    bindCreateModal();
    bindNotificationsDrawer();
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
