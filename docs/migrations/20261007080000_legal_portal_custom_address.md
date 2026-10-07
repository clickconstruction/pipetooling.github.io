# 20261007080000_legal_portal_custom_address.sql (2026-10-06, v2.4756)

The law firm's portal address is short and the office's to pick ([v2.4756](../recent-features/v2.4756.md)); wrong keys are throttled.

1. `legal_portal_misses` (new; `ip`, `at`): one row per wrong key a portal function saw. RLS on, no grants to `anon` / `authenticated`; the three block calls close the file.
2. `legal_portal_guess_gate(ip, miss)` (service role only): with `miss`, one more row for the caller (and a 5% chance sweep of rows older than a day); answers `{ locked, misses }`, locked at ten misses in the last hour, never for `unknown`.
3. `legal_portal_address_problem(address)`: the shape (`^[a-z0-9][a-z0-9-]{3,38}[a-z0-9]$`, ending `-xxx`) and that no `customer_portal_slugs` / `sub_portal_slugs` row holds it. No grants.
4. `legal_portal_link_new_key(name)` now makes `<first two words>-<3 characters from abcdefghijkmnpqrstuvwxyz23456789>`.
5. `legal_portal_link_insert(firm, purpose, label, address)` replaces the three-argument form: the address given or a default one, refused when its shape or a used hash says so.
6. `create_legal_portal_link(firm, label, address)` and `rotate_legal_portal_link(link, address)` replace the shorter forms (the old signatures are dropped); `mint_legal_portal_link` mints a default short address.

Locks: one CREATE TABLE and function swaps; nothing on `legal_portal_links`. Idempotent (`CREATE OR REPLACE`, `DROP FUNCTION IF EXISTS` on the old signatures).

## Order

Merge, `supabase db push`, then deploy `legal-portal` and `submit-legal-portal`; regenerate types.
