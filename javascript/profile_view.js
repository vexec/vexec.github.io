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

<<<<<<< HEAD
=======
<<<<<<< HEAD
=======
  function formatBytes(bytes) {
    if (!bytes) return "0 B";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + " MB";
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  }

  function iconForFileType(type, name) {
    const n = (name || "").toLowerCase();
    if (type === "pdf" || n.endsWith(".pdf")) return "file-text";
    if (/\.(docx?|rtf|odt)$/.test(n)) return "file-text";
    if (/\.(xlsx?|csv|ods)$/.test(n)) return "file-spreadsheet";
    if (/\.(zip|rar|7z|tar|gz)$/.test(n)) return "file-archive";
    return "file";
  }

>>>>>>> fe5a5742073570dc4d4a912f3c8c1dc5ed31f50b
>>>>>>> 8eb15df9b261f9e522d88239c23f1213550675a3
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
<<<<<<< HEAD
     RENDER TWEETS FEED — via unified renderer
=======
<<<<<<< HEAD
     RENDER TWEETS FEED — via unified renderer
=======
     RENDER TWEETS FEED
>>>>>>> fe5a5742073570dc4d4a912f3c8c1dc5ed31f50b
>>>>>>> 8eb15df9b261f9e522d88239c23f1213550675a3
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

<<<<<<< HEAD
=======
<<<<<<< HEAD
>>>>>>> 8eb15df9b261f9e522d88239c23f1213550675a3
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

<<<<<<< HEAD
=======
=======
    container.innerHTML = posts.map((p) => renderTweet(p, user)).join("");
    if (window.lucide) window.lucide.createIcons({ root: container });
    if (window.VexecImageLoader) setTimeout(() => window.VexecImageLoader.scan(container), 30);
  }

function renderTweet(p, user) {
  const avatarWrap = `
    <div class="avatar-wrap ${user.verified ? "is-verified" : ""}" data-size="md">
      <div class="tweet-avatar">
        ${user.avatar ? `<img src="${escapeHTML(user.avatar)}" alt="" loading="lazy" />` : ""}
      </div>
    </div>
  `;

  const verified = user.verified
    ? `<svg class="verified" viewBox="0 0 24 24" fill="currentColor" aria-label="Verified"><path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z"/></svg>`
    : "";

  const attachmentsHTML = renderAttachments(p);
  const commentsHTML = (p.commentsList || []).map(renderComment).join("");

  return `
    <article class="tweet" data-post-id="${escapeHTML(p.id)}">
      ${avatarWrap}
      <div class="tweet-body">
        <div class="tweet-meta">
          <span class="tweet-name">${escapeHTML(user.name || "Anonymous")}${verified}</span>
          <span class="tweet-handle">${escapeHTML(user.handle || "")}</span>
          <span class="tweet-views"><i data-lucide="eye"></i>${escapeHTML(String(p.views || "0"))}</span>
        </div>
        <p class="tweet-text">${escapeHTML(p.text || "")}</p>
        <div class="tweet-attachments">${attachmentsHTML}</div>
        <div class="tweet-actions">
          <div class="tweet-actions-left">
            <button class="tweet-action" data-action="like" aria-label="Like">
              <i data-lucide="heart"></i><span>${formatNum(p.likes || 0)}</span>
            </button>
            <button class="tweet-action" data-action="comment" aria-label="Comment">
              <i data-lucide="message-circle"></i><span>${formatNum(p.comments || 0)}</span>
            </button>
          </div>
          <div class="tweet-actions-right">
            <button class="tweet-menu-btn" aria-label="More"><i data-lucide="more-horizontal"></i></button>
          </div>
        </div>
        <div class="tweet-comments">
          <div class="tweet-comments-collapse">
            <div class="tweet-comments-inner">
              <header class="comments-header">
                <span class="comments-title"><i data-lucide="message-circle"></i>Comments</span>
                <button class="comments-close" type="button" aria-label="Close comments"><i data-lucide="x"></i></button>
              </header>
              <div class="comments-list">${commentsHTML}</div>
              <button class="comments-see-more" type="button"><span>See More</span><i data-lucide="chevron-down"></i></button>
              <form class="comment-form" autocomplete="off">
                <div class="comment-attach">
                  <button class="comment-attach-btn" type="button" aria-label="Attach"><i data-lucide="plus"></i></button>
                  <div class="comment-attach-menu">
                    <button class="comment-attach-item" type="button" data-attach="image"><i data-lucide="image"></i><span>Image</span></button>
                    <button class="comment-attach-item" type="button" data-attach="music"><i data-lucide="music"></i><span>Music</span></button>
                    <button class="comment-attach-item" type="button" data-attach="document"><i data-lucide="file-text"></i><span>Document</span></button>
                    <button class="comment-attach-item comment-attach-camera" type="button" data-attach="camera"><i data-lucide="camera"></i><span>Camera</span></button>
                  </div>
                </div>
                <input type="text" class="comment-input" placeholder="Write a comment..." aria-label="Write a comment" />
                <button type="submit" class="comment-send" aria-label="Send"><i data-lucide="send-horizontal"></i></button>
              </form>
            </div>
          </div>
        </div>
      </div>
      <div class="tweet-overlay" aria-hidden="true">
        <div class="tweet-overlay-card">
          <button class="overlay-action" data-action="save">
            <i data-lucide="bookmark" class="icon-unsaved"></i>
            <i data-lucide="bookmark-check" class="icon-saved"></i>
            <span>Save</span>
          </button>
          <button class="overlay-action" data-action="copy"><i data-lucide="link"></i><span>Copy Link</span></button>
          <button class="overlay-action" data-action="report"><i data-lucide="flag"></i><span>Report</span></button>
          <button class="overlay-action overlay-close" data-action="close"><i data-lucide="x"></i><span>Close</span></button>
        </div>
      </div>
    </article>
  `;
}

  /* ============================================================
     ATTACHMENTS
     ============================================================ */
  function renderAttachments(p) {
    const parts = [];
    const images = p.images || (p.image ? [p.image] : []);
    const audios = p.audios || (p.audio ? [p.audio] : []);
    const files = p.files || [];

    if (images.length) parts.push(renderImageGrid(images));
    for (const a of audios) parts.push(renderAudioCard(a));
    for (const f of files) parts.push(renderFileCard(f));
    return parts.join("");
  }

  function renderImageGrid(images) {
    const visibleCount = Math.min(images.length, 5);
    const extra = images.length - 5;
    const cells = images
      .slice(0, visibleCount)
      .map((src, i) => {
        const isLastAndMore = i === 4 && extra > 0;
        return `<div class="tweet-image ${isLastAndMore ? "is-more" : ""}"
                     ${isLastAndMore ? `data-more="${extra}"` : ""}
                     data-index="${i}">
                  <img src="${escapeHTML(src)}" alt="" loading="lazy" />
                </div>`;
      })
      .join("");
    return `<div class="tweet-images" data-count="${visibleCount}">${cells}</div>`;
  }

  function renderAudioCard(a) {
    const coverHTML = a.cover
      ? `<img src="${escapeHTML(a.cover)}" alt="" loading="lazy" />`
      : `<i data-lucide="music"></i>`;
    return `
      <div class="comment-audio"
           data-audio-url="${escapeHTML(a.url)}"
           data-audio-name="${escapeHTML(a.name)}"
           data-audio-size="${a.size || 0}"
           data-audio-cover="${escapeHTML(a.cover || "")}">
        <div class="comment-audio-cover">${coverHTML}</div>
        <div class="comment-audio-info">
          <span class="comment-audio-name">${escapeHTML(a.name)}</span>
          <span class="comment-audio-meta">${formatBytes(a.size || 0)}</span>
        </div>
        <button class="comment-audio-download" type="button" aria-label="Download"><i data-lucide="download"></i></button>
        <button class="comment-audio-play" type="button" aria-label="Play">
          <i data-lucide="play" class="icon-play"></i>
          <i data-lucide="pause" class="icon-pause"></i>
          <i data-lucide="rotate-ccw" class="icon-replay"></i>
        </button>
        <div class="comment-audio-loading"><i data-lucide="loader-circle"></i></div>
      </div>
    `;
  }

  function renderFileCard(f) {
    const icon = iconForFileType(f.type, f.name);
    return `
      <div class="tweet-file" data-file-url="${escapeHTML(f.url)}" data-file-name="${escapeHTML(f.name)}">
        <div class="tweet-file-icon"><i data-lucide="${icon}"></i></div>
        <div class="tweet-file-info">
          <span class="tweet-file-name">${escapeHTML(f.name)}</span>
          <span class="tweet-file-meta">${formatBytes(f.size || 0)}</span>
        </div>
        <button class="tweet-file-download" type="button" aria-label="Download"><i data-lucide="download"></i></button>
      </div>
    `;
  }

