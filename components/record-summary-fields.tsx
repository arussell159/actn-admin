"use client"

import { useId } from "react"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type SummaryFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  onActivate: () => void
}

export function SummaryField({
  label,
  value,
  onChange,
  onActivate,
  isEditing,
}: SummaryFieldProps & { isEditing: boolean }) {
  const id = useId()
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        value={value}
        readOnly={!isEditing}
        onClick={onActivate}
        onChange={(event) => onChange(event.target.value)}
        className="cursor-pointer read-only:bg-muted/30"
      />
    </Field>
  )
}

export function SummarySelectField({
  label,
  value,
  values,
  onChange,
  onActivate,
}: SummaryFieldProps & { values: readonly string[] }) {
  const id = useId()
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        value={value}
        onOpenChange={(open) => {
          if (open) onActivate()
        }}
        onValueChange={(selectedValue) => {
          onActivate()
          if (selectedValue) onChange(selectedValue)
        }}
      >
        <SelectTrigger id={id} className="cursor-pointer">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {values.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}
