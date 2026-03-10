(function () {
  let activeTab = "new";
  let currentUserId = "";
  let currentFeedTakes = [];

  function getFollowingEmptyMessage(meta) {
    if (!meta || !meta.emptyReason) {
      return "No takes from followed profiles yet.";
    }

    if (meta.emptyReason === "no-following") {
      return "You're not following anyone yet. Follow profiles to build this feed.";
    }

    if (meta.emptyReason === "no-followed-takes") {
      return "The people you follow haven't posted any takes yet.";
    }

    return "No takes from followed profiles yet.";
  }

  function setFeedState(message, type) {
    const stateEl = document.getElementById("feed-state");
    if (!stateEl) return;

    stateEl.hidden = !message;
    stateEl.textContent = message || "";
    stateEl.classList.remove("is-error", "is-success");
    if (type === "error") stateEl.classList.add("is-error");
    if (type === "success") stateEl.classList.add("is-success");
  }

  function setActiveTab(nextTab) {
    activeTab = nextTab;
  }

  function getHashTab() {
    const hash = window.location.hash.replace("#", "").toLowerCase();
    if (hash === "new" || hash === "trending" || hash === "controversial" || hash === "following") {
      return hash;
    }
    return "new";
  }

  async function loadFeed() {
    const feedEl = document.getElementById("feed-stream");
    if (!feedEl) return;

    setFeedState("Loading takes...", "");
    feedEl.innerHTML = "";

    try {
      const feedResult =
        activeTab === "following"
          ? await window.ClashlyTakes.fetchFollowingFeedTakes({
              limit: 35,
              currentUserId,
            })
          : await window.ClashlyTakes.fetchFeedTakes({
              tab: activeTab,
              limit: 35,
              currentUserId,
            });

      if (feedResult.error) {
        throw feedResult.error;
      }

      currentFeedTakes = feedResult.takes || [];
      renderFeed();

      if (!currentFeedTakes.length) {
        setFeedState(activeTab === "following" ? getFollowingEmptyMessage(feedResult.meta) : "No takes in this feed yet.", "");
        return;
      }

      setFeedState("", "");
    } catch (error) {
      setFeedState(window.ClashlyUtils.reportError("Home feed load failed.", error, "Could not load feed."), "error");
    }
  }

  function updateTakeVoteState(takeId, patch) {
    currentFeedTakes = currentFeedTakes.map((take) => {
      if (take.id !== takeId) return take;
      return {
        ...take,
        ...patch,
      };
    });
  }

  function updateTakeBookmarkState(takeId, bookmarked) {
    currentFeedTakes = currentFeedTakes.map((take) =>
      take.id === takeId
        ? {
            ...take,
            bookmarked,
          }
        : take
    );
  }

  function renderFeed() {
    const feedEl = document.getElementById("feed-stream");
    if (!feedEl) return;

    window.ClashlyTakeRenderer.renderTakeList(feedEl, currentFeedTakes, {
        currentUserId,
        emptyMessage: activeTab === "following" ? "No takes from followed profiles yet." : "No takes yet. Be the first to post one.",
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

      if (activeTab === "trending" || activeTab === "controversial" || activeTab === "following") {
        await loadFeed();
      }
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

    try {
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
    } catch (error) {
      throw error;
    }
  }

  async function handleHashChange() {
    const nextTab = getHashTab();
    if (nextTab === activeTab) return;
    setActiveTab(nextTab);
    await loadFeed();
  }

  async function handleTakeCreated() {
    setActiveTab("new");
    await loadFeed();
  }

  async function initFeedPage() {
    if (!window.ClashlyTakes || !window.ClashlyTakeRenderer || !window.ClashlySession) return;

    activeTab = getHashTab();

    const sessionState = await window.ClashlySession.resolveSession();
    currentUserId = sessionState.user ? sessionState.user.id : "";

    setActiveTab(activeTab);
    if (window.ClashlyApp && window.ClashlyApp.createEventName) {
      window.addEventListener(window.ClashlyApp.createEventName, handleTakeCreated);
    }
    window.addEventListener("clashly:take-updated", handleTakeUpdated);
    window.addEventListener("clashly:take-bookmark-updated", handleTakeBookmarkUpdated);
    window.addEventListener("hashchange", handleHashChange);
    await loadFeed();
  }

  document.addEventListener("DOMContentLoaded", initFeedPage);
})();
