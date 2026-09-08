"use client"

import { AppErrorRecovery } from "@/components/app-error-recovery"

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return <AppErrorRecovery error={error} onRetry={unstable_retry} />
}
