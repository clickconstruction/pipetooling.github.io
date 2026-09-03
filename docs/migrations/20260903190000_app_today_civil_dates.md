# 20260903190000_app_today_civil_dates (v2.2703, 2026-09-03)

**Why.** The Postgres session zone is UTC, so `CURRENT_DATE` is already tomorrow's date every evening after 7 PM Central (6 PM in winter). Three RPCs wrote or validated against it:

| Function | Site | Effect of the old expression |
|---|---|---|
| `create_turnaway_trip_charge` | `estimated_bill_date` on the trip-charge invoice | evening turnaways were dated the next day |
| `mark_job_paid` | `COALESCE(p_paid_on, CURRENT_DATE)` → `paid_on` | evening "mark paid" with no date landed on the next day |
| `create_billed_shell_invoice` | `IF p_billed_on > CURRENT_DATE` guard | the "cannot be in the future" check allowed tomorrow's date in the evening |

**What.** Adds `public.app_today()` (STABLE, `(now() AT TIME ZONE 'America/Chicago')::date` — the SQL twin of `todayYmdInAppTz()`), and re-creates the three functions from their live prod definitions with only that expression changed. No table or row is touched; the `docs/recent-features/v2.2703.md` fragment records the before/after checksums that prove it.

**Going forward.** `npm run check:timezone` fails on `CURRENT_DATE` in any migration newer than this one (waive a deliberate read-side use with `-- tz-ok: <why>`).
