# 20261014003000_messages_two_boxes.sql (2026-10-12, v2.5428)

Messages, residential R6, the SQL (`to-dos/gc-mode/messages/RESIDENTIAL_BUILD_PLAN.md` → R6 on branch `spike/gc-mode`; the kernel is `src/lib/messages/boxes.ts`, v2.5418). The office answers the plumbing company's customers from the team box and the GC side's trades from bids@. Each box has its own number, and the office reads both in one inbox. This migration gives every line its box, gives a number a STOP per box, puts the two boxes in Settings, and gives the bids@ reader one row per box. Nothing reads a second mailbox or texts from a second number until R6's reader PR and `quo-webhook`'s PR are deployed and the boxes are filled in.

Still the owner's, and none of it blocks this SQL: team@ or office@ for the team box, whether that address is a real Workspace user (a group or an alias cannot be read the way bids@ is), the second Quo number for bids, and counsel's read on whether a STOP to one number must silence the other.

## What it does

1. **`messages.mailbox`**: the box a call, a voicemail, a missed call, a text or an email came in on or went out from, `team` or `bids`.
   - Null on a note, an event or a portal line, and where the box is not known (`messages_mailbox_known`, added `NOT VALID`, then validated). `boxes.ts` then reads the number or the address a line came to, and else the contact's kind.
   - **The backfill**: an email the bids@ reader took (`gmail_id`) is `bids`, and a call or a text on the company number (`quo_id`) is `team`. An event the webhook keys beside its line also carries a `quo_id`, and stays null. On prod there were no call, text or email lines when this was written, so it changes nothing there.
   - Nobody signed in writes it. It is not in the office's `UPDATE` grant on `messages`.
2. **`quo_write_line` and `email_write_line`** carry `mailbox` from the row. Both are recreated from their newest definitions (`20261012170000_quo_messages.sql`, `20261013080000_messages_email_in.sql`), with that one change.
   - While the functions send no box, a Quo line is `team` (today's one number is the company number) and an email is `bids` (today's one reader is bids@).
   - A later Quo write with no box keeps the box the line has.
   - A forwarded copy's note is a team note and has no box.
3. **`contact_channels.opted_out_by_box`**: a STOP per box, `{"team": "<when>", "bids": null}`. A carrier scopes a STOP to the pair of numbers, and one `opted_out_at` cannot say which of ours it stopped.
   - A stamp: that box may not text this number. Null: a START to that box. No entry: `opted_out_at` decides, which stops every box. That is `boxes.ts`'s `stoppedOn`.
   - The keys are `team` and `bids`, each value a stamp or null, and only on a phone (`contact_channels_stop_by_box_known`, added `NOT VALID`, then validated). Not backfilled: an old `opted_out_at` keeps stopping both boxes.
   - Only the service role writes it, as `opted_out_at`.
4. **`contacts_fold` keeps a STOP to either box.** When two contacts with one number fold, the fold deletes one copy of the number. Before it does, `contact_channels_keep_stops(keep, gone)` copies the gone copy's STOP onto the kept one for any box the kept one does not stop itself.
   - It only adds stamps. It never writes a null, so it never starts a box.
   - It only reads two copies of one phone number (same kind and key).
   - It is a definer, since nobody signed in writes a STOP and the fold runs as the office. Outside a trigger, a call from someone signed in who is not on the office team, or is a twin, changes nothing. That is `contacts_fold_quick_replies`'s guard.
   - `contacts_fold` is recreated from the spine's definition, its only one, with that call before each delete. Its comment said no cut redefines it. R6 is the one exception, because the STOPs live on the copy the fold deletes, and a later `contacts_fold_<something>` hook runs after that copy is gone. No open PR redefines it (checked against #5593, R0's SQL).
