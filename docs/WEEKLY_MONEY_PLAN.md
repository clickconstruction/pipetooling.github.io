# Weekly Money Movement — build plan

---
file: docs/WEEKLY_MONEY_PLAN.md
type: Plan
purpose: Build plan for the Weekly Money Movement report (money out/in per job per week, earned vs cash lenses), the Moneyfill "weekly close" queues that make it trustworthy, and the eventual weekly_money email stream
audience: Developers, AI Agents
last_updated: 2026-08-07
key_sections:
  - name: "What we're building"
  - name: "Design decisions (defaults — veto here)"
  - name: "Phases"
  - name: "The PR train"
  - name: "Guardrails"
  - name: "Reconciliation invariants"
---

## Status: SHIPPED (v2.1441–v2.1449, 2026-08-07)

Every phase below is built and live: `job_pct_events` (v2.1441), the payload RPC (v2.1442 + v2.1443 sign/seed fixes, fidelity-verified — labor parity with `teamLabor.ts` exact), the report modal + entry points (v2.1443), the Moneyfill weekly close with all 8 queues (v2.1444–v2.1447), and the `weekly_money` stream + schedule integration (v2.1448–v2.1449, standing Monday send active as production proof). This doc remains the design record; current behavior lives in [REPORT_SUBSCRIPTIONS.md](./REPORT_SUBSCRIPTIONS.md), RECENT_FEATURES.md v2.1441–v2.1449, and the help guide `see-the-weeks-money-movement.md`. Known bootstrap note: Δ% history began 2026-08-06 — the first weeks lean on the no-%-signal flag until events accumulate.

## What we're building

Three connected deliverables, in dependency order:

1. **`job_pct_events`** — a trigger-written history of `jobs_ledger.pct_complete` (the one schema gap; % has no history today, so "42% → 55% this week" is underivable after the fact).
2. **Moneyfill "weekly close"** — week-scoped queues on `/moneyfill` that drive every cost/revenue stream to full job attribution for a chosen week, worked to zero.
3. **The Weekly Money Movement report** — a Weekly-movement-style modal (Mon–Sun Central week, ‹ › nav, print): per job, money out (labor / subs / materials), money in (payments), Δ% done, value created (Δ% × job total), under two lenses — **Earned** (value created − money out) and **Cash** (in − out) — with made-money / lost-money sections, an overhead line, and a **confidence footer** showing the same unattributed counts as the Moneyfill queues. Later, a `weekly_money` email stream on the Report Subscriptions pattern.

Concept mockup (visual reference for the report + close checklist): the "Weekly Money Movement — concept" artifact from the 2026-08-06 design session.

## Design decisions (defaults — veto here)

- **Week = Mon–Sun Central**, matching Weekly movement (`stagesWeeklyMovement.ts`). Note: pay surfaces use Sun–Sat company weeks (`companyWeekStartSundayContaining`) — this report is a *job* lens, not a payroll lens, so it pairs with its sibling report instead. The doc'd divergence is deliberate.
- **Access = dev + controller** (client gate and RPC gate). Labor $ derives from wages, so this matches the Moneyfill / `has_payroll_access()` posture; pay-approved masters can be added later by widening one RPC check.
- **RPC-first architecture** (differs from `weekly_movement`): one role-gated SECURITY DEFINER `get_weekly_money_movement_payload(p_week_monday date DEFAULT NULL)` feeds BOTH the client modal and, later, the email dispatcher. `weekly_movement` computed client-side and hand-mirrored the SQL for dispatch (fidelity-verified to the penny — doable but expensive). Money math spans wages + Mercury + supply allocations where controller RLS is patchy; one server-side source of truth kills both the RLS problem and the mirror-drift problem. The TS kernel then does display shaping only.
- **Value created** = Δ% for the week × job total (`revenue`). Δ% source priority per job: `job_pct_events` in-week → dated field-report % (`reports` are timestamped) → no signal ⇒ "no report" flag (never assume 0 or 100).
- **Labor attribution follows the existing conventions exactly**: approved sessions only, `people_crew_jobs`/`people_crew_bids` Convention 1 (share of total day — matches `sync_crew_jobs_from_clock`), salary 8/0 costing (`salariedEffectiveHours` semantics), hours × `people_pay_config.hourly_wage`. The report must reconcile with Crew P&L and People → Review, not invent a fourth convention.
- **Materials by dated allocation**: `supply_house_invoice_job_allocations` by invoice date, `mercury_transaction_job_allocations` by Chicago posted date, tally lines by `created_at` (Chicago), `jobs_ledger_materials` by their date — same date conventions as the Overhead tab loaders.
- **Money in** = `jobs_ledger_payments` by `paid_on`. Billed-not-collected is visible in the Cash lens as in = 0 rows, not a third lens.
- **Overhead is a line, not a smear**: office/bid labor and office parts show as their own "Not on jobs" row (the Overhead tab remains the deep dive). No per-job overhead allocation in v1.
- **Report entry points**: Jobs → Pipeline stage-strip Section tools menu (Pipeline group, beside Weekly movement) + `?stagesMoney=1` deep link (handle-gated + cold-load e2e, per the v2.832 rule) + a card on Moneyfill.

