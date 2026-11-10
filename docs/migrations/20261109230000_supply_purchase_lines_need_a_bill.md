# 20261109230000_supply_purchase_lines_need_a_bill — a purchase line needs its bill (v2.6824, punch list #298)

**File**: `supabase/migrations/20261109230000_supply_purchase_lines_need_a_bill.sql`
**Amends**: the view from [`20261109170000_supply_paper_lines`](./20261109170000_supply_paper_lines.md)

## What it changes

`supply_papers.invoice_id` is `ON DELETE SET NULL`, so a bill deleted from a house's list left its paper standing with no bill — and `supply_purchase_lines` still counted that paper's lines as purchases. Found on the 1b live walk of 2026-11-09, where the ZZ test bill was left in place rather than orphan its paper.

The view now adds `p.invoice_id IS NOT NULL` to its `WHERE`: an invoice or credit paper counts only while a bill on file owns it. A paper whose bill is gone keeps its rows (nothing is deleted) and drops out of every count and chart until a bill owns it again. Same columns in the same order, so `CREATE OR REPLACE VIEW` holds and nothing that reads the view changes; the comment names the rule.

The kernel carries the same rule for the sweep and the screens: `countsAsPurchase({ kind, checkState, invoiceId })` in `src/lib/materials/lines/paperChecks.ts`, tested in `paperChecks.test.ts`.

## Why not a cascade

A cascade would delete the paper and its lines with the bill, and the lines are the record of what the paper printed — worth keeping when a bill is deleted by mistake and recorded again (the sweep can then re-own the paper by its number). Keeping the rows and dropping them from the count is the cheaper mistake to undo.

## Deploy

`supabase db push` after the merge; no client calls ahead of it (the view's shape is unchanged), so the order against the Pages deploy does not matter.
