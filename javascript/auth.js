/* ============================================================
   AUTH — Register & Login
   Slider CAPTCHA + behavioral anti-bot + hardened storage.
   ------------------------------------------------------------
   SECURITY NOTES:
   - Frontend-only auth is a UX gate, not real security.
   - Real security MUST come from the backend (HttpOnly cookies,
     server-side sessions, HTTPS, CSP headers).
   - This file hardens what it can: encrypted-at-rest codes,
     constant-time comparison, session fingerprinting, and
     multi-layer rate limiting.
   ============================================================ */

(function () {
  "use strict";

  /* ============================================================
     SECRETS — closure-scoped
     ============================================================ */
  const _S = (function () {
    const a = new Uint8Array(24);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return Array.from(a).map((b) => b.toString(36)).join("");
  })();

  function _H(...args) {
    const s = args.join("|") + "|" + _S;
    let h1 = 5381;
    let h2 = 52711;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 = ((h1 * 33) ^ c) >>> 0;
      h2 = ((h2 * 31) + c) >>> 0;
    }
    return h1.toString(36) + h2.toString(36);
  }

  /* Constant-time string comparison — prevents timing side-channels */
  function safeEqual(a, b) {
    if (typeof a !== "string" || typeof b !== "string") return false;
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
  }

  /* ============================================================
     SESSION FINGERPRINT
     Session-scoped. If it changes mid-session, we treat the
     session as compromised and purge sensitive data.
     ============================================================ */
  const FP_KEY = "vexec:sess:fp";
  function getFingerprint() {
    try {
      let fp = sessionStorage.getItem(FP_KEY);
      if (fp) return fp;
      const buf = new Uint8Array(16);
      (window.crypto || window.msCrypto).getRandomValues(buf);
      fp = Array.from(buf).map((b) => b.toString(36)).join("");
      sessionStorage.setItem(FP_KEY, fp);
      return fp;
    } catch (_) {
      return "no-session";
    }
  }

  /* ============================================================
     HARDENED STORAGE — encode with fingerprint-derived key
     Not cryptography, but prevents casual reading of the code
     from DevTools or shared screenshots.
     ============================================================ */
  const USER_KEY = "vexec:auth:user:v1";
  const CODE_KEY = "vexec:auth:code:v1";
  const CODE_META_KEY = "vexec:auth:code:meta:v1";
  const LOCK_KEY = "vexec:auth:lock:v1";
  const LOCK_COOKIE = "vexec_lock";

  const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
  const DISPLAYNAME_MAX = 30;
  const DISPLAYNAME_DISALLOWED = /[<>&"'`]/g;

  const CODE_ALPHABET =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const CODE_LENGTH = 20;
  const CODE_SEP = " – "; /* en-dash */

  /* Lightweight reversible encoding with session fingerprint.
     NOT encryption — obfuscation only. Real protection = backend. */
  function encodeBlob(plain) {
    const key = _H(getFingerprint(), _S);
    let out = "";
    for (let i = 0; i < plain.length; i++) {
      const k = key.charCodeAt(i % key.length);
      out += String.fromCharCode(plain.charCodeAt(i) ^ (k & 0x7f));
    }
    return btoa(unescape(encodeURIComponent(out)));
  }

  function decodeBlob(encoded) {
    try {
      const bin = decodeURIComponent(escape(atob(encoded)));
      const key = _H(getFingerprint(), _S);
      let out = "";
      for (let i = 0; i < bin.length; i++) {
        const k = key.charCodeAt(i % key.length);
        out += String.fromCharCode(bin.charCodeAt(i) ^ (k & 0x7f));
      }
      return out;
    } catch (_) {
      return null;
    }
  }

  /* ============================================================
     STORAGE API
     ============================================================ */
  function saveUser(u) {
    try { localStorage.setItem(USER_KEY, JSON.stringify(u)); } catch (_) {}
  }
  function loadUser() {
    try {
      const r = localStorage.getItem(USER_KEY);
      return r ? JSON.parse(r) : null;
    } catch (_) { return null; }
  }

  function saveCode(code) {
    try {
      localStorage.setItem(CODE_KEY, encodeBlob(code));
      localStorage.setItem(
        CODE_META_KEY,
        JSON.stringify({ fp: getFingerprint(), ts: Date.now() }),
      );
    } catch (_) {}
  }

  function loadCode() {
    try {
      const metaRaw = localStorage.getItem(CODE_META_KEY);
      if (!metaRaw) return null;
      const meta = JSON.parse(metaRaw);

      /* If session fingerprint changed, treat as suspicious */
      if (meta && meta.fp && meta.fp !== getFingerprint()) {
        console.warn("[auth] session fingerprint mismatch — purging");
        purgeSensitive();
        return null;
      }

      const encoded = localStorage.getItem(CODE_KEY);
      if (!encoded) return null;
      return decodeBlob(encoded);
    } catch (_) {
      return null;
    }
  }

  function purgeSensitive() {
    try {
      localStorage.removeItem(CODE_KEY);
      localStorage.removeItem(CODE_META_KEY);
      localStorage.removeItem(USER_KEY);
    } catch (_) {}
  }

  function generateCode() {
    const a = new Uint8Array(CODE_LENGTH);
    (window.crypto || window.msCrypto).getRandomValues(a);
    let s = "";
    for (let i = 0; i < CODE_LENGTH; i++) {
      s += CODE_ALPHABET[a[i] % CODE_ALPHABET.length];
    }
    return s;
  }

  /* ============================================================
     COOLDOWN — localStorage + Cookie (dual-persistent)
     ============================================================ */
  const LOCK_AFTER_ATTEMPTS = 4;
  const LOCK_DURATION_MS = 5 * 60 * 1000;

  function readCookie(name) {
    const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
    return m ? decodeURIComponent(m[2]) : null;
  }

  function writeLockData(data) {
    try { localStorage.setItem(LOCK_KEY, JSON.stringify(data)); } catch (_) {}
    try {
      if (data.until && data.until > Date.now()) {
        const secs = Math.ceil((data.until - Date.now()) / 1000);
        document.cookie =
          LOCK_COOKIE +
          "=" +
          encodeURIComponent(JSON.stringify(data)) +
          "; max-age=" + secs + "; path=/; SameSite=Strict";
      } else {
        document.cookie =
          LOCK_COOKIE + "=; max-age=0; path=/; SameSite=Strict";
      }
    } catch (_) {}
  }

  function readLockData() {
    let a = null, b = null;
    try {
      const raw = localStorage.getItem(LOCK_KEY);
      if (raw) a = JSON.parse(raw);
    } catch (_) {}
    try {
      const raw = readCookie(LOCK_COOKIE);
      if (raw) b = JSON.parse(raw);
    } catch (_) {}

    const la = a || { attempts: 0, until: 0 };
    const lb = b || { attempts: 0, until: 0 };

    return {
      attempts: Math.max(la.attempts || 0, lb.attempts || 0),
      until: Math.max(la.until || 0, lb.until || 0),
    };
  }

  function isLocked() {
    const d = readLockData();
    return d.until > Date.now();
  }

  function recordFailedAttempt() {
    const d = readLockData();
    d.attempts = (d.attempts || 0) + 1;

    /* Progressive lockout: 4 attempts → 5 min, 6 → 30 min, 8 → 2h */
    if (d.attempts >= 8) {
      d.until = Date.now() + 2 * 60 * 60 * 1000;
    } else if (d.attempts >= 6) {
      d.until = Date.now() + 30 * 60 * 1000;
    } else if (d.attempts >= LOCK_AFTER_ATTEMPTS) {
      d.until = Date.now() + LOCK_DURATION_MS;
    }
    writeLockData(d);
    return d;
  }

  function resetAttempts() {
    writeLockData({ attempts: 0, until: 0 });
  }

  function clearExpiredLock() {
    const d = readLockData();
    if (d.until && d.until <= Date.now()) {
      writeLockData({ attempts: 0, until: 0 });
      return true;
    }
    return false;
  }

  /* ============================================================
     LOCK UI
     ============================================================ */
  let lockTimer = null;

  function formatCountdown(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  function showLockUI() {
    const bar = document.getElementById("auth-lock");
    if (!bar) return;

    bar.hidden = false;
    const captcha = document.getElementById("auth-captcha");
    if (captcha) captcha.style.display = "none";

    document
      .querySelectorAll(
        ".auth-input, .auth-code-input, #register-submit, #login-submit, #login-clear",
      )
      .forEach((el) => {
        if (!el.hasAttribute("data-lock-disabled")) {
          el.setAttribute("data-lock-disabled", el.disabled ? "was" : "1");
          el.disabled = true;
        }
      });

    const tick = () => {
      const d = readLockData();
      const remaining = d.until - Date.now();
      const timer = document.getElementById("auth-lock-timer");
      if (remaining <= 0) {
        hideLockUI();
        resetAttempts();
        rebuildActiveCaptcha();
        return;
      }
      if (timer) timer.textContent = formatCountdown(remaining);
    };

    tick();
    if (lockTimer) clearInterval(lockTimer);
    lockTimer = setInterval(tick, 500);

    if (window.lucide) window.lucide.createIcons({ root: bar });
  }

  function hideLockUI() {
    const bar = document.getElementById("auth-lock");
    if (bar) bar.hidden = true;

    const captcha = document.getElementById("auth-captcha");
    if (captcha) captcha.style.display = "";

    document.querySelectorAll("[data-lock-disabled]").forEach((el) => {
      const was = el.getAttribute("data-lock-disabled");
      if (was !== "was") el.disabled = false;
      el.removeAttribute("data-lock-disabled");
    });

    if (lockTimer) { clearInterval(lockTimer); lockTimer = null; }

    if (document.getElementById("register-form")) validateRegisterForm();
    if (document.getElementById("login-code")) updateLoginState();
  }

  /* ============================================================
     ANTI-BOT
     ============================================================ */
  const PAGE_LOAD_TIME = Date.now();
  const MIN_HUMAN_TIME = 2000;

  function honeypotTripped() {
    const hp = document.getElementById("reg-website");
    return hp && hp.value.trim().length > 0;
  }

  /* ============================================================
     SLIDER CAPTCHA
     ============================================================ */
  const LOGICAL_W = 320;
  const LOGICAL_H = 90;
  const PIECE_SIZE = 50;
  const TOLERANCE = 4;

  function drawRoundedRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function createSliderCaptcha(prefix, onStateChange) {
    const REQUIRED_ROUNDS = 2;

    const state = {
      round: 1,
      requiredRounds: REQUIRED_ROUNDS,
      roundAnswers: [],
      answer: -1,
      solved: false,
      verifiedSig: null,
      challengeId: null,
      traj: [],
      dragging: false,
      dragStartX: 0,
      dragStartHandleX: 0,
      handleX: 0,
      maxHandleX: 0,
      pieceX: 0,
      ready: false,
      transitioning: false,
    };

    const root = document.getElementById(prefix + "captcha");
    const canvasWrap = document.getElementById(prefix + "slider-canvas");
    const bgCanvas = document.getElementById(prefix + "slider-bg");
    const pieceCanvas = document.getElementById(prefix + "slider-piece");
    const track = document.getElementById(prefix + "slider-track");
    const fill = document.getElementById(prefix + "slider-fill");
    const handle = document.getElementById(prefix + "slider-handle");
    const msgEl = document.getElementById(prefix + "captcha-msg");
    const refreshBtn = document.getElementById(prefix + "captcha-refresh");
    const sliderEl = document.getElementById(prefix + "slider");
    const roundLabel = document.getElementById(prefix + "captcha-round-label");
    const dotsWrap = document.getElementById(prefix + "captcha-dots");

    if (!root || !bgCanvas || !pieceCanvas || !track) return null;

    function renderDots() {
      if (!dotsWrap) return;
      dotsWrap.innerHTML = "";
      for (let i = 1; i <= state.requiredRounds; i++) {
        const dot = document.createElement("span");
        dot.className = "auth-captcha-dot";
        if (i < state.round) dot.classList.add("is-done");
        else if (i === state.round && !state.solved) dot.classList.add("is-active");
        else if (state.solved) dot.classList.add("is-done");
        dotsWrap.appendChild(dot);
      }
    }

    function updateRoundLabel() {
      if (!roundLabel) return;
      roundLabel.textContent = state.solved
        ? "All rounds passed"
        : "Round " + state.round + " of " + state.requiredRounds;
    }

    function renderBase(ctx) {
      const hue1 = Math.floor(Math.random() * 360);
      const hue2 = (hue1 + 60 + Math.floor(Math.random() * 120)) % 360;
      const g = ctx.createLinearGradient(0, 0, LOGICAL_W, LOGICAL_H);
      g.addColorStop(0, "hsl(" + hue1 + ", 65%, 55%)");
      g.addColorStop(1, "hsl(" + hue2 + ", 70%, 45%)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

      for (let i = 0; i < 12; i++) {
        const kind = Math.random();
        ctx.beginPath();
        if (kind < 0.35) {
          ctx.arc(
            Math.random() * LOGICAL_W,
            Math.random() * LOGICAL_H,
            12 + Math.random() * 45,
            0,
            Math.PI * 2,
          );
        } else if (kind < 0.65) {
          ctx.rect(
            Math.random() * LOGICAL_W,
            Math.random() * LOGICAL_H,
            20 + Math.random() * 70,
            12 + Math.random() * 40,
          );
        } else {
          const x = Math.random() * LOGICAL_W;
          const y = Math.random() * LOGICAL_H;
          const r = 18 + Math.random() * 45;
          ctx.moveTo(x, y);
          for (let j = 0; j < 6; j++) {
            const a = (j / 6) * Math.PI * 2;
            ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
          }
          ctx.closePath();
        }
        ctx.fillStyle =
          "hsla(" +
          Math.floor(Math.random() * 360) +
          ", 75%, " +
          (40 + Math.random() * 40) +
          "%, " +
          (0.35 + Math.random() * 0.4) +
          ")";
        ctx.fill();
      }

      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * LOGICAL_W, Math.random() * LOGICAL_H);
        ctx.lineTo(Math.random() * LOGICAL_W, Math.random() * LOGICAL_H);
        ctx.strokeStyle =
          "hsla(" +
          Math.floor(Math.random() * 360) +
          ", 75%, " +
          (50 + Math.random() * 30) +
          "%, 0.4)";
        ctx.lineWidth = 1 + Math.random() * 2;
        ctx.stroke();
      }

      try {
        const img = ctx.getImageData(0, 0, LOGICAL_W, LOGICAL_H);
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
          const n = (Math.random() - 0.5) * 32;
          d[i] = Math.max(0, Math.min(255, d[i] + n));
          d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
          d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
        }
        ctx.putImageData(img, 0, 0);
      } catch (_) {}
    }

    function drawHole(ctx, answerX) {
      const py = (LOGICAL_H - PIECE_SIZE) / 2;
      ctx.save();
      drawRoundedRectPath(ctx, answerX, py, PIECE_SIZE, PIECE_SIZE, 8);
      ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    function drawPieceFromBase(ctx, base, answerX) {
      const py = (LOGICAL_H - PIECE_SIZE) / 2;
      ctx.save();
      drawRoundedRectPath(ctx, 0, py, PIECE_SIZE, PIECE_SIZE, 8);
      ctx.clip();
      ctx.drawImage(base, -answerX, 0);
      ctx.restore();

      ctx.save();
      drawRoundedRectPath(ctx, 0, py, PIECE_SIZE, PIECE_SIZE, 8);
      ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
      ctx.fill();
      ctx.restore();

      ctx.save();
      drawRoundedRectPath(ctx, 0, py, PIECE_SIZE, PIECE_SIZE, 8);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    function buildRound() {
      state.traj = [];
      state.handleX = 0;
      state.pieceX = 0;
      state.dragging = false;

      const minAnswer = 40;
      const maxAnswer = LOGICAL_W - PIECE_SIZE - 10;
      state.answer =
        minAnswer + Math.floor(Math.random() * (maxAnswer - minAnswer));

      const buf = new Uint8Array(8);
      (window.crypto || window.msCrypto).getRandomValues(buf);
      state.challengeId = Array.from(buf)
        .map((b) => b.toString(36))
        .join("");

      const base = document.createElement("canvas");
      base.width = LOGICAL_W;
      base.height = LOGICAL_H;
      renderBase(base.getContext("2d"));

      const bgCtx = bgCanvas.getContext("2d");
      bgCanvas.width = LOGICAL_W;
      bgCanvas.height = LOGICAL_H;
      bgCtx.drawImage(base, 0, 0);
      drawHole(bgCtx, state.answer);

      const pieceCtx = pieceCanvas.getContext("2d");
      pieceCanvas.width = LOGICAL_W;
      pieceCanvas.height = LOGICAL_H;
      pieceCtx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
      drawPieceFromBase(pieceCtx, base, state.answer);

      pieceCanvas.style.transform = "translateX(0px)";

      root.dataset.state = "idle";
      fill.style.width = "0";
      handle.style.transform = "translateX(0)";
      handle.style.pointerEvents = "";
      track.style.cursor = "";
      if (msgEl) {
        msgEl.dataset.state = "idle";
        msgEl.textContent = "";
      }
      if (sliderEl) sliderEl.classList.remove("is-dragging");

      updateRoundLabel();
      renderDots();

      state.ready = true;
      if (onStateChange) onStateChange(false);
    }

    function buildChallenge() {
      state.solved = false;
      state.verifiedSig = null;
      state.roundAnswers = [];
      state.round = 1;
      state.transitioning = false;
      buildRound();
    }

    function getCX(e) {
      if (e.touches && e.touches[0]) return e.touches[0].clientX;
      if (e.changedTouches && e.changedTouches[0])
        return e.changedTouches[0].clientX;
      return e.clientX;
    }
    function getCY(e) {
      if (e.touches && e.touches[0]) return e.touches[0].clientY;
      if (e.changedTouches && e.changedTouches[0])
        return e.changedTouches[0].clientY;
      return e.clientY;
    }

    function onDragStart(e) {
      if (state.solved || state.dragging || state.transitioning) return;
      if (isLocked()) return;

      state.dragging = true;
      state.dragStartX = getCX(e);
      state.dragStartHandleX = state.handleX;
      state.traj = [{ x: getCX(e), y: getCY(e), t: Date.now() }];

      const trackRect = track.getBoundingClientRect();
      const handleW = handle.offsetWidth;
      state.maxHandleX = Math.max(1, trackRect.width - handleW - 6);

      if (sliderEl) sliderEl.classList.add("is-dragging");
      window.addEventListener("mousemove", onDragMove, { passive: false });
      window.addEventListener("mouseup", onDragEnd);
      window.addEventListener("touchmove", onDragMove, { passive: false });
      window.addEventListener("touchend", onDragEnd);
      window.addEventListener("touchcancel", onDragEnd);
      e.preventDefault();
    }

    function onDragMove(e) {
      if (!state.dragging) return;
      const cx = getCX(e);
      state.traj.push({ x: cx, y: getCY(e), t: Date.now() });

      let newX = state.dragStartHandleX + (cx - state.dragStartX);
      newX = Math.max(0, Math.min(state.maxHandleX, newX));
      state.handleX = newX;

      const handleW = handle.offsetWidth;
      handle.style.transform = "translateX(" + newX + "px)";
      fill.style.width = newX + handleW / 2 + "px";

      const ratio = newX / state.maxHandleX;
      state.pieceX = ratio * (LOGICAL_W - PIECE_SIZE);

      const renderedW = canvasWrap.getBoundingClientRect().width || LOGICAL_W;
      const scale = renderedW / LOGICAL_W;
      pieceCanvas.style.transform =
        "translateX(" + state.pieceX * scale + "px)";

      e.preventDefault();
    }

    function onDragEnd() {
      if (!state.dragging) return;
      state.dragging = false;
      if (sliderEl) sliderEl.classList.remove("is-dragging");

      window.removeEventListener("mousemove", onDragMove);
      window.removeEventListener("mouseup", onDragEnd);
      window.removeEventListener("touchmove", onDragMove);
      window.removeEventListener("touchend", onDragEnd);
      window.removeEventListener("touchcancel", onDragEnd);

      verify();
    }

    function analyzeTrajectory(traj) {
      if (traj.length < 15) return { ok: false, reason: "sparse" };
      const dur = traj[traj.length - 1].t - traj[0].t;
      if (dur < 450) return { ok: false, reason: "too_fast" };
      if (dur > 10000) return { ok: false, reason: "too_slow" };

      const samples = [];
      for (let i = 1; i < traj.length; i++) {
        const dt = traj[i].t - traj[i - 1].t;
        const dx = traj[i].x - traj[i - 1].x;
        const dy = traj[i].y - traj[i - 1].y;
        if (dt <= 0) continue;
        samples.push({ dt: dt, dx: dx, dy: dy, v: Math.abs(dx) / dt });
      }
      if (samples.length < 12) return { ok: false, reason: "sparse" };

      const dts = samples.map((s) => s.dt);
      const avgDt = dts.reduce((a, b) => a + b, 0) / dts.length;
      const varDt =
        dts.reduce((a, b) => a + (b - avgDt) * (b - avgDt), 0) / dts.length;
      if (varDt < 2.5) return { ok: false, reason: "uniform_timing" };

      const vs = samples.map((s) => s.v);
      const avgV = vs.reduce((a, b) => a + b, 0) / vs.length;
      if (avgV < 0.05) return { ok: false, reason: "no_movement" };
      const varV =
        vs.reduce((a, b) => a + (b - avgV) * (b - avgV), 0) / vs.length;
      const cvV = Math.sqrt(varV) / avgV;
      if (cvV < 0.4) return { ok: false, reason: "constant_speed" };

      let maxPause = 0;
      for (let i = 1; i < traj.length; i++) {
        const gap = traj[i].t - traj[i - 1].t;
        if (gap > maxPause) maxPause = gap;
      }
      const firstThird = traj[Math.floor(traj.length / 3)].t - traj[0].t;
      const lastThird =
        traj[traj.length - 1].t - traj[Math.floor((2 * traj.length) / 3)].t;
      if (maxPause > 900 && maxPause > firstThird && maxPause > lastThird) {
        return { ok: false, reason: "mid_pause" };
      }

      let yMin = Infinity;
      let yMax = -Infinity;
      for (let i = 0; i < traj.length; i++) {
        if (traj[i].y < yMin) yMin = traj[i].y;
        if (traj[i].y > yMax) yMax = traj[i].y;
      }
      if (yMax - yMin > 70) return { ok: false, reason: "vertical_drift" };

      let signChanges = 0;
      let prevSign = 0;
      for (let i = 1; i < vs.length; i++) {
        const d = vs[i] - vs[i - 1];
        const sign = d > 0 ? 1 : d < 0 ? -1 : 0;
        if (sign !== 0 && prevSign !== 0 && sign !== prevSign) signChanges++;
        if (sign !== 0) prevSign = sign;
      }
      if (signChanges < 2) return { ok: false, reason: "linear_velocity" };

      const lastV = vs[vs.length - 1];
      const peakV = Math.max.apply(null, vs);
      if (peakV > 0 && lastV / peakV > 0.9) {
        return { ok: false, reason: "no_deceleration" };
      }

      const firstDt = traj[1].t - traj[0].t;
      if (firstDt < 25) return { ok: false, reason: "instant_start" };

      return { ok: true };
    }

    function verify() {
      const trajOk = analyzeTrajectory(state.traj);
      const diff = Math.abs(state.pieceX - state.answer);

      if (!trajOk.ok || diff > TOLERANCE) {
        fail();
        return;
      }

      state.roundAnswers.push({
        answer: state.answer,
        trajLength: state.traj.length,
      });

      root.dataset.state = "ok";
      if (msgEl) {
        msgEl.dataset.state = "ok";
        msgEl.textContent =
          state.round === state.requiredRounds
            ? "Verified"
            : "Round " + state.round + " passed ✓";
      }
      handle.style.pointerEvents = "none";
      track.style.cursor = "default";
      state.transitioning = true;
      renderDots();

      if (state.round < state.requiredRounds) {
        state.round++;
        setTimeout(function () {
          buildRound();
          state.transitioning = false;
        }, 700);
      } else {
        state.solved = true;
        state.transitioning = false;
        state.verifiedSig = buildSignature();
        if (onStateChange) onStateChange(true);
      }
    }

    function buildSignature() {
      const parts = [state.challengeId, state.requiredRounds];
      for (let i = 0; i < state.roundAnswers.length; i++) {
        parts.push(state.roundAnswers[i].answer);
        parts.push(state.roundAnswers[i].trajLength);
      }
      parts.push("ok");
      return _H.apply(null, parts);
    }

    function fail() {
      root.dataset.state = "error";
      if (msgEl) {
        msgEl.dataset.state = "error";
        msgEl.textContent = "Alignment off — try again";
      }
      if (onStateChange) onStateChange(false);

      const d = recordFailedAttempt();
      if (d.until > Date.now()) {
        setTimeout(function () { showLockUI(); }, 500);
        return;
      }

      state.roundAnswers = [];
      setTimeout(buildRound, 750);
    }

    const api = {
      init: function () {
        buildChallenge();

        handle.addEventListener("mousedown", onDragStart);
        handle.addEventListener("touchstart", onDragStart, { passive: false });

        track.addEventListener("mousedown", function (e) {
          if (state.solved || isLocked() || state.transitioning) return;
          const rect = track.getBoundingClientRect();
          const cx = getCX(e);
          const ratio = Math.max(
            0,
            Math.min(1, (cx - rect.left) / rect.width),
          );
          const handleW = handle.offsetWidth;
          state.maxHandleX = Math.max(1, rect.width - handleW - 6);
          state.handleX = ratio * state.maxHandleX;
          state.dragStartX = cx;
          state.dragStartHandleX = state.handleX;
          onDragStart(e);
        });

        if (refreshBtn) {
          refreshBtn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (state.solved || isLocked() || state.transitioning) return;
            state.roundAnswers = [];
            buildRound();
          });
        }

        window.addEventListener("resize", function () {
          if (state.solved) return;
          const renderedW =
            canvasWrap.getBoundingClientRect().width || LOGICAL_W;
          const scale = renderedW / LOGICAL_W;
          pieceCanvas.style.transform =
            "translateX(" + state.pieceX * scale + "px)";
        });
      },
      reset: function () {
        buildChallenge();
      },
      get solved() {
        return state.solved;
      },
      get sig() {
        return state.verifiedSig;
      },
      verifySig: function (sig) {
        if (!sig || !state.challengeId) return false;
        if (state.roundAnswers.length !== state.requiredRounds) return false;
        const expected = buildSignature();
        return safeEqual(sig, expected);
      },
    };

    return api;
  }

  /* ============================================================
     REGISTER
     ============================================================ */
  const regState = {
    username: { value: "", valid: false },
    displayName: { value: "", valid: false },
  };
  let registerCaptcha = null;

  function setFieldStatus(fieldName, state, hintText) {
    const statusEl = document.querySelector(
      '.auth-input-status[data-status="' + fieldName + '"]',
    );
    const hintEl = document.getElementById(
      "reg-" + fieldName.toLowerCase() + "-hint",
    );
    if (statusEl) {
      statusEl.dataset.state = state || "";
      statusEl.innerHTML = "";
      if (state === "ok" || state === "error") {
        const i = document.createElement("i");
        i.setAttribute("data-lucide", state === "ok" ? "check" : "x");
        statusEl.appendChild(i);
      }
      if (window.lucide) window.lucide.createIcons({ root: statusEl });
    }
    if (hintEl && hintText != null) {
      hintEl.dataset.state = state === "error" ? "error" : "";
      hintEl.textContent = hintText;
    }
  }

  function validateUsername(value) {
    const v = value.trim().toLowerCase();
    if (!v)
      return {
        valid: false,
        hint: "3–20 characters · lowercase letters, numbers, underscores",
      };
    if (v.length < 3) return { valid: false, hint: "At least 3 characters" };
    if (v.length > 20) return { valid: false, hint: "At most 20 characters" };
    if (!USERNAME_RE.test(v))
      return { valid: false, hint: "Only a-z, 0-9, and _" };
    return { valid: true, hint: "Looks good" };
  }

  function validateDisplayName(value) {
    const v = value.trim();
    if (!v)
      return {
        valid: false,
        hint: "This is how you'll appear on every whisper",
      };
    if (v.length > DISPLAYNAME_MAX)
      return { valid: false, hint: "At most 30 characters" };
    if (DISPLAYNAME_DISALLOWED.test(v))
      return { valid: false, hint: "Disallowed characters" };
    return { valid: true, hint: "Looks good" };
  }

  function sanitizeDisplayName(v) {
    return String(v || "")
      .replace(DISPLAYNAME_DISALLOWED, "")
      .trim()
      .slice(0, DISPLAYNAME_MAX);
  }

  function validateRegisterForm() {
    const submit = document.getElementById("register-submit");
    if (!submit) return;
    if (isLocked()) {
      submit.disabled = true;
      return;
    }
    const ok =
      regState.username.valid &&
      regState.displayName.valid &&
      registerCaptcha &&
      registerCaptcha.solved;
    submit.disabled = !ok;
  }

  function initRegister() {
    const page = document.querySelector('.auth-page[data-mode="register"]');
    if (!page) return;
    document.body.classList.add("auth-mode");
    if (window.lucide) window.lucide.createIcons();

    const usernameInput = document.getElementById("reg-username");
    if (usernameInput && !usernameInput.dataset.bound) {
      usernameInput.dataset.bound = "1";
      usernameInput.addEventListener("input", function () {
        let v = usernameInput.value
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, "");
        if (usernameInput.value !== v) usernameInput.value = v;
        const r = validateUsername(v);
        regState.username = { value: v, valid: r.valid };
        if (!v)
          setFieldStatus(
            "username",
            "",
            "3–20 characters · lowercase letters, numbers, underscores",
          );
        else setFieldStatus("username", r.valid ? "ok" : "error", r.hint);
        validateRegisterForm();
      });
    }

    const displayInput = document.getElementById("reg-displayname");
    if (displayInput && !displayInput.dataset.bound) {
      displayInput.dataset.bound = "1";
      displayInput.addEventListener("input", function () {
        const v = displayInput.value;
        const r = validateDisplayName(v);
        regState.displayName = {
          value: sanitizeDisplayName(v),
          valid: r.valid,
        };
        if (!v)
          setFieldStatus(
            "displayName",
            "",
            "This is how you'll appear on every whisper",
          );
        else setFieldStatus("displayName", r.valid ? "ok" : "error", r.hint);
        validateRegisterForm();
      });
    }

    const form = document.getElementById("register-form");
    if (form && !form.dataset.bound) {
      form.dataset.bound = "1";
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        submitRegister();
      });
    }

    registerCaptcha = createSliderCaptcha("auth-", function () {
      validateRegisterForm();
    });
    if (registerCaptcha) registerCaptcha.init();

    if (isLocked()) {
      showLockUI();
    } else {
      clearExpiredLock();
      hideLockUI();
      validateRegisterForm();
    }
  }

  async function submitRegister() {
    const submit = document.getElementById("register-submit");
    if (!submit || submit.disabled) return;
    if (isLocked()) return;
    if (honeypotTripped()) return;
    if (Date.now() - PAGE_LOAD_TIME < MIN_HUMAN_TIME) return;
    if (!registerCaptcha || !registerCaptcha.solved) return;
    if (!registerCaptcha.verifySig(registerCaptcha.sig)) return;

    submit.classList.add("is-loading");
    const lbl = submit.querySelector(".auth-submit-label");
    if (lbl) lbl.textContent = "Creating…";
    await new Promise(function (r) { setTimeout(r, 700); });

    /* Sanitize one last time before storing */
    const username = regState.username.value.replace(/[^a-z0-9_]/g, "");
    const displayName = sanitizeDisplayName(regState.displayName.value);

    const user = {
      username,
      displayName,
      createdAt: new Date().toISOString(),
    };
    const code = generateCode();

    saveUser(user);
    saveCode(code);
    resetAttempts();

    /* Refresh auth-guard so navbar state updates immediately */
    if (window.VexecAuthGuard) window.VexecAuthGuard.refresh();

    showCodeModal(code);

<<<<<<< HEAD
    /*
      NOTE: We do NOT dispatch "vexec:login-success" here anymore.
      The event is dispatched by hideCodeModal() after the code modal
      is closed. This prevents the Tor warning from firing *behind*
      the code modal, which was blocking it from ever showing.
    */

=======
>>>>>>> fe5a5742073570dc4d4a912f3c8c1dc5ed31f50b
    submit.classList.remove("is-loading");
    if (lbl) lbl.textContent = "Create identity";
  }

  /* ============================================================
     CODE MODAL
     ============================================================ */
  let pendingCode = null;

  function showCodeModal(code) {
    pendingCode = code;
    const modal = document.getElementById("auth-code-modal");
    if (!modal) return;

    const digitsEl = document.getElementById("auth-code-digits");
    if (digitsEl) {
      let html = "";
      for (let i = 0; i < code.length; i++) {
        if (i > 0 && i % 4 === 0)
          html += '<span class="digit-sep">·</span>';
        const ch = code[i]
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        html += ch;
      }
      digitsEl.innerHTML = html;
    }

    const check = document.getElementById("auth-code-check");
    const continueBtn = document.getElementById("auth-code-continue");
    if (check) check.checked = false;
    if (continueBtn) continueBtn.disabled = true;

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    if (window.lucide) window.lucide.createIcons({ root: modal });
  }

  function hideCodeModal() {
    const modal = document.getElementById("auth-code-modal");
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    pendingCode = null;
<<<<<<< HEAD

    /* Now show the Tor warning (a bit later) */
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent("vexec:login-success"));
    }, 800);
