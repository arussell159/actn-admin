import type { MetadataRoute } from "next"

export const dynamic = "force-static"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ACTN Admin",
    short_name: "ACTN Admin",
    description: "Africa CTN admin tools for month end, quotes, notes, and pricing.",
    start_url: "/month-end",
    scope: "/",
    display: "fullscreen",
    background_color: "#f7fafb",
    theme_color: "#ffffff",
    orientation: "portrait",
    categories: ["business", "productivity", "utilities"],
    shortcuts: [
      {
        name: "Month End",
        short_name: "Month End",
        description: "Open the current month-end checklist.",
        url: "/month-end",
      },
      {
        name: "Previous Months",
        short_name: "Previous",
        description: "Open closed month-end records.",
        url: "/previous-month-ends",
      },
      {
        name: "Quote Tool",
        short_name: "Quote",
        description: "Open the quote tool.",
        url: "/quote-tool",
      },
      {
        name: "Notebook",
        short_name: "Notes",
        description: "Open the notebook.",
        url: "/information",
      },
    ],
    icons: [
      {
        src: "/actn-admin-icon.png",
        sizes: "144x144",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/actn-admin-icon.png",
        sizes: "144x144",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
