import { createPublicClient } from "@/lib/public-client"
import {
  readBrowserStorage,
  removeBrowserStorage,
  writeBrowserStorage,
} from "@/lib/browser-storage"

export type CloseTaskId = "invoice" | "reconcile" | "journal"

export type TemplateCountryRow = {
  id: string
  name: string
  indent: number
  checkable?: boolean
  invoiceRequired?: boolean
  requiresPasteReport?: boolean
  combinedWithCountryIds?: string[]
  countryReportMapping?: ReportFieldMapping
  masterReportMapping?: ReportFieldMapping
  aiNotes?: string
  updatedAt?: string
}

export type ReportFieldMapping = {
  headerRowIndex: number
  fields: Partial<Record<ReportMappingField, string>>
  extraFields?: ReportExtraFieldMapping[]
  aiTrainingExamples?: ReportMappingAiTrainingExample[]
}

export type ReportMappingAiTrainingExample = {
  id: string
  createdAt: string
  columns: string[]
  rows: string[][]
  assignments: Partial<Record<ReportMappingField, string>>
}

export type ReportMappingField =
  | "invoiceNumber"
  | "ctnNumber"
  | "billOfLadingNumber"
  | "reference"
  | "amount"
  | "secondaryAmount"
  | "tertiaryAmount"
  | "salesOrderNumber"
  | "status"
  | "transactionDate"
  | "sellingDate"
  | "sourceClass"
  | "sourceInternalId"
  | "sourceCountryName"

export type ReportExtraFieldMapping = {
  id: string
  label: string
  sourceColumn: string
}

export type TemplateSimpleTask = {
  id: string
  label: string
}

export type TemplateModuleLevel = "organizational" | "personal"

export type TemplateModuleMeta = {
  tab?: string
  title?: string
  description?: string
  level?: TemplateModuleLevel
  updatedAt?: string
}

export type TemplateTaskGroup = {
  id: string
  tab: string
  title: string
  description: string
  tasks: TemplateSimpleTask[]
} & TemplateModuleMeta

export type MonthEndTemplate = {
  countriesModule?: TemplateModuleMeta
  countries: TemplateCountryRow[]
  taskGroups: TemplateTaskGroup[]
}

const storageKey = "africa-ctn-month-end-template"
const tableName = "month_end_templates"
const templateId = "default"
const defaultUpdatedAt = "2026-08-26T00:00:00.000Z"

export const defaultCountryReportMapping: ReportFieldMapping = {
  headerRowIndex: 0,
  fields: {
    invoiceNumber: "Invoice Number",
    ctnNumber: "CTN Number",
    billOfLadingNumber: "Bill of Lading",
    reference: "Reference",
    amount: "Amount",
    secondaryAmount: "Amount 2",
    tertiaryAmount: "Amount 3",
    sourceCountryName: "Source Country",
  },
  extraFields: [],
}

export const defaultMasterReportMapping: ReportFieldMapping = {
  headerRowIndex: 0,
  fields: {
    sourceInternalId: "Internal ID",
    salesOrderNumber: "Created From",
    billOfLadingNumber: "Bill of Lading",
    ctnNumber: "CTN Number",
    status: "CTN Status",
    amount: "Amount",
    transactionDate: "Date",
    sourceClass: "Class",
  },
  extraFields: [],
}

function reportMappingsEqual(
  first: ReportFieldMapping | undefined,
  second: ReportFieldMapping
) {
  if (!first || first.headerRowIndex !== second.headerRowIndex) {
    return false
  }

  const fieldNames = new Set([
    ...Object.keys(first.fields),
    ...Object.keys(second.fields),
  ])

  for (const fieldName of fieldNames) {
    if (
      first.fields[fieldName as ReportMappingField] !==
      second.fields[fieldName as ReportMappingField]
    ) {
      return false
    }
  }

  const firstExtraFields = first.extraFields ?? []
  const secondExtraFields = second.extraFields ?? []

  if (firstExtraFields.length !== secondExtraFields.length) {
    return false
  }

  const extraFieldsEqual = firstExtraFields.every((field, index) => {
    const otherField = secondExtraFields[index]

    return (
      field.id === otherField?.id &&
      field.label === otherField.label &&
      field.sourceColumn === otherField.sourceColumn
    )
  })

  if (!extraFieldsEqual) {
    return false
  }

  return (
    (first.aiTrainingExamples?.length ?? 0) ===
    (second.aiTrainingExamples?.length ?? 0)
  )
}

export function isDefaultCountryReportMapping(
  mapping: ReportFieldMapping | undefined
) {
  return reportMappingsEqual(mapping, defaultCountryReportMapping)
}

export function isDefaultMasterReportMapping(
  mapping: ReportFieldMapping | undefined
) {
  return reportMappingsEqual(mapping, defaultMasterReportMapping)
}

