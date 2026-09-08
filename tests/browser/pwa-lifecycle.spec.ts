import { test, expect } from "@playwright/test"
import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { installFixtures } from "./fixtures"

test("old to new worker waits for all clients, cleans caches and recovers deep links offline", async ({
  browser,
}, info) => {
  if (info.project.name !== "chromium-390") test.skip()
  const source = await readFile("public/sw.js", "utf8")
  const offline = await readFile("public/offline.html", "utf8")
  let version = 1
  const server = createServer((req, res) => {
    res.setHeader("Cache-Control", "no-store")
    if (req.url === "/sw.js") {
      res.setHeader("Content-Type", "application/javascript")
      // The old cache version uses the same network-only navigation contract.
      res.end(
        version === 1 ? source.replaceAll("shell-v19", "shell-v18") : source
      )
    } else if (req.url === "/offline.html") {
      res.setHeader("Content-Type", "text/html")
      res.end(offline)
    } else if (req.url?.includes(".png")) {
      res.statusCode = 404
      res.end("Optional icon missing")
    } else if (req.url === "/manifest.webmanifest") {
      res.setHeader("Content-Type", "application/manifest+json")
      res.end("{}")
    } else {
      res.setHeader("Content-Type", "text/html")
      res.end(
        `<!doctype html><title>Deployment ${version}</title><h1>Deployment ${version}</h1><input aria-label="Draft"><script>navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'})</script>`
      )
    }
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address() as { port: number }
  const origin = `http://127.0.0.1:${address.port}`
  const context = await browser.newContext({ serviceWorkers: "allow" })
  try {
    const first = await context.newPage()
    await first.goto(origin + "/deep/route")
    await first.evaluate(() => navigator.serviceWorker.ready)
    await expect
      .poll(() => first.evaluate(() => !!navigator.serviceWorker.controller))
      .toBe(true)
    const second = await context.newPage()
    await second.goto(origin + "/another/route")
    await first
      .getByRole("textbox", { name: "Draft" })
      .fill("Keep this unsaved draft")
    await first.evaluate(async () => {
      await caches.open("unrelated-cache")
    })
    version = 2
    await first.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration()
      await reg!.update()
    })
    await expect
      .poll(() =>
        first.evaluate(
          async () =>
            !!(await navigator.serviceWorker.getRegistration())?.waiting
        )
      )
      .toBe(true)
    await expect(first).toHaveTitle("Deployment 1")
    await expect(first.getByRole("textbox", { name: "Draft" })).toHaveValue(
      "Keep this unsaved draft"
    )
    expect(await first.evaluate(() => caches.keys())).toEqual(
      expect.arrayContaining([
        "actn-admin-shell-v18",
        "actn-admin-shell-v19",
        "unrelated-cache",
      ])
    )
    await first.close()
    expect(
      await second.evaluate(
        async () => !!(await navigator.serviceWorker.getRegistration())?.waiting
      )
    ).toBe(true)
    await second.close()
    const fresh = await context.newPage()
    await fresh.goto(origin + "/deep/route")
    await expect(fresh).toHaveTitle("Deployment 2")
    await expect
      .poll(() =>
        fresh.evaluate(
          async () => !(await caches.keys()).includes("actn-admin-shell-v18")
        )
      )
      .toBe(true)
    expect(await fresh.evaluate(() => caches.keys())).toEqual(
      expect.arrayContaining(["actn-admin-shell-v19", "unrelated-cache"])
    )
    await context.setOffline(true)
    await fresh.goto(origin + "/deep/route?period=2026-08")
    await expect(fresh.getByRole("heading", { name: /offline/ })).toBeVisible()
    await context.setOffline(false)
    await fresh.getByRole("button", { name: "Try again" }).click()
    await expect(fresh).toHaveTitle("Deployment 2")
    await expect(fresh).toHaveURL(origin + "/deep/route?period=2026-08")
    // Simulate storage eviction/legacy cleanup while offline.
    await fresh.evaluate(async () => {
      await caches.delete("actn-admin-shell-v19")
    })
    await context.setOffline(true)
    await fresh.goto(origin + "/deep/route")
    await expect(
      fresh.getByRole("heading", { name: "You are offline" })
    ).toBeVisible()
  } finally {
    await context.close()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})

test("production shell headers and immutable hashed assets have distinct cache policies", async ({
  page,
  request,
}, info) => {
  if (info.project.name !== "chromium-390") test.skip()
  const worker = await request.get("/sw.js")
  expect(worker.headers()["cache-control"]).toContain("no-store")
  await installFixtures(page.context())
  const response = await page.goto("/quote-tool")
  expect(response!.headers()["cache-control"]).toMatch(
    /no-store|no-cache|max-age=0/
  )
  const asset = await page
    .locator('script[src*="/_next/static/"]')
    .first()
    .getAttribute("src")
  const chunk = await request.get(asset!)
  expect(chunk.headers()["cache-control"]).toContain("immutable")
  const manifest = await (await request.get("/manifest.webmanifest")).json()
  expect(manifest.display).toBe("standalone")
  expect(manifest.orientation).toBe("any")
  expect(manifest.background_color).toBe("#ffffff")
})
