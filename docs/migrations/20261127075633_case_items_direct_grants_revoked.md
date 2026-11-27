# 20261127075633_case_items_direct_grants_revoked.sql (2026-11-27, v2.8727)

The direct grants on a case's items and on the correction links are revoked. Punch list #315, the audit's leak, on the answer of 2026-11-25 recorded in the card's audit section: *Fix all of them; the leak closed by revoking the direct grants.* For the links, the pick of 2026-11-27 between two ways: *A, the door*. Each answer covers the build. The push waits on its own, **and on v2.8730's client being live** (see *Order*).

## Why

`person_case_items` ([`20261113080000`](./20261113080000_person_file_numbers.md)) granted INSERT and UPDATE to every signed-in user and left the refusal to its row policies, which pass a dev alone. A BEFORE INSERT trigger runs before the row policy is asked, and the table's guard looks the number up first. A number that stands was refused with *item N already stands on this file*. A number that does not stand went on to the policy, which refused in its own words. Two refusals for one question: an insert that named a person and a number, sent by anyone signed in, answered whether that item exists. The insert never landed, and nothing else was told.

`person_file_amendments` ([`20261112050000`](./20261112050000_person_file_amendments.md)) has a guard of the same kind. Its migration granted SELECT, INSERT and UPDATE to the signed-in role and never took away what a new table in the schema is given by default. So `anon` and the signed-in role each held every privilege on it, and the question could be put with no sign-in. The guard says *is not on any file*, *both ends of a link belong to the one person's file* or *that link already stands* before the policy answers. The ids are random ones a caller would have to hold already, so this is a smaller leak than *Item 7*.

## What it does

Three `REVOKE`s on two tables, one more that says again what already holds, and the two tables' comments.

| Table | Role | Taken away | Left |
|---|---|---|---|
| `person_case_items` | `authenticated` | INSERT, UPDATE | SELECT, under its dev-only policy |
| `person_case_items` | `anon` | everything (it held nothing: said again) | nothing |
| `person_file_amendments` | `anon` | everything | nothing |
| `person_file_amendments` | `authenticated` | INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER | SELECT, under its dev-only policy |

With no privilege the database refuses the statement before any trigger runs, in the same words whatever it names: `42501 permission denied for table …`.

## The pick for the links

The HR tab used to add a link and take one off by writing the table as the signed-in dev, so INSERT and UPDATE could not be revoked while it did. Two ways were put to the person on 2026-11-27: move the tab's two writes behind `dev_hr_entry_write` and then revoke, or leave the grants and make the guard ask who is calling first. The pick was **A, the door**. v2.8730 moved the tab's writes ([`docs/recent-features/v2.8730.md`](../recent-features/v2.8730.md)), and this file revokes.

## What nothing loses

- The HR tab, the dev seat (`plan_case` and `apply_case`) and every other writer of the case items go through `dev_case_write`. It is a definer's function owned by the table's owner, checks for a dev itself, and needs no privilege of the caller on the table.
- No screen, edge function or other database function writes `person_case_items` directly. The guard, the counter and the door alone name it, and the bed asserts that on the whole schema.
- Since v2.8730 the HR tab writes a link and a withdrawal through `dev_hr_entry_write`, a dev-gated definer's function that hands them to `hr_agent_write`. `hr_agent_write` is the one function that writes the links, as its owner, and the bed asserts that on the whole schema.
- `hr_agent` and `cost_agent` never held a privilege on the case items. On the links `hr_agent` keeps its SELECT and INSERT.
- No screen reads or writes the links signed out, and no policy on them names `anon`. No DELETE policy exists on the links: a link is withdrawn, never deleted.
- The INSERT and UPDATE policies on both tables stay. With the privilege gone nothing reaches them. They are kept so that a grant given back by mistake still passes a dev alone.
- `person_case_log` keeps its INSERT. It has no guard that answers before its policy, so a refused insert there tells nothing.

## What the push leaves on prod

Fewer privileges on two tables for two roles, and the two tables' comments. No table, column, row, policy, trigger or function is made, changed or dropped. A `REVOKE` rewrites the table's privilege list in the catalog and holds no lock a reader or writer of the table waits on. `SET lock_timeout = '3s'` opens the file. No table is created, so the four closing calls do not apply. Safe to run twice.

