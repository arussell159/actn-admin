export function parseCsv(text: string) {
  const rows: string[][] = []
  let field = ""
  let row: string[] = []
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const nextChar = text[index + 1]

    if (char === '"' && inQuotes && nextChar === '"') {
      field += '"'
      index += 1
      continue
    }

    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (char === "," && !inQuotes) {
      row.push(field)
      field = ""
      continue
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1
      }

      row.push(field)
      if (row.some((cell) => cell.trim())) {
        rows.push(row)
      }
      row = []
      field = ""
      continue
    }

    field += char
  }

  row.push(field)
  if (row.some((cell) => cell.trim())) {
    rows.push(row)
  }

  return rows
}

export function normalizeCsvHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "")
}

export function findCsvColumn(headers: string[], matches: string[]) {
  return headers.findIndex((header) => {
    const normalizedHeader = normalizeCsvHeader(header)

    return matches.some((match) => normalizedHeader.includes(match))
  })
}
