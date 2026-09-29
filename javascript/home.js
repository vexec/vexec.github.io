if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
  document.body.classList.add("is-mobile");
}

/* ============================================================
   State
   ============================================================ */
const pendingFiles = new WeakMap();

function hasSavedAPI() { return typeof window.SavedAPI !== "undefined"; }
function hasAudioCache() { return typeof window.AudioCache !== "undefined"; }

/* ============================================================
   Config
   ============================================================ */
window.VexecConfig = window.VexecConfig || {
  limits: {
    image: 5 * 1024 * 1024,
    audio: 10 * 1024 * 1024,
    document: 20 * 1024 * 1024,
    camera: 5 * 1024 * 1024,
    profile: 5 * 1024 * 1024,
  },
  logos: {},
};
const configLimits = window.VexecConfig.limits;

(async () => {
  try {
    const res = await fetch("./config.json", { cache: "no-cache" });
    if (res.ok) {
      const data = await res.json();
      if (data.limits) Object.assign(configLimits, data.limits);
      if (data.logos) window.VexecConfig.logos = data.logos;
    }
  } catch (err) {}
})();

/* ============================================================
   Hash helper
   ============================================================ */
function hashText(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/* ============================================================
   FEED
   ============================================================ */
function buildTweetSkeleton() {
  return Array(3).fill(0).map(() => `
    <div class="sk-tweet">
      <div class="skeleton sk-tweet-avatar"></div>
      <div class="sk-tweet-body">
        <div class="skeleton sk-line sk-line-sm"></div>
        <div class="skeleton sk-line sk-line-lg"></div>
        <div class="skeleton sk-line sk-line-mid"></div>
        <div class="skeleton sk-media"></div>
        <div class="sk-actions">
          <div class="skeleton sk-action"></div>
          <div class="skeleton sk-action"></div>
        </div>
      </div>
    </div>
  `).join("");
}

function renderFeedFromAPI(posts) {
  const container = document.getElementById("feed-content");
  if (!container) return;

  container.innerHTML = VexecTweet.renderList(posts, { variant: "home" });
  VexecTweet.afterRender(container);
}

async function loadFeed() {
  const feedEl = document.querySelector(".feed");
  if (!feedEl) return;
  if (feedEl.dataset.loading === "1") return;
  feedEl.dataset.loading = "1";
  if (!feedEl.dataset.backupHtml) feedEl.dataset.backupHtml = feedEl.innerHTML;
  feedEl.innerHTML = `<div class="feed-skeleton">${buildTweetSkeleton()}</div><div class="feed-content" id="feed-content" hidden></div>`;

  try {
    const res = await API.get("/api/feed");
    const data = API.unwrap(res);
    renderFeedFromAPI(data);
    feedEl.querySelector(".feed-skeleton").hidden = true;
    feedEl.querySelector(".feed-content").hidden = false;
    if (typeof setupAttachments === "function") setupAttachments();
    if (typeof setupAudioPlayButtons === "function") setupAudioPlayButtons();
    if (typeof setupMediaLoaders === "function") setupMediaLoaders();
    if (typeof setupCameraAvailability === "function") setupCameraAvailability();
    if (typeof setupCommentEmoji === "function") setupCommentEmoji();
  } catch (err) {
    console.error("[feed]", err);
    feedEl.innerHTML = feedEl.dataset.backupHtml;
    if (window.lucide) window.lucide.createIcons();
    if (window.VexecImageLoader) setTimeout(() => window.VexecImageLoader.scan(), 30);
  } finally {
    feedEl.dataset.loading = "";
  }
}

document.addEventListener("route:change", (e) => {
  if (e.detail && e.detail.path === "/") setTimeout(loadFeed, 20);
});
document.addEventListener("DOMContentLoaded", () => {
  if (window.location.pathname === "/" || window.location.pathname.endsWith("/index.html")) {
    setTimeout(loadFeed, 80);
  }
});

/* ============================================================
   Setup helpers
   ============================================================ */
function setupAttachments() {
  document.querySelectorAll(".comment-form").forEach((form) => {
    const prev = form.previousElementSibling;
    if (prev && prev.classList.contains("comment-attachments")) return;
    const container = document.createElement("div");
    container.className = "comment-attachments";
    form.parentElement.insertBefore(container, form);
  });
}

function setupAudioPlayButtons() {
  document.querySelectorAll(".comment-audio-play").forEach((btn) => {
    const hasPlay = btn.querySelector('[data-lucide="play"]');
    const hasPause = btn.querySelector('[data-lucide="pause"]');
    const hasReplay = btn.querySelector('[data-lucide="rotate-ccw"]');
    if (hasPlay && hasPause && hasReplay) return;
    btn.innerHTML =
      '<i data-lucide="play" class="icon-play"></i>' +
      '<i data-lucide="pause" class="icon-pause"></i>' +
      '<i data-lucide="rotate-ccw" class="icon-replay"></i>';
  });
  if (window.lucide) window.lucide.createIcons();
}

function setPlayButtonState(btn, state) {
  if (!btn) return;
  btn.classList.remove("is-playing", "is-paused", "is-ended");
  btn.classList.add("is-" + state);
}

function showLimitModal({ title, message, icon = "alert-circle" }) {
  const existing = document.getElementById("limit-modal");
  if (existing) existing.remove();
  const modal = document.createElement("div");
  modal.id = "limit-modal";
  modal.className = "limit-modal";
  modal.innerHTML =
    '<div class="limit-modal-card">' +
    `<div class="limit-modal-icon"><i data-lucide="${icon}"></i></div>` +
    `<h3 class="limit-modal-title">${title}</h3>` +
    `<p class="limit-modal-message">${message}</p>` +
    '<button class="limit-modal-close" type="button">Got it</button>' +
    "</div>";
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add("open"));
  if (window.lucide) window.lucide.createIcons();
  const close = () => {
    modal.classList.remove("open");
    setTimeout(() => modal.remove(), 280);
  };
  modal.querySelector(".limit-modal-close").addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  const escHandler = (e) => {
    if (e.key === "Escape") { close(); document.removeEventListener("keydown", escHandler); }
  };
  document.addEventListener("keydown", escHandler);
}

/* ============================================================
   Lightbox
   ============================================================ */
