-- v2.6894 — Permits: the access rule is read once per statement, not once per row (punch list #292).
--
-- Every table the Permits tab reads carries a policy of the form USING (public.user_can_research_permits()).
-- Written bare, Postgres runs the function again for every row a statement touches: each run looks the
-- caller up in `users`, so a read of a city's permits paid for that lookup several thousand times. On a
-- bed seeded at the live table's size, signed in as an estimator, a plain count of one city's permits took
-- 310 ms and the Permits list 600 ms. With the call inside a scalar subquery the planner runs it once, as
-- an InitPlan: 0.45 ms and 145 ms. `archived_fence` on these same tables is already written that way.
--
-- Nothing else changes. The function, who it lets in, the grants and every other policy stand. The
-- function is STABLE and reads only who the caller is, so once per statement gives the answer once per
-- row gave. The three reads' own joins are rewritten in 20261111003750_permit_reads_indexed.
--
-- A policy is altered only where it exists, so a table a later migration has not made yet is passed over.
SET lock_timeout = '3s';

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      -- The reads: checked on every row a SELECT returns.
      ('permits',                  'permits_select',                  '(SELECT public.user_can_research_permits())', NULL),
      ('permit_verdicts',          'permit_verdicts_select',          '(SELECT public.user_can_research_permits())', NULL),
      ('permit_pulls',             'permit_pulls_select',             '(SELECT public.user_can_research_permits())', NULL),
      ('permit_lookups',           'permit_lookups_select',           '(SELECT public.user_can_research_permits())', NULL),
      ('builders',                 'builders_select',                 '(SELECT public.user_can_research_permits())', NULL),
      ('builder_marks',            'builder_marks_select',            '(SELECT public.user_can_research_permits())', NULL),
      ('builder_customer_answers', 'builder_customer_answers_select', '(SELECT public.user_can_research_permits())', NULL),
      -- The writes: the same rule, the same form. The row's own test stays beside it.
      ('permits',                  'permits_insert_file',             NULL, 'source = ''file'' AND (SELECT public.user_can_research_permits())'),
      ('permit_verdicts',          'permit_verdicts_insert',          NULL, 'decided_by = auth.uid() AND (SELECT public.user_can_research_permits())'),
      ('builders',                 'builders_insert',                 NULL, '(SELECT public.user_can_research_permits()) AND updated_by = auth.uid()'),
      ('builders',                 'builders_update',                 '(SELECT public.user_can_research_permits())', '(SELECT public.user_can_research_permits()) AND updated_by = auth.uid()'),
      ('builder_marks',            'builder_marks_insert',            NULL, 'marked_by = auth.uid() AND (SELECT public.user_can_research_permits())'),
      ('builder_customer_answers', 'builder_customer_answers_insert', NULL, 'answered_by = auth.uid() AND (SELECT public.user_can_research_permits())')
    ) AS t(tbl, pol, using_expr, check_expr)
  LOOP
    IF EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = r.tbl AND p.policyname = r.pol) THEN
      EXECUTE format(
        'ALTER POLICY %I ON public.%I%s%s',
        r.pol,
        r.tbl,
        CASE WHEN r.using_expr IS NOT NULL THEN ' USING (' || r.using_expr || ')' ELSE '' END,
        CASE WHEN r.check_expr IS NOT NULL THEN ' WITH CHECK (' || r.check_expr || ')' ELSE '' END
      );
    END IF;
  END LOOP;
END $$;
