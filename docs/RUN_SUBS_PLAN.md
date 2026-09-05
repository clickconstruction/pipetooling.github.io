# Running subs through Projects: phased code plan

---
file: docs/RUN_SUBS_PLAN.md
type: Engineering / Migration plan
purpose: Staged plan to make Projects/Workflow the surface for running subcontractors — person-id assignment spine, step commitments ("Behar does Rough In for $6,400"), settlement into the existing Sub Labor ledger, and a sub-facing money view. Written 2026-08-01 from a full code/docs audit; companion mockups in the "Running Subs through Projects" artifact.
audience: Developers, AI Agents
last_updated: 2026-08-01
---

## The thesis

Don't build a subs system — build the joints between the five that exist (workflow steps, sub sheets, schedule blocks, clock sessions, contracts). One new table (`step_commitments`) plus two nullable anchor columns on `people_labor_jobs` carries most of it. Everything keys on `people.id` per the PERSON_IDENTITY_PLAN invariant: **never key new logic on name text; person-id first, name fallback for reads.**

Ground rules inherited from that plan and CLAUDE.md:
- Every migration starts `SET lock_timeout = '3s';`; new tables end with BOTH `SELECT public.apply_read_only_write_blocks();` and `SELECT public.apply_read_only_stmt_blocks();`.
- Types are hand-added to `src/types/database.ts` (wholesale regen pulls unrelated drift).
- Names stay as denormalized display; a failed person resolution degrades to today's behavior, never worse.
- Each PR ships its RECENT_FEATURES.md entry + releaseNotes.ts entry (same v2.NNN), MIGRATIONS.md entry per migration, and a help guide when user-facing.
- RPC bodies: any bare `DELETE FROM temp_table;` needs `WHERE true` — pg_safeupdate is loaded on the PostgREST path (the v2.1173 trap).

## Key facts the plan builds on (verified 2026-08-01 at planning time; updated post-ship — Phases 0–4 have since landed, see the status log)

- `public.resolve_pay_person_id(p_name text)` exists (migration `20260722268000`): account-linked users match first, then unique active-people name match, NULL when ambiguous. The widened `set_person_id_on_write` trigger pattern is in `20260730164728`.
- `people_labor_job_assignees(labor_job_id, person_id)` exists, trigger-synced from the `' | '`-delimited `assigned_to_name` (migration `20260722270000`), backfilled — and **is now read by app code** (Subs HQ: `src/components/people/PeopleSubsTab.tsx`, plus the Phase 3 own-row RLS policies). Owner data cleanup raised junction coverage ("Behar Kraja (Rough In)" fixed, Kyle combined); remaining orphans: archived "Edgar" and the "MIke Rodriguez" question.
- `project_workflow_steps` **now HAS `assigned_person_id`** (migration `20260801130000`, PR 0.2 / v2.1201) with backfill, re-resolve trigger, and the 3-arg `update_step_assignment` RPC — workflow tables joined the identity plan's spine via this plan.
- The step lifecycle is **unified** (PR 0.1): both `src/pages/Workflow.tsx` and `src/components/dashboard/DashboardProjectsCard.tsx` run every transition through the shared kernel (`planStepTransition` in `src/lib/workflow/stepLifecycle.ts` + `sendStepLifecycleNotifications`). The Dashboard card now sends notifications and uses the `in_progress` reject cascade (the planned behavior changes shipped).
- The skipped-action CHECK bug is **FIXED** (PR 0.0, migration `20260801113000_widen_step_action_type_check.sql`): `project_workflow_step_actions.action_type` now accepts `'skipped'`, so Skip writes its ledger row like every other transition.
- Own-row RLS precedents: `clock_sessions` "Users can read own clock sessions" (`user_id = (select auth.uid())`), and the dual-path `people_pay_config` self-read (person_id link via `people.account_user_id` OR legacy `btrim(users.name) = btrim(person_name)`). Policies wrap `auth.uid()` in a subselect (InitPlan caching).
- `update_step_assigned_to(p_step_id, p_assigned_to_name)` is SECURITY DEFINER in the baseline (L17843); client calls RPC-first with direct-UPDATE fallback.
- The Sub Labor form's crew picker HAS ids in hand (`byKind()` returns `users.id`/`people.id`) but discards them at the roster-builder boundary — state is `string[]` of names; the DB trigger re-resolves.
- Kernel conventions: pure named-export modules in `src/lib/` with colocated vitest `*.test.ts`; no Supabase imports in kernels; I/O in separate `fetch*.ts` files.

