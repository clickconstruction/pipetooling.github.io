---
name: "Permit news on the Bid Board: on the bid's own row, yours only, and only when it is true"
number: 401
group: gated
status: asked 2026-11-19 with a screenshot of the Bid Board · the strip's code, its fragments and the read behind it read on main the same day · the live lines counted through the app's own kernel on the dev server, read only, and looked at as a sample estimator · the board drawn as it is and five ways it could be, at a desk and a phone, in both themes · a second look redrew the pick · nothing built · the owner picks
summary: >
  An estimator asked for the strip Permit news on your bids to move lower on the Bid Board or
  onto Followup, and the owner asked how the news could sit with the bids instead of above them.
  The live lines say the place is the smaller problem. The strip lists every person's bids, so
  the estimator who asked holds one of its ten lines. Five of its seven "another name" lines
  are about another suite, an older job or site work, and no line has been answered in the nine
  days since it shipped, because the only way out is to mark a bid lost. The pick takes the
  strip away. The chip already on the bid's row becomes the press, with the name and the day on
  it. Three rules in the kernel drop the lines the records can rule out. A count of your own
  bids' news leads the sections row and is drawn only when there is some. A line gets a
  truthful way out, Not this job. The same chip sits where an outcome is decided: Followup's
  Waiting to hear, and the bid's Win / Loss.
next: The owner picks among A, B, C and the row (calls 1 to 6 below, each with a pick). PR 1 can go first on a yes to call 1 alone: it is the kernel's three rules and whose news counts, with no new screen.
size: M as a train of five (S · M · M · S · S)
blocker: The owner's pick.
ver: v2.6870 (the strip and the row's chip) · v2.6960 (Mark lost… on a line)
opinion: build, PR 1 first — three of today's lines offer Mark lost… on a bid for a permit that is on another suite, and that is a wrong press to offer whatever the layout
---

# Permit news on the bids (#401)

The mock-up is [`mockup.html`](mockup.html): the board as it is, the estimator's two ideas, a
one-line fold, the row, a second look, and the pick. Every bid, builder and plumber in it is made
up. The mix of lines matches what the live strip held on the day.

## The ask, in the owner's words

2026-11-19, with a screenshot of Bids → Bid Board in the dark theme. The estimator, Wendy:

> I would like to move "permit news" to either lower down on the bid board or to the follow up
> page.

The owner:

> I think we could do a better job integrating this permit news with the active bids, so it's not
> just a blob at the top that she has to skip past every time she looks at the bidboard. How could
> we offer this? How could we do a better job?

And, while the mock-ups were being drawn:

> After you drawn the mock-ups, ask yourself is this the best we can do and present me the
> options.

## What is there today (read on main at v2.7901)

Punch list #307 built it ([`to-dos/bid-permits/`](../bid-permits/README.md)).

- **The strip** is `BidBoardPermitNews`, drawn by `BidsBidBoardTab` above the sticky sections row,
  so above every bid. Four lines show and the rest fold behind *See N more*. The fold is not
  remembered.
- **The lines** come from `bidPermitNews` (`src/lib/research/bidPermitNews.ts`), over one read of
  `bid_site_permits` per city (`useBidPermitNews`). A line is one undecided bid on a street
  address in a city the pull reads. Four kinds:
  - **Another name**: the newest general plumbing permit on the address lists a name that is not
    the building permit's contact and is not one of ours. It leads the list. It has no age limit.
    On a sent bid it offers **Mark lost…**.
  - **Ours**: that permit lists one of our names, for 30 days.
  - **Issued** and **Applied**: a building permit issued, or an application filed, in the last
    30 days.
- **What makes a line leave.** A building line leaves after 30 days. A plumbing line leaves only
  when the bid is decided. There is no *seen*, and no way to say a line is wrong.
- **Who sees it.** The office and every estimator (`canResearchPermits`). The strip is handed the
  board's whole list for the trade. It does not follow the search, the development filter or
  **Marked**, and it is not narrowed to the reader's own bids, though `Bids.tsx` already knows
  which bids are yours (`isMyBid`: you estimate it, you manage it, or it was marked for you).
- **The row already says it.** Each of those bids carries a chip under its GC (`PermitChip`):
  *Plumbing permit · another name*, *Issued Nov 10*, *Applied Nov 3*. The chip is a label. It
  cannot be pressed, and it names neither the name nor, for a plumbing permit, the day.
- **Followup and the Dashboard carry none of it.** v2.6960 left the follow-up's line unbuilt.
  The Dashboard's Needs you has one permits line, for names that look like a customer
  (v2.6962), which is a different job.
- **Where a bid is marked lost today.** On the board, a bid tracked per GC has its GC lines and
  any other bid is decided in its window, under **Win / Loss**. Followup has the quick capture on
  By builder and By status, and **Lost…** among the six presses of Waiting to hear.

## What the live lines say (2026-11-19, read only)

Counted on the dev server as the dev login, with the app's own kernel over the live reads, then
looked at as the sample estimator through View as. Nothing was pressed that saves.

| | |
|---|---|
| Undecided bids, every trade | 296, of which 126 sit on a street address in a city we read and 40 have a permit on the site |
| Bids with a chip | 22 |
| News lines | 12: ten on the Plumbing board, one on Electrical, one on HVAC |
| By kind | 8 another name · 3 issued · 1 applied · 0 ours |
| Whose bids, on the Plumbing board | one estimator 5 · an office assistant 4 · **Wendy 1** |
| Not sent yet | 1 of 12, and it is Wendy's |
| Age of the permit behind each *another name* line | 15, 17, 24, 44, 51, 84, **478** and **631** days |
| Age of the building lines | 9, 16, 21 and 23 days |
| Lines answered since the strip shipped on Nov 10 | **none**. One bid was decided in the whole company in those nine days, and it had no line. |
| Lines that have stood since the week it shipped | 6 of the 8 *another name* lines |
| The strip's height, folded to four lines | 315 px at a desk 900 px tall · 666 px on a phone 812 px tall |
| The lines' bids that are on the board's first rows | 5 of 10. The other five are sent bids behind *Show all 118*. |

Presses of **Open the bid** are not logged, so whether a line was read cannot be counted. An
outcome is the only answer the data can show, and there is none.

### The eight "another name" lines, one by one

Read from each permit's own row: its address with the unit, its work in words, its day, its
contact. This is one reader's judgement of eight rows, not a rule.

- **Four name a different suite than the bid.** A grease trap replaced in another unit. An
  architect's filing for another unit. A plumber's finish-out in another suite. A unit in
  another building of the same address, from February 2025.
- **One is an older job**: a shower install nine months before the bid was started.
- **One is site utility work** for the development, issued nine days before the bid was started.
- **Two look like the job we bid**: a plumber's permit under the building permit's own number,
  and a restroom remodel, issued about six and three months after the bids were sent.

Also:

- Four of the eight permits were issued **before the bid was started**. Two of those are more
  than six months older than the bid.
- Two of the eight names are architects and one hauls grease. Five are plumbers.
- One sits on an **Electrical** bid, with Mark lost… on it. A plumbing permit says nothing about
  who won the electrical work.
- Seven of the eight offer **Mark lost…** today. On five of the seven, pressing it would record a
  loss the records do not show.

The suite fault is the one the Permits session found on 2026-11-19 in the Builders list: the feed
pairs by street address, and the street address carries no suite. There it is in the SQL reads
(`research_permits_v2`, `research_builders`). Here it is in the bid's kernel (`permitsOnSite`
compares the street with the unit left off). The two fixes do not touch the same file.

