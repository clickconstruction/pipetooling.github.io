# 20260928050129_contract_text_history.sql (2026-09-28, v2.3987)

The wording customers agree to gets a history (punch list #50, PR 5). Two tables, two trigger functions, four triggers, one list function, baseline rows. Additive; nothing reads it until the client that follows.

## `contract_text_versions`

One row per change to a customer-facing contract text. `source_kind` is `app_setting` (`source_key` = the `app_settings.key`) or `contract_book` (`source_key` = the `contract_template_documents.id` as text, with `name`, `body_format` and `version_date` as they were). `change_kind`: `baseline` (what it said when the history began), `changed`, `removed`. `changed_at`, `changed_by` (null for the baseline, the service role, or an actor with no `users` row).

RLS: **SELECT** dev · master · assistant-like — the people who see Settings → Contracts & terms. **No write policy**: the triggers write it (`SECURITY DEFINER`), so it is append-only from the app's side.

## The triggers

- `contract_text_setting_keys()` — the five `app_settings` keys that hold contract wording: `estimate_public_terms_body`, `estimate_accept_checkbox_label`, `bid_cover_letter_terms_default_v1`, `bid_cover_letter_exclusions_default_v1`, `bid_cover_letter_closing_v1`. `src/lib/contracts/contractTextHistoryKeys.test.ts` reads the newest migration that defines it and fails when the catalog and the list disagree; to add a key, redefine the function in a new migration.
- `app_settings`: `contract_setting_version_on_write` (AFTER INSERT OR UPDATE OF `value_text`) and `contract_setting_version_on_delete`, both `WHEN (key = ANY (contract_text_setting_keys()))` — the function is never called for any other Settings write. A save that does not change the text records nothing (the estimate copy form upserts every key on each save); a blank insert records nothing.
- `contract_template_documents`: `contract_book_version_on_write` (AFTER INSERT OR UPDATE OF the wording, the format, the name, the version date, the audience) and `contract_book_version_on_delete`, both `WHEN (audience = 'customer')`. Staff packets and the subs' documents are not recorded. A document that becomes a customer document is recorded on that write (the Book's editor sets the audience in a second UPDATE).
- Both functions catch their own errors and `RAISE WARNING`: a history row is never the reason a save fails.

## Baseline

One `baseline` row per Settings text that has wording today, stamped at the push; one per customer Book document, stamped at the document's `updated_at` with its `book_version_date`. Skipped for a source that already has a row, so a re-run adds nothing.

## `contract_text_reviews`

The office's "I read this and it still stands": `entry_id` (the catalog entry, `^[a-z][a-z0-9-]{0,79}$`), `reviewed_on` (the company-calendar day), `note`, `reviewed_by`. RLS: **SELECT** and **INSERT** dev · master · assistant-like (`reviewed_by = auth.uid()`); **DELETE** the person who marked it, or a dev.

## House rules

Opens with `SET lock_timeout = '3s'`; ends with `apply_read_only_write_blocks()`, `apply_read_only_stmt_blocks()` and `apply_digital_twin_write_blocks()`. `CREATE TRIGGER` takes a brief lock on `app_settings` and `contract_template_documents`; on a busy moment the push fails fast — retry.

## Tried before the push

Run twice against a local Postgres 15 with stub tables (idempotent), then fifteen writes: an unchanged upsert, a changed one, a key given wording and cleared, a blank insert, another setting, a `value_num`-only update, a delete, an actor with no `users` row, no actor, a staff document, a customer document, an untouched column, a document that becomes a customer document, a new customer document and its delete. Each recorded, or did not, as described above.

## Apply order

Push any time after the merge. The client that reads these tables ships after the push and the types PR.
