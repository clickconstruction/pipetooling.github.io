SET lock_timeout = '3s';

-- GC Review "Share all" (v2.1420): the send-gc-statement-email edge function
-- now also sends the FULL GC Review report (every GC/development section plus
-- the grand total) in one email, audited with group_by = 'all' and no
-- gc_customer_id. Widen the audit table's CHECK to accept it.
--
-- Ordering: tolerant. The edge function swallows audit-insert failures (the
-- email is already sent), so a deployed function racing this push only loses
-- audit rows, never sends. Apply with the normal post-merge `supabase db push`.

begin;

alter table public.gc_statement_emails
  drop constraint if exists gc_statement_emails_group_by_check;

alter table public.gc_statement_emails
  add constraint gc_statement_emails_group_by_check
  check (group_by in ('gc', 'development', 'all'));

commit;
