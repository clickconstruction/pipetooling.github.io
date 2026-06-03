-- Allow manually-imported (non-Mercury) transactions to live in mercury_transactions
-- so every Banking feature (Ledger, User Review, Accounting, Drag Sort, labels,
-- attributions, job allocations — all keyed off mercury_transactions.id) works on
-- them with no downstream changes. Used by the "Import transactions (CSV)" feature
-- for closed / external bank accounts.
--
-- mercury_id becomes nullable: manual rows have a NULL mercury_id. The existing
-- UNIQUE index mercury_transactions_mercury_id_key permits unlimited NULLs (NULLs
-- are distinct), so the Mercury sync's upsert `on conflict (mercury_id)` keeps
-- working unchanged for real Mercury rows.
--
-- Manual rows carry source='manual', a synthetic mercury_account_id (a generated
-- uuid surfaced in the Ledger via a mercury_account_nicknames row), the importing
-- user (created_by) and a per-upload batch id (manual_upload_id) for audit / undo.
-- Inserts are performed by the `import-manual-transactions` edge function under the
-- service role; client INSERT on this table stays blocked by the existing RLS.

alter table public.mercury_transactions
  alter column mercury_id drop not null;

alter table public.mercury_transactions
  add column if not exists source text not null default 'mercury',
  add column if not exists manual_upload_id uuid,
  add column if not exists created_by uuid references public.users(id);

alter table public.mercury_transactions
  drop constraint if exists mercury_transactions_source_chk;
alter table public.mercury_transactions
  add constraint mercury_transactions_source_chk check (source in ('mercury', 'manual'));

-- A Mercury row always has a mercury_id; a manual row never does.
alter table public.mercury_transactions
  drop constraint if exists mercury_transactions_source_provenance_chk;
alter table public.mercury_transactions
  add constraint mercury_transactions_source_provenance_chk
  check ((source = 'mercury' and mercury_id is not null)
      or (source = 'manual'  and mercury_id is null));

create index if not exists mercury_transactions_manual_upload_idx
  on public.mercury_transactions (manual_upload_id)
  where manual_upload_id is not null;
