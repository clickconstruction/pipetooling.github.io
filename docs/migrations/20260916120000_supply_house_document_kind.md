# 20260916120000_supply_house_document_kind

**Version** `20260916120000` · **Release** v2.3502 · **Date** 2026-09-16

## What it does

Adds `supply_house_invoices.document_kind` (`invoice` default, or `credit`) and replaces `supply_house_invoices_amount_check` with a rule that keeps today's behaviour for invoices and permits a negative amount only on a credit.

```sql
CHECK (
  (document_kind = 'invoice' AND amount >= 0) OR
  (document_kind = 'credit'  AND amount <  0)
)
```

## Why

A return from a supply house is a numbered document the house issues. Until now the `amount >= 0` constraint meant it had nowhere to live, and the office recorded returns three ways, all of them lossy: netted into an invoice's amount, zeroed out, or left positive on a job that kept nothing.

A credit is stored **negative** because job allocations are percentages — `get_invoice_amounts_for_jobs` and `get_invoice_allocation_lines_for_jobs` are raw signed sums of `amount * pct / 100`, so a credit reaches the right job with no server change at all. `document_kind` exists so a credit is a deliberate choice rather than a slipped minus key: the form types a positive number and derives the sign from the kind.

## Safety

- **Additive and idempotent.** Column added with `IF NOT EXISTS`; both constraints are dropped and re-added.
- **Backward compatible.** The old client never sends `document_kind`, and its inserts default to `invoice` under the unchanged `amount >= 0` rule — so this is safe to push ahead of the client (and it must be, or picking Credit would fail against an old database).
- **Pre-flighted read-only against prod on 2026-09-15:** all 466 rows satisfy the new constraint under the default, and the lowest amount on file is `$0.00`, which still passes.
- No `CREATE TABLE`, so the read-only write-block calls do not apply.
- Adding a `NOT NULL` column with a constant default does not rewrite the table on PG 11+, so the `lock_timeout = '3s'` guard should never be reached.

## Order

The readers were hardened first, in v2.3500 and v2.3501, while the constraint still made negatives impossible. This migration opens the gate; the form follows in v2.3503.

## After pushing

```bash
supabase db push
npm run gen-types:linked
npm run check:migration-drift
```