=======
>>>>>>> fe5a5742073570dc4d4a912f3c8c1dc5ed31f50b
  }

  /* ============================================================
     LOGIN
     ============================================================ */
  let loginCaptcha = null;

  function initLogin() {
    const page = document.querySelector('.auth-page[data-mode="login"]');
    if (!page) return;
    document.body.classList.add("auth-mode");
    if (window.lucide) window.lucide.createIcons();

    buildLoginCodeInput();

    loginCaptcha = createSliderCaptcha("auth-", function () {
      updateLoginState();
    });
    if (loginCaptcha) loginCaptcha.init();

    if (isLocked()) {
      showLockUI();
    } else {
      clearExpiredLock();
      hideLockUI();
      updateLoginState();
    }
  }

  function cleanCode(s) {
    return String(s || "")
      .replace(/[–—]/g, "")
      .replace(/[^A-Za-z0-9_\-]/g, "")
      .slice(0, CODE_LENGTH);
  }

  function formatCode(value) {
    const clean = cleanCode(value);
    let out = "";
    for (let i = 0; i < clean.length; i++) {
      if (i > 0 && i % 4 === 0) out += CODE_SEP;
      out += clean[i];
    }
    return out;
  }

  function applyCodeFormat(input) {
    const raw = input.value;
    const caret = input.selectionStart || 0;
    const isCodeChar = (c) => /[A-Za-z0-9_\-]/.test(c);

    let codeBefore = 0;
    for (let i = 0; i < caret && i < raw.length; i++) {
      if (isCodeChar(raw[i])) codeBefore++;
    }
    if (codeBefore > CODE_LENGTH) codeBefore = CODE_LENGTH;

    const formatted = formatCode(raw);
    input.value = formatted;

    let pos = 0;
    let count = 0;
    while (pos < formatted.length && count < codeBefore) {
      if (isCodeChar(formatted[pos])) count++;
      pos++;
    }
    try {
      input.setSelectionRange(pos, pos);
    } catch (_) {}
  }

  function getLoginCodeInput() {
    return document.getElementById("login-code");
  }

  function getLoginCode() {
    const input = getLoginCodeInput();
    return input ? cleanCode(input.value).slice(0, CODE_LENGTH) : "";
  }

  function buildLoginCodeInput() {
    const input = getLoginCodeInput();
    if (!input) return;
    if (input.dataset.bound === "1") return;
    input.dataset.bound = "1";

    input.addEventListener("input", function () {
      applyCodeFormat(input);
      clearLoginError();
      updateLoginState();
    });

    input.addEventListener("paste", function (e) {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData("text");
      input.value = text;
      applyCodeFormat(input);
      clearLoginError();
      updateLoginState();
    });

    input.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") return;
      if (e.key === "Enter") {
        e.preventDefault();
        if (!input.disabled) submitLogin();
      }
    });

    input.addEventListener("focus", function () {
      const len = input.value.length;
      try {
        input.setSelectionRange(len, len);
      } catch (_) {}
    });
  }

  function updateLoginState() {
    if (isLocked()) {
      const submit = document.getElementById("login-submit");
      if (submit) submit.disabled = true;
      return;
    }
    const code = getLoginCode();
    const submit = document.getElementById("login-submit");
    const clear = document.getElementById("login-clear");
    const captchaOk = loginCaptcha && loginCaptcha.solved;
    if (submit) submit.disabled = code.length !== CODE_LENGTH || !captchaOk;
    if (clear) clear.hidden = code.length === 0;

    const msg = document.getElementById("login-message");
    if (msg && msg.dataset.state === "error") {
      msg.dataset.state = "idle";
      msg.textContent = "";
    }
  }

  function clearLoginError() {
    const field = document.querySelector(".auth-code-field");
    if (field) field.classList.remove("is-error", "is-shaking");
  }

  async function submitLogin() {
    if (isLocked()) return;
    const code = getLoginCode();
    if (code.length !== CODE_LENGTH) return;
    if (!loginCaptcha || !loginCaptcha.solved) return;
    if (!loginCaptcha.verifySig(loginCaptcha.sig)) return;
    if (Date.now() - PAGE_LOAD_TIME < MIN_HUMAN_TIME) return;

    const field = document.querySelector(".auth-code-field");
    const submit = document.getElementById("login-submit");
    const msg = document.getElementById("login-message");

    if (submit) {
      submit.classList.add("is-loading");
      const lbl = submit.querySelector(".auth-submit-label");
      if (lbl) lbl.textContent = "Verifying…";
    }

    await new Promise(function (r) { setTimeout(r, 700); });

    const stored = loadCode();
    const user = loadUser();

    if (!stored || !user) {
      if (field) field.classList.add("is-error", "is-shaking");
      if (msg) {
        msg.dataset.state = "error";
        msg.textContent = "No account found. Register first.";
      }
      if (submit) {
        submit.classList.remove("is-loading");
        const lbl = submit.querySelector(".auth-submit-label");
        if (lbl) lbl.textContent = "Verify & Enter";
      }
      setTimeout(function () {
        if (field) field.classList.remove("is-shaking");
      }, 600);
      return;
    }

    /* Constant-time comparison to prevent timing attacks */
    if (safeEqual(cleanCode(code), cleanCode(stored))) {
      if (field) field.classList.add("is-success");
      if (msg) {
        msg.dataset.state = "ok";
        msg.textContent =
          "Welcome back, " + (user.displayName || user.username);
      }
      if (submit) {
        const lbl = submit.querySelector(".auth-submit-label");
        if (lbl) lbl.textContent = "Success";
        submit.classList.remove("is-loading");
      }
      resetAttempts();

      /* Refresh auth-guard so navbar appears */
      if (window.VexecAuthGuard) window.VexecAuthGuard.refresh();

<<<<<<< HEAD
      document.dispatchEvent(new CustomEvent("vexec:login-success"));

=======
>>>>>>> fe5a5742073570dc4d4a912f3c8c1dc5ed31f50b
      setTimeout(function () {
        if (window.router) window.router.navigate("/");
        else window.location.href = "/";
      }, 700);
    } else {
      if (field) field.classList.add("is-error", "is-shaking");
      if (msg) {
        msg.dataset.state = "error";
        msg.textContent = "Invalid code. Try again.";
      }
      if (submit) {
        submit.classList.remove("is-loading");
        const lbl = submit.querySelector(".auth-submit-label");
        if (lbl) lbl.textContent = "Verify & Enter";
      }
      setTimeout(function () {
        if (field) field.classList.remove("is-shaking");
      }, 600);

      const d = recordFailedAttempt();
      if (d.until > Date.now()) {
        setTimeout(showLockUI, 500);
      } else if (loginCaptcha) {
        setTimeout(function () {
          loginCaptcha.reset();
        }, 700);
      }
    }
  }

  function clearLoginInputs() {
    const input = getLoginCodeInput();
    if (input) {
      input.value = "";
      input.focus();
    }
    clearLoginError();
    updateLoginState();
    const msg = document.getElementById("login-message");
    if (msg) {
      msg.dataset.state = "idle";
      msg.textContent = "";
    }
  }

  /* ============================================================
     REBUILD CAPTCHA (after lock expires)
     ============================================================ */
  function rebuildActiveCaptcha() {
    if (
      registerCaptcha &&
      document.querySelector('.auth-page[data-mode="register"]')
    ) {
      registerCaptcha.reset();
    }
    if (
      loginCaptcha &&
      document.querySelector('.auth-page[data-mode="login"]')
    ) {
      loginCaptcha.reset();
    }
    if (document.getElementById("register-form")) validateRegisterForm();
    if (document.getElementById("login-code")) updateLoginState();
  }

  /* ============================================================
     GLOBAL DELEGATION
     ============================================================ */
  document.addEventListener("click", function (e) {
    if (e.target.closest("#login-submit")) {
      e.stopPropagation();
      submitLogin();
      return;
    }
    if (e.target.closest("#login-clear")) {
      e.stopPropagation();
      clearLoginInputs();
      return;
    }

    const copyBtn = e.target.closest("#auth-code-copy");
    if (copyBtn && pendingCode) {
      e.stopPropagation();
      const done = function () {
        copyBtn.classList.add("is-copied");
        const lbl = copyBtn.querySelector("span");
        if (lbl) lbl.textContent = "Copied";
        setTimeout(function () {
          copyBtn.classList.remove("is-copied");
          if (lbl) lbl.textContent = "Copy";
        }, 1400);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(pendingCode)
          .then(done)
          .catch(function () {
            fallbackCopy(pendingCode);
            done();
          });
      } else {
        fallbackCopy(pendingCode);
        done();
      }
      return;
    }

    if (e.target.closest("#auth-code-continue")) {
      const btn = document.getElementById("auth-code-continue");
      if (btn && !btn.disabled) {
        e.stopPropagation();
        hideCodeModal();
        if (window.router) window.router.navigate("/");
        else window.location.href = "/";
      }
      return;
    }

    const modal = e.target.closest("#auth-code-modal");
    if (modal && e.target === modal) {
      const check = document.getElementById("auth-code-check");
      if (check && check.checked) hideCodeModal();
      return;
    }
  });

  document.addEventListener("change", function (e) {
    if (e.target && e.target.id === "auth-code-check") {
      const btn = document.getElementById("auth-code-continue");
      if (btn) btn.disabled = !e.target.checked;
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    const modal = document.getElementById("auth-code-modal");
    if (!modal || !modal.classList.contains("open")) return;
    const check = document.getElementById("auth-code-check");
    if (check && check.checked) hideCodeModal();
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

  /* ============================================================
     CROSS-TAB SYNC
     ============================================================ */
  window.addEventListener("storage", function (e) {
    if (e.key !== LOCK_KEY && e.key !== null) return;
    if (!document.querySelector(".auth-page")) return;

    if (isLocked()) {
      showLockUI();
    } else {
      hideLockUI();
      rebuildActiveCaptcha();
    }
  });

  /* ============================================================
<<<<<<< HEAD
=======
     VISIBILITY — purge on prolonged inactivity (optional)
     Uncomment to auto-logout after 7 days of no use.
     ============================================================ */
  // document.addEventListener("visibilitychange", function () {
  //   if (document.visibilityState === "visible") {
  //     try {
  //       const meta = JSON.parse(localStorage.getItem(CODE_META_KEY) || "{}");
  //       if (meta.ts && Date.now() - meta.ts > 7 * 86400e3) purgeSensitive();
  //     } catch (_) {}
  //   }
  // });

  /* ============================================================
>>>>>>> fe5a5742073570dc4d4a912f3c8c1dc5ed31f50b
     ROUTE HOOKS
     ============================================================ */
  document.addEventListener("route:change", function (e) {
    const path = e.detail && e.detail.path;
    if (lockTimer) {
      clearInterval(lockTimer);
      lockTimer = null;
    }

    if (path === "/register") {
      setTimeout(initRegister, 40);
    } else if (path === "/login") {
      setTimeout(initLogin, 40);
    } else {
      document.body.classList.remove("auth-mode");
    }
  });

  document.addEventListener("DOMContentLoaded", function () {
    const p = window.location.pathname;
    if (p.endsWith("/register")) setTimeout(initRegister, 100);
    else if (p.endsWith("/login")) setTimeout(initLogin, 100);
  });

  /* ============================================================
     EXPOSE (debug)
     ============================================================ */
  window.VexecAuth = {
    get user() {
      return loadUser();
    },
    get code() {
      return loadCode();
    },
    get locked() {
      return isLocked();
    },
    lock() {
      writeLockData({
        attempts: 4,
        until: Date.now() + LOCK_DURATION_MS,
      });
    },
    unlock() {
      resetAttempts();
    },
    reset() {
      purgeSensitive();
      localStorage.removeItem(LOCK_KEY);
      document.cookie =
        LOCK_COOKIE + "=; max-age=0; path=/; SameSite=Strict";
      if (window.VexecAuthGuard) window.VexecAuthGuard.refresh();
      console.log("[auth] reset");
    },
  };
})();