# 20261127163949_links_direct_grants_revoked.sql (2026-11-27, v2.8739)

INSERT and UPDATE on the correction links are revoked from the signed-in role. Punch list #315, the audit's leak, the last of three steps, on the person's pick of 2026-11-27: *A, the door*. The pick covers the build. The push waits on its own yes, **and on v2.8730's client being live** (see *Order*).

## Why

`person_file_amendments` ([`20261112050000`](./20261112050000_person_file_amendments.md)) has a guard, a BEFORE trigger, that answers before the row policy: *is not on any file*, *both ends of a link belong to the one person's file*, *that link already stands*, and the policy's words for the rest. An insert that named two ids, sent by anyone signed in, learned where each stood. The insert never landed, and the ids are random ones a caller would have to hold already.

[`20261127075633`](./20261127075633_case_items_direct_grants_revoked.md) (v2.8727) took everything of `anon` off the table. It left the signed-in role's INSERT and UPDATE, because the People → HR tab used both. v2.8730 moved the tab's two writes behind `dev_hr_entry_write` ([`docs/recent-features/v2.8730.md`](../recent-features/v2.8730.md)). This file takes the two privileges.

## What it does

| Table | Role | Taken away | Left |
|---|---|---|---|
| `person_file_amendments` | `authenticated` | INSERT, UPDATE | SELECT, under its dev-only policy and the seat's counsel-only fence |

And the table's comment, which now says how it is written. With no privilege the database refuses the statement before any trigger runs: `42501 permission denied for table person_file_amendments`, whatever it names.

## What nothing loses

- `hr_agent_write` is the one function that inserts into or updates the table, and the bed asserts that on the whole schema. It is a definer's function owned by the table's owner, so it needs no privilege of its caller.
- Both doors reach it. `dev_hr_entry_write` checks for a dev itself; the tab and the dev seat (`plan_hr_entry`, `apply_hr_entry`) call it. The HR agent's key calls `hr_agent_write` directly.
- No screen, edge function or other database function writes the table. The edge functions read it.
- `hr_agent` keeps its SELECT and INSERT.
- The three policies for the signed-in role stay. Nothing reaches the INSERT and UPDATE ones now. They are kept so that a grant given back by mistake still passes a dev alone.

## What the push leaves on prod

Two privileges fewer on one table for one role, and the table's comment. No table, column, row, policy, trigger or function is made, changed or dropped. A `REVOKE` rewrites the table's privilege list in the catalog and holds no lock a reader or writer of the table waits on. `SET lock_timeout = '3s'` opens the file. No table is created, so the four closing calls do not apply. Safe to run twice.

## Order

**The client first, then this push.** v2.8730 must be the client being served before the file is pushed. A tab still open on an older client writes the links table itself. After the push its link would be refused with *permission denied* until the tab reloads. The entry it wrote first would stand, unlinked, and the tab says so in its toast. The HR tab is a dev's alone, so the people this can reach are the devs.

`20261127075633` goes first in the ledger and may be pushed any time: it has no such order. No deploy and no types PR is owed: a privilege changes no generated type.

## Read before the push

Read-only:

```sql
SELECT grantee, string_agg(privilege_type, ', ' ORDER BY privilege_type)
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'person_file_amendments'
  AND grantee IN ('anon', 'authenticated', 'hr_agent')
GROUP BY 1 ORDER BY 1;
```

Expected before, with `20261127075633` pushed: `authenticated` holds INSERT, SELECT, UPDATE; `anon` has no row; `hr_agent` holds INSERT, SELECT. And read that the live site serves v2.8730 or newer.

## Verify after the push

The same statement. Expected after: `authenticated` holds SELECT alone; the rest as before. `check_migration_ledger` reads this version as applied. Then, through the dev seat on the test person only, a `plan_hr_entry` dry run that names a link still answers, which shows the door needs no privilege of its caller.

With a write, on its own yes: on the test person's file on People → HR, add an entry that corrects another, then take the link off with a reason. Both go through the door.

## Roll back

A new migration: `GRANT INSERT, UPDATE ON public.person_file_amendments TO authenticated;`. Nothing else was changed. The leak comes back with it.

## Test

`npm run test:pg:person-file-amendments`, on the whole schema, in one transaction that rolls back, with made-up people and words. Its script applies the links' migration a second time and then both revoking files, since the first grants what they take. Where the scenario wrote the table as a dev it writes through the door, as the tab does since v2.8730.

- `anon` holds nothing on the links. The signed-in role holds SELECT and none of the other six. The HR agent's key reads and adds as before. `hr_agent_write` is the only function that inserts into or updates the table.
- An estimator's insert is refused with `42501 permission denied for table person_file_amendments` for a pair the guard would pass, a standing link, a thing on no file and a thing on another person's file. An update is refused the same way, and the door refuses an estimator with *devs only*.
- A dev's own insert and update at the table are refused the same way. For the table's owner the guard still refuses a reworded link and a changed stamp.
- Every case of the door passes as before: a link planned and written, each refusal of the guard, a withdrawal, the pair linked again the other way, the seat and a counsel-only record.

The script ran whole on 2026-11-27 on a local Docker, on the Supabase image with every migration applied, and passed: 50 assertions. `npm run test:pg:person-file-numbers` passed beside it, 57.

- **Before and after, played on the same bed.** With INSERT and UPDATE given back inside a transaction that rolled back, a signed-in estimator's four inserts answered four ways: `23505 … that link already stands`, `23503 … is not on any file`, `23514 … both ends of a link belong to the one person's file`, and the row policy's `42501`. As the file leaves things all four answer `42501 permission denied for table person_file_amendments`. That is the leak the file closes.
- **v2.8730's two calls, played on the same bed with the grants gone.** As a dev, the payload the tab sends for a link landed one row, made by the dev. The payload it sends for a withdrawal stamped that row with its reason. Sent again it answered `hr_agent_write: no live link …`, the one refusal the tab reads as done.
- **The bed's own privilege list after both files:** `authenticated` SELECT; `hr_agent` INSERT, SELECT; no row for `anon`.
