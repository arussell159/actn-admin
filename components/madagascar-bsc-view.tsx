"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { EditorContent, useEditor } from "@tiptap/react"
import { StarterKit } from "@tiptap/starter-kit"
import {
  ArrowLeftIcon,
  BookOpenTextIcon,
  CalendarIcon,
  CheckIcon,
  ClipboardIcon,
  DatabaseIcon,
  DownloadIcon,
  FileSearchIcon,
  FileTextIcon,
  MessageSquareTextIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SendIcon,
  SparklesIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react"

import { AppLink } from "@/components/app-link"
import { AppSidebar } from "@/components/app-sidebar"
import { CountryCell } from "@/components/country-cell"
import { CountryTableFilters } from "@/components/country-table-filters"
import { SiteHeader, SiteHeaderBackButton } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  SelectValue,
} from "@/components/ui/select"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import "@/components/tiptap-templates/simple/simple-editor.scss"
import {
  createMadagascarId,
  madagascarCargoTypeOptions,
  madagascarContainerSizeOptions,
  madagascarContainerTypeOptions,
  madagascarFieldGroups,
  madagascarIncotermOptions,
  madagascarShipmentMethodOptions,
  requestReference,
  type MadagascarAnalysis,
  type MadagascarExtractedField,
  type MadagascarInvoiceValue,
  type MadagascarRequest,
  type MadagascarRule,
} from "@/lib/madagascar-bsc"
import { bscCountryModules } from "@/lib/bsc-country-modules"
import { cn } from "@/lib/utils"
import {
  deleteMadagascarRequest,
  downloadMadagascarDocument,
  listMadagascarRequests,
  listMadagascarRules,
  loadCachedMadagascarRequests,
  loadCachedMadagascarRules,
  saveMadagascarRequest,
} from "@/lib/madagascar-bsc-db"
import {
  createSeedCtnKnowledgeRecords,
  ctnKnowledgeRecordToHtml,
  loadCtnKnowledgeRecords,
  saveCtnKnowledgeRecords,
} from "@/lib/ctn-knowledge-base"
import { Extension } from "@tiptap/core"
import { KnowledgeReviewCard } from "@/components/knowledge-review-card"
import {
  createKnowledgeReviewSession, knowledgeAnchor, knowledgeVersion,
  type KnowledgeAnalysis, type KnowledgePendingProposal, type KnowledgeNavigation,
} from "@/lib/ctn-knowledge-review"
import { readKnowledgeEvents } from "@/lib/ctn-knowledge-stream"

type Section = "new" | "requests" | "rules"
type DraftCertificateJob = {
  request: MadagascarRequest
  isAnalyzing: boolean
  error: string
  revealedFields: Set<string>
}
type FieldEditContextValue = {
  updateField: (fieldKey: string, label: string, value: string) => void
}
type KnowledgeChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  analysis?: KnowledgeAnalysis
  proposal?: KnowledgePendingProposal | null
  proposalStatus?: "pending" | "applied" | "cancelled" | "superseded"
  streaming?: boolean
}
type KnowledgeChatApiResponse = {
  ok: boolean
  analysis?: KnowledgeAnalysis
  message?: string
}

const knowledgeAnchors = Extension.create({
  name: "knowledgeAnchors",
  addGlobalAttributes() {
    return [{ types: ["heading", "paragraph", "listItem"], attributes: {
      "data-okf-anchor": { default: null, parseHTML: (element) => element.getAttribute("data-okf-anchor"),
        renderHTML: (attributes) => attributes["data-okf-anchor"] ? { "data-okf-anchor": attributes["data-okf-anchor"] } : {},
      },
    } }]
  },
})

const madagascarModule = bscCountryModules.find(
  (module) => module.id === "madagascar"
)
const moduleLabel = madagascarModule?.label ?? "Cargo Tracking Notes"
const requestLabel = madagascarModule?.requestSingularLabel ?? "Certificate"
const requestsLabel = madagascarModule?.requestPluralLabel ?? "Certificates"
const newRequestLabel = madagascarModule?.newRequestLabel ?? "New Certificate"
const rulesLabel = madagascarModule?.rulesLabel ?? "AI Rules"
const moduleBasePath =
  madagascarModule?.basePath ?? "/cargo-tracking-notes"
const moduleApiBasePath =
  madagascarModule?.apiBasePath ?? "/api/cargo-tracking-notes"
const draftCertificateJobs = new Map<string, DraftCertificateJob>()
const draftCertificateSubscribers = new Set<() => void>()
const FieldEditContext = React.createContext<FieldEditContextValue | null>(null)
const progressiveFieldOrder = [
  "missingCorrectionsMessage",
  "exporterName",
  "importerName",
  "incoterm",
  "incotermPlace",
  "invoiceValue:0",
  "currency",
  "commercialInvoiceReference",
  "commercialInvoiceDate",
  "packingListReference",
  "packingListDate",
  "shipmentMethod",
  "cargoType",
  "grossWeight",
  "volume",
  "shippingLine",
  "voyage",
  "vessel",
  "containerNumber",
  "sealNumber",
  "containerType",
  "containerSize",
  "loadingCountry",
  "loadingDate",
  "loadingCity",
  "unloadingCountry",
  "unloadingDate",
  "unloadingCity",
  "exportDeclarationReference",
  "exportDeclarationDate",
  "billOfLadingReference",
  "billOfLadingDate",
  "invoiceItems",
  "exporterAddress",
  "exporterCountry",
  "importerAddress",
  "importerCountry",
  "documents",
]
const instantRevealFields = new Set(progressiveFieldOrder.slice(0, 15))
const dateFieldKeys = new Set([
  "commercialInvoiceDate",
  "packingListDate",
  "loadingDate",
  "unloadingDate",
  "exportDeclarationDate",
  "billOfLadingDate",
])

function getChooserOptions(fieldKey?: string) {
  if (fieldKey === "incoterm") {
    return [...madagascarIncotermOptions]
      .sort((left, right) => left.order - right.order)
      .map((incoterm) => incoterm.name)
  }
  if (fieldKey === "shipmentMethod") return [...madagascarShipmentMethodOptions]
  if (fieldKey === "cargoType") return [...madagascarCargoTypeOptions]
  if (fieldKey === "containerType") return [...madagascarContainerTypeOptions]
  if (fieldKey === "containerSize") return [...madagascarContainerSizeOptions]

  return []
}

function invoiceLabelsForIncoterm(value: string) {
  const incoterm = madagascarIncotermOptions.find(
    (option) => option.name === value
  )
  const labels = ["FOB Value"]

  if (!incoterm) {
    return labels
  }

  if (incoterm.haveFreight) labels.push("Freight Value")
  if (incoterm.haveInsurance) labels.push("Insurance Value")
  if (incoterm.haveOtherCharges) labels.push("Other Charges")
  if (
    incoterm.name !== "FOB" &&
    (incoterm.haveFreight ||
      incoterm.haveInsurance ||
      incoterm.haveOtherCharges)
  ) {
    labels.push(`${incoterm.name} Value`)
  }

  return labels
}

function alignInvoiceValuesWithIncoterm(
  invoiceValues: MadagascarInvoiceValue[],
  incotermValue: string
) {
  const valuesByLabel = new Map(
    invoiceValues.map((invoiceValue) => [invoiceValue.label, invoiceValue])
  )

  return invoiceLabelsForIncoterm(incotermValue).map((label) => {
    const existingValue = valuesByLabel.get(label)

    return (
      existingValue ?? {
        label,
        value: "",
        status: "missing" as const,
        source: "",
        note: "Required by selected Incoterm.",
      }
    )
  })
}

