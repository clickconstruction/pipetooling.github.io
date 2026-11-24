---
name: "Lien desk gate marks: the spike's record and what it left"
number: 364
group: residual
status: spike 2026-11-15 · shape G shipped v2.7335 the same day · the row press that lands on its open gate built v2.8472 · walked live 2026-11-24, Safari's ring mended v2.8509 · left: a look on a real phone
summary: >
  The owner asked on 2026-11-15 whether the affidavit pane's five gates should show on each row of the
  Lien affidavits list. A design spike measured eight shapes, and shape G shipped the same day: five small
  marks after the row's last work month, in the pane's order, on the two piles where a hold is still
  possible. This card is the way back to the spike's note, its measurements and its flags. The one piece the
  spike left, a row press that lands on its open gate, is built in v2.8472.
next: Once v2.8509 is live, press a held row on the Lien affidavits list on a real iPhone, and say whether the landing reads right and the gate shows no blue ring. Then this card can go.
size: S (a look, no build)
blocker: v2.8509 has to be live first.
mockup: not required — the marks shipped in v2.7335, and the piece left changes only where a press lands
opinion: look at it on a phone first — that is where the gates open a whole screen under the job's path
ver: v2.7313 · 7335 · 8472 · 8509
---

# Lien desk gate marks: the spike's record and what it left (#364)

## The ask

The owner, on 2026-11-15, through the Lien desk session: should the affidavit pane's five gates (owner, legal
description, the GC's address, the § 53.056 notice, homestead) show on each row of the Lien affidavits list, so a
row's holds read without opening it?

## What shipped

v2.7335 (#8197) is the spike's shape G. Each row of *Needs the property facts* and *To send* (the pile key is still `to_draft`) carries five 9 px marks
after *last work*, in the pane's order. Green is a clear gate, a red ✕ a hold, and a hollow dot a gate the job is not
asked: a job contracted with the owner has no GC and no notice. Hovering a mark names the gate and what is missing. On
a computer the marks stand in for the row's *missing …* words; on a phone the words stay. Rows past *To send* carry
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

## Built: a row press that lands on its open gate (v2.8472)

Diane said on 2026-11-24 to build it. A press on a list row whose gates hold opens the pane with the first open
gate on the screen, lit for a moment, with the keyboard on it, so the next press opens the record. A row with every
gate clear opens as it did. The fragment `docs/recent-features/v2.8472.md` has the calls taken and the measures.

- **First gate:** the pane's own order, which is the order of the row's marks.
- **In view:** a gate already clear of the pinned heads moves nothing. Otherwise the gates section lands under its own
  head. On a 730 px wide window the held gate opened 65 px under the pane's bottom edge, so the scroll is wanted on a
  computer too. At 1400 px wide the gate is on the screen at open, and nothing scrolls.
- **Less motion:** the pane jumps with no glide and the light stands still.
- **Not changed:** a single mark is not a press. A pane opened from the Board, By job, a link or a batch's failure
  line lands nowhere.

The code had moved since this card was written. The list is `LienDeskAffidavitList.tsx`, and the affidavit pane is its
own scrolling box with its own pinned heads, so the desk's `scrollPaneTo` was not the tool. The pane does its own
landing.

## Walked live, and one mend (2026-11-24, v2.8509)

Diane asked for the live walk. It was read-only: row presses on the live desk, nothing written.

- **Headless Chromium, the live desk:** a row held on its notice gate and one held on its homestead gate landed as
  built at 1400, 730 and 380 px wide, light and dark, with less motion and by Enter. The gate's row was whole on the
  screen, under no head, lit, with the keyboard on it. The page did not move. A clear row opened at the top.
- **The iPhone simulator's Safari, the live desk:** the pane landed the same way. It is a simulator, not a real phone.
- **The fault it found:** in Safari the first press after a page load left the keyboard's blue ring and underlined
  words on the gate, and they stayed after the amber light had gone. v2.8509 mends it: a gate landed on by a tap or a
  mouse press takes the keyboard without the ring. The mend was seen in the simulator's Safari on the harness page,
  not yet on the live desk.
- **A second fault, with less motion:** the pane jumped, the job's path then grew, and the landing stood 47 px short
  with two heads pinned. v2.8509 follows a pane it has moved while it settles, so the jump ends where the glide does.
  Seen in the simulator's Safari with Reduce Motion on.

The fragment `docs/recent-features/v2.8509.md` has the measures.

## Left: a look on a real phone

Not seen: a real iPhone in a hand, Safari on a Mac, and a screen reader's words when the keyboard lands on the gate.
Once v2.8509 is live, press a held row on a real iPhone. If the keyboard moving to the pane gets in the way of working
down the list with the keys, say so: the focus is one line in `useLienGateLanding.ts`.

## Where it plugs in

- `src/lib/jobs/lienGateMarks.ts`: the marks, the summary words, and `lienGateRowParts` (which piles carry the
  marks, and the words on a phone).
- `src/lib/jobs/lienGateLanding.ts` and `src/components/jobs/useLienGateLanding.ts`: the gate a row press lands on,
  how far the pane scrolls, and the wiring (v2.8472).
- `src/components/jobs/LienGateMarkStrip.tsx`: the drawing.
- `src/components/jobs/LienDeskAffidavitList.tsx`: the affidavit list row and its press. `LienDesk.tsx` keeps the ask.
- `src/components/jobs/LienDeskAffidavitPane.tsx` and `src/lib/jobs/lienGateRow.ts`: the pane's gate rows (v2.7313).
- `useIsMobile()` is the phone test, 640 px wide or less.

## How to verify

- `npx vitest run src/lib/jobs/lienGateMarks.test.ts src/lib/jobs/lienGateLanding.test.ts src/components/jobs/useLienGateLanding.test.ts src/components/jobs/LienDesk.render.test.tsx`
- On the dev server (it needs the main checkout's `.env.local`), sign in at `/dev-login?as=1`, then open
  `/lien-desk?tab=affidavits` and read the marks in *Needs the property facts*. For a phone, set the browser pane to
  375 wide and reload. The dev sign-in is the dev account on the live database: read only, press nothing that writes,
  and keep any screenshot out of the repo.
