---
name: "My Bids and Recent Reports on the Dashboard: one swipe to put a row away"
number: 426
group: ready
status: claude/my-bids-refresh-c526b6 · asked 2026-11-23 in two asks, each with a phone screenshot · read and drawn the same day · the owner's go the same day, as recommended, with one press per bid · steps 1 and 2 of 6 in review
summary: >
  The owner wants the eye icon on each My Bids row replaced by a swipe and the bids grouped by state.
  He wants Recent Reports' heading back on one row, its presses moved to the foot, and the same swipe
  to mark a report opened, so a person can clear work off a list. The plan is one swipe for both
  cards: left, a strip that names the act, Undo, and a folded group at the foot that holds what was
  put away. The reading also found things neither ask named, listed below for each card.
next: Steps 3 to 6 of the build list, in order.
size: L as a train of six (S · M · M · M · S · S); left: steps 3 to 6
blocker: None.
opinion: build — the owner said go on every recommendation
---

# My Bids and Recent Reports on the Dashboard: one swipe to put a row away (#426)

## Where it stands

The owner said **go, as recommended** on 2026-11-23. Every pick below is answered. The build is six small
PRs, listed under *The build*. Step 1, the My Bids read, is the PR that adds this card. Step 2, the groups
and the one-press bid, is the PR after it. Steps 3 to 6 are not built.

The mock-up is [`mockup.html`](mockup.html). For each card it draws the card as it is beside the card as
planned at 430 px and at 320 px, the swipe in three frames, and the desk. Two frames work under a finger or
a mouse, one for each card. Its **Both**, **Light** and **Dark** buttons repaint the frames. Every bid, job,
builder, street and person on it is made up.

The page as the owner saw it is a private artifact:

- *My Bids refresh* — https://claude.ai/artifact/DqWG8MR525tvWibXru6URz

## The asks

The owner, 2026-11-23, with a phone screenshot of My Bids in dark mode, the eye icon circled:

> On the dashboard on my bids, I would like to improve how we handle hidden bids. Instead of seeing this
> icon, I would like for the user to be able to swipe to the left or right to hide a bid. I also think this
> section can improve. I think we can do a better job specifying the state a bid is in by grouping them to
> those states instead of stating it for every item.

The same day, with a screenshot of Recent Reports, the heading's second row and the empty band at the foot
both circled:

> In the recent reports section of the dashboard, I don't like how the title becomes two lines and mark
> eight opened and view all and the mail button are all there. Maybe we can move some of that to the bottom
> line? And I would also like to add a swipe to mark opened feature like we are about to do for bids, the
> idea being that we can make it super easy for someone to clear work off their list.

## The swipe, stated once

**Swipe a row to the left to put it away.** A strip under the row names the act. Pull until the strip turns
blue, then let go. The row moves to the folded group at the foot of its card. **Undo** brings it back for
ten seconds. The group's own press brings it back at any time.

| Card | The strip says | The row goes to | The press that brings it back | Kept |
|---|---|---|---|---|
| My Bids | **Hide** | **Hidden** | **Show again** | In the phone's browser today (pick 4) |
| Recent Reports | **Mark opened** | **Opened** | **Mark unread** | In the database, per person |

- **One direction, left.** People's phone rows already slide left to show their presses. The Pipeline's
  phone rows slide right to move a job forward. Left keeps one meaning across the app. A right swipe does
  nothing.
- **Scroll and Back.** The row carries `touch-action: pan-y` and the kernel decides swipe or scroll at 6 px
  (`classifySwipe`), so a touch that moves up or down scrolls the page. The phone's Back swipe starts at the
  left edge and moves right. A left swipe never starts it.
- **Hard to do by accident.** The strip is 160 px wide. The row must travel 112 px before the strip turns
  blue. Short of that the row springs back.
- **Undo.** A toast names the row with **Undo** for ten seconds (`showActionToast`, which exists).
- **A mouse.** At a desk each row carries the same act as a word press on its right, the size of the row's
  other press: **Hide** on a bid, **Mark opened** on a report.
- **A keyboard.** On a touch screen the strip's press is a real button. Tab reaches it and the row slides
  aside to show it. Enter does the act.
