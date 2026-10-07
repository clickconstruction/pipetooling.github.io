# 20261007140000_county_source_map.sql (2026-10-07, v2.4778)

Which court, follow-up ([v2.4778](../recent-features/v2.4778.md)): `customer_addresses.county_source` admits `map`, so the nightly precinct classification can fill a blank county from the court area the point fell in. The check constraint is dropped and re-added with the new value; the column comment names the rung.

Locks: `DROP CONSTRAINT` / `ADD CONSTRAINT … CHECK` take ACCESS EXCLUSIVE on `customer_addresses` for the time of a full-table check of a short column; `SET lock_timeout = '3s'` first. Idempotent.

## Order

Merge, `supabase db push`, then `supabase functions deploy court-precinct-nightly`.
