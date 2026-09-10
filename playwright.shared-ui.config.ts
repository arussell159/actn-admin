import { defineConfig } from "@playwright/test"
import base from "./playwright.okf.config"
export default defineConfig({
  ...base,
  testMatch: ["shared-ui.spec.ts", "okf.spec.ts"],
  outputDir: "./node_modules/.cache/shared-ui-results",
})