### What that changes about the ask

A strip of ten fresh lines would be a question of where to put it. This is a strip of ten lines
where nine are not the reader's, five are not true of the bid, two are a year old, and none can
be cleared without saying something false. Moving it keeps all of that. So the design answers
three things in this order: **is it true, is it yours, and where is it read.**

## The options, each with what it gains and loses

All six are drawn in the mock-up at a desk and a phone, light and dark.

| | What it is | Gains | Loses | Size |
|---|---|---|---|---|
| **As it is** | The strip above the sections row | Nothing can be missed | 315 px, or 666 on a phone, before the first bid, every time | — |
| **A · Lower on the board** (her first idea) | The strip heads *Not yet won or lost* | Her working bids come straight up | That section starts about 2,500 px down at a desk. A real loss becomes news nobody scrolls to. Still everyone's, still stale. | XS |
| **B · A lens on Followup** (her second idea) | An eighth lens, *Permit news*, with a count on the tab | The board is clean, and Followup is where a bid is chased and marked lost | A second place to remember. A count that never moves. The unsent bid's line, hers, has nothing to do with following up. The row's chip stays mute. | M |
| **C · One line that opens** | The strip folded to its title and count | 315 px becomes 44, in an afternoon | A red 10 that never goes down is wallpaper in a week. Still a list away from the rows. | XS |
| **D · On the row, first draft** | No strip. The row's chip is the press and opens the line under the row, with **Not this job**. A count beside **Marked** narrows the board. | Read where the bid is. No height when there is no news. A wrong line has a way out. | She still clears ten lines by hand, nine not hers. The count is a sixth icon on a phone. | M |
| **The pick** | D after the second look, below | A board with nothing new for its reader shows nothing. Real news has a name and a day and is answered where it is read. | The largest build: five small PRs and one new table. News far down the board is found through the pill. | M as a train |

