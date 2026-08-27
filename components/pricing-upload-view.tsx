"use client"

import * as React from "react"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  FileSpreadsheetIcon,
  UploadIcon,
} from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import type { QuoteCatalogItem } from "@/lib/quote-items-catalog"
import { replaceQuoteItemCatalog } from "@/lib/quote-items-db"
import { parseQuotePricingCsv } from "@/lib/quote-pricing-import"

function countCountries(items: QuoteCatalogItem[]) {
  return new Set(items.map((item) => item.countryName)).size
}

export function PricingUploadView() {
  const [fileName, setFileName] = React.useState("")
  const [items, setItems] = React.useState<QuoteCatalogItem[]>([])
  const [status, setStatus] = React.useState("")
  const [error, setError] = React.useState("")
  const [isDragging, setIsDragging] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  async function loadFile(file: File) {
    setFileName(file.name)
    setStatus("")
    setError("")

    try {
      const text = await file.text()
      const parsedItems = parseQuotePricingCsv(text)

      if (!parsedItems.length) {
        throw new Error("No valid pricing items found.")
      }

      setItems(parsedItems)
      setStatus("Pricing sheet parsed and ready to upload.")
    } catch (caughtError) {
      setItems([])
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not parse pricing sheet."
      )
    }
  }

  async function uploadPricing() {
    setIsUploading(true)
    setStatus("Updating pricing database...")
    setError("")

    try {
      await replaceQuoteItemCatalog(items)
      window.dispatchEvent(new Event("quote-items:updated"))
      setStatus("Pricing database updated.")
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not update pricing database."
      )
      setStatus("")
    } finally {
      setIsUploading(false)
    }
  }

  function handleDroppedFiles(files: FileList | null) {
    const file = files?.[0]

    if (file) {
      loadFile(file)
    }
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <main className="flex min-h-svh flex-col bg-background md:min-h-[calc(100svh-1rem)]">
          <SiteHeader title="Pricing Upload" />
          <div className="grid gap-4 px-4 py-4 lg:px-6">
            <section>
              <h1 className="text-2xl font-semibold">Pricing Upload</h1>
            </section>
            <Card className="rounded-lg shadow-sm">
            <CardHeader>
              <CardTitle>Pricing Sheet</CardTitle>
              <CardDescription>
                Upload a CSV pricing sheet to replace the quote item catalog.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div
                role="button"
                tabIndex={0}
                data-dragging={isDragging}
                className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-background p-6 text-center transition-colors hover:bg-muted/50 data-[dragging=true]:border-primary data-[dragging=true]:bg-primary/5"
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    fileInputRef.current?.click()
                  }
                }}
                onDragEnter={(event) => {
                  event.preventDefault()
                  setIsDragging(true)
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  setIsDragging(true)
                }}
                onDragLeave={(event) => {
                  event.preventDefault()
                  setIsDragging(false)
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  setIsDragging(false)
                  handleDroppedFiles(event.dataTransfer.files)
                }}
              >
                <UploadIcon className="size-6 text-muted-foreground" />
                <span className="font-medium">
                  Drag and drop the pricing CSV
                </span>
                <span className="text-sm text-muted-foreground">
                  {fileName || "or click to choose a file"}
                </span>
                <Input
                  ref={fileInputRef}
                  className="sr-only"
                  id="pricing-file"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => handleDroppedFiles(event.target.files)}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  disabled={!items.length || isUploading}
                  onClick={uploadPricing}
                >
                  <FileSpreadsheetIcon />
                  Upload Pricing
                </Button>
              </div>

              {items.length ? (
                <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm md:grid-cols-3">
                  <div>
                    <div className="text-muted-foreground">File</div>
                    <div className="font-medium">{fileName}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Items</div>
                    <div className="font-medium">{items.length}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Countries</div>
                    <div className="font-medium">{countCountries(items)}</div>
                  </div>
                </div>
              ) : null}

              {status ? (
                <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
                  <CheckCircle2Icon className="size-4 text-primary" />
                  {status}
                </div>
              ) : null}

              {error ? (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertCircleIcon className="size-4" />
                  {error}
                </div>
              ) : null}
            </CardContent>
          </Card>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
