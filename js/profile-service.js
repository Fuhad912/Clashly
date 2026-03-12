(function () {
  const PROFILES_TABLE = "profiles";
  const AVATAR_BUCKET = "avatars";
  const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
  const ALLOWED_GENDERS = ["female", "male", "non_binary", "prefer_not_to_say", "other"];

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

  function normalizeUsername(username) {
    return (username || "").trim().toLowerCase();
  }

  function isUsernameValid(username) {
    return USERNAME_PATTERN.test(normalizeUsername(username));
  }

  function initialsFromUsername(username) {
    const safe = (username || "clashly").replace("@", "").trim();
    return safe.slice(0, 2).toUpperCase();
  }

  async function getProfileById(userId) {
    const client = getClientOrThrow();
    const { data, error } = await client
      .from(PROFILES_TABLE)
      .select("id, username, bio, date_of_birth, gender, avatar_url, created_at")
      .eq("id", userId)
      .maybeSingle();

    return { profile: data, error };
  }

  async function getProfileByUsername(username) {
    const client = getClientOrThrow();
    const normalized = normalizeUsername(username);
    const { data, error } = await client
      .from(PROFILES_TABLE)
      .select("id, username, bio, date_of_birth, gender, avatar_url, created_at")
      .eq("username", normalized)
      .maybeSingle();

    return { profile: data, error };
  }

  async function hasCompletedProfile(userId) {
    const { profile, error } = await getProfileById(userId);
    if (error) {
      return { completed: false, error };
    }

    return {
      completed: Boolean(profile && profile.username),
      profile,
      error: null,
    };
  }

  async function isUsernameAvailable(username, currentUserId) {
    const normalized = normalizeUsername(username);
    const client = getClientOrThrow();
    const { data, error } = await client
      .from(PROFILES_TABLE)
      .select("id")
      .eq("username", normalized)
      .maybeSingle();

    if (error) {
      return { available: false, error };
    }

    if (!data) {
      return { available: true, error: null };
    }

    return {
      available: data.id === currentUserId,
      error: null,
    };
  }

  async function uploadAvatar(file, userId) {
    if (!file) return { avatarUrl: "", error: null };

    const client = getClientOrThrow();
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${userId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await client.storage.from(AVATAR_BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type || "image/jpeg",
    });

    if (uploadError) {
      return { avatarUrl: "", error: uploadError };
    }

    const { data } = client.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    return {
      avatarUrl: data ? data.publicUrl : "",
      error: null,
    };
  }

  async function upsertProfile(input) {
    const client = getClientOrThrow();
    const normalizedUsername = normalizeUsername(input.username);
    const safeBio = (input.bio || "").trim();
    const resolvedDateOfBirth = (input.dateOfBirth || "").trim();
    const normalizedGender = (input.gender || "prefer_not_to_say").trim();

    const payload = {
      id: input.userId,
      username: normalizedUsername,
      bio: safeBio || null,
      date_of_birth: resolvedDateOfBirth || null,
      gender: ALLOWED_GENDERS.includes(normalizedGender) ? normalizedGender : "prefer_not_to_say",
      avatar_url: input.avatarUrl || null,
    };

    const { data, error } = await client
      .from(PROFILES_TABLE)
      .upsert(payload, { onConflict: "id" })
      .select("id, username, bio, date_of_birth, gender, avatar_url, created_at")
      .single();

    return { profile: data, error };
  }

  window.ClashlyProfiles = {
    PROFILES_TABLE,
    AVATAR_BUCKET,
    normalizeUsername,
    isUsernameValid,
    initialsFromUsername,
    getProfileById,
    getProfileByUsername,
    hasCompletedProfile,
    isUsernameAvailable,
    uploadAvatar,
    upsertProfile,
  };
})();
