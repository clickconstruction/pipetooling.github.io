# AI Agent Instructions

> **Start here.** Read [AI_CONTEXT.md](./AI_CONTEXT.md) for the full project overview, code map, and documentation index. This file is the entry point; AI_CONTEXT.md is the source of truth.

---

## Quick Orientation

**PipeTooling** — Workflow management for master plumbers. React + TypeScript + Supabase. 7 roles, 4 major systems (Projects/Workflows, Bids, Materials, Checklist). ~50+ tables with RLS.

---

## Where to Look For...

| Need | Documentation |
|------|---------------|
| Database schema, tables, columns | `PROJECT_DOCUMENTATION.md` → "Database Schema" section |
| User role permissions | `ACCESS_CONTROL.md` → Page/Feature access matrices |
| Adding a new role | `ADDING_A_NEW_ROLE.md` → Step-by-step guide |
| Term definitions | `GLOSSARY.md` → All domain terms and concepts |
| Recent changes and features | `RECENT_FEATURES.md` → Chronological updates |
| Bids system | `BIDS_SYSTEM.md` → Complete workflow documentation |
| Edge Functions API | `EDGE_FUNCTIONS.md` → All Edge Functions with examples |
| Migration history | `MIGRATIONS.md` → All migrations by date and category |
| **Linked** DB: local vs remote migration history mismatch, **`repair`**, **`db push --include-all`** | [Migration history drift (linked project)](#migration-history-drift-linked-project) below |
| Company calendar / Central time (`America/Chicago`), instants vs naive wall time | [`TIME_AND_ZONES.md`](./TIME_AND_ZONES.md); canonical constant **`APP_CALENDAR_TZ`** in `src/utils/dateUtils.ts`; `npm run check:timezone` |
| Apply migrations / run SQL on linked Supabase (when Docker local unavailable) | Cursor **Supabase MCP** — read tool descriptors in `.cursor/.../mcps/` first; `apply_migration` for new files, `execute_sql` for ad-hoc queries; see [Supabase MCP](#supabase-mcp-cursor) below |
| Workflow features | `WORKFLOW_FEATURES.md` → Stage management, financials |
| Clock In/Out, pending sessions, Revoke, accountability, Quickfill Hours, Crew Jobs / Bids, unified job/bid search, Pay Report Jobs/Bids | `RECENT_FEATURES.md` → v2.100, v2.105, v2.114, v2.120; `PROJECT_DOCUMENTATION.md` → Dashboard, Hours, Quickfill, People; `GLOSSARY.md` → Clock Sessions |
| Testing without credentials (dev login) | `EDGE_FUNCTIONS.md` → dev-login; `/dev-login?as=<existing-email>` when `import.meta.env.DEV`; email must exist in auth.users (e.g. robert@douglasmining.com); set `VITE_DEV_LOGIN_SECRET` and `DEV_LOGIN_SECRET` |
| Set password (dev) | `EDGE_FUNCTIONS.md` → set-user-password; Settings → Active Accounts → Set password for another user |
| Dev Ignored Tasks, Recently Completed Tasks, button icons | `RECENT_FEATURES.md` → v2.110, v2.111; `PROJECT_DOCUMENTATION.md` → Dashboard; `GLOSSARY.md` → Ignored section |
| approve_clock_sessions RPC 404 / client-side | `RECENT_FEATURES.md` → v2.125; `TROUBLESHOOTING.md` → RPC 404; `TROUBLESHOOT_404.md` |
| Project superintendent assignment, Projects page master/superintendents display | `RECENT_FEATURES.md` → v2.127, v2.128; `ACCESS_CONTROL.md` → superintendent section; `PROJECT_DOCUMENTATION.md` → projects, project_superintendents |
| Job–Project link, linking jobs to projects for multi-phase billing | `RECENT_FEATURES.md` → v2.129; `PROJECT_DOCUMENTATION.md` → Jobs, projects; `MIGRATIONS.md` → 20260320140000 |
| Workflow step card collapse, collapsed header, button styling | `RECENT_FEATURES.md` → v2.132; `PROJECT_DOCUMENTATION.md` → Workflow; `WORKFLOW_FEATURES.md` |
| Collapse old stages toggle, stage breadcrumb below buttons, no-wrap scroll | `RECENT_FEATURES.md` → v2.135; `WORKFLOW_FEATURES.md` → Collapse Old Stages Toggle, Stage Breadcrumb Layout |
| Workflow Approve/Previous work incomplete, private notes (dev/master/assistant/superintendent) | `RECENT_FEATURES.md` → v2.133, v2.134, v2.137; `ACCESS_CONTROL.md` → Workflow; `WORKFLOW_FEATURES.md` |
| Line Items For Office, supply house invoice linking | `RECENT_FEATURES.md` → v2.136; `WORKFLOW_FEATURES.md` → Line Items For Office; `PROJECT_DOCUMENTATION.md` → workflow_step_line_items |
| Jobs Edit billing comma fields; Workflow line `item_date` + clipboard bulk import | `RECENT_FEATURES.md` → v2.181; `WORKFLOW_FEATURES.md` → Line Items For Office; `PROJECT_DOCUMENTATION.md` → Jobs §6, workflow_step_line_items; `MIGRATIONS.md` → 20270329210000; `src/lib/parseWorkflowLineItemPaste.ts`; `src/components/MoneyDecimalAmountInput.tsx` |
| Client auth (**`AuthProvider`**, **`useAuth`**) | `src/hooks/useAuth.ts`; `src/main.tsx` wraps **`App`** |
| Clock In / Update Focus: assigned jobs auto-load; **no assigned jobs** info toast once per modal (ToastContext stable value + ref); modal field borders / focus | `RECENT_FEATURES.md` → v2.182, v2.191; `PROJECT_DOCUMENTATION.md` → Dashboard **Clock In/Out**, `ToastContext`; `src/components/ClockInOutButton.tsx`; `src/contexts/ToastContext.tsx` |
| GitHub Pages **GET /route 404** in Network (SPA), Hard Reload document request | `TROUBLESHOOT_404.md`; `src/lib/hardReload.ts`; `index.html`; `PROJECT_DOCUMENTATION.md` → Deployment |
| Jobs Stages + Workflow **job thread notes** (`jobs_ledger_thread_notes`); **Last activity** preview column; composer **Enter** / **Shift+Enter**; dropped `stage_notes`; **Billed Awaiting Payment** **Edit** beside **Open …** (`editJobIconBesideTimeOpen` in `renderUnifiedStagesTable`); **Bank payments** → **Accounts Receivable Sorting** (org-wide filter JSON in **`app_settings`** **`bank_payments_sorting_config_v1`**, dev writes; legacy per-user local only when no server row; counterparty/note excludes; **Kind** badges **`bank_payments_kind_badges_v1`**), `BankPaymentsModal` + `BankingSortingConfigModal`, `useMercuryLedgerNicknames`; **Accounts Receivable** button + modal **`billedRows`** from **`buildJobsStagesBoardLists(jobs, '').billedRows`** (**`bankPaymentsModalBilledRows`**, ignores Stages search; **Print** still filtered); **Allocations** UI (amount on second row, **Add allocation** footer; **Memo (optional)** on apply); Dashboard **Unallocated bank deposits** (`count_mercury_transactions_for_bank_payments`, `DashboardArBankUnallocatedBanner`, `useArBankUnallocatedCount`) | `RECENT_FEATURES.md` → v2.336, v2.334, v2.333, v2.332, v2.331, v2.330, v2.328, v2.183–v2.185; `PROJECT_DOCUMENTATION.md` → Jobs §6, Dashboard, §15 Banking; `GLOSSARY.md` → **Accounts Receivable Sorting (Jobs Stages → Bank payments)**; `MIGRATIONS.md` → `20260330023918`, `20260418061005`, `20260418063154`, `20260418073359`, `20260418074400`; `src/components/JobThreadNotesPanel.tsx`; `src/components/jobs/BankPaymentsModal.tsx`; `src/lib/bankingSortingConfig.ts`; `src/lib/bankPaymentsKindBadges.ts`; `src/hooks/useJobThreadNotes.ts`; `src/hooks/useArBankUnallocatedCount.ts`; `src/pages/Jobs.tsx`; `src/pages/Dashboard.tsx` |
| Jobs **Sub Labor** New/Edit modal: **Search for crew** (centered field, **aria-label**); non-empty search hides **External**/**Internal**/**Office** blocks with no matches + **No crew match this search** when all empty; **Add Sub** (was Add Subcontractor); **Add line item** below **Specific Work** table; muted **Itemize hours and rate**; **Internal Subs**/**Office Team** headers centered when collapsed; footer **Cancel** → **Print** → **Save** → **Required** (right of Save) → **Delete** | `RECENT_FEATURES.md` → v2.305; `PROJECT_DOCUMENTATION.md` → Jobs §6; `src/pages/Jobs.tsx` |
| Job Detail modal: **`DetailRow`** **`softBox`** on the three date rows; **Status** centered below dates; **Job Files** / **Job Plans** via **`DetailJobModalFilesPlansRow`** (omit row when both links empty; each column only when that link is set); **Assigned Team** (`team_members`): read-only list; **Last bill date** row = invoice/payment activity (`deriveRecordedBillingActivityDetail`); **Last manual bill date** = `last_bill_date`; `formatJobDetailModalDateYmd`; `JobLedgerStatusPipeline`; **Edit Job** stacked (`JobFormModal` z-index over Detail); materials (`fetchJobMaterialsCostSnapshot`, `JobDetailMaterialsCostSection`, `canExpandJobDetailMaterials`); Mercury **Posted** (`formatMercuryCardChargesPostedDate`) + **Card** (`mercuryDebitCardIdFromRaw`, `useMercuryLedgerNicknames`); **Specific Work** **`[1]`**, **`[2]`, …** + name × count; **Job Total** below Specific Work (full) or below materials (limited), **hidden** for **`subcontractor`** (`showJobDetailJobTotal`); edit gear + `onEditJobSaved` | `RECENT_FEATURES.md` → v2.338, v2.337, v2.278, v2.277, v2.276; `PROJECT_DOCUMENTATION.md` → Jobs §6; `GLOSSARY.md` → Last bill date (Job Detail), Other job charges; `src/components/jobs/DetailJobModal.tsx`; `src/components/jobs/JobFormModal.tsx`; `src/lib/fetchJobMaterialsCostSnapshot.ts`; `src/lib/jobDetailModalRole.ts`; `src/lib/formatMercuryCardChargesPostedDate.ts`; `src/lib/mercuryRawDebitCard.ts`; `src/hooks/useMercuryLedgerNicknames.ts`; `src/lib/stagesJobReferenceDates.ts`; `src/lib/formatJobDetailModalDateYmd.ts`; `src/lib/jobsLedgerStatusPipeline.ts`; `src/components/jobs/JobLedgerStatusPipeline.tsx` |
| **Invoice / Update** (Ready to Bill): Linked **`jobs_ledger.customer_id`** required (Jobs: toast + Edit Job **`billingCustomerHighlight`**; Dashboard: toast); Stripe **`create-stripe-invoice`**, **`preview-stripe-invoice`** (pre-create totals; **multi-line** from billable **`jobs_ledger_fixtures`** when Bill Customer **Line on bill** is blank; body **`line_description`** forces **single** line), **`send-stripe-invoice`** (email from Stripe; **`sent_to_customer_at`** = latest send; **`jobs_ledger_invoice_stripe_email_sends`** append log for modal history), + **`stripe-webhook`**; **`get_jobs_ledger_by_status`** includes **`customer_id`** (`20260330065236`); **`BillCustomerModalProvider`** + **`SendRecordInvoiceModal`** (Jobs, Dashboard, Edit Job **Preview / Stripe bill…**); **Undo out-of-band payment** **`reverse-stripe-invoice-out-of-band-payment`** + RPC **`revert_stripe_oob_invoice_payment`**; **`credit_note.created`** in **`stripe-webhook`**; **`onAfterOobUnwindSuccess`** / **`refreshEditingJobAndHydratePayments`** after unwind (**`RECENT_FEATURES.md`** v2.362–v2.363); **HouseCall Pro** / **Physical invoice** tabs; **Physical** **`send-physical-invoice-email`** (persist invoice + email); **`maybePromoteJobToBilledAfterCustomerInvoice`** (**`promoteJobToBilledIfFullyInvoiced.ts`**) after **Stripe** / **HCP** / **Physical** success — **job** → **billed** when fully invoiced out (**`RECENT_FEATURES.md`** v2.366); collapsible **Line on bill** / **Memo** (default collapsed); memo presets **`billCustomerMemoPresets`** + **`normalizePhysicalInvoiceFooterPlainText`**; **physical** customer email **`buildPhysicalInvoiceEmailBodies`** (bold tagline; summary omits Service date + Issuer block); Jobs **Stages** **Last activity** **Resend invoice email** when one billed Stripe line has a recorded send (**`StripeInvoiceSendFromStripeButton`**); Ham mode instant billed on Jobs (customer-gated); Edit Job Specific Work **(n/500)** Stripe length + scope disclosure | `RECENT_FEATURES.md` → v2.366, v2.363, v2.362, v2.325, v2.313, v2.304, v2.303, v2.283, v2.282, v2.190, v2.187; `EDGE_FUNCTIONS.md` → **create-stripe-invoice**, **preview-stripe-invoice**, **send-stripe-invoice**, **send-physical-invoice-email**, **reverse-stripe-invoice-out-of-band-payment**, **stripe-webhook**; `MIGRATIONS.md` → `20260330045018`, `20260330065236`, `20260420220523_revert_stripe_oob_invoice_payment`; `src/contexts/BillCustomerModalContext.tsx`; `src/components/jobs/SendRecordInvoiceModal.tsx`; `src/components/jobs/HostedStripeBillPanel.tsx`; `src/components/jobs/UnwindStripeOobPaymentModal.tsx`; `src/components/jobs/StripeInvoiceSendFromStripeButton.tsx`; `src/components/jobs/JobFormModal.tsx`; `src/lib/promoteJobToBilledIfFullyInvoiced.ts`; `src/lib/billCustomerMemoPresets.ts`; `src/lib/physicalInvoiceDocument.ts`; `src/pages/Jobs.tsx`; `src/pages/Dashboard.tsx` |
| Edit Job **Billing** accordion: **Partial invoice** (above **Outstanding billing**); **Outstanding billing** (**Date** + **`(+n)`**, **Stages**/**Bill**, **`StripeInvoiceSharePanel`** icon toolbar); **Payments received** (**Date**, **Amount ($)**, **Memo**; Stripe-linked row **inset** only—no **thead**-colored body; **`paymentRowsFromJob`** / **`refreshEditingJobAndHydratePayments`** after Stripe **Undo OOB** — v2.363); Mercury **Unlink and remove** (delete **`jobs_ledger_payments`**, refresh **`payments_made`**, **Paid** → **Billed** when underpaid; sole row → empty line); read-only **Ref** abbrev + copy (**`abbreviatePaymentReference.ts`**); footer **Delete** uses nested **confirm** modal (not **`window.confirm`**) | `RECENT_FEATURES.md` → v2.363, v2.344, v2.336, v2.285; `PROJECT_DOCUMENTATION.md` → Jobs §6; `src/components/jobs/JobFormModal.tsx`; `src/components/jobs/BilledBillViewModal.tsx`; `src/components/jobs/StripeInvoiceSharePanel.tsx`; `src/lib/abbreviatePaymentReference.ts`; `src/lib/invoiceCreatedRelative.ts`; `src/utils/dateUtils.ts` |
| **Banking** (`/banking`): **`product` + `tab`** URL (Mercury Ledger/Sorting vs Stripe Invoices/Data, **Stripe dev-only**); **`BankingStripeInvoicesPanel`** + **`BankingStripeWebhookEventsPanel`**; Jobs **Stages**: **`customerParamForJobsReload`**, thread stats **chunk 200** + **generation** guard, **320ms** debounce | `RECENT_FEATURES.md` → v2.284; `PROJECT_DOCUMENTATION.md` → §15 Banking; `ACCESS_CONTROL.md` → Banking; `MIGRATIONS.md` → `20270410130300`; `src/pages/Banking.tsx`; `src/components/BankingStripeInvoicesPanel.tsx`; `src/components/BankingStripeWebhookEventsPanel.tsx`; `src/pages/Jobs.tsx`; `src/hooks/useJobThreadNotes.ts` |
| Settings **Templates & testing** (dev): **Workflow email (Edge Function)** smoke test for **`send-workflow-notification`**; **`test-email`** / **`send-workflow-notification`** gateway **`verify_jwt`** in `supabase/config.toml` | `RECENT_FEATURES.md` → v2.186; `EDGE_FUNCTIONS.md` → **send-workflow-notification**, **test-email**; `WORKFLOW_EMAIL_TESTING.md` → Quick smoke test; `src/pages/Settings.tsx` |
| Settings **Salaried workday** (collapsible); **`people_pay_config`** self-read for salary Settings; Dashboard **Currently In** scope toggles without overlay frame | `RECENT_FEATURES.md` → v2.206; `MIGRATIONS.md` → `20270331160000`; `src/pages/Settings.tsx`; `src/components/SalaryWorkScheduleSettings.tsx`; `src/components/DashboardTeamActiveClockStrip.tsx` |
| **Impersonation** exit: [`Layout`](src/components/Layout.tsx) mobile **Back**, desktop short **Back** with **`title`/`aria-label`** full phrase; [`Settings`](src/pages/Settings.tsx) mobile **Back to my Account**, desktop **Back** with same a11y | `RECENT_FEATURES.md` → v2.231; `PROJECT_DOCUMENTATION.md` → Impersonation flow; `EDGE_FUNCTIONS.md` → **impersonate-user** |
| Salaried workday **end-time hints** (Day end / session ends, `+1 day`), **split** first-block default; **`salary_sync`** continuous duplicate INSERT guard (`20270402100000`); indexed-slot **split RPCs** + split-mode **overlap** guard (`20270403180000`); split sync overlap uses **`work_date`** or clock-in date in template TZ (`20270408153000`); runbook **`SALARY_CLOCK_SESSIONS.md`** | `RECENT_FEATURES.md` → v2.249, v2.229, v2.228; `MIGRATIONS.md` → `20270402100000`, `20270403180000`, `20270408153000`; `SalaryWorkScheduleSettings.tsx`; `salaryScheduleEndTimeDisplay.ts` |
| Dispatch dismissals, closed note, inbox thread notes | `RECENT_FEATURES.md` → v2.169, v2.136; `MIGRATIONS.md`; `GLOSSARY.md` → Task Dispatch |
| Superintendent Jobs: Reports + Sub Ledger only (no Stages, Billing) | `RECENT_FEATURES.md` → v2.138; `ACCESS_CONTROL.md` → superintendent; `MIGRATIONS.md` → 20260623190000 |
| Dashboard **Assigned Jobs** / **Superintendent Jobs** (title → **Job Detail**), **team Ready to Bill** (`list_ready_to_bill_assigned_jobs_for_dashboard`), subcontractor **Collect Payment** (hosted Stripe invoice after staff **Approve for payment**; Step 1 Job Book always on + search + collapse; Step 2 **Call Dispatch** in footer; **`update-collect-payment-stripe-customer-email`**) + staff **Field: Waiting for Approval** queue (**Line Items** vs Stripe, red mismatch rows, **Prepare Bill** blue/green, **Add Line Items** → Edit Job highlight; Realtime **`jobs_ledger_invoices`**), **Collect Payment** modal centered step titles, in-progress stage banner, Choose from my jobs | `RECENT_FEATURES.md` → v2.344, v2.343, v2.341, v2.339, v2.338, v2.142; `PROJECT_DOCUMENTATION.md` → Dashboard; `MIGRATIONS.md` → `20260419180746_collect_payment_complete_on_invoice_paid`, `20260419161731_job_collect_payment_flows`, `20260419154440_list_ready_to_bill_assigned_jobs_for_dashboard`, 20260624000000_allow_superintendent_send_to_billing |
| Remove specific pins, Page pins for assistants | `RECENT_FEATURES.md` → v2.147; `PROJECT_DOCUMENTATION.md` → Settings, Dashboard |
| Bid Board **Bid #** **`B{n}`** → **Bid preview**; workflow tab **`h2`** **`B{n}`** → preview; Submission notes toolbar row + mobile centered; **`notify-dispatch-request`** `verify_jwt` in **`config.toml`** | `RECENT_FEATURES.md` → v2.279; `EDGE_FUNCTIONS.md` → notify-dispatch-request; `src/pages/Bids.tsx` (**`BidWorkflowTabTitleWithPreview`**); `src/components/bidNotes/BidNotesTable.tsx`; `src/components/customerNotes/CustomerNotesTable.tsx` |
| Bid Board All notes (unified timeline), customer notes cards, `customer_contacts.contact_method` | `RECENT_FEATURES.md` → v2.148; `PROJECT_DOCUMENTATION.md` → Bids; `MIGRATIONS.md` → 20260324120000 |
| Bids **Cover Letter** combined doc: **`buildCoverLetterHtml`** (single **`<p>`**, **`pre-wrap`**, **`line-height:1`**), **Copy** **`text/html`** full document only for Google Docs; **Submission** URL pending ref; bid/customer **`datetime-local`** via **`toDatetimeLocal`** / **`fromDatetimeLocal`** | `RECENT_FEATURES.md` → v2.329; `src/pages/Bids.tsx`; `src/components/bidNotes/BidNotesTable.tsx`; `src/components/bidBoard/UnifiedBidCustomerNotes.tsx`; `src/utils/datetimeLocal.ts` |
| Clock sessions table (time/location, merged notes+job, accountability lines), pending Approve/Reject/Edit order, My Roles Goals gate, `user_dashboard_goals` / `user_daily_goals_ack` | `RECENT_FEATURES.md` → v2.149; `PROJECT_DOCUMENTATION.md` → Dashboard, People Hours, Quickfill, Settings; `MIGRATIONS.md` → 20260329120000; `GLOSSARY.md` → Clock Sessions |
| Job Parts Tally **Transactions** tab: **search** ([`tallyTransactionSearch.ts`](src/lib/tallyTransactionSearch.ts)); **Mercury note** icon ([`MercuryTransactionNoteIcon.tsx`](src/components/icons/MercuryTransactionNoteIcon.tsx)); **`parseTallyJobSplitsJson`** ([`tallyJobSplits.ts`](src/lib/tallyJobSplits.ts)); [`TallyJobTransactionsModal.tsx`](src/components/tally/TallyJobTransactionsModal.tsx) | `RECENT_FEATURES.md` → v2.225; `PROJECT_DOCUMENTATION.md` → Jobs §6a |
| Quickfill **section** **`h2`** titles + **dividers**; **Banking sorting** snapshot **Link…** in Person/Jobs (no Link column); **People Hours (new)** assistance notice + **mobile** day nav (≤640px: date line + **Previous day \| Next day \| Today**); **Jobs Billing** **Min HCP** filter | `RECENT_FEATURES.md` → v2.289, v2.224; [`Quickfill.tsx`](src/pages/Quickfill.tsx); [`BankingSortingSnapshotSection.tsx`](src/components/quickfill/BankingSortingSnapshotSection.tsx); [`QuickfillPeopleHoursNewSection.tsx`](src/components/quickfill/QuickfillPeopleHoursNewSection.tsx); [`JobsBillingReminderSection.tsx`](src/components/quickfill/JobsBillingReminderSection.tsx) |
| Quickfill **Schedule** header (no N open / no Mark history), conflicts prompt, `DispatchAddBlockTimeRange` session strip sizing; **Office** dev edit checklist; **Email** / **Texts** / **Physical** intro row + no outer border; stale tally **Assign** modal split seeding | `RECENT_FEATURES.md` → v2.310; [`QuickfillScheduleSection.tsx`](src/components/quickfill/QuickfillScheduleSection.tsx); [`QuickfillOfficeSection.tsx`](src/components/quickfill/QuickfillOfficeSection.tsx); [`MercuryTransactionAllocationsModal.tsx`](src/components/MercuryTransactionAllocationsModal.tsx) |
| Quickfill **Physical inbox** (note + mark); header-aligned **Task** / **Task Dispatch** / **Estimator Inbox**; Schedule Dispatch hub **Day** tab (`hubTab=day`, `day=` URL) | `RECENT_FEATURES.md` → v2.309; [`QuickfillPhysicalInboxSection.tsx`](src/components/quickfill/QuickfillPhysicalInboxSection.tsx); [`ScheduleDispatchHub.tsx`](src/components/schedule/ScheduleDispatchHub.tsx); [`scheduleDispatchColumnFocus.ts`](src/lib/scheduleDispatchColumnFocus.ts) |
| Quickfill **Banking sorting** snapshot: parallel Mercury relations + nickname maps; **Total available** count | `RECENT_FEATURES.md` → v2.222; `PROJECT_DOCUMENTATION.md` → Quickfill; [`BankingSortingSnapshotSection.tsx`](src/components/quickfill/BankingSortingSnapshotSection.tsx) |
| **Crew Jobs / Bids** Realtime in **`CrewJobsBlock`**; **`clock_sessions`** trigger syncs crew rows on job/bid assign | `RECENT_FEATURES.md` → v2.223; `PROJECT_DOCUMENTATION.md` → Quickfill; `MIGRATIONS.md` → **`20260402120000_clock_sessions_sync_crew_assignments_trigger.sql`**; [`CrewJobsBlock.tsx`](src/components/CrewJobsBlock.tsx) |
| Dashboard My Team: Clock activity above Active/Pending, plain "Clock activity" label, pending banner full-bar jump + expand | `RECENT_FEATURES.md` → v2.153; `PROJECT_DOCUMENTATION.md` → Dashboard |
| Dashboard Currently clocked in strip (below pins): Today hours, My team/Everyone toggle (dev/master/assistant); Materials supply house `website_url` + Open website | `RECENT_FEATURES.md` → v2.163; `PROJECT_DOCUMENTATION.md` → Dashboard, Materials Supply Houses, `supply_houses`; `src/hooks/useDashboardMyTeamSectionState.ts`; `src/components/DashboardTeamActiveClockStrip.tsx` |
| Layout **header** shared **height** (Task Dispatch, Estimator Inbox, Task, **Bid**); Dashboard strip **Assign** optimistic job/bid + **`loadPending` Promise.all**; **Calendar** month grid bottom chips **centered** | `RECENT_FEATURES.md` → v2.214; `PROJECT_DOCUMENTATION.md` → Dashboard **Currently clocked in**, Calendar §7, `Layout.tsx` component notes; `src/components/Layout.tsx`; `src/components/clock-sessions/AssignSessionJobPopover.tsx`; `src/hooks/useDashboardMyTeamSectionState.ts`; `src/components/DashboardTeamActiveClockStrip.tsx`; `src/pages/Dashboard.tsx`; `src/pages/Calendar.tsx` |
| Dashboard **Jobs worked today** (below Clocked in today): collapsible by job; **two-column** table—job link + inline **`[ hours • people ]`**, address on second line; **No job or bid** aggregate row first for unassigned sessions (**`JOBS_WORKED_TODAY_UNASSIGNED_ID`**, muted, no link — **v2.367**); per-job session detail **`colSpan` 2; `jobsWorkedTodayStripRows`; session **duration** opens strip **Edit time** (`onOpenStripMyTimeEditor`); **Overlap** badge when `hasIntervalOverlapToday` | `RECENT_FEATURES.md` → v2.367, v2.231, v2.203, v2.202; `PROJECT_DOCUMENTATION.md` → Dashboard; `src/components/DashboardTeamActiveClockStrip.tsx`; `src/hooks/useDashboardMyTeamSectionState.ts` |
| Dashboard **Clocked in today** **Mix** (copy day job %): **`enableCopyDayJobMix`** (dev / master / assistant); per-row copy; **[`CopyDayJobMixModal`](src/components/day-job-mix/CopyDayJobMixModal.tsx)** + **[`dayJobMixPercentages.ts`](src/lib/dayJobMixPercentages.ts)** / **[`dayJobMixApply.ts`](src/lib/dayJobMixApply.ts)**; **[`copyDayJobMixTargetGate.ts`](src/lib/copyDayJobMixTargetGate.ts)** (salary **`origin`** day must be all **closed**); **`leader_replace_clock_session_cluster_mixed`** ([`leaderClockSessionSplit.ts`](src/lib/leaderClockSessionSplit.ts)); **`clockStripWorkDateYmd`** hook field | `RECENT_FEATURES.md` → v2.281; `PROJECT_DOCUMENTATION.md` → Dashboard; `src/components/DashboardTeamActiveClockStrip.tsx`; `src/pages/Dashboard.tsx` |
| Dashboard / **Clock In** **View today’s time**: blue clock icon when not clocked in but today has sessions → **[`DashboardMyTimeDayEditorModal`](src/components/DashboardMyTimeDayEditorModal.tsx)** **`clockTimesReadOnly`** (timeline/assign/save-on-close; punch actions off; title **punch times locked**); [`ClockInOutButton.tsx`](src/components/ClockInOutButton.tsx); [`Dashboard.tsx`](src/pages/Dashboard.tsx) **`openMyTimePreviewFromClock`** | `RECENT_FEATURES.md` → v2.281; `PROJECT_DOCUMENTATION.md` → Dashboard **Clock In/Out**, **My Time** |
| Dashboard **My Time** / **Edit time** (this-week-only save, Form vs Visual defaults, timeline + form grid, merge + job-choice modal, `segmentJobOverrides`; **Option A** `can_edit_clock_sessions_for_user` for master/assistant/superintendent; merge-after-split reducer **v2.216**; **pairwise overlap** splits timeline into **one card per session** (`splitClustersWithPairwiseOverlap` / `expandClustersSplitPairwiseOverlaps`); Form **overlap** double border + cluster separators; compact list **no** session-frame border; prior-week gate footer trim; **Overlapping clock times** / **Multiple jobs/bids in this span** / `hasPairwiseClockIntervalOverlap`) | `RECENT_FEATURES.md` → v2.289, v2.231, v2.216, v2.193, v2.192, v2.179; `ACCESS_CONTROL.md` → Dashboard matrix; `MIGRATIONS.md` → `20260401190823`, `20260328220000`; `src/components/DashboardMyTimeSection.tsx`; `src/components/DashboardMyTimeDayEditorModal.tsx`; `src/components/my-time-day-editor/`; `src/lib/myTimeDayTimeline.ts`; `src/lib/myTimeDaySavePlan.ts` |
| Dashboard **NCNS** (team My Time from clock strip): **`record_ncns_and_reject_sessions_for_day`**, **`attendance_incidents`**; extra confirm if **approved** sessions (payroll + trust) | `RECENT_FEATURES.md` → v2.209; `ACCESS_CONTROL.md` → Dashboard matrix; `MIGRATIONS.md` → `20260331232529`; `src/components/DashboardMyTimeDayEditorModal.tsx`; `src/pages/Dashboard.tsx` |
| People **Writeups** unified timeline (**writeups** + read-only **NCNS** from **`attendance_incidents`**) | `RECENT_FEATURES.md` → v2.210; `ACCESS_CONTROL.md` → People matrix; `src/components/writeups/WriteupsContractsSubTab.tsx`; `src/components/writeups/NcnsDetailModal.tsx`; `src/components/writeups/writeupsTimelineTypes.ts`; `src/pages/People.tsx` |
| **Calendar** NCNS + **recorded time** + salary (**scheduled** forward-only after today; **PTO** all days; `showScheduledSalaryProjectionForYmd`) | `RECENT_FEATURES.md` → v2.212; `ACCESS_CONTROL.md` → Calendar matrix; `MIGRATIONS.md` → `20260401004452`; `src/pages/Calendar.tsx`; `src/lib/calendarClockedHoursByDate.ts` |
| Bids New/Edit modal: **`SearchableSelect`**, responsive `bid-form-top-fields`, Address + Distance/Plan Pages row, **720px**; Layout **Bid** header alignment | `RECENT_FEATURES.md` → v2.180; `BIDS_SYSTEM.md` → Edit Bid Modal; `PROJECT_DOCUMENTATION.md` → Bids; `src/components/SearchableSelect.tsx`; `src/pages/Bids.tsx`; `src/components/Layout.tsx` |
| Team feedback (dev): **People → Feedback** (`?tab=feedback`) or **Settings → People & accounts** — **`TeamFeedbackDevSettingsBlock`** (Enabled DB persist, Settings/Eligibility modals, raw detail modal, CSV, dev delete); eligibility overview per-user Reset, submit `reviewer_user_id` from session, `team_feedback_submissions_select_own` migration | `RECENT_FEATURES.md` → v2.162, v2.290; `MIGRATIONS.md` → 20270329140000; `src/lib/teamFeedback.ts`; `src/components/team-feedback/` |
| Settings: Sharing and Adoption merged into **People & accounts** (`settings-people`); no `settings-sharing` jump | `RECENT_FEATURES.md` → v2.165; `PROJECT_DOCUMENTATION.md` → Settings §9; `ACCESS_CONTROL.md` → Settings matrix |
| Pay History: Ledger **Less** + **Additional** (qty × rate modal; **prevailing wage** from approved sessions, **`source_clock_session_id`**, human **`description`**; legacy **`[pw:uuid]`** stripped in UI/HTML — v2.345) + **Net Pay** (gross − Less + Additional); **Partial** installments (`pay_stub_payments`) capped at net; full-width ledger name search; **Print** in ledger (no row **View**; **Generate Custom Pay Report** / `CustomPayReportsModal` has **View**); dev delete as red trash icon | `RECENT_FEATURES.md` → v2.345, v2.330, v2.170, v2.172, v2.173, v2.174; `PROJECT_DOCUMENTATION.md` → People; `MIGRATIONS.md` → `20260420051645`; `GLOSSARY.md` → pay_stub_payments, pay_stub_additional_lines; `src/lib/payStubPayments.ts`; `src/lib/payStubDeductions.ts`; `src/lib/payStubPrevailingWageLine.ts`; `src/components/pay/PayStubLessModal.tsx`; `src/components/pay/PayStubAdditionalModal.tsx`; `src/components/pay/PayStubDeleteIcon.tsx`; `src/components/pay/CustomPayReportsModal.tsx` |
| Pay History **Draft Payroll** (prior week default, crew merge), **`employee_credit`** on **`person_offsets`**, **Record payment** capped at balance + optional credit | `RECENT_FEATURES.md` → v2.252; `MIGRATIONS.md` → `20270408163000`, `20270408160000`, `20270408161000`; `GLOSSARY.md` → person_offsets; `PROJECT_DOCUMENTATION.md` → People; `src/pages/People.tsx`; `src/components/pay/PersonOffsetFormModal.tsx`; `Jobs.tsx` (**`get_invoice_allocation_lines_for_jobs`**) |
| People **Housing** tab (`housing_units`, `housing_possessions`); pay stub HTML **Housing** after vehicles | `RECENT_FEATURES.md` → v2.177; `ACCESS_CONTROL.md` → People; `MIGRATIONS.md` → 20270329180000; `PROJECT_DOCUMENTATION.md` → People; `src/pages/People.tsx` |
| People roster **`primary`** / **`superintendent`** on `people`; Pay/Hours via `allRosterNames`; backfill `20260329042321` | `RECENT_FEATURES.md` → v2.178; `MIGRATIONS.md` → 20260329042321; `PROJECT_DOCUMENTATION.md` → People; `src/pages/People.tsx`; `src/pages/Jobs.tsx`; `ReceivablesSection.tsx` |
| People Hours: Correct-day audit **Edit** (crew + clock + add session); **ClockSessionEditSplitModal**; **Highlight by job** on grid; **manual cell blur → My Time** proportional scale of closed sessions or **draft** (`peopleHoursProportionalScale.ts`, `peopleHoursManualDraftSession.ts`; open session → fetch modal); **`saveHours(0)`** after save, **NCNS** off for manual-blur path | `RECENT_FEATURES.md` → v2.297, v2.291, v2.171; `PROJECT_DOCUMENTATION.md` → People, Quickfill; `src/components/PeopleHoursDayAuditModal.tsx`; `src/pages/People.tsx`; `src/lib/peopleHoursProportionalScale.ts`; `src/lib/peopleHoursManualDraftSession.ts`; `src/components/DashboardMyTimeDayEditorModal.tsx` |
| **Schedule dispatch** **Linked** / **+ → Linked copy** (`shared_block_group_id`), group time/note sync, overlap **`excludeIds`**, DnD solo cross-day/assignee + linked cross-day via **`move_job_schedule_block_group`**; **Add schedule block** occupied timeline (person-day drafts, gap-clamped new range, batch save); Banking **Mercury** **`replace_mercury_transaction_splits`**: modal assertion for nullable attribution args vs **`gen types`** | `RECENT_FEATURES.md` → v2.296, v2.258, v2.257; `MIGRATIONS.md` → **`20260407165443`**, **`20260407061043`**, **`20260407052651`**; `GLOSSARY.md` → Job schedule blocks; `PROJECT_DOCUMENTATION.md` → Jobs; `src/lib/jobScheduleBlocks.ts`; `src/lib/scheduleDispatchAddBlockTimeline.ts`; `src/lib/scheduleDispatchDragEnd.ts`; `src/lib/jobScheduleOverlap.ts`; `src/pages/ScheduleDispatch.tsx`; `src/components/schedule/DispatchAddBlockTimeRange.tsx`; `src/components/schedule/ScheduleDispatchGrid.tsx`; `src/components/MercuryTransactionAllocationsModal.tsx` |

---

## Critical Constraints (Non-Negotiable)

1. **Never edit existing migrations** — Append-only. Create new migration to change schema.
   - **Always create new migration files with the CLI** — Run `supabase migration new short_description_of_change` (snake_case description). Never invent timestamps, copy an existing migration file and tweak the name, or add a second file that shares the same `YYYYMMDDHHMMSS` prefix as another file in `supabase/migrations/` (one version number → one SQL file). Edit the generated file, then apply via `supabase db push` (or MCP `apply_migration` on that file).
2. **Always add RLS policies** — Every new table needs SELECT/INSERT/UPDATE/DELETE for all 6 roles.
3. **Update types after schema changes** — **`2>/dev/null`** keeps the Supabase CLI’s stderr noise (login hints, update banners) out of `src/types/database.ts`. Examples: `supabase gen types typescript --local > src/types/database.ts 2>/dev/null`, or linked: `… --linked > src/types/database.ts 2>/dev/null`. Shortcuts: `npm run gen-types:local` / `npm run gen-types:linked`. If generation fails or the file looks wrong, rerun the same command **without** `2>/dev/null` to read the real error.
4. **No `any` types** — TypeScript strict mode. Use proper types or `unknown`.
5. **Wrap Supabase calls** — Use `withSupabaseRetry()` from `@/utils/errorHandling`
6. **Test all 7 roles** — dev, master, assistant, subcontractor, estimator, primary, superintendent
7. **Company time zone** — Use **`APP_CALENDAR_TZ`** from [`src/utils/dateUtils.ts`](./src/utils/dateUtils.ts) (or Edge [`_shared/appTimeZone.ts`](./supabase/functions/_shared/appTimeZone.ts)); do not introduce new `'America/Chicago'` string literals in app/Edge TS (see [`TIME_AND_ZONES.md`](./TIME_AND_ZONES.md), `npm run check:timezone`).

---

## Migration history drift (linked project)

Use this when **`supabase migration list --linked`** shows **Local** and **Remote** columns out of sync (one side empty for a version), or **`supabase db push --linked`** errors with **Remote migration versions not found in local migrations directory** / **Found local migration files to be inserted before the last migration on remote database**.

### Inspect

```bash
supabase migration list --linked
```

Match each row: both columns should show the same **`YYYYMMDDHHMMSS`** for every applied version.

### Remote-only versions (no file in `supabase/migrations/`)

The remote **`supabase_migrations.schema_migrations`** table lists versions that do not exist in the repo (alternate timestamps, old applies, renamed files). They block **`db push`** until the history row is removed.

**Fix** — mark those versions **reverted** (updates the **history table only**; it does **not** run `DOWN` or drop objects):

```bash
supabase migration repair --status reverted VERSION [VERSION ...] --linked
```

The CLI often prints the exact version list when **`db push`** fails; paste that list into the command.

### Push local migrations

After repair, apply pending files:

```bash
supabase db push --linked
```

If the CLI says local files must be applied **before** the last migration on remote (out-of-order timestamps), rerun with:

```bash
supabase db push --linked --include-all
```

Use **`--yes`** in CI or scripts to skip the confirmation prompt.

### Push fails with “already exists”

The migration was **never recorded** in history but DDL is already on the database (e.g. applied manually via SQL or MCP **`apply_migration`**, which does not always write the same history row as **`db push`**).

**Fix** — record the version **applied** without executing SQL:

```bash
supabase migration repair --status applied VERSION --linked
```

Then run **`db push --linked`** again (with **`--include-all`** if needed again). Prefer resolving the root cause: use **`supabase db push`** on the linked project for repo migrations so history and schema stay aligned.

### MCP vs CLI

MCP **`apply_migration`** is for executing DDL when **`db push`** is not available. After using it, **`migration list`** may still show a local file as “not applied” until you **`repair --status applied`** for that version or re-apply via **`db push`** as appropriate. **`npm run gen-types:linked`** after the remote schema matches expectations.

### Verify

```bash
supabase migration list --linked
```

No row should have an empty **Local** or **Remote** column for committed migration files.

---

## Supabase MCP (Cursor)

When this workspace has the **Supabase MCP** server enabled, agents can apply new migration files and run SQL against the **linked** project via MCP (useful when local Docker / `supabase db reset` is not available). **Create the migration file first** with `supabase migration new …`, then edit it; use MCP `apply_migration` only for that generated path. **Always read each tool’s JSON descriptor** under the project’s `mcps` folder before calling — e.g. `execute_sql` for validation or reads, `apply_migration` to apply a file under `supabase/migrations/`. If **`migration list --linked`** and the repo diverge after MCP or manual SQL, use **[Migration history drift](#migration-history-drift-linked-project)**. This does not replace **Critical Constraints** item 3: after schema changes, still regenerate `src/types/database.ts` (see item 3 for `2>/dev/null` and npm scripts).

---

## Next Steps

1. **Read [AI_CONTEXT.md](./AI_CONTEXT.md)** — Full overview, file structure, patterns, glossary
2. **Consult the table above** — For your task, open the relevant doc
3. **Review code** — `src/pages/` for UI, `supabase/` for backend
4. **Check RECENT_FEATURES.md** — For context on recent changes
5. **Ask before changing** — Clarify requirements if unclear

---

*Full documentation lives in [AI_CONTEXT.md](./AI_CONTEXT.md). Keep that file updated; this file stays minimal.*