let lightboxEl = null;
function ensureLightbox() {
  if (lightboxEl) return lightboxEl;
  const el = document.createElement("div");
  el.id = "image-lightbox";
  el.className = "image-lightbox";
  el.innerHTML =
    '<div class="lightbox-toolbar">' +
    '<button class="lightbox-btn" type="button" data-action="download" aria-label="Download"><i data-lucide="download"></i></button>' +
    '<button class="lightbox-btn" type="button" data-action="open" aria-label="Open in new tab"><i data-lucide="external-link"></i></button>' +
    '<button class="lightbox-btn" type="button" data-action="close" aria-label="Close"><i data-lucide="x"></i></button>' +
    "</div>" +
    '<img class="lightbox-image" alt="" />' +
    '<span class="lightbox-hint">Esc or click outside to close</span>';
  document.body.appendChild(el);
  if (window.lucide) window.lucide.createIcons({ root: el });

  el.addEventListener("click", (e) => {
    const btn = e.target.closest(".lightbox-btn");
    if (btn) {
      e.stopPropagation();
      const action = btn.dataset.action;
      const img = el.querySelector(".lightbox-image");
      if (action === "close") closeLightbox();
      else if (action === "open" && img.src) window.open(img.src, "_blank", "noopener");
      else if (action === "download" && img.src) downloadAsFile(img.src, "image");
      return;
    }
    if (e.target === el) closeLightbox();
  });
  lightboxEl = el;
  return el;
}
function openLightbox(src, alt) {
  const el = ensureLightbox();
  const img = el.querySelector(".lightbox-image");
  img.src = src;
  img.alt = alt || "image";
  el.classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeLightbox() {
  if (!lightboxEl) return;
  lightboxEl.classList.remove("open");
  lightboxEl.querySelector(".lightbox-image").src = "";
  document.body.style.overflow = "";
}
window.openLightbox = openLightbox;

/* ============================================================
   Download helper
   ============================================================ */
function downloadAsFile(url, filename) {
  if (!url) return;
  if (window.VexecDownload) {
    window.VexecDownload.download(url, filename || "file");
    return;
  }
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "file";
  a.target = "_blank";
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/* ============================================================
   Music Player
   ============================================================ */
const musicPlayer = {
  audio: null,
  current: null,
  mini: null,
  full: null,
  loop: false,
  activeCard: null,
};

function ensureMusicPlayer() {
  if (musicPlayer.audio) return musicPlayer.audio;
  const audio = document.createElement("audio");
  audio.preload = "metadata";
  audio.style.display = "none";
  document.body.appendChild(audio);
  musicPlayer.audio = audio;

  audio.addEventListener("play", () => {
    setBufferingUI(false);
    musicPlayer.mini?.classList.remove("is-ended");
    musicPlayer.full?.classList.remove("is-ended");
    musicPlayer.mini?.classList.add("is-playing");
    musicPlayer.full?.classList.add("is-playing");
    setPlayButtonState(musicPlayer.mini?.querySelector(".mini-play"), "playing");
    setPlayButtonState(musicPlayer.full?.querySelector(".full-play-btn"), "playing");
    syncActiveCard(true);
  });

  audio.addEventListener("pause", () => {
    musicPlayer.mini?.classList.remove("is-playing");
    musicPlayer.full?.classList.remove("is-playing");
    if (!musicPlayer.mini?.classList.contains("is-ended")) {
      setPlayButtonState(musicPlayer.mini?.querySelector(".mini-play"), "paused");
    }
    if (!musicPlayer.full?.classList.contains("is-ended")) {
      setPlayButtonState(musicPlayer.full?.querySelector(".full-play-btn"), "paused");
    }
    syncActiveCard(false);
  });

  audio.addEventListener("ended", () => {
    if (musicPlayer.current?.url && hasAudioCache()) AudioCache.warm(musicPlayer.current.url);
    if (musicPlayer.loop) { audio.currentTime = 0; audio.play().catch(() => {}); return; }
    musicPlayer.mini?.classList.add("is-ended");
    musicPlayer.full?.classList.add("is-ended");
    setPlayButtonState(musicPlayer.mini?.querySelector(".mini-play"), "ended");
    setPlayButtonState(musicPlayer.full?.querySelector(".full-play-btn"), "ended");
    syncActiveCard(false);
  });

  audio.addEventListener("timeupdate", updatePlayerProgress);
  audio.addEventListener("loadedmetadata", updatePlayerProgress);
  audio.addEventListener("waiting", () => setBufferingUI(true));
  audio.addEventListener("stalled", () => setBufferingUI(true));
  audio.addEventListener("playing", () => setBufferingUI(false));
  audio.addEventListener("canplay", () => setBufferingUI(false));
  audio.addEventListener("canplaythrough", () => setBufferingUI(false));
  audio.addEventListener("seeking", () => setBufferingUI(true));
  audio.addEventListener("seeked", () => setBufferingUI(false));

  audio.addEventListener("error", () => {
    setBufferingUI(false);
    musicPlayer.mini?.classList.remove("is-playing");
    musicPlayer.full?.classList.remove("is-playing");
    setPlayButtonState(musicPlayer.mini?.querySelector(".mini-play"), "paused");
    setPlayButtonState(musicPlayer.full?.querySelector(".full-play-btn"), "paused");
    syncActiveCard(false);
  });

  /* Build mini + full players NOW */
  musicPlayer.mini = ensureMiniPlayer();
  musicPlayer.full = ensureFullPlayer();

  return audio;
}

/* ============================================================
   Mini player (with direct listeners)
   ============================================================ */
function ensureMiniPlayer() {
  let el = document.getElementById("mini-player");
  if (el) return el;

  el = document.createElement("div");
  el.id = "mini-player";
  el.className = "mini-player";
  el.innerHTML =
    '<div class="mini-cover">' +
    '<img class="mini-cover-img" alt="" style="display:none" />' +
    '<i data-lucide="music" class="mini-cover-fallback"></i>' +
    "</div>" +
    '<div class="mini-info">' +
    '<div class="mini-name">Track</div>' +
    '<div class="mini-progress"><div class="mini-progress-fill"></div></div>' +
    "</div>" +
    '<button class="mini-play is-paused" type="button" aria-label="Play">' +
    '<i data-lucide="play" class="icon-play"></i>' +
    '<i data-lucide="pause" class="icon-pause"></i>' +
    '<i data-lucide="rotate-ccw" class="icon-replay"></i>' +
    "</button>" +
    '<button class="mini-close" type="button" aria-label="Close">' +
    '<i data-lucide="x"></i>' +
    "</button>";

  const corner = window.VexecCorner ? window.VexecCorner.get() : document.body;
  corner.appendChild(el);
  if (window.lucide) window.lucide.createIcons({ root: el });

  /* --- Direct listeners --- */
  const cover = el.querySelector(".mini-cover");
  const info = el.querySelector(".mini-info");
  const playBtn = el.querySelector(".mini-play");
  const closeBtn = el.querySelector(".mini-close");

  const handleExpand = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (el.classList.contains("is-minimized")) {
      /* Minimized → expand pill */
      expandMusicMini();
    } else {
      /* Expanded → open full player */
      openFullPlayer();
    }
  };
  cover.addEventListener("click", handleExpand);
  info.addEventListener("click", handleExpand);

  playBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const audio = musicPlayer.audio;
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  });

  closeBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeMiniPlayer();
  });

  /* Click on padding when minimized → expand */
  el.addEventListener("click", (e) => {
    if (e.target === el && el.classList.contains("is-minimized")) {
      e.preventDefault();
      e.stopPropagation();
      expandMusicMini();
    }
  });

  /* Corner events from download widget */
  window.addEventListener("vexec:corner", (e) => {
    if (!e.detail) return;
    if (e.detail.expanded === "download") el.classList.add("is-minimized");
    else if (e.detail.expanded === "music") el.classList.remove("is-minimized");
  });

  return el;
}

