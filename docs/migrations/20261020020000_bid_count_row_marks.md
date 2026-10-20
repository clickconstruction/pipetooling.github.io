# 20261020020000_bid_count_row_marks.sql (2026-10-19, v2.5654)

A count row's kind, tags and split (punch list #128, PR 2). The Pricing Workbench's next release shows each row's price split into material, sales tax and labor and lets the estimator set the row's kind, put words of their own on it, type its material as sold, give it a markup of its own and mark it tax-free. The spike kept these in the browser; they belong on the row.

## What it does

1. **Five columns on `bids_count_rows`**: `kind text` (checked: fixture, pipe, fitting, equipment, allowance; NULL = the app's guess from the name), `tags text[] NOT NULL DEFAULT '{}'`, `split_material_cents bigint` (≥ 0), `split_markup_pct numeric(7,3)` (0–1000, percent), `split_taxable boolean` (NULL = taxed when the row has material).
2. **Both copies redefined** with the five columns added to the copy's INSERT and nothing else changed, so a copy carries each row's marks: `clone_count_rows_to_bid_version` (a new bid version; its body as `20261014210000_bid_count_sources.sql` left it, `source_shares` included) and `duplicate_bid_to_service_type` (a bid copied to another trade; its body as `20261002130000` left it, `SET search_path` kept). `CREATE OR REPLACE` keeps ownership and grants; `bidCopySql.test.ts` holds both to every column.

No table is created, so the three `apply_*` fences are not called. Idempotent: columns `IF NOT EXISTS`, constraints dropped and re-added.

## Release order

Merge the client first: `rowMarksIo.ts` reads the five columns by name and treats "column does not exist" as no marks (`isNotThereYetError`), and a write before the push fails soft with a toast. Then `supabase db push`, then the types regen PR.

## Verify

Read-only on prod after the push: `select count(*) from bids_count_rows where kind is not null or cardinality(tags) > 0 or split_material_cents is not null` reads 0 until someone marks a row; make a bid version from a bid with a marked row and read the copy's row.
