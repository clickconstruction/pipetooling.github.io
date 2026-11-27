# 20261127075633_case_items_direct_grants_revoked.sql (2026-11-27, v2.8727)

The direct grants on a case's items are revoked, and so are the ones nothing uses on the correction links. Punch list #315, the audit's leak, on the answer of 2026-11-25 recorded in the card's audit section: *Fix all of them; the leak closed by revoking the direct grants.* The yes covers the build. The push waits on its own.

## Why

`person_case_items` ([`20261113080000`](./20261113080000_person_file_numbers.md)) granted INSERT and UPDATE to every signed-in user and left the refusal to its row policies, which pass a dev alone. A BEFORE INSERT trigger runs before the row policy is asked, and the table's guard looks the number up first. A number that stands was refused with *item N already stands on this file*. A number that does not stand went on to the policy, which refused in its own words. Two refusals for one question: an insert that named a person and a number, sent by anyone signed in, answered whether that item exists. The insert never landed, and nothing else was told.

`person_file_amendments` ([`20261112050000`](./20261112050000_person_file_amendments.md)) has a guard of the same kind. Its migration granted SELECT, INSERT and UPDATE to the signed-in role and never took away what a new table in the schema is given by default. So `anon` and the signed-in role each held every privilege on it, and the question could be put with no sign-in. The guard says *is not on any file*, *both ends of a link belong to the one person's file* or *that link already stands* before the policy answers. The ids are random ones a caller would have to hold already, so this is a smaller leak than *Item 7*.

## What it does

Three `REVOKE`s on two tables, one more that says again what already holds, and one table's comment.

| Table | Role | Taken away | Left |
|---|---|---|---|
| `person_case_items` | `authenticated` | INSERT, UPDATE | SELECT, under its dev-only policy |
| `person_case_items` | `anon` | everything (it held nothing: said again) | nothing |
| `person_file_amendments` | `anon` | everything | nothing |
| `person_file_amendments` | `authenticated` | DELETE, TRUNCATE, REFERENCES, TRIGGER | SELECT, INSERT, UPDATE |

With no privilege the database refuses the statement before any trigger runs, in the same words whatever it names: `42501 permission denied for table …`.

## What is still open

**INSERT and UPDATE on `person_file_amendments` for the signed-in role.** The HR tab adds a link and takes one off by writing the table as the signed-in dev (`src/lib/people/personAmendmentsIo.ts`), so those two cannot be revoked until the tab writes another way. A signed-in user who is not a dev can still put the guard's question to this table. Two ways close it, and the pick is the person's, asked on 2026-11-27:

- **The door.** Move the tab's two writes behind `dev_hr_entry_write`, the dev-gated function the dev seat already uses, which carries a link (`amendments[]`) and a withdrawal (`withdraw_amendments[]`). Then revoke INSERT and UPDATE in a later migration, pushed once that client is live.
- **The guard asks first.** Make `person_file_amendments_guard` tell a dev, the two doors and the HR agent's key from everyone else before it answers anything. One migration, no client change, and the grants stay.

## What nothing loses

- The HR tab, the dev seat (`plan_case` and `apply_case`) and every other writer of the case items go through `dev_case_write`. It is a definer's function owned by the table's owner, checks for a dev itself, and needs no privilege of the caller on the table.
- No screen, edge function or other database function writes `person_case_items` directly. The guard, the counter and the door alone name it, and the bed asserts that on the whole schema.
- `hr_agent` and `cost_agent` never held a privilege on the case items. On the links `hr_agent` keeps its SELECT and INSERT.
- No screen reads or writes the links signed out, and no policy on them names `anon`. No DELETE policy exists on the links: a link is withdrawn, never deleted.
- The two INSERT and UPDATE policies on the case items stay. With the privilege gone nothing reaches them. They are kept so that a grant given back by mistake still passes a dev alone.
- `person_case_log` keeps its INSERT. It has no guard that answers before its policy, so a refused insert there tells nothing.

## What the push leaves on prod

Fewer privileges on two tables for two roles, and one table's comment. No table, column, row, policy, trigger or function is made, changed or dropped. A `REVOKE` rewrites the table's privilege list in the catalog and holds no lock a reader or writer of the table waits on. `SET lock_timeout = '3s'` opens the file. No table is created, so the four closing calls do not apply. Safe to run twice.

