# Salaried-people research notes (working doc)

> Session working doc, started 2026-07-13. Update the **Changes made today** section as we go.
> Untracked scratch file — decide at end of day whether anything here should be folded into
> `docs/SALARY_CLOCK_SESSIONS.md` / `docs/GLOSSARY.md` or deleted.

---

## Changes made today (2026-07-13)

Decisions: payroll math changes ARE in scope; paid time off is salaried-only.

- **PR #266 — MERGED + APPLIED to prod** (user-authorized `db push`; ledger 57/57 aligned):
  migration `20260713120000` — `user_time_off.kind` now allows 'paid';
  `people.start_date`/`end_date` added.
- **PR #267 — MERGED**: Employment tab (left of Hours, canAccessPay) — roster master–detail +
  employment-dates card + `manage-employment.md` help guide. Types verified against linked
  schema (`people` block identical to generated).
- Note: salary sync's time-off EXISTS check ignores `kind` — paid time off clears schedule
  sessions exactly like unpaid, no DB function change needed (verified in baseline SQL).
- **PR #269 — MERGED**: Employment tab pay setup + salaried workday cards (+ fix: payConfig now
  loads when Employment tab opened directly). NB: squash also carried a parallel session's
  map-filter commit.
- **PR #271 — MERGED/armed**: Time off card (paid + unpaid, paid salaried-only) + kind-aware
  labels (`timeOffKindLabel`) in Calendar, My Time day editor, Settings.
- **PR #272 — MERGED/armed**: payroll wiring — new kernel `src/lib/salariedPayrollDays.ts`
  (11 tests): salaried credit = 8/0 − unpaid time-off weekdays (paid keeps 8; unpaid wins on
  overlap), clamped to `people.start_date`/`end_date`. Wired: generatePayStub, Draft Payroll
  preview (getPayrollEffectiveHours wrappers), breakdown drilldown (reason annotations).
  Legacy stub view/print fallbacks + cost surfaces intentionally unchanged.
  **→ Gotcha #8 (unpaid time off still paid) is FIXED for new stubs.**
- **Docs PR**: SALARY_CLOCK_SESSIONS.md payroll section rewritten (two rule tiers), user_time_off
  kind semantics updated. Help guide `manage-employment.md` shipped/extended across PRs 2–4.
- **PR #277**: Employment tab excludes subcontractors (`kind='sub'`) — not employees; all other
  kinds stay. Guide updated.
- **PR #277 — MERGED**: Employment tab roster fixed — now the users+people union (was people-table
  only, which hid everyone with a login account: helpers/masters/assistants/devs/estimators);
  subcontractors excluded (not employees). Date saves auto-create a linked `people` row for
  user-only entries so the payroll employment-window clamp works for them.
- Follow-ups deliberately NOT done: cost surfaces still flat 8/0 (job costing ignores time off /
  employment window); PR #182 (salariedEffectiveHours kernel + >20:00 wall-clock fix + stranded
  migration) still open — merging it remains the cleanup for gotchas #1–3.

---

## Status check (2026-07-14, session start)

Verified against origin/main @ `a74931e` (v2.670):

- **PR #182 MERGED** 2026-07-13 17:47Z (`e5f3321`) — the "still open" note above is stale.
  Gotchas **#1, #2, #3 are FIXED**:
  - `src/lib/salariedEffectiveHours.ts` + tests on main; now used by `People.tsx`,
    `CrewJobsBlock`, `HoursUnassignedModal`, quickfill `HoursSection`,
    `QuickfillUnassignedFieldTimeSection`, `useCostMatrixTotal`.
  - `salaryZonedWallClock.ts` scan widened to −840..+2160 min (late-evening bug gone), tests added.
  - Dead-artifacts migration landed as `20260713170000_drop_dead_salary_artifacts.sql`;
    `npm run check:migration-drift` → 67/67 aligned.
- **Still inline 8/0** (kernel NOT yet adopted): `src/utils/teamLabor.ts` (3 sites),
  `src/lib/people/derivePersonTeamSummary.ts` (3 sites). `peopleHoursUnallocatedRows.ts`
  keeps its deliberate showed-up gate.
- **Doc rot from the merge**: `docs/SALARY_CLOCK_SESSIONS.md:37` still says the kernel
  "exists only on the open PR #182 branch". No RECENT_FEATURES entry for #182.
