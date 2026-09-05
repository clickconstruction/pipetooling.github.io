# Partnerships: config page + partner ledger — build plan

---
file: docs/PARTNERSHIPS_PLAN.md
type: Engineering / Feature plan — APPROVED 2026-08-19 (owner signed off with all defaults)
purpose: Staged plan for the dev-gated /partnerships page (per-partner deal config, job-majority gate, weekly statements, agreements) and the partner-facing ledger surfaces, making the Bryan Herber agreement operational and repeatable for future partners. Written 2026-08-19 from a full code/docs audit; companion clickable prototype in the "Partnerships Prototype" artifact.
audience: Developers, AI Agents
last_updated: 2026-08-19
---

## Status: SHIPPED (v2.1903–v2.2000, 2026-08-20/21); the off-toggle terms are tracked in [`to-dos/partnerships-off-toggles.md`](../to-dos/partnerships-off-toggles.md)

Owner approved the plan and the final prototype with **all default decisions** (see the decisions section — now recorded as taken, not open). The clickable prototype (artifact: "Partnerships Prototype") is the agreed UX reference; the "Bryan Partner Ledger" artifact (rev 4) is the annotated design record. Build progress is logged per-PR in RECENT_FEATURES.md as the train ships.

## The thesis

Don't build a partner system — generalize the two money systems that already exist and put one new gate between them. Employees already have weekly pay periods with per-day dual-rate splits, printable statements, installment payments, and a back-charge model (`pay_stubs` family + `person_offsets`). Subs already have own-row RLS money views and a work-order trail (run-subs, v2.1199–1222). What's genuinely new: a **`partnerships` config record** (the deal as data), a **majority check-off anchor** on jobs (the gate), **profit-share/utility posting types**, **statement acknowledgments**, and **partner-scoped read RPCs**. Bryan is the first row, not the feature.

Ground rules inherited from CLAUDE.md and prior plans:
- Every migration starts `SET lock_timeout = '3s';`; new tables end with BOTH `SELECT public.apply_read_only_write_blocks();` and `SELECT public.apply_read_only_stmt_blocks();`.
- Key every new object on `people.id` (PERSON_IDENTITY_PLAN invariant) — name text only as read fallback.
- Money math server-side in SECURITY DEFINER RPCs (WEEKLY_MONEY_PLAN precedent); wage privacy enforced in the RPC, not by hiding UI.
- Partner reads via RPC, not junction-referencing RLS — the v2.1225 recursion incident (a labor RLS policy took the whole money ledger down during office hours) is the standing lesson.
- Each PR: `npm run claim`, RECENT_FEATURES + releaseNotes pair (same v2.NNN), MIGRATIONS.md per migration, help guide for partner-facing surfaces, theme tokens only.

## Key facts the plan builds on (verified 2026-08-19 code audit)

- `pay_stubs` (person, period_start/end, hours_total, gross_pay, paid_at) + **`pay_stub_days` already persists the dual-rate split** (job_hours/job_rate/office_hours/office_rate, rate_at_time) + `pay_stub_payments` (installments) + `pay_stub_deductions` (links `person_offsets`).
- `person_offsets`: type ∈ backcharge / damage / employee_credit, `pay_stub_id` NULL = pending — exactly the contract's §4b model.
- Kernel `src/lib/people/personMoneyLedger.ts`: settle-up math, uncovered weeks, `buildPayStatementHtml` (shareable statement, no company revenue).
- Work-type split: `src/lib/officeJobRateSplit.ts` — office bucket = office job OR `bid_id` OR unassigned; field = real `job_ledger_id`. Estimating hours already classify via `clock_sessions.bid_id`.
- `people_pay_config`: `hourly_wage` + `office_hourly_wage` per person (name-keyed with person_id FK; the name-join is a documented fragility — partnerships must join by person_id).
- Own-row precedents: v2.1211 sub own-row SELECT policies; `DashboardSubMoneySection` (sub "Your money" card, fail-soft).
- Job cost buckets are **derived, not stored**: `jobProfitSummary.ts` (profit = revenue − parts − sub labor), `crewPnlSummary.ts` (per-person hours/billing/profit; six documented weaknesses), `get_weekly_money_movement_payload` (RPC-first money precedent).
- Attribution: `supply_house_invoice_job_allocations` is **pct-based**; `mercury_transaction_job_allocations` is dollar-based; `purchase_orders` has **no job FK** (connects via invoice text field) — costing drill-ins must read allocations, never POs.
- Contracts: `person_contract_documents` + templates + send-for-signature + `dashboard_prompt_after_clock_in` + run-subs compliance columns (type/expiry/person_id).
- `banking_attributors` = precedent for capability-by-table instead of a tenth role.
- Weeks: pay surfaces use **Sun–Sat** company weeks (`companyWeekStartSundayContaining`).

