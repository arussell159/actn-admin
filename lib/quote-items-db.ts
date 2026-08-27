import { createPublicClient } from "@/lib/public-client"
import type { QuoteCatalogItem } from "@/lib/quote-items-catalog"

export type QuoteLineItem = QuoteCatalogItem & {
  quantity: number
  unitPrice: number
  lineTotal: number
}

export type QuoteRecord = {
  id: string
  countryName: string
  zone: string
  sortingField: string
  notes: string
  items: QuoteLineItem[]
  totals: {
    subtotal: number
    discountAmount: number
    taxAmount: number
    total: number
  }
}

function hasSupabaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
}

function getSupabaseClient() {
  if (!hasSupabaseConfig()) {
    return undefined
  }

  return createPublicClient()
}

type QuoteItemRow = {
  internal_id: string
  name: string
  class_name: string
  description: string
  base_price: number
  tariff_usd: number
  tariff_eur: number
  pricing_group: string
  sorting_field: string
  bulk_units: string
  zone: string
  country_name: string
}

function toQuoteItem(row: QuoteItemRow): QuoteCatalogItem {
  return {
    internalId: row.internal_id,
    name: row.name,
    className: row.class_name,
    description: row.description,
    basePrice: Number(row.base_price) || 0,
    tariffUsd: Number(row.tariff_usd) || 0,
    tariffEur: Number(row.tariff_eur) || 0,
    pricingGroup: row.pricing_group,
    sortingField: row.sorting_field,
    bulkUnits: row.bulk_units,
    zone: row.zone || "ROW",
    countryName: row.country_name,
  }
}

function toQuoteItemRow(item: QuoteCatalogItem): QuoteItemRow {
  return {
    internal_id: item.internalId,
    name: item.name,
    class_name: item.className,
    description: item.description,
    base_price: item.basePrice,
    tariff_usd: item.tariffUsd,
    tariff_eur: item.tariffEur,
    pricing_group: item.pricingGroup,
    sorting_field: item.sortingField,
    bulk_units: item.bulkUnits,
    zone: item.zone || "ROW",
    country_name: item.countryName,
  }
}

async function upsertQuoteItemRows(items: QuoteCatalogItem[]) {
  const supabase = getSupabaseClient()

  if (!supabase) {
    return
  }

  const chunkSize = 100

  for (let index = 0; index < items.length; index += chunkSize) {
    const rows = items.slice(index, index + chunkSize).map(toQuoteItemRow)
    const { error } = await supabase.from("quote_items").upsert(rows, {
      onConflict: "internal_id",
    })

    if (error) {
      throw error
    }
  }
}

export async function listQuoteItems() {
  const supabase = getSupabaseClient()

  if (!supabase) {
    return []
  }

  const { data, error } = await supabase
    .from("quote_items")
    .select("*")
    .order("country_name", { ascending: true })
    .order("sorting_field", { ascending: true })
    .returns<QuoteItemRow[]>()

  if (error) {
    throw error
  }

  return (data ?? []).map(toQuoteItem)
}

export async function syncQuoteItemCatalog(items: QuoteCatalogItem[]) {
  const supabase = getSupabaseClient()

  if (!supabase) {
    return
  }

  await upsertQuoteItemRows(items)
}

export async function replaceQuoteItemCatalog(items: QuoteCatalogItem[]) {
  const supabase = getSupabaseClient()

  if (!supabase) {
    throw new Error("Supabase is not configured for pricing uploads.")
  }

  const { error: deleteError } = await supabase
    .from("quote_items")
    .delete()
    .neq("internal_id", "")

  if (deleteError) {
    throw deleteError
  }

  await upsertQuoteItemRows(items)
}

export async function saveQuoteRecord(record: QuoteRecord) {
  const supabase = getSupabaseClient()

  if (!supabase) {
    throw new Error("Supabase is not configured for saving quotes.")
  }

  const now = new Date().toISOString()
  const { error } = await supabase.from("quote_records").upsert(
    {
      id: record.id,
      quote_number: record.id,
      quote_date: new Date().toISOString().slice(0, 10),
      valid_until: new Date().toISOString().slice(0, 10),
      country_name: record.countryName,
      zone: record.zone,
      currency: "USD",
      customer: "",
      contact: "",
      email: "",
      origin: "",
      destination: "",
      notes: record.notes,
      items: record.items,
      totals: { ...record.totals, sortingField: record.sortingField },
      updated_at: now,
    },
    { onConflict: "id" }
  )

  if (error) {
    throw error
  }
}
