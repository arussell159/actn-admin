import assert from "node:assert/strict"
import test from "node:test"

import {
  readBrowserStorage,
  readJsonBrowserStorage,
  removeBrowserStorage,
  writeBrowserStorage,
} from "../lib/browser-storage.ts"

function createStorage({ throws = false } = {}) {
  const values = new Map()

  return {
    getItem(key) {
      if (throws) throw new Error("storage unavailable")
      return values.get(key) ?? null
    },
    setItem(key, value) {
      if (throws) throw new Error("quota exceeded")
      values.set(key, String(value))
    },
    removeItem(key) {
      if (throws) throw new Error("storage unavailable")
      values.delete(key)
    },
  }
}

test("storage helpers survive unavailable Safari-style storage", () => {
  globalThis.window = {
    localStorage: createStorage({ throws: true }),
    sessionStorage: createStorage({ throws: true }),
  }

  assert.equal(readBrowserStorage("localStorage", "value"), null)
  assert.equal(writeBrowserStorage("localStorage", "value", "1"), false)
  assert.doesNotThrow(() => removeBrowserStorage("sessionStorage", "value"))
})

test("malformed persisted JSON is removed without touching other values", () => {
  const localStorage = createStorage()
  globalThis.window = { localStorage, sessionStorage: createStorage() }
  localStorage.setItem("broken", "{not-json")
  localStorage.setItem("keep", "important")

  const result = readJsonBrowserStorage({
    kind: "localStorage",
    key: "broken",
    fallback: [],
    validate: Array.isArray,
  })

  assert.deepEqual(result, [])
  assert.equal(localStorage.getItem("broken"), null)
  assert.equal(localStorage.getItem("keep"), "important")
})

test("schema-invalid persisted JSON is isolated and removed", () => {
  const localStorage = createStorage()
  globalThis.window = { localStorage, sessionStorage: createStorage() }
  localStorage.setItem("state", JSON.stringify({ oldSchema: true }))

  const result = readJsonBrowserStorage({
    kind: "localStorage",
    key: "state",
    fallback: ["default"],
    validate: Array.isArray,
  })

  assert.deepEqual(result, ["default"])
  assert.equal(localStorage.getItem("state"), null)
})
