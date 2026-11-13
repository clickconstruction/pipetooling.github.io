---
name: "Contracts: their paper, signed by us only, and its key terms"
number: 173
group: waiting
status: Do 2026-11-08 · rank 8 of 10 from the review of the Brund matter (job 891) · built as v2.6698 (the their_paper kind with the signer fields, the relied-on flag and the key terms; the strip's Their paper… sheet and the Contract window's band; the desk's agreement line, Can we sue rule and gap; Insert the contract's terms) · deployed 2026-11-08 (the migration applied, legal-portal v88 current, the types ride #7350) · the owner's look left · the PDF read of the terms is the follow-up below
summary: >
  A GC's own subcontract, signed by us and never countersigned, still governs when the GC relies
  on it. The app can file an existing contract only as signed by the customer, and the Legal desk
  says *No signed agreement* until one is. Record their paper as it is: who signed and when, that
  they rely on it, the file, and the clauses that decide a dispute (termination, notice to
  proceed, default and cure, retainage release, payment contingency, change orders, venue, fees).
  The desk's agreement line reads it, and the narrative's contract section can start from it.
next: >
  The owner's look on a ZZ Test job (How to verify below). The deploy is done: the migration is
  in prod's ledger, legal-portal v88 carries the paper's columns, and the types ride #7350. The
  follow-up is a read of the PDF that proposes the key terms for the office to confirm, as a card
  of its own.
ver: v2.6698
size: M (a contract kind, the signer fields, the terms, the desk's reading)
blocker: The owner's look.
opinion: built as the plan drew it, signer fields first, both steps in one PR since one migration carries both
---

# Contracts: their paper, signed by us only, and its key terms

## The ask

The owner, 2026-10-24, after filing Click v Brund & Assoc. (job 891) on the Legal desk: *"Are
there features that if we had added to the legal desk would have made this recording of the brund
situation better?"* The review found ten, ranked by what each would have saved on job 891, and the
owner asked for each as a to-do with the Brund case as its example. This is rank 8.

## What happened on job 891

Job 891's subcontract is Brund's own form, sent by PandaDoc, signed by our RMP and never
countersigned, and Brund's notice of termination relies on it. *Already have their contract?* would
have filed it as signed by the customer, which was not true, so it went onto Evidence instead and
the desk kept saying *No signed agreement on 891, proceeds as a sworn account*. The clauses that
mattered were written into the narrative by hand: termination for convenience, notice to proceed,
default and cure, retainage release, payment when the owner pays, and change orders.

## What exists today

- `src/components/jobs/JobContractStrip.tsx`: *Already have their contract? Paste the Drive link…*
  files the link as signed by the customer.
- `src/lib/jobs/jobContractCoverage.ts`: the coverage kinds (signed, sent, draft, none).
- The desk's agreement gap in `src/lib/legal/legalPacket.ts` and the Paper tab's *Agreements*
  table.
- Related: #50 (every contract text a customer signs, side by side).

## The proposal

- A contract kind, **their paper**, on the job: signed by us (who, when); signed by them (when, or
  *not countersigned*); *they rely on it* (where: their notice, their pay application); the file
  (a Drive link or an Evidence document).
- **Key terms**: short fields with clause references for termination, notice to proceed, default
  and cure, retainage release, payment contingency, change orders, venue, fees and arbitration.
- The desk's agreement line reads *Their subcontract · signed by us only · they rely on it*, with
  the sworn account kept as the backup basis. The narrative editor offers *Insert the contract's
  terms*.

## Open decisions

Both decided by the owner on 2026-11-08, the day the card was built:

- **A contract signed by us only counts as signed for *Can we sue?* once the other side relied on
  it.** Carried as a relied-on flag the office sets, with the date and what the reliance was
  (their notice, their pay application); counsel notes anything later. Until the flag is set the
  paper is a flagged basis beside the sworn account, and the gap says what makes it count. A
  paper they countersigned counts on its own. Kernel: `src/lib/legal/legalContractBasis.ts`.
- **The key terms are typed by the office first**, each with its clause reference. A read of the
  PDF that proposes them for the office to confirm is a later follow-up, as a card of its own, not
  part of this build.

## Where it stands

Built 2026-11-08 as v2.6698, one PR for both steps of the plan. The record is a `job_contracts`
row with `kind = 'their_paper'` (`src/lib/jobs/theirPaper.ts`): what the paper is, who signed for
us and when and how, whether they countersigned, the relied-on flag, the file and the eight key
terms. The contract strip offers *Their paper…* while nothing of ours is on file or the job is
marked not needed, and *Edit the record* once one is; the Contract window draws a band for it. The
job's chip reads *Their paper · signed by us only · they rely on it*. The Legal desk's Agreements
table reads the same line, *Can we sue?* counts the paper once relied on or countersigned with the
sworn account as the backup basis, the gap otherwise says what makes it count, the steps carry the
signing and the reliance, and *Insert the contract's terms* pastes the paper and its clauses under
*The contract*. The firm's portal reads the paper the same way since `legal-portal` v88 (2026-11-08).

Not built here: the Evidence-document pick for the file (the record takes a Drive link or an
upload, as every paper filing does), and the PDF read of the terms (the follow-up above).

## Where it plugs in

Existing: the contract strip, the coverage kinds, the agreement gap, Evidence documents. New: the
kind and its fields (migration), the terms, the desk's words, the narrative insert.

## Plan

1. Their paper with the signer fields, and the desk's line. M. Built, v2.6698.
2. Key terms and the narrative insert. M. Built, v2.6698, in the same PR.
3. Follow-up, its own card: a read of the PDF that proposes the key terms for the office to
   confirm, each with its clause.

## How to verify

On a ZZ TEST job, record their paper as signed by us only and relied on. The desk's line reads so
and the gap goes. Add three terms and insert them into the narrative.
