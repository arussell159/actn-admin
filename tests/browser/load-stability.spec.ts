import { test, expect, dashboard } from "./fixtures"

test.beforeEach(({}, info) => {
  if (!info.project.name.endsWith("-390")) test.skip()
})

test("cold startup stays stable with delayed fonts, scripts, images and API data", async ({
  page,
}, info) => {
  const delayed = { font: 0, script: 0, image: 0, api: 0 }
  await page.route("**/*", async (route) => {
    const type = route.request().resourceType()
    const url = route.request().url()
    if (type === "font") {
      delayed.font++
      await new Promise((resolve) => setTimeout(resolve, 2500))
    }
    if (type === "script") {
      delayed.script++
      await new Promise((resolve) => setTimeout(resolve, 1800))
    }
    if (type === "image") {
      delayed.image++
      await new Promise((resolve) => setTimeout(resolve, 2500))
    }
    if (url.includes("/api/")) {
      delayed.api++
      await new Promise((resolve) => setTimeout(resolve, 2200))
      return route.fulfill({ json: dashboard })
    }
    await route.fallback()
  })
  await page.addInitScript(() => {
    const w = window as unknown as { samples: number[][]; shellCLS: number }
    w.samples = []
    w.shellCLS = 0
    if (PerformanceObserver.supportedEntryTypes.includes("layout-shift"))
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {
            value: number
            sources?: { node?: Element }[]
          }
          if (
            shift.sources?.some(
              (s) =>
                s.node instanceof Element &&
                s.node.closest("[data-app-header],[data-app-nav]")
            )
          )
            w.shellCLS += shift.value
        }
      }).observe({ type: "layout-shift", buffered: true })
    const sample = () => {
      const header = document.querySelector("[data-app-header]"),
        nav = document.querySelector("[data-app-nav]")
      if (header && nav) {
        const h = header.getBoundingClientRect(),
          n = nav.getBoundingClientRect()
        if (h.height && n.height)
          w.samples.push([
            h.x,
            h.y,
            h.width,
            h.height,
            n.x,
            n.y,
            n.width,
            n.height,
          ])
      }
      requestAnimationFrame(sample)
    }
    sample()
  })
  await page.goto("/dashboard", { waitUntil: "commit" })
  await expect(page.locator("[data-app-header]")).toBeVisible()
  await expect(page.locator("[data-app-nav]")).toBeVisible()
  await page.screenshot({ path: info.outputPath("before-hydration.png") })
  await expect(
    page.locator("[data-app-route] [data-slot=skeleton]")
  ).toHaveCount(0)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: info.outputPath("after-delayed-assets.png") })
  const result = await page.evaluate(() => {
    const w = window as unknown as { samples: number[][]; shellCLS: number }
    return {
      samples: w.samples,
      shellCLS: w.shellCLS,
      font: getComputedStyle(document.body).fontFamily,
      preloads: document.querySelectorAll("link[rel=preload][as=font]").length,
    }
  })
  expect(result.preloads).toBe(1)
  expect(delayed.font).toBeGreaterThan(0)
  expect(delayed.script).toBeGreaterThan(0)
  expect(delayed.api).toBeGreaterThan(0)
  expect(result.samples.length).toBeGreaterThan(30)
  for (const sample of result.samples)
    expect(sample).toEqual([0, 0, 390, 40, 0, 762, 390, 66])
  expect(result.shellCLS).toBeLessThan(0.001)
  await info.attach("startup-metrics", {
    body: JSON.stringify(
      { ...result, samples: result.samples.length, delayed },
      null,
      2
    ),
    contentType: "application/json",
  })
})

test("a route render failure preserves chrome and offers a working retry", async ({
  page,
}) => {
  let fail = true
  await page.route("**/api/zoho-desk/dashboard?**", (route) =>
    route.fulfill({
      json: fail ? { ...dashboard, tickets: [null] } : dashboard,
    })
  )
  await page.goto("/dashboard")
  await expect(
    page.getByRole("heading", { name: "The app needs to recover" })
  ).toBeVisible()
  await expect(page.locator("[data-app-header]")).toBeVisible()
  await expect(page.locator("[data-app-nav]")).toBeVisible()
  fail = false
  await page.getByRole("button", { name: "Try again", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Open Tickets (28)" })
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "The app needs to recover" })
  ).not.toBeVisible()
})

test("stale-chunk recovery reloads once and preserves the deep route", async ({
  page,
}) => {
  await page.goto("/quote-tool?zone=ROW")
  await expect(page.locator("[data-app-header]")).toBeVisible()
  await page.evaluate(() =>
    window.dispatchEvent(
      new ErrorEvent("error", {
        error: new Error("ChunkLoadError: Loading chunk old failed"),
      })
    )
  )
  await expect(page).toHaveURL(/quote-tool\?zone=ROW&__pwa_recovery=\d+/)
  await expect(page.locator("[data-app-nav]")).toBeVisible()
  await expect(page.locator(".app-header-slot")).not.toBeEmpty()
  let navigations = 0
  const timeOrigin = await page.evaluate(() => performance.timeOrigin)
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame())
      navigations++
  })
  await page.evaluate(() => {
    window.dispatchEvent(
      new ErrorEvent("error", {
        error: new Error("ChunkLoadError: Loading chunk old failed"),
      })
    )
    window.dispatchEvent(
      new PromiseRejectionEvent("unhandledrejection", {
        promise: Promise.resolve(),
        reason: new Error("Failed to load chunk old"),
      })
    )
  })
  await page.waitForTimeout(750)
  expect(navigations).toBe(0)
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin)
  await expect(page.locator("[data-app-header]")).toBeVisible()
})

test("login and offline documents remain usable outside the workspace shell", async ({
  page,
}) => {
  await page.goto("/login")
  await expect(page.locator("[data-app-shell]")).toHaveCount(0)
  await expect(
    page.getByRole("textbox", { name: "Email", exact: true })
  ).toBeVisible()
  await page.setViewportSize({ width: 320, height: 300 })
  await page.locator("button[type=submit]").scrollIntoViewIfNeeded()
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(320)
  await page.goto("/offline.html")
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible()
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(320)
})
