# Supply house credits — what the train left

Status: **two residuals** · the train itself shipped 2026-09-16 as v2.3500–v2.3503 and was live-tested on prod · the plan, the mock-up and the four decisions live in git history at the commit that deleted `to-dos/supply-house-credits/`, and in `docs/recent-features/v2.3500.md` → `v2.3503.md`

The feature is done: a return is recorded as its own document with a negative amount and a `document_kind`, the aging table carries credits in their own column, and the two edges that would double-count a credit refuse it.

---

## 1. Pair a credit to the invoice it credits — deferred, not blocked

Was PR 5 of the plan. A nullable self-reference on `supply_house_invoices` plus showing the pairing on both documents, so a credit and its invoice read as one story.

**Deliberately not built yet.** Worth doing only once the office has used the feature for a few weeks and said whether it reaches for the field. The prod data argues for it: one live Reece row has both document numbers typed into a single field (`S123148787.003/ Return S123396858.002`) because there was nowhere else to hold the pairing.

**Size:** small, client + one additive migration.

## 2. Card refunds are added to job cost instead of taken off — a real bug, different channel

Not part of this train, found while mapping it. Refunds from pay-at-the-counter houses arrive in the bank feed as money **in**, and `summarizeCardChargeAllocations` / `sumCardChargeAllocationsForJob` in [`src/lib/jobs/cardChargeAllocationFilter.ts`](../src/lib/jobs/cardChargeAllocationFilter.ts) take `Math.abs(Number(row.amount))` of every row. So a refund allocated to a job **increases** that job's parts cost instead of crediting it.

Measured read-only against prod on 2026-09-15: **46 incoming allocations totalling $2,494.05** — Lowe's $916.96 (6), O'Reilly $768.39 (3), Home Depot $435.54 (5), plus small ones; 19 tiny Shell rows are fuel adjustments, not returns.

**Careful before fixing.** The `Math.abs` is not an accident: v2.3336 *codified* it, making bids match `fetchJobMaterialsCostSnapshot`, and [`src/lib/people/wheels.ts`](../src/lib/people/wheels.ts) records it as a knowing choice. Exactly one reader disagrees — migration `20260807060000_weekly_money_payload_mercury_sign.sql` negates instead, so refunds reduce the week's cost there. Nothing reconciles the two. **Decide the convention first**, then change every reader together the way v2.3500 did for supply invoices, or the same money will disagree between Job Summary and the weekly report.

**Size:** medium. Starts as a decision, not a patch.
