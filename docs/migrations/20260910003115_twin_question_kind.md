# 20260910003115_twin_question_kind.sql (2026-09-10, v2.3212)

One nullable column on `twin_questions`: `kind text` with a CHECK of `'decision' | 'plans' | NULL`. `decision` is a judgment the estimator rules on (Standing rulings); `plans` means the robot needs a different or additional plan set on one bid, and the client routes it to that bid's robot needs sheet (the amber icon on the Bid Board) instead of the rulings panel. Written only by the `twin-mcp` edge function on `ask_question`, from the robot's `kind` argument or the shared text classifier (`_shared/twinQuestionKind.ts`); NULL rows classify from their text at read time, so nothing changes for history.

- **Additive and idempotent**: `ADD COLUMN IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT`. No new table, so no fence appliers; no RLS change (edge-only writes; the restrictive twin UPDATE/DELETE bans stand).
- **Apply**: `supabase db push` after the v2.3212 merge, then `supabase functions deploy twin-mcp` (the insert retries without the column when it is absent, so either order is safe), then `npm run gen-types:linked` (the PR hand-adds the column).
- **Verify after push** (rolled back):

  ```sql
  begin;
  update twin_questions set kind = 'plans' where id = (select id from twin_questions order by created_at desc limit 1) returning kind;
  update twin_questions set kind = 'other' where id = (select id from twin_questions order by created_at desc limit 1); -- must raise twin_questions_kind_check
  rollback;
  ```
