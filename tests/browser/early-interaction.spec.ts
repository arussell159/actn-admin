import { test, expect } from "./fixtures"

test("saved template preferences hydrate without replacing the page", async ({
  page,
  context,
}) => {
  await page.goto("/template-builder")
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("africa-ctn-month-end-template"))
    )
    .not.toBeNull()
  await page.evaluate(() => {
    const key = "africa-ctn-month-end-template"
    const saved = JSON.parse(localStorage.getItem(key)!)
    saved.countriesModule.tab = "Saved countries"
    localStorage.setItem(key, JSON.stringify(saved))
  })
  await context.route("**/rest/v1/month_end_templates*", (route) =>
    route.fulfill({
      status: 503,
      json: { message: "Fixture: use the saved local template" },
    })
  )
  await page.close()
  const restored = await context.newPage()
  const errors: string[] = []
  restored.on("pageerror", (error) => errors.push(error.message))
  await restored.goto("/template-builder")
  await expect(
    restored.getByText("Saved countries", { exact: true }).first()
  ).toBeAttached()
  expect(errors).toEqual([])
})

test("visual-only keyboard resizing clears after focus loss and resume", async ({
  page,
}) => {
  await page.goto("/information?node=test-note-0")
  await page.locator("[contenteditable=true]").focus()
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, "height", {
      configurable: true,
      value: 480,
    })
    Object.defineProperty(window.visualViewport, "offsetTop", {
      configurable: true,
      value: 24,
    })
    window.visualViewport!.dispatchEvent(new Event("resize"))
  })
  await expect(page.locator("html")).toHaveAttribute(
    "data-app-keyboard",
    "true"
  )
  await expect(page.locator("[data-app-shell]")).toHaveCSS("height", "480px")
  await expect(page.locator("[data-app-shell]")).toHaveCSS("top", "24px")
  await page.evaluate(() => {
    ;(document.activeElement as HTMLElement).blur()
    delete (window.visualViewport as unknown as Record<string, unknown>).height
    delete (window.visualViewport as unknown as Record<string, unknown>)
      .offsetTop
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true })
    )
    document.dispatchEvent(new Event("visibilitychange"))
  })
  await expect(page.locator("html")).not.toHaveAttribute("data-app-keyboard")
  await expect(page.locator("[data-app-shell]")).toHaveCSS("height", "844px")
  await page.locator('a[href="/quote-tool"]:visible').first().click()
  await expect(page).toHaveURL(/quote-tool$/)
  await expect(page.locator("[data-app-header]")).toHaveCSS("height", "40px")
})

test("scrolling the server-rendered page before hydration is preserved", async ({
  page,
}) => {
  await page.route("**/*.js*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1800))
    await route.continue()
  })
  await page.goto("/template-builder", { waitUntil: "commit" })
  const scroller = page.locator("[data-app-scroll]")
  await expect(scroller).toBeVisible()
  await expect
    .poll(() => scroller.evaluate((el) => el.scrollHeight - el.clientHeight))
    .toBeGreaterThan(400)
  await scroller.evaluate((el) => (el.scrollTop = 400))
  await expect(page.locator(".app-header-slot")).not.toBeEmpty()
  await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBe(400)
})

test("menu can resize and customize, then release scroll and focus on navigation", async ({
  page,
  browserName,
}, info) => {
  await page.goto("/template-builder")
  await expect(page.locator(".app-header-slot")).not.toBeEmpty()
  const scroller = page.locator("[data-app-scroll]")
  await scroller.evaluate((el) => (el.scrollTop = 400))
  await page.getByRole("button", { name: "Open more navigation" }).click()
  await page.getByRole("button", { name: "Customize", exact: true }).click()
  await page.setViewportSize({ width: 390, height: 500 })
  const menu = page.locator("[data-app-menu]")
  await expect
    .poll(async () => {
      const b = await menu.boundingBox()
      return Math.abs(b!.y + b!.height - 500)
    })
    .toBeLessThan(1)
  await page.screenshot({
    path: info.outputPath("customize-small-viewport.png"),
  })
  await page.getByRole("button", { name: "Done", exact: true }).click()
  await page.locator('[data-app-menu] a[href="/previous-month-ends"]').click()
  await expect(page).toHaveURL(/previous-month-ends$/)
  await expect(menu).not.toBeVisible()
  await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBe(0)
  // Playwright's mobile WebKit does not implement wheel input. Check that the
  // real scroll owner is unlocked there; Chromium also exercises native wheel.
  await expect(scroller).toHaveCSS("overflow-y", "auto")
  await expect(page.locator("[data-app-shell]")).not.toHaveAttribute(
    "inert",
    ""
  )
  if (browserName === "webkit")
    await scroller.evaluate((el) => el.scrollBy(0, 500))
  else {
    await scroller.hover()
    await page.mouse.wheel(0, 500)
  }
  await expect
    .poll(() => scroller.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator("[data-app-header]")).toBeVisible()
})
