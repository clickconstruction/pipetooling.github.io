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

Answered 2026-10-06, each as its default (the owner: "I agree with all your suggestions"):

3. **What the customer sees.** Stages only; a customer who is a GC or an owner's rep gets **See
   every bar**, the List view with no company, no dollars, no spare days.
4. **Telling the trades.** A move waits for **Tell the trades**, so several moves go as one message.
5. **A trade's "another day".** A request: on the move's row, on Follow up as a reason on the
   company, and in the dashboard's phrase, until the bar moves again.
6. **The weekly walk's day.** Friday morning, before the weekly report goes; the walk line says so
   on a Friday.
9. **Who sets a new baseline** after a change order: anyone on our team, like a move.

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

## Phase 2, an added activity, as built (2026-10-06)

An activity that is no trade's line (G-38): mobilize, cure time, the customer's own work.
`gcAddedActivity.ts` (tested, out of the barrel), a card on the Schedule tab, and the editor's
own buttons for it.

- **The job's own bar.** It has a name, whose it is (our own crew, the customer, cure time, or
  typed), its days, what it waits on and what waits on it. Its id is its own
  (`<project>-own-N`), its trade is "The job's own", and it has no dollars: it is not in work done
  against the plan, and no trade reports it. It counts on the critical path like an inspection.
- **Tied in on the press.** The lines ticked under *It holds up* wait on it from then on, and what
  that pushes moves out, said in the log line. After that it moves like any other bar, with why.
- **Done when the office says.** The opened activity has *Mark it done today*, *Not done after
  all* and *Take it off the schedule*; off the schedule, whatever waited on it stops waiting.
- **On the chart** it groups under *The job's own* by trade and by company; by stage it sits among
  the stages where its first day falls. The walk lists it as starting or under way, with no
  percent to read. The customer's What changed names it by its own name.

What the second look changed:

- **A delivery is not an added activity.** The plan listed it with mobilize and cure time, but a
  delivery is something the work waits on from outside (G-73), with an order, a ship and an
  arrival; it went there.
- **No percent.** A cure is done when its days pass and someone says so; typing 60% on it would
  be a number nobody reports and nobody verifies.

## Phase 2, the rest, as built (2026-10-06)

Actual dates (G-55), a new baseline (G-41) and redo (G-40): `gcActualDates.ts`, `gcBaseline.ts`,
and redo in `gcScheduleMoves.ts`, each tested.

- **The days it really ran** sit beside the planned ones. The walk asks, where someone knows: *It
  started Mon Sep 21*, *It started today*, *It finished today*. The opened activity has the two
  dates to type. The chart draws them as a thin green line over the bar, open-ended until it
  finished, and the hover card says "Started Wed Sep 23, 2 days late; not finished."
- **A new baseline** takes the plan as it stands as the one every measure reads against; the old
  one is kept and named (*At Start* first). The card says when one is due, a signed change order's
  days on the schedule since the last one, and offers the name *After change order 2*. Anyone on
  our team may set one, like a move; who should is the owner's call 9.
- **Redo** puts the newest undone move back, while everything it touched still sits where the undo
  left it and no newer move stands.

What the second look changed:

- **A trade's report does not set the actual dates on the prototype.** It should, and the real build
  will; here it would move the golden walk's snapshots (Helotes reports work after its schedule is
  drawn), so it waits for the owner's word, in `PUNCHLIST.md`.
- **A baseline set the same day a change order's days landed covers them.** Otherwise the card
  would say a new one is due the moment one was set.

## Phase 3, the rest, as built (2026-10-06)

- **The architect's view** (G-95): *The schedule* in the architect's portal, the customer's
  stages against the finish, then what waits on them: the submittals and questions in their hands,
  each with the work it holds and the day we need it back, the soonest first, red once late.
  `gcArchitectSchedule.ts`, `GcArchitectSchedule.tsx`.
- **Start reminders** (G-114): a company whose first day is 14 days off reads so in its portal,
  and again at 3 days, in its language, with what must be in place first: its submittals not yet
  approved, an insurance certificate that runs out before the start, an unsigned statement of
  work. A start that passed with nobody on site keeps the last one showing, in other words.
  `gcStartReminders.ts`, rides in `portalMessages` as the job's kind of email.
- **The Friday report's schedule** (G-93): a *The schedule* section after At a glance, each stage
  with where it stands and its dates, what changed this week in the customer's words, and what we
  need from them. The same sentences their portal shows.
- **The schedule on its own** (G-94): *Send Cibolo Creek Partners their schedule* on the Schedule
  tab, the letter as it would go today, the same picture as their portal with the dates to meet;
  Send keeps it on the job as it went, dated and by whom; Print or PDF opens it as a plain page to
  print or save. `gcCustomerScheduleSend.ts`.

What the second look changed: the architect's holds are named by the work and its start, not by
the trade's company, the way the customer's view keeps company names out; and the reminders are
derived, not stored, so a trade that shows up on the daily log stops getting them with nothing to
clean up.

## Phase 3, a trade says it will be late, as built (2026-10-06)

G-117, built by Helper 4 from `to-dos/gc-mode/mockups/G-117.md`. The kernel is
`gcLateNotices.ts`, tested, out of the barrel. The screens are `GcPortalLate.tsx`, under each bar
of *Your schedule on this job*, and `GcLateNotices.tsx`, a card on the Schedule tab.

- **The trade's side.** Each of the company's unfinished bars in its portal has **We will be
  late**. Work under way gives the day it will finish. Work not started gives the day it can
  start, and the bar moves whole. It picks one of the look-ahead's five reasons and writes a
  sentence. The form shows the bars that wait on this one and would move: *Rooftop units by Cool
  Breeze Mechanical would start Thu Oct 15, 3 days later.* After sending, the bar reads *You said
  Wed Oct 14. Click has not answered yet.*, then *Click took your day*, or *Click needs Fri Oct
  9.* with Click's words. In both languages.
- **The office's side.** **Trades say they will be late**, between the chart and Changes to the
  schedule, shows what the company said and when: *Sent today, 7 days before its finish.* It also
  says what taking it does. **Take Wed Oct 14** opens Why it moved with the trade's reason picked
  and its words filled in, and the move carries `lateNoticeId`. So Tell the trades, the customer's
  What changed and Days lost read it like any move, and Undo opens the notice again. **Push back**
  sends the office's words to the portal and the portal's home. The trade answers *We will make
  Fri Oct 9* or sends a new day.
- **Everywhere else.** The bar has an amber dashed tail to the trade's day until it is answered.
  The company has a `late` reason on Follow up, red once the day passes unanswered. Needs you
  says *Summit Roofing says it will be late*. The weekly walk lists the trade's word among the
  bar's facts.
- **Helper 3's read.** `openLateNotices(project)` returns the open notices with `id`,
  `partnerId`, `lineId`, the day asked for, `started`, `reason`, `note` and `on`. G-115's By
  company list reads it, so its shape stays.

What the second look changed:

- **The trade sees what its day does before it sends.** It sees the work waiting on it, never a
  price or the job's finish.
- **A push back gets an answer.** Without one, a push back ends in silence.
- **The walk carries the trade's word as a fact.** The walk cannot keep a bar as drawn while its
  trade says otherwise. The Take buttons in the walk and on Starting soon wait for a later round.

Where a notice stands is worked out each time from the schedule. A standing move carrying it
means taken. A newer notice means replaced. The bar's dates changing means moved. Otherwise it
is the office's answer, or open. No state is copied, and the golden walk did not move: the made-up
data has no notice.

## Phase 5, fit and finish, as built (2026-10-06)

- **A phone view** (G-19): the chart's toolbar has *Chart | List*. A phone opens on List: the
  stages of the job, the one running today first, then the ones ahead, then the ones done,
  folded; each a table of its bars with the dates, where each stands, and a small bar in the
  stage's span with today marked. `GcGanttList.tsx`, `ganttListGroups`.
- **Keyboard and screen reader** (G-20): on the chart, Tab reaches a bar, up and down move to
  the next bar, left and right scroll a week, Home and End go to the ends, Enter opens one. Every
  bar reads its name, company, dates and standing; the List view is a real table with headers.
- **Big jobs** (G-135): only the rows inside the scroller's window are drawn, with 400 px of
  overscan; the rest keep their height as spacers, so the links and the sticky names still line
  up. `rowsInView`, tested on 300 rows.

What the second look changed: the List is not only for phones. It is the same rows a screen
reader gets and the quickest read of "what is this stage doing", so it is a view anyone can
switch to, and the phone only opens on it.

## Phase 4, a trade not ready to start, as built (2026-10-06)

G-77, by Helper 5 (the mock-up and plan: `mockups/G-77.md`). `gcNotReady.ts` (tested, out of the
barrel), `GcNotReady.tsx`, and one line in the Schedule tab's holds.

- **A held bar like any other.** On a job being built, a trade's bar that has not started is held
  when its trade is not ready: the same amber stripes, the *held* pill, and the note after *waits
  on*: "waits on current insurance, theirs ran out Sep 15", or several papers by name, "waits on a
  signed master agreement and a signed statement of work". It turns red with ", late" once the bar
  starts within 3 days or its day passed, the day the trade's last start reminder goes. A bar
  already held keeps that hold after the papers: "waits on current insurance and submittal
  28 31 11-01". The Held filter, the group's chip and the walk count it like any hold (its kind is
  `paperwork`).
