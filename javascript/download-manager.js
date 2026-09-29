/* ============================================================
   DOWNLOAD MANAGER — Vexec (corner widget system, optimized)
   ============================================================ */

(function () {
  "use strict";

  const SPEED_TICK_MS = 400;
  const STALL_TIMEOUT_MS = 15000;
  const XHR_TIMEOUT_MS = 300000;
  const AUTO_REMOVE_DONE_MS = 3500;

  const CORS_PROXIES = [
    (url) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(url),
    (url) => "https://cors.eu.org/" + url,
  ];

  /* ============================================================
     State
     ============================================================ */
  const items = new Map();
  let widgetEl = null;
  let modalEl = null;
  let modalListEl = null;
  let isModalOpen = false;
  let speedTimer = null;
  let order = 0;

  const refs = {
    name: null,
    fill: null,
    meta: null,
    toggleBtn: null,
    modalToggleBtn: null,
    modalCount: null,
  };

  /* ============================================================
     Helpers
     ============================================================ */
  function formatBytes(b) {
    if (!b && b !== 0) return "0 B";
    if (b < 1024) return b + " B";
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
    if (b < 1024 * 1024 * 1024) return (b / (1024 * 1024)).toFixed(2) + " MB";
    return (b / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  }
  function formatSpeed(bps) {
    if (!bps || bps < 1) return "0 B/s";
    return formatBytes(bps) + "/s";
  }
  function escapeHTML(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  function isCrossOrigin(url) {
    try {
      const u = new URL(url, location.href);
      return u.origin !== location.origin;
    } catch (_) { return false; }
  }
  function iconForFile(name) {
    const n = (name || "").toLowerCase();
    if (/\.(mp3|wav|ogg|flac|m4a|aac|opus|m4b|weba)$/.test(n)) return "music";
    if (/\.(png|jpe?g|gif|webp|bmp|svg|avif|heic)$/.test(n)) return "image";
    if (/\.(mp4|mov|avi|mkv|webm|m4v)$/.test(n)) return "file-video";
    if (/\.(pdf|docx?|rtf|odt|txt|md)$/.test(n)) return "file-text";
    if (/\.(xlsx?|csv|ods)$/.test(n)) return "file-spreadsheet";
    if (/\.(zip|rar|7z|tar|gz|bz2|xz)$/.test(n)) return "file-archive";
    if (/\.(pptx?|odp|key)$/.test(n)) return "file-text";
    return "file";
  }

  /* ============================================================
     Corner container
     ============================================================ */
  function getCorner() {
    let el = document.getElementById("vexec-corner");
    if (!el) {
      el = document.createElement("div");
      el.id = "vexec-corner";
      el.className = "vexec-corner";
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    return el;
  }
  window.VexecCorner = { get: getCorner };

  /* ============================================================
     Widget
     ============================================================ */
  function ensureWidget() {
    if (widgetEl) return widgetEl;

    widgetEl = document.createElement("div");
    widgetEl.id = "dl-widget";
    widgetEl.className = "dl-widget";
    widgetEl.setAttribute("role", "button");
    widgetEl.setAttribute("tabindex", "0");
    widgetEl.innerHTML = `
      <div class="dl-chip-icon">
        <i data-lucide="download"></i>
        <span class="dl-wave"></span>
        <span class="dl-wave"></span>
        <span class="dl-wave"></span>
      </div>
      <div class="dl-chip-body">
        <span class="dl-chip-name"></span>
        <div class="dl-chip-bar"><div class="dl-chip-fill"></div></div>
        <span class="dl-chip-meta"></span>
      </div>
      <div class="dl-chip-actions">
        <button class="dl-chip-btn" type="button" data-action="toggle-all" aria-label="Pause all">
          <i data-lucide="pause"></i>
        </button>
        <button class="dl-chip-btn dl-chip-btn-danger" type="button" data-action="end-all" aria-label="End all">
          <i data-lucide="square"></i>
        </button>
      </div>
    `;
    getCorner().appendChild(widgetEl);
    if (window.lucide) window.lucide.createIcons({ root: widgetEl });

    refs.name = widgetEl.querySelector(".dl-chip-name");
    refs.fill = widgetEl.querySelector(".dl-chip-fill");
    refs.meta = widgetEl.querySelector(".dl-chip-meta");
    refs.toggleBtn = widgetEl.querySelector('[data-action="toggle-all"]');
    if (refs.toggleBtn) refs.toggleBtn.dataset.iconName = "pause";

    widgetEl.addEventListener("click", (e) => {
      if (e.target.closest(".dl-chip-btn")) return;
      e.stopPropagation();
      if (isMinimized()) expandWidget();
      else openModal();
    });
    widgetEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (isMinimized()) expandWidget();
        else openModal();
      }
    });

    refs.toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleAllPause();
    });
    widgetEl.querySelector('[data-action="end-all"]').addEventListener("click", (e) => {
      e.stopPropagation();
      endAll();
    });

    return widgetEl;
  }

  function isMinimized() {
    return widgetEl && widgetEl.classList.contains("is-minimized");
  }

  function expandWidget() {
    if (!widgetEl) return;
    widgetEl.classList.remove("is-minimized");
    window.dispatchEvent(new CustomEvent("vexec:corner", {
      detail: { expanded: "download" },
    }));
  }

  window.addEventListener("vexec:corner", (e) => {
    if (!e.detail || !widgetEl) return;
    if (e.detail.expanded === "music") widgetEl.classList.add("is-minimized");
    else if (e.detail.expanded === "download") widgetEl.classList.remove("is-minimized");
  });

  /* ============================================================
     Modal
     ============================================================ */
  function ensureModal() {
    if (modalEl) return modalEl;

    modalEl = document.createElement("div");
    modalEl.className = "dl-modal";
    modalEl.innerHTML = `
      <div class="dl-modal-card" role="dialog">
        <header class="dl-modal-head">
          <div class="dl-modal-title">
            <i data-lucide="download"></i>
            <span>Downloads</span>
            <span class="dl-modal-count">0</span>
          </div>
          <button class="dl-modal-close" type="button" data-action="close" aria-label="Close">
            <i data-lucide="x"></i>
          </button>
        </header>
        <div class="dl-modal-list"></div>
        <footer class="dl-modal-foot">
          <button class="dl-modal-foot-btn" type="button" data-action="toggle-all">
            <i data-lucide="pause"></i><span>Pause all</span>
          </button>
          <button class="dl-modal-foot-btn dl-modal-foot-btn-danger" type="button" data-action="end-all">
            <i data-lucide="square"></i><span>End all</span>
          </button>
        </footer>
      </div>
    `;
    document.body.appendChild(modalEl);
    if (window.lucide) window.lucide.createIcons({ root: modalEl });

    modalListEl = modalEl.querySelector(".dl-modal-list");
    refs.modalCount = modalEl.querySelector(".dl-modal-count");
    refs.modalToggleBtn = modalEl.querySelector('[data-action="toggle-all"]');
    if (refs.modalToggleBtn) refs.modalToggleBtn.dataset.iconName = "pause";

    modalEl.addEventListener("click", (e) => {
      if (e.target === modalEl) return closeModal();
      const action = e.target.closest("[data-action]");
      if (!action) return;
      const a = action.dataset.action;
      if (a === "close") closeModal();
      else if (a === "toggle-all") toggleAllPause();
      else if (a === "end-all") endAll();
    });

    modalListEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".dl-item-btn");
      if (!btn) return;
      e.stopPropagation();
      const item = items.get(btn.dataset.id);
      if (!item) return;
      const a = btn.dataset.action;
      if (a === "pause") pauseItem(item);
      else if (a === "resume") resumeItem(item);
      else if (a === "end") endItem(item);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isModalOpen) closeModal();
    });

    return modalEl;
  }

  function openModal() {
    if (!widgetEl || items.size === 0) return;
    ensureModal();
    renderModalList();
    modalEl.classList.add("open");
    document.body.style.overflow = "hidden";
    isModalOpen = true;
  }

  function closeModal() {
    if (!modalEl) return;
    modalEl.classList.remove("open");
    document.body.style.overflow = "";
    isModalOpen = false;
  }

  /* ============================================================
     Chip UI
     ============================================================ */
  function updateChip() {
    if (!widgetEl || !refs.name) return;

    const list = [...items.values()];
    if (list.length === 0) {
      widgetEl.classList.remove("has-items", "is-active", "is-paused", "is-done");
      if (isModalOpen) closeModal();
      return;
    }
    widgetEl.classList.add("has-items");

    const activeList = list.filter((i) => i.status === "downloading");
    const pausedList = list.filter((i) => i.status === "paused");
    const doneList   = list.filter((i) => i.status === "done");
    const isActive   = activeList.length > 0;
    const isAllDone  = list.every((i) => i.status === "done");
    const isAllPaused = !isActive && pausedList.length > 0;

    let nameText;
    if (list.length === 1) nameText = list[0].filename;
    else nameText = `${list[0].filename}, and ${list.length - 1} more`;

    let totalLoaded = 0, totalSize = 0, unknownSize = false;
    list.forEach((i) => {
      totalLoaded += i.loaded || 0;
      if (i.size) totalSize += i.size;
      else unknownSize = true;
    });
    const avg = totalSize > 0 ? Math.min(1, totalLoaded / totalSize) : 0;
    const totalSpeed = list.reduce((s, i) => s + (i.speed || 0), 0);

    if (refs.name.textContent !== nameText) refs.name.textContent = nameText;

    const w = unknownSize ? "100%" : (avg * 100).toFixed(1) + "%";
    if (refs.fill.style.width !== w) refs.fill.style.width = w;

    const metaParts = [];
    if (isActive) metaParts.push(formatSpeed(totalSpeed));
    if (list.length > 1) {
      metaParts.push(`${doneList.length}/${list.length}`);
      metaParts.push(Math.round(avg * 100) + "%");
    } else if (list[0].status === "done") metaParts.push("Done");
    else if (list[0].status === "error") metaParts.push("Failed");
    else if (list[0].status === "paused") metaParts.push("Paused");
    else metaParts.push(Math.round(avg * 100) + "%");
    const metaText = metaParts.join(" · ");
    if (refs.meta.textContent !== metaText) refs.meta.textContent = metaText;

    const iconName = isActive ? "pause" : "play";
    setToggleIcon(refs.toggleBtn, iconName);
    setToggleIcon(refs.modalToggleBtn, iconName, isActive ? "Pause all" : "Resume all");

    widgetEl.classList.toggle("is-active", isActive);
    widgetEl.classList.toggle("is-paused", isAllPaused);
    widgetEl.classList.toggle("is-done", isAllDone);

    if (refs.modalCount) {
      const c = String(items.size);
      if (refs.modalCount.textContent !== c) refs.modalCount.textContent = c;
    }
  }

  function setToggleIcon(btn, iconName, labelText) {
    if (!btn) return;
    if (btn.dataset.iconName === iconName && !labelText) return;
    btn.dataset.iconName = iconName;
    if (labelText) {
      btn.innerHTML = `<i data-lucide="${iconName}"></i><span>${labelText}</span>`;
    } else {
      btn.innerHTML = `<i data-lucide="${iconName}"></i>`;
    }
    if (window.lucide) window.lucide.createIcons({ root: btn });
  }

  /* ============================================================
     Modal list
     ============================================================ */
  function renderModalList() {
    if (!modalEl || !modalListEl) return;

    let newElements = false;
    [...items.values()].forEach((item) => {
      let el = modalListEl.querySelector(`.dl-item[data-id="${item.id}"]`);
      if (!el) {
        el = document.createElement("div");
        el.className = "dl-item";
        el.dataset.id = item.id;
        const icon = iconForFile(item.filename);
        el.innerHTML = `
          <div class="dl-item-icon"><i data-lucide="${icon}"></i></div>
          <div class="dl-item-body">
            <div class="dl-item-top">
              <span class="dl-item-name">${escapeHTML(item.filename)}</span>
              <span class="dl-item-pct">0%</span>
            </div>
            <div class="dl-item-bar"><div class="dl-item-fill"></div></div>
            <span class="dl-item-meta">Queued…</span>
          </div>
          <div class="dl-item-actions">
            <button class="dl-item-btn" type="button" data-action="pause" data-id="${item.id}" aria-label="Pause">
              <i data-lucide="pause"></i>
            </button>
            <button class="dl-item-btn" type="button" data-action="resume" data-id="${item.id}" aria-label="Resume" style="display:none">
              <i data-lucide="play"></i>
            </button>
            <button class="dl-item-btn dl-item-btn-danger" type="button" data-action="end" data-id="${item.id}" aria-label="End">
              <i data-lucide="square"></i>
            </button>
          </div>
        `;
        modalListEl.appendChild(el);
        item.el = el;
        item._refs = {
          fill: el.querySelector(".dl-item-fill"),
          pct: el.querySelector(".dl-item-pct"),
          meta: el.querySelector(".dl-item-meta"),
          pauseBtn: el.querySelector('[data-action="pause"]'),
          resumeBtn: el.querySelector('[data-action="resume"]'),
        };
        newElements = true;
      }
      updateItemUI(item);
    });

    if (newElements && window.lucide) {
      window.lucide.createIcons({ root: modalListEl });
    }
  }

  function updateItemUI(item) {
    const el = item.el;
    const r = item._refs;
    if (!el || !r) return;

    const ratio = item.size ? Math.min(1, item.loaded / item.size)
                            : (item.status === "done" ? 1 : 0);
    const w = (ratio * 100).toFixed(1) + "%";
    if (r.fill.style.width !== w) r.fill.style.width = w;

    const pctText = Math.round(ratio * 100) + "%";
    if (r.pct.textContent !== pctText) r.pct.textContent = pctText;

    const parts = [];
    if (item.status === "downloading") {
      parts.push(formatSpeed(item.speed));
      parts.push(`${formatBytes(item.loaded)}${item.size ? " / " + formatBytes(item.size) : ""}`);
    } else if (item.status === "paused") {
      parts.push("Paused");
      parts.push(`${formatBytes(item.loaded)}${item.size ? " / " + formatBytes(item.size) : ""}`);
    } else if (item.status === "done") {
      parts.push("Completed");
      parts.push(formatBytes(item.loaded));
    } else if (item.status === "error") parts.push("Failed");
    else parts.push("Queued");
    const metaText = parts.join(" · ");
    if (r.meta.textContent !== metaText) r.meta.textContent = metaText;

    el.classList.toggle("is-paused", item.status === "paused");
    el.classList.toggle("is-done", item.status === "done");
    el.classList.toggle("is-error", item.status === "error");

    const pauseShow = item.status === "downloading";
    const resumeShow = item.status === "paused";
    if (r.pauseBtn.style.display !== (pauseShow ? "" : "none")) {
      r.pauseBtn.style.display = pauseShow ? "" : "none";
    }
    if (r.resumeBtn.style.display !== (resumeShow ? "" : "none")) {
      r.resumeBtn.style.display = resumeShow ? "" : "none";
    }
  }

  function removeItemFromUI(item) {
    if (item.el) {
      const el = item.el;
      item.el = null;
      item._refs = null;
      el.classList.add("is-leaving");
      setTimeout(() => { if (el.parentNode) el.remove(); }, 280);
    }
  }

  /* ============================================================
     Speed meter
     ============================================================ */
  function startSpeedTimer() {
    if (speedTimer) return;
    speedTimer = setInterval(() => {
      let anyActive = false;
      items.forEach((item) => {
        if (item.status !== "downloading") { item.speed = 0; return; }
        anyActive = true;
        const now = Date.now();
        const dt = (now - item.lastSampleTime) / 1000;
        if (dt <= 0.05) return;
        const dBytes = item.loaded - item.lastSampleLoaded;
        const instant = dBytes / dt;
        item.speed = item.speed ? item.speed * 0.6 + instant * 0.4 : instant;
        item.lastSampleTime = now;
        item.lastSampleLoaded = item.loaded;
        updateItemUI(item);
      });
      updateChip();
      if (!anyActive && items.size === 0) {
        clearInterval(speedTimer);
        speedTimer = null;
      }
    }, SPEED_TICK_MS);
  }

  /* ============================================================
     XHR
     ============================================================ */
  function makeXhr(url, item, opts) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.responseType = "blob";
      xhr.timeout = (opts && opts.timeout) || XHR_TIMEOUT_MS;
      if (opts && opts.rangeFrom > 0) {
        xhr.setRequestHeader("Range", "bytes=" + opts.rangeFrom + "-");
      }
      item.xhr = xhr;

      let finished = false;
      let stallTimer = null;
      function clearStall() { if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; } }
      function armStall() {
        clearStall();
        stallTimer = setTimeout(() => {
          if (finished) return;
          finished = true;
          try { xhr.abort(); } catch (_) {}
          reject(new Error("stalled"));
        }, STALL_TIMEOUT_MS);
      }
      armStall();

      const offset = (opts && opts.rangeFrom) || 0;

      xhr.onprogress = (e) => {
        if (finished) return;
        armStall();
        const received = e.loaded || 0;
        const totalThisReq = e.lengthComputable ? e.total : 0;
        item.loaded = offset + received;
        if (totalThisReq > 0) item.size = offset + totalThisReq;
        if (item.el) updateItemUI(item);
        updateChip();
      };

      xhr.onload = () => {
        if (finished) return;
        finished = true;
        clearStall();
        if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response);
        else reject(new Error("HTTP " + xhr.status));
      };
      xhr.onerror   = () => { if (finished) return; finished = true; clearStall(); reject(new Error("network")); };
      xhr.onabort   = () => { if (finished) return; finished = true; clearStall(); reject(new Error("aborted")); };
      xhr.ontimeout = () => { if (finished) return; finished = true; clearStall(); reject(new Error("timeout")); };

      try { xhr.send(); } catch (e) {
        finished = true;
        clearStall();
        reject(e);
      }
    });
  }

  /* ============================================================
     Item lifecycle
     ============================================================ */
  async function startItem(item) {
    item.status = "downloading";
    item.lastSampleTime = Date.now();
    item.lastSampleLoaded = item.loaded || 0;
    if (item.el) updateItemUI(item);
    updateChip();
    startSpeedTimer();

    const cross = isCrossOrigin(item.url);
    const tryUrls = cross
      ? [item.url, ...CORS_PROXIES.map((fn) => fn(item.url))]
      : [item.url];

    for (let i = 0; i < tryUrls.length; i++) {
      if (item.status === "paused") return;
      const tryUrl = tryUrls[i];
      try {
        const offset = item.loaded || 0;
        const blob = await makeXhr(tryUrl, item, {
          rangeFrom: offset,
          timeout: cross && i > 0 ? 25000 : XHR_TIMEOUT_MS,
        });
        let finalBlob = blob;
        if (item.partialBlob && offset > 0) {
          finalBlob = new Blob([item.partialBlob, blob]);
        }
        item.partialBlob = finalBlob;
        item.loaded = finalBlob.size;
        if (!item.size) item.size = finalBlob.size;
        item.status = "done";
        item.speed = 0;
        if (item.el) updateItemUI(item);
        updateChip();
        triggerBlobDownload(finalBlob, item.filename);
        setTimeout(() => { if (items.has(item.id)) endItem(item, true); }, AUTO_REMOVE_DONE_MS);
        return;
      } catch (err) {
        if (item.status === "paused") return;
        if (err.message === "aborted") return;
      }
    }

    item.status = "error";
    item.speed = 0;
    if (item.el) updateItemUI(item);
    updateChip();
  }

  function pauseItem(item) {
    if (item.status !== "downloading") return;
    try { if (item.xhr) item.xhr.abort(); } catch (_) {}
    item.status = "paused";
    item.speed = 0;
    if (item.el) updateItemUI(item);
    updateChip();
  }

  function resumeItem(item) {
    if (item.status !== "paused") return;
    startItem(item);
  }

  function endItem(item, silent) {
    try { if (item.xhr) item.xhr.abort(); } catch (_) {}
    items.delete(item.id);
    removeItemFromUI(item);
    updateChip();
    if (isModalOpen && items.size === 0) closeModal();
  }

  function toggleAllPause() {
    const list = [...items.values()];
    const anyActive = list.some((i) => i.status === "downloading");
    if (anyActive) list.forEach((i) => { if (i.status === "downloading") pauseItem(i); });
    else list.forEach((i) => { if (i.status === "paused") resumeItem(i); });
  }

  function endAll() {
    [...items.values()].forEach((i) => endItem(i, true));
    closeModal();
    window.dispatchEvent(new CustomEvent("vexec:corner", {
      detail: { expanded: "music" },
    }));
  }

  /* ============================================================
     Trigger browser download
     ============================================================ */
  function triggerBlobDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "download";
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }

  /* ============================================================
     PUBLIC — download
     ============================================================ */
  function download(url, filename, opts) {
    opts = opts || {};
    if (!url) { if (opts.onError) opts.onError(new Error("No URL")); return; }

    ensureWidget();

    const id = "dl_" + Math.random().toString(36).slice(2) + "_" + (++order);

    /* blob:/data: — add to list and immediately finish */
    if (url.startsWith("blob:") || url.startsWith("data:")) {
      const item = {
        id, url,
        filename: filename || "download",
        size: 0, loaded: 0, speed: 0,
        status: "done",
        xhr: null, el: null, _refs: null, partialBlob: null,
        createdAt: Date.now(),
        lastSampleTime: Date.now(), lastSampleLoaded: 0,
      };
      items.set(id, item);
      updateChip();
      expandWidget();
      if (isModalOpen) renderModalList();

      /* Trigger the actual browser download */
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "file";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      if (opts.onProgress) opts.onProgress(1, 0, 0);
      if (opts.onDone) setTimeout(opts.onDone, 60);

      setTimeout(() => { if (items.has(id)) endItem(item, true); }, AUTO_REMOVE_DONE_MS);
      return;
    }

    /* Regular URL — full download pipeline */
    const item = {
      id, url,
      filename: filename || "download",
      size: 0, loaded: 0, speed: 0,
      status: "queued",
      xhr: null, el: null, _refs: null, partialBlob: null,
      createdAt: Date.now(),
      lastSampleTime: Date.now(), lastSampleLoaded: 0,
    };
    items.set(id, item);
    updateChip();

    expandWidget();

    if (isModalOpen) renderModalList();

    startItem(item);
  }

  /* ============================================================
     Init
     ============================================================ */
  ensureWidget();

  window.VexecDownload = {
    download,
    triggerBlobDownload,
    get count() { return items.size; },
    get items() { return [...items.values()]; },
    endAll,
    toggleAllPause,
  };

  console.info("[download-manager] ready · optimized");
})();