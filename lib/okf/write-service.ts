import "server-only"
import { randomUUID } from "node:crypto"
import { buildOkfBundle, validateOkfBundle } from "./bundle"
import { validateChanges, validatePublicationDependencies } from "./engine"
import type { KnowledgeChange, KnowledgeDraft, KnowledgeState } from "./schema"
import {
  databaseError,
  OkfError,
  readKnowledge,
  type okfSession,
} from "./server"

type Client = Awaited<ReturnType<typeof okfSession>>["client"]

function protectedContent(content: KnowledgeState["pages"][number]["content"]) {
  return {
    sections: content.sections.map((section) => ({
      heading: section.heading,
      references: section.references,
    })),
    rules: content.rules.map((rule) => ({ ...rule, instruction: undefined })),
    fields: content.fields.map((field) => ({
      ...field,
      instruction: undefined,
    })),
    mappings: content.mappings,
    sources: content.sources,
    aliases: content.aliases,
  }
}

function validateRoutineTextChanges(
  state: KnowledgeState,
  changes: KnowledgeChange[]
) {
  for (const change of changes) {
    const current = state.pages.find((page) => page.id === change.pageId)
    if (
      !current ||
      JSON.stringify(protectedContent(current.content)) !==
        JSON.stringify(protectedContent(change.content))
    )
      throw new OkfError(
        "Routine editing can change knowledge text only. Use AI Update for rules, fields, mappings, sources, or structure."
      )
  }
}

export async function saveKnowledgeDraft(
  client: Client,
  input: {
    id?: string
    expectedEdit: number
    baseGeneration: number
    changes: KnowledgeChange[]
    reason: string
    source: string
  }
) {
  const state = await readKnowledge(client)
  if (state.generation !== input.baseGeneration)
    throw new OkfError(
      "Published knowledge changed. Refresh the comparison before saving.",
      409
    )
  const changes = validateChanges(state, input.changes)
  if (!changes.length) return { duplicate: true as const, draft: null }
  if (input.source === "Direct staff edit")
    validateRoutineTextChanges(state, changes)
  const candidate: KnowledgeState = {
    ...state,
    pages: state.pages.map((page) => ({
      ...page,
      content:
        changes.find((change) => change.pageId === page.id)?.content ??
        page.content,
    })),
  }
  validateOkfBundle(buildOkfBundle(candidate))
  const saved = await client.rpc("okf_save_draft", {
    p_id: input.id ?? randomUUID(),
    p_expected_edit: input.expectedEdit,
    p_base_generation: input.baseGeneration,
    p_changes: changes,
    p_reason: input.reason,
    p_source: input.source,
  })
  databaseError(saved.error)
  return { duplicate: false as const, draft: saved.data as KnowledgeDraft }
}

export async function publishKnowledgeDraft(
  client: Client,
  input: { id: string; token: string }
) {
  const previewResult = await client.rpc("okf_preview", { p_id: input.id })
  databaseError(previewResult.error)
  const preview = previewResult.data as {
    state: KnowledgeState
    draft: KnowledgeDraft
    token: string
  }
  if (
    input.token !== preview.token ||
    preview.state.generation !== preview.draft.base_generation
  )
    throw new OkfError("Comparison is stale. Refresh before approval.", 409)
  const changes = validateChanges(preview.state, preview.draft.changes)
  validatePublicationDependencies(preview.state, changes)
  const candidate: KnowledgeState = {
    generation: preview.state.generation + 1,
    pages: preview.state.pages.map((page) => ({
      ...page,
      content:
        changes.find((change) => change.pageId === page.id)?.content ??
        page.content,
    })),
  }
  validateOkfBundle(buildOkfBundle(candidate))
  const result = await client.rpc("okf_publish", {
    p_id: input.id,
    p_token: input.token,
  })
  databaseError(result.error)
  return result.data
}
