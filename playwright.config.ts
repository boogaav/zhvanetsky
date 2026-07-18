import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run against a dedicated dev server on port 5199 with the
 * deterministic demo provider, so no API key is required.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: "http://localhost:5199",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    // Production server on its own port: Next 16 allows only one dev
    // server per project dir, and e2e must not depend on `npm run dev`.
    command: "npx next build && npx next start -p 5199",
    url: "http://localhost:5199",
    reuseExistingServer: !process.env.CI,
    env: { AI_PROVIDER: "demo", RATE_LIMIT_MAX: "100000" },
    timeout: 240_000,
  },
});
