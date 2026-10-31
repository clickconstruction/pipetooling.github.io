# 20261031030000_email_left_out_senders.sql (2026-10-31, v2.6202)

Punch list #223 PR 1, **A notice, not a person** (`to-dos/messages-notices/README.md`, piece 1; `docs/recent-features/v2.6202.md`).

- **`email_left_out_senders`** — the senders the office marked a notice on the *Who is this?* card: `value` (lower-case, trimmed), `kind` (`address` · `domain`), `mailbox` (`bids` · `team` · null for both; the press writes null), `contact_id` (the thread the press was made from, for the undo), `marked_by`, `marked_at`. One row per `(kind, value, mailbox)`. SELECT for `gc_office_team()`; no write policy — `gmail-sync` reads as the service role, and the two functions below write as the owner.
- **`email_open_mail_domain(text)`** — the server's copy of the shared mail services (`leftOutSenders.ts`'s `OPEN_MAIL_DOMAINS`), so a domain there is never marked whole.
- **`mark_notice(p_contact_id uuid, p_scope text)`** — `follow_up_press('mark a notice')`; only a contact of kind `unknown` with an email channel; inserts the address row, and on `p_scope = 'domain'` the domain row too (refusing an open mail service in words); sets the thread `done` with `has_*` cleared; writes the event line *Marked a notice: …*.
- **`unmark_notice(p_contact_id uuid)`** — `follow_up_press('put a notice back')`; deletes the rows this contact made (refusing when there are none); sets the thread `waiting`; writes *Not a notice after all.*
- Ends with the three fence calls, since it creates a table.

Apply order: the client calls both functions from the sort card, so **push right after the merge**, before the Pages deploy finishes (`check:calls-ahead` labels the PR). Then `supabase functions deploy gmail-sync`: it reads the table each run; deployed before the push it would fail its read and stop reading, so the push comes first. Then regenerate types and the dev-mcp catalog.
