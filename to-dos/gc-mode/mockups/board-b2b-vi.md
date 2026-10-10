---
name: "B2b-vi: the ring on each board row, and the two kernels it and How the stage is going read"
rows: mockups/board-b2b.md (call E3, PR 6 "B2b-vi, the ring", and vii's kernel); BOARD_REAL_BUILD.md (What waits: the ring and How the stage is going); GANTT_PLAN.md (G-59, the walk on the ring card)
branch: this plan on claude/board-b2b-vi-plan (from origin/spike/gc-mode at 95e79f4b9); the code from origin/main in three cuts, none with a migration
status: plan 2026-10-10 by gc 8 at the lead's ask (GC MODE). gc 2, holding the Board, co-signed the scope, E3′ and T by message before this file was written, with three conditions that are written in below (marked *gc 2*). Approved by the lead and merged to the spike (629d858af). vi-a merged as #5361 (v2.5199); its fix, vi-a-2, is #5369 (v2.5204).
---

# B2b-vi: the ring

## What it is

The prototype's ring at the head of each Project Board row (`GcProgressRing`), with the card that opens under it, on real data. It shows how far a job is through the stage it is in:
- **Bidding** counts the steps before our bid can go in: enough quotes, a quote we carry for each trade, quotes confirmed after a plan change, our bid sent.
- **Buying out** counts the Get started checklist, grouped by kind of step.
- **Building** is the percent of the work the trades and our own crew have reported, weighed by what each statement of work is worth.

With it move the two kernels, `stageProgress` (the ring) and `stageHealth` (How the stage is going, which gc 2 draws in vii), and what they need that main lacks: `gcStale` (what changed under a quote), `thousands` and `plansReach`. One lift config, `board-b2b-vi.lift.json`.

## What main has (origin/main 6ad91b81e, v2.5191)

1. **Every name the kernels import is on main but one.** A dry run of `lift-extract` with a draft config resolves all of them: `startChecklist`, `followUps`, the bids and Building kernels, `ourMoveLines`, `walkStanding`, `changeRequestLinesFor`, `priceToOwner`, `projectPeople`, `quotesWantedOn` and the rest. The one it cannot place is `gcStale`'s `lineReads`, which is New project's prototype copy over the prototype's project (call E3′).
   - What the dry run writes: `progress.ts` 358 lines, `stageHealth.ts` 750, `stale.ts` 69, one function each for `words.ts` and the plans' home. About 1,180 lines.
2. **The board's plan sets carry no trades.** `boardProjectFromView` maps every set with `touches: []` (`boardRows.ts:602`). So `bidIsStale` (`bids.ts:90`) is never true on main's board. Compare quotes never says "They priced an older set of plans", and the ring's *Confirm quotes after plan changes* would always read done (call T).
3. **The board's project cannot say what changed under a quote.** Main's `lineReads` reads a `ReachProject` (`lineReach.ts:27, :61`): the index as it stands, the manual and the trades. The board's `GcProject` has no index. Its `ScopeItem` is `{ id, label }` and its `PlanSet` is `{ rev, label, issuedOn, touches }`. The view the mapper reads has all of it: each set's `changedSheets`, `changedSpecs` and `addedLines` (`projectRows.ts:39-59`), each line's `sheets` and `specs` (`:77`), and the index as it stands (`sheets`, `specs`).
4. **The board draws from the bare board.** `<GcBoard state={board}>` (`GcProjects.tsx:1626-1627`). The page already reads, beside it, the layers the ring counts, each behind its own gate:
   - the draws, change orders and the trades' asks for a change, laid as `boardWithChanges` (`:753`);
   - the daily logs and our crew's clock-ins, laid as `boardWithLogs` (`:835`), a dev's while Building is built.
   - Not read board-wide: the schedules (each window reads its own, and Money reads them all while its lens is open, `:1224`), the punch lists and the submittals.
5. **Who may read what the ring counts** (`doors.ts`):
   - the asks, quotes, plan sets and `gc_plan_set_sends`: the office team;
   - `gc_sows` and `gc_sow_lines`: a dev, and the money team reads them (`:68-69`);
   - `gc_schedules` and the schedule's tables: a dev until the schedule's PR 10 (`:87`);
   - `gc_daily_logs`, `gc_punch_items`, `gc_submittals`: a dev until Building's door (`:112-116`);
   - `gc_draws`: a dev, and the money team reads them (`:123`); `gc_trade_change_requests`: a dev until the trade wave (`:82`).
6. **What a missing layer does to the words.** A kernel cannot tell a layer not read from a layer that is empty. With no logs read, `missingLogs` names every working day as having no log. With no schedule read, *The schedule is drawn* reads "not drawn yet". With no draws read, a job being built reads 0%. Hence call L.
7. **The tests.** The dry run keeps 40 of the spike's tests. 16 are on main already (earlier lifts). 11 reach nothing this lift moves. 13 reach it: 8 of `gcStageHealth.test.ts`, and 5 that read the ring card (one each from the daily log, the punch list, the submittals, the stale schedules and the trades' asks). The golden test pins `stageProgress` for every project, stale words included ("Addendum 1 changed panels and feeders, and the trade as a whole.").

