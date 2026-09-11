"use client"

import * as React from "react"
import { useId, type ReactNode } from "react"
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
import type {
  KnowledgeContent,
  KnowledgePage,
  KnowledgeRule,
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

function editableSectionHasContent(page: KnowledgePage, heading: string) {
  if (
    page.content.sections.find((section) => section.heading === heading)?.text
  )
    return true
  if (heading === "When required")
    return page.content.rules.some((rule) => rule.kind === "document")
  if (heading === "Requirements")
    return page.content.rules.some((rule) => rule.kind !== "document")
  if (heading === "Fields to extract") return page.content.fields.length > 0
  return false
}

function editableMarkdown(page: KnowledgePage) {
  const lines: string[] = []
  for (const section of page.content.sections.filter((section) =>
    editableSectionHasContent(page, section.heading)
  )) {
    lines.push(`## ${section.heading}`, "")
    if (section.heading === "When required")
      for (const rule of page.content.rules.filter(
        (rule) => rule.kind === "document"
      ))
        lines.push(`- ${rule.instruction}`)
    if (section.heading === "Requirements")
      for (const rule of page.content.rules.filter(
        (rule) => rule.kind !== "document"
      ))
        lines.push(`- ${rule.instruction}`)
    if (section.heading === "Fields to extract")
      for (const field of page.content.fields)
        lines.push(`- ${field.label}: ${field.instruction}`)
    if (section.text) lines.push(section.text)
    lines.push("")
  }
  return lines.join("\n").trimEnd() + "\n"
}

function contentFromMarkdown(page: KnowledgePage, markdown: string) {
  const matches = [...markdown.matchAll(/^## (.+)$/gm)]
  const headings = matches.map((match) => match[1].trim())
  const expected = page.content.sections.map((section) => section.heading)
  const required = expected.filter((heading) =>
    editableSectionHasContent(page, heading)
  )
  if (
    headings.some((heading) => !expected.includes(heading)) ||
    JSON.stringify(headings) !== JSON.stringify(required)
  )
    throw new Error(
      "Keep the existing useful headings unchanged. Use AI Update when a new section is needed."
    )
  const bodies = matches.map((match, index) =>
    markdown
      .slice(
        match.index! + match[0].length,
        matches[index + 1]?.index ?? markdown.length
      )
      .trim()
  )
  const bodyByHeading = new Map(
    headings.map((heading, index) => [heading, bodies[index]])
  )
  const content = structuredClone(page.content)
  for (const section of content.sections) {
    const body = bodyByHeading.get(section.heading)
    if (body === undefined) continue
    const lines = body.split("\n")
    const bullets = lines
      .filter((line) => /^-\s+/.test(line))
      .map((line) => line.replace(/^-\s+/, "").trim())
    if (section.heading === "When required") {
      const rules = content.rules.filter((rule) => rule.kind === "document")
      if (bullets.length !== rules.length)
        throw new Error(
          "Use AI Update to add or remove requirements. Routine editing may reword them only."
        )
      rules.forEach(
        (rule, ruleIndex) => (rule.instruction = bullets[ruleIndex])
      )
    } else if (section.heading === "Requirements") {
      const rules = content.rules.filter((rule) => rule.kind !== "document")
      if (bullets.length !== rules.length)
        throw new Error(
          "Use AI Update to add or remove requirements. Routine editing may reword them only."
        )
      rules.forEach(
        (rule, ruleIndex) => (rule.instruction = bullets[ruleIndex])
      )
    } else if (section.heading === "Fields to extract") {
      if (bullets.length !== content.fields.length)
        throw new Error(
          "Use Certificate Settings or AI Update to change fields. Routine editing may reword instructions only."
        )
      content.fields.forEach((field, fieldIndex) => {
        const prefix = `${field.label}:`
        if (!bullets[fieldIndex].startsWith(prefix))
          throw new Error(`Keep the field label “${field.label}” unchanged.`)
        field.instruction = bullets[fieldIndex].slice(prefix.length).trim()
      })
    }
    section.text = lines
      .filter((line) => !/^-\s+/.test(line))
      .join("\n")
      .trim()
  }
  return content
}

function KnowledgeMarkdownEditor({
  page,
  onChange,
}: {
  page: KnowledgePage
  onChange: (content: KnowledgeContent) => void
}) {
  const [value, setValue] = React.useState(() => editableMarkdown(page))
  const [error, setError] = React.useState("")
  React.useEffect(() => setValue(editableMarkdown(page)), [page])
  return (
    <div className="grid gap-2">
      <Textarea
        aria-label="Page Markdown"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => {
          try {
            onChange(contentFromMarkdown(page, value))
            setError("")
          } catch (reason) {
            setError(
              reason instanceof Error ? reason.message : "Invalid Markdown"
            )
          }
        }}
        className="min-h-[60vh] resize-y font-mono text-sm leading-6"
      />
      <p
        className={
          error ? "text-sm text-destructive" : "text-xs text-muted-foreground"
        }
      >
        {error ||
          "Edit wording and Markdown text. Stable headings, fields, IDs, sources, and mappings are protected."}
      </p>
    </div>
  )
}

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
  if (onChange)
    return <KnowledgeMarkdownEditor page={page} onChange={onChange} />
  const allFields = pages.flatMap((p) => p.content.fields)
  const set = <K extends keyof KnowledgeContent>(
    key: K,
    value: KnowledgeContent[K]
  ) => {
    void key
    void value
  }
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
            label="Knowledge text"
            value={rule.instruction}
            multiline
            onChange={
              editable ? (v) => editRule(rule, { instruction: v }) : undefined
            }
          />
          {rule.condition ? <p>{rule.condition}</p> : null}
        </li>
      ))}
    </ul>
  )
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
              label={f.label}
              value={f.instruction}
              multiline
              onChange={
                editable
                  ? (v) =>
                      set(
                        "fields",
                        content.fields.map((x) =>
                          x.id === f.id ? { ...x, instruction: v } : x
                        )
                      )
                  : undefined
              }
            />
            {!editable
              ? [f.location, f.requiredWhen, f.instruction]
                  .filter(Boolean)
                  .map((text, i) => (
                    <p key={i} className="text-xs text-muted-foreground">
                      {text}
                    </p>
                  ))
              : null}
          </li>
        ))}
      </ul>
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
                onChange={undefined}
              />
              <details className="mt-3">
                <summary className="cursor-pointer text-xs">
                  Fallbacks and transformation
                </summary>
                <div className="mt-2 grid gap-3">
                  <TextEdit
                    label="Permitted fallback IDs"
                    value={m.fallbackSourceIds.join(", ")}
                    onChange={undefined}
                  />
                  <p>{m.transform}</p>
                  <TextEdit label="Unit" value={m.unit} onChange={undefined} />
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
                onChange={undefined}
              />
            </TableCell>
            <TableCell>
              <TextEdit
                label="If missing"
                value={m.ifMissing}
                multiline
                onChange={undefined}
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
          <strong>{s.title}</strong>
          {s.url &&
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
          {s.note ? <p>{s.note}</p> : null}
        </div>
      ))}
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
        {content.sections.map((section, index) => (
          <section
            key={section.heading}
            className="grid gap-3"
            id={section.heading.toLowerCase().replaceAll(" ", "-")}
          >
            <h2>{section.heading}</h2>
            {index === 0
              ? renderRules(
                  content.rules.filter((rule) => rule.kind === "document")
                )
              : null}
            {index === 1 ? renderRules(acceptanceRules) : null}
            {index === 2 ? renderFields() : null}
            {section.text || editable
              ? editSection(index, "Markdown text")
              : null}
            {references(section.references)}
            {index === 6 && content.sources.length ? renderSources() : null}
          </section>
        ))}
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
