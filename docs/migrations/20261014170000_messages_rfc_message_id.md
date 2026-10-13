# 20261014170000_messages_rfc_message_id.sql (2026-10-13, v2.5504)

Messages, residential R6, the reader's follow-up. The reader reads bids@ and the team box (v2.5494). One email sent to both is two Gmail messages, each with its own Gmail id, so until now it landed twice in the person's thread. The mail's own `Message-ID` header is the same in both boxes. This migration gives a line that header and lets one email hold one line. `gmail-sync` stamps it from v2.5504, so the lead pushes this migration first and deploys the function after it: the function reads the column.

## What it does

1. **`messages.rfc_message_id`**: the `Message-ID` of an email the reader took, as the mail carries it (`<CAF…@mail.gmail.com>`), trimmed.
   - Null on every line that is not an email we read, and on an email read before this. No backfill: the reader reads only new mail.
   - Only an email carries one, from 1 to 998 characters, a header line's cap (`messages_rfc_message_id_said`, added `NOT VALID`, then validated).
   - Nobody signed in writes it. It is not in the office's `INSERT` or `UPDATE` grants on `messages`. The office reads it as it reads every column.
2. **`messages_rfc_message_id_once`**: a unique index on the lines that carry one. A `Message-ID` is the sender's world-wide name for one mail, so one index covers both companies' boxes. None is per letterhead, since one per company would let the same mail land once in each.
3. **`email_write_line`** takes `rfc_message_id` from the row. It is recreated from its newest definition (`20261014003000_messages_two_boxes.sql`) with one change: the insert stands back on either key, the Gmail id or the `Message-ID` (`ON CONFLICT DO NOTHING`, with no target). When it stands back it writes no file and no note, and answers written false with the line it has: the one with this Gmail id, else the one with this `Message-ID`.
   - So two runs that read the same mail at once still write one line.
   - `gmail-sync` asks first as well, before it places the address or copies a file, and only labels the second box's copy (`docs/EDGE_FUNCTIONS.md` → gmail-sync).

## Safety

- `SET lock_timeout = '3s'`. It alters `messages`, which the app reads all day, so the lead pushes it at a quiet moment.
- Adding a nullable column is metadata-only. The validation reads `messages` while it takes no write lock. The unique index is built while writes wait, over a column that is null on every row, so it is quick.
- No new table, so no fences. The function stays `SECURITY INVOKER` with `SET search_path = public`, and `CREATE OR REPLACE` keeps its grants: the service role's alone.
- Idempotent: `ADD COLUMN IF NOT EXISTS`, the constraint behind a `pg_constraint` check, `CREATE UNIQUE INDEX IF NOT EXISTS` and `CREATE OR REPLACE FUNCTION`. Running it again changes nothing.
- The deployed `gmail-sync` before v2.5504 sends no `rfc_message_id`, so its lines carry none and write as before.

## Tests

`supabase/tests/messages_email/40_message_id.sql`, in `scripts/pgtest-messages-email.sh` (the SQL beds workflow's `messages-email` line), with the migration applied twice: the second box's read writes nothing and is answered with the first box's line, a Gmail id read again is answered as before, mail with no `Message-ID` still lands, a text carries none, and the office writes none.
