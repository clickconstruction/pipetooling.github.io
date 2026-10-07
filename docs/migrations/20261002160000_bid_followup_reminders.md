# 20261002160000_bid_followup_reminders.sql (2026-10-02, v2.4427)

Punch list #80, PR 5 of 5: the ledger and the schedule behind the phone reminder for a bid's call-again day. One new table, one policy, one pg_cron job. No change to existing rows.

**`bid_followup_reminders`**: one row per bid and call-again day a reminder was sent for.

| Column | Meaning |
|---|---|
| `bid_id uuid` | the bid (`ON DELETE CASCADE`) |
| `due_on date` | the day the reminder was for (`bids.next_followup_on` at the time) |
| `recipient_user_id uuid` | who was told (`ON DELETE SET NULL`) |
| `push_sent integer` | devices reached; 0 = the person has no device registered |
| `created_at timestamptz` | when |

`UNIQUE (bid_id, due_on)` is the whole idempotency rule: the edge function inserts the row before it pushes, and a second hourly tick fails that insert and moves on. A day moved later is a different `due_on`, so it reminds again.

**Who may touch it.** RLS on; one `SELECT` policy for `is_office_staff()`; no write policy, and `INSERT / UPDATE / DELETE / TRUNCATE` revoked from `authenticated` and everything from `anon`. Only the service role (the edge function) writes. The migration ends with `apply_read_only_write_blocks()` and `apply_read_only_stmt_blocks()`.

**The schedule.** pg_cron job `bid-followup-reminders`, `8 * * * *`, posts to `/functions/v1/remind-bid-followups` with `X-Cron-Secret` from vault (the `job-contract-reminders` pattern). Hourly on purpose: the function waits for 8 AM in the office's time zone itself, so the schedule needs no daylight-saving arithmetic. Re-running the migration unschedules and schedules again: one job.

**Order.** Deploy `remind-bid-followups` before pushing this migration: until the function exists the hourly call is a 404 that nothing reads.

**Tested** in `npm run test:pg:bid-next-followup` (the migration is applied twice): the job is scheduled once at `8 * * * *`; an estimator's insert into the ledger is refused; a second row for the same bid and day is refused by the unique key; a later day is allowed; and a bid deletes with its reminders.

The generated types gain the table: a `chore(types)` PR follows the push.
