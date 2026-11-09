# 20261108223000 — My email's Sent side with no press (v2.6751, punch list #263 PR B)

The columns and the one table behind the owner's call 2 of 2026-11-08: a mail a person sends from their own box to an address on exactly one open job, or whose domain is one customer's with one open job, lands on that job by itself, marked as put there by the app, with **Untag** on the line.

- `users.my_mail_sent_read_at timestamptz`: the per-person cursor, the newest sent mail `gmail-mine`'s follow has read. Null until the first run after the deploy, which sets it to now and reads nothing older (no backfill, as `gmail-sync`'s first run reads nothing old). Written by the function as the service role.
- `email_tag_threads.placed_by_app boolean not null default false`: the row the follow made from a sent mail, with no press. An untag of such a row leaves a tombstone; a tag by hand reads false.
- `messages.placed_by_app boolean not null default false`: the lines the follow wrote from a sent mail, set by an UPDATE after `email_write_line` answers written (as `body_html_path` is set after the write). The thread line draws *from Wendi's mail · put here by the app* and **Untag** on it.
- `email_tag_threads_off (user_id, gmail_thread_id, untagged_at, primary key (user_id, gmail_thread_id))`: the tombstone. A conversation the person untagged after the app placed it is never placed by the app again; a tag of it by hand deletes the row. RLS on, every grant revoked from `anon` and `authenticated`, no policy: `gmail-mine` reads and writes it as the service role alone. The four fences close the file.

Idempotent and additive. The hot tables are altered last, `messages` then `users`, each lock held for the shortest stretch.

**Deploy order**: the client's thread read selects `messages.placed_by_app` (`messagesIo.ts`), so `check:calls-ahead` labels the PR *push right after the merge*: `supabase db push` from a clean checkout of `main` right after the merge, before the Pages deploy finishes; then `supabase functions deploy gmail-mine --no-verify-jwt`. The push before the redeploy is harmless (the old function reads none of the columns); the redeploy before the push would stop every tag at its first read of the row (`placed_by_app` in `TAG_ROW_COLUMNS`) and read no Sent, so push first. Then `npm run gen-types:linked` as its own `chore(types)` PR.
