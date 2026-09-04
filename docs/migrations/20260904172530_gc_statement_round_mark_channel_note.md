# 20260904172530_gc_statement_round_mark_channel_note.sql (v2.2761)

Adds two nullable columns to `gc_statement_round_marks`:

- `channel text` — CHECK `email | text | call | in_person | other`. NULL on rows written before this migration; the app reads NULL as email (the round only did personal emails until now).
- `note text` — optional free text from whoever marked it sent, kept with `acted_by` / `acted_by_name` / `acted_at` for posterity.

Additive and idempotent (`add column if not exists`, constraint dropped-then-added); no new table, so the read-only policy re-apply calls are not needed and the v2.2072 RLS covers the columns. The unique `(week_start, gc_customer_id)` row stays the ledger — the send history is simply every week's row for a GC.
