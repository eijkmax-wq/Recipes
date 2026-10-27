// Netwerk eerst (zodat nieuwe recepten meteen zichtbaar zijn), cache als je offline bent.
const CACHE = "recepten-v2";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((res) => { const kopie = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, kopie)); return res; })
      .catch(() => caches.match(e.request))
  );
});
