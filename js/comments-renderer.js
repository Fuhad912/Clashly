(function () {
  function getUsername(profile) {
    if (!profile || !profile.username) return "@anonymous";
    return `@${profile.username}`;
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
          class="comment-action comment-action--toggle"
          data-action="toggle-replies"
          data-comment-id="${window.ClashlyUtils.escapeHtml(comment.id)}"
          aria-expanded="${repliesExpanded ? "true" : "false"}"
        >${repliesExpanded ? "Hide" : "View"} ${replyCount} ${replyCount === 1 ? "reply" : "replies"}</button>`
      );
    }

    if (comment.is_owner && options.currentUserId) {
      actions.push(
        `<button type="button" class="comment-action comment-action--danger" data-action="delete-comment" data-comment-id="${window.ClashlyUtils.escapeHtml(
          comment.id
        )}">Delete</button>`
      );
    }

    return `<div class="comment-item__actions">${actions.join("")}</div>`;
  }

  function renderReply(reply, options, depth) {
    const username = getUsername(reply.profile);
    const relativeTime = window.ClashlyUtils.formatRelativeTime(reply.created_at);
    const hasReplies = reply.replies.length > 0;
    const repliesExpanded = options.expandedReplyIds && options.expandedReplyIds.has(reply.id);
    const nestedRepliesMarkup =
      hasReplies && repliesExpanded
        ? `
          <div class="comment-replies comment-replies--nested">
            ${reply.replies.map((childReply) => renderReply(childReply, options, depth + 1)).join("")}
          </div>
        `
        : "";

    return `
      <article class="comment-item comment-item--reply" data-comment-id="${window.ClashlyUtils.escapeHtml(
        reply.id
      )}" data-comment-depth="${Math.min(depth, 3)}">
        ${getAvatarMarkup(reply.profile)}
        <div class="comment-item__body">
          <header class="comment-item__meta">
            <span class="comment-item__user">${window.ClashlyUtils.escapeHtml(username)}</span>
            <span class="comment-item__dot">&bull;</span>
            <time datetime="${window.ClashlyUtils.escapeHtml(reply.created_at)}">${window.ClashlyUtils.escapeHtml(
              relativeTime
            )}</time>
          </header>
          <p class="comment-item__text">${window.ClashlyUtils.escapeHtml(reply.content)}</p>
          ${renderActions(reply, options, reply.replies.length, repliesExpanded)}
          ${nestedRepliesMarkup}
        </div>
      </article>
    `;
  }

  function renderComment(comment, options) {
    const username = getUsername(comment.profile);
    const relativeTime = window.ClashlyUtils.formatRelativeTime(comment.created_at);
    const replyCount = comment.replies.length;
    const repliesExpanded = options.expandedReplyIds && options.expandedReplyIds.has(comment.id);
    const repliesMarkup =
      replyCount && repliesExpanded
        ? `
          <div class="comment-replies">
            ${comment.replies.map((reply) => renderReply(reply, options, 1)).join("")}
          </div>
        `
        : "";

    return `
      <article class="comment-item comment-item--root" data-comment-id="${window.ClashlyUtils.escapeHtml(comment.id)}">
        ${getAvatarMarkup(comment.profile)}
        <div class="comment-item__body">
          <header class="comment-item__meta">
            <span class="comment-item__user">${window.ClashlyUtils.escapeHtml(username)}</span>
            <span class="comment-item__dot">&bull;</span>
            <time datetime="${window.ClashlyUtils.escapeHtml(comment.created_at)}">${window.ClashlyUtils.escapeHtml(
              relativeTime
            )}</time>
          </header>
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
          <span>Be the first to start the debate.</span>
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
