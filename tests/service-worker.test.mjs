import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import vm from "node:vm"

async function loadWorker({ fetchImpl, cacheMatch } = {}) {
  const listeners = new Map()
  const deletedCaches = []
  let claimed = false
  let skippedWaiting = false
  const source = await readFile(
    new URL("../public/sw.js", import.meta.url),
    "utf8"
  )
  const cache = {
    add: async () => undefined,
    put: async () => undefined,
    match: cacheMatch ?? (async () => undefined),
  }
  const sandbox = {
    URL,
    Request,
    Response,
    Promise,
    fetch:
      fetchImpl ??
      (async () =>
        new Response("ok", { headers: { "content-type": "text/html" } })),
    caches: {
      open: async () => cache,
      keys: async () => [
        "actn-admin-v2",
        "actn-admin-v17",
        "actn-admin-shell-v18",
        "actn-admin-shell-v19",
        "unrelated-cache",
      ],
      delete: async (key) => {
        deletedCaches.push(key)
        return true
      },
      match: cacheMatch ?? (async () => undefined),
    },
    self: {
      location: { origin: "https://app.test" },
      clients: {
        claim: async () => {
          claimed = true
        },
      },
      skipWaiting: async () => {
        skippedWaiting = true
      },
      addEventListener(type, listener) {
        listeners.set(type, listener)
      },
    },
  }

  vm.runInNewContext(source, sandbox)
  return {
    listeners,
    cache,
    deletedCaches,
    get claimed() {
      return claimed
    },
    get skippedWaiting() {
      return skippedWaiting
    },
  }
}

test("Next.js chunks are never pinned in Cache Storage", async () => {
  const worker = await loadWorker()
  let responsePromise

  worker.listeners.get("fetch")({
    request: {
      method: "GET",
      mode: "cors",
      url: "https://app.test/_next/static/chunks/app.js",
    },
    respondWith(value) {
      responsePromise = value
    },
  })

  assert.equal(responsePromise, undefined)
})

test("offline navigation receives the dedicated recovery page", async () => {
  const offlineResponse = new Response("offline")
  const worker = await loadWorker({
    fetchImpl: async () => {
      throw new TypeError("offline")
    },
    cacheMatch: async (request) =>
      request.url === "https://app.test/offline.html"
        ? offlineResponse
        : undefined,
  })
  let responsePromise

  worker.listeners.get("fetch")({
    request: {
      method: "GET",
      mode: "navigate",
      url: "https://app.test/dashboard",
    },
    respondWith(value) {
      responsePromise = value
    },
  })

  assert.equal(await responsePromise, offlineResponse)
})

test("activation removes only obsolete app caches and claims clients", async () => {
  const worker = await loadWorker()
  let activation

  worker.listeners.get("activate")({
    waitUntil(value) {
      activation = value
    },
  })
  await activation

  assert.deepEqual(worker.deletedCaches, [
    "actn-admin-v2",
    "actn-admin-v17",
    "actn-admin-shell-v18",
  ])
  assert.equal(worker.claimed, true)
})

test("one missing shell asset cannot block service worker installation", async () => {
  const worker = await loadWorker()
  let additions = 0
  worker.cache.add = async () => {
    additions += 1
    if (additions === 1) throw new Error("missing optional asset")
  }
  let installation

  worker.listeners.get("install")({
    waitUntil(value) {
      installation = value
    },
  })
  await installation

  assert.equal(worker.skippedWaiting, false)
})

test("missing critical offline HTML rejects installation and keeps the active worker", async () => {
  const worker = await loadWorker({
    fetchImpl: async () => new Response("missing", { status: 404 }),
  })
  let installation
  worker.listeners.get("install")({
    waitUntil(value) {
      installation = value
    },
  })
  await assert.rejects(installation, /Offline fallback unavailable/)
  assert.equal(worker.skippedWaiting, false)
})

test("missing cache storage still returns a usable offline response", async () => {
  const worker = await loadWorker({
    fetchImpl: async () => {
      throw new TypeError("offline")
    },
  })
  let response
  worker.listeners.get("fetch")({
    request: {
      method: "GET",
      mode: "navigate",
      url: "https://app.test/deep/route",
    },
    respondWith(value) {
      response = value
    },
  })
  const result = await response
  assert.equal(result.status, 503)
  assert.match(await result.text(), /Reconnect/)
})

test("online navigation bypasses HTTP caches and never writes HTML to Cache Storage", async () => {
  let options,
    puts = 0,
    response
  const worker = await loadWorker({
    fetchImpl: async (_request, init) => {
      options = init
      return new Response("fresh HTML")
    },
  })
  worker.cache.put = async () => {
    puts++
  }
  worker.listeners.get("fetch")({
    request: {
      method: "GET",
      mode: "navigate",
      url: "https://app.test/month-end/country",
    },
    respondWith(value) {
      response = value
    },
  })
  assert.equal(await (await response).text(), "fresh HTML")
  assert.equal(options.cache, "no-store")
  assert.equal(puts, 0)
})

test("RSC, API, cross-origin requests and writes are not intercepted", async () => {
  const worker = await loadWorker()
  for (const request of [
    { method: "GET", url: "https://app.test/dashboard?_rsc=123" },
    { method: "GET", url: "https://app.test/api/data" },
    { method: "GET", url: "https://other.test/manifest.webmanifest" },
    { method: "POST", url: "https://app.test/api/data" },
  ])
    worker.listeners.get("fetch")({
      request,
      respondWith() {
        assert.fail("Unexpected cache interception")
      },
    })
})

test("worker ignores forced activation messages", async () => {
  const worker = await loadWorker()
  worker.listeners.get("message")({
    data: { type: "SKIP_WAITING" },
    waitUntil() {
      assert.fail("Forced activation")
    },
  })
  assert.equal(worker.skippedWaiting, false)
})
