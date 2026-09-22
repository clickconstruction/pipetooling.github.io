---
name: People spine — one roster view, three moments, the lenses
group: ready
status: >
  **building** 2026-09-21 — PR 1 shipped v2.3698 (`roster_people` view + salary guard) · PR 2
  shipped v2.3700 (Leave finishes on the desk) · PR 3 shipped v2.3701 (Hire — one form, born
  linked; both functions deployed before merge) · PR 5 Lenses (#3545) is an open PR · PRs 4 and 6
  not started · the view's push and the `gen-types` regen (drops the
  `as never` cast in `rosterPeople.ts`) not yet landed
summary: >
  **People spine**: the roster row is the person, a database view is the one answer to "who is
  a person", the Person desk finishes Hire / Change / Leave in one write each, and People → Users
  becomes the one roster with Contact / Account / Pay lenses. Six PRs. Born from the 2026-09-21
  Training Helper clean-up (a test account with a Salary-ticked pay row put 40 h / $0 into every
  pay list for nine weeks). Mock-up in the folder.
next: >
  Push `20260922001000_roster_people_view.sql` and regenerate types (the regen PR drops the
  `as never` cast); merge PR 5 (Lenses); then PR 4 (`person_id`
  joins, one migration) and PR 6 (pointers + homes, drops `get_archived_user_names()`).
size: L
blocker: none — the owner picked the stronger plan on 2026-09-21.
ver: v2.3698 · 3700 · 3701
opinion: build all six; the first PR alone makes the incident that started this impossible.
---

# People spine — one roster view, three moments, the lenses

## Where it stands

