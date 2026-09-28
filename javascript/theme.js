/* ============================================================
   Vexec — Global Settings (Cookie-based)
   Handles: theme, accent color, font size, font family
   Applies on every page immediately, before first paint.
   ============================================================ */
(function () {
  'use strict';

  const COOKIE_DAYS = 365;
  const HTML = document.documentElement;

  const DEFAULTS = {
    theme: 'auto',        // 'light' | 'dark' | 'auto'
    accent: '',           // '' → CSS default (blue)
    fontSize: '100',      // percent
    fontFamily: 'Inter',
  };

  const FONT_STACKS = {
    'Inter': "'Inter', system-ui, -apple-system, sans-serif",
    'Space Grotesk': "'Space Grotesk', system-ui, -apple-system, sans-serif",
    'Georgia': "Georgia, 'Times New Roman', serif",
    'ui-monospace': "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  };

  const COOKIES = ['theme', 'accent', 'fontSize', 'fontFamily'];

  /* ---------- cookie utils ---------- */
  function getCookie(name) {
    const m = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return m ? decodeURIComponent(m[2]) : null;
  }

  function setCookie(name, value, days) {
    const exp = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie =
      name + '=' + encodeURIComponent(value) +
      '; expires=' + exp + '; path=/; SameSite=Lax';
  }

  function deleteCookie(name) {
    document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  }

  /* ---------- apply functions ---------- */
  function applyTheme(pref) {
    const p = pref || 'auto';
    const resolved =
      p === 'auto'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : p;

    HTML.setAttribute('data-theme', resolved);
    HTML.setAttribute('data-theme-pref', p);
    HTML.style.colorScheme = resolved;

    window.dispatchEvent(
      new CustomEvent('vexec:theme', {
        detail: { theme: resolved, preference: p },
      })
    );
  }

  function applyAccent(hex) {
    if (hex && /^#[0-9a-f]{6}$/i.test(hex)) {
      HTML.style.setProperty('--accent', hex);
      HTML.setAttribute('data-accent', hex);
    } else {
      HTML.style.removeProperty('--accent');
      HTML.removeAttribute('data-accent');
    }
    // Notify logo.js to swap logo
    window.dispatchEvent(
      new CustomEvent('vexec:accent', { detail: { accent: hex } })
    );
  }

  function applyFontSize(value) {
    const v = parseInt(value, 10);
    const safe = Number.isFinite(v) && v >= 60 && v <= 150 ? v : 100;
    HTML.style.fontSize = safe + '%';
    HTML.setAttribute('data-font-size', String(safe));
  }

  function applyFontFamily(name) {
    if (!name) return;
    const stack = FONT_STACKS[name] || FONT_STACKS['Inter'];
    HTML.style.setProperty('--font-body', stack);
    HTML.setAttribute('data-font-family', name);
  }

  /* ---------- read / write ---------- */
  function read() {
    return {
      theme: getCookie('theme') || DEFAULTS.theme,
      accent: getCookie('accent') || DEFAULTS.accent,
      fontSize: getCookie('fontSize') || DEFAULTS.fontSize,
      fontFamily: getCookie('fontFamily') || DEFAULTS.fontFamily,
    };
  }

  function set(key, value) {
    if (value === null || value === undefined || value === '') {
      deleteCookie(key);
    } else {
      setCookie(key, value, COOKIE_DAYS);
    }
  }

  function setMany(obj) {
    Object.keys(obj).forEach((k) => set(k, obj[k]));
  }

  function applyAll(settings) {
    const s = settings || read();
    applyTheme(s.theme);
    applyAccent(s.accent);
    applyFontSize(s.fontSize);
    applyFontFamily(s.fontFamily);
  }

  function reset() {
    COOKIES.forEach(deleteCookie);
    applyAll(DEFAULTS);
  }

  /* ---------- public API ---------- */
  window.VexecSettings = {
    read: read,
    get: function (key) {
      return key ? read()[key] : read();
    },
    set: set,
    setMany: setMany,
    applyAll: applyAll,
    applyTheme: applyTheme,
    applyAccent: applyAccent,
    applyFontSize: applyFontSize,
    applyFontFamily: applyFontFamily,
    reset: reset,
    DEFAULTS: DEFAULTS,
    FONT_STACKS: FONT_STACKS,
  };

  /* ---------- Apply immediately (before paint) ---------- */
  applyAll();

  /* ---------- React to system theme change when 'auto' ---------- */
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const onSystemChange = function () {
    if ((getCookie('theme') || 'auto') === 'auto') applyTheme('auto');
  };
  if (mql.addEventListener) mql.addEventListener('change', onSystemChange);
  else if (mql.addListener) mql.addListener(onSystemChange);
})();