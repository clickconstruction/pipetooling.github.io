# 20260915170000_email_schedule_report_email_stream.sql (2026-09-15, v2.3472)

Field report emails on My email schedule (`docs/recent-features/v2.3472.md`). Two `CREATE OR REPLACE FUNCTION`s, no table change:

- **`get_my_email_schedule()`** + `report_emails` (every `report_email_subscriptions` row addressed to the caller — `recipient_user_id = auth.uid()`, or `recipient_user_id IS NULL` and `recipient_email` equal, case-insensitively, to the caller's `users.email` — with `enabled`, `auto_send`, `all_authors`, and the author names from `report_email_subscription_authors`); the `weekly` digest items + `crew_filter`.
- **`get_global_email_schedule()`** + `report_email_subscriptions` (dev-only as before: id, recipient name or outside address, `external`, label, the three flags, author names).

Both bodies are the live definitions from `20260904201238` with only the additions. Self-scoped SECURITY DEFINER; no fence appliers (no new table). Apply order: either side first — the client reads the new keys as optional.
