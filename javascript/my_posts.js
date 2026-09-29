/* ============================================================
   MY POSTS — /my-posts  (API-driven)
   ============================================================ */

(function () {
  "use strict";

  const PIN_KEY = "vexec:my-posts:pinned:v1";
  const DEL_KEY = "vexec:my-posts:deleted:v1";

  /* ============================================================
     STATE
     ============================================================ */
  let posts = [];
  let filter = "all";
  let pinnedIds = new Set();
  let deletedIds = new Set();

  /* ============================================================
     HELPERS
     ============================================================ */
  function formatNum(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(n);
  }

  function formatExact(n) {
    return n.toLocaleString("en-US");
  }

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function loadPinned() {
    try {
      const raw = localStorage.getItem(PIN_KEY);
      pinnedIds = new Set(raw ? JSON.parse(raw) : []);
    } catch (_) {
      pinnedIds = new Set();
    }
  }
  function savePinned() {
    try { localStorage.setItem(PIN_KEY, JSON.stringify([...pinnedIds])); } catch (_) {}
  }

  function loadDeleted() {
    try {
      const raw = localStorage.getItem(DEL_KEY);
      deletedIds = new Set(raw ? JSON.parse(raw) : []);
    } catch (_) {
      deletedIds = new Set();
    }
  }
  function saveDeleted() {
    try { localStorage.setItem(DEL_KEY, JSON.stringify([...deletedIds])); } catch (_) {}
  }

  /* ============================================================
     API
     ============================================================ */
  async function fetchMyPosts() {
    const res = await API.get("/api/me/posts");
    const data = API.unwrap(res);
    return data.filter((p) => !deletedIds.has(p.id));
  }

  /* ============================================================
     RENDER
     ============================================================ */
  function applyFilter(list) {
    if (filter === "pinned") return list.filter((p) => pinnedIds.has(p.id));
    if (filter === "media") return list.filter((p) => (p.images || []).length > 0);
    if (filter === "audio") return list.filter((p) => (p.audios || []).length > 0);
    return list;
  }

  function sortPinnedFirst(list) {
    return [...list].sort((a, b) => {
      const aPinned = pinnedIds.has(a.id) ? 1 : 0;
      const bPinned = pinnedIds.has(b.id) ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return (b.timestamp || 0) - (a.timestamp || 0);
    });
  }

  function renderSummary(list) {
    const total = list.length;
    const views = list.reduce((s, p) => s + (p.views || 0), 0);
    const likes = list.reduce((s, p) => s + (p.likes || 0), 0);
    const pinned = list.filter((p) => pinnedIds.has(p.id)).length;

    setText("mp-total", formatExact(total));
    setText("mp-views", formatNum(views));
    setText("mp-likes", formatNum(likes));
    setText("mp-pinned", formatExact(pinned));
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function renderSkeleton() {
    const listEl = document.getElementById("mp-list");
    if (!listEl) return;
    listEl.innerHTML = Array(3).fill(0).map(() => `
      <div class="sk-mp-card">
        <div class="sk-mp-header">
          <div class="skeleton sk-line sk-line-sm"></div>
          <div class="skeleton sk-action" style="width:60px"></div>
        </div>
        <div class="skeleton sk-line sk-line-lg"></div>
        <div class="skeleton sk-line sk-line-mid"></div>
        <div class="sk-mp-stats">
          <div class="skeleton sk-mp-stat"></div>
          <div class="skeleton sk-mp-stat"></div>
          <div class="skeleton sk-mp-stat"></div>
          <div class="skeleton sk-mp-stat"></div>
        </div>
      </div>
    `).join("");
  }

  function renderList() {
    const container = document.getElementById("mp-list");
    if (!container) return;

    const filtered = sortPinnedFirst(applyFilter(posts));

    if (!filtered.length) {
      const messages = {
        all: { icon: "ghost", title: "No whispers yet", text: "You haven't posted anything. Head over to Write and share your first whisper." },
        pinned: { icon: "pin-off", title: "Nothing pinned", text: "Pin a post to keep it at the top of your list." },
        media: { icon: "image-off", title: "No media posts", text: "You haven't posted anything with images yet." },
        audio: { icon: "music", title: "No audio posts", text: "You haven't shared any audio yet." },
      };
      const m = messages[filter] || messages.all;
      container.innerHTML = `
        <div class="mp-empty">
          <div class="mp-empty-icon"><i data-lucide="${m.icon}"></i></div>
          <h3 class="mp-empty-title">${m.title}</h3>
          <p class="mp-empty-text">${m.text}</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons({ root: container });
      return;
    }

    container.innerHTML = filtered.map(renderCard).join("");
    if (window.lucide) window.lucide.createIcons({ root: container });
  }

  function renderCard(p) {
    const isPinned = pinnedIds.has(p.id);
    const imagesCount = (p.images || []).length;
    const audiosCount = (p.audios || []).length;
    const filesCount = (p.files || []).length;

    const mediaChips = [];
    if (imagesCount) mediaChips.push(`<span class="mp-media-chip"><i data-lucide="image"></i>${imagesCount}</span>`);
    if (audiosCount) mediaChips.push(`<span class="mp-media-chip"><i data-lucide="music"></i>${audiosCount}</span>`);
    if (filesCount) mediaChips.push(`<span class="mp-media-chip"><i data-lucide="file-text"></i>${filesCount}</span>`);

    return `
      <article class="mp-card ${isPinned ? "is-pinned" : ""}" data-post-id="${escapeHTML(p.id)}">
        <div class="mp-card-header">
          ${isPinned ? `<span class="mp-card-badge"><i data-lucide="pin"></i> Pinned</span>` : ""}
          <span class="mp-card-date">${escapeHTML(p.createdAt || "")}</span>
          <div class="mp-card-actions">
            <button class="mp-action mp-pin ${isPinned ? "is-active" : ""}" type="button" data-pin="${escapeHTML(p.id)}" aria-label="${isPinned ? "Unpin" : "Pin"}" title="${isPinned ? "Unpin" : "Pin"}">
              <i data-lucide="pin"></i>
            </button>
            <button class="mp-action mp-delete" type="button" data-delete="${escapeHTML(p.id)}" aria-label="Delete" title="Delete">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>
        <p class="mp-card-text">${escapeHTML(p.text || "")}</p>
        ${mediaChips.length ? `<div class="mp-card-media">${mediaChips.join("")}</div>` : ""}
        <div class="mp-card-stats">
          <div class="mp-stat is-views">
            <span class="mp-stat-value" title="${formatExact(p.views || 0)}">${formatNum(p.views || 0)}</span>
            <span class="mp-stat-label">Views</span>
          </div>
          <div class="mp-stat is-likes">
            <span class="mp-stat-value" title="${formatExact(p.likes || 0)}">${formatNum(p.likes || 0)}</span>
            <span class="mp-stat-label">Likes</span>
          </div>
          <div class="mp-stat is-comments">
            <span class="mp-stat-value" title="${formatExact(p.comments || 0)}">${formatNum(p.comments || 0)}</span>
            <span class="mp-stat-label">Comments</span>
          </div>
          <div class="mp-stat is-saves">
            <span class="mp-stat-value" title="${formatExact(p.saves || 0)}">${formatNum(p.saves || 0)}</span>
            <span class="mp-stat-label">Saves</span>
          </div>
        </div>
      </article>
    `;
  }

  /* ============================================================
     ACTIONS
     ============================================================ */
  function togglePin(id) {
    if (pinnedIds.has(id)) pinnedIds.delete(id);
    else pinnedIds.add(id);
    savePinned();
    renderSummary(posts);
    renderList();

    /* Fire-and-forget API */
    API.patch(`/api/me/posts/${encodeURIComponent(id)}/pin`, { pinned: pinnedIds.has(id) })
      .catch((err) => console.warn("[my_posts] pin failed", err));
  }

  function confirmDelete(id) {
    const post = posts.find((p) => p.id === id);
    if (!post) return;

    const preview = (post.text || "").slice(0, 70);
    const backdrop = document.createElement("div");
    backdrop.className = "mp-confirm-backdrop";
    backdrop.innerHTML = `
      <div class="mp-confirm-card">
        <div class="mp-confirm-icon"><i data-lucide="trash-2"></i></div>
        <h3 class="mp-confirm-title">Delete this whisper?</h3>
        <p class="mp-confirm-text">
          "${escapeHTML(preview)}${preview.length >= 70 ? "…" : ""}"
          <br /><br />
          This action cannot be undone.
        </p>
        <div class="mp-confirm-actions">
          <button class="mp-confirm-btn" type="button" data-confirm="cancel">Cancel</button>
          <button class="mp-confirm-btn mp-confirm-danger" type="button" data-confirm="ok">Delete</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => backdrop.classList.add("open"));
    if (window.lucide) window.lucide.createIcons({ root: backdrop });

    const close = () => {
      backdrop.classList.remove("open");
      document.body.style.overflow = "";
      setTimeout(() => backdrop.remove(), 250);
    };

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) return close();
      const btn = e.target.closest("[data-confirm]");
      if (!btn) return;
      if (btn.dataset.confirm === "ok") { close(); doDelete(id); }
      else close();
    });
  }

  function doDelete(id) {
    deletedIds.add(id);
    saveDeleted();
    pinnedIds.delete(id);
    savePinned();
    posts = posts.filter((p) => p.id !== id);
    renderSummary(posts);
    renderList();

    API.delete(`/api/me/posts/${encodeURIComponent(id)}`)
      .catch((err) => console.warn("[my_posts] delete failed", err));
  }

  /* ============================================================
     CLICK HANDLERS
     ============================================================ */
  document.addEventListener("click", (e) => {
    if (!document.querySelector(".mp-page")) return;

    const pinBtn = e.target.closest("[data-pin]");
    if (pinBtn) { e.stopPropagation(); togglePin(pinBtn.dataset.pin); return; }

    const delBtn = e.target.closest("[data-delete]");
    if (delBtn) { e.stopPropagation(); confirmDelete(delBtn.dataset.delete); return; }

    const tab = e.target.closest(".mp-tab");
    if (tab) {
      e.stopPropagation();
      filter = tab.dataset.filter || "all";
      document.querySelectorAll(".mp-tab").forEach((t) => t.classList.toggle("active", t === tab));
      renderList();
      return;
    }
  });

  /* ============================================================
     INIT
     ============================================================ */
  async function init() {
    if (!document.querySelector(".mp-page")) return;
    loadPinned();
    loadDeleted();
    renderSkeleton();

    try {
      posts = await fetchMyPosts();
      renderSummary(posts);
      renderList();
    } catch (err) {
      console.error("[my_posts] load error:", err);
      posts = [];
      renderSummary(posts);
      renderList();
    }
  }

  document.addEventListener("route:change", (e) => {
    if (e.detail && e.detail.path === "/my-posts") setTimeout(init, 50);
  });
  document.addEventListener("DOMContentLoaded", () => {
    if (window.location.pathname.endsWith("/my-posts")) setTimeout(init, 120);
  });
})();