## Order

The client calls nothing this migration creates and writes neither table in a way it takes away. Any order of the merge and the push is safe, and an old client loses nothing. No deploy and no types PR is owed: a privilege changes no generated type.

## Read before the push

Read-only. The file leans on what run 7's thread read on prod on 2026-11-27, which the PR's own thread could not read again:

```sql
SELECT table_name, grantee, string_agg(privilege_type, ', ' ORDER BY privilege_type)
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name IN ('person_case_items', 'person_file_amendments')
  AND grantee IN ('anon', 'authenticated', 'hr_agent', 'cost_agent')
GROUP BY 1, 2 ORDER BY 1, 2;
```

Expected before: `authenticated` holds INSERT, SELECT, UPDATE on the case items and every privilege on the links; `anon` holds nothing on the case items and every privilege on the links; `hr_agent` holds INSERT, SELECT on the links.

## Verify after the push

The same statement. Expected after: `authenticated` holds SELECT on the case items and INSERT, SELECT, UPDATE on the links; `anon` has no row; `hr_agent` as before. `check_migration_ledger` reads this version as applied. Then, through the dev seat on the test person only, a `plan_case` dry run still answers, which shows the door needs no privilege of its caller.

## Roll back

A new migration that grants back what was taken: `GRANT INSERT, UPDATE ON public.person_case_items TO authenticated;` and, for the links, `GRANT ALL … TO anon` and the four privileges to `authenticated`. Nothing else was changed, so nothing else is put back. The leak comes back with it.

## Test

Two beds, both on the whole schema, both in one transaction that rolls back, with made-up people and words.

`npm run test:pg:person-file-numbers` applies the numbers' migration a second time and then this file again, since the first grants what this one takes. Its new cases:

- The signed-in role holds SELECT on the items and none of INSERT, UPDATE, DELETE, TRUNCATE. `anon` holds nothing.
- An estimator's insert is refused with `42501 permission denied for table person_case_items` when it names a number that stands, a number that does not and no number. An update is refused the same way. The estimator reads no item, and no counter moved.
- A dev's own insert at the table is refused the same way. A dev still reads the file's items, and the door still adds an item the database numbers.
- For the table's owner the guard still refuses a number that stands. The two agent roles hold nothing. The guard, the counter and the door are the only functions that name the table. The HR agent's key may still call `hr_agent_write` and a signed-in user may not, and the function still appends an entry with no user behind it.

`npm run test:pg:person-file-amendments` applies the links' migration a second time and then this file. Its new cases:

- `anon` holds nothing on the links. The signed-in role holds SELECT, INSERT and UPDATE and none of DELETE, TRUNCATE, REFERENCES, TRIGGER. The HR agent's key reads and adds as before.
- With no sign-in, four inserts are refused with `42501 permission denied for table person_file_amendments`: one that names a standing link, one the guard would pass, one that names a thing on no file and one that names a thing on another person's file. A read, an update and a delete are refused the same way, and no link changed.
- Every older case of the bed passes unchanged, the tab's direct insert as a dev among them.

Both scripts ran whole on 2026-11-27 on a local Docker, on the Supabase image with every migration applied, and both passed: 57 assertions and 43.

- **The first whole run of the numbers bed failed, on a case of the bed and not of the migration.** Its scenario switched to the `hr_agent` role to call the agent's door, and the real image refuses that switch to the bed's owner (`permission denied to set role "hr_agent"`), which the stand-in schema it was written on had allowed. Granting the owner the right to wear the role ended the server on that image. The case now reads the role's right to call the door as a privilege and calls the door with no user behind it.
- **Before and after, played on the same bed.** The four inserts were sent with no sign-in as the file leaves things, and each answered `42501 permission denied for table person_file_amendments`. With `anon`'s privileges given back inside a transaction that rolled back, the same four answered four ways: `23505 … that link already stands`, `23503 … is not on any file`, `23514 … both ends of a link belong to the one person's file`, and the row policy's `42501`. That is the leak the file closes.
- **What stays open, shown the same way.** A signed-in estimator's four inserts still answer those four ways after the file. That is the half under *What is still open*.
