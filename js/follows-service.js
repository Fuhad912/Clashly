(function () {
  const FOLLOWS_TABLE = "follows";

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

  function validatePair(followerId, followingId) {
    if (!followerId || !followingId) {
      return "Follow relationship is missing required users.";
    }

    if (followerId === followingId) {
      return "You cannot follow yourself.";
    }

    return "";
  }

  async function getFollowStats(userId) {
    const client = getClientOrThrow();
    const [followersResult, followingResult] = await Promise.all([
      client.from(FOLLOWS_TABLE).select("id", { count: "exact", head: true }).eq("following_id", userId),
      client.from(FOLLOWS_TABLE).select("id", { count: "exact", head: true }).eq("follower_id", userId),
    ]);

    return {
      followersCount: Number(followersResult.count || 0),
      followingCount: Number(followingResult.count || 0),
      error: followersResult.error || followingResult.error || null,
    };
  }

  async function isFollowing(followerId, followingId) {
    const validationError = validatePair(followerId, followingId);
    if (validationError) {
      return {
        isFollowing: false,
        error: validationError === "You cannot follow yourself." ? null : new Error(validationError),
      };
    }

    const client = getClientOrThrow();
    const result = await client
      .from(FOLLOWS_TABLE)
      .select("id")
      .eq("follower_id", followerId)
      .eq("following_id", followingId)
      .maybeSingle();

    return {
      isFollowing: Boolean(result.data && result.data.id),
      error: result.error,
    };
  }

  async function followUser(input) {
    const validationError = validatePair(input.followerId, input.followingId);
    if (validationError) {
      return { error: new Error(validationError) };
    }

    const client = getClientOrThrow();
    const result = await client.from(FOLLOWS_TABLE).insert({
      follower_id: input.followerId,
      following_id: input.followingId,
    });

    return {
      error: result.error,
    };
  }

  async function unfollowUser(input) {
    const validationError = validatePair(input.followerId, input.followingId);
    if (validationError) {
      return { error: new Error(validationError) };
    }

    const client = getClientOrThrow();
    const result = await client
      .from(FOLLOWS_TABLE)
      .delete()
      .eq("follower_id", input.followerId)
      .eq("following_id", input.followingId);

    return {
      error: result.error,
    };
  }

  async function fetchProfilesByIds(userIds) {
    if (!userIds.length) {
      return { profiles: [], error: null };
    }

    const client = getClientOrThrow();
    const result = await client
      .from("profiles")
      .select("id, username, bio, avatar_url")
      .in("id", userIds);

    return {
      profiles: result.data || [],
      error: result.error,
    };
  }

  async function fetchCurrentUserFollowingSet(currentUserId, userIds) {
    if (!currentUserId || !userIds.length) {
      return { followingSet: new Set(), error: null };
    }

    const client = getClientOrThrow();
    const result = await client
      .from(FOLLOWS_TABLE)
      .select("following_id")
      .eq("follower_id", currentUserId)
      .in("following_id", userIds);

    return {
      followingSet: new Set((result.data || []).map((row) => row.following_id)),
      error: result.error,
    };
  }

  async function fetchFollowList(mode, userId, currentUserId) {
    const client = getClientOrThrow();
    const isFollowers = mode === "followers";
    const selectColumn = isFollowers ? "follower_id" : "following_id";
    const filterColumn = isFollowers ? "following_id" : "follower_id";

    const relationResult = await client
      .from(FOLLOWS_TABLE)
      .select(`${selectColumn}, created_at`)
      .eq(filterColumn, userId)
      .order("created_at", { ascending: false });

    if (relationResult.error) {
      return { users: [], error: relationResult.error };
    }

    const rows = relationResult.data || [];
    const userIds = rows.map((row) => row[selectColumn]).filter(Boolean);
    const profilesResult = await fetchProfilesByIds(userIds);
    if (profilesResult.error) {
      return { users: [], error: profilesResult.error };
    }

    const followingState = await fetchCurrentUserFollowingSet(currentUserId, userIds);
    if (followingState.error) {
      return { users: [], error: followingState.error };
    }

    const profileMap = new Map();
    (profilesResult.profiles || []).forEach((profile) => {
      profileMap.set(profile.id, profile);
    });

    return {
      users: rows
        .map((row) => {
          const profile = profileMap.get(row[selectColumn]);
          if (!profile) return null;
          return {
            ...profile,
            is_self: Boolean(currentUserId && profile.id === currentUserId),
            is_following: Boolean(currentUserId && followingState.followingSet.has(profile.id)),
            relation_created_at: row.created_at,
          };
        })
        .filter(Boolean),
      error: null,
    };
  }

  window.ClashlyFollows = {
    getFollowStats,
    isFollowing,
    followUser,
    unfollowUser,
    fetchFollowList,
  };
})();
