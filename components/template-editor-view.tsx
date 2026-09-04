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
  Loader2Icon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  SaveIcon,
  SearchIcon,
  SparklesIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import { HeaderActionMenuTrigger } from "@/components/header-action-menu-trigger"
import { PricingUploadContent } from "@/components/pricing-upload-view"
import { SiteHeader, SiteHeaderBackButton } from "@/components/site-header"
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
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from "@/components/ui/navigation-menu"
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
import { Skeleton } from "@/components/ui/skeleton"
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
  defaultCountryReportMapping,
  defaultMasterReportMapping,
  getMonthEndTemplate,
  loadMonthEndTemplate,
  makeTemplateId,
  saveMonthEndTemplate,
  type MonthEndTemplate,
  type ReportMappingAiTrainingExample,
  type ReportFieldMapping,
  type ReportMappingField,
  type TemplateCountryRow,
  type TemplateModuleLevel,
  type TemplateSimpleTask,
} from "@/lib/month-end-template"
import { cn } from "@/lib/utils"
import {
  extractPdfText,
  extractWorkbookRows,
  parseCountryReportText,
  parseCountryReportUploadFile,
  type ParsedCountryReportRecord,
} from "@/lib/country-report-import"
import { parseCsv } from "@/lib/csv"
import { fetchWithTimeout } from "@/lib/network"

const countriesModuleId = "countries"
const tasksModuleId = "tasks"
const netsuiteModuleId = "netsuite"
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

type ReportSamplePreview = {
  fileName: string
  fileType: string
  source: "upload" | "paste"
  message: string
  diagnostics: string[]
  rows: string[][]
  textLines: string[]
  imageDataUrl?: string
}

type ReportMappingSampleResult = {
  headerRowIndex: number
  headers: string[]
  fields: ReportSampleField[]
  preview: ReportSamplePreview
}

