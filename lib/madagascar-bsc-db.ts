"use client"

import { createClient } from "@/lib/client"
import {
  createMadagascarId,
  type MadagascarRequest,
  type MadagascarRule,
} from "@/lib/madagascar-bsc"

const requestTable = "madagascar_bsc_requests"
const ruleTable = "madagascar_bsc_rules"
const storageBucket = "madagascar-bsc"
const requestChangedEvent = "actn-madagascar-bsc-requests-changed"

type RequestRow = {
  id: string
  reference: string
  country?: string
  status: MadagascarRequest["status"]
  documents: MadagascarRequest["documents"]
  analysis: MadagascarRequest["analysis"]
  created_at: string
  updated_at: string
}

type RuleRow = {
  id: string
  document_type: MadagascarRule["documentType"]
  title: string
  instruction: string
  enabled: boolean
  source: string
  created_at: string
  updated_at: string
}

function notifyRequestChange() {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(requestChangedEvent))
}

export function subscribeToMadagascarRequestChanges(
  listener: () => void
) {
  if (typeof window === "undefined") return () => undefined

  window.addEventListener(requestChangedEvent, listener)
  const client = createClient()
  const channel = client
    .channel("shared-certificate-requests")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: requestTable,
      },
      listener
    )
    .subscribe()

  return () => {
    window.removeEventListener(requestChangedEvent, listener)
    void client.removeChannel(channel)
  }
}

function toRequest(row: RequestRow): MadagascarRequest {
  return {
    id: row.id,
    reference: row.reference,
    country:
      row.country ||
      (row.analysis?.okf?.observations.country.status === "supported"
        ? row.analysis.okf.observations.country.name
        : "Unknown"),
    status: row.status,
    documents: row.documents ?? [],
    analysis: row.analysis,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toRule(row: RuleRow): MadagascarRule {
  return {
    id: row.id,
    documentType: row.document_type,
    title: row.title,
    instruction: row.instruction,
    enabled: row.enabled,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listMadagascarRequests() {
  const { data, error } = await createClient()
    .from(requestTable)
    .select("*")
    .order("created_at", { ascending: false })
  if (error) throw error
  return ((data ?? []) as RequestRow[]).map(toRequest)
}

export async function saveMadagascarRequest(
  request: MadagascarRequest,
  files: (File | undefined)[]
) {
  const client = createClient()
  const uploadErrors: string[] = []
  const documents = await Promise.all(
    request.documents.map(async (document, index) => {
      const file = files[index]
      if (!file) return document
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-")
      const storagePath = `${request.id}/${document.id}-${safeName}`
      const { error } = await client.storage
        .from(storageBucket)
        .upload(storagePath, file, { upsert: true, contentType: file.type })

      if (error) {
        uploadErrors.push(`${file.name}: ${error.message}`)
        return document
      }
      return { ...document, storagePath }
    })
  )
  if (uploadErrors.length)
    throw new Error(
      `The request was not saved because document storage failed. ${uploadErrors.join("; ")}`
    )
  const savedRequest = { ...request, documents }
  const { error } = await client.from(requestTable).upsert({
    id: savedRequest.id,
    reference: savedRequest.reference,
    country: savedRequest.country,
    status: savedRequest.status,
    documents: savedRequest.documents,
    analysis: savedRequest.analysis,
    created_at: savedRequest.createdAt,
    updated_at: savedRequest.updatedAt,
  })

  if (error) throw error
  notifyRequestChange()
  return savedRequest
}

export async function deleteMadagascarRequest(id: string) {
  const { error } = await createClient()
    .from(requestTable)
    .delete()
    .eq("id", id)
  if (error) throw error
  notifyRequestChange()
}

export async function downloadMadagascarDocument(
  document: {
    id: string
    name: string
    storagePath: string
  },
  downloadName = document.name
) {
  if (!document.storagePath)
    throw new Error("This document has no database storage path.")
  const result = await createClient()
    .storage.from(storageBucket)
    .download(document.storagePath)
  if (result.error) throw result.error
  const data = result.data
  const url = URL.createObjectURL(data)
  const anchor = window.document.createElement("a")
  anchor.href = url
  anchor.download = downloadName
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function listMadagascarRules() {
  const { data, error } = await createClient()
    .from(ruleTable)
    .select("*")
    .order("document_type")
    .order("created_at")
  if (error) throw error
  return ((data ?? []) as RuleRow[]).map(toRule)
}

export async function saveMadagascarRule(
  rule: Partial<MadagascarRule> &
    Pick<MadagascarRule, "documentType" | "title" | "instruction">
) {
  const now = new Date().toISOString()
  const saved: MadagascarRule = {
    id: rule.id ?? createMadagascarId("rule"),
    documentType: rule.documentType,
    title: rule.title,
    instruction: rule.instruction,
    enabled: rule.enabled ?? true,
    source: rule.source ?? "AI rejection review",
    createdAt: rule.createdAt ?? now,
    updatedAt: now,
  }
  const { error } = await createClient().from(ruleTable).upsert({
    id: saved.id,
    document_type: saved.documentType,
    title: saved.title,
    instruction: saved.instruction,
    enabled: saved.enabled,
    source: saved.source,
    created_at: saved.createdAt,
    updated_at: saved.updatedAt,
  })
  if (error) throw error
  return saved
}

export async function deleteMadagascarRule(id: string) {
  const { error } = await createClient().from(ruleTable).delete().eq("id", id)
  if (error) throw error
}
