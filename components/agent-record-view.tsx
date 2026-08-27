"use client"

import * as React from "react"
import { AppLink } from "@/components/app-link"
import { format } from "date-fns"
import { ArrowLeftIcon } from "lucide-react"

import type { AgentProfile } from "@/lib/agents"
import { ClassicDataTable } from "@/components/classic-data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export type AgentShipmentRow = {
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

type AgentPanel = "certificates" | "summary"

type AgentSummaryDetails = {
  firstName: string
  lastName: string
  email: string
  role: string
  accountActive: string
  requestEligibility: string
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
  values,
  onChange,
  onActivate,
}: {
  label: string
  value: string
  values: string[]
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
            {values.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}

export function AgentRecordView({
  agentName,
  agentProfile,
  shipments,
}: {
  agentName: string
  agentProfile?: AgentProfile
  shipments: AgentShipmentRow[]
}) {
  const [activePanel, setActivePanel] =
    React.useState<AgentPanel>("certificates")
  const completedShipments = shipments.filter(
    (shipment) => shipment.status === "Completed"
  )
  const paidShipments = shipments.filter((shipment) => shipment.invoicePaid)
  const [firstName = agentName, ...lastNameParts] = agentName.split(" ")
  const initialSummaryDetails = React.useMemo<AgentSummaryDetails>(
    () => ({
      firstName: agentProfile?.firstName ?? firstName,
      lastName: agentProfile?.lastName ?? lastNameParts.join(" "),
      email:
        agentProfile?.email ??
        `${agentName.toLowerCase().replaceAll(" ", ".")}@africactn.com`,
      role: agentProfile?.role ?? "Basic User",
      accountActive: agentProfile?.accountActive === false ? "Disabled" : "Active",
      requestEligibility:
        agentProfile?.requestEligibility === false ? "Disabled" : "Enabled",
    }),
    [agentName, agentProfile, firstName, lastNameParts]
  )
  const [savedSummaryDetails, setSavedSummaryDetails] =
    React.useState<AgentSummaryDetails>(initialSummaryDetails)
  const [draftSummaryDetails, setDraftSummaryDetails] =
    React.useState<AgentSummaryDetails>(initialSummaryDetails)
  const [isEditingSummary, setIsEditingSummary] = React.useState(false)

  const updateSummaryDetail = (
    key: keyof AgentSummaryDetails,
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

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4 lg:px-6">
        <div className="flex shrink-0 items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            render={<AppLink href="/agents" />}
            aria-label="Back to agent profiles"
          >
            <ArrowLeftIcon />
          </Button>
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
                        {agentName}
                      </p>
                      <p className="text-muted-foreground truncate text-sm">
                        {draftSummaryDetails.email}
                      </p>
                    </div>
                  </section>

                  <section className="space-y-3 py-4">
                    <h3 className="font-semibold">User Details</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Role</span>
                        <span className="truncate text-right font-medium">
                          {draftSummaryDetails.role}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Last Updated</span>
                        <span className="font-medium">
                          {shipments[0]?.lastUpdated ??
                            format(new Date(), "yyyy-MM-dd")}
                        </span>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-3 py-4">
                    <h3 className="font-semibold">Certificate Totals</h3>
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
                  onValueChange={(value) => setActivePanel(value as AgentPanel)}
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
                      User Information
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
                ) : null}
              </div>

              {activePanel === "summary" ? (
                <div className="min-h-0 flex-1 overflow-y-auto pt-4">
                  <div className="space-y-8">
                    <div>
                      <h3 className="text-lg font-medium">User Information</h3>

                      <FieldSet className="mt-6">
                        <FieldGroup className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                          <SummaryField
                            label="First Name"
                            value={draftSummaryDetails.firstName}
                            isEditing={isEditingSummary}
                            onActivate={() => setIsEditingSummary(true)}
                            onChange={(value) =>
                              updateSummaryDetail("firstName", value)
                            }
                          />
                          <SummaryField
                            label="Last Name"
                            value={draftSummaryDetails.lastName}
                            isEditing={isEditingSummary}
                            onActivate={() => setIsEditingSummary(true)}
                            onChange={(value) =>
                              updateSummaryDetail("lastName", value)
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
                          <SummarySelectField
                            label="Role"
                            value={draftSummaryDetails.role}
                            values={["Basic User", "Admin", "Main User"]}
                            onActivate={() => setIsEditingSummary(true)}
                            onChange={(value) =>
                              updateSummaryDetail("role", value)
                            }
                          />
                          <SummarySelectField
                            label="Account Active"
                            value={draftSummaryDetails.accountActive}
                            values={["Active", "Disabled"]}
                            onActivate={() => setIsEditingSummary(true)}
                            onChange={(value) =>
                              updateSummaryDetail("accountActive", value)
                            }
                          />
                          <SummarySelectField
                            label="Request Eligibility"
                            value={draftSummaryDetails.requestEligibility}
                            values={["Enabled", "Disabled"]}
                            onActivate={() => setIsEditingSummary(true)}
                            onChange={(value) =>
                              updateSummaryDetail("requestEligibility", value)
                            }
                          />
                        </FieldGroup>
                      </FieldSet>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="@container/main flex min-h-0 flex-1 flex-col gap-3 overflow-hidden pt-4">
                  <Badge variant="secondary" className="w-fit">
                    {shipments.length} assigned certificates
                  </Badge>
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <ClassicDataTable
                      data={shipments}
                      showToolbar={false}
                      showAgentColumn={false}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
