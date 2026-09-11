import { createClient as createSupabaseClient } from "@supabase/supabase-js"

import { isLocalhostRequest } from "@/lib/auth"
import { fetchWithTimeout } from "@/lib/network"
import { assertSupabaseConfig } from "@/lib/supabase-env"

const localDevelopmentEmail = "local-development@africactn.invalid"

function unavailable() {
  return Response.json({ ok: false }, { status: 404 })
}

export async function POST(request: Request) {
  const hostname = new URL(request.url).hostname

  if (process.env.NODE_ENV !== "development" || !isLocalhostRequest(hostname)) {
    return unavailable()
  }

  const secretKey =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!secretKey) {
    return Response.json(
      {
        ok: false,
        message:
          "Sign in at /login with your staff account. Automatic local sign-in needs SUPABASE_SECRET_KEY in the development environment.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    )
  }

  const { supabaseUrl } = assertSupabaseConfig()
  const admin = createSupabaseClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      fetch: (input, init) => fetchWithTimeout(input, init, 15_000),
    },
  })
  const initial = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: localDevelopmentEmail,
  })

  if (
    initial.error ||
    !initial.data.user ||
    !initial.data.properties?.hashed_token
  ) {
    return Response.json(
      {
        ok: false,
        message:
          initial.error?.message || "Could not create the local session.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    )
  }

  let user = initial.data.user
  let properties = initial.data.properties

  if (
    user.app_metadata.local_development !== true ||
    user.app_metadata.okf_role !== "admin"
  ) {
    const metadata = {
      ...user.app_metadata,
      local_development: true,
      okf_role: "admin",
    }
    const { error: updateError } = await admin.auth.admin.updateUserById(
      user.id,
      { app_metadata: metadata }
    )

    if (updateError) {
      return Response.json(
        { ok: false, message: updateError.message },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      )
    }

    const refreshed = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: localDevelopmentEmail,
    })
    if (
      refreshed.error ||
      !refreshed.data.user ||
      !refreshed.data.properties?.hashed_token
    ) {
      return Response.json(
        {
          ok: false,
          message:
            refreshed.error?.message || "Could not refresh the local session.",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      )
    }

    user = refreshed.data.user
    properties = refreshed.data.properties
  }

  return Response.json(
    {
      ok: true,
      tokenHash: properties.hashed_token,
      type: "magiclink",
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
