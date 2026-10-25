---
name: "Legal desk: a case the office runs itself"
number: 172
group: gated
status: proposed 2026-10-24 · rank 7 of 10 from the review of the Burd matter (job 891) · built as v2.5847 (the In house stage an office role sets, the floor in it, the Offers log with expiry days on the Timeline, Question for counsel…, all carried to the firm by Mark attorney ready; migration 20261025160000) · owed: db push + legal-portal deploy after merge, then a live pass on a ZZ TEST matter
summary: >
  The desk's exits are *Mark attorney ready*, which releases a case to the firm, and *Write it
  down*. A case the office runs itself, with counsel away or not yet engaged, gets neither the
  settlement floor (it opens only once a firm has the matter) nor a place for offers or for the
  questions to ask counsel later. Add an *In house* stage: the floor, an offers log whose expiry
  days land on the Timeline, and a *Questions for counsel* list, all carried to the firm on
  release.
next: Push the migration and redeploy legal-portal once v2.5847 merges; the live pass; then delete this to-do.
size: M (a stage, the offers log, the questions list, the release carrying them)
blocker: None — the owner's call of 2026-10-25: an office role sets In house. The firm reads an offer the office made as an entry once the matter is released (the builder's call, named in the PR).
opinion: built — rare, but it is exactly how job 891 ran
---

# Legal desk: a case the office runs itself

## The ask

The owner, 2026-10-24, after filing Click v Burd & Assoc. (job 891) on the Legal desk: *"Are
there features that if we had added to the legal desk would have made this recording of the burd
situation better?"* The review found ten, ranked by what each would have saved on job 891, and the
owner asked for each as a to-do with the Burd case as its example. This is rank 7.

## What happened on job 891

Counsel was out of the country, so the office ran job 891 itself (v2.5800). The desk had no stage
for that. The settlement floor went into the narrative as a sentence, because its editor opens
only for a matter with a firm. The offer and the day it expires went onto the Timeline by hand,
and the questions saved for counsel lived in a case summary outside the app.

## What exists today

- `src/components/jobs/legal/LegalDeskModal.tsx`: the two exits; the floor editor and *Ask the
  firm* show only when `matterIsWithFirm(matter)` (`src/lib/legal/legalMatters.ts`).
- The matter's stages on `legal_matters` (`supabase/migrations/20260911195745_legal_matters.sql`).
  The floor RPC (`supabase/migrations/20261006140000_legal_settlement_floor.sql`) accepts any
  matter; the gate is the screen.

## The proposal

- **In house**, a stage before release, set by an office role with one line of why (*counsel away
  until …*).
- In it: the floor editor; an **Offers** log (made or received, amount, day, expires, status:
  open, countered, accepted, withdrawn, expired) whose expiry days land on the Timeline; and a
  **Questions for counsel** list.
- **Mark attorney ready** carries the floor, the offers and the questions to the firm, and the
  questions become *Ask the firm* entries.

## Open decisions

- Who may set *In house*: an office role, or a dev as with release.
- Whether the firm sees an offer the office made, or only its terms.

## Where it plugs in

Existing: the stages, the floor RPC and control, *Ask the firm* (`legal_add_entry` kind
`question`), the Timeline. New: the stage value, the offers log (entries of a new kind or a small
table), the questions list, the release's carry-over.

## Plan

1. The stage, and the floor inside it. S.
2. Offers, with expiry days on the Timeline. M.
3. Questions for counsel, and the carry-over at release. S.

## How to verify

On a ZZ TEST matter, set *In house*: the floor opens. Log an offer that expires next week; it shows
on the Timeline. Mark the matter attorney ready, and the firm's portal shows the floor, the offer
and the questions.
