(function () {
  const COMMENTS_TABLE = "comments";

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

  function sanitizeContent(content) {
    return String(content || "").trim();
  }

  function validateCommentContent(content) {
    const safeContent = sanitizeContent(content);
    if (!safeContent) {
      return "Comment cannot be empty.";
    }

    return "";
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

  function sortRows(rows, sort) {
    const direction = sort === "oldest" ? 1 : -1;
    return [...rows].sort((a, b) => direction * (new Date(a.created_at) - new Date(b.created_at)));
  }

  function buildThread(rows, profiles, currentUserId, sort) {
    const profileMap = new Map();
    profiles.forEach((profile) => {
      profileMap.set(profile.id, profile);
    });

    const commentMap = new Map();
    rows.forEach((row) => {
      commentMap.set(row.id, {
        ...row,
        profile: profileMap.get(row.user_id) || null,
        is_owner: Boolean(currentUserId && row.user_id === currentUserId),
        replies: [],
      });
    });

    const roots = [];
    sortRows(rows, sort).forEach((row) => {
      const comment = commentMap.get(row.id);
      if (!comment) return;

      if (row.parent_id && commentMap.has(row.parent_id)) {
        commentMap.get(row.parent_id).replies.push(comment);
      } else {
        roots.push(comment);
      }
    });

    const normalizeReplies = (items) =>
      items.map((item) => ({
        ...item,
        replies: normalizeReplies(sortRows(item.replies, sort)),
      }));

    return normalizeReplies(roots);
  }

  async function fetchCommentsByTake(takeId, options) {
    const client = getClientOrThrow();
    const safeSort = options && options.sort === "oldest" ? "oldest" : "newest";
    const currentUserId = options && options.currentUserId ? options.currentUserId : "";

    const result = await client
      .from(COMMENTS_TABLE)
      .select("id, user_id, take_id, parent_id, content, created_at")
      .eq("take_id", takeId)
      .order("created_at", { ascending: safeSort === "oldest" });

    if (result.error) {
      return { comments: [], count: 0, error: result.error };
    }

    const rows = result.data || [];
    const userIds = [...new Set(rows.map((row) => row.user_id))];
    const profilesResult = await fetchProfilesByIds(userIds);
    if (profilesResult.error) {
      return { comments: [], count: 0, error: profilesResult.error };
    }

    return {
      comments: buildThread(rows, profilesResult.profiles || [], currentUserId, safeSort),
      count: rows.length,
      error: null,
    };
  }

  async function createComment(input) {
    const client = getClientOrThrow();
    const safeContent = sanitizeContent(input.content);
    const validationError = validateCommentContent(safeContent);
    if (validationError) {
      return { comment: null, error: new Error(validationError) };
    }

    const payload = {
      user_id: input.userId,
      take_id: input.takeId,
      parent_id: input.parentId || null,
      content: safeContent,
    };

    const result = await client
      .from(COMMENTS_TABLE)
      .insert(payload)
      .select("id, user_id, take_id, parent_id, content, created_at")
      .single();

    return {
      comment: result.data || null,
      error: result.error,
    };
  }

  async function deleteComment(input) {
    const client = getClientOrThrow();
    const result = await client
      .from(COMMENTS_TABLE)
      .delete()
      .eq("id", input.commentId)
      .eq("user_id", input.userId);

    return {
      error: result.error,
    };
  }

  window.ClashlyComments = {
    COMMENTS_TABLE,
    validateCommentContent,
    fetchCommentsByTake,
    createComment,
    deleteComment,
  };
})();
