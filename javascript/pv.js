/* ============================================================
   PV — Direct Messages (coming soon)
   Minimal: just re-render lucide icons on route entry.
   ============================================================ */
(function () {
  "use strict";

  function setupPv() {
    if (!document.querySelector(".pv")) return;
    if (window.lucide) window.lucide.createIcons();
  }

  document.addEventListener("route:change", (e) => {
    if (e.detail && e.detail.path === "/pv") {
      setTimeout(setupPv, 60);
    }
  });

  document.addEventListener("DOMContentLoaded", () => {
    if (window.location.pathname.endsWith("/pv")) {
      setTimeout(setupPv, 100);
    }
  });
})();