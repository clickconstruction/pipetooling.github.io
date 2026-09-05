# Prospects Tabs Architecture Map

---
file: docs/PROSPECTS_TABS_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map for the Prospects surface (per PAGE_DECOMPOSITION_PLAYBOOK.md) — inventory what every tab of src/pages/Prospects.tsx (3,373 lines) and the already-extracted src/components/prospects/TeamProspectsTab.tsx (1,820 lines, high churn) touches (state, loaders, handlers, sub-components, supabase tables, cross-tab coupling), so extraction can proceed tab by tab without re-deriving the strategy.
audience: Developers, AI Agents
last_updated: 2026-09-05
sections: What this surface is; Master summary table; Shared substrate; Per-tab dossiers; TeamProspectsTab sub-decomposition; Page-level modals; URL / navigation router; Stage-A pure-logic inventory; Preserve-quirks list; Recommended extraction order
---

## What this surface is

[`src/pages/Prospects.tsx`](../src/pages/Prospects.tsx) (**3,373 lines**, ~11 commits in recent history) is the customer-prospecting cold-call workstation plus the entry point to the Team hiring board. It carries ~75 `useState` declarations, ~20 `useEffect`s, and ~45 handler functions, all in one component, plus 11 module-level pure helpers and 3 inline SVG icon components at the top of the file.

[`src/components/prospects/TeamProspectsTab.tsx`](../src/components/prospects/TeamProspectsTab.tsx) (**1,820 lines**, churn 16 — the entire v2.9xx July-2026 hiring-pipeline wave landed here) is *already an extracted tab* that has grown into its own God component; it gets its own sub-decomposition section below.

The page is switched on **two levels of tab state**:

```
topTab:    'customers' | 'team'                                  (ProspectsTopTab)
activeTab: 'follow-up' | 'prospect-list' | 'convert' | 'activity' (ProspectsTab, only under 'customers')
```

Both are URL-synced through one `?tab=` param (`team` selects the top-level Hiring tab (label renamed Team → Hiring in v2.1253; key `team` unchanged); the four `PROSPECTS_TABS` values select Customers sub-tabs). Inside TeamProspectsTab a third level exists: `stage: 'screen' | 'interview' | 'hire' | 'review'` (deep-linked once via `?stage=`, then stripped).

Access gates (all from `useAuth`): `canAccessFollowUp` (dev / master_technician / assistant / controller, or estimator with `estimatorProspectsAccess`) gates Follow Up / Prospect List / Convert; `canAccessActivityTab` (`authRole === 'dev' || isAssistantLike(authRole)`) gates Activity; `teamProspectsAccess` (per-user `users.team_prospects_access` flag, RLS-enforced server-side) gates the Hiring tab.

**Line numbers below are as of 2026-07-29 and rot — always search the named symbol.**

## Master summary table

| Region | Render anchor | Approx inline lines | Status | Owned state (approx) | Cross-tab coupling | Risk | Recommended action |
|---|---|---|---|---|---|---|---|
| Follow Up | `activeTab === 'follow-up'` (~1639–2171) + 5 tab-local modals (~2855–3264) | ~1,100 | inline | ~45 states (largest cluster) | high (shared caches, selection pointer, `saving`, Edit modal) | high | Extract **last** among Customers tabs, after the data seam |
| Prospect List | `activeTab === 'prospect-list'` (~2173–2462) | ~290 | inline | 5 states | med (writes shared caches, opens shared Edit modal, navigates to Follow Up) | med | Extract 3rd, after the data seam |
| Convert | `activeTab === 'convert'` (~2464–2669) | ~205 + 4 effects | inline | 7 states (`convert*` cluster) | low (reads both caches + `currentProspect` default) | low | **Extract 2nd** → `ProspectsConvertTab` |
| Activity | `activeTab === 'activity'` (~2671–2725) | ~55 | inline | 2 states | none (own loader, lib kernel already extracted) | lowest | **Extract 1st** → `ProspectsActivityTab` |
| Hiring (hiring board, key `team`) | `topTab === 'team'` wrapper (~1635–1637) | 3 (wrapper) | **extracted** (`TeamProspectsTab`) | 0 in parent | `resolveMasterId={getEffectiveMasterId}` callback only | — | Done at page level; needs its own sub-decomposition (below) |
| Page-level modals | after the tabs (~2727–3370) | ~650 | inline | Edit/New Prospect + 5 follow-up modals | Edit Prospect + New Prospect opened from 2+ contexts | — | Edit + New Prospect stay in parent; the other 5 move with Follow Up |
| — TeamProspectsTab: Screen board | `stage === 'screen'` DndContext (~1258–1300) + module components | ~450 | inline (in TPT) | drag/rank via lib kernel | shares `rows`/`roles`/`load`/`busy`/`setStatus` with all stages | med | Component per stage after a `useTeamProspectsData` seam |
| — TeamProspectsTab: Interview | `stage === 'interview'` (~1302–1400) | ~100 | inline (in TPT) | review modal cluster | reads `reviews`/`reviewerNames`, `setStatus` | low-med | Extract with review modal |
| — TeamProspectsTab: Hire | `stage === 'hire'` (~1401–1514) + onboarding settings modal (~1725–1817) | ~210 | inline (in TPT) | onboarding cluster (7 states) | `onboardingItems`/`onboardingStatuses` only used here | low | Extract 1st inside TPT |
| — TeamProspectsTab: Review | `stage === 'review'` wrapper (line ~1515) | 1 | **extracted** (`TeamReviewSection`, 688 lines, self-contained) | 0 | `onOpenScreenBoard={() => setStage('screen')}` | — | Done |

