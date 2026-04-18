-- Documented `app_settings` key (no DDL): Jobs → Bank Payments Mercury Kind badge map.
-- Key: bank_payments_kind_badges_v1 — JSON in value_text: { [kind: string]: { nickname, color } }.
-- Rows are created by the client on first dev save (RLS: dev-only write; all authenticated read).
-- Intentionally no INSERT here: an empty seeded row would make `rowExists` true and skip local-only badge fallback.

SELECT 1;
