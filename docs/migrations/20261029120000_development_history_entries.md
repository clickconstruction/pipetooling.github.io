# 20261029120000_development_history_entries.sql (2026-10-29, v2.6042)

The Development page's History entries (punch list #208 PR 2h, [v2.6042](../recent-features/v2.6042.md)): one new table, `development_history_entries`, a dated line a person or a robot keeps about something that happened on a development at the time it happened.

1. **`development_history_entries`**: `development_id` (cascades with the development), at most one of `job_id` / `bid_id` / `customer_id` (the check `one_piece`; each `SET NULL` when its record goes), `happened_at` (the writer's time), `source` (email, call, text, on_site, letter, note), `body` (1 to 20,000 characters, kept whole so MCP reads it whole; the page folds a long one), `author_user_id`, `via` (`app` or `mcp`), `agent_label` (the robot's name), `link_url` and `file_path` reserved, `created_at`.
2. **Indexes**: `(development_id, happened_at DESC)` for the page's read; partial ones on `job_id` and `bid_id`.
3. **RLS**: `gc_office_team()` reads; the same team inserts with `author_user_id = auth.uid()` and `via = 'app'`; **no UPDATE or DELETE policy**, since a kept line never changes (a correction is a second line). The MCP path (PR 2m) writes through a `SECURITY DEFINER` wrapper as the dev with `via = 'mcp'`.
4. The three fences at the end (training mode's write and statement blocks, the digital twins' fence), as every new table.

Locks: `CREATE TABLE` and its indexes touch only the new table; `SET lock_timeout = '3s'` first. Idempotent (`IF NOT EXISTS`, `duplicate_object` swallowed).

## Order

Merge PR 2 (#6405) and then PR 2h, `supabase db push`, regenerate types (the types chore), then the dev-mcp catalog knows the table for PR 2m's verbs. The client reads the table with a cast until the types land and tolerates an empty read.
