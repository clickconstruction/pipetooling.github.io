# E2E Smoke Suite

---
file: docs/E2E_SMOKE.md
type: Engineering / Testing
purpose: What the Playwright Tier-1 smoke suite covers, how it authenticates, when it runs, and the rules for extending it (read-only, structural assertions, non-gating).
audience: Developers, AI Agents
last_updated: 2026-10-04
---

## What this is

A small Playwright suite (`e2e/`, `playwright.config.ts`) that runs **read-only, structural** checks against the deployed production site as the dedicated test user. Born from the 2026-07-21 post-decomposition verification: every real bug that sweep found was a **cold-load timing bug** (imperative-handle races, the auth role-bounce) — a class that unit tests, typecheck, and diff review structurally cannot catch, and that only shows on real cold page loads. This suite pins those exact regressions plus the surfaces they lived in.

There is no staging environment, so production is the only real render target. That shapes every rule below.

## Coverage

- `e2e/deep-links.spec.ts` — the cold-load deep-link matrix: `?showBilledTotalByName=`, `?openBankPayments=` (v2.832 fixes), `?editLabor=` unknown-HCP, `?newJob=true&tab=sub_sheet_ledger` (v2.835 fixes), `?stagesSection=`, `/bids?newBid=true&project=` (Projects card "+ Bid"), plus `/accounts-receivable` and `/map` direct loads (v2.833 fixes). Each asserts the surface opened AND the param self-stripped. (`/estimates?newEstimate=true&project=` deliberately has no spec — its handler inserts a draft estimate, which would create prod data on every run.)
- `e2e/jobs-tabs.spec.ts` — all nine Jobs tabs cold-load with their distinctive markers and zero page errors (active). The Stages always-mounted contract spec (state survives tab switches) is currently quarantined with `test.fixme` — the fill lands but reads back empty after Billing→Stages in CI; tracked in the spec's FIXME comment, do not delete.
- `e2e/stages-board.spec.ts` — board sections + totals render; Total by Name modal; the print popup path (`window.print` stubbed so headless never hangs).
- `e2e/viewport-smoke.spec.ts` — phone-viewport invariants at 375×812 (v2.1003): the top seven pages plus the Bid Board (`/bids?tab=bid-board`, whose phone cards overflowed the page until their header row wrapped) and Bids → Labor with no bid picked (`/bids?tab=labor`, whose labor book table pushed the page 188 px sideways until v2.4453; its marker waits for a real entry count) load with no document-level sideways overflow (the v2.980/v2.982 regression signature); Stages board tables scroll inside their own wrappers, never the page (v2.984 contract); the sticky modal header keeps its ✕ inside the panel's visible box at max scroll (v2.990, generalised to every `stickyModalHeaderStyle.ts` consumer in v2.992 — the spec drives Add inspection, the shallowest one). The overflow invariant also runs in the **tablet band** at 760px and 900px (v2.1357) on `/dashboard` and `/jobs?tab=stages` — that band is where the header row itself stops fitting and has to fold into the hamburger, and the header is global so two pages pin it. The tablet checks poll rather than sample once: the contract is that the settled page doesn't overflow, since the header measures and folds after the role lands.
- `e2e/scroll-lock.spec.ts` — the page behind a window, at 375×812 (v2.4399–v2.4402): Add inspection pins the page (`scroll-locked` on `<html>`, a fixed body) and Cancel frees it; People → Employment → Pay history pins it at the offset it had, and after Escape leaves no class, no `overflow: hidden` / `position: fixed` on the body, and the same `scrollY` (the window that used to leave the page frozen); at 375×590 the Lien desk (`?liendesk=1`) stays pinned through the lock's own 3 s re-check even where it stops above the Dispatch mode bar and covers under 90% of the screen; and on the public `/submittal` a stand-in window (a dim fixed backdrop holding a `role="dialog" aria-modal="true"` panel, added and removed by the spec) pins and frees the page, which is what proves the watcher is mounted outside the signed-in layout. Opens and closes only.
- `e2e/settings-tabs.spec.ts` — every dev-visible Settings tab cold-loads its marker with zero page errors; `?tab=` deep link activates; the v2.855 Catalogs engines render their blocks (post-decomposition pin; the Sharing & Adoption block was removed in v2.922 — grants are auto-maintained since v2.921). The tab list must track the group list in `src/lib/settingsGroups.ts` exactly — v2.1364 found it two renames behind (Recent push → Notifications, How it works → Guides) plus a missing Email & notifications tab. Markers assert **visible** text (`useInnerText: true`): inactive tabs stay mounted under `display: none`, so a `textContent` match passes for every marker on the page regardless of which tab is selected, and that vacuity is what hid the renames. Each tab click carries an explicit timeout — without one a missing label waits out the whole 90s test budget and reads as a hang rather than a rename. **Rebuilt in v2.3489** (12 tabs → 16): eight of the twelve labels had drifted and the tab list had moved to `src/lib/settingsGroups.ts` — that list, not `Settings.tsx`, is what the spec must track. Because the spec stops at the first mismatch, CI reported only one of the eight; assume the same whenever it goes red, and check every label rather than the one named.

