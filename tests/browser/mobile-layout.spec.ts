import { expect, test, type Page } from "@playwright/test"
import { mockLayoutData } from "./mobile-layout-fixtures"

test.beforeEach(async ({ context }) => mockLayoutData(context))

const routes = [
  "/dashboard",
  "/month-end?period=2026-08",
  "/month-end/country?period=2026-08&country=benin&view=dashboard",
  "/month-end/country?period=2026-08&country=benin&view=reconciliation",
  "/month-end/country?period=2026-08&country=benin&view=journal",
  "/information?view=folders",
  "/information?node=qa-note",
  "/previous-month-ends",
  "/month-end/new",
  "/quote-tool",
  "/pricing-upload",
  "/template-builder",
]
const dock = (page: Page) =>
  page.getByRole("navigation", { name: "Mobile app navigation" })

async function geometry(page: Page) {
  return page.evaluate(() => {
    const rect = (element: Element | null) => {
      const r = element?.getBoundingClientRect()
      return r
        ? { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom }
        : null
    }
    const header = [...document.querySelectorAll("header")].find(
      (e) => e.getBoundingClientRect().height > 0
    )
    const nav = document.querySelector(
      'nav[aria-label="Mobile app navigation"]'
    )
    return {
      header: rect(header ?? null),
      nav: rect(nav),
      width: innerWidth,
      height: innerHeight,
      overflow: document.documentElement.scrollWidth - innerWidth,
    }
  })
}

test("major routes keep header, dock and final content reachable", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile)
  const measurements = []
  for (const route of routes) {
    await page.goto(route)
    await expect(dock(page)).toBeVisible()
    await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0)
    await page.locator('[data-slot="sidebar-inset"]').waitFor()
    await expect(page.locator("main")).toHaveCount(1)
    const before = await geometry(page)
    await page.evaluate(() =>
      document
        .querySelector<HTMLElement>('[data-slot="sidebar-inset"]')
        ?.scrollTo(0, 100000)
    )
    await page.waitForTimeout(80)
    const after = await geometry(page)
    measurements.push({ route, before, after })
    expect.soft(before.header?.y, `${route}: header top`).toBe(0)
    expect.soft(before.header?.height, `${route}: header height`).toBe(40)
    const actions = await page
      .locator(
        "header:visible button:visible:has(svg), header:visible a:visible:has(svg)"
      )
      .evaluateAll((elements) =>
        elements.map((element) => {
          const box = element.getBoundingClientRect()
          const style = getComputedStyle(element)
          return {
            width: box.width,
            height: box.height,
            padding: style.padding,
            icon: element.querySelector("svg")?.getBoundingClientRect().width,
          }
        })
      )
    for (const action of actions) {
      expect.soft(action, `${route}: standard header action`).toMatchObject({
        width: 40,
        height: 40,
        padding: "0px",
      })
      expect
        .soft(action.icon, `${route}: header icon remains within touch target`)
        .toBeGreaterThanOrEqual(16)
      expect
        .soft(action.icon, `${route}: header icon remains within touch target`)
        .toBeLessThanOrEqual(24)
    }
    expect.soft(after.header?.y, `${route}: header after scroll`).toBe(0)
    expect
      .soft(after.nav?.bottom, `${route}: dock bottom`)
      .toBe(before.height - 16)
    expect
      .soft(after.nav, `${route}: dock unchanged by scrolling`)
      .toEqual(before.nav)
    expect
      .soft(after.overflow, `${route}: horizontal overflow`)
      .toBeLessThanOrEqual(1)
    const last = page
      .locator(
        '[data-slot="sidebar-inset"] button:visible, [data-slot="sidebar-inset"] input:visible, [data-slot="sidebar-inset"] a:visible'
      )
      .last()
    if ((await last.count()) && !route.includes("node=qa-note")) {
      await expect
        .poll(
          async () => {
            await page
              .locator('[data-slot="sidebar-inset"]')
              .evaluate((element) => {
                element.scrollTop = element.scrollHeight
              })
            await page.waitForTimeout(80)
            const box = await last.boundingBox()
            const navBox = await dock(page).boundingBox()
            return box && navBox ? box.y + box.height - navBox.y : Infinity
          },
          { message: `${route}: final action above dock` }
        )
        .toBeLessThanOrEqual(-8)
    }
    await dock(page).getByRole("button", { name: "Open more navigation" }).tap()
    await expect(
      page.getByRole("heading", { name: "More Settings" })
    ).toBeVisible()
    await page.getByRole("button", { name: "Close", exact: true }).tap()
  }
  await test.info().attach("route-geometry", {
    body: JSON.stringify(measurements),
    contentType: "application/json",
  })
})

