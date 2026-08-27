"use client"

import * as React from "react"
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronsUpDownIcon,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  getMonthEndTemplate,
  loadMonthEndTemplate,
  makeTemplateId,
  saveMonthEndTemplate,
  type MonthEndTemplate,
  type TemplateCountryRow,
  type TemplateModuleLevel,
  type TemplateSimpleTask,
} from "@/lib/month-end-template"

const countriesModuleId = "countries"
const protectedModuleIds = new Set([
  countriesModuleId,
  "prepaid-accounts",
  "statements",
  "bank-reconciliation",
])

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
  const parentRows = template.countries

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
      },
    })
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
    const rowShape = {
      name: cleanName,
      indent: selectedParent ? selectedParent.indent + 1 : 0,
      checkable: form.draft.type === "group" ? false : undefined,
      invoiceRequired:
        form.draft.type === "country" ? form.draft.invoiceRequired : undefined,
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
        countries: template.countries.map((row, index) => {
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
      })
      setItemForm(null)
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
      countries,
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
                      <CardDescription>
                        Template sections used by the month-end checklist.
                      </CardDescription>
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
                          className="cursor-pointer"
                          onClick={() => {
                            setActiveModuleId(module.id)
                            setItemForm(null)
                          }}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {module.name}
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
                <CardHeader className="gap-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <Button
                        variant="ghost"
                        className="mb-2 -ml-3"
                        onClick={() => {
                          setActiveModuleId(null)
                          setItemForm(null)
                        }}
                      >
                        <ArrowLeftIcon />
                        Modules
                      </Button>
                      <CardTitle>{activeModule?.name}</CardTitle>
                      <CardDescription>
                        Add or edit checklist rows inside this module.
                      </CardDescription>
                    </div>
                    <Button onClick={startAddItem}>
                      <PlusIcon />
                      Add New
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {itemForm ? (
                    <ItemFormPanel
                      form={itemForm}
                      parentRows={parentRows}
                      template={template}
                      onChange={setItemForm}
                      onCancel={() => setItemForm(null)}
                      onSave={saveItemForm}
                    />
                  ) : null}

                  {activeModuleId === countriesModuleId ? (
                    <CountriesTable
                      template={template}
                      onEditCountry={startEditCountry}
                      onDeleteCountry={deleteCountryRow}
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

function CountriesTable({
  template,
  onEditCountry,
  onDeleteCountry,
}: {
  template: MonthEndTemplate
  onEditCountry: (row: TemplateCountryRow, rowIndex: number) => void
  onDeleteCountry: (rowIndex: number) => void
}) {
  return (
    <Table containerClassName="rounded-lg border bg-background">
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Parent</TableHead>
          <TableHead>Required Fields</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {template.countries.map((row, rowIndex) => {
          const isGroup = row.checkable === false
          const parentId = findParentId(template, rowIndex)
          const parent = template.countries.find((item) => item.id === parentId)

          return (
            <TableRow
              key={row.id}
              className={isGroup ? "bg-muted/30" : undefined}
            >
              <TableCell className={isGroup ? "font-semibold" : "font-medium"}>
                <span
                  className="block truncate"
                  style={{ marginLeft: `${row.indent * 1.5}rem` }}
                >
                  {row.name}
                </span>
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
                    <Badge variant="outline">Reconciliation</Badge>
                    <Badge variant="outline">Journal</Badge>
                  </div>
                )}
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
                    <DropdownMenuItem
                      onClick={() => onEditCountry(row, rowIndex)}
                    >
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
          )
        })}
      </TableBody>
    </Table>
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
}: {
  form: Extract<ItemForm, { mode: "add-country" | "edit-country" }>
  parentRows: TemplateCountryRow[]
  template: MonthEndTemplate
  onChange: (form: ItemForm) => void
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

  function updateDraft(updates: Partial<CountryDraft>) {
    onChange({ ...form, draft: { ...form.draft, ...updates } })
  }

  return (
    <FieldSet>
      <FieldLegend>Country Details</FieldLegend>
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
      </FieldGroup>
    </FieldSet>
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
            className="w-full cursor-pointer justify-between"
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
