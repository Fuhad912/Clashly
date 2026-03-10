(function () {
  let activeTab = "takes";
  let activeView = "list";
  let currentUser = null;
  let currentProfile = null;
  let currentTakes = [];
  let currentSavedTakes = [];
  let isOwnProfile = true;
  let isFollowing = false;
  let followStats = {
    followersCount: 0,
    followingCount: 0,
  };
  let currentFollowListMode = "followers";
  let currentFollowListUsers = [];

  function setMetaStatus(message, type) {
    const metaNote = document.getElementById("profile-meta-note");
    if (!metaNote) return;

    metaNote.hidden = !message;
    metaNote.textContent = message || "";
    metaNote.classList.remove("is-error", "is-success");
    if (type === "error") metaNote.classList.add("is-error");
    if (type === "success") metaNote.classList.add("is-success");
  }

  function setFeedState(message, type) {
    const stateEl = document.getElementById("profile-feed-state");
    if (!stateEl) return;

    stateEl.hidden = !message;
    stateEl.textContent = message || "";
    stateEl.classList.remove("is-error", "is-success");
    if (type === "error") stateEl.classList.add("is-error");
    if (type === "success") stateEl.classList.add("is-success");
  }

  function setFollowListState(message, type) {
    const stateEl = document.getElementById("follow-list-state");
    if (!stateEl) return;

    stateEl.hidden = !message;
    stateEl.textContent = message || "";
    stateEl.classList.remove("is-error", "is-success");
    if (type === "error") stateEl.classList.add("is-error");
    if (type === "success") stateEl.classList.add("is-success");
  }

  function renderAvatar(avatarEl, profile) {
    if (!avatarEl || !profile) return;

    if (profile.avatar_url) {
      avatarEl.innerHTML = `<img src="${profile.avatar_url}" alt="@${profile.username} profile photo" />`;
      return;
    }

    avatarEl.textContent = window.ClashlyProfiles.initialsFromUsername(profile.username);
  }

  function renderProfile(profile, email) {
    const usernameEl = document.getElementById("profile-username");
    const bioEl = document.getElementById("profile-bio");
    const avatarEl = document.getElementById("profile-avatar");
    const takesCountEl = document.getElementById("takes-count");
    const followersCountEl = document.getElementById("followers-count");
    const followingCountEl = document.getElementById("following-count");
    const username = profile && profile.username ? `@${profile.username}` : "@username";

    if (usernameEl) usernameEl.textContent = username;
    document.title = `Clashly | ${username}`;

    if (bioEl) {
      bioEl.textContent =
        profile && profile.bio
          ? profile.bio
          : "Add your profile bio from Edit profile to introduce your point of view.";
    }

    if (avatarEl) {
      renderAvatar(avatarEl, profile || { username: (email || "clashly").split("@")[0] });
    }

    if (takesCountEl) takesCountEl.textContent = String(currentTakes.length);
    if (followersCountEl) followersCountEl.textContent = String(followStats.followersCount);
    if (followingCountEl) followingCountEl.textContent = String(followStats.followingCount);
  }

  function renderActionButtons() {
    const editBtn = document.querySelector('.profile-head__actions a[href="profile-setup.html"]');
    const followBtn = document.getElementById("follow-trigger");
    if (!editBtn || !followBtn) return;

    if (isOwnProfile) {
      editBtn.classList.remove("is-hidden");
      followBtn.classList.add("is-hidden");
      return;
    }

    editBtn.classList.add("is-hidden");
    followBtn.classList.remove("is-hidden");
    followBtn.classList.toggle("is-following", isFollowing);
    followBtn.textContent = isFollowing ? "Following" : "Follow";
  }

  function getVoteTotals(takes) {
    return takes.reduce(
      (totals, take) => {
        const vote = take && take.vote ? take.vote : {};
        return {
          agree: totals.agree + Number(vote.agree_count || 0),
          disagree: totals.disagree + Number(vote.disagree_count || 0),
        };
      },
      { agree: 0, disagree: 0 }
    );
  }

  function getPinnedTake(takes) {
    if (!takes.length) return null;
    return [...takes].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  }

  function getMostControversialTake(takes) {
    const eligible = takes.filter((take) => {
      const vote = take && take.vote ? take.vote : {};
      return Number(vote.total_votes || 0) >= 4;
    });

    if (!eligible.length) return null;

    return [...eligible].sort((a, b) => {
      const voteA = a.vote || {};
      const voteB = b.vote || {};
      const totalA = Number(voteA.total_votes || 0);
      const totalB = Number(voteB.total_votes || 0);
      const closenessA = totalA ? 1 - Math.abs(Number(voteA.agree_count || 0) - Number(voteA.disagree_count || 0)) / totalA : 0;
      const closenessB = totalB ? 1 - Math.abs(Number(voteB.agree_count || 0) - Number(voteB.disagree_count || 0)) / totalB : 0;

      if (closenessB !== closenessA) return closenessB - closenessA;
      if (totalB !== totalA) return totalB - totalA;
      return new Date(b.created_at) - new Date(a.created_at);
    })[0];
  }

  function renderHighlightCard(container, take, emptyMessage, label) {
    if (!container) return;

    if (!take) {
      container.innerHTML = `<p class="profile-highlight__empty">${emptyMessage}</p>`;
      return;
    }

    const vote = take.vote || {};
    const metaTime = window.ClashlyUtils.formatRelativeTime(take.created_at);
    const stats = [
      `Agree ${Number(vote.agree_count || 0)}`,
      `Disagree ${Number(vote.disagree_count || 0)}`,
      `Votes ${Number(vote.total_votes || 0)}`,
    ];
    const contentMarkup =
      window.ClashlyUtils && typeof window.ClashlyUtils.linkifyHashtags === "function"
        ? window.ClashlyUtils.linkifyHashtags(take.content)
        : window.ClashlyUtils.escapeHtml(take.content);

    container.innerHTML = `
      <article class="profile-highlight__card">
        <div class="profile-highlight__meta">
          <strong>${window.ClashlyUtils.escapeHtml(label)}</strong>
          <span>${window.ClashlyUtils.escapeHtml(metaTime)}</span>
        </div>
        <p class="profile-highlight__text">${contentMarkup}</p>
        <div class="profile-highlight__stats">
          ${stats.map((stat) => `<span>${window.ClashlyUtils.escapeHtml(stat)}</span>`).join("")}
        </div>
      </article>
    `;
  }

  function renderProfileInsights() {
    const takesEl = document.getElementById("summary-takes");
    const agreeEl = document.getElementById("summary-agree");
    const disagreeEl = document.getElementById("summary-disagree");
    const pinnedEl = document.getElementById("profile-pinned-take");
    const controversialEl = document.getElementById("profile-controversial-take");
    const voteTotals = getVoteTotals(currentTakes);

    if (takesEl) takesEl.textContent = String(currentTakes.length);
    if (agreeEl) agreeEl.textContent = String(voteTotals.agree);
    if (disagreeEl) disagreeEl.textContent = String(voteTotals.disagree);

    renderHighlightCard(
      pinnedEl,
      getPinnedTake(currentTakes),
      "No takes yet. Post something sharp and it will anchor this profile.",
      "Latest"
    );
    renderHighlightCard(
      controversialEl,
      getMostControversialTake(currentTakes),
      "No take has enough voting tension yet. A closer agree/disagree split will surface here.",
      "Closest split"
    );
  }

  function setActiveTab(nextTab) {
    activeTab = nextTab;
    document.querySelectorAll(".profile-tab").forEach((button) => {
      button.classList.toggle("profile-tab--active", button.dataset.profileTab === activeTab);
    });
  }

  function setActiveView(nextView) {
    activeView = nextView;
    document.querySelectorAll(".view-toggle__btn").forEach((button) => {
      button.classList.toggle("view-toggle__btn--active", button.dataset.view === activeView);
    });
  }

  function renderProfileFeed() {
    const feedEl = document.getElementById("profile-feed");
    if (!feedEl) return;

    const activeFeedTakes = activeTab === "saved" ? currentSavedTakes : currentTakes;
    const isSavedTab = activeTab === "saved";
    feedEl.classList.remove("profile-feed--grid");
    if (activeTab === "replies") {
      feedEl.innerHTML = `<p class="feed-empty">Replies will appear here.</p>`;
      setFeedState("This section is a placeholder for a future phase.", "");
      return;
    }

    if (isSavedTab && !isOwnProfile) {
      feedEl.innerHTML = `<p class="feed-empty">Saved takes are private.</p>`;
      setFeedState("Saved takes are only visible to the account owner.", "");
      return;
    }

    if (activeView === "grid") {
      if (activeFeedTakes.length) {
        feedEl.classList.add("profile-feed--grid");
      }
      window.ClashlyTakeRenderer.renderTakeGrid(feedEl, activeFeedTakes, {
        emptyMessage: isSavedTab ? "No saved takes yet." : "No takes yet. Post your first take from Create.",
      });
    } else {
      window.ClashlyTakeRenderer.renderTakeList(feedEl, activeFeedTakes, {
        compact: true,
        currentUserId: currentUser ? currentUser.id : "",
        emptyMessage: isSavedTab ? "No saved takes yet." : "No takes yet. Post your first take from Create.",
      });
    }

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
    setFeedState(activeFeedTakes.length ? "" : isSavedTab ? "No saved takes yet." : "No takes yet.", "");
  }

  function renderFollowList() {
    const bodyEl = document.getElementById("follow-list-body");
    if (!bodyEl) return;

    if (!currentFollowListUsers.length) {
      bodyEl.innerHTML = `<p class="follow-list-empty">No ${currentFollowListMode} yet.</p>`;
      return;
    }

    bodyEl.innerHTML = currentFollowListUsers
      .map((user) => {
        const avatar = user.avatar_url
          ? `<div class="follow-list-item__avatar"><img src="${window.ClashlyUtils.escapeHtml(user.avatar_url)}" alt="@${window.ClashlyUtils.escapeHtml(
              user.username
            )} avatar" /></div>`
          : `<div class="follow-list-item__avatar">${window.ClashlyProfiles.initialsFromUsername(user.username)}</div>`;
        const action = user.is_self
          ? ""
          : `<button
              type="button"
              class="btn btn--ghost follow-list-item__action${user.is_following ? " is-following" : ""}"
              data-follow-list-action="${user.is_following ? "unfollow" : "follow"}"
              data-user-id="${window.ClashlyUtils.escapeHtml(user.id)}"
            >${user.is_following ? "Following" : "Follow"}</button>`;

        return `
          <article class="follow-list-item">
            ${avatar}
            <div class="follow-list-item__main">
              <a class="follow-list-item__user" href="profile.html?id=${encodeURIComponent(user.id)}">@${window.ClashlyUtils.escapeHtml(
                user.username
              )}</a>
              <p class="follow-list-item__bio">${window.ClashlyUtils.escapeHtml(user.bio || "No bio yet.")}</p>
            </div>
            ${action}
          </article>
        `;
      })
      .join("");
  }

  function openFollowListModal(mode) {
    const modal = document.getElementById("follow-list-modal");
    const title = document.getElementById("follow-list-title");
    const eyebrow = document.getElementById("follow-list-eyebrow");
    if (!modal || !title || !eyebrow) return;

    currentFollowListMode = mode === "following" ? "following" : "followers";
    title.textContent = currentFollowListMode === "following" ? "Following" : "Followers";
    eyebrow.textContent = isOwnProfile ? "Your network" : `${currentProfile ? `@${currentProfile.username}` : "Profile"} network`;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeFollowListModal() {
    const modal = document.getElementById("follow-list-modal");
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = "";
  }

  async function loadFollowList(mode) {
    if (!currentProfile || !window.ClashlyFollows) return;

    currentFollowListMode = mode === "following" ? "following" : "followers";
    setFollowListState("Loading list...", "");

    const result = await window.ClashlyFollows.fetchFollowList(currentFollowListMode, currentProfile.id, currentUser ? currentUser.id : "");
    if (result.error) {
      setFollowListState(window.ClashlyUtils.reportError("Follow list load failed.", result.error, "Could not load list."), "error");
      return;
    }

    currentFollowListUsers = result.users || [];
    renderFollowList();
    setFollowListState("", "");
  }

  function handleCommentsOpen(input) {
    if (!window.ClashlyCommentsModal) {
      window.location.href = `take.html?id=${encodeURIComponent(input.takeId)}`;
      return;
    }

    const targetTake =
      currentTakes.find((take) => take.id === input.takeId) ||
      currentSavedTakes.find((take) => take.id === input.takeId) ||
      null;
    window.ClashlyCommentsModal.open({
      takeId: input.takeId,
      take: targetTake,
      currentUserId: currentUser ? currentUser.id : "",
    });
  }

  function handleShareOpen(input) {
    const targetTake =
      currentTakes.find((take) => take.id === input.takeId) ||
      currentSavedTakes.find((take) => take.id === input.takeId) ||
      null;

    if (window.ClashlyShareModal) {
      window.ClashlyShareModal.open({
        take: targetTake,
      });
      return;
    }

    window.ClashlyUtils.copyText(input.shareUrl)
      .then(() => setFeedState("Link copied to clipboard.", "success"))
      .catch((error) => setFeedState(window.ClashlyUtils.reportError("Fallback share failed.", error, "Could not copy link."), "error"));
  }

  function handleTakeUpdated(event) {
    const detail = event.detail || {};
    if (!detail.takeId || !detail.vote) return;
    updateTakeVoteState(detail.takeId, {
      vote: detail.vote,
      vote_loading: false,
    });
    renderProfileInsights();
    renderProfileFeed();
  }

  function handleTakeBookmarkUpdated(event) {
    const detail = event.detail || {};
    if (!detail.takeId || typeof detail.bookmarked !== "boolean") return;
    updateTakeBookmarkState(detail.takeId, detail.bookmarked);
    renderProfileFeed();
  }

  function updateTakeVoteState(takeId, patch) {
    currentTakes = currentTakes.map((take) => (take.id === takeId ? { ...take, ...patch } : take));
    currentSavedTakes = currentSavedTakes.map((take) => (take.id === takeId ? { ...take, ...patch } : take));
  }

  function updateTakeBookmarkState(takeId, bookmarked) {
    currentTakes = currentTakes.map((take) => (take.id === takeId ? { ...take, bookmarked } : take));

    const existingSavedTake = currentSavedTakes.find((take) => take.id === takeId) || currentTakes.find((take) => take.id === takeId);
    if (bookmarked) {
      if (existingSavedTake && !currentSavedTakes.some((take) => take.id === takeId)) {
        currentSavedTakes = [{ ...existingSavedTake, bookmarked: true }, ...currentSavedTakes];
      } else {
        currentSavedTakes = currentSavedTakes.map((take) => (take.id === takeId ? { ...take, bookmarked: true } : take));
      }
      return;
    }

    currentSavedTakes = currentSavedTakes.filter((take) => take.id !== takeId);
  }

  async function handleVote(input) {
    if (!currentUser || !currentUser.id) {
      setFeedState("Please log in to vote.", "error");
      window.setTimeout(() => {
        window.location.replace("auth.html");
      }, 250);
      return;
    }

    const target = currentTakes.find((take) => take.id === input.takeId);
    if (!target || target.vote_loading) return;

    updateTakeVoteState(input.takeId, { vote_loading: true });
    renderProfileFeed();

    try {
      const voteResult = await window.ClashlyTakes.submitVote({
        userId: currentUser.id,
        takeId: input.takeId,
        voteType: input.voteType,
        currentVote: target.vote ? target.vote.user_vote : "",
      });

      if (voteResult.error) throw voteResult.error;

      updateTakeVoteState(input.takeId, {
        vote_loading: false,
        vote: voteResult.vote,
      });
      renderProfileInsights();
      renderProfileFeed();
      setFeedState("", "");
    } catch (error) {
      updateTakeVoteState(input.takeId, { vote_loading: false });
      renderProfileFeed();
      throw error;
    }
  }

  async function handleBookmark(input) {
    if (!currentUser || !currentUser.id) {
      setFeedState("Please log in to save takes.", "error");
      window.setTimeout(() => {
        window.location.replace("auth.html");
      }, 250);
      return;
    }

    const target =
      currentTakes.find((take) => take.id === input.takeId) ||
      currentSavedTakes.find((take) => take.id === input.takeId);
    if (!target) return;

    try {
      const result = await window.ClashlyTakes.toggleBookmark({
        userId: currentUser.id,
        takeId: input.takeId,
        isBookmarked: input.isBookmarked,
      });

      if (result.error) throw result.error;

      updateTakeBookmarkState(input.takeId, result.bookmarked);
      renderProfileFeed();
      setFeedState("", "");
    } catch (error) {
      throw error;
    }
  }

  async function loadFollowState() {
    if (!currentProfile || !currentProfile.id || !window.ClashlyFollows) return;

    const statsResult = await window.ClashlyFollows.getFollowStats(currentProfile.id);
    if (!statsResult.error) {
      followStats = {
        followersCount: statsResult.followersCount,
        followingCount: statsResult.followingCount,
      };
    }

    if (!isOwnProfile && currentUser && currentUser.id) {
      const followState = await window.ClashlyFollows.isFollowing(currentUser.id, currentProfile.id);
      if (!followState.error) {
        isFollowing = Boolean(followState.isFollowing);
      }
    } else {
      isFollowing = false;
    }
  }

  async function handleFollowToggle() {
    if (!window.ClashlyFollows || !currentUser || !currentProfile || isOwnProfile) return;

    const button = document.getElementById("follow-trigger");
    if (!button) return;
    button.disabled = true;

    try {
      const result = isFollowing
        ? await window.ClashlyFollows.unfollowUser({
            followerId: currentUser.id,
            followingId: currentProfile.id,
          })
        : await window.ClashlyFollows.followUser({
            followerId: currentUser.id,
            followingId: currentProfile.id,
          });

      if (result.error) throw result.error;

      isFollowing = !isFollowing;
      followStats = {
        ...followStats,
        followersCount: Math.max(0, followStats.followersCount + (isFollowing ? 1 : -1)),
      };
      renderProfile(currentProfile, currentUser.email || "");
      renderActionButtons();
      setMetaStatus(isFollowing ? "Now following this profile." : "Unfollowed profile.", "success");
    } catch (error) {
      setMetaStatus(window.ClashlyUtils.reportError("Follow toggle failed.", error, "Could not update follow state."), "error");
    } finally {
      button.disabled = false;
    }
  }

  function resolveViewedProfileTarget(currentUserId) {
    const params = new URLSearchParams(window.location.search);
    const requestedId = (params.get("id") || "").trim();
    const requestedUsername = (params.get("u") || "").trim();

    if (requestedId) return { id: requestedId, username: "" };
    if (requestedUsername) return { id: "", username: requestedUsername };
    return { id: currentUserId || "", username: "" };
  }

  async function loadProfileData() {
    if (!window.ClashlyAuth || !window.ClashlyProfiles || !window.ClashlyTakes) return;

    try {
      const userState = await window.ClashlyAuth.getCurrentUser();
      if (userState.error || !userState.user) {
        setMetaStatus("Could not load your account session.", "error");
        return;
      }

      currentUser = userState.user;
      const target = resolveViewedProfileTarget(userState.user.id);
      const profileState = target.id
        ? await window.ClashlyProfiles.getProfileById(target.id)
        : await window.ClashlyProfiles.getProfileByUsername(target.username);

      if (profileState.error) {
        setMetaStatus("Could not load profile details.", "error");
        return;
      }

      if (!profileState.profile) {
        setMetaStatus("Profile not found.", "error");
        return;
      }

      currentProfile = profileState.profile;
      isOwnProfile = currentProfile.id === userState.user.id;

      const takesState = await window.ClashlyTakes.fetchTakesByUser(currentProfile.id, {
        limit: 40,
        currentUserId: userState.user.id,
      });
      if (takesState.error) throw takesState.error;
      currentTakes = takesState.takes || [];

      if (isOwnProfile) {
        const savedState = await window.ClashlyTakes.fetchBookmarkedTakes(userState.user.id, {
          limit: 40,
          currentUserId: userState.user.id,
        });
        if (savedState.error) throw savedState.error;
        currentSavedTakes = savedState.takes || [];
      } else {
        currentSavedTakes = [];
      }

      await loadFollowState();
      renderProfile(currentProfile, userState.user.email || "");
      renderActionButtons();
      renderProfileInsights();
      renderProfileFeed();
      setMetaStatus("", "");
    } catch (error) {
      setMetaStatus(window.ClashlyUtils.reportError("Profile page load failed.", error, "Profile load failed."), "error");
      setFeedState("Could not load profile takes.", "error");
    }
  }

  async function handleTakeCreated() {
    await loadProfileData();
  }

  function bindControls() {
    document.querySelectorAll(".profile-tab").forEach((button) => {
      button.addEventListener("click", () => {
        setActiveTab(button.dataset.profileTab || "takes");
        renderProfileFeed();
      });
    });

    document.querySelectorAll(".view-toggle__btn").forEach((button) => {
      button.addEventListener("click", () => {
        setActiveView(button.dataset.view || "list");
        renderProfileFeed();
      });
    });

    const followTrigger = document.getElementById("follow-trigger");
    if (followTrigger) {
      followTrigger.addEventListener("click", handleFollowToggle);
    }

    document.querySelectorAll("[data-open-follow-list]").forEach((button) => {
      button.addEventListener("click", async () => {
        const mode = button.getAttribute("data-open-follow-list") || "followers";
        openFollowListModal(mode);
        await loadFollowList(mode);
      });
    });

    document.addEventListener("click", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const closeTrigger = target.closest("[data-close-follow-list='true']");
      if (closeTrigger) {
        event.preventDefault();
        closeFollowListModal();
        return;
      }

      const actionBtn = target.closest("[data-follow-list-action]");
      if (!actionBtn || !(actionBtn instanceof HTMLButtonElement) || !currentUser) return;

      const targetUserId = actionBtn.getAttribute("data-user-id") || "";
      if (!targetUserId) return;

      actionBtn.disabled = true;
      try {
        const shouldUnfollow = actionBtn.getAttribute("data-follow-list-action") === "unfollow";
        const result = shouldUnfollow
          ? await window.ClashlyFollows.unfollowUser({
              followerId: currentUser.id,
              followingId: targetUserId,
            })
          : await window.ClashlyFollows.followUser({
              followerId: currentUser.id,
              followingId: targetUserId,
            });

        if (result.error) throw result.error;

        currentFollowListUsers = currentFollowListUsers.map((user) =>
          user.id === targetUserId ? { ...user, is_following: !shouldUnfollow } : user
        );

        if (currentProfile && targetUserId === currentProfile.id) {
          isFollowing = !shouldUnfollow;
          followStats = {
            ...followStats,
            followersCount: Math.max(0, followStats.followersCount + (isFollowing ? 1 : -1)),
          };
          renderProfile(currentProfile, currentUser.email || "");
          renderActionButtons();
        }

        renderFollowList();
      } catch (error) {
        setMetaStatus(window.ClashlyUtils.reportError("Follow list action failed.", error, "Could not update follow state."), "error");
      } finally {
        actionBtn.disabled = false;
      }
    });
  }

  function initProfileUI() {
    setActiveTab("takes");
    setActiveView("list");
    bindControls();
    if (window.ClashlyApp && window.ClashlyApp.createEventName) {
      window.addEventListener(window.ClashlyApp.createEventName, handleTakeCreated);
    }
    window.addEventListener("clashly:take-updated", handleTakeUpdated);
    window.addEventListener("clashly:take-bookmark-updated", handleTakeBookmarkUpdated);
    loadProfileData();
  }

  document.addEventListener("DOMContentLoaded", initProfileUI);
})();