export const workflowTasks = [
  { id: "invoice", label: "Invoice" },
  { id: "reconcile", label: "Reconciliation" },
  { id: "journal", label: "Journal" },
] satisfies { id: CloseTaskId; label: string }[]

export const defaultTemplate: MonthEndTemplate = {
  countriesModule: {
    tab: "Countries",
    title: "Country Close Tasks",
    description: "Invoice, reconciliation, and journal status by country.",
    level: "organizational",
    updatedAt: defaultUpdatedAt,
  },
  countries: [
    { id: "angola", name: "Angola", indent: 0, invoiceRequired: true },
    { id: "angola-oot", name: "Angola OOT", indent: 1, invoiceRequired: true },
    {
      id: "antaser",
      name: "Antaser",
      indent: 0,
      combinedWithCountryIds: ["antaser-oot"],
    },
    {
      id: "antaser-oot",
      name: "Antaser OOT",
      indent: 1,
      combinedWithCountryIds: ["antaser"],
    },
    {
      id: "antaser-afrique",
      name: "Antaser Afrique",
      indent: 0,
      combinedWithCountryIds: ["antaser-afrique-oot"],
    },
    {
      id: "antaser-afrique-oot",
      name: "Antaser Afrique OOT",
      indent: 1,
      combinedWithCountryIds: ["antaser-afrique"],
    },
    { id: "benin", name: "Benin", indent: 0 },
    { id: "burkina-faso", name: "Burkina Faso", indent: 0 },
    { id: "cameroon", name: "Cameroon", indent: 0 },
    { id: "foremost", name: "Foremost", indent: 0, checkable: false },
    {
      id: "foremost-chad",
      name: "Chad",
      indent: 1,
      invoiceRequired: true,
    },
    { id: "frabemar", name: "Frabemar", indent: 0, checkable: false },
    {
      id: "frabemar-dr-congo",
      name: "DR Congo",
      indent: 1,
      invoiceRequired: true,
    },
    {
      id: "frabemar-gabon",
      name: "Gabon",
      indent: 1,
      invoiceRequired: true,
      countryReportMapping: {
        headerRowIndex: 1,
        fields: {
          status: "Notes",
          reference: "Purchase of Note Ref",
          ctnNumber: "BIETC N",
          sellingDate: "Selling Date",
          transactionDate: "Validation Date",
          invoiceNumber: "Invoice N",
          billOfLadingNumber: "B/L N",
          amount: "TOTAL COLLECTED",
        },
        extraFields: [],
      },
    },
    {
      id: "frabemar-mali",
      name: "Mali",
      indent: 1,
      invoiceRequired: true,
    },
    {
      id: "frabemar-republic-of-guinea",
      name: "Republic of Guinea",
      indent: 1,
      invoiceRequired: true,
    },
    { id: "gtms", name: "GTMS", indent: 0, checkable: false },
    { id: "gtms-liberia", name: "Liberia", indent: 1 },
    { id: "ivory-coast", name: "Ivory Coast", indent: 0 },
    { id: "madagascar", name: "Madagascar", indent: 0 },
    {
      id: "republic-of-congo",
      name: "Republic of Congo",
      indent: 0,
      invoiceRequired: true,
    },
    { id: "sck", name: "SCK", indent: 0, checkable: false },
    {
      id: "sck-chad",
      name: "Chad",
      indent: 1,
      combinedWithCountryIds: ["sck-sierra-leone"],
    },
    { id: "sck-kenya", name: "Kenya", indent: 1 },
    { id: "sck-djibouti", name: "Djibouti", indent: 1 },
    { id: "sck-somalia", name: "Somalia", indent: 1 },
    { id: "sck-sudan", name: "Sudan", indent: 1 },
    { id: "sck-yemen", name: "Yemen", indent: 1 },
    {
      id: "sck-sierra-leone",
      name: "Sierra Leone",
      indent: 1,
      combinedWithCountryIds: ["sck-chad"],
    },
    { id: "senegal", name: "Senegal", indent: 0, requiresPasteReport: true },
  ],
  taskGroups: [
    {
      id: "prepaid-accounts",
      tab: "Prepaid Accounts",
      title: "Prepaid Accounts",
      description: "Single-check prepaid account tasks.",
      level: "organizational",
      updatedAt: defaultUpdatedAt,
      tasks: [
        { id: "asa-germany", label: "ASA Germany" },
        { id: "rc-desk", label: "RC Desk" },
        { id: "ht-trade", label: "HT Trade" },
        { id: "gabon-notes", label: "Gabon Notes" },
      ],
    },
    {
      id: "statements",
      tab: "Statements",
      title: "Statements",
      description: "Statement checklist items.",
      level: "organizational",
      updatedAt: defaultUpdatedAt,
      tasks: [
        { id: "auto-statements", label: "Auto Statements" },
        { id: "ual", label: "UAL" },
      ],
    },
    {
      id: "bank-reconciliation",
      tab: "Bank Reconciliation",
      title: "Bank Reconciliation",
      description: "Bank reconciliation checklist items.",
      level: "organizational",
      updatedAt: defaultUpdatedAt,
      tasks: [
        { id: "chase-ink", label: "Chase Ink" },
        { id: "amex", label: "AMEX" },
        { id: "wells-fargo", label: "Wells Fargo" },
        { id: "chase-main", label: "Chase Main" },
        { id: "chase-sweep", label: "Chase Sweep" },
      ],
    },
  ],
}