**building** 2026-09-21 — PR 1 **shipped v2.3698** (`roster_people` view, `rosterPeople.ts`, the pay
lists read the view, the three salary functions stop at `archived_at`; migration
`20260922001000_roster_people_view.sql`, dry-run twice on a throwaway Postgres with stub tables —
recipe in the memory note *throwaway-postgres-recipe*; the push and the `gen-types` regen that drops
the `as never` cast are still owed). PR 2 **shipped v2.3700** (`generatePayStub.ts` and
`leaveWrites.ts` lifted out of the components; End employment generates the final report, clears the
salary, reassigns customers, archives both halves; Status → Archive… opens it for every role). PR 3
**shipped v2.3701** (`hireWrites.ts`, `HirePersonModal`, `_shared/rosterRow.ts` — `invite-user` /
`create-user` write the roster row at birth; both deployed before merge, no migration; no real hire run
on prod yet). PR 5 Lenses (#3545) is an open PR on its branch; PRs 4 and 6 not started.
Mock-up: [`before-after.html`](./before-after.html)
(four boards; the live canvas is the Claude artifact *People surfaces unified*, BhRVGMD3iAFxNVMn74Bqkb).

## The ask, in the owner's words

2026-09-21, after cleaning the Training Helper out of the pay lists by hand (eight $0 pay reports,
Salary unticked, account and roster row archived): *"I do think things are a little disjoint with the
active accounts separate from the people person area and the pay, payroll, people, pay config, also
separate. Let me know if you have any suggestions as to if or where we should unify parts of these?"*
Then, on the lens plan: *"Is this the best we can do?"* — and on the stronger one: *"Please come up
with a code plan to build it and then let's build it all."*

## The decision

Not the lens plan alone (it tidies where you look). The data shape:

1. **One spine.** The `people` row is the person; the `users` row is its login (0 or 1, linked by
   `people.account_user_id`, unique). The pay tables already carry `person_id` (→ `people.id`); the
   joins move off the trimmed name onto it. The Phase B backfill (`20260722268000`) already gave every
   account a roster row once; PR 3 makes the invite do it at birth so it stays true.
2. **One roster view in the database** — `public.roster_people`: one row per human (the account, the
   roster row, or the linked pair) with the classification the readers used to derive for themselves
   (`account_kind` person | external | sample | twin, `is_archived`, `is_dev`) and two rollups:
   `is_pay_roster` (a real person, neither half archived — devs included: they are paid people) and
   `is_active_roster` (the crew-picker rule: `is_pay_roster` and not a dev). Every pay list, roster,
   picker and email fan-out reads it. Samples and twins are out by construction; no surface has a
   filter to forget. Names, roles, kinds, flags and dates only — contact columns stay behind the
   `users` / `people` policies. Ids CASE-wrapped (the v2.2995 trick) so PostgREST does not relate every
   FK through it.
3. **Three write moments on the Person desk** — Hire (one form, one write: person row, account, pay
   row, workday template, packet; a salaried hire with no wage is refused), Change (each desk row
   carries its side effects: salary on → template + sync; salary off → clear; role → grants), Leave
   (one dialog: end date, reassign customers, final pay report, vehicle and housing back, sign-in
   banned, template and future auto sessions cleared, both halves archived).
4. **The lenses survive as the read side**: People → Users with Contact / Account / Pay column sets
   over the same grouped rows; Active Accounts in Settings becomes a pointer (the v2.1292 / v2.2835
   pattern); the People pay config button opens the Pay lens; samples and twins get their own home
   under Settings → System.

Rejected: a `kind` column on `users` (the view derives `account_kind` from `is_digital_twin` /
`is_sample`, so no write path, guard trigger or edge function changes); a `security_invoker` view
(non-dev viewers cannot select `master_technician` rows under the `users` policy, so the Hours grid
would differ by viewer — J7-6 again); hiding pay rows that match no roster row (an orphan pay row is a
data question, never hidden money).

**Not changed** by any PR: who may see wages, flip training mode or archive, and the edge functions
behind those actions. This train moves where controls live and when writes happen, not what they may do.

## Where it plugs in

- **Identity spine (exists):** [`src/lib/people/personKey.ts`](../../src/lib/people/personKey.ts)
  (gaps `no_roster_row` / `no_login` / `unlinked_email_match` / `pay_name_mismatch` /
  `no_pay_config`), [`payConfigLookup.ts`](../../src/lib/people/payConfigLookup.ts) (id-first lookups),
  `people.account_user_id` written from the desk header, `usePeopleRoster.linkPersonToAccount`, the
  merge RPC and `combinePeople.ts`.
- **Roster readers (a census, 2026-09-21):** ~175 client files read `users` / `people`; 19 already go
  through `activeUsersQuery` / `activeRosterOnly` ([`fetchActiveUsers.ts`](../../src/lib/people/fetchActiveUsers.ts),
  [`activeRoster.ts`](../../src/lib/people/activeRoster.ts)); 13 edge functions carry
  `eq('is_sample', false)` by hand; the pay lists took `Object.keys(payConfig)` minus
  `get_archived_user_names()` ([`hoursGridRoster.ts`](../../src/lib/people/hoursGridRoster.ts),
  `useWeeklyTeamLaborTotal`, Quickfill `HoursSection`, `PeopleReviewTab`) — since v2.3698 they take the
view's verdict on top of the archived names. Existing view precedent:
  `master_assistants` / `master_shares` (`20260907060000`, the CASE trick).
- **Lifecycle (exists, partial):** [`PersonDeskLifecycleModal`](../../src/components/personDesk/PersonDeskLifecycleModal.tsx)
  + [`lifecycleChecklist.ts`](../../src/lib/people/lifecycleChecklist.ts) (End: force clock-out, portal
  off, vehicle park, housing end, end date, HR line, optional `archive-user`; Start: start date, hourly
  wage only). Built in v2.3700: the headless pay-report generator
  ([`src/lib/pay/generatePayStub.ts`](../../src/lib/pay/generatePayStub.ts), lifted out of `People.tsx`),
  [`leaveWrites.ts`](../../src/lib/people/leaveWrites.ts) (`closeOpenClockSessions`, `clearSalaryForPerson`,
  `countCustomersOwned`, `archiveAccount`, `archiveRosterRow`, `setEmploymentEndDate`); Leave now clears
  the salary template and `is_salary`, archives the roster row, and the desk's Status → Archive… runs the
  flow for every role. Built in v2.3701: `saveSalaryTemplate` and `createRosterRow` in
  [`hireWrites.ts`](../../src/lib/people/hireWrites.ts), with `hirePlan` and one function per write.
- **Salary machinery:** `salary_sync_one_user_clock_sessions`, `sync_salary_clock_sessions_for_day`
  (baseline), `auto_approve_salary_clock_sessions` (`20260903010000`, 30-minute cron) — until v2.3698
  none checked `users.archived_at`, so a leftover template kept minting and approving paid hours for a
  departed person; all three stop at `archived_at` since the `20260922001000` migration.
- **Tables (three surfaces):** [`PeopleUsersTab`](../../src/components/people/PeopleUsersTab.tsx) (934
  lines; `buildUsersTabKindRoster` groups), [`ActiveAccountsPanel`](../../src/components/settings/ActiveAccountsPanel.tsx)
  (1332; `useActiveAccountsManagement({ enabled })`), [`PeoplePayConfigModal`](../../src/components/people/PeoplePayConfigModal.tsx)
  (333; `PayConfigRowTr`), `SettingsAccountSchedulingTab` (the dev "All salaried users" picker).
  Pointer precedent: `TeamFeedbackDevSettingsBlock` `layout="settings"` (v2.2835).
- **Invite / create:** `invite-user` and `create-user` upsert `users` only; the `people` row is created
  on the first Employment-tab date save or from the desk header. `archive-user` sets `users.archived_at`,
  bans auth, mirrors the CountTooling seat, optionally reassigns customers — nothing else.

## The plan — six PRs, each its own branch off fresh main

| PR | Branch · version | What ships | Migration / deploy |
|---|---|---|---|
| **1 Roster view + guard — SHIPPED v2.3698** | `claude/people-spine-1-roster-view` | `roster_people` view; `rosterPeople.ts` kernel (`fetchRosterPeople`, `buildPayRosterIndex`, `isPayRosterRow`); `buildHoursGridRoster` takes the view's verdict instead of archived names; People → Hours / Draft Payroll / Earlier weeks / cost matrix, the Dashboard team-labor total, Quickfill Hours and the Review tab read it; the three salary functions stop at `archived_at`. Kernel tests: a sample with a pay row stays hidden; a null roster means no verdict. | `20260922001000_roster_people_view.sql` (db push after merge); `gen-types` regen PR after the push drops the `as never` cast |
| **2 Leave — SHIPPED v2.3700** | `-2-leave` | As built: `generatePayStubRecord` (`src/lib/pay/generatePayStub.ts`, from `People.tsx`) and `leaveWrites.ts` (`closeOpenClockSessions`, `clearSalaryForPerson`, `countCustomersOwned`, `archiveAccount`, `archiveRosterRow`, `setEmploymentEndDate`; the housing end stays the checklist's own row); the End employment flow gains: final pay report through the end date (automated), salary template cleared + `is_salary` off, customers reassigned (count + picker, `archiveRequestBody`), account archived, roster row archived; the desk's Status → Archive… opens this flow for every role (no Active Accounts hop). | none |
| **3 Hire — SHIPPED v2.3701** | `-3-hire` | `invite-user` / `create-user` insert the linked `people` row (born linked) and accept `start_date`; kernels `createRosterRow`, `upsertPayConfigRow` (with the salary side effects), `saveSalaryTemplate` (from `SalaryWorkScheduleSettings`); the Start employment flow becomes Hire: kind/role · start date · wage or salary (salaried needs a wage) · workday · vehicle · packet · invite; runs the steps in order, shows a per-step result with retry (no cross-service transaction exists — say so on the form); Users tab **+ Hire**; guide *hire someone* | deploy `invite-user`, `create-user` (keep `verify_jwt = false` on create-user) |
| **4 person_id joins** | `-4-person-id` · next claim | Backfill `person_id` on `people_pay_config`, `people_hours`, `pay_stubs` by unique trimmed-name match (unmatched rows listed in the fragment, left null); `set_pay_person_id()` BEFORE INSERT OR UPDATE trigger on the three tables (fills from the name when null); every client writer passes `person_id`; readers id-first, name fallback (`payConfigForPerson` pattern); the view gains `email_matched_person_id` / `name_mismatch` so `personKey` gaps read from it | one migration; types regen |
| **5 Lenses** | `-5-lenses` · open PR #3545 | `PeopleUsersTab` gets `lens: contact \| account \| pay` (`?tab=users&lens=`); Account cells extracted from `ActiveAccountsPanel` rows (role, sign-in, training, supervision, grants, actions) fed by `useActiveAccountsManagement({ enabled: lens === 'account' })`; Pay cells from `PayConfigRowTr` + a Workday column opening `SalaryWorkScheduleSettings` per row; Payroll's **People pay config** becomes a link to the Pay lens; `PeoplePayConfigModal` and `payConfigRosterSections` deleted | none |
| **6 Pointers + homes** | `-6-pointers` · next claim | Settings → People & teams: the Active Accounts card becomes the v2.2835 one-line pointer (invite / manual add / merge / archived list stay reachable from the Account lens toolbar); the sample heading row and the digital-twin chips leave the roster for Settings → System → **Digital twins & samples** (*Create the missing samples* moves with them); Users ⋯ **Accounts · dev** removed; the dev "All salaried users" panel becomes a pointer to the Pay lens; docs sweep (`PROJECT_DOCUMENTATION`, `GLOSSARY`, `ACCESS_CONTROL`, `PEOPLE_TABS_ARCHITECTURE`, `SETTINGS_TABS_ARCHITECTURE`, `twins/APP_DIRECTORY`, guides) | none |

Each PR: release note + `docs/recent-features/` fragment, `docs/migrations/` doc where there is a
migration, guide where a flow changes (PR 3 *hire someone*, PR 2 the existing *end someone's
employment* guide, PR 5 *see everyone's pay setup*), auto-merge, `supabase db push` after merge, edge
deploys before merge where the old client tolerates the new function.

## How to verify

- **Migration:** throwaway Postgres 15 (`/usr/local/opt/postgresql@15/bin`, `LC_ALL=C`, socket in
  `/tmp`, stub `anon` / `authenticated` / `service_role`, `auth.uid()` from a one-row stub table, the
  handful of tables each function touches) — apply twice, then insert one of each account kind and
  read the view; call the sync for an archived user and count its sessions (PR 1's run: 9 rows
  classified as designed, 0 sessions left).
- **Live, read-only:** worktree dev server on a free port (`.claude/launch.json` entry
  `npm run dev -- --port 51NN --strictPort`, `autoPort: false`), sign in with
  `http://localhost:51NN/dev-login?as=&to=%2Fpeople%3Ftab%3Dpay`; the Hours grid, Draft Payroll and
  Earlier weeks must list the same people as before the PR minus any twin / sample / archived row
  (there were none left after the 2026-09-21 clean-up, so the check is "nothing changed"). Never press
  Generate, Record payment, Archive or Send on prod data — the write flows are verified with the
  Sample helper (Settings → Active accounts → Sample accounts), never a real person.
- **Gotchas:** the auto-mode classifier blocks direct PostgREST reads and scripted writes from the
  browser pane — read prod through the app's screens; the Browser pane must be visible for ref clicks;
  the dev-mcp key of a session can be revoked without notice (`whoami` first).

## Residuals (decide later, one line each)

- Whether crew pickers (`activeUsersQuery`) also switch to the view — they need contact columns, so
  they would join by id; the view alone already guarantees membership. Not in the six PRs.
- The 13 edge-function `is_sample = false` reads: switch to the view once PR 1 is live (one sweep PR,
  mechanical, merges alone).
- `get_archived_user_names()` after PR 1 still serves Offsets, Contracts and the Teams member filter —
  swap those to the view in PR 6 and drop the RPC.
