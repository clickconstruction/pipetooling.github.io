# 20261110213000 — bridge_moves_reach_people (v2.6864)

The Bridge's call reaches its people (punch list #303, PR 4). A call's moves are jsonb on `bridge_calls` (`{ key, title, who, then }`), and the table is read by the owner and the devs alone, so the office person named on a move never saw it. From v2.6864 the page writes the person's account on the move as `whoId`, and two `SECURITY DEFINER` functions let that person read their own moves and say one is done. Nobody gains a read of the table.

- **`bridge_my_moves()`** returns one row per open move that carries the caller's id on the standing call: `call_id`, `week_start`, `called_on`, `called_by_name`, `link`, `idx` (the move's place in the call, from 0), `move_key`, `title`. The standing call is the newest row (`week_start`, then `created_at`), while its pay week still runs (`week_start` within six days, Central time) and Friday's question has no answer. A move with a `doneAt` is left out. An archived account, and a call whose `moves` is not a list, read as none.
- **`bridge_mark_my_move_done(p_call_id uuid, p_idx integer)`** stamps `doneAt` (UTC) and `doneBy` (the caller's name) on that one move and touches nothing else. It returns `{ ok: true }`, or `{ error }` in words: *Not signed in.*, *This account is archived.*, *That move is not on the call.*, *That move is not yours.* A second press changes nothing.
- Both are revoked from `PUBLIC`, `anon` and `authenticated` by name and granted to `authenticated` and `service_role`.
- No table is created, so no fence call is owed; training mode is stopped by the table's own statement trigger.

Held, until `20261113100000_drop_bridge_move_functions.sql` dropped both functions and their bed with them, by `npm run test:pg:bridge-moves` (`supabase/tests/bridge_moves/`, in `scripts/sql-beds.txt`): the table stays closed to an assistant, each person reads only their own moves, every refusal, the stamp, and the moves leaving on an answer, a passed week, a newer call and an archived account.

Deploy order: the client reads through `bridge_my_moves` and answers with no moves while the function is missing, so the Needs you card is as it was until the push. Push right after the merge.

**Applied** to prod 2026-11-10, right after PR #7581 merged, read the same day through `npm run check:migration-drift`: 1224 local files against 1224 remote versions, fully applied, this one among them. Read back on the live project: the anonymous key is refused by both functions (`42501`), a signed-in account with no move reads none, and a call that does not exist is refused in words.
