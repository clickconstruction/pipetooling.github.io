# 20260904220000_contract_form_templates

**Contract Forms (v2.2788, PR 1 of 6)** — a Contract Book entry can be a form: an uploaded PDF plus the entry boxes a dev placed on it; the signer fills the real page.

## What it does

- New table `contract_form_templates` (`name`, `revision_label`, `pdf_storage_path` in the private `contract-form-templates` bucket, `pdf_sha256`, `page_count`, `schema jsonb` = FormSchema v1, `status` draft | published | retired, `superseded_by_id`, audit columns). RLS: office reads (dev / master / assistant / controller), dev-only writes. `updated_at` trigger.
- `contract_template_documents.form_template_id` (FK, SET NULL) — set = this Book entry is a form.
- `person_contract_documents` + `form_template_id`, `form_values jsonb` (non-sensitive answers), `form_hints jsonb` (last four of each sensitive answer), `form_pdf_storage_path` (flattened signed PDF in the private `contract-form-pdfs` bucket), `form_source` portal | paper.
- Trigger `set_form_template_on_write` (`contract_docs_set_form_template`, BEFORE INSERT / UPDATE OF `applied_contract_template_document_id`, `document_name`): resolves the person copy's form from the applied Book entry, else from a same-name published form. Person-copy client paths stay untouched.
- New table `contract_form_pdf_opens` (`person_contract_document_id`, `opened_by`, `opened_at`) — written by the open-contract-form-pdf function (PR 4), devs read.
- Ends with both read-only appliers and the digital-twin write fence.
- Buckets + `storage.objects` policies are out-of-band — SQL in `docs/CONTRACT_FORMS.md` § Storage.

## Order

Push any time; nothing reads the new columns until PR 2 (studio) and PR 3 (signer). Create the two buckets before PR 2 is used.

## Rollback

Additive. Drop the trigger + function, the two tables, and the five columns; no data outside them is touched.
