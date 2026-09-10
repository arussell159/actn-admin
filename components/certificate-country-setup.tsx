"use client"

import { useState } from "react"
import { ArrowRightIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"
import type { CertificateLayout } from "@/lib/certificate-layout/schema"
import { createEmptyCertificateLayout } from "@/lib/certificate-layout/editing"

export function CertificateCountrySetup({
  onCountryNameChange,
  onGenerated,
}: {
  onCountryNameChange: (country: string) => void
  onGenerated: (layout: CertificateLayout) => void
}) {
  const [country, setCountry] = useState("")

  return (
    <form
      className="mx-auto grid w-full max-w-xl gap-6"
      onSubmit={(event) => {
        event.preventDefault()
        if (country.trim()) onGenerated(createEmptyCertificateLayout(country))
      }}
    >
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold">Create country</h1>
        <p className="text-sm text-muted-foreground">
          Create the draft first, then import each system page from the layout
          editor or build it manually.
        </p>
      </div>
      <Field>
        <FieldLabel>Country</FieldLabel>
        <Input
          value={country}
          onChange={(event) => {
            setCountry(event.target.value)
            onCountryNameChange(event.target.value)
          }}
          placeholder="Country name"
          autoFocus
        />
      </Field>
      <div className="flex justify-end border-t pt-4">
        <Button type="submit" disabled={!country.trim()}>
          Create country
          <ArrowRightIcon />
        </Button>
      </div>
    </form>
  )
}
