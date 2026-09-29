/* ============================================================
   PROFILE VIEW — /u/:username  (API-driven)
   ============================================================ */

(function () {
  "use strict";

  let currentUsername = null;
  let requestToken = 0;

  /* ============================================================
     API
     ============================================================ */
  async function fetchUser(username) {
    try {
      const res = await API.get(`/api/u/${encodeURIComponent(username)}`);
      return API.unwrap(res);
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  /* ============================================================
     HELPERS
     ============================================================ */
  function formatNum(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(n);
  }

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /* ============================================================
     STATE
     ============================================================ */
  function showLoading() {
    document.getElementById("pv-loading")?.removeAttribute("hidden");
    document.getElementById("pv-404")?.setAttribute("hidden", "");
    document.getElementById("pv-content")?.setAttribute("hidden", "");
  }

  function show404(username) {
    document.getElementById("pv-loading")?.setAttribute("hidden", "");
    document.getElementById("pv-content")?.setAttribute("hidden", "");

    const el404 = document.getElementById("pv-404");
    if (!el404) return;
    el404.removeAttribute("hidden");

    const uEl = document.getElementById("pv-404-username");
    if (uEl) uEl.textContent = "@" + username;

    if (window.lucide) window.lucide.createIcons({ root: el404 });
  }

  function showContent() {
    document.getElementById("pv-loading")?.setAttribute("hidden", "");
    document.getElementById("pv-404")?.setAttribute("hidden", "");
    document.getElementById("pv-content")?.removeAttribute("hidden");
  }

  /* ============================================================
     RENDER USER HERO
     ============================================================ */
  function renderUser(user, username) {
    const avatarEl = document.getElementById("pv-avatar");
    if (avatarEl) {
      avatarEl.innerHTML = "";
      if (user.avatar) {
        const img = document.createElement("img");
        img.alt = "";
        img.src = user.avatar;
        img.onerror = () => {
          avatarEl.innerHTML =
            '<div class="pv-avatar-fallback"><i data-lucide="user-round"></i></div>';
          if (window.lucide) window.lucide.createIcons({ root: avatarEl });
        };
        avatarEl.appendChild(img);
      } else {
        avatarEl.innerHTML =
          '<div class="pv-avatar-fallback"><i data-lucide="user-round"></i></div>';
      }
    }

    const wrapEl = document.getElementById("pv-avatar-wrap");
    if (wrapEl) wrapEl.classList.toggle("is-verified", !!user.verified);

    const nameEl = document.getElementById("pv-name-text");
    if (nameEl) nameEl.textContent = user.name || "Anonymous";

    const verEl = document.getElementById("pv-verified");
    if (verEl) {
      if (user.verified) verEl.removeAttribute("hidden");
      else verEl.setAttribute("hidden", "");
    }

    const handleEl = document.getElementById("pv-handle");
    if (handleEl) handleEl.textContent = user.handle || "@" + username;

    const bioEl = document.getElementById("pv-bio");
    if (bioEl) {
      if (user.bio) {
        bioEl.textContent = user.bio;
        bioEl.style.display = "";
      } else {
        bioEl.textContent = "";
        bioEl.style.display = "none";
      }
    }

    const stats = user.stats || {};
    setText("pv-stat-posts", stats.posts != null ? formatNum(stats.posts) : "0");
    setText("pv-stat-likes", stats.likes != null ? formatNum(stats.likes) : "0");
    setText("pv-stat-views", stats.views != null ? formatNum(stats.views) : "0");
    setText("pv-stat-joined", stats.joined || "—");

    const posts = user.posts || [];
    setText("pv-posts-count", `${posts.length} post${posts.length === 1 ? "" : "s"}`);
    renderTweets(posts, user);
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  /* ============================================================
     RENDER TWEETS FEED — via unified renderer
     ============================================================ */
  function renderTweets(posts, user) {
    const container = document.getElementById("pv-posts");
    if (!container) return;

    if (!posts.length) {
      container.innerHTML = `
        <div class="pv-empty">
          <div class="pv-empty-icon"><i data-lucide="ghost"></i></div>
          <h3 class="pv-empty-title">No whispers yet</h3>
          <p class="pv-empty-text">
            ${escapeHTML(user.name || "This user")} hasn't shared anything publicly. Yet.
          </p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons({ root: container });
      return;
    }

    /* Normalize posts to unified shape */
    const normalized = posts.map((p) => ({
      id: p.id,
      name: user.name || "Anonymous",
      handle: user.handle || "",
      avatar: user.avatar || null,
      verified: !!user.verified,
      views: p.views || null,
      text: p.text || "",
      images: p.images || (p.image ? [p.image] : []),
      audios: p.audios || (p.audio ? [p.audio] : []),
      files: p.files || [],
      likes: p.likes || 0,
      comments: p.comments || 0,
      commentsList: p.commentsList || [],
    }));

    container.innerHTML = VexecTweet.renderList(normalized, { variant: "pv" });
    VexecTweet.afterRender(container);
  }

  /* ============================================================
     MAIN LOAD
     ============================================================ */
  async function load(username) {
    if (!username) return;
    const token = ++requestToken;
    currentUsername = username;
    if (!document.querySelector(".pv-page")) return;

    showLoading();

    try {
      const user = await fetchUser(username);
      if (token !== requestToken) return;
      if (currentUsername !== username) return;

      if (!user) {
        show404(username);
        document.title = `@${username} not found – Vexec`;
        return;
      }

      renderUser(user, username);
      showContent();
      document.title = `${user.name || "@" + username} – Vexec`;
    } catch (err) {
      if (token !== requestToken) return;
      console.error("[profile_view] load error:", err);
      show404(username);
    }
  }

  /* ============================================================
     ROUTE HOOKS
     ============================================================ */
  document.addEventListener("route:change", (e) => {
    const params = e.detail && e.detail.params;
    if (params && params.username) setTimeout(() => load(params.username), 40);
  });

  document.addEventListener("DOMContentLoaded", () => {
    const m = window.location.pathname.match(/\/u\/([^/]+)\/?$/);
    if (m) {
      const username = decodeURIComponent(m[1]);
      setTimeout(() => load(username), 120);
    }
  });

  /* ============================================================
     ACTION BUTTONS
     ============================================================ */
  document.addEventListener("click", (e) => {
    if (!document.querySelector(".pv-page")) return;

    const navBtn = e.target.closest(".pv-nav-btn");
    if (navBtn) {
      const action = navBtn.dataset.action;
      if (action === "back") {
        e.preventDefault();
        e.stopPropagation();
        if (window.history.length > 1) window.history.back();
        else if (window.router) window.router.navigate("/");
        return;
      }
      return;
    }

    const actionEl = e.target.closest(".pv-action[data-action]");
    if (!actionEl) return;
    const action = actionEl.dataset.action;

    if (action === "share") {
      e.stopPropagation();
      const url = window.location.href;
      const done = () => {
        actionEl.classList.add("is-done");
        setTimeout(() => actionEl.classList.remove("is-done"), 900);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done).catch(done);
      } else {
        done();
      }
      return;
    }
    if (action === "report") { e.stopPropagation(); console.log("[profile_view] report:", currentUsername); return; }
    if (action === "whisper") { e.stopPropagation(); console.log("[profile_view] whisper to:", currentUsername); return; }
  });

  /* Image lightbox — home.js handles [data-lightbox] globally */
  document.addEventListener("click", (e) => {
    const cell = e.target.closest(".tweet-image");
    if (!cell) return;
    const img = cell.querySelector("img");
    if (!img || !img.src) return;
    if (window.openLightbox) window.openLightbox(img.src, img.alt || "image");
  });

  window.VexecProfileView = {
    load,
    get current() { return currentUsername; },
  };
})();