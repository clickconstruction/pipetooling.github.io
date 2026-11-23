---
name: "Lien information on the Dashboard: two sightings, one answer"
number: 423
group: close
status: asked by the owner 2026-11-23 with phone screenshots, first of the strip alone, then of the strip and the lien month card together · read in the code and drawn as a before and after the same day · the owner picked option 1 on 2026-11-23, *I like your new After option 1, recommended, one place, let's log that in to build* · built and live the same day: the Lien desk card beside Needs you in v2.8339 and the lien month card dropped in v2.8342, both looked at by hand on a dev server · the office's word for the leader, the one piece of the plan left out, built in v2.8372 on the owner's *Yes, fix it here* · left: the owner's look on his own phone
summary: >
  A leader's Dashboard shows Lien desk information twice: a strip at the top of the Needs you card and
  the lien month card far below, after the Billing pipeline. The owner does not like the strip's look
  and does not want two sightings. The two were read fact by fact in their kernels. Three pairs of
  numbers look alike and count different things, and the Lien desk itself gave up the month's bar for
  the Board on 2026-11-15. The recommendation is one place, at the top: a slim card of its own beside
  Needs you and not inside it, with three values in columns and one red line while a paper is past its
  day, and the lien month card dropped. Needs you then holds only things to press.
next: Todd opens the Dashboard on his phone and says what still reads wrong. Then this card is retired.
size: S as a train of three, built as two and a small third (S · S · XS); left: a look
blocker: none
ver: v2.8339 · v2.8342 · v2.8372
opinion: close — built and live; what is left is a look on a phone
---

# Lien information on the Dashboard: two sightings, one answer (#423)

The mock-up is [`mockup.html`](mockup.html). Every count, amount, date, job and supply house on it is
made up. The repo is public, so nothing below or on the mock-up is copied from the live app.

## The ask, in the owner's words

2026-11-23, with a screenshot of the strip circled in red:

> On the dashboard, visually I don't like how this section looks. How could we improve it? Help me think
> about it holistically and the benefit it gives a user and make a suggestion … where I can see a before
> and after.

The same day, with the strip and the lien month card both circled:

> On the leaders dashboard we see lien desk information in two places and I don't love that. Can you help
> me come up with a way to present the right information in the right way? And maybe that looks like
> dropping the second card, the lien month.

## In three lines

1. **What the two say.** The strip at the top says how the Lien desk stands against its next day. The lien month card far below says where today falls in the month's rhythm, what slipped, and what queues for next month.
2. **What I recommend.** One place, at the top, as a slim card of its own beside Needs you and not inside it. Needs you then holds only things to press. Drop the lien month card. Carry up the one thing only the card said, as one red line: papers past their day.
3. **What the owner picked.** Option 1, on 2026-11-23, as the mock-up draws it: the slim card beside Needs you, the lien month card dropped, and no unpaid amount on the Dashboard.

## The decision

The owner, 2026-11-23, after the mock-up was redrawn with the card beside Needs you:

> I like your new "After option 1, recommended · one place" recommendations for the dashboard. Let's log
> that in to build.

Before that, the same day, on where it sits:

> I do think putting the lien desk information in needs you is logical, it's just that needs you is only
> supposed to be a place for action.

So the build is option 1 as drawn. Options 2 and 3 below are kept as the record of what was set aside.
Drawn in option 1 and so taken as picked: the unpaid amount is off the Dashboard and stays on the Board.
Still to ask in the build: whether the Inbox tab's Needs you card loses the strip too, which follows
from the card leaving Needs you.

## The two sightings

- **The strip** is `NeedsYouLienBoardStrip.tsx`, drawn at the top of the Needs you card. Its four numbers
  are the Board's four tiles (`lienBoardDots` over `buildLienBoard`, `src/lib/jobs/lienBoard.ts`), built
  over the desk's light read in `useNeedsYouInputs.ts:178`. Its press opens the Lien desk at the Board.
- **The lien month card** is `DashboardLienMonthCard.tsx`, row 8b of
  `docs/DASHBOARD_SECTIONS_ARCHITECTURE.md`, drawn right after the Billing pipeline's fold
  (`Dashboard.tsx:1971`). Its month is `buildLienMonth` (`src/lib/jobs/lienMonthRhythm.ts`) through
  `useLienMonth`, which makes three more reads on each visit: the payments behind the sent notices, the
  promised pay dates and the filed affidavits. Its link opens the Lien desk.