function expandMusicMini() {
  const mini = musicPlayer.mini;
  if (!mini) return;
  mini.classList.remove("is-minimized");
  window.dispatchEvent(new CustomEvent("vexec:corner", {
    detail: { expanded: "music" },
  }));
}

/* ============================================================
   Full player (with direct listeners)
   ============================================================ */
function ensureFullPlayer() {
  let el = document.getElementById("full-player");
  if (el) return el;

  el = document.createElement("div");
  el.id = "full-player";
  el.className = "full-player";
  el.innerHTML =
    '<button class="full-player-close" type="button" aria-label="Close">' +
    '<i data-lucide="x"></i>' +
    "</button>" +
    '<div class="full-player-content">' +
    '<div class="full-player-cover">' +
    '<div class="full-player-cover-fallback"><i data-lucide="music"></i></div>' +
    "</div>" +
    '<div class="full-player-info">' +
    '<span class="full-player-name">Track</span>' +
    '<span class="full-player-sub">Audio</span>' +
    "</div>" +
    '<div class="full-progress-track">' +
    '<div class="full-progress-fill"></div>' +
    "</div>" +
    '<div class="full-times">' +
    '<span class="full-time-current">0:00</span>' +
    '<span class="full-time-total">0:00</span>' +
    "</div>" +
    '<div class="full-controls">' +
    '<button class="full-side-btn full-loop-btn" type="button" aria-label="Loop"><i data-lucide="repeat"></i></button>' +
    '<button class="full-play-btn is-paused" type="button" aria-label="Play">' +
    '<i data-lucide="play" class="icon-play"></i>' +
    '<i data-lucide="pause" class="icon-pause"></i>' +
    '<i data-lucide="rotate-ccw" class="icon-replay"></i>' +
    "</button>" +
    '<div class="full-more-wrap">' +
    '<button class="full-side-btn full-more-btn" type="button" aria-label="More"><i data-lucide="more-horizontal"></i></button>' +
    '<div class="full-more-menu">' +
    '<button class="full-more-item" type="button" data-menu-action="download"><i data-lucide="download"></i><span>Download</span></button>' +
    '<button class="full-more-item" type="button" data-menu-action="save"><i data-lucide="bookmark" class="icon-unsaved"></i><i data-lucide="bookmark-check" class="icon-saved"></i><span>Save</span></button>' +
    "</div>" +
    "</div>" +
    "</div>" +
    "</div>";

  document.body.appendChild(el);
  if (window.lucide) window.lucide.createIcons({ root: el });

  /* --- Direct listeners --- */
  const content = el.querySelector(".full-player-content");
  const closeBtn = el.querySelector(".full-player-close");
  const playBtn = el.querySelector(".full-play-btn");
  const loopBtn = el.querySelector(".full-loop-btn");
  const moreBtn = el.querySelector(".full-more-btn");
  const moreWrap = el.querySelector(".full-more-wrap");
  const progress = el.querySelector(".full-progress-track");
  const downloadItem = el.querySelector('[data-menu-action="download"]');
  const saveItem = el.querySelector('[data-menu-action="save"]');

  /* Backdrop click */
  el.addEventListener("click", (e) => {
    if (e.target === el) closeFullPlayer();
  });
  /* Prevent bubble from content */
  content.addEventListener("click", (e) => e.stopPropagation());

  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    closeFullPlayer();
  });

  playBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const audio = musicPlayer.audio;
    if (!audio) return;
    const ended = el.classList.contains("is-ended") ||
                  musicPlayer.mini?.classList.contains("is-ended");
    if (ended) {
      audio.currentTime = 0;
      el.classList.remove("is-ended");
      musicPlayer.mini?.classList.remove("is-ended");
      setPlayButtonState(playBtn, "playing");
      setPlayButtonState(musicPlayer.mini?.querySelector(".mini-play"), "playing");
      audio.play().catch(() => {});
      return;
    }
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  });

  loopBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    musicPlayer.loop = !musicPlayer.loop;
    const audio = musicPlayer.audio;
    if (audio) audio.loop = musicPlayer.loop;
    el.classList.toggle("is-looping", musicPlayer.loop);
    musicPlayer.mini?.classList.toggle("is-looping", musicPlayer.loop);
  });

  moreBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    moreWrap.classList.toggle("open");
  });

  downloadItem.addEventListener("click", (e) => {
    e.stopPropagation();
    moreWrap.classList.remove("open");
    const cur = musicPlayer.current;
    if (cur) downloadAsFile(cur.url, cur.name || "audio");
  });

  saveItem.addEventListener("click", (e) => {
    e.stopPropagation();
    moreWrap.classList.remove("open");
    const cur = musicPlayer.current;
    if (!cur || !hasSavedAPI()) return;
    SavedAPI.toggleAudio({
      id: cur.url, url: cur.url, name: cur.name, size: cur.size,
      cover: cur.coverUrl, sourceUrl: "/home", sourceLabel: "Home",
    }).then((saved) => saveItem.classList.toggle("is-saved", saved));
  });

  progress.addEventListener("click", (e) => {
    e.stopPropagation();
    const audio = musicPlayer.audio;
    if (!audio || !audio.duration) return;
    const track = progress.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - track.left) / track.width));
    audio.currentTime = ratio * audio.duration;
    updatePlayerProgress();
  });

  return el;
}

/* ============================================================
   Play music
   ============================================================ */
