# 20260823163821_partner_summary_company_name.sql (2026-08-23, v2.2170)

**Purpose:** the partner statement's letterhead prints the deal's company name
("Partner account · Herber Electric") and "partner since" from the deal's real
start date instead of inferring it from the oldest ledger week.

**Change:** `CREATE OR REPLACE FUNCTION public.partner_summary_payload(uuid)` —
identical to 20260821150000's body plus two keys in the returned jsonb:
`company_name` (`NULLIF(partnerships.company_name, '')`) and `started_on`
(`partnerships.started_on`). `get_my_partner_summary` and
`get_partner_summary_as` are thin wrappers over it and are untouched.

**Safety:** no DDL on tables, no RLS change, SECURITY DEFINER + grants re-asserted
exactly as before; idempotent (CREATE OR REPLACE). Old clients ignore the extra
keys; the new client (v2.2170) treats them as optional (null when absent), so
client and migration can deploy in either order.
