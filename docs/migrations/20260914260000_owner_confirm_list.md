# 20260914260000_owner_confirm_list.sql (2026-09-15, v2.3447)

Owner of record, PR 1 — the Fix-ups list that looks itself up ([`docs/recent-features/v2.3447.md`](../recent-features/v2.3447.md)).

- **`customer_addresses.owner_confirmed_at timestamptz NULL`** / **`owner_confirmed_by uuid NULL → users(id)`**: a person looked at the owner of record and pressed Use (the Fix-ups list; PRs 2–3 add the job form and Bill Customer). Backfill: every row already carrying an `owner_name` or `owner_company` gets `owner_confirmed_at = COALESCE(updated_at, now())` — those were typed by hand.
- **`list_jobs_owner_to_confirm()`** (SECURITY DEFINER, office gate = `list_lien_notice_months`: dev · assistant-like · master; REVOKE PUBLIC/anon, GRANT authenticated): one row per GC job — GC set, or a builder in the customer row (a customer that is the GC on some other job) with no GC — in waiting · working · ready_to_bill · billed with at least one approved clock session, where NOT (`has_owner` AND `owner_confirmed`). `has_owner` is the desk's expression copied verbatim (job override mailing, or record mailing + a name/company); `first_work_month` is the earliest approved month and `first_deadline` its `lien_notice_deadline()`. Returns job numbers, address, status, customer and GC ids + names, `customer_address_id`, `property_kind`.

Additive and idempotent. Apply order: merge → `supabase db push` → regenerate `src/types/database.ts` (the two columns and the RPC were hand-added). The old client ignores the columns; the chip only appears once the RPC exists.
