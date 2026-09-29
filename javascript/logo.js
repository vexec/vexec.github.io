/* ============================================================
   Vexec — Dynamic Logo (per accent)
   Reads logos map from config.json + cache, applies to
   .brand-logo and .loader-logo based on current accent.
   ============================================================ */
(function () {
  "use strict";

  const CACHE_KEY = "vexec:logos:v1";
  const DEFAULT_LOGO = "./assets/pictures/vexec.png";
  const DEFAULT_ACCENT = "#3b82f6";

  let logos = null;

  function getCookie(name) {
    const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
    return m ? decodeURIComponent(m[2]) : null;
  }

  function readCached() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return null;
  }

  function writeCache(map) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(map));
    } catch (_) {}
  }

  function resolveLogo(accent) {
    if (!logos) return DEFAULT_LOGO;
    return logos[accent] || logos["default"] || DEFAULT_LOGO;
  }

  function apply() {
    const accent = getCookie("accent") || DEFAULT_ACCENT;
    const src = resolveLogo(accent);

    // 1) لوگوی داخل صفحه (brand bar + loader)
    document
      .querySelectorAll(
        "#vexec-loader-logo, #vexec-brand-logo, .brand-logo, .loader-logo",
      )
      .forEach((img) => {
        if (img.getAttribute("src") !== src) {
          img.src = src;
        }
      });

    // 2) Favicon + Apple touch icon + Shortcut + Mask icon
    document.querySelectorAll("link[data-vexec-icon]").forEach((link) => {
      if (link.getAttribute("href") !== src) {
        link.setAttribute("href", src);
      }
    });

    // 3) رنگ mask-icon رو با accent هماهنگ کن
    document.querySelectorAll('link[rel="mask-icon"]').forEach((link) => {
      link.setAttribute("color", accent);
    });

    // 4) theme-color meta
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute("content", accent);
  }

  async function loadConfig() {
    const cached = readCached();
    if (cached) {
      logos = cached;
      apply();
    }

    try {
      const res = await fetch("./config.json", { cache: "no-cache" });
      if (res.ok) {
        const data = await res.json();
        if (data.logos && typeof data.logos === "object") {
          logos = data.logos;
          writeCache(logos);
          apply();
        }
      }
    } catch (err) {
      console.info("[logo] using cache/default");
    }
  }

  window.VexecLogos = {
    apply,
    get current() {
      return resolveLogo(getCookie("accent") || DEFAULT_ACCENT);
    },
  };

  loadConfig();

  // Accent change → swap logo (theme.js dispatches this event)
  window.addEventListener("vexec:accent", apply);

  // Route change → re-apply (safe-guard)
  document.addEventListener("route:change", () => setTimeout(apply, 0));
})();