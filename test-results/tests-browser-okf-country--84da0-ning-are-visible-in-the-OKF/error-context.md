# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\browser\okf.spec.ts >> country layouts and verified learning are visible in the OKF
- Location: tests\browser\okf.spec.ts:886:1

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/knowledge-base?node=knowledge-country-kenya-ai-learning", waiting until "load"

```

# Test source

```ts
  809  |       }
  810  |     } else if (body.action === "save") {
  811  |       const input = body.draft
  812  |       const changes = validateChanges(state, input.changes)
  813  |       if (!changes.length) {
  814  |         drafts.delete(input.id)
  815  |         result = { ok: true, duplicate: true }
  816  |       } else {
  817  |         // Mimic jsonb key ordering so autosave cannot rely on JS insertion order.
  818  |         const reordered = JSON.parse(
  819  |           JSON.stringify(changes, (_k, v) =>
  820  |             v && typeof v === "object" && !Array.isArray(v)
  821  |               ? Object.fromEntries(
  822  |                   Object.entries(v).sort(([a], [b]) => a.localeCompare(b))
  823  |                 )
  824  |               : v
  825  |           )
  826  |         )
  827  |         const d = {
  828  |           id: input.id,
  829  |           edit_version: input.expectedEdit + 1,
  830  |           base_generation: input.baseGeneration,
  831  |           changes: reordered,
  832  |           reason: input.reason,
  833  |           source: input.source,
  834  |           proposer: "test-staff",
  835  |           updated_at: "2026-09-10T12:01:00Z",
  836  |           status: "pending",
  837  |           review: "",
  838  |           review_edit: null,
  839  |         }
  840  |         drafts.set(d.id, d)
  841  |         result = { ok: true, draft: d }
  842  |       }
  843  |     } else if (body.action === "preview") {
  844  |       const draft = drafts.get(body.id)!
  845  |       result = {
  846  |         ok: true,
  847  |         draft,
  848  |         state,
  849  |         token: "preview-token",
  850  |         stale: false,
  851  |         comparisons: draft.changes.map((c) => {
  852  |           const p = state.pages.find((p) => p.id === c.pageId)!
  853  |           return {
  854  |             pageId: p.id,
  855  |             title: p.title,
  856  |             before: p.content,
  857  |             after: c.content,
  858  |             currentVersion: p.version,
  859  |             proposedVersion: nextVersion(p.version, c.level),
  860  |             mappingChanged: false,
  861  |           }
  862  |         }),
  863  |       }
  864  |     } else if (body.action === "publish") {
  865  |       expect(body.token).toBe("preview-token")
  866  |       const d = drafts.get(body.id)!
  867  |       published.push(d)
  868  |       for (const change of d.changes) {
  869  |         const p = state.pages.find((p) => p.id === change.pageId)!
  870  |         p.content = change.content
  871  |         p.revision++
  872  |         p.version = nextVersion(p.version, change.level)
  873  |       }
  874  |       state.generation++
  875  |       drafts.delete(body.id)
  876  |       result = { ok: true }
  877  |     } else if (body.action === "discard") {
  878  |       drafts.delete(body.id)
  879  |       result = { ok: true }
  880  |     }
  881  |     await route.fulfill({ json: result })
  882  |   })
  883  |   return { state, drafts, published, readCount: () => readCount }
  884  | }
  885  | 
  886  | test("country layouts and verified learning are visible in the OKF", async ({
  887  |   page,
  888  | }) => {
  889  |   const mocked = await mockKnowledge(page, {
  890  |     layoutCountries: ["Kenya", "Somalia", "Sudan", "Madagascar", "Djibouti"],
  891  |     sourceLearnings: [
  892  |       {
  893  |         version: 1,
  894  |         target: "invoiceValues",
  895  |         label: "Freight Value",
  896  |         verified: true,
  897  |         documentType: "Bill of Lading",
  898  |         filename: "rated-bl.pdf",
  899  |         page: 2,
  900  |         supportingText: "Ocean freight USD 1,250.00",
  901  |         matchedValue: "1,250.00",
  902  |         confidence: 0.98,
  903  |         basis: "document evidence",
  904  |         country: "Kenya",
  905  |         createdAt: "2026-09-10T12:00:00Z",
  906  |       },
  907  |     ],
  908  |   })
> 909  |   await page.goto("/knowledge-base?node=knowledge-country-kenya-ai-learning")
       |              ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  910  |   await expect.poll(mocked.readCount).toBeGreaterThan(0)
  911  |   await expect
  912  |     .poll(() =>
  913  |       page.evaluate(() =>
  914  |         JSON.parse(
  915  |           localStorage.getItem("africa-ctn-knowledge-base-notes") ?? "[]"
  916  |         ).some((node: { title?: string }) => node.title === "Kenya")
  917  |       )
  918  |     )
  919  |     .toBe(true)
  920  |   await expect(page.getByRole("heading", { name: "AI Learning" })).toBeVisible()
  921  |   await expect(page.getByText("Freight Value", { exact: false })).toBeVisible()
  922  |   await expect(page.getByText("Bill of Lading", { exact: false })).toBeVisible()
  923  |   await expect(page.getByText("Kenya", { exact: true }).first()).toBeVisible()
  924  |   await expect(page.getByText("Sudan", { exact: true }).first()).toBeVisible()
  925  | })
  926  | 
  927  | test("direct edits autosave, preserve published content until exact preview approval, and retain the fixed template", async ({
  928  |   page,
  929  | }, info) => {
  930  |   const model = await mockKnowledge(page)
  931  |   await page.goto("/knowledge-base?page=mg-overview")
  932  |   await page.getByRole("button", { name: "Edit page", exact: true }).click()
  933  |   await page
  934  |     .getByLabel("Notes", { exact: true })
  935  |     .fill("BSC — training wording confirmed by staff.")
  936  |   await expect.poll(() => model.drafts.size).toBe(1)
  937  |   await expect(page.getByText(/Draft · 1 page · Saved/)).toBeVisible()
  938  |   expect(
  939  |     model.state.pages.find((p) => p.id === "mg-overview")!.content.sections[0]
  940  |       .text
  941  |   ).not.toContain("training wording")
  942  |   await page
  943  |     .getByRole("button", { name: "Preview changes", exact: true })
  944  |     .click()
  945  |   await expect(page.getByRole("dialog")).toContainText("Current wording")
  946  |   await expect(page.getByRole("dialog")).toContainText(
  947  |     "BSC — training wording confirmed by staff."
  948  |   )
  949  |   await page
  950  |     .getByRole("button", { name: "Approve and publish", exact: true })
  951  |     .click()
  952  |   await expect(page.getByRole("dialog")).toHaveCount(0)
  953  |   expect(model.published).toHaveLength(1)
  954  |   await expect(page.getByText("Published 1.1.0", { exact: true })).toBeVisible()
  955  |   if (info.project.name === "mobile") {
  956  |     await page
  957  |       .getByRole("button", { name: "Back to knowledge folder", exact: true })
  958  |       .click()
  959  |     await page.getByRole("button", { name: "Documents 5", exact: true }).click()
  960  |     await page
  961  |       .getByRole("button", { name: "Bill of Lading", exact: true })
  962  |       .click()
  963  |   } else
  964  |     await page
  965  |       .getByRole("navigation", { name: "OKF navigation" })
  966  |       .getByRole("button", { name: "Bill of Lading", exact: true })
  967  |       .click()
  968  |   await expect(page.locator("article h1")).toHaveText("Bill of Lading")
  969  |   await expect(page.locator("h1")).toHaveCount(1)
  970  |   await expect(page.locator("article h2")).toHaveText(["Fields to extract"])
  971  |   expect(
  972  |     await page.evaluate(
  973  |       () => document.documentElement.scrollWidth <= innerWidth + 1
  974  |     )
  975  |   ).toBeTruthy()
  976  | })
  977  | 
  978  | test("duplicate AI update and questions do not publish or create versions", async ({
  979  |   page,
  980  | }) => {
  981  |   const model = await mockKnowledge(page)
  982  |   await page.goto("/knowledge-base?page=mg-overview")
  983  |   await page
  984  |     .getByRole("button", { name: "Update with AI", exact: true })
  985  |     .click()
  986  |   await page
  987  |     .getByLabel("Update notes", { exact: true })
  988  |     .fill("Already documented certificate name.")
  989  |   await page
  990  |     .getByRole("button", { name: "Propose update", exact: true })
  991  |     .click()
  992  |   await expect(page.getByText("Already covered", { exact: true })).toBeVisible()
  993  |   expect(model.drafts.size).toBe(0)
  994  |   expect(model.published).toHaveLength(0)
  995  |   await page
  996  |     .getByRole("button", { name: "Ask published OKF", exact: true })
  997  |     .click()
  998  |   await page
  999  |     .getByLabel("Question", { exact: true })
  1000 |     .fill("What is still unconfirmed?")
  1001 |   await page.getByRole("button", { name: "Ask question", exact: true }).click()
  1002 |   await expect(page.getByText("Already covered", { exact: true })).toBeVisible()
  1003 |   expect(model.state.generation).toBe(1)
  1004 | })
  1005 | 
  1006 | test("localhost development opens without a login and still rejects invalid writes", async ({
  1007 |   request,
  1008 | }) => {
  1009 |   const knowledge = await request.get("/api/okf")
```
