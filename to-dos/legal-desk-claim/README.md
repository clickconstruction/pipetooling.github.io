---
name: "Legal desk: the claim, not only the open balance"
number: 171
group: gated
status: Do 2026-11-07 · rank 6 of 10 from the review of the Burd matter (job 891) · step 2's tile built as v2.5849 (How much? and What's left for us? read the claim as the open bills plus the retainage held, from the job rows; since v2.6103, #213, only the retainage no sent bill already carries) · step 1 built as v2.6679 (the claim table on the Account tab over legal_matter_claim_lines, the two rows that fill in, add · edit · remove) · step 2 finished as v2.6680 (How much?, What's left for us?, the bars and the paths read the typed lines inside the claim) · step 3 built as v2.6681 (the packet prints the table; the floor half is moot since v2.6170 retired the settlement floor, so the claim feeds the bars and the paths instead) · built 2026-11-08 · walked on prod 2026-11-08 on the ZZ TEST matter, the table, the tile and the packet's print read right, one defect below · the two open decisions made by the owner on 2026-11-08 and built the same day: the firm sees each line (v2.6696, legal-portal sends them, the firm's demand reads the claim) and a line can be marked settlement only (v2.6697, a column, a tick, a chip; out of the demand and the prints, inside the claim bar and the paths) · only the owner's look is left
summary: >
  The desk sizes a case by its open bills: *How much?* is the balance, and *What's left for us?*
  and the settlement floor work from it. A dispute can claim more than the bills say, such as
  materials left on site, retainage, damages, interest and fees. Add claim lines on the matter,
  each with an amount, its basis (a statute or a contract clause) and the document behind it. The
  open bills and the retainage held fill in on their own. *How much?* shows the claim with the
  balance inside it, and the floor can be set against either.
next: The owner's look at the desk (Account → The claim on a ZZ TEST matter with one line ticked Settlement only, the tile, the bars, the print; walked 2026-11-08 before the two decisions were built, see Where it stands), the money bars' gate (the one defect below), and the firm's portal (the matter's Account tab shows the same table, the card's demand reads the claim). Both decisions are made and built; nothing else is open on this card.
ver: v2.6679 · 6680 · 6681 · 6696 · 6697
size: M (a table, the tile, the floor, the packet's print)
blocker: >
  The owner's look at what shipped.
opinion: built on the owner's Do of 2026-11-07; the two decisions were made on 2026-11-08 and built the same day
---

# Legal desk: the claim, not only the open balance

## The ask

The owner, 2026-10-24, after filing Click v Burd & Assoc. (job 891) on the Legal desk: *"Are
there features that if we had added to the legal desk would have made this recording of the burd
situation better?"* The review found ten, ranked by what each would have saved on job 891, and the
owner asked for each as a to-do with the Burd case as its example. This is rank 6.

## What happened on job 891

The desk sized job 891 by its open bills: *How much?* was the unpaid retainage and one small
bill, and *What's left for us?* took the firm's cut and the filing cost from that. The letters
drafted for Oct 27 claim more, adding the materials left on site and damages. That claim lived in a
table inside the letters and the narrative, and the settlement floor could only be written into
the narrative as a sentence.

## What exists today

- `src/lib/legal/deskQuestions.ts`: *How much?* from `packet.worth.balance`, *What's left for us?*
  from `w.net`; the print in `src/lib/legal/legalPacketPrint.ts`.
- The floor: `legal_set_settlement_floor` (`supabase/migrations/20261006140000_legal_settlement_floor.sql`)
  and the slider in `src/lib/legal/settlementFloorControl.ts` (v2.5759), a percent of the balance
  or dollars.
- Related: #165 (retainage on our trade jobs as money owed to us, proposed the same day) and the
  retainage held on the job's *Our contract on this job* row.

Mock-up: [`mockup.html`](./mockup.html) (2026-10-26, made-up data) — the desk as v2.5849 left it, the
claim table on the Account tab with the tile, the floor against the claim and the packet's print, and
the two open decisions as call-out cards.

## The proposal

A claim table on the Account tab, one line per part, each with an amount, a basis and an optional
Evidence document. Two lines fill in on their own: the open bills, from AR, and the retainage
held, from the job. The office adds the rest: materials, damages, interest, fees, other. *How
much?* reads *Claim $X · open bills $Y inside it*, *What's left for us?* works from the claim, and
the packet prints the table. The floor's percent can be of the claim or of the balance.

## Open decisions

- Whether the firm sees each claim line or only the total. **The owner's call, 2026-11-08: each line.** Built as v2.6696: the legal-portal function sends the matter's claim lines, the firm's Account tab and its print draw the same table the desk keeps, and the firm's demand reads the claim plus its fees.
- Whether a line can be marked *settlement only*, claimed in an offer but not in the demand. **The owner's call, 2026-11-08: yes.** Built as v2.6697: `settlement_only` on the line, a **Settlement only** tick on the Add and Edit form, the chip on the desk's and the firm's table, the demand's figures and both printed packets leave such a line out, the claim bar and *What each path nets* keep it.

## Where it plugs in

Existing: the packet's worth, the desk questions, the floor control, AR, the job's retainage
field. New: `legal_matter_claim_lines` (migration), the table, the tile's words, the print.

## Plan

1. The table and the two lines that fill in on their own. M.
2. *How much?* and *What's left for us?* from the claim. S.
3. The floor against the claim, and the print. S.

## How to verify

On a ZZ TEST matter with one open bill and retainage held, the table shows both on its own. Add a
materials line with a document; the tile reads the claim with the balance inside it, and the
print matches.

## Where it stands

2026-11-08: walked on prod (v2.6691) in the owner's Chrome as the owner. The desk hides ZZ TEST jobs until the dev's ZZ switch on the Pipeline is on, so the ZZ TEST sink job (billed, a $50 bill paid, retainage held $50) was parked in Collections through the Pipeline's own **Collections** door, which put the ZZ TEST GC On Notice account on the desk. Account → **The claim** drew the two rows that fill in (Open bills $0.00; Retainage held $0.00 naming the job, with the line *the retainage held $50.00 is already inside the open bills, so the row adds nothing*). **＋ Add a claim line** took a Materials left on site line ($500, a basis, no document) and a Damages line ($250); the table read $750.00 with Edit on each typed row; *How much?* read **$750.00** with the chip *the claim* and *Open bills $0.00 inside it, plus 2 typed lines, $750.00*; *What's left for us?* read $152.50 *of the claim*. **⎙ Print packet** carried *The claim* under Account above the ledger with both typed lines, their bases and the $750.00 total. **Edit → Remove the line…** took both lines off (*The line is off the claim*) and the tile fell back to $0.00; the rows stay on the record as removed. The job was sent back to Billed Awaiting Payment through **Send back to Billed**. The floor half of step 3 has nothing to read: the settlement floor was retired by v2.6170. Screenshots, in the walking session's scratchpad: `171-claim-table-empty`, `171-add-a-claim-line-form`, `171-claim-table-two-lines`, `171-tiles-after-lines`, `171-packet-print-the-claim`, `171-edit-the-claim-line`, `171-remove-the-line-window`, `171-tiles-after-removal`.

One defect, left for the owner: the money bars and *What each path nets* did not draw on this matter. `LegalDesk.tsx` gates them on the open balance (`w.balance > 0.004`), so a claim made of typed lines alone, with no open bill, shows no bar, although `moneyBars` draws one for typed lines alone (v2.6680). The gate should read the claim.
