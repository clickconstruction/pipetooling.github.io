# 20261007234000_legal_matter_narrative.sql (2026-10-07, v2.4812)

The narrative for the firm ([v2.4812](../recent-features/v2.4812.md)).

1. **`legal_matters`** gains `narrative_md` (text, default `''`), `narrative_updated_at`, `narrative_updated_by`.
2. **`legal_set_narrative(p_matter_id, p_markdown)`**: the office cohort (`legal_office_can_read()`), SECURITY DEFINER; trims, refuses more than 40,000 characters, stamps who and when from the session. Returns `{ ok }` or `{ error }`. Executable by `authenticated` only.

Locks: three `ADD COLUMN IF NOT EXISTS` with constant defaults take ACCESS EXCLUSIVE on `legal_matters` (a handful of rows) for an instant; `SET lock_timeout = '3s'` first. No CREATE TABLE. Idempotent.

## Order

Merge, `supabase db push`, regenerate types, then `supabase functions deploy legal-portal` (the function reads the columns in a separate query that tolerates their absence until then).
