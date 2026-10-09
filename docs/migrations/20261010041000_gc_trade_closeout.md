# 20261010041000_gc_trade_closeout.sql (2026-10-09, v2.5115)

GC mode, the real build, the Building lane's U6c: closeout (`to-dos/gc-mode/mockups/building-u6.md` on branch `spike/gc-mode`, amendments 2 and 3). Four columns, a check, and ten functions on U6a's draws (`20261010021000_gc_trade_draws`). The punch list is U1's (`20261008030000`). Our bills to the customer are Owner Billing's (`20261008010000`, `20261009200000`).

- **`gc_projects.closed_on`**: the day we closed the job (`GcProject.closedOn`), only on a closed one (`gc_projects_closed_on_when_closed`).
- **The helpers**, read only:
  - `gc_retainage_held(sow)`: what we hold (`retainageHeldNow`);
  - `gc_sow_all_billed(sow)`: every line billed (`workAllBilled`);
  - `gc_owner_retainage_paid_on(project)`: the day the customer paid our final pay application's bill, by `billMoney`'s rule in `src/lib/gc/ownerBillingRows.ts`. That is the day the payments reach the bill, or the last payment's day once it is marked paid for less.
- **`gc_accept_work(p_package_id uuid)`**: once every line is billed and no punch item on the trade lacks its check. Not twice.
- **`gc_final_pay_app_ask(p_sow_id uuid, p jsonb, p_recorded_by uuid)`**: the final pay application's rules, shared.
  - Its money is the retainage held: gross none, retainage the release taken back, net the release.
  - It comes once every line is billed and the work is accepted, once, with no draw waiting and retainage held.
  - With no waiver owed, it keeps the closeout promise.
  - A signed-in caller records it only as themselves.
  - It raises keys: `finalSent`, `drawWaiting`, `finalNotYet`, `nothingToBill`, `badRequest`, `nameNeeded`.
- **`gc_trade_final_pay_app(p_company_id uuid, p_package_id uuid, p_app jsonb)`**: the trade's, the service role's only, after `notFound`, `notOnTrade`, `sowNotSigned` and `jobNotBuilding`.
- **`gc_final_pay_app_came_in(p_package_id uuid, p jsonb)`**: the office's, in its own words.
- **`gc_approve_retainage(p_draw_id uuid)`**: the release, 10 days after the customer paid us ours.
- **`gc_trade_change_signed_in(p_change_order_id uuid, p_file_name text DEFAULT NULL, p_drive_url text DEFAULT NULL)`**: a change the trade signed on paper or by email, the office's twin of `gc_trade_sign_change`. It makes the same line, reports a credit done, and keeps who recorded it and the file in `gc_change_order_trade_sends`' new `recorded_by`, `file_name` and `drive_url`. Not before the change was sent, nor twice.
- **`gc_close_job(p_project_id uuid)`**: the stage `closed` and `closed_on` today, for a job we are building. A dev's while Building is built.

`SECURITY INVOKER`, every one. The office's presses and the helpers go to `authenticated`, and the trade's to the service role only. `finalSent` and `finalNotYet` wait in WAITING as `'P5'`.

Apply order: after U6a. `gc_projects` gains a nullable column and a check that every row passes. It locks the table briefly behind `lock_timeout 3s`. The rest is `CREATE OR REPLACE`. It is idempotent.

**Before the push**, the SQL bed plays `70_closeout.sql` beside the other Building scenarios. It walks a trade from its last draw through acceptance, the waivers, its final pay application, the customer's payment and 10 days, the release paid and its final release, to the job closed. It checks each refusal and the customer's paid day both ways. It ends `gc_building PASSED`.

## Verify after the push

1. **The columns, the check and the ten functions**, with invoker's rights and the right callers. Use the same query as U6a's step 1 on these names, and `SELECT conname FROM pg_constraint WHERE conname = 'gc_projects_closed_on_when_closed'`, and `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND (table_name, column_name) IN (('gc_projects', 'closed_on'), ('gc_change_order_trade_sends', 'recorded_by'), ('gc_change_order_trade_sends', 'file_name'), ('gc_change_order_trade_sends', 'drive_url'))`, four rows.
2. **The customer's paid day, read only, as a dev**: `gc_owner_retainage_paid_on` on a project with a final pay application, if one exists on prod. It should equal Bill the customer's paid day.
3. **A training account's call is refused in words**: `gc_close_job` gives *A training account cannot close a job.* (`42501`).
4. **The trade's press is the service role's only**: as a dev, `gc_trade_final_pay_app` gives *permission denied*.

## Rollback

```sql
DROP FUNCTION IF EXISTS public.gc_close_job(uuid);
DROP FUNCTION IF EXISTS public.gc_trade_change_signed_in(uuid, text, text);
DROP FUNCTION IF EXISTS public.gc_approve_retainage(uuid);
DROP FUNCTION IF EXISTS public.gc_final_pay_app_came_in(uuid, jsonb);
DROP FUNCTION IF EXISTS public.gc_trade_final_pay_app(uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.gc_final_pay_app_ask(uuid, jsonb, uuid);
DROP FUNCTION IF EXISTS public.gc_accept_work(uuid);
DROP FUNCTION IF EXISTS public.gc_owner_retainage_paid_on(uuid);
DROP FUNCTION IF EXISTS public.gc_sow_all_billed(uuid);
DROP FUNCTION IF EXISTS public.gc_retainage_held(uuid);
ALTER TABLE public.gc_projects DROP CONSTRAINT IF EXISTS gc_projects_closed_on_when_closed;
ALTER TABLE public.gc_projects DROP COLUMN IF EXISTS closed_on;
ALTER TABLE public.gc_change_order_trade_sends DROP COLUMN IF EXISTS recorded_by, DROP COLUMN IF EXISTS file_name, DROP COLUMN IF EXISTS drive_url;
```

## Status

- Cut 2026-10-09 by Helper 2 for the Building lane (Helper 18's plan; gc 4 was unreachable), v2.5115 and stamp `20261010041000` claimed once at the cut, past every open claim. The migration and `70_closeout.sql` equal the plan's blocks byte for byte, with only the stamps and the version filled in, after amendment 4.
- **Amendment 4, found on the real Supabase image.** The plan's scenario inserted our final bill A as `'open'`. `jobs_ledger_invoices`' status check takes only `ready_to_bill`, `billed` and `paid`, and refused it; PGlite's stand-in had let it pass. Bill A is `'billed'` now, sent and not paid, which is what the scenario means.
- **The bed, on this Mac's Docker** (Supabase Postgres 17.6.1.071, every migration, Building's presses re-applied): `20_daily_log`, `40_submittals`, `50_rfis`, `60_draws` and `70_closeout` all passed, `70_closeout` with its 53 assertions. Five planted bugs each failed it: no 10 days' wait, anyone closes a job, work accepted before every line is billed, a signed-in credit not reported done, and the customer counted as paid on their first payment.
- Not applied. The lead pushes it after the merge and records here what steps 1 to 4 said.
