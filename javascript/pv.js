/* ============================================================
   PV — Secret Inbox (received + sent + ignored + reported)
   ============================================================ */

(function () {
  "use strict";

  let currentFilter = "all";
  let messages = [];
  let sentMessages = [];
  let queuedRender = false;

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
    return String(str == null ? "" : str)
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

  function iconForFile(name) {
    const n = (name || "").toLowerCase();
    if (n.endsWith(".pdf")) return "file-text";
    if (/\.(docx?|rtf|odt)$/.test(n)) return "file-text";
    if (/\.(xlsx?|csv|ods)$/.test(n)) return "file-spreadsheet";
    if (/\.(zip|rar|7z|tar|gz)$/.test(n)) return "file-archive";
    return "file";
  }

  function sortMessages(list) {
    return [...list].sort((a, b) => {
      const aUnread = !a.read_at ? 1 : 0;
      const bUnread = !b.read_at ? 1 : 0;
      if (aUnread !== bUnread) return bUnread - aUnread;
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
  }

  /* ============================================================
     Render — attachments
     ============================================================ */
  function renderAttachments(msg) {
    const parts = [];

    if (msg.images && msg.images.length) {
      const visible = Math.min(msg.images.length, 5);
      const extra = msg.images.length - 5;
      const cells = msg.images.slice(0, visible).map((src, i) => {
        const isLast = i === 4 && extra > 0;
        return `<div class="pv-image ${isLast ? "is-more" : ""}"
                     ${isLast ? `data-more="${extra}"` : ""}
                     data-lightbox="${escapeHTML(src)}">
                  <img src="${escapeHTML(src)}" alt="" loading="lazy" />
                </div>`;
      }).join("");
      parts.push(`<div class="pv-images" data-count="${visible}">${cells}</div>`);
    }

    if (msg.audios && msg.audios.length) {
      msg.audios.forEach((a) => {
        const cover = a.cover
          ? `<img src="${escapeHTML(a.cover)}" alt="" loading="lazy" />`
          : `<i data-lucide="music"></i>`;
        parts.push(`
          <div class="pv-audio"
               data-audio-url="${escapeHTML(a.url)}"
               data-audio-name="${escapeHTML(a.name)}"
               data-audio-size="${a.size || 0}"
               data-audio-cover="${escapeHTML(a.cover || "")}">
            <div class="pv-audio-cover">${cover}</div>
            <div class="pv-audio-info">
              <span class="pv-audio-name">${escapeHTML(a.name)}</span>
              <span class="pv-audio-meta">${formatBytes(a.size || 0)}</span>
            </div>
            <button class="pv-audio-download" type="button" aria-label="Download">
              <i data-lucide="download"></i>
            </button>
            <button class="pv-audio-play" type="button" aria-label="Play">
              <i data-lucide="play" class="icon-play"></i>
              <i data-lucide="pause" class="icon-pause"></i>
            </button>
          </div>
        `);
      });
    }

    if (msg.files && msg.files.length) {
      msg.files.forEach((f) => {
        const icon = iconForFile(f.name);
        parts.push(`
          <div class="pv-file"
               data-file-url="${escapeHTML(f.url)}"
               data-file-name="${escapeHTML(f.name)}">
            <div class="pv-file-icon"><i data-lucide="${icon}"></i></div>
            <div class="pv-file-info">
              <span class="pv-file-name">${escapeHTML(f.name)}</span>
              <span class="pv-file-size">${formatBytes(f.size || 0)}</span>
            </div>
            <button class="pv-file-download" type="button" aria-label="Download">
              <i data-lucide="download"></i>
            </button>
          </div>
        `);
      });
    }

    return parts.join("");
  }

  /* ============================================================
     Render — card
     ============================================================ */
  function renderCard(msg) {
    const isSent = msg._sent === true;
    const isUnread = !isSent && !msg.read_at;
    const isReported = !!msg.reported_at;
    const isIgnored = !!msg.ignored_at;

    const classes = ["pv-card"];
    if (isUnread) classes.push("is-unread");
    if (isReported) classes.push("is-reported");
    if (isIgnored) classes.push("is-ignored");
    if (isSent) classes.push("is-sent");

    const avatarHTML = msg.avatar
      ? `<img src="${escapeHTML(msg.avatar)}" alt="" loading="lazy" />`
      : `<i data-lucide="${isSent ? "user-round" : "venetian-mask"}"></i>`;

    const verifiedHTML = msg.verified
      ? `<svg viewBox="0 0 24 24" fill="currentColor" style="width:12px;height:12px;color:var(--accent)"><path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z"/></svg>`
      : "";

    const attachmentsHTML = renderAttachments(msg);

    const unreadBarHTML = isUnread
      ? `<div class="pv-unread-bar" data-unread-bar="${escapeHTML(msg.id)}">
          <div class="pv-unread-bar-icon"><i data-lucide="mail"></i></div>
          <div class="pv-unread-bar-body">
            <span class="pv-unread-bar-title">New secret message</span>
            <span class="pv-unread-bar-hint">Tap to reveal · sender won't be notified</span>
          </div>
          <div class="pv-unread-bar-arrow"><i data-lucide="arrow-down"></i></div>
        </div>`
      : "";

    const sentBarHTML = isSent
      ? `<div class="pv-sent-bar">
          <div class="pv-sent-bar-icon"><i data-lucide="send"></i></div>
          <div class="pv-sent-bar-body">
            <span class="pv-sent-bar-title">You sent this</span>
            <span class="pv-sent-bar-hint">To @${escapeHTML(msg.to || "unknown")}</span>
          </div>
        </div>`
      : "";

    const displayName = isSent
      ? `To @${escapeHTML(msg.to || "unknown")}`
      : escapeHTML(msg.alias || "Anonymous");

    const anonTag = isSent
      ? ""
      : `<span class="pv-anon-tag">
           <i data-lucide="venetian-mask"></i>
           <span>Anonymous</span>
         </span>`;

    const actionsHTML = isSent
      ? `<footer class="pv-actions">
           <div class="pv-actions-spacer"></div>
           <button class="pv-action pv-action-danger" type="button" data-action="delete" data-id="${escapeHTML(msg.id)}">
             <i data-lucide="trash-2"></i>
             <span>Delete</span>
           </button>
         </footer>`
      : `<footer class="pv-actions">
           <button class="pv-action ${msg.replied_at ? "is-active" : ""}" type="button" data-action="reply" data-id="${escapeHTML(msg.id)}">
             <i data-lucide="reply"></i>
             <span>Reply</span>
           </button>
           <button class="pv-action ${isIgnored ? "is-active" : ""}" type="button" data-action="ignore" data-id="${escapeHTML(msg.id)}">
             <i data-lucide="eye-off"></i>
             <span>${isIgnored ? "Ignored" : "Ignore"}</span>
           </button>
           <button class="pv-action pv-action-danger ${isReported ? "is-active" : ""}" type="button" data-action="report" data-id="${escapeHTML(msg.id)}">
             <i data-lucide="flag"></i>
             <span>${isReported ? "Reported" : "Report"}</span>
           </button>
           <div class="pv-actions-spacer"></div>
           <button class="pv-action" type="button" data-action="delete" data-id="${escapeHTML(msg.id)}">
             <i data-lucide="trash-2"></i>
           </button>
         </footer>`;

    return `
      <article class="${classes.join(" ")}" data-msg-id="${escapeHTML(msg.id)}" data-sent="${isSent ? "1" : "0"}">
        ${unreadBarHTML}
        ${sentBarHTML}

        <header class="pv-card-head">
          <div class="pv-avatar">${avatarHTML}</div>
          <div class="pv-meta">
            <span class="pv-name">
              ${displayName}
              ${verifiedHTML}
              ${anonTag}
            </span>
            <span class="pv-time">${timeAgo(msg.created_at)}</span>
          </div>
          <button class="pv-menu-btn" type="button" aria-label="More">
            <i data-lucide="more-horizontal"></i>
          </button>
        </header>

        ${msg.text ? `<p class="pv-text">${escapeHTML(msg.text)}</p>` : ""}

        ${attachmentsHTML ? `<div class="pv-attachments">${attachmentsHTML}</div>` : ""}

        ${actionsHTML}
      </article>
    `;
  }

  /* ============================================================
     Filter + render
     ============================================================ */
  function applyFilter(list) {
    if (currentFilter === "unread")
      return list.filter((m) => !m._sent && !m.read_at);
    if (currentFilter === "ignored")
      return list.filter((m) => !m._sent && !!m.ignored_at);
    if (currentFilter === "sent") return list.filter((m) => m._sent);
    if (currentFilter === "reported")
      return list.filter((m) => !m._sent && !!m.reported_at);
    if (currentFilter === "media")
      return list.filter(
        (m) =>
          (m.images && m.images.length) ||
          (m.audios && m.audios.length) ||
          (m.files && m.files.length),
      );
    return list;
  }

  function render() {
    const listEl = document.getElementById("pv-list");
    const emptyEl = document.getElementById("pv-empty");
    const emptyTitle = document.getElementById("pv-empty-title");
    const emptyText = document.getElementById("pv-empty-text");
    if (!listEl) return;

    const all = [
      ...messages.map((m) => ({ ...m, _sent: false })),
      ...sentMessages.map((m) => ({ ...m, _sent: true })),
    ];

    const filtered = applyFilter(all);
    const sorted = sortMessages(filtered);

    if (!sorted.length) {
      listEl.innerHTML = "";
      if (emptyEl) emptyEl.hidden = false;

      const messages_map = {
        all: {
          title: "Nothing here yet",
          text: "You haven't received or sent any secret messages yet.",
        },
        unread: {
          title: "No unread messages",
          text: "Everything has been read. Nice work staying on top of things.",
        },
        ignored: {
          title: "No ignored senders",
          text: "When you ignore someone, their future messages won't reach you. They'll appear here.",
        },
        sent: {
          title: "You haven't sent anything",
          text: "Send an anonymous message to someone and it will appear here.",
        },
        media: {
          title: "No media messages",
          text: "Messages with images, audio, or files will show up here.",
        },
        reported: {
          title: "No reported messages",
          text: "You haven't reported anything. That's a good sign.",
        },
      };
      const m = messages_map[currentFilter] || messages_map.all;
      if (emptyTitle) emptyTitle.textContent = m.title;
      if (emptyText) emptyText.textContent = m.text;

      const btn = emptyEl ? emptyEl.querySelector(".pv-empty-btn") : null;
      if (btn) {
        btn.style.display = currentFilter === "sent" ? "inline-flex" : "none";
      }
      return;
    }

    if (emptyEl) emptyEl.hidden = true;
    listEl.innerHTML = sorted.map(renderCard).join("");

    if (window.lucide) window.lucide.createIcons({ root: listEl });
    if (window.VexecImageLoader) {
      setTimeout(() => window.VexecImageLoader.scan(listEl), 30);
    }
  }

  function queueRender() {
    if (queuedRender) return;
    queuedRender = true;
    requestAnimationFrame(() => {
      queuedRender = false;
      render();
    });
  }

  /* ============================================================
     Load
     ============================================================ */
  async function loadInbox() {
    const listEl = document.getElementById("pv-list");
    if (!listEl) return;

    listEl.innerHTML = Array(3).fill(0).map(() => `
      <div class="pv-card" style="pointer-events:none">
        <div class="pv-card-head">
          <div class="pv-avatar skeleton" style="border:none;background:color-mix(in srgb,var(--border) 60%,transparent)"></div>
          <div class="pv-meta" style="gap:6px">
            <div class="skeleton" style="width:120px;height:12px;border-radius:6px"></div>
            <div class="skeleton" style="width:80px;height:10px;border-radius:6px"></div>
          </div>
        </div>
        <div class="skeleton" style="width:100%;height:60px;border-radius:10px"></div>
      </div>
    `).join("");

    try {
      const [inboxRes, sentRes] = await Promise.all([
        API.get("/api/secret/inbox"),
        API.get("/api/secret/sent").catch(() => ({ data: [] })),
      ]);
      messages = API.unwrap(inboxRes) || [];
      sentMessages = API.unwrap(sentRes) || [];
      queueRender();
    } catch (err) {
      console.error("[pv] load failed", err);
      messages = [];
      sentMessages = [];
      queueRender();
    }
  }

  /* ============================================================
     Actions
     ============================================================ */
  async function markRead(id) {
    const msg = messages.find((m) => m.id === id);
    if (!msg || msg.read_at) return;
    msg.read_at = new Date().toISOString();
    queueRender();
    try {
      await API.post(`/api/secret/${encodeURIComponent(id)}/read`);
    } catch (_) {}
  }

  async function toggleIgnore(id) {
    const msg = messages.find((m) => m.id === id);
    if (!msg) return;
    msg.ignored_at = msg.ignored_at ? null : new Date().toISOString();
    queueRender();
    try {
      await API.post(
        `/api/secret/${encodeURIComponent(id)}/${msg.ignored_at ? "ignore" : "unignore"}`,
      );
    } catch (_) {}
  }

  function removeMessage(id, sent) {
    if (sent) {
      sentMessages = sentMessages.filter((m) => m.id !== id);
    } else {
      messages = messages.filter((m) => m.id !== id);
    }
    queueRender();
    API.delete(`/api/secret/${encodeURIComponent(id)}`).catch(() => {});
  }

  /* ============================================================
     REPORT MODAL
     ============================================================ */
  const REPORT_CATEGORIES = [
    { id: "spam", label: "Spam or advertising", desc: "Unwanted promotion, mass messages, or bot activity", icon: "megaphone", suggestion: "This message is spam or promotional content. It appears to be sent in mass." },
    { id: "harassment", label: "Harassment or bullying", desc: "Targeted insults, threats, or repeated unwanted contact", icon: "user-x", suggestion: "This message contains harassment or bullying. It was sent with the intent to hurt or intimidate." },
    { id: "hate", label: "Hate speech", desc: "Attacks based on race, religion, gender, or identity", icon: "heart-crack", suggestion: "This message contains hate speech targeting a group based on identity." },
    { id: "violence", label: "Violence or threats", desc: "Threats of harm, graphic violence, or dangerous content", icon: "alert-triangle", suggestion: "This message contains threats of violence or references to harmful acts." },
    { id: "sexual", label: "Sexual or adult content", desc: "Unsolicited explicit material or suggestive content", icon: "alert-octagon", suggestion: "This message contains unsolicited sexual or explicit content." },
    { id: "self-harm", label: "Self-harm or suicide", desc: "Content promoting or depicting self-harm", icon: "alert-circle", suggestion: "This message promotes or depicts self-harm or suicide." },
    { id: "misinformation", label: "Misinformation", desc: "Deliberately false or misleading content", icon: "info", suggestion: "This message contains deliberately false or misleading information." },
    { id: "other", label: "Something else", desc: "Something that doesn't fit the categories above", icon: "more-horizontal", suggestion: "" },
  ];

  let reportState = null;
  let reportEl = null;

  function ensureReportModal() {
    if (reportEl) return reportEl;
    reportEl = document.createElement("div");
    reportEl.className = "report-modal";
    reportEl.setAttribute("aria-hidden", "true");
    reportEl.innerHTML = `
      <div class="report-backdrop" data-report-close></div>
      <div class="report-card" role="dialog">
        <header class="report-head">
          <button class="report-back" type="button" data-report-back hidden aria-label="Back"><i data-lucide="arrow-left"></i></button>
          <div class="report-head-icon"><i data-lucide="flag"></i></div>
          <div class="report-head-body">
            <h3 class="report-title">Report message</h3>
            <p class="report-sub" id="report-sub">Choose a reason</p>
          </div>
          <button class="report-close" type="button" data-report-close aria-label="Close"><i data-lucide="x"></i></button>
        </header>
        <div class="report-body" id="report-body"></div>
        <footer class="report-foot" id="report-foot"></footer>
      </div>
    `;
    document.body.appendChild(reportEl);
    if (window.lucide) window.lucide.createIcons({ root: reportEl });
    return reportEl;
  }

  function renderReportStep1() {
    const body = document.getElementById("report-body");
    const foot = document.getElementById("report-foot");
    const back = reportEl.querySelector("[data-report-back]");
    const sub = document.getElementById("report-sub");
    if (back) back.hidden = true;
    if (sub) sub.textContent = "Choose a reason";
    body.innerHTML = `<div class="report-categories">${REPORT_CATEGORIES.map((c) => `
      <button class="report-category" type="button" data-report-cat="${c.id}">
        <div class="report-category-icon"><i data-lucide="${c.icon}"></i></div>
        <div class="report-category-text">
          <span class="report-category-title">${c.label}</span>
          <span class="report-category-desc">${c.desc}</span>
        </div>
        <i data-lucide="chevron-right" class="report-category-chevron"></i>
      </button>`).join("")}</div>`;
    foot.innerHTML = `<button class="report-btn report-btn-ghost" type="button" data-report-close>Cancel</button>`;
    if (window.lucide) window.lucide.createIcons({ root: reportEl });
  }

  function renderReportStep2() {
    const body = document.getElementById("report-body");
    const foot = document.getElementById("report-foot");
    const back = reportEl.querySelector("[data-report-back]");
    const sub = document.getElementById("report-sub");
    const category = REPORT_CATEGORIES.find((c) => c.id === reportState.categoryId);
    if (!category) return;
    if (back) back.hidden = false;
    if (sub) sub.textContent = category.label;
    body.innerHTML = `
      <div class="report-step2">
        <div class="report-step2-head"><i data-lucide="${category.icon}"></i><span>${category.label}</span></div>
        <textarea class="report-textarea" id="report-textarea" maxlength="500" placeholder="Describe what's wrong with this message...">${escapeHTML(category.suggestion)}</textarea>
        <p class="report-hint">Add any details you think will help us understand. This is optional.</p>
      </div>`;
    foot.innerHTML = `
      <button class="report-btn report-btn-ghost" type="button" data-report-close>Cancel</button>
      <button class="report-btn report-btn-primary" type="button" data-report-submit id="report-submit"><i data-lucide="flag"></i><span>Submit report</span></button>`;
    if (window.lucide) window.lucide.createIcons({ root: reportEl });
    const ta = document.getElementById("report-textarea");
    if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  }

  function openReportModal(msgId) {
    reportState = { msgId, categoryId: null };
    ensureReportModal();
    renderReportStep1();
    reportEl.classList.add("open");
    reportEl.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    if (window.lucide) window.lucide.createIcons({ root: reportEl });
  }

  function closeReportModal() {
    if (!reportEl) return;
    reportEl.classList.remove("open");
    reportEl.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    reportState = null;
  }

  async function submitReport() {
    if (!reportState) return;
    const ta = document.getElementById("report-textarea");
    const btn = document.getElementById("report-submit");
    const text = ta ? ta.value.trim() : "";
    if (btn) { btn.disabled = true; const lbl = btn.querySelector("span"); if (lbl) lbl.textContent = "Sending…"; }
    try {
      await API.post(`/api/secret/${encodeURIComponent(reportState.msgId)}/report`, { category: reportState.categoryId, text });
      const msg = messages.find((m) => m.id === reportState.msgId);
      if (msg) msg.reported_at = new Date().toISOString();
      closeReportModal();
      queueRender();
    } catch (err) {
      console.error("[pv] report failed", err);
      if (btn) { btn.disabled = false; const lbl = btn.querySelector("span"); if (lbl) lbl.textContent = "Submit report"; }
    }
  }

  document.addEventListener("click", (e) => {
    if (!reportEl) return;
    if (e.target.closest("[data-report-back]")) {
      e.stopPropagation();
      if (reportState) { reportState.categoryId = null; renderReportStep1(); }
      return;
    }
    if (e.target.closest("[data-report-close]")) {
      e.stopPropagation(); closeReportModal(); return;
    }
    const cat = e.target.closest("[data-report-cat]");
    if (cat && reportState) {
      e.stopPropagation();
      reportState.categoryId = cat.dataset.reportCat;
      renderReportStep2();
      return;
    }
    if (e.target.closest("[data-report-submit]")) {
      e.stopPropagation(); submitReport(); return;
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && reportEl && reportEl.classList.contains("open")) closeReportModal();
  });

  /* ============================================================
     GLOBAL CLICK — only PV-specific things
     (Audio play + audio download are handled by home.js)
     ============================================================ */
  document.addEventListener("click", (e) => {
    if (!document.querySelector(".pv-page")) return;

    /* Unread bar */
    const unreadBar = e.target.closest("[data-unread-bar]");
    if (unreadBar) {
      e.stopPropagation();
      markRead(unreadBar.dataset.unreadBar);
      return;
    }

    /* Filter buttons */
    const filterBtn = e.target.closest(".pv-filter");
    if (filterBtn) {
      e.stopPropagation();
      currentFilter = filterBtn.dataset.filter || "all";
      document.querySelectorAll(".pv-filter").forEach((f) =>
        f.classList.toggle("active", f === filterBtn),
      );
      queueRender();
      return;
    }

    /* File download button — home.js doesn't handle .pv-file */
    const fileDownload = e.target.closest(".pv-file-download");
    if (fileDownload) {
      e.stopPropagation();
      e.preventDefault();
      const card = fileDownload.closest(".pv-file");
      if (!card) return;
      const url = card.dataset.fileUrl;
      const name = card.dataset.fileName || "file";
      if (url && window.VexecDownload) {
        window.VexecDownload.download(url, name);
      }
      return;
    }

    /* Click on file row (not on a button) */
    const fileEl = e.target.closest(".pv-file");
    if (fileEl && !e.target.closest("button")) {
      e.stopPropagation();
      const url = fileEl.dataset.fileUrl;
      const name = fileEl.dataset.fileName || "file";
      if (url && window.VexecDownload) {
        window.VexecDownload.download(url, name);
      }
      return;
    }

    /* Card actions */
    const actionBtn = e.target.closest(".pv-action");
    if (actionBtn) {
      e.stopPropagation();
      const action = actionBtn.dataset.action;
      const id = actionBtn.dataset.id;
      const card = actionBtn.closest(".pv-card");
      const isSent = card && card.dataset.sent === "1";
      if (action === "ignore") toggleIgnore(id);
      else if (action === "report") openReportModal(id);
      else if (action === "delete") removeMessage(id, isSent);
      else if (action === "reply") { if (window.router) window.router.navigate("/pv/new"); }
      return;
    }

    /* Image lightbox — home.js handles [data-lightbox], but add here for safety */
    const imgEl = e.target.closest("[data-lightbox]");
    if (imgEl) {
      e.stopPropagation();
      if (typeof window.openLightbox === "function") {
        window.openLightbox(imgEl.dataset.lightbox, "image");
      }
      return;
    }
  });

  /* ============================================================
     Route hooks
     ============================================================ */
  document.addEventListener("route:change", (e) => {
    if (e.detail && e.detail.path === "/pv") {
      setTimeout(() => {
        if (window.lucide) window.lucide.createIcons();
        loadInbox();
      }, 40);
    }
  });

  document.addEventListener("DOMContentLoaded", () => {
    if (window.location.pathname.endsWith("/pv")) {
      setTimeout(loadInbox, 120);
    }
  });

  window.VexecPV = { load: loadInbox };
})();