type ReportMappingAiTable = {
  columns?: string[]
  rows?: string[][]
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
    id: "status",
    label: "Country Report Status",
    description: "Status from the country report row.",
    aliases: ["status", "notes", "note"],
  },
  {
    id: "transactionDate",
    label: "Validation Date",
    description: "Validation date used for country report filtering.",
    aliases: ["validationdate", "validatedat", "date"],
  },
  {
    id: "sellingDate",
    label: "Selling Date",
    description: "Selling date used for Gabon current-month handling.",
    aliases: ["sellingdate", "solddate", "saledate"],
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
    countriesModuleId
  )
  const [activeTaskGroupId, setActiveTaskGroupId] = React.useState<
    string | null
  >(null)
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
  const [activeCountrySettingsSection, setActiveCountrySettingsSection] =
    React.useState<CountrySettingsSection>("country-information")
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
      {
        id: tasksModuleId,
        name: "Tasks",
        level: "organizational" as const,
        lastModified: template.taskGroups
          .map((group) => group.updatedAt)
          .filter(Boolean)
          .sort()
          .at(-1),
        count: template.taskGroups.reduce(
          (count, group) => count + group.tasks.length,
          0
        ),
      },
      {
        id: netsuiteModuleId,
        name: "NetSuite",
        level: "organizational" as const,
        lastModified: undefined,
        count: 1,
      },
    ],
    [template]
  )
  const activeTaskGroup =
    template.taskGroups.find((group) => group.id === activeTaskGroupId) ??
    template.taskGroups[0]
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

  React.useEffect(() => {
    setActiveCountrySettingsSection("country-information")
  }, [activeCountryId])

  React.useEffect(() => {
    if (
      activeCountrySettingsSection === "country-information" &&
      itemForm?.mode !== "edit-country"
    ) {
      setActiveCountrySettingsSection("report-mapping")
    }
  }, [activeCountrySettingsSection, itemForm])

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
      setActiveModuleId(countriesModuleId)
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
    setActiveModuleId(tasksModuleId)
    setActiveTaskGroupId(id)
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

  function selectActiveModule(moduleId: string) {
    setActiveModuleId(moduleId)
    setItemForm(null)
    setActiveCountryId(null)
    setEditingModuleId(null)
    setShowModuleForm(false)
  }

  function startAddTask(groupId: string) {
    setActiveTaskGroupId(groupId)
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

  function startEditTask(groupId: string, task: TemplateSimpleTask) {
    setActiveTaskGroupId(groupId)
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

  const activeCountryDetailsForm =
    itemForm?.mode === "edit-country" ? itemForm : null
  const activeCountrySettingsItems = getCountrySettingsItems(
    activeCountryDetailsForm
  )
  const settingsHeaderTitle = activeCountry?.name ?? "Settings"
  const settingsHeaderLeading = activeCountry ? (
    <Button
      variant="outline"
      aria-label="Back to countries"
      onClick={requestCloseActiveCountry}
    >
      <ArrowLeftIcon />
      Back
    </Button>
  ) : undefined
  const settingsHeaderActions = !activeCountry ? (
    activeModuleId === countriesModuleId ? (
      <div className="flex items-center gap-2">
        <Button onClick={startAddItem}>
          <PlusIcon />
          Add New
        </Button>
        {activeModule ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <HeaderActionMenuTrigger
                  label={`Actions for ${activeModule.name}`}
                />
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => startEditModule(activeModule.id)}
              >
                <PencilIcon />
                Edit Setting
              </DropdownMenuItem>
              {protectedModuleIds.has(activeModule.id) ? null : (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => deleteModule(activeModule.id)}
                >
                  <Trash2Icon />
                  Delete Setting
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    ) : activeModuleId === tasksModuleId ? (
      <Button onClick={() => setShowModuleForm(true)}>
        <PlusIcon />
        Add Task Group
      </Button>
    ) : undefined
  ) : undefined
  const settingsHeaderTabs =
    activeModuleId === countriesModuleId && activeCountry ? (
      <CountrySettingsNavigation
        items={activeCountrySettingsItems}
        activeSection={activeCountrySettingsSection}
        onActiveSectionChange={setActiveCountrySettingsSection}
      />
    ) : !activeCountry ? (
      <ModuleSettingsNavigation
        items={modules}
        activeModuleId={activeModuleId}
        onActiveModuleChange={selectActiveModule}
      />
    ) : undefined

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

  function updateCountryAiNotes(countryId: string, aiNotes: string) {
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
              aiNotes,
              updatedAt,
            }
          : country
      ),
    })
  }

  async function loadMappingSample(
    file: File,
    mappingKind: "countryReport" | "masterReport"
  ): Promise<ReportMappingSampleResult> {
    const upload = await readMappingUpload(file)
    const sampleText =
      upload.text ||
      [file.name, file.type, file.size ? `${file.size} bytes` : ""]
        .filter(Boolean)
        .join("\n")
    const sample = analyzeReportSample(sampleText)
    const mappedSample =
      mappingKind === "countryReport"
        ? mergeParsedCountryReportSampleFields(
            sample,
            await parseCountryReportSampleFile(file)
          )
        : sample
    const sampleResult = {
      ...mappedSample,
      preview: buildReportSamplePreview({
        fileName: file.name,
        fileType: file.type || "Unknown file type",
        source: "upload",
        text: sampleText,
        imageDataUrl: upload.imageDataUrl,
        diagnostics: upload.diagnostics,
      }),
    }

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

    return sampleResult
  }

  async function loadMappingSampleText(
    csvText: string,
    mappingKind: "countryReport" | "masterReport"
  ): Promise<ReportMappingSampleResult> {
    const sample = analyzeReportSample(csvText)
    const mappedSample =
      mappingKind === "countryReport"
        ? mergeParsedCountryReportSampleFields(
            sample,
            parseCountryReportSampleText(csvText)
          )
        : sample
    const sampleResult = {
      ...mappedSample,
      preview: buildReportSamplePreview({
        fileName: "Pasted report sample",
        fileType: "Pasted text",
        source: "paste",
        text: csvText,
        diagnostics: [],
      }),
    }

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

    return sampleResult
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

  function deleteTask(groupId: string, taskId: string) {
    const updatedAt = new Date().toISOString()

    persist({
      ...template,
      taskGroups: template.taskGroups.map((group) =>
        group.id === groupId
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
          <SiteHeader
            title={settingsHeaderTitle}
            leadingContent={settingsHeaderLeading}
            mobileLeadingContent={
              activeCountry ? (
                <SiteHeaderBackButton
                  label="Back to countries"
                  onClick={requestCloseActiveCountry}
                />
              ) : undefined
            }
            actions={settingsHeaderActions}
            bottomContent={settingsHeaderTabs}
          />
          <div className="grid gap-4 px-4 py-4 lg:px-6">
            {!activeModuleId ? (
              <section className="grid gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h1 className="text-lg font-semibold">Settings</h1>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => setShowModuleForm(true)}>
                      <PlusIcon />
                      Add New Setting
                    </Button>
                  </div>
                </div>
                <div className="grid gap-4">
                  {showModuleForm ? (
                    <Card role="dialog" className="rounded-lg shadow-none">
                      <CardHeader>
                        <CardTitle>Add New Setting</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <FieldSet>
                          <FieldLegend>Setting Details</FieldLegend>
                          <FieldGroup className="grid gap-4 md:grid-cols-2">
                            <Field>
                              <FieldLabel htmlFor="module-name">
                                Setting Name
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
                                placeholder="New setting name"
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
                        <TableHead>Setting Name</TableHead>
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
                            selectActiveModule(module.id)
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
                                  Edit Setting
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
                </div>
              </section>
            ) : (
              <section className="grid gap-4">
                <div className="grid gap-4">
                  {showModuleForm ? (
                    <Card role="dialog" className="rounded-lg shadow-none">
                      <CardHeader>
                        <CardTitle>Add New Setting</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <FieldSet>
                          <FieldLegend>Setting Details</FieldLegend>
                          <FieldGroup className="grid gap-4 md:grid-cols-2">
                            <Field>
                              <FieldLabel htmlFor="module-name-active">
                                Setting Name
                              </FieldLabel>
                              <Input
                                id="module-name-active"
                                value={moduleDraft.name}
                                onChange={(event) =>
                                  setModuleDraft((current) => ({
                                    ...current,
                                    name: event.target.value,
                                  }))
                                }
                                placeholder="New setting name"
                              />
                            </Field>
                            <LevelField
                              id="module-level-active"
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
                  {itemForm ? (
                    itemForm.mode === "add-country" ? (
                      <ItemFormPanel
                        form={itemForm}
                        parentRows={parentRows}
                        template={template}
                        onChange={setItemForm}
                        onCancel={() => setItemForm(null)}
                        onSave={saveItemForm}
                      />
                    ) : null
                  ) : null}

                  {activeModuleId === countriesModuleId && activeCountry ? (
                    <CountryMappingPanel
                      ref={countryMappingPanelRef}
                      country={activeCountry}
                      detailsForm={activeCountryDetailsForm}
                      parentRows={parentRows}
                      template={template}
                      mappingHeaders={activeCountryMappingHeaders}
                      showExitPrompt={showCountryExitPrompt}
                      activeSettingsSection={activeCountrySettingsSection}
                      onChangeDetailsForm={setItemForm}
                      onActiveSettingsSectionChange={
                        setActiveCountrySettingsSection
                      }
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
                      onSaveAiNotes={(aiNotes) =>
                        updateCountryAiNotes(activeCountry.id, aiNotes)
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
                  ) : activeModuleId === tasksModuleId ? (
                    <TaskGroupsPanel
                      groups={template.taskGroups}
                      protectedModuleIds={protectedModuleIds}
                      activeTaskGroupId={activeTaskGroup?.id ?? null}
                      itemForm={itemForm}
                      onChangeItemForm={setItemForm}
                      onCancelItemForm={() => setItemForm(null)}
                      onSaveItemForm={saveItemForm}
                      onAddTask={startAddTask}
                      onEditTask={startEditTask}
                      onDeleteTask={deleteTask}
                      onEditGroup={startEditModule}
                      onDeleteGroup={deleteModule}
                    />
                  ) : activeModuleId === netsuiteModuleId ? (
                    <PricingUploadContent />
                  ) : null}
                </div>
              </section>
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
        <CardTitle>Setting Details</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldSet>
          <FieldLegend>Setting Configuration</FieldLegend>
          <FieldGroup className="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="module-detail-tab">Setting Title</FieldLabel>
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
            Save Setting Details
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

type CountrySettingsSection =
  "country-information" | "report-mapping" | "ai-rules"

function getCountrySettingsItems(
  detailsForm: Extract<ItemForm, { mode: "edit-country" }> | null
) {
  return [
    ...(detailsForm
      ? [{ id: "country-information" as const, label: "Country Information" }]
      : []),
    { id: "report-mapping" as const, label: "Report Mapping" },
    { id: "ai-rules" as const, label: "AI Rules & Notes" },
  ] satisfies Array<{
    id: CountrySettingsSection
    label: string
  }>
}

function CountrySettingsNavigation({
  items,
  activeSection,
  onActiveSectionChange,
}: {
  items: Array<{
    id: CountrySettingsSection
    label: string
  }>
  activeSection: CountrySettingsSection
  onActiveSectionChange: (section: CountrySettingsSection) => void
}) {
  return (
    <NavigationMenu className="max-w-none justify-start">
      <NavigationMenuList className="min-w-0 flex-wrap justify-start gap-6">
        {items.map((item) => (
          <NavigationMenuItem key={item.id}>
            <button
              type="button"
              className={cn(
                "-mb-px inline-flex h-9 items-center border-b border-transparent bg-transparent px-0 py-1 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30",
                activeSection === item.id && "border-foreground text-foreground"
              )}
              onClick={() => onActiveSectionChange(item.id)}
            >
              {item.label}
            </button>
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  )
}

function ModuleSettingsNavigation({
  items,
  activeModuleId,
  onActiveModuleChange,
}: {
  items: Array<{
    id: string
    name: string
  }>
  activeModuleId: string | null
  onActiveModuleChange: (moduleId: string) => void
}) {
  return (
    <NavigationMenu className="max-w-none justify-start">
      <NavigationMenuList className="min-w-0 flex-wrap justify-start gap-6">
        {items.map((item) => (
          <NavigationMenuItem key={item.id}>
            <button
              type="button"
              className={cn(
                "-mb-px inline-flex h-9 items-center border-b border-transparent bg-transparent px-0 py-1 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30",
                activeModuleId === item.id &&
                  "border-foreground text-foreground"
              )}
              onClick={() => onActiveModuleChange(item.id)}
            >
              {item.name}
            </button>
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  )
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
    activeSettingsSection: CountrySettingsSection
    onChangeDetailsForm: (form: ItemForm) => void
    onActiveSettingsSectionChange: (section: CountrySettingsSection) => void
    onSaveDetailsForm: () => void
    onSaveAndExit: () => void
    onDiscardAndExit: () => void
    onKeepEditing: () => void
    onLoadSample: (
      file: File,
      mappingKind: "countryReport" | "masterReport"
    ) => Promise<ReportMappingSampleResult>
    onLoadSampleText: (
      csvText: string,
      mappingKind: "countryReport" | "masterReport"
    ) => Promise<ReportMappingSampleResult>
    onSaveMapping: (
      mappingType: "countryReportMapping" | "masterReportMapping",
      mapping?: ReportFieldMapping
    ) => void
    onSaveAiNotes: (aiNotes: string) => void
  }
>(function CountryMappingPanel(
  {
    country,
    detailsForm,
    parentRows,
    template,
    mappingHeaders,
    showExitPrompt,
    activeSettingsSection,
    onChangeDetailsForm,
    onActiveSettingsSectionChange,
    onSaveDetailsForm,
    onSaveAndExit,
    onDiscardAndExit,
    onKeepEditing,
    onLoadSample,
    onLoadSampleText,
    onSaveMapping,
    onSaveAiNotes,
  },
  ref
) {
  const [activeMappingTab, setActiveMappingTab] =
    React.useState("country-report")
  const [showResetConfirm, setShowResetConfirm] = React.useState(false)
  const [isEditingAiNotes, setIsEditingAiNotes] = React.useState(false)
  const [isSavingAiNotes, setIsSavingAiNotes] = React.useState(false)
  const [aiNotesDraft, setAiNotesDraft] = React.useState(country.aiNotes ?? "")
  const countryReportMappingRef = React.useRef<ReportMappingCardHandle>(null)
  const masterReportMappingRef = React.useRef<ReportMappingCardHandle>(null)
  const activeMappingRef =
    activeMappingTab === "master-report"
      ? masterReportMappingRef
      : countryReportMappingRef
  const activeSampleMode =
    activeMappingTab === "master-report" || !country.requiresPasteReport
      ? "upload"
      : "paste"
  const countryAiRuleGroups = getCountryAiRuleGroups(country)
  const countryAiRules = getCountryAiRules(country)
  const hasUnsavedAiNotes = aiNotesDraft !== (country.aiNotes ?? "")
  React.useEffect(() => {
    setAiNotesDraft(country.aiNotes ?? "")
    setIsEditingAiNotes(false)
    setIsSavingAiNotes(false)
  }, [country.id, country.aiNotes])

  React.useEffect(() => {
    if (!detailsForm && activeSettingsSection === "country-information") {
      onActiveSettingsSectionChange("report-mapping")
    }
  }, [activeSettingsSection, detailsForm, onActiveSettingsSectionChange])

  async function saveAiNotes() {
    const trimmedDraft = aiNotesDraft.trim()

    setIsSavingAiNotes(true)

    try {
      const response = await fetchWithTimeout(
        "/api/country-ai-notes/refine",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            countryId: country.id,
            countryName: country.name,
            rules: countryAiRules,
            currentNotes: country.aiNotes ?? "",
            editText: trimmedDraft,
          }),
        },
        45_000
      )
      const payload = (await response.json()) as {
        notes?: string
      }
      const nextNotes = (payload.notes ?? trimmedDraft).trim()

      setAiNotesDraft(nextNotes)
      onSaveAiNotes(nextNotes)
      setIsEditingAiNotes(false)
    } catch {
      onSaveAiNotes(trimmedDraft)
      setIsEditingAiNotes(false)
    } finally {
      setIsSavingAiNotes(false)
    }
  }

  React.useImperativeHandle(ref, () => ({
    hasUnsavedChanges() {
      return (
        countryReportMappingRef.current?.hasUnsavedChanges() === true ||
        masterReportMappingRef.current?.hasUnsavedChanges() === true ||
        hasUnsavedAiNotes
      )
    },
    saveMappings() {
      countryReportMappingRef.current?.saveMapping()
      masterReportMappingRef.current?.saveMapping()
      if (hasUnsavedAiNotes) {
        saveAiNotes()
      }
    },
    discardMappings() {
      countryReportMappingRef.current?.discardChanges()
      masterReportMappingRef.current?.discardChanges()
      setAiNotesDraft(country.aiNotes ?? "")
      setIsEditingAiNotes(false)
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
      {detailsForm && activeSettingsSection === "country-information" ? (
        <section className="grid max-w-[400px] gap-7">
          <CountryFields
            form={detailsForm}
            parentRows={parentRows}
            template={template}
            onChange={onChangeDetailsForm}
            showLegend={false}
            layout="settings"
          />
          <div>
            <Button onClick={onSaveDetailsForm}>
              <SaveIcon />
              Save
            </Button>
          </div>
        </section>
      ) : null}
      {activeSettingsSection === "report-mapping" ? (
        <Tabs
          value={activeMappingTab}
          onValueChange={setActiveMappingTab}
          className="min-h-0 flex-1 gap-4"
        >
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
                {activeSampleMode === "paste"
                  ? "Paste Report Sample"
                  : "Upload Report Sample"}
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
                        onClick={() =>
                          activeMappingRef.current?.addExtraField()
                        }
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
              onSave={(mapping) =>
                onSaveMapping("countryReportMapping", mapping)
              }
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
              onSave={(mapping) =>
                onSaveMapping("masterReportMapping", mapping)
              }
            />
          </TabsContent>
        </Tabs>
      ) : null}
      {activeSettingsSection === "ai-rules" ? (
        <section className="grid gap-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Rules printed from the current mapper and reconciliation logic.
              </p>
            </div>
            {!isEditingAiNotes ? (
              <Button
                variant="outline"
                className="shrink-0"
                onClick={() => setIsEditingAiNotes(true)}
              >
                <PencilIcon />
                Edit Notes
              </Button>
            ) : null}
          </div>
          <div className="grid gap-5 rounded-lg border bg-muted/20 p-4 text-sm">
            {countryAiRuleGroups.map((group) => (
              <section key={group.title} className="grid gap-2">
                <div>
                  <h3 className="font-medium">{group.title}</h3>
                  {group.description ? (
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {group.description}
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-1.5">
                  {group.rules.map((rule) => (
                    <div key={rule} className="leading-6">
                      {rule}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
          {isEditingAiNotes ? (
            <div className="grid gap-3">
              <Textarea
                value={aiNotesDraft}
                onChange={(event) => setAiNotesDraft(event.target.value)}
                placeholder="Add country-specific AI notes here."
                className="min-h-36"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setAiNotesDraft(country.aiNotes ?? "")
                    setIsEditingAiNotes(false)
                  }}
                  disabled={isSavingAiNotes}
                >
                  Cancel
                </Button>
                <Button onClick={saveAiNotes} disabled={isSavingAiNotes}>
                  {isSavingAiNotes ? (
                    <Loader2Icon className="animate-spin" />
                  ) : (
                    <SaveIcon />
                  )}
                  Save Notes
                </Button>
              </div>
            </div>
          ) : country.aiNotes?.trim() ? (
            <div className="text-sm leading-6 whitespace-pre-wrap">
              {country.aiNotes}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
})

type CountryAiRuleGroup = {
  title: string
  description?: string
  rules: string[]
}

function getCountryAiRuleGroups(country: TemplateCountryRow) {
  const groups: CountryAiRuleGroup[] = [
    {
      title: "Upload Reading",
      description:
        "How files, screenshots, PDFs, and pasted report text are interpreted.",
      rules: [
        "AI upload reading is the default mapper for new or edited report mappings.",
        "AI must normalize PDFs, Excel files, CSV files, screenshots, and pasted text into a clean table before assigning fields.",
        "AI must treat every visible uploaded or pasted row as report data unless the row is clearly a visual spacer or extraction artifact.",
        "AI must not invent a header row when the source report does not clearly have one.",
      ],
    },
    {
      title: "Saved Mapping Behavior",
      description: "How country-specific corrections influence future uploads.",
      rules: [
        "Saved column assignments and prior corrected examples for this country take priority over generic assumptions.",
        "When a user changes a column assignment and saves the mapping, that corrected layout is saved as training for future uploads.",
      ],
    },
    {
      title: "Reconciliation Actions",
      description:
        "How matches and manual decisions affect unresolved records.",
      rules: [
        "Normal reconciliation can match by Bill of Lading, CTN / ECTN, or Invoice / Sales Order number.",
        "Manual country reconciliation requires a reason and note, then removes those country rows from the unresolved report.",
        "Manual Roll Invoice saves selected NetSuite rows by Internal ID and removes them from the unresolved NetSuite report.",
        "Manual Leave Invoice saves selected NetSuite rows as left in the current month and removes them from the unresolved NetSuite report.",
        "If every remaining NetSuite row is selected for Roll Invoice or Leave Invoice and there are no unresolved country rows, the workflow proceeds to the next step.",
      ],
    },
  ]

  if (country.id === "frabemar-gabon") {
    return [
      ...groups,
      {
        title: "Gabon Rules",
        description:
          "Country-specific matching, Form/Tariff handling, and import cleanup.",
        rules: [
          "Gabon matching uses Bill of Lading number or Invoice number only; CTN number must not be used for matching.",
          "Gabon rows with a Validation Date auto reconcile when their Bill of Lading or Invoice number matches NetSuite.",
          "If a Gabon row has a Validation Date and matches two NetSuite rows, both NetSuite rows auto reconcile.",
          "If a Gabon row has no Validation Date, has a Selling Date in the current month, and matches exactly two NetSuite rows, the Gabon Form record stays in the current month and the Gabon Tariff record rolls.",
          "Those Gabon no-validation/current-selling-date pairs are removed from the main reconciliation report after the automatic Form/Tariff decision.",
          "Gabon NetSuite records that are not Gabon Out of Territory must have exactly two records grouped by Created From and Bill of Lading Number.",
          "Non-Out-of-Territory Gabon records without exactly two grouped records are flagged red at the top of the NetSuite table.",
          "Gabon country report import omits rows where the cargo/unit columns are empty and the FORM BIETC, FEES, and TOTAL COLLECTED money columns are zero or blank.",
        ],
      },
    ]
  }

  return groups
}

function getCountryAiRules(country: TemplateCountryRow) {
  return getCountryAiRuleGroups(country).flatMap((group) => group.rules)
}

function normalizeMappingHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "")
}

function normalizePastedReportText(value: string) {
  return value
    .split(/\r?\n/)
    .map((row) => (row.includes("\t") ? row.split("\t").join(",") : row))
    .join("\n")
}

function splitPaymentDescription(value: string) {
  const parts = value.split(/\s+-\s+/).map((part) => part.trim())

  if (parts.length >= 3) {
    return {
      description: parts[0],
      invoiceNumber: parts[1],
      reference: parts.slice(2).join(" - "),
    }
  }

  return {
    description: value.trim(),
    invoiceNumber: "",
    reference: "",
  }
}

function inferRepeatingPaymentRows(lines: string[]) {
  const rows: string[][] = []

  for (let index = 0; index < lines.length - 2; index += 3) {
    const descriptionLine = lines[index]?.trim() ?? ""
    const dateLine = lines[index + 1]?.trim() ?? ""
    const amountLine = lines[index + 2]?.trim() ?? ""

    if (
      !descriptionLine ||
      !/^\d{1,2}\/\d{1,2}\/\d{4}(?:\s+\d{1,2}:\d{2}:\d{2})?$/.test(dateLine) ||
      !/^\d[\d\s.,]*$/.test(amountLine)
    ) {
      return undefined
    }

    const parsedDescription = splitPaymentDescription(descriptionLine)

    rows.push([
      parsedDescription.description,
      parsedDescription.invoiceNumber,
      parsedDescription.reference,
      dateLine,
      amountLine,
    ])
  }

  if (!rows.length || rows.length * 3 !== lines.length) {
    return undefined
  }

  return {
    columns: [
      "Description",
      "Invoice Number",
      "Bill of Lading Number",
      "Date",
      "Amount",
    ],
    rows,
  }
}

function isImageUpload(file: File) {
  return file.type.startsWith("image/")
}

async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () =>
      reject(reader.error ?? new Error("Could not preview the image."))
    reader.readAsDataURL(file)
  })
}

async function readMappingUpload(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase()
  const diagnostics: string[] = []
  let imageDataUrl: string | undefined

  if (isImageUpload(file)) {
    try {
      imageDataUrl = await readFileAsDataUrl(file)
    } catch (error) {
      diagnostics.push(
        error instanceof Error ? error.message : "Could not preview the image."
      )
    }

    return {
      text: "",
      imageDataUrl,
      diagnostics: [
        ...diagnostics,
        "This is an image upload. Use AI Suggest once your OpenAI API key is configured, or map manually from another text sample.",
      ],
    }
  }

  try {
    if (extension === "pdf" || file.type === "application/pdf") {
      return { text: await extractPdfText(file), imageDataUrl, diagnostics }
    }

    if (extension === "xlsx" || extension === "xls") {
      return {
        text: await extractWorkbookRows(file),
        imageDataUrl,
        diagnostics,
      }
    }

    return { text: await file.text(), imageDataUrl, diagnostics }
  } catch (error) {
    diagnostics.push(
      error instanceof Error
        ? `Primary import failed: ${error.message}`
        : "Primary import failed."
    )
  }

  try {
    const fallbackText = await file.text()

    diagnostics.push("Loaded the file as plain text fallback.")

    return { text: fallbackText, imageDataUrl, diagnostics }
  } catch (error) {
    diagnostics.push(
      error instanceof Error
        ? `Plain text fallback failed: ${error.message}`
        : "Plain text fallback failed."
    )
  }

  return {
    text: "",
    imageDataUrl,
    diagnostics: [
      ...diagnostics,
      "No readable text was found. The upload is still kept so you can preview it and try AI extraction.",
    ],
  }
}

function buildReportSamplePreview({
  fileName,
  fileType,
  source,
  text,
  imageDataUrl,
  diagnostics,
}: {
  fileName: string
  fileType: string
  source: "upload" | "paste"
  text: string
  imageDataUrl?: string
  diagnostics: string[]
}): ReportSamplePreview {
  const normalizedText = normalizePastedReportText(text)
  const allTextLines = normalizedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const inferredTable = inferRepeatingPaymentRows(allTextLines)
  const parsedRows = parseCsv(normalizedText).filter((row) =>
    row.some((cell) => cell.trim())
  )
  const rows = inferredTable
    ? inferredTable.rows.slice(0, 8)
    : parsedRows.slice(0, 8)
  const textLines = allTextLines.slice(0, 12)
  const message = rows.length
    ? `Previewing ${rows.length} row${rows.length === 1 ? "" : "s"} from the upload.`
    : imageDataUrl
      ? "Previewing the uploaded image."
      : "No structured rows were found, but the upload is still available for mapping."

  return {
    fileName,
    fileType,
    source,
    message,
    diagnostics,
    rows,
    textLines,
    imageDataUrl,
  }
}

function sampleFieldsFromTable(
  columns: string[],
  rows: string[][]
): ReportSampleField[] {
  const columnCount = Math.max(
    columns.length,
    ...rows.map((row) => row.length),
    0
  )
  const normalizedColumns = Array.from(
    { length: columnCount },
    (_, columnIndex) =>
      columns[columnIndex]?.trim() || `Column ${columnIndex + 1}`
  )

  return normalizedColumns
    .map((column, columnIndex) => {
      const label = column.trim() || `Column ${columnIndex + 1}`

      return {
        sourceColumn: label,
        label,
        previewValues: rows
          .map((row) => row[columnIndex]?.trim() ?? "")
          .filter(Boolean)
          .slice(0, 3),
      }
    })
    .filter((field) => field.label)
}

function MappingTableSkeleton({ progress }: { progress: number }) {
  return (
    <div className="grid gap-3 rounded-lg border bg-background p-3">
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary/70 transition-[width] duration-500 ease-out"
          style={{ width: `${Math.max(4, Math.min(progress, 100))}%` }}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((column) => (
          <div key={column} className="grid gap-2">
            <Skeleton className="h-8 rounded-md" />
            <Skeleton className="h-3 w-3/4 rounded-md" />
          </div>
        ))}
      </div>
      <div className="grid gap-2">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="grid grid-cols-3 gap-3">
            <Skeleton className="h-5 rounded-md" />
            <Skeleton className="h-5 rounded-md" />
            <Skeleton className="h-5 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}

function analyzeReportSample(value: string): {
  headerRowIndex: number
  headers: string[]
  fields: ReportSampleField[]
} {
  const normalizedText = normalizePastedReportText(value)
  const textLines = normalizedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const inferredTable = inferRepeatingPaymentRows(textLines)

  if (inferredTable) {
    return {
      headerRowIndex: 0,
      headers: inferredTable.columns,
      fields: sampleFieldsFromTable(inferredTable.columns, inferredTable.rows),
    }
  }

  const rows = parseCsv(normalizedText)
  const firstStructuredRowIndex = rows.findIndex(
    (row) => row.filter((cell) => cell.trim()).length >= 2
  )
  const firstStructuredRow =
    firstStructuredRowIndex >= 0 ? rows[firstStructuredRowIndex] : []
  const headers = firstStructuredRow.map(
    (_, columnIndex) => `Column ${columnIndex + 1}`
  )
  const dataRows =
    firstStructuredRowIndex >= 0 ? rows.slice(firstStructuredRowIndex) : []
  const hasStructuredColumns =
    firstStructuredRowIndex >= 0 &&
    headers.length > 1 &&
    headers.some((header) => header.trim()) &&
    dataRows.some((row) => row.filter((cell) => cell.trim()).length > 1)

  if (hasStructuredColumns) {
    return {
      headerRowIndex:
        firstStructuredRowIndex >= 0 ? firstStructuredRowIndex : 0,
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

function isGenericMappingColumn(value: string) {
  return /^Column\s+\d+$/i.test(value.trim())
}

function cloneFieldMapping(mapping: ReportFieldMapping): ReportFieldMapping {
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

function emptyReportMapping(): ReportFieldMapping {
  return {
    headerRowIndex: 0,
    fields: {},
    extraFields: [],
    aiTrainingExamples: [],
  }
}

function makeAiTrainingExample(
  mapping: ReportFieldMapping,
  columns: ReportSampleField[],
  rows: string[][]
): ReportMappingAiTrainingExample | undefined {
  if (!columns.length || !rows.length) {
    return undefined
  }

  const assignments = Object.fromEntries(
    Object.entries(mapping.fields).filter(([, sourceColumn]) =>
      Boolean(sourceColumn)
    )
  ) as Partial<Record<ReportMappingField, string>>

  if (!Object.keys(assignments).length) {
    return undefined
  }

  return {
    id: `ai-example-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    columns: columns.map((column) => column.sourceColumn).slice(0, 20),
    rows: rows.slice(0, 8).map((row) => row.slice(0, 20)),
    assignments,
  }
}

function mergeAiTrainingExamples(
  current: ReportMappingAiTrainingExample[] | undefined,
  next: ReportMappingAiTrainingExample | undefined
) {
  const examples = current ?? []

  if (!next) {
    return examples
  }

  const nextSignature = JSON.stringify({
    columns: next.columns,
    assignments: next.assignments,
  })
  const withoutDuplicate = examples.filter(
    (example) =>
      JSON.stringify({
        columns: example.columns,
        assignments: example.assignments,
      }) !== nextSignature
  )

  return [...withoutDuplicate, next].slice(-12)
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
    ) => Promise<ReportMappingSampleResult>
    onLoadSampleText: (
      csvText: string,
      mappingKind: "countryReport" | "masterReport"
    ) => Promise<ReportMappingSampleResult>
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
  const aiAbortControllerRef = React.useRef<AbortController | null>(null)
  const aiProgressTimerRef = React.useRef<number | null>(null)
  const [showPasteSample, setShowPasteSample] = React.useState(false)
  const [pasteSample, setPasteSample] = React.useState("")
  const [hasPendingSample, setHasPendingSample] = React.useState(false)
  const [samplePreview, setSamplePreview] =
    React.useState<ReportSamplePreview | null>(null)
  const [aiSampleFields, setAiSampleFields] = React.useState<
    ReportSampleField[]
  >([])
  const [, setAiMessage] = React.useState("")
  const [isAiSuggesting, setIsAiSuggesting] = React.useState(false)
  const [aiProgress, setAiProgress] = React.useState(0)
  const [draft, setDraft] = React.useState<ReportFieldMapping>(
    mapping ?? {
      headerRowIndex: 0,
      fields: {},
      extraFields: [],
    }
  )
  const sampleFields = aiSampleFields.length
    ? aiSampleFields
    : sampleHeaders.length
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
  React.useEffect(() => {
    setDraft(
      mapping ?? {
        headerRowIndex: 0,
        fields: {},
        extraFields: [],
      }
    )
  }, [mapping])

  React.useEffect(() => {
    return () => {
      aiAbortControllerRef.current?.abort()
      if (aiProgressTimerRef.current !== null) {
        window.clearInterval(aiProgressTimerRef.current)
      }
    }
  }, [])

  async function handleSampleFile(file: File) {
    try {
      const sample = await onLoadSample(file, mappingKind)

      setSamplePreview(sample.preview)
      setAiSampleFields([])
      applySampleHeaders(sample)
      setHasPendingSample(true)
      await requestAiMappingSuggestions(sample.preview, sample.fields)
    } catch (error) {
      setSamplePreview({
        fileName: file.name,
        fileType: file.type || "Unknown file type",
        source: "upload",
        message: "The file could not be loaded into the mapper.",
        diagnostics: [
          error instanceof Error ? error.message : "Unknown upload error.",
        ],
        rows: [],
        textLines: [],
      })
      setAiMessage("Upload failed before a preview could be created.")
    }
  }

  async function handleSamplePaste() {
    const sample = await onLoadSampleText(pasteSample, mappingKind)

    setSamplePreview(sample.preview)
    setAiSampleFields([])
    applySampleHeaders(sample)
    setHasPendingSample(true)
    setShowPasteSample(false)
    await requestAiMappingSuggestions(sample.preview, sample.fields)
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
      aiTrainingExamples: current.aiTrainingExamples ?? [],
    }))
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

  function formatColumnAssignment(sourceColumn: string) {
    const value = getAssignedTargetValue(sourceColumn)

    if (value === reportMappingNoneValue) {
      return "Unassigned"
    }

    if (value.startsWith("core:")) {
      const fieldId = value.replace("core:", "")

      return fields.find((field) => field.id === fieldId)?.label ?? "Unassigned"
    }

    if (value.startsWith("extra:")) {
      const fieldId = value.replace("extra:", "")

      return (
        draft.extraFields?.find((field) => field.id === fieldId)?.label ??
        "Extra Field"
      )
    }

    return "Unassigned"
  }

  function assignSourceColumn(
    sourceColumn: string,
    targetValue: string | null
  ) {
    setHasPendingSample(true)
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

  const rawPreviewRows = samplePreview?.rows ?? []
  const previewColumnCount = Math.max(
    sampleFields.length,
    ...rawPreviewRows.map((row) => row.length),
    0
  )
  const previewColumns = Array.from(
    { length: previewColumnCount },
    (_, columnIndex) =>
      sampleFields[columnIndex] ?? {
        sourceColumn: `Column ${columnIndex + 1}`,
        label: `Column ${columnIndex + 1}`,
        previewValues: rawPreviewRows
          .map((row) => row[columnIndex]?.trim() ?? "")
          .filter(Boolean)
          .slice(0, 3),
      }
  )
  const previewDataRows =
    rawPreviewRows.length && previewColumns.length
      ? rawPreviewRows.slice(0, 12)
      : []
  const shouldShowMappingTable =
    samplePreview !== null || previewColumns.length > 0
  const hasUnsavedMappingChanges =
    hasPendingSample ||
    serializeReportMapping(draft) !== serializeReportMapping(mapping)

  function addExtraField() {
    setDraft((current) => ({
      ...current,
      extraFields: [
        ...(current.extraFields ?? []),
        { id: makeExtraMappingId(), label: "New Field", sourceColumn: "" },
      ],
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
    const trainingExample = makeAiTrainingExample(
      draft,
      previewColumns,
      previewDataRows
    )
    const nextDraft = {
      ...draft,
      aiTrainingExamples: mergeAiTrainingExamples(
        draft.aiTrainingExamples,
        trainingExample
      ),
    }

    setDraft(nextDraft)
    onSave(nextDraft)
    setHasPendingSample(false)
  }

  function discardChanges() {
    setDraft(mapping ?? emptyReportMapping())
    setHasPendingSample(false)
    setShowPasteSample(false)
    setSamplePreview(null)
    setAiSampleFields([])
    setAiMessage("")
    aiAbortControllerRef.current?.abort()
    aiAbortControllerRef.current = null
    stopAiProgress()
    setIsAiSuggesting(false)
    setAiProgress(0)
  }

  function cancelAiMapping() {
    aiAbortControllerRef.current?.abort()
    aiAbortControllerRef.current = null
    stopAiProgress()
    setIsAiSuggesting(false)
    setAiProgress(0)
  }

  function stopAiProgress() {
    if (aiProgressTimerRef.current !== null) {
      window.clearInterval(aiProgressTimerRef.current)
      aiProgressTimerRef.current = null
    }
  }

  function startAiProgress() {
    stopAiProgress()
    const startedAt = Date.now()

    setAiProgress(12)
    aiProgressTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startedAt
      const fastProgress = Math.min(elapsed / 1100, 1)
      const slowProgress = Math.min(Math.max(elapsed - 1100, 0) / 14000, 1)
      const easedFast = 1 - Math.pow(1 - fastProgress, 3)
      const easedSlow = 1 - Math.pow(1 - slowProgress, 2)
      const targetProgress = 12 + easedFast * 72 + easedSlow * 10

      setAiProgress((current) => Math.max(current, targetProgress))
    }, 120)
  }

  async function requestAiMappingSuggestions(
    previewOverride?: ReportSamplePreview,
    sampleFieldsOverride?: ReportSampleField[]
  ) {
    const activePreview = previewOverride ?? samplePreview
    const activeSampleFields = sampleFieldsOverride ?? sampleFields

    if (!activePreview) {
      setAiMessage("Upload or paste a sample before asking AI to suggest.")
      return
    }

    setIsAiSuggesting(true)
    setAiMessage("")
    aiAbortControllerRef.current?.abort()
    const abortController = new AbortController()
    aiAbortControllerRef.current = abortController
    startAiProgress()

    try {
      const response = await fetchWithTimeout(
        "/api/report-mapping/ai-suggest",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abortController.signal,
          body: JSON.stringify({
            mappingKind,
            fields: fields.map((field) => ({
              id: field.id,
              label: field.label,
              aliases: field.aliases,
            })),
            sampleFields: activeSampleFields,
            savedAssignments: draft.fields,
            trainingExamples: draft.aiTrainingExamples ?? [],
            preview: activePreview,
          }),
        },
        45_000
      )
      setAiProgress((current) => Math.max(current, 94))
      const payload = (await response.json()) as {
        ok?: boolean
        message?: string
        suggestions?: Partial<Record<ReportMappingField, string>>
        table?: ReportMappingAiTable
      }
      setAiProgress((current) => Math.max(current, 97))
      const aiColumns = payload.table?.columns?.filter(Boolean) ?? []
      const aiRows = payload.table?.rows ?? []
      const nextSampleFields = aiColumns.length
        ? sampleFieldsFromTable(aiColumns, aiRows)
        : activeSampleFields

      if (nextSampleFields !== activeSampleFields && nextSampleFields.length) {
        setAiSampleFields(nextSampleFields)
      }

      if (aiColumns.length) {
        setSamplePreview((current) =>
          current
            ? {
                ...current,
                message: `AI laid out ${aiRows.length} row${aiRows.length === 1 ? "" : "s"} into ${aiColumns.length} column${aiColumns.length === 1 ? "" : "s"}.`,
                rows: aiRows.slice(0, 12),
              }
            : current
        )
      }

      if (payload.suggestions) {
        setDraft((current) => ({
          ...current,
          fields: fields.reduce<ReportFieldMapping["fields"]>(
            (nextFields, field) => ({
              ...nextFields,
              [field.id]:
                payload.suggestions?.[field.id] ?? current.fields[field.id],
            }),
            {}
          ),
        }))
        setHasPendingSample(true)
      }

      setAiMessage(
        payload.message ??
          (payload.ok
            ? "AI suggestions were applied."
            : "AI could not suggest a mapping.")
      )
      setAiProgress(100)
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return
      }

      setAiMessage(
        error instanceof Error
          ? `AI Suggest failed: ${error.message}`
          : "AI Suggest failed. You can still map manually."
      )
    } finally {
      if (aiAbortControllerRef.current === abortController) {
        aiAbortControllerRef.current = null
        stopAiProgress()
        setIsAiSuggesting(false)
      }
    }
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
      return hasUnsavedMappingChanges
    },
    saveMapping,
    discardChanges,
  }))

  return (
    <div className="grid gap-4">
      {sampleMode === "upload" ? (
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.pdf,.xls,.xlsx,image/*,text/csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
            placeholder="Paste the report rows here."
            className="min-h-36"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowPasteSample(false)}>
              Cancel
            </Button>
            <Button onClick={handleSamplePaste} disabled={!pasteSample.trim()}>
              Use Sample
            </Button>
          </div>
        </div>
      ) : null}
      {shouldShowMappingTable ? (
        <div className="grid gap-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <span className="block truncate text-sm font-medium">
                {samplePreview?.fileName ?? "Saved mapping"}
              </span>
            </div>
            {samplePreview ? (
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => requestAiMappingSuggestions()}
                  disabled={isAiSuggesting}
                >
                  {isAiSuggesting ? (
                    <Loader2Icon className="animate-spin" />
                  ) : (
                    <SparklesIcon />
                  )}
                  AI Suggest
                </Button>
              </div>
            ) : null}
          </div>
          {samplePreview?.imageDataUrl ? (
            <div className="max-h-72 overflow-auto rounded-md border bg-muted/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={samplePreview.imageDataUrl}
                alt={`Preview of ${samplePreview.fileName}`}
                className="h-auto max-w-full"
              />
            </div>
          ) : null}
          {isAiSuggesting ? (
            <MappingTableSkeleton progress={aiProgress} />
          ) : null}
          {!isAiSuggesting && previewColumns.length ? (
            <div className="overflow-auto rounded-lg border bg-background p-3">
              <div
                className="grid min-w-max"
                style={{
                  gridTemplateColumns: `repeat(${previewColumns.length}, minmax(14rem, 1fr))`,
                }}
              >
                {previewColumns.map((column, columnIndex) => (
                  <div
                    key={`${column.sourceColumn}-${columnIndex}`}
                    className="grid justify-items-center gap-1 border-b px-2 pb-3"
                  >
                    <Select
                      value={getAssignedTargetValue(column.sourceColumn)}
                      onValueChange={(value) =>
                        assignSourceColumn(column.sourceColumn, value)
                      }
                    >
                      <SelectTrigger className="h-8 w-max max-w-none min-w-56 justify-center bg-background px-3 text-center text-xs whitespace-nowrap">
                        {formatColumnAssignment(column.sourceColumn)}
                      </SelectTrigger>
                      <SelectContent
                        align="center"
                        alignItemWithTrigger={false}
                        className="w-max min-w-64"
                      >
                        <SelectGroup>
                          <SelectItem value={reportMappingNoneValue}>
                            Unassigned
                          </SelectItem>
                          {fields.map((field) => (
                            <SelectItem
                              key={field.id}
                              value={`core:${field.id}`}
                            >
                              {field.label}
                            </SelectItem>
                          ))}
                          {(draft.extraFields ?? []).map((field) => (
                            <SelectItem
                              key={field.id}
                              value={`extra:${field.id}`}
                            >
                              {field.label || "Extra Field"}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {!isGenericMappingColumn(column.label) ? (
                      <span className="max-w-60 truncate text-center text-[11px] font-normal text-muted-foreground">
                        {column.label}
                      </span>
                    ) : null}
                  </div>
                ))}
                {(previewDataRows.length ? previewDataRows : [[]]).map(
                  (row, rowIndex) => (
                    <React.Fragment
                      key={`${samplePreview?.fileName ?? "saved-mapping"}-${rowIndex}`}
                    >
                      {previewColumns.map((column, cellIndex) => (
                        <div
                          key={`${samplePreview?.fileName ?? "saved-mapping"}-${rowIndex}-${column.sourceColumn}`}
                          className="min-h-10 truncate border-b px-2 py-2 text-center text-xs"
                          title={
                            row[cellIndex] ||
                            (previewDataRows.length ? "-" : column.sourceColumn)
                          }
                        >
                          {row[cellIndex] ||
                            (previewDataRows.length
                              ? "-"
                              : column.sourceColumn)}
                        </div>
                      ))}
                    </React.Fragment>
                  )
                )}
              </div>
            </div>
          ) : !isAiSuggesting && samplePreview?.textLines.length ? (
            <div className="max-h-56 overflow-auto rounded-md border bg-muted/20 p-3 text-xs">
              {samplePreview.textLines.map((line, index) => (
                <div key={`${samplePreview.fileName}-line-${index}`}>
                  {line}
                </div>
              ))}
            </div>
          ) : null}
          {[...(samplePreview?.diagnostics ?? [])].filter(Boolean).length ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950">
              {[...(samplePreview?.diagnostics ?? [])]
                .filter(Boolean)
                .map((message, index) => (
                  <div key={`${message}-${index}`}>{message}</div>
                ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {hasUnsavedMappingChanges ? (
        <div className="flex justify-end gap-2">
          {shouldShowMappingTable ? (
            <Button
              variant="outline"
              onClick={isAiSuggesting ? cancelAiMapping : discardChanges}
            >
              <XIcon />
              Cancel
            </Button>
          ) : null}
          <Button onClick={saveMapping}>
            <SaveIcon />
            Save Mapping
          </Button>
        </div>
      ) : null}
    </div>
  )
})

function TasksTable({
  group,
  taskForm,
  onChangeTaskForm,
  onCancelTaskForm,
  onSaveTaskForm,
  onEditTask,
  onDeleteTask,
}: {
  group: MonthEndTemplate["taskGroups"][number]
  taskForm: Extract<ItemForm, { mode: "add-task" | "edit-task" }> | null
  onChangeTaskForm: (form: ItemForm) => void
  onCancelTaskForm: () => void
  onSaveTaskForm: () => void
  onEditTask: (task: TemplateSimpleTask) => void
  onDeleteTask: (taskId: string) => void
}) {
  return (
    <Table containerClassName="rounded-lg border bg-background">
      <TableHeader className="bg-muted/50">
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Level</TableHead>
          <TableHead>Required Field</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {group.tasks.map((task) =>
          taskForm?.mode === "edit-task" && taskForm.taskId === task.id ? (
            <TaskFormTableRow
              key={task.id}
              form={taskForm}
              onChange={onChangeTaskForm}
              onCancel={onCancelTaskForm}
              onSave={onSaveTaskForm}
            />
          ) : (
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
          )
        )}
        {taskForm?.mode === "add-task" ? (
          <TaskFormTableRow
            form={taskForm}
            onChange={onChangeTaskForm}
            onCancel={onCancelTaskForm}
            onSave={onSaveTaskForm}
          />
        ) : null}
      </TableBody>
    </Table>
  )
}

function TaskFormTableRow({
  form,
  onChange,
  onCancel,
  onSave,
}: {
  form: Extract<ItemForm, { mode: "add-task" | "edit-task" }>
  onChange: (form: ItemForm) => void
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <TableRow className="bg-muted/20 hover:bg-muted/20">
      <TableCell colSpan={4}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            autoFocus
            value={form.draft.label}
            aria-label={
              form.mode === "add-task" ? "New task name" : "Task name"
            }
            placeholder="Task name"
            onChange={(event) =>
              onChange({
                ...form,
                draft: { label: event.target.value },
              })
            }
            onKeyDown={(event) => {
              if (event.key === "Enter" && form.draft.label.trim()) {
                event.preventDefault()
                onSave()
              }
              if (event.key === "Escape") {
                onCancel()
              }
            }}
          />
          <div className="flex shrink-0 justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onCancel}>
              <XIcon />
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!form.draft.label.trim()}
              onClick={onSave}
            >
              <SaveIcon />
              Save
            </Button>
          </div>
        </div>
      </TableCell>
    </TableRow>
  )
}

function TaskGroupsPanel({
  groups,
  protectedModuleIds,
  activeTaskGroupId,
  itemForm,
  onChangeItemForm,
  onCancelItemForm,
  onSaveItemForm,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onEditGroup,
  onDeleteGroup,
}: {
  groups: MonthEndTemplate["taskGroups"]
  protectedModuleIds: Set<string>
  activeTaskGroupId: string | null
  itemForm: ItemForm
  onChangeItemForm: (form: ItemForm) => void
  onCancelItemForm: () => void
  onSaveItemForm: () => void
  onAddTask: (groupId: string) => void
  onEditTask: (groupId: string, task: TemplateSimpleTask) => void
  onDeleteTask: (groupId: string, taskId: string) => void
  onEditGroup: (groupId: string) => void
  onDeleteGroup: (groupId: string) => void
}) {
  return (
    <div className="grid gap-4">
      {groups.map((group) => (
        <section key={group.id} className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-base font-semibold">{group.tab}</h2>
              <Badge variant="secondary">{group.tasks.length}</Badge>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAddTask(group.id)}
              >
                <PlusIcon />
                Add Task
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <HeaderActionMenuTrigger
                      label={`Actions for ${group.tab}`}
                    />
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEditGroup(group.id)}>
                    <PencilIcon />
                    Edit Task Group
                  </DropdownMenuItem>
                  {protectedModuleIds.has(group.id) ? null : (
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => onDeleteGroup(group.id)}
                    >
                      <Trash2Icon />
                      Delete Task Group
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <TasksTable
            group={group}
            taskForm={
              activeTaskGroupId === group.id &&
              (itemForm?.mode === "add-task" || itemForm?.mode === "edit-task")
                ? itemForm
                : null
            }
            onChangeTaskForm={onChangeItemForm}
            onCancelTaskForm={onCancelItemForm}
            onSaveTaskForm={onSaveItemForm}
            onEditTask={(task) => onEditTask(group.id, task)}
            onDeleteTask={(taskId) => onDeleteTask(group.id, taskId)}
          />
        </section>
      ))}
      {!groups.length ? (
        <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          No task groups yet. Add a task group to get started.
        </div>
      ) : null}
    </div>
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
  layout = "grid",
}: {
  form: Extract<ItemForm, { mode: "add-country" | "edit-country" }>
  parentRows: TemplateCountryRow[]
  template: MonthEndTemplate
  onChange: (form: ItemForm) => void
  showLegend?: boolean
  layout?: "grid" | "settings"
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
      <FieldGroup
        className={cn(
          "grid gap-4",
          layout === "settings" ? "gap-7" : "md:grid-cols-2"
        )}
      >
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
            className="h-10 w-full cursor-pointer justify-between border-input bg-background hover:bg-muted md:h-8 dark:bg-input/30 dark:hover:bg-input/50"
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
            className="w-full cursor-pointer justify-between border-input bg-background hover:bg-muted dark:bg-input/30 dark:hover:bg-input/50"
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
