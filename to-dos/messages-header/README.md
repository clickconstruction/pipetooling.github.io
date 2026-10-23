---
name: "Messages: a tighter top, with a jump strip like the Pipeline's"
number: 151
group: ready
status: the owner picked C on 2026-10-23; PR 1 (v2.5799, the strip under today's header) built; PR 2 (the one-row header, the search glass, the week behind 7 days) and PR 3 (the lanes' sentences behind one ?, the bands) next
summary: >
  The top of /messages is five rows of chrome before the first person: the title, the kind
  chips, Show, the search box and the week's four cards, then each lane's heading with a
  sentence under it. On a desktop that is 319px from the title to the New heading and 365px to
  the first person; on a phone 480px and 641px, so the first person is below the fold. The owner
  asked for a tighter top and a table of contents like the Pipeline's stage bar. Three mock-ups,
  each with the strip (New · Needs a reply · We owe them · Waiting on them · Went out, with their
  counts, pinned while the page scrolls, lit on the lane you are in, a press scrolling to the
  lane): A adds the strip and folds the week's cards to one line; B puts the title, the chips and
  the week on three short rows over the strip; C is one bar that holds everything.
next: PR 2, the one-row header on src/pages/Messages.tsx (the title in the bar, the kind picker, Mine · Everyone, the search glass, the strip in the row, 7 days opening the week's cards and kept per browser); then PR 3
size: A S · B M · C M
blocker: none
ver: proposed
opinion: build C — it is the Pipeline's own shape, it puts the first person on a phone's screen, and the two things it folds, the kind and the week's cards, each say what is behind them and stay open per browser
mockup: to-dos/messages-header/mockup.html
---

# Messages: a tighter top, with a jump strip like the Pipeline's (#151)

## The ask

The owner, 2026-10-23, with a screenshot of `/messages`:

> the header of messages could look tighter, can you make some mockups of better ways we could
> offer messages — New (3), Needs a reply (0), We owe them (1), Waiting on them (3), Went out (9)
> — could also have a table of contents at the top like in Jobs Pipeline.

The screenshot, top to bottom: **Messages**; the kind chips (All · Customers · Trade partners ·
Architects · Leads · Subs · Our team · Supply houses and candidates); *Show* with **Mine · 0** and
**Everyone · 4**; the search box; **The last 7 days** with its four cards; then the lanes, each a
heading with its count and a sentence of help. The lanes he lists are the five sections of the
page in order; the table of contents he means is the Pipeline's stage bar (`JobsStagesJumpStrip`
over `lib/jobs/stagesStageBar.ts`, v2.4512): one segment a section with its count, pinned at the
top while the board scrolls, the section being scrolled through lit in its color, a press
scrolling to its header.

## Today, measured

Read on the page as the dev on 2026-10-23, at 1280 wide and at the browser pane's phone preset
(375 wide). Heights are from the title's top.

| Piece | Desktop | Phone |
|---|---|---|
| The title | 30px | 30px |
| The kind chips | 29px, one row | 97px, three rows |
| Show · Mine · Everyone | 24px | 24px |
| The search box | 42px | 42px |
| The last 7 days, heading and four cards | 125px | 219px, two by two |
| The New heading's top | **319px** | **480px** |
| The first person's row | **365px** | **641px** |

The Pipeline's bar is 56px tall and its section bands 37px. A phone screen is about 812px tall
and the app's top bar takes 73px of it, so on a phone the first person starts under the fold.

## Options

All three are in `mockup.html`, each as a desktop frame (light) and a phone frame (dark), each
frame scrolling on its own so the strip can be seen to stick, light the lane you are in and jump
on a press. Every option has the same strip: five segments in the page's order, the count under
each name, **Needs you** joining only while it has rows (as Collections does on the Pipeline),
pinned under the top, lit on the lane being scrolled through. On a phone the strip is the shape
the queues fold already draws (`QUEUES_FOLD_WORDS.line`, v2.5708): name and count on one line,
wrapping to two, each a press.

The drawing's own numbers are from the title's top to the New heading, the same measure as
above; the drawing of today reads 313px and 492px, within 12px of the page.

### A · The strip, and the cards fold to a line

