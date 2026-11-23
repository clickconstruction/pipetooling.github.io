# 20261121235300_legal_notify_claim.sql (2026-11-21, v2.8228)

A claim for the law firm's emails, so two runs of `legal-notify-dispatch` that overlap cannot send the same email twice (punch list #85, a review residual). Two nullable columns and two service-role functions. No new table, no policy, no trigger.

| Name | What |
|---|---|
| `legal_notification_queue.claimed_until` (`timestamptz`) | The run that holds this event's "now" emails holds it until then. NULL or past means free. |
| `legal_firm_recipients.digest_claimed_until` (`timestamptz`) | The same for one person's weekly digest. |
| `legal_notify_claim_events(p_firm_id uuid, p_limit int = 50, p_lease_seconds int = 600)` | Claims the firm's oldest open events that are free and answers them as they stand now. `FOR UPDATE SKIP LOCKED` inside a materialized CTE. |
| `legal_notify_claim_digest(p_recipient_id uuid, p_last_digest_at timestamptz, p_lease_seconds int = 600)` | Claims one person's digest. True only when it was free and their `last_digest_at` is still the value passed. |

## Why

The dispatcher read a firm's open rows, sent, and only then wrote what it had sent. A second run that started before the first finished read the same rows and sent them again. The cron fires every five minutes and a run can take longer than that when the mail service is slow, and a hand call can land on top of a tick. A claim is a lease: the run stamps a time on its rows before it sends, and another run takes only rows with no stamp or a past one.

## How it behaves

- **`SKIP LOCKED`.** Two runs in the same instant do not wait on each other. The second takes the rows the first did not.
- **The answer is fresh.** Each claimed event comes back with the ledger (`sent_to`) the last run left, so a person already sent is never sent again.
- **The digest's second check.** A run reads the firm's people once, at its start. If another run sends a person's digest and lets the claim go before this run reaches them, the claim would be free again. The function therefore also asks that `last_digest_at` is still what this run read, and refuses when it has moved.
- **The lease is ten minutes** (`LEGAL_NOTIFY_LEASE_SECONDS` in [`_shared/legalNotifyClaim.ts`](../../supabase/functions/_shared/legalNotifyClaim.ts)), longer than a run can live. The dispatcher clears the stamp in the same write that marks the row, so a send that failed is free for the next tick with its try counted. A stamp outlives its run only when the run died, and then the row is tried again once it is past. The functions hold a lease to between one second and one hour and a claim to between 1 and 200 rows.
- **Who may call.** `SECURITY DEFINER`, `search_path = public`, execute revoked from `PUBLIC`, `anon` and `authenticated` and granted to `service_role`, as `legal_portal_guess_gate` is.

## House rules

Opens with `SET lock_timeout = '3s'`. `ADD COLUMN IF NOT EXISTS` and `CREATE OR REPLACE`, so it runs twice. Nullable columns with no default: catalog-only, a brief lock on two small tables. No `CREATE TABLE`, so no fence calls. The office's SELECT policies cover the new columns and nothing but the service role writes them.

## Apply

`supabase db push` once this is on `main`. The dispatcher survives either order: before the push the two functions answer PostgREST's `PGRST202`, and the run reads and sends as it did before the claim and writes neither new column. The claim starts at the first tick after both the push and the deploy.

## Verified

A stand-in rig on the local Postgres 15 (`/usr/local/opt/postgresql@15/bin`), not the app's schema: the three roles, the two tables with the columns the functions read, then this file twice, then eighteen checks.

- Run A claims two events and holds its transaction open for four seconds. Run B, a second session started inside those four seconds with a one-second lock timeout, is answered the third event at once and none of A's.
- A third run finds nothing free. Another firm's event is its own. An event with `sent_now_at` is never claimed. The limit holds.
- An event whose claim was cleared with a ledger write is taken by the next run with that ledger. An event whose lease is past is free again, and its new lease is ten minutes.
- A first digest is claimed; a second run is refused; a released one is claimed again; a run holding an old `last_digest_at` is refused; the value as PostgREST prints it (`2026-11-21T13:00:02.123456+00:00`) matches; an unknown person claims nothing.
- `has_function_privilege`: false for `anon` and `authenticated`, true for `service_role`, on both.

Prod runs Postgres 17; nothing here is newer than 12 (`AS MATERIALIZED`).

## Verify after the push

Read-only: `select column_name from information_schema.columns where (table_name, column_name) in (('legal_notification_queue','claimed_until'),('legal_firm_recipients','digest_claimed_until'))` returns two rows, and `select proname from pg_proc where proname like 'legal_notify_claim_%'` returns two. After the next tick with the function deployed, no open queue row keeps a `claimed_until` in the future for longer than the run took.

**Applied** to prod by 2026-11-23: `npm run check:migration-drift` read 1,454 versions applied against 1,454 local files, this version among them (read in the docs pass after #9274); types regenerated in #9332.
