# 20261009170000_reject_clock_session.sql (2026-10-08, v2.4964)

One function, `public.reject_clock_session(p_session_id uuid) RETURNS void`. It is the My Time day editor's **Reject session** as one transaction: punch list **#46** row 10, the MY_TIME_DAY_EDITOR_MODAL map's risk flag. Additive. The client calls it. Its fallback to the two requests, kept until the push, went in v2.4973.

## Why

The editor rejected a session with two requests:

1. an `UPDATE` of `rejected_at` / `rejected_by` on `clock_sessions` under the caller's RLS
2. `recompute_people_hours_after_session_edit`, to take an approved session's hours back out of `people_hours`

When the second failed, the row stayed rejected with its hours still counted, and the dialog read as if the reject had failed. If the person closed the editor, the rejected row no longer showed to try again (pinned in v2.4960). This function does both inside the one transaction PostgREST opens for the call, so a refused resync undoes the reject.

## What it does

- Refuses a call with no signed-in user or no session id.
- `UPDATE clock_sessions SET rejected_at = now(), rejected_by = auth.uid() WHERE id = p_session_id`, under the caller's RLS.
- Raises when that changed no row: the session is missing, or RLS hides it from the caller.
- `PERFORM recompute_people_hours_after_session_edit(p_session_id)` for the session's day, for every reject, pending or approved, as the browser's second request did.

## Permissions — unchanged on purpose

- `SECURITY INVOKER`: the `UPDATE` runs under the caller's own RLS on `clock_sessions`. The resync keeps its own `SECURITY DEFINER` and actor check.
- Everyone the `UPDATE` policies let change a row also passes the resync's check: the person, their team lead, pay access and assistants, and devs through `is_pay_approved_master()`. So nobody who can reject today is refused.
- Granted to `authenticated`; revoked from `anon` and `PUBLIC`.

**One deliberate change**, as `save_my_time_day` does: an `UPDATE` that changes no row is raised. That is a session deleted meanwhile, or one RLS hides from the caller. The browser's request succeeded there with nothing written, and the dialog closed as if the session were rejected.

## The client

`src/lib/rejectClockSession.ts` calls `reject_clock_session`, and any refusal is shown in the dialog as before. Until the push it fell back to the two requests, verbatim, when PostgREST answered that the function was missing (`PGRST202`, or Postgres's `42883`). v2.4973 dropped that fallback once the push was live, so a missing function is now an error like any other. Tests: `rejectClockSession.test.ts` and the modal's render test.

## Tried before the push

`supabase/tests/my_time_day_save/30_reject.sql`, a new scenario on the save bed. The stand-in schema gained `clock_sessions.rejected_by`, as in production. It ran against a throwaway Postgres 15. The macOS Postgres refuses to start without a valid locale, so export `LC_ALL=C` first:

```bash
psql -v ON_ERROR_STOP=1 -f supabase/tests/my_time_day_save/00_schema.sql
psql -v ON_ERROR_STOP=1 -d bed -f supabase/migrations/20260928182140_save_my_time_day.sql
psql -v ON_ERROR_STOP=1 -d bed -f supabase/tests/my_time_day_save/20_scenario.sql
psql -v ON_ERROR_STOP=1 -d bed -f supabase/migrations/20261009170000_reject_clock_session.sql
psql -v ON_ERROR_STOP=1 -d bed -f supabase/tests/my_time_day_save/30_reject.sql
```

The migration ran twice (idempotent). `20_scenario.sql` still ends `save_my_time_day PASSED`, and `30_reject.sql` ends `reject_clock_session PASSED`:

1. A refused resync undoes the reject. The resync is stood in with one that raises; the row stays unrejected and the hours stay at 4.
2. Her own approved session is rejected by her, and its 2 h leave `people_hours`.
3. Her own pending session is rejected and the hours stay.
4. Someone else cannot reach her row: refused, and nothing is written.
5. Her team lead rejects her approved session (`rejected_by` = the lead), and its hour leaves.
6. A null id, a missing id, no signed-in user and `anon` are refused.

A copy of the function that swallowed the resync's error failed step 1, so the scenario does test the atomicity.
