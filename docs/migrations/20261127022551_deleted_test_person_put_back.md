# 20261127022551_deleted_test_person_put_back.sql (2026-11-26, v2.8677)

A deleted test person can be put back. Punch list #443, row 12, one of the take-backs that need a migration, on the owner's answer of 2026-11-25 (*All eight*), each push on its own yes.

## Why

`delete_fresh_person` ([`20261109110000_delete_fresh_person`](./20261109110000_delete_fresh_person.md), replaced by `20261109140000_delete_fresh_person_stints.sql`) deletes a person made by mistake: the pay row and the workday template the Hire form wrote, the People record, and the users row. Deleted records kept a copy of two of the four. `people` carries the archive trigger since `20260717210000` and `people_pay_config` since `20260716230000`. `users` and `salary_work_schedule_templates` carry none.

A People record may not stand without its users row (`people_needs_users_row`, `20261104230000`). So the copy that was kept could never go back: **Preview restore** on the person's line in Recently deleted answered with that trigger's own refusal, *A person is a users row: add them with add_worker…*. The card read this from the trigger. The bed below runs it.

## What it makes

Two functions, both `plpgsql`, `SECURITY DEFINER`, `search_path = public`, revoked from `PUBLIC` and `anon`, granted to `authenticated`, each with a comment. One is replaced in place and one is new. No table is created, so the four closing calls do not apply. No table, column, policy, grant on a table, trigger or row is made or changed.

### `delete_fresh_person(p_user_id uuid, p_dry_run boolean) → jsonb`, replaced

The body is the one `20261109140000` shipped, with the same callers, the same refusals, the same scan of every foreign key into `users(id)` and `people(id)` and the same deletes in the same order. Two things are new.

