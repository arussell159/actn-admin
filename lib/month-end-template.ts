import { createClient } from "@/lib/client"

export type CloseTaskId = "invoice" | "reconcile" | "journal"

export type TemplateCountryRow = {
  id: string
  name: string
  indent: number
  checkable?: boolean
  invoiceRequired?: boolean
  updatedAt?: string
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
    { id: "antaser", name: "Antaser", indent: 0 },
    { id: "antaser-oot", name: "Antaser OOT", indent: 1 },
    { id: "antaser-afrique", name: "Antaser Afrique", indent: 0 },
    { id: "antaser-afrique-oot", name: "Antaser Afrique OOT", indent: 1 },
    { id: "benin", name: "Benin", indent: 0 },
    { id: "burkina-faso", name: "Burkina Faso", indent: 0 },
    { id: "cameroon", name: "Cameroon", indent: 0 },
    { id: "foremost", name: "Foremost", indent: 0, checkable: false },
    { id: "foremost-chad", name: "Chad", indent: 1, invoiceRequired: true },
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
    { id: "sck-kenya", name: "Kenya", indent: 1 },
    { id: "sck-djibouti", name: "Djibouti", indent: 1 },
    { id: "sck-somalia", name: "Somalia", indent: 1 },
    { id: "sck-sudan", name: "Sudan", indent: 1 },
    { id: "sck-yemen", name: "Yemen", indent: 1 },
    { id: "sck-sierra-leone", name: "Sierra Leone", indent: 1 },
    { id: "senegal", name: "Senegal", indent: 0 },
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
    return defaultTemplate
  }

  const saved = window.localStorage.getItem(storageKey)

  if (!saved) {
    return defaultTemplate
  }

  try {
    const parsed = JSON.parse(saved) as MonthEndTemplate

    return normalizeTemplate(parsed)
  } catch {
    return defaultTemplate
  }
}

export async function getMonthEndTemplate() {
  const localTemplate = loadMonthEndTemplate()

  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from(tableName)
      .select("template")
      .eq("id", templateId)
      .maybeSingle<{ template: MonthEndTemplate | null }>()

    if (error) {
      return localTemplate
    }

    if (!data?.template) {
      saveLocalTemplate(defaultTemplate)
      saveDatabaseTemplate(defaultTemplate)
      return defaultTemplate
    }

    const template = normalizeTemplate(data.template)

    saveLocalTemplate(template)
    return template
  } catch {
    return localTemplate
  }
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
      ? template.countries.map((row) => {
          const defaultRow = defaultCountriesById.get(row.id)

          return {
            ...row,
            checkable: row.checkable ?? defaultRow?.checkable,
            invoiceRequired: row.invoiceRequired ?? defaultRow?.invoiceRequired,
            updatedAt: row.updatedAt ?? defaultRow?.updatedAt,
          }
        })
      : defaultTemplate.countries,
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

export function saveMonthEndTemplate(template: MonthEndTemplate) {
  saveLocalTemplate(template)
  saveDatabaseTemplate(template)
  window.dispatchEvent(new Event("month-end:template-updated"))
}

export function resetMonthEndTemplate() {
  window.localStorage.removeItem(storageKey)
  window.dispatchEvent(new Event("month-end:template-updated"))
}

function saveLocalTemplate(template: MonthEndTemplate) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(storageKey, JSON.stringify(template))
  }
}

async function saveDatabaseTemplate(template: MonthEndTemplate) {
  try {
    const now = new Date().toISOString()
    const supabase = createClient()

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
