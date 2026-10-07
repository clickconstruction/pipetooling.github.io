---
name: "The tour, round five: a stop at each door a first-timer would miss"
rows: G-77, G-138, G-115, G-21, G-136, G-81, G-08, G-84, G-82, G-141, G-83, G-118, G-60, G-44, G-145, G-45, G-117, G-142 (all Have; this is their door in the tour)
branch: spike/tour (from origin/spike/gc-mode at 2590c3046)
status: built 2026-10-06 on spike/tour with the lead's go on picks 1 and 2 (Helper 1). As built in GANTT_PLAN.md, "The tour, round five". At the lead's word each new stop was cut to three sentences, so the built words in gcTour.ts are shorter than the ones below. Helotes walks 20 stops, not 21, because the call list is built for a job being built only.
---

# The tour, round five

## What it is

The rows built this week each put a door on the screen: a toolbar button, a card, a note on a
bar, a list in the trade's portal. A first-timer walks past most of them. *Walk me through this
job* gains a stop at each one, and *New here?* gains one stop that points at *Walk me through
this job* itself. That is the door to all the others, and today it is only inside a project.

Every stop is in plain words (`src/lib/plainWords.ts`):

- one idea a sentence, none over 20 words
- no dashes, semicolons, parentheses or `·` in a sentence
- the control's exact name, as the screen prints it
- what this is, then what you do, then what happens after

I ran every drafted sentence below through `plainWordsFailures`: no failures, and the longest is
16 words. The existing stops of both tours pass it too.

## How the tour reaches a stop on another tab

Today the tour never changes the tab. A stop inside a tab lights up only if you happen to be on
that tab. Otherwise its card sits in the middle of the page with its *missingBody* line. Twelve
new stops on two tabs would mostly point at nothing.

The plan:

- **A stop names its tab.** `GcTourStep` adds two fields to `SpotlightTourStep`: `tab` (the
  project tab its anchor is on) and `stages` (the job stages it belongs to). Both are additions
  in `gcTour.ts`.
- **The tour opens that tab on the way.** `SpotlightTour` gains one optional prop, `onStep(index)`.
  Next, Back and the arrow keys call it just before they change the stop, so the new tab and the
  new stop render together. `GcMode` passes `onStep` and sets the project tab to the stop's
  `tab`.
- **The tour looks again for an anchor that is not there yet.** While the anchor is missing, it
  checks on its 120 ms cadence for a second before it shows *missingBody*. That covers a tab that
  draws a moment late.
- **Done or Skip tour puts you back** on the tab you started from.
- **Each job gets the stops for its stage.** A bidding job's tour has the rough and none of the
  building job's cards. A building job's has the chart's doors and not the rough. This is pick 2
  below.

`SpotlightTour.tsx` is the one file outside GC mode. The spike already adds to it (bullets,
numbered marks), and this is one optional prop plus the second look, so every other tour behaves
as before.

## The stops, in the order a person meets them

Each stop names its anchor (*new* is an attribute this piece adds), its tab, its stages, and what
the made-up data shows today. Fair Oaks D is building on Fri Oct 2, and Boerne is still bidding.

### In Walk me through this job

Existing stops 1 to 10 run unchanged: One project, Trades, Plans, Our number, Bid tabs,
Contracts, Get started, Submittals, RFIs and Schedule.

**New: A rough schedule while we bid** · `gc-rough` (there) · Schedule · bidding

> A job still bidding gets a rough schedule, not a full one. Tap Draw a rough schedule. It counts
> the weeks to build from the job's stages. Our number then shows those weeks beside our price.
> When we win, the first draft starts from it.
>
> *Missing:* It is on the Schedule tab of a job still bidding.

Boerne shows it, with **Draw a rough schedule** on the card.

Existing stop: **The chart** (`gc-gantt-toolbar`) now names the Schedule tab, so it lights up.
Its words stay.

