# 20261119070000_schedule_reads_ask_who_calls.sql (2026-11-19, v2.7925)

The schedule emails' two reads ask who is calling. `list_schedule_blocks_for_share(p_viewer, p_start, p_end)` and `list_job_schedule_blocks_for_schedule_email(p_recipient, p_work_date)` answer the schedule as one named person sees it, and both run as their definer. Each now begins by asking a gate whether the caller has business with that person.

## What it makes

One new function and two restated. No table and no policy.

- **`schedule_read_gate(p_person, p_office_reads_anyone)`**: returns for the service role with no login, for a caller who names himself and, when the second argument is true, for the office (`is_office_staff()`). It raises `42501` for anyone else: *You can read your own schedule only.*, or *Sign in to read a schedule.* with no login. Called from inside the two reads alone, so no signed-in role holds it.
- **`list_job_schedule_blocks_for_schedule_email`**: the service role for anyone, the office for anyone, a signed-in person for himself.
- **`list_schedule_blocks_for_share`**: the service role for anyone, a signed-in person for himself.

## Rules it settles

- **The rule comes from the callers.** The two dispatch functions read with the service key. The Share window previews the sender's own board, so it always names the caller. The Email schedule window previews the day of the person picked, and only the office picks someone else: the same roles the policy `schedule_day_email_requests_insert_office_any_recipient` lets send that email to another user.
- **The gate is the first statement of each body.** It runs before a row is read, so a refusal does not depend on whether the day holds a block.
- **The bodies are the live ones.** Each function is `pg_get_functiondef` from a copy of the whole schema, the same text as `20261118020000`, with the one statement added. No name, argument or returned column changes.
- **Every role is named in the grants.** `authenticated` and the service role hold the two reads. The public key holds neither.

## What it leaves alone

- The rule inside each read that decides which blocks the named person sees, the `primary` leg among them. Punch list #400 owns that leg.
- The client and the two dispatch functions. Every caller already asks within the rule.

## Order and proof

Safe on either side of the client deploy, so the push follows the merge with no client step first.

Proved by CI's `schedule-reads-gate` bed (`scripts/pgtest-schedule-reads-gate.sh`, `supabase/tests/schedule_reads_gate/`, a line in `scripts/sql-beds.txt`, `npm run test:pg:schedule-reads-gate`), on the whole schema with the migration applied twice. The `job-papers-lists` bed read both functions with no login, as the database itself; it now reads them as the service role, the way the dispatch functions do.

**Not yet applied.** Push from a clean checkout of `main` after the merge: `supabase db push`.