The smallest change. The title, the chips, Show and the search box stay as they are. The week's
four cards fold to one line of figures, each figure still a door to its rows, with the sub-lines
(*0 of 5 · ↓ from 50% last week*, *2 opened and quiet*) on the figure's hover; the line's name,
**The last 7 days ▸**, opens the four cards under it. The strip goes under that line. The lanes
keep their sentences.

- **Saves**: about 30px on a desktop (313 → 282) and 70px on a phone (492 → 424). The cards were
  125px and 219px; the line is one row and the strip 56px, so they nearly cancel.
- **Is this the best we can do?** No. It gives the table of contents and nothing else moves; four
  rows of chrome still stand over the strip. **Straightforward?** Yes: nothing goes behind a
  press but the four cards, and the line says what they say.

### B · Three short rows, then the strip

The title shares its row with a short search box (300px, the same placeholder). The kind chips
share theirs with Show, which moves to the right. The week is the one line of figures from A under
them. The strip sticks under that. Each lane's heading becomes a band in the lane's color with the
count in a pill, as the Pipeline's section headers are, and the lane's sentence sits behind a
small **?** on the heading: a press opens it under the name.

- **Saves**: about a third on a desktop (313 → 219; 242 at 1000 wide, where the figures line
  wraps) and a fifth on a phone (492 → 399), where the chips still wrap to three rows and the
  figures to four.
- **Is this the best we can do?** It is the honest middle. **Straightforward?** Yes: the chips
  stay in view, the figures stay in view, and only the four cards and the sentences go behind a
  press. The chips are the one piece left that wants room, and on a phone they take three rows.

### C · One row (recommended)

The Pipeline's shape pressed into one bar that sticks: **Messages**, a picker for the kind
(**All kinds ▾**, listing the eight chips), **Mine · 0 | Everyone · 4**, a search glass, the five
lanes with their counts, **7 days ▾** and one **?**. **7 days** opens the week's four cards under
the bar, and they stay open on your browser until you close them, kept per browser like Show. The
glass opens the search box under the bar. The **?** opens one card that says what each lane holds,
the five sentences. The lanes' headings are bands. From about 1000px wide the row holds
everything; narrower, the lanes take the bar's second line. On a phone the controls take two
short lines and scroll away, and the strip under them sticks on its own.

- **Saves**: nearly all of it: about 80px on a desktop, a quarter of today (120px under 1000
  wide), and about 175px on a phone, a third of today, so the first person is on the screen when
  the page opens.
- **Is this the best we can do?** Yes for the top. **Straightforward?** Two things go behind a
  press: the kind, whose picker still says which one is on, and the week's four cards, which open
  from **7 days** and stay open on your own browser, so the owner's screen can keep the week in
  view while the office's phones get the lanes first. The search goes behind a glass, which is
  where a rarely typed search belongs. Nothing is hidden that the bar does not name.

### Side by side

| | Today | A | B | C |
|---|---|---|---|---|
| The kind chips and Show | two rows | two rows | one row | a picker and a two-way switch on the bar |
| The search | a full-width box | a full-width box | a short box beside the title | a glass on the bar that opens the box |
| The last 7 days | a heading and four cards | one line of figures, the cards behind its name | one line of figures, the cards behind its name | the four cards behind 7 days, kept open per browser |
| The lanes' sentences | one under each heading | one under each heading | behind a ? on each heading | behind one ? on the bar |
| The strip | none | sticks under the figures | sticks under the figures | is the bar, and the whole bar sticks |
| Lane headings | plain | plain | bands in the lane's color | bands in the lane's color |
| Title to New, desktop | 319px | about 285px | about 220px | about 80px |
| Title to New, phone | 480px | about 425px | about 400px | about 175px |

## Decisions

1. **Which option** — **C**, the owner's pick on 2026-10-23: "Build option C from the Messages header
   mock-ups (to-dos/messages-header), the one-row top with the jump strip." Built as three PRs: the
   strip under today's header, then the one-row header, then the lanes' sentences and bands.
2. **The lanes' colors** — the strip's segments and the bands (B, C) take one color a lane: New
   blue (the *Who is this?* pill's), Needs a reply orange (the customer's, `CUSTOMER_BAR`), We
   owe them amber (our move), Waiting on them violet (their move), Went out green (a send's ✓).
   The drawing uses them; the owner may want other ones.
3. **The week's fold** — kept per browser (A and B open the cards from the line's name, C from
   **7 days**), starting closed. The owner could ask for it to start open for the owner and a dev
   and closed for the office; `isOwnerOrDev` already gates the switch card on the same page.
