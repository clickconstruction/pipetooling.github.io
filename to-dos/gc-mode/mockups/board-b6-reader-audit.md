# B6 reader audit: `step_commitments` and `person_contract_documents`

The evidence behind `board-b6.md`, calls 6 and 5. It was read on origin/main at a1137d746 on 2026-10-08, by Helper 2 with a search agent. Every line number comes from `git show origin/main:<path>`. Nothing was changed.

## 1. `public.step_commitments`

### Schema

**Migrations:**
- Created in `20260801150000_step_commitments.sql`.
- Altered in `20260801220000`, `20260902230000`, `20260904211244`, `20260905050035`, `20260906040000`, `20260906050000` and `20260906100000`.
- Its helpers and policies are in `20260905100000` and `20260905120000`.

**Columns:**
- **The party:** `person_id` is **uuid NOT NULL**, an FK to `people` ON DELETE RESTRICT (:20). `display_name` is text NOT NULL.
- **Anchors:** `step_id` (`project_workflow_steps`), `labor_job_id` (`people_labor_jobs`), `job_id` (`jobs_ledger`), and optionally `stage_window_id` (`job_stage_windows`).
- **Money:** `amount` (nullable only while draft) and `retainage_pct`.
- **Lifecycle:** draft, offered, accepted, declined, approved, settled, cancelled.
- **Offer and ESIGN signer fields:** `20260902230000:22-31`.
- **Picks:** `work_days` and `picked_*` (`20260906050000`).
- **Change requests:** `20260906100000`.
- The generated type has `person_id: string` (`database.ts:23872`).

**Checks:**
- The status list.
- An anchor: one of `step_id`, `labor_job_id` or `job_id` is set.
- The amount is set unless draft.
- `work_days` from 1 to 120; `picked_by` is sub or office.

**Unique indexes:**
- `(step_id, person_id)` while live.
- `(labor_job_id)` for sheet orders.
- `(job_id, person_id)` for job orders.
- `record_id`.

**Row-level security** (`20260905050035:97-144`):
- `sc_select`: `can_access_sub_work_order(...)`, OR the sub's own `person_id`, OR **`btrim(users.name) = btrim(display_name)`** (:104-107).
- Inserts, updates and deletes go to office roles, plus the superintendent for updates.
- The three blocks apply.

### Readers and writers

**SQL:**
- `settle_step_commitment` is final at `20260907130000:1009-1173`.
- `create_sheet_for_work_order` is final at `20260907120000:95-176`. **It inserts `people_labor_job_assignees(labor_job_id, person_id)` at :168-170.**
- `respond_to_work_order` (`20260905050035:265-385`) is allowed only for the sub's own `person_id`.
- `next_work_order_record_id` (:150-167) is shared WO-NN numbering.
- The sheet-delete trigger is at `20260904211244:49-60`.

**Client, Jobs → Subs:**
- `JobsSubsWorkView.tsx`: reads at :170. Writes: withdraw, extend, discard, signed on paper, then `create_sheet_for_work_order` (:435-439), stage window, change request. It nudges by `person_id` (:453-454).
- `workOrderBoardRows.ts:119-139,176-211`.
- `workOrderCoverage.ts:39-60`.
- `OffersQueue.tsx:164`.
- `rowForms.tsx:354`.
- The Pay view in `JobsSubLaborTab.tsx:133-140,203-208`.

**Client, editors:**
- `SubSheetWorkOrderPanel.tsx`: reads :200-208, person :237, saves :366-389, nudges :420-426 and :470-472.
- `WorkOrderAssemblerModal.tsx`: :180, :189, :451, :465-496.
- `quickSendWorkOrder.ts`: :64-65, :84-149, :159.
- `SheetStoryModal.tsx`: :141-142, :303-304.

**Client, the workflow step panel:**
- `useWorkflowStepsEngine.ts:248-256`.
- `StepCommitmentPanel.tsx`: :106, :121, :145, :155-160, :183, :234, :251-257.

**Client, Projects:**
- `Projects.tsx:469-498` (the *committed* total).
- `ProjectsForecastSubsTab.tsx:31-42`.
- `subBoardLanes.ts:107-133`.