## Decisions taken (defaults — flag in PR descriptions, easy to reverse)

1. **Reject cascade unifies on Workflow.tsx's behavior**: previous step reopens to `in_progress` (the Dashboard card's `pending` is the deviation). Behavior change on the card; called out in its PR.
2. **Commitment statuses stay minimal**: `draft → offered → accepted → approved → settled` (+ `cancelled`). "In progress"/"complete" are read from the step itself — one source of truth; the UI rail merges them visually.
3. **Sub-facing money lives on the Dashboard** (extends the existing card surface; no new route, no nav/allowlist change).
4. **Commitment write roles mirror sub-sheet RLS** (dev, master, assistant, estimator... see 2.1 for exact set); superintendents read + can mark `accepted`, cannot create or settle.
5. **Settlement creates/updates a real `people_labor_jobs` row** — the Sub Labor tab remains the single AP ledger; Projects feeds it instead of paralleling it.

---

## Phase 0 — Spine (no visible change except the bugfix)

### PR 0.0 — fix the skipped-action CHECK (migration only, ships alone)
- `supabase/migrations/<ts>_widen_step_action_type_check.sql`: drop + re-add `project_workflow_step_actions_action_type_check` with `'skipped'` added (idempotent: `ALTER TABLE ... DROP CONSTRAINT IF EXISTS`, then ADD). Update the column comment.
- No client change (both callers already send `'skipped'`). Optional follow-up in the same PR: make both `recordAction`s log insert errors to console so the next silent failure isn't invisible.
- MIGRATIONS.md entry. `supabase db push` after merge.

### PR 0.1 — one lifecycle kernel, two thin executors
New `src/lib/workflow/stepLifecycle.ts` (+ `stepLifecycle.test.ts`), pure:

```ts
export type StepTransition = 'start' | 'complete' | 'approve' | 'reject' | 'skip' | 'reopen'
export type LifecyclePlan = {
  stepUpdate: Record<string, unknown>            // columns for the acted-on step
  cascade: { stepId: string; update: Record<string, unknown>; actionNote: string } | null
  actions: { stepId: string; actionType: string; notes: string | null }[]
  notifications: NotificationIntent[]            // template type, recipient name, extra vars, push fields
}
export function planStepTransition(input: {
  transition: StepTransition
  step: StepLifecycleRow                          // id, status, name, assigned_to_name, notify_* flags, next_step_rejected_notice
  prevStep: StepLifecycleRow | null               // by sequence_order
  nextStep: StepLifecycleRow | null
  actorName: string
  nowIso: string
  reason?: string                                 // reject/skip
  startAtIso?: string                             // start override
}): LifecyclePlan
```

- Encodes exactly today's Workflow.tsx semantics (payloads quoted in the audit): start `{started_at, status:'in_progress'}`; complete/approve with `ended_at`/`approved_by`/`approved_at` + the rejected-next-step reopen cascade; reject with the prev-step `in_progress` reopen or notice-stamp; skip (no notifications, `'skipped'` action row — legal after PR 0.0); reopen clears the six fields.
- Notification intents reproduce the `sendWorkflowNotifications` table (assignee / subscribers / next-assignee "Your turn" push / prior-assignee on reject). Recipient *resolution* (name → users/people email) moves to `src/lib/workflow/stepNotificationRecipients.ts` so both surfaces share `getContactForName`.
- Rewire `Workflow.tsx` and `DashboardProjectsCard.tsx` to plan-then-execute. Each keeps its own refresh (`refreshSteps()` vs `loadAssignedSteps()`), toasts, and UI behavior (v2.1189 collapse/advance stays in Workflow.tsx). **The Dashboard card starts sending notifications and adopts the `in_progress` reject cascade** — both called out as behavior changes.
- Tests pin every transition's payloads, both cascades, and skip's empty notification list.

