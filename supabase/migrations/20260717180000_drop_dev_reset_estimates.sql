-- Drop dev_reset_estimates_for_testing — a "wipe every estimate" button that had no business in prod.
--
-- The function was `DELETE FROM public.estimates WHERE true` behind a dev-only, type-"DELETE" confirm in
-- Settings → Templates & testing. There is no staging environment (migrations hit prod), so a "reset for
-- testing" control operated on real data: a dev could erase the entire estimate book in one click,
-- believing it was a test action. Since v2.702 estimates are archived (so it became recoverable and now
-- trips the bulk-deletion alert), but a standing "delete everything" button is still a footgun with no
-- legitimate use in production. The UI (SettingsTemplatesTab "Delete all estimates" section) is removed in
-- the same PR; this drops the RPC so nothing can call it.
--
-- If estimates ever genuinely need clearing, do it deliberately and scoped, by hand.

DROP FUNCTION IF EXISTS public.dev_reset_estimates_for_testing();
