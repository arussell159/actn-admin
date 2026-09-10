import {
  contentSchema,
  type KnowledgeChange,
  type KnowledgePage,
  type KnowledgeReview,
  type KnowledgeState,
  type Observations,
  type Outcome,
  type Stage,
  stages,
  documentNames,
} from "./schema"
import { formPresentation } from "./seed"

export const publishedPages = (state: KnowledgeState) =>
  state.pages.filter((p) => p.revision > 0)
const canonical = (value: unknown): string => {
  if (Array.isArray(value))
    return JSON.stringify(value.map((v) => JSON.parse(canonical(v))))
  if (value && typeof value === "object")
    return JSON.stringify(
      Object.fromEntries(
        Object.entries(value)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => [k, JSON.parse(canonical(v))])
      )
    )
  return JSON.stringify(value)
}
export const sameContent = (a: unknown, b: unknown) =>
  canonical(a) === canonical(b)
const normalized = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
export function nextVersion(version: string | null, level: "patch" | "minor") {
  if (!version) return "1.0.0"
  const [major, minor, patch] = version.split(".").map(Number)
  return level === "patch"
    ? `${major}.${minor}.${patch + 1}`
    : `${major}.${minor + 1}.0`
}
export function validateChanges(
  state: KnowledgeState,
  changes: KnowledgeChange[]
) {
  if (new Set(changes.map((c) => c.pageId)).size !== changes.length)
    throw new Error("A page may occur only once in a change set.")
  const effective = changes.filter((c) => {
    const page = state.pages.find((p) => p.id === c.pageId)
    if (!page)
      throw new Error(
        "Unknown page. Structural changes need a separate explicit release proposal."
      )
    contentSchema.parse(c.content)
    if (
      !sameContent(
        page.content.sections.map((s) => s.heading),
        c.content.sections.map((s) => s.heading)
      )
    )
      throw new Error(
        "Fixed page headings cannot change in a content update. Propose a structural release separately."
      )
    const operational = (v: typeof c.content) => ({
      rules: v.rules,
      fields: v.fields,
      mappings: v.mappings,
      aliases: v.aliases,
    })
    if (
      c.level === "patch" &&
      !sameContent(operational(page.content), operational(c.content))
    )
      throw new Error(
        "Rules, extraction, aliases and mappings require a minor release."
      )
    return page.revision === 0 || !sameContent(page.content, c.content)
  })
  const candidate = state.pages.map((p) => ({
    ...p,
    content: effective.find((c) => c.pageId === p.id)?.content ?? p.content,
  }))
  const ids = new Set<string>(candidate.map((p) => p.id))
  for (const p of candidate)
    for (const item of [
      ...p.content.rules,
      ...p.content.fields,
      ...p.content.mappings,
      ...p.content.sources,
    ]) {
      if (ids.has(item.id)) throw new Error(`Duplicate stable ID: ${item.id}`)
      ids.add(item.id)
    }
  const fields = new Map(
    candidate.flatMap((p) =>
      p.content.fields.map((f) => [f.id, { ...f, country: p.country }] as const)
    )
  )
  const systemIds = new Set(formPresentation.map((f) => f.id))
  const rules = new Set(
    candidate.flatMap((p) => p.content.rules.map((r) => r.id))
  )
  const sources = new Set(
    candidate.flatMap((p) => p.content.sources.map((s) => s.id))
  )
  const signatures = new Map<string, string>()
  for (const p of candidate) {
    for (const source of p.content.sources) {
      if (
        source.url &&
        !/^https?:\/\//i.test(source.url) &&
        source.url !== "/madagascar-bsc/invoice_template_En.xlsx"
      )
        throw new Error(
          "Sources must use an HTTP(S) URL or the existing workbook."
        )
      if (
        source.attachmentPath &&
        !/^evidence\/[\w-]+\/[\w.-]+$/.test(source.attachmentPath)
      )
        throw new Error("Invalid evidence attachment path.")
    }
    for (const section of p.content.sections)
      for (const ref of section.references)
        if (!ids.has(ref)) throw new Error(`Unknown reference: ${ref}`)
    for (const rule of p.content.rules) {
      if (rule.country !== p.country || p.country !== "Madagascar")
        throw new Error("Country requirements must remain in their country.")
      if (p.template === "document" && rule.document !== p.title)
        throw new Error("Place the rule on its matching document page.")
      if (rule.requirement !== "unconfirmed" && !rule.sourceIds.length)
        throw new Error(`Add evidence before confirming ${rule.id}.`)
      if (
        rule.requirement === "conditionally required" &&
        !rule.condition.trim()
      )
        throw new Error("Conditional requirements need an explicit condition.")
      for (const date of [rule.effectiveFrom, rule.effectiveTo])
        if (
          date &&
          (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
            !Number.isFinite(Date.parse(date)))
        )
          throw new Error("Use a known ISO effective date or leave it empty.")
      if (
        rule.effectiveFrom &&
        rule.effectiveTo &&
        rule.effectiveFrom > rule.effectiveTo
      )
        throw new Error("Effective date range is reversed.")
      for (const ref of rule.sourceIds)
        if (!sources.has(ref)) throw new Error(`Unknown source: ${ref}`)
      for (const ref of rule.check.fieldIds)
        if (!fields.has(ref))
          throw new Error(`Unknown extraction field: ${ref}`)
      const signature = [
        rule.country,
        rule.document,
        rule.kind,
        rule.stage,
        normalized(rule.condition),
        normalized(rule.instruction),
      ].join("|")
      if (signatures.has(signature) && signatures.get(signature) !== rule.id)
        throw new Error(
          `Already covered by ${signatures.get(signature)}. Reference that rule instead.`
        )
      signatures.set(signature, rule.id)
    }
    for (const field of p.content.fields) {
      if (p.template !== "document" || field.document !== p.title)
        throw new Error("Extraction fields belong to their document page.")
      for (const ref of field.portalFieldIds)
        if (!systemIds.has(ref)) throw new Error(`Unknown form field: ${ref}`)
      for (const ref of field.ruleIds)
        if (!rules.has(ref)) throw new Error(`Unknown rule: ${ref}`)
    }
    const mapped = new Set<string>()
    for (const mapping of p.content.mappings) {
      if (p.template !== "mappings" || !systemIds.has(mapping.systemFieldId))
        throw new Error(
          "Mapping must target an existing field in the Field Map."
        )
      if (mapped.has(mapping.systemFieldId))
        throw new Error(
          "A portal field may have only one mapping; use explicit fallback sources."
        )
      mapped.add(mapping.systemFieldId)
      if (!mapping.sourceFieldIds.length)
        throw new Error("A mapping needs a primary extraction field.")
      for (const ref of [
        ...mapping.sourceFieldIds,
        ...mapping.fallbackSourceIds,
      ]) {
        const field = fields.get(ref)
        if (!field || field.country !== p.country)
          throw new Error(`Unknown or out-of-country source field: ${ref}`)
        if (!field.portalFieldIds.includes(mapping.systemFieldId))
          throw new Error(
            `Update ${ref} to reference ${mapping.systemFieldId} in this change set.`
          )
      }
      for (const ref of mapping.ruleIds)
        if (!rules.has(ref)) throw new Error(`Unknown rule: ${ref}`)
    }
  }
  return effective
}
export function validatePublicationDependencies(
  state: KnowledgeState,
  changes: KnowledgeChange[]
) {
  const available = new Set<string>()
  for (const p of state.pages)
    if (p.revision || changes.some((c) => c.pageId === p.id)) {
      available.add(p.id)
      const content =
        changes.find((c) => c.pageId === p.id)?.content ?? p.content
      for (const entry of [
        ...content.fields,
        ...content.rules,
        ...content.sources,
      ])
        available.add(entry.id)
    }
  for (const c of changes) {
    const refs = [
      ...c.content.sections.flatMap((s) => s.references),
      ...c.content.rules.flatMap((r) => [...r.sourceIds, ...r.check.fieldIds]),
      ...c.content.fields.flatMap((f) => f.ruleIds),
      ...c.content.mappings.flatMap((m) => [
        ...m.sourceFieldIds,
        ...m.fallbackSourceIds,
        ...m.ruleIds,
      ]),
    ]
    for (const ref of refs)
      if (!available.has(ref))
        throw new Error(
          `Include the page containing ${ref} in this publication; its content is still a draft.`
        )
  }
}
export function includePublicationDependencies(
  state: KnowledgeState,
  changes: KnowledgeChange[]
) {
  const result = [...changes]
  for (let index = 0; index < result.length; index++) {
    const content = result[index].content
    const references = new Set([
      ...content.sections.flatMap((s) => s.references),
      ...content.rules.flatMap((r) => [...r.sourceIds, ...r.check.fieldIds]),
      ...content.fields.flatMap((f) => f.ruleIds),
      ...content.mappings.flatMap((m) => [
        ...m.sourceFieldIds,
        ...m.fallbackSourceIds,
        ...m.ruleIds,
      ]),
    ])
    const fields = new Set(content.fields.map((f) => f.id))
    for (const page of state.pages) {
      if (page.revision || result.some((c) => c.pageId === page.id)) continue
      const ownsReference = [
        page.id,
        ...[
          ...page.content.rules,
          ...page.content.fields,
          ...page.content.sources,
        ].map((v) => v.id),
      ].some((id) => references.has(id))
      const mapsFields = page.content.mappings.some((m) =>
        [...m.sourceFieldIds, ...m.fallbackSourceIds].some((id) =>
          fields.has(id)
        )
      )
      if (ownsReference || mapsFields)
        result.push({ pageId: page.id, content: page.content, level: "minor" })
    }
  }
  return result
}
export function effectiveRules(
  pages: KnowledgePage[],
  country: string,
  stage: Stage,
  date: string
) {
  return pages
    .filter((p) => p.revision > 0 && p.country === country)
    .flatMap((p) =>
      p.content.rules
        .filter(
          (r) =>
            stages.indexOf(r.stage) <= stages.indexOf(stage) &&
            (!r.effectiveFrom || r.effectiveFrom <= date) &&
            (!r.effectiveTo || date <= r.effectiveTo)
        )
        .map((rule) => ({ rule, pageId: p.id }))
    )
}
export function evaluateReview(
  state: KnowledgeState,
  observations: Observations,
  options: Record<string, string[]>,
  context: { id: string; requestId: string; date: string; stage: Stage }
): KnowledgeReview {
  const pages = publishedPages(state)
  const validEvidence = (e: Observations["country"]["evidence"]) =>
    e.length > 0 &&
    e.every(
      (v) =>
        v.document.trim() &&
        v.page.trim() &&
        v.observedText.trim() &&
        observations.documents.some((d) => d.fileName === v.document)
    )
  const country = observations.country
  const countrySupported = pages.some(page => page.country === country.name)
  if (
    country.status === "supported" &&
    (!countrySupported ||
      !["final destination", "consignee address"].includes(country.basis) ||
      !country.finalDestination.trim() ||
      !validEvidence(country.evidence))
  ) {
    country.status =
      country.name && !countrySupported
        ? "unsupported"
        : "unconfirmed"
  }
  const safe =
    country.status === "supported" &&
    !observations.groupingAmbiguous &&
    observations.shipments.length === 1
  const applicable = safe
    ? effectiveRules(pages, country.name, context.stage, context.date)
    : []
  const findings: KnowledgeReview["findings"] = []
  for (const { rule, pageId } of applicable) {
    let status: Outcome = "unconfirmed"
    let explanation = "No supported result is available."
    let evidence: Observations["country"]["evidence"] = []
    const condition = observations.conditions.find((c) => c.ruleId === rule.id)
    if (rule.requirement === "unconfirmed")
      explanation = "This requirement is unconfirmed in published knowledge."
    else if (rule.requirement === "not required") {
      status = "not applicable"
      explanation = rule.instruction
    } else if (
      rule.requirement === "conditionally required" &&
      (!condition ||
        condition.applies === "unconfirmed" ||
        !validEvidence(condition.evidence))
    )
      explanation = "The applicability condition needs evidence."
    else if (
      rule.requirement === "conditionally required" &&
      condition?.applies === "no"
    ) {
      status = "not applicable"
      evidence = condition.evidence
      explanation = rule.condition
    } else if (rule.kind === "document") {
      const docs = observations.documents.filter(
        (d) => d.documentType === rule.document
      )
      evidence = docs.flatMap((d) => d.evidence)
      status = !docs.length
        ? "missing"
        : docs.every((d) => d.status === "unreadable")
          ? "unreadable"
          : validEvidence(evidence)
            ? "passed"
            : "unconfirmed"
      explanation = !docs.length
        ? `Missing required document: ${rule.document}.`
        : "Document presence only; acceptance and final/draft status are checked separately."
    } else if (rule.check.operator !== "interpret") {
      const values = rule.check.fieldIds.map((id) =>
        observations.fields.filter((f) => f.id === id)
      )
      const flat = values.flat()
      evidence = flat.flatMap((v) => v.evidence)
      if (
        !flat.length ||
        values.some((v) => !v.length) ||
        flat.some((v) => !v.value)
      ) {
        status = "missing"
        explanation = "Required comparison or format evidence is missing."
      } else if (
        flat.some((v) => v.status !== "passed" || !validEvidence(v.evidence))
      ) {
        status = flat.some((v) => v.status === "conflicting")
          ? "conflicting"
          : "unconfirmed"
        explanation = "Resolve uncertain extraction before running this check."
      } else {
        const vals = flat.map((v) => v.value.trim())
        const passed =
          rule.check.operator === "equal"
            ? vals.length >= 2 && new Set(vals).size === 1
            : rule.check.operator === "number"
              ? vals.every((v) => /^-?\d+(\.\d+)?$/.test(v))
              : rule.check.operator === "date"
                ? vals.every(
                    (v) =>
                      /^\d{4}-\d{2}-\d{2}$/.test(v) &&
                      Number.isFinite(Date.parse(v)) &&
                      new Date(v).toISOString().slice(0, 10) === v
                  )
                : rule.check.operator === "option"
                  ? vals.every((v) =>
                      (options[rule.check.expected] ?? []).includes(v)
                    )
                  : vals.every(Boolean)
        status = passed ? "passed" : "failed"
        explanation = `Deterministic ${rule.check.operator} check: ${vals.join("; ")}`
      }
    } else {
      const finding = observations.findings.find((f) => f.ruleId === rule.id)
      if (finding) {
        status = finding.status
        evidence = finding.evidence
        explanation = finding.explanation
        if (
          !validEvidence(evidence) &&
          ["passed", "failed", "not applicable"].includes(status)
        )
          status = "unconfirmed"
      }
    }
    findings.push({
      id: `${context.id}:${rule.id}`,
      ruleId: rule.id,
      pageId,
      stage: rule.stage,
      status,
      explanation,
      evidence,
      consequence: rule.consequence,
    })
  }
  for (const name of documentNames)
    if (
      safe &&
      !applicable.some(
        ({ rule }) => rule.kind === "document" && rule.document === name
      )
    )
      findings.push({
        id: `${context.id}:gap:${name}`,
        ruleId: "",
        pageId: "",
        stage: context.stage,
        status: "unconfirmed",
        explanation: `${name}: no confirmed published document requirement applies at ${context.stage}.`,
        evidence: [],
        consequence:
          "Confirm the requirement; document presence alone is not a pass.",
      })
  const mappedFields: KnowledgeReview["mappedFields"] = []
  if (safe)
    for (const p of pages.filter((p) => p.country === country.name))
      for (const mapping of p.content.mappings) {
        const publishedIds = new Set(
          pages.flatMap((p) => p.content.fields.map((f) => f.id))
        )
        const primary = observations.fields.filter(
          (f) => mapping.sourceFieldIds.includes(f.id) && publishedIds.has(f.id)
        )
        const candidates = primary.some(
          (f) => f.value || f.status === "conflicting"
        )
          ? primary
          : observations.fields.filter(
              (f) =>
                mapping.fallbackSourceIds.includes(f.id) &&
                publishedIds.has(f.id)
            )
        const rows = mapping.repeated
          ? [...new Set(candidates.map((c) => c.row))]
          : [null]
        for (const row of rows.length ? rows : [null]) {
          const values = candidates.filter(
            (c) => !mapping.repeated || c.row === row
          )
          const evidence = values.flatMap((v) => v.evidence)
          let status: Outcome =
            !values.length || values.every((v) => !v.value)
              ? "missing"
              : values.some((v) => v.status === "conflicting") ||
                  new Set(values.filter((v) => v.value).map((v) => v.value))
                    .size > 1
                ? "conflicting"
                : values.every(
                      (v) => v.status === "passed" && validEvidence(v.evidence)
                    )
                  ? "passed"
                  : "unconfirmed"
          let value = status === "passed" ? values[0].value : ""
          if (mapping.transform === "trim") value = value.trim()
          if (mapping.transform === "uppercase") value = value.toUpperCase()
          if (
            mapping.transform === "decimal" &&
            value &&
            !/^-?\d+(\.\d+)?$/.test(value)
          ) {
            status = "unconfirmed"
            value = ""
          }
          if (
            mapping.transform === "date-iso" &&
            value &&
            (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
              !Number.isFinite(Date.parse(value)) ||
              new Date(value).toISOString().slice(0, 10) !== value)
          ) {
            status = "unconfirmed"
            value = ""
          }
          const optionKey = mapping.systemFieldId.startsWith("invoiceItems.")
            ? `invoiceItem${mapping.systemFieldId.slice(13, 14).toUpperCase()}${mapping.systemFieldId.slice(14)}`
            : mapping.systemFieldId
          if (
            value &&
            options[optionKey]?.length &&
            !options[optionKey].includes(value)
          ) {
            status = "failed"
            value = ""
          }
          mappedFields.push({
            key: mapping.systemFieldId,
            value,
            observedText: values.map((v) => v.observedText).join(" | "),
            status,
            evidence,
            note:
              status === "passed"
                ? values
                    .map((v) => v.note)
                    .filter(Boolean)
                    .join("; ")
                : mapping.ifMissing,
            row,
            rowLabel: values[0]?.rowLabel ?? "",
          })
        }
      }
  const nextActions = [
    ...(!safe
      ? [
          country.status === "unsupported"
            ? `The detected destination (${country.name}) is unsupported.`
            : "Clarify the final destination and shipment grouping before populating a country form.",
        ]
      : []),
    ...(observations.shipments.length > 1
      ? ["Separate the identified shipments and review each document group."]
      : []),
    ...(!countrySupported
      ? [`Publish ${country.name || "country"} knowledge before authoritative country checks.`]
      : []),
    ...(safe && !mappedFields.length
      ? [
          "Publish extraction fields and their Field Map together to enable form population.",
        ]
      : []),
    ...findings
      .filter((f) => !["passed", "not applicable"].includes(f.status))
      .map((f) => `${f.explanation} ${f.consequence}`),
  ]
  return {
    ...context,
    createdAt: new Date().toISOString(),
    generation: state.generation,
    revisions: pages
      .filter((p) => p.country === "Shared" || p.country === country.name)
      .map((p) => ({ pageId: p.id, revision: p.revision, version: p.version })),
    observations,
    findings,
    mappedFields,
    missingDocuments: applicable
      .filter(
        ({ rule }) =>
          rule.kind === "document" &&
          findings.some((f) => f.ruleId === rule.id && f.status === "missing")
      )
      .map(({ rule }) => rule.document),
    nextActions,
  }
}
