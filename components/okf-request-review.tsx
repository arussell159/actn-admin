"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { okfApi } from "@/lib/okf/client"
import type { MadagascarRequest } from "@/lib/madagascar-bsc"

export type PendingRequestEdit = {
  target: string
  label: string
  value: string
  reviewId?: string
}

// The record contains only the existing certificate form. This dialog appears on a field edit.
export function RequestCorrectionDialog({
  request,
  onChange,
  pendingEdit,
  onCloseEdit,
}: {
  request: MadagascarRequest
  onChange: (request: MadagascarRequest) => void
  pendingEdit: PendingRequestEdit | null
  onCloseEdit: () => void
}) {
  const [reason, setReason] = React.useState("")
  const [error, setError] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => {
    setReason("")
    setError("")
  }, [pendingEdit])
  async function correct() {
    if (!pendingEdit || !reason.trim()) return
    setBusy(true)
    setError("")
    try {
      const result = await okfApi<{ request: MadagascarRequest }>(
        "/api/okf/requests",
        {
          action: "correct",
          requestId: request.id,
          target: pendingEdit.target,
          value: pendingEdit.value,
          reason,
          expectedUpdatedAt: request.updatedAt,
          reviewId: pendingEdit.reviewId ?? request.analysis.okf?.id ?? null,
        }
      )
      onChange(result.request)
      onCloseEdit()
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not save correction."
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      open={!!pendingEdit}
      onOpenChange={(open) => {
        if (!open && !busy) onCloseEdit()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogTitle>Record request correction</DialogTitle>
        <DialogDescription>
          {pendingEdit?.label}. The original value and reason will be retained.
        </DialogDescription>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void correct()
          }}
        >
          <p className="rounded-md bg-muted px-3 py-2 text-sm">
            <span className="text-muted-foreground">New value: </span>
            {pendingEdit?.value || "Blank"}
          </p>
          <label className="grid gap-1 text-sm">
            Reason
            <Textarea
              aria-label="Correction reason"
              value={reason}
              autoFocus
              onChange={(e) => setReason(e.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
              }}
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onCloseEdit}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !reason.trim()}>
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
