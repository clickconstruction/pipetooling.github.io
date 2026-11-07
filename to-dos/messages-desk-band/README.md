---
name: "Messages: a band on each New row says which desk finishes it, Dispatch or Estimating"
number: 258
group: ready
status: proposed 2026-11-04 from Grace's look at New on the Messages page · PR 1 built 2026-11-04 as v2.6507 (PR #7022) on the recommended defaults, merged · PR 2 built 2026-11-07 as v2.6616 (PR #7184) on call 3's recommendation, Needs a reply and the thread's folded sort card; the six calls stand on their defaults, each a line for Micah to change
summary: >
  New on Messages → Follow up draws every row the same way but for the color of the sort's
  question, so a customer asking for a visit and a trade partner sending a quote read alike until
  each is opened. The header already has two presses with fixed colors and icons, the bell on
  steel blue for Dispatch and the pencil and ruler on violet for Estimating. The ask: a band on
  the left edge of each row in the desk's color with its icon, so the eye sorts the lane before a
  finger does. One pure rule reads the desk off the facts the row already carries, the sort, the
  sender's kind, the jobs they are on, the box the line came in on, and guesses nothing from the
  words; a row it cannot place gets no band. The header's two pairs move into one kernel the band
  reads too, so the two cannot drift.
next: retire the card once #7184 merges and is walked; Micah's word on any of the six calls changes one line.
size: S (PR 1 the rule, the kernel the header and the band share, the band on New's rows, the guide) + S (PR 2 Needs a reply and the folded sort card, if wanted)
blocker: Nothing in the code. The calls below have recommendations; PR 1 takes them.
ver: v2.6507
opinion: build — the rule is five facts the lane already holds, the colors and icons exist, and the band costs the row nothing; what is new is one kernel and one strip
mockup: to-dos/messages-desk-band/mockup.html
---

# Messages: a band on each New row says which desk finishes it (#258)

## For Taunya

New on the Messages page holds what came in and still needs sorting. Today every row looks the
same except for the color of the question before the name: *Bid it?* in purple, the office's
three sorts in blue. This card adds a narrow band on the left edge of each row in the color of the
desk that will finish the work, with that desk's icon, the same color and icon as the header's
Dispatch and Estimating presses. A row the app cannot place yet, such as a sender nobody has named,
gets no band. The band is a reading, not a press: it changes nothing about who has the row or where
it goes.

## The ask, in Grace's words

Grace, 2026-11-04, with a screenshot of Messages → Follow up → New · 17 at desktop width and a
crop of the header's two inbox icons:

> When looking at this view I think that we should do a better job visually sorting items that
> need dispatch to complete from items that need estimating to complete. How could we add a banner
> to the left hand side that shows it as dispatch or estimating? Maybe we could re-purpose the
> colors and icons found in the header?

## What exists today

- **The New lane** (`src/lib/followUp/newLane.ts`, R7, v2.5394) is one row per person with the
  one sort they need: **Bid it?** (v2.6222), **Who is this?**, **Which job?**, **Who has it?**.
  Each row carries the sort, the sender's kind (`ContactKind`: customer, trade, arch, lead,
  supply_house, candidate, sub, team, unknown), the person's active jobs by key (`bid:`, `project:`,
  `pipeline:`), the box the line came in on (`team` or `bids`) and what the reader read from an
  invitation. `FollowUpSections.tsx`'s `NewRowView` draws it over the shared `Row`: the avatar,
  the question as a pill, the name, the address or number, the meta line, the Who has it pill,
  the subject.
- **The header's two presses** in `Layout.tsx`: Task Dispatch, the bell on the deep sky
  (`SKY_UNDER_WORDS`, `#0369a1`, white on it 5.93:1 since v2.6186) opening the Dispatch request
  window, and Ask estimating, the pencil and ruler on `#7c3aed` (white on it 5.7:1) opening the
  Estimator request window. Their SVG paths and fills are written twice each, once for the words
  pair and once for the icon pair, and nothing else reads them.