## The calls

- **S. Scope with vii.** Both kernels move in vi's one config, with no screen. vii is `GcStageHealth` on main's kernel, and its strip's **set the start date** goes through `setGcProjectStartItem`.
  - *gc 2: yes.*
- **E3′. The stale words on main** (amends board-b2b.md's E3, which assumed the board carries what `lineReach` reads).
  - Main's `stale.ts` is the spike's word for word but one line: `lineReads(reachOf(project), pkg, item)`. `reachOf` is main's own: `{ sheets: project.index?.sheets ?? [], specs: project.index?.specs ?? [], trades: project.packages }`.
  - `GcProject` gains a main-only `index?: { sheets: PlanSheet[]; specs: SpecSection[] }`, the plans' index and manual as they stand after the newest set. It is a new name, never `sheets`. The prototype's `GcProject.sheets` is the *first* index, which `sheetsAtRev` walks forward. One name with two meanings would mislead the next lift.
  - `ScopeItem` gains `sheets?` and `specs?`. `PlanSet` gains `changedSheets`, `changedSpecs?` and `addedLines?`, all in the spike's words. `changedSheets` stays required, as the spike's is: the board maps it from the view, and the trade portal's `setsOf` maps `[]`. (Amended by B2b-vi-a-2, v2.5204: vi-a first made it optional on main, which broke the spike's widening of main's shapes, `gcMainShapes.ts`. A field main lifts keeps the prototype's required or optional.)
  - The spike keeps `gcStale.ts` and `gcProgress.ts` as its own. Its copies walk its own sheets, so re-exporting main's would move the golden test. `gcStageHealth.ts` re-exports main's: it reads only `progress.share`, never the words.
  - *gc 2: co-signed, on condition the difference sits in the config's `pin.known` (as `schedule-pr7c-i` does) and in the fragment, so `lift-same` reads "the same (N known)" and nobody flags it again.*
- **T. Which trades a set touches, on the board.**
  - Where the set went out: the office's word at the send, `gc_plan_set_sends.touched`. That is what the trade portal reads (`tradePortalState.ts:115-121`). A trade is touched when a company asked on it got the set with `touched` true.
  - For a set not sent yet: the New plans window's own guess from the set's rows, `packagesForSheets` and `packagesForSpecs` plus the trades of its `addedLines` (as `GcNewPlans.tsx:218-220` guesses before the office changes it).
  - So the board and the trade's portal agree on every set that went out.
  - The lasting fix, saving the office's touched trades on `gc_plan_sets`, is New project's and stays out.
  - *gc 2: co-signed, on condition the fragment and the comment where it is mapped say that an unsent set's trades are the window's guess until New project saves them, since the ring's Confirm quotes leans on it.*
- **L. Which layers the ring reads, and for whom.** One pure kernel lays them in the page's order. A stage's ring draws only for a reader who can read every table it counts.
  - `boardLayers(board, layers)` lays the layers in the page's order: the draws innermost, the change orders, the trades' side of them, the trades' asks, the logs and clock-ins, then the schedules, punch lists and submittals.
  - `ringStages(role)` reads the stages a reader's ring draws for **from `GC_TABLE_DOORS`**. Each stage names the tables it counts, and a role is in when every one of them lets it read. So a door PR that widens a table widens the ring with no ring edit.
    - Today the office team gets the bidding ring.
    - A dev gets all three.
    - The buying-out ring follows the schedule's PR 10 and the award door. The building ring follows Building's door.
  - A row whose ring the reader may not see keeps the empty column, so rows line up.
  - The page reads the missing layers after first paint, only for the stages the reader may see:
    - the schedules of buying-out and building jobs, all at once, as Money does;
    - the punch lists and submittals of building jobs, one read each.
  - Until a stage's layers are in, its rings draw empty with no count, then sweep in. If a read fails, that stage's rings stay empty, with the reason in their label, and never give a false count.
  - *gc 2: asked for `boardLayers` as a pure kernel the page memoizes, so vii's strip reads the same state and the board and the strip never give two answers. Written in.*
