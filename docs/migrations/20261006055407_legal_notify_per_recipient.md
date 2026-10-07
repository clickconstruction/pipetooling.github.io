# 20261006055407_legal_notify_per_recipient.sql (2026-10-06, v2.4662)

Four additive columns for the law firm's emails (punch list #85 item 26). No new table, no function, no policy.

| Column | Type | What |
|---|---|---|
| `legal_notification_queue.sent_to` | `jsonb NOT NULL DEFAULT '{}'` | The per-person ledger of the "now" lane: `{ "<recipient id>": { "at": iso } \| { "tries": n, "error", "last", "gaveUp" } \| { "skipped": why } }`, frozen on the event's first tick. |
| `legal_firm_recipients.send_failed_since` | `timestamptz` | When emails to the person began failing; NULL once one goes through. |
| `legal_firm_recipients.send_error` | `text` | The mail service's last refusal; NULL once one goes through. |
| `legal_firm_recipients.unsubscribe_salt` | `text` | The salt in the person's stop token (an HMAC under the service key). Rotated only when they turn emails back on. |

## Why

`legal-notify-dispatch` stamped `sent_now_at` after its loop whether Resend took each email or not, so a refused *New account referred* was never retried, and nobody could see it had failed. Its `unsubscribeLink` minted a fresh token and overwrote the stored hash on every email, so the *Stop these emails* link in any older email was dead. The code that reads these columns is [`_shared/legalNotifyLedger.ts`](../../supabase/functions/_shared/legalNotifyLedger.ts) and the [v2.4662 fragment](../recent-features/v2.4662.md).

## House rules

Opens with `SET lock_timeout = '3s'`. `ADD COLUMN IF NOT EXISTS`, idempotent. A constant default and nullable columns: catalog-only on Postgres 11+, no rewrite, a brief lock on two small tables. No `CREATE TABLE`, so no read-only or twin fence calls; the existing office SELECT policies cover the new columns, and nothing but the service role writes them.

## Apply

`supabase db push` once this is on `main`. **Push before deploying** `legal-notify-dispatch`, `submit-legal-portal` and `legal-portal`. Each is written to survive the other order (the dispatcher stamps after one pass when `sent_to` is missing, the portal reads `*`, the salt and the failure columns are separate writes), but the retries and the lines only start once the columns exist.

## Verify after the push

Read-only, as an office user: `select column_name from information_schema.columns where table_name in ('legal_notification_queue','legal_firm_recipients') and column_name in ('sent_to','send_failed_since','send_error','unsubscribe_salt')` returns four rows. After the next five-minute tick, any open queue row has a non-empty `sent_to`, and every recipient emailed since has an `unsubscribe_token_hash` that no longer changes from email to email.
