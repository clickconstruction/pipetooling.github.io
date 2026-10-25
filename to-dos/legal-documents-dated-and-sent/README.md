---
name: "Legal desk documents: the day the paper is from, and draft, sent or received"
number: 168
group: gated
status: proposed 2026-10-24 · rank 3 of 10 from the review of the Burd matter (job 891) · not built
summary: >
  A document on the Legal desk carries a title, one line on what it shows, and the day it was
  uploaded. The Timeline puts it on the upload day, and nothing says whether a letter is a draft,
  went out, or came in. Give each document the day the paper is from and a state (draft, final,
  sent, received). A sent letter carries when, how and to whom, with the mailing receipt as its
  proof. The Timeline places a document by its own day, and a planned send step can mark its
  letters sent.
next: The owner picks Do, Later or Drop. Then a mock-up of a document row with its state and the Mark sent sheet.
size: M (a migration, the Evidence row, the Timeline, the portal)
blocker: The owner's pick.
opinion: build — job 891's subcontract sits on the Timeline five months after it was signed, and its three drafted letters look like evidence in hand
---

# Legal desk documents: the day the paper is from, and draft, sent or received

## The ask

The owner, 2026-10-24, after filing Click v Burd & Assoc. (job 891) on the Legal desk: *"Are
there features that if we had added to the legal desk would have made this recording of the burd
situation better?"* The review found ten, ranked by what each would have saved on job 891, and the
owner asked for each as a to-do with the Burd case as its example. This is rank 3.

## What happened on job 891

Seven PDFs went onto job 891's Evidence on 2026-10-24: the subcontract (signed in May), the
supplier's receipt (Oct 22), three letters drafted to go out Oct 27, a case summary and a law
excerpt. The Timeline put all seven on Oct 24, the upload day. The three letters read like
anything else on the tab; only their titles (*for October 27*) say they are drafts. When they go
out, the certified-mail receipts can only be added as more documents, unlinked to the letters.

## What exists today

- `legal_matter_documents` (`supabase/migrations/20261007230000_legal_matter_documents.sql`,
  v2.4810): title, shows, the stored file, `added_at`, a hold reason, `voided_at`. No day of its
  own and no state.
- `src/components/jobs/legal/LegalMatterDocumentsPanel.tsx` (the drop zone and the rows),
  `src/lib/legal/legalMatterDocumentsIo.ts` (add, hold, retire), `src/lib/legal/legalMatterDocuments.ts`
  (the portal's shape).
- `timelineDocumentsFromRows` in `src/lib/legal/legalTimeline.ts` places a document by its added
  day.

## The proposal

- **The paper's day**: `dated_on`, asked at upload (default: today). The Timeline places the
  document there and says *added Oct 24* under it.
- **A state**: draft, final, sent or received. A draft shows a *Draft* chip on the desk and the
  portal. **Mark sent…** asks the day, how (email, certified mail, by hand), to whom, and the proof
  (another document, such as the mailing receipt). A sent letter reads *Sent Oct 27 · certified ·
  receipt*. **Replace with the sent copy** keeps the draft in history.
- **Tied to a planned step**: a step can name the documents it sends, and *Mark done* on the step
  offers to mark them sent on the same day.

## Open decisions

- Whether a draft is shared with the firm by default (job 891's were meant for counsel to see
  before the send).
- Whether a received paper needs the day received as well as the day written.

## Where it plugs in

Existing: the table, the panel, the IO, the portal's shape, the Timeline kernel. New: `dated_on`,
`state`, `sent_on`, `sent_how`, `sent_to`, `proof_document_id` (migration), the chip and the sheet,
and `meta.document_ids` on a planned step.

## Plan

1. `dated_on`: migration, the upload field, the Timeline placement, the portal. S.
2. The state and *Mark sent…* with proof. M.
3. A planned step's documents and the offer on *Mark done*. S.

## How to verify

On a ZZ TEST matter, upload a paper dated in May; it lands in May on the Timeline. Upload a draft
letter and mark it sent with a receipt; the row and the portal read sent, with the receipt one
press away.