function playMusic(url, name, size, coverUrl, cardEl) {
  const audio = ensureMusicPlayer();
  const mini = musicPlayer.mini;
  const full = musicPlayer.full;

  if (musicPlayer.activeCard && musicPlayer.activeCard !== cardEl) {
    musicPlayer.activeCard.classList.remove("is-playing", "is-paused");
    const prevBtn = musicPlayer.activeCard.querySelector(
      ".comment-audio-play, .pv-audio-play, .saved-post-audio-play, .saved-item-play"
    );
    setPlayButtonState(prevBtn, "paused");
  }
  musicPlayer.activeCard = cardEl || null;
  musicPlayer.current = { url, name, size, coverUrl: coverUrl || null };

  const miniName = mini.querySelector(".mini-name");
  if (miniName) miniName.textContent = name;
  const fullName = full.querySelector(".full-player-name");
  if (fullName) fullName.textContent = name;
  const fullSub = full.querySelector(".full-player-sub");
  if (fullSub) fullSub.textContent = size ? formatBytes(size) : "Audio";

  const fullCover = full.querySelector(".full-player-cover");
  if (fullCover) {
    let img = fullCover.querySelector("img");
    if (coverUrl) {
      if (!img) {
        img = document.createElement("img");
        img.alt = "";
        fullCover.insertBefore(img, fullCover.firstChild);
      }
      img.src = coverUrl;
      img.removeAttribute("data-img-loader");
      const fb = fullCover.querySelector(".full-player-cover-fallback");
      if (fb) fb.style.display = "none";
    } else {
      if (img) img.remove();
      const fb = fullCover.querySelector(".full-player-cover-fallback");
      if (fb) fb.style.display = "flex";
    }
  }

    musicPlayer.activeCard = cardEl || null;
  musicPlayer.current = { url, name, size, coverUrl: coverUrl || null };

  /* ★ FIX: immediately reflect the "playing" state on the card */
  if (cardEl) {
    cardEl.classList.remove("is-paused", "is-ended");
    cardEl.classList.add("is-playing");
    const immediateBtn = cardEl.querySelector(
      ".comment-audio-play, .pv-audio-play, .saved-post-audio-play, .saved-item-play"
    );
    if (immediateBtn) setPlayButtonState(immediateBtn, "playing");
  }

  const miniCover = mini.querySelector(".mini-cover");
  if (miniCover) {
    let mImg = miniCover.querySelector(".mini-cover-img");
    const mFb = miniCover.querySelector(".mini-cover-fallback");
    if (coverUrl) {
      if (!mImg) {
        mImg = document.createElement("img");
        mImg.className = "mini-cover-img";
        mImg.alt = "";
        miniCover.insertBefore(mImg, miniCover.firstChild);
      }
      mImg.style.display = "";
      mImg.removeAttribute("data-img-loader");
      mImg.src = coverUrl;
      if (mFb) mFb.style.display = "none";
    } else {
      if (mImg) { mImg.removeAttribute("src"); mImg.style.display = "none"; }
      if (mFb) mFb.style.display = "";
    }
  }

  mini.querySelector(".mini-progress-fill").style.width = "0%";
  full.querySelector(".full-progress-fill").style.width = "0%";

  mini.classList.remove("is-ended");
  full.classList.remove("is-ended");
  mini.classList.add("is-playing");
  full.classList.add("is-playing");
  setPlayButtonState(mini.querySelector(".mini-play"), "playing");
  setPlayButtonState(full.querySelector(".full-play-btn"), "playing");

  const setSource = (playbackUrl) => {
    if (audio.src !== playbackUrl) {
      audio.src = playbackUrl;
      audio.currentTime = 0;
      audio.load();
    }
    const startPlay = () => {
      audio.play().catch(() => {
        mini.classList.remove("is-playing");
        full.classList.remove("is-playing");
        setPlayButtonState(mini.querySelector(".mini-play"), "paused");
        setPlayButtonState(full.querySelector(".full-play-btn"), "paused");
      });
      audio.removeEventListener("canplay", startPlay);
    };
    if (audio.readyState >= 3) startPlay();
    else {
      setBufferingUI(true);
      audio.addEventListener("canplay", startPlay);
    }
  };

  if (hasAudioCache()) {
    AudioCache.getBlobUrl(url).then((b) => setSource(b || url)).catch(() => setSource(url));
  } else {
    setSource(url);
  }

  mini.classList.add("visible");
  requestAnimationFrame(() => mini.classList.add("show"));

  /* Auto-expand music */
  expandMusicMini();

  if (window.VexecImageLoader) setTimeout(() => window.VexecImageLoader.scan(), 30);
}

function syncActiveCard(isPlaying) {
  const card = musicPlayer.activeCard;
  if (!card) return;
  card.classList.toggle("is-playing", !!isPlaying);
  card.classList.toggle("is-paused", !isPlaying);
  const playBtn = card.querySelector(
    ".comment-audio-play, .pv-audio-play, .saved-post-audio-play, .saved-item-play"
  );
  if (playBtn) {
    playBtn.classList.toggle("is-playing", !!isPlaying);
    playBtn.classList.toggle("is-paused", !isPlaying);
    setPlayButtonState(playBtn, isPlaying ? "playing" : "paused");
  }
}

function setBufferingUI(isBuffering) {
  const mini = musicPlayer.mini;
  const full = musicPlayer.full;
  if (!mini || !full) return;
  mini.classList.toggle("is-loading", isBuffering);
  full.classList.toggle("is-loading", isBuffering);
}

function updatePlayerProgress() {
  const audio = musicPlayer.audio;
  const mini = musicPlayer.mini;
  const full = musicPlayer.full;
  if (!audio || !mini || !full) return;
  const dur = audio.duration || 0;
  const pct = dur ? (audio.currentTime / dur) * 100 : 0;
  const mFill = mini.querySelector(".mini-progress-fill");
  if (mFill && !mini.classList.contains("is-loading")) mFill.style.width = pct + "%";
  const fFill = full.querySelector(".full-progress-fill");
  if (fFill) fFill.style.width = pct + "%";
  const curEl = full.querySelector(".full-time-current");
  if (curEl) curEl.textContent = formatTime(audio.currentTime);
  const totEl = full.querySelector(".full-time-total");
  if (totEl) totEl.textContent = formatTime(dur);
}

