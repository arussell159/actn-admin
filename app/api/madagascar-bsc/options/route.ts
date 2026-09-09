import { NextResponse } from "next/server"

import { getMadagascarDropdownOptions } from "@/lib/madagascar-bsc-server"

export async function GET() {
  try {
    return NextResponse.json({
      ok: true,
      options: await getMadagascarDropdownOptions(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Could not read certificate options.",
      },
      { status: 500 }
    )
  }
}