**Client, Dashboard:**
- `DashboardProjectsCard.tsx:102-120`.
- `DashboardSubMoneySection.tsx:122-135,176`.
- `useUnpricedWorkOrders.ts:35`.

**Client, jobs:**
- `useJobWorkOrderCoverage.ts:33-40`.
- `useJobStagePlanInputs.ts:22`.
- `fetchWorkingStagePlanInputs.ts:33`.
- `offerNextStage.ts:58`.

**Client, schedule:**
- `subDispatchFetch.ts:38-62`.
- `subDispatch.ts:70-73`.

**Client, people:**
- `PeopleSubsTab.tsx:101`.
- `subsHqRows.ts:211-220`.
- `PersonDeskWorkOrdersSection.tsx:52-58`.
- `PersonDeskPortalSection.tsx:23`.
- `personDeskFacts.ts:45`.
- `PartnershipTimelineTab.tsx:92-98`.

**Edge functions:**
- `sub-portal`: :249-254, :279-284, :348-353.
- `submit-sub-portal`: :106, :249-256, :448-456, :468-472, :544-589, :620-628, :664.
- `crew-day-email-dispatch`: :113-142.
- `_shared/gcStages.ts:67-72` (used by `customer-portal` and `submit-portal-request`).
- `_shared/stagePlan.ts:202-204`.
- The `dev-mcp` catalog.

### What a row with `person_id` null and `company_id` set would break

- **R1.** NOT NULL, and the types that assume a string (`database.ts`, `subDispatch.ts:18`, `subDispatchFetch.ts:12`, `ProjectsForecastSubsTab.tsx:41`, `PeopleSubsTab.tsx:144`, `submit-sub-portal:454`).
- **R2.** Both `(…, person_id)` unique indexes treat NULLs as distinct, so duplicate live company orders would go through.
- **R3.** The `sc_select` name fallback. A same-named user sees a company's orders with Accept and Decline (`DashboardSubMoneySection.tsx:122-135`).
- **R4.** `respond_to_work_order` refuses every company row.
- **R5.** `create_sheet_for_work_order` **raises**, because `people_labor_job_assignees.person_id` is NOT NULL (`20260722270000:35`).
  - `settle_step_commitment`'s job path fails.
  - `submit-sub-portal:584` makes no sheet.
  - The Work view has already flipped the order to accepted first.
- **R6.** Sheets are linked by `assigned_to_name = display_name`. The name-sync trigger (`20260722270000:68-85`) can assign a company's sheet to a same-named person, or leave it unmatched.
- **R7.** The Work and Pay boards merge job orders into **every** sub sheet on the job (`workOrderBoardRows.ts:131`).
  - A company order lends its "Signed" and its amount to people's sheets (:134-139).
  - The same happens in the Pay view, the job strip (`useJobWorkOrderCoverage.ts:35-40`) and the sheet story (`SheetStoryModal.tsx:142`).
- **R8.** Lanes keyed by `person_id` collapse (`subBoardLanes.ts:112-133`, `subDispatch.ts:70-73`).
- **R9.** Nudges, offer emails, compliance chips and re-sends call `person_id`-keyed lookups with null.
- **R10.** The editors need a roster person, and their saves write `person_id` without clearing `company_id`.
- **R11.** Totals and counts include company rows: the project's committed money, the step chip, Needs You's drafts, the crew-day email and WO-NN numbering. The GC portal's stage card keeps the last row per window (`gcStages.ts:72`).

**Unaffected**, since they filter by `person_id`: the person desk sections, the partnership timeline, the sub portal's offers and days, every `submit-sub-portal` path, `subsHqRows` (which drops them), and `useWorkflowStepsEngine`.

## 2. `public.person_contract_documents`

### Schema

**Columns:**
- The baseline (`20250101000000_baseline.sql:22909-22933`) has **`person_name` text NOT NULL**, the signing token, the signer fields, and `contract_lineage_id` with `lineage_version`.
- **Added later:**
  - `doc_type` (agreement, coi, w9, license, other), `expires_at`, and **`person_id` uuid nullable → `people` ON DELETE SET NULL** (`20260801200000:17-25`);
  - `applied_version_date` and `signer_last_viewed_at`;
  - `sign_by` and `partnership_id` (`20260820210000`);
  - the form columns (`20260904220000`, `20260905010500`, `20260905013000`, `20260905020000`).

