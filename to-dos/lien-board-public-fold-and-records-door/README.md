---
name: "Lien desk To do: fold the Public jobs box, and put the records door on the tools row"
number: 390
group: ready
status: drawn 2026-11-17 in #383's option B · saved as a card the same day · the two choices of part 2 drawn for the owner · his answer on By paper not given yet · nothing built
summary: >
  The last two parts of the drawing the owner picked for the Lien desk's To do page (#383, option B). The
  Public jobs box under the lien affidavits is as tall as its rows, 244 px with two jobs, and the drawing
  folds it to one line with a press that opens it. The press An owner asked for records sits alone on a
  second line of the title bar, and the drawing puts it on the tools row beside § Rules where the line has
  room. The rest of option B is built in PR #8628.
next: Build after PR #8628 merges. Part 1 first, the fold. Then part 2, the door, which needs one answer from the owner on By paper.
size: S (two small PRs, or one)
blocker: PR #8628 on main first, since both parts touch the desk it changes.
opinion: build — part 1 gives back about 200 px under the chart, and part 2 a whole line over it
ver: v2.7277 · v2.7311 · v2.7443 · v2.7490 · v2.7526
---

# Lien desk To do: fold the Public jobs box, and put the records door on the tools row (#390)

The mock-up is [mockup.html](mockup.html), served at
`/to-dos/lien-board-public-fold-and-records-door/mockup.html`. It was drawn on 2026-11-17 when the owner
asked to see the two choices of part 2 before deciding. Each title bar is drawn to scale from the widths
`lienDeskTitleBar.ts` measured on the live desk, and its lines come from the desk's own two rules restated.
The picker switches the window between 1,440 and 1,280 wide, and to dark. `#1280` and `#1440-dark` open on
a state. Part 1's fold is drawn under it, closed and open. Made-up counts, jobs, names and figures only.