test("desktop new folder exposes a focused name entry", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile)
  await page.goto("/information?view=folders")
  await page
    .getByRole("button", { name: "Create new folder", exact: true })
    .click()
  await expect(
    page.getByRole("textbox", { name: "Folder title" })
  ).toBeVisible()
  await expect
    .poll(() =>
      page
        .locator("input:visible")
        .evaluateAll((inputs) =>
          inputs.some(
            (input) =>
              input === document.activeElement &&
              !(input as HTMLInputElement).placeholder.includes("Search")
          )
        )
    )
    .toBe(true)
  const folderTitle = page.getByRole("textbox", { name: "Folder title" })
  await folderTitle.fill("Desktop named folder")
  await page.waitForTimeout(800)
  await expect(folderTitle).toBeFocused()
  await expect(folderTitle).toHaveValue("Desktop named folder")
  await page.keyboard.press("Enter")
  await expect(
    page.getByRole("button", { name: "Desktop named folder", exact: true })
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Create new folder", exact: true })
    .click()
  await page
    .getByRole("textbox", { name: "Folder title" })
    .fill("Nested desktop folder")
  await page.keyboard.press("Enter")
  await expect(
    page.getByRole("button", { name: "Nested desktop folder", exact: true })
  ).toBeVisible()
  await page
    .getByRole("button", {
      name: "Actions for Desktop named folder",
      exact: true,
    })
    .click()
  await page.getByRole("menuitem", { name: "Rename Folder" }).click()
  await page
    .getByRole("textbox", { name: "Folder title" })
    .fill("Renamed desktop folder")
  await page.keyboard.press("Enter")
  await expect(
    page
      .getByRole("complementary")
      .getByRole("button", { name: "Renamed desktop folder", exact: true })
  ).toBeVisible()
})

for (const selectedNode of ["qa-folder", "qa-note"]) {
  test(`desktop folder deletion stays immediate while the server still returns old rows (${selectedNode})`, async ({
    page,
    context,
    isMobile,
  }) => {
    test.skip(isMobile)
    let releaseDelete!: () => void
    let startedDelete!: () => void
    const deletionHeld = new Promise<void>((resolve) => {
      releaseDelete = resolve
    })
    const deletionStarted = new Promise<void>((resolve) => {
      startedDelete = resolve
    })
    await context.route(
      /\/rest\/v1\/information_notes(?:\?|$)/,
      async (route) => {
        if (route.request().method() === "DELETE") {
          startedDelete()
          await deletionHeld
        }
        await route.fallback()
      }
    )
    try {
      await page.goto(`/information?node=${selectedNode}`)
      const tree = page.locator(".notebook-tree")
      const folder = tree.getByRole("button", {
        name: "Test folder",
        exact: true,
      })
      await expect(folder).toBeVisible()
      await tree
        .getByRole("button", { name: "Actions for Test folder", exact: true })
        .click()
      await page.getByRole("menuitem", { name: "Delete", exact: true }).click()
      await deletionStarted
      const staleRead = page.waitForResponse(
        (response) =>
          response.url().includes("/rest/v1/information_notes?") &&
          response.request().method() === "GET"
      )
      await page.evaluate(() =>
        window.dispatchEvent(new Event("information-notes:updated"))
      )
      await staleRead
      await page.waitForTimeout(200)
      await expect(folder).not.toBeVisible()
      await expect(
        tree.getByRole("button", { name: "Long test note", exact: true })
      ).not.toBeVisible()
      releaseDelete()
      await tree.getByRole("button", { name: /^Trash/ }).click()
      await expect(
        page.getByRole("paragraph").filter({ hasText: /^Test folder$/ })
      ).toBeVisible()
      await page.getByRole("button", { name: "Restore", exact: true }).click()
      await expect(folder).toBeVisible()
      await expect(
        tree.getByRole("button", { name: "Long test note", exact: true })
      ).toBeVisible()
    } finally {
      releaseDelete()
    }
  })
}

