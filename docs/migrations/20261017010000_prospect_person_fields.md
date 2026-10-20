# 20261017010000_prospect_person_fields.sql (2026-10-17, v2.5600)

Prospect fields: who we are talking to (punch list #117, `to-dos/prospect-fields/README.md`). Every prospect is a person we call, sometimes at a company, and the facts the call gathers are the facts the customer record, the bench and Messages keep. The columns for that, additive and idempotent; nothing existing changes.

Apply order: push right after this PR merges and before the client that reads the columns (PR 2 of the train) deploys. Until the push the deck reads as before.

## What it does

1. **`prospects`** gains seven columns: `is_person` (the person is the record, false by default), `contact_title`, `contact_phone` (the person's cell; `phone_number` stays the company line), `ok_to_text` (`not_asked` · `yes` · `no`, checked, default `not_asked`, the constraint added `NOT VALID` and validated), `maps_url`, `license`, `also_reach`.
2. **`gc_companies`** gains `maps_url`.
3. **`gc_add_company(company jsonb)`** is replaced with the same body plus the Maps link read from `mapsUrl`; the people list, the vetting state and the refusals are as v2.4848 wrote them.

No new table, so no fence appliers; the existing row policies on `prospects` and `gc_companies` cover the columns.

## Verify

`select column_name from information_schema.columns where table_name = 'prospects' and column_name in ('is_person','contact_title','contact_phone','ok_to_text','maps_url','license','also_reach')` reads seven rows; `select maps_url from gc_companies limit 1` reads; a `gc_add_company` call with `mapsUrl` lands it on the row.
