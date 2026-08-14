SET lock_timeout = '3s';

-- Retire drive cost from Sub Labor (v2.1631). New entries stopped collecting
-- Distance in v2.1617 (saved as 0); the owner now wants the LEGACY stored
-- miles cleared too, so no sub-labor row anywhere carries drive cost and the
-- Drive Settings / Default Labor Rate modals leave the Sub Labor tab.
--
-- Effect on money math: every laborJobSubCost() consumer (Sub Labor Due,
-- job cost rollups, Crew P&L, People Review, charges timeline) computes a 0
-- drive component from here on — deliberate, owner-approved. The
-- drive_mileage_cost / drive_time_per_mile settings rows are deleted as
-- housekeeping; client fallbacks (0.70 / 0.02) are inert against 0 miles.

UPDATE public.people_labor_jobs
SET distance_miles = 0
WHERE COALESCE(distance_miles, 0) <> 0;

DELETE FROM public.app_settings
WHERE key IN ('drive_mileage_cost', 'drive_time_per_mile');
