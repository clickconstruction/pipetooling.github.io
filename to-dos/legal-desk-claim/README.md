---
name: "Legal desk: the claim, not only the open balance"
number: 171
group: gated
status: Do 2026-11-07 · rank 6 of 10 from the review of the Burd matter (job 891) · step 2's tile built as v2.5849 (How much? and What's left for us? read the claim as the open bills plus the retainage held, from the job rows; since v2.6103, #213, only the retainage no sent bill already carries) · step 1 built as v2.6679 (the claim table on the Account tab over legal_matter_claim_lines, the two rows that fill in, add · edit · remove) · step 2 finished as v2.6680 (How much?, What's left for us?, the bars and the paths read the typed lines inside the claim) · step 3 built as v2.6681 (the packet prints the table; the floor half is moot since v2.6170 retired the settlement floor, so the claim feeds the bars and the paths instead) · built 2026-11-08, the owner's look left
summary: >
  The desk sizes a case by its open bills: *How much?* is the balance, and *What's left for us?*
  and the settlement floor work from it. A dispute can claim more than the bills say, such as
  materials left on site, retainage, damages, interest and fees. Add claim lines on the matter,
  each with an amount, its basis (a statute or a contract clause) and the document behind it. The
  open bills and the retainage held fill in on their own. *How much?* shows the claim with the
  balance inside it, and the floor can be set against either.
next: The owner's look at the desk (Account → The claim on a ZZ TEST matter, the tile, the print), and the two open decisions below — whether the firm's portal shows each line (today only the printed packet does) and whether a line can be marked settlement only.
ver: v2.6679 · 6680 · 6681
size: M (a table, the tile, the floor, the packet's print)
blocker: >
  The owner's look at what shipped, and the two open decisions.
opinion: built on the owner's Do of 2026-11-07; the two open decisions can wait for a live matter that needs them
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
- Whether a line can be marked *settlement only*, claimed in an offer but not in the demand.

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
