---
name: "Plans by date"
number: 367
group: close
status: all five PRs built 2026-11-16 on the owner's "build it all" · the view (v2.7494), the item card (v2.7499) and the columns are on main, the migration is pushed and read back · the schedule (v2.7500) and sheets in hand (v2.7501) are the last two PRs · the live page has not been walked
summary: >
  The owner had a one-page chart drawn by hand for one site: its drawings set against time, with the bid's
  schedule, the crews' days and a letter on the same axis, a dated list under it and four figures on top.
  The Development page's Plans look now offers it as a second view, By date. What is left is a card on
  every item with its details and its presses, a schedule on a bid with a typed start and end, and a sheet
  count on a set.
next: Walk the live page on a real site (By date, a card, a schedule set and changed, a sheet count), then delete this card.
size: M as a train of five (M · M · S · M · S); left: nothing to build
blocker: none
ver: v2.7501
opinion: build — the first PR changes nothing until someone presses By date, and the two database changes are additive columns nothing reads until the PR after them
---

# Plans by date (#367)

The mock-up is [`mockup.html`](mockup.html), also at https://claude.ai/artifact/UjC8TNGDKkMuytkCWyJuyj.
Its names and dates are made up. The repo is public, so nothing below is a real name or a real figure.

## The ask

The owner, 2026-11-16: a chart had been drawn by hand for one site and the app should offer it. It had a
time axis, one lane for a bid's promised schedule (a bar to the day the schedule ends, with today marked),
one lane for each plan part with a dot for every set of drawings on the date printed on its sheets, a lane
of bars for the days crews were on site and a marker for a letter kept on History. Under it sat a dated
list of every issue, and on top four figures. It printed on one landscape page.

Three more asks came while the design was on the screen:

- A schedule is a **start and an end, both typed by a person**. Nothing is counted from the day the bid was
  sent. The owner also asked how a schedule would run forever.
- **Everything reacts.** Resting the pointer on any item shows more details and the presses to act on it.
- Test on several viewports along the way, asking each time whether this is the best we can do.

## The decision

- The Plans look has two views, **By part** and **By date**. Money keeps its Timeline.
- "The bid" on a site with several is the first one won, else the first sent.
- Every kept History line is a tick, and a letter gets a flag.
- The crew lane is the clock's days joined into bars. A week with nobody on site ends a bar.
- A schedule lives on the bid: a start date, an end date and a *No end date* tick. An empty start means the
  bid has no schedule. This is my reading of the owner's two messages. The owner has seen it drawn.

## The train

1. **The view** (v2.7494, built). No migration. `lib/plans/plansByDate.ts`,
   `DevelopmentPlansByDate.tsx`, the switch on the Plans card. A mark shows one line on a hover.
2. **The item card** (v2.7499, built). No migration. A card on every mark, bar, lane name, figure and list row with the
   item's details and the presses the page already has: open the set's link, Build from this set, Change
   the link, ask the estimators, open the bid, open a job, read the whole History line, + New set, Keep
   what happened. It stays while the pointer is on it and a press pins it. On a phone a press opens it as
   a sheet. A press that writes asks first in a confirm window that names the act.
3. **The columns** (built, PR #8397). One additive migration: `bids.schedule_start`, `bids.schedule_end`,
   `bids.schedule_open_ended` and `plan_sets.sheet_count`. Nothing reads them yet. Push right after the
   merge.
4. **The schedule on screen** (v2.7500, built). The Start and End row on Edit Bid under Bid Date Sent, the Schedule lane,
   the days-left figure (red and counting the days over once past the end), and **Set the schedule** or
   **Change** on the bid's card.
5. **Sheets in hand** (v2.7501, built). A sheet count typed on a set, shown on its card, and two figures: sheets at the bid
   and sheets now.

PRs 4 and 5 read columns only PR 3's migration creates, so each waits for that push.

## What the app cannot draw

- A crew trip entered as a job line with the date only in its name. Setting the job's first and last work
  day puts it on the chart as an open bar.
- A bid that was never marked sent. A quiet line under the chart names it.

## How to verify

Open a development with several parts and press **By date**. The set each part builds from wears the ring,
the crew bars match the Scoreboard's days, and the print fits one landscape page. Look at 375, 768 and
1280 px, in light and dark. An estimator's crew lane shows each job's last work day and says so.
