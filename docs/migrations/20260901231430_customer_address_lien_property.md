# 20260901231430_customer_address_lien_property.sql (2026-09-01, v2.2614)

The property ledger (Lien Instruments plan, phase 1): `customer_addresses`
rows grow the property's legal identity, and jobs point at a row.

- `customer_addresses` + `county`, `legal_description`, `property_kind`
  ('' | 'residential' | 'non_residential'), `homestead`, `owner_mode`
  ('' | 'homeowner' | 'building_owner'), `owner_name`, `owner_company`,
  `owner_mailing_address` — all NOT NULL with '' / false defaults, so existing
  rows stay valid and RLS is inherited unchanged.
- `jobs_ledger` + `customer_address_id uuid REFERENCES customer_addresses
  ON DELETE SET NULL` + partial index. Existing jobs_ledger RLS covers writes.
- Additive/idempotent (`ADD COLUMN IF NOT EXISTS`); no CREATE TABLE, so no
  read-only-block re-application needed. Client is fail-soft around missing
  columns; types regenerated in the same PR after `db push`.
