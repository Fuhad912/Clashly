(function () {
  function getUsername(profile) {
    if (!profile || !profile.username) return "@anonymous";
    return `@${profile.username}`;
  }

  function getReplies(comment) {
    return Array.isArray(comment && comment.replies) ? comment.replies : [];
  }

  function isTakeAuthor(comment, options) {
    return Boolean(options && options.takeAuthorId && comment && comment.user_id === options.takeAuthorId);
  }

  function isCurrentUser(comment, options) {
    return Boolean(options && options.currentUserId && comment && comment.user_id === options.currentUserId);
  }

  function getAvatarMarkup(profile) {
    const username = profile && profile.username ? profile.username : "cl";
    const initials = window.ClashlyUtils.initialsFromName(username);

    if (profile && profile.avatar_url) {
      return `
        <div class="comment-item__avatar">
          <img src="${window.ClashlyUtils.escapeHtml(profile.avatar_url)}" alt="${window.ClashlyUtils.escapeHtml(
            getUsername(profile)
          )} avatar" />
        </div>
      `;
    }

    return `<div class="comment-item__avatar">${window.ClashlyUtils.escapeHtml(initials)}</div>`;
  }

  function renderRoleBadges(comment, options) {
    const badges = [];
    if (isTakeAuthor(comment, options)) {
      badges.push('<span class="comment-item__badge comment-item__badge--author">Author</span>');
    }
    if (isCurrentUser(comment, options)) {
      badges.push('<span class="comment-item__badge comment-item__badge--you">You</span>');
    }

    if (!badges.length) return "";
    return `<span class="comment-item__badges">${badges.join("")}</span>`;
  }

  function renderMeta(comment, options) {
    const username = getUsername(comment.profile);
    const relativeTime = window.ClashlyUtils.formatRelativeTime(comment.created_at);
    const badgesMarkup = renderRoleBadges(comment, options);

    return `
      <header class="comment-item__meta">
        <span class="comment-item__user">${window.ClashlyUtils.escapeHtml(username)}</span>
        ${badgesMarkup}
        <span class="comment-item__dot">&bull;</span>
        <time datetime="${window.ClashlyUtils.escapeHtml(comment.created_at)}">${window.ClashlyUtils.escapeHtml(relativeTime)}</time>
      </header>
    `;
  }

  function renderActions(comment, options, replyCount, repliesExpanded) {
    const actions = [
      `<button type="button" class="comment-action" data-action="reply" data-comment-id="${window.ClashlyUtils.escapeHtml(
        comment.id
      )}" data-comment-user="${window.ClashlyUtils.escapeHtml(getUsername(comment.profile))}">Reply</button>`,
    ];

    if (replyCount) {
      actions.push(
        `<button
          type="button"
          class="comment-action comment-action--toggle${repliesExpanded ? " is-active" : ""}"
          data-action="toggle-replies"
          data-comment-id="${window.ClashlyUtils.escapeHtml(comment.id)}"
          aria-expanded="${repliesExpanded ? "true" : "false"}"
        >${repliesExpanded ? "Hide thread" : `View ${replyCount} ${replyCount === 1 ? "reply" : "replies"}`}</button>`
      );
    }

    if (comment.is_owner && options.currentUserId) {
      actions.push(
        `<button type="button" class="comment-action comment-action--danger" data-action="delete-comment" data-comment-id="${window.ClashlyUtils.escapeHtml(
          comment.id
        )}">Delete</button>`
      );
    }

    return `<div class="comment-item__actions" role="group" aria-label="Comment actions">${actions.join("")}</div>`;
  }

  function getItemClass(comment, options, baseClass) {
    const classes = ["comment-item", baseClass];
    if (isTakeAuthor(comment, options)) classes.push("comment-item--author");
    if (isCurrentUser(comment, options)) classes.push("comment-item--self");
    return classes.join(" ");
  }

  function renderReply(reply, options, depth, parentUsername) {
    const replyItems = getReplies(reply);
    const hasReplies = replyItems.length > 0;
    const repliesExpanded = options.expandedReplyIds && options.expandedReplyIds.has(reply.id);
    const replyingToMarkup = parentUsername
      ? `<p class="comment-item__replyingto"><span>Replying to</span> ${window.ClashlyUtils.escapeHtml(parentUsername)}</p>`
      : "";
    const nestedRepliesMarkup =
      hasReplies && repliesExpanded
        ? `
          <div class="comment-replies comment-replies--nested">
            ${replyItems.map((childReply) => renderReply(childReply, options, depth + 1, getUsername(reply.profile))).join("")}
          </div>
        `
        : "";

    return `
      <article class="${getItemClass(reply, options, "comment-item--reply")}" data-comment-id="${window.ClashlyUtils.escapeHtml(
        reply.id
      )}" data-comment-depth="${Math.min(depth, 3)}">
        ${getAvatarMarkup(reply.profile)}
        <div class="comment-item__body">
          ${renderMeta(reply, options)}
          ${replyingToMarkup}
          <p class="comment-item__text">${window.ClashlyUtils.escapeHtml(reply.content)}</p>
          ${renderActions(reply, options, replyItems.length, repliesExpanded)}
          ${nestedRepliesMarkup}
        </div>
      </article>
    `;
  }

  function renderComment(comment, options) {
    const replyItems = getReplies(comment);
    const replyCount = replyItems.length;
    const repliesExpanded = options.expandedReplyIds && options.expandedReplyIds.has(comment.id);
    const repliesMarkup =
      replyCount && repliesExpanded
        ? `
          <div class="comment-replies">
            ${replyItems.map((reply) => renderReply(reply, options, 1, getUsername(comment.profile))).join("")}
          </div>
        `
        : "";

    return `
      <article class="${getItemClass(comment, options, "comment-item--root")}" data-comment-id="${window.ClashlyUtils.escapeHtml(
        comment.id
      )}">
        ${getAvatarMarkup(comment.profile)}
        <div class="comment-item__body">
          ${renderMeta(comment, options)}
          <p class="comment-item__text">${window.ClashlyUtils.escapeHtml(comment.content)}</p>
          ${renderActions(comment, options, replyCount, repliesExpanded)}
          ${repliesMarkup}
        </div>
      </article>
    `;
  }

  function renderCommentThread(container, comments, options) {
    if (!container) return;

    if (!comments.length) {
      container.innerHTML = `
        <div class="comments-empty">
          <p>No comments yet.</p>
          <span>Open the floor with the first argument.</span>
        </div>
      `;
      return;
    }

    container.innerHTML = comments.map((comment) => renderComment(comment, options || {})).join("");
  }

  window.ClashlyCommentsRenderer = {
    renderCommentThread,
  };
})();
