# Sub sheet → job link: every system still matching by number

Status: converting (owner go 2026-09-07); A + E done v2.3059. Census taken 2026-09-07 (v2.3055 added `people_labor_jobs.job_ledger_id`, back-filled it, and moved the Team board, the stage → activity trigger and the superintendent access helper to the link). Everything below still resolves a sheet's job by comparing `job_number` to `jobs_ledger.hcp_number` as text. Delete a row when its system reads the link.

Why it matters: three different text rules are live at once — trimmed + case-insensitive (most sites), **case-sensitive** `btrim` only (`get_weekly_money_movement_payload`, `submit-sub-portal`), and `.ilike` (`useJobWorkOrderCoverage`, `SheetStoryModal`) — so the same sheet can be on a job in one report and unlinked in another. Only 6 of ~30 readers know the click number, so a click-only job is invisible to the rest. `job_number` is `varchar(10)`; anything longer is silently truncated and never matches. The link removes all three classes of bug.

Conversion rule for every row: read `job_ledger_id` first; keep the number match only as a fallback for `job_ledger_id IS NULL` rows for one release, then drop it. Use `resolve_job_ledger_id_by_number(text)` in SQL if a fallback is kept — never a new inline `lower(btrim(…))`.

## A · Money and reporting SQL — DONE v2.3059 (`20260907130000`)

## B · Edge functions (redeploy after each)

| Site | What it does | Change |
|---|---|---|
| `supabase/functions/sub-portal/index.ts:206-220` | Plans link on the sub's sheets: `jobs_ledger … .in('hcp_number', jobNumbers)` | select `job_ledger_id` on the sheets, `.in('id', ids)` |
| `supabase/functions/sub-portal/index.ts:336-366` | "Your days": office-set sheet days show the raw `job_number` text (line 365), no job lookup | embed `jobs_ledger!people_labor_jobs_job_ledger_id_fkey(hcp_number, click_number)` |
| `supabase/functions/submit-sub-portal/index.ts:366-372` | `mark_work_done`: finds the job to notify watchers with `.eq('hcp_number', job_number.trim())` — case-sensitive | `sheetRow.job_ledger_id` |
| `supabase/functions/submit-sub-portal/index.ts:410-425` | `progress`: same lookup to write `job_activity_events` + notify | same |

## C · Per-job client reads — DONE v2.3060

## D · Sheet → job maps over many sheets

| Site | What it does | Change |
|---|---|---|
| `src/lib/subWorkOrders/workOrderBoardRows.ts:104,121,133-141` | Work Orders board rows: `jobsByNumber` from `hcp_number` | `jobsById.get(sheet.job_ledger_id)` first; `subsTabRows.ts` follows automatically |
| `src/lib/subWorkOrders/sheetsNeedingWorkOrder.ts:86-109` | Which sheets still need a work order | same |
| `src/components/jobs/JobsSubLaborTab.tsx:166-179` | `spineFor()` merges job-anchored + sheet-anchored orders/bills/pay rules via `jobsByNumber` | id first |
| `src/components/jobs/JobsSubLaborFormModal.tsx:188,1990` | Editing sheet's job for the assembler + `service_type_id`: `jobs.find(j => j.hcp_number === editingLaborJob.job_number)` (raw, no click) | `editingLaborJob.job_ledger_id` first, `resolveSubLaborJobByNumber` fallback |
| `src/lib/jobs/subLaborUnlinked.ts:46-47` (+ `QuickfillJobsCleanupSection.tsx:60-128`) | Quickfill → Jobs Cleanup "sub labor with no job": unlinked = number resolves to nothing | unlinked = `job_ledger_id IS NULL` (the trigger already healed everything resolvable) |
| `src/components/jobs/JobsCrewPnlTab.tsx:234-247` | Crew P&L: `jobIdByNumber` (hcp + click) | id first |
| `src/lib/people/derivePersonTeamSummary.ts:69-148,348` + `src/components/people/PeopleReviewTab.tsx:1032-2179` + `teamReviewTypes.ts` | **Largest**: `jobIdByHcp` / `laborCostByHcp` keyed by sheet number, resolved through RPC `get_jobs_ledger_by_hcp_numbers[_paid_only]` | key both maps by job id; select `job_ledger_id` on sheets; the RPC pair can retire once nothing else calls it |
| `src/hooks/useSubLaborLedger.ts:80-102` + `src/lib/subLaborOutstanding.ts:61-63` | Sub Labor ledger names: `laborJobNamesByHcp` via the same RPC | embed `jobs_ledger!people_labor_jobs_job_ledger_id_fkey(hcp_number, click_number, job_name)` on the sheet select |

## E · Writers — DONE v2.3059 (`settle_step_commitment` writes `job_ledger_id`)

Already on the link (no action): `create_sheet_for_work_order`, the Sub Labor form (new / save / instant pick), Subs → Work **Link this sheet**, `fetchTeamBoardWeek`, `people_labor_jobs_stage_to_activity`, `superintendent_can_access_sub_work_order`. Id-joined all along (no number match): `PersonDeskWorkOrdersSection`, `customer-portal` sheet reads, `step_commitments.labor_job_id` consumers.

## F · Fixtures to update as rows above convert

`src/test/renderSmokeMocks.tsx:266-273`, `PeopleSubsTab.render.test.tsx:23-24`, `JobsSubLaborFormModal.render.test.tsx:42`, `workOrderBoardRows.test.ts:13-17`, `sheetsNeedingWorkOrder.test.ts:17-21`, `jobProfitSummary.test.ts`, `subLaborUnlinked.test.ts`, `crewPnlSummary.test.ts`, `sheetStory.test.ts` — every fixture sheet is wired by number today.

## After all rows are gone

- Widen or drop the `varchar(10)` cap on `job_number` (display text only by then).
- Retire `get_jobs_ledger_by_hcp_numbers` / `_paid_only` and `laborJobMatchesHcp`.
- Drop the number fallbacks from `people_labor_jobs_stage_to_activity` and `superintendent_can_access_sub_work_order`; keep `resolve_job_ledger_id_by_number` only inside the BEFORE trigger.
