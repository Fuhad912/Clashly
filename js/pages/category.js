(function () {
  let currentUserId = "";
  let currentCategory = null;
  let currentFeedTakes = [];

  function setFeedState(message, type) {
    const stateEl = document.getElementById("category-feed-state");
    if (!stateEl) return;

    stateEl.hidden = !message;
    stateEl.textContent = message || "";
    stateEl.classList.remove("is-error", "is-success");
    if (type === "error") stateEl.classList.add("is-error");
    if (type === "success") stateEl.classList.add("is-success");
  }

  function getQueryCategory() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("category") || "";
    if (!window.ClashlyCategories) {
      return String(raw || "").trim().toLowerCase();
    }

    return window.ClashlyCategories.normalizeCategorySlug(raw);
  }

  function renderCategoryHeader() {
    const titleEl = document.getElementById("category-title");
    const subtitleEl = document.getElementById("category-subtitle");
    const keywordsEl = document.getElementById("category-keywords");

    if (!currentCategory) {
      document.title = "Clashe | Category";
      if (titleEl) titleEl.textContent = "Category";
      if (subtitleEl) subtitleEl.textContent = "This lane could not be found.";
      if (keywordsEl) {
        keywordsEl.hidden = true;
        keywordsEl.innerHTML = "";
      }
      return;
    }

    document.title = `Clashe | ${currentCategory.name}`;
    if (titleEl) titleEl.textContent = currentCategory.name;
    if (subtitleEl) subtitleEl.textContent = currentCategory.description || "Live takes from this category.";

    if (keywordsEl) {
      const keywords = Array.isArray(currentCategory.keywords) ? currentCategory.keywords : [];
      keywords.innerHTML = keywords
        .slice(0, 6)
        .map(
          (keyword) =>
            `<a class="explore-chip" href="search.html?q=${encodeURIComponent(keyword)}">${window.ClashlyUtils.escapeHtml(
              `#${keyword}`
            )}</a>`
        )
        .join("");
      keywords.hidden = keywords.length === 0;
    }
  }

  function updateTakeVoteState(takeId, patch) {
    currentFeedTakes = currentFeedTakes.map((take) => (take.id === takeId ? { ...take, ...patch } : take));
  }

  function updateTakeBookmarkState(takeId, bookmarked) {
    currentFeedTakes = currentFeedTakes.map((take) => (take.id === takeId ? { ...take, bookmarked } : take));
  }

  function renderFeed() {
    const feedEl = document.getElementById("category-feed-stream");
    if (!feedEl || !window.ClashlyTakeRenderer) return;

    window.ClashlyTakeRenderer.renderTakeList(feedEl, currentFeedTakes, {
      currentUserId,
      emptyMessage: currentCategory
        ? `No takes have landed in ${currentCategory.name} yet.`
        : "No category selected.",
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
      window.ClashlyShareModal.open({ take: targetTake });
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

  async function loadFeed() {
    const safeCategorySlug = getQueryCategory();
    const feedEl = document.getElementById("category-feed-stream");
    if (!feedEl) return;

    if (!safeCategorySlug) {
      currentCategory = null;
      renderCategoryHeader();
      feedEl.innerHTML = "";
      setFeedState("Missing category.", "error");
      return;
    }

    setFeedState("", "");

    // Show skeleton immediately while category data loads
    if (typeof window.clasheShowFeedSkeleton === "function") {
      window.clasheShowFeedSkeleton("category-feed-stream", 5);
    } else {
      feedEl.innerHTML = "";
    }

    try {
      const result = await window.ClashlyTakes.fetchTakesByCategory(safeCategorySlug, {
        limit: 40,
        currentUserId,
      });

      if (result.error) {
        throw result.error;
      }

      currentCategory = result.category || null;
      renderCategoryHeader();

      if (!currentCategory) {
        currentFeedTakes = [];
        renderFeed();
        setFeedState("This category could not be found.", "error");
        return;
      }

      if (currentUserId && currentCategory.slug && window.ClashePersonalization) {
        window.ClashePersonalization.recordCategoryVisit(currentUserId, currentCategory.slug).catch(() => {});
      }

      currentFeedTakes = result.takes || [];
      renderFeed();
      setFeedState(currentFeedTakes.length ? "" : `No takes have landed in ${currentCategory.name} yet.`, "");
    } catch (error) {
      setFeedState(window.ClashlyUtils.reportError("Category feed load failed.", error, "Could not load this category."), "error");
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

  async function initCategoryPage() {
    try {
      if (!window.ClashlyTakes || !window.ClashlyTakeRenderer || !window.ClashlySession || !window.ClashlyCategories) return;

      const sessionState = await window.ClashlySession.resolveSession();
      currentUserId = sessionState.user ? sessionState.user.id : "";

      window.addEventListener("clashly:take-updated", handleTakeUpdated);
      window.addEventListener("clashly:take-bookmark-updated", handleTakeBookmarkUpdated);
      await loadFeed();
    } finally {
      if (window.ClasheLoader) {
        window.ClasheLoader.release("page-data");
      }
    }
  }

  document.addEventListener("DOMContentLoaded", initCategoryPage);
})();
