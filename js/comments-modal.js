(function () {
  const DRAWER_ID = "comments-drawer";
  const UPDATE_EVENT = "clashly:take-updated";
  const BOOKMARK_UPDATE_EVENT = "clashly:take-bookmark-updated";

  let currentUserId = "";
  let currentTake = null;
  let currentTakeId = "";
  let currentComments = [];
  let currentCommentsCount = 0;
  let currentCommentsSort = "newest";
  let activeReplyTarget = null;
  let expandedReplyIds = new Set();
  let dragState = {
    active: false,
    startY: 0,
    currentY: 0,
    lastY: 0,
    lastTime: 0,
    velocity: 0,
  };

  function isDesktopLayout() {
    return window.matchMedia("(min-width: 980px)").matches;
  }

  function getDrawer() {
    return document.getElementById(DRAWER_ID);
  }

  function getEl(id) {
    return document.getElementById(id);
  }

  function buildMarkup() {
    return `
      <div id="${DRAWER_ID}" class="comments-drawer" hidden>
        <div class="comments-drawer__backdrop" data-close-comments-drawer="true"></div>
        <section class="comments-drawer__panel" role="dialog" aria-modal="true" aria-labelledby="comments-drawer-title">
          <div class="comments-drawer__handle" aria-hidden="true"></div>
          <header class="comments-drawer__head">
            <div>
              <h2 id="comments-drawer-title">Comments</h2>
              <p><span id="comments-drawer-total">0</span> reactions in this debate.</p>
            </div>
            <button
              type="button"
              class="comments-drawer__close"
              data-close-comments-drawer="true"
              aria-label="Close comments drawer"
            >
              &times;
            </button>
          </header>

          <div class="comments-drawer__layout">
            <section id="comments-drawer-stage" class="comments-drawer__stage">
              <section id="comments-drawer-take" class="comments-drawer__take"></section>
              <section id="comments-drawer-media" class="comments-drawer__media" hidden></section>
            </section>

            <section class="comments-drawer__discussion">
              <section class="comments-drawer__body">
                <div class="comments-shell">
                  <header class="comments-shell__head">
                    <label class="comments-sort comments-sort--compact" aria-label="Sort comments">
                      <span class="comments-sort__icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" focusable="false">
                          <path d="M4.75 6.5h14.5"></path>
                          <path d="M7.5 12h9"></path>
                          <path d="M10.25 17.5h3.5"></path>
                        </svg>
                      </span>
                      <span class="comments-sort__label">Sort comments</span>
                      <select id="comments-drawer-sort">
                        <option value="newest">Newest</option>
                        <option value="oldest">Oldest</option>
                      </select>
                    </label>
                  </header>

                  <p id="comments-drawer-state" class="comments-drawer__status feed-state" hidden></p>
                  <section id="comments-drawer-thread" class="comments-thread" aria-label="Take comments"></section>
                </div>
              </section>

              <div class="comments-drawer__composer">
                <form id="comments-drawer-form" class="comment-compose comment-compose--inline" novalidate>
                  <div class="comment-compose__replying" id="comments-drawer-replying" hidden>
                    <span id="comments-drawer-replying-text">Replying</span>
                    <button type="button" class="comment-compose__cancel" id="comments-drawer-cancel-reply">Cancel</button>
                  </div>
                  <div class="comment-compose__row">
                    <label class="comment-compose__field" for="comments-drawer-input">
                      <textarea
                        id="comments-drawer-input"
                        name="comment"
                        rows="1"
                        placeholder="Add a comment..."
                        required
                      ></textarea>
                    </label>
                    <button type="submit" class="btn btn--primary comment-compose__submit" id="comments-drawer-submit">Post</button>
                  </div>
                  <footer class="comment-compose__footer">
                    <span class="comment-compose__count" id="comments-drawer-count">0</span>
                  </footer>
                </form>
              </div>
            </section>
          </div>
        </section>
      </div>
    `;
  }

  function ensureDrawer() {
    if (getDrawer() || !document.body) return;
    document.body.insertAdjacentHTML("beforeend", buildMarkup());
  }

  function setDrawerState(message, type) {
    const stateEl = getEl("comments-drawer-state");
    if (!stateEl) return;
    stateEl.hidden = !message;
    stateEl.textContent = message || "";
    stateEl.classList.remove("is-error", "is-success");
    if (type === "error") stateEl.classList.add("is-error");
    if (type === "success") stateEl.classList.add("is-success");
  }

  function updateCountLabel() {
    const input = getEl("comments-drawer-input");
    const countEl = getEl("comments-drawer-count");
    if (!input || !countEl) return;
    countEl.textContent = String(input.value.length);
  }

  function autoSizeInput() {
    const input = getEl("comments-drawer-input");
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
  }

  function syncComposerExpandedState() {
    const form = getEl("comments-drawer-form");
    const input = getEl("comments-drawer-input");
    if (!form || !input) return;
    const shouldExpand = document.activeElement === input || Boolean(input.value.trim()) || Boolean(activeReplyTarget);
    form.classList.toggle("comment-compose--expanded", shouldExpand);
  }

  function setReplyTarget(commentId, username) {
    activeReplyTarget = commentId ? { commentId, username } : null;
    const wrapper = getEl("comments-drawer-replying");
    const textEl = getEl("comments-drawer-replying-text");
    if (!wrapper || !textEl) return;

    if (!activeReplyTarget) {
      wrapper.hidden = true;
      textEl.textContent = "";
      syncComposerExpandedState();
      return;
    }

    wrapper.hidden = false;
    textEl.textContent = `Replying to ${username}`;
    syncComposerExpandedState();
  }

  function resetComposer() {
    const input = getEl("comments-drawer-input");
    if (input) {
      input.value = "";
    }
    updateCountLabel();
    autoSizeInput();
    setReplyTarget("", "");
    syncComposerExpandedState();
  }

  function updateTotals() {
    const totalEls = [getEl("comments-drawer-total"), getEl("comments-drawer-thread-total")];
    totalEls.forEach((el) => {
      if (el) el.textContent = String(currentCommentsCount);
    });
  }

  function renderTake() {
    const streamEl = getEl("comments-drawer-take");
    const stageEl = getEl("comments-drawer-stage");
    const mediaEl = getEl("comments-drawer-media");
    if (!streamEl || !window.ClashlyTakeRenderer) return;
    const showMedia = isDesktopLayout() && Boolean(currentTake && currentTake.image_url);

    const takeForPreview =
      currentTake && currentTake.image_url
        ? {
            ...currentTake,
            image_url: "",
          }
        : currentTake;

    window.ClashlyTakeRenderer.renderTakeList(streamEl, takeForPreview ? [takeForPreview] : [], {
      currentUserId,
      hideCommentsAction: true,
      hideActionRow: true,
    });

    if (stageEl) {
      stageEl.classList.toggle("comments-drawer__stage--media", showMedia);
    }

    if (mediaEl) {
      if (showMedia) {
        const username = currentTake.profile && currentTake.profile.username ? `@${currentTake.profile.username}` : "@clashly";
        mediaEl.hidden = false;
        mediaEl.innerHTML = `
          <div class="comments-drawer__media-frame">
            <img src="${window.ClashlyUtils.escapeHtml(currentTake.image_url)}" alt="${window.ClashlyUtils.escapeHtml(
              username
            )} take image" />
          </div>
        `;
      } else {
        mediaEl.hidden = true;
        mediaEl.innerHTML = "";
      }
    }

    window.ClashlyTakeRenderer.bindShareActions(streamEl, {
      onStatus: setDrawerState,
      onShare: handleShareOpen,
    });
    window.ClashlyTakeRenderer.bindVoteActions(streamEl, {
      onStatus: setDrawerState,
      onVote: handleVote,
    });
    window.ClashlyTakeRenderer.bindBookmarkActions(streamEl, {
      onStatus: setDrawerState,
      onBookmark: handleBookmark,
    });
  }

  function renderComments() {
    const threadEl = getEl("comments-drawer-thread");
    if (!threadEl || !window.ClashlyCommentsRenderer) return;

    window.ClashlyCommentsRenderer.renderCommentThread(threadEl, currentComments, {
      currentUserId,
      expandedReplyIds,
      takeAuthorId: currentTake ? currentTake.user_id : "",
    });
  }

  function findCommentById(items, commentId) {
    for (const item of items || []) {
      if (item.id === commentId) return item;
      const nested = findCommentById(item.replies || [], commentId);
      if (nested) return nested;
    }
    return null;
  }

  async function loadComments() {
    if (!currentTakeId || !window.ClashlyComments) return;

    setDrawerState("", "");
    try {
      const result = await window.ClashlyComments.fetchCommentsByTake(currentTakeId, {
        sort: currentCommentsSort,
        currentUserId,
      });

      if (result.error) throw result.error;

      currentComments = result.comments || [];
      currentCommentsCount = result.count || 0;
      updateTotals();
      renderComments();
      setDrawerState("", "");
    } catch (error) {
      setDrawerState(window.ClashlyUtils.reportError("Comments drawer load failed.", error, "Could not load comments."), "error");
    }
  }

  async function ensureTakeLoaded(takeId) {
    if (currentTake && currentTake.id === takeId) return;
    const result = await window.ClashlyTakes.fetchTakeById(takeId, {
      currentUserId,
    });
    if (result.error) throw result.error;
    currentTake = result.take || null;
  }

  async function handleVote(input) {
    if (!currentUserId) {
      setDrawerState("Please log in to vote.", "error");
      window.setTimeout(() => {
        window.location.replace("auth.html");
      }, 250);
      return;
    }

    if (!currentTake || currentTake.vote_loading) return;
    currentTake = { ...currentTake, vote_loading: true };
    renderTake();

    try {
      const voteResult = await window.ClashlyTakes.submitVote({
        userId: currentUserId,
        takeId: input.takeId,
        voteType: input.voteType,
        currentVote: currentTake.vote ? currentTake.vote.user_vote : "",
      });

      if (voteResult.error) throw voteResult.error;

      currentTake = {
        ...currentTake,
        vote_loading: false,
        vote: voteResult.vote,
      };
      renderTake();
      setDrawerState("", "");
      window.dispatchEvent(
        new CustomEvent(UPDATE_EVENT, {
          detail: {
            takeId: currentTake.id,
            vote: voteResult.vote,
          },
        })
      );
    } catch (error) {
      currentTake = { ...currentTake, vote_loading: false };
      renderTake();
      throw error;
    }
  }

  async function handleBookmark(input) {
    if (!currentUserId) {
      setDrawerState("Please log in to save takes.", "error");
      window.setTimeout(() => {
        window.location.replace("auth.html");
      }, 250);
      return;
    }

    if (!currentTake) return;

    const result = await window.ClashlyTakes.toggleBookmark({
      userId: currentUserId,
      takeId: input.takeId,
      isBookmarked: input.isBookmarked,
    });

    if (result.error) {
      throw result.error;
    }

    if (result.bookmarked && currentTake && window.ClashlyNotifications) {
      window.ClashlyNotifications.createNotification({
        userId: currentTake.user_id,
        actorId: currentUserId,
        type: "bookmark",
        targetId: currentTake.id,
      }).catch(() => {});
    }

    currentTake = {
      ...currentTake,
      bookmarked: result.bookmarked,
    };
    renderTake();
    setDrawerState("", "");
    window.dispatchEvent(
      new CustomEvent(BOOKMARK_UPDATE_EVENT, {
        detail: {
          takeId: currentTake.id,
          bookmarked: result.bookmarked,
        },
      })
    );
  }

  function handleShareOpen(input) {
    if (window.ClashlyShareModal) {
      window.ClashlyShareModal.open({
        take: currentTake,
      });
      return;
    }

    window.ClashlyUtils.copyText(input.shareUrl)
      .then(() => setDrawerState("", ""))
      .catch((error) => setDrawerState(window.ClashlyUtils.reportError("Fallback share failed.", error, "Could not copy link."), "error"));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!currentTakeId) return;
    if (!currentUserId) {
      setDrawerState("Please log in to comment.", "error");
      window.setTimeout(() => {
        window.location.replace("auth.html");
      }, 250);
      return;
    }

    const input = getEl("comments-drawer-input");
    const submitBtn = getEl("comments-drawer-submit");
    if (!input || !submitBtn) return;

    submitBtn.disabled = true;
    submitBtn.textContent = activeReplyTarget ? "Replying..." : "Posting...";

    try {
      const createResult = await window.ClashlyComments.createComment({
        userId: currentUserId,
        takeId: currentTakeId,
        parentId: activeReplyTarget ? activeReplyTarget.commentId : "",
        content: input.value,
      });

      if (createResult.error) throw createResult.error;
      const replyTarget = activeReplyTarget ? findCommentById(currentComments, activeReplyTarget.commentId) : null;
      const notificationTargetUserId = replyTarget ? replyTarget.user_id : currentTake.user_id;
      const notificationType = replyTarget ? "reply" : "comment";
      if (activeReplyTarget && activeReplyTarget.commentId) {
        expandedReplyIds.add(activeReplyTarget.commentId);
      }

      input.value = "";
      updateCountLabel();
      autoSizeInput();
      setReplyTarget("", "");
      setDrawerState("", "");
      await loadComments();

      if (window.ClashlyNotifications && notificationTargetUserId) {
        window.ClashlyNotifications.createNotification({
          userId: notificationTargetUserId,
          actorId: currentUserId,
          type: notificationType,
          targetId: currentTake.id,
        }).catch(() => {});
      }
    } catch (error) {
      setDrawerState(window.ClashlyUtils.reportError("Comment post failed.", error, "Could not post comment."), "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Post";
    }
  }

  async function handleThreadClick(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const input = getEl("comments-drawer-input");

    const replyButton = target.closest("[data-action='reply']");
    if (replyButton && input) {
      const commentId = replyButton.getAttribute("data-comment-id") || "";
      const username = replyButton.getAttribute("data-comment-user") || "@user";
      setReplyTarget(commentId, username);
      expandedReplyIds.add(commentId);
      input.focus();
      return;
    }

    const toggleRepliesButton = target.closest("[data-action='toggle-replies']");
    if (toggleRepliesButton) {
      const commentId = toggleRepliesButton.getAttribute("data-comment-id") || "";
      if (!commentId) return;
      if (expandedReplyIds.has(commentId)) {
        expandedReplyIds.delete(commentId);
      } else {
        expandedReplyIds.add(commentId);
      }
      renderComments();
      return;
    }

    const deleteButton = target.closest("[data-action='delete-comment']");
    if (!deleteButton || !currentUserId) return;

    const commentId = deleteButton.getAttribute("data-comment-id") || "";
    if (!commentId) return;

    deleteButton.setAttribute("disabled", "true");
    try {
      const deleteResult = await window.ClashlyComments.deleteComment({
        commentId,
        userId: currentUserId,
      });

      if (deleteResult.error) throw deleteResult.error;
      if (activeReplyTarget && activeReplyTarget.commentId === commentId) {
        setReplyTarget("", "");
      }

      setDrawerState("", "");
      await loadComments();
    } catch (error) {
      deleteButton.removeAttribute("disabled");
      setDrawerState(window.ClashlyUtils.reportError("Comment delete failed.", error, "Could not delete comment."), "error");
    }
  }

  function openDrawerShell() {
    const drawer = getDrawer();
    if (!drawer) return;
    drawer.hidden = false;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => {
      drawer.classList.add("is-open");
    });
  }

  function close() {
    const drawer = getDrawer();
    if (!drawer) return;
    const panel = drawer.querySelector(".comments-drawer__panel");
    const backdrop = drawer.querySelector(".comments-drawer__backdrop");
    if (panel instanceof HTMLElement) {
      panel.classList.remove("is-dragging");
      panel.style.transform = "";
    }
    if (backdrop instanceof HTMLElement) {
      backdrop.style.opacity = "";
    }
    dragState.active = false;
    dragState.startY = 0;
    dragState.currentY = 0;
    resetComposer();
    drawer.classList.remove("is-open");
    document.body.style.overflow = "";
    window.setTimeout(() => {
      drawer.hidden = true;
    }, 260);
  }

  function setDragOffset(offset) {
    const drawer = getDrawer();
    if (!drawer) return;
    const panel = drawer.querySelector(".comments-drawer__panel");
    const backdrop = drawer.querySelector(".comments-drawer__backdrop");
    if (!(panel instanceof HTMLElement) || !(backdrop instanceof HTMLElement)) return;

    const safeOffset = Math.max(0, offset);
    panel.style.transform = `translateY(${safeOffset}px)`;
    backdrop.style.opacity = String(Math.max(0, 1 - safeOffset / 320));
  }

  function beginDrag(pointerY) {
    if (isDesktopLayout()) return;
    const drawer = getDrawer();
    if (!drawer || drawer.hidden) return;
    const panel = drawer.querySelector(".comments-drawer__panel");
    if (!(panel instanceof HTMLElement)) return;

    dragState.active = true;
    dragState.startY = pointerY;
    dragState.currentY = 0;
    dragState.lastY = pointerY;
    dragState.lastTime = Date.now();
    dragState.velocity = 0;
    panel.classList.add("is-dragging");
  }

  function updateDrag(pointerY) {
    if (isDesktopLayout()) return;
    if (!dragState.active) return;
    const now = Date.now();
    const deltaY = pointerY - dragState.lastY;
    const deltaTime = Math.max(1, now - dragState.lastTime);
    dragState.velocity = deltaY / deltaTime;
    dragState.lastY = pointerY;
    dragState.lastTime = now;
    dragState.currentY = Math.max(0, pointerY - dragState.startY);
    setDragOffset(dragState.currentY);
  }

  function endDrag() {
    if (isDesktopLayout()) return;
    const drawer = getDrawer();
    if (!drawer) return;
    const panel = drawer.querySelector(".comments-drawer__panel");
    const shouldClose = dragState.currentY > 140 || dragState.velocity > 0.7;

    dragState.active = false;
    dragState.startY = 0;
    dragState.lastY = 0;
    dragState.lastTime = 0;

    if (panel instanceof HTMLElement) {
      panel.classList.remove("is-dragging");
    }

    if (shouldClose) {
      close();
      return;
    }

    dragState.currentY = 0;
    dragState.velocity = 0;
    setDragOffset(0);
  }

  async function open(options) {
    ensureDrawer();

    currentTakeId = options && options.takeId ? options.takeId : "";
    currentTake = options && options.take ? options.take : null;
    currentUserId = options && options.currentUserId ? options.currentUserId : "";
    currentComments = [];
    currentCommentsCount = 0;
    currentCommentsSort = "newest";
    activeReplyTarget = null;
    expandedReplyIds = new Set();
    resetComposer();
    updateTotals();
    setDrawerState("", "");
    openDrawerShell();

    try {
      if (!currentUserId && window.ClashlySession) {
        const sessionState = await window.ClashlySession.resolveSession();
        currentUserId = sessionState.user ? sessionState.user.id : "";
      }

      await ensureTakeLoaded(currentTakeId);
      renderTake();
      await loadComments();
      const sortSelect = getEl("comments-drawer-sort");
      if (sortSelect) sortSelect.value = currentCommentsSort;
      updateCountLabel();
      autoSizeInput();
      syncComposerExpandedState();
    } catch (error) {
      setDrawerState(window.ClashlyUtils.reportError("Comments drawer open failed.", error, "Could not load comments."), "error");
    }
  }

  function bindEvents() {
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const closeTrigger = target.closest("[data-close-comments-drawer='true']");
      if (closeTrigger) {
        event.preventDefault();
        close();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && getDrawer() && !getDrawer().hidden) {
        close();
      }
    });

    document.addEventListener("pointerdown", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const handle = target.closest(".comments-drawer__handle, .comments-drawer__head");
      if (!handle) return;
      if (target.closest("button, input, textarea, select, a")) return;
      beginDrag(event.clientY);
    });

    document.addEventListener("pointermove", (event) => {
      if (!dragState.active) return;
      updateDrag(event.clientY);
    });

    document.addEventListener("pointerup", () => {
      if (!dragState.active) return;
      endDrag();
    });

    document.addEventListener("pointercancel", () => {
      if (!dragState.active) return;
      endDrag();
    });

    document.addEventListener("submit", (event) => {
      if (event.target && event.target.id === "comments-drawer-form") {
        handleSubmit(event);
      }
    });

    document.addEventListener("change", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement) || target.id !== "comments-drawer-sort") return;
      currentCommentsSort = target.value === "oldest" ? "oldest" : "newest";
      await loadComments();
    });

    document.addEventListener("click", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const thread = target.closest("#comments-drawer-thread");
      if (!thread) return;
      await handleThreadClick(event);
    });

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const cancelBtn = target.closest("#comments-drawer-cancel-reply");
      if (!cancelBtn) return;
      event.preventDefault();
      setReplyTarget("", "");
      const input = getEl("comments-drawer-input");
      if (input) input.focus();
    });

    document.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLTextAreaElement) || target.id !== "comments-drawer-input") return;
      updateCountLabel();
      autoSizeInput();
      syncComposerExpandedState();
    });

    document.addEventListener("focusin", (event) => {
      if (event.target instanceof HTMLElement && event.target.id === "comments-drawer-input") {
        syncComposerExpandedState();
      }
    });

    document.addEventListener("focusout", (event) => {
      if (event.target instanceof HTMLElement && event.target.id === "comments-drawer-input") {
        window.setTimeout(syncComposerExpandedState, 0);
      }
    });

    window.addEventListener("resize", () => {
      const drawer = getDrawer();
      if (!drawer || drawer.hidden || !currentTake) return;
      renderTake();
    });
  }

  function boot() {
    ensureDrawer();
    bindEvents();
  }

  window.ClashlyCommentsModal = {
    open,
    close,
  };

  document.addEventListener("DOMContentLoaded", boot);
})();
