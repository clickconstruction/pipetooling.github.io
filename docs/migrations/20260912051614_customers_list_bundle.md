# 20260912051614_customers_list_bundle.sql (2026-09-12, v2.3365)

The Customers page in one round trip (fragment `docs/recent-features/v2.3365.md`):

- `public.get_customers_list_bundle()` → `jsonb` — `LANGUAGE sql STABLE SECURITY INVOKER`, `search_path = public`. Returns `projects[]` (`customer_id, n`), `bids[]` (`customer_id, n, latest`), `notes[]` (`customer_id, n` from `customer_contacts`), `estimates[]` (`customer_id, latest`), `jobs[]` (`id, customer_id, status, revenue, payments_made, created_at` for jobs with a customer), `invoices[]` (`id, job_id, status, amount`) and `payments[]` (`job_id, invoice_id, amount, paid_on`) for those jobs, and `unlinked_jobs` (count with no customer).
- INVOKER, not DEFINER: every table is read under the caller's own RLS, so the result equals what the client's 55 chunked reads returned for that user. No money math in SQL — the client's `customersListRollup` kernel still does it.
- `REVOKE … FROM PUBLIC, anon`; `GRANT EXECUTE TO authenticated, service_role`. `CREATE OR REPLACE` — idempotent. No table change, so no read-only-block calls.
