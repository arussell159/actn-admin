import { defineConfig } from "@playwright/test"

const sizes = [
  [320, 568],
  [375, 667],
  [390, 844],
  [393, 852],
  [430, 932],
  [768, 1024],
  [1280, 900],
]

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 3,
  reporter: [
    ["list"],
    ["json", { outputFile: "outputs/mobile-stability/results.json" }],
    [
      "html",
      { open: "never", outputFolder: "outputs/mobile-stability/report" },
    ],
  ],
  outputDir: "outputs/mobile-stability/test-results",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    reducedMotion: "reduce",
    colorScheme: "light",
  },
  projects: ["chromium", "webkit"].flatMap((browserName) =>
    sizes.map(([width, height]) => ({
      name: `${browserName}-${width}`,
      testMatch: width === 390 ? "**/*.spec.ts" : "**/mobile-shell.spec.ts",
      use: {
        browserName: browserName as "chromium" | "webkit",
        viewport: { width, height },
        isMobile: width < 768,
        hasTouch: width < 1280,
      },
    }))
  ),
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run start -- --port 3100",
        url: "http://localhost:3100/login",
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
})
