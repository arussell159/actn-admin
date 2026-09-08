import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "mobile-layout.spec.ts",
  outputDir: "./node_modules/.cache/mobile-layout/results",
  reporter: [
    ["list"],
    [
      "json",
      { outputFile: "./node_modules/.cache/mobile-layout/results.json" },
    ],
  ],
  workers: 2,
  timeout: 120_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    serviceWorkers: "block",
    screenshot: "only-on-failure",
    actionTimeout: 8000,
  },
  projects: [
    ...["chromium", "webkit"].flatMap((browserName) =>
      [
        [320, 568],
        [375, 667],
        [390, 844],
        [430, 932],
      ].map(([width, height]) => ({
        name: `${browserName}-${width}`,
        use: {
          browserName: browserName as "chromium" | "webkit",
          viewport: { width, height },
          isMobile: true,
          hasTouch: true,
        },
      }))
    ),
    {
      name: "desktop",
      use: { browserName: "chromium", viewport: { width: 1280, height: 900 } },
    },
  ],
})
