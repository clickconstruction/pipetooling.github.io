---
name: "The counts: the schedule's reasons on the board row, Follow up and Needs you"
row: HELPERS.md round three, Helper 1's last row ("the counts on the board row, Follow up and Needs you (re-pins the golden test once)"). It settles what G-115's row left as "the owner's call".
branch: spike/g-counts (from origin/spike/gc-mode at c044a9106, with G-83, G-137, G-141 and G-44 in)
status: mockup and plan, waiting on the lead's go (Helper 1, 2026-10-06). The four rows it waited on have landed. It is built after the go, with the golden test moved once.
---

# The counts: one count of who to call, with the schedule's reasons in it

## What it is

Three places count the people we are waiting on, and the owner asked on 2026-10-04 that they
match:

- **The board row**: the pill *2 to call*, with a card of each person and their reasons, Call and
  Follow up on each.
- **Follow up**: its badge, *By people*, *By urgency*'s other reasons, and *Work the list*.
- **Needs you** on the dashboard: *9 to follow up on in GC mode* and the first three names.

All three read one kernel, `projectPeople` and its sum `allPeople` (`gcProjectPeople.ts`). Today it
holds the papers and the asks: quotes, plans, statements of work, waivers, insurance, W-9s, days
given, another day asked for (G-113) and a late notice (G-117).

The schedule's reasons each live on their own card, and none of them reach the count. A trade that
cannot start its bar, a trade at work with no insurance, the log and the chart disagreeing, a crew
too short to hold the finish, too many trades in one place, a finish past the contract: each of
those rows' mockups left the count to this row.

This row puts each of them where it belongs, from its own kernel's read:

- **A company's move** becomes a reason under that company. It shows on the board row's pill,
  Follow up's badge and rows, and Needs you's names. One call covers every reason. Companies are
  counted, not bars.
- **Our move** becomes a line on the ring's card, and one Needs you line for all jobs: *things to
  do on GC schedules*. It stays out of the people count, like change requests, back charges and
  schedules not walked (G-59).

## A finding first: what the golden test pins

Before designing I tested what moves the golden test. The earlier mockups (G-77, G-98, G-115,
G-138) said a count on the board row, Follow up or Needs you moves the golden walk. That is not so.

- **The probe.** I added one more person, with a red reason, to every job being built inside
  `projectPeople`. I ran the golden test and then took the change out. **All 211 tests passed.**
  Nothing the golden walk reads calls `projectPeople` or `allPeople`. Its readings are
  `stageProgress`, `startChecklist`, `followUps` (the quote asks only), the benches, the rules, the
  vetting, insurance renewals, the promises and the last log.
- **What it does pin is the ring's card**: `stageProgress`, the lines under the ring on each row.

So, two things follow:

1. As designed below, **the re-pin moves only the ring card's new lines** for our moves. On the
   walk, they show only on Helotes Dental Office. The people counts move on screen but in no
   snapshot.
