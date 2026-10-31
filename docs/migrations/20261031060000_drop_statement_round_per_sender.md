# 20261031060000_drop_statement_round_per_sender.sql (v2.6220)

Punch list #49's last database step: the per-sender statement round retires.

- **`DROP FUNCTION IF EXISTS public.get_my_statement_round()`** — the Dashboard Needs You row's old door (v2.2771). Since `20260928040549` the row reads `get_my_statement_week()`; the client fell back to this one only on a `PGRST202`, which it has not seen since that migration was pushed on 2026-09-28.
- **`DROP FUNCTION IF EXISTS public.get_statement_round_for_user(uuid)`** — the service-role payload behind the old "Your statement round" email and behind `get_my_statement_round`. `statement-round-email-dispatch` reads `get_statement_week_for_office()` and fell back to this one on the same error.
- **`COMMENT ON TABLE statement_round_email_requests`** re-stated: the dispatcher rebuilds the office's week, not the recipient's round.

**Read before writing it** (dev-mcp, 2026-10-31, as the dev): `statement_round_email_requests` holds no row at all, so the dispatcher's cron never built an email and never reached either path; `gc_statement_round_marks` holds no row; `gc_word_asks` has none with a `week_start` since 2026-10-05; `notification_history` has no statement row since 2026-10-04; `get_my_statement_week()` answers the current week (3 GCs over the line); `get_my_statement_round()` still answered too, an empty round. GC Review itself was in use on each of the four Wednesdays — `gc_review_certifications` since 2026-10-05: 49 rows, of which 2 on 10-07, 2 on 10-14, 8 on 10-21 and 7 on 10-28.

**Push order.** This file is the reverse of `check:calls-ahead`'s case: nothing here is new to the client, but the OLD client called `get_my_statement_round` on a `PGRST202`, and the OLD dispatcher called `get_statement_round_for_user` the same way. Pushed early, a dropped name would answer the fallback with another refusal — harmless in practice, since the fallback fires only when the week's function is missing, but the rule stands: `supabase db push` only after the v2.6220 client is on Pages **and** `supabase functions deploy statement-round-email-dispatch` has run. Pushed 2026-10-31 after both.

**After the push:** `npm run check:migration-drift`, then `src/types/database.ts` regenerated (the two `Functions` entries go) and `supabase/functions/dev-mcp/catalog.ts` rebuilt from it (`node scripts/build-dev-mcp-catalog.mjs`) in the chore PR that also deletes `to-dos/gc-review-one-operator/`.

Idempotent (`IF EXISTS`); opens with `SET lock_timeout = '3s'`. A `DROP FUNCTION` takes an `ACCESS EXCLUSIVE` lock on the function row only, never on a table.
