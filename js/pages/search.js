(function () {
  let currentUserId = "";
  let currentQuery = "";
  let currentTakeResults = [];
  let currentTrendingTopics = [];

  const EXPLORE_LANE_THEMES = [
    { accent: "#ff6f4d", glow: "rgba(255, 111, 77, 0.18)", surface: "rgba(255, 111, 77, 0.08)" },
    { accent: "#0ea5e9", glow: "rgba(14, 165, 233, 0.18)", surface: "rgba(14, 165, 233, 0.08)" },
    { accent: "#16a34a", glow: "rgba(22, 163, 74, 0.18)", surface: "rgba(22, 163, 74, 0.08)" },
    { accent: "#d97706", glow: "rgba(217, 119, 6, 0.18)", surface: "rgba(217, 119, 6, 0.08)" },
    { accent: "#db2777", glow: "rgba(219, 39, 119, 0.18)", surface: "rgba(219, 39, 119, 0.08)" },
    { accent: "#7c3aed", glow: "rgba(124, 58, 237, 0.18)", surface: "rgba(124, 58, 237, 0.08)" },
  ];

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

  function setExploreState(message, type) {
    const stateEl = document.getElementById("search-explore-state");
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
      if (subtitleEl) subtitleEl.textContent = "Search fast, then keep scrolling into live lanes built from the floor.";
      syncSearchInput();
      return;
    }

    document.title = `Clashe | Search: ${currentQuery}`;
    if (titleEl) titleEl.textContent = `Results for "${currentQuery}"`;
    if (subtitleEl) subtitleEl.textContent = "Grouped by takes, users, and hashtags.";
    syncSearchInput();
  }

  function toCategoryHref(slug) {
    return `category.html?category=${encodeURIComponent(slug)}`;
  }

  function getLaneTheme(index) {
    return EXPLORE_LANE_THEMES[index % EXPLORE_LANE_THEMES.length];
  }

  function getKeywordOrbs(keywords) {
    return keywords
      .slice(0, 3)
      .map((keyword) => {
        const label = String(keyword || "").replace(/^#/, "").trim();
        const initials = label.slice(0, 2).toUpperCase();
        return `<span class="search-explore-card__orb" aria-hidden="true">${window.ClashlyUtils.escapeHtml(initials || "CL")}</span>`;
      })
      .join("");
  }

  function summarizeLaneSignal(category, topCategorySlugs, topHashtags) {
    const keywordList = Array.isArray(category.keywords) ? category.keywords.map((keyword) => String(keyword || "").toLowerCase()) : [];
    const trendingMatches = currentTrendingTopics
      .map((topic) => String(topic.tag || "").toLowerCase())
      .filter((tag) => keywordList.includes(tag))
      .slice(0, 2);
    const personalMatches = keywordList.filter((keyword) => topHashtags.has(keyword)).slice(0, 2);
    const isPreferredCategory = topCategorySlugs.has(String(category.slug || "").toLowerCase());

    if (isPreferredCategory && personalMatches.length) {
      return {
        eyebrow: "For you",
        note: `Because you keep circling ${personalMatches.map((tag) => `#${tag}`).join(" and ")}.`,
      };
    }

    if (isPreferredCategory) {
      return {
        eyebrow: "For you",
        note: "This lane lines up with where you have been spending attention lately.",
      };
    }

    if (trendingMatches.length) {
      return {
        eyebrow: "Trending now",
        note: `Hot around ${trendingMatches.map((tag) => `#${tag}`).join(" and ")} right now.`,
      };
    }

    if ((category.take_count || 0) >= 12) {
      return {
        eyebrow: "Busy lane",
        note: "High posting volume and fresh arguments are pushing this lane up.",
      };
    }

    return {
      eyebrow: "Fresh lane",
      note: "A cleaner pocket to enter before the debate gets crowded.",
    };
  }

  function scoreExploreCategory(category, signalSummary) {
    const topCategorySlugs = new Set(
      ((signalSummary && signalSummary.topInterests && signalSummary.topInterests.categories) || []).map((slug) => String(slug || "").toLowerCase())
    );
    const topHashtags = new Set(
      ((signalSummary && signalSummary.topInterests && signalSummary.topInterests.hashtags) || []).map((tag) => String(tag || "").toLowerCase())
    );
    const keywordList = Array.isArray(category.keywords) ? category.keywords.map((keyword) => String(keyword || "").toLowerCase()) : [];
    const trendingMatches = currentTrendingTopics.filter((topic) => keywordList.includes(String(topic.tag || "").toLowerCase())).length;
    const personalMatches = keywordList.filter((keyword) => topHashtags.has(keyword)).length;
    const preferredCategory = topCategorySlugs.has(String(category.slug || "").toLowerCase()) ? 18 : 0;
    return preferredCategory + personalMatches * 6 + trendingMatches * 4 + Math.min(Number(category.take_count || 0), 36);
  }

  function renderExploreSignals(categories, signalSummary) {
    const signalsEl = document.getElementById("search-explore-signals");
    const subtitleEl = document.getElementById("search-explore-subtitle");
    if (!signalsEl || !subtitleEl) return;

    const topCategorySlugs = ((signalSummary && signalSummary.topInterests && signalSummary.topInterests.categories) || []).slice(0, 3);
    const topHashtags = ((signalSummary && signalSummary.topInterests && signalSummary.topInterests.hashtags) || []).slice(0, 4);
    const categoryNameMap = new Map((categories || []).map((category) => [String(category.slug || "").toLowerCase(), category.name]));
    const bits = [
      ...topCategorySlugs.map((slug) => ({
        label: categoryNameMap.get(String(slug || "").toLowerCase()) || slug,
        kind: "lane",
      })),
      ...topHashtags.map((tag) => ({
        label: `#${tag}`,
        kind: "tag",
      })),
    ].slice(0, 6);

    if (!bits.length) {
      signalsEl.hidden = true;
      signalsEl.innerHTML = "";
      subtitleEl.textContent = "Live categories, trending signals, and keyword clusters pulled into one social discovery floor.";
      return;
    }

    subtitleEl.textContent = "Ordered using your recent searches, hashtag trails, and live category momentum.";
    signalsEl.hidden = false;
    signalsEl.innerHTML = bits
      .map(
        (bit) => `
          <span class="search-explore__signal search-explore__signal--${window.ClashlyUtils.escapeHtml(bit.kind)}">
            ${window.ClashlyUtils.escapeHtml(bit.label)}
          </span>
        `
      )
      .join("");
  }

  function renderExploreCategories(categories, signalSummary) {
    const gridEl = document.getElementById("search-explore-grid");
    if (!gridEl) return;

    if (!categories.length) {
      gridEl.hidden = true;
      gridEl.innerHTML = "";
      setExploreState("No lanes are available yet.", "");
      return;
    }

    const topCategorySlugs = new Set(
      ((signalSummary && signalSummary.topInterests && signalSummary.topInterests.categories) || []).map((slug) => String(slug || "").toLowerCase())
    );
    const topHashtags = new Set(
      ((signalSummary && signalSummary.topInterests && signalSummary.topInterests.hashtags) || []).map((tag) => String(tag || "").toLowerCase())
    );

    const ranked = categories
      .slice()
      .sort((left, right) => {
        const scoreDiff = scoreExploreCategory(right, signalSummary) - scoreExploreCategory(left, signalSummary);
        if (scoreDiff !== 0) return scoreDiff;
        const countDiff = Number(right.take_count || 0) - Number(left.take_count || 0);
        if (countDiff !== 0) return countDiff;
        return (Number(left.sort_order || 0) - Number(right.sort_order || 0));
      })
      .slice(0, 8);

    setExploreState("", "");
    gridEl.hidden = false;
    gridEl.innerHTML = ranked
      .map((category, index) => {
        const theme = getLaneTheme(index);
        const laneSignal = summarizeLaneSignal(category, topCategorySlugs, topHashtags);
        const keywords = Array.isArray(category.keywords) ? category.keywords.slice(0, 4) : [];
        const trendingMatches = currentTrendingTopics
          .map((topic) => String(topic.tag || "").toLowerCase())
          .filter((tag) => keywords.map((keyword) => String(keyword || "").toLowerCase()).includes(tag))
          .slice(0, 2);
        const metaTags = [
          `${Number(category.take_count || 0)} ${Number(category.take_count || 0) === 1 ? "take" : "takes"}`,
          ...trendingMatches.map((tag) => `#${tag}`),
        ].slice(0, 3);

        return `
          <article
            class="search-explore-card"
            style="--lane-accent:${theme.accent};--lane-glow:${theme.glow};--lane-surface:${theme.surface};"
          >
            <div class="search-explore-card__wash" aria-hidden="true"></div>
            <header class="search-explore-card__head">
              <div class="search-explore-card__eyebrow-row">
                <p class="search-explore-card__eyebrow">${window.ClashlyUtils.escapeHtml(laneSignal.eyebrow)}</p>
                <span class="search-explore-card__slug">/${window.ClashlyUtils.escapeHtml(category.slug)}</span>
              </div>
              <h3 class="search-explore-card__title">
                <a href="${toCategoryHref(category.slug)}">${window.ClashlyUtils.escapeHtml(category.name)}</a>
              </h3>
              <p class="search-explore-card__description">${window.ClashlyUtils.escapeHtml(category.description)}</p>
            </header>

            <div class="search-explore-card__social">
              <div class="search-explore-card__orbs">${getKeywordOrbs(keywords)}</div>
              <p class="search-explore-card__social-copy">${window.ClashlyUtils.escapeHtml(laneSignal.note)}</p>
            </div>

            <div class="search-explore-card__meta">
              ${metaTags
                .map(
                  (tag) => `
                    <span class="search-explore-card__meta-pill">${window.ClashlyUtils.escapeHtml(tag)}</span>
                  `
                )
                .join("")}
            </div>

            <div class="search-explore-card__chips">
              ${keywords
                .map(
                  (keyword) => `
                    <a class="search-explore-card__chip" href="search.html?q=${encodeURIComponent(keyword)}">
                      ${window.ClashlyUtils.escapeHtml(`#${keyword}`)}
                    </a>
                  `
                )
                .join("")}
            </div>

            <footer class="search-explore-card__footer">
              <span class="search-explore-card__stat">${window.ClashlyUtils.escapeHtml(
                `${Number(category.take_count || 0)} live ${Number(category.take_count || 0) === 1 ? "post" : "posts"}`
              )}</span>
              <a class="search-explore-card__cta" href="${toCategoryHref(category.slug)}">Enter lane</a>
            </footer>
          </article>
        `;
      })
      .join("");
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
    currentTrendingTopics = topics.slice();
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
      currentTrendingTopics = [];
      setTrendingState(message, "error");
    }
  }

  async function loadExploreLanes() {
    if (!window.ClashlyCategories) return;

    const gridEl = document.getElementById("search-explore-grid");
    if (gridEl && typeof window.clasheShowExploreSkeleton === "function") {
      window.clasheShowExploreSkeleton("search-explore-grid", 4);
      gridEl.hidden = false;
    }

    setExploreState("", "");

    try {
      const [categoriesResult] = await Promise.all([
        window.ClashlyCategories.fetchCategories(),
        currentUserId && window.ClashePersonalization
          ? window.ClashePersonalization.hydrateUserState(currentUserId)
          : Promise.resolve(null),
      ]);

      if (categoriesResult.error) {
        throw categoriesResult.error;
      }

      const signalSummary =
        currentUserId && window.ClashePersonalization
          ? window.ClashePersonalization.getSignalSummary(currentUserId)
          : {
              hasSignals: false,
              topInterests: {
                categories: [],
                hashtags: [],
              },
            };

      renderExploreSignals(categoriesResult.categories || [], signalSummary);
      renderExploreCategories(categoriesResult.categories || [], signalSummary);
    } catch (error) {
      const message = window.ClashlyUtils.reportError(
        "Explore lanes load failed.",
        error,
        "Could not load explore lanes right now."
      );
      if (gridEl) {
        gridEl.hidden = true;
        gridEl.innerHTML = "";
      }
      setExploreState(message, "error");
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
      await loadTrendingTopics();
      await Promise.all([loadResults(), loadExploreLanes()]);
    } finally {
      if (window.ClasheLoader) {
        window.ClasheLoader.release("page-data");
      }
    }
  }

  document.addEventListener("DOMContentLoaded", initSearchPage);
})();
