(function () {
  const PAGE_SIZE = 15;
  const SCROLL_THRESHOLD_PX = 900;
  let currentUserId = "";
  let currentTag = "";
  let currentFeedTakes = [];
  let nextCursor = null;
  let hasMore = true;
  let isLoading = false;
  let scrollQueued = false;

  function setFeedState(message, type) {
    const stateEl = document.getElementById("hashtag-feed-state");
    if (!stateEl) return;

    stateEl.hidden = !message;
    stateEl.textContent = message || "";
    stateEl.classList.remove("is-error", "is-success");
    if (type === "error") stateEl.classList.add("is-error");
    if (type === "success") stateEl.classList.add("is-success");
  }

  function getQueryTag() {
    const params = new URLSearchParams(window.location.search);
    const rawTag = params.get("tag") || "";
    if (!window.ClashlyUtils || typeof window.ClashlyUtils.normalizeHashtag !== "function") {
      return String(rawTag || "").replace(/^#/, "").trim().toLowerCase();
    }

    return window.ClashlyUtils.normalizeHashtag(rawTag);
  }

  function renderHeader() {
    const titleEl = document.getElementById("hashtag-title");
    const subtitleEl = document.getElementById("hashtag-subtitle");
    const safeTag = currentTag || "hashtag";

    document.title = `Clashe | #${safeTag}`;
    if (titleEl) titleEl.textContent = `#${safeTag}`;
    if (subtitleEl) subtitleEl.textContent = `Takes tagged with #${safeTag}`;
  }

  function updateTakeVoteState(takeId, patch) {
    currentFeedTakes = currentFeedTakes.map((take) => (take.id === takeId ? { ...take, ...patch } : take));
  }

  function updateTakeBookmarkState(takeId, bookmarked) {
    currentFeedTakes = currentFeedTakes.map((take) => (take.id === takeId ? { ...take, bookmarked } : take));
  }

  function renderFeed() {
    const feedEl = document.getElementById("hashtag-feed-stream");
    if (!feedEl) return;

    window.ClashlyTakeRenderer.renderTakeList(feedEl, currentFeedTakes, {
      currentUserId,
      emptyMessage: currentTag ? `No takes found for #${currentTag} yet.` : "No hashtag selected.",
    });

    window.ClashlyTakeRenderer.bindShareActions(feedEl, {
      onStatus: setFeedState,
      onShare: handleShareOpen,
    });
    window.ClashlyTakeRenderer.bindVoteActions(feedEl, {
      onStatus: setFeedState,
      onVote: handleVote,
    });
    window.ClashlyTakeRenderer.bindBookmarkActions(feedEl, {
      onStatus: setFeedState,
      onBookmark: handleBookmark,
    });
    window.ClashlyTakeRenderer.bindCommentActions(feedEl, {
      onComments: handleCommentsOpen,
    });
  }

  function handleCommentsOpen(input) {
    if (!window.ClashlyCommentsModal) {
      window.location.href = `take.html?id=${encodeURIComponent(input.takeId)}`;
      return;
    }

    const targetTake = currentFeedTakes.find((take) => take.id === input.takeId) || null;
    window.ClashlyCommentsModal.open({
      takeId: input.takeId,
      take: targetTake,
      currentUserId,
    });
  }

  function handleShareOpen(input) {
    const targetTake = currentFeedTakes.find((take) => take.id === input.takeId) || null;
    if (window.ClashlyShareModal) {
      window.ClashlyShareModal.open({
        take: targetTake,
      });
      return;
    }

    window.ClashlyUtils.copyText(input.shareUrl)
      .then(() => setFeedState("", ""))
      .catch((error) => setFeedState(window.ClashlyUtils.reportError("Fallback share failed.", error, "Could not copy link."), "error"));
  }

  async function handleVote(input) {
    if (!currentUserId) {
      setFeedState("Please log in to vote.", "error");
      window.setTimeout(() => {
        window.location.replace("auth.html");
      }, 250);
      return;
    }

    const target = currentFeedTakes.find((take) => take.id === input.takeId);
    if (!target || target.vote_loading) return;

    updateTakeVoteState(input.takeId, { vote_loading: true });
    renderFeed();

    try {
      const voteResult = await window.ClashlyTakes.submitVote({
        userId: currentUserId,
        takeId: input.takeId,
        voteType: input.voteType,
        currentVote: target.vote ? target.vote.user_vote : "",
      });

      if (voteResult.error) {
        throw voteResult.error;
      }

      updateTakeVoteState(input.takeId, {
        vote_loading: false,
        vote: voteResult.vote,
      });
      renderFeed();
      setFeedState("", "");
    } catch (error) {
      updateTakeVoteState(input.takeId, { vote_loading: false });
      renderFeed();
      throw error;
    }
  }

  async function handleBookmark(input) {
    if (!currentUserId) {
      setFeedState("Please log in to save takes.", "error");
      window.setTimeout(() => {
        window.location.replace("auth.html");
      }, 250);
      return;
    }

    const target = currentFeedTakes.find((take) => take.id === input.takeId) || null;
    const result = await window.ClashlyTakes.toggleBookmark({
      userId: currentUserId,
      takeId: input.takeId,
      isBookmarked: input.isBookmarked,
    });

    if (result.error) {
      throw result.error;
    }

    if (result.bookmarked && target && window.ClashlyNotifications) {
      window.ClashlyNotifications.createNotification({
        userId: target.user_id,
        actorId: currentUserId,
        type: "bookmark",
        targetId: target.id,
      }).catch(() => {});
    }

    updateTakeBookmarkState(input.takeId, result.bookmarked);
    renderFeed();
    setFeedState("", "");
  }

  async function loadFeed(options) {
    const append = Boolean(options && options.append);
    const feedEl = document.getElementById("hashtag-feed-stream");
    if (!feedEl || !currentTag) return;
    if (isLoading) return;
    if (append && !hasMore) return;

    isLoading = true;
    if (!append) {
      setFeedState("", "");
      currentFeedTakes = [];
      nextCursor = null;
      hasMore = true;
      // Show skeleton immediately for initial load — no blank screen
      if (typeof window.clasheShowFeedSkeleton === "function") {
        window.clasheShowFeedSkeleton("hashtag-feed-stream", 5);
      } else {
        feedEl.innerHTML = "";
      }
    }

    try {
      const result = await window.ClashlyTakes.fetchTakesByHashtag(currentTag, {
        limit: PAGE_SIZE,
        currentUserId,
        cursor: append ? nextCursor : null,
      });

      if (result.error) {
        throw result.error;
      }

      const incoming = result.takes || [];
      currentFeedTakes = append ? currentFeedTakes.concat(incoming) : incoming;
      nextCursor = result.nextCursor || null;
      hasMore = Boolean(result.hasMore);
      renderFeed();
      setFeedState(currentFeedTakes.length ? "" : `No takes found for #${currentTag} yet.`, "");
    } catch (error) {
      setFeedState(window.ClashlyUtils.reportError("Hashtag feed load failed.", error, "Could not load this hashtag."), "error");
    } finally {
      isLoading = false;
    }
  }

  function handleTakeUpdated(event) {
    const detail = event.detail || {};
    if (!detail.takeId || !detail.vote) return;
    updateTakeVoteState(detail.takeId, {
      vote: detail.vote,
      vote_loading: false,
    });
    renderFeed();
  }

  function handleTakeBookmarkUpdated(event) {
    const detail = event.detail || {};
    if (!detail.takeId || typeof detail.bookmarked !== "boolean") return;
    updateTakeBookmarkState(detail.takeId, detail.bookmarked);
    renderFeed();
  }

  function shouldLoadMore() {
    if (isLoading || !hasMore) return false;
    const viewportBottom = window.scrollY + window.innerHeight;
    const pageBottom = document.documentElement.scrollHeight;
    return viewportBottom >= pageBottom - SCROLL_THRESHOLD_PX;
  }

  function bindInfiniteScroll() {
    window.addEventListener(
      "scroll",
      () => {
        if (scrollQueued) return;
        scrollQueued = true;
        window.requestAnimationFrame(async () => {
          scrollQueued = false;
          if (!shouldLoadMore()) return;
          await loadFeed({ append: true });
        });
      },
      { passive: true }
    );
  }

  async function initHashtagPage() {
    try {
      if (!window.ClashlyTakes || !window.ClashlyTakeRenderer || !window.ClashlySession) return;

      currentTag = getQueryTag();
      renderHeader();

      const sessionState = await window.ClashlySession.resolveSession();
      currentUserId = sessionState.user ? sessionState.user.id : "";

      if (currentUserId && currentTag && window.ClashePersonalization) {
        window.ClashePersonalization.recordHashtagVisit(currentUserId, currentTag).catch(() => {});
      }

      window.addEventListener("clashly:take-updated", handleTakeUpdated);
      window.addEventListener("clashly:take-bookmark-updated", handleTakeBookmarkUpdated);
      bindInfiniteScroll();
      await loadFeed({ append: false });
    } finally {
      if (window.ClasheLoader) {
        window.ClasheLoader.release("page-data");
      }
    }
  }

  document.addEventListener("DOMContentLoaded", initHashtagPage);
})();
