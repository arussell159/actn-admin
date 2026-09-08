import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import vm from "node:vm"
import ts from "typescript"
import { isStaleAssetError } from "../lib/recovery-policy.ts"

const source = await readFile(
  new URL("../lib/pwa-recovery.ts", import.meta.url),
  "utf8"
)
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText

function loadRecovery({
  online = true,
  storage = new Map(),
  href = "https://app.test/month-end/country?period=2026-08",
  storageAvailable = true,
} = {}) {
  const navigations = [],
    deleted = [],
    updated = [],
    unregistered = []
  const exports = {}
  const sandbox = {
    exports,
    URL,
    Date,
    console,
    require(name) {
      if (name.endsWith("browser-storage"))
        return {
          readBrowserStorage: (_kind, key) =>
            storageAvailable ? (storage.get(key) ?? null) : null,
          writeBrowserStorage: (_kind, key, value) => {
            if (storageAvailable) storage.set(key, value)
          },
        }
      return { isStaleAssetError }
    },
    window: {
      location: {
        href,
        origin: "https://app.test",
        replace: (url) => navigations.push(url),
        reload: () => navigations.push("reload"),
      },
      caches: {
        keys: async () => ["actn-admin-shell-v19", "unrelated-cache"],
        delete: async (key) => deleted.push(key),
      },
    },
    navigator: {
      onLine: online,
      serviceWorker: {
        getRegistrations: async () =>
          ["https://app.test/sw.js", "https://app.test/other/sw.js"].map(
            (scriptURL) => ({
              active: { scriptURL },
              update: async () => updated.push(scriptURL),
              unregister: async () => unregistered.push(scriptURL),
            })
          ),
      },
    },
  }
  vm.runInNewContext(compiled, sandbox)
  return { exports, navigations, deleted, updated, unregistered, storage }
}

test("simultaneous stale failures have one reload and preserve deep links", async () => {
  const app = loadRecovery()
  const result = await Promise.all([
    app.exports.recoverFromStaleAssets(),
    app.exports.recoverFromStaleAssets(),
  ])
  assert.deepEqual(result, [true, false])
  assert.equal(app.navigations.length, 1)
  const url = new URL(app.navigations[0])
  assert.equal(url.pathname, "/month-end/country")
  assert.equal(url.searchParams.get("period"), "2026-08")
  assert.ok(url.searchParams.get("__pwa_recovery"))
  assert.deepEqual(app.deleted, [])
})
test("the next document cannot repeat automatic recovery, including unavailable storage", async () => {
  const first = loadRecovery({ storageAvailable: false })
  await first.exports.recoverFromStaleAssets()
  const next = loadRecovery({
    storageAvailable: false,
    href: first.navigations[0],
  })
  assert.equal(await next.exports.recoverFromStaleAssets(), false)
  assert.deepEqual(next.navigations, [])
})
test("the per-tab budget survives navigation to another route", async () => {
  const first = loadRecovery()
  await first.exports.recoverFromStaleAssets()
  const next = loadRecovery({
    storage: first.storage,
    href: "https://app.test/quote-tool",
  })
  assert.equal(await next.exports.recoverFromStaleAssets(), false)
})
test("offline failure neither reloads nor deletes the working fallback", async () => {
  const app = loadRecovery({ online: false })
  assert.equal(await app.exports.recoverFromStaleAssets(), false)
  assert.equal(await app.exports.repairApplication(), false)
  assert.deepEqual(app.navigations, [])
  assert.deepEqual(app.deleted, [])
})
test("explicit repair touches only application caches and its own worker", async () => {
  const app = loadRecovery()
  assert.equal(await app.exports.repairApplication(), true)
  assert.deepEqual(app.deleted, ["actn-admin-shell-v19"])
  assert.deepEqual(app.unregistered, ["https://app.test/sw.js"])
  assert.deepEqual(app.navigations, ["reload"])
})
