/* ============================================================
   WRITE — Vexec
   Editor + Attachments + Inspiration + Settings + Send
   Emoji picker is global → see emoji.js
   ============================================================ */

(function () {
  "use strict";

  /* ============================================================
     CONFIG
     ============================================================ */
  const MAX_CHARS = 500;
  const MAX_FILES = 3;
  const DRAFT_KEY = "vexec:write:draft:v1";

  const DEFAULT_LIMITS = {
    image: 5242880,
    audio: 10485760,
    document: 20971520,
    camera: 5242880,
  };

  function getLimits() {
    if (window.VexecConfig && window.VexecConfig.limits) {
      return { ...DEFAULT_LIMITS, ...window.VexecConfig.limits };
    }
    return DEFAULT_LIMITS;
  }

  /* ============================================================
     INSPIRATION QUOTES
     ============================================================ */
  const INSPIRATIONS = [
    "Some truths only breathe in the dark.",
    "Anonymity is the truest form of honesty.",
    "What you can't say aloud, write here.",
    "Every whisper finds its reader.",
    "No name. No face. Just truth.",
    "Your secret is safe with the void.",
    "Write like nobody's watching.",
    "Say it here. Say it now. Say it free.",
    "The quiet ones have the loudest thoughts.",
    "Let the unspoken finally speak.",
  ];

  let inspirationTimer = null;
  let inspirationIndex = 0;

  /* ============================================================
     STATE
     ============================================================ */
  let attachments = [];
  let previewMode = false;
  let draftTimer = null;

  const writeSettings = {
    randomDelay: false,
    burnAfter: false,
    allowComments: true,
    allowSaves: true,
    sensitive: false,
    contentWarning: false,
    pinToProfile: false,
  };

  let cwText = "";

  /* ============================================================
     DOM REFS
     ============================================================ */
  let textarea, editor, counter, counterNum, counterBar;
  let attachmentsEl, previewEl, previewTextEl, previewAttachmentsEl;
  let sendBtn, cwInput, cwTextEl;

  /* ============================================================
     HELPERS
     ============================================================ */
  function formatBytes(bytes) {
    if (!bytes) return "0 B";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1024 * 1024 * 1024)
      return (bytes / (1024 * 1024)).toFixed(2) + " MB";
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

  function iconForFile(file) {
    const type = file.type;
    const name = file.name.toLowerCase();
    if (type.includes("pdf") || name.endsWith(".pdf")) return "file-text";
    if (type.includes("word") || /\.(docx?|rtf|odt)$/.test(name))
      return "file-text";
    if (type.includes("sheet") || /\.(xlsx?|csv|ods)$/.test(name))
      return "file-spreadsheet";
    if (type.includes("zip") || /\.(zip|rar|7z|tar|gz)$/.test(name))
      return "file-archive";
    if (type.startsWith("video/")) return "file-video";
    if (type.startsWith("audio/")) return "music";
    return "file";
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
    modal.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });
  }

  function showToast(message, icon) {
    icon = icon || "check";
    let toast = document.querySelector(".profile-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "profile-toast";
      document.body.appendChild(toast);
    }
    toast.innerHTML =
      '<i data-lucide="' + icon + '"></i><span>' + message + "</span>";
    if (window.lucide) window.lucide.createIcons({ root: toast });
    requestAnimationFrame(() => toast.classList.add("show"));
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  /* ============================================================
     INSPIRATION ROTATOR
     ============================================================ */
  function startInspiration() {
    const textEl = document.getElementById("write-inspiration-text");
    if (!textEl) return;

    // Random starting index
    inspirationIndex = Math.floor(Math.random() * INSPIRATIONS.length);
    textEl.textContent = INSPIRATIONS[inspirationIndex];

    clearInterval(inspirationTimer);
    inspirationTimer = setInterval(() => {
      textEl.classList.add("switching");
      setTimeout(() => {
        inspirationIndex = (inspirationIndex + 1) % INSPIRATIONS.length;
        textEl.textContent = INSPIRATIONS[inspirationIndex];
        textEl.classList.remove("switching");
      }, 500);
    }, 5500);
  }

  function stopInspiration() {
    clearInterval(inspirationTimer);
    inspirationTimer = null;
  }

  /* ============================================================
     INIT
     ============================================================ */
  function init() {
    if (!document.querySelector(".write")) return;

    textarea = document.getElementById("write-textarea");
    editor = document.getElementById("write-editor");
    counter = document.getElementById("write-counter");
    counterNum = document.getElementById("write-counter-num");
    counterBar = counter?.querySelector(".write-counter-bar");
    attachmentsEl = document.getElementById("write-attachments");
    previewEl = document.getElementById("write-preview");
    previewTextEl = document.getElementById("write-preview-text");
    previewAttachmentsEl = document.getElementById("write-preview-attachments");
    sendBtn = document.getElementById("write-send");
    cwInput = document.getElementById("write-cw-input");
    cwTextEl = document.getElementById("write-cw-text");

    if (!textarea) return;

    // Restore draft
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}");
      if (draft.text) textarea.value = draft.text;
      if (draft.settings) Object.assign(writeSettings, draft.settings);
      if (draft.cwText) cwText = draft.cwText;
    } catch (_) {}

    updateCounter();
    applySettingsUI();
    renderAttachments();
    setupCameraAvailability();
    startInspiration();

    if (cwTextEl && cwText) cwTextEl.value = cwText;

    if (window.lucide) window.lucide.createIcons();
  }

  /* ============================================================
     COUNTER
     ============================================================ */
  function updateCounter() {
    if (!textarea || !counter || !counterNum) return;
    const len = textarea.value.length;
    const remaining = MAX_CHARS - len;

    counterNum.textContent = String(remaining);

    const pct = len / MAX_CHARS;
    const circumference = 97.4;
    const offset = circumference * (1 - pct);
    if (counterBar) counterBar.style.strokeDashoffset = String(offset);

    counter.classList.remove("warn", "danger");
    if (remaining <= 0) counter.classList.add("danger");
    else if (remaining <= 50) counter.classList.add("warn");

    if (previewTextEl) previewTextEl.textContent = textarea.value;

    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 420) + "px";
  }

  /* ============================================================
     ATTACHMENTS
     ============================================================ */
  function openFilePicker(kind) {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = kind !== "camera";

    if (kind === "image") input.accept = "image/*";
    else if (kind === "audio")
      input.accept = "audio/*,.mp3,.wav,.ogg,.flac,.m4a,.aac,.opus,.webm";
    else if (kind === "document")
      input.accept =
        ".pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx,.ppt,.pptx,.zip,.rar";
    else if (kind === "camera") {
      input.accept = "image/*";
      input.capture = "environment";
    }

    input.style.display = "none";
    document.body.appendChild(input);

    input.addEventListener("change", () => {
      const files = Array.from(input.files || []);
      if (files.length) addAttachments(files, kind);
      document.body.removeChild(input);
    });
    input.click();
  }

  function addAttachments(files, pickerKind) {
    const limits = getLimits();
    const accepted = [];

    for (const file of files) {
      const kind =
        pickerKind === "camera"
          ? "camera"
          : file.type.startsWith("image/")
            ? "image"
            : file.type.startsWith("audio/")
              ? "audio"
              : "document";

      const limit = limits[kind] ?? limits.document;
      if (limit && file.size > limit) {
        showLimitModal({
          title: "File too large",
          message: `${escapeHTML(file.name)} is ${formatBytes(file.size)}. Max is ${formatBytes(limit)}.`,
        });
        continue;
      }
      accepted.push({ file, kind });
    }

    if (accepted.length === 0) return;

    const remainingSlots = MAX_FILES - attachments.length;
    if (remainingSlots <= 0) {
      showLimitModal({
        title: "Too many files",
        message: `You can attach up to ${MAX_FILES} files per whisper.`,
        icon: "alert-triangle",
      });
      return;
    }

    let rejectedCount = 0;
    accepted.forEach(({ file, kind }) => {
      if (attachments.length >= MAX_FILES) {
        rejectedCount++;
        return;
      }
      const blobUrl = URL.createObjectURL(file);
      attachments.push({
        id: Math.random().toString(36).slice(2),
        file,
        url: blobUrl,
        kind,
        coverUrl: null,
      });
    });

    if (rejectedCount > 0) {
      showLimitModal({
        title: "Limit reached",
        message: `Only ${MAX_FILES} files allowed. ${rejectedCount} file${rejectedCount > 1 ? "s were" : " was"} skipped.`,
        icon: "alert-triangle",
      });
    }

    renderAttachments();
    renderPreviewAttachments();
    scheduleDraftSave();
  }

  function removeAttachment(id) {
    const idx = attachments.findIndex((a) => a.id === id);
    if (idx < 0) return;
    const [entry] = attachments.splice(idx, 1);
    if (entry.url) URL.revokeObjectURL(entry.url);
    renderAttachments();
    renderPreviewAttachments();
    scheduleDraftSave();
  }

  function renderAttachments() {
    if (!attachmentsEl) return;

    attachmentsEl.innerHTML = attachments
      .map((entry) => {
        const { file, url, kind } = entry;
        let preview;
        if (kind === "image" || file.type.startsWith("image/")) {
          preview = `<img src="${url}" alt="" />`;
        } else if (file.type.startsWith("audio/")) {
          preview = `<i data-lucide="music"></i>`;
        } else {
          preview = `<i data-lucide="${iconForFile(file)}"></i>`;
        }

        return (
          `<div class="write-attach-chip" data-id="${entry.id}">` +
          `<div class="write-attach-preview">${preview}</div>` +
          `<div class="write-attach-info">${formatBytes(file.size)}</div>` +
          `<button class="write-attach-remove" type="button" data-remove="${entry.id}" aria-label="Remove">` +
          `<i data-lucide="x"></i>` +
          `</button>` +
          `</div>`
        );
      })
      .join("");

    if (window.lucide) window.lucide.createIcons();
  }

  function renderPreviewAttachments() {
    if (!previewAttachmentsEl) return;
    previewAttachmentsEl.innerHTML = attachments
      .map((entry) => {
        const label =
          entry.kind === "image"
            ? "Image"
            : entry.kind === "audio"
              ? "Audio"
              : entry.kind === "camera"
                ? "Photo"
                : "File";
        const icon =
          entry.kind === "image" || entry.kind === "camera"
            ? "image"
            : entry.kind === "audio"
              ? "music"
              : iconForFile(entry.file);
        return (
          `<span class="write-preview-chip">` +
          `<i data-lucide="${icon}"></i>` +
          `<span>${label}</span>` +
          `</span>`
        );
      })
      .join("");
    if (window.lucide) window.lucide.createIcons();
  }

  /* ============================================================
     PREVIEW TOGGLE
     ============================================================ */
  function togglePreview() {
    previewMode = !previewMode;

    const previewBtn = document.querySelector(
      '[data-action="toggle-preview"]',
    );
    previewBtn?.classList.toggle("is-active", previewMode);

    editor.hidden = previewMode;
    attachmentsEl.hidden = previewMode;
    previewEl.hidden = !previewMode;

    if (previewMode) {
      if (previewTextEl) previewTextEl.textContent = textarea.value;
      renderPreviewAttachments();
      if (window.lucide) window.lucide.createIcons();
    }
  }

  /* ============================================================
     SETTINGS UI
     ============================================================ */
  function applySettingsUI() {
    document.querySelectorAll("[data-write-toggle]").forEach((btn) => {
      const key = btn.dataset.writeToggle;
      btn.setAttribute("aria-checked", String(!!writeSettings[key]));
    });

    const delaySub = document.getElementById("write-delay-sub");
    if (delaySub) {
      delaySub.textContent = writeSettings.randomDelay
        ? "Active · posted within 10 min – 2 hrs"
        : "Post between 10 min – 2 hours";
    }

    if (cwInput) {
      cwInput.hidden = !writeSettings.contentWarning;
      if (writeSettings.contentWarning && window.lucide) {
        window.lucide.createIcons({ root: cwInput });
      }
    }
  }

  /* ============================================================
     DRAFT
     ============================================================ */
  function scheduleDraftSave() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraft, 500);
  }

  function saveDraft() {
    if (!textarea) return;
    try {
      const draft = {
        text: textarea.value,
        settings: writeSettings,
        cwText,
        savedAt: Date.now(),
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch (_) {}
  }

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (_) {}
  }

  /* ============================================================
     SEND
     ============================================================ */
  function sendWhisper() {
    if (!textarea || !sendBtn) return;

    const text = textarea.value.trim();
    if (!text && attachments.length === 0) {
      showToast("Write something first", "alert-circle");
      return;
    }

    sendBtn.classList.add("is-sending");
    const originalLabel = sendBtn.querySelector(".write-send-label");
    if (originalLabel) originalLabel.textContent = "Whispering";

    const doc = document.querySelector(".write");
    doc?.classList.add("is-whispering");

    setTimeout(() => {
      const payload = {
        text,
        attachments: attachments.map((a) => ({
          name: a.file.name,
          size: a.file.size,
          kind: a.kind,
        })),
        settings: { ...writeSettings },
        contentWarning: writeSettings.contentWarning ? cwText : null,
        sentAt: Date.now(),
      };
      console.log("[write] whisper sent:", payload);

      clearDraft();

      setTimeout(() => {
        textarea.value = "";
        attachments.forEach((a) => a.url && URL.revokeObjectURL(a.url));
        attachments = [];
        cwText = "";
        if (cwTextEl) cwTextEl.value = "";
        renderAttachments();
        renderPreviewAttachments();
        updateCounter();

        doc?.classList.remove("is-whispering");
        sendBtn.classList.remove("is-sending");
        if (originalLabel) originalLabel.textContent = "Whisper";

        if (previewMode) togglePreview();

        showToast("Whisper sent into the void", "check-check");
      }, 900);
    }, 700);
  }

  /* ============================================================
     CAMERA
     ============================================================ */
  function setupCameraAvailability() {
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    document.querySelectorAll(".write-tool-camera").forEach((btn) => {
      if (!isMobile) {
        btn.disabled = true;
        btn.setAttribute("aria-disabled", "true");
        btn.title = "Camera only on mobile";
      }
    });
  }

  /* ============================================================
     GLOBAL CLICK
     ============================================================ */
  document.addEventListener("click", (e) => {
    if (!document.querySelector(".write")) return;

    // Toolbar attach
    const tool = e.target.closest("[data-attach]");
    if (tool) {
      if (tool.disabled) return;
      openFilePicker(tool.dataset.attach);
      return;
    }

    // Actions
    const actionEl = e.target.closest("[data-action]");
    if (actionEl) {
      const action = actionEl.dataset.action;
      if (action === "emoji") {
        if (window.VexecEmoji) window.VexecEmoji.toggle(textarea);
        return;
      }
      if (action === "close-emoji") {
        if (window.VexecEmoji) window.VexecEmoji.close();
        return;
      }
      if (action === "toggle-preview") {
        togglePreview();
        return;
      }
    }

    // Remove attachment
    const removeBtn = e.target.closest("[data-remove]");
    if (removeBtn) {
      removeAttachment(removeBtn.dataset.remove);
      return;
    }

    // Settings toggles
    const toggle = e.target.closest("[data-write-toggle]");
    if (toggle) {
      const key = toggle.dataset.writeToggle;
      const next = toggle.getAttribute("aria-checked") !== "true";
      toggle.setAttribute("aria-checked", String(next));
      writeSettings[key] = next;
      applySettingsUI();
      scheduleDraftSave();
      return;
    }

    // Send
    if (e.target.closest("#write-send")) {
      sendWhisper();
      return;
    }
  });

  /* ============================================================
     INPUT
     ============================================================ */
  document.addEventListener("input", (e) => {
    if (e.target.id === "write-textarea") {
      updateCounter();
      scheduleDraftSave();
    }
    if (e.target.id === "write-cw-text") {
      cwText = e.target.value;
      scheduleDraftSave();
    }
  });

  /* ============================================================
     KEYBOARD — Ctrl/Cmd + Enter = Send
     ============================================================ */
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      if (e.target.id === "write-textarea") {
        e.preventDefault();
        sendWhisper();
      }
    }
  });

  /* ============================================================
     ROUTE HOOKS
     ============================================================ */
  document.addEventListener("route:change", (e) => {
    if (e.detail && e.detail.path === "/write") {
      setTimeout(init, 60);
    } else {
      stopInspiration();
    }
  });

  document.addEventListener("DOMContentLoaded", () => {
    if (window.location.pathname.endsWith("/write")) {
      setTimeout(init, 120);
    }
  });
})();