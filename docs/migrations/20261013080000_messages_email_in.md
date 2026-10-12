# 20261013080000_messages_email_in.sql (2026-10-12, v2.5350)

Messages, cut 6, email in (`to-dos/gc-mode/messages/BUILD_PLAN.md` → Cut 6, and the mock-up `email-in-mockups.html` on branch `spike/gc-mode` with the lead's answers to its nine questions; the kernels are `src/lib/emailIn/`, v2.5349). Every email that reaches bids@ lands in its sender's thread. The spine (`20261012010000_messages_spine.sql`, v2.5258) made `messages`, and the Quo link (`20261012170000_quo_messages.sql`, v2.5278) gave it its first source. This migration adds the second: what an email carries, the files and links on a line, the reader's one write, its place and health, the files' bucket, the switch and the cron. Nothing reads bids@ until the `gmail-sync` edge function is deployed and a dev turns the switch on.

## What it does

1. **`messages` gains two columns.**
   - `gmail_id`: Gmail's id for the email. A plain unique index (`messages_gmail_id_key`) backs it, as `quo_id`'s does, because `email_write_line`'s `ON CONFLICT (gmail_id)` needs the whole index. The lines with no Gmail id are nulls, which never collide.
   - `gmail_thread_id`: Gmail's thread, for a reply in it later.
   - Both are only on an email, and a thread needs its Gmail id (`messages_gmail_on_email`, added `NOT VALID`, then validated).
2. **`message_attachments`**: a file or a link on a line, in order (`sort_order`).
   - A file has our copy in the bucket (`bucket_path`, `<gmail id>/<part>-<name>`), or stays in Gmail (`left_in_gmail`: `too_big` over 25 MB, or `not_copied`), never both (`message_attachments_link_or_file`). `gmail_attachment_id` opens one left in Gmail.
   - A link has its `url` and `host`, and no copy and no paper.
   - `paper` is the reader's guess at a trade partner's W-9 or certificate (`coi`, `w9`) for the thread's offer. `paper_answer` is the office's answer (`filed`, `not_it`), only to a guess. A trigger (`message_attachments_stamp_answer`) stamps `paper_answered_by` and `paper_answered_at` when the answer changes, and clears them when it is taken back.
   - Deleting a line deletes its files and links (`ON DELETE CASCADE`). A fold moves a line with its files, since they hang on the line.
3. **`email_place_address(value, name)`**: the contact an email's address lands on, by `contact_for_channel`, with the channel and what the line calls them, as `quo_place_number` does for a number. An address nobody has makes an unknown contact named `name` (the email's display name), else the address, with that one address, and `made` is true. The address's key is locked for the transaction, so two emails from one new address at once make one contact.
4. **`email_write_line(gmail_id, row, files, note)`** is the reader's one write: the line by its Gmail id (`row`, `messages` columns by name; its channel is always email), each file and link in order (`files`, a JSON array), and, on a forwarded copy, the forwarder's note as a team note on the same contact (`note`). All or nothing, once: a Gmail id already written writes nothing and answers the line it has, with `written` false.
5. **`gmail_sync_state`**: one row (`gmail_sync_state_one_row`), the reader's place and health.
   - `history_id`: Gmail's history id the next run reads after. It is null until the first run after the switch sets it, and from then on there is no backfill.
   - `label_id`: the "In ClickTooling" label's id in bids@.
   - `last_run_at`, `last_ok_at`, `last_error` and `last_taken`: a dev sees a stuck reader through the dev-mcp catalog.
6. **The files' bucket**, `message-attachments`: private, a file up to 25 MB (`file_size_limit` 26214400). The office team reads (`message_attachments_files_select`). The service role writes (`message_attachments_files_service`). Nobody signed in adds, replaces or takes off a copy.
7. **The switch**, `app_settings` `gmail_sync_on_v1`, ships `'false'`. The lead turns it on after the live test, an email to bids@ from the owner's phone. The owner or a dev may turn it on or off from the app through its own `UPDATE` policy (`master_or_dev_update_gmail_sync_on`, `is_master_or_dev()`), the shape of cut 5's seats; a one-line migration from main can flip it too.
8. **The cron**, `gmail-sync`, runs every 3 minutes. It calls the function with `X-Cron-Secret` (vault `PROJECT_URL` and `CRON_SECRET`), as `20261010070000_gc_office_notices_cron.sql`'s does, and its statement's `WHERE` selects nothing to post while the switch is not `'true'`.
9. **Who reaches it.**
   - The office team (`gc_office_team()`, as for the lines) reads `message_attachments`, `gmail_sync_state` and the bucket. It writes one column, `paper_answer`. `anon` holds nothing.
   - `email_place_address` and `email_write_line` are `SECURITY INVOKER`, and only the service role may execute them.
   - The house fences run at the end (`apply_read_only_write_blocks`, `apply_read_only_stmt_blocks`, `apply_digital_twin_write_blocks`), so training mode and a twin answer no paper offer.
   - **Never run this migration again once a later cut's is in.** Its grants start with a `REVOKE` on its own tables, which would take back what that cut granted on them. Its bed runs the second run right after the first for that reason.

## Safety

- `SET lock_timeout = '3s'`. Adding two nullable columns is metadata-only. The unique index and the validation read `messages`, which holds no email lines yet.
- Idempotent: `ADD COLUMN IF NOT EXISTS`, `CREATE UNIQUE INDEX IF NOT EXISTS`, the constraint behind a `pg_constraint` check, `CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `ON CONFLICT DO NOTHING` for the state row, the bucket and the switch, and the cron unscheduled before it is scheduled.

## The bed

`npm run test:pg:messages-email` (`scripts/pgtest-messages-email.sh`, `supabase/tests/messages_email/20_scenario.sql`, and a line in `scripts/sql-beds.txt`) checks these things:
- an email's line keeps its rules;
- an address finds its person by its key, in any case, and a new address makes one unknown contact, named by the display name or the address;
- the reader's write is once by the Gmail id, with its files and links in order, and a forwarded copy's note is a team note on the same thread;
- a file or a link keeps its rules;
- the bucket, the state, the switch and the cron are as shipped, and with the switch off the cron's own statement, run as cron runs it, selects nothing to post;
- a dev turns the reader on, and an assistant does not turn it off;
- nobody signed in reads anything, and a superintendent reads nothing;
- the office reads the files, the state and our copy, answers a paper offer, stamped with who, and writes nothing else;
- training mode and a twin answer nothing;
- a fold moves an email and its note to the person.

Docker is not reachable on the office Mac, so the bed runs in the SQL beds workflow.

## Verify on prod (after `supabase db push`)

Read only, through the management API's query endpoint:
- `\d public.messages` shows `gmail_id`, `gmail_thread_id` and `messages_gmail_id_key`;
- `select count(*) from public.message_attachments` is 0, and `select * from public.gmail_sync_state` is one row with no `history_id`;
- `select public, file_size_limit from storage.buckets where id = 'message-attachments'` is `false`, `26214400`;
- `select value_text from public.app_settings where key = 'gmail_sync_on_v1'` is `false`;
- `select schedule from cron.job where jobname = 'gmail-sync'` is `*/3 * * * *`;
- `has_function_privilege('authenticated', 'public.email_write_line(text, jsonb, jsonb, jsonb)', 'execute')` is false.