**Unique key:** `(person_name, contract_lineage_id, lineage_version)` (baseline:30073).

**Row-level security:** office and pay roles only, with no self-read. Signers reach rows only through service-role edge functions.

**Triggers:**
- `contract_docs_set_person_id` (`20260801200000:39-61`) fills a null `person_id` from `resolve_pay_person_id(person_name)`, and re-resolves on a rename.
- `contract_docs_set_form_template`.

### Readers and writers

- **By name:**
  - `PeopleContractsTab.tsx` (:647-651 loads all; :1083 filters by `person_name`; inserts, updates and deletes at :820-850, :1452-1564, :1616-1875);
  - `ContractLibraryModal.tsx:248-326`;
  - `materializePacket.ts:30-43`;
  - `hireWrites.ts:222`;
  - `LienWaiverSendModal.tsx:90,137-147`;
  - `useUsersTabRowSignals.ts:81-85`.
- **By `person_id`, with a name fallback:** `PeopleSubsTab.tsx:102-104,226-233`, `subsHqRows.ts:225-228`, `loadRailFacts.ts:27-48`, `PersonDeskPaperworkSection.tsx:43-56,101`.
- **By `person_id` only:** `StepCommitmentPanel.tsx:75-78`, `SheetStoryModal.tsx:175`, `SubSheetWorkOrderPanel.tsx:245-248`, `WorkOrderAssemblerModal.tsx:235-238`, `quickSendWorkOrder.ts:64`, the person desk, `loadPersonJourney.ts:136`, `PartnershipAgreementsTab.tsx:56-105`, `ContractScopeLibraryTab.tsx:72-76`.
- **SQL:**
  - `create_pending_contract_versions_after_book_save` (baseline:3357-3438) and the `update_contract_book_entry` rename cascade (`20260805110000:66-83`), by assignment `person_name`;
  - `list_my_contract_dashboard_prompts` (baseline:8994-9026), by name or email;
  - `generate_agreement_notice` (`20260820210000:56-113`), by `partnership_id`.
- **Signing**, by token or id, which works for any row:
  - `send-contract-for-signature`: :156-266. It files the sent copy under a people row **found by name**.
  - `get-contract-for-signer`: :69-161.
  - `accept-contract`: :137-331.
  - `ContractAccept.tsx`: :107-423. The consent `audience` is hard-coded to 'sub'.
  - `complete-contract-form-office`, `contract-form-paper-entry` and `open-contract-form-pdf`.
- **The portal's fallbacks:**
  - `sub-portal:308-316` lists `person_id` rows **plus rows with `person_id` null and `person_name` = the sub's name**.
  - `submit-sub-portal:287-319` (`sign_link`) treats the same match as ownership, then mints a signing token.
- **A planned reader:** `src/lib/gc/tradePortalState.ts:41`.

### What a company row would break

- **P1.** It still needs a `person_name`. The column is NOT NULL and part of the unique key, and the whole app matches on it.
- **P2.** The insert trigger turns a company row into a same-named person's.
- **P3, the name fallbacks:**
  - **Security:** `submit-sub-portal`'s `sign_link` (:293-297) lets a same-named sub **sign the company's document**, and `sub-portal:312-316` lists it.
  - The dashboard prompt and `get-contract-signing-link-for-self:36-48`, when the prompt flag is set.
  - Compliance badges and Gen. Cond. standing (`PeopleSubsTab.tsx:231`, `subsHqRows.ts:226`).
  - Chips (`loadRailFacts.ts:42`, `useUsersTabRowSignals.ts:81-85`).
  - People → Contracts with its bulk edits and deletes, the library modal, packets, hires and lien waivers.
  - The book's version and rename cascade.
  - `send-contract-for-signature`'s filing by name.
- **P4, unaffected:** token signing (`get-contract-for-signer`, `accept-contract`), and every reader that filters by `person_id` only.

**How `board-b6.md` uses this:**
- The statement of work stands alone (call 6), so R1 to R11 never arise.
- A company's papers keep this table's signing path. Their `person_name` is `gc-company:<id>`, which no name-matching reader in P3 can match, enforced by a CHECK and a trigger guard (call 5).
