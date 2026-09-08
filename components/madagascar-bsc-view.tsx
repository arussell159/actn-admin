"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ClipboardIcon,
  DownloadIcon,
  FileSearchIcon,
  PlusIcon,
  SendIcon,
  UploadIcon,
} from "lucide-react"

import { AppLink } from "@/components/app-link"
import { AppSidebar } from "@/components/app-sidebar"
import { CountryCell } from "@/components/country-cell"
import { CountryTableFilters } from "@/components/country-table-filters"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
import {
  createMadagascarId,
  madagascarFieldGroups,
  requestReference,
  type MadagascarAnalysis,
  type MadagascarExtractedField,
  type MadagascarRequest,
  type MadagascarRule,
} from "@/lib/madagascar-bsc"
import {
  deleteMadagascarRule,
  downloadMadagascarDocument,
  listMadagascarRequests,
  listMadagascarRules,
  loadCachedMadagascarRequests,
  loadCachedMadagascarRules,
  saveMadagascarRequest,
  saveMadagascarRule,
} from "@/lib/madagascar-bsc-db"
import { fetchJsonWithTimeout } from "@/lib/network"

type Section = "new" | "requests" | "rules"

function copyText(value: string) {
  return navigator.clipboard.writeText(value)
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

function CopyableField({
  fieldMap,
  fieldKey,
  label,
  value: suppliedValue,
}: {
  fieldMap: Map<string, MadagascarExtractedField>
  fieldKey?: string
  label: string
  value?: string
}) {
  const value =
    suppliedValue !== undefined
      ? suppliedValue.trim()
      : fieldKey
        ? (fieldMap.get(fieldKey)?.value?.trim() ?? "")
        : ""

  return (
    <div className="grid min-w-0 gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="group relative w-full">
        <Input
          value={value}
          placeholder="Missing"
          readOnly
          aria-label={value ? `Copy ${label}` : `${label} is missing`}
          className={
            value
              ? "cursor-pointer pr-9 hover:border-ring hover:bg-muted/40 hover:ring-3 hover:ring-ring/20"
              : "pr-9"
          }
          onClick={() => {
            if (value) void copyText(value)
          }}
        />
        {value ? (
          <ClipboardIcon className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100" />
        ) : null}
      </div>
    </div>
  )
}

function AnalysisView({ request }: { request: MadagascarRequest }) {
  const [downloadError, setDownloadError] = React.useState("")
  const analysis = request.analysis
  const fieldMap = new Map(analysis.fields.map((field) => [field.key, field]))
  const invoiceValues = analysis.invoiceValues?.length
    ? analysis.invoiceValues
    : [
        {
          label: "FOB Value",
          value: fieldMap.get("fobValue")?.value ?? "",
        },
      ]
  const fobValueIndex = invoiceValues.findIndex((field) =>
    field.label.toLowerCase().includes("fob")
  )
  const primaryInvoiceValue =
    invoiceValues[fobValueIndex >= 0 ? fobValueIndex : 0]
  const additionalInvoiceValues = invoiceValues.filter(
    (_, index) => index !== (fobValueIndex >= 0 ? fobValueIndex : 0)
  )

  async function downloadInvoiceItems() {
    setDownloadError("")
    try {
      const response = await fetch("/api/madagascar-bsc/invoice-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: request.reference,
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
      anchor.download = `Madagascar-BSC-${request.reference}.xlsx`
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

  const formText = madagascarFieldGroups
    .flatMap((group) => [
      group.title,
      ...group.fields.map(
        ([key, label]) => `${label}: ${fieldMap.get(key)?.value || "MISSING"}`
      ),
      "",
    ])
    .join("\n")
  const completeFormText = [
    formText,
    "Invoice Values",
    ...invoiceValues.map(
      (field) => `${field.label}: ${field.value || "MISSING"}`
    ),
  ].join("\n")

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8">
      <header className="border-b pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {request.reference}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Click any value to copy it.
          </p>
        </div>
      </header>

      <section className="grid gap-3 border-b pb-8">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">
            Missing / Corrections Needed
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => copyText(analysis.missingCorrectionsMessage)}
          >
            <ClipboardIcon />
            Copy
          </Button>
        </div>
        <p className="max-w-4xl text-sm leading-6 whitespace-pre-wrap text-muted-foreground">
          {analysis.missingCorrectionsMessage || "No corrections needed."}
        </p>
      </section>

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => copyText(completeFormText)}>
          <ClipboardIcon />
          Copy All Fields
        </Button>
      </div>

      <section className="grid gap-5 border-b pb-8">
        <h2 className="text-lg font-semibold">Trade Parties</h2>
        <div className="grid gap-8 md:grid-cols-2">
          <div className="grid content-start gap-3">
            <h3 className="text-base font-semibold">Exporter</h3>
            <CopyableField
              fieldMap={fieldMap}
              fieldKey="exporterName"
              label="Name"
            />
            <CopyableField
              fieldMap={fieldMap}
              fieldKey="exporterAddress"
              label="Address"
            />
            <CopyableField
              fieldMap={fieldMap}
              fieldKey="exporterCountry"
              label="Country"
            />
          </div>
          <div className="grid content-start gap-3">
            <h3 className="text-base font-semibold">Importer</h3>
            <CopyableField
              fieldMap={fieldMap}
              fieldKey="importerName"
              label="Name"
            />
            <CopyableField
              fieldMap={fieldMap}
              fieldKey="importerAddress"
              label="Address"
            />
            <CopyableField
              fieldMap={fieldMap}
              fieldKey="importerCountry"
              label="Country"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-6 border-b pb-8">
        <h2 className="text-lg font-semibold">Invoices</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <CopyableField
            fieldMap={fieldMap}
            fieldKey="incoterm"
            label="Incoterm"
          />
          <CopyableField
            fieldMap={fieldMap}
            fieldKey="incotermPlace"
            label="Incoterm Place"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <CopyableField
            fieldMap={fieldMap}
            label={primaryInvoiceValue.label}
            value={primaryInvoiceValue.value}
          />
          <CopyableField
            fieldMap={fieldMap}
            fieldKey="currency"
            label="Currency"
          />
        </div>

        {additionalInvoiceValues.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid content-start gap-3">
              {additionalInvoiceValues.map((invoiceValue, index) => (
                <CopyableField
                  key={`${invoiceValue.label}-${index}`}
                  fieldMap={fieldMap}
                  label={invoiceValue.label}
                  value={invoiceValue.value}
                />
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 border-t pt-6">
          <h3 className="text-lg font-semibold">Documents</h3>
          <div className="grid gap-2">
            <h4 className="text-sm font-medium">Commercial Invoice</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <CopyableField
                fieldMap={fieldMap}
                fieldKey="commercialInvoiceReference"
                label="Reference"
              />
              <CopyableField
                fieldMap={fieldMap}
                fieldKey="commercialInvoiceDate"
                label="Issuance Date"
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
              />
              <CopyableField
                fieldMap={fieldMap}
                fieldKey="packingListDate"
                label="Issuance Date"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 border-t pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h3 className="text-lg font-semibold">Invoice Items</h3>
            <Button
              onClick={downloadInvoiceItems}
              disabled={!analysis.invoiceItems.length}
            >
              <DownloadIcon />
              Download Spreadsheet
            </Button>
          </div>
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
                  <TableHead>Issues</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analysis.invoiceItems.map((item, index) => (
                  <TableRow key={`${item.hsCode}-${index}`}>
                    <TableCell>{item.hsCode || "—"}</TableCell>
                    <TableCell className="min-w-56">
                      {item.description || "—"}
                    </TableCell>
                    <TableCell>{item.quantity || "—"}</TableCell>
                    <TableCell>{item.unitOfMeasurement || "—"}</TableCell>
                    <TableCell>{item.unitPrice || "—"}</TableCell>
                    <TableCell>{item.isSecondHand || "—"}</TableCell>
                    <TableCell>{item.originCountry || "—"}</TableCell>
                    <TableCell className="min-w-56 text-destructive">
                      {item.issues.join("; ") || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>

      <section className="grid gap-6 border-b pb-8">
        <h2 className="text-lg font-semibold">Shipment</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <CopyableField
            fieldMap={fieldMap}
            fieldKey="shipmentMethod"
            label="Shipment Method"
          />
          <CopyableField
            fieldMap={fieldMap}
            fieldKey="cargoType"
            label="Cargo Type"
          />
          <CopyableField
            fieldMap={fieldMap}
            fieldKey="grossWeight"
            label="Gross Weight"
          />
          <CopyableField fieldMap={fieldMap} fieldKey="volume" label="Volume" />
          <CopyableField
            fieldMap={fieldMap}
            fieldKey="shippingLine"
            label="Shipping Line"
          />
          <CopyableField fieldMap={fieldMap} fieldKey="voyage" label="Voyage" />
          <CopyableField fieldMap={fieldMap} fieldKey="vessel" label="Vessel" />
        </div>

        <div className="grid gap-3 border-t pt-6">
          <h3 className="text-lg font-semibold">Container Information</h3>
          <div className="grid gap-3 md:grid-cols-4">
            <CopyableField
              fieldMap={fieldMap}
              fieldKey="containerNumber"
              label="Container Number"
            />
            <CopyableField
              fieldMap={fieldMap}
              fieldKey="sealNumber"
              label="Seal Number"
            />
            <CopyableField
              fieldMap={fieldMap}
              fieldKey="containerType"
              label="Type"
            />
            <CopyableField
              fieldMap={fieldMap}
              fieldKey="containerSize"
              label="Size"
            />
          </div>
        </div>

        <div className="grid gap-3 border-t pt-6">
          <h3 className="text-lg font-semibold">Road Map</h3>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <h4 className="text-sm font-medium">Loading</h4>
              <div className="grid gap-3 md:grid-cols-3">
                <CopyableField
                  fieldMap={fieldMap}
                  fieldKey="loadingCountry"
                  label="Country"
                />
                <CopyableField
                  fieldMap={fieldMap}
                  fieldKey="loadingDate"
                  label="Date"
                />
                <CopyableField
                  fieldMap={fieldMap}
                  fieldKey="loadingCity"
                  label="City"
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
                />
                <CopyableField
                  fieldMap={fieldMap}
                  fieldKey="unloadingDate"
                  label="Date"
                />
                <CopyableField
                  fieldMap={fieldMap}
                  fieldKey="unloadingCity"
                  label="City"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 border-t pt-6">
          <h3 className="text-lg font-semibold">Documents</h3>
          <div className="grid gap-2">
            <h4 className="text-sm font-medium">Export Declaration</h4>
            <div className="grid gap-3 md:grid-cols-2">
              <CopyableField
                fieldMap={fieldMap}
                fieldKey="exportDeclarationReference"
                label="Reference"
              />
              <CopyableField
                fieldMap={fieldMap}
                fieldKey="exportDeclarationDate"
                label="Issuance Date"
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
              />
              <CopyableField
                fieldMap={fieldMap}
                fieldKey="billOfLadingDate"
                label="Issuance Date"
              />
            </div>
          </div>
        </div>
      </section>

      <details className="text-sm text-muted-foreground">
        <summary className="cursor-pointer font-medium">
          Uploaded documents
        </summary>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          {request.documents.map((document) => {
            const classification = analysis.documents.find(
              (item) => item.fileName === document.name
            )
            return (
              <button
                key={document.id}
                type="button"
                className="underline underline-offset-4 hover:text-foreground"
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
      </details>
      {downloadError ? (
        <p className="text-sm text-destructive">{downloadError}</p>
      ) : null}
    </div>
  )
}

function NewRequest({ rules }: { rules: MadagascarRule[] }) {
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
    try {
      const formData = new FormData()
      files.forEach((file) => formData.append("files", file))
      formData.set(
        "rules",
        JSON.stringify(rules.filter((rule) => rule.enabled))
      )
      const response = await fetch("/api/madagascar-bsc/analyze", {
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
      const now = new Date().toISOString()
      const request: MadagascarRequest = {
        id: createMadagascarId("mgbsc"),
        reference: requestReference(payload.analysis),
        country: payload.analysis.consigneeCountry || "Unknown",
        status: analysisHasIssues(payload.analysis) ? "Needs review" : "Ready",
        documents: files.map((file) => ({
          id: createMadagascarId("document"),
          name: file.name,
          type: file.type,
          size: file.size,
          storagePath: "",
        })),
        analysis: payload.analysis,
        createdAt: now,
        updatedAt: now,
      }
      setSavedRequest(await saveMadagascarRequest(request, files))
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not analyze documents."
      )
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
        <CardTitle>New Madagascar BSC Request</CardTitle>
        <CardDescription>
          Upload the shipment documents together. AI classifies, extracts,
          compares, and validates them against the active rules.
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
            Drag and drop Madagascar documents
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
            {isAnalyzing ? "Analyzing documents..." : "Analyze Request"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Requests() {
  const router = useRouter()
  const [selectedId, setSelectedId] = React.useState("")
  const [requests, setRequests] = React.useState(loadCachedMadagascarRequests)
  const [isLoading, setIsLoading] = React.useState(!requests.length)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedFilter, setSelectedFilter] = React.useState("all")

  React.useEffect(() => {
    let mounted = true
    setSelectedId(new URLSearchParams(window.location.search).get("id") ?? "")
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

  const selected = requests.find((request) => request.id === selectedId)
  if (selected) return <AnalysisView request={selected} />

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
    setSelectedId(id)
    router.push(`/madagascar-bsc/requests?id=${encodeURIComponent(id)}`)
  }

  return (
    <div className="grid min-h-0 gap-4">
      <CountryTableFilters
        searchQuery={searchQuery}
        searchPlaceholder="Search requests..."
        searchAriaLabel="Search BSC requests"
        selectedFilter={selectedFilter}
        filterOptions={filterOptions}
        mobileFiltersFullWidth
        action={
          <Button
            variant="outline"
            size="lg"
            render={<AppLink href="/madagascar-bsc/new" />}
          >
            <PlusIcon />
            New Request
          </Button>
        }
        onSearchQueryChange={setSearchQuery}
        onSelectedFilterChange={setSelectedFilter}
      />

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-background">
        {isLoading ? (
          <div className="grid gap-3 p-4">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : (
          <div className="h-full min-h-0 touch-pan-x overflow-auto md:overflow-x-hidden md:overflow-y-auto">
            <Table
              className="min-w-[68rem] table-fixed text-xs md:w-full md:min-w-0"
              containerClassName="overflow-visible md:overflow-x-hidden"
            >
              <TableHeader>
                <TableRow>
                  <TableHead>Request</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Documents</TableHead>
                  <TableHead>Issues</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((request) => (
                  <TableRow
                    key={request.id}
                    className="h-14 cursor-pointer"
                    tabIndex={0}
                    onClick={() => openRequest(request.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        openRequest(request.id)
                      }
                    }}
                  >
                    <TableCell className="align-top font-medium hover:underline">
                      {request.reference}
                    </TableCell>
                    <TableCell className="align-top text-muted-foreground">
                      {new Date(request.updatedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge variant={statusVariant(request.status)}>
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="align-top">
                      <CountryCell country={request.country || "Unknown"} />
                    </TableCell>
                    <TableCell className="align-top">
                      {request.documents.length}
                    </TableCell>
                    <TableCell className="align-top">
                      {request.analysis.issues.length}
                    </TableCell>
                  </TableRow>
                ))}
                {!filteredRequests.length ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No matching BSC requests.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}

function Rules() {
  const [rules, setRules] = React.useState(loadCachedMadagascarRules)
  const [rejectionReason, setRejectionReason] = React.useState("")
  const [message, setMessage] = React.useState("")
  const [isReviewing, setIsReviewing] = React.useState(false)

  const refreshRules = React.useCallback(async () => {
    setRules(await listMadagascarRules())
  }, [])

  React.useEffect(() => {
    void refreshRules()
  }, [refreshRules])

  const groups = rules.reduce<Map<string, MadagascarRule[]>>((next, rule) => {
    const group = next.get(rule.documentType) ?? []
    group.push(rule)
    next.set(rule.documentType, group)
    return next
  }, new Map())
  const documentOrder: MadagascarRule["documentType"][] = [
    "Bill of Lading",
    "Commercial Invoice",
    "Packing List",
    "Export/Customs Declaration",
    "Freight Invoice",
    "Cross-document",
  ]
  const orderedGroups = documentOrder
    .map(
      (documentType) => [documentType, groups.get(documentType) ?? []] as const
    )
    .filter(([, groupRules]) => groupRules.length)

  async function reviewRejection() {
    setIsReviewing(true)
    setMessage("")
    try {
      const payload = await fetchJsonWithTimeout<{
        ok: boolean
        message?: string
        decision?: {
          action: "update" | "create" | "delete" | "no_change"
          relationship:
            | "same_rule"
            | "different_section"
            | "new_rule"
            | "remove_information"
            | "no_change"
          matchedRuleId: string | null
          documentType: MadagascarRule["documentType"]
          title: string
          instruction: string
          explanation: string
        }
      }>(
        "/api/madagascar-bsc/rules/classify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rejectionReason, rules }),
        },
        50_000
      )
      if (!payload.ok || !payload.decision) {
        throw new Error(
          payload.message || "Could not review the rejection reason."
        )
      }
      const existing = rules.find(
        (rule) => rule.id === payload.decision?.matchedRuleId
      )
      if (payload.decision.action === "delete" && existing) {
        await deleteMadagascarRule(existing.id)
      } else if (payload.decision.action !== "no_change") {
        await saveMadagascarRule({
          ...existing,
          id: payload.decision.action === "update" ? existing?.id : undefined,
          documentType: payload.decision.documentType,
          title: payload.decision.title,
          instruction: payload.decision.instruction,
          enabled: existing?.enabled ?? true,
        })
      }
      setRejectionReason("")
      setMessage(payload.decision.explanation)
      await refreshRules()
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save the rule."
      )
    } finally {
      setIsReviewing(false)
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Madagascar BSC Validation Rules</CardTitle>
          <CardDescription>
            One running set of polished notes applied to every new request
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {orderedGroups.map(([documentType, groupRules]) => (
            <section key={documentType} className="space-y-5">
              <h2 className="border-b pb-2 text-xl font-semibold tracking-tight">
                {documentType}
              </h2>
              {groupRules.map((rule) => (
                <article key={rule.id} className="space-y-2">
                  <h3 className="font-semibold">{rule.title}</h3>
                  <p className="text-sm leading-6 whitespace-pre-wrap text-muted-foreground">
                    {rule.instruction}
                  </p>
                </article>
              ))}
            </section>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Refine These Notes</CardTitle>
          <CardDescription>
            Paste a rejection reason, correction, addition, or removal. AI will
            compare the full document, choose the right section, and polish the
            notes above without duplicating rules.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Textarea
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            placeholder="Paste the rejection reason..."
            className="min-h-28"
          />
          {message ? (
            <p className="text-sm text-muted-foreground">{message}</p>
          ) : null}
          <div className="flex justify-end">
            <Button
              onClick={reviewRejection}
              disabled={!rejectionReason.trim() || isReviewing}
            >
              <SendIcon />
              {isReviewing ? "Reviewing..." : "Polish Rules"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function MadagascarBscView({ section }: { section: Section }) {
  const [rules, setRules] = React.useState(loadCachedMadagascarRules)

  React.useEffect(() => {
    if (section === "new") {
      void listMadagascarRules().then(setRules)
    }
  }, [section])

  const title =
    section === "new"
      ? "Madagascar BSC — New Request"
      : section === "requests"
        ? "Madagascar BSC — Requests"
        : "Madagascar BSC — AI Rules"

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
          <SiteHeader title={title} />
          <div className="grid gap-4 px-4 py-4 pb-28 md:pb-4 lg:px-6">
            {section === "new" ? <NewRequest rules={rules} /> : null}
            {section === "requests" ? <Requests /> : null}
            {section === "rules" ? <Rules /> : null}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
