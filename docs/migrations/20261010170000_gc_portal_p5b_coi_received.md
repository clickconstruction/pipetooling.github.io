# 20261010170000_gc_portal_p5b_coi_received.sql (2026-10-10, v2.5202)

GC mode, the real build, the trade partner portal's P5b-2m (plan `to-dos/gc-mode/mockups/portal-p5b.md`, amendment 3, on branch `spike/gc-mode`). The owner's call 3, 2026-10-10: **"Office looks first."** A certificate a trade partner sends from its portal lands as *received* and counts for nothing (the start gate, Follow up, the insurance promise) until the office marks it good from the company's Documents tab. Nothing sends one yet: P5b-2's kind `coi` does, through `submit-gc-trade-portal`.

## What it does

1. **`person_contract_documents.status` gains `received`.** `person_contract_documents_status_check` is dropped and added again with the four values (`unsent`, `sent`, `signed`, `received`), `NOT VALID` then validated, so no value another lane uses is loosened. A new CHECK, `person_contract_documents_received_is_a_company_coi`, holds `received` to a company's certificate (`company_id` set, `doc_type` `coi`), also `NOT VALID` then validated. A person's paper never takes it.
2. **`gc_trade_coi` is redefined** (P5b-m's, its signature, grant and refusals word for word): the trade's certificate is a `coi` paper of the company's with status `received`, `signed_at` null, `sent_at` the time it came in, its expiry and the link of its own upload, tied to the upload. One waits at a time: a second send updates the waiting paper's link, day and time instead of adding one. `gc_company_paper_kept` fires only on `signed`, so no promise is kept.
3. **`gc_mark_company_coi_good(paper)`**, the office's one press on the Documents tab: a dev only until the papers' door, as `gc_record_company_coi` is, its refusals in words (*That certificate is not waiting for a look.*, *That certificate has run out. Ask them for the current one.*). It sets the paper `signed` with today's day, and `gc_company_paper_kept` keeps the insurance promise in the same transaction. SECURITY INVOKER, granted to `authenticated`.

`gc_trade_coi` was called by nothing before this migration (P5b-m's kind waits for P5b-2), so no certificate was ever filed as signed by a trade.

**Locks.** The two CHECKs take a short lock on `person_contract_documents`, a live table (People → Contracts, the signing pages). Push it in a quiet hour, as B6-b-i's CHECK on the same table was.

## Checked before the push

**The SQL bed** `gc-portal-p5b` (`npm run test:pg:gc-portal-p5b`): the whole schema, P5b-m a second time and then this migration a second time (so the bed's schema is main's), then the scenario, all in one transaction that rolls back. It passed locally on Docker on 2026-10-10, and five mutants were each caught (the trade's certificate filed as signed, a second send adding a paper, anyone marking good, a run-out certificate marked good, `received` on any paper). Its P5b-2m cases:
- the two CHECKs validated; a person's paper, a company's W-9 and an unknown status refused `received` (`23514`);
- the trade's certificate filed received, unsigned, with its day, link and the time it came in, tied to its upload, and no promise kept; a second send replacing it with its new link and day, one paper still;
- **Mark it good** refused to an estimator, to a paper that is no waiting certificate and to one run out, in words; then signed with today's day and the insurance promise kept; and refused a second time;
- `gc_mark_company_coi_good` executes for a signed-in person and never for `anon`.

`gc-papers` (the keep trigger and the office's certificate) and `gc-trade-sign-sow` (the master agreement's gate) pass with it.

**Who reads the status by its value** (gc 2's ask, 2026-10-10): `status` is a plain string in the types, so `tsc` would not catch a missing `received`. Every client read of `person_contract_documents` outside GC mode keys on a person (`person_id`, `person_name`), the paper's own id, or `status = 'signed'`, and the People → Contracts tab drops company papers when it loads (`isCompanyPaperName`, which feeds its agreements panel and its status map); so no map keyed on `unsent`, `sent` and `signed` (`ContractsAgreementsPanel.tsx`, `PeopleContractsTab.tsx`, the Person Desk's `paperworkRollup.ts`) can meet a company's certificate. The edge functions' checks (`contractSigningSend.ts`, `get-contract-signing-link-for-self`, `send-contract-for-signature`, `submit-sub-portal`) allow signing only `unsent` or `sent`, so a received certificate is never signable. In GC mode, `companyPapers` reads each status explicitly (a signed agreement, W-9 or certificate), so a received row changes nothing there until P5b-2 reads it as waiting.

## Verify after the push

Through the management API, each step read only or in `BEGIN … ROLLBACK`:

```sql
-- 1. The two CHECKs, validated.
SELECT conname, convalidated, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'public.person_contract_documents'::regclass
  AND conname IN ('person_contract_documents_status_check', 'person_contract_documents_received_is_a_company_coi');
-- Expected: both validated; status IN ('unsent', 'sent', 'signed', 'received'); received only on a company's coi.

-- 2. A person's paper refused received, rolled back.
BEGIN;
INSERT INTO public.person_contract_documents (person_name, document_name, status, contract_lineage_id, lineage_version)
VALUES ('Verify Person, delete me', 'Agreement', 'received', gen_random_uuid(), 1);
-- Expected: 23514, person_contract_documents_received_is_a_company_coi.
ROLLBACK;

-- 3. Mark it good refuses anyone but a dev, rolled back (an estimator's claims, then SET LOCAL ROLE authenticated).
-- Expected: 'Only a dev sends a trade its papers while GC mode is built.'
```

## Rollback

Not expected. To undo: put `gc_trade_coi` back from `20261010140000`, drop `gc_mark_company_coi_good`, mark or delete any `received` paper, drop `person_contract_documents_received_is_a_company_coi`, and add `person_contract_documents_status_check` back with its three values.

## Status

Prepared 2026-10-10 by gc 6 for the Portal lane on `mockups/portal-p5b.md` (amendment 3). The lead pushes it after the merge, in a quiet hour.