function openFullPlayer() {
  const full = musicPlayer.full;
  if (!full) return;
  full.classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeFullPlayer() {
  const full = musicPlayer.full;
  if (!full) return;
  full.classList.remove("open");
  document.body.style.overflow = "";
  full.querySelectorAll(".full-more-wrap.open").forEach((w) => w.classList.remove("open"));
}

function closeMiniPlayer() {
  const audio = musicPlayer.audio;
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
    audio.removeAttribute("src");
    audio.load();
    audio.loop = false;
  }
  musicPlayer.current = null;
  musicPlayer.loop = false;
  musicPlayer.mini?.classList.remove("is-looping", "is-ended", "is-playing", "is-minimized");
  musicPlayer.full?.classList.remove("is-looping", "is-ended", "is-playing");
  if (musicPlayer.activeCard) {
    musicPlayer.activeCard.classList.remove("is-playing", "is-paused");
    const prevBtn = musicPlayer.activeCard.querySelector(".comment-audio-play");
    setPlayButtonState(prevBtn, "paused");
  }
  musicPlayer.activeCard = null;
  closeFullPlayer();

  window.dispatchEvent(new CustomEvent("vexec:corner", {
    detail: { expanded: "download" },
  }));

  const mini = musicPlayer.mini;
  if (!mini) return;
  mini.classList.remove("show");
  setTimeout(() => mini.classList.remove("visible"), 350);
}

function formatTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function extractAlbumArt(file) {
  return new Promise((resolve) => {
    if (!window.jsmediatags) return resolve(null);
    if (!file.type.startsWith("audio/")) return resolve(null);
    window.jsmediatags.read(file, {
      onSuccess: (tag) => {
        const pic = tag.tags.picture;
        if (!pic) return resolve(null);
        try {
          const base64 = pic.data.reduce((acc, byte) => acc + String.fromCharCode(byte), "");
          resolve(`data:${pic.format};base64,${btoa(base64)}`);
        } catch (e) { resolve(null); }
      },
      onError: () => resolve(null),
    });
  });
}

/* ============================================================
   GLOBAL CLICK — no longer handles mini/full player buttons
   (they have their own direct listeners)
   ============================================================ */
document.addEventListener("click", (e) => {
  /* Ignore clicks inside player widgets (handled by their own listeners) */
  if (e.target.closest("#mini-player")) return;
  if (e.target.closest("#full-player")) return;
  if (e.target.closest("#dl-widget")) return;
  if (e.target.closest(".dl-modal")) return;

  /* ---- Audio card (tweet / saved) — TOGGLE ---- */
  const audioCard = e.target.closest(
    ".comment-audio, .vex-audio, .pv-audio, .saved-post-audio"
  );
  if (audioCard) {
    /* Download button */
    if (
      e.target.closest(
        ".comment-audio-download, .vex-audio-download, .pv-audio-download, .saved-post-audio-download"
      )
    ) {
      e.stopPropagation();
      e.preventDefault();
      const url = audioCard.dataset.audioUrl || audioCard.dataset.url;
      const name =
        audioCard.dataset.audioName || audioCard.dataset.name || "audio";
      if (url && window.VexecDownload) {
        window.VexecDownload.download(url, name);
      }
      return;
    }

    /* Play/pause toggle */
    e.stopPropagation();
    e.preventDefault();
    const url = audioCard.dataset.audioUrl || audioCard.dataset.url;
    const name =
      audioCard.dataset.audioName || audioCard.dataset.name || "Audio";
    const size = parseInt(
      audioCard.dataset.audioSize || audioCard.dataset.size || "0",
      10
    );
    const cover = audioCard.dataset.audioCover || audioCard.dataset.cover || null;
    if (!url) return;

    const audio = musicPlayer.audio;
    const isSameCard = musicPlayer.activeCard === audioCard;
    if (isSameCard && audio) {
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
    } else {
      if (window.VexecPlayer) {
        window.VexecPlayer.play(url, name, size, cover, audioCard);
      }
    }
    return;
  }

  /* ---- Comment file (document) ---- */
  const fileEl = e.target.closest(
    ".comment-file, .tweet-file, .vex-file"
  );
  if (fileEl) {
    e.stopPropagation();
    e.preventDefault();
    const url = fileEl.dataset.fileUrl || fileEl.dataset.url;
    const name = fileEl.dataset.fileName || fileEl.dataset.name || "file";
    if (url && window.VexecDownload) {
      window.VexecDownload.download(url, name);
    }
    return;
  }

  /* ---- Comment image → lightbox ---- */
  const commentImg = e.target.closest(".comment-media img");
  if (commentImg && commentImg.src) {
    e.stopPropagation();
    if (typeof window.openLightbox === "function") {
      window.openLightbox(commentImg.src, commentImg.alt || "image");
    }
    return;
  }

  /* ---- Lightbox trigger (from data-lightbox) ---- */
  const imgEl = e.target.closest("[data-lightbox]");
  if (imgEl) {
    e.stopPropagation();
    if (typeof window.openLightbox === "function") {
      window.openLightbox(imgEl.dataset.lightbox, "image");
    }
    return;
  }

  /* ---- User modal triggers ---- */
  const _userTrigger = e.target.closest(
    ".tweet-avatar, .tweet-name, .comment-avatar:not(.comment-avatar-me), .comment-name, .saved-post-avatar, .saved-post-name"
  );
  if (_userTrigger && !e.target.closest("button, a, [data-action]")) return;

  /* ---- Search filter ---- */
  const filterBtn = e.target.closest(".search-filter-btn");
  const filterItem = e.target.closest(".search-filter-item");
  const filterRoot = document.querySelector(".search-filter");
  if (filterBtn) {
    e.stopPropagation();
    filterRoot.classList.toggle("open");
    return;
  }
  if (filterItem) {
    e.stopPropagation();
    filterRoot.querySelectorAll(".search-filter-item").forEach((i) => i.classList.remove("active"));
    filterItem.classList.add("active");
    filterRoot.querySelector(".search-filter-value").textContent =
      filterItem.querySelector("span").textContent;
    filterRoot.classList.remove("open");
    return;
  }
  if (filterRoot && !filterRoot.contains(e.target)) filterRoot.classList.remove("open");

  /* ---- Attachment remove ---- */
  const removeBtn = e.target.closest(".attach-chip-remove");
  if (removeBtn) {
    e.stopPropagation();
    const chip = removeBtn.closest(".attach-chip");
    const container = removeBtn.closest(".comment-attachments");
    const form = container?.nextElementSibling;
    if (!chip || !container || !form) return;
    const id = chip.dataset.id;
    const list = pendingFiles.get(form) || [];
    const idx = list.findIndex((entry) => entry.id === id);
    if (idx > -1) {
      const [entry] = list.splice(idx, 1);
      if (entry.url) URL.revokeObjectURL(entry.url);
    }
    chip.remove();
    if (list.length === 0) pendingFiles.delete(form);
    else pendingFiles.set(form, list);
    return;
  }

  /* ---- Attach menu ---- */
  const attachBtn = e.target.closest(".comment-attach-btn");
  if (attachBtn) {
    e.stopPropagation();
    if (attachBtn.disabled) return;
    const root = attachBtn.closest(".comment-attach");
    document.querySelectorAll(".comment-attach.open").forEach((el) => {
      if (el !== root) el.classList.remove("open");
    });
    root.classList.toggle("open");
    return;
  }
  const attachItem = e.target.closest(".comment-attach-item");
  if (attachItem) {
    e.stopPropagation();
    if (attachItem.disabled) return;
    const root = attachItem.closest(".comment-attach");
    const form = attachItem.closest(".comment-form");
    const kind = attachItem.dataset.attach;
    root.classList.remove("open");
    openFilePicker(kind, form);
    return;
  }
  if (!e.target.closest(".comment-attach")) {
    document.querySelectorAll(".comment-attach.open").forEach((el) => el.classList.remove("open"));
  }

  /* ---- Tweet menu ---- */
  const menuBtn = e.target.closest(".tweet-menu-btn");
  if (menuBtn) {
    const tweet = menuBtn.closest(".tweet");
    const isOpen = tweet.classList.contains("is-open");
    document.querySelectorAll(".tweet.is-open").forEach((t) => t.classList.remove("is-open"));
    if (!isOpen) {
      const saveBtn = tweet.querySelector('.overlay-action[data-action="save"]');
      if (saveBtn && hasSavedAPI()) {
        const postId = tweet.dataset.postId || `tweet_${hashText(tweet.innerText)}`;
        SavedAPI.isPostSaved(postId).then((saved) => saveBtn.classList.toggle("is-saved", saved));
      }
      tweet.classList.add("is-open");
    }
    return;
  }

  /* ---- Overlay action ---- */
  const overlayAction = e.target.closest(".overlay-action");
  if (overlayAction) {
    const tweet = overlayAction.closest(".tweet");
    const action = overlayAction.dataset.action;
    if (action === "close") { tweet.classList.remove("is-open"); return; }
    if (action === "save") {
      e.stopPropagation();
      if (!hasSavedAPI()) return;
      const postId = tweet.dataset.postId || `tweet_${hashText(tweet.innerText)}`;
      SavedAPI.togglePost({
        id: postId,
        name: tweet.querySelector(".tweet-name")?.childNodes[0]?.textContent?.trim() || "Unknown",
        handle: tweet.querySelector(".tweet-handle")?.textContent?.trim() || "",
        avatar: tweet.querySelector(".tweet-avatar img")?.src || null,
        text: tweet.querySelector(".tweet-text")?.textContent?.trim() || "",
        image: tweet.querySelector(".tweet-media img")?.src || null,
      }).then((saved) => {
        overlayAction.classList.toggle("is-saved", saved);
        tweet.classList.remove("is-open");
      });
      return;
    }
    if (action === "copy") {
      const url = window.location.href;
      const done = () => tweet.classList.remove("is-open");
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(url).then(done).catch(() => { fallbackCopy(url); done(); });
      } else { fallbackCopy(url); done(); }
      return;
    }
    tweet.classList.remove("is-open");
    return;
  }

  const overlay = e.target.closest(".tweet-overlay");
  if (overlay) { overlay.closest(".tweet").classList.remove("is-open"); return; }

  /* ---- Comments ---- */
  const commentBtn = e.target.closest(".tweet-action[data-action='comment']");
  if (commentBtn) {
    const tweet = commentBtn.closest(".tweet");
    const comments = tweet.querySelector(".tweet-comments");
    if (comments) {
      comments.classList.toggle("is-open");
      if (comments.classList.contains("is-open")) {
        const input = comments.querySelector(".comment-input");
        if (input) setTimeout(() => input.focus(), 350);
      }
    }
    return;
  }
  const commentsClose = e.target.closest(".comments-close");
  if (commentsClose) {
    const tweet = commentsClose.closest(".tweet");
    const comments = tweet.querySelector(".tweet-comments");
    if (comments) comments.classList.remove("is-open");
    return;
  }
  const seeMoreBtn = e.target.closest(".comments-see-more");
  if (seeMoreBtn) {
    const tweet = seeMoreBtn.closest(".tweet");
    const list = tweet.querySelector(".comments-list");
    if (!list) return;
    const isExpanded = list.classList.toggle("is-expanded");
    seeMoreBtn.classList.toggle("is-expanded", isExpanded);
    const label = seeMoreBtn.querySelector("span");
    if (label) label.textContent = isExpanded ? "See Less" : "See More";
    return;
  }
});

