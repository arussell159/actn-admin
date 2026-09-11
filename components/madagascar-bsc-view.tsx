"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { EditorContent, useEditor } from "@tiptap/react"
import { StarterKit } from "@tiptap/starter-kit"
import {
  ArrowLeftIcon,
  BookOpenTextIcon,
  CheckIcon,
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

import { CertificateCorrections } from "@/components/certificate-corrections"
import {
  CertificateForm,
  certificateFieldGridClass,
  certificateSpanClass,
} from "@/components/certificate-form"
import {
  CertificateFieldControl,
  AiTextShimmer,
} from "@/components/certificate-field-control"
import { useCertificateLayouts } from "@/lib/certificate-layout/client"
import {
  layoutRecordSchema,
  resolveLayout,
  type CertificateField,
} from "@/lib/certificate-layout/schema"
import { AppLink } from "@/components/app-link"
import { PageFrame } from "@/components/page-frame"
import { SectionNavigation } from "@/components/section-navigation"
import { CountryCell } from "@/components/country-cell"
import { CountryTableFilters } from "@/components/country-table-filters"
import type { PendingRequestEdit } from "@/components/okf-request-review"
import { okfApi } from "@/lib/okf/client"
import type { CorrectionSourceLearning } from "@/lib/okf/correction-learning"
import { SiteHeader, SiteHeaderBackButton } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  certificateDocumentDownloadName,
  certificateDocumentTypeRank,
  createMadagascarId,
  madagascarFieldGroups,
  requestReference,
  type MadagascarAnalysis,
  type MadagascarInvoiceValue,
  type MadagascarRequest,
} from "@/lib/madagascar-bsc"
import { bscCountryModules } from "@/lib/bsc-country-modules"
import { cn } from "@/lib/utils"
import {
  deleteMadagascarRequest,
  downloadMadagascarDocument,
  listMadagascarRequests,
  saveMadagascarRequest,
  subscribeToMadagascarRequestChanges,
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
  createKnowledgeReviewSession,
  knowledgeAnchor,
  knowledgeVersion,
  type KnowledgeAnalysis,
  type KnowledgePendingProposal,
  type KnowledgeNavigation,
} from "@/lib/ctn-knowledge-review"
import { readKnowledgeEvents } from "@/lib/ctn-knowledge-stream"

