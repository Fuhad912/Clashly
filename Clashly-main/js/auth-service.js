(function () {
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

  async function signUpWithEmail(email, password, redirectTo) {
    const client = getClientOrThrow();
    const payload = {
      email,
      password,
    };

    if (redirectTo) {
      payload.options = {
        emailRedirectTo: redirectTo,
      };
    }

    return client.auth.signUp(payload);
  }

  async function signInWithEmail(email, password) {
    const client = getClientOrThrow();
    return client.auth.signInWithPassword({
      email,
      password,
    });
  }

  async function signInWithOAuthProvider(provider, redirectTo) {
    const client = getClientOrThrow();
    const options = {};

    if (provider === "google") {
      options.queryParams = {
        prompt: "select_account",
      };
    }

    if (redirectTo) {
      options.redirectTo = redirectTo;
    }

    return client.auth.signInWithOAuth({
      provider,
      options,
    });
  }

  async function signInWithGoogle(redirectTo) {
    return signInWithOAuthProvider("google", redirectTo);
  }

  async function signInWithX(redirectTo) {
    return signInWithOAuthProvider("x", redirectTo);
  }

  async function signOut() {
    const client = getClientOrThrow();
    return client.auth.signOut();
  }

  async function sendEmailOtp(email, shouldCreateUser) {
    const client = getClientOrThrow();
    return client.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: Boolean(shouldCreateUser),
      },
    });
  }

  async function verifyEmailOtp(email, token, type) {
    const client = getClientOrThrow();
    return client.auth.verifyOtp({
      email,
      token,
      type: type || "email",
    });
  }

  async function resendSignupOtp(email) {
    const client = getClientOrThrow();
    return client.auth.resend({
      type: "signup",
      email,
    });
  }

  async function requestPasswordReset(email, redirectTo) {
    const client = getClientOrThrow();
    return client.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
  }

  async function updatePassword(password) {
    const client = getClientOrThrow();
    return client.auth.updateUser({
      password,
    });
  }

  async function updateEmail(email) {
    const client = getClientOrThrow();
    return client.auth.updateUser({
      email,
    });
  }

  async function deleteOwnAccount() {
    const client = getClientOrThrow();
    return client.rpc("delete_own_account");
  }

  async function exchangeCodeForSession(code) {
    const client = getClientOrThrow();
    return client.auth.exchangeCodeForSession(code);
  }

  async function getSession() {
    const client = getClientOrThrow();
    const { data, error } = await client.auth.getSession();
    return {
      session: data ? data.session : null,
      error,
    };
  }

  async function getCurrentUser() {
    const client = getClientOrThrow();
    const { data, error } = await client.auth.getUser();
    return {
      user: data ? data.user : null,
      error,
    };
  }

  function getUserProviders(user) {
    const providers = new Set();

    if (user && user.app_metadata && typeof user.app_metadata.provider === "string") {
      providers.add(user.app_metadata.provider.toLowerCase());
    }

    if (user && user.app_metadata && Array.isArray(user.app_metadata.providers)) {
      user.app_metadata.providers.forEach((provider) => {
        if (typeof provider === "string" && provider.trim()) {
          providers.add(provider.toLowerCase());
        }
      });
    }

    if (user && Array.isArray(user.identities)) {
      user.identities.forEach((identity) => {
        if (identity && typeof identity.provider === "string" && identity.provider.trim()) {
          providers.add(identity.provider.toLowerCase());
        }
      });
    }

    return Array.from(providers);
  }

  function isGmailAddress(email) {
    return /@gmail\.com$/i.test(String(email || "").trim());
  }

  function canChangePassword(user) {
    const providers = getUserProviders(user);
    return providers.includes("email") && isGmailAddress(user && user.email);
  }

  function canChangeEmail(user) {
    const providers = getUserProviders(user);
    return providers.includes("email") && isGmailAddress(user && user.email);
  }

  function onAuthStateChange(callback) {
    const client = getClientOrThrow();
    return client.auth.onAuthStateChange(callback);
  }

  window.ClashlyAuth = {
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle,
    signInWithX,
    signOut,
    sendEmailOtp,
    verifyEmailOtp,
    resendSignupOtp,
    requestPasswordReset,
    updatePassword,
    updateEmail,
    deleteOwnAccount,
    exchangeCodeForSession,
    getSession,
    getCurrentUser,
    getUserProviders,
    isGmailAddress,
    canChangePassword,
    canChangeEmail,
    onAuthStateChange,
  };
})();
