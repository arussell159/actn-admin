"use client"

import * as React from "react"
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  FileSpreadsheetIcon,
  GripVerticalIcon,
  InfoIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  SaveIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  defaultCountryReportMapping,
  defaultMasterReportMapping,
  getMonthEndTemplate,
  loadMonthEndTemplate,
  makeTemplateId,
  saveMonthEndTemplate,
  type MonthEndTemplate,
  type ReportFieldMapping,
  type ReportMappingField,
  type TemplateCountryRow,
  type TemplateModuleLevel,
  type TemplateSimpleTask,
} from "@/lib/month-end-template"
import {
  extractPdfText,
  extractWorkbookRows,
  parseCountryReportText,
  parseCountryReportUploadFile,
  type ParsedCountryReportRecord,
} from "@/lib/country-report-import"
import { parseCsv } from "@/lib/csv"

const countriesModuleId = "countries"
const protectedModuleIds = new Set([
  countriesModuleId,
  "prepaid-accounts",
  "statements",
  "bank-reconciliation",
])

const reportMappingNoneValue = "__none__"

type ReportMappingFieldDefinition = {
  id: ReportMappingField
  label: string
  description: string
  aliases: string[]
}

type ReportSampleField = {
  sourceColumn: string
  label: string
  previewValues: string[]
}

type ReportMappingSamples = Record<
  string,
  Record<"countryReport" | "masterReport", ReportSampleField[]>
>

const countryReportMappingFields = [
  {
    id: "invoiceNumber",
    label: "Invoice Number",
    description: "Used to group country report rows by invoice.",
    aliases: [
      "parsedinvoicenumber",
      "invoicenumber",
      "invoice",
      "salesorder",
      "salesordernumber",
    ],
  },
  {
    id: "ctnNumber",
    label: "CTN / ECTN Number",
    description: "Used as the main CTN identifier from the country report.",
    aliases: [
      "parsedctnectnnumber",
      "parsedctnnumber",
      "ctnnumber",
      "ctn",
      "ectnnumber",
      "ectn",
      "besc",
      "bescsfg",
    ],
  },
  {
    id: "billOfLadingNumber",
    label: "Bill of Lading Number",
    description: "Used to match report rows to the master bill of lading.",
    aliases: [
      "billofladingnumber",
      "parsedbillofladingnumber",
      "billoflading",
      "blnumber",
      "blreference",
      "numerobl",
      "numbl",
      "bl",
    ],
  },
  {
    id: "reference",
    label: "Country Report Reference",
    description:
      "Fallback matching value when CTN or bill of lading is absent.",
    aliases: [
      "parsedreference",
      "reference",
      "blreference",
      "documentnumber",
      "bookingnumber",
    ],
  },
  {
    id: "amount",
    label: "Primary Country Amount",
    description: "Primary amount included in the country report total.",
    aliases: [
      "parsedamount",
      "amount",
      "price",
      "costofectn",
      "ctnnet",
      "debit",
      "credit",
    ],
  },
  {
    id: "secondaryAmount",
    label: "Secondary Country Amount",
    description: "Optional second amount column added into the report total.",
    aliases: ["amount2", "secondaryamount", "fees", "fee"],
  },
  {
    id: "tertiaryAmount",
    label: "Third Country Amount",
    description: "Optional third amount column added into the report total.",
    aliases: ["amount3", "tertiaryamount", "tax", "vat"],
  },
  {
    id: "sourceCountryName",
    label: "Source Country Name",
    description:
      "Used when one uploaded report contains rows for multiple countries.",
    aliases: [
      "parsedsourcecountry",
      "country",
      "countryname",
      "sourcecountry",
      "sourcecountryname",
    ],
  },
] satisfies ReportMappingFieldDefinition[]

const masterReportMappingFields = [
  {
    id: "sourceInternalId",
    label: "NetSuite Internal ID",
    description:
      "Used with the row number to create a stable imported record ID.",
    aliases: ["internalid", "id"],
  },
  {
    id: "salesOrderNumber",
    label: "Sales Order Number",
    description:
      "Imported as the Sales Order value and cleaned before matching.",
    aliases: ["createdfrom", "salesorder", "salesordernumber"],
  },
  {
    id: "billOfLadingNumber",
    label: "Bill of Lading Number",
    description: "Used to reconcile NetSuite rows against country report rows.",
    aliases: [
      "billofladingnumber",
      "billoflading",
      "blnumber",
      "blreference",
      "bl",
    ],
  },
  {
    id: "ctnNumber",
    label: "CTN Number",
    description: "Used to reconcile NetSuite rows against country report rows.",
    aliases: ["ctnnumber", "ctn", "ectnnumber", "ectn"],
  },
  {
    id: "status",
    label: "CTN Status",
    description:
      "Imported as the master report status shown in reconciliation.",
    aliases: ["ctnstatus", "status"],
  },
  {
    id: "amount",
    label: "NetSuite Amount",
    description: "Imported as the master report amount.",
    aliases: ["amount", "netamount", "total"],
  },
  {
    id: "transactionDate",
    label: "Transaction Date",
    description: "Used for the transaction date checks on the country page.",
    aliases: ["date", "transactiondate", "trandate", "invoicedate"],
  },
  {
    id: "sourceClass",
    label: "NetSuite Class / Country",
    description: "Used to route one master upload to the correct country.",
    aliases: ["class", "country", "sourceclass", "countryname"],
  },
] satisfies ReportMappingFieldDefinition[]

type ModuleDraft = {
  name: string
  level: TemplateModuleLevel
}

type ModuleDetailsDraft = {
  tab: string
  level: TemplateModuleLevel
}

type CountryDraft = {
  name: string
  type: "country" | "group"
  parentId: string
  invoiceRequired: boolean
  requiresPasteReport: boolean
  combinedWithCountryIds: string[]
}

type TaskDraft = {
  label: string
}

type ItemForm =
  | { mode: "add-country"; draft: CountryDraft }
  | { mode: "edit-country"; rowId: string; draft: CountryDraft }
  | { mode: "add-task"; draft: TaskDraft }
  | { mode: "edit-task"; taskId: string; draft: TaskDraft }
  | null

