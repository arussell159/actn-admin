export type MadagascarDocumentType =
  | "Bill of Lading"
  | "Commercial Invoice"
  | "Packing List"
  | "Export/Customs Declaration"
  | "Export Declaration"
  | "Customs Declaration"
  | "DU (Documento Unico)"
  | "Certificate of Origin"
  | "Freight Invoice"
  | "Unknown"

const documentTypeAbbreviations: Record<string, string> = {
  "bill of lading": "BL",
  "commercial invoice": "CI",
  "freight invoice": "FI",
  "export declaration": "ED",
  "export/customs declaration": "ED",
  "customs declaration": "ED",
  "du (documento unico)": "DU",
  "packing list": "PL",
  fdi: "FDI",
  "certificate of origin": "COO",
  "certificate of insurance": "COI",
  du: "DU",
  cnca: "CNCA",
}

const certificateDocumentTypeOrder: Record<string, number> = {
  "bill of lading": 0,
  "commercial invoice": 1,
  "freight invoice": 2,
  "packing list": 3,
  "export declaration": 4,
  "export/customs declaration": 4,
  "customs declaration": 4,
  "du (documento unico)": 5,
  du: 5,
  fdi: 6,
  "certificate of origin": 7,
  "certificate of insurance": 8,
}

export function certificateDocumentTypeRank(documentType: string) {
  return (
    certificateDocumentTypeOrder[documentType.trim().toLowerCase()] ??
    Number.MAX_SAFE_INTEGER
  )
}

export function documentTypeAbbreviation(documentType: string) {
  const normalized = documentType.trim().toLowerCase()
  const configured = documentTypeAbbreviations[normalized]
  if (configured) return configured

  if (/^[a-z0-9]{2,5}$/i.test(documentType.trim())) {
    return documentType.trim().toUpperCase()
  }

  const acronym = normalized
    .split(/[^a-z0-9]+/)
    .filter((word) => word && !["a", "an", "and", "of", "the"].includes(word))
    .map((word) => word[0])
    .join("")
    .toUpperCase()

  return acronym || "DOC"
}

export function certificateDocumentDownloadName(
  documentType: string,
  billOfLadingNumber: string,
  originalFileName: string
) {
  const extension = originalFileName.match(/\.[a-z0-9]{1,10}$/i)?.[0] ?? ""
  const safeBillOfLadingNumber = billOfLadingNumber
    .trim()
    .replace(/[^a-z0-9_-]+/gi, "_")
    .replace(/^_+|_+$/g, "")

  return `${documentTypeAbbreviation(documentType)}_${safeBillOfLadingNumber || "UNKNOWN"}${extension}`
}

export type MadagascarValueStatus =
  "extracted" | "derived" | "missing" | "conflict"

export type MadagascarExtractedField = {
  key: string
  label: string
  value: string
  status: MadagascarValueStatus
  source: string
  note: string
}

export type MadagascarInvoiceItem = {
  description: string
  hsCode: string
  brand: string
  reference: string
  originCountry: string
  packageType: string
  quantity: string
  unitOfMeasurement: string
  unitPrice: string
  totalPrice: string
  currency: string
  isSecondHand: string
  source: string
  issues: string[]
}

export type MadagascarInvoiceValue = {
  label: string
  value: string
  status: MadagascarValueStatus
  source: string
  note: string
}

export type MadagascarAnalysis = {
  okf?: import("./okf/schema").KnowledgeReview
  okfOverrides?: Record<string, import("./okf/schema").ReviewFinding>
  consigneeCountry: string
  documents: {
    fileName: string
    documentType: MadagascarDocumentType
    confidence: string
    note: string
  }[]
  fields: MadagascarExtractedField[]
  invoiceValues: MadagascarInvoiceValue[]
  invoiceItems: MadagascarInvoiceItem[]
  issues: string[]
  missingCorrectionsMessage: string
}

export type MadagascarDocument = {
  id: string
  name: string
  type: string
  size: number
  storagePath: string
}

export type MadagascarRequest = {
  id: string
  reference: string
  country: string
  status: "Needs review" | "Ready"
  documents: MadagascarDocument[]
  analysis: MadagascarAnalysis
  createdAt: string
  updatedAt: string
}

