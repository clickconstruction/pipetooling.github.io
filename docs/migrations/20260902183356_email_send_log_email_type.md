# 20260902183356_email_send_log_email_type

**v2.2656 — email catalog PR 1.** Adds `email_send_log.email_type` (nullable text; `EMAIL_CATALOG` id from `src/lib/emailCatalog.ts`) plus a partial index on `(email_type, sent_at DESC)` for the Settings catalog's per-type stats. Senders stamp it as they adopt — starting with the five previously-unlogged senders fixed in the same PR. Additive/idempotent; null on pre-catalog, webhook, and sync rows. Safe in either deploy order.