- **The seats** (`followUp/assignSeats.ts`): *Who gets a new message* seats a customer with the
  assistant and a trade partner or an architect with the estimator. The *Bid it?* row is the trade
  seat's (v2.6222, call 6 of #223). The app already knows which desk a kind belongs to; it just
  does not draw it.
- **Phone**: a row's name line wraps at 375 and the Who has it pill drops under it. The thread's
  sort card folds to one row on a short window (v2.6476).

## The rule

`src/lib/messages/rowDesk.ts`, pure, with its test. `rowDesk(row)` reads the row's facts in this
order and returns `'dispatch'`, `'estimating'` or null. It reads no words.

1. **Bid it?** is Estimating's, whoever sent it: an invitation to bid, an addendum, an agency's
   solicitation or a pre-bid notice, each with its own hover.
2. **Who is this?** is nobody's until sorted. So is one of our own team, a supply house and a
   candidate, whose lines are never either desk's work.
3. **A trade partner or an architect** is Estimating's: the seat rule puts them with the
   estimator, and what they write about is a bid, a quote or the plans.
4. **A customer, a lead or a sub** is placed by the jobs they are on: any Pipeline job is
   Dispatch's; only bids, Estimating's; only GC projects, nobody's here, since the GC desk is its
   own page. With no job under way the box says it: an email to bids@ is Estimating's, a line on
   the team number is Dispatch's, because the office's seat answers a customer there and books the
   visit.

The flow step a person stands at is not on the lane's row, so the rule does not read it. Call 6
names that as a later sharpening.

## The decision

- **The band.** A strip on the row's left edge, 22 px wide at a desk and 18 px on a phone, the
  row's own corner radius on its left, running the row's full height, in the desk's fill with the
  desk's icon small and white at its middle. No words on the row. Its hover and its label for a
  screen reader read the desk's word then why: *Estimating · An invitation to bid.* The row's
  padding moves right by the band's width; nothing else on the row moves. A row the rule cannot
  place keeps today's padding and no band.
- **One kernel for the header and the band.** `src/lib/messages/deskMarks.ts` holds the two
  pairs, the fill, the ink and the SVG path for Dispatch and for Estimating. `Layout.tsx`'s four
  presses read it, so a change to the header's color or icon is the band's change too, and
  `readablePairs.test.ts` holds white on both fills at 4.5:1 in both themes.
- **Lifted from the header, not restyled.** The fills are the header's literals, not theme
  tokens, so the band reads the same in light and dark as the header does.

## The critique

- **Does the lane get busier?** One more color per row, in a strip the eye reads as a margin.
  The chip alternative, a second pill beside the question, was drawn and set aside: two pills on
  the name line read as two presses, and the phone's name line already wraps at three things.
- **Does the band fight the sort's pill?** Both can be violet on a *Bid it?* row. That is the
  point: the pill says the question and the band says the desk, and on an invitation they agree.
  On a customer's *Who has it?* the pill stays blue and the band says Dispatch, which is what the
  lane could not say before.
- **Is the rule honest?** It reads five facts and no words. A customer who texts the team line to
  ask for a quote gets a Dispatch band, since nothing on the row says quote; the office reads the
  words and hands it on, as today. The band is right about where the line landed, not about what
  the person wants, and the hover says which fact placed it.
- **Why no band for Who is this?** The row already asks a question in blue; a grey band saying
  *Sort first* would say it twice. Once named, the kind places the row and the band appears.
- **What about Needs a reply?** The same `Row` draws its rows with the same facts, so the band
  is one line there. It is held for PR 2 so the owner sees New with it first and says whether the
  whole page should carry it.

## The calls

Each row holds the recommendation the mock-up draws. PR 1 takes it where the owner has not
answered.