export type MadagascarRule = {
  id: string
  documentType: MadagascarDocumentType | "Cross-document"
  title: string
  instruction: string
  enabled: boolean
  source: string
  createdAt: string
  updatedAt: string
}

export type MadagascarDropdownOptions = Record<string, string[]>
export type MadagascarIncotermOption = {
  order: number
  haveFreight: boolean
  haveInsurance: boolean
  haveOtherCharges: boolean
  label: string
  name: string
  id: number
}

export const madagascarIncotermOptions: MadagascarIncotermOption[] = [
  {
    order: 1,
    haveFreight: false,
    haveInsurance: false,
    haveOtherCharges: false,
    label: "INCOTERM.EXW",
    name: "EXW",
    id: 1,
  },
  {
    order: 2,
    haveFreight: false,
    haveInsurance: false,
    haveOtherCharges: false,
    label: "INCOTERM.FCA",
    name: "FCA",
    id: 2,
  },
  {
    order: 3,
    haveFreight: false,
    haveInsurance: false,
    haveOtherCharges: false,
    label: "INCOTERM.FAS",
    name: "FAS",
    id: 3,
  },
  {
    order: 4,
    haveFreight: false,
    haveInsurance: false,
    haveOtherCharges: false,
    label: "INCOTERM.FOB",
    name: "FOB",
    id: 4,
  },
  {
    order: 5,
    haveFreight: true,
    haveInsurance: false,
    haveOtherCharges: false,
    label: "INCOTERM.CFR",
    name: "CFR",
    id: 5,
  },
  {
    order: 6,
    haveFreight: true,
    haveInsurance: false,
    haveOtherCharges: false,
    label: "INCOTERM.CPT",
    name: "CPT",
    id: 6,
  },
  {
    order: 7,
    haveFreight: true,
    haveInsurance: true,
    haveOtherCharges: false,
    label: "INCOTERM.CIF",
    name: "CIF",
    id: 7,
  },
  {
    order: 8,
    haveFreight: true,
    haveInsurance: true,
    haveOtherCharges: true,
    label: "INCOTERM.CIP",
    name: "CIP",
    id: 8,
  },
  {
    order: 9,
    haveFreight: true,
    haveInsurance: false,
    haveOtherCharges: true,
    label: "INCOTERM.DPU",
    name: "DPU",
    id: 9,
  },
  {
    order: 10,
    haveFreight: true,
    haveInsurance: false,
    haveOtherCharges: true,
    label: "INCOTERM.DAP",
    name: "DAP",
    id: 10,
  },
  {
    order: 11,
    haveFreight: false,
    haveInsurance: false,
    haveOtherCharges: false,
    label: "INCOTERM.DAPP",
    name: "DAPP",
    id: 12,
  },
  {
    order: 12,
    haveFreight: true,
    haveInsurance: false,
    haveOtherCharges: true,
    label: "INCOTERM.DDP",
    name: "DDP",
    id: 11,
  },
]
export const madagascarShipmentMethodOptions = ["Air", "Sea"]
export const madagascarCargoTypeOptions = [
  "Car cargo",
  "Convential / General Cargo",
  "Dry bulk cargo",
  "Full container load",
  "Hazardous cargo",
  "Liquid bulk cargo",
  "Less container load",
  "Refrigerated cargo",
  "Unknown",
]
export const madagascarContainerTypeOptions = [
  "Reefer",
  "FlatRack",
  "HardTop",
  "Dry",
  "Isotherm",
  "Open Top",
  "Tank",
  "Ventilated Container",
  "Open Side / Side Door",
]
export const madagascarContainerSizeOptions = [
  "10 M3",
  "20 M3",
  "20 Feet",
  "40 Feet",
  "Other",
]

