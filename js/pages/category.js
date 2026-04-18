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

  function formatCompactNumber(value) {
    const number = Math.max(0, Number(value || 0));
    return new Intl.NumberFormat(undefined, {
      notation: number >= 1000 ? "compact" : "standard",
      maximumFractionDigits: number >= 1000 ? 1 : 0,
    }).format(number);
  }

  function pluralize(value, singular, plural) {
    return Number(value) === 1 ? singular : plural || `${singular}s`;
  }

  function getCategoryStats() {
    const authorIds = new Set();
    return currentFeedTakes.reduce(
      (stats, take) => {
        const vote = take && take.vote ? take.vote : {};
        const totalVotes = Number(vote.total_votes || 0);
        const commentCount = Number(take && take.comment_count || 0);

        if (take && take.user_id) {
          authorIds.add(take.user_id);
        }

        return {
          takes: stats.takes + 1,
          votes: stats.votes + totalVotes,
          comments: stats.comments + commentCount,
          authors: authorIds.size,
          hotTakes: stats.hotTakes + (totalVotes + commentCount >= 5 ? 1 : 0),
        };
      },
      { takes: 0, votes: 0, comments: 0, authors: 0, hotTakes: 0 }
    );
  }

  function renderCategoryPulse() {
    const pulseEl = document.getElementById("category-pulse");
    const titleEl = document.getElementById("category-pulse-title");
    const lineEl = document.getElementById("category-pulse-line");
    const statsEl = document.getElementById("category-pulse-stats");
    if (!pulseEl || !titleEl || !lineEl || !statsEl) return;

    if (!currentCategory) {
      pulseEl.hidden = true;
      statsEl.innerHTML = "";
      return;
    }

    const stats = getCategoryStats();
    const takeLabel = pluralize(stats.takes, "take");
    const authorLabel = pluralize(stats.authors, "voice");
    titleEl.textContent = stats.takes
      ? `${formatCompactNumber(stats.takes)} ${takeLabel} in this lane`
      : "Open category lane";
    lineEl.textContent = stats.takes
      ? `${formatCompactNumber(stats.authors)} ${authorLabel} are moving ${currentCategory.name} with ${formatCompactNumber(
          stats.votes
        )} ${pluralize(stats.votes, "vote")} and ${formatCompactNumber(stats.comments)} ${pluralize(stats.comments, "comment")}.`
      : `Be the first to post a take in ${currentCategory.name}.`;

    const statItems = [
      { value: stats.takes, label: pluralize(stats.takes, "take") },
      { value: stats.votes, label: pluralize(stats.votes, "vote") },
      { value: stats.comments, label: pluralize(stats.comments, "comment") },
      { value: stats.hotTakes, label: "heated" },
    ];

    statsEl.innerHTML = statItems
      .map(
        (item) => `
          <span class="category-pulse__stat">
            <strong>${window.ClashlyUtils.escapeHtml(formatCompactNumber(item.value))}</strong>
            <span>${window.ClashlyUtils.escapeHtml(item.label)}</span>
          </span>
        `
      )
      .join("");
    pulseEl.hidden = false;
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
      renderCategoryPulse();
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

    renderCategoryPulse();
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
        ? `No takes posted yet in ${currentCategory.name}.`
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

  function syncCategoryTakeState(takeId) {
    const feedEl = document.getElementById("category-feed-stream");
    if (!feedEl || !window.ClashlyTakeRenderer || typeof window.ClashlyTakeRenderer.syncTakeState !== "function") return;
    const targetTake = currentFeedTakes.find((take) => take.id === takeId) || null;
    if (!targetTake) return;
    window.ClashlyTakeRenderer.syncTakeState(feedEl, targetTake);
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
    const previousVote = target.vote ? { ...target.vote } : null;
    const optimisticVote = window.ClashlyTakes && typeof window.ClashlyTakes.previewVoteSummary === "function"
      ? window.ClashlyTakes.previewVoteSummary(previousVote, input.voteType)
      : previousVote;

    updateTakeVoteState(input.takeId, { vote_loading: true, vote: optimisticVote || target.vote });
    syncCategoryTakeState(input.takeId);

    try {
      const voteResult = await window.ClashlyTakes.submitVote({
        userId: currentUserId,
        takeId: input.takeId,
        voteType: input.voteType,
        currentVote: previousVote ? previousVote.user_vote : "",
      });

      if (voteResult.error) {
        throw voteResult.error;
      }

      const reconciledVote =
        window.ClashlyTakes && typeof window.ClashlyTakes.resolveSubmittedVoteSummary === "function"
          ? window.ClashlyTakes.resolveSubmittedVoteSummary(optimisticVote, voteResult.vote)
          : optimisticVote || voteResult.vote;
      updateTakeVoteState(input.takeId, {
        vote_loading: false,
        vote: reconciledVote,
      });
      syncCategoryTakeState(input.takeId);
      renderCategoryPulse();
      setFeedState("", "");
    } catch (error) {
      updateTakeVoteState(input.takeId, {
        vote_loading: false,
        vote: previousVote || target.vote,
      });
      syncCategoryTakeState(input.takeId);
      renderCategoryPulse();
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
    const previousBookmarked = Boolean(target && target.bookmarked);
    updateTakeBookmarkState(input.takeId, !previousBookmarked);
    syncCategoryTakeState(input.takeId);
    const result = await window.ClashlyTakes.toggleBookmark({
      userId: currentUserId,
      takeId: input.takeId,
      isBookmarked: input.isBookmarked,
    });

    if (result.error) {
      updateTakeBookmarkState(input.takeId, previousBookmarked);
      syncCategoryTakeState(input.takeId);
      throw result.error;
    }

    if (result.bookmarked && target && window.ClashlyNotifications) {
      window.ClashlyNotifications.createNotification({
        userId: target.user_id,
        actorId: currentUserId,
        type: "bookmark",
        targetId: target.id,
        targetTakeId: target.id,
      }).catch(() => {});
    }

    updateTakeBookmarkState(input.takeId, result.bookmarked);
    syncCategoryTakeState(input.takeId);
    setFeedState("", "");
  }

  async function loadFeed(options) {
    const skipSkeleton = Boolean(options && options.skipSkeleton);
    const safeCategorySlug = getQueryCategory();
    const feedEl = document.getElementById("category-feed-stream");
    if (!feedEl) return;

    if (!safeCategorySlug) {
      currentCategory = null;
      currentFeedTakes = [];
      renderCategoryHeader();
      feedEl.innerHTML = "";
      setFeedState("Missing category.", "error");
      return;
    }

    setFeedState("", "");

    // Show skeleton immediately while category data loads
    if (!skipSkeleton) {
      if (typeof window.clasheShowFeedSkeleton === "function") {
        window.clasheShowFeedSkeleton("category-feed-stream", 5);
      } else {
        feedEl.innerHTML = "";
      }
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
        renderCategoryPulse();
        setFeedState("This category could not be found.", "error");
        return;
      }

      if (currentUserId && currentCategory.slug && window.ClashePersonalization) {
        window.ClashePersonalization.recordCategoryVisit(currentUserId, currentCategory.slug).catch(() => {});
      }

      currentFeedTakes = result.takes || [];
      renderFeed();
      renderCategoryPulse();
      setFeedState("", "");
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
    syncCategoryTakeState(detail.takeId);
    renderCategoryPulse();
  }

  function handleTakeBookmarkUpdated(event) {
    const detail = event.detail || {};
    if (!detail.takeId || typeof detail.bookmarked !== "boolean") return;
    updateTakeBookmarkState(detail.takeId, detail.bookmarked);
    syncCategoryTakeState(detail.takeId);
  }

  async function initCategoryPage() {
    try {
      if (!window.ClashlyTakes || !window.ClashlyTakeRenderer || !window.ClashlySession || !window.ClashlyCategories) return;

      // Show skeleton immediately before any async work
      if (typeof window.clasheShowFeedSkeleton === "function") {
        window.clasheShowFeedSkeleton("category-feed-stream", 5);
      }

      window.addEventListener("clashly:take-updated", handleTakeUpdated);
      window.addEventListener("clashly:take-bookmark-updated", handleTakeBookmarkUpdated);

      const sessionState = await window.ClashlySession.resolveSession();
      currentUserId = sessionState.user ? sessionState.user.id : "";
      await loadFeed({ skipSkeleton: true });
    } finally {
      if (window.ClasheLoader) {
        window.ClasheLoader.release("page-data");
      }
    }
  }

  document.addEventListener("DOMContentLoaded", initCategoryPage);
})();
