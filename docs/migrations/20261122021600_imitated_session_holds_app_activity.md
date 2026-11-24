# 20261122021600_imitated_session_holds_app_activity.sql (2026-11-21, v2.8251)

The app activity heartbeat refuses a session someone else opened as the person. Taunya's go of 2026-11-21, after v2.8176 stopped the client sending the heartbeat while View as is on: this is the same rule on the server, so a browser still holding an older build, or any other client, cannot write it either. It ships alone. No client reads or calls anything it adds, so the order of the push and the deploy does not matter.

## What it does

- **`session_opened_by_imitation()`** (new, `boolean`, `STABLE`, `SECURITY DEFINER`, open to `authenticated` and the service role, closed to `anon`): whether the calling session was opened by Imitate or View as. It reads the token's `amr` claim for the session's magic-link sign-in (method `otp` or `magiclink`, with the second it was used) and looks for a `user_imitations` row of the same person from 2 minutes before that sign-in to 1 minute after it. It says nothing about anyone but the caller.
- **`bump_user_app_activity(p_seconds, p_page)`** is restated from `20260703120000_user_app_activity_page_daily.sql` with one early return: for such a session it writes no `user_app_activity_daily` row and no `user_app_activity_page_daily` row. Everything else is as it was. The function on prod was read back and matched the repo before this was written.

## Why minutes, where the mail reads back a day

`gmail-mine` asks the same question (`src/lib/myMail/imitation.ts`) and counts an imitation made in the 24 hours before the sign-in, because a link lives that long and a wrong pass there shows a person's mail. Here the costs run the other way. The sign-in page offers an emailed link, and the `amr` entry stays on a session through every refresh. A person who signed in by their own link within a day of a dev looking as them would lose their own last seen time and app time for the life of that session. `login-as-user` writes the row before it makes the link, and the page verifies the link at once, so the real gap is seconds. Two minutes covers a slow page and one minute covers the two clocks.

A password session carries no such `amr` entry, so no table is read for it. A magic-link session costs one read of `user_imitations` by its `(target_id, created_at)` index a heartbeat.

## What answers false

No session, a token with no `amr`, an `amr` that is not a list, an entry with no time or a time that is not a number, and any error at all. The fence must never cost a person their own heartbeat, so a claim it cannot read is not proof.

## What it leaves alone

- **The salary sync** (`sync_salary_clock_sessions_for_user_day`). The server cannot tell the clock button's own sync from the sync after a pressed save, which can be for another day. A press in View as saves as that person by design, and the rows the sync writes are the ones the server's own schedule writes. The client holds the two syncs nobody presses for (v2.8176, v2.8246).
- **The "seen" marks.** The client holds them (v2.8246). Four of them are RPCs (`job_note_tags_seen`, `task_note_tags_seen`, `bid_mark_requests_seen`, `legal_firm_intake_seen`), and they took the same one line in v2.8459 (`20261124084500_imitated_session_holds_seen_marks.sql`).
- **Rows already written.** It repairs nothing.

## Safety

`SET lock_timeout = '3s'` opens the file. Two `CREATE OR REPLACE FUNCTION` and their comments, no table, no rewrite, idempotent. `CREATE OR REPLACE` on the heartbeat takes a brief lock on its catalog row while calls are in flight.

## Test

`scripts/pgtest-imitated-session.sh` with `supabase/tests/imitated_session/20_scenario.sql` (`npm run test:pg:imitated-session`, on the SQL beds list): the grants; a password session; a link verified 3 and 90 seconds after an imitation; the redirect's `magiclink`; a row half a minute after the sign-in; a person's own link 10 minutes later and 5 minutes earlier, both counted; an imitation of someone else; two sign-ins on one token; five claims that cannot be read; the dev who looked; nobody signed in. It passed on a local stand-in rig (PostgreSQL 15, a stub of the tables it touches) before CI ran the whole-schema bed. CI's first run then failed where the rig had passed: the function called `auth.jwt()`, which the sign-in service adds on prod and a bare Postgres image lacks, and the answer-false-on-any-error rule hid the missing function. The claim is now read from the request's own setting, as `auth.jwt()` reads it, and the bed's cases that must answer true are what caught it.
