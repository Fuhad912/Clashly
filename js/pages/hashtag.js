(function () {
  let currentUserId = "";
  let currentTag = "";
  let currentFeedTakes = [];

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

    document.title = `Clashly | #${safeTag}`;
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
      .then(() => setFeedState("Link copied to clipboard.", "success"))
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

    const result = await window.ClashlyTakes.toggleBookmark({
      userId: currentUserId,
      takeId: input.takeId,
      isBookmarked: input.isBookmarked,
    });

    if (result.error) {
      throw result.error;
    }

    updateTakeBookmarkState(input.takeId, result.bookmarked);
    renderFeed();
    setFeedState("", "");
  }

  async function loadFeed() {
    const feedEl = document.getElementById("hashtag-feed-stream");
    if (!feedEl) return;

    if (!currentTag) {
      setFeedState("Missing hashtag.", "error");
      feedEl.innerHTML = "";
      return;
    }

    setFeedState("Loading takes...", "");
    feedEl.innerHTML = "";

    try {
      const result = await window.ClashlyTakes.fetchTakesByHashtag(currentTag, {
        limit: 40,
        currentUserId,
      });

      if (result.error) {
        throw result.error;
      }

      currentFeedTakes = result.takes || [];
      renderFeed();
      setFeedState(currentFeedTakes.length ? "" : `No takes found for #${currentTag} yet.`, "");
    } catch (error) {
      setFeedState(window.ClashlyUtils.reportError("Hashtag feed load failed.", error, "Could not load this hashtag."), "error");
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

  async function initHashtagPage() {
    if (!window.ClashlyTakes || !window.ClashlyTakeRenderer || !window.ClashlySession) return;

    currentTag = getQueryTag();
    renderHeader();

    const sessionState = await window.ClashlySession.resolveSession();
    currentUserId = sessionState.user ? sessionState.user.id : "";

    window.addEventListener("clashly:take-updated", handleTakeUpdated);
    window.addEventListener("clashly:take-bookmark-updated", handleTakeBookmarkUpdated);
    await loadFeed();
  }

  document.addEventListener("DOMContentLoaded", initHashtagPage);
})();
