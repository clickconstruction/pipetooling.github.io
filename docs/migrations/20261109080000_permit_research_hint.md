# 20261109080000_permit_research_hint.sql (2026-11-09, v2.6784)

Research: the hint beside who pulled a permit (punch list #292, PR 2; `to-dos/permit-research/`).

## What it does

1. **`research_name_key(p_name text) → text`** (SQL, IMMUTABLE): a company name as the ledger keys it — lower-cased, the suffixes LLC, Inc, Co, Corp, Ltd, LLP, PLLC, Company and Incorporated dropped, then letters and digits only. The client's `nameKey` is its twin.
2. **`research_contact_history(p_keys text[])`** (SQL, STABLE, SECURITY INVOKER): for each distinct key, the count of `bids` whose customer (`customers.name`) or builder (`bids_gc_builders.name`) keys the same, the wins (`outcome` in won, started_or_complete), the last bid's day, and whether an open `gc_lead` prospect of that name is on the deck. The reader's own RLS applies on every table, so an estimator who cannot read `prospects` sees `on_deck` false.

No CREATE TABLE, so the four fence appliers are not run.

## Release order

Merge the PR, `supabase db push`. Nothing to deploy. The client calls the RPC untyped until the next `chore(types)` PR.
