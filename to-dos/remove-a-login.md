---
name: A login can be taken away and the person stays
number: 266
group: close
status: shipped 2026-11-04 · v2.6532: `detach-login` with its door in `_shared/detachLoginDoor.ts`, the desk's Remove the login… with its confirm, the guide section and ACCESS_CONTROL
summary: >
  Since v2.6511 deleting an auth account detaches it (login_attached_at NULL) instead of taking the person and
  every clock session with it. No door in the app deletes an auth account, so the detach is proven only on the
  bed. Give the desk a dev-only Remove the login press, through one function, with the confirm that names what
  stays and what goes.
next: nothing left; delete this card.
size: S
blocker: None.
ver: v2.6511 · 6518
opinion: build — a login that cannot be taken away is a login that gets archived instead, and an archived person leaves every roster.
mockup: not required — one press on the desk's Login row with a confirm window
---

# A login can be taken away and the person stays

## The ask

The dev, 2026-11-04: "is there anything else we should do to make it clean and robust and more useful for the future?" — "Yes, make cards" — "do them all here". The spike's bed walked the detach (scenario E: the auth row deleted, the worker and both days stay, a re-attach lands on the same id); the live walk could not, since nothing in the app deletes a login.

## What was true on 2026-11-04

- `on_auth_user_deleted` (`20261104190000`) clears `users.login_attached_at` when an auth account is deleted; `handle_new_user`'s `ON CONFLICT` re-attaches on the same id. The bed's scenarios E and E2 prove both.
- The only deletes of an auth account in the repo are `invite-user`'s replace of a pending invite and `create-user`'s cleanup after a failed row write. Archive bans; nothing detaches.
- The desk's Access section (v2.6518) draws the Login row with *Attach a login…* when there is none and the Sign-in row when there is one.

## The decision

A dev-only press, *Remove the login…*, on the desk's Sign-in row: a confirm window that says what stays (the person, their hours, Charged as, pay, paperwork, portal) and what goes (the sign-in; any password; their push devices, since `push_subscriptions` keys on `auth.users`), then one function, `detach-login`, that deletes the auth account by the row's id as the service role and answers with the row as it stands. The desk reloads to the Login row, where *Attach a login…* is the way back.

## Where it plugs in

- New: `supabase/functions/detach-login/index.ts` (dev only, `user_id`; refuses a row with no login, the caller's own account, a sample or twin); `src/lib/people/attachLogin.ts` gains `removeLogin`.
- `src/components/personDesk/sections/PersonDeskAccessSection.tsx` (the Sign-in row's actions and the confirm through `useConfirmDialog` with `confirmLabel: 'Remove the login'`).
- Docs: `docs/EDGE_FUNCTIONS.md` (new section + TOC), `docs/ACCESS_CONTROL.md`, the guide *invite someone to sign in* (a short section), `docs/twins/APP_DIRECTORY.md` only if a path changes (none).
- Bed: `supabase/tests/users_without_login/20_scenarios.sql` E and E2 are the spec; no new SQL.

## The plan

1. **PR 1** (S): the function, the kernel, the press, the confirm, the docs and the guide section. Deploy `detach-login` after the merge; walk on a `ZZ Test` person: attach, remove, attach again — the id, the People link and a made-up clock session never change; `users.login_attached_at` NULL between.

## How to verify

`npx vitest run src/lib/people/attachLogin.test.ts src/components/personDesk/sections/PersonDeskAccessSection.render.test.tsx`; `npm run check:edge-bundles`; the walk above with screenshots at 375, 768 and 1280.
