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
  }
  const sandbox = {
    URL,
    Request,
    Response,
    Promise,
    fetch: fetchImpl ?? (async () => new Response("ok")),
    caches: {
      open: async () => cache,
      keys: async () => [
        "actn-admin-v2",
        "actn-admin-v17",
        "actn-admin-shell-v18",
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

  assert.deepEqual(worker.deletedCaches, ["actn-admin-v2", "actn-admin-v17"])
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

  assert.equal(worker.skippedWaiting, true)
})