test("mobile folder title, save and cancel work with standard header buttons", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile)
  await page.goto("/information?view=folders")
  await page.getByRole("button", { name: "Notebook actions" }).tap()
  await page.getByRole("menuitem", { name: "Add Folder", exact: true }).tap()
  await expect(
    page.getByRole("textbox", { name: "Folder title" })
  ).toBeFocused()
  const save = page.getByRole("button", { name: "Create folder", exact: true })
  const cancel = page.getByRole("button", {
    name: "Cancel folder",
    exact: true,
  })
  await expect(save).toBeDisabled()
  for (const button of [save, cancel]) {
    const box = await button.boundingBox()
    expect.soft(box?.width).toBe(40)
    expect.soft(box?.height).toBe(40)
  }
  await page
    .getByRole("textbox", { name: "Folder title" })
    .fill("Mobile named folder")
  await save.tap()
  await expect(page.getByRole("textbox", { name: "Folder title" })).toHaveCount(
    0
  )
  await expect(
    page
      .getByText("Mobile named folder", { exact: true })
      .filter({ visible: true })
      .first()
  ).toBeVisible()
  await page.getByRole("button", { name: "Notebook actions" }).tap()
  await page.getByRole("menuitem", { name: "Rename Folder" }).tap()
  const renameTitle = page.getByRole("textbox", { name: "Folder title" })
  await expect(renameTitle).toHaveValue("Mobile named folder")
  await renameTitle.fill("Renamed mobile folder")
  await page.getByRole("button", { name: "Save folder name" }).tap()
  await expect(
    page
      .getByText("Renamed mobile folder", { exact: true })
      .filter({ visible: true })
      .first()
  ).toBeVisible()
  await page.getByRole("button", { name: "Notebook actions" }).tap()
  await page.getByRole("menuitem", { name: "Add Folder", exact: true }).tap()
  await cancel.tap()
  await expect(page.getByRole("textbox", { name: "Folder title" })).toHaveCount(
    0
  )
})

test("Notes caret remains visible when the keyboard opens and typing continues", async ({
  page,
  isMobile,
  context,
}) => {
  test.skip(!isMobile)
  await context.addInitScript(() => {
    let keyboardHeight: number | undefined
    Object.defineProperty(window.visualViewport, "height", {
      get: () => keyboardHeight ?? innerHeight,
      configurable: true,
    })
    Object.assign(window, {
      setKeyboardHeight: (height: number) => {
        keyboardHeight = height
        window.visualViewport?.dispatchEvent(new Event("resize"))
      },
    })
  })
  await page.goto("/information?node=qa-note")
  const editor = page.locator('.tiptap[contenteditable="true"]:visible')
  await editor.tap()
  await expect(editor).toBeFocused()
  await page.keyboard.press("Control+End")
  await page.keyboard.type(" Before keyboard")
  await page.evaluate(() =>
    (
      window as unknown as { setKeyboardHeight: (height: number) => void }
    ).setKeyboardHeight(Math.max(280, innerHeight - 320))
  )
  await page.waitForTimeout(100)
  await expect(dock(page)).toHaveCount(0)
  const caret = () =>
    page.evaluate(() => {
      const selection = getSelection()
      if (!selection?.rangeCount) return null
      const range = selection.getRangeAt(0).cloneRange()
      if (
        range.startContainer.nodeType === Node.TEXT_NODE &&
        range.startOffset > 0
      )
        range.setStart(range.startContainer, range.startOffset - 1)
      const r = range.getBoundingClientRect()
      return {
        top: r.top,
        bottom: r.bottom,
        viewportBottom:
          (visualViewport?.offsetTop ?? 0) +
          (visualViewport?.height ?? innerHeight),
      }
    })
  const opened = await caret()
  expect
    .soft(opened?.bottom, "caret visible as keyboard opens")
    .toBeLessThanOrEqual((opened?.viewportBottom ?? 0) - 8)
  await page.keyboard.type(" and typing with keyboard")
  const typed = await caret()
  expect
    .soft(typed?.bottom, "caret visible while typing")
    .toBeLessThanOrEqual((typed?.viewportBottom ?? 0) - 8)
  expect.soft(typed?.top, "caret below header").toBeGreaterThanOrEqual(40)
  await expect(editor).toContainText("and typing with keyboard")
  await page.keyboard.press("Enter")
  await page.evaluate(() =>
    (
      window as unknown as { setKeyboardHeight: (height: number) => void }
    ).setKeyboardHeight(Math.max(240, innerHeight - 380))
  )
  await page.waitForTimeout(100)
  await page.keyboard.type("Typing on a new line")
  expect(
    (await caret())?.bottom,
    "new-line caret above keyboard"
  ).toBeLessThanOrEqual((await caret())!.viewportBottom - 8)
  await page.evaluate(() =>
    (
      window as unknown as { setKeyboardHeight: (height: number) => void }
    ).setKeyboardHeight(innerHeight)
  )
  await expect(dock(page)).toBeVisible()
  await page.locator(".simple-editor-content:visible").evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  const lastParagraph = await editor.locator("p").last().boundingBox()
  const dockBox = await dock(page).boundingBox()
  expect(
    lastParagraph!.y + lastParagraph!.height,
    "final note above dock"
  ).toBeLessThanOrEqual(dockBox!.y - 8)
})

