// Supabase caps a single select. Keep paging so imports and reconciliations do
// not silently lose rows after the first page. Callers must order by a unique ID.
export async function readAllRows<T>(
  page: (
    from: number,
    to: number
  ) => PromiseLike<{
    data: T[] | null
    error: unknown
  }>
): Promise<T[]> {
  const rows: T[] = []
  const pageSize = 500
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) return rows
  }
}

export async function deleteRowsById(
  ids: string[],
  remove: (ids: string[]) => PromiseLike<{ error: unknown }>
) {
  // Bound URL length: long import IDs otherwise overflow proxy request limits.
  for (let index = 0; index < ids.length; index += 25) {
    const { error } = await remove(ids.slice(index, index + 25))
    if (error) throw error
  }
}