- **New since this doc** (pay-visibility overhaul, v2.660–2.665, PRs #308–#315):
  - `controller` role — assistant-like, dev-level money visibility; gets `canAccessPay`
    (`usePeopleAccess.ts:40`) so controllers see the Employment tab + payroll surfaces.
  - Assistants can never read individual pay (v2.660); pay-approved-master assignment no
    longer changes role (v2.661).
- Still open: gotchas #4 (no guide for template setup / On-shift / 8-0 rule —
  `manage-employment.md` exists but is Employment-tab-scoped), #5 (GLOSSARY path rot),
  #6 (record_hours_but_salary display inconsistency), #7 (dead selection — recheck, #182
  touched `useCostMatrixTotal`); cost surfaces still flat 8/0 (deliberate deferral).

---

## The model in one paragraph

There is **no stored salary amount**. A salaried person = `people_pay_config.is_salary = true`,
and pay/cost math is **`hourly_wage` × flat 8 h on weekdays, 0 on weekends** — always, regardless
of clock sessions. Separately, a **workday template** auto-materializes `clock_sessions` rows
(`origin = 'salary_schedule'`) that drive what the calendar/dashboard *display*. The two systems
do not feed each other (one deliberate exception below).

## Flags on `people_pay_config`

| Flag | Effect |
|------|--------|
| `is_salary` | Flat 8/0 credit in all payroll/cost surfaces; dashboard clock UI switches to On-shift mode (when a template also exists) |
| `record_hours_but_salary` | Display/editability only: Hours grids show + allow editing logged hours; **every dollar stays on flat 8/0** |
| `office_hourly_wage` | Ignored when salaried (dual office/field rate is hourly-only; UI disables the field) |

- Column comment (baseline schema): "When is_salary: allow entering hours in Hours tab for
  record-keeping; payroll and job cost still use salary (8 hrs/day)."
- Toggling `is_salary` in `usePayConfig.upsertPayConfig` has side effects: false→true syncs today's
  sessions immediately; true→false calls RPC `pay_staff_clear_salary_schedule_by_person_name`
  (deletes template + overrides, re-syncs).
- **No FK anywhere**: everything joins on `trim(users.name) = people_pay_config.person_name`.
  A rename breaks sync/gating/pickers (UIs show "no matching user" hints).

## Schedule templates → auto sessions (display system)

- Tables: `salary_work_schedule_templates` (continuous 8 h block, or split A+B summing to exactly
  8 h; timezone (4 US zones, default America/Chicago); `exclude_weekends` default true) and
  `salary_work_schedule_day_overrides` (per-date; ordinary users today-only, dev/master/assistant
  any date).
- Sync function: `salary_sync_one_user_clock_sessions` (authoritative body =
  migration `20260515092032`, identical tail `20270601000000`). Entry points:
  - pg_cron → Edge `sync-salary-sessions` (CRON_SECRET, `verify_jwt=false`) every ~5 min for d-1 and d
  - 90-second interval in `ClockInOutButton.tsx` while salaried UI is active
  - after Settings → Salaried workday save, pay-config flips, "not coming in" undo, etc.
- Row shape: continuous day = one NULL `salary_segment_index` row; split = indexed rows 1/2;
  My Time splitting a continuous row yields indexed `salary_schedule` fragments 1..N; splitting an
  *indexed* slot yields `user_punch` children.
- Since v2.529: **approval is not terminal for sync** — approved-but-open salary rows still close at
  template end; only `rejected_at`/`revoked_at` stop sync.
- Unpaid `user_time_off`, missing template, or excluded weekend ⇒ non-final salary rows for the day
  are deleted. Resolution order: time off → weekend exclusion → day override → template.
- RLS: client INSERTs must be `origin='user_punch'`; salary rows only via sync/RPCs.

## Payroll / cost (the flat 8/0 rule) — where it lives on main

