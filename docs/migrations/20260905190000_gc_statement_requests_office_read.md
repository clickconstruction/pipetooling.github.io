# 20260905190000_gc_statement_requests_office_read.sql (2026-09-05, v2.2881)

Journey-map Tier-2 #45 — three statement lanes, one shared view. Policy-only; idempotent; no table changes; no new grants.

**1. `gc_statement_email_requests` SELECT widens to the GC Review cohort.** Drops `"Creators and devs read gc statement email requests"` (`requested_by = auth.uid() OR is_dev()`, 20260806233713) and creates `"Office reads gc statement email requests"`:

```sql
requested_by = (SELECT auth.uid())
OR public.is_dev()
OR public.is_assistant()            -- assistant + controller (v2.662)
OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role IN ('master_technician', 'primary'))
```

This is the same predicate the table's INSERT policy has named since 20260806233713 — whoever may schedule a send may now see every scheduled send. **Cancel stays owner-only**: the DELETE policy `"Creators cancel own unsent gc statement email requests"` (`requested_by = auth.uid() AND sent_at IS NULL OR is_dev()`) is deliberately not re-declared, and there is still no client UPDATE policy (the service-role dispatcher stamps rows). The client's `canCancelStatementRequest` mirrors the DELETE rule for the button.

**2. `email_send_log` gains an additive office read for the two GC-statement types.** New permissive policy `email_send_log_statement_office_select`: the same cohort may SELECT rows where `email_type IN ('gc_statement_manual', 'gc_statement_scheduled')`. The dev-only `email_send_log_dev_select` (20260803193428) stays; policies OR, so devs lose nothing and the office gains only the statement rows (lane via `email_type`, delivery state via `last_event`), which the per-GC "What went out" list joins to `gc_statement_emails` by `resend_email_id`.

**Verify after push** (as an assistant, controller, master or primary — not the requester of the rows):

```sql
-- 1. Every pending scheduled send is visible, whoever requested it:
select id, requested_by, entity_name, sent_to, send_at from public.gc_statement_email_requests where sent_at is null order by send_at;
-- 2. Cancel is still refused for another person's row (0 rows deleted, no error):
delete from public.gc_statement_email_requests where id = '<someone else''s pending id>';
-- 3. Only statement rows of the org log are readable:
select email_type, count(*) from public.email_send_log group by 1;  -- only the two gc_statement_* types (nulls/others absent)
```

In the app: open GC Review as an assistant → the "Scheduled statement sends" box lists the standing "All GCs → …" chains with `by <name>` where Cancel used to be; as the requester or a dev the Cancel button is back.

**Deploy order.** Either. The client fails soft on both reads (empty box / "App email" with no status before the push). Both edge functions (`send-gc-statement-email`, `gc-statement-email-dispatch`) should be deployed after merge for the dedupe + lane stamping — neither depends on this migration.

**Rollback.** Re-create the 20260806233713 SELECT policy (`requested_by = (SELECT auth.uid()) OR public.is_dev()`) and `DROP POLICY email_send_log_statement_office_select ON public.email_send_log;`. No client change needed — the box shrinks back to own rows and the history list loses lane/status.
