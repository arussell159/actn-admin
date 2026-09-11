import { authenticatedFetch } from "@/lib/client"

export function stableSignature(value: unknown) {
  return JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item).sort(([a], [b]) => a.localeCompare(b))
        )
      : item
  )
}
export async function okfApi<T>(path: string, body?: unknown): Promise<T> {
  const response = await authenticatedFetch(
    path,
    body === undefined
      ? { cache: "no-store" }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
  )
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error("Sign in again to use the OKF.")
  const result = await response.json()
  if (!response.ok || !result.ok)
    throw new Error(result.message || "The OKF operation failed.")
  return result as T
}
