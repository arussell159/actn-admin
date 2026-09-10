import "server-only"
import { createHash } from "node:crypto"
import { databaseError, OkfError, type okfSession } from "../okf/server"
import {
  countryKey,
  layoutRecordSchema,
  type CertificateLayout,
  type CertificateLayoutRecord,
} from "./schema"

export async function readCertificateLayouts(
  client: Awaited<ReturnType<typeof okfSession>>["client"]
) {
  const { data, error } = await client
    .from("okf_certificate_layouts")
    .select("*")
    .order("country_key", { ascending: true })
  if (error)
    throw new OkfError(
      "Certificate layout storage is not ready. Apply supabase-certificate-layouts.sql and reload.",
      503
    )
  return layoutRecordSchema.array().parse(data)
}
export function checkCountryAliases(
  rows: CertificateLayoutRecord[],
  layout: CertificateLayout
) {
  const key = countryKey(layout.country)
  const aliases = new Set([layout.country, ...layout.aliases].map(countryKey))
  if (!key || !/^[a-z]/.test(key))
    throw new OkfError("Enter a country name beginning with a letter.")
  for (const row of rows) {
    if (
      row.country_key !== key &&
      [row.layout.country, ...row.layout.aliases].some((name) =>
        aliases.has(countryKey(name))
      )
    ) {
      throw new OkfError(
        `A country name or alias already belongs to ${row.layout.country}.`
      )
    }
  }
}
export const layoutCatalogTag = (rows: CertificateLayoutRecord[]) =>
  '"' +
  createHash("sha256")
    .update(
      JSON.stringify(
        rows.map((row) => [row.country_key, row.revision, row.layout])
      )
    )
    .digest("hex") +
  '"'
export async function publishCertificateLayout(
  client: Awaited<ReturnType<typeof okfSession>>["client"],
  layout: CertificateLayout,
  expectedRevision: number
) {
  checkCountryAliases(await readCertificateLayouts(client), layout)
  const { data, error } = await client.rpc("okf_publish_certificate_layout", {
    p_country_key: countryKey(layout.country),
    p_layout: layout,
    p_expected_revision: expectedRevision,
  })
  databaseError(error)
  return layoutRecordSchema.parse(data)
}
export async function deleteCertificateLayout(
  client: Awaited<ReturnType<typeof okfSession>>["client"],
  key: string,
  expectedRevision: number
) {
  const { data, error } = await client.rpc("okf_delete_certificate_layout", {
    p_country_key: key,
    p_expected_revision: expectedRevision,
  })
  databaseError(error)
  if (data !== true) throw new OkfError("Could not delete the country layout.")
}
