import { defineConfig, devices } from '@playwright/test'

/**
 * Tier-1 E2E smoke suite (see docs/E2E_SMOKE.md): runs READ-ONLY checks
 * against the deployed production site as the dedicated test user. Non-gating
 * — wired to post-deploy/nightly/manual workflows, never to PR checks.
 *
 * Requires E2E_TEST_EMAIL / E2E_TEST_PASSWORD in the environment (GitHub
 * Actions secrets in CI; export them in your shell locally).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 2 : 0,
  workers: 2,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://pipetooling.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' },
      dependencies: ['setup'],
    },
  ],
})
