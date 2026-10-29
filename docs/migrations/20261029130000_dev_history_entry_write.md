# 20261029130000_dev_history_entry_write.sql (2026-10-29, v2.6044)

The dev seat's History verbs (punch list #208 PR 2m, [v2.6044](../recent-features/v2.6044.md)), over the table `20261029120000_development_history_entries.sql` made.

1. **`dev_history_entry_write(p jsonb, p_dry_run boolean DEFAULT true)`**: the dry-run wrapper `plan_history_entry` / `apply_history_entry` POST. Devs only (`is_dev()`), `SECURITY DEFINER`. Validates the development, at most one of `job_id` / `bid_id` / `customer_id` (each must exist), `happened_at` (an ISO timestamp, not in the future), `source` (the six), `body` (1 to 20,000), `agent_label` (required, the robot's name, under 80), `link_url` (optional). The dry run replies with the line as it will read (`after`: the development, the piece, its label, the time, the source, the body's first 200 characters and its length, the robot, `via mcp`); the real run inserts the row as the dev with `via = 'mcp'` and returns its id. The plan commits to that reply, so the one-apply-per-plan rule in the function keeps a repeat from landing twice.
2. **`dev_history_read(p_development_id, p_job_id?, p_bid_id?, p_since?, p_limit?)`**: a site's history as people wrote it, every body whole: the entries, the job's thread notes and the bid's thread notes, newest first, with the writers' names; `SECURITY INVOKER`, so RLS applies as the caller. `get_history` and `call_read` read it. 500 lines at most.

No table, no fences. `SET lock_timeout = '3s'` first; `CREATE OR REPLACE`, idempotent.

## Order

After PR 2h's migration. Merge, `supabase db push`, regenerate types (the types chore regenerates the dev-mcp catalog too, so `find_rpc` knows the two), then **`supabase functions deploy dev-mcp`**.
