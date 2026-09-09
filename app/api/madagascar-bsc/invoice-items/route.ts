import fs from "node:fs/promises"
import { NextResponse } from "next/server"
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate"

import type { MadagascarInvoiceItem } from "@/lib/madagascar-bsc"
import {
  getMadagascarDropdownOptions,
  madagascarTemplatePath,
} from "@/lib/madagascar-bsc-server"

const cellStyles: Record<string, string> = {
  B: "7",
  C: "1",
  D: "8",
  E: "8",
  F: "3",
  G: "4",
  H: "4",
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

function replaceCell(
  xml: string,
  address: string,
  column: string,
  value: string,
  numeric = false
) {
  const style = cellStyles[column]
  const cellPattern = new RegExp(
    `<x:c r="${address}"[^>]*\\/>|<x:c r="${address}"[^>]*>[\\s\\S]*?<\\/x:c>`
  )
  const number = Number(value.replaceAll(",", ""))
  const cell =
    numeric && value.trim() && Number.isFinite(number)
      ? `<x:c r="${address}" s="${style}"><x:v>${number}</x:v></x:c>`
      : value.trim()
        ? `<x:c r="${address}" s="${style}" t="inlineStr"><x:is><x:t xml:space="preserve">${escapeXml(value.trim())}</x:t></x:is></x:c>`
        : `<x:c r="${address}" s="${style}" />`

  return xml.replace(cellPattern, cell)
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      reference?: string
      items?: MadagascarInvoiceItem[]
    }
    const items = body.items ?? []
    const options = await getMadagascarDropdownOptions()
    const validUnits = new Set(options.invoiceItemUnitOfMeasurement ?? [])
    const validCountries = new Set(options.invoiceItemOriginCountry ?? [])
    const validYesNo = new Set(options.invoiceItemIsSecondHand ?? [])
    const archive = unzipSync(
      new Uint8Array(await fs.readFile(madagascarTemplatePath))
    )
    const sheetKey = "xl/worksheets/sheet1.xml"
    let xml = strFromU8(archive[sheetKey])

    for (let index = 0; index < 248; index += 1) {
      const row = index + 4
      const item = items[index]
      const unit =
        item && validUnits.has(item.unitOfMeasurement)
          ? item.unitOfMeasurement
          : ""
      const country =
        item && validCountries.has(item.originCountry) ? item.originCountry : ""
      const isSecondHand =
        item && validYesNo.has(item.isSecondHand) ? item.isSecondHand : ""
      const values = {
        B: item?.hsCode ?? "",
        C: item?.description ?? "",
        D: item?.quantity ?? "",
        E: unit,
        F: item?.unitPrice ?? "",
        G: isSecondHand,
        H: country,
      }

      for (const [column, value] of Object.entries(values)) {
        xml = replaceCell(
          xml,
          `${column}${row}`,
          column,
          value,
          column === "D" || column === "F"
        )
      }
    }

    archive[sheetKey] = strToU8(xml)
    const output = zipSync(archive, { level: 6 })
    const safeReference = (body.reference || "request")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")

    return new Response(Buffer.from(output), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="ECTN-Certificate-${safeReference || "certificate"}.xlsx"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Could not create the invoice workbook.",
      },
      { status: 500 }
    )
  }
}
