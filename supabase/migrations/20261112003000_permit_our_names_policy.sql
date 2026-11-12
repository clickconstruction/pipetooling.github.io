SET lock_timeout = '3s';

-- Punch list #307 (bids and permits), PR 3's leftover, v2.6959: the names that are us on a plumbing permit.
-- The list is one row of app_settings, key permit_our_names_v1, JSON { "names": [...] } in value_text, edited on
-- Settings → Company → Our names on plumbing permits. app_settings takes writes from a dev alone unless a key-scoped
-- policy says otherwise, and this card is the owner's too (is_master_or_dev(), the predicate the client's
-- isOwnerOrDev mirrors), the way the office address beside it is. Everyone signed in already reads app_settings.
-- The card upserts the row and never deletes it: an emptied list is saved as { "names": [] }. No row is seeded.
-- Additive and idempotent: no table is created, so no fence call is owed. The dev's standing policy stands beside.

DROP POLICY IF EXISTS master_or_dev_insert_permit_our_names ON public.app_settings;
CREATE POLICY master_or_dev_insert_permit_our_names ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (key = 'permit_our_names_v1' AND public.is_master_or_dev());

DROP POLICY IF EXISTS master_or_dev_update_permit_our_names ON public.app_settings;
CREATE POLICY master_or_dev_update_permit_our_names ON public.app_settings FOR UPDATE TO authenticated
  USING (key = 'permit_our_names_v1' AND public.is_master_or_dev())
  WITH CHECK (key = 'permit_our_names_v1' AND public.is_master_or_dev());
