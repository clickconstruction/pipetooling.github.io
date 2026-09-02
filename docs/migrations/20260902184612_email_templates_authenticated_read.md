# 20260902184612_email_templates_authenticated_read

**v2.2658 — email wording PR 2.** Adds an authenticated SELECT policy on `email_templates` (previously dev-only read from the baseline). Client-built senders — lien release, hazmat notice — read wording overrides before composing, and assistants send those emails. Templates carry wording only; INSERT/UPDATE/DELETE stay dev-only. Idempotent; safe in either deploy order (senders fail soft to built-in copy).
