"use client"

import { authenticatedFetch } from "@/lib/client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeftIcon,
  CopyIcon,
  EyeIcon,
  MoreHorizontalIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { AppLink } from "@/components/app-link"
import { CertificateLayoutEditor } from "@/components/certificate-layout-editor"
import { CertificateCountrySetup } from "@/components/certificate-country-setup"
import { CountryCell } from "@/components/country-cell"
import { PageFrame } from "@/components/page-frame"
import { SearchPicker } from "@/components/search-picker"
import { SiteHeader, SiteHeaderBackButton } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  cacheDeletedLayout,
  useCertificateLayouts,
} from "@/lib/certificate-layout/client"
import {
  loadCertificateLayoutDraft,
  saveCertificateLayoutDraft,
} from "@/lib/certificate-layout/draft-client"
import { certificateLayoutsHref } from "@/lib/certificate-layout/routes"
import {
  countryKey,
  type CertificateLayoutRecord,
} from "@/lib/certificate-layout/schema"
import { okfApi } from "@/lib/okf/client"
import type { KnowledgeState } from "@/lib/okf/schema"

function formatUpdatedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Not available"
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

export function CertificateLayoutSettings() {
  const router = useRouter()
  const params = useSearchParams()
  const catalog = useCertificateLayouts()
  const [draftCountryName, setDraftCountryName] = useState("")
  const [newCountryReady, setNewCountryReady] = useState(false)
  const [newCountryLoading, setNewCountryLoading] = useState(false)
  const [copying, setCopying] = useState<CertificateLayoutRecord>()
  const [copyCountry, setCopyCountry] = useState("")
  const [confirmDeleteKey, setConfirmDeleteKey] = useState("")
  const [deletingKey, setDeletingKey] = useState("")
  const [knowledge, setKnowledge] = useState<{
    state: KnowledgeState
    canPublish: boolean
  }>()
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    void okfApi<{ state: KnowledgeState; canPublish: boolean }>("/api/okf")
      .then((data) => {
        if (active) setKnowledge(data)
      })
      .catch((error) => {
        if (active) setError(error.message)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (params.get("country") !== "new") return
    let active = true
    setNewCountryLoading(true)
    void loadCertificateLayoutDraft("new")
      .then((draft) => {
        if (!active) return
        setNewCountryReady(Boolean(draft))
        setDraftCountryName(draft?.layout.country ?? "")
      })
      .catch((error) => {
        if (active)
          setError(
            error instanceof Error
              ? error.message
              : "Could not load the shared country draft."
          )
      })
      .finally(() => {
        if (active) setNewCountryLoading(false)
      })
    return () => {
      active = false
    }
  }, [params])

  const key = params.get("country") || ""
  const record = catalog.rows.find((row) => row.country_key === key)
  const canPublish =
    !!knowledge?.canPublish && !error && !catalog.error && !catalog.loading

  function navigate(next: string, replace = false) {
    const href = certificateLayoutsHref(next || undefined)
    if (replace) router.replace(href)
    else router.push(href)
  }

  function startNewCountry() {
    setDraftCountryName("")
    setNewCountryReady(false)
    navigate("new")
  }

  async function createSharedNewDraft(
    layout: CertificateLayoutRecord["layout"]
  ) {
    setError("")
    const existing = await loadCertificateLayoutDraft("new")
    if (existing)
      throw new Error(
        "A shared new-country draft already exists. Open it before starting another."
      )
    await saveCertificateLayoutDraft({
      draftKey: "new",
      layout,
      baseRevision: 0,
      expectedEdit: 0,
    })
    setDraftCountryName(layout.country)
    setNewCountryReady(true)
  }

  async function createCountryCopy() {
    const name = copyCountry.trim()
    if (!copying || !name) return
    const layout = {
      ...structuredClone(copying.layout),
      country: name,
      aliases: [],
    }
    try {
      await createSharedNewDraft(layout)
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not save the shared country draft."
      )
      return
    }
    setCopying(undefined)
    setCopyCountry("")
    navigate("new")
  }

  async function deleteCountryLayout(row: CertificateLayoutRecord) {
    setDeletingKey(row.country_key)
    setError("")
    try {
      const response = await authenticatedFetch("/api/okf/layouts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryKey: row.country_key,
          expectedRevision: row.revision,
        }),
      })
      const result = await response.json()
      if (!response.ok || !result.ok)
        throw new Error(
          result.message || "Could not delete the country layout."
        )
      cacheDeletedLayout(row.country_key, row.revision)
      setConfirmDeleteKey("")
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not delete the country layout."
      )
    } finally {
      setDeletingKey("")
    }
  }

  if (!key || (!record && key !== "new")) {
    return (
      <PageFrame header={<SiteHeader title="Certificate Settings" />}>
        <div className="grid gap-4 px-4 py-4 lg:px-6">
          <section className="flex justify-end">
            <Button
              className="w-fit"
              size="lg"
              disabled={!canPublish}
              onClick={startNewCountry}
            >
              <PlusIcon />
              New Country
            </Button>
          </section>
          {error || catalog.error || (key && !catalog.loading) ? (
            <p role="alert" className="text-sm text-destructive">
              {error ||
                catalog.error ||
                (key && !catalog.loading
                  ? "That country layout could not be found."
                  : "")}
            </p>
          ) : null}
          <Table containerClassName="rounded-lg border bg-background">
            <TableHeader>
              <TableRow>
                <TableHead>Country</TableHead>
                <TableHead>Fields</TableHead>
                <TableHead>Revision</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {catalog.rows.map((row) => {
                const href = certificateLayoutsHref(row.country_key)
                return (
                  <TableRow key={row.country_key}>
                    <TableCell className="font-medium">
                      <AppLink href={href} className="block">
                        <CountryCell country={row.layout.country} />
                      </AppLink>
                    </TableCell>
                    <TableCell>
                      <AppLink href={href} className="block">
                        {row.layout.fields.length}
                      </AppLink>
                    </TableCell>
                    <TableCell>
                      <AppLink href={href} className="block">
                        {row.revision}
                      </AppLink>
                    </TableCell>
                    <TableCell>
                      <AppLink href={href} className="block">
                        {formatUpdatedAt(row.updated_at)}
                      </AppLink>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu
                        onOpenChange={(open) => {
                          if (!open && confirmDeleteKey === row.country_key)
                            setConfirmDeleteKey("")
                        }}
                      >
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Actions for ${row.layout.country}`}
                            />
                          }
                        >
                          <MoreHorizontalIcon />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-36">
                          <DropdownMenuItem
                            onClick={() => navigate(row.country_key)}
                          >
                            <EyeIcon />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!canPublish}
                            onClick={() => {
                              setCopying(row)
                              setCopyCountry("")
                            }}
                          >
                            <CopyIcon />
                            Copy
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {confirmDeleteKey === row.country_key ? (
                            <DropdownMenuItem
                              variant="destructive"
                              disabled={
                                !canPublish || deletingKey === row.country_key
                              }
                              onClick={() => void deleteCountryLayout(row)}
                            >
                              <Trash2Icon />
                              {deletingKey === row.country_key
                                ? "Deleting…"
                                : "Confirm Delete"}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              variant="destructive"
                              disabled={!canPublish}
                              closeOnClick={false}
                              onClick={() =>
                                setConfirmDeleteKey(row.country_key)
                              }
                            >
                              <Trash2Icon />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
              {!catalog.rows.length ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-muted-foreground"
                  >
                    {catalog.loading
                      ? "Loading country layouts…"
                      : "No country layouts yet."}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          <Dialog
            open={!!copying}
            onOpenChange={(open) => {
              if (!open) {
                setCopying(undefined)
                setCopyCountry("")
              }
            }}
          >
            <DialogContent>
              <form
                className="contents"
                onSubmit={(event) => {
                  event.preventDefault()
                  void createCountryCopy()
                }}
              >
                <DialogHeader>
                  <DialogTitle>Copy {copying?.layout.country}</DialogTitle>
                  <DialogDescription>
                    Pages, blocks, fields, and field placements will all be
                    copied to the new country.
                  </DialogDescription>
                </DialogHeader>
                <Input
                  aria-label="New country name"
                  placeholder="New country name"
                  value={copyCountry}
                  onChange={(event) => setCopyCountry(event.target.value)}
                  autoFocus
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCopying(undefined)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      !copyCountry.trim() ||
                      catalog.rows.some(
                        (row) =>
                          row.country_key === countryKey(copyCountry.trim())
                      )
                    }
                  >
                    Create country draft
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </PageFrame>
    )
  }

  if (key === "new" && newCountryLoading) {
    return (
      <PageFrame header={<SiteHeader title="New country" />}>
        <p className="px-4 py-5 text-sm text-muted-foreground lg:px-6">
          Loading shared draft…
        </p>
      </PageFrame>
    )
  }

  if (key === "new" && !newCountryReady) {
    return (
      <PageFrame
        header={
          <SiteHeader
            title={draftCountryName || "New country"}
            leadingContent={
              <Button
                variant="outline"
                className="w-[4.625rem]"
                render={<AppLink href={certificateLayoutsHref()} />}
              >
                <ArrowLeftIcon />
                Back
              </Button>
            }
            mobileLeadingContent={
              <SiteHeaderBackButton
                label="Back to certificate settings"
                href={certificateLayoutsHref()}
              />
            }
          />
        }
      >
        <div className="min-w-0 px-4 py-5 lg:px-6">
          <CertificateCountrySetup
            onCountryNameChange={setDraftCountryName}
            onGenerated={(layout) => {
              void createSharedNewDraft(layout).catch((error) =>
                setError(
                  error instanceof Error
                    ? error.message
                    : "Could not save the shared country draft."
                )
              )
            }}
          />
        </div>
      </PageFrame>
    )
  }

  const countryName =
    record?.layout.country || draftCountryName || "New country"
  const countryMenu = (
    <SearchPicker
      choices={catalog.rows.map((row) => ({
        id: row.country_key,
        label: row.layout.country,
      }))}
      label="Certificate layout country"
      placeholder="Choose a country"
      searchPlaceholder="Search country layouts"
      emptyLabel={
        catalog.loading
          ? "Loading country layouts…"
          : "No country layouts found."
      }
      value={key}
      displayValue={countryName}
      onValueChange={(value) => navigate(value)}
      variant="ghost"
      className="h-8 w-auto max-w-full gap-2 px-1 text-base font-medium"
      footerAction={{
        label: "Add new country layout",
        icon: <PlusIcon />,
        disabled: !canPublish,
        onSelect: startNewCountry,
      }}
    />
  )

  return (
    <PageFrame
      header={
        <SiteHeader
          title={countryName}
          titleContent={countryMenu}
          headingAs="div"
          leadingContent={
            <Button
              variant="outline"
              className="w-[4.625rem]"
              render={<AppLink href={certificateLayoutsHref()} />}
            >
              <ArrowLeftIcon />
              Back
            </Button>
          }
          mobileLeadingContent={
            <SiteHeaderBackButton
              label="Back to certificate settings"
              href={certificateLayoutsHref()}
            />
          }
        />
      }
    >
      <div className="min-w-0 px-4 py-4 lg:px-6">
        {error || catalog.error ? (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {error || catalog.error}
          </p>
        ) : null}
        <CertificateLayoutEditor
          key={key}
          record={record}
          canPublish={canPublish}
          onCountryNameChange={setDraftCountryName}
          mappedFieldIds={
            knowledge?.state.pages
              .filter(
                (page) =>
                  page.country === record?.layout.country && page.revision > 0
              )
              .flatMap((page) =>
                page.content.mappings.map((mapping) => mapping.systemFieldId)
              ) ?? []
          }
          onPublished={(row) => navigate(row.country_key, true)}
          onDuplicate={(layout) => {
            void createSharedNewDraft(layout)
              .then(() => navigate("new"))
              .catch((error) =>
                setError(
                  error instanceof Error
                    ? error.message
                    : "Could not save the shared country draft."
                )
              )
          }}
        />
      </div>
    </PageFrame>
  )
}