5. **`app_settings` `messages_boxes_v1`**: `{"team": {address, phone, numberId}, "bids": {...}}`, every field empty.
   - No address is written in the repo. The team box's address is the owner's answer, typed into Settings.
   - `quo-send`, `quo-webhook` and `gmail-sync` fall back to today's secrets while a field is empty. For the team box that is `QUO_COMPANY_MAILBOX`, `QUO_COMPANY_PHONE` and `QUO_PHONE_NUMBER_ID`; for bids it is `GMAIL_IMPERSONATE_USER`.
   - Every signed-in user reads it, as `app_settings` is read. Only the owner or a dev changes it, through its own `UPDATE` policy (`master_or_dev_update_messages_boxes`, `is_master_or_dev()`), the shape of cut 5's seats.
6. **`gmail_sync_state`: one row per box**, keyed by `mailbox` (`team` or `bids`, `gmail_sync_state_mailbox_known`).
   - Today's row is `bids`.
   - The old key, `id`, is no longer the key and has no default. It stays `true` on the bids row alone (`gmail_sync_state_id_is_bids`), so the deployed `gmail-sync` (`.eq('id', true)`) finds its row until R6's reader PR reads by `mailbox`. A later migration drops it.
   - `gmail_sync_state_one_row` goes. No team row is added: Settings → Phone and texts → **Read bids@** reads the table with `.maybeSingle()`, so the reader PR reads it by box and writes the team row on its first run.

## Safety

- `SET lock_timeout = '3s'`. It alters `messages` and `contact_channels`, which the app reads all day, so the lead pushes it at a quiet moment.
- Adding a nullable column and a column with a constant default is metadata-only. The backfill and the two validations read the tables, which hold no call, text or email lines on prod yet.
- No new table, so no fences. The new function is `SECURITY DEFINER` with `SET search_path = public`, `REVOKE` from `PUBLIC` and `anon`.
- Idempotent: `ADD COLUMN IF NOT EXISTS`, the constraints behind a `pg_constraint` check, the backfill only where `mailbox` is null, `CREATE OR REPLACE FUNCTION`, `ON CONFLICT DO NOTHING` for the setting, the policy dropped before it is made, and the key moved only while it is not yet `mailbox`. Running it again changes nothing, and it revokes nothing a later cut grants.
- The order the four writers' PRs deploy in does not matter: each reads the box when it is there and falls back to today's one box when it is not.

## The bed

`npm run test:pg:messages-email` (`scripts/pgtest-messages-email.sh`) applies this migration twice. Just before the first run, `supabase/tests/messages_email/25_two_boxes_before.sql` writes lines from before two boxes. Then `supabase/tests/messages_email/30_two_boxes.sql` checks these things:
- the lines from before take their box, and an event and a note take none;
- a note and an unknown box are refused;
- the webhook's and the reader's writes carry the box, or today's one when they send none, and a later write keeps it;
- a STOP per box keeps its rules, and the office writes neither a STOP nor a box;
- a fold by the office keeps a STOP to either box, and the older STOP's copy is kept whole and never started;
- the definer does nothing for a superintendent or a twin, copies only one number's STOP, and nobody signed in reaches it;
- the boxes ship empty, a dev fills them, the office reads them and an assistant does not change them;
- the reader keeps one row per box, and the old key finds only the bids row.

Cut 6's scenario (`20_scenario.sql`) now reads "one row per box" where it read "only one row". Docker is not reachable on the office Mac, so the bed runs in the SQL beds workflow.

## Verify on prod (after `supabase db push`)

Read only:
- `\d public.messages` shows `mailbox` and `messages_mailbox_known`;
- `select mailbox, count(*) from public.messages group by 1` has only null, unless lines landed before the push;
- `\d public.contact_channels` shows `opted_out_by_box` (`'{}'::jsonb`, not null) and `contact_channels_stop_by_box_known`;
- `select value_text from public.app_settings where key = 'messages_boxes_v1'` is the empty boxes;
- `select mailbox, id, history_id from public.gmail_sync_state` is one row, `bids`, `true`;
- `has_function_privilege('anon', 'public.contact_channels_keep_stops(uuid, uuid)', 'execute')` is false.
