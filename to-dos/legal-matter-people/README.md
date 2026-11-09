---
name: "Legal desk: the people on a matter, and the proceedings beside it"
number: 174
group: waiting
status: DONE 2026-11-08 — PR 1 v2.6705 (the people on the matter, seeded from the record, the use and its reason, the demand letter's To from the list; migration `20261108173417_legal_matter_people.sql`, both tables, pushed right after the merge); PR 2 v2.6726 (the proceedings beside the claim, the keep-out hold on Evidence and the claim's picker, the firm's read; `legal-portal` redeployed after the merge); v2.6741 (the letter's own Copies to line from the matter's people)
summary: >
  A matter involves more people than the customer record holds: the GC's president and billing
  contact, the owner of record, a tenant, an inspector, a supplier's credit desk, counsel. The
  desk knows the customer's one email. Add a people list on the matter, each with a role, an
  address and a use (letters, copies, or never, with the reason), and let letters pick their
  recipients from it. Beside it, a short list of proceedings that run alongside the claim, such
  as an agency complaint or a records request, each kept out of settlement letters.
next: >
  The owner walks PR 2 and the copies line on a ZZ TEST matter (How to verify). Nothing left to build.
size: M (two small tables, the lists, the letters' recipients, the letter's copies line); nothing left
blocker: none
opinion: >
  built after #118 PR 1 in one session, so the To chip and the people list are one design
ver: v2.6741
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

## The owner's calls, 2026-11-08

Marked Do today, built as the second half of the #118 session so the To chip and the people list
are one design.

- **The people live on the matter, not on the customer.** Once a customer goes to legal the company
  does not work with them again, so reuse across jobs is not the point. Seeded from the customer
  record and the property record's owner, as proposed, each with a use (letters, copies, never) and
  a reason.
- **Letters and packets pick their recipients from that list** through the same chip shape as
  #118's To chip. PR 1 puts the picker on the final demand letter's *Who owes it*: a To fills the
  recipient; since v2.6741 the letter carries its own Copies to line from the copies.
- **The proceedings sit beside the claim** with their agency, reference, contact, status and
  documents, and **the firm's portal sees the proceedings list** (PR 2).

## Where it stands

- PR 1 (v2.6705): `legal_matter_people` and `legal_matter_proceedings` in one migration; the list on
  the Account tab with Add the people the record knows, Add a person, Edit, Take them off the
  matter…; the demand letter's *From the matter's people* strip. The firm does not see the people:
  the never reasons are the office's own words.
- PR 2 (v2.6726): **Beside the claim** under the people on the Account tab — ＋ Add a proceeding, Edit,
  Remove the proceeding…, each with its kind, agency, reference, a contact from the people, where it
  stands, its Evidence documents and *Keep its documents out of settlement letters*; the held rows wear
  *kept out* on Evidence and leave the claim table's picker (the one picker that filters: an event's
  documents are the office's record, the demand letter's exhibits never read matter documents); the
  firm's portal draws the list under Property record with the contact's name and role, the documents
  as links and the hold's line, never the note. `legal-portal` redeployed after the merge.
- v2.6741: the final demand letter's own **Copies to** line, under the enclosures, *name, role* a
  line, starting with everyone marked copies on the matter; the strip's Copies chips are presses that
  take a person off this letter or put them back, and the recorded letter keeps the picks.

## Hand-over: PR 2, as built (v2.6726)

The brief the second session built from; every item landed as written, the firm's shape gaining `keep_out` so counsel's own letters honor the hold.

