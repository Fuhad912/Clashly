(function () {
  const PAGE_SIZE = 15;
  const SCROLL_THRESHOLD_PX = 900;
  const HEATED_THRESHOLD = 5;
  let currentUserId = "";
  let currentTag = "";
  let currentSortTab = "new";
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

  function renderHeader() {
    const titleEl = document.getElementById("hashtag-title");
    const subtitleEl = document.getElementById("hashtag-subtitle");
    const safeTag = currentTag || "hashtag";

    document.title = `Clashe | #${safeTag}`;
    if (titleEl) titleEl.textContent = `#${safeTag}`;
    if (subtitleEl) subtitleEl.textContent = `Takes tagged with #${safeTag}`;
  }

  function getHashtagStats() {
    const authorIds = new Set();
    return currentFeedTakes.reduce(
      (stats, take) => {
        const vote = take && take.vote ? take.vote : {};
        const totalVotes = Number(vote.total_votes || 0);
        const commentCount = Number(take && take.comment_count ? take.comment_count : 0);

        if (take && take.user_id) {
          authorIds.add(take.user_id);
        }

        return {
          takes: stats.takes + 1,
          votes: stats.votes + totalVotes,
          comments: stats.comments + commentCount,
          authors: authorIds.size,
          heated: stats.heated + (totalVotes + commentCount >= HEATED_THRESHOLD ? 1 : 0),
        };
      },
      { takes: 0, votes: 0, comments: 0, authors: 0, heated: 0 }
    );
  }

  function renderHashtagPulse() {
    const pulseEl = document.getElementById("hashtag-pulse");
    const titleEl = document.getElementById("hashtag-pulse-title");
    const lineEl = document.getElementById("hashtag-pulse-line");
    const statsEl = document.getElementById("hashtag-pulse-stats");
    if (!pulseEl || !titleEl || !lineEl || !statsEl) return;

    if (!currentTag || !currentFeedTakes.length) {
      pulseEl.hidden = true;
      statsEl.innerHTML = "";
      return;
    }

    const stats = getHashtagStats();
    const takeLabel = pluralize(stats.takes, "take");
    const authorLabel = pluralize(stats.authors, "voice");

    titleEl.textContent = `${formatCompactNumber(stats.takes)} ${takeLabel} tagged #${currentTag}`;
    lineEl.textContent = `${formatCompactNumber(stats.authors)} ${authorLabel} debating here with ${formatCompactNumber(
      stats.votes
    )} ${pluralize(stats.votes, "vote")} and ${formatCompactNumber(stats.comments)} ${pluralize(stats.comments, "comment")}.`;

    const statItems = [
      { value: stats.takes, label: pluralize(stats.takes, "take") },
      { value: stats.votes, label: pluralize(stats.votes, "vote") },
      { value: stats.comments, label: pluralize(stats.comments, "comment") },
      { value: stats.heated, label: "heated" },
    ];

    statsEl.innerHTML = statItems
      .map(
        (item) => `
          <span class="hashtag-pulse__stat">
            <strong>${window.ClashlyUtils.escapeHtml(formatCompactNumber(item.value))}</strong>
            <span>${window.ClashlyUtils.escapeHtml(item.label)}</span>
          </span>
        `
      )
      .join("");
    pulseEl.hidden = false;
  }

  function computeRelatedHashtags() {
    const counts = new Map();
    currentFeedTakes.forEach((take) => {
      const tags = Array.isArray(take && take.hashtags) ? take.hashtags : [];
      tags.forEach((tag) => {
        const safeTag = String(tag || "").toLowerCase();
        if (!safeTag || safeTag === currentTag) return;
        counts.set(safeTag, (counts.get(safeTag) || 0) + 1);
      });
    });

    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
      .slice(0, 8);
  }

  function renderRelatedHashtags() {
    const wrapEl = document.getElementById("hashtag-related");
    const chipsEl = document.getElementById("hashtag-related-chips");
    if (!wrapEl || !chipsEl) return;

    const related = computeRelatedHashtags();
    if (!related.length) {
      wrapEl.hidden = true;
      chipsEl.innerHTML = "";
      return;
    }

    wrapEl.hidden = false;
    chipsEl.innerHTML = related
      .map(
        (item) => `
          <a class="hashtag-chip" href="hashtag.html?tag=${encodeURIComponent(item.tag)}">
            <span>#${window.ClashlyUtils.escapeHtml(item.tag)}</span>
            <span class="hashtag-chip__count">${item.count}</span>
          </a>
        `
      )
      .join("");
  }

  function setActiveTabUI() {
    const buttons = document.querySelectorAll("[data-hashtag-tab]");
    buttons.forEach((button) => {
      const isActive = button.getAttribute("data-hashtag-tab") === currentSortTab;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });
  }

  function bindSortTabs() {
    const tabsEl = document.querySelector(".hashtag-tabs");
    if (!tabsEl || tabsEl.dataset.tabsBound === "true") return;

    tabsEl.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("[data-hashtag-tab]");
      if (!button) return;

      const nextTab = button.getAttribute("data-hashtag-tab") || "new";
      if (nextTab === currentSortTab) return;

      currentSortTab = nextTab;
      setActiveTabUI();
      loadFeed({ append: false }).catch(() => {});
    });

    tabsEl.dataset.tabsBound = "true";
  }

  async function handleCopyLink(button) {
    if (!(button instanceof HTMLButtonElement) || button.dataset.copying === "true") return;
    const labelEl = button.querySelector("[data-copy-label]");

    button.dataset.copying = "true";
    try {
      await window.ClashlyUtils.copyText(window.location.href);
      button.classList.add("is-copied");
      if (labelEl) labelEl.textContent = "Copied";
    } catch (error) {
      window.ClashlyUtils.reportError("Copy hashtag link failed.", error, "Could not copy link.");
    } finally {
      window.setTimeout(() => {
        button.classList.remove("is-copied");
        if (labelEl) labelEl.textContent = "Copy link";
        button.dataset.copying = "false";
      }, 1700);
    }
  }

  function bindCopyLink() {
    const button = document.getElementById("hashtag-copy-link");
    if (!button || button.dataset.copyBound === "true") return;

    button.addEventListener("click", () => {
      handleCopyLink(button).catch(() => {});
    });

    button.dataset.copyBound = "true";
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

  function syncHashtagTakeState(takeId) {
    const feedEl = document.getElementById("hashtag-feed-stream");
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
    const previousVote = target.vote ? { ...target.vote } : null;
    const optimisticVote = window.ClashlyTakes && typeof window.ClashlyTakes.previewVoteSummary === "function"
      ? window.ClashlyTakes.previewVoteSummary(previousVote, input.voteType)
      : previousVote;

    updateTakeVoteState(input.takeId, { vote_loading: true, vote: optimisticVote || target.vote });
    syncHashtagTakeState(input.takeId);

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
      syncHashtagTakeState(input.takeId);
      renderHashtagPulse();
      setFeedState("", "");
    } catch (error) {
      updateTakeVoteState(input.takeId, {
        vote_loading: false,
        vote: previousVote || target.vote,
      });
      syncHashtagTakeState(input.takeId);
      renderHashtagPulse();
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
    syncHashtagTakeState(input.takeId);
    const result = await window.ClashlyTakes.toggleBookmark({
      userId: currentUserId,
      takeId: input.takeId,
      isBookmarked: input.isBookmarked,
    });

    if (result.error) {
      updateTakeBookmarkState(input.takeId, previousBookmarked);
      syncHashtagTakeState(input.takeId);
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
    syncHashtagTakeState(input.takeId);
    setFeedState("", "");
  }

  async function loadFeed(options) {
    const append = Boolean(options && options.append);
    const skipSkeleton = Boolean(options && options.skipSkeleton);
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
      if (!skipSkeleton) {
        if (typeof window.clasheShowFeedSkeleton === "function") {
          window.clasheShowFeedSkeleton("hashtag-feed-stream", 5);
        } else {
          feedEl.innerHTML = "";
        }
      }
    }

    try {
      const result = await window.ClashlyTakes.fetchTakesByHashtag(currentTag, {
        limit: PAGE_SIZE,
        currentUserId,
        cursor: append ? nextCursor : null,
        tab: currentSortTab,
      });

      if (result.error) {
        throw result.error;
      }

      const incoming = result.takes || [];
      currentFeedTakes = append ? currentFeedTakes.concat(incoming) : incoming;
      nextCursor = result.nextCursor || null;
      hasMore = Boolean(result.hasMore);
      renderFeed();
      renderHashtagPulse();
      renderRelatedHashtags();
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
    syncHashtagTakeState(detail.takeId);
    renderHashtagPulse();
  }

  function handleTakeBookmarkUpdated(event) {
    const detail = event.detail || {};
    if (!detail.takeId || typeof detail.bookmarked !== "boolean") return;
    updateTakeBookmarkState(detail.takeId, detail.bookmarked);
    syncHashtagTakeState(detail.takeId);
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

      // Show skeleton immediately — before session round-trip
      if (typeof window.clasheShowFeedSkeleton === "function") {
        window.clasheShowFeedSkeleton("hashtag-feed-stream", 5);
      }

      window.addEventListener("clashly:take-updated", handleTakeUpdated);
      window.addEventListener("clashly:take-bookmark-updated", handleTakeBookmarkUpdated);
      bindInfiniteScroll();
      bindSortTabs();
      bindCopyLink();
      setActiveTabUI();

      const sessionState = await window.ClashlySession.resolveSession();
      currentUserId = sessionState.user ? sessionState.user.id : "";
      await loadFeed({ append: false, skipSkeleton: true });

      if (currentUserId && currentTag && window.ClashePersonalization) {
        window.ClashePersonalization.recordHashtagVisit(currentUserId, currentTag).catch(() => {});
      }
    } finally {
      if (window.ClasheLoader) {
        window.ClasheLoader.release("page-data");
      }
    }
  }

  document.addEventListener("DOMContentLoaded", initHashtagPage);
})();