Both parts were first drawn in [#383's mock-up](../lien-desk-to-do-layout/mockup.html), option B.

## The ask, in the owner's words

2026-11-17, on the Lien desk's To do page, after three whole-page options were drawn
([`lien-desk-to-do-layout`](../lien-desk-to-do-layout/README.md), #383):

> Build B but with the action button in the same line as the title of the card it is in instead of at
> the bottom.

B was built that day in PR #8628, except these two parts. Then:

> Save these last two fixes as a punch list card for another session to build instead

## Part 1 · The Public jobs box folds to one line

### Today

`LienPublicBinView` in [`LienPublicBoardParts.tsx`](../../src/components/jobs/LienPublicBoardParts.tsx) draws
the bin *Public jobs · bond claim* (v2.7443, Taunya's ask of 2026-11-16): a header with the title, the
money and the count, then a row a job, then *Put a job back on the lien path…*. `LienDesk.tsx` hands it to
the Board as `underAffidavits`, with `LienOffPathBinView`
([`LienOffPathBoardParts.tsx`](../../src/components/jobs/LienOffPathBoardParts.tsx), v2.7526) under it when a
job is off the lien path. With two jobs the box is 244 px tall, as on the owner's screenshot. It stands
under **Served**, between the chart and the find box.

### The drawing

One line: *Public jobs · bond claim*, then *2 jobs · $9,400 unpaid*, then **Show ▾** at the right. A press
opens the box as it is today, and **Hide ▴** folds it again.

### What to build

- A fold in `LienPublicBinView`: closed by default, session-only state, the header as the press. Open, the
  box is today's box unchanged.
- The same fold in `LienOffPathBinView`. The two have one shape, and one folded beside one open would
  read as a mistake.
- **Keep what needs a person on the folded line.** A row whose bond nobody knows carries the chip *get
  the bond* (`buildLienPublicBin` in [`lienPublicProperty.ts`](../../src/lib/jobs/lienPublicProperty.ts),
  `chip`). Folded, that chip is hidden. So the folded line should count them, like *1 to get the bond*,
  in the chip's amber. This is the builder session's recommendation, not something the owner asked for.
  Put the words in the kernel beside `totalWords`, with a test.
- A phone keeps its bins behind **Show the bins**, and both boxes are inside that fold. Give them the same
  fold there.
- `aria-expanded` on the press, and a 44 px press on a phone.

### Files

- `src/components/jobs/LienPublicBoardParts.tsx`, `LienOffPathBoardParts.tsx`
- `src/lib/jobs/lienPublicProperty.ts` and `lienOffPathBin.ts`, for the folded line's words
- Tests: `lienPublicProperty.test.ts`, `lienOffPathBin.test.ts`, and the public property and off the
  lien path cases in `LienDesk.render.test.tsx`, which read `[data-lien-public-bin-row]` and
  `[data-lien-off-path-bin-row]` and now need the box opened first
- Guides: `read-the-board-on-the-lien-desk` (*Public property*, *A job that is off the lien path*) and
  `take-a-job-off-the-lien-path`

## Part 2 · An owner asked for records joins the tools row

### Today

On a computer the title bar is two lines on every view. The first holds the way back, the four views and
four tools: **§ Rules**, ☎, **?** and **Share**. The second holds *An owner asked for records ›* alone at
the right, under **Share**. On By paper the second line also holds the paper tabs, the piles and *Put a
GC on notice…*.

The rule is `lienDeskTitleBarLayout` in [`lienDeskTitleBar.ts`](../../src/lib/jobs/lienDeskTitleBar.ts). Its
branch for a desk with the door reads `{ tools: 'title_line', door: 'second_line', breakLine: true }`
whatever the measured line has room for.

### Why the door is there, and why the reason lapsed

- v2.7277 put the door under the four presses when the title line had room for the presses and not the
  door too.
- **v2.7311 was the owner's own ask of 2026-11-15**, from a screenshot of By paper: the door crowded the
  title line's right end while the pile line ended with nothing. Since then the door ends the second line
  on every view.
- On that day the title line also held the run's door, up to 463 px wide. **v2.7490 retired it** on the
  owner's call of 2026-11-16, and the line is that much shorter on every view.

The title line with all five tools needs 1,038 px of window by the file's own measured parts
(`LIEN_DESK_TITLE_LINE_PARTS`: 98 + 383 + 440, two gaps of 14.4, 88 of chrome). So it fits at 1,280 and at
1,440.

### What to build

- In `lienDeskTitleBarLayout`, when the measured fit is `all`, draw the door with the tools on the title
  line. Off By paper the bar is then one line, and To do's Board starts about 30 px higher. When the fit is
  `presses`, keep today's shape: the presses up, the door under them.
- The measuring is already there. `lienDeskTitleLineFit` answers `all`, `presses` or `none`, and
  `readLienDeskTitleLine` reads the door's width wherever it sits.
- Rewrite the file's header comment for the new rule, as an amendment. The history stays.

### The one answer the owner owes

**By paper.** Its second line is there anyway, for the paper tabs and the piles. Two ways:

1. **The door on the title line on every view where it fits.** This keeps the file's standing rule that
   the tools never change lines between To do, By date, By paper and By job. It also puts the door back
   where the owner's v2.7311 screenshot had it, on a line that is now 463 px shorter. Recommended.
2. **The door on the title line off By paper, and at the second line's right on By paper**, beside *Put a
   GC on notice…*. This keeps v2.7311 on the view it was asked for, and the door then moves when the view
   changes.

What the mock-up found, by the rule's own numbers:

| Lines in the title bar | To do · 1,440 | To do · 1,280 | By paper · 1,440 | By paper · 1,280 |
|---|---|---|---|---|
| Today | 2 | 2 | 2 | 3 |
| Choice 1 | 1 | 1 | 2 | 2 |
| Choice 2 | 1 | 1 | 2 | 3 |

By paper is drawn on Lien affidavits, the widest line the desk draws. At 1,280 wide its second line cannot
hold the piles beside *Put a GC on notice…* and the door, so the two fall under the piles as a third line.
With the door on the title line, *Put a GC on notice…* alone fits beside the piles.

Ask before building part 2. Part 1 needs no answer.

### Files

- `src/lib/jobs/lienDeskTitleBar.ts` and `lienDeskTitleBar.test.ts`
- `src/components/jobs/LienDesk.tsx`, where `ownerRecordsDoor` and the title bar are drawn, and
  `useLienDeskTitleBarFit.ts` only if what it watches changes
- The title bar cases in `LienDesk.render.test.tsx`
- `docs/LIEN_DESK_ARCHITECTURE.md`, one sentence a line

## How to verify

- **The Board alone.** A throwaway page that mounts `LienBoard` over `buildLienBoard` with made-up
  entries and a real `LienPublicBinView` as `underAffidavits`, built with `vite build` and opened by
  Playwright through `page.route`, with no server and no sign-in. #383's card has the recipe and its
  numbers. Measure the Board's height with the box folded and open, at 1,440 × 900 and 1,280 × 720.
- **The title bar** is measured from the bar it drew, so it needs the desk itself. Walk it on the live
  desk as a dev after the merge, at 1,440 and 1,280 wide and at a width under 1,038, on To do and on By
  paper. Read where the door sits and whether the bar is one line.
- Made-up jobs, names and figures only in anything saved to the repo. It is public.

## Related

- [`lien-desk-to-do-layout`](../lien-desk-to-do-layout/README.md) (#383) is the look, the three options and
  what shipped of B.
- [`lien-to-do-one-run`](../lien-to-do-one-run/README.md) (#362) owns the run and the list under the Board.
- [`lien-desk-on-a-phone`](../lien-desk-on-a-phone/README.md) (#352) owns the phone's More, where the records
  door is a row and does not change.

## Where it stands

Nothing is built. Both parts are drawn. Part 1 can start once PR #8628 is on main. Part 2 waits on the
owner's answer for By paper.
