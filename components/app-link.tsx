"use client"

import * as React from "react"
import Link from "next/link"

type AppLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string
}

function isExternalHref(href: string) {
  return (
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    /^https?:\/\//.test(href)
  )
}

function normalizeRoute(href: string) {
  if (!href || href === "/") return "/"
  return href.startsWith("/") ? href : `/${href}`
}

export const AppLink = React.forwardRef<HTMLAnchorElement, AppLinkProps>(
  function AppLink({ href, onClick, ...props }, ref) {
    const isExternal = isExternalHref(href)
    const route = normalizeRoute(href)

    if (isExternal) {
      return <a {...props} ref={ref} href={href} onClick={onClick} />
    }

    return (
      <Link
        {...props}
        ref={ref}
        href={route}
        scroll={false}
        onClick={(event) => {
          onClick?.(event)
        }}
        onNavigate={() => {
          window.dispatchEvent(new Event("app:navigation-start"))
          window.dispatchEvent(new Event("app:navigate"))
        }}
      />
    )
  }
)
