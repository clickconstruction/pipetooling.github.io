# 20261008050000_gc_trade_portal_links.sql (2026-10-08, v2.4857)

GC mode, the real build, the trade partner portal's P1a (`to-dos/gc-mode/PORTAL_REAL_BUILD.md` → *The tables*, on branch `spike/gc-mode`). It holds one link per company with no password, the sub portal's spine keyed to a company instead of a person, and every email we send a company, kept as it went. Nothing on screen reads it yet. P1b brings the portal page and the office's *Their portal* control.

- **`gc_trade_portal_links`**: the sub portal's `sub_portal_links`, keyed to `gc_companies`.
  - `token` (kept raw, so the office can copy it again) and `token_hash` (SHA-256), as the sub portal keeps them.
  - `created_by`, `created_at`, and `revoked_at`, the only kill switch. There is no expiry.
  - One link on per company (a partial unique index), a unique `token`, and an index on `token_hash`.
  - No opened columns: who opened a link, and when, is `public_page_views` with surface `gc_trade_portal`.
- **`gc_trade_messages`**: every email we sent a company, as it went. The portal's *Their messages* reads it, never what the data says now (decision 5).
  - `company_id`, and `project_id` (null when the email is about the company).
  - `kind` (the prototype's 19 `PortalMessage` kinds and `paper`) and `mail_group` (quotes, job, contracts, pay).
  - `msg_key`, unique per company, so the same message is never sent twice. A reminder has its own key.
  - `lang`, `subject`, `lines` (a JSON list, one paragraph each), `to_names`, `sent_on` (the app's day), `sent_at`, `sent_by`, and `email_send_log_id`, so Resend's delivered and opened come with it.
- **`mint_gc_trade_portal_link(company, rotate)`**: the link that is on, or a new one. With `rotate`, it turns the old one off and makes a new one in the same transaction. **`revoke_gc_trade_portal_link(company)`**: *Turn it off*. Both are `SECURITY DEFINER`, dev only (`is_dev()`) until the door, revoked from `anon`, and granted to `authenticated`. They answer in plain words.
- **`public_page_views`**: the surface CHECK gains `gc_trade_portal`.

RLS: each table has one `FOR SELECT` policy for `(SELECT public.is_dev())`. Nothing writes them under RLS. `authenticated` has SELECT only, and `anon` has nothing. The mint and revoke functions write the links. The `gc-trade-email` edge function writes the messages with the service role (P3). The trade never touches a table: the read and submit functions resolve its link with the service role.

It ends with `apply_read_only_write_blocks()`, `apply_read_only_stmt_blocks()` and `apply_digital_twin_write_blocks()`.

Apply order: after `20261008020000_gc_company_record` (B1), whose `gc_companies` these reference. It is idempotent (`IF NOT EXISTS`, `DROP ... IF EXISTS` before each policy and the surface CHECK, `CREATE OR REPLACE`). The surface CHECK swap takes a short lock on `public_page_views`, an insert-only table every public page writes. In a busy moment the push stops at the 3-second lock timeout; run it again later.

## Checked before the push

On a local Postgres 15, with stand-ins for `users`, `projects`, `email_send_log`, `gc_companies`, `public_page_views`, `auth.uid()`, `is_dev()` and the three block calls, the migration applied twice with no error. Then:

- An assistant's `mint_gc_trade_portal_link` and `revoke_gc_trade_portal_link` answered in words and changed nothing.
- A dev's mint on an unknown company said *That company is not on record.*
- A dev's mint gave a 64-character token with its SHA-256 hash, and the same token again. `rotate` gave a new one with one link on. `revoke` turned it off.
- `public_page_views` took `gc_trade_portal` and refused a surface not on the list.
- A message's key was taken once, and a kind not on the list and `lines` that are not a list were refused.
- As `authenticated`: a dev read both links and the message, and an assistant read none. Nobody inserted a message or updated a link.
- As `anon`: no read of the links and no call to the mint.

## Checks after the push

1. The policy catalog shows one SELECT policy on each table and none for `anon`.
2. A training-mode user's insert into each table, inside a transaction that never commits, is refused.
3. Signed in as a non-dev, `mint_gc_trade_portal_link` answers *Only a dev can make a trade portal link for now.*
4. Signed in as a dev, against a company id that matches nothing, it answers *That company is not on record.*
5. On "Test trade, delete me" (P1b's check), a dev's mint returns a 64-character token and the same token again, until `rotate`. `revoke` then turns it off.

## Status

Merged as v2.4857 (#4880) and pushed to prod on 2026-10-08 (drift 785 of 785). The checks ran through the management API's query endpoint, and every write rolled back.

1. **Passed.** Each table has one SELECT policy, `gc_trade_portal_links_dev` and `gc_trade_messages_dev`, for `authenticated`. `anon` has no SELECT, and `authenticated` has no INSERT.
2. **Passed.** A training-mode user's insert into each table was refused with *permission denied for table …*. The privilege refuses it before the read-only block is reached, since `authenticated` holds no INSERT at all.
3. **Passed.** An estimator's `mint_gc_trade_portal_link` answered `{"error": "Only a dev can make a trade portal link for now."}`.
4. **Passed.** A dev's mint on an id that matches nothing answered `{"error": "That company is not on record."}`. `anon` got *permission denied for table gc_trade_portal_links*.
5. **Waits** on call 13, the test rows on prod: it needs "Test trade, delete me".
