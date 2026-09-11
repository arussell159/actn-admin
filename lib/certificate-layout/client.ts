"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/client"
import { layoutCatalogSchema, type CertificateLayoutRecord } from "./schema"

const changedEvent = "actn-certificate-layouts-changed"
let memory:
  | { rows: CertificateLayoutRecord[]; etag: string; checkedAt: number }
  | undefined
let inFlight: Promise<CertificateLayoutRecord[]> | undefined
const deletedRevisions = new Map<string, number>()
function cached() {
  return memory
}
function remember(rows: CertificateLayoutRecord[], etag: string) {
  rows = rows.filter(
    (row) => row.revision > (deletedRevisions.get(row.country_key) ?? -1)
  )
  // A GET that started before publishing must not replace the newer revision.
  const newer = (memory?.rows ?? []).filter(
    (old) =>
      old.revision > (deletedRevisions.get(old.country_key) ?? -1) &&
      !rows.some(
        (row) =>
          row.country_key === old.country_key && row.revision >= old.revision
      )
  )
  if (newer.length) {
    rows = [
      ...rows.filter(
        (row) => !newer.some((old) => old.country_key === row.country_key)
      ),
      ...newer,
    ]
    etag = ""
  }
  memory = { rows, etag, checkedAt: Date.now() }
  window.dispatchEvent(new Event(changedEvent))
  return rows
}
export async function loadCertificateLayouts(force = false) {
  const previous = cached()
  if (!force && previous && Date.now() - previous.checkedAt < 60_000)
    return previous.rows
  if (inFlight) return inFlight
  inFlight = (async () => {
    const response = await fetch("/api/okf/layouts", {
      headers: previous?.etag ? { "If-None-Match": previous.etag } : {},
      cache: "no-cache",
    })
    if (response.status === 304 && previous)
      return remember(previous.rows, previous.etag)
    const value = await response.json()
    if (!response.ok)
      throw Error(value.message || "Could not load certificate layouts.")
    const { rows } = layoutCatalogSchema.parse(value)
    return remember(rows, response.headers.get("etag") || "")
  })().finally(() => {
    inFlight = undefined
  })
  return inFlight
}
export function cachePublishedLayout(row: CertificateLayoutRecord) {
  deletedRevisions.delete(row.country_key)
  const rows = (cached()?.rows ?? []).filter(
    (existing) => existing.country_key !== row.country_key
  )
  remember([...rows, row], "")
  // Other countries must still be checked against the server on the next fetch.
  if (memory) memory.checkedAt = 0
}
export function cacheDeletedLayout(countryKey: string, revision: number) {
  deletedRevisions.set(countryKey, revision)
  remember(
    (cached()?.rows ?? []).filter((row) => row.country_key !== countryKey),
    ""
  )
  if (memory) memory.checkedAt = 0
}
export function useCertificateLayouts() {
  const [rows, setRows] = useState<CertificateLayoutRecord[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    setRows(cached()?.rows ?? [])
    const sync = () => {
      if (active) setRows(cached()?.rows ?? [])
    }
    const refresh = () => {
      void loadCertificateLayouts(true)
        .then((result) => {
          if (active) {
            setRows(result)
            setError("")
          }
        })
        .catch((error) => {
          if (active) setError(error.message)
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }
    const client = createClient()
    const channel = client
      .channel("shared-certificate-layouts")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "okf_certificate_layouts",
        },
        refresh
      )
      .subscribe()
    window.addEventListener(changedEvent, sync)
    window.addEventListener("focus", refresh)
    refresh()
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh()
    }, 60_000)
    return () => {
      active = false
      clearInterval(interval)
      void client.removeChannel(channel)
      window.removeEventListener(changedEvent, sync)
      window.removeEventListener("focus", refresh)
    }
  }, [])
  return { rows, error, loading }
}
