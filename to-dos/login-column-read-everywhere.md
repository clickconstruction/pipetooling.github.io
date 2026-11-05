---
name: The login column is read everywhere a login is drawn
number: 264
group: ready
status: card written 2026-11-04 after the users-without-login train (#260) shipped
summary: >
  Since v2.6511 a users row is a person and users.login_attached_at says whether a sign-in stands behind it. The
  one bug the live walk found was a reader that never selected the column, so a person with no login drew as a
  login. The column is optional on every row type, so the typecheck cannot catch the next one. Make it required
  where a login is drawn, pin the picker rule, give the words a glossary home, and move the account functions'
  callers onto the id.
next: Make login_attached_at required on the row types a chip or a press reads from, and let the typecheck name every reader that forgot it.
size: S
blocker: None.
ver: v2.6511 · 6514 · 6518 · 6519
opinion: build — it is the guard that keeps #260's rule true as readers are added.
mockup: not required — no screen changes shape; the words are already on the screens
---

# The login column is read everywhere a login is drawn

## The ask

The dev, 2026-11-04, after the users-without-login train shipped: "Looking at how we manage all of this, is there anything else we should do to make it clean and robust and more useful for the future?" — and, to the list that answered it, "Yes, make cards" and "do them all here".

## What was true on 2026-11-04

- `users.login_attached_at` (v2.6511) is the one fact: NULL is a person with no login. The rule the sweep (v2.6519) settled on: `=== null` is *no login*; a row a read did not stamp (`undefined`) keeps the older meaning, a login. That rule exists only because readers may leave the column out of their select.
- The live walk found exactly that: the Users tab's three row builders in `PeopleUsersTab.tsx` never handed the row `login_attached_at`, so a no-login person read *login*. Fixed in v2.6519 by hand; nothing stops the next reader doing the same.
- The column is optional (`login_attached_at?: string | null`) on `UserRow` (`usePeopleRoster.ts`), `UsersTabRowItem` (`UsersTabRow.tsx`), the lens cells' item (`UsersTabLensCells.tsx`), `PersonDeskUserRow` (`usePersonDesk.ts`) and `RailPersonInput.hasLogin` (`deskRailAttention.ts`).
- `activeUsersQuery({ withLogin })` filters client-side (v2.6519); `walkTesterSweep.test.ts` and `rosterRulePin.test.ts` pin the hide flags, but nothing pins that the default includes a no-login person and `withLogin` drops them.
- `archive-user` takes `user_id` (v2.6519) and the desk's Archive sends it; the End employment flow (`leaveWrites.ts` `archiveAccount`, `archiveRequestBody` in `archiveUserDialog.ts`) and the twins' fleet archive still send email and name, and the function still looks rows up by them.
- `create-user` holds three doors in one function: the dev's create, the Hiring Try-out and the attach (`user_id`).
- GLOSSARY has no entry for *login attached* / *no login*, which now appear on three screens.

## The decision

Make the column required where a login is drawn, so the typecheck names a reader that forgot it; keep the `=== null` rule in the kernels that take rows from older readers. Pin the picker rule in a test. Move every `archive-user` caller onto the id and drop the email and name lookups. Split `create-user`'s attach door into `_shared/attachLoginDoor.ts` so each door reads on its own. One glossary entry.

## Where it plugs in

- Types: `src/hooks/usePeopleRoster.ts` (`UserRow`), `src/components/people/UsersTabRow.tsx`, `src/components/people/UsersTabLensCells.tsx`, `src/hooks/usePersonDesk.ts`, `src/lib/people/deskRailAttention.ts`; the readers the typecheck will name (`PeopleUsersTab.tsx`, `peopleUsersTabShared.ts`, the desk sections, any test fixture).
- Tests: `src/lib/people/rosterRulePin.test.ts` (the pin for `withLogin`), `src/lib/people/fetchActiveUsers.ts`.
- Functions: `supabase/functions/archive-user/index.ts`, `supabase/functions/create-user/index.ts`, `supabase/functions/_shared/`; callers `src/lib/people/leaveWrites.ts`, `src/lib/archiveUserDialog.ts`, `src/lib/twins/fleetArchive.ts`, `src/components/personDesk/PersonDeskLifecycleModal.tsx`.
- Docs: `docs/GLOSSARY.md`, `docs/EDGE_FUNCTIONS.md` (archive-user, create-user), `docs/ACCESS_CONTROL.md`.

## The plan

1. **PR 1 — the column is required** (S): `login_attached_at: string | null` (not optional) on the five row types; every reader the typecheck names selects it; `hasLogin` required on `RailPersonInput`; a pin test that `activeUsersQuery` keeps a no-login person by default and drops them with `withLogin`; the GLOSSARY entry. Client only.
2. **PR 2 — the account functions** (S): `archive-user` looks up by `user_id` first and every caller sends it (the End employment flow, the fleet archive); the attach door of `create-user` lifted into `_shared/attachLoginDoor.ts` with the three refusals as one kernel and a test; `check:edge-bundles`; deploy both after the merge.

## How to verify

- PR 1: `npm run typecheck` green with the column required; a fixture row without it fails to compile; `npx vitest run src/lib/people/rosterRulePin.test.ts src/components/people` green.
- PR 2: `bash scripts/deploy-functions.sh archive-user create-user`; on the dev server, End employment on a `ZZ Test` person with no email archives through the id; Attach a login still lands on the person's id (the #260 walk, repeated).
