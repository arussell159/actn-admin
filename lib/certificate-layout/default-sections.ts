import type { CertificateGroup, CertificateLayout } from "./schema"

// Old saved layouts can contain the corrections block. It is now supplied by
// every certificate record, so remove it from the configurable layout on read.
export function editableCertificateLayout(
  layout: CertificateLayout
): CertificateLayout {
  function clean(
    groups: CertificateGroup[],
    parentColumns: number
  ): CertificateGroup[] {
    return groups.flatMap((group) => {
      if (group.kind === "corrections" && !group.fields.length)
        return clean(group.groups, parentColumns)
      const children = clean(group.groups, group.columns)
      group = { ...group, span: Math.min(group.span, parentColumns) }
      if (group.kind !== "corrections") return [{ ...group, groups: children }]
      return group.fields.length
        ? [{ ...group, kind: "fields" as const, groups: children }]
        : children
    })
  }
  return {
    ...layout,
    sections: layout.sections.flatMap((section) => {
      const groups = clean(section.groups, section.columns)
      return section.groups.length && !groups.length
        ? []
        : [{ ...section, groups }]
    }),
  }
}
