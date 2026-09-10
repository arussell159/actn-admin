"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { layoutGroups } from "@/lib/certificate-layout/editing"
import type {
  CertificateField,
  CertificateLayout,
} from "@/lib/certificate-layout/schema"

export function certificateFieldLabel(field: CertificateField) {
  return [
    "Name",
    "Address",
    "Country",
    "Date",
    "Reference",
    "Issuance Date",
    "Type",
    "Size",
  ].includes(field.label)
    ? field.id
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/^./, (letter) => letter.toUpperCase())
    : field.label
}

export function CertificateLayoutFields({
  layout,
  search,
  onSearchChange,
  canEdit,
  onEdit,
}: {
  layout: CertificateLayout
  search: string
  onSearchChange: (value: string) => void
  canEdit: boolean
  onEdit: (id: string) => void
}) {
  const groups = layoutGroups(layout)
  const fields = layout.fields
    .filter((field) => field.id !== "invoiceValues")
    .map((field) => {
      const location = groups.find((item) =>
        item.group.fields.some((placement) => placement.fieldId === field.id)
      )
      const placement = location?.group.fields.find(
        (placement) => placement.fieldId === field.id
      )
      return {
        field,
        label: placement?.label || certificateFieldLabel(field),
        location: location?.path || "Not placed",
      }
    })
    .filter((item) =>
      `${item.label} ${item.location}`
        .toLowerCase()
        .includes(search.trim().toLowerCase())
    )

  return (
    <div className="grid min-w-0 gap-4">
      <Input
        aria-label="Search country fields"
        placeholder="Search fields…"
        className="max-w-sm"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <div className="min-w-0 overflow-hidden rounded-lg border">
        <Table aria-label="Country fields" className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead>Field</TableHead>
              <TableHead>Location in layout</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map(({ field, label, location }) => (
              <TableRow key={field.id}>
                <TableCell className="whitespace-normal">
                  {canEdit ? (
                    <Button
                      variant="link"
                      className="h-auto max-w-full justify-start px-0 py-1 text-left whitespace-normal"
                      onClick={() => onEdit(field.id)}
                      aria-label={`Edit field ${label}`}
                    >
                      {label}
                    </Button>
                  ) : (
                    label
                  )}
                </TableCell>
                <TableCell className="whitespace-normal text-muted-foreground">
                  {location}
                </TableCell>
              </TableRow>
            ))}
            {!fields.length ? (
              <TableRow>
                <TableCell
                  colSpan={2}
                  className="py-8 text-center text-muted-foreground"
                >
                  {search.trim()
                    ? "No fields match your search."
                    : "No fields yet. Add a field to get started."}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
