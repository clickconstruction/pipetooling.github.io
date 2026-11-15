---
name: "Lien desk gate marks: the spike's record and what it left"
number: 364
group: residual
status: spike 2026-11-15 · shape G shipped v2.7335 the same day · left: a row press that lands on its open gate
summary: >
  The owner asked on 2026-11-15 whether the affidavit pane's five gates should show on each row of the
  Lien affidavits list. A design spike measured eight shapes, and shape G shipped the same day: five small
  marks after the row's last work month, in the pane's order, on the two piles where a hold is still
  possible. This card is the way back to the spike's note, its measurements and its flags, and it holds the
  one piece the spike left for later.
next: Decide whether a press on a row with a hold should bring the pane's first open gate into view. If yes, build it as one small PR.
size: S (one PR)
blocker: None. The pane's gate rows became presses in v2.7313.
mockup: not required — the marks shipped in v2.7335, and the piece left changes only where a press lands
opinion: your call — the marks already name the gate on a computer, so the saving is a scroll in the pane, mostly on a phone
ver: v2.7313 · 7335
---

# Lien desk gate marks: the spike's record and what it left (#364)

## The ask

The owner, on 2026-11-15, through the Lien desk session: should the affidavit pane's five gates (owner, legal
description, the GC's address, the § 53.056 notice, homestead) show on each row of the Lien affidavits list, so a
row's holds read without opening it?

## What shipped

v2.7335 (#8197) is the spike's shape G. Each row of *Needs the property facts* and *To draft* carries five 9 px marks
after *last work*, in the pane's order. Green is a clear gate, a red ✕ a hold, and a hollow dot a gate the job is not
asked: a job contracted with the owner has no GC and no notice. Hovering a mark names the gate and what is missing. On
a computer the marks stand in for the row's *missing …* words; on a phone the words stay. Rows past *To draft* carry
no marks. The files and the measurements are in `docs/recent-features/v2.7335.md`.

## The spike's record

- **The note and the prototype** are on the branch `claude/lien-gate-marks-spike-f50766` on GitHub. It was never
  merged and is not meant to be. The note is `docs/spikes/lien-gate-marks.md` on that branch: the eight shapes, each
  measured at 1400 wide and at 375, what each costs, and why G. The prototype draws any shape from localStorage
  flags: `gateMarks=open|all`, `gateWords=fold`, `gatePlace=inline` and `gatePhone=words`. To see one, check the
  branch out, run its dev server, set the flags in the browser console and reload the Lien desk's affidavits tab. The
  code on `main` is the one to build on.
- **The screenshots are not on GitHub.** They show live jobs, their GCs and their amounts, and the repo is public
  (`AGENTS.md`, rule 12). They are on the local branch `claude/lien-gate-marks-spike-shots` on the Mac that ran the
  spike. Never push that branch, and never copy its pictures into the repo, a PR or a card. Take any picture you need
  again on test data.

## Decided

- **G over F.** F draws the marks only on a row with a hold. G draws them on every row of the two early piles, so the
  slots sit in the same place on every row and the eye learns them. F stays the fallback if five greens on a ready
  row read as noise; on the spike branch its flags are `gateMarks=open`, `gatePlace=inline` and `gateWords=fold`.
- **Inline, not on a line of their own.** A line of its own cost 14 px a row. Inline after *last work* cost nothing at
  1400 or at 375.
- **The hollow dot.** A job contracted with the owner draws its GC and notice slots hollow, since nobody passed those
  gates.
- **The strip is not a press.** The row is a button, and a button cannot hold another. The pane is where a gate opens.

## Left: a row press that lands on its open gate (S)

The spike's note named it: on a phone, a tap could open the pane at the gate the row is held on. Since v2.7313 every
row of the pane's gate list is a press that opens its record, so from that row the record is one press away.

Today a press on a list row selects the job and, on a phone, swaps the list for the pane (`setAffSelectedJobId` and
`setMobileListShown(false)` on the row in `LienDesk.tsx`). Nothing brings the pane's gate list into view; only the
tests read `data-lien-gate-row`.

The piece: when the pressed row has an open gate, bring the pane's first open gate row into view and focus it, so the
next press opens the record. A row with every gate clear opens as it does now. The desk already has
`scrollPaneTo(selector)`, and each gate row carries `data-lien-gate-row=<key>`, with `data-lien-gate-ok="no"` when it
holds. A gate row with no door is a disabled button and cannot take focus, so that one is only brought into view. One
render test: press a held row, and focus lands on that gate's row.

The owner's call first: on a computer the pane sits beside the list, so the scroll may not be wanted there.

## Where it plugs in

- `src/lib/jobs/lienGateMarks.ts`: the marks, the summary words, and `lienGateRowParts` (which piles carry the
  marks, and the words on a phone).
- `src/components/jobs/LienGateMarkStrip.tsx`: the drawing.
- `src/components/jobs/LienDesk.tsx`: the affidavit list row, its press and `scrollPaneTo`.
- `src/components/jobs/LienDeskAffidavitPane.tsx` and `src/lib/jobs/lienGateRow.ts`: the pane's gate rows (v2.7313).
- `useIsMobile()` is the phone test, 640 px wide or less.

## How to verify

- `npx vitest run src/lib/jobs/lienGateMarks.test.ts src/components/jobs/LienDesk.render.test.tsx`
- On the dev server (it needs the main checkout's `.env.local`), sign in at `/dev-login?as=1`, then open
  `/lien-desk?tab=affidavits` and read the marks in *Needs the property facts*. For a phone, set the browser pane to
  375 wide and reload. The dev sign-in is the dev account on the live database: read only, press nothing that writes,
  and keep any screenshot out of the repo.
