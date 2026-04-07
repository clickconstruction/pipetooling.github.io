# Company time and storage rules

## Naming

- Use the IANA zone **`America/Chicago`** everywhere code or SQL needs “Central” (handles **CST** and **CDT** automatically).
- Do **not** hard-code **CDT** / **CST** or fixed numeric offsets (`-05:00`, etc.) for business logic.

## Canonical constants

| Where | Export |
|-------|--------|
| Web app | `APP_CALENDAR_TZ` in [`src/utils/dateUtils.ts`](src/utils/dateUtils.ts) |
| Job schedule helpers | `JOB_SCHEDULE_TIMEZONE` in [`src/lib/jobScheduleChicago.ts`](src/lib/jobScheduleChicago.ts) (same value as `APP_CALENDAR_TZ`) |
| Edge Functions (Deno) | `APP_CALENDAR_TZ` in [`supabase/functions/_shared/appTimeZone.ts`](supabase/functions/_shared/appTimeZone.ts) — **keep in sync** with `dateUtils.ts` |

Run `npm run check:timezone` before merge to ensure no stray `'America/Chicago'` literals were added outside those files.

## What we store

| Kind | Typical Postgres types | Meaning |
|------|------------------------|---------|
| **Real instants** | `timestamptz` | A moment in time (stored as UTC internally). Use for audit fields, actual clock-in/out, etc.
| **Planned local day + wall clock** | `date` + `time` without time zone | Example: [`job_schedule_blocks`](PROJECT_DOCUMENTATION.md) **`work_date`** + **`time_start`** / **`time_end`** — interpret as **Chicago civil date** and **clock time**, not UTC.

Never treat a naive `time` column as UTC. Avoid `new Date(year, monthIndex, day, h, min)` for domain schedule fields (that uses the **browser’s** local zone); prefer helpers from `dateUtils` and `jobScheduleChicago`.

## Display and parsing

- **Calendar weeks, “today,” `YYYY-MM-DD` in Chicago:** [`src/utils/dateUtils.ts`](src/utils/dateUtils.ts).
- **Naive schedule `HH:MM[:SS]` strings (labels):** [`src/lib/jobScheduleChicago.ts`](src/lib/jobScheduleChicago.ts) (e.g. `scheduleFormatWindow`).

SQL migrations and RPCs may embed `'America/Chicago'` for `timezone()` / defaults; that is expected and not checked by `check:timezone` (script scopes app + Edge TS only).
