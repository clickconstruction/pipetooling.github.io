---
name: "GC mode spike: the punch list, for whoever picks it up next"
parent: to-dos/gc-mode/README.md (punch list #81) · HANDOFF.md (the lanes' handoff, 2026-10-05)
status: written 2026-10-06 at the owner's ask ("save what is left to a spike punchlist so that another user tomorrow can pick up where we left off") · **the second sitting of 2026-10-06 built every box under Prototype work left** (Phases 2 to 5 of the Gantt, the Ask window's two doors, the tour's stops, the two browser checks); what stays open is the owner's calls · **closed for the Gantt 2026-10-06**: four rounds of helper sessions built the rest of GANTT_FEATURES.md (HELPERS.md), and the Gantt's real build is SCHEDULE_REAL_BUILD.md · everything below is on origin/spike/gc-mode · the branch still never merges
summary: >
  Where the GC mode prototype stands after the owner's 2026-10-05 and 2026-10-06 sittings (the
  Gantt, the Ask window, Follow up's two views, the address editor), how to run and check it, and
  every open item in one numbered list with where to look. Tick a box when you ship it, in the
  same commit.
---

# GC mode spike: the punch list

## Start here, in five minutes

1. `git fetch origin && git checkout spike/gc-mode`, `npm install`, copy `.env` and `.env.local`
   in from the main checkout (worktrees have none), `npm run dev -- --port 5261 --strictPort`.
2. Open `http://localhost:5261/dev-login?as=1&to=/bids/gc`. **Start over** (top right) resets the
   made-up data; so does a reload. The fixture's today is Fri Oct 2, 2026.
3. Check it as the branch is checked (all green on 2026-10-06):
   - `VITE_SUPABASE_URL=http://x VITE_SUPABASE_ANON_KEY=x npx vitest run src/lib/gcMode src/components/gc src/lib/dashboardNeedsYou.test.ts` (127 files, 1626 tests; the golden test unmoved)
   - `npm run typecheck` (about 10 minutes; read the exit code, not the wrapper's)
   - `node scripts/theme-tokenize.mjs --check src/components/gc`
4. Read `GANTT_PLAN.md` (the schedule as a Gantt: what is built, phase by phase, and the owner's
   calls) and `GANTT_FEATURES.md` (every feature numbered G-01 to G-146 with where it stands; cite
   the number in commits). `HANDOFF.md` is the five lanes' handoff from 2026-10-05 and still holds
   the rules of the branch; `README.md` → *What the prototype has* walks every screen.
5. Keep the branch's rules: the golden test (`src/lib/gcMode/gcModel.test.ts`) passes without `-u`
   (a moved snapshot is a behavior change and needs the owner's OK); shared files take additions
   only; new logic goes in a new file for its area; a new action type plays in its own test and is
   added to the golden test's `used.add(...)` list, the way `undoScheduleMove` is.

## What landed on 2026-10-05 and 2026-10-06 (all in README → *What the prototype has*)

- **Follow up**: By urgency | By people; the intro paragraph gone; From above To in the Follow up
  sheet; Draft text / Draft email when sending as yourself.
- **Trade partners**: the Ask window before any company is invited (`gcAskCompanies.ts`,
  `GcAskCompanies.tsx`); a blue heading band per trade; a company's address instead of a town, on
  one line across the row (`setCoverage` takes `address`).
- **The stage calendar**: a folded week shows its weekend beside the working-week box.
- **The schedule as a Gantt**, Phases 1 and 2 and most of 3 (`gcGantt.ts`, `GcGantt.tsx`,
  `gcScheduleMoves.ts`, `GcScheduleMoves.tsx`, `gcScheduleWalk.ts`, `GcScheduleWalk.tsx`,
  `gcTellTrades.ts`, `gcCustomerSchedule.ts`, `GcCustomerSchedule.tsx`, `gcPortalSchedule.ts`,
  `GcPortalSchedule.tsx`, `GcPortalDatesMoved.tsx`): the readable chart, drag to move with a
  required explanation kept as `schedule.moves`, Undo, the weekly walk kept as `schedule.walks`,
  waits drawn by hand with gaps and day limits, Tell the trades with the trades' answers, the
  customer's schedule in their portal, the trade's chart in its portal. The owner's calendar:
  every day is a working day; weekends and holidays are only marked.

## What landed in the second sitting of 2026-10-06

Every box under *Prototype work left* below, each with its section in `GANTT_PLAN.md` and its row
in `GANTT_FEATURES.md`; `README.md` → *What the prototype has* carries the screens. In order:
change-order days on the chart (G-76); what the work waits on (G-73 to G-75); the daily log's
weather days and days lost by cause (G-58, G-96); the Ask window on the map and the Trades tab,
and the walkthrough's four new stops; an added activity (G-38); actual dates, a new baseline and
redo (G-55, G-41, G-40); the architect's schedule, start reminders and the Friday report's
schedule words (G-95, G-114, G-93); the schedule sent on its own (G-94); the List view, the arrow
keys and rows drawn in view only (G-19, G-20, G-135). Checked as the branch is checked: the
golden test unmoved, 71 files and 1020 tests, the typecheck, the theme check.

## The owner's calls, answered 2026-10-06

The owner took every default ("I agree with all your suggestions, please build 1-9"). Built the
same day, each named in its commit; the golden walk was re-pinned once for the four that move it.

- [x] **Sample waits in the made-up data**: Fair Oaks D has a delivery coming late (the rooftop
  units), a decision the customer owes (the restroom tile) and the utility's transformer.
- [x] **A trade's report sets the actual dates**: the first report over 0% is the start, a report
  of 100% the finish, where the walk recorded none (`withReportedActuals`).
- [x] **A trade's "another day" on Follow up and Needs you**: an open ask is a reason on the
  company's row (*Asked for Mon Oct 19 on TPO membrane after we moved it*) until the bar moves
  again; the dashboard's phrase is "asked for another day" (`datesAsksOpen`).
- [x] **The stale-schedule warning**: the ring card's second line, *not walked* on the board row's
  schedule block, and the dashboard's own Needs you line *1 schedule not walked this week in GC
  mode* with *Walk it* (`gcStaleSchedules.ts`).
- [x] **What a GC or owner's rep customer sees**: the stages, with **See every bar** in their
  portal: the List view with no company, no dollars, no spare days (`customerMaySeeEveryBar`).
- [x] **Telling the trades** waits for the Tell the trades press, as built; several moves go as one
  message.
- [x] **The weekly walk's day** is Friday morning: on a Friday the walk line says *walk it before
  the report goes*.
- [x] **Who sets a new baseline**: anyone on our team, like a move, as built.
- [x] **"The shape is settled."** Said 2026-10-06. The real build starts in the order under
  `HANDOFF.md` → section 4, from `main`, in small PRs; the spike branch stays the prototype.

## The owner's calls still open

- [ ] The earlier calls in `HANDOFF.md` → section 1 that the real build meets as it goes: Quo (its
  own build), the defaults in `README.md` (each a constant), the portal's Spanish reader at
  production, the two portal ideas not picked, and the schedule's real build (call 11).

## Prototype work left, in the order I would take it

Each is one sitting or less. The feature numbers are `GANTT_FEATURES.md`'s.

- [x] **Phase 4, change-order days on the chart** (G-76): a signed change order's days land where
  the work is and move the contract's finish; the customer's schedule says so. Owner Billing's
  `changeOrderDays` exists; `substantialCompletionOn` already adds the days to the contract.
  Built 2026-10-06 (`gcChangeOrderDays.ts`; `GANTT_PLAN.md` → *Phase 4, change-order days*).
- [x] **Phase 4, long-lead items as bars** (G-73): ordered, shipped, on site, each tied to the
  work that needs it, holding it the way a submittal does (`GanttHold` gains a kind).
- [x] **Phase 4, the customer's decisions as rows** (G-74) and permits and the utility (G-75), with
  who waits on whom; the customer's *What we need from you* reads them.
  Both built 2026-10-06 as one record (`gcScheduleWaits.ts`; `GANTT_PLAN.md` → *Phase 4, what the
  work waits on*). No sample wait is in the made-up data: see the owner's calls.
- [x] **Phase 4, weather days from the daily log** (G-58): a log that says work stopped puts a lost
  day on the bars that were outside; **Update the week** offers it as the reason.
- [x] **Phase 4, days lost by cause** (G-96): the moves' reasons added up across the job, for a
  time-extension ask.
  Both built 2026-10-06 (`gcDaysLost.ts`; `GANTT_PLAN.md` → *Phase 4, days lost*).
- [x] **Phase 2, an added activity** that is not a schedule-of-values line (G-38): mobilize, a
  delivery, cure time, the customer's own work. Needs a new action and a row shape with no `pkg`.
  Built 2026-10-06 (`gcAddedActivity.ts`; `GANTT_PLAN.md` → *Phase 2, an added activity*). A
  delivery went to G-73 instead.
- [x] **Phase 2, actual start and finish** (G-55): kept beside the planned ones, set by the walk
  and the trade's report. Built 2026-10-06, set by the walk and the opened activity; the trade's
  report setting them is an owner's call above.
- [x] **Phase 2, a new baseline** after a signed change order (G-41), the old ones kept and named;
  and **redo** (G-40). Built 2026-10-06 (`gcBaseline.ts`; `GANTT_PLAN.md` → *Phase 2, the rest*).
- [x] **Phase 3, the architect's view** (G-95): the customer's view plus submittals and RFIs waiting
  on them, with the work each holds. Built 2026-10-06 (`gcArchitectSchedule.ts`).
- [x] **Phase 3, start reminders** (G-114): at 14 and 3 days, with what must be in place; *Starting
  soon* on the Schedule tab is the office half. Built 2026-10-06 (`gcStartReminders.ts`).
- [x] **Phase 3, the customer's PDF** (G-94) and the Friday report's schedule words (G-93). Both
  built 2026-10-06: *The schedule* section on the report; the letter, Send and Print or PDF on the
  Schedule tab (`gcCustomerScheduleSend.ts`).
- [x] **Phase 5**: a phone view of the chart of its own (G-19), keyboard and screen reader (G-20),
  big jobs drawn in view only (G-135). Built 2026-10-06 (`GANTT_PLAN.md` → *Phase 5, fit and finish*).
- [x] **The walkthrough** (*Walk me through this job*) has no RFIs stop and no stop for the Gantt's
  toolbar, the walk or Tell the trades (`gcTour.ts`). Added 2026-10-06: four stops, the three on
  the Schedule tab with a line for when they are not on the page.
- [x] **Ask window, the map and a job's Trades tab** still invite on one press; the Ask window
  could take those too (`README.md` → *Ask for quotes*). Done 2026-10-06: the map's *Ask them* and
  the Trades tab's *Ask them…* open the window ticked to that company.
- [x] **Add a company** in the browser and **Follow up on a phone** were not looked at after the
  2026-10-05 changes (the address line, By people). Looked at 2026-10-06: a company added on
  Trade partners shows its address and range on one line and lands in the vetting queue; Follow
  up at 375 px keeps both views and every button inside the frame.
- [x] The weekend mock-up's option B drew a dot on a quiet weekend with a paper; a week with a
  Saturday paper never folds, so that case never shows. Nothing to build; a note for the reader.
  Read 2026-10-06; it stands.

## Gotchas learned these two days

- **A typecheck's exit code is the one to read.** A wrapper that echoes it exits 0 itself.
- **Pointer capture throws on a synthetic event.** `setPointerCapture` is wrapped in try/catch in
  `GcGantt.tsx`; a browser that refuses still drags inside the bar.
- **The invisible press targets on the links** sit over the bars; they turn off while a line is
  drawn, or the bar under the pointer is never found.
- **`PortalTag` has three tones** (green, red, grey). An amber one crashes the portal.
- **`--bg-blue-50`** exists and is very pale; the trade heading band uses `--bg-blue-200`.
- **The reducer still takes a move with no `why`** (the old action shape) and keeps no record. No
  screen sends one; the real build makes the explanation required in the database.
- **A loop in the waits is allowed**, on purpose: the owner's walk makes one. Why it moved names it.
- **The pane's screenshots stall when it is hidden**; drive the page through JavaScript and read
  the text, then screenshot once the pane is shown.

## Status

Written 2026-10-06, on `origin/spike/gc-mode`, and closed for the Gantt the same day: every box
above is ticked, and four rounds of helper sessions built the rest of `GANTT_FEATURES.md`
(`HELPERS.md` says how). The Gantt's real build is `SCHEDULE_REAL_BUILD.md` (G-132 to G-134),
waiting on the owner's word; the calls still open are listed above.
