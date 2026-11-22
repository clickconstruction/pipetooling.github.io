# 20261122030000_start_check_arrive_again.sql (2026-11-21, v2.8238)

Before we start, on arrival: a stage is asked about again after a No, and a later No is kept. Punch list #382, two calls from the audit of PR 10, on Taunya's word of 2026-11-21. It adds one function, `start_check_to_look`, and replaces two, `start_check_arrival_state` and `start_check_arrive`, with the same signatures and the same grants. No table, so no closing calls.

## What was lost

A stage was asked about once and answered once. Two answers were lost by that.

- **After a No, nobody was asked again.** Hector says **No** on *The slab is poured.* The office calls, and the customer says it is poured now. That new yes is the one that most needs one of ours to see it. The next person on site was asked nothing, and only a dev deleting the arrival opened the stage again.
- **A No after a yes was refused.** The first of two presses **Yes, all as told**. The second, whose card was already open, says **No** on the slab. The second was refused. A No is the dearer of the two answers: it is the one that saves a wasted trip.

## The rule now

What there is to look at is worked out in one place, `start_check_to_look(fixture)`, and the read and the door both use it. They disagreed once, and that was the fault `20261121150500` fixed.

| The stage | What there is to look at |
|---|---|
| Nobody has arrived | The bullets on them that nobody of ours has seen. As before. |
| Someone has arrived | The bullets that had a No, that have a yes standing on them now, and that nobody of ours has seen. |

A No takes every yes on its bullet back. So a yes that stands on such a bullet was given after the No, by the office or on the GC's page.

A bullet with a No and no new yes is not asked about: nothing new was told us. A bullet written after the first arrival is not asked about either.

The door, once someone has arrived:

| The send | What the door does |
|---|---|
| An answer to what is asked again | Kept as a new arrival. Each one as told becomes a yes we saw. Each No opens its bullet again and sends Dispatch its line. |
| A No on a bullet that stands as a yes we saw | Kept as a new arrival of its own, with its line to Dispatch. It takes that yes back and writes no other yes, since the card it came from may be an old one. |
| A No on a bullet that is not asked about, while something is | Refused: *The list has changed. Open it again.* The card reads the list again and shows what is asked. |
| **Yes, all as told** with nothing asked again, or a No that already stands | Refused by name, as since `20261121150500`: *Hector Helper already answered for this stage.* |

So a second yes still cannot replace a No.

## Who may call what

- `start_check_to_look(fixture)` is `SECURITY DEFINER` and granted to `service_role` alone. `PUBLIC`, `anon` and `authenticated` are revoked. The read and the door call it as their owner.
- `start_check_arrival_state` and `start_check_arrive` keep their grants: `authenticated` and `service_role`, never `anon`. Who they refuse is unchanged.

## Left as it is

- **The office reads the newest arrival.** A stage with two arrivals reads the later one's name and day. When the first said No on one bullet and a later one said No on another, the first bullet is still open on the list but its line no longer reads *said No on site*. The client's rule (`startCheckRows.ts`, `saidNo`) is not changed here.
- **The card does not send the list it showed.** An answer to what is asked again marks every bullet asked about, so a card left open across the office's new yes could still mark a bullet it never showed. Closing that takes a third argument on the door and a client change, and is not built.
- **The red stays until one of ours answers again.** A stage with a No reads *Not as told* from the newest arrival, also after the office has a new yes. It clears when the bullet is seen.

## Deploy

No client change needs it. The card already draws the list the read gives it and already shows a refusal's words. Pushed right after the merge, on a go that names it.

`start_check_to_look` is new on the schema, so the types and the dev seat's catalog are regenerated after the push, in a types PR of their own.

## Tested

`supabase/tests/start_checks/30_arrive.sql`, now 38 checks. The twelve new ones:

- A later No on a bullet we saw as a yes is kept as a second arrival, with its line to Dispatch, and it took that yes back and wrote no other.
- A No that already stands, and a later **Yes, all as told**, are each refused by name.
- A No with no new yes asks nobody again. A new yes on that bullet asks about the stage again, and about that bullet alone.
- A No from an old card, on a bullet that is not asked about, is sent back to read the list.
- **Yes, all as told** on what is asked again is kept: the bullet is a yes we saw, in the name of the person who looked.
- Nobody signed in may call `start_check_to_look`.

`scripts/pgtest-start-checks.sh` applies this migration twice, after the three before it. Docker does not run on the Mac this was written on, so the SQL beds workflow is the bed's first run.
