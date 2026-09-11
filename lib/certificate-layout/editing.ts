import type {
  CertificateGroup,
  CertificateLayout,
  FieldPlacement,
} from "./schema"
export function layoutGroups(layout: CertificateLayout) {
  const result: {
    group: CertificateGroup
    parentColumns: number
    depth: number
    path: string
  }[] = []
  function visit(
    groups: CertificateGroup[],
    columns: number,
    depth: number,
    path: string
  ) {
    for (const group of groups) {
      const name = path + (group.title ? " / " + group.title : "")
      result.push({ group, parentColumns: columns, depth, path: name })
      visit(group.groups, group.columns, depth + 1, name)
    }
  }
  layout.sections.forEach((section) =>
    visit(section.groups, section.columns, 1, section.title)
  )
  return result
}
export const newLayoutGroup = (span = 1): CertificateGroup => ({
  id: "group-" + crypto.randomUUID(),
  title: "",
  kind: "fields",
  columns: 2,
  span,
  separator: false,
  breakpoint: "md",
  fields: [],
  groups: [],
})
export function createEmptyCertificateLayout(
  country: string
): CertificateLayout {
  return {
    schemaVersion: 1,
    country: country.trim(),
    aliases: [],
    fields: [],
    sections: [
      {
        id: "section-" + crypto.randomUUID(),
        title: "Certificate",
        columns: 1,
        groups: [
          {
            ...newLayoutGroup(),
            columns: 1,
          },
        ],
      },
    ],
  }
}
export function layoutWithoutFields(layout: CertificateLayout) {
  const copy = structuredClone(layout)
  copy.fields = []
  function clear(groups: CertificateGroup[]) {
    for (const group of groups) {
      group.fields = []
      clear(group.groups)
    }
  }
  for (const section of copy.sections) clear(section.groups)
  return copy
}

function starterOnly(layout: CertificateLayout) {
  const section = layout.sections[0]
  const group = section?.groups[0]
  return (
    layout.fields.length === 0 &&
    layout.sections.length === 1 &&
    section.title === "Certificate" &&
    section.groups.length === 1 &&
    group.kind === "fields" &&
    !group.title &&
    !group.fields.length &&
    !group.groups.length
  )
}

function availableId(id: string, used: Set<string>) {
  if (!used.has(id)) {
    used.add(id)
    return id
  }
  let suffix = 2
  while (used.has(`${id}-${suffix}`)) suffix += 1
  const next = `${id}-${suffix}`
  used.add(next)
  return next
}

export function appendImportedPage(
  layout: CertificateLayout,
  imported: CertificateLayout
) {
  const next = structuredClone(layout)
  const page = structuredClone(imported)
  const usedFieldIds = new Set(next.fields.map((field) => field.id))
  const usedLayoutIds = new Set<string>()
  for (const section of next.sections) {
    usedLayoutIds.add(section.id)
  }
  for (const { group } of layoutGroups(next)) usedLayoutIds.add(group.id)

  const fieldIds = new Map<string, string>()
  for (const field of page.fields) {
    const id = availableId(field.id, usedFieldIds)
    fieldIds.set(field.id, id)
    field.id = id
  }
  function normalizeGroups(groups: CertificateGroup[]) {
    for (const group of groups) {
      group.id = availableId(group.id, usedLayoutIds)
      group.fields = group.fields.map((placement) => ({
        ...placement,
        fieldId: fieldIds.get(placement.fieldId) ?? placement.fieldId,
      }))
      normalizeGroups(group.groups)
    }
  }
  for (const section of page.sections) {
    section.id = availableId(section.id, usedLayoutIds)
    normalizeGroups(section.groups)
  }

  if (starterOnly(next)) {
    next.fields = page.fields
    next.sections = page.sections
  } else {
    next.fields.push(...page.fields)
    next.sections.push(...page.sections)
  }
  return next
}
export function acceptsField(group: CertificateGroup, id: string) {
  return (
    ["fields", "invoice-values", "invoice-items"].includes(group.kind) &&
    id !== "invoiceValues" &&
    id.startsWith("invoiceItems.") === (group.kind === "invoice-items")
  )
}
function withoutGridPosition(field: FieldPlacement): FieldPlacement {
  return {
    fieldId: field.fieldId,
    span: field.span,
    ...(field.label === undefined ? {} : { label: field.label }),
  }
}
export function moveLayoutField(
  layout: CertificateLayout,
  fieldId: string,
  targetId: string,
  overFieldId?: string
) {
  const groups = layoutGroups(layout).map((item) => item.group)
  const target = groups.find((group) => group.id === targetId)
  if (!target || !acceptsField(target, fieldId) || fieldId === overFieldId)
    return false
  let placement: FieldPlacement = { fieldId, span: 1 }
  const sourceIndex = target.fields.findIndex(
    (field) => field.fieldId === fieldId
  )
  const targetIndex = target.fields.findIndex(
    (field) => field.fieldId === overFieldId
  )
  for (const group of groups) {
    const found = group.fields.find((field) => field.fieldId === fieldId)
    if (found) {
      placement = withoutGridPosition(found)
      group.fields = group.fields
        .filter((field) => field.fieldId !== fieldId)
        .map(withoutGridPosition)
    }
  }
  const index = target.fields.findIndex(
    (field) => field.fieldId === overFieldId
  )
  target.fields.splice(
    index < 0
      ? target.fields.length
      : index + (sourceIndex >= 0 && sourceIndex < targetIndex ? 1 : 0),
    0,
    { ...placement, span: Math.min(placement.span, target.columns) }
  )
  return true
}

