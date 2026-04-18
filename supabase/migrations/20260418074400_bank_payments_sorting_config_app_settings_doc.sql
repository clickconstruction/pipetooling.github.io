-- Documented `app_settings` key (no DDL): Jobs → Stages → Accounts Receivable Mercury filter (`BankingSortingConfigV1`).
-- Key: bank_payments_sorting_config_v1 — JSON in value_text: kinds, accountIds, debitCardIds, startDateYmd, exclusion lists.
-- Rows are created by the client on first dev save (RLS: dev-only write; all authenticated read).
-- Intentionally no INSERT here: an empty seeded row would make `rowExists` true and skip legacy local-only filter fallback.

SELECT 1;
