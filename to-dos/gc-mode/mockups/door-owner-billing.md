---
name: "The Owner Billing door: change orders, Bill the customer and Money open to the money team"
rows: OWNER_BILLING_REAL_BUILD.md decision 2 (who sees it) and *The door*; door-2-board.md, the pattern; the Board's B5-a, which named the money team (gc_money_team(), canSeeGcMoney)
branch: the plan on spike/owner-billing-plan; the PR from origin/main once door 2 is on main, its own migration
status: plan 2026-10-08 by Helper 5 at the lead's ask, so the door is ready the day the owner wants the money roles testing. Nothing cut or claimed. Four calls for the lead, one with Helper 1 and one with Helper 2.
---

# The Owner Billing door

## What it is

One PR from `main`. It opens Owner Billing's screens and tables to the **money team**: dev, the leaders (`master_technician`) and the controller. That is decision 2: "a door PR opens it to the owner and the controller. Nothing here opens to estimators or assistants."

The audience is already named once:
- in SQL, `public.gc_money_team()` (B5-a, `20261008130000`);
- on the client, `GC_MONEY_TEAM` / `canSeeGcMoney` in `src/lib/gc/access.ts`;
- `access.test.ts` fails CI when the two lists differ.

This door adds no new audience.

**What opens, by where each piece stands:**

| Screen | Its PR | On main |
|---|---|---|
| **Change orders** on a won job's card (`GcChangeOrders.tsx`) | O3-ui | #4963, queued |
| **Money**, the fifth lens (`GcMoney.tsx`) | O6a | built locally, cut after #4963 |
| **Bill the customer** (`GcBillCustomer.tsx`), its form, the certificate, our waivers | O4a-3, O4a-4 | built locally, waits on the owner |
| **Closeout** in Bill the customer, **Accept the work**, our final | O7a | planned |

The door can land before O4a and O7a. Each of them then ships with `canSeeGcMoney` from its first line instead of `role === 'dev'`, and its functions are gated by the swapped policies below. This door names that rule in each plan.

**Order:** after door 2. Money is a pill on the dev switch, and door 2 opens that switch's section to the office team. Before door 2, the leaders and the controller would not see the switch at all.

## The tables

O1's seven, from `20261008010000_gc_owner_billing_tables.sql`, swap their `_dev` policy for `_money` on `gc_money_team()`:
- `gc_owner_contract_lines`, `gc_change_orders`;
- `gc_owner_pay_apps`, `gc_owner_pay_app_lines`;
- `gc_owner_pay_reminders`, `gc_owner_interest_bills`, `gc_owner_acceptances`.

**What already holds, and stays:**
- `anon` has no grant (O1).
- A sent pay application, its lines, reminders and interest bills have no UPDATE, DELETE or TRUNCATE, except the certificate's columns and O4a's two links. Those are privileges, which a `FOR ALL` policy cannot open.
- O3's keep-what-went trigger and O4a's links-once trigger.

**Not this door's:**
- `gc_projects` and `gc_trade_packages` are door 1's, on the office team.
- `gc_project_money` already has its own money-team policy (B5-a).
- The billing job and its bills are the Pipeline's. Decision 1's cost: they show on the Billed list and in AR to whoever sees billing there today, and the bill carries only what the customer owes.

## The functions

Every Owner Billing function is `SECURITY INVOKER` and reads no `is_dev()`, so the swap is their gate:

| Function | Migration | Writes |
|---|---|---|
| `gc_sign_owner_contract` | O1 | `gc_owner_contract_lines`, `gc_projects.owner_contract_signed_on` |
| `gc_draft_change_order`, `gc_draft_time_extension`, `gc_send_change_order`, `gc_answer_change_order` | O3 (`20261008110000`) | `gc_change_orders` |
| `gc_owner_contract_now` | O4a-1 | reads only |
| `gc_send_owner_pay_app`, `gc_record_certificate` | O4a-1 | the pay application, its lines, the billing job and its bill |
| `gc_record_acceptance` | O7a | `gc_owner_acceptances`; its `portal` path is the service role's alone |

`gc_send_owner_pay_app` and `gc_record_certificate` also write `jobs_ledger` and `jobs_ledger_invoices`, under the Pipeline's own insert policies. Those let the office staff, dev, the leaders and the controller in, which covers the whole money team.

