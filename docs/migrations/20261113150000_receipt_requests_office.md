# 20261113150000_receipt_requests_office

**Punch list #299, the step after PR 2 (v2.7148).** What the office needs to work, from Needs you, the card charges a receipt text cannot finish. It sends nothing and texts nobody.

## What it does

1. **`receipt_requests.office_done_at`** and **`office_done_by`** (`users`, set null on delete): the office's **Got it**. A request marked done leaves the office's list and nothing else changes. Its link still opens, a receipt that comes later still lands, and the sweep reads neither column.
2. **`receipt_requests_to_chase()`** → rows of `request_id`, `mercury_transaction_id`, `why`, `holder_user_id`, `holder_name`, `store`, `amount` (as a size), `posted_at`, `texted_at`, `reminded_at`, `closes_at`; `STABLE`, `SECURITY DEFINER`, at most 300, the newest charge first. A row is an open request the text cannot finish:
   - `why` is the request's own `no_text_why` (`no_cell`, `no_person`, `archived`, `opted_out`), or `failed` for a first text turned away three times, or `no_answer` for a charge texted and reminded with no receipt twelve hours after the reminder.
   - Never a request that is answered, closed, past `closes_at` or marked done; never a charge the bank failed, cancelled or reversed; never a charge with a live ticket. A request the office made by hand and nobody texted is not one, and neither is a text still inside its tries or its evening.
   - Empty for anyone who is not the office (`is_office_staff()`), and for an archived caller.
3. **`receipt_requests_set_done(p_request_ids uuid[], p_done boolean DEFAULT true)`** → how many rows changed. Marks requests done with the caller and now, or with `p_done = false` takes the mark back. At most 200 ids (`22023`).

## Who may do what

- The read: the office. It is a function because the store and the amount live on `mercury_transactions`, which an assistant does not read. It hands back what a receipt link's own page shows, and whose card.
- The write: the office. Refused with `42501` for anyone else, for nobody signed in, for an archived account and for a training account (`is_read_only()`).
- `anon` may execute neither. No table is made, so no fence is added.

## Lock and safety

`SET lock_timeout = '3s'` first. `ADD COLUMN` with no default rewrites nothing. Idempotent: `ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE`.

## Order

**Push right after the merge.** The Needs you line and the deck's rows call `receipt_requests_to_chase()`, and Got it calls `receipt_requests_set_done()`; only this file creates them. Until the push the line stays quiet (the read is refused and the hook reads nothing), so nothing breaks, but `npm run check:calls-ahead` labels the PR and the deploy holds for the push. It needs `20261113140000_receipt_texts.sql` first (`text_tries`).

## Checked

Applied twice on a throwaway Postgres 15 with stub tables and the two migrations before it, then `supabase/tests/receipt_texts/30_office.sql`, 22 checks: the six kinds that belong on the list in order and the nine that do not, Got it and its Undo, several at once, and a helper, an assistant in training, one who has left and nobody at all changing nothing. The whole-schema bed `npm run test:pg:receipt-texts` runs both scenarios in CI.

## Undo

`DROP FUNCTION public.receipt_requests_set_done(uuid[], boolean); DROP FUNCTION public.receipt_requests_to_chase();` and the two columns dropped once nothing reads them.
