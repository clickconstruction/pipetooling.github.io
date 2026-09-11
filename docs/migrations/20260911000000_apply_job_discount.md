# 20260911000000_apply_job_discount.sql (2026-09-11, v2.3268)

Bill Customer → **Add discount** (fragment `docs/recent-features/v2.3268.md`):

- **`apply_job_discount(p_job_id, p_name, p_pct, p_dollars, p_basis_positions, p_reason, p_draft_amounts, p_summary)`** → `jsonb {ok, fixture_id, revenue}` — SECURITY DEFINER, office roles + `can_read_job_activity(job, false)`. One transaction: inserts the discount row last (`line_kind = 'discount'`, count 1, `line_unit_price = −p_dollars`, `discount_pct`, `discount_basis_positions`, `discount_reason`); recomputes `jobs_ledger.revenue` the way the client save does (named rows' `count × price` plus un-voided hazmat fees); re-prices the given **ready_to_bill** drafts of this job from `p_draft_amounts` (`[{invoice_id, amount}]`, client-computed with the shared kernel); logs a financial `discount_added` event (summary from `p_summary`, detail carries `source: 'bill_customer'`). The elastic primary remainder resizes through the ensure RPC as before.
- `EXECUTE` to `authenticated` only.

Apply order: **push before or with the client** — the RPC is additive and the old client never calls it; the new client's strip errors visibly ("function not found") until the push lands. No edge function.
