# 20260906140000_move_bid_schedule_blocks_to_job.sql (2026-09-06, v2.2947)

Journey map Tier 5 X10 (J15-F10), train T5-04 — bid-anchored schedule blocks follow the job on conversion, on request.

- **`move_bid_schedule_blocks_to_job(p_bid_id uuid, p_job_id uuid) → integer`**: `UPDATE job_schedule_blocks SET job_id = p_job_id, bid_id = NULL WHERE bid_id = p_bid_id AND job_id IS NULL`, returns the moved count. `SECURITY DEFINER`; authorization `can_edit_schedule_dispatch()` (the same predicate as the table's write policies) plus the invariant that `jobs_ledger.bid_id = p_bid_id` for `p_job_id` — the job must have been opened from this bid.
- Mirror of the job→bid repoint inside `migrate_job_ledger_costs_to_bid_and_delete` (`20260814033856`, v2.1624). Never automatic: the client offers it from the Won-moment door once a job exists.

No table, no policy change → no read-only appliers. Apply order: client first is fine (the button shows only when bid-anchored blocks exist, and the RPC call fails soft with a toast until the push). Called through the `(supabase as any).rpc` / `'name' as never` precedent until the next `gen-types` run.