## Phases

### Phase 0 — `job_pct_events` (ship first; history must accumulate)

- Migration: `job_pct_events` (id, `job_id` FK, `pct` int 0–100 null, `source` text — `manual` / `rpc`, `changed_by_user_id`, `changed_at`) + AFTER UPDATE trigger on `jobs_ledger.pct_complete` (single-writer pattern copied from `job_status_events`, v2.1435).
- Seed one baseline row per job with a non-null `pct_complete` (start-of-history anchor so week-1 deltas resolve).
- CREATE TABLE ⇒ **both** `apply_read_only_write_blocks()` + `apply_read_only_stmt_blocks()`; RLS mirrors `job_status_events` read access; `SET lock_timeout = '3s'`.
- Until a few weeks of history exist, the report's Δ% falls back to dated field reports — Phase 0 shipping early is what makes Phase 4 fully honest.

### Phase 1 — payload RPC + fidelity check

- `get_weekly_money_movement_payload(p_week_monday DEFAULT NULL)` — SECURITY DEFINER, gated dev/controller in-function; NULL = previous complete Central week (dispatcher semantics from day one). Returns JSON: per-job rows (labor $, sub $, materials $ by source, payments in, pct start/end/source), overhead bucket, and the confidence counts.
- Fidelity-verify read-only against prod before building UI on it: labor vs Crew P&L rows, materials vs Job Summary Parts Cost, payments vs Edit Job Payments received, for 2–3 known jobs/weeks.
- Baseline-function gotcha applies if this ever touches existing functions: dump live definitions before any `CREATE OR REPLACE`.

### Phase 2 — kernel + report modal (client)

- `src/lib/jobs/weeklyMoneyMovement.ts`: payload → view model (lens math, made/lost bucketing, composition percentages, flags `spend-no-progress` / `no-job-total` / `no-report`, print HTML builder). Pure, colocated tests including reconciliation fixtures (see invariants).
- `JobsWeeklyMoneyModal.tsx`: week nav, Earned | Cash toggle, KPI strip (out / in / net cash / value created / earned net), sections, overhead line, confidence footer, Print (`openHtmlPrintWindow`). Self-fetching via the RPC; role-gated mount.

### Phase 3 — Moneyfill weekly close (one small PR per queue)

Shared shell first, then queues by dollar-risk order. Each queue = week-scoped count/$ + drill-in + link to the existing fix surface (never a second editor).

| # | Queue | Source / reuse | Status today |
|---|---|---|---|
| 3a | **Close-week shell**: week picker (defaults previous complete week) + section framework + `moneyfillWeekClose.ts` lib shared with the report's confidence footer | `QuickfillSectionWrapper` + marks tables | new |
| 3b | Card charges not split to jobs ($ total, week) | Banking → **User Sort** data path (`fetchJobAllocationsByMercuryTxIds`, paged), week-bounded; per-row **Sort in Banking → User Sort** opens `/banking?tab=sorting&q=<counterparty>` (v2.2849 — was a dead-end `navigate('/quickfill')`) | mirror |
| 3c | Approved time with no job/bid, as dollars (hours × wage) | `peopleHoursUnallocatedRows.ts` kernel + wages | mirror ($-view) |
| 3d | Closed sessions pending approval (labor not yet booked) | pending-sessions queries; link to People → Hours | new |
| 3e | Supply invoices not fully allocated to jobs (Σ allocations < amount) | new coverage query/RPC over `supply_house_invoices` + allocations | **new — exists nowhere** |
| 3f | Deposits not applied to jobs (week) | `count/list_mercury_transactions_for_bank_payments` + date bounds (additive RPC param) | mirror |
| 3g | Worked jobs with no % signal this week | in-week hours ∖ (`job_pct_events` ∪ dated reports) — needs Phase 0 | new |
| 3h | Active jobs with no job total | extend `quickfillCompleteNoBill.ts` week-scoped | extend |
| 3i | Sub days without a priced sub sheet (heuristic) | crew presence vs `people_labor_jobs` | new, v2-optional |