## DB objects (all idempotent, additive)

1. **`partnerships`** — one row per partner deal:
   `id`, `person_id uuid UNIQUE REFERENCES people(id)`, `status text` (draft/active/paused/ended), `started_on date`,
   `field_rate_cents int`, `estimating_rate_cents int`, `farm_rate_cents int DEFAULT 0`,
   `company_first_pct numeric` (22), `partner_remainder_pct numeric` (50),
   `modules jsonb` ({profit_shares, est_transfer, weekly_statement, costing, require_sign, auto_notice, cap, w2} — cap/w2 exist as keys, default false, nothing built behind them),
   `utilities_allowance_cents int` (20000), audit columns.
   RLS: dev-only (partner never reads this row; RPCs consume it server-side). Both read-only sweeps.
2. **Majority anchor on `jobs_ledger`** (nullable columns, RUN_SUBS anchor pattern):
   `partner_person_id uuid REFERENCES people(id)`, `partner_confirmed_by uuid`, `partner_confirmed_at timestamptz` + partial index `WHERE partner_person_id IS NOT NULL`.
3. **`person_offsets` widening**: allow types `profit_share`, `utility_overage`; add `job_id uuid NULL REFERENCES jobs_ledger(id)`, `reversal_of_offset_id uuid NULL`. Partial unique index `(type, job_id, person_id) WHERE type='profit_share' AND reversal_of_offset_id IS NULL` — the idempotency guarantee for postings.
4. **`statement_acknowledgments`**: `pay_stub_id`, `party` (company/partner), `user_id`, `acknowledged_at`; unique (pay_stub_id, party).
5. **Agreements**: `person_contract_documents` + `sign_by date NULL`, `partnership_id uuid NULL`; new **`partner_agreement_notices`** (partnership_id, generated_at, sign_by_missed, delivered_via text[], document_url, acknowledged fields) — the §8a written-notice log.

## RPCs (SECURITY DEFINER; caller resolution via `people.account_user_id`)

Partner-facing reads (each checks an active partnership for the caller; wage-free by construction):
- `get_my_partner_summary()` — balance, current-week lines, statement status, agreement prompt state.
- `get_my_partner_ledger(p_weeks int DEFAULT 8)` — week buckets: opening, lines (labor at partnership rates, offsets, shares, payouts), closing. Weeks beyond the window come from `get_my_partner_ledger_page` (keyset).
- `get_my_partner_statement(p_pay_stub_id)` + `acknowledge_partner_statement(p_pay_stub_id)`.
- `get_my_partner_jobs()` — jobs where `partner_person_id = caller`, with status + posted share.
- `get_my_partner_job_costing(p_job_id)` — gated on the majority flag: reported **hours per person (no wages)**, supply invoice allocations (invoice, date, pct → dollars), card-charge allocations, materials/direct rows incl. the §4h line, freshness timestamp. Best-efforts framing per §5.

Office-side writes (dev-gated in-function; controller where noted):
- `set_job_partner_majority(p_job_id, p_person_id NULL to clear)` — stamps who/when; clearing never touches postings.
- `generate_partner_statement(p_partnership_id, p_week_start, p_override bool DEFAULT false)` — builds the `pay_stubs` row + `pay_stub_days` from **approved** sessions priced at partnership rates (farm job → 0), attaches pending offsets, stamps company acknowledgment. Guard (unless override): zero unapproved sessions in week AND zero unreviewed worked jobs.
- `post_partner_profit_share(p_job_id)` — six-bucket rollup in SQL, split per partnership config, writes a `profit_share` offset (idempotent via the partial unique index). `reverse_partner_profit_share(p_job_id)` writes the negating row.
- `apply_bid_estimating_hours_to_job(p_job_id, p_bid_id)` — Σ approved `clock_sessions` with that `bid_id` × estimating rate → a sourced `jobs_ledger_materials` row (kind `estimating_transfer`, idempotent by source key); §4h.
- `serve_agreement_notice(p_partnership_id)` — renders the §8a notice from a template, emails + logs (SMS pending provider decision); runs manually, or from a daily pg_cron check **only when `modules.auto_notice`** — which stays false until attorney sign-off.

## Money conventions (decide once, verify, then trust)

