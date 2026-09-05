# 20260905020000_contract_form_office_attested

**Contract Forms PR 8 — the office attests (v2.2803)** — one column.

## What it does

- `person_contract_documents.office_attested_at timestamptz` — set by `complete-contract-form-office` at the moment the office completes its section (the request must carry `attested: true`). Kept separately from `office_completed_at` so the record can say "attested".

## Order

Push before redeploying `complete-contract-form-office` and `accept-contract`.

## Rollback

Additive; drop the column.
