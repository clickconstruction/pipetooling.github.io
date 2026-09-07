# 20260907090000_customer_address_parcel_record.sql (2026-09-07, v2.3004)

Customer properties train, PR 1: provenance for the property record the new `property-lookup` edge function proposes from the Texas statewide parcel roll.

Adds to `customer_addresses` (all additive, idempotent, no CREATE TABLE):

- `county_source text NOT NULL DEFAULT ''` with a CHECK over `'' | parcel | geocoder | city | manual` — which rung of the county ladder filled `county`.
- `parcel_id`, `parcel_source`, `parcel_tax_year` (`text NOT NULL DEFAULT ''`) — the appraisal-district property ID, the source district as the roll names it ("Comal Appraisal District"), and the roll's tax year, so the sheet can print `Comal Appraisal District · 2025 · Prop ID 178402` under the legal description and remind that the roll lags sales.
- `parcel_looked_up_at timestamptz` — when the lookup last ran for the row.

Apply order: either side — the client reads the columns with `select('*')` and writes them only from the record panel; before the push the row save fails with a column error only if a person opens the legal panel and saves, so push promptly after merge. No RLS change (row policies from `20260817224600_customer_addresses.sql` cover the new columns).
