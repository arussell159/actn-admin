"use client"

import * as React from "react"
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronsUpDownIcon,
  MinusIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
} from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import {
  quoteItemCatalog,
  type QuoteCatalogItem,
} from "@/lib/quote-items-catalog"
import {
  listQuoteItems,
  syncQuoteItemCatalog,
  type QuoteLineItem,
} from "@/lib/quote-items-db"

const currency = "USD"
const defaultZone = "ROW"
const zones = ["ROW", "Zone EA"]
const selectableSortingFields = ["Container", "Bulk", "Roro"]
const catalogVersionKey = "quote-item-catalog-v1"
const antaserOutOfTerritoryCountries = new Set([
  "burundi",
  "centralafricanrepublic",
  "equatorialguinea",
  "guineabissau",
  "niger",
  "southsudan",
  "togo",
])

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value)
}

function itemPrice(item: QuoteCatalogItem) {
  return item.basePrice
}

function normalizedSortingField(item: QuoteCatalogItem) {
  return item.sortingField.toLowerCase()
}

function normalizeCatalogKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "")
}

function isFeeItem(item: QuoteCatalogItem) {
  return normalizedSortingField(item) === "fee"
}

function isOptionalItem(item: QuoteCatalogItem) {
  return normalizedSortingField(item).includes("optional")
}

function isAntaserOutOfTerritoryFee(item: QuoteCatalogItem) {
  const sortingField = normalizeCatalogKey(item.sortingField)

  return (
    normalizeCatalogKey(item.name) === "outofterritoryfee" &&
    (sortingField === "optionalfee" || sortingField === "optionalfield")
  )
}

function isAntaserOutOfTerritoryCountry(countryName: string) {
  return antaserOutOfTerritoryCountries.has(normalizeCatalogKey(countryName))
}

function quoteItemAppliesToSelection(
  item: QuoteCatalogItem,
  countryName: string,
  zone: string
) {
  if (item.countryName === countryName && item.zone === zone) {
    return true
  }

  return (
    isAntaserOutOfTerritoryFee(item) &&
    isAntaserOutOfTerritoryCountry(countryName)
  )
}

function isSelectedSortingItem(item: QuoteCatalogItem, sortingField: string) {
  return normalizedSortingField(item) === sortingField.toLowerCase()
}

function sortQuoteItems(items: QuoteCatalogItem[], sortingField: string) {
  return [...items].sort((a, b) => {
    const aRank = isFeeItem(a)
      ? 0
      : isOptionalItem(a)
        ? 1
        : isSelectedSortingItem(a, sortingField)
          ? 2
          : 3
    const bRank = isFeeItem(b)
      ? 0
      : isOptionalItem(b)
        ? 1
        : isSelectedSortingItem(b, sortingField)
          ? 2
          : 3
    const rankDelta = aRank - bRank

    if (rankDelta) {
      return rankDelta
    }

    return a.name.localeCompare(b.name)
  })
}

function getCountries(items: QuoteCatalogItem[]) {
  return Array.from(
    new Set(
      items
        .filter((item) => item.zone === defaultZone)
        .map((item) => item.countryName)
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b))
}