export const madagascarFieldGroups = [
  {
    title: "Trade Parties",
    fields: [
      ["exporterName", "Name"],
      ["exporterAddress", "Address"],
      ["exporterCountry", "Country"],
      ["importerName", "Name"],
      ["importerAddress", "Address"],
      ["importerCountry", "Country"],
    ],
  },
  {
    title: "Invoices",
    fields: [
      ["incoterm", "Incoterm"],
      ["incotermPlace", "Incoterm Place"],
      ["fobValue", "FOB Value"],
      ["currency", "Currency"],
      ["commercialInvoiceReference", "Commercial Invoice Reference"],
      ["commercialInvoiceDate", "Commercial Invoice Issuance Date"],
      ["packingListReference", "Packing List Reference"],
      ["packingListDate", "Packing List Issuance Date"],
    ],
  },
  {
    title: "Shipment",
    fields: [
      ["shipmentMethod", "Shipment Method"],
      ["cargoType", "Cargo Type"],
      ["grossWeight", "Gross Weight"],
      ["volume", "Volume"],
      ["shippingLine", "Shipping Line"],
      ["voyage", "Voyage"],
      ["vessel", "Vessel"],
      ["containerNumber", "Container Number"],
      ["containerType", "Container Type"],
      ["containerSize", "Container Size"],
      ["sealNumber", "Seal Number"],
      ["loadingCountry", "Loading Country"],
      ["loadingDate", "Loading Date"],
      ["loadingCity", "Loading City"],
      ["unloadingCountry", "Unloading Country"],
      ["unloadingDate", "Unloading Date"],
      ["unloadingCity", "Unloading City"],
      ["exportDeclarationReference", "Export Declaration Reference"],
      ["exportDeclarationDate", "Export Declaration Issuance Date"],
      ["billOfLadingReference", "BL Reference"],
      ["billOfLadingDate", "BL Issuance Date"],
    ],
  },
] as const

export const madagascarFieldCatalog = madagascarFieldGroups.flatMap((group) =>
  group.fields.map(([key, label]) => ({ key, label }))
)

export const madagascarOfficialRuleDefinitions = [
  {
    id: "madagascar-commercial-invoice-parties",
    documentType: "Commercial Invoice" as const,
    title: "Trade parties and importer TIN",
    instruction:
      "Require the seller/exporter name or company name and exact address, plus the buyer/importer name or company name, exact address, and Tax Identification Number.",
  },
  {
    id: "madagascar-commercial-invoice-reference",
    documentType: "Commercial Invoice" as const,
    title: "Invoice date and sequential number",
    instruction:
      "Require an issue date and a sequential, continuous commercial invoice number.",
  },
  {
    id: "madagascar-commercial-invoice-goods",
    documentType: "Commercial Invoice" as const,
    title: "Goods identification",
    instruction:
      "Require a precise goods description suitable for HS classification, including brand, reference, origin, characteristics, and packaging.",
  },
  {
    id: "madagascar-commercial-invoice-values",
    documentType: "Commercial Invoice" as const,
    title: "Quantities and values",
    instruction:
      "Require detailed quantity, unit price with currency, total goods price, and total invoice amount in figures and words.",
  },
  {
    id: "madagascar-commercial-invoice-terms",
    documentType: "Commercial Invoice" as const,
    title: "Terms, payment, and signature",
    instruction:
      "Require the Incoterm, payment method, and exporter signature.",
  },
  {
    id: "madagascar-packing-list-sea",
    documentType: "Packing List" as const,
    title: "Sea shipment packing details",
    instruction:
      "For each sea container require total package count, packaging/loading/presentation method, package numbers or markings, units or pieces and precise contents per package, weight per package, and total shipment weight.",
  },
  {
    id: "madagascar-packing-list-other",
    documentType: "Packing List" as const,
    title: "Air, courier, and conventional cargo packing details",
    instruction:
      "Require precise identification of every package, airway bill package count and total weight where applicable, package numbers or markings, quantity, weight, and item description per package.",
  },
] as const

