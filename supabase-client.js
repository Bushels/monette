// supabase-client.js - browser bootstrap for the community ledger.
//
// Design (satellite pivot 2026-04-29):
// - Read published headlines from public.tips (kind=headline, published=true).
// - Submit tips/observations through public.tips.
// - All vote-related paths removed; tables will be dropped in the migration
//   committed alongside this file.

(function () {
  // One-time cleanup of orphan vote-era state. Voting feature was removed in
  // the satellite pivot 2026-04-29; users may have stale per-fingerprint vote
  // history persisting across visits. Safe to call repeatedly.
  try {
    ["monette.voter.fp", "monette.myvotes.v1", "monette.activity.v1"]
      .forEach((k) => localStorage.removeItem(k));
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith("monette.q.v4.")) localStorage.removeItem(k);
    });
  } catch (e) {}

  const seedHeadlines = Array.isArray(window.MONETTE_DATA?.headlines)
    ? [...window.MONETTE_DATA.headlines]
    : [];

  function setHeadlines(next) {
    const safe = Array.isArray(next) && next.length ? next : seedHeadlines;
    if (window.monetteSetHeadlines) {
      window.monetteSetHeadlines(safe);
    } else {
      window.MONETTE_HEADLINES = safe;
    }
  }

  if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    console.warn("[supa] disabled - missing library or config; running local-only");
    window.monetteSubmitTip = async () => false;
    setHeadlines(seedHeadlines);
    return;
  }

  const supa = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  window.supa = supa;

  function normalizeHeadline(row) {
    return {
      id: `headline-${row.id}`,
      text: row.body,
      author: row.author || "@anon",
      when: window.formatRelativeTime ? window.formatRelativeTime(row.created_at) : "recent",
    };
  }

  function mergePublishedHeadlines(rows) {
    const merged = [...rows, ...seedHeadlines];
    const seen = new Set();
    return merged.filter((row) => {
      const key = `${row.id}|${row.text}|${row.author}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async function hydrateHeadlines() {
    const { data, error } = await supa
      .from("tips")
      .select("id,body,author,created_at")
      .eq("kind", "headline")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.warn("[supa] headline hydrate failed", error.message);
      setHeadlines(seedHeadlines);
      return;
    }

    setHeadlines(mergePublishedHeadlines((data || []).map(normalizeHeadline)));
  }

  window.monetteHydrateHeadlines = hydrateHeadlines;

  window.monetteSubmitTip = async ({ kind = "tip", propId, body, author, photoUrl }) => {
    const { error } = await supa.from("tips").insert({
      kind,
      prop_id: propId || null,
      body,
      author: author || null,
      photo_url: photoUrl || null,
    });
    if (error) {
      console.warn("[supa] tip insert failed", error.message);
      return false;
    }
    return true;
  };

  hydrateHeadlines().catch((error) => {
    console.warn("[supa] initial headline hydrate failed", error?.message || error);
  });
})();
