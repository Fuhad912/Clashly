(function () {
  let currentUserId = "";
  let currentNotifications = [];

  function setState(message, type) {
    const stateEl = document.getElementById("notifications-state");
    if (!stateEl) return;

    stateEl.hidden = !message;
    stateEl.textContent = message || "";
    stateEl.classList.remove("is-error", "is-success");
    if (type === "error") stateEl.classList.add("is-error");
    if (type === "success") stateEl.classList.add("is-success");
  }

  function renderAvatar(notification) {
    const actor = notification.actor || null;
    if (actor && actor.avatar_url) {
      return `<span class="notification-item__avatar"><img src="${window.ClashlyUtils.escapeHtml(actor.avatar_url)}" alt="@${window.ClashlyUtils.escapeHtml(
        actor.username || "user"
      )} avatar" /></span>`;
    }

    const fallback = actor && actor.username ? window.ClashlyProfiles.initialsFromUsername(actor.username) : "CL";
    return `<span class="notification-item__avatar">${window.ClashlyUtils.escapeHtml(fallback)}</span>`;
  }

  function renderList() {
    const listEl = document.getElementById("notifications-list");
    const emptyEl = document.getElementById("notifications-empty");
    if (!listEl || !emptyEl) return;

    if (!currentNotifications.length) {
      listEl.innerHTML = "";
      emptyEl.hidden = false;
      return;
    }

    emptyEl.hidden = true;
    listEl.innerHTML = currentNotifications
      .map((notification) => {
        const actorUsername = notification.actor && notification.actor.username ? `@${notification.actor.username}` : "@user";
        const time = window.ClashlyUtils.formatRelativeTime(notification.created_at);
        const unreadClass = notification.is_read ? "" : " is-unread";
        const snippet = notification.snippet
          ? `<p class="notification-item__snippet">${window.ClashlyUtils.escapeHtml(notification.snippet)}</p>`
          : "";

        return `
          <a
            class="notification-item${unreadClass}"
            href="${window.ClashlyUtils.escapeHtml(notification.href)}"
            data-notification-id="${window.ClashlyUtils.escapeHtml(notification.id)}"
          >
            ${renderAvatar(notification)}
            <span class="notification-item__body">
              <span class="notification-item__message">${window.ClashlyUtils.escapeHtml(notification.message)}</span>
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

  async function markUnreadAsRead() {
    if (!currentUserId || !window.ClashlyNotifications) return;
    const unreadIds = currentNotifications.filter((item) => !item.is_read).map((item) => item.id);
    if (!unreadIds.length) return;

    const result = await window.ClashlyNotifications.markNotificationsRead(currentUserId, unreadIds);
    if (result.error) return;

    currentNotifications = currentNotifications.map((item) => ({ ...item, is_read: true }));
    renderList();
  }

  async function loadNotifications() {
    if (!currentUserId || !window.ClashlyNotifications) return;

    // Hide the "Loading..." text — the skeleton communicates loading state visually
    setState("", "");

    // Show skeleton immediately so the page never looks blank
    if (typeof window.clasheShowNotificationSkeleton === "function") {
      window.clasheShowNotificationSkeleton("notifications-list", 6);
    }

    try {
      const result = await window.ClashlyNotifications.fetchNotifications(currentUserId, { limit: 25 });
      if (result.error) {
        throw result.error;
      }

      currentNotifications = result.notifications || [];
      renderList();
      window.setTimeout(() => {
        markUnreadAsRead().catch(() => {});
      }, 160);
    } catch (error) {
      // On error, clear skeleton so error message renders cleanly
      const listEl = document.getElementById("notifications-list");
      if (listEl) listEl.innerHTML = "";
      setState(window.ClashlyUtils.reportError("Notifications load failed.", error, "Could not load notifications."), "error");
    }
  }

  function bindList() {
    const listEl = document.getElementById("notifications-list");
    if (!listEl || !window.ClashlyNotifications) return;

    listEl.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const item = target.closest("[data-notification-id]");
      if (!item) return;

      const notificationId = item.getAttribute("data-notification-id") || "";
      if (!notificationId || !currentUserId) return;

      window.ClashlyNotifications.markNotificationsRead(currentUserId, [notificationId]).catch(() => {});
    });
  }

  async function initNotificationsPage() {
    try {
      if (!window.ClashlySession || !window.ClashlyNotifications) return;

      const sessionState = await window.ClashlySession.resolveSession();
      currentUserId = sessionState.user ? sessionState.user.id : "";
      bindList();
      await loadNotifications();
    } finally {
      if (window.ClasheLoader) {
        window.ClasheLoader.release("page-data");
      }
    }
  }

  document.addEventListener("DOMContentLoaded", initNotificationsPage);
})();
