---
name: "GC mode spike: the punch list, for whoever picks it up next"
parent: to-dos/gc-mode/README.md (punch list #81) · HANDOFF.md (the lanes' handoff, 2026-10-05)
status: written 2026-10-06 at the owner's ask ("save what is left to a spike punchlist so that another user tomorrow can pick up where we left off") · everything below is on origin/spike/gc-mode · the branch still never merges
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
   - `VITE_SUPABASE_URL=http://x VITE_SUPABASE_ANON_KEY=x npx vitest run src/lib/gcMode src/components/gc src/lib/dashboardNeedsYou.test.ts` (61 files, 896 tests; the golden test unmoved)
   - `npm run typecheck` (about 10 minutes; read the exit code, not the wrapper's)
   - `node scripts/theme-tokenize.mjs --check src/components/gc`
4. Read `GANTT_PLAN.md` (the schedule as a Gantt: what is built, phase by phase, and the owner's
   calls) and `GANTT_FEATURES.md` (every feature numbered G-01 to G-137 with where it stands; cite
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

## The owner's calls still open

Nothing below starts without the one named.

- [ ] **"The shape is settled."** The gate for the real build (`HANDOFF.md` → section 4). Not said.
- [ ] **A trade's "another day" on Follow up.** A company that asks for another day from its
  portal shows on the move's row and in the log only. Putting it on Follow up and Needs you
  changes the board's counts, which moves every lane's golden snapshots (`GANTT_PLAN.md`, Phase 3).
- [ ] **The stale-schedule warning on the board row and the dashboard.** Today it is on the
  Schedule tab only (*check the dates* / *part walked* / *walked*); a line on the ring card moves
  every lane's snapshots (G-59).
- [ ] **What the customer sees** when the customer is another GC or an owner's rep: stages only, as
  now, or the full chart (`GANTT_PLAN.md`, call 3).
- [ ] **Telling the trades**: wait for the **Tell the trades** press, as built, or email at once on
  every move (call 4).
- [ ] **The weekly walk's day**: Friday morning, before the Friday report, is the default (call 6).
- [ ] **Who sets a new baseline** after a change order: anyone, like a move, or the project
  manager (call 9).
- [ ] Every earlier call in `HANDOFF.md` → section 1 (PR 1b, Quo, the defaults, the Spanish).

## Prototype work left, in the order I would take it

Each is one sitting or less. The feature numbers are `GANTT_FEATURES.md`'s.

- [ ] **Phase 4, change-order days on the chart** (G-76): a signed change order's days land where
  the work is and move the contract's finish; the customer's schedule says so. Owner Billing's
  `changeOrderDays` exists; `substantialCompletionOn` already adds the days to the contract.
- [ ] **Phase 4, long-lead items as bars** (G-73): ordered, shipped, on site, each tied to the
  work that needs it, holding it the way a submittal does (`GanttHold` gains a kind).
- [ ] **Phase 4, the customer's decisions as rows** (G-74) and permits and the utility (G-75), with
  who waits on whom; the customer's *What we need from you* reads them.
- [ ] **Phase 4, weather days from the daily log** (G-58): a log that says work stopped puts a lost
  day on the bars that were outside; **Update the week** offers it as the reason.
- [ ] **Phase 4, days lost by cause** (G-96): the moves' reasons added up across the job, for a
  time-extension ask.
- [ ] **Phase 2, an added activity** that is not a schedule-of-values line (G-38): mobilize, a
  delivery, cure time, the customer's own work. Needs a new action and a row shape with no `pkg`.
- [ ] **Phase 2, actual start and finish** (G-55): kept beside the planned ones, set by the walk
  and the trade's report.
- [ ] **Phase 2, a new baseline** after a signed change order (G-41), the old ones kept and named;
  and **redo** (G-40).
- [ ] **Phase 3, the architect's view** (G-95): the customer's view plus submittals and RFIs waiting
  on them, with the work each holds.
- [ ] **Phase 3, start reminders** (G-114): at 14 and 3 days, with what must be in place; *Starting
  soon* on the Schedule tab is the office half.
- [ ] **Phase 3, the customer's PDF** (G-94) and the Friday report's schedule words (G-93).
- [ ] **Phase 5**: a phone view of the chart of its own (G-19), keyboard and screen reader (G-20),
  big jobs drawn in view only (G-135).
- [ ] **The walkthrough** (*Walk me through this job*) has no RFIs stop and no stop for the Gantt's
  toolbar, the walk or Tell the trades (`gcTour.ts`).
- [ ] **Ask window, the map and a job's Trades tab** still invite on one press; the Ask window
  could take those too (`README.md` → *Ask for quotes*).
- [ ] **Add a company** in the browser and **Follow up on a phone** were not looked at after the
  2026-10-05 changes (the address line, By people).
- [ ] The weekend mock-up's option B drew a dot on a quiet weekend with a paper; a week with a
  Saturday paper never folds, so that case never shows. Nothing to build; a note for the reader.

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

Written 2026-10-06, on `origin/spike/gc-mode`. Pick a box, cite its G-number in the commit, tick
it here in the same commit.
