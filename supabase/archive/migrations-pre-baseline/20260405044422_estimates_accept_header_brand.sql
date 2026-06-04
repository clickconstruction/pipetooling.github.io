-- Per-estimate logo on customer acceptance page (electrical vs plumbing).
alter table public.estimates
  add column if not exists accept_header_brand text;

alter table public.estimates
  drop constraint if exists estimates_accept_header_brand_check;

alter table public.estimates
  add constraint estimates_accept_header_brand_check
  check (
    accept_header_brand is null
    or accept_header_brand in ('elec', 'plum')
  );

comment on column public.estimates.accept_header_brand is
  'Optional acceptance-page header logo: elec (electrical) or plum (plumbing).';