- **A screen reader.** The strip's button is always in the accessibility tree, named for the act and the
  row. People's rows hide their strip from a screen reader until the row is open. These rows do not.
- **Built once.** One shared row, `SwipeAwayRow`, over `useSwipeRow` from
  `src/components/people/useSwipeRow.ts`. The hook gains one optional number, `settleAt`, which it hands to
  `swipeSettles` as the threshold that function already takes. People's rows pass nothing and behave as
  today. `StagesPhoneRow` keeps its own swipe. No third swipe is written.

**A, recommended: let go to put away.** As above.

**B, the alternative: uncover, then tap.** The swipe settles open over the press and waits for the tap, as
People's rows do. No row is put away by accident. Each one takes two touches.

## My Bids

The card is `src/components/dashboard/DashboardMyBidsSection.tsx` over `src/lib/dashboardMyBids.ts`.

### What the card does today

**Whose bids.** A bid is yours when you are its estimator or its account manager. The card draws for a dev,
a master, an assistant, a controller, an estimator and a primary. A lost bid is left out. The read takes the
first 50 by due date, oldest first, with no due date last.

**The two piles.** A bid with no sent date is in the list. A bid with a sent date is behind **Sent bids (n)**.
The row's last line says *Unsent*, *Pending*, *Won* or *Started or Complete*.

**The presses.** The row opens the bid on Submission & Followup. **Preview** opens the bid's preview window
over the Dashboard. The eye hides the bid.

**Hide.** A hidden bid's id is written to `dashboard_my_bids_hidden_<user>` in the browser's own storage.
Nobody else is affected. Nothing brings a hidden bid back except **Add back** under **View hidden**.

**Unread updates.** The amber box shows when someone else wrote a bid note or a customer note after your
last **Mark read**. The mark is a row per person and bid in `user_bid_notes_read_state`. It is held while
View as is on.

**The fold.** A primary's card opens folded to its heading. Nothing remembers the press.

### What the reading found

Each line was checked in the code.

1. **Hide lives on one device.** A bid hidden on the phone is back on the desk. A cleared browser brings
   every hidden bid back.
2. **Hide every bid and the card is gone.** The card draws only while a bid is not hidden. With all of them
   hidden, the card and its **View hidden** link both go. There is no way back on the screen.
3. **A note on a sent bid cannot be seen.** The amber box is drawn with its row, and a sent row is drawn only
   after **Sent bids** is pressed. A hidden bid's note is hidden the same way.
4. **The card's state rule is its own.** It reads the sent date first, so a bid marked Won with no sent date
   reads *Unsent*. The Bid Board reads the answer first (`getSubmissionSectionKey`). The card also says
   *Pending* where the board's heading is **Not yet won or lost**.
5. **The card lists bids the board has put away.** **Archive from board** takes a bid off the board's unsent
   pile. An adopted bid is left out of the board's counts. The card's read filters neither.
6. **The 50 cuts the wrong end.** The read sorts by due date before it cuts. A person with more than 50 bids
   loses the newest due dates and every bid with no due date. At least one account holds more than 50.
7. **The presses are small.** Preview is about 31 px tall and the eye is 27 px square.
8. **At 320 px a name can vanish.** A bid with both role chips gives the chips the whole box. Its name is
   squeezed to nothing. The mock-up's 320 px frame shows it.
9. **`View hidden (n)` can count bids the list no longer holds.** The count is the stored ids. The list is
   the stored ids that are still in the read.

### The groups

The states are the Bid Board's own, in its words and its order of work.

| Group | What it holds | Order | Opens |
|---|---|---|---|
| **Unsent** | No sent date and no answer | Oldest due date first, no due date last | Open |
| **Not yet won or lost** | Sent, no answer yet | Newest sent first | Folded |
| **Won** | Marked won | Newest sent first | Folded |
| **Started or Complete** | Marked started or complete | Newest sent first | Folded |
| **Hidden** | Bids the person hid, in any state | As above | Folded |

