-- Controller role, part 2 of 2 (Phase 3 of the pay-visibility overhaul; RECENT_FEATURES v2.662).
--
-- controller = "acts like an assistant, sees like a dev on money": every assistant capability
-- (clock/hours/crew/contracts/licenses/…) plus payroll access (wages, pay stubs, Payroll tab,
-- cost matrix). NOT dev admin (user management, impersonation, backups, deletes).
--
-- Mechanics: is_assistant() becomes assistant-LIKE (assistant or controller) — one function
-- edit inherits every assistant grant consolidated in Phases 1–2. has_payroll_access() gains
-- is_controller(). Literal role lists (users visibility, v2.660 RPC gates, cost-matrix grantee
-- trigger, handle_new_user invite list) each add 'controller'.

-- 1) Capability functions ------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_controller()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'controller');
$$;

-- Assistant-LIKE: includes controller by design (v2.662) — every policy/function that grants
-- assistant capabilities automatically extends to controller. If you need strictly-assistant
-- semantics, compare users.role directly.
CREATE OR REPLACE FUNCTION public.is_assistant()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('assistant','controller'));
$$;

COMMENT ON FUNCTION public.is_assistant() IS
  'Assistant-LIKE (assistant or controller) since v2.662 — grants extend to controller automatically. Compare users.role directly for strictly-assistant semantics.';

CREATE OR REPLACE FUNCTION public.has_payroll_access()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_pay_approved_master() OR public.is_controller();
$$;

-- 2) users visibility: controller rows visible like assistant rows --------------------------------

DO $$
DECLARE
  pol record;
  new_qual text;
BEGIN
  SELECT * INTO pol FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'Users can select users';
  IF pol IS NULL THEN
    RAISE EXCEPTION 'users select policy not found';
  END IF;
  IF pol.qual ILIKE '%controller%' THEN
    RETURN; -- already applied
  END IF;
  new_qual := replace(pol.qual, '(role = ''assistant''::user_role)',
                      '(role = ANY (ARRAY[''assistant''::user_role, ''controller''::user_role]))');
  IF new_qual = pol.qual THEN
    RAISE EXCEPTION 'users select policy: assistant visibility branch not found — review manually';
  END IF;
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', pol.policyname);
  EXECUTE format('CREATE POLICY %I ON public.users FOR SELECT USING (%s)', pol.policyname, new_qual);
END $$;

-- 3) Literal role lists gain controller ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_people_pay_flags()
RETURNS TABLE(
  person_name text,
  person_id uuid,
  is_salary boolean,
  record_hours_but_salary boolean,
  show_in_hours boolean,
  show_in_cost_matrix boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'list_people_pay_flags: not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('dev','master_technician','assistant','controller')
  ) THEN
    RAISE EXCEPTION 'list_people_pay_flags: not allowed';
  END IF;
  RETURN QUERY
    SELECT pc.person_name, pc.person_id, pc.is_salary, pc.record_hours_but_salary,
           pc.show_in_hours, pc.show_in_cost_matrix
    FROM public.people_pay_config pc;
END $$;

CREATE OR REPLACE FUNCTION public.get_man_hours_by_job()
RETURNS TABLE(job_id text, person_name text, man_hours numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'get_man_hours_by_job: not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('dev','master_technician','assistant','controller')
  ) THEN
    RAISE EXCEPTION 'get_man_hours_by_job: not allowed';
  END IF;
  RETURN QUERY
  with crew as (
    select
      cj.work_date,
      cj.person_name,
      jsonb_array_elements(
        case when jsonb_typeof(cj.job_assignments) = 'array'
             then cj.job_assignments
             else '[]'::jsonb end
      ) as assignment
    from people_crew_jobs cj
  ),
  alloc as (
    select
      (c.assignment->>'job_id') as jid,
      c.person_name as pname,
      (case
         when coalesce(pc.is_salary, false)
           then case when extract(dow from c.work_date) between 1 and 5 then 8 else 0 end
         else coalesce(ph.hours, 0)
       end) * (coalesce(nullif(c.assignment->>'pct', '')::numeric, 0) / 100.0) as alloc_hours
    from crew c
    left join people_pay_config pc on pc.person_name = c.person_name
    left join people_hours ph
      on ph.person_name = c.person_name
     and ph.work_date = c.work_date
     and ph.work_date >= (current_date - interval '2 years')
    where coalesce(c.assignment->>'job_id', '') <> ''
  )
  select a.jid, a.pname, sum(a.alloc_hours) as man_hours
  from alloc a
  group by a.jid, a.pname
  having sum(a.alloc_hours) > 0;
END $$;

CREATE OR REPLACE FUNCTION public.cost_matrix_share_grantee_role_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = NEW.shared_with_user_id AND u.role IN ('dev','master_technician','controller')
  ) THEN
    RAISE EXCEPTION 'Cost matrix can only be shared with devs, master technicians, or controllers (the matrix exposes wage-derived numbers)';
  END IF;
  RETURN NEW;
END $$;

-- 4) Signup trigger accepts invited controller ------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  invited text := NEW.raw_user_meta_data->>'invited_role';
  r public.user_role;
BEGIN
  IF invited IN ('dev','master_technician','assistant','subcontractor',
                 'helpers','estimator','primary','superintendent','controller') THEN
    r := invited::public.user_role;
  ELSE
    r := 'helpers'::public.user_role;
  END IF;
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    r
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;
