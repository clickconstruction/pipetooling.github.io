---
name: "Contracts: their paper, signed by us only, and its key terms"
number: 173
group: gated
status: proposed 2026-10-24 · rank 8 of 10 from the review of the Burd matter (job 891) · not built
summary: >
  A GC's own subcontract, signed by us and never countersigned, still governs when the GC relies
  on it. The app can file an existing contract only as signed by the customer, and the Legal desk
  says *No signed agreement* until one is. Record their paper as it is: who signed and when, that
  they rely on it, the file, and the clauses that decide a dispute (termination, notice to
  proceed, default and cure, retainage release, payment contingency, change orders, venue, fees).
  The desk's agreement line reads it, and the narrative's contract section can start from it.
next: The owner picks Do, Later or Drop. Then a mock-up of the record and the desk's agreement line.
size: M (a contract kind, the signer fields, the terms, the desk's reading)
blocker: The owner's pick.
opinion: build the signer fields first; the key terms can follow
---

# Contracts: their paper, signed by us only, and its key terms

## The ask

The owner, 2026-10-24, after filing Click v Burd & Assoc. (job 891) on the Legal desk: *"Are
there features that if we had added to the legal desk would have made this recording of the burd
situation better?"* The review found ten, ranked by what each would have saved on job 891, and the
owner asked for each as a to-do with the Burd case as its example. This is rank 8.

## What happened on job 891

Job 891's subcontract is Burd's own form, sent by PandaDoc, signed by our RMP and never
countersigned, and Burd's notice of termination relies on it. *Already have their contract?* would
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

- Whether a contract signed by us only counts as signed for *Can we sue?* once they rely on it.
- Whether the office types the key terms or the app proposes them from the PDF for the office to
  confirm.

## Where it plugs in

Existing: the contract strip, the coverage kinds, the agreement gap, Evidence documents. New: the
kind and its fields (migration), the terms, the desk's words, the narrative insert.

## Plan

1. Their paper with the signer fields, and the desk's line. M.
2. Key terms and the narrative insert. M.

## How to verify

On a ZZ TEST job, record their paper as signed by us only and relied on. The desk's line reads so
and the gap goes. Add three terms and insert them into the narrative.
