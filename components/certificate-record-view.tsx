"use client"

import * as React from "react"
import { AppLink } from "@/components/app-link"
import { format } from "date-fns"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  ClipboardCheckIcon,
  DownloadIcon,
  DollarSignIcon,
  ExternalLinkIcon,
  FileIcon,
  FileTextIcon,
  MailIcon,
  MinusIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PinIcon,
  PlusIcon,
  SendIcon,
  TrashIcon,
  UploadCloudIcon,
  XIcon,
} from "lucide-react"

import CardBreadcrumb from "@/components/blocks/components/breadcrumbs/card-breadcrumb"
import { CountryCell } from "@/components/country-cell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent } from "@/components/ui/card"
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
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { agentProfileNames, getAgentProfileUrl } from "@/lib/agents"

export type ShipmentRow = {
  id: number
  billOfLading: string
  lastUpdated: string
  status: string
  country: string
  client: string
  invoiceNumber: string
  invoicePaid: boolean
  correctionInvoiceNumber?: string
  correctionInvoicePaid?: boolean
  agent: string
}

const workflowStatuses = [
  "Initiated",
  "Draft Available",
  "Draft Approved",
  "Paid",
  "Validation Submitted",
  "Complete",
] as const

const workflowIcons = [
  FileTextIcon,
  PencilIcon,
  ClipboardCheckIcon,
  DollarSignIcon,
  SendIcon,
  CheckIcon,
]

const countryOptions = [
  "Angola",
  "Benin",
  "Burkina Faso",
  "Burundi",
  "Cameroon",
  "Central African Republic",
  "Chad",
  "Djibouti",
  "DR Congo",
  "Egypt",
  "Equatorial Guinea",
  "Gabon",
  "Guinea Bissau",
  "Ivory Coast",
  "Liberia",
  "Madagascar",
  "Mali",
  "Niger",
  "Republic of Congo",
  "Republic of Guinea",
  "Senegal",
  "Sierra Leone",
  "Somalia",
  "South Sudan",
  "Sudan",
  "Togo",
]

const statusOptions = [
  "Initiated",
  "Pending",
  "Missing Docs",
  "Draft Available",
  "Changes Needed",
  "Draft Approved",
  "Validation Submitted",
  "Completed",
  "Rejected",
  "Cancelled",
]

const agentOptions = agentProfileNames

const territoryOptions = ["In Territory", "Out of Territory"]

const invoiceShipmentTypeOptions = [
  {
    value: "container",
    label: "Container",
    items: [
      { id: "20-container", name: "20' Container", unitPrice: 125 },
      { id: "40-container", name: "40' Container", unitPrice: 185 },
      { id: "40-hc-container", name: "40' HC Container", unitPrice: 210 },
    ],
  },
  {
    value: "vehicle",
    label: "Vehicle",
    items: [
      { id: "car", name: "Passenger Vehicle", unitPrice: 125 },
      { id: "truck", name: "Truck", unitPrice: 175 },
      { id: "equipment", name: "Heavy Equipment", unitPrice: 225 },
    ],
  },
  {
    value: "breakbulk",
    label: "Breakbulk",
    items: [
      { id: "loose-cargo", name: "Loose Cargo", unitPrice: 95 },
      { id: "palletized-cargo", name: "Palletized Cargo", unitPrice: 115 },
      { id: "project-cargo", name: "Project Cargo", unitPrice: 250 },
    ],
  },
]

type InvoiceShipmentType = (typeof invoiceShipmentTypeOptions)[number]["value"]
type InvoiceItemDraft = {
  id: string
  name: string
  unitPrice: number
  quantity: number
}

const documentTypeOptions = [
  "Bill of Lading",
  "Commercial Invoice",
  "Freight Invoice",
  "Draft",
  "Invoice",
  "Validation",
]

const sampleZohoTickets = [
  {
    ticketNumber: "81231700000000001",
    assignee: "Eddie Lake",
    contactName: "Atlantic Metals",
    subject: "Draft certificate clarification",
    lastCustomerResponse: "Today 9:14 AM",
    status: "Open",
  },
  {
    ticketNumber: "81231700000000042",
    assignee: "Kristal Koski",
    contactName: "Blue Harbor Logistics",
    subject: "Invoice payment confirmation",
    lastCustomerResponse: "Yesterday 4:22 PM",
    status: "Pending",
  },
  {
    ticketNumber: "81231700000000077",
    assignee: "Damien McConnell",
    contactName: "Westline Trading",
    subject: "Missing bill of lading attachment",
    lastCustomerResponse: "Aug 18 11:03 AM",
    status: "Awaiting Docs",
  },
]

const sampleSentMessages = [
  {
    id: "sent-1",
    subject: "Draft certificate ready for review",
    sentAt: "Today 10:42 AM",
    recipient: "wfp.us@scangl.com",
    body: "Please find the draft certificate attached for your review. Let us know if any changes are needed before approval.",
  },
  {
    id: "sent-2",
    subject: "Invoice payment confirmation",
    sentAt: "Yesterday 3:18 PM",
    recipient: "ap@atlanticmetals.example",
    body: "We have received the payment confirmation and will continue processing the validation once the draft is approved.",
  },
  {
    id: "sent-3",
    subject: "Missing document request",
    sentAt: "Aug 18 9:06 AM",
    recipient: "wfp.us@scangl.com",
    body: "The commercial invoice is still needed before this certificate can move forward. Please attach it when available.",
  },
]

type UploadedDocument = {
  id: string
  file: File
  previewUrl: string
  title: string
  type: string
}

type RecordComment = {
  id: string
  text: string
  author: "me" | "other"
  createdAt: string
  pinned: boolean
}

type PendingDocuments = Record<string, File[]>

type EditableRecordState = {
  customerName: string
  agent: string
  country: string
  status: string
  territory: string
  reviewedByAgent: string
  customerReference: string
  billOfLading: string
  ctnNumber: string
  invoiceNumber: string
  invoicePaid: boolean
  correctionInvoiceNumber: string
  correctionInvoicePaid: boolean
  zohoTicketId: string
  etdDate?: Date
  etaDate?: Date
}

type DropdownField =
  | "agent"
  | "country"
  | "territory"
  | "status"
  | "reviewedByAgent"

type RecordPanel = "summary" | "comments" | "linked-shipments" | "sent-messages"

const statusPillClasses: Record<string, string> = {
  Initiated:
    "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  Pending:
    "border-sky-200 bg-sky-200 text-sky-900 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300",
  "Missing Docs":
    "border-rose-200 bg-rose-100 text-rose-600 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
  "Draft Available":
    "border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300",
  "Changes Needed":
    "border-red-200 bg-red-100 text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
  "Draft Approved":
    "border-green-200 bg-green-100 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300",
  "Validation Submitted":
    "border-emerald-950 bg-slate-800 text-lime-300 dark:border-lime-900 dark:bg-slate-900 dark:text-lime-300",
  Completed:
    "border-green-200 bg-green-100 text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300",
  Rejected:
    "border-red-200 bg-red-100 text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
  Cancelled:
    "border-purple-200 bg-purple-100 text-purple-700 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-300",
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={`max-w-full justify-start overflow-hidden text-left text-ellipsis whitespace-nowrap ${statusPillClasses[status] ?? "text-muted-foreground"}`}
    >
      {status}
    </Badge>
  )
}