## Is this the best we can do?

A second look at D against the ten real lines changed seven things.

1. **The app can rule out most wrong lines itself.** A press that asks a person to clear what the
   records already show is still a chore. Three rules go into the kernel first:
   - **Another suite.** When the bid's address names a suite or unit and the permit names a
     different one, the permit is not on this bid's site. No line and no chip. When either side
     names none, the rule says nothing.
   - **There before the bid.** A plumbing permit issued before the bid was started is not an
     answer to the bid. Inside six months it is worth knowing while pricing: a quiet grey chip,
     *Plumbing permit here since Nov 2*, no Mark lost… and no count. Older than that it is
     history, and it stays in the bid's **This site** list.
   - **The bid's trade.** A plumbing permit is news on a plumbing bid.
2. **Whose news it is.** The count is the reader's own bids. The chip stays on every row for
   whoever reads that row.
3. **The chip said nothing.** It now reads *Permit lists Copperline Plumbing · Aug 27*, so most
   lines are read without a press. A long name is cut with an ellipsis.
4. **The count was in the wrong row.** It is the first pill of the sticky sections row, in words,
   *Permit news 3*, drawn only when there is news. Pressed, the board holds those bids, wherever
   they sit in the 118, with *Show every bid* to leave.
5. **New, then standing.** D's count could only go down by an answer, so a person waiting on a
   GC's call would look at it for a week. A line counts until its reader has opened it. After
   that the chip stays on the row until the bid is decided or someone presses Not this job.
6. **Her Followup idea is right about one thing.** The outcome is decided on Followup and in the
   bid's window. So the same chip and window sit on a Waiting to hear row, above its six presses,
   and one line sits above **Win / Loss**. The news is not moved there. It is repeated there.
7. **What Not this job records.** One press, by anyone who can open the bid, for everyone:
   the bid, the permit's number, who and when. *Taken off this bid. Undo.* The permit stays in
   This site with who said so, and the way back is there.

Under the pick the ten lines become five that count, each for the person who holds the bid. The
mock-up's last table shows each line's fate. **Wendy's count is zero**, so her board has no strip
and no pill, which is what she asked for by another road.

### Weighed and left out

- **A Dashboard Needs you line** (*A plumbing permit under another name is on 2 bids you sent*).
  It would reach a person who has not opened the board. It costs the permits read on the
  Dashboard, which v2.6962 measured at seconds for its own line. Drawn, and left as call 5.
- **Log a call** on a building line. #307's mock-up drew it and v2.6960 left it. The row already
  has *Last contact +*.
