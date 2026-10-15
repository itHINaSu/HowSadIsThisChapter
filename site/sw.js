// Offline support: the app shell is precached; the data in api/ is served
// from cache immediately and refreshed in the background; cover images
// are cached as they're seen.
const SHELL = "shell-v1";
const DATA = "data-v1";
const IMAGES = "images-v1";
const SHELL_FILES = ["./", "index.html", "styles.css", "app.js", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  const keep = new Set([SHELL, DATA, IMAGES]);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: true });
  const network = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || network;
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok || res.type === "opaque") cache.put(request, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin === location.origin && url.pathname.includes("/api/")) {
    event.respondWith(staleWhileRevalidate(request, DATA));
  } else if (url.origin === location.origin) {
    event.respondWith(staleWhileRevalidate(request, SHELL));
  } else if (request.destination === "image" || url.hostname.endsWith("fonts.gstatic.com") || url.hostname.endsWith("fonts.googleapis.com")) {
    event.respondWith(cacheFirst(request, IMAGES).catch(() => Response.error()));
  }
});
