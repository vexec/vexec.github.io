/* ============================================================
   PV NEW — Compose and send a secret message
   ============================================================ */

(function () {
  "use strict";

  /* ============================================================
     State
     ============================================================ */
  let recipient = null;   // { username, name, avatar, verified }
  let attachments = [];   // [{ id, file, url, kind }]
  let searchTimer = null;
  let searchToken = 0;

  const MAX_ATTACHMENTS = 5;

  const LIMITS = (window.VexecConfig && window.VexecConfig.limits) || {
    image: 5 * 1024 * 1024,
    audio: 10 * 1024 * 1024,
    document: 20 * 1024 * 1024,
    camera: 5 * 1024 * 1024,
  };

  /* ============================================================
     Helpers
     ============================================================ */
  function $(id) { return document.getElementById(id); }

  function formatBytes(bytes) {
    if (!bytes) return "0 B";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + " MB";
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  }

  function escapeHTML(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function iconForFile(file) {
    const t = file.type || "";
    const n = (file.name || "").toLowerCase();
    if (t.includes("pdf") || n.endsWith(".pdf")) return "file-text";
    if (/\.(docx?|rtf|odt)$/.test(n)) return "file-text";
    if (/\.(xlsx?|csv|ods)$/.test(n)) return "file-spreadsheet";
    if (/\.(zip|rar|7z|tar|gz)$/.test(n)) return "file-archive";
    return "file";
  }

  function kindForFile(file, pickerKind) {
    if (pickerKind === "camera") return "camera";
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("audio/")) return "audio";
    return "document";
  }

  /* ============================================================
     Search
     ============================================================ */
  function setHint(text, state) {
    const hint = $("ps-hint");
    if (!hint) return;
    hint.textContent = text;
    hint.dataset.state = state || "";
  }

  function showSpinner(show) {
    const sp = $("ps-search-spinner");
    if (sp) sp.hidden = !show;
  }

  function openResults() {
    const r = $("ps-results");
    if (!r) return;
    r.hidden = false;
    requestAnimationFrame(() => r.classList.add("open"));
  }

  function closeResults() {
    const r = $("ps-results");
    if (!r) return;
    r.classList.remove("open");
    setTimeout(() => {
      if (!r.classList.contains("open")) r.hidden = true;
    }, 220);
  }

  function renderResults(items) {
    const inner = $("ps-results-inner");
    if (!inner) return;

    if (!items.length) {
      inner.innerHTML = `
        <div class="ps-results-empty">
          <div class="ps-results-empty-icon">
            <i data-lucide="user-x"></i>
          </div>
          <span>No users found</span>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons({ root: inner });
      return;
    }

    inner.innerHTML = items.map((u) => {
      const avatar = u.avatar
        ? `<img src="${escapeHTML(u.avatar)}" alt="" loading="lazy" />`
        : `<i data-lucide="user-round"></i>`;
      const verified = u.verified
        ? `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z"/></svg>`
        : "";
      return `
        <button class="ps-result" type="button" data-user='${escapeHTML(JSON.stringify({
          username: u.username,
          name: u.name,
          avatar: u.avatar || "",
          verified: !!u.verified,
        }))}'>
          <div class="ps-result-avatar">${avatar}</div>
          <div class="ps-result-body">
            <span class="ps-result-name">
              ${escapeHTML(u.name || "Anonymous")}${verified}
            </span>
            <span class="ps-result-handle">@${escapeHTML(u.username)}</span>
          </div>
          <span class="ps-result-check"><i data-lucide="check"></i></span>
        </button>
      `;
    }).join("");

    if (window.lucide) window.lucide.createIcons({ root: inner });
  }

  function doSearch(q) {
    clearTimeout(searchTimer);
    if (!q) {
      closeResults();
      setHint("Type a username to find the person you want to send to");
      return;
    }
    showSpinner(true);
    searchTimer = setTimeout(async () => {
      const token = ++searchToken;
      try {
        const res = await API.get("/api/users/search", { query: { q } });
        if (token !== searchToken) return;
        const users = API.unwrap(res) || [];
        renderResults(users);
        openResults();
        if (users.length) {
          setHint(`${users.length} user${users.length === 1 ? "" : "s"} found`, "ok");
        } else {
          setHint("No users match that username", "error");
        }
      } catch (err) {
        console.error("[secret-new] search failed", err);
        if (token === searchToken) {
          renderResults([]);
          openResults();
          setHint("Search failed. Try again.", "error");
        }
      } finally {
        if (token === searchToken) showSpinner(false);
      }
    }, 220);
  }

  function selectRecipient(user) {
    recipient = user;
    const wrap = $("ps-search-wrap");
    const chip = $("ps-recipient");
    const input = $("ps-search-input");

    if (wrap) wrap.style.display = "none";
    if (chip) chip.hidden = false;
    if (input) input.value = "";

    const img = $("ps-recipient-img");
    if (img) {
      img.src = user.avatar || "";
      img.alt = user.name || "";
      img.style.display = user.avatar ? "block" : "none";
    }
    $("ps-recipient-name").textContent = user.name || "Anonymous";
    $("ps-recipient-handle").textContent = "@" + user.username;

    closeResults();
    setHint(`Sending to @${user.username}`, "ok");
    validateForm();
  }

  function clearRecipient() {
    recipient = null;
    const wrap = $("ps-search-wrap");
    const chip = $("ps-recipient");
    if (wrap) wrap.style.display = "";
    if (chip) chip.hidden = true;
    setHint("Type a username to find the person you want to send to");
    validateForm();
  }

  /* ============================================================
     Attachments
     ============================================================ */
  function renderAttachments() {
    const el = $("ps-attachments");
    if (!el) return;

    el.innerHTML = attachments.map((entry) => {
      const { file, url, kind, id } = entry;
      let preview;
      if (kind === "image" || kind === "camera" || file.type.startsWith("image/")) {
        preview = `<img src="${url}" alt="" />`;
      } else if (file.type.startsWith("audio/")) {
        preview = `<i data-lucide="music"></i>`;
      } else {
        preview = `<i data-lucide="${iconForFile(file)}"></i>`;
      }
      return `
        <div class="ps-chip" data-id="${id}">
          <div class="ps-chip-preview">${preview}</div>
          <div class="ps-chip-meta">${formatBytes(file.size)}</div>
          <button class="ps-chip-remove" type="button" data-remove="${id}" aria-label="Remove">
            <i data-lucide="x"></i>
          </button>
        </div>
      `;
    }).join("");

    if (window.lucide) window.lucide.createIcons({ root: el });
  }

  function openFilePicker(kind) {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = kind !== "camera";

    if (kind === "image") input.accept = "image/*";
    else if (kind === "audio")
      input.accept = "audio/*,.mp3,.wav,.ogg,.flac,.m4a,.aac,.opus,.webm";
    else if (kind === "document")
      input.accept = ".pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx,.ppt,.pptx,.zip,.rar";
    else if (kind === "camera") {
      input.accept = "image/*";
      input.capture = "environment";
    }

    input.style.display = "none";
    document.body.appendChild(input);
    input.addEventListener("change", () => {
      const files = Array.from(input.files || []);
      if (files.length) addFiles(files, kind);
      document.body.removeChild(input);
    });
    input.click();
  }

  function addFiles(files, pickerKind) {
    const accepted = [];
    for (const file of files) {
      const k = kindForFile(file, pickerKind);
      const limit = LIMITS[k] || LIMITS.document || 20 * 1024 * 1024;
      if (file.size > limit) {
        console.warn("[secret-new] file too large", file.name, file.size);
        continue;
      }
      accepted.push({ file, kind: k });
    }

    const slots = MAX_ATTACHMENTS - attachments.length;
    if (slots <= 0) return;

    accepted.slice(0, slots).forEach(({ file, kind }) => {
      const url = URL.createObjectURL(file);
      attachments.push({
        id: Math.random().toString(36).slice(2),
        file,
        url,
        kind,
      });
    });

    renderAttachments();
    validateForm();
  }

  function removeAttachment(id) {
    const i = attachments.findIndex((a) => a.id === id);
    if (i < 0) return;
    const [entry] = attachments.splice(i, 1);
    if (entry.url) URL.revokeObjectURL(entry.url);
    renderAttachments();
    validateForm();
  }

  /* ============================================================
     Validate form
     ============================================================ */
  function validateForm() {
    const text = $("ps-textarea")?.value.trim() || "";
    const btn = $("ps-send");
    if (!btn) return;
    btn.disabled = !recipient || (!text && attachments.length === 0);
  }

  /* ============================================================
     Camera
     ============================================================ */
  function setupCameraAvailability() {
    const isMobile =
      document.body.classList.contains("is-mobile") ||
      /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    document.querySelectorAll(".ps-tool-camera").forEach((btn) => {
      if (!isMobile) {
        btn.disabled = true;
        btn.setAttribute("aria-disabled", "true");
      }
    });
  }

  /* ============================================================
     Send
     ============================================================ */
  async function sendSecret() {
    if (!recipient) return;
    const text = $("ps-textarea")?.value.trim() || "";
    if (!text && attachments.length === 0) return;

    const btn = $("ps-send");
    if (btn) {
      btn.classList.add("is-loading");
      const lbl = btn.querySelector(".ps-send-label");
      if (lbl) lbl.textContent = "Sending…";
    }

    try {
      /* In real backend, use FormData for files */
      const payload = {
        to: recipient.username,
        text,
        attachments: attachments.map((a) => ({
          name: a.file.name,
          size: a.file.size,
          kind: a.kind,
          /* In mock mode we send blob URL; real API would use FormData */
          url: a.url,
        })),
      };
      await API.post("/api/secret/send", payload);

      if (btn) {
        const lbl = btn.querySelector(".ps-send-label");
        if (lbl) lbl.textContent = "Sent";
      }

      /* Cleanup */
      attachments.forEach((a) => URL.revokeObjectURL(a.url));
      attachments = [];
      renderAttachments();
      if ($("ps-textarea")) $("ps-textarea").value = "";
      updateCounter();

      setTimeout(() => {
        if (window.router) window.router.navigate("/pv");
      }, 700);
    } catch (err) {
      console.error("[secret-new] send failed", err);
      if (btn) {
        btn.classList.remove("is-loading");
        const lbl = btn.querySelector(".ps-send-label");
        if (lbl) lbl.textContent = "Send Secret";
      }
    }
  }

  /* ============================================================
     Counter
     ============================================================ */
  function updateCounter() {
    const ta = $("ps-textarea");
    const counter = $("ps-counter");
    if (!ta || !counter) return;
    counter.textContent = `${ta.value.length} / 2000`;
    validateForm();
  }

  /* ============================================================
     Init
     ============================================================ */
  function init() {
    if (!document.querySelector(".ps-page")) return;

    /* Reset state */
    recipient = null;
    attachments = [];
    searchToken = 0;

    if (window.lucide) window.lucide.createIcons();
    setupCameraAvailability();
    updateCounter();

    const input = $("ps-search-input");
    const chip = $("ps-recipient");
    const wrap = $("ps-search-wrap");
    if (wrap) wrap.style.display = "";
    if (chip) chip.hidden = true;

    if (input && !input.dataset.bound) {
      input.dataset.bound = "1";
      input.addEventListener("input", () => {
        const q = input.value.trim().replace(/[^a-z0-9_]/gi, "");
        if (input.value !== q) input.value = q;
        doSearch(q);
      });
      input.addEventListener("focus", () => {
        if (input.value.trim()) openResults();
      });
    }
  }

  /* ============================================================
     Global click
     ============================================================ */
  document.addEventListener("click", (e) => {
    if (!document.querySelector(".ps-page")) return;

    /* Attach toolbar */
    const tool = e.target.closest(".ps-tool[data-attach]");
    if (tool) {
      e.stopPropagation();
      if (tool.disabled) return;
      openFilePicker(tool.dataset.attach);
      return;
    }

    /* Select a search result */
    const result = e.target.closest(".ps-result");
    if (result && result.dataset.user) {
      e.stopPropagation();
      try {
        const user = JSON.parse(result.dataset.user);
        selectRecipient(user);
      } catch (_) {}
      return;
    }

    /* Clear recipient */
    if (e.target.closest("#ps-recipient-clear")) {
      e.stopPropagation();
      clearRecipient();
      return;
    }

    /* Remove attachment */
    const removeBtn = e.target.closest("[data-remove]");
    if (removeBtn) {
      e.stopPropagation();
      removeAttachment(removeBtn.dataset.remove);
      return;
    }

    /* Send */
    if (e.target.closest("#ps-send")) {
      e.stopPropagation();
      sendSecret();
      return;
    }

    /* Close results if clicked outside */
    if (!e.target.closest("#ps-search")) {
      closeResults();
    }
  });

  /* ============================================================
     Input
     ============================================================ */
  document.addEventListener("input", (e) => {
    if (e.target.id === "ps-textarea") updateCounter();
  });

  /* ============================================================
     Keyboard: Escape closes results
     ============================================================ */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.querySelector(".ps-page")) {
      closeResults();
    }
  });

  /* ============================================================
     Route hooks
     ============================================================ */
  document.addEventListener("route:change", (e) => {
    if (e.detail && e.detail.path === "/pv/new") {
      setTimeout(init, 40);
    }
  });

  document.addEventListener("DOMContentLoaded", () => {
    if (window.location.pathname.endsWith("/pv/new")) {
      setTimeout(init, 120);
    }
  });
})();