/* ============================================================
   Vexec — Service Worker
   Handles SPA navigation fallback: any 404 → index.html
   ============================================================ */

const CACHE = "vexec-shell-v1";
const SHELL = ["./", "./index.html"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL).catch(() => {}))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // فقط درخواست‌های navigation (لینک مستقیم / F5) رو هندل کن
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);

          // اگه 404 بود → index.html کش شده رو برگردون
          if (res.status === 404) {
            const cache = await caches.open(CACHE);
            const shell = await cache.match("./index.html");
            if (shell) return shell;
          }

          return res;
        } catch (err) {
          // Network fail → از کش
          const cache = await caches.open(CACHE);
          const shell = await cache.match("./index.html");
          return shell || Response.error();
        }
      })()
    );
  }
});