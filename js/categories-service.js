(function () {
  const CATEGORIES_TABLE = "categories";
  const TAKE_CATEGORIES_TABLE = "take_categories";

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

  function normalizeCategorySlug(slug) {
    return String(slug || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
  }

  function isCategorySlugValid(slug) {
    return /^[a-z0-9_]+$/.test(normalizeCategorySlug(slug));
  }

  async function fetchCategories() {
    const client = getClientOrThrow();
    const categoriesQuery = await client
      .from(CATEGORIES_TABLE)
      .select("id, slug, name, description, keywords, sort_order")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (categoriesQuery.error) {
      return { categories: [], error: categoriesQuery.error };
    }

    const categories = categoriesQuery.data || [];
    const categoryIds = categories.map((category) => category.id).filter(Boolean);
    if (!categoryIds.length) {
      return { categories: [], error: null };
    }

    const joinsQuery = await client
      .from(TAKE_CATEGORIES_TABLE)
      .select("category_id, take_id")
      .in("category_id", categoryIds);

    if (joinsQuery.error) {
      return { categories: [], error: joinsQuery.error };
    }

    const countMap = new Map();
    (joinsQuery.data || []).forEach((row) => {
      const categoryId = row.category_id;
      if (!categoryId) return;
      countMap.set(categoryId, (countMap.get(categoryId) || 0) + 1);
    });

    return {
      categories: categories.map((category) => ({
        ...category,
        keywords: Array.isArray(category.keywords) ? category.keywords : [],
        take_count: countMap.get(category.id) || 0,
      })),
      error: null,
    };
  }

  async function fetchCategoryBySlug(slug) {
    const safeSlug = normalizeCategorySlug(slug);
    if (!safeSlug) {
      return { category: null, error: new Error("Category slug is required.") };
    }

    const client = getClientOrThrow();
    const query = await client
      .from(CATEGORIES_TABLE)
      .select("id, slug, name, description, keywords, sort_order")
      .eq("slug", safeSlug)
      .maybeSingle();

    return {
      category: query.data || null,
      error: query.error,
    };
  }

  window.ClashlyCategories = {
    CATEGORIES_TABLE,
    TAKE_CATEGORIES_TABLE,
    normalizeCategorySlug,
    isCategorySlugValid,
    fetchCategories,
    fetchCategoryBySlug,
  };
})();