- **Ready is Get started's five steps**: awarded, master agreement, insurance, W-9 and statement of
  work, a statement signed on older plans counting as not in. Insurance is read on the bar's own
  start: none on file, run out, or running out before it starts once the renewal ask is due (30
  days). Further out the usual renewal has time, and a bar striped months early would be noise.
- **The opened activity says what to do.** First under its name: "Pecan Valley Electric is not
  ready to start this on Mon Oct 19.", each paper in Get started's words ("Insurance ran out Tue
  Sep 15."), a day they gave in Follow up's words, and the paper's own next step: *Ask for it*,
  *Remind them*, *Send to sign*. The button opens the company's window on that paper's send
  (`send: true` on `openPartner`, as `openCustomer` has), so the ask goes with a day it is due and
  Follow up chases it. Where nothing can be sent from there, Get started's sentence: an award, a
  statement on older plans, a drafted statement waiting on the master agreement ("It goes once the
  papers above are in.").
- **Where it does not show**: while buying out (the whole job is not ready, and Get started is the
  place), on running bars (their trade is on site), on our own crew, inspections and added
  activities, in the customer's and the architect's views (they pass no holds), and on the board
  row, the ring card, Follow up and Needs you (each would move the golden walk).
- On Fair Oaks D today: Site lighting and Fire alarm, Pecan Valley's two bars not started, its
  insurance run out Sep 15. The Held filter reads 6 where it read 5.

What the second look changed:

- **One press to the send, not two.** The button names the paper's own next step and opens its
  send, rather than the company at the paper.
- **Two left for the owner**, as G-138 and G-139: a trade on site whose insurance ran out saying so
  on its running bars, and the trade's start reminder naming every paper its bar waits on. A test
  holds that the reminder never names a paper the bar does not.

## Phase 3, By company as a call list, as built (2026-10-06)

G-115, Helper 3 (mock-up `mockups/G-115.md`). `gcCallList.ts` (tested, out of the barrel),
`GcCallList.tsx`, an optional `callList` on `GcGantt.tsx`, and the Follow up sheet's call form.

- **By company opens the call list** under the chart's toolbar, in Chart and List, on a job being
  built: *5 to call about the schedule · 2 late*, then one row per person, late first, with every
  reason under the name. The rows are Follow up's own (`PeopleRows`): **Call** dials and opens the
  Follow up sheet on *What did they say?*, **Follow up** opens it on a draft, **Work the list** walks
  them all. **Hide** folds it to its first line.
- **Who is on it.** A hired trade, for an inspection that failed on its work, a bar late, due today
  or behind, new dates told and not answered or answered with another day, its own word from its
  portal that a bar will be late (G-117: *Summit Roofing says TPO membrane will finish Wed Oct 14,
  not Fri Oct 9: materials.*), and a first day on site within two weeks nobody confirmed. Whoever
  owes what holds a bar: the trade for its own submittal, its supplier's delivery or its papers
  (G-77: *Fire alarm waits on current insurance.*), the architect for a submittal or an RFI with
  them, the customer for a decision. Every hold on a bar counts, not only the one the chart's pill
  shows: a submittal, an RFI and a wait come from their own records, any other kind from the chart's
  map. A kind it does not know is the trade's own, worded as the chart words it. A hold on us, the
  city or the utility is a muted aside under the trade, never a row. Then everything else they owe
  on this job (`projectPeople`) is merged under the name, and Follow up's copy of a late notice is
  said once.
- **A line about a bar opens it** in the editor above the chart, and the page comes to it. The opened
  bar has its company at its foot: their word on its newest dates, **Call Marcus** and **Follow up**.
  That is picture 2 of `gantt-mockup.html`.
- **The call's answer lands where it belongs.** The call form asks *On the new dates*: *No answer
  yet*, *They work*, *They need another day*. That goes through `tradeAnswerDates`, as the portal
  answers. A day given on a delivery or a decision is its new expected day, with who said so. A day
  on their submittal or their start becomes their word (`recordPromise`), which Follow up chases and
  Building keeps. No new action type: the golden test did not move.
- **The draft names each bar** with its trade, in English and Spanish: *your roofing TPO membrane on
  Fair Oaks Shops, Building D. It is 50% done, and our plan had 100% by today. When will it be done?*

What the second look changed:

- **Held work goes to whoever holds it.** A submittal with the architect is a call to the architect.
  The trade keeps it as an aside, so the caller can answer if asked.
- **A decision not holding work yet makes no row.** The rule is the chart's: a wait holds only when it
  comes after the work starts. So the customer is not on the fixture's list, and the count is five.
- **A company that asked for another day is on the list for it.** Follow up already counts it, and
  the office owes it an answer.
- **A line's name reads with its trade inside a message.** Alone, *your Erection* read badly.
- **A hold the chart folds into G-77's paperwork still reaches its own owner.** The pill on Fire
  alarm reads *current insurance and submittal 28 31 11-01*. On the list, the trade is asked for its
  insurance, and the architect for the submittal.

Not done, on purpose: these reasons are not counted on the board row, Follow up's badge or Needs you.
That moves the golden walk's people counts, so it is the owner's call. A day given on a call about
late work under way is only logged: whether the office's call writes G-117's late notice on the
trade's behalf is the lead's next call. The nudge for several things still ends *Could you send them
this week?*, which is the sheet's own sentence. *A full note* reads right.
## Phase 2, pulling work earlier, as built (2026-10-06)

G-37, built by Helper 1 from `mockups/G-37.md` with the lead's go. `gcPullEarlier.ts` (tested, out of
the barrel), `GcPullEarlier.tsx`, and a door each in the walk, the Schedule tab and the chart. The
owner's call: on a press, never by itself, so no report or finish ever pulls anything on its own.

- **What finished early**: an activity whose finish day is before its planned finish. That day is its
  recorded finish (the walk's *It finished today*, the editor, a trade's 100% report), an inspection's
  pass, or an added activity's done day. A line reported at 100% with no day recorded counts as today.
- **What comes in**: the work right behind it, starting within 2 days after it finishes
  (`RIGHT_BEHIND_DAYS`) plus any gap on the wait. Each comes in by the days given back and never
  more, then what is right behind those. Never before tomorrow (`PULL_SOONEST_DAYS`), its *Not
  before* day, or the day after an open delivery, decision, permit or utility on it is expected.
- **What keeps its dates, and says why**: work started or done; work held by a submittal, an RFI, a
  late wait or its trade's papers (G-77, "It waits on current insurance and submittal 28 31 11-01");
  a trade's own word that it starts later, its late notice (G-117) or another day it asked for
  (G-113), until the office answers it; an inspection the city sees again; work drawn with more
  room; work still waiting on something else; and anything the office unticks.
- **One offer per job.** On Fair Oaks D neither Ductwork nor Top out alone moves the rough-in
  inspection, which waits on both. Finished early together, they bring it in 7 days.
