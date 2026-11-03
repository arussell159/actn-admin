import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib"
import {
  madagascarDraftSchema,
  type MadagascarDraft,
} from "@/lib/madagascar-draft"

export async function createMadagascarDraftPdf(input: MadagascarDraft) {
  const draft = madagascarDraftSchema.parse(input)
  const pdf = await PDFDocument.create()
  pdf.setTitle(
    `Madagascar BSC draft${draft.reference ? ` - ${draft.reference}` : ""}`
  )
  pdf.setAuthor("AfricaCTN")
  pdf.setSubject("Draft certificate for customer review - not validated")
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const width = 595.28,
    height = 841.89,
    margin = 28
  const contentWidth = width - margin * 2
  const ink = rgb(0.12, 0.19, 0.22),
    muted = rgb(0.36, 0.42, 0.45)
  const teal = rgb(0.14, 0.36, 0.4),
    band = rgb(0.89, 0.92, 0.93)
  const border = rgb(0.65, 0.71, 0.73),
    pale = rgb(0.97, 0.98, 0.98)
  const page = pdf.addPage([width, height])

  // Keep unsupported characters visible rather than dropping source data.
  const printable = (value: string) =>
    Array.from(value.normalize("NFC"))
      .map((character) => {
        if (character === "\n") return character
        if (/\s/.test(character)) return " "
        try {
          regular.encodeText(character)
          return character
        } catch {
          return `[U+${character.codePointAt(0)!.toString(16).toUpperCase()}]`
        }
      })
      .join("")
  const wrap = (
    value: string,
    available: number,
    size: number,
    font = regular
  ) => {
    const lines: string[] = []
    for (const paragraph of printable(value || "Not provided").split(/\r?\n/)) {
      let line = ""
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        if (
          line &&
          font.widthOfTextAtSize(`${line} ${word}`, size) > available
        ) {
          lines.push(line)
          line = ""
        }
        for (const character of word) {
          if (
            font.widthOfTextAtSize(line + character, size) > available &&
            line
          ) {
            lines.push(line)
            line = ""
          }
          line += character
        }
        line += " "
      }
      lines.push(line.trimEnd())
    }
    return lines.length ? lines : [""]
  }
  const text = (
    value: string,
    x: number,
    top: number,
    size: number,
    strong = false,
    color = ink
  ) => {
    page.drawText(printable(value), {
      x,
      y: top - size,
      size,
      font: strong ? bold : regular,
      color,
    })
  }
  const rectangle = (
    x: number,
    top: number,
    w: number,
    h: number,
    fill = pale
  ) => {
    page.drawRectangle({
      x,
      y: top - h,
      width: w,
      height: h,
      color: fill,
      borderColor: border,
      borderWidth: 0.4,
    })
  }
  const referenceLines = wrap(
    `Shipment reference: ${draft.reference || "Not provided"}`,
    contentWidth,
    9
  )
  const bodyTop = 750 - (referenceLines.length - 1) * 11

  // Measure before painting. Never clip rows, omit details, or shrink below a
  // readable type size to force an oversized shipment onto one page.
  function layout(size: number, paint: boolean) {
    let y = bodyTop
    const leading = size * 1.22
    const tableSize = Math.max(7.2, size - 0.5)
    const tableLeading = tableSize * 1.2
    const heading = (title: string) => {
      const lines = wrap(title, contentWidth - 12, size + 0.5, bold)
      const h = lines.length * (size + 2) + 6
      if (paint) {
        rectangle(margin, y, contentWidth, h, band)
        lines.forEach((line, i) =>
          text(line, margin + 6, y - 3 - i * (size + 2), size + 0.5, true)
        )
      }
      y -= h + 3
    }
    for (const section of draft.sections) {
      heading(section.title)
      const partyTables =
        section.tables.length > 0 &&
        section.tables.every(
          (table) =>
            table.columns.some((column) =>
              /^(name|nom|raison sociale)$/i.test(column.trim())
            ) &&
            (/part|participant/i.test(section.title) ||
              /exporter|importer|forwarder/i.test(table.title))
        )
      if (partyTables) {
        const cards = section.tables.flatMap((table) =>
          table.rows.map((row) => ({
            title: table.title || section.title,
            fields: table.columns.map((label, column) => ({
              label,
              value: row[column] ?? "Not provided",
              name: /^(name|nom|raison sociale)$/i.test(label.trim()),
            })),
            extra: row.slice(table.columns.length),
          }))
        )
        const columns =
          cards.length === 3 ? 3 : Math.min(2, Math.max(1, cards.length))
        const cardWidth = contentWidth / columns
        for (let offset = 0; offset < cards.length; offset += columns) {
          const row = cards.slice(offset, offset + columns).map((card) => ({
            title: wrap(card.title, cardWidth - 12, size, bold),
            lines: [
              ...card.fields.map((field) => ({
                strong: field.name,
                lines: wrap(
                  field.name ? field.value : `${field.label}: ${field.value}`,
                  cardWidth - 12,
                  size,
                  field.name ? bold : regular
                ),
              })),
              ...card.extra.map((value) => ({
                strong: false,
                lines: wrap(value, cardWidth - 12, size),
              })),
            ],
          }))
          const titleHeight =
            Math.max(...row.map((card) => card.title.length)) * leading + 5
          const h =
            titleHeight +
            Math.max(
              ...row.map((card) =>
                card.lines.reduce(
                  (total, field) => total + field.lines.length * leading,
                  0
                )
              )
            ) +
            8
          if (paint)
            row.forEach((card, column) => {
              const x = margin + column * cardWidth
              rectangle(x, y, cardWidth, h, rgb(1, 1, 1))
              rectangle(x, y, cardWidth, titleHeight, pale)
              card.title.forEach((line, i) =>
                text(line, x + 6, y - 2 - i * leading, size, true)
              )
              let top = y - titleHeight - 4
              for (const field of card.lines)
                for (const line of field.lines) {
                  text(line, x + 6, top, size, field.strong)
                  top -= leading
                }
            })
          y -= h + 3
        }
      }

      const cellWidth = contentWidth / 2
      for (let offset = 0; offset < section.fields.length; offset += 2) {
        const cells = section.fields
          .slice(offset, offset + 2)
          .map((field) =>
            wrap(
              `${field.label}: ${field.value || "Not provided"}`,
              cellWidth - 12,
              size
            )
          )
        const h = Math.max(...cells.map((lines) => lines.length)) * leading + 6
        if (paint)
          cells.forEach((lines, column) => {
            const x = margin + column * cellWidth
            rectangle(x, y, cellWidth, h, rgb(1, 1, 1))
            lines.forEach((line, i) =>
              text(line, x + 6, y - 3 - i * leading, size)
            )
          })
        y -= h
      }
      if (!partyTables)
        for (const table of section.tables) {
          if (table.title) {
            const lines = wrap(table.title, contentWidth - 8, size, bold)
            const h = lines.length * leading + 4
            if (paint)
              lines.forEach((line, i) =>
                text(line, margin + 4, y - 2 - i * leading, size, true, teal)
              )
            y -= h
          }
          const columns = [...table.columns]
          const count = Math.max(
            columns.length,
            ...table.rows.map((row) => row.length)
          )
          while (columns.length < count)
            columns.push(`Additional detail ${columns.length + 1}`)
          const weights = columns.map((column) =>
            /description/i.test(column)
              ? 3
              : /address|file|document|name/i.test(column)
                ? 2
                : /type|date/i.test(column)
                  ? 1.4
                  : 1
          )
          const sum = weights.reduce((total, weight) => total + weight, 0)
          const widths = weights.map((weight) => (contentWidth * weight) / sum)
          const headerLines = columns.map((column, i) =>
            wrap(column, widths[i] - 8, tableSize, bold)
          )
          const headerHeight =
            Math.max(...headerLines.map((lines) => lines.length)) *
              tableLeading +
            6
          if (paint) {
            let x = margin
            headerLines.forEach((lines, column) => {
              rectangle(x, y, widths[column], headerHeight, band)
              lines.forEach((line, i) =>
                text(line, x + 4, y - 3 - i * tableLeading, tableSize, true)
              )
              x += widths[column]
            })
          }
          y -= headerHeight
          for (const row of table.rows) {
            const cells = columns.map((_, column) =>
              wrap(row[column] ?? "Not provided", widths[column] - 8, tableSize)
            )
            const h =
              Math.max(...cells.map((lines) => lines.length)) * tableLeading + 6
            if (paint) {
              let x = margin
              cells.forEach((lines, column) => {
                rectangle(x, y, widths[column], h, rgb(1, 1, 1))
                lines.forEach((line, i) =>
                  text(line, x + 4, y - 3 - i * tableLeading, tableSize)
                )
                x += widths[column]
              })
            }
            y -= h
          }
          y -= 2
        }
      y -= 4
    }
    if (draft.warnings.length) {
      heading("Review notes")
      for (const warning of draft.warnings) {
        const lines = wrap(`- ${warning}`, contentWidth - 8, size)
        if (paint)
          lines.forEach((line, i) =>
            text(line, margin + 4, y - i * leading, size)
          )
        y -= lines.length * leading + 2
      }
    }
    return y
  }
  const size = [9.2, 8.8, 8.4, 8, 7.6].find(
    (candidate) => layout(candidate, false) >= 43
  )
  if (!size)
    throw new Error(
      "There is too much detail for one readable A4 page. Shorten long descriptions or remove repeated details in the review, then create the draft again."
    )

  page.drawRectangle({
    x: margin,
    y: height - 22,
    width: contentWidth,
    height: 3,
    color: teal,
  })
  text("AfricaCTN", margin, 811, 17, true, teal)
  text("MADAGASCAR / BSC", width - margin - 154, 810, 10, true)
  rectangle(width - margin - 45, 795, 45, 15, rgb(0.98, 0.92, 0.76))
  text("DRAFT", width - margin - 38, 793, 8, true)
  text("BORDEREAU DE SUIVI DES CARGAISONS", margin, 783, 12, true)
  referenceLines.forEach((line, i) =>
    text(line, margin, 764 - i * 11, 9, false, muted)
  )
  page.drawText("DRAFT", {
    x: 115,
    y: 320,
    size: 95,
    font: bold,
    color: teal,
    opacity: 0.035,
    rotate: degrees(30),
  })
  layout(size, true)
  page.drawLine({
    start: { x: margin, y: 32 },
    end: { x: width - margin, y: 32 },
    color: border,
    thickness: 0.5,
  })
  text(
    "DRAFT - For review only. Not validated or issued by SGS.",
    margin,
    25,
    7,
    false,
    muted
  )
  text("1 / 1", width - margin - 20, 25, 7, false, muted)
  return pdf.save()
}