/* ============================================================
   Submit comment
   ============================================================ */
document.addEventListener("submit", async (e) => {
  const form = e.target.closest(".comment-form");
  if (!form) return;
  e.preventDefault();
  if (form.dataset.submitting === "1") return;
  const input = form.querySelector(".comment-input");
  const text = input.value.trim();
  const attachments = (pendingFiles.get(form) || []).slice();
  if (!text && attachments.length === 0) return;

  form.dataset.submitting = "1";
  const container = form.previousElementSibling;
  attachments.forEach((entry) => {
    if (!entry.chipEl) return;
    entry.chipEl.classList.add("uploading");
    const spinner = document.createElement("span");
    spinner.className = "attach-chip-spinner";
    spinner.innerHTML = '<i data-lucide="loader-circle"></i>';
    entry.chipEl.appendChild(spinner);
  });
  if (window.lucide) window.lucide.createIcons();
  await new Promise((r) => setTimeout(r, 950));

  const list = form.closest(".tweet-comments").querySelector(".comments-list");
  const article = document.createElement("article");
  article.className = "comment";
  let mediaHTML = "";
  attachments.forEach((entry) => {
    const file = entry.file;
    if (file.type.startsWith("image/")) {
      mediaHTML += `<div class="comment-media"><img src="${entry.url}" alt="${escapeHTML(file.name)}" /></div>`;
    } else if (file.type.startsWith("audio/")) {
      const coverHTML = entry.coverUrl
        ? `<img src="${entry.coverUrl}" alt="" />`
        : `<i data-lucide="music"></i>`;
      mediaHTML +=
        `<div class="comment-audio" data-audio-url="${entry.url}" data-audio-name="${escapeHTML(file.name)}" data-audio-size="${file.size}" data-audio-cover="${entry.coverUrl || ""}">` +
        `<div class="comment-audio-cover">${coverHTML}</div>` +
        '<div class="comment-audio-info">' +
        `<span class="comment-audio-name">${escapeHTML(file.name)}</span>` +
        `<span class="comment-audio-meta">${formatBytes(file.size)}</span>` +
        "</div>" +
        '<button class="comment-audio-download" type="button" aria-label="Download"><i data-lucide="download"></i></button>' +
        '<button class="comment-audio-play is-paused" type="button" aria-label="Play">' +
        '<i data-lucide="play" class="icon-play"></i>' +
        '<i data-lucide="pause" class="icon-pause"></i>' +
        '<i data-lucide="rotate-ccw" class="icon-replay"></i>' +
        "</button>" +
        '<div class="comment-audio-loading"><i data-lucide="loader-circle"></i></div>' +
        "</div>";
    } else {
      mediaHTML +=
        `<div class="comment-file" data-file-url="${entry.url}" data-file-name="${escapeHTML(file.name)}">` +
        '<div class="comment-file-main">' +
        `<i data-lucide="${iconForFile(file)}"></i>` +
        '<div class="comment-file-info">' +
        `<span class="comment-file-name">${escapeHTML(file.name)}</span>` +
        `<span class="comment-file-size">${formatBytes(file.size)}</span>` +
        "</div>" +
        "</div>" +
        '<div class="comment-file-download-icon"><i data-lucide="download"></i></div>' +
        "</div>";
    }
  });

  article.innerHTML =
    '<div class="comment-avatar comment-avatar-me"></div>' +
    '<div class="comment-body">' +
    '<div class="comment-meta">' +
    '<span class="comment-name">You</span>' +
    '<span class="comment-handle">@you</span>' +
    "</div>" +
    (text ? '<p class="comment-text"></p>' : "") +
    mediaHTML +
    "</div>";

  if (text) article.querySelector(".comment-text").textContent = text;

  list.appendChild(article);
  list.scrollTop = list.scrollHeight;
  input.value = "";
  if (container && container.classList.contains("comment-attachments")) container.innerHTML = "";
  pendingFiles.delete(form);
  form.dataset.submitting = "";
  if (window.lucide) window.lucide.createIcons();
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (musicPlayer.full && musicPlayer.full.classList.contains("open")) { closeFullPlayer(); return; }
  if (lightboxEl && lightboxEl.classList.contains("open")) { closeLightbox(); return; }
  document.querySelectorAll(".tweet.is-open").forEach((t) => t.classList.remove("is-open"));
  document.querySelector(".search-filter")?.classList.remove("open");
  document.querySelectorAll(".comment-attach.open").forEach((el) => el.classList.remove("open"));
});

