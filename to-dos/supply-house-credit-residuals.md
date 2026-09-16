---
name: Supply house credits: what the train left
group: residual
status: >
  the train shipped 2026-09-16 (v2.3500 → v2.3503, migration 20260916120000 pushed) and the form
  was live-tested on prod · two residuals remain, neither blocking
summary: >
  **What the supply-house credits train left.** The feature is done: a return is recorded as its
  own document with a negative amount and a `document_kind`, the aging table carries credits in
  their own column, and the two edges that would double-count a credit refuse it. Two things
  outlive it — pairing a credit to the invoice it credits (deferred until the office says it
  wants the field), and a separate real bug on the Mercury side where card refunds from
  pay-at-the-counter houses are *added* to job cost rather than taken off.
next: >
  Nothing urgent. The card-refund sign bug is the one worth picking up, and it starts as a
  decision about the convention, not as a patch.
size: S (pairing) · M (the card-refund convention)
blocker: >
  The pairing waits on real usage. The card-refund fix waits on an owner or dev deciding whether
  a refund nets against cost or is counted as spend — two readers disagree today.
ver: v2.3500 · 3501 · 3502 · 3503 shipped
---

# Supply house credits — what the train left

The plan, the mock-up and the four owner decisions are carried by `docs/recent-features/v2.3500.md` → `v2.3503.md`, their release notes, and git history at the commit that deleted `to-dos/supply-house-credits/`.

**Live-tested on prod 2026-09-16**, which is what the old to-do set as its deletion condition: a real credit saved on Reece against J878 stored as `document_kind='credit'` at −$1.00; the **Credits open** column appeared with the aging buckets and the $58,148.96 owed figure untouched; the missing-due-date nudge did not move; the row reopened as *Edit credit*; J878's supply cost fell by exactly a dollar. The test row was deleted through the app's own Delete. Prod back to 466 rows, 0 credits, 0 negatives.

---

## 1. Pair a credit to the invoice it credits — deferred, not blocked

Was PR 5 of the plan. A nullable self-reference on `supply_house_invoices` plus showing the pairing on both documents, so a credit and its invoice read as one story.

**Deliberately not built.** Worth doing only once the office has used the feature for a few weeks and said whether it reaches for the field. The prod data argues for it: one live Reece row has both document numbers typed into a single field (`S123148787.003/ Return S123396858.002`) because there was nowhere else to hold the pairing.

Client plus one additive migration.

## 2. Card refunds are added to job cost instead of taken off — a real bug, different channel

Not part of this train; found while mapping it. Refunds from pay-at-the-counter houses arrive in the bank feed as money **in**, and `summarizeCardChargeAllocations` / `sumCardChargeAllocationsForJob` in [`src/lib/jobs/cardChargeAllocationFilter.ts`](../src/lib/jobs/cardChargeAllocationFilter.ts) take `Math.abs(Number(row.amount))` of every row. So a refund allocated to a job **increases** that job's parts cost instead of crediting it.

Measured read-only against prod on 2026-09-15: **46 incoming allocations totalling $2,494.05** — Lowe's $916.96 (6), O'Reilly $768.39 (3), Home Depot $435.54 (5), plus small ones. The 19 tiny Shell rows are fuel adjustments, not returns.

**Decide the convention before touching a reader.** The `Math.abs` is not an accident: v2.3336 *codified* it, making bids match `fetchJobMaterialsCostSnapshot`, and [`src/lib/people/wheels.ts`](../src/lib/people/wheels.ts) records it as a knowing choice. Exactly one reader disagrees — migration `20260807060000_weekly_money_payload_mercury_sign.sql` negates instead, so refunds correctly reduce the week's cost there. Nothing reconciles the two. Once the convention is settled, change every reader together the way v2.3500 did for supply invoices, or the same money will disagree between Job Summary and the weekly report.
