"use client"
import { ClipboardIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CertificateSection } from "@/components/certificate-section"
import { AiTextShimmer } from "@/components/certificate-field-control"

export function CertificateCorrections({
  message,
  error,
  loading,
  title = "Missing / Corrections Needed",
  emptyMessage = "No corrections needed.",
}: {
  message: string
  error?: string
  loading?: boolean
  title?: string
  emptyMessage?: string
}) {
  return (
    <CertificateSection
      title={title}
      action={
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => navigator.clipboard.writeText(error || message)}
        >
          <ClipboardIcon />
          Copy
        </Button>
      }
    >
      {loading ? (
        <AiTextShimmer />
      ) : (
        <p className="max-w-4xl text-sm leading-6 whitespace-pre-wrap text-muted-foreground">
          {error || message || emptyMessage}
        </p>
      )}
    </CertificateSection>
  )
}
