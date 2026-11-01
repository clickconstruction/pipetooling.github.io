SET lock_timeout = '3s';

-- The courtesy notice's line in the job's trail (punch list #231, v2.6269). A press on the Lien desk's sent footer
-- (v2.6261) appends one record to the sent § 53.056 desk item's fields.courtesy[] — when, who pressed, each address
-- and whether it went, the lien day the message named. The first cut wrote the trail line from the client; the table
-- takes no client insert (its lines are the triggers' and the RPCs'), so the line never landed. This writes it the way
-- the notice's and the demand letter's lines are written (20261019030000): one function reads the record off the row,
-- an AFTER UPDATE trigger calls it, a line that cannot be written is a warning and never costs the record, and the
-- backfill at the end writes the lines for presses already made. Guarded by (event_type, detail->>'source_id') =
-- ('lien_courtesy_sent', '<item id>:<index>'), one per press. A press where nothing went (every channel refused) is no
-- line. Financial, in the Billing bucket, like the notice's line. No table, so no RLS fences.

create or replace function public.job_activity_line_lien_courtesy(it public.job_lien_desk_items)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_arr jsonb := case when jsonb_typeof(it.fields -> 'courtesy') = 'array' then it.fields -> 'courtesy' else '[]'::jsonb end;
  r record;
  v_sid text;
  v_how text;
  v_at timestamptz;
  v_day text;
  v_claim numeric;
begin
  if it.kind is distinct from 'notice_53_056' or it.voided_at is not null then
    return;
  end if;

  for r in
    select c.v, c.n
    from jsonb_array_elements(v_arr) with ordinality as c(v, n)
    where jsonb_typeof(c.v) = 'object'
  loop
    v_sid := it.id::text || ':' || (r.n - 1)::text;

    -- The channels that went, "email to the GC and the owner, text to the GC"; email first.
    select string_agg(x.words, ', ' order by x.ord)
      into v_how
    from (
      select ch.channel,
             case ch.channel when 'email' then 1 else 2 end as ord,
             ch.channel || ' to ' || string_agg(distinct case ch.who when 'owner' then 'the owner' else 'the GC' end, ' and ') as words
      from (
        select t.v ->> 'channel' as channel, t.v ->> 'who' as who
        from jsonb_array_elements(case when jsonb_typeof(r.v -> 'to') = 'array' then r.v -> 'to' else '[]'::jsonb end) as t(v)
        where jsonb_typeof(t.v) = 'object' and (t.v ->> 'ok') = 'true' and (t.v ->> 'channel') in ('email', 'text')
      ) ch
      group by ch.channel
    ) x;
    if v_how is null then
      continue;
    end if;

    begin
      v_at := (r.v ->> 'at')::timestamptz;
    exception when others then
      v_at := null;
    end;
    v_day := case when (r.v ->> 'lienDay') ~ '^\d{4}-\d{2}-\d{2}$' then r.v ->> 'lienDay' end;
    v_claim := case when (r.v ->> 'claim') ~ '^[0-9]+(\.[0-9]+)?$' then (r.v ->> 'claim')::numeric else 0 end;

    insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    select it.job_id, 'lien_courtesy_sent',
           coalesce(v_at, now()),
           null,
           'Courtesy notice sent' || coalesce(' by ' || nullif(trim(r.v ->> 'by'), ''), '')
             || ' · ' || v_how
             || coalesce(' · named ' || to_char(v_day::date, 'FMMon FMDD, YYYY'), '')
             || ' — $' || to_char(v_claim, 'FM999,999,990.00'),
           jsonb_build_object('source_id', v_sid, 'item_id', it.id, 'lien_day', v_day, 'claim', v_claim, 'to', r.v -> 'to'),
           true
    where not exists (
      select 1 from public.job_activity_events x
      where x.event_type = 'lien_courtesy_sent' and x.detail ->> 'source_id' = v_sid
    );
  end loop;
end;
$$;

-- The trigger: on an update of the item's fields, the function with the new row; a line that fails is a warning, never
-- a lost record (the office's own update of its item fires it, so the definer writes the line the policy would refuse).
create or replace function public.job_lien_desk_items_courtesy_to_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.job_activity_line_lien_courtesy(new);
  exception when others then
    raise warning 'job_lien_desk_items_courtesy_to_activity: % (%)', sqlerrm, sqlstate;
  end;
  return new;
end;
$$;

drop trigger if exists job_lien_desk_items_courtesy_to_activity on public.job_lien_desk_items;
create trigger job_lien_desk_items_courtesy_to_activity
  after update of fields on public.job_lien_desk_items
  for each row
  when (new.fields ? 'courtesy')
  execute function public.job_lien_desk_items_courtesy_to_activity();

-- Neither is called by hand.
revoke all on function public.job_activity_line_lien_courtesy(public.job_lien_desk_items) from public, anon, authenticated;
revoke all on function public.job_lien_desk_items_courtesy_to_activity() from public, anon, authenticated;

-- The presses already made (v2.6261 shipped before this), each its line.
do $$
declare
  it public.job_lien_desk_items;
begin
  for it in select * from public.job_lien_desk_items where fields ? 'courtesy' and voided_at is null loop
    perform public.job_activity_line_lien_courtesy(it);
  end loop;
end
$$;
