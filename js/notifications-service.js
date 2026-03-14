(function () {
  const NOTIFICATIONS_TABLE = "notifications";
  const TYPES = new Set(["follow", "comment", "reply", "bookmark", "comment_like"]);
  const DEFAULT_LIMIT = 25;
  const MAX_LIMIT = 60;
  const CACHE_TTL_MS = 15_000;
  const notificationsCache = new Map();

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

  function normalizeType(type) {
    const safeType = String(type || "").trim().toLowerCase();
    return TYPES.has(safeType) ? safeType : "";
  }

  function clampLimit(limit) {
    const numeric = Number(limit || DEFAULT_LIMIT);
    if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_LIMIT;
    return Math.max(1, Math.min(MAX_LIMIT, Math.floor(numeric)));
  }

  function normalizeCursor(cursor) {
    if (!cursor || typeof cursor !== "object") return null;
    const createdAt = String(cursor.created_at || "").trim();
    const id = String(cursor.id || "").trim();
    if (!createdAt || !id) return null;
    return {
      created_at: createdAt,
      id,
    };
  }

  function buildNextCursor(rows, limit) {
    if (!rows.length || rows.length < limit) return null;
    const last = rows[rows.length - 1];
    if (!last || !last.created_at || !last.id) return null;
    return {
      created_at: last.created_at,
      id: last.id,
    };
  }

  function isMissingRpcFunction(error, fnName) {
    if (!error) return false;
    const code = String(error.code || "");
    const message = String(error.message || "").toLowerCase();
    return (
      code === "42883" ||
      message.includes(`function public.${String(fnName || "").toLowerCase()}`) ||
      message.includes(`function ${String(fnName || "").toLowerCase()}`)
    );
  }

  function getCachedNotifications(cacheKey) {
    const cacheEntry = notificationsCache.get(cacheKey);
    if (!cacheEntry) return null;
    if (Date.now() - cacheEntry.at > CACHE_TTL_MS) {
      notificationsCache.delete(cacheKey);
      return null;
    }
    return cacheEntry.value;
  }

  function setCachedNotifications(cacheKey, payload) {
    notificationsCache.set(cacheKey, {
      at: Date.now(),
      value: payload,
    });
  }

  function invalidateNotificationCacheForUser(userId) {
    const safeUserId = String(userId || "").trim();
    if (!safeUserId) return;
    Array.from(notificationsCache.keys()).forEach((cacheKey) => {
      if (cacheKey.startsWith(`${safeUserId}|`)) {
        notificationsCache.delete(cacheKey);
      }
    });
  }

  async function fetchProfilesByIds(userIds) {
    if (!userIds.length) {
      return { profiles: [], error: null };
    }

    const client = getClientOrThrow();
    const result = await client
      .from("profiles")
      .select("id, username, avatar_url")
      .in("id", userIds);

    return {
      profiles: result.data || [],
      error: result.error,
    };
  }

  async function fetchTakesByIds(takeIds) {
    if (!takeIds.length) {
      return { takes: [], error: null };
    }

    const client = getClientOrThrow();
    const result = await client
      .from("takes")
      .select("id, content")
      .in("id", takeIds);

    return {
      takes: result.data || [],
      error: result.error,
    };
  }

  async function fetchCommentsByIds(commentIds) {
    if (!commentIds.length) {
      return { comments: [], error: null };
    }

    const client = getClientOrThrow();
    const result = await client
      .from("comments")
      .select("id, take_id")
      .in("id", commentIds);

    return {
      comments: result.data || [],
      error: result.error,
    };
  }

  function buildHref(notification) {
    if (!notification) return "notifications.html";

    if (notification.type === "follow") {
      return `profile.html?id=${encodeURIComponent(notification.actor_id)}`;
    }

    const targetTakeId = String(notification.target_take_id || "").trim();
    const targetCommentId = String(notification.target_comment_id || "").trim();

    if (notification.type === "comment_like") {
      if (!targetTakeId) return "notifications.html";
      const takeUrl = `take.html?id=${encodeURIComponent(targetTakeId)}`;
      return targetCommentId ? `${takeUrl}&commentId=${encodeURIComponent(targetCommentId)}` : takeUrl;
    }

    if (targetTakeId) {
      return `take.html?id=${encodeURIComponent(targetTakeId)}`;
    }

    if (notification.target_id) {
      return `take.html?id=${encodeURIComponent(notification.target_id)}`;
    }

    return "notifications.html";
  }

  function buildMessage(notification) {
    const username = notification.actor && notification.actor.username ? `@${notification.actor.username}` : "@user";
    const messages = {
      follow: `${username} followed you.`,
      comment: `${username} commented on your take.`,
      reply: `${username} replied to your comment.`,
      bookmark: `${username} saved your take.`,
      comment_like: `${username} liked your comment.`,
    };

    return messages[notification.type] || `${username} interacted with your account.`;
  }

  function buildSnippet(notification) {
    if (!notification.take || !notification.take.content) return "";
    const text = String(notification.take.content).trim();
    if (text.length <= 120) return text;
    return `${text.slice(0, 117)}...`;
  }

  function mapRowsToNotifications(rows) {
    return (rows || []).map((row) => {
      const actor = row.actor_username
        ? {
            id: row.actor_id,
            username: row.actor_username,
            avatar_url: row.actor_avatar_url || "",
          }
        : null;
      const take = row.take_content
        ? {
            id: row.target_take_id || row.target_id,
            content: row.take_content,
          }
        : null;
      const notification = {
        id: row.id,
        user_id: row.user_id,
        actor_id: row.actor_id,
        type: row.type,
        target_id: row.target_id,
        target_take_id: row.target_take_id || (row.type === "comment_like" ? "" : row.target_id),
        target_comment_id: row.target_comment_id || (row.type === "comment_like" ? row.target_id : null),
        is_read: Boolean(row.is_read),
        created_at: row.created_at,
        actor,
        take,
      };

      return {
        ...notification,
        href: buildHref(notification),
        message: buildMessage(notification),
        snippet: buildSnippet(notification),
      };
    });
  }

  async function createNotification(input) {
    const safeType = normalizeType(input.type);
    if (!safeType) {
      return { notification: null, error: new Error("Notification type is invalid.") };
    }

    const userId = String(input.userId || "").trim();
    const actorId = String(input.actorId || "").trim();
    const targetId = String(input.targetId || "").trim();

    if (!userId || !actorId) {
      return { notification: null, error: new Error("Notification is missing required users.") };
    }

    if (userId === actorId) {
      return { notification: null, error: null, skipped: true };
    }

    const client = getClientOrThrow();
    const result = await client
      .from(NOTIFICATIONS_TABLE)
      .insert({
        user_id: userId,
        actor_id: actorId,
        type: safeType,
        target_id: targetId || null,
      })
      .select("id, user_id, actor_id, type, target_id, is_read, created_at")
      .single();

    if (result.error && result.error.code === "23505") {
      return {
        notification: null,
        error: null,
        skipped: true,
      };
    }

    if (!result.error) {
      invalidateNotificationCacheForUser(userId);
    }

    return {
      notification: result.data || null,
      error: result.error,
      skipped: false,
    };
  }

  async function fetchNotifications(userId, options) {
    const safeUserId = String(userId || "").trim();
    const limit = clampLimit(options && options.limit);
    const cursor = normalizeCursor(options && options.cursor);
    if (!safeUserId) {
      return { notifications: [], nextCursor: null, hasMore: false, error: new Error("User ID is required.") };
    }

    const cacheKey = `${safeUserId}|${limit}`;
    if (!cursor) {
      const cached = getCachedNotifications(cacheKey);
      if (cached) return cached;
    }

    const client = getClientOrThrow();
    const rpcResult = await client.rpc("get_notifications_page", {
      p_user_id: safeUserId,
      p_limit: limit,
      p_before_created_at: cursor ? cursor.created_at : null,
      p_before_id: cursor ? cursor.id : null,
    });

    if (!rpcResult.error) {
      const rows = rpcResult.data || [];
      const nextCursor = buildNextCursor(rows, limit);
      const payload = {
        notifications: mapRowsToNotifications(rows),
        nextCursor,
        hasMore: Boolean(nextCursor),
        error: null,
      };

      if (!cursor) {
        setCachedNotifications(cacheKey, payload);
      }
      return payload;
    }

    if (!isMissingRpcFunction(rpcResult.error, "get_notifications_page")) {
      return {
        notifications: [],
        nextCursor: null,
        hasMore: false,
        error: rpcResult.error,
      };
    }

    let queryBuilder = client
      .from(NOTIFICATIONS_TABLE)
      .select("id, user_id, actor_id, type, target_id, is_read, created_at")
      .eq("user_id", safeUserId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit);

    if (cursor) {
      queryBuilder = queryBuilder.lt("created_at", cursor.created_at);
    }

    const result = await queryBuilder;
    if (result.error) {
      return { notifications: [], nextCursor: null, hasMore: false, error: result.error };
    }

    const rows = result.data || [];
    const actorIds = [...new Set(rows.map((row) => row.actor_id).filter(Boolean))];
    const commentTargetIds = [
      ...new Set(rows.filter((row) => row.type === "comment_like" && row.target_id).map((row) => row.target_id)),
    ];

    const [profilesResult, commentsResult] = await Promise.all([fetchProfilesByIds(actorIds), fetchCommentsByIds(commentTargetIds)]);
    if (profilesResult.error) {
      return { notifications: [], nextCursor: null, hasMore: false, error: profilesResult.error };
    }
    if (commentsResult.error) {
      return { notifications: [], nextCursor: null, hasMore: false, error: commentsResult.error };
    }

    const commentMap = new Map((commentsResult.comments || []).map((comment) => [comment.id, comment]));
    const directTakeIds = rows
      .filter((row) => row.type !== "follow" && row.type !== "comment_like" && row.target_id)
      .map((row) => row.target_id);
    const commentTakeIds = (commentsResult.comments || []).map((comment) => comment.take_id).filter(Boolean);
    const takeIds = [...new Set(directTakeIds.concat(commentTakeIds))];

    const takesResult = await fetchTakesByIds(takeIds);
    if (takesResult.error) {
      return { notifications: [], nextCursor: null, hasMore: false, error: takesResult.error };
    }

    const profileMap = new Map((profilesResult.profiles || []).map((profile) => [profile.id, profile]));
    const takeMap = new Map((takesResult.takes || []).map((take) => [take.id, take]));

    const notifications = rows.map((row) => {
      const actor = profileMap.get(row.actor_id) || null;
      const targetTakeId =
        row.type === "comment_like"
          ? ((commentMap.get(row.target_id) && commentMap.get(row.target_id).take_id) || "")
          : row.target_id || "";
      const targetCommentId = row.type === "comment_like" ? row.target_id || "" : null;
      const take = targetTakeId ? takeMap.get(targetTakeId) || null : null;
      const notification = {
        ...row,
        target_take_id: targetTakeId || null,
        target_comment_id: targetCommentId,
        actor,
        take,
      };
      return {
        ...notification,
        href: buildHref(notification),
        message: buildMessage(notification),
        snippet: buildSnippet(notification),
      };
    });

    const nextCursor = buildNextCursor(rows, limit);
    const payload = {
      notifications,
      nextCursor,
      hasMore: Boolean(nextCursor),
      error: null,
    };

    if (!cursor) {
      setCachedNotifications(cacheKey, payload);
    }

    return payload;
  }

  async function markNotificationsRead(userId, notificationIds) {
    const ids = [...new Set((notificationIds || []).filter(Boolean))];
    if (!userId || !ids.length) {
      return { error: null };
    }

    const client = getClientOrThrow();
    const result = await client
      .from(NOTIFICATIONS_TABLE)
      .update({ is_read: true })
      .eq("user_id", userId)
      .in("id", ids);

    if (!result.error) {
      invalidateNotificationCacheForUser(userId);
    }

    return {
      error: result.error,
    };
  }

  window.ClashlyNotifications = {
    NOTIFICATIONS_TABLE,
    createNotification,
    fetchNotifications,
    markNotificationsRead,
  };
})();
