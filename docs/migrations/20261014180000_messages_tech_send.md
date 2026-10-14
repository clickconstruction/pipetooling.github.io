# 20261014180000_messages_tech_send.sql (2026-10-13, v2.5499)

Messages, residential R5 (Customer communication helper 10, directed by cc). These are the doors `quo-send`'s tech path asks as the tech, so a tech on a job can text its customer from Job Mode. The plan is `to-dos/gc-mode/messages/RESIDENTIAL_BUILD_PLAN.md` → R5 on spike/gc-mode. Job Mode's door stays off (`JOB_MODE_MESSAGES_ON = false`) until `quo-send` is deployed with the tech path.

## Why

Job Mode sends the job, the customer and maybe a contact. A tech could not find or make that contact: `contact_for_customer` (`20261014020000`) is the office's, and it reads `auth.uid()`, so neither a tech nor the service role passes it. `messages_tech_can_read` needs a contact before it can say whether the tech may write to the job's customer.

## What it does

1. **`messages_tech_on_job(job)`**: whether the signed-in tech, `messages_tech_team()`, is on this Pipeline job.
   - On the job means dispatched to it (`job_schedule_blocks.assignee_user_id`) or clocked on it (`clock_sessions.user_id`, not revoked).
   - The window is Monday of last week through Sunday of this week, in Chicago.
   - This is the span rule `messages_tech_can_read` held, now in one place.
2. **`messages_tech_can_read(contact)`** is recreated from its newest definition (`20261013190000`, its only one on main). It asks `messages_tech_on_job` of each of the contact's jobs: the same contacts, the same jobs, the same answer. Its two policies, `contacts_tech_read` and `messages_tech_read`, call it by name and are left as they are.
3. **`contact_find_or_make(customer)`** is the body `contact_for_customer` held, as a function of its own.
   - It finds the customer's own contact, or makes one with the number and the address on their row.
   - It refuses a training account and a digital twin before a write.
   - Nobody signed in may run it. Only the two doors below reach it.
4. **`contact_for_customer(customer)`** is recreated from its newest definition (`20261014020000`). It is the office's door with its refusals as they were, and it calls `contact_find_or_make` for the rest.
5. **`contact_for_job(job)`** is the tech's door.
   - A tech on the job gets the job's customer's own contact, made when there is none.
   - It refuses in words anyone signed out (*Sign in to message a customer.*) and anyone not a tech on this job (*Only a tech on this job sends from Job Mode.*). The office takes its own door.
   - It refuses a job with no customer (*This job has no customer yet.*).
   - A training account and a twin find a contact and never make one.

No new table, so no house calls.

## Push order

Push this migration first, then deploy `quo-send`, since its tech path calls `contact_for_job` and `messages_tech_on_job`. Until `quo-send` is deployed, nothing calls either function.

## Checked before the push

The SQL bed `messages-tech-send` (`npm run test:pg:messages-tech-send`) runs every migration on Supabase Postgres 17, then this one a second time, which must change nothing, then the scenario. Docker does not run on the office Mac, so it runs in the SQL beds workflow once the PR is ready. The `messages-spine` bed's tech door step checks `messages_tech_can_read`'s answers on the recreated function too.

- Who is on Dana's job:
  - on it: Luis, dispatched today; Hector, clocked last week; Tess, in training, dispatched today;
  - not on it: Paul, three weeks ago; Kim, on another job; Sal, a superintendent; Rosa, the office.
- Kim reads Kevin's thread, and Luis does not.
- The tech's door says no in words to Paul, Sal, the office and anyone signed out, and to a job with no customer.
- Tess, in training, makes nothing.
- Luis makes Dana's own contact with her number. Hector and Tess find the same one, and Dana's row still has one contact.
- Rosa's door finds Dana's. A tech is refused at the office's door. Nobody signed in may call the find-or-make body.

## Verify after the push

```sql
-- The five functions: definers; the doors and the reads signed in only; the body for nobody signed in.
SELECT p.proname, p.prosecdef,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN ('messages_tech_on_job', 'messages_tech_can_read', 'contact_find_or_make', 'contact_for_customer', 'contact_for_job')
ORDER BY p.proname;
-- expect: contact_find_or_make true false false; every other row true true false
```