- Each heading carries its count. The counts add up to the number in the card's title.
- A group with no bids is not drawn. Unsent is always drawn and keeps its words, *Nothing unsent.*
- **A past due date stays in Unsent.** Its date is drawn in red with the days past due, and the heading says
  *1 past due*. The rule is the board's `bidBoardDueCellParts`: red and amber only on an unsent bid.
- **No due date stays in Unsent, last.** The row reads *No due date* with its days on the board, red after
  14 days. The rule is the board's `bidBoardNoDueDateParts`. The read adds `created_at` for it.
- **Unread updates stay with their bid.** A folded group still draws any bid with unread updates, and its
  heading says *1 unread*.
- **Sent bids** and **View hidden** become groups. **View all** becomes one door named for where it goes,
  **Bid Board**.
- A primary's card still opens folded to its heading.

### The row

The owner looked at two drafts on 2026-11-23. The first had **Preview** as a tall press on the row's right.
The second put it in a narrow column on the right, in the shape of a Needs you row. His words on each:

> I think that preview just looks weird and that the shape of the card could be better done where we do a
> better use of space. Maybe we put preview in the bottom right, like we did for the needs you cards.

> I think this is much better. I just don't think that we need to be cramping up the title and description
> in doing this. […] A user's primary function in bids is to either hide bids that they don't care about or
> to be able to jump into bids that they're very focused on.

So a bid has two moves and no buttons on a phone. A press goes in. A swipe hides.

- **The box.** One box per bid: `var(--bg-subtle)`, a border, an 8 px corner and a 4 px edge on the left, as
  a Needs you row has. The edge is red for a past due date or for no due date after 14 days, amber for a date
  within three days, and grey for the rest. The colours are `NEEDS_YOU_RAIL`'s and the rule is the Bid
  Board's (`bidBoardDueCellParts`, `bidBoardNoDueDateParts`).
- **The name** takes the full width of the box, in link type, wrapping by the word.
- **The due line** is under it, full width: *Due* **Wed 4/8** *229 days past due*, or **No due date**
  *19 days on the board*, or *Sent* **Fri 11/20** *3 days ago*. The values use `WorkedOutValue` from
  `src/components/valuesInPlace/ValuesInPlace.tsx`, since the card changes none of them. The role chips,
  **Estimator** and **Account Manager**, follow on the same line and wrap under it on a narrow phone.
- **A small arrow** at the right edge says the box opens.
- **At a desk** the box is the same, with **Hide** as a word press on its right.
- **A hidden bid** is the same box with a grey edge. Its due line opens with its state, and its press is
  **Show again**.

**What a press opens (pick 2).** The bid's window, the one **Preview** opens today
(`useBidPreview().openBidPreview`, `BidPreviewModal`). It shows the bid's dates, contact, value, notes and
questions, has **Edit bid**, and under *Open in Bids* has a door to every tab the person may open. Three
reasons:

1. Today the row always lands on Submission & Followup. An estimator pricing an unsent bid then has to find
   Counts or Pricing. The window's doors go straight to any tab.
2. A job's name opens the job's window across the app. A bid's name opening the bid's window is the same
   habit.
3. With one press there is no button on the row, so nothing squeezes the name.

The cost: going into a bid is two presses, the bid and then its tab. Today it is one press to a tab that is
often the wrong one.

**The alternative: two doors.** A press on the box jumps to Submission & Followup, as today. **Preview** sits
small at the bottom right, on the chips' line. The mock-up draws it once.

A bid is two lines tall on most phones, 67 px in the mock-up at 430 px. The trade is left off while every bid
in the list shares one trade. It comes back on each bid when they do not. **New Bid**, **Mark read** and
**Show again** are 44 px tall.

The phone card is about 115 px taller than today with every other group folded. Four folded headings stand
where one row of links stood.

## Recent Reports

The card is `src/components/dashboard/DashboardRecentReportsSection.tsx` over
`src/lib/dashboardRecentReports.ts`.

### What the card does today

**Who sees it.** A dev, a master, an assistant, a controller, a primary and a superintendent
(`isDashboardRecentReportsRole`). The database decides whose reports each one reads. A primary reads their
own jobs' reports and the ones they wrote, and a line over the list says so.