type Section = "new" | "requests" | "rules"
type CertificateRecordSection = "dashboard" | "fields" | "errors"
type DraftCertificateJob = {
  request: MadagascarRequest
  isAnalyzing: boolean
  error: string
  progressLabel: string
  revealedFields: Set<string>
  partialFields: Map<string, string>
  abortController?: AbortController
}
type AnalysisStreamEvent = {
  type:
    | "progress"
    | "country"
    | "document"
    | "field-delta"
    | "field"
    | "complete"
    | "error"
  label?: string
  fieldKey?: string
  value?: string
  analysis?: MadagascarAnalysis
  message?: string
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
type CorrectionSourceQuestion = {
  correctionId: string
  target: string
  label: string
  question: string
}

const knowledgeAnchors = Extension.create({
  name: "knowledgeAnchors",
  addGlobalAttributes() {
    return [
      {
        types: ["heading", "paragraph", "listItem"],
        attributes: {
          "data-okf-anchor": {
            default: null,
            parseHTML: (element) => element.getAttribute("data-okf-anchor"),
            renderHTML: (attributes) =>
              attributes["data-okf-anchor"]
                ? { "data-okf-anchor": attributes["data-okf-anchor"] }
                : {},
          },
        },
      },
    ]
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
const moduleBasePath = madagascarModule?.basePath ?? "/cargo-tracking-notes"
const moduleApiBasePath =
  madagascarModule?.apiBasePath ?? "/api/cargo-tracking-notes"
const draftCertificateJobs = new Map<string, DraftCertificateJob>()
const draftCertificateSubscribers = new Set<() => void>()
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

function cancelDraftCertificateJob(id: string) {
  const job = draftCertificateJobs.get(id)
  if (!job?.isAnalyzing) return
  job.abortController?.abort()
  updateDraftCertificateJob(id, (current) => ({
    ...current,
    isAnalyzing: false,
    error: "Document processing was cancelled.",
    progressLabel: "Review cancelled",
    partialFields: new Map(),
    abortController: undefined,
  }))
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

function formatDocumentDate(value?: string) {
  if (!value) return "Date unavailable"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Date unavailable"

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

function createKnowledgeChatId() {
  return `knowledge-chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function AnalysisView({
  request,
  activeSection,
  isAnalyzing = false,
  revealedFields,
  partialFields,
  analysisError = "",
  progressLabel = "",
  onCancel,
}: {
  request: MadagascarRequest
  activeSection: CertificateRecordSection
  isAnalyzing?: boolean
  revealedFields?: Set<string>
  partialFields?: Map<string, string>
  analysisError?: string
  progressLabel?: string
  onCancel?: () => void
}) {
  const [downloadError, setDownloadError] = React.useState("")
  const [editableRequest, setEditableRequest] = React.useState(request)
  const [pendingEdits, setPendingEdits] = React.useState<PendingRequestEdit[]>(
    []
  )
  const [isSavingEdits, setIsSavingEdits] = React.useState(false)
  const [saveEditError, setSaveEditError] = React.useState("")
  const [saveEditMessage, setSaveEditMessage] = React.useState("")
  const [sourceQuestions, setSourceQuestions] = React.useState<
    CorrectionSourceQuestion[]
  >([])
  const [sourceAnswers, setSourceAnswers] = React.useState<
    Record<string, string>
  >({})
  const [savingSourceQuestionId, setSavingSourceQuestionId] = React.useState("")
  const savedRequestRef = React.useRef(request)
  const catalog = useCertificateLayouts()
  const analysis = editableRequest.analysis
  const observedCountry = analysis.okf?.observations.country
  const country = observedCountry
    ? observedCountry.status === "supported"
      ? observedCountry.name
      : ""
    : isAnalyzing || editableRequest.country === "Unknown"
      ? ""
      : editableRequest.country
  const snapshot = layoutRecordSchema.safeParse(analysis.okf?.certificateLayout)
  const catalogLayout = resolveLayout(catalog.rows, country)
  const requestLayout = snapshot.success
    ? resolveLayout([snapshot.data], country)
    : undefined
  const savedLayout =
    requestLayout &&
    (!catalogLayout || requestLayout.revision > catalogLayout.revision)
      ? requestLayout
      : catalogLayout
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
    const savedRequest = savedRequestRef.current
    const incomingRequestIsNewer =
      request.id !== savedRequest.id ||
      request.updatedAt > savedRequest.updatedAt

    if (!pendingEdits.length && incomingRequestIsNewer) {
      savedRequestRef.current = request
      setEditableRequest(request)
    }
  }, [pendingEdits.length, request])

  React.useEffect(() => {
    let active = true
    okfApi<{ sourceQuestions?: CorrectionSourceQuestion[] }>(
      `/api/okf/requests?id=${encodeURIComponent(request.id)}`
    )
      .then((result) => {
        if (active) setSourceQuestions(result.sourceQuestions ?? [])
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [request.id])

  function requestValue(target: string, source = savedRequestRef.current) {
    if (target.startsWith("invoiceValue:")) {
      const index = Number(target.slice("invoiceValue:".length))
      return source.analysis.invoiceValues?.[index]?.value ?? ""
    }
    return (
      source.analysis.fields.find((field) => field.key === target)?.value ?? ""
    )
  }

  function stageFieldEdit(target: string, label: string, value: string) {
    setSaveEditError("")
    setSaveEditMessage("")
    setPendingEdits((current) => {
      const withoutTarget = current.filter((edit) => edit.target !== target)
      return requestValue(target) === value
        ? withoutTarget
        : [...withoutTarget, { target, label, value }]
    })
    setEditableRequest((current) => {
      if (target.startsWith("invoiceValue:")) {
        const index = Number(target.slice("invoiceValue:".length))
        return {
          ...current,
          analysis: {
            ...current.analysis,
            invoiceValues: (current.analysis.invoiceValues ?? []).map(
              (field, fieldIndex) =>
                fieldIndex === index
                  ? {
                      ...field,
                      value,
                      status: value.trim() ? "extracted" : "missing",
                    }
                  : field
            ),
          },
        }
      }

      const existing = current.analysis.fields.some(
        (field) => field.key === target
      )
      return {
        ...current,
        analysis: {
          ...current.analysis,
          fields: existing
            ? current.analysis.fields.map((field) =>
                field.key === target
                  ? {
                      ...field,
                      value,
                      status: value.trim() ? "extracted" : "missing",
                    }
                  : field
              )
            : [
                ...current.analysis.fields,
                {
                  key: target,
                  label,
                  value,
                  status: value.trim() ? "extracted" : "missing",
                  source: "Staff correction",
                  note: "",
                },
              ],
        },
      }
    })
  }

  function updateExtractedField(
    fieldKey: string,
    label: string,
    value: string
  ) {
    stageFieldEdit(fieldKey, label, value)
  }

  function updateInvoiceValue(index: number, value: string) {
    const field = invoiceValues[index]
    stageFieldEdit(
      analysis.invoiceValues?.length ? "invoiceValue:" + index : "fobValue",
      field?.label || "Invoice value",
      value
    )
  }

  async function saveFieldEdits() {
    if (!pendingEdits.length || isSavingEdits) return
    const editsToSave = [...pendingEdits]
    setIsSavingEdits(true)
    setSaveEditError("")
    setSaveEditMessage("")
    try {
      const savedRequest = savedRequestRef.current
      const result = await okfApi<{
        request: MadagascarRequest
        sourceLearnings: CorrectionSourceLearning[]
        sourceQuestions: CorrectionSourceQuestion[]
      }>("/api/okf/requests", {
        action: "correct-batch",
        requestId: savedRequest.id,
        expectedUpdatedAt: savedRequest.updatedAt,
        reviewId:
          editsToSave.find((edit) => edit.reviewId)?.reviewId ??
          savedRequest.analysis.okf?.id ??
          null,
        edits: editsToSave.map(({ target, label, value }) => ({
          target,
          label,
          value,
        })),
      })
      const latestRequest = result.request
      savedRequestRef.current = latestRequest
      setEditableRequest(latestRequest)
      setPendingEdits([])
      setSourceQuestions(result.sourceQuestions)
      const verified = result.sourceLearnings.filter(
        (learning) => learning.verified
      ).length
      setSaveEditMessage(
        `${editsToSave.length} correction${editsToSave.length === 1 ? "" : "s"} saved to the AI learning history${verified ? `; ${verified} source${verified === 1 ? "" : "s"} verified in the uploaded documents` : "; no source match was verified"}.`
      )
    } catch (error) {
      setSaveEditError(
        error instanceof Error ? error.message : "Could not save corrections."
      )
    } finally {
      setIsSavingEdits(false)
    }
  }

  async function saveSourceExplanation(question: CorrectionSourceQuestion) {
    const explanation = sourceAnswers[question.correctionId]?.trim() ?? ""
    if (!explanation || savingSourceQuestionId) return
    setSavingSourceQuestionId(question.correctionId)
    setSaveEditError("")
    try {
      await okfApi<{ learning: CorrectionSourceLearning }>(
        "/api/okf/requests",
        {
          action: "explain-source",
          correctionId: question.correctionId,
          explanation,
        }
      )
      setSourceQuestions((current) =>
        current.filter((item) => item.correctionId !== question.correctionId)
      )
      setSourceAnswers((current) => {
        const next = { ...current }
        delete next[question.correctionId]
        return next
      })
      setSaveEditMessage(
        `${question.label} source explanation saved to the OKF learning history.`
      )
    } catch (error) {
      setSaveEditError(
        error instanceof Error
          ? error.message
          : "Could not save the source explanation."
      )
    } finally {
      setSavingSourceQuestionId("")
    }
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
  const isProgressivelyLoading = isAnalyzing && !analysisError

  function renderField(field: CertificateField) {
    const streamingValue = isFieldLoading(field.id)
      ? partialFields?.get(field.id)
      : undefined
    return (
      <CertificateFieldControl
        field={field}
        value={fieldMap.get(field.id)?.value ?? ""}
        isLoading={isFieldLoading(field.id)}
        streamingValue={streamingValue}
        onValueChange={(value) =>
          updateExtractedField(field.id, field.label, value)
        }
      />
    )
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8">
      {isProgressivelyLoading ? (
        <div className="flex items-center gap-3 rounded-xl border border-indigo-500/20 bg-linear-to-r from-indigo-500/8 via-fuchsia-500/5 to-cyan-500/8 px-4 py-3 text-sm shadow-[0_0_28px_rgba(99,102,241,0.10)]">
          <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-background text-indigo-600 shadow-sm dark:text-indigo-300">
            <span className="absolute inset-0 animate-ping rounded-full border border-indigo-400/35" />
            <SparklesIcon className="size-4 animate-pulse" />
          </span>
          <div className="min-w-0">
            <p className="font-medium text-foreground">
              Building the certificate
            </p>
            <p className="truncate text-muted-foreground">
              {progressLabel || "Reading the uploaded documents"}
            </p>
          </div>
          {onCancel ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto shrink-0"
              onClick={onCancel}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      ) : null}

      {activeSection === "dashboard" ? (
        <div
          role="tabpanel"
          id="certificate-record-section"
          aria-labelledby="certificate-header-dashboard certificate-mobile-dashboard"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {[
            {
              label: "Bill of Lading",
              value:
                fieldMap.get("billOfLadingReference")?.value ||
                (isAnalyzing ? "Extracting…" : "Not available"),
            },
            {
              label: "Customer",
              value:
                fieldMap.get("importerName")?.value ||
                (isAnalyzing ? "Extracting…" : "Not available"),
            },
            {
              label: "Destination",
              value: country || editableRequest.country || "Not available",
            },
            {
              label: "Documents",
              value: `${editableRequest.documents.length} uploaded`,
            },
          ].map((item) => (
            <Card key={item.label} className="gap-2 py-4 shadow-sm">
              <CardHeader className="px-4">
                <CardDescription>{item.label}</CardDescription>
                <CardTitle className="truncate text-base">
                  {item.value}
                </CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : null}

      {activeSection === "fields" ? (
        <div
          role="tabpanel"
          id="certificate-record-section"
          aria-labelledby="certificate-header-fields certificate-mobile-fields"
          className="grid gap-8"
        >
          {pendingEdits.length ? (
            <div className="sticky top-2 z-10 flex items-center justify-between gap-4 rounded-lg border bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
              <p className="text-sm text-muted-foreground">
                {pendingEdits.length} unsaved field change
                {pendingEdits.length === 1 ? "" : "s"}
              </p>
              <Button
                type="button"
                size="sm"
                disabled={isSavingEdits}
                onClick={() => void saveFieldEdits()}
              >
                <CheckIcon />
                {isSavingEdits ? "Checking sources…" : "Save changes"}
              </Button>
            </div>
          ) : null}
          {saveEditError ? (
            <p className="text-sm text-destructive">{saveEditError}</p>
          ) : null}
          {saveEditMessage ? (
            <p className="text-sm text-muted-foreground">{saveEditMessage}</p>
          ) : null}
          {sourceQuestions.length ? (
            <div className="grid gap-3 rounded-lg border bg-muted/20 p-4">
              {sourceQuestions.map((question) => (
                <div className="grid gap-2" key={question.correctionId}>
                  <p className="text-sm font-medium">{question.question}</p>
                  <div className="flex items-end gap-2 max-sm:flex-col max-sm:items-stretch">
                    <Textarea
                      rows={2}
                      value={sourceAnswers[question.correctionId] ?? ""}
                      placeholder="For example: It is in the rated Bill of Lading on page 2."
                      aria-label={`Explain the source for ${question.label}`}
                      onChange={(event) =>
                        setSourceAnswers((current) => ({
                          ...current,
                          [question.correctionId]: event.target.value,
                        }))
                      }
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={
                        !sourceAnswers[question.correctionId]?.trim() ||
                        Boolean(savingSourceQuestionId)
                      }
                      onClick={() => void saveSourceExplanation(question)}
                    >
                      {savingSourceQuestionId === question.correctionId
                        ? "Saving…"
                        : "Save explanation"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {savedLayout ? (
            <CertificateForm
              layout={savedLayout.layout}
              renderField={renderField}
              groupAction={(group) =>
                group.kind === "invoice-items" &&
                savedLayout.country_key === "madagascar" ? (
                  <Button
                    onClick={downloadInvoiceItems}
                    disabled={
                      isFieldLoading("invoiceItems") ||
                      !analysis.invoiceItems.length
                    }
                  >
                    <DownloadIcon />
                    Download Spreadsheet
                  </Button>
                ) : null
              }
              renderSpecial={(group, fields, centerSingleColumn) => {
                if (group.kind === "invoice-values")
                  return (
                    <div className="grid gap-4">
                      <div
                        className={certificateFieldGridClass(
                          group.columns,
                          group.breakpoint,
                          centerSingleColumn
                        )}
                      >
                        {fields.map((field, index) => (
                          <div
                            key={field.id}
                            className={certificateSpanClass(
                              group.fields[index].span,
                              group.breakpoint
                            )}
                          >
                            {field.id === "fobValue" ? (
                              <CertificateFieldControl
                                field={{
                                  ...field,
                                  label: primaryInvoiceValue.label,
                                }}
                                value={primaryInvoiceValue.value}
                                isLoading={isFieldLoading(
                                  "invoiceValue:" +
                                    (fobValueIndex >= 0 ? fobValueIndex : 0)
                                )}
                                streamingValue={
                                  isFieldLoading(
                                    "invoiceValue:" +
                                      (fobValueIndex >= 0 ? fobValueIndex : 0)
                                  )
                                    ? partialFields?.get("fobValue")
                                    : undefined
                                }
                                onValueChange={(value) =>
                                  updateInvoiceValue(
                                    fobValueIndex >= 0 ? fobValueIndex : 0,
                                    value
                                  )
                                }
                              />
                            ) : (
                              renderField(field)
                            )}
                          </div>
                        ))}
                      </div>
                      {fields.some((field) => field.id === "fobValue") &&
                      additionalInvoiceValues.length ? (
                        <div
                          className={certificateFieldGridClass(
                            group.columns,
                            group.breakpoint,
                            centerSingleColumn
                          )}
                        >
                          <div className="grid gap-3">
                            {additionalInvoiceValues.map(
                              ({ invoiceValue, index }) => (
                                <CertificateFieldControl
                                  key={index}
                                  field={{
                                    ...fields[0],
                                    id: "invoiceValue:" + index,
                                    control: "text",
                                    label: invoiceValue.label,
                                  }}
                                  value={invoiceValue.value}
                                  isLoading={isFieldLoading(
                                    "invoiceValue:" + index
                                  )}
                                  onValueChange={(value) =>
                                    updateInvoiceValue(index, value)
                                  }
                                />
                              )
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                if (group.kind === "invoice-items")
                  return isFieldLoading("invoiceItems") ? (
                    <AiTextShimmer />
                  ) : (
                    <div className="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {fields.map((field) => (
                              <TableHead key={field.id}>
                                {field.label}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {analysis.invoiceItems.map((item, index) => (
                            <TableRow key={index}>
                              {fields.map((field) => (
                                <TableCell
                                  key={field.id}
                                  className={
                                    field.id === "invoiceItems.description"
                                      ? "min-w-56"
                                      : undefined
                                  }
                                >
                                  {String(
                                    item[
                                      field.id.slice(13) as keyof typeof item
                                    ] || "Missing"
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )
                if (group.kind === "documents")
                  return isFieldLoading("documents") ? (
                    <AiTextShimmer />
                  ) : (
                    <Table containerClassName="overflow-hidden">
                      <TableBody>
                        {editableRequest.documents
                          .map((document, index) => ({
                            document,
                            index,
                            documentType:
                              analysis.documents.find(
                                (item) => item.fileName === document.name
                              )?.documentType ?? "Document",
                          }))
                          .sort(
                            (left, right) =>
                              certificateDocumentTypeRank(left.documentType) -
                                certificateDocumentTypeRank(
                                  right.documentType
                                ) || left.index - right.index
                          )
                          .map(({ document, documentType }) => {
                            const billOfLadingNumber =
                              analysis.fields.find(
                                (field) => field.key === "billOfLadingReference"
                              )?.value || request.reference
                            const downloadName =
                              certificateDocumentDownloadName(
                                documentType,
                                billOfLadingNumber,
                                document.name
                              )

                            return (
                              <TableRow key={document.id}>
                                <TableCell className="w-9 py-2 pr-2 pl-3 text-muted-foreground">
                                  <FileTextIcon
                                    className="size-3.5"
                                    aria-hidden="true"
                                  />
                                </TableCell>
                                <TableCell className="min-w-0 py-2 pl-0 whitespace-normal">
                                  <div className="text-sm font-medium text-foreground">
                                    {documentType}
                                  </div>
                                  <div className="text-xs leading-4 text-muted-foreground">
                                    <span className="break-all">
                                      {document.name}
                                    </span>
                                    <span>
                                      {" "}
                                      · {formatDocumentDate(request.createdAt)}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="w-10 py-1 pr-2 text-right">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-8"
                                    aria-label={`Download ${downloadName}`}
                                    onClick={() =>
                                      downloadMadagascarDocument(
                                        document,
                                        downloadName
                                      ).catch((error) =>
                                        setDownloadError(
                                          error instanceof Error
                                            ? error.message
                                            : "Could not download document."
                                        )
                                      )
                                    }
                                  >
                                    <DownloadIcon className="size-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                      </TableBody>
                    </Table>
                  )
                return null
              }}
            />
          ) : isAnalyzing && !country ? null : (
            <p className="text-sm text-muted-foreground">
              {catalog.loading
                ? "Loading the country layout…"
                : !country
                  ? analysisError ||
                    "Could not identify a supported consignee country from the Bill of Lading."
                  : catalog.error ||
                    "No published certificate layout for " +
                      country +
                      ". Define and publish it in Certificate Settings."}
            </p>
          )}
          {savedLayout && catalog.error ? (
            <p className="text-sm text-muted-foreground">
              Using the saved layout. {catalog.error}
            </p>
          ) : null}
        </div>
      ) : null}

      {activeSection === "errors" ? (
        <div
          role="tabpanel"
          id="certificate-record-section"
          aria-labelledby="certificate-header-errors certificate-mobile-errors"
        >
          {isAnalyzing ? (
            <p className="text-sm text-muted-foreground">
              Missing fields and corrections will be checked after all document
              extraction is complete.
            </p>
          ) : (
            <CertificateCorrections
              message={analysis.missingCorrectionsMessage}
              error={analysisError}
              loading={false}
            />
          )}
        </div>
      ) : null}

      {downloadError ? (
        <p className="text-sm text-destructive">{downloadError}</p>
      ) : null}
    </div>
  )
}

function NewRequest() {
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
    const abortController = new AbortController()
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
      progressLabel: "Finding the consignee country on the Bill of Lading",
      revealedFields: new Set(),
      partialFields: new Map(),
      abortController,
    })
    notifyDraftCertificateSubscribers()
    router.push(
      `${moduleBasePath}/requests?id=${encodeURIComponent(requestId)}`
    )

    try {
      const formData = new FormData()
      files.forEach((file) => formData.append("files", file))
      formData.set("requestId", requestId)
      formData.set("stream", "true")
      const response = await fetch(`${moduleApiBasePath}/analyze`, {
        method: "POST",
        body: formData,
        signal: abortController.signal,
      })
      if (!response.ok || !response.body) {
        const payload = (await response.json()) as { message?: string }
        throw new Error(payload.message || "Could not analyze the documents.")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let finalAnalysis: MadagascarAnalysis | undefined

      const applyEvent = (event: AnalysisStreamEvent) => {
        if (event.analysis) finalAnalysis = event.analysis
        if (event.type === "error") {
          updateDraftCertificateJob(requestId, (job) => ({
            ...job,
            request: {
              ...job.request,
              analysis: event.analysis ?? job.request.analysis,
              country:
                event.analysis?.consigneeCountry ||
                event.analysis?.okf?.observations.country.name ||
                job.request.country,
              updatedAt: new Date().toISOString(),
            },
            isAnalyzing: false,
            error: event.message || "Could not analyze the documents.",
            progressLabel: "Review stopped",
            partialFields: new Map(),
          }))
          throw new Error(event.message || "Could not analyze the documents.")
        }

        updateDraftCertificateJob(requestId, (job) => {
          const analysis = event.analysis ?? job.request.analysis
          const revealedFields = new Set(job.revealedFields)
          const partialFields = new Map(job.partialFields)
          if (event.type === "country") revealedFields.add("documents")
          if (event.type === "field-delta" && event.fieldKey && event.value) {
            partialFields.set(event.fieldKey, event.value)
          }
          if (event.type === "field" && event.fieldKey) {
            revealedFields.add(event.fieldKey)
            partialFields.delete(event.fieldKey)
          }
          if (event.type === "complete") {
            ;[
              ...progressiveFieldOrder,
              ...analysis.fields.map((field) => field.key),
            ].forEach((fieldKey) => revealedFields.add(fieldKey))
            analysis.invoiceValues.forEach((_, index) =>
              revealedFields.add(`invoiceValue:${index}`)
            )
            partialFields.clear()
          }

          return {
            ...job,
            request: {
              ...job.request,
              reference:
                event.type === "complete"
                  ? requestReference(analysis)
                  : job.request.reference,
              country:
                analysis.consigneeCountry ||
                analysis.okf?.observations.country.name ||
                job.request.country,
              status:
                event.type === "complete"
                  ? analysisHasIssues(analysis)
                    ? "Needs review"
                    : "Ready"
                  : job.request.status,
              analysis,
              updatedAt: new Date().toISOString(),
            },
            isAnalyzing: event.type !== "complete",
            progressLabel: event.label || job.progressLabel,
            revealedFields,
            partialFields,
            abortController:
              event.type === "complete" ? undefined : job.abortController,
          }
        })
      }

      while (true) {
        const { done, value } = await reader.read()
        buffer += decoder.decode(value, { stream: !done })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (line.trim()) applyEvent(JSON.parse(line) as AnalysisStreamEvent)
        }
        if (done) break
      }
      if (buffer.trim()) {
        applyEvent(JSON.parse(buffer) as AnalysisStreamEvent)
      }
      if (!finalAnalysis) {
        throw new Error("The document review ended before results were ready.")
      }
      const completedAnalysis = finalAnalysis

      const request: MadagascarRequest = {
        id: requestId,
        reference: requestReference(completedAnalysis),
        country:
          completedAnalysis.consigneeCountry ||
          completedAnalysis.okf?.observations.country.name ||
          "Unknown",
        status: analysisHasIssues(completedAnalysis) ? "Needs review" : "Ready",
        documents,
        analysis: completedAnalysis,
        createdAt: now,
        updatedAt: new Date().toISOString(),
      }
      updateDraftCertificateJob(requestId, (job) => ({
        ...job,
        request,
        isAnalyzing: false,
        error: "",
        progressLabel: "Certificate review ready",
        abortController: undefined,
        partialFields: new Map(),
        revealedFields: new Set([
          ...progressiveFieldOrder,
          ...job.request.analysis.fields.map((field) => field.key),
          ...completedAnalysis.invoiceValues.map(
            (_, index) => `invoiceValue:${index}`
          ),
        ]),
      }))
      const savedRequest = await saveMadagascarRequest(request, files)
      updateDraftCertificateJob(requestId, (job) => ({
        ...job,
        request: savedRequest,
      }))
      setSavedRequest(savedRequest)
    } catch (caught) {
      const message = abortController.signal.aborted
        ? "Document processing was cancelled."
        : caught instanceof Error
          ? caught.message
          : "Could not analyze documents."
      updateDraftCertificateJob(requestId, (job) => ({
        ...job,
        isAnalyzing: false,
        error: message,
        progressLabel: "Review stopped",
        abortController: undefined,
        partialFields: new Map(),
      }))
      setError(message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  if (savedRequest) {
    return <AnalysisView request={savedRequest} activeSection="fields" />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{newRequestLabel}</CardTitle>
        <CardDescription>
          Upload the shipment documents together. AI identifies the consignee
          country, loads its published Certificate Settings layout, then
          extracts and checks the documents.
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
            Declaration, DU (Documento Unico), and Freight Invoice. Certificate
            fields and document sources come from Certificate Settings; country
            requirements come from published knowledge. PDF or image.
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
  activeCertificateSection,
}: {
  onSelectedRequestChange?: (request: MadagascarRequest | null) => void
  activeCertificateSection: CertificateRecordSection
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedId = searchParams.get("id") ?? ""
  const [requests, setRequests] = React.useState<MadagascarRequest[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState("")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedFilter, setSelectedFilter] = React.useState("all")
  const [confirmDeleteId, setConfirmDeleteId] = React.useState("")
  const [, refreshDraftJobs] = React.useReducer((value) => value + 1, 0)

  React.useEffect(() => {
    let mounted = true
    let refreshing = false
    let refreshQueued = false
    const refresh = async () => {
      if (refreshing) {
        refreshQueued = true
        return
      }
      refreshing = true
      try {
        const next = await listMadagascarRequests()
        if (mounted) {
          setRequests(next)
          setLoadError("")
        }
      } catch (error) {
        if (mounted)
          setLoadError(
            error instanceof Error
              ? error.message
              : "Could not load certificate requests from the database."
          )
      } finally {
        refreshing = false
        if (mounted) setIsLoading(false)
        if (mounted && refreshQueued) {
          refreshQueued = false
          void refresh()
        }
      }
    }
    const requestChanged = () => void refresh()
    const unsubscribe = subscribeToMadagascarRequestChanges(requestChanged)
    const visibleRefresh = () => {
      if (document.visibilityState === "visible") void refresh()
    }
    window.addEventListener("focus", requestChanged)
    document.addEventListener("visibilitychange", visibleRefresh)
    const interval = window.setInterval(visibleRefresh, 30_000)
    void refresh()
    return () => {
      mounted = false
      unsubscribe()
      clearInterval(interval)
      window.removeEventListener("focus", requestChanged)
      document.removeEventListener("visibilitychange", visibleRefresh)
    }
  }, [])

  React.useEffect(() => subscribeToDraftCertificateJobs(refreshDraftJobs), [])

  const selectedDraftJob = selectedId
    ? getDraftCertificateJob(selectedId)
    : undefined
  const persistedSelected = requests.find(
    (request) => request.id === selectedId
  )
  const selected =
    selectedDraftJob?.isAnalyzing || selectedDraftJob?.error
      ? selectedDraftJob.request
      : persistedSelected ?? selectedDraftJob?.request

  React.useEffect(() => {
    onSelectedRequestChange?.(selected ?? null)
  }, [onSelectedRequestChange, selected])

  if (selected) {
    return (
      <AnalysisView
        request={selected}
        activeSection={activeCertificateSection}
        isAnalyzing={selectedDraftJob?.isAnalyzing}
        revealedFields={selectedDraftJob?.revealedFields}
        partialFields={selectedDraftJob?.partialFields}
        analysisError={selectedDraftJob?.error}
        progressLabel={selectedDraftJob?.progressLabel}
        onCancel={
          selectedDraftJob?.isAnalyzing
            ? () => cancelDraftCertificateJob(selectedDraftJob.request.id)
            : undefined
        }
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
    cancelDraftCertificateJob(id)
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
          <Button size="lg" render={<AppLink href={`${moduleBasePath}/new`} />}>
            <PlusIcon />
            {newRequestLabel}
          </Button>
        }
        onSearchQueryChange={setSearchQuery}
        onSelectedFilterChange={setSelectedFilter}
      />

      {loadError ? (
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
      ) : null}

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
  const [pendingProposal, setPendingProposal] =
    React.useState<KnowledgePendingProposal | null>(null)
  const [analysis, setAnalysis] = React.useState<KnowledgeAnalysis | null>(null)
  const [changedLocations, setChangedLocations] = React.useState<
    KnowledgeNavigation[]
  >([])
  const [navigationTarget, setNavigationTarget] =
    React.useState<KnowledgeNavigation | null>(null)
  const requestBusy = React.useRef(false)
  React.useEffect(() => {
    setRecords(loadCtnKnowledgeRecords())
  }, [])
  const [chatActivity, setChatActivity] = React.useState<
    "thinking" | "responding" | "saving" | null
  >(null)
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
    const observer = new ResizeObserver(() =>
      setChatViewportHeight(scroll.clientHeight)
    )
    observer.observe(scroll)
    return () => observer.disconnect()
  }, [isChatOpen, hasChatMessages])
  React.useEffect(() => {
    const scroll = chatScrollRef.current
    if (!scroll || !isChatOpen || !anchorReplyStart.current) return
    const latest = chatMessages.at(-1)
    const reply =
      latest?.role === "assistant"
        ? Array.from(
            scroll.querySelectorAll<HTMLElement>("[data-chat-message-id]")
          ).find((element) => element.dataset.chatMessageId === latest.id)
        : null
    if (reply)
      scroll.scrollTop +=
        reply.getBoundingClientRect().top - scroll.getBoundingClientRect().top
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
        class: "simple-editor ctn-okf-editor focus:outline-none",
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
        const target = Array.from(
          container.querySelectorAll<HTMLElement>("[data-okf-anchor]")
        ).find(
          (element) => element.dataset.okfAnchor === navigationTarget.anchor
        )
        if (target) {
          setActiveKnowledgeSectionId(navigationTarget.sectionId)
          const top =
            container.scrollTop +
            target.getBoundingClientRect().top -
            container.getBoundingClientRect().top -
            24
          container.scrollTo({ top, behavior: "smooth" })
          target.animate(
            [
              { backgroundColor: "rgba(234, 179, 8, 0.28)" },
              { backgroundColor: "transparent" },
            ],
            { duration: 4500, easing: "ease-out" }
          )
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
    setNavigationTarget({
      recordId,
      sectionId,
      anchor: knowledgeAnchor(sectionId),
      label: sectionId,
    })
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

    return [value.trim(), supportingDocumentContext].filter(Boolean).join("\n")
  }

  async function sendKnowledgeMessage() {
    if (
      requestBusy.current ||
      !activeRecord ||
      (!instruction.trim() && !supportingDocuments.length)
    )
      return
    requestBusy.current = true
    anchorReplyStart.current = true
    const responseId = createKnowledgeChatId()
    const abort = new AbortController()
    chatRequestRef.current = abort
    const timeout = window.setTimeout(() => abort.abort(), 100_000)
    const nextInstruction = prepareInstruction(instruction)
    const conversation = chatMessages.map((entry) =>
      entry.proposalStatus === "pending"
        ? { ...entry, proposalStatus: "superseded" as const }
        : entry
    )
    const nextChatMessages = [
      ...conversation,
      {
        id: createKnowledgeChatId(),
        role: "user" as const,
        content: nextInstruction,
      },
    ]
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          records: liveRecords,
          selectedRecordId: activeRecord.id,
          messages: conversation
            .slice(-40)
            .map(({ role, content, analysis, proposalStatus }) => ({
              role,
              content: analysis
                ? JSON.stringify({ ...analysis, proposalStatus })
                : content,
            })),
          userMessage: nextInstruction,
        }),
      })
      let reviewedAnalysis: KnowledgeAnalysis | undefined
      if (
        response.ok &&
        response.headers.get("content-type")?.includes("text/event-stream") &&
        response.body
      ) {
        for await (const event of readKnowledgeEvents(response.body)) {
          if (
            event.type === "preview" &&
            typeof event.text === "string" &&
            event.text
          ) {
            const text = event.text
            setChatActivity("responding")
            setChatMessages((current) => {
              const entry: KnowledgeChatMessage = {
                id: responseId,
                role: "assistant",
                content: text,
                streaming: true,
              }
              return current.some((message) => message.id === responseId)
                ? current.map((message) =>
                    message.id === responseId ? entry : message
                  )
                : [...current, entry]
            })
          } else if (event.type === "complete") {
            reviewedAnalysis = event.analysis as KnowledgeAnalysis
            break
          } else if (event.type === "error") {
            throw new Error(
              typeof event.message === "string"
                ? event.message
                : "The review was interrupted. Please retry."
            )
          }
        }
      } else {
        const payload = (await response.json()) as KnowledgeChatApiResponse
        if (!response.ok || !payload.ok)
          throw new Error(payload.message || "Could not review the OKF update.")
        reviewedAnalysis = payload.analysis
      }
      if (!reviewedAnalysis)
        throw new Error(
          "The response ended before the review was complete. No changes were made. Please retry."
        )
      const proposal = reviewSession.stage(reviewedAnalysis, liveRecords)
      setPendingProposal(proposal)
      setAnalysis(reviewedAnalysis)
      // Keep comparison/conflict context for follow-up messages, without
      // interpreting any prior proposal as approval or saved knowledge.
      const completedMessage: KnowledgeChatMessage = {
        id: responseId,
        role: "assistant",
        content: reviewedAnalysis.assistantMessage,
        analysis: reviewedAnalysis,
        proposal,
        proposalStatus: proposal ? "pending" : undefined,
      }
      setChatMessages((current) =>
        current.some((message) => message.id === responseId)
          ? current.map((message) =>
              message.id === responseId ? completedMessage : message
            )
          : [...current, completedMessage]
      )
    } catch (error) {
      const errorMessage = abort.signal.aborted
        ? "The review timed out or was interrupted. No changes were made. Please retry."
        : error instanceof Error
          ? error.message
          : "Could not reach the knowledge manager."
      setMessage(errorMessage)
      setChatMessages((current) => [
        ...current.map((message) =>
          message.id === responseId
            ? {
                ...message,
                streaming: false,
                content:
                  "Incomplete response (not applied).\n\n" + message.content,
              }
            : message
        ),
        {
          id: createKnowledgeChatId(),
          role: "assistant",
          content: errorMessage,
        },
      ])
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
      const commit = () =>
        reviewSession.approve(
          pendingProposal.id,
          loadCtnKnowledgeRecords(),
          saveCtnKnowledgeRecords
        )
      const result = navigator.locks
        ? await navigator.locks.request("ctn-knowledge-base-write", commit)
        : commit()
      setRecords(result.records)
      setPendingProposal(null)
      setAnalysis(null)
      const successMessage =
        "Updated successfully. " +
        result.proposal.files
          .map(
            (file) =>
              file.location +
              ": " +
              (file.currentVersion === file.proposedVersion
                ? file.proposedVersion + " (unchanged)"
                : (file.currentVersion ?? "New file") +
                  " → " +
                  file.proposedVersion)
          )
          .join("; ")
      setChatMessages((current) => [
        ...current.map((entry) =>
          entry.proposal?.id === result.proposal.id
            ? { ...entry, proposalStatus: "applied" as const }
            : entry
        ),
        {
          id: createKnowledgeChatId(),
          role: "assistant",
          content: successMessage,
        },
      ])
      setIsChatOpen(false)
      setChangedLocations(result.proposal.navigation)
      const first = result.proposal.navigation[0]
      setKnowledgeSearch("")
      setActiveCountryId(first.recordId)
      setNavigationTarget(first)
      setMessage(
        "Updated successfully. " +
          result.proposal.files
            .map((file) =>
              file.currentVersion === file.proposedVersion
                ? file.proposedVersion + " (unchanged)"
                : (file.currentVersion ?? "New file") +
                  " → " +
                  file.proposedVersion
            )
            .join("; ")
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Could not save the approved change. Please retry."
      setMessage(errorMessage)
      setChatMessages((current) => [
        ...current,
        {
          id: createKnowledgeChatId(),
          role: "assistant",
          content: errorMessage,
        },
      ])
    } finally {
      requestBusy.current = false
      setChatActivity(null)
    }
  }

  function cancelKnowledgeReview() {
    reviewSession.cancel()
    setPendingProposal(null)
    setAnalysis(null)
    setChatMessages((current) => [
      ...current.map((entry) =>
        entry.proposalStatus === "pending"
          ? { ...entry, proposalStatus: "cancelled" as const }
          : entry
      ),
      {
        id: createKnowledgeChatId(),
        role: "assistant",
        content: "Cancelled. No changes were made to the OKF.",
      },
    ])
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
    <div className="flex h-full min-h-0 w-full px-0 py-0">
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
              <Badge
                variant="outline"
                className="h-9 rounded-md px-2 font-mono"
              >
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

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pt-4 pb-0 sm:px-6">
              <div className="pointer-events-auto mx-auto grid w-full max-w-3xl min-w-0 grid-cols-1 gap-1">
                {changedLocations.length > 0 && (
                  <div
                    className="flex flex-wrap gap-1 rounded-xl border bg-background p-2"
                    aria-label="Changed OKF locations"
                  >
                    {changedLocations.map((location, index) => (
                      <Button
                        key={index}
                        size="sm"
                        variant="ghost"
                        className="h-auto text-left whitespace-normal"
                        onClick={() => {
                          setIsChatOpen(false)
                          setActiveCountryId(location.recordId)
                          setNavigationTarget({ ...location })
                        }}
                      >
                        View change {index + 1}: {location.label}
                      </Button>
                    ))}
                  </div>
                )}
                {chatMessages.length ? (
                  <div
                    className={cn(
                      "mb-2 flex max-h-[26rem] flex-col rounded-2xl border bg-background/95 p-3 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-background/90",
                      isChatOpen && "min-h-[14rem]"
                    )}
                  >
                    <div
                      className={cn(
                        "flex items-center justify-between gap-2",
                        isChatOpen && "mb-3 border-b pb-2"
                      )}
                    >
                      <span className="text-sm font-medium">
                        {!isChatOpen && chatActivity
                          ? chatActivity === "thinking"
                            ? "Thinking…"
                            : chatActivity === "responding"
                              ? "Responding…"
                              : "Saving approved changes…"
                          : "Conversation"}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-expanded={isChatOpen}
                        aria-controls="okf-conversation"
                        onClick={() => {
                          anchorReplyStart.current = true
                          setIsChatOpen((open) => !open)
                        }}
                      >
                        {isChatOpen ? "Hide conversation" : "Show conversation"}
                      </Button>
                    </div>
                    {isChatOpen && (
                      <div
                        id="okf-conversation"
                        ref={chatScrollRef}
                        role="log"
                        aria-label="OKF conversation"
                        aria-live="polite"
                        onWheel={() => {
                          anchorReplyStart.current = false
                        }}
                        onTouchMove={() => {
                          anchorReplyStart.current = false
                        }}
                        onPointerDown={() => {
                          anchorReplyStart.current = false
                        }}
                        onKeyDown={(event) => {
                          if (
                            [
                              "ArrowUp",
                              "ArrowDown",
                              "PageUp",
                              "PageDown",
                              "Home",
                              "End",
                              " ",
                            ].includes(event.key)
                          )
                            anchorReplyStart.current = false
                        }}
                        className="ctn-knowledge-chat-scroll grid min-h-0 flex-1 content-start gap-3 overflow-y-scroll pr-1"
                      >
                        {chatMessages.map((chatMessage) => (
                          <div
                            key={chatMessage.id}
                            data-chat-message-id={chatMessage.id}
                            style={
                              chatMessage.role === "assistant" &&
                              chatMessage.id === chatMessages.at(-1)?.id
                                ? { minHeight: chatViewportHeight }
                                : undefined
                            }
                            className={cn(
                              "flex items-start",
                              chatMessage.role === "user"
                                ? "justify-end"
                                : "justify-start"
                            )}
                          >
                            {chatMessage.analysis ? (
                              <div className="w-full min-w-0">
                                <KnowledgeReviewCard
                                  analysis={chatMessage.analysis}
                                  proposal={chatMessage.proposal ?? null}
                                  status={chatMessage.proposalStatus}
                                  visit={visitKnowledgeLocation}
                                />
                              </div>
                            ) : (
                              <div
                                className={cn(
                                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-6 break-words whitespace-pre-wrap",
                                  chatMessage.streaming && "w-full max-w-full",
                                  chatMessage.role === "user"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-foreground"
                                )}
                              >
                                {chatMessage.content}
                                {chatMessage.streaming && (
                                  <span
                                    aria-label="Response arriving"
                                    className="ml-1 inline-block h-4 w-1.5 translate-y-0.5 bg-current motion-safe:animate-pulse"
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                        {chatActivity && chatActivity !== "responding" && (
                          <div
                            role="status"
                            className="flex w-fit items-center gap-3 rounded-2xl bg-muted px-4 py-3 text-sm text-foreground"
                          >
                            <SparklesIcon
                              className="size-4 motion-safe:animate-pulse"
                              aria-hidden="true"
                            />
                            <span>
                              {chatActivity === "thinking"
                                ? "Thinking…"
                                : "Saving approved changes…"}
                            </span>
                            <span className="flex gap-1" aria-hidden="true">
                              {[0, 1, 2].map((dot) => (
                                <span
                                  key={dot}
                                  className="size-1.5 rounded-full bg-current motion-safe:animate-bounce"
                                  style={{ animationDelay: `${dot * 150}ms` }}
                                />
                              ))}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
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
  const [selectedRequest, setSelectedRequest] =
    React.useState<MadagascarRequest | null>(null)
  const [activeCertificateSection, setActiveCertificateSection] =
    React.useState<CertificateRecordSection>("fields")
  const certificateSectionItems: {
    id: CertificateRecordSection
    label: string
  }[] = [
    { id: "dashboard", label: "Dashboard" },
    { id: "fields", label: "Fields" },
    { id: "errors", label: "Errors" },
  ]

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
    if (selectedRequest) cancelDraftCertificateJob(selectedRequest.id)
    router.replace(`${moduleBasePath}/requests`, { scroll: false })
  }, [router, selectedRequest])
  React.useEffect(() => {
    setActiveCertificateSection("fields")
  }, [selectedRequest?.id])

  return (
    <PageFrame
      mainClassName={cn(
        "flex min-h-svh flex-col bg-background md:min-h-[calc(100svh-1rem)]",
        section === "rules" &&
          "h-[calc(100vh-1rem)] min-h-0 overflow-hidden md:min-h-0"
      )}
      header={
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
          bottomContent={
            showCertificateBackButton ? (
              <SectionNavigation
                items={certificateSectionItems}
                value={activeCertificateSection}
                onValueChange={setActiveCertificateSection}
                label="Certificate sections"
                panelId="certificate-record-section"
                triggerIdPrefix="certificate-header"
              />
            ) : undefined
          }
        />
      }
    >
      <div
        className={
          section === "rules"
            ? "flex min-h-0 w-full flex-1 overflow-hidden px-0 py-0 sm:px-4 sm:py-4 lg:px-6"
            : "grid gap-4 px-4 py-4 pb-28 md:pb-4 lg:px-6"
        }
      >
        {section === "new" ? <NewRequest /> : null}
        {showCertificateBackButton ? (
          <div className="md:hidden">
            <SectionNavigation
              items={certificateSectionItems}
              value={activeCertificateSection}
              onValueChange={setActiveCertificateSection}
              label="Certificate sections"
              panelId="certificate-record-section"
              triggerIdPrefix="certificate-mobile"
            />
          </div>
        ) : null}
        {section === "requests" ? (
          <Requests
            onSelectedRequestChange={handleSelectedRequestChange}
            activeCertificateSection={activeCertificateSection}
          />
        ) : null}
        {section === "rules" ? <Rules /> : null}
      </div>
    </PageFrame>
  )
}