- **The test.** The person is a test person when `users.name` or `users.card_name` starts with ZZ, in any case, after trimming spaces, tabs and line ends. That is `isZzTestPerson` (`src/lib/brandKit/team.ts`), written in SQL.
- **The copy.** For a test person, after the scan finds no hold and before anything is deleted, the function inserts into `deleted_records_archive` one row for the users row (`table_name` `users`, `record_id` the user's id) and one for the workday template when there is one (`table_name` `salary_work_schedule_templates`, no `record_id`, since the table has no `id`). Both go under `group_key` = the People record's id, the handle Recently deleted lists a person by, with `deleted_by` the caller. A users row with no People record is kept under its own id. The insert is not guarded: for a test person the copy is the point, so a copy that cannot be written stops the delete and says why.

The answer gains one key, `copy_kept`, a boolean, on a dry run too. A person whose name does not start with ZZ is deleted exactly as before, the answer says `copy_kept: false`, and no copy of the users row is written anywhere.

### `restore_deleted_test_person(p_group_key text, p_dry_run boolean) → jsonb`, new

It also sets `row_security = off`. That changes nothing today, since the function is owned by the owner of every table it writes. It is set so that a function that ever ran as a role row security binds would raise and not skip rows without a word.

It answers in the envelope `restore_deleted_records` answers, `{ ok, code, error, dry_run, group_key, inserted, total, warnings, blockers }`, with `name` beside it, so Recently deleted draws it as it draws every other restore. A refusal is an answer with `ok: false`, never a raised error. In this order:

| The case | `code` | The words |
|---|---|---|
| Nobody is signed in | `not_authenticated` | *Not authenticated.* |
| The caller is not a developer (`is_dev()`) | `forbidden` | *Only devs can restore deleted records.* |
| The key is blank | `not_found` | *Say which person.* |
| The bundle holds no copy of a users row that has not gone back | `not_found` | *No copy of this person’s account row was kept, so the person cannot be put back.* |
| Neither the name nor the card name on the copy starts with ZZ | `not_test` | *Only a test person can be put back. This person’s name does not start with ZZ.* |
| The copy holds no id | `blocked` | *The copy of the account row has no id. Nothing was put back.* |
| A users row with that id stands | `blocked` | *NAME is on the roster already. Nothing was put back.* |
| Another users row holds the copy's email | `blocked` | *Another person has this person’s email now. Change that email first.* |
| A People record with the copy's id stands | `blocked` | *NAME has a People record already. Nothing was put back.* |
| A pay row stands under the kept pay row's name | `blocked` | *A pay row stands under this person’s name now. Rename or delete that person first.* |
| Anything the inserts raise | the SQLSTATE | the database's own message |

Each `blocked` answer carries the same sentence, shortened, in `blockers`.

It reads the newest copy of the users row under the key that has not gone back, `FOR UPDATE`, so a second press at the same moment waits and then finds it gone back. Then it reads the copy of the People record under the same key that names that users row, the copy of the pay row whose `person_id` is that record (the pay row's own trigger keeps it under the person's name, not under the record's id), and the copy of the workday template under the key. A workday that named a job or a bid which is gone keeps its hours and loses that name, with a warning for each.

Then, in one transaction, it inserts the users row, the People record, the pay row and the template, in that order, naming each table's own columns that are not generated and that the copy holds, marks the copies `restored_at` and `restored_by`, and answers the count for each table. `p_dry_run` does all of it and rolls it back, so a preview's counts are true.

### What it does not copy

The person's employment stint is not copied and does not need to be. `people_stints_follow_dates` (`20261103203000`) writes it again from the record's own dates when the People record is inserted.

## Why a function and not a trigger

A trigger on `users` would copy every users row any path deletes. It would take a lock on the table every signed-in read touches. And it could not put the copy under the People record's id, which is the handle Recently deleted lists a person by. The function already holds the row, the record's id and the caller, and it is the only door that deletes a users row with no login.

## What it leaves on prod

Two `pg_proc` rows: one replaced, one new. No table is locked, by the push or by a call. `SET lock_timeout = '3s'` opens the file. Every statement is `CREATE OR REPLACE`, `COMMENT`, `REVOKE` or `GRANT`, so the file is safe to run twice.

A call writes rows only where the tables already take them: `deleted_records_archive` on a test person's delete, and `users`, `people`, `people_pay_config` and `salary_work_schedule_templates` on a put-back.

## Triggers that fire on a put-back

Read in the migrations, not on a database:

- **`people`**: `people_needs_users_row` passes, since the users row goes in first. `people_stints_follow_dates` writes the stint. The phone trigger of `20261015030000` gives a record with no phone its account's phone. So a record whose phone was cleared by hand, on an account that has one, would come back with the account's phone.
- **`people_pay_config`**: `people_pay_config_log_change` ([`20261126033215_pay_config_log_screen_changes`](./20261126033215_pay_config_log_screen_changes.md)) fires after insert, deferred to the end of the transaction. When the pay row that goes back carries a wage, an office wage or Salaried, it writes **one line on the pay log** (`pay_admin_events`, action `set_pay_config`, `by: screen`, the reason *Changed on a screen. No reason was asked.*, the dev as the writer, no row before). A pay row with no pay writes none. A preview writes none, since its inserts are rolled back before the transaction ends. The delete writes none, since the trigger does not fire on a delete. The week lock of `20261123082812` passes for a dev.
- **Every table written** carries the statement trigger `read_only_block_stmt`. A developer in training mode is refused by it, and the answer carries its words with its SQLSTATE as the `code`.
- The `updated_at` triggers of `users` and `people` fire before an update, not an insert, so each row goes back with the stamp it held. The bed leaves `updated_at` out of its comparison all the same.

## Order

The client calls `restore_deleted_test_person` by name, and only this migration creates it. So `npm run check:calls-ahead` labels the PR *push right after the merge*, and `deploy.yml` holds the client until the push. Push with `bash scripts/db-push.sh` from a checkout of main right after the merge. The push is asked for by name and waits on its own yes.

Until the push the client is safe in both directions. The delete's confirm reads `copy_kept` and takes an answer without it as no copy, so it says *for good*, which is true of the old function. No bundle holds a users copy yet, so no bundle is sent to the new name.

No types PR is owed for the client: it calls the function as an untyped RPC, as the other take-backs call theirs. The generated types gain it on the next `chore(types)` PR.

## How to verify after the push

1. `select proname, pg_get_function_identity_arguments(oid) from pg_proc where proname in ('delete_fresh_person', 'restore_deleted_test_person');` answers two rows.
2. `select obj_description('public.restore_deleted_test_person(text, boolean)'::regprocedure);` answers the comment that starts *Punch list #443, row 12*.
3. Through the dev seat, `find_rpc` names `restore_deleted_test_person`.
4. The walk below.

## How to roll back

Apply the `CREATE OR REPLACE FUNCTION public.delete_fresh_person` statement of `20261109140000_delete_fresh_person_stints.sql` again, with its comment, then `DROP FUNCTION IF EXISTS public.restore_deleted_test_person(text, boolean);`. Both in a new migration, pushed the usual way. The copies already written stay in `deleted_records_archive` until its purge takes them, and nothing reads them once the function is gone. A client still on this version would then send a test person's bundle to a missing name, so revert the client first.

## Known and not covered

- **A real person deleted by mistake still cannot be put back.** Copies are kept for ZZ-named people alone. For everyone else the delete is as it was, and its confirm still says *for good*.
- **A person deleted before this migration has no users copy.** Their line in Recently deleted keeps the old function and its refusal. The one made-up test person the walk of 2026-11-25 deleted is one of these.
- **The 90-day purge takes the copies.** `purge-deleted-records-archive` (`20260716120000`) deletes archive rows older than 90 days, every day at 09:00 UTC, a gone-back copy or not. After that the person cannot be put back.
- **The put-back leaves a line on the pay log** when the pay row carries pay, as above. The line says the row was changed on a screen. It is true that a row was written, and the line does not say it was a put-back.
- **The pay row has a line of its own in Recently deleted**, under the person's name, since its trigger groups it by `person_name`. The put-back takes it from there, and that line then leaves the list. **Preview restore** pressed on that line, not on the person's, goes through the old function and would return the pay row alone, with its tie to the person cleared.
- **A users row with no People record** is copied under its own id. Recently deleted then lists it by its table and not as a person, so the client sends it to the old function. `add_worker` makes both rows together, so no such person is expected.
- **A name taken since** is not checked in words. If another People record or users row breaks a unique rule on the insert, the answer is `ok: false` with the database's own message, and nothing is put back.
- **A column added since the copy was taken takes its default.** The insert names the table's columns that the copy holds, and no other. A column added after the delete is not in the copy, so it is left out and the table's default fills it. The first draft named every column, and on the stand-in a `NOT NULL DEFAULT false` column added to `users` after a delete turned a good preview into `23502`. That is why the copy's own keys pick the columns. A `NOT NULL` column added with no default still refuses the put-back: the answer is `ok: false` with the database's message and nothing is put back. `restore_deleted_records` names every column and has the older limit. With the rule in, the scenario ran again on the stand-in and all 65 assertions passed. The case of a column added after the delete was not run again.
- **A login is not restored.** The function deletes only a person with no login, so there is none to restore.

## Test

`npm run test:pg:deleted-test-person-put-back` applies this migration a second time after every migration, which must change nothing, and plays `supabase/tests/deleted_test_person_put_back/20_scenario.sql` in one transaction that rolls back. Fixtures are made as postgres, and every call under test runs as the signed-in person:

- A dev deletes a ZZ-named person made with `add_worker`, with a start date, a pay row and a workday template. The dry run and the delete both answer `copy_kept: true`, with the eight keys of the answer. Deleted records then holds the users row and the template beside the People record under the record's id, and the pay row under the person's name. `list_deleted_records` lists the person as kind `person` with `users` among its tables, which is the fact the client's rule reads.
- An assistant is refused the preview and the put-back and is listed nothing. With nobody signed in the function says so, and as `anon` both functions are refused at the door. A blank key, no key and a key nobody holds are each refused.
- The preview answers the four counts and leaves nothing behind: no row, no copy marked, no line on the pay log.
- The put-back answers the four counts. The four rows stand again and each equals its copy, compared whole as `jsonb` with `updated_at` left out on both sides. The employment stint is back from the record's start date. The four copies are marked, by the dev. The person is listed no more. One line is on the pay log. A second call finds no copy and changes nothing.
- The person is deleted and put back a second time.
- A person whose name does not start with ZZ: the answer carries the same eight keys with `copy_kept: false`, Deleted records holds the People record and the pay row and no users row, the new function says no copy was kept, and the old function refuses with `people_needs_users_row`'s words.
- A person on the roster already, an email another person holds, a pay row under the name and a People record that stands are each refused in their own sentence, with the blocker, and nothing goes back. Two copies written by hand show the two refusals no delete can stage: a name that does not start with ZZ, and a copy with no id.
- A person is a test person by the card's name alone, in lower case with spaces before it. A workday whose kept copy names a job and a bid that are not there comes back without them, with a warning for each.

**The whole-schema bed is unrun.** Docker does not answer on the Mac that built this, so the SQL beds job on the PR is the first run of the bed against the real schema. What did run there, on a local PostgreSQL 15: the stand-in schema of the `users-without-login` bed with that bed's eight migrations, stand-in tables for the pay row, the workday template, the archive and the pay log, the repo's own `archive_deleted_record` body, the repo's own stint table and trigger, the repo's own pay-log trigger migration and the repo's own `list_deleted_records` and `restore_deleted_records`. Then this migration twice, with both functions' definitions and grants the same after the second run, and this scenario file as written. All 65 assertions passed. That shows the SQL parses, the rules hold and the functions agree with the repo's own triggers that were loaded. It does not show that the real `users`, `people` and `people_pay_config` tables, with every column, constraint, trigger and policy they carry on prod, take the rows back, which is the bed's job. It does not show the read-only statement trigger, which the stand-in does not hold.

## The walk, for the walker

Each write below is a write on prod and waits on its own yes. Not pressed yet.

1. As the dev: People → Users, hire a made-up person named *ZZ Test Putback*, with no invite, a wage and a start date.
2. Open their desk and press **Delete…**. The confirm reads *This is a test person, so a copy is kept for 90 days. A developer can put them back from Recently deleted.* It does not say *for good*. Press **Delete ZZ Test Putback**.
3. Settings → Data & recovery → **Recently deleted (dev)**. The person's line reads *ZZ Test Putback (Person)*, with the chips *account row* and *person*.
4. Press **Preview restore**. The preview lists `users: 1`, `people: 1` and `people_pay_config: 1`, and `salary_work_schedule_templates: 1` when there was one. The person is not on the roster yet.
5. Press **Restore**. The toast reads *Restored 3 rows.*, or 4 when a workday template went with them. The line leaves the list, and so does the pay row's own line.
6. People → Users: the person is back, with their wage and their start date. Read the pay log for the name through the dev seat: one new line, by `screen`.
7. Delete the person again, and leave them deleted or put them back as the walk needs. Tell `fixing` what was made and what stands.
8. On a real person's desk with no login, press **Delete…** and read the confirm: it still says *for good*. Press **Cancel**.
