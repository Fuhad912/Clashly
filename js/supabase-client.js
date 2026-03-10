(function () {
  const URL_PLACEHOLDER = "https://YOUR_PROJECT_REF.supabase.co";
  const KEY_PLACEHOLDER = "YOUR_SUPABASE_ANON_KEY";
  let client = null;

  function getConfig() {
    const env = window.CLASHLY_ENV || {};
    return {
      url: env.SUPABASE_URL || URL_PLACEHOLDER,
      anonKey: env.SUPABASE_ANON_KEY || KEY_PLACEHOLDER,
    };
  }

  function looksLikePlaceholder(value) {
    return !value || value.includes("YOUR_PROJECT_REF") || value.includes("YOUR_SUPABASE_ANON_KEY");
  }

  function isValidSupabaseUrl(value) {
    return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(value);
  }

  function isLikelyJwt(value) {
    return typeof value === "string" && value.split(".").length === 3;
  }

  function isConfigured() {
    const config = getConfig();
    if (looksLikePlaceholder(config.url) || looksLikePlaceholder(config.anonKey)) return false;
    return isValidSupabaseUrl(config.url) && isLikelyJwt(config.anonKey);
  }

  function getClient() {
    if (client) return client;

    if (!isConfigured()) {
      console.warn(
        "[Clashly] Supabase config is invalid. Check SUPABASE_URL and SUPABASE_ANON_KEY in js/env.js."
      );
      return null;
    }

    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      console.warn("[Clashly] Supabase SDK missing. Load @supabase/supabase-js before app scripts.");
      return null;
    }

    const config = getConfig();
    client = window.supabase.createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    return client;
  }

  window.ClashlySupabase = {
    getClient,
    getConfig,
    isConfigured,
  };
})();
