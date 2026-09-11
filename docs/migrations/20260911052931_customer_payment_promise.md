# 20260911052931_customer_payment_promise.sql (2026-09-11, v2.3283)

"Their Word" PR 2 — the customer names the date themselves (fragment `docs/recent-features/v2.3283.md`). Requires `20260911051414_job_payment_promises.sql` (v2.3280).

- **`add_customer_payment_promise(p_customer_id uuid, p_job_ids uuid[], p_date date, p_note text)`** → jsonb `{ jobs, promisedDate }`. For each job the customer pays for (`customer_id` or `gc_customer_id` = the customer; others skipped): one `job_payment_promises` event (`source 'customer'`, `channel 'portal'`, `heard_by NULL`) and an upsert of `job_promised_pay_dates` with `marked_by NULL`, under the `app.promise_event_written` flag so the v2.3280 trigger stays quiet. **EXECUTE granted to `service_role` only** (revoked from PUBLIC / anon / authenticated) — the caller is `submit-portal-request` with the service key; the portal token is the customer.
- **`list_job_promised_pay_dates()`** replaced (body lifted from the live 20260821110000 definition): same gate and shape, plus `markedByName = 'customer'` and a new `source` key (`'office' | 'customer'`) when the row is unmarked and its latest matching event is customer-sourced.

Apply order: client first (the strip fails soft with a polite error until the RPC exists; the chip ignores the new `source` key), then `supabase db push`, then deploy `submit-portal-request` and `customer-portal`. Validated on the scratch Postgres 16 replay (scenario in the fragment).
