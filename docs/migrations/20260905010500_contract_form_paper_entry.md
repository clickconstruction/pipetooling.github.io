# 20260905010500_contract_form_paper_entry

**Contract Forms PR 6 — Enter from paper (v2.2801)** — where the scan of a hand-filled form lives, and who keyed its answers.

## What it does

- `person_contract_documents.form_scan_storage_path text` — the photo / PDF of the paper form in the private `contract-form-pdfs` bucket (`<doc id>/source.<ext>`). The sub's signature stays on the scan; the flattened PDF (`form_pdf_storage_path`) is built from the keyed answers with the Sign Here line left blank.
- `person_contract_documents.form_keyed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL` — the staff member who typed the answers (`form_source = 'paper'`); NULL for portal signings.
- Column comments. Nothing else changes; `form_source` already allowed `paper` (PR 1).

## Order

Push before deploying `contract-form-paper-entry` (it inserts both columns). `open-contract-form-pdf` reads `form_scan_storage_path` for `which: 'scan'`; deploy it after the push too.

## Rollback

Additive. Drop the two columns; the scans in storage stay until removed by hand.