## Rules (do not break these)

1. **Read-only.** The test account is a real `dev` user on prod — never click confirms, saves, sends, status moves, or ham-mode one-click actions. Modal open/close, search, section toggles, and navigation only.
2. **Structural assertions only.** Headings, column labels, params, element presence — never data-exact values; prod data moves daily.
3. **Non-gating.** The workflow (`.github/workflows/e2e-smoke.yml`) runs post-deploy, nightly, and on `workflow_dispatch` — it must NOT be added to PR checks until it has proven flake-free for a while.
4. **Credentials come only from the environment** — `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` (GitHub Actions secrets in CI; locally from gitignored `.env.local`, auto-loaded by `playwright.config.ts`, or your shell). Never hardcode them anywhere, including test fixtures.
5. Deep-link tests exist because of the **handle-gating rule** in [`JOBS_TABS_ARCHITECTURE.md`](./JOBS_TABS_ARCHITECTURE.md) — when adding a new handle-driven deep link, add its cold-load spec here in the same PR.
6. **Move a button, fix its spec in the same PR.** Because the suite is non-gating it fails silently: v2.1049 (Stages toolbar → ⋯ menu) and v2.1052 ("N Reports" pill → full-screen activity view) each stranded a spec, and the suite stayed red on *every* run for ~110 versions before anyone traced it (fixed in v2.1164). Before merging a PR that renames, relocates, or re-points a surface, grep `e2e/` for its accessible name and for the text it draws — Settings tab labels are the exception: `src/lib/settingsGroups.test.ts` compares the spec's list with the dev's tabs and fails the PR itself. A red suite that nobody reads is worse than no suite.

## Running

- CI: automatic (post-deploy + nightly), or `gh workflow run e2e-smoke.yml`.
- Locally: `npm run e2e` — the config auto-loads `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` from gitignored `.env.local` (or set them in your shell; explicit env vars win). Needs Node ≥ 20.6 (this repo is ESM; Playwright's TS loader uses `module.register`) and `npx playwright install chromium` once.
- Auth: `e2e/auth.setup.ts` signs in once and stores the Supabase session as `storageState` (`e2e/.auth/`, gitignored); every spec reuses it.

- `e2e/submittal-room.spec.ts` (v2.3485): `/submittal` with no token renders *This link is incomplete.* — the review room's public route is wired and does not bounce to sign-in. Read-only.

## The Bids live walk

A different animal from the suite above: it **writes**, it runs against a **local dev server** as the dev login, and nobody runs it but the person changing Bids. [`scripts/bids-live-walk.mjs`](../scripts/bids-live-walk.mjs) (`npm run walk:bids -- …`) does an estimator's day on a throwaway version of BP398 *ZZ Test*: twenty steps across Takeoffs, Labor, Pricing, Cover Letter and the Approval PDF, each recording what the screen said. It was written for the By Stage retirement (punch list #77), where it caught the one bug the unit suites missed.

**When:** before merging a change to Takeoffs, Labor, Pricing, Cover Letter or the pricing engine, and once more on `origin/main` after it deploys. Add `phone` when the change touches the open bid's card or title line, since the suite above never opens a bid.

```bash
PORT=5175 npm run walk:bids -- login                    # dev-login once (the dev server must be up)
git checkout --detach origin/main                       # the baseline
PORT=5175 npm run walk:bids -- walk out/main
PORT=5175 npm run walk:bids -- snapshot out/main 398,490,375
git checkout my-branch
PORT=5175 npm run walk:bids -- walk out/branch
PORT=5175 npm run walk:bids -- snapshot out/branch 398,490,375
npm run walk:bids -- diff out/main out/branch           # steps and tab lines that differ; exits 1 when any do
PORT=5175 npm run walk:bids -- phone out/phone 398,403  # every bid tab at 375 px; exits 1 when the title line leaves its card
rm e2e/.auth/bids-walk.json                             # a real prod session
```

**Rules.**

1. **It writes only to its sandbox.** `walk` makes a version named *ZZ walk (delete me)* from *To Plans*, edits that, deletes it, and its last step checks *To Plans* reads as before. The one write outside the version is the bid's labor rate, changed and put back. `snapshot` reads only.
2. **Only on a ZZ test bid.** `BID` defaults to 398. Never point it at a live bid.
3. **A difference is a question, not a verdict.** Prod data moves: the company labor rate shifts a cent when its 90-day window rolls at midnight. Read each differing line and say why it differs.
4. **Not in CI.** It needs the dev-login secret and it writes to prod.

