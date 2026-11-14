# 20261113200000_lien_months_from_bill.sql (2026-11-13, v2.7224)

The month comes from the bill. The owner, 2026-11-13: *"if a clock session has no hours it should not be from the job creation date but from the bill date"*.

A job with no approved clock hours and no last day of work set by hand was dated from the day it was made (v2.3747, `lien_fallback_month`). Jobs brought in from the earlier system were made weeks after their work, so every lien date on them counted from the month they were typed in.

**New function.** `public.lien_bill_months(p_job_id uuid) RETURNS TABLE (work_month text)`: the months a job's sent, unpaid bills are dated in (`jobs_ledger_invoices.status = 'billed'`), as `YYYY-MM` in the company calendar. A bill's day is the earlier of `billed_at` and `sent_to_customer_at`. `LANGUAGE sql STABLE`, no `SECURITY DEFINER`: a direct call runs under the bills' own row rules. Granted to `authenticated` and `service_role`.

**The four readers**, each from `20261113190000_lien_hand_day_counts.sql` with only the creation branch split in two:

| Function | A job with no hours and no hand day was | Now |
|---|---|---|
| `list_lien_notice_months` | one row, its creation month, `month_source = 'job_created'` | one row per bill month, `month_source = 'bill'`; the creation row only when it has no dated unpaid bill |
| `list_lien_affidavit_windows` | `last_month` = its creation month | `last_month` = its latest bill month, `'bill'`; else the creation month |
| `list_gc_unpaid_months` | as the notice months | as the notice months |
| `list_jobs_owner_to_confirm` | first month = its creation month | first month = its earliest bill month, `'bill'`; else the creation month |

- A day set by hand and approved hours come first, exactly as before. A job that has either reads as it did.
- A job with no dated unpaid bill keeps its creation month, so no job falls out of a reader (punch list #32's lesson). That includes a job not billed yet, which two of the readers list.
- Same arguments and columns, so `CREATE OR REPLACE` keeps every grant. No table changes. `clock_sessions` and `jobs_ledger_invoices` are not written.
- The file was produced from `20261113190000` by a script that replaces the one branch and asserts it matched once per function; a diff of the two shows the bill branch and one `NOT EXISTS` line per reader, nothing else.
- The client's twin is `lienStandInMonth` in `src/lib/jobs/lienBillMonths.ts`.

**A bill is not a record of work.** Measured read-only on 187 billed or paid jobs that have both approved hours and a dated bill: the latest bill's month was the last month worked on 132, earlier on 31 and later on 24. So a row with `month_source = 'bill'` is a stand-in: every surface says so, and no paper is held for it (the owner, 2026-11-13: *"Only flag it"*).

**Order.** The client ships first. An older client reads a `'bill'` row as a row from hours (it knows `job_created` and `hand` only), so it would draw the month with no word that it is a stand-in. Between the merge and the push the billed row, the Deadlines list and the Lien window already count from the bill while the desk's lists (Notices, Affidavits, GC on notice, Owner to confirm) still take the creation month. After the push every reader agrees. The client calls nothing this migration creates.

**Bed.** `npm run test:pg:lien-bill-months` (`supabase/tests/lien_bill_months/`, in `scripts/sql-beds.txt`): the `lien_hand_day` bed's stand-in tables plus the two days a bill carries, the two real deadline functions, the readers as `20261113190000` left them, then this migration applied twice and 17 assertions that mirror `lienBillMonths.test.ts`. Run on a local Postgres 15 (`PGTEST_PG_BIN`); Docker was not up on the machine that wrote it, so CI's SQL beds leg is its first run on the Supabase image. The stand-in `lien_billed_open` is the hand-day bed's, so the money is not what this bed proves.

**What moves on prod** (read-only count, 2026-11-13, jobs in *Billed* with no approved hours and no day set by hand): 32 jobs, 31 with money open. 18 keep their month. 8 take an earlier month whose filing window has already closed under the app's reading. 6 take a later month: 4 on the desk get a later last day to file, and 2 that had dropped off come back. Two approved affidavits sit on a job whose month changes; neither paper is redrawn or re-approved by this change. Whether a lien right stands is counsel's question.

**Not fixed by this.** The bills of the jobs that prompted it carry the day they were typed in, not the day the earlier system issued them: the app keeps no original bill date. Those jobs read the same month after the push. The existing door, the last day of work set by hand, is what corrects them.
