# 20261113100000_drop_bridge_move_functions.sql (2026-11-12, v2.7115)

Drops the two functions the Needs you card used for the Bridge's call: `bridge_my_moves()` and `bridge_mark_my_move_done(uuid, integer)`, both from `20261110213000_bridge_moves_reach_people.sql`.

## What it does

1. `DROP FUNCTION IF EXISTS public.bridge_my_moves();`
2. `DROP FUNCTION IF EXISTS public.bridge_mark_my_move_done(uuid, integer);`

Functions only. No table is locked, no table is made, so no fences. A second run finds nothing to drop.

## Why

The owner took the call off the Bridge and its line off Needs you (punch list #334, PR 7, v2.7105): "Take the Needs you call code out too". No client calls either function since that version, and the Monday email reads no call since this one. No call was ever kept, so nothing is lost.

The table `bridge_calls` stays, with its policies. It is empty and nothing reads it.

Their SQL bed goes with them: `scripts/pgtest-bridge-moves.sh`, `supabase/tests/bridge_moves/` and its line in `scripts/sql-beds.txt`.

## Push it

`supabase db push` from `main` after this PR merges, and only once v2.7105 is live on the site: a client older than that still calls `bridge_my_moves` on the Needs you card. Its read treats a missing function as no moves, so an old tab loses nothing. Its Done press would be refused, on a line that no longer exists.

After the push, `src/types/database.ts` and `supabase/functions/dev-mcp/catalog.ts` still list the two functions until the types are regenerated (`npm run gen-types:linked`, its own `chore(types)` PR).

## Rollback

Run `20261110213000_bridge_moves_reach_people.sql` again: it creates both functions with their grants.
