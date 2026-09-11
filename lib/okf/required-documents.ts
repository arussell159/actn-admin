export const sharedRequiredDocuments = [
  "Bill of Lading",
  "Commercial Invoice",
  "Freight Invoice",
] as const

const canonicalDocumentTitles = [
  "Bill of Lading",
  "Commercial Invoice",
  "Freight Invoice",
  "Packing List",
  "Export Declaration",
  "DU (Documento Único)",
  "ARCCLA Form",
  "Certificate of Origin",
] as const

export function canonicalDocumentTitle(title: string) {
  const normalized = title.trim().toLocaleLowerCase()
  return canonicalDocumentTitles.find(
    (documentTitle) => documentTitle.toLocaleLowerCase() === normalized
  )
}

export function requiredDocumentsForCountry(country: string): string[] {
  if (country.toLocaleLowerCase() === "angola")
    return [
      ...sharedRequiredDocuments,
      "DU (Documento Único)",
      "ARCCLA Form",
    ]
  if (country.toLocaleLowerCase() === "madagascar")
    return [
      "Bill of Lading",
      "Commercial Invoice",
      "Freight Invoice",
      "Packing List",
      "Export Declaration",
    ]
  return [...sharedRequiredDocuments]
}
