(function () {
  const TAKES_TABLE = "takes";
  const PROFILES_TABLE = "profiles";
  const TAKE_HASHTAGS_TABLE = "take_hashtags";
  const HASHTAGS_TABLE = "hashtags";
  const VOTES_TABLE = "votes";

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

  function normalizeQuery(query) {
    return String(query || "").trim();
  }

  function normalizeHashtagQuery(query) {
    return normalizeQuery(query)
      .replace(/^#/, "")
      .trim()
      .toLowerCase();
  }

  async function searchUsers(query, options) {
    const client = getClientOrThrow();
    const safeQuery = normalizeQuery(query).toLowerCase();
    const limit = options && options.limit ? options.limit : 8;

    if (!safeQuery) {
      return { users: [], error: null };
    }

    const result = await client
      .from(PROFILES_TABLE)
      .select("id, username, bio, avatar_url")
      .ilike("username", `%${safeQuery}%`)
      .order("username", { ascending: true })
      .limit(limit);

    return {
      users: result.data || [],
      error: result.error,
    };
  }

  async function searchHashtags(query, options) {
    const client = getClientOrThrow();
    const safeQuery = normalizeHashtagQuery(query);
    const limit = options && options.limit ? options.limit : 8;

    if (!safeQuery) {
      return { hashtags: [], error: null };
    }

    const result = await client
      .from(HASHTAGS_TABLE)
      .select("id, tag")
      .ilike("tag", `%${safeQuery}%`)
      .order("tag", { ascending: true })
      .limit(limit);

    return {
      hashtags: result.data || [],
      error: result.error,
    };
  }

  async function searchAll(query, options) {
    const safeQuery = normalizeQuery(query);
    const currentUserId = options && options.currentUserId ? options.currentUserId : "";
    const takeLimit = options && options.takeLimit ? options.takeLimit : 8;
    const userLimit = options && options.userLimit ? options.userLimit : 8;
    const hashtagLimit = options && options.hashtagLimit ? options.hashtagLimit : 8;

    if (!safeQuery) {
      return {
        query: "",
        takes: [],
        users: [],
        hashtags: [],
        error: null,
      };
    }

    const [takesResult, usersResult, hashtagsResult] = await Promise.all([
      window.ClashlyTakes.searchTakes(safeQuery, {
        limit: takeLimit,
        currentUserId,
      }),
      searchUsers(safeQuery, {
        limit: userLimit,
      }),
      searchHashtags(safeQuery, {
        limit: hashtagLimit,
      }),
    ]);

    const error = takesResult.error || usersResult.error || hashtagsResult.error || null;
    return {
      query: safeQuery,
      takes: takesResult.takes || [],
      users: usersResult.users || [],
      hashtags: hashtagsResult.hashtags || [],
      error,
    };
  }

  async function fetchSuggestions(query, options) {
    return searchAll(query, {
      currentUserId: options && options.currentUserId ? options.currentUserId : "",
      takeLimit: options && options.takeLimit ? options.takeLimit : 3,
      userLimit: options && options.userLimit ? options.userLimit : 4,
      hashtagLimit: options && options.hashtagLimit ? options.hashtagLimit : 4,
    });
  }

  function buildTrendingMeta(windowHours, recentTakeLimit) {
    return {
      windowHours,
      recentTakeLimit,
      ranking:
        "Trending topics are ranked from hashtagged takes created inside the recent time window, weighted by recent tagged-take count, recent vote activity on those takes, and how recently the latest tagged take was posted.",
    };
  }

  function calculateFreshnessWeight(createdAt, windowHours) {
    if (!createdAt) return 0;
    const ageHours = (Date.now() - new Date(createdAt).getTime()) / 36e5;
    if (ageHours <= 0) return 1.15;
    if (ageHours >= windowHours) return 0;
    return 0.35 + (1 - ageHours / windowHours) * 0.85;
  }

  async function fetchTrendingTopics(options) {
    const client = getClientOrThrow();
    const limit = options && options.limit ? options.limit : 6;
    const windowHours = options && options.windowHours ? options.windowHours : 168;
    const recentTakeLimit = options && options.recentTakeLimit ? options.recentTakeLimit : 250;
    const cutoffIso = new Date(Date.now() - windowHours * 36e5).toISOString();
    const meta = buildTrendingMeta(windowHours, recentTakeLimit);

    const recentTakesResult = await client
      .from(TAKES_TABLE)
      .select("id, created_at")
      .gte("created_at", cutoffIso)
      .order("created_at", { ascending: false })
      .limit(recentTakeLimit);

    if (recentTakesResult.error) {
      return { topics: [], error: recentTakesResult.error, meta };
    }

    const recentTakes = recentTakesResult.data || [];
    if (!recentTakes.length) {
      return { topics: [], error: null, meta };
    }

    const takeIds = recentTakes.map((take) => take.id);
    const [takeHashtagsResult, votesResult] = await Promise.all([
      client.from(TAKE_HASHTAGS_TABLE).select("take_id, hashtag_id").in("take_id", takeIds),
      client.from(VOTES_TABLE).select("take_id").in("take_id", takeIds),
    ]);

    if (takeHashtagsResult.error) {
      return { topics: [], error: takeHashtagsResult.error, meta };
    }

    const takeHashtags = takeHashtagsResult.data || [];
    if (!takeHashtags.length) {
      return { topics: [], error: null, meta };
    }

    const hashtagIds = Array.from(new Set(takeHashtags.map((entry) => entry.hashtag_id).filter(Boolean)));
    if (!hashtagIds.length) {
      return { topics: [], error: null, meta };
    }

    const hashtagsResult = await client.from(HASHTAGS_TABLE).select("id, tag").in("id", hashtagIds);
    if (hashtagsResult.error) {
      return { topics: [], error: hashtagsResult.error, meta };
    }

    const hashtagsById = new Map((hashtagsResult.data || []).map((hashtag) => [hashtag.id, hashtag]));
    const takesById = new Map(recentTakes.map((take) => [take.id, take]));
    const voteCountsByTakeId = new Map();

    if (!votesResult.error) {
      (votesResult.data || []).forEach((vote) => {
        voteCountsByTakeId.set(vote.take_id, (voteCountsByTakeId.get(vote.take_id) || 0) + 1);
      });
    }

    const topicMap = new Map();

    takeHashtags.forEach((entry) => {
      const hashtag = hashtagsById.get(entry.hashtag_id);
      const take = takesById.get(entry.take_id);

      if (!hashtag || !take) {
        return;
      }

      let topic = topicMap.get(hashtag.id);
      if (!topic) {
        topic = {
          id: hashtag.id,
          tag: hashtag.tag,
          takeIds: new Set(),
          takeCount: 0,
          engagementCount: 0,
          latestAt: "",
          score: 0,
        };
        topicMap.set(hashtag.id, topic);
      }

      if (topic.takeIds.has(take.id)) {
        return;
      }

      const voteCount = voteCountsByTakeId.get(take.id) || 0;
      const freshnessWeight = calculateFreshnessWeight(take.created_at, windowHours);

      topic.takeIds.add(take.id);
      topic.takeCount += 1;
      topic.engagementCount += voteCount;
      if (!topic.latestAt || new Date(take.created_at).getTime() > new Date(topic.latestAt).getTime()) {
        topic.latestAt = take.created_at;
      }
      topic.score += freshnessWeight * (5 + voteCount * 0.65);
    });

    const topics = Array.from(topicMap.values())
      .map((topic) => ({
        id: topic.id,
        tag: topic.tag,
        takeCount: topic.takeCount,
        engagementCount: topic.engagementCount,
        latestAt: topic.latestAt,
        score: Number(topic.score.toFixed(3)),
      }))
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        if (right.takeCount !== left.takeCount) return right.takeCount - left.takeCount;
        if (right.engagementCount !== left.engagementCount) return right.engagementCount - left.engagementCount;
        return new Date(right.latestAt).getTime() - new Date(left.latestAt).getTime();
      })
      .slice(0, limit);

    return {
      topics,
      error: null,
      meta,
    };
  }

  window.ClashlySearch = {
    normalizeQuery,
    normalizeHashtagQuery,
    searchUsers,
    searchHashtags,
    searchAll,
    fetchSuggestions,
    fetchTrendingTopics,
  };
})();
