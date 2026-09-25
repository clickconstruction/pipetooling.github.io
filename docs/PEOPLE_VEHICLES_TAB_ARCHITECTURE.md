# People Vehicles Tab Architecture Map

---
file: docs/PEOPLE_VEHICLES_TAB_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map for the sub-decomposition of src/components/people/PeopleVehiclesTab.tsx (2,946 lines) per PAGE_DECOMPOSITION_PLAYBOOK.md. It is the People → Vehicles fleet board, a People tab that was already extracted and has since grown back from ~235 lines (its size at extraction). The map lists every region (state, memos, effects, loaders, tables, extracted sub-components, coupling, test coverage) so extraction can go ahead without re-reading the whole file.
covers:
  - src/components/people/PeopleVehiclesTab.tsx
mapped_at: a05cef4c4
audience: Developers, AI Agents
last_updated: 2026-09-25
---

> **Line numbers are as of `a05cef4c4`** (the `mapped_at` commit) and move with every edit, so search for the symbol named beside each range. Regenerate the fact sheet with `npm run map -- src/components/people/PeopleVehiclesTab.tsx`.

## What this surface is

[`src/components/people/PeopleVehiclesTab.tsx`](../src/components/people/PeopleVehiclesTab.tsx) is the **Vehicles** tab of the People page, the office's fleet board. The **board** shows one card per vehicle with its holder and since-date, latest odometer and freshness, oil, problem and task chips, and an insurance line. The cards sit in Active/Inactive groups under a search box and a fleet strip (a facts line plus a Needs-attention list with two catch-up buttons). The header holds **+ Add Vehicle**. The strip's facts line opens the **Insurance plans** manager and, for devs only, ⚙ **Check-in settings**; devs also get the **Wheels** section below the board. Clicking a card **replaces the board with the vehicle panel**: header chips and actions, an autofocused quick odometer entry, an Insurance card (plan status plus cost per wk/mo/yr), Open problems, Maintenance tasks bridged to Checklist, and a unified **Ledger** with filter pills. The file renders 13 inline dialogs and mounts 3 extracted modals.