Both doors lead to the same page.

**Which layout the phone drew.** The old one, in Dispatch Mode (its bar has the **PO** tab,
`DispatchModeFooter.tsx:95`), with **New phone layout** not ticked. With it ticked the list is one line and
the strip is a card of its own under it (`needsYouPlace.ts`, v2.8289). The lien month card is where it
was in both layouts. The phone is about 430 px wide: the strip's first row needs 343 px, and the Before on
the mock-up breaks at 430 px exactly as the screenshot does.

## Fact by fact

Each pairing was checked in the two kernels.

| Fact | Where | What it counts | Its look-alike | Where a leader acts |
|---|---|---|---|---|
| **N by Dec 15** | Strip | Every notice and lien still to send or file whose day is the nearest day or earlier. A paper past its day that can still go is in it, and so is a notice the leader holds (`open` leaves out only sent, filed, served and missed) | **Not the same number** as the card's next month. The card counts next month's deadlines only, skips a held notice and a lien the leader holds, and adds reminders, which are never on the Board | On the desk |
| **N waiting on the leader** | Strip | Papers to approve, plus approved notices to sign (`lienBoardLeaderWaits`) | Only on the strip. For the leader it is the total of his own lien rows in the list | On the Dashboard, in his rows |
| **N to print and mail** | Strip | Monthly notices ready to print, plus printed ones to mail | **Not the card's copies to mail**, which are filed liens | On the desk, the office's run |
| **$ unpaid on the desk** | Strip | Every open balance on the jobs the desk holds | Only on the strip. The card shows no money | Nowhere. The tile has no door |
| **The month bar** | Card | The owner's five zones sized by their days, green where a zone went clean, red where it slipped, today marked | Only on the card. The Lien desk dropped this bar for the Board in v2.7332, the owner's ask of 2026-11-15 | Nowhere |
| **The zone today is in** | Card | *Nothing scheduled, days 16 to the end*, or in a working week *12 to send · 4 sent* | Only on the card | On the desk |
| **N reminders · N notices · N liens for next month** | Card | What is due next month, by kind | **Said twice on the card.** From day 16 on, today's zone is the quiet zone, so the second line and the *Next month* line are the same call, `lienMonthZoneLine(quiet)` (`DashboardLienMonthCard.tsx:43` and `:47`) | On the desk |
| **N slipped** | Card | This month's reminders, notices and liens not done once their zone's days passed, plus windows that closed this month | **Not the Board's count.** The Board's *N are past their day* leaves out reminders and closed windows (`lienBoardChipLate`) | On the desk |
| **N copies to mail** | Card | Filed liens whose copies to the owner and the GC are not recorded as served, § 53.055 | The list already has a row for these, *N filed liens have not been served* (`lien-serve-copy`), the office's line | On the Dashboard, in the office's row |

Three things worth saying out loud:

- **Two numbers by the same date are different numbers.** The strip's count by the 15th and the card's
  notices plus liens for next month will rarely match, and neither is wrong.
- **"Mail" means two things.** *To print and mail* is monthly notices. *Copies to mail* is filed liens.
- **The card's picture is one the desk gave up.** Its comment still calls it "the small version of the
  Lien desk's bar". The desk has had the Board in that place since 2026-11-15, so the card's door opens
  a page that speaks in other words, *past their day* and not *slipped*.

## Who sees each

The same four roles see both: a dev, a leader, an assistant and a controller (`isLienOffice`,
`lienDesk.ts:407`). The strip also needs the desk to hold a paper and the list to hold a line. The card
shows whenever the desk can be read. Quickfill's card draws no strip. So one place shows nobody a number
they do not see today.

**The unpaid amount** is on the strip only. The standing rule keeps contribution, earned revenue, labor
cost and targets from teammates. An amount customers owe is not on that list, and these four roles
already see it on the Lien desk. Option 1 as picked takes it off the Dashboard: a phone on a job
site is glanced at by a crew, and the number opens nothing. The mock-up draws it both ways for the record.

## Where it should sit

At the top, beside Needs you and not inside it. The owner's rule, 2026-11-23: Needs you is a place for
action. Everything in it can be pressed and goes away once it is done. The desk's standing has one door
and never clears, and the code already agrees: the strip is not an item and is not counted in the amber
pill. So it is a card of its own that touches Needs you.

