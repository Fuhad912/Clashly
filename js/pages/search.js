(function () {
  let currentUserId = "";
  let currentQuery = "";
  let currentTakeResults = [];

  function getQuery() {
    const params = new URLSearchParams(window.location.search);
    return (params.get("q") || "").trim();
  }

  function syncSearchInput() {
    const input = document.getElementById("search-page-input");
    if (!input) return;
    input.value = currentQuery;
  }

  function setState(message, type) {
    const stateEl = document.getElementById("search-state");
    if (!stateEl) return;

    stateEl.hidden = !message;
    stateEl.textContent = message || "";
    stateEl.classList.remove("is-error", "is-success");
    if (type === "error") stateEl.classList.add("is-error");
    if (type === "success") stateEl.classList.add("is-success");
  }

  function setDiscoveryVisibility(isVisible) {
    const discoveryEl = document.getElementById("search-discovery");
    if (!discoveryEl) return;
    discoveryEl.hidden = !isVisible;
  }

  function setTrendingState(message, type) {
    const stateEl = document.getElementById("search-trending-state");
    if (!stateEl) return;

    stateEl.hidden = !message;
    stateEl.textContent = message || "";
    stateEl.classList.remove("is-error");
    if (type === "error") {
      stateEl.classList.add("is-error");
    }
  }

  function updateHeader() {
    const titleEl = document.getElementById("search-title");
    const subtitleEl = document.getElementById("search-subtitle");

    if (!currentQuery) {
      document.title = "Clashe | Search";
      if (titleEl) titleEl.textContent = "Discover";
      if (subtitleEl) subtitleEl.textContent = "Explore people, takes, and hashtags moving through Clashe.";
      syncSearchInput();
      return;
    }

    document.title = `Clashe | Search: ${currentQuery}`;
    if (titleEl) titleEl.textContent = `Results for "${currentQuery}"`;
    if (subtitleEl) subtitleEl.textContent = "Grouped by takes, users, and hashtags.";
    syncSearchInput();
  }

  function renderAvatar(user) {
    if (user.avatar_url) {
      return `<div class="search-result__avatar"><img src="${window.ClashlyUtils.escapeHtml(user.avatar_url)}" alt="@${window.ClashlyUtils.escapeHtml(
        user.username
      )} avatar" /></div>`;
    }

    return `<div class="search-result__avatar">${window.ClashlyProfiles.initialsFromUsername(user.username)}</div>`;
  }

  function renderUsers(users) {
    const groupEl = document.getElementById("search-users-group");
    const bodyEl = document.getElementById("search-users-body");
    if (!groupEl || !bodyEl) return;

    if (!users.length) {
      groupEl.hidden = true;
      bodyEl.innerHTML = "";
      return;
    }

    groupEl.hidden = false;
    bodyEl.innerHTML = users
      .map(
        (user) => `
          <article class="search-result">
            ${renderAvatar(user)}
            <div class="search-result__content">
              <a class="search-result__title" href="profile.html?id=${encodeURIComponent(user.id)}">@${window.ClashlyUtils.escapeHtml(
                user.username
              )}</a>
              <p class="search-result__meta">${window.ClashlyUtils.escapeHtml(user.bio || "No bio yet.")}</p>
            </div>
            <a class="search-result__action" href="profile.html?id=${encodeURIComponent(user.id)}">View</a>
          </article>
        `
      )
      .join("");
  }

  function renderHashtags(hashtags) {
    const groupEl = document.getElementById("search-hashtags-group");
    const bodyEl = document.getElementById("search-hashtags-body");
    if (!groupEl || !bodyEl) return;

    if (!hashtags.length) {
      groupEl.hidden = true;
      bodyEl.innerHTML = "";
      return;
    }

    groupEl.hidden = false;
    bodyEl.innerHTML = hashtags
      .map(
        (hashtag) => `
          <article class="search-result search-result--hashtag">
            <div class="search-result__content">
              <a class="search-result__title" href="hashtag.html?tag=${encodeURIComponent(hashtag.tag)}">#${window.ClashlyUtils.escapeHtml(
                hashtag.tag
              )}</a>
              <p class="search-result__meta">Open hashtag feed</p>
            </div>
            <a class="search-result__action" href="hashtag.html?tag=${encodeURIComponent(hashtag.tag)}">Open</a>
          </article>
        `
      )
      .join("");
  }

  function renderTakes(takes) {
    const groupEl = document.getElementById("search-takes-group");
    const streamEl = document.getElementById("search-takes-stream");
    if (!groupEl || !streamEl) return;

    if (!takes.length) {
      groupEl.hidden = true;
      streamEl.innerHTML = "";
      return;
    }

    groupEl.hidden = false;
    window.ClashlyTakeRenderer.renderTakeList(streamEl, takes, {
      currentUserId,
      showOpenLink: true,
      emptyMessage: "No matching takes.",
    });

    window.ClashlyTakeRenderer.bindShareActions(streamEl, {
      onStatus: setState,
      onShare: handleShareOpen,
    });
    window.ClashlyTakeRenderer.bindVoteActions(streamEl, {
      onStatus: setState,
      onVote: handleVote,
    });
    window.ClashlyTakeRenderer.bindBookmarkActions(streamEl, {
      onStatus: setState,
      onBookmark: handleBookmark,
    });
    window.ClashlyTakeRenderer.bindCommentActions(streamEl, {
      onComments: handleCommentsOpen,
    });
  }

  function renderEmptyState(hasResults) {
    const emptyEl = document.getElementById("search-empty");
    if (!emptyEl) return;

    if (!currentQuery) {
      emptyEl.hidden = true;
      emptyEl.textContent = "";
      return;
    }

    emptyEl.hidden = hasResults;
    emptyEl.textContent = `No results found for "${currentQuery}".`;
  }

  function renderTrendingTopics(topics) {
    const gridEl = document.getElementById("search-trending-topics");
    if (!gridEl) return;

    if (!topics.length) {
      gridEl.hidden = true;
      gridEl.innerHTML = "";
      setTrendingState("", "");
      return;
    }

    setTrendingState("", "");
    gridEl.hidden = false;
    gridEl.innerHTML = topics
      .map((topic, index) => {
        const latestLabel =
          window.ClashlyUtils && typeof window.ClashlyUtils.formatRelativeTime === "function" && topic.latestAt
            ? window.ClashlyUtils.formatRelativeTime(topic.latestAt)
            : "";
        const takeLabel = `${topic.takeCount} recent take${topic.takeCount === 1 ? "" : "s"}`;
        const engagementLabel = `${topic.engagementCount} vote action${topic.engagementCount === 1 ? "" : "s"}`;
        const freshnessCopy = latestLabel ? `Latest take ${latestLabel}` : "Recent hashtag activity";

        return `
          <a class="search-topic-card" href="hashtag.html?tag=${encodeURIComponent(topic.tag)}">
            <div class="search-topic-card__lead">
              <p class="search-topic-card__rank">Lane ${index + 1}</p>
              <h3 class="search-topic-card__title">#${window.ClashlyUtils.escapeHtml(topic.tag)}</h3>
              <p class="search-topic-card__meta">${window.ClashlyUtils.escapeHtml(freshnessCopy)}</p>
            </div>
            <div class="search-topic-card__stats">
              <span class="search-topic-card__stat">
                <strong>${topic.takeCount}</strong>
                <span>${window.ClashlyUtils.escapeHtml(takeLabel)}</span>
              </span>
              <span class="search-topic-card__stat">
                <strong>${topic.engagementCount}</strong>
                <span>${window.ClashlyUtils.escapeHtml(engagementLabel)}</span>
              </span>
            </div>
          </a>
        `;
      })
      .join("");
  }

  async function loadTrendingTopics() {
    if (!window.ClashlySearch || typeof window.ClashlySearch.fetchTrendingTopics !== "function") {
      return;
    }

    setTrendingState("", "");

    // Show a trending skeleton while we wait
    if (typeof window.clasheShowTrendingSkeleton === "function") {
      window.clasheShowTrendingSkeleton("search-trending-topics", 3);
    }

    try {
      const result = await window.ClashlySearch.fetchTrendingTopics({
        limit: 6,
        windowHours: 168,
        recentTakeLimit: 250,
      });

      if (result.error) {
        throw result.error;
      }

      renderTrendingTopics(result.topics || []);
    } catch (error) {
      const message = window.ClashlyUtils.reportError(
        "Trending topics load failed.",
        error,
        "Could not load live lanes right now."
      );
      const gridEl = document.getElementById("search-trending-topics");
      if (gridEl) {
        gridEl.hidden = true;
        gridEl.innerHTML = "";
      }
      setTrendingState(message, "error");
    }
  }

  function handleCommentsOpen(input) {
    if (!window.ClashlyCommentsModal) {
      window.location.href = `take.html?id=${encodeURIComponent(input.takeId)}`;
      return;
    }

    const targetTake = currentTakeResults.find((take) => take.id === input.takeId) || null;
    window.ClashlyCommentsModal.open({
      takeId: input.takeId,
      take: targetTake,
      currentUserId,
    });
  }

  function handleShareOpen(input) {
    const targetTake = currentTakeResults.find((take) => take.id === input.takeId) || null;
    if (window.ClashlyShareModal) {
      window.ClashlyShareModal.open({
        take: targetTake,
      });
      return;
    }

    window.ClashlyUtils.copyText(input.shareUrl)
      .then(() => setState("", ""))
      .catch((error) => setState(window.ClashlyUtils.reportError("Fallback share failed.", error, "Could not copy link."), "error"));
  }

  function updateTakeVoteState(takeId, patch) {
    currentTakeResults = currentTakeResults.map((take) => (take.id === takeId ? { ...take, ...patch } : take));
  }

  function updateTakeBookmarkState(takeId, bookmarked) {
    currentTakeResults = currentTakeResults.map((take) => (take.id === takeId ? { ...take, bookmarked } : take));
  }

  async function handleVote(input) {
    if (!currentUserId) {
      setState("Please log in to vote.", "error");
      window.setTimeout(() => {
        window.location.replace("auth.html");
      }, 250);
      return;
    }

    const target = currentTakeResults.find((take) => take.id === input.takeId);
    if (!target || target.vote_loading) return;

    updateTakeVoteState(input.takeId, { vote_loading: true });
    renderTakes(currentTakeResults);

    try {
      const voteResult = await window.ClashlyTakes.submitVote({
        userId: currentUserId,
        takeId: input.takeId,
        voteType: input.voteType,
        currentVote: target.vote ? target.vote.user_vote : "",
      });

      if (voteResult.error) throw voteResult.error;

      updateTakeVoteState(input.takeId, {
        vote_loading: false,
        vote: voteResult.vote,
      });
      renderTakes(currentTakeResults);
      setState("", "");
    } catch (error) {
      updateTakeVoteState(input.takeId, { vote_loading: false });
      renderTakes(currentTakeResults);
      throw error;
    }
  }

  async function handleBookmark(input) {
    if (!currentUserId) {
      setState("Please log in to save takes.", "error");
      window.setTimeout(() => {
        window.location.replace("auth.html");
      }, 250);
      return;
    }

    const target = currentTakeResults.find((take) => take.id === input.takeId) || null;
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
    renderTakes(currentTakeResults);
    setState("", "");
  }

  function handleTakeUpdated(event) {
    const detail = event.detail || {};
    if (!detail.takeId || !detail.vote) return;
    updateTakeVoteState(detail.takeId, {
      vote: detail.vote,
      vote_loading: false,
    });
    renderTakes(currentTakeResults);
  }

  function handleTakeBookmarkUpdated(event) {
    const detail = event.detail || {};
    if (!detail.takeId || typeof detail.bookmarked !== "boolean") return;
    updateTakeBookmarkState(detail.takeId, detail.bookmarked);
    renderTakes(currentTakeResults);
  }

  async function loadResults() {
    currentQuery = getQuery();
    updateHeader();
    setDiscoveryVisibility(!currentQuery);

    if (!currentQuery) {
      currentTakeResults = [];
      renderTakes([]);
      renderUsers([]);
      renderHashtags([]);
      renderEmptyState(true);
      setState("", "");
      return;
    }

    // Hide status text — skeletons will communicate loading state
    setState("", "");

    // Show skeletons in all three result areas immediately
    const takesStreamEl = document.getElementById("search-takes-stream");
    const usersBodyEl = document.getElementById("search-users-body");
    const takesGroupEl = document.getElementById("search-takes-group");
    const usersGroupEl = document.getElementById("search-users-group");

    if (takesGroupEl && takesStreamEl) {
      takesGroupEl.hidden = false;
      if (typeof window.clasheShowFeedSkeleton === "function") {
        window.clasheShowFeedSkeleton("search-takes-stream", 3);
      }
    }
    if (usersGroupEl && usersBodyEl) {
      usersGroupEl.hidden = false;
      if (typeof window.clasheShowSearchSkeleton === "function") {
        window.clasheShowSearchSkeleton("search-users-body", 3);
      }
    }

    try {
      const result = await window.ClashlySearch.searchAll(currentQuery, {
        currentUserId,
        takeLimit: 10,
        userLimit: 8,
        hashtagLimit: 8,
      });

      if (result.error) {
        throw result.error;
      }

      currentTakeResults = result.takes || [];
      renderTakes(currentTakeResults);
      renderUsers(result.users || []);
      renderHashtags(result.hashtags || []);

      const hasResults = currentTakeResults.length || (result.users || []).length || (result.hashtags || []).length;
      renderEmptyState(Boolean(hasResults));
      setState("", "");

      if (currentUserId && window.ClashePersonalization) {
        window.ClashePersonalization.recordSearch(currentUserId, currentQuery).catch(() => {});
      }
    } catch (error) {
      // Clear skeleton placeholders on error
      if (takesGroupEl) takesGroupEl.hidden = true;
      if (usersGroupEl) usersGroupEl.hidden = true;
      const emptyEl = document.getElementById("search-empty");
      if (emptyEl) emptyEl.hidden = true;
      setState(window.ClashlyUtils.reportError("Search load failed.", error, "Could not load search results."), "error");
    }
  }

  async function initSearchPage() {
    try {
      if (!window.ClashlySearch || !window.ClashlyTakeRenderer || !window.ClashlySession) return;

      const sessionState = await window.ClashlySession.resolveSession();
      currentUserId = sessionState.user ? sessionState.user.id : "";

      const searchForm = document.getElementById("search-page-form");
      if (searchForm) {
        searchForm.addEventListener("submit", (event) => {
          event.preventDefault();
          const input = searchForm.querySelector("input[name='q']");
          if (!(input instanceof HTMLInputElement)) return;
          const nextQuery = String(input.value || "").trim();
          const nextUrl = nextQuery ? `search.html?q=${encodeURIComponent(nextQuery)}` : "search.html";
          window.location.href = nextUrl;
        });
      }

      if (window.ClashlySearchSuggestions) {
        window.ClashlySearchSuggestions.attach({
          formId: "search-page-form",
          inputId: "search-page-input",
          getCurrentUserId: () => currentUserId,
        });
      }

      window.addEventListener("clashly:take-updated", handleTakeUpdated);
      window.addEventListener("clashly:take-bookmark-updated", handleTakeBookmarkUpdated);
      await Promise.all([loadTrendingTopics(), loadResults()]);
    } finally {
      if (window.ClasheLoader) {
        window.ClasheLoader.release("page-data");
      }
    }
  }

  document.addEventListener("DOMContentLoaded", initSearchPage);
})();
