const CACHE = "baseweight-v86";

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

const shellURL = () => self.registration.scope;

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;           // let the browser handle non-GET

  // NAVIGATION — network first.
  // The whole app ships as a single index.html with the bundle inlined, so serving
  // navigations cache-first strands returning users on the PREVIOUS deploy until they
  // reload a second time (the old worker answers from cache before the new one can
  // activate). Bumping the cache name alone does not fix that. Going to the network
  // first means a deploy is picked up on the very next load, while the cached shell
  // still covers genuine offline use.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone();
          // Key on the scope so /, /index.html and /?foo all resolve to one shell entry.
          caches.open(CACHE).then(c => c.put(shellURL(), copy));
        }
        return res;
      }).catch(() =>
        caches.match(shellURL(), { cacheName: CACHE })
          .then(r => r || caches.match(shellURL()))
      )
    );
    return;
  }

  // STATIC ASSETS (icons, manifest) — cache first is correct; they are versioned by
  // the cache name. Scope the lookup to the CURRENT cache so a leftover entry from an
  // older cache can never win during the activate window.
  e.respondWith(
    caches.match(req, { cacheName: CACHE }).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
