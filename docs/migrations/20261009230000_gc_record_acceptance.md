# 20261009230000_gc_record_acceptance.sql

GC mode, Owner Billing's O7a: the customer accepts the work, and our final pay application goes on it (v2.5019). The plan is `to-dos/gc-mode/OWNER_BILLING_REAL_BUILD.md` → PR 9, and the SQL is `to-dos/gc-mode/mockups/owner-billing-o7.md`'s *O7a: the acceptance*, Helper 5's, on branch `spike/gc-mode`. One comment changed: the keep trigger's, which now says the money team may fix a mistake before the final (the Owner Billing door's policy). It needs O1's `gc_owner_acceptances` (`20261008010000`), the money team's policies on it (`20261009050000`) and O4a's `gc_owner_contract_now` with the send (`20261009200000`, restated by `20261009220000`).

It is additive and idempotent: one function and one trigger function created or replaced, one trigger dropped if there and created. No table, no column.

## What it does

1. **`gc_record_acceptance(project, on, by_name, how = 'office', note = '')`**, SECURITY INVOKER, under a lock on the project's row.
   - `how = 'portal'` runs only as the service role: the customer portal's **Accept the work** (O7c) calls it through `submit-portal-request`. `how = 'office'` needs a signed-in user, and the money team's policies on `gc_owner_acceptances` are its gate.
   - It refuses, in words: a way that is neither, a project that is not there, a job we did not win, a second acceptance ("They accepted the work on Oct 7."), a day still to come, no name, and a job not billed in full. Billed in full means the last progress pay application's work so far covers `gc_owner_contract_now`, half a dollar's slack (the kernel's `ownerAllBilled`).
   - It files the acceptance: the day, the name and the note trimmed, and how.
2. **`gc_owner_acceptances_keep`**, a BEFORE UPDATE OR DELETE trigger. Once our final pay application went on the acceptance, it stays: "Our final pay application went on this acceptance, so it stays." Before that the money team may fix a mistake with a plain update. The project's cascade passes (`pg_trigger_depth() > 1`).

`gc_send_owner_pay_app` already refuses a final before the acceptance (O4a), so nothing else changes.

## The lock note

`CREATE OR REPLACE FUNCTION` takes no lock on a table. `DROP TRIGGER IF EXISTS` and `CREATE TRIGGER` take a short lock on `gc_owner_acceptances`, which has no rows on prod and no reader but Bill the customer. `SET lock_timeout = '3s';` heads it as every migration's does.

## Verify after the push

1. **The function is there once, SECURITY INVOKER, never for anon.** `SELECT count(*), bool_and(NOT prosecdef) FROM pg_proc WHERE proname = 'gc_record_acceptance';` gives `1, true`, and `has_function_privilege('anon', 'public.gc_record_acceptance(uuid, date, text, text, text)', 'EXECUTE')` is `false`.
2. **The keep trigger is there.** `SELECT count(*) FROM pg_trigger WHERE tgname = 'gc_owner_acceptances_keep' AND NOT tgisinternal;` gives `1`.
3. **Nothing accepted on prod yet.** `gc_owner_acceptances` stays empty until the office records one.

## The SQL beds

`scripts/pgtest-gc-owner-billing.sh` re-applies O4a's, O5b's, O6b-2's and this migration in their order. `40_closeout.sql` checks:
- the function's rights and the trigger;
- each refusal in its words, the final refused before the acceptance;
- pay application 2 billing every line, then the acceptance at the office, trimmed;
- a second acceptance refused, and the note fixed before the final;
- the final going with nothing held, asking for the 11,500 held;
- the acceptance kept after the final, against an update and a delete;
- an estimator stopped, and the portal's way as the service role stopping at the billing check;
- the project's delete taking the acceptance.

## Status

**Applied to prod 2026-10-09 at 11:34 UTC** by the lead (GC MODE) from a clean checkout at main's tip (5925fce59) with `scripts/db-push.sh` (`--include-all`, since the stamp sorts below the day's applied ones); drift 821/821 after. Verified the same minute through the management API: step 1, `gc_record_acceptance` once, SECURITY INVOKER, not executable by `anon`; step 2, the keep trigger there; step 3, no acceptance on prod. As a dev, rolled back, the test project refused *Bill every line first. They accept the work once our pay applications have billed all of it.* The types ride Helper 17's PR with 20261010005000.