- **New phone layout:** under the one-line Needs you door, where the strip already sits today.
- **Old layout and a desk:** directly above the Needs you card. Under that card it would be buried, since
  the card is the tallest thing on the page.

The cost on the old layout is that the standing reads before the action list. It is three numbers and
about 100 px. Lower down, after Assigned Jobs and the Billing pipeline, it is many screens of scroll from
the rows that clear it, and on 2026-11-22 the owner's review kept the desk's numbers at the top because a
leader reads them every day.

The red line stays on this card and does not become a row. Late papers are mostly the office's to move,
so for a leader that row would fall under *for others*. The list already carries the lien actions by
whose they are.

## The three options

- **Option 1, one slim card beside Needs you, and the lien month card dropped (recommended).** A label
  line, *Lien desk* at the left and **The Board ›** at the right, then three values side by side, the
  figure over its words, the way the Board draws its tiles. No dots. Needs you starts with its title and
  holds only presses. One red line shows only while a paper is past its day or will not make it, in the
  Board's own words (the day tile's `line`), so the Dashboard and the page its door opens agree. As a
  card it is 94 px tall with nothing late and 118 px with the red line, where today's strip is 101 px
  and the lien month card is 217 px more. **A leader loses:** the picture of the
  month's zones, the count of reminders, and in a working week the zone's own progress.
- **Option 2, one piece that carries the month too.** The same card in the same place, with the
  month's bar as a thin line and the zone today is in. 180 px. **A leader loses:** nothing but space, at
  the top of his page, every day. For half of every month the bar says *Nothing scheduled*. The three
  extra reads stay.
- **Option 3, neither block.** Lien work shows only as rows of the list, with **Open the Board** on a
  row when a paper is late. **A leader loses:** the standing at a glance, the office's side of the run,
  and under the New phone layout every lien fact on the Dashboard, since the rows live in the Inbox tab
  there. It goes against the 2026-11-22 call.

**Does the month bar earn its space on a phone?** Not on the Dashboard. It answers "what week of the lien
month is it", which the date already answers, and its days sit in **§ Rules** on the desk. If the owner
misses it, its home is the Lien desk, where he replaced it once already.

**One caution.** The owner meant to look at the lien month in a real reminders week, December 1 to 5.
Today is day 23, the card's emptiest state. If he wants that look first, the strip is redrawn now and the
card is dropped after it. The plan below is cut so that works.

## What is wrong to the eye

Each was checked against the code. The numbers match the pins on the mock-up.

| # | Fault | Where |
|---|---|---|
| 1 | The strip is a box in a card on a page | Its own border and fill (`NeedsYouLienBoardStrip.tsx:74`) inside the card's (`DashboardNeedsYouCard.tsx:319`) |
| 2 | The card does not start with its title | The strip is drawn before the head (`DashboardNeedsYouCard.tsx:330`), which is told it is not the first line (`top: null`, `:331`) |
| 3 | Four facts wrap where they fall | One `flex-wrap` line, 14 px gap. 101 px tall at 430 and 393, 168 px at 320 |
| 4 | **The Board ›** is alone on a third row | `marginLeft: 'auto'` on the last item of the wrapping line (`:78`) |
| 5 | Four dot colors beside the rows' colors | `:41`, then `needsYouPalette.ts`. Violet and amber mean a person in the strip and urgency in the rows |
| 6 | The amount is the widest bold thing | All four figures are the same `<strong>` (`:42`). It is not heavier, only longest |
| 7 | It says *the leader* to the leader | `useNeedsYouInputs.ts:180` builds the Board with no name. The row under it says *your name* (`dashboardNeedsYou.ts:1072`) |
| 8 | A second door, alone on a row again | **Open the Lien desk ›** wraps under the card's kicker (`DashboardLienMonthCard.tsx:55`) |
| 9 | The bar is a picture the desk gave up | `docs/GLOSSARY.md`, *The Board*, v2.7332 |
| 10 | One sentence, twice | `DashboardLienMonthCard.tsx:43` and `:47`, from day 16 on |
| 11 | "Mail" means two things | `LIEN_RUN_TILE_LABEL` in `lienBoard.ts` and `catchUp.copies` in the card |

Checked and dropped: the gap above the Needs you card. It is the 16 px every Dashboard card has.

## The rows under the strip

