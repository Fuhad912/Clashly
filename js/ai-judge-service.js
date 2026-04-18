(function () {
  const FUNCTION_NAME = "ai-judge";
  const ALLOWED_STATUS = new Set(["fresh", "cached", "not_eligible"]);
  const ALLOWED_VERDICTS = new Set(["Agree leaning", "Disagree leaning", "Too close to call"]);
  const ALLOWED_CONFIDENCE = new Set(["Low", "Medium", "High"]);

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

  function safeString(value) {
    return String(value || "").trim();
  }

  function safeNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function normalizeTopPick(value) {
    if (!value || typeof value !== "object") return null;
    const commentId = safeString(value.commentId);
    const excerpt = safeString(value.excerpt);
    if (!commentId || !excerpt) return null;
    return {
      commentId,
      excerpt,
    };
  }

  function normalizeJudgeResult(value) {
    if (!value || typeof value !== "object") return null;
    const verdict = safeString(value.verdict);
    const confidence = safeString(value.confidence);
    const reason = safeString(value.reason);
    if (!ALLOWED_VERDICTS.has(verdict) || !ALLOWED_CONFIDENCE.has(confidence) || !reason) return null;

    return {
      verdict,
      confidence,
      reason,
      agreeTop: normalizeTopPick(value.agreeTop),
      disagreeTop: normalizeTopPick(value.disagreeTop),
      analyzedAt: safeString(value.analyzedAt),
      model: safeString(value.model),
    };
  }

  function normalizeEligibility(value) {
    if (!value || typeof value !== "object") {
      return {
        eligible: false,
        reason: "Not enough debate yet for AI Judge.",
        metrics: null,
        thresholds: null,
      };
    }

    const metrics = value.metrics && typeof value.metrics === "object"
      ? {
          totalVotes: safeNumber(value.metrics.totalVotes),
          totalComments: safeNumber(value.metrics.totalComments),
          agreeVotes: safeNumber(value.metrics.agreeVotes),
          disagreeVotes: safeNumber(value.metrics.disagreeVotes),
        }
      : null;

    const thresholds = value.thresholds && typeof value.thresholds === "object"
      ? {
          minVotes: safeNumber(value.thresholds.minVotes),
          minComments: safeNumber(value.thresholds.minComments),
        }
      : null;

    return {
      eligible: Boolean(value.eligible),
      reason: safeString(value.reason),
      metrics,
      thresholds,
    };
  }

  function normalizeResponse(payload) {
    const status = safeString(payload && payload.status);
    if (!ALLOWED_STATUS.has(status)) {
      throw new Error("AI Judge returned an unexpected response.");
    }

    const eligibility = normalizeEligibility(payload && payload.eligibility);
    const result = normalizeJudgeResult(payload && payload.result);

    if ((status === "fresh" || status === "cached") && !result) {
      throw new Error("AI Judge result is missing.");
    }

    return {
      status,
      eligibility,
      result,
    };
  }

  async function analyzeTake(takeId) {
    const safeTakeId = safeString(takeId);
    if (!safeTakeId) {
      return { data: null, error: new Error("Take ID is required.") };
    }

    const client = getClientOrThrow();
    const response = await client.functions.invoke(FUNCTION_NAME, {
      body: {
        takeId: safeTakeId,
      },
    });

    if (response.error) {
      return {
        data: null,
        error: response.error,
      };
    }

    try {
      return {
        data: normalizeResponse(response.data || {}),
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error,
      };
    }
  }

  window.ClashlyAiJudge = {
    FUNCTION_NAME,
    analyzeTake,
  };
})();
