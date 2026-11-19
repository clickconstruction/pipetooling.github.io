---
name: "Permit news on Followup: a red count of your own bids' new lines, each answered in one press"
number: 401
group: waiting
status: asked 2026-11-19 with a screenshot of the Bid Board · the live lines counted through the app's own kernel, read only · the board drawn as it is and five ways it could be · the owner then chose Followup with a red count, to verify or ignore · that direction drawn at a desk and a phone, in both themes, with a second look · the owner asked whether it was intuitive, easy and well structured, and a third look redrew the card · the owner said build it · PR 1 (the three rules, and the strip as the reader's own) shipped as v2.7923 · PR 2 (the answers table, its read and write, the sorting kernel) shipped as v2.7940 · PR 3 (the Permit news lens on Followup, the red count, the strip off the board) shipped as v2.7941 · PR 4 (the chip with the name and the day, a door on the board, the Call queue and Waiting to hear) shipped as v2.7942
summary: >
  An estimator asked for the strip Permit news on your bids to move lower on the Bid Board or
  onto Followup. The live lines say the place is the smaller problem: the strip lists every
  person's bids, five of its seven "another name" lines are about another suite, an older job
  or site work, and no line has been answered in nine days, because the only way out is to mark
  a bid lost. The owner chose Followup. The strip leaves the board. Followup gets a lens, Permit
  news, and a red count of the lines on your own bids that nobody has answered. Each card names
  its kind, the bid, what the city shows and the reasons it looks like that bid, and takes one
  press: on a plumber's permit We lost it…, Still waiting or Not our job, and on a building
  permit Got it or Not our job. Three rules in the kernel drop the lines the records can rule out before
  anyone is asked. An answered line rides as a chip on the bid wherever it is chased.
next: Two weeks of the lens, then weigh the Dashboard line. Two small things are left under The plan: a taken-off permit in the bid's This site list, and the bid's suite read from its project name.
size: M as a train of four (S · S · M · S), a fifth only if asked
blocker: Two weeks of answers on the lens, to read before the Dashboard line and the two leftovers are weighed.
ver: v2.6870 (the strip and the row's chip) · v2.6960 (Mark lost… on a line) · v2.7923 (the three rules, and the strip as the reader's own) · v2.7940 (the answers table and its kernel) · v2.7941 (the lens, the count, the strip gone) · v2.7942 (the chip as a door)
opinion: built — watch what gets answered for two weeks before adding to it
---

# Permit news on the bids (#401)

Two mock-ups. [`followup-mockup.html`](followup-mockup.html) is the direction the owner chose:
the board with the strip gone, Followup's Permit news lens, the two answers, a phone, where a bid
is chased, three places for it on Followup, a second look and the plan.
[`mockup.html`](mockup.html) is the first round: the board as it is, the estimator's two ideas, a
one-line fold and the row. Every bid, builder and plumber in both is made up. The mix of lines
matches what the live strip held on the day.

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

And after the first mock-up, the same day:

> I like the idea of the permit information being on the follow-up page with potentially an red
> numbered icon in on the follow up header title when new permanent information comes through for
> the estimator to verify or ignore. I think I want to build in this direction. Can you help me
> come up with a plan to build this? And a better mock up

And on reading that mock-up:

> I like your proposal for containing it on the follow-up. Is this the best we can do though? Are
> we making it intuitive yet easy? Are we structuring things visually well?

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

## The first round: six ways, each with what it gains and loses

All six are drawn in [`mockup.html`](mockup.html) at a desk and a phone, light and dark. The owner
read them and chose B, Followup, with a red count and two answers. The row was this card's first
pick. What it got right is kept: the three rules, the count as your own bids, a truthful way out
of a wrong line, and the chip where a bid is decided.