The owner asked on 2026-11-23 for the list's rows on a phone to have their words at the left and one
press at the right, every press one size. Another session builds that in `DashboardNeedsYouCard.tsx`.
Every After on the mock-up draws the rows that way, 104 by 44 px a press, so the strip is judged beside
them. The Before keeps today's rows. The count beside each row's words is left off the After, since the
row's title already says it. That detail is the other session's to settle. Option 3's lien row is drawn
in the same two columns. This card changes the strip and the card's head only, so its second PR lands
after the rows' PR, or is rebased on it.

## The Board on a phone, where the card's door lands

The owner asked on 2026-11-23 whether the Lien desk's Board looks good on a phone. Looked at by hand on
the worktree's dev server as the dev: one load at 430 by 932 in dark and one at 375 by 812 in light, more
than 15 seconds apart, the tab closed after. No figure or name from those looks is written here.

**It looks good as it opens.** The answer is yes for the first screen.

- No sideways scroll at either width. `innerWidth` equals `scrollWidth`.
- The four tiles stand two by two, 315 px for the whole Board. The list's first row is on the first screen.
- The bins are folded behind **Show the bins · N**, so the Board does not push the list away.
- Every press on the folded Board is 44 px or taller. Light and dark both read cleanly.
- The Dashboard card recommended above is this Board in small: the figure over its words, and the red
  line in the same words, *N are past their day*. A press on the card lands on the same picture.

**What is worth fixing, smallest first.**

| # | What | Where |
|---|---|---|
| 1 | The day tile's words wrap and leave one word alone on a line, *… to file · N to / send* | `Tile`, `LienBoard.tsx:287`, at both widths |
| 2 | The two **Show them ›** doors sit in different corners: under the red line on the day tile, top right on the leader's tile | `LienBoard.tsx:293` and `:311` |
| 3 | The top two tiles are 108 px and the bottom two 76 px, so the leader's tile is a third empty | the tile grid, `:610` |
| 4 | The amount is the largest, brightest figure of the four and opens nothing. The same point as on the Dashboard | the `unpaid` tile |
| 5 | With the bins open the Board is about 2,050 px, more than two screens, sixteen bins in one column with the empty ones drawn. **Hide the bins** is only at the top | `:634` and the grid under it |
| 6 | A chip in a bin is a press 22 px tall and 39 to 54 px wide, 5 px from the next. On a phone it shows a job's number alone, since the card that names the job needs a pointer | `.lienBoardChip`, `index.css:7742` |

Rows 5 and 6 are one thing: the open bins are a desk picture drawn in one column. The fold already
keeps them out of the way. A person who opens them gets small presses and a long scroll. That is a card
of its own if the owner wants it, not part of this one.

Not the Board's: on the dev server an orange *Add a one-tap Add Task icon* banner sat above the whole
page and took about 55 px. Whether a real phone shows it was not looked at.

**One thing the Dashboard card should take from the Board.** The Board names the leader, *waiting on*
and his first name (`leaderNameFor`, `LienDesk.tsx:1315`). The Dashboard builds its Board with no name.
PR 1 hands the name over, so the office reads the same words in both places and the leader reads *wait
on you*.

## What dropping the card costs beyond the Dashboard

- **Code.** `DashboardLienMonthCard.tsx` and its render test go, with `useLienMonth.ts` and its three
  reads, and four lines of `Dashboard.tsx` (57, 58, 173 and the draw at 1971). The kernel
  `lienMonthRhythm.ts` stays: **§ Rules** reads its days (`LienRulesModal.tsx:320`) and the desk's rows
  read its zones through `lienMonthLine.ts`. Today only `useLienMonth` calls `buildLienMonth`. The PR
  checks that again before it removes anything from the kernel.
- **One guide names the card.** `src/content/help/send-a-courtesy-notice-before-a-lien.md`, line 18:
  *On the Dashboard, **The lien month** counts it as slipped.* That sentence is rewritten to name the
  strip's red line, or the desk.
