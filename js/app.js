(function () {
  const page = document.body.dataset.page || "";
  const topNavEl = document.getElementById("top-nav");
  const bottomNavEl = document.getElementById("bottom-nav");
  const CREATE_EVENT = "clashly:take-created";
  const CREATE_MODAL_ID = "create-modal";
  const ONBOARDING_MODAL_ID = "onboarding-modal";
  const ONBOARDING_STORAGE_KEY_PREFIX = "clashe-onboarding-seen";
  const DEFAULT_PREVIEW_TEXT = "Image preview area";
  const CREATE_UPLOAD_LIMIT_MODAL_ID = "create-modal-upload-limit";
  const CREATE_UPLOAD_LIMIT_TIMEOUT_MS = 2600;
  const NOTIFICATIONS_DRAWER_ID = "notifications-drawer";
  const DESKTOP_NOTIFICATIONS_QUERY = "(min-width: 1025px)";
  const ONBOARDING_ENABLED_PAGES = new Set([
    "home",
    "explore",
    "search",
    "notifications",
    "profile",
    "settings",
    "take",
    "category",
    "hashtag",
    "create",
  ]);
  let notificationsUserId = "";
  let notificationsItems = [];
  let onboardingActiveUserId = "";
  let onboardingShownForUserId = "";
  let createModalImageFiles = [];
  let createUploadLimitModalTimer = null;

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

  function shouldUseOnboardingModal() {
    return ONBOARDING_ENABLED_PAGES.has(page);
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

  function shouldShowLegalFooter() {
    return page !== "auth";
  }

  function getLegalFooterMarkup() {
    return `
      <footer id="app-legal-footer" class="app-legal-footer" aria-label="Legal links">
        <a href="terms.html">Terms of Service</a>
        <span aria-hidden="true">•</span>
        <a href="privacy.html">Privacy Policy</a>
      </footer>
    `;
  }

  function buildLegalFooter() {
    if (!shouldShowLegalFooter() || document.getElementById("app-legal-footer")) return;

    if (bottomNavEl && bottomNavEl.parentNode) {
      bottomNavEl.insertAdjacentHTML("beforebegin", getLegalFooterMarkup());
      return;
    }

    document.body.insertAdjacentHTML("beforeend", getLegalFooterMarkup());
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

  function getOnboardingStorageKey(userId) {
    return `${ONBOARDING_STORAGE_KEY_PREFIX}:${userId}`;
  }

  function hasSeenOnboarding(userId) {
    if (!userId) return true;
    try {
      return window.localStorage.getItem(getOnboardingStorageKey(userId)) === "1";
    } catch (_error) {
      return false;
    }
  }

  function markOnboardingSeen(userId) {
    if (!userId) return;
    try {
      window.localStorage.setItem(getOnboardingStorageKey(userId), "1");
    } catch (_error) {
      // Ignore storage access failures.
    }
  }

  function getOnboardingModalMarkup() {
    return `
      <div id="${ONBOARDING_MODAL_ID}" class="onboarding-modal" hidden>
        <button
          type="button"
          class="onboarding-modal__backdrop"
          aria-label="Close onboarding guide"
          data-close-onboarding="true"
        ></button>
        <section class="onboarding-modal__panel" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
          <header class="onboarding-modal__head">
            <p class="onboarding-modal__kicker">Welcome to Clashe</p>
            <h2 id="onboarding-title" class="onboarding-modal__title">Quick start guide</h2>
            <button
              type="button"
              class="onboarding-modal__close"
              aria-label="Close onboarding guide"
              data-close-onboarding="true"
            >
              X
            </button>
          </header>
          <p class="onboarding-modal__copy">
            Clashe is built for sharp takes and clear debate. Here is how to get started.
          </p>
          <ul class="onboarding-modal__list">
            <li>
              <strong>Post your take</strong>
              <span>Share one clear opinion to start a focused discussion.</span>
            </li>
            <li>
              <strong>Vote and discuss</strong>
              <span>Use agree/disagree and comments to push arguments forward.</span>
            </li>
            <li>
              <strong>Follow the best thinkers</strong>
              <span>Build a feed around people and topics you care about.</span>
            </li>
          </ul>
          <footer class="onboarding-modal__actions">
            <button type="button" class="btn btn--primary" data-close-onboarding="true">Start exploring</button>
          </footer>
        </section>
      </div>
    `;
  }

  function buildOnboardingModal() {
    if (!shouldUseOnboardingModal() || document.getElementById(ONBOARDING_MODAL_ID)) return;
    document.body.insertAdjacentHTML("beforeend", getOnboardingModalMarkup());
  }

  function getOnboardingModal() {
    return document.getElementById(ONBOARDING_MODAL_ID);
  }

  function openOnboardingModal(userId) {
    const modal = getOnboardingModal();
    if (!modal || !userId) return;
    onboardingActiveUserId = userId;
    modal.hidden = false;
    document.body.classList.add("has-onboarding-open");
  }

  function closeOnboardingModal(options = {}) {
    const modal = getOnboardingModal();
    if (!modal) return;
    const shouldMarkSeen = options.markSeen !== false;
    modal.hidden = true;
    document.body.classList.remove("has-onboarding-open");
    if (shouldMarkSeen && onboardingActiveUserId) {
      markOnboardingSeen(onboardingActiveUserId);
    }
    onboardingActiveUserId = "";
  }

  function maybeShowOnboarding(userId) {
    if (!shouldUseOnboardingModal() || !userId) return;
    if (onboardingShownForUserId === userId) return;

    onboardingShownForUserId = userId;
    if (hasSeenOnboarding(userId)) return;
    openOnboardingModal(userId);
  }

  function bindOnboardingModal() {
    if (!shouldUseOnboardingModal()) return;
    const modal = getOnboardingModal();
    if (!modal) return;

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const closeTrigger = target.closest("[data-close-onboarding='true']");
      if (!closeTrigger) return;
      event.preventDefault();
      closeOnboardingModal();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) {
        closeOnboardingModal();
      }
    });
  }

  async function syncAuthUi() {
    if (!window.ClashlySession) return;

    const sessionState = await window.ClashlySession.resolveSession();
    const user = sessionState.user || null;
    setLogoutVisibility(Boolean(user));

    if (!user) {
      onboardingShownForUserId = "";
      closeOnboardingModal({ markSeen: false });
      return;
    }

    maybeShowOnboarding(user.id);
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
            <button type="button" class="modal-close-btn composer-modal__close" data-close-create-modal="true" aria-label="Close composer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
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
                <p class="field-label">Optional images</p>
                <label for="create-modal-image" class="composer-upload">
                  <span class="composer-upload__icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M12 5v9"></path>
                      <path d="M8.5 8.5 12 5l3.5 3.5"></path>
                      <path d="M5 15.5v1.75A1.75 1.75 0 0 0 6.75 19h10.5A1.75 1.75 0 0 0 19 17.25V15.5"></path>
                    </svg>
                  </span>
                  <span class="composer-upload__copy">
                    <strong>Add images</strong>
                  </span>
                </label>
                <input
                  id="create-modal-image"
                  class="composer-upload__input"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  multiple
                />
                <p class="composer-hint">Up to 2 images max.</p>
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
                  <li><strong>2 images max</strong><span>Use visuals only when they strengthen the opinion.</span></li>
                  <li><strong>Posts go live fast</strong><span>Once posted, your take is available for voting and replies immediately.</span></li>
                </ul>
              </section>
            </aside>
          </div>
        </section>
      </div>
      <section id="${CREATE_UPLOAD_LIMIT_MODAL_ID}" class="upload-limit-modal" hidden>
        <div class="upload-limit-modal__backdrop" data-close-create-upload-limit="true"></div>
        <article class="upload-limit-modal__panel" role="dialog" aria-modal="true" aria-labelledby="create-upload-limit-message">
          <p id="create-upload-limit-message" class="upload-limit-modal__text">You can only upload a maximum of 2 photos</p>
          <div class="upload-limit-modal__actions">
            <button type="button" class="btn btn--ghost upload-limit-modal__ok" data-close-create-upload-limit="true">OK</button>
          </div>
        </article>
      </section>
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
            <button type="button" class="notifications-drawer__close" aria-label="Close notifications" data-close-notifications-drawer="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
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

  function getCreateImageFiles() {
    return createModalImageFiles.slice();
  }

  function renderCreatePreview(files) {
    const { preview } = getCreateModalElements();
    if (!preview) return;

    resetCreatePreview();
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
                  data-remove-create-image-index="${index}"
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

  function closeCreateUploadLimitModal() {
    const modal = document.getElementById(CREATE_UPLOAD_LIMIT_MODAL_ID);
    if (!modal) return;
    modal.hidden = true;
    if (createUploadLimitModalTimer) {
      window.clearTimeout(createUploadLimitModalTimer);
      createUploadLimitModalTimer = null;
    }
  }

  function openCreateUploadLimitModal(maxImages) {
    const modal = document.getElementById(CREATE_UPLOAD_LIMIT_MODAL_ID);
    const message = document.getElementById("create-upload-limit-message");
    if (!modal || !message) {
      setCreateStatus(`You can only upload a maximum of ${maxImages} photos`, "error");
      return;
    }

    message.textContent = `You can only upload a maximum of ${maxImages} photos`;
    modal.hidden = false;

    if (createUploadLimitModalTimer) {
      window.clearTimeout(createUploadLimitModalTimer);
    }
    createUploadLimitModalTimer = window.setTimeout(() => {
      closeCreateUploadLimitModal();
    }, CREATE_UPLOAD_LIMIT_TIMEOUT_MS);
  }

  function resetCreateForm() {
    const { form, imageInput } = getCreateModalElements();
    if (!form) return;
    form.reset();
    createModalImageFiles = [];
    if (imageInput) imageInput.value = "";
    resetCreatePreview();
    closeCreateUploadLimitModal();
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
    closeCreateUploadLimitModal();
    document.body.style.overflow = "";
  }

  function bindCreateModal() {
    if (!shouldUseCreateModal()) return;
    const elements = getCreateModalElements();
    if (!elements.modal || !elements.form || !elements.preview || !elements.imageInput || !window.ClashlyTakes || !window.ClashlySession || !window.ClashlyCategories) return;

    updateCreateCount();
    populateCreateCategories();

    elements.textarea.addEventListener("input", () => {
      setCreateStatus("", "");
      updateCreateCount();
    });

    elements.preview.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const removeButton = target.closest("[data-remove-create-image-index]");
      if (!removeButton) return;

      event.preventDefault();
      const index = Number(removeButton.getAttribute("data-remove-create-image-index"));
      if (!Number.isFinite(index) || index < 0) return;

      createModalImageFiles = createModalImageFiles.filter((_, fileIndex) => fileIndex !== index);
      renderCreatePreview(createModalImageFiles);
      setCreateStatus("", "");
    });

    elements.imageInput.addEventListener("change", () => {
      const incomingFiles = Array.from((elements.imageInput && elements.imageInput.files) || []).filter(Boolean);
      if (!incomingFiles.length) return;

      const maxImages = Number(window.ClashlyTakes.MAX_IMAGES_PER_TAKE || 2);
      if (createModalImageFiles.length >= maxImages) {
        openCreateUploadLimitModal(maxImages);
        elements.imageInput.value = "";
        return;
      }

      const mergedFiles = mergeImageSelections(createModalImageFiles, incomingFiles);
      let nextFiles = mergedFiles;
      if (mergedFiles.length > maxImages) {
        openCreateUploadLimitModal(maxImages);
        nextFiles =
          createModalImageFiles.length >= maxImages
            ? createModalImageFiles.slice(0, maxImages)
            : mergedFiles.slice(0, maxImages);
      } else {
        closeCreateUploadLimitModal();
      }

      const validation = window.ClashlyTakes.validateImageFiles(nextFiles);
      if (!validation.valid) {
        elements.imageInput.value = "";
        setCreateStatus(validation.error, "error");
        return;
      }

      createModalImageFiles = nextFiles;
      elements.imageInput.value = "";
      renderCreatePreview(createModalImageFiles);
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

      const imageFiles = getCreateImageFiles();
      const imageValidation = window.ClashlyTakes.validateImageFiles(imageFiles);
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
          imageFiles,
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
        return;
      }

      const closeUploadLimitTrigger = event.target.closest("[data-close-create-upload-limit='true']");
      if (closeUploadLimitTrigger) {
        event.preventDefault();
        closeCreateUploadLimitModal();
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
    buildLegalFooter();
    buildCreateModal();
    buildOnboardingModal();
    buildNotificationsDrawer();
    bindLogoutActions();
    bindCreateModal();
    bindOnboardingModal();
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
