"use client"

import * as React from "react"
import { AppLink } from "@/components/app-link"
import { format } from "date-fns"
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  PlusIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { ClassicDataTable } from "@/components/classic-data-table"

export type CustomerShipmentRow = {
  id: number
  billOfLading: string
  lastUpdated: string
  status: string
  country: string
  client: string
  invoiceNumber: string
  invoicePaid: boolean
  agent: string
}

type CustomerPanel =
  | "summary"
  | "certificates"
  | "company-users"
type CustomerSummaryDetails = {
  companyName: string
  contactName: string
  address: string
  city: string
  state: string
  postalCode: string
  country: string
  phone: string
  email: string
  quoteTool: string
  autoMarkInvoicePaid: string
}
type CompanyUser = {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
  company: string
  accountActive: boolean
  requestEligibility: boolean
}

const initialCompanyUsers: CompanyUser[] = [
  {
    id: "user-1",
    firstName: "EMRE",
    lastName: "ERDINC",
    email: "ectn@sbbusa.com",
    role: "Main User",
    company: "SBB SHIPPING USA INC",
    accountActive: true,
    requestEligibility: true,
  },
  {
    id: "user-2",
    firstName: "Accounting",
    lastName: "Team",
    email: "accounting@sbbusa.com",
    role: "Admin",
    company: "SBB SHIPPING USA INC",
    accountActive: true,
    requestEligibility: false,
  },
  {
    id: "user-3",
    firstName: "Operations",
    lastName: "",
    email: "ops@sbbusa.com",
    role: "Basic User",
    company: "SBB SHIPPING USA INC",
    accountActive: false,
    requestEligibility: false,
  },
]

const certificateStatusTabs = [
  "All",
  "Draft Available",
  "Completed",
]

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function SummaryField({
  label,
  value,
  onChange,
  onActivate,
  isEditing,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  onActivate: () => void
  isEditing: boolean
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Input
        value={value}
        readOnly={!isEditing}
        onClick={onActivate}
        onChange={(event) => onChange(event.target.value)}
        className="cursor-pointer read-only:bg-muted/30"
      />
    </Field>
  )
}

