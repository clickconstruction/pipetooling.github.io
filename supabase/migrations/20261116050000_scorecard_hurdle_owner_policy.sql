SET lock_timeout = '3s';

-- Team scorecard, PR 3 (punch list #360): the owner sets the score's target.
--
-- The hurdle is break-even plus the profit per paid field hour the owner wants. That target is one row of
-- app_settings (scorecard_hurdle_v1). Until now only the devs' blanket policy could write it, so the owner read a
-- number he could not change. It moves to the Bid Board's Pricing rules, beside what a GC's difficulty costs, and
-- the owner writes it himself: an insert policy and an update policy on that one key, for the owner and a dev,
-- as the other owner-set keys have. Everyone signed in already reads app_settings.
--
-- No table is created, so there are no fence calls: the read-only, twin and archived fences on app_settings stand.

DROP POLICY IF EXISTS master_or_dev_insert_scorecard_hurdle ON public.app_settings;
CREATE POLICY master_or_dev_insert_scorecard_hurdle
  ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (key = 'scorecard_hurdle_v1' AND public.is_master_or_dev());

DROP POLICY IF EXISTS master_or_dev_update_scorecard_hurdle ON public.app_settings;
CREATE POLICY master_or_dev_update_scorecard_hurdle
  ON public.app_settings FOR UPDATE TO authenticated
  USING (key = 'scorecard_hurdle_v1' AND public.is_master_or_dev())
  WITH CHECK (key = 'scorecard_hurdle_v1' AND public.is_master_or_dev());
