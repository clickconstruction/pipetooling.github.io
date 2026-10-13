# 20261014080000_running_late_move.sql (2026-10-12, v2.5431)

Messages, residential R8 · 3 PR 2, dispatch writes back (Customer communication helper 6, directed by the lead session). A tech's **Running late** text gives the customer a new window, and **Move it** slides the tech's day on the dispatch board with the reason. The kernel that reads what slides is `src/lib/scheduleDispatch/whatSlides.ts` (v2.5405); its `boardWrite` builds this call. The press is R5's Job Mode, so nothing calls this until that screen ships.

## What it does

1. **`self_move_schedule_block`** is re-created from its newest body (`20260813224521_bid_schedule_blocks.sql`) with one skip and nothing else. Its job thread note for a block someone else made is left off for the block `running_late_move` names in the transaction-local setting `app.running_late_block`. The late job reads one line, the event below, and not two. A slid block keeps its note, and a move by hand still writes it.
2. **`running_late_move(p_moves, p_reason, p_job_line, p_note_title, p_note_summary)`**, a definer function granted to the signed in, never to anon. It returns the dispatcher's note's id.
   - `p_moves` is the kernel's rows in `self_move_schedule_block`'s own shape, the last stop first and the late block last. Each goes through `self_move_schedule_block`, so the move's rules keep one home: the tech's own block, the end after the start, out of a crew block.
   - It is one transaction, so a refusal anywhere moves nothing. It refuses in words: nothing to move, no reason or job line or note, a block twice, a block that is not the tech's, a move to another day, a late block that keeps its window, and a window past 8:00 PM. The last is the board's day end, `job_schedule_blocks_time_bounds`, refused here before the check fires.
   - **The reason's home** is one `job_activity_events` row of type `running_late` on the late block's job. Its summary is the kernel's job line, *Running late. Moved from 8:00 AM to 9:30 AM, said to Dana, 9:02 AM.* Its detail holds the block, the window it left and the one it took, the reason and the slid blocks. It is not financial. A bid's block has no job activity, so it writes no line.
   - **The dispatcher's note** is one `dispatch_requests` row from the tech with `pending_action = 'running_late'`. The job or the bid comes from the late block's row, never from the caller. The inbox shows its title and summary with no button. The caller then invokes `notify-dispatch-request` with the returned id, as Quick Estimate does, which pushes the dispatch group.

`dispatch_requests.pending_action` has no CHECK (baseline), so `running_late` needed no widening. Any signed-in user may insert a `dispatch_requests` row as themselves through `dispatch_requests_insert`; the row is written here so the move and the note are one write. No table, so the three fences are untouched. Training mode's statement trigger on `job_schedule_blocks` refuses the call inside this definer function.

## Checked before the push

The SQL bed `running-late-move` (`npm run test:pg:running-late-move`) runs every migration on Supabase Postgres 17, then this one a second time, which must change nothing, then the scenario. Docker does not run on the office Mac, so it runs in the SQL beds workflow once the PR is ready. The scenario also passed on PGlite over stub tables on the office Mac, and two breaks on purpose each failed it: the note's skip, and the 8:00 PM refusal (the table's check then answers instead).

- Luis's morning slides in one call. The sewer line moves to 9:30, the water heater slides an hour, the church at noon holds, and Nico's half of the crew block stays where it was while Luis leaves the crew.
- The sewer line keeps where it was first in `field_moved_from`. Its job reads one `running_late` line with the reason, the slid block and Luis as the actor, and no thread note of its own. The water heater's job keeps its note and has no `running_late` line.
- The dispatcher's note is one open row from Luis on the sewer line's job, `running_late`, its title and summary as sent. Luis reads it back. The schedule ledger holds both moves by Luis, and the setting is empty after the call.
- A move by hand afterwards still writes its note. A bid walk moves with a note that names the bid and no job, and writes no job line.
- Each refusal leaves the board as it was and writes nothing: anon, no moves, no reason, a block twice, Nico's block as the late one and among the slides, past 8:00 PM, another day, a kept window, a refusal inside `self_move_schedule_block` after a row moved, a window under 30 minutes, and a training account.

## Verify after the push

```sql
-- 1. The function, the signed in only.
SELECT p.proname, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon
FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'running_late_move';
-- expect: authenticated true, anon false

-- 2. self_move_schedule_block carries the skip.
SELECT pg_get_functiondef('public.self_move_schedule_block(uuid, date, time, time)'::regprocedure) LIKE '%app.running_late_block%';
-- expect: true

-- 3. Nothing has run it yet.
SELECT count(*) FROM public.job_activity_events WHERE event_type = 'running_late';
SELECT count(*) FROM public.dispatch_requests WHERE pending_action = 'running_late';
-- expect: 0; 0
```

## Rollback

```sql
DROP FUNCTION IF EXISTS public.running_late_move(jsonb, text, text, text, text);
-- self_move_schedule_block: re-run its body from 20260813224521_bid_schedule_blocks.sql. With running_late_move gone
-- nothing sets app.running_late_block, so the skip is inert until then.
```

## Status

Written 2026-10-12 as `20261014010000`. Renumbered on 2026-10-13 to `20261014080000`, because three migrations stamped after it reached `main` first (`20261014011000`, `20261014012000`, `20261014020000`), and `db push` refuses a file older than the newest applied one. Not pushed.
