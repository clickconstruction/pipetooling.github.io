# 20261028230000_users_signature_lines.sql (2026-10-28, v2.6038)

The two lines a person keeps under their email signature (punch list #207 PR 1, `to-dos/messages-estimator-mailbox/README.md` → Finding 2, the owner's call 4). The client reads the column fail-soft (`src/lib/messages/signatureIo.ts`: without it the card on Settings → Your account saves the title alone and says the lines arrive with the next update, and an email signs without them), so the client deploys first; push after the feature PR merges, then redeploy `messages-email` and regenerate the types.

## What it does

1. **`users.signature_lines text[]`**: null or empty is no lines; `users_signature_lines_two` holds it to two, added by name when missing. Each line is held to 80 characters by the app (`SIGNATURE_LINE_MAX`), as `users.title` is by `users_title_short`.
2. **`GRANT UPDATE (signature_lines) ON public.users TO authenticated`**: prod grants `users` column by column (as `20261012190000` did for `title`); the own-profile policy keeps the write to each person's own row, and `users_guard_privileged_columns` does not name the column.

## Why the shape

- A column on `users` beside `title`, not a table of its own: the signature already reads `users.name`, `title` and `phone` in one row (`replyIo.loadSender`), and the lines are the same kind of profile field as the title, written by the person alone.
- `text[]` with a cardinality check, not two columns: the card's two boxes save as one list with the blank ones out, so a person with one line keeps one, and a later third line is a check change, not a column.

## Verify

Read-only on prod after the push: `select count(*) from users where signature_lines is not null` reads 0 until someone saves a line. As a signed-in office person on Settings → Your account → Your signature on an email: type a line, press *Save the signature*, read the row back (`read_rows users`, your `id`): `signature_lines` holds the line; blank both boxes and save: it reads null. Then from a thread, *Send email…*: the send window's preview carries the line under the cell, and nothing after it.
