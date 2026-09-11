import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import {
  isAuthBypassPath,
  isLocalhostRequest,
  loginPath,
  updateSession,
} from "@/lib/auth"

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (
    process.env.NODE_ENV === "development" &&
    isLocalhostRequest(request.nextUrl.hostname)
  ) {
    return NextResponse.next()
  }

  let sessionResult: Awaited<ReturnType<typeof updateSession>>

  try {
    sessionResult = await updateSession(request)
  } catch (error) {
    console.warn("[ACTN auth] Server session validation failed", {
      message: error instanceof Error ? error.message : String(error),
      pathname,
    })
    if (pathname.startsWith("/api/"))
      return NextResponse.json(
        {
          ok: false,
          message:
            "The sign-in service is temporarily unavailable. Please try again.",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      )
    if (isAuthBypassPath(pathname)) return NextResponse.next()

    const loginUrl = new URL(loginPath, request.url)
    loginUrl.searchParams.set("error", "session_unavailable")
    loginUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`
    )
    return NextResponse.redirect(loginUrl)
  }

  const { response, user } = sessionResult

  if (pathname === loginPath && user) {
    return NextResponse.redirect(new URL("/month-end", request.url))
  }

  if (!user && !isAuthBypassPath(pathname)) {
    if (pathname.startsWith("/api/"))
      return NextResponse.json(
        { ok: false, message: "Sign in with your staff account to continue." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      )
    const loginUrl = new URL(loginPath, request.url)
    loginUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`
    )

    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
}
