import { test, expect } from "./fixtures"
import type { Page } from "@playwright/test"

const routes = [
  "/dashboard",
  "/quote-tool",
  "/information",
  "/information?node=test-folder",
  "/month-end",
  "/month-end/new",
  "/previous-month-ends",
  "/previous-month-ends/view?period=2026-07",
  "/month-end/country?period=2026-08&country=angola&view=reconciliation",
  "/month-end/country?period=2026-08&country=angola&view=journal",
  "/month-end/country?period=2026-08&country=angola&view=dashboard",
  "/pricing-upload",
  "/template-builder",
]

async function geometry(page: Page) {
  return page.evaluate(() => {
    const rect = (selector: string) =>
      document.querySelector(selector)!.getBoundingClientRect().toJSON()
    const scroll = document.querySelector<HTMLElement>("[data-app-scroll]")!
    return {
      header: rect("[data-app-header]"),
      nav: rect("[data-app-nav]"),
      width: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      scrollWidth: scroll.scrollWidth,
      clientWidth: scroll.clientWidth,
      top: scroll.scrollTop,
      scrollHeight: scroll.scrollHeight,
      clientHeight: scroll.clientHeight,
    }
  })
}
async function shell(page: Page, mobile: boolean) {
  await expect(page.locator("[data-app-header]")).toBeVisible()
  await expect(page.locator(".app-header-slot")).not.toBeEmpty()
  await expect(page.locator("[data-app-shell]")).toHaveCount(1)
  await expect(page.locator("[data-app-scroll]")).toHaveCount(1)
  const g = await geometry(page)
  expect(g.header.y).toBe(mobile ? 0 : 8)
  expect(g.documentWidth).toBeLessThanOrEqual(g.width + 1)
  expect(g.scrollWidth).toBeLessThanOrEqual(g.clientWidth + 1)
  if (mobile) {
    await expect(page.locator("[data-app-nav]")).toBeVisible()
    expect(g.nav.height).toBe(66)
    expect(g.nav.y + g.nav.height).toBe(page.viewportSize()!.height - 16)
  }
  return g
}
async function menu(page: Page) {
  await page.getByRole("button", { name: "Open more navigation" }).click()
  const panel = page.locator("[data-app-menu]")
  await expect(panel).toBeVisible()
  await expect
    .poll(async () => {
      const box = await panel.boundingBox()
      return Math.abs(box!.y + box!.height - page.viewportSize()!.height)
    })
    .toBeLessThan(1)
  const box = await panel.boundingBox()
  expect(box!.x).toBe(0)
  expect(box!.width).toBe(page.viewportSize()!.width)
  await page.getByRole("button", { name: "Close", exact: true }).click()
  await expect(panel).not.toBeVisible()
}
async function endpoints(page: Page, mobile: boolean) {
  const scroller = page.locator("[data-app-scroll]")
  await scroller.evaluate((el) =>
    el.scrollTo({ top: el.scrollHeight, behavior: "instant" })
  )
  await expect
    .poll(() =>
      scroller.evaluate((el) =>
        Math.abs(el.scrollTop - (el.scrollHeight - el.clientHeight))
      )
    )
    .toBeLessThan(2)
  const end = await page.locator("[data-app-route]").evaluate((el) => {
    const rect = el.getBoundingClientRect()
    return rect.bottom - parseFloat(getComputedStyle(el).paddingBottom)
  })
  const g = await geometry(page)
  expect(end).toBeLessThanOrEqual(
    mobile ? g.nav.y - 15 : page.viewportSize()!.height - 8
  )
  if (g.scrollHeight > g.clientHeight) expect(g.top).toBeGreaterThan(0)
  await scroller.evaluate((el) => el.scrollTo({ top: 0, behavior: "instant" }))
  const top = await page.locator("[data-app-route]").boundingBox()
  expect(top!.y).toBeGreaterThanOrEqual(g.header.bottom - 1)
}

test("all important routes share chrome, scroll endpoints and menu anchoring", async ({
  context,
}, info) => {
  test.setTimeout(180_000)
  const errors: string[] = []
  for (const route of routes) {
    // Each URL is a cold document entry. Closing the finished tab also avoids
    // WebKit reporting cancelled prefetches as page errors on a later document.
    const page = await context.newPage()
    const mobile = page.viewportSize()!.width < 768
    page.on("pageerror", (error) => errors.push(`${route}: ${error.message}`))
    await page.goto(route)
    await expect(page.locator("[data-app-header]")).toBeVisible()
    await expect(
      page.locator('[data-app-route] [data-slot="skeleton"]')
    ).toHaveCount(0)
    await shell(page, mobile)
    if (route === "/quote-tool" || route.endsWith("view=dashboard")) {
      await page.screenshot({
        path: info.outputPath(
          route === "/quote-tool"
            ? "quote-top.png"
            : "country-dashboard-top.png"
        ),
      })
    }
    await endpoints(page, mobile)
    if (mobile) {
      await menu(page)
      await page
        .locator("[data-app-scroll]")
        .evaluate((el) => (el.scrollTop = el.scrollHeight / 2))
      await menu(page)
      await page
        .locator("[data-app-scroll]")
        .evaluate((el) => (el.scrollTop = el.scrollHeight))
      await menu(page)
    }
    if (route === "/template-builder")
      await page.screenshot({ path: info.outputPath("page-bottom.png") })
    expect(errors).toEqual([])
    page.removeAllListeners("pageerror")
    await page.close()
  }
  expect(errors).toEqual([])
})

