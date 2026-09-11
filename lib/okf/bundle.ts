import type { KnowledgePage, KnowledgeState } from "./schema"

export const okfVersion = "0.2"
export const documentHeadingOrder = [
  "When required",
  "Requirements",
  "Fields to extract",
  "Cross-document checks",
  "If missing or incorrect",
  "Examples and templates",
  "Sources",
] as const

export type OkfBundleFile = { path: string; markdown: string }
export type OkfSearchEntry = {
  path: string
  title: string
  country: string
  text: string
  revision: number
}

const quote = (value: string) => JSON.stringify(value)
const slug = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "concept"

export function conceptPath(page: KnowledgePage) {
  if (page.country === "Shared") {
    if (page.id === "standards") return "standards.md"
    if (page.id === "shared-process") return "shared-process.md"
    if (page.id === "country-index") return "country-index.md"
    return `shared/${slug(page.title)}.md`
  }
  const base = `countries/${slug(page.country)}`
  if (page.template === "document")
    return `${base}/documents/${slug(page.title)}.md`
  const names: Record<string, string> = {
    overview: "overview.md",
    process: "process.md",
    system: "system-guide.md",
    mappings: "field-map.md",
    exceptions: "exceptions.md",
    references: "references.md",
  }
  return `${base}/${names[page.template] ?? `${slug(page.title)}.md`}`
}

function sourceResource(source: KnowledgePage["content"]["sources"][number]) {
  return source.url || source.attachmentPath || `source:${source.id}`
}

function frontmatter(page: KnowledgePage) {
  const status = page.revision > 0 ? "stable" : "draft"
  const generatedAt =
    page.publishedAt ?? page.generated?.at ?? "2026-09-11T00:00:00Z"
  const lines = [
    "---",
    `type: ${quote(page.template === "document" ? "Document Requirements" : page.title)}`,
    `title: ${quote(page.title)}`,
    `description: ${quote(`${page.title} for ${page.country}.`)}`,
    `tags: [${[slug(page.country), slug(page.template)].map(quote).join(", ")}]`,
    `status: ${status}`,
    "generated:",
    `  by: ${quote(page.generated?.by ?? "process:africactn-okf")}`,
    `  at: ${quote(generatedAt)}`,
  ]
  if (page.verified?.length) {
    lines.push("verified:")
    for (const event of page.verified)
      lines.push(`  - { by: ${quote(event.by)}, at: ${quote(event.at)} }`)
  }
  if (page.staleAfter) lines.push(`stale_after: ${quote(page.staleAfter)}`)
  const reserved = new Set([
    "type",
    "title",
    "description",
    "tags",
    "status",
    "generated",
    "verified",
    "sources",
    "stale_after",
    "actn_page_id",
    "actn_revision",
    "actn_version",
  ])
  for (const [key, value] of Object.entries(page.metadata ?? {}))
    if (/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(key) && !reserved.has(key))
      lines.push(`${key}: ${JSON.stringify(value)}`)
  if (page.content.sources.length) {
    lines.push("sources:")
    for (const source of page.content.sources)
      lines.push(
        `  - { id: ${quote(source.id)}, resource: ${quote(sourceResource(source))}, title: ${quote(source.title)} }`
      )
  } else lines.push("sources: []")
  lines.push(
    `actn_page_id: ${quote(page.id)}`,
    `actn_revision: ${page.revision}`,
    `actn_version: ${quote(page.version ?? "unpublished")}`,
    "---"
  )
  return lines.join("\n")
}

function ruleBlock(page: KnowledgePage) {
  return page.content.rules.flatMap((rule) => [
    `### \`${rule.id}\``,
    "",
    `- **Country:** ${rule.country}`,
    `- **Certificate type:** Cargo Tracking Note`,
    `- **Document type:** ${rule.document || "Not applicable"}`,
    `- **Field IDs:** ${rule.check.fieldIds.length ? rule.check.fieldIds.map((id) => `\`${id}\``).join(", ") : "Not applicable"}`,
    `- **Applicability:** ${rule.requirement}`,
    `- **Workflow stage:** ${rule.stage}`,
    `- **Instruction:** ${rule.instruction}`,
    `- **Condition:** ${rule.condition || "None"}`,
    `- **Consequence:** ${rule.consequence || "Flag for staff review."}`,
    `- **Approval:** ${page.revision > 0 ? "published" : "draft"}`,
    `- **Effective date:** ${rule.effectiveFrom || "Unknown"}`,
    `- **Last meaningful update:** ${page.publishedAt ?? page.generated?.at ?? "Unknown"}`,
    `- **Verification history:** ${page.verified?.length ? page.verified.map((event) => `${event.by} at ${event.at}`).join("; ") : "Unverified"}`,
    `- **Sources:** ${rule.sourceIds.length ? rule.sourceIds.map((id) => `[^${id}]`).join(" ") : "Unconfirmed"}`,
    "",
  ])
}

function renderPage(page: KnowledgePage) {
  const lines = [frontmatter(page), "", `# ${page.title}`, ""]
  const sectionText = new Map(
    page.content.sections.map((section) => [section.heading, section.text])
  )
  const headings =
    page.template === "document"
      ? documentHeadingOrder
      : page.content.sections.map((section) => section.heading)
  for (const heading of headings) {
    lines.push(`## ${heading}`, "")
    const text = sectionText.get(heading)
    if (text) lines.push(text, "")
    if (heading === "Requirements") lines.push(...ruleBlock(page))
    if (heading === "Fields to extract")
      for (const field of page.content.fields)
        lines.push(
          `- \`${field.id}\` — ${field.label}: ${field.instruction || "Read the stated value."}`,
          ""
        )
  }
  for (const source of page.content.sources)
    lines.push(`[^${source.id}]: ${source.title}`, "")
  return lines.join("\n").trimEnd() + "\n"
}

