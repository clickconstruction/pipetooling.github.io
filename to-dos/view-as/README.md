---
name: "View as: see the app as a role or a person"
group: ready
status: designed 2026-09-18 · mock-up drawn (`mockup.html`) · PR 1 shipped v2.3606 (the samples, the same-page landing, the return-to-page exit) · PR 2 next
summary: >
  **A dev opens the gear menu, picks a role or a person, and is looking at the page they were on
  as that account** — the real session, so row security answers exactly what that account gets,
  not a client-side costume. Imitate already exists (People → Users and the person desk, the
  `login-as-user` function, an amber header with an Exit control), but it takes a real person, lives
  two clicks away, lands on the role's home page and exits to the dashboard. This adds one
  **sample account per role** (real users, hidden from every roster the way twins are), a
  **View as…** door in the gear menu that lists the roles with their switches and every real
  person, the same-page landing, and an exit that returns you to the page you left. The Hiring
  column shares to-do verifies through it.
next: >
  PR 2 — the View as… door in the gear menu with the role list, the switches and the person
  search; the guide.
size: S (PR 1 done) · S
blocker: >
  None. One owner call, taken as drawn: the sample accounts are ordinary rows a dev can also
  grant switches to (prospects staff, Hiring, a shared column), so "view as an assistant with
  Plumber shared" is one share away — they are not read-only.
opinion: build — everything hard (the minted session, the exit stash, the amber chrome) shipped long ago; what is left is a door, a landing rule and nine hidden accounts.
---

# View as: see the app as a role or a person

Status: **PR 1 shipped v2.3606** (`users.is_sample`, the Sample accounts heading with *Create the missing samples*, Imitate lands on the current page, Exit returns to it) · PR 2 the door next · mock-up in `mockup.html` beside this file

## The ask, in the owner's words

> "I think it is super important to be able to as a dev understand what other people see. So as a
> dev I want to be able to click on a button and view things as a certain class of user or a
> certain user."

Todd, 2026-09-18, reading the Hiring column shares mock-up (`../helper-tryout-loop/mockup-share.html`): the
to-do could not be checked without a hand-made test assistant.

## The decision

**Keep the real session; never fake the role in the client.** What a person sees is decided by
row security on `auth.uid()` (and by per-user switches — prospects staff, Hiring, estimator
prospects access, soon column shares). A client-side "pretend I am an assistant" would still fetch
rows as the dev and lie about precisely the thing being checked. So View as is the existing
`login-as-user` mint, with three changes and one addition:

1. **Same page.** View as lands on the URL you were looking at (`redirectTo` = current
   `location.href`), not `roleHomePath(role)`. If the role cannot open that page, Layout's route
   guard sends them where it always sends them — which is itself the answer.
2. **Exit returns you to the page you left.** The exit stash (`impersonation_original`) gains a
   `returnTo`; `handleBackToMyAccount` and the header Exit control go there instead of
   `/dashboard`.
3. **One door, everywhere.** Gear menu → **View as…** (dev only; the existing Imitate buttons on
   People and the person desk stay). A panel with two lists: **Roles** and **People**.
4. **Sample accounts.** One real user per role a dev may imitate (every role but dev): *Sample
   assistant*, *Sample estimator*, *Sample sub*, … — `users.is_sample = true`, email
   `sample-<role>@samples.pipetooling.local`, no phone, no pay config, no schedule. Hidden from
   every roster, picker, Person rail, review deck, quick sheet and notification the way twins are
   (`isActiveRosterPerson` drops `is_sample` rows next to `is_digital_twin`). Visible in Settings →
   Active accounts under their own heading, where the dev sets their switches like anyone's.

**The Roles list** shows each role with its sample account's switches as chips (*prospects staff ·
Hiring · Plumber shared*), and a *switches…* link to that account's Active accounts row. Picking a
role imitates its sample account. **The People list** is every active human, searchable, with
role and switches, picking one imitates them (same guard as today: never a dev).

**Not read-only.** A sample account can press Talked today, save a note, Advance a candidate —
that is how you find out a helper *can*. Its writes are stamped with its own name, and the
samples' rows are as easy to find as any user's. (Training mode `read_only` stays available on the
account if the dev wants a look-only sample.)

## The mock-up