2. **I recommend we pin the counts too, in this same re-pin.** That means a `people` reading per job
   (the count, the late count, each person's key with their reason codes and tones), and
   `allPeople`'s count and Needs you's title for the board. This row exists because the counts must
   match. Today a later row could change a count and no test would notice. See *Is this the best we
   can do?*, option 1.

## The rule: whose move is it?

| Reason | Kernel and its read | Whose move | Where it shows | The one press |
|---|---|---|---|---|
| **Not ready to start** (G-77) | `notReadyBars`: a bar not started on a trade still missing a paper | **Theirs** for insurance, a W-9, a master agreement sent and not signed, a statement of work sent and not signed. **Ours** for no award, a master agreement not sent, a statement of work not written, not sent, or on older plans | Theirs: a reason on the company. Ours: a ring line, and the Needs you line | Theirs: **Follow up**, the sheet at the company, its paper asked for. Ours: G-77's **Get them ready** on the opened bar |
| **At work uninsured** (G-138) | `uninsuredBars`, by company, not by bar | Theirs | Its insurance reason reads `lapsedInsuranceWords`, with the bars under way. Red | **Follow up**, its insurance asked for (G-77's paper) |
| **Their word on their dates** (G-117 and G-116) | `openLateNotices`, already counted as `late`. The early warnings G-116 names: new dates told and not answered (G-113), a first day nobody confirmed (G-114), and a push back the trade never answered (G-117) | Theirs | A reason on the company: `late` as today, and a new `confirm` | **Follow up**: *Do they work?* or *Will your crew be there?* |
| **The log and the chart disagree** (G-60) | `logChartGaps`: `absent`, a trade's bars ran with nobody from them on the log; `noBar`, a trade on site with no bar running | `absent` with a company: theirs. `noBar`, or our own crew: ours | Theirs: a reason, `log`. Ours: a ring line, and the Needs you line | Theirs: **Follow up**, *Ask when the crew comes back.* Ours: G-60's card, **It started early** |
| **A short crew that moves the finish** (G-57) | `finishOutlook`'s short crews with days on the finish: the call list's own reason | Theirs | A reason, `crew` | **Follow up**: *Can you bring it back up to size?* |
| **Too many trades in one place** (G-83) | `crowdedWeeks`: each place with 3 trades or more on one day, by week. `crowdedCalls`: a hired company in a crowded week of the next three that has not given its count | The crowd itself: ours, since the office sets the order of the work. A count not given: theirs | Ours: a ring line, and the Needs you line. Theirs: a reason, `crowded` | Ours: **Open it**, to the Schedule tab, where G-83's lane shows the crowd and a move says what it clears. Theirs: **Follow up**, *How many people a day will you have there?* |
| **The finish past the contract** (G-98) | `lateFinish`: `late` days past the contract's day | Ours | A ring line, the board row's block, and the Needs you line | G-141's **Ask for the days** when some days are the customer's, else G-82's *How to get days back* on the Schedule tab |

A closed or lost job counts nothing, as `projectPeople` has it. G-77 and G-138's kernels do not
check that, so the new kernel does.

**My reading of "the early warnings G-116 names":** G-116 is *a trade's record on our dates*, and
its third leg, *dates confirmed and kept*, is not built. The plan's line for it is: *Unconfirmed
dates become a reason on Follow up and count in a company's record.* So I count the unconfirmed
dates: new dates told and not answered, a first day not confirmed, and a push back from G-117 the
trade never answered. If you meant the record itself, a notice sent ahead of the day counting for
the trade, that is the bench (`tradeBenches`), a different reading of the golden test. Say so and
I add it to the same re-pin.

## The words

Each sentence passes `plainWordsFailures`. I checked every one below with it, and a test will hold
them all.

**A company's reasons, on the pill's card, *By people* and the sheet** (*code*, tone):

- `notReady`, amber, red once the first bar starts within 3 days (`NOT_READY_LATE_DAYS`): *Site
  lighting and Fire alarm wait on current insurance. Site lighting starts Mon Oct 19.* It uses G-77's
  own noun for each paper. One reason per company per job, the first bar named with its start.
- `insurance`, red, where the company is at work uncovered: *Their insurance ran out Tue Sep 15.
  Nothing they do for us is covered. They are at work on Panels and feeders, and Lighting.* The
  code stays `insurance`, so the papers card and the sheet's item keep working. A renewal promise not
  yet due does not take it off. The work going on today is not covered.
- `confirm`: the call list's own words. *New dates for TPO membrane went out Mon Oct 5. No answer
  yet.* *Their first day on site is Mon Oct 12. They have not said their crew will be there.* Its
  tones are the call list's. A push back not answered: *We pushed back on TPO membrane's new day Mon
  Oct 5. No answer from them yet.*
- `log`, amber: G-60's own sentences for an `absent` gap, then its *Ask when the crew comes back.*
- `crew`, amber: `shortCrewReason`. *They have 1 on site this week against 3 so far. At that, the job
  finishes 6 days later, Fri Dec 18.*
- `crowded`, amber this week and next, grey after: G-83's line. *Inside has 3 trades at once, Fri Oct
  2 to Fri Oct 9. With them are our own crew and Cool Breeze Mechanical. They have not said how many
  people a day.*

**Needs you's phrase for a company**, chosen by its worst reason as today. The names show the
shape, not the made-up data:

| Code | Phrase |
|---|---|
| `notReady` | *Pecan Valley Electric cannot start Site lighting yet* |
| `insurance`, at work | *Pecan Valley Electric is working without insurance* |
| `confirm` | *Summit Roofing has not confirmed its dates* |
| `log` | *Summit Roofing was not on site* |
| `crew` | *Iron Horse Fabrication is short a crew* |
| `crowded` | *Cool Breeze Mechanical has not said how many it will have* |

**Our moves, on the ring's card**, right after the schedule's own line:

- The finish: *It finishes Fri Dec 25, 7 days past the contract's Fri Dec 18.* Then G-98's whose-days
  line when there is one: *All 4 are the customer's: a change order for them would save $2,000.*
- No company yet: *Glass and storefront has no company yet. Storefront starts Sat Oct 17.*
- New papers on newer plans: *Brightline Electric, Kendall Air and Cedar & Pine Millwork need a new
  statement of work. The plans changed after they signed. The first starts Fri Nov 6.*
- Not sent yet, in G-77's own line for the paper: *{Company}'s statement of work is not sent yet.
  {Bar} starts {day}.* The master agreement says the same in its own words.
- The log: G-60's own sentences for a `noBar` gap, then its *todo*.
- The crowd: G-83's own words for each flagged week, from today on. *Inside has 3 trades at once, Mon
  Oct 5 to Fri Oct 9.* Several weeks of one place read as one line, the first and last day.

**The board row's block** (`GcBuildingScheduleBlock`), on a job past its contract: its tone goes
red, and its middle line reads **7 days past contract** in place of the milestones. The hover's
sentences gain the finish line. A job on time keeps its block as it is. On the made-up data no
block turns red: Fair Oaks D finishes on its contract's day.

**Needs you's new line**, `gc-schedule-moves`, beside *schedules not walked*:

```
GC MODE
3 things to do on GC schedules                                          [ Open it ]
Helotes Dental Office finishes 7 days past the contract. Glass and storefront has no
company yet. 3 trades need a new statement of work.
```

Its detail is short sentences, one a thing, the job named in its first. Its neighbours join their
items with a dot, which the plain-words rule does not allow inside a sentence.

It is red when a finish is past the contract or a bar starts within 3 days, else amber. **Open it**
goes to the first job's Schedule tab (`/bids/gc?project=…&ptab=schedule`), the way *Walk it* does.

## On the made-up data, today, Fri Oct 2

| Count | Today | After | Why the new number is right |
|---|---|---|---|
| Fair Oaks D's pill | **2 to call**, 2 late | **2 to call**, 2 late | The only company the new reasons name is Pecan Valley Electric. Its Site lighting (Mon Oct 19) and Fire alarm (Mon Nov 2) wait on its insurance. Its Panels and feeders, and Lighting, are under way without it. It is already on the row for that insurance. Companies are counted, not bars, so four bars add nobody |
| Pecan Valley's reasons | 2: insurance, waiver | 3: insurance at work (red), not ready (amber), waiver (amber) | Site lighting starts in 17 days, more than 3, so not ready reads amber. The insurance reason reads G-138's words |
| Cibolo Creek Partners | pay application 3, red | the same | No schedule reason is the customer's |
| Follow up's badge | **9** | **9** | No one new on any job |
| Needs you | *9 to follow up on in GC mode*, Hillside, Bexar, Voltage Brothers | the same | Its three names are Boerne's, which has no schedule |
| *Things to do on GC schedules* | none | none | No job has a move of ours today. Fair Oaks D finishes on its contract's day, Fri Dec 11. Its gaps are all Pecan Valley's. No place is kept on any bar, so G-83 flags nothing. Helotes is still buying out |
| The ring cards | as they are | **unchanged** | No line of ours fires on any job today |
| By company, Fair Oaks D | 5 | 5 | It says these reasons in its own lines already. Its merge skips the new codes it covers |

## On the golden walk: what the one re-pin moves

From a probe that played the walk with every reason read at every step:

- **Fair Oaks D**: Pecan Valley's two reasons only, from the start until step 92, *Close Fair Oaks D
  with work still open*. Then nothing, since a closed job counts nothing. Its ring card never
  changes.
- **Helotes Dental Office**, building from step 47, *Start*:
  - **Step 54**, *A new set of plans after Start*: Brightline Electric, Kendall Air and Cedar & Pine
    Millwork signed their statements of work on the Permit set. That is ours to fix. A new ring line.
  - **Step 64**, *Bulletin 1 adds a storefront and its trade*: Glass and storefront has no company,
    another ring line. The finish runs **7 days past the contract's Fri Dec 18**: the finish line.
  - **Step 75**: Cedar & Pine's first two bars are under way and no longer wait. The line stays,
    since its Break room still waits.
  - **Step 89**: the Break room is under way too, so the papers line names two companies, Brightline
    Electric and Kendall Air.
  - **Step 109**, *Bulletin 2*: the finish runs **45 days past**, and the first start moves to Thu
    Nov 26.
- **Stone Oak Pharmacy and Pad B**: nothing. Stone Oak has no schedule, and Pad B starts at step 161
  with none.
- No step plays a late notice, a crew count, a place, or a log the chart disagrees with. So `confirm`,
  `log`, `crew` and `crowded` move nothing in the walk. Their kernel tests hold them.

So the re-pin moves `projects.helotes.stageProgress.also` at steps 54, 64, 89 and 109, and at any
step where its lines' first start moves. The build lists the exact paths in the commit message.
With option 1, the re-pin also adds the new `people` readings: new paths at the start and at each
step where a count moves. No value that is already pinned changes because of it.

## The kernel and the files

**`src/lib/gcMode/gcCounts.ts`**, new, pure, tested, out of the barrel:

| Export | What it does |
|---|---|
| `scheduleReasons(state, project)` | The company reasons above, each from its kernel, one per company per kind: `{ partner, trade, reason }` |
| `ourScheduleMoves(state, project)` | Our moves above: `{ kind, words, tone, lineId? }` |
| `ourMoveLines(state, project)` | The ring card's lines, in order |
| `lateFinishLine(state, project)` | The finish line, for the ring and the block's hover. Null: on time |
| `gcScheduleMovesNeedsYou(state)` | Needs you's new line, or null |
| `unconfirmedDates`, `unconfirmedStarts`, `crewCalls` | Lifted out of `gcCallList.ts`, its own commit, the way G-82 lifted `pullBehind`. The call list calls them, and its tests stay as they are |

The changes elsewhere are additions, with two exceptions, each named where it is:

- `gcProjectPeople.ts`: one loop adds `scheduleReasons`. **One reason's words change**: the
  insurance reason reads G-138's words where the company is at work.
- `gcNeedsYou.ts`: the six phrases.
- `gcProgress.ts`: `ourMoveLines` after the schedule's line and the walk's.
- `GcBuildingSchedule.tsx`: the block's red tone, middle line and hover.
- `gcCallList.ts`: its merge skips `notReady`, `confirm`, `crew` and `crowded`, which its own lines
  say, beside the `late` it skips today. **One condition changes.**
- `dashboardNeedsYou.ts`, `useGcFollowUpNeeds.ts` and `DashboardPinnedQuickRow.tsx`: the new line,
  its hook and its press, beside *schedules not walked*.
- `GcAskThread.tsx`: *By urgency*'s other reasons show the new codes. The `SHOWN_ABOVE` list stays.
- `gcModel.test.ts`: option 1's readings. **This is the one re-pin.**

**An import loop to mind.** `gcProjectPeople` already reaches `gcNotReady` through
`gcFollowUpSheet`, `gcPortal` and `gcStartReminders`. `gcNotReady` reaches back through
`gcPaperSend` and `gcStageHealth`. It works because every use is inside a function. `gcCounts.ts`
keeps to that: no imported value is read when the module loads. That is the lesson of the note atop
`NOT_READY_LATE_DAYS`.

## The tests

- **`gcCounts.test.ts`**:
  - Each reason on the made-up data: Pecan Valley's two, and nothing else.
  - Each reason made to fire:
    - G-83's places kept: the crowd as our line, and the count asked of each company that has not
      given one
    - a statement of work sent and not signed, then a W-9 missing
    - new dates told and not answered, and a first day not confirmed
    - a notice pushed back and not answered
    - an `absent` log gap, then a `noBar` one
    - a crew count of 1 that moves the finish
    - G-98's late job, with all 4 days the customer's
  - Whose move each is, the tones, and companies not bars: four bars, one reason.
  - A closed job counts nothing.
  - The walk's Helotes lines at its steps 54, 64 and 109.
  - The Needs you line and its press target.
  - Every sentence passes `plainWordsFailures`.
- **`gcProjectPeople`'s and `gcNeedsYou`'s tests**: the new reasons and phrases. The fixture's counts
  stay 2, 9 and 9.
- **The call list's tests** stand as they are. One more holds that no reason is said twice.
- **`dashboardNeedsYou.test.ts`**: the new line, its severity and its place in the order.
- **Render smokes**: the pill's card with Pecan Valley's three reasons, the block's red middle line,
  and the Needs you line with **Open it**.
- **The golden test**: re-pinned once with `-u`. The commit message names each path that moved and
  why. Every other test passes untouched.

## Left out, and why

- **The call list's own bar reasons in the count**: a bar late, due or behind, a failed inspection,
  held work. That is option 3 below.
- **A `log` line on By company.** The call list has no G-60 line of its own, so a company whose only
  reason is the log does not show there. That is a G-115 row, not a count.
- **The trade's portal.** It hears about its papers and dates through its own to-dos already.

## Is this the best we can do?

1. **See: the counts pinned, so they cannot drift again.** The golden test reads the ring card and
   not the counts, so the owner's *make them match* has no test behind it. Adding `people` per job
   and the board's count to the readings costs nothing at runtime. It makes this re-pin the last time
   a count moves unseen. **I pick it.** Without it, this row's re-pin is only Helotes' ring lines.
2. **Tell: the late finish on the board row itself.** The block today says days behind the plan,
   which is our own measure. A job past its contract costs the fee each day, and the board should
   say so before anyone opens the job. A red block with *7 days past contract*, and G-141's press one
   tap away through Needs you. **I pick it.** It is one line in the block and reads G-98's one call.
3. **Chase: one count for everything that moves the chart.** By company (G-115) counts 5 on Fair Oaks
   D, where the row says 2. Four of its five are not on the row: Cool Breeze, Iron Horse, Summit and
   the architect, for bars late, due, behind or held. Counting them too makes the row say 6, with
   Cibolo, and the badge 11. It is one line, since the call list is built for it. **Not picked now.** It changes what *to call* means on the
   board, from what they owe us to how their work runs, and that is the owner's word. I recommend
   asking him with this row's go.
