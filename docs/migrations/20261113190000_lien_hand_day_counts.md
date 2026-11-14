# 20261113190000_lien_hand_day_counts.sql (2026-11-13, v2.7193)

The day set by hand counts (punch list #335, row 1). The owner's reading of 2026-11-13, to the question *which last day of work counts for the lien clock*: **the day set by hand**.

`jobs_ledger.lien_last_work_on` (v2.4676) is the last day of work the office types on a job. Four readers took the later of its month and the approved clock sessions' months, so hours approved after the day was set moved the job's lien clock. This migration rewrites each from its newest definition with only that rule changed:

| Function | Was | Now |
|---|---|---|
| `list_lien_notice_months` | every month with approved hours, plus the hand month when no session reached it or a later month | months with approved hours up to the hand month, plus the hand month; a later month is off the clock |
| `list_lien_affidavit_windows` | `last_month` = the later of the sessions' last month and the hand month | `last_month` = the hand month when a day is set |
| `list_gc_unpaid_months` | as the notice months | as the notice months |
| `list_jobs_owner_to_confirm` | first month = the first with approved hours; the hand month only on a job with none | the first month on the clock: hours after the hand month do not count |

- A job with no day set by hand reads exactly as before.
- The hand day's own month reads `month_source = 'hand'` also when it has approved hours, since the day in it is the one set by hand. Its `approved_hours` are still summed.
- Same arguments and columns, so `CREATE OR REPLACE` keeps every grant. No table changes. `clock_sessions` is not touched. The column's comment is rewritten to the rule.
- The client's twin is `lienClockMonths` in `src/lib/jobs/lienLastWorkDay.ts`.

**Order.** The client can ship first. Before the push the Lien window and the affidavit's work period follow the hand day while the desk's lists (Notices, Affidavits, GC on notice, Owner to confirm) still take the later month, which is the disagreement the billed row and the desk already had. After the push every reader agrees. Nothing the old client calls changes shape.

**Bed.** `npm run test:pg:lien-hand-day` (`supabase/tests/lien_hand_day/`, in `scripts/sql-beds.txt`): the four readers on stand-in tables with the two real deadline functions, the migration applied twice, 21 assertions. It fails on a copy of the migration with the rule taken out.

**What moves on prod.** One live job fits today (a day set by hand, approved hours four months later). After the push the desk stops listing the later month for it and counts its affidavit from the hand month, whose window has closed.
