/* ============================================================
   Saved — API-driven
   ============================================================ */

let savedData = { audios: [], posts: [] };

/* ============================================================
   Queue render
   ============================================================ */
let savedRenderQueued = false;

function queueRender() {
  if (savedRenderQueued) return;
  savedRenderQueued = true;
  requestAnimationFrame(() => {
    savedRenderQueued = false;
    renderSaved();
  });
}

/* ============================================================
   API LOAD
   ============================================================ */
async function loadSavedFromAPI() {
  const skeletonEl = document.getElementById("saved-skeleton");
  const listEl = document.querySelector(".saved-list");
  const emptyEl = document.querySelector(".saved-empty");

  if (skeletonEl) skeletonEl.hidden = false;
  if (listEl) listEl.hidden = true;
  if (emptyEl) emptyEl.style.display = "none";

  try {
    const res = await API.get("/api/saved");
    const data = API.unwrap(res);
    savedData = {
      audios: Array.isArray(data.audios) ? data.audios : [],
      posts: Array.isArray(data.posts) ? data.posts : [],
    };
  } catch (err) {
    console.error("[saved] load error", err);
    savedData = { audios: [], posts: [] };
  }

  if (skeletonEl) skeletonEl.hidden = true;
  if (listEl) listEl.hidden = false;
  queueRender();
}

/* ============================================================
   Click handling — only Saved-specific
   (audio play + audio download handled by home.js)
   ============================================================ */
document.addEventListener("click", (e) => {
  const filterBtn = e.target.closest(".saved-filter-btn");
  const filterItem = e.target.closest(".saved-filter-item");
  const filterRoot = document.querySelector(".saved-filter");

  if (filterBtn) {
    e.stopPropagation();
    filterRoot.classList.toggle("open");
    return;
  }

  if (filterItem) {
    e.stopPropagation();
    filterRoot.querySelectorAll(".saved-filter-item").forEach((i) => i.classList.remove("active"));
    filterItem.classList.add("active");
    filterRoot.dataset.filter = filterItem.dataset.value;
    filterRoot.querySelector(".saved-filter-value").textContent =
      filterItem.querySelector("span").textContent;
    filterRoot.classList.remove("open");
    queueRender();
    return;
  }

  if (filterRoot && !filterRoot.contains(e.target)) {
    filterRoot.classList.remove("open");
  }

  const viewBtn = e.target.closest(".saved-post-view");
  if (viewBtn) {
    e.stopPropagation();
    return;
  }

  /* ---- Saved audio item (card on the list) — toggle or play ----
     home.js does NOT handle .saved-item[data-type=audio],
     so we handle it here with toggle support. */
  const audioItem = e.target.closest('.saved-item[data-type="audio"]');
  if (
    audioItem &&
    !e.target.closest(".saved-item-remove") &&
    !e.target.closest(".saved-item-source")
  ) {
    e.stopPropagation();
    e.preventDefault();
    const url = audioItem.dataset.url;
    const name = audioItem.dataset.name || "Audio";
    const size = parseInt(audioItem.dataset.size || "0", 10);
    const cover = audioItem.dataset.cover || null;
    if (!url || !window.VexecPlayer) return;

    /* If this item is already the current track → toggle */
    if (window.VexecPlayer.isCurrent && window.VexecPlayer.isCurrent(url)) {
      window.VexecPlayer.toggle();
    } else {
      window.VexecPlayer.play(url, name, size, cover, audioItem);
    }
    return;
  }

  const removeBtn = e.target.closest(".saved-item-remove, .saved-post-remove");
  if (removeBtn) {
    e.stopPropagation();
    const item = removeBtn.closest(".saved-item");
    if (!item) return;
    const id = item.dataset.id;
    const type = item.dataset.type;

    if (type === "audio") {
      savedData.audios = savedData.audios.filter((a) => a.id !== id);
    } else {
      savedData.posts = savedData.posts.filter((p) => p.id !== id);
    }

    API.delete(`/api/saved/${encodeURIComponent(id)}`).catch((err) => {
      console.warn("[saved] delete failed", err);
    });

    queueRender();
    return;
  }
});

/* ============================================================
   Search input
   ============================================================ */
