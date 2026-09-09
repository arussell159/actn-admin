import { expect, test } from "@playwright/test"
import { mockLayoutData } from "./mobile-layout-fixtures"

async function installReviewStream(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    const originalFetch = window.fetch.bind(window)
    const target = window as typeof window & {
      reviewStream?: ReadableStreamDefaultController<Uint8Array>
    }
    window.fetch = (input, init) =>
      String(input).includes("/api/knowledge-base/chat")
        ? Promise.resolve(
            new Response(
              new ReadableStream<Uint8Array>({
                start(controller) {
                  target.reviewStream = controller
                },
              }),
              { headers: { "Content-Type": "text/event-stream" } }
            )
          )
        : originalFetch(input, init)
  })
}

async function sendStreamEvent(
  page: import("@playwright/test").Page,
  event: unknown,
  close = false
) {
  await page.evaluate(
    ({ event, close }) => {
      const target = window as typeof window & {
        reviewStream?: ReadableStreamDefaultController<Uint8Array>
      }
      if (event)
        target.reviewStream!.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`)
        )
      if (close) target.reviewStream!.close()
    },
    { event, close }
  )
}

// Run against the local app: npx playwright test tests/browser/knowledge-review.spec.ts
test.use({
  baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3100",
  viewport: { width: 1280, height: 900 },
  serviceWorkers: "block",
})

const key = "africa-ctn-knowledge-base-v1"
const initial = [
  {
    id: "angola",
    country: "Angola",
    format: "okf.ctn.country.v1",
    version: "v1.4",
    updatedAt: "initial",
    sections: [
      {
        id: "angola-procedures",
        title: "Create Certificate",
        kind: "procedures",
        summary: "Certificate submission.",
        updatedAt: "initial",
        body: [
          ...Array.from(
            { length: 20 },
            (_, index) => `- Preserve unrelated instruction ${index}.`
          ),
          "- Submit at least 48 hours before arrival.",
        ],
      },
    ],
    changeLog: [],
  },
]
const analysis = {
  classification: "UPDATE",
  assistantMessage: "The official deadline supersedes the previous rule.",
  references: [
    {
      recordId: "angola",
      sectionId: "angola-procedures",
      existingText: "- Submit at least 48 hours before arrival.",
    },
  ],
  conflict: null,
  files: [
    {
      recordId: "angola",
      newRecord: null,
      versionImpact: "major",
      versionReason: "Following the old deadline would be incorrect.",
      changeLogSummary: "Submission deadline changed from 48 to 72 hours.",
      edits: [
        {
          action: "UPDATE",
          sectionId: "angola-procedures",
          newSection: null,
          startIndex: 20,
          currentContent: ["- Submit at least 48 hours before arrival."],
          proposedContent: ["- Submit at least 72 hours before arrival."],
          reason: "Official rule changed.",
        },
      ],
    },
  ],
}

test.beforeEach(async ({ context, page }) => {
  await mockLayoutData(context)
  await page.addInitScript(
    ({ key, initial }) => localStorage.setItem(key, JSON.stringify(initial)),
    { key, initial }
  )
  await page.route("**/api/knowledge-base/chat", (route) =>
    route.fulfill({ json: { ok: true, analysis } })
  )
  await page.goto("/knowledge-base")
  await expect(
    page.getByRole("button", { name: "Angola v1.4", exact: true })
  ).toBeVisible()
})

test("proposal cannot save until approved; selected country cannot retarget it; scrolls and highlights", async ({
  page,
}) => {
  let calls = 0
  let finishReview = () => {}
  const reviewReady = new Promise<void>((resolve) => {
    finishReview = resolve
  })
  await page.route("**/api/knowledge-base/chat", async (route) => {
    calls++
    const request = route.request().postDataJSON()
    expect(
      request.records.some(
        (record: { id: string }) => record.id === "general-processing"
      )
    ).toBeTruthy()
    await reviewReady
    return route.fulfill({ json: { ok: true, analysis } })
  })
  await page
    .getByPlaceholder("Ask AI to update the knowledge base")
    .fill(
      "The authority changed the deadline from 48 to 72 hours. Add immediately."
    )
  await page.getByRole("button", { name: "Update OKF", exact: true }).click()
  await expect(
    page.getByRole("status").filter({ hasText: "Thinking" })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Update OKF", exact: true })
  ).toBeDisabled()
  finishReview()
  const card = page.getByLabel("OKF review")
  await expect(card).toContainText("Proposed Version: v2")
  await expect(
    page.getByRole("status").filter({ hasText: "Thinking" })
  ).toHaveCount(0)
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key)
  ).toEqual(initial)
  await page.getByRole("button", { name: "Madagascar v1", exact: true }).click()
  await page.getByRole("button", { name: "Approve", exact: true }).click()
  await expect(
    page.getByRole("status").filter({ hasText: "Updated successfully" })
  ).toBeVisible()
  const changed = page.locator(
    '[data-okf-anchor="okf-entry-angola-procedures-20"]'
  )
  await expect(changed).toHaveText("Submit at least 72 hours before arrival.")
  expect(
    await changed.evaluate((element) => element.getAnimations().length)
  ).toBeGreaterThan(0)
  const stored = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    key
  )
  expect(
    stored.find((record: { id: string }) => record.id === "angola").version
  ).toBe("v2")
  expect(
    stored.find((record: { id: string }) => record.id === "angola").changeLog
  ).toHaveLength(1)
  expect(
    stored.find((record: { id: string }) => record.id === "madagascar").version
  ).toBe(1)
  expect(calls).toBe(1)
  await expect
    .poll(async () =>
      changed.evaluate((element) => {
        const target = element.getBoundingClientRect()
        const container = element
          .closest(".ctn-okf-editor-content")!
          .getBoundingClientRect()
        return target.top >= container.top && target.bottom <= container.bottom
      })
    )
    .toBeTruthy()
  await page.screenshot({ path: "node_modules/.cache/okf-review/approved.png" })
  await page.getByRole("button", { name: "Show conversation" }).click()
  const conversation = page.getByRole("log", { name: "OKF conversation" })
  await expect(conversation).toContainText("Add immediately.")
  await expect(conversation).toContainText(analysis.assistantMessage)
  await expect(conversation).toContainText("Approved and applied.")
  await expect(conversation).toContainText("Updated successfully.")
  await expect(
    page.getByRole("button", { name: "Approve", exact: true })
  ).toHaveCount(0)
})

test("cancel and no-change do not persist; conflict asks for authority without approval", async ({
  page,
}) => {
  const input = page.getByPlaceholder("Ask AI to update the knowledge base")
  await input.fill("Change deadline")
  await page.getByRole("button", { name: "Update OKF", exact: true }).click()
  await page.getByRole("button", { name: "Cancel", exact: true }).click()
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key)
  ).toEqual(initial)
  for (const classification of ["NO CHANGE", "CONFLICT"]) {
    await page.route("**/api/knowledge-base/chat", (route) =>
      route.fulfill({
        json: {
          ok: true,
          analysis: {
            ...analysis,
            classification,
            files: [],
            conflict:
              classification === "CONFLICT"
                ? {
                    newInformation: "72 hours",
                    issue: "Supersession unclear",
                    question: "Which rule is authoritative?",
                  }
                : null,
          },
        },
      })
    )
    await input.fill("Deadline is 72 hours")
    await page.getByRole("button", { name: "Update OKF", exact: true }).click()
    await expect(page.getByLabel("OKF review").last()).toContainText(
      `Action: ${classification}`
    )
    await expect(
      page.getByRole("button", { name: "Approve", exact: true })
    ).toHaveCount(0)
    expect(
      await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key)
    ).toEqual(initial)
  }
  await expect(page.getByLabel("OKF review").last()).toContainText(
    "Which rule is authoritative?"
  )
  await expect(page.getByLabel("OKF review")).toHaveCount(3)
  await expect(
    page.getByRole("log", { name: "OKF conversation" })
  ).toContainText("Cancelled. No changes were made to the OKF.")
})

test("save failure keeps proposal and exact wording available for retry on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page
    .getByPlaceholder("Ask AI to update the knowledge base")
    .fill("Official deadline changed")
  await page.getByRole("button", { name: "Update OKF", exact: true }).click()
  await expect(page.getByLabel("OKF review")).toContainText(
    "Proposed Version: v2"
  )
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === "africa-ctn-knowledge-base-v1") {
        Storage.prototype.setItem = original
        throw new Error("Storage quota exceeded")
      }
      return original.call(this, key, value)
    }
  })
  await page.getByRole("button", { name: "Approve", exact: true }).click()
  await expect(
    page.getByRole("status").filter({ hasText: "Storage quota exceeded" })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Approve", exact: true })
  ).toBeEnabled()
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key)
  ).toEqual(initial)
  await page.getByRole("button", { name: "Approve", exact: true }).click()
  await expect(
    page.getByRole("status").filter({ hasText: "Updated successfully" })
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBeTruthy()
})

test("streams text before completion, anchors the response start and respects manual scrolling", async ({
  page,
}) => {
  await installReviewStream(page)
  await page
    .getByPlaceholder("Ask AI to update the knowledge base")
    .fill("Review this deadline.")
  await page.getByRole("button", { name: "Update OKF", exact: true }).click()
  await expect(
    page.getByRole("status").filter({ hasText: "Thinking" })
  ).toBeVisible()
  const firstText = "Action: UPDATE\n\nThe official deadline"
  await sendStreamEvent(page, { type: "preview", text: firstText })
  const log = page.getByRole("log", { name: "OKF conversation" })
  await expect(log).toContainText(firstText)
  await expect(page.getByLabel("Response arriving")).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Approve", exact: true })
  ).toHaveCount(0)
  const longText =
    firstText +
    " has changed.\n\n" +
    "Check the proposed instruction carefully.\n".repeat(40)
  await sendStreamEvent(page, { type: "preview", text: longText })
  await expect(log).toContainText("has changed.")
  const reply = log.locator("[data-chat-message-id]").last()
  await expect
    .poll(() =>
      reply.evaluate((element) =>
        Math.abs(
          element.getBoundingClientRect().top -
            element.parentElement!.getBoundingClientRect().top
        )
      )
    )
    .toBeLessThan(2)
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key)
  ).toEqual(initial)
  const anchored = await log.evaluate((element) => element.scrollTop)
  await log.hover()
  await page.mouse.wheel(0, 180)
  await expect
    .poll(() => log.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(anchored + 20)
  const manual = await log.evaluate((element) => element.scrollTop)
  await sendStreamEvent(page, {
    type: "preview",
    text: longText + "More text is arriving.",
  })
  await expect(log).toContainText("More text is arriving.")
  expect(await log.evaluate((element) => element.scrollTop)).toBeCloseTo(
    manual,
    0
  )
  await sendStreamEvent(page, { type: "complete", analysis }, true)
  await expect(
    page.getByRole("button", { name: "Approve", exact: true })
  ).toBeEnabled()
  await expect(page.getByLabel("Response arriving")).toHaveCount(0)
  await expect(page.getByLabel("OKF review")).toContainText(
    "Proposed Version: v2"
  )
})

test("an interrupted partial response cannot become an approvable change", async ({
  page,
}) => {
  await installReviewStream(page)
  await page
    .getByPlaceholder("Ask AI to update the knowledge base")
    .fill("Review this deadline.")
  await page.getByRole("button", { name: "Update OKF", exact: true }).click()
  await sendStreamEvent(page, {
    type: "preview",
    text: "Action: UPDATE\n\nA partial draft",
  })
  await expect(page.getByLabel("Response arriving")).toBeVisible()
  await sendStreamEvent(page, null, true)
  await expect(
    page.getByRole("log", { name: "OKF conversation" })
  ).toContainText("Incomplete response (not applied).")
  await expect(
    page.getByRole("status").filter({ hasText: "response ended" })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Approve", exact: true })
  ).toHaveCount(0)
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key)
  ).toEqual(initial)
})