### Phase 4 — report ships

- Entry points + deep link + e2e cold-load spec; confidence footer reads the 3a lib so the report and Moneyfill can never disagree.
- Help guide (`see-the-weeks-money-movement.md`, title lowercase "How do I…" form) + release note + RECENT_FEATURES + ACCESS_CONTROL note for the dev/controller gate.
- Ship once 3a–3d exist (footer is honest even while 3e–3h are in flight).

### Phase 5 — `weekly_money` email stream (Report Subscriptions checklist)

- `weekly_money_email_requests` (internal `recipient_user_id`; recipient cohort restricted to dev/controller — the email contains wage-derived cost data), `repeat_weekly`, RLS + both read-only sweeps.
- `weekly-money-email-dispatch` edge fn + pg_cron (5-min, `X-Cron-Secret`): reuses the Phase-1 RPC (no fidelity re-verification needed — same source of truth), renders HTML, Resend, `sent_at`, weekly re-insert.
- Share box in the modal (copy the weekly_movement box: next-Monday 7 AM default, Repeat weekly on, pending list + Cancel); `get_my_email_schedule()` / `get_global_email_schedule()` branches (**rebuild from LIVE bodies** — never the baseline); Settings chip tone; REPORT_SUBSCRIPTIONS.md inventory row.

### Phase 6 — later (not in this train)

> Tracked in [`to-dos/weekly-money-later.md`](../to-dos/weekly-money-later.md) (2026-09-05 sweep).

Per-row drilldowns beyond Job Detail links; GC/development grouping lens; month roll-up; feeding the Charges & Value timeline; widening access to pay-approved masters.

## The PR train

Small PRs, one claim each, auto-merge. Rough order (0 → 12); ~13 PRs total.

| PR | Contents | Depends on |
|---|---|---|
| 0 | Phase 0 migration (`job_pct_events` + trigger + seed) | — |
| 1 | Phase 1 migration (payload RPC) + prod fidelity notes in MIGRATIONS.md | 0 (reads events) |
| 2 | Kernel + tests | 1 (payload shape) |
| 3 | Report modal behind entry-point-less mount (dev-only flag ok) | 2 |
| 4 | Moneyfill 3a shell + close-week lib | — (parallel to 1–3) |
| 5–8 | Queues 3b, 3c, 3d, 3e | 4 |
| 9 | Phase 4 ship: entry points, deep link + e2e, confidence footer wiring, help guide | 3, 4–7 |
| 10–11 | Queues 3f, 3g, 3h (3g needs PR 0 history flowing) | 4 |
| 12 | Phase 5 stream (may split table+fn / UI+schedule like v2.1437/v2.1438) | 9 |

## Guardrails (repo rules that bite here)

- Migrations: `SET lock_timeout = '3s'`; idempotent (`IF NOT EXISTS` / `CREATE OR REPLACE`); number from `origin/main`'s latest; register with `npm run claim -- --migration <file>`; apply ONLY via `supabase db push` after merge; CREATE TABLE ⇒ both read-only helpers.
- Never rebuild `get_my_email_schedule` / `get_global_email_schedule` from a repo baseline — dump the live body first (v2.1400 lesson).
- Every PR: `npm run claim`, RECENT_FEATURES + `releaseNotes.ts` pair (same v2.NNN), MIGRATIONS/EDGE_FUNCTIONS entries, help guide when user-facing.
- Edge fn deploys are manual after merge; `check:edge-drift` / `check:migration-drift` verify.
- Wage privacy is enforced server-side in the RPC, not just by hiding UI.
- Theme tokens only (no raw neutral hexes); money red/green stay literal (saturated status colors).

## Reconciliation invariants (kernel test fixtures)

1. A job's weekly labor $ here = the same week's Crew P&L labor for that job's people (Convention 1, approved-only, salary 8/0).
2. A job's weekly materials $ here = Job Summary Parts Cost restricted to in-week dated allocations.
3. Money in here = Edit Job → Payments received rows with `paid_on` in-week.
4. Σ(job rows) + overhead line = total money out — nothing silently dropped; unattributed remainders appear in the confidence footer, never in job rows.
5. Report confidence counts ≡ Moneyfill queue counts for the same week (shared lib, one implementation).
