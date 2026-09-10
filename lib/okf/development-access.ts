export function isOkfDevelopment(
  host: string,
  environment = process.env.NODE_ENV
) {
  if (environment !== "development") return false
  try {
    const hostname = new URL(`http://${host}`).hostname
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]" ||
      hostname.endsWith(".localhost")
    )
  } catch {
    return false
  }
}
