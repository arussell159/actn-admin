"use client"

import { type CSSProperties, type ReactNode } from "react"
import { CertificateSection } from "@/components/certificate-section"
import { CertificateFieldControl } from "@/components/certificate-field-control"
import { Button as MovingBorderContainer } from "@/components/ui/moving-border"
import { cn } from "@/lib/utils"
import type {
  CertificateField,
  CertificateGroup,
  CertificateLayout,
} from "@/lib/certificate-layout/schema"

const grids = {
  sm: [
    "",
    "sm:grid-cols-1",
    "sm:grid-cols-2",
    "sm:grid-cols-3",
    "sm:grid-cols-4",
  ],
  md: [
    "",
    "md:grid-cols-1",
    "md:grid-cols-2",
    "md:grid-cols-3",
    "md:grid-cols-4",
  ],
}
const spans = {
  sm: ["", "sm:col-span-1", "sm:col-span-2", "sm:col-span-3", "sm:col-span-4"],
  md: ["", "md:col-span-1", "md:col-span-2", "md:col-span-3", "md:col-span-4"],
}
export const certificateGridClass = (
  columns: number,
  breakpoint: "sm" | "md" = "md"
) => cn("grid min-w-0 gap-3", grids[breakpoint][columns])
export const certificateFieldGridClass = (
  columns: number,
  breakpoint: "sm" | "md" = "md",
  centerSingleColumn = false
) =>
  cn(
    certificateGridClass(columns, breakpoint),
    centerSingleColumn &&
      columns === 1 &&
      (breakpoint === "sm"
        ? "sm:w-[calc((100%-0.75rem)/2)] sm:justify-self-start"
        : "md:w-[calc((100%-0.75rem)/2)] md:justify-self-start")
  )
export const certificateSpanClass = (
  span: number,
  breakpoint: "sm" | "md" = "md"
) => spans[breakpoint][span]

export function CertificateForm({
  layout,
  renderField,
  renderSpecial,
  sectionAction,
  groupAction,
  sectionTitle,
  groupTitle,
  groupFooter,
  isLoading = false,
}: {
  layout: CertificateLayout
  renderField?: (field: CertificateField) => ReactNode
  renderSpecial?: (
    group: CertificateGroup,
    fields: CertificateField[],
    centerSingleColumn: boolean
  ) => ReactNode
  sectionAction?: (section: CertificateLayout["sections"][number]) => ReactNode
  groupAction?: (group: CertificateGroup) => ReactNode
  sectionTitle?: (section: CertificateLayout["sections"][number]) => ReactNode
  groupTitle?: (group: CertificateGroup) => ReactNode
  groupFooter?: (group: CertificateGroup) => ReactNode
  isLoading?: boolean
}) {
  const fieldMap = new Map(layout.fields.map((field) => [field.id, field]))
  function groupContent(
    group: CertificateGroup,
    depth: number,
    breakpoint: "sm" | "md",
    parentColumns: number
  ) {
    const groupFields = group.fields.flatMap((placement) => {
      const field = fieldMap.get(placement.fieldId)
      return field ? [{ ...field, label: placement.label || field.label }] : []
    })
    const title = groupTitle ? groupTitle(group) : group.title
    const heading = title ? (
      depth > 0 ? (
        <h4 className="text-sm font-medium">{title}</h4>
      ) : (
        <h3 className="text-[15px] leading-5 font-semibold text-foreground">
          {title}
        </h3>
      )
    ) : null
    return (
      <div
        key={group.id}
        data-layout-group={group.id}
        className={cn(
          "grid min-w-0 content-start gap-3",
          spans[breakpoint][group.span],
          group.separator && "border-t pt-6"
        )}
      >
        {heading || groupAction?.(group) ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            {heading}
            {groupAction?.(group)}
          </div>
        ) : null}
        {group.kind === "fields" ? (
          group.fields.length ? (
            <div
              className={certificateFieldGridClass(
                group.columns,
                group.breakpoint,
                group.span === parentColumns
              )}
            >
              {group.fields.map((placement) => {
                const field = fieldMap.get(placement.fieldId)
                if (!field) return null
                const displayed = {
                  ...field,
                  label: placement.label || field.label,
                }
                return (
                  <div
                    key={field.id}
                    data-layout-field={field.id}
                    style={
                      placement.row || placement.column
                        ? ({
                            "--certificate-row": placement.row,
                            "--certificate-column": placement.column,
                          } as CSSProperties)
                        : undefined
                    }
                    className={cn(
                      "min-w-0",
                      spans[group.breakpoint][placement.span],
                      placement.row &&
                        (group.breakpoint === "sm"
                          ? "sm:[grid-row-start:var(--certificate-row)]"
                          : "md:[grid-row-start:var(--certificate-row)]"),
                      placement.column &&
                        (group.breakpoint === "sm"
                          ? "sm:[grid-column-start:var(--certificate-column)]"
                          : "md:[grid-column-start:var(--certificate-column)]")
                    )}
                  >
                    {renderField ? (
                      renderField(displayed)
                    ) : (
                      <CertificateFieldControl field={displayed} value="" />
                    )}
                  </div>
                )
              })}
            </div>
          ) : null
        ) : (
          renderSpecial?.(group, groupFields, group.span === parentColumns)
        )}
        {group.groups.length ? (
          <div
            className={cn(
              certificateGridClass(group.columns, group.breakpoint),
              "gap-4"
            )}
          >
            {group.groups.map((child) =>
              groupContent(child, depth + 1, group.breakpoint, group.columns)
            )}
          </div>
        ) : null}
        {groupFooter?.(group)}
      </div>
    )
  }
  return (
    <MovingBorderContainer
      active={isLoading}
      as="div"
      borderRadius="0.875rem"
      duration={4200}
      containerClassName="h-auto w-full"
      borderClassName="h-32 w-32 opacity-95"
      className="block h-auto bg-background p-4 text-foreground sm:p-6"
      aria-busy={isLoading || undefined}
      aria-label={
        isLoading ? "Certificate fields are being populated" : undefined
      }
    >
      <div
        className="mx-auto grid w-full max-w-6xl gap-8 font-sans"
        data-certificate-country={layout.country}
      >
        {layout.sections.map((section) => (
          <CertificateSection
            key={section.id}
            sectionId={section.id}
            title={sectionTitle ? sectionTitle(section) : section.title}
            action={sectionAction?.(section)}
            contentClassName={cn(
              certificateGridClass(section.columns),
              section.groups.some((group) => group.kind === "documents") &&
                "p-0 sm:p-0"
            )}
          >
            {section.groups.map((group) =>
              groupContent(group, 0, "md", section.columns)
            )}
          </CertificateSection>
        ))}
      </div>
    </MovingBorderContainer>
  )
}
