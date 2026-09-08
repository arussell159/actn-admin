const CACHE_PREFIX = "actn-admin-"
const CACHE_NAME = "actn-admin-shell-v19"
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
      // A worker without a usable fallback must never replace a working one.
      const offline = await fetch(new URL(OFFLINE_URL, self.location.origin), {
        cache: "reload",
      })
      if (
        !offline.ok ||
        offline.redirected ||
        !offline.headers.get("content-type")?.includes("text/html")
      ) {
        throw new Error("Offline fallback unavailable")
      }
      await cache.put(
        new Request(new URL(OFFLINE_URL, self.location.origin)),
        offline
      )
      // One missing optional icon must not prevent the new worker installing.
      await Promise.allSettled(
        SHELL_ASSETS.filter((asset) => asset !== OFFLINE_URL).map((asset) =>
          cache.add(
            new Request(new URL(asset, self.location.origin), {
              cache: "reload",
            })
          )
        )
      )
      // Let existing tabs finish using their deployment. No forced activation.
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
      fetch(request, { cache: "no-store" }).catch(async () => {
        const offlineRequest = new Request(
          new URL(OFFLINE_URL, self.location.origin)
        )
        try {
          const cache = await caches.open(CACHE_NAME)
          const offline = await cache.match(offlineRequest)
          if (offline) return offline
        } catch {
          // Storage can be evicted or disabled on mobile. Still provide recovery.
        }
        return new Response(
          '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>You are offline</title><style>html{background:#fff;color:#111;font:16px system-ui}body{margin:0;padding: max(24px,env(safe-area-inset-top)) max(24px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(24px,env(safe-area-inset-left))}</style><h1>You are offline</h1><p>Reconnect, then reload this page to continue.</p><a href="">Try again</a>',
          {
            status: 503,
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "no-store",
            },
          }
        )
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
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, copy))
              .catch(() => undefined)
          )
        }

        return response
      })
      .catch(async () => {
        try {
          return (
            (await (await caches.open(CACHE_NAME)).match(request)) ??
            Response.error()
          )
        } catch {
          return Response.error()
        }
      })
  )
})
