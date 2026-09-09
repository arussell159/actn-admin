export type BscCountryModule = {
  id: string
  country: string
  label: string
  basePath: string
  apiBasePath: string
  newRequestLabel: string
  requestsLabel: string
  requestSingularLabel: string
  requestPluralLabel: string
  rulesLabel: string
}

export const bscCountryModules: BscCountryModule[] = [
  {
    id: "madagascar",
    country: "Madagascar",
    label: "Cargo Tracking Notes",
    basePath: "/cargo-tracking-notes",
    apiBasePath: "/api/cargo-tracking-notes",
    newRequestLabel: "New ECTN",
    requestsLabel: "Certificates",
    requestSingularLabel: "Certificate",
    requestPluralLabel: "Certificates",
    rulesLabel: "Knowledge Base",
  },
]
