const CACHE = "baseweight-v68";

// self.registration.scope resolves to the actual deployment URL,
// so this works whether hosted at root or a subdirectory (e.g. /baseweight/)
self.addEventListener("install", e => {
  const base = self.registration.scope;
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll([
      base,
      base + "manifest.json",
      base + "icon-192.png",
      base + "icon-512.png",
      base + "apple-touch-icon.png",
    ])).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => {
        // Offline fallback: return the cached app shell for any navigation
        if (e.request.mode === "navigate") return caches.match(self.registration.scope);
      });
    })
  );
});