## Order

**The client first, then this push.** v2.8730 must be the client being served before the file is pushed. A tab still open on an older client writes the links table itself. After the push its link would be refused with *permission denied* until the tab reloads; the entry it wrote first would stand, unlinked, and the tab says so in its toast. The HR tab is a dev's alone, so the people this can reach are the devs.

The case items' half has no such order: no client ever wrote that table directly. No deploy and no types PR is owed: a privilege changes no generated type.

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

The same statement. Expected after: `authenticated` holds SELECT alone on both tables; `anon` has no row; `hr_agent` as before. `check_migration_ledger` reads this version as applied. Then, through the dev seat on the test person only, a `plan_case` dry run and a `plan_hr_entry` dry run that names a link still answer, which shows each door needs no privilege of its caller.

## Roll back

A new migration that grants back what was taken: `GRANT INSERT, UPDATE ON public.person_case_items TO authenticated;` and, for the links, `GRANT ALL … TO anon` and the six privileges to `authenticated`. Nothing else was changed, so nothing else is put back. The leak comes back with it.

## Test

Two beds, both on the whole schema, both in one transaction that rolls back, with made-up people and words.

`npm run test:pg:person-file-numbers` applies the numbers' migration a second time and then this file again, since the first grants what this one takes. Its new cases:

- The signed-in role holds SELECT on the items and none of INSERT, UPDATE, DELETE, TRUNCATE. `anon` holds nothing.
- An estimator's insert is refused with `42501 permission denied for table person_case_items` when it names a number that stands, a number that does not and no number. An update is refused the same way. The estimator reads no item, and no counter moved.
- A dev's own insert at the table is refused the same way. A dev still reads the file's items, and the door still adds an item the database numbers.
- For the table's owner the guard still refuses a number that stands. The two agent roles hold nothing. The guard, the counter and the door are the only functions that name the table. The HR agent's key may still call `hr_agent_write` and a signed-in user may not, and the function still appends an entry with no user behind it.

`npm run test:pg:person-file-amendments` applies the links' migration a second time and then this file, since the first grants what this one takes. Where the scenario wrote the table as a dev it now writes through the door, as the tab does since v2.8730. Its new cases:

- `anon` holds nothing on the links. The signed-in role holds SELECT and none of the other six. The HR agent's key reads and adds as before. `hr_agent_write` is the only function that inserts into or updates the table.
- An estimator's insert is refused with `42501 permission denied for table person_file_amendments` for a pair the guard would pass, a standing link, a thing on no file and a thing on another person's file. An update is refused the same way, and the door refuses an estimator with *devs only*.
- A dev's own insert and update at the table are refused the same way. For the table's owner the guard still refuses a reworded link and a changed stamp.
- With no sign-in the same four inserts, a read, an update and a delete are refused in those words, and no link changed.
- Every case of the door passes as before: a link planned and written, each refusal of the guard, a withdrawal, the pair linked again the other way, the seat and a counsel-only record.

Both scripts ran whole on 2026-11-27 on a local Docker, on the Supabase image with every migration applied, and both passed: 57 assertions and 50.

- **The first whole run of the numbers bed failed, on a case of the bed and not of the migration.** Its scenario switched to the `hr_agent` role to call the agent's door, and the real image refuses that switch to the bed's owner (`permission denied to set role "hr_agent"`), which the stand-in schema it was written on had allowed. Granting the owner the right to wear the role ended the server on that image. The case now reads the role's right to call the door as a privilege and calls the door with no user behind it.
- **Before and after, played on the same bed.** With the privileges given back inside a transaction that rolled back, four inserts answered four ways, for a caller with no sign-in and for a signed-in estimator alike: `23505 … that link already stands`, `23503 … is not on any file`, `23514 … both ends of a link belong to the one person's file`, and the row policy's `42501`. As the file leaves things all four answer `42501 permission denied for table person_file_amendments` for both. That is the leak the file closes.
- **The new client's two calls, played on the same bed with the grants gone.** As a dev, the payload v2.8730 sends for a link landed one row, made by the dev. The payload it sends for a withdrawal stamped that row with its reason. Sent again it answered `hr_agent_write: no live link …`, the one refusal the tab reads as done.