- **The press**, *Pull the work earlier*: what finished early, each activity that comes in with a
  tick, what keeps its dates and why, the finish, then *Finished early* preset as the reason (a new
  reason) and the sentence filled in. Under the finish, what the pull moves between bills, read the
  way Why it moved reads a move (G-97's `planBillingShift`): "Billing: $14,301 of the Nov 25 bill
  moves to Oct 25." The move's row says the same shift after the press, and a pull that moves no
  money, like the rough-in inspection's, says nothing. It saves one move (`pullScheduleEarlier`, `ScheduleMove.pull`).
  Undo, Redo and Tell the trades read it like any move, and Tell the trades never tells the company
  that finished.
- **Where it shows**: a green line under the walk line, with the press, or with what holds the days
  when the next work is held (TPO membrane's followers wait on submittal 07 62 00-01 and RFI-003).
  The walk lists *Work that finished early* above the week, and opens a box right after *It finished
  today*. *Keep the dates* is kept on the walk (`ScheduleWalk.keptEarly`) and ends the offer. A box
  under the opened activity. A green ghost on the chart at the sooner days, and *Could start* on the
  hover card.
- **After the press**: the history reads "Plumbing · Top out and 1 more finished early. Rough-in
  inspection was pulled earlier with them." The customer reads "Rough-in is 7 days sooner than
  planned. The finish holds." Days lost has its own line, *Finished early*, with days back, never
  netted against a trade's door (the lead's call).
- Tests: `gcPullEarlier.test.ts` (30) and `GcPullEarlier.render.test.tsx` (9). The golden test did
  not move: no fixture change and no new step.

What the second look changed:

- **Only the days given back.** "As early as the waits allow" would bring Fair Oaks D's Plumbing trim
  in from Nov 30 to Oct 14, through 47 days of room drawn by hand.
- **One offer per job, not one per finish**, since two finishes can each be stopped by the other.
- **Keep the dates is its own field on the walk.** Counted as kept as drawn, a *Yes, keep it* pressed
  after *It finished today* would have ended the offer without anyone deciding.
- **Held work is named, with no press.** An early finish wasted on a late submittal is what to chase.

Not done, on purpose (the lead's call, out of this round): Needs you on the dashboard; a walkthrough
stop, since the made-up data has no early finish to anchor one on; and a pulled trade reading "Can
you start sooner?" instead of "Your dates moved", with its Spanish list. The defaults, my own with the
lead's OK: 2 days for right behind, and tomorrow as the soonest a pull can start.

## Phase 4, the daily log and the chart, as built (2026-10-06)

G-60, by Helper 5 (the mock-up and plan: `mockups/G-60.md`). `gcLogVsChart.ts` (tested, out of the
barrel), `GcLogVsChart.tsx`, a note and a hover line on the chart.

- **Two stories, one week.** The daily log says who was on site, by trade; the chart says whose work
  runs. This week, Monday to today, on the days with a log, a bar runs inside its planned dates,
  past its finish while not done, or inside its real dates. **On site, no bar**: a crew on site on a
  day none of its bars runs, one day being enough. **Not on site**: a trade's bars not done run on 2
  or more logged weekdays and its crew is on none of them. A day the log says the weather stopped
  the site, the job or that trade does not count (G-58's weather, read for a crew that never came
  too); a held bar is explained by its hold. Our own crew counts like any trade.
- **The chart keeps one look.** The note beside the bar, in the held note's place in the order:
  "not on site this week" on each of an absent trade's running bars, "on site this week, before
  this starts" on a trade's next bar. The hover card's *Log* line says it in full: "Nobody from
  Summit Roofing on the daily log Mon, Tue and Thu."
- **A card under the chart**, only when something disagrees: one row per trade, the sentence, what
  to do, and its buttons. *Open TPO membrane* opens the bar's editor and brings it into view; *It
  started Fri Oct 2* keeps the real start (`setActualDates`, the walk's own press) and the row goes.
  A trade back after its work finished, Guadalupe on a folded Concrete, has no bar to write on, so
  the card says it: "If it is punch work, nothing changes."
- **The Daily log tab** has the card's on-site rows under *This week*, where the person who wrote the
  log knows why, with *It started* there too.
- **It never contradicts the walk.** It reads the week the walk reads (`onSiteWords`): a test pins
  that a bar on this week's walk and its row name the same days, with the weather's days in both.
- On the made-up data the log and the chart agree, so nothing shows; the browser recipe in the
  mock-up writes the logs that disagree.

What the second look changed:

- **A name with its own "and" gets a comma**: "Panels and feeders, and Lighting".
- **Left out on purpose**: a Follow up call from a row (the sheet belongs to the page; G-115's call
  list is its home) and a one-press move with the log's reason (the log gives a reason, not a day).

## Phase 3, print and PDF, as built (2026-10-06)

G-21, Helper 2 on `spike/g21`; the mock-up and plan are `mockups/G-21.md`. `gcGanttPrint.ts` (tested,
out of the barrel), `GcGanttPrint.tsx`, one optional prop on `GcGantt.tsx`, and the job's words from
the Schedule tab.

- **Print or PDF** at the right end of the chart's toolbar, in the Chart and the List view, off when
  nothing passes the filters. It opens **Print the chart**: how many landscape pages, what it shows
  in the pills' own names (*It shows 5 of 30 activities, by trade. Filter on: Late or behind.*),
  the folds, the lines, **Who it is for** (*Our team*, *The customer*), and the pages small in a
  frame as they will print. Its **Print or PDF** opens them in the browser's print dialog through
  the app's `printHtmlInNewWindow`; *Save as PDF* is one of the printers there. The window is
  light in both themes (`data-theme="light"`).
- **The paper is a document of its own**, never the screen sent to a printer: letter landscape,
  one SVG a page, drawn in points from the chart's own kernel (`ganttFilter`, `ganttGroups`,
  `ganttLinks`). The filters, the grouping, the folds and *Hide the links* carry over; the zoom does
  not, since the paper fits the span to its width: every day at 10 points a day or more, Mondays at
  2 or more, the 1st and 15th below. The span is `ganttAxis` over the bars shown, so a filtered print
  draws close. Black and the greys for the page, the chart's status colors for the bars, and patterns
  and words so a black and white printer keeps the meaning.
- **Our team's copy**: the head (the job, *For our team*, the projected finish as the Projected
  finish card says it, on a late job the lines the measure prints under it from `lateFinish` (G-98:
  the money at the fee, whose days, the change orders), the work done, what it shows), then columns for the hover card's facts
  (*Activity*, *Dates*, *Done*, *Plan*, *Where it stands*), the dates to meet on every page, what the
  work waits on on page 1, the chart's own notes beside the bars (`barNote`, so G-77's papers and
  G-60's word from the daily log print as the chart says them), a trade's new day from its portal as
  the chart's amber dashed tail (G-117), where a bar could start earlier as the chart's green ghost
  (G-37), the spare-day tails when they are on (G-08), the lines, today, and a key of only the marks
  on that page, with *Page n of N*.
- **The customer's copy** reads what the customer's own views read, from one call,
  `customerSchedulePicture` in `gcCustomerSchedule.ts`: the stages for an owner, every bar by stage
  for a GC or an owner's rep (`customerFullChart`, call 5), then *What changed this week* and *What
  we need from you*. No company, no spare days, no red edge; the filters and folds do not change it.
  The words the letter, the portal and the list each wrote out (`CUSTOMER_STAGE_WORDS`,
  `customerDoneWords`, `CUSTOMER_NOTHING_MOVED`, `customerBarWords`) now live in that file once, and
  all three read them.
- **Next 3 weeks** prints the look-ahead sheet: the Monday of last week to the Sunday three weeks
  out, a day at a time, the weekends tinted, a bar past an edge cut there and marked.
- **Paging**: a page takes rows while they fit; a heading never ends a page unless two of its rows
  fit under it; a cut group repeats its heading, *continued*; a line prints only when both its bars
  are on the page; the customer's lists go under the last rows, or on a page of their own. Fair Oaks
  D as the chart opens is 2 pages, with Late or behind 1, with Next 3 weeks 1, the customer's
  stages 1.
- **Tests**: `gcGanttPrint.test.ts` (19: the rows under each filter, the folds, the span and the
  scale, paging, the lines, the dates to meet, both customer copies with no company and no spare
  days, the look-ahead, G-117's tail, the document, and plain words for every sentence),
  `GcGanttPrint.render.test.tsx` (7, G-60's note on paper among them), and the customer's words in
  `gcCustomerSchedule.test.ts` (2).
  No action and no fixture change: the golden test did not move.

What the second look changed:

- **The customer's every-bar copy is their list, not our page with things taken off** (the lead's
  rule): one rule for what a customer may see, in `gcCustomerSchedule.ts`, so the portal, the
  letter and the paper cannot disagree.
- **A heading keeps two of its rows.** A heading with one row under it at the foot of a page read as
  a stray line; it moves to the next page instead.
- **The dates to meet take a third line before two labels run together.** On paper a day is about
  2 points, so *Dry-in Sep 25, 7 days late* ran into *Substantial completion Dec 11* on two lines.
- **The key lists only the marks on its page**, and the page keeps room for the key the print needs,
  so no foot is cut off.

Left out, as planned: a long job's weeks tiled across pages, a paper size choice (a letter PDF prints
on 11 by 17 with *Fit to page*), a line from a bar on one page to a bar on another, a tour stop
(`gcTour.ts` is shared), and a record that a print was made (printing changes nothing on the job).

## Phase 4, the billing forecast follows the schedule, as built (2026-10-06)

G-97, built by Helper 4 from `to-dos/gc-mode/mockups/G-97.md`. The kernel is
`gcBillingForecast.ts`, tested, out of the barrel. The screens are in `GcBillingForecast.tsx`.

- **One rule moves the work.** Each bar keeps the percent its trade reported. The rest is spread
  evenly over its days to its finish. On or after its finish it is done.
- **One rule bills it.** At each bill day the job is copied with every line at that percent, and
  Owner Billing's own `ownerPayApp`, the draft's math, runs on the copy. Retainage steps, our costs
  and fee following the trades, and the floor of what was already billed come out the same. The
  bill counts as sent before the next month. `cashAhead` and `ownerPayApp` are untouched, and a
  test proves it.
- **Fair Oaks D, as the schedule stands:** Sun Oct 25 $368,744 (92%), Wed Nov 25 $70,405 (97%),
  Fri Dec 25 $40,043 (100%), then the $148,876 Cibolo Creek Partners holds, with the final bill.
  With the $860,695 asked so far, that is the price. The draft today asks $98,566 for Oct 25,
  because it bills only the work reported so far. Taking Summit's late day (G-117) moves $6,600
  of the Oct 25 bill to Nov 25, through the rooftop units it pushes.
- **Where it shows.**
  - *What we expect to bill*, under the draft on Bill the customer. A month's ▸ opens the trades
    its bill carries, our costs spread in: Roofing $122,230, Electrical $120,519 and HVAC $114,407
    in October. A *Moved this week* column appears once this week's moves changed a month.
  - *What we bill, month by month*, under the next six weeks on the Money tab, every job with
    what customers hold until the final bills.
  - The customer's bills ahead in their portal's *Your bills*, rounded to the hundred, never by
    trade, with what this week's moves did to them.
  - *Billing: $6,600 of the Oct 25 bill moves to Nov 25.* in Why it moved, and the same in the
    past tense on the move's row, while its bars still sit where it left them.
- **What the data does not carry is said, not invented.** Work spreads evenly inside a bar. The
  architect certifies a bill in full. Stored materials count once they are in place. Retainage
  comes with the final bill, on no day. Any part of the price no bar carries is named on the
  surface.

The second look: a month's trades (▸) answer the first question anyone asks of a big month. The
cash weeks following the bars is G-140, the owner's call: the trades' draws would have to follow
in the same change. The bars' pace instead of their drawn days was not taken, because two dates
would argue. The walk moves the bar, and the forecast follows.

## Phase 4, the superintendent's morning list, as built (2026-10-06)

G-118, by Helper 5 (the mock-up and plan: `mockups/G-118.md`). `gcMorningList.ts` (tested, out of
the barrel), `GcMorningList.tsx` on the Daily log tab, and the chart's holds moved unchanged into
`gcChartHolds.ts` (its own commit first, a test pinning Fair Oaks D's holds and the Held count of 6).

- **The chart read for one day**, above the log on the Daily log tab: *Who should be on site · Fri
  Oct 2*, "5 companies on 6 activities, and an inspection." Each company with work running that
  day (G-60's `runsOn`) in the job's trade order: its name, which opens its window, its contact's
  first name and phone as a call link, and the log's line, "Last on the log Thu Oct 1 with 3."
  Under it each bar: the activity, where the day sits in it (*day 12 of 19*, *last day*, *6 days
  past its finish*), its percent, and the chart's pill on today's list, then its hold ("waits on
  …", G-77's papers too) and an open G-117 notice ("says it will finish Wed Oct 28").
- **The count is the log's.** No trade reports a crew count, so it is the log's last count before
  the day, said as the log's. The day's own log answers "On the log for Thu Oct 1 with 3" in green,
  or "Not on the log for Thu Oct 1. Last on it Tue Sep 29 with 5." in red, and that company goes
  first: the call to make.
- **Also on it**: the day's inspections, with an earlier failure ("It is seen again today. It failed
  Mon Sep 28: … That was Pecan Valley Electric's work."); deliveries, the utility and permits
  expected that day ("The transformer, from CPS Energy."); and a company whose every bar that day is
  held, under *Held, not expected*, with why.
- **The day is the tab's.** The This week cards and the caught-up days pick it, and the header's
  *‹ Thu* and *Sat ›* step it, no earlier than work started and no later than today. A day's list
  sits over that day's log.

What the second look changed:

- **The chart's pill only on today's list.** It is the chart's standing now; on yesterday's list
  "due today" would mean today, so a past day shows the log's answer instead.
- **Left out on purpose**: *Here* ticks that write today's log as crews arrive (a new habit for the
  log, the owner's call) and the trade's own crew count from its portal (a new bilingual answer).
## Phase 4, the contract's late days, as built (2026-10-06)

G-98, Helper 3 (mock-up `mockups/G-98.md`). `gcLateFinish.ts` (tested, out of the barrel): one call,
`lateFinish`, on Owner Billing's `ownerFinishRisk` (the projected finish against substantial
completion with signed change orders' days). The Schedule tab, Bill the customer and the customer's
words all count from it, so a move that changes the finish moves all three together.

- **Under the Projected finish measure**, on a job past its contract: *At $500 a day, the 3 days cost
  $1,500.* Then whose they are: *All 3 are the customer's: a change order for them would save
  $1,500.* Then each change order with days: *Change order 1 moved the contract 1 day, signed Fri
  Oct 2.* and *Change order 2 would move the contract 2 days once they sign it.* With no fee typed:
  *No late fee is entered from the contract. It goes on Bill the customer.* On time with a fee: *Each
  day past Fri Dec 11 costs $500.* The measure's chip reads the same call.
- **The customer's days** are the finish days of the standing moves whose reason lies at the
  customer's door (G-96's `CAUSE_OF`), less a move that put a signed change order's days on the chart.
  They are capped at the late days. They do not lower the money at risk: until the customer signs a
  change order for them, every late day counts, so Bill the customer's chip and this line agree.
- **Bill the customer's Finish date card** gets the same whose-days line and change orders under its
  money line.
- **The customer reads whose the days are**, after their finish, only when late: *Those 3 days came
  from a decision we were waiting on from you.* Or *4 of those days came from …* and *We are working
  to make up the other 3.* The words for why are their portal's own (`CUSTOMER_WHY`). Never a company,
  never the fee. In the portal's *Your schedule*, the Friday report's *At a glance* and the schedule
  letter.
- On the fixture, Fair Oaks D finishes on the contract's day with no change orders and no fee, so
  nothing new shows. The measure still says *no days to spare*.

What the second look changed:

- **The customer's days save money, they do not lower the risk.** A time extension is an ask until
  it is signed.
- **The money line stays off Bill the customer's card**, which has its own. The card gets the split
  and the change orders.

Not done, on purpose: the ring card, the board row and Needs you (they move the golden walk; the
owner's call). Which days the contract excuses besides the customer's, such as the weather's, is the
contract's to say and the real build's to read. *Ask for the days*, a press that drafts the time
extension change order, is G-141: it needs a field on the change order and a guard in G-76's
kernel. Who sees the dollars follows *Money* in the real build.

## Phase 1, spare days as a tail, as built (2026-10-06)

G-08, Helper 2 on `spike/g08`; the mock-up and plan are `mockups/G-08.md`. `spareTail` and
`lastFinishDay` in `gcGantt.ts` (additions), the chart's toggle, tail, legend entry and hover row in
`GcGantt.tsx` (additions), and the tail on the paper in `gcGanttPrint.ts`.

- **Show spare days** beside Hide the links, *Hide spare days* while on, off when the chart opens and
  held the way Hide the links is held, while the chart is open. Its title: *A faint tail after each
  bar, out to the last day it can finish before the job finishes later. The work that sets the finish
  has none.*
- **The tail**: a faint pale-blue line at the bar's foot from the day after its finish to the last
  day it can finish (its finish plus `GanttBar.spare`, the read the chart already made), with an end
  mark. It sits under the notes and below the change order's and the trade's full-height tails, and
  takes no press. Never on the red chain (5 or fewer spare days) or a done bar. On Fair Oaks D: 14
  tails, six ending Sun Dec 6, the day before the final inspection, on the work only it waits on.
- **The hover card** has *Can finish by Sun Nov 15* under *Spare*, on every bar with spare days, the
  red chain included (Trim: *Can finish by Sun Dec 6*). The row and the tail read one function,
  `lastFinishDay`, so they always name the same day.
- **The legend** gains *a bar's spare days: how long it can slip before the job finishes later*
  while it is on.
- **On the paper**, our team's copy prints the tails while it is on, with the key entry and the
  sentence *Each bar's spare days show as a faint tail.*; the customer's copies never do, since a
  customer never sees spare days. Page counts do not move.
- **Tests**: `gcGantt.test.ts` (2: the tail's days, none on the red chain or a done bar, and the six
  Dec 6 tails being the work only the final inspection waits on), `GcGantt.render.test.tsx` (1: off
  at first, 14 tails, none on the red chain, every tail drawn to the day its hover card names),
  `gcGanttPrint.test.ts` (1, and the plain-words walk), `GcGanttPrint.render.test.tsx` (1). No
  action, no fixture change: the golden test did not move.

Left out, the owner's calls: the room each bar had at Start (it needs the float over the baseline's
dates), and spare days counted to the contract's day (it changes what spare days mean everywhere).

## Later, running bars with lapsed insurance, as built (2026-10-06)

G-138, by Helper 5, round three (the mock-up and plan: `mockups/G-138.md`). Additions to
`gcNotReady.ts` (`uninsuredBars`, `uninsuredNotes`, `uninsuredBlock`, `lapsedInsuranceWords`) and a
third optional argument on the chart's `barNote`.

- **A red note, no stripes.** A hired trade's bar under way (work reported or a real start, not
  done) whose insurance ran out, or was never on file, gets *insurance ran out Sep 15* beside it in
  red. The work goes on, so it is not held: the pill and the Held count stay. Its place in the order
  is after a failed inspection and a hold, before G-60's log note, a change order's tail and the
  slip. The hover card's *Insurance* line says "Pecan Valley Electric's insurance ran out Tue Sep 15.
  Nothing they do for us is covered.", and Print or PDF prints the note (`noteOf` passes the map).
- **G-77's own gap, read on the day.** Under way is the complement of G-77's not started, so a bar is
  never both: on Fair Oaks D, Panels and feeders and Lighting carry the red note while Site lighting
  and Fire alarm stay held. A test pins the four side by side.
- **What the office does, and what already guards it.** The opened bar's block reads "Pecan Valley
  Electric is working on this without current insurance." with *Ask for it* on the certificate, and
  its last line is the guard that stands: "On Draws, Approve stays locked until a current certificate
  is in." (`partnerBlockers`).
- **At the gate**: G-118's morning list says it in red on the company's line, "Their insurance ran out
  Tue Sep 15. Nothing they do for us is covered.", read on the list's day.

Left for Helper 1's counts row: an uninsured running trade as a reason on Follow up and Needs you,
from `uninsuredBars`, so it lands in the one re-pin.

## Later, the cash weeks follow the bars, as built (2026-10-06)

G-140, built by Helper 4 from `to-dos/gc-mode/mockups/G-140.md`, on the owner's yes. The kernel is
`gcCashForecast.ts`, and *The next 6 weeks* (`cashAhead`) reads it for what it expects.

- **One rule each side.** Our bills are G-97's forecast, each month's bill on the bill day plus
  that customer's usual days to pay. Each trade's draws are taken at each bill day, from the
  percents its bars reach (`sovLinePctAt`, shared with G-97), through its own pay application:
  `payApplication` with `drawMoney`, the math `tradeSendPayApp` uses. Each is paid 10 days after.
  A job with no schedule keeps the old rule.
- **At reported percents it is the old rule, number for number.** Owner Billing's five tests that
  pin the old numbers pass `{ bars: 'reported' }` and keep every assertion. A test sends Cool
  Breeze's own pay application at the same percents and gets the $9,720 the weeks expect.
- **Fair Oaks D, as the schedule stands:** the trades' draws on Wed Nov 4 come to $284,328
  (Summit Roofing $118,800, Cool Breeze Mechanical $84,240, Pecan Valley Electric $61,200, Hill
  Country Interiors $14,688, Iron Horse Fabrication $5,400). The week of Nov 2 goes to $323,600
  carrying, against $117,680 as reported. All $526,492 of the bills it expects come after the six
  weeks; Cibolo pays in 38 days.
- **The card says it.** *The next 6 weeks follows the schedule now. Before, it counted only the work
  reported so far.* Beside it: *$205,920 more goes to the trades in these weeks* and *the bills it
  expects bring $380,624 more, all of it after these weeks*. Under the headline: *Summit Roofing
  $118,800 and Cool Breeze Mechanical $84,240 are most of it.* Every expected row names its bill
  day. *As reported so far* is the way back, one press, remembered per browser.

Left out, as planned: pay-when-paid, a statement-of-work term the data does not carry. Retainage
growth on both sides stays *no day yet* at today's amounts. Our own crew's cost is payroll's.

## Later, one readiness list for both sides, as built (2026-10-06)

G-139, by Helper 5, round three (the mock-up and plan: `mockups/G-139.md`). `startNeeds` in
`gcStartReminders.ts` reads G-77's `startGaps`; six new portal keys; `PORTAL_SPANISH.md` regenerated.

- **One list.** The trade's 14- and 3-day reminder keeps its submittals first, then reads the very
  list the office's bar reads, on the same first day, in Get started's order, each gap in the trade's
  words (`GAP_WORDS`, a `Record` over every gap kind: a kind the office adds without a trade sentence
  fails the typecheck). Kendall Air on Helotes, started anyway, read Oct 6, used to hear only "Your
  statement of work is not signed yet." while its bar waited on the master agreement too, and the
  statement was only drafted. Now: "Your master agreement is not signed yet. Sign it in your
  portal." and "Your statement of work is not sent yet. We will send it to sign."
- **The new sentences**, English and Spanish: a master agreement sent or not sent, an insurance
  certificate that already ran out ("ran out Tue Sep 15", where it used to say "runs out … before your
  work starts" of a date already past), no W-9, a statement of work not sent, and one signed on plans
  that changed since. The genders are `PORTAL_SPANISH.md`'s: *contrato maestro* masculine, *orden de
  trabajo* feminine.
- **The import cycle broken first**, its own commit: `NOT_READY_LATE_DAYS` is its own 3, held equal to
  the last of `START_REMINDER_DAYS` by a test.
- G-77's test that the bar never misses a paper the reminder names became equality: on the
  reminder's days, the papers it names are the office's gaps, in order (eight mixes, both days).

What the second look changed: a button per line in the reminder was not needed, since every message
ends with the link to the company's portal home, whose to-dos already open each paper.
## Later, a schedule while bidding, as built (2026-10-06)

G-45, Helper 2 on `spike/g45`; the mock-up and plan are `mockups/G-45.md`. `gcRoughSchedule.ts`
(tested, out of the barrel), `GcRoughSchedule.tsx`, one optional argument on `scheduleDraft`, the
`setRough` action, and lines on the Schedule tab and Our number.

- **Where**: a job still bidding opens its Schedule tab on **A rough schedule for our bid**: *If work
  starts*, **Draw a rough schedule**, then one row per stage the job has, each with its days to change,
  its dates and its bar on one axis, the inspections, and the dates to meet; **Redraw** after a change.
  Its words: *Draw it from the stages of the job to know how many weeks it takes to build. Our number
  shows the weeks beside the price. Nothing here goes to the trades or to Cibolo Creek Partners. When
  we win, the first draft starts from it.*
- **What draws it**: the first draft's own kernel, `scheduleDraft`, on the trades' scope lines, with an
  optional third argument for the job's stage days; with none it draws exactly what it drew before (a
  snapshot of every fixture job's draw, written before the change, holds it). Boerne Retail Shell from
  Mon Nov 2: 10 stages, substantial completion Sun Feb 7, 14 weeks; Structure at 25 days makes it 16.
- **What it feeds**: one count, `roughWeeks`. Our number shows *Weeks to build 14* beside the price,
  the sentence, and *For the proposal: We will build Boerne Retail Shell in 14 weeks from the day work
  starts.* with Copy. *We sent our bid*'s log line adds *It takes 14 weeks to build, by the rough
  schedule.* and is word for word what it was without a rough.
- **The lock** (the lead's pin): when the bid goes in, the weeks and the finish are kept as they went,
  `setRough` is refused, the boxes and Redraw go, and the tab and Our number read *Our bid went in Fri
  Oct 2 with 14 weeks to build. The rough stays as it went.* A later draw cannot move them.
- **At award**: the rough is kept (its weeks too, if the bid was never marked sent) and never copied
  into the schedule, since the trades' statements of work bring the lines the bars must be on. The
  first-draft card says *We bid 14 weeks, from the rough schedule. The first draft starts from its
  start day and its stage lengths.*, starts on the rough's day, and draws with its stage lengths; the
  *Drawing the schedule* card then says *The first draft runs the 14 weeks we bid.* or *The first draft
  runs 15 weeks. We bid 14.*
- **Nothing reaches the trades or the customer**: the rough lives in `project.rough`, never in
  `project.schedule`, which their views read; it has no Print or PDF and nothing on it moves.
- **Tests**: `gcRoughSchedule.test.ts` (8: the draw pin, the weeks and stages, the job's days, the
  customer's picture empty, the lock and no drift, the refusals, award and the first draft, plain
  words), `GcRoughSchedule.render.test.tsx` (5). The golden test lists `setRough`; no fixture change,
  no snapshot moved.

Left out, the owner's calls: general conditions worked out from the weeks (it ties the price to the
schedule), and jobs like it (the prototype's past jobs carry no durations).

## What if, getting days back, as built (2026-10-06)

G-82, Helper 3 (mock-up `mockups/G-82.md`). `gcRecovery.ts` (tested, out of the barrel),
`GcRecovery.tsx`, the action `recoverScheduleDays`, and three small changes to the model, each the
lead's call.

- **Days back**, a card under the measures, only on a job past its contract (G-98's `late`): each way
  to bring the finish in, the most days back first, with *Look at it*. The best one's worth joins
  G-98's lines in the Projected finish measure: *Getting 1 day back brings the finish to Mon Dec 14,
  still 3 days past the contract.* With nothing to offer it says why: the work's pace sets the
  finish, or the work on the red chain is held, started, or one trade's own.
- **Side by side**: *Controls starts 3 days before Sheet metal and flashing finishes.* The kernel
  reads one wait, B on A. Both are on the red chain, A not done, B not started. They are two trades,
  neither an inspection nor the job's own bar. The wait has no gap now, since cure or lead time is
  kept. Nothing holds B, and its trade has not said it starts later. The overlap is `OVERLAP_DAYS` = 3
  or fewer, never before tomorrow, B's Not before day or what else it waits on.
- **A second crew**: *A second crew on Test and balance. It would finish Sat Dec 12, not Sun Dec 13.
  Our rule: a second crew does the days left in two thirds the time.* A bar has dates and a percent,
  no crew, so the rule is named (`SECOND_CREW_SHARE`) and said on every crew offer. It applies to a
  trade's line or our own crew's stage with 3 days left or more, nothing holding it.
- **Each offer is the schedule as it would stand**: the work right behind comes in by G-37's rules
  (`pullBehind`, lifted out of `planPull` as its own commit). It is read on the projected finish, so
  an offer that only moves the plan while the work's pace sets the finish is not offered.
- **Who has to agree** is on every offer: *Cool Breeze Mechanical and Summit Roofing have to agree:
  Andre Wallace and Carla Nguyen.* Each person has *Call* and *Follow up*, which open G-115's sheet
  on one item, the days back, in the company's language. Our own crew is *our call*.
- **The press**: *Look at it* opens a window like G-37's. It shows the dates, what comes in, what
  keeps its dates and why, the finish, the worth, the billing (G-97), and *Ask them before you save
  it.* Then *Getting days back*, a new reason, and the sentence filled in. *Save the move* sends
  `recoverScheduleDays` with the offer's key, and the reducer re-plans it from the state, so a
  stale press does nothing. The move keeps `recovery` (the gap it changed). Undo and Redo put the gap
  back and forward with the dates. Tell the trades tells each company whose dates moved.
- **The history** reads *HVAC · Controls now starts 3 days before Sheet metal and flashing finishes,
  Dec 4 to Dec 10.* Days lost has its own line, *3 days back from work we sped up*. The customer
  reads *… because of a faster plan for the work.*
- **The gap below zero** (the lead's condition): `lagOf`, the reducer, `planMove` and the editor's box
  take it. The editor says it in the offer's words, *starts 3 days before Sheet metal and flashing
  finishes*, and the chart's label reads *−3*. A test holds every gap in the made-up data at zero or
  more, and the golden test did not move.

What the second look changed:

- **The cascade reads the dates as drawn.** Seeding it with the compressed bar's new dates already
  in place hid the days it gave back, so nothing behind it came in.
- **Our own crew is our call.** A second crew of ours needs nobody's yes, so it gets no Call.
- **A second crew is offered once.** Saved on the live job, the list offered a second crew on the
  same bar again, a third crew by the same rule. A bar with a standing second-crew move gets no more.

Not done, on purpose: what a second crew costs (the conversation with the trade is where the money
is); two offers at once (each stands alone, save one and the list reads again); offering it before
the contract is missed (one condition to widen, the owner's call); telling the trade being
overlapped (Tell the trades reads whose dates moved, a row of its own); the best offer's worth on the
paper (G-21's head prints G-98's lines, which are facts; an offer is a choice, so its line sits just
outside that block and the paper's test still holds).

## Later, a trade's own crew count, as built (2026-10-06)

G-142, built by Helper 4 from `to-dos/gc-mode/mockups/G-142.md`, the *C* set aside on G-118's
list. The kernel is `gcCrewCounts.ts`, tested, out of the barrel. The portal line is
`GcPortalCrewCount.tsx`.

- **The trade's side.** Under each coming week of *Your next three weeks* with its work, a line per
  trade: *People a day on site* with *Tell Click*. That covers this week and the next two. Last
  week's block takes none, because the log has that week. After sending it reads *You said 4 a
  day.* or *You said nobody.*, with *Change it*. The count is a whole number from 0 to 50, one per
  trade the way the daily log counts people. A company with two trades on a job names each. In
  Spanish too.
- **One record and one action.** `GcProject.crewCounts`, newest first: the newest for a trade and
  week counts, and the ones before say when it was cut. The action is `tradeSetCrewCount`.
  `crewCountsNow(project)` is the stable read for G-84's people-per-week strip.
- **The morning list (G-118)** reads the trade's word beside the log's:
  - before the log, *They said 4 a day this week. Last on the log Thu Oct 1 with 4.*
  - a short crew, *On today's log with 2 of the 4 they said.*, in amber;
  - missing, *Not on today's log. They said 4 a day this week.*, in red and first, as before;
  - a cut, *They said 3 a day this week, down from 4 on Fri Oct 2.*
  With no count, every line is G-118's own, so nothing it pins moved.

Left out, by the lead's word: a portal-home to-do asking for next week's count, which would fire
on the made-up data today and move the pinned portal to-dos; and the office typing a count from a

## Later, the what-if copy, as built (2026-10-06)

G-81, built by Helper 1 from `mockups/G-81.md` with the lead's go. `gcWhatIf.ts` (tested, out of the
barrel), `GcWhatIf.tsx`, and four actions: `startWhatIf`, `inWhatIf`, `keepWhatIf` and
`throwAwayWhatIf`.

- **The copy sits beside the schedule, never inside it** (`GcProject.whatIf`). It starts as the real
  schedule with a history of its own and no walks. Nothing outside the Schedule tab reads it: not
  the portals, Follow up, Needs you, the call list, the board row, the Friday report, the customer's
  views or the billing forecast's months. A test holds that with a copy open and two moves tried,
  every one of them reads as with no copy.
- **The way in** is **What if…** on the chart's toolbar. With a copy open it reads **What if · 2**,
  and inside the copy **See the real schedule**. The copy stays open while the real one is shown.
- **In the copy**, every move, pull (G-37), day got back (G-82) and wait the real schedule allows is
  tried through the same windows, with Undo and Redo on the copy's own history. Why it moved is optional: *Try it*
  saves with a reason when one is given whole, else with none yet (`ScheduleMove.noWhy`). One
  wrapper action, `inWhatIf`, runs the move through the reducer on the copy and keeps only the
  schedule that comes out. Any other action is refused. The walk, actual dates, inspections, waits,
  milestones, baselines, sends, late notices and Tell the trades stay on the real schedule, and
  their cards are hidden in the copy.
- **The violet line** over the chart says what the copy does against the real one. On Fair Oaks D,
  after Summit's TPO membrane a week later for the rain and our crew's Top out three days longer
  with no reason: "2 moves tried. 5 bars differ from the real schedule. The job still finishes Tue
  Dec 8, as in the real one. The bills: $22,661 of the Oct 25 bill moves to Nov 25. 1 move has no
  reason yet." Each bar that differs has its real dates as a dashed outline over it, and *Real* on
  its hover card.
- **Keep** puts the copy's standing moves on the real schedule, oldest first, as real moves. Each
  keeps its reason and words; one tried with none asks for them in the Keep window. Each is by the
  person who kept it, today, marked *Tried in a what-if first* (`fromWhatIf`). The real activities
  take the copy's planned dates and waits, and their actual dates and reports stay. Tell the trades,
  the customer's What changed, Days lost and the billing forecast read them as moves. Undo takes
  them off one at a time, and a test holds that two undos return the real schedule to before Keep.
  A violet line then names the companies not told, with **Tell the trades**.
- **Keep is refused once the real schedule moved since the copy was made**. That means a planned
  date or a wait changed, not a report or an actual date. The window names the bar and says to make
  a new copy, the way Undo stops when a later move stands.
- **Throw it away** asks once inline, then drops the copy. The real schedule stays as it was.
- Tests: `gcWhatIf.test.ts` (15) and `GcWhatIf.render.test.tsx` (6). The golden test did not move:
  no fixture data and no new step; the four actions are in its list.

What the second look changed:

- **The real dates are an outline over the bar, not a shape behind it.** Drawn behind, a bar the
  copy only made longer hid its real dates entirely.
- **The copy's line carries its money** (G-97's forecast on the copy's dates against the real ones),
  because a slip that holds the finish can still move a bill.
- **The editor and the move window say *Try it*** in the copy, and the editor hides the real days,
  so nothing there reads as if it were saved for real.

Not done, on purpose: more than one copy at a time, keeping only some of the moves, a copy shown to
the customer or a trade, a copy across a reload, and a list inside the copy of who it would need to
call.

## Later, people on site per week, as built (2026-10-06)

G-84, by Helper 5, round three (the mock-up and plan: `mockups/G-84.md`). `gcPeopleOnSite.ts`
(tested, out of the barrel), `GcPeopleStrip.tsx`, and an optional `peopleOf` on the chart, given only
by the office's Schedule tab.

- **A strip under the rows**, in Chart view, behind *Show people on site* beside *Show spare days*.
  Each week, Monday to Sunday as the axis runs, the plan's busiest day as an outlined bar beside the
  daily log's busiest day as a filled one, their numbers above where the week is wide enough (not at
  Months zoom), and a card on hover: "15 at the busiest, Mon Sep 21.", who made it up, a company a
  line with its count, "19 at the busiest, Tue Sep 22, 5 days logged.", and where the counts came from.
- **The counts**, per trade and week: its own count for the week (Helper 4's G-142: the Schedule tab
  passes `crewCountsNow(project)` as `told`), else the daily log's last count for it, else
  `ASSUMED_CREW`, 3, named on the strip and the card. Summit saying 6 for the week of Oct 5 turns
  that week's 12 into 14, and the week after keeps the log's 4. One trade counts
  once a day, as the log does; our own crew counts; inspections and added activities never do.
- **The plan on its own dates**, not G-60's `runsOn`: a late bar not done would otherwise fill every
  week ahead. The log is what shows a late bar's crew, so the gap is the news.
- **A short week** (the log's busiest day 3 or more below the plan's, `SHORT_BY`) reads amber, with a
  *Short* line on the card.
- **The whole job**: the strip's totals do not change with a filter or a fold; a test holds it. The
  customer never sees it: the chart is drawn only on the office's tab, and only our team's printed
  copy carries it (G-144, below).
  While G-81's what-if copy is shown, the plan reads the copy's dates and the log stays the job's: Summit's
  last roof bar tried two weeks later moves its 4 from the weeks of Oct 12 and 19 to Oct 26 and Nov 2;
  a test holds that too, and that the strip stays on as the copy opens.
- On Fair Oaks D: the week of Sep 21 plans 15 against 19 on the log, Sep 28 plans 15 against 18,
  then 12, 9, 9 and 2 ahead.

**On paper, G-144** (built the same day, its own row). With the strip on, our team's copy of *Print or
PDF* prints it as the last row of the last page, a row kind of its own in G-21's `gcGanttPrint.ts`:
each week's plan outlined beside the log filled, a faint line at each Monday, a short week amber, and
the numbers over the bars when the widest fits in half a week. It is keyed at the foot of the page it
prints on, a short week with a key line of its own, and the window says it prints. The customer's
copies never carry it. On Fair Oaks D a week is 15.6 points on paper, so the numbers print: 15 against
19, 15 against 18, then 12, 9, 9 and 2. Asking a trade for its count is G-142's portal line.

## Later, the schedule as a file, as built (2026-10-06)

G-136, Helper 2 on `spike/g136`; the mock-up and plan are `mockups/G-136.md`. `gcScheduleExport.ts`
(tested, out of the barrel), `GcScheduleExport.tsx`, `gcDownloadFile.ts` (the browser's save, its own
file so a test stands in for it), the Export button in `GcGantt.tsx`, and `forWords` exported from
`gcGanttPrint.ts`. No action, no reducer case, no fixture change: the golden test did not move.

- **Where**: **Export** sits beside **Print or PDF** on the chart's toolbar and opens its own window,
  *Export the schedule*: *The whole schedule, by trade: 30 activities, 3 things the work waits on and
  4 dates to meet. The filters and folds do not change a file.*, the same **Who it is for** switch and
  line as *Print the chart* (the print's own `forWords`), then **Spreadsheet** and **Project file**, a
  line each. A press saves the file through the browser and the window stays open for the other;
  *Saved Fair-Oaks-Shops-Building-D-schedule-2026-10-02.csv.* says which.
- **Always the whole schedule**: the window is fed what Print or PDF is fed, and the kernel never
  reads the filters, the folds or the links (a test exports with them on and gets the same file). The
  grouping is the chart's: by trade, by stage or by company.
- **Our team's copy**: every bar under its group in the chart's order; then *What the work waits on*,
  each a day of its own named by its done word (*Rooftop units on site*, *The restroom tile decided*)
  on the day it is expected or came, which the work it holds waits on; then *Dates the job must
  meet*. Each with its trade, company, days, percent, spare days (a number, so a sort puts the work
  that sets the finish on top), the chart's words for where it stands, what it waits on with its gap,
  Not before, Must finish by, and the days it really ran.
- **The customer's copies** read `customerSchedulePicture` and nothing else. An owner gets *Stages of
  the job* (their portal's stages, dates, percent and words) and *Dates to meet*. A GC or an owner's
  rep gets every bar of their list by stage, in their words (*on plan*, *not started*), in the order
  built: the list puts today first, a file reads top to bottom. No company, no trade, no spare days,
  no waits, nothing from outside the trades.
- **Never the rough or the what-if copy** (G-45, G-81): a file reads the chart's bars, which read
  `project.schedule`. A test exports a job with a rough, and one with a copy open and two moves tried
  in it, and gets the same files as without. Inside the copy the toolbar has no Export, since the tab
  gives the chart no print job there; a render test on the real tab holds that, and that Export on the
  real schedule saves the real one while a copy is open.
- **The spreadsheet**: `.csv`, UTF-8 with the byte-order mark Excel looks for, dates as 2026-10-09,
  RFC 4180 quoting, CRLF, one line for each row under a group, the group in its own column. A cell a
  spreadsheet would run as a formula starts with a quote mark (OWASP's rule for CSV files). Columns:
  our team's 16; an owner's *Group, Name, Start, Finish, Done %, Where it stands*; a GC's *Stage,
  Activity, Start, Finish, Where it stands*.
- **The project file**: the common part of Microsoft Project's XML (MSPDI), elements in the schema's
  order. One calendar, *Every day*, seven working days 8:00 to 12:00 and 13:00 to 17:00, so 12 days is
  `PT96H0M0S` in both programs. Groups are summary tasks (Primavera's WBS) with everything under one;
  tasks are numbered 1, 2, 3; waits are finish-to-start links between tasks in the file, the gap in
  tenths of a minute (4800 a day). A date to meet and a wait are milestones at the end of their day,
  so the work after starts the next morning, as the chart holds it. The status date is today. The
  company is in Text1, named *Company*, on our team's copy only. Left out: baselines, deadlines,
  resources and notes.
- **Each task held to its day** (a change from the plan): both programs place a task as early as its
  links allow, so a bar with spare days before it would jump left on open, and the customer's copies,
  which have no links, would all start on the first day. So every task starts no earlier than its day
  in our plan (`ConstraintType` 4 at its start, or at its Not before when later). In the made-up data
  no bar starts before the work it waits on ends, so the only work a program would move is Rooftop
  units, to the morning after the units come: the hold the chart shows. A task holds one constraint,
  so *Must finish by* rides in the spreadsheet only.
- **The lead's pins**: one test reads both writers' output against the kernel's rows, for our team's
  copy (by trade and by company), an owner's and a GC's: the same rows, in the same order, under the
  same groups, with the same dates. And a search of the whole of the customer's project file finds no
  Text1, no extended attribute, no word *company* and none of the companies on the job, ours included
  (the customer's own name is only in the file's name).
  Both were checked by breaking the code on purpose: each fails.
- **Opening them for real is the owner's to check**: the prototype could open neither Microsoft
  Project nor Primavera P6, so the file is held to the schema's names and order by tests. The owner
  checks the first real import with a scheduler's copy of each program. The window says so under
  Project file: *Nobody has opened this file in Project or Primavera yet. The owner checks the first
  import with a scheduler's copy of each program.*
- **Tests**: `gcScheduleExport.test.ts` (23: the rows, the filters and folds, the waits and gaps, the
  outside waits, the dates, the what-if copy, the rough, both customer copies, the spreadsheet, the
  project file, the lead's pins, the words), `GcScheduleExport.render.test.tsx` (8, two on the real
  Schedule tab).

What changed from the mock-up: each task is held to its day (above); the owner's spreadsheet has a
*Group* and a *Name* column, since *Dry-in* is both a stage and a date to meet; the count names the
grouping (*by trade*) instead of *in 8 trades*, since Inspections is a group and not a trade; a
wait is one day in both files, since the pin rules out the mock-up's span from the day it was ordered
(*Where it stands* keeps that day: *ordered Sep 1, late*).

Left out, as planned: Excel's own `.xlsx`, Primavera's own XER file, and what changed since the last
file went (it needs a record of each file sent, G-94's ground).

## Keeping it true, weather and crews, as built (2026-10-06)

G-57, Helper 3 (mock-up `mockups/G-57.md`). `gcFinishOutlook.ts`, tested, out of the barrel. No
action, no record, no fixture change; the golden test reads none of it.

- **A second line, ours only.** A ruled block at the foot of the Projected finish measure, after
  G-98's and G-82's lines (`data-tour="gc-finish-outlook"`): *With weather and crews: Fri Dec 11, the
  same day.* Then one sentence on the weather and one on the crews. The pace line above it is
  untouched. The paper, the portal and the letter do not have it until the owner says which line
  the customer hears.
- **Weather** (`WEATHER_DAYS_A_MONTH` = 2): days a month on the work left of each trade the log has
  seen the weather stop (G-58's reading, never guessed from the trade). Once the log covers a
  month (`LOG_MONTH_DAYS` = 28) the rate is the log's own: the days the weather stopped work over
  the days the log spans, times 30. The sentence names which: *Our rule, 2 a month on roofing and
  electrical, fits inside their spare days.* or *The log's 3 a month …*. No weather on the log
  adds none and says so.
- **Crews**: so far is the log's people a day on the days the trade was on site. Now is its own
  count for the week the work falls in (G-142's `crewCountsNow`, the default argument), else its
  crew this week: its count for this week, else, with work under way, its newest day on the log in
  the last 7. A trade with all its work ahead is not here yet, not short. A smaller crew stretches
  the work left by so far over now. A bigger one is not counted on. A trade with work under way and
  nobody this week is named, *Summit Roofing has nobody on site this week.*, and not divided.
- **Through the projection's own walk.** `projectedFinish` takes an optional map of days more per
  bar, added to the work left. Bars that wait on a stretched bar move with it, the later of plan
  and pace still wins, and the line can only come later than the pace line. The measure's own call
  passes nothing, so it reads as before.
- **The sentences add up.** *Crews add 19 days* is the crews alone. *Weather adds 1 day* is what
  weather adds on top, since it falls on the longer work. Their sum is the line's *20 days later*.
- **Pick 2, the short crew is a call.** A trade whose crew alone moves the finish joins G-115's call
  list in amber, with the same days the crews sentence says: *They have 1 on site this week against
  3 so far. At that, the job finishes 19 days later, Wed Dec 30.* On the Follow up sheet it is
  *Crew on site*, and the message asks *Can you bring it back up to size?*, in English and Spanish.

What changed from the plan:

- **Days more, not stretched copies.** A copy with a bar restarted today reads earlier than today's
  line when the bar waits on unfinished work, since the projection reruns its whole length after
  it. The days now go into the same walk, so every bar's end can only move later.
- **Weather's days are on top of the crews'.** Read alone, a short crew's 19 days and weather's
  none left a line of 20 with a day from nowhere.
- **This week's word carries to the weeks after it.** A trade that said nobody this week was also
  counted short on next week's work, from the log's last day.
- **The log speaks only for a trade on the job now.** Moved a month out, Summit's work was all ahead,
  yet last week's 4 against 5 made it short on work weeks away and put it on the call list. Four of
  G-113's, G-115's and G-117's tests caught it, and they pass unchanged. A trade with nothing under
  way is read from its own counts only.
- Words: *no trade has fewer on site than so far* (a bigger crew is not its usual size), *the log
  has no weather yet*, *the log has no crews yet*, and *Two more trades are short too.* as its own
  sentence, to stay under 20 words.

Not done, on purpose: tails on the chart for the stretch (a second row, only where a tail reaches
the finish); the contract on the second line (G-98 says it for the pace line, and a second count
would argue with it until the owner picks the line the customer hears); past jobs' weather and the
season (the fixture has one job with logs); a crew per bar (a bar has none, so so far stands in).
## Later, one line as several bars, as built (2026-10-06)

G-39, built by Helper 1 from `mockups/G-39.md` with the lead's go. `gcSplitBars.ts` (tested, out of the
barrel), `GcSplitBars.tsx`, and five actions: `splitActivity`, `joinActivity`, `moveActivityPart`,
`tradeReportPart` and `selfReportPart`.

- **A split line stays the line.** Its parts (`ScheduleActivity.parts`) each have a name, their own
  dates, a share of the work and a percent. The line's dates are its parts' span. Its percent is
  their percents weighted by their share, stored on the line as today: `pctReported` for a trade,
  `pctByLine` for our crew. So the pay application, the list, the paper, the export, the forecast,
  the portals and the customer read it as before. A test holds that Pecan Valley's next pay
  application, the customer's bill and the forecast are the same before and after a split with no
  new report. Another holds that after each part reports, the line equals the weighted sum.
- **A part's days are counted from its line's start** (`from`, `days`), and the part that ends last
  ends with the line. So a drag of the whole line, a push from the work before, a pull (G-37), days
  got back (G-82), Undo, Redo and a what-if (G-81) carry the parts unchanged. A test holds each of
  them, and Undo after each.
- **The shares are set from the days at the split, and kept.** They are not counted again from the
  days at each move. Counted again, a part that slipped longer would weigh more, and the line's
  percent would change with no report. Back of house a week longer would grow from 35% of Lighting
  to 45%, and Lighting would fall from 53% to 51% with nobody reporting anything. The bill reads the
  line, so the slip would move Pecan Valley's pay application, the customer's bill and the forecast.
  A slip changes when the work is done, not how much work there is. When the work itself grows, that
  is a change order, or a new split.
- **Splitting a reported line keeps its percent**: each part starts at the line's percent. The split
  window starts with two halves, shows the shares as the dates are typed, and says why it cannot
  split yet. That is fewer than two parts, a name missing or doubled, a part with no days, or a first
  part not starting and a last not ending with the line. Inspections and added activities are not
  split. **Make it one bar** asks once inline, then takes the parts away. The line keeps its percent
  and its dates.
- **A part moves through Why it moved** like any move. It is dragged on its row, or given dates by
  **Change a part's dates…** on the card. The window names the part: *Move Electrical · Lighting,
  Back of house*. It shows the part's dates before and after, then what the line's span does:
  "Lighting now ends Fri Oct 30." What that pushes follows, as for any move. A part moved inside its
  line's span is a move all the same, with its reason. Its row in the history reads "Electrical ·
  Lighting, Back of house moved from Oct 10 to Oct 23, to Oct 17 to Oct 30." Tell the trades names
  the part too.
- **Reports.** The trade's portal shows a split line's percent as text, with the line's picker for
  each part under it. A pick that would take the line under what is billed is not offered, and the
  reducer refuses it too. Our crew's card on the Draws tab does the same for a split stage.
  `tradeReport` and `selfReportStage` on a split line are refused: it is reported a part at a time.
  A part's first report over 0% is its real start, and 100% is its finish. The line's real start is
  its first part's, and its real finish waits for every part.
- **The chart** keeps the line's row as it is, with a caret before its name that folds a row per
  part under it. A split line opens unfolded. A part's row has its bar at its dates, filled to its
  percent, with a pill by its own dates and a hover card with its share. No links start or end at a
  part: the line's waits hold the whole. The list, the paper (G-21) and the export (G-136) draw the
  line as today.
- **The walk** lists a split bar's parts under its facts, a line each, such as "Sales floor: 60%,
  plan 73%. Started Fri Oct 2." Its question stays the line's finish.
- Tests: `gcSplitBars.test.ts` (19) and `GcSplitBars.render.test.tsx` (12). The golden test did not
  move: no fixture data and no new step. The five actions are in its list, and the what-if's list of
  actions takes the part's move.

What the build changed from the mockup:

- **A part's move is its own action, `moveActivityPart`**, not `setScheduleActivity` with an optional
  part. It works out the line's new span. When the span changes, it runs `setScheduleActivity` for
  it, so the pushes, the record and the plan at Start are every move's. Then it keeps the parts' days
  before and after on the move (`ScheduleMove.parts`), for Undo and Redo. So nothing that sends or
  reads `setScheduleActivity` changed: late notices, change-order days, the walk, the copy.
- **A part not yet at its dates reads its percent and its start.** A split gives it the line's 40%,
  and "40%, plan 0%" read wrong. It reads "Back of house: 40%, starts Sat Oct 10." until it reports.

Not done, on purpose: links to or from a part, a part's own wait, shares typed by hand, and a split
made in the what-if copy. A reason of its own for a part's move would go on Helper 3's list of
reasons.

## What if, too many trades in one place, as built (2026-10-06)

G-83, by Helper 4, round three (the mock-up and plan: `mockups/G-83.md`). `gcPlaces.ts` (tested,
out of the barrel), `GcPlaces.tsx`, one optional field and one action. G-84's per-trade number was
lifted out of `peopleOnSite` into an exported `crewNumbers` first, as its own commit, with no
change in behavior.

- **A place** is a plain word the office keeps on a bar: `ScheduleActivity.place`, at most 40
  characters, a trade's bar or our own crew's only. A guess comes from the name (*Rooftop units* is
  Roof, *Framing, level 2* is Level 2), then the trade (Roofing is Roof), then the stage (rough-in
  to closeout is Inside). Foundations, the slab and the frame get none. A guess counts for nothing
  until it is kept, so with no place kept nothing is flagged and no pinned list moved.
- **Keeping them**: *Where the work is*, a card after *What the work waits on*, with *Look at the
  places*. Its window lists each bar not done with its place or its guess in a box, and *Keep these
  places* sends one `setActivityPlaces` with every box that changed. The opened bar has a *Place*
  line with *Set the place*. The action sets an open what-if copy's bar too, since a place is a fact
  about the work. The card and the line are hidden in the copy.
- **The rule**, `TRADES_IN_ONE_PLACE` = 3, said on the surface: *Our rule: 3 trades or more in one
  place on the same day is too many.* It is counted by the day on the plan's own dates, as G-84
  counts people, from today on, and flagged by the week. Our own crew counts; inspections, the job's
  own bars and done bars do not. The people beside it are G-84's numbers, the trade's own count
  first. When the days named do not all have the most, it says *up to 4 trades*.
- **Where it shows**:
  - A lane under *Dates the job must meet*, a row for each crowded place: an amber band over each
    week's crowded days, the most at once after each run, and a hover card in G-84's look (Where,
    When, Who one company a line, People, Rule). The legend gains it while it shows. A bar's hover
    card gains *Place*.
  - The move window, under the billing line: *Too many in one place: Inside would have 3 trades at
    once, Mon Nov 30 to Fri Dec 4.* when Fire alarm slips to Nov 30, and *this clears Inside* in green
    when a move ends a crowd.
  - The morning list, in amber under its summary, from its own companies not held: *Inside has 3
    trades at once today. They are Pecan Valley Electric, our own crew and Cool Breeze Mechanical.*
    Each bar line shows its place.
  - The call list: a `crowded` line for each hired company in a crowded week of the look-ahead that
    has not given its count (G-142), amber this week and next. Its Follow up words ask for the
    count in English and Spanish. It goes once the count is given.
  - Nothing on the customer's side, the trade's portal or the paper.
- On Fair Oaks D with the guesses kept: Inside has 3 trades at once from Fri Oct 2 to Fri Oct 9,
  Pecan Valley Electric 2, our own crew 3 and Cool Breeze Mechanical 3, about 8 people a day. The
  roof's 2, Oct 12 to Oct 21, is under the rule.

Left for later: a limit for each place, a *By place* grouping of the chart, the trade's portal
saying who else is in the place, the paper, and the job's own bars taking a place.

## Status

Planned 2026-10-05. Phases 1 and 2 (finished 2026-10-06: an added activity, actuals, a new baseline, redo)
and most of Phase 3 built by 2026-10-06; Phase 4's change-order days, what the work waits on and the days lost the same day. Next: the owner's calls (`PUNCHLIST.md`), then the real build (what holds the work: long-lead items, the
customer's decisions, change-order days on the chart, weather days from the log), or the rest of
Phase 3 on the owner's word.