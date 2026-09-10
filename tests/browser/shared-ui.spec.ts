import { expect, test } from "@playwright/test"
import { mockLayoutData } from "./mobile-layout-fixtures"
import { createMadagascarLayout } from "../../lib/certificate-layout/seed"
import { createInitialPages } from "../../lib/okf/seed"

test.beforeEach(async ({ context, page }) => {
  await mockLayoutData(context)
  await page.route("**/api/okf/layouts", (route) =>
    route.fulfill({ json: { rows: [createMadagascarLayout()] } })
  )
  await page.route(/\/api\/okf$/, (route) =>
    route.fulfill({
      json: {
        ok: true,
        state: { generation: 0, pages: createInitialPages() },
        canPublish: true,
      },
    })
  )
})

test("shared page frame preserves route geometry, navigation and scroll clearance", async ({
  page,
  isMobile,
}) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  for (const route of [
    "/dashboard",
    "/month-end?period=2026-08",
    "/month-end/country?period=2026-08&country=benin&view=reconciliation",
    "/quote-tool",
    "/pricing-upload",
    "/previous-month-ends",
    "/month-end/new",
    "/template-builder",
    "/certificate-settings?country=madagascar",
    "/cargo-tracking-notes/requests",
    "/information?node=qa-note",
  ]) {
    await page.goto(route)
    await expect(page.locator('[data-slot="sidebar-wrapper"]')).toHaveCount(1)
    await expect(page.locator('[data-slot="sidebar-inset"]')).toBeVisible()
    await expect(page.locator("main")).toHaveCount(1)
    await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0)
    if (route === "/quote-tool") await page.keyboard.press("Escape")
    await expect
      .poll(
        () =>
          page.evaluate(
            () => document.documentElement.scrollWidth - innerWidth
          ),
        { message: route }
      )
      .toBeLessThanOrEqual(1)
    const inset = page.locator('[data-slot="sidebar-inset"]')
    if (isMobile) {
      const dock = page.getByRole("navigation", {
        name: "Mobile app navigation",
      })
      const before = await dock.boundingBox()
      await inset.evaluate((element) =>
        element.scrollTo(0, element.scrollHeight)
      )
      await expect
        .poll(async () => (await dock.boundingBox())?.y)
        .toBe(before!.y)
      await expect
        .poll(
          async () => (await page.locator("header:visible").boundingBox())?.y,
          { message: `${route}: header remains pinned` }
        )
        .toBe(0)
      const last = inset
        .locator("button:visible, input:visible, a:visible")
        .last()
      if (!route.includes("node=") && (await last.count())) {
        await expect
          .poll(
            async () => {
              await inset.evaluate((element) => {
                element.scrollTop = element.scrollHeight
              })
              const box = await last.boundingBox()
              return box!.y + box!.height - before!.y
            },
            { message: `${route}: final control clears dock` }
          )
          .toBeLessThanOrEqual(-8)
      }
    } else {
      const header = await page.locator("header:visible").boundingBox()
      const body = await inset.boundingBox()
      expect(header!.x).toBe(body!.x)
      expect(header!.width).toBe(body!.width)
      await page
        .getByRole("button", { name: "Toggle Sidebar", exact: true })
        .focus()
      await page.keyboard.press("Tab")
      expect(
        await page.evaluate(() => document.activeElement !== document.body)
      ).toBe(true)
    }
  }
  await page.goto("/month-end/new")
  await page.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(page).toHaveURL(/previous-month-ends/)
  expect(errors).toEqual([])
})

test("section tabs use manual keyboard activation and expose their content", async ({
  page,
  isMobile,
}) => {
  await page.goto("/month-end?period=2026-08")
  const dashboard = page.getByRole("tab", { name: "Dashboard", exact: true })
  const countries = page.getByRole("tab", { name: "Countries", exact: true })
  if (isMobile) await countries.tap()
  else {
    await dashboard.focus()
    await dashboard.press("ArrowRight")
    await expect(countries).toBeFocused()
    await expect(dashboard).toHaveAttribute("aria-selected", "true")
    await countries.press("Enter")
    await expect(countries).toHaveAttribute(
      "aria-controls",
      "month-end-section"
    )
  }
  await expect(countries).toHaveAttribute("aria-selected", "true")
  await expect(
    page.getByRole("link", { name: "Benin", exact: true })
  ).toBeVisible()
  await page.getByRole("link", { name: "Benin", exact: true }).click()
  await page
    .getByRole("button", { name: "Back to month end", exact: true })
    .filter({ visible: true })
    .click()
  await expect(countries).toHaveAttribute("aria-selected", "true")
})