function DatePickerField({
  date,
  label,
  onActivate,
  onSelect,
}: {
  date?: Date
  label: string
  onActivate?: () => void
  onSelect: (date?: Date) => void
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            data-empty={!date}
            className="w-full cursor-pointer justify-start text-left font-normal data-[empty=true]:text-muted-foreground"
            onClick={() => onActivate?.()}
          />
        }
      >
        <CalendarIcon />
        {date ? format(date, "PPP") : <span>{label}</span>}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(selectedDate) => {
            onActivate?.()
            onSelect(selectedDate)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

function normalizeWorkflowStatus(status: string) {
  if (status === "Completed") return "Complete"
  if (workflowStatuses.some((workflowStatus) => workflowStatus === status)) {
    return status
  }

  return "Initiated"
}

function getRecordTimestamp(shipment: ShipmentRow) {
  const [year = "", month = "", day = ""] = shipment.lastUpdated.split("-")
  const shortDate = `${Number(month)}/${Number(day)}/${year.slice(-2)}`
  const hour = 9 + (shipment.id % 8)
  const minute = (shipment.id * 7) % 60
  const formattedHour = hour > 12 ? hour - 12 : hour
  const formattedMinute = String(minute).padStart(2, "0")
  const period = hour >= 12 ? "PM" : "AM"

  return `${shortDate} ${formattedHour}:${formattedMinute} ${period}`
}

function getInitialRecordState(shipment: ShipmentRow): EditableRecordState {
  return {
    customerName: shipment.client,
    agent: shipment.agent,
    country: shipment.country,
    status: shipment.status,
    territory: "In Territory",
    reviewedByAgent: "No",
    customerReference: shipment.billOfLading.replace("BOL-", ""),
    billOfLading: shipment.billOfLading,
    ctnNumber: "",
    invoiceNumber: shipment.invoiceNumber,
    invoicePaid: shipment.invoicePaid,
    correctionInvoiceNumber: shipment.correctionInvoiceNumber ?? "",
    correctionInvoicePaid: Boolean(shipment.correctionInvoicePaid),
    zohoTicketId: "81231700000000001",
    etdDate: undefined,
    etaDate: undefined,
  }
}

export function CertificateRecordView({
  shipment,
}: {
  shipment: ShipmentRow
}) {
  const [isEditing, setIsEditing] = React.useState(false)
  const [editOrigin, setEditOrigin] = React.useState<"summary" | "sidebar">()
  const [uploadedDocuments, setUploadedDocuments] = React.useState<
    UploadedDocument[]
  >([])
  const uploadedDocumentsRef = React.useRef<UploadedDocument[]>([])
  const [isAddingDocument, setIsAddingDocument] = React.useState(false)
  const [pendingDocuments, setPendingDocuments] =
    React.useState<PendingDocuments>({})
  const [editingDocumentId, setEditingDocumentId] = React.useState<string>()
  const [editingDocumentTitle, setEditingDocumentTitle] = React.useState("")
  const [editingDocumentType, setEditingDocumentType] = React.useState("")
  const [previewDocumentId, setPreviewDocumentId] = React.useState<string>()
  const [requestedDocumentType, setRequestedDocumentType] =
    React.useState<string>()
  const [advanceMessage, setAdvanceMessage] = React.useState("")
  const [isSelectingZohoTicket, setIsSelectingZohoTicket] =
    React.useState(false)
  const [isComposingZohoEmail, setIsComposingZohoEmail] =
    React.useState(false)
  const [zohoTicketDraft, setZohoTicketDraft] = React.useState("")
  const [zohoEmailTemplate, setZohoEmailTemplate] = React.useState("")
  const [zohoEmailMessage, setZohoEmailMessage] = React.useState("")
  const [savedRecord, setSavedRecord] = React.useState<EditableRecordState>(
    () => getInitialRecordState(shipment)
  )
  const [draftRecord, setDraftRecord] = React.useState<EditableRecordState>(
    () => getInitialRecordState(shipment)
  )
  const [activeDropdownField, setActiveDropdownField] =
    React.useState<DropdownField>()
  const [openDropdownField, setOpenDropdownField] =
    React.useState<DropdownField>()
  const [recordComments, setRecordComments] = React.useState<RecordComment[]>(
    []
  )
  const [newComment, setNewComment] = React.useState("")
  const [editingCommentId, setEditingCommentId] = React.useState<string>()
  const [editingCommentText, setEditingCommentText] = React.useState("")
  const commentsEndRef = React.useRef<HTMLDivElement>(null)
  const [activeSecondaryPanel, setActiveSecondaryPanel] =
    React.useState<RecordPanel>("summary")
  const [isCreatingInvoice, setIsCreatingInvoice] = React.useState(false)
  const [invoiceShipmentType, setInvoiceShipmentType] =
    React.useState<InvoiceShipmentType>("container")
  const [invoiceItems, setInvoiceItems] = React.useState<InvoiceItemDraft[]>(
    () =>
      invoiceShipmentTypeOptions[0].items.map((item) => ({
        ...item,
        quantity: 0,
      }))
  )
  const workflowStatus = normalizeWorkflowStatus(draftRecord.status)
  const activeStepIndex = workflowStatuses.findIndex(
    (status) => status === workflowStatus
  )
  const recordTimestamp = getRecordTimestamp(shipment)
  const workflowSteps = workflowStatuses.map((status, index) => ({
    label:
      status === "Paid" && !draftRecord.invoicePaid
        ? "Not Paid"
        : status,
    type: status,
    date:
      status === "Paid"
        ? draftRecord.invoicePaid
          ? recordTimestamp
          : undefined
        : index <= activeStepIndex
          ? recordTimestamp
          : undefined,
    icon: workflowIcons[index],
    complete: status === "Paid" ? draftRecord.invoicePaid : undefined,
  }))
  React.useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ block: "end" })
  }, [recordComments.length])
  const correctionInvoiceNumber = draftRecord.correctionInvoiceNumber
  const invoiceInputClass = (invoicePaid: boolean) =>
    invoicePaid
      ? "cursor-pointer border-green-200 bg-green-50 text-green-700 disabled:opacity-100 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
      : "cursor-pointer border-red-200 bg-red-50 text-red-700 disabled:opacity-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
  const invoiceTotal = invoiceItems.reduce(
    (total, item) => total + item.quantity * item.unitPrice,
    0
  )
  const updateInvoiceShipmentType = (value: InvoiceShipmentType) => {
    const selectedType = invoiceShipmentTypeOptions.find(
      (option) => option.value === value
    )

    setInvoiceShipmentType(value)
    setInvoiceItems(
      (selectedType ?? invoiceShipmentTypeOptions[0]).items.map((item) => ({
        ...item,
        quantity: 0,
      }))
    )
  }
  const updateInvoiceItemQuantity = (itemId: string, quantity: number) => {
    setInvoiceItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              quantity: Math.max(0, quantity),
            }
          : item
      )
    )
  }
  const startInvoiceCreation = () => {
    setActiveSecondaryPanel("summary")
    setIsSelectingZohoTicket(false)
    setIsComposingZohoEmail(false)
    setIsCreatingInvoice(true)
    updateInvoiceShipmentType("container")
  }
  const cancelInvoiceCreation = () => {
    setIsCreatingInvoice(false)
    updateInvoiceShipmentType("container")
  }
  const saveInvoiceCreation = () => {
    const invoiceNumber = `INV-${String(91000 + shipment.id).padStart(5, "0")}`

    updateDraftRecord("invoiceNumber", invoiceNumber)
    updateDraftRecord("invoicePaid", false)
    setSavedRecord((currentRecord) => ({
      ...currentRecord,
      invoiceNumber,
      invoicePaid: false,
    }))
    setIsCreatingInvoice(false)
  }
  const startEntryEdit = (origin: "summary" | "sidebar" = "summary") => {
    if (!isEditing) {
      setIsEditing(true)
    }
    setEditOrigin(origin)
  }
  const startDropdownEdit = (field: DropdownField) => {
    startEntryEdit("sidebar")
    setActiveDropdownField(field)
    setOpenDropdownField(field)
  }
  const updateDraftRecord = <Key extends keyof EditableRecordState>(
    key: Key,
    value: EditableRecordState[Key]
  ) => {
    setDraftRecord((currentRecord) => ({
      ...currentRecord,
      [key]: value,
    }))
  }
  React.useEffect(() => {
    uploadedDocumentsRef.current = uploadedDocuments
  }, [uploadedDocuments])
  React.useEffect(
    () => () => {
      uploadedDocumentsRef.current.forEach((document) =>
        URL.revokeObjectURL(document.previewUrl)
      )
    },
    []
  )
  const createUploadedDocuments = (type: string, files: File[]) =>
    files.map((file) => ({
      id: `${type}-${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
      file,
      previewUrl: URL.createObjectURL(file),
      title: file.name,
      type,
    }))
  const handleDocumentUpload = (type: string, files: File[]) => {
    if (files.length) {
      setPendingDocuments((currentDocuments) => ({
        ...currentDocuments,
        [type]: [...(currentDocuments[type] ?? []), ...files],
      }))
    }
  }
  const handleDocumentInputChange = (
    type: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files ?? [])

    handleDocumentUpload(type, files)

    event.target.value = ""
  }
  const handleDocumentDrop = (
    type: string,
    event: React.DragEvent<HTMLLabelElement>
  ) => {
    event.preventDefault()
    handleDocumentUpload(type, Array.from(event.dataTransfer.files))
  }
  const saveAdvanceDocuments = (type: string, files: File[]) => {
    if (!files.length) return

    const documentsToSave = createUploadedDocuments(type, files)

    setUploadedDocuments((currentDocuments) => [
      ...currentDocuments,
      ...documentsToSave,
    ])

    if (draftRecord.status === "Initiated" && type === "Draft") {
      updateDraftRecord("status", "Draft Available")
      setSavedRecord((currentRecord) => ({
        ...currentRecord,
        status: "Draft Available",
      }))
      setAdvanceMessage("Draft uploaded. Status advanced to Draft Available.")
    } else if (
      draftRecord.status === "Validation Submitted" &&
      type === "Validation"
    ) {
      updateDraftRecord("status", "Completed")
      setSavedRecord((currentRecord) => ({
        ...currentRecord,
        status: "Completed",
      }))
      setAdvanceMessage("Validation uploaded. Status advanced to Complete.")
    }

    setPendingDocuments({})
    setRequestedDocumentType(undefined)
  }
  const handleAdvanceDocumentInputChange = (
    type: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    saveAdvanceDocuments(type, Array.from(event.target.files ?? []))
    event.target.value = ""
  }
  const handleAdvanceDocumentDrop = (
    type: string,
    event: React.DragEvent<HTMLLabelElement>
  ) => {
    event.preventDefault()
    saveAdvanceDocuments(type, Array.from(event.dataTransfer.files))
  }
  const savePendingDocuments = () => {
    const documentsToSave = Object.entries(pendingDocuments).flatMap(
      ([type, files]) => createUploadedDocuments(type, files)
    )

    if (documentsToSave.length) {
      setUploadedDocuments((currentDocuments) => [
        ...currentDocuments,
        ...documentsToSave,
      ])
    }

    setPendingDocuments({})
    setIsAddingDocument(false)
  }
  const cancelPendingDocuments = () => {
    setPendingDocuments({})
    setIsAddingDocument(false)
  }
  const cancelAdvanceDocumentUpload = () => {
    setPendingDocuments({})
    setRequestedDocumentType(undefined)
    setAdvanceMessage("")
  }
  const startEditingDocument = (document: UploadedDocument) => {
    setEditingDocumentId(document.id)
    setEditingDocumentTitle(document.title)
    setEditingDocumentType(document.type)
  }
  const cancelEditingDocument = () => {
    setEditingDocumentId(undefined)
    setEditingDocumentTitle("")
    setEditingDocumentType("")
  }
  const saveEditingDocument = (documentId: string) => {
    setUploadedDocuments((currentDocuments) =>
      currentDocuments.map((document) =>
        document.id === documentId
          ? {
              ...document,
              title: editingDocumentTitle.trim() || document.file.name,
              type: editingDocumentType || document.type,
            }
          : document
      )
    )
    cancelEditingDocument()
  }
  const deleteDocument = (documentId: string) => {
    const documentToDelete = uploadedDocuments.find(
      (document) => document.id === documentId
    )

    if (documentToDelete) {
      URL.revokeObjectURL(documentToDelete.previewUrl)
    }

    setUploadedDocuments((currentDocuments) =>
      currentDocuments.filter((document) => document.id !== documentId)
    )
    if (previewDocumentId === documentId) {
      setPreviewDocumentId(undefined)
    }
    if (editingDocumentId === documentId) {
      cancelEditingDocument()
    }
  }
  const toggleDocumentPreview = (documentId: string) => {
    setPreviewDocumentId((currentDocumentId) =>
      currentDocumentId === documentId ? undefined : documentId
    )
  }
  const downloadDocument = (document: UploadedDocument) => {
    const link = window.document.createElement("a")

    link.href = document.previewUrl
    link.download = document.title || document.file.name
    link.click()
  }
  const hasUploadedDocumentType = (type: string) =>
    uploadedDocuments.some((document) => document.type === type)
  const requestDocumentBeforeAdvancing = (type: string, message: string) => {
    setRequestedDocumentType(type)
    setAdvanceMessage(message)
    setPendingDocuments({})
    setIsAddingDocument(false)
    setIsSelectingZohoTicket(false)
    setIsComposingZohoEmail(false)
  }
  const showRecordPanel = (panel: RecordPanel) => {
    setActiveSecondaryPanel(panel)
    setIsSelectingZohoTicket(false)
    setIsComposingZohoEmail(false)
    setIsCreatingInvoice(false)
  }
  const openZohoTicketSelector = () => {
    setActiveSecondaryPanel("summary")
    setIsSelectingZohoTicket(true)
    setIsComposingZohoEmail(false)
    setRequestedDocumentType(undefined)
    setAdvanceMessage("")
    setZohoTicketDraft(draftRecord.zohoTicketId)
  }
  const cancelZohoTicketSelector = () => {
    setIsSelectingZohoTicket(false)
    setZohoTicketDraft("")
  }
  const linkZohoTicket = () => {
    const ticketNumber = zohoTicketDraft.trim()

    if (!ticketNumber) return

    updateDraftRecord("zohoTicketId", ticketNumber)
    setSavedRecord((currentRecord) => ({
      ...currentRecord,
      zohoTicketId: ticketNumber,
    }))
    setIsSelectingZohoTicket(false)
    setIsComposingZohoEmail(true)
  }
  const closeZohoEmailComposer = () => {
    setIsComposingZohoEmail(false)
    setZohoEmailTemplate("")
    setZohoEmailMessage("")
  }
  const sendZohoEmail = () => {
    closeZohoEmailComposer()
  }
  const handleMessageClick = () => {
    if (draftRecord.zohoTicketId.trim()) {
      setActiveSecondaryPanel("summary")
      setIsComposingZohoEmail(true)
      setIsSelectingZohoTicket(false)
      setRequestedDocumentType(undefined)
      setAdvanceMessage("")
      return
    }

    openZohoTicketSelector()
  }
  const advanceStatus = () => {
    setAdvanceMessage("")

    if (draftRecord.status === "Initiated") {
      if (!hasUploadedDocumentType("Draft")) {
        requestDocumentBeforeAdvancing(
          "Draft",
          "Upload the draft before advancing to Draft Available."
        )
        return
      }

      updateDraftRecord("status", "Draft Available")
      setSavedRecord((currentRecord) => ({
        ...currentRecord,
        status: "Draft Available",
      }))
      return
    }

    if (draftRecord.status === "Draft Available") {
      updateDraftRecord("status", "Draft Approved")
      setSavedRecord((currentRecord) => ({
        ...currentRecord,
        status: "Draft Approved",
      }))
      return
    }

    if (draftRecord.status === "Draft Approved") {
      if (!draftRecord.invoicePaid) {
        setAdvanceMessage(
          "Invoice must be marked paid before advancing to Validation Submitted."
        )
        return
      }

      updateDraftRecord("status", "Validation Submitted")
      setSavedRecord((currentRecord) => ({
        ...currentRecord,
        status: "Validation Submitted",
      }))
      return
    }

    if (draftRecord.status === "Validation Submitted") {
      if (!hasUploadedDocumentType("Validation")) {
        requestDocumentBeforeAdvancing(
          "Validation",
          "Upload the validation before advancing to Complete."
        )
        return
      }

      updateDraftRecord("status", "Completed")
      setSavedRecord((currentRecord) => ({
        ...currentRecord,
        status: "Completed",
      }))
      return
    }

    setAdvanceMessage("This record cannot be advanced from the current status.")
  }
  const handlePrimaryAction = () => {
    if (isEditing) {
      setSavedRecord(draftRecord)
      setIsEditing(false)
      setActiveDropdownField(undefined)
      setOpenDropdownField(undefined)
      setEditOrigin(undefined)
      return
    }

    advanceStatus()
  }
  const cancelEntryEdit = () => {
    setDraftRecord(savedRecord)
    setIsEditing(false)
    setActiveDropdownField(undefined)
    setOpenDropdownField(undefined)
    setEditOrigin(undefined)
  }
  const addRecordComment = () => {
    const trimmedComment = newComment.trim()

    if (!trimmedComment) return

    setRecordComments((currentComments) => [
      ...currentComments,
      {
        id: crypto.randomUUID(),
        text: trimmedComment,
        author: "me",
        createdAt: format(new Date(), "h:mm a"),
        pinned: false,
      },
    ])
    setNewComment("")
  }
  const startEditingComment = (comment: RecordComment) => {
    setEditingCommentId(comment.id)
    setEditingCommentText(comment.text)
  }
  const cancelEditingComment = () => {
    setEditingCommentId(undefined)
    setEditingCommentText("")
  }
  const saveEditingComment = (commentId: string) => {
    const trimmedComment = editingCommentText.trim()

    if (!trimmedComment) return

    setRecordComments((currentComments) =>
      currentComments.map((comment) =>
        comment.id === commentId
          ? {
              ...comment,
              text: trimmedComment,
            }
          : comment
      )
    )
    cancelEditingComment()
  }
  const deleteRecordComment = (commentId: string) => {
    setRecordComments((currentComments) =>
      currentComments.filter((comment) => comment.id !== commentId)
    )

    if (editingCommentId === commentId) {
      cancelEditingComment()
    }
  }
  const pinRecordComment = (commentId: string) => {
    setRecordComments((currentComments) =>
      currentComments.map((comment) => ({
        ...comment,
        pinned: comment.id === commentId,
      }))
    )
  }
  const unpinRecordComment = (commentId: string) => {
    setRecordComments((currentComments) =>
      currentComments.map((comment) =>
        comment.id === commentId
          ? {
              ...comment,
              pinned: false,
            }
          : comment
      )
    )
  }
  const hasPendingDocuments = Object.values(pendingDocuments).some(
    (files) => files.length > 0
  )
  const canSavePendingDocuments = hasPendingDocuments
  const nestedCardRadiusClass = "rounded-lg"
  const zohoTicketUrl = `https://desk.zoho.com/agent/africactnllc/info/tickets/details/${encodeURIComponent(
    draftRecord.zohoTicketId
  )}`
  const selectedZohoTicket = sampleZohoTickets.find(
    (ticket) => ticket.ticketNumber === zohoTicketDraft
  )
  const pinnedComment = recordComments.find((comment) => comment.pinned)

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-gutter:stable] xl:overflow-hidden">
      <div className="flex min-h-full flex-col gap-3 px-3 py-3 sm:px-4 sm:py-4 lg:gap-5 lg:px-6 xl:min-h-0 xl:flex-1">
        <div className="grid items-center gap-3 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon-sm"
              render={<AppLink href="/classic" />}
              aria-label="Back to entries"
            >
              <ArrowLeftIcon />
            </Button>
          </div>
          <div className="min-w-0 justify-self-stretch overflow-hidden">
            <CardBreadcrumb
              steps={workflowSteps}
              activeStepIndex={activeStepIndex}
            />
          </div>
          <div className="flex shrink-0 items-center gap-2 justify-self-end">
            {isComposingZohoEmail ? (
              <>
                <Button
                  variant="outline"
                  className="cursor-pointer"
                  onClick={closeZohoEmailComposer}
                >
                  <XIcon />
                  Cancel
                </Button>
                <Button className="cursor-pointer" onClick={sendZohoEmail}>
                  <SendIcon />
                  Send
                </Button>
              </>
            ) : !isEditing || editOrigin === "summary" ? (
              <>
              <Button
                variant="outline"
                className="cursor-pointer"
                onClick={handleMessageClick}
              >
                <MailIcon />
                Message
              </Button>
                <Button
                  className="cursor-pointer disabled:cursor-default"
                  onClick={handlePrimaryAction}
                  disabled={draftRecord.status === "Completed"}
                >
                  <ArrowRightIcon />
                  Advance
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {advanceMessage ? (
          <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
            {requestedDocumentType ? (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="space-y-3">
                  <div>
                    <p className="font-medium text-foreground">
                      {advanceMessage}
                    </p>
                    <p className="text-muted-foreground">
                      Drop the {requestedDocumentType.toLowerCase()} here or
                      choose a file.
                    </p>
                  </div>
                  <label
                    htmlFor="advance-document-upload"
                    className="hover:bg-background/80 flex min-h-28 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-primary bg-background px-4 text-center"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) =>
                      handleAdvanceDocumentDrop(requestedDocumentType, event)
                    }
                  >
                    <UploadCloudIcon className="text-muted-foreground mb-2 h-7 w-7" />
                    <span className="font-medium">
                      Upload {requestedDocumentType}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      PDF, Word, PNG, or JPG
                    </span>
                    <Input
                      id="advance-document-upload"
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,image/png,image/jpeg"
                      multiple
                      onChange={(event) =>
                        handleAdvanceDocumentInputChange(
                          requestedDocumentType,
                          event
                        )
                      }
                    />
                  </label>
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelAdvanceDocumentUpload}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">{advanceMessage}</p>
            )}
          </div>
        ) : null}

        <div className="grid flex-1 items-stretch gap-4 xl:min-h-0 xl:overflow-hidden xl:grid-cols-[300px_minmax(0,1fr)]">
          <div className="min-h-0">
            <Card
              size="sm"
              className="h-full rounded-lg border shadow-none ring-0"
            >
              <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden pr-1">
                  <div className="flex min-h-0 flex-1 flex-col divide-y pb-4">
                  <section className="space-y-1 pb-4 pt-1">
                  <div>
                    <AppLink
                      href={`/customers/${encodeURIComponent(draftRecord.customerName)}`}
                      className="block max-w-full truncate text-base font-semibold text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
                    >
                      {draftRecord.customerName}
                    </AppLink>
                    <p className="text-muted-foreground truncate text-sm">
                      wfp.us@scangl.com
                    </p>
                  </div>
                  </section>

                  <section className="space-y-3 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold">Shipment Details</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">Agent</span>
                      {isEditing && activeDropdownField === "agent" ? (
                        <Select
                          open={openDropdownField === "agent"}
                          onOpenChange={(open) =>
                            setOpenDropdownField(open ? "agent" : undefined)
                          }
                          value={draftRecord.agent}
                          onValueChange={(value) => {
                            if (value) updateDraftRecord("agent", value)
                          }}
                        >
                          <SelectTrigger className="h-8 min-w-52 cursor-pointer">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent align="start" className="min-w-60">
                            <SelectGroup>
                              {agentOptions.map((agent) => (
                                <SelectItem key={agent} value={agent}>
                                  {agent}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      ) : isEditing ? (
                        <button
                          type="button"
                          className="cursor-pointer truncate text-right font-medium"
                          onClick={() => startDropdownEdit("agent")}
                        >
                          {draftRecord.agent}
                        </button>
                      ) : draftRecord.agent !== "Assign agent" ? (
                        <AppLink
                          href={getAgentProfileUrl(draftRecord.agent)}
                          className="truncate text-right font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
                        >
                          {draftRecord.agent}
                        </AppLink>
                      ) : (
                        <span className="truncate text-right font-medium">
                          {draftRecord.agent}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">Country</span>
                      {isEditing && activeDropdownField === "country" ? (
                        <Select
                          open={openDropdownField === "country"}
                          onOpenChange={(open) =>
                            setOpenDropdownField(open ? "country" : undefined)
                          }
                          value={draftRecord.country}
                          onValueChange={(value) => {
                            if (value) updateDraftRecord("country", value)
                          }}
                        >
                          <SelectTrigger className="h-8 min-w-52 cursor-pointer">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent align="start" className="min-w-60">
                            <SelectGroup>
                              {countryOptions.map((country) => (
                                <SelectItem key={country} value={country}>
                                  <CountryCell country={country} />
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      ) : (
                        <button
                          type="button"
                          className="cursor-pointer"
                          onClick={() => startDropdownEdit("country")}
                        >
                          <CountryCell
                            country={draftRecord.country}
                            className="max-w-40 justify-end font-medium"
                          />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">Territory</span>
                      {isEditing && activeDropdownField === "territory" ? (
                        <Select
                          open={openDropdownField === "territory"}
                          onOpenChange={(open) =>
                            setOpenDropdownField(open ? "territory" : undefined)
                          }
                          value={draftRecord.territory}
                          onValueChange={(value) => {
                            if (value) updateDraftRecord("territory", value)
                          }}
                        >
                          <SelectTrigger className="h-8 min-w-52 cursor-pointer">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent align="start" className="min-w-60">
                            <SelectGroup>
                              {territoryOptions.map((territory) => (
                                <SelectItem key={territory} value={territory}>
                                  {territory}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      ) : (
                        <button
                          type="button"
                          className="cursor-pointer truncate text-right font-medium"
                          onClick={() => startDropdownEdit("territory")}
                        >
                          {draftRecord.territory}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">Status</span>
                      {isEditing && activeDropdownField === "status" ? (
                        <Select
                          open={openDropdownField === "status"}
                          onOpenChange={(open) =>
                            setOpenDropdownField(open ? "status" : undefined)
                          }
                          value={draftRecord.status}
                          onValueChange={(value) => {
                            if (value) updateDraftRecord("status", value)
                          }}
                        >
                          <SelectTrigger className="h-8 min-w-52 cursor-pointer">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent align="start" className="min-w-60">
                            <SelectGroup>
                              {statusOptions.map((status) => (
                                <SelectItem key={status} value={status}>
                                  <StatusBadge status={status} />
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      ) : (
                        <button
                          type="button"
                          className="cursor-pointer"
                          onClick={() => startDropdownEdit("status")}
                        >
                          <StatusBadge status={draftRecord.status} />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">
                        Reviewed by Agent
                      </span>
                      {isEditing && activeDropdownField === "reviewedByAgent" ? (
                        <Select
                          open={openDropdownField === "reviewedByAgent"}
                          onOpenChange={(open) =>
                            setOpenDropdownField(
                              open ? "reviewedByAgent" : undefined
                            )
                          }
                          value={draftRecord.reviewedByAgent}
                          onValueChange={(value) => {
                            if (value) {
                              updateDraftRecord("reviewedByAgent", value)
                            }
                          }}
                        >
                          <SelectTrigger className="h-8 min-w-52 cursor-pointer">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent align="start" className="min-w-60">
                            <SelectGroup>
                              {["Yes", "No"].map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      ) : (
                        <button
                          type="button"
                          className="cursor-pointer truncate text-right font-medium"
                          onClick={() => startDropdownEdit("reviewedByAgent")}
                        >
                          {draftRecord.reviewedByAgent}
                        </button>
                      )}
                    </div>
                  </div>
                  </section>

                  <section className="flex min-h-[360px] flex-1 flex-col gap-3 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold">Comments</h3>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">
                    <div className="space-y-2">
                      {recordComments.length ? (
                        recordComments.map((comment) => {
                          const isEditingComment =
                            editingCommentId === comment.id
                          const isOwnComment = comment.author === "me"
                          const commentAuthor = isOwnComment
                            ? "Alex Russell"
                            : "Damien McConnell"
                          const authorInitials = isOwnComment ? "AR" : "DM"

                          return (
                            <div
                              key={comment.id}
                              className={
                                comment.pinned
                                  ? "rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100"
                                  : "bg-muted/30 rounded-md border p-3 text-sm"
                              }
                            >
                              <div className="flex items-start gap-2">
                                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border bg-background text-[11px] font-medium text-foreground">
                                  {authorInitials}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                                    <span className="truncate font-semibold">
                                      {commentAuthor}
                                    </span>
                                    <span className="text-muted-foreground text-xs">
                                      {comment.createdAt}
                                    </span>
                                    {comment.pinned ? (
                                      <Badge
                                        variant="outline"
                                        className="h-5 shrink-0 border-blue-300 bg-blue-100 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100"
                                      >
                                        Pinned
                                      </Badge>
                                    ) : null}
                                  </div>

                                  {isEditingComment ? (
                                    <div className="mt-2 space-y-2">
                                      <Textarea
                                        value={editingCommentText}
                                        onChange={(event) =>
                                          setEditingCommentText(
                                            event.target.value
                                          )
                                        }
                                        className="min-h-20 resize-none text-sm"
                                        aria-label="Edit comment"
                                      />
                                      <div className="flex justify-end gap-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-8 cursor-pointer"
                                          onClick={cancelEditingComment}
                                        >
                                          Cancel
                                        </Button>
                                        <Button
                                          size="sm"
                                          className="h-8 cursor-pointer"
                                          onClick={() =>
                                            saveEditingComment(comment.id)
                                          }
                                          disabled={!editingCommentText.trim()}
                                        >
                                          Save
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="mt-1.5 whitespace-pre-wrap break-words leading-snug">
                                      {comment.text}
                                    </p>
                                  )}
                                </div>

                                {!isEditingComment ? (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger
                                      render={
                                        <Button
                                          variant="ghost"
                                          size="icon-sm"
                                          className="shrink-0 cursor-pointer"
                                          aria-label="Comment actions"
                                        />
                                      }
                                    >
                                      <MoreHorizontalIcon />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        onClick={() =>
                                          startEditingComment(comment)
                                        }
                                      >
                                        <PencilIcon />
                                        Edit
                                      </DropdownMenuItem>
                                      {comment.pinned ? (
                                        <DropdownMenuItem
                                          onClick={() =>
                                            unpinRecordComment(comment.id)
                                          }
                                        >
                                          <PinIcon />
                                          Unpin
                                        </DropdownMenuItem>
                                      ) : (
                                        <DropdownMenuItem
                                          onClick={() =>
                                            pinRecordComment(comment.id)
                                          }
                                        >
                                          <PinIcon />
                                          Pin
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuItem
                                        variant="destructive"
                                        onClick={() =>
                                          deleteRecordComment(comment.id)
                                        }
                                      >
                                        <TrashIcon />
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                ) : null}
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <p className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
                          No comments yet.
                        </p>
                      )}
                    </div>
                    <div ref={commentsEndRef} />
                  </div>
                  <div className="shrink-0 border-t pt-3">
                    <div className="flex min-w-0 items-end gap-2 rounded-xl bg-muted p-1.5">
                      <Textarea
                        value={newComment}
                        onChange={(event) => setNewComment(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && event.ctrlKey) {
                            event.preventDefault()
                            addRecordComment()
                          }
                        }}
                        placeholder="Add a comment..."
                        className="max-h-24 min-h-9 min-w-0 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0"
                      />
                      <Button
                        size="sm"
                        className="h-8 shrink-0 cursor-pointer px-3"
                        onClick={addRecordComment}
                        disabled={!newComment.trim()}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                  </section>

                  </div>

                </div>

                  {isEditing && editOrigin === "sidebar" ? (
                  <div className="sticky bottom-0 -mx-4 border-t bg-card px-4 pt-4">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-w-0 cursor-pointer px-2"
                        onClick={cancelEntryEdit}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="min-w-0 cursor-pointer px-2"
                        onClick={handlePrimaryAction}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                  ) : null}
              </CardContent>
            </Card>
          </div>

          <div className="flex min-h-0 min-w-0 flex-col gap-3">
          {pinnedComment ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
              <p className="min-w-0 truncate">
                <span className="font-medium">Pinned comment: </span>
                {pinnedComment.text}
              </p>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0 cursor-pointer text-blue-950 hover:bg-blue-100 dark:text-blue-100 dark:hover:bg-blue-900/40"
                      aria-label="Pinned comment actions"
                    />
                  }
                >
                  <MoreHorizontalIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => unpinRecordComment(pinnedComment.id)}
                  >
                    <PinIcon />
                    Unpin
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}

          <Card className="min-h-0 min-w-0 flex-1 rounded-lg border shadow-none ring-0">
            <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {!isComposingZohoEmail ? (
                <div className="flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
                  <Tabs
                    value={activeSecondaryPanel}
                    onValueChange={(value) => showRecordPanel(value as RecordPanel)}
                    className="min-w-0 flex-1 gap-0"
                  >
                    <TabsList
                      variant="line"
                      className="max-w-full justify-start overflow-x-auto"
                    >
                      <TabsTrigger value="summary" className="cursor-pointer">
                        Submission Summary
                      </TabsTrigger>
                      <TabsTrigger
                        value="sent-messages"
                        className="cursor-pointer"
                      >
                        Sent Messages
                      </TabsTrigger>
                      <TabsTrigger
                        value="linked-shipments"
                        className="cursor-pointer"
                      >
                        Linked Shipments
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  {isEditing && editOrigin === "summary" ? (
                    <ButtonGroup className="shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="cursor-pointer"
                        onClick={cancelEntryEdit}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="cursor-pointer"
                        onClick={handlePrimaryAction}
                      >
                        Save
                      </Button>
                    </ButtonGroup>
                  ) : null}
                </div>
              ) : null}

              {isSelectingZohoTicket ? (
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pt-4 [scrollbar-gutter:stable]">
                  <div className={`${nestedCardRadiusClass} space-y-4 border p-4`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium text-foreground">
                          Select Zoho ticket
                        </p>
                        <p className="text-muted-foreground text-sm">
                          Choose an open ticket or link a ticket number to this record.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="cursor-pointer"
                          onClick={cancelZohoTicketSelector}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                      <div className="space-y-2">
                        <FieldLabel htmlFor="zoho-ticket-selector">
                          Ticket Number
                        </FieldLabel>
                        <Input
                          id="zoho-ticket-selector"
                          value={zohoTicketDraft}
                          onChange={(event) =>
                            setZohoTicketDraft(event.target.value)
                          }
                          placeholder="Enter or create a Zoho ticket number"
                        />
                      </div>
                      <Button
                        variant={selectedZohoTicket ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          if (selectedZohoTicket) {
                            linkZohoTicket()
                            return
                          }

                          setZohoTicketDraft("NEW-ZOHO-TICKET")
                        }}
                      >
                        {selectedZohoTicket ? "Link Ticket" : "Create Ticket"}
                      </Button>
                    </div>

                    <Table
                      className="table-fixed"
                      containerClassName="overflow-hidden rounded-md border bg-background"
                    >
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[22%]">
                            Ticket Number
                          </TableHead>
                          <TableHead className="w-[16%]">Assignee</TableHead>
                          <TableHead className="w-[18%]">
                            Contact Name
                          </TableHead>
                          <TableHead className="w-[28%]">Subject</TableHead>
                          <TableHead className="w-[16%]">
                            Last response
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sampleZohoTickets.map((ticket) => {
                          const isSelected =
                            zohoTicketDraft === ticket.ticketNumber

                          return (
                            <TableRow
                              key={ticket.ticketNumber}
                              className={
                                isSelected
                                  ? "cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
                                  : "cursor-pointer"
                              }
                              onClick={() =>
                                setZohoTicketDraft(ticket.ticketNumber)
                              }
                            >
                              <TableCell className="truncate font-medium">
                                {ticket.ticketNumber}
                              </TableCell>
                              <TableCell className="truncate">
                                {ticket.assignee}
                              </TableCell>
                              <TableCell className="truncate">
                                {ticket.contactName}
                              </TableCell>
                              <TableCell className="truncate">
                                {ticket.subject}
                              </TableCell>
                              <TableCell className="truncate">
                                {ticket.lastCustomerResponse}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                        {draftRecord.zohoTicketId ? (
                          <TableRow>
                            <TableCell
                              colSpan={5}
                              className="text-muted-foreground text-center"
                            >
                              <button
                                type="button"
                                className="cursor-pointer font-medium text-foreground underline-offset-4 hover:underline"
                                onClick={() =>
                                  setZohoTicketDraft(draftRecord.zohoTicketId)
                                }
                              >
                                Use existing ticket {draftRecord.zohoTicketId}
                              </button>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : isComposingZohoEmail ? (
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
                  <div className={`${nestedCardRadiusClass} space-y-4 border p-4`}>
                    <div className="space-y-3">
                      <div>
                        <Select
                          value={zohoEmailTemplate}
                          onValueChange={(value) =>
                            setZohoEmailTemplate(value ?? "")
                          }
                        >
                          <SelectTrigger className="min-w-0 flex-1 cursor-pointer">
                            <SelectValue placeholder="Select a template" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="draft-ready">
                                Draft ready for review
                              </SelectItem>
                              <SelectItem value="missing-docs">
                                Missing documents
                              </SelectItem>
                              <SelectItem value="validation-complete">
                                Validation complete
                              </SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <FieldLabel htmlFor="zoho-email-message">
                          Message:
                        </FieldLabel>
                        <Textarea
                          id="zoho-email-message"
                          value={zohoEmailMessage}
                          onChange={(event) =>
                            setZohoEmailMessage(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.ctrlKey && event.key === "Enter") {
                              event.preventDefault()
                              sendZohoEmail()
                            }
                          }}
                          className="min-h-48 resize-none"
                        />
                      </div>

                      <div className="space-y-2">
                        <FieldLabel>Attach documents:</FieldLabel>
                        <div className="flex flex-wrap gap-2">
                          {[
                            "BL",
                            "Comm Invoice",
                            "Freight Invoice",
                            "Export Dec",
                            "Packing List",
                          ].map((fileLabel) => (
                            <Button
                              key={fileLabel}
                              variant="outline"
                              size="sm"
                              className="cursor-pointer"
                            >
                              {fileLabel}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <FieldLabel>Additional files:</FieldLabel>
                        <label
                          htmlFor="zoho-email-files"
                          className="bg-muted/30 hover:bg-muted/50 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 text-center"
                        >
                          <UploadCloudIcon className="text-muted-foreground mb-2 h-7 w-7" />
                          <span className="text-muted-foreground text-xs">
                            Drop or select up to 3 files
                          </span>
                          <span className="text-muted-foreground mt-2 text-xs font-medium">
                            Limit 3 files. 1MB each. PDF/XLS/XLSX
                          </span>
                          <Input
                            id="zoho-email-files"
                            type="file"
                            className="hidden"
                            accept=".pdf,.xls,.xlsx"
                            multiple
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              ) : activeSecondaryPanel === "summary" ? (
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pt-4 [scrollbar-gutter:stable]">
                  {isCreatingInvoice ? (
                    <div className={`${nestedCardRadiusClass} space-y-5 border p-4`}>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field>
                          <FieldLabel htmlFor="invoice-account">
                            Account
                          </FieldLabel>
                          <Select value={draftRecord.customerName}>
                            <SelectTrigger
                              id="invoice-account"
                              className="cursor-pointer"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectItem value={draftRecord.customerName}>
                                  {draftRecord.customerName}
                                </SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field>
                          <FieldLabel htmlFor="invoice-shipment-type">
                            Shipment Type
                          </FieldLabel>
                          <Select
                            value={invoiceShipmentType}
                            onValueChange={(value) => {
                              if (value) {
                                updateInvoiceShipmentType(
                                  value as InvoiceShipmentType
                                )
                              }
                            }}
                          >
                            <SelectTrigger
                              id="invoice-shipment-type"
                              className="cursor-pointer"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {invoiceShipmentTypeOptions.map((option) => (
                                  <SelectItem
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </Field>
                      </div>

                      <div className="overflow-x-auto rounded-lg border bg-background">
                        <Table className="min-w-[720px] table-fixed">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[18%]">Item ID</TableHead>
                              <TableHead className="w-[32%]">Name</TableHead>
                              <TableHead className="w-[24%]">Quantity</TableHead>
                              <TableHead className="w-[13%]">Unit Price</TableHead>
                              <TableHead className="w-[13%]">Unit Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {invoiceItems.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium">
                                  {item.id}
                                </TableCell>
                                <TableCell>{item.name}</TableCell>
                                <TableCell>
                                  <div className="flex h-8 max-w-56 items-center rounded-3xl border bg-background">
                                    <Button
                                      variant="ghost"
                                      size="icon-xs"
                                      className="h-8 rounded-r-none"
                                      onClick={() =>
                                        updateInvoiceItemQuantity(
                                          item.id,
                                          item.quantity - 1
                                        )
                                      }
                                      aria-label={`Decrease ${item.name} quantity`}
                                    >
                                      <MinusIcon />
                                    </Button>
                                    <Input
                                      value={item.quantity}
                                      onChange={(event) =>
                                        updateInvoiceItemQuantity(
                                          item.id,
                                          Number(event.target.value) || 0
                                        )
                                      }
                                      inputMode="numeric"
                                      aria-label={`${item.name} quantity`}
                                      className="h-8 rounded-none border-x border-y-0 bg-transparent text-center"
                                    />
                                    <Button
                                      variant="ghost"
                                      size="icon-xs"
                                      className="h-8 rounded-l-none"
                                      onClick={() =>
                                        updateInvoiceItemQuantity(
                                          item.id,
                                          item.quantity + 1
                                        )
                                      }
                                      aria-label={`Increase ${item.name} quantity`}
                                    >
                                      <PlusIcon />
                                    </Button>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  ${item.unitPrice.toFixed(2)}
                                </TableCell>
                                <TableCell>
                                  ${(item.quantity * item.unitPrice).toFixed(2)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      <div className="flex items-center justify-between gap-4 border-t pt-4">
                        <p className="text-sm font-medium">
                          Total: ${invoiceTotal.toFixed(2)}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="cursor-pointer"
                            onClick={cancelInvoiceCreation}
                          >
                            <XIcon />
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="cursor-pointer"
                            onClick={saveInvoiceCreation}
                          >
                            <CheckIcon />
                            Save
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                  <>
                  <FieldSet>
                    <FieldGroup className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                      <Field className="md:row-start-1">
                        <FieldLabel htmlFor="bill-of-lading-number">
                          Bill of Lading Number
                        </FieldLabel>
                        <Input
                          id="bill-of-lading-number"
                          value={draftRecord.billOfLading}
                          readOnly={!isEditing}
                          onClick={() => startEntryEdit("summary")}
                          onChange={(event) =>
                            updateDraftRecord("billOfLading", event.target.value)
                          }
                          className="cursor-pointer read-only:bg-muted/30"
                        />
                      </Field>
                      <Field className="md:row-start-1">
                        <FieldLabel htmlFor="ctn-number">CTN Number</FieldLabel>
                        <Input
                          id="ctn-number"
                          value={draftRecord.ctnNumber}
                          readOnly={!isEditing}
                          onClick={() => startEntryEdit("summary")}
                          onChange={(event) =>
                            updateDraftRecord("ctnNumber", event.target.value)
                          }
                          className="cursor-pointer read-only:bg-muted/30"
                        />
                      </Field>
                      <div
                        className={
                          correctionInvoiceNumber
                            ? "grid gap-6 md:col-span-2 md:grid-cols-2"
                            : ""
                        }
                      >
                        <Field data-invalid={!draftRecord.invoiceNumber}>
                          <FieldLabel htmlFor="invoice-number">
                            Invoice Number
                          </FieldLabel>
                          {draftRecord.invoiceNumber ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                className="w-full cursor-pointer rounded-4xl outline-none focus-visible:ring-1 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:cursor-default disabled:opacity-100"
                                onClick={() => startEntryEdit("summary")}
                                aria-label="Change invoice paid status"
                              >
                                <Input
                                  id="invoice-number"
                                  value={
                                    isEditing
                                      ? draftRecord.invoiceNumber
                                      : draftRecord.invoiceNumber
                                  }
                                  placeholder="No invoice"
                                  readOnly={!isEditing}
                                  tabIndex={isEditing ? 0 : -1}
                                  aria-invalid={!draftRecord.invoiceNumber}
                                  onClick={() => startEntryEdit("summary")}
                                  onChange={(event) =>
                                    updateDraftRecord(
                                      "invoiceNumber",
                                      event.target.value
                                    )
                                  }
                                  className={invoiceInputClass(
                                    draftRecord.invoicePaid
                                  )}
                                />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                <DropdownMenuItem
                                  onClick={() =>
                                    updateDraftRecord("invoicePaid", true)
                                  }
                                >
                                  Paid
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    updateDraftRecord("invoicePaid", false)
                                  }
                                >
                                  Unpaid
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <Button
                              id="invoice-number"
                              type="button"
                              variant="outline"
                              className="w-full cursor-pointer justify-start border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                              aria-invalid="true"
                              onClick={startInvoiceCreation}
                            >
                              <PlusIcon data-icon="inline-start" />
                              Create Invoice
                            </Button>
                          )}
                        </Field>

                        {correctionInvoiceNumber ? (
                          <Field>
                            <FieldLabel htmlFor="correction-invoice-number">
                              Correction Invoice Number
                            </FieldLabel>
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                className="w-full cursor-pointer rounded-4xl outline-none focus-visible:ring-1 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:cursor-default disabled:opacity-100"
                                onClick={() => startEntryEdit("summary")}
                                aria-label="Change correction invoice paid status"
                              >
                                <Input
                                  id="correction-invoice-number"
                                  value={correctionInvoiceNumber}
                                  readOnly={!isEditing}
                                  tabIndex={isEditing ? 0 : -1}
                                  onClick={() => startEntryEdit("summary")}
                                  onChange={(event) =>
                                    updateDraftRecord(
                                      "correctionInvoiceNumber",
                                      event.target.value
                                    )
                                  }
                                  className={invoiceInputClass(
                                    draftRecord.correctionInvoicePaid
                                  )}
                                />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                <DropdownMenuItem
                                  onClick={() =>
                                    updateDraftRecord(
                                      "correctionInvoicePaid",
                                      true
                                    )
                                  }
                                >
                                  Paid
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    updateDraftRecord(
                                      "correctionInvoicePaid",
                                      false
                                    )
                                  }
                                >
                                  Unpaid
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </Field>
                        ) : null}
                      </div>

                      <Field>
                        <FieldLabel htmlFor="zoho-ticket-id">
                          Zoho Ticket ID
                        </FieldLabel>
                        <div className="flex gap-2">
                          <Input
                            id="zoho-ticket-id"
                            value={draftRecord.zohoTicketId}
                            readOnly={!isEditing}
                            onClick={() => startEntryEdit("summary")}
                            onChange={(event) =>
                              updateDraftRecord(
                                "zohoTicketId",
                                event.target.value
                              )
                            }
                            className="cursor-pointer read-only:bg-muted/30"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="shrink-0 cursor-pointer"
                            render={
                              <a
                                href={zohoTicketUrl}
                                target="_blank"
                                rel="noreferrer"
                              />
                            }
                            aria-label="Open Zoho ticket"
                          >
                            <ExternalLinkIcon />
                          </Button>
                        </div>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="etd">ETD</FieldLabel>
                        <DatePickerField
                          date={draftRecord.etdDate}
                          label="Pick ETD"
                          onActivate={startEntryEdit}
                          onSelect={(date) => updateDraftRecord("etdDate", date)}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="eta">ETA</FieldLabel>
                        <DatePickerField
                          date={draftRecord.etaDate}
                          label="Pick ETA"
                          onActivate={startEntryEdit}
                          onSelect={(date) => updateDraftRecord("etaDate", date)}
                        />
                      </Field>
                    </FieldGroup>
                  </FieldSet>

                  <div className="mt-8 space-y-6 border-t pt-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-lg font-medium">Documents</h3>
                        <p className="text-muted-foreground text-sm">
                          Upload supporting certificate documents.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAddingDocument(true)}
                        disabled={isAddingDocument || Boolean(requestedDocumentType)}
                      >
                        Add New
                      </Button>
                    </div>

                    <div className="space-y-4">
                      {isAddingDocument ? (
                  <div
                    className={`${nestedCardRadiusClass} space-y-4 border p-4`}
                  >
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                      {documentTypeOptions.map((type) => {
                        const inputId = `document-upload-${type
                          .toLowerCase()
                          .replaceAll(" ", "-")}`
                        const pendingCount = pendingDocuments[type]?.length ?? 0

                        return (
                          <div key={type} className="space-y-2">
                            <FieldLabel htmlFor={inputId}>
                              {type === "Bill of Lading" ? "BL" : type}
                            </FieldLabel>
                            <label
                              htmlFor={inputId}
                              className="hover:bg-muted/50 flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-3 text-center"
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={(event) => handleDocumentDrop(type, event)}
                            >
                              <UploadCloudIcon className="text-muted-foreground mb-2 h-7 w-7" />
                              <p className="text-muted-foreground text-xs">
                                {pendingCount
                                  ? `${pendingCount} selected`
                                  : "Click to upload"}
                              </p>
                              <Input
                                id={inputId}
                                type="file"
                                className="hidden"
                                accept=".pdf,.doc,.docx,image/png,image/jpeg"
                                multiple
                                onChange={(event) =>
                                  handleDocumentInputChange(type, event)
                                }
                              />
                            </label>
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={cancelPendingDocuments}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={savePendingDocuments}
                        disabled={!canSavePendingDocuments}
                      >
                        Save
                      </Button>
                    </div>
                    {hasPendingDocuments ? (
                      <div className={`${nestedCardRadiusClass} border`}>
                        <div className="divide-y">
                          {Object.entries(pendingDocuments).flatMap(
                            ([type, files]) =>
                              files.map((file) => (
                                <div
                                  key={`${type}-${file.name}-${file.lastModified}`}
                                  className="flex items-center gap-3 p-3 text-sm"
                                >
                                  <div className="bg-muted rounded-md p-2">
                                    <FileIcon className="text-muted-foreground size-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate font-medium">
                                      {file.name}
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                      {type} - {(file.size / 1024).toFixed(1)} KB
                                    </p>
                                  </div>
                                </div>
                              ))
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                      ) : null}

                      <div>
                  <div className={`${nestedCardRadiusClass} border`}>
                    {uploadedDocuments.length ? (
                      <div className="divide-y">
                        {uploadedDocuments.map((document) => {
                          const isEditingDocument =
                            editingDocumentId === document.id
                          const isPreviewingDocument =
                            previewDocumentId === document.id

                          return (
                            <div
                              key={document.id}
                              className={
                                isEditingDocument
                                  ? "space-y-3 p-3"
                                  : "hover:bg-muted/40 cursor-pointer space-y-3 p-3"
                              }
                              onClick={() => {
                                if (!isEditingDocument) {
                                  toggleDocumentPreview(document.id)
                                }
                              }}
                            >
                              <div className="flex items-center justify-between gap-3 text-sm">
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                  <div className="bg-muted rounded-md p-2">
                                    <FileIcon className="text-muted-foreground size-4" />
                                  </div>
                                  {isEditingDocument ? (
                                    <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-[minmax(0,1fr)_220px_auto]">
                                      <Input
                                        value={editingDocumentTitle}
                                        onChange={(event) =>
                                          setEditingDocumentTitle(
                                            event.target.value
                                          )
                                        }
                                        aria-label="Document title"
                                      />
                                      <Select
                                        value={editingDocumentType}
                                        onValueChange={(value) => {
                                          if (value) {
                                            setEditingDocumentType(value)
                                          }
                                        }}
                                      >
                                        <SelectTrigger
                                          aria-label="Document type"
                                          className="cursor-pointer"
                                        >
                                          <SelectValue placeholder="Document type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectGroup>
                                            {documentTypeOptions.map((type) => (
                                              <SelectItem
                                                key={type}
                                                value={type}
                                              >
                                                {type}
                                              </SelectItem>
                                            ))}
                                          </SelectGroup>
                                        </SelectContent>
                                      </Select>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          size="sm"
                                          onClick={() =>
                                            saveEditingDocument(document.id)
                                          }
                                        >
                                          Save
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={cancelEditingDocument}
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="min-w-0">
                                      <button
                                        type="button"
                                        className="max-w-full cursor-pointer truncate text-left font-medium underline-offset-4 hover:underline"
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          toggleDocumentPreview(document.id)
                                        }}
                                      >
                                        {document.type}
                                      </button>
                                      <p className="text-muted-foreground text-xs">
                                        {document.title} -{" "}
                                        {(document.file.size / 1024).toFixed(1)}{" "}
                                        KB
                                      </p>
                                    </div>
                                  )}
                                </div>
                                {!isEditingDocument ? (
                                  <div
                                    className="flex shrink-0 items-center gap-1"
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      aria-label={`Download ${document.title}`}
                                      className="cursor-pointer"
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        downloadDocument(document)
                                      }}
                                    >
                                      <DownloadIcon />
                                    </Button>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger
                                        render={
                                          <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            className="cursor-pointer"
                                            aria-label={`Actions for ${document.title}`}
                                          />
                                        }
                                      >
                                        <MoreHorizontalIcon />
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                          onClick={(event) => {
                                            event.stopPropagation()
                                            startEditingDocument(document)
                                          }}
                                        >
                                          <PencilIcon />
                                          Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          variant="destructive"
                                          onClick={(event) => {
                                            event.stopPropagation()
                                            deleteDocument(document.id)
                                          }}
                                        >
                                          <TrashIcon />
                                          Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                ) : null}
                              </div>
                              {isPreviewingDocument ? (
                                <div
                                  className={`bg-muted/30 ${nestedCardRadiusClass} overflow-hidden border`}
                                >
                                  {document.file.type.startsWith("image/") ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={document.previewUrl}
                                      alt={document.title}
                                      className="max-h-96 w-full object-contain"
                                    />
                                  ) : document.file.type ===
                                    "application/pdf" ? (
                                    <iframe
                                      title={document.title}
                                      src={document.previewUrl}
                                      className="h-96 w-full"
                                    />
                                  ) : (
                                    <div className="text-muted-foreground flex min-h-32 items-center justify-center p-6 text-center text-sm">
                                      Preview is not available for this file
                                      type.
                                    </div>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-muted-foreground p-3 text-sm">
                        No documents uploaded.
                      </p>
                    )}
                  </div>
                      </div>
                    </div>
                  </div>
                  </>
                  )}
                </div>
              ) : activeSecondaryPanel === "comments" ? (
                <div className="min-h-0 flex-1 pt-4">
                  <div
                    className={`${nestedCardRadiusClass} flex h-full min-h-0 flex-col border`}
                  >
                    <div className="border-b p-4">
                      <h3 className="text-lg font-medium">Comments</h3>
                      <p className="text-muted-foreground text-sm">
                        Add record notes, internal reminders, or validation context.
                      </p>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-2 pt-4 [scrollbar-gutter:stable]">
                      <div className="flex min-h-full flex-col justify-end gap-2">
                            {recordComments.length ? (
                              recordComments.map((comment) => {
                                const isEditingComment =
                                  editingCommentId === comment.id
                                const isOwnComment = comment.author === "me"
                                const commentAuthor = isOwnComment
                                  ? "Alex Russell"
                                  : "Damien McConnell"
                                const authorInitials = isOwnComment
                                  ? "AR"
                                  : "DM"

                                return (
                                  <div key={comment.id}>
                                    <div
                                      className={
                                        comment.pinned
                                          ? "flex gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100"
                                          : "bg-muted/30 flex gap-3 rounded-md border px-4 py-3 text-sm"
                                      }
                                    >
                                      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-medium text-foreground">
                                        {authorInitials}
                                      </div>

                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                          <span className="font-semibold">
                                            {commentAuthor}
                                          </span>
                                          <span className="text-muted-foreground">
                                            ·
                                          </span>
                                          <span
                                            className={
                                              comment.pinned
                                                ? "text-xs text-blue-800 dark:text-blue-200"
                                                : "text-muted-foreground text-xs"
                                            }
                                          >
                                            {comment.createdAt}
                                          </span>
                                          {comment.pinned ? (
                                            <Badge
                                              variant="outline"
                                              className="h-5 shrink-0 border-blue-300 bg-blue-100 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100"
                                            >
                                              Pinned
                                            </Badge>
                                          ) : null}
                                        </div>

                                        {isEditingComment ? (
                                          <div className="mt-2 space-y-2">
                                            <Textarea
                                              value={editingCommentText}
                                              onChange={(event) =>
                                                setEditingCommentText(
                                                  event.target.value
                                                )
                                              }
                                              className="min-h-20 resize-none"
                                              aria-label="Edit comment"
                                            />
                                            <div className="flex justify-end gap-2">
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                className="cursor-pointer"
                                                onClick={cancelEditingComment}
                                              >
                                                Cancel
                                              </Button>
                                              <Button
                                                size="sm"
                                                className="cursor-pointer"
                                                onClick={() =>
                                                  saveEditingComment(comment.id)
                                                }
                                                disabled={
                                                  !editingCommentText.trim()
                                                }
                                              >
                                                Save
                                              </Button>
                                            </div>
                                          </div>
                                        ) : (
                                          <p className="mt-2 line-clamp-2 whitespace-pre-wrap break-words leading-snug">
                                            {comment.text}
                                          </p>
                                        )}
                                      </div>

                                      {!isEditingComment ? (
                                        <DropdownMenu>
                                          <DropdownMenuTrigger
                                            render={
                                              <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                className="shrink-0 cursor-pointer"
                                                aria-label="Comment actions"
                                              />
                                            }
                                          >
                                            <MoreHorizontalIcon />
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                              onClick={() =>
                                                startEditingComment(comment)
                                              }
                                            >
                                              <PencilIcon />
                                              Edit
                                            </DropdownMenuItem>
                                            {comment.pinned ? (
                                              <DropdownMenuItem
                                                onClick={() =>
                                                  unpinRecordComment(comment.id)
                                                }
                                              >
                                                <PinIcon />
                                                Unpin
                                              </DropdownMenuItem>
                                            ) : (
                                              <DropdownMenuItem
                                                onClick={() =>
                                                  pinRecordComment(comment.id)
                                                }
                                              >
                                                <PinIcon />
                                                Pin
                                              </DropdownMenuItem>
                                            )}
                                            <DropdownMenuItem
                                              variant="destructive"
                                              onClick={() =>
                                                deleteRecordComment(comment.id)
                                              }
                                            >
                                              <TrashIcon />
                                              Delete
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      ) : null}
                                    </div>
                                  </div>
                                )
                              })
                            ) : (
                              <div className="text-muted-foreground flex min-h-24 items-center justify-center text-sm">
                                No comments yet.
                              </div>
                            )}
                        <div ref={commentsEndRef} />
                      </div>
                    </div>

                    <div className="border-t px-4 pb-4 pt-2">
                      <div className="space-y-2">
                        <Textarea
                          value={newComment}
                          onChange={(event) => setNewComment(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && event.ctrlKey) {
                              event.preventDefault()
                              addRecordComment()
                            }
                          }}
                          placeholder="Add a comment..."
                          className="min-h-20 resize-none"
                        />
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-muted-foreground text-xs">
                            Ctrl+Enter to post
                          </p>
                          <Button
                            className="cursor-pointer"
                            onClick={addRecordComment}
                            disabled={!newComment.trim()}
                          >
                            Add Comment
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : activeSecondaryPanel === "sent-messages" ? (
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pt-4 [scrollbar-gutter:stable]">
                  <div
                    className={`${nestedCardRadiusClass} flex h-full min-h-0 flex-col border`}
                  >
                    <div className="border-b p-4">
                      <h3 className="text-lg font-medium">Sent Messages</h3>
                      <p className="text-muted-foreground text-sm">
                        Recent email copies sent from this certificate record.
                      </p>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 [scrollbar-gutter:stable]">
                      <div className="space-y-3">
                        {sampleSentMessages.map((message) => (
                          <div
                            key={message.id}
                            className={`${nestedCardRadiusClass} border bg-muted/20 p-4 text-sm`}
                          >
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <p className="truncate font-semibold">
                                  {message.subject}
                                </p>
                                <p className="text-muted-foreground truncate">
                                  To: {message.recipient}
                                </p>
                              </div>
                              <span className="text-muted-foreground shrink-0 text-xs">
                                {message.sentAt}
                              </span>
                            </div>
                            <p className="text-muted-foreground mt-3 line-clamp-2">
                              {message.body}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="pt-4">
                  <div className={`${nestedCardRadiusClass} border p-5`}>
                    <p className="font-medium">No linked shipments yet.</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      Related bills of lading and certificate records will appear here.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
