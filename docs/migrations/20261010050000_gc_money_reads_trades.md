# 20261010050000_gc_money_reads_trades.sql

GC mode, Owner Billing's O9: the money team reads the trades' money (v2.5133). The plan is `to-dos/gc-mode/mockups/owner-billing-o9.md` on branch `spike/gc-mode` (f1b40d774), whose SQL block is this file byte for byte but for the version. Co-signed by the three lanes whose tables it opens for reading: Building (gc 10), the Board (gc 2) and the Portal (gc 3).

**Why:** Money and Bill the customer are the money team's since the Owner Billing door (dev, the leaders and the controller, `gc_money_team()`). They read each trade's work from its statement of work and its draws. Those rows were a dev's alone, so since U6b (v2.5121, the Draws window) a leader's or the controller's Bill the customer drafted every trade as *Their statement of work is not signed yet* at $0, while a dev's draft of the same month billed their work. Money's job cash read the trades as paid nothing. Only test projects exist, so nothing on prod was wrong yet.

## What it does

One `FOR SELECT` policy, `<table>_money_read`, `TO authenticated USING ((SELECT public.gc_money_team()))`, on each of seven tables:

| Table | Lane | What Owner Billing reads from it |
|---|---|---|
| `gc_sows` | Board (B6-a) | whether a trade's statement of work is signed, and its price |
| `gc_sow_lines` | Board (B6-a) | each line's amount; a change order's line |
| `gc_draws` | Building (U6a) | the newest draw's stored materials; each draw's net in Money's job cash |
| `gc_draw_lines` | Building (U6a) | the lines a draw claims and stores |
| `gc_sow_line_reports` | Building (U6a) | each line's reported percent, what the bill bills the trade at |
| `gc_change_order_trade_sends` | Building (U6a) | a signed change at the trade's percent |
| `gc_back_charges` | Portal (P4a) | the charges taken off a draw's net |

Each table keeps its dev policy (`<table>_dev`, every verb, `is_dev()`), so **writing stays a dev's**: the Draws window, every draws function and the statement of work's **Send to their portal to sign**. No table, function or grant changes; `authenticated` already held `SELECT` on each, so RLS was the only wall. The draws functions are `SECURITY INVOKER`: those that lock a row (`SELECT … FOR UPDATE`) find none for the controller, since locking asks the update policy, and those that insert are refused by the dev policy's check.

The read-only and twin fences on these tables limit writes only, so a training account or a digital twin on the money team reads them and writes nothing. `gc_sows` carries the ESIGN signer's fields (`signer_ip`, `signer_user_agent`, `signer_signature_storage_path`): the leaders and the controller read them with the row, on purpose, as the office reads them on `person_contract_documents`.

## The lock note

`CREATE POLICY` takes a brief lock on each of the seven tables. They are barely used, and `SET lock_timeout = '3s';` fails the push fast if one is busy.

## Verify after the push

Read only:
1. **The policies.** `pg_policies` has `<table>_money_read` on each of the seven, `SELECT`, for `authenticated`, its `qual` naming `gc_money_team()`, beside `<table>_dev` (`ALL`, `is_dev()`).
2. **The controller reads what a dev reads**, in `BEGIN … ROLLBACK` as the controller: `SELECT count(*) FROM public.gc_sows` (and each of the others) gives what a dev's count does.
3. **The controller writes none**, in the same `BEGIN … ROLLBACK`: `UPDATE public.gc_draws SET signed_title = signed_title` reaches 0 rows, and `SELECT public.gc_approve_draw(<a waiting draw>)` says *No pay application with that id.*

## The SQL beds

`scripts/pgtest-gc-owner-billing.sh` re-applies this migration right after it runs and plays `92_money_reads.sql`, 18 checks, on a fixture in `gc_building/60_draws.sql`'s shape (a job being built, a signed statement of work with two lines, a drafted one, two signed change orders with one sent to the trade, two reports, an approved draw with a back-charge taken off it and a draw waiting on us):
- each of the seven has its money team read policy, `SELECT` only, beside its dev policy;
- a dev reads every row, and an insert, an update and a delete on each go through where its grants allow;
- the controller, a leader, a leader in training mode and a controller who is a digital twin read what a dev reads, by row count and an md5 of the rows in key order (`id`; `(draw_id, sow_line_id)` on `gc_draw_lines`, `change_order_id` on `gc_change_order_trade_sends`);
- none of them writes: each insert refused, each update and delete reaching no row;
- the controller's `gc_approve_draw`, `gc_pay_draw` and `gc_send_trade_change` are refused with nothing written, and a dev's `gc_approve_draw` goes through;
- an estimator and an assistant read none of the seven.

It ran on a local Docker copy of the whole schema with every migration applied; all ten Owner Billing files passed. Five mutants of the migration were each caught, both by the policy check and, with that check taken out, by the check meant for each: the policy `FOR ALL` (the controller's writes landed), `gc_office_team()` (the estimator read), `gc_back_charges` left out (the controller's reads differed from a dev's), `USING (true)` (the estimator read), and the policy named `t || '_dev'` (it replaced the dev policy, and a dev's writes failed).

`doors.test.ts` reads the same: the seven keep door `dev` from their non-`SELECT` policies and are read by `money`, and fails on each of the five mutants too.

## Status

Cut 2026-10-09 by Helper 5 (the Owner Billing lane). The lead pushes it once the PR merges.
