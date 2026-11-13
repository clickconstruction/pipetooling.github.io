SET lock_timeout = '3s';

-- Punch list #313 (cards and footers), v2.7139: the owner's role saves which looks and which card sizes the team is offered.
--
-- Settings → People & teams → Card and footer looks saves two app_settings rows, each with an upsert:
--   card_looks_v1   the looks of the card and the footer on offer, and the default (20261111220000, v2.6951)
--   card_sizes_v1   the sizes of the card's back on offer, and the default (20261111230000, v2.6956)
-- No key-scoped policy named them, so the baseline's "Devs can manage app settings" (is_dev()) alone let the write
-- through, and the card was drawn for a dev alone. The card is the owner's: he approves a look, a person picks.
-- An owner whose login is not a dev could neither open the card nor save it.
--
-- Two policies in the shape of master_or_dev_*_bridge_cash_keys (20261112013000): INSERT and UPDATE on these two
-- keys for is_master_or_dev(), the predicate the client's isOwnerOrDev mirrors. An upsert needs both, though both
-- rows are seeded. No DELETE: the card never deletes them. The table's restrictive write fences (read-only, digital
-- twin, archived) still apply. Additive and idempotent: no table is created, so no fence call is owed.

DROP POLICY IF EXISTS master_or_dev_insert_card_looks_keys ON public.app_settings;
CREATE POLICY master_or_dev_insert_card_looks_keys ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (key IN ('card_looks_v1', 'card_sizes_v1') AND public.is_master_or_dev());
DROP POLICY IF EXISTS master_or_dev_update_card_looks_keys ON public.app_settings;
CREATE POLICY master_or_dev_update_card_looks_keys ON public.app_settings FOR UPDATE TO authenticated
  USING (key IN ('card_looks_v1', 'card_sizes_v1') AND public.is_master_or_dev())
  WITH CHECK (key IN ('card_looks_v1', 'card_sizes_v1') AND public.is_master_or_dev());
