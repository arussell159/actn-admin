import { defineConfig } from "@playwright/test"
export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "okf.spec.ts",
  outputDir: "./node_modules/.cache/okf-browser-results",
  reporter: "list",
  workers: 1,
  use: { baseURL: "http://localhost:3000", serviceWorkers: "block" },
  projects: [
    {
      name: "desktop",
      use: { browserName: "chromium", viewport: { width: 1440, height: 1000 } },
    },
    {
      name: "mobile",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
})
