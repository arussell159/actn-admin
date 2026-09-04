export class RequestTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`)
    this.name = "RequestTimeoutError"
  }
}

async function withRequestDeadline<T>({
  signal,
  timeoutMs,
  request,
}: {
  signal?: AbortSignal | null
  timeoutMs: number
  request: (signal: AbortSignal) => Promise<T>
}) {
  const controller = new AbortController()
  let didTimeout = false
  const abortFromCaller = () => controller.abort(signal?.reason)

  if (signal?.aborted) {
    abortFromCaller()
  } else {
    signal?.addEventListener("abort", abortFromCaller, { once: true })
  }

  const timeoutId = setTimeout(() => {
    didTimeout = true
    controller.abort()
  }, timeoutMs)

  try {
    return await request(controller.signal)
  } catch (error) {
    if (didTimeout) {
      throw new RequestTimeoutError(timeoutMs)
    }

    throw error
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener("abort", abortFromCaller)
  }
}

export function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 30_000
) {
  return withRequestDeadline({
    signal: init.signal,
    timeoutMs,
    request: (signal) => fetch(input, { ...init, signal }),
  })
}

export function fetchJsonWithTimeout<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 30_000
) {
  return withRequestDeadline({
    signal: init.signal,
    timeoutMs,
    request: async (signal) => {
      const response = await fetch(input, { ...init, signal })

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
      }

      return (await response.json()) as T
    },
  })
}
