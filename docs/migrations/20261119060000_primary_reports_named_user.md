# 20261119060000_primary_reports_named_user.sql (2026-11-19, v2.7914)

The primary's report rule, asked about a **named** user, for the senders that have no login. It is part 5 of the primary scoping, right behind part 4 ([`20261119040000`](./20261119040000_primary_scope_reports.md), v2.7906), which holds a primary to their own jobs' reports wherever the database knows who is asking. It ships with the three senders that ask it ([v2.7914](../recent-features/v2.7914.md)).

Push after the merge, from a clean checkout of `main`, and **before** the edge functions are deployed. It is safe on either side of the client deploy and of the function deploys: nothing a client calls changes, and a sender that asks before the functions exist holds a primary's mail and sends everyone else's.

## Why

The field report emails (`send-report-email`), the digest (`recurring-job-report-dispatch`, its preview and test send) and the push on a new report (`send-report-notification`) read with the service role. No policy reaches them and `auth.uid()` is null, so part 4 did not narrow what they send. On 2026-11-19 nothing leaked: prod had one field-report subscription and two digest recipients, all the same master, and a primary cannot subscribe themselves (`can_manage_report_email_subscriptions`). This closes the door before the office subscribes a primary.

## What it makes

| Object | What it is |
|---|---|
| `primary_user_can_read_job_reports(user, job)` | New. That user is the job's account manager, or listed as superintendent on the job's project (`project_superintendents`, or `gc_projects.superintendent_user_id`). `SECURITY DEFINER`, `service_role` only. |
| `primary_user_can_read_report(user, job, project, bid, author)` | New. **The one statement of the rule**: the user wrote the report, or reads its job's reports, or is listed on its project when it has no job, or its bid is theirs when it has neither. `SECURITY DEFINER`, `service_role` only. |
| `primary_can_read_job_reports(job)` | Replaced. One line: `primary_user_can_read_job_reports(auth.uid(), job)`. Name, argument, grants and answers unchanged. |
| `primary_can_read_report(job, project, bid, author)` | Replaced. One line: `primary_user_can_read_report(auth.uid(), ...)`. Name, arguments, grants and answers unchanged. |
| `reports_open_to_user(user, report ids)` | New. Of the ids given, the ones that user reads in the app. Every id for a user who is not a primary. None for no user, or an id with no `users` row. `SECURITY DEFINER`, `service_role` only. |
| `reports_open_to_address(address, report ids)` | New. The same for an outside address of `report_email_subscriptions`. Every id, unless the address is a primary's own account address (`lower(trim(users.email))`, the match `get_my_email_schedule` makes); then that primary's reports. `SECURITY DEFINER`, `service_role` only. |

EXECUTE is revoked from `PUBLIC`, `anon` and `authenticated` by name on the four new functions. A signed-in user cannot ask what somebody else reads.

## One statement, and the two lines restated

The report rule lives in `primary_user_can_read_report` and nowhere else. Part 4's policies and list functions read it through `primary_can_read_report`, the senders through `reports_open_to_user`. The app and the mail cannot disagree.

Two legs of the rule come from parts 1 to 3, where they are written for the caller: `primary_can_access_job` (`jobs_ledger.account_manager_user_id = auth.uid()`) and `primary_can_access_bid` (the bid's estimator, account manager or creator). They cannot be asked about a named user. Turning them into wrappers too would add a function call to every row a primary reads through the bid, estimate and job policies of parts 1 to 3, with no answer changed. So the new body writes those two comparisons out against the named user. Whoever changes what puts a primary on a job or a bid changes it in both places; the bed below fails if they part on its rows.

The two functions replaced were made by part 4, one file earlier, and neither was on prod when this was written. They are replaced whole on purpose, since their body moves. The copy checked against was `pg_get_functiondef` on a bed of the whole schema with part 4 applied.

## The calls made here, for the owner to confirm

1. **A role that is not primary is not narrowed.** `reports_open_to_user` answers every id for a superintendent or a helper. The office picks who a stream goes to, and those roles' own doors are not the owner's sentence. Only dev, master, assistant and controller manage the lists.
2. **A primary's own address typed as an outside address is that primary.** Otherwise typing the address would send what picking the person does not. Every other outside address, a GC's or an owner's inbox, is sent what it was.
3. **The digest's clock rows are untouched.** The crew's hours, notes and optional costs on a job are not field reports, and the owner's sentence names reports. A primary on a digest still gets those rows for every job of the schedule's master. Parts 1 to 3 hold a primary to their own jobs in the app, so this is the next door to look at.

## The bed

`npm run test:pg:primary-scope-reports` (`scripts/pgtest-primary-scope-reports.sh`, part 5 of `supabase/tests/primary_scope_reports/20_scenario.sql`). The runner applies part 4 and then this file a second time each, in that order. Part 5 asks by name: the primary reads exactly the reports he reads signed in, from the table and from the list. A primary on nothing reads none. The master, the assistant and a superintendent read every report named. No user and an unknown id read none. The primary's own address, in any case and with spaces, reads as he does; a GC's inbox and the master's address read every report. The four new functions refuse `authenticated` and `anon`. Every job `primary_can_access_job` passes opens by name, and the bids `primary_can_access_bid` passes (account manager, estimator, creator) are the bids that open by name, no more and no fewer.

## Verify

Read-only on prod after the push, as the dev:

```sql
select p.oid::regprocedure, p.proacl
from pg_proc p
where p.proname in ('reports_open_to_user', 'reports_open_to_address', 'primary_user_can_read_report', 'primary_user_can_read_job_reports');
```

Four functions, each with `service_role` and neither `anon` nor `authenticated`. Then open the Dashboard with View as, Sample primary: the Recent Reports card reads as it did after part 4, since the two predicates answer as before.

## Deploy order

1. Merge [v2.7906](../recent-features/v2.7906.md) and push `20261119040000`.
2. Merge this change and push `20261119060000`.
3. From `main`: `supabase functions deploy send-report-email`, `send-report-notification`, `recurring-job-report-dispatch`, `recurring-job-report-preview`, `recurring-job-report-test-send`. Any order among the five.