**New: Bars held up, and bars not covered** · `gc-held-bar` (new, the first held bar's row) ·
marks 1 on `gc-held-bar` and 2 on `gc-uninsured-bar` (new) · Schedule · buyout, building

> A note beside a bar says what stands in its way. Tap the bar to see what it needs and how to ask
> for it.
>
> 1. **Held:** a striped bar waits on something, like a submittal or current insurance.
> 2. **Not covered:** a red note means the company is at work with no insurance. Approve on Draws
>    stays locked until a current certificate comes in.
>
> *Missing:* Nothing on this job is held or uncovered today. A held bar is striped, and an
> uncovered one has a red note.

Fair Oaks D shows both on Pecan Valley's bars. Site lighting *waits on current insurance, theirs
ran out Sep 15*, and Panels and feeders reads *insurance ran out Sep 15*. The numbered marks are
the board's first stop's pattern.

**New: A call list from the chart** · `gc-gantt-group` (new, the By trade, By stage, By company
switch) · Schedule · buyout, building

> By company turns the chart into a call list. Tap By company. A list opens under the toolbar. It
> names everyone whose answer moves the chart, with Call and Follow up. Tap a line to open its bar.
>
> *Missing:* It is on the chart's toolbar, on the Schedule tab.

**New: Spare days and people on site** · `gc-gantt-shows` (new, around the two buttons) ·
Schedule · buyout, building

> Two buttons add more to the chart. Tap Show spare days for a faint tail after each bar. The tail
> ends on the last day it can finish without moving the job's finish. Tap Show people on site for a
> strip under the chart. Each week's plan sits beside the daily log's count.
>
> *Missing:* It is on the chart's toolbar, on the Schedule tab.

**New: Print it or send the file** · `gc-gantt-files` (new, around Print or PDF and Export) ·
Schedule · buyout, building

> Tap Print or PDF to print the chart as you see it, on landscape pages. Tap Export to save the
> whole schedule as a spreadsheet. Export also makes the file Microsoft Project and Primavera open.
> Each one asks if the copy is for our team or the customer.
>
> *Missing:* It is on the chart's toolbar, on the Schedule tab.

**New: Try moves on a copy** · `gc-what-if` (new, on What if…) · Schedule · buyout, building

> Tap What if… to make a copy of the schedule beside the real one. Try moves on the copy first,
> with no reason needed yet. The real dates show as dashed outlines. Tap Keep to put the moves on
> the real schedule, each with its reason. Tap Throw it away to drop the copy.
>
> *Missing:* It is on the chart's toolbar, on the Schedule tab.

Existing stops: **Update the week** (`gc-walk-line`) and **Tell the trades** (`gc-tell-trades`)
now name the Schedule tab. Their words stay.

**New: Where the work is** · `gc-places` (there) · Schedule · building

> Each bar can have a place, like Roof or Inside. With places kept, the chart flags a day with
> three trades or more in one place. Tap Look at the places to keep the guesses or change them.
>
> *Missing:* It is on the Schedule tab of a job being built.

**New: A job running late** · `gc-days-back` (there), mark on `gc-ask-for-days` (there) · Schedule
· building

> When a job will finish after its contract day, two things show under Projected finish. Days back
> names work that could run side by side or take a second crew. Tap Look at it to see that move
> before anything is saved. Ask for the days drafts a time extension for the days the customer's
> moves added.
>
> *Missing:* This job is on time, so neither shows today. They appear under Projected finish when
> the finish runs past the contract.

Fair Oaks D finishes on its contract's Fri Dec 11, so today this stop shows *Missing*. That is the
lead's rule for a surface the made-up data does not show.

**New: Their dates to meet** · `gc-their-dates` (new, on Bring in their dates…) · Schedule ·
building

> The Milestones card holds the dates the job must meet. When the customer sends new dates, tap
> Bring in their dates… on this card. Each of their dates shows beside ours with the difference in
> days. You tick the ones to take. No bar moves.
>
> *Missing:* It is on the Milestones card of a job being built.

**New: Save the job as a template** · `gc-templates` (there) · Schedule · building

> A template keeps this job's shape for the next job like it. Type a name and tap Save as a
> template. It keeps each line's days and what it waits on. It keeps no dates, companies, percents
> or moves. A new job can then start from it.
>
> *Missing:* It is on the Schedule tab of a job being built.

Existing stop: **Daily log** (`gc-ptab-log`), unchanged.

**New: Who should be on site** · `gc-morning-list` (there) · Daily log · building

> Above the log, Who should be on site reads the chart for the day. It lists each company with work
> running, its phone and its last count. A company at work without insurance says so under its
> name. Tap a day at its top to look at another day.
>
> *Missing:* It is on the Daily log tab of a job being built.

Fair Oaks D shows *Who should be on site · Fri Oct 2*: five companies on six bars and an
inspection. Pecan Valley's line says its insurance ran out.

**New: The log against the chart** · `gc-log-vs-chart` (new, on its card) · Daily log · building

> The daily log says who was on site. The chart says whose work runs. When they do not match this
> week, a card says so with what to do. If a crew began before its bar, tap It started to record the
> day.
>
> *Missing:* They match this week, so no card shows. It shows here and under the chart when they
> do not.

Fair Oaks D has no mismatch this week, so today this stop shows *Missing*. The test builds one.

Existing stops: **Draws**, **Bill the customer**, **Closeout** and **What the trade sees**,
unchanged.

**New: The trade's own dates** · `gc-portal-jobs` (new, the portal's *Your jobs*) · no tab, the
portal column · building

> In its portal, a trade opens a job to see its own schedule. Each bar not done has We will be late,
> with a new day and why. Under each coming week, People a day on site asks how many it will send.
> The office sees both on the Schedule tab and in the morning list.
>
> *Missing:* Tap See what the trade sees. Pick a company and open its job.

The two controls sit on the job's own page in the portal, one press past *Your jobs*. The door a
first-timer misses is that row, so the stop lights it. The portal column opens on Tri-County Site,
whose work is done, so the stop does not point at a bar.

### In New here?

**New, before Try it: A walk through one job** · `gc-row-building` (there, the first building row)

