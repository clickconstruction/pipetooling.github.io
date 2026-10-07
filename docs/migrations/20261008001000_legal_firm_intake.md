# 20261008001000_legal_firm_intake.sql (2026-10-07, v2.4821)

The firm's answers to Start here ([v2.4821](../recent-features/v2.4821.md)).

1. `legal_firms` gains `intake` (jsonb, `{}`), `intake_sent_at`, `intake_sent_by` (text, `''`) and `intake_seen_at`. The firm writes the first three through `submit-legal-portal` (kind `intake`, the service role); the shape is `_shared/legalFirmIntake.ts`. A replaced firm (`legal_replace_firm`) starts blank, since the answers live on the firm's own row.
2. `legal_firm_intake_seen(p_firm_id)`: SECURITY DEFINER, office only (`legal_office_can_read()`), stamps `intake_seen_at = now()` when the answers are newer than the last read. The Legal desk calls it when the firm's window opens; the firm door's dot reads `intake_sent_at > intake_seen_at`. A training-mode user's call is refused by the table's read-only statement trigger. Granted to `authenticated`, revoked from `anon`.

The office already reads `legal_firms` with `select('*')` under `legal_firms_office_select`, so the new columns need no grant.

Locks: four `ADD COLUMN IF NOT EXISTS` with constant defaults take ACCESS EXCLUSIVE on `legal_firms` (a handful of rows) for an instant; `SET lock_timeout = '3s'` first. No CREATE TABLE. Idempotent.

## Order

Merge, `supabase db push`, then `supabase functions deploy legal-portal submit-legal-portal`, then regenerate types. Before the push, `legal-portal` leaves `intake` out of its answer and the portal hides the step.
