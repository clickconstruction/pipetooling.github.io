# 20260904230000_contract_form_templates_doc_type

**Contract Forms (v2.2794, PR 2 of 6)** — a form template knows what paperwork it is.

## What it does

- `contract_form_templates.doc_type text NOT NULL DEFAULT 'other'` with the same CHECK set as `person_contract_documents.doc_type` (agreement | coi | w9 | license | other).
- `contract_docs_set_form_template()` (CREATE OR REPLACE): after resolving `form_template_id`, if the copy's `doc_type` is still the default `agreement` and the form's type is not `other`, stamps the form's type onto the copy. A W-9 form's person copies therefore count under the W-9 compliance pill with no manual edit on People → Subs.
- Trigger `set_form_template_on_write` recreated to also fire on `UPDATE OF form_template_id`.

## Order

Push after merge, before the studio's Publish is used for a typed form (the column is written by `createFormTemplate`).

## Rollback

Additive. Drop the column; recreate the PR 1 version of the trigger function from `20260904220000_contract_form_templates.sql`.
