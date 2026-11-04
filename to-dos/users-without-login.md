---
name: Every worker is a user from day one; a login is attached later
number: 260
group: ready
status: the owner chose this model 2026-11-04 (#7020 closed unmerged) · PR 1 shipped v2.6511 (PR #7034, pushed) · PR 2 v2.6514 (add_worker, PR #7039) · PR 3 built v2.6517 (the backfill, branch claude/backfill-people-users) · PRs 4–5 next
summary: >
  A row in public.users today is a login (users.id → auth.users). A worker with no login is a People record
  with no account, so they can hold no clock session and no Charged as, and a job they worked prices short.
  The spike asked whether a users row can exist with no sign-in behind it, so every worker is a user from
  day one, their days are ordinary clock sessions, and a login attaches to the same id later. It can: the
  auth server takes a chosen id on create, the one foreign key in the way is users_id_fkey, and the bed
  walked the whole life — no login, days imported, login attached, login taken away — with nothing moving.
next: PR 3's merge and push (read the NOTICE for who was skipped); then PR 4 (Attach a login on the desk, create-user's user_id).
size: S (PR 1 migration) · S (PR 2 Add a person) · S (PR 3 backfill) · M (PR 4 Attach a login) · S (PR 5 the sweep) · S (close #7020)
blocker: None — the owner chose the model on 2026-11-04.
ver: v2.6425 · 6441 · 6490 · 3698 · 3701 · 4346 · 6511 · 6514 · 6517
opinion: build — it is the smaller change (one dropped key, one column, two triggers) and it retires the "no login" branch everywhere instead of adding a second table beside the clock; the only cost is a client sweep whose items are mostly filters.
mockup: not required — a schema and flow change; no screen changes shape (Who counts as what already lists users rows; the person desk's Access section gains one press, Attach a login)
---

# Every worker is a user from day one; a login is attached later

## The ask

The owner, 2026-11-04, after punch list #254 priced its first job and five of that job's days still waited on people with no login:

> What if we treated all people as just users with no login? this would make turning a person into a user easier than it has been previously? Should we look at this?

She had first chosen the smaller path — PR #7020, a `people_pay_record_days` table keyed by the People record plus `people.charge_standing` — then asked for this spike before #7020 goes further. #7020 is held as a draft.

## The answer

**Yes, and it is cheaper than it looks.** Three facts carry it:

1. **The auth server takes a chosen id.** `POST /auth/v1/admin/users` has accepted an `id` field since GoTrue v2.155.0 (supabase/auth PR #1641, merged 2024-07-03; `AdminUserParams.Id`, parsed with `uuid.FromString`, applied as `user.ID = customId`). The JS client exposes it as `AdminUserAttributes.id` ("Allows you to overwrite the default `id` set for the user"). Prod runs GoTrue **v2.197.0** (`/auth/v1/health`, read 2026-11-04). So attaching a login is `auth.admin.createUser({ id: users.id, email, password, email_confirm: true })` — GoTrue writes its own `auth.users` and `auth.identities` rows, and sign-in, password reset and the magic-link mail work by construction. No direct write to the auth tables is needed.
2. **One foreign key is in the way.** `users_id_fkey` (`users.id → auth.users(id) ON DELETE CASCADE`, the baseline's) is the only constraint that says a users row is a login. The other 24 public foreign keys to `auth.users` are "who did it" columns an actor fills; a worker who never signs in never fills one — except `notification_history.recipient_user_id`, which a send to that worker would refuse (see Evidence 2).
3. **Everything already points at users.** 592 foreign keys reference `public.users(id)` on prod against 37 to `public.people(id)`; `clock_sessions.user_id`, `users.charge_standing`, `charge_standings()`, the salary schedule and time off all key on `users.id`. A users row with no login flows through all of it unchanged — the bed ran `import_clock_sessions` (v2.6425) for one with no edits.

What the model does **not** do: make the People table go away. The ten pay tables (`people_hours`, `people_pay_config`, `people_crew_jobs`, …) are keyed by `person_name` with `person_id → people`, resolved from a clock user through `users.name → people.account_user_id` (`resolve_pay_person_id`); the HR file, the sub portal, contracts, partnerships and the Messages contacts all hang on `people(id)`. So the model is **every People record has a users row** (`people.account_user_id` becomes NOT NULL once backfilled), not "people is folded into users". The roster view `roster_people` (v2.3698) already joins the two; its `has_login` flag just changes meaning.

## What was true on 2026-11-04

- `public.users`: 51 rows, every one with an auth row; 6 never signed in. `public.people`: 26 linked to a login; **17 live with no login (15 of kind `sub`, 2 `helper`) and 4 archived with no login** (3 `sub`, 1 `superintendent`). Read over the pooler, read-only.
- A People record with no login is made by: People → Users → **Add to roster** (`usePeopleRoster.ts`), People → **Hire** with no email (`hireWrites.ts` `createRosterRow`), the Hiring board's **Add to roster** (`TeamProspectsTab.tsx`), the workflow step form's add-a-person (`StepFormModal.tsx`, kind `helper` or `sub`), the sub-sheet form and the work-order assembler (`JobsSubLaborFormModal.tsx`, `WorkOrderAssemblerModal.tsx`, kind `sub`), and Banking's attribute-to-a-new-person (`BankingMercuryAccountingTab.tsx`, `BankingMercuryVisualsTab.tsx`, kind `sub`). The edge functions `invite-user` and `create-user` make every login's People record born linked (`_shared/rosterRow.ts`, v2.3701), except the Hiring Try-out door.
- A login is made by `invite-user` (`generateLink type invite`, which creates the auth user — GoTrue's `InviteParams` takes no id), `create-user` (`auth.admin.createUser`, the dev door and the Try-out door) and the public sign-up; `set-user-password` and `change-user-email` run `updateUserById`; `send-sign-in-email` mints a magic link for an **existing** user by email; `merge-users` → `merge_user_accounts` re-points every reference from one login to another with a dynamic sweep over every FK to `public.users` or `auth.users`.
- The deletion path today: `auth.admin.deleteUser` cascades through `users_id_fkey` into `users`, and from there `clock_sessions.user_id ON DELETE CASCADE` takes the worker's every day with the login. The bed reproduced it (scenario A2).

## The evidence

A local PostgreSQL 15 bed (no Docker on this Mac; `prod`'s `auth.users` and `auth.identities` shapes copied column for column from `\d`, read-only), the real `20261103030000_imported_clock_sessions.sql`, made-up people. The two files are in this card's hand-over note and are the seed of PR 1's bed. Every scenario passed:

| # | What ran | Result |
|---|---|---|
| A | Insert a users row with no auth row, today's schema | refused, `23503` on `users_id_fkey` |
| A2 | Delete a login's auth row, today's schema | the users row **and its clock sessions** are gone |
| B | The migration: drop `users_id_fkey`; add `login_attached_at timestamptz`, backfilled from `auth.users.created_at`; `email` nullable with `CHECK (login_attached_at IS NULL OR email IS NOT NULL)`; `handle_new_user` → `ON CONFLICT (id) DO UPDATE SET login_attached_at = now(), email = COALESCE(users.email, EXCLUDED.email)`; a new `AFTER DELETE ON auth.users` trigger clears `login_attached_at` | applied; 0 rows left unbackfilled |
| B2 | A worker with no login: `users (email NULL, role helpers, charge_standing 'helper')` + a People record linked at birth; a second NULL-email user | both in; `users_email_key` admits two NULLs |
| B3 | `import_clock_sessions` as the dev with two of the worker's days, then the same rows again | `inserted 2, refused 0`; rerun `skipped 1` — the v2.6425 door unchanged |
| B4 | RLS: the dev's policy reads the worker's days; a policy `user_id = auth.uid()` for the worker | dev reads 2; the worker is never `auth.uid()`, so own-row policies never match — the **464 `auth.uid()` checks compare the caller to a row, and a no-login user is only ever the row** |
| F | A `notification_history` row with the worker as recipient | refused, `23503` — the one FK to `auth.users` that names a receiver |
| C | Attach: an auth row created on the worker's id (the shape GoTrue writes on `POST /admin/users` with `id`) | same id; one users row; `login_attached_at` set; `email` filled; `charge_standing` kept; 2 days and the People link unchanged; one `email` identity |
| D | `UPDATE auth.users SET last_sign_in_at` | `on_auth_user_signed_in` syncs onto the attached row |
| E | Delete the auth row | the worker **stays**, `login_attached_at` NULL, both days stay (today, A2, they vanish) |
| E2 | Attach again with a new address | lands on the same id again |

**Not run here:** GoTrue itself (no Docker, and nothing is written to prod). Scenario C writes the rows GoTrue's `NewUser` writes (the eight token columns as `''`, never NULL — GoTrue's `User` struct reads them as plain `string`). The first real attach is PR 4's live walk on a `ZZ Test` person, and its fallback if GoTrue ever refuses the id is the merge that exists today: create the login the ordinary way, then `merge_user_accounts(survivor = the new login, absorbed = the no-login user)` — its sweep already re-points every FK to `public.users` (v2.4346's door on the desk).

### 1. The attach step

`auth.admin.createUser({ id, email, password: unguessablePassword(), email_confirm: true })` from `create-user` with a new body field `user_id` (dev door only), then `send-sign-in-email` as the Try-out door does today. `handle_new_user` fires on the insert and lands on the existing row (the `ON CONFLICT` above). `set-user-password` and `change-user-email` need no change: they take `user_id`, which is the same id. `invite-user` cannot attach (no id on `/invite`); the invite mail becomes the magic link after the create.

### 2. The schema change

- Drop `users_id_fkey`; add `users.login_attached_at`; relax `users.email NOT NULL` under the CHECK above (`users_email_key` stays). `roster_people.has_login` reads `login_attached_at IS NOT NULL`; `account_kind 'external'` (a People record with no users row) empties after PR 3 and is retired then.
- The 24 other public FKs to `auth.users` (prod count 25 with `users_id_fkey`; baseline 18, later migrations 8 — `bid_cost_mirror_tables`, `supply_house_contacts`, `supply_house_job_accounts`, `job_property_owners`, `bid_version_sends`, `nav_click_telemetry`, `bid_gcs`): 23 are actor columns (`created_by`, `updated_by`, `dismissed_by`, `reviewed_by`, `user_id` on dismissals, notes, reads, mute preferences, nav clicks, the dev checklist tables, `push_subscriptions.user_id`); a no-login user never writes a row, so none breaks. **One** names a receiver: `notification_history.recipient_user_id`. PR 5 moves it to `public.users(id)` (one `ALTER … DROP CONSTRAINT / ADD CONSTRAINT … NOT VALID; VALIDATE`), and every fan-out skips a user with no login or no email anyway (the sample/twin filter already does this for fixture accounts).
- The `merge_user_accounts` sweep keys on `confrelid IN (public.users, auth.users)` and is unaffected. The `users_guard_privileged_columns` trigger is unaffected (`login_attached_at` is set only by the two auth triggers and the service role; add it to the guard's column list so a client cannot set it).

### 3. Code paths that assume a users row can sign in

By file, with a verdict each — **filter** (hide the press for a row with no login), **small change** (a few lines), **real work**, **none** (confirmed unaffected). `from('users')` appears in 192 non-test client files and 130 edge-function files; most are name lookups by id and are unaffected. The tally: 9 filters, 24 small changes, 5 pieces of real work, 38 confirmed unaffected.

**The active-users fetch and rosters**
- `src/lib/people/fetchActiveUsers.ts:36-48` — archived, twin, sample and walk-tester filters, no login predicate — **small change**: a no-login worker belongs in the default result; an opt-in `signInOnly` for the few callers below.
- `src/lib/people/activeRoster.ts:39-46`, the crew, schedule, review and legal-desk consumers (`scheduleDispatchHub.ts`, `fetchWhosWhereWeek.ts`, `stepAssignment.ts`, `GcReviewWindow.tsx`, `JobFormModal.tsx`, `Jobs.tsx`, `LegalDeskPage.tsx`, `TeamReviewSection.tsx`, `useTeamReviewsDue.ts`, `PersonQuickSheet.tsx`) — **none**: they assign work or place people on the board, where a no-login worker belongs.
- App-task assignee pickers (`ChecklistAddModal.tsx:167`, `ChecklistItemEditModal.tsx:185`, `RoadmapTaskContextModal.tsx:88`, `ChecklistGoalsSection.tsx:113`, `useChecklistTechTreeData.ts:95`, `pages/Checklist.tsx`, `DashboardMyInboxCard.tsx:154`), the dev's *Pin for someone* (`Layout.tsx:462-470`), View as (`ViewAsPanel.tsx:40-61`) — **filter**: a task, a pin or an imitation for someone who cannot open the app is dead.
- **The three hide flags** (`is_digital_twin`, `is_sample`, `is_walk_tester`; 50 non-test files, `_shared/realAccount.ts` `REAL_ACCOUNT` among them) — **none**, and must **not** be widened to cover a no-login worker: they are a real person.

**Who counts as what and the charges readers**
- `WhoCountsAsWhatList.tsx:49-55` reads every users row; `charge_standings()` and `jobChargesRead.ts:46-70` key on `users.id`; `chargeStandings.ts`, `ledgerCharges.ts:197-225` resolve by `account_user_id` then the trimmed name — **none** (the word "login" in comments means a users row). A *no login* chip beside the name is the one addition.

**People → Users and the person desk**
- `usePeopleRoster.ts:96-105` — **none**. `UsersTabLensCells.tsx:90-91` Sign-in column reads "Has never signed in" — **small change**: a *no login* branch on `login_attached_at`. `PeopleUsersTab.tsx:335-342` offers *Invite as user* on People rows only — **small change**: offer *Attach a login* on a users row with none. Imitate (`PeopleUsersTab.tsx:431-447`, `UsersTabRow.tsx:116-122`, `loginAsUser.ts:10-13`) — **filter** on `login_attached_at`. Archived logins → `restore-user` (unbans by id) — **small change**: skip the unban when there is no auth row.
- `rowNeeds.ts:137-155` (`no_login` = no users row; `no_push` for any field user) and `personKey.ts:95,140-151` (the `no_login` gap's words say no clock, schedule, vehicle or housing without an account — false under the model) — **small change** each: the gap becomes *no login attached*, keyed on the column. `PersonDeskHeader.tsx:248-255` IdDot words — **small change**; its Link account / Create roster row — **none**.
- `PersonDeskAccessSection.tsx:106-111, 203-231, 314-315, 446-486, 505` — the empty state is keyed on "no users row", so a no-login users row draws the full control set: the sign-in address, *Send sign-in email*, *Set password…*, Training mode, the Sign-in row, the CountTooling seat, *Archive…* by email, *Merge a duplicate* — **real work**: a *no login attached* state with one press, *Attach a login*, and those rows hidden until it is.
- `MergeDuplicateDialog.tsx:38-99`, `mergeUserAccounts.ts:14-34` — a no-login row is always absorbable (right); `merge-users/index.ts:128` bans the absorbed auth user — **small change**: skip the ban when there is none.
- `HirePersonModal.tsx:213-233`, `hireWrites.ts:29-31, 63-82, 158-170` — Hire with no email writes a People row only, and "a salaried hire needs a login" — **real work**: the roster-only branch writes the users row too (PR 2's RPC) and the salaried rule goes.
- `pages/People.tsx:967-1005` → `invite-user` (dedups by `users.email`, deletes a pending auth user, mints a **new** id) and `hireWrites.ts:141-156` → `create-user` — **real work**: the attach path (PR 4), and the email dedup treats the no-login row as the target, not a clash.
- `TeamProspectsTab.tsx:1166` Try-out — **none**, unless the card's person already has a no-login users row (then it is the attach path). `useSettingsPeopleDirectory.ts`, `JobsSubLaborFormModal.tsx:332-369` — **none** (null-guarded).

**Invite, password, email, sign-in mail, archive**
- `accountWrites.ts:170-179` *Set password* → `set-user-password` — **filter**. `accountWrites.ts:200-210` → `change-user-email` updates the auth address first — **small change**: with no auth row, write `users.email` alone. `send-sign-in-email` — **filter**. `leaveWrites.ts:67-80` → `archive-user` (looks the target up by email, bans by id) — **small change**: look up by id, skip the ban. `sampleAccounts.ts`, `DigitalTwinsPanel.tsx` — **none** (fixtures need logins).

**Dev MCP keys**
- `20260920063130_dev_mcp_keys_and_calls.sql:14-37` (`dev_mcp_credentials.user_id → users`, insert policy `user_id = auth.uid()`), `dev-mcp/index.ts:510-524` — **none**: a no-login row can never be `auth.uid()`, so it never owns a key. `dev-mcp/index.ts:1588-1596` `view_as` by user id then a magic link by email — **small change**: refuse a no-login target with its reason.

**Mail and push**
- `_shared/webPushSend.ts:28` reads `push_subscriptions` by user; zero rows send nothing — **none**. `PersonDeskPushSection.tsx:21` and the *no push* chip (`useUsersTabRowSignals.ts:70-76`) — **small change**: say *no login*, not *no device*.
- Recipient pickers that read `users.email` as a string (`ScheduleDayEmailModal.tsx:98`, `CrewDayEmailModal.tsx:69`, `EstimateAcceptedNotifySettingsModal.tsx:58`, `PaidInFullEmailSettingsModal.tsx:170`, `BilledReportShareModal.tsx:80`, `MoneyWaitingShareModal.tsx:71`, `PaymentForecastShareModal.tsx:71`, `ScheduleShareModal.tsx:236,540`, `useSettingsTemplatesEngine.ts:251,345`) — **small change**: hold a NULL address with *no email* (`ScheduleShareModal.tsx:540` and the templates engine call `.trim()` on it and would throw). Server fan-outs (`messages-notify`, `gc-money-monday-email`, `weekly-money-email-dispatch`, `money-waiting-email-dispatch`, `schedule-day-email-dispatch`) — **small change**: the `.not('email','is',null)` guard `gmail-sync` already has. `stepLifecycleNotifications.ts:43-61` — **none** (no email → no notify).
- `notification_history.recipient_user_id → auth.users` — **small change** (a migration): re-point to `public.users`.

**Hours approvals, payroll, pay runs**
- `approvalsQueue.ts:29-37, 205-208` keys on `clock_sessions.user_id` with `users(name)` — **none**. `salaryPayConfigGate.ts`, `salariedPayrollDays.ts`, `draftPayrollPersonBreakdown.ts`, `hoursStatementRead.ts`, `loadSpending.ts`, `offsetPersonNameOptions.ts`, `cascadePersonName.ts`, `hireWrites.ts:173-184` (`people_pay_config` by `person_name`), `HoursUnassignedModal.tsx`, `ReviewHoursModal.tsx`, `PeopleHoursDayAuditModal.tsx` — **none**: every one joins by `users.id`, `people.account_user_id` or the trimmed name, none by auth or email. `import_clock_sessions` (`20261103030000`) — **none** (scenario B3).

**Last sign-in, People who left, `useAuth`**
- `describeLastSeen` (`personKey.ts:196-204`) and its readers (`PersonDeskHeader.tsx:250`, `PersonDeskAccessSection.tsx:470`, `UsersTabLensCells.tsx`, `MergeDuplicateDialog.tsx:99`, `pages/Settings.tsx:771-777`) — **small change**: one *no login* branch. `sync_last_sign_in_at` — **none** (never fires for them). `useAuth.ts:197-200`, `is_dev()`, `has_payroll_access()`, the users SELECT policy (`20260905090000`) — **none**: they read the caller's own row.
- **The 464 `auth.uid()` checks** (baseline; 4,266 across every migration) — **none**, with the reason from scenario B4: each compares the caller's id to a row's column. A user with no login can never be the caller, so an "own rows" policy never grants them anything and a role policy never sees them as a viewer; they appear only on the row side, where the dev's, the controller's and the team lead's policies already read them as they read any teammate's rows.

**`users.email` read as required**
- Schema: `email NOT NULL` + `users_email_key` — **real work** (PR 1's DDL; a placeholder address would collide with the UNIQUE and every email dedup, so NULL it is). Null-email crashes: `ScheduleShareModal.tsx:540`, `useSettingsTemplatesEngine.ts:251,345`, `PersonDeskAccessSection.tsx:225` (`u.email!`), the `email: string` casts in `Layout.tsx:465`, `ChecklistAddModal.tsx:169`, `ChecklistItemEditModal.tsx:189` — **small change** each. Edge functions keyed by email (`archive-user`, `send-sign-in-email`, `login-as-user`, `invite-user`, `create-user`, `change-user-email`) — **small change** each: look up by id.

### 4. What exists, and what #7020 becomes

The 21 People records with no login (17 live, 4 archived) each get a users row in PR 3: role from kind (`sub → subcontractor`, `helper → helpers`, `superintendent`), `email` from the record where it has one, `archived_at` copied, `login_attached_at` NULL, `people.account_user_id` set. Then `people.account_user_id` is NOT NULL and the `no_login` gap on the desk becomes "no login attached" with one press.

PR #7020 under the model:

| #7020 piece | Becomes |
|---|---|
| `people.charge_standing` | dropped — `users.charge_standing` is the one place |
| `people_pay_record_days` | dropped — a day is `clock_sessions` with `origin = 'imported'` (v2.6425), the in and out synthesized from the day and the hours; it then **flows to pay on approval** (`approve_clock_sessions_v2` → `people_hours`), which #7020 deliberately avoided — see the open question below |
| `import_person_days(jsonb)` / `approve_person_days(uuid[])` | dropped — `import_clock_sessions` and `approve_clock_sessions_v2` are the doors |
| `charge_standings()` with `person_id` rows | stays at its v2.6490 shape — the UNION over unlinked People records is empty by construction |
| `crewKeyForPerson` / `person:<id>` keys, `standingsByPersonId`, `loadPayRecordDays*`, `payRecordBreakdown`, `loginlessWords` | dropped — the crew key is always `users.id` |
| Who counts as what's "People with no login" group; the desk's Charged as for an unlinked record; the callout's `p:<id>` door | dropped — they are users rows in the existing list and the `u:<id>` door; a *no login* chip beside the name instead |
| Bed `60_person_days_scenarios.sql` | dropped; the spike's scenarios become PR 1's bed |

## The decision

**Taken 2026-11-04: the owner chose this model** ("Users-row model" to the question "the users-row model in five PRs, or ship PR 7020 as drafted"); #7020 is closed unmerged. On the open question below she takes the default. The two paths as they were put:

- **This model** (recommended): PRs 1–5 below, #7020 closed unmerged. Every worker is a users row the day they are added anywhere in the app; the days the owner drafted import through the door that exists; attaching a login later is one press that moves nothing.
- **#7020 as drafted**: ships now; a second table beside the clock, a second standing column, a `person:` key through the charges kernels, and the "no login" branch stays on every screen that lists people.

Open question with a default, not a blocker: a no-login worker's imported days reach `people_hours` on approval, as every imported day does today (v2.6425), where #7020 kept them out of pay. **Default:** let them flow — pay is computed only for a person with a `people_pay_config` row, so a worker paid from bank rows and never given a pay config shows hours and no stub; if the owner wants them out of pay entirely, PR 5 adds a `pay: false` origin the approval door skips.

## Where it plugs in

- **Exists:** `users_id_fkey` (baseline), `handle_new_user` (`20260702160000`), `sync_last_sign_in_at` (`20260703160000`), `users_guard_privileged_columns` (`20261022044606`), `roster_people` (`20261022044606`), `import_clock_sessions` (`20261103030000`), `charge_standings()` (`20261104133000`), `create-user` / `invite-user` / `send-sign-in-email` / `set-user-password` / `change-user-email` / `merge-users` edge functions, `_shared/rosterRow.ts`, `src/lib/people/accountMerge.ts`, `src/lib/people/personKey.ts` (the desk's gaps), `src/lib/people/rosterPeople.ts`, `src/lib/people/fetchActiveUsers.ts`, `src/lib/charges/*`.
- **New:** one migration (PR 1), one RPC `add_worker` (PR 2), one backfill migration (PR 3), a `user_id` field on `create-user` and an *Attach a login* press on the desk (PR 4), the sweep (PR 5).

## The plan

1. **PR 1 — the migration** (S) — **built, v2.6511**: `20261104190000_users_login_attached_at.sql` — scenario B's DDL, the two triggers, `login_attached_at` on the guard's list, `roster_people.has_login` re-pointed, the bed `supabase/tests/users_without_login/` (`scripts/pgtest-users-without-login.sh`, in `scripts/sql-beds.txt`); `invite-user`'s replace-a-pending-invite path deletes the pending users row itself, since the cascade no longer does. Nothing user-visible yet. Push after the merge, then the types PR and `supabase functions deploy invite-user`.
2. **PR 2 — Add a person makes a user** (S) — **built, v2.6514**: `add_worker(name, kind, email, phone, notes, start_date)` (`20261104200000_add_worker.sql`, SECURITY DEFINER, `is_office_staff()`) inserts the users row (role from kind, `login_attached_at` NULL) and the People record linked to it in one transaction; the seven writers in *What was true* and Hire's roster step call it through `src/lib/people/addWorker.ts`; a salaried hire no longer needs a login; the Users tab's chip and Imitate read `login_attached_at`. The `people.account_user_id IS NULL` branches start going quiet.
3. **PR 3 — the backfill** (S) — **built, v2.6517** (`20261104210000_people_without_users_backfill.sql`, `backfill_users_for_people()`, bed X1–X8): a migration that gives the 21 unlinked People records their users rows (role from kind, the address where no login holds it, `archived_at` carried; a record whose name another users row carries is skipped and named, since the pay tables key on the name). `people.account_user_id` stays nullable: its key is `ON DELETE SET NULL` and `combinePeople` nulls a source's account, so NOT NULL would refuse both; `roster_people` keeps `'external'` as the guard that shows a straggler. The desk's Merge a duplicate finds no roster-only subs after this and PR 5 re-points it at no-login users through `merge_user_accounts`. Push after the merge.
4. **PR 4 — Attach a login** (M): `create-user` takes `user_id` and passes it as `id`; the desk's Access section offers *Attach a login* (email, then the sign-in mail through `send-sign-in-email`); the invite flow on People → Users offers the same for a row with no login; Who counts as what and the roster show a *no login* chip. Deploy `create-user` after the merge. **Live walk on a `ZZ Test` person**: attach, sign in by the link, reset the password, take the login away, attach again — the user id and the test clock session never change. The fallback if GoTrue refuses the id on prod: create then merge (v2.4346).
5. **PR 5 — the sweep** (S): the items in Evidence 3 marked *small change* and *filter*; `notification_history.recipient_user_id` re-pointed to `public.users`; the fan-outs skip a recipient with no login; the import of the owner's drafted days runs through `import_clock_sessions` once their people have ids (a dev's run, nothing of it in the repo).
6. **Close #7020** unmerged, with a line in its PR naming this card; its bed scenarios' refusals already live in the clock bed (v2.6425).

## How to verify

- PR 1: `bash scripts/pgtest-users-without-login.sh` green locally (`PGTEST_PGBIN=/usr/local/opt/postgresql@15/bin PGTEST_PORT=<free port>`) and in the SQL beds workflow; after the push, `npm run check:migration-drift` clean and every existing login reads `login_attached_at` not null.
- PR 2: People → Users → Add to roster with no email makes one users row and one linked People record; the person appears in Who counts as what with a *no login* chip and in no invite or password control; the hours grid, the approvals queue and the Costs tab read a clock session imported for them.
- PR 4: the `ZZ Test` walk above; `people.account_user_id` and `clock_sessions.user_id` identical before and after each step; `users.last_sign_in_at` set after the first sign-in.
- The whole: the job from #254's first pricing reads every crew day priced once the owner sets the no-login people's Charged as in Who counts as what.

## Found along the way

- **Taking a login away deletes the worker's days today** (scenario A2): `auth.admin.deleteUser` cascades through `users_id_fkey` and `clock_sessions_user_id_fkey`. The archive flow bans rather than deletes, so it has not bitten; PR 1's detach trigger closes it for good.
- **The Hiring Try-out door makes a login with no People record** (`create-user`, `skip: Boolean(trialCard)`); under the model every users row has one, so PR 2's RPC gives it one.
- **`users.email` is NOT NULL today** with a UNIQUE; a worker with no address needs the NULL. The client reads of `users.email` that assume a string are in Evidence 3.
