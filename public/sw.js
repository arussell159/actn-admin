const CACHE_PREFIX = "actn-admin-"
const CACHE_NAME = "actn-admin-shell-v18"
const OFFLINE_URL = "/offline.html"
const SHELL_ASSETS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/actn-admin-icon.png",
  "/actn-admin-icon-192.png",
  "/actn-admin-icon-512.png",
]

function isSameOriginGet(request) {
  return (
    request.method === "GET" &&
    new URL(request.url).origin === self.location.origin
  )
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // One missing optional icon must not prevent the new worker installing.
      await Promise.allSettled(
        SHELL_ASSETS.map((asset) =>
          cache.add(
            new Request(new URL(asset, self.location.origin), {
              cache: "reload",
            })
          )
        )
      )
      await self.skipWaiting()
    })
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
      await self.clients.claim()
    })
  )
})

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    event.waitUntil(self.skipWaiting())
  }

  if (event.data?.type === "GET_VERSION") {
    event.source?.postMessage({ type: "SW_VERSION", version: CACHE_NAME })
  }
})

self.addEventListener("fetch", (event) => {
  const { request } = event

  if (!isSameOriginGet(request)) {
    return
  }

  if (request.mode === "navigate") {
    // Authenticated HTML and RSC responses must always come from the network.
    // Serving old navigation responses is the most dangerous PWA mismatch.
    event.respondWith(
      fetch(request).catch(async () => {
        const offlineRequest = new Request(
          new URL(OFFLINE_URL, self.location.origin)
        )
        return (await caches.match(offlineRequest)) ?? Response.error()
      })
    )
    return
  }

  const url = new URL(request.url)

  if (!SHELL_ASSETS.includes(url.pathname)) {
    // Next.js content-hashed chunks use the browser HTTP cache. Keeping them
    // out of Cache Storage prevents an old worker from pinning stale JS/CSS.
    return
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone()
          event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          )
        }

        return response
      })
      .catch(async () => (await caches.match(request)) ?? Response.error())
  )
})
