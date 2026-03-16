(function () {
  const SIGNALS_TABLE = "user_interest_signals";
  const MAX_BUCKET_SIZE = 40;
  const MAX_SEARCH_TOKENS = 6;
  const STOPWORDS = new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "your",
    "about",
    "into",
    "just",
    "have",
    "will",
    "they",
    "them",
    "what",
    "when",
    "where",
    "were",
    "been",
    "than",
    "then",
    "also",
  ]);

  const stateCache = new Map();

  function getClientOrThrow() {
    if (!window.ClashlySupabase) {
      throw new Error("Supabase client module is not loaded.");
    }

    const client = window.ClashlySupabase.getClient();
    if (!client) {
      throw new Error("Supabase client is not configured.");
    }

    return client;
  }

  function createEmptyState() {
    return {
      categories: {},
      hashtags: {},
      searchTerms: {},
      authors: {},
      updatedAt: "",
    };
  }

  function pruneBucket(bucket) {
    return Object.fromEntries(
      Object.entries(bucket || {})
        .filter((entry) => Number(entry[1]) > 0)
        .sort((left, right) => Number(right[1]) - Number(left[1]))
        .slice(0, MAX_BUCKET_SIZE)
    );
  }

  function normalizeSignalKey(key) {
    return String(key || "").trim().toLowerCase();
  }

  function bump(bucket, key, amount) {
    const safeKey = normalizeSignalKey(key);
    if (!safeKey) return;
    bucket[safeKey] = Number(bucket[safeKey] || 0) + Number(amount || 0);
  }

  function normalizeTokens(input) {
    return Array.from(
      new Set(
        String(input || "")
          .toLowerCase()
          .match(/[a-z0-9_#]+/g) || []
      )
    )
      .map((token) => token.trim())
      .filter((token) => token.length >= 2)
      .filter((token) => !STOPWORDS.has(token))
      .slice(0, MAX_SEARCH_TOKENS);
  }

  function setCachedState(userId, state) {
    stateCache.set(userId, {
      categories: pruneBucket(state.categories),
      hashtags: pruneBucket(state.hashtags),
      searchTerms: pruneBucket(state.searchTerms),
      authors: pruneBucket(state.authors),
      updatedAt: state.updatedAt || new Date().toISOString(),
    });
  }

  function getCachedState(userId) {
    return stateCache.get(userId) || createEmptyState();
  }

  function mapRowsToState(rows) {
    const state = createEmptyState();

    (rows || []).forEach((row) => {
      const type = String(row.signal_type || "");
      const key = normalizeSignalKey(row.signal_key);
      const score = Number(row.score || 0);
      if (!key || !score) return;

      if (type === "category") state.categories[key] = score;
      if (type === "hashtag") state.hashtags[key] = score;
      if (type === "search") state.searchTerms[key] = score;
      if (type === "author") state.authors[key] = score;

      if (!state.updatedAt || new Date(row.updated_at).getTime() > new Date(state.updatedAt).getTime()) {
        state.updatedAt = row.updated_at;
      }
    });

    return {
      categories: pruneBucket(state.categories),
      hashtags: pruneBucket(state.hashtags),
      searchTerms: pruneBucket(state.searchTerms),
      authors: pruneBucket(state.authors),
      updatedAt: state.updatedAt,
    };
  }

  async function hydrateUserState(userId, options) {
    if (!userId) {
      return createEmptyState();
    }

    if (!options || !options.refresh) {
      const cached = stateCache.get(userId);
      if (cached) return cached;
    }

    try {
      const client = getClientOrThrow();
      const result = await client
        .from(SIGNALS_TABLE)
        .select("signal_type, signal_key, score, updated_at")
        .eq("user_id", userId)
        .order("score", { ascending: false })
        .limit(200);

      if (result.error) {
        throw result.error;
      }

      const state = mapRowsToState(result.data || []);
      setCachedState(userId, state);
      return getCachedState(userId);
    } catch (error) {
      console.error("[Clashe] Personalization hydrate failed", error);
      const emptyState = createEmptyState();
      setCachedState(userId, emptyState);
      return emptyState;
    }
  }

  function collectTakeSignals(take, action) {
    const signalMap = {
      categories: {},
      hashtags: {},
      searchTerms: {},
      authors: {},
    };

    const weightMap = {
      vote: 5,
      bookmark: 6,
      comment: 4,
      open: 2,
    };

    const amount = weightMap[action] || 1;

    if (take.user_id) {
      bump(signalMap.authors, take.user_id, amount * 0.45);
    }

    if (take.category && take.category.slug) {
      bump(signalMap.categories, take.category.slug, amount * 1.2);
    }

    (take.hashtags || []).forEach((tag) => {
      const normalized = typeof tag === "string" ? tag : tag && tag.tag ? tag.tag : "";
      if (normalized) {
        bump(signalMap.hashtags, normalized, amount);
      }
    });

    normalizeTokens(take.content || "")
      .slice(0, 5)
      .forEach((token) => bump(signalMap.searchTerms, token, amount * 0.22));

    return signalMap;
  }

  function flattenSignalMap(signalMap) {
    const rows = [];
    const pairs = [
      ["category", signalMap.categories || {}],
      ["hashtag", signalMap.hashtags || {}],
      ["search", signalMap.searchTerms || {}],
      ["author", signalMap.authors || {}],
    ];

    pairs.forEach(([signalType, bucket]) => {
      Object.entries(bucket).forEach(([signalKey, score]) => {
        if (!signalKey || !score) return;
        rows.push({ signalType, signalKey, score: Number(score) });
      });
    });

    return rows;
  }

  async function writeSignalMap(userId, signalMap) {
    if (!userId) return;

    const deltaRows = flattenSignalMap(signalMap);
    if (!deltaRows.length) return;

    try {
      const client = getClientOrThrow();
      const existingState = await hydrateUserState(userId);
      const currentByComposite = new Map();

      Object.entries(existingState.categories).forEach(([key, score]) => currentByComposite.set(`category:${key}`, score));
      Object.entries(existingState.hashtags).forEach(([key, score]) => currentByComposite.set(`hashtag:${key}`, score));
      Object.entries(existingState.searchTerms).forEach(([key, score]) => currentByComposite.set(`search:${key}`, score));
      Object.entries(existingState.authors).forEach(([key, score]) => currentByComposite.set(`author:${key}`, score));

      const nowIso = new Date().toISOString();
      const payload = deltaRows.map((row) => ({
        user_id: userId,
        signal_type: row.signalType,
        signal_key: row.signalKey,
        score: Number(currentByComposite.get(`${row.signalType}:${row.signalKey}`) || 0) + Number(row.score || 0),
        updated_at: nowIso,
      }));

      const result = await client.from(SIGNALS_TABLE).upsert(payload, {
        onConflict: "user_id,signal_type,signal_key",
      });

      if (result.error) {
        throw result.error;
      }

      const nextState = {
        categories: { ...existingState.categories },
        hashtags: { ...existingState.hashtags },
        searchTerms: { ...existingState.searchTerms },
        authors: { ...existingState.authors },
        updatedAt: nowIso,
      };

      payload.forEach((row) => {
        if (row.signal_type === "category") nextState.categories[row.signal_key] = Number(row.score);
        if (row.signal_type === "hashtag") nextState.hashtags[row.signal_key] = Number(row.score);
        if (row.signal_type === "search") nextState.searchTerms[row.signal_key] = Number(row.score);
        if (row.signal_type === "author") nextState.authors[row.signal_key] = Number(row.score);
      });

      setCachedState(userId, nextState);
    } catch (error) {
      console.error("[Clashe] Personalization write failed", error);
    }
  }

  async function recordSearch(userId, query) {
    if (!userId || !query) return;

    const signalMap = {
      categories: {},
      hashtags: {},
      searchTerms: {},
      authors: {},
    };

    normalizeTokens(query).forEach((token) => {
      if (token.startsWith("#")) {
        bump(signalMap.hashtags, token.replace(/^#/, ""), 3);
      } else {
        bump(signalMap.searchTerms, token, 2);
      }
    });

    await writeSignalMap(userId, signalMap);
  }

  async function recordHashtagVisit(userId, tag) {
    if (!userId || !tag) return;

    await writeSignalMap(userId, {
      categories: {},
      hashtags: { [normalizeSignalKey(String(tag || "").replace(/^#/, ""))]: 4 },
      searchTerms: {},
      authors: {},
    });
  }

  async function recordCategoryVisit(userId, categorySlug) {
    if (!userId || !categorySlug) return;

    await writeSignalMap(userId, {
      categories: { [normalizeSignalKey(categorySlug)]: 5 },
      hashtags: {},
      searchTerms: {},
      authors: {},
    });
  }

  async function recordTakeEngagement(userId, take, action) {
    if (!userId || !take) return;
    await writeSignalMap(userId, collectTakeSignals(take, action));
  }

  function getTopInterests(userId) {
    const state = getCachedState(userId);
    return {
      categories: Object.entries(state.categories)
        .sort((left, right) => Number(right[1]) - Number(left[1]))
        .slice(0, 3)
        .map(([slug]) => slug),
      hashtags: Object.entries(state.hashtags)
        .sort((left, right) => Number(right[1]) - Number(left[1]))
        .slice(0, 4)
        .map(([tag]) => tag),
    };
  }

  function getSignalSummary(userId) {
    const state = getCachedState(userId);
    const totalSignals =
      Object.keys(state.categories).length +
      Object.keys(state.hashtags).length +
      Object.keys(state.searchTerms).length +
      Object.keys(state.authors).length;

    return {
      hasSignals: totalSignals > 0,
      totalSignals,
      topInterests: getTopInterests(userId),
    };
  }

  function scoreTake(take, state) {
    const vote = take.vote || {};
    const totalVotes = Number(vote.total_votes || 0);
    const ageHours = Math.max(0.2, (Date.now() - new Date(take.created_at).getTime()) / 36e5);
    const recencyScore = Math.max(0, 18 - ageHours);
    let score = recencyScore + Math.min(totalVotes, 40) * 0.4;

    if (take.category && take.category.slug) {
      score += Number(state.categories[take.category.slug] || 0) * 2.8;
    }

    (take.hashtags || []).forEach((tag) => {
      const normalized = typeof tag === "string" ? tag : tag && tag.tag ? tag.tag : "";
      score += Number(state.hashtags[normalized] || 0) * 1.85;
    });

    if (take.user_id) {
      score += Number(state.authors[take.user_id] || 0) * 1.2;
    }

    const content = String(take.content || "").toLowerCase();
    Object.entries(state.searchTerms).forEach(([token, weight]) => {
      if (token && content.includes(token)) {
        score += Number(weight) * 0.9;
      }
    });

    if (take.bookmarked) {
      score += 2.5;
    }

    return score;
  }

  async function rankForYou(takes, userId) {
    const safeTakes = Array.isArray(takes) ? takes.slice() : [];
    if (!userId || !safeTakes.length) {
      return {
        takes: safeTakes,
        meta: {
          hasSignals: false,
          topInterests: { categories: [], hashtags: [] },
        },
      };
    }

    const state = await hydrateUserState(userId);
    const summary = getSignalSummary(userId);

    const ranked = safeTakes
      .map((take) => ({
        ...take,
        for_you_score: scoreTake(take, state),
      }))
      .sort((left, right) => {
        const scoreDiff = Number(right.for_you_score || 0) - Number(left.for_you_score || 0);
        if (scoreDiff !== 0) return scoreDiff;
        return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
      });

    return {
      takes: ranked,
      meta: summary,
    };
  }

  window.ClashePersonalization = {
    SIGNALS_TABLE,
    hydrateUserState,
    recordSearch,
    recordHashtagVisit,
    recordCategoryVisit,
    recordTakeEngagement,
    getTopInterests,
    getSignalSummary,
    rankForYou,
  };
})();
