---
name: "GC mode, the Gantt: the plan"
parent: to-dos/gc-mode/README.md (punch list #81)
status: planned 2026-10-05 at the owner's ask ("it's time we start building the gantt chart tooling for the project") · mock-up `gantt-mockup.html` · the numbered features are in GANTT_FEATURES.md · the owner answered calls 1, 2 and 7 the same day · **Phase 1 built 2026-10-05** on the prototype (`gcGantt.ts`, `GcGantt.tsx`) · Phase 2 and the first slice of Phase 3 built the same day · the rest of Phase 3 next
summary: >
  How the Schedule tab's chart becomes a working Gantt: a chart you can read at a glance and move
  by hand, kept true by a weekly walk, with a view for the customer and a view for each trade drawn
  from the same dates. Five phases on the prototype, then what the real build needs.
---

# The Gantt: the plan

## The ask

The owner, 2026-10-05, on a project's page: "it's time we start building the gantt chart tooling
for the project … so at any time we can have an accurate look at the project and be able to
communicate that to the owner and follow up on the trades."

That is three jobs, and every feature in `GANTT_FEATURES.md` serves at least one:

- **See**: an accurate look at the job at any time.
- **Tell**: say it to the customer in a form they can read.
- **Chase**: follow up on the trades from it.

## What we already have

The Schedule tab is further along than "start building" suggests. On `spike/gc-mode` today
(`gcBuildingSchedule.ts`, `GcBuildingSchedule.tsx`):

- A bar per activity, grouped by trade, with percent done, a today line, and the plan at Start
  drawn under any bar that moved.
- Each activity is a line of a trade's statement of work, so "how far along" and "how far along it
  should be" are read on the line the trade reports and bills on.
- Links between activities, spare days, the critical path, and a push that moves what comes after.
- Milestones, inspections that pass or fail, submittals that hold the work they cover.
- The projected finish against the contract's day.
- The trade's weekly done or not done, and the superintendent's verify list.

What it is not yet:

- **You cannot read the logic.** Links are not drawn, and the critical path is a word on a row.
- **You cannot move it by hand.** Every change is a form.
- ~~**It counts calendar days.**~~ Not a gap after all: the owner, 2026-10-05, "anyone can work 365 days a year", so calendar days are the right count.
- **Nothing makes it stay true.** No weekly walk, no sign that it has gone stale.
- **It has one audience.** The customer gets words in the weekly report. A trade gets a look-ahead
  list. Neither gets a picture.
- **A moved date tells nobody.** A trade learns its start moved when someone calls.

So the plan is to finish the chart, not to start one.

## The shape

Five pictures of one schedule (`gantt-mockup.html`):

1. **The office's chart.** Links drawn, the chain with no spare days in red, weekends shaded, held
   bars striped, a strip of numbers on top, zoom, group and filter.
2. **One activity, opened.** Its dates, what it waits on and holds up, who, their last word, a
   quick what-if, and Call and Follow up.
3. **Update the week.** A walk through every bar that should have moved.
4. **What the customer gets.** The stages of the job, the milestones, the finish, what changed,
   what we need from them.
5. **What one trade gets.** Its bars, what it waits on, what waits on it, and a yes or another day
   when we move its dates.

Rules the shape follows:

- **One set of dates.** The customer's and the trade's pictures are views of the office's
  schedule, never a second schedule.
- **Percent is never typed on the chart.** It comes from what the trade reports and we verify.
- **Every move has a reason.** The reasons are what we show a customer who asks why.
- **A trade never sees another company's price**, and the customer never sees a company's name or
  spare days.
- **The chart is its own component**, fed rows. The three views pass it different rows and
  switches. No Gantt library: the app has none, the rows are ours, and the print and portal looks
  need our own drawing anyway.

## The phases

Each phase is playable on the prototype by itself. The feature numbers are from
`GANTT_FEATURES.md`.

### Phase 1. Make the chart readable

The chart as a picture you can trust at a glance. No new data.

- The calendar: weekends and holidays marked on the chart (G-04, G-05). Both are worked, so nothing in the day math changes (G-130).
- Links drawn; the red chain (G-06, G-07, G-08).
- Zoom, group by trade, stage or company, fold a group, filters (G-03, G-11, G-12, G-13).
- Sticky columns and header; opens on today (G-02, G-14).
- Held bars striped, RFIs holding work drawn (G-16, G-71).
- The strip of numbers (G-18); late bars turn amber then red by themselves (G-54).

**Cost that went away:** with every day a working day (the owner, 2026-10-05) no date moves, so the golden test is untouched. As first written: working days move dates, so the golden test's schedule snapshots move
once. That needs the owner's OK and a commit that names them (G-131).

### Phase 2. Make it movable, and keep it true

- Drag to move and to resize, with what will move shown first (G-32, G-33). Undo (G-40).
- Draw and remove links; a gap on a link; "not before" and "must finish by" days (G-34 to G-36).
- Add an activity that is not a schedule-of-values line (G-38).
- Every move asks why, and the history keeps it (G-42, G-43). Actual start and finish (G-55).
- **Update the week** and its "what changed" list (G-52, G-53). A stale schedule says so (G-59).
- The what-if on one bar (G-80). A new baseline after a change order (G-41).

### Phase 3. Tell the customer, chase the trades

- The customer's view, its "what changed" and "what we need from you", in their portal, on the
  Friday report and as a PDF (G-90 to G-94, G-21).
- The architect's view (G-95).
- The trade's chart in its portal, in English and Spanish (G-110, G-119).
- **Tell the trades** after a move, and their yes or another day (G-112, G-113, G-117).
- The start reminders, and By company as the call list (G-114, G-115). Unconfirmed dates become a
  reason on Follow up and count in a company's record (G-116).

### Phase 4. Tie in what holds the work

- Long-lead items, the customer's decisions, permits and utilities as rows (G-73 to G-75).
- A signed change order's days land on the chart and move the contract's finish (G-76).
- A trade not ready to start shows on its bar (G-77).
- Weather days from the daily log; the log and the chart checked against each other (G-58, G-60).
- Days lost by cause; the billing forecast and late-finish days follow the chart (G-96 to G-98).
- The superintendent's morning list (G-118).

### Phase 5. Fit and finish

- Phone view, keyboard and screen reader, big jobs (G-19, G-20, G-135).

### Later, on the owner's word

Templates, a schedule while bidding, a whole what-if copy, ways to get days back, people on site
per week, export and import (G-44, G-45, G-81 to G-84, G-136, G-137).

## What the real build needs

The prototype keeps a schedule on the project (`ProjectSchedule`). The real build needs, each with
RLS and both read-only block calls (`CLAUDE.md`):

- **Activities**: the project, the statement-of-work line or our own stage (or neither, for an
  added activity), planned start and finish, actual start and finish, crew planned, "not before"
  and "must finish by".
- **Links**: from, to, kind, gap in working days.
- **Baselines**: a named snapshot of every activity's dates, with who set it and why.
- **Moves**: activity, old dates, new dates, reason, who, when. Append only.
- **Confirmations**: activity, company, the dates it was shown, yes or another day, when.
- **The calendar**: nothing to store. Every day is a working day; the holidays the chart marks are a list in the code.
- **Weekly walks**: project, week, who, when, what changed.

It reuses: the trade portal's company link for the trade's chart, Resend for **Tell the trades**,
the weekly report for the customer's picture, the Pipeline job and clock-ins for our own crew
(G-51), and Follow up for unconfirmed dates.

It goes after Building's tables in `HANDOFF.md` → *The real build, in order*, step 9. Phase 1's
kernel can be lifted to `src/lib/gc/` earlier, the way `plans.ts` was.

## The owner's calls

Answered 2026-10-05:

1. **Working days.** First "Monday to Sunday and holidays", then, the same day: "holidays and
   weekends do not have to be taken off, anyone can work 365 days a year." So every day is a
   working day and a bar's length is its calendar days. Weekends and six holidays are only marked
   on the chart (`holidaysOf` in `gcGantt.ts`, my list).
2. **Who may move a bar.** "Anyone on our team may move a bar, when a bar is moved an explanation
   should be given and recorded with that saved somewhere." So no role gate inside our team, and
   the explanation is required, not optional. It is Phase 2's first job (G-42, G-43): today's
   editor still saves a move with no reason.
7. **Start with Phase 1.** Yes. "As you build ask yourself is this the best we can do along the way
   and let's make this look great and be very informative."

Still open, each with my default:

3. **What the customer sees.** Stages only, no company names, no spare days. Should a customer who
   is a GC or an owner's rep get the full chart?
4. **Telling the trades.** Does a move email the trade at once, or wait for **Tell the trades** so
   several moves go as one message? My default: it waits.
5. **A trade's "another day".** Does it change the schedule, or come to us as a request? My
   default: a request, on Needs you.
6. **The weekly walk's day.** My default: Friday morning, before the weekly report goes.
9. **Who sets a new baseline** after a change order: anyone, like a move, or the project manager?

## The second look

Asking "is this the best we can do" changed four things from the first sketch:

- **A weekly walk was added.** A better chart that goes stale is worse than the list we have. The
  walk and the stale warning (G-52, G-59) are what make "accurate at any time" true.
- **The customer's view became stages, not a filtered copy of ours.** Thirty trade rows with the
  names taken off still read as our working paper. Six stage bars read as their job.
- **Moves carry a reason from the start**, not as a later add. Without it the customer's "what
  changed" has nothing to say and a time extension has no record.
- **Drag came after readable.** Dragging bars on a chart that does not draw its links moves work
  you cannot see the consequences of. Phase 1 before Phase 2.

## Phase 1, as built (2026-10-05)

The Schedule tab's chart is now `GcGantt.tsx`, fed by `gcGantt.ts` (tested, out of the barrel). The
rest of the tab is as it was: the measures, the editor, milestones, the verify list, the look-ahead.

- **Zoom**: days, weeks, months. It opens on today and **Today** brings it back.
- **Group** by trade, by stage of the job, or by company (the most late work first). A group folds
  into one bar; a group with nothing left to do opens folded.
- **Filters that are the summary**: five pills, each with its count: 5 or fewer spare days, late or
  behind, held, next 3 weeks, moved since Start.
- **Links** drawn from each activity to what waits on it, red along the work that sets the finish.
  Hovering a bar lights its own links and dims the rest.
- **Each bar says where it stands** in a pill beside its name: done, due today, behind, ahead, held,
  failed, 3 days late, or its spare days. The fill should reach the today line.
- **Held work is striped** and says what holds it: a submittal or an RFI. A failed inspection says
  the day it failed and the day it is seen again.
- **A hover card** on every bar: its days, working days, percent against plan, spare days, where it
  sat at Start, what it waits on and what it holds up.
- **The calendar**: every day is a working day. Weekends and holidays are tinted so a date reads at a glance, and a bar that runs over a holiday says so on its hover card.
- **Sticky**: the names stay while it scrolls sideways, the header while it scrolls down.

What the second look changed while building:

- **"No spare days" became "5 or fewer spare days."** On the made-up job only the final inspection
  has none, so a red "chain" was one bar. The work that sets the finish is the work with almost no
  room, and that is what is red now (`TIGHT_SPARE_DAYS`).
- **"Behind" needs 5 points.** Top out at 40% against a plan of 42% is not news; it read amber
  before and is on track now (`BEHIND_POINTS`).
- **Finished trades open folded.** A third of the chart was green rows of history.
- **The strip of numbers became the filter pills.** One row that counts and filters, not two.
- **Open all shows whenever anything is folded.** Before, you had to fold everything to get it.
- **A first draft is nearly all red**, because a fresh draft has no room in it. That is true, so it
  stays; it turns blue as dates are spread.

Not done in Phase 1, on purpose:

- Nothing in the day math: every day is a working day, so the stored dates and the pushes were
  already right, and the golden test did not move.
- A project's own days off, a one-company filter, the spare-days tail, a phone view of its own.

## Phase 2, moving a bar, as built (2026-10-05)

The owner: "start phase 2." Built first, because he asked for it by name: no move without an
explanation. `gcScheduleMoves.ts` (tested, out of the barrel), `GcScheduleMoves.tsx`, and drag in
`GcGantt.tsx`.

- **Drag a bar** to move it, or pull an end to change its length (G-32). A finished bar does not
  drag. While it is dragged the chart shows where it sat, an amber ghost on every bar it would
  push, and a label with the new dates and what happens to the finish (G-33).
- **Every move asks why before it saves** (G-42): a window with the dates before and after, what
  it pushes, what it does to the finish, nine reasons to pick from, and a box for their own words.
  It will not save without a reason and a sentence. The form's Save goes through the same window,
  so there is one way to move a bar. Anyone on our team may (the owner's call 2).
- **Changes to the schedule** (G-43), a card under the chart: every move, newest first, with who,
  the day, the reason, their words, and what it pushed. Kept on the schedule as `moves`.
- **Undo** on the last move standing (G-40), while nothing it touched has moved since. The move
  stays on the record, marked undone with who undid it.
- **What if it slips** 5 or 10 days, on an opened activity (G-80).

What the second look changed:

- **The explanation is a reason and a sentence, not either.** A reason alone ("weather") is what a
  report counts; the sentence is what a customer asking "why" is told.
- **The form saves through the same window.** Two ways to move a bar would have meant one of them
  skipping the explanation.
- **Undo is only the last move, and only while it is safe.** A general undo would quietly overwrite
  a later move someone else made and explained.
- **The reducer still takes a move with no explanation** (the old action shape), and then keeps no
  record. No screen sends one. This is why the golden test did not move; the real build makes the
  explanation required in the database.

## Phase 2, the weekly walk, as built (2026-10-05)

The owner: "build the weekly walk." `gcScheduleWalk.ts` (tested, out of the barrel),
`GcScheduleWalk.tsx`.

- **A line over the chart** on a job being built says when the schedule was last walked: *check
  the dates* (never, or a week ago or more, `WALK_STALE_DAYS`), *part walked* (the last walk left
  bars not looked at), or *walked*, with who and the tally. **Update the week · 8** opens the walk.
- **The walk lists every bar that should have moved**, the worst news first: a failed inspection,
  late work, work due today, work behind, held work, the rest under way, then what starts within a
  week (`WALK_STARTING_DAYS`). Finished work and work further out are not on it.
- **One bar at a time**: what the trade reported against the plan, the days the daily log has
  them on site this week, what holds it, its spare days, and the day its pace points to.
- **Three answers**: *Yes, keep it*; *Take Fri Oct 9, its pace*; or a new day typed in. A new day
  is a move like any other: it shows what it pushes and what it does to the finish, and needs a
  reason and a sentence. A bar under way moves its finish; one not started moves whole.
- **Finish the walk** records it (`schedule.walks`: who, the day, what was kept, the moves, how
  many were not looked at) and ends on **What changed**: each move in a sentence, with why.

What the second look changed:

- **The walk offers the day the pace points to.** Without it the walk asks a question the person
  has to work out. With it, the likely answer is one press and a sentence.
- **A part-walked schedule says so.** A walk that looked at two bars of eight would otherwise turn
  the line green.
- **A bar moved during the walk keeps its place on the list**, so the count and the order do not
  shift under the person walking.
- **Percent is still never typed.** "Done" comes from the trade's report and our verify list; the
  walk only moves dates.

Not done, on purpose: the stale warning on the board row and the dashboard (a line on the ring
card moves every lane's snapshots; it waits for the owner's word), and sending **What changed** to
anyone (Phase 3). Closing the walk without finishing keeps the moves made and records no walk.

Left in Phase 2: draw and remove links on the chart (G-34), a gap on a link and the two date
limits (G-35, G-36), an added activity (G-38), actual start and finish (G-55), a new baseline
after a change order (G-41), redo.

## Phase 3, the first slice, as built (2026-10-05)

The owner: "you choose, keep going." Phase 3 first, because the walk's **What changed** had
nowhere to go. `gcTellTrades.ts`, `gcCustomerSchedule.ts` (tested, out of the barrel);
`GcCustomerSchedule.tsx`, `GcPortalDatesMoved.tsx`, and Tell the trades in `GcScheduleMoves.tsx`.

- **Tell the trades** (G-112), from Changes to the schedule: the standing moves nobody has been told
  of, grouped by the company whose days they changed (its own line, or one the move pushed). One
  message per company in its language: hello, the job, each line's new days and old, why, and the
  ask to answer in its portal. Shown before it goes; nothing leaves the app. The move keeps the
  day and the companies told.
- **Your dates moved** (G-113), in the trade's portal: the message as it went, **These dates
  work** or **I need another day** with the day and a word on why. A to-do on the portal's home
  until answered. The office reads each answer on the move's row: "the dates work", or "asked for
  Mon Oct 19: …".
- **Your schedule** (G-90 to G-92), in the customer's portal: we finish against the contract, work
  done against plan, the next date they will care about; the stages of the job as bars with the
  dates to meet; **What changed this week** by stage and reason, never by company; **What we need
  from you**, the change orders waiting on their signature.

What the second look changed:

- **The customer's "what changed" gives the finish in days, not a date.** Their finish date reads
  the pace of the work too, so a second date from the move's own arithmetic would argue with it.
- **A trade not told shows on the move**: "The trades have not been told." A move with no
  consequence for anyone outside the office says nothing.
- **The answer is one per company per move**, and only from a company that was told. A second
  press changes nothing.

Not done, on purpose: the trade's own chart in its portal (G-110) and the start reminders (G-114);
a company's "another day" is on the move's row and in the log, not yet on Follow up or Needs you
(a Follow up reason moves the board's counts, so it waits for the owner's word); the customer's
PDF and the architect's view (G-94, G-95); the Friday report's words are unchanged (G-93).

## Phase 3, the trade's chart, as built (2026-10-06)

- **Your schedule on this job** (G-110), in the trade's portal on a job being built: its own bars
  with percent, the work before it and the work waiting on it by the name of the work and the
  company, never a price; a bar moved since Start says by how many days; today marked. In the
  portal's language (G-119). `gcPortalSchedule.ts` (tested, out of the barrel),
  `GcPortalSchedule.tsx`.
- The second look: one job at a time, under that job, rather than one chart across every job the
  company has with us. The portal's home already lists the jobs; a chart across them would repeat
  it with less room.

## Phase 2, links by hand, gaps and day limits, as built (2026-10-06)

- **Draw a wait** (G-34): pull the small circle at a bar's end to another bar, and that bar waits
  on this one. **Press a line** to take a wait off. Either opens Why it moved like a move, since
  what waits on what is part of the plan and is kept with who and why.
- **A gap on a wait** (G-35): on the opened activity, "+N days" beside each wait it has. The
  pushes, the spare days and the projected finish count it; the chart writes "+3" on the line.
- **Not before** and **Must finish by** (G-36), on the opened activity: a day it cannot start
  before stops a move that would; a day it must finish by warns, in the form, in Why it moved and
  on the chart, where the mark turns red once the bar runs past it.
- **A loop is named, not refused.** The owner's own walk makes one on purpose (framing waits on
  electrical, which waits on framing), and the reducer always took it. Why it moved now says which
  activity already waits on this one, so the loop is a choice and not a surprise.
- The second look: the reducer stays as it was for the old action shape, so the golden test did
  not move; the limits are set or dropped, never left as undefined keys.

Left in Phase 2: an added activity that is not a schedule-of-values line (G-38), actual start and
finish (G-55), a new baseline after a change order (G-41), redo.

## Phase 4, change-order days on the chart, as built (2026-10-06)

The first of Phase 4 (G-76). `gcChangeOrderDays.ts` (tested, out of the barrel), a card on the
Schedule tab, a tail on the chart, two sentences in the customer's portal.

- **Where the days land.** A signed change order that adds days has a trade; its days land on that
  trade's bar running the day the customer signed (else the next to start, else the last). An order
  on our own work under general conditions has no bar: only the contract's finish moves, as before.
- **A tail until they are on the dates.** The chart draws the days as a hatched tail after the bar,
  with the order on its hover card, and the bar's note reads "+3 days by change order, not on the
  dates yet". The contract's finish already counted them (`substantialCompletionOn`); the tail is
  the gap between the contract and the chart, made visible.
- **Put its days on the schedule**, from the *Days from change orders* card, opens Why it moved with
  the bar's finish out by the days, *A change order* picked as the reason (a new reason), and the
  order's own words filled in. It saves as a move like any other, so what follows is pushed, the
  trades are told, and Undo puts it back. The move carries the order (`changeOrderId`), which is
  how the card knows the days are on the schedule.
- **The customer's schedule** says "Change order 2 added 3 days to your contract. Substantial
  completion is now Fri Dec 14, 3 days past the Dec 11 you signed." A landed move reads in What
  changed as "because of the change order you signed".

What the second look changed:

- **The days are not put on the schedule by themselves.** The reducer could lengthen the bar the
  moment the customer signs, but then nobody would have said which bar, and the move would carry
  no one's name. The office presses once, and the press is the explanation.
- **A tail, not a longer bar.** Until the press, the bar keeps its drawn dates, so the trade's own
  chart and the walk read what was agreed; the tail says what is coming.

## Phase 4, what the work waits on, as built (2026-10-06)

Long-lead items, the customer's decisions, permits and the utility (G-73, G-74, G-75) are one
record (`ScheduleWait`, four kinds), one kernel (`gcScheduleWaits.ts`, tested, out of the barrel),
one card on the Schedule tab and one block on the chart.

- **One row each, over the groups**, from the day it was ordered, asked for, applied for or
  requested to the day it is expected or came: ● ordered, ▲ shipped (a delivery), ◆ expected or
  ■ in; a mark on the day the work needs it; a dashed line to each line it holds. Red when it
  comes after the work was to start, or its day has passed with nothing in.
- **It holds the work the way a submittal does**, but only when it would: expected on or after the
  day the work starts, or its day passed. One expected well before the work is a row to watch, not
  a held bar. A submittal or an RFI on the same line wins the pill; the wait is still drawn.
- **The card**: each one's kind, who we wait on, where it stands, its next step in its kind's words
  (*Ordered today*, *Shipped today*, *On site today*; *Asked*, *Decided*; *Applied for*, *Issued*;
  *Requested*, *Done*), a new expected day with who said so, and a way off. **Add one** asks the
  kind, the name, whose work it is for, who we wait on (the trade's supplier, the customer, the
  city or the utility by default), the day expected, the day asked, and the lines it holds.
- **The customer reads their decisions** under What we need from you, with the day the work needs
  them: "Your decision on the restroom tile, needed by Mon Nov 30: Trim waits on it."

What the second look changed:

- **Four kinds, one record.** Three records would have meant three cards and three blocks on the
  chart for the same question, who we wait on and when. The kind only changes the words.
- **A hold only when it would hold.** Holding every line on order from the day it was ordered
  would have striped half the chart on a healthy job.
- **No sample waits in the made-up data.** The golden test pins the whole state at the end, so a
  sample delivery on Fair Oaks D moves that snapshot; adding one is the owner's call
  (`PUNCHLIST.md`). The flow is checked by adding one in the browser.

## Phase 4, days lost, as built (2026-10-06)

Weather days from the daily log (G-58) and days lost by cause (G-96), one kernel
(`gcDaysLost.ts`, tested, out of the barrel).

- **A lost day on the bar.** A daily log that says the weather held a trade, or stopped the site,
  puts a lost day on every bar that trade had running that day: a dark stripe on the day, the
  log's words on its title, a line on the hover card. "Outside" is read from the log, not guessed
  from the trade: the trade the superintendent said the rain stopped was outside.
- **The walk offers them.** A bar with lost days no weather move has answered lists them among
  its facts, and **Add the N lost days** fills the move in: the finish out by that many days, the
  weather as the reason, the dates and the log's words as the explanation. One press and Move it.
- **Days lost, by cause**, a card under Changes to the schedule: every standing move's reason laid
  at a door (the customer's: the customer, a change order, the plans; the weather's; a trade's:
  the trade before, materials, crew, an inspection; ours; other), with what each did to the job's
  finish and to the work itself, and the log's weather days beside. The sentence on top is the one
  a time extension ask opens with.

What the second look changed:

- **A lost day is answered by a weather move on that bar**, not by any move. A bar moved for a
  short crew still has its rain day open.
- **The finish and the work are two columns.** A trade's 7 lost days inside its spare days cost
  the finish nothing; a customer's 10 days on the final inspection cost it all 10. The ask reads
  the first column; the trade's record reads the second.

## Status

Planned 2026-10-05. Phases 1 and 2 (all but an added activity, actuals, a new baseline and redo)
and most of Phase 3 built by 2026-10-06; Phase 4's change-order days, what the work waits on and the days lost the same day. Next: the rest of Phase 2 (what holds the work: long-lead items, the
customer's decisions, change-order days on the chart, weather days from the log), or the rest of
Phase 3 on the owner's word.