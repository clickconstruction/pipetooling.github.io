SET lock_timeout = '3s';

-- A lien notice closed because the job was paid: its line in the job's trail (v2.7359). The run's Close paid
-- notices press (v2.7353) sets the § 53.056 desk item aside (voided_at) and keeps one record on it,
-- fields.runClosedPaid — when, who, when its packet printed, what the paper claimed. Every desk reader skips a voided
-- item, so without a line the job's history never says a notice was drafted, printed and then not sent. The table
-- takes no client insert (its lines are the triggers' and the RPCs'), so this writes it the way the courtesy
-- notice's line is written (20261101092703): one function reads the record off the row, an AFTER UPDATE trigger
-- calls it, a line that cannot be written is a warning and never costs the close, and the backfill at the end writes
-- the lines for closes already made. Guarded by (event_type, detail->>'source_id') = ('lien_notice_closed_paid',
-- '<item id>'), one per notice. Financial, in the Billing bucket, like the notice's line. No table, so no RLS fences.

create or replace function public.job_activity_line_lien_closed_paid(it public.job_lien_desk_items)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_rec jsonb := case when jsonb_typeof(it.fields -> 'runClosedPaid') = 'object' then it.fields -> 'runClosedPaid' end;
  v_sid text := it.id::text;
  v_at timestamptz;
  v_by text;
  v_months text;
  v_claim numeric;
  v_printed timestamptz;
begin
  -- Only a monthly notice the press set aside: the record without voided_at is not a close.
  if it.kind is distinct from 'notice_53_056' or it.voided_at is null or v_rec is null then
    return;
  end if;

  begin
    v_at := (v_rec ->> 'at')::timestamptz;
  exception when others then
    v_at := null;
  end;
  begin
    v_printed := (v_rec ->> 'printedAt')::timestamptz;
  exception when others then
    v_printed := null;
  end;
  v_by := nullif(trim(v_rec ->> 'byName'), '');
  v_claim := case when (v_rec ->> 'paperClaim') ~ '^[0-9]+(\.[0-9]+)?$' then (v_rec ->> 'paperClaim')::numeric end;

  -- "Sep 2026 and Oct 2026", in month order.
  select string_agg(to_char(to_date(m.v || '-01', 'YYYY-MM-DD'), 'FMMon YYYY'), ' and ' order by m.v)
    into v_months
  from unnest(coalesce(it.months, '{}'::text[])) as m(v)
  where m.v ~ '^\d{4}-(0[1-9]|1[0-2])$';

  insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
  select it.job_id, 'lien_notice_closed_paid',
         coalesce(v_at, it.voided_at, now()),
         null,
         'Lien notice' || coalesce(' for ' || v_months, '') || ' closed' || coalesce(' by ' || v_by, '')
           || ' · the job was paid, nothing was mailed'
           || coalesce(' — the paper said $' || to_char(v_claim, 'FM999,999,990.00'), ''),
         jsonb_build_object('source_id', v_sid, 'item_id', it.id, 'months', to_jsonb(coalesce(it.months, '{}'::text[])), 'paper_claim', v_claim, 'printed_at', v_printed),
         true
  where not exists (
    select 1 from public.job_activity_events x
    where x.event_type = 'lien_notice_closed_paid' and x.detail ->> 'source_id' = v_sid
  );
end;
$$;

-- The trigger: on the update that sets the item aside, the function with the new row; a line that fails is a
-- warning, never a lost close (the office's own update of its item fires it, so the definer writes the line the
-- policy would refuse).
create or replace function public.job_lien_desk_items_closed_paid_to_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.job_activity_line_lien_closed_paid(new);
  exception when others then
    raise warning 'job_lien_desk_items_closed_paid_to_activity: % (%)', sqlerrm, sqlstate;
  end;
  return new;
end;
$$;

drop trigger if exists job_lien_desk_items_closed_paid_to_activity on public.job_lien_desk_items;
create trigger job_lien_desk_items_closed_paid_to_activity
  after update of voided_at, fields on public.job_lien_desk_items
  for each row
  when (new.voided_at is not null and new.fields ? 'runClosedPaid')
  execute function public.job_lien_desk_items_closed_paid_to_activity();

-- Neither is called by hand.
revoke all on function public.job_activity_line_lien_closed_paid(public.job_lien_desk_items) from public, anon, authenticated;
revoke all on function public.job_lien_desk_items_closed_paid_to_activity() from public, anon, authenticated;

-- The closes already made (v2.7353 shipped before this), each its line.
do $$
declare
  it public.job_lien_desk_items;
begin
  for it in select * from public.job_lien_desk_items where fields ? 'runClosedPaid' and voided_at is not null loop
    perform public.job_activity_line_lien_closed_paid(it);
  end loop;
end
$$;