- **A digest by email.** Two real lines a week do not need a mail.
- **Guessing that a name is not a plumber.** The app cannot tell an architect from a plumber by
  the name. Where the office has said what a name is (Permits → Builders, the question in the
  bid's window), the line can say so. That is a note for PR 2, not a rule.

## The calls, each with a pick

1. **Which way.** A, B, C, or the row. *Pick: the row, as redrawn.* If the answer is "the
   smallest thing now", it is PR 1 below with C, and the row after.
2. **Whose news counts.** *Pick: your own bids, for everyone.* An office reader with none of
   their own gets a quiet grey pill, *Permit news · everyone's 5*, so the owner can still see
   the lot. The other way is that the office always counts everyone's.
3. **The three rules.** *Pick: all three.* The one to look at is *there before the bid*: a
   permit up to six months older than the bid becomes a quiet chip, and an older one is taken
   off the board. Six months is a guess from eight rows.
4. **What answers a line.** *Pick: Mark lost…, or Not this job by anyone on the bid, for
   everyone, with Undo.* The other way is that each person hides a line for themself, which
   leaves the next reader the same wrong line.
5. **The Dashboard line.** *Pick: not yet. Look again after two weeks of the row.*
6. **PR 1 first, on its own.** *Pick: yes.* It needs no new screen and it takes Wendy's line,
   and the wrong Mark lost… presses, off the strip the day it merges.

## Where it plugs in

| Piece | Today | Change |
|---|---|---|
| `src/lib/research/bidSite.ts` | `canonOfStreet` leaves the unit off both sides. `permitsOnSite` matches the street. | A pure `unitOf(address)` for the bid's line (*Ste 120*, *Suite 255*, *#101*, *Unit A*) and the feed's (*UNIT 300*, *STE 113*, San Antonio's *Unit No: 130* in the project line). `permitsOnSite` keeps a permit off a site when both name a unit and they differ. This also corrects **This site** in the bid's window, which reads the same function. |
| `src/lib/research/bidPermitNews.ts` | The four kinds, `NEWS_DAYS`, `markLost` | The bid's trade and start day join `NewsBid`. A fifth kind, `before`, for the quiet chip. The chip's words carry the name and the day. Each item says whether it is the reader's. |
| `src/hooks/useBidPermitNews.ts` | One read per city for the board | Unchanged. Followup's lens asks the same hook for its own bids. |
| `BidBoardPermitNews.tsx` | The strip | Retired in PR 2. Its line and its Mark lost… window move into a `BidPermitNewsWindow` that a row, a card and a Waiting to hear row all draw. |
| `PermitChip.tsx` | A label | A press when it has a window. |
| `BidsBidBoardTab.tsx` | Draws the strip, the chips | Draws the pill in the sections row and the window under a row. **PR #8883 is open on this file** (the phone's sideways scroll): PR 2 is cut after it merges. |
| `BidBoardNewsMarkLost.tsx`, `BidLostQuickPopover.tsx` | The outcome under a news line | Unchanged, drawn from the new window. |
| `BidsWaitingToHearLens.tsx`, `BidFormModal.tsx` | No permit news | The chip and window on a row, and one line above Win / Loss. |
| New table `bid_permit_answers` | — | Append only, as `builder_customer_answers` is: the bid, the permit's number, the answer (`not_this_job`, and its take-back), who, when. Read with the board's one read. RLS as the bid's own. |
| *Seen* | — | In the browser, as the look-alike count is (`lookAlikeCountMemory.ts`): the permit ids a person has opened. A phone and a desk each count once. No table. |
| Guide `see-what-the-city-has-on-a-bids-address` | *See permit news on the Bid Board* | Rewritten with each PR. |

## The plan, once the owner picks

Each PR ships with its release note, its fragment and the guide's change.

1. **The rules, and yours first (S).** `unitOf` and the suite rule in `bidSite.ts`. The trade
   rule and the *before* kind in `bidPermitNews.ts`. The strip, still where it is, lists the
   reader's own bids and folds everyone else's behind one line. No migration. Kernel tests on
   made-up rows for each of the eight shapes above.
2. **The row is the news (M).** The chip's new words. `BidPermitNewsWindow` under a desk row
   and inside a phone card. The pill and its filter. The strip is deleted. Render smokes for
   the row, the card, the pill with none, some and pressed.
3. **Not this job, and seen (M).** The migration (`SET lock_timeout`, the four fence calls,
   its doc), the read, the press with Undo, the line in This site, the count's memory.
   Pushed right after the merge.
4. **Where the outcome is decided (S).** Waiting to hear's row and the line above Win / Loss.
5. **The Dashboard line (S).** Only on a yes to call 5.

PR 3 is worth a second look after a week of PR 1 and 2. If the rules leave no wrong line
standing, Not this job has nothing to do and the table need not be built.

## How to verify

- **The kernel**: `npm test -- bidPermitNews bidSite`. Each rule has a case that drops a line and
  a case that keeps one, on made-up rows.
- **Live, read only**: the dev server, `/dev-login?as=1&to=/bids?tab=bid-board`, then Settings →
  *View as…* → Estimator. Count the pill against the kernel run in the page:
  `await import('/src/lib/research/bidPermitNews.ts')` with the board's bids and
  `loadPermitsByHouseNumber` per city. On 2026-11-19 that run gave 12 lines. After PR 1 the same
  run should give two *another name* lines on the Plumbing board, one quiet chip and three
  building lines.
- **Never press Mark lost… or Not this job on a real bid.** BP398 is the test bid. Read its
  address first: unless it sits in a city the pull reads, on a site with a permit, the window is
  proven by render smokes and by a made-up permit in the kernel's tests.
- **Widths**: 1,400 and 375, both themes. The Browser pane reads width 0 when hidden, so set
  the size first.

## Out of scope

- The 500 px map between the sections row and the first bid. It has its own Hide, and nobody
  asked.
- The Builders list's plumber across tenants, in the SQL reads. Seen by the Permits session on
  2026-11-19 and theirs to fix.
- The other strips above the board: the plans banner and *Your score*.
