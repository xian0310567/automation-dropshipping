import { defineConfig, devices } from "@playwright/test";

const e2eBaseUrl = "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: e2eBaseUrl,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm start",
    env: {
      BLOB_READ_WRITE_TOKEN: "playwright-blob-token",
      COUPANG_ACCESS_KEY: "playwright-coupang-access-key",
      COUPANG_SECRET_KEY: "playwright-coupang-secret-key",
      COUPANG_VENDOR_ID: "playwright-vendor",
      CRON_SECRET: "playwright-cron-secret",
      DATABASE_DIRECT_URL: "postgres://playwright-direct",
      DATABASE_URL: "postgres://playwright-runtime",
      OPERATOR_ACTOR_ID: "playwright-operator",
      OPERATOR_API_KEY: "playwright-operator-key",
      PII_ENCRYPTION_KEY: "playwright-pii-key",
      PORT: "3100",
    },
    url: e2eBaseUrl,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