function indexFile(files: OkfBundleFile[]) {
  const concepts = files.filter((file) => !/(^|\/)index\.md$/.test(file.path))
  return [
    "---",
    `okf_version: ${quote(okfVersion)}`,
    "---",
    "",
    "# AfricaCTN Knowledge Bundle",
    "",
    ...concepts.map(
      (file) => `* [${file.path.replace(/\.md$/, "")}](/${file.path})`
    ),
    "",
  ].join("\n")
}

function directoryIndexes(concepts: OkfBundleFile[]) {
  const directories = new Set(
    concepts.flatMap((file) => {
      const parts = file.path.split("/")
      return parts
        .slice(0, -1)
        .map((_, index) => parts.slice(0, index + 1).join("/"))
    })
  )
  return [...directories].map((directory) => {
    const prefix = directory + "/"
    const children = concepts.filter((file) => {
      if (!file.path.startsWith(prefix)) return false
      return !file.path.slice(prefix.length).includes("/")
    })
    return {
      path: `${directory}/index.md`,
      markdown: [
        `# ${directory.split("/").at(-1)!.replace(/-/g, " ")}`,
        "",
        ...children.map(
          (file) =>
            `* [${file.path.split("/").at(-1)!.replace(/\.md$/, "")}](./${file.path.split("/").at(-1)})`
        ),
        "",
      ].join("\n"),
    }
  })
}

export function buildOkfBundle(state: KnowledgeState): OkfBundleFile[] {
  const concepts = state.pages.map((page) => ({
    path: conceptPath(page),
    markdown: renderPage(page),
  }))
  return [
    { path: "index.md", markdown: indexFile(concepts) },
    { path: "log.md", markdown: buildLog(state) },
    ...directoryIndexes(concepts),
    ...concepts,
  ]
}

function buildLog(state: KnowledgeState) {
  const entries = state.pages
    .filter((page) => page.publishedAt)
    .sort((a, b) => b.publishedAt!.localeCompare(a.publishedAt!))
  const days = new Map<string, KnowledgePage[]>()
  for (const page of entries) {
    const day = page.publishedAt!.slice(0, 10)
    days.set(day, [...(days.get(day) ?? []), page])
  }
  return [
    "# AfricaCTN Knowledge Update Log",
    "",
    ...[...days].flatMap(([day, pages]) => [
      `## ${day}`,
      "",
      ...pages.map(
        (page) =>
          `* **Update**: Published [${page.title}](/${conceptPath(page)}) as ${page.version}.`
      ),
      "",
    ]),
  ].join("\n")
}

export function validateOkfBundle(files: OkfBundleFile[]) {
  const paths = new Set(files.map((file) => file.path))
  if (paths.size !== files.length)
    throw new Error("Duplicate OKF concept path.")
  for (const file of files) {
    if (file.path.endsWith("index.md") || file.path.endsWith("log.md")) continue
    if (!/^---\n[\s\S]*\n---\n/.test(file.markdown))
      throw new Error(`Missing YAML frontmatter: ${file.path}`)
    if (!/^type:\s*.+$/m.test(file.markdown))
      throw new Error(`Missing concept type: ${file.path}`)
    if (!/^status:\s*(draft|stable|deprecated)$/m.test(file.markdown))
      throw new Error(`Invalid status: ${file.path}`)
    for (const link of file.markdown.matchAll(
      /\]\((\/[^)]+\.md)(?:#[^)]+)?\)/g
    ))
      if (!paths.has(link[1].slice(1)))
        throw new Error(`Broken internal link in ${file.path}: ${link[1]}`)
  }
  return files
}

export function buildOkfSearchIndex(state: KnowledgeState): OkfSearchEntry[] {
  return state.pages
    .filter((page) => page.revision > 0)
    .map((page) => ({
      path: conceptPath(page),
      title: page.title,
      country: page.country,
      text: renderPage(page).replace(/^---[\s\S]*?---\s*/, ""),
      revision: page.revision,
    }))
}

export function relevantKnowledge(
  state: KnowledgeState,
  query: string,
  pageId = ""
) {
  const terms = new Set(query.toLocaleLowerCase().match(/[a-z0-9]{3,}/g) ?? [])
  return state.pages
    .filter((page) => page.revision > 0 || page.id === pageId)
    .map((page) => {
      const haystack =
        `${page.country} ${page.title} ${JSON.stringify(page.content)}`.toLocaleLowerCase()
      const score =
        (page.id === pageId ? 100 : 0) +
        [...terms].filter((term) => haystack.includes(term)).length
      return { page, score }
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map(({ page }) => page)
}
