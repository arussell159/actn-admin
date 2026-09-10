"use client"

import { useId, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
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
import { formPresentation } from "@/lib/okf/seed"
import {
  stages,
  type KnowledgeContent,
  type KnowledgePage,
  type KnowledgeRule,
} from "@/lib/okf/schema"

export function TextEdit({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string
  value: string
  onChange?: (value: string) => void
  multiline?: boolean
}) {
  return onChange ? (
    <label className="grid gap-1 text-xs text-muted-foreground">
      <span>{label}</span>
      {multiline ? (
        <Textarea
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-20 text-sm text-foreground"
        />
      ) : (
        <Input
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="text-sm text-foreground"
        />
      )}
    </label>
  ) : (
    <span className="whitespace-pre-wrap">{value}</span>
  )
}
export function Choice({
  label,
  value,
  values,
  onChange,
}: {
  label: string
  value: string
  values: readonly string[]
  onChange: (value: string) => void
}) {
  const id = useId()
  return (
    <Field className="gap-1">
      <FieldLabel
        htmlFor={id}
        className="text-xs font-normal text-muted-foreground"
      >
        {label}
      </FieldLabel>
      <Select
        value={value}
        onValueChange={(next) => {
          if (next !== null) onChange(next)
        }}
      >
        <SelectTrigger id={id} className="h-9 w-full min-w-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {values.map((v) => (
            <SelectItem key={v} value={v}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}
function GridTable({
  headings,
  children,
}: {
  headings: string[]
  children: ReactNode
}) {
  return (
    <Table
      containerClassName="rounded-lg border"
      className="min-w-[640px] text-left"
    >
      <TableHeader className="bg-muted/50">
        <TableRow>
          {headings.map((h) => (
            <TableHead key={h} className="h-auto px-3 py-2 whitespace-normal">
              {h}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody className="[&_td]:min-w-36 [&_td]:p-3 [&_td]:align-top [&_td]:whitespace-normal">
        {children}
      </TableBody>
    </Table>
  )
}
export const okfHref = (id: string) =>
  `/knowledge-base?page=${encodeURIComponent(id)}`

export function OkfContent({
  page,
  pages,
  onChange,
  options,
}: {
  page: KnowledgePage
  pages: KnowledgePage[]
  onChange?: (content: KnowledgeContent) => void
  options: Record<string, string[]>
}) {
  const content = page.content
  const editable = !!onChange
  const allFields = pages.flatMap((p) => p.content.fields)
  const set = <K extends keyof KnowledgeContent>(
    key: K,
    value: KnowledgeContent[K]
  ) => onChange?.({ ...content, [key]: value })
  const references = (ids: string[]) =>
    ids.map((id) => {
      const target = pages.find(
        (p) =>
          p.id === id ||
          [...p.content.rules, ...p.content.fields, ...p.content.sources].some(
            (r) => r.id === id
          )
      )
      return target ? (
        <a
          key={id}
          href={`${okfHref(target.id)}#${id}`}
          className="mr-3 text-sm text-primary underline"
        >
          {target.title}
        </a>
      ) : (
        <span key={id} className="text-sm text-amber-700">
          Unconfirmed reference: {id}
        </span>
      )
    })
  const editRule = (rule: KnowledgeRule, patch: Partial<KnowledgeRule>) =>
    set(
      "rules",
      content.rules.map((r) => (r.id === rule.id ? { ...r, ...patch } : r))
    )
  const renderRules = (rules: KnowledgeRule[]) => (
    <ul className="list-disc space-y-3 pl-5 text-sm leading-relaxed">
      {rules.map((rule) => (
        <li key={rule.id} id={rule.id}>
          <TextEdit
            label="Requirement"
            value={rule.instruction}
            multiline
            onChange={
              editable ? (v) => editRule(rule, { instruction: v }) : undefined
            }
          />
          {!editable && rule.condition ? <p>{rule.condition}</p> : null}
          {editable ? (
            <details className="mt-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer">Rule settings</summary>
              <div className="mt-3 grid gap-3">
                <Choice
                  label="Required when"
                  value={rule.requirement}
                  values={[
                    "always required",
                    "conditionally required",
                    "not required",
                    "unconfirmed",
                  ]}
                  onChange={(v) =>
                    editRule(rule, {
                      requirement: v as KnowledgeRule["requirement"],
                    })
                  }
                />
                <TextEdit
                  label="Condition (if applicable)"
                  value={rule.condition}
                  onChange={(v) => editRule(rule, { condition: v })}
                />
                <Choice
                  label="Check at stage"
                  value={rule.stage}
                  values={stages}
                  onChange={(v) =>
                    editRule(rule, { stage: v as KnowledgeRule["stage"] })
                  }
                />
                <TextEdit
                  label="Action if incorrect (if known)"
                  value={rule.consequence}
                  onChange={(v) => editRule(rule, { consequence: v })}
                />
                <TextEdit
                  label="Effective from (if known)"
                  value={rule.effectiveFrom}
                  onChange={(v) => editRule(rule, { effectiveFrom: v })}
                />
                <TextEdit
                  label="Effective to (if known)"
                  value={rule.effectiveTo}
                  onChange={(v) => editRule(rule, { effectiveTo: v })}
                />
                <TextEdit
                  label="Source IDs"
                  value={rule.sourceIds.join(", ")}
                  onChange={(v) =>
                    editRule(rule, {
                      sourceIds: v
                        .split(",")
                        .map((v) => v.trim())
                        .filter(Boolean),
                    })
                  }
                />
                <Choice
                  label="Check"
                  value={rule.check.operator}
                  values={[
                    "interpret",
                    "present",
                    "equal",
                    "number",
                    "date",
                    "option",
                  ]}
                  onChange={(v) =>
                    editRule(rule, {
                      check: {
                        ...rule.check,
                        operator: v as KnowledgeRule["check"]["operator"],
                      },
                    })
                  }
                />
                <TextEdit
                  label="Extraction field IDs"
                  value={rule.check.fieldIds.join(", ")}
                  onChange={(v) =>
                    editRule(rule, {
                      check: {
                        ...rule.check,
                        fieldIds: v
                          .split(",")
                          .map((v) => v.trim())
                          .filter(Boolean),
                      },
                    })
                  }
                />
                <TextEdit
                  label="Expected value or dropdown key"
                  value={rule.check.expected}
                  onChange={(v) =>
                    editRule(rule, { check: { ...rule.check, expected: v } })
                  }
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    set(
                      "rules",
                      content.rules.filter((r) => r.id !== rule.id)
                    )
                  }
                >
                  Remove requirement
                </Button>
              </div>
            </details>
          ) : null}
        </li>
      ))}
    </ul>
  )
  const addRule = (kind: KnowledgeRule["kind"]) =>
    set("rules", [
      ...content.rules,
      {
        id: `mg-rule-${crypto.randomUUID()}`,
        country: page.country,
        document: page.template === "document" ? page.title : "Cross-document",
        instruction: "",
        requirement: "unconfirmed",
        condition: "",
        stage: "intake",
        consequence: "",
        sourceIds: [],
        effectiveFrom: "",
        effectiveTo: "",
        kind,
        check: { operator: "interpret", fieldIds: [], expected: "" },
      },
    ])
  const renderFields = () => (
    <>
      <ul
        className={
          editable
            ? "grid gap-4"
            : "list-disc space-y-1 pl-5 text-sm leading-relaxed sm:columns-2"
        }
      >
        {content.fields.map((f) => (
          <li key={f.id} id={f.id} className="break-inside-avoid">
            <TextEdit
              label="Field"
              value={f.label}
              onChange={
                editable
                  ? (v) =>
                      set(
                        "fields",
                        content.fields.map((x) =>
                          x.id === f.id ? { ...x, label: v } : x
                        )
                      )
                  : undefined
              }
            />
            {editable ? (
              <details className="mt-2 text-xs text-muted-foreground">
                <summary className="cursor-pointer">
                  Extraction settings
                </summary>
                <div className="mt-3 grid gap-3">
                  {(["location", "requiredWhen", "instruction"] as const).map(
                    (key) => (
                      <TextEdit
                        key={key}
                        label={
                          {
                            location: "Where to find it (if needed)",
                            requiredWhen: "Condition (if applicable)",
                            instruction: "Extraction instructions (if needed)",
                          }[key]
                        }
                        value={f[key]}
                        multiline
                        onChange={(v) =>
                          set(
                            "fields",
                            content.fields.map((x) =>
                              x.id === f.id ? { ...x, [key]: v } : x
                            )
                          )
                        }
                      />
                    )
                  )}
                  <TextEdit
                    label="Portal field IDs"
                    value={f.portalFieldIds.join(", ")}
                    onChange={(v) =>
                      set(
                        "fields",
                        content.fields.map((x) =>
                          x.id === f.id
                            ? {
                                ...x,
                                portalFieldIds: v
                                  .split(",")
                                  .map((v) => v.trim())
                                  .filter(Boolean),
                              }
                            : x
                        )
                      )
                    }
                  />
                  <a href={okfHref("mg-field-map")} className="underline">
                    Edit form mappings
                  </a>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      set(
                        "fields",
                        content.fields.filter((x) => x.id !== f.id)
                      )
                    }
                  >
                    Remove field
                  </Button>
                </div>
              </details>
            ) : (
              [f.location, f.requiredWhen, f.instruction]
                .filter(Boolean)
                .map((text, i) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    {text}
                  </p>
                ))
            )}
          </li>
        ))}
      </ul>
      {editable ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            set("fields", [
              ...content.fields,
              {
                id: "mg-source-" + crypto.randomUUID(),
                label: "",
                document: page.title,
                location: "",
                requiredWhen: "",
                instruction: "",
                portalFieldIds: [],
                ruleIds: [],
              },
            ])
          }
        >
          Add extraction field
        </Button>
      ) : null}
    </>
  )
  const renderMappings = () => (
    <GridTable
      headings={[
        "System section",
        "Exact system field",
        "Source document",
        "Source field ID",
        "Entry/format rule",
        "If missing",
      ]}
    >
      {content.mappings.map((m) => {
        const form = formPresentation.find((f) => f.id === m.systemFieldId)
        const update = (patch: Partial<typeof m>) =>
          set(
            "mappings",
            content.mappings.map((x) =>
              x.id === m.id ? { ...x, ...patch } : x
            )
          )
        const values =
          options[m.systemFieldId] ??
          options[
            m.systemFieldId
              .replace("invoiceItems.", "invoiceItem")
              .replace(
                /invoiceItem([a-z])/,
                (_, c: string) => `invoiceItem${c.toUpperCase()}`
              )
          ] ??
          []
        return (
          <TableRow key={m.id} id={m.id}>
            <TableCell>{form?.section}</TableCell>
            <TableCell>
              {form?.label}
              <p className="mt-1 text-xs text-muted-foreground">
                {m.systemFieldId}
              </p>
              {values.length ? (
                <details className="mt-2 text-xs">
                  <summary>{values.length} allowed options</summary>
                  <p>{values.join("; ")}</p>
                </details>
              ) : null}
            </TableCell>
            <TableCell>
              {m.sourceFieldIds
                .map(
                  (id) =>
                    allFields.find((f) => f.id === id)?.document ??
                    "Unconfirmed"
                )
                .join("; ")}
            </TableCell>
            <TableCell>
              <TextEdit
                label="Source field IDs"
                value={m.sourceFieldIds.join(", ")}
                onChange={
                  editable
                    ? (v) =>
                        update({
                          sourceFieldIds: v
                            .split(",")
                            .map((v) => v.trim())
                            .filter(Boolean),
                        })
                    : undefined
                }
              />
              <details className="mt-3">
                <summary className="cursor-pointer text-xs">
                  Fallbacks and transformation
                </summary>
                <div className="mt-2 grid gap-3">
                  <TextEdit
                    label="Permitted fallback IDs"
                    value={m.fallbackSourceIds.join(", ")}
                    onChange={
                      editable
                        ? (v) =>
                            update({
                              fallbackSourceIds: v
                                .split(",")
                                .map((v) => v.trim())
                                .filter(Boolean),
                            })
                        : undefined
                    }
                  />
                  {editable ? (
                    <Choice
                      label="Transformation"
                      value={m.transform}
                      values={[
                        "none",
                        "trim",
                        "uppercase",
                        "decimal",
                        "date-iso",
                      ]}
                      onChange={(v) =>
                        update({ transform: v as typeof m.transform })
                      }
                    />
                  ) : (
                    <p>{m.transform}</p>
                  )}
                  <TextEdit
                    label="Unit"
                    value={m.unit}
                    onChange={editable ? (v) => update({ unit: v }) : undefined}
                  />
                  <p className="text-xs">
                    {m.repeated ? "Repeated rows" : "Single value"}
                  </p>
                </div>
              </details>
            </TableCell>
            <TableCell>
              <TextEdit
                label="Entry/format rule"
                value={m.entryRule}
                multiline
                onChange={
                  editable ? (v) => update({ entryRule: v }) : undefined
                }
              />
            </TableCell>
            <TableCell>
              <TextEdit
                label="If missing"
                value={m.ifMissing}
                multiline
                onChange={
                  editable ? (v) => update({ ifMissing: v }) : undefined
                }
              />
            </TableCell>
          </TableRow>
        )
      })}
    </GridTable>
  )
  const renderSources = () => (
    <div className="grid gap-3">
      {content.sources.map((s) => (
        <div key={s.id} id={s.id} className="grid gap-2 rounded-lg border p-3">
          <TextEdit
            label="Source title"
            value={s.title}
            onChange={
              editable
                ? (v) =>
                    set(
                      "sources",
                      content.sources.map((x) =>
                        x.id === s.id ? { ...x, title: v } : x
                      )
                    )
                : undefined
            }
          />
          {editable ? (
            <TextEdit
              label="Source URL"
              value={s.url}
              onChange={(v) =>
                set(
                  "sources",
                  content.sources.map((x) =>
                    x.id === s.id ? { ...x, url: v } : x
                  )
                )
              }
            />
          ) : s.url &&
            (/^https?:\/\//i.test(s.url) ||
              s.url === "/madagascar-bsc/invoice_template_En.xlsx") ? (
            <a
              className="text-primary underline"
              href={s.url}
              target="_blank"
              rel="noreferrer"
            >
              Open source
            </a>
          ) : null}
          {s.attachmentPath ? (
            <a
              className="text-primary underline"
              href={`/api/okf/evidence?path=${encodeURIComponent(s.attachmentPath)}`}
            >
              Download evidence
            </a>
          ) : null}
          <TextEdit
            label="Evidence and scope"
            value={s.note}
            onChange={
              editable
                ? (v) =>
                    set(
                      "sources",
                      content.sources.map((x) =>
                        x.id === s.id ? { ...x, note: v } : x
                      )
                    )
                : undefined
            }
          />
          {editable ? (
            <span className="text-xs text-muted-foreground">
              Source ID: {s.id}
            </span>
          ) : null}
        </div>
      ))}
      {editable ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            set("sources", [
              ...content.sources,
              {
                id: `source-${crypto.randomUUID()}`,
                title: "New source",
                url: "",
                attachmentPath: "",
                note: "Unconfirmed",
              },
            ])
          }
        >
          Add linked source
        </Button>
      ) : null}
    </div>
  )
  const editSection = (index: number, label: string) => (
    <TextEdit
      label={label}
      value={content.sections[index].text}
      multiline
      onChange={
        editable
          ? (value) =>
              set(
                "sections",
                content.sections.map((section, i) =>
                  i === index ? { ...section, text: value } : section
                )
              )
          : undefined
      }
    />
  )
  if (page.template === "overview") {
    const documents = pages.filter(
      (p) => p.country === page.country && p.template === "document"
    )
    return (
      <div className="grid gap-5 text-sm">
        <ul className="list-disc space-y-3 pl-5">
          {documents
            .filter((p) =>
              p.content.rules.some(
                (r) => r.kind === "document" && r.requirement !== "not required"
              )
            )
            .map((p) => (
              <li key={p.id}>
                <a
                  className="underline underline-offset-4"
                  href={okfHref(p.id)}
                >
                  {p.title}
                </a>
              </li>
            ))}
        </ul>
        {documents
          .filter((p) =>
            p.content.rules.some(
              (r) => r.kind === "document" && r.requirement === "not required"
            )
          )
          .map((p) => (
            <p key={p.id}>
              <a className="underline underline-offset-4" href={okfHref(p.id)}>
                {p.title}
              </a>{" "}
              — optional supporting document.
            </p>
          ))}
        {editable || content.sections[0].text ? editSection(0, "Notes") : null}
      </div>
    )
  }
  if (page.template === "process")
    return (
      <div className="grid gap-5 text-sm leading-relaxed">
        {content.sections.map((section, index) =>
          (editable && index === 0) || section.text ? (
            <div key={section.heading}>
              {editable ? (
                editSection(index, index === 0 ? "Process" : section.heading)
              ) : (
                <ol className="list-decimal space-y-3 pl-5">
                  {section.text
                    .split("\n")
                    .filter(Boolean)
                    .map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                </ol>
              )}
            </div>
          ) : null
        )}
      </div>
    )
  const acceptanceRules = content.rules.filter((r) => r.kind !== "document")
  if (page.template === "document")
    return (
      <div className="grid gap-7 text-sm leading-relaxed">
        {content.rules
          .filter((r) => r.kind === "document")
          .map((rule) => (
            <div key={rule.id}>
              {editable ? (
                renderRules([rule])
              ) : (
                <p className="text-muted-foreground">
                  {rule.instruction}
                  {rule.condition ? " " + rule.condition : ""}
                </p>
              )}
            </div>
          ))}
        {acceptanceRules.length || content.sections[1]?.text || editable ? (
          <section className="grid gap-3" id="requirements">
            <h2>Requirements</h2>
            {content.sections[1]?.text
              ? editSection(1, "Requirements notes")
              : null}
            {renderRules(acceptanceRules)}
            {editable ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => addRule("acceptance")}
              >
                Add requirement
              </Button>
            ) : null}
          </section>
        ) : null}
        {content.fields.length || editable ? (
          <section className="grid gap-3" id="fields">
            <h2>Fields to extract</h2>
            {renderFields()}
          </section>
        ) : null}
        {content.sections
          .filter(
            (section, index) => ![1, 2].includes(index) && section.text.trim()
          )
          .map((section) => (
            <section key={section.heading} className="grid gap-3">
              <h2>{section.heading}</h2>
              {editSection(content.sections.indexOf(section), section.heading)}
              {references(section.references)}
            </section>
          ))}
        {content.sources.length || editable ? (
          <details>
            <summary className="cursor-pointer text-xs text-muted-foreground">
              Sources and attachments
            </summary>
            <div className="mt-3">{renderSources()}</div>
          </details>
        ) : null}
      </div>
    )
  return (
    <div className="grid gap-5">
      {content.sections.map((section, index) =>
        section.text.trim() || section.references.length ? (
          <section key={section.heading} className="grid gap-3">
            <h2>{section.heading}</h2>
            {editSection(index, section.heading)}
            {references(section.references)}
          </section>
        ) : null
      )}
      {content.mappings.length ? renderMappings() : null}
      {content.sources.length || editable ? renderSources() : null}
    </div>
  )
}