/* ============================================================
   File picker
   ============================================================ */
function openFilePicker(kind, form) {
  if (!form) return;
  const max = getMaxFiles(form);
  const existing = pendingFiles.get(form) || [];
  if (existing.length >= max) {
    existing.forEach((entry) => { if (entry.url) URL.revokeObjectURL(entry.url); });
    pendingFiles.delete(form);
    const container = form.previousElementSibling;
    if (container && container.classList.contains("comment-attachments")) container.innerHTML = "";
  }
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = kind !== "camera" && max > 1;
  if (kind === "image") input.accept = "image/*";
  else if (kind === "document") input.accept = ".pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx,.ppt,.pptx,.zip,.rar";
  else if (kind === "music") input.accept = "audio/*,.mp3,.wav,.ogg,.flac,.m4a,.aac,.opus,.webm";
  else if (kind === "camera") { input.accept = "image/*"; input.capture = "environment"; }
  input.style.display = "none";
  document.body.appendChild(input);
  input.addEventListener("change", () => {
    const files = Array.from(input.files || []);
    if (files.length) addAttachments(form, files, kind);
    document.body.removeChild(input);
  });
  input.click();
}

function addAttachments(form, files, pickerKind) {
  const container = form.previousElementSibling;
  if (!container || !container.classList.contains("comment-attachments")) return;
  const max = getMaxFiles(form);
  let list = pendingFiles.get(form) || [];
  const accepted = [];
  for (const file of files) {
    const kind = pickerKind === "camera" ? "camera"
      : file.type.startsWith("image/") ? "image"
      : file.type.startsWith("audio/") ? "audio"
      : "document";
    const limit = configLimits[kind] ?? configLimits.document;
    if (limit && file.size > limit) {
      showLimitModal({
        title: "File too large",
        message: `${escapeHTML(file.name)} is ${formatBytes(file.size)}. Maximum allowed for ${kind}s is ${formatBytes(limit)}.`,
      });
      continue;
    }
    accepted.push(file);
  }
  if (accepted.length === 0) return;
  if (list.length + accepted.length > max) {
    list.forEach((entry) => { if (entry.url) URL.revokeObjectURL(entry.url); });
    list = [];
    container.innerHTML = "";
  }
  const finalFiles = accepted.slice(0, max);
  finalFiles.forEach((file) => {
    const isImage = file.type.startsWith("image/");
    const isAudio = file.type.startsWith("audio/");
    const blobUrl = URL.createObjectURL(file);
    const entry = { id: Math.random().toString(36).slice(2), file, url: blobUrl, width: 0, height: 0, coverUrl: null };
    list.push(entry);
    const chip = document.createElement("div");
    chip.className = "attach-chip";
    chip.dataset.id = entry.id;
    let preview;
    if (isImage) preview = `<img src="${blobUrl}" alt="" />`;
    else if (isAudio) preview = `<i data-lucide="music"></i>`;
    else preview = `<i data-lucide="${iconForFile(file)}"></i>`;
    chip.innerHTML =
      `<div class="attach-chip-preview">${preview}</div>` +
      `<button class="attach-chip-remove" type="button" aria-label="Remove"><i data-lucide="x"></i></button>` +
      `<div class="attach-chip-info"></div>`;
    const infoEl = chip.querySelector(".attach-chip-info");
    infoEl.textContent = isImage ? "…" : formatBytes(file.size);
    container.appendChild(chip);
    entry.chipEl = chip;
    entry.infoEl = infoEl;
    if (isImage) {
      const img = new Image();
      img.onload = () => {
        entry.width = img.naturalWidth;
        entry.height = img.naturalHeight;
        infoEl.textContent = `${entry.width}×${entry.height}`;
      };
      img.onerror = () => { infoEl.textContent = formatBytes(file.size); };
      img.src = blobUrl;
    }
    if (isAudio) {
      extractAlbumArt(file).then((dataUrl) => {
        if (dataUrl) {
          entry.coverUrl = dataUrl;
          const preview = chip.querySelector(".attach-chip-preview");
          if (preview) preview.innerHTML = `<img src="${dataUrl}" alt="" />`;
        }
      });
    }
  });
  pendingFiles.set(form, list);
  if (window.lucide) window.lucide.createIcons();
}

