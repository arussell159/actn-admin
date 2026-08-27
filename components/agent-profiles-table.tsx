"use client"

import * as React from "react"
import { AppLink } from "@/components/app-link"
import { ChevronDownIcon, PlusIcon, SearchIcon } from "lucide-react"

import { getAgentProfileUrl, type AgentProfile } from "@/lib/agents"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FieldLabel } from "@/components/ui/field"
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

type AgentProfilesTableProps = {
  agents: AgentProfile[]
}

export function AgentProfilesTable({ agents }: AgentProfilesTableProps) {
  const [query, setQuery] = React.useState("")
  const [expandedAgentId, setExpandedAgentId] = React.useState<string>()
  const [savedAgents, setSavedAgents] = React.useState<AgentProfile[]>(agents)
  const [draftAgents, setDraftAgents] = React.useState<AgentProfile[]>(agents)
  const [newAgent, setNewAgent] = React.useState<AgentProfile | null>(null)
  const [isEditingAgents, setIsEditingAgents] = React.useState(false)

  const normalizedQuery = query.trim().toLowerCase()
  const filteredAgents = normalizedQuery
    ? draftAgents.filter((agent) =>
        [
          agent.firstName,
          agent.lastName,
          agent.email,
          agent.role,
          agent.accountActive ? "Active" : "Disabled",
          agent.requestEligibility ? "Enabled" : "Disabled",
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery)
      )
    : draftAgents

  const updateAgent = <Key extends keyof AgentProfile>(
    agentId: string,
    key: Key,
    value: AgentProfile[Key]
  ) => {
    setIsEditingAgents(true)
    setDraftAgents((currentAgents) =>
      currentAgents.map((agent) =>
        agent.id === agentId
          ? {
              ...agent,
              [key]: value,
            }
          : agent
      )
    )
  }

  const saveAgents = () => {
    setSavedAgents(draftAgents)
    setIsEditingAgents(false)
  }

  const cancelAgents = () => {
    setDraftAgents(savedAgents)
    setIsEditingAgents(false)
  }

  const addAgent = () => {
    setNewAgent({
      id: `agent-${draftAgents.length + 1}`,
      firstName: "",
      lastName: "",
      email: "",
      role: "Basic User",
      accountActive: true,
      requestEligibility: true,
    })
    setExpandedAgentId(undefined)
    setQuery("")
  }

  const updateNewAgent = <Key extends keyof AgentProfile>(
    key: Key,
    value: AgentProfile[Key]
  ) => {
    setNewAgent((currentAgent) =>
      currentAgent
        ? {
            ...currentAgent,
            [key]: value,
          }
        : currentAgent
    )
  }

  const saveNewAgent = () => {
    if (!newAgent) return

    setDraftAgents((currentAgents) => [newAgent, ...currentAgents])
    setSavedAgents((currentAgents) => [newAgent, ...currentAgents])
    setNewAgent(null)
  }

  const cancelNewAgent = () => {
    setNewAgent(null)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {isEditingAgents ? (
          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={cancelAgents}
            >
              Cancel
            </Button>
            <Button size="sm" className="cursor-pointer" onClick={saveAgents}>
              Save
            </Button>
          </div>
        ) : newAgent ? (
          <div />
        ) : (
          <Button size="sm" className="w-fit cursor-pointer" onClick={addAgent}>
            <PlusIcon data-icon="inline-start" />
            Add Agent
          </Button>
        )}
        <div className="relative h-9 w-full max-w-sm">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search agents"
            className="h-9 pl-9 text-sm focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/40"
          />
        </div>
      </div>
      {newAgent ? (
        <div className="rounded-lg border bg-muted/20 p-4">
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <FieldLabel htmlFor="new-agent-first-name">First Name</FieldLabel>
                <Input
                  id="new-agent-first-name"
                  value={newAgent.firstName}
                  onChange={(event) =>
                    updateNewAgent("firstName", event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="new-agent-last-name">Last Name</FieldLabel>
                <Input
                  id="new-agent-last-name"
                  value={newAgent.lastName}
                  onChange={(event) =>
                    updateNewAgent("lastName", event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="new-agent-email">Email</FieldLabel>
                <Input
                  id="new-agent-email"
                  value={newAgent.email}
                  onChange={(event) =>
                    updateNewAgent("email", event.target.value)
                  }
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <FieldLabel htmlFor="new-agent-role">Role</FieldLabel>
                <Select
                  value={newAgent.role}
                  onValueChange={(value) => {
                    if (value) updateNewAgent("role", value)
                  }}
                >
                  <SelectTrigger
                    id="new-agent-role"
                    className="w-full cursor-pointer"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="Basic User">Basic User</SelectItem>
                      <SelectItem value="Admin">Admin</SelectItem>
                      <SelectItem value="Main User">Main User</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="new-agent-account-active">
                  Account Active
                </FieldLabel>
                <Select
                  value={newAgent.accountActive ? "Active" : "Disabled"}
                  onValueChange={(value) =>
                    updateNewAgent("accountActive", value === "Active")
                  }
                >
                  <SelectTrigger
                    id="new-agent-account-active"
                    className="w-full cursor-pointer"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Disabled">Disabled</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="new-agent-request-eligibility">
                  Request Eligibility
                </FieldLabel>
                <Select
                  value={newAgent.requestEligibility ? "Enabled" : "Disabled"}
                  onValueChange={(value) =>
                    updateNewAgent("requestEligibility", value === "Enabled")
                  }
                >
                  <SelectTrigger
                    id="new-agent-request-eligibility"
                    className="w-full cursor-pointer"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="Enabled">Enabled</SelectItem>
                      <SelectItem value="Disabled">Disabled</SelectItem>
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
                onClick={cancelNewAgent}
              >
                Cancel
              </Button>
              <Button size="sm" className="cursor-pointer" onClick={saveNewAgent}>
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
        <Table containerClassName="shrink-0 overflow-visible" className="table-fixed">
          <colgroup>
            <col className="w-10" />
            <col className="w-[28%]" />
            <col className="w-[34%]" />
            <col className="w-[18%]" />
            <col className="w-[20%]" />
          </colgroup>
          <TableHeader className="bg-muted shadow-[0_1px_0_var(--border)]">
            <TableRow>
              <TableHead className="bg-muted" />
              <TableHead className="bg-muted">Name</TableHead>
              <TableHead className="bg-muted">Email</TableHead>
              <TableHead className="bg-muted">Role</TableHead>
              <TableHead className="bg-muted">Access</TableHead>
            </TableRow>
          </TableHeader>
        </Table>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Table containerClassName="overflow-visible" className="table-fixed">
            <colgroup>
              <col className="w-10" />
              <col className="w-[28%]" />
              <col className="w-[34%]" />
              <col className="w-[18%]" />
              <col className="w-[20%]" />
            </colgroup>
            <TableBody>
              {filteredAgents.length ? (
                filteredAgents.map((agent) => {
                  const isExpanded = expandedAgentId === agent.id
                  const fullName = [agent.firstName, agent.lastName]
                    .filter(Boolean)
                    .join(" ")

                  return (
                    <React.Fragment key={agent.id}>
                      <TableRow
                        className="h-12 cursor-pointer"
                        onClick={() =>
                          setExpandedAgentId(isExpanded ? undefined : agent.id)
                        }
                      >
                        <TableCell className="h-12 py-2">
                          <ChevronDownIcon
                            className={`size-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          />
                        </TableCell>
                        <TableCell className="h-12 truncate py-2 font-medium">
                          {fullName ? (
                            <AppLink
                              href={getAgentProfileUrl(fullName)}
                              className="block truncate text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {fullName}
                            </AppLink>
                          ) : (
                            <span className="text-muted-foreground">
                              New agent
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="h-12 truncate py-2">
                          {agent.email}
                        </TableCell>
                        <TableCell className="h-12 truncate py-2">
                          {agent.role}
                        </TableCell>
                        <TableCell className="h-12 py-2">
                          <Badge
                            variant="outline"
                            className={
                              agent.accountActive
                                ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
                                : "border-muted bg-muted text-muted-foreground"
                            }
                          >
                            {agent.accountActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                      {isExpanded ? (
                        <TableRow>
                          <TableCell colSpan={5} className="bg-muted/20 p-4">
                            <div className="grid gap-4">
                              <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                  <FieldLabel htmlFor={`${agent.id}-first-name`}>
                                    First Name
                                  </FieldLabel>
                                  <Input
                                    id={`${agent.id}-first-name`}
                                    value={agent.firstName}
                                    onChange={(event) =>
                                      updateAgent(
                                        agent.id,
                                        "firstName",
                                        event.target.value
                                      )
                                    }
                                  />
                                </div>
                                <div className="space-y-2">
                                  <FieldLabel htmlFor={`${agent.id}-last-name`}>
                                    Last Name
                                  </FieldLabel>
                                  <Input
                                    id={`${agent.id}-last-name`}
                                    value={agent.lastName}
                                    onChange={(event) =>
                                      updateAgent(
                                        agent.id,
                                        "lastName",
                                        event.target.value
                                      )
                                    }
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <FieldLabel htmlFor={`${agent.id}-email`}>
                                  Email
                                </FieldLabel>
                                <Input
                                  id={`${agent.id}-email`}
                                  value={agent.email}
                                  onChange={(event) =>
                                    updateAgent(
                                      agent.id,
                                      "email",
                                      event.target.value
                                    )
                                  }
                                />
                              </div>
                              <div className="grid gap-4 md:grid-cols-3">
                                <div className="space-y-2">
                                  <FieldLabel htmlFor={`${agent.id}-role`}>
                                    Role
                                  </FieldLabel>
                                  <Select
                                    value={agent.role}
                                    onValueChange={(value) => {
                                      if (value) {
                                        updateAgent(agent.id, "role", value)
                                      }
                                    }}
                                  >
                                    <SelectTrigger
                                      id={`${agent.id}-role`}
                                      className="w-full cursor-pointer"
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
                                  <FieldLabel htmlFor={`${agent.id}-account-active`}>
                                    Account Active
                                  </FieldLabel>
                                  <Select
                                    value={
                                      agent.accountActive ? "Active" : "Disabled"
                                    }
                                    onValueChange={(value) =>
                                      updateAgent(
                                        agent.id,
                                        "accountActive",
                                        value === "Active"
                                      )
                                    }
                                  >
                                    <SelectTrigger
                                      id={`${agent.id}-account-active`}
                                      className="w-full cursor-pointer"
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
                                  <FieldLabel
                                    htmlFor={`${agent.id}-request-eligibility`}
                                  >
                                    Request Eligibility
                                  </FieldLabel>
                                  <Select
                                    value={
                                      agent.requestEligibility
                                        ? "Enabled"
                                        : "Disabled"
                                    }
                                    onValueChange={(value) =>
                                      updateAgent(
                                        agent.id,
                                        "requestEligibility",
                                        value === "Enabled"
                                      )
                                    }
                                  >
                                    <SelectTrigger
                                      id={`${agent.id}-request-eligibility`}
                                      className="w-full cursor-pointer"
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
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No agents found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      )}
    </div>
  )
}
