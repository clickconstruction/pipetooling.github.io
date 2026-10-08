---
name: Dispatch residuals
number: 12
group: residual
status: item 1 shipped v2.3567 (the phone self-heal) · item 3 shipped v2.3637 (the tag-slice refresh) · item 2 low · item 6, the hub's mode gaps, pinned v2.4986 (a to c bugs, d to f owner calls)
summary: >
  Dispatch blocks / nudge history on the sheet rows. The phone-request self-heal shipped v2.3567
  (the inbox sweep covers add_job_phone as it covers link_job_pictures); the tag-slice refresh
  shipped v2.3637. The hub's six mode gaps are pinned in its mode rule as item 6 (v2.4986).
next: Fix the hub's mode gaps a to c (two strips on screen at once), one row each in hubModes.ts, and take d to f to the owner. Then the sheet-row history when the feed or the email log grows a per-sheet key.
size: S
blocker: None.
ver: from v2.2880 / 83 · item 1 v2.3567 · item 3 v2.3637 · item 6 v2.4986
opinion: later — two of three shipped; the one left waits on a per-sheet key the feed and the email log do not carry yet.
mockup: not required — draw the sheet-row history when it is picked up
---

# Dispatch: the small reads the inbox and the sheet rows never make

## The items (validated 2026-09-06)

1. ~~**Self-heal for `add_job_phone` requests**~~ — shipped v2.3567: — `useDispatchInbox`'s sweep retires only orphaned `link_job_pictures` requests; the phone analogue (jobs whose `customer_phone` was set outside the Job form, or before the request) is the same kernel shape with `customer_phone` added to the sweep's `jobs_ledger` read.
2. **Dispatch blocks on the Work row and the nudge history on the Sent row** (the sheet-story mock-up's marks 3 and 5) — the two reads the Subs tabs never make; add when the feed or the email log grows a per-sheet key.
3. ~~**Tag slices on the bulk cost map**~~ — the staleness shipped v2.3637 (`tagSliceForOneJob`: the post-save refresh recomputes the job's slices with its total). A server-side `sum by job_id` remains the durable form for the bulk map's cost as the allocations table grows — not needed at 2,060 rows.
4. **The move sheet's person list carries ZZ TEST and twin accounts** (from the phone look, #30, 2026-09-28): the press-and-hold Move sheet on a phone lists every person, sample and twin rows included; the schedule hub hides them (v2.3737) and the sheet should read the same list.
5. **The *Add Task* banner takes the top of the phone page** (#30, 2026-09-28): on a phone the banner sits above the content instead of folding into the header; one small layout change.
6. **Modes exclusion, pinned as of v2.4986.** `useScheduleDispatchHubModes` keeps the hub's mode rule exactly as the page had it, gaps included. Each line below is one row of the table in `src/lib/scheduleDispatch/hubModes.ts`, so a fix is that row plus the same flip in `hubModes.test.ts` (the row's line in its `KEPT_ON` list goes too).
   - a. `urlArm`, **bug**: following a `?placeJob=` link ends placement, the + menu and multi-cell but leaves linked copy and the picker on, so the placing strip and the linked-copy strip show together.
   - b. `openAddBlock`, **bug**: opening the add-block window leaves linked copy on, its strip still showing behind the window and after it, and leaves `?placeJob=` in the URL until the window shuts.
   - c. `tabAway`, **bug**: the Jobs or Day tab leaves linked copy and the picker on, so the linked-copy strip shows on a tab where its blocks cannot be picked.
   - d. `weekNav`, owner call: the week arrows end every mode but multi-cell, which `weekChanged` ends once the new week renders.
   - e. `openCellPicker`, owner call: a cell's + ends nothing, so the picker can open over a move, a copy, a linked copy or a placing strip.
   - f. `escapePlacement`, owner call: Esc while moving or copying also ends the placing strip, its cell and `?placeJob=`, while Esc in linked copy or multi-cell ends only that mode.

## Where it plugs in

- `src/hooks/useDispatchInbox.ts`, the Subs → Work / Sub Labor rows (`src/components/jobs/`), the paged Banking loaders (v2.2870).
- Item 6: the rule table `src/lib/scheduleDispatch/hubModes.ts` and its test, and `src/hooks/useScheduleDispatchHubModes.ts` with its render test, which names each gap on its rows.
