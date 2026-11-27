# 20261127064100_receipt_text_again.sql (2026-11-27, v2.8697)

**Punch list #299, Text again.** What the office's press for one more receipt text needs in the database. It sends nothing: the text goes from the `receipt-request` function, on the press.

## What it does

1. **`receipt_requests.again_at`**, **`again_by`** (`users`, set null on delete) and **`again_count`** (`integer NOT NULL DEFAULT 0`, never below zero): when the office last pressed **Text again**, who pressed, and how many times. The function claims a press here before its text goes, by an update that matches the count it read, so two presses at once send one text. The sweep reads none of the three.
2. **`receipt_links.made_for`** takes a fourth word, `again`: the link a Text again hands out, with `made_by` the person who pressed. The check was written inline in `20261113061500`, so it is found by what it says, dropped, and written again as `receipt_links_made_for_check`.
3. **`receipt_requests_to_chase()`** hands back two more columns, `again_at` and `again_count`, after the eleven it had. A charge texted again rests off the list for twelve hours after the press, as it rests after the reminder. Everything else it reads and refuses is as `20261113150000` wrote it.

## The function is dropped and made again

The row type grows, and `CREATE OR REPLACE` cannot change a function's row type. So the file runs `DROP FUNCTION IF EXISTS public.receipt_requests_to_chase()` and `CREATE FUNCTION` one after the other, then writes the grants and the comment again: `anon` and `PUBLIC` may not execute it, `authenticated` and `service_role` may. It stays `STABLE`, `SECURITY DEFINER`, `search_path = public`. Nothing in the database calls it, so nothing depends on the old one.

## Who may do what

Unchanged. The office reads the list. No policy lets a signed-in person write `receipt_requests` or `receipt_links`, so the three new columns are the function's to write, as the service role, after it has checked that the caller is the office. No table is made, so no fence is added.

## Lock and safety

`SET lock_timeout = '3s'` first. `ADD COLUMN` with a constant default rewrites nothing. The check is dropped and added on `receipt_links`, a small table, and the drop and the create of the function are one short lock on the function alone. Idempotent: `ADD COLUMN IF NOT EXISTS`, the check found by its words, `DROP FUNCTION IF EXISTS`.

## Order

**Deploy `receipt-request` first, then push.** No name is created that the client calls, so the Pages deploy does not wait on this file.

- Before the push, the list hands back no `again_count`, and the client shows no Text again. Nothing can be pressed.
- The deployed function's sweep reads none of the new columns, so it runs the same before and after the push.
- After the push, the press shows on a charge texted and reminded with no receipt. The function must be the new one by then, or the press is answered *Only the sweep calls this.* and sends nothing.

An older client reads the two new columns as nothing.

## Checked

Applied twice on a throwaway Postgres 15 with stub tables, after `20261113150000`, then `supabase/tests/receipt_texts/40_again.sql`, 14 checks, and `30_office.sql` again, which still passes. The whole-schema bed `npm run test:pg:receipt-texts` runs all three probes in CI. It no longer applies `20261113150000` a second time: that file's `CREATE OR REPLACE` cannot take the two columns away.

## Undo

Drop and make `receipt_requests_to_chase()` again as `20261113150000` wrote it, then drop the three columns once nothing reads them. The word `again` can stay in the check.

**Applied** to prod by 2026-11-27: the dev seat's `check_migration_ledger` read 1,514 versions applied against 1,514 files on `origin/main`, this version among them (read in the docs pass after #9995); types regenerated in #10057.