| | What it is | Gains | Loses | Size |
|---|---|---|---|---|
| **As it is** | The strip above the sections row | Nothing can be missed | 315 px, or 666 on a phone, before the first bid, every time | — |
| **A · Lower on the board** (her first idea) | The strip heads *Not yet won or lost* | Her working bids come straight up | That section starts about 2,500 px down at a desk. A real loss becomes news nobody scrolls to. Still everyone's, still stale. | XS |
| **B · A lens on Followup** (her second idea) | An eighth lens, *Permit news*, with a count on the tab | The board is clean, and Followup is where a bid is chased and marked lost | A second place to remember. A count that never moves. The unsent bid's line, hers, has nothing to do with following up. The row's chip stays mute. | M |
| **C · One line that opens** | The strip folded to its title and count | 315 px becomes 44, in an afternoon | A red 10 that never goes down is wallpaper in a week. Still a list away from the rows. | XS |
| **D · On the row, first draft** | No strip. The row's chip is the press and opens the line under the row, with **Not this job**. A count beside **Marked** narrows the board. | Read where the bid is. No height when there is no news. A wrong line has a way out. | She still clears ten lines by hand, nine not hers. The count is a sixth icon on a phone. | M |
| **The row, redrawn** | D after the second look, below | A board with nothing new for its reader shows nothing. Real news has a name and a day and is answered where it is read. | The largest build: five small PRs and one new table. News far down the board is found through the pill. | M as a train |

## The first round's second look

A second look at D against the ten real lines changed seven things. Points 1, 2 and 6 carry into
the Followup direction as they stand. Point 5, a count of what is unseen, is replaced there by a
count of what is unanswered.

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

## The direction: Followup, with a red count to answer

Drawn in [`followup-mockup.html`](followup-mockup.html).

- **The Bid Board** has no strip. A row keeps its chip, with the name and the day on it
  (*Permit lists Copperline Plumbing · Aug 27*), and the chip is a door to its line on Followup.
  The grey chip of a permit that was there before the bid is a note, not a door.
- **The red count** rides on **Followup** in the Bids tab row, on every Bids tab, the way the
  pending audits ride on Robots. It counts the lines on your own bids that nobody has answered.
  With none it is not drawn.
- **Followup → Permit news** is an eighth lens, last in the bar, with the same count. It lists
  what is new on your bids, a plumber under another name first. **Yours** and **Everyone's**
  switch whose bids are listed. The count is always yours.
- **The red number is its own press** and opens the lens from any Bids tab. The word Followup
  still opens the Call queue.
- **A card** reads top to bottom in the order an estimator thinks. What kind of news it is, as a
  coloured tag (*Another plumber on the permit*, *Building permit issued*, *Application filed*).
  Which bid, its number a door to the bid. What the city shows, as the one large sentence. The
  work in the city's own words and the permit's number. Then why it looks like this bid, each
  reason with a tick and each thing the records do not say with a question mark: the suite, the
  days since the bid was sent, the GC on the building permit, the project line. All of it comes
  from the board's one read (`SitePermitRow`) and kernels that exist (`unitsOf`,
  `looksLikeThisJob`, `builderKeyOf`).
- **The answers stand in one column** on the right of every card, under the question they
  answer, and at the foot of the card on a phone.
  - A plumber's permit on a sent bid asks **Did we lose this bid?** **We lost it…** opens the
    board's own loss window across the card, with the winner filled in from the permit. **Still
    waiting** keeps the permit on the bid as a chip and marks nothing. **Not our job** takes the
    permit off the bid for everyone.
  - A building permit or an application is not a question. It takes **Got it** or **Not our
    job**, and a building permit points at the builder's place in the Call queue.
  - A bid not sent yet never offers a loss.
- **An answered card folds to one line with Undo** where it stood. A permit taken off stays in
  the bid's This site list with who said so.
- **Answered on your bids** sits under the new lines: what was answered on bids not yet won or
  lost, each with **Take back** or **Put back**.
- **Where a bid is chased**, the chip rides on the bid: a builder's card in the Call queue, a
  Waiting to hear row, the board's row.

### The second look

A second look at the first draft of that page changed eight things.

1. **"Verify" left the hard line hanging.** Saying a plumber's permit is on our job answers
   nothing by itself. The third look made the loss one of the card's own answers.
2. **The proof is on the line.** The first draft sent her to the bid's window to check a suite.
3. **The count is what is unanswered, not what is unseen.** A count that drops when a lens is
   opened teaches people to open and leave. An answer is one press, so the count can wait for
   it. It is the same on a phone and a desk, and one answer clears it for everyone on the bid.
   This replaces the browser's *seen* memory of the first round, and makes the answers table
   part of the lens, not a later PR.
4. **The words are the answer to a question.** *Verify* and *Ignore* say what to do with the
   line. The presses say what is true of the bid, which is what gets written down. The third
   look, below, chose the words.
5. **Followup does not open on the lens.** Robots opens on Audits when audits wait. Here a line
   kept for later would cost a press on every visit, which is the complaint that started this.
