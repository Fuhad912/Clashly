(function () {
  function truncateText(input, maxLength) {
    const value = String(input || "").trim();
    if (value.length <= maxLength) return value;
    return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
  }

  function getItems(instance) {
    return Array.from(instance.dropdown.querySelectorAll(".search-suggestions__item"));
  }

  function updateActiveItem(instance) {
    const items = getItems(instance);
    items.forEach((item, index) => {
      item.classList.toggle("is-active", index === instance.activeIndex);
    });

    if (instance.activeIndex < 0 || instance.activeIndex >= items.length) return;
    items[instance.activeIndex].scrollIntoView({
      block: "nearest",
    });
  }

  function resetActiveItem(instance) {
    instance.activeIndex = -1;
    updateActiveItem(instance);
  }

  function moveActiveItem(instance, direction) {
    const items = getItems(instance);
    if (!items.length) return;

    if (instance.activeIndex < 0) {
      instance.activeIndex = direction > 0 ? 0 : items.length - 1;
    } else {
      instance.activeIndex = (instance.activeIndex + direction + items.length) % items.length;
    }

    updateActiveItem(instance);
  }

  function openActiveItem(instance) {
    const items = getItems(instance);
    if (instance.activeIndex < 0 || instance.activeIndex >= items.length) return false;
    const target = items[instance.activeIndex];
    if (!(target instanceof HTMLAnchorElement)) return false;
    target.click();
    return true;
  }

  function renderUserAvatar(user) {
    if (user.avatar_url) {
      return `<div class="search-suggestions__avatar"><img src="${window.ClashlyUtils.escapeHtml(user.avatar_url)}" alt="@${window.ClashlyUtils.escapeHtml(
        user.username
      )} avatar" /></div>`;
    }

    return `<div class="search-suggestions__avatar">${window.ClashlyProfiles.initialsFromUsername(user.username)}</div>`;
  }

  function renderUsers(users) {
    if (!users.length) return "";

    return `
      <section class="search-suggestions__group">
        <header class="search-suggestions__label">Users</header>
        ${users
          .map(
            (user) => `
              <a class="search-suggestions__item" href="profile.html?id=${encodeURIComponent(user.id)}">
                ${renderUserAvatar(user)}
                <div class="search-suggestions__content">
                  <strong class="search-suggestions__title">@${window.ClashlyUtils.escapeHtml(user.username)}</strong>
                  <span class="search-suggestions__meta">${window.ClashlyUtils.escapeHtml(
                    truncateText(user.bio || "No bio yet.", 64)
                  )}</span>
                </div>
              </a>
            `
          )
          .join("")}
      </section>
    `;
  }

  function renderHashtags(hashtags) {
    if (!hashtags.length) return "";

    return `
      <section class="search-suggestions__group">
        <header class="search-suggestions__label">Hashtags</header>
        ${hashtags
          .map(
            (hashtag) => `
              <a class="search-suggestions__item search-suggestions__item--hashtag" href="hashtag.html?tag=${encodeURIComponent(hashtag.tag)}">
                <div class="search-suggestions__content">
                  <strong class="search-suggestions__title">#${window.ClashlyUtils.escapeHtml(hashtag.tag)}</strong>
                  <span class="search-suggestions__meta">Open hashtag feed</span>
                </div>
              </a>
            `
          )
          .join("")}
      </section>
    `;
  }

  function renderTakes(takes) {
    if (!takes.length) return "";

    return `
      <section class="search-suggestions__group">
        <header class="search-suggestions__label">Takes</header>
        ${takes
          .map((take) => {
            const username = take.profile && take.profile.username ? `@${take.profile.username}` : "@anonymous";
            return `
              <a class="search-suggestions__item search-suggestions__item--take" href="take.html?id=${encodeURIComponent(take.id)}">
                <div class="search-suggestions__content">
                  <strong class="search-suggestions__title">${window.ClashlyUtils.escapeHtml(username)}</strong>
                  <span class="search-suggestions__meta">${window.ClashlyUtils.escapeHtml(truncateText(take.content, 92))}</span>
                </div>
              </a>
            `;
          })
          .join("")}
      </section>
    `;
  }

  function createDropdown(form) {
    const dropdown = document.createElement("div");
    dropdown.className = "search-suggestions";
    dropdown.hidden = true;
    form.appendChild(dropdown);
    return dropdown;
  }

  function hide(instance) {
    instance.dropdown.hidden = true;
    instance.dropdown.innerHTML = "";
    instance.latestQuery = "";
    instance.activeIndex = -1;
  }

  function show(instance) {
    instance.dropdown.hidden = false;
  }

  function renderResults(instance, results) {
    const users = results.users || [];
    const hashtags = results.hashtags || [];
    const takes = results.takes || [];
    const hasResults = users.length || hashtags.length || takes.length;

    if (!hasResults) {
      instance.dropdown.innerHTML = `<div class="search-suggestions__empty">No matching suggestions.</div>`;
      resetActiveItem(instance);
      show(instance);
      return;
    }

    instance.dropdown.innerHTML = `
      ${renderUsers(users)}
      ${renderHashtags(hashtags)}
      ${renderTakes(takes)}
    `;
    resetActiveItem(instance);
    show(instance);
  }

  async function loadSuggestions(instance) {
    const query = String(instance.input.value || "").trim();
    instance.requestId += 1;
    const currentRequestId = instance.requestId;

    if (!query) {
      hide(instance);
      return;
    }

    instance.latestQuery = query;

    try {
      const results = await window.ClashlySearch.fetchSuggestions(query, {
        currentUserId: typeof instance.getCurrentUserId === "function" ? instance.getCurrentUserId() : "",
      });

      if (currentRequestId !== instance.requestId) return;
      if (!results || results.error) {
        hide(instance);
        return;
      }

      renderResults(instance, results);
    } catch (error) {
      if (currentRequestId !== instance.requestId) return;
      hide(instance);
    }
  }

  function scheduleLoad(instance) {
    window.clearTimeout(instance.timer);
    instance.timer = window.setTimeout(() => {
      loadSuggestions(instance);
    }, 140);
  }

  function attach(config) {
    const form = document.getElementById(config.formId);
    const input = document.getElementById(config.inputId);
    if (!form || !input || !window.ClashlySearch || !window.ClashlyUtils || !window.ClashlyProfiles) return null;

    const instance = {
      form,
      input,
      dropdown: createDropdown(form),
      timer: 0,
      requestId: 0,
      latestQuery: "",
      activeIndex: -1,
      getCurrentUserId: config.getCurrentUserId,
    };

    input.addEventListener("input", () => {
      scheduleLoad(instance);
    });

    input.addEventListener("focus", () => {
      if (String(input.value || "").trim()) {
        scheduleLoad(instance);
      }
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (instance.dropdown.hidden) {
          scheduleLoad(instance);
          return;
        }
        moveActiveItem(instance, 1);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (instance.dropdown.hidden) {
          scheduleLoad(instance);
          return;
        }
        moveActiveItem(instance, -1);
        return;
      }

      if (event.key === "Enter" && !instance.dropdown.hidden) {
        if (openActiveItem(instance)) {
          event.preventDefault();
          return;
        }
      }

      if (event.key === "Escape") {
        event.preventDefault();
        hide(instance);
      }
    });

    instance.dropdown.addEventListener("pointermove", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const item = target.closest(".search-suggestions__item");
      if (!item) return;

      const items = getItems(instance);
      const index = items.indexOf(item);
      if (index < 0 || index === instance.activeIndex) return;
      instance.activeIndex = index;
      updateActiveItem(instance);
    });

    instance.dropdown.addEventListener("click", () => {
      hide(instance);
    });

    document.addEventListener("pointerdown", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (form.contains(target)) return;
      hide(instance);
    });

    form.addEventListener("submit", () => {
      hide(instance);
    });

    return instance;
  }

  window.ClashlySearchSuggestions = {
    attach,
  };
})();
