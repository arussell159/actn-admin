"use client"

import * as React from "react"
import {
  DownloadIcon,
  ImagesIcon,
  LoaderCircleIcon,
  Trash2Icon,
} from "lucide-react"
import { authenticatedFetch } from "@/lib/client"
import {
  madagascarDraftSchema,
  screenshotTypes,
  type MadagascarDraft,
} from "@/lib/madagascar-draft"
import { FileDropWorkspace } from "@/components/file-drop-workspace"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

async function prepareScreenshot(file: File) {
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext("2d")
    if (!context)
      throw new Error(
        "Could not prepare this screenshot. Please try another image."
      )
    context.fillStyle = "white"
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error("Could not read the screenshot.")),
        "image/jpeg",
        0.92
      )
    )
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
      type: "image/jpeg",
    })
  } finally {
    bitmap.close()
  }
}

function ScreenshotThumbnail({ file }: { file: File }) {
  const [url, setUrl] = React.useState("")
  React.useEffect(() => {
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])
  // Local object URLs cannot use the Next.js image optimizer.
  // eslint-disable-next-line @next/next/no-img-element
  return url ? (
    <img
      src={url}
      alt={`Screenshot ${file.name}`}
      className="h-28 w-full rounded-md border bg-muted object-contain"
    />
  ) : null
}