`mockup.html` beside this file — the gear menu with the new entry; the View as panel with the
Roles list (switch chips) and the People search; the amber header on the landed page reading
*Viewing as Sample assistant · Exit → back to Prospects › Hiring*; and Settings → Active accounts
with the Sample accounts heading.

## Where it plugs in

Exists today:

- `supabase/functions/login-as-user` — mints a magic link with the service role; caller must be
  dev / master / assistant; refuses a dev target; assistants cannot take masters.
  `src/lib/loginAsUser.ts` invokes it, stashes the caller's tokens in
  `localStorage.impersonation_original`, verifies the token on the current origin.
- `src/lib/impersonationSession.ts` (the stash key, the amber button style),
  `src/lib/impersonationUiLabels.ts` (*Exit impersonation (Bryan)*), `Layout.tsx` (amber chrome,
  the Exit control, back-button interception, bfcache reload), `Settings.tsx`
  `handleBackToMyAccount` (restores the stash → `/dashboard`).
- Imitate doors: `UsersTabRow.tsx` / `PeopleUsersTab.tsx` (dev only, one click, owner decision
  2026-09-04) and `PersonDeskHeader.tsx` (`canImitate(viewer)`). Landing: `roleHomePath(role)`.
- Twin hiding: `users.is_digital_twin`, `activeUsersQuery` / `isActiveRosterPerson`
  (`src/lib/people/`), `fetchTwinUserIds`; Settings → Digital twins / Active accounts read the
  flag directly. The `create-user` function (dev only) makes accounts.
- Gear menu in `Layout.tsx` (Punch list, Release notes, Sign out …).

New:

- Migration: `users.is_sample boolean not null default false`, guarded like the other privileged
  columns (dev-set only); `COMMENT` naming its purpose. No new table; no RLS change — a sample
  account's rows are ordinary rows.
- `isActiveRosterPerson` / `activeUsersQuery` drop `is_sample` rows; the notification senders
  (push, email, SMS fan-outs that read the roster) skip them. One kernel test per predicate.
- `loginAsUser(user, redirectTo)` callers pass `location.href`; the stash carries `returnTo`;
  `handleBackToMyAccount` and the header Exit read it.
- `src/components/layout/ViewAsPanel.tsx` (roles + people; reads `users` with role, the switches,
  `is_sample`), opened from the gear menu; `src/lib/viewAs.ts` kernel that orders the roles,
  formats the switch chips and picks the sample account per role (tests).
- Settings → Active accounts: a *Sample accounts* heading (like Digital twins), with **Create the
  missing samples** for a dev — calls `create-user` once per role that has no sample.
- Docs: `ACCESS_CONTROL.md` (the impersonation rows + a *Sample accounts* paragraph beside
  Digital twins), `EDGE_FUNCTIONS.md` login-as-user (the `redirectTo` convention),
  `GLOSSARY.md` (*sample account*, *View as*), `docs/migrations/<version>_users_is_sample.md`,
  help guide `src/content/help/see-the-app-as-someone-else.md` (dev only).

## The plan

1. **PR 1 — samples and the landing** (S, one migration). `is_sample` + guard; roster and
   notification exclusion; *Sample accounts* heading with *Create the missing samples*; Imitate
   lands on the current page and Exit returns to it. Verify: create the samples on prod (they are
   data), open People → Users and the crew pickers — no samples; Imitate a sample from Active
   accounts while on `/prospects?tab=team` — you land there (or where the guard sends that role);
   Exit → back on `/prospects?tab=team` as yourself.
2. **PR 2 — the door** (S). Gear → View as…; the Roles list with switch chips; the People search;
   guide + docs. Verify: from any page, View as → Sample assistant → the same page as an assistant;
   Exit → back. View as → a real estimator → their Bids. Non-dev accounts do not see the entry.

## How to verify (once built, for other to-dos)

Grant the sample account the switches the to-do needs (Active accounts), View as it from the page
under test, exercise the flow, Exit. The Hiring column shares to-do's recipe: share Plumber with
*Sample assistant*, View as → Assistant, check the board; unshare; View as again — no Hiring pill.

## Where it stands

Designed and drawn 2026-09-18. Nothing built. The one owner call (samples are writable, not
read-only) is taken as drawn.
