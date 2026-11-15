# Spike — the five gate marks on each Lien affidavits list row (2026-11-15)

The owner asked on 2026-11-15 whether the pane's five gates (owner, legal description, the GC's address, the § 53.056 notice, homestead) should show on each row of the affidavit list too. This branch prototypes it behind local flags and ships nothing. Nothing shows without a flag.

**Where it went.** Shape G shipped the same day as v2.7335 (#8197). The code on `main` is the one to build on; this branch stays as the spike's record. What the spike left for later, and the way back to this branch, is punch list #364 (`to-dos/lien-gate-marks.md`). The repo is public, so this note names no job: the three rows measured are described by their gates, and the screenshots are kept off GitHub (*Screenshots*, below).

## What was built

- Kernel `src/lib/jobs/lienGateMarks.ts` (+ test): maps `entry.gates` to five marks in the pane's fixed order. Each mark is `ok` (green dot), `open` (red ✕) or `skipped` (hollow dot). Tooltip words: the pane's own sentence for a clear gate, *Missing <row word>* for an open one, so the strip and the row's *missing …* line never disagree. The whole strip reads `4 of 5 clear · missing a private owner` (its title and aria-label).
- A job contracted with the owner keeps five marks: `affidavitGates` fills its contractor and notice slots as clear, but the strip draws them hollow (not asked), so two greens never claim a gate nobody passed. A live job contracted with the owner, missing its owner and its legal description, drew ✕ ✕ ○ ○ ●.
- Strip `src/components/jobs/LienGateMarkStrip.tsx`, wired on the list row in `LienDesk.tsx` behind localStorage flags: `gateMarks=open|all` (shape 1 / shape 2), `gateWords=fold` (drop the *missing …* words into the tooltips), `gatePlace=inline` (strip on the chip line instead of its own line), `gatePhone=words` (on a phone keep the words and drop the strip).
- The dots are 9 px; green at 75 % so a row of five stays quiet; the ✕ is `var(--text-red-600)` at full weight so an open gate is the thing the eye lands on.

## The shapes, measured (1400 wide; 375 phone)

Row heights from the DOM, on three live rows: one with one gate open and a supplier chip (*one open*), one with three gates open, read on a phone (*three open*), and one with every gate clear (*all clear*). Baseline: one open 101 px, three open 101 px on a phone, all clear 77 px.

| Shape | Where | Words | One open | All clear | Phone, three open | Noise |
| --- | --- | --- | --- | --- | --- | --- |
| baseline | — | kept | 101 | 77 | 101 | the words alone; a ready row says nothing |
| 1 open-only, own line (A) | under the chips | kept | 115 (+14) | 77 | 115 (+14) | strip only where there is a hold; words repeat what the ✕ says |
| 1 open-only, own line, folded (B) | under the chips | tooltip | 115 | 77 | 91 | shorter than baseline on a phone, but the reason is hover-only |
| 2 always, own line (C) | under the chips | kept | 115 (+14) | 91 (+14) | 115 | every row grows a line; five greens on every ready row |
| 2 always, own line, folded (D) | under the chips | tooltip | 115 | 91 | 91 | same height cost, less text |
| 1 open-only, inline, folded (F) | after *last work* | tooltip | 101 (0) | 77 (0) | 77 (−24) | no height cost; a ready row still says nothing |
| **2 always, inline, folded (G)** | after *last work* | tooltip | 101 (0) | 77 (0) | 77 (−24) | no height cost; the order reads the same on every row |
| 2 always, inline, words kept (H) | after *last work* | kept | 101 (0) | 77 (0) | 101 (0) | no height cost; words and dots both present |

Shape 1 (A/B/F) hides the strip when all five pass. Shape 2 (C/D/G/H) shows five quiet dots on every row.

**Screenshots.** Fifteen 2× PNGs were taken: the left column at 1400 wide for each shape, single rows, and the phone list for each shape. They show live jobs with their names, GCs and amounts, so they are not on GitHub: the repo is public, and its standing rule (`AGENTS.md`, rule 12) keeps real customers, GCs, jobs and job numbers out of anything public. They are on the local branch `claude/lien-gate-marks-spike-shots` (commit `d1e66ed71`, under `docs/spikes/lien-gate-marks/`) on the Mac that ran the spike. Never push that branch, and never copy its pictures into the repo, a PR or a card. To see a shape again, run this branch's dev server and set its flags, or take the picture again on test data.

## What each costs

- **Own line (A–D)**: +14 px per row that shows it. Shape 2 on its own line is +14 px on all 22 rows, about three rows fewer per screen. The strip sits under the words, so the eye reads the hold twice.
- **Inline (F–H)**: 0 px on every row tried at 1400 and 375; the five dots fit after *last work Sep* even on a phone. With the words folded a phone row with three open gates drops from 101 to 77 px.
- **Words folded**: on a computer the reason moves to hover, where the title names the gate (`owner — Missing a private owner`). On a phone there is no hover, so a folded row says only that something is open, and the pane (one tap) says what. Shape H keeps the words on every width at baseline height; the only cost is that a row with an open gate says it twice.
- **Shape 2's greens**: five greens on every ready row are the whole point (the slot order becomes a habit) and also the whole noise. In the piles past *To draft* (awaiting, ready, held, filed, missed) every row has already passed, so five greens there say nothing the pile label did not.

## Recommendation

Ship **G**: shape 2, inline after *last work*, words folded into the tooltips on a computer, and **on a phone keep the words** (H's phone behaviour: inline strip plus the *missing …* line, since there is no hover and the line costs nothing it did not already cost). Hide the strip in the piles past *To draft*, where every row has passed and the greens are redundant; that keeps the strip on the two piles where a hold is still possible, which is also where a reader is deciding what to fix next. The strip is not a press (the row is already a button and a button cannot hold one); the pane's gate rows are becoming presses on another branch (v2.7313), so the row says *which* gate and the pane opens it.

If the owner would rather the list stay as quiet as it is today, **F** is the fallback: the same inline strip only where a gate is open, with no height cost and no greens on ready rows. The one thing lost is the learned order.

## To ship

- `npm run claim` a version; keep `lienGateMarks.ts` and its test as they are; move the flags to a plain rule (shape G with the phone and pile rules above) and delete `lienGateSpikeFlags`; one `LienDesk.render.test.tsx` case for the strip's title words on a row; a guide line in the Lien desk help under the affidavit list; release note + fragment. Done as v2.7335.
- `LienGateMarkStrip` can later grow a tap on a phone that opens the pane scrolled to that gate, once the pane rows are presses. The pane's rows became presses in v2.7313; this piece is punch list #364.
