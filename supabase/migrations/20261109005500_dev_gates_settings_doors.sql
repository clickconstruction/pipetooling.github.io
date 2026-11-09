SET lock_timeout = '3s';

-- Punch list #188 (the dev gates), PR 9, v2.6762: the Settings doors that a policy or an RPC guards, rows 6, 7, 16, 30
-- and 31 of the audit table, every recommendation taken as written by the owner on 2026-11-08:
--   row 6   Settings → Training — training_courses written by the owner too (which courses the crew must take is his
--           policy). Reads were everyone's already.
--   row 7   Settings → Usage — the four usage RPCs restated word for word from 20260826161242 with the gate reading
--           is_master_or_dev(); how the company uses the app is his to read.
--   row 16  Company documents — company_documents inserted, updated and deleted by the owner too (the W-9 and the
--           insurance certificate are his papers).
--   row 30  Contracts and clauses → Approve · vN, Decline — gc_clause_approve_team() names the owner beside the dev
--           and the controller; every approve policy and RPC reads the function, so nothing else moves. The client's
--           copy is GC_CLAUSE_APPROVE_TEAM in src/lib/gc/access.ts; access.test.ts reads this definition.
--   row 31  Activity logs → Most recent emails sent — email_send_log read whole by the owner too.
-- Additive and idempotent: no table is created, so no fence call is owed.

-- 1) Training (row 6)
DROP POLICY IF EXISTS training_courses_master_or_dev_insert ON public.training_courses;
CREATE POLICY training_courses_master_or_dev_insert ON public.training_courses FOR INSERT TO authenticated WITH CHECK (public.is_master_or_dev());
DROP POLICY IF EXISTS training_courses_master_or_dev_update ON public.training_courses;
CREATE POLICY training_courses_master_or_dev_update ON public.training_courses FOR UPDATE TO authenticated USING (public.is_master_or_dev()) WITH CHECK (public.is_master_or_dev());
DROP POLICY IF EXISTS training_courses_master_or_dev_delete ON public.training_courses;
CREATE POLICY training_courses_master_or_dev_delete ON public.training_courses FOR DELETE TO authenticated USING (public.is_master_or_dev());

-- 2) Company documents (row 16)
DROP POLICY IF EXISTS "Owner inserts company documents" ON public.company_documents;
CREATE POLICY "Owner inserts company documents" ON public.company_documents FOR INSERT WITH CHECK (public.is_master_or_dev());
DROP POLICY IF EXISTS "Owner updates company documents" ON public.company_documents;
CREATE POLICY "Owner updates company documents" ON public.company_documents FOR UPDATE USING (public.is_master_or_dev()) WITH CHECK (public.is_master_or_dev());
DROP POLICY IF EXISTS "Owner deletes company documents" ON public.company_documents;
CREATE POLICY "Owner deletes company documents" ON public.company_documents FOR DELETE USING (public.is_master_or_dev());

-- 3) Contracts and clauses (row 30): the one place the approvers are named.
CREATE OR REPLACE FUNCTION public.gc_clause_approve_team()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'controller')
  );
$$;

COMMENT ON FUNCTION public.gc_clause_approve_team() IS
  'Messages, cut 4c: who approves a change to a contract clause, and whose own changes publish at once: dev, the owner and the controller (the owner, 2026-10-12, and himself added 2026-11-08, punch list #188 row 30, v2.6762). Change the audience here, never in a function body. The client''s copy is GC_CLAUSE_APPROVE_TEAM in src/lib/gc/access.ts; access.test.ts fails when they differ.';

-- 4) Most recent emails sent (row 31)
DROP POLICY IF EXISTS email_send_log_master_or_dev_select ON public.email_send_log;
CREATE POLICY email_send_log_master_or_dev_select ON public.email_send_log FOR SELECT USING (public.is_master_or_dev());

-- 5) Usage (row 7): the four readouts, restated with the owner in the gate.
CREATE OR REPLACE FUNCTION public.usage_page_minutes(p_days integer DEFAULT 30)
RETURNS TABLE (role text, page text, minutes integer, people integer)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_master_or_dev() THEN
    RAISE EXCEPTION 'usage_page_minutes: the owner or a dev only';
  END IF;
  RETURN QUERY
  SELECT u.role::text, a.page::text,
         (sum(a.active_seconds) / 60)::int,
         count(DISTINCT a.user_id)::int
  FROM public.user_app_activity_page_daily a
  JOIN public.users u ON u.id = a.user_id
  WHERE a.activity_date >= current_date - LEAST(GREATEST(COALESCE(p_days, 30), 1), 365)
  GROUP BY u.role, a.page;
END;
$$;

CREATE OR REPLACE FUNCTION public.usage_nav_clicks(p_days integer DEFAULT 30)
RETURNS TABLE (role text, control text, target text, clicks integer, people integer)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_master_or_dev() THEN
    RAISE EXCEPTION 'usage_nav_clicks: the owner or a dev only';
  END IF;
  RETURN QUERY
  SELECT c.role::text, c.control::text, c.target::text,
         count(*)::int, count(DISTINCT c.user_id)::int
  FROM public.ui_nav_clicks c
  WHERE c.occurred_at >= now() - make_interval(days => LEAST(GREATEST(COALESCE(p_days, 30), 1), 365))
  GROUP BY c.role, c.control, c.target;
END;
$$;

CREATE OR REPLACE FUNCTION public.usage_customer_views(p_days integer DEFAULT 30)
RETURNS TABLE (surface text, bucket date, views integer, entities integer)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_days integer := LEAST(GREATEST(COALESCE(p_days, 30), 1), 365);
BEGIN
  IF NOT public.is_master_or_dev() THEN
    RAISE EXCEPTION 'usage_customer_views: the owner or a dev only';
  END IF;
  RETURN QUERY
  SELECT 'portal'::text, date_trunc('week', v.occurred_at)::date,
         count(*)::int, count(DISTINCT v.entity_id)::int
  FROM public.public_page_views v
  WHERE v.surface = 'portal' AND v.occurred_at >= now() - make_interval(days => v_days)
  GROUP BY 2
  UNION ALL
  SELECT 'estimate_accept'::text, date_trunc('week', e.occurred_at)::date,
         count(*)::int, count(DISTINCT e.estimate_id)::int
  FROM public.estimate_customer_events e
  WHERE e.event_type = 'public_link_view' AND e.occurred_at >= now() - make_interval(days => v_days)
  GROUP BY 2;
END;
$$;

CREATE OR REPLACE FUNCTION public.usage_user_minutes(p_days integer DEFAULT 30)
RETURNS TABLE (user_name text, role text, page text, minutes integer, active_days integer)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_master_or_dev() THEN
    RAISE EXCEPTION 'usage_user_minutes: the owner or a dev only';
  END IF;
  RETURN QUERY
  SELECT COALESCE(NULLIF(trim(u.name), ''), u.email)::text, u.role::text, a.page::text,
         (sum(a.active_seconds) / 60)::int,
         count(DISTINCT a.activity_date)::int
  FROM public.user_app_activity_page_daily a
  JOIN public.users u ON u.id = a.user_id
  WHERE a.activity_date >= current_date - LEAST(GREATEST(COALESCE(p_days, 30), 1), 365)
  GROUP BY u.id, u.name, u.email, u.role, a.page;
END;
$$;
