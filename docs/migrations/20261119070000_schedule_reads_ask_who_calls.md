# 20261119070000_schedule_reads_ask_who_calls.sql (2026-11-19, v2.7925)

The schedule emails' two reads ask who is calling. `list_schedule_blocks_for_share(p_viewer, p_start, p_end)` and `list_job_schedule_blocks_for_schedule_email(p_recipient, p_work_date)` answer the schedule as one named person sees it, and both run as their definer. Each now begins by asking a gate whether the caller has business with that person. A primary named as that person is held to his own jobs, which closes family 7 of punch list #400 (`to-dos/primary-job-doors.md`).

## What it makes

One new function and two restated. No table and no policy.

- **`schedule_read_gate(p_person, p_office_reads_anyone)`**: returns for the service role with no login, for a caller who names himself and, when the second argument is true, for the office (`is_office_staff()`). It raises `42501` for anyone else: *You can read your own schedule only.*, or *Sign in to read a schedule.* with no login. Called from inside the two reads alone, so no signed-in role holds it.
- **`list_job_schedule_blocks_for_schedule_email`**: the service role for anyone, the office for anyone, a signed-in person for himself.
- **`list_schedule_blocks_for_share`**: the service role for anyone, a signed-in person for himself.
- **In both, a primary named as the viewer or the recipient** reads the blocks assigned to him and the blocks of the jobs he is the account manager of (`jobs_ledger.account_manager_user_id`). He read every job's blocks before.

## Rules it settles

- **The rule comes from the callers.** The two dispatch functions read with the service key. The Share window previews the sender's own board, so it always names the caller. The Email schedule window previews the day of the person picked, and only the office picks someone else: the same roles the policy `schedule_day_email_requests_insert_office_any_recipient` lets send that email to another user.
- **The gate is the first statement of each body.** It runs before a row is read, so a refusal does not depend on whether the day holds a block.
- **A primary's rule is the table's own, written inline.** `job_schedule_blocks` already holds a primary to those blocks through `primary_scope_jobs_ledger`, which asks `auth.uid()`. These reads ask about a named person, so the clause names the column. It wraps every job leg, so the crew, the project and the office legs open nothing more to a primary. The bed holds the two reads to the table's answer for him.
- **The bodies are the live ones.** Each function is `pg_get_functiondef` from a copy of the whole schema, the same text as `20261118020000`, with the gate's statement in front and the primary's clause round the job legs. No name, argument or returned column changes.
- **Every role is named in the grants.** `authenticated` and the service role hold the two reads. The public key holds neither.

## What it leaves alone

- Every other role's legs inside each read.
- The bid blocks: a primary still reads every bid visit, as the roles that read bids do.
- The client and the two dispatch functions. Every caller already asks within the rule.

## Order and proof

Safe on either side of the client deploy, so the push follows the merge with no client step first. From the push a primary's day email, and its preview, list his own jobs alone. `check:calls-ahead` still labels the PR *push right after the merge*, because the client calls two functions the migration replaces, and the Pages deploy holds until the push.

Proved by CI's `schedule-reads-gate` bed (`scripts/pgtest-schedule-reads-gate.sh`, `supabase/tests/schedule_reads_gate/`, a line in `scripts/sql-beds.txt`, `npm run test:pg:schedule-reads-gate`), on the whole schema with the migration applied twice. The `job-papers-lists` bed read both functions with no login, as the database itself; it now reads them as the service role, the way the dispatch functions do.

**Not yet applied.** Push from a clean checkout of `main` right after the merge: `bash scripts/db-push.sh`.
