(function () {
  function getVoteData(take) {
    const vote = take && take.vote ? take.vote : {};
    return {
      agreeCount: Number(vote.agree_count || 0),
      disagreeCount: Number(vote.disagree_count || 0),
      totalVotes: Number(vote.total_votes || 0),
      agreePct: Number(vote.agree_pct || 0),
      disagreePct: Number(vote.disagree_pct || 0),
      userVote: String(vote.user_vote || ""),
      isLoading: Boolean(take && take.vote_loading),
    };
  }

  function getUsername(profile) {
    if (!profile || !profile.username) return "@anonymous";
    return `@${profile.username}`;
  }

  function getAvatarMarkup(profile) {
    const username = profile && profile.username ? profile.username : "cl";
    const initials = window.ClashlyUtils.initialsFromName(username);

    if (profile && profile.avatar_url) {
      return `
        <div class="take-item__avatar">
          <img src="${window.ClashlyUtils.escapeHtml(profile.avatar_url)}" alt="${window.ClashlyUtils.escapeHtml(
            getUsername(profile)
          )} avatar" />
        </div>
      `;
    }

    return `<div class="take-item__avatar">${window.ClashlyUtils.escapeHtml(initials)}</div>`;
  }

  function getOwnerBadge(take, currentUserId) {
    if (!currentUserId || !take || take.user_id !== currentUserId) return "";
    return `<span class="take-owner-badge" title="Owner tools coming soon">Owner</span>`;
  }

  function renderTakeText(content) {
    if (!window.ClashlyUtils || typeof window.ClashlyUtils.linkifyHashtags !== "function") {
      return window.ClashlyUtils.escapeHtml(content);
    }

    return window.ClashlyUtils.linkifyHashtags(content);
  }

  function renderVoteMeta(voteData) {
    if (!voteData.totalVotes) {
      return `<p class="take-vote-meta">No votes yet</p>`;
    }

    return `
      <p class="take-vote-meta">
        Agree ${voteData.agreePct}% &middot; Disagree ${voteData.disagreePct}% &middot; ${voteData.totalVotes} votes
      </p>
    `;
  }

  function renderVoteSplit(voteData) {
    const agreeWidth = voteData.totalVotes ? voteData.agreePct : 50;
    const disagreeWidth = voteData.totalVotes ? voteData.disagreePct : 50;
    return `
      <div class="take-vote-split" aria-hidden="true">
        <span class="take-vote-split__agree" style="width: ${agreeWidth}%"></span>
        <span class="take-vote-split__disagree" style="width: ${disagreeWidth}%"></span>
      </div>
    `;
  }

  function renderActionIcon(name) {
    const icons = {
      agree: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10 10.25h4.15l1.22-4.3c.17-.58.53-1.08 1.01-1.41l.86-.59 1.06 1.16c.55.6.76 1.43.55 2.22l-.81 2.92H20a1.8 1.8 0 0 1 1.78 2.09l-.95 6.08A1.8 1.8 0 0 1 19.05 20H10V10.25Z"></path>
          <path d="M5.25 10.25H8.9V20H5.25z"></path>
        </svg>
      `,
      disagree: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14 13.75H9.85l-1.22 4.3c-.17.58-.53 1.08-1.01 1.41l-.86.59-1.06-1.16a2.26 2.26 0 0 1-.55-2.22l.81-2.92H4a1.8 1.8 0 0 1-1.78-2.09l.95-6.08A1.8 1.8 0 0 1 4.95 4H14v9.75Z"></path>
          <path d="M15.1 4h3.65v9.75H15.1z"></path>
        </svg>
      `,
      comments: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5.25 17.85V6.95A1.7 1.7 0 0 1 6.95 5.25h10.1a1.7 1.7 0 0 1 1.7 1.7v7.05a1.7 1.7 0 0 1-1.7 1.7H10.7l-5.45 2.15Z"></path>
          <path d="M8.2 9.45h7.6"></path>
          <path d="M8.2 12.2h5.4"></path>
        </svg>
      `,
      bookmark: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7.1 4.75h9.8A1.35 1.35 0 0 1 18.25 6.1V20l-6.25-3.45L5.75 20V6.1A1.35 1.35 0 0 1 7.1 4.75Z"></path>
        </svg>
      `,
      share: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="6.25" cy="12" r="1.9"></circle>
          <circle cx="17.75" cy="6.1" r="1.9"></circle>
          <circle cx="17.75" cy="17.9" r="1.9"></circle>
          <path d="M8 11.1 16 7"></path>
          <path d="M8 12.9 16 17"></path>
        </svg>
      `,
    };

    return icons[name] || "";
  }

  function renderActionRow(take, options) {
    const voteData = getVoteData(take);
    const agreeSelected = voteData.userVote === "agree" ? " is-selected" : "";
    const disagreeSelected = voteData.userVote === "disagree" ? " is-selected" : "";
    const bookmarkSelected = take && take.bookmarked ? " is-selected" : "";
    const bookmarkLabel = take && take.bookmarked ? "Saved" : "Save";
    const loadingAttr = voteData.isLoading ? " disabled" : "";
    const shareUrl = window.ClashlyUtils.toTakeUrl(take.id);
    const commentsAction =
      options && options.hideCommentsAction
        ? ""
        : `<a
            href="take.html?id=${encodeURIComponent(take.id)}"
            class="take-action"
            data-action="comments"
            data-take-id="${window.ClashlyUtils.escapeHtml(take.id)}"
            aria-label="Open comments"
            title="Open comments"
          >
            <span class="take-action__icon">${renderActionIcon("comments")}</span>
          </a>`;

    return `
      <footer class="take-item__actions-wrapper" aria-label="Take actions">
        <div class="take-item__actions" aria-label="Take actions">
          <button
            type="button"
            class="take-action take-action--vote take-action--agree${agreeSelected}"
            data-action="vote"
            data-take-id="${window.ClashlyUtils.escapeHtml(take.id)}"
            data-vote-type="agree"
            aria-label="Agree with take"
            ${loadingAttr}
          >
            <span class="take-action__stack">
              <span class="take-action__lead">
                <span class="take-action__icon">${renderActionIcon("agree")}</span>
                <span class="take-action__count">${voteData.agreeCount}</span>
              </span>
              <span class="take-action__label">Agree</span>
            </span>
          </button>
          <button
            type="button"
            class="take-action take-action--vote take-action--disagree${disagreeSelected}"
            data-action="vote"
            data-take-id="${window.ClashlyUtils.escapeHtml(take.id)}"
            data-vote-type="disagree"
            aria-label="Disagree with take"
            ${loadingAttr}
          >
            <span class="take-action__stack">
              <span class="take-action__lead">
                <span class="take-action__icon">${renderActionIcon("disagree")}</span>
                <span class="take-action__count">${voteData.disagreeCount}</span>
              </span>
              <span class="take-action__label">Disagree</span>
            </span>
          </button>
          ${commentsAction}
          <button
            type="button"
            class="take-action take-action--bookmark${bookmarkSelected}"
            data-action="bookmark"
            data-take-id="${window.ClashlyUtils.escapeHtml(take.id)}"
            data-bookmarked="${take && take.bookmarked ? "true" : "false"}"
            aria-label="${bookmarkLabel} take"
            title="${bookmarkLabel} take"
          >
            <span class="take-action__icon">${renderActionIcon("bookmark")}</span>
          </button>
          <button
            type="button"
            class="take-action"
            data-action="share"
            data-take-id="${window.ClashlyUtils.escapeHtml(take.id)}"
            data-share-url="${window.ClashlyUtils.escapeHtml(shareUrl)}"
            aria-label="Share take"
            title="Share take"
          >
            <span class="take-action__icon">${renderActionIcon("share")}</span>
          </button>
        </div>
        ${renderVoteSplit(voteData)}
        ${renderVoteMeta(voteData)}
      </footer>
    `;
  }

  function renderListItem(take, options) {
    const compactClass = options.compact ? " take-item--compact" : "";
    const username = getUsername(take.profile);
    const profileHref = take && take.user_id ? `profile.html?id=${encodeURIComponent(take.user_id)}` : "profile.html";
    const takeHref = take && take.id ? `take.html?id=${encodeURIComponent(take.id)}` : "take.html";
    const relativeTime = window.ClashlyUtils.formatRelativeTime(take.created_at);
    const avatarMarkup = getAvatarMarkup(take.profile);
    const hasImage = Boolean(take.image_url);
    const ownerBadge = getOwnerBadge(take, options.currentUserId);
    const openLink = options.showOpenLink ? `<a href="${takeHref}" class="take-item__open">Open</a>` : "";
    const mediaMarkup = hasImage
      ? `
        <div class="take-item__media">
          <img src="${window.ClashlyUtils.escapeHtml(take.image_url)}" alt="Take image from ${window.ClashlyUtils.escapeHtml(
            username
          )}" loading="lazy" />
        </div>
      `
      : "";

    return `
      <article class="take-item${compactClass}" data-take-id="${window.ClashlyUtils.escapeHtml(take.id)}">
        ${avatarMarkup}
        <div class="take-item__body">
          <header class="take-item__meta">
            <a href="${profileHref}" class="take-item__user">${window.ClashlyUtils.escapeHtml(username)}</a>
            <span class="take-item__dot">&bull;</span>
            <time datetime="${window.ClashlyUtils.escapeHtml(take.created_at)}">${window.ClashlyUtils.escapeHtml(
              relativeTime
            )}</time>
            ${ownerBadge}
            ${openLink}
          </header>
          <p class="take-item__text">${renderTakeText(take.content)}</p>
          ${mediaMarkup}
          ${renderActionRow(take, options)}
        </div>
      </article>
    `;
  }

  function renderGridItem(take) {
    const username = getUsername(take.profile);
    const relativeTime = window.ClashlyUtils.formatRelativeTime(take.created_at);
    const voteData = getVoteData(take);
    const excerpt = renderTakeText(take.content);
    const hasImage = Boolean(take.image_url);
    const userVoteLabel =
      voteData.userVote === "agree"
        ? `<span class="profile-grid-vote profile-grid-vote--agree">You agreed</span>`
        : voteData.userVote === "disagree"
          ? `<span class="profile-grid-vote profile-grid-vote--disagree">You disagreed</span>`
          : "";
    const mediaMarkup = hasImage
      ? `
        <div class="profile-grid-take__media-wrap">
          <img class="profile-grid-take__media" src="${window.ClashlyUtils.escapeHtml(
            take.image_url
          )}" alt="Take image from ${window.ClashlyUtils.escapeHtml(username)}" loading="lazy" />
          <div class="profile-grid-take__overlay">
            <p class="profile-grid-take__excerpt">${excerpt}</p>
          </div>
        </div>
      `
      : `
        <div class="profile-grid-take__body">
          <p class="profile-grid-take__excerpt">${excerpt}</p>
        </div>
      `;

    return `
      <article class="profile-grid-take" data-take-id="${window.ClashlyUtils.escapeHtml(take.id)}">
        ${mediaMarkup}
        <div class="profile-grid-take__meta">
          <span class="profile-grid-take__user">${window.ClashlyUtils.escapeHtml(username)}</span>
          <span>${window.ClashlyUtils.escapeHtml(relativeTime)}</span>
          <span>Agree ${voteData.agreeCount} | Disagree ${voteData.disagreeCount}</span>
          ${userVoteLabel}
        </div>
      </article>
    `;
  }

  function renderTakeList(container, takes, options) {
    const safeOptions = options || {};
    const emptyMessage = safeOptions.emptyMessage || "No takes yet.";
    if (!takes.length) {
      container.innerHTML = `<p class="feed-empty">${window.ClashlyUtils.escapeHtml(emptyMessage)}</p>`;
      return;
    }

    container.innerHTML = takes
      .map((take) =>
        renderListItem(take, {
          compact: Boolean(safeOptions.compact),
          currentUserId: safeOptions.currentUserId || "",
          hideCommentsAction: Boolean(safeOptions.hideCommentsAction),
          showOpenLink: Boolean(safeOptions.showOpenLink),
        })
      )
      .join("");
  }

  function renderTakeGrid(container, takes, options) {
    const safeOptions = options || {};
    const emptyMessage = safeOptions.emptyMessage || "No takes yet.";
    if (!takes.length) {
      container.innerHTML = `<p class="feed-empty">${window.ClashlyUtils.escapeHtml(emptyMessage)}</p>`;
      return;
    }

    container.innerHTML = takes.map((take) => renderGridItem(take)).join("");
  }

  function bindShareActions(rootEl, handlers) {
    if (!rootEl) return;

    const shareButtons = rootEl.querySelectorAll("[data-action='share']");
    shareButtons.forEach((button) => {
      button.addEventListener("click", async () => {
        const shareUrl = button.getAttribute("data-share-url");
        const takeId = button.getAttribute("data-take-id");
        if (!shareUrl) return;

        if (handlers && typeof handlers.onShare === "function") {
          handlers.onShare({
            takeId: takeId || "",
            shareUrl,
          });
          return;
        }

        try {
          await window.ClashlyUtils.copyText(shareUrl);
          if (typeof handlers === "function") handlers("Link copied to clipboard.", "success");
          if (handlers && typeof handlers.onStatus === "function") handlers.onStatus("Link copied to clipboard.", "success");
        } catch (error) {
          if (typeof handlers === "function") handlers("Could not copy link.", "error");
          if (handlers && typeof handlers.onStatus === "function") handlers.onStatus("Could not copy link.", "error");
        }
      });
    });
  }

  function bindVoteActions(rootEl, handlers) {
    if (!rootEl || !handlers || typeof handlers.onVote !== "function") return;

    const voteButtons = rootEl.querySelectorAll("[data-action='vote']");
    voteButtons.forEach((button) => {
      button.addEventListener("click", async () => {
        const takeId = button.getAttribute("data-take-id");
        const voteType = button.getAttribute("data-vote-type");
        if (!takeId || !voteType || button.disabled) return;

        try {
          await handlers.onVote({
            takeId,
            voteType,
          });
        } catch (error) {
          if (handlers.onStatus) {
            handlers.onStatus(window.ClashlyUtils.reportError("Vote action failed.", error, "Could not update vote."), "error");
          }
        }
      });
    });
  }

  function bindCommentActions(rootEl, handlers) {
    if (!rootEl || !handlers || typeof handlers.onComments !== "function") return;

    const commentLinks = rootEl.querySelectorAll("[data-action='comments']");
    commentLinks.forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const takeId = link.getAttribute("data-take-id");
        if (!takeId) return;
        handlers.onComments({ takeId });
      });
    });
  }

  function bindBookmarkActions(rootEl, handlers) {
    if (!rootEl || !handlers || typeof handlers.onBookmark !== "function") return;

    const bookmarkButtons = rootEl.querySelectorAll("[data-action='bookmark']");
    bookmarkButtons.forEach((button) => {
      button.addEventListener("click", async () => {
        const takeId = button.getAttribute("data-take-id");
        const isBookmarked = button.getAttribute("data-bookmarked") === "true";
        if (!takeId || button.disabled) return;

        try {
          await handlers.onBookmark({
            takeId,
            isBookmarked,
          });
        } catch (error) {
          if (handlers.onStatus) {
            handlers.onStatus(
              window.ClashlyUtils.reportError("Bookmark action failed.", error, "Could not update saved state."),
              "error"
            );
          }
        }
      });
    });
  }

  window.ClashlyTakeRenderer = {
    renderTakeList,
    renderTakeGrid,
    bindShareActions,
    bindVoteActions,
    bindCommentActions,
    bindBookmarkActions,
  };
})();
