/* ============================================================
   AUTH GUARD — controls visibility of the app shell
   ------------------------------------------------------------
   Today: reads localStorage (set by /register + /login).
   Tomorrow: swap `isLoggedIn()` with a real API check.
   ============================================================ */

(function () {
  "use strict";

  /* Public (unauthenticated) routes — navbar hidden here too */
  const PUBLIC_PATHS = [
    "/",
    "/login",
    "/register",
    "/terms",
    "/information",
    "/info",
    "/about",
  ];

  /* ============================================================
     isLoggedIn() — the ONLY thing you'll change later
     ============================================================ */
  function isLoggedIn() {
    try {
      /* Local check (works with current setup) */
      const code = localStorage.getItem("vexec:auth:code:v1");
      const user = localStorage.getItem("vexec:auth:user:v1");
      return !!(code && user);

      /* ---------- LATER: real backend check ----------
      const res = await fetch("/api/me", { credentials: "include" });
      return res.ok;
      ----------------------------------------------- */
    } catch (_) {
      return false;
    }
  }

  /* ============================================================
     Apply state to <body>
     ============================================================ */
  function applyAuthState() {
    const logged = isLoggedIn();
    document.body.classList.toggle("is-authed", logged);
    document.body.classList.toggle("is-guest", !logged);

    /* If guest and current path is private → redirect to /login */
    if (!logged) {
      const path = normalize(window.location.pathname);
      const isPublic = PUBLIC_PATHS.some(
        (p) => path === p || path.startsWith(p + "/"),
      );
      const isUserProfile = path.startsWith("/u/");

      if (!isPublic && !isUserProfile) {
        /* Optional auto-redirect. Comment out if you want silent hiding. */
        // if (window.router) window.router.navigate("/login");
      }
    }
  }

  function normalize(p) {
    p = (p || "/").replace(/\/+$/, "");
    return p || "/";
  }

  /* ============================================================
     Route changes → re-apply (so nav shows/hides dynamically)
     ============================================================ */
  document.addEventListener("route:change", applyAuthState);
  document.addEventListener("DOMContentLoaded", applyAuthState);

  /* Re-check when auth changes in another tab */
  window.addEventListener("storage", (e) => {
    if (e.key && e.key.startsWith("vexec:auth:")) applyAuthState();
  });

  /* Expose for auth.js to call after login/register/logout */
  window.VexecAuthGuard = {
    refresh: applyAuthState,
    isLoggedIn,
  };
})();