6. **The three rules go first.** Without them five of the ten live lines are about another
   suite, an older job or another trade, and she would press Not our job five times on day one.
7. **A bid not sent yet stays in the list.** It carries *Not sent yet* and never offers Mark
   lost….
8. **An answered line is still on the bid**, as the chip, for the person about to call.

### The third look: intuitive, easy, well structured?

Asked by the owner of the page above. The first draft worked, but it made her do the reading.

1. **It asked a clerk's question.** *Whose permit is this* is the app's problem. Hers is whether
   the bid is lost. The card now asks that.
2. **A plumber's permit took two steps.** Say it is the job, then say what that means. Now one
   press of three.
3. **The proof was a grey box of four labelled rows**, all one weight, to compare by eye. Now the
   app compares and shows what matched as ticks, and says what it could not tell.
4. **Nothing said what kind of news a card was** until its sentence was read. Now a coloured tag
   leads each card.
5. **The presses sat at a different height on every card.** Now they are one column, so a list
   is worked down its right edge.
6. **The count was two presses away.** Now the red number opens the lens.

At a desk's width the card is 162 px tall with its reasons on it. The first draft's was 247.

One thing this costs: the two answers the owner named, verify and ignore, are now three on a
plumber's permit. *Still waiting* and *We lost it…* are both a verify. The store keeps two
(`this_job`, `not_this_job`), and a loss is the bid's own outcome, as it is today.

### Three places for it on Followup

| | What it is | Gains | Loses |
|---|---|---|---|
| **A · Its own lens** | *Permit news*, last in the bar | One home for new and answered lines. Nothing is put in front of the Call queue. | An eighth pill in a bar that already wraps on a phone. One press to reach the news. |
| **B · A band on the Call queue** | The lines above the builders, gone when answered | No new lens and no press to reach it | It is the strip again, one tab over. A line she is not ready to answer sits above her calls every time. |
| **C · A lens Followup opens on** | A, and entering Followup lands on it while a count waits | The news cannot be missed. Robots works this way. | A line left for later costs a press on every visit. |

## The calls, each with a pick

1. **The place on Followup.** A, B or C above. *Pick: A.*
2. **The words on the presses.** *Pick: the card's own question and its answers (We lost it…,
   Still waiting, Not our job; Got it, Not our job).* The other way is one pair on every card,
   Verify and Ignore in the owner's words, with the loss as a second step.
3. **Whose answer counts.** *Pick: one answer, by anyone who can open the bid, for everyone.*
   The other way is that each person answers for themself, which leaves the next reader the same
   line.
4. **Whose news the red count is.** *Pick: your own bids, for everyone.* The office reads the
   rest through **Everyone's**, and its answers count.
5. **The three rules.** *Pick: all three.* The one to look at is *there before the bid*: a
   permit up to six months older than the bid becomes a grey note, and an older one is taken off
   the board. Six months is a guess from eight rows.
6. **PR 1 now.** *Pick: yes.* It is written and tested, it needs no migration, and it takes the
   wrong lines and the wrong Mark lost… presses off the strip the day it merges.

A Dashboard Needs you line stays as it was weighed: not yet, and a look after two weeks of the
lens.

## Where it plugs in

