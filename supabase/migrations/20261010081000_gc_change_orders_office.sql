SET lock_timeout = '3s';

-- GC mode, the schedule's PR 16b (v2.5156): a change order's non-money half for the office, the view the Owner Billing
-- door planned (to-dos/gc-mode/mockups/door-owner-billing.md, call C), added by its first reader, the schedule
-- (to-dos/gc-mode/mockups/schedule-pr16.md, both on branch spike/gc-mode). gc_change_orders is the money team's alone.
-- The schedule reads a change order's number, words, trade, status, days and days on the chart, never its cost, its
-- price or its percent done. The view keeps its owner's rights, so it reads past the table's money policy, and holds
-- the office team at its own WHERE behind a security barrier. No table is created.
CREATE OR REPLACE VIEW public.gc_change_orders_office WITH (security_barrier = true) AS
  SELECT c.id, c.project_id, c.number, c.description, c.reason, c.schedule_words, c.package_id,
         c.status, c.sent_on, c.answered_on, c.days, c.days_on_chart
  FROM public.gc_change_orders c
  WHERE (SELECT public.gc_office_team());

-- Read only. Supabase's default privileges give a new view every verb, and a simple view over one table takes writes
-- with its owner's rights, so every grant goes first and SELECT alone comes back.
REVOKE ALL ON public.gc_change_orders_office FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.gc_change_orders_office TO authenticated;

COMMENT ON VIEW public.gc_change_orders_office IS
  'GC mode (v2.5156, the schedule''s PR 16b; Owner Billing''s door, call C): a change order''s non-money half, for the office team (gc_office_team()): its number, words, reason, trade, status, sent and answered days, days and days on the chart. Never cost, price or pct_done. Its description and schedule_words are the money team''s words, shown as they typed them. Owner''s rights with a security barrier; read only for authenticated, nothing for anon.';
