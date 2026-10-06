import { defineConfig } from "@playwright/test"
import base from "./playwright.okf.config"

export default defineConfig({
  ...base,
  testMatch: "exchange-rate.spec.ts",
  outputDir: "./node_modules/.cache/exchange-rate-results",
})
