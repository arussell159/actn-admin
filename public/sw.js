const CACHE_NAME = "actn-admin-v15"
const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/actn-admin-icon.png",
  "/actn-admin-icon-192.png",
  "/actn-admin-icon-512.png",
  "/login-side-image.jpg",
]

function isStaticAsset(request) {
  const url = new URL(request.url)

  return (
    request.method === "GET" &&
    url.origin === self.location.origin &&
    (STATIC_ASSETS.includes(url.pathname) ||
      url.pathname.startsWith("/_next/static/") ||
      /\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|woff2?)$/i.test(url.pathname))
  )
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("actn-admin") && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  if (!isStaticAsset(event.request)) {
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached
      }

      return fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
        }

        return response
      })
    })
  )
})
