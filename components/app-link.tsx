"use client"

import * as React from "react"
import Link from "next/link"

type AppLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string
}

let navigationLockUntil = 0

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
        onClick={(event) => {
          const isPlainPrimaryClick =
            event.button === 0 &&
            !event.metaKey &&
            !event.ctrlKey &&
            !event.shiftKey &&
            !event.altKey

          if (isPlainPrimaryClick) {
            const now = window.performance.now()

            if (now < navigationLockUntil) {
              event.preventDefault()
              return
            }

            navigationLockUntil = now + 650
          }

          onClick?.(event)

          if (event.defaultPrevented) {
            navigationLockUntil = 0
            return
          }

          window.setTimeout(() => {
            window.dispatchEvent(new Event("information-notes:navigation"))
          }, 0)
        }}
      />
    )
  }
)