### PR 0.2 — person-id assignment on workflow steps (migration + client)
- Migration `<ts>_step_assigned_person_id.sql`:
  - `ALTER TABLE project_workflow_steps ADD COLUMN IF NOT EXISTS assigned_person_id uuid REFERENCES people(id) ON DELETE SET NULL;` + partial index `WHERE assigned_person_id IS NOT NULL`.
  - Backfill: `UPDATE ... SET assigned_person_id = resolve_pay_person_id(assigned_to_name) WHERE assigned_person_id IS NULL AND btrim(coalesce(assigned_to_name,'')) <> '';`
  - Trigger `steps_set_assigned_person_id` BEFORE INSERT OR UPDATE OF `assigned_to_name` (COALESCE re-resolve pattern from `20260730164728`; blank name → NULL id).
  - New 3-arg `update_step_assignment(p_step_id, p_assigned_to_name, p_person_id uuid DEFAULT NULL)` with the same SECURITY DEFINER permission block as `update_step_assigned_to`; explicit `p_person_id` wins, else trigger resolves. Keep the old 2-arg function as-is (old clients; deploy-order safe).
- Client: Workflow Assign modal + `StepFormModal` + the Forecast stage modal stop discarding ids — roster entries carry `{ name, personId }`; save calls the new RPC (fallback: old RPC → direct update, name-only). `get_assigned_steps_*` dashboards keep name matching for now (reader flips are cheap later; the RPC's self-name check is unchanged).
- Hand-add column + RPC to `database.ts`. MIGRATIONS.md. Push after merge (client is order-safe: new RPC missing → falls back).

### PR 0.3 — project/step anchors on sub sheets (migration + read path)
- Migration `<ts>_sub_sheet_project_step_anchors.sql`: `people_labor_jobs` + `project_id uuid REFERENCES projects(id) ON DELETE SET NULL`, `step_id uuid REFERENCES project_workflow_steps(id) ON DELETE SET NULL`, partial indexes. No behavior change.
- Client: `useSubLaborLedger` selects the new columns; ledger rows render a small project chip when set (link → `/workflows/:projectId`). `JobsSubLaborFormModal` gains an `openNewWithStepContext({ projectId, stepId, ... })` handle (used by Phase 2 settlement; no manual picker yet).
- Hand-add columns. MIGRATIONS.md. Push after merge.

**Data prerequisites to schedule with the owner (in-app, no code):** Combine "Behar Kraja (Rough In)" into Behar Kraja; resolve "Kyle" ×2 (combine or rename); "Edgar"/"MIke Rodriguez" cleanup. Raises junction coverage before Phase 3 RLS relies on it.

---

## Phase 1 — Make Projects worth opening daily (client-only, after 0.2)

### PR 1.1 — run-of-show rows: phase bar + current-step chip + attention pills
- New kernel `src/lib/projects/projectAttention.ts` (+tests): from a project's steps (status, sequence, started_at, assigned name, expected dates) compute `{ currentStep, daysInStep, flags }` where flags ⊂ {`waiting` (in_progress/pending current step with assignee, N days), `unassigned-current`, `no-schedule` (current step lacks expected dates), `rejected-present`}. Day math via `APP_CALENDAR_TZ` helpers in `utils/dateUtils.ts` — do not re-derive locally (the ymd helpers are already triplicated in this area; reuse, don't add a fourth).
- `Projects.tsx`: replace the full text step-chain with a segmented phase bar (one flex segment per step, colored by the existing `getStepStatusStyle` palette, theme tokens for pending/skip); current-step chip (name · assignee · "N days in step"); attention pills. Keep the text chain behind the row's existing expand/hover if trivial, else drop (the bar + chip carry the same info).
- Default sort: needs-attention first, then by status. Guide `see-project-status-at-a-glance`. Release notes.