test("Notes task lists render on desktop and stay hidden from mobile controls", async ({
  page,
  isMobile,
}) => {
  await page.goto("/information?node=qa-note")

  if (isMobile) {
    await expect(page.getByRole("button", { name: "Task List" })).toHaveCount(0)
    return
  }

  const editor = page.locator('.tiptap[contenteditable="true"]:visible')
  await editor.locator("p").last().click()
  await page.keyboard.press("End")
  await page.keyboard.press("Enter")
  await page.keyboard.type("Checkable note task")
  await page.getByRole("button", { name: "List options" }).click()
  await page.getByRole("menuitem", { name: "Task List" }).click()

  const taskItem = editor.locator('ul[data-type="taskList"] > li').last()
  await expect(taskItem).toContainText("Checkable note task")
  await expect(taskItem.locator('input[type="checkbox"]')).toBeAttached()
  const checkmark = taskItem.locator("label span")
  await expect(checkmark).toHaveCSS("cursor", "pointer")
  await taskItem.evaluate((element) =>
    element.scrollIntoView({ block: "center", inline: "nearest" })
  )
  await taskItem.locator("label").click()
  await expect(taskItem).toHaveAttribute("data-checked", "true")
})

test("Month end header stays pinned when returning from a country", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile)
  await page.goto(
    "/month-end/country?period=2026-08&country=benin&view=dashboard"
  )
  await expect(
    page.getByRole("button", { name: "Back to month end" })
  ).toBeVisible()
  const countryScrollTop = await page.evaluate(() => {
    sessionStorage.setItem(
      "month-end:return-point",
      JSON.stringify({
        period: "2026-08",
        countryId: "benin",
        activeSection: "countries",
        countrySearchQuery: "",
        countryTableFilter: "all",
        scrollY: 320,
      })
    )
    const inset = document.querySelector<HTMLElement>(
      '[data-slot="sidebar-inset"]'
    )
    inset?.scrollTo({ top: inset.scrollHeight, behavior: "instant" })
    return inset?.scrollTop ?? 0
  })
  expect(countryScrollTop).toBeGreaterThan(0)

  await page.getByRole("button", { name: "Back to month end" }).tap()
  await expect(page).toHaveURL(/\/month-end(?:\?|$)/)
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0)

  const position = await page.evaluate(() => {
    const header = [...document.querySelectorAll("header")].find(
      (element) => element.getBoundingClientRect().height > 0
    )
    const inset = document.querySelector<HTMLElement>(
      '[data-slot="sidebar-inset"]'
    )

    return {
      headerTop: header?.getBoundingClientRect().top,
      insetScrollTop: inset?.scrollTop,
      windowScrollY: window.scrollY,
      documentScrollTop: document.scrollingElement?.scrollTop,
    }
  })

  expect(position.headerTop).toBe(0)
  expect(position.insetScrollTop).toBeGreaterThan(0)
  expect(position.windowScrollY).toBe(0)
  expect(position.documentScrollTop).toBe(0)
})

