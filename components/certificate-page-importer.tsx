"use client"

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react"
import {
  ChevronDownIcon,
  ClipboardPasteIcon,
  ImagePlusIcon,
  UploadIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CertificateForm } from "@/components/certificate-form"
import {
  certificateLayoutSchema,
  type CertificateLayout,
} from "@/lib/certificate-layout/schema"

function ScreenshotPreview({
  file,
  review = false,
}: {
  file: File
  review?: boolean
}) {
  const [url] = useState(() => URL.createObjectURL(file))
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  return (
    <div
      className={
        review
          ? "grid min-h-0 place-items-start overflow-auto rounded-lg border bg-muted/30 p-2"
          : "grid max-h-[62dvh] place-items-center overflow-auto rounded-lg border bg-muted/30 p-2"
      }
    >
      {/* Blob URLs do not expose dimensions to next/image; preserve the source pixels here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="System page being imported"
        className="block h-auto max-w-full"
      />
    </div>
  )
}

function GeneratedFieldPreview({
  field,
  uncertain,
}: {
  field: CertificateLayout["fields"][number]
  uncertain: boolean
}) {
  return (
    <div
      className={
        uncertain
          ? "rounded-lg ring-2 ring-amber-400/70 ring-offset-2 ring-offset-background"
          : undefined
      }
    >
      <div className="grid min-w-0 gap-1.5">
        <span className="text-[13px] font-semibold text-foreground">
          {field.label}
        </span>
        <div
          className={`flex w-full items-center rounded-lg border bg-background px-3 ${
            field.control === "textarea" ? "h-20" : "h-9"
          }`}
        >
          {field.control === "select" ? (
            <ChevronDownIcon className="ml-auto size-4 text-muted-foreground" />
          ) : null}
        </div>
      </div>
      {uncertain ? (
        <span className="mt-1 block text-xs font-medium text-amber-700 dark:text-amber-300">
          Check mapping
        </span>
      ) : null}
    </div>
  )
}

export function CertificatePageImporter({
  country,
  pageNumber,
  disabled,
  onAccept,
}: {
  country: string
  pageNumber: number
  disabled?: boolean
  onAccept: (layout: CertificateLayout) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File>()
  const [generated, setGenerated] = useState<CertificateLayout>()
  const [uncertainFieldIds, setUncertainFieldIds] = useState<string[]>([])
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)

  const chooseFile = useCallback((next?: File) => {
    if (!next) return
    if (!["image/png", "image/jpeg", "image/webp"].includes(next.type)) {
      setError("Use a PNG, JPEG or WebP screenshot.")
      return
    }
    if (next.size > 15 * 1024 * 1024) {
      setError("Keep this screenshot under 15 MB.")
      return
    }
    setFile(next)
    setGenerated(undefined)
    setUncertainFieldIds([])
    setError("")
  }, [])

  useEffect(() => {
    if (!open || generated) return
    function paste(event: ClipboardEvent) {
      const image = Array.from(event.clipboardData?.items ?? [])
        .find((item) => item.kind === "file" && item.type.startsWith("image/"))
        ?.getAsFile()
      if (!image) return
      event.preventDefault()
      const extension =
        image.type === "image/jpeg"
          ? "jpg"
          : image.type === "image/webp"
            ? "webp"
            : "png"
      chooseFile(
        new File([image], `page-${pageNumber}.${extension}`, {
          type: image.type,
        })
      )
    }
    window.addEventListener("paste", paste)
    return () => window.removeEventListener("paste", paste)
  }, [chooseFile, generated, open, pageNumber])

  function reset() {
    setFile(undefined)
    setGenerated(undefined)
    setUncertainFieldIds([])
    setError("")
    setProgress(0)
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    chooseFile(event.dataTransfer.files[0])
  }

  async function analyze() {
    if (!file || busy) return
    setBusy(true)
    setError("")
    setProgress(10)
    const timer = window.setInterval(
      () => setProgress((value) => Math.min(92, value + 3)),
      850
    )
    try {
      const data = new FormData()
      data.set("country", country)
      data.set("pageNumber", String(pageNumber))
      data.append("screenshots", file)
      const response = await fetch("/api/okf/layouts/from-screenshots", {
        method: "POST",
        body: data,
      })
      const result = await response.json()
      if (!response.ok)
        throw Error(result.message || "Could not read this system page.")
      setGenerated(certificateLayoutSchema.parse(result.layout))
      setUncertainFieldIds(
        Array.isArray(result.uncertainFieldIds)
          ? result.uncertainFieldIds.filter(
              (value: unknown): value is string => typeof value === "string"
            )
          : []
      )
      setProgress(100)
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not read this system page."
      )
    } finally {
      window.clearInterval(timer)
      setBusy(false)
    }
  }

  const progressLabel =
    progress < 35
      ? "Reading labels and controls"
      : progress < 70
        ? "Recreating the field grid"
        : progress < 100
          ? "Matching field meanings"
          : "Page ready to review"
  const uncertain = new Set(uncertainFieldIds)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return
        setOpen(next)
        if (!next) reset()
      }}
    >
      <Button
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <ImagePlusIcon />
        Import page
      </Button>
      <DialogContent className="h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-none">
        <DialogHeader>
          <DialogTitle>
            {generated
              ? `Review page ${pageNumber}`
              : `Import page ${pageNumber}`}
          </DialogTitle>
          <DialogDescription>
            {generated
              ? "Compare the generated page with the screenshot. Fields marked Check mapping need your attention after adding the page."
              : "Paste a Windows screenshot with Ctrl+V, drop it here, or choose a file."}
          </DialogDescription>
        </DialogHeader>

        {!file ? (
          <div
            className="grid min-h-64 place-items-center gap-4 rounded-lg border border-dashed p-8 text-center transition-colors hover:bg-muted/30"
            onDragOver={(event) => event.preventDefault()}
            onDrop={drop}
          >
            <div className="grid place-items-center gap-2">
              <ClipboardPasteIcon className="size-8 text-muted-foreground" />
              <p className="font-medium">Paste or drop one system page</p>
              <p className="text-sm text-muted-foreground">
                One page at a time is faster and easier to verify.
              </p>
            </div>
            <Button variant="outline" onClick={() => inputRef.current?.click()}>
              <UploadIcon />
              Choose screenshot
            </Button>
          </div>
        ) : generated ? (
          <div className="grid min-h-0 min-w-0 gap-4 overflow-y-auto lg:grid-cols-2 lg:overflow-hidden">
            <div className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
              <span className="text-sm font-medium">Original screenshot</span>
              <ScreenshotPreview file={file} review />
            </div>
            <div className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Generated page</span>
                {uncertain.size ? (
                  <Badge variant="outline">{uncertain.size} to check</Badge>
                ) : null}
              </div>
              <div className="min-h-0 overflow-y-auto rounded-lg border bg-background p-4">
                <CertificateForm
                  layout={generated}
                  renderField={(field) => (
                    <GeneratedFieldPreview
                      field={field}
                      uncertain={uncertain.has(field.id)}
                    />
                  )}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            <ScreenshotPreview file={file} />
            {busy ? (
              <div className="grid gap-2" aria-live="polite">
                <div className="flex justify-between gap-4 text-sm">
                  <span>{progressLabel}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {progress}%
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label="Importing system page"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                  className="h-2 overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(event) => {
            chooseFile(event.target.files?.[0])
            event.target.value = ""
          }}
        />
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          {generated ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setGenerated(undefined)
                  setUncertainFieldIds([])
                  setProgress(0)
                }}
              >
                Try another screenshot
              </Button>
              <Button
                onClick={() => {
                  onAccept(generated)
                  setOpen(false)
                  reset()
                }}
              >
                Add page to draft
              </Button>
            </>
          ) : file ? (
            <>
              <Button variant="outline" disabled={busy} onClick={reset}>
                Choose another
              </Button>
              <Button disabled={busy} onClick={() => void analyze()}>
                {busy ? "Importing…" : "Generate page"}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