- **C. Three cuts, in order:** vi-a the kernels, vi-b the board's plan sets, vi-c the ring. vi-b is gc 2's file, cut by gc 8 with gc 2's co-sign on the read-back. It goes alone so Compare quotes' new sentence can be reverted on its own.
  - *gc 2: yes, after their v-ii merges.*
- **P. Where `plansReach` lives on main:** `lookups.ts`, beside `currentRev` and `planLabel`, not `plans.ts`. `plans.ts` reads pasted text and imports no project. `lookups.ts` imports only types, so it makes no cycle.

## vi-a: the kernels (no screen, no migration, no deploy)

- **Config** `to-dos/gc-mode/scripts/board-b2b-vi.lift.json` (on the spike, with the follow-up):
  - `gcStale` → `stale.ts` (all), `gcProgress` → `progress.ts` (all), `gcStageHealth` → `stageHealth.ts` (all; `quotesWantedOn` is main's already, `planQuestions.ts`).
  - `gcWords#thousands` → `words.ts` (append), `gcPlans#plansReach` → `lookups.ts` (append).
  - `existing`: the types main has, and `gcNewProject.ts#lineReads` → `lineReach.ts`, the one hand line (E3′).
  - `types`: `ScopeItem` gains `sheets`, `specs`. `PlanSet` gains `changedSheets`, `changedSpecs`, `addedLines`. Each is written in the spike's words.
  - `tests`: the five spike files with the 13 tests; the other tests the tool keeps are dropped by title by hand, as the schedule's 9c dropped its 21, and the config's `about` names the 13.
- **By hand, and nowhere else:**
  - `stale.ts`'s `lineReads(reachOf(project), …)` and `reachOf`;
  - `GcProject.index` in `types.ts`.
- **Test data:** `schedule/testState.ts` regenerated with `--with board-b2b-vi.lift.json`, keeping the earlier field order: pr7c-i's, then B2b-i's `GcCustomer.past` (*gc 2*). The generator also writes each project's `index` from the spike's own walk (`sheetsAtRev` and the manual at the newest set), so main's kernels read the same words on the same data. That is a small change to `schedule-test-state.ts`; gc 7 checks it as the scripts' keeper.
- **Tests on main:**
  - the 13, moved: `stageHealth.test.ts`, then `progress.log.test.ts`, `progress.punch.test.ts`, `progress.submittals.test.ts`, `progress.stale.test.ts` and `progress.changes.test.ts`;
  - `progress.direct.test.ts`: each test project's ring as the golden reads it, with its center, headline, each group's done of total and its first items, and the *Also* lines. The readings are in *The check* below;
  - `stale.direct.test.ts`: the two Boerne quotes the golden names, word for word, and a project with no `index` naming no line but still the trade, so a board that maps no index never invents one.
- **`lift-same`:** every moved declaration the same, with E3′'s two differences in `pin.known` (`reachOf`, and `staleChange`'s one line).
- **Release note** (one bullet, the kernels behind the ring and How the stage is going); the fragment names E3′ and the `index` field.

## vi-b: the board's plan sets (gc 2's files, cut by gc 8; after v-ii)

- `loadGcBoardRows` (`gcIo.ts`) reads `gc_plan_set_sends` (`set_id`, `company_id`, `touched`) in v-ii's round-one `Promise.all`, filtered by the board's set ids, or paged with `fetchAllRows` if not. Then it adds `planSetSends` to `BoardRows` and its return.
- `boardProjectFromView` (`boardRows.ts`) maps:
  - each line's `sheets` and `specs`, left out when null;
  - each set's `changedSheets`, `changedSpecs` and `addedLines`;
  - `index` from the view's `sheets` and `specs`;
  - `touches` by call T, in a small pure `setTouches(view, set, sends, invites)`, with the comment *gc 2* asked for.