test("Dashboard task detail edits tasks without reordering them", async ({
  page,
}) => {
  await page.goto("/month-end")
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0)
  await page.getByRole("button", { name: /^Tasks:/ }).click()

  const visibleGroups = page.locator("[data-task-group]:visible")
  await expect(visibleGroups.first()).toHaveAttribute(
    "data-task-group",
    "bank-reconciliation"
  )

  const chaseInk = page.getByRole("checkbox", { name: "Chase Ink" })
  await expect(chaseInk).toBeEnabled()
  await chaseInk.click()
  await expect(chaseInk).toBeChecked()

  const bankGroup = page.locator(
    '[data-task-group="bank-reconciliation"]:visible'
  )
  await expect(bankGroup.locator("label > span.min-w-0")).toHaveText([
    "Chase Ink",
    "AMEX",
    "Wells Fargo",
    "Chase Main",
    "Chase Sweep",
  ])
  await expect(visibleGroups.first()).toHaveAttribute(
    "data-task-group",
    "prepaid-accounts"
  )

  const chaseSweep = page.getByRole("checkbox", { name: "Chase Sweep" })
  await chaseSweep.click()
  await expect(chaseSweep).toBeChecked()
  const completedBottomRow = bankGroup.locator("label").last()
  const rowAndCard = await completedBottomRow.evaluate((row) => {
    const rowBounds = row.getBoundingClientRect()
    const cardBounds = row
      .closest('[data-slot="card"]')!
      .getBoundingClientRect()

    return {
      rowLeft: rowBounds.left,
      rowRight: rowBounds.right,
      rowBottom: rowBounds.bottom,
      cardLeft: cardBounds.left,
      cardRight: cardBounds.right,
      cardBottom: cardBounds.bottom,
      backgroundColor: getComputedStyle(row).backgroundColor,
    }
  })

  expect(rowAndCard.rowLeft).toBe(rowAndCard.cardLeft)
  expect(rowAndCard.rowRight).toBe(rowAndCard.cardRight)
  expect(rowAndCard.rowBottom).toBe(rowAndCard.cardBottom)
  expect(rowAndCard.backgroundColor).not.toBe("rgba(0, 0, 0, 0)")
})

test("Notes controls and mobile menu links respond", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile)
  await page.goto("/information?view=folders")
  await page
    .getByRole("button", { name: /^Test folder/ })
    .filter({ visible: true })
    .tap()
  await page
    .getByRole("button", { name: /^Long test note/ })
    .filter({ visible: true })
    .tap()
  await expect(
    page.locator('.tiptap[contenteditable="true"]:visible')
  ).toContainText("Long test note")
  await page.getByRole("button", { name: "Back to notes" }).tap()
  await expect(page).toHaveURL(/node=qa-folder/)
  await page.getByRole("button", { name: "Notebook actions" }).tap()
  await page.getByRole("menuitem", { name: "Add Note", exact: true }).tap()
  await expect(page.getByRole("menu")).toHaveCount(0)
  const editor = page.locator('.tiptap[contenteditable="true"]:visible')
  await editor.tap()
  await expect(editor).toBeFocused()
  await page.keyboard.type("A new mobile note")
  await expect(editor).toContainText("A new mobile note")
  await page.getByRole("button", { name: "Back to notes" }).tap()
  await dock(page).getByRole("button", { name: "Open more navigation" }).tap()
  await page.getByRole("button", { name: "Customize", exact: true }).tap()
  await expect(
    page.getByRole("heading", { name: "Customize", exact: true })
  ).toBeVisible()
  await page.getByRole("button", { name: "Done", exact: true }).tap()
  await page.getByRole("button", { name: "Close", exact: true }).tap()
  for (const [label, path] of [
    ["Month End", "/previous-month-ends"],
    ["New Month End", "/month-end/new"],
    ["Accounting settings", "/template-builder"],
    ["Certificate settings", "/certificate-settings"],
  ]) {
    await dock(page).getByRole("button", { name: "Open more navigation" }).tap()
    await page
      .getByRole("link", { name: label, exact: true })
      .filter({ visible: true })
      .tap()
    await expect.poll(() => new URL(page.url()).pathname).toBe(path)
    await page.waitForTimeout(700)
  }
})

