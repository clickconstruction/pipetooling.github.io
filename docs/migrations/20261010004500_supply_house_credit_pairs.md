# 20261010004500_supply_house_credit_pairs.sql (2026-10-09, v2.5035)

Supply house credits, the owner's call of 2026-10-09: a credit pairs to the invoice it credits. `supply_house_invoices.credits_invoice_id` points a credit memo at the same house's invoice it takes money off. The office sets it with the credit form's **Credits invoice…** pick. The house's invoice list then shows the pair on both rows: *Credits S123148787.003* on the credit, *Credited by S123396858.002 (−$120.00)* on the invoice.

## What it does

1. **`credits_invoice_id`**, a nullable `uuid` that references `supply_house_invoices(id)` with `ON DELETE SET NULL`. A deleted invoice unpairs its credits.
2. **`supply_house_invoices_credits_invoice_idx`**, a partial index on the paired rows, for the foreign key and for an invoice's *Credited by* read.
3. **`supply_house_invoices_credits_invoice_check`**: only a credit carries a pair (`document_kind = 'credit'`), and never to itself. It is dropped and added again, so the migration is idempotent.
4. **`supply_house_invoices_credit_pair_guard()`** with its trigger, `BEFORE INSERT OR UPDATE OF credits_invoice_id, supply_house_id`. The paired row must be an invoice of the same house; anything else is refused with *A credit pairs only to an invoice from the same supply house.* (`check_violation`). Moving a paired credit to another house is refused the same way. The function is SECURITY INVOKER, and the office that writes this table reads every row of it. Its EXECUTE is revoked from `PUBLIC`, `anon` and `authenticated`, as the other trigger functions' is.

Additive: no new table, so no read-only or digital-twin fences to re-apply. The client sends the column only when the pair changes, so a save before the push names no new column. The reads are `select('*')`, so the column appears once it exists.

## Prod on 2026-10-09

There are 501 rows, of which 1 is a credit. One invoice dated Apr 6, 2026 holds an invoice and its return in one number field: *S123148787.003/ Return S123396858.002*, netted to $2,496.94. This migration does not touch it. The office splits it by hand later: the invoice to its own number and amount, then a credit with its own number, paired to it. The guide says how.

## Checked on a local Postgres 15

The run was on the session's own server, its `data_directory` checked before the first statement. The stand-ins were `supply_house_invoices` with its kind and amount check, and the roles `anon` and `authenticated`. The migration was applied twice. A credit paired to its house's invoice. These were each refused:
- an invoice of another house;
- another credit;
- an invoice carrying a pair;
- a credit paired to itself;
- a paired credit moving to another house.

Other edits to a paired credit went through, and deleting the invoice unpaired the credit.

## The lock note

`SET lock_timeout = '3s';` is first. The column is a catalog change. The foreign key, the check (a scan of 501 rows), the index and the trigger take short locks on `supply_house_invoices`, which only the office writes.

## Verify after the push

1. **The column, the index and the check.** `SELECT count(*) FROM information_schema.columns WHERE table_name = 'supply_house_invoices' AND column_name = 'credits_invoice_id';` gives `1`. `SELECT count(*) FROM pg_indexes WHERE indexname = 'supply_house_invoices_credits_invoice_idx';` gives `1`. `SELECT count(*) FROM pg_constraint WHERE conname = 'supply_house_invoices_credits_invoice_check';` gives `1`.
2. **The guard.** `SELECT tgenabled FROM pg_trigger WHERE tgname = 'supply_house_invoices_credit_pair_guard';` gives `O`.
3. **Nothing paired yet.** `SELECT count(*) FROM public.supply_house_invoices WHERE credits_invoice_id IS NOT NULL;` gives `0`.

Then run `npm run check:migration-drift` and the types PR for the column.

## Status

Merged as v2.5035 (#5108) and pushed on 2026-10-09 at 10:43 UTC (drift 819 of 819; GC MODE's 006000 rode the same push). Verified read-only: `credits_invoice_id` present, `supply_house_invoices_credit_pair_guard` in place, nothing paired yet. Types: PR #5111.

## Rollback

A one-off migration drops the trigger, its function, the check, the index and the column. The client sends the column only on a change and reads `*`, so it keeps working without it.