export function MadagascarScreenshotDraft() {
  const input = React.useRef<HTMLInputElement>(null)
  const [files, setFiles] = React.useState<File[]>([])
  const [draft, setDraft] = React.useState<MadagascarDraft | null>(null)
  const [busy, setBusy] = React.useState("")
  const [error, setError] = React.useState("")
  const [pdfUrl, setPdfUrl] = React.useState("")
  const [canPreviewPdf, setCanPreviewPdf] = React.useState(false)
  React.useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)")
    const update = () => setCanPreviewPdf(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])
  const [downloadName, setDownloadName] = React.useState(
    "madagascar-bsc-draft.pdf"
  )
  React.useEffect(
    () => () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    },
    [pdfUrl]
  )

  function invalidate() {
    setDraft(null)
    setPdfUrl("")
    setError("")
  }
  function attach(incoming: File[]) {
    if (busy) return
    if (
      incoming.some(
        (file) => !screenshotTypes.includes(file.type) || file.size === 0
      )
    ) {
      setError("Choose PNG, JPEG or WebP screenshots.")
      return
    }
    if (incoming.some((file) => file.size > 15 * 1024 * 1024)) {
      setError("Keep each screenshot under 15 MB.")
      return
    }
    const next = [...files]
    for (const file of incoming) {
      if (
        !next.some(
          (item) =>
            item.name === file.name &&
            item.size === file.size &&
            item.lastModified === file.lastModified
        )
      )
        next.push(file)
    }
    if (next.length > 3) {
      setError("Use three screenshots. Remove one before adding a replacement.")
      return
    }
    invalidate()
    setFiles(next)
  }
  function edit(update: (current: MadagascarDraft) => MadagascarDraft) {
    setDraft((current) => (current ? update(current) : current))
    setPdfUrl("")
    setError("")
  }
  async function extract() {
    if (files.length !== 3 || busy) return
    setError("")
    setBusy("Reading the three screenshots...")
    setPdfUrl("")
    try {
      const data = new FormData()
      // Resize before upload to stay within the hosting request limit.
      for (const file of files)
        data.append("screenshots", await prepareScreenshot(file))
      const response = await authenticatedFetch(
        "/api/cargo-tracking-notes/madagascar/screenshot-draft",
        { method: "POST", body: data }
      )
      if (!response.ok) {
        const failure = await response.json().catch(() => ({}))
        throw new Error(
          failure.message ||
            (response.status === 413
              ? "These images are too large. Choose smaller screenshots."
              : "Could not read the screenshots. Please try again.")
        )
      }
      const result = await response.json()
      setDraft(madagascarDraftSchema.parse(result.draft))
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not read the screenshots."
      )
    } finally {
      setBusy("")
    }
  }
  async function generate() {
    if (!draft || busy) return
    setBusy("Creating your draft PDF...")
    setError("")
    try {
      const { createMadagascarDraftPdf } =
        await import("@/lib/madagascar-draft-pdf")
      const bytes = await createMadagascarDraftPdf(draft)
      const blob = new Blob([new Uint8Array(bytes)], {
        type: "application/pdf",
      })
      setPdfUrl(URL.createObjectURL(blob))
      const reference = draft.reference
        .replace(/[^a-z0-9_-]/gi, "-")
        .slice(0, 100)
      setDownloadName(
        `madagascar-bsc-draft${reference ? `-${reference}` : ""}.pdf`
      )
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Could not create the PDF."
      )
    } finally {
      setBusy("")
    }
  }

  return (
    <Card id="madagascar-screenshot-draft">
      <CardHeader>
        <CardTitle>Madagascar draft certificate</CardTitle>
        <CardDescription>
          Combine your three SGS application screenshots into a one-page draft
          PDF for customer review.
        </CardDescription>
      </CardHeader>
      <CardContent
        className="grid min-w-0 gap-5"
        onPaste={(event) => {
          const images = Array.from(event.clipboardData.files).filter((file) =>
            file.type.startsWith("image/")
          )
          if (images.length) {
            event.preventDefault()
            attach(images)
          }
        }}
      >
        <FileDropWorkspace
          className="min-h-48 md:min-h-56"
          title="Drop your three system screenshots"
          description="Parties, invoice and items, shipment and routing. Add them together or one at a time, in any order."
          icon={<ImagesIcon className="size-6 text-muted-foreground" />}
          actions={
            <Button
              type="button"
              disabled={!!busy}
              onClick={(event) => {
                event.stopPropagation()
                input.current?.click()
              }}
            >
              Choose screenshots
            </Button>
          }
          footer={`${files.length} of 3 screenshots · PNG, JPEG or WebP · You can also paste with Ctrl+V`}
          onChooseFile={() => {
            if (!busy) input.current?.click()
          }}
          onFiles={attach}
        />
        <input
          ref={input}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp"
          aria-label="SGS application screenshots"
          className="sr-only"
          disabled={!!busy}
          onChange={(event) => {
            attach(Array.from(event.target.files ?? []))
            event.target.value = ""
          }}
        />
        {files.length ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {files.map((file, index) => (
              <div
                className="min-w-0 rounded-lg border p-3"
                key={`${file.name}-${index}`}
              >
                <ScreenshotThumbnail file={file} />
                <div className="mt-2 flex min-w-0 items-center gap-2">
                  <span
                    className="min-w-0 flex-1 truncate text-sm"
                    title={file.name}
                  >
                    {file.name}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove ${file.name}`}
                    disabled={!!busy}
                    onClick={() => {
                      invalidate()
                      setFiles(files.filter((_, i) => i !== index))
                    }}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {busy ? (
          <p
            role="status"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <LoaderCircleIcon className="size-4 animate-spin" />
            {busy}
          </p>
        ) : null}
        {!draft ? (
          <div className="flex justify-end">
            <Button
              type="button"
              disabled={files.length !== 3 || !!busy}
              onClick={extract}
            >
              Read screenshots
            </Button>
          </div>
        ) : (
          <div className="grid min-w-0 gap-5">
            <div>
              <h3 className="font-semibold">Review your draft</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Check the extracted details and edit anything that needs
                correcting before creating the PDF.
              </p>
            </div>
            {draft.warnings.length ? (
              <div
                role="note"
                className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
              >
                <p className="font-medium">Please check</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {draft.warnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <label className="grid gap-2 text-sm font-medium">
              Shipment reference
              <Input
                value={draft.reference}
                maxLength={160}
                disabled={!!busy}
                onChange={(event) =>
                  edit((current) => ({
                    ...current,
                    reference: event.target.value,
                  }))
                }
              />
            </label>
            {draft.sections.map((section, sectionIndex) => (
              <details
                key={sectionIndex}
                open
                className="min-w-0 rounded-lg border p-4"
              >
                <summary className="cursor-pointer font-medium">
                  {section.title}
                </summary>
                <div className="mt-4 grid min-w-0 gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {section.fields.map((field, fieldIndex) => (
                      <label key={fieldIndex} className="grid gap-2 text-sm">
                        {field.label}
                        <Textarea
                          aria-label={field.label}
                          value={field.value}
                          maxLength={3000}
                          disabled={!!busy}
                          rows={2}
                          onChange={(event) =>
                            edit((current) => ({
                              ...current,
                              sections: current.sections.map((item, si) =>
                                si === sectionIndex
                                  ? {
                                      ...item,
                                      fields: item.fields.map((f, fi) =>
                                        fi === fieldIndex
                                          ? { ...f, value: event.target.value }
                                          : f
                                      ),
                                    }
                                  : item
                              ),
                            }))
                          }
                        />
                      </label>
                    ))}
                  </div>
                  {section.tables.map((table, tableIndex) => (
                    <div key={tableIndex} className="min-w-0">
                      {table.title ? (
                        <h4 className="mb-2 text-sm font-medium">
                          {table.title}
                        </h4>
                      ) : null}
                      <div className="overflow-x-auto rounded-md border">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-muted">
                            <tr>
                              {table.columns.map((column, i) => (
                                <th
                                  key={i}
                                  className="min-w-32 p-2 font-medium"
                                >
                                  {column}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {table.rows.map((row, rowIndex) => (
                              <tr key={rowIndex} className="border-t">
                                {table.columns.map((column, columnIndex) => (
                                  <td
                                    key={columnIndex}
                                    className="p-2 align-top"
                                  >
                                    <Textarea
                                      aria-label={`${table.title || section.title}, row ${rowIndex + 1}, ${column}`}
                                      value={row[columnIndex] ?? ""}
                                      maxLength={2000}
                                      rows={2}
                                      disabled={!!busy}
                                      onChange={(event) =>
                                        edit((current) => ({
                                          ...current,
                                          sections: current.sections.map(
                                            (item, si) =>
                                              si === sectionIndex
                                                ? {
                                                    ...item,
                                                    tables: item.tables.map(
                                                      (t, ti) =>
                                                        ti === tableIndex
                                                          ? {
                                                              ...t,
                                                              rows: t.rows.map(
                                                                (r, ri) =>
                                                                  ri ===
                                                                  rowIndex
                                                                    ? t.columns.map(
                                                                        (
                                                                          _,
                                                                          ci
                                                                        ) =>
                                                                          ci ===
                                                                          columnIndex
                                                                            ? event
                                                                                .target
                                                                                .value
                                                                            : (r[
                                                                                ci
                                                                              ] ??
                                                                              "")
                                                                      )
                                                                    : r
                                                              ),
                                                            }
                                                          : t
                                                    ),
                                                  }
                                                : item
                                          ),
                                        }))
                                      }
                                    />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ))}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!!busy}
                onClick={extract}
              >
                Read screenshots again
              </Button>
              <Button type="button" disabled={!!busy} onClick={generate}>
                Create draft PDF
              </Button>
            </div>
          </div>
        )}
        {pdfUrl ? (
          <div className="grid gap-3 rounded-xl border bg-muted/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-medium">Your draft certificate is ready</p>
              <a
                className={buttonVariants()}
                href={pdfUrl}
                download={downloadName}
              >
                <DownloadIcon />
                Download draft PDF
              </a>
            </div>
            <p className="text-sm text-muted-foreground">
              Draft for customer review. This is not an issued or validated SGS
              certificate.
            </p>
            {canPreviewPdf ? (
              <iframe
                src={pdfUrl}
                title="Draft certificate PDF preview"
                className="h-[42rem] w-full rounded-md border bg-white"
              />
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
