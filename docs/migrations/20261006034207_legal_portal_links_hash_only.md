# 20261006034207_legal_portal_links_hash_only.sql (2026-10-05, v2.4647)

The collections law firm's portal token stops being readable at rest (punch list #85, item 22). Before: `legal_portal_links` kept the raw `token` beside `token_hash` (`20260911202259_legal_portal_links.sql`), the four office roles behind `legal_office_can_read()` could SELECT it, and `mint_legal_portal_link(p_rotate => false)` handed an existing raw token back to any of them. Whoever holds it can act as the firm on the portal.

The catch that shaped the design: every email to the firm (`legal-notify-dispatch`) carries the live link, so the server must still be able to build it. A strict hash-only table would have emailed the firm a link to nothing. So the raw token of the **live** link moves into Supabase Vault (encrypted at rest, read only by the service role), and nobody else can read it.

The file:

1. `token_secret_id uuid` on `legal_portal_links`: the Vault secret of the live link.
2. A backfill block: each live link's raw token goes into Vault (`vault.create_secret`, named `legal_portal_link_<id>`); missing hashes are filled; then the raw column is emptied on every row. A Vault failure aborts the whole file before anything is emptied.
3. `CHECK (token IS NULL)` (`legal_portal_links_token_not_kept`), and a unique partial index on `token_hash` (the functions' lookup).
4. Grants: `REVOKE SELECT … FROM authenticated`, then `GRANT SELECT (id, firm_id, token_hash, token_secret_id, created_by, created_at, revoked_at)`. The office reads that a link is live, never its token.
5. `mint_legal_portal_link`: an existing live link answers `{ token: null, exists: true, activeSince }`; creating or rotating returns the new raw token once, stores it in Vault and only its hash in the table.
6. `legal_portal_link_forget_secrets(firm)` (no grants to callers): deletes the live link's Vault secret on rotate and revoke. A Vault refusal is noted and skipped, never blocking the revoke; a revoked link's token is refused by the functions anyway.
7. `revoke_legal_portal_link`: forgets the secret, then revokes.
8. `legal_portal_link_token(firm)` (SQL, `SECURITY DEFINER`, EXECUTE for `service_role` only): the live link's decrypted token, for the emails.

Locks: the ALTERs take ACCESS EXCLUSIVE on `legal_portal_links` (one or two rows, read only by the two portal functions and the office dialog) for an instant; `SET lock_timeout = '3s'` first. No CREATE TABLE.

## Order

1. Merge the PR; the client deploys (the Firm's link dialog, the journey and the portal page work before and after this file).
2. `supabase functions deploy legal-notify-dispatch` and `supabase functions deploy legal-portal` (the dispatcher falls back to the raw column while the RPC is missing; the portal answers the office's preview by firm id).
3. `supabase db push`.

## After the push

- The Firm's link dialog shows the link only right after **Create** or **Rotate**; otherwise it says the link is live and can be copied only when created or rotated. **Preview ↗** opens `/legal?firm=<id>&preview=1`, signed in.
- The Lien desk's share loses its "copy the firm's link" line (it read the raw column).
- `src/types/database.ts` lacks `token_secret_id` until the next types regen; nothing in the client reads it.

Not rehearsed on a database (no local Postgres or Docker in this session). Things to confirm on the first push: `vault.create_secret` and `vault.decrypted_secrets` are available to the migration role (they are to `postgres` on Supabase), and the backfill moved the live token (`select count(*) from legal_portal_links where revoked_at is null and token_secret_id is null` → 0, `select public.legal_portal_link_token('<firm id>') is not null` as the service role).
