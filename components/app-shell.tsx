"use client"

import * as React from "react"

import { CreateMonthEndView } from "@/components/create-month-end-view"
import { DashboardView } from "@/components/dashboard-view"
import MonthEndPage from "@/components/month-end-view"
import { PricingUploadView } from "@/components/pricing-upload-view"
import { PreviousMonthEndsView } from "@/components/previous-month-ends-view"
import { QuoteToolView } from "@/components/quote-tool-view"
import { TemplateEditorView } from "@/components/template-editor-view"

type AppRoute =
  | "/"
  | "/dashboard"
  | "/month-end"
  | "/month-end/new"
  | "/pricing-upload"
  | "/previous-month-ends"
  | "/quote-tool"
  | "/template-builder"

function normalizeRoute(route: string): AppRoute {
  const cleanRoute = route.replace(/^#/, "").split(/[?#]/)[0] || "/"

  switch (cleanRoute) {
    case "/month-end":
    case "/dashboard":
    case "/month-end/new":
    case "/pricing-upload":
    case "/previous-month-ends":
    case "/quote-tool":
    case "/template-builder":
      return cleanRoute
    default:
      return "/dashboard"
  }
}

function getCurrentRoute() {
  if (typeof window === "undefined") return "/dashboard" as AppRoute
  return normalizeRoute(window.location.hash.slice(1))
}

export function AppShell() {
  const [route, setRoute] = React.useState<AppRoute>("/dashboard")

  React.useEffect(() => {
    const syncRoute = () => setRoute(getCurrentRoute())

    syncRoute()
    window.addEventListener("hashchange", syncRoute)
    window.addEventListener("app:navigate", syncRoute)

    return () => {
      window.removeEventListener("hashchange", syncRoute)
      window.removeEventListener("app:navigate", syncRoute)
    }
  }, [])

  switch (route) {
    case "/dashboard":
      return <DashboardView />
    case "/template-builder":
      return <TemplateEditorView />
    case "/month-end/new":
      return <CreateMonthEndView />
    case "/pricing-upload":
      return <PricingUploadView />
    case "/previous-month-ends":
      return <PreviousMonthEndsView />
    case "/quote-tool":
      return <QuoteToolView />
    case "/month-end":
    case "/":
    default:
      return <MonthEndPage />
  }
}
