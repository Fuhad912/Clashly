(function () {
  const AI_JUDGE_MIN_VOTES = 20;
  const AI_JUDGE_MIN_COMMENTS = 6;
  const RECENT_SEARCHES_KEY_PREFIX = "clashe-recent-searches";
  const MAX_RECENT_SEARCHES = 8;
  let currentUserId = "";
  let currentQuery = "";
  let currentTakeResults = [];
  let currentTrendingTopics = [];
  let expandedTakeId = "";

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

  function getExpandedTakeQuery() {
    const params = new URLSearchParams(window.location.search);
    return (params.get("expandTake") || "").trim();
  }

  function normalizeSearchTerm(value) {
    return String(value || "").trim();
  }

  function getRecentSearchesStorageKey() {
    return `${RECENT_SEARCHES_KEY_PREFIX}:${currentUserId || "guest"}`;
  }

  function getRecentSearches() {
    try {
      const raw = window.localStorage.getItem(getRecentSearchesStorageKey());
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item) => normalizeSearchTerm(item))
        .filter(Boolean)
        .slice(0, MAX_RECENT_SEARCHES);
    } catch (_error) {
      return [];
    }
  }

  function saveRecentSearches(items) {
    try {
      window.localStorage.setItem(getRecentSearchesStorageKey(), JSON.stringify((items || []).slice(0, MAX_RECENT_SEARCHES)));
    } catch (_error) {
      // Ignore storage failures.
    }
  }

  function addRecentSearch(query) {
    const normalized = normalizeSearchTerm(query);
    if (!normalized) return;

    const deduped = getRecentSearches().filter((item) => item.toLowerCase() !== normalized.toLowerCase());
    deduped.unshift(normalized);
    saveRecentSearches(deduped);
  }

  function clearRecentSearches() {
    saveRecentSearches([]);
  }

  function renderRecentSearches() {
    const panelEl = document.getElementById("search-recents-panel");
    const listEl = document.getElementById("search-recents-list");
    const clearBtn = document.getElementById("search-recents-clear");
    if (!panelEl || !listEl || !clearBtn) return;

    const recentSearches = getRecentSearches();
    const hasRecentSearches = recentSearches.length > 0;
    panelEl.hidden = !hasRecentSearches;
    listEl.hidden = !hasRecentSearches;
    clearBtn.hidden = !hasRecentSearches;

    if (!hasRecentSearches) {
      listEl.innerHTML = "";
      return;
    }

    listEl.innerHTML = recentSearches
      .map(
        (term) => `
          <button
            type="button"
            class="search-recents__item"
            data-recent-search="${window.ClashlyUtils.escapeHtml(term)}"
            aria-label="Search for ${window.ClashlyUtils.escapeHtml(term)} again"
          >
            <span class="search-recents__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 8v4l2.8 2"></path>
                <path d="M21 12a9 9 0 1 1-2.64-6.36"></path>
              </svg>
            </span>
            <span>${window.ClashlyUtils.escapeHtml(term)}</span>
          </button>
        `
      )
      .join("");
  }

  function goToSearchQuery(query) {
    const normalized = normalizeSearchTerm(query);
    const nextUrl = normalized ? `search.html?q=${encodeURIComponent(normalized)}` : "search.html";
    window.location.href = nextUrl;
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
    if (isVisible) {
      renderRecentSearches();
    }
  }

  function setExploreVisibility(isVisible) {
    const exploreEl = document.getElementById("search-explore");
    if (!exploreEl) return;
    exploreEl.hidden = !isVisible;
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

  function toProfileHref(user) {
    const params = new URLSearchParams();
    if (user && user.id) params.set("id", user.id);
    if (user && user.username) params.set("u", user.username);
    const query = params.toString();
    return query ? `user.html?${query}` : "user.html";
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
              <a class="search-result__title" href="${toProfileHref(user)}">@${window.ClashlyUtils.escapeHtml(
                user.username
              )}</a>
              <p class="search-result__meta">${window.ClashlyUtils.escapeHtml(user.bio || "No bio yet.")}</p>
            </div>
            <a class="search-result__action" href="${toProfileHref(user)}">View</a>
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
      expandedTakeId = "";
      return;
    }

    if (expandedTakeId && !takes.some((take) => take.id === expandedTakeId)) {
      expandedTakeId = "";
    }

    groupEl.hidden = false;
    window.ClashlyTakeRenderer.renderTakeList(streamEl, takes, {
      currentUserId,
      hideCommentsAction: true,
      showAiJudgeAction: true,
      hideInlineAiJudgeResult: true,
      showOpenLink: false,
      toggleOpenAction: true,
      expandedTakeId,
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
    window.ClashlyTakeRenderer.bindAiJudgeActions(streamEl, {
      onStatus: setState,
      onAiJudge: handleAiJudge,
    });
    bindTakeExpandActions(streamEl);
  }

  function syncSearchTakeState(takeId) {
    const streamEl = document.getElementById("search-takes-stream");
    if (!streamEl || !window.ClashlyTakeRenderer || typeof window.ClashlyTakeRenderer.syncTakeState !== "function") return;
    const targetTake = currentTakeResults.find((take) => take.id === takeId) || null;
    if (!targetTake) return;
    window.ClashlyTakeRenderer.syncTakeState(streamEl, targetTake);
  }

  function toggleExpandedTake(takeId) {
    const safeTakeId = String(takeId || "").trim();
    if (!safeTakeId) return;
    expandedTakeId = expandedTakeId === safeTakeId ? "" : safeTakeId;
    renderTakes(currentTakeResults);
  }

  function bindTakeExpandActions(streamEl) {
    const toggleButtons = streamEl.querySelectorAll("[data-action='toggle-open']");
    toggleButtons.forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        const takeId = button.getAttribute("data-take-id") || "";
        toggleExpandedTake(takeId);
      });
    });

    const takeItems = streamEl.querySelectorAll(".take-item--toggleable");
    takeItems.forEach((item) => {
      item.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest("a, button, input, select, textarea, label")) return;
        const takeId = item.getAttribute("data-take-id") || "";
        toggleExpandedTake(takeId);
      });
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
    if (currentQuery) {
      setExploreVisibility(false);
      return;
    }

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

  function updateTakeAiJudgeState(takeId, judgeState) {
    currentTakeResults = currentTakeResults.map((take) => (take.id === takeId ? { ...take, ai_judge: judgeState } : take));
  }

  function evaluateAiJudgeEligibility(take) {
    const vote = take && take.vote ? take.vote : {};
    const totalVotes = Number(vote.total_votes || 0);
    const agreeVotes = Number(vote.agree_count || 0);
    const disagreeVotes = Number(vote.disagree_count || 0);
    const totalComments = Number(take && take.comment_count ? take.comment_count : 0);

    if (totalVotes < AI_JUDGE_MIN_VOTES || totalComments < AI_JUDGE_MIN_COMMENTS) {
      return {
        eligible: false,
        reason: `Not enough debate yet for AI Judge. It unlocks at ${AI_JUDGE_MIN_VOTES}+ votes and ${AI_JUDGE_MIN_COMMENTS}+ comments.`,
      };
    }

    if (agreeVotes <= 0 || disagreeVotes <= 0) {
      return {
        eligible: false,
        reason: "AI Judge needs both agree and disagree sides represented before analyzing.",
      };
    }

    return {
      eligible: true,
      reason: "",
    };
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
    const previousVote = target.vote ? { ...target.vote } : null;
    const optimisticVote = window.ClashlyTakes && typeof window.ClashlyTakes.previewVoteSummary === "function"
      ? window.ClashlyTakes.previewVoteSummary(previousVote, input.voteType)
      : previousVote;

    updateTakeVoteState(input.takeId, { vote_loading: true, vote: optimisticVote || target.vote });
    syncSearchTakeState(input.takeId);

    try {
      const voteResult = await window.ClashlyTakes.submitVote({
        userId: currentUserId,
        takeId: input.takeId,
        voteType: input.voteType,
        currentVote: previousVote ? previousVote.user_vote : "",
      });

      if (voteResult.error) throw voteResult.error;

      const reconciledVote =
        window.ClashlyTakes && typeof window.ClashlyTakes.resolveSubmittedVoteSummary === "function"
          ? window.ClashlyTakes.resolveSubmittedVoteSummary(optimisticVote, voteResult.vote)
          : optimisticVote || voteResult.vote;
      updateTakeVoteState(input.takeId, {
        vote_loading: false,
        vote: reconciledVote,
      });
      syncSearchTakeState(input.takeId);
      setState("", "");
    } catch (error) {
      updateTakeVoteState(input.takeId, {
        vote_loading: false,
        vote: previousVote || target.vote,
      });
      syncSearchTakeState(input.takeId);
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
    const previousBookmarked = Boolean(target && target.bookmarked);
    updateTakeBookmarkState(input.takeId, !previousBookmarked);
    syncSearchTakeState(input.takeId);
    const result = await window.ClashlyTakes.toggleBookmark({
      userId: currentUserId,
      takeId: input.takeId,
      isBookmarked: input.isBookmarked,
    });

    if (result.error) {
      updateTakeBookmarkState(input.takeId, previousBookmarked);
      syncSearchTakeState(input.takeId);
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
    syncSearchTakeState(input.takeId);
    setState("", "");
  }

  async function handleAiJudge(input) {
    if (!input || !input.takeId) return;
    if (!currentUserId) {
      setState("Please log in to use AI Judge.", "error");
      window.setTimeout(() => {
        window.location.replace("auth.html");
      }, 250);
      return;
    }

    if (!window.ClashlyAiJudge) {
      setState("AI Judge is unavailable right now. Please try again.", "error");
      return;
    }

    const target = currentTakeResults.find((take) => take.id === input.takeId) || null;
    if (!target) return;
    if (target.ai_judge && target.ai_judge.status === "loading") return;

    const eligibility = evaluateAiJudgeEligibility(target);
    if (!eligibility.eligible) {
      setState(eligibility.reason, "error");
      return;
    }

    updateTakeAiJudgeState(input.takeId, {
      status: "loading",
      message: "",
    });
    renderTakes(currentTakeResults);

    try {
      const result = await window.ClashlyAiJudge.analyzeTake(input.takeId);
      if (result.error) throw result.error;

      const payload = result.data || null;
      if (!payload) throw new Error("Empty AI Judge response.");

      if (payload.status === "not_eligible") {
        const reason =
          payload.eligibility && payload.eligibility.reason
            ? payload.eligibility.reason
            : "Not enough debate yet for AI Judge.";
        updateTakeAiJudgeState(input.takeId, null);
        renderTakes(currentTakeResults);
        setState(reason, "error");
        return;
      }

      if ((payload.status === "fresh" || payload.status === "cached") && payload.result) {
        updateTakeAiJudgeState(input.takeId, {
          status: "ready",
          source: payload.status,
          result: payload.result,
        });
        renderTakes(currentTakeResults);
        setState(
          payload.status === "cached"
            ? "Showing recent AI Judge analysis. Open the take for the full breakdown."
            : "AI Judge analysis is ready. Open the take for the full breakdown.",
          ""
        );
        return;
      }

      throw new Error("Unexpected AI Judge response.");
    } catch (error) {
      updateTakeAiJudgeState(input.takeId, {
        status: "error",
        message: "AI Judge is unavailable right now. Please try again.",
      });
      renderTakes(currentTakeResults);
      setState(window.ClashlyUtils.reportError("Search AI Judge failed.", error, "AI Judge is unavailable right now. Please try again."), "error");
    }
  }

  function handleTakeUpdated(event) {
    const detail = event.detail || {};
    if (!detail.takeId || !detail.vote) return;
    updateTakeVoteState(detail.takeId, {
      vote: detail.vote,
      vote_loading: false,
    });
    syncSearchTakeState(detail.takeId);
  }

  function handleTakeBookmarkUpdated(event) {
    const detail = event.detail || {};
    if (!detail.takeId || typeof detail.bookmarked !== "boolean") return;
    updateTakeBookmarkState(detail.takeId, detail.bookmarked);
    syncSearchTakeState(detail.takeId);
  }

  async function loadResults() {
    currentQuery = getQuery();
    expandedTakeId = currentQuery ? getExpandedTakeQuery() : "";
    updateHeader();
    setDiscoveryVisibility(!currentQuery);
    setExploreVisibility(!currentQuery);

    if (!currentQuery) {
      renderRecentSearches();
      currentTakeResults = [];
      expandedTakeId = "";
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
      addRecentSearch(currentQuery);
      renderRecentSearches();

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

      const searchForm = document.getElementById("search-page-form");
      if (searchForm) {
        searchForm.addEventListener("submit", (event) => {
          event.preventDefault();
          const input = searchForm.querySelector("input[name='q']");
          if (!(input instanceof HTMLInputElement)) return;
          const nextQuery = String(input.value || "").trim();
          goToSearchQuery(nextQuery);
        });
      }

      const recentsListEl = document.getElementById("search-recents-list");
      if (recentsListEl) {
        recentsListEl.addEventListener("click", (event) => {
          const target = event.target;
          if (!(target instanceof Element)) return;
          const trigger = target.closest("[data-recent-search]");
          if (!trigger) return;
          const recentSearch = trigger.getAttribute("data-recent-search") || "";
          goToSearchQuery(recentSearch);
        });
      }

      const clearRecentsBtn = document.getElementById("search-recents-clear");
      if (clearRecentsBtn) {
        clearRecentsBtn.addEventListener("click", () => {
          clearRecentSearches();
          renderRecentSearches();
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
      renderRecentSearches();

      // Parallelise session resolve with all data fetches — session is only needed for
      // personalised vote/bookmark state, discovery content can load immediately
      const [sessionState] = await Promise.all([
        window.ClashlySession.resolveSession(),
        loadTrendingTopics(),
        loadResults(),
        loadExploreLanes(),
      ]);
      currentUserId = sessionState.user ? sessionState.user.id : "";
    } finally {
      if (window.ClasheLoader) {
        window.ClasheLoader.release("page-data");
      }
    }
  }

  document.addEventListener("DOMContentLoaded", initSearchPage);
})();
