import assert from "node:assert/strict"
import test from "node:test"
import { certificateFieldCopyValue } from "../lib/certificate-field-copy.ts"

test("certificate date copies use dd/mm/yyyy without locale or timezone conversion", () => {
  for (const [stored, copied] of [
    ["2026-10-06", "06/10/2026"],
    ["2024-02-29", "29/02/2024"],
    ["2026-01-09", "09/01/2026"],
    ["2026-12-31", "31/12/2026"],
    [" 2026-10-06 ", "06/10/2026"],
  ]) {
    assert.equal(certificateFieldCopyValue(stored, true), copied)
  }
})

test("copy preserves non-date fields and incomplete date values", () => {
  for (const value of ["2026-10-06", "  ACME SARL  ", "0.923456", ""]) {
    assert.equal(certificateFieldCopyValue(value, false), value)
  }
  for (const value of ["", "2026-10", "06/10/2026", "Unknown", "2026-1-9"]) {
    assert.equal(certificateFieldCopyValue(value, true), value)
  }
})