## The four calls

**A. Our terms with the customer on `gc_projects`.** O1 put seven columns on door 1's table:
- the retainage and its step;
- late interest and the late finish;
- the days to pay;
- the billing job;
- the day the contract was signed.

Door 1's `_team` policy lets the whole office team write them today. Reading them is harmless: they are the contract's terms, not our margin. **Writing them is the money team's.**
- *My default:* a column guard in this migration, the way door 2's call A guards vetting. An assistant or estimator who updates one of the seven is refused in words. `gc_sign_owner_contract` and O4a's functions run as the person, so they are refused the same way.
- *The other way:* move them to their own table, as B5 moved our number. That costs O5a's loader, O6a's read and O4a a second read each. It is worth it only if the owner wants the office not to see the retainage, which nothing asks.

```sql
-- Our terms with the customer, O1's nine columns, are the money team's to change; the rest of the row stays door 1's.
-- The service role passes (auth.uid() IS NULL): gc-drive-access writes drive_folder_url as the service role.
CREATE OR REPLACE FUNCTION public.gc_projects_owner_terms_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.gc_money_team() AND (
    NEW.owner_contract_signed_on IS DISTINCT FROM OLD.owner_contract_signed_on
    OR NEW.owner_retainage_pct IS DISTINCT FROM OLD.owner_retainage_pct
    OR NEW.owner_retainage_step_at_pct IS DISTINCT FROM OLD.owner_retainage_step_at_pct
    OR NEW.owner_retainage_step_to_pct IS DISTINCT FROM OLD.owner_retainage_step_to_pct
    OR NEW.owner_retainage_step_way IS DISTINCT FROM OLD.owner_retainage_step_way
    OR NEW.owner_late_interest_pct_per_month IS DISTINCT FROM OLD.owner_late_interest_pct_per_month
    OR NEW.owner_late_finish_per_day IS DISTINCT FROM OLD.owner_late_finish_per_day
    OR NEW.owner_pay_days IS DISTINCT FROM OLD.owner_pay_days
    OR NEW.billing_job_id IS DISTINCT FROM OLD.billing_job_id) THEN
    RAISE EXCEPTION 'Our terms with the customer are for the owner, the leaders and the controller to change.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS gc_projects_owner_terms_guard ON public.gc_projects;
CREATE TRIGGER gc_projects_owner_terms_guard BEFORE UPDATE ON public.gc_projects FOR EACH ROW EXECUTE FUNCTION public.gc_projects_owner_terms_guard();
```

`gc_projects` is door 1's table. Helper 6 agreed the guard as written (2026-10-08), with these points:
- **Exactly O1's nine columns.** B1's day columns (`our_bid_sent_on`, `permit_on`, `start_date`, `owner_contract_sent_on`, `started_on`, `started_anyway_*`) are the office's Get started and outcome steps, so they stay unguarded.
- **Not `general_conditions`, `contingency_pct` or `fee_pct`.** B5-a moved them to `gc_project_money`, and B6-a drops them from `gc_projects`. A plpgsql trigger naming a dropped column fails every UPDATE on the row ("record new has no field"), which would stop New project, the outcome strip and the Drive check. The drop is their fix.
- **The service role passes** (`auth.uid()` is null), which gc-drive-access needs.
- It touches one row-level trigger and no policy, so door 2's `src/lib/gc/doors.ts` keeps `gc_projects` as `office`.
- An insert is not guarded, since New project writes the defaults.

**B. Get started's "the contract is signed" (the Board's B6, Helper 2).** B6 calls `gc_sign_owner_contract`, which writes the contract's lines. After this door, only the money team can sign: an estimator's press would be refused by the policy.
- *My default:* that is right. Signing fixes the price by line, which is our number. B6 shows **Mark the contract signed** to `canSeeGcMoney`, and the office sees "Waiting on the contract with the customer".
- *The other way:* a `SECURITY DEFINER` sign for the office team that records only the day, with the money team adding the lines later. That makes two steps for one event, and the plan's decision 1 reads the lines at the first bill.

