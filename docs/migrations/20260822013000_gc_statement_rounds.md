# 20260822013000_gc_statement_rounds.sql (2026-08-22, v2.2072)

Personal statement rounds — the app plans and tracks weekly GC statements; a person sends them from their own inbox.

- **`customers.statement_sender_user_id uuid NULL → users`** — standing "who sends this GC their statement" assignment. NULL = client derives from the GC's jobs' Account Man.
- **`gc_statement_round_marks`** — one row per (week_start, gc_customer_id), `action ∈ sent|skipped`, `acted_by`/`acted_by_name`/`acted_at`. UNIQUE(week, GC), upsertable (a skip can become a sent), deletable (undo a mis-click). RLS mirrors `gc_review_certifications`: SELECT for the GC Review cohort (+primary), INSERT/UPDATE with `acted_by = auth.uid()` for dev/master/assistant/controller, DELETE for the same office cohort.
- Both read-only-block sweeps applied (CREATE TABLE migration).
- Applied via `supabase db push` while PR #1772 merged (v2.1980 precedent); types regenerated into the same PR.
