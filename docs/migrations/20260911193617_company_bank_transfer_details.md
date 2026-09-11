# 20260911193617_company_bank_transfer_details.sql (2026-09-11, v2.3308)

Bank transfer details on the customer statement (fragment `docs/recent-features/v2.3308.md`):

- New table `company_bank_transfer_details` — one row (`id text PRIMARY KEY DEFAULT 'default' CHECK (id = 'default')`): `payee_name`, `bank_name`, `bank_note`, `routing_number`, `account_number`, `account_kind` (default `Checking`), `beneficiary_address`, `check_mailing_address` (all `text NOT NULL DEFAULT ''`), `show_on_portal boolean NOT NULL DEFAULT true`, `updated_by uuid → users` (SET NULL), `updated_at timestamptz`. The repo is public, so the numbers live only here.
- RLS: SELECT `is_office_staff()` (dev · master · assistant-like); INSERT / UPDATE / DELETE `is_master_or_dev()`. `service_role` gets ALL — the `customer-portal` edge function reads the row with it and returns it only when `show_on_portal`. Ends with both read-only-block calls (CREATE TABLE).
- Idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS` before each policy). No data — the office enters the row at Settings → Company → Bank transfer details.
