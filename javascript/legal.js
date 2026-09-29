/* ============================================================
   LEGAL PAGES — hide nav bar, back-to-top button
   ============================================================ */
(function () {
  "use strict";

  const LEGAL_PATHS = ["/terms", "/information", "/info", "/about"];

  function setMode(path) {
    const isLegal = LEGAL_PATHS.includes(path);
    document.body.classList.toggle("legal-mode", isLegal);
  }

  document.addEventListener("route:change", (e) => {
    setMode((e.detail && e.detail.path) || "");
    if (LEGAL_PATHS.includes((e.detail && e.detail.path) || "")) {
      setTimeout(initBackToTop, 60);
    }
  });

  document.addEventListener("DOMContentLoaded", () => {
    setMode(window.location.pathname);
    setTimeout(initBackToTop, 100);
  });

  function initBackToTop() {
    const btn = document.querySelector(".legal-top");
    if (!btn || btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    window.addEventListener(
      "scroll",
      () => {
        btn.classList.toggle("is-visible", window.scrollY > 400);
      },
      { passive: true },
    );
  }

  /* Smooth-scroll on TOC links */
  document.addEventListener("click", (e) => {
    const link = e.target.closest("[data-toc]");
    if (!link) return;
    e.preventDefault();
    const id = link.getAttribute("href");
    const target = document.querySelector(id);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", id);
    }
  });
})();