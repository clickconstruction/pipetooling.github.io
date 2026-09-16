---
name: Supply house credits: what the train left
group: residual
status: >
  the train shipped 2026-09-16 (v2.3500 → v2.3503, migration 20260916120000 pushed) and the form
  was live-tested on prod · the card-refund sign bug shipped the same day (v2.3519 client,
  v2.3525 SQL readers) · one residual remains, not blocking
summary: >
  **What the supply-house credits train left.** The feature is done: a return is recorded as its
  own document with a negative amount and a `document_kind`, the aging table carries credits in
  their own column, and the two edges that would double-count a credit refuse it. One thing
  outlives it — pairing a credit to the invoice it credits, deferred until the office says it
  wants the field. The card-refund sign bug found alongside it shipped as v2.3519 / v2.3525.
next: >
  Nothing urgent. Ask the office in a few weeks whether they reach for a pairing field.
size: S (pairing)
blocker: >
  The pairing waits on real usage.
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

## 2. Card refunds — shipped

Found while mapping this train; shipped the same day as **v2.3519** (every client reader nets a refund, the overhead engine spreads a negative office day) and **v2.3525** (the six SQL readers). The release notes and `docs/recent-features/` carry the record.