function renderComment(c) {
  const avatarInner = c.avatar
    ? `<img src="${escapeHTML(c.avatar)}" alt="" loading="lazy" />`
    : "";
  const imageHTML = c.image
    ? `<div class="comment-media"><img src="${escapeHTML(c.image)}" alt="" loading="lazy" /></div>`
    : "";
  return `
    <article class="comment">
      <div class="avatar-wrap" data-size="sm">
        <div class="comment-avatar">${avatarInner}</div>
      </div>
      <div class="comment-body">
        <div class="comment-meta">
          <span class="comment-name">${escapeHTML(c.name || "Anonymous")}</span>
          <span class="comment-handle">${escapeHTML(c.handle || "")}</span>
        </div>
        <p class="comment-text">${escapeHTML(c.text || "")}</p>
        ${imageHTML}
      </div>
    </article>
  `;
}

>>>>>>> fe5a5742073570dc4d4a912f3c8c1dc5ed31f50b
>>>>>>> 8eb15df9b261f9e522d88239c23f1213550675a3
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
<<<<<<< HEAD
=======
<<<<<<< HEAD
=======

      if (typeof setupAttachments === "function") setupAttachments();
      if (typeof setupAudioPlayButtons === "function") setupAudioPlayButtons();
      if (typeof setupMediaLoaders === "function") setupMediaLoaders();
      if (typeof setupCameraAvailability === "function") setupCameraAvailability();
      if (typeof setupCommentEmoji === "function") setupCommentEmoji();
>>>>>>> fe5a5742073570dc4d4a912f3c8c1dc5ed31f50b
>>>>>>> 8eb15df9b261f9e522d88239c23f1213550675a3
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

<<<<<<< HEAD
  /* Image lightbox — home.js handles [data-lightbox] globally */
=======
<<<<<<< HEAD
  /* Image lightbox — home.js handles [data-lightbox] globally */
=======
>>>>>>> fe5a5742073570dc4d4a912f3c8c1dc5ed31f50b
>>>>>>> 8eb15df9b261f9e522d88239c23f1213550675a3
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