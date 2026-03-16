(function () {
  const PAGE_SIZE = 15;
  const SCROLL_THRESHOLD_PX = 900;
  const AI_JUDGE_MIN_VOTES = 20;
  const AI_JUDGE_MIN_COMMENTS = 6;
  let activeSection = "for-you";
  let currentUserId = "";
  let scrollQueued = false;
  const sectionState = {
    "for-you": {
      takes: [],
      cursor: null,
      hasMore: true,
      loaded: false,
      loading: false,
      meta: null,
    },
    following: {
      takes: [],
      cursor: null,
      hasMore: true,
      loaded: false,
      loading: false,
      meta: null,
    },
  };

  function setFeedState(message, type) {
    const stateEl = document.getElementById("feed-state");
    if (!stateEl) return;

    stateEl.hidden = !message;
    stateEl.textContent = message || "";
    stateEl.classList.remove("is-error", "is-success");
    if (type === "error") stateEl.classList.add("is-error");
    if (type === "success") stateEl.classList.add("is-success");
  }

  function ensureAiJudgeReasonModal() {
    let modal = document.getElementById("ai-judge-reason-modal");
    if (modal) return modal;

    modal = document.createElement("section");
    modal.id = "ai-judge-reason-modal";
    modal.className = "ai-judge-reason-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="ai-judge-reason-modal__backdrop" data-close-ai-judge-reason="true"></div>
      <article class="ai-judge-reason-modal__panel" role="dialog" aria-modal="true" aria-labelledby="ai-judge-reason-title">
        <h3 id="ai-judge-reason-title" class="ai-judge-reason-modal__title">AI Judge unavailable</h3>
        <p id="ai-judge-reason-text" class="ai-judge-reason-modal__text"></p>
        <div class="ai-judge-reason-modal__actions">
          <button type="button" class="btn btn--ghost" data-close-ai-judge-reason="true">Got it</button>
        </div>
      </article>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function closeAiJudgeReasonModal() {
    const modal = document.getElementById("ai-judge-reason-modal");
    if (!modal) return;
    modal.hidden = true;
  }

  function openAiJudgeReasonModal(message) {
    const modal = ensureAiJudgeReasonModal();
    const textEl = modal.querySelector("#ai-judge-reason-text");
    if (textEl) {
      textEl.textContent = String(message || "AI Judge cannot analyze this take yet.");
    }
    modal.hidden = false;
  }

  function bindAiJudgeReasonModal() {
    const modal = ensureAiJudgeReasonModal();
    modal.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-close-ai-judge-reason='true']")) {
        closeAiJudgeReasonModal();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) {
        closeAiJudgeReasonModal();
      }
    });
  }

  function getHashSection() {
    const hash = window.location.hash.replace("#", "").toLowerCase();
    if (hash === "following") return "following";
    return "for-you";
  }

  function getForYouEmptyMessage(meta) {
    if (meta && meta.hasSignals) {
      return "We're still building your For you mix. Keep searching, opening hashtags, and saving takes.";
    }

    return "No takes yet. Once the floor starts moving, your For you feed will build here.";
  }

  function getSectionState(section) {
    return sectionState[section === "following" ? "following" : "for-you"];
  }

  function resetSection(section) {
    const state = getSectionState(section);
    state.takes = [];
    state.cursor = null;
    state.hasMore = true;
    state.loaded = false;
    state.loading = false;
    state.meta = null;
  }

  function updateHeader() {
    const buttons = document.querySelectorAll("[data-home-tab]");
    buttons.forEach((button) => {
      const isActive = button.getAttribute("data-home-tab") === activeSection;
      button.classList.toggle("home-switch__btn--active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  function setActiveSection(nextSection) {
    activeSection = nextSection === "following" ? "following" : "for-you";
    updateHeader();
  }

  async function rankForYouFeed(takes) {
    if (!window.ClashePersonalization) {
      return {
        takes,
        meta: { hasSignals: false },
      };
    }

    return window.ClashePersonalization.rankForYou(takes, currentUserId);
  }

  function renderCurrentFeed() {
    const feedEl = document.getElementById("feed-stream");
    if (!feedEl) return;

    const state = getSectionState(activeSection);
    if (activeSection === "following" && !state.takes.length && state.loaded) {
      feedEl.innerHTML = `
        <section class="feed-empty-visual" aria-label="No following activity yet">
          <div class="feed-empty-visual__art" aria-hidden="true">
            <span class="feed-empty-visual__glow"></span>
            <img src="assets/clashly-mark.svg" alt="" class="feed-empty-visual__mark" />
          </div>
          <div class="feed-empty-visual__copy">
            <p class="feed-empty-visual__eyebrow">Following</p>
            <h2 class="feed-empty-visual__title">Oops, looks like you aren't following anyone.</h2>
            <p class="feed-empty-visual__text">Follow people to build a feed that only shows takes from accounts you care about.</p>
          </div>
        </section>
      `;
      return;
    }

    window.ClashlyTakeRenderer.renderTakeList(feedEl, state.takes, {
      currentUserId,
      showAiJudgeAction: true,
      emptyMessage: activeSection === "following" ? "" : "No takes yet. Be the first to post one.",
    });

    window.ClashlyTakeRenderer.bindShareActions(feedEl, {
      onStatus: setFeedState,
      onShare: handleShareOpen,
    });
    window.ClashlyTakeRenderer.bindVoteActions(feedEl, {
      onStatus: setFeedState,
      onVote: handleVote,
    });
    window.ClashlyTakeRenderer.bindBookmarkActions(feedEl, {
      onStatus: setFeedState,
      onBookmark: handleBookmark,
    });
    window.ClashlyTakeRenderer.bindCommentActions(feedEl, {
      onComments: handleCommentsOpen,
    });
    window.ClashlyTakeRenderer.bindAiJudgeActions(feedEl, {
      onStatus: setFeedState,
      onAiJudge: handleAiJudge,
    });
  }

  async function loadFeed(options) {
    const feedEl = document.getElementById("feed-stream");
    if (!feedEl) return;

    const state = getSectionState(activeSection);
    const append = Boolean(options && options.append);
    if (state.loading) return;
    if (append && !state.hasMore) return;

    state.loading = true;
    if (!append) {
      state.takes = [];
      state.cursor = null;
      state.hasMore = true;
      state.meta = null;
      setFeedState("", "");
      // Show skeleton immediately — hides blank screen while DB responds
      if (typeof window.clasheShowFeedSkeleton === "function") {
        window.clasheShowFeedSkeleton("feed-stream", 5);
      } else {
        feedEl.innerHTML = "";
      }
    }

    try {
      if (activeSection === "following") {
        const feedResult = await window.ClashlyTakes.fetchFollowingFeedTakes({
          limit: PAGE_SIZE,
          currentUserId,
          cursor: append ? state.cursor : null,
        });

        if (feedResult.error) throw feedResult.error;

        const incoming = feedResult.takes || [];
        state.takes = append ? state.takes.concat(incoming) : incoming;
        state.cursor = feedResult.nextCursor || null;
        state.hasMore = Boolean(feedResult.hasMore);
        state.meta = feedResult.meta || null;
        state.loaded = true;
        renderCurrentFeed();
        setFeedState("", "");
        return;
      }

      const feedResult = await window.ClashlyTakes.fetchFeedTakes({
        tab: "new",
        limit: PAGE_SIZE,
        currentUserId,
        cursor: append ? state.cursor : null,
      });

      if (feedResult.error) throw feedResult.error;

      const ranked = await rankForYouFeed(feedResult.takes || []);
      const incoming = ranked.takes || [];
      state.takes = append ? state.takes.concat(incoming) : incoming;
      state.cursor = feedResult.nextCursor || null;
      state.hasMore = Boolean(feedResult.hasMore);
      state.meta = ranked.meta || null;
      state.loaded = true;

      renderCurrentFeed();
      if (!state.takes.length) {
        setFeedState(getForYouEmptyMessage(ranked.meta), "");
        return;
      }
      setFeedState("", "");
    } catch (error) {
      setFeedState(window.ClashlyUtils.reportError("Home feed load failed.", error, "Could not load feed."), "error");
    } finally {
      state.loading = false;
    }
  }

  function updateTakeInAllSections(takeId, updater) {
    Object.keys(sectionState).forEach((key) => {
      const state = sectionState[key];
      state.takes = state.takes.map((take) => (take.id === takeId ? updater(take) : take));
    });
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

  function setTakeAiJudgeState(takeId, judgeState) {
    updateTakeInAllSections(takeId, (take) => ({
      ...take,
      ai_judge: judgeState,
    }));
    renderCurrentFeed();
  }

  function handleCommentsOpen(input) {
    const targetTake = getSectionState(activeSection).takes.find((take) => take.id === input.takeId) || null;
    if (currentUserId && targetTake && window.ClashePersonalization) {
      window.ClashePersonalization.recordTakeEngagement(currentUserId, targetTake, "comment").catch(() => {});
    }

    if (!window.ClashlyCommentsModal) {
      window.location.href = `take.html?id=${encodeURIComponent(input.takeId)}`;
      return;
    }

    window.ClashlyCommentsModal.open({
      takeId: input.takeId,
      take: targetTake,
      currentUserId,
    });
  }

  function handleShareOpen(input) {
    const targetTake = getSectionState(activeSection).takes.find((take) => take.id === input.takeId) || null;
    if (currentUserId && targetTake && window.ClashePersonalization) {
      window.ClashePersonalization.recordTakeEngagement(currentUserId, targetTake, "open").catch(() => {});
    }

    if (window.ClashlyShareModal) {
      window.ClashlyShareModal.open({
        take: targetTake,
      });
      return;
    }

    window.ClashlyUtils.copyText(input.shareUrl)
      .then(() => setFeedState("", ""))
      .catch((error) => setFeedState(window.ClashlyUtils.reportError("Fallback share failed.", error, "Could not copy link."), "error"));
  }

  function handleTakeUpdated(event) {
    const detail = event.detail || {};
    if (!detail.takeId || !detail.vote) return;
    updateTakeInAllSections(detail.takeId, (take) => ({
      ...take,
      vote: detail.vote,
      vote_loading: false,
    }));
    renderCurrentFeed();
  }

  function handleTakeBookmarkUpdated(event) {
    const detail = event.detail || {};
    if (!detail.takeId || typeof detail.bookmarked !== "boolean") return;
    updateTakeInAllSections(detail.takeId, (take) => ({
      ...take,
      bookmarked: detail.bookmarked,
    }));
    renderCurrentFeed();
  }

  async function handleVote(input) {
    if (!currentUserId) {
      setFeedState("Please log in to vote.", "error");
      window.setTimeout(() => {
        window.location.replace("auth.html");
      }, 250);
      return;
    }

    const activeState = getSectionState(activeSection);
    const target = activeState.takes.find((take) => take.id === input.takeId);
    if (!target || target.vote_loading) return;

    updateTakeInAllSections(input.takeId, (take) => ({
      ...take,
      vote_loading: true,
    }));
    renderCurrentFeed();

    try {
      const voteResult = await window.ClashlyTakes.submitVote({
        userId: currentUserId,
        takeId: input.takeId,
        voteType: input.voteType,
        currentVote: target.vote ? target.vote.user_vote : "",
      });

      if (voteResult.error) throw voteResult.error;

      if (window.ClashePersonalization) {
        window.ClashePersonalization.recordTakeEngagement(currentUserId, target, "vote").catch(() => {});
      }

      updateTakeInAllSections(input.takeId, (take) => ({
        ...take,
        vote_loading: false,
        vote: voteResult.vote,
      }));
      renderCurrentFeed();
      setFeedState("", "");
    } catch (error) {
      updateTakeInAllSections(input.takeId, (take) => ({
        ...take,
        vote_loading: false,
      }));
      renderCurrentFeed();
      throw error;
    }
  }

  async function handleBookmark(input) {
    if (!currentUserId) {
      setFeedState("Please log in to save takes.", "error");
      window.setTimeout(() => {
        window.location.replace("auth.html");
      }, 250);
      return;
    }

    const target = getSectionState(activeSection).takes.find((take) => take.id === input.takeId) || null;

    try {
      const result = await window.ClashlyTakes.toggleBookmark({
        userId: currentUserId,
        takeId: input.takeId,
        isBookmarked: input.isBookmarked,
      });

      if (result.error) throw result.error;

      if (result.bookmarked && target && window.ClashePersonalization) {
        window.ClashePersonalization.recordTakeEngagement(currentUserId, target, "bookmark").catch(() => {});
      }

      if (result.bookmarked && target && window.ClashlyNotifications) {
        window.ClashlyNotifications.createNotification({
          userId: target.user_id,
          actorId: currentUserId,
          type: "bookmark",
          targetId: target.id,
        }).catch(() => {});
      }

      updateTakeInAllSections(input.takeId, (take) => ({
        ...take,
        bookmarked: result.bookmarked,
      }));
      renderCurrentFeed();
      setFeedState("", "");
    } catch (error) {
      throw error;
    }
  }

  async function handleAiJudge(input) {
    if (!input || !input.takeId) return;
    if (!currentUserId) {
      setFeedState("Please log in to use AI Judge.", "error");
      window.setTimeout(() => {
        window.location.replace("auth.html");
      }, 250);
      return;
    }

    if (!window.ClashlyAiJudge) {
      setFeedState("AI Judge is unavailable right now. Please try again.", "error");
      return;
    }

    const target = getSectionState(activeSection).takes.find((take) => take.id === input.takeId) || null;
    if (!target) return;
    if (target.ai_judge && target.ai_judge.status === "loading") return;

    const eligibility = evaluateAiJudgeEligibility(target);
    if (!eligibility.eligible) {
      openAiJudgeReasonModal(eligibility.reason);
      return;
    }

    setTakeAiJudgeState(input.takeId, {
      status: "loading",
      message: "",
    });

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
        setTakeAiJudgeState(input.takeId, null);
        openAiJudgeReasonModal(reason);
        return;
      }

      if ((payload.status === "fresh" || payload.status === "cached") && payload.result) {
        setTakeAiJudgeState(input.takeId, {
          status: "ready",
          source: payload.status,
          result: payload.result,
        });
        setFeedState(payload.status === "cached" ? "Showing recent AI Judge analysis." : "", "");
        return;
      }

      throw new Error("Unexpected AI Judge response.");
    } catch (error) {
      setTakeAiJudgeState(input.takeId, {
        status: "error",
        message: "AI Judge is unavailable right now. Please try again.",
      });
      setFeedState(window.ClashlyUtils.reportError("Home AI Judge failed.", error, "AI Judge is unavailable right now. Please try again."), "error");
    }
  }

  async function handleHashChange() {
    const nextSection = getHashSection();
    setActiveSection(nextSection);
    resetSection(nextSection);
    await loadFeed({ append: false });
  }

  async function handleTakeCreated() {
    resetSection("for-you");
    setActiveSection("for-you");
    if (window.location.hash !== "#for-you") {
      window.location.hash = "for-you";
      return;
    }
    await loadFeed({ append: false });
  }

  function bindHomeSwitch() {
    const buttons = document.querySelectorAll("[data-home-tab]");
    buttons.forEach((button) => {
      button.addEventListener("click", async () => {
        const nextSection = button.getAttribute("data-home-tab") === "following" ? "following" : "for-you";
        if (nextSection === activeSection) {
          resetSection(nextSection);
          await loadFeed({ append: false });
          return;
        }
        setActiveSection(nextSection);
        window.location.hash = nextSection;
      });
    });
  }

  function shouldLoadMore() {
    const state = getSectionState(activeSection);
    if (!state.loaded || state.loading || !state.hasMore) return false;
    const viewportBottom = window.scrollY + window.innerHeight;
    const pageBottom = document.documentElement.scrollHeight;
    return viewportBottom >= pageBottom - SCROLL_THRESHOLD_PX;
  }

  function bindInfiniteScroll() {
    window.addEventListener(
      "scroll",
      () => {
        if (scrollQueued) return;
        scrollQueued = true;
        window.requestAnimationFrame(async () => {
          scrollQueued = false;
          if (!shouldLoadMore()) return;
          await loadFeed({ append: true });
        });
      },
      { passive: true }
    );
  }

  async function initFeedPage() {
    try {
      if (!window.ClashlyTakes || !window.ClashlyTakeRenderer || !window.ClashlySession) return;

      activeSection = getHashSection();
      const sessionState = await window.ClashlySession.resolveSession();
      currentUserId = sessionState.user ? sessionState.user.id : "";

      bindHomeSwitch();
      bindInfiniteScroll();
      bindAiJudgeReasonModal();
      setActiveSection(activeSection);

      if (window.ClashlyApp && window.ClashlyApp.createEventName) {
        window.addEventListener(window.ClashlyApp.createEventName, handleTakeCreated);
      }
      window.addEventListener("clashly:take-updated", handleTakeUpdated);
      window.addEventListener("clashly:take-bookmark-updated", handleTakeBookmarkUpdated);
      window.addEventListener("hashchange", handleHashChange);
      await loadFeed({ append: false });
    } finally {
      if (window.ClasheLoader) {
        window.ClasheLoader.release("page-data");
      }
    }
  }

  document.addEventListener("DOMContentLoaded", initFeedPage);
})();
