# 20260905013000_contract_form_office_section

**Contract Forms PR 7 — two-party forms (v2.2802)** — the office's half of a form (the I-9's Section 2).

## What it does

Four additive columns on `person_contract_documents`:

- `office_values jsonb` — the office's non-sensitive answers (boxes with `party = 'office'`), keyed by box key.
- `office_completed_at timestamptz` — when the office finished its section; the PDF is flattened at that moment.
- `office_completed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL` — who completed it.
- `office_signer_printed_name text` — the name typed as the office signature.

Nothing else changes. Two-party detection is on the template's schema (any box with `party: 'office'`), not on the row.

## Order

Push before deploying `complete-contract-form-office` (it writes the four columns) and the redeploys of `accept-contract` / `contract-form-paper-entry` (they leave two-party PDFs unflattened; harmless without the columns but pointless).

## Rollback

Additive; drop the four columns. PDFs already flattened stay flattened.