> Open any project to see its tabs. Tap Walk me through this job above them. It stops at each tab
> and each card in the order a job goes. It opens each tab for you as it goes.
>
> *Missing:* Open any project. Walk me through this job is above its tabs.

## How long each job's walk is

| Job | Stage | Stops today | With this piece |
|---|---|---|---|
| Fair Oaks D | building | 18 | 30: the 18, the five chart doors, places, the late job, their dates, templates, the two Daily log stops and the trade's dates |
| Helotes | buyout | 18 | 21: the 18 less Update the week and Tell the trades, plus the five chart doors |
| Boerne | bidding | 18 | 16: the 18 less the chart, the walk and Tell the trades, plus the rough |

The chart, the walk and Tell the trades get `stages` too: an added field on those stops, never a
changed sentence. *New here?* goes from 18 stops to 19.

## Files

- `src/lib/gcMode/gcTour.ts`: the `GcTourStep` type, the 13 project stops and the board stop,
  `tab` and `stages` on the three chart stops, and `projectTourSteps(stage)`, which keeps a stop
  that fits the stage.
- `src/components/SpotlightTour.tsx`: `onStep`, and the second look for a missing anchor.
- `src/pages/GcMode.tsx`: the tour gets the job's stops and `onStep` opens the stop's tab. Done
  puts back the tab you started on.
- The anchors:
  - `GcGantt.tsx`: `gc-gantt-group`, `gc-gantt-shows`, `gc-gantt-files`, plus `gc-held-bar` and
    `gc-uninsured-bar` on the first such bar. A wrapping `span` is `inline-flex` with the toolbar's
    gap, so nothing moves.
  - `GcWhatIf.tsx`: `gc-what-if`. `GcTheirDates.tsx`: `gc-their-dates`.
  - `GcLogVsChart.tsx`: `gc-log-vs-chart`. `GcTradePortal.tsx`: `gc-portal-jobs`.
- Docs:
  - README.md's two tour lines, amended in place (18 → 19 stops; 14 → up to 30, by stage).
  - A short *as built* section in GANTT_PLAN.md: the tour, round five.
  - No row in GANTT_FEATURES.md changes, since every row is already Have.

The golden test does not move. The tour reads nothing from the state, and the anchors are
attributes.

## Tests

- **`gcTour.test.ts`** (new):
  - Every stop of both tours passes `plainWordsFailures`: the title, the words, the *Missing* line
    and each bullet.
  - Each new stop names its controls as the screen prints them, from a table held in the test.
  - Each `tab` is one of the project's tabs.
  - `projectTourSteps` gives Boerne the rough and no chart stop, and Fair Oaks D the reverse.
- **`GcTour.render.test.tsx`** (new): every stop that names a tab has its anchor on that tab, with
  the controls it names inside the anchor. The test renders the tab for the state that shows the
  surface:
  - Fair Oaks D as made up, for the chart doors, places, their dates, templates and the morning
    list.
  - Boerne, for the rough.
  - Fair Oaks D made late with two moves and the late-finish fee, as the counts' test does, for
    Days back and Ask for the days.
  - A day's log with a crew on site and none of its bars running, for the log against the chart.
  - A move not told yet, for Tell the trades.
  - The portal stop on `GcTradePortal` for Summit Roofing.
- **`SpotlightTour`**: Next calls `onStep` with the next stop before it shows, and an anchor that
  arrives a moment later is found and lit, not shown as *Missing*.
- **`GcMode`'s wiring** is small enough to sit in a `GcProjectTour` component, render-tested with a
  stand-in page: the tour opens the Schedule tab at the chart's stops and puts the tab back on
  Done.

## Left out, and why

- **No sentence of an existing stop changes.** The tour is a shared file, so this piece adds only.
- **The tour does not press anything.** It does not switch the chart to By company or open a bar.
  It is look-don't-touch, as before. The stop says what to tap.
- **No stop inside the trade's portal itself.** The portal is the trade's page, and its own
  walkthrough is the Portal lane's.
- **No Spanish.** The office's tour is in English, as it is today.

## Is this the best we can do?

1. **The tour opens each stop's tab.** Without it, a person on Trades who presses *Walk me through
   this job* gets twelve cards in the middle of the page, each saying "on the Schedule tab". The
   doors would still be missed, which is the problem this piece exists to fix. The cost is one
   optional prop and a second look in `SpotlightTour`, and every other tour runs as before. **I
   pick it.**
2. **Each job gets the stops for its stage.** A bidding job's walk drops from 18 stops to 16, and
   nothing on it points at a chart that is not drawn yet. A building job's grows to 30, every one
   at a real door. *Missing* stays for what the day may or may not show: a late finish, a mismatch,
   a held bar. **I pick it.** It is an added field and one filter. A stop whose stage is wrong is
   noise for a first-timer.
3. **A ? beside each card**, starting the tour at that card's stop. The tour already takes
   `startIndex` (v2.4125). That would let a person ask about one card without the 30-stop walk.
   **Not now.** It puts a button on every card, and the walk reaches every card already. It is the
   next step if the owner finds 30 stops long.
