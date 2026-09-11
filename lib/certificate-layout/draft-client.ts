"use client"

import { authenticatedFetch } from "@/lib/client"

import {
  layoutDraftRecordSchema,
  type CertificateLayout,
  type CertificateLayoutDraftRecord,
} from "./schema"

async function draftRequest<T>(url: string, init?: RequestInit) {
  const response = await authenticatedFetch(url, { ...init, cache: "no-store" })
  const value = await response.json()
  if (!response.ok)
    throw new Error(value.message || "Could not access the layout draft.")
  return value as T
}

export async function loadCertificateLayoutDraft(draftKey: string) {
  const value = await draftRequest<{ draft: unknown }>(
    `/api/okf/layouts/draft?key=${encodeURIComponent(draftKey)}`
  )
  return value.draft ? layoutDraftRecordSchema.parse(value.draft) : undefined
}

export async function saveCertificateLayoutDraft(input: {
  draftKey: string
  layout: CertificateLayout
  baseRevision: number
  expectedEdit: number
}): Promise<CertificateLayoutDraftRecord> {
  const value = await draftRequest<{ draft: unknown }>(
    "/api/okf/layouts/draft",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  )
  return layoutDraftRecordSchema.parse(value.draft)
}

export async function deleteCertificateLayoutDraft(
  draftKey: string,
  expectedEdit?: number
) {
  await draftRequest("/api/okf/layouts/draft", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ draftKey, expectedEdit: expectedEdit ?? null }),
  })
}
