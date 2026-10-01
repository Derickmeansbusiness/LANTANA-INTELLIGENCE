import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

// Use the pre-installed Chromium when present (cloud dev containers), else Playwright's own.
const localChromium = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const executablePath = process.env.PW_CHROMIUM ?? (existsSync(localChromium) ? localChromium : undefined);

// One id per `playwright test` invocation, shared by every worker (workers are
// restarted after a failure, so a module-level Date.now() would change mid-run).
process.env.E2E_RUN ??= Date.now().toString(36).slice(-5);

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 90_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    launchOptions: executablePath ? { executablePath } : undefined,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } }, dependencies: ["setup"], testIgnore: /(auth\.setup|responsive\.spec)\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 } }, dependencies: ["setup"], testMatch: /responsive\.spec\.ts/ },
  ],
  webServer: [
    // Scripted stand-in for the Anthropic API, so Ask Lantana runs without a key.
    { command: "node scripts/mock-anthropic.mjs", url: "http://127.0.0.1:4010/__requests", reuseExistingServer: true, timeout: 30_000 },
    {
      command: "pnpm dev",
      url: "http://localhost:3000/login",
      reuseExistingServer: true,
      timeout: 120_000,
      env: { ANTHROPIC_API_KEY: "test-key", ANTHROPIC_BASE_URL: "http://127.0.0.1:4010" },
    },
  ],
});
