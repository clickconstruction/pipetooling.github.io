# 20261005212106_card_charges_window.sql (2026-10-05, v2.4594)

`list_card_charges_window(p_start_ymd date, p_end_ymd date)`: every card charge posted in the company days `p_start_ymd..p_end_ymd`, one row per charge, oldest first. It is the read behind **People → Spending** (punch list #52, PR 4b) and the history the **Tally team queue** reads for its suggestions (#72 PR 2 and PR 5), agreed between the two so the same table does not get two overlapping readers in one week.

## What a row carries

| Column(s) | From |
|---|---|
| `mercury_transaction_id`, `posted_at`, `amount` (the bank's sign: a purchase is negative), `counterparty_name`, `kind`, `status` | `mercury_transactions` |
| `bank_category` | `mercury_category` as text (a string, or `{ name }` in older rows) |
| `debit_card_id`, `card_nickname`, `card_role` | `mercury_debit_card_id_from_raw(raw)`, `mercury_debit_card_nicknames` |
| `holder_user_id`, `holder_name` | `mercury_debit_card_user_links` (one holder per card: its primary key is the card id) |
| `attributed_user_id`, `attributed_person_id` | `mercury_transaction_attributions` |
| `label_id`, `label_default_key` | the accounting label (`internal_transfers` is the one card rule's exclusion) |
| `payroll_marked` | `mercury_tally_payroll_flags.is_payroll = true`, for callers with payroll access (below) |
| `job_splits` | the real splits: job id, amount, note, the job's number, name and service type, and when and by whom each was written. The Sorted RPC's keys (v2.4566), plus `created_at` / `created_by` |
| `invoice_links` | the supply-house invoices: id, number, date, amount, supply house, `created_at` |
| `sorted_at`, `sorted_by_name` | the newest split or invoice link and who wrote it, as in the Sorted RPC |
| `viewer_can_sort` | whether the split write this charge goes through admits the caller (below) |

Card kinds only (`debitCardTransaction`, `creditCardTransaction`): no ACH, no checks. Duplicates out. No `raw` comes back.

## The window

The company's civil day by `posted_at`, through `reporting_window_calendar_civil_day(NULL, day)` — the helper owns the zone (America/Chicago, the app's `APP_CALENDAR_TZ`), so the body spells no zone of its own. At most 366 days; a wider or upside-down window raises. Ordered by `(posted_at, id)`, so a caller pages with `.range()` past PostgREST's silent 1,000-row cap (`lib/banking/cardChargesWindow.ts` does). A 90-day window is about 1,100 to 1,500 rows.

## What bounds its cost

Nothing was measured before the push (no production read was open to the authors), so the function is written to stay small under a poor plan:

- **The rows:** a range on `posted_at`, which `mercury_transactions_posted_at_desc_idx` serves (the review window's `COALESCE(posted_at, created_at)` cannot use it), capped at 366 days; the kind and duplicate filters apply before anything per row.
- **`raw`:** read once per row in the window for the card id, in a `MATERIALIZED` CTE. No stored or generated card-id column exists and no index covers the expression; every card-holder RPC (`list_stale_unlinked_…`, the Sorted list, the linked-card reads) reads `raw` the same way, most over a wider range.
- **Per row:** primary-key probes (card link, nickname, attribution, label assignment, label, payroll flag, users, jobs) and transaction-id index probes (`mercury_transaction_job_allocations_mercury_transaction_id_idx`, `mtshil_mercury_transaction_id_idx`) for the two aggregates and the last-sorted lateral.
- **The circle check** runs once per distinct holder (about twenty), not per row.
- A runaway is still stopped by the API role's statement timeout, and the function takes no lock beyond the reads.

## Who may call it

`STABLE SECURITY DEFINER`, `SET search_path = public`. The first statement raises unless `is_office_staff()` (dev · master · assistant · controller). `REVOKE ALL` from `PUBLIC` and `anon`; `GRANT EXECUTE` to `authenticated`.

Definer because the card-holder links are not office-readable through RLS (Banking staff). The four roles already read the charges, attributions, splits, labels and invoice links, and the Team purchases definer RPCs already show them each charge's holder for their circle; this read shows it for every holder. `docs/ACCESS_CONTROL.md` says so.

**The payroll mark keeps its own rule.** `mercury_tally_payroll_flags` is readable with `has_payroll_access()` (dev, controller, a pay-approved master). A caller with it gets `payroll_marked`; a caller without it gets **no row** for a charge settled by a payroll mark alone — the Team purchases queue leaves those off for the same callers — and `payroll_marked` false on every other row. A marked charge that is also on a job or an invoice stays for everyone, so a job's card spend reads the same for every role. **Totals therefore differ by role by exactly the charges settled by a payroll mark alone.** Widening it to every office role is one line (`v_payroll_access`), the owner's call.

`viewer_can_sort`: a held card's splits are written by `replace_mercury_job_splits_for_linked_card_as_staff`, which admits only the holder's circle, so the read asks the same `staff_can_view_user_for_tally_followup(auth.uid(), holder)` once per holder. A card with no holder goes through `replace_mercury_transaction_splits`, which admits every office role, so it reads true. The page draws *Put on a job* only where the write will take it.

## House rules

Opens with `SET lock_timeout = '3s'`. `CREATE OR REPLACE`, idempotent. Creates no table, so no read-only block calls. `#variable_conflict use_column`, every column qualified.

Not rehearsed on a throwaway schema: there is no local Postgres or docker on the authoring machine, and plpgsql checks syntax at `CREATE` but column names only at the first call — so the first call below is the proof that it compiles and answers.

## Apply

`supabase db push` once this is on `main`. **Order: this before the People → Spending client (PR 4b-2).** No client calls the function in this PR, so pushing late breaks nothing.

## Verify after the push

Run these first thing after the push, read-only (`BEGIN READ ONLY; … ROLLBACK;`). **The gate:** if the 90-day plan below shows a sequential scan of `mercury_transactions`, or takes more than about a second, PR 4b-2 (the tab) does not ship until it is fixed.

1. **The office roles include the controller.** Expect `is_office_staff` = `is_master_or_dev() OR is_assistant()` and `is_assistant` = `role IN ('assistant','controller')` (repo: 20260906160000, 20260714213000).

   ```sql
   SELECT pg_get_functiondef('public.is_office_staff()'::regprocedure);
   SELECT pg_get_functiondef('public.is_assistant()'::regprocedure);
   ```

2. **The company day.** Expect `2026-10-05 05:00:00+00` to `2026-10-06 05:00:00+00` (CDT).

   ```sql
   SELECT * FROM public.reporting_window_calendar_civil_day(NULL, DATE '2026-10-05');
   ```

3. **The plan and the time for 90 days** (2026-07-08 – 2026-10-05; the bounds are what the helper returns for those days). Expect an index range scan on `mercury_transactions_posted_at_desc_idx`, index or primary-key probes for everything per row, roughly 1,100 to 1,500 rows, and well under a second. As the SQL editor's role, `auth.uid()` is null, so the circle check answers false fast; `false` stands in for `v_payroll_access` (the path with the extra probes).

   ```sql
   EXPLAIN (ANALYZE, BUFFERS)
   WITH c AS MATERIALIZED (
     SELECT t.id, t.posted_at, t.amount, t.counterparty_name, t.kind, t.status, t.mercury_category,
            public.mercury_debit_card_id_from_raw(t.raw) AS card_id
     FROM public.mercury_transactions t
     WHERE t.posted_at >= TIMESTAMPTZ '2026-07-08 05:00:00+00'
       AND t.posted_at <  TIMESTAMPTZ '2026-10-06 05:00:00+00'
       AND t.kind IN ('debitCardTransaction', 'creditCardTransaction')
       AND t.duplicate_of_transaction_id IS NULL
   ),
   can_sort AS (
     SELECT h.user_id, public.staff_can_view_user_for_tally_followup(auth.uid(), h.user_id) AS ok
     FROM (SELECT DISTINCT l0.user_id FROM c
           INNER JOIN public.mercury_debit_card_user_links l0 ON l0.mercury_debit_card_id = c.card_id) h
   )
   SELECT
     c.id, c.posted_at, c.amount, c.counterparty_name, c.kind, c.status,
     CASE jsonb_typeof(c.mercury_category) WHEN 'string' THEN c.mercury_category #>> '{}' WHEN 'object' THEN c.mercury_category ->> 'name' END,
     c.card_id, n.nickname, n.card_role, l.user_id, hu.name::text, att.user_id, att.person_id,
     asg.label_id, lab.default_key, false,
     COALESCE((SELECT jsonb_agg(jsonb_build_object('job_id', a.job_id, 'amount', a.amount, 'note', a.note,
         'hcp_number', j.hcp_number, 'click_number', j.click_number, 'job_name', j.job_name,
         'service_type_id', j.service_type_id, 'created_at', a.created_at, 'created_by', a.created_by)
         ORDER BY abs(a.amount) DESC, a.id)
       FROM public.mercury_transaction_job_allocations a
       LEFT JOIN public.jobs_ledger j ON j.id = a.job_id
       WHERE a.mercury_transaction_id = c.id), '[]'::jsonb),
     COALESCE((SELECT jsonb_agg(jsonb_build_object('invoice_id', si.id, 'invoice_number', si.invoice_number,
         'invoice_date', si.invoice_date, 'amount', si.amount, 'supply_house_name', sh.name,
         'created_at', il.created_at) ORDER BY si.invoice_date NULLS LAST, si.invoice_number)
       FROM public.mercury_transaction_supply_house_invoice_links il
       INNER JOIN public.supply_house_invoices si ON si.id = il.invoice_id
       LEFT JOIN public.supply_houses sh ON sh.id = si.supply_house_id
       WHERE il.mercury_transaction_id = c.id), '[]'::jsonb),
     srt.created_at, sb.name::text,
     CASE WHEN l.user_id IS NULL THEN true ELSE COALESCE(cs.ok, false) END
   FROM c
   LEFT JOIN public.mercury_debit_card_user_links l ON l.mercury_debit_card_id = c.card_id
   LEFT JOIN public.users hu ON hu.id = l.user_id
   LEFT JOIN can_sort cs ON cs.user_id = l.user_id
   LEFT JOIN public.mercury_debit_card_nicknames n ON n.mercury_debit_card_id = c.card_id
   LEFT JOIN public.mercury_transaction_attributions att ON att.mercury_transaction_id = c.id
   LEFT JOIN public.mercury_transaction_drag_sort_assignments asg ON asg.mercury_transaction_id = c.id
   LEFT JOIN public.mercury_drag_sort_labels lab ON lab.id = asg.label_id
   LEFT JOIN public.mercury_tally_payroll_flags pf ON pf.mercury_transaction_id = c.id
   LEFT JOIN LATERAL (
     SELECT x.created_at, x.created_by FROM (
       SELECT a2.created_at, a2.created_by FROM public.mercury_transaction_job_allocations a2 WHERE a2.mercury_transaction_id = c.id
       UNION ALL
       SELECT il2.created_at, il2.created_by FROM public.mercury_transaction_supply_house_invoice_links il2 WHERE il2.mercury_transaction_id = c.id
     ) x ORDER BY x.created_at DESC LIMIT 1
   ) srt ON true
   LEFT JOIN public.users sb ON sb.id = srt.created_by
   WHERE false
      OR pf.is_payroll IS NOT TRUE
      OR EXISTS (SELECT 1 FROM public.mercury_transaction_job_allocations a3 WHERE a3.mercury_transaction_id = c.id)
      OR EXISTS (SELECT 1 FROM public.mercury_transaction_supply_house_invoice_links il3 WHERE il3.mercury_transaction_id = c.id)
   ORDER BY c.posted_at, c.id;
   ```

Then, signed in as an office user (the dev server, read-only), the first real call — the proof the body compiles and answers: `fetchCardChargesWindow({ startYmd: '2026-09-01', endYmd: '2026-09-07' })` returns rows with holders, splits and categories.
