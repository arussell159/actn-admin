import fs from "node:fs/promises"
import path from "node:path"
import { createHash, randomUUID } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import { createInitialPages } from "./seed"
import { createMadagascarLayout } from "../certificate-layout/seed"
import {
  certificateLayoutSchema,
  countryKey,
} from "../certificate-layout/schema"
import {
  draftInputSchema,
  type KnowledgeDraft,
  type KnowledgeState,
  type KnowledgeReview,
} from "./schema"
import {
  nextVersion,
  sameContent,
  validateChanges,
  validatePublicationDependencies,
} from "./engine"
import type { MadagascarAnalysis } from "../madagascar-bsc"

export const developmentActor = "00000000-0000-4000-8000-000000000001"
type Row = Record<string, unknown>
type Store = Record<string, Row[]>
const tables = [
  "okf_state",
  "okf_drafts",
  "okf_publications",
  "okf_reviews",
  "okf_corrections",
  "okf_intake",
  "madagascar_bsc_requests",
  "okf_certificate_layouts",
  "okf_certificate_layout_history",
]

// Local-only persistence. Production always uses the existing authenticated Supabase client.
export function createOkfDevelopmentClient(
  directory = path.join(process.cwd(), ".okf-development")
) {
  const file = path.join(directory, "store.json")
  const lock = path.join(directory, "write.lock")
  const initial = (): Store =>
    Object.fromEntries(
      tables.map((table) => [
        table,
        table === "okf_state"
          ? [{ id: true, generation: 0, pages: createInitialPages() }]
          : table === "okf_certificate_layouts"
            ? [createMadagascarLayout()]
            : [],
      ])
    )
  async function read() {
    try {
      return {
        ...initial(),
        ...JSON.parse(await fs.readFile(file, "utf8")),
      } as Store
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
      return initial()
    }
  }
  async function transaction<T>(action: (store: Store) => T): Promise<T> {
    await fs.mkdir(directory, { recursive: true })
    let handle: Awaited<ReturnType<typeof fs.open>> | undefined
    for (let attempt = 0; !handle && attempt < 200; attempt++) {
      try {
        handle = await fs.open(lock, "wx")
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
        // A mutation holds the lock only for local JSON I/O, never while calling AI.
        const stat = await fs.stat(lock).catch(() => null)
        if (stat && Date.now() - stat.mtimeMs > 30_000)
          await fs.unlink(lock).catch(() => undefined)
        await new Promise((resolve) => setTimeout(resolve, 25))
      }
    }
    if (!handle) throw Error("Local storage is busy. Retry the change.")
    const temporary = file + "." + randomUUID() + ".tmp"
    try {
      const store = await read()
      const result = action(store)
      await fs.writeFile(temporary, JSON.stringify(store), "utf8")
      await fs.rename(temporary, file)
      return result
    } finally {
      await handle.close()
      await fs.unlink(lock).catch(() => undefined)
      await fs.unlink(temporary).catch(() => undefined)
    }
  }
  const token = (state: KnowledgeState, draft: KnowledgeDraft) =>
    createHash("sha256")
      .update(
        JSON.stringify([
          state.generation,
          draft.id,
          draft.edit_version,
          draft.changes,
          draft.reason,
          draft.source,
        ])
      )
      .digest("hex")
  function rpc(store: Store, name: string, args: Row): unknown {
    const state = store.okf_state[0] as unknown as KnowledgeState
    const drafts = store.okf_drafts as unknown as KnowledgeDraft[]
    const draft = drafts.find((d) => d.id === args.p_id)
    const now = new Date().toISOString()
    if (name === "okf_publish_certificate_layout") {
      const layout = certificateLayoutSchema.parse(args.p_layout)
      const key = countryKey(layout.country)
      if (key !== args.p_country_key)
        throw Error("Country key does not match layout.")
      const existing = store.okf_certificate_layouts.find(
        (row) => row.country_key === key
      )
      if ((existing?.revision ?? 0) !== args.p_expected_revision)
        throw Error("Layout changed. Reload before publishing.")
      const aliases = new Set(
        [layout.country, ...layout.aliases].map(countryKey)
      )
      for (const row of store.okf_certificate_layouts) {
        const other = certificateLayoutSchema.parse(row.layout)
        if (
          row.country_key !== key &&
          [other.country, ...other.aliases].some((name) =>
            aliases.has(countryKey(name))
          )
        )
          throw Error("Country name or alias is already used.")
      }
      if (existing && sameContent(existing.layout, layout)) return existing
      const row = {
        country_key: key,
        layout,
        revision: Number(existing?.revision ?? 0) + 1,
        updated_at: now,
        updated_by: developmentActor,
      }
      if (existing) Object.assign(existing, row)
      else store.okf_certificate_layouts.push(row)
      store.okf_certificate_layout_history.push({
        id: randomUUID(),
        ...structuredClone(row),
      })
      return row
    }
    if (name === "okf_delete_certificate_layout") {
      const key = String(args.p_country_key ?? "")
      const index = store.okf_certificate_layouts.findIndex(
        (row) => row.country_key === key
      )
      const existing = store.okf_certificate_layouts[index]
      if (!existing) throw Error("Layout not found.")
      if (existing.revision !== args.p_expected_revision)
        throw Error("Layout changed. Reload before deleting.")
      store.okf_certificate_layouts.splice(index, 1)
      return true
    }
    if (name === "okf_save_draft") {
      const input = draftInputSchema.parse({
        id: args.p_id,
        expectedEdit: args.p_expected_edit,
        baseGeneration: args.p_base_generation,
        changes: args.p_changes,
        reason: args.p_reason,
        source: args.p_source,
      })
      if (state.generation !== input.baseGeneration)
        throw Error("Published content changed. Refresh the comparison.")
      if (
        draft
          ? draft.status !== "pending" ||
            draft.edit_version !== input.expectedEdit
          : input.expectedEdit !== 0
      )
        throw Error("Draft changed. Reload before editing.")
      const changes = validateChanges(state, input.changes)
      if (!changes.length) throw Error("Already covered")
      if (
        draft &&
        sameContent(draft.changes, changes) &&
        draft.reason === input.reason &&
        draft.source === input.source
      )
        return draft
      const next: KnowledgeDraft = {
        id: input.id,
        edit_version: (draft?.edit_version ?? 0) + 1,
        base_generation: input.baseGeneration,
        changes,
        reason: input.reason,
        source: input.source,
        proposer: developmentActor,
        updated_at: now,
        status: "pending",
        review: "",
        review_edit: null,
      }
      if (draft) Object.assign(draft, next)
      else drafts.push(next)
      return next
    }
    if (name === "okf_correct_request") {
      if (typeof args.p_reason !== "string" || !args.p_reason.trim())
        throw Error("A correction reason is required.")
      const request = store.madagascar_bsc_requests.find(
        (r) => r.id === args.p_request_id
      )
      if (!request)
        throw Error("Request is not saved in local development storage.")
      if (
        new Date(String(request.updated_at)).getTime() !==
        new Date(String(args.p_expected_updated_at)).getTime()
      )
        throw Error("Request changed. Reload before correcting.")
      const analysis = request.analysis as MadagascarAnalysis
      const target = String(args.p_target),
        value = String(args.p_value)
      let before: unknown, after: unknown
      if (
        args.p_review_id &&
        !store.okf_reviews.some(
          (r) => r.id === args.p_review_id && r.request_id === request.id
        )
      )
        throw Error("Review does not belong to request.")
      if (target.startsWith("finding:")) {
        const review = store.okf_reviews.find((r) => r.id === args.p_review_id)
          ?.review as KnowledgeReview | undefined
        const finding = review?.findings.find((f) => f.id === target.slice(8))
        if (
          !finding ||
          ![
            "passed",
            "failed",
            "missing",
            "unreadable",
            "conflicting",
            "not applicable",
            "unconfirmed",
          ].includes(value)
        )
          throw Error("Unknown finding or status.")
        before = structuredClone(finding)
        after = { ...finding, status: value }
        analysis.okfOverrides = {
          ...analysis.okfOverrides,
          [finding.id]: after as typeof finding,
        }
      } else if (target.startsWith("invoiceItem:")) {
        const [, index, key] = target.split(":")
        const item = analysis.invoiceItems[Number(index)]
        if (
          !item ||
          ![
            "hsCode",
            "description",
            "quantity",
            "unitOfMeasurement",
            "unitPrice",
            "isSecondHand",
            "originCountry",
          ].includes(key)
        )
          throw Error("Unknown invoice item.")
        before = item[key as keyof typeof item]
        after = value
        Object.assign(item, { [key]: value })
      } else if (target.startsWith("invoiceValue:")) {
        const item = analysis.invoiceValues[Number(target.slice(13))]
        if (!item) throw Error("Unknown invoice value.")
        before = structuredClone(item)
        Object.assign(item, {
          value,
          status: value.trim() ? "extracted" : "missing",
        })
        after = item
      } else if (target === "missingCorrectionsMessage") {
        before = analysis.missingCorrectionsMessage
        after = value
        analysis.missingCorrectionsMessage = value
      } else {
        let field = analysis.fields.find((f) => f.key === target)
        before = field ? structuredClone(field) : null
        if (!field) {
          const record = store.okf_certificate_layouts.find((row) => {
            const layout = certificateLayoutSchema.parse(row.layout)
            return [layout.country, ...layout.aliases].some(
              (name) => countryKey(name) === countryKey(String(request.country))
            )
          })
          const definition = record
            ? certificateLayoutSchema
                .parse(record.layout)
                .fields.find((field) => field.id === target)
            : undefined
          if (
            !definition ||
            target.startsWith("invoiceItems.") ||
            target === "invoiceValues"
          )
            throw Error("Unknown request field.")
          field = {
            key: target,
            label: definition.label,
            value: "",
            status: "missing",
            source: "Staff correction",
            note: "",
          }
          analysis.fields.push(field)
        }
        Object.assign(field, {
          value,
          status: value.trim() ? "extracted" : "missing",
        })
        after = field
      }
      if (sameContent(before, after)) return { request, correction: null }
      const correction = {
        id: randomUUID(),
        request_id: request.id,
        review_id: args.p_review_id,
        target,
        before_value: before,
        after_value: after,
        reason: args.p_reason,
        actor: developmentActor,
        created_at: now,
      }
      store.okf_corrections.push(correction)
      request.updated_at = now
      request.status = "Needs review"
      return { request, correction }
    }
    if (!draft || draft.status !== "pending")
      throw Error("Draft is no longer pending.")
    if (name === "okf_preview")
      return { state, draft, token: token(state, draft) }
    if (name === "okf_draft_action") {
      if (draft.edit_version !== args.p_edit) throw Error("Draft changed.")
      if (args.p_action === "discard") draft.status = "discarded"
      else if (args.p_action === "review") {
        draft.review = String(args.p_review)
        draft.review_edit = draft.edit_version
      } else throw Error("Unknown draft action.")
      draft.updated_at = now
      return null
    }
    if (name !== "okf_publish") throw Error("Unknown operation.")
    if (
      state.generation !== draft.base_generation ||
      args.p_token !== token(state, draft)
    )
      throw Error("Comparison is stale. Refresh before approval.")
    const changes = validateChanges(state, draft.changes)
    validatePublicationDependencies(state, changes)
    if (!changes.length) throw Error("Already covered")
    const before = state.pages.filter((p) =>
      changes.some((c) => c.pageId === p.id)
    )
    state.pages = state.pages.map((p) => {
      const change = changes.find((c) => c.pageId === p.id)
      return change
        ? {
            ...p,
            content: change.content,
            revision: p.revision + 1,
            version: nextVersion(p.version, change.level),
            publishedAt: now,
          }
        : p
    })
    state.generation++
    draft.status = "published"
    draft.updated_at = now
    const publication = {
      id: randomUUID(),
      draft_id: draft.id,
      before_pages: before,
      after_pages: state.pages.filter((p) =>
        changes.some((c) => c.pageId === p.id)
      ),
      proposer: draft.proposer,
      approver: developmentActor,
      reason: draft.reason,
      source: draft.source,
      created_at: now,
    }
    store.okf_publications.push(publication)
    return publication
  }
  const localFetch: typeof fetch = async (input, init) => {
    try {
      const request = new Request(input, init)
      const url = new URL(request.url)
      if (url.pathname.startsWith("/storage/v1/object/")) {
        const objectKey = decodeURIComponent(
          url.pathname.slice("/storage/v1/object/".length)
        ).replace(/^authenticated\//, "")
        const objectFile = path.join(
          directory,
          "files",
          createHash("sha256").update(objectKey).digest("hex")
        )
        if (request.method === "GET") {
          const bytes = await fs.readFile(objectFile)
          const mime = await fs.readFile(objectFile + ".type", "utf8")
          return new Response(bytes, { headers: { "Content-Type": mime } })
        }
        if (request.method !== "POST" && request.method !== "PUT")
          throw Error("Unsupported storage action.")
        const body = request.headers
          .get("content-type")
          ?.includes("multipart/form-data")
          ? (await request.formData()).get("")
          : await request.blob()
        if (!(body instanceof Blob)) throw Error("No file supplied.")
        await fs.mkdir(path.dirname(objectFile), { recursive: true })
        await fs.writeFile(objectFile, Buffer.from(await body.arrayBuffer()))
        await fs.writeFile(
          objectFile + ".type",
          body.type || "application/octet-stream"
        )
        return Response.json({ Key: objectKey })
      }
      if (url.pathname.startsWith("/rest/v1/rpc/")) {
        const args = await request.json()
        return Response.json(
          await transaction((store) =>
            rpc(store, url.pathname.split("/").at(-1)!, args)
          )
        )
      }
      const table = url.pathname.split("/").at(-1)!
      if (!tables.includes(table)) throw Error("Unknown local table.")
      const matches = (row: Row) =>
        [...url.searchParams].every(
          ([key, value]) =>
            !value.startsWith("eq.") || String(row[key]) === value.slice(3)
        )
      if (request.method === "GET") {
        let rows = (await read())[table].filter(matches)
        const order = url.searchParams.get("order")?.split(".")
        if (order)
          rows.sort(
            (a, b) =>
              String(a[order[0]]).localeCompare(String(b[order[0]])) *
              (order[1] === "desc" ? -1 : 1)
          )
        if (url.searchParams.has("limit"))
          rows = rows.slice(0, Number(url.searchParams.get("limit")))
        if (request.headers.get("accept")?.includes("vnd.pgrst.object")) {
          if (rows.length !== 1) throw Error("Record not found.")
          return Response.json(rows[0])
        }
        return Response.json(rows)
      }
      if (request.method === "DELETE" && table === "madagascar_bsc_requests") {
        await transaction((store) => {
          store[table] = store[table].filter((r) => !matches(r))
        })
        return new Response(null, { status: 204 })
      }
      if (
        request.method !== "POST" ||
        !["okf_intake", "okf_reviews", "madagascar_bsc_requests"].includes(
          table
        )
      )
        throw Error("Direct modification is not permitted.")
      const body = await request.json()
      const records = Array.isArray(body) ? body : [body]
      const result = await transaction((store) =>
        records.map((value) => {
          const row: Row = {
            id: randomUUID(),
            actor: developmentActor,
            created_at: new Date().toISOString(),
            ...value,
          }
          const existing = store[table].find((r) => r.id === row.id)
          if (existing && table !== "madagascar_bsc_requests")
            throw Error("Record already exists.")
          if (existing) Object.assign(existing, row)
          else store[table].push(row)
          return row
        })
      )
      return Response.json(result, { status: 201 })
    } catch (error) {
      return Response.json(
        {
          message:
            error instanceof Error ? error.message : "Local storage failed.",
        },
        { status: 400 }
      )
    }
  }
  return createClient("http://okf-development.invalid", "local-development", {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch: localFetch },
  })
}
