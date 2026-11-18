---
name: "Lien desk To do: the band under the tiles, and where each press lives"
number: 383
group: gated
status: asked 2026-11-17 · read, measured on the real Board, drawn as three whole-page options and rendered the same day · the owner has not picked · nothing built
summary: >
  The owner boxed the band between the Board's four tiles and its two columns of bins: the sentence
  "Every bin." with its switch a page width away, and the two batch prints, one over each column. It
  draws the eye off the flow chart, its switch shows him nothing, and its buttons sit far apart on a
  computer. The mock-up draws today's desk and three whole-page answers for a dev, the office and the
  leader, at a computer's width and a phone's. A folds the band into the column headings. B puts every
  press in the bin it empties and gives signing a bin. C is B with the chart turned on its side.
next: The owner's pick of A, B or C. Then B's PR 1, the presses into their bins and the band gone, if B is the pick.
size: M for B as a train of three (S · M · S); A alone is S; C is L, B's three and one large redraw
blocker: The owner's pick.
opinion: build — B, since it removes the band and makes a bin's count and its press the same number
ver: v2.7311 · v2.7332 · v2.7334 · v2.7448 · v2.7470 · v2.7483 · v2.7490 · v2.7491 · v2.7497
---

# Lien desk To do: the band under the tiles (#383)

The mock-up is [mockup.html](mockup.html), served at `/to-dos/lien-desk-to-do-layout/mockup.html`. Its
picker switches between **A**, **B** and **C**, between **You (dev)**, **The office** and **The leader**,
and between light and dark. Each option stands beside Today, then at full size, then on a phone. Red dashed
lines mark the bottom of a 720 px window and of a 1,440 × 900 screen. A link can open on a drawing:
`#a-office`, `#b-leader-dark`, `#c-owner`. Adding `?solo=today`, `?solo=b` or `?solo=phone-opt` before the
`#` draws one screen alone. Made-up jobs, names and figures only.

It was rendered with Playwright at 1,440 and 1,280 px wide and at a phone's width, for all three viewers,
in light and in dark, before it was shown.

## The ask, in the owner's words

2026-11-17, with a screenshot of `/lien-desk` on To do and a red box around the band between the tiles
and the bins:

> on the lien desk I don't super love this section It seems to draw away from the flow chart And I can't
> think of any situation where someone would click only my bins instead of every bin. And know what is
> going on just because the buttons are so far apart on desktop. Could you holistically help me take a
> look at this page and help me come up with some GUI suggestions?

Earlier the same day: *"I don't like how these buttons and this title works"*, and whether the affidavit
print block *"may be redundant to the section below it"*. After the three options were shown: *"build
mockups"*. This card is those mock-ups saved.

## What the band is

Two rows of `LienBoard.tsx`, between `data-lien-board-tiles` and `data-lien-board-grid`.

- **The leader's row** (`data-lien-board-leader-bar`, v2.7334). The sentence *Every bin.* and the switch
  **Only my bins**. It draws only when the desk hands `leader`, which is a dev or a master technician
  (`isLienLeader`). The office never sees it.
- **The two prints** (`data-lien-board-prints`, v2.7470, moved here by v2.7483). Over the notices, *Print
  and mail N notices*, a line for what waits on the leader's signature with *See them* and *Remind*
  (v2.7491). Over the affidavits, *Print N for notarization*, a line for what is held, and a line for what
  prints with the stack and *Change*. The lien office sees them. The leader's own bins draw none.

## What the look found

Measured on the real `LienBoard` over `buildLienBoard`, on `origin/main` at `ecfae09523`, with made-up
jobs laid out as the owner's screenshot was and 149 px of nav and title bar above the Board (the frame's
top as v2.7367 measured it).

- **The band costs 126 px** between the tiles and the chart: the leader's row 251 to 276, the prints 288
  to 365, the first bin at 404.
- **The sentence and its switch sit 1,237 px apart** at 1,440 wide. The sentence is `flex: 1`, so it
  fills the row and pushes the switch to the far edge.
- **The two presses sit 561 px apart.** Each starts at the left edge of its own `1fr` column.
- **Only my bins shows a dev nothing.** A dev does not lead another master's job (`lienViewerLeadsJob`),
  so the press draws two empty bins and *Nothing waits on you*.
- **It is a master's default, and it can mislead him.** `lienBoardForLeader` keeps the two `awaiting`
  bins alone. An approved notice that waits on his signature stands in *Approved · to print*, which that
  view hides. On a day with notices to sign and nothing to approve, his Board reads *Nothing waits on
  you* over a dead **Approve**, under a tile that reads *7 waiting · 7 to sign*. His list still leads
  with *Only you can sign*.
- **In that view the Public jobs box is still drawn** (`underAffidavits`), between his bins and his press.
- **One fact, several numbers.** On the owner's screenshot the notices to print read 14 on the third
  tile, 8 on the bin and 1 on the press, then *1 notice* and *Print and mail 2* in the list. Signing has
  no bin, so nothing on screen says why 8 becomes 1.
- **The affidavit block repeats two bins.** *Print 1* is *Ready to file*'s count and *1 held* is the
  **Held** bin. Only the print setting is new.
- **Three totals, three rules.** The tab's count is the rows the viewer can move (`lienNextUpCount`).
  The first tile counts the papers due by the next due day. The list's head counts the papers due inside
  a week or past. Nothing on screen says so.

Where each bin's top edge falls today, as a dev:

| Window | Approved · to print | Approved · to mail | Ready to file | Filed · copies to mail |
|---|---|---|---|---|
| 1,440 × 900 | 661 | 747 | 747 | 833, its press at 927, under the fold |
| 1,280 × 720 | 661, cut at the fold | 747, under the fold | 747, under the fold | 833, under the fold |

