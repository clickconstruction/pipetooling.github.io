-- Stand-in schema for supabase/tests/my_time_day_save (v2.4063): clock_sessions with its real
-- RLS policies, people_hours, the role helpers as settings, the real
-- recompute_people_hours_after_session_edit, and recording stand-ins for the six split / replace
-- RPCs. Run by hand against a throwaway Postgres 15 — see
-- docs/migrations/20260928182140_save_my_time_day.md. Never against prod.
DROP DATABASE IF EXISTS bed;
CREATE DATABASE bed;
\c bed
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('bed.uid', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated, anon;
GRANT USAGE ON SCHEMA public TO authenticated, anon;

CREATE TABLE public.users (id uuid PRIMARY KEY, name text NOT NULL);
INSERT INTO public.users VALUES
 ('00000000-0000-0000-0000-00000000000a', 'Ana Worker'),
 ('00000000-0000-0000-0000-00000000000b', 'Ben Other'),
 ('00000000-0000-0000-0000-00000000000c', 'Cal Lead'),
 ('00000000-0000-0000-0000-00000000000d', 'Dee Payroll');

-- Role helpers: the caller is a lead of everyone when bed.lead = on; pay access when bed.pay = on.
CREATE FUNCTION public.is_pay_approved_master() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT COALESCE(current_setting('bed.pay', true), '') = 'on' $$;
CREATE FUNCTION public.is_assistant_of_pay_approved_master() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION public.is_assistant() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION public.is_dev() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION public.is_team_lead_for_member(p_lead uuid, p_member uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT COALESCE(current_setting('bed.lead', true), '') = 'on' AND p_lead <> p_member $$;
CREATE FUNCTION public.resolve_pay_person_id_from_clock_user(p_user uuid, p_name text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;

CREATE TABLE public.clock_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  clocked_in_at timestamptz NOT NULL,
  clocked_out_at timestamptz,
  work_date date NOT NULL,
  approved_at timestamptz,
  notes text DEFAULT '' NOT NULL,
  job_ledger_id uuid,
  rejected_at timestamptz,
  revoked_at timestamptz,
  bid_id uuid,
  origin text DEFAULT 'user_punch' NOT NULL,
  salary_segment_index smallint,
  CONSTRAINT clock_sessions_job_or_bid_not_both CHECK (NOT (job_ledger_id IS NOT NULL AND bid_id IS NOT NULL)),
  CONSTRAINT clock_sessions_origin_check CHECK (origin = ANY (ARRAY['user_punch', 'salary_schedule']))
);
ALTER TABLE public.clock_sessions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clock_sessions TO authenticated;
-- The production policies, verbatim but for quoting.
CREATE POLICY "Devs can read all clock sessions" ON public.clock_sessions FOR SELECT USING (public.is_dev());
CREATE POLICY "Devs can update all clock sessions" ON public.clock_sessions FOR UPDATE USING (public.is_dev()) WITH CHECK (public.is_dev());
CREATE POLICY "Pay access can insert clock sessions" ON public.clock_sessions FOR INSERT WITH CHECK ((public.is_pay_approved_master() OR public.is_assistant_of_pay_approved_master() OR public.is_assistant()) AND origin = 'user_punch');
CREATE POLICY "Pay access can read all clock sessions" ON public.clock_sessions FOR SELECT USING (public.is_pay_approved_master() OR public.is_assistant_of_pay_approved_master());
CREATE POLICY "Team leads can read member clock sessions" ON public.clock_sessions FOR SELECT USING (public.is_team_lead_for_member((SELECT auth.uid()), user_id));
CREATE POLICY "Team leads can update member clock sessions" ON public.clock_sessions FOR UPDATE USING (public.is_team_lead_for_member((SELECT auth.uid()), user_id)) WITH CHECK (public.is_team_lead_for_member((SELECT auth.uid()), user_id));
CREATE POLICY "Users and pay access can update clock sessions" ON public.clock_sessions FOR UPDATE USING (user_id = (SELECT auth.uid()) OR public.is_pay_approved_master() OR public.is_assistant_of_pay_approved_master()) WITH CHECK (user_id = (SELECT auth.uid()) OR public.is_pay_approved_master() OR public.is_assistant_of_pay_approved_master());
CREATE POLICY "Users can insert own clock sessions" ON public.clock_sessions FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()) AND origin = 'user_punch');
CREATE POLICY "Users can read own clock sessions" ON public.clock_sessions FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE TABLE public.people_hours (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  person_name text NOT NULL,
  work_date date NOT NULL,
  hours numeric(8,4) DEFAULT 0 NOT NULL,
  entered_by uuid,
  person_id uuid,
  UNIQUE (person_name, work_date)
);
GRANT SELECT ON public.people_hours TO authenticated;