/* ============================================================
   Helpers
   ============================================================ */
function getMaxFiles(form) {
  if (!form) return 1;
  const attr = form.dataset.maxFiles;
  if (!attr) return 1;
  const n = parseInt(attr, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
function iconForFile(file) {
  const type = file.type;
  const name = file.name.toLowerCase();
  if (type.includes("pdf") || name.endsWith(".pdf")) return "file-text";
  if (type.includes("word") || /\.(docx?|rtf|odt)$/.test(name)) return "file-text";
  if (type.includes("sheet") || /\.(xlsx?|csv|ods)$/.test(name)) return "file-spreadsheet";
  if (type.includes("presentation") || /\.(pptx?|odp)$/.test(name)) return "file-text";
  if (type.includes("zip") || /\.(zip|rar|7z|tar|gz)$/.test(name)) return "file-archive";
  if (type.startsWith("video/")) return "file-video";
  if (type.startsWith("audio/")) return "music";
  return "file";
}
function formatBytes(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "absolute";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch (_) {}
  document.body.removeChild(ta);
}

/* ============================================================
   Search hide on scroll
   ============================================================ */
(function () {
  let lastY = 0, ticking = false;
  function onScroll() {
    const header = document.querySelector(".home-header");
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
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
})();

function setupMediaLoaders() {
  document.querySelectorAll(".tweet-media img, .comment-media img").forEach((img) => {
    if (img.dataset.loaderReady === "1") return;
    img.dataset.loaderReady = "1";
    const parent = img.parentElement;
    if (!parent) return;
    if (img.complete && img.naturalWidth > 0) return;
    parent.classList.add("is-loading");
    const skeleton = document.createElement("div");
    skeleton.className = "media-skeleton";
    skeleton.innerHTML = '<i data-lucide="refresh-cw"></i>';
    parent.appendChild(skeleton);
    const done = () => {
      parent.classList.remove("is-loading");
      skeleton.classList.add("hidden");
      setTimeout(() => skeleton.remove(), 450);
    };
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", () => { img.classList.add("media-failed"); done(); }, { once: true });
  });
  if (window.lucide) window.lucide.createIcons();
}

function setupCameraAvailability() {
  const isMobile = document.body.classList.contains("is-mobile");
  if (isMobile) return;
  document.querySelectorAll(".comment-attach-camera").forEach((btn) => {
    btn.disabled = true;
    btn.setAttribute("aria-disabled", "true");
    btn.title = "Camera is only available on mobile";
  });
}

function setupCommentEmoji() {
  document.querySelectorAll(".comment-form").forEach((form) => {
    if (form.dataset.emojiReady === "1") return;
    form.dataset.emojiReady = "1";
    const sendBtn = form.querySelector(".comment-send");
    if (!sendBtn) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "comment-emoji-btn";
    btn.setAttribute("aria-label", "Emoji");
    btn.innerHTML = '<i data-lucide="smile"></i>';
    form.insertBefore(btn, sendBtn);
  });
  if (window.lucide) window.lucide.createIcons();
}

document.addEventListener("click", (e) => {
  const emojiBtn = e.target.closest(".comment-emoji-btn");
  if (!emojiBtn || !window.VexecEmoji) return;
  e.stopPropagation();
  const form = emojiBtn.closest(".comment-form");
  const input = form?.querySelector(".comment-input");
  if (input) window.VexecEmoji.toggle(input);
});

document.addEventListener("route:change", () => {
  setTimeout(() => {
    setupAttachments();
    setupAudioPlayButtons();
    setupMediaLoaders();
    setupCameraAvailability();
    setupCommentEmoji();
  }, 0);
});

setTimeout(() => {
  setupAttachments();
  setupAudioPlayButtons();
  setupMediaLoaders();
  setupCameraAvailability();
  setupCommentEmoji();
}, 80);

/* ============================================================
   Reload overlay
   ============================================================ */
(function () {
  const overlay = document.getElementById("reload-overlay");
  if (!overlay) return;
  const brandBtn = document.querySelector(".brand");
  const closeBtn = overlay.querySelector(".reload-close");
  const actionBtn = overlay.querySelector(".reload-icon-btn");
  const inner = overlay.querySelector(".reload-inner");
  let touchStartY = 0, touchCurrentY = 0, dragging = false;
  function open() {
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function close() {
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (inner) { inner.style.transform = ""; inner.style.opacity = ""; }
  }
  brandBtn?.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  actionBtn?.addEventListener("click", () => window.location.reload());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  overlay.addEventListener("touchstart", (e) => {
    touchStartY = e.touches[0].clientY;
    touchCurrentY = touchStartY;
    dragging = true;
  }, { passive: true });
  overlay.addEventListener("touchmove", (e) => {
    if (!dragging) return;
    touchCurrentY = e.touches[0].clientY;
    const delta = touchCurrentY - touchStartY;
    if (delta < 0 && inner) {
      const pull = Math.min(Math.abs(delta), 220);
      inner.style.transform = `translateY(${-pull}px)`;
      inner.style.opacity = String(Math.max(0, 1 - pull / 190));
    }
  }, { passive: true });
  overlay.addEventListener("touchend", () => {
    if (!dragging) return;
    dragging = false;
    const pulled = touchStartY - touchCurrentY;
    if (pulled > 90) close();
    else if (inner) { inner.style.transform = ""; inner.style.opacity = ""; }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("open")) close();
  });
})();

/* ============================================================
   Expose
   ============================================================ */
window.VexecPlayer = {
  play(url, name, size, cover, cardEl) { playMusic(url, name, size, cover, cardEl); },
  close() { closeMiniPlayer(); },
  toggle() {
    const audio = musicPlayer.audio;
    if (!audio) return;
    const ended = musicPlayer.mini?.classList.contains("is-ended") ||
                  musicPlayer.full?.classList.contains("is-ended");
    if (ended) {
      audio.currentTime = 0;
      musicPlayer.mini?.classList.remove("is-ended");
      musicPlayer.full?.classList.remove("is-ended");
      setPlayButtonState(musicPlayer.mini?.querySelector(".mini-play"), "playing");
      setPlayButtonState(musicPlayer.full?.querySelector(".full-play-btn"), "playing");
      audio.play().catch(() => {});
      return;
    }
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  },
  isCurrent(url) {
    return !!(musicPlayer.current && musicPlayer.current.url === url);
  },
  get current() { return musicPlayer.current; },
};