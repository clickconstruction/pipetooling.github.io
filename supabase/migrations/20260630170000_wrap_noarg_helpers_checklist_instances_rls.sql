-- Wrap no-arg STABLE RLS helpers in (select ...) on checklist_instances policies so
-- Postgres evaluates them ONCE per query (InitPlan) instead of once per scanned row.
--
-- Why: checklist_instances is tiny (~2.5k rows) but the "my open instances" read
-- (PostgREST, ~400 calls in the 6-day window, 271s total — the 2nd-heaviest query
-- on the DB after Realtime WAL CDC) seq-scans every open row and re-evaluates
-- is_dev_or_master_or_assistant() PER ROW. Measured under RLS as a dev user:
--   before: 76.9 ms, 5283 shared buffers
--   after : 39.7 ms, 2860 shared buffers   (~2x faster, buffers halved)
-- For staff the wrapped helper short-circuits the whole policy at InitPlan; for
-- everyone it removes ~2.5k per-row SECURITY DEFINER calls. The buffer halving is
-- the load-relevant part — fewer shared-buffer touches per call x hundreds of
-- calls x concurrency = less pool pressure during the spikes that trip the
-- 2026-06-05 / 06-24 / 06-30 connection-pool-exhaustion outages.
--
-- Same proven, semantics-preserving transform PR #86 applied to the 5 hot Realtime
-- tables (clock_sessions, people_crew_*, people_hours, reports). A no-arg STABLE
-- function returns the same value whether evaluated once or per row, so wrapping it
-- in a scalar subquery changes ONLY when it runs, never the result / row visibility.
--
-- Helpers wrapped (both no-arg, STABLE, SECURITY DEFINER):
--   is_dev_or_master_or_assistant()
--   can_define_task_style_checklist_items()
-- Left unwrapped (correctly): checklist_item_created_by_auth_user(checklist_item_id)
--   takes a per-row arg (cannot be an InitPlan); auth.uid() is already (select ...)-wrapped.
--
-- Policy names / commands / row visibility are unchanged — only the helper call sites
-- gain a (select ...) wrapper.

-- SELECT (hot read path)
drop policy if exists "Users read instances where assigned or dev master assistant" on public.checklist_instances;
create policy "Users read instances where assigned or dev master assistant"
  on public.checklist_instances
  for select
  using (
    (select public.is_dev_or_master_or_assistant())
    or exists (
      select 1 from public.checklist_instance_assignees cia
      where cia.checklist_instance_id = checklist_instances.id
        and cia.user_id = (select auth.uid())
    )
    or public.checklist_item_created_by_auth_user(checklist_item_id)
  );

-- UPDATE
drop policy if exists "Users update instances where assigned or staff" on public.checklist_instances;
create policy "Users update instances where assigned or staff"
  on public.checklist_instances
  for update
  using (
    (select public.is_dev_or_master_or_assistant())
    or exists (
      select 1 from public.checklist_instance_assignees
      where checklist_instance_assignees.checklist_instance_id = checklist_instances.id
        and checklist_instance_assignees.user_id = (select auth.uid())
    )
  )
  with check (
    (select public.is_dev_or_master_or_assistant())
    or exists (
      select 1 from public.checklist_instance_assignees
      where checklist_instance_assignees.checklist_instance_id = checklist_instances.id
        and checklist_instance_assignees.user_id = (select auth.uid())
    )
  );

-- INSERT
drop policy if exists "Devs masters assistants can insert instances" on public.checklist_instances;
create policy "Devs masters assistants can insert instances"
  on public.checklist_instances
  for insert
  with check (
    (select public.is_dev_or_master_or_assistant())
    or (
      (select public.can_define_task_style_checklist_items())
      and public.checklist_item_created_by_auth_user(checklist_item_id)
    )
  );

-- DELETE
drop policy if exists "Devs masters assistants can delete instances" on public.checklist_instances;
create policy "Devs masters assistants can delete instances"
  on public.checklist_instances
  for delete
  using ( (select public.is_dev_or_master_or_assistant()) );