1. **The table and the RPCs exist.** `legal_matter_proceedings` (kind `agency_complaint ·
   records_request · bond_claim · permit · other`, title, agency, reference, `person_id` from
   `legal_matter_people`, status `open · answered · closed` with `status_on`, note, `document_ids`
   of the matter's live Evidence rows, `keep_out`, `removed_at`) and `legal_proceeding_save` /
   `legal_proceeding_remove`, the same shape as `legal_matter_person_save` (the ensure-the-matter
   upsert, refused once closed; the contact must be on the matter, each document a live row of it).
   No migration in PR 2.
2. **Kernel** `src/lib/legal/legalProceedings.ts` (pure, tests beside it), modelled on
   `legalMatterPeople.ts`: the kinds and statuses and their words, `proceedingsFromRows`, the
   draft and `proceedingDraftProblem`, `keptOutDocumentIds(proceedings)` (every `document_ids`
   entry of a live row with `keep_out`), and the portal's shape `proceedingForFirm` (kind, title,
   agency, reference, the contact's name and role, status, `status_on`, the documents' ids; never
   the note, never the people's reasons).
3. **The list** `LegalProceedingsTable.tsx` on the Account tab under **People on the matter**
   (`LegalDeskPacketTab.tsx`, a `proceedings` prop like `people`), the mock-up's rows: *Agency
   complaint · State Plumbing Board · open*, under it *ref C-2026-0431 · contact: … · 2 documents ·
   kept out of settlement letters*; **＋ Add a proceeding** (Kind · Name · Agency · Reference ·
   Contact from the people · Status and day · Documents from Evidence · Keep its documents out of
   settlement letters), **Edit**, **Remove the proceeding…** behind a confirm. `useLegalPacketData`
   reads the live rows into `LegalPacketInput.proceedings` → `LegalPacket.proceedings`;
   `LegalDesk.tsx` wires `saveProceeding` / `removeProceeding` over the RPCs as `savePerson` is.
4. **The keep-out hold.** The Evidence tab's document rows wear a chip *kept out of settlement
   letters* when a held proceeding names them (`LegalMatterDocumentsPanel`), and the document
   pickers of anything addressed to the other side leave them out: today that is the claim table's
   Evidence picker (`ClaimPanel.documents`) and the demand letter's exhibits do not read matter
   documents, so the hold is the chip plus the filter on the pickers that offer matter documents.
   Say in the fragment which pickers filter.
5. **The firm's read** (the owner's call): `legal-portal` adds `proceedings` to each matter's
   payload (`_shared/legalMatterShape.ts`: a `MATTER_COUNSEL_SELECT.proceedings` list and
   `shapeMatterForCounsel` cutting each to the firm's keys; read fail-soft like `gapAnswers`),
   `legalPortalPayload.ts` parses it (`[]` from an older function), and `LegalFirmMatterView`'s
   Account tab draws the list under Property record. `docs/EDGE_FUNCTIONS.md` → legal-portal gets
   a `v2.NNNN` block; **redeploy after PR 1's push** (`supabase functions deploy legal-portal`).
6. **Words:** one release note + fragment, the guide *review a collections account before it goes
   to your attorney* (the Account bullet: a sentence on the proceedings and the keep-out chip),
   `docs/GLOSSARY.md` (the *People on a matter · proceedings* entry: drop "(PR 2)"), this card's
   front matter (`status`, `ver`, `next`). `npm run claim` first.

## Walk, 2026-11-08 (PR 2, on the dev server at the branch's head)

On the ZZ TEST GC On Notice matter (its jobs sit out of Collections between walks, so the walk flagged
*ZZ TEST sink* in through the app's own `set_job_collections_flag` and unflagged it after; the
dev's **ZZ test jobs** switch on). A text stand-in for a filed complaint went onto Evidence through
the dev seat's `apply_matter_document`. **Add the people the record knows** seeded the customer.
**＋ Add a proceeding** → Agency complaint, a name, an agency, *C-2026-0431*, the seeded contact,
the document ticked, the hold on → **Save the proceeding** → the row read *Agency complaint ·
<name>* with *ref C-2026-0431 · contact: <the customer> · 1 document · kept out of settlement
letters* under it and the document as a press; the stored row carried the person, the document and
`keep_out`. Evidence → the document's row wore *final* and *kept out*, the chip's hover naming the
picker. Account → **＋ Add a claim line** → the Evidence picker offered *None yet* (the matter's one
document is held). **⚖ Mark attorney ready…** → **Preview what the firm sees** → *Beside the claim*
under Property record: *Agency complaint · <name>* · *<agency> · ref C-2026-0431* · *<the customer>
· the customer* · *open* · the document, *kept out of settlement letters* under it; the office's
note was nowhere in the preview. The proceeding, the person and the document stay on the ZZ matter
for the owner's walk; to see the account on the desk, flag *ZZ TEST sink* into Collections and turn
the ZZ test jobs switch on.

## Where it plugs in

Existing: the customer's contacts, the property's owner, the letters' recipient code, #118's chip.
New: `legal_matter_people` and `legal_matter_proceedings` (migration), the two lists, the
recipient picker's source.

## Plan

1. People, and the letters' recipients. M.
2. Proceedings and their keep-out hold. S.

## How to verify

On a ZZ TEST matter, add a billing contact and a *never* address with its reason. A letter offers
the contact and refuses the other, saying why, and ends on *Copies to* with everyone marked copies. A
proceeding's document stays out of the claim table's picker and wears *kept out* on Evidence.