export function placeLayoutFieldRight(
  layout: CertificateLayout,
  fieldId: string,
  targetId: string,
  overFieldId: string
) {
  const groups = layoutGroups(layout).map((item) => item.group)
  const target = groups.find((group) => group.id === targetId)
  if (
    !target ||
    target.kind === "invoice-items" ||
    !acceptsField(target, fieldId) ||
    fieldId === overFieldId
  )
    return false

  const anchorIndex = target.fields.findIndex(
    (placement) => placement.fieldId === overFieldId
  )
  if (anchorIndex < 0) return false

  let row = 1
  let column = 1
  const positions = new Map<string, { row: number; column: number }>()
  for (const placement of target.fields) {
    const placementRow = placement.row ?? row
    const placementColumn = placement.column ?? column
    positions.set(placement.fieldId, {
      row: placementRow,
      column: placementColumn,
    })
    column = placementColumn + placement.span
    row = placementRow
    if (column > target.columns) {
      row += 1
      column = 1
    }
  }

  const anchor = target.fields[anchorIndex]
  const anchorPosition = positions.get(overFieldId)!
  const fieldsInRow = target.fields.filter(
    (placement) => positions.get(placement.fieldId)?.row === anchorPosition.row
  )
  const movingWasInRow = fieldsInRow.some(
    (placement) => placement.fieldId === fieldId
  )
  const rowColumns = fieldsInRow.length + (movingWasInRow ? 0 : 1)
  if (rowColumns > 4) return false

  let moving: FieldPlacement = { fieldId, span: 1 }
  for (const group of groups) {
    const found = group.fields.find(
      (placement) => placement.fieldId === fieldId
    )
    if (found) moving = withoutGridPosition(found)
    group.fields = group.fields.filter(
      (placement) => placement.fieldId !== fieldId
    )
  }

  const currentAnchorIndex = target.fields.findIndex(
    (placement) => placement.fieldId === overFieldId
  )
  target.fields.splice(currentAnchorIndex + 1, 0, {
    ...moving,
    span: 1,
  })
  const rowFieldIds = fieldsInRow
    .map((placement) => placement.fieldId)
    .filter((id) => id !== fieldId)
  rowFieldIds.splice(rowFieldIds.indexOf(overFieldId) + 1, 0, fieldId)
  rowFieldIds.forEach((id, index) => {
    const placement = target.fields.find(
      (candidate) => candidate.fieldId === id
    )!
    placement.span = 1
    placement.row = anchorPosition.row
    placement.column = index + 1
    placement.rowColumns = rowColumns
  })
  return true
}