**The list.** The card reads every report the person may see, newest first, and keeps the first eight.

**New, Opened and Done.** They are the person's own, a row per person and report in `report_reads`, so they
follow the person to every device.

- **New** has no row. It draws a blue dot and a bold name. A report the person wrote is never new to them.
- **Opened** has a row. A press on the report writes it. The report stays in the list, dimmed with a green
  tick, until the page loads again. After that it is behind **Show N opened reports**.
- **Done** has a row with `done_at`. **✓ Done** inside an opened report writes it. The report is never drawn
  on the Dashboard again.

Only this card writes `report_reads`. Reading a report on Jobs, in the job's window or in the email leaves it
new here.

**The time and the day.** They are one moment, when the report was filed (`formatReportRowTime`). The clock
is drawn at the right of the name and the day under it.

**The pictures icon.** It opens the job's customer pictures in the browser. A red one means the job has no
link, and a press asks Dispatch to set one. A second badge, a camera and a count, shows when the report
itself has photos.

**The presses in the heading.** **Mark N opened** marks every new report in the list opened. **View all →**
opens Jobs → Reports. The envelope opens **Email reports**, where a dev, a master, an assistant or a
controller sets who gets each report as it is filed.

**The name.** A press on the name opens the job's window. A press anywhere else on the row opens the report
in place. A primary's name is plain text.

**The fold.** The card opens by itself when something is new, except for a primary. On an office phone the
page wraps it in a second fold whose headline reads the card's counts.

### What the reading found

Each line was checked in the code.

1. **The list is the newest eight, cut before anything else.** The badge can never read more than 8. A ninth
   new report is never shown, and it is not shown after the eight are cleared either.
2. **A cleared list draws a blank.** The words for an empty list show only when the person can read no
   report at all. With eight reports all opened earlier or all done, the card draws its heading over
   nothing.
3. **Done cannot be undone.** The guide says **Mark unread** undoes it. That press is inside an opened
   report, and a done report is never drawn, so nothing on the Dashboard reaches it.
4. **Opened and Done are nearly one thing.** Both take the report out of the list by the next load. The
   difference is whether **Show N opened reports** can list it again.
5. **The name and the row do two things.** The name is the biggest target and it opens the job. The report
   is the rest of the row. **Job detail** is already inside the opened report.
6. **The presses are small.** The envelope is 32 px square. **Mark N opened** and **View all →** are bare
   links about 20 px tall.
7. **The read of the marks has no limit and no filter.** It asks for every `report_reads` row the person
   has. The API hands back 1,000 rows at most, so a person past that could see an opened report as new.
8. **The heading wraps at every phone width.** The title and its badge want one row and the three presses
   want another. Together they do not fit under about 440 px.

### The plan

**The heading, one row.** The fold, **Recent Reports** and the **N new** badge. Nothing else. It holds at
320 px.

**The foot, two rows.** Each reads what it is on the left and has its press on the right.

1. *Swipe a report left to mark it opened.* and **Mark N opened**. One at a time or all at once, side by
   side. At a desk the left side reads the count of new reports. The row is not drawn when the list is
   empty.
2. **Email reports**, in words with its envelope, and **View all ›**. The first is drawn only for the roles
   that may set it.

**The row.** A divided list in place of eight boxes, so the swipe has a row to slide.

1. The dot for a new report, or the tick for an opened one.
2. The job's name. A press anywhere on the row opens the report in place (pick 8).
3. Who filed it, then the day and the time as one value, *yesterday 1:02 PM*, then the pictures icon and
   the photo badge.
4. At a desk, **Mark opened** on the right.

**What a swiped row does.** It leaves the list at once and goes to **Opened**, a folded group at the foot,
the way a hidden bid goes to **Hidden**. Each row there has **Mark unread**. **Mark N opened** sends every
new row there in one press, with one Undo for all of them. A report opened by a press stays in place,
dimmed, as today. A swipe clears that one too.

**Clearing means Opened.** Opened is the one put-away state (pick 6). The **✓ Done** press goes. A report
already Done reads as Opened, so nothing comes back as new. Nothing is deleted, and **View all** still
lists every report.