export function TemplateEditorView() {
  const [template, setTemplate] =
    React.useState<MonthEndTemplate>(loadMonthEndTemplate)
  const [activeModuleId, setActiveModuleId] = React.useState<string | null>(
    null
  )
  const [showModuleForm, setShowModuleForm] = React.useState(false)
  const [editingModuleId, setEditingModuleId] = React.useState<string | null>(
    null
  )
  const [moduleDraft, setModuleDraft] = React.useState<ModuleDraft>({
    name: "",
    level: "organizational",
  })
  const [moduleDetailsDraft, setModuleDetailsDraft] =
    React.useState<ModuleDetailsDraft>({
      tab: "",
      level: "organizational",
    })
  const [itemForm, setItemForm] = React.useState<ItemForm>(null)
  const [activeCountryId, setActiveCountryId] = React.useState<string | null>(
    null
  )
  const [mappingHeaders, setMappingHeaders] =
    React.useState<ReportMappingSamples>({})
  const [showCountryExitPrompt, setShowCountryExitPrompt] =
    React.useState(false)
  const countryMappingPanelRef = React.useRef<CountryMappingPanelHandle>(null)

  const modules = React.useMemo(
    () => [
      {
        id: countriesModuleId,
        name: template.countriesModule?.tab ?? "Countries",
        level: template.countriesModule?.level ?? "organizational",
        lastModified: template.countriesModule?.updatedAt,
        count: template.countries.length,
      },
      ...template.taskGroups.map((group) => ({
        id: group.id,
        name: group.tab,
        level: group.level ?? "organizational",
        lastModified: group.updatedAt,
        count: group.tasks.length,
      })),
    ],
    [template]
  )
  const activeTaskGroup = template.taskGroups.find(
    (group) => group.id === activeModuleId
  )
  const activeModule = modules.find((module) => module.id === activeModuleId)
  const activeCountry = activeCountryId
    ? template.countries.find((country) => country.id === activeCountryId)
    : undefined
  const activeCountryMappingHeaders =
    activeCountryId && mappingHeaders[activeCountryId]
      ? mappingHeaders[activeCountryId]
      : { countryReport: [], masterReport: [] }
  const parentRows = template.countries
  const countryRowIds = React.useMemo(
    () => template.countries.map((row) => row.id),
    [template.countries]
  )
  const countryRowDndSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  React.useEffect(() => {
    let isMounted = true

    async function loadTemplate() {
      const activeTemplate = await getMonthEndTemplate()

      if (isMounted) {
        setTemplate(activeTemplate)
      }
    }

    loadTemplate()

    return () => {
      isMounted = false
    }
  }, [])

  function persist(nextTemplate: MonthEndTemplate) {
    saveMonthEndTemplate(nextTemplate)
    setTemplate(nextTemplate)
  }

  function startEditModule(moduleId: string) {
    if (moduleId === countriesModuleId) {
      setModuleDetailsDraft({
        tab: template.countriesModule?.tab ?? "Countries",
        level: template.countriesModule?.level ?? "organizational",
      })
      setEditingModuleId(moduleId)
      setShowModuleForm(false)
      return
    }

    const group = template.taskGroups.find((item) => item.id === moduleId)

    if (group) {
      setModuleDetailsDraft({
        tab: group.tab,
        level: group.level ?? "organizational",
      })
      setEditingModuleId(moduleId)
      setShowModuleForm(false)
    }
  }

  function deleteModule(moduleId: string) {
    if (protectedModuleIds.has(moduleId)) {
      return
    }

    persist({
      ...template,
      taskGroups: template.taskGroups.filter((group) => group.id !== moduleId),
    })

    if (activeModuleId === moduleId) {
      setActiveModuleId(null)
      setItemForm(null)
    }
  }

  function saveNewModule() {
    const cleanName = moduleDraft.name.trim()
    const id = makeUniqueTemplateId(
      makeTemplateId(cleanName),
      template.taskGroups.map((group) => group.id)
    )

    if (!cleanName || !id) {
      return
    }

    const updatedAt = new Date().toISOString()

    persist({
      ...template,
      taskGroups: [
        ...template.taskGroups,
        {
          id,
          tab: cleanName,
          title: cleanName,
          description: "",
          level: moduleDraft.level,
          updatedAt,
          tasks: [],
        },
      ],
    })
    setActiveModuleId(id)
    cancelModuleForm()
  }

  function cancelModuleForm() {
    setShowModuleForm(false)
    setModuleDraft({
      name: "",
      level: "organizational",
    })
  }

  function cancelModuleDetailsForm() {
    setEditingModuleId(null)
    setModuleDetailsDraft({
      tab: "",
      level: "organizational",
    })
  }

  function startAddItem() {
    if (activeModuleId === countriesModuleId) {
      setItemForm({
        mode: "add-country",
        draft: {
          name: "",
          type: "country",
          parentId: "",
          invoiceRequired: false,
          requiresPasteReport: false,
          combinedWithCountryIds: [],
        },
      })
      return
    }

    setItemForm({ mode: "add-task", draft: { label: "" } })
  }

  function startEditCountry(row: TemplateCountryRow, rowIndex: number) {
    setItemForm({
      mode: "edit-country",
      rowId: row.id,
      draft: {
        name: row.name,
        type: row.checkable === false ? "group" : "country",
        parentId: findParentId(template, rowIndex),
        invoiceRequired: row.invoiceRequired === true,
        requiresPasteReport: row.requiresPasteReport === true,
        combinedWithCountryIds: getCombinedCountryIds(template, row.id),
      },
    })
  }

  function openCountry(row: TemplateCountryRow, rowIndex: number) {
    setShowCountryExitPrompt(false)
    setActiveCountryId(row.id)
    startEditCountry(row, rowIndex)
  }

  function closeActiveCountry() {
    setShowCountryExitPrompt(false)
    setActiveCountryId(null)
    setItemForm(null)
  }

  function requestCloseActiveCountry() {
    if (countryMappingPanelRef.current?.hasUnsavedChanges()) {
      setShowCountryExitPrompt(true)
      return
    }

    closeActiveCountry()
  }

  function saveMappingsAndCloseCountry() {
    countryMappingPanelRef.current?.saveMappings()
    closeActiveCountry()
  }

  function discardMappingsAndCloseCountry() {
    countryMappingPanelRef.current?.discardMappings()
    if (activeCountryId) {
      setMappingHeaders((current) => {
        const nextSamples = { ...current }

        delete nextSamples[activeCountryId]

        return nextSamples
      })
    }
    closeActiveCountry()
  }

  function startEditTask(task: TemplateSimpleTask) {
    setItemForm({
      mode: "edit-task",
      taskId: task.id,
      draft: { label: task.label },
    })
  }

  function saveItemForm() {
    if (!itemForm) {
      return
    }

    if (itemForm.mode === "add-country" || itemForm.mode === "edit-country") {
      saveCountryForm(itemForm)
      return
    }

    saveTaskForm(itemForm)
  }

  function saveCountryForm(
    form: Extract<ItemForm, { mode: "add-country" | "edit-country" }>
  ) {
    const cleanName = form.draft.name.trim()

    if (!cleanName) {
      return
    }

    const updatedAt = new Date().toISOString()
    const selectedParent = template.countries.find(
      (row) => row.id === form.draft.parentId
    )
    const combinedWithCountryIds =
      form.draft.type === "country"
        ? Array.from(new Set(form.draft.combinedWithCountryIds))
        : []
    const rowShape = {
      name: cleanName,
      indent: selectedParent ? selectedParent.indent + 1 : 0,
      checkable: form.draft.type === "group" ? false : undefined,
      invoiceRequired:
        form.draft.type === "country" ? form.draft.invoiceRequired : undefined,
      requiresPasteReport:
        form.draft.type === "country"
          ? form.draft.requiresPasteReport
          : undefined,
      combinedWithCountryIds,
      updatedAt,
    }

    if (form.mode === "edit-country") {
      const rowIndex = template.countries.findIndex(
        (row) => row.id === form.rowId
      )
      const currentRow = template.countries[rowIndex]
      const indentDelta = currentRow ? rowShape.indent - currentRow.indent : 0
      const childEndIndex =
        rowIndex >= 0 ? findChildInsertIndex(template, rowIndex) : rowIndex

      persist({
        ...template,
        countriesModule: {
          ...template.countriesModule,
          updatedAt,
        },
        countries: updateCombinedCountryLinks(
          template.countries.map((row, index) => {
            if (row.id === form.rowId) {
              return { ...row, ...rowShape }
            }

            if (index > rowIndex && index < childEndIndex) {
              return {
                ...row,
                indent: Math.max(0, row.indent + indentDelta),
                updatedAt,
              }
            }

            return row
          }),
          form.rowId,
          combinedWithCountryIds,
          updatedAt
        ),
      })
      if (activeCountryId === form.rowId) {
        setItemForm({
          mode: "edit-country",
          rowId: form.rowId,
          draft: {
            ...form.draft,
            name: cleanName,
            invoiceRequired:
              form.draft.type === "country"
                ? form.draft.invoiceRequired
                : false,
            requiresPasteReport:
              form.draft.type === "country"
                ? form.draft.requiresPasteReport
                : false,
            combinedWithCountryIds,
          },
        })
      } else {
        setItemForm(null)
      }
      return
    }

    const parentIndex = form.draft.parentId
      ? template.countries.findIndex((row) => row.id === form.draft.parentId)
      : -1
    const insertIndex =
      parentIndex >= 0
        ? findChildInsertIndex(template, parentIndex)
        : template.countries.length
    const id = makeUniqueTemplateId(
      makeTemplateId(cleanName),
      template.countries.map((row) => row.id)
    )
    const countries = [...template.countries]

    countries.splice(insertIndex, 0, { id, ...rowShape })

    persist({
      ...template,
      countriesModule: {
        ...template.countriesModule,
        updatedAt,
      },
      countries: updateCombinedCountryLinks(
        countries,
        id,
        combinedWithCountryIds,
        updatedAt
      ),
    })
    setItemForm(null)
  }

  function saveTaskForm(
    form: Extract<ItemForm, { mode: "add-task" | "edit-task" }>
  ) {
    if (!activeTaskGroup) {
      return
    }

    const cleanLabel = form.draft.label.trim()

    if (!cleanLabel) {
      return
    }

    const updatedAt = new Date().toISOString()

    persist({
      ...template,
      taskGroups: template.taskGroups.map((group) => {
        if (group.id !== activeTaskGroup.id) {
          return group
        }

        if (form.mode === "edit-task") {
          return {
            ...group,
            updatedAt,
            tasks: group.tasks.map((task) =>
              task.id === form.taskId ? { ...task, label: cleanLabel } : task
            ),
          }
        }

        return {
          ...group,
          updatedAt,
          tasks: [
            ...group.tasks,
            {
              id: makeUniqueTemplateId(
                makeTemplateId(`${group.id}-${cleanLabel}`),
                group.tasks.map((task) => task.id)
              ),
              label: cleanLabel,
            },
          ],
        }
      }),
    })
    setItemForm(null)
  }

  function deleteCountryRow(rowIndex: number) {
    const row = template.countries[rowIndex]

    if (!row) {
      return
    }

    const updatedAt = new Date().toISOString()
    const deleteUntil = findChildInsertIndex(template, rowIndex)
    const countries = template.countries.filter(
      (_country, index) => index < rowIndex || index >= deleteUntil
    )

    persist({
      ...template,
      countriesModule: {
        ...template.countriesModule,
        updatedAt,
      },
      countries,
    })
    setItemForm(null)
  }

  function updateCountryReportMapping(
    countryId: string,
    mappingType: "countryReportMapping" | "masterReportMapping",
    mapping?: ReportFieldMapping
  ) {
    const updatedAt = new Date().toISOString()

    persist({
      ...template,
      countriesModule: {
        ...template.countriesModule,
        updatedAt,
      },
      countries: template.countries.map((country) =>
        country.id === countryId
          ? {
              ...country,
              [mappingType]: mapping,
              updatedAt,
            }
          : country
      ),
    })
  }

  async function loadMappingSample(
    file: File,
    mappingKind: "countryReport" | "masterReport"
  ) {
    const extension = file.name.split(".").pop()?.toLowerCase()
    const sampleText =
      extension === "pdf" || file.type === "application/pdf"
        ? await extractPdfText(file)
        : extension === "xlsx" || extension === "xls"
          ? await extractWorkbookRows(file)
          : await file.text()
    const sample = analyzeReportSample(sampleText)
    const mappedSample =
      mappingKind === "countryReport"
        ? mergeParsedCountryReportSampleFields(
            sample,
            await parseCountryReportSampleFile(file)
          )
        : sample

    if (activeCountryId) {
      setMappingHeaders((current) => ({
        ...current,
        [activeCountryId]: {
          countryReport: current[activeCountryId]?.countryReport ?? [],
          masterReport: current[activeCountryId]?.masterReport ?? [],
          [mappingKind]: mappedSample.fields,
        },
      }))
    }

    return mappedSample
  }

  async function loadMappingSampleText(
    csvText: string,
    mappingKind: "countryReport" | "masterReport"
  ) {
    const sample = analyzeReportSample(csvText)
    const mappedSample =
      mappingKind === "countryReport"
        ? mergeParsedCountryReportSampleFields(
            sample,
            parseCountryReportSampleText(csvText)
          )
        : sample

    if (activeCountryId) {
      setMappingHeaders((current) => ({
        ...current,
        [activeCountryId]: {
          countryReport: current[activeCountryId]?.countryReport ?? [],
          masterReport: current[activeCountryId]?.masterReport ?? [],
          [mappingKind]: mappedSample.fields,
        },
      }))
    }

    return mappedSample
  }

  function reorderCountryRow(event: DragEndEvent) {
    const activeId = String(event.active.id)
    const overId = event.over ? String(event.over.id) : ""

    if (!overId || activeId === overId) {
      return
    }

    const activeIndex = template.countries.findIndex(
      (row) => row.id === activeId
    )
    const overIndex = template.countries.findIndex((row) => row.id === overId)

    if (activeIndex < 0 || overIndex < 0) {
      return
    }

    const activeParentId = findParentId(template, activeIndex)
    const overParentId = findParentId(template, overIndex)

    if (activeParentId !== overParentId) {
      return
    }

    const activeEndIndex = findChildInsertIndex(template, activeIndex)

    if (overIndex > activeIndex && overIndex < activeEndIndex) {
      return
    }

    const movingRows = template.countries.slice(activeIndex, activeEndIndex)
    const remainingRows = template.countries.filter(
      (_row, index) => index < activeIndex || index >= activeEndIndex
    )
    const overEndIndex = findChildInsertIndex(template, overIndex)
    const afterOverRow = template.countries[overEndIndex]
    const insertIndex =
      activeIndex < overIndex
        ? afterOverRow
          ? remainingRows.findIndex((row) => row.id === afterOverRow.id)
          : remainingRows.length
        : remainingRows.findIndex((row) => row.id === overId)

    if (insertIndex < 0) {
      return
    }

    const updatedAt = new Date().toISOString()
    const reorderedCountries = [
      ...remainingRows.slice(0, insertIndex),
      ...movingRows.map((row) => ({ ...row, updatedAt })),
      ...remainingRows.slice(insertIndex),
    ]

    persist({
      ...template,
      countriesModule: {
        ...template.countriesModule,
        updatedAt,
      },
      countries: reorderedCountries,
    })
  }

  function deleteTask(taskId: string) {
    if (!activeTaskGroup) {
      return
    }

    const updatedAt = new Date().toISOString()

    persist({
      ...template,
      taskGroups: template.taskGroups.map((group) =>
        group.id === activeTaskGroup.id
          ? {
              ...group,
              updatedAt,
              tasks: group.tasks.filter((task) => task.id !== taskId),
            }
          : group
      ),
    })
    setItemForm(null)
  }

  function saveModuleDetails() {
    if (!editingModuleId) {
      return
    }

    const updatedAt = new Date().toISOString()
    const tab = moduleDetailsDraft.tab.trim()

    if (!tab) {
      return
    }

    if (editingModuleId === countriesModuleId) {
      persist({
        ...template,
        countriesModule: {
          ...template.countriesModule,
          tab,
          title: tab,
          description: "",
          level: moduleDetailsDraft.level,
          updatedAt,
        },
      })
      cancelModuleDetailsForm()
      return
    }

    persist({
      ...template,
      taskGroups: template.taskGroups.map((group) =>
        group.id === editingModuleId
          ? {
              ...group,
              tab,
              title: tab,
              description: "",
              level: moduleDetailsDraft.level,
              updatedAt,
            }
          : group
      ),
    })
    cancelModuleDetailsForm()
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <main className="flex min-h-svh flex-col bg-background md:min-h-[calc(100svh-1rem)]">
          <SiteHeader title="Modules" />
          <div className="grid gap-4 px-4 py-4 lg:px-6">
            {!activeModuleId ? (
              <Card className="rounded-lg shadow-sm">
                <CardHeader className="gap-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>Modules</CardTitle>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => setShowModuleForm(true)}>
                        <PlusIcon />
                        Add New Module
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {showModuleForm ? (
                    <Card role="dialog" className="rounded-lg shadow-none">
                      <CardHeader>
                        <CardTitle>Add New Module</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <FieldSet>
                          <FieldLegend>Module Details</FieldLegend>
                          <FieldGroup className="grid gap-4 md:grid-cols-2">
                            <Field>
                              <FieldLabel htmlFor="module-name">
                                Module Name
                              </FieldLabel>
                              <Input
                                id="module-name"
                                value={moduleDraft.name}
                                onChange={(event) =>
                                  setModuleDraft((current) => ({
                                    ...current,
                                    name: event.target.value,
                                  }))
                                }
                                placeholder="New module name"
                              />
                            </Field>
                            <LevelField
                              id="module-level"
                              value={moduleDraft.level}
                              onChange={(level) =>
                                setModuleDraft((current) => ({
                                  ...current,
                                  level,
                                }))
                              }
                            />
                          </FieldGroup>
                        </FieldSet>
                        <div className="mt-5 flex justify-end gap-2">
                          <Button variant="outline" onClick={cancelModuleForm}>
                            <XIcon />
                            Cancel
                          </Button>
                          <Button onClick={saveNewModule}>
                            <SaveIcon />
                            Save
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}
                  {editingModuleId ? (
                    <ModuleDetailsPanel
                      draft={moduleDetailsDraft}
                      onChange={setModuleDetailsDraft}
                      onCancel={cancelModuleDetailsForm}
                      onSave={saveModuleDetails}
                    />
                  ) : null}

                  <Table containerClassName="rounded-lg border bg-background">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Module Name</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Last Modified</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {modules.map((module) => (
                        <TableRow
                          key={module.id}
                          className="group cursor-pointer"
                          onClick={() => {
                            setActiveModuleId(module.id)
                            setItemForm(null)
                            setActiveCountryId(null)
                          }}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <span className="underline-offset-4 group-hover:underline">
                                {module.name}
                              </span>
                              <Badge variant="secondary">{module.count}</Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <ModuleLevelBadge level={module.level} />
                          </TableCell>
                          <TableCell>
                            {formatModified(module.lastModified)}
                          </TableCell>
                          <TableCell
                            onClick={(event) => event.stopPropagation()}
                          >
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={`Actions for ${module.name}`}
                                  />
                                }
                              >
                                <MoreHorizontalIcon />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => startEditModule(module.id)}
                                >
                                  <PencilIcon />
                                  Edit Module
                                </DropdownMenuItem>
                                {protectedModuleIds.has(module.id) ? null : (
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => deleteModule(module.id)}
                                  >
                                    <Trash2Icon />
                                    Delete
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              <Card className="rounded-lg shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        className="h-9 w-9 shrink-0 rounded-full md:h-9 md:w-9"
                        aria-label={
                          activeCountry
                            ? "Back to countries"
                            : "Back to modules"
                        }
                        onClick={() => {
                          if (activeCountry) {
                            requestCloseActiveCountry()
                            return
                          }

                          setActiveModuleId(null)
                          setItemForm(null)
                          setActiveCountryId(null)
                        }}
                      >
                        <ArrowLeftIcon />
                      </Button>
                      <CardTitle className="min-w-0 truncate">
                        {activeCountry?.name ?? activeModule?.name}
                      </CardTitle>
                    </div>
                    {activeCountry ? null : (
                      <Button onClick={startAddItem}>
                        <PlusIcon />
                        Add New
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {itemForm ? (
                    itemForm.mode === "edit-country" ? null : (
                      <ItemFormPanel
                        form={itemForm}
                        parentRows={parentRows}
                        template={template}
                        onChange={setItemForm}
                        onCancel={() => setItemForm(null)}
                        onSave={saveItemForm}
                      />
                    )
                  ) : null}

                  {activeModuleId === countriesModuleId && activeCountry ? (
                    <CountryMappingPanel
                      ref={countryMappingPanelRef}
                      country={activeCountry}
                      detailsForm={
                        itemForm?.mode === "edit-country" ? itemForm : null
                      }
                      parentRows={parentRows}
                      template={template}
                      mappingHeaders={activeCountryMappingHeaders}
                      showExitPrompt={showCountryExitPrompt}
                      onChangeDetailsForm={setItemForm}
                      onSaveDetailsForm={saveItemForm}
                      onSaveAndExit={saveMappingsAndCloseCountry}
                      onDiscardAndExit={discardMappingsAndCloseCountry}
                      onKeepEditing={() => setShowCountryExitPrompt(false)}
                      onLoadSample={loadMappingSample}
                      onLoadSampleText={loadMappingSampleText}
                      onSaveMapping={(mappingType, mapping) =>
                        updateCountryReportMapping(
                          activeCountry.id,
                          mappingType,
                          mapping
                        )
                      }
                    />
                  ) : activeModuleId === countriesModuleId ? (
                    <CountriesTable
                      template={template}
                      itemForm={
                        itemForm?.mode === "edit-country" ? itemForm : null
                      }
                      rowIds={countryRowIds}
                      sensors={countryRowDndSensors}
                      onChangeItemForm={setItemForm}
                      onCancelItemForm={() => setItemForm(null)}
                      onOpenCountry={openCountry}
                      onEditCountry={startEditCountry}
                      onDeleteCountry={deleteCountryRow}
                      onDragEnd={reorderCountryRow}
                      onSaveItemForm={saveItemForm}
                    />
                  ) : activeTaskGroup ? (
                    <TasksTable
                      group={activeTaskGroup}
                      onEditTask={startEditTask}
                      onDeleteTask={deleteTask}
                    />
                  ) : null}
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

function ModuleDetailsPanel({
  draft,
  onChange,
  onCancel,
  onSave,
}: {
  draft: ModuleDetailsDraft
  onChange: React.Dispatch<React.SetStateAction<ModuleDetailsDraft>>
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <Card className="rounded-lg shadow-none">
      <CardHeader>
        <CardTitle>Module Details</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldSet>
          <FieldLegend>Module Settings</FieldLegend>
          <FieldGroup className="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="module-detail-tab">Module Title</FieldLabel>
              <Input
                id="module-detail-tab"
                value={draft.tab}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    tab: event.target.value,
                  }))
                }
              />
            </Field>
            <LevelField
              id="module-detail-level"
              value={draft.level}
              onChange={(level) =>
                onChange((current) => ({
                  ...current,
                  level,
                }))
              }
            />
          </FieldGroup>
        </FieldSet>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            <XIcon />
            Cancel
          </Button>
          <Button onClick={onSave}>
            <SaveIcon />
            Save Module Details
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function SortableCountryRow({
  row,
  rowIndex,
  template,
  itemForm,
  onChangeItemForm,
  onCancelItemForm,
  onOpenCountry,
  onEditCountry,
  onDeleteCountry,
  onSaveItemForm,
}: {
  row: TemplateCountryRow
  rowIndex: number
  template: MonthEndTemplate
  itemForm: Extract<ItemForm, { mode: "edit-country" }> | null
  onChangeItemForm: (form: ItemForm) => void
  onCancelItemForm: () => void
  onOpenCountry: (row: TemplateCountryRow, rowIndex: number) => void
  onEditCountry: (row: TemplateCountryRow, rowIndex: number) => void
  onDeleteCountry: (rowIndex: number) => void
  onSaveItemForm: () => void
}) {
  const isGroup = row.checkable === false
  const parentId = findParentId(template, rowIndex)
  const parent = template.countries.find((item) => item.id === parentId)
  const isEditing = itemForm?.rowId === row.id
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id })

  return (
    <React.Fragment>
      <TableRow
        ref={setNodeRef}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
        }}
        className={
          (isGroup ? "bg-muted/30" : "") +
          (isDragging ? " relative z-10 shadow-lg" : "")
        }
      >
        <TableCell className="w-12">
          <button
            type="button"
            className="grid size-8 touch-none place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`Reorder ${row.name}`}
            {...attributes}
            {...listeners}
          >
            <GripVerticalIcon className="size-4" />
          </button>
        </TableCell>
        <TableCell className={isGroup ? "font-semibold" : "font-medium"}>
          <button
            type="button"
            className="block max-w-full cursor-pointer truncate text-left underline-offset-4 hover:underline"
            style={{ marginLeft: `${row.indent * 1.5}rem` }}
            onClick={() => onOpenCountry(row, rowIndex)}
          >
            {row.name}
          </button>
        </TableCell>
        <TableCell>
          <Badge variant={isGroup ? "outline" : "secondary"}>
            {isGroup ? "Group" : "Country"}
          </Badge>
        </TableCell>
        <TableCell>{parent?.name ?? "Top Level"}</TableCell>
        <TableCell>
          {isGroup ? (
            <span className="text-muted-foreground">Blank row</span>
          ) : (
            <div className="flex flex-wrap gap-2">
              {row.invoiceRequired ? (
                <Badge variant="outline">Invoice</Badge>
              ) : null}
              {row.requiresPasteReport ? (
                <Badge variant="outline">Paste Report</Badge>
              ) : null}
              <Badge variant="outline">Reconciliation</Badge>
              <Badge variant="outline">Journal</Badge>
            </div>
          )}
        </TableCell>
        <TableCell>
          <CombinedCountryBadges row={row} template={template} />
        </TableCell>
        <TableCell>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Edit ${row.name}`}
                />
              }
            >
              <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEditCountry(row, rowIndex)}>
                <PencilIcon />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDeleteCountry(rowIndex)}
              >
                <Trash2Icon />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
      {isEditing ? (
        <TableRow className="bg-muted/20 hover:bg-muted/20">
          <TableCell colSpan={7} className="p-3">
            <div
              role="dialog"
              aria-label={`Edit ${row.name}`}
              className="rounded-lg border bg-background p-4 shadow-sm"
            >
              <CountryFields
                form={itemForm}
                parentRows={template.countries}
                template={template}
                onChange={onChangeItemForm}
              />
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="outline" onClick={onCancelItemForm}>
                  <XIcon />
                  Cancel
                </Button>
                <Button onClick={onSaveItemForm}>
                  <SaveIcon />
                  Save
                </Button>
              </div>
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </React.Fragment>
  )
}

function CountriesTable({
  template,
  itemForm,
  rowIds,
  sensors,
  onChangeItemForm,
  onCancelItemForm,
  onOpenCountry,
  onEditCountry,
  onDeleteCountry,
  onDragEnd,
  onSaveItemForm,
}: {
  template: MonthEndTemplate
  itemForm: Extract<ItemForm, { mode: "edit-country" }> | null
  rowIds: string[]
  sensors: React.ComponentProps<typeof DndContext>["sensors"]
  onChangeItemForm: (form: ItemForm) => void
  onCancelItemForm: () => void
  onOpenCountry: (row: TemplateCountryRow, rowIndex: number) => void
  onEditCountry: (row: TemplateCountryRow, rowIndex: number) => void
  onDeleteCountry: (rowIndex: number) => void
  onDragEnd: (event: DragEndEvent) => void
  onSaveItemForm: () => void
}) {
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <Table containerClassName="rounded-lg border bg-background">
        <TableHeader>
          <TableRow>
            <TableHead className="w-12" />
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Parent</TableHead>
            <TableHead>Required Fields</TableHead>
            <TableHead>Combined</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <SortableContext
            items={rowIds}
            strategy={verticalListSortingStrategy}
          >
            {template.countries.map((row, rowIndex) => (
              <SortableCountryRow
                key={row.id}
                row={row}
                rowIndex={rowIndex}
                template={template}
                itemForm={itemForm}
                onChangeItemForm={onChangeItemForm}
                onCancelItemForm={onCancelItemForm}
                onOpenCountry={onOpenCountry}
                onEditCountry={onEditCountry}
                onDeleteCountry={onDeleteCountry}
                onSaveItemForm={onSaveItemForm}
              />
            ))}
          </SortableContext>
        </TableBody>
      </Table>
    </DndContext>
  )
}

type ReportMappingCardHandle = {
  openSample: () => void
  addExtraField: () => void
  resetToDefaultMapping: () => void
  hasUnsavedChanges: () => boolean
  saveMapping: () => void
  discardChanges: () => void
}

type CountryMappingPanelHandle = {
  hasUnsavedChanges: () => boolean
  saveMappings: () => void
  discardMappings: () => void
}

const CountryMappingPanel = React.forwardRef<
  CountryMappingPanelHandle,
  {
    country: TemplateCountryRow
    detailsForm: Extract<ItemForm, { mode: "edit-country" }> | null
    parentRows: TemplateCountryRow[]
    template: MonthEndTemplate
    mappingHeaders: Record<
      "countryReport" | "masterReport",
      ReportSampleField[]
    >
    showExitPrompt: boolean
    onChangeDetailsForm: (form: ItemForm) => void
    onSaveDetailsForm: () => void
    onSaveAndExit: () => void
    onDiscardAndExit: () => void
    onKeepEditing: () => void
    onLoadSample: (
      file: File,
      mappingKind: "countryReport" | "masterReport"
    ) => Promise<{
      headerRowIndex: number
      headers: string[]
      fields: ReportSampleField[]
    }>
    onLoadSampleText: (
      csvText: string,
      mappingKind: "countryReport" | "masterReport"
    ) => Promise<{
      headerRowIndex: number
      headers: string[]
      fields: ReportSampleField[]
    }>
    onSaveMapping: (
      mappingType: "countryReportMapping" | "masterReportMapping",
      mapping?: ReportFieldMapping
    ) => void
  }
>(function CountryMappingPanel(
  {
    country,
    detailsForm,
    parentRows,
    template,
    mappingHeaders,
    showExitPrompt,
    onChangeDetailsForm,
    onSaveDetailsForm,
    onSaveAndExit,
    onDiscardAndExit,
    onKeepEditing,
    onLoadSample,
    onLoadSampleText,
    onSaveMapping,
  },
  ref
) {
  const [activeMappingTab, setActiveMappingTab] =
    React.useState("country-report")
  const [showResetConfirm, setShowResetConfirm] = React.useState(false)
  const countryReportMappingRef = React.useRef<ReportMappingCardHandle>(null)
  const masterReportMappingRef = React.useRef<ReportMappingCardHandle>(null)
  const activeMappingRef =
    activeMappingTab === "master-report"
      ? masterReportMappingRef
      : countryReportMappingRef

  React.useImperativeHandle(ref, () => ({
    hasUnsavedChanges() {
      return (
        countryReportMappingRef.current?.hasUnsavedChanges() === true ||
        masterReportMappingRef.current?.hasUnsavedChanges() === true
      )
    },
    saveMappings() {
      countryReportMappingRef.current?.saveMapping()
      masterReportMappingRef.current?.saveMapping()
    },
    discardMappings() {
      countryReportMappingRef.current?.discardChanges()
      masterReportMappingRef.current?.discardChanges()
    },
  }))

  return (
    <div className="grid gap-4">
      {showExitPrompt ? (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 md:flex-row md:items-center md:justify-between">
          <span>Save your mapping changes before leaving this country?</span>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={onSaveAndExit}>
              <SaveIcon />
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={onDiscardAndExit}>
              Cancel Changes
            </Button>
            <Button size="sm" variant="ghost" onClick={onKeepEditing}>
              Keep Editing
            </Button>
          </div>
        </div>
      ) : null}
      {detailsForm ? (
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">Country Information</h2>
          <div className="rounded-lg border bg-background p-4">
            <CountryFields
              form={detailsForm}
              parentRows={parentRows}
              template={template}
              onChange={onChangeDetailsForm}
              showLegend={false}
            />
            <div className="mt-5 flex justify-end gap-2">
              <Button onClick={onSaveDetailsForm}>
                <SaveIcon />
                Save
              </Button>
            </div>
          </div>
        </section>
      ) : null}
      <Tabs
        value={activeMappingTab}
        onValueChange={setActiveMappingTab}
        className="min-h-0 flex-1 gap-4"
      >
        <h2 className="text-lg font-semibold">Report Mapping</h2>
        <div className="flex items-center gap-3">
          <div className="-mx-4 min-w-0 flex-1 overflow-x-auto px-4 md:mx-0 md:px-0">
            <TabsList className="h-auto min-h-11 w-max min-w-full flex-nowrap items-center gap-1 rounded-[1.375rem] p-1 md:min-w-0">
              <TabsTrigger
                value="country-report"
                className="h-9 flex-none rounded-[1.05rem] px-4 py-2 leading-none"
              >
                Country Report
              </TabsTrigger>
              <TabsTrigger
                value="master-report"
                className="h-9 flex-none rounded-[1.05rem] px-4 py-2 leading-none"
              >
                NetSuite Master
              </TabsTrigger>
            </TabsList>
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2">
            <Button
              variant="outline"
              className="h-9"
              onClick={() => activeMappingRef.current?.openSample()}
            >
              <FileSpreadsheetIcon />
              Sample
            </Button>
            <DropdownMenu
              onOpenChange={(open) => {
                if (!open) {
                  setShowResetConfirm(false)
                }
              }}
            >
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-full p-0"
                    aria-label="Report mapping actions"
                  />
                }
              >
                <MoreHorizontalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-40">
                {showResetConfirm ? (
                  <>
                    <button
                      type="button"
                      className="relative flex min-h-10 w-full cursor-default items-center gap-2 rounded-xl px-2 py-2 text-left text-sm whitespace-nowrap text-destructive outline-hidden select-none hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive md:min-h-7 md:py-1.5 [&_svg]:size-4 [&_svg]:shrink-0"
                      onClick={() => {
                        activeMappingRef.current?.resetToDefaultMapping()
                        setShowResetConfirm(false)
                      }}
                    >
                      <Trash2Icon />
                      Confirm Reset
                    </button>
                    <button
                      type="button"
                      className="relative flex min-h-10 w-full cursor-default items-center gap-2 rounded-xl px-2 py-2 text-left text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground md:min-h-7 md:py-1.5 [&_svg]:size-4 [&_svg]:shrink-0"
                      onClick={() => {
                        setShowResetConfirm(false)
                      }}
                    >
                      <XIcon />
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem
                      onClick={() => activeMappingRef.current?.addExtraField()}
                    >
                      <PlusIcon />
                      Add Field
                    </DropdownMenuItem>
                    <button
                      type="button"
                      className="relative flex min-h-10 w-full cursor-default items-center gap-2 rounded-xl px-2 py-2 text-left text-sm text-destructive outline-hidden select-none hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive md:min-h-7 md:py-1.5 [&_svg]:size-4 [&_svg]:shrink-0"
                      onClick={() => {
                        setShowResetConfirm(true)
                      }}
                    >
                      <Trash2Icon />
                      Reset
                    </button>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <TabsContent value="country-report" className="m-0">
          <ReportMappingCard
            ref={countryReportMappingRef}
            mappingKind="countryReport"
            fields={countryReportMappingFields}
            mapping={country.countryReportMapping}
            sampleHeaders={mappingHeaders.countryReport}
            sampleMode={country.requiresPasteReport ? "paste" : "upload"}
            onLoadSample={onLoadSample}
            onLoadSampleText={onLoadSampleText}
            onSave={(mapping) => onSaveMapping("countryReportMapping", mapping)}
          />
        </TabsContent>
        <TabsContent value="master-report" className="m-0">
          <ReportMappingCard
            ref={masterReportMappingRef}
            mappingKind="masterReport"
            fields={masterReportMappingFields}
            mapping={country.masterReportMapping}
            sampleHeaders={mappingHeaders.masterReport}
            sampleMode="upload"
            onLoadSample={onLoadSample}
            onLoadSampleText={onLoadSampleText}
            onSave={(mapping) => onSaveMapping("masterReportMapping", mapping)}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
})

function normalizeMappingHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "")
}

function normalizePastedReportText(value: string) {
  return value
    .split(/\r?\n/)
    .map((row) => (row.includes("\t") ? row.split("\t").join(",") : row))
    .join("\n")
}

function analyzeReportSample(value: string): {
  headerRowIndex: number
  headers: string[]
  fields: ReportSampleField[]
} {
  const normalizedText = normalizePastedReportText(value)
  const rows = parseCsv(normalizedText)
  const headerRowIndex = rows.findIndex(
    (row) => row.filter((cell) => cell.trim()).length >= 2
  )
  const headers = rows[headerRowIndex] ?? []
  const dataRows = headerRowIndex >= 0 ? rows.slice(headerRowIndex + 1) : []
  const hasStructuredColumns =
    headerRowIndex >= 0 &&
    headers.length > 1 &&
    headers.some((header) => header.trim()) &&
    dataRows.some((row) => row.filter((cell) => cell.trim()).length > 1)

  if (hasStructuredColumns) {
    return {
      headerRowIndex,
      headers,
      fields: headers
        .map((header, columnIndex) => ({
          sourceColumn: header || `Column ${columnIndex + 1}`,
          label: header || `Column ${columnIndex + 1}`,
          previewValues: dataRows
            .map((row) => row[columnIndex]?.trim() ?? "")
            .filter(Boolean)
            .slice(0, 3),
        }))
        .filter((field) => field.label.trim()),
    }
  }

  const textLines = normalizedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const previewLines = textLines.slice(0, 3)
  const lineFields = textLines.slice(0, 8).map((line, index) => ({
    sourceColumn: `__text_line_${index + 1}__`,
    label: `Text Line ${index + 1}`,
    previewValues: [line],
  }))

  return {
    headerRowIndex: 0,
    headers: [
      "__full_text__",
      ...lineFields.map((field) => field.sourceColumn),
    ],
    fields: [
      {
        sourceColumn: "__full_text__",
        label: "Full Text",
        previewValues: previewLines,
      },
      ...lineFields,
    ],
  }
}

async function parseCountryReportSampleFile(file: File) {
  try {
    return (await parseCountryReportUploadFile(file)).records
  } catch {
    return []
  }
}

function parseCountryReportSampleText(text: string) {
  try {
    return parseCountryReportText(text)
  } catch {
    return []
  }
}

function parsedCountryReportSampleFields(records: ParsedCountryReportRecord[]) {
  const fieldConfigs = [
    {
      sourceColumn: "__parsed_invoice_number__",
      label: "Parsed Invoice Number",
      getValue: (record: ParsedCountryReportRecord) => record.invoiceNumber,
    },
    {
      sourceColumn: "__parsed_ctn_number__",
      label: "Parsed CTN / ECTN Number",
      getValue: (record: ParsedCountryReportRecord) => record.ctnNumber,
    },
    {
      sourceColumn: "__parsed_bill_of_lading_number__",
      label: "Parsed Bill of Lading Number",
      getValue: (record: ParsedCountryReportRecord) =>
        record.billOfLadingNumber,
    },
    {
      sourceColumn: "__parsed_reference__",
      label: "Parsed Reference",
      getValue: (record: ParsedCountryReportRecord) => record.reference,
    },
    {
      sourceColumn: "__parsed_amount__",
      label: "Parsed Amount",
      getValue: (record: ParsedCountryReportRecord) =>
        record.amount ? String(record.amount) : "",
    },
    {
      sourceColumn: "__parsed_source_country__",
      label: "Parsed Source Country",
      getValue: (record: ParsedCountryReportRecord) =>
        record.sourceCountryName ?? "",
    },
  ]

  return fieldConfigs
    .map((field) => ({
      sourceColumn: field.sourceColumn,
      label: field.label,
      previewValues: records
        .map(field.getValue)
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 3),
    }))
    .filter((field) => field.previewValues.length)
}

function mergeParsedCountryReportSampleFields(
  sample: {
    headerRowIndex: number
    headers: string[]
    fields: ReportSampleField[]
  },
  records: ParsedCountryReportRecord[]
) {
  const parsedFields = parsedCountryReportSampleFields(records)

  if (!parsedFields.length) {
    return sample
  }

  return {
    ...sample,
    headers: [
      ...parsedFields.map((field) => field.sourceColumn),
      ...sample.headers,
    ],
    fields: [...parsedFields, ...sample.fields],
  }
}

function getSuggestedHeader(
  sampleFields: ReportSampleField[],
  field: ReportMappingFieldDefinition
) {
  const normalizedAliases = new Set(field.aliases.map(normalizeMappingHeader))
  const exactMatch = sampleFields.find((sampleField) =>
    normalizedAliases.has(normalizeMappingHeader(sampleField.label))
  )

  if (exactMatch) {
    return exactMatch.sourceColumn
  }

  return sampleFields.find((sampleField) => {
    const normalizedHeader = normalizeMappingHeader(sampleField.label)

    return field.aliases.some((alias) =>
      normalizedHeader.includes(normalizeMappingHeader(alias))
    )
  })?.sourceColumn
}

function makeExtraMappingId() {
  return `extra-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function cloneFieldMapping(mapping: ReportFieldMapping): ReportFieldMapping {
  return {
    headerRowIndex: mapping.headerRowIndex,
    fields: { ...mapping.fields },
    extraFields: mapping.extraFields?.map((field) => ({ ...field })) ?? [],
  }
}

function emptyReportMapping(): ReportFieldMapping {
  return {
    headerRowIndex: 0,
    fields: {},
    extraFields: [],
  }
}

function serializeReportMapping(mapping: ReportFieldMapping | undefined) {
  return JSON.stringify(mapping ?? emptyReportMapping())
}

const ReportMappingCard = React.forwardRef<
  ReportMappingCardHandle,
  {
    mappingKind: "countryReport" | "masterReport"
    fields: ReportMappingFieldDefinition[]
    mapping?: ReportFieldMapping
    sampleHeaders: ReportSampleField[]
    sampleMode: "upload" | "paste"
    onLoadSample: (
      file: File,
      mappingKind: "countryReport" | "masterReport"
    ) => Promise<{
      headerRowIndex: number
      headers: string[]
      fields: ReportSampleField[]
    }>
    onLoadSampleText: (
      csvText: string,
      mappingKind: "countryReport" | "masterReport"
    ) => Promise<{
      headerRowIndex: number
      headers: string[]
      fields: ReportSampleField[]
    }>
    onSave: (mapping?: ReportFieldMapping) => void
  }
>(function ReportMappingCard(
  {
    mappingKind,
    fields,
    mapping,
    sampleHeaders,
    sampleMode,
    onLoadSample,
    onLoadSampleText,
    onSave,
  },
  ref
) {
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const [showPasteSample, setShowPasteSample] = React.useState(false)
  const [pasteSample, setPasteSample] = React.useState("")
  const [hasPendingSample, setHasPendingSample] = React.useState(false)
  const [draft, setDraft] = React.useState<ReportFieldMapping>(
    mapping ?? {
      headerRowIndex: 0,
      fields: {},
      extraFields: [],
    }
  )
  const sampleFields = sampleHeaders.length
    ? sampleHeaders
    : [
        ...Object.values(draft.fields)
          .filter(Boolean)
          .map((sourceColumn) => ({
            sourceColumn,
            label: sourceColumn,
            previewValues: [],
          })),
        ...(draft.extraFields
          ?.map((field) => field.sourceColumn)
          .filter(Boolean)
          .map((sourceColumn) => ({
            sourceColumn,
            label: sourceColumn,
            previewValues: [],
          })) ?? []),
      ]
  const fieldLabelsBySource = new Map(
    sampleFields.map((sampleField) => [
      sampleField.sourceColumn,
      sampleField.label,
    ])
  )
  React.useEffect(() => {
    setDraft(
      mapping ?? {
        headerRowIndex: 0,
        fields: {},
        extraFields: [],
      }
    )
  }, [mapping])

  async function handleSampleFile(file: File) {
    const sample = await onLoadSample(file, mappingKind)

    applySampleHeaders(sample)
    setHasPendingSample(true)
  }

  async function handleSamplePaste() {
    const sample = await onLoadSampleText(pasteSample, mappingKind)

    applySampleHeaders(sample)
    setHasPendingSample(true)
  }

  function applySampleHeaders(sample: {
    headerRowIndex: number
    headers: string[]
    fields: ReportSampleField[]
  }) {
    setDraft((current) => ({
      headerRowIndex: sample.headerRowIndex,
      fields: fields.reduce<ReportFieldMapping["fields"]>(
        (nextFields, field) => {
          nextFields[field.id] =
            current.fields[field.id] ?? getSuggestedHeader(sample.fields, field)

          return nextFields
        },
        {}
      ),
      extraFields: current.extraFields ?? [],
    }))
  }

  function updateField(field: ReportMappingField, value: string) {
    setDraft((current) => ({
      ...current,
      fields: {
        ...current.fields,
        [field]: value === reportMappingNoneValue ? undefined : value,
      },
    }))
  }

  function formatMappedSource(value: string | undefined) {
    return value ? (fieldLabelsBySource.get(value) ?? value) : "Not mapped"
  }

  function getAssignedTargetValue(sourceColumn: string) {
    const coreField = fields.find(
      (field) => draft.fields[field.id] === sourceColumn
    )

    if (coreField) {
      return `core:${coreField.id}`
    }

    const extraField = draft.extraFields?.find(
      (field) => field.sourceColumn === sourceColumn
    )

    return extraField ? `extra:${extraField.id}` : reportMappingNoneValue
  }

  function assignSourceField(sourceColumn: string, targetValue: string | null) {
    setDraft((current) => {
      const clearedFields = Object.fromEntries(
        Object.entries(current.fields).map(([fieldId, mappedSource]) => [
          fieldId,
          mappedSource === sourceColumn ? undefined : mappedSource,
        ])
      ) as ReportFieldMapping["fields"]
      const clearedExtraFields = (current.extraFields ?? []).map((field) =>
        field.sourceColumn === sourceColumn
          ? { ...field, sourceColumn: "" }
          : field
      )

      if (!targetValue || targetValue === reportMappingNoneValue) {
        return {
          ...current,
          fields: clearedFields,
          extraFields: clearedExtraFields,
        }
      }

      if (targetValue.startsWith("core:")) {
        const fieldId = targetValue.replace("core:", "") as ReportMappingField

        return {
          ...current,
          fields: {
            ...clearedFields,
            [fieldId]: sourceColumn,
          },
          extraFields: clearedExtraFields,
        }
      }

      if (targetValue.startsWith("extra:")) {
        const extraFieldId = targetValue.replace("extra:", "")

        return {
          ...current,
          fields: clearedFields,
          extraFields: clearedExtraFields.map((field) =>
            field.id === extraFieldId ? { ...field, sourceColumn } : field
          ),
        }
      }

      return current
    })
  }

  function addExtraField() {
    setDraft((current) => ({
      ...current,
      extraFields: [
        ...(current.extraFields ?? []),
        { id: makeExtraMappingId(), label: "New Field", sourceColumn: "" },
      ],
    }))
  }

  function updateExtraField(
    fieldId: string,
    updates: Partial<NonNullable<ReportFieldMapping["extraFields"]>[number]>
  ) {
    setDraft((current) => ({
      ...current,
      extraFields: (current.extraFields ?? []).map((field) =>
        field.id === fieldId ? { ...field, ...updates } : field
      ),
    }))
  }

  function removeExtraField(fieldId: string) {
    setDraft((current) => ({
      ...current,
      extraFields: (current.extraFields ?? []).filter(
        (field) => field.id !== fieldId
      ),
    }))
  }

  function resetToDefaultMapping() {
    onSave(
      cloneFieldMapping(
        mappingKind === "countryReport"
          ? defaultCountryReportMapping
          : defaultMasterReportMapping
      )
    )
    setHasPendingSample(false)
  }

  function saveMapping() {
    onSave(draft)
    setHasPendingSample(false)
  }

  function discardChanges() {
    setDraft(mapping ?? emptyReportMapping())
    setHasPendingSample(false)
    setShowPasteSample(false)
  }

  React.useImperativeHandle(ref, () => ({
    openSample() {
      if (sampleMode === "paste") {
        setShowPasteSample((current) => !current)
        return
      }

      inputRef.current?.click()
    },
    addExtraField,
    resetToDefaultMapping,
    hasUnsavedChanges() {
      return (
        hasPendingSample ||
        serializeReportMapping(draft) !== serializeReportMapping(mapping)
      )
    },
    saveMapping,
    discardChanges,
  }))

  return (
    <Card className="rounded-lg shadow-none">
      <CardContent className="grid gap-4">
        {sampleMode === "upload" ? (
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.pdf,.xls,.xlsx,text/csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]

              if (file) {
                handleSampleFile(file)
              }

              event.currentTarget.value = ""
            }}
          />
        ) : null}
        {sampleMode === "paste" && showPasteSample ? (
          <div className="grid gap-3 rounded-lg border bg-muted/20 p-3">
            <Textarea
              value={pasteSample}
              onChange={(event) => setPasteSample(event.target.value)}
              placeholder="Paste the report rows here, including the header row."
              className="min-h-36"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowPasteSample(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSamplePaste}
                disabled={!pasteSample.trim()}
              >
                Use Sample
              </Button>
            </div>
          </div>
        ) : null}
        {sampleHeaders.length ? (
          <div className="grid gap-2">
            {sampleFields.map((sampleField, index) => (
              <div
                key={`${sampleField.sourceColumn}-${index}`}
                className="grid gap-3 rounded-lg border bg-background p-3 md:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)] md:items-center"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {sampleField.label}
                  </div>
                  {sampleField.previewValues.length ? (
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {sampleField.previewValues.join(" | ")}
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-muted-foreground">
                      No preview values found.
                    </div>
                  )}
                </div>
                <Select
                  value={getAssignedTargetValue(sampleField.sourceColumn)}
                  onValueChange={(value) =>
                    assignSourceField(sampleField.sourceColumn, value)
                  }
                >
                  <SelectTrigger className="w-full cursor-pointer">
                    {formatAssignedTarget(
                      getAssignedTargetValue(sampleField.sourceColumn),
                      fields,
                      draft.extraFields ?? []
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={reportMappingNoneValue}>
                        Not mapped
                      </SelectItem>
                      {fields.map((field) => (
                        <SelectItem key={field.id} value={`core:${field.id}`}>
                          {field.label}
                        </SelectItem>
                      ))}
                      {(draft.extraFields ?? []).map((field) => (
                        <SelectItem key={field.id} value={`extra:${field.id}`}>
                          {field.label || "Extra Field"}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            ))}
            {(draft.extraFields ?? []).map((field) => (
              <ExtraMappingField
                key={field.id}
                field={field}
                onChange={updateExtraField}
                onRemove={removeExtraField}
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {fields.map((field) => (
              <Field key={field.id}>
                <div className="flex items-center gap-1.5">
                  <FieldLabel>{field.label}</FieldLabel>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          className="text-muted-foreground transition-colors hover:text-foreground"
                          aria-label={`About ${field.label}`}
                        >
                          <InfoIcon className="size-3.5" />
                        </button>
                      }
                    />
                    <TooltipContent>{field.description}</TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={draft.fields[field.id] ?? reportMappingNoneValue}
                  onValueChange={(value) => {
                    if (value) {
                      updateField(field.id, value)
                    }
                  }}
                  disabled={!sampleFields.length}
                >
                  <SelectTrigger className="w-full cursor-pointer">
                    {formatMappedSource(draft.fields[field.id])}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={reportMappingNoneValue}>
                        Not mapped
                      </SelectItem>
                      {sampleFields.map((sampleField, index) => (
                        <SelectItem
                          key={`${sampleField.sourceColumn}-${index}`}
                          value={sampleField.sourceColumn}
                        >
                          <div className="grid gap-0.5">
                            <span>{sampleField.label}</span>
                            {sampleField.previewValues.length ? (
                              <span className="max-w-72 truncate text-xs text-muted-foreground">
                                {sampleField.previewValues.join(" | ")}
                              </span>
                            ) : null}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            ))}
            {(draft.extraFields ?? []).map((field) => (
              <Field key={field.id}>
                <div className="flex items-center gap-2">
                  <Input
                    value={field.label}
                    onChange={(event) =>
                      updateExtraField(field.id, { label: event.target.value })
                    }
                    aria-label="Extra field name"
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${field.label || "extra field"}`}
                    onClick={() => removeExtraField(field.id)}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
                <Select
                  value={field.sourceColumn || reportMappingNoneValue}
                  onValueChange={(value) =>
                    updateExtraField(field.id, {
                      sourceColumn:
                        value && value !== reportMappingNoneValue ? value : "",
                    })
                  }
                  disabled={!sampleFields.length}
                >
                  <SelectTrigger className="w-full cursor-pointer">
                    {formatMappedSource(field.sourceColumn)}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={reportMappingNoneValue}>
                        Not mapped
                      </SelectItem>
                      {sampleFields.map((sampleField, index) => (
                        <SelectItem
                          key={`${sampleField.sourceColumn}-${index}`}
                          value={sampleField.sourceColumn}
                        >
                          <div className="grid gap-0.5">
                            <span>{sampleField.label}</span>
                            {sampleField.previewValues.length ? (
                              <span className="max-w-72 truncate text-xs text-muted-foreground">
                                {sampleField.previewValues.join(" | ")}
                              </span>
                            ) : null}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            ))}
          </div>
        )}
        {!sampleHeaders.length ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            {sampleMode === "paste"
              ? "Paste a sample report to choose its columns."
              : "Upload a sample report to choose its columns."}
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button onClick={saveMapping}>
            <SaveIcon />
            Save Mapping
          </Button>
        </div>
      </CardContent>
    </Card>
  )
})

function formatAssignedTarget(
  value: string,
  fields: ReportMappingFieldDefinition[],
  extraFields: NonNullable<ReportFieldMapping["extraFields"]>
) {
  if (value === reportMappingNoneValue) {
    return "Not mapped"
  }

  if (value.startsWith("core:")) {
    const fieldId = value.replace("core:", "")
    return fields.find((field) => field.id === fieldId)?.label ?? "Not mapped"
  }

  if (value.startsWith("extra:")) {
    const fieldId = value.replace("extra:", "")
    return (
      extraFields.find((field) => field.id === fieldId)?.label ?? "Extra Field"
    )
  }

  return "Not mapped"
}

function ExtraMappingField({
  field,
  onChange,
  onRemove,
}: {
  field: NonNullable<ReportFieldMapping["extraFields"]>[number]
  onChange: (
    fieldId: string,
    updates: Partial<NonNullable<ReportFieldMapping["extraFields"]>[number]>
  ) => void
  onRemove: (fieldId: string) => void
}) {
  return (
    <div className="grid gap-2 rounded-lg border border-dashed bg-muted/20 p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <Field>
        <FieldLabel>Extra Required Field</FieldLabel>
        <Input
          value={field.label}
          onChange={(event) =>
            onChange(field.id, { label: event.target.value })
          }
          aria-label="Extra field name"
        />
      </Field>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Remove ${field.label || "extra field"}`}
        onClick={() => onRemove(field.id)}
      >
        <Trash2Icon />
      </Button>
    </div>
  )
}

function TasksTable({
  group,
  onEditTask,
  onDeleteTask,
}: {
  group: MonthEndTemplate["taskGroups"][number]
  onEditTask: (task: TemplateSimpleTask) => void
  onDeleteTask: (taskId: string) => void
}) {
  return (
    <Table containerClassName="rounded-lg border bg-background">
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Level</TableHead>
          <TableHead>Required Field</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {group.tasks.map((task) => (
          <TableRow key={task.id}>
            <TableCell className="font-medium">{task.label}</TableCell>
            <TableCell>
              <ModuleLevelBadge level={group.level ?? "organizational"} />
            </TableCell>
            <TableCell>
              <Badge variant="outline">Checkbox</Badge>
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit ${task.label}`}
                    />
                  }
                >
                  <MoreHorizontalIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEditTask(task)}>
                    <PencilIcon />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => onDeleteTask(task.id)}
                  >
                    <Trash2Icon />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function ItemFormPanel({
  form,
  parentRows,
  template,
  onChange,
  onCancel,
  onSave,
}: {
  form: ItemForm
  parentRows: TemplateCountryRow[]
  template: MonthEndTemplate
  onChange: (form: ItemForm) => void
  onCancel: () => void
  onSave: () => void
}) {
  if (!form) {
    return null
  }

  const isCountryForm =
    form.mode === "add-country" || form.mode === "edit-country"
  const title = form.mode.startsWith("add") ? "Add New" : "Edit Item"

  return (
    <Card role="dialog" className="rounded-lg shadow-none">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isCountryForm ? (
          <CountryFields
            form={form}
            parentRows={parentRows}
            template={template}
            onChange={onChange}
          />
        ) : (
          <TaskFields form={form} onChange={onChange} />
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            <XIcon />
            Cancel
          </Button>
          <Button onClick={onSave}>
            <SaveIcon />
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function CountryFields({
  form,
  parentRows,
  template,
  onChange,
  showLegend = true,
}: {
  form: Extract<ItemForm, { mode: "add-country" | "edit-country" }>
  parentRows: TemplateCountryRow[]
  template: MonthEndTemplate
  onChange: (form: ItemForm) => void
  showLegend?: boolean
}) {
  const editedRowIndex =
    form.mode === "edit-country"
      ? template.countries.findIndex((row) => row.id === form.rowId)
      : -1
  const descendantIds =
    editedRowIndex >= 0
      ? getDescendantIds(template, editedRowIndex)
      : new Set<string>()
  const possibleParents =
    form.mode === "edit-country"
      ? parentRows.filter(
          (row) => row.id !== form.rowId && !descendantIds.has(row.id)
        )
      : parentRows
  const possibleCombinedCountries = template.countries.filter(
    (row) =>
      row.checkable !== false &&
      (form.mode !== "edit-country" || row.id !== form.rowId) &&
      !descendantIds.has(row.id)
  )

  function updateDraft(updates: Partial<CountryDraft>) {
    onChange({ ...form, draft: { ...form.draft, ...updates } })
  }

  return (
    <FieldSet>
      {showLegend ? <FieldLegend>Country Details</FieldLegend> : null}
      <FieldGroup className="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="country-row-name">Name</FieldLabel>
          <Input
            id="country-row-name"
            value={form.draft.name}
            onChange={(event) => updateDraft({ name: event.target.value })}
            placeholder="Country or group name"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="country-row-type">Type</FieldLabel>
          <Select
            value={form.draft.type}
            onValueChange={(value) =>
              updateDraft({
                type: value as CountryDraft["type"],
                invoiceRequired:
                  value === "country" ? form.draft.invoiceRequired : false,
              })
            }
          >
            <SelectTrigger
              id="country-row-type"
              className="w-full cursor-pointer"
            >
              {formatCountryType(form.draft.type)}
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="country">Country</SelectItem>
                <SelectItem value="group">Group</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="country-row-parent">Parent</FieldLabel>
          <ParentSearchField
            parents={possibleParents}
            value={form.draft.parentId}
            onChange={(parentId) => updateDraft({ parentId })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="country-row-invoice">
            Invoice Required
          </FieldLabel>
          <Select
            value={form.draft.invoiceRequired ? "yes" : "no"}
            onValueChange={(value) => {
              if (value) {
                updateDraft({ invoiceRequired: value === "yes" })
              }
            }}
          >
            <SelectTrigger
              id="country-row-invoice"
              className="w-full cursor-pointer"
              disabled={form.draft.type === "group"}
            >
              {form.draft.invoiceRequired ? "Yes" : "No"}
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="country-row-combined">Combined With</FieldLabel>
          <CombinedCountrySearchField
            countries={possibleCombinedCountries}
            value={form.draft.combinedWithCountryIds}
            disabled={form.draft.type === "group"}
            onChange={(combinedWithCountryIds) =>
              updateDraft({ combinedWithCountryIds })
            }
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="country-row-paste-report">
            Paste Report
          </FieldLabel>
          <Select
            value={form.draft.requiresPasteReport ? "yes" : "no"}
            onValueChange={(value) => {
              if (value) {
                updateDraft({ requiresPasteReport: value === "yes" })
              }
            }}
          >
            <SelectTrigger
              id="country-row-paste-report"
              className="w-full cursor-pointer"
              disabled={form.draft.type === "group"}
            >
              {form.draft.requiresPasteReport ? "Yes" : "No"}
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>
    </FieldSet>
  )
}

function CombinedCountrySearchField({
  countries,
  value,
  disabled,
  onChange,
}: {
  countries: TemplateCountryRow[]
  value: string[]
  disabled: boolean
  onChange: (value: string[]) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const selectedIds = new Set(value)
  const selectedCountries = countries.filter((row) => selectedIds.has(row.id))
  const filteredCountries = countries.filter((row) =>
    row.name.toLowerCase().includes(query.trim().toLowerCase())
  )

  function toggleCountry(countryId: string) {
    if (selectedIds.has(countryId)) {
      onChange(value.filter((id) => id !== countryId))
      return
    }

    onChange([...value, countryId])
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id="country-row-combined"
            variant="outline"
            className="h-10 w-full cursor-pointer justify-between border-transparent bg-input/50 hover:bg-input/50 aria-expanded:bg-input/50 md:h-8 dark:bg-input/30 dark:hover:bg-input/40 dark:aria-expanded:bg-input/40"
            disabled={disabled}
          />
        }
      >
        <span className="min-w-0 flex-1 truncate text-left">
          {selectedCountries.length ? (
            <>
              {selectedCountries[0]?.name}
              {selectedCountries.length > 1
                ? ` +${selectedCountries.length - 1}`
                : ""}
            </>
          ) : (
            <span className="truncate text-muted-foreground">None</span>
          )}
        </span>
        <ChevronsUpDownIcon />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96 gap-2 p-2">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search countries"
            className="pl-9"
          />
        </div>
        <div className="max-h-72 overflow-y-auto">
          {filteredCountries.map((row) => (
            <button
              key={row.id}
              type="button"
              className="flex min-h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm hover:bg-muted"
              style={{ paddingLeft: `${row.indent * 1.25 + 0.75}rem` }}
              onClick={() => toggleCountry(row.id)}
            >
              <Checkbox
                checked={selectedIds.has(row.id)}
                aria-label={`Combine with ${row.name}`}
                className="pointer-events-none"
              />
              <span className="min-w-0 flex-1 truncate">{row.name}</span>
            </button>
          ))}
          {filteredCountries.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No countries found.
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ParentSearchField({
  parents,
  value,
  onChange,
}: {
  parents: TemplateCountryRow[]
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const selectedParent = parents.find((row) => row.id === value)
  const filteredParents = parents.filter((row) =>
    row.name.toLowerCase().includes(query.trim().toLowerCase())
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id="country-row-parent"
            variant="outline"
            className="w-full cursor-pointer justify-between border-transparent bg-input/50 hover:bg-input/50 aria-expanded:bg-input/50 dark:bg-input/30 dark:hover:bg-input/40 dark:aria-expanded:bg-input/40"
          />
        }
      >
        <span className="truncate">{selectedParent?.name ?? "Top Level"}</span>
        <ChevronsUpDownIcon />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 gap-2 p-2">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search parents"
            className="pl-9"
          />
        </div>
        <div className="max-h-64 overflow-y-auto">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => {
              onChange("")
              setOpen(false)
              setQuery("")
            }}
          >
            <CheckIcon className={value ? "opacity-0" : undefined} />
            Top Level
          </Button>
          {filteredParents.map((row) => (
            <Button
              key={row.id}
              variant="ghost"
              className="w-full justify-start"
              style={{ paddingLeft: `${row.indent * 1.25 + 0.75}rem` }}
              onClick={() => {
                onChange(row.id)
                setOpen(false)
                setQuery("")
              }}
            >
              <CheckIcon
                className={value === row.id ? undefined : "opacity-0"}
              />
              {row.name}
            </Button>
          ))}
          {filteredParents.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No parents found.
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function TaskFields({
  form,
  onChange,
}: {
  form: Extract<ItemForm, { mode: "add-task" | "edit-task" }>
  onChange: (form: ItemForm) => void
}) {
  return (
    <FieldSet>
      <FieldLegend>Checklist Item</FieldLegend>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="task-label">Name</FieldLabel>
          <Input
            id="task-label"
            value={form.draft.label}
            onChange={(event) =>
              onChange({
                ...form,
                draft: { label: event.target.value },
              })
            }
            placeholder="Checklist item name"
          />
        </Field>
      </FieldGroup>
    </FieldSet>
  )
}

function LevelField({
  id,
  value,
  onChange,
}: {
  id: string
  value: TemplateModuleLevel
  onChange: (level: TemplateModuleLevel) => void
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>Level</FieldLabel>
      <Select
        value={value}
        onValueChange={(selectedValue) =>
          onChange(selectedValue as TemplateModuleLevel)
        }
      >
        <SelectTrigger id={id} className="w-full cursor-pointer">
          {formatModuleLevel(value)}
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="organizational">Organizational</SelectItem>
            <SelectItem value="personal">Personal</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}

function ModuleLevelBadge({ level }: { level: TemplateModuleLevel }) {
  return (
    <Badge variant={level === "organizational" ? "secondary" : "outline"}>
      {formatModuleLevel(level)}
    </Badge>
  )
}

function formatModuleLevel(level: TemplateModuleLevel) {
  return level === "organizational" ? "Organizational" : "Personal"
}

function formatCountryType(type: CountryDraft["type"]) {
  return type === "country" ? "Country" : "Group"
}

function getCombinedCountryIds(template: MonthEndTemplate, countryId: string) {
  const linkedIds = new Set<string>()
  const row = template.countries.find((country) => country.id === countryId)

  for (const linkedId of row?.combinedWithCountryIds ?? []) {
    linkedIds.add(linkedId)
  }

  for (const country of template.countries) {
    if (country.combinedWithCountryIds?.includes(countryId)) {
      linkedIds.add(country.id)
    }
  }

  linkedIds.delete(countryId)

  return Array.from(linkedIds)
}

function updateCombinedCountryLinks(
  countries: TemplateCountryRow[],
  countryId: string,
  combinedWithCountryIds: string[],
  updatedAt: string
) {
  const combinedIds = new Set(combinedWithCountryIds)

  return countries.map((country) => {
    const currentLinks = new Set(country.combinedWithCountryIds ?? [])

    if (country.id === countryId) {
      return {
        ...country,
        combinedWithCountryIds: Array.from(combinedIds),
        updatedAt,
      }
    }

    if (combinedIds.has(country.id)) {
      currentLinks.add(countryId)
    } else {
      currentLinks.delete(countryId)
    }

    return {
      ...country,
      combinedWithCountryIds: Array.from(currentLinks),
      updatedAt: currentLinks.has(countryId) ? updatedAt : country.updatedAt,
    }
  })
}

function CombinedCountryBadges({
  row,
  template,
}: {
  row: TemplateCountryRow
  template: MonthEndTemplate
}) {
  const combinedCountries = getCombinedCountryIds(template, row.id)
    .map((id) => template.countries.find((country) => country.id === id))
    .filter((country): country is TemplateCountryRow => Boolean(country))

  if (row.checkable === false) {
    return <span className="text-muted-foreground">-</span>
  }

  if (!combinedCountries.length) {
    return <span className="text-muted-foreground">None</span>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {combinedCountries.map((country) => (
        <Badge key={country.id} variant="outline">
          {country.name}
        </Badge>
      ))}
    </div>
  )
}

function findChildInsertIndex(template: MonthEndTemplate, parentIndex: number) {
  const parentIndent = template.countries[parentIndex]?.indent ?? 0
  let index = parentIndex + 1

  while (
    index < template.countries.length &&
    template.countries[index].indent > parentIndent
  ) {
    index += 1
  }

  return index
}

function findParentId(template: MonthEndTemplate, rowIndex: number) {
  const row = template.countries[rowIndex]

  if (!row || row.indent === 0) {
    return ""
  }

  for (let index = rowIndex - 1; index >= 0; index -= 1) {
    if (template.countries[index].indent < row.indent) {
      return template.countries[index].id
    }
  }

  return ""
}

function getDescendantIds(template: MonthEndTemplate, rowIndex: number) {
  const descendants = new Set<string>()
  const endIndex = findChildInsertIndex(template, rowIndex)

  for (let index = rowIndex + 1; index < endIndex; index += 1) {
    descendants.add(template.countries[index].id)
  }

  return descendants
}

function makeUniqueTemplateId(baseId: string, existingIds: string[]) {
  if (!baseId) {
    return ""
  }

  if (!existingIds.includes(baseId)) {
    return baseId
  }

  let index = 2
  let nextId = `${baseId}-${index}`

  while (existingIds.includes(nextId)) {
    index += 1
    nextId = `${baseId}-${index}`
  }

  return nextId
}

function formatModified(value?: string) {
  if (!value) {
    return "Not modified"
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "Not modified"
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}
