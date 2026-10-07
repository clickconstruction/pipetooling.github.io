# 20261007200000_legal_close_uncollectible_marks_jobs.sql (2026-10-07, v2.4794)

Punch list #94, PR 5 ([v2.4794](../recent-features/v2.4794.md)): closing a matter as uncollectible on the Legal desk marks its jobs.

1. **`legal_close_matter(p_matter_id, p_stage, p_note)`** re-created verbatim from `20261006150000`, plus one block after the matter update: when `p_stage = 'uncollectible'`, every job linked through `legal_matter_jobs` that is `billed`, in Collections and not yet marked gets `uncollectible_at / by / reason` (the note, else *Closed as uncollectible on the Legal desk*) and an `uncollectible_change` activity event carrying the matter id. A job already marked, paid or out of Collections is left alone.

Locks: one `CREATE OR REPLACE FUNCTION` — instant. Idempotent.

## Order

After `20261007170000` (the columns). Merge, `supabase db push`; no types change.
