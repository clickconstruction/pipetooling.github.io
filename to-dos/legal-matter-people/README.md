---
name: "Legal desk: the people on a matter, and the proceedings beside it"
number: 174
group: gated
status: proposed 2026-10-24 · rank 9 of 10 from the review of the Burd matter (job 891) · not built
summary: >
  A matter involves more people than the customer record holds: the GC's president and billing
  contact, the owner of record, a tenant, an inspector, a supplier's credit desk, counsel. The
  desk knows the customer's one email. Add a people list on the matter, each with a role, an
  address and a use (letters, copies, or never, with the reason), and let letters pick their
  recipients from it. Beside it, a short list of proceedings that run alongside the claim, such
  as an agency complaint or a records request, each kept out of settlement letters.
next: >
  The owner looks at the mock-up (before-after.html beside this to-do: the people list, a
  letter's To line picking from it, the proceedings) and picks Do, Later or Drop.
size: M (two small tables, the lists, the letters' recipients)
blocker: >
  The owner's pick, and the shape of #118's To chip.
opinion: >
  later — build it after #118, so the To chip and the people list are one design
---

# Legal desk: the people on a matter, and the proceedings beside it

## The ask

The owner, 2026-10-24, after filing Click v Burd & Assoc. (job 891) on the Legal desk: *"Are
there features that if we had added to the legal desk would have made this recording of the burd
situation better?"* The review found ten, ranked by what each would have saved on job 891, and the
owner asked for each as a to-do with the Burd case as its example. This is rank 9.

## What happened on job 891

Job 891's customer record carries one email, and it is not at the domain Burd's people use.
Burd's legal@ address bounces. The letters for Oct 27 go to the president and the billing
contact, with copies to the owner of record and the tenant, and their addresses lived in the case
notes. Others who mattered to the record, such as the city inspector, had no place on the matter,
and a recorded call and its transcript lived outside the app.

## What exists today

- The Account tab's *Who owes*, from the customer record's contacts, and a demand letter's *Who
  owes it from the bill* (`src/components/jobs/LienInstrumentsModal.tsx`).
- *Record of contact*: the customer's promises and our collection calls (`theirWord` in
  `src/lib/legal/legalPacket.ts`).
- Related: #118 (the To chip: pick the person, the number and the address a send goes to).

## The proposal

- **People** on the matter: name, role (their president, billing or field contact; owner of
  record; tenant; inspector; agency; supplier; counsel; witness), organization, email, phone, and
  a use (letters, copies, never) with the reason. Seeded from the customer record and the property
  record's owner.
- Letters and packets pick their recipients from it. A *never* address cannot be picked and says
  why.
- **Beside the claim**: proceedings, each with an agency, a reference number, a contact from
  People, a status, its documents, and *keep out of settlement letters*, which holds its documents
  from anything addressed to the other side.
- A call with a third party is an event (#167) with its recording as a document (#168).

## Open decisions

- Whether People live on the matter or on the customer, since a GC's billing contact is the same
  on every job.
- Whether the firm sees the proceedings list.

## Where it plugs in

Existing: the customer's contacts, the property's owner, the letters' recipient code, #118's chip.
New: `legal_matter_people` and `legal_matter_proceedings` (migration), the two lists, the
recipient picker's source.

## Plan

1. People, and the letters' recipients. M.
2. Proceedings and their keep-out hold. S.

## How to verify

On a ZZ TEST matter, add a billing contact and a *never* address with its reason. A letter offers
the contact and refuses the other, saying why. A proceeding's document stays out of the letter's
attachments.