export function makeTemplateId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function loadMonthEndTemplate() {
  if (typeof window === "undefined") {
    return normalizeTemplate(defaultTemplate)
  }

  const saved = readBrowserStorage("localStorage", storageKey)

  if (!saved) {
    return normalizeTemplate(defaultTemplate)
  }

  try {
    const parsed = JSON.parse(saved) as MonthEndTemplate

    return normalizeTemplate(parsed)
  } catch {
    removeBrowserStorage("localStorage", storageKey)
    return normalizeTemplate(defaultTemplate)
  }
}

export async function getMonthEndTemplate() {
  const localTemplate = loadMonthEndTemplate()

  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from(tableName)
      .select("template, updated_at")
      .eq("id", templateId)
      .maybeSingle<{
        template: MonthEndTemplate | null
        updated_at: string | null
      }>()

    if (error) {
      return localTemplate
    }

    if (!data?.template) {
      const template = normalizeTemplate(defaultTemplate)

      saveLocalTemplate(template)
      saveDatabaseTemplate(template)
      return template
    }

    const databaseTemplate = normalizeTemplate(data.template)
    const localUpdatedAt = templateLastUpdatedAt(localTemplate)
    const databaseUpdatedAt = data.updated_at
      ? timestampValue(data.updated_at)
      : templateLastUpdatedAt(databaseTemplate)
    const template =
      localUpdatedAt > databaseUpdatedAt ? localTemplate : databaseTemplate

    if (template === localTemplate) {
      saveDatabaseTemplate(template)
    }

    saveLocalTemplate(template)
    return template
  } catch {
    return localTemplate
  }
}

function templateLastUpdatedAt(template: MonthEndTemplate) {
  return Math.max(
    timestampValue(template.countriesModule?.updatedAt),
    ...template.countries.map((country) => timestampValue(country.updatedAt)),
    ...template.taskGroups.map((group) => timestampValue(group.updatedAt))
  )
}

function timestampValue(value: string | undefined | null) {
  const timestamp = Date.parse(value ?? defaultUpdatedAt)

  return Number.isFinite(timestamp) ? timestamp : Date.parse(defaultUpdatedAt)
}

function normalizeTemplate(template: MonthEndTemplate): MonthEndTemplate {
  const defaultCountriesById = new Map(
    defaultTemplate.countries.map((row) => [row.id, row])
  )
  const defaultTaskGroupsById = new Map(
    defaultTemplate.taskGroups.map((group) => [group.id, group])
  )

  return {
    countriesModule: {
      tab:
        template.countriesModule?.tab ??
        defaultTemplate.countriesModule?.tab ??
        "Countries",
      title:
        template.countriesModule?.title ??
        defaultTemplate.countriesModule?.title ??
        "Country Close Tasks",
      description:
        template.countriesModule?.description ??
        defaultTemplate.countriesModule?.description ??
        "Invoice, reconciliation, and journal status by country.",
      level:
        template.countriesModule?.level ??
        defaultTemplate.countriesModule?.level ??
        "organizational",
      updatedAt:
        template.countriesModule?.updatedAt ??
        defaultTemplate.countriesModule?.updatedAt ??
        defaultUpdatedAt,
    },
    countries: template.countries?.length
      ? normalizeChadSierraLeoneSplit(
          mergeDefaultCountryRows(template.countries).map((row) => {
            const defaultRow = defaultCountriesById.get(row.id)

            return withDefaultReportMappings({
              ...row,
              checkable: row.checkable ?? defaultRow?.checkable,
              invoiceRequired:
                row.invoiceRequired ?? defaultRow?.invoiceRequired,
              requiresPasteReport:
                row.requiresPasteReport ?? defaultRow?.requiresPasteReport,
              countryReportMapping:
                row.countryReportMapping &&
                !isDefaultCountryReportMapping(row.countryReportMapping)
                  ? row.countryReportMapping
                  : (defaultRow?.countryReportMapping ??
                    row.countryReportMapping),
              masterReportMapping:
                row.masterReportMapping &&
                !isDefaultMasterReportMapping(row.masterReportMapping)
                  ? row.masterReportMapping
                  : (defaultRow?.masterReportMapping ??
                    row.masterReportMapping),
              combinedWithCountryIds:
                row.combinedWithCountryIds ??
                defaultRow?.combinedWithCountryIds ??
                [],
              updatedAt: row.updatedAt ?? defaultRow?.updatedAt,
            })
          })
        )
      : defaultTemplate.countries.map(withDefaultReportMappings),
    taskGroups: template.taskGroups?.length
      ? template.taskGroups.map((group) => {
          const defaultGroup = defaultTaskGroupsById.get(group.id)

          return {
            ...group,
            title: group.title || defaultGroup?.title || group.tab,
            description:
              group.description ||
              defaultGroup?.description ||
              "Single-check month-end tasks.",
            level: group.level ?? defaultGroup?.level ?? "organizational",
            updatedAt:
              group.updatedAt ?? defaultGroup?.updatedAt ?? defaultUpdatedAt,
            tasks: group.tasks?.length
              ? group.tasks
              : (defaultGroup?.tasks ?? []),
          }
        })
      : defaultTemplate.taskGroups,
  }
}