4. **The phone strip** — one wrapping line of name and count, as drawn, or a sideways scroll of
   the desktop segments. The line is the recommendation: the queues fold already speaks that way.
5. **Needs you** — joins the strip while it has rows, in its place after New, as Collections joins
   the Pipeline's bar while it has rows.

## Where it plugs in

- **The page**: `src/pages/Messages.tsx` draws the header block (the title, `KIND_PILLS`, the
  Show lens from `messages/showLens.ts`), the search box (`?q=`, `searchLines.ts`), `WeekStrip`
  (`messages/weekStrip.ts`, `STRIP_WORDS`) and the lanes in order; `scrollTo` there already
  targets `#queues`, `#waiting-on-them` and `#went-out`, the ids the strip's presses need.
- **The strip**: a `MessagesJumpStrip.tsx` beside `WeekStrip.tsx` over a pure
  `lib/messages/jumpStrip.ts` (the items in order, which lanes show, each lane's color and id),
  reusing `stagesActiveSection` from `lib/jobs/stagesStageBar.ts` for the lit lane and the
  `.stagesStageBar` rules in `src/index.css` with a `--lane-color`. Messages has no sticky tabs,
  so the bar pins at `top: 0`.
- **The counts**: New, Needs a reply and We owe them from the queue the page already hears
  through `FollowUpPanel`'s `onQueue` (`newLane.length`, `needsReply.length`,
  `weOwe.length + calls.length`); Waiting on them and Went out read their own rows
  (`WaitingOnThem`, `WentOutToday`), so each gains an `onCount` like `FollowUpPanel`'s.
- **The lane ids**: `FollowUpSections`'s `Section` takes an `id` for its three lanes (`new`,
  `needs-reply`, `we-owe-them`); the other two sections carry theirs already.
- **The bands** (B, C): `Section`'s header in `FollowUpSections.tsx`, `WaitingOnThem`'s and
  `WentOutToday`'s headings, with the `.stagesSectionBand` look and the count in a pill.
- **The week's fold** (all three): `WeekStrip.tsx` gains a folded form, one line of the four
  tiles' label and value with the sub-line on the hover, kept per browser the way `keepLens`
  keeps Show.
- **The picker** (C): `KIND_PILLS` as a menu, `?kind=` and `withPill` unchanged, so the
  Dashboard's Customers line still lands filtered.
- **The glass** (C): the same search input, shown on a press; `?q=` unchanged, and a URL with
  `?q=` opens with the box shown.
- **The ?** (B, C): the sentences already in `FollowUpSections.tsx`, `WAITING_WORDS.note` and
  `WENT_OUT_WORDS.note`.
- **Words and docs**: the guide `answer-everyone-waiting-on-us-from-one-page`, the page's row in
  `docs/MESSAGES_ARCHITECTURE.md`, the Messages entry in `docs/GLOSSARY.md`, §22 of
  `PROJECT_DOCUMENTATION.md`; a release note and a fragment per PR.

## How to verify

`/messages` as the dev: the strip is under the top and stays there while the page scrolls; the
lane being read is lit; a press on each segment lands its heading just under the bar; the counts
match the headings; on the phone preset the first person is on the screen when the page opens (C)
and the strip wraps to two lines at most. For a lane at zero the segment stays in place, greyed.

## Where it stands

| What | Version | PR | State |
|---|---|---|---|
| Proposal and mock-up | — | #6070 | merged 2026-10-23; the owner picked C the same day |
| PR 1 · the strip under today's header (`MessagesJumpStrip.tsx` over `lib/messages/jumpStrip.ts`, ids on the lanes, `onCount` on Waiting on them and Went out) | v2.5799 | | built 2026-10-23 |
| PR 2 · the one-row header: the title in the bar, the kind picker, Mine · Everyone, the search glass, the week behind 7 days kept per browser | | | next |
| PR 3 · the lanes' sentences behind one ? on the bar, the lane headings as bands with the count in a pill | | | after PR 2 |
