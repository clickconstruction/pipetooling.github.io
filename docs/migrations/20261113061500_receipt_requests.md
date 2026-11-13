# 20261113061500_receipt_requests

**Punch list #299, PR 1 (v2.7101).** The ground under a receipt link for a card charge. It sends nothing.

## What it does

1. **`counter_tickets.source` takes `link`, `counter_tickets.match_kind` takes `link`.** The two column checks were written inline by `20261109190000`, so the migration finds them by what they say (`pg_get_constraintdef`), drops them, and writes them again as `counter_tickets_source_check` and `counter_tickets_match_kind_check`. A second run finds the named ones and writes the same two.
2. **`receipt_requests`**: one row a charge (`UNIQUE (mercury_transaction_id)`, cascade when the charge leaves the feed). `holder_user_id` and `holder_name`, `no_text_why` (`no_cell`, `no_person`, `archived`, `opted_out`), `cell` (E.164 by a check), `texted_at`, `reminded_at`, `opened_at`, `answered_at`, `ticket_id`, `closes_at` (fourteen days by default), `closed_at`, `made_by`. PR 1 writes the holder, the opens, the answer and the ticket; the text columns wait for PR 2.
3. **`receipt_links`**: one row a code. `code_hash` (SHA-256, 64 hex by a check, unique), `request_ids` (one to ten, a GIN index), `made_for` (`office`, `text`, `reminder`), `made_by`, `made_at`, `expires_at`, `opened_at`, `open_count`. A code is handed out once and never kept, so a second code for the same request is a second row and the first stays open.
4. **`receipt_request_ensure(p_transaction_id, p_made_by)`**: the request for a charge, made on the first ask. Refuses a charge that is not in the feed (`P0002`) or is not a card charge (`22023`). The holder is `mercury_transaction_attributions.user_id`, else `mercury_debit_card_user_links.user_id` for the card id in `raw`. A request nobody has answered or texted takes the holder again on a later ask. `SECURITY DEFINER`, executable by the service role alone.

## Who may do what

- `receipt_requests`: **read** by the office (`is_office_staff()`) and by the holder it names. `receipt_links`: **read** by the office.
- No INSERT, UPDATE or DELETE policy and no such grant for `authenticated`; nothing at all for `anon`. Every write is the `receipt-link` function's, as the service role.
- Two tables are created, so the file closes with the four fence appliers.

## Lock and safety

`SET lock_timeout = '3s'` first. The one lock that matters is the `ALTER TABLE counter_tickets` that drops and adds the two checks: an `ACCESS EXCLUSIVE` for the length of a scan of a table of a few hundred rows. Everything else creates. Idempotent: `IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS`.

## Order

After the merge of PR 1, before `supabase functions deploy receipt-link`. No client reads either table in PR 1, so the Pages deploy may land on either side.

## Checked

Applied twice on a throwaway Postgres 15 with stub tables and `counter_tickets` as `20261109190000` created it, then 41 checks (the two words, the old checks, the ensure's four holder cases and its two refusals, the shapes, the reads by role, no write from any signed-in role, the cascade). The fences were stubs there.

## Undo

`DROP FUNCTION public.receipt_request_ensure(uuid, uuid); DROP TABLE public.receipt_links; DROP TABLE public.receipt_requests;` and the two checks written again without `link`, once no ticket carries it.
