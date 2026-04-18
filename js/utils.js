(function () {
  function escapeHtml(input) {
    const value = String(input || "");
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeHashtag(tag) {
    return String(tag || "")
      .replace(/^#/, "")
      .trim()
      .toLowerCase();
  }

  function linkifyHashtags(input) {
    const value = String(input || "");
    const hashtagPattern = /#[a-z0-9_]+/gi;
    let lastIndex = 0;
    let html = "";
    let match = hashtagPattern.exec(value);

    while (match) {
      const [rawTag] = match;
      const matchIndex = match.index;
      const normalizedTag = normalizeHashtag(rawTag);

      html += escapeHtml(value.slice(lastIndex, matchIndex));

      if (/^[a-z0-9_]{1,32}$/.test(normalizedTag)) {
        html += `<a class="take-hashtag" href="hashtag.html?tag=${encodeURIComponent(normalizedTag)}">${escapeHtml(rawTag)}</a>`;
      } else {
        html += escapeHtml(rawTag);
      }

      lastIndex = matchIndex + rawTag.length;
      match = hashtagPattern.exec(value);
    }

    html += escapeHtml(value.slice(lastIndex));
    return html;
  }

  function formatRelativeTime(isoDate) {
    if (!isoDate) return "now";

    const now = Date.now();
    const then = new Date(isoDate).getTime();
    if (!then || Number.isNaN(then)) return "now";

    const diffSeconds = Math.max(1, Math.floor((now - then) / 1000));
    if (diffSeconds < 60) return `${diffSeconds}s`;

    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d`;

    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 5) return `${diffWeeks}w`;

    const date = new Date(isoDate);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const input = document.createElement("textarea");
    input.value = text;
    input.setAttribute("readonly", "true");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    const success = document.execCommand("copy");
    document.body.removeChild(input);
    return success;
  }

  function initialsFromName(name) {
    const safe = String(name || "cl").replace("@", "").trim() || "cl";
    return safe.slice(0, 2).toUpperCase();
  }

  function toTakeUrl(takeId) {
    return new URL(`take.html?id=${encodeURIComponent(takeId)}`, window.location.href).href;
  }

  function reportError(scope, error, fallbackMessage) {
    if (error) {
      console.error(`[Clashly] ${scope}`, error);
    } else {
      console.error(`[Clashly] ${scope}`);
    }

    return fallbackMessage || "Something went wrong.";
  }

  window.ClashlyUtils = {
    escapeHtml,
    formatRelativeTime,
    copyText,
    initialsFromName,
    linkifyHashtags,
    normalizeHashtag,
    toTakeUrl,
    reportError,
  };
})();
