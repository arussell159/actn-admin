export const certificateLayoutsHref = (country?: string) =>
  "/certificate-settings" +
  (country ? "?country=" + encodeURIComponent(country) : "")
