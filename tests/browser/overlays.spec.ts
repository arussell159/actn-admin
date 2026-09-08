import { test, expect } from "./fixtures"
import type { Page } from "@playwright/test"

async function keyboard(page: Page, height = 480) {
  await page.evaluate((height) => {
    Object.defineProperty(window.visualViewport, "height", {
      configurable: true,
      value: height,
    })
    Object.defineProperty(window.visualViewport, "offsetTop", {
      configurable: true,
      value: 24,
    })
    window.visualViewport!.dispatchEvent(new Event("resize"))
  }, height)
  await expect(page.locator("html")).toHaveAttribute(
    "data-app-keyboard",
    "true"
  )
}

async function dismissKeyboard(page: Page) {
  await page.evaluate(() => {
    delete (window.visualViewport as unknown as Record<string, unknown>).height
    delete (window.visualViewport as unknown as Record<string, unknown>)
      .offsetTop
    window.visualViewport!.dispatchEvent(new Event("resize"))
  })
  await expect(page.locator("html")).not.toHaveAttribute("data-app-keyboard")
}

test("global search stays fully above a visual-only keyboard", async ({
  page,
}, info) => {
  await page.goto("/quote-tool")
  await expect(page.locator(".app-header-slot")).not.toBeEmpty()
  await page.evaluate(() =>
    window.dispatchEvent(new Event("app-command-menu:open"))
  )
  await page.locator("[data-slot=command-input]").focus()
  await keyboard(page)
  const panel = page.locator("[data-slot=dialog-content]")
  await expect
    .poll(async () => {
      const box = (await panel.boundingBox())!
      return box.y >= 24 && box.y + box.height <= 504
    })
    .toBe(true)
  await page.screenshot({ path: info.outputPath("command-keyboard.png") })
  await page.keyboard.press("Escape")
  await expect(panel).not.toBeVisible()
  await dismissKeyboard(page)
})

test("notebook find panel fits between the header and dock with the keyboard", async ({
  page,
  browserName,
}, info) => {
  await page.goto("/information?node=test-note-0")
  await page.locator("[contenteditable=true]").focus()
  await page.keyboard.press(browserName === "webkit" ? "Meta+f" : "Control+f")
  const panel = page.getByRole("dialog", {
    name: "Search and replace",
    exact: true,
  })
  await expect(panel).toBeVisible()
  await panel.locator("input").first().focus()
  await keyboard(page)
  const header = (await page.locator("[data-app-header]").boundingBox())!
  const dock = (await page.locator("[data-app-nav]").boundingBox())!
  const box = (await panel.boundingBox())!
  expect(box.y).toBeGreaterThanOrEqual(header.y + header.height)
  expect(box.y + box.height).toBeLessThan(dock.y)
  await panel.evaluate((el) => (el.scrollTop = el.scrollHeight))
  await expect(
    panel.getByRole("button", { name: "Replace all results", exact: true })
  ).toBeInViewport()
  await page.screenshot({ path: info.outputPath("notebook-find-keyboard.png") })
})

test("folder prompt uses the root portal and releases focus when cancelled", async ({
  page,
}) => {
  await page.goto("/information?node=test-folder")
  await page
    .getByRole("button", { name: "Notebook actions", exact: true })
    .click()
  await page.getByRole("menuitem", { name: "Add Folder", exact: true }).click()
  const panel = page.getByRole("dialog", { name: "New Folder", exact: true })
  await expect(panel).toBeVisible()
  await page.getByRole("textbox", { name: "Folder title", exact: true }).focus()
  await keyboard(page)
  expect(
    await panel.evaluate((el) => Boolean(el.closest("[data-app-scroll]")))
  ).toBe(false)
  await expect(panel).toHaveCSS("height", "480px")
  await expect(panel).toHaveCSS("top", "24px")
  await page.getByRole("button", { name: "Cancel folder", exact: true }).click()
  await expect(panel).not.toBeVisible()
  await dismissKeyboard(page)
  await page.locator('a[href="/quote-tool"]:visible').first().click()
  await expect(page).toHaveURL(/quote-tool$/)
  await expect(page.locator("[data-app-scroll]")).toHaveCSS(
    "overflow-y",
    "auto"
  )
})
