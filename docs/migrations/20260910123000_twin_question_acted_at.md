# 20260910123000_twin_question_acted_at.sql (2026-09-10, v2.3229)

One nullable column on `twin_questions`: `acted_at timestamptz`. The `twin-mcp` dispatcher (`next_shadow`) reads this twin's answered, un-acted questions first; a plans ask answered with a rerun answer against a shell the twin still holds unlocked is handed back as the run (and the ask stamped `acted_at`), any other answered ask is stamped `acted_at` on first sight so it is never re-read. Edge-only writes.

- **Additive and idempotent**: `ADD COLUMN IF NOT EXISTS`. No new table, so no fence appliers; no RLS change (service-role writes; the restrictive twin UPDATE/DELETE bans stand).
- **Apply**: `supabase db push` after the v2.3229 merge, then `supabase functions deploy twin-mcp` (the dispatcher's resume block is skipped cleanly when the column is absent — the select fails and it falls through to a normal claim), then `npm run gen-types:linked` (the PR hand-adds the column).
- **Verify after push** (rolled back):

  ```sql
  begin;
  update twin_questions set acted_at = now() where id = (select id from twin_questions where status = 'answered' order by answered_at desc limit 1) returning acted_at;
  rollback;
  ```
