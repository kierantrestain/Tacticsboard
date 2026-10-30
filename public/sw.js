const CACHE = "touchline-studio-v4.0.0-1";
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll([
          "/",
          "/favicon.svg",
          "/manifest.webmanifest",
          "/data/catalogue.json",
          "/data/matches.json",
        ]),
      ),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("touchline-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  )
    return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const saved = response.clone();
            caches.open(CACHE).then((cache) => cache.put("/", saved));
          }
          return response;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          if (
            response.ok &&
            response.type === "basic" &&
            (url.pathname.startsWith("/vision/") ||
              /\.(js|css|woff2|wasm|tflite|svg|json)$/.test(url.pathname))
          ) {
            const saved = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, saved));
          }
          return response;
        }),
    ),
  );
});
