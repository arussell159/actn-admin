// SSE framing is shared by the upstream model stream and browser response.
// Decode incrementally so UTF-8 characters and events may span network chunks.
export async function* readKnowledgeEvents(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let data: string[] = []
  try {
    while (true) {
      const { done, value } = await reader.read()
      buffer += done
        ? decoder.decode() + "\n\n"
        : decoder.decode(value, { stream: true })
      if (buffer.length > 2_000_000)
        throw new Error("The response is too large.")
      let end: number
      while ((end = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, end).replace(/\r$/, "")
        buffer = buffer.slice(end + 1)
        if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""))
        if (!line && data.length) {
          const json = data.join("\n")
          data = []
          if (json !== "[DONE]")
            yield JSON.parse(json) as Record<string, unknown>
        }
      }
      if (done) break
    }
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

type PreviewValue =
  | string
  | number
  | boolean
  | null
  | PreviewValue[]
  | { [key: string]: PreviewValue }

// Display-only partial JSON reader. Its output NEVER enters the approval path.
// The complete result must separately pass JSON.parse, Zod and patch validation.
function readPreviewJson(source: string): PreviewValue | undefined {
  let index = 0
  const whitespace = () => {
    while (/\s/.test(source[index] ?? "x")) index++
  }
  function value(depth = 0): PreviewValue | undefined {
    if (depth > 30) return undefined
    whitespace()
    const char = source[index++]
    if (char === '"') {
      let output = ""
      while (index < source.length) {
        const next = source[index++]
        if (next === '"') break
        if (next !== "\\") {
          output += next
          continue
        }
        const escape = source[index++]
        if (escape === "u") {
          const hex = source.slice(index, index + 4)
          if (!/^[0-9a-f]{4}$/i.test(hex)) break
          output += String.fromCharCode(parseInt(hex, 16))
          index += 4
        } else {
          const escapes: Record<string, string> = {
            '"': '"',
            "\\": "\\",
            "/": "/",
            n: "\n",
            r: "\r",
            t: "\t",
            b: "\b",
            f: "\f",
          }
          if (!(escape in escapes)) break
          output += escapes[escape]
        }
      }
      return output
    }
    if (char === "{" || char === "[") {
      const result: { [key: string]: PreviewValue } = Object.create(null)
      const list: PreviewValue[] = []
      while (index < source.length) {
        whitespace()
        if (source[index] === "}" || source[index] === "]") {
          index++
          break
        }
        if (source[index] === ",") {
          index++
          continue
        }
        const before = index
        if (char === "{") {
          if (source[index] !== '"') break
          const key = value(depth + 1)
          whitespace()
          if (typeof key !== "string" || source[index++] !== ":") break
          const child = value(depth + 1)
          if (child !== undefined) result[key] = child
        } else {
          const child = value(depth + 1)
          if (child !== undefined) list.push(child)
        }
        if (index <= before) break
      }
      return char === "{" ? result : list
    }
    index--
    const token = /^(null|true|false|-?\d+(?:\.\d+)?)/.exec(source.slice(index))
    if (!token) return undefined
    index += token[0].length
    return JSON.parse(token[0]) as PreviewValue
  }
  return value()
}

// Project human-readable fields while their strings are still arriving. Do not
// expose JSON syntax, indexes, snapshots or executable proposal metadata.
export function knowledgeStreamPreview(source: string) {
  const root = readPreviewJson(source)
  const object = (
    value: PreviewValue | undefined
  ): { [key: string]: PreviewValue } =>
    value && typeof value === "object" && !Array.isArray(value) ? value : {}
  const array = (value: PreviewValue | undefined) =>
    Array.isArray(value) ? value : []
  const review = object(root)
  const parts: string[] = []
  const add = (label: string, value: PreviewValue | undefined) => {
    if (typeof value === "string" && value)
      parts.push(label ? `${label}: ${value}` : value)
  }
  add("Action", review.classification)
  add("", review.assistantMessage)
  for (const item of array(review.references)) {
    const reference = object(item)
    add("Location", reference.recordId)
    add("Section", reference.sectionId)
    add("Existing Information", reference.existingText)
  }
  const conflict = object(review.conflict)
  add("New Information", conflict.newInformation)
  add("Issue", conflict.issue)
  add("", conflict.question)
  for (const item of array(review.files)) {
    const file = object(item)
    add("File", file.recordId)
    for (const item of array(file.edits)) {
      const edit = object(item)
      add("Section", edit.sectionId)
      for (const [key, label] of [
        ["currentContent", "Current Wording"],
        ["proposedContent", "Proposed Wording"],
      ]) {
        const content = array(edit[key])
          .filter((line) => typeof line === "string")
          .join("\n")
        if (content) parts.push(`${label}:\n${content}`)
      }
      add("Reason", edit.reason)
    }
    add("Version Reason", file.versionReason)
    add("Change Log", file.changeLogSummary)
  }
  return parts.join("\n\n")
}