- **Docs that name it.** `docs/DASHBOARD_SECTIONS_ARCHITECTURE.md` (row 8b and the role table's row),
  `docs/twins/APP_DIRECTORY.md` (line 134), `docs/GLOSSARY.md` (*The lien month*),
  `docs/LIEN_DESK_ARCHITECTURE.md`, `docs/PROJECT_DOCUMENTATION.md` and `to-dos/lien-to-do-one-run/README.md`.
- **The dock and the phone folds do not list it.** It has no dock anchor and sits outside every fold, bare
  after the Billing pipeline's fold. Nothing to unhook there.

## The plan, for option 1

Three small PRs. Each claims its version when it starts.

1. **The words (S).** In `src/lib/jobs/lienBoard.ts`, `lienBoardDots` takes who is reading. The leader's
   value reads *wait on you* for a dev and a leader, and for the office *waiting on* and the leader's first
   name, as the Board on the desk says it. The amount
   is left out. It also hands back the day tile's red line. Only the day's
   value carries a tone, and amber becomes plain. Tests in the kernel's own file. No draw changes.
2. **The draw (S).** `NeedsYouLienBoardStrip.tsx` becomes one card with one layout: the label line with
   the door, the values with `WorkedOutValue`, the red line when there is one. `DashboardPinnedQuickRow.tsx`
   draws it beside Needs you in both layouts, above the card or under the door. `DashboardNeedsYouCard.tsx`
   stops drawing it, so its head is always the card's first line. The strip then shows whenever the desk
   holds a paper, whether or not the list has a line. The Inbox tab's card loses the strip with it, which
   is the owner's to confirm. The render smokes that name the strip are updated. The guides
   `needs-you-card` and `try-the-new-phone-layout` get their sentence.
3. **The card goes (S).** What the section above lists. This one waits for the owner's December look if
   he wants it.

Each ships its release note, its fragment and its lines in the docs.

Not planned: a press on each value that opens the Board narrowed to its papers. The Board's tiles have
those doors. Whether the page can be opened on one from a link was not looked at.

## Where it stands

**Built and live, 2026-11-23.** Both PRs merged that day and went out with the 15:57 UTC deploy.

- **v2.8339, the Lien desk card beside Needs you** (#9456, the plan's PR 1 and PR 2 as one).
  `DashboardLienDeskCard` over `src/lib/dashboard/lienDeskCard.ts`: three values, a red line in the
  Board's words while a paper is late or at risk, no unpaid amount, *wait on you* for a dev or a leader.
  It stands right above the Needs you card, or under its door with the new phone layout. Both Inbox tabs
  draw `DashboardPinnedQuickRow` with `bannersOnly`, so there it stands above their card too. The Needs
  you card starts with its title. Looked at by hand on a dev server as the dev at 430 px in dark, 112 px
  tall above the Needs you card, and at 1,400 px, one line 42 px tall.
- **v2.8342, the lien month card dropped** (#9459), with `useLienMonth` and its three reads.
  `lienMonthRhythm.ts` stays, since § Rules and the desk's rows read it.

**What differs from the plan.**

- **The office read *waiting on the leader* until v2.8372.** The plan's PR 1 said *waiting on* and his name,
  as the Board on the desk says it. v2.8339 left it out on a reason that did not hold: the desk names the master
  most of its papers wait on. v2.8372 gives the card that name, by the one rule both now read
  (`lienBoardLeaderUserId`), and was looked at as the Sample assistant at 1,400 px and at 320 px.
- **The Inbox tab's card lost the strip**, and the Lien desk card stands above it. The owner was not
  asked. It follows from the card leaving Needs you.
- **The lien month card went before the owner's December look.** He gave the go for everything the same day.

**From *The Board on a phone* above.** Rows 1 and 2 are fixed by punch list #428 (v2.8341). Rows 5 and 6
are gone on a phone, where the flow takes the bins' place (v2.8346). Row 3, the tiles' uneven heights on
**By day**, and row 4, the amount as the Board's largest figure, are as they were.

## How to verify

- The kernel's tests, the render smokes, and `npm run check:empty-words` and the theme check on the strip's file.
- One look by hand as the Sample leader at 430, 393 and 320 px, dark and light, with the New phone layout off and on, then at a desk. `innerWidth` equals `scrollWidth` at each phone width.
- The strip's click is still counted as `#lien-board`.
- After PR 3, the Dashboard's network log shows the three lien month reads are gone.

## Not looked at

- The short Dashboard of punch list #365, and whether it draws either piece.
- How far apart the two sit in pixels on the live page. The mock-up marks the scroll, it does not measure it.
- The Dashboard on a real phone. The built card was looked at on a dev server at a phone's width.
- The Board at 320 px, and the other three views of the desk.
- An earlier drawing put the strip inside the Needs you card, under its title. The mock-up keeps one frame of it for comparison.
- An earlier idea, the strip as one 44 px line, is no longer drawn. It gave up the run's count, which the 2026-11-22 call keeps.