function cloneReportMapping(mapping: ReportFieldMapping): ReportFieldMapping {
  return {
    headerRowIndex: mapping.headerRowIndex,
    fields: { ...mapping.fields },
    extraFields: mapping.extraFields?.map((field) => ({ ...field })) ?? [],
    aiTrainingExamples:
      mapping.aiTrainingExamples?.map((example) => ({
        ...example,
        columns: [...example.columns],
        rows: example.rows.map((row) => [...row]),
        assignments: { ...example.assignments },
      })) ?? [],
  }
}

function withDefaultReportMappings(
  row: TemplateCountryRow
): TemplateCountryRow {
  return {
    ...row,
    countryReportMapping:
      row.countryReportMapping ??
      cloneReportMapping(defaultCountryReportMapping),
    masterReportMapping:
      row.masterReportMapping ?? cloneReportMapping(defaultMasterReportMapping),
  }
}

function normalizeChadSierraLeoneSplit(countries: TemplateCountryRow[]) {
  return countries.map((country) => {
    if (country.id === "foremost-chad") {
      return {
        ...country,
        combinedWithCountryIds: (country.combinedWithCountryIds ?? []).filter(
          (id) => id !== "sck-chad" && id !== "sck-sierra-leone"
        ),
      }
    }

    if (country.id === "sck-chad") {
      return {
        ...country,
        combinedWithCountryIds: ["sck-sierra-leone"],
      }
    }

    if (country.id === "sck-sierra-leone") {
      return {
        ...country,
        combinedWithCountryIds: ["sck-chad"],
      }
    }

    return country
  })
}

function mergeDefaultCountryRows(countries: TemplateCountryRow[]) {
  return defaultTemplate.countries.reduce((mergedCountries, defaultRow) => {
    if (mergedCountries.some((country) => country.id === defaultRow.id)) {
      return mergedCountries
    }

    const defaultRowIndex = defaultTemplate.countries.findIndex(
      (country) => country.id === defaultRow.id
    )
    const previousDefaultRowIds = defaultTemplate.countries
      .slice(0, defaultRowIndex)
      .map((country) => country.id)
    const insertAfterIndex = previousDefaultRowIds.reduce(
      (latestIndex, rowId) => {
        const rowIndex = mergedCountries.findIndex(
          (country) => country.id === rowId
        )

        return rowIndex >= 0 ? rowIndex : latestIndex
      },
      -1
    )
    const nextCountries = [...mergedCountries]

    nextCountries.splice(insertAfterIndex + 1, 0, defaultRow)

    return nextCountries
  }, countries)
}

export function saveMonthEndTemplate(template: MonthEndTemplate) {
  saveLocalTemplate(template)
  saveDatabaseTemplate(template)
  window.dispatchEvent(new Event("month-end:template-updated"))
}

export function resetMonthEndTemplate() {
  removeBrowserStorage("localStorage", storageKey)
  window.dispatchEvent(new Event("month-end:template-updated"))
}

function saveLocalTemplate(template: MonthEndTemplate) {
  if (typeof window !== "undefined") {
    writeBrowserStorage("localStorage", storageKey, JSON.stringify(template))
  }
}

async function saveDatabaseTemplate(template: MonthEndTemplate) {
  try {
    const now = new Date().toISOString()
    const supabase = createPublicClient()

    await supabase.from(tableName).upsert(
      {
        id: templateId,
        template,
        updated_at: now,
      },
      { onConflict: "id" }
    )
  } catch {}
}