function SummarySelectField({
  label,
  value,
  onChange,
  onActivate,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  onActivate: () => void
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Select
        value={value}
        onOpenChange={(open) => {
          if (open) onActivate()
        }}
        onValueChange={(selectedValue) => {
          onActivate()
          if (selectedValue) onChange(selectedValue)
        }}
      >
        <SelectTrigger className="cursor-pointer">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="Enabled">Enabled</SelectItem>
            <SelectItem value="Disabled">Disabled</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}

export function CustomerRecordView({
  customerName,
  shipments,
  companyOptions,
}: {
  customerName: string
  shipments: CustomerShipmentRow[]
  companyOptions?: string[]
}) {
  const [activePanel, setActivePanel] =
    React.useState<CustomerPanel>("certificates")
  const [expandedUserId, setExpandedUserId] = React.useState<string>()
  const [companySearch, setCompanySearch] = React.useState("")
  const [activeCertificateStatus, setActiveCertificateStatus] =
    React.useState(certificateStatusTabs[0])
  const [savedCompanyUsers, setSavedCompanyUsers] =
    React.useState<CompanyUser[]>(initialCompanyUsers)
  const [draftCompanyUsers, setDraftCompanyUsers] =
    React.useState<CompanyUser[]>(initialCompanyUsers)
  const [newCompanyUser, setNewCompanyUser] =
    React.useState<CompanyUser | null>(null)
  const [isEditingCompanyUsers, setIsEditingCompanyUsers] =
    React.useState(false)

  const countries = uniqueValues(shipments.map((shipment) => shipment.country))
  const completedShipments = shipments.filter(
    (shipment) => shipment.status === "Completed"
  )
  const paidShipments = shipments.filter((shipment) => shipment.invoicePaid)
  const primaryCountry = countries[0] ?? "Angola"
  const customerEmail = `${customerName.toLowerCase().replaceAll(" ", ".")}@example.com`
  const initialSummaryDetails = React.useMemo<CustomerSummaryDetails>(
    () => ({
      companyName: "SBB SHIPPING USA INC",
      contactName: "EMRE ERDINC",
      address: "464 VALLEY BROOK AVE, 3RD FL",
      city: "LYNDHURST",
      state: "NJ",
      postalCode: "07071",
      country: primaryCountry,
      phone: "3473563079",
      email: "ectn@sbbusa.com",
      quoteTool: "Enabled",
      autoMarkInvoicePaid: "Enabled",
    }),
    [primaryCountry]
  )
  const [savedSummaryDetails, setSavedSummaryDetails] =
    React.useState<CustomerSummaryDetails>(initialSummaryDetails)
  const [draftSummaryDetails, setDraftSummaryDetails] =
    React.useState<CustomerSummaryDetails>(initialSummaryDetails)
  const [isEditingSummary, setIsEditingSummary] = React.useState(false)
  const searchableCompanyOptions = uniqueValues([
    ...(companyOptions ?? []),
    customerName,
    draftSummaryDetails.companyName,
    ...draftCompanyUsers.map((user) => user.company),
  ]).sort()
  const filteredCompanyOptions = searchableCompanyOptions.filter((company) =>
    company.toLowerCase().includes(companySearch.trim().toLowerCase())
  )
  const filteredCertificateShipments =
    activeCertificateStatus === "All"
      ? shipments
      : shipments.filter(
          (shipment) => shipment.status === activeCertificateStatus
        )

  const updateSummaryDetail = (
    key: keyof CustomerSummaryDetails,
    value: string
  ) => {
    setDraftSummaryDetails((currentDetails) => ({
      ...currentDetails,
      [key]: value,
    }))
  }
  const saveSummaryDetails = () => {
    setSavedSummaryDetails(draftSummaryDetails)
    setIsEditingSummary(false)
  }
  const cancelSummaryDetails = () => {
    setDraftSummaryDetails(savedSummaryDetails)
    setIsEditingSummary(false)
  }
  const updateCompanyUser = <Key extends keyof CompanyUser>(
    userId: string,
    key: Key,
    value: CompanyUser[Key]
  ) => {
    setIsEditingCompanyUsers(true)
    setDraftCompanyUsers((currentUsers) =>
      currentUsers.map((user) =>
        user.id === userId
          ? {
              ...user,
              [key]: value,
            }
          : user
      )
    )
  }
  const saveCompanyUsers = () => {
    setSavedCompanyUsers(draftCompanyUsers)
    setIsEditingCompanyUsers(false)
  }
  const cancelCompanyUsers = () => {
    setDraftCompanyUsers(savedCompanyUsers)
    setIsEditingCompanyUsers(false)
  }
  const addCompanyUser = () => {
    setNewCompanyUser({
      id: `user-${draftCompanyUsers.length + 1}`,
      firstName: "",
      lastName: "",
      email: "",
      role: "Basic User",
      company: draftSummaryDetails.companyName,
      accountActive: true,
      requestEligibility: true,
    })
    setExpandedUserId(undefined)
  }
  const updateNewCompanyUser = <Key extends keyof CompanyUser>(
    key: Key,
    value: CompanyUser[Key]
  ) => {
    setNewCompanyUser((currentUser) =>
      currentUser
        ? {
            ...currentUser,
            [key]: value,
          }
        : currentUser
    )
  }
  const saveNewCompanyUser = () => {
    if (!newCompanyUser) return

    setDraftCompanyUsers((currentUsers) => [...currentUsers, newCompanyUser])
    setSavedCompanyUsers((currentUsers) => [...currentUsers, newCompanyUser])
    setNewCompanyUser(null)
  }
  const cancelNewCompanyUser = () => {
    setNewCompanyUser(null)
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4 lg:px-6">
        <div className="flex shrink-0 items-center">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon-sm"
              render={<AppLink href="/customers" />}
              aria-label="Back to company profiles"
            >
              <ArrowLeftIcon />
            </Button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 items-stretch gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
          <div className="min-h-0">
            <Card
              size="sm"
              className="h-full rounded-lg border shadow-none ring-0"
            >
              <CardContent className="min-h-0 flex-1 overflow-y-auto">
                <div className="divide-y">
                  <section className="space-y-2 pb-4">
                    <div>
                      <p className="truncate text-lg font-semibold">
                        {customerName}
                      </p>
                      <p className="text-muted-foreground truncate text-sm">
                        {customerEmail}
                      </p>
                    </div>
                  </section>

                  <section className="space-y-3 py-4">
                    <h3 className="font-semibold">Account Details</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Contact Name</span>
                        <span className="truncate text-right font-medium">
                          {draftSummaryDetails.contactName}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Last Updated</span>
                        <span className="font-medium">
                          {shipments[0]?.lastUpdated ?? format(new Date(), "yyyy-MM-dd")}
                        </span>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-3 py-4">
                    <h3 className="font-semibold">Customer Totals</h3>
                    <div className="grid grid-cols-3 gap-2 text-center text-sm">
                      <div className="rounded-lg border p-2">
                        <p className="text-lg font-semibold">{shipments.length}</p>
                        <p className="text-muted-foreground text-xs">Total</p>
                      </div>
                      <div className="rounded-lg border p-2">
                        <p className="text-lg font-semibold">
                          {completedShipments.length}
                        </p>
                        <p className="text-muted-foreground text-xs">Validated</p>
                      </div>
                      <div className="rounded-lg border p-2">
                        <p className="text-lg font-semibold">
                          {paidShipments.length}
                        </p>
                        <p className="text-muted-foreground text-xs">Paid</p>
                      </div>
                    </div>
                  </section>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="h-full min-h-0 min-w-0 flex-1 rounded-lg border shadow-none ring-0">
            <CardContent className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
                <Tabs
                  value={activePanel}
                  onValueChange={(value) => setActivePanel(value as CustomerPanel)}
                  className="min-w-0 flex-1 gap-0"
                >
                  <TabsList
                    variant="line"
                    className="max-w-full justify-start overflow-x-auto"
                  >
                    <TabsTrigger value="certificates" className="cursor-pointer">
                      Certificates
                    </TabsTrigger>
                    <TabsTrigger value="summary" className="cursor-pointer">
                      Company Information
                    </TabsTrigger>
                    <TabsTrigger
                      value="company-users"
                      className="cursor-pointer"
                    >
                      Company Users
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                {isEditingSummary && activePanel === "summary" ? (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer"
                      onClick={cancelSummaryDetails}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="cursor-pointer"
                      onClick={saveSummaryDetails}
                    >
                      Save
                    </Button>
                  </div>
                ) : isEditingCompanyUsers && activePanel === "company-users" ? (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer"
                      onClick={cancelCompanyUsers}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="cursor-pointer"
                      onClick={saveCompanyUsers}
                    >
                      Save
                    </Button>
                  </div>
                ) : activePanel === "company-users" && !newCompanyUser ? (
                  <Button
                    size="sm"
                    className="cursor-pointer"
                    onClick={addCompanyUser}
                  >
                    <PlusIcon data-icon="inline-start" />
                    Add User
                  </Button>
                ) : null}
              </div>

              {activePanel === "summary" ? (
                <div className="min-h-0 flex-1 overflow-y-auto pt-4">
                  <div className="space-y-8">
                    <div>
                      <h3 className="text-lg font-medium">
                        Company Information
                      </h3>

                      <FieldSet className="mt-6">
                        <FieldGroup className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                          <SummaryField
                            label="Company Name"
                            value={draftSummaryDetails.companyName}
                            isEditing={isEditingSummary}
                            onActivate={() => setIsEditingSummary(true)}
                            onChange={(value) =>
                              updateSummaryDetail("companyName", value)
                            }
                          />
                          <SummaryField
                            label="Contact Name"
                            value={draftSummaryDetails.contactName}
                            isEditing={isEditingSummary}
                            onActivate={() => setIsEditingSummary(true)}
                            onChange={(value) =>
                              updateSummaryDetail("contactName", value)
                            }
                          />
                          <SummaryField
                            label="Address"
                            value={draftSummaryDetails.address}
                            isEditing={isEditingSummary}
                            onActivate={() => setIsEditingSummary(true)}
                            onChange={(value) =>
                              updateSummaryDetail("address", value)
                            }
                          />
                          <SummaryField
                            label="City"
                            value={draftSummaryDetails.city}
                            isEditing={isEditingSummary}
                            onActivate={() => setIsEditingSummary(true)}
                            onChange={(value) =>
                              updateSummaryDetail("city", value)
                            }
                          />
                          <SummaryField
                            label="State"
                            value={draftSummaryDetails.state}
                            isEditing={isEditingSummary}
                            onActivate={() => setIsEditingSummary(true)}
                            onChange={(value) =>
                              updateSummaryDetail("state", value)
                            }
                          />
                          <SummaryField
                            label="Postal Code"
                            value={draftSummaryDetails.postalCode}
                            isEditing={isEditingSummary}
                            onActivate={() => setIsEditingSummary(true)}
                            onChange={(value) =>
                              updateSummaryDetail("postalCode", value)
                            }
                          />
                          <SummaryField
                            label="Country"
                            value={draftSummaryDetails.country}
                            isEditing={isEditingSummary}
                            onActivate={() => setIsEditingSummary(true)}
                            onChange={(value) =>
                              updateSummaryDetail("country", value)
                            }
                          />
                          <SummaryField
                            label="Phone"
                            value={draftSummaryDetails.phone}
                            isEditing={isEditingSummary}
                            onActivate={() => setIsEditingSummary(true)}
                            onChange={(value) =>
                              updateSummaryDetail("phone", value)
                            }
                          />
                          <SummaryField
                            label="Email"
                            value={draftSummaryDetails.email}
                            isEditing={isEditingSummary}
                            onActivate={() => setIsEditingSummary(true)}
                            onChange={(value) =>
                              updateSummaryDetail("email", value)
                            }
                          />
                        </FieldGroup>
                      </FieldSet>
                    </div>

                    <div className="border-t pt-6">
                      <h3 className="text-lg font-medium">Accounting</h3>

                      <FieldSet className="mt-6">
                        <FieldGroup className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                          <SummarySelectField
                            label="Quote Tool"
                            value={draftSummaryDetails.quoteTool}
                            onActivate={() => setIsEditingSummary(true)}
                            onChange={(value) =>
                              updateSummaryDetail("quoteTool", value)
                            }
                          />
                          <SummarySelectField
                            label="Auto Mark Invoice Paid"
                            value={draftSummaryDetails.autoMarkInvoicePaid}
                            onActivate={() => setIsEditingSummary(true)}
                            onChange={(value) =>
                              updateSummaryDetail("autoMarkInvoicePaid", value)
                            }
                          />
                        </FieldGroup>
                      </FieldSet>
                    </div>
                  </div>
                </div>
              ) : activePanel === "certificates" ? (
                <div className="@container/main flex min-h-0 flex-1 flex-col gap-3 overflow-hidden pt-4">
                  <Tabs
                    value={activeCertificateStatus}
                    onValueChange={(value) => {
                      if (value) setActiveCertificateStatus(value)
                    }}
                    className="shrink-0 gap-0"
                  >
                    <TabsList className="h-9 max-w-full justify-start overflow-x-auto rounded-full **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:bg-muted-foreground/30 **:data-[slot=badge]:px-1">
                      {certificateStatusTabs.map((status) => (
                        <TabsTrigger
                          key={status}
                          value={status}
                          className="cursor-pointer"
                        >
                          {status}
                          <Badge variant="secondary">
                            {status === "All"
                              ? shipments.length
                              : shipments.filter(
                                  (shipment) => shipment.status === status
                                ).length}
                          </Badge>
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <ClassicDataTable
                      data={filteredCertificateShipments}
                      showToolbar={false}
                      showClientColumn={false}
                    />
                  </div>
                </div>
              ) : (
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pt-4">
                  {newCompanyUser ? (
                    <div className="rounded-lg border bg-muted/20 p-4">
                      <div className="grid gap-4">
                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="space-y-2">
                            <FieldLabel htmlFor="new-user-first-name">
                              First Name
                            </FieldLabel>
                            <Input
                              id="new-user-first-name"
                              value={newCompanyUser.firstName}
                              onChange={(event) =>
                                updateNewCompanyUser(
                                  "firstName",
                                  event.target.value
                                )
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <FieldLabel htmlFor="new-user-last-name">
                              Last Name
                            </FieldLabel>
                            <Input
                              id="new-user-last-name"
                              value={newCompanyUser.lastName}
                              onChange={(event) =>
                                updateNewCompanyUser(
                                  "lastName",
                                  event.target.value
                                )
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <FieldLabel htmlFor="new-user-email">
                              Email
                            </FieldLabel>
                            <Input
                              id="new-user-email"
                              value={newCompanyUser.email}
                              onChange={(event) =>
                                updateNewCompanyUser("email", event.target.value)
                              }
                            />
                          </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-[3fr_1fr_1fr_1fr]">
                          <div className="space-y-2">
                            <FieldLabel htmlFor="new-user-company">
                              Company
                            </FieldLabel>
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button
                                    id="new-user-company"
                                    variant="outline"
                                    className="w-full justify-between cursor-pointer"
                                  />
                                }
                              >
                                <span className="min-w-0 truncate">
                                  {newCompanyUser.company || "Select company"}
                                </span>
                                <ChevronDownIcon data-icon="inline-end" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-80">
                                <div className="p-1.5">
                                  <Input
                                    value={companySearch}
                                    onChange={(event) =>
                                      setCompanySearch(event.target.value)
                                    }
                                    onKeyDown={(event) => event.stopPropagation()}
                                    placeholder="Search companies"
                                  />
                                </div>
                                <DropdownMenuSeparator />
                                {filteredCompanyOptions.map((company) => (
                                  <DropdownMenuItem
                                    key={company}
                                    onClick={() =>
                                      updateNewCompanyUser("company", company)
                                    }
                                  >
                                    <span className="truncate">{company}</span>
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <div className="space-y-2">
                            <FieldLabel htmlFor="new-user-role">Role</FieldLabel>
                            <Select
                              value={newCompanyUser.role}
                              onValueChange={(value) => {
                                if (value) updateNewCompanyUser("role", value)
                              }}
                            >
                              <SelectTrigger
                                id="new-user-role"
                                className="cursor-pointer"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectItem value="Basic User">
                                    Basic User
                                  </SelectItem>
                                  <SelectItem value="Admin">Admin</SelectItem>
                                  <SelectItem value="Main User">
                                    Main User
                                  </SelectItem>
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <FieldLabel htmlFor="new-user-account-active">
                              Account Active
                            </FieldLabel>
                            <Select
                              value={
                                newCompanyUser.accountActive
                                  ? "Active"
                                  : "Disabled"
                              }
                              onValueChange={(value) =>
                                updateNewCompanyUser(
                                  "accountActive",
                                  value === "Active"
                                )
                              }
                            >
                              <SelectTrigger
                                id="new-user-account-active"
                                className="cursor-pointer"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectItem value="Active">Active</SelectItem>
                                  <SelectItem value="Disabled">
                                    Disabled
                                  </SelectItem>
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <FieldLabel htmlFor="new-user-request-eligibility">
                              Request Eligibility
                            </FieldLabel>
                            <Select
                              value={
                                newCompanyUser.requestEligibility
                                  ? "Enabled"
                                  : "Disabled"
                              }
                              onValueChange={(value) =>
                                updateNewCompanyUser(
                                  "requestEligibility",
                                  value === "Enabled"
                                )
                              }
                            >
                              <SelectTrigger
                                id="new-user-request-eligibility"
                                className="cursor-pointer"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectItem value="Enabled">
                                    Enabled
                                  </SelectItem>
                                  <SelectItem value="Disabled">
                                    Disabled
                                  </SelectItem>
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="cursor-pointer"
                            onClick={cancelNewCompanyUser}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="cursor-pointer"
                            onClick={saveNewCompanyUser}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                  <Table containerClassName="rounded-lg border">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10" />
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Access</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {draftCompanyUsers.map((user) => {
                        const isExpanded = expandedUserId === user.id
                        const fullName = [user.firstName, user.lastName]
                          .filter(Boolean)
                          .join(" ")

                        return (
                          <React.Fragment key={user.id}>
                            <TableRow
                              className="cursor-pointer"
                              onClick={() =>
                                setExpandedUserId(isExpanded ? undefined : user.id)
                              }
                            >
                              <TableCell>
                                <ChevronDownIcon
                                  className={`size-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                />
                              </TableCell>
                              <TableCell className="font-medium">
                                {fullName}
                              </TableCell>
                              <TableCell>{user.email}</TableCell>
                              <TableCell>{user.role}</TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={
                                    user.accountActive
                                      ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
                                      : "border-muted bg-muted text-muted-foreground"
                                  }
                                >
                                  {user.accountActive ? "Active" : "Inactive"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                            {isExpanded ? (
                              <TableRow>
                                <TableCell colSpan={5} className="bg-muted/20 p-4">
                                  <div className="grid gap-4">
                                    <div className="grid gap-4 md:grid-cols-2">
                                      <div className="space-y-2">
                                        <FieldLabel htmlFor={`${user.id}-first-name`}>
                                          First Name
                                        </FieldLabel>
                                        <Input
                                          id={`${user.id}-first-name`}
                                          value={user.firstName}
                                          onChange={(event) =>
                                            updateCompanyUser(
                                              user.id,
                                              "firstName",
                                              event.target.value
                                            )
                                          }
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <FieldLabel htmlFor={`${user.id}-last-name`}>
                                          Last Name
                                        </FieldLabel>
                                        <Input
                                          id={`${user.id}-last-name`}
                                          value={user.lastName}
                                          onChange={(event) =>
                                            updateCompanyUser(
                                              user.id,
                                              "lastName",
                                              event.target.value
                                            )
                                          }
                                        />
                                      </div>
                                    </div>
                                    <div className="space-y-2">
                                      <FieldLabel htmlFor={`${user.id}-email`}>
                                        Email
                                      </FieldLabel>
                                      <Input
                                        id={`${user.id}-email`}
                                        value={user.email}
                                        onChange={(event) =>
                                          updateCompanyUser(
                                            user.id,
                                            "email",
                                            event.target.value
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-[3fr_1fr_1fr_1fr]">
                                      <div className="space-y-2">
                                        <FieldLabel htmlFor={`${user.id}-company`}>
                                          Company
                                        </FieldLabel>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger
                                            render={
                                              <Button
                                                id={`${user.id}-company`}
                                                variant="outline"
                                                className="w-full justify-between cursor-pointer"
                                              />
                                            }
                                          >
                                            <span className="min-w-0 truncate">
                                              {user.company}
                                            </span>
                                            <ChevronDownIcon data-icon="inline-end" />
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent
                                            align="start"
                                            className="w-80"
                                          >
                                            <div className="p-1.5">
                                              <Input
                                                value={companySearch}
                                                onChange={(event) =>
                                                  setCompanySearch(event.target.value)
                                                }
                                                onKeyDown={(event) =>
                                                  event.stopPropagation()
                                                }
                                                placeholder="Search companies"
                                              />
                                            </div>
                                            <DropdownMenuSeparator />
                                            {filteredCompanyOptions.map((company) => (
                                              <DropdownMenuItem
                                                key={company}
                                                onClick={() =>
                                                  updateCompanyUser(
                                                    user.id,
                                                    "company",
                                                    company
                                                  )
                                                }
                                              >
                                                <span className="truncate">
                                                  {company}
                                                </span>
                                              </DropdownMenuItem>
                                            ))}
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                      <div className="space-y-2">
                                        <FieldLabel htmlFor={`${user.id}-role`}>
                                          Role
                                        </FieldLabel>
                                        <Select
                                          value={user.role}
                                          onValueChange={(value) => {
                                            if (value) {
                                              updateCompanyUser(
                                                user.id,
                                                "role",
                                                value
                                              )
                                            }
                                          }}
                                        >
                                          <SelectTrigger
                                            id={`${user.id}-role`}
                                            className="cursor-pointer"
                                          >
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectGroup>
                                              <SelectItem value="Basic User">
                                                Basic User
                                              </SelectItem>
                                              <SelectItem value="Admin">Admin</SelectItem>
                                              <SelectItem value="Main User">
                                                Main User
                                              </SelectItem>
                                            </SelectGroup>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="space-y-2">
                                        <FieldLabel htmlFor={`${user.id}-account-active`}>
                                          Account Active
                                        </FieldLabel>
                                        <Select
                                          value={
                                            user.accountActive ? "Active" : "Disabled"
                                          }
                                          onValueChange={(value) =>
                                            updateCompanyUser(
                                              user.id,
                                              "accountActive",
                                              value === "Active"
                                            )
                                          }
                                        >
                                          <SelectTrigger
                                            id={`${user.id}-account-active`}
                                            className="cursor-pointer"
                                          >
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectGroup>
                                              <SelectItem value="Active">
                                                Active
                                              </SelectItem>
                                              <SelectItem value="Disabled">
                                                Disabled
                                              </SelectItem>
                                            </SelectGroup>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="space-y-2">
                                        <FieldLabel htmlFor={`${user.id}-request-eligibility`}>
                                          Request Eligibility
                                        </FieldLabel>
                                        <Select
                                          value={
                                            user.requestEligibility
                                              ? "Enabled"
                                              : "Disabled"
                                          }
                                          onValueChange={(value) =>
                                            updateCompanyUser(
                                              user.id,
                                              "requestEligibility",
                                              value === "Enabled"
                                            )
                                          }
                                        >
                                          <SelectTrigger
                                            id={`${user.id}-request-eligibility`}
                                            className="cursor-pointer"
                                          >
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectGroup>
                                              <SelectItem value="Enabled">
                                                Enabled
                                              </SelectItem>
                                              <SelectItem value="Disabled">
                                                Disabled
                                              </SelectItem>
                                            </SelectGroup>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ) : null}
                          </React.Fragment>
                        )
                      })}
                    </TableBody>
                  </Table>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
