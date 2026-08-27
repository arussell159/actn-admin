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

  if (isLocalhostRequest(request.nextUrl.hostname)) {
    return NextResponse.next()
  }

  const { response, user } = await updateSession(request)

  if (pathname === loginPath && user) {
    return NextResponse.redirect(new URL("/month-end", request.url))
  }

  if (!user && !isAuthBypassPath(pathname)) {
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