The 8/0 conditional is **re-derived inline** in each surface (see Gotchas #1):

- `src/pages/People.tsx:2580` `getEffectiveHours` (+ `canEditHours`, `getDisplayHours`,
  `getHoursGridDisplayHours` ~2590–2617; passed as props to extracted sections) and pay-stub
  generation `~:1531`
- `src/utils/teamLabor.ts:88,199,272`
- `src/hooks/useCostMatrixTotal.ts:86–94`
- `src/lib/draftPayrollPersonBreakdown.ts:74–79`
- `src/components/quickfill/HoursSection.tsx:315–334`
- `src/components/CrewJobsBlock.tsx:176,702`
- `src/lib/people/derivePersonTeamSummary.ts:81,190,230`
- `src/components/HoursUnassignedModal.tsx:191–204` (checks `record_hours_but_salary` first)
- `src/lib/peopleHoursPendingByCell.ts:57–72` (skips salary-only people for pending badges)
- DB-side mirror: `get_man_hours_by_job()` RPC (v2.592) — salaried = 8 h Mon–Fri

**Deliberate deviation**: `src/lib/peopleHoursUnallocatedRows.ts:169–185` — salaried get the 8 h on
a weekday **only if ≥1 approved closed clock session exists that day** ("showed up" gate, v2.546;
kills phantom 8 h rows).

Pay stub math for salaried = 8 × weekdays-in-period × `hourly_wage`; dual-rate path skipped.
Draft payroll reads approved `people_hours` only; pending sessions never move payroll (v2.597/599).
Payroll ledger "upcoming" segment (v2.611) uses all clock time — salaried flow through their
materialized sessions, no special branch.

## Salaried user experience

- **No manual punching**: `ClockInOutButton.tsx` — `salaryUiActive` requires `is_salary` AND a
  template row; clock in/out suppressed; "Update focus" updates the open salary session **in place**
  (hourly: close + insert new). Mercury tally clock-out gate is non-salary only.
- Team strips / Schedule Dispatch show an "(s)" suffix; dashboard strip fabricates a synthetic
  on-shift entry client-side if sync hasn't materialized the row yet (`salaryOnShift.ts`,
  `useDashboardMyTeamSectionState.ts:1219–1283`).
- Settings → Salaried workday appears when `myRole === 'dev'` or self is salaried in pay config;
  devs get an all-users picker. Template editor **cannot set job/bid focus** (upsert hard-codes
  nulls; users directed to Update Focus).
- `SalariedWorkdaysBulkModal.tsx` = bulk **unpaid time off** across salaried people
  (`pay_staff_bulk_insert_user_time_off`) + one-at-a-time embedded schedule editor.
- Calendar: optional "Show my workday" layer (localStorage, off by default since v2.558);
  green scheduled chips visible to dev/master/assistant/primary/superintendent (not sub/estimator).

## Setting someone as salaried (two independent parts)

1. **Pay flag** — People → Pay config modal → "Salary" checkbox → `usePayConfig.upsertPayConfig`
   (2 s debounce → upsert `people_pay_config`). Flip on: immediate `sync_salary_clock_sessions_for_user_day`
   for today (toast if no matching login user). Flip off: RPC `pay_staff_clear_salary_schedule_by_person_name`
   (deletes template + overrides, re-syncs). **The flag alone switches all pay/cost math to flat 8/0.**
2. **Workday template** — Settings → Salaried workday (self when salaried, or dev via picker).
   Only flag+template together activate the no-punch dashboard UI and auto-sessions. Template controls
   display only, never pay.

## Unpaid time off flow (`user_time_off`, kind='unpaid', inclusive CT dates)

Entry points (all re-run salary sync for affected days):
- Self: Settings → scheduling tab `TimeOffSettings.tsx` (add-range form + "Not coming in today");
  Dashboard "not coming in" button.
- Leaders: Schedule Dispatch / user review / quickfill "not coming in" (`notComingInTimeOff.ts`).
- Pay staff bulk: `SalariedWorkdaysBulkModal` → RPC `pay_staff_bulk_insert_user_time_off`.

Effect: sync **deletes** non-final `salary_schedule` sessions for those dates → purple calendar chip,
no workday blocks, off the on-shift strip, and the **upcoming-payroll forecast** drops those hours
(`upcomingPayrollSummary.ts` sums real sessions).

## Small salary libs (`src/lib/`)