### PR 1.2 — money strip on Projects rows
- One batched load for the visible projects: `workflow_projections` (sum per workflow) + `workflow_step_line_items` (sum per workflow via step ids already fetched). Reuse the row shapes `buildWorkflowMoneyFlow` consumes — no new math, just sums.
- Row strip: `Projected $X · Spent $Y` (dev/master only, matching the Workflow page's gate). `Committed` slot renders only when Phase 2 data exists (feature-detects the table via fail-soft select).

### PR 1.3 — "Subs on this project" strip on the Workflow header
- Distinct assignees across steps joined to `people` by `assigned_person_id` (name fallback), badge `kind='sub'`, per-person step count + current step. Pure kernel `src/lib/workflow/projectSubRoster.ts` (+tests). Client-only.

---

## Phase 2 — Commitments (the one genuinely new object)

### PR 2.1 — `step_commitments` table (DB only)
```sql
CREATE TABLE IF NOT EXISTS public.step_commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id uuid NOT NULL REFERENCES public.project_workflow_steps(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE RESTRICT,
  display_name text NOT NULL,                      -- denormalized, display + fallback
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  retainage_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (retainage_pct >= 0 AND retainage_pct <= 100),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','offered','accepted','approved','settled','cancelled')),
  labor_job_id uuid REFERENCES public.people_labor_jobs(id) ON DELETE SET NULL,  -- settled sub sheet
  notes text,
  offered_at timestamptz, accepted_at timestamptz, approved_at timestamptz, settled_at timestamptz,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
```
- Partial unique index: one non-cancelled commitment per (step_id, person_id).
- RLS: write roles = the sub-sheet set (dev / master via project ownership chain / assistant / controller via `is_assistant()` / estimator to match `people_labor_jobs` policies); superintendent UPDATE limited to `status: offered → accepted` is enforced client-side (RLS grants them UPDATE on rows for projects they're assigned to; keep the DB simple, mirror `project_superintendents` access). Sub own-row SELECT ships now (dual-path: `people.account_user_id = (select auth.uid())` via person_id OR `btrim(users.name) = btrim(display_name)` — the `people_pay_config` precedent).
- Read-only blocks (both calls). Types hand-added. MIGRATIONS.md. Nothing reads it yet — dormant-groundwork pattern (like v2.1165).

### PR 2.2 — work-order panel on the step card
- First file in a new `src/components/workflow/`: `StepCommitmentPanel.tsx` (the WORKFLOW_PAGE_ARCHITECTURE decomposition plan finally gets its directory). Renders per the Option B mockup: sub chip, amount, state rail (commitment states + step status merged), draws/backcharges summary when a `labor_job_id` exists (reuse `subLaborJobBalance`), buttons per role.
- Kernel `src/lib/workflow/stepCommitments.ts` (+tests): rail-state derivation, balance math (`amount − retainage − paid`), permission predicates.
- CRUD: add (roster picker with person_id — same source as the Assign modal), offer (stamps `offered_at`, fires the existing `stage_assigned_started`-style notification through the shared recipient resolver; a dedicated `commitment_offered` email template can come later), accept, cancel. Collapsed step cards get a `$amount · state` pill. The Projects-row `Committed` sum (1.2) activates.
- Gate: panel visible to `canManageStages`; amounts visible per the same money gate as line items (`canManageStages`), edit per decision 4.

### PR 2.3 — settlement: approve releases the money
- Migration `<ts>_settle_step_commitment_rpc.sql`: `settle_step_commitment(p_commitment_id uuid, p_dry_run boolean DEFAULT false)` SECURITY DEFINER, staff-gated like the sub-sheet write roles:
  - Ensures a `people_labor_jobs` row: creates one (master = project's `master_user_id`, `assigned_to_name` = display_name → junction syncs via existing trigger, one `people_labor_job_items` row with `direct_labor_amount = amount`, `project_id`/`step_id` anchors, `job_number` from the project's linked job when unambiguous) or updates the linked one. Sets `status='settled'`, `settled_at`, `labor_job_id`.
  - Retainage: settle `amount × (1 − retainage_pct/100)` as the direct item; a second item row labeled `Retainage` for the remainder ships when released (v2 — out of scope; the pct is stored from day one).
  - `p_dry_run` via the rollback-sentinel pattern (`merge_user_accounts` / `migrate_job_ledger_costs_to_bid_and_delete` precedent). Remember `WHERE true` on any temp-table DELETE.
- Client: "Record draw" (opens the existing payment modal against the linked/created sheet), "Approve walk → release $X" (runs `settle_step_commitment`, then the normal step-approve through the lifecycle kernel — two explicit calls, no hidden coupling in `markApproved`).
- Deploy order: push before merge-deploying the client PR half, or ship as DB-then-client PRs like v2.1165→v2.1166. Guide `pay-a-sub-per-step`.

---

## Phase 3 — Show them (sub-facing money + compliance)

### PR 3.1 — own-row RLS on the three sub-sheet tables (DB only)
- `people_labor_jobs` sub SELECT: junction-first (`people_labor_job_assignees` × `people.account_user_id = (select auth.uid())`) OR legacy name segment match (`EXISTS (SELECT 1 FROM users u WHERE u.id = (select auth.uid()) AND btrim(u.name) = ANY (SELECT btrim(seg) FROM unnest(string_to_array(coalesce(assigned_to_name,''), ' | ')) seg))`).
- `people_labor_job_items` / `people_labor_job_payments`: SELECT via parent-EXISTS (the `plja_select` pattern).
- SELECT only — no sub writes anywhere. Test with the 9-role matrix; verify the office-side policies are untouched (additive policies only).

### PR 3.2 — Dashboard "Your money" section for sub-like roles
- New `DashboardSubMoneySection.tsx` + kernel reuse (`subLaborOutstanding` is already pure). Balance headline, per-sheet lines (job/project label, cost, paid, open), payment/backcharge history, accepted-commitment lines (own-row SELECT from 2.1). Renders only for `isSubcontractorLikeRole` (no allowlist change — Dashboard is already theirs). Fail-soft when RLS/migration not yet pushed (empty → section hidden), so client/DB deploy in either order.
- `AssignedStageCard` gains the commitment `$` chip for the assignee.
- Guide `see-what-youre-owed-as-a-sub`. Release notes.

### PR 3.3 — compliance documents (migration + kernel)
- Migration: `person_contract_documents` + `doc_type text NOT NULL DEFAULT 'agreement' CHECK (doc_type IN ('agreement','coi','w9','license','other'))`, `expires_at date`, and `person_id uuid REFERENCES people(id) ON DELETE SET NULL` with the standard backfill (`resolve_pay_person_id(person_name)`) + `set_person_id_on_write`-style trigger (contract tables were not covered by Phase B — this brings them into the identity spine).
- Kernel `src/lib/people/subCompliance.ts` (+tests): docs → per-person badges (`agreement: signed|missing`, `coi: valid|expiring<30d|expired|missing`, `w9: present|missing`).
- UI: PeopleContractsTab gains the type + expiry fields on upload/send; warning chips in the Workflow Assign modal and the commitment panel ("⚠ COI expired — assign anyway?"). Warn, never block.

### PR 3.4 — Subs HQ (People → Subs tab)
- `PeopleSubsTab.tsx` per the Option C mockup: one row per sub (merge `users role='subcontractor'` + `people kind='sub'` through `account_user_id`; unlinked pairs show a "link account" nudge → existing People→Users flow). Columns: trades (from `subcontractor_service_type_ids` names), open commitments (step_commitments join), balance due (`buildSubLaborOutstandingByPerson` — flip its keying junction-first while touching it; note this is NOT identity-plan C1-7, which is the PeopleReviewTab `assigned_to_name` read and was closed in v2.1266), compliance badges (3.3), simple track record (settled count, backcharge count from payment rows < 0).
- Role gate: same as the sub-sheet ledger tab (dev/master/assistant-like/estimator; superintendents read-only like their Jobs access). PEOPLE_TABS_ARCHITECTURE.md section + guide.

---

## Phase 4 — Sub Dispatch (approved 2026-08-01; mockups in the "Phase 4 — Sub Dispatch" artifact)

The offer/answer loop: office offers work WITH a proposed window, the sub accepts/declines from their Dashboard, the Sub Board shows who's booked when. Decisions locked with the owner's approval: no offer auto-expiry (Withdraw + Nudge instead); declined orders keep the reason office-side but drop off the sub's view; accepting writes the step's expected dates only when EMPTY (mismatch flagged, never overwritten); answer notifications go to the order's creator, falling back to the project master.

- **PR 4.1 — schema + RPC + templates**: `step_commitments` status CHECK gains `declined`; `declined_at`/`decline_reason`/`proposed_start`/`proposed_end`; `respond_to_work_order(p_commitment_id, p_accept, p_reason)` (SECURITY DEFINER — the commitment's own account-linked person only, `offered` only, decline requires a reason; accept-writes-empty-dates lives server-side so every client gets it). Three `email_templates` seeds (`work_order_offered/accepted/declined`) — the edge function 404s on unknown types, so seeding rows means **no edge redeploy**. A declined row keeps the live (step, person) unique slot; re-offer reuses it.
- **PR 4.3 — sub answers**: offer cards atop `DashboardSubMoneySection` (amount, retainage, window) → Accept / Decline-with-reason via the RPC; fires `work_order_accepted/declined` to the creator (fallback project master).
- **PR 4.4 — office loop**: Offer gains the date-window inputs (seeded from step expected dates); rail gains Awaiting-answer/Declined; decline banner (reason + Re-offer / Offer someone else); Withdraw (offered→draft) + Nudge (resend); `work_order_offered` fired on offer. Kernel + tests updated.
- **PR 4.5 — Sub Board**: read-only `Subs` view on Projects → Forecast — lane per sub, bars = commitments × (step expected dates ?? proposed window), offered ghosted, overlap outlines. Pure lane/overlap kernel.
- **PR 4.6 — polish**: window-aware compliance chips (`buildSubComplianceBadges` + expiry-vs-window wrapper) in the work-order picker and the Assign modal; AssignedStageCard commitment chip.
- (PR 4.2 from the proposal folded into 4.1/4.3/4.4 — no separate notification PR needed once the edge-function investigation showed template rows suffice.)

## Dependency graph & suggested order

```
0.0 ──────────────────────────────► (independent, ship first)
0.1 ─► 0.2 ─► 1.1 ─► 1.2 ─► 1.3
        │
        └───► 2.1 ─► 2.2 ─► 2.3   (2.1 also needs 0.3)
0.3 ──────────┘
2.1 ─► 3.1 ─► 3.2                  (3.1 needs the junction coverage cleanup)
3.3 ─► 3.4                          (3.4 also needs 2.1 + 3.1 data)
```
Phases 1 and 2 interleave freely after 0.2/0.3. Every DB PR: file on main → `supabase db push` → then the dependent client PR merges (or same-PR when order-safe fail-soft is built in, as noted per PR).

## Explicitly out of scope (updated after Phase 4 shipped)

> The never-built polish and the roster decisions are tracked in [`to-dos/subs-residuals.md`](../to-dos/subs-residuals.md) (2026-09-05 sweep).

Still out of scope: outbound payment rails (ACH/Stripe payouts); hard compliance blocks; schedule blocks per step; any change to Jobs → Stages; retiring the HCP-string job link on sub sheets. ~~Sub accept/decline on offers~~ and ~~dedicated work-order email templates~~ both **shipped with Phase 4** (`respond_to_work_order` RPC + the `work_order_offered/accepted/declined` template seeds in migration `20260801220000`).

## Status log

- 2026-08-01 (Phase 4) — **Phase 4 SHIPPED** (v2.1216–v2.1222; 1219–1222 renumbered around the developments-settings train): dispatch schema + `respond_to_work_order` (+context return) + template seeds (no edge redeploy needed — the fn resolves by template_type); sub Accept/Decline cards; office offer loop (windows, Awaiting answer, decline banner + re-offer/withdraw/nudge); Sub Board lanes on Forecast; window-aware compliance chips + AssignedStageCard money chip. Deviations: Assign-modal compliance chips deferred (the work-order picker is the commitment moment and is covered); offers carry no expiry (Withdraw/Nudge per the locked decision).

- 2026-08-01 (later) — **Phases 0–3 SHIPPED** (v2.1199–v2.1214, PRs #895–#910 + the Subs HQ PR). Owner data cleanup done: Kyle combined (kept the original row, login moved onto it); "Behar Kraja (Rough In)" fixed on its 1 step + 2 sheets via SQL (triggers resolved ids/junction). Remaining name orphans: archived "Edgar", and the "MIke Rodriguez (Rough In)" vs "Miguel Rodriguez" question (owner decision pending). **Deliberate deviations from the plan**: PR 0.1's recipient-resolution module shipped as `src/lib/workflow/stepLifecycleNotifications.ts`, not the plan's `stepNotificationRecipients.ts` (same responsibility, different name); PR 0.3's `openNewWithStepContext` handle skipped (settlement creates sheets server-side); commitment statuses exclude a separate in_progress/complete (read from the step); offer/accept notifications deferred (no dedicated email template yet); step approval and settlement stay two explicit buttons (no combined "Approve → release"); compliance UI lives in the Subs HQ Documents expander, NOT PeopleContractsTab; assign-modal warning chips + AssignedStageCard commitment chip deferred as polish. **Phase 4 next** (sub accept/decline, schedule-per-step, dedicated notification templates) — pending owner review of 1–3 in daily use.
- 2026-08-01 — plan written (code audit: lifecycle handlers, RPCs, RLS precedents, identity-plan status, sub-sheet save path).
