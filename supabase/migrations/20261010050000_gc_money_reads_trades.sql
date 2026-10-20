SET lock_timeout = '3s';

-- GC mode, Owner Billing's O9 (v2.5133): the money team reads the trades' money. Money and Bill the customer are the
-- money team's (gc_money_team(): dev, the leaders and the controller) since the Owner Billing door, but each trade's
-- statement of work and its draws were a dev's alone, so a leader's or the controller's bill drafted every trade at $0
-- (live since U6b, the Draws window). This opens reading, and only reading, to the audience doors.ts already names for
-- Building's money tables (BUILDING_REAL_BUILD.md decision 4): a FOR SELECT policy for gc_money_team() on the Board's
-- gc_sows and gc_sow_lines, Building's gc_draws, gc_draw_lines, gc_sow_line_reports and gc_change_order_trade_sends, and
-- the Portal's gc_back_charges, whose taken charges every draw's net reads. Each table keeps its dev policy, so writing
-- stays a dev's: the Draws window, the draws RPCs and the statement of work's presses. No table, function or grant
-- changes; authenticated already holds SELECT on each.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'gc_sows', 'gc_sow_lines', 'gc_draws', 'gc_draw_lines', 'gc_sow_line_reports', 'gc_change_order_trade_sends',
    'gc_back_charges'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_money_read', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((SELECT public.gc_money_team()))',
      t || '_money_read', t);
  END LOOP;
END $$;