- **What a person sees change:** Compare quotes marks a quote priced on older plans and says "They priced an older set of plans, so ask them to confirm." The trade portal already read this.
- **Tests:** `boardRows.test.ts` covers a sent set (the office's word, including an unticked trade the guess would have taken), a set not sent (the guess), and a company on two trades. `gcIo.boardRows.test.ts` covers the read.
- **Release note:** "Compare quotes now marks a quote priced on plans that changed since." The fragment names T and the guess.

## vi-c: the ring on each row

**Where:** the Project Board on [GC projects](/gc), the first column of every row, By stage and By customer alike. Nothing else on the row moves. The ring is one prop and one column. The Who to call span (`data-gc-board-people`), the By customer branch and the days block stay as they are (*gc 2*).

```
 wide (≥ 761 px):  3.5rem │ 7rem │ minmax(0, 1fr) │ auto │ auto
 ┌────────┬───────────┬──────────────────────────────────────────────┬──────┬───────────────────────┐
 │  ╭──╮  │  6 days   │ Boerne Retail Shell                           │ ▢ ▤  │              $824,733 │
 │  │14│  │   left    │ Cibolo Creek Partners · drawn by Marsh & Vale │      │ so far, with 4 holes  │
 │  │/25│ │           │ [Who to call]                                 │      │                       │
 │  ╰──╯  │           │                                               │      │                       │
 └────────┴───────────┴──────────────────────────────────────────────┴──────┴───────────────────────┘
   the test data's Boerne on its day (2026-10-02); amber ring, 56 px, 14 of 25 filled; a closed ring draws a hollow check over its count

 narrow (≤ 760 px): 3.5rem │ 6.5rem │ minmax(0, 1fr); the links and the price take the line under, as now
```

The card under the ring opens on hover, keyboard focus or a press, and a press keeps it open. Escape or a press elsewhere closes it. Its words come from `stageProgress` as they stand. The fixture's Boerne, as main's test data reads it:

```
 BIDDING TO THE CUSTOMER
 14 of 25 steps done before our bid can go in.

 Get 2 quotes for each trade                                    4 of 7
 ▬▬▬▬▬▬▬▬▬▬▬░░░░░░░░
  • Structural steel · 0 of 2 in. 1 still asked.
  • Roofing · 1 of 2 in. 1 still asked.
  • Fire sprinkler · 0 of 2 in. Ask more companies.
  Done: Sitework, Concrete, HVAC, Electrical

 Pick the quote we'll use for each trade                        3 of 8
 Our price needs a real quote for every trade. Our own guess fills the price but does not count.
  • Structural steel · No quote yet.
  • Roofing · Summit Roofing, 112K + ?. 1 line has no cost yet: roof curbs. Set it in Compare quotes.
  • HVAC · 2 quotes in. Pick one to carry.
  and 2 more
  Done: Sitework, Concrete, Plumbing

 Confirm quotes after plan changes                              7 of 9
 A quote priced on older plans has to be confirmed after a change.
  • Cool Breeze Mechanical on HVAC · Priced on Bid set. Addendum 1 changed the HVAC sheets. Ask them to confirm.
  • Voltage Brothers on Electrical · Priced on Bid set. Addendum 1 changed panels and feeders, and the trade as a whole. Ask them to confirm.
  Done: 7 quotes are on Addendum 1.

 Send our bid                                                   0 of 1
 The last step here. Send our price to the customer.
  • Not sent yet · Due Thu Oct 8

 Also
 3 companies need a call. See Follow up.
 5 of 13 companies have not opened Addendum 1.
```

Helotes, buying out, reads "14 of 25 steps done before work can start." over seven groups, from *Our contract, permit and start date* to *Get the statement of work signed*. Fair Oaks, building, reads "74%" and "74% of the work is done, by what the trades and our own crew have reported." Its *Also* lines lead with the schedule, the failed inspection and the walk, then the punch list, the draws, the log, the submittal and the trade's ask. A reader outside a stage's doors (call L) sees no ring on that stage's rows. A ring still reading its layers is an empty track whose label says "Reading the schedule."

- **Files:**
  - `GcProgressRing.tsx` (new): the spike's component word for word but its import, the types from `../../lib/gc/progress`. It sets `aria-label` as the spike does and draws its card the way main's `GcPeoplePill` does, which CI passes.
  - `GcBoard.tsx`: `ProjectRow` gains the column and a `ring` prop, and `GcBoard` takes `ringState` and `ringStages`.
  - `GcProjects.tsx`: the layer reads and the `boardLayers` memo, after v-iii's money state (*gc 2*'s order: v-ii, v-iii, vi-c, vii).
  - `src/lib/gc/boardLayers.ts` and `src/lib/gc/ringStages.ts` (new, pure).
- **Tests:**
  - `boardLayers.test.ts`: the order, and that each layer reads as before when it is not given;
  - `ringStages.test.ts`: today's answer for each of the five office roles, and that each stage's tables are named in `GC_TABLE_DOORS`, so a table renamed or dropped fails here;
  - `GcProgressRing.render.test.tsx`: the count, the headline as its label, the card on a press, Escape, and the check at 100%;
  - `GcBoard.render.test.tsx`: a ring on each row a reader may see, none on the others, and the Who to call pill still in place.
