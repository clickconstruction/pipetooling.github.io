---
name: "B2b: the people count and the ring, Who to call on the board, both windows' Activity, the customer's money, and By customer"
rows: BOARD_REAL_BUILD.md (What waits, :295-320; The PRs, in order, row 9, :467-473; Left for B2b, :608); board-b6d.md (the customer window's first cut, which B2b fills); SCHEDULE_REAL_BUILD.md (PR 9, done)
branch: this plan on claude/board-b2b-plan (from origin/spike/gc-mode); the PRs from origin/main
status: plan 2026-10-10 by Helper 2 (gc 2, the Board lane) at the lead's ask, for a read-back before any code. Nothing cut or claimed.
---

# B2b: the people count and the ring

## What it is

BOARD_REAL_BUILD's last Board row, *the people count and the ring*:
- **The functions in *What waits*:** the prototype's people count, its counts, the ring (`stageProgress`) and *How the stage is going* (`stageHealth`).
- **The screens that read them:**
  - Who to call on each board row;
  - the ring and its card, and *How the stage is going*;
  - Follow up's **Work the list**;
  - the Dashboard's Needs you lines;
  - the company window's Activity;
  - the customer window's Activity, money and other papers;
  - By customer.

Every lane it waited on has landed:
- Building's U2 (v2.4841);
- Owner Billing's O2a and O2b (v2.4842, v2.4922);
- the schedule's PR 9 (9a to 9d, done by v2.5142).

So it can be cut now, in eight PRs (below).

## What main has (origin/main 939424be9, v2.5171)

1. **Ten of the plan's 27 functions are on main word for word already.** The schedule's PR 7c-i (v2.5059), B3-c and U2 lifted them, and the spike's copies re-export main's.
   - `projectPeople` (`projectPeople.ts:103`), `projectFollowPeople` (`:308`);
   - `callList` (`schedule/callList.ts:426`), `callRows` (`:435`), `callListFollowPeople` (`:631`, no caller);
   - `scheduleReasons`, `barReasons` and `unconfirmedStarts` (`schedule/counts.ts:211, :325, :99`);
   - `partnerWork` (`companyFile.ts:314`);
   - `buildingActivity` (`buildingActivity.ts:21`, no caller).

   No board component calls `projectPeople` yet. Only the schedule's call list reads them.
2. **`customerDocuments` is on main, changed:** our contract's rows only (B6-d-ii, `customerContract.ts:122`). The spike's (`gcCompanyFile.ts:165-248`) also lists the pay applications sent, a late bill and its reminders, and the change orders. B2b merges the two; it cannot be a word-for-word lift.
3. **Not on main.**
   - **Small:**
     - `priceToOwner`, `ownerMoney`, `customerSummary` (`gcCustomers.ts:18-72`; needs `GcCustomer.past`);
     - `customerGroups`, `boardSectionCounts` (`gcBoardGroups.ts:33-64`);
     - `ourMoveLines`, `pastContract`, `gcScheduleMovesNeedsYou`, `boardFollowPeople` (`gcCounts.ts:186-250`);
     - `customerActivity` (`gcCompanyFile.ts:251-274`);
     - `thousands`, `plansReach`.
   - **Medium:**
     - `allPeople` and `allFollowPeople` (`gcProjectPeople.ts:33-116`);
     - `ourScheduleMoves` with `readMoves` (`gcCounts.ts:102-183`);
     - `partnerActivity` (`gcCompanyFile.ts:61-162`);
     - `customerPaper` (`:280-365`, with prototype words to replace);
     - `gcNeedsYou` (`gcNeedsYou.ts`, 89 lines);
     - the Follow up sheet's draft and mail kernels (`gcFollowUpSheet.ts:40`, `gcCompanyPeople.ts:34-100`);
     - `gcStale` (76 lines, which B5 left behind).
   - **Large:** `stageProgress` (`gcProgress.ts`, 361 lines) and `stageHealth` (`gcStageHealth.ts`, 755 lines).

   About 1,700 lines of kernel code in all, not the 1,400 to 2,000 per lane the plan once guessed.
4. **The screens.**
   - **Not drawn on main:**
     - Who to call on a row (`GcBoard.tsx:22` says it comes with B2b);
     - the ring;
     - *How the stage is going*;
     - **Work the list** (`GcAskThread.tsx:17`; `GcCallList` takes `onWorkList`, which `GcSchedule.tsx:710` never passes);
     - the company window's Activity (`CompanyTab` has no `activity`, `gcCompanyOpener.ts:11`);
     - the customer window's Activity and money;
     - By customer (`GcBoardStages.tsx:80-82` holds the switch's slot).
   - **What the spike draws them with:**
     - `GcPeoplePill` (210 lines), `GcProgressRing` (247), `GcStageHealth` (658) and `GcFollowUpSheet` (505);
     - `CompanyActivity`;
     - its 644-line customer window;
     - the By customer headings.
   - **Writes the spike gets from its reducer that main does not have:** the sheet's sends and calls, a customer's logged contact, and the health strip's `setStartDate`.
5. **The Dashboard's GC Needs you** is one line, `gc-follow-up`.
   - **What it counts:** `gcFollowUpNeeds`, the quote asks that need a call, over a seven-table slice (`followUpNeedsIo.ts`, read on demand so the Dashboard's chunk stays small).
   - **What the spike has:** five GC lines (`gc-follow-up` from `gcNeedsYou`, `gc-schedule-moves` from `gcScheduleMovesNeedsYou`, and three more).
   - **Ready but never called:** three Needs you kernels on main, `gcStaleSchedulesNeedsYou`, `gcChangeRequestsNeedsYou` and `gcBackChargesNeedsYou`.
6. **The board's state:**
   - `ownerBilling` is null (`boardRows.ts:591`).
   - Each customer's `contacts`, `payDays` and `retainagePct` are empty or null (`:664`).
   - There is no customer call log: "No call log is kept for a customer yet" (`:663`), and no table for one.
7. **The lift tooling** lives on the spike (`to-dos/gc-mode/scripts/`): `lift-extract`, `lift-append`, `lift-same` and `lift-reexport`. The B-lane configs (board-b2-i to b5-b) and `schedule-pr7c-i.lift.json` are the templates for counts and people.

## Calls for the lead

- **E1. The Check, restated.**
  - **Why:** the plan's Check ("the Follow up badge, Work the list and Needs you all equal the board rows' sum") cannot hold. `allPeople` counts a person once across their jobs, and it adds what a company owes apart from any job (insurance run out, a promise, a W-9). So the rows' sum can be higher or lower than the count.
  - *My pick:* the badge, Work the list and Needs you each equal `allPeople(state).count`, and each row shows its job's `projectPeople` share. A test holds the three to one number on the fixture and on mapped rows.
- **E2. A customer's call log.** The customer window's Activity can **Log a contact** (the spike's `logCustomerContact`). Main has no table for it.
  - *My pick:* a small migration in B2b-v, `gc_customer_contacts`, after `gc_company_contacts`. It is append-only, the office team's, and has its three house calls. The board maps it into `GcCustomer.contacts`, which the call list's customer rows already read.
  - *Or:* the customer's Activity reads only what the app knows (sends, pay applications, change orders), with no log until later.
- **E3. The ring's stale part.** `staleChange` and `staleWords` read the prototype's `lineReads`, not main's `lineReach.ts:61` (v2.4845 says the two differ).
  - *My pick:* lift `gcStale` onto main's `lineReach`, recorded as the lift's one known difference, so the ring reads what the board reads.
- **E4. Needs you's load.** The full count (`gcNeedsYou` over `allPeople`) reads most of the board, not the seven-table slice.
  - *My pick:* the Dashboard's hook loads it on demand, after first paint, as it does today, through a widened slice. That means asks, quotes and the call log, plus promises, papers and sends, the schedule's late moves, and Building's unconfirmed starts. Never Our number or the money.
  - A measured check on the test project's size comes before the cut.
  - The three Needs you kernels already on main (stale schedules, change requests, back charges) join as their own lines, with their lanes' OK, so the Dashboard's GC lines match the spike's five.
- **E5. Work the list's writes.** The sheet's sends and calls replace reducer actions:
  - a call logs through `logGcAskContact`;
  - a paper send goes through `sendCompanyPaper`;
  - an ask's nudge goes through `gc-trade-email`;
  - a customer's call goes through E2's log.
  - *My pick:* every write the sheet makes is a press that main already has, with no new write path. A send needs the reader's own gate (`canUseGcBoardWrites`, `canSendGcTradeEmail`) as each window does today.
- **E6. The order.** *My pick:* the eight PRs below, in order, each read back before it is cut. Who to call and the shared count go first, since they are what the board has been missing longest.

## The PRs, in order

1. **B2b-i, the kernels** (no screen, no migration).
   - **What moves:** the small and medium kernels in item 3, lifted word for word with a `board-b2b-i.lift.json` and `lift-same`:
     - `priceToOwner`, `ownerMoney`, `customerSummary` (with `GcCustomer.past`), `customerGroups`, `boardSectionCounts`;
     - the counts (`ourScheduleMoves`, `readMoves`, `ourMoveLines`, `pastContract`, `gcScheduleMovesNeedsYou`, `boardFollowPeople`);
     - `allPeople`, `allFollowPeople`, `partnerActivity`, `customerActivity`, `gcNeedsYou`, `thousands` and `plansReach`.
   - **Tests:** the spike's own, moved with them, and E1's single-count test.
   - **Follow-up:** the spike re-exports them (`lift-reexport`).
2. **B2b-ii, Who to call and the one count.**
   - **The board:** `GcPeoplePill` on each row, its job's `projectPeople` share opening `PeopleRows`, which is on main.
   - **The badge:** Follow up's reads `allPeople`.
   - **Needs you:** the Dashboard's `gc-follow-up` line reads `gcNeedsYou` through E4's widened slice. `gc-schedule-moves` joins it, and the three ready lines with their lanes.
   - **Check (E1):** badge = Needs you = `allPeople` count on the test project.
3. **B2b-iii, By customer.**
   - The switch in `GcBoardStages`' slot, with `customerGroups` and the customer headings (`GcCustomerHeading`, `GcStageSubheading`).
   - A section's worth by `priceToOwner`: the price the customer pays once signed, ours until then. `proposalTotals` stays for the bidding view.
4. **B2b-iv, the company window's Activity.** Its tab (`CompanyTab` gains `activity`) draws `partnerActivity`. **Log a contact** goes through `logGcAskContact`, the write Follow up already uses.
5. **B2b-v, the customer window's Activity, money and papers.**
   - **E2's migration:** `gc_customer_contacts`, if picked. Its bed covers the append-only rule, the office door and the house calls.
   - **The window:**
     - Activity (`customerActivity`, **Log a contact**);
     - Documents (main's `customerDocuments` merged with the spike's pay applications, late bills and change orders);
     - money rows (`ownerMoney`), for the money team only. The board lays Owner Billing's rows over its state, as `billCustomer.ts:99` does, behind `canSeeGcMoney`.
     - `customerPaper`'s pane, with the prototype's "In the real build…" words replaced by the file's link, now that B6-d keeps it.
6. **B2b-vi, the ring.**
   - `stageProgress`, lifted with `gcStale` onto main's `lineReach` (E3).
   - `GcProgressRing` on each row, and its card.
7. **B2b-vii, *How the stage is going*.**
   - `stageHealth` and `GcStageHealth` under a project's title.
   - The strip's **set the start date** goes through `setGcProjectStartItem` (B6-c-ii). Its other writes are presses main already has.
8. **B2b-viii, Work the list** (`GcFollowUpSheet`, E5), with the call list's `onWorkList` wired in `GcSchedule.tsx`. It comes last, since it draws on every count above.

Each PR gets its release note and fragment, its guide where a screen changes, and its docs. Every screen PR has a render test. The kernel PR has the spike's tests and `lift-same`'s table.

## Out

- The award door (the owner's door calls).
- The loader's switch to `gc_company_paper_states`, owed after Building's D1.
- `buildingActivity`'s screen: Building's.
- Anything the spike's reducer did that has no write on main, beyond what E2 and E5 name.

## Is this the best we can do?

- **Eight PRs is a lot for one row of the plan.** The row hid six screens. Each is small enough to read back and to revert alone. The kernel PR first means the screens are just wiring.
- **E1 changes a Check the plan wrote.** The count it asked for would be wrong. The restated one is the number the office acts on.
- **The widened Needs you read is the one real cost.** It is measured before the cut, and it stays on demand.
- **What it does not close:** a person reached on several jobs still shows on each job's row. That is by design, since the row is the job's share, and the count is once.

## Status

Plan written 2026-10-10 by Helper 2 (gc 2), from:
- an inventory of origin/main at 939424be9 against origin/spike/gc-mode at c6d0ed4ca (file:line above);
- BOARD_REAL_BUILD's rows named in `rows`.

Nothing is cut or claimed. The calls E1 to E6 come first.
