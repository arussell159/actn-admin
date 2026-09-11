"use client"

import { authenticatedFetch } from "@/lib/client"
import { useEffect, useRef, useState } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  type DragEndEvent,
} from "@dnd-kit/core"
import { PencilIcon, PlusIcon, SeparatorHorizontalIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
} from "@/components/ui/table"
import {
  CertificateForm,
  certificateFieldGridClass,
  certificateSpanClass,
} from "@/components/certificate-form"
import { CertificateFieldControl } from "@/components/certificate-field-control"
import { CertificatePageImporter } from "@/components/certificate-page-importer"
import {
  LayoutDragField,
  LayoutDropSlot,
} from "@/components/certificate-layout-drag"
import {
  CertificateLayoutDialog,
  type LayoutSelection,
} from "@/components/certificate-layout-dialog"
import { cachePublishedLayout } from "@/lib/certificate-layout/client"
import {
  deleteCertificateLayoutDraft,
  loadCertificateLayoutDraft,
  saveCertificateLayoutDraft,
} from "@/lib/certificate-layout/draft-client"
import {
  acceptsField,
  appendImportedPage,
  layoutGroups,
  moveLayoutField,
} from "@/lib/certificate-layout/editing"
import {
  certificateLayoutSchema,
  layoutRecordSchema,
  type CertificateField,
  type CertificateGroup,
  type CertificateLayout,
  type CertificateLayoutRecord,
} from "@/lib/certificate-layout/schema"
import { stableSignature } from "@/lib/okf/client"
import { editableCertificateLayout } from "@/lib/certificate-layout/default-sections"
const newGroup = (): CertificateGroup => ({
  id: "group-" + crypto.randomUUID(),
  title: "",
  kind: "fields",
  columns: 1,
  span: 1,
  separator: false,
  breakpoint: "md",
  fields: [],
  groups: [],
})
const emptyLayout = (): CertificateLayout => ({
  schemaVersion: 1,
  country: "",
  aliases: [],
  fields: [],
  sections: [
    {
      id: "section-" + crypto.randomUUID(),
      title: "Certificate",
      columns: 1,
      groups: [newGroup()],
    },
  ],
})
export function CertificateLayoutEditor({
  record,
  canPublish,
  onCountryNameChange,
  onPublished,
  mappedFieldIds = [],
  onDuplicate,
}: {
  record?: CertificateLayoutRecord
  canPublish: boolean
  onCountryNameChange?: (country: string) => void
  onPublished: (row: CertificateLayoutRecord) => void
  mappedFieldIds?: string[]
  onDuplicate: (layout: CertificateLayout) => void
}) {
  const [layout, setLayout] = useState<CertificateLayout>(
    () => record?.layout ?? emptyLayout()
  )
  const [base, setBase] = useState(record)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [selection, setSelection] = useState<LayoutSelection | null>(null)
  const [view, setView] = useState<"edit" | "preview">("edit")
  const [dragged, setDragged] = useState<string | null>(null)
  const [draftReady, setDraftReady] = useState(false)
  const draftKey = record?.country_key ?? "new"
  const draftEdit = useRef(0)
  const lastSavedDraft = useRef("")
  const draftSaveChain = useRef<Promise<void>>(Promise.resolve())
  const publishing = useRef(false)
  const dirty =
    !base || stableSignature(layout) !== stableSignature(base.layout)
  const stale = !!record && !!base && record.revision !== base.revision
  useEffect(() => {
    onCountryNameChange?.(layout.country)
  }, [layout.country, onCountryNameChange])
  useEffect(() => {
    let active = true
    void loadCertificateLayoutDraft(draftKey)
      .then((saved) => {
        if (!active || !saved) return
        if (saved.base_revision !== (record?.revision ?? 0)) {
          setError("The shared draft is based on an older layout revision.")
          return
        }
        draftEdit.current = saved.edit
        lastSavedDraft.current = stableSignature(saved.layout)
        setLayout(editableCertificateLayout(saved.layout))
      })
      .catch((error) => {
        if (active)
          setError(
            error instanceof Error
              ? error.message
              : "Could not load the shared layout draft."
          )
      })
      .finally(() => {
        if (active) setDraftReady(true)
      })
    return () => {
      active = false
    }
    // The parent keys this editor by country; remote revisions must not overwrite edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (!dirty || !draftReady) return
    const parsed = certificateLayoutSchema.safeParse(layout)
    const signature = stableSignature(layout)
    if (signature === lastSavedDraft.current) return
    const timer = window.setTimeout(() => {
      if (!parsed.success || publishing.current) return
      draftSaveChain.current = draftSaveChain.current
        .catch(() => undefined)
        .then(async () => {
          if (publishing.current) return
          const saved = await saveCertificateLayoutDraft({
            draftKey,
            layout: parsed.data,
            baseRevision: base?.revision ?? 0,
            expectedEdit: draftEdit.current,
          })
          draftEdit.current = saved.edit
          lastSavedDraft.current = signature
        })
        .catch((error) => {
          setError(
            error instanceof Error
              ? error.message
              : "Could not save the shared layout draft."
          )
        })
    }, 750)
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => {
      clearTimeout(timer)
      window.removeEventListener("beforeunload", warn)
    }
  }, [layout, dirty, draftKey, base, draftReady])
  function edit(change: (draft: CertificateLayout) => void) {
    setLayout((current) => {
      const next = structuredClone(current)
      change(next)
      return next
    })
    setMessage("")
    setError("")
  }
  const availableFields = layout.fields
  async function publish() {
    const parsed = certificateLayoutSchema.safeParse({
      ...layout,
      aliases: layout.aliases.map((alias) => alias.trim()).filter(Boolean),
      fields: layout.fields.map((field) => ({
        ...field,
        options: field.options.map((option) => option.trim()).filter(Boolean),
      })),
    })
    if (!parsed.success) {
      setError(parsed.error.issues.map((issue) => issue.message).join(" "))
      return
    }
    publishing.current = true
    setBusy(true)
    setError("")
    try {
      await draftSaveChain.current
      const signature = stableSignature(parsed.data)
      if (signature !== lastSavedDraft.current) {
        const savedDraft = await saveCertificateLayoutDraft({
          draftKey,
          layout: parsed.data,
          baseRevision: base?.revision ?? 0,
          expectedEdit: draftEdit.current,
        })
        draftEdit.current = savedDraft.edit
        lastSavedDraft.current = signature
      }
      const response = await authenticatedFetch("/api/okf/layouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          layout: parsed.data,
          expectedRevision: base?.revision ?? 0,
        }),
      })
      const result = await response.json()
      if (!response.ok)
        throw Error(result.message || "Could not publish layout.")
      const row = layoutRecordSchema.parse(result.row)
      setBase(row)
      setLayout(row.layout)
      draftEdit.current = 0
      lastSavedDraft.current = ""
      cachePublishedLayout(row)
      onPublished(row)
      setMessage(
        `Layout published. ${row.layout.country} certificates now use revision ${row.revision}.`
      )
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not publish layout."
      )
    } finally {
      publishing.current = false
      setBusy(false)
    }
  }
  const editing = view === "edit" && canPublish && !busy
  const groups = layoutGroups(layout)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  )
  function addField(fieldId: string, target: string, overFieldId?: string) {
    const field = availableFields.find((field) => field.id === fieldId)
    const group = groups.find((item) => item.group.id === target)?.group
    if (!field || !group || !acceptsField(group, fieldId)) {
      setError(
        "Invoice item columns belong in the Invoice Items table. Other fields belong in a form block."
      )
      return
    }
    edit((draft) => {
      if (!draft.fields.some((item) => item.id === fieldId))
        draft.fields.push(field)
      moveLayoutField(draft, fieldId, target, overFieldId)
    })
  }
  function drop(event: DragEndEvent) {
    setDragged(null)
    const target = event.over?.data.current
    if (target?.groupId)
      addField(
        String(event.active.data.current?.fieldId),
        String(target.groupId),
        target.fieldId
      )
  }
  function fieldView(field: CertificateField) {
    const group = groups.find((item) =>
      item.group.fields.some((placement) => placement.fieldId === field.id)
    )
    return editing ? (
      <LayoutDragField
        field={field}
        groupId={group?.group.id}
        onClick={() => setSelection({ kind: "field", id: field.id })}
      />
    ) : (
      <CertificateFieldControl field={field} value="" />
    )
  }
  return (
    <div className="grid min-w-0 gap-5">
      <div
        id="certificate-editor-content"
        aria-label="Certificate editor"
        className="grid min-w-0 gap-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
              multiple={false}
              value={[view]}
              onValueChange={(value) =>
                setView(value[0] === "preview" ? "preview" : "edit")
              }
              variant="outline"
              spacing={0}
              aria-label="Editor view"
            >
              <ToggleGroupItem value="edit">Edit</ToggleGroupItem>
              <ToggleGroupItem value="preview">Preview</ToggleGroupItem>
            </ToggleGroup>
            {editing ? (
              <CertificatePageImporter
                country={layout.country}
                pageNumber={
                  layout.fields.length ? layout.sections.length + 1 : 1
                }
                disabled={!layout.country.trim()}
                onAccept={(page) => {
                  const pageNumber = layout.fields.length
                    ? layout.sections.length + 1
                    : 1
                  setLayout((current) => appendImportedPage(current, page))
                  setError("")
                  setMessage(`Page ${pageNumber} added to the draft.`)
                }}
              />
            ) : null}
            {editing ? (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  const section = {
                    id: "section-" + crypto.randomUUID(),
                    title: "New page",
                    columns: 1,
                    groups: [newGroup()],
                  }
                  edit((draft) => draft.sections.push(section))
                  setSelection({ kind: "section", id: section.id })
                }}
              >
                <PlusIcon />
                Add page
              </Button>
            ) : null}
            {canPublish ? (
              <Button
                variant="ghost"
                disabled={busy}
                aria-label="Country settings"
                onClick={() => setSelection({ kind: "country" })}
              >
                <PencilIcon />
                Country
              </Button>
            ) : null}
          </div>
          <Button
            disabled={!canPublish || busy || !dirty || stale}
            onClick={() => void publish()}
          >
            {busy ? "Publishing…" : "Publish"}
          </Button>
        </div>
        {error || stale ? (
          <p role="alert" className="text-sm text-destructive">
            {error ||
              "A newer layout was published. Reload the saved layout before publishing."}
            {stale ? (
              <Button
                variant="link"
                onClick={() => {
                  setLayout(record!.layout)
                  setBase(record)
                  setError("")
                }}
              >
                Reload saved layout
              </Button>
            ) : null}
          </p>
        ) : null}
        {message ? (
          <p role="status" className="text-sm">
            {message}
          </p>
        ) : null}
        <DndContext
          sensors={sensors}
          collisionDetection={(args) => {
            const hits = pointerWithin(args)
            return hits.length ? hits : rectIntersection(args)
          }}
          onDragStart={(event) =>
            setDragged(String(event.active.data.current?.fieldId))
          }
          onDragEnd={drop}
          onDragCancel={() => setDragged(null)}
        >
          <div className="min-w-0">
            <div className="min-w-0">
              <CertificateForm
                layout={layout}
                sectionTitle={
                  editing
                    ? (section) => (
                        <Button
                          variant="ghost"
                          className="h-auto justify-start p-0 text-left text-base font-semibold whitespace-normal hover:underline"
                          aria-label={`Rename page ${section.title}`}
                          onClick={() =>
                            setSelection({ kind: "section", id: section.id })
                          }
                        >
                          {section.title}
                          <PencilIcon className="size-3 text-muted-foreground" />
                        </Button>
                      )
                    : undefined
                }
                sectionAction={
                  editing
                    ? (section) => (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Add block to ${section.title}`}
                          onClick={() => {
                            setSelection({
                              kind: "new-group",
                              id: section.id,
                            })
                          }}
                        >
                          <PlusIcon className="size-4" />
                          <span className="hidden sm:inline">Add block</span>
                        </Button>
                      )
                    : undefined
                }
                groupTitle={
                  editing
                    ? (group) =>
                        !group.title &&
                        ["fields", "invoice-values"].includes(
                          group.kind
                        ) ? null : (
                          <Button
                            variant="ghost"
                            className="h-auto justify-start p-0 text-left text-[15px] font-semibold whitespace-normal hover:underline"
                            aria-label={`Edit block ${group.title || "untitled"}`}
                            onClick={() =>
                              setSelection({ kind: "group", id: group.id })
                            }
                          >
                            {group.title || (
                              <span className="text-xs font-normal text-muted-foreground">
                                {group.kind === "documents"
                                  ? "Documents"
                                  : group.kind === "invoice-items"
                                    ? "Invoice items"
                                    : "Corrections"}
                              </span>
                            )}
                          </Button>
                        )
                    : undefined
                }
                groupAction={
                  editing
                    ? (group) => (
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {[
                            "fields",
                            "invoice-values",
                            "invoice-items",
                          ].includes(group.kind) ? (
                            <div
                              className="flex items-center rounded-lg border p-0.5"
                              aria-label="Block columns"
                            >
                              {[1, 2, 3, 4].map((columns) => (
                                <Button
                                  key={columns}
                                  variant={
                                    group.columns === columns
                                      ? "secondary"
                                      : "ghost"
                                  }
                                  size="icon-sm"
                                  className="size-7 text-xs"
                                  aria-label={`${columns} ${columns === 1 ? "column" : "columns"}`}
                                  aria-pressed={group.columns === columns}
                                  onClick={() =>
                                    edit((draft) => {
                                      const found = layoutGroups(draft).find(
                                        (item) => item.group.id === group.id
                                      )?.group
                                      if (!found) return
                                      found.columns = columns
                                      found.fields.forEach((placement) => {
                                        placement.span = Math.min(
                                          placement.span,
                                          columns
                                        )
                                        delete placement.row
                                        delete placement.column
                                      })
                                    })
                                  }
                                >
                                  {columns}
                                </Button>
                              ))}
                            </div>
                          ) : null}
                          <Button
                            variant={group.separator ? "secondary" : "ghost"}
                            size="sm"
                            aria-label="Divider above block"
                            aria-pressed={group.separator}
                            onClick={() =>
                              edit((draft) => {
                                const found = layoutGroups(draft).find(
                                  (item) => item.group.id === group.id
                                )?.group
                                if (found) found.separator = !found.separator
                              })
                            }
                          >
                            <SeparatorHorizontalIcon />
                            <span className="hidden sm:inline">Divider</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="More block settings"
                            onClick={() =>
                              setSelection({ kind: "group", id: group.id })
                            }
                          >
                            <PencilIcon className="size-3.5" />
                          </Button>
                        </div>
                      )
                    : undefined
                }
                groupFooter={
                  editing
                    ? (group) =>
                        dragged ? (
                          acceptsField(group, dragged) ? (
                            <LayoutDropSlot group={group} />
                          ) : null
                        ) : [
                            "fields",
                            "invoice-values",
                            "invoice-items",
                          ].includes(group.kind) ? (
                          <Button
                            variant="ghost"
                            className="h-9 w-full border border-dashed text-muted-foreground hover:text-foreground"
                            onClick={() =>
                              setSelection({ kind: "add", id: group.id })
                            }
                          >
                            <PlusIcon />
                            Create field here
                          </Button>
                        ) : null
                    : undefined
                }
                renderField={fieldView}
                renderSpecial={(group, fields, centerSingleColumn) =>
                  group.kind === "invoice-items" ? (
                    editing ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {fields.map((field) => (
                          <div key={field.id}>{fieldView(field)}</div>
                        ))}
                      </div>
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
                          <TableBody />
                        </Table>
                      </div>
                    )
                  ) : group.kind === "invoice-values" ? (
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
                          {fieldView(field)}
                        </div>
                      ))}
                    </div>
                  ) : group.kind === "documents" ? (
                    <p className="text-sm text-muted-foreground">
                      Uploaded files appear here.
                    </p>
                  ) : null
                }
              />
            </div>
          </div>
          <DragOverlay>
            {dragged ? (
              <div className="rounded-md border bg-background px-4 py-3 text-sm shadow-lg">
                {availableFields.find((field) => field.id === dragged)?.label}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
      {selection ? (
        <CertificateLayoutDialog
          key={selection.kind + (selection.id ?? "")}
          selection={selection}
          layout={layout}
          available={availableFields}
          mappedFieldIds={mappedFieldIds}
          edit={edit}
          addField={addField}
          onClose={() => setSelection(null)}
          onDuplicate={(copy) => {
            if (record) onDuplicate(copy)
            else {
              setLayout(copy)
              setBase(undefined)
              setError("")
              setMessage("")
            }
          }}
          onReset={
            base
              ? () => {
                  setLayout(record?.layout ?? base.layout)
                  setBase(record ?? base)
                  setSelection(null)
                  const expectedEdit = draftEdit.current || undefined
                  draftEdit.current = 0
                  lastSavedDraft.current = ""
                  void deleteCertificateLayoutDraft(
                    draftKey,
                    expectedEdit
                  ).catch((error) =>
                    setError(
                      error instanceof Error
                        ? error.message
                        : "Could not discard the shared layout draft."
                    )
                  )
                }
              : undefined
          }
        />
      ) : null}
    </div>
  )
}
