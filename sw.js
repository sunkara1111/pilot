/* Pilot service worker — cache shell for free web app / Add to Home Screen */
const CACHE = "pilot-shell-v4";
const PRECACHE = [
  "./",
  "./index.html",
  "./css/pilot.css",
  "./js/site-config.js",
  "./js/reply-composer.js",
  "./js/pilot-page.js",
  "./js/business-writer.js",
  "./js/resume-helper.js",
  "./js/message-check.js",
  "./tools/index.html",
  "./tools/reply.html",
  "./tools/business-writer.html",
  "./tools/resume-helper.html",
  "./tools/message-check.html",
  "./about.html",
  "./privacy.html",
  "./terms.html",
  "./favicon.svg",
  "./favicon.png",
  "./apple-touch-icon.png",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const fetched = fetch(req).then((res) => {
        if (res && res.ok && (url.pathname.endsWith(".html") || url.pathname.endsWith(".css") || url.pathname.endsWith(".js") || url.pathname.endsWith(".svg") || url.pathname.endsWith(".png") || url.pathname.endsWith(".webmanifest") || url.pathname.endsWith("/"))) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});
