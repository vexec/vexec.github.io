/* ============================================================
   TOR WARNING — modal after login
   ------------------------------------------------------------
   Shows once per login session, unless user dismisses for the
   day. Never blocks the UI. Never sends anything to the server.
   ============================================================ */

(function () {
  "use strict";

  const HIDE_KEY = "vexec:tor:hid:until"; // timestamp until which to hide
  const SESSION_KEY = "vexec:tor:shown"; // shown in this session?

  /* ============================================================
     Helpers
     ============================================================ */
  function shouldShow() {
    try {
      /* Hidden until specific time? */
      const until = parseInt(localStorage.getItem(HIDE_KEY) || "0", 10);
      if (until > Date.now()) return false;

      /* Already shown in this session? */
      if (sessionStorage.getItem(SESSION_KEY) === "1") return false;

      return true;
    } catch (_) {
      return true;
    }
  }

  function markShown() {
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch (_) {}
  }

  function hideForDay() {
    try {
      /* 24 hours from now */
      const until = Date.now() + 24 * 60 * 60 * 1000;
      localStorage.setItem(HIDE_KEY, String(until));
    } catch (_) {}
  }

  /* ============================================================
     Build modal DOM (once)
     ============================================================ */
  let modal = null;

  function ensureModal() {
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "tor-modal";
    modal.className = "tor-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="tor-modal-backdrop" data-tor-close></div>
      <div class="tor-modal-card" role="dialog" aria-labelledby="tor-modal-title">
        <button class="tor-modal-x" type="button" aria-label="Close" data-tor-close>
          <i data-lucide="x"></i>
        </button>

        <div class="tor-modal-icon">
          <i data-lucide="shield-alert"></i>
        </div>

        <h2 class="tor-modal-title" id="tor-modal-title">
          Your IP is still visible
        </h2>

        <p class="tor-modal-text">
          You're in. Vexec stores nothing about you — no email, no phone,
          no identity. But your <b>internet service provider</b> can still
          see that you visited <b>vexec.github.io</b>. They can't see what you
          read or wrote (everything is encrypted), but they know you were
          here.
        </p>

        <p class="tor-modal-text">
          If that matters to you, there are three ways to disappear
          completely:
        </p>

        <ul class="tor-modal-list">
          <li>
            <span class="tor-modal-bullet">1</span>
            <div>
              <b>Use Tor</b> — hides your IP from everyone, including us.
            </div>
          </li>
          <li>
            <span class="tor-modal-bullet">2</span>
            <div>
              <b>Use a VPN</b> — hides your IP from us, but the VPN knows.
            </div>
          </li>
          <li>
            <span class="tor-modal-bullet">3</span>
            <div>
              <b>Self-host Vexec</b> — full control, no third party at all.
            </div>
          </li>
        </ul>

        <div class="tor-modal-actions">
          <button class="tor-modal-btn tor-modal-btn-primary" type="button" data-route="/tor-support">
            <i data-lucide="book-open"></i>
            <span>Read the full guide</span>
          </button>
          <button class="tor-modal-btn tor-modal-btn-ghost" type="button" data-tor-close>
            <span>Continue anyway</span>
          </button>
        </div>

        <label class="tor-modal-hide">
          <input type="checkbox" id="tor-modal-hide-check" />
          <span class="tor-modal-check"></span>
          <span class="tor-modal-hide-text">
            Don't show this again today
          </span>
        </label>
      </div>
    `;

    document.body.appendChild(modal);
    if (window.lucide) window.lucide.createIcons({ root: modal });

    /* Wire close buttons */
    modal.querySelectorAll("[data-tor-close]").forEach((el) => {
      el.addEventListener("click", () => {
        const check = modal.querySelector("#tor-modal-hide-check");
        if (check && check.checked) hideForDay();
        close();
      });
    });

    /* Route to tor-support */
    const learnBtn = modal.querySelector('[data-route="/tor-support"]');
    if (learnBtn) {
      learnBtn.addEventListener("click", () => {
        const check = modal.querySelector("#tor-modal-hide-check");
        if (check && check.checked) hideForDay();
        close();
        if (window.router) window.router.navigate("/tor-support");
      });
    }

    /* Escape key */
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("open")) {
        const check = modal.querySelector("#tor-modal-hide-check");
        if (check && check.checked) hideForDay();
        close();
      }
    });

    return modal;
  }

  /* ============================================================
     Open / Close
     ============================================================ */
  function open() {
    const el = ensureModal();
    if (!el) return;

    /* Small delay so it feels natural after login */
    setTimeout(() => {
      el.classList.add("open");
      el.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      if (window.lucide) window.lucide.createIcons({ root: el });
    }, 600);

    markShown();
  }

  function close() {
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";

    /* Reset checkbox */
    const check = modal.querySelector("#tor-modal-hide-check");
    if (check) check.checked = false;
  }

  /* ============================================================
     Trigger: listen for login success
     ------------------------------------------------------------
     auth.js dispatches "vexec:login-success" after a successful
     login. We wait for that, then show the modal (if allowed).
     ============================================================ */
  document.addEventListener("vexec:login-success", () => {
    if (shouldShow()) open();
  });

  /* Manual open (for /tor-support "show again" button, debug, etc.) */
  window.VexecTorWarning = {
    open,
    close,
    reset() {
      try {
        localStorage.removeItem(HIDE_KEY);
        sessionStorage.removeItem(SESSION_KEY);
      } catch (_) {}
    },
  };

  console.info("[tor] warning ready");
})();