**C. Change orders for the office.** Change orders are money: a price to the customer and our cost, and between them our fee. B5 hid *Price so far* from the office for the same reason. But three lanes will read a change order's other half:
- the schedule's contract days and time extensions (G-141), on the Schedule tab the office will see (PR 10);
- Building's RFI link (U5) and trade sends (U6);
- the Portal's trade change requests (P4).
- *My default:* the money team owns `gc_change_orders`. The office reads its non-money half through one view, when the first of those lanes needs it: `gc_change_orders_office`, owner's rights with `security_barrier`, `WHERE (SELECT public.gc_office_team())`. Its columns:
  - `id`, `project_id`, `number`, `description`, `reason`, `schedule_words`, `package_id`;
  - `status`, `sent_on`, `answered_on`, `days`, `days_on_chart`;
  - never `cost`, `price` or `pct_done`.

  No lane reads change orders on `main` today, so the door does not add it. The first reader's PR does, in this shape.
- *The other way:* split `cost` and `price` into their own table, as B5 split our number. That is cleaner in the long run, and costs O3's functions, O3-ui, O5a's mapper and O4a a rewrite now.

**D. Who asks for the days (Helper 1).** The schedule's **Ask for the days** (G-141) drafts a time extension through `gc_draft_time_extension`. After this door that is the money team's.
- *My default:* right. A time extension is a change order to the customer. The office sees the late days and who caused them on the schedule. The leaders and the controller send the ask.
- *The other way:* `gc_draft_time_extension` becomes `SECURITY DEFINER` for the office team, since it carries no price. Then a change order the money team never saw could reach the customer.

## The page

`src/pages/GcProjects.tsx` and the windows:
- **Change orders · N** on a won job's card, and its window at `?changes=`, open to `canSeeGcMoney(role)`. The window also refuses to mount without it, so a link reaches nothing.
- The same goes for **Bill the customer** and `?bill=` (O4a), and for the **Money** pill and its lens (O6a).
- The **Devs only** chip leaves these, as door 2 removes it from its own section.

## The SQL as it will be

```sql
SET lock_timeout = '3s';

-- GC mode, the Owner Billing door (v2.NNNN): change orders, Bill the customer and Money open to the money team,
-- dev, the leaders and the controller (to-dos/gc-mode/mockups/door-owner-billing.md on branch spike/gc-mode).
-- O1's seven tables swap their dev-only policy for public.gc_money_team(), the audience B5-a named once. Every
-- Owner Billing function is SECURITY INVOKER, so this is their gate too. anon has no grant on these tables (O1),
-- and the sent records keep their missing UPDATE and DELETE privileges, which no policy can open.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'gc_owner_contract_lines', 'gc_change_orders', 'gc_owner_pay_apps', 'gc_owner_pay_app_lines',
    'gc_owner_pay_reminders', 'gc_owner_interest_bills', 'gc_owner_acceptances'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_dev', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_money', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING ((SELECT public.gc_money_team())) WITH CHECK ((SELECT public.gc_money_team()))',
      t || '_money', t);
  END LOOP;
END $$;
```

Call A's guard follows in the same file.

**Locks.** The seven tables are quiet, with only the test project's rows on prod. Call A's trigger takes a short lock on `gc_projects`, which only `/gc` writes. Either batch works.

