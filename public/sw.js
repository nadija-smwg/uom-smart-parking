const CACHE = "uom-parking-public-v3";
const SAFE = ["/campus.json", "/icon-192.png", "/icon-512.png", "/offline.html"];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SAFE)));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) =>
    key.startsWith("uom-parking-public-") && key !== CACHE).map((key) => caches.delete(key))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (event.request.mode === "navigate" && url.pathname !== "/api" && !url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request, { cache: "no-store" })
      .catch(async () => (await caches.open(CACHE)).match("/offline.html")));
  } else if (SAFE.includes(url.pathname) && !url.search) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      let result;
      try { result = await fetch(event.request); }
      catch (error) {
        const cached = await cache.match(event.request);
        if (!cached) throw error;
        return cached;
      }
      if (result.ok) await cache.put(event.request, result.clone()).catch(() => {});
      return result;
    })());
  }
});