## Why each piece is where it is

- **A print for each column** was the owner's *"Yes, build this"* of 2026-11-16 (v2.7470). He liked that
  notices stood on the left and liens on the right, as the chart does.
- **The prints moved under the tiles** (v2.7483) because at each column's foot they sat 780 and 890 px
  down a 768 px window. That was the foot, after the last bin. Inside the bin it empties, a press sits
  about 640 px down with the band gone.
- **The third tile only reads** while the notices' print is drawn, so the run has one door, not two.
- **The title bar's run door is retired** (v2.7490, *"Retire it everywhere"*).
- **A press inside a bin** already exists: *Mail N liens' copies* in *Filed · copies to mail* (v2.7497).
- ***An owner asked for records*** moved to the title bar's second row (v2.7311) when the title line was
  crowded. v2.7490 then took the run door, budgeted at 463 px, off that line.

## The three options

Where each press lands, from the top of the window. Today is the real Board. The options are the mock-up,
which draws today's Board within 9 px of the real one.

| | Notice print | Affidavit print | Board height |
|---|---|---|---|
| Today | 288 | 288 | about 1,080 |
| A | 254 | 254 | about 900 |
| B | 640 | 673 | about 800 |
| C | 324 | 525 | about 550 |

### A · Tightened

The same parts, with the band folded into the two column headings.

- Each print stands beside its column's name, in the short words the pinned find box already uses
  (`LienBoardPrintSide.short`).
- **Every bin / Only my bins** goes. The second tile is the one way to see what waits on the leader.
- **Remind** moves to the second tile.
- An empty bin is one quiet line. Both headings are grey, so red only means late.
- One PR, in `LienBoard.tsx` and the desk's wiring. No change to `lienBoard.ts` or its counts.
- It leaves the three numbers for the notices to print.

### B · Acts in the bins

Every press sits inside the bin it empties. Nothing stands between the tiles and the chart.

- **Signing gets a bin**, *Approved · to sign*, between *Awaiting Master approval* and *Approved · to
  print*. The print bin then holds exactly what the press takes.
- **The tiles are the doors.** The second shows what waits on the leader. The third opens the run again.
- **Each bin's press**: *Remind* in *Approved · to sign* (for the leader, *Sign N notices*), *Print and
  mail N* in *Approved · to print*, *Enter mail numbers · N* in *Approved · to mail*, *Send N for
  approval* in the affidavits' *To send*, *Print N for notarization* with its setting in *Ready to file*,
  and *Mail N liens' copies* where it is.
- A bin with something to do now has a blue edge. The blue border on the busiest bin goes.
- **Held** and **Missed** sit on the heading line, so every bin gets the column's full width.
- The Public jobs box folds to one line. *An owner asked for records* joins the tools row.
- At 1,280 × 720 both prints stay above the fold, the affidavits' by about 20 px. *Enter mail numbers*
  and *Mail N liens' copies* fall under 720 and above 900.

Three PRs:

1. **The presses into the bins** (S). `binPress` takes more keys, the band and the leader's row leave
   `LienBoard.tsx`, the third tile keeps its press, the pinned find box keeps its pair. No kernel change.
2. **The signing bin** (M). `LienBoardNoticeStage` gains `to_sign`, with its words, its arrow and its
   stages left. This changes what the third tile counts and which papers read as at risk, since an
   unsigned notice has two stages left where it had one. A GC's run row that holds signed and unsigned
   notices needs a rule for its bin (`lienBoardRowBin`).
3. **The leader's view by role** (S). `boardMine` and its switch go. The leader's *Approve N affidavits*
   moves into his *Awaiting* bin.

Risks: several blue presses on one screen where there were two, and the affidavits' print close to the
fold on a short window.

### C · Two lanes

B's bins with the chart turned on its side: notices on top, liens under, each step a column.

- The tiles, the whole chart and the first rows of the list share one 1,440 × 900 screen.
- The shared steps line up: To send, Awaiting, print, mail, done.
- It gives up notices on the left and liens on the right, which the owner approved, and the arrow from
  **Sent** to **Waiting on its notice**.
- At 1,280 wide a column holds two chips a row, and a busy bin grows tall.
- B's three PRs, then a redraw of `LienBoard.tsx`'s grid and its arrows (L).

## The rest of the page

Small things the look found. Each stands by itself, whichever option is picked.

- The red **Lien affidavits** heading is the only red on the Board that does not mean late.
- The blue border marks the busiest bin, not the most urgent one.
- The Retainage line under the notices has no door.
- A phone keeps its bins folded, so all three options draw one phone. The two stacked prints become one
  row there.
- The tab's count, the first tile's and the list's head could say their rule, like *26 of the 34 to do*.

## Related

- [`lien-to-do-one-run`](../lien-to-do-one-run/README.md) (#362) owns the run and the list under the
  Board. Its step 6 brings one print for both kinds, opened from the first tile. B's tiles as doors fit it.
- [`lien-gate-marks`](../lien-gate-marks.md) (#364) and
  [`lien-desk-on-a-phone`](../lien-desk-on-a-phone/README.md) (#352) touch the same screen.

## How to verify

- The Board alone: a throwaway page that mounts `LienBoard` over `buildLienBoard` with made-up entries,
  built with `vite build` and opened by Playwright through `page.route`, no server and no sign-in. Read
  each `[data-lien-board-bin]`'s top edge at 1,440 × 900 and 1,280 × 720.
- When built: `LienBoard.render.test.tsx`, `lienBoard.test.ts`, `LienDesk.render.test.tsx`, then the guide
  `read-the-board-on-the-lien-desk` and the Lien desk map, one sentence a line.

## Where it stands

Three options are drawn. The owner has not picked one. Nothing in the app changed. The live desk was not
opened: every figure here is from made-up jobs.
