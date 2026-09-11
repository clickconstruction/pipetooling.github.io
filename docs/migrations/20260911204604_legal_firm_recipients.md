# 20260911204604_legal_firm_recipients.sql (2026-09-11, v2.3325)

Legal portal train, PR 5 — the firm runs its own inbox.

- `legal_firms.paused_at` — the office's pause-all.
- `legal_firm_recipients` — people at the firm: `mode` (`now` · `digest`), `scope` (`all` · `mine` = matters they handle by name), `digest_weekday` (1 = Mon) + `digest_time` (Central), `confirm_token_hash` / `confirmed_at` (inert until clicked), `unsubscribe_token_hash` / `paused_at` (the one-click stop), `last_digest_at`, `removed_at` (office removal), `added_via_portal`. One live row per (firm, email).
- `legal_notification_queue` — events for the firm: `trigger` (`referred` · `answer` · `pulled`), `payload`, `sent_now_at`, `digested_at`.
- Triggers `legal_matters_notify_stage` (AFTER UPDATE OF stage: → referred from outside the with-firm set queues `referred`; with-firm → review queues `pulled`) and `legal_entries_notify_answer` (an office `answer` entry queues `answer`).
- RPCs (office): `legal_firm_set_paused(firm_id, paused)`, `legal_firm_recipient_remove(recipient_id)`.
- pg_cron `legal-notify-dispatch` on the `1-56/5` lane (co-rides `billed-report-email`) → `POST /functions/v1/legal-notify-dispatch` with `X-Cron-Secret` (Vault `PROJECT_URL` + `CRON_SECRET`).
- Office SELECT policies on both tables; ends with both read-only blocks.

Apply with `supabase db push` after the PR merges; then deploy `legal-notify-dispatch`, `submit-legal-portal` and `legal-portal` (all three changed). Required secrets: `RESEND_API_KEY`, `CRON_SECRET` (already set), `APP_ORIGIN` (optional).