| # | The call | Options | Recommended | Answer |
|---|---|---|---|---|
| 1 | Does the band also carry the lane the row will go to on Take it, the Dispatch inbox or the Estimator inbox? | The band is a reading only. Take it files the row into the desk's request inbox too. A press on the band files it. | A reading only. Take it still hands the thread to a person; the two request inboxes keep their own rows. A press that files a row is its own card, if asked. | |
| 2 | Does a Who is this? row get a band once sorted? | By the same rule once named. The card's guesses preview a desk. Never, the row leaves New. | By the same rule and nothing more: naming the sender gives the row a kind, and the kind places it. While the card asks who, no band. | |
| 3 | Does the same band belong on Needs a reply and Waiting on them rows? | New only. New and Needs a reply. Every lane. | Later, Needs a reply first, one PR, since its rows are the same Row with the same facts. Waiting on them is the other direction and its own shape; it waits for a look at New. | |
| 4 | What does a row the rule cannot place show? | Nothing. A grey band, *Sort first*. A dotted band. | Nothing. | |
| 5 | Should the top bar filter by desk, Dispatch · Estimating? | Not yet. Two pills in the bar. A count on the header's two presses. | Not yet. A pill pair joins the bar when New's count asks for it. | |
| 6 | Should the rule read the flow step a person stands at? | Not on the lane. A read of the step onto the row. | Later. The step is read on the thread, not the lane. A customer at Quoted is Estimating's whatever their job, which the lane cannot say today. | |

## Where it plugs in

- `src/lib/messages/rowDesk.ts` (new): the rule, `rowDesk`, `deskRead` with the why, `deskTitle`
  for the hover, `DESK_WORDS`. Test beside it.
- `src/lib/messages/deskMarks.ts` (new): `DESK_MARKS` with each desk's word, fill, ink and SVG
  path, lifted from `Layout.tsx`'s four presses, which read it from then on.
- `src/components/followUp/FollowUpSections.tsx`: `Row` takes a `band`; `NewRowView` passes the
  desk's. `DeskBand.tsx` beside it draws the strip.
- `src/lib/readablePairs.test.ts`: white on each desk's fill.
- Guide `sort-new-messages`: a short section, *The band on the left*.
- `docs/MESSAGES_ARCHITECTURE.md` → Follow up, the New lane's sentence; `docs/GLOSSARY.md`'s
  New entry.

## The plan

1. **PR 1, this card's defaults**: the rule and its test, the shared kernel with the header
   reading it, the band on New's rows with a render smoke at 1400 and 375, the readable pairs,
   the guide's section, the docs. Walked on the dev server as the dev on ZZ Test rows: an
   invitation to bid and a customer's text, deleted at the end.
2. **PR 2, if call 3 is a yes**: the band on Needs a reply's rows and on the thread's folded sort
   card.

## How to verify

- `npx vitest run src/lib/messages/rowDesk.test.ts src/lib/readablePairs.test.ts src/components/followUp/FollowUpSections.deskBand.render.test.tsx`.
- On the dev server as the dev, `/messages`: a *Bid it?* row wears the violet band with the
  pencil and ruler, a customer's *Who has it?* row the steel-blue band with the bell, a *Who is
  this?* row none. Hover a band: the desk's word, then why. The header's two presses match the
  bands. Resize to 375: the band narrows and runs the row's full height. Switch the theme: the
  fills hold.
- ZZ Test rows: a ZZ Test customer with a text in on the team line, and an email in to bids@
  whose subject reads *Invitation to Bid*, both deleted after the walk.

## Where it stands

Proposed 2026-11-04. **PR 1 built the same day as v2.6507 (PR #7022)** on the recommended defaults: `rowDesk.ts` (the rule, reading facts and never words), `deskMarks.ts` (the header's four presses and the band drawing from one record, `deskMarks.test.ts` refusing a literal written back), `DeskBand.tsx` over `Row`'s `band` (22 px at a desk, 18 on a phone, not a press), the guide's *The band on the left*, the Glossary's New entry and MESSAGES_ARCHITECTURE's New sentence. Walked on the worktree's dev server as the dev on `/messages`, read-only: the nine *Bid it?* rows wore the violet band with each hover naming its kind, the *Who is this?* rows none, the band 18 px at 375 and the fills kept in dark; no customer row was in New that day and the ZZ Test insert was refused by the auto-mode classifier, so the Dispatch band was seen in the render smoke alone. The calls wait on the owner's look at New with the band on; PR 2 (Needs a reply and the folded sort card) waits on call 3.
