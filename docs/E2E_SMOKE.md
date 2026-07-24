# E2E Smoke Suite

---
file: docs/E2E_SMOKE.md
type: Engineering / Testing
purpose: What the Playwright Tier-1 smoke suite covers, how it authenticates, when it runs, and the rules for extending it (read-only, structural assertions, non-gating).
audience: Developers, AI Agents
last_updated: 2026-07-24
---

## What this is

A small Playwright suite (`e2e/`, `playwright.config.ts`) that runs **read-only, structural** checks against the deployed production site as the dedicated test user. Born from the 2026-07-21 post-decomposition verification: every real bug that sweep found was a **cold-load timing bug** (imperative-handle races, the auth role-bounce) — a class that unit tests, typecheck, and diff review structurally cannot catch, and that only shows on real cold page loads. This suite pins those exact regressions plus the surfaces they lived in.

There is no staging environment, so production is the only real render target. That shapes every rule below.

## Coverage

- `e2e/deep-links.spec.ts` — the cold-load deep-link matrix: `?showBilledTotalByName=`, `?openBankPayments=` (v2.832 fixes), `?editLabor=` unknown-HCP, `?newJob=true&tab=sub_sheet_ledger` (v2.835 fixes), `?stagesSection=`, plus `/accounts-receivable` and `/map` direct loads (v2.833 fixes). Each asserts the surface opened AND the param self-stripped.
- `e2e/jobs-tabs.spec.ts` — all nine Jobs tabs cold-load with their distinctive markers and zero page errors; the Stages always-mounted contract (state survives tab switches).
- `e2e/stages-board.spec.ts` — board sections + totals render; Total by Name modal; the print popup path (`window.print` stubbed so headless never hangs).
- `e2e/viewport-smoke.spec.ts` — phone-viewport invariants at 375×812 (v2.1003): the top seven pages load with no document-level sideways overflow (the v2.980/v2.982 regression signature); Stages board tables scroll inside their own wrappers, never the page (v2.984 contract); the Additional Report modal's sticky ✕ stays inside the panel's visible box at max scroll (v2.990 pin).
- `e2e/settings-tabs.spec.ts` — every dev-visible Settings tab cold-loads its marker with zero page errors; `?tab=` deep link activates; the v2.855 Catalogs engines render their blocks (post-decomposition pin; the Sharing & Adoption block was removed in v2.922 — grants are auto-maintained since v2.921).

## Rules (do not break these)

1. **Read-only.** The test account is a real `dev` user on prod — never click confirms, saves, sends, status moves, or ham-mode one-click actions. Modal open/close, search, section toggles, and navigation only.
2. **Structural assertions only.** Headings, column labels, params, element presence — never data-exact values; prod data moves daily.
3. **Non-gating.** The workflow (`.github/workflows/e2e-smoke.yml`) runs post-deploy, nightly, and on `workflow_dispatch` — it must NOT be added to PR checks until it has proven flake-free for a while.
4. **Credentials come only from the environment** — `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` (GitHub Actions secrets in CI; locally from gitignored `.env.local`, auto-loaded by `playwright.config.ts`, or your shell). Never hardcode them anywhere, including test fixtures.
5. Deep-link tests exist because of the **handle-gating rule** in [`JOBS_TABS_ARCHITECTURE.md`](./JOBS_TABS_ARCHITECTURE.md) — when adding a new handle-driven deep link, add its cold-load spec here in the same PR.

## Running

- CI: automatic (post-deploy + nightly), or `gh workflow run e2e-smoke.yml`.
- Locally: `npm run e2e` — the config auto-loads `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` from gitignored `.env.local` (or set them in your shell; explicit env vars win). Needs Node ≥ 20.6 (this repo is ESM; Playwright's TS loader uses `module.register`) and `npx playwright install chromium` once.
- Auth: `e2e/auth.setup.ts` signs in once and stores the Supabase session as `storageState` (`e2e/.auth/`, gitignored); every spec reuses it.
