(function () {
  function setState(message, type) {
    const stateEl = document.getElementById("explore-state");
    if (!stateEl) return;

    stateEl.hidden = !message;
    stateEl.textContent = message || "";
    stateEl.classList.remove("is-error", "is-success");
    if (type === "error") stateEl.classList.add("is-error");
    if (type === "success") stateEl.classList.add("is-success");
  }

  function toCategoryHref(slug) {
    return `category.html?category=${encodeURIComponent(slug)}`;
  }

  function renderCategory(category, index) {
    const takeCount = category.take_count || 0;
    const keywords = Array.isArray(category.keywords) ? category.keywords.slice(0, 5) : [];
    return `
      <article class="explore-card">
        <header class="explore-card__head">
          <p class="explore-card__eyebrow">Lane ${index + 1}</p>
          <div class="explore-card__title-row">
            <h2 class="explore-card__title">${window.ClashlyUtils.escapeHtml(category.name)}</h2>
            <a class="explore-card__jump" href="${toCategoryHref(category.slug)}">Open lane</a>
          </div>
          <p class="explore-card__description">${window.ClashlyUtils.escapeHtml(category.description)}</p>
          <div class="explore-card__meta">
            <span class="explore-card__count">${takeCount} ${takeCount === 1 ? "take" : "takes"}</span>
            <span class="explore-card__slug">/${window.ClashlyUtils.escapeHtml(category.slug)}</span>
          </div>
        </header>
        <div class="explore-card__topics">
          ${keywords
            .map(
              (keyword) =>
                `<a class="explore-chip" href="search.html?q=${encodeURIComponent(keyword)}">${window.ClashlyUtils.escapeHtml(
                  `#${keyword}`
                )}</a>`
            )
            .join("")}
        </div>
      </article>
    `;
  }

  async function boot() {
    try {
      const container = document.getElementById("explore-categories");
      if (!container || !window.ClashlyUtils || !window.ClashlyCategories) return;

      setState("", "");

      // Show skeleton immediately so the grid isn't blank while loading
      if (typeof window.clasheShowExploreSkeleton === "function") {
        window.clasheShowExploreSkeleton("explore-categories", 4);
      } else {
        container.innerHTML = "";
      }

      const result = await window.ClashlyCategories.fetchCategories();
      if (result.error) throw result.error;

      const categories = result.categories || [];
      if (!categories.length) {
        container.innerHTML = "";
        setState("No categories are available yet.", "");
        return;
      }

      const ordered = categories
        .slice()
        .sort((left, right) => {
          const countDiff = (right.take_count || 0) - (left.take_count || 0);
          if (countDiff !== 0) return countDiff;
          return (left.sort_order || 0) - (right.sort_order || 0);
        });

      container.innerHTML = ordered.map(renderCategory).join("");
      setState("", "");
    } catch (error) {
      const message = window.ClashlyUtils.reportError("Explore categories load failed.", error, "Could not load categories.");
      const container = document.getElementById("explore-categories");
      if (container) container.innerHTML = "";
      setState(message, "error");
    } finally {
      if (window.ClasheLoader) {
        window.ClasheLoader.release("page-data");
      }
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
