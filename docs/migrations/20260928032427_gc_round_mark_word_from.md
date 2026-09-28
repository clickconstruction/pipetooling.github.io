# 20260928032427_gc_round_mark_word_from.sql (v2.3954)

Punch list #49, step 2. Adds six nullable columns to `gc_statement_round_marks`, so the word on a mark can name its source beside whoever typed it:

- `word_from_user_id uuid` → `users(id)` ON DELETE SET NULL, `word_from_name text` — whose read of the GC it is (usually the account man).
- `word_heard_via text` — CHECK `call | text | in_person | email | other`: how the person entering it heard it. NULL when the source entered it.
- `word_entered_by uuid` → `users(id)`, `word_entered_by_name text` — who typed it.
- `word_at timestamptz` — when the word was recorded; `acted_at` stays the statement's day on a sent mark.

No backfill: a row from before reads `word_from` NULL, and the app shows the person who marked it, which is all the old row ever knew.

The v2.2072 policies are untouched — `acted_by` is still pinned to `auth.uid()`, so nobody writes a row as someone else; `word_from_*` is a statement about the source, entered by the person named in `word_entered_by`.

Additive and idempotent (`ADD COLUMN IF NOT EXISTS`, constraint dropped-then-added); no new table, so the read-only policy re-apply calls are not needed. The client reads the columns only after they exist (`gcStatementRoundIo.ts` falls back to the old column list), so the push and the client can land in either order.
