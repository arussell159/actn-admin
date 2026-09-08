"use client"

import { createClient } from "@/lib/client"
import {
  createMadagascarId,
  madagascarOfficialRuleDefinitions,
  type MadagascarRequest,
  type MadagascarRule,
} from "@/lib/madagascar-bsc"
import {
  readJsonBrowserStorage,
  writeBrowserStorage,
} from "@/lib/browser-storage"

const requestTable = "madagascar_bsc_requests"
const ruleTable = "madagascar_bsc_rules"
const storageBucket = "madagascar-bsc"
const requestCacheKey = "actn-madagascar-bsc-requests-v1"
const ruleCacheKey = "actn-madagascar-bsc-rules-v1"
const documentDatabaseName = "actn-madagascar-bsc-documents"
const documentStoreName = "documents"

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

function isRequestArray(value: unknown): value is MadagascarRequest[] {
  return Array.isArray(value)
}

function isRuleArray(value: unknown): value is MadagascarRule[] {
  return Array.isArray(value)
}

export function loadCachedMadagascarRequests() {
  const requests = readJsonBrowserStorage({
    kind: "localStorage",
    key: requestCacheKey,
    fallback: [],
    validate: isRequestArray,
  })

  return requests.map((request) => ({
    ...request,
    country: request.country || request.analysis?.consigneeCountry || "Unknown",
  }))
}

export function loadCachedMadagascarRules() {
  const createdAt = "2026-03-11T00:00:00.000Z"
  const officialRules: MadagascarRule[] = madagascarOfficialRuleDefinitions.map(
    (rule) => ({
      ...rule,
      enabled: true,
      source: "AfricaCTN Madagascar regulations",
      createdAt,
      updatedAt: createdAt,
    })
  )

  return readJsonBrowserStorage({
    kind: "localStorage",
    key: ruleCacheKey,
    fallback: officialRules,
    validate: isRuleArray,
  })
}

function openDocumentDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(documentDatabaseName, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(documentStoreName)) {
        request.result.createObjectStore(documentStoreName)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function saveDocumentBlob(id: string, file: File) {
  const database = await openDocumentDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(documentStoreName, "readwrite")
    transaction.objectStore(documentStoreName).put(file, id)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  database.close()
}

async function loadDocumentBlob(id: string) {
  const database = await openDocumentDatabase()
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const request = database
      .transaction(documentStoreName, "readonly")
      .objectStore(documentStoreName)
      .get(id)
    request.onsuccess = () => resolve(request.result as Blob | undefined)
    request.onerror = () => reject(request.error)
  })
  database.close()
  return blob
}

function cacheRequests(requests: MadagascarRequest[]) {
  writeBrowserStorage("localStorage", requestCacheKey, JSON.stringify(requests))
}

function cacheRules(rules: MadagascarRule[]) {
  writeBrowserStorage("localStorage", ruleCacheKey, JSON.stringify(rules))
}

function toRequest(row: RequestRow): MadagascarRequest {
  return {
    id: row.id,
    reference: row.reference,
    country: row.country || row.analysis?.consigneeCountry || "Unknown",
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
  const cached = loadCachedMadagascarRequests()

  try {
    const { data, error } = await createClient()
      .from(requestTable)
      .select("*")
      .order("created_at", { ascending: false })

    if (error) throw error
    const requests = ((data ?? []) as RequestRow[]).map(toRequest)
    cacheRequests(requests)
    return requests
  } catch {
    return cached
  }
}

export async function saveMadagascarRequest(
  request: MadagascarRequest,
  files: File[]
) {
  const client = createClient()
  const documents = await Promise.all(
    request.documents.map(async (document, index) => {
      const file = files[index]
      if (!file) return document
      await saveDocumentBlob(document.id, file).catch(() => undefined)
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-")
      const storagePath = `${request.id}/${document.id}-${safeName}`
      const { error } = await client.storage
        .from(storageBucket)
        .upload(storagePath, file, { upsert: true, contentType: file.type })

      return error ? document : { ...document, storagePath }
    })
  )
  const savedRequest = { ...request, documents }
  const cached = [
    savedRequest,
    ...loadCachedMadagascarRequests().filter((item) => item.id !== request.id),
  ]
  cacheRequests(cached)

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

  if (error && !/does not exist|schema cache/i.test(error.message)) {
    throw error
  }

  return savedRequest
}

export async function downloadMadagascarDocument(document: {
  id: string
  name: string
  storagePath: string
}) {
  let data: Blob | undefined

  if (document.storagePath) {
    const result = await createClient()
      .storage.from(storageBucket)
      .download(document.storagePath)
    if (!result.error) data = result.data
  }

  data ??= await loadDocumentBlob(document.id).catch(() => undefined)

  if (!data) throw new Error("The uploaded document could not be retrieved.")
  const url = URL.createObjectURL(data)
  const anchor = window.document.createElement("a")
  anchor.href = url
  anchor.download = document.name
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function listMadagascarRules() {
  const cached = loadCachedMadagascarRules()
  try {
    const { data, error } = await createClient()
      .from(ruleTable)
      .select("*")
      .order("document_type")
      .order("created_at")

    if (error) throw error
    const rules = ((data ?? []) as RuleRow[]).map(toRule)
    cacheRules(rules)
    return rules
  } catch {
    return cached
  }
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
  cacheRules([
    saved,
    ...loadCachedMadagascarRules().filter((item) => item.id !== saved.id),
  ])

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
  if (error && !/does not exist|schema cache/i.test(error.message)) throw error
  return saved
}

export async function deleteMadagascarRule(id: string) {
  cacheRules(loadCachedMadagascarRules().filter((rule) => rule.id !== id))
  const { error } = await createClient().from(ruleTable).delete().eq("id", id)
  if (error && !/does not exist|schema cache/i.test(error.message)) throw error
}