- **Rates are stamped, never retroactive.** Statement generation copies the partnership's rates into `pay_stub_days.rate_at_time` (existing column). Config changes apply from the next generated week. The Deal tab says this out loud.
- **Six buckets** for the split: estimating = §4h transfer rows; labor = approved session wages (teamLabor convention: `people_crew_jobs` share-of-day, salary 8/0) + linked sub sheets (`laborJobSubCost`); direct = permits/rentals/est-transfer (`jobs_ledger_materials` kinds); materials = supply allocations + card allocations + tally lines; profit = revenue − labor − direct − materials; overhead = informational line only (§3e, covered by the 22%).
- **Fidelity gate before enabling postings** (WEEKLY_MONEY_PLAN precedent): the rollup RPC must reconcile with Crew P&L labor and Job Summary parts for 2–3 known jobs before `modules.profit_shares` is switched on for real.
- Weeks are Sun–Sat company weeks everywhere on this surface.

## Client surfaces

- **`/partnerships`** route, dev-gated (allowlist + ACCESS_CONTROL.md): roster + five tabs per the prototype — Deal, Agreements, Job review, Statements, Ledger. Kernels in `src/lib/partnerLedger/` (pure, tested): `weekLines.ts`, `profitSplit.ts`, `statementGuard.ts`, `agreementCountdown.ts`.
- **Partner dashboard section** (extends `DashboardSubMoneySection`): weekly ‹ › ledger card (default = current week in progress, pending-approval hours shown as no-dollar lines, 8 weeks + "Full ledger"), statement view/acknowledge/print (`buildPayStatementHtml` pattern, light-pinned), "Your jobs" (majority only), costing drill-in. Same components desktop/mobile; desktop renders statement + costing inline (prototype behavior).
- **Job close split panel** on the existing close flow, mounted only when the job carries a majority flag and the partnership has `profit_shares` on.
- Partner identity: role stays `subcontractor`; capability comes from the `partnerships` row (the `banking_attributors` pattern) — no tenth role.

## PR train (small PRs, one claim each, auto-merge)

| PR | Contents | Depends on |
|---|---|---|
| 1 | `partnerships` migration + types + dev-gated `/partnerships` route with roster + Deal tab (read/write config, change log) | — |
| 2 | Majority anchors migration + `set_job_partner_majority` + Job review tab (hours-share suggestion from Crew P&L inputs) | 1 |
| 3 | Offsets widening + `statement_acknowledgments` + `generate_partner_statement` + Statements tab (close guard, archive, ack chips, paid markers) | 1 |
| 4 | Partner dashboard card + `get_my_partner_summary/ledger/statement` + `acknowledge_partner_statement` + help guide (`see-your-partner-ledger`) | 3 |
| 5 | Six-bucket rollup + `post/reverse_partner_profit_share` + close-screen split panel + **fidelity verification notes in MIGRATIONS.md** | 2, 3 |
| 6 | `apply_bid_estimating_hours_to_job` + award hook + close-screen §4h line | 5 |
| 7 | `get_my_partner_jobs/job_costing` + partner costing UI + help guide | 2, 4 |
| 8 | Agreements tab: `sign_by` + countdown + `partner_agreement_notices` + manual `serve_agreement_notice` (auto-notice ships **default off**, gated on attorney sign-off) | 1 |

Train 0 (no code, day one): Bryan as sub-kind person with both rates, $0 farm job, offsets for back-charges, contract loaded with clock-in prompt.

## Guardrails

- Migrations: lock_timeout, idempotent, number from `origin/main`, `npm run claim -- --migration`, apply only via `supabase db push` after merge, CREATE TABLE ⇒ both read-only helpers.
- Never rebuild live RPC bodies from the repo baseline — dump live definitions first.
- RPC bodies: bare `DELETE FROM` needs `WHERE true` (pg_safeupdate trap).
- Partner RPCs: `auth.uid()` in subselect; person resolution account-link first, no name-only writes.
- E2e smoke for the partner dashboard cold-load; kernels get colocated vitest.

## Decisions taken (owner approved all defaults, 2026-08-19)

1. **Week history depth**: ‹ › over the last 8 weeks in the card; full ledger as its own view beyond that.
2. **Pending-approval hours** show on the open week as no-dollar lines.
3. **Statement generation**: manual "Generate" with the guard; cron later once trust builds.
4. **Guard override**: allowed, logged, and shown on the statement.
5. **Labor convention for the split**: bare wages (Crew P&L convention); burden multiplier revisited with real jobs.
6. **Notice delivery**: in-app + logged printable document now; email/SMS dispatch deferred until a provider decision and Texas-attorney sign-off on §8a delivery. `modules.auto_notice` stays false.
7. **Un-checking a job** hides it from the partner; postings are never touched (reversals are explicit).
8. **Farm hours** go through the same approval flow as field hours, priced at $0.

## Out of scope (exists only as off-toggles)

Weekly estimating cap + runway floor (§4a, §4c–f); W2 transition watch (§2b); SMS notice delivery. Each is a scoped later PR behind an existing config key.
