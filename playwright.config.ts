import { existsSync, readFileSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

/**
 * Tier-1 E2E smoke suite (see docs/E2E_SMOKE.md): runs READ-ONLY checks
 * against the deployed production site as the dedicated test user. Non-gating
 * — wired to post-deploy/nightly/manual workflows, never to PR checks.
 *
 * Requires E2E_TEST_EMAIL / E2E_TEST_PASSWORD in the environment (GitHub
 * Actions secrets in CI; locally they load from `.env.local` below, or export
 * them in your shell).
 */

// Local convenience: fill missing vars from gitignored .env.local so
// `npm run e2e` works without exporting credentials by hand. Real
// environment variables always win (CI is unaffected — no .env.local there).
if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (m?.[1] && m[2] !== undefined && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2]
    }
  }
}
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
