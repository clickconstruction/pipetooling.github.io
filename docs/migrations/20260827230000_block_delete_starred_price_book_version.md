# 20260827230000 — block deleting a packet's ★ price scenario (v2.2409)

`bid_versions.starred_price_book_version_id` → `price_book_versions` is
`ON DELETE SET NULL`, so deleting a scenario silently nulled any packet ★ built
on it (BP384 incident, 2026-08-27: NORTHSTAR's ★ deleted from a session viewing
a different packet — the client guard checked the viewed packet's star).

Adds `public.block_delete_starred_price_book_version()` (plpgsql, SECURITY
DEFINER, `SET search_path = public`) and the BEFORE DELETE trigger
`price_book_versions_block_starred_delete` on `public.price_book_versions`:
raises `P0001` naming the packet while any live `bid_versions` row (whose bid
still exists) stars the scenario being deleted.

Cascade paths stay legal without special-casing: deleting a packet
(`price_book_versions.bid_version_id` is ON DELETE CASCADE) or a whole bid
removes the referencing `bid_versions`/`bids` rows before the cascade reaches
`price_book_versions`, so the trigger's lookup finds nothing. The JOIN to
`bids` covers whichever FK path a whole-bid cascade takes first.

Idempotent: `CREATE OR REPLACE FUNCTION` + `DROP TRIGGER IF EXISTS`.
