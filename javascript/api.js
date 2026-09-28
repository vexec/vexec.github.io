/* ============================================================
   Vexec — API Client + Mock Layer
   ------------------------------------------------------------
   USAGE:
     const res = await API.get("/api/feed");
     render(res.data);

   TO SWAP TO REAL BACKEND:
     1. Set API_CONFIG.useMock = false
     2. Set API_CONFIG.baseURL = "http://localhost:8080" (if cross-origin)
     3. Done. All pages keep working.
   ============================================================ */

(function () {
  "use strict";

  /* ============================================================
     CONFIG
     ============================================================ */
  const API_CONFIG = {
    useMock: true,
    baseURL: "",
    mockDelay: [300, 700],
    timeout: 15000,
    authHeader: () => {
      try {
        const code = localStorage.getItem("vexec:auth:code:v1");
        return code ? { "X-Access-Code": code } : {};
      } catch (_) {
        return {};
      }
    },
  };

  /* ============================================================
     MOCK DATA
     ============================================================ */
  const MOCK = {
    feed: [
      {
        id: "post_001",
        name: "Silent Fox",
        handle: "@unknown_42",
        avatar: "https://i.pravatar.cc/150?img=12",
        verified: true,
        views: "1.2K",
        text: "I wrote something I could never say out loud. Somehow it feels lighter now that a stranger might read it.",
        images: ["https://picsum.photos/seed/vexec1/900/600"],
        audios: [],
        files: [],
        likes: 38,
        comments: 3,
        commentsList: [
          { name: "Wandering Ink", handle: "@ghost_ink", avatar: "https://i.pravatar.cc/150?img=15", text: "This is exactly how I feel. Thank you for writing it." },
          { name: "Half Light", handle: "@between_worlds", avatar: "https://i.pravatar.cc/150?img=32", text: "I read this three times.", image: "https://picsum.photos/seed/vexec2/500/400" },
          { name: "Paper Ghost", handle: "@no_name", avatar: "https://i.pravatar.cc/150?img=45", text: "Please keep writing." },
        ],
      },
      {
        id: "post_002",
        name: "Midnight Cat",
        handle: "@anonymous_writer",
        avatar: "https://i.pravatar.cc/150?img=33",
        verified: true,
        views: "842",
        text: "Being unknown is not the same as being invisible. Here, I can finally be seen for what I think, not who I am.",
        images: [], audios: [], files: [],
        likes: 94, comments: 1,
        commentsList: [
          { name: "Quiet Storm", handle: "@unnamed", avatar: "https://i.pravatar.cc/150?img=60", text: "I needed to hear this today." },
        ],
      },
      {
        id: "post_003",
        name: "Empty Chair",
        handle: "@silent_scream",
        avatar: "https://i.pravatar.cc/150?img=14",
        verified: false,
        views: "2.3K",
        text: "I've been sitting on this thought for three years... It doesn't have to be perfect. It just has to be real.",
        images: ["https://picsum.photos/seed/vexec3/900/600"],
        audios: [], files: [],
        likes: 412, comments: 2,
        commentsList: [
          { name: "Paper Ghost", handle: "@no_name", avatar: "https://i.pravatar.cc/150?img=27", text: "I feel like you reached into my chest." },
          { name: "Wandering Ink", handle: "@ghost_ink", avatar: "https://i.pravatar.cc/150?img=41", text: '"It just has to be real." That line broke me.' },
        ],
      },
      {
        id: "post_004",
        name: "Wandering Ink",
        handle: "@ghost_ink",
        avatar: "https://i.pravatar.cc/150?img=5",
        verified: true,
        views: "4.7K",
        text: "Made this at 2am. Sometimes words fail and only sound can carry the weight.",
        images: [],
        audios: [{
          url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
          name: "SoundHelix - Song 1.mp3",
          size: 8421337,
          cover: "https://picsum.photos/seed/album1/300/300",
        }],
        files: [],
        likes: 203, comments: 2,
        commentsList: [
          { name: "Quiet Storm", handle: "@unnamed", avatar: "https://i.pravatar.cc/150?img=65", text: "This is beautiful." },
          { name: "Paper Ghost", handle: "@no_name", avatar: "https://i.pravatar.cc/150?img=22", text: "Saved. This one hits different at 3am." },
        ],
      },
      {
        id: "post_005",
        name: "Half Light",
        handle: "@between_worlds",
        avatar: "https://i.pravatar.cc/150?img=36",
        verified: false,
        views: "6.1K",
        text: "There's a specific kind of loneliness that only exists in the space between two people who used to know each other...",
        images: [], audios: [], files: [],
        likes: 887, comments: 2,
        commentsList: [
          { name: "Wandering Ink", handle: "@ghost_ink", avatar: "https://i.pravatar.cc/150?img=44", text: '"Strangers wearing familiar faces." Perfect.' },
          { name: "Quiet Storm", handle: "@unnamed", avatar: "https://i.pravatar.cc/150?img=48", text: "I'm going through this right now." },
        ],
      },
      {
        id: "post_006",
        name: "Quiet Storm",
        handle: "@unnamed",
        avatar: "https://i.pravatar.cc/150?img=25",
        verified: false,
        views: "128",
        text: "I've been reading here for months. Today, I finally wrote my first sentence. Small step, but it's mine.",
        images: [],
        audios: [{
          url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
          name: "Midnight.mp3",
          size: 7639215,
          cover: "https://picsum.photos/seed/album3/300/300",
        }],
        files: [],
        likes: 76, comments: 2,
        commentsList: [
          { name: "Half Light", handle: "@between_worlds", avatar: "https://i.pravatar.cc/150?img=17", text: "Welcome. The first sentence is always the hardest one." },
          { name: "Paper Ghost", handle: "@no_name", avatar: "https://i.pravatar.cc/150?img=3", text: "Small step, but it's yours. That's what matters." },
        ],
      },
    ],

    saved: {
      audios: [
        { id: "audio_s01", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", name: "Midnight Whispers.mp3", artist: "Silent Fox", size: 8421337, cover: "https://picsum.photos/seed/vexec-audio1/300/300", sourceUrl: "/home", sourceLabel: "Silent Fox", saved_at: "2026-09-25T10:30:00Z" },
        { id: "audio_s02", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", name: "Paper Ghost — Lullaby.mp3", artist: "Paper Ghost", size: 9137245, cover: "https://picsum.photos/seed/vexec-audio2/300/300", sourceUrl: "/home", sourceLabel: "Paper Ghost", saved_at: "2026-09-23T18:15:00Z" },
        { id: "audio_s03", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", name: "Between Worlds.mp3", artist: "Half Light", size: 7639215, cover: "https://picsum.photos/seed/vexec-audio3/300/300", sourceUrl: "/home", sourceLabel: "Half Light", saved_at: "2026-09-21T09:45:00Z" },
      ],
      posts: [
        { id: "post_s01", name: "Silent Fox", handle: "@unknown_42", avatar: "https://i.pravatar.cc/150?img=12", text: "I wrote something I could never say out loud.", image: "https://picsum.photos/seed/vexec-saved-1/900/600", audio: null, saved_at: "2026-09-25T08:00:00Z" },
        { id: "post_s02", name: "Wandering Ink", handle: "@ghost_ink", avatar: "https://i.pravatar.cc/150?img=5", text: "Made this at 2am. Sometimes words fail.", image: null, audio: { url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", name: "Ghost Ink — Session 2.mp3", size: 9137245, cover: "https://picsum.photos/seed/vexec-post-audio-1/300/300" }, saved_at: "2026-09-24T22:00:00Z" },
        { id: "post_s03", name: "Half Light", handle: "@between_worlds", avatar: "https://i.pravatar.cc/150?img=36", text: "There's a specific kind of loneliness...", image: null, audio: null, saved_at: "2026-09-23T22:14:00Z" },
        { id: "post_s04", name: "Quiet Storm", handle: "@unnamed", avatar: "https://i.pravatar.cc/150?img=25", text: "Today, I finally wrote my first sentence.", image: "https://picsum.photos/seed/vexec-saved-4/900/600", audio: null, saved_at: "2026-09-19T16:50:00Z" },
      ],
    },

    users: {
      unknown_42: {
        name: "Silent Fox",
        handle: "@unknown_42",
        avatar: "https://i.pravatar.cc/150?img=12",
        bio: "I write what I cannot say aloud.",
        verified: true,
        stats: { posts: 24, likes: 1240, views: 8460, joined: "Mar 2024" },
        posts: [
          { id: "p1", views: "1.2K", text: "I wrote something I could never say out loud.", images: ["https://picsum.photos/seed/pv42-a/900/600"], audios: [], files: [], likes: 38, comments: 1, commentsList: [{ name: "Wandering Ink", handle: "@ghost_ink", avatar: "https://i.pravatar.cc/150?img=15", text: "Thank you for writing it." }] },
          { id: "p2", views: "4.7K", text: "Made this at 2am.", images: [], audios: [{ url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", name: "Midnight.mp3", size: 8421337, cover: "https://picsum.photos/seed/pv42-a1/300/300" }], files: [], likes: 203, comments: 0, commentsList: [] },
          { id: "p3", views: "8.3K", text: "Two shots from the same moment.", images: ["https://picsum.photos/seed/pv42-b1/900/900", "https://picsum.photos/seed/pv42-b2/900/900"], audios: [], files: [], likes: 512, comments: 0, commentsList: [] },
          { id: "p4", views: "15.1K", text: "A whole session: two photos, two tracks, and lyrics.", images: ["https://picsum.photos/seed/pv42-c1/900/900", "https://picsum.photos/seed/pv42-c2/900/900"], audios: [{ url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", name: "Session 4 - Raw.mp3", size: 9137245, cover: "https://picsum.photos/seed/pv42-session/300/300" }, { url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", name: "Session 4 - Instrumental.mp3", size: 7639215, cover: "https://picsum.photos/seed/pv42-session2/300/300" }], files: [{ url: "#", name: "lyrics-draft.pdf", size: 4200000, type: "pdf" }], likes: 1204, comments: 0, commentsList: [] },
        ],
      },
      ghost_ink: {
        name: "Wandering Ink", handle: "@ghost_ink", avatar: "https://i.pravatar.cc/150?img=5", bio: "No ego behind it. Just truth.", verified: true,
        stats: { posts: 42, likes: 2870, views: 14200, joined: "Nov 2023" },
        posts: [
          { id: "p1", views: "6.1K", text: "The best thing about being anonymous? You can tell the truth.", images: ["https://picsum.photos/seed/pvgi-1/900/600"], audios: [], files: [], likes: 203, comments: 0, commentsList: [] },
          { id: "p2", views: "2.1K", text: "Ghost ink sessions.", images: [], audios: [{ url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3", name: "Ghost Ink Sessions.mp3", size: 7562893, cover: "https://picsum.photos/seed/pvgi-a1/300/300" }], files: [], likes: 156, comments: 0, commentsList: [] },
        ],
      },
      between_worlds: {
        name: "Half Light", handle: "@between_worlds", avatar: "https://i.pravatar.cc/150?img=36", bio: "Somewhere between who I was and who I'm becoming.", verified: false,
        stats: { posts: 17, likes: 890, views: 4100, joined: "Jun 2025" },
        posts: [
          { id: "p1", views: "6.1K", text: "There's a specific kind of loneliness...", images: [], audios: [], files: [], likes: 887, comments: 0, commentsList: [] },
        ],
      },
    },

    myPosts: [
      { id: "mp1", text: "I wrote something I could never say out loud.", images: ["https://picsum.photos/seed/mp1/900/600"], audios: [], files: [], views: 1247, likes: 38, comments: 12, saves: 4, createdAt: "2 hours ago", timestamp: Date.now() - 2 * 3600e3 },
      { id: "mp2", text: "Made this at 2am.", images: [], audios: [{ url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", name: "Midnight Whispers.mp3", size: 8421337, cover: "https://picsum.photos/seed/mp2a/300/300" }], files: [], views: 8734, likes: 203, comments: 18, saves: 41, createdAt: "yesterday", timestamp: Date.now() - 26 * 3600e3 },
      { id: "mp3", text: "Two shots from the same moment.", images: ["https://picsum.photos/seed/mp3a/900/900", "https://picsum.photos/seed/mp3b/900/900"], audios: [], files: [], views: 3312, likes: 512, comments: 24, saves: 87, createdAt: "2 days ago", timestamp: Date.now() - 2 * 86400e3 },
      { id: "mp4", text: "A whole session: 2 photos, 1 track, and the lyrics file.", images: ["https://picsum.photos/seed/mp4a/900/900", "https://picsum.photos/seed/mp4b/900/900"], audios: [{ url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", name: "Session 4 - Raw.mp3", size: 9137245, cover: "https://picsum.photos/seed/mp4s/300/300" }], files: [{ url: "#", name: "lyrics-draft.pdf", size: 4200000, type: "pdf" }], views: 15124, likes: 1204, comments: 156, saves: 312, createdAt: "3 days ago", timestamp: Date.now() - 3 * 86400e3 },
      { id: "mp5", text: "The quiet ones have the loudest thoughts.", images: [], audios: [], files: [], views: 412, likes: 18, comments: 3, saves: 2, createdAt: "5 days ago", timestamp: Date.now() - 5 * 86400e3 },
    ],

    profile: {
      displayName: "Anonymous Voice",
      username: "vexec_user",
      bio: "Some thoughts are meant to be shared without a name.",
      avatar: null,
      verified: true,
    },

    auth: {
      register: (username, displayName) => ({
        user: { username, displayName, createdAt: new Date().toISOString() },
        code: Array.from({ length: 20 }, () => {
          const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
          return abc[Math.floor(Math.random() * abc.length)];
        }).join(""),
      }),
    },
  };

  /* ============================================================
     MOCK ROUTES
     ============================================================ */
  const MOCK_ROUTES = [
    { method: "GET",    path: "/api/feed",             handler: () => ({ data: MOCK.feed }) },
    { method: "GET",    path: "/api/saved",            handler: () => ({ data: MOCK.saved }) },
    { method: "DELETE", path: "/api/saved/:id",        handler: ({ id }) => ({ data: { id } }) },
    { method: "POST",   path: "/api/saved",            handler: ({ body }) => ({ data: body }) },

    { method: "GET",    path: "/api/u/:username",      handler: ({ username }) => {
        const u = MOCK.users[username];
        if (!u) {
          const err = new Error("User not found");
          err.status = 404; err.code = "not_found";
          throw err;
        }
        return { data: u };
      } },

    { method: "GET",    path: "/api/me/posts",         handler: () => ({ data: MOCK.myPosts }) },
    { method: "DELETE", path: "/api/me/posts/:id",     handler: ({ id }) => ({ data: { id } }) },
    { method: "PATCH",  path: "/api/me/posts/:id/pin", handler: ({ id, body }) => ({ data: { id, pinned: !!(body && body.pinned) } }) },

    { method: "GET",    path: "/api/profile",          handler: () => ({ data: MOCK.profile }) },
    { method: "PATCH",  path: "/api/profile",          handler: ({ body }) => ({ data: { ...MOCK.profile, ...body } }) },

    { method: "POST",   path: "/api/auth/register",    handler: ({ body }) => ({ data: MOCK.auth.register(body.username, body.displayName) }) },
    { method: "POST",   path: "/api/auth/login",       handler: ({ body }) => {
        const stored = localStorage.getItem("vexec:auth:code:v1");
        if (!stored || stored !== body.code) {
          const err = new Error("Invalid code");
          err.status = 401; err.code = "invalid_code";
          throw err;
        }
        return { data: { ok: true } };
      } },
  ];

  function matchMock(method, path) {
    for (const r of MOCK_ROUTES) {
      if (r.method !== method) continue;
      const keys = [];
      const pattern = r.path.replace(/:([^/]+)/g, (_, k) => {
        keys.push(k);
        return "([^/]+)";
      });
      const m = path.match(new RegExp("^" + pattern + "$"));
      if (m) {
        const params = {};
        keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
        return { handler: r.handler, params };
      }
    }
    return null;
  }

  function randomDelay() {
    const [min, max] = API_CONFIG.mockDelay;
    return min + Math.random() * (max - min);
  }

  function envelope(status, message, code, data) {
    return {
      status: status,
      message: message,
      code: code,
      data: data,
      timestamp: new Date().toISOString(),
    };
  }

  /* ============================================================
     REQUEST
     ============================================================ */
  async function request(method, path, { body, query, headers } = {}) {
    if (API_CONFIG.useMock) {
      const match = matchMock(method, path);
      if (!match) {
        throw Object.assign(
          new Error(`[api] mock route not found: ${method} ${path}`),
          { status: 404, code: "mock_not_found" },
        );
      }
      await new Promise((r) => setTimeout(r, randomDelay()));
      try {
        const result = match.handler({ ...match.params, body, query });
        return envelope("ok", "mock response", "OK", result.data);
      } catch (err) {
        const e = new Error(err.message || "Mock error");
        e.status = err.status || 500;
        e.code = err.code || "error";
        throw e;
      }
    }

    let url = API_CONFIG.baseURL + path;
    if (query) {
      const qs = new URLSearchParams(query).toString();
      if (qs) url += (url.includes("?") ? "&" : "?") + qs;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), API_CONFIG.timeout);

    let res;
    try {
      res = await fetch(url, {
        method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...API_CONFIG.authHeader(),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        credentials: "same-origin",
      });
    } catch (err) {
      clearTimeout(timer);
      const e = new Error(
        err.name === "AbortError" ? "Request timed out" : "Network error",
      );
      e.status = 0;
      e.code = err.name === "AbortError" ? "timeout" : "network_error";
      throw e;
    }
    clearTimeout(timer);

    let json = null;
    try { json = await res.json(); } catch (_) { json = null; }

    if (!res.ok) {
      const msg = (json && json.message) || `HTTP ${res.status}`;
      const e = new Error(msg);
      e.status = res.status;
      e.code = (json && json.code) || "http_error";
      e.data = json && json.data;
      throw e;
    }
    if (json && json.status && json.status !== "ok") {
      const e = new Error(json.message || "Request failed");
      e.status = res.status;
      e.code = json.code || "unknown";
      e.data = json.data;
      throw e;
    }

    return json || envelope("ok", "empty", "OK", null);
  }

  /* ============================================================
     PUBLIC API
     ============================================================ */
  window.API = {
    config: API_CONFIG,

    get:    (path, opts)       => request("GET",    path, opts),
    post:   (path, body, opts) => request("POST",   path, { ...opts, body }),
    put:    (path, body, opts) => request("PUT",    path, { ...opts, body }),
    patch:  (path, body, opts) => request("PATCH",  path, { ...opts, body }),
    delete: (path, opts)       => request("DELETE", path, opts),

    unwrap: (res) => (res && typeof res === "object" && "data" in res ? res.data : res),
    isMock: () => API_CONFIG.useMock,
  };

  window.withSkeleton = async function (skeletonEl, contentEl, loader, render) {
    if (skeletonEl) skeletonEl.hidden = false;
    if (contentEl)  contentEl.hidden = true;
    try {
      const res = await loader();
      const data = API.unwrap(res);
      if (skeletonEl) skeletonEl.hidden = true;
      if (contentEl)  contentEl.hidden = false;
      if (render) render(data, res);
      return data;
    } catch (err) {
      console.error("[api]", err);
      if (skeletonEl) skeletonEl.hidden = true;
      if (contentEl)  contentEl.hidden = false;
      if (window.VexecToast) window.VexecToast(err.message, "alert-circle");
      throw err;
    }
  };

  console.info(
    `[api] mode = ${API_CONFIG.useMock ? "MOCK" : "REAL"} · baseURL = "${API_CONFIG.baseURL || "(same origin)"}"`,
  );
})();