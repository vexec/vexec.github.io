/* ============================================================
   GLOBAL IMAGE LOADER
   Automatically attaches spinner + error fallback to every <img>.
   Works with dynamically added images via MutationObserver.
   ============================================================ */
(function () {
  "use strict";

  const ERROR_TEXT = "Failed to load";

  /* ---- Icon chooser based on context ---- */
  function pickIcon(img) {
    // Audio covers → music note
    if (
      img.closest(
        ".comment-audio-cover, .saved-post-audio-cover, .full-player-cover, .mini-cover",
      )
    )
      return "music";

    // Saved audio items
    if (img.closest(".saved-item-cover")) return "music";

    // Avatars
    if (
      img.closest(
        ".tweet-avatar, .comment-avatar, .saved-post-avatar, .profile-avatar",
      )
    )
      return "user-round";

    // Default: broken image icon
    return "image-off";
  }

  /* ---- Apply loader to a single <img> ---- */
  function applyLoader(img) {
    if (!img || img.dataset.imgLoader === "1") return;
    if (img.closest(".img-loader")) return; // skip our own icons

    img.dataset.imgLoader = "1";

    const parent = img.parentElement;
    if (!parent) return;

    // ensure relative positioning for overlay
    if (getComputedStyle(parent).position === "static") {
      parent.style.position = "relative";
    }

    const loader = document.createElement("div");
    loader.className = "img-loader";
    loader.setAttribute("aria-hidden", "true");
    loader.innerHTML =
      '<div class="img-loader-spinner"></div>' +
      '<div class="img-loader-error">' +
      `<i data-lucide="${pickIcon(img)}"></i>` +
      `<span>${ERROR_TEXT}</span>` +
      "</div>";

    parent.appendChild(loader);

    if (window.lucide) {
      window.lucide.createIcons({ root: loader });
    }

    const finish = (isError) => {
      if (isError) {
        img.classList.add("img-error");
        loader.classList.add("is-error");
        img.style.visibility = "hidden";
        img.style.opacity = "0";
      } else {
        loader.classList.add("is-done");
        setTimeout(() => {
          if (loader.parentNode) loader.remove();
        }, 350);
      }
    };

    /* ---- Already-resolved states ---- */
    if (img.complete) {
      if (img.naturalWidth > 0) {
        finish(false);
        return;
      } else {
        // already errored before we could attach
        if (img.src || img.currentSrc) {
          finish(true);
          return;
        }
      }
    }

    img.addEventListener(
      "load",
      () => {
        if (img.naturalWidth === 0) {
          finish(true);
          return;
        }
        finish(false);
      },
      { once: true },
    );

    img.addEventListener(
      "error",
      () => {
        finish(true);
      },
      { once: true },
    );
  }

  /* ---- Scan whole tree ---- */
  function scan(root) {
    const scope = root || document;
    scope.querySelectorAll("img:not([data-img-loader])").forEach((img) => {
      // Skip if no src at all
      if (!img.getAttribute("src") && !img.getAttribute("srcset")) {
        // If parent has empty-state fallback, skip
        return;
      }
      applyLoader(img);
    });
  }

  /* ---- MutationObserver: catch dynamically added images ---- */
  const observer = new MutationObserver((mutations) => {
    let shouldScan = false;
    for (const m of mutations) {
      if (m.addedNodes.length === 0) continue;
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.tagName === "IMG") {
          shouldScan = true;
          break;
        }
        if (node.querySelectorAll && node.querySelector("img")) {
          shouldScan = true;
          break;
        }
      }
      if (shouldScan) break;
    }
    if (shouldScan) {
      // debounce
      clearTimeout(observer._t);
      observer._t = setTimeout(() => scan(), 40);
    }
  });

  /* ---- Init ---- */
  function init() {
    scan();
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  window.VexecImageLoader = { scan, apply: applyLoader };

  document.addEventListener("route:change", () => {
    setTimeout(() => scan(), 60);
  });

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(init, 50);
  });

  // Fallback: also run immediately (in case DOMContentLoaded already fired)
  setTimeout(init, 120);
})();