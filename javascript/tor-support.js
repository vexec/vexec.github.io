/* ============================================================
   TOR SUPPORT PAGE — small interactions
   ============================================================ */
(function () {
  "use strict";

  /* Copy-to-clipboard for onion address + code blocks */
  document.addEventListener("click", (e) => {
    const copyBtn = e.target.closest("[data-copy]");
    if (!copyBtn) return;

    e.stopPropagation();
    const text = copyBtn.dataset.copy || "";
    if (!text) return;

    const done = () => {
      copyBtn.classList.add("is-copied");
      const original = copyBtn.querySelector("span");
      const prevText = original ? original.textContent : null;
      if (original) original.textContent = "Copied";

      setTimeout(() => {
        copyBtn.classList.remove("is-copied");
        if (original && prevText) original.textContent = prevText;
      }, 1400);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(done)
        .catch(() => {
          fallbackCopy(text);
          done();
        });
    } else {
      fallbackCopy(text);
      done();
    }
  });

  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "absolute";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch (_) {}
    document.body.removeChild(ta);
  }

  /* Re-init lucide icons on route entry */
  document.addEventListener("route:change", (e) => {
    if (e.detail && e.detail.path === "/tor-support") {
      setTimeout(() => {
        if (window.lucide) window.lucide.createIcons();
      }, 60);
    }
  });
})();