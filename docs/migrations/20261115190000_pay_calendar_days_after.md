# 20261115190000_pay_calendar_days_after.sql (2026-11-15, v2.7343)

Pay calendar, a number of days after the bill (punch list #341, PR 5): the second shape of terms. A contract that pays a set number of days after the bill is accepted, *net 45*, had no home: a Pay calendar held a cutoff and a pay day, and nothing else.

- **`payer_pay_calendars.days_after`** (new column, `smallint`, nullable): paid this many days after the bill is accepted. `payer_pay_calendars_days_after_check` holds it to 1 to 180.
- **`payer_pay_calendars_shape_check`**, dropped and added again: a row is one job's off switch, a calendar (`pay_day` set) or days after the bill (`days_after` set), and only one of them. Before, a row was an off switch or a calendar.
- **`set_payer_pay_calendar(p_payer_customer_id, p_job_id, p_calendar jsonb)`**, replaced with the same signature and the same gate (`can_write_payment_promises()`): `p_calendar` may now be `{daysAfter, payWhenPaid, clause, words}`. It stores `days_after` with no pay day and no cutoff, and refuses a number outside 1 to 180 in words. A calendar, a job's off switch and a clear go as before.
- No new table, so no fence calls. RLS and grants are untouched.

Starts with `SET lock_timeout = '3s'`. Idempotent: `ADD COLUMN IF NOT EXISTS`, each constraint dropped `IF EXISTS` before it is added, `CREATE OR REPLACE` for the function. Adding a check reads the table once under a short lock; the table held no row on prod when this was written.

**Either side of the push.** A client from before this migration sends no `daysAfter` and is answered as before. The client in this PR reads `days_after` and falls back to the old column list on a database that has no such column yet, so its calendars still read. A save of days after the bill carries no pay day, so the old function refuses it with *The pay day is a day of the month, 1 to 31*, where it would otherwise have stored a calendar nobody asked for. A reader that selects no `days_after` (the morning run's own select, until its next deploy) finds no pay day on such a row and skips it: the bill reads the pace guess, never a wrong calendar.

Proven on a throwaway copy of the whole schema by section 10 of `npm run test:pg:pay-calendar` (`supabase/tests/pay_calendar/20_scenario.sql`), which also applies it a second time; never on prod.

Apply order: after `20261112150000_payer_pay_calendars.sql`. **Push right after the merge**, then `npm run gen-types:linked` as its own `chore(types)` PR.
