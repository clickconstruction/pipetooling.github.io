-- Add a "Click Number" (C#) to jobs. Displayed in place of the HCP number when
-- the HCP number is empty (HCP wins). This migration adds the column and threads
-- it through the core job-fetch/search RPCs (Stages board, pickers, QuickFill).
-- Display precedence is resolved client-side (effectiveJobLedgerNumber); these
-- RPCs just need to (a) return click_number and (b) let search match it.
--
-- Mirrors hcp_number exactly: text NOT NULL DEFAULT '' + a btree index.
-- (Dashboard / tally / report / schedule RPCs + the long tail of display sites
--  follow in later PRs.)

alter table public.jobs_ledger
  add column if not exists click_number text not null default '';

create index if not exists idx_jobs_ledger_click_number
  on public.jobs_ledger (click_number);

-- Adding a return column requires DROP + CREATE (can't change a function's return
-- type in place); re-grant after each.

-- 1) get_jobs_ledger_by_ids — Stages board + by-id fetches.
drop function if exists public.get_jobs_ledger_by_ids(uuid[]);
create function public.get_jobs_ledger_by_ids(p_job_ids uuid[])
returns table(id uuid, hcp_number text, job_name text, job_address text, revenue numeric, pct_complete integer, service_type_id uuid, click_number text)
language sql stable security definer set search_path to 'public'
as $$
  select jl.id,
         coalesce(jl.hcp_number, '')::text,
         coalesce(jl.job_name, '')::text,
         coalesce(jl.job_address, '')::text,
         jl.revenue,
         jl.pct_complete,
         jl.service_type_id,
         coalesce(jl.click_number, '')::text
  from public.jobs_ledger jl
  where jl.id = any(p_job_ids);
$$;
grant all on function public.get_jobs_ledger_by_ids(uuid[]) to anon, authenticated, service_role;

-- 2) get_jobs_ledger_by_hcp_numbers — QuickFill lookup. Also resolve a click-only
--    job when its Click number is passed (hcp empty + click matches).
drop function if exists public.get_jobs_ledger_by_hcp_numbers(text[]);
create function public.get_jobs_ledger_by_hcp_numbers(p_hcp_numbers text[])
returns table(id uuid, hcp_number text, job_name text, job_address text, revenue numeric, pct_complete integer, service_type_id uuid, click_number text)
language sql stable security definer set search_path to 'public'
as $$
  select jl.id,
         coalesce(jl.hcp_number, '')::text,
         coalesce(jl.job_name, '')::text,
         coalesce(jl.job_address, '')::text,
         jl.revenue,
         jl.pct_complete,
         jl.service_type_id,
         coalesce(jl.click_number, '')::text
  from public.jobs_ledger jl
  where lower(trim(coalesce(jl.hcp_number, ''))) = any(
          select lower(trim(coalesce(x, ''))) from unnest(p_hcp_numbers) as x
        )
     or (
          trim(coalesce(jl.hcp_number, '')) = ''
          and trim(coalesce(jl.click_number, '')) <> ''
          and lower(trim(jl.click_number)) = any(
                select lower(trim(coalesce(x, ''))) from unnest(p_hcp_numbers) as x
              )
        );
$$;
grant all on function public.get_jobs_ledger_by_hcp_numbers(text[]) to anon, authenticated, service_role;

-- 3) search_jobs_ledger — job picker / global search. Return click_number, match
--    it in search (incl. the prefix-stripped "j…" / custom-prefix variants), and
--    order by the effective (hcp-else-click) value.
drop function if exists public.search_jobs_ledger(text);
create function public.search_jobs_ledger(search_text text default ''::text)
returns table(id uuid, service_type_id uuid, service_type_name text, hcp_number text, job_name text, job_address text, click_number text)
language sql stable security definer set search_path to 'public'
as $$
  select
    jl.id,
    jl.service_type_id,
    coalesce(stj.name, '')::text as service_type_name,
    coalesce(jl.hcp_number, '')::text,
    coalesce(jl.job_name, '')::text,
    coalesce(jl.job_address, '')::text,
    coalesce(jl.click_number, '')::text
  from public.jobs_ledger jl
  left join public.service_types stj on stj.id = jl.service_type_id
  where (
    search_text is null or search_text = ''
    or jl.hcp_number ilike '%' || search_text || '%'
    or jl.click_number ilike '%' || search_text || '%'
    or (
      length(search_text) >= 2
      and lower(left(search_text, 1)) = 'j'
      and (
        jl.hcp_number ilike '%' || substring(search_text from 2) || '%'
        or jl.click_number ilike '%' || substring(search_text from 2) || '%'
      )
    )
    or jl.job_name ilike '%' || search_text || '%'
    or jl.job_address ilike '%' || search_text || '%'
    or exists (
      select 1
      from public.service_types st
      where st.ledger_job_prefix is not null
        and btrim(st.ledger_job_prefix) <> ''
        and coalesce(search_text, '') <> ''
        and length(search_text) > length(btrim(st.ledger_job_prefix))
        and lower(search_text) like lower(btrim(st.ledger_job_prefix)) || '%'
        and (
          jl.hcp_number ilike '%' || substring(search_text from length(btrim(st.ledger_job_prefix)) + 1) || '%'
          or jl.click_number ilike '%' || substring(search_text from length(btrim(st.ledger_job_prefix)) + 1) || '%'
        )
    )
  )
  order by (case when coalesce(nullif(jl.hcp_number, ''), jl.click_number, '') = '' then 1 else 0 end),
           coalesce(nullif(jl.hcp_number, ''), jl.click_number, '') desc
  limit 50;
$$;
grant all on function public.search_jobs_ledger(text) to anon, authenticated, service_role;
