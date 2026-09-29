/* ============================================================
   TWEET RENDERER — Single source of truth for all posts
   Used by: home, saved, profile_view, pv (future)
   ============================================================ */

(function () {
  "use strict";

  /* ============================================================
     Helpers
     ============================================================ */
  function escapeHTML(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatBytes(bytes) {
    if (!bytes) return "0 B";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1024 * 1024 * 1024)
      return (bytes / (1024 * 1024)).toFixed(2) + " MB";
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  }

  function iconForFile(name) {
    const n = (name || "").toLowerCase();
    if (/\.(mp3|wav|ogg|flac|m4a|aac|opus|m4b|weba)$/.test(n)) return "music";
    if (/\.(png|jpe?g|gif|webp|bmp|svg|avif|heic)$/.test(n)) return "image";
    if (/\.(mp4|mov|avi|mkv|webm|m4v)$/.test(n)) return "file-video";
    if (/\.(pdf|docx?|rtf|odt|txt|md)$/.test(n)) return "file-text";
    if (/\.(xlsx?|csv|ods)$/.test(n)) return "file-spreadsheet";
    if (/\.(zip|rar|7z|tar|gz|bz2|xz)$/.test(n)) return "file-archive";
    if (/\.(pptx?|odp|key)$/.test(n)) return "file-text";
    return "file";
  }

  /* ============================================================
     Images — grid (1–5)
     ============================================================ */
  function renderImages(images) {
    if (!images || !images.length) return "";
    const visible = Math.min(images.length, 5);
    const extra = images.length - 5;

    const cells = images.slice(0, visible).map((src, i) => {
      const isLast = i === 4 && extra > 0;
      return `<div class="tweet-image ${isLast ? "is-more" : ""}"
                   ${isLast ? `data-more="${extra}"` : ""}
                   data-lightbox="${escapeHTML(src)}">
                <img src="${escapeHTML(src)}" alt="" loading="lazy" />
              </div>`;
    }).join("");

    return `<div class="tweet-images" data-count="${visible}">${cells}</div>`;
  }

  /* ============================================================
     Audio cards — use .comment-audio (canonical)
     ============================================================ */
  function renderAudios(audios) {
    if (!audios || !audios.length) return "";
    return audios.map((a) => {
      const cover = a.cover
        ? `<img src="${escapeHTML(a.cover)}" alt="" loading="lazy" />`
        : `<i data-lucide="music"></i>`;
      return `
        <div class="comment-audio"
             data-audio-url="${escapeHTML(a.url)}"
             data-audio-name="${escapeHTML(a.name || "Audio")}"
             data-audio-size="${a.size || 0}"
             data-audio-cover="${escapeHTML(a.cover || "")}">
          <div class="comment-audio-cover">${cover}</div>
          <div class="comment-audio-info">
            <span class="comment-audio-name">${escapeHTML(a.name || "Audio")}</span>
            <span class="comment-audio-meta">${formatBytes(a.size || 0)}</span>
          </div>
          <button class="comment-audio-download" type="button" aria-label="Download">
            <i data-lucide="download"></i>
          </button>
          <button class="comment-audio-play" type="button" aria-label="Play">
            <i data-lucide="play" class="icon-play"></i>
            <i data-lucide="pause" class="icon-pause"></i>
            <i data-lucide="rotate-ccw" class="icon-replay"></i>
          </button>
          <div class="comment-audio-loading"><i data-lucide="loader-circle"></i></div>
        </div>
      `;
    }).join("");
  }

  /* ============================================================
     File cards — .comment-file (canonical)
     ============================================================ */
  function renderFiles(files) {
    if (!files || !files.length) return "";
    return files.map((f) => {
      const icon = iconForFile(f.name);
      return `
        <div class="comment-file"
             data-file-url="${escapeHTML(f.url)}"
             data-file-name="${escapeHTML(f.name)}">
          <div class="comment-file-main">
            <i data-lucide="${icon}"></i>
            <div class="comment-file-info">
              <span class="comment-file-name">${escapeHTML(f.name)}</span>
              <span class="comment-file-size">${formatBytes(f.size || 0)}</span>
            </div>
          </div>
          <div class="comment-file-download-icon">
            <i data-lucide="download"></i>
          </div>
        </div>
      `;
    }).join("");
  }

  /* ============================================================
     Attachments
     ============================================================ */
  function renderAttachments(post) {
    const parts = [];
    const images = post.images || (post.image ? [post.image] : []);
    const audios = post.audios || (post.audio ? [post.audio] : []);
    const files = post.files || [];

    if (images.length) parts.push(renderImages(images));
    if (audios.length) parts.push(renderAudios(audios));
    if (files.length) parts.push(renderFiles(files));
    return parts.join("");
  }

  /* ============================================================
     Avatar (with verified ring)
     ============================================================ */
  function renderAvatar(post) {
    const inner = post.avatar
      ? `<img src="${escapeHTML(post.avatar)}" alt="" loading="lazy" />`
      : `<i data-lucide="user-round"></i>`;
    return `
      <div class="avatar-wrap ${post.verified ? "is-verified" : ""}" data-size="md">
        <div class="tweet-avatar">${inner}</div>
      </div>
    `;
  }

  /* ============================================================
     Comment
     ============================================================ */
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

  function renderCommentsList(comments) {
    if (!comments || !comments.length) return "";
    return comments.map(renderComment).join("");
  }

  /* ============================================================
     Verified badge SVG
     ============================================================ */
  const VERIFIED_SVG = `<svg class="verified" viewBox="0 0 24 24" fill="currentColor" aria-label="Verified"><path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z"/></svg>`;

  /* ============================================================
     Render a single tweet
     ============================================================ */
  function renderTweet(post, opts) {
    opts = opts || {};
    const variant = opts.variant || "home";
    const id = opts.id || post.id || "";

    const verified = post.verified ? VERIFIED_SVG : "";
    const attachHTML = renderAttachments(post);
    const commentsHTML = renderCommentsList(post.commentsList);

    const viewsHTML = post.views
      ? `<span class="tweet-views"><i data-lucide="eye"></i>${escapeHTML(String(post.views))}</span>`
      : "";

    const commentSection = `
      <div class="tweet-comments">
        <div class="tweet-comments-collapse">
          <div class="tweet-comments-inner">
            <header class="comments-header">
              <span class="comments-title">
                <i data-lucide="message-circle"></i>
                Comments
              </span>
              <button class="comments-close" type="button" aria-label="Close comments">
                <i data-lucide="x"></i>
              </button>
            </header>
            <div class="comments-list">${commentsHTML}</div>
            <button class="comments-see-more" type="button">
              <span>See More</span>
              <i data-lucide="chevron-down"></i>
            </button>
            <form class="comment-form" autocomplete="off">
              <div class="comment-attach">
                <button class="comment-attach-btn" type="button" aria-label="Attach">
                  <i data-lucide="plus"></i>
                </button>
                <div class="comment-attach-menu">
                  <button class="comment-attach-item" type="button" data-attach="image">
                    <i data-lucide="image"></i><span>Image</span>
                  </button>
                  <button class="comment-attach-item" type="button" data-attach="music">
                    <i data-lucide="music"></i><span>Music</span>
                  </button>
                  <button class="comment-attach-item" type="button" data-attach="document">
                    <i data-lucide="file-text"></i><span>Document</span>
                  </button>
                  <button class="comment-attach-item comment-attach-camera" type="button" data-attach="camera">
                    <i data-lucide="camera"></i><span>Camera</span>
                  </button>
                </div>
              </div>
              <input type="text" class="comment-input" placeholder="Write a comment..." aria-label="Write a comment" />
              <button type="submit" class="comment-send" aria-label="Send">
                <i data-lucide="send-horizontal"></i>
              </button>
            </form>
          </div>
        </div>
      </div>
    `;

    const overlayHTML = `
      <div class="tweet-overlay" aria-hidden="true">
        <div class="tweet-overlay-card">
          <button class="overlay-action" data-action="save">
            <i data-lucide="bookmark" class="icon-unsaved"></i>
            <i data-lucide="bookmark-check" class="icon-saved"></i>
            <span>Save</span>
          </button>
          <button class="overlay-action" data-action="copy">
            <i data-lucide="link"></i>
            <span>Copy Link</span>
          </button>
          <button class="overlay-action" data-action="report">
            <i data-lucide="flag"></i>
            <span>Report</span>
          </button>
          <button class="overlay-action overlay-close" data-action="close">
            <i data-lucide="x"></i>
            <span>Close</span>
          </button>
        </div>
      </div>
    `;

    return `
      <article class="tweet" data-post-id="${escapeHTML(id)}" data-variant="${variant}">
        ${renderAvatar(post)}
        <div class="tweet-body">
          <div class="tweet-meta">
            <span class="tweet-name">${escapeHTML(post.name || "Anonymous")}${verified}</span>
            <span class="tweet-handle">${escapeHTML(post.handle || "")}</span>
            ${viewsHTML}
          </div>
          ${post.text ? `<p class="tweet-text">${escapeHTML(post.text)}</p>` : ""}
          ${attachHTML}
          <div class="tweet-actions">
            <div class="tweet-actions-left">
              <button class="tweet-action" data-action="like" aria-label="Like">
                <i data-lucide="heart"></i>
                <span>${post.likes || 0}</span>
              </button>
              <button class="tweet-action" data-action="comment" aria-label="Comment">
                <i data-lucide="message-circle"></i>
                <span>${post.comments || 0}</span>
              </button>
            </div>
            <div class="tweet-actions-right">
              <button class="tweet-menu-btn" aria-label="More">
                <i data-lucide="more-horizontal"></i>
              </button>
            </div>
          </div>
          ${commentSection}
        </div>
        ${overlayHTML}
      </article>
    `;
  }

  /* ============================================================
     Render a list
     ============================================================ */
  function renderTweets(posts, opts) {
    if (!posts || !posts.length) return "";
    return posts.map((p) => renderTweet(p, opts)).join("");
  }

  /* ============================================================
     After-render hook
     ============================================================ */
  function afterRender(root) {
    const scope = root || document;
    if (window.lucide) window.lucide.createIcons({ root: scope });
    if (window.VexecImageLoader) {
      setTimeout(() => window.VexecImageLoader.scan(scope), 30);
    }
    if (typeof setupAttachments === "function") setupAttachments();
    if (typeof setupAudioPlayButtons === "function") setupAudioPlayButtons();
    if (typeof setupCameraAvailability === "function") setupCameraAvailability();
    if (typeof setupCommentEmoji === "function") setupCommentEmoji();
  }

  /* ============================================================
     Expose
     ============================================================ */
  window.VexecTweet = {
    render: renderTweet,
    renderList: renderTweets,
    renderAttachments,
    renderImages,
    renderAudios,
    renderFiles,
    afterRender,
    escapeHTML,
    formatBytes,
    iconForFile,
  };

  console.info("[tweet-renderer] ready · unified");
})();