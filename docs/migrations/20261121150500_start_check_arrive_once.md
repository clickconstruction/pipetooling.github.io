# 20261121150500_start_check_arrive_once.sql (2026-11-21, v2.8178)

Before we start, on arrival: a stage is answered once. Punch list #382, from the audit of PR 10. It replaces one function, `start_check_arrive`, with the same signature and the same grants. No table, so no closing calls.

## The fault

`start_check_arrival_state` asks about a stage only while nobody has arrived at it. The door, `start_check_arrive`, took a row lock on the stage line to hold two arrivals apart, and then never looked for the first one.

Two of ours reach a site together, and both have the card open.

1. Hector says **No** on *The slab is poured.* and sends. The stage turns red and Dispatch gets its line.
2. Luis's card was read before that. He presses **Yes, all as told**.
3. The slab was still on the list to look at, since a No leaves it with no yes we saw. So the door kept Luis's press: a second arrival, and a yes we saw on the bullet Hector said No to.
4. The office reads the newest arrival. Its stage stopped being red, and the No was gone from its list. Dispatch's line was the only trace.

## The rule now

After the lock, the door reads the stage's first arrival. When there is one it refuses, with error code `22023`, in words that name who answered: *Hector Helper already answered for this stage.* Nothing is written.

- The check is before the list is read, so a stage that was answered says who answered and not *There is nothing left to look at on this stage.*
- A dev can still delete an arrival (`start_check_arrivals_delete`). That opens the stage to be asked about again.
- It is the read's own rule, held at the door: the first of ours to answer has answered for the crew.

## Deploy

No client change needs it and no client is misread by it. The card shows the refusal's words as it shows any other. Pushed right after the merge.

## Tested

`supabase/tests/start_checks/30_arrive.sql`, now 26 checks: a second answer at a stage that had a No is refused by name, and it kept nothing, one arrival and no yes on the bullet. The check for a stage with nothing to look at moved to a stage nobody has arrived at. `scripts/pgtest-start-checks.sh` applies this migration twice with the two before it. Docker does not run on the Mac this was written on, so the SQL beds workflow was its first run.