function formatDateValue(date?: Date) {
  if (!date) {
    return ""
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function parseDateValue(value: string) {
  if (!value.trim()) {
    return undefined
  }

  const date = new Date(`${value.trim()}T00:00:00`)

  return Number.isNaN(date.getTime()) ? undefined : date
}

function copyText(value: string) {
  return navigator.clipboard.writeText(value)
}

function notifyDraftCertificateSubscribers() {
  draftCertificateSubscribers.forEach((listener) => listener())
}

function getDraftCertificateJob(id: string) {
  return draftCertificateJobs.get(id)
}

function subscribeToDraftCertificateJobs(listener: () => void) {
  draftCertificateSubscribers.add(listener)
  return () => {
    draftCertificateSubscribers.delete(listener)
  }
}

function updateDraftCertificateJob(
  id: string,
  updater: (job: DraftCertificateJob) => DraftCertificateJob
) {
  const current = draftCertificateJobs.get(id)

  if (!current) {
    return
  }

  draftCertificateJobs.set(id, updater(current))
  notifyDraftCertificateSubscribers()
}

function emptyMadagascarAnalysis(fileNames: string[]): MadagascarAnalysis {
  return {
    consigneeCountry: "",
    documents: fileNames.map((fileName) => ({
      fileName,
      documentType: "Unknown",
      confidence: "",
      note: "",
    })),
    fields: madagascarFieldGroups.flatMap((group) =>
      group.fields.map(([key, label]) => ({
        key,
        label,
        value: "",
        status: "missing" as const,
        source: "",
        note: "",
      }))
    ),
    invoiceValues: [
      {
        label: "FOB Value",
        value: "",
        status: "missing",
        source: "",
        note: "",
      },
    ],
    invoiceItems: [],
    issues: [],
    missingCorrectionsMessage: "",
  }
}

function revealDraftCertificateFields(
  id: string,
  analysis: MadagascarAnalysis
) {
  const dynamicInvoiceFields = analysis.invoiceValues
    .slice(1)
    .map((_, index) => `invoiceValue:${index + 1}`)
  const fieldOrder = [
    ...progressiveFieldOrder.slice(0, 9),
    ...dynamicInvoiceFields,
    ...progressiveFieldOrder.slice(9),
  ]

  const delayedFields = fieldOrder.filter(
    (fieldKey) => !instantRevealFields.has(fieldKey)
  )

  delayedFields.forEach((fieldKey, index) => {
    window.setTimeout(() => {
      updateDraftCertificateJob(id, (job) => {
        const revealedFields = new Set(job.revealedFields)
        revealedFields.add(fieldKey)
        return { ...job, revealedFields }
      })
    }, index * 30)
  })
}

function analysisHasIssues(analysis: MadagascarAnalysis) {
  return (
    analysis.issues.length > 0 ||
    analysis.fields.some(
      (field) => field.status === "missing" || field.status === "conflict"
    ) ||
    (analysis.invoiceValues ?? []).some(
      (field) => field.status === "missing" || field.status === "conflict"
    ) ||
    analysis.invoiceItems.some((item) => item.issues.length > 0)
  )
}

function statusVariant(status: string) {
  return status === "extracted" || status === "Ready"
    ? "default"
    : status === "derived"
      ? "secondary"
      : "destructive"
}

function getBillOfLadingTitle(request: MadagascarRequest) {
  return (
    request.analysis.fields.find(
      (field) => field.key === "billOfLadingReference"
    )?.value || request.reference
  )
}

function formatDateTime(value?: string) {
  if (!value) {
    return "Not completed"
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "Not completed"
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function createKnowledgeChatId() {
  return `knowledge-chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function CertificateSection({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-lg border bg-background shadow-xs">
      <div className="flex min-h-10 items-center justify-between gap-4 border-b bg-muted/40 px-4 py-2.5">
        <h2 className="text-base leading-6 font-semibold text-foreground">
          {title}
        </h2>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="grid gap-6 p-4 sm:p-5">{children}</div>
    </section>
  )
}

function FieldGroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[15px] leading-5 font-semibold text-foreground">
      {children}
    </h3>
  )
}

function AiFieldShimmer() {
  return (
    <div className="relative h-9 overflow-hidden rounded-lg border bg-muted/40">
      <div className="absolute inset-0 -translate-x-full animate-[skeleton-shimmer_1.4s_infinite] bg-linear-to-r from-transparent via-background/80 to-transparent" />
      <div className="absolute top-1/2 left-3 h-3 w-2/3 -translate-y-1/2 rounded-full bg-muted-foreground/15" />
    </div>
  )
}

function AiTextShimmer() {
  return (
    <div className="grid max-w-4xl gap-2">
      <div className="relative h-4 overflow-hidden rounded-full bg-muted/60">
        <div className="absolute inset-0 -translate-x-full animate-[skeleton-shimmer_1.4s_infinite] bg-linear-to-r from-transparent via-background/80 to-transparent" />
      </div>
      <div className="relative h-4 w-5/6 overflow-hidden rounded-full bg-muted/60">
        <div className="absolute inset-0 -translate-x-full animate-[skeleton-shimmer_1.4s_infinite] bg-linear-to-r from-transparent via-background/80 to-transparent" />
      </div>
    </div>
  )
}

function CopyableField({
  fieldMap,
  fieldKey,
  label,
  value: suppliedValue,
  isLoading = false,
  onValueChange,
}: {
  fieldMap: Map<string, MadagascarExtractedField>
  fieldKey?: string
  label: string
  value?: string
  isLoading?: boolean
  onValueChange?: (value: string) => void
}) {
  const editContext = React.useContext(FieldEditContext)
  const value =
    suppliedValue !== undefined
      ? suppliedValue.trim()
      : fieldKey
        ? (fieldMap.get(fieldKey)?.value?.trim() ?? "")
        : ""
  const [draftValue, setDraftValue] = React.useState(value)
  const [isCtrlPressed, setIsCtrlPressed] = React.useState(false)
  const draftValueRef = React.useRef(value)
  const isDate = Boolean(fieldKey && dateFieldKeys.has(fieldKey))
  const chooserOptions = React.useMemo(() => getChooserOptions(fieldKey), [fieldKey])
  const isChooser = chooserOptions.length > 0

  React.useEffect(() => {
    setDraftValue(value)
    draftValueRef.current = value
  }, [value])

  React.useEffect(() => {
    function syncCtrlState(event: KeyboardEvent) {
      setIsCtrlPressed(event.ctrlKey)
    }
    function clearCtrlState() {
      setIsCtrlPressed(false)
    }

    window.addEventListener("keydown", syncCtrlState)
    window.addEventListener("keyup", syncCtrlState)
    window.addEventListener("blur", clearCtrlState)

    return () => {
      window.removeEventListener("keydown", syncCtrlState)
      window.removeEventListener("keyup", syncCtrlState)
      window.removeEventListener("blur", clearCtrlState)
    }
  }, [])

  function commitValue(nextValue = draftValue) {
    if (onValueChange) {
      onValueChange(nextValue)
      return
    }

    if (fieldKey) {
      editContext?.updateField(fieldKey, label, nextValue)
    }
  }
  function copyDraftValue() {
    if (draftValueRef.current.trim()) {
      void copyText(draftValueRef.current)
    }
  }
  function copyOnCtrlClick(event: React.MouseEvent<HTMLElement>) {
    if (!event.ctrlKey || !draftValueRef.current.trim()) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    copyDraftValue()
  }

  const isMissing = !draftValue.trim()
  const isCopyCursor = isCtrlPressed && !isMissing
  const editableFieldClassName = cn(
    "h-9 pr-9 text-[15px] font-medium",
    isCopyCursor && "cursor-pointer",
    isMissing &&
      "border-destructive/35 shadow-[0_0_0_1px_hsl(var(--destructive)/0.08),0_0_10px_hsl(var(--destructive)/0.10)] placeholder:text-destructive/60 focus-visible:border-destructive/50 focus-visible:ring-destructive/15"
  )
  const chooserFieldClassName = cn(
    "h-9 min-w-0 flex-1 cursor-pointer justify-start gap-2 px-3 text-left text-[15px] font-medium",
    isMissing
      ? "border-destructive/35 shadow-[0_0_0_1px_hsl(var(--destructive)/0.08),0_0_10px_hsl(var(--destructive)/0.10)] hover:bg-background focus-visible:border-destructive/50 focus-visible:ring-destructive/15"
      : "data-[empty=true]:text-muted-foreground"
  )
  const inlineCopyButton = draftValue.trim() ? (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={`Copy ${label}`}
      className="absolute top-1/2 right-1 size-7 -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-focus-within:opacity-100 group-hover:opacity-100"
      onClick={copyDraftValue}
    >
      <ClipboardIcon className="size-3.5" />
    </Button>
  ) : null
  const externalCopyButton = draftValue.trim() ? (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={`Copy ${label}`}
      className="size-9 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-focus-within:opacity-100 group-hover:opacity-100"
      onClick={copyDraftValue}
    >
      <ClipboardIcon className="size-3.5" />
    </Button>
  ) : null

  return (
    <div className="grid min-w-0 gap-1.5">
      <span className="text-[13px] font-semibold text-foreground">{label}</span>
      <div className="group relative w-full">
        {isLoading ? (
          <AiFieldShimmer />
        ) : isDate ? (
          <div className="flex min-w-0 items-center gap-1">
            <Popover
              onOpenChange={(open) => {
                if (!open) commitValue(draftValueRef.current)
              }}
            >
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    data-empty={!draftValue}
                    className={chooserFieldClassName}
                    onClick={copyOnCtrlClick}
                  />
                }
              >
                <CalendarIcon className="size-4 text-muted-foreground" />
                {draftValue || "Pick date"}
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={parseDateValue(draftValue)}
                  onSelect={(selectedDate) => {
                    const nextValue = formatDateValue(selectedDate)
                    setDraftValue(nextValue)
                    draftValueRef.current = nextValue
                  }}
                />
              </PopoverContent>
            </Popover>
            {externalCopyButton}
          </div>
        ) : isChooser ? (
          <div className="flex min-w-0 items-center gap-1">
            <Select
              value={draftValue || undefined}
              onValueChange={(nextValue) => {
                const selectedValue = nextValue ?? ""
                setDraftValue(selectedValue)
                draftValueRef.current = selectedValue
                commitValue(selectedValue)
              }}
            >
              <SelectTrigger
                className={chooserFieldClassName}
                onClick={copyOnCtrlClick}
                onBlur={() => commitValue(draftValueRef.current)}
              >
                <SelectValue placeholder="Choose value" />
              </SelectTrigger>
              <SelectContent align="start" className="min-w-48">
                <SelectGroup>
                  {chooserOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {externalCopyButton}
          </div>
        ) : (
          <>
            <Input
              value={draftValue}
              placeholder="Missing"
              aria-label={label}
              className={editableFieldClassName}
              onClick={copyOnCtrlClick}
              onChange={(event) => {
                setDraftValue(event.target.value)
                draftValueRef.current = event.target.value
              }}
              onBlur={() => commitValue(draftValueRef.current)}
            />
            {inlineCopyButton}
          </>
        )}
      </div>
    </div>
  )
}

function AnalysisView({
  request,
  isAnalyzing = false,
  revealedFields,
  analysisError = "",
}: {
  request: MadagascarRequest
  isAnalyzing?: boolean
  revealedFields?: Set<string>
  analysisError?: string
}) {
  const [downloadError, setDownloadError] = React.useState("")
  const [editableRequest, setEditableRequest] = React.useState(request)
  const analysis = editableRequest.analysis
  const fieldMap = new Map(analysis.fields.map((field) => [field.key, field]))
  const invoiceValues: MadagascarInvoiceValue[] = analysis.invoiceValues?.length
    ? analysis.invoiceValues
    : [
        {
          label: "FOB Value",
          value: fieldMap.get("fobValue")?.value ?? "",
          status: fieldMap.get("fobValue")?.status ?? "missing",
          source: fieldMap.get("fobValue")?.source ?? "",
          note: fieldMap.get("fobValue")?.note ?? "",
        },
      ]
  const fobValueIndex = invoiceValues.findIndex((field) =>
    field.label.toLowerCase().includes("fob")
  )
  const primaryInvoiceValue =
    invoiceValues[fobValueIndex >= 0 ? fobValueIndex : 0]
  const additionalInvoiceValues = invoiceValues
    .map((invoiceValue, index) => ({ invoiceValue, index }))
    .filter(({ index }) => index !== (fobValueIndex >= 0 ? fobValueIndex : 0))

  React.useEffect(() => {
    setEditableRequest(request)
  }, [request.id, request.updatedAt])

  function persistRequest(nextRequest: MadagascarRequest) {
    setEditableRequest(nextRequest)

    if (getDraftCertificateJob(nextRequest.id)) {
      updateDraftCertificateJob(nextRequest.id, (job) => ({
        ...job,
        request: nextRequest,
      }))
    }

    saveMadagascarRequest(nextRequest, []).catch(() => undefined)
  }

  function updateAnalysis(
    updater: (analysis: MadagascarAnalysis) => MadagascarAnalysis
  ) {
    const nextRequest = {
      ...editableRequest,
      analysis: updater(editableRequest.analysis),
      updatedAt: new Date().toISOString(),
    }

    persistRequest(nextRequest)
  }

  function updateExtractedField(fieldKey: string, label: string, value: string) {
    updateAnalysis((currentAnalysis) => {
      const nextFields = [...currentAnalysis.fields]
      const fieldIndex = nextFields.findIndex((field) => field.key === fieldKey)
      const existingField = nextFields[fieldIndex]
      const nextField: MadagascarExtractedField = {
        key: fieldKey,
        label,
        value,
        status: value.trim() ? "extracted" : "missing",
        source: existingField?.source || "Manual edit",
        note: existingField?.note || "",
      }

      if (fieldIndex >= 0) {
        nextFields[fieldIndex] = nextField
      } else {
        nextFields.push(nextField)
      }

      return {
        ...currentAnalysis,
        fields: nextFields,
        invoiceValues:
          fieldKey === "incoterm"
            ? alignInvoiceValuesWithIncoterm(currentAnalysis.invoiceValues, value)
            : currentAnalysis.invoiceValues,
      }
    })
  }

  function updateInvoiceValue(index: number, value: string) {
    updateAnalysis((currentAnalysis) => {
      const nextInvoiceValues = [...invoiceValues]
      const existingValue = nextInvoiceValues[index] ?? {
        label: "Invoice Value",
        value: "",
      }
      nextInvoiceValues[index] = {
        ...existingValue,
        value,
        status: value.trim() ? "extracted" : "missing",
        source: existingValue.source || "Manual edit",
        note: existingValue.note || "",
      } satisfies MadagascarInvoiceValue

      return { ...currentAnalysis, invoiceValues: nextInvoiceValues }
    })
  }

  async function downloadInvoiceItems() {
    setDownloadError("")
    try {
      const response = await fetch(`${moduleApiBasePath}/invoice-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: editableRequest.reference,
          items: analysis.invoiceItems,
        }),
      })
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string }
        throw new Error(payload.message || "Could not create the workbook.")
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `ECTN-Certificate-${editableRequest.reference}.xlsx`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      setDownloadError(
        error instanceof Error
          ? error.message
          : "Could not download the workbook."
      )
    }
  }

  const isFieldLoading = (fieldKey: string) =>
    Boolean(revealedFields && !analysisError && !revealedFields.has(fieldKey))
  const isProgressivelyLoading = isFieldLoading("documents")
  const fieldEditContextValue = {
    updateField: updateExtractedField,
  }

  return (
    <FieldEditContext.Provider value={fieldEditContextValue}>
    <div className="mx-auto grid w-full max-w-6xl gap-8">
      {isProgressivelyLoading ? (
        <p className="border-b pb-4 text-sm text-muted-foreground">
          AI is reading the uploaded documents.
        </p>
      ) : null}

      <CertificateSection
        title="Missing / Corrections Needed"
        action={
          <Button
            variant="outline"
            size="sm"
            disabled={isFieldLoading("missingCorrectionsMessage")}
            onClick={() => copyText(analysis.missingCorrectionsMessage)}
          >
            <ClipboardIcon />
            Copy
          </Button>
        }
      >
        {isFieldLoading("missingCorrectionsMessage") ? (
          <AiTextShimmer />
        ) : (
          <p className="max-w-4xl text-sm leading-6 whitespace-pre-wrap text-muted-foreground">
            {analysisError ||
              analysis.missingCorrectionsMessage ||
              "No corrections needed."}
          </p>
        )}
      </CertificateSection>

      <CertificateSection title="Trade Parties">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="grid content-start gap-3">
            <FieldGroupTitle>Exporter</FieldGroupTitle>
            <CopyableField
              fieldMap={fieldMap}
              fieldKey="exporterName"
              label="Name"
              isLoading={isFieldLoading("exporterName")}
            />
          </div>
          <div className="grid content-start gap-3">
            <FieldGroupTitle>Importer</FieldGroupTitle>
            <CopyableField
              fieldMap={fieldMap}
              fieldKey="importerName"
              label="Name"
              isLoading={isFieldLoading("importerName")}
            />
          </div>
        </div>
      </CertificateSection>

      <CertificateSection title="Invoices">
        <div className="grid gap-4 md:grid-cols-2">
          <CopyableField
            fieldMap={fieldMap}
            fieldKey="incoterm"
            label="Incoterm"
            isLoading={isFieldLoading("incoterm")}
          />
          <CopyableField
            fieldMap={fieldMap}
            fieldKey="incotermPlace"
            label="Incoterm Place"
            isLoading={isFieldLoading("incotermPlace")}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <CopyableField
            fieldMap={fieldMap}
            label={primaryInvoiceValue.label}
            value={primaryInvoiceValue.value}
            isLoading={isFieldLoading(
              `invoiceValue:${fobValueIndex >= 0 ? fobValueIndex : 0}`
            )}
            onValueChange={(value) =>
              updateInvoiceValue(fobValueIndex >= 0 ? fobValueIndex : 0, value)
            }
          />
          <CopyableField
            fieldMap={fieldMap}
            fieldKey="currency"
            label="Currency"
            isLoading={isFieldLoading("currency")}
          />
        </div>

        {additionalInvoiceValues.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid content-start gap-3">
              {additionalInvoiceValues.map(({ invoiceValue, index }) => (
                <CopyableField
                  key={`${invoiceValue.label}-${index}`}
                  fieldMap={fieldMap}
                  label={invoiceValue.label}
                  value={invoiceValue.value}
                  isLoading={isFieldLoading(`invoiceValue:${index}`)}
                  onValueChange={(value) => updateInvoiceValue(index, value)}
                />
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 border-t pt-6">
          <FieldGroupTitle>Documents</FieldGroupTitle>
          <div className="grid gap-2">
            <h4 className="text-sm font-medium">Commercial Invoice</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <CopyableField
                fieldMap={fieldMap}
                fieldKey="commercialInvoiceReference"
                label="Reference"
                isLoading={isFieldLoading("commercialInvoiceReference")}
              />
              <CopyableField
                fieldMap={fieldMap}
                fieldKey="commercialInvoiceDate"
                label="Issuance Date"
                isLoading={isFieldLoading("commercialInvoiceDate")}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <h4 className="text-sm font-medium">Packing List</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <CopyableField
                fieldMap={fieldMap}
                fieldKey="packingListReference"
                label="Reference"
                isLoading={isFieldLoading("packingListReference")}
              />
              <CopyableField
                fieldMap={fieldMap}
                fieldKey="packingListDate"
                label="Issuance Date"
                isLoading={isFieldLoading("packingListDate")}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 border-t pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <FieldGroupTitle>Invoice Items</FieldGroupTitle>
            <Button
              onClick={downloadInvoiceItems}
              disabled={
                isFieldLoading("invoiceItems") || !analysis.invoiceItems.length
              }
            >
              <DownloadIcon />
              Download Spreadsheet
            </Button>
          </div>
          {isFieldLoading("invoiceItems") ? (
            <AiTextShimmer />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>HS Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Unit FOB Value</TableHead>
                    <TableHead>Second hand</TableHead>
                    <TableHead>Country</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysis.invoiceItems.map((item, index) => (
                    <TableRow key={`${item.hsCode}-${index}`}>
                      <TableCell>{item.hsCode || "Missing"}</TableCell>
                      <TableCell className="min-w-56">
                        {item.description || "Missing"}
                      </TableCell>
                      <TableCell>{item.quantity || "Missing"}</TableCell>
                      <TableCell>{item.unitOfMeasurement || "Missing"}</TableCell>
                      <TableCell>{item.unitPrice || "Missing"}</TableCell>
                      <TableCell>{item.isSecondHand || "Missing"}</TableCell>
                      <TableCell>{item.originCountry || "Missing"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CertificateSection>

      <CertificateSection title="Shipment">
        <div className="grid gap-4 md:grid-cols-2">
          <CopyableField
            fieldMap={fieldMap}
            fieldKey="shipmentMethod"
            label="Shipment Method"
            isLoading={isFieldLoading("shipmentMethod")}
          />
          <CopyableField
            fieldMap={fieldMap}
            fieldKey="cargoType"
            label="Cargo Type"
            isLoading={isFieldLoading("cargoType")}
          />
          <CopyableField
            fieldMap={fieldMap}
            fieldKey="grossWeight"
            label="Gross Weight"
            isLoading={isFieldLoading("grossWeight")}
          />
          <CopyableField
            fieldMap={fieldMap}
            fieldKey="volume"
            label="Volume"
            isLoading={isFieldLoading("volume")}
          />
          <CopyableField
            fieldMap={fieldMap}
            fieldKey="shippingLine"
            label="Shipping Line"
            isLoading={isFieldLoading("shippingLine")}
          />
          <CopyableField
            fieldMap={fieldMap}
            fieldKey="voyage"
            label="Voyage"
            isLoading={isFieldLoading("voyage")}
          />
          <CopyableField
            fieldMap={fieldMap}
            fieldKey="vessel"
            label="Vessel"
            isLoading={isFieldLoading("vessel")}
          />
        </div>

        <div className="grid gap-3 border-t pt-6">
          <FieldGroupTitle>Container Information</FieldGroupTitle>
          <div className="grid gap-3 md:grid-cols-4">
            <CopyableField
              fieldMap={fieldMap}
              fieldKey="containerNumber"
              label="Container Number"
              isLoading={isFieldLoading("containerNumber")}
            />
            <CopyableField
              fieldMap={fieldMap}
              fieldKey="sealNumber"
              label="Seal Number"
              isLoading={isFieldLoading("sealNumber")}
            />
            <CopyableField
              fieldMap={fieldMap}
              fieldKey="containerType"
              label="Type"
              isLoading={isFieldLoading("containerType")}
            />
            <CopyableField
              fieldMap={fieldMap}
              fieldKey="containerSize"
              label="Size"
              isLoading={isFieldLoading("containerSize")}
            />
          </div>
        </div>

        <div className="grid gap-3 border-t pt-6">
          <FieldGroupTitle>Road Map</FieldGroupTitle>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <h4 className="text-sm font-medium">Loading</h4>
              <div className="grid gap-3 md:grid-cols-3">
                <CopyableField
                  fieldMap={fieldMap}
                  fieldKey="loadingCountry"
                  label="Country"
                  isLoading={isFieldLoading("loadingCountry")}
                />
                <CopyableField
                  fieldMap={fieldMap}
                  fieldKey="loadingDate"
                  label="Date"
                  isLoading={isFieldLoading("loadingDate")}
                />
                <CopyableField
                  fieldMap={fieldMap}
                  fieldKey="loadingCity"
                  label="City"
                  isLoading={isFieldLoading("loadingCity")}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <h4 className="text-sm font-medium">Unloading</h4>
              <div className="grid gap-3 md:grid-cols-3">
                <CopyableField
                  fieldMap={fieldMap}
                  fieldKey="unloadingCountry"
                  label="Country"
                  isLoading={isFieldLoading("unloadingCountry")}
                />
                <CopyableField
                  fieldMap={fieldMap}
                  fieldKey="unloadingDate"
                  label="Date"
                  isLoading={isFieldLoading("unloadingDate")}
                />
                <CopyableField
                  fieldMap={fieldMap}
                  fieldKey="unloadingCity"
                  label="City"
                  isLoading={isFieldLoading("unloadingCity")}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 border-t pt-6">
          <FieldGroupTitle>Documents</FieldGroupTitle>
          <div className="grid gap-2">
            <h4 className="text-sm font-medium">Export Declaration</h4>
            <div className="grid gap-3 md:grid-cols-2">
              <CopyableField
                fieldMap={fieldMap}
                fieldKey="exportDeclarationReference"
                label="Reference"
                isLoading={isFieldLoading("exportDeclarationReference")}
              />
              <CopyableField
                fieldMap={fieldMap}
                fieldKey="exportDeclarationDate"
                label="Issuance Date"
                isLoading={isFieldLoading("exportDeclarationDate")}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <h4 className="text-sm font-medium">Bill of Lading</h4>
            <div className="grid gap-3 md:grid-cols-2">
              <CopyableField
                fieldMap={fieldMap}
                fieldKey="billOfLadingReference"
                label="Reference"
                isLoading={isFieldLoading("billOfLadingReference")}
              />
              <CopyableField
                fieldMap={fieldMap}
                fieldKey="billOfLadingDate"
                label="Issuance Date"
                isLoading={isFieldLoading("billOfLadingDate")}
              />
            </div>
          </div>
        </div>
      </CertificateSection>

      <CertificateSection title="Uploaded Documents">
        {isFieldLoading("documents") ? (
          <AiTextShimmer />
        ) : (
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {editableRequest.documents.map((document) => {
              const classification = analysis.documents.find(
                (item) => item.fileName === document.name
              )
              return (
                <button
                  key={document.id}
                  type="button"
                  className="font-medium underline underline-offset-4 hover:text-foreground"
                  onClick={() =>
                    downloadMadagascarDocument(document).catch((error) =>
                      setDownloadError(
                        error instanceof Error
                          ? error.message
                          : "Could not download document."
                      )
                    )
                  }
                >
                  {classification?.documentType ?? "Document"}: {document.name}
                </button>
              )
            })}
          </div>
        )}
      </CertificateSection>
      {downloadError ? (
        <p className="text-sm text-destructive">{downloadError}</p>
      ) : null}
    </div>
    </FieldEditContext.Provider>
  )
}

function NewRequest({ rules }: { rules: MadagascarRule[] }) {
  const router = useRouter()
  const [files, setFiles] = React.useState<File[]>([])
  const [savedRequest, setSavedRequest] = React.useState<MadagascarRequest>()
  const [isAnalyzing, setIsAnalyzing] = React.useState(false)
  const [error, setError] = React.useState("")

  function attachFiles(nextFiles?: FileList | File[]) {
    const accepted = Array.from(nextFiles ?? []).filter(
      (file) =>
        file.type === "application/pdf" || file.type.startsWith("image/")
    )
    if (accepted.length) {
      setFiles(accepted)
      setSavedRequest(undefined)
      setError("")
    }
  }

  async function analyze() {
    setIsAnalyzing(true)
    setError("")
    const now = new Date().toISOString()
    const requestId = createMadagascarId("mgbsc")
    const documents = files.map((file) => ({
      id: createMadagascarId("document"),
      name: file.name,
      type: file.type,
      size: file.size,
      storagePath: "",
    }))
    const draftRequest: MadagascarRequest = {
      id: requestId,
      reference: "Analyzing certificate",
      country: "Unknown",
      status: "Needs review",
      documents,
      analysis: emptyMadagascarAnalysis(files.map((file) => file.name)),
      createdAt: now,
      updatedAt: now,
    }

    draftCertificateJobs.set(requestId, {
      request: draftRequest,
      isAnalyzing: true,
      error: "",
      revealedFields: new Set(),
    })
    notifyDraftCertificateSubscribers()
    router.push(`${moduleBasePath}/requests?id=${encodeURIComponent(requestId)}`)

    try {
      const formData = new FormData()
      files.forEach((file) => formData.append("files", file))
      formData.set(
        "rules",
        JSON.stringify(rules.filter((rule) => rule.enabled))
      )
      const response = await fetch(`${moduleApiBasePath}/analyze`, {
        method: "POST",
        body: formData,
      })
      const payload = (await response.json()) as {
        ok: boolean
        analysis?: MadagascarAnalysis
        message?: string
      }
      if (!response.ok || !payload.analysis) {
        throw new Error(payload.message || "Could not analyze the documents.")
      }
      const request: MadagascarRequest = {
        id: requestId,
        reference: requestReference(payload.analysis),
        country: payload.analysis.consigneeCountry || "Unknown",
        status: analysisHasIssues(payload.analysis) ? "Needs review" : "Ready",
        documents,
        analysis: payload.analysis,
        createdAt: now,
        updatedAt: new Date().toISOString(),
      }
      updateDraftCertificateJob(requestId, (job) => ({
        ...job,
        request,
        isAnalyzing: false,
        error: "",
        revealedFields: new Set(instantRevealFields),
      }))
      revealDraftCertificateFields(requestId, payload.analysis)
      const savedRequest = await saveMadagascarRequest(request, files).catch(
        () => request
      )
      updateDraftCertificateJob(requestId, (job) => ({
        ...job,
        request: savedRequest,
      }))
      setSavedRequest(savedRequest)
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "Could not analyze documents."
      updateDraftCertificateJob(requestId, (job) => ({
        ...job,
        isAnalyzing: false,
        error: message,
      }))
      setError(message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  if (savedRequest) {
    return <AnalysisView request={savedRequest} />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{newRequestLabel}</CardTitle>
        <CardDescription>
          Upload the shipment documents together. AI classifies, extracts,
          compares, and validates them against the active ECTN rules.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <label
          className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-background p-6 text-center transition-colors hover:bg-muted/50"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            attachFiles(event.dataTransfer.files)
          }}
        >
          <UploadIcon className="size-7 text-muted-foreground" />
          <span className="font-medium">
            Drag and drop certificate documents
          </span>
          <span className="max-w-xl text-sm text-muted-foreground">
            Bill of Lading, Commercial Invoice, Packing List, Export/Customs
            Declaration, and optional Freight Invoice. PDF or image.
          </span>
          <span className="text-sm text-muted-foreground">
            {files.length
              ? `${files.length} file${files.length === 1 ? "" : "s"} ready`
              : "or click to choose files"}
          </span>
          <input
            type="file"
            accept="application/pdf,image/*"
            multiple
            className="sr-only"
            onChange={(event) => attachFiles(event.target.files ?? undefined)}
          />
        </label>
        {files.length ? (
          <div className="grid gap-2 rounded-lg border bg-muted/30 p-3">
            {files.map((file) => (
              <div
                key={`${file.name}-${file.size}`}
                className="flex items-center gap-2 text-sm"
              >
                <FileSearchIcon className="size-4 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {file.name}
                </span>
                <span className="text-muted-foreground">Ready for AI</span>
              </div>
            ))}
          </div>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end">
          <Button disabled={!files.length || isAnalyzing} onClick={analyze}>
            <FileSearchIcon />
            {isAnalyzing ? "Analyzing documents..." : "Analyze Certificate"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Requests({
  onSelectedRequestChange,
}: {
  onSelectedRequestChange?: (request: MadagascarRequest | null) => void
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedId = searchParams.get("id") ?? ""
  const [requests, setRequests] = React.useState(loadCachedMadagascarRequests)
  const [isLoading, setIsLoading] = React.useState(!requests.length)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedFilter, setSelectedFilter] = React.useState("all")
  const [confirmDeleteId, setConfirmDeleteId] = React.useState("")
  const [, refreshDraftJobs] = React.useReducer((value) => value + 1, 0)

  React.useEffect(() => {
    let mounted = true
    listMadagascarRequests().then((next) => {
      if (mounted) {
        setRequests(next)
        setIsLoading(false)
      }
    })
    return () => {
      mounted = false
    }
  }, [])

  React.useEffect(() => subscribeToDraftCertificateJobs(refreshDraftJobs), [])

  const selectedDraftJob = selectedId
    ? getDraftCertificateJob(selectedId)
    : undefined
  const selected =
    selectedDraftJob?.request ??
    requests.find((request) => request.id === selectedId)

  React.useEffect(() => {
    onSelectedRequestChange?.(selected ?? null)
  }, [onSelectedRequestChange, selected])

  if (selected) {
    return (
      <AnalysisView
        request={selected}
        isAnalyzing={selectedDraftJob?.isAnalyzing}
        revealedFields={selectedDraftJob?.revealedFields}
        analysisError={selectedDraftJob?.error}
      />
    )
  }

  const normalizedSearch = searchQuery.trim().toLowerCase()
  const filteredRequests = requests.filter((request) => {
    const matchesFilter =
      selectedFilter === "all" ||
      (selectedFilter === "needs-review" &&
        request.status === "Needs review") ||
      (selectedFilter === "ready" && request.status === "Ready")
    const searchableValues = [
      request.reference,
      request.country,
      request.status,
      ...request.documents.map((document) => document.name),
      ...request.analysis.documents.map((document) => document.documentType),
      ...request.analysis.fields
        .filter((field) =>
          ["exporterName", "importerName", "exporter", "importer"].includes(
            field.key
          )
        )
        .map((field) => field.value),
    ]

    return (
      matchesFilter &&
      (!normalizedSearch ||
        searchableValues.some((value) =>
          value.toLowerCase().includes(normalizedSearch)
        ))
    )
  })
  const filterOptions = [
    { id: "all", label: "All", count: requests.length },
    {
      id: "needs-review",
      label: "Needs Review",
      mobileLabel: "Review",
      count: requests.filter((request) => request.status === "Needs review")
        .length,
    },
    {
      id: "ready",
      label: "Ready",
      count: requests.filter((request) => request.status === "Ready").length,
    },
  ]

  function openRequest(id: string) {
    router.push(`${moduleBasePath}/requests?id=${encodeURIComponent(id)}`)
  }

  async function deleteRequest(id: string) {
    await deleteMadagascarRequest(id)
    draftCertificateJobs.delete(id)
    setRequests((currentRequests) =>
      currentRequests.filter((request) => request.id !== id)
    )
    setConfirmDeleteId("")
    notifyDraftCertificateSubscribers()
  }

  return (
    <div className="grid min-h-0 gap-4">
      <CountryTableFilters
        searchQuery={searchQuery}
        searchPlaceholder="Search certificates..."
        searchAriaLabel="Search certificates"
        selectedFilter={selectedFilter}
        filterOptions={filterOptions}
        mobileFiltersFullWidth
        action={
          <Button
            variant="outline"
            size="lg"
            render={<AppLink href={`${moduleBasePath}/new`} />}
          >
            <PlusIcon />
            {newRequestLabel}
          </Button>
        }
        onSearchQueryChange={setSearchQuery}
        onSelectedFilterChange={setSelectedFilter}
      />

      {isLoading ? (
        <div className="grid gap-3 rounded-lg border bg-background p-4">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : (
        <Table containerClassName="rounded-lg border bg-background">
          <TableHeader>
            <TableRow>
              <TableHead>{requestLabel}</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Documents</TableHead>
              <TableHead>Issues</TableHead>
              <TableHead aria-label="Actions" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRequests.map((request) => {
              const requestHref = `${moduleBasePath}/requests?id=${encodeURIComponent(request.id)}`

              return (
                <TableRow key={request.id}>
                  <TableCell className="font-medium">
                    <AppLink href={requestHref} className="block">
                      {request.reference}
                    </AppLink>
                  </TableCell>
                  <TableCell>
                    <AppLink href={requestHref} className="block">
                      {formatDateTime(request.updatedAt)}
                    </AppLink>
                  </TableCell>
                  <TableCell>
                    <AppLink href={requestHref} className="block">
                      <Badge variant={statusVariant(request.status)}>
                        {request.status}
                      </Badge>
                    </AppLink>
                  </TableCell>
                  <TableCell>
                    <AppLink href={requestHref} className="block">
                      <CountryCell country={request.country || "Unknown"} />
                    </AppLink>
                  </TableCell>
                  <TableCell>
                    <AppLink href={requestHref} className="block">
                      {request.documents.length}
                    </AppLink>
                  </TableCell>
                  <TableCell>
                    <AppLink href={requestHref} className="block">
                      {request.analysis.issues.length}
                    </AppLink>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu
                      onOpenChange={(open) => {
                        if (!open) setConfirmDeleteId("")
                      }}
                    >
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Actions for ${request.reference}`}
                          />
                        }
                      >
                        <MoreHorizontalIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-40">
                        <DropdownMenuItem
                          onClick={() => openRequest(request.id)}
                        >
                          <FileTextIcon />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {confirmDeleteId === request.id ? (
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => void deleteRequest(request.id)}
                          >
                            <Trash2Icon />
                            Confirm Delete
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            variant="destructive"
                            closeOnClick={false}
                            onClick={() => setConfirmDeleteId(request.id)}
                          >
                            <Trash2Icon />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
            {!filteredRequests.length ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  No matching certificates.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

function Rules() {
  const [records, setRecords] = React.useState(createSeedCtnKnowledgeRecords)
  const [activeCountryId, setActiveCountryId] = React.useState(
    records[0]?.id ?? "madagascar"
  )
  const [knowledgeSearch, setKnowledgeSearch] = React.useState("")
  const [instruction, setInstruction] = React.useState("")
  const [supportingDocuments, setSupportingDocuments] = React.useState<
    string[]
  >([])
  const [message, setMessage] = React.useState("")
  const [chatMessages, setChatMessages] = React.useState<
    KnowledgeChatMessage[]
  >([])
  const [reviewSession] = React.useState(createKnowledgeReviewSession)
  const [pendingProposal, setPendingProposal] = React.useState<KnowledgePendingProposal | null>(null)
  const [analysis, setAnalysis] = React.useState<KnowledgeAnalysis | null>(null)
  const [changedLocations, setChangedLocations] = React.useState<KnowledgeNavigation[]>([])
  const [navigationTarget, setNavigationTarget] = React.useState<KnowledgeNavigation | null>(null)
  const requestBusy = React.useRef(false)
  React.useEffect(() => { setRecords(loadCtnKnowledgeRecords()) }, [])
  const [chatActivity, setChatActivity] = React.useState<"thinking" | "responding" | "saving" | null>(null)
  const isUpdating = chatActivity !== null
  const [isChatOpen, setIsChatOpen] = React.useState(true)
  const chatScrollRef = React.useRef<HTMLDivElement | null>(null)
  const anchorReplyStart = React.useRef(true)
  const [chatViewportHeight, setChatViewportHeight] = React.useState(0)
  const chatRequestRef = React.useRef<AbortController | null>(null)
  const hasChatMessages = chatMessages.length > 0
  React.useEffect(() => () => chatRequestRef.current?.abort(), [])
  React.useEffect(() => {
    const scroll = chatScrollRef.current
    if (!scroll) return
    const observer = new ResizeObserver(() => setChatViewportHeight(scroll.clientHeight))
    observer.observe(scroll)
    return () => observer.disconnect()
  }, [isChatOpen, hasChatMessages])
  React.useEffect(() => {
    const scroll = chatScrollRef.current
    if (!scroll || !isChatOpen || !anchorReplyStart.current) return
    const latest = chatMessages.at(-1)
    const reply = latest?.role === "assistant" ? Array.from(scroll.querySelectorAll<HTMLElement>("[data-chat-message-id]")).find((element) => element.dataset.chatMessageId === latest.id) : null
    if (reply) scroll.scrollTop += reply.getBoundingClientRect().top - scroll.getBoundingClientRect().top
    else scroll.scrollTop = scroll.scrollHeight
  }, [chatMessages, chatViewportHeight, isChatOpen])
  const supportingDocumentInputRef = React.useRef<HTMLInputElement | null>(null)
  const knowledgeScrollRef = React.useRef<HTMLDivElement | null>(null)
  const [activeKnowledgeSectionId, setActiveKnowledgeSectionId] =
    React.useState("")
  const activeRecord =
    records.find((record) => record.id === activeCountryId) ?? records[0]
  const searchQuery = knowledgeSearch.trim().toLowerCase()
  const visibleRecords = searchQuery
    ? records.filter(
        (record) =>
          record.country.toLowerCase().includes(searchQuery) ||
          record.sections.some(
            (section) =>
              section.title.toLowerCase().includes(searchQuery) ||
              section.summary.toLowerCase().includes(searchQuery) ||
              section.body.some((item) =>
                item.toLowerCase().includes(searchQuery)
              )
          )
      )
    : records
  const visibleSections = searchQuery
    ? activeRecord?.sections.filter(
        (section) =>
          section.title.toLowerCase().includes(searchQuery) ||
          section.summary.toLowerCase().includes(searchQuery) ||
          section.body.some((item) => item.toLowerCase().includes(searchQuery))
      )
    : activeRecord?.sections
  const activeRecordHtml = activeRecord
    ? ctnKnowledgeRecordToHtml(activeRecord)
    : ""
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    editorProps: {
      attributes: {
        class:
          "simple-editor ctn-okf-editor focus:outline-none",
        "aria-label": `${rulesLabel} document`,
      },
    },
    extensions: [
      knowledgeAnchors,
      StarterKit.configure({
        horizontalRule: false,
        link: {
          openOnClick: true,
          enableClickSelection: true,
        },
      }),
    ],
    content: activeRecordHtml,
  })

  React.useEffect(() => {
    if (!editor || !activeRecord) return
    editor.commands.setContent(ctnKnowledgeRecordToHtml(activeRecord))
    const frame = window.requestAnimationFrame(() => {
      const container = knowledgeScrollRef.current
      if (!container) return
      if (navigationTarget?.recordId === activeRecord.id) {
        const target = Array.from(container.querySelectorAll<HTMLElement>("[data-okf-anchor]")).find(
          (element) => element.dataset.okfAnchor === navigationTarget.anchor
        )
        if (target) {
          setActiveKnowledgeSectionId(navigationTarget.sectionId)
          const top = container.scrollTop + target.getBoundingClientRect().top - container.getBoundingClientRect().top - 24
          container.scrollTo({ top, behavior: "smooth" })
          target.animate([{ backgroundColor: "rgba(234, 179, 8, 0.28)" }, { backgroundColor: "transparent" }], { duration: 4500, easing: "ease-out" })
          return
        }
      }
      setActiveKnowledgeSectionId("")
      container.scrollTo({ top: 0, behavior: "smooth" })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [activeRecord, editor, navigationTarget])

  function visitKnowledgeLocation(recordId: string, sectionId: string) {
    setKnowledgeSearch("")
    setActiveCountryId(recordId)
    setNavigationTarget({ recordId, sectionId, anchor: knowledgeAnchor(sectionId), label: sectionId })
  }

  function selectKnowledgeRecord(recordId: string) {
    setNavigationTarget(null)
    setActiveCountryId(recordId)
    setActiveKnowledgeSectionId("")
  }

  function scrollKnowledgeReaderToTop() {
    setActiveKnowledgeSectionId("")
    knowledgeScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }

  function scrollToKnowledgeChangeLog() {
    const scrollElement = knowledgeScrollRef.current
    if (!scrollElement) return

    setActiveKnowledgeSectionId("change-log")

    const headings = Array.from(
      scrollElement.querySelectorAll<HTMLElement>(".ctn-okf-editor h2")
    )
    const heading = headings.find(
      (element) => element.textContent?.trim() === "Change Log"
    )

    if (!heading) return

    const containerTop = scrollElement.getBoundingClientRect().top
    const headingTop = heading.getBoundingClientRect().top
    const top = scrollElement.scrollTop + headingTop - containerTop - 12

    scrollElement.scrollTo({ top, behavior: "smooth" })
  }

  function resetKnowledgeNavigation() {
    setKnowledgeSearch("")
    scrollKnowledgeReaderToTop()
  }

  function scrollToKnowledgeSection(sectionId: string, sectionTitle: string) {
    const scrollElement = knowledgeScrollRef.current
    if (!scrollElement) return

    setActiveKnowledgeSectionId(sectionId)

    const headings = Array.from(
      scrollElement.querySelectorAll<HTMLElement>(".ctn-okf-editor h2")
    )
    const heading = headings.find(
      (element) => element.textContent?.trim() === sectionTitle
    )

    if (!heading) return

    const containerTop = scrollElement.getBoundingClientRect().top
    const headingTop = heading.getBoundingClientRect().top
    const top = scrollElement.scrollTop + headingTop - containerTop - 12

    scrollElement.scrollTo({ top, behavior: "smooth" })
  }

  function prepareInstruction(value: string) {
    const supportingDocumentContext = supportingDocuments.length
      ? `Supporting document references (filenames only; contents not supplied): ${supportingDocuments.join(", ")}`
      : ""

    return [value.trim(), supportingDocumentContext]
      .filter(Boolean)
      .join("\n")
  }

  async function sendKnowledgeMessage() {
    if (requestBusy.current || !activeRecord || (!instruction.trim() && !supportingDocuments.length)) return
    requestBusy.current = true
    anchorReplyStart.current = true
    const responseId = createKnowledgeChatId()
    const abort = new AbortController()
    chatRequestRef.current = abort
    const timeout = window.setTimeout(() => abort.abort(), 100_000)
    const nextInstruction = prepareInstruction(instruction)
    const conversation = chatMessages.map((entry) => entry.proposalStatus === "pending" ? { ...entry, proposalStatus: "superseded" as const } : entry)
    const nextChatMessages = [...conversation, { id: createKnowledgeChatId(), role: "user" as const, content: nextInstruction }]
    // New submissions supersede any pending proposal before starting analysis.
    reviewSession.cancel()
    setPendingProposal(null)
    setAnalysis(null)
    setChangedLocations([])
    setChatMessages(nextChatMessages)
    setIsChatOpen(true)
    setInstruction("")
    setSupportingDocuments([])
    setMessage("")
    setChatActivity("thinking")
    try {
      const liveRecords = loadCtnKnowledgeRecords()
      setRecords(liveRecords)
      const response = await fetch("/api/knowledge-base/chat", {
        signal: abort.signal,
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: liveRecords, selectedRecordId: activeRecord.id,
          messages: conversation.slice(-40).map(({ role, content, analysis, proposalStatus }) => ({ role, content: analysis ? JSON.stringify({ ...analysis, proposalStatus }) : content })), userMessage: nextInstruction,
        }),
      })
      let reviewedAnalysis: KnowledgeAnalysis | undefined
      if (response.ok && response.headers.get("content-type")?.includes("text/event-stream") && response.body) {
        for await (const event of readKnowledgeEvents(response.body)) {
          if (event.type === "preview" && typeof event.text === "string" && event.text) {
            const text = event.text
            setChatActivity("responding")
            setChatMessages((current) => {
              const entry: KnowledgeChatMessage = { id: responseId, role: "assistant", content: text, streaming: true }
              return current.some((message) => message.id === responseId) ? current.map((message) => message.id === responseId ? entry : message) : [...current, entry]
            })
          } else if (event.type === "complete") {
            reviewedAnalysis = event.analysis as KnowledgeAnalysis
            break
          } else if (event.type === "error") {
            throw new Error(typeof event.message === "string" ? event.message : "The review was interrupted. Please retry.")
          }
        }
      } else {
        const payload = await response.json() as KnowledgeChatApiResponse
        if (!response.ok || !payload.ok) throw new Error(payload.message || "Could not review the OKF update.")
        reviewedAnalysis = payload.analysis
      }
      if (!reviewedAnalysis) throw new Error("The response ended before the review was complete. No changes were made. Please retry.")
      const proposal = reviewSession.stage(reviewedAnalysis, liveRecords)
      setPendingProposal(proposal)
      setAnalysis(reviewedAnalysis)
      // Keep comparison/conflict context for follow-up messages, without
      // interpreting any prior proposal as approval or saved knowledge.
      const completedMessage: KnowledgeChatMessage = { id: responseId, role: "assistant",
        content: reviewedAnalysis.assistantMessage,
        analysis: reviewedAnalysis,
        proposal,
        proposalStatus: proposal ? "pending" : undefined,
      }
      setChatMessages((current) => current.some((message) => message.id === responseId) ? current.map((message) => message.id === responseId ? completedMessage : message) : [...current, completedMessage])
    } catch (error) {
      const errorMessage = abort.signal.aborted ? "The review timed out or was interrupted. No changes were made. Please retry." : error instanceof Error ? error.message : "Could not reach the knowledge manager."
      setMessage(errorMessage)
      setChatMessages((current) => [...current.map((message) => message.id === responseId ? { ...message, streaming: false, content: "Incomplete response (not applied).\n\n" + message.content } : message), { id: createKnowledgeChatId(), role: "assistant", content: errorMessage }])
      setInstruction(nextInstruction)
    } finally {
      window.clearTimeout(timeout)
      abort.abort()
      chatRequestRef.current = null
      requestBusy.current = false
      setChatActivity(null)
    }
  }

  async function approveKnowledgeUpdate() {
    if (requestBusy.current || !pendingProposal) return
    requestBusy.current = true
    setChatActivity("saving")
    setMessage("")
    try {
      const commit = () => reviewSession.approve(pendingProposal.id, loadCtnKnowledgeRecords(), saveCtnKnowledgeRecords)
      const result = navigator.locks
        ? await navigator.locks.request("ctn-knowledge-base-write", commit)
        : commit()
      setRecords(result.records)
      setPendingProposal(null)
      setAnalysis(null)
      const successMessage = "Updated successfully. " + result.proposal.files.map((file) =>
        file.location + ": " + (file.currentVersion === file.proposedVersion ? file.proposedVersion + " (unchanged)" : (file.currentVersion ?? "New file") + " → " + file.proposedVersion)
      ).join("; ")
      setChatMessages((current) => [...current.map((entry) => entry.proposal?.id === result.proposal.id ? { ...entry, proposalStatus: "applied" as const } : entry), { id: createKnowledgeChatId(), role: "assistant", content: successMessage }])
      setIsChatOpen(false)
      setChangedLocations(result.proposal.navigation)
      const first = result.proposal.navigation[0]
      setKnowledgeSearch("")
      setActiveCountryId(first.recordId)
      setNavigationTarget(first)
      setMessage("Updated successfully. " + result.proposal.files.map((file) =>
        file.currentVersion === file.proposedVersion ? file.proposedVersion + " (unchanged)" : (file.currentVersion ?? "New file") + " → " + file.proposedVersion
      ).join("; "))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Could not save the approved change. Please retry."
      setMessage(errorMessage)
      setChatMessages((current) => [...current, { id: createKnowledgeChatId(), role: "assistant", content: errorMessage }])
    } finally {
      requestBusy.current = false
      setChatActivity(null)
    }
  }

  function cancelKnowledgeReview() {
    reviewSession.cancel()
    setPendingProposal(null)
    setAnalysis(null)
    setChatMessages((current) => [...current.map((entry) => entry.proposalStatus === "pending" ? { ...entry, proposalStatus: "cancelled" as const } : entry), { id: createKnowledgeChatId(), role: "assistant", content: "Cancelled. No changes were made to the OKF." }])
    setInstruction("")
    setSupportingDocuments([])
    setMessage("")
  }

  function addSupportingDocuments(event: React.ChangeEvent<HTMLInputElement>) {
    const fileNames = Array.from(event.target.files ?? []).map(
      (file) => file.name
    )

    if (fileNames.length) {
      setSupportingDocuments((current) => [...current, ...fileNames])
    }

    event.target.value = ""
  }

  return (
    <div
      className="flex h-full min-h-0 w-full px-0 py-0"
    >
      <Card className="flex h-full min-h-0 w-full flex-1 rounded-none bg-transparent py-0 shadow-none ring-0 sm:rounded-lg sm:bg-card sm:shadow-sm sm:ring-1 md:overflow-hidden">
        <CardContent className="grid h-full min-h-0 flex-1 gap-0 overflow-hidden p-0 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <aside className="notebook-tree hidden min-h-0 flex-col border-b p-5 lg:flex lg:border-r lg:border-b-0 lg:text-sm">
            <div className="mb-3 flex items-center justify-center gap-1 text-muted-foreground">
              <Button
                variant="ghost"
                size="icon-sm"
                className={cn(
                  "size-8 rounded-md hover:bg-muted hover:text-foreground",
                  !activeKnowledgeSectionId && "bg-muted text-foreground"
                )}
                aria-label="Country records"
                title="Country records"
                onClick={scrollKnowledgeReaderToTop}
              >
                <BookOpenTextIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className={cn(
                  "size-8 rounded-md hover:bg-muted hover:text-foreground",
                  activeKnowledgeSectionId === "change-log" &&
                    "bg-muted text-foreground"
                )}
                aria-label="OKF store"
                title="OKF store"
                onClick={scrollToKnowledgeChangeLog}
              >
                <DatabaseIcon />
              </Button>
              <Badge
                variant="outline"
                className="h-7 cursor-pointer rounded-md px-2 font-mono hover:bg-muted"
                role="button"
                tabIndex={0}
                title="Reset OKF navigation"
                onClick={resetKnowledgeNavigation}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    resetKnowledgeNavigation()
                  }
                }}
              >
                OKF
              </Badge>
            </div>
            <div className="grid min-h-0 flex-1 content-start gap-4 overflow-auto">
              <Input
                value={knowledgeSearch}
                onChange={(event) => setKnowledgeSearch(event.target.value)}
                placeholder="Search knowledge base"
              />
              <div className="grid gap-1">
                {visibleRecords.map((record) => (
                  <button
                    key={record.id}
                    type="button"
                    onClick={() => selectKnowledgeRecord(record.id)}
                    className={cn(
                      "group flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-colors",
                      record.id === activeCountryId
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                    )}
                  >
                    <FileTextIcon className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">
                      {record.country}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {knowledgeVersion(record.version)}
                    </span>
                  </button>
                ))}
                {!visibleRecords.length ? (
                  <p className="px-2 py-3 text-sm text-muted-foreground">
                    No matching records.
                  </p>
                ) : null}
              </div>
              <div className="grid gap-1 border-t pt-4">
                {visibleSections?.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() =>
                      scrollToKnowledgeSection(section.id, section.title)
                    }
                    className={cn(
                      "flex min-h-8 items-center gap-2 rounded-md px-2 text-left text-sm transition-colors",
                      section.id === activeKnowledgeSectionId
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                    )}
                  >
                    <MessageSquareTextIcon className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">
                      {section.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <section className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-0 sm:p-5">
            <div className="flex items-center gap-2 border-b bg-background p-3 lg:hidden">
              <Select
                value={activeCountryId}
                onValueChange={(value) => {
                  if (value) selectKnowledgeRecord(value)
                }}
              >
                <SelectTrigger className="h-10 flex-1">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {records.map((record) => (
                      <SelectItem key={record.id} value={record.id}>
                        {record.country}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Badge variant="outline" className="h-9 rounded-md px-2 font-mono">
                OKF
              </Badge>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden bg-background pt-2 sm:-m-5 sm:pt-0">
              <div className="simple-editor-wrapper">
                <div
                  ref={knowledgeScrollRef}
                  className="simple-editor-content ctn-okf-editor-content"
                >
                  <EditorContent editor={editor} />
                </div>
              </div>
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pb-0 pt-4 sm:px-6">
              <div className="pointer-events-auto mx-auto grid w-full min-w-0 max-w-3xl grid-cols-1 gap-1">
                {changedLocations.length > 0 && <div className="flex flex-wrap gap-1 rounded-xl border bg-background p-2" aria-label="Changed OKF locations">
                  {changedLocations.map((location, index) => <Button key={index} size="sm" variant="ghost" className="h-auto whitespace-normal text-left" onClick={() => {
                    setIsChatOpen(false)
                    setActiveCountryId(location.recordId)
                    setNavigationTarget({ ...location })
                  }}>View change {index + 1}: {location.label}</Button>)}
                </div>}
                {chatMessages.length ? (
                  <div className={cn("mb-2 flex max-h-[26rem] flex-col rounded-2xl border bg-background/95 p-3 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-background/90", isChatOpen && "min-h-[14rem]")}>
                    <div className={cn("flex items-center justify-between gap-2", isChatOpen && "mb-3 border-b pb-2")}>
                      <span className="text-sm font-medium">{!isChatOpen && chatActivity ? (chatActivity === "thinking" ? "Thinking…" : chatActivity === "responding" ? "Responding…" : "Saving approved changes…") : "Conversation"}</span>
                      <Button type="button" size="sm" variant="ghost" aria-expanded={isChatOpen} aria-controls="okf-conversation" onClick={() => { anchorReplyStart.current = true; setIsChatOpen((open) => !open) }}>
                        {isChatOpen ? "Hide conversation" : "Show conversation"}
                      </Button>
                    </div>
                    {isChatOpen && <div id="okf-conversation" ref={chatScrollRef} role="log" aria-label="OKF conversation" aria-live="polite" onWheel={() => { anchorReplyStart.current = false }} onTouchMove={() => { anchorReplyStart.current = false }} onPointerDown={() => { anchorReplyStart.current = false }} onKeyDown={(event) => { if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) anchorReplyStart.current = false }} className="ctn-knowledge-chat-scroll grid min-h-0 flex-1 content-start gap-3 overflow-y-scroll pr-1">
                      {chatMessages.map((chatMessage) => (
                        <div
                          key={chatMessage.id}
                          data-chat-message-id={chatMessage.id}
                          style={chatMessage.role === "assistant" && chatMessage.id === chatMessages.at(-1)?.id ? { minHeight: chatViewportHeight } : undefined}
                          className={cn(
                            "flex items-start",
                            chatMessage.role === "user"
                              ? "justify-end"
                              : "justify-start"
                          )}
                        >
                          {chatMessage.analysis ? <div className="min-w-0 w-full">
                            <KnowledgeReviewCard analysis={chatMessage.analysis} proposal={chatMessage.proposal ?? null} status={chatMessage.proposalStatus} visit={visitKnowledgeLocation} />
                          </div> : <div
                            className={cn(
                              "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm leading-6",
                              chatMessage.streaming && "w-full max-w-full",
                              chatMessage.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-foreground"
                            )}
                          >
                            {chatMessage.content}
                            {chatMessage.streaming && <span aria-label="Response arriving" className="ml-1 inline-block h-4 w-1.5 translate-y-0.5 bg-current motion-safe:animate-pulse" />}
                          </div>}
                        </div>
                      ))}
                      {chatActivity && chatActivity !== "responding" && <div role="status" className="flex w-fit items-center gap-3 rounded-2xl bg-muted px-4 py-3 text-sm text-foreground">
                        <SparklesIcon className="size-4 motion-safe:animate-pulse" aria-hidden="true" />
                        <span>{chatActivity === "thinking" ? "Thinking…" : "Saving approved changes…"}</span>
                        <span className="flex gap-1" aria-hidden="true">
                          {[0, 1, 2].map((dot) => <span key={dot} className="size-1.5 rounded-full bg-current motion-safe:animate-bounce" style={{ animationDelay: `${dot * 150}ms` }} />)}
                        </span>
                      </div>}
                    </div>}
                    {pendingProposal && isChatOpen ? (
                      <div className="mt-3 flex justify-end gap-2 border-t pt-3">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={cancelKnowledgeReview}
                          disabled={isUpdating}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={approveKnowledgeUpdate}
                          disabled={isUpdating || !pendingProposal}
                        >
                          {isUpdating ? (
                            <SparklesIcon className="animate-pulse" />
                          ) : (
                            <CheckIcon />
                          )}
                          Approve
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <input
                  ref={supportingDocumentInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={addSupportingDocuments}
                />
                <div className="flex min-h-14 items-end gap-2 rounded-2xl border bg-background/95 px-2 py-2 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/85">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-10 shrink-0 rounded-full"
                    aria-label="Upload supporting documents"
                    title="Upload supporting documents"
                    onClick={() => supportingDocumentInputRef.current?.click()}
                  >
                    <PlusIcon className="size-5" />
                  </Button>
                  <Textarea
                    value={instruction}
                    onChange={(event) => setInstruction(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault()
                        sendKnowledgeMessage()
                      }
                    }}
                    placeholder={
                      analysis?.classification === "CONFLICT"
                        ? "Reply with clarification"
                        : "Ask AI to update the knowledge base"
                    }
                    className="field-sizing-content max-h-[min(25rem,45dvh)] min-h-10 min-w-0 flex-1 resize-none overflow-y-auto rounded-none border-0 bg-transparent px-1 py-2.5 text-base leading-5 shadow-none focus-visible:ring-0"
                    rows={1}
                  />
                  <Button
                    type="button"
                    size="icon"
                    className="size-10 shrink-0 rounded-full"
                    onClick={sendKnowledgeMessage}
                    disabled={
                      (!instruction.trim() && !supportingDocuments.length) ||
                      isUpdating
                    }
                    aria-label="Update OKF"
                    title="Update OKF"
                  >
                    {isUpdating ? (
                      <SparklesIcon className="size-5 animate-pulse" />
                    ) : (
                      <SendIcon className="size-5" />
                    )}
                  </Button>
                </div>
                <div className="flex min-h-4 items-center justify-between gap-3 px-4 text-xs text-muted-foreground">
                  <span role="status" className="whitespace-pre-wrap">
                    {supportingDocuments.length
                      ? `${supportingDocuments.length} supporting document${supportingDocuments.length === 1 ? "" : "s"} attached`
                      : message}
                  </span>
                  {supportingDocuments.length ? (
                    <button
                      type="button"
                      className="shrink-0 text-foreground hover:underline"
                      onClick={() => setSupportingDocuments([])}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  )
}

export function MadagascarBscView({ section }: { section: Section }) {
  const router = useRouter()
  const [rules, setRules] = React.useState(loadCachedMadagascarRules)
  const [selectedRequest, setSelectedRequest] =
    React.useState<MadagascarRequest | null>(null)

  React.useEffect(() => {
    if (section === "new") {
      void listMadagascarRules().then(setRules)
    }
  }, [section])

  const title =
    section === "requests" && selectedRequest
      ? getBillOfLadingTitle(selectedRequest)
      : section === "new"
      ? `${moduleLabel} - ${newRequestLabel}`
      : section === "requests"
        ? `${moduleLabel} - ${requestsLabel}`
        : rulesLabel
  const showCertificateBackButton = section === "requests" && selectedRequest
  const certificateBackButtonLabel = `Back to ${requestsLabel.toLowerCase()}`
  const handleSelectedRequestChange = React.useCallback(
    (request: MadagascarRequest | null) => {
      setSelectedRequest(request)
    },
    []
  )
  const goBackToCertificates = React.useCallback(() => {
    router.replace(`${moduleBasePath}/requests`, { scroll: false })
  }, [router])

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
        <main
          className={cn(
            "flex min-h-svh flex-col bg-background md:min-h-[calc(100svh-1rem)]",
            section === "rules" &&
              "h-[calc(100vh-1rem)] min-h-0 overflow-hidden md:min-h-0"
          )}
        >
          <SiteHeader
            title={title}
            leadingContent={
              showCertificateBackButton ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-[4.625rem]"
                  aria-label={certificateBackButtonLabel}
                  onClick={goBackToCertificates}
                >
                  <ArrowLeftIcon />
                  Back
                </Button>
              ) : undefined
            }
            mobileLeadingContent={
              showCertificateBackButton ? (
                <SiteHeaderBackButton
                  label={certificateBackButtonLabel}
                  onClick={goBackToCertificates}
                />
              ) : undefined
            }
          />
          <div
            className={
              section === "rules"
                ? "flex min-h-0 w-full flex-1 overflow-hidden px-0 py-0 sm:px-4 sm:py-4 lg:px-6"
                : "grid gap-4 px-4 py-4 pb-28 md:pb-4 lg:px-6"
            }
          >
            {section === "new" ? <NewRequest rules={rules} /> : null}
            {section === "requests" ? (
              <Requests
                onSelectedRequestChange={handleSelectedRequestChange}
              />
            ) : null}
            {section === "rules" ? <Rules /> : null}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