## Shared substrate

The page **has** a Bids-style shared selection pointer, plus a two-cache data layer that is the real coupling problem:

1. **Selection pointer: `currentProspectIndex` into `followUpProspects`** → `const currentProspect = followUpProspects[currentProspectIndex] ?? null`. It is URL-synced as `?prospect_id=` (written by `updateUrlProspectId`, read by `loadFollowUpProspects` and a dedicated index-sync effect), and is written cross-tab: Prospect List's `selectProspectForList` and external deep links (Quickfill Edit) both select through it. Seven per-prospect effects hang off `currentProspect?.id` (comments, email-sent keys, ledger seconds, scheduled callback, calling lock, notes sync, Convert default). **This pointer stays in the parent** (playbook rule), passed to an extracted Follow Up tab as controlled props.
2. **Dual prospect caches, patched in tandem**: `followUpProspects` (active, coldest-first, minus rows *live*-locked — younger than `CALLING_LOCK_TTL_MS` — by other users) and `prospectListProspects` (everything). Nearly every mutation writes both: `saveEdit`, `handleDeleteProspect`, `handleDeleteFromList`, `saveFollowUpNotes`, `handleSendBack`, `handleCantReach`, `handleNotAFitFromList`, `saveNewProspect` (reloads both). Convert reads the union of both for its dropdown. This is the page's `useBidPricingEngine` analog: seam-hook candidate **`useProspectsData`** returning `{ followUpProspects, prospectListProspects, currentProspect, currentProspectIndex, loadFollowUpProspects, loadProspectListProspects, saving, setSaving, updateUrlProspectId, ... }` that the parent destructures.
3. **One global `saving` flag** disables buttons across *all* Customers tabs and modals (any in-flight mutation blocks every other one). Behavior-preserving extraction must keep it page-level (or in the seam hook), not per-tab.
4. **TeamProspectsTab is substrate-free from the parent's perspective** — it loads its own data; the only shared thing is the `resolveMasterId` callback (`getEffectiveMasterId`, which also serves `saveNewProspect`). *Inside* TeamProspectsTab, the substrate is `rows` + `roles` + the monolithic `load()` + `busy` + `setStatus` shared by all four stages.

## Per-tab dossiers

### `follow-up` — Follow Up (the calling workstation)