**The list.** Eight rows at a time, newest first, from the new reports of the last 14 days (pick 7). When a
row leaves, the next new one comes up. The badge counts every new report in those 14 days. Older reports are
behind **View all**.

**A clear list** says *Nothing new to read.* and what fills it. The words go through `emptyWords` in
`dashboardEmptyWords.ts` at build time.

The phone card is the same height as today with eight rows. The rows lose their boxes and the foot gains two
rows.

## The owner's picks, all answered 2026-11-23

He picked one press per bid by name, then said *go, as recommended* for the rest.

1. **The swipe, on both cards: A.** Let go to put away, with Undo.
2. **My Bids: one press per bid**, which opens the bid's window. The two-doors alternative is not built.
3. **My Bids: a hidden bid shows again while it has unread updates**, until **Mark read**. The rule needs no
   new storage: a bid is drawn when it is not hidden or it has unread updates.
4. **My Bids: Hidden follows the person to every device**, as its own PR. It needs one small migration, a
   `hidden_at` on `user_bid_notes_read_state` or a table of its own, and a one-time move of the ids in the
   browser.
5. **My Bids: the card leaves out a bid archived from the board.** Built in step 1.
6. **Recent Reports: Opened is the one put-away state.** The **✓ Done** press goes.
7. **Recent Reports: the list refills as it is cleared**, eight at a time from the last 14 days.
8. **Recent Reports: a press on the name opens the report.** **Job detail** stays inside the opened report.

## The build

Each PR claims its version, ships its release note and fragment, and passes the checks in `CLAUDE.md`.

| Step | Belongs to | Size | What it does |
|---|---|---|---|
| 1, in review | My Bids | S | **The read.** The grouping kernel over `getSubmissionSectionKey`, the board's two orders and its due-date parts, with tests. The read stops the 50 from cutting live bids, adds `created_at`, and leaves out adopted bids and, on pick 5, archived ones. On the screen, a bid that read *Unsent* reads its true state. |
| 2, in review | My Bids | M | **The groups.** Headings, counts and folds, one box per bid with one press, the **Bid Board** door, **Hide** as a word press, the **Hidden** group with **Show again**, the fix for the vanished card, and picks 2 and 3. |
| 3 | Recent Reports | M | **The heading and the foot.** One heading row, the foot's two rows, the day and time as one value, **Mark opened** as a word press on each row, the **Opened** group with **Mark unread**, the words for a clear list, the read of the marks narrowed to the listed reports, and picks 6, 7 and 8. |
| 4 | Shared | M | **The swipe.** `SwipeAwayRow` and `settleAt` on `useSwipeRow`, the strip, the blue mark, **Undo** and the keyboard's way in, with a render smoke on pointer events. My Bids uses it in this PR. |
| 5 | Recent Reports | S | **The swipe on reports.** The same shared row with **Mark opened**. The guides for both cards. |
| 6 | My Bids | S, a migration | **Hidden follows you.** Pick 4. |

Steps 1, 2 and 3 do not wait on each other. Step 4 waits on 2. Step 5 waits on 3 and 4.

Docs each PR amends where it changes them: sections 10 and 11 and the storage-keys line of
`docs/DASHBOARD_SECTIONS_ARCHITECTURE.md`, the two My Bids lines of `docs/ACCESS_CONTROL.md`, and the guides
`dashboard-section-bar.md`, `read-field-reports-on-the-dashboard.md`, `email-reports-to-people.md` and
`see-your-email-schedule.md`. The office phone's fold headline for reports is in
`src/lib/dashboard/phoneFolds.ts` and reads the card's counts.

## How to verify

- `npm test -- dashboardMyBids dashboardRecentReports` and each section's render smoke.
- On the dev server, sign in through `/dev-login` and open the Dashboard at 320 px and at a desk. The capped
  live look applies: one page at a time, by hand. Never hide a real bid and never mark a real report opened
  for a walk. Make a `ZZ Test` bid and a report on a `ZZ Test` job, use those, and delete them after.
- Another Dashboard PR is open on `Dashboard.tsx` and three sibling cards. This work touches none of them.
