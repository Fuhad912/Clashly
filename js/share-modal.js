(function () {
  const MODAL_ID = "share-modal";

  function buildAvatar(profile) {
    if (profile && profile.avatar_url) {
      return `<div class="share-preview__avatar"><img src="${window.ClashlyUtils.escapeHtml(profile.avatar_url)}" alt="" /></div>`;
    }

    const username = profile && profile.username ? profile.username : "cl";
    return `<div class="share-preview__avatar">${window.ClashlyUtils.escapeHtml(
      window.ClashlyUtils.initialsFromName(username)
    )}</div>`;
  }

  function getUsername(profile) {
    return profile && profile.username ? `@${profile.username}` : "@anonymous";
  }

  function getShareText(take) {
    if (!take) return "See this take on Clashe";
    const username = getUsername(take.profile);
    return `${take.content} - ${username} on Clashe`;
  }

  function getShareUrl(take) {
    if (!take || !take.id) return window.location.href;
    return window.ClashlyUtils.toTakeUrl(take.id);
  }

  function renderPlatformIcon(name) {
    const icons = {
      copy: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10.6 13.4 8.5 15.5a3 3 0 1 1-4.2-4.2l2.1-2.1"></path>
          <path d="M13.4 10.6 15.5 8.5a3 3 0 1 1 4.2 4.2l-2.1 2.1"></path>
          <path d="m9 15 6-6"></path>
        </svg>
      `,
      x: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            stroke="none"
            d="M18.244 2H21l-6.56 7.5L22.2 22h-6.1l-4.8-6.2L5.86 22H3.1l7.02-8.02L2 2h6.26l4.33 5.67L18.244 2Zm-1.07 18h1.69L6.11 3.9H4.29L17.17 20Z"
          ></path>
        </svg>
      `,
      facebook: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            stroke="none"
            d="M14.2 21v-7.2h2.5l.4-3h-2.9V8.8c0-.9.2-1.5 1.5-1.5H17V4.6c-.3 0-1.1-.1-2-.1-2.4 0-4.1 1.4-4.1 4.2v2.1H8.4v3h2.5V21h3.3Z"
          ></path>
        </svg>
      `,
      whatsapp: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 11.6a8 8 0 0 1-11.8 7l-4.2 1.1 1.1-4.1A8 8 0 1 1 20 11.6Z"></path>
          <path d="M9.1 8.7c.2-.4.4-.4.7-.4h.6c.2 0 .4 0 .5.4l.8 1.8c.1.2.1.4 0 .6l-.4.7c-.1.2 0 .4.1.5.4.7 1.1 1.4 1.9 1.8.2.1.4.1.6 0l.7-.4c.2-.1.4-.1.6 0l1.8.8c.4.2.4.3.4.6v.5c0 .3-.1.5-.4.7-.5.3-1 .5-1.7.5-1 0-2-.4-3.1-1.2a9.1 9.1 0 0 1-2.4-2.6c-.7-1-.9-1.9-.9-2.7 0-.6.2-1.1.5-1.4Z"></path>
        </svg>
      `,
      telegram: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            stroke="none"
            d="m21 4-3.7 16.4c-.1.6-.6.8-1.1.5l-5.2-3.9-2.5 2.4c-.3.3-.5.5-1 .5l.4-5.3L17.6 6c.4-.3-.1-.5-.6-.2L5 13.3l-5-1.6c-1-.3-1-1 .2-1.5L19.2 3c.9-.3 2 .2 1.8 1Z"
          ></path>
        </svg>
      `,
      instagram: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="4"></rect>
          <circle cx="12" cy="12" r="3.5"></circle>
          <circle cx="17.2" cy="6.8" r="1"></circle>
        </svg>
      `,
    };

    return icons[name] || "";
  }

  function buildMarkup() {
    return `
      <div id="${MODAL_ID}" class="share-modal" hidden>
        <div class="share-modal__backdrop" data-close-share-modal="true"></div>
        <section class="share-modal__panel" role="dialog" aria-modal="true" aria-labelledby="share-modal-title">
          <header class="share-modal__head">
            <div>
              <p class="share-modal__eyebrow">Send this take</p>
              <h2 id="share-modal-title">Share</h2>
            </div>
            <button type="button" class="modal-close-btn" data-close-share-modal="true" aria-label="Close share">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </header>

          <section id="share-preview" class="share-preview"></section>
          <p class="share-modal__copy">Push this take into another room. Send the link where the debate will travel fastest.</p>
          <p id="share-modal-status" class="feed-state" hidden></p>

          <div class="share-actions">
            <button type="button" class="share-action" data-share-action="instagram">
              <span class="share-action__orb share-action__orb--instagram">${renderPlatformIcon("instagram")}</span>
              <span class="share-action__label">Instagram</span>
            </button>
            <a href="#" class="share-action" data-share-action="whatsapp" target="_blank" rel="noreferrer">
              <span class="share-action__orb share-action__orb--whatsapp">${renderPlatformIcon("whatsapp")}</span>
              <span class="share-action__label">WhatsApp</span>
            </a>
            <a href="#" class="share-action" data-share-action="facebook" target="_blank" rel="noreferrer">
              <span class="share-action__orb share-action__orb--facebook">${renderPlatformIcon("facebook")}</span>
              <span class="share-action__label">Facebook</span>
            </a>
            <a href="#" class="share-action" data-share-action="x" target="_blank" rel="noreferrer">
              <span class="share-action__orb share-action__orb--x">${renderPlatformIcon("x")}</span>
              <span class="share-action__label">X</span>
            </a>
            <a href="#" class="share-action" data-share-action="telegram" target="_blank" rel="noreferrer">
              <span class="share-action__orb share-action__orb--telegram">${renderPlatformIcon("telegram")}</span>
              <span class="share-action__label">Telegram</span>
            </a>
            <button type="button" class="share-action" data-share-action="copy-link">
              <span class="share-action__orb share-action__orb--copy">${renderPlatformIcon("copy")}</span>
              <span class="share-action__label">Link</span>
            </button>
          </div>
        </section>
      </div>
    `;
  }

  function ensureModal() {
    if (document.getElementById(MODAL_ID) || !document.body) return;
    document.body.insertAdjacentHTML("beforeend", buildMarkup());
  }

  function setStatus(message, type) {
    const statusEl = document.getElementById("share-modal-status");
    if (!statusEl) return;
    statusEl.hidden = !message;
    statusEl.textContent = message || "";
    statusEl.classList.remove("is-error", "is-success");
    if (type === "error") statusEl.classList.add("is-error");
    if (type === "success") statusEl.classList.add("is-success");
  }

  function renderPreview(take) {
    const preview = document.getElementById("share-preview");
    if (!preview) return;
    if (!take) {
      preview.innerHTML = `<p class="feed-empty">Take preview unavailable.</p>`;
      return;
    }

    const username = getUsername(take.profile);
    const time = window.ClashlyUtils.formatRelativeTime(take.created_at);
    const media = take.image_url
      ? `<div class="share-preview__media"><img src="${window.ClashlyUtils.escapeHtml(take.image_url)}" alt="" /></div>`
      : "";

    preview.innerHTML = `
      <article class="share-preview__card">
        <div class="share-preview__meta">
          ${buildAvatar(take.profile)}
          <div class="share-preview__identity">
            <strong>${window.ClashlyUtils.escapeHtml(username)}</strong>
            <span>${window.ClashlyUtils.escapeHtml(time)}</span>
          </div>
        </div>
        <p class="share-preview__text">${window.ClashlyUtils.escapeHtml(take.content || "")}</p>
        ${media}
      </article>
    `;
  }

  let currentTake = null;

  function updateLinks() {
    const shareUrl = encodeURIComponent(getShareUrl(currentTake));
    const shareText = encodeURIComponent(getShareText(currentTake));
    const xLink = document.querySelector("[data-share-action='x']");
    const facebookLink = document.querySelector("[data-share-action='facebook']");
    const whatsappLink = document.querySelector("[data-share-action='whatsapp']");
    const telegramLink = document.querySelector("[data-share-action='telegram']");
    if (xLink) xLink.href = `https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareText}`;
    if (facebookLink) facebookLink.href = `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`;
    if (whatsappLink) whatsappLink.href = `https://wa.me/?text=${shareText}%20${shareUrl}`;
    if (telegramLink) telegramLink.href = `https://t.me/share/url?url=${shareUrl}&text=${shareText}`;
  }

  function open(options) {
    ensureModal();
    currentTake = options && options.take ? options.take : null;
    renderPreview(currentTake);
    updateLinks();
    setStatus("", "");

    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function close() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = "";
    setStatus("", "");
  }

  async function handleInstagramShare() {
    const shareData = {
      title: "Clashe",
      text: getShareText(currentTake),
      url: getShareUrl(currentTake),
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        setStatus("", "");
        close();
        return;
      } catch (error) {
        if (error && error.name === "AbortError") {
          return;
        }
      }
    }

    try {
      await window.ClashlyUtils.copyText(getShareUrl(currentTake));
      window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
      setStatus("", "");
    } catch (error) {
      setStatus(window.ClashlyUtils.reportError("Instagram share fallback failed.", error, "Could not prepare Instagram share."), "error");
    }
  }

  function bindEvents() {
    document.addEventListener("click", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const closeTrigger = target.closest("[data-close-share-modal='true']");
      if (closeTrigger) {
        event.preventDefault();
        close();
        return;
      }

      const action = target.closest("[data-share-action]");
      if (!action) return;

      const actionType = action.getAttribute("data-share-action") || "";
      if (actionType === "copy-link") {
        event.preventDefault();
        try {
          await window.ClashlyUtils.copyText(getShareUrl(currentTake));
          setStatus("", "");
        } catch (error) {
          setStatus(window.ClashlyUtils.reportError("Copy link failed.", error, "Could not copy link."), "error");
        }
      }

      if (actionType === "instagram") {
        event.preventDefault();
        await handleInstagramShare();
      }
    });

    document.addEventListener("keydown", (event) => {
      const modal = document.getElementById(MODAL_ID);
      if (event.key === "Escape" && modal && !modal.hidden) {
        close();
      }
    });
  }

  bindEvents();

  window.ClashlyShareModal = {
    open,
    close,
  };
})();