function CountrySearchField({
  autoOpenOnDesktop = false,
  countries,
  focusSignal = 0,
  value,
  onChange,
}: {
  autoOpenOnDesktop?: boolean
  countries: string[]
  focusSignal?: number
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [activeIndex, setActiveIndex] = React.useState(0)
  const searchInputRef = React.useRef<HTMLInputElement | null>(null)
  const filteredCountries = countries.filter((country) =>
    country.toLowerCase().includes(query.trim().toLowerCase())
  )

  function selectCountry(country: string) {
    onChange(country)
    setOpen(false)
    setQuery("")
  }

  React.useEffect(() => {
    if (!autoOpenOnDesktop) {
      return
    }

    const mql = window.matchMedia("(min-width: 768px)")

    if (mql.matches) {
      setOpen(true)
    }
  }, [autoOpenOnDesktop])

  React.useEffect(() => {
    if (!open) {
      return
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus()
    })

    return () => window.cancelAnimationFrame(animationFrameId)
  }, [open])

  React.useEffect(() => {
    if (!focusSignal) {
      return
    }

    const mql = window.matchMedia("(min-width: 768px)")

    if (mql.matches) {
      setOpen(true)
      setQuery("")
      setActiveIndex(0)
    }
  }, [focusSignal])

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        setActiveIndex(0)
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className="w-full cursor-pointer justify-between"
          />
        }
      >
        <span className="truncate">{value || "Choose country"}</span>
        <ChevronsUpDownIcon />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[calc(100vw-2rem)] max-w-80 gap-2 p-2"
      >
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault()
                setActiveIndex((index) =>
                  Math.min(index + 1, filteredCountries.length - 1)
                )
              }

              if (event.key === "ArrowUp") {
                event.preventDefault()
                setActiveIndex((index) => Math.max(index - 1, 0))
              }

              if (event.key === "Enter") {
                event.preventDefault()
                const country = filteredCountries[activeIndex]

                if (country) {
                  selectCountry(country)
                }
              }
            }}
            placeholder="Search countries"
            className="pl-9"
          />
        </div>
        <div className="max-h-64 overflow-y-auto">
          {filteredCountries.map((country, index) => (
            <Button
              key={country}
              variant="ghost"
              className="w-full justify-start data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
              data-active={index === activeIndex}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectCountry(country)}
            >
              <CheckIcon className={value === country ? undefined : "opacity-0"} />
              <span className="truncate">{country}</span>
            </Button>
          ))}
          {filteredCountries.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No countries found.
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function QuantityControl({
  itemName,
  quantity,
  onChange,
}: {
  itemName: string
  quantity: number
  onChange: (quantity: number) => void
}) {
  return (
    <div className="grid w-32 grid-cols-[2.5rem_1fr_2.5rem] items-center rounded-2xl border bg-background md:w-28 md:grid-cols-[2rem_1fr_2rem]">
      <Button
        size="icon"
        variant="ghost"
        aria-label={`Subtract one ${itemName}`}
        disabled={quantity === 0}
        onClick={() => onChange(quantity - 1)}
      >
        <MinusIcon />
      </Button>
      <span className="text-center font-medium">{quantity}</span>
      <Button
        size="icon"
        variant="ghost"
        aria-label={`Add one ${itemName}`}
        onClick={() => onChange(quantity + 1)}
      >
        <PlusIcon />
      </Button>
    </div>
  )
}

function QuoteSectionToggle({
  title,
  count,
  open,
  onToggle,
}: {
  title: string
  count: number
  open: boolean
  onToggle: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      className="h-10 w-full justify-between rounded-lg px-3 font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      onClick={onToggle}
    >
      <span>
        {title}
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          {count}
        </span>
      </span>
      <ChevronDownIcon
        className={`transition-transform ${open ? "rotate-180" : ""}`}
      />
    </Button>
  )
}

export function QuoteToolView() {
  const [catalog, setCatalog] =
    React.useState<QuoteCatalogItem[]>(quoteItemCatalog)
  const countries = React.useMemo(() => getCountries(catalog), [catalog])
  const [countryName, setCountryName] = React.useState(
    () => getCountries(quoteItemCatalog)[0] ?? ""
  )
  const [zone, setZone] = React.useState(defaultZone)
  const [sortingField, setSortingField] = React.useState("Container")
  const [quantities, setQuantities] = React.useState<Record<string, number>>({})
  const [openItemSections, setOpenItemSections] = React.useState({
    fees: false,
  })
  const [countrySearchFocusSignal, setCountrySearchFocusSignal] =
    React.useState(0)
  const [shouldFocusFirstPrimaryItem, setShouldFocusFirstPrimaryItem] =
    React.useState(false)
  const desktopItemRefs = React.useRef<Record<string, HTMLTableRowElement | null>>(
    {}
  )
  const showBulkUnits = sortingField === "Bulk"

  const filteredItems = React.useMemo(
    () =>
      sortQuoteItems(
        catalog.filter(
          (item) =>
            quoteItemAppliesToSelection(item, countryName, zone) &&
            (isFeeItem(item) ||
              isOptionalItem(item) ||
              isSelectedSortingItem(item, sortingField))
        ),
        sortingField
      ),
    [catalog, countryName, sortingField, zone]
  )

  const primaryItems = React.useMemo(
    () =>
      filteredItems.filter(
        (item) => !isFeeItem(item) && !isOptionalItem(item)
      ),
    [filteredItems]
  )
  const feeItems = React.useMemo(
    () =>
      filteredItems.filter(
        (item) => isFeeItem(item) || isOptionalItem(item)
      ),
    [filteredItems]
  )
  const itemSections = [
    {
      id: "fees",
      title: "Fees",
      items: feeItems,
      open: openItemSections.fees,
    },
  ] as const
  const desktopFocusableItems = React.useMemo(
    () => [
      ...(openItemSections.fees ? feeItems : []),
      ...primaryItems,
    ],
    [feeItems, openItemSections.fees, primaryItems]
  )

  const quoteItems = React.useMemo<QuoteLineItem[]>(
    () =>
      filteredItems
        .map((item) => {
          const quantity = quantities[item.internalId] ?? (isFeeItem(item) ? 1 : 0)
          const unitPrice = itemPrice(item)

          return {
            ...item,
            quantity,
            unitPrice,
            lineTotal: quantity * unitPrice,
          }
        })
        .filter((item) => item.quantity > 0),
    [filteredItems, quantities]
  )

  const subtotal = quoteItems.reduce((total, item) => total + item.lineTotal, 0)

  React.useEffect(() => {
    function loadCatalog() {
      listQuoteItems()
        .then((items) => {
          if (items.length) {
            setCatalog(items)
            const nextCountries = getCountries(items)
            setCountryName((currentCountry) =>
              nextCountries.includes(currentCountry)
                ? currentCountry
                : (nextCountries[0] ?? "")
            )
            return
          }

          if (window.localStorage.getItem(catalogVersionKey) !== "synced") {
            syncQuoteItemCatalog(quoteItemCatalog).then(() => {
              window.localStorage.setItem(catalogVersionKey, "synced")
            })
          }
        })
        .catch(() => {})
    }

    loadCatalog()
    window.addEventListener("quote-items:updated", loadCatalog)

    return () => window.removeEventListener("quote-items:updated", loadCatalog)
  }, [])

  React.useEffect(() => {
    if (!shouldFocusFirstPrimaryItem || !primaryItems.length) {
      return
    }

    const mql = window.matchMedia("(min-width: 768px)")

    if (!mql.matches) {
      setShouldFocusFirstPrimaryItem(false)
      return
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      desktopItemRefs.current[primaryItems[0]?.internalId ?? ""]?.focus()
      setShouldFocusFirstPrimaryItem(false)
    })

    return () => window.cancelAnimationFrame(animationFrameId)
  }, [primaryItems, shouldFocusFirstPrimaryItem])

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "k" || (!event.ctrlKey && !event.metaKey)) {
        return
      }

      const mql = window.matchMedia("(min-width: 768px)")

      if (!mql.matches) {
        return
      }

      event.preventDefault()
      setCountrySearchFocusSignal((signal) => signal + 1)
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  function updateQuantity(internalId: string, nextQuantity: number) {
    setQuantities((currentQuantities) => ({
      ...currentQuantities,
      [internalId]: Math.max(nextQuantity, 0),
    }))
  }

  function resetQuote() {
    setCountryName("")
    setZone(defaultZone)
    setSortingField("Container")
    setQuantities({})
    setOpenItemSections({
      fees: false,
    })
  }

  function toggleItemSection(sectionId: keyof typeof openItemSections) {
    setOpenItemSections((currentSections) => ({
      ...currentSections,
      [sectionId]: !currentSections[sectionId],
    }))
  }

  function handleDesktopItemKeyDown(
    event: React.KeyboardEvent<HTMLTableRowElement>,
    item: QuoteCatalogItem
  ) {
    if (event.target !== event.currentTarget) {
      return
    }

    if (event.key === "Tab") {
      const index = desktopFocusableItems.findIndex(
        (focusableItem) => focusableItem.internalId === item.internalId
      )
      const nextIndex = event.shiftKey ? index - 1 : index + 1
      const nextItem = desktopFocusableItems[nextIndex]

      if (!nextItem) {
        return
      }

      event.preventDefault()
      desktopItemRefs.current[nextItem.internalId]?.focus()
      return
    }

    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
      return
    }

    event.preventDefault()
    const quantity = quantities[item.internalId] ?? (isFeeItem(item) ? 1 : 0)
    const delta = event.key === "ArrowRight" ? 1 : -1

    updateQuantity(item.internalId, quantity + delta)
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
        <SiteHeader title="Quote Tool" />
        <main className="flex flex-1 flex-col gap-4 p-4 [--mobile-page-bottom-padding:calc(10rem+env(safe-area-inset-bottom,0px))] lg:p-6">
          <Card className="rounded-lg shadow-sm">
            <CardContent className="relative">
              <div className="grid gap-3 md:hidden">
                <Field>
                  <div className="flex items-center justify-between gap-3">
                    <FieldLabel>Country</FieldLabel>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-1.5 text-muted-foreground hover:text-foreground"
                      onClick={resetQuote}
                    >
                      <RotateCcwIcon />
                      Reset
                    </Button>
                  </div>
                  <CountrySearchField
                    countries={countries}
                    value={countryName}
                    onChange={(value) => {
                      if (value) {
                        setCountryName(value)
                        setQuantities({})
                      }
                    }}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field>
                    <FieldLabel>Zone</FieldLabel>
                    <Select
                      value={zone}
                      onValueChange={(value) => {
                        if (value) {
                          setZone(value)
                          setQuantities({})
                        }
                      }}
                    >
                      <SelectTrigger className="h-11 w-full rounded-xl px-3 text-base">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {zones.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>Type</FieldLabel>
                    <Select
                      value={sortingField}
                      onValueChange={(value) => {
                        if (value) {
                          setSortingField(value)
                          setQuantities({})
                        }
                      }}
                    >
                      <SelectTrigger className="h-11 w-full rounded-xl px-3 text-base">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {selectableSortingFields.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </div>
              <FieldGroup className="hidden gap-4 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                <Field>
                  <FieldLabel>Country</FieldLabel>
                  <CountrySearchField
                    autoOpenOnDesktop
                    countries={countries}
                    focusSignal={countrySearchFocusSignal}
                    value={countryName}
                    onChange={(value) => {
                      if (value) {
                        setCountryName(value)
                        setQuantities({})
                        setShouldFocusFirstPrimaryItem(true)
                      }
                    }}
                  />
                </Field>
                <Field>
                  <FieldLabel>Zone</FieldLabel>
                  <Select
                    value={zone}
                    onValueChange={(value) => {
                      if (value) {
                        setZone(value)
                        setQuantities({})
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {zones.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Sorting Field</FieldLabel>
                  <Select
                    value={sortingField}
                    onValueChange={(value) => {
                      if (value) {
                        setSortingField(value)
                        setQuantities({})
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {selectableSortingFields.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field className="justify-end">
                  <FieldLabel className="sr-only">Reset Quote</FieldLabel>
                  <Button
                    variant="ghost"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={resetQuote}
                  >
                    <RotateCcwIcon />
                    Reset
                  </Button>
                </Field>
              </FieldGroup>
              <div className="mt-6 hidden overflow-x-auto rounded-lg border md:block">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr className="border-b">
                      <th className="px-3 py-2 text-left font-medium">Item</th>
                      {showBulkUnits ? (
                        <th className="w-32 px-3 py-2 text-left font-medium">
                          Bulk Units
                        </th>
                      ) : null}
                      <th className="w-32 px-3 py-2 text-right font-medium">
                        Unit Price
                      </th>
                      <th className="w-36 px-3 py-2 text-center font-medium">
                        Quantity
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemSections.map((section) =>
                      section.items.length ? (
                        <React.Fragment key={section.id}>
                          <tr className="border-b bg-muted/30">
                            <td
                              colSpan={showBulkUnits ? 4 : 3}
                              className="p-1"
                            >
                              <QuoteSectionToggle
                                title={section.title}
                                count={section.items.length}
                                open={section.open}
                                onToggle={() => toggleItemSection(section.id)}
                              />
                            </td>
                          </tr>
                          {section.open
                            ? section.items.map((item) => {
                                const quantity =
                                  quantities[item.internalId] ??
                                  (isFeeItem(item) ? 1 : 0)
                                const unitPrice = itemPrice(item)

                                return (
                                  <tr
                                    key={item.internalId}
                                    ref={(node) => {
                                      desktopItemRefs.current[item.internalId] =
                                        node
                                    }}
                                    tabIndex={0}
                                    aria-label={`${item.name}, quantity ${quantity}`}
                                    className="border-b border-l-2 border-l-sky-400 outline-none transition-colors last:border-b-0 focus-visible:bg-accent/60 dark:border-l-sky-500"
                                    onKeyDown={(event) =>
                                      handleDesktopItemKeyDown(event, item)
                                    }
                                  >
                                    <td className="px-3 py-3 align-top">
                                      <div className="font-medium">
                                        {item.name}
                                      </div>
                                    </td>
                                    {showBulkUnits ? (
                                      <td className="px-3 py-3 align-top text-muted-foreground">
                                        {item.bulkUnits || "-"}
                                      </td>
                                    ) : null}
                                    <td className="px-3 py-3 text-right align-top font-medium">
                                      {formatMoney(unitPrice)}
                                    </td>
                                    <td className="px-3 py-3 align-top">
                                      <div className="flex justify-center">
                                        <QuantityControl
                                          itemName={item.name}
                                          quantity={quantity}
                                          onChange={(nextQuantity) =>
                                            updateQuantity(
                                              item.internalId,
                                              nextQuantity
                                            )
                                          }
                                        />
                                      </div>
                                    </td>
                                  </tr>
                                )
                              })
                            : null}
                        </React.Fragment>
                      ) : null
                    )}
                    {primaryItems.map((item) => {
                      const quantity =
                        quantities[item.internalId] ?? (isFeeItem(item) ? 1 : 0)
                      const unitPrice = itemPrice(item)

                      return (
                        <tr
                          key={item.internalId}
                          ref={(node) => {
                            desktopItemRefs.current[item.internalId] = node
                          }}
                          tabIndex={0}
                          aria-label={`${item.name}, quantity ${quantity}`}
                          className="border-b outline-none transition-colors last:border-0 focus-visible:bg-accent/60"
                          onKeyDown={(event) =>
                            handleDesktopItemKeyDown(event, item)
                          }
                        >
                          <td className="px-3 py-3 align-top">
                            <div className="font-medium">{item.name}</div>
                          </td>
                          {showBulkUnits ? (
                            <td className="px-3 py-3 align-top text-muted-foreground">
                              {item.bulkUnits || "-"}
                            </td>
                          ) : null}
                          <td className="px-3 py-3 text-right align-top font-medium">
                            {formatMoney(unitPrice)}
                          </td>
                          <td className="px-3 py-3 align-top">
                            <div className="flex justify-center">
                              <QuantityControl
                                itemName={item.name}
                                quantity={quantity}
                                onChange={(nextQuantity) =>
                                  updateQuantity(item.internalId, nextQuantity)
                                }
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 hidden justify-end border-t pt-4 md:flex">
                <div className="flex min-w-56 justify-between gap-8 text-base font-semibold">
                  <span>Total</span>
                  <span>{formatMoney(subtotal)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-3 md:hidden">
            {itemSections.map((section) =>
              section.items.length ? (
                <div key={section.id} className="grid gap-3">
                  <QuoteSectionToggle
                    title={section.title}
                    count={section.items.length}
                    open={section.open}
                    onToggle={() => toggleItemSection(section.id)}
                  />
                  {section.open ? (
                    <div className="grid gap-3">
                      {section.items.map((item) => {
                        const quantity =
                          quantities[item.internalId] ??
                          (isFeeItem(item) ? 1 : 0)
                        const unitPrice = itemPrice(item)

                        return (
                          <div
                            key={item.internalId}
                            className="grid gap-3 rounded-lg border border-sky-300 bg-background p-3 dark:border-sky-800"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-medium leading-snug">
                                  {item.name}
                                </div>
                              </div>
                              <div className="shrink-0 text-right font-medium">
                                {formatMoney(unitPrice)}
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              {showBulkUnits ? (
                                <div className="text-sm text-muted-foreground">
                                  <span className="font-medium text-foreground">
                                    Bulk Units:
                                  </span>{" "}
                                  {item.bulkUnits || "-"}
                                </div>
                              ) : (
                                <div />
                              )}
                              <QuantityControl
                                itemName={item.name}
                                quantity={quantity}
                                onChange={(nextQuantity) =>
                                  updateQuantity(item.internalId, nextQuantity)
                                }
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null
            )}
            {primaryItems.map((item) => {
              const quantity =
                quantities[item.internalId] ?? (isFeeItem(item) ? 1 : 0)
              const unitPrice = itemPrice(item)

              return (
                <div
                  key={item.internalId}
                  className="grid gap-3 rounded-lg border bg-background p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium leading-snug">
                        {item.name}
                      </div>
                    </div>
                    <div className="shrink-0 text-right font-medium">
                      {formatMoney(unitPrice)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    {showBulkUnits ? (
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">
                          Bulk Units:
                        </span>{" "}
                        {item.bulkUnits || "-"}
                      </div>
                    ) : (
                      <div />
                    )}
                    <QuantityControl
                      itemName={item.name}
                      quantity={quantity}
                      onChange={(nextQuantity) =>
                        updateQuantity(item.internalId, nextQuantity)
                      }
                    />
                  </div>
                </div>
              )
            })}
            <div className="flex justify-end border-t pt-4">
              <div className="flex min-w-56 justify-between gap-8 text-base font-semibold">
                <span>Total</span>
                <span>{formatMoney(subtotal)}</span>
              </div>
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