test("30 client route transitions preserve the same chrome DOM and coordinates", async ({
  page,
}) => {
  test.setTimeout(180_000)
  const mobile = page.viewportSize()!.width < 768
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/dashboard")
  const initial = await shell(page, mobile)
  await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>
    w.originalHeader = document.querySelector("[data-app-header]")
    w.originalNav = document.querySelector("[data-app-nav]")
    w.shellSamples = []
    w.sampleShell = true
    const sample = () => {
      if (!w.sampleShell) return
      const h = document
        .querySelector("[data-app-header]")!
        .getBoundingClientRect()
      const n = document
        .querySelector("[data-app-nav]")!
        .getBoundingClientRect()
      ;(w.shellSamples as unknown[]).push([
        h.x,
        h.y,
        h.width,
        h.height,
        n.x,
        n.y,
        n.width,
        n.height,
      ])
      requestAnimationFrame(sample)
    }
    sample()
  })
  const targets = [
    "/quote-tool",
    "/information",
    "/dashboard",
    "/month-end",
    "/previous-month-ends",
  ]
  for (let i = 0; i < 30; i++) {
    const target = targets[i % targets.length]
    if (mobile && target === "/previous-month-ends")
      await page.getByRole("button", { name: "Open more navigation" }).click()
    const link = page.locator(`a[href="${target}"]:visible`).first()
    await link.click()
    await expect(page).toHaveURL(new RegExp(target + "$"))
    await expect(
      page.locator('[data-app-route] [data-slot="skeleton"]')
    ).toHaveCount(0)
    const current = await shell(page, mobile)
    expect(current.header.x).toBe(initial.header.x)
    expect(current.header.y).toBe(initial.header.y)
    expect(current.header.width).toBe(initial.header.width)
    expect(current.header.height).toBe(initial.header.height)
    if (mobile) expect(current.nav).toEqual(initial.nav)
    await expect
      .poll(() =>
        page.locator("[data-app-scroll]").evaluate((el) => el.scrollTop)
      )
      .toBe(0)
    await endpoints(page, mobile)
    if (mobile && i % 5 === 0) await menu(page)
  }
  const result = await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>
    w.sampleShell = false
    return {
      sameHeader:
        w.originalHeader === document.querySelector("[data-app-header]"),
      sameNav: w.originalNav === document.querySelector("[data-app-nav]"),
      samples: w.shellSamples as number[][],
    }
  })
  expect(result.sameHeader).toBe(true)
  expect(result.sameNav).toBe(true)
  if (mobile)
    for (const sample of result.samples)
      expect(sample).toEqual([
        0,
        0,
        initial.header.width,
        40,
        0,
        initial.nav.y,
        initial.nav.width,
        66,
      ])
  expect(errors).toEqual([])
})

test("viewport height, rotation, safe areas and keyboard-sized resizing recover", async ({
  page,
}, info) => {
  if (page.viewportSize()!.width >= 768) test.skip()
  await page.goto("/quote-tool")
  const original = page.viewportSize()!
  for (const size of [
    { width: original.width, height: original.height - 160 },
    { width: original.width, height: original.height + 80 },
    { width: 844, height: 390 },
    original,
  ]) {
    await page.setViewportSize(size)
    await shell(page, size.width < 768)
    await endpoints(page, size.width < 768)
    if (size.width < 768) await menu(page)
  }
  await page.addStyleTag({
    content:
      ":root {--safe-top:47px;--safe-bottom:34px;--safe-left:12px;--safe-right:12px} ",
  })
  let g = await geometry(page)
  expect(g.header.height).toBe(87)
  expect(g.nav.bottom).toBe(original.height - 50)
  await endpoints(page, true)
  await menu(page)
  await page.screenshot({ path: info.outputPath("safe-areas.png") })
  await page.goto("/information?node=test-note-0")
  await expect(page.locator("[contenteditable=true]")).toBeVisible()
  await page.locator("[contenteditable=true]").focus()
  await page.setViewportSize({
    width: original.width,
    height: Math.max(300, original.height - 300),
  })
  g = await shell(page, true)
  const editor = page.locator(".simple-editor-content")
  await editor.evaluate((el) => (el.scrollTop = el.scrollHeight))
  const last = await page.locator(".tiptap > :last-child").boundingBox()
  expect(last!.y + last!.height).toBeLessThan(g.nav.y)
  await page.setViewportSize(original)
  await shell(page, true)
  await page.getByRole("button", { name: "Open more navigation" }).click()
  await page.screenshot({ path: info.outputPath("menu-after-rotation.png") })
  await page.getByRole("button", { name: "Close", exact: true }).click()
  await page.locator('a[href="/quote-tool"]:visible').first().click()
  await expect(page).toHaveURL(/quote-tool$/)
  await endpoints(page, true)
})

test("back and forward restore useful prior scroll positions", async ({
  page,
}) => {
  await page.goto("/template-builder")
  await expect(page.locator(".app-header-slot")).not.toBeEmpty()
  await expect(
    page.locator('[data-app-route] [data-slot="skeleton"]')
  ).toHaveCount(0)
  const scroller = page.locator("[data-app-scroll]")
  await scroller.evaluate((el) => (el.scrollTop = 400))
  await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBe(400)
  await page.locator('a[href="/quote-tool"]:visible').first().click()
  await expect(page).toHaveURL(/quote-tool$/)
  await page.goBack()
  await expect(page).toHaveURL(/template-builder$/)
  await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBe(400)
  await page.goForward()
  await expect(page).toHaveURL(/quote-tool$/)
  await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBe(0)
})