test("country search supports keyboard selection, no results, Escape and multi-selection", async ({
  page,
  isMobile,
}) => {
  await page.goto("/quote-tool")
  const trigger = page
    .getByRole("button", { name: "Quote country", exact: true })
    .filter({ visible: true })
  if (isMobile) await trigger.tap()
  const search = page.getByRole("combobox", {
    name: "Search countries",
    exact: true,
  })
  await expect(search).toBeFocused()
  await search.fill("no such country")
  await expect(page.getByText("No countries found.")).toBeVisible()
  await search.fill("Madagascar")
  await search.press("Enter")
  await expect(trigger).toContainText("Madagascar")
  if (isMobile) await expect(trigger).toBeFocused()
  else
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.tagName))
      .toBe("TR")
  await trigger.press("Enter")
  await expect(search).toHaveValue("")
  await search.press("Escape")
  await expect(trigger).toBeFocused()

  await page.goto("/template-builder")
  await page.getByRole("button", { name: "Angola", exact: true }).click()
  const parent = page.getByRole("button", {
    name: "Parent country",
    exact: true,
  })
  await parent.click()
  const parentSearch = page.getByRole("combobox", {
    name: "Search parents",
    exact: true,
  })
  await parentSearch.fill("Foremost")
  await page.getByRole("option", { name: "Foremost", exact: true }).click()
  await expect(parent).toContainText("Foremost")
  const combined = page.getByRole("button", {
    name: "Combined countries",
    exact: true,
  })
  await combined.click()
  const countrySearch = page.getByRole("combobox", {
    name: "Search countries",
    exact: true,
  })
  await countrySearch.fill("Benin")
  await countrySearch.press("Enter")
  await expect(countrySearch).toBeVisible()
  await expect(
    page.getByRole("option", { name: "Benin selected", exact: true })
  ).toHaveAttribute("data-checked", "true")
  await countrySearch.press("Enter")
  await expect(
    page.getByRole("option", { name: "Benin", exact: true })
  ).toHaveAttribute("data-checked", "false")
  await countrySearch.press("Escape")
  await expect(combined).toBeFocused()
})

test("Notebook shared controls retain selection, formatting, shortcuts and menu focus", async ({
  page,
  isMobile,
}) => {
  await page.goto("/information?node=qa-note")
  const editor = page.locator('.tiptap[contenteditable="true"]:visible')
  await editor.locator("p").first().click()
  await editor
    .locator("p")
    .first()
    .evaluate((element) => {
      const range = document.createRange()
      range.setStart(element.firstChild!, 0)
      range.setEnd(element.firstChild!, 9)
      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)
    })
  const selected = await page.evaluate(() => window.getSelection()?.toString())
  expect(selected?.trim()).toBe("Paragraph")
  if (isMobile) {
    await page.keyboard.press("Control+b")
  } else {
    const bold = page.getByRole("button", { name: "Bold", exact: true })
    await bold.hover()
    await expect(page.locator('[data-slot="tooltip-content"]')).toContainText(
      "Bold"
    )
    await bold.click()
  }
  await expect(editor.locator("strong").first()).toHaveText(selected!)
  await expect(editor).toBeFocused()
  await page.keyboard.press("Control+z")
  await expect(editor.locator("strong")).toHaveCount(0)
  await page.keyboard.press("Control+Shift+z")
  await expect(editor.locator("strong").first()).toHaveText(selected!)
  if (!isMobile) {
    const heading = page.getByRole("button", { name: "Format text as heading" })
    await heading.click()
    await page.keyboard.press("Escape")
    await expect(heading).toBeFocused()
    await heading.click()
    await page.getByRole("menuitem", { name: "Heading 2", exact: true }).click()
    await expect(editor.locator("h2").first()).toContainText("Paragraph 1.")
    await page.getByRole("button", { name: "Link", exact: true }).click()
    await expect(page.getByPlaceholder(/Paste a link/)).toBeVisible()
    await page.keyboard.press("Escape")
  }
  await page.screenshot({
    path: `node_modules/.cache/shared-editor-${isMobile ? "mobile" : "desktop"}.png`,
  })
})

test("Accounting settings keeps its original section tabs and country form", async ({
  page,
  isMobile,
}) => {
  await page.goto("/template-builder")
  const tabs = page.getByRole("tablist", {
    name: "Settings sections",
    exact: true,
    includeHidden: true,
  })
  await expect(
    tabs.getByRole("tab", { name: "Countries", exact: true, includeHidden: true })
  ).toHaveCount(1)
  await expect(
    tabs.getByRole("tab", { name: "Tasks", exact: true, includeHidden: true })
  ).toHaveCount(1)
  await expect(
    tabs.getByRole("tab", { name: "NetSuite", exact: true, includeHidden: true })
  ).toHaveCount(1)
  await expect(
    page.getByRole("navigation", { name: "Settings", exact: true })
  ).toHaveCount(0)
  if (!isMobile) {
    await tabs.getByRole("tab", { name: "Tasks", exact: true }).click()
    await expect(
      tabs.getByRole("tab", { name: "Tasks", exact: true })
    ).toHaveAttribute("aria-selected", "true")
    await tabs.getByRole("tab", { name: "Countries", exact: true }).click()
  }
  await page.getByRole("button", { name: "Angola", exact: true }).click()
  const name = page.locator("#country-row-name")
  await name.fill("Angola draft")
  if (!isMobile) {
    await page
      .getByRole("tab", { name: "Report Mapping", exact: true })
      .press("Enter")
    await expect(name).toHaveCount(0)
    await page
      .getByRole("tab", { name: "Country Information", exact: true })
      .press("Enter")
  }
  await expect(name).toHaveValue("Angola draft")
})

test("Settings drag handles keep keyboard reordering", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile)
  await page.goto("/template-builder")
  const handles = page.getByRole("button", { name: /^Reorder / })
  const order = () =>
    handles.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("aria-label"))
    )
  await expect(handles.first()).toBeVisible()
  const before = await order()
  const start = before.indexOf("Reorder Benin")
  const handle = page.getByRole("button", {
    name: "Reorder Benin",
    exact: true,
  })
  await handle.focus()
  await handle.press("Space")
  await expect(handle).toHaveAttribute("aria-pressed", "true")
  await handle.press("ArrowDown")
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "over droppable area burkina-faso" })
  ).toBeVisible()
  await handle.press("Space")
  await expect.poll(order).not.toEqual(before)
  expect((await order()).indexOf("Reorder Benin")).toBe(start + 1)
})
