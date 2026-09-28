# 20260928040549_gc_office_statement_week.sql (v2.3976)

Punch list #49, step 6b. Two functions, no table:

- **`get_statement_week_for_office()`** → `jsonb`, `SECURITY DEFINER`, service-role only. The body is `get_statement_round_for_user` (4th cut, `20260905044344`) CTE for CTE, with three changes:
  1. **No user filter.** Every GC group ≥ $10,000 is an item carrying `owner_user_id` / `owner_name` (the standing `statement_sender_user_id`, else the most common Account Man on its jobs).
  2. **The week's steps in place of the round's states.** `sent` = a `sent` mark this week **or** a `gc_statement_emails` row since Monday (company calendar); `word_in` = a `contacted` mark or a temperature; `state` = `skipped` · `done` · `needs_word` · `needs_certify` · `ready`. A word taken early no longer hides a GC from "to send" — it mirrors `worklistNextStep` in `src/lib/jobs/gcWorklist.ts`.
  3. **The word names its source.** `last_word.by` / `last_temperature.by` = `word_from_name`, else `acted_by_name`; the newest word is picked by `COALESCE(word_at, acted_at)`. `promise_late` / `days_late` read `expected_pay_by` against today.
  Returns `{ week_start, deadline, today, office: true, items[], counts{ gcs, to_check, to_send, to_send_total, words_due, done, late, total } }`, items ordered broken promise first, then largest balance.
- **`get_my_statement_week()`** — the client door: the same payload for dev / master_technician / assistant / controller, `NULL` otherwise. Granted to `authenticated`.

**Depends on** migration `20260928032427` (the `word_*` columns) — it sorts before this one.

**Left in place:** `get_statement_round_for_user` / `get_my_statement_round`. The client and the dispatcher fall back to them while this migration is unpushed; drop them once both have run on the new pair for a while.

**Tested** against a throwaway local Postgres 15 with the real `gc_statement_round_marks` migrations applied over stub tables: a GC with the account man's word in and no statement reads `ready` with `last_word.by` = his name and `promise_late`; an app-sent GC with no mark reads `needs_word`; a sent mark with a temperature reads `done`; an uncertified GC reads `needs_certify`; a GC under the line is left out; the gate returns `NULL` for a helper.

Idempotent (`CREATE OR REPLACE`); opens with `SET lock_timeout = '3s'`.
