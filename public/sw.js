const CACHE_NAME = "actn-admin-v4"
const APP_SHELL = [
  "/",
  "/login",
  "/month-end",
  "/month-end/new",
  "/previous-month-ends",
  "/previous-month-ends/view",
  "/pricing-upload",
  "/quote-tool",
  "/information",
  "/template-builder",
  "/manifest.webmanifest",
  "/actn-admin-icon.png",
  "/actn-admin-icon-192.png",
  "/actn-admin-icon-512.png",
  "/login-side-image.jpg",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
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
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && new URL(event.request.url).origin === self.location.origin) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
        }

        return response
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/")))
  )
})
