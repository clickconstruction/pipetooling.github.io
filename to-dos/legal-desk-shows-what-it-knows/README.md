---
name: "Legal desk: show the owner's mailing address and the supplier payments the app already has"
number: 175
group: gated
status: proposed 2026-10-24 · rank 10 of 10 from the review of the Burd matter (job 891) · not built
summary: >
  Two facts the app holds never reach the Legal desk. The property record's owner mailing address
  is missing from the desk's property table, so a case can list it as still to find. And the desk
  shows nothing about the job's suppliers, while the Lien desk's supply-house line reads from
  books that may not know a supplier was paid. Add the mailing address to the table, and a
  suppliers line on the Paper tab from the same kernel as the Lien window, with a door to record a
  payment and attach its receipt.
next: The owner picks Do, Later or Drop. The address column needs no mock-up; the suppliers line does.
size: S (an XS column, an S line, an S door)
blocker: The owner's pick, and where a payment to a supplier's job account is recorded.
opinion: build — two small PRs, and both facts mattered on job 891
---

# Legal desk: show the owner's mailing address and the supplier payments the app already has

## The ask

The owner, 2026-10-24, after filing Click v Burd & Assoc. (job 891) on the Legal desk: *"Are
there features that if we had added to the legal desk would have made this recording of the burd
situation better?"* The review found ten, ranked by what each would have saved on job 891, and the
owner asked for each as a to-do with the Burd case as its example. This is rank 10.

## What happened on job 891

Job 891's property record held the owner of record's mailing address, from the appraisal record,
all along. The desk's property table does not show it, so the case notes listed it as still to
find. The supplier's job account was paid in full on Oct 22, and the receipt is on Evidence, but
the supplier books never learned of it: the Liens window still lists the supplier's July
materials as six unpaid invoices, with the supplier's own notice coming due.

## What exists today

- The Account tab's property table (`src/components/jobs/legal/LegalDeskModal.tsx`): job,
  address, county, owner of record, legal description, parcel, lien-ready. `LegalPropertyLine` in
  `src/lib/legal/legalProperty.ts` has no mailing address, though
  `customer_addresses.owner_mailing_address` holds it.
- Supply houses on a lien job (v2.4404): `src/lib/jobs/lienJobSuppliers.ts`, the Liens window in
  `src/components/jobs/LienInstrumentsModal.tsx`, and the guide
  `src/content/help/see-which-supply-houses-are-owed-on-a-lien-job.md`.

## The proposal

1. **The owner's mailing address** as a column in the property table and in the packet's print,
   with its source (the appraisal record, the deed, or the office).
2. **Suppliers** on the Paper tab: each house, its invoices on the job, paid or unpaid, release
   asked or received, from the same kernel as the Liens window.
3. **Record the payment** from the suppliers line, or from an Evidence document marked as a
   supplier's receipt, into the supplier books, so the Lien desk stops counting it as owed.

## Open decisions

- Where a payment to a supplier's job account is recorded today, and whether the desk should
  write there or open that screen.

## Where it plugs in

Existing: the property resolver, the table, the suppliers kernel, the *Held for suppliers* books.
New: one field on the property line, the Paper tab's line, the door.

## Plan

1. The mailing address column and the print. XS.
2. The suppliers line. S.
3. Record the payment. S.

## How to verify

On a ZZ TEST job whose property record has a mailing address and whose supplier has an unpaid
invoice, the desk shows the address and the unpaid line. Record the payment, and the desk and the
Liens window both read paid.
