import "server-only"

import fs from "node:fs/promises"
import path from "node:path"
import * as XLSX from "xlsx"

import {
  madagascarCargoTypeOptions,
  madagascarContainerSizeOptions,
  madagascarContainerTypeOptions,
  madagascarIncotermOptions,
  madagascarOfficialRuleDefinitions,
  madagascarShipmentMethodOptions,
  type MadagascarDropdownOptions,
} from "@/lib/madagascar-bsc"

export const madagascarTemplatePath = path.join(
  process.cwd(),
  "public",
  "madagascar-bsc",
  "invoice_template_En.xlsx"
)

let optionPromise: Promise<MadagascarDropdownOptions> | undefined

export function getMadagascarDropdownOptions() {
  if (!optionPromise) {
    optionPromise = fs.readFile(madagascarTemplatePath).then((file) => {
      const workbook = XLSX.read(file, { type: "buffer" })
      const sheet = workbook.Sheets["Invoice Items"]
      const countries: string[] = []
      const units: string[] = []

      for (let row = 4; row <= 304; row += 1) {
        const country = sheet?.[`K${row}`]?.v
        const unit = sheet?.[`N${row}`]?.v
        if (typeof country === "string" && country.trim())
          countries.push(country)
        if (typeof unit === "string" && unit.trim()) units.push(unit)
      }

      return {
        incoterm: [...madagascarIncotermOptions]
          .sort((left, right) => left.order - right.order)
          .map((incoterm) => incoterm.name),
        shipmentMethod: [...madagascarShipmentMethodOptions],
        cargoType: [...madagascarCargoTypeOptions],
        containerType: [...madagascarContainerTypeOptions],
        containerSize: [...madagascarContainerSizeOptions],
        exporterCountry: countries,
        importerCountry: countries,
        loadingCountry: countries,
        unloadingCountry: countries,
        invoiceItemOriginCountry: countries,
        invoiceItemUnitOfMeasurement: units,
        invoiceItemIsSecondHand: ["Yes", "No"],
      }
    })
  }

  return optionPromise
}

export const madagascarOfficialRules = madagascarOfficialRuleDefinitions.map(
  (rule) => `${rule.documentType}: ${rule.instruction}`
)
