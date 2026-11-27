# 20261127164654_lien_early_on_check_three_roles.sql (2026-11-27, v2.8742)

Before a check clears, the database lets only a leader, a controller or a dev write the two things that let a lien's release go. Punch list #437 (the held check), call 4, the database half. The person's answer of 2026-11-27, asked *Whether the database also refuses an early lien release from anyone but the three roles, and whether Release it anyway is held to the same three*: **yes to 1 and 2**. The answer covers the build. The push waits on its own yes.

## Why

Two writes let a release go before the bank has cleared the check that paid it:

- **Release it anyway…** on the Release of record tab: a `job_lien_filings` row of kind `release_of_record` whose `fields` carry `releasedBeforeClearedReason`.
- **The bank confirmed the funds** on a Payoffs place card: `fields.fundsConfirmed` on the lien's row, `{ by, name, at, note }`. With it on the lien, the release is offered to anyone who may make one.

The screen draws both for dev, master_technician and controller alone (v2.8632 for the funds, v2.8735 for the release, one list: `EARLY_ON_CHECK_ROLES` in `src/lib/jobs/checkCleared.ts`). The table did not ask. A release is an insert under `job_lien_filings_insert_office` and the confirmation an update under `job_lien_filings_update_office`, and both pass the whole office and a job's own leader. An assistant with a request written by hand could do either.

## What it makes

One function and one trigger: `job_lien_filings_early_on_check_guard`, `BEFORE INSERT OR UPDATE` on `job_lien_filings`, a definer's function nobody may call directly.

For a signed-in caller who is not a dev, a leader (`master_technician`) or a controller (`is_master_or_dev() OR is_controller()`), it refuses with `42501`:

1. A `release_of_record` row that gains `releasedBeforeClearedReason`: an insert that carries the key, or an update that adds it or changes its words. *Only a leader, a controller or a dev can release a lien before its check clears.*
2. Any row whose `fields.fundsConfirmed` is set, changed or taken off: an insert that carries the key, or an update where the key's value before and after differ. *Only a leader, a controller or a dev can say the bank confirmed the funds, or take that back.*

**Why a trigger and not a policy.** Rule 2 holds the row as it was against the row as it would be. A policy's check sees only the new row, so it would refuse an assistant who keeps the day a release was asked for on a lien that already carries a confirmation. That update must still pass, and with the trigger it does.

## What stays as it was

- Every other insert and update of the table, for every role the policies pass: a notice, a lien, a release with no reason, a release that went out with money still open (`releasedUnpaidReason`, which call 4 did not ask about), a release that rests on a confirmation (`releasedOnConfirmedFunds`, the copy the release row carries), the stamps, the sends, a void.
- No policy, grant, column or row is changed.
- A caller with no sign-in behind it passes: the service role and the edge functions that use it, as `users_guard_privileged_columns` lets them. The mail refresh stamps `sends` and `served_at` that way. `anon` holds no policy on the table, so its insert is refused after the trigger as before.
- The dev seat writes a filing as the dev, so it passes as a dev.

## What it does not do

It does not tell an early release from an ordinary one by itself. The database reads no bank row, so a release row that leaves the reason out is an ordinary release to it. The screen is what knows a check has not cleared. This file makes sure the two things the screen writes then cannot be written by anyone else.

It does not check that a release carrying `releasedOnConfirmedFunds` rests on a confirmation that stands on the lien.

## What a caller can learn from it

Nothing about any row. The trigger answers a signed-in caller before the row policy is asked on an insert, and it reads the new row, the old row and the caller's own role alone. On an update the row policy hides a row first, so a caller who cannot read a lien reaches no row and no trigger runs.

## What the push leaves on prod

One function and one trigger on `job_lien_filings`. No table, column, row, policy or grant is made or changed. `CREATE TRIGGER` takes a brief lock on the table that waits behind open statements on it; `SET lock_timeout = '3s'` opens the file, so a busy moment fails the push fast. No table is created, so the four closing calls do not apply. Safe to run twice.

## Order

The client calls nothing this migration creates. **Push once v2.8735's client is live** (PR #10082). On a client older than v2.8735 an assistant is still offered *Release it anyway…* on a check that has not cleared; after the push that press would be refused in the trigger's words. That is the rule working, but the screen should stop offering it first. *The bank confirmed the funds* has been drawn for the three alone since v2.8632. No deploy and no types PR is owed: a trigger function changes no generated type.

## Read before the push

Read-only. The file was written from the repo's migrations; the live policies and triggers were not read by the PR's thread.

```sql
SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'public.job_lien_filings'::regclass ORDER BY 1;
SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'public.job_lien_filings'::regclass AND NOT tgisinternal ORDER BY 1;
SELECT DISTINCT p.proowner::regrole FROM pg_proc p
WHERE p.oid IN ('public.is_master_or_dev()'::regprocedure, 'public.is_controller()'::regprocedure);
```

Expected: the four policies of `20260902164655` as restated by `20260906200000`; no trigger of this name yet; one owner for the two helpers, which the new function will share.

## Verify after the push

Read-only: the trigger stands once and enabled, its function is a definer's, and `check_migration_ledger` reads this version as applied. A read of a lien through the dev seat still answers.

With a write, on its own yes, on a ZZ test job's lien only: as a dev, press **The bank confirmed the funds** and take it off again. The refusal for an assistant is the bed's to show; a live try needs View as and its own yes.

## Roll back

`DROP TRIGGER job_lien_filings_early_on_check_guard ON public.job_lien_filings;` and `DROP FUNCTION public.job_lien_filings_early_on_check_guard();` in a new migration. Nothing else was changed.

## Test

`npm run test:pg:lien-early-on-check`, new: `supabase/tests/lien_early_on_check/20_scenario.sql`, on the whole schema, in one transaction that rolls back, with made-up people and a made-up job. The script applies this migration a second time first, which must change nothing.

- The guard stands once on the table, enabled, as a definer nobody may call directly.
- **Each of the nine roles**, signed in, through RLS: an early release, a confirmation set on a lien, a confirmation changed, a confirmation taken off.
  - dev, master_technician and controller: all four land, and the rows read as each left them.
  - assistant: all four are refused in the trigger's words.
  - estimator, primary, superintendent, subcontractor and helpers: the insert is refused in the trigger's words, and each update reaches no row, since the row policy hides the lien from them.
- **Everything else, as the assistant:** an ordinary release, a release that went out with money still open, a release that rests on a leader's confirmation, a notice and a lien, the day a release was asked for kept on a lien that carries a confirmation, a served stamp and a void all pass. On an early release a leader made, the assistant may change the recording number and may not change the reason. The assistant may not add the reason to an ordinary release after the fact.
- A helper's ordinary release is still refused by the row policy, and a helper reads no filing.
- With no sign-in, as the service role: a write of a lien's sends passes, and so does a confirmation.

It ran whole on 2026-11-27 on a local Docker, on the Supabase image with every migration applied, and passed: 55 assertions.

- **With the guard dropped** the scenario fails at its first assertion.
- **The gap, shown on the same bed.** With the trigger disabled inside a transaction that rolled back, an assistant's hand-written early release landed and so did a confirmation. With it on, each is refused in its words.
- **The six other beds that write this table** (`combine_rows`, `customer_sends_trail`, `lien_closed_days`, `lien_hand_day`, `lien_notice_record_delete`, `lien_void_paper`) write neither key, by a search of their files. They were not run here; the SQL beds job on the PR runs every bed.
