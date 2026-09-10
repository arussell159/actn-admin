import {
  documentNames,
  type KnowledgePage,
  type KnowledgeState,
} from "../okf/schema"
import {
  sharedExtractionInstructions,
  sharedMappingGuidance,
} from "../okf/seed"
import { layoutPlacements, type CertificateLayoutRecord } from "./schema"

// Certificate Settings is authoritative for the certificate's fields and their
// document sources. Country knowledge can still contribute requirements and
// validation rules, but it cannot replace a configured certificate mapping.
export function knowledgeWithLayout(
  state: KnowledgeState,
  record: CertificateLayoutRecord
): KnowledgeState {
  const { layout } = record
  const countryPages = state.pages.filter(
    (page) => page.country === layout.country
  )
  const publishedFields = countryPages.flatMap((page) => page.content.fields)
  const publishedMappings = new Map(
    countryPages
      .flatMap((page) => page.content.mappings)
      .map((mapping) => [mapping.systemFieldId, mapping])
  )
  const placed = new Set(
    layoutPlacements(layout).map((placement) => placement.fieldId)
  )
  const knowledgePages = state.pages.map((page) =>
    page.country === layout.country
      ? {
          ...page,
          content: {
            ...page.content,
            mappings: page.content.mappings.filter(
              (mapping) => !placed.has(mapping.systemFieldId)
            ),
          },
        }
      : page
  )
  const pages: KnowledgePage[] = []
  function page(document: string): KnowledgePage {
    return {
      id: `layout-${record.country_key.slice(0, 40)}-${pages.length}`,
      title: document,
      country: layout.country,
      template: document ? "document" : "mappings",
      revision: record.revision,
      version: `1.0.${record.revision}`,
      publishedAt: record.updated_at,
      content: {
        sections: [],
        fields: [],
        mappings: [],
        rules: [],
        sources: [],
        aliases: [],
      },
    }
  }
  const mappingPage = page("")
  pages.push(mappingPage)
  for (const field of layout.fields) {
    if (
      !placed.has(field.id) ||
      !documentNames.some((name) => name === field.sourceDocument)
    )
      continue
    let documentPage = pages.find((page) => page.title === field.sourceDocument)
    if (!documentPage) {
      documentPage = page(field.sourceDocument)
      pages.push(documentPage)
    }
    const matchingFields = publishedFields.filter((candidate) =>
      candidate.portalFieldIds.includes(field.id)
    )
    const publishedField =
      matchingFields.find(
        (candidate) => candidate.document === field.sourceDocument
      ) ?? matchingFields[0]
    const publishedMapping = publishedMappings.get(field.id)
    const publishedEntryRule =
      publishedMapping?.entryRule ===
      "Use the documented value and existing dropdown options."
        ? ""
        : publishedMapping?.entryRule
    const instruction =
      publishedField?.instruction ||
      field.instruction ||
      publishedEntryRule ||
      sharedExtractionInstructions[field.id] ||
      `Read the explicitly stated ${field.label}. Leave missing values blank.`
    const sharedMapping = sharedMappingGuidance[field.id]
    const sourceId = `${documentPage.id}-${field.id}`
    documentPage.content.fields.push({
      id: sourceId,
      label: field.label,
      document: field.sourceDocument,
      location: "",
      requiredWhen: "",
      instruction,
      portalFieldIds: [field.id],
      ruleIds: [],
    })
    mappingPage.content.mappings.push({
      id: sourceId + "-map",
      systemFieldId: field.id,
      sourceFieldIds: [sourceId],
      fallbackSourceIds: [],
      entryRule: publishedEntryRule || instruction,
      ifMissing:
        publishedMapping?.ifMissing ||
        "No supported value in the configured source document.",
      transform:
        publishedMapping?.transform && publishedMapping.transform !== "none"
          ? publishedMapping.transform
          : (sharedMapping?.transform ?? "none"),
      unit: publishedMapping?.unit || sharedMapping?.unit || "",
      repeated: field.id.startsWith("invoiceItems."),
      ruleIds: [],
    })
  }
  return { ...state, pages: [...knowledgePages, ...pages] }
}
