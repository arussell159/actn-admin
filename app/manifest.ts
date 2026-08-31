import type { MetadataRoute } from "next"

export const dynamic = "force-static"

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "ACTN Admin",
    short_name: "ACTN Admin",
    description: "Africa CTN admin tools for month end, quotes, notes, and pricing.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f7fafb",
    theme_color: "#ffffff",
    orientation: "portrait",
    categories: ["business", "productivity", "utilities"],
    shortcuts: [
      {
        name: "Dashboard",
        short_name: "Dashboard",
        description: "Open the admin dashboard.",
        url: "/dashboard",
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
        src: "/actn-admin-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/actn-admin-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/actn-admin-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
