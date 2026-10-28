# 20261028150000_missed_call_reply.sql (2026-10-28, v2.6012)

Punch list #195 PR 1: a missed call gets a text back from the app. When nobody picks up a call to one of our numbers, `quo-webhook` texts the caller back from that number with the office's words (`src/lib/quo/missedReply.ts`), through every gate the app's texts already have. The text is the app's own line, so it must neither clear Needs a reply nor start Waiting on them.

- **`messages.auto boolean NOT NULL DEFAULT false`**: true on a line the app sent on its own with nobody pressing Send. The column takes a default, which Postgres writes without touching the rows.
- **`messages_move_state()`** (cut 2's trigger, `20261012160000`) replaced with one clause: a line with `auto` moves nothing, and a later auto line never hides a line of theirs, so the conversation stays open and whoever has it keeps it.
- **`quo_write_line()`** (R6's body, `20261014003000`) writes `auto` on an insert (`false` when the row says nothing) and keeps it on an update when the row says nothing, so the webhook's merge of Quo's delivery event keeps the mark.
- **`app_settings` `messages_missed_call_reply_v1`**: the card's switch (off as it ships) and the three lines, in office hours, after hours and with a voicemail, as JSON (`{"on":false,"inHours":"…","afterHours":"…","voicemail":"…"}`, the owner's words of 2026-10-28). The UPDATE policy `master_or_dev_update_messages_missed_call_reply` lets the owner or a dev change it (`is_master_or_dev()`), keyed to this row alone; everyone signed in reads it; the webhook reads it as the service role.
- **`missed_call_replies`**: one row per call, keyed by the call's Quo id (`call_quo_id`), so a call that sends three events is answered once and Quo's retry answers nothing twice. The row keeps the contact and the number, when they called, the line it wrote (`in_hours`, `after_hours`, `voicemail`), the outcome (`claimed`, `sent`, `not_sent`), the reason in a word and in words, and the text's `messages` row. RLS: the office team reads (`gc_office_team()`), the functions alone write (no policy for authenticated). Ends with the three fence calls.

Idempotent: the column, the row, the table and the index are made only when missing; the functions and the policies are replaced.

**Order**: pushed while the PR is armed and green, before the merge deploys the client, since the client's reads select the new column (`MESSAGE_COLS`, Follow up's `MESSAGE_COLUMNS`, Waiting on them's read). Then `supabase functions deploy quo-webhook` and every function whose bundle reaches the changed kernels (`npm run check:edge-drift` names them: `quo-send`, `messages-notify`, `messages-nudge-dispatch`, `walk`, `gmail-sync`, `photo-save`, … as the copy's importers). The types PR after the push adds `auto` to `src/types/database.ts`.

**Bed**: `scripts/pgtest-messages-follow-up.sh` (the trigger's clause) and `scripts/pgtest-quo-messages.sh` (the write and the setting's row).
