import Image from "next/image"
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
}

export function CountryCell({
  country,
  className,
}: {
  country: string
  className?: string
}) {
  const countryCode = countryCodes[country]

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      {countryCode ? (
        <Image
          src={`https://flagcdn.com/${countryCode}.svg`}
          width={20}
          height={15}
          alt=""
          aria-hidden="true"
          className="h-3.5 w-5 shrink-0 rounded-[1px] border border-black/15 object-cover shadow-xs"
          loading="lazy"
          unoptimized
        />
      ) : (
        <span
          aria-hidden="true"
          className="block h-3.5 w-5 shrink-0 rounded-[1px] border border-black/15 bg-muted shadow-xs"
        />
      )}
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
        "block min-w-0 truncate text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40",
        className
      )}
      title={client}
    >
      {client}
    </AppLink>
  )
}