| Piece | Today | Change |
|---|---|---|
| `src/lib/research/bidSite.ts` | `canonOfStreet` leaves the unit off both sides. `permitsOnSite` matches the street. | **PR 1, written.** `unitsOf(line)` reads a suite from a bid's line (*Suite 255*, *#4*, *Unit A*) and from a feed's (*UNIT 143*, *STE 113*, San Antonio's *Unit No: 130* in the project line; *N/A* and a floor name none). `permitsOnSite` leaves a permit out when both name a suite and they share none. `permitsOnOtherUnits` is what was left out. This also corrects **This site**, the GC's panel and the name finder, which read the same function. |
| `src/lib/research/bidPermitNews.ts` | The four kinds, `NEWS_DAYS`, `markLost` | **PR 1, written.** The bid's start day and trade join `NewsBid`. A plumbing permit dated before the bid was started is a grey chip for `BEFORE_BID_DAYS` (183) and nothing after. A plumbing permit is read on a plumbing bid only. `newsForReader` splits the lines into the reader's and the rest. **PR 2:** each item carries its permit, and a kernel sorts a reader's lines into new, answered and taken off. |
| `src/hooks/useBidPermitNews.ts` | One read per city, run by the Bid Board | **PR 3.** Run by the Bids page, so the count is there on every Bids tab and the lens reads the same answer. |
| `BidBoardPermitNews.tsx` | The strip | **PR 1, written:** lists the reader's own lines, and folds the rest behind one quiet line that only the office sees alone. **PR 3:** retired. Its line and its Mark lost… window move into the lens. |
| `src/lib/bids/bidsLenses.ts`, `BidsLensBar.tsx`, `bidsTabAccess.ts` | Seven Followup lenses, badge tones `new`, `count`, `dev` | **PR 3.** An eighth lens, `permit-news`, with a red badge tone. |
| `src/pages/Bids.tsx` | The Followup tab is a plain button | **PR 3.** The red inbox pill beside it, as Robots has for audits. |
| New `BidsPermitNewsLens.tsx` | — | **PR 3.** The lens: the cards with their reasons and answers, the loss window in the card, the one-line receipt with Undo, Answered on your bids, the empty state. |
| `BidBoardNewsMarkLost.tsx`, `BidLostQuickPopover.tsx` | The outcome under a news line | Unchanged, drawn from the lens. |
| Table `bid_permit_answers` | — | **PR 2, shipped.** Append only, as `builder_customer_answers` is: the bid, the city, the permit's number and type, the answer (`this_job`, `not_this_job`, `taken_back`), who, when. The newest row per bid and permit stands. Read and insert for the people who read permits. Read beside the board's one read. |
| `PermitChip.tsx`, `BidsCallQueueTab.tsx`, `BidsWaitingToHearLens.tsx`, `BidsBidBoardTab.tsx` | A label on the board's row | **PR 4.** The chip's words carry the name and the day. It is a door to the line on Followup, and it rides on the bid in the Call queue and on a Waiting to hear row. |
| `BidSitePermits.tsx` | Every permit on the street number | **PR 4.** A permit taken off the bid says so, with who and when. A line says how many permits on the address are on another suite. |
| Guide `see-what-the-city-has-on-a-bids-address` | *See permit news on the Bid Board* | Rewritten with each PR. |

## The plan

Each PR ships with its release note, its fragment and the guide's change.

1. **The rules, and yours first (S). Shipped, v2.7923.** The three rules in the kernel, with a
   case for each of the eight live shapes. The strip, still on the board, lists the reader's own
   lines. **This site** says how many permits on another suite it left out. No migration.
2. **The answers (S). Shipped, v2.7940.** The migration `20261119130000_bid_permit_answers`, the
   read, the write, the fold (`foldPermitAnswers`) and the inbox for one reader (`permitInbox`).
   No screen.
3. **The lens and the count (M). Shipped, v2.7941.** Followup → Permit news, the red count on Followup as its own
   press, the answers with Undo, the loss window in the card. The card's words and reasons
   are `permitNewsCard`, with a test for each tick and each question mark. The strip leaves the Bid Board. Render smokes for the
   lens with none, some and answered, and for the count on the tab row.
4. **Where a bid is chased (S). Shipped, v2.7942.** The chip with the name and the day, as a
   door on the board's row, on the Call queue and on Waiting to hear.
5. **The Dashboard line (S).** Only if asked for after two weeks of the lens.

Left over, each a small PR of its own:

- **A taken-off permit in This site.** The list in the bid's window reads the address alone. It
  needs the bid's id to say *Taken off this bid by Priya, Nov 14* with **Put back**.
- **The bid's suite from its project name.** A bid named *Suite 100, Tradewind Drive* with no
  suite in its address still gets a card for a permit on suite 120. One live card on 2026-11-19
  was of this kind. Read the words *suite*, *ste* and *unit* from the name, never a bare number
  sign, since *Market #12* is a store.

## How to verify

- **The kernel**: `npm test -- bidPermitNews bidSite`. Each rule has a case that drops a line and
  a case that keeps one, on made-up rows.
- **Live, read only**: the dev server, `/dev-login?as=1&to=/bids?tab=bid-board`, then Settings →
  *View as…* → Estimator. Count the red number against the kernel run in the page:
  `await import('/src/lib/research/bidPermitNews.ts')` with the board's bids and
  `loadPermitsByHouseNumber` per city. On 2026-11-19 that run gave 12 lines. After PR 1 the same
  run should give two *another name* lines on the Plumbing board, one quiet chip and three
  building lines.
- **Never press an answer on a real bid.** BP398 is the test bid. Read its
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