document.addEventListener("input", (e) => {
  if (e.target.closest(".saved-search-input")) queueRender();
});

/* ============================================================
   Render saved list
   ============================================================ */
async function renderSaved() {
  const list = document.querySelector(".saved-list");
  if (!list) return;

  const filterRoot = document.querySelector(".saved-filter");
  const filter = filterRoot ? filterRoot.dataset.filter || "all" : "all";
  const queryInput = document.querySelector(".saved-search-input");
  const query = queryInput ? queryInput.value.trim().toLowerCase() : "";

  const data = {
    audios: savedData.audios.slice(),
    posts: savedData.posts.slice(),
  };

  let items = [
    ...data.audios.map((a) => ({ ...a, type: "audio" })),
    ...data.posts.map((p) => ({ ...p, type: "post" })),
  ].sort((a, b) => new Date(b.saved_at || 0) - new Date(a.saved_at || 0));

  if (filter === "audio") items = items.filter((i) => i.type === "audio");
  else if (filter === "post") items = items.filter((i) => i.type === "post");

  if (query) {
    items = items.filter((item) => {
      if (item.type === "audio") {
        return (
          (item.name || "").toLowerCase().includes(query) ||
          (item.artist || "").toLowerCase().includes(query) ||
          (item.sourceLabel || "").toLowerCase().includes(query)
        );
      }
      return (
        (item.text || "").toLowerCase().includes(query) ||
        (item.name || "").toLowerCase().includes(query) ||
        (item.handle || "").toLowerCase().includes(query)
      );
    });
  }

  const empty = document.querySelector(".saved-empty");

  if (items.length === 0) {
    list.innerHTML = "";
    if (empty) empty.style.display = "flex";
    return;
  }

  if (empty) empty.style.display = "none";
  list.innerHTML = items.map(renderSavedItem).join("");
  if (window.lucide) window.lucide.createIcons();
  if (window.VexecImageLoader) setTimeout(() => window.VexecImageLoader.scan(), 30);
}

/* ============================================================
   Renderers
   ============================================================ */
function renderSavedItem(item) {
  if (item.type === "audio") return renderAudioItem(item);
  return renderPostItem(item);
}

function renderAudioItem(item) {
  const cover = item.cover
    ? `<img src="${escapeHTML(item.cover)}" alt="" loading="lazy" /><i data-lucide="music" style="display:none"></i>`
    : `<i data-lucide="music"></i>`;

  const sourceHTML = item.sourceUrl
    ? `<a class="saved-item-source" data-route="${escapeHTML(item.sourceUrl)}">` +
      `<i data-lucide="link"></i>` +
      `<span>Saved from ${escapeHTML(item.sourceLabel || "Home")}</span>` +
      `</a>`
    : "";

  const metaParts = [];
  if (item.artist) metaParts.push(escapeHTML(item.artist));
  if (item.size) metaParts.push(formatBytes(item.size));

  return (
    `<article class="saved-item" data-type="audio" data-id="${escapeHTML(item.id)}" ` +
    `data-url="${escapeHTML(item.url)}" data-name="${escapeHTML(item.name)}" ` +
    `data-size="${item.size || 0}" data-cover="${escapeHTML(item.cover || "")}">` +
    `<div class="saved-item-cover">${cover}</div>` +
    `<div class="saved-item-body">` +
    `<span class="saved-item-badge"><i data-lucide="music"></i> Audio</span>` +
    `<h3 class="saved-item-title">${escapeHTML(item.name)}</h3>` +
    (metaParts.length ? `<p class="saved-item-meta">${metaParts.join(" · ")}</p>` : "") +
    sourceHTML +
    `</div>` +
    `<button class="saved-item-remove" type="button" aria-label="Remove">` +
    `<i data-lucide="bookmark-x"></i>` +
    `</button>` +
    `<button class="saved-item-play" type="button" aria-label="Play">` +
    `<i data-lucide="play"></i>` +
    `</button>` +
    `</article>`
  );
}