- **Window checks:** the five window checks (`check:status-bar`, `check:dialog-role`, `check:backdrop-click`, `check:nested-windows`, `check:window-z`) and the theme check. `RING_COLORS` and the card's two marks are saturated status colors, which stay literal.
- **The guide**, `see-where-every-gc-project-stands.md`. A new section after *See the board by customer*, and *What comes next* amended to "So does the ring on each row" rather than a new line (*gc 2*). Draft, in plain words:

  > ## See how far a job has come
  >
  > Each row starts with a ring. The ring fills as the job gets through its stage.
  >
  > - **Bidding** counts the steps before our bid can go in. The middle says how many are done, like 14/25.
  > - **Buying out** counts the steps on Get started.
  > - **Building** shows the percent of the work the trades have reported.
  >
  > 1. Point at the ring, or press it to keep its card open.
  > 2. The card lists what the ring counts, by type. What is left is spelled out. What is done is one line.
  > 3. The lines under *Also* are worth knowing. The ring does not count them.
  > 4. Press Escape to close the card.
  >
  > A full ring draws a check over its count. Some rings show only to the people who can read everything they count.

- **Release note:** "Each GC project on the board has a ring that fills as the job gets through its stage. Point at it to see what is done and what is left." Fragment, `PROJECT_DOCUMENTATION.md` and `GLOSSARY.md` (*the ring*).

## Seams

- **gc 2's vii** reads `boardLayers`' state for How the stage is going, as is, so the strip and the ring give one answer.
- **The schedule's PR 10 and Building's door** widen the ring by their doors alone (call L). Their PRs need no ring edit, and `ringStages.test.ts` pins today's answer, so the door PR updates that one line.
- **The Portal (gc 3):** T reads the same `gc_plan_set_sends.touched` as `tradePortalState.ts`. If the Portal changes what *touched* means, the board follows.
- **New project:** saving a set's touched trades on `gc_plan_sets` would retire T's guess for an unsent set.

## The spike's follow-up (after vi-a merges)

From the spike at its head: merge main, `lift-reexport --write` for `words`, `lookups` and `gcStageHealth`, pin the config to the merge commit and the spike's head with E3′'s `known`, then `lift-same --all` and `tsc -b` at a 12 GB heap. `gcStale.ts` and `gcProgress.ts` stay the spike's own (E3′). The golden test does not move. gc 7 checks the follow-up before the lead merges it.

## The check

- vi-a: `progress.direct.test.ts` pins the five test projects' rings as above: Boerne 14/25, Padb 1/6, Helotes 14/25, Fair Oaks 74%, Stone Oak 100% with its check. `lift-same` reads the same with two known.
- vi-b: on prod, read only. As a dev, Compare quotes on the bidding test project (c4117b0d) says what its sets' sends say. Nothing is pressed.
- vi-c: at a desk and at 375 px on the dev server, as a dev and through View as an estimator. The estimator sees bidding rings only, and the rows line up.

## Left out

- A stop for the ring in *New here?* Main's tour has none yet. The spike's stop words are ready for a later tour pass.
- The ring on the trade partners' and the customer's windows: the spike has none either.
- Saving touched trades on `gc_plan_sets` (T's lasting fix): New project's.
- `GcStageHealth` and its strip: vii, gc 2's.

## Is this the best we can do?

1. **Draw every ring for everyone now, and let empty layers read as empty.** Simpler, but it would tell an estimator a building job is at 0% and has no log all week. A false count is worse than no ring. Not picked.
2. **Gate each stage by a hand list of roles, like `canUseGcBuilding`.** That is one more list for every door PR to remember. Reading `GC_TABLE_DOORS` lets the ring follow the doors with no edit, and the test fails if a stage names a table the doors do not have. Picked.
3. **One cut instead of three.** Fewer read-backs, but vi-b changes what Compare quotes says on prod data, and that should be revertible alone. vi-a is kernel only and reviewed by `lift-same`. Three cuts picked.

For See, Tell and Chase: the ring is See. Its card's *Also* lines Tell, and they point at the screen that Chases (Follow up, Closeout, the Schedule tab). Nothing here sends or writes.

## Status

Plan written 2026-10-10 by gc 8 from origin/main 6ad91b81e and origin/spike/gc-mode 95e79f4b9: a dry run of `lift-extract` with a draft config in the scratchpad, the spike's fixture read for the words above, and file:line facts on main. gc 2 co-signed S, E3′, T, L's seam and C by message; their conditions are written in. Nothing cut or claimed. Next: the lead's read-back, then vi-a.