- **Render location:** `topTab === 'customers' && activeTab === 'follow-up'` (~1639–2171): warmth counter + action-button row (with three timers), Comments section (Didn't Answer / Answered buttons, auto-resizing textarea, quick-note chips, comment list), info card (prospect fields + due badge + scheduled callback link to `/calendar`), notes editor, Copy-template button row, and the footer ("move next" checkbox + "my time" link). Five tab-local modals render after the tab blocks: Callback (~2856), Copy template edit (~2933), Copy blank fields (~3069), Timer history (~3114), My time (~3188).
- **Owned local state (moves with the tab):** `comments`, `commentInputValue`, `commentInputRef` (state-as-ref for the auto-resize effect), `followUpLoading`, `followUpTimerSeconds`, `scheduledCallback`, `followUpNotes` + `followUpNotesSaving`, `quickNotes`, `didntAnswerMoveNext` (localStorage-backed), `prospectLedgerSeconds`, `myTimeTodaySeconds`, `emailSentTemplateKeys`, the copy-template cluster (`copyDefaults`, `copyOverrides`, `copySubjectDefaults`, `copySubjectOverrides`, `personPhone`, `authUserName`, `editingCopyTemplateKey`, `editingCopyText`, `editingCopySubject`, `copyTemplateSaving`, `copyBlankFieldsModalOpen`, `copyBlankFieldsList`, `copyTemplateTextareaRef`), the callback modal cluster (`callbackModalOpen`, `callbackDate`, `callbackTime`, `callbackNote`), the timer-history modal (`timerHistoryModalOpen`, `timerEvents`, `timerEventsLoading`), the my-time modal (`myTimeModalOpen`, `myTimeStats`, `myTimeStatsLoading`), and `loadCommentsForProspectRef` (stale-response guard).
- **Cross-tab/shared state (stays in parent):** `followUpProspects` + `currentProspectIndex` (the pointer — also written by Prospect List and the URL router), `prospectListProspects` (patched by `saveFollowUpNotes`, `handleCantReach`, `saveEdit`, `handleDeleteProspect`), `saving`, the Edit Prospect modal cluster (`editModalOpen`, `editingProspect`, `editCompanyName`, `editContactName`, `editPhoneNumber`, `editEmail`, `editAddress`, `editLinksToWebsite` — shared with Prospect List via `openEditModalForProspect`).
- **Derived values:** `currentProspect`; the info card computes "Last Contact" as `comments[0]?.created_at ?? currentProspect.last_contact` and "Last Successful Contact" as the newest `interaction_type === 'answered'` comment; `formatDueBadge` renders "Due N days" at ≥7 days; the three timer readouts (`this time` = `followUpTimerSeconds`; `all time` = `prospectLedgerSeconds + followUpTimerSeconds`; `my day` = `myTimeTodaySeconds + followUpTimerSeconds`).
- **Handlers/loaders:** `loadFollowUpProspects` (excludes `not_a_fit`/`cant_reach` and rows *live*-locked by *other* users via `prospect_calling_locks` — `.gte('locked_at', callingLockCutoffIso(now))`, so a row older than 30 min never hides anything; orders `last_contact` asc nullsFirst then `created_at` asc; if `?prospect_id` is not in the list it fetches that row singly and **prepends** it), `loadComments` (guarded by `loadCommentsForProspectRef`), `loadEmailSentTemplateKeys`, `loadProspectLedgerSeconds`, `loadMyTimeToday`, `loadMyTimeStats`, `loadTimerEvents`, `loadScheduledCallback` (useCallback), `loadQuickNotes`, `loadCopyTemplates`, `loadPersonPhone` (users.phone → people.phone fallback), `saveFollowUpNotes`/`cancelFollowUpNotes`, `handleWarmthDelta`/`handleWarmthReset`, `openEditModal`, `handleDeleteProspect`, `saveEdit`, `openCallbackModal`/`saveCallback`, `saveTimerEvent`, `handleNoLongerFit`, `handleCantReach`, `handleDidntAnswer` (optional auto-advance via `didntAnswerMoveNext`), `handleAnswered`, `handleAddComment` (Enter key), `handleQuickNoteClick`/`handleAddQuickNote` (uses `prompt()`)/`handleDeleteQuickNote`, `handleNextProspect(skipTimerEvent?)`, `handleCopyTemplate`/`handleOpenMail` (mailto: + `prospect_email_sent` upsert)/`openEditCopyModal`/`saveCopyTemplate`/`getResolvedCopyText`/`getResolvedCopySubject`, `updateUrlProspectId`, `takeCallingLock(trigger)` (v2.2850 — takes the advisory lock on the first sign of intent: `dial` / `composer` / `outcome` / `callback`; reads the existing row, runs `callingLockDecision` from `lib/prospects/callingLock.ts`, upserts only on `take` / `stale-take`, and on `held-by-other` names the colleague in the `lockHeldBy` chip instead of writing; records `prospect_lock_taken{trigger}` via `recordNavClick`).
- **Effects:** calling-lock **release-only** effect (v2.2850: viewing writes nothing — the row is taken by `takeCallingLock`; the cleanup deletes the row only when `lockTakenForRef` says this tab wrote it, and clears `lockHeldBy`); 1-second interval gated on `topTab === 'customers' && activeTab === 'follow-up' && document.visibilityState === 'visible'`; `visibilitychange` timer reset; comment-textarea auto-resize; localStorage pref load; per-prospect loads on `currentProspect?.id` change (comments, email-sent, ledger, callback, notes sync); per-user loads on `authUser?.id` (copy templates, phone, quick notes, name).
- **Supabase tables:** `prospects` (SELECT/UPDATE/DELETE), `prospect_calling_locks` (SELECT `.neq('user_id', …).gte('locked_at', now − TTL)` on load; SELECT one row + UPSERT `onConflict: 'prospect_id'` inside `takeCallingLock`; DELETE on release), `prospect_comments` (SELECT with `created_by_user:users!prospect_comments_created_by_fkey(name, email)` join, INSERT), `prospect_callbacks` (SELECT/INSERT), `prospect_timer_events` (SELECT sums / INSERT — **all via `(supabase as any)`**, table incomplete in generated types), `prospect_email_sent` (SELECT/UPSERT `onConflict: 'prospect_id,user_id,template_key'`), `user_prospect_quick_notes` (SELECT/INSERT/DELETE), `user_prospect_copy_templates` (SELECT/UPSERT `onConflict: 'user_id,template_key'`), `app_settings` (copy-template defaults via `APP_SETTINGS_KEYS`/`APP_SUBJECT_SETTINGS_KEYS`), `users` (own phone/name).
- **Sub-components:** none extracted; icons `EnvelopeIcon`/`EnvelopeCheckIcon`/`EditIcon` are module-level in this file and move with the tab.
- **External coupling:** `?prospect_id=` deep link (Prospect List `selectProspectForList`, Quickfill Edit); localStorage key `` `prospects_didnt_answer_move_next_${userId}` `` (`DIDNT_ANSWER_MOVE_NEXT_KEY`); `navigator.clipboard`; `window.location.href = mailto:…`; `<Link to="/calendar">` for scheduled callbacks; `prospect_timer_events`/`prospect_comments` rows feed the Activity tab and Quickfill's team chart.
- **Extraction status + risk + approach:** Inline. **High risk** — the biggest tab and the home of the shared pointer. Do it last among Customers tabs, after the `useProspectsData` seam. The pointer (`currentProspect`, `onSelectNext`, `updateUrlProspectId`) and the Edit Prospect modal stay parent-owned; everything in "owned local state" moves, including the five tab-local modals. Stage A first: the copy-template kernel and formatters (see [Stage-A inventory](#stage-a-pure-logic-inventory)) are already module-level pure functions — moving them to `lib/` with tests is nearly free and removes ~200 lines.

### `prospect-list` — Prospect List

- **Render location:** `topTab === 'customers' && activeTab === 'prospect-list'` (~2173–2462): search input, then a grouping IIFE that renders collapsible warmth sections, each with a desktop table and mobile cards; rows in the sentinel sections get an Actions cell (Edit / Send back / Not a fit / Delete).
- **Owned local state:** `prospectListSearchQuery`, `prospectListLoading`, `prospectListSectionOpen` (`Record<number, boolean>`; sentinel keys `-1` = "No longer a fit", `-2` = "Can't reach", `-3` = "Converted" (v2.2452); sentinel sections (`isSentinelKey`, any key `< 0`) default closed, warmth sections default open), `selectedProspectForList`, `prospectLedgerSecondsMap` (per-prospect time totals, loaded/cleared by an `activeTab === 'prospect-list'` effect).
- **Cross-tab/shared state:** `prospectListProspects` (the cache — read by Convert, patched by Follow Up mutations), `followUpProspects` (patched by `handleSendBack`/`handleDeleteFromList`), `saving`, the shared Edit Prospect modal (opened here via `openEditModalForProspect(p)` which sets `editingProspect`), and the selection pointer (`selectProspectForList` switches to Follow Up and writes `?tab=follow-up&prospect_id=`).
- **Derived values:** the inline grouping IIFE — search filter over company/contact/phone/email, three-way bucket by `prospect_fit_status` (`cant_reach` / `not_a_fit` / active), active bucketed into a `byWarmth` Map, each list sorted `last_contact` **desc** then `company_name`, warmth keys rendered descending.
- **Handlers/loaders:** `loadProspectListProspects` (unfiltered `prospects` SELECT), `loadProspectLedgerSecondsMap` (groups `prospect_timer_events` by `prospect_id`), `toggleProspectListSection`, `selectProspectForList`, `handleSendBack` (status → null, re-inserts into `followUpProspects` with an inline sort), `handleNotAFitFromList`, `handleDeleteFromList`, `openEditModalForProspect`.
- **Supabase tables:** `prospects` (SELECT/UPDATE/DELETE), `prospect_timer_events` (SELECT, `as any`).
- **Sub-components:** none; desktop table + mobile cards are inline (CSS classes `prospectListDesktop`/`prospectListMobile`).
- **External coupling:** a `?prospect_id` effect on this tab (from Quickfill Edit) selects the row, auto-opens the right sentinel section, then strips the param.
- **Extraction status + risk + approach:** Inline. **Medium risk** — self-contained JSX but every action writes the shared caches and the Edit modal stays in the parent. Extract after the data seam; props needed: `prospects` (list cache), `loading`, `saving`, `ledgerSecondsMap` (or let the tab own that loader), `onSelectProspect`, `onEditProspect`, `onSendBack`, `onNotAFit`, `onDelete`. Stage A: lift the grouping IIFE into `lib/prospects/prospectListGrouping.ts` (pure `groupProspectsForList(prospects, query)`) with tests — note [`src/lib/prospectWarmthCounts.ts`](../src/lib/prospectWarmthCounts.ts) already encodes the same active/`not_a_fit`/`cant_reach` bucketing for Quickfill; keep them consistent.

### `convert` — Convert (prospect → customer)

- **Render location:** `topTab === 'customers' && activeTab === 'convert'` (~2464–2669): prospect selector + summary card, then three sections — `NewCustomerForm` (extracted component, `mode="page"`, prefilled), contact-person cards, bid cards — and a submit row whose button targets `form="convert-customer-form"` (the form id rendered inside `NewCustomerForm`).
- **Owned local state:** `convertProspectId`, `convertContactPersons`, `convertBids`, `convertServiceTypes`, `convertSaving`, `convertError`, `convertFirstInteractionDate`.
- **Cross-tab/shared state:** reads `prospectListProspects` + `followUpProspects` (dropdown options are the union; `convertProspect` is looked up in both) and `currentProspect?.id` (an effect defaults `convertProspectId` to the Follow Up prospect on tab switch). Writes nothing shared.
- **Derived values:** `convertProspect` (lookup, computed in the component body — not memoized).
- **Handlers/effects:** `handleConvertSubmit(payload: NewCustomerFormPayload)` — inserts `customers`, then loops `customer_contact_persons` (skips blank names), then loops `bids` (skips blank project/service-type; hardcodes `materials_model: 'rough'`), then `navigate(\`/customers/${customerId}\`)`; effects: default-to-current-prospect, earliest-`prospect_comments` date → `convertFirstInteractionDate` (cancellation-guarded), `service_types` load on tab activation (**`as any`** — table missing from generated types), pre-fill first contact person from the prospect.
- **Supabase tables:** `customers` (INSERT), `customer_contact_persons` (INSERT), `bids` (INSERT), `service_types` (SELECT, `as any`), `prospect_comments` (SELECT earliest).
- **Sub-components:** [`NewCustomerForm`](../src/components/NewCustomerForm.tsx) (**extracted**, `onSubmitForConvert` prop).
- **External coupling:** navigates to `/customers/:id` on success. Note: conversion does **not** modify or delete the prospect row.
- **Extraction status + risk + approach:** Inline. **Low risk — extract second** → `ProspectsConvertTab`. Props: `prospects` (the union list, or both caches), `defaultProspectId` (= `currentProspect?.id`), `authUserId`, `onConverted`/`navigate`. All seven states and four effects move verbatim. Stage A: none needed (the submit is IO, not calc).

### `activity` — Activity (per-day team calling stats, dev/assistant)

- **Render location:** `topTab === 'customers' && activeTab === 'activity' && canAccessActivityTab` (~2671–2725): last-30-days date-grouped tables (User | Marked | Updated), days with all-zero rows hidden.
- **Owned local state:** `teamDataByDate` (`Record<string, ProspectTeamRow[]>`), `teamLoading`.
- **Cross-tab/shared state:** none. Gate `canAccessActivityTab` computed in the parent.
- **Handlers/loaders:** `loadTeamActivity` (useCallback) → [`loadProspectTeamActivity`](../src/lib/prospectTeamActivity.ts) — **already a Stage-A'd lib kernel**, shared with Quickfill's team line chart (Marked = unique prospect_ids/day from `prospect_timer_events`; Updated = from `prospect_comments`).
- **Derived values:** an inline IIFE builds the 30 date keys and filters `visibleRows` — [`prospectTeamActivityChartData.ts`](../src/lib/prospectTeamActivityChartData.ts) already exports `getOrderedDateKeysLast30Days`; reuse it instead of re-extracting.
- **Supabase tables (via the lib):** `users`, `prospect_timer_events`, `prospect_comments`.
- **Extraction status + risk + approach:** Inline. **Lowest risk — extract first** → `ProspectsActivityTab`. Props: none beyond an optional `active` gate (the loader is role-gated inside `loadTeamActivity` already; pass `canAccess` or keep the parent render gate). This is the momentum-builder that validates the seam, exactly like `bid-costs` was for Bids.

### `team` — Hiring (hiring board) — extracted wrapper

- **Render location:** `topTab === 'team' && teamProspectsAccess && authUser?.id` → `<TeamProspectsTab authUserId={authUser.id} isDev={authRole === 'dev'} resolveMasterId={getEffectiveMasterId} />` (~1635–1637).
- **Owned state in parent:** none. `getEffectiveMasterId` (assistant → first `master_assistants.master_id` adoption; dev/master → self) stays in the parent because `saveNewProspect` also uses it.
- **Extraction status:** **Done at page level.** The component itself is the surface's second God component — see the next section.

## TeamProspectsTab sub-decomposition

[`TeamProspectsTab.tsx`](../src/components/prospects/TeamProspectsTab.tsx) (1,820 lines) renders the four-stage hiring pipeline (`Screen → Interview → Hire → Review` sub-tabs with live counts) plus six modals built through a shared `modal(title, body, onClose, opts)` factory and a shared `modalError` state.

**Already extracted from it** (the pattern is working — keep going):
- [`ratingDimensions.tsx`](../src/components/prospects/ratingDimensions.tsx) — `RATING_DEFS`, `RatingKey`, `COMMENT_KEY_BY_RATING`, `RatingSliders` (v2.948, shared with Review).
- [`TeamReviewSection.tsx`](../src/components/prospects/TeamReviewSection.tsx) (688 lines, fully self-contained: own loaders for `users`, `team_member_reviews`, RPCs `list_team_member_recent_jobs` / `list_team_member_start_dates` / `crew_review_aggregates` (the anonymous crew lane, v2.2827 — `latestCrewLane` span on each Reflect card; dev gear toggle `team_review_composite_include_crew_v1` feeds `crewPseudoReviews` into the composite + leaderboard), `app_settings` composite weights; kernels in `src/lib/prospects/` — `teamMemberReviews.ts`, `reviewerCalibration.ts`, `teamComposite.ts`, `teamLeaderboard.ts`, `teamReviewDue.ts`, all tested).
- [`LinkifiedText.tsx`](../src/components/prospects/LinkifiedText.tsx), [`TeamMemberRatingChart.tsx`](../src/components/prospects/TeamMemberRatingChart.tsx).
- Lib kernels: [`teamProspectRanking.ts`](../src/lib/teamProspectRanking.ts) (`UNSORTED_ROLE_KEY`, `groupTeamProspects`, `reorderActiveTeamProspects`, `moveTeamProspectAcrossRoles`, `nextTeamProspectRank`, `roleKeyOf` — 21+ tests) and [`teamProspectSourceSummary.ts`](../src/lib/teamProspectSourceSummary.ts) (`summarizeTeamProspectSources`, `distinctTeamProspectSources` — tested).

**Module-level components in the file** (pure-props, can move to own files verbatim): `CandidateLinkChips`, `CandidateRatingBars`, `CandidateFields`, `SortableCandidateCard`, `RoleColumn`; helpers `parseCandidateLinks` / `serializeCandidateLinks` (pure, **untested** — Stage-A candidates), `formatLastContact`, `dropId`, `boardCollisionDetection` (custom dnd-kit collision: `pointerWithin` → `rectIntersection` → `closestCorners`).

**Internal shared substrate** (would become `useTeamProspectsData` if stages are split): `rows`, `roles`, `loading`, `busy` (one flag for every mutation), the monolithic `load()` (6 parallel queries: `team_prospects`, `team_prospect_roles`, `team_prospect_reviews`, `team_onboarding_items`, `team_prospect_onboarding_statuses`, active-`users` count; plus a follow-up reviewer-names query), `setStatus(candidate, status)` (used by Screen, Interview, Hire, and the Passed bucket; `status === 'hired'` opens the roster-handoff modal), `markContacted`, `openEdit`/`editTarget`/`editDraft`, `modalError`, and the derived-per-render values `activeByRole`/`calling`/`hired`/`passed` (from `groupTeamProspects`), `reviewsByProspect`, `roleNameById`, `referencedCountByRole`, `sourceSummary`, `knownSources`.

Per-stage inventory:

- **Screen** (`stage === 'screen'`, ~1218–1300 + `SortableCandidateCard`/`RoleColumn`): DndContext board, one `RoleColumn` per `team_prospect_roles` row + virtual Unsorted column (renders only when non-empty). Owned: `addingRole`, `newRoleName`, `confirmDeleteRoleId`, `passedOpen`, `sourcesOpen`. Handlers: `handleDragEnd` (optimistic `applyListsToRows` + `persistRankUpdates`, per-row parallel UPDATEs, full `load()` revert on failure; hired/passed rows can't be dragged), `addRole`, `deleteRole` (FK `23503` friendly message), `openAdd`. Also hosts the collapsible **Passed** bucket (`bucketSection`) and the **Source success** table (`sourceSummary`).
- **Interview** (`stage === 'interview'`, ~1302–1400): read-only per-role columns of `calling` candidates with tap-to-call links, everyone's reviews (numbers + per-dimension comments), and the **My review** modal. Owned: `reviewTarget`, `reviewDraft` (`ReviewDraft`), plus `reviews`/`reviewerNames` (loaded centrally). Handlers: `openReview`, `saveReview` (upsert `onConflict: 'team_prospect_id,reviewer_user_id'`).
- **Hire** (`stage === 'hire'`, ~1401–1514 + settings modal ~1725–1817): onboarding tracker. Owned: `onboardingItems`, `onboardingStatuses` (Map keyed `` `${prospectId}:${itemId}` ``; missing = pending), `onboardingSettingsOpen`, `newItemLabel`, `newItemLink`, `itemDrafts`, `hireTarget`, `hireKind`. Handlers: `cycleOnboardingStatus` (optimistic red→yellow→green→red upsert), `addOnboardingItem`, `saveOnboardingItem`, `moveOnboardingItem` (index-based position swap to untangle legacy duplicates), `deleteOnboardingItem`, `addHireToRoster` (INSERT into `people` — note it uses `master_user_id: authUserId`, **not** `resolveMasterId`, unlike `saveNewCandidate`).
- **Review** (`stage === 'review'`): thin `<TeamReviewSection … onOpenScreenBoard={() => setStage('screen')} />`. Done.
- **Cross-stage modals:** Add candidate (`addOpen`/`addDraft`), Edit candidate (`editTarget`/`editDraft`/`confirmingDelete` — opened from Screen cards, Hire rows, and the Passed bucket → stays at TPT level), My review, Hire-to-roster, Onboarding settings.

**Supabase tables (whole component):** `team_prospects` (SELECT/INSERT/UPDATE/DELETE; jsonb `links` written `as unknown as string`), `team_prospect_roles`, `team_prospect_reviews`, `team_onboarding_items`, `team_prospect_onboarding_statuses`, `users` (count + reviewer names), `people` (roster handoff INSERT). Reviews/onboarding load errors are swallowed by design (additive UI while migrations roll out).

**Sub-decomposition approach:** the component is *within* budget for now but churning fast. If it keeps growing: (1) move the five module-level components + `parseCandidateLinks`/`serializeCandidateLinks` to own files (pure moves, do anytime); (2) extract the Hire stage (`TeamHireStage`) first — its onboarding cluster is used nowhere else; (3) then Interview; (4) Screen last (it owns the drag machinery and the Passed/Sources sections). `rows`/`roles`/`load`/`busy`/`setStatus`/`openEdit` stay in TeamProspectsTab and are passed down, mirroring the page-level rule.

## Page-level modals

| Modal | State | Opened from | Verdict |
|---|---|---|---|
| Edit Prospect (~2728) | `editModalOpen`, `editingProspect` (null ⇒ edits `currentProspect`), `edit*` field cluster, `handleDeleteProspect`/`saveEdit` | Follow Up "Edit" button (`openEditModal`) AND Prospect List row actions (`openEditModalForProspect`) | **Stays in parent** (2 tabs) |
| New Prospect (~3267) | `newProspectModalOpen`, `new*` field cluster, `newProspectError`, `saveNewProspect` (uses `getEffectiveMasterId`, reloads both caches) | "New Prospect" button in the Customers tab row (any sub-tab) + `?newProspect=true` deep link from Dashboard | **Stays in parent** (tab row + URL) |
| Callback (~2856) | `callbackModalOpen`, `callbackDate`/`callbackTime`/`callbackNote`, `saveCallback` | Follow Up only | Moves with Follow Up |
| Copy template edit (~2933) | `editingCopyTemplateKey`, `editingCopyText`, `editingCopySubject`, placeholder-insert chips via `copyTemplateTextareaRef` | Follow Up only | Moves with Follow Up |
| Copy blank fields (~3069) | `copyBlankFieldsModalOpen`, `copyBlankFieldsList` | Follow Up only | Moves with Follow Up |
| Timer history (~3114) | `timerHistoryModalOpen`, `timerEvents`, `timerEventsLoading` | Follow Up timer button | Moves with Follow Up |
| My time (~3188) | `myTimeModalOpen`, `myTimeStats` (+ live `followUpTimerSeconds` session bonus when `activeTab === 'follow-up'`) | Follow Up footer | Moves with Follow Up |

## URL / navigation router (parent, permanent)

- `?tab=` effect: `team` requires `teamProspectsAccess` (else rewrite to `follow-up`, `replace: true`); `activity` requires `canAccessActivityTab` (else rewrite); missing tab defaults to `follow-up` (written into the URL).
- `?prospect_id=`: read by `loadFollowUpProspects` (fetch-and-prepend when missing from the list), by the index-sync effect, and by the Prospect List selection effect (which also opens the right sentinel section, then strips the param). Written by `updateUrlProspectId` on every prospect advance/removal and by `selectProspectForList`.
- `?newProspect=true` (from Dashboard): opens the New Prospect modal, strips the param.
- `?stage=` (from the "Team reviews due" Dashboard banner, `/prospects?tab=team&stage=review`): handled **inside** TeamProspectsTab — applied once, then stripped.
- `setTab` / `openTeamTab` write `?tab=` and delete `prospect_id`.

All of this stays in the parent (playbook rule), except `?stage=` which already lives in the extracted component.

## Stage-A pure-logic inventory

Extract to `src/lib/*` + colocated tests **before** any component moves. Everything in the first group is already a module-level pure function in `Prospects.tsx` — the moves are mechanical.

| Candidate | Currently | Target |
|---|---|---|
| `substituteCopyPlaceholders`, `getBlankPlaceholderFields`, `getBlankFieldsForMail` + the `COPY_TEMPLATE_KEYS`/`APP_SETTINGS_KEYS`/`APP_SUBJECT_SETTINGS_KEYS` constants | module-level in `Prospects.tsx` | `lib/prospects/prospectCopyTemplates.ts` + tests (placeholder substitution, `_______` per-template behavior, blank-field detection incl. the `forMail` prospect-email rule) |
| `formatDateTime`, `formatDaysSince`, `formatDueBadge`, `formatInteractionType`, `formatTimerButtonName`, `formatTimerSeconds`, `formatWebsiteDisplay`, `getWebsiteHref` | module-level in `Prospects.tsx` | `lib/prospects/prospectFormat.ts` + tests (check for existing shared equivalents first) |
| Prospect List grouping IIFE (search filter, status buckets w/ sentinel keys −1/−2, warmth Map, `last_contact` desc sort) | inline IIFE in the tab JSX | `lib/prospects/prospectListGrouping.ts` + tests; align with [`prospectWarmthCounts.ts`](../src/lib/prospectWarmthCounts.ts) |
| `handleSendBack` re-insert comparator (`last_contact` asc, `company_name` tiebreak) | inline in handler | fold into the grouping lib + test (note it approximates but doesn't exactly match the server's `nullsFirst` order — preserve as-is) |
| `loadProspectLedgerSecondsMap` grouping + `loadMyTimeStats` window sums | inline reduce loops | pure `sumTimerSecondsByProspect(rows)` / date-window helpers + tests |
| Activity 30-day date-key loop | inline IIFE | reuse `getOrderedDateKeysLast30Days` from [`prospectTeamActivityChartData.ts`](../src/lib/prospectTeamActivityChartData.ts) — do not re-extract |
| `parseCandidateLinks`, `serializeCandidateLinks` | module-level in `TeamProspectsTab.tsx`, untested | `lib/prospects/candidateLinks.ts` + tests (bad-shape drops, protocol prepend, type default) |
| `formatLastContact` (Team) | module-level in `TeamProspectsTab.tsx` | fold into `prospectFormat.ts` |
| `loadProspectTeamActivity`, `teamProspectRanking`, `teamProspectSourceSummary`, `src/lib/prospects/*` review kernels | **already in lib with tests** | — (reference implementations) |

## Preserve-quirks list (odd but load-bearing — do not "fix" during the move)

1. **`prospect_timer_events` is queried via `(supabase as any)`** everywhere (5 call sites), and `service_types` via `as any` in Convert — generated types are incomplete for these. Keep the casts until types are regenerated in a separate pass.
2. **Calling locks are advisory, taken on intent, and expire** (v2.2850 — before it they were steal-on-view with no expiry, journey-map #14(b)): `takeCallingLock` runs once per prospect per tab on the first dial / composer focus / Didn't Answer–Answered / Set callback; a colleague's row younger than `CALLING_LOCK_TTL_MS` (30 min) is never overwritten (the card shows "<name> is calling this one" and the call may go on); an older row is taken over. `loadFollowUpProspects` hides only live rows held by *others* at load time. Cleanup deletes only the row this tab wrote (`lockTakenForRef`), never a colleague's. There is no purge job — staleness is a read-side rule.
3. **`?prospect_id` fetch-and-prepend** in `loadFollowUpProspects` deliberately shows a prospect even when it's `not_a_fit`/`cant_reach` or locked — Prospect List and Quickfill must be able to open anything.
4. **Timer semantics**: `followUpTimerSeconds` resets on tab re-visibility and on every prospect advance; a `prospect_timer_events` row is written only by `saveTimerEvent` for `no_longer_fit` / `next_prospect` / `cant_reach`. `handleDidntAnswer`'s auto-advance calls `handleNextProspect(true)` — **no timer event, no lock delete, no `loadMyTimeToday`** on that path (the lock-effect cleanup still releases the lock).
5. **Live "session bonus"**: the `all time` / `my day` readouts and the My time modal add the running `followUpTimerSeconds` to DB sums (modal only when `activeTab === 'follow-up'`); yesterday intentionally gets no bonus.
6. **Last Contact display** on the Follow Up card prefers `comments[0]?.created_at` over `prospects.last_contact`; `handleAnswered`/`handleDidntAnswer`/`handleAddComment` all bump `prospects.last_contact` to now after inserting the comment.
7. **Copy-template override fallback**: an override that is `null` **or** empty string falls back to the app_settings default (`getResolvedCopyText`); the save upsert writes `subject_text: editingCopySubject || null`.
8. **`handleOpenMail` fires the mailto first**, then upserts `prospect_email_sent` — the envelope-check icon is per user+prospect+template.
9. **One global `saving` flag** across all Customers-tab mutations; TeamProspectsTab has its own equivalent `busy`. Keep each scope intact.
10. **Edit modal dual identity**: `editingProspect === null` means "editing `currentProspect`" (Follow Up); set means "editing this list row" (Prospect List). `handleDeleteProspect` handles both and re-points the Follow Up index.
11. **Prospect List sort differs from Follow Up sort** (list groups sort `last_contact` **desc**; Follow Up queue is asc-nullsFirst "coldest first"). Both are intentional.
12. **Convert never touches the prospect row** — no status change, no delete; the submit button lives outside `NewCustomerForm` via `form="convert-customer-form"`; new bids hardcode `materials_model: 'rough'`.
13. **`getEffectiveMasterId`** takes the *first* `master_assistants` adoption for assistant-like roles and falls back to self. Used by `saveNewProspect` and passed to TeamProspectsTab as `resolveMasterId` — but `addHireToRoster` inside TPT uses raw `authUserId` as `people.master_user_id` instead. Preserve the inconsistency.
14. **TeamProspectsTab drag rules**: `boardCollisionDetection` order matters (source-column bias fix); `PointerSensor` activation distance 8; hired/passed rows are drag-inert; rank updates are optimistic with a full `load()` revert; modal role changes append to the bottom of the target column via `nextTeamProspectRank`.
15. **Role deletion** requires `referencedCountByRole === 0` counting **all** statuses (including Hired/Passed); the DB backs this with `ON DELETE RESTRICT` (code `23503` gets a friendly message).
16. **Reviews / onboarding / tenure load errors are swallowed** (additive UI while migrations roll out) — `reviewsRes.error ? [] : …` etc.
17. **`?stage=` deep link is applied once then stripped** so later tab-hopping doesn't snap back; same one-shot pattern as `?newProspect=true` and the Prospect List `?prospect_id`.
18. **Activity tab hides a day entirely** when every user's Marked and Updated are 0; date labels render via `new Date(dk + 'T12:00:00')` (noon guard against TZ off-by-one).
19. **`commentInputRef` is a state, not a ref** — the auto-resize effect depends on it; keep it a state so the effect re-runs when the node mounts.
20. **`handleAddQuickNote` uses `window.prompt`** and `handleDeleteProspect`/`handleDeleteFromList` use `window.confirm`. Keep them (no modal redesign during the move).

## Recommended extraction order (value ÷ risk)

1. **Stage A sweep** — the [pure-logic inventory](#stage-a-pure-logic-inventory) above; each independently shippable. Highest leverage: `prospectCopyTemplates.ts` (real business rules, zero tests today), `prospectListGrouping.ts`, `candidateLinks.ts`.
2. **`activity` → `ProspectsActivityTab`** — 2 states, 1 loader (already lib-backed), no shared writes. Validates the seam.
3. **`convert` → `ProspectsConvertTab`** — 7 owned states + 4 effects; props: prospect lists + `defaultProspectId` + `authUserId`.
4. **Data seam: `useProspectsData`** — `followUpProspects` / `prospectListProspects` / `currentProspectIndex` / `currentProspect` / `saving` / `loadFollowUpProspects` / `loadProspectListProspects` / `updateUrlProspectId` + the tandem-patch mutation helpers. Parent destructures; nothing downstream changes.
5. **`prospect-list` → `ProspectsListTab`** — consumes the seam; Edit Prospect modal and `selectProspectForList` navigation stay parent-owned callbacks.
6. **`follow-up` → `ProspectsFollowUpTab`** — the big one; moves its ~45 owned states, per-prospect effects, and 5 tab-local modals. Controlled selection (`currentProspect`, `onNext`, `onSelect`) and the Edit Prospect modal stay in the parent.
7. **TeamProspectsTab sub-decomposition** (independent track, can interleave): module-level components + link helpers to own files → `TeamHireStage` → `TeamInterviewStage` → (optionally) `TeamScreenBoard`, with `rows`/`roles`/`load`/`busy`/`setStatus`/`openEdit` staying in TeamProspectsTab.

**What must stay in `Prospects.tsx` permanently:** the `?tab=` / `?prospect_id=` / `?newProspect=` URL router and access-gate rewrites; `topTab`/`activeTab` + the tab-button rows; the selection pointer; the dual caches (via the seam hook); `saving`; the Edit Prospect and New Prospect modals; `getEffectiveMasterId`; the `canAccessFollowUp` / `canAccessActivityTab` / `teamProspectsAccess` gates.

Definition of done per tab, verification gates (`npm run typecheck && npm run lint && npm test` after every step), and anti-patterns: see [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md). Behavior-preserving only.
