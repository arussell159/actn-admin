import { defineConfig } from "@playwright/test"
import config from "./playwright.okf.config"

export default defineConfig({
  ...config,
  testMatch: "certificate-field-copy.spec.ts",
  outputDir: "./node_modules/.cache/certificate-fields-browser-results",
})
