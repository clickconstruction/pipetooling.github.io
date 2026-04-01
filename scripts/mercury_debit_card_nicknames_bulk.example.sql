-- Bulk upsert debit card nicknames (data-only; not a versioned migration).
-- Run in Supabase Dashboard → SQL Editor (privileged role).
--
-- Phase 1 — Prepare mapping:
--   • mercury_debit_card_id: UUID from Mercury raw.details.debitCardInfo.id (or legacy raw.debitCardInfo.id)
--   • nickname: 1–120 chars after trim
--   • Lowercase UUIDs; dedupe to one row per card id
--
-- Prefer generating SQL from a tab-separated file (uuid + nickname):
--   node scripts/generate-debit-card-nickname-sql.mjs path/to/mapping.tsv > /tmp/nicknames-upsert.sql
-- Then paste/run the output, or edit VALUES below by hand (escape ' as '' inside nicknames).
--
-- Optional dry run: BEGIN; … paste SQL … ROLLBACK;
--
-- Validation:
--   SELECT mercury_debit_card_id, nickname, updated_at
--   FROM public.mercury_debit_card_nicknames
--   ORDER BY updated_at DESC LIMIT 50;
--
-- App: Banking → Reload table; confirm Debit card column / nicknames modal.

INSERT INTO public.mercury_debit_card_nicknames (mercury_debit_card_id, nickname, updated_at)
VALUES
  ('00000000-0000-4000-8000-000000000001'::uuid, 'Remove this line; add real rows or use the generator', now())
ON CONFLICT (mercury_debit_card_id) DO UPDATE SET
  nickname = EXCLUDED.nickname,
  updated_at = now();
