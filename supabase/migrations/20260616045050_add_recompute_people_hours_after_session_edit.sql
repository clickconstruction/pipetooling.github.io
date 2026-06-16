-- Resync people_hours after a clock session's times are edited in place.
--
-- people_hours is maintained INCREMENTALLY by approve_clock_sessions (+duration) and
-- revoke/reject (-duration), keyed on (person_name, work_date). Editing an already-approved
-- session's clocked_in_at/clocked_out_at via "Adjust times" updates clock_sessions directly and
-- never applies the duration delta, so the stored payroll hours (and the People → Hours grid,
-- which shows max(people_hours, pending clock)) stay frozen at the old value.
--
-- This RPC recomputes people_hours for the affected day(s) from the current approved sessions —
-- the same `EXTRACT(EPOCH …)/3600` duration and person-name mapping approve_clock_sessions uses.
-- It is idempotent (sets the absolute sum, not a delta) and is called explicitly from the Adjust
-- times save path only, so it does not double-count with the cluster/split RPCs that maintain
-- people_hours themselves. Pass the pre-edit work_date so a cross-day move resyncs both days.
--
-- SECURITY DEFINER (mirrors approve_clock_sessions) so team leads can resync their crew's hours;
-- guarded to the same actors (pay roles / team lead / the user themselves). The operation can only
-- set people_hours to the true sum of already-approved sessions, so it grants no extra capability.

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

grant execute on function public.recompute_people_hours_after_session_edit(uuid, date) to authenticated;
