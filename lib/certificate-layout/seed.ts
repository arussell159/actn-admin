import { createInitialPages, formPresentation } from "../okf/seed"
import {
  madagascarIncotermOptions,
  madagascarShipmentMethodOptions,
  madagascarCargoTypeOptions,
  madagascarContainerTypeOptions,
  madagascarContainerSizeOptions,
} from "../madagascar-bsc"
import {
  certificateLayoutSchema,
  type CertificateGroup,
  type CertificateLayoutRecord,
} from "./schema"

const choices: Record<string, string[]> = {
  incoterm: madagascarIncotermOptions.map((option) => option.name),
  shipmentMethod: [...madagascarShipmentMethodOptions],
  cargoType: [...madagascarCargoTypeOptions],
  containerType: [...madagascarContainerTypeOptions],
  containerSize: [...madagascarContainerSizeOptions],
}
export function createMadagascarLayout(): CertificateLayoutRecord {
  const pages = createInitialPages()
  const group = (
    id: string,
    title: string,
    columns: number,
    fieldIds: string[],
    extra: Partial<CertificateGroup> = {}
  ): CertificateGroup => ({
    id,
    title,
    kind: "fields",
    columns,
    span: 1,
    separator: false,
    breakpoint: "md",
    fields: fieldIds.map((fieldId) => ({ fieldId, span: 1 })),
    groups: [],
    ...extra,
  })
  const label = (fieldId: string) => {
    const labels: Record<string, string> = {
      commercialInvoiceReference: "Reference",
      commercialInvoiceDate: "Issuance Date",
      packingListReference: "Reference",
      packingListDate: "Issuance Date",
      exportDeclarationReference: "Reference",
      exportDeclarationDate: "Issuance Date",
      billOfLadingReference: "Reference",
      billOfLadingDate: "Issuance Date",
      containerType: "Type",
      containerSize: "Size",
      loadingCountry: "Country",
      loadingDate: "Date",
      loadingCity: "City",
      unloadingCountry: "Country",
      unloadingDate: "Date",
      unloadingCity: "City",
      "invoiceItems.unitOfMeasurement": "Unit",
      "invoiceItems.isSecondHand": "Second hand",
    }
    return (
      labels[fieldId] ??
      formPresentation.find((field) => field.id === fieldId)!.label
    )
  }
  return {
    country_key: "madagascar",
    revision: 1,
    updated_at: "2026-09-10T00:00:00.000Z",
    updated_by: null,
    layout: certificateLayoutSchema.parse({
      schemaVersion: 1,
      country: "Madagascar",
      aliases: ["MG", "MDG"],
      fields: formPresentation.map((field) => ({
        id: field.id,
        label: label(field.id),
        control: choices[field.id]
          ? "select"
          : /Date$/.test(field.id)
            ? "date"
            : "text",
        options: choices[field.id] ?? [],
        sourceDocument:
          pages
            .flatMap((page) => page.content.fields)
            .find((source) => source.portalFieldIds.includes(field.id))
            ?.document ?? "",
        instruction:
          pages
            .flatMap((page) => page.content.fields)
            .find((source) => source.portalFieldIds.includes(field.id))
            ?.instruction ?? "",
      })),
      sections: [
        {
          id: "trade-parties",
          title: "Trade Parties",
          columns: 2,
          groups: [
            group("exporter", "Exporter", 1, ["exporterName"]),
            group("importer", "Importer", 1, ["importerName"]),
          ],
        },
        {
          id: "invoices",
          title: "Invoices",
          columns: 1,
          groups: [
            group("incoterms", "", 2, ["incoterm", "incotermPlace"]),
            group("invoice-values", "", 2, ["fobValue", "currency"], {
              kind: "invoice-values",
            }),
            group("invoice-documents", "Documents", 1, [], {
              separator: true,
              groups: [
                group(
                  "commercial-invoice",
                  "Commercial Invoice",
                  2,
                  ["commercialInvoiceReference", "commercialInvoiceDate"],
                  { breakpoint: "sm" }
                ),
                group(
                  "packing-list",
                  "Packing List",
                  2,
                  ["packingListReference", "packingListDate"],
                  { breakpoint: "sm" }
                ),
              ],
            }),
            group(
              "invoice-items",
              "Invoice Items",
              1,
              formPresentation
                .filter((field) => field.id.startsWith("invoiceItems."))
                .map((field) => field.id),
              { kind: "invoice-items", separator: true }
            ),
          ],
        },
        {
          id: "shipment",
          title: "Shipment",
          columns: 1,
          groups: [
            group("shipment-details", "", 2, [
              "shipmentMethod",
              "cargoType",
              "grossWeight",
              "volume",
              "shippingLine",
              "voyage",
              "vessel",
            ]),
            group(
              "containers",
              "Container Information",
              4,
              [
                "containerNumber",
                "sealNumber",
                "containerType",
                "containerSize",
              ],
              { separator: true }
            ),
            group("road-map", "Road Map", 1, [], {
              separator: true,
              groups: [
                group("loading", "Loading", 3, [
                  "loadingCountry",
                  "loadingDate",
                  "loadingCity",
                ]),
                group("unloading", "Unloading", 3, [
                  "unloadingCountry",
                  "unloadingDate",
                  "unloadingCity",
                ]),
              ],
            }),
            group("shipment-documents", "Documents", 1, [], {
              separator: true,
              groups: [
                group("export-declaration", "Export Declaration", 2, [
                  "exportDeclarationReference",
                  "exportDeclarationDate",
                ]),
                group("bill-of-lading", "Bill of Lading", 2, [
                  "billOfLadingReference",
                  "billOfLadingDate",
                ]),
              ],
            }),
          ],
        },
        {
          id: "documents",
          title: "Uploaded Documents",
          columns: 1,
          groups: [
            group("uploaded-documents", "", 1, [], { kind: "documents" }),
          ],
        },
      ],
    }),
  }
}
