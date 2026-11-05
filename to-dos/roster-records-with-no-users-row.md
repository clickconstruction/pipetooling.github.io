---
name: Every People record has a users row, and the drafted days have a door
number: 265
group: close
status: shipped 2026-11-04 · PR 1 the count and the combine's refusal v2.6529 · PR 2 `people_needs_users_row` and the key on RESTRICT v2.6530 · PR 3 Import days… on the desk v2.6531 · left: the two records the backfill skipped, which the count on People → Users reads until the owner links them, then the NOT NULL and the roster view as a plain join
summary: >
  The backfill (v2.6517) linked 19 roster records to new users rows and skipped 2 whose name a login already
  carries. people.account_user_id stays nullable and roster_people keeps account_kind 'external' as the guard that
  shows a straggler, but nothing on screen counts them. Surface them with their door, move the combine onto the
  account merge, then make the column NOT NULL and the roster view a plain join. Then the payoff: a dev-only door
  on the desk that imports a person's drafted days with every refusal named.
next: the owner links the two roster records from their rows' Link account; then `people.account_user_id NOT NULL` and the roster view as a plain join, one migration; then delete this card.
size: M
blocker: None for the count and the door; the NOT NULL waits on the two records being linked by hand.
ver: v2.6511 · 6514 · 6517 · 6425
opinion: build — the model is "every person has a users row", and the schema should say so once the stragglers are gone.
mockup: not required — a count line and a door that exist, a dev-only form of three fields
---

# Every People record has a users row, and the drafted days have a door

## The ask

The dev, 2026-11-04, after the users-without-login train shipped: "is there anything else we should do to make it clean and robust and more useful for the future?" — "Yes, make cards" — "do them all here".

## What was true on 2026-11-04

- `backfill_users_for_people()` (v2.6517, `20261104210000`) answered **19 linked, 2 skipped**: two People records whose trimmed name another users row carries, left for the desk because the pay tables key on the name (`resolve_pay_person_id` reads `users.name → people.account_user_id` first). A dev may run it again; it links nothing new until those two are linked or renamed.
- `people.account_user_id` is nullable: `people_account_user_id_fkey` is `ON DELETE SET NULL` (invite-user's replace of a pending invite deletes its users row — v2.6511 made the function delete the row itself) and `combinePeople.ts` nulls a source's account before moving it. `roster_people` keeps `account_kind 'external'` for a record with no users row; `has_login` reads the column.
- The desk's *Merge a duplicate* (`MergeDuplicateDialog.tsx`) lists roster-only subs as externals; `eligibleAbsorbCandidates` already lists no-login users rows, and `merge_user_accounts` moves the roster link, so a no-login person merges through the account merge today.
- The End employment flow sat on *Saving…* for over thirty seconds on the walk's `ZZ Test` person with no error; the account was archived by calling `archive-user` directly. Read on PR 1 (v2.6529): not a hang — `finish()` opens its own confirm window before it writes, and the walk's script never pressed it.
- The owner's drafted days import only through the RPC `import_clock_sessions` (v2.6425) by hand; the walk did it with a REST call from the pane.

## The decision

Three PRs: surface and link, then tighten the schema, then the import door. The NOT NULL lands only when the count reads zero on prod.

## Where it plugs in

- `src/components/people/PeopleUsersTab.tsx` (the toolbar's count and the No login filter), `src/lib/people/rosterPeople.ts` (`account_kind 'external'`), `src/lib/combinePeople.ts`, `src/lib/people/accountMerge.ts`, `src/components/personDesk/sections/MergeDuplicateDialog.tsx`, `src/components/personDesk/PersonDeskLifecycleModal.tsx` (the End employment flow).
- Migrations: `20261022044606_users_is_walk_tester.sql` (the roster view), the baseline's `people_account_user_id_fkey`, `20261104210000_people_without_users_backfill.sql`, `20261103030000_imported_clock_sessions.sql`.
- Bed: `supabase/tests/users_without_login/` (`scripts/pgtest-users-without-login.sh`).

## The plan

1. **PR 1 — the stragglers have a count and a door** (S): People → Users shows *N roster records with no users row* when any (from `roster_people` rows with `account_kind 'external'`), each row's ⋯ keeps *Link account*; `combinePeople` refuses two records that both have users rows with the words that send the office to *Merge a duplicate* (the account merge, which moves the roster link) instead of nulling an account; the End employment flow's hang read and fixed. Client only.
2. **PR 2 — the schema says it** (S, after the count reads zero on prod): `people.account_user_id NOT NULL`; `people_account_user_id_fkey` `ON DELETE RESTRICT` (a users row with a People record is archived, never deleted; invite-user's replace path deletes the record it made first); `roster_people` a left join from users with `account_kind 'external'` retired; the bed's straggler scenario (X5) becomes a refusal. Push after the merge.
3. **PR 3 — the drafted days have a door** (S): a dev-only *Import days* press on the person's desk (Hours section): paste or type rows (day, hours, job, the note that names the source), `import_clock_sessions` runs them, the answer draws each refused row with its reason and the inserted count, a rerun skips what is there. Guide section in *charge by crew*.

## How to verify

- PR 1: on prod the count reads 2 until the owner links them; on the dev server, Combine on two linked records refuses with the merge words.
- PR 2: the bed green; after the push, `select count(*) from people where account_user_id is null` is 0 and the Users tab shows no count.
- PR 3: on a `ZZ Test` person, three rows pasted, one with a blank note — two land, one is named with its reason; the row's hours count rises; pasted again, all three skipped.
