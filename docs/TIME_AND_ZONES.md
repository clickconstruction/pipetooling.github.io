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

Run `npm run check:timezone` (`scripts/check-app-calendar-tz.mjs`; CI runs it on every pull request) before merge: it refuses a stray `'America/Chicago'` literal outside those files and the rules listed below; test files are exempt from all but the literal rule, since they pin the bug on purpose.

## "Today" and end-of-day (v2.2703)

There is one "today" per runtime, and it is the Central civil date — never the UTC clock, which is tomorrow's date every evening after 7 PM Central (6 PM in winter). The day of a stored instant (`reviewed_at`, `sent_at`) is read the same way, never as its first ten characters, a local helper such as `ymdOf` included (`check:timezone` does not yet catch that spelling, so review alone keeps it out):

| Runtime | Helper |
|---|---|
| Web app | `todayYmdInAppTz(now?)`, `calendarYmdInAppTzFromIso(iso)` (an instant's day; given a bare `YYYY-MM-DD` it reads UTC midnight, the evening before in Chicago, so a reader that may get either form keeps a bare date as it is — `arCustomerChase`'s `touchYmd`, `convertDueDateYmd`, `customer-portal`'s `sent.on`), `startOfYmdInAppTzMs(ymd)`, `endOfYmdInAppTzMs(ymd)` in `src/utils/dateUtils.ts` (DST-aware) |
| Edge Functions | `todayYmdInAppTz(now?)` (an instant's day: pass `new Date(iso)`), `ymdAddDays(ymd, n)` in `supabase/functions/_shared/appTimeZone.ts` — parity with the web helper is pinned by `src/lib/appTimeZoneSharedParity.test.ts` |
| Postgres | `public.app_today()` — the session zone is UTC, so `CURRENT_DATE` has the same evening problem |

Rule 5 (v2.3061): no `toLocaleDateString('en-CA')` without options as a `YYYY-MM-DD` source — Node 20 / ICU 72 render it `MM/DD/YYYY`; use `todayYmdInAppTz()` for today or `localCalendarDayKey(d)` for a device-local Date.

Rules `npm run check:timezone` enforces: no `new Date().toISOString().slice(0, 10)` (or the substring/split spellings), download-filename stamps included since v2.4891; no end-of-day built as `<ymd> + 'T23:59:59Z'` (that is 7 PM Central — use `endOfYmdInAppTzMs`, or compare civil dates; the same at the start of a day: a read from a day begins at `startOfYmdInAppTzMs(ymd)`, never `${ymd}T00:00:00Z`, which is 7 PM Central the evening before, and stamps are compared as instants, never as strings, since `+00:00` and `Z` do not sort together — v2.5950's Collect scorecard follows it, and the check does not catch this one); no `CURRENT_DATE` in migrations newer than `20260903190000`; no stored instant's day read off its UTC prefix with a regex (`/^(\d{4}-\d{2}-\d{2})/.exec(t.createdAt)` — use `calendarYmdInAppTzFromIso`, since v2.5954). A deliberate exception takes `// tz-ok: <why>` (or `-- tz-ok:` in SQL) on the line. Pure date arithmetic on a `YYYY-MM-DD` via `Date.UTC(...)` is fine — a day is a day.

## What we store

| Kind | Typical Postgres types | Meaning |
|------|------------------------|---------|
| **Real instants** | `timestamptz` | A moment in time (stored as UTC internally). Use for audit fields, actual clock-in/out, etc. A chosen day kept here is anchored at noon so its day in `APP_CALENDAR_TZ` is the day chosen — a backdated bill at Chicago noon (`create_billed_shell_invoice`), a pay payment at the device's noon (`useRecordPayStubPayment`); a `date` column (`person_contract_documents.signed_at`, `job_lien_filings.filed_at`) keeps its own day, and slicing it takes a `// tz-ok:` waiver.
| **Planned local day + wall clock** | `date` + `time` without time zone | Example: [`job_schedule_blocks`](PROJECT_DOCUMENTATION.md) **`work_date`** + **`time_start`** / **`time_end`** — interpret as **Chicago civil date** and **clock time**, not UTC.

Never treat a naive `time` column as UTC. Avoid `new Date(year, monthIndex, day, h, min)` for domain schedule fields (that uses the **browser’s** local zone); prefer helpers from `dateUtils` and `jobScheduleChicago`.

## Display and parsing

- **Calendar weeks, “today,” `YYYY-MM-DD` in Chicago:** [`src/utils/dateUtils.ts`](../src/utils/dateUtils.ts).
- **Naive schedule `HH:MM[:SS]` strings (labels):** [`src/lib/jobScheduleChicago.ts`](../src/lib/jobScheduleChicago.ts) (e.g. `scheduleFormatWindow`).

SQL migrations and RPCs may embed `'America/Chicago'` for `timezone()` / defaults; that is expected and not checked by `check:timezone` (script scopes app + Edge TS only).