**Checked on a local Postgres 15** (2026-10-08). The run had O1, O3, O4a-1 and O7a, the door's two blocks above, and stand-ins for `gc_money_team()`, `gc_office_team()` and door 1's `_team` policies.
- **A leader** (`master_technician`) drafted a change order, signed the contract and changed the retainage, then read the change order back.
- **An estimator:**
  - read 0 change orders and 0 contract lines;
  - had a draft refused by the policy (Postgres's own words, since the window is hidden from them anyway);
  - had the retainage and the signed day each refused in the guard's words;
  - could still update the project's stage, door 1's.
- **The catalog:** one `_money` policy on each of the seven tables, and no `_dev`.

The matrix below, on Helper 2's harness, is the full proof at the cut.

## The role matrix, proven before the push

It runs on Helper 2's B5-a harness, `to-dos/gc-mode/scripts/pg/b5matrix.mjs`, as door 2's does:
- the GC chain through O1, O3, B5-a, door 1, door 2 and this migration, applied twice;
- the real training-mode and twin blocks;
- one user per role.

| Who | Reads change orders | `gc_draft_change_order` | Reads pay applications | `gc_sign_owner_contract` | Updates `owner_retainage_pct` (call A) |
|---|---|---|---|---|---|
| dev, master_technician, controller | rows | wrote | rows | wrote | wrote |
| assistant, estimator | 0 | refused by the policy | 0 | refused by the policy | refused by the guard; door 1's `size_note` still writes |
| superintendent, primary, subcontractor, helpers | 0 | refused | 0 | refused | refused (door 1's policy) |
| controller (training mode) | rows | refused (training mode) | rows | refused | refused |
| estimator (digital twin) | 0 | refused by the fence | 0 | refused | refused |
| anon | permission denied | — | — | — | — |

The doc keeps the table as it came out, with each refusal's words.

## Verify after the push

1. **The catalog.**
   - Each of the seven tables has one `<table>_money` policy reading `( SELECT gc_money_team() AS gc_money_team)` and no `_dev`.
   - The functions read `prosecdef` false.
   - The guard trigger is on `gc_projects`, enabled.
2. **Reads per role, rolled back:** `gc_change_orders` on the test project gives 1 row as a controller and 0 as an estimator.
3. **Writes per role, rolled back:**
   - a controller's `gc_draft_change_order` on the test project returns an id;
   - an estimator's is refused;
   - an estimator's update of `owner_retainage_pct` is refused in the guard's words.
4. **The page**, a dev through **View as…**:
   - *Sample controller:* `/gc` shows **Money**, and the test project's card shows **Change orders · 1**.
   - *Sample estimator:* neither, and `/gc?changes=<test project>` opens nothing.
   - *Sample leader:* as the controller.

## The PR

**Title:** `v2.NNNN GC mode, the Owner Billing door: change orders and Money open to the owner, the leaders and the controller (migration <stamp>)`

**Files:**
- The migration and `docs/migrations/<stamp>_gc_owner_billing_money_team.md`: what opens, the calls as taken, the matrix as it came out, the four steps, and the rollback (re-create the seven `_dev` policies and drop the guard).
- `src/pages/GcProjects.tsx` and the windows' own gates: `role === 'dev'` becomes `canSeeGcMoney(role)` wherever Owner Billing draws.
- `src/lib/gc/doors.ts` (door 2's): the seven O1 tables move from `dev` to `money`. `doors.test.ts` fails until they do, on purpose.
- **Docs:**
  - `docs/ACCESS_CONTROL.md`: the GC projects section gains the Owner Billing door, with the seven tables, the functions, the money team, and what the office sees of it (nothing until call C's view). The guard's sentence goes in door 1's paragraph, where it says who writes `gc_projects`, so the doc keeps one place;
  - `docs/twins/APP_DIRECTORY.md` and `PROJECT_DOCUMENTATION.md` §20.
- **The guides,** each with `roles: dev, master_technician, controller` and its "Only a dev sees …" sentence rewritten:
  - `change-our-contract-with-the-customer`;
  - `see-the-money-on-our-gc-jobs` (O6a);
  - `bill-the-customer-on-a-gc-job` (O4a), whichever are on `main`.
- The release note, *GC projects: change orders and Money for the owner, the leaders and the controller*, and its fragment.

**Checks before arming:**
- the matrix;
- vitest on `src/lib/gc`, `src/components/gc`, `access.test.ts`, `helpGuide`, `releaseNotes` and `twins`;
- eslint, the theme check and the full typecheck;
- the dev server as a dev, then through View as the sample controller and the sample estimator.

## Is this the best we can do?

It reuses the money team B5 named, so the owner, the leaders and the controller see one money audience across GC mode, held by one test. It could be better two ways:

1. **Pin every GC table to a door** (door 2's way 2). A test would sort each `gc_*` table by its policy predicate. Owner Billing's seven would then read *money team*, and a future `_dev` table on a page the money team uses would fail CI.
2. **The billing job's bills to the money team on the Pipeline too.** Decision 1 accepted that a GC job's bills show wherever billing shows. If the owner wants GC money kept to the money team everywhere, the Pipeline's Billed list and AR would filter billing-only jobs by `canSeeGcMoney`. That is a small client PR beside the billing-only job's, and it is the owner's call.
