# 20261008120000_gc_company_record_app_today.sql (2026-10-08, v2.4918)

GC mode's company record (B1, `20261008020000_gc_company_record`) dates its rows in the company's calendar, not in UTC.

The database session runs in UTC, so `CURRENT_DATE` is tomorrow's date every evening after 7 PM Central (6 PM in winter). B1 stamped days with `CURRENT_DATE`, so an ask made at 9 PM on Oct 7 was dated Oct 8. The app reads that as an ask made tomorrow. Follow up's "asked N days ago" reads -1, and the ask sits a day off from a call logged the same evening, which the app dates with `todayYmdInAppTz()`.

The fix uses `public.app_today()` (`20260903190000_app_today_civil_dates`), the SQL twin of `todayYmdInAppTz()`, in every place B1 stamped a day:

- **Six column defaults:**
  - `gc_company_vetting_forms.sent_on`
  - `gc_invites.invited_on`
  - `gc_quotes.submitted_on`
  - `gc_company_contacts.contacted_on`
  - `gc_trade_promises.made_on`
  - `gc_trade_promise_moves.moved_on`
- **Four functions**, each body B1's byte for byte, which is prod's live definition (`pg_proc.prosrc`, compared before the cut), with only `current_date` changed:
  - `gc_vet_company`: `vetting_decided_on`
  - `gc_keep_promise` and `gc_keep_promises`: `kept_on` when no day is given
  - `gc_office_decline`: `declined_on`

No signature, grant, comment or policy changes, and no client change. The client already sends the app's day for the call log's lines. Idempotent: `SET DEFAULT` and `CREATE OR REPLACE`. Each `ALTER TABLE … SET DEFAULT` takes a brief lock on a table of a few rows, under `lock_timeout = '3s'`.

## One evening row, before and after

Prod at 04:15 UTC on 2026-10-08 (11:15 PM Central on Oct 7): `current_date` = 2026-10-08, `public.app_today()` = 2026-10-07.

- **Before.** The test ask made that evening, gc_invites `115b6971-ee16-4459-9340-85fc35d5c1e3` (the test project's Concrete, "GC test trade company, delete me"), reads `invited_on = 2026-10-08`. Its note line, written by the client, reads `contacted_on = 2026-10-07`, and the board shows "asked Oct 8" beside a call on Oct 7.
- **After.** The same ask made after the push reads `invited_on = 2026-10-07`, the day the office made it. So do the note, the decline day, the vetting decision and a kept promise. The row above keeps its Oct 8: the fix changes what is written from now on, and nothing already written.

## Checked before the push

On a local Postgres (PGlite) with B1's chain and `app_today()` stubbed one day behind the session, to stand in for an evening in Central time:

- B1's chain applied, and an ask made then was dated the session's day, 2026-10-08.
- This migration applied twice without error.
- `information_schema.columns` lists the six defaults as `app_today()`, and no `gc_` column defaults to `CURRENT_DATE` any more.
- After it, each of these reads the company's day, 2026-10-07:
  - an ask (`gc_invite_companies`) and its note line;
  - a vetting form;
  - `gc_vet_company`;
  - two `gc_record_promise` calls and the move between them;
  - `gc_keep_promise` and `gc_keep_promises` with no day;
  - `gc_office_decline`.

## Verify after the push

```sql
-- The six defaults read app_today(), and none reads CURRENT_DATE.
SELECT table_name, column_name, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name LIKE 'gc_%'
  AND (column_default ILIKE '%current_date%' OR column_default ILIKE '%app_today%')
ORDER BY 1, 2;

-- The four functions stamp app_today(), and none reads current_date.
SELECT proname, prosrc ILIKE '%app_today()%' AS app_today, prosrc ILIKE '%current_date%' AS utc
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND proname IN ('gc_vet_company', 'gc_keep_promise', 'gc_keep_promises', 'gc_office_decline');
```

Expected: six rows of `app_today()`, then four rows with `app_today = true` and `utc = false`.

## Rollback

Not expected. If needed, rerun the four `CREATE OR REPLACE` bodies from `20261008020000_gc_company_record.sql`, and `ALTER COLUMN … SET DEFAULT current_date` on the six columns.

## Status

Cut 2026-10-08 by the Board lane (Helper 2) at the lead's word. Push it after merge with the next batch (with O3).
