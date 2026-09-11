"use client"

import { useState } from "react"
import { Switch } from "@base-ui/react/switch"
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Combobox,
  ComboboxContent,
  ComboboxItem,
  ComboboxTrigger,
} from "@/components/ui/combobox"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { CertificateColumnControl } from "@/components/certificate-column-control"
import {
  acceptsField,
  layoutGroups,
  moveLayoutField,
  newLayoutGroup,
} from "@/lib/certificate-layout/editing"
import type {
  CertificateField,
  CertificateGroup,
  CertificateLayout,
} from "@/lib/certificate-layout/schema"
import { documentNames } from "@/lib/okf/schema"

export type LayoutSelection =
  | {
      kind: "section" | "group" | "field" | "add" | "new-group"
      id: string
    }
  | { kind: "country" | "duplicate"; id?: never }
function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  const selectedLabel =
    options.find((option) => option.value === value)?.label ?? value
  return (
    <Field className="gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <Combobox
        items={options}
        value={value}
        onValueChange={(value) => {
          if (value !== null) onChange(value)
        }}
      >
        <ComboboxTrigger aria-label={label}>{selectedLabel}</ComboboxTrigger>
        <ComboboxContent>
          {options.map((option) => (
            <ComboboxItem key={option.value} value={option.value}>
              {option.label}
            </ComboboxItem>
          ))}
        </ComboboxContent>
      </Combobox>
    </Field>
  )
}
const named = (values: readonly string[]) =>
  values.map((value) => ({
    value,
    label: value === "Not set" ? "Not Set" : value,
  }))

type GoodsColumnDraft = {
  key: string
  label: string
  control: CertificateField["control"]
  options: string
}

const goodsControlOptions = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown" },
  { value: "textarea", label: "Long Text" },
]

function GoodsColumnsEditor({
  columns,
  onChange,
}: {
  columns: GoodsColumnDraft[]
  onChange: (columns: GoodsColumnDraft[]) => void
}) {
  function updateColumn(
    index: number,
    change: Partial<Omit<GoodsColumnDraft, "key">>
  ) {
    onChange(
      columns.map((column, columnIndex) =>
        columnIndex === index ? { ...column, ...change } : column
      )
    )
  }

  function moveColumn(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= columns.length) return
    const next = [...columns]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="grid gap-3">
      {columns.map((column, index) => (
        <div key={column.key} className="grid gap-3 rounded-lg border p-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
            <Field className="gap-1.5">
              <FieldLabel>Column Name</FieldLabel>
              <Input
                aria-label={`Column ${index + 1} name`}
                placeholder="Description"
                value={column.label}
                onChange={(event) =>
                  updateColumn(index, { label: event.target.value })
                }
              />
            </Field>
            <Choice
              label="Field Type"
              value={column.control}
              options={goodsControlOptions}
              onChange={(value) =>
                updateColumn(index, {
                  control: value as CertificateField["control"],
                  options: value === "select" ? column.options : "",
                })
              }
            />
            <div className="flex items-end gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Move ${column.label || `column ${index + 1}`} up`}
                disabled={index === 0}
                onClick={() => moveColumn(index, -1)}
              >
                <ArrowUpIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Move ${column.label || `column ${index + 1}`} down`}
                disabled={index === columns.length - 1}
                onClick={() => moveColumn(index, 1)}
              >
                <ArrowDownIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${column.label || `column ${index + 1}`}`}
                className="text-destructive"
                onClick={() =>
                  onChange(
                    columns.filter((_, columnIndex) => columnIndex !== index)
                  )
                }
              >
                <Trash2Icon />
              </Button>
            </div>
          </div>
          {column.control === "select" ? (
            <Field className="gap-1.5">
              <FieldLabel>Dropdown Options</FieldLabel>
              <Textarea
                aria-label={`${column.label || `Column ${index + 1}`} dropdown options`}
                placeholder={"Option one\nOption two\nOption three"}
                value={column.options}
                onChange={(event) =>
                  updateColumn(index, { options: event.target.value })
                }
              />
              <p className="text-sm text-muted-foreground">
                Enter one option per line.
              </p>
            </Field>
          ) : null}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          onChange([
            ...columns,
            {
              key: `goods-column-${Date.now()}`,
              label: "",
              control: "text",
              options: "",
            },
          ])
        }
      >
        <PlusIcon />
        Add Column
      </Button>
    </div>
  )
}