| File | Role |
|------|------|
| `salaryScheduleSync.ts` | Client RPC wrappers; `denverWorkDateToday()` (misnamed — it's Chicago) |
| `salaryOnShift.ts` | Template+override → UTC windows; synthetic on-shift computation |
| `salaryPayConfigGate.ts` | user_id → salaried set via name join; filter stale salary-origin sessions |
| `salaryZonedWallClock.ts` | Wall clock in tz → UTC ms (⚠ bug, see Gotchas #2) |
| `salarySplitBreakDerivedStart.ts` | Split-day break math (B start = A end + break) |
| `salaryScheduleEndTimeDisplay.ts` | End-time labels (`+1 day` etc.) |
| `buildSalariedWorkdayPickerRows.ts` | Salaried names → {personName, userId} picker rows |

## Gotchas / open issues found (2026-07-13)

1. **Stale doc + unmerged kernel**: `docs/SALARY_CLOCK_SESSIONS.md:29` claims a centralized,
   unit-tested kernel `src/lib/salariedEffectiveHours.ts` ("do not re-derive the 8/0 inline").
   That file exists only on branch `chore/salaried-cleanup` — **PR #182, open since 2026-07-03**.
   On main the rule is inlined in ~8 places (list above).
2. **Live bug on main**: `src/lib/salaryZonedWallClock.ts:46` scans only −7h..+25h from UTC
   midnight ⇒ Chicago wall times after ~20:00 return `null`; a late-evening split segment silently
   gets no window. Fix is stranded in PR #182.
3. **Migration applied to prod from the unmerged branch**: `20260704150000_drop_dead_salary_artifacts.sql`
   (commit `52f1460` on PR #182) — the exact drift pattern CLAUDE.md forbids. Merging #182 resolves it.
4. **Zero help guides** cover any salaried surface (template setup, On-shift dashboard,
   `record_hours_but_salary`, 8/0 rule, bulk time-off modal) despite the guides-ship-with-features rule.
5. Doc rot: `GLOSSARY.md:964` cites `src/lib/teamLabor.ts` (actual: `src/utils/teamLabor.ts`);
   `denverWorkDateToday` named Denver, anchored Chicago.
6. Visual inconsistency: a `record_hours_but_salary` person's payroll drilldown shows flat 8.00/day
   while the Hours grid shows their logged hours (correct cost semantics, confusing display).
7. Dead selection: `useCostMatrixTotal.ts:57` and `QuickfillUnassignedFieldTimeSection` fetch
   `record_hours_but_salary` but never branch on it.
8. **"Unpaid" time off never reaches the paycheck** (found 2026-07-13): no payroll/cost surface
   queries `user_time_off`. Pay stubs (`People.tsx:1531`) and draft payroll
   (`draftPayrollPersonBreakdown.ts:74`) credit salaried people 8 h for every weekday in the
   period regardless of time off; deleting the schedule sessions doesn't matter because salary
   pay math never reads sessions/`people_hours`. Only the upcoming-payroll **forecast**
   (`upcomingPayrollSummary.ts`) reflects time off (it sums real sessions) — so forecast and
   generated stub contradict each other for a time-off week. No manual per-day override exists
   to correct a stub (salaried hours aren't editable; `record_hours_but_salary` is display-only).

## Proposed: "Employment" tab in People (left of Hours) — 2026-07-13, not started

Motivation: managing a salaried person is disjoint (pay flags in Hours-tab modal, template in
Settings, time off in 3 places, no employment dates anywhere, payroll ignores time off).

Design: master–detail. Roster list (active/archived, salaried chip, template indicator,
name-join vs `people.account_user_id` link-health warning) + per-person cards:
1. **Employment** — start/end date (new `people.start_date`/`end_date` columns), kind, archive.
2. **Pay setup** — pay-config fields, replacing the cramped modal.
3. **Salaried workday** — embed `SalaryWorkScheduleSettings` (bulk modal proves the pattern).
4. **Time off** — paid + unpaid ranges (⚠ `user_time_off_kind_check` currently allows ONLY
   'unpaid' — needs widening migration before "paid" can exist).

Rollout (ship-small): (1) migration: widen kind check + add people date columns (additive,
idempotent); (2) tab skeleton + employment card; (3) pay setup card; (4) time off card + bulk;
(5) payroll wiring PR — unpaid subtracts from salaried 8/0, employment window clamps credit
(fixes gotcha #8); (6) help guide (required). Gate = `canAccessPay`; build as extracted
components per PAGE_DECOMPOSITION_PLAYBOOK.

**Open decisions (user):**
- Wire payroll math in this effort (recommended) or display-only first?
- Paid time off for hourly people: informational only (recommended) vs credits hours in payroll?

- `docs/SALARY_CLOCK_SESSIONS.md` — authoritative sync-behavior runbook (migration index inside)
- `docs/PROJECT_DOCUMENTATION.md` — schema (`clock_sessions` origin/segment index, salary tables)
- `docs/GLOSSARY.md` — salaried auto-sessions, unassigned field time formula, man-hours RPC
- `docs/RECENT_FEATURES.md` — version history: v2.204 foundation → v2.529 drift repair → v2.546
  showed-up gate → v2.592 man-hours RPC → v2.611 payroll ledger
- `docs/EDGE_FUNCTIONS.md` — `sync-salary-sessions`
- `docs/ACCESS_CONTROL.md` — calendar salary-chip visibility by role
