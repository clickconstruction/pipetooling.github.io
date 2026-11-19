# 20261119120000_esign_consents_owner_contract_kind.sql (2026-11-19, v2.7924)

The e-sign ledger's check takes `gc_owner_contract` again. One CHECK is restated and nothing else changes: no table, column, function, policy or grant. It ships with [v2.7924](../recent-features/v2.7924.md).

## What was wrong

`esign_consents.record_type` is held by `esign_consents_record_type_check`, and each migration that adds a kind restates the whole list.

| Migration | The list it left |
|---|---|
| [`20261010071000`](./20261010071000_gc_portal_p5_checks.md) | nine kinds |
| [`20261010090000`](./20261010090000_gc_owner_contract_sends.md) | those nine and `gc_owner_contract` |
| [`20261030030000`](./20261030030000_hours_statements.md) | the nine and `hours_statement`, **without** `gc_owner_contract` |

The third began from the first's list, not the second's. `submit-portal-request` writes a `gc_owner_contract` row after a GC-mode customer signs our contract in their portal. The write is best-effort, as in every signing function: the check refused the row, the function logged it, and the signing went through with no consent words kept.

## What prod held on 2026-11-19

- The ledger had 26 rows, one of them an `hours_statement` of 2026-11-08. Only the third list takes that kind, and no later migration restates the check, so the live check was the third list.
- `gc_owner_contract_sends` had 0 rows. No customer has signed our contract in a portal, so no consent was lost and nothing is backfilled.

The check's definition itself was not read from `pg_constraint` before the push: the dev seat reads tables and functions only. The first query under *Verify after the push* reads it.

## What it does

`esign_consents_record_type_check` is dropped and added again `NOT VALID` with eleven kinds, then validated:

`estimate`, `job_contract`, `person_contract_document`, `step_commitment`, `bid_proposal_room`, `lien_owner_record_request`, `gc_sow`, `gc_draw`, `gc_trade_change`, `gc_owner_contract`, `hours_statement`.

That is every kind a function writes, and the union `EsignConsentRecordType` in `supabase/functions/_shared/esignConsent.ts`. The scan runs under the validate's lighter lock, and `lock_timeout` (3s) fails the push fast if the table is busy. A second run gives the same check.

## What stops it happening again

- `src/lib/esignConsentKinds.test.ts` reads the newest restatement of the check in `supabase/migrations` and fails when it differs from the functions' union, or when a function hands the ledger a kind the check refuses. It fails on `main` as it stood before this migration.
- The bed `gc_owner_contract` (`npm run test:pg:gc-owner-contract`) runs this migration a second time after the two it already re-ran, then inserts a row of each of the eleven kinds. Until now the bed re-ran the contract's own migration, which restated the check as it stood on 2026-10-10 and so hid the loss.

## Verify after the push

```sql
-- 1. The check, validated, with both kinds.
SELECT convalidated,
       pg_get_constraintdef(oid) LIKE '%gc_owner_contract%' AS takes_owner_contract,
       pg_get_constraintdef(oid) LIKE '%hours_statement%' AS takes_hours_statement
FROM pg_constraint
WHERE conname = 'esign_consents_record_type_check';
-- Expected: one row, true on all three.

-- 2. Our contract's kind is kept and an unknown one is refused, rolled back.
BEGIN;
INSERT INTO public.esign_consents (record_type, record_id, consent_version, lang, audience, document_noun, clause_text)
VALUES ('gc_owner_contract', gen_random_uuid(), 1, 'en', 'customer', 'contract', 'Verify, delete me.');
INSERT INTO public.esign_consents (record_type, record_id, consent_version, lang, audience, document_noun, clause_text)
VALUES ('verify_delete_me', gen_random_uuid(), 1, 'en', 'customer', 'contract', 'Verify, delete me.');
-- Expected: the first is kept, the second is ERROR 23514, esign_consents_record_type_check.
ROLLBACK;
```

## Rollback

Not expected. To undo, add the check again with the ten kinds of `20261030030000`. No function, policy or client reads the check.

## Status

Prepared 2026-11-19. Pushed from the main checkout after the merge (`supabase db push`). The old client has nothing to misread, and no types change.