-- Recording stand-ins for the six RPCs (the real ones are SECURITY DEFINER and keep their own
-- checks; they are not what is under test). Each logs its call and writes a marker note, so a
-- rollback can be seen to undo it; bed.rpc_error makes it answer with that error_message.
CREATE TABLE public.rpc_log (n serial PRIMARY KEY, fn text NOT NULL, ids uuid[] NOT NULL, segments jsonb);
GRANT SELECT ON public.rpc_log TO authenticated;
CREATE FUNCTION public.bed_rpc(p_fn text, p_ids uuid[], p_segments jsonb)
RETURNS TABLE(inserted_ids uuid[], error_message text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.rpc_log (fn, ids, segments) VALUES (p_fn, p_ids, p_segments);
  UPDATE public.clock_sessions SET notes = 'rpc:' || p_fn WHERE id = ANY (p_ids);
  RETURN QUERY SELECT ARRAY[]::uuid[], NULLIF(current_setting('bed.rpc_error', true), '');
END $$;
CREATE FUNCTION public.split_own_clock_session_segments(p_session_id uuid, p_segments jsonb) RETURNS TABLE(inserted_ids uuid[], error_message text) LANGUAGE sql SECURITY DEFINER AS $$ SELECT * FROM public.bed_rpc('split_own_segments', ARRAY[p_session_id], p_segments) $$;
CREATE FUNCTION public.leader_split_clock_session_segments(p_session_id uuid, p_segments jsonb) RETURNS TABLE(inserted_ids uuid[], error_message text) LANGUAGE sql SECURITY DEFINER AS $$ SELECT * FROM public.bed_rpc('leader_split_segments', ARRAY[p_session_id], p_segments) $$;
CREATE FUNCTION public.split_own_clock_session_cluster(p_session_ids uuid[], p_segments jsonb) RETURNS TABLE(inserted_ids uuid[], error_message text) LANGUAGE sql SECURITY DEFINER AS $$ SELECT * FROM public.bed_rpc('split_own_cluster', p_session_ids, p_segments) $$;
CREATE FUNCTION public.leader_split_clock_session_cluster(p_session_ids uuid[], p_segments jsonb) RETURNS TABLE(inserted_ids uuid[], error_message text) LANGUAGE sql SECURITY DEFINER AS $$ SELECT * FROM public.bed_rpc('leader_split_cluster', p_session_ids, p_segments) $$;
CREATE FUNCTION public.replace_own_clock_session_cluster_mixed(p_session_ids uuid[], p_segments jsonb) RETURNS TABLE(inserted_ids uuid[], error_message text) LANGUAGE sql SECURITY DEFINER AS $$ SELECT * FROM public.bed_rpc('replace_own_mixed', p_session_ids, p_segments) $$;
CREATE FUNCTION public.leader_replace_clock_session_cluster_mixed(p_session_ids uuid[], p_segments jsonb) RETURNS TABLE(inserted_ids uuid[], error_message text) LANGUAGE sql SECURITY DEFINER AS $$ SELECT * FROM public.bed_rpc('leader_replace_mixed', p_session_ids, p_segments) $$;

-- The real people_hours resync (migration 20260616045050), copied verbatim.
create or replace function public.recompute_people_hours_after_session_edit(
  p_session_id uuid,
  p_old_work_date date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_person_name text;
  v_person_id uuid;
  v_cur_work_date date;
  v_date date;
  v_sum numeric;
begin
  select cs.user_id, trim(u.name), cs.work_date
    into v_user_id, v_person_name, v_cur_work_date
  from public.clock_sessions cs
  join public.users u on u.id = cs.user_id
  where cs.id = p_session_id;

  -- Session/user gone, or no payroll name to key people_hours on: nothing to do.
  if v_user_id is null or v_person_name is null or v_person_name = '' then
    return;
  end if;

  if not (
    public.is_pay_approved_master()
    or public.is_assistant_of_pay_approved_master()
    or public.is_assistant()
    or public.is_team_lead_for_member(auth.uid(), v_user_id)
    or auth.uid() = v_user_id
  ) then
    raise exception 'Access denied';
  end if;

  v_person_id := public.resolve_pay_person_id_from_clock_user(v_user_id, v_person_name);

  -- Recompute the current (post-edit) day, plus the pre-edit day if the session moved across days.
  for v_date in
    select distinct d
    from (values (v_cur_work_date), (p_old_work_date)) as t(d)
    where d is not null
  loop
    select coalesce(sum(extract(epoch from (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0), 0)
      into v_sum
    from public.clock_sessions cs
    where cs.user_id = v_user_id
      and cs.work_date = v_date
      and cs.clocked_out_at is not null
      and cs.approved_at is not null
      and cs.revoked_at is null
      and cs.rejected_at is null;

    insert into public.people_hours (person_name, work_date, hours, entered_by, person_id)
    values (v_person_name, v_date, v_sum, auth.uid(), v_person_id)
    on conflict (person_name, work_date) do update set
      hours = excluded.hours,
      entered_by = excluded.entered_by,
      person_id = coalesce(public.people_hours.person_id, excluded.person_id);
  end loop;
end;
$$;

GRANT EXECUTE ON FUNCTION public.recompute_people_hours_after_session_edit(uuid, date) TO authenticated;
