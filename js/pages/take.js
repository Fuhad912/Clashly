(function () {
  let currentUserId = "";
  let currentTake = null;
  let currentComments = [];
  let currentCommentsCount = 0;
  let currentCommentsSort = "newest";
  let activeReplyTarget = null;
  let expandedReplyIds = new Set();

  function setTakeState(message, type) {
    const stateEl = document.getElementById("take-state");
    if (!stateEl) return;

    stateEl.hidden = !message;
    stateEl.textContent = message || "";
    stateEl.classList.remove("is-error", "is-success");
    if (type === "error") stateEl.classList.add("is-error");
    if (type === "success") stateEl.classList.add("is-success");
  }

  function setCommentsState(message, type) {
    const stateEl = document.getElementById("comments-state");
    if (!stateEl) return;

    stateEl.hidden = !message;
    stateEl.textContent = message || "";
    stateEl.classList.remove("is-error", "is-success");
    if (type === "error") stateEl.classList.add("is-error");
    if (type === "success") stateEl.classList.add("is-success");
  }

  function updateCommentCount() {
    const input = document.getElementById("comment-input");
    const countEl = document.getElementById("comment-count");
    if (!input || !countEl) return;
    countEl.textContent = String(input.value.length);
  }

  function autoSizeCommentInput() {
    const input = document.getElementById("comment-input");
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
  }

  function syncComposerExpandedState() {
    const form = document.getElementById("comment-form");
    const input = document.getElementById("comment-input");
    if (!form || !input) return;

    const shouldExpand = document.activeElement === input || Boolean(input.value.trim()) || Boolean(activeReplyTarget);
    form.classList.toggle("comment-compose--expanded", shouldExpand);
  }

  function updateCommentsSummary() {
    const totalEl = document.getElementById("comments-total");
    if (!totalEl) return;
    totalEl.textContent = String(currentCommentsCount);
  }

  function setReplyTarget(commentId, username) {
    activeReplyTarget = commentId ? { commentId, username } : null;
    const wrapper = document.getElementById("comment-replying");
    const textEl = document.getElementById("comment-replying-text");
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

  function renderComments() {
    const threadEl = document.getElementById("comments-thread");
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
    if (!currentTake || !window.ClashlyComments) return;

    setCommentsState("", "");
    try {
      const result = await window.ClashlyComments.fetchCommentsByTake(currentTake.id, {
        sort: currentCommentsSort,
        currentUserId,
      });

      if (result.error) {
        throw result.error;
      }

      currentComments = result.comments || [];
      currentCommentsCount = result.count || 0;
      updateCommentsSummary();
      renderComments();
      setCommentsState("", "");
    } catch (error) {
      setCommentsState(window.ClashlyUtils.reportError("Take comments load failed.", error, "Could not load comments."), "error");
    }
  }

  function renderTake() {
    const streamEl = document.getElementById("take-detail-stream");
    if (!streamEl) return;

    window.ClashlyTakeRenderer.renderTakeList(streamEl, currentTake ? [currentTake] : [], {
      currentUserId,
      emptyMessage: "Take not found.",
    });

    window.ClashlyTakeRenderer.bindShareActions(streamEl, {
      onStatus: setTakeState,
      onShare: handleShareOpen,
    });
    window.ClashlyTakeRenderer.bindVoteActions(streamEl, {
      onStatus: setTakeState,
      onVote: handleVote,
    });
    window.ClashlyTakeRenderer.bindBookmarkActions(streamEl, {
      onStatus: setTakeState,
      onBookmark: handleBookmark,
    });
  }

  function bindCommentComposer() {
    const form = document.getElementById("comment-form");
    const input = document.getElementById("comment-input");
    const submitBtn = document.getElementById("comment-submit");
    const cancelReplyBtn = document.getElementById("comment-cancel-reply");
    const sortSelect = document.getElementById("comments-sort");
    const threadEl = document.getElementById("comments-thread");
    if (!form || !input || !submitBtn || !cancelReplyBtn || !sortSelect || !threadEl || !window.ClashlyComments) {
      return;
    }

    input.addEventListener("input", updateCommentCount);
    input.addEventListener("input", autoSizeCommentInput);
    input.addEventListener("input", syncComposerExpandedState);
    input.addEventListener("focus", syncComposerExpandedState);
    input.addEventListener("blur", syncComposerExpandedState);
    updateCommentCount();
    autoSizeCommentInput();
    syncComposerExpandedState();

    cancelReplyBtn.addEventListener("click", () => {
      setReplyTarget("", "");
      input.focus();
    });

    sortSelect.addEventListener("change", async () => {
      currentCommentsSort = sortSelect.value === "oldest" ? "oldest" : "newest";
      await loadComments();
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!currentTake) return;
      if (!currentUserId) {
        setCommentsState("Please log in to comment.", "error");
        window.setTimeout(() => {
          window.location.replace("auth.html");
        }, 250);
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = activeReplyTarget ? "Replying..." : "Posting...";

      try {
        const createResult = await window.ClashlyComments.createComment({
          userId: currentUserId,
          takeId: currentTake.id,
          parentId: activeReplyTarget ? activeReplyTarget.commentId : "",
          content: input.value,
        });

        if (createResult.error) {
          throw createResult.error;
        }

        const replyTarget = activeReplyTarget ? findCommentById(currentComments, activeReplyTarget.commentId) : null;
        const notificationTargetUserId = replyTarget ? replyTarget.user_id : currentTake.user_id;
        const notificationType = replyTarget ? "reply" : "comment";

        if (activeReplyTarget && activeReplyTarget.commentId) {
          expandedReplyIds.add(activeReplyTarget.commentId);
        }

        input.value = "";
        updateCommentCount();
        autoSizeCommentInput();
        setReplyTarget("", "");
        setCommentsState("", "");
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
        setCommentsState(window.ClashlyUtils.reportError("Take comment post failed.", error, "Could not post comment."), "error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Post";
      }
    });

    threadEl.addEventListener("click", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const replyButton = target.closest("[data-action='reply']");
      if (replyButton) {
        const commentId = replyButton.getAttribute("data-comment-id") || "";
        const username = replyButton.getAttribute("data-comment-user") || "@user";
        setReplyTarget(commentId, username);
        expandedReplyIds.add(commentId);
        form.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
      if (!deleteButton) return;

      const commentId = deleteButton.getAttribute("data-comment-id") || "";
      if (!commentId) return;
      if (!currentUserId) {
        setCommentsState("Please log in to manage comments.", "error");
        return;
      }

      deleteButton.setAttribute("disabled", "true");
      try {
        const deleteResult = await window.ClashlyComments.deleteComment({
          commentId,
          userId: currentUserId,
        });

        if (deleteResult.error) {
          throw deleteResult.error;
        }

        if (activeReplyTarget && activeReplyTarget.commentId === commentId) {
          setReplyTarget("", "");
        }

        setCommentsState("", "");
        await loadComments();
      } catch (error) {
        deleteButton.removeAttribute("disabled");
        setCommentsState(window.ClashlyUtils.reportError("Take comment delete failed.", error, "Could not delete comment."), "error");
      }
    });
  }

  async function handleVote(input) {
    if (!currentUserId) {
      setTakeState("Please log in to vote.", "error");
      window.setTimeout(() => {
        window.location.replace("auth.html");
      }, 250);
      return;
    }

    if (!currentTake || currentTake.vote_loading) return;

    currentTake = {
      ...currentTake,
      vote_loading: true,
    };
    renderTake();

    try {
      const voteResult = await window.ClashlyTakes.submitVote({
        userId: currentUserId,
        takeId: input.takeId,
        voteType: input.voteType,
        currentVote: currentTake.vote ? currentTake.vote.user_vote : "",
      });

      if (voteResult.error) {
        throw voteResult.error;
      }

      currentTake = {
        ...currentTake,
        vote_loading: false,
        vote: voteResult.vote,
      };
      renderTake();
      setTakeState("", "");
    } catch (error) {
      currentTake = {
        ...currentTake,
        vote_loading: false,
      };
      renderTake();
      throw error;
    }
  }

  async function handleBookmark(input) {
    if (!currentUserId) {
      setTakeState("Please log in to save takes.", "error");
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
    setTakeState("", "");
  }

  function handleShareOpen(input) {
    if (window.ClashlyShareModal) {
      window.ClashlyShareModal.open({
        take: currentTake,
      });
      return;
    }

    window.ClashlyUtils.copyText(input.shareUrl)
      .then(() => setTakeState("", ""))
      .catch((error) => setTakeState(window.ClashlyUtils.reportError("Fallback share failed.", error, "Could not copy link."), "error"));
  }

  async function initTakePage() {
    try {
      if (
        !window.ClashlyTakes ||
        !window.ClashlyTakeRenderer ||
        !window.ClashlySession ||
        !window.ClashlyComments ||
        !window.ClashlyCommentsRenderer
      ) {
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const takeId = params.get("id");
      if (!takeId) {
        setTakeState("Missing take id.", "error");
        return;
      }

      const sessionState = await window.ClashlySession.resolveSession();
      currentUserId = sessionState.user ? sessionState.user.id : "";
      bindCommentComposer();
      updateCommentsSummary();

      setTakeState("", "");
      const takeResult = await window.ClashlyTakes.fetchTakeById(takeId, {
        currentUserId,
      });

      if (takeResult.error) {
        throw takeResult.error;
      }

      if (!takeResult.take) {
        setTakeState("Take not found.", "error");
        return;
      }

      currentTake = takeResult.take;
      renderTake();
      await loadComments();
      setTakeState("", "");
    } catch (error) {
      setTakeState(window.ClashlyUtils.reportError("Take page load failed.", error, "Could not load take."), "error");
      setCommentsState("Comments unavailable until take loads.", "error");
    } finally {
      if (window.ClasheLoader) {
        window.ClasheLoader.release("page-data");
      }
    }
  }

  document.addEventListener("DOMContentLoaded", initTakePage);
})();
