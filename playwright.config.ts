import { defineConfig, devices } from '@playwright/test';

// E2E browser tests for the highest-value user flows (the reader, the /?audit=
// deep-link prefill, and briefing rendering). Runs against `astro dev`; the
// audit API is route-mocked in the specs so tests are deterministic and never
// spend LLM quota. Kept separate from the Vitest unit suite (`pnpm test`).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
