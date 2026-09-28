/* ============================================================
   PROFILE PAGE — Vexec
   Global settings (theme / accent / fontSize / fontFamily)
   are stored in COOKIES via window.VexecSettings so they
   apply on every page from the first paint.
   ============================================================ */

(function () {
  "use strict";

  const PROFILE_KEY = "vexec:profile:v1";
  const SETTINGS_KEY = "vexec:profile:settings:v1";

  const GLOBAL_KEYS = ["theme", "fontFamily", "fontSize", "accentColor"];

  const DEFAULT_PROFILE = {
    displayName: "Anonymous Voice",
    username: "vexec_user",
    bio: "Some thoughts are meant to be shared without a name.",
    avatar: null,
    verified: true,
  };

  const DEFAULT_SETTINGS = {
    theme: "auto",
    fontFamily: "Inter",
    fontSize: 100,
    accentColor: "#3b82f6",
    passcode: false,
    hideRead: true,
    push: true,
    sound: true,
    mentions: true,
    replies: true,
    autoDownload: false,
    wifiOnly: true,
    autoTranslate: false,
    language: "English",
  };

  let profile = { ...DEFAULT_PROFILE };
  let settings = { ...DEFAULT_SETTINGS };
  let toastTimer = null;

  /* ============================================================
     COOKIE HELPERS
     ============================================================ */
  function getCookie(name) {
    const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
    return m ? decodeURIComponent(m[2]) : null;
  }

  /* ============================================================
     STORAGE
     ============================================================ */
  async function loadProfile() {
    /* Local cache first for instant paint */
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (raw) profile = { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
    } catch (_) {}

    /* Then refresh from API */
    try {
      const res = await API.get("/api/profile");
      profile = { ...DEFAULT_PROFILE, ...API.unwrap(res) };
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch (_) {}

    return profile;
  }

  async function saveProfile() {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch (_) {}
    try { await API.patch("/api/profile", profile); }
    catch (err) { console.warn("[profile] sync failed", err); }
  }

  function loadSettings() {
    let local = {};
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) local = JSON.parse(raw);
    } catch (_) {}

    const cookies = {
      theme: getCookie("theme") || DEFAULT_SETTINGS.theme,
      accentColor: getCookie("accent") || DEFAULT_SETTINGS.accentColor,
      fontSize: (() => {
        const n = parseInt(getCookie("fontSize") || "100", 10);
        return Number.isFinite(n) ? n : DEFAULT_SETTINGS.fontSize;
      })(),
      fontFamily: getCookie("fontFamily") || DEFAULT_SETTINGS.fontFamily,
    };

    return { ...DEFAULT_SETTINGS, ...local, ...cookies };
  }

  function saveSettings() {
    const local = {};
    Object.keys(settings).forEach((k) => {
      if (!GLOBAL_KEYS.includes(k)) local[k] = settings[k];
    });
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(local)); } catch (_) {}
  }

  /* ============================================================
     TOAST
     ============================================================ */
  function showToast(message, icon) {
    icon = icon || "check";
    let toast = document.querySelector(".profile-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "profile-toast";
      document.body.appendChild(toast);
    }
    toast.innerHTML = '<i data-lucide="' + icon + '"></i><span>' + message + "</span>";
    if (window.lucide) window.lucide.createIcons({ root: toast });

    requestAnimationFrame(() => toast.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  /* ============================================================
     APPLY SETTINGS
     ============================================================ */
  function applyTheme(value) {
    if (window.VexecSettings) {
      window.VexecSettings.set("theme", value);
      window.VexecSettings.applyTheme(value);
    }
  }
  function applyFontFamily(value) {
    if (window.VexecSettings) {
      window.VexecSettings.set("fontFamily", value);
      window.VexecSettings.applyFontFamily(value);
    }
  }
  function applyFontSize(value) {
    if (window.VexecSettings) {
      window.VexecSettings.set("fontSize", String(value));
      window.VexecSettings.applyFontSize(value);
    }
  }
  function applyAccentColor(value) {
    if (window.VexecSettings) {
      window.VexecSettings.set("accent", value);
      window.VexecSettings.applyAccent(value);
    }
  }
  function applyAllSettings() {
    if (window.VexecSettings) window.VexecSettings.applyAll();
  }

  /* ============================================================
     AVATAR
     ============================================================ */
  function renderAvatar() {
    const avatar = document.getElementById("profile-avatar");
    const img = document.getElementById("profile-avatar-img");
    if (!avatar || !img) return;

    if (profile.avatar) {
      img.src = profile.avatar;
      avatar.classList.add("has-image");
    } else {
      img.removeAttribute("src");
      avatar.classList.remove("has-image");
    }
  }

  function renderVerified() {
    const badge = document.getElementById("profile-verified");
    const avatarWrap = document.getElementById("profile-avatar-wrap");
    const isVerified = !!profile.verified;

    if (badge) badge.hidden = !isVerified;
    if (avatarWrap) avatarWrap.classList.toggle("is-verified", isVerified);
  }

  function openAvatarMenu() {
    const menu = document.getElementById("profile-avatar-menu");
    if (!menu) return;
    menu.classList.add("open");
    menu.setAttribute("aria-hidden", "false");
  }
  function closeAvatarMenu() {
    const menu = document.getElementById("profile-avatar-menu");
    if (!menu) return;
    menu.classList.remove("open");
    menu.setAttribute("aria-hidden", "true");
  }

  function handleAvatarFile(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Please choose an image file", "alert-circle");
      return;
    }
    const maxSize =
      (window.VexecConfig && window.VexecConfig.limits && window.VexecConfig.limits.profile) ||
      5 * 1024 * 1024;
    if (file.size > maxSize) {
      showToast("Image is larger than " + formatBytes(maxSize), "alert-circle");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const img = new Image();
      img.onload = () => {
        const MAX = 400;
        let w = img.width;
        let h = img.height;
        if (w > h && w > MAX) { h = Math.round((h * MAX) / w); w = MAX; }
        else if (h > MAX) { w = Math.round((w * MAX) / h); h = MAX; }

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);

        profile.avatar = canvas.toDataURL("image/jpeg", 0.9);
        saveProfile();
        renderAvatar();
        showToast("Profile photo updated");
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  /* ============================================================
     EDITABLE FIELDS
     ============================================================ */
  function setupEditableFields() {
    document.querySelectorAll("[data-field]").forEach((el) => {
      if (el.dataset.profileBound === "1") return;
      el.dataset.profileBound = "1";

      const field = el.dataset.field;
      if (el.dataset.initialized !== "1") {
        el.textContent = profile[field] || "";
        el.dataset.initialized = "1";
      }

      if (field !== "bio") {
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter") { e.preventDefault(); el.blur(); }
        });
      }

      el.addEventListener("blur", () => {
        let v = el.textContent.trim();
        if (field === "username") {
          const cleaned = v.replace(/[^a-zA-Z0-9_]/g, "");
          if (cleaned !== v) el.textContent = cleaned;
          v = cleaned;
        }
        profile[field] = v;
        saveProfile();
        syncFieldBindings();
      });

      el.addEventListener("paste", (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData("text/plain");
        document.execCommand("insertText", false, text);
      });

      el.addEventListener("input", () => {
        if (field !== "bio" && el.textContent.includes("\n")) {
          el.textContent = el.textContent.replace(/\n/g, "");
        }
      });
    });
  }

  function syncFieldBindings() {
    document.querySelectorAll("[data-bind]").forEach((el) => {
      const key = el.dataset.bind;
      if (key === "username") el.textContent = "@" + (profile.username || "");
      else el.textContent = profile[key] || "";
    });
  }

  /* ============================================================
     SEGMENTED CONTROL
     ============================================================ */
  function setupSegmentedControl() {
    document.querySelectorAll("[data-setting='theme']").forEach((seg) => {
      if (seg.dataset.profileBound === "1") return;
      seg.dataset.profileBound = "1";

      const buttons = seg.querySelectorAll("button");
      const thumb = seg.querySelector(".settings-segmented-thumb");
      if (!thumb) return;

      const setActive = (value, animate) => {
        const idx = Array.from(buttons).findIndex((b) => b.dataset.value === value);
        if (idx < 0) return;
        buttons.forEach((b, i) => b.classList.toggle("active", i === idx));
        if (!animate) thumb.style.transition = "none";
        thumb.style.transform = "translateX(" + idx * 100 + "%)";
        if (!animate) requestAnimationFrame(() => (thumb.style.transition = ""));
      };

      setActive(settings.theme, false);

      buttons.forEach((btn) => {
        btn.addEventListener("click", () => {
          const value = btn.dataset.value;
          settings.theme = value;
          setActive(value, true);
          applyTheme(value);
          const label = value === "auto" ? "System" : value.charAt(0).toUpperCase() + value.slice(1);
          showToast("Theme: " + label, "palette");
        });
      });
    });
  }

  /* ============================================================
     FONT CARDS
     ============================================================ */
  function setupFontCards() {
    document.querySelectorAll("[data-setting='fontFamily']").forEach((group) => {
      if (group.dataset.profileBound === "1") return;
      group.dataset.profileBound = "1";

      const cards = group.querySelectorAll(".settings-font-card");
      const setActive = (value) => {
        cards.forEach((c) => c.classList.toggle("active", c.dataset.value === value));
      };
      setActive(settings.fontFamily);

      cards.forEach((card) => {
        card.addEventListener("click", () => {
          const value = card.dataset.value;
          settings.fontFamily = value;
          setActive(value);
          applyFontFamily(value);
          showToast("Font: " + value, "type");
        });
      });
    });
  }

  /* ============================================================
     SLIDER
     ============================================================ */
  function setupSlider() {
    document.querySelectorAll("[data-setting='fontSize']").forEach((group) => {
      if (group.dataset.profileBound === "1") return;
      group.dataset.profileBound = "1";

      const input = group.querySelector("input[type='range']");
      if (!input) return;
      const label = document.querySelector("[data-font-size-label]");

      const updateProgress = (value) => {
        const pct = ((value - 85) / (120 - 85)) * 100;
        input.style.setProperty("--range-progress", pct + "%");
      };

      const labelFor = (v) => {
        if (v <= 90) return "Small";
        if (v <= 105) return "Medium";
        if (v <= 115) return "Large";
        return "Extra large";
      };

      input.value = settings.fontSize;
      updateProgress(settings.fontSize);
      if (label) label.textContent = labelFor(settings.fontSize);

      let rafId = null;
      input.addEventListener("input", () => {
        const v = parseInt(input.value, 10);
        settings.fontSize = v;
        updateProgress(v);
        if (label) label.textContent = labelFor(v);
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => applyFontSize(v));
      });

      input.addEventListener("change", () => {
        showToast("Text size: " + labelFor(settings.fontSize), "text-cursor-input");
      });
    });
  }

  /* ============================================================
     COLOR CHIPS
     ============================================================ */
  function setupColors() {
    document.querySelectorAll("[data-setting='accentColor']").forEach((group) => {
      if (group.dataset.profileBound === "1") return;
      group.dataset.profileBound = "1";

      const chips = group.querySelectorAll(".settings-color");
      const setActive = (value) => {
        chips.forEach((c) => c.classList.toggle("active", c.dataset.value === value));
      };
      setActive(settings.accentColor);

      chips.forEach((chip) => {
        chip.addEventListener("click", () => {
          const value = chip.dataset.value;
          settings.accentColor = value;
          setActive(value);
          applyAccentColor(value);
          showToast("Accent color updated", "droplet");
        });
      });
    });
  }

  /* ============================================================
     TOGGLES
     ============================================================ */
  function setupToggles() {
    document.querySelectorAll("[data-toggle]").forEach((btn) => {
      if (btn.dataset.profileBound === "1") return;
      btn.dataset.profileBound = "1";

      const key = btn.dataset.toggle;
      btn.setAttribute("aria-checked", String(!!settings[key]));

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const next = btn.getAttribute("aria-checked") !== "true";
        btn.setAttribute("aria-checked", String(next));
        settings[key] = next;
        saveSettings();
      });
    });
  }

  /* ============================================================
     ROW ACTIONS
     ============================================================ */
  function setupRowActions() {
    if (document.body.dataset.profileRowActions === "1") return;
    document.body.dataset.profileRowActions = "1";

    document.addEventListener("click", (e) => {
      const row = e.target.closest(".settings-row[data-action]:not([data-route])");
      if (!row) return;
      const action = row.dataset.action;

      if (action === "focus-field") {
        const target = row.dataset.target;
        const el = document.querySelector('[data-field="' + target + '"]');
        if (el) {
          el.focus();
          const range = document.createRange();
          range.selectNodeContents(el);
          range.collapse(false);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }

      if (action === "show-info") { showToast(row.dataset.info || "Info", "info"); return; }

      if (action === "export-data") {
        const blob = new Blob(
          [JSON.stringify({ profile, settings, exportedAt: new Date().toISOString() }, null, 2)],
          { type: "application/json" },
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "vexec-profile-" + Date.now() + ".json";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        showToast("Profile exported", "download");
        return;
      }

      if (action === "clear-cache") { clearCache(); return; }

      if (action === "clear-local") {
        confirmAction("Clear all local data?", () => {
          localStorage.removeItem(PROFILE_KEY);
          localStorage.removeItem(SETTINGS_KEY);
          localStorage.removeItem("vexec:saved:local:v1");
          if ("caches" in window) {
            caches.keys().then((n) => n.forEach((x) => caches.delete(x)));
          }
          showToast("Local data cleared", "trash-2");
          setTimeout(() => window.location.reload(), 900);
        });
        return;
      }

      if (action === "delete-account") {
        confirmAction("Permanently delete your anonymous identity?", () => {
          localStorage.removeItem(PROFILE_KEY);
          showToast("Account deleted", "user-x");
          setTimeout(() => window.location.reload(), 900);
        }, true);
        return;
      }

      if (action === "select-language") {
        const langs = ["English", "فارسی", "Deutsch", "Français", "Español", "日本語", "中文"];
        const next = langs[(langs.indexOf(settings.language) + 1) % langs.length];
        settings.language = next;
        saveSettings();
        const label = document.querySelector("[data-lang-label]");
        if (label) label.textContent = next;
        showToast("Language: " + next, "languages");
        return;
      }
    });
  }

  /* ============================================================
     CACHE
     ============================================================ */
  async function updateCacheSize() {
    const el = document.querySelector("[data-cache-size]");
    if (!el) return;
    let bytes = 0;
    if ("caches" in window) {
      try {
        const names = await caches.keys();
        for (const name of names) {
          const cache = await caches.open(name);
          const keys = await cache.keys();
          for (const req of keys) {
            const res = await cache.match(req);
            if (res) { const blob = await res.clone().blob(); bytes += blob.size; }
          }
        }
      } catch (_) {}
    }
    el.textContent = formatBytes(bytes);
  }

  async function clearCache() {
    if ("caches" in window) {
      try {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      } catch (_) {}
    }
    const el = document.querySelector("[data-cache-size]");
    if (el) el.textContent = "0 B";
    showToast("Cache cleared", "eraser");
  }

  function formatBytes(b) {
    if (!b) return "0 B";
    if (b < 1024) return b + " B";
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
    if (b < 1024 * 1024 * 1024) return (b / (1024 * 1024)).toFixed(2) + " MB";
    return (b / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  }

  /* ============================================================
     CONFIRM MODAL
     ============================================================ */
  function confirmAction(message, onConfirm, danger) {
    const existing = document.querySelector(".profile-confirm");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.className = "limit-modal open profile-confirm";
    modal.innerHTML =
      '<div class="limit-modal-card">' +
      '<div class="limit-modal-icon"' +
      (danger ? ' style="background: color-mix(in srgb, #f43f5e 15%, transparent); border-color: color-mix(in srgb, #f43f5e 35%, transparent); color: #f43f5e;"' : "") +
      '><i data-lucide="' + (danger ? "triangle-alert" : "help-circle") + '"></i></div>' +
      '<h3 class="limit-modal-title">' + (danger ? "Are you sure?" : "Confirm") + "</h3>" +
      '<p class="limit-modal-message">' + message + "</p>" +
      '<div style="display:flex; gap:8px; width:100%; margin-top:6px;">' +
      '<button class="limit-modal-close" type="button" data-confirm="cancel" style="background: color-mix(in srgb, var(--bg-primary) 70%, transparent); color: var(--text-primary); box-shadow: none; border: 1px solid var(--border);">Cancel</button>' +
      '<button class="limit-modal-close" type="button" data-confirm="ok"' +
      (danger ? ' style="background: linear-gradient(135deg, #f43f5e, #ec4899);"' : "") +
      ">Confirm</button>" +
      "</div></div>";
    document.body.appendChild(modal);
    if (window.lucide) window.lucide.createIcons({ root: modal });

    function close() { modal.classList.remove("open"); setTimeout(() => modal.remove(), 300); }
    modal.addEventListener("click", (e) => {
      if (e.target === modal) return close();
      const btn = e.target.closest("[data-confirm]");
      if (!btn) return;
      if (btn.dataset.confirm === "ok") { close(); onConfirm(); }
      else close();
    });
  }

  /* ============================================================
     SECTION ANIMATION
     ============================================================ */
  function animateSections() {
    document.querySelectorAll("[data-anim]").forEach((sec, i) => {
      setTimeout(() => sec.classList.add("is-visible"), i * 90);
    });
  }

  /* ============================================================
     AVATAR INPUTS
     ============================================================ */
  function bindAvatarInputs() {
    const fileInput = document.getElementById("profile-avatar-file");
    const camInput = document.getElementById("profile-avatar-camera");

    if (fileInput && !fileInput.dataset.bound) {
      fileInput.dataset.bound = "1";
      fileInput.addEventListener("change", () => {
        const f = fileInput.files && fileInput.files[0];
        if (f) handleAvatarFile(f);
        fileInput.value = "";
      });
    }
    if (camInput && !camInput.dataset.bound) {
      camInput.dataset.bound = "1";
      camInput.addEventListener("change", () => {
        const f = camInput.files && camInput.files[0];
        if (f) handleAvatarFile(f);
        camInput.value = "";
      });
    }
  }

  /* ============================================================
     INIT
     ============================================================ */
  async function init() {
    profile = await loadProfile();
    settings = loadSettings();
    applyAllSettings();

    renderAvatar();
    renderVerified();
    setupEditableFields();
    syncFieldBindings();
    setupSegmentedControl();
    setupFontCards();
    setupSlider();
    setupColors();
    setupToggles();
    setupRowActions();

    const isMobile =
      document.body.classList.contains("is-mobile") ||
      /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const cameraItem = document.querySelector(".profile-avatar-menu-camera");
    if (!isMobile && cameraItem) {
      cameraItem.classList.add("is-disabled");
      cameraItem.setAttribute("aria-disabled", "true");
      cameraItem.title = "Camera is only available on mobile";
    }

    if (window.lucide) window.lucide.createIcons();
    requestAnimationFrame(animateSections);
    updateCacheSize();
  }

  /* ============================================================
     GLOBAL CLICK HANDLERS
     ============================================================ */
  if (document.body.dataset.profileClickBound !== "1") {
    document.body.dataset.profileClickBound = "1";

    document.addEventListener("click", (e) => {
      if (e.target.closest("#profile-avatar")) {
        e.stopPropagation();
        const menu = document.getElementById("profile-avatar-menu");
        if (!menu) return;
        if (menu.classList.contains("open")) closeAvatarMenu();
        else openAvatarMenu();
        return;
      }

      const menu = document.getElementById("profile-avatar-menu");
      if (menu && menu.classList.contains("open") && !e.target.closest(".profile-avatar-wrap")) {
        closeAvatarMenu();
      }

      const item = e.target.closest("[data-avatar-action]");
      if (item) {
        const action = item.dataset.avatarAction;
        closeAvatarMenu();
        if (action === "upload") {
          const f = document.getElementById("profile-avatar-file");
          if (f) f.click();
        } else if (action === "camera") {
          const c = document.getElementById("profile-avatar-camera");
          if (c) c.click();
        } else if (action === "remove") {
          profile.avatar = null;
          saveProfile();
          renderAvatar();
          showToast("Profile photo removed", "trash-2");
        }
        return;
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAvatarMenu();
    });
  }

  /* ============================================================
     ROUTING
     ============================================================ */
  document.addEventListener("route:change", (e) => {
    if (e.detail && e.detail.path === "/profile") {
      setTimeout(() => { init(); bindAvatarInputs(); }, 60);
    }
  });

  document.addEventListener("DOMContentLoaded", () => {
    if (window.location.pathname.endsWith("/profile")) {
      setTimeout(() => { init(); bindAvatarInputs(); }, 100);
    }
  });

  /* ============================================================
     EXPOSE
     ============================================================ */
  window.VexecProfile = {
    get profile() { return profile; },
    get settings() { return settings; },
    setVerified(v) {
      profile.verified = !!v;
      saveProfile();
      renderVerified();
    },
    reload: async () => {
      profile = await loadProfile();
      settings = loadSettings();
      renderAvatar();
      renderVerified();
      syncFieldBindings();
    },
  };
})();