-- Classify each accounting category (mercury_drag_sort_labels) by account type so
-- Category Review can build P&L and (cash-basis) Balance Sheet views.
--   income / expense  → Profit & Loss
--   asset / liability / equity → Balance Sheet
--   transfer → internal account-to-account movement, excluded from both
-- NULL = unclassified (surfaced as "Uncategorized" in the views).

alter table public.mercury_drag_sort_labels
  add column if not exists account_type text;

alter table public.mercury_drag_sort_labels
  drop constraint if exists mercury_drag_sort_labels_account_type_chk;
alter table public.mercury_drag_sort_labels
  add constraint mercury_drag_sort_labels_account_type_chk
  check (account_type is null or account_type in ('asset','liability','equity','income','expense','transfer'));

-- Seed the built-ins.
update public.mercury_drag_sort_labels set account_type = 'income'   where default_key = 'income_part_i';
update public.mercury_drag_sort_labels set account_type = 'transfer' where default_key = 'internal_transfers';
update public.mercury_drag_sort_labels set account_type = 'expense'  where default_key = 'cogs_part_iii';
update public.mercury_drag_sort_labels set account_type = 'equity'   where name = 'Owners Equity' and account_type is null;
-- Everything else that is a built-in Schedule-C category is an expense.
update public.mercury_drag_sort_labels
  set account_type = 'expense'
  where account_type is null
    and default_key is not null
    and default_key not in ('income_part_i', 'internal_transfers');

-- Relax the system-field guard: lock only the stable identity (default_key,
-- is_system_default). Name / schedule_c_line / description / account_type become
-- editable on every category (the Category Detail modal needs this). Renaming a
-- built-in is cosmetic — code keys off default_key, never name.
create or replace function public.mercury_drag_sort_labels_guard_system_fields()
returns trigger
language plpgsql
as $function$
begin
  if old.is_system_default
     and (
       new.default_key is distinct from old.default_key
       or new.is_system_default is distinct from old.is_system_default
     )
  then
    raise exception 'Built-in category identity (default_key) cannot be changed'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;
