# Company time and storage rules

## Naming

- Use the IANA zone **`America/Chicago`** everywhere code or SQL needs “Central” (handles **CST** and **CDT** automatically).
- Do **not** hard-code **CDT** / **CST** or fixed numeric offsets (`-05:00`, etc.) for business logic.

## Canonical constants

| Where | Export |
|-------|--------|
| Web app | `APP_CALENDAR_TZ` in [`src/utils/dateUtils.ts`](../src/utils/dateUtils.ts) |
| Job schedule helpers | `JOB_SCHEDULE_TIMEZONE` in [`src/lib/jobScheduleChicago.ts`](../src/lib/jobScheduleChicago.ts) (same value as `APP_CALENDAR_TZ`) |
| Edge Functions (Deno) | `APP_CALENDAR_TZ` in [`supabase/functions/_shared/appTimeZone.ts`](../supabase/functions/_shared/appTimeZone.ts) — **keep in sync** with `dateUtils.ts` |

Run `npm run check:timezone` before merge to ensure no stray `'America/Chicago'` literals were added outside those files.

## "Today" and end-of-day (v2.2703)

There is one "today" per runtime, and it is the Central civil date — never the UTC clock, which is tomorrow's date every evening after 7 PM Central (6 PM in winter):

| Runtime | Helper |
|---|---|
| Web app | `todayYmdInAppTz(now?)`, `startOfYmdInAppTzMs(ymd)`, `endOfYmdInAppTzMs(ymd)` in `src/utils/dateUtils.ts` (DST-aware) |
| Edge Functions | `todayYmdInAppTz(now?)`, `ymdAddDays(ymd, n)` in `supabase/functions/_shared/appTimeZone.ts` — parity with the web helper is pinned by `src/lib/appTimeZoneSharedParity.test.ts` |
| Postgres | `public.app_today()` — the session zone is UTC, so `CURRENT_DATE` has the same evening problem |

Rules `npm run check:timezone` enforces: no `new Date().toISOString().slice(0, 10)` (or the substring/split spellings) outside download-filename stamps; no end-of-day built as `<ymd> + 'T23:59:59Z'` (that is 7 PM Central — use `endOfYmdInAppTzMs`, or compare civil dates); no `CURRENT_DATE` in migrations newer than `20260903190000`. A deliberate exception takes `// tz-ok: <why>` (or `-- tz-ok:` in SQL) on the line. Pure date arithmetic on a `YYYY-MM-DD` via `Date.UTC(...)` is fine — a day is a day.

## What we store

| Kind | Typical Postgres types | Meaning |
|------|------------------------|---------|
| **Real instants** | `timestamptz` | A moment in time (stored as UTC internally). Use for audit fields, actual clock-in/out, etc.
| **Planned local day + wall clock** | `date` + `time` without time zone | Example: [`job_schedule_blocks`](PROJECT_DOCUMENTATION.md) **`work_date`** + **`time_start`** / **`time_end`** — interpret as **Chicago civil date** and **clock time**, not UTC.

Never treat a naive `time` column as UTC. Avoid `new Date(year, monthIndex, day, h, min)` for domain schedule fields (that uses the **browser’s** local zone); prefer helpers from `dateUtils` and `jobScheduleChicago`.

## Display and parsing

- **Calendar weeks, “today,” `YYYY-MM-DD` in Chicago:** [`src/utils/dateUtils.ts`](../src/utils/dateUtils.ts).
- **Naive schedule `HH:MM[:SS]` strings (labels):** [`src/lib/jobScheduleChicago.ts`](../src/lib/jobScheduleChicago.ts) (e.g. `scheduleFormatWindow`).

SQL migrations and RPCs may embed `'America/Chicago'` for `timezone()` / defaults; that is expected and not checked by `check:timezone` (script scopes app + Edge TS only).
