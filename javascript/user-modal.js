/* ============================================================
   USER PROFILE MODAL — Vexec
   Opens when clicking on a tweet/comment avatar or name.
   Includes loading skeleton + verified ring.
   ============================================================ */
(function () {
  "use strict";

  let backdrop = null;
  let currentUser = null;
  let openToken = 0;

  /* ============================================================
     BUILD MODAL
     ============================================================ */
  function ensureModal() {
    if (backdrop) return backdrop;

    backdrop = document.createElement("div");
    backdrop.className = "user-modal-backdrop";
    backdrop.setAttribute("aria-hidden", "true");
    backdrop.innerHTML =
      '<div class="user-modal" role="dialog" aria-modal="true">' +
      '<button class="user-modal-close" type="button" aria-label="Close">' +
      '<i data-lucide="x"></i>' +
      "</button>" +
      '<div class="user-modal-hero"></div>' +

      /* ---------- SKELETON ---------- */
      '<div class="user-modal-skeleton" id="user-modal-skeleton">' +
      '<div class="user-modal-sk-avatar"></div>' +
      '<div class="sk-line user-modal-sk-name"></div>' +
      '<div class="sk-line user-modal-sk-handle"></div>' +
      '<div class="sk-line user-modal-sk-bio"></div>' +
      '<div class="sk-line user-modal-sk-bio-2"></div>' +
      '<div class="user-modal-sk-stats">' +
      '<div class="sk-line user-modal-sk-stat"></div>' +
      '<div class="sk-line user-modal-sk-stat"></div>' +
      '<div class="sk-line user-modal-sk-stat"></div>' +
      '<div class="sk-line user-modal-sk-stat"></div>' +
      "</div>" +
      '<div class="sk-line user-modal-sk-action"></div>' +
      "</div>" +

      /* ---------- REAL CONTENT ---------- */
      '<div class="user-modal-content user-modal-real" id="user-modal-real" hidden>' +
      '<div class="user-modal-avatar-wrap" id="user-modal-avatar-wrap">' +
      '<div class="user-modal-avatar" data-bind="avatar"></div>' +
      "</div>" +
      '<div class="user-modal-identity">' +
      '<span class="user-modal-name" data-bind="name"></span>' +
      '<span class="user-modal-handle" data-bind="handle"></span>' +
      "</div>" +
      '<p class="user-modal-bio" data-bind="bio"></p>' +
      '<div class="user-modal-stats">' +
      '<div class="user-modal-stat">' +
      '<span class="user-modal-stat-value" data-bind="posts">0</span>' +
      '<span class="user-modal-stat-label">Posts</span>' +
      "</div>" +
      '<div class="user-modal-stat">' +
      '<span class="user-modal-stat-value" data-bind="likes">0</span>' +
      '<span class="user-modal-stat-label">Likes</span>' +
      "</div>" +
      '<div class="user-modal-stat">' +
      '<span class="user-modal-stat-value" data-bind="views">0</span>' +
      '<span class="user-modal-stat-label">Views</span>' +
      "</div>" +
      '<div class="user-modal-stat">' +
      '<span class="user-modal-stat-value" data-bind="joined">-</span>' +
      '<span class="user-modal-stat-label">Since</span>' +
      "</div>" +
      "</div>" +
      '<button class="user-modal-action" type="button" data-action="view-profile">' +
      '<i data-lucide="user-round"></i>' +
      "<span>View full profile</span>" +
      "</button>" +
      "</div>" +

      "</div>";

    document.body.appendChild(backdrop);

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) close();
    });
    backdrop.querySelector(".user-modal-close").addEventListener("click", close);
    backdrop.querySelector('[data-action="view-profile"]').addEventListener("click", () => {
      close();
      const username = currentUser && currentUser.handle
        ? currentUser.handle.replace(/^@/, "")
        : null;
      if (username && window.router) window.router.navigate(`/u/${username}`);
      else if (window.router) window.router.navigate("/profile");
    });

    return backdrop;
  }

  /* ============================================================
     HASH → FAKE STATS
     ============================================================ */
  function hashString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  function fakeStats(handle) {
    const seed = hashString(handle || "vexec");
    const posts = 8 + (seed % 87);
    const likes = 120 + ((seed >> 3) % 12000);
    const views = 400 + ((seed >> 5) % 85000);
    const year = 2022 + (seed % 5);
    const month = 1 + ((seed >> 2) % 12);
    const monthName = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month - 1];
    return {
      posts: formatNum(posts),
      likes: formatNum(likes),
      views: formatNum(views),
      joined: `${monthName} ${year}`,
    };
  }

  function formatNum(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(n);
  }

  /* ============================================================
     BIND DATA → MODAL
     ============================================================ */
  function renderUser(user) {
    const el = ensureModal();
    currentUser = user;
    const q = (sel) => el.querySelector(sel);

    /* Avatar */
    const avatarEl = q('[data-bind="avatar"]');
    avatarEl.innerHTML = "";
    if (user.avatar) {
      const img = document.createElement("img");
      img.alt = "";
      img.src = user.avatar;
      img.onerror = () => {
        avatarEl.innerHTML =
          '<div class="user-modal-avatar-fallback"><i data-lucide="user-round"></i></div>';
        if (window.lucide) window.lucide.createIcons({ root: avatarEl });
      };
      avatarEl.appendChild(img);
    } else {
      avatarEl.innerHTML =
        '<div class="user-modal-avatar-fallback"><i data-lucide="user-round"></i></div>';
    }

    /* Avatar wrap — verified ring */
    const wrapEl = el.querySelector("#user-modal-avatar-wrap");
    if (wrapEl) wrapEl.classList.toggle("is-verified", !!user.verified);

    /* Name + verified badge */
    const nameEl = q('[data-bind="name"]');
    nameEl.innerHTML = "";
    const nameText = document.createElement("span");
    nameText.textContent = user.name || "Anonymous";
    nameEl.appendChild(nameText);

    if (user.verified) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "verified");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("fill", "currentColor");
      svg.setAttribute("aria-label", "Verified");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute(
        "d",
        "M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z",
      );
      svg.appendChild(path);
      nameEl.appendChild(svg);
    }

    q('[data-bind="handle"]').textContent = user.handle || "@unknown";

    /* Bio */
    const bioEl = q('[data-bind="bio"]');
    if (user.bio) {
      bioEl.textContent = user.bio;
      bioEl.style.display = "";
    } else {
      bioEl.textContent = "No bio yet. Just whispers drifting in the void.";
      bioEl.style.display = "";
    }

    /* Stats */
    const stats = fakeStats(user.handle || user.name || "");
    q('[data-bind="posts"]').textContent = stats.posts;
    q('[data-bind="likes"]').textContent = stats.likes;
    q('[data-bind="views"]').textContent = stats.views;
    q('[data-bind="joined"]').textContent = stats.joined;

    if (window.lucide) window.lucide.createIcons({ root: el });
  }

  /* ============================================================
     OPEN / CLOSE
     ============================================================ */
  function open(user) {
    const el = ensureModal();

    /* Show skeleton first */
    const skel = el.querySelector("#user-modal-skeleton");
    const real = el.querySelector("#user-modal-real");
    if (skel) skel.hidden = false;
    if (real) real.hidden = true;

    el.classList.add("open");
    el.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    if (window.lucide) window.lucide.createIcons({ root: el });

    /* Simulate load delay, then show real content */
    const myToken = ++openToken;
    const delay = 220 + Math.random() * 180;
    setTimeout(() => {
      if (myToken !== openToken) return;
      renderUser(user);
      if (skel) skel.hidden = true;
      if (real) real.hidden = false;
    }, delay);
  }

  function close() {
    if (!backdrop) return;
    backdrop.classList.remove("open");
    backdrop.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    currentUser = null;
    openToken++;
  }

  /* ============================================================
     EXTRACT USER DATA
     ============================================================ */
  function extractUserFromTweet(tweet) {
    const nameEl = tweet.querySelector(".tweet-name");
    const handleEl = tweet.querySelector(".tweet-handle");
    const avatarEl = tweet.querySelector(".tweet-avatar img");

    let name = "Anonymous";
    let verified = false;

    if (nameEl) {
      const textNode = Array.from(nameEl.childNodes).find(
        (n) => n.nodeType === 3 && n.textContent.trim(),
      );
      if (textNode) name = textNode.textContent.trim();
      verified = !!nameEl.querySelector(".verified");
    }

    return {
      name,
      handle: handleEl?.textContent?.trim() || "@unknown",
      avatar: avatarEl?.src || null,
      verified,
    };
  }

  function extractUserFromComment(comment) {
    const nameEl = comment.querySelector(".comment-name");
    const handleEl = comment.querySelector(".comment-handle");
    const avatarEl = comment.querySelector(".comment-avatar img");

    return {
      name: nameEl?.textContent?.trim() || "Anonymous",
      handle: handleEl?.textContent?.trim() || "@unknown",
      avatar: avatarEl?.src || null,
      verified: false,
    };
  }

  /* ============================================================
     GLOBAL CLICK HANDLER
     ============================================================ */
  document.addEventListener("click", (e) => {
    if (!document.querySelector(".home, .saved, .pv-page")) return;

    const tweetTrigger = e.target.closest(".tweet-avatar, .tweet-name");
    if (tweetTrigger) {
      const tweet = tweetTrigger.closest(".tweet");
      if (!tweet) return;
      if (e.target.closest("button, a, [data-action]")) return;
      e.stopPropagation();
      open(extractUserFromTweet(tweet));
      return;
    }

    const commentTrigger = e.target.closest(".comment-avatar, .comment-name");
    if (commentTrigger) {
      if (commentTrigger.classList.contains("comment-avatar-me")) return;
      const comment = commentTrigger.closest(".comment");
      if (!comment) return;
      if (e.target.closest("button, a, [data-action]")) return;
      e.stopPropagation();
      open(extractUserFromComment(comment));
      return;
    }

    const savedAvatar = e.target.closest(".saved-post-avatar, .saved-post-name");
    if (savedAvatar) {
      const post = savedAvatar.closest(".saved-post");
      if (!post) return;
      if (e.target.closest("button, a, [data-action]")) return;
      e.stopPropagation();
      const avatarEl = post.querySelector(".saved-post-avatar img");
      open({
        name: post.querySelector(".saved-post-name")?.textContent?.trim() || "Anonymous",
        handle: post.querySelector(".saved-post-handle")?.textContent?.trim() || "@unknown",
        avatar: avatarEl?.src || null,
        verified: false,
      });
      return;
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && backdrop && backdrop.classList.contains("open")) close();
  });

  document.addEventListener("route:change", () => {
    if (backdrop && backdrop.classList.contains("open")) close();
  });

  window.VexecUserModal = { open, close };
})();