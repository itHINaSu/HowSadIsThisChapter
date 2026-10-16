// Offline support. The app's own files are fetched fresh from the server
// whenever it's reachable (falling back to the cached copy offline), so a
// new version shows up on the next load without reinstalling. The data in
// api/ is served from cache immediately and refreshed in the background;
// cover images are cached as they're seen.
// The Dockerfile stamps VERSION with the commit, so every build is a new
// service worker and old caches are cleared.
const VERSION = "__APP_VERSION__";
const SHELL = `shell-${VERSION}`;
const DATA = "data-v1";
const IMAGES = "images-v1";
const SHELL_FILES = ["./", "index.html", "styles.css", "app.js", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((c) => c.addAll(SHELL_FILES.map((f) => new Request(f, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([SHELL, DATA, IMAGES]);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await Promise.race([fetch(request), timeout(5000)]);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === "navigate") return (await cache.match("./")) || Response.error();
    return Response.error();
  }
}

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

  if (url.origin === location.origin) {
    if (url.pathname.endsWith("/version.json")) return; // always straight to the server
    if (url.pathname.includes("/api/")) event.respondWith(staleWhileRevalidate(request, DATA));
    else event.respondWith(networkFirst(request, SHELL));
  } else if (request.destination === "image" || url.hostname.endsWith("fonts.gstatic.com") || url.hostname.endsWith("fonts.googleapis.com")) {
    event.respondWith(cacheFirst(request, IMAGES).catch(() => Response.error()));
  }
});
