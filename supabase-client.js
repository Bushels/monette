// supabase-client.js - browser bootstrap for the community ledger.
//
// Design:
// - Read aggregate tallies from public.vote_tallies.
// - Submit votes through public.submit_vote so anon clients never need raw
//   read/update access on public.votes.
// - Read only published headline rows from public.tips.

(function () {
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
    window.SUPA_TALLIES = {};
    window.MY_VOTES = { poll: {}, season: {} };
    window.onTalliesChange = () => () => {};
    window.monetteInsertVote = async () => false;
    window.monetteSubmitTip = async () => false;
    window.monetteHydrateActivityFeed = async () => false;
    window.myPollVote = () => null;
    window.mySeasonVote = () => false;
    setHeadlines(seedHeadlines);
    return;
  }

  const supa = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  window.supa = supa;
  window.SUPA_TALLIES = {};

  const FP_KEY = "monette.voter.fp";
  function getFingerprint() {
    try {
      let fp = localStorage.getItem(FP_KEY);
      if (!fp) {
        fp = (crypto && crypto.randomUUID)
          ? crypto.randomUUID()
          : "fp-" + Math.random().toString(36).slice(2) + "-" + Date.now();
        localStorage.setItem(FP_KEY, fp);
      }
      return fp;
    } catch (e) {
      return "fp-session-" + Math.random().toString(36).slice(2);
    }
  }

  const FP = getFingerprint();
  window.MONETTE_FP = FP;

  const MV_KEY = "monette.myvotes.v1";
  function loadMyVotes() {
    try {
      const saved = localStorage.getItem(MV_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { poll: {}, season: {} };
  }
  function saveMyVotes() {
    try { localStorage.setItem(MV_KEY, JSON.stringify(window.MY_VOTES)); } catch (e) {}
  }

  window.MY_VOTES = loadMyVotes();
  window.myPollVote = (propId, qloc, category) => (window.MY_VOTES.poll[`${propId}:${qloc}:${category}`] || null);
  window.mySeasonVote = (propId, qloc, value) => !!window.MY_VOTES.season[`${propId}:${qloc}:${value}`];

  const listeners = new Set();
  window.onTalliesChange = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };
  const notify = () => listeners.forEach((fn) => { try { fn(); } catch (e) {} });

  function bump(propId, quarterLoc, category, value, delta) {
    const key = `${propId}:${quarterLoc}`;
    window.SUPA_TALLIES[key] = window.SUPA_TALLIES[key] || { ownership: {}, listing: {}, season: {} };
    const slot = window.SUPA_TALLIES[key][category] || (window.SUPA_TALLIES[key][category] = {});
    slot[value] = Math.max(0, (slot[value] || 0) + delta);
  }

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

  async function hydrateTallies() {
    const { data, error } = await supa
      .from("vote_tallies")
      .select("prop_id,quarter_loc,category,value,n");
    if (error) {
      console.warn("[supa] tally hydrate failed", error.message);
      return;
    }

    const next = {};
    for (const row of data || []) {
      const key = `${row.prop_id}:${row.quarter_loc}`;
      next[key] = next[key] || { ownership: {}, listing: {}, season: {} };
      (next[key][row.category] || (next[key][row.category] = {}))[row.value] = row.n;
    }
    window.SUPA_TALLIES = next;
    notify();
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

  async function hydrateActivityFeed() {
    const { data, error } = await supa
      .from("vote_activity_feed")
      .select("id,prop_id,quarter_loc,category,value,created_at")
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      console.warn("[supa] activity hydrate failed", error.message);
      return;
    }

    if (window.monetteSetActivityFeed) {
      window.monetteSetActivityFeed(data || []);
    }
  }

  window.monetteHydrateTallies = hydrateTallies;
  window.monetteHydrateHeadlines = hydrateHeadlines;
  window.monetteHydrateActivityFeed = hydrateActivityFeed;

  async function submitVote(propId, quarterLoc, category, value, note) {
    return supa.rpc("submit_vote", {
      p_prop_id: propId,
      p_quarter_loc: quarterLoc,
      p_category: category,
      p_value: value,
      p_note: note || null,
      p_voter_fingerprint: FP,
    });
  }

  window.monetteInsertVote = async (propId, quarterLoc, category, value, note) => {
    const isPoll = category === "ownership" || category === "listing";
    let optimisticActivityId = null;
    const pushActivity = () => {
      if (!window.monettePushActivity) return null;
      return window.monettePushActivity({
        id: `local:${Date.now()}:${propId}:${quarterLoc}:${category}:${value}`,
        propId,
        quarterLoc,
        category,
        value,
        createdAt: new Date().toISOString(),
        optimistic: true,
      });
    };
    const removeOptimisticActivity = () => {
      if (optimisticActivityId && window.monetteRemoveActivity) {
        window.monetteRemoveActivity(optimisticActivityId);
      }
    };

    if (isPoll) {
      const myKey = `${propId}:${quarterLoc}:${category}`;
      const prev = window.MY_VOTES.poll[myKey] || null;
      if (prev === value) return true;

      if (prev) bump(propId, quarterLoc, category, prev, -1);
      bump(propId, quarterLoc, category, value, 1);
      optimisticActivityId = pushActivity();
      window.MY_VOTES.poll[myKey] = value;
      saveMyVotes();
      notify();

      const { error } = await submitVote(propId, quarterLoc, category, value, note);
      if (error) {
        console.warn("[supa] vote submit failed, rolling back", error.message);
        bump(propId, quarterLoc, category, value, -1);
        if (prev) bump(propId, quarterLoc, category, prev, 1);
        removeOptimisticActivity();
        window.MY_VOTES.poll[myKey] = prev;
        saveMyVotes();
        notify();
        return false;
      }
      hydrateActivityFeed();
      return true;
    }

    const myKey = `${propId}:${quarterLoc}:${value}`;
    if (window.MY_VOTES.season[myKey]) return true;

    bump(propId, quarterLoc, category, value, 1);
    optimisticActivityId = pushActivity();
    window.MY_VOTES.season[myKey] = true;
    saveMyVotes();
    notify();

    const { error } = await submitVote(propId, quarterLoc, category, value, note);
    if (error) {
      console.warn("[supa] season submit failed, rolling back", error.message);
      bump(propId, quarterLoc, category, value, -1);
      removeOptimisticActivity();
      delete window.MY_VOTES.season[myKey];
      saveMyVotes();
      notify();
      return false;
    }
    hydrateActivityFeed();
    return true;
  };

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

  function refreshCommunityState() {
    return Promise.all([hydrateTallies(), hydrateActivityFeed()]);
  }

  Promise.all([hydrateTallies(), hydrateHeadlines(), hydrateActivityFeed()]).catch((error) => {
    console.warn("[supa] initial hydrate failed", error?.message || error);
  });

  if (supa.channel) {
    supa
      .channel("monette-vote-activity")
      .on("postgres_changes", { event: "*", schema: "public", table: "votes" }, () => {
        refreshCommunityState().catch((error) => console.warn("[supa] realtime refresh failed", error?.message || error));
      })
      .subscribe();
  }

  window.setInterval(() => {
    refreshCommunityState().catch((error) => console.warn("[supa] activity refresh failed", error?.message || error));
  }, 30000);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refreshCommunityState().catch((error) => console.warn("[supa] visible refresh failed", error?.message || error));
    }
  });
})();
