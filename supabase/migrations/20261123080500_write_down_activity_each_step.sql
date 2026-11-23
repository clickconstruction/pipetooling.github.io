SET lock_timeout = '3s';

-- Every agreed write-down is a line on the job's activity (punch list #85, the owner's word "log each" on what v2.8305
-- found).
--
-- The invoice trigger (jobs_ledger_invoices_to_activity, 20260608010000, re-made in 20260922100000) logged a bill's
-- FIRST write-down only: its invoice_write_down line was written when agreed_write_down_at went from empty to set, and
-- a guard allowed one such line a bill. A second write-down left no line. The bill's own columns hold the newest
-- write-down's note, time and person, so from the third write-down on the steps in between were kept nowhere.
--
-- The function below is its live definition (md5 of pg_proc.prosrc on prod equal to 20260922100000's body,
-- 10d71c4a..., on 2026-11-22; no migration has re-made it since) with its write-down branch re-made and nothing else
-- touched:
--   * it writes a line whenever the stamp is new or has moved, so every write-down has one. Each writer stamps now(),
--     so each call is its own step. The guard is one line a bill a stamp, which keeps a replay from writing twice.
--   * the line is the step's own: its "before" is the amount the row held (old.amount), not the kept first amount
--     (v2.8305, 20261122234400), so a second step of 450 to 400 reads "$450.00 → $400.00", and a bill written down
--     again at the amount it stands at reads "$400.00 → $400.00" with its new note. The kept first amount stands in
--     only on an insert, or on a first stamp set with the amount untouched. detail carries the step in numbers too:
--     previous_amount, amount, and first_amount, the amount before the bill's first write-down.
--   * the person: auth.uid(), else agreed_write_down_by. The Stripe writer runs as the service role with the person
--     named in that column, so its lines had nobody (the invoice_sent branch took sent_by_user_id the same way in
--     20260922100000). The lookup through public.users keeps a person with no users row from failing the write-down.
--
-- The triggers themselves are as they were (after insert; after update of billed_at, sent_to_customer_at,
-- agreed_write_down_at), so a fee, which moves the amount alone, never reaches this branch. No table is created, no
-- column added, nothing backfilled: on prod on 2026-11-22 four bills were written down, none more than once, and each
-- has its line. Idempotent: CREATE OR REPLACE, which keeps the owner and the grants.
--
-- The stamp: first cut as 20261123001000, re-stamped from main's latest file (20261123040000, already on prod) when
-- the PR was opened, since a file older than the newest applied one is refused by a plain supabase db push.

create or replace function public.jobs_ledger_invoices_to_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amt text := '$' || to_char(coalesce(new.amount, 0), 'FM999,999,990.00');
  v_channel text := nullif(trim(coalesce(new.external_send_channel, '')), '');
  v_prev numeric := new.agreed_write_down_previous_amount;
begin
  if tg_op = 'INSERT' then
    insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    select new.job_id, 'invoice_created', coalesce(new.created_at, now()), auth.uid(),
           'Invoice created ' || v_amt,
           jsonb_build_object('invoice_id', new.id, 'source_id', new.id::text), true
    where not exists (select 1 from public.job_activity_events e where e.event_type = 'invoice_created' and e.detail ->> 'source_id' = new.id::text);
  end if;

  if new.billed_at is not null and (tg_op = 'INSERT' or old.billed_at is null) then
    insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    select new.job_id, 'invoice_billed', new.billed_at, auth.uid(), 'Marked billed ' || v_amt,
           jsonb_build_object('invoice_id', new.id, 'source_id', new.id::text), true
    where not exists (select 1 from public.job_activity_events e where e.event_type = 'invoice_billed' and e.detail ->> 'source_id' = new.id::text);
  end if;

  if new.sent_to_customer_at is not null and (tg_op = 'INSERT' or old.sent_to_customer_at is null) then
    insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    select new.job_id, 'invoice_sent', new.sent_to_customer_at, coalesce(auth.uid(), new.sent_by_user_id),
           'Invoice sent to customer' || coalesce(' (' || v_channel || ')', ''),
           jsonb_build_object('invoice_id', new.id, 'source_id', new.id::text, 'channel', new.external_send_channel), true
    where not exists (select 1 from public.job_activity_events e where e.event_type = 'invoice_sent' and e.detail ->> 'source_id' = new.id::text);
  end if;

  -- Every write-down is a line (v2.8319): the stamp is new or has moved, and the line is this step's own.
  if new.agreed_write_down_at is not null and (tg_op = 'INSERT' or new.agreed_write_down_at is distinct from old.agreed_write_down_at) then
    -- This step's "before" is the amount the row held; the column keeps the amount before the FIRST write-down, and
    -- stands in only on an insert or on a first stamp set with the amount untouched.
    if tg_op = 'UPDATE' and (old.amount is distinct from new.amount or old.agreed_write_down_at is not null) then
      v_prev := old.amount;
    end if;
    insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    select new.job_id, 'invoice_write_down', new.agreed_write_down_at,
           coalesce(auth.uid(), (select u.id from public.users u where u.id = new.agreed_write_down_by)),
           'Agreed write-down: '
             || coalesce('$' || to_char(v_prev, 'FM999,999,990.00') || ' → ', '') || v_amt
             || coalesce(' — ' || nullif(trim(coalesce(new.agreed_write_down_note, '')), ''), ''),
           jsonb_build_object('invoice_id', new.id, 'source_id', new.id::text, 'previous_amount', v_prev,
                              'amount', new.amount, 'first_amount', new.agreed_write_down_previous_amount), true
    where not exists (select 1 from public.job_activity_events e
                      where e.event_type = 'invoice_write_down' and e.detail ->> 'source_id' = new.id::text
                        and e.occurred_at = new.agreed_write_down_at);
  end if;

  return new;
end;
$$;
