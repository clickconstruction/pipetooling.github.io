# Fragility remediation: Stripe mode, payments_made invariant, person identity

---
file: docs/FRAGILITY_REMEDIATION_PLAN.md
type: Engineering / Migration plan
purpose: Staged, tested plan to fix three fragility clusters — (A) Stripe test/live mode being per-request and unrecorded (webhook ignores livemode; cross-mode void orphans invoices; cross-mode create wipes the other mode's customer id), (B) jobs_ledger.payments_made having many writers and no DB invariant, (C) finishing the person-identity migration (docs/PERSON_IDENTITY_PLAN.md phases D–E) plus five tooling bugs found in review. Written 2026-07-30 from a code-level audit of main @ 0dc004d6.
audience: Developers, AI Agents
last_updated: 2026-08-01
---

## Ground rules (apply to every step)

- One step = one PR (ship-small). Migrations: `supabase migration new`, `SET lock_timeout = '3s';` preamble, idempotent DDL, numbered from `origin/main`, applied **only** with `supabase db push` after merge (CLAUDE.md rule). No staging — every push is a prod event; prefer quiet hours for anything touching hot tables.
- **Testing gates, in order, per step**: (1) new/extended vitest unit tests for any changed kernel; (2) `npm run typecheck && npm run lint && npm test` green locally; (3) CI `checks` green (auto-merge); (4) for migrations: post-push read-only verification query, recorded in this doc's status log; (5) for edge functions: redeploy + a scripted verification (test-mode Stripe E2E once A2 lands makes this safe); (6) audits re-run after each phase of B and C (they are the invariant detectors).
- Client/migration ordering: additive columns are safe to push first; RPC behavior changes deploy client-first when old clients would misread (noted per step).
- Docs ship with each PR: RECENT_FEATURES + releaseNotes (same v2.NNN), MIGRATIONS.md per migration, EDGE_FUNCTIONS.md per function change, plus corrections to BILLING_FLOWS.md / PERSON_IDENTITY_PLAN.md as steps land.

## Decisions (owner-confirmed defaults; flag before executing the step if changing)

1. **A1 backfill**: existing Stripe-linked invoice rows are stamped `'live'`. Mislabels fail safe (stuck row a dev corrects, never a deletion).
2. **A2 webhook policy**: mode-match — test events may only touch test-mode rows; live only live. Dev test flows keep working.
3. **B2 historical payments**: synthesize one tagged `jobs_ledger_payments` row per pre-2026-03 job (`payment_type='historical'`) so `SUM(rows)` becomes universally authoritative.
4. **C2 contracts tables**: `person_contract_assignments`/`_documents` get person_id columns + triggers (B-style migration) and ride Phase E.

---

## Workstream A — Stripe mode integrity

Principle: **the invoice row is the authority on its own mode**. Findings this fixes (file:line refs from the 2026-07-30 audit): webhook never reads `event.livemode` and inits its key test-first (`stripe-webhook/index.ts:181`); `void-stripe-invoice-for-revert` deletes the DB row on "No such invoice" (`:275–284`); `create-stripe-invoice` clears + replaces the opposite mode's `customers.stripe_customer_id` (`:336–357`); two ungated client pref reads (`AgreedWriteDownModal.tsx:132`, `JobFormModal.tsx:286`); `mark_invoice_paid_from_stripe` EXECUTE granted to anon/authenticated (baseline L44627).

| Step | Status | Change | Test/verify |
|---|---|---|---|
| **A0** | ✅ DONE v2.1110 | Migration: REVOKE EXECUTE on `mark_invoice_paid_from_stripe` (and audit `complete_job_collect_payment_flow_for_invoice`) from anon/authenticated; service_role keeps. | Grep confirms webhook-only callers; post-push `has_function_privilege()` query for authenticated = false; webhook test-mode paid event still applies (service role). |
| **A1** | ✅ DONE v2.1114 | Migration: `jobs_ledger_invoices.stripe_mode` text CHECK ('live','test') + `stripe_webhook_events.livemode` boolean; backfill live where `stripe_invoice_id IS NOT NULL`. Edge: `create-stripe-invoice` stamps mode. | Post-push: count NULL-mode rows with stripe ids = 0; create a test-mode invoice (dev) → row has `stripe_mode='test'`. |
| **A2** | ✅ DONE v2.1115 | Webhook: `stripeWebhookSecretsOrdered()` → (secret, mode) pairs; verified secret's mode = event mode, cross-checked vs `event.livemode`; invoice events require row-mode match (mismatch → 200 `applied:false, reason:'mode_mismatch'`); NULL-mode rows self-heal from the verified mode; `stripeInitKey` + credit-note retrieval use the event's mode. | Test-mode E2E: create → send → pay in Stripe test dashboard → webhook applies to the test row; manually fire a test event at a live row id → `mode_mismatch` in edge logs, row untouched. |
| **A3** | ✅ DONE v2.1116 | Row-bound functions (`void-stripe-invoice-for-revert`, `send-stripe-invoice`, `get-stripe-invoice-details`, both OOB, `stripe-invoice-agreed-write-down`) resolve mode from the row; body `stripe_mode` validated (mismatch → 409, no side effects), fallback only for NULL-mode rows. Void's `noop_missing` delete becomes safe (mode now guaranteed right). | Test-mode E2E void path: draft delete, open void, and a deliberately wrong body mode → 409 with row intact. |
| **A4** | ✅ DONE v2.1117 | Migration: `customers.stripe_customer_id_test`; `create`/`preview` use mode-appropriate column, never clear the other. Backfill: existing values are live. | Dev test-mode create for a customer with a live id → live id unchanged, test id populated. |
| **A5** | ✅ DONE v2.1118 | Client: gate the two ungated pref reads via `stripeModeForBillingFromRole`; flip `defaultStripeBillingMode()` omitted-param default to 'live'; unit tests for `billingStripeModePref` + mode resolution. | New vitest files; grep proves zero ungated `getBillingStripeModePref()` call sites outside the role gate. |

## Workstream B — payments_made invariant

Principle: **rows are the truth; the column becomes a trigger-maintained cache**. Landmine: `jobs_ledger_payments` (2026-03) had no backfill — jobs paid earlier legitimately have `payments_made > 0` with zero rows; blanket recompute would zero real money. Writers today: 6 incrementing RPCs (internally consistent), 2 recompute RPCs, JobFormModal overwrite (`persistBillingSlice`, the only diverging writer, non-transactional delete-all+reinsert).

| Step | Status | Change | Test/verify |
|---|---|---|---|
| **B1** | ✅ DONE 2026-07-30 (script committed 2026-08-01) | `scripts/audit-payments-made-drift.sql`: classify jobs — consistent / drift (rows≠column) / historical (no rows, column>0). Read-only; run and record counts here. | Script reviewed; results recorded in status log; gates B2/B3. |
| **B2** | ⏭️ SKIPPED | ~~Migration: synthesize tagged historical rows~~ **SKIPPED — unnecessary.** The 2026-07-30 B1 run found all 771 jobs consistent (zero drift, zero historical no-row jobs); the feared 2026-03 backfill gap never materialized in practice. | B1 audit output recorded in the status log. |
| **B3** | ✅ DONE v2.1119 | One migration, atomically: `recompute_jobs_ledger_payments_made(p_job_id)` + AFTER I/U/D trigger on `jobs_ledger_payments`, **and** `CREATE OR REPLACE` of all incrementing RPCs to stop writing the column (trigger + increment would double-count; must ship together). Status-promotion logic unchanged (reads post-trigger value in-tx). | New SQL exercised via test-mode payment paths (Mark Paid modal, AR allocation, webhook-paid); B1 audit stays clean; unit tests for any client mirror kernels touched. |
| **B4** | ✅ DONE v2.1120 | Client: `persistBillingSlice`/`createJob` stop writing `payments_made`; fix the sum-vs-`amount>0`-filter asymmetry. Safe either order vs B3 (client's stale write precedes row rewrite; trigger converges). | Vitest on `jobFormAutosaveSlices` payload builders; manual edit-job payment add/remove; audit clean. |
| **B5** | ✅ DONE v2.1121 | Client: billing slice goes diff-based (delete only hydrated-then-removed ids, update in place, insert new, leave unknown rows) — fixes the webhook-mid-edit deletion race and stops the new-UUID `payment_added` activity noise. | Vitest diff kernel (new `lib/jobs/paymentRowsDiff.ts` + tests); manual: pay a test invoice via webhook while the form is open, autosave, row survives. |
| **B6** | ✅ SHIPPED v2.1575 (migration `20260811200048`) — the gate audit caught a REAL incident first: dual Stripe events raced both the RPC and the B3 recompute trigger (jobs #925/#921, duplicate rows + half-sum pm). Shipped as guard + lock-first recompute + FOR UPDATE in all five RPCs + row repair. | Migration (after B4 confirmed deployed): BEFORE UPDATE guard on `jobs_ledger.payments_made` rejecting non-recompute writers (GUC set by the recompute fn — same pattern as read-only stmt triggers). | Post-push: direct UPDATE as dev → rejected; payment paths still work; audit clean after a week of real use. |

## Workstream C — person identity: C-tail, D, E

DB substrate is done (resolver `resolve_pay_person_id`, INSERT triggers on 10 tables, `people_labor_job_assignees` junction, `list_people_pay_flags` already returns person_id). Remaining: reader flips, writer flips, enforcement — plus five tooling bugs that bite **today**.

| Step | Status | Change | Test/verify |
|---|---|---|---|
| **C0.1** | ✅ DONE v2.1111 | `combinePeople.ts` `PERSON_ID_TABLES` stale post-B2 — add the five B2 tables. | Extend `combinePeople` tests; grep table list vs migration inventory. |
| **C0.2** | ✅ DONE v2.1112 | `cascadePersonName.ts` add `person_offsets`, `hours_reviewed`. | Extend tests. |
| **C0.3** | ✅ DONE v2.1113 | `PersonOffsetFormModal` edit path re-resolves person_id when person_name changes. | Kernel test where extractable; manual offsets edit. |
| **C0.4** | ✅ DONE v2.1113 (migration `20260730164728`) | Migration: triggers become `BEFORE INSERT OR UPDATE OF person_name`, re-resolving via `COALESCE(resolve_pay_person_id(NEW.person_name), NEW.person_id)` when the name changed and the client didn't explicitly set an id. Renames/combines self-heal at the DB. | Post-push: rename a test roster person → person_id stable across pay tables (read-only check). |
| **C0.5** | ✅ DONE 2026-07-30 (audit rerun recorded) | Extend `scripts/audit-pay-person-id-phase0.sql` with junction coverage; re-run; record fill rates in PERSON_IDENTITY_PLAN.md. | Audit output recorded; gates C2/C3. |
| **C1** | 🔶 MOSTLY DONE — C1-1…C1-3 shipped v2.1122–v2.1127; C1-5 deliberately skipped; **open: C1-6** (`teamLabor` + `useDashboardMyTeamSectionState` name-keyed `people_hours` reads); **C1-7** (PeopleReviewTab `assigned_to_name` read) was closed in **v2.1266** (junction-first via `people_labor_job_assignees`, name-split fallback, kernel `laborJobPersonMatch.ts`) | Reader flips, one surface per PR, name-fallback retained: the seven `list_people_pay_flags` consumers → person_id keys; `salaryUiActive`/`salaryPayConfigGate` via `people.account_user_id`; `teamLabor` `people_hours` joins; `useDashboardMyTeamSectionState` name-IN; `PeopleReviewTab` delimited-string read → junction. | **Every flip PR includes a before/after totals check on its surface** (pure re-keying must not shift a dollar or hour) + existing kernel tests extended. |
| **C2** | 🔲 OPEN (D0 unblocked by the zero-duplicates audit; remaining roster decisions: "MIke Rodriguez"/"Edgar") | Writers: D0 migration (partial unique indexes on person_id keys, preceded by duplicate audit + Combine cleanup); then per-surface `onConflict` flips (`usePayConfig`, hours writes, crew writes, pay-stub generation, `hours_reviewed`, display order); sub-labor picker selects people (string stays as display; junction authoritative). Contracts tables get a B-style migration (decision 4). | D0 preceded by a zero-duplicates audit; per-surface manual smoke + totals checks; audit fill rates → ~100%. |
| **C3** | 🔲 OPEN (audit-gated, after C2) | Enforce (weeks later, audit-gated): per-table NOT NULL + FK migrations; id-based unique constraints replace name-based; retire `cascadePersonNameInPayTables`; strip reader fallbacks. Point of no return — gated on clean audits across ≥2 real payroll cycles. | Orphan audit = 0 before each table's migration; payroll totals unchanged across the flip week. |

## Sequencing

```
Done:      A0–A5 · B1–B5 (B2 skipped) · C0.1–C0.5 · C1-1…C1-3 (C1-5 skipped)
Done since: C1-7 (PeopleReviewTab junction read) — shipped v2.1266
Next:      B6 (payments_made hard guard — gated on a fresh audit after B4/B5 bake, due ~2026-08-06)
           C1-6 (teamLabor + useDashboardMyTeamSectionState people_hours name joins)
Then:      C2 writer flips (D0 unblocked; pending owner roster decisions) → C3 enforcement (audit-gated)
```

> Workstreams A and B complete; C rides [`to-dos/person-identity-phase-e.md`](../to-dos/person-identity-phase-e.md) (2026-09-05 sweep).

## Status log

- 2026-08-11 — **B6 shipped** (v2.1575, migration `20260811200048`) — and the gate worked exactly as designed: the overdue re-audit found **2 drifted jobs** (#925 billed, #921 paid; `payments_made` at exactly half their row sums, $1,530.80 total). Diagnosis from the rows themselves: duplicate Stripe payment rows created **milliseconds apart** (2026-08-04 20:17:22.203/.218 and 2026-08-08 19:09:23.980/.987) — Stripe's dual `invoice.paid`+`invoice.payment_succeeded` events (distinct ids, dedupe passes both) raced `mark_invoice_paid_from_stripe`, and the **B3 recompute trigger itself raced**: each transaction summed on a snapshot that saw only its own row, and the loser's stale half-sum won the pm write. The stored pm values were coincidentally the TRUE amounts; the ROWS were doubled (row-derived surfaces showed doubles). Shipped in one migration: lock-first recompute (job-row `FOR UPDATE` before summing, transaction-local GUC `pipetooling.payments_recompute`), the `jobs_ledger_payments_made_guard` BEFORE-UPDATE trigger, `FOR UPDATE` locks in all five payment RPCs (sourced from the CURRENT bodies — note `apply_mercury_bank_payment_allocations` was redefined by `20260801020903` post-B3), and the repair DELETE of the two duplicate rows. Post-push verification: audit reports all-consistent; guard rejects a direct pm UPDATE (transactional test, rolled back). **Workstream B fully complete.**

- 2026-08-01 — **BILLING_FLOWS.md caught up to workstream A** (docs-only): the stale pre-A narrative ("no test/live mode column", "mode is per-request", ungated pref reads, void-deletes-the-row) rewritten to the invoice-row-is-authority model (v2.1114–v2.1118); optimization gotchas 9/10/19 marked fixed (B5/B3+B4/A5). Ground-rule "docs ship with each PR" debt from the A-steps, now cleared.

- 2026-08-01 — **B1 audit script committed** (`scripts/audit-payments-made-drift.sql`): the read-only auditor the 2026-07-30 B1/B3 runs used, now in the repo so the B6 gate ("fresh audit after a week of real use" — due ~2026-08-06) has its detector on record. No behavior change.

- 2026-07-30 (later) — **Workstream A COMPLETE**: A3 (v2.1116, seven functions row-authoritative; E2E-verified against prod — wrong-mode 409 with row untouched, omitted-mode 200 via row mode), A4 (v2.1117, migration `20260730173258`, per-mode customer ids; column verified via psql), A5 (v2.1118, ungated pref reads closed, omitted-mode default → live, 6 new unit tests). **Workstream B behavior changes COMPLETE**: B3 (v2.1119, migration `20260730174929`, trigger + atomic five-RPC rewrite; post-push audit still 771/771 exact), B4 (v2.1120, client stops writing the column), B5 (v2.1121, diff-based payment persistence via tested `paymentRowsDiff` kernel + `hydratedPaymentIdsRef`; RLS upsert path verified against prod). **Remaining**: B6 (hard guard — deliberately gated on B4/B5 baking in real billing use; ship with a fresh audit), C1 reader flips (audit-cleared), C2/C3 (gated on C1 + owner roster decisions: Kyle duplicate, Behar variant, Mike Z / MIke Rodriguez / Edgar).

- 2026-07-30 — **A2 shipped + deployed** (v2.1115): webhook mode-matches events to rows, records `stripe_webhook_events.livemode`, self-heals NULL-mode rows, credit-note retrieval uses the event-mode key. **B1 audit run (read-only, prod, psql)**: all **771 jobs consistent** — `payments_made` $714,811.48 = row sums exactly; **zero drift, zero historical no-row jobs**; zero negative/zero-amount rows. → **B2 is unnecessary (skipped)**; B3 proceeds with no data migration. (322 paid jobs with row-sum &lt; revenue is informational — write-downs / bid-value revenue semantics.) **C0.5 audit run**: fill rates near-100% (`people_pay_config` 24/24, `people_crew_jobs` 1428/1428, `people_crew_bids` 169/169, `person_offsets` 29/29, `people_hours` 1596/1650 — the 54 NULLs are the known frozen Feb–Mar historical rows; `pay_stubs` 253/256, `pay_stub_days` 1771/1792); **zero Phase-D unique-key conflicts → D0 unblocked**; junction covers 45/56 sheets. Data-hygiene items for the owner: duplicate active roster name **"Kyle"** (×2 — the one live ambiguity; combine or rename), Combine-people candidate "Behar Kraja (Rough In)", roster gaps "Mike Z" / "MIke Rodriguez" / "Edgar".

- 2026-07-30 — **A0 shipped + verified** (v2.1110, migration `20260730160048`): both webhook RPCs return 42501 to anon/authenticated via PostgREST; service-role path unchanged. **C0.1 shipped** (v2.1111): Combine repoints all ten tables. **C0.2 shipped** (v2.1112): rename cascade loops the shared inventory. **C0.3+C0.4 shipped** (v2.1113, migration `20260730164728`): `set_person_id_on_write` on all ten tables. **A1 shipped** (v2.1114, migration `20260730165312` + `create-stripe-invoice` redeploy): `stripe_mode` recorded. **Workflow caution learned**: `supabase db push` applies EVERY pending local migration file, not just merged ones — the v2.1113 push swept the then-unmerged A1 draft onto prod (additive-only, realigned by merging within the hour). Never draft migrations inside `supabase/migrations/` while another push is pending; draft in a scratchpad and move the file in on its branch.
- 2026-07-30 — Plan written from three parallel code audits (Stripe plumbing, payments_made writers/readers, identity migration state). Additional findings vs docs: `mark_invoice_paid_from_stripe` callable by any authenticated user; cross-mode create wipes `customers.stripe_customer_id`; ~9 DB writers of payments_made (not 3); `jobs_ledger_payments` never backfilled at creation; `combinePeople.PERSON_ID_TABLES` stale post-B2; contracts tables have no person_id at all. Execution starting with A0 + C0.
