# 20261029140000_put_in_development.sql (2026-10-29, v2.6046)

The Development page's **Put the N in** (punch list #208 PR 3, [v2.6046](../recent-features/v2.6046.md)): one RPC, `put_in_development(p_development_id, p_bid_ids, p_job_ids)`, that sets `development_id` on every named bid and job in one transaction and returns the counts that moved (`{ ok, development, bids, jobs }`). `SECURITY INVOKER`: the caller's own update policies on `bids` and `jobs_ledger` decide row by row, so a row the caller may not update stays as it is and the counts say so; the training-mode statement blocks and the twins' fence hold inside it as on any update. Refuses an empty press and more than 500 pieces. No table, no fences. `SET lock_timeout = '3s'` first; `CREATE OR REPLACE`, idempotent.

## Order

After PR 2 (#6405). Merge, `supabase db push`, then the types chore. The client's press names the reason until the push lands (the RPC is not there).
