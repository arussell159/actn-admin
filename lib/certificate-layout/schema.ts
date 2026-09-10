import { z } from "zod"
import { editableCertificateLayout } from "./default-sections"

const identifier = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_.-]{0,79}$/)
const title = z.string().trim().min(1).max(160)
const columns = z.number().int().min(1).max(4)
export const certificateFieldSchema = z.object({
  id: identifier,
  label: title,
  control: z.enum(["text", "textarea", "date", "number", "select"]),
  options: z.array(z.string().trim().min(1).max(200)).max(500),
  sourceDocument: z.string().max(160),
  instruction: z.string().max(4000),
})
export type CertificateField = z.infer<typeof certificateFieldSchema>
export type FieldPlacement = {
  fieldId: string
  span: number
  label?: string
  row?: number
  column?: number
}
export type CertificateGroup = {
  id: string
  title: string
  kind:
    "fields" | "invoice-values" | "invoice-items" | "documents" | "corrections"
  columns: number
  span: number
  separator: boolean
  breakpoint: "sm" | "md"
  fields: FieldPlacement[]
  groups: CertificateGroup[]
}
export const certificateGroupSchema: z.ZodType<CertificateGroup> = z.lazy(() =>
  z.object({
    id: identifier,
    title: z.string().max(160),
    kind: z.enum([
      "fields",
      "invoice-values",
      "invoice-items",
      "documents",
      "corrections",
    ]),
    columns,
    span: columns,
    separator: z.boolean(),
    breakpoint: z.enum(["sm", "md"]),
    fields: z
      .array(
        z.object({
          fieldId: identifier,
          span: columns,
          label: z.string().max(160).optional(),
          row: z.number().int().min(1).max(100).optional(),
          column: columns.optional(),
        })
      )
      .max(100),
    groups: z.array(certificateGroupSchema).max(30),
  })
)
export const certificateLayoutSchema = z
  .object({
    schemaVersion: z.literal(1),
    country: title,
    aliases: z.array(title).max(30),
    fields: z.array(certificateFieldSchema).max(200),
    sections: z
      .array(
        z.object({
          id: identifier,
          title,
          columns,
          groups: z.array(certificateGroupSchema).max(30),
        })
      )
      .min(1)
      .max(30),
  })
  .superRefine((layout, context) => {
    const fail = (message: string) =>
      context.addIssue({ code: "custom", message })
    if (!/^[a-z][a-z0-9-]{0,79}$/.test(countryKey(layout.country)))
      fail(
        "Enter a country name beginning with a letter (up to 80 characters)."
      )
    if (layout.aliases.some((name) => !countryKey(name)))
      fail("Country aliases must contain letters or numbers.")
    const fields = new Set<string>()
    for (const field of layout.fields) {
      if (fields.has(field.id)) fail(`Duplicate field ID: ${field.id}`)
      fields.add(field.id)
      if (field.control === "select" && !field.options.length)
        fail(`Add choices for ${field.label}.`)
      if (new Set(field.options).size !== field.options.length)
        fail(`Duplicate choices for ${field.label}.`)
    }
    const ids = new Set<string>(),
      placed = new Set<string>()
    let groupCount = 0
    function groups(
      items: CertificateGroup[],
      parentColumns: number,
      depth: number
    ) {
      if (depth > 3 && items.length) {
        fail("Use at most three levels of subsections.")
        return
      }
      for (const group of items) {
        if (++groupCount > 150) {
          fail("Use at most 150 subsections.")
          return
        }
        if (ids.has(group.id)) fail(`Duplicate section ID: ${group.id}`)
        ids.add(group.id)
        if (group.span > parentColumns)
          fail(
            `Subsection ${group.title || group.id} exceeds its parent's columns.`
          )
        for (const placement of group.fields) {
          if (!fields.has(placement.fieldId))
            fail(`Unknown field: ${placement.fieldId}`)
          if (placed.has(placement.fieldId))
            fail(`Place ${placement.fieldId} only once.`)
          placed.add(placement.fieldId)
          if (placement.span > group.columns)
            fail(`Field ${placement.fieldId} exceeds its subsection's columns.`)
          if (placement.column && placement.column > group.columns)
            fail(
              `Field ${placement.fieldId} starts beyond its subsection's columns.`
            )
          if (
            placement.fieldId.startsWith("invoiceItems.") !==
            (group.kind === "invoice-items")
          )
            fail("Invoice item columns belong in an Invoice items subsection.")
        }
        groups(group.groups, group.columns, depth + 1)
      }
    }
    for (const section of layout.sections) {
      if (ids.has(section.id)) fail(`Duplicate section ID: ${section.id}`)
      ids.add(section.id)
      groups(section.groups, section.columns, 1)
    }
  })
export type CertificateLayout = z.infer<typeof certificateLayoutSchema>
export const layoutRecordSchema = z.object({
  country_key: identifier,
  layout: certificateLayoutSchema.transform(editableCertificateLayout),
  revision: z.number().int().positive(),
  updated_at: z.string(),
  updated_by: z.string().nullable(),
})
export type CertificateLayoutRecord = z.infer<typeof layoutRecordSchema>
export const layoutCatalogSchema = z.object({
  rows: z.array(layoutRecordSchema).max(300),
})
export const countryKey = (country: string) =>
  country
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
export function resolveLayout(
  rows: CertificateLayoutRecord[],
  country: string
) {
  const key = countryKey(country)
  if (!key) return undefined
  const matches = rows.filter((row) =>
    [row.layout.country, ...row.layout.aliases].some(
      (name) => countryKey(name) === key
    )
  )
  return matches.length === 1 ? matches[0] : undefined
}
export function layoutPlacements(layout: CertificateLayout) {
  const result: FieldPlacement[] = []
  function visit(groups: CertificateGroup[]) {
    for (const group of groups) {
      result.push(...group.fields)
      visit(group.groups)
    }
  }
  for (const section of layout.sections) visit(section.groups)
  return result
}