- **Mount:** `People.tsx` 4103–4105 `activeTab === 'vehicles' && canAccessVehicles` → `<PeopleVehiclesTab users={users} />`. It mounts only while active. Route `/people` (ROUTES.md → `src/pages/People.tsx`), tab `?tab=vehicles`. There is **no vehicle-id URL param**: incoming links (checklist item `links: ['/people?tab=vehicles']` at 1011, `VehicleTaskContextModal.tsx` 221, `lib/people/lifecycleChecklist.ts` 280) land on the board. Imported by `People.tsx` and `PeopleVehiclesTab.render.test.tsx`.
- **Gate:** `canAccessVehicles` (`usePeopleAccess.ts` `applyRole` 50–104) is true for dev, controller, assistant and pay-approved master_technician. RLS mirrors it: `is_dev() OR is_pay_approved_master() OR is_assistant()`, and `is_assistant()` includes controller.
- **Props (`PeopleVehiclesTabProps` 101–103):** `{ users: UserRow[] }` only. The tab has no callbacks, no refs and no parent-owned state, and loads everything itself. `users` feeds name resolution, the hand-off/assign pickers and a local `isDev` (1195, the viewer's `role` looked up in `users`).
- **Hook census (fact sheet @ a05cef4c4):** 95 `useState` · 0 `useReducer` · 3 `useEffect` · 18 `useMemo` · 0 `useCallback` · 1 `useRef` (`quickOdoRef` 159) · 3 custom hooks (`useAuth` 143, `useConfirmDialog` 144, `useToastContext` 145) · 38 handlers/inner functions · 18 local imports. The component `PeopleVehiclesTab` spans 142–2946 (2,805 lines) and its render 1356–2945 (1,590). Module scope holds `Vehicle` 82–94, `UserRow` 96, `PanelCheckin` 99, `LEDGER_FILTERS` 105–114, `todayYmd` 116–119, `MOTOR_POOL_OPTION` 122, `initials` 124–127 and `formatYmdShort` 129–140. Churn: 26 commits in 90 days; last commit 2026-09-06 `25873683e`.
- **Data:** 14 tables. `vehicles`, `vehicle_insurance_plans`, `vehicle_possessions`, `vehicle_odometer_entries`, `vehicle_service_events`, `vehicle_problem_reports`, `vehicle_insurance_periods`, `vehicle_maintenance_tasks`, `vehicle_replacement_value_entries` and `vehicle_checkins` belong to the fleet. `checklist_items`, `checklist_instances`, `checklist_item_assignees` and `checklist_instance_assignees` carry the task bridge. Indirect data: `app_settings` (via `vehicleCheckinSettings`), RPC `get_user_display_names` (via `fetchUserDisplayNames`), and `checklist_item_assignees` reads (via `getNextDisplayOrders`). No direct RPCs and no edge functions.

| Largest blocks | Symbol | Lines |
|---|---|---|
| Vehicle panel render | `selectedVehicle ? …` branch | 1400–1938 (539) |
| Board render | IIFE with `renderVehicleCard` + groups | 1940–2081 (142) |
| State block | 95 `useState` | 146–257 (112) |
| Fleet loader | `loadFleet` | 386–479 (94) |
| Assign-task write chain | `submitAssignTask` | 988–1053 (66) |
| Dialogs | 13 inline dialogs + 3 extracted-modal mounts | 2087–2943 (~857); the biggest are check-in settings 2525–2629 (105), add-to-plan 2677–2771 (95), vehicle form 2087–2180 (94) and plans manager 2432–2522 (91) |

This is a **sub-decomposition** map. The parent [`PEOPLE_TABS_ARCHITECTURE.md`](./PEOPLE_TABS_ARCHITECTURE.md) row `vehicles` links here.

---

## Master summary table

| Region | Anchor (symbol · lines) | ~Lines | Coupling | Risk | Status | Tests |
|---|---|---|---|---|---|---|
| A. Fleet data engine | fleet state 146–150, 180–181, 204, 233, 243, 257 · memos 258–336 · `resolveExtraNames` 372–384 · `loadFleet` 386–479 · mount effect 512–516 | ~250 | **highest**: every region reads it; 20 call sites reload it | med as a hook | inline; per-row kernels extracted | kernels `vehicleFleet.test.ts` (43), `userDisplayNames.test.ts` (2); loader only through the render smoke |
| B. Board | `search` 151 · memos 338–368 · style helpers 1287–1309 · `renderHolderRow` 1311–1354 · header/strip 1356–1397 · board IIFE 1939–2082 | ~270 | med: reads A, writes the selection, opens the D/G/H/I/J dialogs | low | inline; strip **extracted** (`VehiclesFleetSummary`) | render smoke (cards, groups, strip, chips); `vehicleFleetAttention` (3); `weeklyTotal` untested |
| C. Vehicle panel + quick odometer + ledger | `selectedVehicleId` 152 · panel state 153–159, 186, 234, 244 · `loadPanel` 481–510 · effect 518–533 · `saveQuickReading` 535–557 · `deleteLedgerRow` 1216–1247 · `ledgerRows`/`visibleLedgerRows` 1249–1285 · render 1400–1555, 1847–1936 | ~430 | high: owns the selection and the panel loader, which F reads | **med-high** (loading-branch unmount, no stale guard) | inline; ledger merge extracted | `buildVehicleLedger` kernel tests; smoke opens the panel; filter aliasing, delete→table map and `saveQuickReading` untested |
| D. Insurance | state 169–171, 182, 187–202 · handlers 703–824, 1055–1077 · render 1557–1656, 2432–2522, 2631–2675, 2677–2771, 2909–2943 | ~560 | med: dialogs opened from B, C and the plans manager; reads A's plans/periods | **high (money)**: `weekly_insurance_cost` feeds pay stubs + Wheels | inline; cost math extracted | `vehicleInsuranceCost.test.ts` (4), period kernels; smoke checks card lines/buttons; write handlers untested |
| E. Maintenance tasks + Checklist bridge | state 207, 217–227 · handlers 826–893, 920–1053 · render 1719–1845, 2806–2855, 2856–2907 | ~470 | med: writes F's service-form state; opened from J | **high**: 6-step non-atomic checklist chain | inline; counts/title/cleanup ids extracted | 5 kernel tests (counts, title, marker, cleanup ids, ledger); smoke checks the section; write chain untested |
| F. Service · problems · value | state 229–231, 235–241, 245–251 · handlers 1079–1193 · render 1462–1489, 1658–1717, 2256–2430 | ~370 | med: panel-scoped; reads C's `panelProblems`; calls E's `addMaintenanceTask` | low-med | inline | oil/service/problem kernels; smoke checks buttons + rows; forms untested |
| G. Vehicle add/edit/delete | state 161–167, 172, 252–254 · 559–633 · Escape effect 580–588 · render 2087–2180 | ~180 | low | low-med (`weekly_registration_cost` → pay stubs; delete cascades) | inline | oil-threshold tests cover `oilStatus` options; `oilThresholdsForVehicle` only indirectly (via `fleetOilCounts`); payload/validation untested |
| H. Hand-off / motor pool | state 174–178 · `MOTOR_POOL_OPTION` 122 · `openHandOff` 635–640 · `submitHandOff` 642–701 · render 2182–2254 | ~145 | low-med: opened from the card (1347) and the panel (1459) | med: 3 non-atomic writes | inline; write plan extracted | `handOffWrites` (3), `currentPossession` + motor-pool tests; smoke counts buttons |
| I. Check-in settings (dev) | state 183–185 · `isDev` 1195 · 1197–1214 · render 2524–2629 | ~130 | low | low | inline | `vehicleCheckinSettings.test.ts` (3); dialog untested |
| J. Catch-up + odometer history | state 211–214, 216 · 895–918 · mounts 2773–2805 | ~60 inline | low | low | **modals extracted** (`VehicleCatchUpModals` 312, `VehicleOdometerHistoryModal` 206) | `vehicleCatchUp` (2), `vehicleOdometerHistory` (5); smoke drives the history sheet; catch-up modals have no render test |
| K. Wheels (dev) | mount 2083–2084 | 2 inline | none (props: `users`) | low | **extracted** (`PeopleVehiclesWheelsSection`, 303) | `lib/people/wheels` (10), `wheelsData` (8); no render test |

Test inventory: `PeopleVehiclesTab.render.test.tsx` has **one** `it` (177 lines). Its supabase mock ignores filters, so every `eq`/`in`/`is` returns the whole table. It covers board cards, holders, groups, the strip, insurance lines, task chips, the odometer-history sheet (open, add reading, close), and the opened panel (quick entry, ledger rows, service/problem/maintenance blocks). No e2e spec covers Vehicles; `viewport-smoke.spec.ts` only visits `/people`.

---

## Per-region dossiers

### A. Fleet data engine — shared substrate (becomes a hook)

- **Render location:** none of its own. Its maps feed B's cards, C's header chips, D's plans manager, the J mounts and the `VehiclesFleetSummary` inputs 1382–1393.
- **Owned state:** `vehicles` 146, `loading` 147, `error` 148 (the shared error line; 22 handler writers plus the `setError` prop passed to `ChecklistItemActivity` 1800), `possessionsAll` 149, `latestByVehicle` 150, `insurancePlans` 180, `insurancePeriodsAll` 181, `maintenanceTasksAll` 204, `openProblemsByVehicle` 233, `lastOilByVehicle` 243, `extraNames` 257.
- **Memos:** `userNameById` 258–264 (roster + archived extras), `today` 265 (**not a memo**; `todayYmd()` runs on every render), `holderByVehicle` 267–277, `latestMap` 279–283, `insuranceByVehicle` 285–295, `planNameById` 297, `uninsuredCount` 299–302, `taskCounts` 304, `openTaskTotal` 305–309, `summary` 311–314 (`fleetSummary`), `lastOilMap` 316–320, `oilCounts` 322–325, **`weeklyTotal` 328–336** (money: Σ `effectiveWeeklyInsuranceCost(cost, onPlan)` + `weekly_registration_cost`, the D5 rule). Derived `selectedVehicle` 370 is a plain `find`.
- **Loader `loadFleet` 386–479:** it sets `loading` true, loads `vehicles` ordered by year (no limit), and sets `loading` **false at 390, before the remaining reads**. Next come `vehicle_insurance_plans` (loaded even when the fleet is empty) and a 6-query `Promise.all` 408–441: possessions (no limit); odometer, oil-change service events, unresolved problems, insurance periods and maintenance tasks, each `.limit(2000)`. It then groups: `openProblemCounts` → Record 444–446, `lastOilChange` per vehicle 455–466, `latestReading` per vehicle 467–478. `resolveExtraNames` covers possession and reading users 451–454. Only the `vehicles` error is surfaced; the other reads fail soft to `[]`. There is no request-id or stale guard.
- **Callers:** mount effect 512–516 (80 ms timeout, `[]` deps), 18 write handlers (556 … 1246) and the odometer-history `onAdded` 2782. None of them await it.
- **Extraction:** `useVehicleFleet(users)` returns the same names (state, setters used outside: `setVehicles` for the in-place cost patch 773, `loadFleet`, the memos). Move the grouping code into kernels first (Stage A). Keep the `loading` semantics exactly (see Hazards).

### B. Board

- **Render:** title + **+ Add Vehicle** 1359–1370; search 1371–1379; `VehiclesFleetSummary` 1381–1396 (`fleetFactsLine`, `buildFleetAttentionItems`, `onInsurancePlans`, dev-only `onCheckinSettings`, `onOpenReadings`, `onOpenTasks`); error line 1397; board IIFE 1939–2082. Inside it: `renderVehicleCard` 1941–2050 (the holder row via `renderHolderRow` 1311–1354; the odometer line button → `setOdoHistoryVehicleId` 1976–1989; freshness/oil/problem/task chips 1993–2008; the insurance line with "still insured while parked" / "off since" and **Add to plan / Change** 2010–2047), plus `groupHeader` 2051–2058, the Active/Inactive grids 2062–2073 and empty copy 2074–2078.
- **Owned state:** `search` 151. **Memos:** `filteredVehicles` 338–350 (`vehicleMatchesSearch` with the holder name or `MOTOR_POOL_LABEL`), `activeVehicles` 353–360 and `inactiveVehicles` 361–368.
- **Helpers:** `chipStyle` 1287–1297, `oilChipToneFor` 1299–1300, `actionBtn` 1302–1309. B, C, D, E and the dialogs all use them.
- **Writes:** `selectedVehicleId` (card click 1952/1956). **Opens:** hand-off (1347), add-to-plan (2040), odometer history (1980), plans manager (1383), readings catch-up (1394), tasks catch-up (1395), check-in settings (1384), vehicle form (1364).
- **Extraction:** `VehicleFleetBoard` + `VehicleCard`, with the filtered lists, the A maps and opener callbacks as props. Move `chipStyle`/`actionBtn` into a shared `vehicleUi.ts` first.

### C. Vehicle panel shell + quick odometer + ledger

- **Render (1400–1938):** `← All vehicles` 1402–1408; header 1410–1495 with the name/trim/VIN, a holder chip IIFE 1419–1436, an oil chip 1437–1446, an insurance chip 1447–1456, and an action row 1458–1494 (Hand off/Assign → H, Log service / Report problem / Update value → F, Edit / Delete → G). Then the quick odometer card 1497–1555 (`quickOdoRef`, Enter saves), D's Insurance card 1557–1656, F's Open problems 1658–1717, E's Maintenance 1719–1845, and the **Ledger** 1847–1936: `LEDGER_FILTERS` pills 1851–1868; rows 1877–1934 with an inline kind→chip tone/label chain 1893–1916, a value column 1920–1922, and × delete unless the kind is `return`/`problem_resolved`/`insurance_off` 1923.
- **Owned state:** `selectedVehicleId` 152 (**the selection pointer**), `panelReadings` 153, `panelValues` 154, `ledgerFilter` 155, `quickOdoValue`/`quickOdoDate`/`savingReading` 156–158, `quickOdoRef` 159, `panelCheckins` 186, `panelProblems` 234 (also read by F), `panelServiceEvents` 244.
- **Effect 518–533 `[selectedVehicleId]`:** on select it resets the filter and quick entry, calls `loadPanel` (no cancel) and focuses after 50 ms; on deselect it clears the five panel arrays.
- **Loader `loadPanel` 481–510:** 4 unbounded per-vehicle reads (odometer, values, service, problems). `vehicle_checkins` is wrapped in try/catch and **fails soft** (492–503). It then resolves names for reading authors, reporters and check-in authors. Callers: the effect plus 7 handlers (8 call sites; `deleteLedgerRow` has two).
- **Memos:** `ledgerRows` 1249–1270 = `buildVehicleLedger` over the panel arrays + A's possessions/periods/tasks filtered to the vehicle. The check-in label is built inline 1261–1268 (`checkinLedgerBody` → "Check-in · all clear" / "⚠ Check-in · … · problem report filed"). `visibleLedgerRows` 1272–1285 applies the filter with 4 alias pairs.
- **Handlers:** `saveQuickReading` 535–557 (`parseOdometerInput`, insert, then reload panel + fleet). `deleteLedgerRow` 1216–1247: check-in rows reload the panel only; other kinds use a 7-way kind→table ternary 1226–1239, then reload panel + fleet.
- **Extraction:** last (step 11). Before `VehiclePanel` moves, either keep the panel's state in the tab or change the `loading` branch to first-load-only **in its own PR** (Hazards §effects).

### D. Insurance (plans, coverage periods, weekly cost)

- **Render:** panel Insurance card 1557–1656 (status + **Change plan / Take off** or amber **Not on insurance / Add to plan**; the cost line uses `formatInsuranceCostLine`, "$0.00/wk while off a plan · last cost …", or "no cost set"; an amount + unit select with a "saved as $X / wk" preview when unit ≠ wk; **Save cost**). Plans manager 2432–2522 (per plan: meta, vehicle count chip, Edit/Delete; per-vehicle rows that open the vehicle 2478–2481; weekly cost; **Take off**; plan total 2498–2510 via `insurancePlanTotals` + `formatInsuranceCostLine(t.weekly).split(' · ').slice(1)` string surgery 2506). Plan form 2631–2675. Add-to-plan 2677–2771 (empty-plans state → **Add a plan** 2699–2709; **Take off insurance…** 2733–2749). Take-off 2909–2943. On the board: the card insurance line 2010–2047 (B).
- **Owned state:** `insCostDraft`/`insCostUnit` (default `'mo'`)/`insCostSaving` 169–171, `plansOpen` 182, `planFormOpen`…`planSaving` 187–194, `insVehicle`/`insPlanId`/`insStartDate`/`insSaving` 195–198, `takeOffPeriod`/`takeOffVehicleName`/`takeOffDate`/`takeOffSaving` 199–202. `insCostDraft` **is not reset on vehicle switch** (effect 518 does not touch it).
- **Handlers:** `openPlanForm` 703–711, `savePlan` 713–740, `deletePlan` 742–751 (confirm: coverage history deletes with it), **`saveInsuranceCost` 754–775** (`weeklyInsuranceCostFromInput` → `vehicles.weekly_insurance_cost`; patches the local list with **no `loadFleet`**), `openAddToPlan` 777–782, **`submitAddToPlan` 784–824** (closes the open period with `end_date = insStartDate`, then inserts the new period; two writes, not atomic), `openTakeOff` 1055–1059, `submitTakeOff` 1061–1077.
- **Openers from 2+ places:** plans manager (B's strip 1383, add-to-plan's **Add a plan** 2703), add-to-plan (card 2040, Insurance card 1584/1594), take-off (1587, 2492, 2742), plan form (2437, 2463, 2704). The opener state stays in the tab.
- **Extraction:** Stage A first: `insurancePlanChangeWrites` mirroring `handOffWrites`, and an `insuranceCostParts()` to replace the split/slice. Then `VehicleInsurancePlansModal` (manager + plan form), `VehicleAddToPlanModal` and `VehicleTakeOffModal` as controlled dialogs. The Insurance card rides with C.

### E. Maintenance tasks + Checklist bridge

- **Render:** Maintenance section 1719–1845: open tasks (`openMaintenanceTasks` over A's tasks for the vehicle); a checkbox → `completeMaintenanceTask`; a title that expands `ChecklistItemActivity` 1796–1806 when bridged (`commentInstanceId`, `onComplete` → complete, `setError` → A's shared `error`); the note; an assignee chip or amber Unassigned; Edit / Assign·Reassign / ×; the add-task input + **Add** 1814–1842. Edit-task modal 2806–2855 (backdrop closes). Assign modal 2856–2907.
- **Owned state:** `expandedTaskId` 207, `editTask`/`editTaskTitle`/`editTaskNote`/`editTaskSaving` 217–220, `newTaskTitle`/`taskSaving` 221–222, `assignTask`/`assignUserId`/`assignDue`/`assignNotify` (default true)/`assignSaving` 223–227.
- **Handlers:** `addMaintenanceTask` 826–845 (also called from F's **Create task** 1697 with the problem id); `fetchChecklistLinkIds` 853–860 (re-reads the row → `resolveChecklistCleanupIds`, the v2.2101 orphan fix); **`completeMaintenanceTask` 862–893** (task update, then the checklist instance update with **its error ignored** 876–879, then the "Log service" nudge that **writes F's service-form state** 887–892 unless `skipServiceNudge`); `saveTaskEdit` 926–955 (also rewrites `checklist_items.title` via `maintenanceChecklistTitle`); `deleteMaintenanceTask` 957–979 (fetches links **before** the confirm, deletes the instance, then the item, then the task); **`submitAssignTask` 988–1053** (deletes the old instance + item → inserts the item (`repeat_type 'once'`, `show_until_completed`, `notify_on_complete_user_id`, `links`) → `getNextDisplayOrders` → inserts the item-assignee (**error ignored**) → inserts the instance → inserts the instance-assignee (**error ignored**) → updates the task links + denormalized `assigned_user_id`/`due_date`).
- **Openers from 2+ places:** assign (panel 1782, tasks catch-up 2802).
- **Extraction:** Stage A: `maintenanceChecklistItemPayload()` + tests. Then a `useVehicleMaintenanceActions({ authUser, vehicles, userNameById, loadFleet, setError, showToast, onLogServiceNudge })` hook so the nudge becomes a callback (`userNameById` feeds the assign toast 1045), then `VehicleTaskEditModal` + `VehicleTaskAssignModal`. Keep the checklist writes in the same order.

### F. Service log · problem reports · replacement value

- **Render:** header buttons that prefill and open the forms (1462–1489); Open problems 1658–1717 (severity chip, reporter or "Office", **Create task** → E, **Resolve**); Log service 2256–2314 (`SERVICE_TYPE_LABELS`); Report problem 2316–2373 (`PROBLEM_SEVERITY_LABELS`); Resolve 2375–2410; Update value 2412–2430. The forms render only while `selectedVehicleId` is set.
- **Owned state:** `valueFormOpen`/`valueDate`/`valueAmount` 229–231, `problemFormOpen`…`problemSaving` 235–238, `resolvingProblem`/`resolutionNote`/`resolveSaving` 239–241, `serviceFormOpen`…`serviceSaving` 245–251.
- **Handlers:** `submitService` 1079–1120 (validates odometer + cost; inserts the event; when miles are given, also inserts a reading dated the service date, with **its error ignored** 1106–1111), `submitProblem` 1122–1148, `submitResolve` 1150–1172, `submitValueEntry` 1174–1193 (**no saving flag**; reloads the panel only).
- **Extraction:** four small controlled modals; `vehicleId` = `selectedVehicleId` as a prop. The service modal's open/prefill must stay reachable from E's nudge.

### G. Vehicle add / edit / delete

- **Render:** 2087–2180. Compact dialog (v2.1671) at 90vh with ✕; fields Year/Make/Model, Trim, VIN, **Weekly cost: Registration** (insurance moved to D), and oil Interval/Suggest within/Require past.
- **Owned state:** `vehicleFormOpen` 161, `editingVehicle` 162, `vehicleYear`…`vehicleVin` 163–167, `vehicleRegCost` 172, `vehicleOilInterval`/`vehicleOilSuggestWindow`/`vehicleOilRequirePastDue` 252–254.
- **Handlers/effects:** `openVehicleForm` 559–571 (oil defaults 5000/1000/0), `closeVehicleForm` 573–576, Escape effect 580–588 (`[vehicleFormOpen]`, window keydown), `upsertVehicle` 590–622 (year 1900–2100; `parseFloat(reg) || 0`; oil fallbacks; insert sets `weekly_insurance_cost: 0` 614), `deleteVehicle` 624–633 (confirm; clears the selection if it was selected).
- **Extraction:** Stage A `vehicleFormPayload(draft)` + tests, then `VehicleFormModal({ vehicle, onSaved, onError })`. It owns the 9 draft states (`vehicleYear`…`vehicleVin`, `vehicleRegCost`, the 3 oil fields) and the Escape effect. `openVehicleForm` seeds those drafts today (560–569), so the seeding becomes the modal's initial state from `vehicle`, oil defaults included. The opener pair `vehicleFormOpen`/`editingVehicle` stays in the tab because two regions open it (header 1364, panel Edit 1490).

### H. Hand-off / assign / motor pool

- **Render:** 2182–2254. The title and "currently …" line come from `holderByVehicle` (2186, 2190–2196). New-holder select: the motor-pool option is hidden when the vehicle is already parked (2202–2206), then `users` sorted by name. Date, optional odometer, explainer text 2227–2233.
- **Owned state:** `handOffVehicle`/`handOffUserId`/`handOffDate`/`handOffOdometer`/`handOffSaving` 174–178.
- **Handler `submitHandOff` 642–701:** `MOTOR_POOL_OPTION` → `toUserId: null`; `currentPossession` over A's possessions; `handOffWrites` → end the open possession → insert the new one → optional reading, with early return on each error (no rollback); toast; reload fleet + panel.
- **Extraction:** `VehicleHandOffModal({ vehicle, holder, possessions, users, userNameById, onDone, onError })`; `userNameById` (not `users`) names archived holders in the "currently …" line 2194 and the toast 692. The opener state stays because the card (1347) and the panel (1459) both open it.

### I. Check-in settings (dev-only)

- **Render:** 2524–2629 (backdrop closes). A link to Quickfill's station via `quickfillStationHref('vehicle-odometers')` 2531; assigned/motor-pool day inputs with inline clamps 2546 (1–365) and 2560 (0–365); a question list editor (`crypto.randomUUID` ids 2605).
- **State/handlers:** `checkinSettingsOpen`/`Draft`/`Saving` 183–185; `openCheckinSettings` 1197–1200 (`fetchVehicleCheckinSettings`); `saveCheckinSettings` 1202–1214 (`app_settings` key `vehicle_checkin_settings_v1`). Gated by the local `isDev` 1195.
- **Extraction:** `VehicleCheckinSettingsModal({ onClose, onError })`, fully self-contained. Compare the inline clamps with the kernel's `cleanDays` (0–365 for both keys) before unifying.

### J. Catch-up sheets + odometer history (mounts only)

- **State:** `readingsCatchUp`/`catchUpSaved`/`catchUpSavingId`/`tasksCatchUpOpen` 211–214, `odoHistoryVehicleId` 216. **Handlers:** `openReadingsCatchUp` 895–898 (`readingCatchUpRows` snapshot at open), `saveCatchUpReading` 900–918.
- **Mounts:** `VehicleOdometerHistoryModal` 2773–2785 (does its own `vehicle_odometer_entries` read + insert; `onAdded` → `loadFleet`), `VehicleReadingsCatchUpModal` 2786–2795, `VehicleTasksCatchUpModal` 2796–2805 (`onComplete` → E with `skipServiceNudge`; `onAssign` → E's assign modal, which stacks at zIndex 11 over the shell's 10).
- **Extraction:** done. What remains is to move the two catch-up handlers into A's hook or leave them in place.

### K. Wheels (dev-only)

`{isDev && !loading && !selectedVehicle ? <PeopleVehiclesWheelsSection users={users} /> : null}` 2084. The module (303 lines, also exports `VehicleArrangementChip`, which `review/PeopleReviewRankedList.tsx` 13 uses) self-loads `loadWheelsSnapshot` when `open` (default true, line 103). Nothing to extract.

---

## Shared substrate

People has no cross-tab pointer (People keys by person). Inside this component, shared state works like this:

1. **Selection pointer: `selectedVehicleId`** (152). It is not URL-backed. Writers: card click 1952/1956, the plans-manager vehicle link 2480, `← All vehicles` 1404, `deleteVehicle` 631. Readers: effect 518, `selectedVehicle` 370 (the board↔panel switch at 1400 and Wheels at 2084), `ledgerRows`, F's form gates (2256, 2316, 2412), and every panel-scoped submit (`saveQuickReading`, `submitService`, `submitProblem`, `submitValueEntry`, `deleteLedgerRow`, `submitResolve`/`submitHandOff` reloads). It stays in the tab; extracted children get `vehicleId`.
2. **Fleet engine (A):** 11 state arrays/maps + `loadFleet` + the derived maps. B, C, D, E, H and J read it, and 20 call sites reload it. It becomes `useVehicleFleet`.
3. **`error`** (148): one error line (1397) with 23 writers (22 handlers + E's `ChecklistItemActivity` `setError` prop 1800). Extracted pieces take `onError`.
4. **Name resolver:** `userNameById` + `resolveExtraNames` (archived holders/authors via `get_user_display_names`). Every region uses it for labels.
5. **Shared dialogs** (opened from 2+ regions, so the opener state stays): hand-off (H), plans manager / add-to-plan / take-off / plan form (D), assign task (E), Log service (F, also opened by E's nudge 887–892), vehicle form (G: header + panel).

### What must STAY in `PeopleVehiclesTab`

`selectedVehicleId`; the `useVehicleFleet` call; `error` + the error line; `userNameById`; the opener state for the shared dialogs above; the `loading ? … : selectedVehicle ? … : board` switch (1398–2082) until the loading-flash decision is made.

## Stage-A inventory (pure logic → `src/lib/**` + tests)

| Candidate | Currently | Target |
|---|---|---|
| Ledger filter aliasing (4 pairs) | `visibleLedgerRows` 1272–1285 + `LEDGER_FILTERS` 105–114 | `ledgerRowMatchesFilter(kind, filter)` in `vehicleFleet.ts` |
| Ledger kind → source table; undeletable kinds | `deleteLedgerRow` 1226–1239; render 1923 | `ledgerRowSourceTable(kind)`, `isLedgerRowDeletable(kind)` |
| Ledger chip label/tone | render 1893–1916 | `ledgerKindChip(kind)` |
| Check-in ledger label | `ledgerRows` 1261–1268 | `checkinLedgerLabel(answers, byName)` in `vehicleCheckinSettings.ts` |
| **Fleet weekly cost (money)** | `weeklyTotal` 328–336 | `fleetWeeklyCost(vehicles, insuredIds)` + tests |
| Plan-total cost line (string surgery) | 2506 `split(' · ').slice(1)` | `insuranceCostParts(weekly)` in `vehicleInsuranceCost.ts` |
| Plan change write plan | `submitAddToPlan` 790–816 | `insurancePlanChangeWrites()` (mirror `handOffWrites`) |
| Vehicle form payload + validation (registration $ → pay stubs) | `upsertVehicle` 591–611; defaults 567–569 | `vehicleFormPayload(draft)` |
| Service cost/odometer parse; value parse | 1081–1090; 1176–1180 | `parseServiceForm`, `parseReplacementValue` |
| Per-vehicle grouping (latest reading, last oil, problem counts) | `loadFleet` 444–478 | `latestReadingByVehicle`, `lastOilByVehicle` |
| Current-row maps | `holderByVehicle` 267–277, `insuranceByVehicle` 285–295 (filter per vehicle) | `currentRowByVehicle(vehicles, rows, today, pick)` |
| Active/Inactive partition | 353–368 | `partitionFleetByActivity` |
| Holder label (3 variants: card `user_id.slice(0,8)` 1314, header chip 1419–1436, dialog 2190–2196) | inline | `holderLabel(holder, names)`, keeping each fallback |
| Assign checklist item payload | `submitAssignTask` 1002–1012 | `maintenanceChecklistItemPayload()` |
| Check-in day clamps | 2546, 2560 | reuse/extend `cleanDays` |
| `todayYmd` / `formatYmdShort` / `initials` | 116–140 | shared date helper; 9 local `function todayYmd()` copies across `src/`, this one included (git grep). **Browser-local day; keep it** |
| `Vehicle` row type | 82–94 (a superset of `FleetVehicle` 12–18) | export `FleetVehicleRow` from `vehicleFleet.ts` |

**Kernels already extracted:** [`vehicleFleet.ts`](../src/lib/vehicleFleet.ts) (789 lines, 57 exports = 30 functions + 6 consts + 21 types, 43 tests: possession/insurance currency, readings/freshness, `fleetSummary`, search, odometer parse, oil status/thresholds, problems, tasks, `buildVehicleLedger`, `handOffWrites`, call lists); [`vehicleInsuranceCost.ts`](../src/lib/vehicleInsuranceCost.ts) (70, 4); [`vehicleFleetAttention.ts`](../src/lib/vehicleFleetAttention.ts) (57, 3); [`vehicleCatchUp.ts`](../src/lib/vehicleCatchUp.ts) (60, 2); [`vehicleCheckinSettings.ts`](../src/lib/vehicleCheckinSettings.ts) (118, 3); [`vehicleOdometerHistory.ts`](../src/lib/vehicleOdometerHistory.ts) (118, 5; modal-only); [`userDisplayNames.ts`](../src/lib/userDisplayNames.ts) (2); `lib/people/wheels.ts` (10) + `wheelsData.ts` (8) behind K. `utils/checklistOrder.ts` (`getNextDisplayOrders`) has no test.

## Preserve-quirks list (load-bearing: do not "fix" during moves)

1. **Browser-local today:** `todayYmd()` (116–119) uses the browser's local date, not the company calendar. `today` is recomputed every render (265).
2. **Motor pool = possession with `user_id` null.** The select sentinel `'__motor_pool__'` (122) maps to `null` at 653. The pool option is hidden when already parked. Active = held by a person; Inactive = pool or none.
3. **Insurance cost is stored weekly.** The unit defaults to `'mo'` and the preview shows only when unit ≠ wk. `saveInsuranceCost` patches in place (773) with no reload. A new vehicle inserts `weekly_insurance_cost: 0`. The vehicle form no longer edits insurance.
4. **Off-plan = $0/wk on the board and in `weeklyTotal` (D5)**, but the stored cost is kept ("last cost").
5. **A plan change closes the old period on the new start date** (798–801). Take-off sets `end_date`. The two writes are not atomic.
6. **Oil defaults 5000 / 1000 / 0** in both the opener (567–569) and the save fallback (608–610).
7. **A service with miles also writes a reading** dated the service date (1106–1111).
8. **Completing a task opens the prefilled "Log service" nudge** (`repair`, note = task title) against `selectedVehicleId`. Catch-up suppresses it with `skipServiceNudge`.
9. **Checklist cleanup re-reads link ids** (`fetchChecklistLinkIds`). Delete reads them before the confirm so its warning is accurate.
10. **Assign replaces the old checklist rows first**, then builds item → assignee → instance → instance-assignee → task links, in that order.
11. **Undeletable ledger kinds:** `return`, `problem_resolved`, `insurance_off`. The filter aliases are handoff↔return, problem↔problem_resolved, insurance_on↔insurance_off, service↔task_done.
12. **Check-in reads fail soft** (492–503) and check-in deletes reload the panel only.
13. **Modal z-order:** the catch-up shell uses 10. Assign, edit-task, plan form, add-to-plan and take-off use 11, so they stack over the catch-up sheet and the plans manager.
14. **Among the inline dialogs, Escape closes only the vehicle form** (the extracted odometer-history sheet has its own Escape). Check-in settings and edit-task close on backdrop click (as do the catch-up sheets); the other inline dialogs close only via Cancel/Close.
15. **The mount load is delayed 80 ms** (513). Every reload is fire-and-forget.
16. **Archived names show as "Name (archived)"** via the RPC. The card falls back to the first 8 chars of `user_id` (1314).

## Known drift (flag: fix in its own PR, never inside a move)

- **Pay stubs ignore insurance status:** `People.tsx` `getVehiclesForPersonInPeriod` (1487–1519) reads raw `vehicles.weekly_insurance_cost` with no plan check, while the board's `weeklyTotal` and Insurance card treat an off-plan vehicle as $0/wk (D5, v2.2180). The owner should decide which one is right.
- **Two different "today"s:** Wheels uses `todayYmdInAppTz()` (`PeopleVehiclesWheelsSection.tsx` 112); this tab uses browser-local `todayYmd()`.
- **`task_done` ledger delete skips the checklist cleanup** that `deleteMaintenanceTask` does (1237–1240 vs 969–971). The linked `checklist_items`/`checklist_instances` rows are left behind.
- **Header docblock 75–80** describes only the v2.1644 board.
- **Check-in ledger rows wear the "Hand-off" chip:** the kind→label chain 1902–1916 has no `checkin` branch (kernel kind at `vehicleFleet.ts` 544), so those rows fall through to the default label. A `ledgerKindChip` kernel must either reproduce this or fix it in its own PR.

## Recommended extraction order (value ÷ risk)

Done: `VehiclesFleetSummary` (v2.2169), `VehicleCatchUpModals` (v2.2106), `VehicleOdometerHistoryModal` (v2.2172), `PeopleVehiclesWheelsSection` (v2.2733), and all the kernels above.

1. **Stage A: ledger helpers** (filter aliasing, kind→table, deletable, chip label, check-in label) → `vehicleFleet.ts`/`vehicleCheckinSettings.ts` + tests. About −70 lines.
2. **Stage A: money + write plans.** `fleetWeeklyCost`, `insuranceCostParts`, `insurancePlanChangeWrites`, `vehicleFormPayload`, `maintenanceChecklistItemPayload` + tests. About −60 lines.
3. **Stage A: fleet grouping + maps** (`latestReadingByVehicle`, `lastOilByVehicle`, `currentRowByVehicle`, `partitionFleetByActivity`, `holderLabel`) and export the `Vehicle` row type. About −60 lines.
4. **`VehicleCheckinSettingsModal`** (I): self-contained and dev-only. About −120 lines.
5. **`VehicleFormModal`** (G): the 9 draft states + the Escape effect move with it; the opener pair stays. About −170 lines.
6. **`VehicleHandOffModal`** (H): opener state stays. About −130 lines.
7. **Panel forms** (F): `VehicleServiceModal`, `VehicleProblemModal`, `VehicleResolveProblemModal`, `VehicleValueModal`. The service opener stays for E's nudge. About −190 lines.
8. **Insurance dialogs** (D): plans manager + plan form, add-to-plan, take-off. The openers stay. About −300 lines.
9. **`useVehicleFleet` hook** (A): state + `loadFleet` + mount effect + memos; it returns the same names. About −250 lines. Any stale-guard or error-surfacing change goes in a separate fix PR.
10. **Maintenance** (E): `useVehicleMaintenanceActions` (nudge as a callback) + `VehicleTaskEditModal` + `VehicleTaskAssignModal`. About −300 lines.
11. **`VehicleFleetBoard` + `VehicleCard`** (B). About −250 lines.
12. **`VehiclePanel`** (C, with the Insurance card, Open problems and Maintenance section as children): last, and only after the loading-flash decision. About −430 lines.

Side track (not a move): a render smoke for `VehicleCatchUpModals` and for `PeopleVehiclesWheelsSection`. Verify each step with `npm run typecheck && npm run lint && npm test`, one PR per step.

## Hazards

- **Money paths:** `vehicles.weekly_insurance_cost` (`saveInsuranceCost` 754–775) and `weekly_registration_cost` (`upsertVehicle` 596/607) are read by pay stubs (`People.tsx` 1487–1519 → `buildPayStubHtml`) and by Wheels (`wheelsData.ts` 87, 154–167). `weeklyTotal` (328–336) is inline and untested. The plan total goes through string surgery (2506). Service `cost` (1086–1098) and replacement value (1176–1183) are stored only. A move must keep the parse/fallback semantics exactly (`parseFloat || 0`, `weeklyInsuranceCostFromInput` rounding).
- **RLS / role gates:** the UI gate is `canAccessVehicles` (parent). Table RLS is "Pay access users can manage …" (`is_dev() OR is_pay_approved_master() OR is_assistant()`) on tasks (`20260814233006` 44–46), plans/periods (`20260814214226` 47–55) and check-ins (`20260823210023` 31–34). Holders get SELECT on their vehicle, readings and service events through `holds_vehicle()`, INSERT on readings, and SELECT on their own possessions via `user_id = auth.uid()` (`20260814183650`). The dev-only UI (Wheels, ⚙ settings) keys on the local `isDev` from the `users` roster (1195), not `usePeopleAccess`. Assignment writes checklist rows **for another user**. Field completion flows back through the SECURITY DEFINER trigger `sync_vehicle_maintenance_task_completion`.
- **Realtime:** none. There are no subscriptions; freshness comes from the 20 `loadFleet` call sites and 9 `loadPanel` call sites, none awaited and none request-guarded, so a slow earlier load can overwrite a newer one.
- **URL deep links:** none into a vehicle. `?tab=vehicles` is resolved by the parent, and the selection is local. A `vehicle=` param would be a feature, not a move.
- **Effects that make moves risky:**
  - **The loading flash:** `loadFleet` sets `loading = true` (387) and the render at 1398 replaces the whole board/panel with "Loading…" until the `vehicles` query returns (390). Today that remounts only DOM (all state lives in the tab). But the expanded `ChecklistItemActivity` refetches, the quick-entry focus is lost, and Wheels (`open` defaults true) **re-runs `loadWheelsSnapshot` after every board write**. If panel/board state moves into a child, every reload (the 18 write handlers and the history sheet's `onAdded`) would reset it (filters, drafts, `insCostDraft`, `newTaskTitle`).
  - **Panel effect 518–533:** no cancellation, so fast vehicle switching can paint the previous vehicle's ledger. It also resets the filter and quick entry but not `insCostDraft`.
  - **Mount effect 512–516:** `[]` with an eslint-disable; the hook move must keep the 80 ms delay.
- **Row caps:** fleet-wide `.limit(2000)` on odometer, oil, problems, periods and tasks (415, 422, 428, 434, 440). Odometer rows are newest-first across the fleet, so a vehicle whose latest reading falls outside the newest 2,000 would show "No reading yet". `vehicles`, possessions and all panel reads are unbounded.
- **Non-atomic write chains:** `submitHandOff` (a failure after the end-write leaves no holder), `submitAddToPlan`, `submitAssignTask` (two assignee inserts with errors ignored), `completeMaintenanceTask` (checklist update error ignored), `submitService` (reading insert error ignored), `deleteMaintenanceTask` (checklist deletes unchecked).
- **Destructive deletes:** `deleteVehicle` cascades history; `deletePlan` deletes coverage history; `deleteLedgerRow` deletes source rows (a `handoff` row deletes the possession; `problem` deletes the report along with its resolution). `submitValueEntry` and `deleteLedgerRow` have no in-flight guard.

## Cross-surface duplicates (context for later kernels)

- **Hand-off executor:** `handOffWrites` is applied by three hand-written write sequences: here (642–701), `personDesk/sections/PersonDeskFieldSection.tsx` 80–110 and `personDesk/PersonDeskLifecycleModal.tsx` 196–209. That makes an `applyHandOffWrites()` in lib worth having.
- **Odometer insert:** here (543–545, 907–909, 1108–1110), `VehicleOdometerHistoryModal.tsx` 51–53, `quickfill/QuickfillVehicleOdometersSection.tsx` 217 and `DashboardMyVehicleCard.tsx` 159.
- **Fleet loaders:** `loadFleet` here, `QuickfillVehicleOdometersSection.tsx` `loadAll` 115–150 (vehicles 121 + open possessions 136 + odometer `.limit(2000)` 138–142), `DashboardMyVehicleCard.tsx` 68–83 and `lib/people/wheelsData.ts` 87–89 each load overlapping vehicle/possession/odometer/insurance rows.
