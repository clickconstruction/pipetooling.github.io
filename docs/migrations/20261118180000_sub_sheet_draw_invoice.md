# 20261118180000_sub_sheet_draw_invoice.sql (2026-11-18, v2.7835)

Punch list #388, step 1 of 3 (`to-dos/sub-page-customer-paid/README.md`). A sub's sheet (`people_labor_jobs`) waits at **Waiting on customer** until the customer pays. A sheet is tied to a job, and a job can hold several bills, so nothing said which bill a sheet waits on. Step 2 of the card lets the sub's page say the customer paid, and it may say so for one bill only (the owner's call 2b, 2026-11-17). This migration makes that tie. Nothing outside the office's own row reads it yet: the sub's page and the `sub-portal` function do not change in this step.

## What it does

1. **`draw_invoice_id`** (uuid, nullable): the bill the sheet rides on, a row of `jobs_ledger_invoices` on the sheet's own job. `ON DELETE SET NULL`, so deleting the bill clears the tie. A partial index covers the rows that hold one.
2. **`people_labor_jobs_stage_draw_tie_biu`**: one BEFORE INSERT OR UPDATE OF `stage`, `draw_invoice_id`, `job_ledger_id`, `job_number` trigger, running `people_labor_jobs_draw_tie()`.
   - A sheet off `customer_pay` rides on no bill. A move back clears the tie.
   - A tie to a bill of another job is no tie. Moving the sheet to another job drops the tie.
   - A sheet that **arrives** at `customer_pay` with no tie takes the job's one open bill, when the job has exactly one. A bill is open until it is paid: `ready_to_bill` or `billed`. With none or several it takes none.
   - A write that is not an arrival never re-decides. A tie the office cleared stays cleared, and a bill made later does not tie itself.
   - The function is SECURITY DEFINER, so the count of a job's open bills is the whole count whoever writes the sheet.
   - The name sorts after `people_labor_jobs_link_job_ledger_biu`, so a sheet written with only its job's number is linked first and tied second.
3. **`set_sub_sheet_draw_invoice(p_labor_job_id, p_invoice_id)`**: the office picks, changes or clears (NULL) the tie. The same writers as `set_sub_sheet_stage`: dev, assistant, master. It answers `{ ok, draw_invoice_id }` or `{ error }`, and refuses a sheet off `customer_pay`, a bill of another job and a sheet that does not exist. EXECUTE for `authenticated` only.

`set_sub_sheet_stage` is not changed. The trigger rides every writer of the stage.

**No backfill.** A sheet already waiting on the customer keeps no tie until the office picks one. The one open bill a job has today may not be the bill that sheet's draw was requested on, and a wrong tie is what call 2 ruled out.

No new table, grant on a table or policy, so no fence calls.

## The lock

`ADD COLUMN` with a foreign key takes a short lock on `people_labor_jobs` and on `jobs_ledger_invoices`. The column is new and empty, so nothing is scanned. The trigger's `DROP` and `CREATE` take the same short lock on the sheet's table. `SET lock_timeout = '3s'` makes the push fail fast behind a long write, and it is then pushed again.

## Checked before the push

The SQL bed `sub-sheet-draw-invoice` (`npm run test:pg:sub-sheet-draw-invoice`) runs every migration on Supabase Postgres 17, then this one a second time, which must change nothing, then the scenario. Docker does not run on the office Mac, so it runs in the SQL beds workflow on the PR. It checks:

- The column is a uuid, the trigger is there once and switched on after the second run, the foreign key clears on delete, and only a signed-in person may call the pick.
- Arrival, through the office's own `set_sub_sheet_stage`: no bill, no tie. One open bill is tied by the move. A move back clears it. A sent bill and a draft together tie none. With the sent bill paid, the draft is the one open bill and is tied. The same stage again changes nothing. A later bill and a later write leave the tie.
- The pick: another bill of the job, a paid one too, and No bill. A bill of another job, a sheet off the stage and a sheet that does not exist are each refused in words. A helper is refused and writes nothing.
- Writes past the function are held to the same rules: a tie to another job's bill and a tie on a Working sheet are no tie, moving the sheet to another job drops the tie without taking that job's bill, and deleting the bill clears it.
- A sheet born at the stage with only its job's number is linked first and tied second.

## Verify after the push

```sql
-- 1. The column, its foreign key and the trigger.
SELECT data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'people_labor_jobs' AND column_name = 'draw_invoice_id';
-- expect: uuid
SELECT confdeltype FROM pg_constraint
WHERE conrelid = 'public.people_labor_jobs'::regclass AND contype = 'f' AND confrelid = 'public.jobs_ledger_invoices'::regclass;
-- expect: n
SELECT tgname, tgenabled FROM pg_trigger
WHERE tgrelid = 'public.people_labor_jobs'::regclass AND tgname = 'people_labor_jobs_stage_draw_tie_biu';
-- expect: one row, O

-- 2. Who may call the pick.
SELECT has_function_privilege('authenticated', 'public.set_sub_sheet_draw_invoice(uuid, uuid)', 'EXECUTE') AS signed_in,
       has_function_privilege('anon', 'public.set_sub_sheet_draw_invoice(uuid, uuid)', 'EXECUTE') AS signed_out;
-- expect: true, false

-- 3. Nothing is tied by the push itself.
SELECT count(*) FILTER (WHERE stage = 'customer_pay') AS waiting, count(draw_invoice_id) AS tied FROM public.people_labor_jobs;
-- expect: tied = 0 right after the push
```

## Applied

2026-11-19, about 00:45 UTC, with `bash scripts/db-push.sh`, after the file landed on `main` (#8790).

- The landed file was compared with the reviewed one first: identical.
- It applied out of order, through the script's own `--include-all` retry. Two newer files, `20261118203000` and `20261118220000`, were on prod already. Neither names this file's column, trigger or functions, and the dry run named this one file and no other.
- `check:migration-drift` after: 1377 local files, 1377 remote versions, fully applied.
- Read on prod after, read only: `draw_invoice_id` is a `uuid`, its foreign key clears on a deleted bill, the trigger `people_labor_jobs_stage_draw_tie_biu` is enabled, a signed-in person may call `set_sub_sheet_draw_invoice` and a signed-out one may not, and the push tied nothing (no sheet was waiting on the customer).
- The SQL bed ran for the first time on #8790's CI and passed.
- The generated types gained the column and the function with the next regeneration after it (#8833).

## Rollback

```sql
DROP TRIGGER IF EXISTS people_labor_jobs_stage_draw_tie_biu ON public.people_labor_jobs;
DROP FUNCTION IF EXISTS public.people_labor_jobs_draw_tie();
DROP FUNCTION IF EXISTS public.set_sub_sheet_draw_invoice(uuid, uuid);
DROP INDEX IF EXISTS public.people_labor_jobs_draw_invoice_id_idx;
ALTER TABLE public.people_labor_jobs DROP COLUMN IF EXISTS draw_invoice_id;
```

The client reads the column by itself and treats a refused read as no ties, so the screens stand without it.
