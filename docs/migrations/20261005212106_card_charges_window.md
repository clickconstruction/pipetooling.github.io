# 20261005212106_card_charges_window.sql (2026-10-05, v2.4594)

`list_card_charges_window(p_start_ymd date, p_end_ymd date, p_holder_user_id uuid DEFAULT NULL)`: every card charge posted in the company days `p_start_ymd..p_end_ymd`, one row per charge, oldest first. It is the read behind **People → Spending** (punch list #52, PR 4b) and the history the **Tally team queue** reads for its suggestions (#72 PR 2 and PR 5), agreed between the two so the same table does not get two overlapping readers in one week.

## What a row carries

| Column(s) | From |
|---|---|
| `mercury_transaction_id`, `posted_at`, `amount` (the bank's sign: a purchase is negative), `counterparty_name`, `kind`, `status` | `mercury_transactions` |
| `bank_category` | `mercury_category` as text (a string, or `{ name }` in older rows) |
| `debit_card_id`, `card_nickname`, `card_role` | `mercury_debit_card_id_from_raw(raw)`, `mercury_debit_card_nicknames` |
| `holder_user_id`, `holder_name` | `mercury_debit_card_user_links` (one holder per card: its primary key is the card id) |
| `attributed_user_id`, `attributed_person_id` | `mercury_transaction_attributions` |
| `label_id`, `label_default_key` | the accounting label (`internal_transfers` is the one card rule's exclusion) |
| `payroll_marked` | `mercury_tally_payroll_flags.is_payroll = true` |
| `job_splits` | the real splits: job id, amount, note, the job's number, name and service type, and when and by whom each was written. The Sorted RPC's keys (v2.4566), plus `created_at` / `created_by` |
| `invoice_links` | the supply-house invoices: id, number, date, amount, supply house, `created_at` |
| `sorted_at`, `sorted_by_name` | the newest split or invoice link and who wrote it, as in the Sorted RPC |
| `viewer_can_sort` | whether the split write this charge goes through admits the caller (below) |

Card kinds only (`debitCardTransaction`, `creditCardTransaction`): no ACH, no checks. Duplicates out. No `raw` comes back.

## The window

The company's civil day by `posted_at`, through `reporting_window_calendar_civil_day(NULL, day)` — the helper owns the zone (America/Chicago, the app's `APP_CALENDAR_TZ`), so the body spells no zone of its own. At most 366 days; a wider or upside-down window raises. A range on `posted_at` keeps the read on `mercury_transactions_posted_at_desc_idx` (the review window's `COALESCE(posted_at, created_at)` cannot use it). Ordered by `(posted_at, id)`, so a caller pages with `.range()` past PostgREST's silent 1,000-row cap (`lib/banking/cardChargesWindow.ts` does). A 90-day window is about 1,100 to 1,500 rows.

## Who may call it

`STABLE SECURITY DEFINER`, `SET search_path = public`. The first statement raises unless `is_office_staff()` (dev · master · assistant · controller). `REVOKE ALL` from `PUBLIC` and `anon`; `GRANT EXECUTE` to `authenticated`.

Definer because two pieces are not office-readable through RLS: the card-holder links (Banking staff) and the payroll marks (payroll access). The four roles already read the charges, attributions, splits, labels and invoice links. They already see the holder of a charge and its payroll resolution through the Team purchases definer RPCs, which list holders by name and leave payroll-marked charges off the queue. This read shows them for every holder, not only the viewer's circle. `docs/ACCESS_CONTROL.md` says so.

`viewer_can_sort`: a held card's splits are written by `replace_mercury_job_splits_for_linked_card_as_staff`, which admits only the holder's circle, so the read asks the same `staff_can_view_user_for_tally_followup(auth.uid(), holder)` once per holder. A card with no holder goes through `replace_mercury_transaction_splits`, which admits every office role, so it reads true. The page draws *Put on a job* only where the write will take it.

## House rules

Opens with `SET lock_timeout = '3s'`. `CREATE OR REPLACE`, idempotent. Creates no table, so no read-only block calls. `#variable_conflict use_column`, every column qualified.

Not rehearsed on a throwaway schema (no local Postgres or docker on the authoring machine); the joins are those of the Sorted and stale-list functions. The 90-day `SELECT` was sent for a read-only `EXPLAIN` on prod before the PR opened.

## Apply

`supabase db push` once this is on `main`. **Order: this before the People → Spending client (PR 4b-2).** No client calls the function in this PR, so pushing late breaks nothing; the tab PR merges only after the push.
