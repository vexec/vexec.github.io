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
<<<<<<< HEAD
=======
<<<<<<< HEAD
>>>>>>> 8eb15df9b261f9e522d88239c23f1213550675a3
    /* ---------- Audio covers → music note ---------- */
    if (
      img.closest(
        ".comment-audio-cover, " +
        ".saved-post-audio-cover, " +
        ".saved-item-cover, " +
        ".full-player-cover, " +
        ".mini-cover, " +
        ".pv-audio-cover, " +
        ".vex-audio-cover, " +
        ".write-attach-preview, " +
        ".ps-chip-preview, " +
        ".attach-chip-preview"
      )
    ) {
      return "music";
    }

    /* ---------- Avatars ---------- */
    if (
      img.closest(
        ".tweet-avatar, " +
        ".comment-avatar, " +
        ".saved-post-avatar, " +
        ".profile-avatar, " +
        ".pv-avatar, " +
        ".user-modal-avatar, " +
        ".ps-result-avatar, " +
        ".ps-recipient-avatar, " +
        ".pv-avatar-wrap"
      )
    ) {
      return "user-round";
    }

    /* ---------- Default: broken image ---------- */
<<<<<<< HEAD
=======
=======
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
>>>>>>> fe5a5742073570dc4d4a912f3c8c1dc5ed31f50b
>>>>>>> 8eb15df9b261f9e522d88239c23f1213550675a3
    return "image-off";
  }

  /* ---- Apply loader to a single <img> ---- */
  function applyLoader(img) {
    if (!img || img.dataset.imgLoader === "1") return;
<<<<<<< HEAD
    if (img.closest(".img-loader")) return;
=======
<<<<<<< HEAD
    if (img.closest(".img-loader")) return;
=======
    if (img.closest(".img-loader")) return; // skip our own icons
>>>>>>> fe5a5742073570dc4d4a912f3c8c1dc5ed31f50b
>>>>>>> 8eb15df9b261f9e522d88239c23f1213550675a3

    img.dataset.imgLoader = "1";

    const parent = img.parentElement;
    if (!parent) return;

<<<<<<< HEAD
    /* ensure relative positioning for overlay */
=======
<<<<<<< HEAD
    /* ensure relative positioning for overlay */
=======
    // ensure relative positioning for overlay
>>>>>>> fe5a5742073570dc4d4a912f3c8c1dc5ed31f50b
>>>>>>> 8eb15df9b261f9e522d88239c23f1213550675a3
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

<<<<<<< HEAD
    /* Already-resolved states */
=======
<<<<<<< HEAD
    /* Already-resolved states */
=======
    /* ---- Already-resolved states ---- */
>>>>>>> fe5a5742073570dc4d4a912f3c8c1dc5ed31f50b
>>>>>>> 8eb15df9b261f9e522d88239c23f1213550675a3
    if (img.complete) {
      if (img.naturalWidth > 0) {
        finish(false);
        return;
<<<<<<< HEAD
      } else if (img.src || img.currentSrc) {
        finish(true);
        return;
=======
<<<<<<< HEAD
      } else if (img.src || img.currentSrc) {
        finish(true);
        return;
=======
      } else {
        // already errored before we could attach
        if (img.src || img.currentSrc) {
          finish(true);
          return;
        }
>>>>>>> fe5a5742073570dc4d4a912f3c8c1dc5ed31f50b
>>>>>>> 8eb15df9b261f9e522d88239c23f1213550675a3
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
<<<<<<< HEAD
      { once: true }
=======
<<<<<<< HEAD
      { once: true }
=======
      { once: true },
>>>>>>> fe5a5742073570dc4d4a912f3c8c1dc5ed31f50b
>>>>>>> 8eb15df9b261f9e522d88239c23f1213550675a3
    );

    img.addEventListener(
      "error",
      () => {
        finish(true);
      },
<<<<<<< HEAD
      { once: true }
=======
<<<<<<< HEAD
      { once: true }
=======
      { once: true },
>>>>>>> fe5a5742073570dc4d4a912f3c8c1dc5ed31f50b
>>>>>>> 8eb15df9b261f9e522d88239c23f1213550675a3
    );
  }

  /* ---- Scan whole tree ---- */
  function scan(root) {
    const scope = root || document;
    scope.querySelectorAll("img:not([data-img-loader])").forEach((img) => {
<<<<<<< HEAD
      if (!img.getAttribute("src") && !img.getAttribute("srcset")) return;
=======
<<<<<<< HEAD
      if (!img.getAttribute("src") && !img.getAttribute("srcset")) return;
=======
      // Skip if no src at all
      if (!img.getAttribute("src") && !img.getAttribute("srcset")) {
        // If parent has empty-state fallback, skip
        return;
      }
>>>>>>> fe5a5742073570dc4d4a912f3c8c1dc5ed31f50b
>>>>>>> 8eb15df9b261f9e522d88239c23f1213550675a3
      applyLoader(img);
    });
  }

<<<<<<< HEAD
  /* ---- MutationObserver ---- */
=======
<<<<<<< HEAD
  /* ---- MutationObserver ---- */
=======
  /* ---- MutationObserver: catch dynamically added images ---- */
>>>>>>> fe5a5742073570dc4d4a912f3c8c1dc5ed31f50b
>>>>>>> 8eb15df9b261f9e522d88239c23f1213550675a3
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
<<<<<<< HEAD
=======
<<<<<<< HEAD
=======
      // debounce
>>>>>>> fe5a5742073570dc4d4a912f3c8c1dc5ed31f50b
>>>>>>> 8eb15df9b261f9e522d88239c23f1213550675a3
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

<<<<<<< HEAD
=======
<<<<<<< HEAD
=======
  // Fallback: also run immediately (in case DOMContentLoaded already fired)
>>>>>>> fe5a5742073570dc4d4a912f3c8c1dc5ed31f50b
>>>>>>> 8eb15df9b261f9e522d88239c23f1213550675a3
  setTimeout(init, 120);
})();