export function createMadagascarId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function normalizeMadagascarAnalysis(
  value: MadagascarAnalysis,
  dropdownOptions: MadagascarDropdownOptions
) {
  const returnedFields = new Map(
    value.fields.map((field) => [field.key, field])
  )
  const legacyInvoiceValueFields = [
    ["fobValue", "FOB Value"],
    ["freightValue", "Freight Value"],
    ["insuranceValue", "Insurance Value"],
    ["otherChargesValue", "Other Charges"],
    ["exwValue", "EXW Value"],
    ["cfrValue", "CFR Value"],
    ["cifValue", "CIF Value"],
    ["invoiceTotalValue", "Invoice Total Value"],
  ] as const
  const invoiceValues = Array.isArray(value.invoiceValues)
    ? value.invoiceValues.map((invoiceValue) => ({
        ...invoiceValue,
        label: invoiceValue.label.trim(),
        value: invoiceValue.value.trim(),
      }))
    : legacyInvoiceValueFields.flatMap(([key, label]) => {
        const field = returnedFields.get(key)
        return field
          ? [
              {
                label,
                value: field.value,
                status: field.status,
                source: field.source,
                note: field.note,
              },
            ]
          : []
      })
  const fields = madagascarFieldCatalog.map(({ key, label }) => {
    const legacyKey =
      key === "exporterName"
        ? "exporter"
        : key === "importerName"
          ? "importer"
          : undefined
    const field =
      returnedFields.get(key) ??
      (legacyKey ? returnedFields.get(legacyKey) : undefined)

    if (!field) {
      return {
        key,
        label,
        value: "",
        status: "missing" as const,
        source: "",
        note: "Not found in the uploaded documents.",
      }
    }

    const options = dropdownOptions[key] ?? []
    if (options.length && field.value && !options.includes(field.value)) {
      return {
        ...field,
        label,
        value: "",
        status: "conflict" as const,
        note: `${field.note ? `${field.note} ` : ""}The extracted value does not exactly match an allowed certificate option.`,
      }
    }

    return { ...field, key, label }
  })

  const validUnits = new Set(
    optionsValue(dropdownOptions, "invoiceItemUnitOfMeasurement")
  )
  const validCountries = new Set(
    optionsValue(dropdownOptions, "invoiceItemOriginCountry")
  )
  const validYesNo = new Set(
    optionsValue(dropdownOptions, "invoiceItemIsSecondHand")
  )
  const invoiceItems = value.invoiceItems.map((item) => {
    const issues = [...item.issues]
    const unitOfMeasurement = validUnits.has(item.unitOfMeasurement)
      ? item.unitOfMeasurement
      : ""
    const originCountry = validCountries.has(item.originCountry)
      ? item.originCountry
      : ""
    const isSecondHand = validYesNo.has(item.isSecondHand)
      ? item.isSecondHand
      : ""
    const quantity = Number(item.quantity.replaceAll(",", ""))
    const unitPrice = Number(item.unitPrice.replaceAll(",", ""))

    if (item.unitOfMeasurement && !unitOfMeasurement) {
      issues.push(
        "Unit of Measurement could not be mapped to a template option."
      )
    }
    if (item.originCountry && !originCountry) {
      issues.push("Country could not be mapped to a template option.")
    }
    if (item.isSecondHand && !isSecondHand) {
      issues.push("Is second hand could not be mapped to Yes or No.")
    }
    if (item.quantity && !Number.isFinite(quantity)) {
      issues.push("Quantity is not a safe numeric template value.")
    }
    if (item.unitPrice && !Number.isFinite(unitPrice)) {
      issues.push("Unit FOB Value is not a safe numeric template value.")
    }

    return {
      ...item,
      unitOfMeasurement,
      originCountry,
      isSecondHand,
      quantity: Number.isFinite(quantity) ? item.quantity : "",
      unitPrice: Number.isFinite(unitPrice) ? item.unitPrice : "",
      issues: Array.from(new Set(issues)),
    }
  })

  const requiredDocumentTypes: MadagascarDocumentType[] = []
  const classifiedDocumentTypes = new Set(
    value.documents.map((document) => document.documentType)
  )
  const missingDocumentTypes = requiredDocumentTypes.filter(
    (documentType) => !classifiedDocumentTypes.has(documentType)
  )
  const missingDocumentIssues = missingDocumentTypes.map(
    (documentType) => `Missing required document: ${documentType}.`
  )
  const issues = Array.from(
    new Set([...value.issues, ...missingDocumentIssues])
  )
  const missingCorrectionsMessage =
    value.missingCorrectionsMessage.trim() ||
    missingDocumentTypes
      .map((documentType) => `The ${documentType} is missing.`)
      .join("\n\n")

  return {
    ...value,
    consigneeCountry: value.consigneeCountry?.trim() ?? "",
    fields,
    invoiceValues,
    invoiceItems,
    issues,
    missingCorrectionsMessage,
  }
}

function optionsValue(options: MadagascarDropdownOptions, key: string) {
  return options[key] ?? []
}

export function requestReference(analysis: MadagascarAnalysis) {
  const field = analysis.fields.find(
    (item) => item.key === "billOfLadingReference"
  )

  return field?.value || `ECTN Certificate ${new Date().toLocaleDateString()}`
}
