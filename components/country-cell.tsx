"use client"

import Image from "next/image"
import * as React from "react"
import { AppLink } from "@/components/app-link"

import { cn } from "@/lib/utils"

const countryCodes: Record<string, string> = {
  Angola: "ao",
  Benin: "bj",
  "Burkina Faso": "bf",
  Burundi: "bi",
  Cameroon: "cm",
  "Central African Republic": "cf",
  Chad: "td",
  Djibouti: "dj",
  "DR Congo": "cd",
  Egypt: "eg",
  "Equatorial Guinea": "gq",
  Gabon: "ga",
  "Guinea Bissau": "gw",
  "Ivory Coast": "ci",
  Liberia: "lr",
  Madagascar: "mg",
  Kenya: "ke",
  Mali: "ml",
  Niger: "ne",
  "Republic of Congo": "cg",
  "Republic of Guinea": "gn",
  Senegal: "sn",
  "Sierra Leone": "sl",
  Somalia: "so",
  "South Sudan": "ss",
  Sudan: "sd",
  Togo: "tg",
  Yemen: "ye",
}

const normalizedCountryName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")

let flagCdnCountryCodes: Promise<Record<string, string>> | undefined

function loadFlagCdnCountryCodes() {
  flagCdnCountryCodes ??= fetch("https://flagcdn.com/en/codes.json")
    .then((response) => {
      if (!response.ok) throw new Error("Could not load country flags.")
      return response.json() as Promise<Record<string, string>>
    })
    .then((codes) =>
      Object.fromEntries(
        Object.entries(codes).map(([code, name]) => [
          normalizedCountryName(name),
          code,
        ])
      )
    )
  return flagCdnCountryCodes
}

function useCountryCode(country: string) {
  const knownCode = countryCodes[country]
  const [countryCode, setCountryCode] = React.useState(knownCode)
  React.useEffect(() => {
    setCountryCode(knownCode)
    if (knownCode || !country.trim()) return
    let active = true
    void loadFlagCdnCountryCodes()
      .then((codes) => {
        if (active) setCountryCode(codes[normalizedCountryName(country)])
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [country, knownCode])
  return countryCode
}

export function CountryFlag({
  country,
  className,
}: {
  country: string
  className?: string
}) {
  const countryCode = useCountryCode(country)
  return countryCode ? (
    <Image
      src={`https://flagcdn.com/${countryCode}.svg`}
      width={24}
      height={18}
      alt={`${country} flag`}
      className={cn(
        "h-[18px] w-6 shrink-0 rounded-[2px] border border-black/15 object-cover shadow-xs",
        className
      )}
      loading="lazy"
      unoptimized
    />
  ) : (
    <span
      aria-hidden="true"
      className={cn(
        "block h-[18px] w-6 shrink-0 rounded-[2px] border border-black/15 bg-muted shadow-xs",
        className
      )}
    />
  )
}

export function CountryCell({
  country,
  className,
}: {
  country: string
  className?: string
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <CountryFlag country={country} className="h-3.5 w-5 rounded-[1px]" />
      <span className="min-w-0 truncate text-blue-950" title={country}>
        {country}
      </span>
    </div>
  )
}

export function ClientCell({
  client,
  className,
}: {
  client: string
  className?: string
}) {
  return (
    <AppLink
      href={`/customers/${encodeURIComponent(client)}`}
      className={cn(
        "block min-w-0 truncate text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-1 focus-visible:ring-ring/40 focus-visible:outline-none",
        className
      )}
      title={client}
    >
      {client}
    </AppLink>
  )
}
