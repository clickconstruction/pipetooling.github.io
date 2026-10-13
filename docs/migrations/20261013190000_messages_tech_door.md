# 20261013190000_messages_tech_door.sql (2026-10-13, v2.5419)

Residential build, R5's SQL (Customer communication helper 8, directed by the lead session customer-comunication). The plan is `to-dos/gc-mode/messages/RESIDENTIAL_BUILD_PLAN.md` on spike/gc-mode, R5 and its data rows. No new table, so no fences. Nothing on screen reads it yet: R5's Job Mode screens, the who-has-it rule (`messages/hasRule.ts`) and the push (`messages/notifyRule.ts` through `messages-notify`) come after.

## What it does

1. **The tech's door.**
   - `messages_tech_team()` names the field roles that text a customer from Job Mode: `primary` and `helpers`. A subcontractor stays out until R8 · 12. Its client copy is `MESSAGES_TECH_TEAM` in `src/lib/gc/access.ts`, and `access.test.ts` fails when the two lists differ.
   - `messages_tech_can_read(contact)` asks whether the signed-in tech may read a thread. The thread must belong to a customer, a lead or a sub. The tech must be dispatched to one of its Pipeline jobs (`job_schedule_blocks.assignee_user_id`), or clocked on one (`clock_sessions.user_id`, not revoked), this week or last. That runs Monday to Sunday in Chicago.
   - Its jobs are the Pipeline jobs tied to the contact in `contact_jobs`, plus its customer's own `jobs_ledger` rows. A person at a customer counts through that customer. Lead and sub are R0's kinds, and they join when R0 lands.
2. **Two SELECT policies.**
   - `contacts_tech_read` lets a tech read those contacts.
   - `messages_tech_read` lets a tech read those lines, except a line marked office only.
   - Each asks the team once per statement before the per-row check, so the office's reads never run it. A trade partner's or an architect's thread is never a tech's.
   - A tech writes nothing here. A text from Job Mode goes through `quo-send` as the service role.
   - Billing is not a column on `messages`. Its rows are calls, texts, emails, notes and events. The money lines come from other tables with the office's own reads, and Job Mode's thread leaves them out by its kernel's rule.
3. **`messages.office_only`** marks a team note only the office reads. It defaults to false, and a check holds it to team lines.
   - It has one writer to come: R5's screens add the tick to the job window and the thread. Until then every note is false, and the bed sets the column by hand.
4. **`contacts.has_until`** is when the rule's hold on a reply ends: the tech who texted has it until then, then the office (`hasRule.ts`, #5561).
   - A check allows an end only while someone has the reply. It has an UPDATE column grant beside cut 2's `has_*` grants.
   - `contacts_has_how_known` is left as it is. A reply under a legal line is routed with `has_how = 'rule'`, and `legal` lives in the kernel's reason.
5. **`app_settings`** gains two rows, seeded if absent, each changed by the owner or a dev through its own UPDATE policy. That is `is_master_or_dev()`, as the Quo seats and the seats beside them on Settings → Phone and texts are.
   - `messages_office_wait_minutes` is 15, in `value_num`.
   - `messages_office_hours_v1` is `{"days":[1,2,3,4,5],"opens":"07:30","closes":"17:00","techUntil":"17:00","emergency":null}`, in `value_text`.
6. **`notification_history.message_id`** is the line a push was for, nullable, with a partial index. `messages-notify` reads it so no line is pushed twice. There is no foreign key: the history outlives a line.

## Checked before the push

The SQL bed `messages-spine` (`npm run test:pg:messages-spine`) runs every migration on Supabase Postgres 17. It runs this one a second time right after its first, which must change nothing. Then it runs the spine's scenario and this one's, `supabase/tests/messages_spine/30_tech_door.sql`. Docker does not run on the office Mac, so it runs in the SQL beds workflow once the PR is ready.

- A primary and a helper are on the tech team, and a superintendent is not.
- **Luis** is dispatched to Dana's job today. He reads Dana, Mark at her household and the rentals tied to the job, with every line but the office-only note. He does not read Kevin or the trade partner on the same job. He renames no contact and writes no line.
- **Hector** clocked on the job last week, and reads the same.
- **Off the job, nothing:**
  - Paul, dispatched three weeks ago, reads nothing.
  - Kim reads Kevin alone, since a revoked clock-in on Dana's job opens nothing.
  - Sal, a superintendent on the job, reads nothing.
- **Rosa** (the office) reads every thread and the office-only note.
- **The settings:**
  - The wait starts at 15 and the hours as above.
  - The master sets the hours and a dev sets the wait.
  - The controller and a tech set neither, and what was set stands.
- **The new columns:**
  - A hold with no one holding it is refused. Office only on a text is refused, and a note is not office only unless it says so.
  - A push row names its line.
- As shipped, anon runs neither function, and a signed-in user runs both.

## Verify after the push

```sql
-- 1. The columns, read only.
SELECT table_name, column_name, data_type, column_default FROM information_schema.columns
WHERE (table_name = 'contacts' AND column_name = 'has_until')
   OR (table_name = 'messages' AND column_name = 'office_only')
   OR (table_name = 'notification_history' AND column_name = 'message_id')
ORDER BY table_name;
-- 2. The two functions and the four policies.
SELECT proname, prosecdef FROM pg_proc WHERE proname IN ('messages_tech_team', 'messages_tech_can_read');
SELECT tablename, policyname, cmd FROM pg_policies
WHERE policyname IN ('contacts_tech_read', 'messages_tech_read', 'master_or_dev_update_messages_office_wait', 'master_or_dev_update_messages_office_hours')
ORDER BY tablename, policyname;
-- 3. The two settings as seeded.
SELECT key, value_num, value_text FROM public.app_settings WHERE key IN ('messages_office_wait_minutes', 'messages_office_hours_v1');
-- 4. The checks and the index.
SELECT conname, convalidated FROM pg_constraint WHERE conname IN ('contacts_has_until_held', 'messages_office_only_team');
SELECT indexname FROM pg_indexes WHERE indexname = 'notification_history_message_id';
-- 5. Nobody signed out runs the door.
SELECT has_function_privilege('anon', 'public.messages_tech_can_read(uuid)', 'EXECUTE');  -- false
```

## Rollback

Nothing reads these yet, so a rollback drops what it added: the two policies on contacts and messages, the two functions, the two settings' policies and rows, the two checks, and the three columns (`contacts.has_until`, `messages.office_only`, `notification_history.message_id` with its index).