function renderPostItem(item) {
  const avatarInner = item.avatar
    ? `<img src="${escapeHTML(item.avatar)}" alt="" loading="lazy" />`
    : `<i data-lucide="user-round"></i>`;

  const avatarWrap = `
    <div class="saved-post-avatar-wrap ${item.verified ? "is-verified" : ""}">
      <div class="saved-post-avatar">${avatarInner}</div>
    </div>
  `;

  const imgHTML = item.image
    ? `<div class="saved-post-image"><img src="${escapeHTML(item.image)}" alt="" loading="lazy" /></div>`
    : "";

  let audioHTML = "";
  if (item.audio && item.audio.url) {
    const a = item.audio;
    const coverInner = a.cover
      ? `<img src="${escapeHTML(a.cover)}" alt="" loading="lazy" />`
      : `<i data-lucide="music"></i>`;
    audioHTML =
      `<div class="saved-post-audio" ` +
      `data-audio-url="${escapeHTML(a.url)}" ` +
      `data-audio-name="${escapeHTML(a.name || "Audio")}" ` +
      `data-audio-size="${a.size || 0}" ` +
      `data-audio-cover="${escapeHTML(a.cover || "")}">` +
      `<div class="saved-post-audio-cover">${coverInner}</div>` +
      `<div class="saved-post-audio-info">` +
      `<span class="saved-post-audio-name">${escapeHTML(a.name || "Audio")}</span>` +
      `<span class="saved-post-audio-meta">${formatBytes(a.size || 0)}</span>` +
      `</div>` +
      `<button class="saved-post-audio-play" type="button" aria-label="Play">` +
      `<i data-lucide="play"></i>` +
      `</button>` +
      `</div>`;
  }

  return (
    `<article class="saved-item saved-post" data-type="post" data-id="${escapeHTML(item.id)}">` +
    `<div class="saved-post-header">` +
    avatarWrap +
    `<div class="saved-post-meta">` +
    `<span class="saved-post-name">${escapeHTML(item.name)}</span>` +
    `<span class="saved-post-handle">${escapeHTML(item.handle || "")}</span>` +
    `</div>` +
    `<span class="saved-item-badge"><i data-lucide="bookmark"></i> Post</span>` +
    `</div>` +
    `<p class="saved-post-text">${escapeHTML(item.text)}</p>` +
    imgHTML +
    audioHTML +
    `<button class="saved-post-view" type="button">` +
    `<i data-lucide="maximize-2"></i>` +
    `<span>View full post</span>` +
    `</button>` +
    `<div class="saved-post-footer">` +
    `<span class="saved-post-time">saved ${timeAgo(item.saved_at)}</span>` +
    `<button class="saved-post-remove" type="button" aria-label="Unsave">` +
    `<i data-lucide="bookmark-x"></i>` +
    `<span>Unsave</span>` +
    `</button>` +
    `</div>` +
    `</article>`
  );
}

/* ============================================================
   Header hide on scroll
   ============================================================ */
(function () {
  let lastY = 0;
  let ticking = false;

  function onScroll() {
    const header = document.querySelector(".saved-header");
    if (!header) { ticking = false; return; }
    const y = window.scrollY;
    const diff = y - lastY;

    if (y < 80) header.classList.remove("hidden");
    else if (diff > 4) header.classList.add("hidden");
    else if (diff < -4) header.classList.remove("hidden");

    lastY = y;
    ticking = false;
  }

  window.addEventListener("scroll", () => {
    if (!ticking) {
      requestAnimationFrame(onScroll);
      ticking = true;
    }
  }, { passive: true });
})();

/* ============================================================
   Route change + initial render
   ============================================================ */
document.addEventListener("route:change", (e) => {
  if (e.detail && e.detail.path === "/saved") {
    setTimeout(() => {
      if (window.lucide) window.lucide.createIcons();
      loadSavedFromAPI();
    }, 40);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  if (window.location.pathname.endsWith("/saved")) {
    setTimeout(loadSavedFromAPI, 120);
  }
});

/* ============================================================
   Helpers
   ============================================================ */
function formatBytes(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts || 0).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return min + "m ago";
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + "h ago";
  const day = Math.floor(hr / 24);
  if (day < 30) return day + "d ago";
  const mo = Math.floor(day / 30);
  if (mo < 12) return mo + "mo ago";
  return Math.floor(mo / 12) + "y ago";
}