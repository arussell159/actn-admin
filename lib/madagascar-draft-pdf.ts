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
  const navy = rgb(0.09, 0.18, 0.24)
  const teal = rgb(0.14, 0.4, 0.44)
  const muted = rgb(0.38, 0.44, 0.48)
  const light = rgb(0.94, 0.96, 0.96)
  const border = rgb(0.82, 0.87, 0.88)
  const width = 595.28,
    height = 841.89,
    margin = 40
  const contentWidth = width - margin * 2
  let page = pdf.addPage([width, height])
  let y = 0
  // Standard PDF fonts cover Latin names. Keep unsupported characters visible
  // as Unicode code points rather than dropping source data or failing export.
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
    size = 10,
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
    size = 10,
    strong = false,
    color = navy
  ) =>
    page.drawText(printable(value), {
      x,
      y: top - size,
      size,
      font: strong ? bold : regular,
      color,
    })
  const header = () => {
    page.drawRectangle({ x: 0, y: height - 57, width, height: 57, color: navy })
    text("AfricaCTN", margin, height - 19, 18, true, rgb(1, 1, 1))
    text("MADAGASCAR  /  BSC", width - 190, height - 24, 10, true, rgb(1, 1, 1))
    page.drawRectangle({
      x: margin,
      y: height - 86,
      width: 56,
      height: 18,
      color: rgb(0.98, 0.9, 0.69),
    })
    text("DRAFT", margin + 9, height - 71, 9, true)
    text("FOR CUSTOMER REVIEW", margin + 66, height - 72, 9, false, muted)
    page.drawText("DRAFT", {
      x: 100,
      y: 365,
      size: 96,
      font: bold,
      color: navy,
      opacity: 0.035,
      rotate: degrees(30),
    })
    y = height - 110
  }
  header()
  const newPage = () => {
    page = pdf.addPage([width, height])
    header()
  }
  const ensure = (space: number) => {
    if (y - space < 54) newPage()
  }
  const heading = (title: string) => {
    const lines = wrap(title, contentWidth - 20, 11, bold)
    const size = lines.length * 14 + 16
    ensure(size + 45)
    page.drawRectangle({
      x: margin,
      y: y - size,
      width: contentWidth,
      height: size,
      color: light,
    })
    page.drawRectangle({
      x: margin,
      y: y - size,
      width: 3,
      height: size,
      color: teal,
    })
    lines.forEach((line, index) =>
      text(line, margin + 11, y - 8 - index * 14, 11, true)
    )
    y -= size + 12
  }
  text("Draft certificate", margin, y, 25, true)
  y -= 35
  text("BORDEREAU DE SUIVI DES CARGAISONS", margin, y, 9, false, muted)
  y -= 23
  if (draft.reference) {
    for (const line of wrap(
      `Shipment reference: ${draft.reference}`,
      contentWidth,
      11,
      bold
    )) {
      text(line, margin, y, 11, true)
      y -= 15
    }
    y -= 8
  }
  if (draft.warnings.length) {
    heading("Review notes")
    for (const warning of draft.warnings) {
      for (const line of wrap(`- ${warning}`, contentWidth - 8, 9)) {
        ensure(14)
        text(line, margin + 4, y, 9)
        y -= 13
      }
      y -= 5
    }
    y -= 8
  }
  for (const section of draft.sections) {
    heading(section.title)
    for (let index = 0; index < section.fields.length; index += 2) {
      const fields = section.fields.slice(index, index + 2)
      const columnWidth = (contentWidth - 24) / 2
      const layouts = fields.map((field) => ({
        labels: wrap(field.label.toUpperCase(), columnWidth, 8, bold),
        values: wrap(field.value, columnWidth, 10),
      }))
      const lineCount = Math.max(
        ...layouts.map((layout) => layout.labels.length + layout.values.length)
      )
      if (y - Math.min(lineCount * 14 + 14, 560) < 54) {
        newPage()
        heading(`${section.title} (continued)`)
      }
      // Stream unusually long fields across pages, keeping both columns aligned.
      for (let line = 0; line < lineCount; line++) {
        if (y - 15 < 54) {
          newPage()
          heading(`${section.title} (continued)`)
        }
        layouts.forEach((layout, column) => {
          const label = line < layout.labels.length
          const value = label
            ? layout.labels[line]
            : layout.values[line - layout.labels.length]
          if (value !== undefined)
            text(
              value,
              margin + column * (columnWidth + 24),
              y,
              label ? 8 : 10,
              label,
              label ? muted : navy
            )
        })
        y -= 14
      }
      y -= 14
    }
    for (const table of section.tables) {
      if (table.title) {
        ensure(70)
        for (const line of wrap(table.title, contentWidth, 10, bold)) {
          text(line, margin, y, 10, true)
          y -= 14
        }
        y -= 5
      }
      const weights = table.columns.map((column) =>
        /description|address|file|name/i.test(column) ? 2 : 1
      )
      const sum = weights.reduce((total, weight) => total + weight, 0)
      const widths = weights.map((weight) => (contentWidth * weight) / sum)
      const headers = table.columns.map((column, i) =>
        wrap(column, widths[i] - 12, 8, bold)
      )
      const headerHeight =
        Math.max(...headers.map((lines) => lines.length)) * 11 + 14
      const tableHeader = () => {
        ensure(headerHeight + 30)
        page.drawRectangle({
          x: margin,
          y: y - headerHeight,
          width: contentWidth,
          height: headerHeight,
          color: teal,
        })
        let x = margin
        headers.forEach((lines, column) => {
          lines.forEach((line, i) =>
            text(line, x + 6, y - 7 - i * 11, 8, true, rgb(1, 1, 1))
          )
          x += widths[column]
        })
        y -= headerHeight
      }
      tableHeader()
      for (const [rowIndex, row] of table.rows.entries()) {
        const cells = table.columns.map((_, column) =>
          wrap(row[column] ?? "Not provided", widths[column] - 12, 8)
        )
        const count = Math.max(...cells.map((lines) => lines.length))
        let offset = 0
        while (offset < count) {
          if (y - 28 < 54) {
            newPage()
            tableHeader()
          }
          const capacity = Math.max(1, Math.floor((y - 54 - 14) / 11))
          const length = Math.min(capacity, count - offset)
          const rowHeight = length * 11 + 14
          page.drawRectangle({
            x: margin,
            y: y - rowHeight,
            width: contentWidth,
            height: rowHeight,
            color: rowIndex % 2 ? rgb(1, 1, 1) : light,
          })
          let x = margin
          cells.forEach((lines, column) => {
            lines
              .slice(offset, offset + length)
              .forEach((line, i) => text(line, x + 6, y - 7 - i * 11, 8))
            x += widths[column]
          })
          y -= rowHeight
          page.drawLine({
            start: { x: margin, y },
            end: { x: width - margin, y },
            color: border,
            thickness: 0.5,
          })
          offset += length
          if (offset < count) {
            newPage()
            tableHeader()
          }
        }
      }
      y -= 18
    }
    y -= 6
  }
  const pages = pdf.getPages()
  pages.forEach((p, index) => {
    p.drawLine({
      start: { x: margin, y: 40 },
      end: { x: width - margin, y: 40 },
      color: border,
      thickness: 0.5,
    })
    p.drawText("DRAFT - For review only. Not validated or issued by SGS.", {
      x: margin,
      y: 25,
      size: 8,
      font: regular,
      color: muted,
    })
    p.drawText(`${index + 1} / ${pages.length}`, {
      x: width - margin - 30,
      y: 25,
      size: 8,
      font: regular,
      color: muted,
    })
  })
  return pdf.save()
}
