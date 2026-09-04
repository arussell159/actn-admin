import assert from "node:assert/strict"
import test from "node:test"

import {
  fetchJsonWithTimeout,
  fetchWithTimeout,
  RequestTimeoutError,
} from "../lib/network.ts"

test("requests time out and abort their underlying fetch", async (context) => {
  const originalFetch = globalThis.fetch
  let wasAborted = false
  context.after(() => {
    globalThis.fetch = originalFetch
  })

  globalThis.fetch = (_input, init) =>
    new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => {
        wasAborted = true
        reject(new DOMException("Aborted", "AbortError"))
      })
    })

  await assert.rejects(
    fetchWithTimeout("https://example.test", {}, 5),
    RequestTimeoutError
  )
  assert.equal(wasAborted, true)
})

test("caller cancellation is preserved rather than reported as a timeout", async (context) => {
  const originalFetch = globalThis.fetch
  const controller = new AbortController()
  context.after(() => {
    globalThis.fetch = originalFetch
  })

  globalThis.fetch = (_input, init) =>
    new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => {
        reject(new DOMException("Aborted", "AbortError"))
      })
    })

  const request = fetchWithTimeout(
    "https://example.test",
    { signal: controller.signal },
    1_000
  )
  controller.abort()

  await assert.rejects(request, { name: "AbortError" })
})

test("JSON requests reject non-success responses", async (context) => {
  const originalFetch = globalThis.fetch
  context.after(() => {
    globalThis.fetch = originalFetch
  })
  globalThis.fetch = async () => new Response("Unavailable", { status: 503 })

  await assert.rejects(
    fetchJsonWithTimeout("https://example.test"),
    /status 503/
  )
})
