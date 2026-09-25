---
name: "Today's Money Opportunities: two-line cards"
number: 44
group: close
status: built v2.3822 (the owner's yes, 2026-09-25) · left: a look at the live strip after a day, then delete the folder
summary: >
  The lien-notices and burn cards on Today's Money Opportunities run four to five lines each:
  a long title, a sentence of piles, a sentence of explanation, a button row. Make every card
  two lines — the count and the money on the first, with the door as a short link on the same
  row; the piles or the jobs as chips on the second, each chip its own door — and move every
  explaining sentence into a hover. Same facts, half the height, and the grid comes out even.
next: A look at the live strip after a day of use; then delete the folder (the release note carries the record).
size: XS
blocker: A day of use.
ver: v2.3822
opinion: build — nothing is lost (every sentence survives as a hover or a chip) and the strip stops being the tallest thing on the Pipeline.
mockup: has
---

# Today's Money Opportunities: two-line cards

## The ask

The owner, 2026-09-25, of the lien-notices card and the burn card: *"These two cards are very
wordy — can you come up with a proposal that would make them more compact while still maintaining
useful value?"*

## What is wordy today

| Card | Lines | What it says |
|---|---|---|
| ⏱ Lien notices | title 2 lines · body 3 lines · button | *18 lien notices due · $168,306 — the earliest closed Sep 15* + badge **18** · *Closed 10 days ago: the notice under RMC- Dudley Mason · 13 to draft · 3 waiting on the owner of record · 2 awaiting approval* · **Open the Lien desk →** |
| 🔥 Burn | title 3 lines · body 2 lines · button | *1 job burning ahead of progress — $5,019 of margin at risk · all against an assumed budget* · *≈ J523 Mission Hills 96% spent at 90% done. Each opens on its Costs tab.* · **Open the worst first →** |

Three things make the height: the title carries a clause that belongs to the body (*the earliest closed
Sep 15*, *all against an assumed budget*); the body is prose where the facts are a list (four piles,
three jobs); and the door is a full button on its own row, so every card pays for a fourth line
whether it needs it or not. The **18** badge repeats the title's 18.

## The proposal — one rule, every card

[`mockup.html`](mockup.html) — before and after, drawn from the live strip on 2026-09-25.

1. **Line one is the count and the money, and the door.** *⏱ 18 lien notices due · $168,306* with
   *Lien desk →* as a link at the right end of the same line. No button row, no badge.
2. **Line two is chips, each a door.** The lien card's piles — *13 to draft*
   *3 need an owner* *2 awaiting approval* — each opening the desk on that
   pile, and the deadline as the one colored chip: *closed Sep 15 · RMC- Dudley Mason*
   (red past or inside a week, amber inside two). The burn card's worst three jobs —
   *≈ J523 Mission Hills · 96% spent at 90% done* — each opening that job's Costs tab,
   with *+N more* as the last chip when there are more than three.
3. **Every explaining sentence becomes a hover.** *Closed 10 days ago*, *mail by Oct 15 or the lien
   right on that work is gone*, *against an assumed budget* (on the ≈ glyph), *each opens on its
   Costs tab* (on the chips). The words are kept; they stop taking rows.
4. **Two lines is the card's height.** The grid of cards comes out even, and the strip is a third
   shorter with the same six cards.

Applied to the other cards it changes little: *Get contracts signed* already has chips (its floor line
and the *Start the sweep* button fold into line one); *Chase the 90+ tail* and *Accounts Receivable*
become one line each with the door at the right.

## Where it plugs in

| Piece | Today | Change |
|---|---|---|
| `lienDeskMoneyCard.ts` | `claim` + `why` sentences | + `piles: { key, label, count }[]` and `deadline: { words, tone, gcNames }` beside them; `why` stays for the hover |
| `jobSummaryBurn.ts` (`PipelineBurnAlert`) | `worst[]` with label, glyph, spentPct, pct | unchanged; the card words each as a chip |
| `PipelineMoneyOpportunities.tsx` | four blocks of prose + a button per card | one `OpportunityCard` shell: title row (glyph, claim, door link), chip row; the lien piles open the desk on the pile (`setLienDesk({ jobId: null, kind: 'notice', pile })`) |
| `LienDeskModal` | opens on a kind | + an optional `pile` to land on |
| Tests | `lienDeskMoneyCard.test.ts`, `PipelineMoneyOpportunities.render.test.tsx` | the piles and the deadline chip; the card is two rows; a pile chip calls the desk door with its pile |

One PR, size XS–S. No migration.
