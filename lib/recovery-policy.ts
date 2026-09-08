export function isStaleAssetError(reason: unknown) {
  const message =
    reason instanceof Error
      ? `${reason.name} ${reason.message}`
      : typeof reason === "string"
        ? reason
        : ""

  return /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed|CSS_CHUNK_LOAD_FAILED|Failed to load module script/i.test(
    message
  )
}

export function isRecoveryCooldownElapsed({
  lastRecovery,
  now,
  cooldownMs,
}: {
  lastRecovery: number
  now: number
  cooldownMs: number
}) {
  return (
    !Number.isFinite(lastRecovery) ||
    now - lastRecovery > Math.max(0, cooldownMs)
  )
}
