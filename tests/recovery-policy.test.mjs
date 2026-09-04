import assert from "node:assert/strict"
import test from "node:test"

import {
  isRecoveryCooldownElapsed,
  isStaleAssetError,
} from "../lib/recovery-policy.ts"

test("recognizes deployment-related chunk failures", () => {
  assert.equal(
    isStaleAssetError(new Error("Failed to fetch dynamically imported module")),
    true
  )
  assert.equal(isStaleAssetError("CSS_CHUNK_LOAD_FAILED"), true)
  assert.equal(isStaleAssetError(new Error("Database unavailable")), false)
})

test("automatic recovery cannot loop inside its cooldown", () => {
  assert.equal(
    isRecoveryCooldownElapsed({
      lastRecovery: 9_000,
      now: 10_000,
      cooldownMs: 5_000,
    }),
    false
  )
  assert.equal(
    isRecoveryCooldownElapsed({
      lastRecovery: 1_000,
      now: 10_000,
      cooldownMs: 5_000,
    }),
    true
  )
})