function DividerSwitch({
  checked,
  onCheckedChange,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <label className="flex min-h-8 items-center justify-between gap-4 text-sm">
      <span>Divider above</span>
      <Switch.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label="Divider above"
        className="relative h-5 w-9 shrink-0 cursor-pointer rounded-full bg-input transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:bg-primary"
      >
        <Switch.Thumb className="block size-4 translate-x-0.5 rounded-full bg-background shadow-sm transition-transform data-checked:translate-x-[1.125rem]" />
      </Switch.Root>
    </label>
  )
}

export function CertificateLayoutDialog({
  selection,
  layout,
  available,
  mappedFieldIds,
  edit,
  addField,
  onClose,
  onDuplicate,
  onReset,
}: {
  selection: LayoutSelection
  layout: CertificateLayout
  available: CertificateField[]
  mappedFieldIds: string[]
  edit: (change: (draft: CertificateLayout) => void) => void
  addField: (fieldId: string, groupId: string) => void
  onClose: () => void
  onDuplicate: (layout: CertificateLayout) => void
  onReset?: () => void
}) {
  const groups = layoutGroups(layout)
  const section =
    selection.kind === "section"
      ? layout.sections.find((section) => section.id === selection.id)
      : undefined
  const group =
    selection.kind === "group"
      ? groups.find((item) => item.group.id === selection.id)?.group
      : undefined
  const field =
    selection.kind === "field"
      ? available.find((field) => field.id === selection.id)
      : undefined
  const fieldGroup = field
    ? groups.find((item) =>
        item.group.fields.some((placement) => placement.fieldId === field.id)
      )?.group
    : undefined
  const placement = fieldGroup?.fields.find(
    (placement) => placement.fieldId === field?.id
  )
  const [newLabel, setNewLabel] = useState("")
  const [source, setSource] = useState("")
  const [newControl, setNewControl] =
    useState<CertificateField["control"]>("text")
  const [newOptions, setNewOptions] = useState("")
  const [newGroupName, setNewGroupName] = useState("")
  const [newGroupColumns, setNewGroupColumns] = useState(1)
  const [newGroupKind, setNewGroupKind] = useState<"fields" | "invoice-items">(
    "fields"
  )
  const [goodsColumns, setGoodsColumns] = useState<GoodsColumnDraft[]>([
    {
      key: "goods-column-1",
      label: "",
      control: "text",
      options: "",
    },
  ])
  const [editGoodsColumns, setEditGoodsColumns] = useState<GoodsColumnDraft[]>(
    () =>
      group?.kind === "invoice-items"
        ? group.fields.map((placement) => {
            const goodsField = available.find(
              (field) => field.id === placement.fieldId
            )
            return {
              key: placement.fieldId,
              label: placement.label || goodsField?.label || "",
              control: goodsField?.control ?? "text",
              options: goodsField?.options.join("\n") ?? "",
            }
          })
        : []
  )
  const [newGroupSeparator, setNewGroupSeparator] = useState(false)
  const [country, setCountry] = useState("")
  const [target, setTarget] = useState(
    field
      ? (groups.find((item) => acceptsField(item.group, field.id))?.group.id ??
          "")
      : (selection.id ?? "")
  )
  function updateGroup(change: (group: CertificateGroup) => void) {
    edit((draft) => {
      const found = layoutGroups(draft).find(
        (item) => item.group.id === group?.id
      )?.group
      if (found) change(found)
    })
  }
  function updateField(change: (field: CertificateField) => void) {
    edit((draft) => {
      const found = draft.fields.find((item) => item.id === field?.id)
      if (found) change(found)
    })
  }
  function reorder(delta: number, remove = false) {
    edit((draft) => {
      function shift<T>(items: T[], index: number) {
        if (index < 0) return
        if (remove) items.splice(index, 1)
        else if (index + delta >= 0 && index + delta < items.length)
          [items[index], items[index + delta]] = [
            items[index + delta],
            items[index],
          ]
      }
      if (section)
        shift(
          draft.sections,
          draft.sections.findIndex((item) => item.id === section.id)
        )
      if (group) {
        function visit(items: CertificateGroup[]) {
          const index = items.findIndex((item) => item.id === group!.id)
          if (index >= 0) shift(items, index)
          else items.forEach((item) => visit(item.groups))
        }
        draft.sections.forEach((section) => visit(section.groups))
      }
      if (field && fieldGroup) {
        const fields = layoutGroups(draft).find(
          (item) => item.group.id === fieldGroup.id
        )!.group.fields
        shift(
          fields,
          fields.findIndex((item) => item.fieldId === field.id)
        )
        fields.forEach((placement) => {
          delete placement.row
          delete placement.column
          delete placement.rowColumns
        })
      }
    })
    if (remove) onClose()
  }
  const canReorder = !!section || !!group || !!placement
  const fieldTarget =
    selection.kind === "add"
      ? groups.find((item) => item.group.id === selection.id)?.group
      : undefined
  const canCreateField =
    !!newLabel.trim() &&
    (newControl !== "select" ||
      newOptions.split("\n").some((option) => option.trim()))
  function createField() {
    if (!canCreateField) return
    const id =
      fieldTarget?.kind === "invoice-items"
        ? "invoiceItems.custom-" + crypto.randomUUID()
        : "field-" + crypto.randomUUID()
    edit((draft) => {
      draft.fields.push({
        id,
        label: newLabel.trim(),
        control: newControl,
        options:
          newControl === "select"
            ? newOptions
                .split("\n")
                .map((option) => option.trim())
                .filter(Boolean)
            : [],
        sourceDocument: source,
        instruction: "",
      })
      if (fieldTarget) moveLayoutField(draft, id, fieldTarget.id)
    })
    onClose()
  }
  function saveGoodsTable() {
    if (!group || group.kind !== "invoice-items") return
    const columns = editGoodsColumns.filter(
      (column) =>
        column.label.trim() &&
        (column.control !== "select" ||
          column.options.split("\n").some((option) => option.trim()))
    )
    if (!columns.length || columns.length !== editGoodsColumns.length) return
    edit((draft) => {
      const editedGroup = layoutGroups(draft).find(
        (item) => item.group.id === group.id
      )?.group
      if (!editedGroup) return
      const previousIds = editedGroup.fields.map(
        (placement) => placement.fieldId
      )
      editedGroup.fields = columns.map((column) => {
        const existingId = previousIds.includes(column.key)
          ? column.key
          : undefined
        if (existingId) {
          const existingField = draft.fields.find(
            (field) => field.id === existingId
          )
          if (existingField) {
            existingField.label = column.label.trim()
            existingField.control = column.control
            existingField.options =
              column.control === "select"
                ? column.options
                    .split("\n")
                    .map((option) => option.trim())
                    .filter(Boolean)
                : []
          }
          return { fieldId: existingId, span: 1 }
        }
        const fieldId = "invoiceItems.custom-" + crypto.randomUUID()
        draft.fields.push({
          id: fieldId,
          label: column.label.trim(),
          control: column.control,
          options:
            column.control === "select"
              ? column.options
                  .split("\n")
                  .map((option) => option.trim())
                  .filter(Boolean)
              : [],
          sourceDocument: "",
          instruction: "",
        })
        return { fieldId, span: 1 }
      })
      const retainedIds = new Set(
        editedGroup.fields.map((placement) => placement.fieldId)
      )
      draft.fields = draft.fields.filter(
        (field) => !previousIds.includes(field.id) || retainedIds.has(field.id)
      )
    })
    onClose()
  }
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent
        className="overflow-y-auto p-4 sm:max-w-md"
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            event.target instanceof HTMLInputElement
          ) {
            if (selection.kind === "add") return
            event.preventDefault()
            if (
              selection.kind === "new-group" ||
              selection.kind === "duplicate" ||
              (selection.kind === "group" && group?.kind === "invoice-items")
            )
              event.currentTarget
                .querySelector<HTMLButtonElement>("[data-primary-action]")
                ?.click()
            else onClose()
          }
        }}
      >
        <SheetHeader className="p-0 pr-8">
          <SheetTitle>
            {section
              ? "Edit page"
              : group
                ? "Edit block"
                : selection.kind === "new-group"
                  ? "Add block"
                  : field
                    ? placement
                      ? "Edit field"
                      : "Place field"
                    : selection.kind === "add"
                      ? "Add field"
                      : selection.kind === "duplicate"
                        ? "Create new country"
                        : "Country"}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Changes stay in your draft until you publish the layout.
          </SheetDescription>
        </SheetHeader>
        {section ? (
          <>
            <Field>
              <FieldLabel>Name</FieldLabel>
              <Input
                aria-label="Page name"
                value={section.title}
                onChange={(event) =>
                  edit((draft) => {
                    draft.sections.find(
                      (item) => item.id === section.id
                    )!.title = event.target.value
                  })
                }
              />
            </Field>
          </>
        ) : null}
        {group ? (
          <>
            <Field>
              <FieldLabel>Name</FieldLabel>
              <Input
                aria-label="Block name"
                placeholder="Optional"
                value={group.title}
                onChange={(event) =>
                  updateGroup((group) => {
                    group.title = event.target.value
                  })
                }
              />
            </Field>
            {group.kind === "invoice-items" ? (
              <>
                <Choice
                  label="Block Type"
                  value="invoice-items"
                  options={[{ value: "invoice-items", label: "Goods Table" }]}
                  onChange={() => undefined}
                />
                <Field>
                  <FieldLabel>What Does Each Goods Line Require?</FieldLabel>
                  <GoodsColumnsEditor
                    columns={editGoodsColumns}
                    onChange={setEditGoodsColumns}
                  />
                </Field>
                <DividerSwitch
                  checked={group.separator}
                  onCheckedChange={(checked) =>
                    updateGroup((group) => {
                      group.separator = checked
                    })
                  }
                />
                <Button
                  data-primary-action
                  disabled={
                    !editGoodsColumns.length ||
                    editGoodsColumns.some(
                      (column) =>
                        !column.label.trim() ||
                        (column.control === "select" &&
                          !column.options
                            .split("\n")
                            .some((option) => option.trim()))
                    )
                  }
                  onClick={saveGoodsTable}
                >
                  Save Goods Table
                </Button>
              </>
            ) : null}
          </>
        ) : null}
        {selection.kind === "new-group" ? (
          <>
            <Choice
              label="Block type"
              value={newGroupKind}
              options={[
                { value: "fields", label: "Form Fields" },
                { value: "invoice-items", label: "Goods Table" },
              ]}
              onChange={(value) =>
                setNewGroupKind(value as "fields" | "invoice-items")
              }
            />
            <Field>
              <FieldLabel>Name</FieldLabel>
              <Input
                aria-label="Block name"
                placeholder="Optional"
                value={newGroupName}
                onChange={(event) => setNewGroupName(event.target.value)}
                autoFocus
              />
            </Field>
            {newGroupKind === "invoice-items" ? (
              <Field>
                <FieldLabel>What does each goods line require?</FieldLabel>
                <GoodsColumnsEditor
                  columns={goodsColumns}
                  onChange={setGoodsColumns}
                />
                <p className="text-sm text-muted-foreground">
                  Define the name and field type for every table column.
                </p>
              </Field>
            ) : (
              <CertificateColumnControl
                label="Block columns"
                value={newGroupColumns}
                onChange={setNewGroupColumns}
              />
            )}
            <DividerSwitch
              checked={newGroupSeparator}
              onCheckedChange={setNewGroupSeparator}
            />
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                data-primary-action
                disabled={
                  newGroupKind === "invoice-items" &&
                  (!goodsColumns.length ||
                    goodsColumns.some(
                      (column) =>
                        !column.label.trim() ||
                        (column.control === "select" &&
                          !column.options
                            .split("\n")
                            .some((option) => option.trim()))
                    ))
                }
                onClick={() => {
                  edit((draft) => {
                    const section = draft.sections.find(
                      (section) => section.id === selection.id
                    )
                    if (!section) return
                    const createdGroup = {
                      ...newLayoutGroup(section.columns),
                      title:
                        newGroupName.trim() ||
                        (newGroupKind === "invoice-items" ? "Goods" : ""),
                      kind: newGroupKind,
                      columns:
                        newGroupKind === "invoice-items" ? 1 : newGroupColumns,
                      separator: newGroupSeparator,
                    }
                    if (newGroupKind === "invoice-items") {
                      for (const column of goodsColumns) {
                        const fieldId =
                          "invoiceItems.custom-" + crypto.randomUUID()
                        draft.fields.push({
                          id: fieldId,
                          label: column.label.trim(),
                          control: column.control,
                          options:
                            column.control === "select"
                              ? column.options
                                  .split("\n")
                                  .map((option) => option.trim())
                                  .filter(Boolean)
                              : [],
                          sourceDocument: "",
                          instruction: "",
                        })
                        createdGroup.fields.push({ fieldId, span: 1 })
                      }
                    }
                    section.groups.push(createdGroup)
                  })
                  onClose()
                }}
              >
                Add block
              </Button>
            </div>
          </>
        ) : null}
        {field ? (
          placement ? (
            <>
              <Field>
                <FieldLabel>Label</FieldLabel>
                <Input
                  aria-label="Field label"
                  value={placement.label || field.label}
                  onChange={(event) =>
                    edit((draft) => {
                      layoutGroups(draft)
                        .find((item) => item.group.id === fieldGroup!.id)!
                        .group.fields.find(
                          (item) => item.fieldId === field.id
                        )!.label = event.target.value
                    })
                  }
                />
              </Field>
              <div className="grid gap-4">
                <Choice
                  label="Input type"
                  value={field.control}
                  options={[
                    { value: "text", label: "Text" },
                    { value: "textarea", label: "Text Area" },
                    { value: "number", label: "Number" },
                    { value: "date", label: "Date" },
                    { value: "select", label: "Drop-Down" },
                  ]}
                  onChange={(value) =>
                    updateField((field) => {
                      field.control = value as CertificateField["control"]
                    })
                  }
                />
                {field.control === "select" ? (
                  <Field>
                    <FieldLabel>Choices, one per line</FieldLabel>
                    <Textarea
                      aria-label="Field choices"
                      value={field.options.join("\n")}
                      onChange={(event) =>
                        updateField((field) => {
                          field.options = event.target.value.split("\n")
                        })
                      }
                    />
                  </Field>
                ) : null}
                {mappedFieldIds.includes(field.id) ? (
                  <p className="text-sm text-muted-foreground">
                    Extraction uses the published document fields in the KB.
                  </p>
                ) : (
                  <Choice
                    label="Source document"
                    value={field.sourceDocument || "Not set"}
                    options={named(["Not set", ...documentNames])}
                    onChange={(value) =>
                      updateField((field) => {
                        field.sourceDocument = value === "Not set" ? "" : value
                      })
                    }
                  />
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-sm">{field.label}</p>
              <Choice
                label="Place in"
                value={target}
                options={groups
                  .filter((item) => acceptsField(item.group, field.id))
                  .map((item) => ({ value: item.group.id, label: item.path }))}
                onChange={setTarget}
              />
              <Button
                disabled={!target}
                onClick={() => {
                  addField(field.id, target)
                  onClose()
                }}
              >
                Add field
              </Button>
            </>
          )
        ) : null}
        {selection.kind === "add" ? (
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              createField()
            }}
          >
            <Field>
              <FieldLabel>Label</FieldLabel>
              <Input
                aria-label="Field label"
                value={newLabel}
                onChange={(event) => setNewLabel(event.target.value)}
                autoFocus
              />
            </Field>
            <Choice
              label="Source document"
              value={source || "Not set"}
              options={named(["Not set", ...documentNames])}
              onChange={(value) => setSource(value === "Not set" ? "" : value)}
            />
            <Choice
              label="Input type"
              value={newControl}
              options={[
                { value: "text", label: "Text" },
                { value: "textarea", label: "Text Area" },
                { value: "number", label: "Number" },
                { value: "date", label: "Date" },
                { value: "select", label: "Drop-Down" },
              ]}
              onChange={(value) =>
                setNewControl(value as CertificateField["control"])
              }
            />
            {newControl === "select" ? (
              <Field>
                <FieldLabel>Drop-down options, one per line</FieldLabel>
                <Textarea
                  aria-label="Drop-down options"
                  value={newOptions}
                  onChange={(event) => setNewOptions(event.target.value)}
                />
              </Field>
            ) : null}
            <Button type="submit" disabled={!canCreateField}>
              Create field
            </Button>
          </form>
        ) : null}
        {selection.kind === "country" ? (
          <>
            <Field>
              <FieldLabel>Country</FieldLabel>
              <Input
                aria-label="Layout country"
                readOnly={!!onReset}
                value={layout.country}
                onChange={(event) =>
                  edit((draft) => {
                    draft.country = event.target.value
                  })
                }
              />
            </Field>
            <Field>
              <FieldLabel>Other names, separated by commas</FieldLabel>
              <Input
                aria-label="Country aliases"
                value={layout.aliases.join(", ")}
                onChange={(event) =>
                  edit((draft) => {
                    draft.aliases = event.target.value
                      .split(",")
                      .map((value) => value.trimStart())
                  })
                }
              />
            </Field>
            {onReset ? (
              <Button variant="outline" onClick={onReset}>
                Reset draft
              </Button>
            ) : null}
            <Button onClick={onClose}>Done</Button>
          </>
        ) : null}
        {selection.kind === "duplicate" ? (
          <>
            <p className="text-sm text-muted-foreground">
              Reuse the complete country setup, including its fields and field
              placements.
            </p>
            <Input
              aria-label="New country name"
              placeholder="Country name"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
            />
            <Button
              data-primary-action
              disabled={
                !country.trim() ||
                country.trim().toLowerCase() === layout.country.toLowerCase()
              }
              onClick={() => {
                const copy = structuredClone(layout)
                onDuplicate({
                  ...copy,
                  country: country.trim(),
                  aliases: [],
                })
                onClose()
              }}
            >
              Create country draft
            </Button>
          </>
        ) : null}
        {canReorder ? (
          <div className="flex items-center justify-between gap-2 border-t pt-3">
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Move earlier"
                onClick={() => reorder(-1)}
              >
                <ArrowUpIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Move later"
                onClick={() => reorder(1)}
              >
                <ArrowDownIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Remove"
                className="text-destructive"
                onClick={() => reorder(0, true)}
              >
                <Trash2Icon />
              </Button>
            </div>
            <Button
              onClick={
                group?.kind === "invoice-items" ? saveGoodsTable : onClose
              }
            >
              Done
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
