-- Man-hours allocated per job, for the Jobs → Stages board "man-hours applied" line.
--
-- Mirrors the canonical client kernel in src/utils/teamLabor.ts (loadTeamLaborData):
--   * Salaried people  -> 8h on Mon–Fri, 0h on weekends (people_hours ignored).
--   * Hourly people     -> people_hours.hours for that person/day, within the last 2 years.
--   * Each crew day's hours are split across that day's job_assignments by `pct`.
-- (work_date, person_name) is unique in people_crew_jobs, so this aggregation matches
-- the Combined-Labor / Teams-Summary tabs exactly.
--
-- Returns one row per (job_id, person_name) so the client can build both the per-job
-- total and the per-person hover breakdown. job_id is returned as text to match the
-- string job ids the client already keys on (jobs_ledger.id).
--
-- SECURITY INVOKER (default): runs under the caller's RLS. Roles without read access to
-- the labor tables simply get no rows (the Stages line shows "—") — no privilege escalation.

create or replace function public.get_man_hours_by_job()
returns table (job_id text, person_name text, man_hours numeric)
language sql
stable
security invoker
set search_path = public
as $$
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
      (c.assignment->>'job_id') as job_id,
      c.person_name,
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
  select a.job_id, a.person_name, sum(a.alloc_hours) as man_hours
  from alloc a
  group by a.job_id, a.person_name
  having sum(a.alloc_hours) > 0;
$$;

grant execute on function public.get_man_hours_by_job() to authenticated;