test("major page controls respond to taps", async ({ page, isMobile }) => {
  test.skip(!isMobile)
  await page.goto("/month-end?period=2026-08")
  for (const label of ["Countries", "Tasks", "Dashboard"]) {
    const tab = page.getByRole("tab", { name: label, exact: true })
    await tab.tap()
    await expect(tab).toHaveAttribute("aria-selected", "true")
  }
  await page.getByRole("button", { name: "Open profile menu" }).tap()
  await expect(page.getByRole("menuitem", { name: "Logout" })).toBeVisible()
  await page.keyboard.press("Escape")
  await page.goto("/pricing-upload")
  const chooser = page.waitForEvent("filechooser")
  await page
    .getByRole("button", { name: /Drag and drop the pricing CSV/ })
    .tap()
  await chooser
  await page.goto("/month-end/new")
  await page.getByRole("button", { name: "Cancel", exact: true }).tap()
  await expect(page).toHaveURL(/previous-month-ends/)
  await expect(
    page
      .getByRole("link", { name: "New Month End", exact: true })
      .filter({ visible: true })
  ).toBeVisible()
  await dock(page).getByRole("button", { name: "Open more navigation" }).tap()
  await page
    .getByRole("link", { name: "Settings", exact: true })
    .filter({ visible: true })
    .tap()
  await page.getByRole("button", { name: "Angola", exact: true }).tap()
  await expect(
    page
      .getByRole("button", { name: "Back to countries", exact: true })
      .filter({ visible: true })
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Back to countries", exact: true })
    .filter({ visible: true })
    .tap()
  await expect(
    page.getByRole("button", { name: "Angola", exact: true })
  ).toBeVisible()
  await page.waitForTimeout(700)
  await dock(page).getByRole("link", { name: "Quote Tool", exact: true }).tap()
  await page
    .getByRole("button", { name: "Reset", exact: true })
    .filter({ visible: true })
    .tap()
  await page
    .getByRole("button", { name: "Quote country", exact: true })
    .filter({ visible: true })
    .tap()
  await expect(page.getByPlaceholder("Search countries")).toBeVisible()
})

test("safe areas and pull gestures do not displace chrome", async ({
  page,
  isMobile,
  browserName,
  context,
}) => {
  test.skip(!isMobile || browserName !== "chromium")
  const session = await context.newCDPSession(page)
  await session.send("Emulation.setSafeAreaInsetsOverride", {
    insets: { top: 24, bottom: 34 },
  })
  await page.goto("/information?view=folders")
  await expect(dock(page)).toBeVisible()
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0)
  const before = await geometry(page)
  expect.soft(before.header?.height).toBe(64)
  expect.soft(before.nav?.bottom).toBe(before.height - 16 - 34)
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 150, y: 170 }],
  })
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: 150, y: 210 }],
  })
  await page.waitForTimeout(180)
  const pulling = await geometry(page)
  expect.soft(pulling.header, "header during pull").toEqual(before.header)
  expect.soft(pulling.nav, "dock during pull").toEqual(before.nav)
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  })
})

test("country tabs and dock navigation respond to mobile taps", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile)
  await page.goto(routes[2])
  await expect(dock(page)).toBeVisible()
  for (const [label, view] of [
    ["Recon", "reconciliation"],
    ["Journal", "journal"],
    ["Dashboard", "dashboard"],
  ]) {
    await page.getByRole("tab", { name: label, exact: true }).tap()
    await expect(page).toHaveURL(new RegExp(`view=${view}`))
    await expect(
      page.getByRole("tab", { name: label, exact: true })
    ).toHaveAttribute("aria-selected", "true")
  }
  for (const [label, path] of [
    ["Dashboard", "/dashboard"],
    ["Month End", "/previous-month-ends"],
    ["Quote Tool", "/quote-tool"],
    ["Notebook", "/information"],
  ]) {
    await dock(page).getByRole("link", { name: label, exact: true }).tap()
    await expect.poll(() => new URL(page.url()).pathname).toBe(path)
    await expect(dock(page)).toBeVisible()
    await page.waitForTimeout(700)
  }
})
