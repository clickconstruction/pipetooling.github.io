# Recent Features and Updates

This document summarizes all recent features and improvements added to PipeTooling.

---
file: RECENT_FEATURES.md
type: Changelog
purpose: Chronological log of all features and updates by version
audience: All users (developers, product managers, AI agents)
last_updated: 2026-04-22
estimated_read_time: 30-40 minutes
difficulty: Beginner to Intermediate

format: "Reverse chronological (newest first)"
version_range: "v2.369 → v2.4"

key_sections:
  - name: "Latest Version (v2.369)"
    line: ~1195
    description: "Bids Unsent/Working Kanban: system Working column + Clock In quick picks; Bid Board / tab copy and pipe grouping; inbox badge position"
  - name: "Latest Version (v2.368)"
    line: ~1209
    description: "Public /contract/accept: no For line; title-only thank-you + pup.jpg + Dashboard/Sign-in CTA (list_my_contract_dashboard_prompts)"
  - name: "Latest Version (v2.367)"
    line: ~1221
    description: "Dashboard Jobs worked today: aggregate row for no job/no bid (split salary unassigned segments); JOBS_WORKED_TODAY_UNASSIGNED_ID; muted label, no job link"
  - name: "Latest Version (v2.366)"
    line: ~1233
    description: "Bill Customer: job → billed when fully invoiced out (Stripe / HCP / Physical) via maybePromoteJobToBilledAfterCustomerInvoice; send-physical-invoice-email no longer updates job status"
  - name: "Latest Version (v2.365)"
    line: ~1245
    description: "People Contracts: contract lineage (Ver. column), applied version pin, Edit in ⋯ menu; create_pending_contract_versions_after_book_save on Contract Book save"
  - name: "Latest Version (v2.364)"
    line: ~1258
    description: "Dashboard contract signing prompt after clock-in; People Contracts Dashboard checkbox; list_my_contract_dashboard_prompts + get-contract-signing-link-for-self"
  - name: "Latest Version (v2.363)"
    line: ~1271
    description: "OOB unwind Stripe edge cases (total + out_of_band credit note); Edit Job Payments received + Bill Customer refresh after unwind"
  - name: "Latest Version (v2.362)"
    line: ~1284
    description: "Undo Stripe out-of-band payment (credit note + RPC + Hosted bill UI)"
  - name: "Latest Version (v2.361)"
    line: ~1298
    description: "Stale tally follow-up Posted column adds local time (APP_CALENDAR_TZ)"
  - name: "Latest Version (v2.360)"
    line: ~1258
    description: "Stale tally follow-up modal Posted column: April 16 (Thu) in APP_CALENDAR_TZ"
  - name: "Latest Version (v2.359)"
    line: ~1268
    description: "People Contracts Edit document: Delete unsent with confirm (person_contract_documents DELETE)"
  - name: "Latest Version (v2.358)"
    line: ~1184
    description: "People Contracts Send for signature modal: live email preview (contractSendEmailPreview.ts)"
  - name: "Latest Version (v2.357)"
    line: ~1180
    description: "People Contracts Add document Request Signature: Send button saves and opens Send for signature modal"
  - name: "Latest Version (v2.356)"
    line: ~1194
    description: "People Contracts Send for signature: optional email subject + opening message; send-contract-for-signature"
  - name: "Latest Version (v2.355)"
    line: ~1208
    description: "People Contracts tab: full-width search by person or contract + matching document lines"
  - name: "Latest Version (v2.354)"
    line: ~1148
    description: "People Contracts Manage templates: document names as indented bullets under template title"
  - name: "Latest Version (v2.353)"
    line: ~1142
    description: "People Contracts Assign template modal: search + selectable radiogroup list (no select)"
  - name: "Latest Version (v2.352)"
    line: ~1140
    description: "People Contracts Contract Book View + row cleanup + icon style; Upload Signed save always signed; no Status UI"
  - name: "Latest Version (v2.351)"
    line: ~1132
    description: "People Contracts Contract Book modal; contract_template_documents book_body_html + tags; header + Add document icon"
  - name: "Latest Version (v2.350)"
    line: ~1132
    description: "People Contracts Add → Upload Signed: hide optional signing-page block; save clears signing_body_html + canonical_document_url for that tab"
  - name: "Latest Version (v2.349)"
    line: ~1128
    description: "People Contracts Add → Request Signature: hide Optional after signing block; save clears url/signed_at/note for that tab"
  - name: "Latest Version (v2.348)"
    line: ~1138
    description: "People Contracts Add → Request Signature: no Status dropdown; save forces unsent; helper copy"
  - name: "Latest Version (v2.347)"
    line: ~1148
    description: "People Contracts Add document: Upload Signed vs Request Signature tabs (Edit unchanged); aria tablist + ArrowLeft/ArrowRight"
  - name: "Latest Version (v2.346)"
    line: ~1112
    description: "People Contracts: signing_body_html + canonical_document_url; digital signing via /contract/accept + Edge functions; contract-signer-signatures bucket"
  - name: "Latest Version (v2.345)"
    line: ~1112
    description: "People Pay History Additional: prevailing-wage lines use human description + source_clock_session_id; strip legacy [pw:uuid] in modal and pay report HTML (payStubPrevailingWageLine.ts)"
  - name: "Latest Version (v2.344)"
    line: ~1112
    description: "Edit Job Delete: nested confirm modal (no window.confirm); Collect Payment hosted Stripe invoice flow (webhook completes flow; Realtime jobs_ledger_invoices; return_collect_payment_to_dispatch); Edge removes terminal-connection-token + create-terminal-collect-payment-intent; update-collect-payment-stripe-customer-email"
  - name: "Latest Version (v2.343)"
    line: ~1128
    description: "Collect Payment Step 1: Job Book always on (search, collapsible default closed), Ready-to-Bill warning gated on fixtures; Step 2 Call Dispatch in footer; JobBookEditorPanel Work focus+select on Add line, Cost select-all at zero"
  - name: "Latest Version (v2.342)"
    line: ~1142
    description: "Job Book (job_book_entries): Collect Payment Step 1 add lines from catalog; Settings CRUD + Jobs Stages toolbar modal (JobBookEditorPanel); add_collect_payment_fixture_from_job_book; job_service_type_id on certify payload"
  - name: "Latest Version (v2.341)"
    line: ~1155
    description: "Field queue Line Items + Stripe line match (red rows, footer); Prepare Bill blue/green; Add Line Items → Edit Job Specific Work highlight; Collect Payment step headers centered; stripeInvoiceDetailsResponse"
  - name: "Latest Version (v2.340)"
    line: ~1170
    description: "Send Back (RTB→Working) cancels in-progress collect payment flow; modal notice; update_job_status"
  - name: "Latest Version (v2.339)"
    line: ~1182
    description: "Subcontractor Collect Payment: certify → dispatch queue → Stripe Terminal; job_collect_payment_flows; dashboard button variants (hosted invoice + webhook completion in v2.344)"
  - name: "Latest Version (v2.338)"
    line: ~1196
    description: "Dashboard team Ready to Bill; subcontractor Job Detail Job Total hidden; Assigned Jobs title opens Job Detail"
  - name: "Latest Version (v2.337)"
    line: ~1088
    description: "Job Detail modal: section heading Team → Assigned Team for read-only team_members list (DetailJobModal.tsx)"
  - name: "Latest Version (v2.336)"
    line: ~1083
    description: "Jobs Stages Accounts Receivable: button always on (role-only); BankPaymentsModal billedRows from buildJobsStagesBoardLists(jobs,''); Edit Job Mercury Unlink and remove (DELETE payment, payments_made, paid→billed); single-row remove seeds empty line; Ref read-only abbrev+copy; AR modal Memo (optional) label"
  - name: "Latest Version (v2.335)"
    line: ~1094
    description: "AR Bank Payments: mercury_transaction_ar_returned + Mark mode Returned checkbox; p_filter includeHiddenArDeposits (legacy includeFullyApplied fallback) hides fully applied and returned deposits by default; set_mercury_transaction_ar_returned RPC"
  - name: "Latest Version (v2.334)"
    line: ~1073
    description: "Accounts Receivable Sorting filter JSON in app_settings (bank_payments_sorting_config_v1, dev writes); company-wide for Bank Payments RPCs + unallocated count; legacy per-user localStorage only when no server row; global localStorage cache after fetch/save"
  - name: "Latest Version (v2.333)"
    line: ~1068
    description: "Bank Payments Kind badges in app_settings (global); dev-only badge editor; localStorage cache; auto-publish local to server when no row (dev)"
  - name: "Latest Version (v2.332)"
    line: ~1078
    description: "Dashboard unallocated bank deposits banner (count_mercury_transactions_for_bank_payments); AR sorting counterparty/note exclusions; Bank Payments allocation layout (amount row + Add allocation footer)"
  - name: "Latest Version (v2.331)"
    line: ~1062
    description: "Bank Payments: per-kind badge nickname + color in Accounts Receivable Sorting (dev editor); bank_payments_kind_badges_v1 localStorage; pills on transaction rows"
  - name: "Latest Version (v2.330)"
    line: ~1068
    description: "People Pay History: Generate Custom Pay Report modal + toolbar; Jobs Bank payments Accounts Receivable Sorting modal title + Mercury nicknames (AR filter storage superseded by org-wide app_settings in v2.334)"
  - name: "Latest Version (v2.329)"
    line: ~1070
    description: "Bids: Cover Letter combined HTML for Google Docs paste (single p, pre-wrap, HTML-only clipboard); Submission deep link pending ref; bid/customer note datetime-local via datetimeLocal.ts"
  - name: "Latest Version (v2.328)"
    line: ~1084
    description: "Jobs Stages Billed Awaiting Payment: Edit icon immediately after Open … (merged job + standalone invoice rows); editJobIconBesideTimeOpen in renderUnifiedStagesTable"
  - name: "Latest Version (v2.327)"
    line: ~1096
    description: "Documents Jobs: billed invoice child rows; DocumentsJobBilledInvoiceModal (HostedStripeBillPanel + PipeTooling PDF preview); jobBillingContext + physicalInvoice helpers in lib"
  - name: "Latest Version (v2.326)"
    line: ~1050
    description: "Physical invoice Resend subject: Click Plumbing Invoice [#…]; physicalInvoiceEmailSubject"
  - name: "Latest Version (v2.325)"
    line: ~1062
    description: "Bill Customer collapsible Line/Memo; memo preset normalization; physical invoice email tagline bold, no Service date/Issuer in summary"
  - name: "Latest Version (v2.324)"
    line: ~1074
    description: "Physical invoice Services proportional split matches Stripe (blank line on bill); physicalInvoiceFixtureScaling"
  - name: "Latest Version (v2.323)"
    line: ~1085
    description: "Physical invoice detailed HCP-style PDF (fixtures/materials/payments); Settings company block; physicalInvoiceLineItems"
  - name: "Latest Version (v2.322)"
    line: ~1097
    description: "Bill Customer Physical invoice: email customer with matching PDF; send-physical-invoice-email Edge"
  - name: "Latest Version (v2.321)"
    line: ~1108
    description: "Bill Customer: HouseCall Pro + Physical invoice as top tabs (with Stripe bill); remove Outside bill"
  - name: "Latest Version (v2.320)"
    line: ~1119
    description: "Legacy revenue → first Specific Work row (migration); Edit Job break-off slider 5% snap + % of job total hint"
  - name: "Latest Version (v2.319)"
    line: ~1130
    description: "NCNS when scheduled no clock: record_ncns + job_schedule_blocks branch; My Time schedule probe"
  - name: "Latest Version (v2.318)"
    line: ~1141
    description: "My Time: Not coming in uses stacked confirm dialog (replaces window.confirm); z-index 1320, Escape/backdrop"
  - name: "Latest Version (v2.317)"
    line: ~1052
    description: "Quickfill Schedule: roster rows grouped by auth role (People-style headings); usersTabRosterRoleSections.ts"
  - name: "Latest Version (v2.316)"
    line: ~1065
    description: "Dashboard: block My Time modal when work_date is hours-correct; RLS SELECT on hours_days_correct for authenticated"
  - name: "Latest Version (v2.315)"
    line: ~1077
    description: "My Time cross-row merge (mixed punch/salary): affine partition save, merge gates, salary-sync toast; SALARY_CLOCK_SESSIONS.md"
  - name: "Latest Version (v2.314)"
    line: ~1028
    description: "Documents page: Jobs ledger, add-link modal (+), full-width search, compact header (no visible title)"
  - name: "Latest Version (v2.313)"
    line: ~1001
    description: "Stripe multi-line from Specific Work; Edit Job Stripe char count + scope disclosure; Bill Customer line-on-bill defaults"
  - name: "Latest Version (v2.312)"
    line: ~1013
    description: "Jobs Specific Work: unit price + description per jobs_ledger_fixtures row; Detail + Billing grid"
  - name: "Latest Version (v2.311)"
    line: ~1026
    description: "Bids Pricing price book New/Edit entry: decimal dollars (step 0.01, inputMode decimal)"
  - name: "Latest Version (v2.310)"
    line: ~1037
    description: "Quickfill Schedule/Office/Email/Texts/Physical UX + stale tally Assign modal seed fix; DispatchAddBlockTimeRange session strip sizing"
  - name: "Latest Version (v2.309)"
    line: ~1051
    description: "Quickfill Physical inbox section + Schedule Dispatch hub Day tab (hubTab=day, day= URL focus)"
  - name: "Latest Version (v2.308)"
    line: ~1071
    description: "Quickfill Schedule: hide assistants/estimators toggle + fetchUsersTabRosterForScheduleDispatchHub (id, role)"
  - name: "Latest Version (v2.307)"
    line: ~1064
    description: "Quickfill Schedule: client-side search by person or job (filteredSortedUsers, Clear)"
  - name: "Latest Version (v2.306)"
    line: ~1074
    description: "Quickfill Schedule section: per-user read-only DispatchAddBlockTimeRange day preview + Schedule Dispatch link"
  - name: "Latest Version (v2.305)"
    line: ~1089
    description: "Jobs Sub Labor modal: crew search UX, Add Sub, line items + footer layout, Itemize label, collapsed section headers"
  - name: "Latest Version (v2.304)"
    line: ~1103
    description: "Stripe send confirm modal: PipeTooling send history from jobs_ledger_invoice_stripe_email_sends; Edge log append"
  - name: "Latest Version (v2.303)"
    line: ~1115
    description: "Jobs Stages Last activity: Stripe emailed customer + Resend invoice email (send-stripe-invoice); StripeInvoiceSendFromStripeButton variants"
  - name: "Latest Version (v2.302)"
    line: ~1128
    description: "Jobs Stages Ready to Bill: row amounts (unallocated / draft / remainder) + exposure total; jobsStagesBoard helpers + tests"
  - name: "Latest Version (v2.301)"
    line: ~1140
    description: "Partial RTB + primary remainder: ensure_single_ready_to_bill_invoice_for_job multi-row; Jobs/Edit Job call ensure after partial insert"
  - name: "Latest Version (v2.300)"
    line: ~1153
    description: "Send back from Billed: void-stripe-invoice-for-revert Edge + Jobs/Dashboard/ham + job-level pre-flight"
  - name: "Latest Version (v2.299)"
    line: ~1165
    description: "Public /estimate/accept: AuthPublicLandingLayout + wide sign-in stack + white card; authPublicLanding.css --wide + thank-you inner chrome strip"
  - name: "Latest Version (v2.298)"
    line: ~1176
    description: "Estimators: /customers route + nav; UPDATE RLS + trigger lock master_user_id and stripe_customer_id; EditCustomerForm omits master on save for estimators; ACCESS_CONTROL + Settings matrix"
  - name: "Latest Version (v2.297)"
    line: ~1189
    description: "People Hours grid blur: proportional scale of closed clock_sessions into My Time (preserve share of day); open session → fetch modal + toast; draft fallback; peopleHoursProportionalScale.ts"
  - name: "Latest Version (v2.296)"
    line: ~1207
    description: "Schedule Dispatch Add schedule block: occupied timeline (person-day), drag existing blocks as drafts, gap-clamped new range, batch save updates+insert; scheduleDispatchAddBlockTimeline.ts"
  - name: "Latest Version (v2.295)"
    line: ~1220
    description: "Schedule Dispatch hub People: ++ multi-cell add mode, FAB choose job, applyHubMultiCellJob bulk insert; parseHubPersonDayKey"
  - name: "Latest Version (v2.294)"
    line: ~1233
    description: "Schedule Dispatch hub People day cell: bottom-left triangle + opens Add job to schedule when cell has blocks (onHubAddJobToScheduleForCell)"
  - name: "Latest Version (v2.293)"
    line: ~1243
    description: "Schedule Dispatch hub: empty People cell opens Add job to schedule directly (hubCellAddContext); picker Create new job; no Add schedule block modal"
  - name: "Latest Version (v2.292)"
    line: ~1255
    description: "Clock In / Update Focus / Review before clock out: On schedule Dispatch job quick-picks (fetchDispatchScheduledJobsForAssigneeDay); work_date on open session for clock-out day; dedupe assigned list; info toast only when no assignments and no schedule"
  - name: "Latest Version (v2.291)"
    line: ~1268
    description: "People Hours matrix: blur with hours>0 opens My Time draft (8am APP_CALENDAR_TZ) directly—no choice modal; draft INSERT in DashboardMyTimeDayEditorModal; grid max(people_hours, pending clock); saveHours(0) after draft save; no NCNS in that modal; roster name without users match → toast + grid-only save; peopleHoursManualDraftSession.ts"
  - name: "Latest Version (v2.290)"
    line: ~1284
    description: "People dev-only Feedback tab (?tab=feedback): TeamFeedbackDevSettingsBlock standalone — Enabled persists to team_feedback_settings; Settings + Eligibility modals; raw submissions detail modal, CSV, dev delete; same block as Settings People & accounts"
  - name: "Latest Version (v2.289)"
    line: ~1296
    description: "My Time: pairwise-overlap cluster split (one card per session), Form/Visual separators + overlap double border, compact list chrome, prior-week footer trim, time+jobs layout; Quickfill People Hours (new) mobile day nav"
  - name: "Latest Version (v2.288)"
    line: ~1310
    description: "Estimates accepted-detail layout, Customer activity order/defaults, thank-you + chick, terms link line, footer tagline, link-view dedupe, CustomerSnapshotModal from detail"
  - name: "Latest Version (v2.287)"
    line: ~1324
    description: "Estimates customer_accepted: read-only accepted snapshot (superseded layout in v2.288)"
  - name: "Latest Version (v2.286)"
    line: ~1334
    description: "Jobs Stages: linked quote in Job column footer (estimates.job_ledger_id); loadJobs + pickLinkedEstimateForStagesBanner; project strip unchanged"
  - name: "Latest Version (v2.285)"
    line: ~1346
    description: "Edit Job Billing: Outstanding billing table (date + (+n), Stages/Bill, Stripe share icons, full-width Note/Memo row); Payments received (Date, Amount ($), Memo; Stripe row vs header, Record Payment); Partial invoice layout; StripeInvoiceSharePanel inlineRow"
  - name: "Latest Version (v2.284)"
    line: ~1357
    description: "Banking: product+tab URL (Mercury Ledger/Sorting vs Stripe Invoices/Data, dev-only Stripe); BankingStripeInvoicesPanel + BankingStripeWebhookEventsPanel; Jobs Stages: narrow loadJobs customer param, thread stats chunk 200 + generation guard, 320ms debounce"
  - name: "Latest Version (v2.283)"
    line: ~1371
    description: "Bill Customer Stripe pre-create preview (preview-stripe-invoice); StripeBillPreSubmitPreview; stripeInvoiceShareCopy; BillCustomerModalProvider + Edit Job Preview/Stripe bill; modal z-index over Edit Job"
  - name: "Latest Version (v2.282)"
    line: ~1388
    description: "Bill Customer Stripe tab (create-stripe-invoice); StripeInvoiceSharePanel (pay page, Dashboard, copy link, email, SMS text); webhook invoice.updated/voided/payment_failed; external_send_channel stripe"
  - name: "Latest Version (v2.281)"
    line: ~874
    description: "Dashboard Clocked in today: Mix (copy day job %); salary closed-day gate; My Time preview from Clock (punch locked); strip clockStripWorkDateYmd"
  - name: "Latest Version (v2.280)"
    line: ~871
    description: "Bids Rough takeoffs: unit price from lowest material_part_prices, source row on line, reset/save to catalog; migration source_material_part_price_id"
  - name: "Latest Version (v2.279)"
    line: ~884
    description: "Bids Bid Preview from B# (workflow + Bid Board); Submission notes toolbar + mobile center; notify-dispatch-request verify_jwt in config"
  - name: "Latest Version (v2.278)"
    line: ~847
    description: "DetailJobModalFilesPlansRow hide when both links empty; numbered Specific Work [1][2]; Repair in section title"
  - name: "Latest Version (v2.277)"
    line: ~858
    description: "Stacked Edit Job over Detail (JobFormModal z-index); JobDetail materials accordions + fetchJobMaterialsCostSnapshot; Other job charges label; Mercury Posted short date + Card column + useMercuryLedgerNicknames"
  - name: "Latest Version (v2.276)"
    line: ~871
    description: "DetailJobModal: three dates (derived Last bill date), formatJobDetailModalDateYmd, JobLedgerStatusPipeline, 640px layout, thread notes chrome; Edit stacking → v2.277"
  - name: "Latest Version (v2.275)"
    line: ~887
    description: "Jobs Stages j:/b: derived lines; loadJobs job_schedule_blocks batch; stagesJobReferenceDates; RTB Missing Billed Date separate"
  - name: "Latest Version (v2.274)"
    line: ~903
    description: "jobs_ledger last_work_date cache + clock_sessions triggers; last_bill_date rename; Ready to Bill RPC; Jobs UI + DetailJobModal"
  - name: "Latest Version (v2.273)"
    line: ~916
    description: "DetailJobModal: Scheduled block title includes weekday; date + time on second line; jobScheduleChicago formatters"
  - name: "Latest Version (v2.272)"
    line: ~926
    description: "DetailJobModal: Customer title + three stacked lines; tel/mailto; beside Address/schedule"
  - name: "Latest Version (v2.271)"
    line: ~936
    description: "DetailJobModal: Address + Scheduled block responsive CSS grid; Street View below"
  - name: "Latest Version (v2.270)"
    line: ~946
    description: "Schedule Dispatch hub People card title opens DetailJobModal (not PreviewJobModal); onOpenHubJobDetail"
  - name: "Latest Version (v2.269)"
    line: ~957
    description: "Schedule Dispatch: + Linked/Solo copy menu via portal (fixed); scroll/resize; Escape/outside close"
  - name: "Latest Version (v2.268)"
    line: ~967
    description: "Schedule Dispatch: linked badge pure overlay — no extra content padding (Grid + Hub)"
  - name: "Latest Version (v2.267)"
    line: ~977
    description: "Schedule Dispatch: Linked chain badge absolute top-right + content padding (Grid + Hub); minus/plus stay bottom-right"
  - name: "Latest Version (v2.266)"
    line: ~987
    description: "Schedule Dispatch: Hide weekend default on (localStorage unset); explicit 0/1 preserved; WeekNav default prop"
  - name: "Latest Version (v2.265)"
    line: ~998
    description: "Schedule Dispatch linked crew pill: FA chain icon (ScheduleDispatchLinkedChainsIcon) vs Linked text; Grid + Hub"
  - name: "Latest Version (v2.264)"
    line: ~1009
    description: "DetailJobModal Job activity / notes: useJobThreadNotesForModal + JobThreadNotesPanel (composer); Realtime INSERT"
  - name: "Latest Version (v2.263)"
    line: ~802
    description: "DetailJobModal Street View preview (Edge street-view-preview + GOOGLE_MAPS_API_KEY); fetchStreetViewPreview; open pano vs Maps fallback"
  - name: "Latest Version (v2.262)"
    line: ~798
    description: "DetailJobModal top Address → Google Maps (openInExternalBrowser); prefillAddress from assignedJobs; body Job address row deduped"
  - name: "Latest Version (v2.261)"
    line: ~798
    description: "DetailJobModal heading Job Detail: HCP, job name; prefillRowLabel from My schedule row; splitScheduleDetailRowLabel"
  - name: "Latest Version (v2.260)"
    line: ~810
    description: "Dashboard My schedule row → DetailJobModal; staff full JobWithDetails; subcontractor limited snapshot + assignedJobs fallback"
  - name: "Latest Version (v2.259)"
    line: ~792
    description: "Dashboard subcontractor My schedule: today + tomorrow Chicago job_schedule_blocks (read-only), Calendar link; dedupe linked mirror rows"
  - name: "Latest Version (v2.258)"
    line: ~802
    description: "Schedule dispatch DnD: solo cross-day + assignee; linked crew cross-day via move_job_schedule_block_group RPC"
  - name: "Latest Version (v2.257)"
    line: ~790
    description: "Linked schedule blocks (shared_block_group_id); Dispatch + Linked copy + group edit; Banking Mercury RPC null args vs gen types"
  - name: "Latest Version (v2.256)"
    line: ~810
    description: "Schedule dispatch hub: People | Jobs tabs, fetchJobScheduleBlocksForHubDateRange; Week overview link on detail"
  - name: "Latest Version (v2.255)"
    line: ~828
    description: "Schedule dispatch week grid: rows = team, columns = Central week days; DnD reassign same day; fetchJobScheduleBlocksForJobDateRange; Jobs Week dispatch link"
  - name: "Latest Version (v2.254)"
    line: ~842
    description: "job_schedule_blocks + Schedule modal (Jobs Stages thread); list_assigned_jobs project_id; Calendar Job preview + planned chips; PreviewJobModal, ScheduleJobModal, jobScheduleBlocks lib"
  - name: "Latest Version (v2.253)"
    line: ~775
    description: "Calendar month: enriched clock_sessions fetch (job/bid embeds); non-rejected/non-revoked per-session chips (cap +N, Central time) + Clock sessions list in day modal; recorded hours aggregate unchanged; calendarClockSessionDisplay + CLOCK_SESSION_CALENDAR_SELECT"
  - name: "Latest Version (v2.252)"
    line: ~788
    description: "Pay History: Draft Payroll prior Sun–Sat week + crew merge; person_offsets employee_credit; Record payment min(amount, remaining) + optional credit; Job Summary get_invoice_allocation_lines_for_jobs; tally staff split save align"
  - name: "Latest Version (v2.251)"
    line: ~786
    description: "Dashboard strip Jobs worked today: ClockSessionStripApproveControl parity with Clocked in today detail rows"
  - name: "Latest Version (v2.250)"
    line: ~797
    description: "My Time day editor: prior-week acknowledgment + this+last week save window (getThisAndLastWeekRange); editableRange prop ignored"
  - name: "Latest Version (v2.249)"
    line: ~808
    description: "Salary split sync: overlap guard uses work_date or clock-in civil date in template TZ (20270408153000); avoids duplicate empty canonical slot 1"
  - name: "Latest Version (v2.248)"
    line: ~820
    description: "Stale tally Assign: dev/master_technician/assistant search all jobs_ledger for non-sub targets (LIMIT 50); sub targets team-only"
  - name: "Latest Version (v2.247)"
    line: ~832
    description: "Stale tally Assign to jobs: search_jobs_for_tally_mercury_assign_as_user uses staff invoker job visibility except subcontractor targets (team-only)"
  - name: "Latest Version (v2.246)"
    line: ~844
    description: "Stale tally follow-up: assistant scope = adopted masters job teams (Option A staff_can_view_user_for_tally_followup)"
  - name: "Latest Version (v2.245)"
    line: ~855
    description: "Stale tally staff follow-up: assistant same target scope as dev (staff_can_view_user_for_tally_followup)"
  - name: "Latest Version (v2.244)"
    line: ~867
    description: "Estimates Customer activity: DB trigger + record_estimate_public_link_view RPC; timeline IP for link + accept; accept-estimate alreadyAccepted audit"
  - name: "Latest Version (v2.243)"
    line: ~879
    description: "Settings (dev): list_job_counts_by_master_for_dev_settings RPC replaces full jobs_ledger scan; batched app_settings keys; parallel adoption + dev template loaders"
  - name: "Latest Version (v2.242)"
    line: ~890
    description: "Quickfill Warnings section (first in SECTIONS): stale tally staff banner + modal when RPC has rows; useStaleTallyStaffFollowUp + tallyStaleMinAgeDays; Dashboard refactored to same hook"
  - name: "Latest Version (v2.241)"
    line: ~902
    description: "Dashboard stale tally staff follow-up: list_stale_unlinked_mercury_transactions_for_tally_staff; blue banner + modal; replace_mercury_job_splits_for_linked_card_as_staff + search_jobs_for_tally_mercury_assign_as_user via MercuryTransactionAllocationsModal tallyActAsUserId"
  - name: "Latest Version (v2.240)"
    line: ~913
    description: "Dashboard stale tally banner: count_unlinked_mercury_transactions_for_tally_stale; DashboardTallyStaleBanner above Job Parts Tally row; Chicago calendar age > min_age_days"
  - name: "Latest Version (v2.239)"
    line: ~924
    description: "Estimates: Unlink job (clear job_ledger_id) + confirm modal; sent — Copy/Open customer link under waiting copy; EstimateCustomerAcceptLinkButtons DRY; no duplicate link buttons in Customer experience when sent"
  - name: "Latest Version (v2.238)"
    line: ~935
    description: "Estimates → Jobs: create_job_from_estimate RPC; Create job from estimate modal; Jobs Source estimate + CustomerAcceptanceRecordModal"
  - name: "Latest Version (v2.237)"
    line: ~947
    description: "Estimates accept UX: modal omit accept_instructions + centered submit; EstimateCustomerDocument total right-aligned; Estimates detail # inline in h1; inline Customer acceptance disclosure + agreement checkbox"
  - name: "Latest Version (v2.236)"
    line: ~960
    description: "Estimates Line item catalog modal: Insert from catalog + Edit book in one header row (title, tabs, ×); Estimates.tsx"
  - name: "Latest Version (v2.235)"
    line: ~767
    description: "Estimates Preview as customer: staff snapshot in localStorage + TTL + parse-then-remove (cross-tab); estimateStaffAcceptPreview.ts"
  - name: "Latest Version (v2.234)"
    line: ~778
    description: "Estimates: customer_experience app_settings defaults (Settings dev), per-draft overrides + customer_experience_sent at send; estimateCustomerExperience shared lib + Edge; customer_experience on get-estimate"
  - name: "Latest Version (v2.233)"
    line: ~791
    description: "Estimates global Quote # (estimate_number), staff /estimates/{n} URLs, Customer experience previews (Email / Acceptance / Thank you), shared estimateCustomerEmail + EstimateCustomerDocument / EstimateCustomerThankYou"
  - name: "Latest Version (v2.232)"
    line: ~806
    description: "Estimates Approach A — ship: estimates table, Edge get/accept/send, Estimates + EstimateAccept routes, docs cross-links"
  - name: "Latest Version (v2.231)"
    line: ~819
    description: "Dashboard Jobs worked today → My Time; clock interval Overlap badges + day-editor callout + multiAlloc label; impersonation Back (Layout) / Back to my Account (Settings)"
  - name: "Latest Version (v2.230)"
    line: ~831
    description: "People Users tab: Subcontractors with accounts first; roster-only subs under External Subcontractors; pay roster label aligned; People.tsx renderUsersTabRosterListItem"
  - name: "Latest Version (v2.229)"
    line: ~681
    description: "Salaried sessions: indexed-slot split RPCs → user_punch children; salary_sync split-mode overlap guard (20270403180000); SALARY_CLOCK_SESSIONS.md runbook"
  - name: "Latest Version (v2.228)"
    line: ~680
    description: "Settings Salaried workday: Day end / session end labels (formatSalaryBlockEndDisplay); split layout default first block; salary_sync_one_user_clock_sessions continuous INSERT guard (20270402100000); migration history cleanup"
  - name: "Latest Version (v2.227)"
    line: ~675
    description: "Mercury ledger Realtime (mercury_transactions publication); Banking + Quickfill debounced refetch; mercury-webhook ops checklist in EDGE_FUNCTIONS"
  - name: "Latest Version (v2.226)"
    line: ~672
    description: "Dashboard Job Parts Tally icon: unlinked Mercury count badge (count_unlinked_mercury_transactions_for_tally); focus refresh; Dashboard.tsx"
  - name: "Latest Version (v2.225)"
    line: ~668
    description: "Job Parts Tally Transactions: client search (tallyTransactionSearch); Mercury note icon (MercuryTransactionNoteIcon); parseTallyJobSplitsJson in tallyJobSplits; search above table headers"
  - name: "Latest Version (v2.224)"
    line: ~665
    description: "Quickfill: Banking-style section headers + dividers; Banking sorting inline Link; People Hours (new) assistance notice; Jobs Billing min HCP"
  - name: "Latest Version (v2.223)"
    line: ~688
    description: "Crew Jobs / Bids: Realtime refetch in CrewJobsBlock; clock_sessions trigger resyncs crew rows on job/bid assign"
  - name: "Latest Version (v2.222)"
    line: ~700
    description: "Quickfill Banking sorting: parallel relations + nickname maps; Total available summary"
  - name: "Latest Version (v2.221)"
    line: ~682
    description: "Mercury Link to jobs: equal % auto-split on add/remove (redistributeEqualSplit); saved DB splits unchanged on open"
  - name: "Latest Version (v2.220)"
    line: ~690
    description: "Jobs Parts: mercuryCardChargesByJobId Math.abs(allocation amount); card cost display positive"
  - name: "Latest Version (v2.219)"
    line: ~675
    description: "Banking Mercury Link to jobs: charge UI; $/% splits; note on mercury_transaction_job_allocations; replace_mercury_transaction_splits note"
  - name: "Latest Version (v2.218)"
    line: ~688
    description: "Banking Mercury person: user_id on mercury_transaction_attributions; list_users_for_banking_attribution; replace_mercury_transaction_splits p_user_id"
  - name: "Latest Version (v2.217)"
    line: ~700
    description: "Banking sortable columns (posted_at, account, Mercury id); mercury_account_nicknames + filter labels + manage nicknames UI"
  - name: "Latest Version (v2.216)"
    line: ~712
    description: "AuthProvider + useAuth; Bids bidWorkflowTabHeading; can_edit_clock_sessions_for_user Option A (master/assistant/superintendent); My Time merge reducer guard fix"
  - name: "Latest Version (v2.215)"
    line: ~725
    description: "Banking dev-only page; mercury_transactions RLS; sync-mercury-transactions + mercury-webhook; Layout nav between Jobs and Materials"
  - name: "Latest Version (v2.214)"
    line: ~738
    description: "Layout header shared button height; Dashboard strip Assign optimistic + parallel loadPending; Calendar bottom stack chip centering"
  - name: "Latest Version (v2.213)"
    line: ~682
    description: "Calendar month grid: blue day affordance (hover #eff6ff, focus-visible outline, in-month numeral #1d4ed8), aria-label; Calendar.css calendar-grid-day"
  - name: "Latest Version (v2.212)"
    line: ~694
    description: "Calendar: green scheduled workday only after today; unpaid time off (purple) all days; showScheduledSalaryProjectionForYmd"
  - name: "Latest Version (v2.211)"
    line: ~706
    description: "Calendar: NCNS chip + day-modal detail (subject read-own RLS); optional Show recorded time vs salary workday; calendarClockedHoursByDate"
  - name: "Latest Version (v2.210)"
    line: ~719
    description: "People Writeups tab: unified timeline table (template writeups + read-only NCNS from attendance_incidents); NcnsDetailModal; filters hide NCNS when Template/Status/Disclosure not All"
  - name: "Latest Version (v2.209)"
    line: ~625
    description: "Dashboard team My Time: NCNS from day editor (attendance_incidents + reject day); extra confirm if approved sessions (payroll + trust)"
  - name: "Latest Version (v2.208)"
    line: ~618
    description: "People Writeups own tab (?tab=writeups): writeup_templates + writeups; legacy contracts_sub=writeups redirects"
  - name: "Latest Version (v2.207)"
    line: ~605
    description: "People Salaried workdays bulk modal: org bulk unpaid time off via pay_staff_bulk_insert_user_time_off (+ internal row helper); payStaffBulkTimeOff.ts; PL/pgSQL-safe per-user failures (helper, not savepoint inside EXCEPTION)"
  - name: "Latest Version (v2.206)"
    line: ~595
    description: "Settings Salaried workday collapsible; people_pay_config self-read RLS for salary Settings; Dashboard clock strip stripScopeOverlay wrapper removed (My team/Everyone, Needs attention)"
  - name: "Latest Version (v2.205)"
    line: ~596
    description: "Company calendar America/Chicago: dateUtils APP_CALENDAR_TZ, getDefaultWeekRange Sunday week in Chicago, salary SQL + split RPCs v_tz, sync-salary-sessions, bulk UPDATE templates"
  - name: "Latest Version (v2.203)"
    line: ~600
    description: "Dashboard Jobs worked today: two-column layout; job link + inline [ hours • people ] on line 1, address line 2; JOBS_WORKED_TODAY_COL_SPAN 2; DashboardTeamActiveClockStrip"
  - name: "Latest Version (v2.202)"
    line: ~590
    description: "Dashboard Jobs worked today: group by job (jobsWorkedTodayStripRows), collapsible + per-job sessions; localStorage dashboard_clock_strip_jobs_worked_today_collapsed"
  - name: "Latest Version (v2.201)"
    line: ~586
    description: "Clocked in today focused filter: unassigned or pending approval; stripRowInFocusedClockedInView + optimistic merge (Needs attention button)"
  - name: "Latest Version (v2.200)"
    line: ~600
    description: "Clocked in today: optimistic approved icon after approve RPC (stripApproveStatusForSession, optimisticStripApprovedIds)"
  - name: "Latest Version (v2.199)"
    line: ~614
    description: "Session actions modal: **Current assignment** display, Open job/bid, Change assignment (collapse search), Clear; stripActionsPayloadFromSession"
  - name: "Latest Version (v2.198)"
    line: ~628
    description: "Clock strip **Session actions** modal (long-press / Shift+click / SR): Approve, Reject… → confirm, Edit memo + job/bid, Revoke; ClockSessionStripActionsModal; z-index above assign popover"
  - name: "Latest Version (v2.197)"
    line: ~644
    description: "Clocked in today expanded sessions: approve (click) + reject (hold or Shift+click → in-app modal); ClockSessionStripApproveControl; strip refreshes via loadPending"
  - name: "Latest Version (v2.196)"
    line: ~649
    description: "Clocked in today **Show all** vs **Show missing** (default **Show missing**; rows with no job+bid); DashboardTeamActiveClockStrip"
  - name: "Latest Version (v2.195)"
    line: ~659
    description: "Dashboard clock strip: collapsible Clocked in today; unified table thead row; localStorage dashboard_clock_strip_clocked_in_today_collapsed"
  - name: "Latest Version (v2.194)"
    line: ~671
    description: "My Time Visual: split boundary drag ends on pointerup over handle; slimmer handle + grabbing cursor (body class); coarse-pointer touch sizing in index.css"
  - name: "Latest Version (v2.193)"
    line: ~554
    description: "My Time merge job-choice modal + segmentJobOverrides on SplitEditorState; attachAllocationsToPayloads + labels; drag/nudge clears overrides; MyTimeMergeSegmentsModal"
  - name: "Latest Version (v2.192)"
    line: ~549
    description: "Dashboard My Time / Edit time: Merge up / Merge down to remove a virtual segment (adjacent merge + combined notes); min segment + allocation confirm; splitReducer removeSegmentMergeWithPrev/Next"
  - name: "Latest Version (v2.191)"
    line: ~556
    description: "SPA Hard Reload via /?nocache + index.html replaceState; Clock In no-assigned-jobs toast loop fix (ToastContext useMemo + ClockInOutButton ref + one-shot guard)"
  - name: "Latest Version (v2.190)"
    line: ~545
    description: "Customer required for RTB Invoice/Update + Ham billed; Dashboard RPC customer_id; Edit Job billing highlight + Record Payment + Open invoices order; RTB send-back copy"
  - name: "Latest Version (v2.189)"
    line: ~545
    description: "Primary RTB bundle (is_primary_rtb_bundle); merged Ready to Bill rows in Jobs Stages + Dashboard; ensure RPC sets flag"
  - name: "Latest Version (v2.186)"
    line: ~537
    description: "Settings Templates & testing: collapsible Workflow email (Edge Function) smoke test for send-workflow-notification; test-email / send-workflow-notification gateway verify_jwt in config.toml"
  - name: "Latest Version (v2.185)"
    line: ~533
    description: "Jobs Stages: Last activity column (latest thread preview, Central Time); DROP stage_notes; jobs_ledger_thread_note_stats + body/author"
  - name: "Latest Version (v2.184)"
    line: ~535
    description: "Job thread notes composer: Enter to post, Shift+Enter new line (JobThreadNotesPanel)"
  - name: "Latest Version (v2.183)"
    line: ~545
    description: "Jobs Stages + Workflow: job ledger thread notes (expand row, stats RPC, realtime); useJobThreadNotes hook"
  - name: "Latest Version (v2.182)"
    line: ~561
    description: "Dashboard Clock In / Update Focus: assigned jobs auto-loaded; no Choose button/labels; hidden single-type Filtering by line; stronger field borders + focus rings"
  - name: "Latest Version (v2.181)"
    line: ~574
    description: "Jobs Edit billing: comma formatting for Job Total and payment amounts; Workflow line items optional item_date + clipboard bulk import (tab-separated)"
  - name: "Latest Version (v2.180)"
    line: ~591
    description: "Bids New/Edit modal: SearchableSelect pickers; top field grid + mobile layout; Address / Distance+Plan Pages; wider modal; estimator header Bid button height"
  - name: "Latest Version (v2.179)"
    line: ~508
    description: "Dashboard My Time / Edit time: this-week-only save (Denver `getDefaultWeekRange()`); Form vs Visual defaults; form grid, splits, Ends at, datetime inputs; Assign popover chip"
  - name: "Latest Version (v2.178)"
    line: ~521
    description: "People: primary/superintendent on `people` roster (`20260329042321`); Pay/Hours via `allRosterNames`; Jobs/Quickfill roster"
  - name: "Latest Version (v2.177)"
    line: ~517
    description: "People: Housing tab (units + possessions); pay stub HTML Housing after vehicles (`housing_units`, `housing_possessions`)"
  - name: "Latest Version (v2.176)"
    line: ~512
    description: "People Pay History: Ledger header — open stub count + total remaining balance (search-filtered)"
  - name: "Latest Version (v2.175)"
    line: ~469
    description: "People Pay History: bulk modal button and title Run Payroll → Draft Payroll (state draftPayrollModalOpen)"
  - name: "Latest Version (v2.174)"
    line: ~469
    description: "People Pay History: pay_stub_additional_lines Additional (qty×rate), Net Pay gross−Less+Additional; Additional modal + solver; print"
  - name: "Latest Version (v2.173)"
    line: ~469
    description: "People Pay History: pay_stub_deductions Less + Net Pay; installment cap vs net; Less modal; print Less/Net Pay"
  - name: "Latest Version (v2.172)"
    line: ~485
    description: "People Pay History: pay_stub_payments partial installments; ledger Paid to date / Balance; Record payment / Clear; Run Payroll Partial; HTML footer"
  - name: "Latest Version (v2.171)"
    line: ~480
    description: "People Hours: Correct-day audit modal edit mode (crew + clock + add session); clock edit extracted; Highlight by job on grid"
  - name: "Latest Version (v2.170)"
    line: ~495
    description: "People Pay History: Ledger search by name; View removed from ledger (Print + dev trash icon); Generate Pay Reports modal/header UX"
  - name: "Latest Version (v2.169)"
    line: ~494
    description: "Dashboard Dispatch inbox thread notes (expand row, presets, CST + days ago, closed as final block); dispatch_request_notes migration"
  - name: "Latest Version (v2.168)"
    line: ~451
    description: "Bids: Bid Date Sent attestation modal (three checkboxes), persistence on bids, days ago + acknowledger under field"
  - name: "Latest Version (v2.167)"
    line: ~464
    description: "Settings: Pay Approved Masters, team feedback, Additional People moved into People & accounts; Advanced group and Role & access jump removed"
  - name: "Latest Version (v2.166)"
    line: ~458
    description: "Settings (dev): Your account shows days since last successful Export all backup; localStorage per auth user"
  - name: "Latest Version (v2.165)"
    line: ~470
    description: "Settings: Sharing and Adoption merged into People & accounts; jump link settings-people for dev and master; docs updated"
  - name: "Latest Version (v2.164)"
    line: ~468
    description: "Settings (dev): Ignored task types under Dashboard & alerts; list and Un-ignore for dev_ignored_checklist_items"
  - name: "Latest Version (v2.163)"
    line: ~448
    description: "Dashboard clock strip (Today, My team/Everyone); Materials supply house website in expanded row"
  - name: "Latest Version (v2.162)"
    line: ~450
    description: "Team feedback: dev eligibility reset, submit uses auth user id, SELECT-own migration, raw submission names"
  - name: "Latest Version (v2.161)"
    line: ~450
    description: "Migration 20270329120000: list_feedback_peer_candidates label-only RPC final (supersedes June 2026 roster variants)"
  - name: "Latest Version (v2.160)"
    line: ~460
    description: "Team feedback list_feedback_peer_candidates: peers by shared label_id only (users + people), no roster union"
  - name: "Latest Version (v2.159)"
    line: ~472
    description: "Team feedback peer picker: list_feedback_peer_candidates shared_tag_count, sort by shared labels"
  - name: "Latest Version (v2.156)"
    line: ~418
    description: "People Activity tab, user_app_activity_viewers allowlist, RLS for granted assistant/master/primary"
  - name: "v2.154"
    line: ~430
    description: "People Licenses: Dispatch Inbox task when license first qualifies as expiring within 30 days"
  - name: "v2.153"
    line: ~430
    description: "Dashboard My Team: Clock activity order/label; pending banner full-bar jump to Pending sessions"
  - name: "v2.152"
    line: ~430
    description: "My Team: People you lead Pending/Approved/Total hours table (clock_sessions, Start–End range)"
  - name: "v2.151"
    line: ~448
    description: "My Team: clock notify prefs + ledger; team_leader_clock_notify_prefs; notify-team-lead-clock Edge Function"
  - name: "v2.150"
    line: ~461
    description: "Dashboard My Team: People you lead roster (names from team_leader_assignments + users)"
  - name: "v2.149"
    line: ~455
    description: "Clock sessions table UX; pending action order; My Roles Goals gate; user_dashboard_goals + user_daily_goals_ack"
  - name: "v2.148"
    line: ~445
    description: "Bid Board All notes unified stack; customer notes card UX; customer_contacts contact_method"
  - name: "v2.147"
    line: ~332
    description: "Remove specific pins, Page pins for all roles, assistant tally layout, last_report_at"
  - name: "v2.146"
    line: ~340
    description: "Billing sections above Checklist for Dev/Master"
  - name: "v2.145"
    line: ~345
    description: "Master tech mobile nav Quickfill and Review in hamburger"
  - name: "v2.144"
    line: ~340
    description: "Assistant billing sections at top of Dashboard"
  - name: "v2.143"
    line: ~340
    description: "Assistant Dashboard section reorder"
  - name: "v2.142"
    line: ~340
    description: "Dashboard Assigned Jobs and Superintendent Jobs UX"
  - name: "v2.141"
    line: ~380
    description: "Hours reviewed ledger for Pay tab"
  - name: "v2.140"
    line: ~365
    description: "RLS policy name truncation fix, AbortError non-retryable"
  - name: "v2.139"
    line: ~365
    description: "Fix cost_estimates RLS for assistants"
  - name: "v2.138"
    line: ~365
    description: "Revoke superintendent Jobs Billing access"
  - name: "v2.137"
    line: ~355
    description: "Superintendents: Approve and Send Back: Previous Work Incomplete"
  - name: "v2.136"
    line: ~365
    description: "Line Items For Office, supply house invoice linking, clock pay INSERT, dispatch dismissals"
  - name: "v2.135"
    line: ~362
    description: "Workflow: Collapse old stages toggle, breadcrumb below buttons, no-wrap scroll"
  - name: "v2.134"
    line: ~352
    description: "Assistants: private notes and Approve/Previous work incomplete"
  - name: "v2.133"
    line: ~352
    description: "Approve/Previous work incomplete restricted to dev/master, visual separation"
  - name: "v2.132"
    line: ~352
    description: "Workflow step cards row collapse, button modernization"
  - name: "v2.131"
    line: ~352
    description: "People Contracts tab"
  - name: "v2.125"
    line: ~330
    description: "approve_clock_sessions fix, approveClockSessions helper, db.schema"
  - name: "v2.123"
    line: ~330
    description: "Stages paid/left/bid labels, to bill formula, Job Total in Edit/New Job"
  - name: "v2.122"
    line: ~345
    description: "Bids Counts drag-and-drop reordering, removed up/down arrows"
  - name: "v2.121"
    line: ~340
    description: "Stages ClickTooling icon, Billing UX refactor, Report count styling"
  - name: "v2.115"
    line: ~340
    description: "Cover Letter trip charge, Customers search, Layout mobile"
  - name: "v2.111"
    line: ~330
    description: "Recently Completed Tasks button icons"
  - name: "v2.110"
    line: ~330
    description: "Dev Ignored Tasks section in Recently Completed Tasks"
  - name: "v2.109"
    line: ~330
    description: "Checklist item links; Per-task mute preferences"
  - name: "v2.108"
    line: ~330
    description: "Stages: Ham mode date buttons, Stage Notes, job name wrap, View Reports keyboard close"
  - name: "v2.107"
    line: ~340
    description: "Checklist multi-assignee support"
  - name: "v2.106"
    line: ~335
    description: "Dev login for testing without credentials"
  - name: "v2.105"
    line: ~355
    description: "Revoke Approved; Accountability; Quickfill clock sessions; Job Cost hidden"
  - name: "v2.103"
    line: ~325
    description: "Bids Pricing Print uses user-entered unit cost overrides"
  - name: "v2.101"
    line: ~345
    description: "Location capture at clock-in/out; Location column in Pending sessions"
  - name: "v2.100"
    line: ~330
    description: "Clock In/Out with required notes modal; Pending clock sessions; edge cases"
  - name: "v2.99"
    line: ~355
    description: "External Team removed; Sub Labor Due pin; Supply Houses tab only"
  - name: "v2.98"
    line: ~318
    description: "Supply Houses: Show paid invoices toggle, Monthly payment date, fallback when migration not applied"
  - name: "v2.97"
    line: ~330
    description: "Bids Counts: Save & Add label, Cancel styling; Bids Pricing: Price book centered, total row cleanup"
  - name: "v2.96"
    line: ~318
    description: "PWA auto-update: removed New version available banner, app reloads automatically on deploy"
  - name: "v2.95"
    line: ~335
    description: "Edit Sub Labor: Remove in Edit Payment modal, number inputs blur on scroll; Bids persistent New Bid button"
  - name: "v2.94"
    line: ~320
    description: "Bid Board Counts icon, Cover Letter inclusions fix, Apply buttons hidden when synced"
  - name: "v2.93"
    line: ~325
    description: "Primaries full Bids access (all tabs, create/edit/delete)"
  - name: "v2.92"
    line: ~325
    description: "Bids Counts Group/Tag column"
  - name: "v2.90"
    line: ~310
    description: "Jobs New Job Labor: labor rate per row, field layout, Add Subcontractor placement, default $20 rate"
  - name: "v2.89"
    line: ~325
    description: "Jobs Team Labor expandable rows, hidden from assistants; Job Summary Team Labor fix; Prospects Team tab for assistants"
  - name: "v2.88"
    line: ~305
    description: "People Review: Total Labor fix, Rest of Teams Labor, Sub Labor label, User on Job Rev/hr Profit/hr"
  - name: "v2.87"
    line: ~275
    description: "Timezone fix across app, People mobile tabs, Jobs search bars, Review Last Month = 30 days"
  - name: "v2.86"
    line: ~275
    description: "People Review: Profit labels, Formula B, sub labor fix, Team Labor excludes subs; Crew Jobs Hours column"
  - name: "v2.85"
    line: ~240
    description: "People Review: Team Summary, Only Count Paid in Full, exclude labor from non-paid"
  - name: "v2.84"
    line: ~256
    description: "Team Summary removed, Jobs tab order, Review Profit, SECURITY DEFINER RPCs"
  - name: "v2.83"
    line: ~256
    description: "Sync to Testing script, Archive/Restore user flow"
  - name: "v2.82"
    line: ~268
    description: "Person/User duplicate merge, Pay tab detection, cascade pay_stubs"
  - name: "v2.81"
    line: ~230
    description: "Bids Counts Import from /Tooling, Pricing partial-fill, Inspections, Reports"
  - name: "v2.80"
    line: ~230
    description: "Prospects Address field, Follow Up quick notes"
  - name: "v2.79"
    line: ~210
    description: "Quickfill feedback loop, section nav, Prospects Team tab, label updates"
  - name: "v2.78"
    line: ~240
    description: "AR removed, Billed Awaiting Payment, Quickfill Billed section, Total by Name modal"
  - name: "v2.77"
    line: ~186
    description: "Settings Data backup top, Maintenance minimizable, Fixture type badges, Bids Counts Import"
  - name: "v2.76"
    line: ~186
    description: "Prospects copy templates, mail icon, subject line, email sent tracking; Settings My Profile"
  - name: "v2.73"
    line: ~200
    description: "Checkbox modals restored, unified stages table, invoice buttons green"
  - name: "v2.72"
    line: ~200
    description: "Whole Jobs Through Stages alongside Partial Invoices"
  - name: "v2.68"
    line: ~200
    description: "Primary Bids RFI/Change Order/Lien Release, Projects hidden"
  - name: "v2.67"
    line: ~200
    description: "Team Costs, Crew Jobs in Quickfill, Fixture Send to Office, Show my jobs only, Quick task removal"
  - name: "v2.65"
    line: ~230
    description: "Job Bill Details Edit actions, Jobs/Dashboard button labels, Edit Parts, Stages default"
  - name: "v2.62"
    line: ~210
    description: "Prospects enhancements: New Prospect button, Convert tab, callbacks, timer, comments"
  - name: "v2.60"
    line: ~210
    description: "Dashboard button visibility, impersonation redirects, back-button fix"
  - name: "v2.59"
    line: ~200
    description: "Workflow collapsible sections, notify defaults, line items total"
  - name: "v2.58"
    line: ~200
    description: "Subcontractor Job Tally Submit for Review RLS fix"
  - name: "v2.57"
    line: ~200
    description: "Dashboard reports modal, icons, hide, delete dev-only; Settings save confirmation toast; ToastContext"
  - name: "v2.56"
    line: ~165
    description: "Job Tally quantity, Materials abbreviations, Primary role"
  - name: "v2.55"
    line: ~165
    description: "Dashboard and Jobs UI label updates"
  - name: "v2.53"
    line: ~165
    description: "Supply Houses & External Subs, Jobs Receivables, Dashboard pins"
  - name: "v2.52"
    line: ~165
    description: "People Pay layout, Cost matrix mobile dates, Builder Review PIA"
  - name: "v2.51"
    line: ~165
    description: "Fix app page, Cost matrix pins, Builder Review, Supabase troubleshooting"
  - name: "v2.49"
    line: ~165
    description: "Labor and Sub Sheet Ledger moved from People to Jobs"
  - name: "v2.48"
    line: ~165
    description: "Checklist FWD, Estimator Dashboard, iOS Safe Area, Jobs Fix"
  - name: "v2.47"
    line: ~195
    description: "Hours Update Pay Sync via Supabase Realtime; Pay tab updates when any user changes hours"
  - name: "v2.46"
    line: ~175
    description: "Supabase disk IO optimizations, Materials batching, Load All default off"
  - name: "v2.45"
    line: ~130
    description: "Impersonation fix (localStorage), Teams compact, Yesterday label"
  - name: "v2.41"
    line: ~140
    description: "People Pay/Hours tabs, Cost matrix, Hours totals, People pay config collapsible"
  - name: "v2.40"
    line: ~140
    description: "People Labor/Ledger, Master Shares, Edit button, Estimators see masters"
  - name: "v2.37"
    line: ~140
    description: "Add missing fixtures, driving in pricing, cover letter inclusions/design date, price book default"
  - name: "v2.34"
    line: ~220
    description: "Duplicates page enhancements, Materials filter fixes, Part Type category removal"
  - name: "v2.32"
    line: ~116
    description: "Settings renames, Materials Load All, Cost Estimate distance"
  - name: "v2.29"
    line: ~110
    description: "Price/Labor book enhancements and fixed price feature"
  - name: "Bids System Updates"
    versions: "v2.25, v2.24, v2.23, v2.22"
    description: "Book systems, driving costs, pricing features"
  - name: "Materials Enhancements"
    versions: "v2.24, v2.20, v2.19"
    description: "Load All mode, infinite scroll, PO features"
  - name: "Database Improvements"
    versions: "v2.22"
    description: "Triggers, constraints, transaction functions"

quick_navigation:
  - "Latest features at top (v2.80)"
  - "Search for specific version: v2.XX"
  - "Search for feature name (e.g., 'Load All', 'Driving Cost')"

related_docs:
  - "[PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md) - Technical details"
  - "[BIDS_SYSTEM.md](./BIDS_SYSTEM.md) - Bids features"
  - "[MIGRATIONS.md](./MIGRATIONS.md) - Database changes"

when_to_read:
  - Understanding what changed recently
  - Finding when a feature was added
  - Reviewing project evolution
  - Catching up after time away
---

## Table of Contents
**New:** [v2.368 — **Public** **`/contract/accept`**: no **For:** signer line; **title-only** thank-you + **`public/pup.jpg`** + **`list_my_contract_dashboard_prompts`** CTA (**Go to dashboard** / **Return to PipeTooling** / **Sign in**) — **`ContractAccept.tsx`**, **`EstimateCustomerThankYou`** **`footerImageSrc`**](#latest-updates-v2368)
**New:** [v2.367 — **Dashboard** **Jobs worked today**: **No job or bid** aggregate row (**split-day** / unassigned segments); **`JOBS_WORKED_TODAY_UNASSIGNED_ID`**; muted label (**no** job **`Link`**) — **`useDashboardMyTeamSectionState`**, **`DashboardTeamActiveClockStrip`**](#latest-updates-v2367)
**New:** [v2.366 — **Bill Customer**: **`jobs_ledger.status`** → **billed** when the job is **fully invoiced out** (**Stripe**, **HouseCall Pro**, **Physical**) — **`maybePromoteJobToBilledAfterCustomerInvoice`** (**`promoteJobToBilledIfFullyInvoiced.ts`**); Edge **`send-physical-invoice-email`** persists invoice only](#latest-updates-v2366)
**New:** [v2.365 — **People** **Contracts**: **lineage** (**Ver.**), **Applied version** pin, **Edit** in **⋯**; **Contract Book** save → **`create_pending_contract_versions_after_book_save`** (signed → new **`unsent`** row)](#latest-updates-v2365)
**New:** [v2.364 — **Dashboard** **contract signing** prompt after **clock-in**; **People** per-document **Dashboard** checkbox; **`list_my_contract_dashboard_prompts`** + **`get-contract-signing-link-for-self`**](#latest-updates-v2364)
**New:** [v2.363 — **Undo OOB** **Stripe** fixes + **Payments received** / **Bill Customer** refresh after unwind (`onAfterOobUnwindSuccess`, **`refreshEditingJobAndHydratePayments`**)](#latest-updates-v2363)
**New:** [v2.362 — **Stripe** **hosted bill**: **Undo out-of-band payment** (credit note + **`revert_stripe_oob_invoice_payment`**, **`reverse-stripe-invoice-out-of-band-payment`**, **`UnwindStripeOobPaymentModal`**)](#latest-updates-v2362)
**New:** [v2.361 — **Stale tally follow-up**: **Posted** column adds **time of day** (**`April 16 (Thu) · 3:45 PM`**, **`APP_CALENDAR_TZ`**) — **`DashboardStaleTallyStaffFollowUpModal.tsx`**](#latest-updates-v2361)
**New:** [v2.360 — **Stale tally follow-up** (**`DashboardStaleTallyStaffFollowUpModal`**): **Posted** column **`April 16 (Thu)`** (**`APP_CALENDAR_TZ`**)](#latest-updates-v2360)
**New:** [v2.359 — **People** **Contracts** **Edit document**: **Delete** for **`unsent`** rows + **confirm** modal (`People.tsx`, **`person_contract_documents` DELETE**)](#latest-updates-v2359)
**New:** [v2.358 — **People** **Contracts** **Send for signature**: **Email preview** (subject + HTML body; placeholder signing link) — **`contractSendEmailPreview.ts`** + **`People.tsx`**](#latest-updates-v2358)
**New:** [v2.357 — **People** **Contracts** **Add document** → **Request Signature**: **Send** saves then opens **Send for signature** (`People.tsx`)](#latest-updates-v2357)
**New:** [v2.356 — **People** **Contracts** **Send for signature**: optional **email subject** + **opening message** (`People.tsx`, Edge **`send-contract-for-signature`**)](#latest-updates-v2356)
**New:** [v2.355 — **People** **Contracts** tab: **search** (person + contract) + **matching documents** lines (`People.tsx`)](#latest-updates-v2355)
**New:** [v2.354 — **People** **Contracts** **Manage templates**: indented document list under each template (`People.tsx`)](#latest-updates-v2354)
**New:** [v2.353 — **People** **Contracts** **Assign template** modal: **search** + **radiogroup** list (`People.tsx`)](#latest-updates-v2353)
**New:** [v2.352 — **People** **Contracts** **Contract Book** **View** + **Upload Signed** **status** polish (`ContractBookModal.tsx`, `People.tsx`)](#latest-updates-v2352)
**New:** [v2.351 — **People** **Contracts** **Contract Book**: migration **`book_body_html`** + **`tags`** on **`contract_template_documents`**; modal (**`ContractBookModal`**) + **Contracts** header + icon by **Contract text** (`People.tsx`)](#latest-updates-v2351)
**New:** [v2.350 — **People** **Contracts** **Add document** **Upload Signed**: no **Optional — signing page content** block; **Save** clears **`signing_body_html`** / **`canonical_document_url`** for that tab (`People.tsx`)](#latest-updates-v2350)
**New:** [v2.349 — **People** **Contracts** **Add document** **Request Signature**: no **Optional — after signing** block; **Save** clears **`url`** / **`signed_at`** / **`note`** for that tab (`People.tsx`)](#latest-updates-v2349)
**New:** [v2.348 — **People** **Contracts** **Add document** **Request Signature**: **Status** not editable; **Save** forces **`unsent`**; helper explains **Send** → **Sent** / signer → **Signed** (`People.tsx`)](#latest-updates-v2348)
**New:** [v2.347 — **People** **Contracts** **Add document**: **Upload Signed** / **Request Signature** tabs (field grouping + helpers; **Edit document** unchanged); **`role="tablist"`** + Arrow keys](#latest-updates-v2347)
**New:** [v2.346 — **People** **Contracts**: **`signing_body_html`** + **`canonical_document_url`**; **Send**/**Resend** signing email; public **`/contract/accept`** + Edge **`get-contract-for-signer`** / **`accept-contract`** / **`send-contract-for-signature`** (`sanitizeContractSigningHtml`, **`contract-signer-signatures`**)](#latest-updates-v2346)
**New:** [v2.345 — **Pay History** **Additional**: **prevailing wage** top-up lines — human **`description`** + **`source_clock_session_id`**; legacy **`[pw:uuid]`** prefix stripped in **modal** + **pay report** (`stripPrevailingWageTag`, **`payStubPrevailingWageLine.ts`**)](#latest-updates-v2345)
**New:** [v2.344 — **Edit Job** **Delete** in-app **confirm** modal; **Collect Payment** **hosted Stripe invoice** + **`update-collect-payment-stripe-customer-email`** (Terminal device Edge functions removed; **`complete_job_collect_payment_flow_for_invoice`**, Realtime **`jobs_ledger_invoices`**, **`return_collect_payment_to_dispatch`**)](#latest-updates-v2344)
**New:** [v2.343 — **Collect Payment** Step 1: **Job Book** always available (**search**, collapsible **default closed**), **Ready-to-Bill** warning only with no fixtures; Step 2 **Call Dispatch** in **footer**; **`JobBookEditorPanel`** **Work**/**Cost** typing UX](#latest-updates-v2343)
**New:** [v2.342 — **Job Book** (`job_book_entries`): **Collect Payment** Step 1 **Add** from read-only **Work**/**Cost** catalog; **Settings** CRUD (dev/master/assistant); **`add_collect_payment_fixture_from_job_book`** + **`job_service_type_id`** on certify payload](#latest-updates-v2342)
**New:** [v2.341 — **Field queue** **Line Items** + Stripe **line match** (red rows, Job total footer); **Prepare Bill** blue/green; **Add Line Items** → **Edit Job** **Specific Work** highlight; **Collect Payment** step titles **centered** (`fieldQueueFixtureStripeLineMatch`, `stripeInvoiceDetailsResponse`)](#latest-updates-v2341)
**New:** [v2.340 — **Send Back** (RTB→Working) **cancels** in-progress **Collect payment** flow; modal notice (`update_job_status`, `useSendBackCollectPaymentFlowNotice`)](#latest-updates-v2340)
**New:** [v2.339 — **Subcontractor** **Collect Payment**: certify → dispatch → **Stripe Terminal** (`job_collect_payment_flows`, field queue; **v2.344** replaces device Terminal with **hosted invoice** + webhook completion)](#latest-updates-v2339)
**New:** [v2.338 — **Dashboard**: team **Ready to Bill**; **Job Detail**: **Job Total** hidden for subcontractors; **Assigned Jobs** title → **Job Detail**](#latest-updates-v2338)
**New:** [v2.337 — **Job Detail**: section heading **Assigned Team** (read-only **`team_members`**)](#latest-updates-v2337)
**New:** [v2.336 — **Jobs** **Stages** **Accounts Receivable**: always clickable (role-only); modal targets ignore Stages search; **Edit Job** Mercury **Unlink and remove** + **Ref** abbrev + copy; **Memo (optional)** in AR modal](#latest-updates-v2336)
**New:** [v2.328 — **Jobs** **Stages** **Billed Awaiting Payment**: **Edit** immediately after **Open …** (same row); standalone invoice rows show **Open …** from billing line age](#latest-updates-v2328)
**New:** [v2.327 — **Documents** → **Jobs**: **billed** invoice rows under each job; **View bill** + **PipeTooling PDF** preview (`DocumentsJobBilledInvoiceModal`)](#latest-updates-v2327)
**New:** [v2.326 — **Physical invoice** Resend **subject**: **Click Plumbing Invoice [#…]** (`physicalInvoiceEmailSubject`)](#latest-updates-v2326)
**New:** [v2.325 — **Bill Customer** collapsible **Line on bill** / **Memo**; memo presets normalized like footer; **physical** email: bold **tagline**, no Service date or Issuer block in summary](#latest-updates-v2325)
**New:** [v2.315 — **My Time**: cross-row **Merge** on mixed punch/salary rows (affine partition save); salary-sync notice](#latest-updates-v2315)
**New:** [v2.314 — **Documents** (`/documents`): **Jobs** tab, **+** add Drive links, full-width search, tabs tight under nav](#latest-updates-v2314)
**New:** [v2.313 — **Stripe** invoice lines from **Specific Work**; Edit Job **(n/500)** counter; **Bill Customer** line-on-bill](#latest-updates-v2313)
**New:** [v2.312 — Jobs **Specific Work**: **Unit price** + **Description** per row (`jobs_ledger_fixtures`)](#latest-updates-v2312)
**New:** [v2.311 — Bids **Pricing** price book **New/Edit entry**: **decimal** dollars (`step` 0.01)](#latest-updates-v2311)
**New:** [v2.310 — Quickfill **Schedule** / **Office** / **Email** / **Texts** / **Physical** UX + **stale tally Assign** input fix](#latest-updates-v2310)
**New:** [v2.309 — Quickfill **Physical inbox** + Schedule Dispatch hub **Day** tab (`hubTab=day`, `day=`)](#latest-updates-v2309)
**New:** [v2.308 — Quickfill **Schedule**: hide assistants and estimators (`fetchUsersTabRosterForScheduleDispatchHub`)](#latest-updates-v2308)
**New:** [v2.307 — Quickfill **Schedule**: search by person or job (client-side filter)](#latest-updates-v2307)
**New:** [v2.306 — Quickfill **Schedule**: per-user read-only dispatch timeline + day nav](#latest-updates-v2306)
**New:** [v2.305 — **Sub Labor** modal: crew search, **Add Sub**, line items + action bar UX](#latest-updates-v2305)
**New:** [v2.304 — **Send Email invoice from Stripe?** modal: recent sends list (DB log)](#latest-updates-v2304)
**New:** [v2.303 — Jobs Stages **Last activity**: Stripe emailed customer + **Resend invoice email**](#latest-updates-v2303)
**New:** [v2.302 — Jobs Stages **Ready to Bill**: unallocated row amounts, draft/remainder labels, exposure total](#latest-updates-v2302)
**New:** [v2.301 — Partial **Ready to Bill**: primary remainder line + fixed partials; `ensure` + Jobs / Edit Job](#latest-updates-v2301)
**New:** [v2.299 — Public **Estimate accept**: same landing shell as Sign-In; wide card (`/estimate/accept`)](#latest-updates-v2299)
**New:** [v2.297 — People Hours: grid blur proportional scale into My Time (closed sessions); open session → live fetch](#latest-updates-v2297)
**New:** [v2.296 — Schedule Dispatch: Add schedule block occupied timeline + draft moves + batch save](#latest-updates-v2296)
**New:** [v2.295 — Schedule Dispatch hub: ++ multi-cell add, FAB, bulk blocks (08:00–12:00)](#latest-updates-v2295)
**New:** [v2.294 — Schedule Dispatch hub: People day cell triangle + → Add job to schedule (filled cell)](#latest-updates-v2294)
**New:** [v2.293 — Schedule Dispatch hub: empty People cell → Add job to schedule directly](#latest-updates-v2293)
**New:** [v2.292 — Clock In: On schedule (Dispatch) job rows; open-session work_date; dedupe + toast](#latest-updates-v2292)
**New:** [v2.291 — People Hours: manual cell blur → My Time draft session (no modal); NCNS off for that path](#latest-updates-v2291)
**New:** [v2.290 — People Feedback tab (dev): team feedback modals, Enabled DB persist, raw detail + CSV](#latest-updates-v2290)
**New:** [v2.289 — My Time: overlap split cards, Form UX + separators; Quickfill People Hours (new) mobile nav](#latest-updates-v2289)
**New:** [v2.288 — Estimates: accepted detail layout, thank-you + chick, terms/footer copy, activity dedupe](#latest-updates-v2288)
**New:** [v2.285 — Edit Job Billing: Outstanding billing + Payments received + Partial invoice UX; StripeInvoiceSharePanel toolbar](#latest-updates-v2285)
**New:** [v2.284 — Banking: Mercury/Stripe tabs + URL; Stripe invoice & webhook grids; Jobs Stages thread-stats perf](#latest-updates-v2284)
**New:** [v2.283 — Bill Customer: Stripe preview before create; global modal; Edit Job entry](#latest-updates-v2283)
**New:** [v2.282 — Bill Customer: Stripe invoice + share panel; webhook lifecycle](#latest-updates-v2282)
**New:** [v2.281 — Dashboard: copy day job mix (Mix); My Time preview from Clock (punch locked)](#latest-updates-v2281)
**New:** [v2.280 — Bids Rough takeoffs: catalog unit price, source row, reset / save to catalog](#latest-updates-v2280)
**New:** [v2.278 — Job Detail: Job Files/Plans when set; numbered Specific Work](#latest-updates-v2278)
**New:** [v2.277 — Job Detail: stacked Edit Job, materials accordions, Mercury Card column, Other job charges](#latest-updates-v2277)
**New:** [v2.276 — DetailJobModal: three dates, pipeline, 640px layout, notes chrome](#latest-updates-v2276)
**New:** [v2.273 — DetailJobModal: Scheduled block weekday in title](#latest-updates-v2273)
**New:** [v2.272 — DetailJobModal: Customer panel beside Address/schedule](#latest-updates-v2272)
**New:** [v2.271 — DetailJobModal: Address + schedule row responsive grid](#latest-updates-v2271)
**New:** [v2.270 — Schedule Dispatch hub: block title opens Detail Job modal](#latest-updates-v2270)
**New:** [v2.269 — Schedule Dispatch: + copy menu portal (no overflow clip)](#latest-updates-v2269)
**New:** [v2.268 — Schedule Dispatch: linked badge overlay without layout padding](#latest-updates-v2268)
**New:** [v2.267 — Schedule Dispatch: linked chain badge top-right (floating) + content padding](#latest-updates-v2267)
**New:** [v2.257 — Linked schedule blocks + Dispatch linked copy (`+`); Mercury splits RPC typing](#latest-updates-v2257)
**New:** [v2.256 — Schedule dispatch hub: all jobs + week counts (Scope B)](#latest-updates-v2256)
**New:** [v2.255 — Schedule dispatch: people × week grid + drag reassign](#latest-updates-v2255)
**New:** [v2.254 — Jobs Schedule modal + Calendar Job preview & planned chips](#latest-updates-v2254)
**New:** [v2.253 — Calendar: per-session chips + day modal clock sessions](#latest-updates-v2253)
**New:** [v2.252 — Pay History: Draft Payroll week + crew merge + employee credit + Record payment](#latest-updates-v2252)
**New:** [v2.333 — **Bank Payments** Kind badges: **`app_settings`** (`bank_payments_kind_badges_v1`); dev-only editor; local cache](#latest-updates-v2333)
**New:** [v2.332 — Dashboard **Unallocated bank deposits**; AR sorting **counterparty/note** excludes; **Bank Payments** allocation layout (amount row + footer **Add allocation**)](#latest-updates-v2332)
**New:** [v2.331 — **Bank Payments**: Mercury **Kind** badge label + color (`bank_payments_kind_badges_v1`)](#latest-updates-v2331)
**New:** [v2.330 — Pay History: **Generate Custom Pay Report** modal; Jobs **Bank payments** **Accounts Receivable Sorting** UI (nicknames); AR filter blob later moved to org-wide **`app_settings`** in **v2.334**](#latest-updates-v2330)
**New:** [v2.329 — Bids: **Cover Letter** Google Docs paste HTML; **Submission** URL deep link; note **datetime-local**](#latest-updates-v2329)
**New:** [v2.279 — Bids: Bid Preview from **B#**; Submission notes toolbar; **notify-dispatch-request** gateway JWT](#latest-updates-v2279)
**New:** [v2.251 — Jobs worked today: approve controls (Clocked in today parity)](#latest-updates-v2251)
**New:** [v2.250 — My Time: prior-week acknowledgment + two-week edit window](#latest-updates-v2250)
**New:** [v2.249 — Salary split sync: overlap guard (work_date + clock-in TZ date)](#latest-updates-v2249)
**New:** [v2.248 — Stale tally Assign: all jobs in search (dev / master / assistant)](#latest-updates-v2248)
**New:** [v2.247 — Stale tally Assign: staff-scoped job search (hybrid)](#latest-updates-v2247)
**New:** [v2.246 — Stale tally follow-up: assistants adopted masters job teams](#latest-updates-v2246)
**New:** [v2.245 — Stale tally follow-up: assistants see all targets](#latest-updates-v2245)
**New:** [v2.244 — Estimates customer activity audit + timeline IP](#latest-updates-v2244)
1. [Latest Updates (v2.239)](#latest-updates-v2239) — **Estimates**: **Unlink job** clears **`job_ledger_id`** (confirm **modal**); **sent** — **Copy customer link** / **Open customer link** under waiting message; [`EstimateCustomerAcceptLinkButtons.tsx`](src/components/estimates/EstimateCustomerAcceptLinkButtons.tsx); no duplicate link row in **Customer experience** when **`sent`**. [`Estimates.tsx`](src/pages/Estimates.tsx).
2. [Latest Updates (v2.238)](#latest-updates-v2238) — **Estimates → Jobs**: **`create_job_from_estimate`** RPC; **Create job from estimate** modal; **Jobs** **Source estimate** + **View contract & acceptance** ([`CustomerAcceptanceRecordModal`](src/components/estimates/CustomerAcceptanceRecordModal.tsx)).
3. [Latest Updates (v2.237)](#latest-updates-v2237) — **Estimates**: **Approve** modal layout (**`accept_instructions`** hidden; centered **Submit acceptance**); **Total** right-aligned on quote document; staff detail **`# n` + title** one **`h1`** line; inline **Customer acceptance** shows signature disclosure + checked disabled agreement before **Full name**.
4. [Latest Updates (v2.236)](#latest-updates-v2236) — **Estimates**: **Line item catalog** modal — **Insert from catalog** and **Edit book** in one header row between the title and **×** (close uses **`marginLeft: 'auto'`**); [`Estimates.tsx`](src/pages/Estimates.tsx).
5. [Latest Updates (v2.233)](#latest-updates-v2233) — **Estimates**: global **Quote #** ([`20260405003103_estimates_global_estimate_number.sql`](supabase/migrations/20260405003103_estimates_global_estimate_number.sql)); staff **`/estimates/{estimate_number}`** (UUID legacy **`replace`**); **Customer experience** tab (**Email** / **Acceptance** / **Thank you**); [`estimateCustomerEmail.ts`](src/lib/estimateCustomerEmail.ts) + [`EstimateCustomerDocument.tsx`](src/components/estimates/EstimateCustomerDocument.tsx) / [`EstimateCustomerThankYou.tsx`](src/components/estimates/EstimateCustomerThankYou.tsx); **`accept_url`** after send when returned.
6. [Latest Updates (v2.232)](#latest-updates-v2232) — **Estimates (Approach A)**: `public.estimates`, Edge **get/accept/send**, [`Estimates.tsx`](src/pages/Estimates.tsx) + [`EstimateAccept.tsx`](src/pages/EstimateAccept.tsx), routing + docs ([`20260404212052_estimates_approach_a.sql`](supabase/migrations/20260404212052_estimates_approach_a.sql)).
7. [Latest Updates (v2.231)](#latest-updates-v2231) — **Jobs worked today** duration → **Edit time**; **Overlap** badges + My Time **Overlapping clock times** / **Multiple jobs/bids in this span**; impersonation **Back** ([`Layout.tsx`](src/components/Layout.tsx)) vs **Back to my Account** ([`Settings.tsx`](src/pages/Settings.tsx)); [`hasPairwiseClockIntervalOverlap`](src/lib/myTimeDayTimeline.ts).
8. [Latest Updates (v2.226)](#latest-updates-v2226) — **Dashboard** **Job Parts Tally** icon: amber **unlinked** count badge when the caller has linked-card Mercury transactions with no **`mercury_transaction_job_allocations`** (matches **Show unlinked** on Job Tally); RPC **`count_unlinked_mercury_transactions_for_tally`** ([`20260403044517_count_unlinked_mercury_transactions_for_tally.sql`](supabase/migrations/20260403044517_count_unlinked_mercury_transactions_for_tally.sql)); **`window` `focus`** refresh; accessible **`title`** / **`aria-label`** on the tally link ([`Dashboard.tsx`](src/pages/Dashboard.tsx)).
9. [Latest Updates (v2.225)](#latest-updates-v2225) — **Job Parts Tally** **Transactions**: client-side **search** ([`tallyTransactionSearch.ts`](src/lib/tallyTransactionSearch.ts)); **Mercury note** icon toggle ([`MercuryTransactionNoteIcon.tsx`](src/components/icons/MercuryTransactionNoteIcon.tsx)); **`parseTallyJobSplitsJson`** ([`tallyJobSplits.ts`](src/lib/tallyJobSplits.ts)) + [`TallyJobTransactionsModal.tsx`](src/components/tally/TallyJobTransactionsModal.tsx); search UI above **Posted** / **Amount** / **Counterparty**; **Escape** closes an expanded note. [`JobTally.tsx`](src/pages/JobTally.tsx).
10. [Latest Updates (v2.224)](#latest-updates-v2224) — **Quickfill** UX: **`QuickfillSectionWrapper`** left **`h2`** titles (**`1.5rem` / 700**, same weight as Banking **h1**); **`firstVisibleSectionId`** + **`withTopDivider`** (**`2px`** **`#94a3b8`**) between blocks; **People Hours (Old)** wrapper label; duplicate titles dropped (**[`BankingSortingSnapshotSection`](src/components/quickfill/BankingSortingSnapshotSection.tsx)**, **[`HoursSection`](src/components/quickfill/HoursSection.tsx)**, **[`BilledAwaitingPaymentSection`](src/components/quickfill/BilledAwaitingPaymentSection.tsx)**; **[`CrewJobsSection`](src/components/quickfill/CrewJobsSection.tsx)** / **[`SupplyHousesSection`](src/components/quickfill/SupplyHousesSection.tsx)** **`showTitle={false}`**). **Banking sorting** snapshot: **Link…** in **Person** / **Jobs** cells when missing (no Link column); **safety yellow** buttons. **People Hours (new)**: amber notice *Assistance only makes sure hours are correct…* under day nav ([`QuickfillPeopleHoursNewSection.tsx`](src/components/quickfill/QuickfillPeopleHoursNewSection.tsx)). **Jobs Billing** reminder: **Min HCP** filter + **`JobsBillingReminderSection`** **`minHcpNumber`**. [`Quickfill.tsx`](src/pages/Quickfill.tsx).
11. [Latest Updates (v2.223)](#latest-updates-v2223) — **Crew Jobs / Bids** live refresh: Supabase **`postgres_changes`** on **`people_crew_jobs`** / **`people_crew_bids`** (filter by selected **`work_date`**) + Team Job Labor reload in **`CrewJobsBlock`**; migration **`20260402120000_clock_sessions_sync_crew_assignments_trigger.sql`** adds **`clock_sessions_sync_crew_assignments_tr`** (resync from **`sync_crew_*_from_clock`** when **`job_ledger_id`** / **`bid_id`** changes on approved sessions) and **`supabase_realtime`** publication entries for crew tables if missing ([`CrewJobsBlock.tsx`](src/components/CrewJobsBlock.tsx)).
12. [Latest Updates (v2.222)](#latest-updates-v2222) — **Quickfill** **Banking sorting** snapshot: parallel **`Promise.all`** (**`fetchMercuryRelationsState`** + **`fetchMercuryNicknameMaps`**); summary line **Total available** (transactions matching sorting filters); [`BankingSortingSnapshotSection.tsx`](src/components/quickfill/BankingSortingSnapshotSection.tsx)
13. [Latest Updates (v2.221)](#latest-updates-v2221) — **Banking** **Mercury** **Link to jobs**: auto **equal %** on **add/remove** ([`MercuryTransactionAllocationsModal.tsx`](src/components/MercuryTransactionAllocationsModal.tsx) **`redistributeEqualSplit`**); existing saved splits still load from DB unchanged.
14. [Latest Updates (v2.220)](#latest-updates-v2220) — **Jobs** **Parts**: **`mercuryCardChargesByJobId`** uses **`Math.abs`** per allocation ([`Jobs.tsx`](src/pages/Jobs.tsx)).
15. [Latest Updates (v2.219)](#latest-updates-v2219) — **Banking** **Link to jobs & person**: positive **charge** UI; **$** / **%**; **`note`** on allocations ([`20260402003356_mercury_job_allocation_note.sql`](supabase/migrations/20260402003356_mercury_job_allocation_note.sql)); [`MercuryTransactionAllocationsModal.tsx`](src/components/MercuryTransactionAllocationsModal.tsx), [`Banking.tsx`](src/pages/Banking.tsx).
16. [Latest Updates (v2.218)](#latest-updates-v2218) — **Banking** Mercury **Person**: optional **`user_id`** on **`mercury_transaction_attributions`**; **`list_users_for_banking_attribution`**, **`replace_mercury_transaction_splits`** **`p_user_id`** ([`20260402001226_mercury_attribution_user_id.sql`](supabase/migrations/20260402001226_mercury_attribution_user_id.sql)); [`Banking.tsx`](src/pages/Banking.tsx), [`MercuryTransactionAllocationsModal.tsx`](src/components/MercuryTransactionAllocationsModal.tsx).
17. [Latest Updates (v2.217)](#latest-updates-v2217) — **Banking**: sort **Posted** / **Account** / **Mercury ID**; **`mercury_account_nicknames`** ([`20260401195701_mercury_account_nicknames.sql`](supabase/migrations/20260401195701_mercury_account_nicknames.sql)); filter labels + **Account nicknames** editor ([`Banking.tsx`](src/pages/Banking.tsx))
18. [Latest Updates (v2.216)](#latest-updates-v2216) — **Auth** **`AuthProvider`** + **`useAuth`**; **Bids** workflow tabs **`B{num}`** + **`bidDisplayName`**; **My Time** **`can_edit_clock_sessions_for_user`** for **master / assistant / superintendent** ([**`20260401190823`**](supabase/migrations/20260401190823_can_edit_clock_sessions_option_a_roles.sql)); **merge up/down** reducer fix ([`myTimeDayTimeline.ts`](src/lib/myTimeDayTimeline.ts))
19. [Latest Updates (v2.215)](#latest-updates-v2215) - **Banking** (dev-only): **`mercury_transactions`** ledger; **`sync-mercury-transactions`** + **`mercury-webhook`**; nav between **Jobs** and **Materials** ([`Banking.tsx`](src/pages/Banking.tsx), [`EDGE_FUNCTIONS.md`](EDGE_FUNCTIONS.md))
20. [Latest Updates (v2.214)](#latest-updates-v2214) - **Layout** header shared **height** (dispatch icons + **Bid**); **Dashboard** strip **Assign** **optimistic** job/bid + **`Promise.all`** in **`loadPending`**; **Calendar** bottom chips **centered** ([`Layout.tsx`](src/components/Layout.tsx), [`AssignSessionJobPopover.tsx`](src/components/clock-sessions/AssignSessionJobPopover.tsx), [`useDashboardMyTeamSectionState.ts`](src/hooks/useDashboardMyTeamSectionState.ts), [`DashboardTeamActiveClockStrip.tsx`](src/components/DashboardTeamActiveClockStrip.tsx), [`Calendar.tsx`](src/pages/Calendar.tsx))
21. [Latest Updates (v2.207)](#latest-updates-v2207) - People **Salaried workdays** bulk modal: **Bulk unpaid time off** (`pay_staff_bulk_insert_user_time_off`, [`payStaffBulkTimeOff.ts`](src/lib/payStaffBulkTimeOff.ts)); [`SalariedWorkdaysBulkModal.tsx`](src/components/people/SalariedWorkdaysBulkModal.tsx), [`People.tsx`](src/pages/People.tsx), [`20270331192000_pay_staff_bulk_insert_user_time_off.sql`](supabase/migrations/20270331192000_pay_staff_bulk_insert_user_time_off.sql)
22. [Latest Updates (v2.206)](#latest-updates-v2206) - **Salaried workday** collapsible in Settings; **`people_pay_config`** self-read SELECT RLS; Dashboard **Currently In** corner toggles: removed **`stripScopeOverlay`** wrapper; [`Settings.tsx`](src/pages/Settings.tsx), [`20270331160000_users_read_own_people_pay_config.sql`](supabase/migrations/20270331160000_users_read_own_people_pay_config.sql), [`DashboardTeamActiveClockStrip.tsx`](src/components/DashboardTeamActiveClockStrip.tsx)
23. [Latest Updates (v2.203)](#latest-updates-v2203) - Dashboard **Jobs worked today**: two-column table; **job link** + inline **`[ hours • people ]`** on line 1, **address** line 2; [`DashboardTeamActiveClockStrip.tsx`](src/components/DashboardTeamActiveClockStrip.tsx)
24. [Latest Updates (v2.202)](#latest-updates-v2202) - Dashboard **Jobs worked today**: strip subsection by **`job_ledger_id`**; total hours + people; **`jobsWorkedTodayStripRows`**; [`DashboardTeamActiveClockStrip.tsx`](src/components/DashboardTeamActiveClockStrip.tsx), [`useDashboardMyTeamSectionState.ts`](src/hooks/useDashboardMyTeamSectionState.ts)
25. [Latest Updates (v2.200)](#latest-updates-v2200) - Dashboard **Clocked in today**: **optimistic** approved checkmark after successful **`approve_clock_sessions`** (before **`loadPending`**); [`DashboardTeamActiveClockStrip.tsx`](src/components/DashboardTeamActiveClockStrip.tsx)
26. [Latest Updates (v2.199)](#latest-updates-v2199) - **Session actions** modal: **Current assignment** line, **Open job** / **Open bid**, **Change assignment** + collapsed search, **Clear assignment**; [`ClockSessionStripActionsModal.tsx`](src/components/ClockSessionStripActionsModal.tsx), [`DashboardTeamActiveClockStrip.tsx`](src/components/DashboardTeamActiveClockStrip.tsx)
27. [Latest Updates (v2.198)](#latest-updates-v2198) - Dashboard **Clocked in today**: **Session actions** modal (**long-press** / **Shift+click** / SR) — **Approve**, **Reject…** (then confirm), **Edit** memo + job/bid, **Revoke approval**; [`ClockSessionStripActionsModal.tsx`](src/components/ClockSessionStripActionsModal.tsx), [`ClockSessionStripApproveControl.tsx`](src/components/ClockSessionStripApproveControl.tsx), [`DashboardTeamActiveClockStrip.tsx`](src/components/DashboardTeamActiveClockStrip.tsx)
28. [Latest Updates (v2.197)](#latest-updates-v2197) - Dashboard **Clocked in today**: per-session **approve** (click) + **reject** (long-press or **Shift+click**, then **in-app confirm modal**); [`ClockSessionStripApproveControl.tsx`](src/components/ClockSessionStripApproveControl.tsx), [`DashboardTeamActiveClockStrip.tsx`](src/components/DashboardTeamActiveClockStrip.tsx)
29. [Latest Updates (v2.196)](#latest-updates-v2196) - Dashboard **Clocked in today**: **Show all** vs **Show missing** (sessions with no job and no bid); [`DashboardTeamActiveClockStrip.tsx`](src/components/DashboardTeamActiveClockStrip.tsx)
30. [Latest Updates (v2.195)](#latest-updates-v2195) - Dashboard **Currently clocked in** strip: **Clocked in today** unified **thead** row + collapse (`dashboard_clock_strip_clocked_in_today_collapsed`)
31. [Latest Updates (v2.194)](#latest-updates-v2194) - **My Time** Visual: **split boundary** drag **ends on release over handle** (removed `pointerup` `stopPropagation`); **slimmer** handle + **`grabbing`** via `body.my-time-boundary-dragging`; coarse-pointer sizing ([`index.css`](src/index.css) `.myTimeBoundaryHandle`)
32. [Latest Updates (v2.193)](#latest-updates-v2193) - **My Time**: merge **job-choice modal** when allocations differ (`MyTimeMergeSegmentsModal`, `segmentJobOverrides`, `setSegmentJobOverride`, `mergeAllocChoiceRequired`)
33. [Latest Updates (v2.192)](#latest-updates-v2192) - Dashboard **My Time** / **Edit time**: **Merge up** / **Merge down** (remove a segment by merging with neighbor; notes + optional job/bid confirm); [`splitReducer`](src/lib/myTimeDayTimeline.ts) `removeSegmentMergeWithPrev` / `removeSegmentMergeWithNext`
34. [Latest Updates (v2.191)](#latest-updates-v2191) - **Hard Reload** / force reload: document loads **`/`** then restores route (`hardReload.ts`, `index.html`); **Clock In**: single “no assigned jobs” info toast (`ToastContext`, `ClockInOutButton`)
35. [Latest Updates (v2.186)](#latest-updates-v2186) - Settings **Templates & testing** (dev): collapsible **Workflow email (Edge Function)** one-shot test invoking `send-workflow-notification` (DB template + Resend; no `notification_history`); [`supabase/config.toml`](supabase/config.toml) `verify_jwt = false` for `test-email` and `send-workflow-notification`
36. [Latest Updates (v2.185)](#latest-updates-v2185) - Jobs **Stages** **Last activity** column (latest thread note preview, Central Time); remove `jobs_ledger.stage_notes`; [`jobs_ledger_thread_note_stats`](supabase/migrations/20260330023918_extend_thread_note_stats_drop_stage_notes.sql) `last_note_body` / `last_note_author_name`
37. [Latest Updates (v2.184)](#latest-updates-v2184) - Job thread notes: **Enter** submits note; **Shift+Enter** new line ([`JobThreadNotesPanel`](src/components/JobThreadNotesPanel.tsx))
38. [Latest Updates (v2.183)](#latest-updates-v2183) - Jobs **Stages** + **Workflow** linked jobs: **thread notes** column (`jobs_ledger_thread_notes`, Dispatch-style panel); `jobs_ledger_thread_note_stats`; [`useJobThreadNotes`](src/hooks/useJobThreadNotes.ts)
39. [Latest Updates (v2.182)](#latest-updates-v2182) - Dashboard **Clock In** / **Update Focus**: assigned jobs **auto-load** (`list_assigned_jobs_for_dashboard`); no **Choose from my jobs** control; **Filtering by** line hidden when a single service type; stronger notes/search **borders** and **focus** styles
40. [Latest Updates (v2.181)](#latest-updates-v2181) - Jobs **Edit Job** billing: **comma** thousands on Job Total and payment amounts; Workflow **line items** optional **item_date** + **clipboard** bulk import (Add mode)
41. [Latest Updates (v2.180)](#latest-updates-v2180) - Bids **New/Edit** modal: **SearchableSelect**, layout + mobile grid, Distance + Plan Pages row; estimator **Bid** header
42. [Latest Updates (v2.179)](#latest-updates-v2179) - Dashboard **My Time** / **Edit time** (this-week-only editor, Form/Visual defaults, timeline UX)
43. [Latest Updates (v2.178)](#latest-updates-v2178) - People **Primary** / **Superintendent** on `people` roster + Pay/Hours (`20260329042321`)
44. [Latest Updates (v2.177)](#latest-updates-v2177) - People **Housing** tab + pay report **Housing** block (`20270329180000`)
45. [Latest Updates (v2.176)](#latest-updates-v2176) - People Pay History: Ledger **open count** + **total remaining** (filtered rows)
46. [Latest Updates (v2.175)](#latest-updates-v2175) - People Pay History: **Draft Payroll** (renamed from Run Payroll); bulk modal copy only
47. [Latest Updates (v2.172)](#latest-updates-v2172) - Pay History: partial payments (`pay_stub_payments`), ledger balance, Run Payroll Partial
48. [Latest Updates (v2.171)](#latest-updates-v2171) - People Hours: audit modal edit, job highlight on grid, shared clock edit modal
49. [Latest Updates (v2.170)](#latest-updates-v2170) - People Pay History: ledger search, actions UX, bulk modal layout
50. [Latest Updates (v2.164)](#latest-updates-v2164) - Settings (dev): Ignored task types list under Dashboard & alerts
51. [Latest Updates (v2.163)](#latest-updates-v2163) - Dashboard clock strip; supply house website in expanded row
52. [Latest Updates (v2.162)](#latest-updates-v2162) - Team feedback: dev eligibility reset, submissions RLS, raw submission names
53. [Latest Updates (v2.153)](#latest-updates-v2153) - Dashboard My Team layout; pending banner jump UX
54. [Latest Updates (v2.152)](#latest-updates-v2152) - My Team: People you lead hours table (Pending/Approved/Total)
55. [Latest Updates (v2.151)](#latest-updates-v2151) - My Team clock notify + ledger; Edge Function
56. [Latest Updates (v2.150)](#latest-updates-v2150) - Dashboard My Team: People you lead roster
57. [Latest Updates (v2.149)](#latest-updates-v2149) - Clock sessions UX; daily goals gate; goals tables
58. [Latest Updates (v2.148)](#latest-updates-v2148) - Bid Board All notes; customer notes UX; contact_method
59. [Latest Updates (v2.145)](#latest-updates-v2145) - Master tech mobile nav Quickfill and Review in hamburger
60. [Latest Updates (v2.144)](#latest-updates-v2144) - Assistant billing sections at top of Dashboard
61. [Latest Updates (v2.143)](#latest-updates-v2143) - Assistant Dashboard section reorder
62. [Latest Updates (v2.142)](#latest-updates-v2142) - Dashboard Assigned Jobs and Superintendent Jobs UX
63. [Latest Updates (v2.139)](#latest-updates-v2139) - Fix cost_estimates RLS for assistants
64. [Latest Updates (v2.138)](#latest-updates-v2138) - Revoke superintendent Jobs Billing access
65. [Latest Updates (v2.135)](#latest-updates-v2135) - Workflow: Collapse old stages toggle, breadcrumb below buttons, no-wrap scroll
66. [Latest Updates (v2.126)](#latest-updates-v2126) - Split clock session in Edit modal
67. [Latest Updates (v2.121)](#latest-updates-v2121) - Stages ClickTooling icon, Billing UX refactor, Report count styling
68. [Latest Updates (v2.97)](#latest-updates-v297) - Bids Counts: Save & Add, Cancel styling; Bids Pricing: Price book centered
69. [Latest Updates (v2.94)](#latest-updates-v294) - Bid Board Counts icon, Cover Letter inclusions fix, Apply buttons hidden when synced
70. [Latest Updates (v2.93)](#latest-updates-v293) - Primaries full Bids access (all tabs, create/edit/delete)
71. [Latest Updates (v2.88)](#latest-updates-v288) - People Review: Total Labor fix, Rest of Teams Labor, Sub Labor label, User on Job Rev/hr Profit/hr
72. [Latest Updates (v2.86)](#latest-updates-v286) - People Review: Profit labels, Formula B, sub labor fix; Crew Jobs Hours
73. [Latest Updates (v2.85)](#latest-updates-v285) - People Review: Team Summary, Only Count Paid in Full, exclude labor
74. [Latest Updates (v2.84)](#latest-updates-v284) - Team Summary removed, Jobs tab order, Review Profit, SECURITY DEFINER RPCs
75. [Latest Updates (v2.83)](#latest-updates-v283) - Sync to Testing script, Archive/Restore user flow
76. [Latest Updates (v2.82)](#latest-updates-v282) - Person/User duplicate merge, Pay tab detection, cascade pay_stubs
77. [Latest Updates (v2.81)](#latest-updates-v281) - Bids Counts Import from /Tooling, Pricing partial-fill, Inspections, Reports
78. [Latest Updates (v2.80)](#latest-updates-v280) - Prospects Address field, Follow Up quick notes
79. [Latest Updates (v2.79)](#latest-updates-v279) - Quickfill feedback loop, section nav, Prospects Team tab, label updates
80. [Latest Updates (v2.78)](#latest-updates-v278) - AR removed, Billed Awaiting Payment, Quickfill Billed section, Total by Name modal
81. [Latest Updates (v2.77)](#latest-updates-v277) - Settings Data backup top, Maintenance minimizable, Fixture type badges, Bids Counts Import
82. [Latest Updates (v2.76)](#latest-updates-v276) - Prospects copy templates, mail icon, subject line, email sent tracking; Settings My Profile
83. [Latest Updates (v2.75)](#latest-updates-v275) - Jobs default tab, tab labels, Prospects Option D
84. [Latest Updates (v2.74)](#latest-updates-v274) - Create Partial Invoice modal, Ready to Bill, Paid in Full
85. [Latest Updates (v2.73)](#latest-updates-v273) - Checkbox modals, unified stages, invoice buttons
86. [Latest Updates (v2.72)](#latest-updates-v272) - Whole Jobs Through Stages
87. [Latest Updates (v2.71)](#latest-updates-v271) - Partial Invoices (Option A)
88. [Latest Updates (v2.70)](#latest-updates-v270) - Payments Made, Remaining, Stages enhancements
89. [Latest Updates (v2.69)](#latest-updates-v269) - Prospects timer enhancements, my time modal, Prospect List time
90. [Latest Updates (v2.68)](#latest-updates-v268) - Primary Bids RFI/Change Order/Lien Release, Projects hidden
91. [Latest Updates (v2.67)](#latest-updates-v267) - Team Costs, Crew Jobs in Quickfill, Fixture Send to Office, Show my jobs only
92. [Latest Updates (v2.66)](#latest-updates-v266) - RFI tab, Bids submitted_to, placeholder updates
93. [Latest Updates (v2.65)](#latest-updates-v265) - Job Bill Details actions, Jobs/Dashboard button labels, Edit Parts
94. [Latest Updates (v2.64)](#latest-updates-v264) - Dashboard layout, Jobs/Prospects/Bids/People, RLS
95. [Latest Updates (v2.63)](#latest-updates-v263) - Jobs Labor Distance inline edit
96. [Latest Updates (v2.62)](#latest-updates-v262) - Prospects enhancements
97. [Latest Updates (v2.61)](#latest-updates-v261) - User notes on People page, Add button styling
98. [Latest Updates (v2.59)](#latest-updates-v259) - Workflow collapsible sections, notify defaults, line items total
99. [Latest Updates (v2.58)](#latest-updates-v258) - Subcontractor Job Tally Submit for Review RLS fix
100. [Latest Updates (v2.57)](#latest-updates-v257) - Dashboard reports modal, icons, hide, delete dev-only; Settings save confirmation; ToastContext
101. [Latest Updates (v2.56)](#latest-updates-v256) - Job Tally quantity, Materials abbreviations, Primary role
102. [Latest Updates (v2.55)](#latest-updates-v255) - Dashboard and Jobs UI label updates
103. [Latest Updates (v2.54)](#latest-updates-v254) - Quickfill page, nav icon, section order
104. [Latest Updates (v2.53)](#latest-updates-v253) - Supply Houses & External Subs, Jobs Receivables, Dashboard pins
105. [Latest Updates (v2.52)](#latest-updates-v252) - People Pay layout, Cost matrix mobile, Builder Review PIA
106. [Latest Updates (v2.51)](#latest-updates-v251) - Fix app, Cost matrix pins, Builder Review, People Pay
107. [Latest Updates (v2.50)](#latest-updates-v250) - Jobs tab order, Labor user lists, HCP row alignment
108. [Latest Updates (v2.49)](#latest-updates-v249) - Labor and Sub Sheet Ledger moved to Jobs
109. [Latest Updates (v2.48)](#latest-updates-v248) - Checklist FWD, Estimator Dashboard, iOS Safe Area
110. [Latest Updates (v2.47)](#latest-updates-v247) - Hours Update Pay Sync (Realtime)
111. [Latest Updates (v2.46)](#latest-updates-v246) - Supabase Disk IO Optimizations
112. [Latest Updates (v2.45)](#latest-updates-v245) - Impersonation Fix, Teams Compact, Yesterday Label
113. [Latest Updates (v2.44)](#latest-updates-v244) - Share Cost Matrix and Teams, Green Dot, Cost Matrix Nav
114. [Latest Updates (v2.43)](#latest-updates-v243) - Navigation, Settings, Global Reload
115. [Latest Updates (v2.42)](#latest-updates-v242) - Checklist, Dashboard, Settings, PipeTooling
116. [Latest Updates (v2.41)](#latest-updates-v241) - People Pay/Hours Tabs, Cost Matrix, Hours Totals
117. [Latest Updates (v2.40)](#latest-updates-v240) - People Labor/Ledger, Master Shares, Edit Button
118. [Latest Updates (v2.39)](#latest-updates-v239) - Takeoff Print Breakdown
119. [Latest Updates (v2.38)](#latest-updates-v238) - Estimator Cost Parameters, Price Book Closed by Default
120. [Latest Updates (v2.37)](#latest-updates-v237) - Add Missing Fixtures, Driving in Pricing, Cover Letter, Price Book Default
121. [Latest Updates (v2.36)](#latest-updates-v236) - Assembly Types & Assembly Book
122. [Latest Updates (v2.35)](#latest-updates-v235) - Service-Type-Specific Books, Assistant Access
123. [Latest Updates (v2.34)](#latest-updates-v234) - Duplicates Page, Materials Filters, Part Type Category Removal
124. [Latest Updates (v2.33)](#latest-updates-v233) - Labor Step, Delete in Modals, Template→Assembly, Bid Board
125. [Latest Updates (v2.32)](#latest-updates-v232) - Settings Renames, Materials Load All, Cost Estimate Distance
126. [Latest Updates (v2.31)](#latest-updates-v231) - Pricing Takeoff-Based Cost, Counts Quick-adds, Settings Improvements
127. [Latest Updates (v2.30)](#latest-updates-v230) - Estimator Service Type Filtering
128. [Latest Updates (v2.29)](#latest-updates-v229) - Price/Labor Book Enhancements, Fixed Price Feature
129. [Latest Updates (v2.28)](#latest-updates-v228) - Part Types vs Fixture Types Separation
130. [Latest Updates (v2.27)](#latest-updates-v227) - Service Type System
131. [Latest Updates (v2.26)](#latest-updates-v226)
132. [Latest Updates (v2.25)](#latest-updates-v225)
133. [Latest Updates (v2.24)](#latest-updates-v224)
134. [Latest Updates (v2.23)](#latest-updates-v223)
135. [Latest Updates (v2.22)](#latest-updates-v222)
136. [Latest Updates (v2.21)](#latest-updates-v221)
137. [Latest Updates (v2.20)](#latest-updates-v220)
138. [Latest Updates (v2.19)](#latest-updates-v219)
139. [Latest Updates (v2.18)](#latest-updates-v218)
140. [Latest Updates (v2.17)](#latest-updates-v217)
141. [Latest Updates (v2.16)](#latest-updates-v216)
142. [Latest Updates (v2.15)](#latest-updates-v215)
143. [Latest Updates (v2.14)](#latest-updates-v214)
144. [Latest Updates (v2.13)](#latest-updates-v213)
145. [Latest Updates (v2.12)](#latest-updates-v212)
146. [Latest Updates (v2.11)](#latest-updates-v211)
147. [Latest Updates (v2.10)](#latest-updates-v210)
148. [Latest Updates (v2.9)](#latest-updates-v29)
149. [Latest Updates (v2.8)](#latest-updates-v28)
150. [Latest Updates (v2.7)](#latest-updates-v27)
151. [Latest Updates (v2.6)](#latest-updates-v26)
150. [Workflow Features](#workflow-features)
151. [Calendar Updates](#calendar-updates)
152. [Access Control](#access-control)
153. [Email Templates](#email-templates)
154. [Financial Tracking](#financial-tracking)
155. [Customer and Project Management](#customer-and-project-management)
---

## Latest Updates (v2.369)

**Date**: 2026-04-22

### **Bids** — **Unsent/Working** board, **Clock In** quick picks, labels, tab layout

- **DB** — [`20260422001732_bid_working_board_working_column.sql`](supabase/migrations/20260422001732_bid_working_board_working_column.sql): **`bid_working_board_columns.system_key`** may be **`working`**; backfill inserts **Working** at position **1** between **Inbox** and **Ready** (safe position bump + renumber). See **`MIGRATIONS.md`**.
- **Kanban** — [`BidsWorkingBoard.tsx`](src/components/bids/BidsWorkingBoard.tsx): bootstrap **Inbox (0)**, **Working (1)**, **Ready for Submission (2)**; **Working** column shows muted hint **shows on clock** (tooltip explains Clock In quick picks).
- **Clock In** — [`fetchWorkingBoardClockBidPicks.ts`](src/lib/fetchWorkingBoardClockBidPicks.ts) + [`ClockInOutButton.tsx`](src/components/ClockInOutButton.tsx): bids placed in the user’s **Working** column load as green quick-pick buttons **after** Dispatch schedule jobs (also **Update Focus** / **clock-out review** modals); **“no quick picks…”** toast counts Working bids.
- **Bid Board** — First collapsible section label **Unsent / Working Bids** (**`BID_BOARD_UNSENT_SECTION_LABEL`** in [`Bids.tsx`](src/pages/Bids.tsx)); same label on **Submission & Followup** and dev **Bid Costs** unsent section.
- **Tabs** — Bids **Working** tab button text **`Unsent/Working`** (**`BIDS_WORKING_TAB_LABEL`**); inbox count badge offset adjusted (**`top`/`right`**). Center tab strip: **Counts … Cover Letter** **|** **Submission & Followup** **|** **RFI …** (superintendent: still **Cost Estimate | RFI** with one separator).

---

## Latest Updates (v2.368)

**Date**: 2026-04-21

### **People / public signing** — **`/contract/accept`** thank-you and signing page polish

- **Signing view** — [`ContractAccept.tsx`](src/pages/ContractAccept.tsx): document **title**, optional **Open full document** / scrollable signing body, and [`ContractAcceptSignatureForm`](src/components/contracts/ContractAcceptSignatureForm.tsx). The **For:** **`person_name`** line is **not** shown ( **`person_name`** remains on **`person_contract_documents`** for staff in **People** and in Resend email context).
- **Thank-you** — Reuses [`EstimateCustomerThankYou`](src/components/estimates/EstimateCustomerThankYou.tsx): **`footerImageSrc`** **`public/pup.jpg`** on this page only (estimate accept still uses **`chick.png`** via default). **Body** paragraph omitted (**title-only** “Thank you”); [`EstimateCustomerThankYou`](src/components/estimates/EstimateCustomerThankYou.tsx) skips the **body** `<p>` when **`body`** trims empty so other callers are unchanged.
- **Post-sign CTA** — [`useAuth`](src/hooks/useAuth.ts) + **`list_my_contract_dashboard_prompts`** ([`20260420234856_person_contract_documents_dashboard_prompt_after_clock_in.sql`](supabase/migrations/20260420234856_person_contract_documents_dashboard_prompt_after_clock_in.sql)): while resolving, **Checking for more contracts…**; if signed in and RPC returns rows, primary link **Go to dashboard** → **`/dashboard`**; if signed in and none, **Return to PipeTooling** → **`/dashboard`**; if logged out, **Sign in** → **`/sign-in`**. **`get-contract-for-signer`** **409** **`already_signed`** thank-you strings from the Edge response are not applied to this UI (same title-only treatment).

---

## Latest Updates (v2.367)

**Date**: 2026-04-22

### **Dashboard** — **Jobs worked today** includes **unassigned** time (**no job**, **no bid**)

- **Hook** — [`useDashboardMyTeamSectionState.ts`](src/hooks/useDashboardMyTeamSectionState.ts): **`jobsWorkedTodayStripRows`** collects sessions where **`!job_ledger_id && !bid_id`** (same **`rejected_at`** / **`revoked_at`** filters as job rows), sorts by **`clocked_in_at`**, and **`unshift`**s one **[`JobsWorkedTodayStripRow`](src/hooks/useDashboardMyTeamSectionState.ts)** **first** with **`jobLedgerId: JOBS_WORKED_TODAY_UNASSIGNED_ID`** (**`'__no_job_or_bid__'`**), **`label`** **No job or bid**, **`addressLine: null`**, plus **`totalSeconds`** / **`distinctPeopleCount`**. Real job rows remain sorted alphabetically by **`label`** after that. **Bid-only** sessions (no job, bid set) are still omitted here (same as before).
- **Strip** — [`DashboardTeamActiveClockStrip.tsx`](src/components/DashboardTeamActiveClockStrip.tsx): that row renders a **muted** **`span`** instead of a **`Link`** to **`/jobs?edit=…`** (no “open job” **`aria-label`**). Expand/collapse still keys off **`job.jobLedgerId`** (sentinel works like a stable id).
- **Why** — On **split salary** days, the **first** segment can be **unassigned** while a **second** segment is job-linked; **Clocked in today** already listed both—**Jobs worked today** previously only grouped by **`job_ledger_id`**, so the unassigned block was invisible in that subsection.

---

## Latest Updates (v2.366)

**Date**: 2026-04-22

### **Bill Customer** — Job and invoice move together (all billing channels)

- **Client** — [`promoteJobToBilledIfFullyInvoiced.ts`](src/lib/promoteJobToBilledIfFullyInvoiced.ts): **`maybePromoteJobToBilledAfterCustomerInvoice(jobId)`** runs after a bill is successfully recorded from **`SendRecordInvoiceModal`** on **Stripe bill** (**`create-stripe-invoice`**), **HouseCall Pro** (**`confirmOutsideBill`**), and **Physical invoice** (**`send-physical-invoice-email`**). It refetches the job and, when there are no **`ready_to_bill`** **`jobs_ledger_invoices`** rows and **`jobBillingUnallocatedDollars`** ([`jobsStagesBoard.ts`](src/lib/jobsStagesBoard.ts)) is within **±$0.005** of zero (same “fully allocated” notion as Stages), calls **`update_job_status`** to set **`jobs_ledger.status`** to **billed**, chaining **working** → **ready_to_bill** first when **`update_job_status`** requires it. If promotion fails, the modal shows the error on the tab that just succeeded (**Stripe** / **outside** / **Physical**).
- **Edge** — [`send-physical-invoice-email`](supabase/functions/send-physical-invoice-email/index.ts): removed **`billing_kind`** and **`update_job_status`** from this path so **Physical** does not double-promote or diverge from **Stripe**/**HCP**; job promotion is owned by the shared client helper above.
- **Docs** — [`PROJECT_DOCUMENTATION.md`](PROJECT_DOCUMENTATION.md) Jobs §6 **Bill Customer**; [`EDGE_FUNCTIONS.md`](EDGE_FUNCTIONS.md) **send-physical-invoice-email**.

---

## Latest Updates (v2.365)

**Date**: 2026-04-21

### **People** — **Contracts** — **Lineage**, **Applied version**, **Contract Book** → **pending re-sign**

- **DB** — [`20260421055733_contract_lineage_versions.sql`](supabase/migrations/20260421055733_contract_lineage_versions.sql): **`person_contract_documents`**: **`contract_lineage_id`**, **`lineage_version`**, **`supersedes_person_contract_document_id`**; unique **`(person_name, contract_lineage_id, lineage_version)`** (replaces one-row-per-name unique). **`create_pending_contract_versions_after_book_save(p_contract_template_document_id)`**: after **Contract Book** updates, for each assignee whose **latest** row for that document name is **`signed`**, inserts a new **`unsent`** row (next **`lineage_version`**, current book body + format + canonical URL, **`applied_contract_template_document_id`** = saved library row). **`update_contract_book_entry`** ends with **`PERFORM create_pending_contract_versions_after_book_save(...)`** (does not overwrite **`unsent`**/**`sent`** rows in place).
- **DB** — [`20260421054257_applied_contract_template_document_id.sql`](supabase/migrations/20260421054257_applied_contract_template_document_id.sql): **`applied_contract_template_document_id`** → **`contract_template_documents`** (optional pin for which library row drives **Applied version** display; **`NULL`** = latest **`updated_at`** among assigned templates’ matching document names — legacy behavior).
- **DB** — [`20260421053919_revert_update_contract_book_entry_person_signing_sync.sql`](supabase/migrations/20260421053919_revert_update_contract_book_entry_person_signing_sync.sql): **Reverts** bulk copy of book text into all assignee **`person_contract_documents`** on save — person signing copies are maintained per assignee; book save still updates the library row and renames matching person rows when the **document name** changes (see **`20260421053133`** for the superseded sync behavior). **`create_pending_contract_versions_after_book_save`** is added in **`20260421055733`** (below).
- **UI** — [`People.tsx`](src/pages/People.tsx): **Contracts** table shows multiple rows per logical contract (**Ver.** = **`lineage_version`**); **Applied version** uses pinned template doc or max **`contract_template_documents.updated_at`**; row **⋯** menu holds **Edit** (and related actions) for a cleaner primary row.

---

## Latest Updates (v2.364)

**Date**: 2026-04-20

### **People / Dashboard** — **Contract signing** reminder after **clock-in**

- **DB** — [`20260420234856_person_contract_documents_dashboard_prompt_after_clock_in.sql`](supabase/migrations/20260420234856_person_contract_documents_dashboard_prompt_after_clock_in.sql): **`person_contract_documents.dashboard_prompt_after_clock_in`**; RPC **`list_my_contract_dashboard_prompts()`** (signer identity via roster email + name or **`users.name`**).
- **Edge** — [`get-contract-signing-link-for-self`](supabase/functions/get-contract-signing-link-for-self/index.ts): authenticated signer mints **`/contract/accept`** URL without email (same token rotation as send).
- **People** — [`People.tsx`](src/pages/People.tsx): per-document **Dashboard** checkbox in the expanded row **Actions**; edit/add form option **Remind on Dashboard after clock-in (until signed)**.
- **Dashboard** — [`ClockInOutButton.tsx`](src/components/ClockInOutButton.tsx) **`onClockInSuccess`**; [`DashboardContractSigningPromptModal.tsx`](src/components/DashboardContractSigningPromptModal.tsx); [`Dashboard.tsx`](src/pages/Dashboard.tsx) opens the modal when the RPC returns rows after a successful clock-in.

---

## Latest Updates (v2.363)

**Date**: 2026-04-21

### **Billing** — **Undo OOB** Stripe reliability + **Payments received** sync

- **Edge** — [`reverse-stripe-invoice-out-of-band-payment`](supabase/functions/reverse-stripe-invoice-out-of-band-payment/index.ts): When Stripe marks an out-of-band close **`paid`** but leaves **`amount_paid`** at **0**, the credit-note amount falls back to invoice **`total`**. **`creditNotes.create`** sets **`out_of_band_amount`** to the note amount in that path so Stripe’s **`post_payment_amount`** allocation rule is satisfied (refund / **`credit_amount`** / **`out_of_band_amount`** sum).
- **Edit Job** — [`JobFormModal.tsx`](src/components/jobs/JobFormModal.tsx): **`paymentRowsFromJob`**, **`refreshEditingJobAndHydratePayments`** — after a successful unwind, refetches the job, reapplies **Payments received** form rows from **`jobs_ledger_payments`**, and refreshes **[`BilledBillViewModal`](src/components/jobs/BilledBillViewModal.tsx)** invoice snapshot when View bill is open (local **`payments`** state is no longer stuck on pre-unwind rows).
- **Hosted bill** — [`HostedStripeBillPanel.tsx`](src/components/jobs/HostedStripeBillPanel.tsx) optional **`onAfterOobUnwindSuccess`** (invoked only from **`UnwindStripeOobPaymentModal`** success — not on every **`get-stripe-invoice-details`** load, so unsaved payment edits are not wiped when opening View bill).
- **Bill Customer** — [`BillCustomerModalContext.tsx`](src/contexts/BillCustomerModalContext.tsx) **`openBillCustomer`** option **`onAfterOobUnwindSuccess`**; [`SendRecordInvoiceModal.tsx`](src/components/jobs/SendRecordInvoiceModal.tsx) refetches the job and updates **`stripeSuccessInvoice`** after unwind so the success-screen hosted panel shows current applied amounts.

---

## Latest Updates (v2.362)

**Date**: 2026-04-21

### **Billing** — **Undo Stripe out-of-band payment**

- **Edge** — [`reverse-stripe-invoice-out-of-band-payment`](supabase/functions/reverse-stripe-invoice-out-of-band-payment/index.ts): Stripe **credit note** (credits **`amount_paid`** when &gt; **0**, else invoice **`total`**; minus existing credit notes) when invoice has PipeTooling OOB metadata (**`pt_payment_type`**) and **no** Stripe **charge**; **`out_of_band_amount`** on the credit note when **`amount_paid`** was **0**; then RPC **`revert_stripe_oob_invoice_payment`**.
- **DB** — Migration **`20260420220523_revert_stripe_oob_invoice_payment`**: RPC + audit **`stripe_oob_payment_reverts`**; **`job_collect_payment_flows`** **`terminal_completed`** → **`approved_for_terminal`** when **`stripe_invoice_id`** matches.
- **Webhook** — [`stripe-webhook`](supabase/functions/stripe-webhook/index.ts): **`credit_note.created`** re-**`retrieve`** invoice and **`syncJobsLedgerStripeInvoiceStatus`**.
- **UI** — [`UnwindStripeOobPaymentModal.tsx`](src/components/jobs/UnwindStripeOobPaymentModal.tsx), [`HostedStripeBillPanel.tsx`](src/components/jobs/HostedStripeBillPanel.tsx) (**Undo out-of-band payment…** when invoice **Paid**, dev/master/assistant/primary). **v2.363** adds ledger/UI refresh after unwind (see above).
- **Docs** — [`EDGE_FUNCTIONS.md`](EDGE_FUNCTIONS.md) **reverse-stripe-invoice-out-of-band-payment**; [`ACCESS_CONTROL.md`](ACCESS_CONTROL.md) billing matrix note.

---

## Latest Updates (v2.361)

**Date**: 2026-04-21

### **Dashboard** / **Quickfill** — **Stale tally follow-up** — **Posted** (time)

- **[`DashboardStaleTallyStaffFollowUpModal.tsx`](src/components/DashboardStaleTallyStaffFollowUpModal.tsx)** — **Posted** appends local **time** (12-hour, **`posted_at`** in **`APP_CALENDAR_TZ`**), e.g. **April 16 (Thu) · 3:45 PM**.

---

## Latest Updates (v2.360)

**Date**: 2026-04-21

### **Dashboard** / **Quickfill** — **Stale tally follow-up** — **Posted** column

- **[`DashboardStaleTallyStaffFollowUpModal.tsx`](src/components/DashboardStaleTallyStaffFollowUpModal.tsx)** — **Posted** uses full month + day + short weekday in **`APP_CALENDAR_TZ`** (e.g. **April 16 (Thu)**) instead of short month + year.

---

## Latest Updates (v2.359)

**Date**: 2026-04-21

### **People** — **Contracts** — **Edit document** — delete **unsent**

- **[`People.tsx`](src/pages/People.tsx)** — **Edit document** modal: **Delete** (beside **Cancel**) when the saved status is **`unsent`**; nested **Delete document?** confirm (`z-index` 12); **`withSupabaseRetry`** + **`DELETE`** on **`person_contract_documents`**; not shown for **sent** / **signed**.

---

## Latest Updates (v2.358)

**Date**: 2026-04-21

### **People** — **Contracts** — **Send for signature** — email preview

- **[`contractSendEmailPreview.ts`](src/lib/contractSendEmailPreview.ts)** — Builds subject + HTML/text matching Edge **`send-contract-for-signature`** (placeholder URL until send).
- **[`People.tsx`](src/pages/People.tsx)** — **Send for signature** modal: **Email preview** block (subject + scrollable HTML); **Unable to load preview** if the document row is missing from local state.

---

## Latest Updates (v2.357)

**Date**: 2026-04-21

### **People** — **Contracts** — **Add document** → **Request Signature** — **Send**

- **[`People.tsx`](src/pages/People.tsx)** — **Add document** on **Request Signature**: **Send** (beside **Save**) saves the row, then opens the existing **Send for signature** modal when contract text or canonical URL is present; **Upload Signed** / **Edit document** unchanged. **contractsError** shown in the add/edit modal; cleared when opening **Add document**.

---

## Latest Updates (v2.356)

**Date**: 2026-04-21

### **People** — **Contracts** — **Send for signature** email

- **[`People.tsx`](src/pages/People.tsx)** — **Send for signature** / **Resend** modal: optional **Email subject** and **Opening message** (plain text); omitted fields keep prior defaults.
- **[`send-contract-for-signature`](supabase/functions/send-contract-for-signature/index.ts)** — Request body **`email_subject`** (max 200, clamped) and **`email_intro_plain`** (max 4000, clamped; HTML-escaped for the HTML part). Document line and signing link are always appended server-side.

---

## Latest Updates (v2.355)

**Date**: 2026-04-21

### **People** — **Contracts** tab — search

- **[`People.tsx`](src/pages/People.tsx)** — **Contracts** tab: full-width **Search people and contracts** field above the **Person** / **Status** table (case-insensitive substring). Filters rows to people whose **name** matches or who have a **contract document name** that matches. When the query is non-empty and any **document names** match, a **Matching contract documents** region lists single-line **`Person — document — status`** entries (`unsent` / `sent` / `signed`). **No matches** row when the filter matches nobody and the search is active.

---

## Latest Updates (v2.354)

**Date**: 2026-04-21

### **People** — **Contracts** — **Manage templates** list layout

- **[`People.tsx`](src/pages/People.tsx)** — **Manage templates** modal: each template shows its **document names** as an **indented bulleted list** below the template title (replaces inline **`(Doc1, Doc2)`**). Row uses **`alignItems: 'flex-start'`** so **Edit** / **Delete** stay top-aligned when there are many documents.

---

## Latest Updates (v2.353)

**Date**: 2026-04-21

### **People** — **Contracts** — **Assign template** modal

- **[`People.tsx`](src/pages/People.tsx)** — **Assign template to {person}** (expanded person row): **Search templates** filters template **names** (case-insensitive); scrollable list with **`role="radiogroup"`** / per-row **`role="radio"`**, **`aria-checked`** / **`aria-disabled`** for **already assigned**; selection clears if filtered out. Replaces native **`<select>`**; search resets on open, cancel, and successful assign.

---

## Latest Updates (v2.352)

**Date**: 2026-04-21

### **People** — **Contracts** — **Contract Book** UX + **Upload Signed** status

- **Contract Book** — [`ContractBookModal.tsx`](src/components/contracts/ContractBookModal.tsx): **View** per row (toggle) shows full library body via **`sanitizeContractSigningHtml`** + **`dangerouslySetInnerHTML`**; empty body shows **No library body yet** only inside the panel. List rows no longer show a text preview or empty-state line under the document name. **Edit** still clears the expanded view. Top helper paragraph removed from the modal.
- **Add/Edit document** — [`People.tsx`](src/pages/People.tsx): **Contract text** book icon is **blue** (`#2563eb`), borderless / transparent (not a boxed button).
- **Add document** — **Upload Signed** — [`People.tsx`](src/pages/People.tsx): **`saveContractDocument`** sets **`status: 'signed'`** whenever **`isAddUploadSignedTab`** (add flow is not tied to a **Status** control). **`Upload Signed`** / **`Request Signature`** tab clicks and Arrow Left/Right sync **`contractDocumentFormStatus`** (**`signed`** vs **`unsent`**). **Upload Signed** panel: link, signed date, note only (no **Status** row). **Edit document** remains a full form with **Status** `<select>`.

---

## Latest Updates (v2.351)

**Date**: 2026-04-21

### **People** — **Contracts** — **Contract Book**

- **Schema** — [`20260420175612_contract_template_documents_book_body_and_tags.sql`](supabase/migrations/20260420175612_contract_template_documents_book_body_and_tags.sql): **`contract_template_documents.book_body_html`**, **`tags`** (`TEXT[]`).
- **UI** — [`ContractBookModal.tsx`](src/components/contracts/ContractBookModal.tsx): list template documents with template name + tag badges; **Edit** saves sanitized HTML and tags. **Contracts** tab header **Contract Book** button; **Add/Edit document** modal: book icon beside **Contract text**. [`ContractBookIcon.tsx`](src/components/icons/ContractBookIcon.tsx).

---

## Latest Updates (v2.350)

**Date**: 2026-04-21

### **People** — **Contracts** — **Add document** — **Upload Signed** — no optional signing-page block

- **[`People.tsx`](src/pages/People.tsx)** — **Add document** → **Upload Signed**: removed the **Optional — signing page content if you also use Send for signature** section (contract text + canonical URL). **`saveContractDocument`** sets **`signing_body_html`** and **`canonical_document_url`** to **`null`** when saving from that tab (`!editingContractDocument && contractDocumentAddTab === 'upload_signed'`). **Request Signature** and **Edit document** unchanged.

---

## Latest Updates (v2.349)

**Date**: 2026-04-21

### **People** — **Contracts** — **Add document** — **Request Signature** — no after-signing block

- **[`People.tsx`](src/pages/People.tsx)** — **Add document** → **Request Signature**: removed the **Optional — after signing** section (signed/reference link, signed date, note). **`saveContractDocument`** also sets **`url`**, **`signed_at`**, and **`note`** to **`null`** when saving from that tab so tab-switching does not persist hidden fields. **Upload Signed** and **Edit document** unchanged.

---

## Latest Updates (v2.348)

**Date**: 2026-04-21

### **People** — **Contracts** — **Add document** — **Request Signature** — application-owned **status**

- **[`People.tsx`](src/pages/People.tsx)** — **Add document** → **Request Signature**: **Status** dropdown removed; short helper explains **Unsent** until row **Send**, then **Sent** / **Signed** via Edge; **`saveContractDocument`** sets **`status: 'unsent'`** when saving from that tab (`!editingContractDocument && contractDocumentAddTab === 'request_signature'`). **Upload Signed** tab does not use a **Status** control; **`saveContractDocument`** forces **`status: 'signed'`** for that add path (**v2.352**). **Edit document** still uses the full **Status** `<select>`.

---

## Latest Updates (v2.347)

**Date**: 2026-04-21

### **People** — **Contracts** — **Add document** — **Upload Signed** / **Request Signature** tabs

- **[`People.tsx`](src/pages/People.tsx)** — **Add document** only: tab strip (**Upload Signed** | **Request Signature**) with `role="tablist"`, `aria-selected`, `aria-controls`, and Arrow Left/Right to switch tabs; **Upload Signed** emphasizes signed/reference link, signed date, note (optional signing-page subsection removed in **v2.350**; **saved status** is always **signed** for that add path in **v2.352**); **Request Signature** emphasizes contract text + canonical **Check link** (**Status** / after-signing UI refined in **v2.348** / **v2.349**). **Edit document** remains a single full form (no tabs). `contractDocumentAddTab` resets to **Request Signature** on **+ Add document**.

---

## Latest Updates (v2.346)

**Date**: 2026-04-20

### **People** — **Contracts** — inline HTML, canonical URL, digital signing

- **Schema** — [`20260420164136_person_contract_documents_signing_and_content.sql`](supabase/migrations/20260420164136_person_contract_documents_signing_and_content.sql): **`person_contract_documents.signing_body_html`**, **`canonical_document_url`**, **`public_token_hash`**, **`public_token_expires_at`**, signer fields; Storage bucket **`contract-signer-signatures`** (staff read policy).
- **Staff UI** — [`People.tsx`](src/pages/People.tsx) Contracts tab: edit modal fields for contract text and canonical URL; **Signed / reference link** (legacy **`url`**); **Send** / **Resend** email modal; HTML/Link badges on rows; Users tab document-dot indicator counts any of HTML, canonical URL, or reference link.
- **Public** — [`ContractAccept.tsx`](src/pages/ContractAccept.tsx) route **`/contract/accept?t=<token>`**; [`sanitizeContractSigningHtml`](src/lib/sanitizeContractSigningHtml.ts) (browser **DOMParser** allowlist, no extra bundle); [`ContractAcceptSignatureForm`](src/components/contracts/ContractAcceptSignatureForm.tsx) reuses Estimates **typed/draw** signature pattern.
- **Edge** — **`get-contract-for-signer`**, **`accept-contract`**, **`send-contract-for-signature`** (see [`EDGE_FUNCTIONS.md`](EDGE_FUNCTIONS.md)).

---

## Latest Updates (v2.345)

**Date**: 2026-04-21

### **People** — **Pay History** — **Additional** — **prevailing wage** description UX

- **Behavior**: New prevailing-wage top-up rows store a **human-readable** **`description`** only (for example `Prevailing top-up YYYY-MM-DD: $…/hr − $…/hr`). **`source_clock_session_id`** links the line to the **clock session** and enforces **one row per stub per session** (migration **[`20260420051645_pay_stub_additional_lines_source_clock_session.sql`](supabase/migrations/20260420051645_pay_stub_additional_lines_source_clock_session.sql)**). The app **no longer** prefixes **`[pw:<uuid>] `** in **`description`** for dedup.
- **Legacy**: Older rows may still have that prefix. **[`stripPrevailingWageTag`](src/lib/payStubPrevailingWageLine.ts)** removes it for the **Additional** modal (**`LineEditor`**, target line **`<select>`**, **Change Line to hit Target** saves) and for itemized **Additional** lines in **pay stub HTML** (**[`buildPayStubHtml`](src/pages/People.tsx)**). **[`parsePrevailingSessionId`](src/lib/payStubPrevailingWageLine.ts)** still reads the tag when present so **`existingLineForSession`** keeps working until a row is re-saved without the prefix.
- **Files**: [`PayStubAdditionalModal.tsx`](src/components/pay/PayStubAdditionalModal.tsx), [`payStubPrevailingWageLine.ts`](src/lib/payStubPrevailingWageLine.ts), [`People.tsx`](src/pages/People.tsx)

---

## Latest Updates (v2.344)

**Date**: 2026-04-21

### **Edit Job** — **Delete** confirmation **modal**

- **[`JobFormModal.tsx`](src/components/jobs/JobFormModal.tsx)** — Footer **Delete** opens a nested overlay (**`JOB_FORM_NESTED_OVERLAY_Z_INDEX`**, same pattern as payment-remove confirm): title **Delete job from Billing?**, **HCP** + **Job** lines (em dash when blank), warning that removal is permanent; **Cancel** / **Delete**; destructive **Delete** shows **Deleting…** while **`deleteJob`** runs. Replaces **`window.confirm('Delete this job from Billing?')`**. **`deleteJobConfirmOpen`** is cleared in **`closeForm`**, **`applyEditJob`**, and **`resetNewForm`** so switching jobs cannot leave a stale dialog.

### **Collect Payment** — **hosted Stripe invoice** (device Terminal Edge functions removed)

- **Edge** — **`terminal-connection-token`** and **`create-terminal-collect-payment-intent`** removed from the repo (no longer used). Step 3 uses the **hosted invoice** URL from **`jobs_ledger_invoices`** (and **`send-stripe-invoice`** / **`get-stripe-invoice-details`** as before). **`update-collect-payment-stripe-customer-email`** updates Stripe Customer + open invoice email + syncs **`jobs_ledger.customer_email`** / **`customers.contact_info`** for subcontractors on the flow. **`stripe-webhook`** **`invoice.paid`** / **`invoice.payment_succeeded`**: after **`mark_invoice_paid_from_stripe`**, calls **`complete_job_collect_payment_flow_for_invoice`** so **`job_collect_payment_flows`** moves from **`approved_for_terminal`** to **`terminal_completed`** when the paid Stripe invoice matches the flow’s **`stripe_invoice_id`** (DB status name kept for compatibility). **`get-stripe-invoice-details`**, **`send-stripe-invoice`**, **`void-stripe-invoice-for-revert`** updated for the same gates and payload shapes where needed.
- **Migrations** — **[`20260419180746_collect_payment_complete_on_invoice_paid.sql`](supabase/migrations/20260419180746_collect_payment_complete_on_invoice_paid.sql)** — **`complete_job_collect_payment_flow_for_invoice(text)`**; **`get_collect_payment_certify_payload`** adds **`collect_invoice`** (billed row + **`hosted_invoice_url`** / **`stripe_invoice_id`**); **[`20260419183243_collect_payment_certify_payload_customer_email.sql`](supabase/migrations/20260419183243_collect_payment_certify_payload_customer_email.sql)** — **`billing_customer`** on certify payload; **[`20260419201229_collect_payment_return_to_dispatch.sql`](supabase/migrations/20260419201229_collect_payment_return_to_dispatch.sql)** + **[`20260419202031_collect_payment_return_set_initiated_by.sql`](supabase/migrations/20260419202031_collect_payment_return_set_initiated_by.sql)** — **`return_collect_payment_to_dispatch`** (subcontractor send-back to dispatch queue; **`certify_mode`** **`returned_from_terminal`**); **[`20260419223818_jobs_ledger_invoices_supabase_realtime.sql`](supabase/migrations/20260419223818_jobs_ledger_invoices_supabase_realtime.sql)** — **`jobs_ledger_invoices`** on **`supabase_realtime`** (field queue without mutating **`job_collect_payment_flows`**); **[`20260419231724_collect_payment_payload_invoice_sent_at.sql`](supabase/migrations/20260419231724_collect_payment_payload_invoice_sent_at.sql)** — **`sent_to_customer_at`** on **`collect_invoice`** in payload. See **`MIGRATIONS.md`** (April 21, 2026).
- **[`CollectPaymentModal.tsx`](src/components/jobs/CollectPaymentModal.tsx)** / **[`DashboardFieldCollectPaymentQueue.tsx`](src/components/dashboard/DashboardFieldCollectPaymentQueue.tsx)** — Staff primary action label **Approve for payment** (opens hosted payment page for the subcontractor after approval).

---

## Latest Updates (v2.343)

**Date**: 2026-04-21

### **Collect Payment** — Step 1 **Job Book** polish + Step 2 **Call Dispatch** placement

- **[`CollectPaymentModal.tsx`](src/components/jobs/CollectPaymentModal.tsx)** — Step 1 always loads **`job_book_entries`** when the modal is open on certify (not only when the fixtures list is empty). **Add line items from Job Book** is a collapsible block (**default collapsed**) below the line-items table and above **Certify** / **Request correction**; full-width **search** narrows catalog rows by **Work** label (case-insensitive). Amber **No Ready-to-Bill invoice row yet** appears only when there is **no** draft **`invoice`** and **zero** **`fixtures`** (after adding a line from Job Book, the message hides). **Step 2**: **Call Dispatch** **`tel:`** link moved from the dialog header to the **footer** beside **Close** (**Close** left, call control right).

### **Job Book** editor — empty-feel typing (**Settings** + **Jobs** modal)

- **[`JobBookEditorPanel.tsx`](src/components/settings/JobBookEditorPanel.tsx)** — After **Add line**, **Work** receives focus with **New line** fully selected so the first keystroke replaces the placeholder; **Cost ($)** selects all on focus when the amount is **0**. Uses **`useLayoutEffect`** + **`requestAnimationFrame`** so focus works after insert. Shared by **Settings → Job Book** and **[`JobBookModal.tsx`](src/components/jobs/JobBookModal.tsx)**.

---

## Latest Updates (v2.342)

**Date**: 2026-04-20

### **Job Book** — **Collect Payment** Step 1 + **Settings**

- **Migration** — [`20260420021701_job_book_entries_collect_payment.sql`](supabase/migrations/20260420021701_job_book_entries_collect_payment.sql): **`job_book_entries`** (**`work_label`**, **`unit_cost`**, optional **`service_type_id`**); **RLS** **SELECT** all **`authenticated`**; **IUD** **`dev`** / **`master_technician`** / **`assistant`**. **`get_collect_payment_certify_payload`** returns **`job_service_type_id`** (from **`jobs_ledger`** → **`bids.service_type_id`**) for client-side catalog filtering. **`add_collect_payment_fixture_from_job_book`**: **subcontractor** on **RTB** team job appends **`jobs_ledger_fixtures`** and recomputes **`jobs_ledger.revenue`**.
- **[`JobBookSettingsSection.tsx`](src/components/settings/JobBookSettingsSection.tsx)** / **[`JobBookEditorPanel.tsx`](src/components/settings/JobBookEditorPanel.tsx)**, **[`Settings.tsx`](src/pages/Settings.tsx)** — Collapsible **Job Book (Collect Payment line items)** for staff: table **Work**, **Cost ($)**, **Service type** (**All types** or one **`service_types`** row), **Reorder** column with **@dnd-kit** drag handle (persists **`sequence_order`** 0..n−1), **Add line**, trash icon with in-app **Delete Job Book line?** confirm modal (`z-index` above **`JobBookModal`**).
- **[`Jobs.tsx`](src/pages/Jobs.tsx)** — **Stages** toolbar (after search): book icon opens **[`JobBookModal.tsx`](src/components/jobs/JobBookModal.tsx)** with the same editor (**dev** / **master_technician** / **assistant**); errors as toast.
- **[`CollectPaymentModal.tsx`](src/components/jobs/CollectPaymentModal.tsx)** — Initial ship: read-only **Work** | **Cost** + **Add** per catalog row; filters universal + matching **`job_service_type_id`**. (**v2.343** — catalog fetch + UI always on Step 1; search, collapse default, invoice warning gate, Step 2 call control in footer — see **v2.343** above.)

---

## Latest Updates (v2.341)

**Date**: 2026-04-19

### **Dashboard** — **Field: Waiting for Approval** — **Line Items** vs Stripe invoice

- **[`DashboardFieldCollectPaymentQueue.tsx`](src/components/dashboard/DashboardFieldCollectPaymentQueue.tsx)** — Staff queue (**dev** / **master_technician** / **assistant**): read-only **Line Items** grid (job **`jobs_ledger_fixtures`** + Stripe **`get-stripe-invoice-details`** for the subcontractor’s invoice pick). **[`fieldQueueFixtureStripeLineMatch.ts`](src/lib/fieldQueueFixtureStripeLineMatch.ts)** (**[`fieldQueueFixtureStripeLineMatch.test.ts`](src/lib/fieldQueueFixtureStripeLineMatch.test.ts)**) heuristically pairs fixtures to invoice lines; **unmatched** rows use a **red** row background. **Job total** footer row: helper *Items in red are not included on the selected invoice.* in **`#b91c1c`**, shown only when at least one row is red (**`hasUnmatchedInvoiceRows`**). **Prepare Bill**: **blue** when the job has **no** billed Stripe invoice options, **green** when at least one exists. **Add Line Items** (when there are no named fixtures): opens **Edit Job** with **`fixturesSectionHighlight`** — scroll + short highlight on **Specific Work** (**[`JobFormModalContext.tsx`](src/contexts/JobFormModalContext.tsx)**, **[`JobFormModal.tsx`](src/components/jobs/JobFormModal.tsx)**). Invoice details cache clears on queue **`load`**.
- **[`stripeInvoiceDetailsResponse.ts`](src/lib/stripeInvoiceDetailsResponse.ts)** — Shared **`parseStripeInvoiceDetailsResponse`** + types; **[`HostedStripeBillPanel.tsx`](src/components/jobs/HostedStripeBillPanel.tsx)** consumes the same parser.

### **Collect Payment** — centered step titles

- **[`CollectPaymentModal.tsx`](src/components/jobs/CollectPaymentModal.tsx)** — **Step N of M: …** label uses **`textAlign: 'center'`** for **all** steps (matches steps 2–3; step 1 was previously left-aligned).

---

## Latest Updates (v2.340)

**Date**: 2026-04-19

### **Ready to Bill — Send Back** cancels **Collect payment** flow

- **Migration** — [`20260419230155_update_job_status_cancel_collect_payment_flow.sql`](supabase/migrations/20260419230155_update_job_status_cancel_collect_payment_flow.sql): **`update_job_status`** on **ready_to_bill → working** also sets **`job_collect_payment_flows`** to **`cancelled`** when status is **`draft`**, **`pending_dispatch`**, or **`approved_for_terminal`** (clears dispatch/Stripe scratch fields). JSON return adds **`cancelled_collect_payment_flows`** (row count).
- **[`Dashboard.tsx`](src/pages/Dashboard.tsx)** / **[`Jobs.tsx`](src/pages/Jobs.tsx)** — Send Back confirmation modal loads flow status and shows an amber paragraph when a cancellable step is in progress (**step 1–3** copy aligned with **`CollectPaymentModal`**).
- **[`useSendBackCollectPaymentFlowNotice.ts`](src/hooks/useSendBackCollectPaymentFlowNotice.ts)**, **[`collectPaymentFlowSendBackNotice.ts`](src/lib/collectPaymentFlowSendBackNotice.ts)** — shared fetch + copy; unit test on copy helper.

---

## Latest Updates (v2.339)

**Date**: 2026-04-19

### **Subcontractor field collect payment** (certify → dispatch → Terminal)

- **Migration** — [`20260419161731_job_collect_payment_flows.sql`](supabase/migrations/20260419161731_job_collect_payment_flows.sql): **`job_collect_payment_flows`**, RPCs **`get_collect_payment_certify_payload`**, **`submit_collect_payment_certification`**, **`approve_collect_payment_for_terminal`**, **`complete_job_collect_payment_flow_terminal`**; **`list_ready_to_bill_assigned_jobs_for_dashboard()`** adds **`collect_payment_button_variant`** (`default` | `pending_dispatch` | `ready_terminal`).
- **[`CollectPaymentModal.tsx`](src/components/jobs/CollectPaymentModal.tsx)** — Three-step wizard: certify or request correction; await dispatch (**Realtime** on flow row + refresh); Stripe Terminal via **`@stripe/terminal-js`** (**simulated** readers in dev). Depends on office **Stripe billed** invoice + dispatch approval.
- **[`Dashboard.tsx`](src/pages/Dashboard.tsx)** — Subcontractor **Collect Payment** button: amber **pending** after certify, **green / white** when **`ready_terminal`**; opens **`CollectPaymentModal`**; **`DashboardFieldCollectPaymentQueue`** for dev / master / assistant (**Approve for Terminal**).
- **Edge** — **`terminal-connection-token`**, **`create-terminal-collect-payment-intent`** (removed in **v2.344**; use **`stripe-webhook`** **`invoice.paid`** + **`complete_job_collect_payment_flow_for_invoice`** for hosted invoice completion). [`stripe-webhook`](supabase/functions/stripe-webhook/index.ts) may still handle legacy **`payment_intent.succeeded`** paths where applicable.
- **Migration** — [`20270419120002_list_mercury_bank_payments_returned_column.sql`](supabase/migrations/20270419120002_list_mercury_bank_payments_returned_column.sql): restores **`returned`** + **`includeHiddenArDeposits`** / legacy **`includeFullyApplied`** visibility on Mercury AR list/count (**`20270419120001`** had dropped them).

---

## Latest Updates (v2.338)

**Date**: 2026-04-19

### **Dashboard** — **team Ready to Bill** (non-staff)

- **Migration** — [`20260419154440_list_ready_to_bill_assigned_jobs_for_dashboard.sql`](supabase/migrations/20260419154440_list_ready_to_bill_assigned_jobs_for_dashboard.sql): RPC **`list_ready_to_bill_assigned_jobs_for_dashboard()`** — same columns as **`list_assigned_jobs_for_dashboard()`** but **`WHERE jl.status = 'ready_to_bill'`** and **`jobs_ledger_team_members`** on **`auth.uid()`** (team-scoped; not org-wide **`get_jobs_ledger_by_status`**).
- **[`Dashboard.tsx`](src/pages/Dashboard.tsx)** — Collapsible **Ready to Bill** section **above** **Assigned Jobs** for **`subcontractor`**, **`primary`**, **`superintendent`**, **`estimator`** (not dev / master / assistant, who already have org-wide Ready to Bill). **`detailModalAssignedJobsRows`** = assigned working + team RTB for **`DetailJobModal`**; **`updateJobStatus`** and subcontractor schedule labels refresh RTB list as needed.

### **Job Detail** — **Job Total** hidden for subcontractors

- **[`jobDetailModalRole.ts`](src/lib/jobDetailModalRole.ts)** — **`showJobDetailJobTotal(role)`** — **`false`** for **`subcontractor`**.
- **[`DetailJobModal.tsx`](src/components/jobs/DetailJobModal.tsx)** — Full and limited job **Job Total** **`DetailRow`** gated by **`showJobDetailJobTotal(authRole)`**.

### **Dashboard** — **Assigned Jobs** / **Superintendent Jobs** — open **Job Detail** from title

- **[`Dashboard.tsx`](src/pages/Dashboard.tsx)** — **HCP · job name** line is keyboard-focusable (`role="button"`, `tabIndex={0}`) and opens **`DetailJobModal`** via **`scheduleJobDetail`** with **`scheduleContext: null`**; **`prefillRowLabel`** / **`prefillAddress`**. Styling: dark text (`#111827`), pointer cursor.

---

## Latest Updates (v2.337)

**Date**: 2026-04-18

### **Jobs** — **Job Detail** — **Assigned Team** heading

- **[`DetailJobModal.tsx`](src/components/jobs/DetailJobModal.tsx)** — Full job detail: the team list section label is **Assigned Team** (was **Team**). Same data: read-only **`team_members`**; muted **No team members listed.** when empty.

---

## Latest Updates (v2.336)

**Date**: 2026-04-18

### **Jobs** — **Stages** — **Accounts Receivable** ignores Stages search

- **[`Jobs.tsx`](src/pages/Jobs.tsx)** — **`bankPaymentsModalBilledRows`**: `useMemo(() => buildJobsStagesBoardLists(jobs, '').billedRows, [jobs])`. **[`BankPaymentsModal`](src/components/jobs/BankPaymentsModal.tsx)** receives **`billedRows={bankPaymentsModalBilledRows}`** so allocation targets and Stripe-skip counts match the **full** billed board. **Accounts Receivable** beside **Billed Awaiting Payment** is **disabled** only for roles outside dev / master_technician / assistant / primary (no longer tied to **filtered** billed row count). **`accountsReceivableButtonAccessibleName`** uses **`bankPaymentsModalBilledRows.length`** for the “No billed rows” tooltip. **Print** beside AR still uses **search-filtered** `billedRows`.

### **Edit Job** — **Payments received** — Mercury **Unlink and remove**; **Ref** copy UX

- **[`JobFormModal.tsx`](src/components/jobs/JobFormModal.tsx)** — Mercury-linked rows: **Unlink and remove** confirms, **`DELETE`** **`jobs_ledger_payments`**, **`UPDATE`** **`jobs_ledger.payments_made`** (sum of remaining lines), refresh job; if status stays **paid** but **revenue > payments_made** (tolerance), **`update_job_status`** → **billed**. Invoice-linked and role guards unchanged. Removing the **only** payment line seeds **`[newEmptyPaymentRow()]`** so the grid stays usable.
- **[`abbreviatePaymentReference.ts`](src/lib/abbreviatePaymentReference.ts)** — **`abbreviatePaymentReferenceLabel`**: long / UUID-shaped **Ref** read-only text shows **`first3..last3`**; **`ReadOnlyPaymentRefCopy`** button copies full **`reference_number`**, success toast (**clipboard** fallback errors).

### **Bank Payments** modal — copy

- **[`BankPaymentsModal.tsx`](src/components/jobs/BankPaymentsModal.tsx)** — Label **Memo (optional)** (replaces **Internal note (optional)**); still sent as **`p_note`** → **`jobs_ledger_payments.note`** per allocation apply.

---

## Latest Updates (v2.335)

**Date**: 2026-04-18

### **Jobs** — **Bank Payments**: **Returned** deposits; **`includeHiddenArDeposits`**

- **Migration** — [`20260418184112_mercury_transaction_ar_returned_and_include_hidden.sql`](supabase/migrations/20260418184112_mercury_transaction_ar_returned_and_include_hidden.sql): table **`mercury_transaction_ar_returned`** (FK **`mercury_transactions`**, RLS for dev / master_technician / assistant / primary); RPC **`set_mercury_transaction_ar_returned`**; **`list_mercury_transactions_for_bank_payments`** / **`count_mercury_transactions_for_bank_payments`** add **`p_filter.includeHiddenArDeposits`** (fallback: legacy **`includeFullyApplied`**), **`returned`** column on list, and default visibility excludes rows marked returned and fully applied zero-remainder rows.
- **[`BankPaymentsModal.tsx`](src/components/jobs/BankPaymentsModal.tsx)** — Header **Mark** toggles per-row **Returned** checkbox ( **`stopPropagation`** ); checkbox label **Show fully applied and returned deposits** sends **`includeHiddenArDeposits`**.
- **`GLOSSARY.md`** — **Returned deposit (AR Bank Payments)** under Accounts Receivable Sorting.

---

## Latest Updates (v2.334)

**Date**: 2026-04-18

### **Jobs** / **Dashboard** — **Accounts Receivable Sorting** filter: org-wide **`app_settings`** (dev writes)

- **[`APP_SETTINGS_KEY_BANK_PAYMENTS_SORTING_CONFIG`](src/lib/appSettingsKeys.ts)** — Key **`bank_payments_sorting_config_v1`**; JSON **`BankingSortingConfigV1`** in **`value_text`** (kinds, accounts, debit cards, start date, counterparty/note exclusions). **RLS**: same as Kind badges — all authenticated **SELECT**; **dev** **upsert** only.
- **[`bankingSortingConfig.ts`](src/lib/bankingSortingConfig.ts)** — **`fetchBankPaymentsSortingConfigFromAppSettings`**, **`upsertBankPaymentsSortingConfigToAppSettings`**, **`resolveBankPaymentsSortingConfigForAr`**; **`loadBankPaymentsSortingConfig`** reads legacy per-user **`bank_payments_sorting_config_v1_<userId>`** (no write) or falls back to Banking/Quickfill **`banking_sorting_config_v1_<userId>`** when no **`app_settings`** row yet; **`BANK_PAYMENTS_SORTING_LOCAL_CACHE_KEY`** (**`bank_payments_sorting_config_v1__cache`**) mirrors the server after fetch/save.
- **[`BankPaymentsModal.tsx`](src/components/jobs/BankPaymentsModal.tsx)** — On open: server wins when a row exists; if **no** row, uses legacy local-derived filters and **dev** **one-time** upsert publishes them (same pattern as Kind badges). **Save** on **Accounts Receivable Sorting** persists with **`upsertBankPaymentsSortingConfigToAppSettings`** (dev-only UI).
- **[`useArBankUnallocatedCount.ts`](src/hooks/useArBankUnallocatedCount.ts)** — **`p_filter`** from **`resolveBankPaymentsSortingConfigForAr`** so the Dashboard banner matches Jobs **Bank Payments** for all roles.
- **[`BankingSortingConfigModal.tsx`](src/components/BankingSortingConfigModal.tsx)** — Sorting **`onSave`** may return **`Promise`**; **Save** awaits it before close.
- **Migration** — [`20260418074400_bank_payments_sorting_config_app_settings_doc.sql`](supabase/migrations/20260418074400_bank_payments_sorting_config_app_settings_doc.sql) documents the key (no seed row).
- **`GLOSSARY.md`** — Term **Accounts Receivable Sorting (Jobs Stages → Bank payments)** (org-wide filter vs Banking sorting, fallbacks, RPC parity).

---

## Latest Updates (v2.333)

**Date**: 2026-04-18

### **Jobs** — **Bank Payments** Kind badges: org-wide **`app_settings`** (dev writes)

- **[`APP_SETTINGS_KEY_BANK_PAYMENTS_KIND_BADGES`](src/lib/appSettingsKeys.ts)** — Key **`bank_payments_kind_badges_v1`**; JSON in **`value_text`** (same shape as before). **RLS**: all authenticated **SELECT**; **dev** **upsert** only ([`20260220180000_create_app_settings.sql`](supabase/migrations/20260220180000_create_app_settings.sql)).
- **[`bankPaymentsKindBadges.ts`](src/lib/bankPaymentsKindBadges.ts)** — **`fetchBankPaymentsKindBadgesFromAppSettings`**, **`upsertBankPaymentsKindBadgesToAppSettings`**, **`parseBankPaymentsKindBadgesObject`**; **`localStorage`** key unchanged as **cache** after fetch/save (**`saveBankPaymentsKindBadgesLocalCache`**).
- **[`BankPaymentsModal.tsx`](src/components/jobs/BankPaymentsModal.tsx)** — On open: **server wins** when a row exists; if **no** row and **dev** has **local-only** badges, **one-time** upsert publishes them. **`enableKindBadgeEditor`** only when **`authRole === 'dev'`** (badge label/color rows; sorting filters unchanged for all AR roles).
- **[`BankingSortingConfigModal.tsx`](src/components/BankingSortingConfigModal.tsx)** — **`onSaveKindBadges`** may return **`Promise`**; **Save** awaits Kind badges before sorting **`onSave`**; **`saveError`** on failure.
- **Migration** — [`20260418073359_bank_payments_kind_badges_app_settings_doc.sql`](supabase/migrations/20260418073359_bank_payments_kind_badges_app_settings_doc.sql) documents the key (no seed row).

---

## Latest Updates (v2.332)

**Date**: 2026-04-18

### **Dashboard** — **Unallocated bank deposits** banner (AR-ready Mercury rows)

- **[`useArBankUnallocatedCount.ts`](src/hooks/useArBankUnallocatedCount.ts)** — Calls RPC **`count_mercury_transactions_for_bank_payments`** with the same **`p_filter`** shape as **`list_mercury_transactions_for_bank_payments`** (company **Accounts Receivable Sorting** via [`resolveBankPaymentsSortingConfigForAr`](src/lib/bankingSortingConfig.ts); see **v2.334**). Roles: **dev**, **master_technician**, **assistant**, **primary**. Refetch on **`window` `focus`**; optional **`bankPaymentsModalOpen`** from **Jobs** refetches when the modal closes so the count drops after Apply.
- **[`DashboardArBankUnallocatedBanner.tsx`](src/components/DashboardArBankUnallocatedBanner.tsx)** — Blue call-to-action above the Job Tally / stale-tally row when count &gt; 0; navigates to **`/jobs?tab=stages&openBankPayments=true`**.

### **Jobs** — **Bank Payments** / **Accounts Receivable Sorting**: counterparty + note exclusions; allocation layout

- **[`bankingSortingConfig.ts`](src/lib/bankingSortingConfig.ts)** — Sorting config includes **`excludeCounterpartyContains`** and **`excludeNoteContains`** (case-insensitive substring lists; max count/length caps). With **v2.334**, canonical persistence is org-wide **`app_settings`** **`bank_payments_sorting_config_v1`** (dev writes); legacy per-user key retained only for migration when no server row.
- **[`BankingSortingConfigModal.tsx`](src/components/BankingSortingConfigModal.tsx)** — **Accounts Receivable Sorting** can edit **Exclude counterparty contains** and **Exclude note contains** (multi-line); applied by **`list_mercury_transactions_for_bank_payments`** / count RPC (see **`20260418063154_ar_sorting_exclude_counterparty_note.sql`**).
- **[`BankPaymentsModal.tsx`](src/components/jobs/BankPaymentsModal.tsx)** — **Allocations**: each line uses two rows — **billed line** [`SearchableSelect`](src/components/SearchableSelect.tsx) + **Remove** on the first row, **Amount** on the second; **Add allocation** sits on a **footer** row (right-aligned flex). Apply still calls **`apply_mercury_bank_payment_allocations`**.

### **Quickfill** — **Warnings**: **Unallocated bank deposits** (with stale-tally block)

- **[`Quickfill.tsx`](src/pages/Quickfill.tsx)** — When the **Warnings** section is visible (stale tally staff follow-up), it also shows **`DashboardArBankUnallocatedBanner`** and **`QuickfillMetricReporter`** (**`ar-bank-unallocated`**) for positive **`useArBankUnallocatedCount`** (same navigation to **`/jobs?tab=stages&openBankPayments=true`**). **Dashboard** shows the AR banner independently (above the tally row) for **dev** / **master_technician** / **assistant** / **primary**.

---

## Latest Updates (v2.331)

**Date**: 2026-04-18

### **Jobs** — **Bank Payments** / **Accounts Receivable Sorting**: **Kind** nicknames + colors as badges

- **[`bankPaymentsKindBadges.ts`](src/lib/bankPaymentsKindBadges.ts)** — Shared per-origin **`localStorage`** key **`bank_payments_kind_badges_v1`**: map Mercury **`kind`** → optional **nickname** + **`#rrggbb`** color; **`pickTextOnBackground`** for readable badge text; **`pruneKindBadgesToChoices`** on save keeps only kinds present in the current Mercury sample query.
- **[`BankingSortingConfigModal.tsx`](src/components/BankingSortingConfigModal.tsx)** — Optional **`enableKindBadgeEditor`**, **`kindBadges`**, **`onSaveKindBadges`**: **Kinds** tab rows include **Badge label** + **Color** when enabled; merged list = sample kinds ∪ saved badge keys (orphan kinds show a short note; pruned on save if not in sample).
- **[`BankPaymentsModal.tsx`](src/components/jobs/BankPaymentsModal.tsx)** — Loads badges on open; **Bank transactions** list and selected-transaction header show colored **Kind** pills (empty nickname → **`formatMercuryKind`**).

---

## Latest Updates (v2.330)

**Date**: 2026-04-17

### **People** — **Pay History**: **Generate Custom Pay Report** modal; full-width ledger **Search**

- **[`People.tsx`](src/pages/People.tsx)** — Toolbar row: **Generate Custom Pay Report** opens **[`CustomPayReportsModal`](src/components/pay/CustomPayReportsModal.tsx)** (bulk period + per-person status; **View** on stubs); **Draft Payroll** remains on the right. Ledger **Search** is full width with a helper line under **Ledger** (filtered unpaid count + balance sum). Empty ledger copy points users to **Generate Custom Pay Report** and **Draft Payroll** when no stubs match.

### **Jobs** — **Stages** **Bank payments**: **Accounts Receivable Sorting** (separate config from Banking)

- **[`bankingSortingConfig.ts`](src/lib/bankingSortingConfig.ts)** — AR sorting was introduced as per-user **`bank_payments_sorting_config_v1_<userId>`** with seed from **`banking_sorting_config_v1_<userId>`**; **v2.334** moves the canonical filter blob to **`app_settings`** **`bank_payments_sorting_config_v1`** (see **Latest Updates (v2.334)**). Banking / Quickfill **`banking_sorting_config_v1_*`** remains per-user.
- **[`BankPaymentsModal.tsx`](src/components/jobs/BankPaymentsModal.tsx)** — **Sorting configuration…** opens **[`BankingSortingConfigModal`](src/components/BankingSortingConfigModal.tsx)** with **`title="Accounts Receivable Sorting"`**, optional **`contextNote`**, and **[`useMercuryLedgerNicknames`](src/hooks/useMercuryLedgerNicknames.ts)** (`{ enabled: open }`) so account / debit lists show nicknames where the hook applies (dev / master_technician / assistant).
- **[`BankingSortingConfigModal.tsx`](src/components/BankingSortingConfigModal.tsx)** — Optional **`title`**, **`contextNote`**, **`dialogAriaSuffix`** for distinct accessible titles when reused from Banking vs Jobs.

---

## Latest Updates (v2.329)

**Date**: 2026-04-17

### **Bids** — **Cover Letter** paste for **Google Docs**; **Submission & Followup** deep link; note **times** (`datetime-local`)

- **[`buildCoverLetterHtml`](src/pages/Bids.tsx)** — Combined document is one **`<p>`** with **`<br/>`** (and double breaks between major sections) so Google Docs does not get one paragraph per old block. **`white-space:pre-wrap`** preserves leading spaces for inclusion/exclusion indents; **`line-height:1`** for single spacing. **Copy to clipboard** writes **`text/html` only** (minimal full HTML document with **StartFragment** / **EndFragment** comments around the body) so Docs does not prefer **`text/plain`** (**[`buildCoverLetterText`](src/pages/Bids.tsx)** uses a newline per line and caused a paragraph mark per line when plain was chosen). Fallback **`writeText(combinedText)`** unchanged. Use **normal paste** in Docs, not paste without formatting.
- **[`Bids.tsx`](src/pages/Bids.tsx)** — **`submissionFollowupPendingDeepLinkBidIdRef`** + **`applySubmissionFollowupDeepLinkToBid`**: **`/bids?bidId=…&tab=submission-followup`** applies when the bid appears after a service-type filter switch (same pattern as Bid Board pending scroll).
- **[`BidNotesTable.tsx`](src/components/bidNotes/BidNotesTable.tsx)**, **[`UnifiedBidCustomerNotes.tsx`](src/components/bidBoard/UnifiedBidCustomerNotes.tsx)** — **`datetime-local`** inputs use **`toDatetimeLocal`** / **`fromDatetimeLocal`** from **[`datetimeLocal.ts`](src/utils/datetimeLocal.ts)** so stored UTC ISO matches the picker (no offset skew from **`slice(0,16)`** on UTC strings).

---

## Latest Updates (v2.328)

**Date**: 2026-04-17

### **Jobs** — **Stages** **Billed Awaiting Payment**: **Edit** beside **Open …**

- **[`Jobs.tsx`](src/pages/Jobs.tsx)** — **`renderUnifiedStagesTable`** option **`editJobIconBesideTimeOpen`** (default **`false`**; **`true`** only for the **Billed Awaiting Payment** section). **Merged** job rows: **Edit** follows the **Open …** span (job **`created_at`**). **Standalone** partial-invoice rows: **Open …** uses the billing line **`created_at`**; **Edit** on the same flex row as **Mark Paid** / **View Bill**. **Ready to Bill** and other callers unchanged (**Edit** stays in the secondary icon row with wrench / partial invoice when shown). When **`showTimeOpen`** is off, **Edit** is not moved up (no orphan control).

---

## Latest Updates (v2.327)

**Date**: 2026-04-17

### **Documents** → **Jobs** — **Billed** invoices as child rows; **View bill** + **PDF** preview

- **[`Documents.tsx`](src/pages/Documents.tsx)** — After loading the jobs ledger, second query **`jobs_ledger_invoices`** **`.in('job_id', …)`** **`.eq('status', 'billed')`**; nested rows per job (**Invoice #**, channel via **`billingTypeLabel`**, amount, sent date). Search matches invoice fields. **[`DocumentsJobBilledInvoiceModal.tsx`](src/components/documents/DocumentsJobBilledInvoiceModal.tsx)** — **[`HostedStripeBillPanel`](src/components/jobs/HostedStripeBillPanel.tsx)** + reconstructed **`PhysicalInvoicePreview`** / open PDF tab; **`fetchJobWithDetailsById`**. **`billingTypeLabel`** exported from **`HostedStripeBillPanel`**. Shared: **[`jobBillingContext.ts`](src/lib/jobBillingContext.ts)**, **[`physicalInvoiceJobContext.ts`](src/lib/physicalInvoiceJobContext.ts)**, **[`physicalInvoiceDocumentForBilledInvoice.ts`](src/lib/physicalInvoiceDocumentForBilledInvoice.ts)**.

---

## Latest Updates (v2.326)

**Date**: 2026-04-17

### **Bill Customer** — **Physical invoice** email **subject** line

- **[`physicalInvoiceDocument.ts`](src/lib/physicalInvoiceDocument.ts)** — **[`physicalInvoiceEmailSubject`](src/lib/physicalInvoiceDocument.ts)** uses the fixed pattern **`Click Plumbing Invoice [#…]`** (invoice number from the document, or **`#${hcp}`** when the display placeholder is **—**). **[`SendRecordInvoiceModal.tsx`](src/components/jobs/SendRecordInvoiceModal.tsx)** passes it as **`subject`** to **`send-physical-invoice-email`**.

---

## Latest Updates (v2.325)

**Date**: 2026-04-17

### **Bill Customer** — collapsible **Line on bill** / **Memo**; memo preset normalization; **physical invoice** email summary

- **[`SendRecordInvoiceModal.tsx`](src/components/jobs/SendRecordInvoiceModal.tsx)** — **Line on bill** and **Memo** are **disclosure** sections (**collapsed by default**) on **Stripe bill** and **Physical invoice** (same pattern as **Footer**). **HouseCall Pro** collapses **Memo** only. Shared **`lineOnBillSectionOpen`** / **`memoSectionOpen`** reset when the modal opens. Collapsed headers show a short summary (**[`billCustomerMemoSummaryLine`](src/lib/billCustomerMemoPresets.ts)**, truncated line-on-bill preview).
- **[`billCustomerMemoPresets.ts`](src/lib/billCustomerMemoPresets.ts)** — Preset bodies use **`capMemoBody`**: **[`normalizePhysicalInvoiceFooterPlainText`](src/lib/physicalInvoiceDocument.ts)** then length cap (same semantics as physical invoice footer). Read/save, custom presets, and **`billCustomerMemoActivePresetId`** compare **normalized** text so messy pastes still match the active preset chip.
- **[`physicalInvoiceDocument.ts`](src/lib/physicalInvoiceDocument.ts)** — **[`buildPhysicalInvoiceEmailBodies`](src/lib/physicalInvoiceDocument.ts)** (customer email with PDF): **detailed** summary no longer includes **Service date** or the former **Issuer** block (license/tagline section). **Issuer tagline** alone is included **bold** (`<strong>`) under the intro paragraph, before the metadata table, for both **detailed** and **simple** layouts when non-empty. PDF / preview unchanged as source of truth.

---

## Latest Updates (v2.324)

**Date**: 2026-04-17

### **Bill Customer** — **Physical invoice** Services rows match **Stripe** (proportional Specific Work)

- **[`physicalInvoiceFixtureScaling.ts`](src/lib/physicalInvoiceFixtureScaling.ts)** — Same **largest-remainder** cent allocation as Edge **`stripeInvoiceItemsFromFixtures`**; comment to keep in sync on changes.
- **[`resolvePhysicalInvoiceLinePresentation`](src/lib/physicalInvoiceLineItems.ts)** — **Materials** are summed first; the **service** portion (**bill − materials**) is split across billable fixtures when **line on bill** is blank (partial bills no longer collapse to one opaque line). **Non-empty line on bill** → one service line for the **full** invoice and **no** Materials rows (Stripe override parity). **[`SendRecordInvoiceModal.tsx`](src/components/jobs/SendRecordInvoiceModal.tsx)** passes **`physicalLineOnBillRaw`** from the same field as Stripe.

---

## Latest Updates (v2.323)

**Date**: 2026-04-17

### **Bill Customer** — **Physical invoice** detailed layout (job line items + payments)

- **[`physicalInvoiceLineItems.ts`](src/lib/physicalInvoiceLineItems.ts)** — Builds **Services** / **Materials** rows from **`jobs_ledger_fixtures`** / **`jobs_ledger_materials`** with the same **billable** rule as Stripe; **payment history** prefers **`jobs_ledger_payments.invoice_id`** when billing an invoice row. When fixture+material **subtotal** does not match the **bill amount** (±$0.02), the PDF uses **one synthetic service line** for the full amount so totals stay honest.
- **[`physicalInvoiceDocument.ts`](src/lib/physicalInvoiceDocument.ts)** — **`layout: detailed | simple`**; **`buildPhysicalInvoiceDocument`** accepts optional **`detailFromJob`**; **`PhysicalInvoiceIssuer`** from **[`physicalInvoiceIssuer.ts`](src/lib/physicalInvoiceIssuer.ts)** (localStorage). **[`buildPhysicalInvoiceEmailBodies`](src/lib/physicalInvoiceDocument.ts)** includes **Services** / **Materials** / **Payment history** in the HTML/text summary when **`layout === 'detailed'`** (PDF remains authoritative; **v2.325** trims some meta rows from the email and adds a bold **tagline**—see **Latest Updates (v2.325)**).
- **[`physicalInvoicePdf.ts`](src/lib/physicalInvoicePdf.ts)** — **Detailed** path: **INVOICE** header, narrative + meta column, issuer / service / contact blocks, **Services** & **Materials** tables, subtotal, **Payment history**, memo; **footer** + license on **page 2**; **`-- n of m --`** footers. **Simple** path unchanged for builds without job detail fetch.
- **[`SendRecordInvoiceModal.tsx`](src/components/jobs/SendRecordInvoiceModal.tsx)** — Reuses **`fetchJobWithDetailsById`** for **`billCustomerJobDetails`**; extends **`JobBillingContext`** with **`job_address`**, **`customer_phone`**, **`last_work_date`**. **[`Jobs.tsx`](src/pages/Jobs.tsx)**, **[`Dashboard.tsx`](src/pages/Dashboard.tsx)** (invoice join + job load select), **[`JobFormModal.tsx`](src/components/jobs/JobFormModal.tsx)** pass through.
- **[`PhysicalInvoiceIssuerDevSettingsBlock.tsx`](src/components/settings/PhysicalInvoiceIssuerDevSettingsBlock.tsx)** — Dev **Settings → Templates & testing**: company name, address, phone, email, tagline, license line for PDF header / page 2.

---

## Latest Updates (v2.322)

**Date**: 2026-04-16

### **Bill Customer** — **Physical invoice** emails **PDF** to customer

- **[`SendRecordInvoiceModal.tsx`](src/components/jobs/SendRecordInvoiceModal.tsx)** — **Physical invoice** tab: preview (matches PDF), line on bill / memo / invoice date / due date, **Send email**. **HouseCall Pro** tab unchanged (date, memo, Save). Client builds PDF via **`jspdf`** ([`physicalInvoicePdf.ts`](src/lib/physicalInvoicePdf.ts)) from the same document model as **[`PhysicalInvoicePreview`](src/components/jobs/PhysicalInvoicePreview.tsx)** ([`physicalInvoiceDocument.ts`](src/lib/physicalInvoiceDocument.ts)).
- **Edge [`send-physical-invoice-email`](supabase/functions/send-physical-invoice-email/index.ts)** — Validates JWT + RLS; verifies **`customer_email`** matches **`jobs_ledger.customer_email`**; **Resend** with attachment; then updates **`jobs_ledger_invoices`** (**`external_send_channel: physical`**). **`RESEND_API_KEY`**, **`verify_jwt = false`** in [`config.toml`](supabase/config.toml). **v2.366**: job **`billed`** promotion is **not** done here — **[`maybePromoteJobToBilledAfterCustomerInvoice`](src/lib/promoteJobToBilledIfFullyInvoiced.ts)** in **`SendRecordInvoiceModal`** runs after success for **Physical** (and **Stripe** / **HouseCall Pro**) so all channels stay consistent. Documented in **[`EDGE_FUNCTIONS.md`](EDGE_FUNCTIONS.md)**.

---

## Latest Updates (v2.321)

**Date**: 2026-04-16

### **Bill Customer** — **HouseCall Pro** and **Physical invoice** as **top tabs**

- **[`SendRecordInvoiceModal.tsx`](src/components/jobs/SendRecordInvoiceModal.tsx)** — Three primary tabs: **Stripe bill** | **HouseCall Pro** | **Physical invoice** (replaces **Outside bill** + nested channel toggles). Shared date/memo/Save form for the two external channels; **`external_send_channel`** unchanged (**`housecallpro`** / **`physical`**). Default tab when the job has no customer email remains **HouseCall Pro** (was first option under Outside bill).

---

## Latest Updates (v2.320)

**Date**: 2026-04-16

### **Jobs** — Legacy **`revenue`** into **Specific Work**; **Edit Job** break-off **slider** and **billing %** hint

- **Migration [`20260416182749_migrate_legacy_revenue_to_first_fixture.sql`](supabase/migrations/20260416182749_migrate_legacy_revenue_to_first_fixture.sql)** — One-time **data** backfill: jobs with **`jobs_ledger.revenue` > 0** and **no** named Specific Work extended dollars (`jobs_ledger_fixtures` with non-blank **`name`**, **`round(count × line_unit_price, 2)`** sum = 0) get **`line_unit_price`** on the **first** fixture row (by **`sequence_order`**, **`created_at`**, **`id`**) or a new row **`Job total (migrated)`** if none exist. **`jobs_ledger.revenue`** unchanged. Idempotent by eligibility. See **`MIGRATIONS.md`**.
- **[`JobFormModal.tsx`](src/components/jobs/JobFormModal.tsx)** — **Partial invoice** / **Break off Invoice** track: green thumb snaps to **5%** ticks while dragging (**`snapBreakOffCombinedPctToStep`**, **`BREAK_OFF_COMBINED_SLIDER_STEP_PCT`**); drag uses an **unsnapped** ref so small pointer moves accumulate (fixes “stuck” thumb). Muted **`N% of job total`** after **`+`** / **Ready to Bill** — **payments + draft amount** vs Job Total (same basis as the slider); **hidden** at **100%**. Keyboard / amount blur still snap to 5%.

---

## Latest Updates (v2.319)

**Date**: 2026-04-16

### **My Time** — **NCNS** when **scheduled** but **no clock sessions**

- **Migration [`20260416154325_ncns_when_scheduled_no_clock.sql`](supabase/migrations/20260416154325_ncns_when_scheduled_no_clock.sql)** — **`record_ncns_and_reject_sessions_for_day`**: zero sessions + **`job_schedule_blocks`** for assignee/day → insert **`attendance_incidents`** only (**`scheduled_without_clock`** in **`metadata`**); duplicate NCNS same day → error; no sessions and no schedule → **`No sessions or schedule for this day`**.
- **[`DashboardMyTimeDayEditorModal.tsx`](src/components/DashboardMyTimeDayEditorModal.tsx)** — Probes **`job_schedule_blocks`** for team NCNS; enables **NCNS** when sessions exist **or** schedule row exists; tooltips updated.

---

## Latest Updates (v2.318)

**Date**: 2026-04-16

### **My Time** — **Not coming in** confirmation **modal** (staff marking another user)

- **[`DashboardMyTimeDayEditorModal.tsx`](src/components/DashboardMyTimeDayEditorModal.tsx)** — **Not coming in** opens a stacked **`role="dialog"`** confirm (same copy as before) at **`zIndex: 1320`** above the day editor; **Cancel**, backdrop (when not busy), and **Escape** dismiss; **Mark not coming in** runs the existing **`onMarkNotComingIn`** path. Applies everywhere that control is used (e.g. Quickfill Schedule name/strip, Dashboard strip, Quickfill People Hours).

---

## Latest Updates (v2.317)

**Date**: 2026-04-16

### **Quickfill Schedule** — Roster grouped by **role** (People → Users order)

- **[`usersTabRosterRoleSections.ts`](src/lib/usersTabRosterRoleSections.ts)** — Canonical **`users.role`** section order and labels (Master Technicians, Assistants, Primaries, Estimators, Superintendents, Subcontractors, Devs); **`groupRosterUsersByAuthRoleSection`** buckets the visible list; unknown roles → trailing **Other**.
- **[`QuickfillScheduleSection.tsx`](src/components/quickfill/QuickfillScheduleSection.tsx)** — After search and “Hide assistants and estimators”, rows render under **`h2`** sections with a single shared time-scale header; **`section`** + **`aria-labelledby`** per group.

---

## Latest Updates (v2.316)

**Date**: 2026-04-16

### **Dashboard** — No **My Time** / strip editor when day is **Correct** (People → Hours)

- **`hours_days_correct`** — Migration **`20260416062502_hours_days_correct_authenticated_select.sql`**: **`SELECT`** for **`authenticated`** (read-only); insert/delete still pay-approved master / assistant only.
- **[`Dashboard.tsx`](src/pages/Dashboard.tsx)** — Loads correct **`work_date`** keys for this week, last week, strip **`clockStripWorkDateYmd`**, and today; **Edit time** on the clock strip and **View today’s time** show a warning toast and do not open **[`DashboardMyTimeDayEditorModal`](src/components/DashboardMyTimeDayEditorModal.tsx)** when that date is marked correct. Strip modal **`dateStr`** matches **`clockStripWorkDateYmd`** (and clock preview uses **`denverCalendarDayKey`** for today).
- **[`DashboardMyTimeSection.tsx`](src/components/DashboardMyTimeSection.tsx)** — **This week** day cells for correct days are not interactive; if the modal was open and the day becomes correct, it closes.
- **Ops / payroll:** Apply migration; QA mark **Correct** on a day, confirm Dashboard cannot open My Time for that **`work_date`** until unmarked.

---

## Latest Updates (v2.315)

**Date**: 2026-04-16

### **My Time** — Cross-row **merge** when rows differ by punch vs salary (affine partition)

- **Merge up / Merge down** can collapse a contiguous multi-row cluster into **one** segment even when `origin` / `salary_segment_index` differ across rows. **Save** writes **per-row** `UPDATE`s (clock times + shared focus note); **job/bid per row are unchanged** on this path ([`partitionMixedClusterSingleSegmentToRowIntervals`](src/lib/myTimeMixedClusterSingleSegmentPartition.ts), [`mixedClusterSegmentsAllowPerRowPersist`](src/lib/myTimeDaySavePlan.ts), [`DashboardMyTimeDayEditorModal.tsx`](src/components/DashboardMyTimeDayEditorModal.tsx)).
- **Dashboard** My Time preview (`clockTimesReadOnly`): merges and this save path still apply; punch-only actions (adjust times, force clock-out, etc.) stay disabled.
- **After save**, if any row in that persist path was **`salary_schedule`**, an **info** toast notes that **salary template sync** may later adjust auto salary rows—see [`SALARY_CLOCK_SESSIONS.md`](SALARY_CLOCK_SESSIONS.md) (**My Time: cross-row merge**).
- **Ops / payroll:** No migration; QA mixed cluster (salary row + punch row), merge, save, verify DB seams; spot-check approved-session confirm when times change.

---

## Latest Updates (v2.314)

**Date**: 2026-04-16

### **Documents** (`/documents`) — **Jobs** ledger, **+** add links, search and header layout

- **Tabs** — **Estimates**, **Bid proposals**, **Jobs**, **Upload** (placeholder). URL **`?tab=`**: `estimates`, `bid-proposals`, `jobs`, `upload` ([`documentsPageTab.ts`](src/lib/documentsPageTab.ts); dashboard pins: [`pinnedTabs.ts`](src/lib/pinnedTabs.ts)).
- **Ledgers** — Shared columns **Docs | Title | Job | Customer | Status | Total**. **Estimates**: doc icons + modals for **sent** / **customer_accepted**; **Bid proposals**: submission + project folder links, service-type chip, lost bids hidden unless searching; **Jobs**: `jobs_ledger` list, **Job Files** from **`google_drive_link`**, title links to **`/jobs?edit=`**, status via [`jobsLedgerStatusPipeline.ts`](src/lib/jobsLedgerStatusPipeline.ts) ([`Documents.tsx`](src/pages/Documents.tsx)).
- **Docs “+”** — When a link is missing, soft **+** opens [`DocumentsAddDriveLinkModal`](src/components/documents/DocumentsAddDriveLinkModal.tsx): https URL, **Check link** ([`checkGoogleDriveAttachmentUrl`](src/lib/checkGoogleDriveAttachmentUrl.ts) → Edge **`check-estimate-attachment-url`**), **Save** updates **`estimates.customer_attachment_url`** (**draft** only, with row check), **`bids.bid_submission_link`** / **`drive_link`**, or **`jobs_ledger.google_drive_link`**.
- **Search** — Full width of the page column; no visible **Search** label (`aria-label` on inputs).
- **Header** — No visible **Documents** title; visually hidden **`h1`**; reduced top padding so tabs sit just under the app nav ([`Documents.tsx`](src/pages/Documents.tsx)).

---

## Latest Updates (v2.313)

**Date**: 2026-04-16

### **Stripe** lines from job **Specific Work**; Edit Job **Stripe length** hint; **Bill Customer** defaults

- **Edge** — **[`create-stripe-invoice`](supabase/functions/create-stripe-invoice/index.ts)** and **[`preview-stripe-invoice`](supabase/functions/preview-stripe-invoice/index.ts)** load **`jobs_ledger_fixtures`** for the invoice’s job. With **billable** rows (non-empty trimmed **`name`**, **`count × line_unit_price` > 0**) and **no** non-empty body **`line_description`** (Bill Customer “Line on bill” override), they create **one** Stripe invoice line per fixture row (ordered by **`sequence_order`**), descriptions from **`name`** + optional **` — `** + trimmed **`line_description`** (scope), cent amounts **scaled proportionally** to **`amount_dollars`** when the bill is below the fixture subtotal. Shared builder: [`stripeInvoiceItemsFromFixtures.ts`](supabase/functions/_shared/stripeInvoiceItemsFromFixtures.ts). Non-empty body **`line_description`** forces the legacy **single** Stripe line for the full amount.
- **Bill Customer** ([`SendRecordInvoiceModal.tsx`](src/components/jobs/SendRecordInvoiceModal.tsx)) — **Line on bill** starts **empty** after fixtures load when the job has billable Specific Work so preview/create omit the override and use multi-line items; otherwise the default line text is restored. Hint when billable: custom text replaces separate Stripe lines from Specific Work; leave blank for one line per row.
- **Edit Job** ([`JobFormModal.tsx`](src/components/jobs/JobFormModal.tsx)) — Under each Specific Work line: **`(n / 500) · name and optional scope for Stripe`** using [`stripeInvoiceFixtureLineLength`](src/lib/stripeInvoiceLineDescription.ts) (same trim + separator rule as Edge); **warning** color when **n > 500**. Visible **Description** label removed; **Add scope or notes** discloses the scope **`textarea`** with a visually hidden label + **`aria-describedby`** to the length line.

---

## Latest Updates (v2.312)

**Date**: 2026-04-15

### Jobs **Specific Work** — **Unit price** + **Description** per fixture row

- **Schema** — Migration **`20260415222916_add_jobs_ledger_fixtures_unit_price_description.sql`**: **`jobs_ledger_fixtures.line_unit_price`** (**`numeric(12,2)`** nullable), **`line_description`** (**`text`** nullable). Optional scope/pricing per line; **not** **`jobs_ledger.revenue`**. Per-row **`line_description`** is **scope** text on that row’s Stripe invoice line when **multi-line Specific Work** billing runs (v2.313); it is **not** the Bill Customer modal’s single-line **`line_description`** body field.
- **New/Edit Job** ([`JobFormModal.tsx`](src/components/jobs/JobFormModal.tsx)) — Specific Work: **3-column** table; first row **Line item**, **Count**, third cell **Unit price** + **+** / remove (**flex**, tight gap); second row scope notes (**`textarea`**, **`colSpan` 3**); save/reload via existing delete-all + insert pattern. (v2.313: collapsible scope + Stripe length line — see above.)
- **Job Detail** ([`DetailJobModal.tsx`](src/components/jobs/DetailJobModal.tsx)) — **`@ $… ea.`** when unit price set; description on a second line.
- **Billing grid** ([`Jobs.tsx`](src/pages/Jobs.tsx)) — **Specific Work** column includes unit price and description lines when set.

---

## Latest Updates (v2.311)

**Date**: 2026-04-15

### Bids **Pricing** — price book **New entry** / **Edit entry** modal ([`Bids.tsx`](src/pages/Bids.tsx))

- **Rough In**, **Top Out**, **Trim Set**, and **Total** number inputs use **`step={0.01}`** (was **`step={1}`**) so values like **5.54** pass HTML5 constraint validation; DB columns were already **`numeric(10,2)`**.
- Editable stage fields use **`inputMode="decimal"`** for mobile decimal entry.

---

## Latest Updates (v2.310)

**Date**: 2026-04-15

### Quickfill — **Schedule**, **Office**, **inbox sections**, **`DispatchAddBlockTimeRange`**

- **Schedule** ([`QuickfillScheduleSection.tsx`](src/components/quickfill/QuickfillScheduleSection.tsx), [`Quickfill.tsx`](src/pages/Quickfill.tsx)) — Section header **omits** the **N open** line and **Mark history** icon (**`QuickfillSectionWrapper`** **`showOutstandingInHeader={false}`** **`showMarkHistoryButton={false}`** on the **`schedule`** case only). **`useReportQuickfillSectionMetric('schedule', null, false)`** so **`quickfill_section_mark_events.outstanding_count`** is not filled with the old “roster users with no blocks” number. **Conflicts** prompt (*Are there any obvious schedule conflicts?*) is a **centered amber** callout (`role="note"`).
- **Timeline** ([`DispatchAddBlockTimeRange.tsx`](src/components/schedule/DispatchAddBlockTimeRange.tsx)) — **Secondary** (clock session) bands use the same **bar height** and **label font size** as **occupied** (schedule block) bands; shared constants **`DISPATCH_TIMELINE_STRIP_BAR_HEIGHT_PX`** / **`DISPATCH_TIMELINE_STRIP_LABEL_FONT_SIZE`**; **`SECONDARY_STRIP_EXTRA_BASE_PX`** and **`trackH`** math updated so nothing clips.
- **Office Arriving / Office Leaving** ([`QuickfillOfficeSection.tsx`](src/components/quickfill/QuickfillOfficeSection.tsx)) — **Dev** **Edit checklist** / **Done editing** for **both** variants (separate **`localStorage`** keys per variant); default off: normal checklist; on: drag reorder, **Remove**, dev add panel. Checklist rows **`alignItems: 'center'`** (checkbox inline with label). **Edit checklist** control **right-aligned** (**`justifyContent: 'flex-end'`**).
- **Email / Texts / Physical inbox** — Outer **`section`** **grey border** removed ([`QuickfillEmailInboxSection.tsx`](src/components/quickfill/QuickfillEmailInboxSection.tsx), [`QuickfillTextsSection.tsx`](src/components/quickfill/QuickfillTextsSection.tsx), [`QuickfillPhysicalInboxSection.tsx`](src/components/quickfill/QuickfillPhysicalInboxSection.tsx)). **Email** / **Texts** use one **intro row**: *Open Gmail \| Still in inbox - …* / *Open SMS \| Still to text - …* (flex wrap; **`id`** preserved for **`aria-describedby`**).
- **Stale tally follow-up → Assign to jobs** ([`MercuryTransactionAllocationsModal.tsx`](src/components/MercuryTransactionAllocationsModal.tsx), [`DashboardStaleTallyStaffFollowUpModal.tsx`](src/components/DashboardStaleTallyStaffFollowUpModal.tsx)) — Split-line **seed** **`useEffect`** depends on **`open`**, **`transaction?.id`**, **`initialUserId`** only (not unstable **`transaction`** / **`initialAllocations`** / **`jobLabelById`** refs), so typing in **job splits** is not reset every parent re-render; stale modal memoizes **`parseTallyJobSplitsJson`** and uses **`EMPTY_JOB_LABEL_BY_ID`**.

---

## Latest Updates (v2.309)

**Date**: 2026-04-15

### Quickfill **Physical inbox** ([`QuickfillPhysicalInboxSection.tsx`](src/components/quickfill/QuickfillPhysicalInboxSection.tsx), [`Quickfill.tsx`](src/pages/Quickfill.tsx))

- **Section** — **`physical-inbox`** in **`SECTIONS`** (after **Texts**, before **Office Leaving**); same chrome as **Email** / **Texts** (**`omitDefaultMarkButton`**, inner **Mark Physical inbox up to date!**).
- **Prompts** — Physical inbox clarity + reminder to add tasks for items that cannot be cleared quickly.
- **Actions** — Inline **Task Dispatch**, **Estimator Inbox**, and **Task** icon buttons (same colors and modal hooks as [`Layout.tsx`](src/components/Layout.tsx): **`useDispatchTaskModal`**, **`useEstimatorTaskModal`**, **`useChecklistAddModal`**); role gates match the header (**Task**: dev / master_technician / assistant / primary / estimator; **Dispatch** + **Estimator**: dev / master_technician / assistant / estimator).
- **Note + mark** — Textarea (**Still in physical inbox**); empty mark → warning toast; **`markSectionUpToDate('physical-inbox', { noteText })`** → **`quickfill_section_marks`** / **`quickfill_section_mark_events`** (no migration; **`section_id`** is free text).
- **Metric** — **`useReportQuickfillSectionMetric('physical-inbox', …)`** (line count from textarea).

### Schedule Dispatch hub — **Day** tab ([`ScheduleDispatchHub.tsx`](src/components/schedule/ScheduleDispatchHub.tsx), [`ScheduleDispatch.tsx`](src/pages/ScheduleDispatch.tsx))

- **Tabs** — **People** | **Jobs** | **Day**; URL **`hubTab=people|jobs|day`**.
- **Day** — Renders **[`QuickfillScheduleSection`](src/components/quickfill/QuickfillScheduleSection.tsx)** (read-only day timeline) inside the hub.
- **URL** — Optional **`day=YYYY-MM-DD`** (Chicago calendar day): column tint + scroll on **People** / **Jobs**; **Dispatch** link from Quickfill Schedule includes **`week`** + **`day`** (and **`jobId`** when opening from an occupied band).

---

## Latest Updates (v2.308)

**Date**: 2026-04-15

### Quickfill **Schedule** — hide assistants and estimators (`scheduleDispatchHub.ts`, `QuickfillScheduleSection.tsx`)

- **`fetchUsersTabRosterForScheduleDispatchHub`** — same hub cohort as **`fetchUsersTabUserIdsForScheduleDispatchHub`** with **`id`** + **`role`**; Quickfill loads roster via this helper; blocks still fetched for the **full** id list.
- **Toggle** — **Hide assistants and estimators** (`aria-pressed`, **`localStorage`** **`quickfill_schedule_hide_assistant_estimator`**); **`rosterFilteredUsers`** then search; empty copy when everyone is filtered out; section **metric** unchanged (full **`sortedUsers`**).

---

## Latest Updates (v2.307)

**Date**: 2026-04-15

### Quickfill **Schedule** — search by person or job (`QuickfillScheduleSection.tsx`)

- **`type="search"`** above day nav; **`filteredSortedUsers`** — case-insensitive substring on display name or any block’s hub job title (**`jobTitleById.get(job_id) ?? formatScheduleDispatchHubJobTitle(null, null)`**); **Clear** when non-empty; **No people match this search.** when the roster is non-empty but the filter matches nobody. Section **metric** unchanged (roster users with no blocks that day).

---

## Latest Updates (v2.306)

**Date**: 2026-04-15

### Quickfill **Schedule** — per-person day timeline (`QuickfillScheduleSection.tsx`, `Quickfill.tsx`)

- **Section** — **`schedule`** in **`SECTIONS`** (after **Dispatch inbox**): roster from **`fetchUsersTabUserIdsForScheduleDispatchHub`**, batched **`fetchScheduleBlocksForAssigneesOnDay`**, job labels from **`fetchJobsLedgerForScheduleDispatchHub`**; each row uses **`DispatchAddBlockTimeRange`** (**`compact`**, **`disabled`**) with **`occupiedBands`** and default thumb span from **`defaultNewBlockRangeInFirstGap`** (else **08:00–12:00**).
- **Day nav** — Previous / Next / Today; company calendar copy via **`denverCalendarDayKey`** / **`formatDenverCalendarDayWithWeekdayAndYear`**.
- **Link** — **`/schedule-dispatch?week=`** Sunday (**`companyWeekStartSundayContaining`**) for the selected day.
- **Visibility** — **`sectionWouldRenderOnPage`**: **`dev`**, **`master_technician`**, **`assistant`**, **`superintendent`** (same gate as Schedule Dispatch).
- **Metric** — **`useReportQuickfillSectionMetric('schedule', …)`**: count of roster users with **no** blocks that day.
- **Realtime** — **`job_schedule_blocks`** changes for the selected **`work_date`** refetch the section.

---

## Latest Updates (v2.305)

**Date**: 2026-04-15

### Jobs **Sub Labor** — New / Edit modal UX (`Jobs.tsx`)

- **Search for crew** — Centered search field; no separate label above the box (**placeholder** + **`aria-label`**). When the search string is non-empty, **External Subs**, **Internal Subs**, and **Office Team** each render only if that group has at least one name match; if all three are empty, a single muted line **No crew match this search** appears (no per-section empty chrome).
- **Add Sub** — External list action and add-person modal title use the short label **Add Sub** (was **Add Subcontractor**).
- **Specific Work (Line Items)** — **Add line item** sits **below** the bordered table. **Itemize hours and rate** (totals row checkbox) uses a **muted grey** label (**`#6b7280`**).
- **Internal Subs** / **Office Team** — Collapse headers are **full-width**; when **collapsed** (**▶**), the triangle + title are **centered**; when **expanded** (**▼**), the header aligns **left** above the checkbox list.
- **Modal footer** — Primary actions on the **right**, order **Cancel** → **Print** → **Save** → (**Required:** missing-field list when Save is disabled, immediately **right of Save**) → **Delete** (when editing an existing job).

---

## Latest Updates (v2.304)

**Date**: 2026-04-14

### **Send Email invoice from Stripe?** — recent sends in confirm modal

- **DB** — [`20260414064105_jobs_ledger_invoice_stripe_email_sends.sql`](supabase/migrations/20260414064105_jobs_ledger_invoice_stripe_email_sends.sql): **`jobs_ledger_invoice_stripe_email_sends`** append-only rows (**`sent_at`**, **`stripe_invoice_id`**); **SELECT** RLS matches **`jobs_ledger_invoices`** job visibility.
- **Edge** — [`send-stripe-invoice`](supabase/functions/send-stripe-invoice/index.ts): after successful **`jobs_ledger_invoices`** update, **INSERT** log row (failure **logs only**; send still **200**).
- **UI** — [`StripeInvoiceSendFromStripeButton.tsx`](src/components/jobs/StripeInvoiceSendFromStripeButton.tsx): on modal open, **`withSupabaseRetry`** loads up to **20** sends; **Most recent sends (PipeTooling)** list (**`getDispatchNoteDisplayMeta`**, Chicago); empty state + optional **`recordedLastSendAt`** fallback when log has no rows (pre-log **sends**); wider dialog (**480px**). **`recordedLastSendAt`** passed from [`Jobs.tsx`](src/pages/Jobs.tsx) Stages resend, [`HostedStripeBillPanel.tsx`](src/components/jobs/HostedStripeBillPanel.tsx).

---

## Latest Updates (v2.303)

**Date**: 2026-04-14

### Jobs **Stages** — **Last activity**: Stripe send hint + resend

- **When it shows** — [`stagesJobLevelStripeEmailedHintInvoice`](src/pages/Jobs.tsx): exactly **one** **billed** line per job with **`external_send_channel === 'stripe'`**, non-empty **`stripe_invoice_id`**, and **`sent_to_customer_at`** set (ambiguous multi-line jobs omit the block).
- **UI** — [`renderStagesStripeEmailedCustomerHint`](src/pages/Jobs.tsx): three centered lines — **Stripe emailed customer**; Central Time + days-ago from [`getDispatchNoteDisplayMeta`](src/utils/dispatchNoteDisplay.ts); **[`StripeInvoiceSendFromStripeButton`](src/components/jobs/StripeInvoiceSendFromStripeButton.tsx)** with **`buttonLabel="Resend invoice email"`**, **`micro`**, **`unboxed`**, **`hideInlineSuccessLine`** (success toast only; avoids duplicating the hint), **`sendDisabled`** when **`stripe_invoice_status`** is **paid** (tooltip explains Stripe will not resend). Same Edge **`send-stripe-invoice`** path and confirm modal as **Send Email invoice from Stripe** elsewhere (**[`HostedStripeBillPanel`](src/components/jobs/HostedStripeBillPanel.tsx)**, **`SendRecordInvoiceModal`**). **`onSent`** → **`loadJobs()`** so **`sent_to_customer_at`** refreshes.
- **Shared button** — Optional props: **`buttonLabel`**, **`unboxed`**, **`micro`** (tiny inline control), **`sendDisabled`** / **`sendDisabledTitle`**, **`hideInlineSuccessLine`**, **`stripeModeForBilling`** via [`stripeModeForBillingFromRole`](src/lib/voidStripeInvoiceForRevert.ts) on Stages.
- **Data note** — **`jobs_ledger_invoices.sent_to_customer_at`** stores the **latest** send only (each **`send-stripe-invoice`** success overwrites it). Per-send history for the confirm modal lives in **`jobs_ledger_invoice_stripe_email_sends`** ([v2.304](#latest-updates-v2304)).

---

## Latest Updates (v2.302)

**Date**: 2026-04-14

### Jobs **Stages** — Ready to Bill amounts and section total

- **Lib** — [`jobsStagesBoard.ts`](src/lib/jobsStagesBoard.ts): **`jobBillingUnallocatedDollars`**, **`readyToBillRowsExposureTotal`** (aligned with **`ensure_single_ready_to_bill_invoice_for_job`** allocation).
- **UI** — [`Jobs.tsx`](src/pages/Jobs.tsx) **`renderUnifiedStagesTable`**: bare job row middle line = **unallocated** (tooltip); standalone RTB invoice row = **draft** + optional **unallocated** subline; primary bundle middle line = **remainder**; section header total uses exposure sum (no gross + draft double-count).
- **Tests** — [`jobsStagesBoard.test.ts`](src/lib/jobsStagesBoard.test.ts): **`readyToBillRowsExposureTotal`** cases.

---

## Latest Updates (v2.301)

**Date**: 2026-04-14

### Partial **Ready to Bill** — remainder line + fixed partial amounts

- **DB** — [`20260414031557_ensure_rtb_primary_remainder_and_partials.sql`](supabase/migrations/20260414031557_ensure_rtb_primary_remainder_and_partials.sql): **`ensure_single_ready_to_bill_invoice_for_job`** allows multiple **`ready_to_bill`** rows; syncs **`amount`** only on **`is_primary_rtb_bundle = true`**; inserts that row when missing and **`v_unalloc` &gt; 0**; errors if more than one primary; does not change partial rows.
- **Client** — [`Jobs.tsx`](src/pages/Jobs.tsx) **Create Partial Invoice** and [`JobFormModal.tsx`](src/components/jobs/JobFormModal.tsx) **Partial invoice**: inserts with **`is_primary_rtb_bundle: false`**, then **`ensure_single_ready_to_bill_invoice_for_job`** (with **`withSupabaseRetry`**); removed “first RTB line becomes primary” behavior so partials are never overwritten.
- **Dashboard** — [`buildReadyToBillDashboardUnits`](src/lib/buildReadyToBillDashboardUnits.ts) already prefers **`is_primary_rtb_bundle`**; test covers **job_bundle** + standalone **invoice** for primary + partial.
- **Manual QA** — (1) Job RTB: add partial $X → two rows, partial fixed, primary remainder = unallocated balance; **Bill Customer** from job bills primary only. (2) Stages: job row + separate row for partial. (3) Legacy single primary RTB: **ensure** still updates amount. (4) Duplicate **`is_primary_rtb_bundle`** on two rows → RPC error until data fixed.

---

## Latest Updates (v2.300)

**Date**: 2026-04-13

### **Billed** send back — void Stripe invoice + clear billing row

- **Edge** — [`void-stripe-invoice-for-revert`](supabase/functions/void-stripe-invoice-for-revert/index.ts): for **`jobs_ledger_invoices`** in **billed** with Stripe, **delete** draft / **void** open (unpaid) in Stripe, then **UPDATE** to **ready_to_bill** and null Stripe columns. **409** if paid / **`amount_paid` &gt; 0**. Idempotent if Stripe invoice already missing.
- **Client** — [`voidStripeInvoiceForRevert.ts`](src/lib/voidStripeInvoiceForRevert.ts): **`prepareBilledInvoicesBeforeJobRevertToReadyToBill`** before **`update_job_status`** (**billed** → **ready_to_bill**) on Jobs + Dashboard. Invoice-line send back / ham mode use the same Edge path when **`stripe_invoice_id`** or **`external_send_channel === 'stripe'`**.
- **Docs** — [`EDGE_FUNCTIONS.md`](EDGE_FUNCTIONS.md) **void-stripe-invoice-for-revert**; [`supabase/config.toml`](supabase/config.toml) **`verify_jwt = false`**.

---

## Latest Updates (v2.299)

**Date**: 2026-04-13

### Public **Estimate accept** — Sign-In landing + boxed content

- **UI** — [`EstimateAccept.tsx`](src/pages/EstimateAccept.tsx): [`AuthPublicLandingLayout`](src/components/AuthPublicLandingLayout.tsx) for loading, error, interactive body, and thank-you (same hero/header/icons as `/sign-in`). Content sits in **`auth-public-landing__signin-box`** inside **`auth-public-landing__signin-stack--wide`** (640px). Staff/in-app flows using [`EstimateAcceptBody`](src/components/estimates/EstimateAcceptBody.tsx) / [`EstimateCustomerThankYou`](src/components/estimates/EstimateCustomerThankYou.tsx) unchanged.
- **CSS** — [`authPublicLanding.css`](src/components/authPublicLanding.css): **`.auth-public-landing__signin-stack--wide`**; **`.auth-public-landing__estimate-thankyou-inner`** strips redundant outer padding on thank-you when nested in the card.

---

## Latest Updates (v2.298)

**Date**: 2026-04-13

### Estimators — **Customers** page (limited edit, no Advanced / delete)

- **Routing** — [`Layout.tsx`](src/components/Layout.tsx) and [`layoutRouteAccess.ts`](src/lib/layoutRouteAccess.ts): `/customers` on estimator allowlist (no redirect to `/bids`). [`Dashboard.tsx`](src/pages/Dashboard.tsx) pinned-path set includes `/customers`. Estimator nav: **Customers** link next to Bids.
- **DB** — Migration [`20260413194354_estimator_customers_update_safe.sql`](supabase/migrations/20260413194354_estimator_customers_update_safe.sql): policy **Estimators can update customers**; **`BEFORE UPDATE`** trigger **`customers_estimator_update_immutable_fields`** calls **`enforce_customers_estimator_update_immutable_fields`** to block **`master_user_id`** or **`stripe_customer_id`** changes when the caller is an estimator.
- **Client** — [`EditCustomerForm.tsx`](src/components/EditCustomerForm.tsx): estimators do not send **`master_user_id`** on update (defense in depth). UI already hides Advanced, merge, and delete for estimators.
- **Docs / Settings** — [`ACCESS_CONTROL.md`](ACCESS_CONTROL.md) matrices and estimator section; Settings **PAGE_ACCESS** Customers row: estimator **yes limited**.

---

## Latest Updates (v2.297)

**Date**: 2026-04-13

### People **Hours** — grid blur **proportional** session scale in **My Time**

- **Behavior** — Entering a new total in the matrix and blurring opens **[`DashboardMyTimeDayEditorModal`](src/components/DashboardMyTimeDayEditorModal.tsx)** with that day’s **closed** `clock_sessions` **scaled** so each segment keeps the same **share** of the previous total (e.g. 2h + 6h → enter 4h →1h + 3h). Segments are **packed contiguously** from the **original** clock-in of the **earliest** session. Durations use **integer ms** with **largest-remainder** so the sum matches the entered hours and each segment stays at least **[`MIN_SEGMENT_MS`](src/lib/myTimeDayTimeline.ts)** when physically possible.
- **Open session** — If any session that day has no `clocked_out_at`, **no** proportional seed: **info** toast and the usual **fetch** My Time modal (**[`hoursMyTimeEditor`](src/pages/People.tsx)** with `sessions={[]}`).
- **Fallback** — No closed sessions (or target too small for min segment count) → same **single draft** block as v2.291 ([`buildPeopleHoursManualDraftSession`](src/lib/peopleHoursManualDraftSession.ts)).
- **Labels** — Job/bid labels for the modal are filled from list row embeds when scaling ([`buildJobBidLabelMapsFromClockRows`](src/lib/peopleHoursProportionalScale.ts)).
- **Manual QA** — (1) Two closed sessions 2h + 6h, enter 4h → 1h + 3h contiguous. (2) Single 8h → 4h. (3) No sessions → 8:00 draft. (4) One open session that day → toast + fetch editor. (5) Many tiny segments + low target → draft fallback if `n * MIN_SEGMENT_MS` exceeds target.
- **Fix** — After **Save** from this modal, **`people_hours`** was always cleared (`saveHours(0)`). That is correct for **draft-only** inserts (grid uses `max(people_hours, pending)`). For **real** sessions (proportional scale / edits to existing rows), **`people_hours`** is now set to the sum of **approved** closed session durations for that day (pending stays out of `people_hours`); see **`onSaved`** on **`hoursManualDraftEditor`** in [`People.tsx`](src/pages/People.tsx).
- **Fix** — **Close** on proportional seed saw **no dirty** clusters (initial snapshot matched scaled props), so nothing persisted. **`peopleHoursGridProportionalSeed`** on [`DashboardMyTimeDayEditorModal`](src/components/DashboardMyTimeDayEditorModal.tsx) forces persist of all clusters when **Close** would otherwise skip; set from [`People.tsx`](src/pages/People.tsx) when any session is not a draft id.
- **Fix** — After that, persist still used the **note-only** branch because `singleSegmentTimesMatchSession` compared **seeded** props to the split (both scaled), while **Postgres** still had old clock times—so **`people_hours`** sync read stale durations (e.g. ~10h vs modal 7h). When **`peopleHoursGridProportionalSeed`**, single-segment save now **`UPDATE`s `clocked_in_at` / `clocked_out_at`** (same fields as **Adjust times**); multi-row “boundaries unchanged” note-only path is skipped so **`leader_replace_clock_session_cluster_mixed`** runs instead.
- **Fix** — **Reject** in **My Time** called `UPDATE … WHERE id = …` with **`draft:people-hours:`** ids (not UUIDs). Draft blocks now show an **info** toast instead; **`confirmRejectSession`** no-ops for draft ids.

---

## Latest Updates (v2.296)

**Date**: 2026-04-13

### Schedule Dispatch — **Add schedule block** occupied timeline (job week + hub)

- **UX** — **[`AddBlockModal`](src/pages/ScheduleDispatch.tsx)** (add mode only): the time slider shows **this person’s other blocks that day** as orange **occupied** segments with **job title** (HCP · name) above each band. **Drag** a band (or **ArrowLeft** / **ArrowRight** on the band) to **draft** a new start/end for that block without saving yet. **Linked** rows (**`shared_block_group_id`**) on the same person-day move together (same as group edit semantics).
- **New block range** — Dual thumbs stay in **free gaps** between occupied intervals (4:00–20:00 Central, 30-minute steps). Opening the modal picks the **first gap** that fits the default duration (~4h) when possible, otherwise falls back to 08:00–12:00. You can still place the new block **before** existing blocks if a gap exists (not “must be after all blocks”).
- **Save** — **[`saveBlockModal`](src/pages/ScheduleDispatch.tsx)** (add path): validates **draft** times against overlap (`virtualDayBlocksForOverlap`, `scheduleHasInternalOverlap`, `scheduleOverlapsAny`); applies **`updateJobScheduleBlock`** / **`updateJobScheduleBlockGroup`** for moved rows (stop on first error); then **`insertJobScheduleBlock`** for the new assignment.
- **Code** — **[`scheduleDispatchAddBlockTimeline.ts`](src/lib/scheduleDispatchAddBlockTimeline.ts)** (gaps, clamp, segment drag); **[`DispatchAddBlockTimeRange.tsx`](src/components/schedule/DispatchAddBlockTimeRange.tsx)** (`occupiedBands`, `onOccupiedAbsoluteStart`).

---

## Latest Updates (v2.295)

**Date**: 2026-04-12

### Schedule Dispatch **hub** — **People** multi-cell add (**++**)

- **Toolbar** — **[`ScheduleDispatchHub.tsx`](src/components/schedule/ScheduleDispatchHub.tsx)** next to **+**: **++** toggles multi-select mode (amber active styling); clears placement, assign-job arm, single-cell picker context, **`placeJob`** URL.
- **Grid** — **[`HubPeopleDayCell`](src/components/schedule/ScheduleDispatchHub.tsx)**: click toggles selection (**[`hubPersonDayKey`](src/lib/scheduleDispatchHub.ts)** in a **`Set`**); selected cells amber border/background; **Esc** exits mode. Triangle **+** and empty-cell add are off while mode is on. **[`HubPeopleBlockCard`](src/components/schedule/ScheduleDispatchHub.tsx)** drag disabled during multi mode.
- **FAB** — **[`ScheduleDispatch.tsx`](src/pages/ScheduleDispatch.tsx)** fixed bottom **Choose job for multi-cell add** (count); opens **Add job to schedule** with **`hubAssignJobPickerIntent`** **`multi`**; row pick runs **`applyHubMultiCellJob`** (default **08:00–12:00**, overlap skip, summary toast). **Create new job** from picker applies the new job to all selected cells via the same bulk path.
- **Helpers** — **`parseHubPersonDayKey`** in **[`scheduleDispatchHub.ts`](src/lib/scheduleDispatchHub.ts)**. **`closeHubAssignJobPicker`** exits multi mode and clears selection.

---

## Latest Updates (v2.294)

**Date**: 2026-04-12

### Schedule Dispatch **hub** — **People** day cell: add another job for the same person and day

- **UX** — **[`HubPeopleDayCell`](src/components/schedule/ScheduleDispatchHub.tsx)** (`<td>`): when **`canEdit`**, the cell **has at least one block**, assign-job and copy/placement picking are off, a **single** **bottom-left** right-triangle control with **+** (**`position: absolute`**, **`left: 0`**, **`bottom: 0`**, **`zIndex: 6`**) opens **Add job to schedule** with the same **`hubCellAddContext`** as an empty cell (**[`ScheduleDispatch.tsx`](src/pages/ScheduleDispatch.tsx)** **`onHubAddJobToScheduleForCell`** → **`onHubEmptyCellOpenChoice`**), using the row **`personUserId`** and column **`workDate`**. The control **overlaps** block cards in the corner. Distinct **`aria-label` / `title`** from each block card’s bottom-right **+** (copy to another cell).

---

## Latest Updates (v2.293)

**Date**: 2026-04-12

### Schedule Dispatch **hub** — empty **People** cell opens **Add job to schedule** directly

- **UX** — **[`ScheduleDispatchHub.tsx`](src/components/schedule/ScheduleDispatchHub.tsx)** **`HubPeopleDayCell`**: when **`canEdit`**, the cell has no blocks, and placement / assign-job modes are off, click opens **Add job to schedule** immediately (**[`ScheduleDispatch.tsx`](src/pages/ScheduleDispatch.tsx)** **`onHubEmptyCellOpenChoice`**) with person + date subtitle; no separate **Add schedule block** choice modal.
- **Context** — **`hubCellAddContext`** stores **`assigneeUserId`** + **`work_date`**; picking or **Create new job** (picker header) calls **`openAddBlock`** or placement + toast as before. Toolbar **+** only opens the job list (no preset cell).
- **Picker** — **`closeHubAssignJobPicker`** clears context on cancel; row select branches on **`hubCellAddContext`**. **Add job to schedule** dialog header includes **Create new job** (**`onCreateNewJobFromHubJobPicker`**) — placement + toast when no cell context, or empty-cell **`openAddBlock`** when **`hubCellAddContext`** is set. Hub toolbar **New job** removed (use **+** then **Create new job**).

---

## Latest Updates (v2.292)

**Date**: 2026-04-12

### Dashboard **Clock In/Out** — **On schedule** job quick-picks (Schedule Dispatch)

- **Data** — **[`ClockInOutButton.tsx`](src/components/ClockInOutButton.tsx)**: Parallel load **`list_assigned_jobs_for_dashboard`** and **`fetchDispatchScheduledJobsForAssigneeDay`** (**[`jobScheduleBlocks.ts`](src/lib/jobScheduleBlocks.ts)**) for company-calendar **today** on **Clock In** and **Update Focus**, and for the **open session `work_date`** on **Review before clock out** ( **`OpenSession.work_date`** on the open-session select, with **`clocked_in_at`** fallback when null).
- **Dedupe** — Assigned jobs that already appear on the Dispatch schedule for that day are omitted from the default search dropdown list so each job shows once (**On schedule** block first).
- **UI** — Below **Use last**, bordered rows **On schedule:** + unified job label; optional **`windowsLabel`** as subtitle and **`title`**; click sets **`selectedAssociation`** like a search result and clears the search field.
- **Toast** — One-time info toast only when **both** the deduped assigned list and the schedule list are empty (copy mentions assignments and Dispatch schedule).

---

## Latest Updates (v2.291)

**Date**: 2026-04-12

### People **Hours** matrix — manual entry opens **My Time** with a **draft clock session** (no intermediate modal)

- **Blur flow** — **[`People.tsx`](src/pages/People.tsx)**: When an editable hours cell blurs with **hours &gt; 0**, the day is **not** marked **Correct**, and the user has pay/hours access, **`openManualHoursDraftFromBlur`** runs immediately (no **Save to grid vs My Time** modal). **`users.find`** matches roster **`person_name`** to **`users.name`** (trim).
- **No user match** — Toast explains hours are **saved to the grid only**; **`saveHours`** runs so the typed total is kept.
- **Draft session** — **[`peopleHoursManualDraftSession.ts`](src/lib/peopleHoursManualDraftSession.ts)**: **`buildPeopleHoursManualDraftSession`**: 8:00 AM wall (**`APP_CALENDAR_TZ`**) on **`work_date`**, duration from entered hours; id prefix **`draft:people-hours:`** + UUID; default notes so the day editor can save. Modal receives **`sessions={[draft]}`** (fetch skipped).
- **Persist** — **[`DashboardMyTimeDayEditorModal.tsx`](src/components/DashboardMyTimeDayEditorModal.tsx)**: **`persistDirtyChangesAsync`** **`INSERT`**s **`clock_sessions`** for draft ids; splitting a draft before first save is blocked with a clear error.
- **After successful draft save** — **`onSaved`** in People calls **`saveHours(personName, work_date, 0)`** so stale **`people_hours`** does not stack with **`approve_clock_sessions`** (RPC **adds** session hours onto existing grid totals). Then refresh clock + **`people_hours`** lists.
- **Grid display** — **`getHoursGridDisplayHours`**: **`max(people_hours, sum of closed pending clock hours)`** for the matrix so cells do not show **0** while a session is pending approval.
- **NCNS** — The **manual-draft** **`DashboardMyTimeDayEditorModal`** instance sets **`allowNcnsFromMyTime={false}`** so **NCNS** is hidden for this entry path; opening My Time from a clock session row (**`hoursMyTimeEditor`**) still uses the role-based NCNS flag.

---

## Latest Updates (v2.290)

**Date**: 2026-04-12

### People — dev-only **Feedback** tab (`?tab=feedback`); **Team feedback** UX parity with Settings

- **Route** — **[`People.tsx`](src/pages/People.tsx)**: **`PeopleTab`** includes **`feedback`**; dev-only tab after **Review**; renders **[`TeamFeedbackDevSettingsBlock`](src/components/team-feedback/TeamFeedbackDevSettingsBlock.tsx)** with **`layout="standalone"`** (same admin surface as **Settings → People & accounts**).
- **Header** — **Enabled** toggles **`team_feedback_settings.enabled`** (and **`updated_at`**) via Supabase update + **`withSupabaseRetry`** so the switch persists across reloads. **Last collected** and **Settings** (opens modal) sit on the right.
- **Modals** — **Settings**: full **[`TeamFeedbackSettingsSection`](src/components/team-feedback/TeamFeedbackSettingsSection.tsx)** in a portal (**`hideEnabled`** in modal). **Eligibility**: **[`TeamFeedbackEligibilityOverview`](src/components/team-feedback/TeamFeedbackEligibilityOverview.tsx)** — **Eligibility** button opens overview + per-user **Reset** in a portal. **Raw submissions**: **[`TeamFeedbackDevReports`](src/components/team-feedback/TeamFeedbackDevReports.tsx)** — row click opens **`TeamFeedbackSubmissionDetailModal`** (same file; Q&A, long-form, peer ratings from **`team_feedback_peer_ratings`**); dev row delete (existing RLS); **Refresh** top-right; **Include reviewer_user_id** + **Download CSV** bottom-right.

---

## Latest Updates (v2.289)

**Date**: 2026-04-12

### Dashboard **My Time** / **Edit time** — overlapping clusters split per session; Form/Visual chrome; prior-week gate; Quickfill **People Hours (new)** mobile nav

- **Timeline clustering** — **[`myTimeDayTimeline.ts`](src/lib/myTimeDayTimeline.ts)**: optional **`splitClustersWithPairwiseOverlap`** on **`buildDayTimeline`** (same rule as **`hasPairwiseClockIntervalOverlap`** / **`CLUSTER_CONTIGUITY_EPS_MS`**) so structurally overlapping sessions never share one strip/card; **`expandClustersSplitPairwiseOverlaps`** + **`getNextSessionClusterInTimeline`** drive list expansion and Form **overlap** divider hints. Modal seeds and tick refresh use the same expansion (**[`DashboardMyTimeDayEditorModal.tsx`](src/components/DashboardMyTimeDayEditorModal.tsx)**).
- **Form** — **[`MyTimeDayClusterForm.tsx`](src/components/my-time-day-editor/MyTimeDayClusterForm.tsx)**: block header one line **`Apr 8, 2026 | 8:00 AM – 4:00 PM`**; **time range + duration** on one line (like Visual), no separate **Span** label; long job labels **truncate** with ellipsis (**grid `minmax(0, …)`**, overflow rules in **`index.css`**); **Split** and **×** align **right** on narrow widths; job row can stack below **≤560px**. **Double** gray bottom border on a cluster when the **next** cluster **overlaps** (**`formOverlapDividerBelow`**); thicker **`#d1d5db`** separators between clusters (Form + **[`MyTimeDayClusterVisual.tsx`](src/components/my-time-day-editor/MyTimeDayClusterVisual.tsx)**). Segment divider styling in **`index.css`** (**.`myTimeDayClusterFormSegmentDivider`**).
- **Compact list** — **`myTimeDayTimelineScroll`**: no border / no radius on the session scroll area when **`myTimeCompactLayout`** (narrow modal).
- **Prior week** — Footer **Not coming in**, extra **Close**, and **NCNS** stay hidden on the **Editing a prior week** acknowledgment screen (**`priorWeekGateActive`**); **Cancel** / **Continue editing** and backdrop / Escape unchanged. Narrow title width when the Visual/Form header toggle is absent (**`desktopHeaderTitleNarrow`**).
- **Quickfill** — **[`QuickfillPeopleHoursNewSection.tsx`](src/components/quickfill/QuickfillPeopleHoursNewSection.tsx)**: at **≤640px**, day line1 = full date label; line 2 = **`Previous day | Next day | Today`** (pipes); desktop layout unchanged.

---

## Latest Updates (v2.288)

**Date**: 2026-04-12

### **Estimates** & **public accept** — accepted detail UX, thank-you, terms/footer, audit dedupe

- **[`Estimates.tsx`](src/pages/Estimates.tsx)** — **`customer_accepted`**: header shows **`# {estimate_number}`** + status only (no duplicate title); **For** / **Acceptance page logo** / **Line items** hidden (snapshot lives in the card); first block is a padded **[`EstimateCustomerDocument`](src/components/estimates/EstimateCustomerDocument.tsx)** + optional **`EstimateCustomerAttachmentCard`**; no standalone **Total**; **Customer:** name opens **[`CustomerSnapshotModal`](src/components/customers/CustomerSnapshotModal.tsx)**; order **Customer acceptance** → **`EstimateDetailCustomerActivitySection`** (**Customer activity**, collapsible, **default closed**) → **Job** (**centered** heading + actions); **Create job from estimate** uses primary blue (**`estimateDetailCreateJobButtonStyle`**). **`sent`**: **For** / logo / line items unchanged; **Customer activity** **default open**; activity block still before waiting copy.
- **DB / Edge** — **[`20260412184127_dedupe_record_estimate_public_link_view.sql`](supabase/migrations/20260412184127_dedupe_record_estimate_public_link_view.sql)**: **`record_estimate_public_link_view`** skips duplicate **same IP + UA** within **5s** (+ advisory lock). **[`EstimateAccept.tsx`](src/pages/EstimateAccept.tsx)** — **`AbortController`** on load to reduce double-fetch under React Strict Mode.
- **Thank you** — **[`EstimateCustomerThankYou.tsx`](src/components/estimates/EstimateCustomerThankYou.tsx)**: centered title + body; **`public/chick.png`** below; default body includes *We are excited to see you soon.*; **`import.meta.env.BASE_URL`** for asset path. Builtin + **[`20260412190051_update_estimate_thank_you_body_default.sql`](supabase/migrations/20260412190051_update_estimate_thank_you_body_default.sql)** update **`estimate_thank_you_body`** in **`app_settings`**.
- **Accept page chrome** — **[`EstimateTermsHeaderNotice.tsx`](src/components/estimates/EstimateTermsHeaderNotice.tsx)**: bottom line is linked **Terms and Conditions.** only (no “Please make sure to read our…”).
- **Footer tagline** — **`BUILTIN_ACCEPT_PAGE_FOOTER`** first line **Reliable service today…** (app + Edge **`estimateCustomerExperience`**); **[`20260412190601_update_estimate_accept_page_footer_tagline.sql`](supabase/migrations/20260412190601_update_estimate_accept_page_footer_tagline.sql)** updates **`estimate_accept_page_footer`** when the old plumbing line is present.

---

## Latest Updates (v2.287)

**Date**: 2026-04-12

### **Estimates** — **Accepted** quote snapshot (initial ship; layout refined in **v2.288**)

- Introduced read-only **accepted** snapshot above **Customer acceptance** using **`EstimateCustomerDocument`**. **v2.288** removes the **`<details>`** wrapper, reorders sections, and trims duplicate header fields.

---

## Latest Updates (v2.286)

**Date**: 2026-04-12

### Jobs **Stages** — **linked quote** in **Job** column (when `estimates.job_ledger_id` matches)

- **[`Jobs.tsx`](src/pages/Jobs.tsx)** — After **`loadJobs`** schedule batch, chunked **`estimates`** select by **`job_ledger_id`**; **`linkedEstimateForStages`** on **`JobWithDetails`**. **`renderStagesJobColumnEstimateFooter`**: subline at bottom of **Job** `<td>` (name / address / customer), link **`/estimates/{estimate_number}`**; **project** remains full-width **`renderStagesProjectBannerRow`** only; main row **`borderBottom`** follows project banner only. Standalone + unified Stages (job and invoice rows).
- **[`pickLinkedEstimateForStagesBanner.ts`](src/lib/pickLinkedEstimateForStagesBanner.ts)** — Prefer **`customer_accepted`** (newest **`updated_at`**, then higher **`estimate_number`**); else newest **`updated_at`**.
- **[`jobWithDetails.ts`](src/types/jobWithDetails.ts)** — **`JobLinkedEstimateForStages`**, **`linkedEstimateForStages`**.

---

## Latest Updates (v2.285)

**Date**: 2026-04-11

### Edit Job — **Billing**: **Outstanding billing** table; **Payments received** chrome; **Partial invoice** layout; **`StripeInvoiceSharePanel`** toolbar

- **[`JobFormModal.tsx`](src/components/jobs/JobFormModal.tsx)** — **Partial invoice** card (no **Partial invoice** title) sits **above** **Outstanding billing** (after **Ready to Bill** when present): **Make Invoice:** / **Create invoice** centered; gray helper *Break off an amount to send through Ready to Bill. Job stays in Working.* only (**Remaining (billable)** / **Use full remaining** hidden). **Outstanding billing** (billed invoices): columns **Date**, **Billed**, **Actions** (`table-layout: fixed`, spread columns). **Date**: [`formatWorkDateYmdMonthDayShort`](src/utils/dateUtils.ts) (e.g. **Apr 10**) plus **`(+n)`** from [`invoiceCreatedCalendarDayOffset`](src/lib/invoiceCreatedRelative.ts) (company calendar days since invoice **`created_at`**). **Actions**: **Stages**, **Bill** (opens View Bill when Stripe hosted invoice exists); **[`StripeInvoiceSharePanel`](src/components/jobs/StripeInvoiceSharePanel.tsx)** copy / SMS / email as compact **icons** in the same row (`omitPaymentLinksLabel`, `unboxed`, `inlineRow`); **Customer pay page** / **Open in Stripe** omitted (use **Bill**). **Outside send note** + **Stripe invoice memo**: optional **second table row**, full width (`colSpan` 3), default background (no gray “card”, no rule above the row). **Payments received**: section title **Payments received** (matches **Outstanding billing** `h4` + `overflow-x` wrapper); table columns **Date**, **Amount ($)**, **Memo**; gray **`thead`** only—body rows use default background; **Stripe-linked** payment rows: **blue left inset** only (not header-colored fill); **Record Payment** right-aligned; no divider rule between payments table and **Record Payment** block.
- **[`StripeInvoiceSharePanel.tsx`](src/components/jobs/StripeInvoiceSharePanel.tsx)** — **`inlineRow`**: no extra top margin / inner row stretch when icons sit beside sibling buttons; **compact** payment-link icons use tighter padding and **gap: 0** so the cluster is narrow in **Actions**.

---

## Latest Updates (v2.284)

**Date**: 2026-04-10

### Banking — **Mercury | Stripe** rows, **`product` + `tab`** URL; **Stripe Invoices** & **Data** (dev); Jobs **Stages** thread-stats **debounce + chunks**

- **[`Banking.tsx`](src/pages/Banking.tsx)** — **Row 1**: **Mercury** | **Stripe** (Stripe visible to **dev** only). **Row 2**: Mercury **Ledger** / **Sorting** (and Configuration where applicable); Stripe **Invoices** / **Data**. Query model: **`?product=mercury|stripe`** and **`?tab=…`** — Mercury uses **`ledger`** / **`sorting`**; Stripe uses **`invoices`** / **`data`**. Legacy **`?tab=sorting`** (no product) still opens Mercury **Sorting**. Master/assistant deep links with **`product=stripe`** are normalized to Mercury **Sorting**.
- **[`BankingStripeInvoicesPanel.tsx`](src/components/BankingStripeInvoicesPanel.tsx)** — Lists **`jobs_ledger_invoices`** with job embed (HCP, name, customer). **Seq** = per-job **`sequence_order`**. Rows with no **`stripe_invoice_id`** use a light red row background.
- **[`BankingStripeWebhookEventsPanel.tsx`](src/components/BankingStripeWebhookEventsPanel.tsx)** — Read-only grid of **`stripe_webhook_events`** (dev RLS). Populated by Edge **[`stripe-webhook`](supabase/functions/stripe-webhook/index.ts)** dedupe insert (**[`20270410130300_stripe_webhook_events_dedupe.sql`](supabase/migrations/20270410130300_stripe_webhook_events_dedupe.sql)**).
- **[`Jobs.tsx`](src/pages/Jobs.tsx)** — Main **`loadJobs`** effect depends on **`searchParams.get('customer')`** (**`customerParamForJobsReload`**) so unrelated query-string churn does not refetch the full jobs payload. **Stages** **Last activity** refreshes: **`refreshJobThreadStatsForJobIds`** is debounced (**`THREAD_STATS_STAGES_DEBOUNCE_MS` = 320**) to avoid overlapping **`jobs_ledger_thread_note_stats`** calls while typing search.
- **[`useJobThreadNotes.ts`](src/hooks/useJobThreadNotes.ts)** — Thread stats RPC calls split into chunks of **200** job IDs; **`threadStatsRefreshGenRef`** drops stale in-flight work when a newer refresh starts.

---

## Latest Updates (v2.283)

**Date**: 2026-04-10

### Bill Customer — **Stripe preview** before create; **`BillCustomerModalProvider`**; **Edit Job** entry

- **[`BillCustomerModalContext.tsx`](src/contexts/BillCustomerModalContext.tsx)** — Global **`openBillCustomer` / `closeBillCustomer`**; renders **[`SendRecordInvoiceModal`](src/components/jobs/SendRecordInvoiceModal.tsx)** once (overlay **z-index 1020**, above **Edit Job** `1010`). **`Jobs`** and **`Dashboard`** open billing via **`useBillCustomerModal()`** instead of mounting the modal locally.
- **[`preview-stripe-invoice`](supabase/functions/preview-stripe-invoice/index.ts)** — Edge function: same auth/validation as **`create-stripe-invoice`**, **no DB writes**, no Stripe customer creation; **`invoices.createPreview`** with **`customer`** or **`customer_details`**; returns totals + line amounts (cents). **`supabase/config.toml`** **`verify_jwt = false`**. Docs: **[`EDGE_FUNCTIONS.md`](EDGE_FUNCTIONS.md)**.
- **[`SendRecordInvoiceModal.tsx`](src/components/jobs/SendRecordInvoiceModal.tsx)** — **Stripe** tab: debounced **`preview-stripe-invoice`** while amount / due date / memo change; optional **`overlayZIndex`** (provider passes **1020**).
- **[`StripeBillPreSubmitPreview.tsx`](src/components/jobs/StripeBillPreSubmitPreview.tsx)** — Pre-submit **Invoice (Stripe)** block, **Bill to**, payment-link placeholder, read-only **email** / **SMS** drafts.
- **[`stripeInvoiceShareCopy.ts`](src/lib/stripeInvoiceShareCopy.ts)** — Shared email/SMS templates; **[`StripeInvoiceSharePanel.tsx`](src/components/jobs/StripeInvoiceSharePanel.tsx)** imports them (behavior unchanged).
- **[`stripeInvoicePreview.ts`](src/lib/stripeInvoicePreview.ts)** — Preview response typing + **`formatStripeCents`**.
- **[`JobFormModal.tsx`](src/components/jobs/JobFormModal.tsx)** — **Open invoices** → **Ready to Bill**: **Preview / Stripe bill…** opens the same Bill Customer flow (**`kind: 'invoice'`**); refreshes the edit form after success via **`fetchJobWithDetailsById`**.
- **[`App.tsx`](src/App.tsx)** — **`BillCustomerModalProvider`** wraps **`JobFormModalProvider`** so **Edit Job** and routed pages share the modal.

---

## Latest Updates (v2.282)

**Date**: 2026-04-09

### Jobs — **Bill Customer** Stripe tab; **Edit Job** share actions; **stripe-webhook** lifecycle

- **[`SendRecordInvoiceModal.tsx`](src/components/jobs/SendRecordInvoiceModal.tsx)** — **Stripe bill** tab: amount, due date (default +30 days), memo; **`supabase.functions.invoke('create-stripe-invoice')`** with Bearer session; after success calls **`update_job_status` → `billed`** when opened from a **job** row (parity with outside bill). Customer email required. Shows **[`StripeInvoiceSharePanel`](src/components/jobs/StripeInvoiceSharePanel.tsx)** after create / idempotent hit.
- **[`StripeInvoiceSharePanel.tsx`](src/components/jobs/StripeInvoiceSharePanel.tsx)** — Customer pay page, **Open in Stripe** (Dashboard), **Copy payment link**, **Copy text for SMS**, **Send email…** (`mailto` with template). Used in the modal and **Edit Job** outstanding Stripe invoices ([`JobFormModal.tsx`](src/components/jobs/JobFormModal.tsx)).
- **Edge [`create-stripe-invoice`](supabase/functions/create-stripe-invoice/index.ts)** — Persists **`external_send_channel: 'stripe'`** and **`sent_to_customer_at`** on finalize.
- **Migration [`20260409032340_external_send_channel_stripe_value.sql`](supabase/migrations/20260409032340_external_send_channel_stripe_value.sql)** — CHECK allows **`stripe`** on **`jobs_ledger_invoices.external_send_channel`**.
- **Edge [`stripe-webhook`](supabase/functions/stripe-webhook/index.ts)** — **`invoice.updated`**, **`invoice.voided`**, **`invoice.payment_failed`**: sync **`stripe_invoice_status`**; does not downgrade when app row is already **`paid`** and Stripe is not **`paid`**. **Ops**: add these events in Stripe Dashboard for the same endpoint. Docs: **[`EDGE_FUNCTIONS.md`](EDGE_FUNCTIONS.md)**.

---

## Latest Updates (v2.281)

**Date**: 2026-04-08

### Dashboard — **Copy day job mix** on **Clocked in today**; **My Time** preview from **Clock** row

- **Copy job time mix** (**dev**, **master_technician**, **assistant** — same strip scope as **My team / Everyone**): When **Clocked in today** has rows, the subsection header can show a **Mix** toggle ([`DashboardTeamActiveClockStrip.tsx`](src/components/DashboardTeamActiveClockStrip.tsx)). Turn **Mix** on, use the per-row **copy** control to choose a **source** person whose closed-today sessions define a **% job mix**, then apply to a **target** person for the strip’s calendar **`work_date`** ([`clockStripWorkDateYmd`](src/hooks/useDashboardMyTeamSectionState.ts) from the my-team hook; falls back to company-calendar today). Modal **[`CopyDayJobMixModal.tsx`](src/components/day-job-mix/CopyDayJobMixModal.tsx)** + helpers **[`dayJobMixPercentages.ts`](src/lib/dayJobMixPercentages.ts)**, **[`dayJobMixApply.ts`](src/lib/dayJobMixApply.ts)** build segment plans; **`leader_replace_clock_session_cluster_mixed`** applies replacement (**[`leaderClockSessionSplit.ts`](src/lib/leaderClockSessionSplit.ts)**). Client guard **[`copyDayJobMixTargetGate.ts`](src/lib/copyDayJobMixTargetGate.ts)** (**`assertTargetSessionsAllowJobMixReplace`**) blocks the target when any eligible session has **`origin === 'salary_schedule'`** and **any** of those salary rows is still **open** (`clocked_out_at` null)—user must close the salary session first (My Time or People → Hours). Confirm copy text summarizes cluster count; cluster-level RPC errors surface in the modal.
- **Dashboard** passes **`enableCopyDayJobMix={showClockStripScopeToggle}`** and **`clockStripWorkDateYmd`** on both assistant and non-assistant strip instances ([`Dashboard.tsx`](src/pages/Dashboard.tsx)). Strip session loads include **`approved_at`** where needed (**[`CLOCK_SESSION_CALENDAR_SELECT`](src/lib/clockSessionSelect.ts)** / related selects) for editor and mix flows.
- **View today’s time** — **[`ClockInOutButton.tsx`](src/components/ClockInOutButton.tsx)**: when **`onOpenMyTimeDayEditor`** is set, the user has **no open** session, but **today’s `work_date`** already has at least one row in **`clock_sessions`**, a compact **blue clock** button opens **[`DashboardMyTimeDayEditorModal`](src/components/DashboardMyTimeDayEditorModal.tsx)** via **`openMyTimePreviewFromClock`** in **Dashboard** with **`clockTimesReadOnly`**: **Form** / **Visual** timeline edits, bulk assign, merges/splits, and **Save on close** (`requestClose`) behave like the full editor for in-range days; **punch-time** actions (**Adjust times**, force clock-out, reject, NCNS) are disabled; modal title suffix **— punch times locked**.

---

## Latest Updates (v2.280)

**Date**: 2026-04-08

### Bids Takeoffs — **Rough** unit price from catalog (`material_part_prices`); override; push to catalog

- **Default**: Choosing a part on a rough takeoff line fills **unit price** from the **lowest** `material_part_prices.price` for that part (same rule as PO expansion in **[`materialPOUtils.ts`](src/lib/materialPOUtils.ts)**). Helper **[`fetchLowestPartPrice`](src/lib/materialPartCatalogPrice.ts)** / **`fetchLowestPartPricesBatch`** use **`withSupabaseRetry`**.
- **Persistence**: Migration **[`20260408192820_rough_takeoff_line_catalog_price_source.sql`](supabase/migrations/20260408192820_rough_takeoff_line_catalog_price_source.sql)** adds nullable **`source_material_part_price_id`** on **`bids_takeoff_rough_part_lines`** — set when the price came from that catalog row; **cleared** when the user edits unit price (**bid override**).
- **UI** (under unit price): **Reset to catalog**, **Catalog prices** (existing modal), **Apply line price to catalog…** (picker when overridden). Inline hints: **`lowest: [supply house]`** when the line **unit price** matches the live minimum **`material_part_prices.price`** (batch **`fetchLowestPartPricesBatch`** + small tolerance); **No catalog price** or **Bid override** otherwise (independent of **`source_material_part_price_id`** for the label).
- **Rough part line order**: Reorder lines **within the same fixture** by dragging the **reorder** handle (**`@dnd-kit`** + **`SortableRoughPartLineRow`** in **[`Bids.tsx`](src/pages/Bids.tsx)**); **`sequence_order`** persisted on drop (**`handleRoughPartLinesDragEnd`**).

---

## Latest Updates (v2.279)

**Date**: 2026-04-08

### Bids — **Bid Preview** from **Bid #**; **Submission & Followup** notes toolbar; Task Dispatch **notify-dispatch-request** gateway auth

- **Workflow tab titles** (**Counts**, **Takeoffs**, **Cost Estimate**, **Pricing**, **Cover Letter**, **Submission & Followup**, **RFI**, **Change Order**, **Lien Release**): when the bid has a **`bid_number`**, **`B{n}`** in the heading is a link-style control that opens the global bid preview (**[`BidWorkflowTabTitleWithPreview`](src/pages/Bids.tsx)** via **[`BidPreviewModalContext`](src/contexts/BidPreviewModalContext.tsx)**). Unnumbered bids stay plain text.
- **Bid Board** **Bid #** column: **`B{n}`** opens the same preview (when preview context is available), consistent with the **Preview** (eye) column.
- **Submission & Followup** selected-bid panel: **+ bid note** / **+ customer note** sit on one row with **All | Bid | Customer** (**desktop**: actions left, tab pills right; **`narrowViewport640`**: column stack, **centered**). **`BidNotesTable`** / **`CustomerNotesTable`** accept **controlled** add-row state and **`hideFooterAddButton`** so the footer **Add row** is not duplicated (**[`UnifiedBidCustomerNotesActionButtons`](src/components/bidBoard/UnifiedBidCustomerNotes.tsx)** in the toolbar).
- **Edge Function `notify-dispatch-request`**: **`[functions.notify-dispatch-request] verify_jwt = false`** in **[`supabase/config.toml`](supabase/config.toml)** (same gateway behavior as **`notify-estimator-request`**). Without it the API gateway can return **401** before the function runs **`auth.getUser`**. Redeploy with **`supabase functions deploy notify-dispatch-request --no-verify-jwt`** when needed. Docs: **[`EDGE_FUNCTIONS.md`](EDGE_FUNCTIONS.md)** (notify-dispatch-request).

---

## Latest Updates (v2.278)

**Date**: 2026-04-07

### DetailJobModal — **Job Files** / **Job Plans** when links exist; numbered **Specific Work**

- **`DetailJobModalFilesPlansRow`** in **[`DetailJobModal.tsx`](src/components/jobs/DetailJobModal.tsx)**: the whole row is omitted when both **`google_drive_link`** and **`job_plans_link`** are empty after trim; **Job Files** or **Job Plans** appears only when that link is set.
- **Specific Work (Fixtures / Tie-ins / Repair)**: each fixture line is **`[1]`**, **`[2]`, …** then **name × count** (plain lines; previous bordered cards removed). UI section title includes **Repair**.

---

## Latest Updates (v2.277)

**Date**: 2026-04-07

### Job Detail — stacked **Edit Job**; **Materials cost** accordions; **Mercury** **Posted** / **Card**; **Other job charges** label

- **Stacked modals**: **[`DetailJobModal.tsx`](src/components/jobs/DetailJobModal.tsx)** stays open when **Edit job** runs; **[`JobFormModal.tsx`](src/components/jobs/JobFormModal.tsx)** **`JOB_FORM_OVERLAY_Z_INDEX`** **1010** sits above Detail backdrop **1004**. On save, Detail reloads (**`loadDetail`**, **`materialsCostRefreshKey`**); **`onEditJobSaved`** / parent refresh (e.g. **[`ScheduleDispatch.tsx`](src/pages/ScheduleDispatch.tsx)** **`loadHub`**).
- **Materials cost**: **[`JobDetailMaterialsCostSection.tsx`](src/components/jobs/JobDetailMaterialsCostSection.tsx)** — four accordions aligned with **Edit Job** (supply house, Mercury card charges, tally, **Other job charges**); **[`fetchJobMaterialsCostSnapshot.ts`](src/lib/fetchJobMaterialsCostSnapshot.ts)** + **[`useJobMaterialsCostSnapshot.ts`](src/hooks/useJobMaterialsCostSnapshot.ts)**; **[`jobDetailModalRole.ts`](src/lib/jobDetailModalRole.ts)** **`canExpandJobDetailMaterials`** (expand for dev / master_technician / assistant / primary / superintendent / estimator; **subcontractor** non-expandable summary). Shared accordion behavior via **[`JobFormMaterialsCostAccordion.tsx`](src/components/jobs/JobFormMaterialsCostAccordion.tsx)** **`expandable`**.
- **Copy**: UI label **Other job charges** for manual **`jobs_ledger_materials`** rows (replaces **Billed materials**) in **Edit Job**, **Detail**, **Jobs** Parts tab, Quickfill billing reminder, etc.
- **Mercury** allocation table (Edit + Detail): **Posted** — short US date via **[`formatMercuryCardChargesPostedDate.ts`](src/lib/formatMercuryCardChargesPostedDate.ts)**; **Card** — debit card id from allocation **`raw`** (**`mercuryDebitCardIdFromRaw`**); display nicknames from **[`useMercuryLedgerNicknames.ts`](src/hooks/useMercuryLedgerNicknames.ts)**.

---

## Latest Updates (v2.276)

**Date**: 2026-04-07

### DetailJobModal — dates band, billing pipeline, layout, thread notes chrome

- **[`DetailJobModal.tsx`](src/components/jobs/DetailJobModal.tsx)** — **Three date rows**: **Last work date** (read-only **`last_work_date`**); **Last bill date** from **`deriveRecordedBillingActivityDetail`** ([`stagesJobReferenceDates.ts`](src/lib/stagesJobReferenceDates.ts)) on **full** job fetch — **invoice / payment activity only** (`sent_to_customer_at` / `billed_at` / `paid_on`; **excludes** **`last_bill_date`**, which is the third row); **`—`** when no qualifying activity or on **limited** snapshot (**invoices/payments not loaded**). **Last manual bill date** = column **`last_bill_date`** (user-editable in **Edit Job**). Contrast Stages **`b:`**, which uses **`deriveStagesBillingActivityDetail`** (includes **`last_bill_date`**).
- **Friendly date lines** + **title** tooltips: [`formatJobDetailModalDateYmd.ts`](src/lib/formatJobDetailModalDateYmd.ts) (`formatJobDetailModalDateFromYmd`, `formatJobDetailModalDateTitleFromYmd`); **Last bill date** hover merges ISO + activity detail via **`jobDetailBillingHoverTitle`**.
- **Layout**: **`useNarrowViewport640`** — at ~640px and below, the **3-date** band stacks vertically (**`DetailRow`** **`softBox`**); wider viewports use a **3-column** date grid. **Status** is centered below the dates; **Job Total** sits below **Specific Work (Fixtures / Tie-ins / Repair)** (full detail) or below **Materials cost** (limited snapshot).
- **Status**: **[`JobLedgerStatusPipeline`](src/components/jobs/JobLedgerStatusPipeline.tsx)** + **[`jobsLedgerStatusPipeline.ts`](src/lib/jobsLedgerStatusPipeline.ts)** — **Working → Ready to bill → Billed → Paid**; current step emphasized (**`aria-current`**). Used for both full and limited job rows.
- **Lists**: section headings **Other job charges** and **Specific Work (Fixtures / Tie-ins / Repair)** (full load). **Job Files** / **Job Plans** visibility + numbered fixtures: [v2.278](#latest-updates-v2278). **Materials cost** rows + **Edit job** stacking: [v2.277](#latest-updates-v2277).
- **Edit job**: gear control left of **Close** — see [v2.277](#latest-updates-v2277) (**`JobFormModal`** stacked above Detail; optional **`onEditJobSaved`**).
- **Thread notes**: **`JobThreadNotesPanel`** with **`showSectionTitle={false}`**, **`showEmptyPlaceholder={false}`**, **`showComposerLabel={false}`** — chrome-light in Detail (see [v2.264](#latest-updates-v2264) for composer + Realtime). Detail modal backdrop **`z-index` 1004**.

---

## Latest Updates (v2.275)

**Date**: 2026-04-07

### Jobs Stages — `j:` / `b:` reference lines (derived)

- **[`Jobs.tsx`](src/pages/Jobs.tsx)**: **Assigned / HCP** shows **`j:`** (max of **`last_work_date`** and max **`job_schedule_blocks.work_date`**) and **`b:`** (calendar-**max** of **`last_bill_date`**, invoice **`sent_to_customer_at`** / **`billed_at`**, and payment **`paid_on`**; **`—`** when all unset). Tooltips via **`deriveStagesFieldTooltip`** / **`deriveStagesBillingActivityDetail`**. Removed job-row Ham **±1** for **`last_bill_date`**.
- **`b:`** / **last manual bill date**: **[`stagesJobReferenceDates.ts`](src/lib/stagesJobReferenceDates.ts)** **`deriveStagesBillingActivityDetail`** includes **`last_bill_date`** as a candidate so Edit Job / When Billed updates the line; later invoice send/billed/payment dates **win** when later.
- **`loadJobs`**: chunked **`.in('job_id', …)`** fetch on **`job_schedule_blocks`**; sets **`last_schedule_work_date`** on each **[`JobWithDetails`](src/types/jobWithDetails.ts)**.
- **[`stagesJobReferenceDates.ts`](src/lib/stagesJobReferenceDates.ts)** — pure derivations + **`mergeMaxScheduleWorkDateByJobId`**.
- **[`fetchJobWithDetailsById.ts`](src/lib/fetchJobWithDetailsById.ts)**: **`last_schedule_work_date: null`** on single-job fetch (schedule max only on full Jobs load).
- **Ready to Bill**: **Missing Billed Date** remains for unset **`last_bill_date`**, rendered beside **`j:`/`b:`**, not as empty **`b:`**.
- **Copy**: **Edit Job**, **Detail Job**, **When was this job billed?** modal, and Stages **`b:`** tooltip use the label **Last manual bill date** (column **`last_bill_date`** unchanged).

---

## Latest Updates (v2.274)

**Date**: 2026-04-08

### Jobs ledger — Last work date (cached) + Last bill date (column rename)

- **Schema**: **`jobs_ledger.last_work_date`** (nullable **DATE**) — cache of **`MAX(work_date)`** from **`clock_sessions`** where the session is **approved**, not rejected, not revoked, and linked to the job. **`refresh_jobs_ledger_last_work_date`** (**`SECURITY DEFINER`**) + **`touch_jobs_ledger_last_work_date_from_clock_sessions`** on **`clock_sessions`** INSERT / DELETE / UPDATE of relevant columns; backfill + optional index **`idx_jobs_ledger_last_work_date`** — **[`20260408013952_jobs_ledger_last_work_date_clock_sessions_trigger.sql`](supabase/migrations/20260408013952_jobs_ledger_last_work_date_clock_sessions_trigger.sql)**.
- **Rename**: **`estimated_completion_date` → `last_bill_date`**; **`ensure_single_ready_to_bill_invoice_for_job`** updated — **[`20260408014106_rename_estimated_completion_to_last_bill_date_and_fix_rtb_rpc.sql`](supabase/migrations/20260408014106_rename_estimated_completion_to_last_bill_date_and_fix_rtb_rpc.sql)**.
- **App**: **[`JobFormModal.tsx`](src/components/jobs/JobFormModal.tsx)** **Last manual bill date**; **[`DetailJobModal.tsx`](src/components/jobs/DetailJobModal.tsx)** **Last work date** (read-only) + **Last manual bill date** (v2.276 adds derived **Last bill date** row—see [v2.276](#latest-updates-v2276)); **[`Jobs.tsx`](src/pages/Jobs.tsx)** and invoice fallbacks use **`last_bill_date`**; **[`limitedJobDetailSnapshot.ts`](src/types/limitedJobDetailSnapshot.ts)** / **`database.ts`** types.
- **Docs**: **`GLOSSARY.md`**, **`PROJECT_DOCUMENTATION.md`** (Jobs), **`MIGRATIONS.md`**.

---

## Latest Updates (v2.273)

**Date**: 2026-04-07

### DetailJobModal — Scheduled block layout

- **[`DetailJobModal.tsx`](src/components/jobs/DetailJobModal.tsx)** / **[`jobScheduleChicago.ts`](src/lib/jobScheduleChicago.ts)**: **Scheduled block** bold line is **`Scheduled block - {weekday}`** (Chicago). Second line is **calendar date without weekday** **`·`** **time window** via **`scheduleFormatDateLongNoWeekday`** + **`scheduleFormatWindow`**. New helpers **`scheduleFormatWeekdayOnly`**, **`scheduleFormatDateLongNoWeekday`**; invalid **`workDate`** still falls back to raw string like **`scheduleFormatWeekdayLong`**.

---

## Latest Updates (v2.272)

**Date**: 2026-04-07

### DetailJobModal — Customer panel beside Address / schedule

- **[`DetailJobModal.tsx`](src/components/jobs/DetailJobModal.tsx)**: Top band uses **`detailJob`** only when **`!loading && !error`** (no empty customer column while fetching). **Customer** section is title plus **three stacked value lines** (name, phone, email; no per-field sublabels); **`tel:`** / **`mailto:`** via **`openInExternalBrowser`** when set. **Missing** name / phone / email show muted **`[missing name]`** / **`[missing phone]`** / **`[missing email]`** (`#9ca3af`). Outer grid **`minmax(min(100%, 240px), 1fr)`** with **Address** + **Scheduled block** stacked in the left cell; **Street View** unchanged below. **Customer** **DetailRow** duplicates removed from full and limited body sections.

---

## Latest Updates (v2.271)

**Date**: 2026-04-08

### DetailJobModal — Address and scheduled block row

- **[`DetailJobModal.tsx`](src/components/jobs/DetailJobModal.tsx)**: **Address** and **Scheduled block** share a **`display: grid`** row with **`repeat(auto-fit, minmax(min(100%, 260px), 1fr))`** (side-by-side on wide modals, stacked on narrow); DOM order Address then schedule; **Street View** remains full-width below.

---

## Latest Updates (v2.270)

**Date**: 2026-04-07

### Schedule Dispatch hub — Job detail from block title

- **[`ScheduleDispatch.tsx`](src/pages/ScheduleDispatch.tsx)**: People hub block **top row** (job title) opens **`DetailJobModal`** with **`jobId`**, **`scheduleContext`** from the block + cell date, **`assignedJobsRows={[]}`**; clears with week/job navigation. Removed hub **`PreviewJobModal`** path and **`hubJobProjectIdById`**.
- **[`ScheduleDispatchHub.tsx`](src/components/schedule/ScheduleDispatchHub.tsx)**: **`onOpenHubJobDetail(block, workDateYmd)`** replaces **`onOpenJobPreview`**. Job-week overview still uses **`PreviewJobModal`** from the header when linked to a project.

---

## Latest Updates (v2.269)

**Date**: 2026-04-07

### Schedule Dispatch — + copy menu portal

- **[`ScheduleDispatchPlusCopyMenu`](src/components/schedule/ScheduleDispatchPlusCopyMenu.tsx)**: **`createPortal`** to **`document.body`**, **`position: fixed`** from **+** **`getBoundingClientRect`** (prefer above, flip below, viewport clamp); **`zIndex` 200**; **`scroll`** (capture) + **`resize`** reposition; **Escape** + outside **mousedown** close. **[`ScheduleDispatchGrid`](src/components/schedule/ScheduleDispatchGrid.tsx)** / **[`ScheduleDispatchHub`](src/components/schedule/ScheduleDispatchHub.tsx)** block cards: **+** **`ref`**, removes inline **`absolute`** menu (fixes clip in hub **`td`** **`maxHeight`** / **`overflowY`** and grid **`overflowX`**).

---

## Latest Updates (v2.268)

**Date**: 2026-04-07

### Schedule Dispatch — Linked badge no layout inset

- **[`ScheduleDispatchGrid`](src/components/schedule/ScheduleDispatchGrid.tsx)** / **[`ScheduleDispatchHub`](src/components/schedule/ScheduleDispatchHub.tsx)**: removed linked-only **right padding** so job/time/note use the same width as unlinked cards; chain chip remains **`absolute`** top-right (**long lines may pass under** the 20×20 control).

---

## Latest Updates (v2.267)

**Date**: 2026-04-07

### Schedule Dispatch — Linked badge top-right

- **[`ScheduleDispatchGrid`](src/components/schedule/ScheduleDispatchGrid.tsx)** / **[`ScheduleDispatchHub`](src/components/schedule/ScheduleDispatchHub.tsx)**: linked chain control **`position: absolute`**, **`top: 2`**, **`right: 2`**, **`zIndex: 3`** (same overlay layer as **−** / **+** at bottom-right); main content gets **`paddingRight: 28`** when linked so time/note/title do not run under the icon.

---

## Latest Updates (v2.266)

**Date**: 2026-04-07

### Schedule Dispatch — Hide weekend default on

- **[`ScheduleDispatch.tsx`](src/pages/ScheduleDispatch.tsx)** **`readScheduleDispatchHideWeekend`**: default **`true`** when **`scheduleDispatchHideWeekend`** is unset; **`'0'`** / **`'1'`** still turn weekends off/on. First load persists **`'1'`** via existing **`useEffect`**.
- **[`ScheduleDispatchWeekNav.tsx`](src/components/schedule/ScheduleDispatchWeekNav.tsx)** **`hideWeekend`** fallback prop **`true`**.

---

## Latest Updates (v2.265)

**Date**: 2026-04-07

### Schedule Dispatch — Linked pill icon

- **[`ScheduleDispatchLinkedChainsIcon`](src/components/icons/ScheduleDispatchLinkedChainsIcon.tsx)** (Font Awesome Free): chain glyph, **`currentColor`**, default size **13**.
- **[`ScheduleDispatchGrid`](src/components/schedule/ScheduleDispatchGrid.tsx)** / **[`ScheduleDispatchHub`](src/components/schedule/ScheduleDispatchHub.tsx)**: linked-group badge shows icon instead of **Linked** text; Grid **`role="img"`** **`aria-label="Linked"`**; Hub button **`aria-label`** / **`title`** unchanged. **Linked copy** menu labels unchanged.

---

## Latest Updates (v2.264)

**Date**: 2026-04-07

### DetailJobModal — Job activity / notes

- **[`useJobThreadNotesForModal`](src/hooks/useJobThreadNotesForModal.ts)**: Loads **`jobs_ledger_thread_notes`** when the modal is open; **Realtime** **INSERT** refreshes the list; **`submitNote`** matches Jobs Stages insert + **toast** on errors; **`canPost`** when signed in (**RLS** enforces insert).
- **[`DetailJobModal`](src/components/jobs/DetailJobModal.tsx)**: **[`JobThreadNotesPanel`](src/components/JobThreadNotesPanel.tsx)** after **Scheduled block** (scroll **`maxHeight`**); **`useAuth`** + **`useToastContext`**. No Schedule / Week dispatch actions in the modal. Later: **v2.276** adds **`showSectionTitle` / `showEmptyPlaceholder` / `showComposerLabel`** off for chrome-light Detail + expanded dates/status layout.

---

## Latest Updates (v2.263)

**Date**: 2026-04-07

### DetailJobModal — Street View preview

- **[`street-view-preview`](supabase/functions/street-view-preview/index.ts)** Edge Function: **`GET`** with **`location`**; **`meta=1`** returns **lat/lng** from Google Street View metadata; default path proxies **Street View Static** (**640×320**) using **`GOOGLE_MAPS_API_KEY`** (**[`EDGE_FUNCTIONS.md`](EDGE_FUNCTIONS.md)**). **`verify_jwt = false`**; **`auth.getUser()`** inside.
- **[`fetchStreetViewPreview.ts`](src/lib/fetchStreetViewPreview.ts)**: **`fetchStreetViewMeta`**, **`fetchStreetViewImageBlob`**, **`googleStreetViewPanoUrl`** (session **`fetch`** + **`apikey`**).
- **[`DetailJobModal`](src/components/jobs/DetailJobModal.tsx)**: **Street View** labeled block under **Address**; loading text; **16:9** thumbnail via **blob URL**; **`openInExternalBrowser`** opens **`map_action=pano`** when coordinates exist, else Maps search.

---

## Latest Updates (v2.262)

**Date**: 2026-04-07

### DetailJobModal — Address opens Google Maps

- **[`DetailJobModal`](src/components/jobs/DetailJobModal.tsx)**: **Address** row below the title (above **Scheduled block**); underlined link opens **`https://www.google.com/maps/search/?api=1&query=…`** via **`openInExternalBrowser`**. **`role="link"`**, **Enter** / **Space**. **`prefillAddress`** from **[`Dashboard`](src/pages/Dashboard.tsx)** **Assigned Jobs** match on My schedule open so the line can show before fetch. Removed duplicate **Job address** **`DetailRow`** in the body.

---

## Latest Updates (v2.261)

**Date**: 2026-04-07

### DetailJobModal — Dynamic dialog title

- **[`DetailJobModal`](src/components/jobs/DetailJobModal.tsx)** heading: **`Job Detail: [hcp], [job name]`** from loaded job; **`Job Detail`** while loading or on error. **Prefill** from My schedule row label ([`prefillRowLabel`](src/pages/Dashboard.tsx)) via **`splitScheduleDetailRowLabel`** (first ` · ` only) so the title is correct before fetch. **`wordBreak`** on **`h2`** for long names.

---

## Latest Updates (v2.260)

**Date**: 2026-04-07

### Dashboard — My schedule Job details modal

- **My schedule** ([`Dashboard.tsx`](src/pages/Dashboard.tsx)): whole row (**click** / **Enter** / **Space**) opens read-only **[`DetailJobModal`](src/components/jobs/DetailJobModal.tsx)** with **Scheduled block** (Chicago date + [`scheduleFormatWindow`](src/lib/jobScheduleChicago.ts) + note). **Staff** (`dev` / `master_technician` / `assistant` / `primary` per [`isStaffFullJobLedgerDetailRole`](src/lib/jobDetailModalRole.ts)): full **[`fetchJobWithDetailsById`](src/lib/fetchJobWithDetailsById.ts)** — Edit Job–parity sections (**Assigned Team** / `team_members`, materials, fixtures, payments, invoices). **Others** (e.g. **subcontractor**): [`jobs_ledger`](src/types/database.ts) column-only snapshot when RLS allows, else **[`assignedJobs`](src/pages/Dashboard.tsx)** fallback; muted copy that billing line items are not shown. **Workflow** link only when `authRole !== 'subcontractor'`. **[`LimitedJobDetailSnapshot`](src/types/limitedJobDetailSnapshot.ts)** for the limited tier.

---

## Latest Updates (v2.259)

**Date**: 2026-04-07

### Dashboard — Subcontractor My schedule (today / tomorrow)

- **Subcontractors only** ([`Dashboard.tsx`](src/pages/Dashboard.tsx)): read-only **My schedule** after **Checklist: Outstanding** — **Today** and **Tomorrow** (America/Chicago dates) from [`fetchScheduleBlocksForAssigneeDateRange`](src/lib/jobScheduleBlocks.ts); [`scheduleFormatWindow`](src/lib/jobScheduleChicago.ts) + optional note; job labels from assigned jobs + `jobs_ledger` gap fill. **Calendar →** links to [`/calendar`](src/pages/Calendar.tsx) (not Schedule Dispatch). Mirrored **Linked** legs deduped in-app (`dedupeSubScheduleBlocks` by `shared_block_group_id` + date + window).

---

## Latest Updates (v2.258)

**Date**: 2026-04-07

### Schedule dispatch — Cross-day drag + linked crew day move

- **RPC** **[`move_job_schedule_block_group`](supabase/migrations/20260407165443_move_job_schedule_block_group.sql)** (`p_job_id`, `p_shared_block_group_id`, `p_new_work_date`): locks all legs, no-op if already on target date, overlap-check per assignee on the target day (same interval rule as [`jobScheduleOverlap.ts`](src/lib/jobScheduleOverlap.ts)), then updates `work_date` for the whole group. **`moveJobScheduleBlockGroupViaRpc`** in [`jobScheduleBlocks.ts`](src/lib/jobScheduleBlocks.ts).
- **DnD** [`executeScheduleDispatchBlockReassign`](src/lib/scheduleDispatchDragEnd.ts): **Solo** legs can move to another **day** and/or **assignee** with existing overlap checks (`excludeIds: [blockId]`). **Linked** legs move **day only** for the full group (drop target column sets the new date; assignee-only change same day → info toast, not supported in v1). Hub + job week grid allow dragging **Linked** cards (no longer disabled when multiple legs show in the week); [`scheduleDispatchDragHelp.ts`](src/lib/scheduleDispatchDragHelp.ts) copy updated.

---

## Latest Updates (v2.257)

**Date**: 2026-04-09

### Schedule — Linked blocks (crew mirror) + Banking types workaround

- **`job_schedule_blocks.shared_block_group_id`** (nullable UUID, migration **[`20260407061043_job_schedule_blocks_shared_block_group.sql`](supabase/migrations/20260407061043_job_schedule_blocks_shared_block_group.sql)**): rows with the same non-null value share one logical block (same job, work date, `time_start` / `time_end`, `note`); each leg still has its own `assignee_user_id` and row id. **Legacy** rows keep `NULL` (solo). **New inserts** (Jobs **[`ScheduleJobModal`](src/components/jobs/ScheduleJobModal.tsx)**, Dispatch add) set a fresh UUID on every row so mirroring always has a group id.
- **API** ([`jobScheduleBlocks.ts`](src/lib/jobScheduleBlocks.ts)): `newJobScheduleSharedBlockGroupId()`, `updateJobScheduleBlockGroup(jobId, groupId, patch)` for synced time/note, `ensureSharedBlockGroupForRow(id)` when mirroring from a legacy solo source.
- **Overlap** ([`jobScheduleOverlap.ts`](src/lib/jobScheduleOverlap.ts)): `scheduleOverlapsAny(candidate, existing, excludeIds?)` supports excluding multiple row ids (group save validates per assignee).
- **Dispatch job grid** ([`ScheduleDispatch.tsx`](src/pages/ScheduleDispatch.tsx), [`ScheduleDispatchGrid.tsx`](src/components/schedule/ScheduleDispatchGrid.tsx)): **+ → Linked copy** (or **Solo copy**) on a card starts placement (banner + Esc / Cancel); click a team member’s day cell to add a leg with overlap check; **Linked** badge when the group has more than one leg in the loaded week. **Edit** modal updates all legs in a group. **DnD**: solo → another day/assignee; linked → cross-day group move (**v2.258**). (Older **Mirror block** under **Add block** was removed as redundant.)
- **Mercury splits**: [`MercuryTransactionAllocationsModal.tsx`](src/components/MercuryTransactionAllocationsModal.tsx) uses **`ReplaceMercuryTransactionSplitsCall`** + assertion into generated **`Database['public']['Functions']['replace_mercury_transaction_splits']['Args']`** because **`supabase gen types`** omits **`null`** for **`p_person_id`** / **`p_user_id`** even though Postgres allows both null (clear attribution).

---

## Latest Updates (v2.256)

**Date**: 2026-04-07

### Schedule dispatch — Week hub (all visible jobs, Scope B)

- **Landing** (`/schedule-dispatch` without **`jobId`**): **[`ScheduleDispatchHub.tsx`](src/components/schedule/ScheduleDispatchHub.tsx)** — **People** (default) | **Jobs** | **Day** tabs; URL **`hubTab=people|jobs|day`** preserved with **`week`**; **Day** embeds **[`QuickfillScheduleSection`](src/components/quickfill/QuickfillScheduleSection.tsx)** (see [v2.309](#latest-updates-v2309)); optional **`day=`** for column focus on People/Jobs. Week nav; **`jobs_ledger`** + one week-wide blocks fetch ([`fetchJobsLedgerForScheduleDispatchHub`](src/lib/scheduleDispatchHub.ts), [`fetchJobScheduleBlocksForHubDateRange`](src/lib/jobScheduleBlocks.ts)); derive per-job counts via [`blocksToJobWeekSummaries`](src/lib/scheduleDispatchHub.ts) + [`aggregateWeekSummariesByJob`](src/lib/scheduleDispatchHub.ts). **Jobs** tab: per-job **total** and **Sun–Sat** columns; search; **Only jobs with blocks this week** (on by default); sort by block count then HCP. **People** tab: roster = hub job team members ([`fetchTeamMemberUserIdsForJobIds`](src/lib/scheduleDispatchHub.ts)) plus block assignees, names via [`fetchUserNamesForIds`](src/lib/scheduleDispatchHub.ts); **Only people with blocks this week** (on by default); uncheck to show full roster with empty cells; muted **· Salary** suffix from [`fetchSalariedUserIdSetFromUserIds`](src/lib/salaryPayConfigGate.ts) (`people_pay_config.is_salary` by user name); Sun–Sat stacked chips open **`jobId`** + **`week`** grid.
- **Detail**: **Week overview (all jobs)** link returns to hub with same **`week`**. **`week`** in URL normalized when hub or detail loads ([`ScheduleDispatch.tsx`](src/pages/ScheduleDispatch.tsx)).
- **Errors**: schedule summary fetch failure → toast + **0** counts; jobs fetch failure → inline error.

---

## Latest Updates (v2.255)

**Date**: 2026-04-07

### Schedule dispatch — Week grid (team rows × day columns)

- **Route**: [`/schedule-dispatch`](src/pages/ScheduleDispatch.tsx) with **`jobId`** (required for grid) and optional **`week`** (Sunday `YYYY-MM-DD`, normalized to Chicago week start via [`companyWeekStartSundayContaining`](src/utils/dateUtils.ts)).
- **UI**: [`ScheduleDispatchGrid.tsx`](src/components/schedule/ScheduleDispatchGrid.tsx) — sticky name column; **Add block** per cell; **+** on cards for **Linked** / **Solo** copy; **Remove** on cards; **@dnd-kit** drag: solo → another day or person; linked crew → cross-day group move (**v2.258**).
- **Data**: [`fetchJobScheduleBlocksForJobDateRange`](src/lib/jobScheduleBlocks.ts); add/save uses same overlap rules as [`ScheduleJobModal`](src/components/jobs/ScheduleJobModal.tsx) ([`fetchScheduleBlocksForAssigneesOnDay`](src/lib/jobScheduleBlocks.ts)).
- **Nav**: **Dispatch** link (dev / master / assistant / superintendent); superintendent [`SUPERINTENDENT_PATHS`](src/components/Layout.tsx). **Jobs** thread panel: **Week dispatch** next to **Schedule** ([`JobThreadNotesPanel`](src/components/JobThreadNotesPanel.tsx)); **Schedule** + **Week dispatch** also for superintendent when the job has team members.
- **Docs**: [ACCESS_CONTROL.md](ACCESS_CONTROL.md) page matrix.

---

## Latest Updates (v2.254)

**Date**: 2026-04-07

### Jobs & Calendar — Schedule modal, Job preview, planned work chips

- **Database**: **`job_schedule_blocks`** ([`20260407033913_job_schedule_blocks.sql`](supabase/migrations/20260407033913_job_schedule_blocks.sql)) — assignee, **`work_date`**, Central **4:00–20:00** window, note; RLS read like job thread / team; write for dev / master_technician / assistant / superintendent with job access. **`list_assigned_jobs_for_dashboard`** + **`project_id`** ([`20260407034037_list_assigned_jobs_project_id.sql`](supabase/migrations/20260407034037_list_assigned_jobs_project_id.sql)).
- **Jobs Stages**: **[`JobThreadNotesPanel`](src/components/JobThreadNotesPanel.tsx)** header **Schedule** (dev / master / assistant) → **[`ScheduleJobModal`](src/components/jobs/ScheduleJobModal.tsx)** (day pager, team timeline, add/remove blocks). **[`Jobs.tsx`](src/pages/Jobs.tsx)**.
- **Calendar**: Workflow chips open **[`PreviewJobModal`](src/components/calendar/PreviewJobModal.tsx)** (stages, team jobs, your schedule rows; subs no **Open in Jobs**); indigo **planned** chips + day modal **Planned work**. **[`Calendar.tsx`](src/pages/Calendar.tsx)**.
- **Lib**: [`jobScheduleBlocks.ts`](src/lib/jobScheduleBlocks.ts), [`jobScheduleChicago.ts`](src/lib/jobScheduleChicago.ts), [`jobScheduleOverlap.ts`](src/lib/jobScheduleOverlap.ts), [`ScheduleDayTimeline.tsx`](src/components/jobs/ScheduleDayTimeline.tsx)

---

## Latest Updates (v2.253)

**Date**: 2026-04-06

### Calendar — Per-session chips and day modal detail

- **Data**: Single month fetch uses **`CLOCK_SESSION_CALENDAR_SELECT`** ([`clockSessionSelect.ts`](src/lib/clockSessionSelect.ts)) with **`jobs_ledger`** / **`bids`** embeds; **`rejected_at`** / **`revoked_at`** null only (same semantics as recorded-hour totals via [`aggregateCalendarClockedHoursByDate`](src/lib/calendarClockedHoursByDate.ts)).
- **Grid** (when **Show recorded time** is on): existing **Recorded Xh** summary chip unchanged; added capped per-session chips (**America/Chicago** range + job/bid label; tooltips with notes) via [`calendarClockSessionDisplay.ts`](src/lib/calendarClockSessionDisplay.ts).
- **Day modal**: **Clock sessions** section lists all sessions for that day (job line, duration, **Scheduled** when **`origin === 'salary_schedule'`**, notes).
- **Page**: [`Calendar.tsx`](src/pages/Calendar.tsx)

---

## Latest Updates (v2.252)

**Date**: 2026-04-08

### People — Pay History: Draft Payroll, crew data, employee credits, Record payment

- **Draft Payroll**: Opening **Draft Payroll** seeds the pay period with the **prior** Sunday–Saturday week (**`en-CA`**) via **`getPriorWeekPayStubRangeEnCa()`** in **[`People.tsx`](src/pages/People.tsx)**.
- **Crew data for review**: While Draft Payroll is open, **`mergeCrewJobsForDateRange`** loads **`people_crew_jobs`** / **`people_crew_bids`** for that period and merges into **`crewJobsByDatePerson`**; **`draftPayrollCrewMergeFetchIdRef`** ignores stale async results.
- **`employee_credit` on `person_offsets`**: Migration **[`20270408163000_person_offsets_employee_credit_type.sql`](supabase/migrations/20270408163000_person_offsets_employee_credit_type.sql)** extends **`person_offsets.type`** with **`employee_credit`** (amount owed *to* the person, e.g. overpayment stored as a pending offset). **[`PersonOffsetFormModal.tsx`](src/components/pay/PersonOffsetFormModal.tsx)**; **Offsets** tab + pay stub HTML in **[`People.tsx`](src/pages/People.tsx)**; **[`PayStubLessModal.tsx`](src/components/pay/PayStubLessModal.tsx)** lists **Employee credit** but does **not** offer **Apply** (credits are not **Less** deductions).
- **Record payment**: One **Amount paid** field; **Confirm** records **`min(parsed, remaining)`** (no error when the typed amount exceeds balance). When over, an optional block explains the excess and offers **Record employee credit…** into a pending **`person_offsets`** row.
- **Jobs — Job Summary**: RPC **`get_invoice_allocation_lines_for_jobs`** (**[`20270408160000_invoice_allocation_lines_for_job_summary.sql`](supabase/migrations/20270408160000_invoice_allocation_lines_for_job_summary.sql)**) returns per-invoice supply-house allocation lines for **Parts Cost** (visibility aligned with **`get_invoice_amounts_for_jobs`**); **[`Jobs.tsx`](src/pages/Jobs.tsx)**.
- **Stale tally (staff split save)**: **`replace_mercury_job_splits_for_linked_card_as_staff`** (**[`20270408161000_tally_staff_split_save_align_subcontractor_targets.sql`](supabase/migrations/20270408161000_tally_staff_split_save_align_subcontractor_targets.sql)**) aligns saved splits with staff job search for subcontractor targets (full **`jobs_ledger`** visibility where search allows it, not **`jobs_ledger_team_members`** per row).

---

## Latest Updates (v2.251)

**Date**: 2026-04-06

### Dashboard — Jobs worked today: approve controls (parity with Clocked in today)

- **UI**: [`DashboardTeamActiveClockStrip.tsx`](src/components/DashboardTeamActiveClockStrip.tsx) — expanded **Jobs worked today** per-session rows include **`ClockSessionStripApproveControl`** (short approve, long-press actions modal) with the same wiring as **Clocked in today** detail lines.
- **Docs**: [`PROJECT_DOCUMENTATION.md`](PROJECT_DOCUMENTATION.md) Dashboard **Currently clocked in** / **Jobs worked today**

---

## Latest Updates (v2.250)

**Date**: 2026-04-06

### Dashboard / Quickfill — My Time: prior-week acknowledgment + two-week edit window

- **UI**: [`DashboardMyTimeDayEditorModal.tsx`](src/components/DashboardMyTimeDayEditorModal.tsx) — save/edit window is **America/Chicago** **this week + last week** via [`getThisAndLastWeekRange()`](src/utils/dateUtils.ts). Days in **last week** show an **Editing a prior week** step (**Continue editing** / **Cancel**) before the timeline; days **older** than last week stay read-only with copy pointing to **People → Hours**. **`editableRange`** prop is **ignored** for gating (callers no longer pass it).
- **Docs**: [`PROJECT_DOCUMENTATION.md`](PROJECT_DOCUMENTATION.md) Dashboard **My Time**

---

## Latest Updates (v2.249)

**Date**: 2026-04-08

### Salary split sync: overlap guard uses `work_date` or clock-in civil date (template TZ)

- **Database**: [`20270408153000_salary_sync_split_overlap_clock_in_tz_date.sql`](supabase/migrations/20270408153000_salary_sync_split_overlap_clock_in_tz_date.sql) — **`salary_sync_one_user_clock_sessions`**: in **split** template mode, the **NOT EXISTS** overlap checks for canonical slots **1** and **2** treat a session as on the sync day when **`cs.work_date = p_work_date`** **or** **`(cs.clocked_in_at AT TIME ZONE tz)::date = p_work_date`** ( **`tz`** from effective template or day override), not **`work_date` alone**.
- **Why**: avoids a duplicate empty canonical **`salary_segment_index = 1`** row when a **`user_punch`** segment’s **`work_date`** differs from **`p_work_date`** but clock-in civil date in template TZ matches the sync day (overnight / boundary cases).
- **Docs**: [`SALARY_CLOCK_SESSIONS.md`](SALARY_CLOCK_SESSIONS.md), [`MIGRATIONS.md`](MIGRATIONS.md)

---

## Latest Updates (v2.248)

**Date**: 2026-04-06

### Dashboard / Quickfill — stale tally Assign to jobs: full ledger search for staff

- **Database**: [`20260406175808_tally_assign_search_all_jobs_staff.sql`](supabase/migrations/20260406175808_tally_assign_search_all_jobs_staff.sql) — **`search_jobs_for_tally_mercury_assign_as_user`**: **non-subcontractor** targets + invoker **`dev`** / **`master_technician`** / **`assistant`** → no **`jobs_ledger_row_visible_for_tally_assign`** row filter (all **`jobs_ledger`** matches **`search_text`**, **`LIMIT 50`** per query); **subcontractor** targets unchanged (team-only); other invokers use **`jobs_ledger_row_visible_for_tally_assign(jl.id, auth.uid())`**
- **Impact**: [`MercuryTransactionAllocationsModal.tsx`](src/components/MercuryTransactionAllocationsModal.tsx) (**`tallyActAsUserId`** path unchanged)
- **Docs**: [`MIGRATIONS.md`](MIGRATIONS.md)

---

## Latest Updates (v2.247)

**Date**: 2026-04-06

### Dashboard / Quickfill — stale tally Assign to jobs: staff job search

- **Database**: [`20260406173212_stale_tally_staff_job_search_scope.sql`](supabase/migrations/20260406173212_stale_tally_staff_job_search_scope.sql) — **`search_jobs_for_tally_mercury_assign_as_user`**: for **non-subcontractor** **`p_for_user_id`**, **`jobs_ledger_row_visible_for_tally_assign`** uses **`auth.uid()`** (staff invoker); **subcontractor** targets still use **`p_for_user_id`** (team-only, save-safe with **`replace_mercury_job_splits_for_linked_card_as_staff`**)
- **Impact**: [`MercuryTransactionAllocationsModal.tsx`](src/components/MercuryTransactionAllocationsModal.tsx) (**`tallyActAsUserId`** path unchanged)
- **Docs**: [`MIGRATIONS.md`](MIGRATIONS.md)

---

## Latest Updates (v2.246)

**Date**: 2027-04-09

### Dashboard / Quickfill — stale tally follow-up: assistant scope (Option A)

- **Database**: [`20270408151000_tally_staff_followup_assistant_adopted_masters_job_team.sql`](supabase/migrations/20270408151000_tally_staff_followup_assistant_adopted_masters_job_team.sql) — **`staff_can_view_user_for_tally_followup`**: **assistant** limited to **`assistants_share_master`**, adopting **master**, or **`jobs_ledger`** team members on jobs for any adopted master (reverts Option B / **`20270408150000`** company-wide behavior)
- **Docs**: [`ACCESS_CONTROL.md`](ACCESS_CONTROL.md), [`MIGRATIONS.md`](MIGRATIONS.md)

---

## Latest Updates (v2.245)

**Date**: 2027-04-08

### Dashboard / Quickfill — stale tally follow-up: assistants see all targets

- **Database**: [`20270408150000_tally_staff_followup_assistant_any_target.sql`](supabase/migrations/20270408150000_tally_staff_followup_assistant_any_target.sql) — **`staff_can_view_user_for_tally_followup`**: **`assistant`** matches **dev** (any **`p_target`**); **master_technician** rules unchanged
- **Docs**: [`ACCESS_CONTROL.md`](ACCESS_CONTROL.md) stale tally staff follow-up row
- **Impact**: Assistants get the same company-wide stale Mercury follow-up list and staff assign eligibility as dev (downstream job/split validation unchanged)

---

## Latest Updates (v2.244)

**Date**: 2026-04-06

### Estimates — Customer activity audit and timeline IP

- **Database**: [`20260406033952_estimates_audit_customer_accepted_trigger.sql`](supabase/migrations/20260406033952_estimates_audit_customer_accepted_trigger.sql) — **`AFTER UPDATE OF status`** on **`estimates`**: on **`sent` → `customer_accepted`**, inserts **`estimate_customer_events`** (**`public_accept_submitted`**) with **`client_ip` / `user_agent` / metadata** aligned with **`acceptor_*`** columns; [`20260406034514_record_estimate_public_link_view_rpc.sql`](supabase/migrations/20260406034514_record_estimate_public_link_view_rpc.sql) — **`record_estimate_public_link_view`** ( **`service_role`** only) appends **`public_link_view`** while the quote is still **`sent`**
- **Edge**: [`get-estimate-for-customer`](supabase/functions/get-estimate-for-customer/index.ts) — **`rpc('record_estimate_public_link_view', …)`** before **200**; [`accept-estimate`](supabase/functions/accept-estimate/index.ts) — first accept relies on trigger only; **`alreadyAccepted`** path calls [`insertEstimateCustomerEvent`](supabase/functions/_shared/logEstimateCustomerEvent.ts) (**`log_estimate_customer_event`** + insert fallback, **`metadata.repeat_after_accepted`**)
- **UI**: [`Estimates.tsx`](src/pages/Estimates.tsx) **Customer activity** — same **` · {ip}`** treatment for **link** and **accept** lines when **`client_ip`** is present

---

## Latest Updates (v2.243)

**Date**: 2026-04-05

### Settings (dev) — faster initial load

- **Database**: [`20260405213504_settings_job_counts_by_master.sql`](supabase/migrations/20260405213504_settings_job_counts_by_master.sql) — **`list_job_counts_by_master_for_dev_settings()`** (`SECURITY DEFINER`, **`is_dev()`** only) returns **`jobs_ledger`** counts grouped by **`master_user_id`** (non-null), replacing a full-table **`master_user_id`** select on the client
- **UI**: [`Settings.tsx`](src/pages/Settings.tsx) **`loadData`** — dev-only RPC via **`withSupabaseRetry`** (failure yields empty counts, page still finishes loading); **`Promise.all`** for master/dev adoption loaders and for dev notification/email/pay-approved loaders; single **`app_settings`** **`in('key', …)`** batch for labor rate, prospect copy, estimate experience keys, report window settings; parallel batch for catalog fetch, job-owner overrides, archived users, report/dispatch/estimator membership

---

## Latest Updates (v2.242)

**Date**: 2026-04-13

### Quickfill — Warnings (stale tally staff follow-up)

- **Shared**: [`useStaleTallyStaffFollowUp.ts`](src/hooks/useStaleTallyStaffFollowUp.ts), [`tallyStaleMinAgeDays.ts`](src/lib/tallyStaleMinAgeDays.ts) — Dashboard and Quickfill use the same RPC refresh (mount + **`window` `focus`** + post-assign **`refetch`**)
- **Quickfill**: [`Quickfill.tsx`](src/pages/Quickfill.tsx) — **`warnings`** first in **`SECTIONS`**; section + jump chip only when follow-up rows exist (Option A); **`QuickfillSectionWrapper`** with mark/collapse like other sections
- **Dashboard**: [`Dashboard.tsx`](src/pages/Dashboard.tsx) — removed duplicate staff follow-up loader/effects in favor of the hook

---

## Latest Updates (v2.241)

**Date**: 2026-04-12

### Dashboard — stale tally staff follow-up (banner + modal)

- **Database**: [`20260405211552_tally_stale_staff_followup.sql`](supabase/migrations/20260405211552_tally_stale_staff_followup.sql) — **`staff_can_view_user_for_tally_followup`**, **`list_stale_unlinked_mercury_transactions_for_tally_staff`**, **`search_jobs_for_tally_mercury_assign_as_user`**, **`replace_mercury_job_splits_for_linked_card_as_staff`**
- **UI**: **[`DashboardTallyStaleStaffBanner.tsx`](src/components/DashboardTallyStaleStaffBanner.tsx)** (dev / master_technician / assistant only) below the orange personal stale banner; opens **[`DashboardStaleTallyStaffFollowUpModal.tsx`](src/components/DashboardStaleTallyStaffFollowUpModal.tsx)** with per-person contact links (**mailto** / **tel**) and **Assign** → **[`MercuryTransactionAllocationsModal`](src/components/MercuryTransactionAllocationsModal.tsx)** with **`tallyActAsUserId`**. **[`Dashboard.tsx`](src/pages/Dashboard.tsx)** refreshes list counts on mount, **`window` `focus`**, and after save

---

## Latest Updates (v2.240)

**Date**: 2026-04-05

### Dashboard — stale Job Parts Tally transactions banner

- **Database**: [`20260405101849_count_unlinked_tally_stale_by_age.sql`](supabase/migrations/20260405101849_count_unlinked_tally_stale_by_age.sql) — **`count_unlinked_mercury_transactions_for_tally_stale(min_age_days)`** (default **2**); same scope as **`count_unlinked_mercury_transactions_for_tally`** (**`job_tally_min_posted_ymd`**, linked card, no **`mercury_transaction_job_allocations`**), plus **`posted_at`** Chicago calendar-day age **strictly greater than** **`min_age_days`**
- **UI**: **[`DashboardTallyStaleBanner.tsx`](src/components/DashboardTallyStaleBanner.tsx)** above the tally + Job Report row when count **> 0** (full-width button, count chip, navigates **`/tally?tab=transactions`**); **[`Dashboard.tsx`](src/pages/Dashboard.tsx)** loads with **`withSupabaseRetry`** and refreshes on **`window` `focus`** alongside the existing unlinked tally badge count

---

## Latest Updates (v2.239)

**Date**: 2026-04-11

### Estimates — unlink job, sent customer links, confirm modal

- **Unlink job** ([`Estimates.tsx`](src/pages/Estimates.tsx)): on **customer_accepted** detail, when **`job_ledger_id`** is set, **Unlink job** clears only the estimate’s link (**`job_ledger_id` → null**); the **Jobs** row is unchanged. Confirmation uses an in-app **modal** (title **Unlink job**; **Cancel** / **Unlink**; overlay **`zIndex` 1002**), not **`window.confirm`**.
- **Sent** — **Copy customer link** / **Open customer link** appear **below** the amber *Waiting for customer…* paragraph. Shared control: [`EstimateCustomerAcceptLinkButtons.tsx`](src/components/estimates/EstimateCustomerAcceptLinkButtons.tsx). When status is **`sent`**, that pair is **not** repeated at the top of the **Customer experience** `<details>` ( **`draft`** and **`customer_accepted`** unchanged).

---

## Latest Updates (v2.238)

**Date**: 2026-04-11

### Estimates → Jobs — create job and reverse link

- **Database**: [`20260405072854_estimate_create_job_rpc.sql`](supabase/migrations/20260405072854_estimate_create_job_rpc.sql) — **`create_job_from_estimate`** RPC; partial unique **`estimates(job_ledger_id)`**
- **Estimates** ([`Estimates.tsx`](src/pages/Estimates.tsx)): accepted, unlinked estimates — **Create job from estimate** modal (HCP #, optional name/address/revenue); success navigates **`/jobs?edit={id}`**; linked jobs use **Open in Jobs**; shared helpers [`jobLedgerCustomer.ts`](src/lib/jobLedgerCustomer.ts), [`jobFromEstimateDefaults.ts`](src/lib/jobFromEstimateDefaults.ts), [`resolveEffectiveJobMasterUserId.ts`](src/lib/resolveEffectiveJobMasterUserId.ts)
- **Jobs** ([`Jobs.tsx`](src/pages/Jobs.tsx)): **Edit Job** shows **Source estimate** when **`estimates.job_ledger_id`** points at this job; **View contract & acceptance** opens [`CustomerAcceptanceRecordModal`](src/components/estimates/CustomerAcceptanceRecordModal.tsx) (read-only snapshot + signature)

---

## Latest Updates (v2.237)

**Date**: 2026-04-11

### Estimates — acceptance layout and quote header

- **Approve Estimate modal** ([`EstimateAcceptBody.tsx`](src/components/estimates/EstimateAcceptBody.tsx)): the **`accept_instructions`** line is omitted in the modal only; **Submit acceptance** (and staff preview disabled submit state) are centered below the agreement checkbox.
- **Quote document** ([`EstimateCustomerDocument.tsx`](src/components/estimates/EstimateCustomerDocument.tsx)): **Line items** total row (**`doc_total_label`** + amount) is **right-aligned** for public accept and any UI that reuses the component.
- **Staff estimate detail** ([`Estimates.tsx`](src/pages/Estimates.tsx)): header uses one **`h1`** line with a muted **`# {estimate_number}`** prefix before the title (**Edit title** unchanged for drafts).
- **Customer acceptance** record (inline, when an estimate is already accepted and staff view shows the record): below the **Customer acceptance** heading, show the same signature **disclosure** as the modal (`ESTIMATE_ACCEPT_MODAL_SIGNATURE_DISCLOSURE`) and a **checked, disabled** agreement checkbox whose label is the resolved **`acceptCheckboxLabel`** (**`accept_checkbox_label`** / Settings), then **Full name** and signature.

---

## Latest Updates (v2.236)

**Date**: 2026-04-10

### Estimates — Line item catalog modal header

- **UI**: Single header row for the **Line item catalog** dialog: **Line item catalog** (title), then **Insert from catalog** and **Edit book** tab buttons when the user can manage the catalog (`canManageEstimateCatalog`), then **×**; close button uses **`marginLeft: 'auto'`** so it stays on the trailing edge; row **`flexWrap`** for narrow viewports. Filter and list / edit body unchanged. [`Estimates.tsx`](src/pages/Estimates.tsx).

---

## Latest Updates (v2.235)

**Date**: 2026-04-09

### Estimates — Preview as customer matches unsaved draft (cross-tab)

- **Cause**: The staff preview snapshot used **`sessionStorage`**, which is **not** shared with a tab opened via **`window.open`**, so [`EstimateAcceptStaffPreview`](src/pages/EstimateAcceptStaffPreview.tsx) often fell back to **DB** title and body (e.g. stale **"New estimate"**).
- **Fix**: [`estimateStaffAcceptPreview.ts`](src/lib/estimateStaffAcceptPreview.ts) — write a **v2** envelope to **`localStorage`** (`writtenAt` + payload, **1 hour TTL**), **parse-then-`removeItem`** only after validation; try legacy **`sessionStorage`** if **`localStorage`** miss; clear key on corrupt or expired payload.

---

## Latest Updates (v2.234)

**Date**: 2026-04-08

### Estimates — configurable customer copy (defaults + per-draft + send snapshot)

- **Database**: [`20260405010252_estimate_customer_experience_defaults_snapshot.sql`](supabase/migrations/20260405010252_estimate_customer_experience_defaults_snapshot.sql) — **`estimate_*`** rows in **`app_settings`**; **`customer_experience_overrides`** / **`customer_experience_sent`** on **`public.estimates`**; post-accept trigger freezes both json columns.
- **Shared logic**: [`src/lib/estimateCustomerExperience.ts`](src/lib/estimateCustomerExperience.ts) and [`supabase/functions/_shared/estimateCustomerExperience.ts`](supabase/functions/_shared/estimateCustomerExperience.ts) — merge builtins → **`app_settings`** → overrides; template substitution; snapshot parse.
- **Edge**: [`send-estimate-to-customer`](supabase/functions/send-estimate-to-customer/index.ts) writes **`customer_experience_sent`** with the email that was sent; [`get-estimate-for-customer`](supabase/functions/get-estimate-for-customer/index.ts) returns **`customer_experience`** (public UI only, no email fields) on **200** and on **409** **`already_accepted`** for thank-you.
- **App**: [`Settings.tsx`](src/pages/Settings.tsx) (dev) **Estimate customer experience defaults**; [`Estimates.tsx`](src/pages/Estimates.tsx) optional per-draft overrides + previews from resolver; [`EstimateAccept.tsx`](src/pages/EstimateAccept.tsx), [`EstimateCustomerDocument.tsx`](src/components/estimates/EstimateCustomerDocument.tsx), [`EstimateCustomerThankYou.tsx`](src/components/estimates/EstimateCustomerThankYou.tsx).

---

## Latest Updates (v2.233)

**Date**: 2026-04-07

### Estimates — global Quote #, quote URLs, customer experience previews

- **Database**: [`20260405003103_estimates_global_estimate_number.sql`](supabase/migrations/20260405003103_estimates_global_estimate_number.sql) — **`estimate_number`** (global sequence, immutable after assignment; gaps possible if drafts deleted); post-accept trigger extended so **`estimate_number`** cannot change once accepted.
- **Staff URLs**: Canonical **`/estimates/{estimate_number}`**; legacy **`/estimates/{uuid}`** still loads and **`replace`**-navigates to the numeric segment ([`Estimates.tsx`](src/pages/Estimates.tsx)). New draft navigates to the assigned quote URL after insert.
- **List / detail**: **Quote #** column; detail header **Quote #:** line.
- **Customer experience** (collapsible on estimate detail): **Email**, **Acceptance page**, **Thank you** (v2.234+: [`estimateCustomerExperience.ts`](src/lib/estimateCustomerExperience.ts)); [`EstimateCustomerDocument.tsx`](src/components/estimates/EstimateCustomerDocument.tsx) / [`EstimateCustomerThankYou.tsx`](src/components/estimates/EstimateCustomerThankYou.tsx) with [`EstimateAccept.tsx`](src/pages/EstimateAccept.tsx).
- **Send flow**: API/Edge may return **`accept_url`**; staff can copy/open the customer link after send when Resend is skipped or for verification.
- **Docs**: [`PROJECT_DOCUMENTATION.md`](PROJECT_DOCUMENTATION.md) Estimates section, [`MIGRATIONS.md`](MIGRATIONS.md), [`EDGE_FUNCTIONS.md`](EDGE_FUNCTIONS.md) **send-estimate-to-customer**.

---

## Latest Updates (v2.232)

**Date**: 2026-04-04

### Estimates (Approach A) — customer acceptance

- **Database**: [`20260404212052_estimates_approach_a.sql`](supabase/migrations/20260404212052_estimates_approach_a.sql) — `public.estimates`, `estimate_status`, RLS (`user_can_access_estimate`, `superintendent_can_access_estimate`), trigger protecting rows after `customer_accepted`.
- **Edge**: [`get-estimate-for-customer`](supabase/functions/get-estimate-for-customer/index.ts), [`accept-estimate`](supabase/functions/accept-estimate/index.ts), [`send-estimate-to-customer`](supabase/functions/send-estimate-to-customer/index.ts); [`supabase/config.toml`](supabase/config.toml) `verify_jwt = false` for all three.
- **App**: [`Estimates.tsx`](src/pages/Estimates.tsx) (list + detail, send link), public [`EstimateAccept.tsx`](src/pages/EstimateAccept.tsx), [`App.tsx`](src/App.tsx) routes; [`Layout.tsx`](src/components/Layout.tsx) nav between Materials and Bids; [`pinnedTabs.ts`](src/lib/pinnedTabs.ts) `/estimates`.
- **Docs**: [`EDGE_FUNCTIONS.md`](EDGE_FUNCTIONS.md), [`PROJECT_DOCUMENTATION.md`](PROJECT_DOCUMENTATION.md) Estimates section, [`ACCESS_CONTROL.md`](ACCESS_CONTROL.md).

---

## Latest Updates (v2.231)

**Date**: 2026-04-03

### Dashboard / My Time / impersonation — strip editor entry, overlap visibility, labels

- **Jobs worked today**: In [`DashboardTeamActiveClockStrip.tsx`](src/components/DashboardTeamActiveClockStrip.tsx), each per-job session **duration** is a button when **`onOpenStripMyTimeEditor`** is set (dev / master / assistant / superintendent), opening **`DashboardMyTimeDayEditorModal`** for that **`user_id`** — same parent wiring as **Clocked in today** **Today** hours ([`Dashboard.tsx`](src/pages/Dashboard.tsx), [`QuickfillPeopleHoursNewSection.tsx`](src/components/quickfill/QuickfillPeopleHoursNewSection.tsx)).
- **Clock interval overlap UX** (client-only): **[`hasPairwiseClockIntervalOverlap`](src/lib/myTimeDayTimeline.ts)** (`ClockIntervalRow`, intersection **`> CLUSTER_CONTIGUITY_EPS_MS`**). **[`ClockedInTodayStripRow`](src/hooks/useDashboardMyTeamSectionState.ts)** includes **`hasIntervalOverlapToday`**; amber **Overlap** badge in **Clocked in today** and **Jobs worked today** detail ([`StripClockOverlapBadge`](src/components/DashboardTeamActiveClockStrip.tsx)). **[`DashboardMyTimeDayEditorModal.tsx`](src/components/DashboardMyTimeDayEditorModal.tsx)** — per-cluster **Overlapping clock times** callout. **[`MyTimeDayClusterForm`](src/components/my-time-day-editor/MyTimeDayClusterForm.tsx)** / **[`MyTimeDayClusterVisual`](src/components/my-time-day-editor/MyTimeDayClusterVisual.tsx)** — **Multiple jobs/bids in this span** when **`multiAlloc`**.
- **Impersonation**: **[`Layout.tsx`](src/components/Layout.tsx)** (desktop nav): visible **Back** with **`title="Back to my account"`** and descriptive **`aria-label`**. **[`Settings.tsx`](src/pages/Settings.tsx)** yellow banner: **Back to my Account** (full label).

---

## Latest Updates (v2.230)

**Date**: 2026-04-03

### People — Users tab: External Subcontractors

- **Users tab**: **Subcontractors** lists accounts **(with account)** first; roster-only subcontractor rows (**no** matching login email) appear under **External Subcontractors** ([`People.tsx`](src/pages/People.tsx) **`renderUsersTabRosterListItem`**, **`byKind('sub')`** partition).
- **Pay config roster**: label **Subcontractors (roster only)** renamed to **External Subcontractors** for consistency.

---

## Latest Updates (v2.229)

**Date**: 2026-04-03

### Salaried sessions — split indexed slots + sync overlap guard

- **Database**: [`20270403180000_salary_split_indexed_segments_overlap_sync_guard.sql`](supabase/migrations/20270403180000_salary_split_indexed_segments_overlap_sync_guard.sql) — **`split_own_clock_session_segments`**, **`split_own_clock_session_cluster`**, **`leader_split_clock_session_segments`**, **`leader_split_clock_session_cluster`**: when the parent row is **`salary_schedule`** with **`salary_segment_index` 1 or 2** (an auto split slot), replacement segments are **`user_punch`** with **`salary_segment_index` null** so cron sync does not treat them as canonical template rows. A **continuous** `salary_schedule` parent (`NULL` index) still yields indexed **`salary_schedule`** children when split into multiple parts.
- **`salary_sync_one_user_clock_sessions`**: in **split** template mode, before INSERT for canonical slot **1** or **2**, skip INSERT if **any** non-rejected/non-revoked session for that user/day **overlaps** the template window **`[t_start,t_end)`** or **`[t_start2,t_end2)`** (same half-open overlap test used for both slots).
- **Documentation**: **[`SALARY_CLOCK_SESSIONS.md`](SALARY_CLOCK_SESSIONS.md)** — operator/AI runbook (tables, RPCs, guards, migrations, **`db push`** without Docker vs **`db pull`** shadow DB). Updates in [`PROJECT_DOCUMENTATION.md`](PROJECT_DOCUMENTATION.md) (`clock_sessions`), [`GLOSSARY.md`](GLOSSARY.md), [`MIGRATIONS.md`](MIGRATIONS.md), [`EDGE_FUNCTIONS.md`](EDGE_FUNCTIONS.md) (**sync-salary-sessions**).

---

## Latest Updates (v2.228)

**Date**: 2026-04-02

### Settings — Salaried workday clarity and salary sync after split

- **Computed end times** ([`SalaryWorkScheduleSettings.tsx`](src/components/SalaryWorkScheduleSettings.tsx), [`salaryScheduleEndTimeDisplay.ts`](src/lib/salaryScheduleEndTimeDisplay.ts)): **Day end** (continuous 8h), **First Session End**, and **Second Session End** show the wall-clock end in the template timezone with **`(+1 day)`** when the block crosses midnight relative to the anchor work date (company calendar day for overrides).
- **Split layout default**: Switching **8 hours straight** → **Two sessions** coerces the first block to **4 h** when it was still a full **8 h**, so the first segment end label is not stuck at “8h from start” until the user changes the dropdown (`SPLIT_FIRST_BLOCK_DEFAULT_MINUTES`; same behavior on **Custom schedule for this date** when Straight → Split).
- **Database**: [`20270402100000_salary_sync_continuous_skip_insert_when_split_segments_exist.sql`](supabase/migrations/20270402100000_salary_sync_continuous_skip_insert_when_split_segments_exist.sql) — **`salary_sync_one_user_clock_sessions`** skips the **continuous** auto-INSERT path when pending **`salary_schedule`** rows already exist with **`salary_segment_index IS NOT NULL`** (after a continuous row was split into segments), preventing a duplicate session at the day start on sync.
- **Migration history**: Three accidental **empty** CLI-generated files (`20260403062347`, `20260403062432`, `20260403062639`, same slug) were **reverted** on the linked project via **`supabase migration repair --status reverted`** and **removed** from the repo; the canonical migration is **`20270402100000`** (see [`MIGRATIONS.md`](MIGRATIONS.md)).

---

## Latest Updates (v2.227)

**Date**: 2026-04-10

### Banking / Quickfill — live Mercury ledger refresh

- **Database**: [**`20260403051729_mercury_transactions_supabase_realtime.sql`**](supabase/migrations/20260403051729_mercury_transactions_supabase_realtime.sql) — add **`public.mercury_transactions`** to **`supabase_realtime`** (guarded) so clients receive **`postgres_changes`** for webhook/sync upserts.
- **UI**: [**`BankingSortingSnapshotSection.tsx`**](src/components/quickfill/BankingSortingSnapshotSection.tsx) — **`loadMercurySnapshot`** + **800 ms** debounced channel on **`mercury_transactions`** (**`silent`** refresh avoids loading flicker); [**`Banking.tsx`**](src/pages/Banking.tsx) — **`loadRows({ silent: true })`** with same debounce.
- **Docs**: [**`EDGE_FUNCTIONS.md`**](EDGE_FUNCTIONS.md) **`mercury-webhook`** — deployment + secrets + Mercury registration checklist; [**`MIGRATIONS.md`**](MIGRATIONS.md) April 3, 2026 entry; [**`PROJECT_DOCUMENTATION.md`**](PROJECT_DOCUMENTATION.md) Quickfill **Banking sorting** Realtime note.

---

## Latest Updates (v2.226)

**Date**: 2026-04-09

### Dashboard — Job Parts Tally unlinked count badge

- **Database**: [`count_unlinked_mercury_transactions_for_tally`](supabase/migrations/20260403044517_count_unlinked_mercury_transactions_for_tally.sql) — **`SECURITY DEFINER`** RPC returns how many **`mercury_transactions`** rows belong to the caller’s linked debit card(s) (**same JOIN as** **`list_my_linked_mercury_transactions_for_tally`**) and have **no** rows in **`mercury_transaction_job_allocations`** (matches Job Tally **Show unlinked**).
- **UI** ([`Dashboard.tsx`](src/pages/Dashboard.tsx)): Blue **Job Parts Tally** link is wrapped in a **`position: relative`** container; when the count is **> 0**, an amber pill shows **`1`–`99`** or **`99+`**; **`title`** and **`aria-label`** include the count; **`window` `focus`** re-fetches so returning from Tally can clear/update the badge without a full reload. No badge when count is **0** or load failed (**`null`**).

---

## Latest Updates (v2.225)

**Date**: 2026-04-08

### Job Parts Tally — Transactions search and Mercury note icon

- **Search** ([`src/lib/tallyTransactionSearch.ts`](src/lib/tallyTransactionSearch.ts)): Client-side filter applied after **Filter by card** and **Show all** / **Show unlinked** (`tallyTxRowsForSearch` → sort). **`buildTallyLinkedMercuryRowSearchHaystack`** includes counterparty, note, jobs summary, Mercury transaction id, amount, job labels from **`tallyJobLabelById`**, and raw split `hcp_number` / `job_name`. Empty query shows full scoped list; non-empty query with no matches shows **No transactions match your search** and **Clear search** (search controls stay visible).
- **UI** ([`src/pages/JobTally.tsx`](src/pages/JobTally.tsx)): **`type="search"`** field with placeholder **Counterparty, note, job, amount…**, **`aria-label="Search transactions"`** (no visible **Search transactions** heading), **Clear** when non-empty; **Transactions to sort** line adds **· Showing m of k** when filtering. Search block is **directly above** the table header row (**Posted**, **Amount**, **Counterparty**).
- **Mercury memo** ([`src/components/icons/MercuryTransactionNoteIcon.tsx`](src/components/icons/MercuryTransactionNoteIcon.tsx)): When `row.note` is non-empty, a **note** button (Font Awesome–style clipboard icon) appears in the **Counterparty** cell; click toggles the memo text in-row. Only one row’s note expanded at a time (`tallyOpenNoteTxId`); **Escape** closes; **`aria-expanded`**, **`aria-controls`**, and a note panel with **`role="region"`** and **`hidden`** when collapsed.
- **Splits helper** ([`src/lib/tallyJobSplits.ts`](src/lib/tallyJobSplits.ts)): **`parseTallyJobSplitsJson`** shared by Job Tally allocations, [`TallyJobTransactionsModal`](src/components/tally/TallyJobTransactionsModal.tsx), and search haystack enrichment.

---

## Latest Updates (v2.224)

**Date**: 2026-04-07

### Quickfill — section layout, Banking sorting snapshot, People Hours notice, Jobs Billing filter

- **Sections** ([`Quickfill.tsx`](src/pages/Quickfill.tsx)): Each block uses **`QuickfillSectionWrapper`** with a left-aligned **`h2`** (**`fontSize: 1.5rem`**, **`fontWeight: 700`**, same weight as the Banking page **`h1`**). **`firstVisibleSectionId`** (`useMemo`, same visibility order as **`SECTIONS`**) suppresses the top rule on the first visible section; others use **`withTopDivider`** (**`borderTop: 2px solid #94a3b8`**, **`paddingTop: 1.5rem`**). The hours section wrapper label matches **People Hours (Old)**.
- **No duplicate page titles**: Centered **`h2`** removed from [`BankingSortingSnapshotSection.tsx`](src/components/quickfill/BankingSortingSnapshotSection.tsx) and [`HoursSection.tsx`](src/components/quickfill/HoursSection.tsx); [`BilledAwaitingPaymentSection.tsx`](src/components/quickfill/BilledAwaitingPaymentSection.tsx) uses a left **summary** line (row count · total remaining). [`CrewJobsSection.tsx`](src/components/quickfill/CrewJobsSection.tsx) and [`SupplyHousesSection.tsx`](src/components/quickfill/SupplyHousesSection.tsx) pass **`showTitle={false}`** into **`CrewJobsBlock`** / **`SupplyHousesTab`**.
- **Banking sorting** ([`BankingSortingSnapshotSection.tsx`](src/components/quickfill/BankingSortingSnapshotSection.tsx)): No **Link** column; **Link…** (safety yellow) appears in **Person** when unassigned and in **Jobs** when not split; same **`MercuryTransactionAllocationsModal`** flow.
- **People Hours (new)** ([`QuickfillPeopleHoursNewSection.tsx`](src/components/quickfill/QuickfillPeopleHoursNewSection.tsx)): Amber notice — *Assistance only makes sure hours are correct, they do not approve!* — directly under the **Previous day** / date / **Next day** row (and **Today** when shown).
- **Jobs Billing** ([`JobsBillingReminderSection.tsx`](src/components/quickfill/JobsBillingReminderSection.tsx), [`Quickfill.tsx`](src/pages/Quickfill.tsx)): Yellow reminder counts only jobs with **`hcp_number`** parsing as an integer **≥ Min HCP** (default **406**); **Active sections** includes **Min HCP (inclusive)** for **Jobs Billing**; persisted as **`pipetooling_quickfill_jobs_billing_min_hcp`**.

---

## Latest Updates (v2.223)

**Date**: 2026-04-06

### Quickfill / Jobs — Crew Jobs / Bids live refresh and clock assign sync

- **UI**: [`CrewJobsBlock.tsx`](src/components/CrewJobsBlock.tsx) subscribes to Supabase **`postgres_changes`** on **`people_crew_jobs`** and **`people_crew_bids`** with filter **`work_date=eq.<selected date>`** (channel per date). On change, reloads that day’s grid plus **Team Job Labor** (**`loadTeamLaborData`**). Same component is used on **Quickfill** and **Jobs → Team Labor**.
- **Database**: [**`20260402120000_clock_sessions_sync_crew_assignments_trigger.sql`**](supabase/migrations/20260402120000_clock_sessions_sync_crew_assignments_trigger.sql) — trigger **`clock_sessions_sync_crew_assignments_tr`** (**`AFTER UPDATE OF job_ledger_id, bid_id`**) runs **`sync_crew_jobs_from_clock`** and **`sync_crew_bids_from_clock`** when the row is **approved**, not **rejected**, not **revoked**, and the user’s name is non-empty (e.g. **Assign** on the Dashboard strip after approval). Adds **`people_crew_jobs`** / **`people_crew_bids`** to **`supabase_realtime`** publication if absent so clients receive events.
- **Unchanged**: Auto-% from clocks still **skips** rows where **`crew_lead_person_name` is set** (followers inherit the lead); existing **`approve_clock_sessions`** / revoke paths still drive sync when only **`approved_at`** changes.

---

## Latest Updates (v2.222)

**Date**: 2026-04-05

### Quickfill — Banking sorting snapshot load and summary

- **Performance**: After loading Mercury transaction rows, [`BankingSortingSnapshotSection.tsx`](src/components/quickfill/BankingSortingSnapshotSection.tsx) runs **`fetchMercuryRelationsState`** and **`fetchMercuryNicknameMaps`** in parallel via **`Promise.all`** (same work as before; shorter wall-clock when the DB allows concurrency). Nickname fetch failures remain non-fatal (empty maps).
- **UI**: Summary row includes **Total available** (count of transactions matching the user’s Banking sorting filters, including rows already fully attributed). The long centered paragraph about incomplete rows and “paginated preview” was removed; **Showing x–y of n** above the table still describes pagination.

---

## Latest Updates (v2.221)

**Date**: 2026-03-31

### Banking — Mercury: Link to jobs equal split on add/remove

- **UI**: [`MercuryTransactionAllocationsModal.tsx`](src/components/MercuryTransactionAllocationsModal.tsx) **`redistributeEqualSplit`**: searching in **Link to jobs & person** and **removing** a row rebalance lines to **equal %** (100%, 50/50, equal thirds, …). **Notes** and labels are preserved; if rounded % to dollars drifts by a cent vs the charge total, the **last** row switches to **$** for the remainder so **Save** stays valid. **Opening** the modal with **saved** splits still loads **$** amounts from the DB (unchanged **`initialAllocations`** hydration).

---

## Latest Updates (v2.220)

**Date**: 2026-04-04

### Jobs — Parts: Mercury card charges as positive cost

- **Behavior**: [`Jobs.tsx`](src/pages/Jobs.tsx) aggregates **`mercury_transaction_job_allocations.amount`** with **`Math.abs`** per job when building **`mercuryCardChargesByJobId`**, so the Parts **card** column, combined parts total, and **`partsCost` / profit** treat Banking splits as positive dollars (DB still stores Mercury-signed rows for validation).

---

## Latest Updates (v2.219)

**Date**: 2026-04-03

### Banking — Link to jobs & person (positive charge UI, % / $, notes)

- **Schema**: **`mercury_transaction_job_allocations.note`** ([**`20260402003356_mercury_job_allocation_note.sql`**](supabase/migrations/20260402003356_mercury_job_allocation_note.sql)); **`replace_mercury_transaction_splits`** reads optional **`note`** from each **`p_rows`** element.
- **UI**: [`MercuryTransactionAllocationsModal.tsx`](src/components/MercuryTransactionAllocationsModal.tsx) shows **charge total** as **`abs(mercury_transactions.amount)`**; per-line **$** or **%** of that total; **Fill remainder**; optional **note**; saves signed amounts matching Mercury. [`Banking.tsx`](src/pages/Banking.tsx) loads **`note`**; **Jobs** chip total uses **absolute** split amounts.

---

## Latest Updates (v2.218)

**Date**: 2026-04-02

### Banking — Mercury person attribution (users + legacy people)

- **Schema**: Optional **`user_id`** on **`mercury_transaction_attributions`** (exactly one of **`user_id`** or legacy **`person_id`**); RPCs **`list_users_for_banking_attribution`** and **`replace_mercury_transaction_splits`** **`p_user_id`** ([**`20260402001226_mercury_attribution_user_id.sql`**](supabase/migrations/20260402001226_mercury_attribution_user_id.sql)).
- **UI**: [`Banking.tsx`](src/pages/Banking.tsx) and [`MercuryTransactionAllocationsModal.tsx`](src/components/MercuryTransactionAllocationsModal.tsx) attribute Mercury splits to an **auth user** or legacy **people** row where applicable.

---

## Latest Updates (v2.217)

**Date**: 2026-04-01

### Banking — sort columns and account nicknames

- **Sort**: Table headers **Posted**, **Account**, and **Mercury ID** toggle sort (**asc** / **desc**); default **Posted** newest first. **Filtered total** uses the same visible row order as the grid.
- **Nicknames**: Table **`mercury_account_nicknames`** ([**`20260401195701_mercury_account_nicknames.sql`**](supabase/migrations/20260401195701_mercury_account_nicknames.sql)); **RLS** dev **`SELECT` / `INSERT` / `UPDATE` / `DELETE`**. [`Banking.tsx`](src/pages/Banking.tsx) loads labels, shows **nickname** (or short id) in the **Account** column and in the account filter **select**; **Account nicknames** block: **Save** (upsert), **Clear** (delete row when a label exists).

---

## Latest Updates (v2.216)

**Date**: 2026-04-01

### Auth — single `AuthProvider`

- **`AuthProvider`** in [`src/hooks/useAuth.ts`](src/hooks/useAuth.ts) supplies auth user + role via React context; **`useAuth()`** consumes it (throws if there is no provider).
- [`src/main.tsx`](src/main.tsx) wraps **`App`** with **`AuthProvider`** inside **`BrowserRouter`** so the tree shares one session subscription and avoids redundant reload behavior.

### Bids — workflow tab titles

- **`bidWorkflowTabHeading`** in [`src/pages/Bids.tsx`](src/pages/Bids.tsx): Bid workflow **`h2`** tabs use **`B{bid_number}`** plus **`bidDisplayName`** (space-separated) when **`bid_number`** is set — no em dash between number and title.

### My Time — leader clock edits for master, assistant, superintendent

- Migration [**`20260401190823_can_edit_clock_sessions_option_a_roles.sql`**](supabase/migrations/20260401190823_can_edit_clock_sessions_option_a_roles.sql) **`CREATE OR REPLACE`s** **`can_edit_clock_sessions_for_user`**: **`master_technician`**, **`assistant`**, and **`superintendent`** satisfy the helper when applying leader **split/replace** RPCs for another user’s sessions (same “team lead” path as dev). See **`ACCESS_CONTROL.md`** for the security breadth note.

### My Time — merge up / down after a split

- **Bug**: **`removeSegmentMergeWithPrev` / `removeSegmentMergeWithNext`** in [`src/lib/myTimeDayTimeline.ts`](src/lib/myTimeDayTimeline.ts) used **`nextBounds.length < 3`**, which prevented merging **two** segments **into one** (e.g. after a single split — merge buttons appeared but the reducer rejected the update).
- **Fix**: guard **`nextBounds.length < 2`** so a single remaining segment is allowed; **MIN_SEGMENT_MS** rules unchanged.

---

## Latest Updates (v2.215)

**Date**: 2026-04-01

### Banking (dev-only) — Mercury transaction ledger

- **Table**: **`mercury_transactions`** ([`20260401052909_mercury_transactions_ledger.sql`](supabase/migrations/20260401052909_mercury_transactions_ledger.sql)); RLS: dev **`SELECT`** only; service-role upserts from Edge Functions.
- **Sync**: [`sync-mercury-transactions`](supabase/functions/sync-mercury-transactions/index.ts) pulls [Mercury List transactions](https://docs.mercury.com/reference/listtransactions) (default **90**-day **`createdAt`** window); **Refresh** on [`Banking.tsx`](src/pages/Banking.tsx) calls **`supabase.functions.invoke`**.
- **Webhook**: [`mercury-webhook`](supabase/functions/mercury-webhook/index.ts) verifies **`Mercury-Signature`**, loads full tx via **`GET /transaction/{id}`**, upserts (see [`EDGE_FUNCTIONS.md`](EDGE_FUNCTIONS.md)).
- **Nav**: Dev-only **Banking** link between **Jobs** and **Materials** in [`Layout.tsx`](src/components/Layout.tsx); route **`/banking`** in [`App.tsx`](src/App.tsx); pin path in [`pinnedTabs.ts`](src/lib/pinnedTabs.ts).

---

## Latest Updates (v2.214)

**Date**: 2026-04-01

### Layout, Dashboard clock strip, Calendar — polish and perceived speed

#### Header — shared height for action buttons (estimators)

- **Problem**: **Bid** (text) beside **Task Dispatch** / **Estimator Inbox** / **Task** (icons) could look misaligned (`minHeight` vs implicit icon row height).
- **Change**: Module constants **`HEADER_ACTION_BUTTON_HEIGHT`** (`calc(1rem + 1.25em)`) and **`headerActionButtonBase`** (`height`, `boxSizing: border-box`, flex centering, `borderRadius`, `cursor`, `border`) in [`Layout.tsx`](src/components/Layout.tsx); all **four** header buttons spread the base and keep per-button **padding** (icons `0.5rem 0.5rem`, Bid `0.5rem 1rem`) and colors. Calendar / Checklist / gear **unchanged**.

#### Dashboard — **Assign** job/bid feels instant on **Currently In** / **Clocked in today**

- **Cause**: After a successful assign, **`loadPending({ silent: true })`** ran **`loadTeamHoursSummary`**, **`loadTodayClockSessions`**, and org-wide / salary loaders **sequentially**, so labels waited on several round-trips.
- **Optimistic UI**: [`AssignSessionJobPopover`](src/components/clock-sessions/AssignSessionJobPopover.tsx) exports **`AssignSessionJobSavedPatch`** (`sessionId`, `selection: UnifiedSearchResult | null` for clear); **`onSaved(patch)`** after successful assign or clear. **[`useDashboardMyTeamSectionState`](src/hooks/useDashboardMyTeamSectionState.ts)** **`applyOptimisticClockSessionAssign`** patches **`pendingSessions`**, **`orgWidePendingSessions`**, **`todaySessionsRows`**, **`todaySessionsRowsOrg`** via **`optimisticPatchClockSessionRow`** / **`optimisticPatchTodayStripRow`** (job/bid embeds from RPC-shaped fields; bid **`customer_name`** → **`bids.customers.name`**).
- **Dashboard strip**: [`DashboardTeamActiveClockStrip`](src/components/DashboardTeamActiveClockStrip.tsx) **`onJobBidSaved(patch)`**; [`Dashboard.tsx`](src/pages/Dashboard.tsx) calls **`applyOptimisticClockSessionAssign(patch)`** then **`void loadPending({ silent: true })`** (reconcile). Other **`AssignSessionJobPopover`** sites may ignore **`patch`**.
- **Parallel refresh**: **`loadPending`** uses **`Promise.all`** for **`loadTeamHoursSummary`**, **`loadTodayClockSessions`**, and **`loadOrgWidePending` | `loadSalaryStripContext`**; **`loadOrgWidePending`** runs **`loadTodayClockSessionsOrg`** and **`loadSalaryStripContext`** in **`Promise.all`**.

#### Calendar — bottom stack chips centered (month grid only)

- **Change**: Bottom column (**PTO**, scheduled **workday** link(s), **NCNS**, **Recorded**) uses **`alignItems: 'center'`** on the flex column so rows shrink-wrap and center; redundant **`alignSelf` / `width`** removed from **NCNS** when parent supplies alignment. Top stack (workflow / bid / prospect) and day modal layout **unchanged** by default.

---

## Latest Updates (v2.213)

**Date**: 2026-04-01

### Calendar — month grid day click affordance (blue accent)

- **Grid cells**: [`Calendar.css`](src/pages/Calendar.css) **`.calendar-grid-day`** — default white background, **hover** `#eff6ff`, **`:focus-visible`** outline `#2563eb` (+ offset); **`aria-label`** per day (`…, open day details`).
- **Numerals**: In-month dates use **`#1d4ed8`**; out-of-month unchanged gray; **today** still bold + **`CALENDAR_DAY_ACCENT`** border.
- **Constants** in [`Calendar.tsx`](src/pages/Calendar.tsx): `CALENDAR_DAY_ACCENT`, `CALENDAR_DAY_HOVER_BG`, `calendarGridDayAriaLabel`; workflow active chip background uses `CALENDAR_DAY_HOVER_BG`.

---

## Latest Updates (v2.212)

**Date**: 2026-04-01

### Calendar — scheduled workday forward-only (PTO unchanged)

- **Green (`scheduled`)** chips and modal **Workday** block: only when **`work_date` > today** (same **`todayKey`** as calendar; [`showScheduledSalaryProjectionForYmd`](src/pages/Calendar.tsx)).
- **Purple (`time_off`)** unpaid leave: still shown **every day** in grid and modal (factual leave).
- **Show my workday** label **`title`** explains forward-only schedule vs PTO vs recorded time on past days.

---

## Latest Updates (v2.211)

**Date**: 2026-04-01

### Calendar — NCNS indicator and recorded vs scheduled time

- **RLS**: [`20260401004452_attendance_incidents_subject_select_own.sql`](supabase/migrations/20260401004452_attendance_incidents_subject_select_own.sql) — subjects **`SELECT`** own **`attendance_incidents`** rows (`subject_user_id = auth.uid()`).
- **NCNS**: Month grid chip + day modal (recorded at, optional **details**) for **`no_call_no_show`** in visible range; distinct styling from PTO / workday chips.
- **Recorded time**: Optional checkbox **Show recorded time** (persisted per user) sums closed, non-rejected, non-revoked **`clock_sessions`** per **`work_date`** via [`calendarClockedHoursByDate.ts`](src/lib/calendarClockedHoursByDate.ts); **Show my workday** remains scheduled salary layer from [`resolveCalendarWorkday`](src/lib/resolveCalendarWorkday.ts).
- **Data**: Dedicated **`useEffect`** in [`Calendar.tsx`](src/pages/Calendar.tsx) (not salary-only fetch) so **hourly** users still get NCNS + recorded aggregates.

---

## Latest Updates (v2.210)

**Date**: 2026-03-31

### People — Writeups tab: unified timeline with NCNS

- **Single table**: Template **writeups** and **no-call, no-show** rows from **`attendance_incidents`** (**`incident_type = 'no_call_no_show'`**) appear in one list sorted by Date / Subject / Template (NCNS sorts under **No-call, no-show**).
- **Filters**: **Subject search** applies to both. **NCNS** rows appear only when **Template**, **Status**, and **Disclosure** are all **All**; narrowing template/status/disclosure shows writeups-only (avoids implying NCNS matches template or draft/submitted semantics).
- **NCNS rows**: Read-only **View** opens **[`NcnsDetailModal.tsx`](src/components/writeups/NcnsDetailModal.tsx)** (work date, recorded by/at, payroll note from **`metadata.had_approved_sessions`**, **source**). Slight row highlight (`#fffbeb`).
- **Data**: **[`People.tsx`](src/pages/People.tsx)** **`loadWriteupsData`** fetches writeups and incidents in parallel; **`ncnsRows`** passed to **[`WriteupsContractsSubTab.tsx`](src/components/writeups/WriteupsContractsSubTab.tsx)**. Types **[`writeupsTimelineTypes.ts`](src/components/writeups/writeupsTimelineTypes.ts)**.

---

## Latest Updates (v2.209)

**Date**: 2026-03-31

### Dashboard — NCNS from team My Time day editor

- **Flow**: Dev / master / assistant open a **team member’s** day from the clock strip (**My Time** editor). Header **NCNS** records a **no-call, no-show**, rejects **every closed** session for that calendar **`work_date`**, and inserts **`attendance_incidents`** with **`metadata.had_approved_sessions`**. **Open sessions** must be clocked out first; **no sessions** disables the action.
- **Approved sessions**: RPC **`record_ncns_and_reject_sessions_for_day`** unwinds **`people_hours`** the same way as **`revoke_clock_sessions`**, then sets **`rejected_at`** (not pending). UI **two-step** confirmation (payroll + trust + checkbox) when any session is already approved; single confirm otherwise.
- **Access**: Same authorization as approve/revoke for that person (**pay** bundle or **team lead**). UI entry matches clock strip scope (**dev** / **master_technician** / **assistant**).
- **Data**: [`20260331232529_ncns_reject_day_sessions.sql`](supabase/migrations/20260331232529_ncns_reject_day_sessions.sql) — **`attendance_incidents`**, RLS (staff bundle + team lead for subject; dev update/delete), **`record_ncns_and_reject_sessions_for_day`**.
- **UI**: [`DashboardMyTimeDayEditorModal.tsx`](src/components/DashboardMyTimeDayEditorModal.tsx) **`allowNcnsFromMyTime`**, [`Dashboard.tsx`](src/pages/Dashboard.tsx).

---

## Latest Updates (v2.208)

**Date**: 2026-03-31

### People — Writeups tab (HR-style forms)

- **URL**: People → **Writeups**, or **`/people?tab=writeups`** (same access gate as **Contracts**). Legacy **`/people?tab=contracts&contracts_sub=writeups`** is replaced with **`tab=writeups`** ( **`contracts_sub`** removed).
- **Data**: Migration **[`20270331193000_writeups_templates_and_submissions.sql`](supabase/migrations/20270331193000_writeups_templates_and_submissions.sql)** — `writeup_templates` (JSON block schema), `writeups` (`subject_user_id`, `filled_by_user_id`, `status` draft/submitted, `disclosure` enum). RLS matches contract staff bundle; no subject SELECT in v1.
- **UI**: **[`WriteupsContractsSubTab.tsx`](src/components/writeups/WriteupsContractsSubTab.tsx)** (list/filters), **[`WriteupTemplateManagerModal.tsx`](src/components/writeups/WriteupTemplateManagerModal.tsx)**, **[`WriteupEditorModal.tsx`](src/components/writeups/WriteupEditorModal.tsx)**; schema/validation **[`writeupTemplateSchema.ts`](src/lib/writeupTemplateSchema.ts)**; wired in **[`People.tsx`](src/pages/People.tsx)**.

---

## Latest Updates (v2.206)

**Date**: 2026-03-31

### Settings — Salaried workday UX; pay config self-read; clock strip overlays

- **Salaried workday (collapsible)**: **[`Settings.tsx`](src/pages/Settings.tsx)** wraps **[`SalaryWorkScheduleSettings`](src/components/SalaryWorkScheduleSettings.tsx)** in a bordered panel with a header button (▼/▶), **`aria-expanded`** / **`aria-controls`**, default **expanded** (`salaryWorkdaySectionOpen`). Anchor remains **`#settings-salary-workday`**.
- **`people_pay_config` RLS**: Migration **[`20270331160000_users_read_own_people_pay_config.sql`](supabase/migrations/20270331160000_users_read_own_people_pay_config.sql)** adds **`Users can read own people pay config row`** — **`FOR SELECT`** when **`btrim(users.name) = btrim(person_name)`** for **`auth.uid()`** — so salaried **superintendent**, **primary**, etc. can load **`is_salary`** in Settings (not only pay masters / assistants / cost-matrix shared). **`DROP POLICY IF EXISTS`** before **`CREATE`** keeps re-apply idempotent.
- **Dashboard — Currently In corner controls**: **[`stripScopeOverlay`](src/components/DashboardTeamActiveClockStrip.tsx)** keeps absolute positioning only; removed frosted **`background`**, **`padding`**, **`borderRadius`**, and **`boxShadow`** ring so **My team / Everyone** and **Needs attention / Show all** sit flush on the orange header without a nested frame.

---

## Latest Updates (v2.205)

**Date**: 2026-03-31

### Company calendar: America/Chicago

- **Semantics**: `work_date` “today,” Dashboard **My Time** week range (`getDefaultWeekRange` / `getLastWeekRange`), `denverCalendarDayKey` and Denver-named formatters in [`dateUtils.ts`](src/utils/dateUtils.ts) now use **`APP_CALENDAR_TZ` = `America/Chicago`** (matching server RPC week gates).
- **Database**: [`20270331150000_company_calendar_america_chicago.sql`](supabase/migrations/20270331150000_company_calendar_america_chicago.sql) — `UPDATE` salary template/override rows from Mountain default; `ALTER` default; salary override RLS “today”; replaced salary sync + `split_own_*` / `replace_own_*` / `leader_*` clock RPCs (`v_tz`).
- **Edge**: [`sync-salary-sessions`](supabase/functions/sync-salary-sessions/index.ts) uses Chicago calendar date for `p_work_date`.
- **Release note**: Near midnight, Mountain vs Central can shift which calendar day is “today” for clock and salary override rules compared to pre-migration Denver.

---

## Latest Updates (v2.204)

**Date**: 2026-03-31

### Salaried workday and auto clock sessions

- **Settings → Salaried workday**: Users marked salaried in `people_pay_config` can save an 8-hour **continuous** or **split** schedule (15-minute steps), optional **today-only override** (Central Time company date), in [`SalaryWorkScheduleSettings.tsx`](src/components/SalaryWorkScheduleSettings.tsx). Tables: `salary_work_schedule_templates`, `salary_work_schedule_day_overrides`; `clock_sessions.origin` / `salary_segment_index`.
- **RPCs**: `sync_salary_clock_sessions_for_day` (service role) and `sync_salary_clock_sessions_for_user_day` (self or pay staff). Edge Function [`sync-salary-sessions`](supabase/functions/sync-salary-sessions/index.ts) for cron (`CRON_SECRET`).
- **Dashboard**: [`ClockInOutButton.tsx`](src/components/ClockInOutButton.tsx) shows **On shift** / **Off shift** and **Update focus** without clock out/in when a template exists; **Save focus** updates job/bid on the open salary session only.

---

## Latest Updates (v2.203)

**Date**: 2026-03-31

### Dashboard — Jobs worked today: inline totals, two columns

- **[`DashboardTeamActiveClockStrip`](src/components/DashboardTeamActiveClockStrip.tsx)** **Jobs worked today** is a **two-column** table (section chevron | job cell). Each row: **line 1** — job **`Link`** plus inline **`[ `** **`formatHoursH(total)`** **` • `** distinct **people** count **` ]`** immediately after the title (**`flex: 0 1 auto`** on the link so the bracket group does not pin to the far right); **line 2** — **`addressLine`** when present (ellipsis + **`title`**). No separate **Total / People** column. **`JOBS_WORKED_TODAY_COL_SPAN`** is **`2`** for expanded per-job session detail rows. Scope-toggle gutter (**`paddingRight: clamp(8rem, 20vw, 12rem)`**) applies to the job **`th`/`td`** when **My team / Everyone** is visible. Job link **`title`** / **`aria-label`** include today’s hours and people count. Data unchanged: **`jobsWorkedTodayStripRows`** in **[`useDashboardMyTeamSectionState`](src/hooks/useDashboardMyTeamSectionState.ts)**.

---

## Latest Updates (v2.202)

**Date**: 2026-03-30

### Dashboard — Jobs worked today (clock strip)

- Below **Clocked in today**, when there is at least one **job-linked** session today in strip scope, **[`DashboardTeamActiveClockStrip`](src/components/DashboardTeamActiveClockStrip.tsx)** shows a collapsible **Jobs worked today (n)** table (**`dashboard_clock_strip_jobs_worked_today_collapsed`**). Row layout and inline **`[ hours • people ]`** next to the job link are described in **v2.203**; data remains **`jobsWorkedTodayStripRows`** from **`todaySessionsForStripScope`** (rejects/revokes excluded; bid-only sessions excluded).

---

## Latest Updates (v2.201)

**Date**: 2026-03-30

### Dashboard — Clocked in today: focused filter + pending approval

- Default **focused** mode (formerly **Show missing**) lists people with at least one today session that is **unassigned** (no job and no bid) **or** **pending approval** (merged **`stripApproveStatusForSession`**, including **`optimisticStripApprovedIds`** so an approved session leaves the list on the next paint). Toggle label **Needs attention** ↔ **Show all**; empty copy and **`title`** / **`aria-label`** describe both criteria. Helpers: **`stripRowInFocusedClockedInView`**, **`clockedInTodayFocusedRows`** in [`DashboardTeamActiveClockStrip.tsx`](src/components/DashboardTeamActiveClockStrip.tsx).

---

## Latest Updates (v2.200)

**Date**: 2026-03-30

### Dashboard — Clocked in today: optimistic approved icon

- After a successful **`approve_clock_sessions`** RPC from the strip (short **Approve** tap or **Session actions** **Approve**), **[`DashboardTeamActiveClockStrip`](src/components/DashboardTeamActiveClockStrip.tsx)** merges **`optimisticStripApprovedIds`** via **`stripApproveStatusForSession`** so the green check appears on the next paint, without waiting for **`loadPending`** to refresh **`approved_at`**. Entries are dropped when merged data shows **`approved_at`**, the session disappears from the strip, or after **revoke** / strip **reject** (clear id from the set).

---

## Latest Updates (v2.199)

**Date**: 2026-03-30

### Dashboard — Session actions: current assignment in modal

- **[`ClockSessionStripActionsModal`](src/components/ClockSessionStripActionsModal.tsx)** shows **Current assignment** (same embed-based line as the strip via [`stripActionsPayloadFromSession`](src/components/DashboardTeamActiveClockStrip.tsx)), **Open job** / **Open bid** (**`Link`** routes), **Change assignment** (expands the search UI and focuses the field), **Clear assignment**, then **Focus memo** and search (**Replace assignment** vs **Search for a job or bid** copy). Assigned sessions open with search **collapsed**; unassigned sessions show search expanded. Payload fields: `assignmentLabel`, `assignmentShortLabel`, `jobEditHref`, `bidEditHref`.

---

## Latest Updates (v2.198)

**Date**: 2026-03-30

### Dashboard — Clocked in today: Session actions modal (long-press)

- When **dev** / **master_technician** / **assistant** can approve strip sessions (`canApproveClockSessions`), **pending** and **approved** **closed** rows use **[`ClockSessionStripApproveControl`](src/components/ClockSessionStripApproveControl.tsx)** with **`actionsEligible`**: **short press** on **pending** still **quick-approves** (`approve_clock_sessions`). **Long-press** (~0.56s), **Shift+click**, and the screen-reader **Session actions** control open **[`ClockSessionStripActionsModal`](src/components/ClockSessionStripActionsModal.tsx)** — **Edit** (**focus memo** + **job/bid** search using `search_jobs_ledger` / `search_bids_for_clock`, same update pattern as assign popover), **Approve** / **Reject…** (**pending**), **Revoke approval…** (**approved**, `revoke_clock_sessions` after **`window.confirm`**). **Reject…** closes the actions dialog and opens the existing **Reject clock session?** overlay in [`DashboardTeamActiveClockStrip`](src/components/DashboardTeamActiveClockStrip.tsx) (stacked **z-index**: assign popover, then actions modal, then reject confirm). **Approved** rows: long-press / keyboard open actions; **short click** does not revoke. **Open** (incomplete) sessions stay read-only for this flow. `onClockSessionsMutated` / `loadPending` refresh strip data after mutations.

---

## Latest Updates (v2.197)

**Date**: 2026-03-30

### Dashboard — Clocked in today: per-session approve + reject

- **Expanded** session rows under **Clocked in today** ([`DashboardTeamActiveClockStrip.tsx`](src/components/DashboardTeamActiveClockStrip.tsx)) show a **status control**: **open** sessions (not clocked out) are read-only gray square; **pending** closed sessions use **`approve_clock_sessions`** on **click** (short press). **v2.198** routes **long-press**, **Shift+click**, and the SR control through **Session actions** before **Reject…** chains to the in-app **Reject clock session?** modal (person + time range) for `rejected_at` / `rejected_by`. **v2.197** initially opened that reject confirm **directly** from long-press/Shift/SR. **Approved** sessions show a green check; **v2.198** makes the check **focusable** when eligible so approvers can open **Session actions** (revoke/edit). **RLS** remains authoritative; errors use the job/bid assign toast path. Component: [`ClockSessionStripApproveControl.tsx`](src/components/ClockSessionStripApproveControl.tsx). Refresh: `onClockSessionsMutated` → `loadPending({ silent: true })` (today rows + pending).

---

## Latest Updates (v2.196)

**Date**: 2026-03-30

### Dashboard — Clocked in today: Show all vs Show missing

- The **Clocked in today** table ([`DashboardTeamActiveClockStrip.tsx`](src/components/DashboardTeamActiveClockStrip.tsx)) toggles **Show all** (everyone with time today in scope) and **Show missing** (only people who have at least one today session with **no** `job_ledger_id` and **no** `bid_id`). The control is a top-right overlay when the subsection is expanded and filtering applies; default mode is **Show missing** (subsection stays **expanded** by default via existing **`dashboard_clock_strip_clocked_in_today_collapsed`** behavior unless the user has collapsed it).

---

## Latest Updates (v2.195)

**Date**: 2026-03-30

### Dashboard — Currently clocked in strip: collapsible Clocked in today

- When there is at least one **Clocked in today** row ([`DashboardTeamActiveClockStrip.tsx`](src/components/DashboardTeamActiveClockStrip.tsx)), the block is a **single table**: the first **`thead`** row aligns with body columns (**▶/▼** in the expand gutter, **Clocked in today** in the name column, **Today | First clock-in** in the third column **only when expanded**); **`tbody`** is **`hidden`** when the subsection is collapsed.
- **Disclosure** **`aria-label`** includes **person count** (visible middle header is **Clocked in today** only; **`aria-label` on the name column** supplements **Name** for assistive tech).
- Preference **`dashboard_clock_strip_clocked_in_today_collapsed`** in **`localStorage`** (`0` / `1`); default expanded.

---

## Latest Updates (v2.194)

**Date**: 2026-03-30

### Dashboard — My Time Visual: split boundary drag

- **Drag release on handle**: Inner boundary handles no longer call `stopPropagation` on `pointerup`, so the `window` listener can run [`endBoundaryDragListeners`](src/components/DashboardMyTimeDayEditorModal.tsx) and clear **`dragRef`** when the user releases over the blue control (previously the boundary kept tracking until a later `pointerup` elsewhere).
- **Slimmer handle** ([`MyTimeDayClusterVisual.tsx`](src/components/my-time-day-editor/MyTimeDayClusterVisual.tsx) `.myTimeBoundaryHandle`): default **24×28px** (was **32×44**); **[`index.css`](src/index.css)** `@media (pointer: coarse)` restores larger touch sizing with `!important` overrides.
- **`grabbing` cursor**: While dragging, [`document.body.classList`](src/components/DashboardMyTimeDayEditorModal.tsx) adds **`my-time-boundary-dragging`**; removed on drag end, cancel, unmount, and layout reset (**`MY_TIME_BOUNDARY_DRAG_BODY_CLASS`**).
- **Strip click vs focused handle**: Plain (or **Shift+**) click on the gray timeline always runs the **add-split** tap; **Option/Alt+click** moves the **currently focused** inner boundary to that time (was: plain click moved the boundary, which blocked splitting until you clicked away).
- **Merge up / down focus notes**: [`mergeSegmentNotes`](src/lib/myTimeDayTimeline.ts) drops **duplicate paragraphs** (blank-line–separated blocks; exact trim match) and **identical whole notes** so same text is not repeated when merging segments.
- **Merge up / down** (same allocation labels): **immediate** merge in **Form** and **Visual** — no `window.confirm` with Denver time ranges ([`MyTimeDayClusterForm.tsx`](src/components/my-time-day-editor/MyTimeDayClusterForm.tsx), [`MyTimeDayClusterVisual.tsx`](src/components/my-time-day-editor/MyTimeDayClusterVisual.tsx)); **Combine segments** modal unchanged when [`mergeAllocChoiceRequired`](src/lib/myTimeDaySavePlan.ts). Removed dead **`mergeSegmentAdjAllocConfirmSuffix`** helper from [`myTimeDaySavePlan.ts`](src/lib/myTimeDaySavePlan.ts).

---

## Latest Updates (v2.193)

**Date**: 2026-03-30

### Dashboard — My Time: merge job-choice modal + segment allocation overrides

- When **Merge up** / **Merge down** would combine segments with **different** job/bid allocation labels (including mixed overlap), [`MyTimeMergeSegmentsModal`](src/components/my-time-day-editor/MyTimeMergeSegmentsModal.tsx) opens: **Combine segments** title, job-only choice tiles (radiogroup, `aria-label` per option), **default job** matches the segment **merged into** (above vs below), **editable merged focus notes** (default from [`mergeSegmentNotes`](src/lib/myTimeDayTimeline.ts), **Restore default merge**), tertiary **No job or bid linked**, then **Merge segments** runs merge + **override** + final note text in one update.
- [`SplitEditorState`](src/lib/myTimeDayTimeline.ts) gains optional **`segmentJobOverrides`** and **`setSegmentJobOverride`** action; merge/split actions **remap** override keys; **drag** / **keyboard nudge** on inner boundaries **clear** overrides (v1). [`cloneSplitState`](src/lib/myTimeDayTimeline.ts) copies overrides for strip drag undo.
- [`attachAllocationsToPayloads`](src/lib/myTimeDaySavePlan.ts) and [`segmentAllocationLabelsForOverlap`](src/lib/myTimeDaySavePlan.ts) honor overrides. [`mergeAllocChoiceRequired`](src/lib/myTimeDaySavePlan.ts) gates **Combine segments** vs **immediate** merge (no `window.confirm` when labels align); [`effectiveSegmentJobBid`](src/lib/myTimeDaySavePlan.ts) resolves display/save ids.
- **Edit time** ([`DashboardMyTimeDayEditorModal.tsx`](src/components/DashboardMyTimeDayEditorModal.tsx)): **Close** replaces Cancel + Save day—**save on close** when edits are dirty and valid (**Saving…** while persisting); backdrop and **Escape** use the same path; **Escape** first dismisses **Combine segments** / assign overlays; invalid dirty state blocks close with an error.

---

## Latest Updates (v2.192)

**Date**: 2026-03-30

### Dashboard — My Time: merge adjacent segments (remove virtual split)

- **Edit time** (**Form** and **Visual**): per-segment **Merge up** / **Merge down** (when the block has 3+ boundaries) combines the current span with the neighbor above or below, removes the inner boundary, and joins **focus notes** (non-empty parts separated with a blank line). **No confirm** when job/bid labels match; **Combine segments** modal when they differ. (Removed redundant `window.confirm` for the aligned case, 2026-03-30.)
- **Reducer**: [`src/lib/myTimeDayTimeline.ts`](src/lib/myTimeDayTimeline.ts) — `removeSegmentMergeWithPrev` / `removeSegmentMergeWithNext` (with `nowMs` + `openLastCluster` for min-duration checks on an open last segment), plus exported `mergeSegmentNotes`. Merging may collapse to a **single** segment (guard: **`nextBounds.length < 2`** is rejected); each segment must stay ≥ **MIN_SEGMENT_MS** (same as splits). See **v2.216** if merge appeared to do nothing after a split.
- **Save**: No new RPC; fewer segments reuse existing `buildPayloads` + day-editor persist branches (including `replaceOwnClockSessionClusterMixed` when segments no longer sit fully inside single rows).

---

## Latest Updates (v2.191)

**Date**: 2026-03-30

### SPA hard reload and Clock In toast stability

- **GitHub Pages document 404**: **Hard Reload** (gear menu) and **broadcast force reload** no longer navigate to `currentPath?nocache=…` (which produced **`GET /dashboard?nocache=…` 404** in DevTools). They clear caches, save path in `sessionStorage`, load **`/?nocache=…`**, then an inline script in [`index.html`](index.html) runs **`history.replaceState`** before React loads ([`src/lib/hardReload.ts`](src/lib/hardReload.ts), [`ForceReloadContext.tsx`](src/contexts/ForceReloadContext.tsx), [`Layout.tsx`](src/components/Layout.tsx)). See [`TROUBLESHOOT_404.md`](TROUBLESHOOT_404.md).
- **Clock In / Update Focus**: Stopped repeat **“You have no assigned jobs”** toasts: [`ToastContext.tsx`](src/contexts/ToastContext.tsx) exposes a **memoized** context value; [`ClockInOutButton.tsx`](src/components/ClockInOutButton.tsx) uses **`showToastRef`**, omits **`showToast`** from the assigned-jobs **`useEffect`** deps, and shows the info toast **once per modal session** (`noAssignedJobsInfoToastShownRef`, reset when both modals close).

---

## Latest Updates (v2.190)

**Date**: 2026-03-30

### Billing — linked customer, Edit Job UX, RTB labels

- **Customer gate** ([`Jobs.tsx`](src/pages/Jobs.tsx), [`Dashboard.tsx`](src/pages/Dashboard.tsx)): **Ready to Bill** **Invoice / Update** and **Ham mode** instant **billed** require **`jobs_ledger.customer_id`**. If missing: **toast**; Jobs calls **`openEdit(job, { billingCustomerHighlight: true })`** (or invoice’s parent job) so **Edit Job** opens with **Customer** expanded and a **red callout** around **Link to customer**, search, and **Create customer from job** (`billingCustomerHighlight` state, `scrollIntoView`, cleared on link or close). Dashboard blocks the modal with a toast only (no navigation).
- **RPC**: [`20260330065236_add_customer_id_to_get_jobs_ledger_by_status.sql`](supabase/migrations/20260330065236_add_customer_id_to_get_jobs_ledger_by_status.sql) — **`get_jobs_ledger_by_status`** returns **`customer_id`** (DROP/CREATE; Postgres cannot widen **`CREATE OR REPLACE`** return row type). See [`MIGRATIONS.md`](MIGRATIONS.md).
- **Safety nets**: [`SendRecordInvoiceModal.tsx`](src/components/jobs/SendRecordInvoiceModal.tsx) — minimal shell if **`job.customer_id`** is missing. Edge **[`create-stripe-invoice`](supabase/functions/create-stripe-invoice/index.ts)** returns **400** when the job has no linked customer or body **`customer_id`** ≠ job (**[`EDGE_FUNCTIONS.md`](EDGE_FUNCTIONS.md)**).
- **Edit Job — Billing**: **Open invoices** list appears **above** **Payments received**; payments action button label **Record Payment** (was Add Payment). Section title is **Payments received** without **`($)`** (see v2.285).
- **Ready to Bill copy** (Jobs **Stages** + Dashboard RTB cards): Secondary actions **Job: Send Job Back** (job row) and **Delete draft bill** (invoice-only / bundle remove draft); **Billed** section keeps **Send back** / **Remove line**. Confirmation modals use matching titles / primary buttons (`sendBackJob` **`toStatus === 'working'`**, `sendBackInvoice` **`action === 'delete'`**).

---

## Latest Updates (v2.189)

**Date**: 2026-03-29

### Ready to Bill — primary bundle row (Stages + Dashboard)

- **Schema**: [`20260330055116_add_jobs_ledger_invoices_primary_rtb_bundle.sql`](supabase/migrations/20260330055116_add_jobs_ledger_invoices_primary_rtb_bundle.sql) — **`jobs_ledger_invoices.is_primary_rtb_bundle`** (default **`false`**); partial **unique** index on **`job_id`** where **`status = 'ready_to_bill'`** and the flag is true; **`ensure_single_ready_to_bill_invoice_for_job`** **INSERT**/**UPDATE** (sync) paths set the flag to **`true`**.
- **Client**: Manual invoice inserts in **[`Jobs.tsx`](src/pages/Jobs.tsx)** use **`is_primary_rtb_bundle: false`**.
- **Jobs Stages**: **`buildReadyToBillStageRows`** (**`job_with_primary_rtb`**); **`renderUnifiedStagesTable`** merged row UX; header count/total avoid double-counting the bundle line.
- **Dashboard**: **`buildReadyToBillDashboardUnits`** / **`readyToBillDashboardUnits`** for dev, master_technician, and assistant **Ready to Bill** lists.

---

## Latest Updates (v2.186)

**Date**: 2026-03-29

### Settings — Templates & testing: workflow email Edge Function smoke test

- **[`Settings.tsx`](src/pages/Settings.tsx)** (`settings-templates`, dev only): Collapsible **Workflow email (Edge Function)** sends one email via **`send-workflow-notification`** (server reads **`email_templates`** by `template_type`, Resend). Uses the same **Test target** as other template tests; **does not** send **`recipient_user_id`**, so **no `notification_history`** row (avoids placeholder `step_id` FK issues). **`refreshSession`** + explicit **`Authorization: Bearer`** on **`functions.invoke`**. Template type dropdown covers the eight **`stage_*`** workflow email types; **Send test** is disabled until that row exists under Email Templates.
- **`supabase/config.toml`**: **`[functions.send-workflow-notification] verify_jwt = false`** (same pattern as **`test-email`**: JWT checked inside the function). Redeploy hosted functions with **`--no-verify-jwt`** when needed so the browser is not blocked by gateway JWT verification.
- **Docs**: This entry; **[`EDGE_FUNCTIONS.md`](EDGE_FUNCTIONS.md)** **`send-workflow-notification`** request shape; **[`WORKFLOW_EMAIL_TESTING.md`](WORKFLOW_EMAIL_TESTING.md)** quick smoke test.

---

## Latest Updates (v2.185)

**Date**: 2026-03-30

### Jobs — Stages Last activity (thread preview) and remove `stage_notes`

- **Migration**: [`20260330023918_extend_thread_note_stats_drop_stage_notes.sql`](supabase/migrations/20260330023918_extend_thread_note_stats_drop_stage_notes.sql) — optional backfill from legacy `stage_notes` into `jobs_ledger_thread_notes` (master as author, skip jobs that already have thread rows); **`jobs_ledger_thread_note_stats`** returns **`last_note_body`** (400-char cap) and **`last_note_author_name`**; **`DROP COLUMN jobs_ledger.stage_notes`**
- **UI**: [`Jobs.tsx`](src/pages/Jobs.tsx) — **Last activity** column replaces Stage Notes textarea: author + Central Time meta ([`getDispatchNoteDisplayMeta`](src/utils/dispatchNoteDisplay.ts)) + clamped preview; **—** when no notes
- **Hook**: [`useJobThreadNotes`](src/hooks/useJobThreadNotes.ts) — extended stats shape; realtime **INSERT** merges stats via targeted RPC refresh

---

## Latest Updates (v2.184)

**Date**: 2026-03-31

### Jobs / Workflow — Job thread notes composer

- **[`JobThreadNotesPanel`](src/components/JobThreadNotesPanel.tsx)**: **Enter** submits the note (same rules as **Post note**: non-empty trimmed body, not while submitting). **Shift+Enter** inserts a newline. Placeholder documents the shortcuts.

---

## Latest Updates (v2.183)

**Date**: 2026-03-30

### Jobs — Stages thread notes

- **Schema**: [`jobs_ledger_thread_notes`](supabase/migrations/20260330021739_jobs_ledger_thread_notes.sql) — append-only rows per `jobs_ledger.id` (`body` 1–2000 chars); RLS **SELECT** / **INSERT** matches [`job_status_events`](supabase/migrations/20260623190000_revoke_superintendent_jobs_billing.sql) job visibility; **`jobs_ledger_thread_note_stats(p_job_ids)`** for collapsed note counts; **`supabase_realtime`** publication for live inserts.
- **UI**: New leading column (chevron + optional count) on **Working**, **Ready to Bill**, **Billed**, and **Paid in Full** stage tables ([`renderStagesTable`](src/pages/Jobs.tsx), [`renderUnifiedStagesTable`](src/pages/Jobs.tsx)); expanded row shows [`JobThreadNotesPanel`](src/components/JobThreadNotesPanel.tsx) (Central Time / days-ago from [`getDispatchNoteDisplayMeta`](src/utils/dispatchNoteDisplay.ts)).
- **Hook**: [`useJobThreadNotes`](src/hooks/useJobThreadNotes.ts) — load, submit, draft, stats batch helper, realtime refresh.

### Workflow — Linked jobs

- Project header **Jobs** chips: chevron beside each link opens the same thread panel for that `jobs_ledger` row (shared hook).

---

## Latest Updates (v2.182)

**Date**: 2026-03-29

### Dashboard — Clock In and Update Focus modals

- **Assigned jobs**: Opening **Ready to clock in?** or **Update Focus** automatically loads the user’s assigned jobs via `list_assigned_jobs_for_dashboard` (wrapped in `withSupabaseRetry` in [`ClockInOutButton.tsx`](src/components/ClockInOutButton.tsx)); results appear in the shared list with a **Loading…** state while fetching. Stale responses are ignored if the modal closes or the user types in the search box before the RPC returns (generation ref + `assignedJobsShownRef` / debounce behavior unchanged in spirit from the prior Clock-In-only prefetch).
- **Removed**: Separate **Choose from my jobs?** button and the **Choose from my jobs:** label (both modals).
- **Single service type**: When the user has exactly one bid filter type (e.g. subcontractor with one trade), the **Filtering by: [name]** line is **hidden** in both modals; search still uses that type.
- **Field borders**: Required notes textarea and unified job/bid search input use a stronger **2px** border (`#64748b`). **Clock In** uses an orange **focus** outline (`#ff6600`); **Update Focus** uses blue (`#3b82f6`) for those fields.

---

## Latest Updates (v2.181)

**Date**: 2026-03-29

### Jobs — Edit Job billing comma formatting

- **Job Total ($)** and **Payments received** → **Amount ($)** use text inputs with **thousands separators** on blur (`toLocaleString('en-US')` via existing [`formatCurrency`](src/pages/Jobs.tsx)).
- Helpers: [`sanitizeMoneyTyping`](src/pages/Jobs.tsx), [`parseMoneyInputToNumber`](src/pages/Jobs.tsx), [`parseMoneyInputToNumberOrNull`](src/pages/Jobs.tsx) for save, **Remaining ($)**, and invoice remaining checks.
- Payment amounts: [`MoneyDecimalAmountInput`](src/components/MoneyDecimalAmountInput.tsx) (focus = raw decimal, blur = formatted; zero stays blank).

### Workflow — Line item date and clipboard bulk import

- **`item_date`** on [`workflow_step_line_items`](src/types/database.ts): optional **Date** on Add/Edit Line Item; **Date** column in **Line Items For Office**; delete confirm shows date when set. Migration [`20270329210000_workflow_step_line_items_item_date.sql`](supabase/migrations/20270329210000_workflow_step_line_items_item_date.sql).
- **Bulk import (Add mode only)**: Header **clipboard** icon reads [`navigator.clipboard.readText()`](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API), parses **tab-separated** lines (`M/D/YYYY`, memo, `$` amount) via [`parseWorkflowLineItemPaste`](src/lib/parseWorkflowLineItemPaste.ts), **bulk insert** + refresh. Superintendents included in line-item reload after save/delete/bulk import (parity with [`loadLineItemsForSteps`](src/pages/Workflow.tsx)).

---

## Latest Updates (v2.180)

**Date**: 2026-03-29

### Bids — New/Edit Bid modal and header

- **[`SearchableSelect`](src/components/SearchableSelect.tsx)**: Custom single-select with optional search, client-side label filter, **`createPortal`** list (`z-index` 1100 above bid overlay 1000), positioning aligned with [`PeerTeammatePicker`](src/components/team-feedback/PeerTeammatePicker.tsx). Used in the modal for **Estimator**, **Account Man**, **Service Type** (search on), and **Win/Loss** (`searchable={false}`). Trigger uses ~44px min height; search field uses **16px** font to reduce iOS zoom.
- **Submit validation**: [`bidFormMissingFields`](src/pages/Bids.tsx) / `bidFormCanSubmit` now include **Service Type** when empty (replacing native `<select required>` on Service Type).
- **Top field layout** (CSS grid `bid-form-top-fields`): **Desktop** — row 1: Estimator, Account Man, Bid Date; row 2: Bid #, Project Name (name spans two columns). **Mobile** (`@media (max-width: 640px)`) — row 1: Estimator | Account Man; row 2: Bid # | Bid Date; row 3: Project Name full width.
- **Modal**: `maxWidth` **720px** on `.bid-form-modal`.
- **Project Address / Distance / Plan Pages**: **Project Address** on its own full-width block; **Distance to Office (miles)** and **Plan Pages** on a **shared two-column row** below (map link still beside distance input).
- **Header**: Estimator **Bid** shortcut in [`Layout.tsx`](src/components/Layout.tsx) uses **`inline-flex`**, **`minHeight: calc(1rem + 1.25em)`** to match **Task** / **Task Dispatch** icon buttons.

---

## Latest Updates (v2.179)

**Date**: 2026-03-28

### Dashboard — My Time / Edit time

- **Edit scope** (superseded in **v2.250**): Previously the modal used a narrow `editableRange` (**this week** only). As of **v2.250**, [`DashboardMyTimeDayEditorModal.tsx`](src/components/DashboardMyTimeDayEditorModal.tsx) uses [`getThisAndLastWeekRange()`](src/utils/dateUtils.ts) with a **prior-week confirmation** for **last week**; the **My Time** grid still limits cell clicks to **this week** — see **v2.250** and [`PROJECT_DOCUMENTATION.md`](PROJECT_DOCUMENTATION.md) Dashboard **My Time**.
- **Visual vs Form**: On mount, **Form** when `matchMedia('(max-width: 560px)')`, otherwise **Visual** — aligned with [`.myTimeDayClusterFormGrid`](src/index.css). Toggle remains available. Modal width uses `min(920px, 96vw)`.
- **Form layout**: Two-column grid — **times** (**Span**, **Split**, **Ends at**) on the **left**; **duration**, job/bid, and **notes** on the **right**; **block header** (weekday / date / range) at the **top-left** of the grid; soft segment divider ([`.myTimeDayClusterFormSegmentDivider`](src/index.css)). **Duration** styling matches **Span**.
- **Boundaries & splits**: Inner boundaries adjust via **Ends at** on the **earlier** segment only; **Split** is per segment ([`addSplitMidInSegment`](src/lib/myTimeDayTimeline.ts)). Cluster-level “Add split at” time picker removed; reducer keeps ends deduped.
- **Time inputs**: Same calendar-day segments use `type="time"`; cross-day clusters use `datetime-local` — [`myTimeDayEditorDatetime.ts`](src/components/my-time-day-editor/myTimeDayEditorDatetime.ts), [`MyTimeDayClusterForm.tsx`](src/components/my-time-day-editor/MyTimeDayClusterForm.tsx).
- **Assign UI**: Combined unassigned chip label **No Job or Bid | Add** in [`AssignSessionJobPopover.tsx`](src/components/clock-sessions/AssignSessionJobPopover.tsx).

---

## Latest Updates (v2.178)

**Date**: 2026-03-29

### People — Primary and Superintendent on roster

- `people.kind` allows **`primary`** and **`superintendent`**; idempotent backfill from **`master_primaries`** / **`master_superintendents`**. Migration [`20260329042321_add_primary_superintendent_to_people_kind.sql`](supabase/migrations/20260329042321_add_primary_superintendent_to_people_kind.sql).
- **Users** tab: Primaries and Superintendents use the same **`byKind`** sections as other roster kinds (Add, merge with accounts, invite); **Active projects** line hidden for those two kinds.
- **`allRosterNames`** includes them (removed user-only primary shortcut). **Jobs** / **Quickfill Receivables** roster helpers extended; Settings dev people tables show kind labels.

---

## Latest Updates (v2.177)

**Date**: 2026-03-29

### People — Housing tab and pay reports

- **Housing** tab after **Vehicles** (same pay gate: dev, pay-approved master, assistant-of): CRUD on `housing_units` (address; rent, utilities, insurance per week) and `housing_possessions` (user, start/end dates). [`src/pages/People.tsx`](src/pages/People.tsx); migration [`20270329180000_housing_units_and_possessions.sql`](supabase/migrations/20270329180000_housing_units_and_possessions.sql).
- Pay stub HTML: **Housing** section after **Vehicles** when the person has an overlapping possession in the stub period (`getHousingForPersonInPeriod`, `buildPayStubHtml`).

---

## Latest Updates (v2.176)

**Date**: 2026-03-29

### People — Pay History (Ledger balance summary)

- Under **Ledger**, a line shows **N open** (stubs not fully paid vs Net Pay) and **total remaining** (sum of **Balance** for visible rows). **Search** filters both the table and the summary. [`src/pages/People.tsx`](src/pages/People.tsx) (`ledgerOpenBalanceSummary`).

---

## Latest Updates (v2.175)

**Date**: 2026-03-29

### People — Pay History (copy: Draft Payroll)

- Pay History → **Generate Pay Reports**: the bulk-period button and modal title are labeled **Draft Payroll** instead of **Run Payroll**. Internal state renamed `draftPayrollModalOpen` / `setDraftPayrollModalOpen` in [`src/pages/People.tsx`](src/pages/People.tsx). Behavior unchanged.

---

## Latest Updates (v2.174)

**Date**: 2026-03-29

### People — Pay History (Additional lines, Net Pay)

- **`pay_stub_additional_lines`**: Per-stub lines with `quantity`, `rate`, and generated `line_total` (nearest cent). **Net Pay** = gross − sum(**Less**) + sum(**Additional**). Triggers keep installment totals ≤ Net Pay when Additional changes (`validate_pay_stub_payments_vs_net` / `pay_stub_payments_enforce_total_fn` updated). Optional **`source_clock_session_id`** links a line to a **clock session** (prevailing-wage top-up); **`description`** is human-readable (**v2.345** — no **`[pw:uuid]`** prefix on new rows; legacy prefix stripped in UI and pay report HTML via [`stripPrevailingWageTag`](src/lib/payStubPrevailingWageLine.ts)).
- **Ledger**: Column **Additional** (clickable, including **$0.00**) opens **Additional** modal ([`src/components/pay/PayStubAdditionalModal.tsx`](src/components/pay/PayStubAdditionalModal.tsx)): add/remove lines, quick flat amount (qty 1), **target total Additional** with solve for **rate** or **quantity** on a chosen line, **prevailing wage** table from **approved** sessions in the stub period. Locked when installments fully cover Net Pay.
- **Less modal** takes **`additionalSum`** so Net Pay and locks stay aligned ([`PayStubLessModal.tsx`](src/components/pay/PayStubLessModal.tsx)).
- **Pay report HTML**: **Additional** (if any), then **Less** (if any), then **Net Pay** always; pending offsets unchanged after that block.
- **Helpers**: [`stubNetPay(gross, less, additional?)`](src/lib/payStubDeductions.ts), [`sumPayStubAdditionalAmounts`](src/lib/payStubDeductions.ts).

**Files**: [`supabase/migrations/20270329150000_pay_stub_additional_lines.sql`](supabase/migrations/20270329150000_pay_stub_additional_lines.sql), [`supabase/migrations/20260420051645_pay_stub_additional_lines_source_clock_session.sql`](supabase/migrations/20260420051645_pay_stub_additional_lines_source_clock_session.sql), [`src/pages/People.tsx`](src/pages/People.tsx), [`src/components/pay/PayStubAdditionalModal.tsx`](src/components/pay/PayStubAdditionalModal.tsx), [`src/lib/payStubPrevailingWageLine.ts`](src/lib/payStubPrevailingWageLine.ts), [`src/components/pay/PayStubLessModal.tsx`](src/components/pay/PayStubLessModal.tsx), [`src/lib/payStubDeductions.ts`](src/lib/payStubDeductions.ts), [`src/types/database.ts`](src/types/database.ts)

---

## Latest Updates (v2.173)

**Date**: 2026-03-29

### People — Pay History (Less, Net Pay, installments vs net)

- **`pay_stub_deductions`**: Manual or offset-linked lines; **Net Pay** = gross − sum(deductions). Triggers: deductions total ≤ gross; installments total ≤ Net Pay; backfill from **`person_offsets`** already tied to a stub.
- **Ledger**: Columns **Less** (always show dollar amount, including **$0.00**; click opens **Less** modal) and **Net Pay**; **Balance** and **Record payment** use Net Pay; Run Payroll “fully paid” uses Net Pay.
- **Less modal** ([`src/components/pay/PayStubLessModal.tsx`](src/components/pay/PayStubLessModal.tsx)): add manual charge; apply pending **person_offsets** (inserts deduction + sets `pay_stub_id`); remove line (clears offset link when applicable). Locked when installments fully cover Net Pay.
- **Pay report HTML**: Itemized **Less**, **Net Pay**, then **Physical payments**.
- **Helpers**: [`src/lib/payStubDeductions.ts`](src/lib/payStubDeductions.ts).

**Files**: [`supabase/migrations/20260329002111_pay_stub_deductions.sql`](supabase/migrations/20260329002111_pay_stub_deductions.sql), [`src/pages/People.tsx`](src/pages/People.tsx), [`src/components/pay/PayStubLessModal.tsx`](src/components/pay/PayStubLessModal.tsx), [`src/types/database.ts`](src/types/database.ts), [`src/lib/payStubDeductions.ts`](src/lib/payStubDeductions.ts)

---

## Latest Updates (v2.172)

**Date**: 2026-03-28

### People — Pay History (partial payments per stub)

- **`pay_stub_payments`**: Multiple installments per pay stub (`amount`, `paid_at`, `memo`, `created_by`); trigger prevents total paid from exceeding **`gross_pay`** (within one cent). RLS matches **`pay_stub_days`**. Migration backfills one row per stub that already had **`paid_at`** set.
- **Ledger**: Columns **Paid to date**, **Balance**, **Payment** status (Unpaid / Partial / Paid); **Record payment** modal (amount + sent date + optional note). Detail icon lists installments with optional **Delete** per row.
- **Run Payroll** modal: **Partial** status; paid checkbox summary counts only **fully** paid stubs; **Record payment** aligned with ledger.
- **Pay report HTML / print**: **Physical payments** block with lines and total.
- **Helpers**: [`src/lib/payStubPayments.ts`](src/lib/payStubPayments.ts).

**Files**: [`supabase/migrations/20260328215252_pay_stub_payments.sql`](supabase/migrations/20260328215252_pay_stub_payments.sql), [`src/pages/People.tsx`](src/pages/People.tsx), [`src/types/database.ts`](src/types/database.ts), [`src/lib/payStubPayments.ts`](src/lib/payStubPayments.ts)

---

## Latest Updates (v2.171)

**Date**: 2026-03-27

### People — Hours (correct-day audit, shared clock modal, highlight by job)

- **Correct-day audit** (`PeopleHoursDayAuditModal`): From weekly grid cells in the “correct day” flow. **Read-only** by default; users who can edit crew jobs see **Edit** / **Done**. In edit mode: crew draft + **Save** uses the same upserts as the unassigned-hours path; each clock row **Edit** opens **`ClockSessionEditSplitModal`**; **Add session** when the day has no sessions (inserts a closed session for the audited person and work date, with resolved clock user id for inserts).
- **Clock edit / split / create** (`ClockSessionEditSplitModal`): Shared between People and Quickfill—edit and split existing sessions; **create** path via `createFor: { userId, workDate }`. Local datetime fields use **`src/utils/datetimeLocal.ts`** (`toDatetimeLocal` / `fromDatetimeLocal`).
- **Highlight by job**: Bar above the weekly grid—debounced **`search_jobs_ledger`**, selected job chip with clear. Highlights people and day cells when crew assignments for that week include the selected job (from raw **`unifiedAssignments`** job ids). Existing highlights (**missing job**, merge-order **flash**, hours **flash**) still take precedence so auditing cues are not lost.
- **Quickfill Hours** (`HoursSection`): Passes the same audit modal props (including `onCrewSaved`) so correct-day refresh stays aligned with People.

**Files**: [`src/components/PeopleHoursDayAuditModal.tsx`](src/components/PeopleHoursDayAuditModal.tsx), [`src/components/ClockSessionEditSplitModal.tsx`](src/components/ClockSessionEditSplitModal.tsx), [`src/utils/datetimeLocal.ts`](src/utils/datetimeLocal.ts), [`src/pages/People.tsx`](src/pages/People.tsx), [`src/components/quickfill/HoursSection.tsx`](src/components/quickfill/HoursSection.tsx)

---

## Latest Updates (v2.170)

**Date**: 2026-03-27

### People — Pay History (ledger and bulk pay reports)

- **Ledger**: **Search** field filters rows by person name (case-insensitive substring). **Actions**: **Print** opens the pay stub HTML flow; **View** was removed from the ledger row (preview remains via **View** in the **Generate Pay Reports** modal). **Dev delete**: red trash icon only (no filled button); confirm in dialog. Person name still links to **Annual Pay to Date** (year calendar: earned vs paid by day).
- **Generate Pay Reports** (bulk): Header bar uses **Last week** / **Next week** for the pay period; compact date inputs; centered period controls and “N of M paid · Total” summary above the people table; optional payment memo on mark-paid; **`src/index.css`** tightens WebKit date control spacing for the modal.
- **Pay History layout**: **Generate Pay Reports** control is aligned on the right in the section header row with the heading.

**Files**: [`src/pages/People.tsx`](src/pages/People.tsx), [`src/components/pay/PayStubDeleteIcon.tsx`](src/components/pay/PayStubDeleteIcon.tsx), [`src/index.css`](src/index.css)

---

## Latest Updates (v2.169)

**Date**: 2026-03-27

### Dashboard — Dispatch inbox thread notes

- Expand a dispatch request (click the row; title links still open without toggling). **Activity / notes** loads `dispatch_request_notes` with author name, weekday + time in **America/Chicago**, and **calendar days ago** in that timezone.
- Dev and dispatch group members add notes via a **single combobox** ([`src/components/DispatchNoteCombobox.tsx`](src/components/DispatchNoteCombobox.tsx)): type freely or filter/pick from `DISPATCH_NOTE_PRESETS` (arrows + Enter on a highlighted row, or click). Submit rejects empty notes and text over 2000 characters. Inserts use `withSupabaseRetry`. Closed requests show **Marked closed (final)** after notes, using existing `closed_by`, `closed_at`, and `closed_note`.
- Shared UI: [`src/components/DispatchInboxSection.tsx`](src/components/DispatchInboxSection.tsx); helpers [`src/utils/dispatchNoteDisplay.ts`](src/utils/dispatchNoteDisplay.ts), [`src/lib/dispatchNotePresets.ts`](src/lib/dispatchNotePresets.ts). Realtime channel on `dispatch_request_notes` refreshes the expanded thread on `INSERT` when replication is available.

**Files**: [`supabase/migrations/20260327220610_dispatch_request_notes.sql`](supabase/migrations/20260327220610_dispatch_request_notes.sql), [`src/pages/Dashboard.tsx`](src/pages/Dashboard.tsx), [`src/types/database.ts`](src/types/database.ts), [`src/components/DispatchNoteCombobox.tsx`](src/components/DispatchNoteCombobox.tsx)

---

## Latest Updates (v2.168)

**Date**: 2026-03-27

### Bids — Bid Date Sent attestation

- Setting or changing **Bid Date Sent** in the New/Edit Bid modal opens an attestation dialog: email sent (client knew), phone follow-up, and honesty/suspension acknowledgment. Each checked line shows the current user’s display name and local time; **Confirm** requires all three. **Cancel** restores the previous date.
- On save, the app persists `bid_date_sent_attested_at` / `bid_date_sent_attested_by` and per-checkbox `bid_date_sent_ack_{email,phone,honesty}_{at,by}` (FK to `users`). Clearing **Bid Date Sent** clears all attestation columns.
- Below the date field: **Sent N days ago** (whole calendar days) and **Acknowledged by …** when attested; legacy rows with a sent date but no attestation show an optional “no attestation on file” line.

**Files**: [`supabase/migrations/20260327201115_bid_date_sent_attestation.sql`](supabase/migrations/20260327201115_bid_date_sent_attestation.sql), [`src/pages/Bids.tsx`](src/pages/Bids.tsx), [`src/types/database.ts`](src/types/database.ts)

---

## Latest Updates (v2.167)

**Date**: 2026-03-27

### Settings — People & accounts consolidation

- **Pay Approved Masters**, **Team feedback** (dev tools and pay-approved master aggregates), and **Additional People** (People Created by Me / Other Users) now live inside **People & accounts** (`settings-people`), in that order before **Sharing and Adoption** (master aggregates remain after sharing). No behavior or RLS changes—layout only.
- Removed the empty **Advanced** `SettingsGroup` and the dev jump link **Role & access** (`settings-advanced`).

**Files**: [`src/pages/Settings.tsx`](src/pages/Settings.tsx)

---

## Latest Updates (v2.166)

**Date**: 2026-03-27

### Settings — Days since last full backup (dev)

- **Your account**: Next to the **Export all backup** icon, shows **Time since manual DB backup: N days** (whole elapsed days) or **Never** if no successful full export yet. Timestamp is saved only after a successful **Export all backup** (`downloadJson` completes), in **`localStorage`** under `pipetooling_last_full_backup_at_<userId>` (or prefix-only key if no user id). Same write path for the header icon and **Data & migration → Export all backup**.

**Files**: [`src/pages/Settings.tsx`](src/pages/Settings.tsx)

---

## Latest Updates (v2.165)

**Date**: 2026-03-27

### Settings — Sharing merged into People & accounts

- **People & accounts** (`settings-people`): All **Sharing and Adoption** UI (adopt assistants/primaries/superintendents, master-to-master sharing, **Share Cost Matrix and Teams**, etc.) now lives in the same `SettingsGroup` as dev-only people tools (Active Accounts, role visibility, job overrides, Task Dispatch). **Masters** only see the sharing block in this group; **devs** see dev blocks first, then sharing. (Orphaned material prices review remains under **Catalogs & trades**.)
- **Jump navigation**: Removed separate **Sharing & access** (`settings-sharing`). **Dev** and **master_technician** use a single **People & accounts** jump link to `#settings-people`.
- **Docs**: `PROJECT_DOCUMENTATION.md` (Settings §9, roles), `ACCESS_CONTROL.md` (master Settings bullets, Settings matrix), this file.

**Files**: [`src/pages/Settings.tsx`](src/pages/Settings.tsx)

---

## Latest Updates (v2.164)

**Date**: 2026-03-27

### Settings — Ignored task types (dev)

- **Dashboard & alerts**: Collapsible **Ignored task types (Dashboard)** (below Muted Tasks) lists `dev_ignored_checklist_items` for the signed-in dev with titles from `checklist_items`, **Un-ignore** deletes the row (same as Dashboard Recently Completed Tasks). Helper copy distinguishes this from **Muted Tasks** (notifications). **File**: [`Settings.tsx`](src/pages/Settings.tsx).

---

## Latest Updates (v2.163)

**Date**: 2026-03-30

### Dashboard — Currently clocked in strip; Materials — supply house website

- **Currently clocked in** (team leads and roles that see pending clocks): Compact table **below pinned tabs** on the Dashboard (above the yellow pending banner when shown): **Currently clocked in (n)** as the first column header, then **Clocked in**, **Elapsed**, **Today** (total **clock session** hours for `work_date` = today per person; `people_hours` grid not included). Data from [`useDashboardMyTeamSectionState`](src/hooks/useDashboardMyTeamSectionState.ts) ([`Dashboard.tsx`](src/pages/Dashboard.tsx), [`DashboardTeamActiveClockStrip`](src/components/DashboardTeamActiveClockStrip.tsx)).

- **My team / Everyone** (dev, **master_technician**, **assistant** only): Toggle persisted in **`localStorage`** key `dashboard_clock_strip_scope`. **My team** = open sessions for people you lead (same as My Team pending query). **Everyone** = same date/approval filters **without** `user_id` filter; rows are **RLS-bounded** (e.g. dev and pay-access paths see broadly; team leads still only members unless policy allows more). **Today** column uses org-wide today totals when **Everyone** is selected. Hook: `orgWidePendingSessions`, `hoursTodayByUserIdOrg`, `loadOrgWidePending`, `loadTodayClockSessionsOrg`.

- **Materials → Supply Houses**: Expanded supply house row shows **Open website** beside phone when **`supply_houses.website_url`** is set ([`SupplyHousesTab`](src/components/SupplyHousesTab.tsx), [`SupplyHouseWebsiteLink`](src/components/SupplyHouseWebsiteLink.tsx)). Dropdowns elsewhere already offer **Open website** for selected houses.

---

## Latest Updates (v2.162)

**Date**: 2026-03-29

### Team feedback — dev eligibility reset, submission RLS, raw submission names

- **Eligibility overview (dev)**: Per-user **Reset** on [`TeamFeedbackEligibilityOverview`](src/components/team-feedback/TeamFeedbackEligibilityOverview.tsx) clears `snooze_until`, `last_completed_at`, `last_skipped_at`, and `last_prompt_at` on `team_feedback_user_state` via **`resetTeamFeedbackUserStateEligibilityForDev`** in [`teamFeedback.ts`](src/lib/teamFeedback.ts) using **UPDATE only** (no upsert for another user’s row; RLS allows dev UPDATE). **Reset** is disabled when no row exists; success and info toasts; reload after update.

- **Submit feedback**: [`submitTeamFeedback`](src/lib/teamFeedback.ts) sets **`reviewer_user_id`** from **`supabase.auth.getUser()`** so inserts satisfy **`team_feedback_submissions_insert_own`** (`reviewer_user_id = auth.uid()`). **`upsertTeamFeedbackUserState`** after submit uses the same id for completion state.

- **Migration** [`20270329140000_team_feedback_submissions_select_own.sql`](supabase/migrations/20270329140000_team_feedback_submissions_select_own.sql): Policy **`team_feedback_submissions_select_own`** — authenticated users may **SELECT** rows where **`reviewer_user_id = auth.uid()`**. Fixes PostgREST **`insert().select('id')`** returning **403** for non-dev users (raw SELECT was previously dev-only).

- **Raw submissions (dev)**: [`TeamFeedbackDevReports`](src/components/team-feedback/TeamFeedbackDevReports.tsx) loads nested **`users`** (`name`, `email`) for reviewer and manager FKs; table shows display names; CSV export includes **`reviewer_name`** and **`manager_name`** (copy notes dev-only audit).

---

## Latest Updates (v2.161)

**Date**: 2026-03-27

### Team feedback — `list_feedback_peer_candidates` final migration

- **Migration** [`20270329120000_list_feedback_peer_candidates_shared_labels_final.sql`](supabase/migrations/20270329120000_list_feedback_peer_candidates_shared_labels_final.sql): Re-applies the shared-label **`list_feedback_peer_candidates`** body so it **wins** over later June 2026 migrations that had replaced it with roster/dev-resolution logic. Behavior matches v2.160 (label intersection, `shared_tag_count`, cap 5000).

---

## Latest Updates (v2.160)

**Date**: 2026-03-27

### Team feedback — peer list by shared labels only

- **`list_feedback_peer_candidates`** (replaces master/roster union): Peers are **`users`** and **`people`** with at least one **`label_id`** in common with the reviewer. Reviewer labels come only from **`user_labels`** (`auth.uid()`). Peer match uses **`user_labels`** (other accounts) or **`people_labels`** (roster rows). **`shared_tag_count`** is the intersection size. **Empty** when the reviewer has no **`user_labels`**. Ordered **`shared_tag_count` DESC**, **`peer_name` ASC**, cap **5000**. Same human may appear twice in edge cases (`person_id` and `peer_user_id` rows).

**Files**: [`supabase/migrations/20260327150000_team_feedback_peer_candidates_by_shared_labels.sql`](supabase/migrations/20260327150000_team_feedback_peer_candidates_by_shared_labels.sql)

---

## Latest Updates (v2.159)

**Date**: 2026-03-26

### Team feedback — peer picker ordered by shared tags

- **`list_feedback_peer_candidates`**: Returns **`shared_tag_count`** (count of label IDs shared between the reviewer’s `user_labels` and each peer’s `people_labels` when `person_id` is set, else peer’s `user_labels`). Result set ordered by **`shared_tag_count` DESC**, then **`peer_name` ASC** (within the 5000 cap).
- **`PeerTeammatePicker`**: After filtering by name, re-sorts options by shared count, then name; muted line **N shared tag(s)** when count is greater than zero.

**Files**: [`supabase/migrations/20260326120200_list_feedback_peer_candidates_shared_tag_count.sql`](supabase/migrations/20260326120200_list_feedback_peer_candidates_shared_tag_count.sql), [`src/types/database.ts`](src/types/database.ts), [`src/lib/teamFeedback.ts`](src/lib/teamFeedback.ts), [`src/components/team-feedback/PeerTeammatePicker.tsx`](src/components/team-feedback/PeerTeammatePicker.tsx)

---

## Latest Updates (v2.158)

**Date**: 2026-03-28

### People — Tag org override and signals (dev)

- **`user_tag_org`**: Optional `user_id` → `master_user_id` for which master’s `labels` catalog applies to that login user; dev **INSERT**/**UPDATE**/**DELETE**/**SELECT** all; others **SELECT** own row only. **`enforce_user_labels_scope_master`** extended so `user_labels` inserts succeed when override matches label master.
- **People → Users** (tags enabled): **Tag org (saved)** dropdown + **Clear override**; read-only **Signals** from `master_assistants`, `master_superintendents`, `master_primaries`, job team (`jobs_ledger` masters), and people-email roster match; warning when saved org matches no signal.
- **`src/lib/tagOrg.ts`**: Batch overrides, signals, `upsertUserTagOrg` / `deleteUserTagOrg`; resolution = override first, else `resolveManagerUserIdForFeedback`.

**Files**: [`supabase/migrations/20270328120000_user_tag_org.sql`](supabase/migrations/20270328120000_user_tag_org.sql), [`src/lib/tagOrg.ts`](src/lib/tagOrg.ts), [`src/pages/People.tsx`](src/pages/People.tsx)

---

## Latest Updates (v2.157)

**Date**: 2026-03-26

### Team feedback / peer survey

- **Tables**: `team_feedback_settings` (singleton), `team_feedback_submissions`, `team_feedback_user_state`, `team_feedback_peer_ratings`; RPCs `list_feedback_peer_candidates`, `team_feedback_aggregates_by_manager` (dev: all managers; pay-approved masters: own aggregates only).
- **UX**: Post clock-out intro (cadence/snooze via `team_feedback_user_state`); optional Dashboard **Quick feedback** when `home_entry_enabled`; Section A (Likert + overall + open texts), optional Section B peers, comments-only path.
- **Settings (dev)**: Feature flags and copy; raw list + CSV export (optional `reviewer_user_id` column). Pay-approved masters: trend block without reviewer identity.

**Files**: [`supabase/migrations/20260628140000_team_feedback_foundation.sql`](supabase/migrations/20260628140000_team_feedback_foundation.sql), [`supabase/migrations/20260628141000_team_feedback_peers_and_aggregates.sql`](supabase/migrations/20260628141000_team_feedback_peers_and_aggregates.sql), [`src/lib/teamFeedback.ts`](src/lib/teamFeedback.ts), [`src/components/team-feedback/`](src/components/team-feedback/), [`src/components/ClockInOutButton.tsx`](src/components/ClockInOutButton.tsx), [`src/pages/Dashboard.tsx`](src/pages/Dashboard.tsx), [`src/pages/Settings.tsx`](src/pages/Settings.tsx)

---

## Latest Updates (v2.156)

**Date**: 2026-03-25

### People — Activity tab and selective org-wide access

- **`user_app_activity_viewers`**: `viewer_user_id` (assistant, master_technician, or primary only), optional `granted_by`, `created_at`. **RLS**: dev **INSERT**/**DELETE**/**SELECT** all; others **SELECT** own row only. **Trigger** rejects non-eligible roles.
- **`user_app_activity_daily`**: **SELECT** extended so users in the allowlist see **all** rows (same as dev), in addition to own rows and dev.
- **People**: New **Activity** tab (`?tab=activity`) for **dev** always (includes grant/revoke UI for eligible users) and for **granted** assistant / master / primary. **Deep link** `?tab=activity` redirects to **Users** if not allowed.
- **Settings**: Dev-only collapsible Activity section **removed**; use **People → Activity**.

**Files**: [`supabase/migrations/20270327120000_user_app_activity_viewers.sql`](supabase/migrations/20270327120000_user_app_activity_viewers.sql), [`src/pages/People.tsx`](src/pages/People.tsx), [`src/components/people/PeopleAppActivityPanel.tsx`](src/components/people/PeopleAppActivityPanel.tsx), [`src/utils/formatActiveSeconds.ts`](src/utils/formatActiveSeconds.ts), [`src/utils/formatNotificationDatetime.ts`](src/utils/formatNotificationDatetime.ts), [`src/pages/Settings.tsx`](src/pages/Settings.tsx)

---

## Latest Updates (v2.155)

**Date**: 2026-03-26

### Settings — Activity (dev): first-party app usage

- **`user_app_activity_daily`**: UTC calendar-day aggregates (`active_seconds`, `first_seen_at`, `last_seen_at`). **RLS**: users **SELECT** own rows or **dev** sees all; writes only via **`bump_user_app_activity`** (SECURITY DEFINER).
- **Layout**: **`useAppActivityHeartbeat`** calls the RPC every **60s** while the tab is **visible** (first bump after the first interval).
- **Settings**: Dev-only collapsible **Activity** lists **Name**, **Email**, **Last seen**, **Active (7d)** / **(30d)** (h:mm). **Superseded by v2.156** (People → Activity).

**Files**: [`supabase/migrations/20270326120000_user_app_activity_daily.sql`](supabase/migrations/20270326120000_user_app_activity_daily.sql), [`src/hooks/useAppActivityHeartbeat.ts`](src/hooks/useAppActivityHeartbeat.ts), [`src/components/Layout.tsx`](src/components/Layout.tsx), [`src/pages/Settings.tsx`](src/pages/Settings.tsx)

---

## Latest Updates (v2.154)

**Date**: 2026-03-26

### People — Licenses: Dispatch when expiring within 30 days

- When a license is **saved** (insert or update) and **date of expiry** falls between **today** and **today + 30 days** (same window as the Licenses “expiring soon” list), the app creates **at most one** **`dispatch_requests`** row for the Dispatch Inbox: title includes person, license type, and expiry date, with **`[1]`** linking to **People → Licenses** (`/people?tab=licenses`).
- **`person_licenses.expiry_dispatch_notified_at`** records that a task was sent (dedupe). **`notify_dispatch_license_expiry_if_needed`** (SECURITY DEFINER RPC) inserts the row and sets the timestamp atomically; the client then invokes **`notify-dispatch-request`** for Web Push to Dispatch members (same flow as Task Dispatch).

**Files**: [`supabase/migrations/20260325140000_person_license_expiry_dispatch_notification.sql`](supabase/migrations/20260325140000_person_license_expiry_dispatch_notification.sql), [`src/pages/People.tsx`](src/pages/People.tsx)

---

## Latest Updates (v2.153)

**Date**: 2026-03-26

### Dashboard — My Team: layout and pending banner

- **Section order** (below **Start–End** / **People you lead**): **Clock activity** (expandable ledger) appears **above** **Active clock sessions**, then **Pending sessions** (same `#dashboard-my-team-pending` wrapper).
- **Clock activity** toggle label is **Clock activity** only (session count suffix removed).
- **Pending clock sessions** banner (yellow bar when approvals are waiting): no separate **Jump to pending table** link; the **entire bar** is a **button** (`aria-label`: go to pending sessions in My Team). Click **expands My Team** if collapsed and **smooth-scrolls** to the **Pending sessions** card (`id="dashboard-my-team-pending-sessions"`).
- Pending session **data** in **`useDashboardMyTeamSectionState`** still **loads** while **My Team** is collapsed (not gated on expand state).

**Files**: [`src/components/DashboardMyTeamSection.tsx`](src/components/DashboardMyTeamSection.tsx), [`src/components/DashboardMyTeamPendingBanner.tsx`](src/components/DashboardMyTeamPendingBanner.tsx), [`src/pages/Dashboard.tsx`](src/pages/Dashboard.tsx)

---

## Latest Updates (v2.152)

**Date**: 2026-03-25

### Dashboard — My Team: People you lead hours

- **People you lead** shows a compact table: **Pending**, **Approved**, and **Total** hours per direct report for the selected **Start–End** range (same as pending sessions and clock activity). Totals come from **`clock_sessions`**; duration matches **My Time** (open sessions use elapsed time through now). Rejected and revoked sessions add **0** to all columns.

**Files**: [`src/components/DashboardMyTeamSection.tsx`](src/components/DashboardMyTeamSection.tsx)

---

## Latest Updates (v2.151)

**Date**: 2026-03-24

### Dashboard — My Team: clock notifications and activity ledger

- **Notify on clock in/out** (per person you lead): stores opt-in in **`team_leader_clock_notify_prefs`** (FK to **`team_leader_assignments`**). Leaders toggle only their own rows; dev/master/assistant can manage via existing assignment powers.
- **Web Push**: Edge Function **`notify-team-lead-clock`** sends pushes to opted-in leaders when a member **clocks in** (`clock_sessions` INSERT) or **clocks out** (`clocked_out_at` set on UPDATE). Configure a **Database Webhook** on `clock_sessions` (INSERT + UPDATE) in the Supabase project (see [EDGE_FUNCTIONS.md](EDGE_FUNCTIONS.md)). Optional env **`TEAM_LEAD_CLOCK_WEBHOOK_SECRET`** for webhook `Authorization` instead of the service role key.
- **Clock activity**: Expandable ledger lists all **`clock_sessions`** for your team in the **same date range** as the pending week controls (`work_date` + `clocked_*_at` display matches existing clock tables).

**Files**: [`supabase/migrations/20260330170000_team_leader_clock_notify_prefs.sql`](supabase/migrations/20260330170000_team_leader_clock_notify_prefs.sql), [`supabase/functions/notify-team-lead-clock/index.ts`](supabase/functions/notify-team-lead-clock/index.ts), [`src/components/DashboardMyTeamSection.tsx`](src/components/DashboardMyTeamSection.tsx)

---

## Latest Updates (v2.150)

**Date**: 2026-03-24

### Dashboard — My Team: “People you lead” roster

- Team leads see a **sorted list** of people assigned to them (**Team Hours Sharing** in Settings), with display names from **`users`** (name, then email, then a short id suffix if the row is not visible under RLS).
- The list appears **above** the pending clock sessions description so it stays visible when there are **no** pending sessions in the selected date range.

**Files**: [`src/components/DashboardMyTeamSection.tsx`](src/components/DashboardMyTeamSection.tsx)

---

## Latest Updates (v2.149)

**Date**: 2026-03-29

### Dashboard — “My Roles Goals” full-screen gate

- **When**: After the **first successful clock-in of the calendar day** (local work date), users who have at least one goal row see a full-screen overlay titled **“My Roles Goals”** with large checkboxes per goal and a **Continue** button.
- **Dismissal**: **Continue** records acknowledgment in **`user_daily_goals_ack`** for that calendar day; the gate does not reappear until the next calendar day (even if the user clocks in again the same day).
- **Editing goals**: **Dev**, **master_technician**, and **assistant** can manage another user’s goal lines in **Settings** (picker + add/edit/delete/reorder). Goals are stored in **`user_dashboard_goals`** (`user_id`, `body`, `sort_order`).
- **Layout**: While the gate is open, the main app shell is **inert** (no interaction behind the overlay).

**Files**: [`src/lib/dailyGoalsGate.ts`](src/lib/dailyGoalsGate.ts), [`src/contexts/DailyGoalsGateContext.tsx`](src/contexts/DailyGoalsGateContext.tsx), [`src/components/DailyGoalsGateOverlay.tsx`](src/components/DailyGoalsGateOverlay.tsx), [`src/components/ClockInOutButton.tsx`](src/components/ClockInOutButton.tsx), [`src/components/Layout.tsx`](src/components/Layout.tsx), [`src/pages/Settings.tsx`](src/pages/Settings.tsx), [`supabase/migrations/20260329120000_user_dashboard_goals_and_ack.sql`](supabase/migrations/20260329120000_user_dashboard_goals_and_ack.sql)

---

### People / Quickfill — Pending clock sessions table UX

- **Time & location column**: Line 1 shows clock-in/out times and duration; line 2 shows **work date** and **location** (or **In: — | Out: —** when GPS was not captured).
- **Notes & job**: **Notes** and **Job or Bid** are merged into one **two-column-wide** cell: notes on top; assigned job/bid label below (assignment controls stay in the Job column where applicable). Shared formatter: `formatClockSessionJobOrBidLabel` in [`src/types/clockSessions.ts`](src/types/clockSessions.ts).
- **Status / accountability**: “Approved/Rejected/Revoked by … at” and the timestamp render on **two lines**; timestamps use **short locale date/time** (no seconds).
- **Actions column** (pending sessions): Button order is **Approve → Reject → Edit** (People Hours and Quickfill Hours).

**Files**: [`src/components/clock-sessions/ClockSessionsTable.tsx`](src/components/clock-sessions/ClockSessionsTable.tsx), [`src/components/clock-sessions/ClockSessionLocationCell.tsx`](src/components/clock-sessions/ClockSessionLocationCell.tsx), [`src/pages/People.tsx`](src/pages/People.tsx), [`src/components/quickfill/HoursSection.tsx`](src/components/quickfill/HoursSection.tsx)

---

## Latest Updates (v2.148)

**Date**: 2026-03-24

### Bids – Bid Board: All notes and notes tabs

- **All notes** (third notes mode, first in the tab strip): Merges **bid submission entries** (`bids_submission_entries`) and **general customer contacts** (`customer_contacts`) for the bid’s linked customer into one list sorted **newest first**. Rows show a **Bid note** or **Customer note** badge plus distinct background / left border. **Add bid note** and **Add customer note** open inline drafts (customer add disabled when the bid has no linked customer). New/edited bid notes still update **`bids.last_contact`** when applicable.
- **Tab order**: **All notes** | **Bid notes** | **Customer notes**. Expanding the Notes row defaults to **All notes** (state sync when `expandedBidBoardBidId` is set).
- **Bid notes** and **Customer notes** tabs unchanged: still use `BidNotesTable` and `CustomerNotesTable` alone.

**Files**: [`src/components/bidBoard/UnifiedBidCustomerNotes.tsx`](src/components/bidBoard/UnifiedBidCustomerNotes.tsx), [`src/pages/Bids.tsx`](src/pages/Bids.tsx)

---

### Bids – Customer notes UX parity and `contact_method`

- **Builder Review** and Bid Board **Customer notes** tab: **Customer notes** use the same stacked-card pattern as bid notes (inline add row, edit/delete, contact method quick picks, `datetime-local`), not a table + modal.
- **Database**: Nullable **`customer_contacts.contact_method`** (append-only migration); aligns with bid submission entry contact method. Regenerate [`src/types/database.ts`](src/types/database.ts) after apply.
- **Shared UI**: [`src/components/shared/ContactMethodQuickPicks.tsx`](src/components/shared/ContactMethodQuickPicks.tsx) (Font Awesome–licensed icons) used by bid notes and customer notes.

**Files**: [`src/components/customerNotes/CustomerNotesTable.tsx`](src/components/customerNotes/CustomerNotesTable.tsx), [`src/components/bidNotes/BidNotesTable.tsx`](src/components/bidNotes/BidNotesTable.tsx), [`supabase/migrations/20260324120000_add_customer_contacts_contact_method.sql`](supabase/migrations/20260324120000_add_customer_contacts_contact_method.sql)

---

## Latest Updates (v2.147)

**Date**: 2026-07-23

### Settings: Remove Specific Pins and Page Pins for All Roles

- **Remove specific pins**: Per-pin Remove button in Settings → Dashboard Page Pins → Page pins. Users can remove individual pins instead of only "Clear all". Uses `removePin()` and `getMergedFilteredPins()` from `pinnedTabs.ts`.
- **Dashboard Page Pins visible to all roles**: The section is no longer dev-only. Assistants, masters, subcontractors, estimators, primaries, and superintendents see the Page pins card (Clear all + per-pin Remove list). Dev-only cards (Pin Billed, Cost matrix, Supply Houses AP, Sub Labor Due) remain dev-only.

**Files**: `src/pages/Settings.tsx`, `src/lib/pinnedTabs.ts`

---

### Assistant Dashboard: Tally and Pinned Below Clock In

- **Change**: For assistants, the Tally and Job Report row and pinned pages now appear directly below Clock In/Out, before Ready to Bill and Dispatch.
- **Order**: Clock In → Tally + Job Report + pinned pages → Ready to Bill / Dispatch / Billed → Inspections → rest. Non-assistant roles keep the original order.

**Files**: `src/pages/Dashboard.tsx`

---

### Subcontractor Assigned Jobs: last_report_at

- **Change**: `list_assigned_jobs_for_dashboard` RPC now returns `last_report_at` (max `reports.created_at` for the job) for subcontractor Dashboard cards, showing "time since last report" (e.g. "Open 1 week").

**Files**: `supabase/migrations/20270324120000_add_last_report_at_to_list_assigned_jobs.sql`

---

### Hours Review Modals

- **ReviewHoursModal**: Person/week navigation and "Mark as reviewed" checkbox for Pay tab hours workflow.
- **PersonTimeDetailModal**: Detailed time breakdown for a person.
- **AssignFocusModal**: Assign clock focus from Clock In / Update Focus flow.

**Files**: `src/components/ReviewHoursModal.tsx`, `src/components/PersonTimeDetailModal.tsx`, `src/components/AssignFocusModal.tsx`, `src/pages/People.tsx`

---

## Latest Updates (v2.146)

**Date**: 2026-07-23

### Dashboard: Billing Sections Above Checklist for Dev/Master

- **Change**: For dev and master_technician, Ready to Bill and Billed Waiting for Payment now appear above Checklist Due Today (along with Dispatch inbox, which was already there).
- **Order**: Ready to Bill, Dispatch inbox, Billed Waiting for Payment, then Checklist Due Today, Checklist Outstanding, My Bids, and the rest.
- **Files**: `src/pages/Dashboard.tsx`

---

## Latest Updates (v2.145)

**Date**: 2026-07-23

### Master Technician Mobile Nav: Quickfill and Review in Hamburger Menu

- **Change**: On mobile, master technicians no longer see the Quickfill icon in the header. Instead, Quickfill and Review (People Review tab) appear as links at the top of the hamburger menu, reducing header crowding.
- **Files**: `src/components/Layout.tsx`

---

## Latest Updates (v2.144)

**Date**: 2026-07-23

### Assistant Billing Sections at Top of Dashboard

- **Change**: For assistants, the billing sections (Ready to Bill, Dispatch inbox, Billed Waiting for Payment) now appear at the top of the Dashboard, directly below Clock In/Out and above Upcoming inspections, My Bids, and the rest of the content.
- **Files**: `src/pages/Dashboard.tsx`

---

## Latest Updates (v2.143)

**Date**: 2026-07-23

### Assistant Dashboard Section Reorder

- **Change**: For assistants, the billing-related Dashboard sections now appear in this order: (1) Ready to Bill, (2) Dispatch inbox, (3) Billed Waiting for Payment.
- **Implementation**: Assistants see a grouped block at the top of the Dashboard (above My Bids); dev and master_technician keep the previous layout (Dispatch inbox near My Bids, Ready to Bill and Billed Waiting for Payment lower).
- **Files**: `src/pages/Dashboard.tsx`

---

## Latest Updates (v2.142)

**Date**: 2026-07-23

### Dashboard: Assigned Jobs and Superintendent Jobs UX

- **Clock In modal**: "Choose from my jobs?" button moved from the first row (next to "Use last") to the right of "Filtering by: [service type]" (or right of the service type dropdown when multiple types). Same placement in Update Focus modal when multiple service types; when no service types, button appears right-aligned on its own row.
- **Superintendent Jobs expanded by default**: Section is now expanded when superintendents load the Dashboard (`superintendentJobsExpanded` initial state `true`).
- **Superintendent Jobs button layout**: Matches subcontractor Assigned Jobs layout. Row 1: View Reports | Send to Billing (side by side). Row 2: Open X (time since created). View link removed for superintendents in both Assigned Jobs and Superintendent Jobs.
- **Superintendent Send to Billing**: Migration `20260624000000_allow_superintendent_send_to_billing.sql` extends `update_job_status` so superintendents can mark jobs Ready for Billing when the job belongs to a project they supervise (via `project_superintendents` or `master_superintendents`).
- **Open X single line on mobile**: In Assigned Jobs and Superintendent Jobs, "Open 1 week" (or similar) displays on one continuous line on mobile instead of two lines; desktop keeps two-line layout.
- **In progress stage banner**: In-progress stage moved from inline text to a full-width banner at the bottom of job cards (Assigned Jobs and Superintendent Jobs). Banner uses soft purple background (`#ede9fe`) and dark purple text (`#6d28d9`). Click navigates to Workflow page at the in-progress step (`/workflows/{project_id}#step-{step_id}`). Fallback: `/workflows` when `project_id` or `in_progress_step_id` missing.
- **Superintendent Jobs mobile flex**: Left column uses same `flex: 0 0 50%` on mobile as Assigned Jobs for consistent layout.

**Files**: `src/pages/Dashboard.tsx`, `src/components/ClockInOutButton.tsx`, `supabase/migrations/20260624000000_allow_superintendent_send_to_billing.sql`

---

## Latest Updates (v2.141)

**Date**: 2026-07-01

### Hours Reviewed Ledger

- **Feature**: Weekly "hours reviewed" workflow for Pay tab. Dev, pay-approved masters, and assistants can mark that they have reviewed a person's hours for a given week.
- **Review Hours modal**: "Mark as reviewed" checkbox below the breakdown (when viewing a person's hours). Toggle persists to `hours_reviewed` table.
- **Hours reviewed ledger**: New section on Pay tab (after Due by Team) showing one row per person with checkmark (reviewed) or dash (not reviewed). Summary: "X of Y reviewed".
- **Data**: New `hours_reviewed` table (person_name, start_date, end_date, reviewed_by, reviewed_at); UNIQUE(person_name, start_date). RLS mirrors person_offsets.

**Files**: `supabase/migrations/20260701000000_create_hours_reviewed.sql`, `src/components/ReviewHoursModal.tsx`, `src/pages/People.tsx`, `src/types/database.ts`

---

## Latest Updates (v2.140)

**Date**: 2026-06-25

### RLS Policy Name Truncation Fix

- **Problem**: Devs and assistants got "new row violates row-level security policy for table 'cost_estimates'" when adding Bids Counts rows. Logs showed only the DELETE policy was present; INSERT/UPDATE/SELECT policies were missing.
- **Cause**: Postgres truncates policy names to 63 characters. Long descriptive names (e.g. "Devs masters assistants estimators primaries superintendents can insert cost estimates") collided or caused policies to be dropped during migration application.
- **Fix**: Drop all policies on `cost_estimates`, `cost_estimate_labor_rows`, and `bid_pricing_assignments` via `pg_policies` loop; recreate with short names (ce_select, ce_insert, ce_update, ce_delete; celr_*; bpa_*). Use only `can_access_bid_for_pricing` (SECURITY DEFINER).
- **Tables**: cost_estimates, cost_estimate_labor_rows, bid_pricing_assignments

### AbortError Non-Retryable

- **Problem**: When switching Bids tabs or navigating away, aborted Supabase requests triggered retry logic and log spam.
- **Fix**: `isRetryableError` in `src/utils/errorHandling.ts` now treats `AbortError` (and errors with "abort" in the message) as non-retryable. `withSupabaseRetry` no longer retries when the user has navigated away or cancelled the request.

**Files**: `supabase/migrations/20260625140000_cost_estimates_rls_recreate_all.sql`, `20260625150000_cost_estimate_labor_rows_rls_recreate_all.sql`, `20260625160000_bid_pricing_assignments_rls_recreate_all.sql`, `src/utils/errorHandling.ts`

---

## Latest Updates (v2.139)

**Date**: 2026-06-24

### Fix cost_estimates RLS for Assistants and Devs

- **Problem**: Assistants and devs got "Failed to create cost estimate: new row violates row-level security policy for table 'cost_estimates'" when adding a Bids Counts row or opening the Cost Estimate tab.
- **Cause**: (1) Policies used inline subqueries on `bids` and `users` (subject to RLS). (2) Even after switching to `can_access_bid_for_pricing`, the redundant `EXISTS (SELECT 1 FROM users ...)` ran as invoker and could fail under users RLS.
- **Fix**: (1) Replace inline subqueries with `can_access_bid_for_pricing(bid_id)`. (2) Drop the users subquery; use only `can_access_bid_for_pricing` (it validates role via SECURITY DEFINER internally).
- **Tables**: cost_estimates (4 policies), cost_estimate_labor_rows (4 policies).

**Files**: `supabase/migrations/20260624000100_fix_cost_estimates_rls_use_helper.sql`, `supabase/migrations/20260624120000_cost_estimates_rls_drop_users_subquery.sql`

---

## Latest Updates (v2.138)

**Date**: 2026-06-23

### Revoke Superintendent Jobs Billing Access

- **Background**: Migration `20260623170000_superintendent_ledger_assigned_only` had incorrectly granted superintendents access to the Jobs Billing tab (`jobs_ledger` and child tables). The correct ledger for superintendents is **Workflow Line Items For Office**, which was already fixed. Superintendents should not see Jobs billing data.

- **RLS revoked** on 8 tables (removed `superintendent` from role checks and removed `can_access_project_row` project-assignment branch):
  - jobs_ledger, jobs_ledger_materials, jobs_ledger_invoices, jobs_ledger_payments
  - jobs_ledger_fixtures, jobs_ledger_team_members, jobs_tally_parts, job_status_events

- **Jobs page**: Superintendent tabs reduced from Reports, Stages, Billing, Sub Sheet Ledger → **Reports, Sub Sheet Ledger only**. Stages and Billing tabs hidden; default tab changed from `stages` to `reports`. Direct URLs `/jobs?tab=billing` and `/jobs?tab=stages` redirect to Reports.

- **Unchanged**: Reports tab and `list_reports_with_job_info` remain accessible to superintendents. Workflow Line Items For Office, Dashboard Assigned Jobs, and in-progress stage links still work (SECURITY DEFINER RPCs).

**Files**: `supabase/migrations/20260623190000_revoke_superintendent_jobs_billing.sql`, `src/pages/Jobs.tsx`, `ACCESS_CONTROL.md`

---

## Latest Updates (v2.137)

**Date**: 2026-06-22

### Superintendents: Approve and Send Back: Previous Work Incomplete

- **Superintendents can use Approve and Send Back: Previous Work Incomplete** on the Workflow page and Dashboard Assigned Stages (previously dev, master, and assistant only).
- **AssignedStageCard**: Added superintendent to `canApproveReject` so Approve/Send Back buttons appear on Dashboard Assigned Stage cards.
- **Backend**: Updated `can_access_step_for_action` to allow superintendents with workflow access to INSERT into `project_workflow_step_actions` (action ledger) when they Approve or Reject.

**Files**: `src/components/AssignedStageCard.tsx`, `supabase/migrations/20260622130000_superintendent_approve_step_actions.sql`, `ACCESS_CONTROL.md`, `WORKFLOW_FEATURES.md`, `PROJECT_DOCUMENTATION.md`

---

## Latest Updates (v2.136)

**Date**: 2026-03-22

### Line Items For Office – Rename, UX, Supply House Invoice Integration

- **Renamed**: "Line Items (Master and Assistants only)" → "Line Items For Office"
- **Fit-content table**: Table box width matches content; centered via flex wrapper (`display: flex`, `justifyContent: center`)
- **Button styling**: Add Line Item, Add PO buttons use `wf-btn-success-soft` class
- **Supply House Invoice integration**:
  - "Add Supply House Invoice" button when supply house invoices exist
  - Modal with search by invoice #, supply house name, amount, date, PO #, paid/unpaid
  - Row display: supply house, date, amount, PO #; secondary: invoice #, due date, Paid badge
  - Line items can link to `supply_house_invoices` via `supply_house_invoice_id`; "View Invoice" button opens details modal
  - `loadInvoiceDetails` modal shows invoice #, supply house, amount, link

### Clock Sessions Pay INSERT

- **New RLS policy**: Pay-access users (dev, pay-approved master, assistant) can INSERT into `clock_sessions` for split session operation in People Hours Edit modal

### Task Dispatch – Dismissals and Closed Note

- **Per-user dismissals**: `dispatch_request_dismissals` table; when a user dismisses a closed request, it is hidden from their inbox; other users still see it until they dismiss it
- **Closed note**: `dispatch_requests.closed_note` (text); required when closing (enforced in app)

### Contracts RLS – All Masters

- **RLS expanded**: All masters (not just Pay Approved) can manage contract templates, template documents, person contract assignments, and person contract documents via `is_master_or_dev()`

**Files**: `src/pages/Workflow.tsx`, `src/components/SupplyHousesTab.tsx`, `supabase/migrations/20260320130000_clock_sessions_pay_insert.sql`, `20260321120000_add_supply_house_invoice_to_line_items.sql`, `20260322140000_contracts_rls_all_masters.sql`, `20260621120000_dispatch_request_dismissals.sql`, `20260622120000_add_dispatch_closed_note.sql`

---

## Latest Updates (v2.135)

**Date**: 2026-03-21

### Workflow – Collapse Old Stages Toggle, Breadcrumb Layout, No-Wrap Scroll

- **Collapse old stages toggle**: Replaced "Collapse completed" button with a toggle ("Collapse old stages" / "Expand old stages"). When toggled on, all completed stages except the most recent (by `sequence_order`) are replaced by a single summary row: `X previous stages · Started 8/1/25`. Most recent completed stays visible; summary row is clickable to expand.
- **Stage breadcrumb below buttons**: Moved the stage list (Initial Site Walk → ... → Warranty) from the left column to a dedicated row below the title and "Expand old stages" / "Add step" buttons. Breadcrumb now has full width.
- **Prevent breadcrumb wrapping**: Added `overflow: hidden` to header wrapper, `minWidth: 0`, `overflowY: hidden`, `WebkitOverflowScrolling: touch` to breadcrumb container, and wrapped content in `inline-block` span so stages stay on one line with horizontal scroll when needed.

**Files**: `src/pages/Workflow.tsx`

---

## Latest Updates (v2.134)

**Date**: 2026-03-21

### Assistants: Private Notes and Approve/Previous Work Incomplete Access

- **Assistants can see and edit private notes** on workflow steps (previously dev/master only).
- **Assistants can use Approve and Previous work incomplete** buttons (Workflow page and Dashboard Assigned Stages).
- Backend already permitted this; changes were frontend-only (`canSeePrivateNotesAndApprove` flag).
- Settings copy updated: assistants "cannot see financial totals" (not private notes or financials).

**Files**: `src/pages/Workflow.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Settings.tsx`, `ACCESS_CONTROL.md`

---

## Latest Updates (v2.133)

**Date**: 2026-03-21

### Workflow – Approve/Previous Work Incomplete Restricted, Visual Separation

- **Approve/Previous work incomplete restricted to dev and master only** (v2.134 adds assistants). Superintendents do not see Approve/Previous work incomplete; they use Complete on assigned stages.
- **Visual separation**: Approve and Previous work incomplete are wrapped in a bordered group with left divider and extra spacing, distinct from Set Start and Complete (worker actions).
- **Approve color**: Approve is now blue (wf-btn-info) to distinguish manager sign-off from Complete (green, worker done).

**Files**: `src/pages/Workflow.tsx`, `src/pages/Dashboard.tsx`

---

## Latest Updates (v2.132)

**Date**: 2026-03-21

### Workflow Step Cards – Row Collapse, Collapsed Header, Button Modernization

- **Row collapse**: Each step card can collapse to 1–2 lines; completed/approved cards default collapsed; chevron in header toggles expand/collapse.
- **Collapsed header**: Shows Start/End dates, line items (count + total amount), Notes/Pvt word counts.
- **When collapsed**: Assign and Notify hidden; action buttons (Set Start, Complete, Approve, Previous work incomplete) remain visible.
- **Notes/Private Notes**: Section labels show word count (e.g. "Notes (12 words)", "Private Notes (5 words)").
- **Notify**: Right-aligned when expanded.
- **Button modernization**: Workflow-scoped CSS classes (`wf-btn-ghost`, `wf-btn-primary`, `wf-btn-success`, `wf-btn-danger`, `wf-btn-info`, `wf-btn-secondary`, etc.) with hover states and transitions.
- **Action button colors**: Set Start blue (initiate), Complete/Approve green (success), Previous work incomplete red (destructive).

**Files**: `src/pages/Workflow.tsx`, `src/index.css`

---

## Latest Updates (v2.131)

**Date**: 2026-03-21

### People – Contracts Tab

- **Contracts tab**: New tab on People page (next to Licenses) for tracking documents users need to sign. Same access as Licenses: devs, pay-approved masters, assistants.
- **Templates**: Manage templates (Farm Work, Government Projects, Master Plumber, etc.) with document lists. Create, edit, delete templates; add/remove documents per template.
- **Assign template**: Assign a template to a person; creates `person_contract_documents` for each template document (status: unsent).
- **Person rows**: Expandable rows with aggregate status dot (red: any unsent; yellow: any sent; green: all signed). Per-document table: Document, Status, URL, Signed date, Note, Edit.
- **Edit document modal**: URL, status (unsent/sent/signed), signed date, note. Upsert `person_contract_documents`.
- **Ad-hoc documents**: "+ Add document" for documents not from a template.
- **Schema**: `contract_templates`, `contract_template_documents`, `person_contract_assignments`, `person_contract_documents` with RLS (same pattern as person_licenses).

**Files**: `supabase/migrations/20260322120000_create_contract_templates.sql`, `20260322120001_create_contract_template_documents.sql`, `20260322120002_create_person_contract_assignments.sql`, `20260322120003_create_person_contract_documents.sql`, `src/pages/People.tsx`, `src/types/database.ts`, `ACCESS_CONTROL.md`

---

## Latest Updates (v2.130)

**Date**: 2026-03-21

### People – Archive Instead of Remove

- **Archive people**: People page now offers **Archive** instead of **Remove**. Archived people are soft-deleted (hidden from roster) but can be restored.
- **Schema**: `people.archived_at` (timestamptz, nullable). When set, person is excluded from roster and assign dropdowns.
- **People page**: Archive button (replaces Remove); collapsible "Archived people" section with Restore button. Creators see their own archived; devs see all archived.
- **Queries**: All people roster/assign queries now filter `.is('archived_at', null)` (People, Settings, Jobs, Workflow, ReceivablesSection, Prospects, SignUp).

**Files**: `supabase/migrations/20260321120000_add_archived_at_to_people.sql`, `src/pages/People.tsx`, `src/pages/Settings.tsx`, `src/pages/Jobs.tsx`, `src/pages/Workflow.tsx`, `src/components/quickfill/ReceivablesSection.tsx`, `src/pages/Prospects.tsx`, `src/pages/SignUp.tsx`, `src/types/database.ts`

---

## Latest Updates (v2.129)

**Date**: 2026-03-20

### Jobs–Projects Link

- **Schema**: `jobs_ledger.project_id` (nullable FK → projects, ON DELETE SET NULL). Trigger `jobs_ledger_project_master_match`: when project_id is set, job owner must match project owner.
- **Jobs page**: Project dropdown in Edit/New Job modal; when project selected, auto-fills customer; project badge with link to Workflow on job rows. **Edit**: When linking a job to a project, `master_user_id` is automatically updated to the project owner so the trigger passes.
- **Projects page**: Linked jobs displayed per project; "Create Job" link opens New Job form with project pre-filled.
- **RLS**: Superintendents with project-level assignment can see jobs linked to that project; INSERT allows creating jobs for projects user can access.
- **Create from project**: `/jobs?newJob=true&project=xxx` opens New Job with project and customer pre-filled.

**Files**: `supabase/migrations/20260320140000_add_project_id_to_jobs_ledger.sql`, `src/pages/Jobs.tsx`, `src/pages/Projects.tsx`, `src/types/database.ts`

---

## Latest Updates (v2.128)

**Date**: 2026-03-20

### Projects Page - Master and Superintendents Display

- **Projects list**: Each project row shows Master badge (blue) and Superintendents badges (green) with access.
- **Superintendents**: Union of adoption (master_superintendents) and project assignment (project_superintendents).
- **Display**: Dedicated Access row with badge-style layout; Master and Superintendents labels.

**Files**: `src/pages/Projects.tsx`

---

## Latest Updates (v2.127)

**Date**: 2026-03-20

### Project Superintendent Assignment

- **Project-level assignment**: Devs, masters, and assistants can assign superintendents to specific projects via the Workflow page. New "Assigned Superintendents" section between project header and Projections.
- **Access paths**: Superintendents gain access via adoption (master_superintendents, all master's projects) OR project assignment (project_superintendents, specific projects only).
- **Table**: `project_superintendents(project_id, superintendent_id)` with RLS; `can_access_project_row` updated to include project assignment.
- **UI**: Add/remove superintendents from dropdown; list shows assigned superintendents with Remove button.

**Files**: `supabase/migrations/20260520120010_create_project_superintendents.sql`, `src/pages/Workflow.tsx`, `src/types/database.ts`

---

## Latest Updates (v2.126)

**Date**: 2026-03-20

### People Hours – Split Clock Session

- **Split session**: In the Edit clock session modal, pay-access users can split a pending session into two at a chosen time. Enables assigning different jobs to each part (e.g. 4h Job A, 4h Job B).
- **Flow**: Click Edit on a pending session → "Split session" link → pick split time (default: midpoint) → preview shows Part 1 and Part 2 hours → Split button creates two sessions and deletes the original.
- **Validation**: Split time must be strictly between clock in and out; each part must be at least 0.01 hours (~36 seconds).
- **RLS**: New policy allows pay-access (masters, assistants) to INSERT clock sessions for any user (required for split).
- **sync_crew_jobs_from_clock** already handles multiple sessions per person/day; percentages computed from hours when approved.

**Files**: `src/pages/People.tsx`, `supabase/migrations/20260320130000_clock_sessions_pay_insert.sql`

---

## Latest Updates (v2.125)

**Date**: 2026-04-27

### approve_clock_sessions Fix and Client Helper

- **Bug fix**: "missing FROM-clause entry for table cs" in `approve_clock_sessions` RPC. Replaced `cs.clocked_in_at` with `v_session.clocked_in_at` in loop body (cs alias is only in scope inside the FOR SELECT).
- **approveClockSessions helper**: New [src/lib/approveClockSessions.ts](src/lib/approveClockSessions.ts) with explicit `schema('public')` and fetch fallback when RPC returns 404.
- **Supabase client**: Added `db: { schema: 'public' }` to createClient to avoid RPC schema mismatches.

**Files**: `src/lib/approveClockSessions.ts`, `src/lib/supabase.ts`, `src/pages/People.tsx`, `src/components/quickfill/HoursSection.tsx`, `supabase/migrations/20260427120000_fix_approve_clock_sessions_cs_scope.sql`

---

## Latest Updates (v2.124)

**Date**: 2026-04-25

### Jobs – Job Owner Override

- **Create jobs as another user**: When a user creates a new job, it can be assigned to a different owner (master or assistant) instead of themselves. Useful for devs who create jobs on behalf of a master.
- **app_settings**: Per-user override stored as `job_owner_override_<user_id>` = target user ID in `app_settings`.
- **Settings → Jobs & dispatch → Job creation overrides**: Dev-only section to configure which user each creator (dev, master, assistant) creates jobs as. Dropdown: Self (default) or pick a master/assistant.
- **Migration**: `20260425120000_add_job_owner_override_robert.sql` sets Robert (dev) to create jobs as Malachi (by name matching).

**Files**: `src/pages/Jobs.tsx`, `src/pages/Settings.tsx`, `supabase/migrations/20260425120000_add_job_owner_override_robert.sql`

---

## Latest Updates (v2.123)

**Date**: 2026-03-20

### Jobs – Stages: Paid / Left / Bid Column

- **Paid, left, bid labels**: Remaining / Total Bill column now shows three labeled lines: "[value] paid" (or "—" when 0), "[value] left", "[value] bid". Paid line always visible; shows "—" when payments_made is 0.
- **To bill formula**: "To bill" = Value Created - (Total Bill - Remaining) = Value Created - payments_made. Always shown below Value Created; displays "—" when value created is 0 or toBill is 0.
- **Value Created**: Appends "done" after the currency value (e.g. 76,632 done).
- **% Complete above Value Created**: Column order and header updated to "% Complete / Value Created".

**Files**: `src/pages/Jobs.tsx`

### Jobs – Edit/New Job Form

- **Job Total ($)**: Billing section label is **Job Total ($)** (was "Total Bill ($)", then "Job Total / Bid ($)").

**Files**: `src/pages/Jobs.tsx`

---

## Latest Updates (v2.122)

**Date**: 2026-04-23

### Bids – Counts: Drag-and-Drop Reordering

- **Drag handle**: Each count row has a grip icon (⋮⋮) in a new Reorder column; drag to reorder rows.
- **Batch RPC**: New `update_bids_count_rows_order` RPC persists order in one database call instead of N sequential updates.
- **Removed up/down arrows**: The previous ▲/▼ move buttons were removed; drag-and-drop is the sole reorder method.
- **Dependencies**: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` for sortable table rows.

**Files**: `src/pages/Bids.tsx`, `supabase/migrations/20260423120001_update_bids_count_rows_order_rpc.sql`, `package.json`

### Single Service Type UX

- **Clock In, Update Focus, Dispatch**: When a user has only one service type (e.g. subcontractor with Plumbing only), the modals now show "Filtering by: Plumbing" instead of a dropdown with redundant "All types" + single option. Search automatically uses the single type.
- **Auto-select**: When `serviceTypes.length === 1`, `selectedBidServiceTypeId` is set to that type so bid search filters correctly.

**Files**: `src/components/ClockInOutButton.tsx`, `src/components/DispatchTaskModal.tsx`

---

## Latest Updates (v2.121)

**Date**: 2026-03-19

### Jobs – Stages: ClickTooling Icon, Report Count Styling

- **ClickTooling wrench icon**: Safety-orange wrench icon added to the left of Edit and Create partial invoice in all Stages sections (Working, Ready to Bill, Billed Awaiting Payment, Paid in Full). Click opens https://clicktooling.com/ in a new tab with job customer name, email, phone, and address pre-filled as URL query params (`?name=...&email=...&phone=...&location=...`).
- **View Reports column**: When a job has reports (count > 0), the "X report(s)" text displays in bold and darker color (#111); when 0 reports, remains muted gray.

**Files**: `src/pages/Jobs.tsx`

### Jobs – Billing Section UX Refactor

- **Payments received**: Label changed from "Payments Made ($)" to "Payments received ($)"; later **Payments received** without **`($)`** (v2.285).
- **Total Bill + Remaining**: Remaining ($) moved next to Total Bill ($) in a flex row (side by side).
- **Create invoice inline**: Create partial invoice block compacted; Amount input and Create invoice button placed inline with Add Payment button in a single action row, with subtle separator above. Long description moved to input `title` tooltip.

**Files**: `src/pages/Jobs.tsx`

---

## Latest Updates (v2.95)

**Date**: 2026-03-11

### Jobs – Other job charges reflect in Parts

- **Parts Cost includes Other job charges**: Job Summary Parts Cost and Jobs Parts tab Total Parts Cost now include the sum of Other job charges (manual line items from Edit Job) in addition to Parts from Tally and Invoices from Supply Houses.
- **Parts tab Other job charges column**: New "Other job charges" column in Jobs Parts tab shows the other job charges sum per job.
- **Parts tab Other job charges section**: When expanding a job row in Parts tab, an "Other job charges" section appears below the tally parts table when the job has those line items, listing each line item with Description and Amount.
- **Link Other job charges to parts**: Optional `part_id` on `jobs_ledger_materials` links a line item to `material_parts`. Migration: `20260311120002_add_part_id_to_jobs_ledger_materials.sql`. Part picker was removed from Edit Job modal for simplicity; Other job charges now uses description + amount only.

### People – Review Tab (Parts Cost)

- **Parts Cost includes Other job charges**: People Review Parts Cost (labor jobs, crew jobs, allocation) now includes Other job charges from `jobs_ledger_materials` in addition to tally parts and supply house invoice amounts.

### Jobs – Parts Tab: Materials-Only and Invoice-Only Jobs

- **Jobs with Other job charges only**: Parts tab now includes jobs that have Other job charges but no tally parts. Previously these jobs appeared in the Billing tab but not in Parts. They now show with Parts from Tally = $0, Other job charges column populated; when expanded, only the Other job charges section is shown (no empty tally parts table).
- **Jobs with Invoices from Supply Houses only**: Parts tab now includes jobs that have supply house invoice allocations (from Materials Supply Houses) but no tally parts and no Other job charges. `loadTallyParts` merges job IDs from `supply_house_invoice_job_allocations` with tally parts job IDs before calling `get_invoice_amounts_for_jobs`, so all jobs with invoice allocations get their amounts in the "Invoices from Supply Houses" column.

---

## Latest Updates (v2.108)

**Date**: 2026-04-15

### Jobs – Stages Tab: Ham Mode Date Buttons, Stage Notes, Job Name Wrap, View Reports Modal

- **Ham mode -1 / +1 buttons**: When Ham mode is ON (dev/assistant only), -1 and +1 buttons appear below the T-2 (tue) last bill date display. Clicking adjusts the job's `last_bill_date` by one day without opening Edit Job. If no date exists, +1 sets tomorrow, -1 sets yesterday.
- **Stage Notes**: Input changed to textarea for text wrapping; no placeholder when empty; transparent background; maxWidth removed, column minWidth 200 so the box expands to fill available space.
- **Job name wrap at comma**: When a job name contains a comma (e.g. "Smith Residence, Phase 2"), the text after the comma displays on a second line in gray, matching the address display pattern.
- **View Reports modal**: Escape and Spacebar close the full-screen modal. If a nested modal (viewing a report or adding an additional report) is open, that closes first. Spacebar is ignored when focus is in an input or textarea.

**Files**: `src/pages/Jobs.tsx`, `src/components/JobReportsModal.tsx`

---

## Latest Updates (v2.109)

**Date**: 2026-04-16

### Checklist – Item Links

- **`links` column**: Added `links text[] DEFAULT '{}'` to `checklist_items`. Placeholders `[1]`, `[2]`, etc. in the title map to `links[0]`, `links[1]`, etc.
- **Add/Edit modal**: Links section with `[1]`, `[2]`, URL inputs, `[+ add]`, and insert-at-cursor buttons to insert placeholders into the title.
- **`ChecklistTitleWithLinks` component**: Renders checklist item titles with `[1]`, `[2]`, etc. as clickable links (opens in new tab).
- **Dashboard, Checklist, People**: Fetch `checklist_items(title, links)` and use `ChecklistTitleWithLinks` for display.
- **Migration**: `20260415120003_add_checklist_item_links.sql`

### Per-Task Mute Preferences

- **`user_checklist_item_mute_preferences` table**: Per-task mute (user_id, checklist_item_id, muted_until). Users mute completed-task push notifications for specific checklist items.
- **Inline bell-off icon**: Checklist Today, Manage, Dashboard show mute icon for notification recipients (notify_on_complete_user_id or creator when notify_creator_on_complete). Click opens `ChecklistItemMuteModal` with Turn on / 1 week / 1 month / Forever.
- **Settings "Muted Tasks" list**: Shows per-task mutes with Unmute/Change; replaces global mute modal.
- **`send-checklist-notification` Edge Function**: Parses checklist_instance_id from tag, gets checklist_item_id; queries `user_checklist_item_mute_preferences` for (recipient, checklist_item_id) where muted_until > now; skips sending if match found (returns success with `push_sent: 0`).
- **Migrations**: `20260417120000_create_user_checklist_item_mute_preferences.sql`, `20260417120001_drop_user_completed_task_mute_preferences.sql`

---

## Latest Updates (v2.119)

**Date**: 2026-04-23

### Bids – Team Labor (clocked) in Cost Breakdown

- **people_crew_bids table**: Mirrors `people_crew_jobs` for bids; stores `bid_assignments` JSONB `[{ bid_id, pct }]` per person per work date.
- **Sync from clock**: When a clock session with `bid_id` is approved, `approve_clock_sessions` calls `sync_crew_bids_from_clock`; when revoked, `revoke_clock_sessions` recomputes or removes the row.
- **Bids Pricing cost breakdown**: When viewing a bid's Cost Model, "Team Labor (clocked)" line shows the cost of hours clocked to that bid; included in total cost.
- **loadTeamLaborDataForBids**: Fetches `people_crew_bids`, `people_hours`, `people_pay_config`; uses `get_bids_by_ids` RPC to resolve bid details; powers the display.
- **Cascade person name**: `people_crew_bids` updated when person names change (same as `people_crew_jobs`).

**Files**: `supabase/migrations/20260423120000_people_crew_bids.sql`, `src/utils/teamLabor.ts`, `src/pages/Bids.tsx`, `src/lib/cascadePersonName.ts`

---

## Latest Updates (v2.120)

**Date**: 2026-03-22

### Bid Search – Fix 0 Results for Subcontractors and Service Type Filter

- **Root cause**: `search_bids_for_clock` used SECURITY INVOKER; bids RLS blocks subcontractors (and only allows dev, master, assistant, estimator, primary). Subcontractors got 0 bids when searching in Clock In, Dispatch, and Add job or bid.
- **Fix**: Migration `20260322120000_search_bids_for_clock_security_definer.sql` changes the function to SECURITY DEFINER so it bypasses RLS. Filtering by `p_service_type_id` / `p_service_type_ids` remains enforced in the function.
- **2-arg overload fix**: Frontend calls with `{ p_search_text: q }` were matching the 2-arg overload (still SECURITY INVOKER). Migration `20260322120001_fix_bid_search_and_j_prefix.sql` drops the 2-arg overload so only the 3-arg SECURITY DEFINER version exists.
- **J/B prefix normalization**: "J651" now matches job with hcp_number "651"; "B88" matches bid with bid_number "88". Jobs store hcp_number as "651"; bids store bid_number as "88"; users often type the display prefix.
- **"All types" option**: Clock In, Update Focus, and Dispatch modals now default to "All types" in the service type dropdown and show the dropdown whenever service types exist (not only when multiple). Users can search across all service types or narrow by one.

**Files**: `supabase/migrations/20260322120000_search_bids_for_clock_security_definer.sql`, `supabase/migrations/20260322120001_fix_bid_search_and_j_prefix.sql`, `src/components/ClockInOutButton.tsx`, `src/components/DispatchTaskModal.tsx`

### Pay Report – Jobs and Bids

- **Pay Report table**: Now shows **Jobs / Bids** column (was "Jobs"). Fetches `people_crew_bids` alongside `people_crew_jobs`; uses `get_bids_by_ids` to resolve bid details. Per-day breakdown merges job and bid assignments, e.g. "Job 651 (Dudley Mason) 2.5 hrs, Bid 88 (Hagedorn) 1.5 hrs". Respects crew_lead inheritance for both.
- **Crew Jobs / Bids labeling**: Section headers and nav buttons updated from "Crew Jobs" to "Crew Jobs / Bids" in Quickfill and Jobs Team Labor tab. Assignments column supports both jobs and bids; Add job or bid modal searches both.

**Files**: `src/pages/People.tsx`, `src/components/CrewJobsBlock.tsx`, `src/pages/Quickfill.tsx`, `src/components/quickfill/HoursSection.tsx`

---

## Latest Updates (v2.118)

**Date**: 2026-04-22

### People / Hours – Auto-Create Crew Jobs from Approved Clock Sessions

- **Approve**: When a clock session with `job_ledger_id` is approved, `approve_clock_sessions` now creates or updates `people_crew_jobs` for that person and date. Percentages are computed from hours across all approved sessions (e.g. 2h Job A + 3h Job B → 40% A, 60% B).
- **Revoke**: When a session with `job_ledger_id` is revoked, `revoke_clock_sessions` recomputes `people_crew_jobs` from remaining approved sessions; if none remain, the row is deleted.
- **Crew lead skip**: If the person has `crew_lead_person_name` set (inherits from lead), we do not overwrite their crew job row.
- **Helper**: `sync_crew_jobs_from_clock(p_person_name, p_work_date)` centralizes the logic.

**Files**: `supabase/migrations/20260422120000_approve_clock_sessions_crew_jobs.sql`

---

## Latest Updates (v2.117)

**Date**: 2026-04-21

### Task Dispatch Modal UI

- **Modal title**: "Message the Dispatch team" (replaces "Task Dispatch")
- **Fields**: Task (required), Reference (optional), Links (optional) — Reference moved above Links
- **Hint**: "Use [1], [2] in the title for link placeholders." moved below [+ add] in Links section

### Subcontractor Service Type Restrictions

- **Settings → Active Accounts**: Devs can restrict subcontractors to specific service types (Plumbing, Electrical, HVAC) when editing a user or manually adding one. Same pattern as estimator/primary.
- **Clock In / Update Focus**: Restricted subcontractors see only bids matching their allowed service types in the job/bid search. Unrestricted (NULL/empty) = all types.
- **Task Dispatch**: Same restriction applies when attaching a job/bid reference in the Dispatch modal.
- **Database**: `subcontractor_service_type_ids UUID[]` on `users`; `search_bids_for_clock` extended with optional `p_service_type_ids` for multi-type filtering.
- **create-user Edge Function**: Accepts `service_type_ids` when role is subcontractor.

**Files**: `src/pages/Settings.tsx`, `src/components/ClockInOutButton.tsx`, `src/components/DispatchTaskModal.tsx`, `supabase/functions/create-user/index.ts`, `supabase/migrations/20260421120000_add_subcontractor_service_type_ids.sql`, `supabase/migrations/20260421120001_search_bids_for_clock_service_type_ids.sql`

---

## Latest Updates (v2.116)

**Date**: 2026-03-19

### Task Dispatch (messages to Dispatch group)

- **`dispatch_requests` / `dispatch_group_members`**: Any signed-in user can send a short request (task + optional reference + optional links, same `[1]` placeholders as checklist). Modal titled "Message the Dispatch team". Devs pick which **assistants** are Dispatch in Settings. Dispatch members and devs see **Dispatch inbox** on Dashboard and can mark requests closed.
- **Header**: **Task Dispatch** button (cyan) for all roles; mobile header includes compact **Dispatch**.
- **Edge Function `notify-dispatch-request`**: After insert, notifies all group members via Web Push without exposing the member list to the client; logs `notification_history` with `template_type: dispatch_request`.
- **Migration**: `20260419120000_dispatch_group_and_requests.sql`

**Files**: `src/components/DispatchTaskModal.tsx`, `src/contexts/DispatchTaskModalContext.tsx`, `src/components/Layout.tsx`, `src/pages/Settings.tsx`, `src/pages/Dashboard.tsx`, `supabase/functions/notify-dispatch-request/index.ts`

---

## Latest Updates (v2.115)

**Date**: 2026-03-20

### Bids – Bid # Auto-Generate, Backfill, Edit Restriction

- **Auto-generation**: New bids get the next sequential number via `bids_bid_number_seq` and `set_bid_number_if_empty` trigger. Bid # field is read-only ("Auto") when creating.
- **Backfill**: Existing bids assigned numbers 1, 2, 3... by `created_at` (oldest first).
- **Edit restriction**: Only dev, master_technician, and assistant can edit Bid #. Estimator and primary see Bid # as read-only when editing; database trigger blocks their updates.
- **Migrations**: `20260320120002_bid_number_auto_generate.sql`, `20260320120004_prevent_estimator_primary_edit_bid_number.sql`

**Files**: `src/pages/Bids.tsx`

---

## Latest Updates (v2.114)

**Date**: 2026-03-20

### Bids – Bid Number (like HCP for Jobs)

- **`bid_number` column**: Added to `bids` table for short identifiers (e.g. "456"). Displayed as `B456` in search and clock session displays.
- **Bids page**: Bid # input in create/edit form (near Project Name); Bid # column in bid board table; included in bid detail view and search filter.
- **Migrations**: `20260320120000_add_bid_number_to_bids.sql`, `20260320120001_search_bids_for_clock_add_bid_number.sql`

**Files**: `src/pages/Bids.tsx`, `src/types/database.ts`

### Clock In / Update Focus – Unified Job and Bid Search

- **Single search**: Replaced Job/Bid/None toggle with one search input. Searches both jobs (via `search_jobs_ledger`) and bids (via `search_bids_for_clock`) in parallel.
- **Display format**: Jobs show as `J123 · [job name] - [job address]`; bids show as `B456 · [project name] - [project address]`.
- **Placeholder**: "Search by HCP #, bid #, project name, or address"
- **Optional service type**: Dropdown filters bid results for estimator/primary roles.
- **Selected chip**: Shows formatted result with Clear button; stores full result so display persists after results clear.

**Files**: `src/components/ClockInOutButton.tsx`

### People / Hours – Clock Session Job and Bid Display

- **`bid_number` in selects**: People and HoursSection clock session queries include `bid_number` in bids join.
- **Display format**: Jobs as `J123 · [name] - [address]`; bids as `B456 · [project name] - [address]` in ClockSessionsTable.

**Files**: `src/pages/People.tsx`, `src/components/quickfill/HoursSection.tsx`, `src/components/clock-sessions/ClockSessionsTable.tsx`, `src/types/clockSessions.ts`

### People – get_archived_user_names Type Fix

- **RPC in types**: Added `get_archived_user_names` to `database.ts` Functions (Args: none, Returns: string[]).
- **Type guard**: `loadArchivedUserNames` uses `arr.filter((x): x is string => typeof x === 'string' && x.trim() !== '')` so `setArchivedUserNames` receives `Set<string>`.

**Files**: `src/types/database.ts`, `src/pages/People.tsx`

---

## Latest Updates (v2.113)

**Date**: 2026-03-17

### Bids – Cover Letter: Trip Charge Paragraph

- **Default Terms and Warranty**: Added paragraph after the rock excavation sentence: "Anything outside the scope of work described in this estimate, including any additional trips or visits beyond the standard rough-in, top-out, and trim phases, will be charged as a change order and will include a trip charge. Additionally, any trips or delays caused by builder, general contractor error, scheduling issues, or failure to provide timely access will be charged as a trip charge."
- **Applies to**: New bids and bids using default terms; combined document and Approval PDF

**File**: `src/pages/Bids.tsx` (DEFAULT_TERMS_AND_WARRANTY)

### Customers – Search

- **Search input**: Full-width search at top of Customers page (below header, above list)
- **Filters by**: Name, address, master user name/email, phone, email (case-insensitive substring match)
- **Empty state**: "No customers match your search." when query returns no results
- **Pattern**: Client-side filtering (same as Prospects Prospect List)

**File**: `src/pages/Customers.tsx`

### Layout – Customers Icon on Mobile (Devs Only)

- **Dev on mobile**: Customers icon removed from header; "Customers" link added to hamburger dropdown menu
- **Dev on desktop**: No change; Customers icon stays in header
- **Other roles**: No change; Customers icon stays in header on all viewports

**File**: `src/components/Layout.tsx`

---

## Latest Updates (v2.112)

**Date**: 2026-03-16

### Dashboard – Recent Reports: Persistent Read State

- **`report_reads` table**: New table stores which reports each user has marked as read. Read state persists across sessions and devices.
- **Load on dashboard**: When loading Recent Reports, the app fetches the user's read report IDs from `report_reads` and applies them.
- **Mark as read**: Expanding a report card inserts a row into `report_reads` for the current user.
- **Mark as unread**: Clicking "Mark as unread" deletes the row from `report_reads`.

**Files**: `src/pages/Dashboard.tsx`  
**Migrations**: `20260316120000_create_report_reads.sql`

---

## Latest Updates (v2.111)

**Date**: 2026-04-19

### Dashboard – Recently Completed Tasks: Button Icons

- **Mark as read**: Replaced text with envelope icon (Font Awesome); outline blue button with `title="Mark as read"`.
- **Re-send**: Replaced text with arrow-turn-up icon; filled blue button with `title="Re-send"`.
- **Read**: Replaced text with envelope-open icon when item is marked read; green (#059669) with `title="Read"`.
- **Ignore**: Uses ban/slash icon; outline gray button with `title="Ignore"`.

All buttons use `display: inline-flex`, `alignItems: center`, `justifyContent: center` for consistent icon centering.

**File**: `src/pages/Dashboard.tsx`

---

## Latest Updates (v2.110)

**Date**: 2026-04-18

### Dev Ignored Tasks Section

- **`dev_ignored_checklist_items` table**: Task types a dev has chosen to move to the Ignored section (dev_user_id, checklist_item_id, ignored_at). Dev-only RLS.
- **Dashboard Recently Completed Tasks**: Main section shows only task types not in dev's ignore list; UNREAD count excludes ignored items.
- **Collapsible "Ignored" section** (collapsed by default): Shows task types dev has ignored; grouped by completer; each item has Un-ignore button.
- **Ignore button**: On each item in main section; adds that task type to ignore list (moves to Ignored section).
- **Migration**: `20260418120000_create_dev_ignored_checklist_items.sql`

---

## Latest Updates (v2.106)

**Date**: 2026-03-15

### Dev Login (Testing Without Credentials)

- **`/dev-login` route**: Sign in as any user by email when running the dev server. No password required. Enables AI agents and automated tests to authenticate for checklist testing, E2E, etc.
- **Flow**: Frontend calls `dev-login` Edge Function with email + shared secret; function returns magic link; browser redirects; user lands authenticated.
- **Security**: Only active when `import.meta.env.DEV` is true. Requires `VITE_DEV_LOGIN_SECRET` in `.env.local` and `DEV_LOGIN_SECRET` for the Edge Function. Production builds redirect to sign-in.
- **Usage**: Open `http://localhost:5175/dev-login?as=user@example.com` or use the form at `/dev-login`. The email must exist in `auth.users`; use an existing user email for testing.
- **Docs**: `EDGE_FUNCTIONS.md` → dev-login; `AGENTS.md` and `AI_CONTEXT.md` → "Testing without credentials" in Where to Look For.

---

## Latest Updates (v2.107)

**Date**: 2026-03-15

### Checklist – Multi-assignee Support

- **Add/Edit modal**: Assign to uses checkboxes (multiple users) instead of single dropdown. At least one assignee required.
- **New junction tables**: `checklist_item_assignees` (item, user) and `checklist_instance_assignees` (instance, user). Dropped `assigned_to_user_id` from `checklist_items` and `checklist_instances`.
- **Dashboard, Checklist, People**: Fetch instances via `checklist_instance_assignees!inner(user_id)`; Today/History filter by assignee.
- **FWD and Reschedule flows**: Updated to use junction tables; FWD modal assigns to one user; Manage tab shows comma-separated assignees.
- **`send-scheduled-reminders` Edge Function**: Uses `checklist_instance_assignees` for assignee lookup.
- **Migrations**: `20260415120004_create_checklist_item_assignees`, `20260415120001_create_checklist_instance_assignees`, `20260415120002_drop_checklist_assigned_to_user_id`.

---

## Latest Updates (v2.105)

**Date**: 2026-03-15

### People – Hours Tab: Revoke, Accountability, UX

- **Revoke button**: Approved Sessions section now has a Revoke button. Revoking moves the session back to Pending and subtracts its hours from `people_hours`. Uses `revoke_clock_sessions` RPC.
- **Accountability**: Clock session rows show who performed the last action and when. Action column displays "Approved by [name] at [timestamp]", "Rejected by [name] at [timestamp]", or "Revoked by [name] at [timestamp]" as applicable.
- **Duration column**: Format changed to `0.00h | 1:52 PM | 1:52 PM | Sun, Mar 15` (times without seconds, date at end). Separate Date column removed.
- **Location cell**: When no Out location (e.g. active session), Out and the point-to-point route icon are hidden. Compact variant uses map pin icon instead of "map" text.

### Quickfill – Hours Section

- **Pending clock sessions**: Added above the hours grid. Same actions as People Hours (Force clock out, Edit link to People, Approve, Reject).
- **Approved Sessions**: Collapsible section with Revoke button. Both sections use the same date range as the hours grid and subscribe to `clock_sessions` Realtime.

### Quickfill – Crew Jobs

- **Job Cost column hidden**: Team Job Labor table in Quickfill hides the Job Cost column. `CrewJobsBlock` accepts `hideJobCostColumn` prop; `CrewJobsSection` passes it for Quickfill only.

### Database

- **`clock_sessions`**: Added `revoked_at`, `revoked_by` for accountability when sessions are revoked.
- **RPCs**: `revoke_clock_sessions(p_session_ids UUID[])` subtracts hours from `people_hours` and clears approved state; sets `revoked_at`/`revoked_by`; for sessions with `job_ledger_id`, recomputes or removes `people_crew_jobs`. `approve_clock_sessions` updated to clear `revoked_at`/`revoked_by` when approving; for sessions with `job_ledger_id`, auto-creates/updates `people_crew_jobs`.
- **Migrations**: `20260315120003_revoke_clock_sessions_rpc`, `20260315120004_add_revoked_to_clock_sessions`, `20260315120005_revoke_set_revoked_by_approve_clear`.

---

## Latest Updates (v2.104)

**Date**: 2026-03-13

### Clock In/Out – Job Selection

- **Optional job picker**: Below "What are you working on?" in both Clock In and Update Focus modals. Users can search jobs by HCP #, project name, or address via `search_jobs_ledger`, select a job (or leave blank), and the session stores `job_ledger_id` for reporting and payroll.
- **Label**: Notes field label changed from "What are you working on today?" to "What are you working on?"
- **Update Focus modal**: Starts blank (notes and job) with cursor in the notes textarea.
- **Button styling**: Clock Out and Update Focus buttons use solid colors with white text (Clock Out: solid red; Update Focus: solid blue).

### Database

- **`clock_sessions`**: Added `job_ledger_id` (UUID, nullable, FK → `jobs_ledger.id` ON DELETE SET NULL). Migration: `20260313180000_add_job_ledger_id_to_clock_sessions.sql`.

---

## Latest Updates (v2.103)

**Date**: 2026-03-13

### Bids – Pricing Print Unit Cost

- **Print uses user-entered unit cost**: When a user enters a custom Unit Cost in Bids → Pricing and clicks **Print** or **Print All**, the printed output now shows the entered unit price (from `bid_pricing_assignments.unit_price_override` or `bid_count_row_custom_prices`) instead of always using the price book value.
- **Consistency with on-screen display**: Print and Print All now use the same unit price resolution logic as the on-screen table: override first, then price book entry, then custom price.
- **Print All**: Fetches `bid_count_row_custom_prices` for all versions so custom prices are correctly applied per price book version.

---

## Latest Updates (v2.102)

**Date**: 2026-04-15

### Reports – Location Capture

- **Location at report submit**: When submitting a report (NewReportModal, AdditionalReportModal), the app requests geolocation. On success, `reported_at_lat` and `reported_at_lng` are stored in the `reports` table. On permission denied or timeout, submit proceeds without location.
- **Location icon in ReportViewModal**: When both coordinates exist, a location pin icon links to Google Maps. Visible only to devs, masters, and assistants—subcontractors, estimators, and primaries receive null from RPCs and do not see the icon.
- **Migrations**: `add_location_to_reports`, `insert_report_add_location_params`, `list_reports_with_job_info_add_location`, `list_my_reports_add_location`.

### Subcontractor Restrictions

- **Calendar hidden**: Calendar link removed from header for subcontractors; `/calendar` removed from allowed paths. Redirect to `/dashboard` if they try to access it.
- **Settings – Name read-only**: Subcontractors cannot edit their name in My Profile. Field is disabled with hint "Name is managed by admins. Contact a master or dev to change it."
- **Settings – Advanced hidden**: Advanced section (Fix app, admin code) is not shown to subcontractors.

### Settings – My Notification History

- **Hide when empty**: The "My Notification History" section is shown only when the user has at least one notification. A lightweight existence check runs on Settings load.
- **UX improvements**: Button instead of h2 for expand/collapse; error message displayed when fetch fails; scroll into view when expanded.

### Layout – Gear Dropdown

- **Fixed thick black bar**: For non-devs, the Hard Reload button now has `borderBottom: 'none'` explicitly to prevent browser default border from appearing as a thick black bar below the last item.

---

## Latest Updates (v2.101)

**Date**: 2026-03-15

### Clock In/Out – Location Capture

- **Location at clock-in**: When completing clock-in, the app requests geolocation (if available). On success, `clock_in_lat` and `clock_in_lng` are stored. On permission denied, timeout, or unavailable, clock-in proceeds without location.
- **Location at clock-out**: Same behavior when clocking out; `clock_out_lat` and `clock_out_lng` stored when available.
- **Pending clock sessions**: People Hours tab pending table now includes a **Location** column. Shows "In: lat, lng" and "Out: lat, lng" (each links to Google Maps when present); "—" when both missing. Coordinates truncated to 4 decimal places.
- **Optional**: Location is never required; clock-in/out always succeed. Users can pre-grant permission via Settings → Push Notifications → Enable Location based Reminders.

### Database

- **`clock_sessions`**: Added `clock_in_lat`, `clock_in_lng`, `clock_out_lat`, `clock_out_lng` (all NUMERIC, nullable). Migration: `20260315120000_add_location_to_clock_sessions.sql`.

---

## Latest Updates (v2.100)

**Date**: 2026-03-12

### Dashboard – Clock In/Out

- **Clock In button**: Full-width, safety orange (#ff6600), same height and text size as Job Report button. Visible to all authenticated users. Requires user to have a name set in Settings.
- **Clock In modal**: Clicking Clock In opens a modal with darkened backdrop (70% opacity). Required "What are you working on today?" notes field—cannot be skipped. Complete Clock In and Cancel buttons; Cancel on left, Complete on right. Body scroll lock when modal is open (iOS and Android). Auto-focus on notes textarea.
- **Total hours today**: When clocked in, the button shows total time worked during the current calendar day (sum of all sessions today), not just the current session. Updates every second.
- **Clock Out**: Red button with elapsed time and "Clock Out" label.

### People – Hours Tab: Pending Clock Sessions

- **Pending clock sessions**: Collapsible section above the Hours grid. Shows sessions where user has clocked out but approval has not yet been applied. Table: Person, Date, In, Out, Duration, Notes, Actions (Edit, Approve, Delete). Pay-access users only.
- **Approve**: Calls `approve_clock_sessions` RPC. Merges hours into `people_hours` (adds to existing for same person/date). For sessions with `job_ledger_id`, auto-creates/updates `people_crew_jobs` (percentages by hours). Marks session approved. Session disappears from pending list. Does not check `people_pay_config` or Show in Hours—approval succeeds for anyone.
- **Edit modal**: Edit clocked in/out times and notes. Notes required. Save disabled until notes are non-empty.
- **Realtime**: Hours tab subscribes to `clock_sessions` for live updates.

### Edge Cases and Behavior

- **Person without Show in Hours**: Approval succeeds; hours are written to `people_hours`. Person does not appear in the Hours grid (grid is built from `showPeopleForHours`). Hours exist but are not visible in the main Hours UI.
- **Devs**: Devs do not appear in the People Pay config roster (`allRosterNames` excludes devs). If a dev's clock session is approved, hours are written to `people_hours` but the dev has no pay config, so hours are not visible in the Hours grid or pay stub flows.
- **Cross-midnight work (e.g. 11pm–1am)**: `work_date` is set from the clock-in date. All hours are attributed to that date. The hour after midnight is not split across days. "Total hours today" on the Dashboard uses `work_date`—a session from 11pm–1am would not count toward "today" when viewed the next day.

### Database

- **`clock_sessions`**: `user_id`, `clocked_in_at`, `clocked_out_at`, `work_date`, `notes` (required), `approved_at`, `approved_by`. Migration: `20260312130000_add_notes_to_clock_sessions.sql`.
- **Realtime**: `clock_sessions` added to `supabase_realtime` publication.

---

## Latest Updates (v2.99)

**Date**: 2026-03-12

### Materials – Supply Houses Tab

- **Tab order**: Supply Houses tab moved to first position (before Price Book). A vertical-bar separator (`|`) appears between Supply Houses and Price Book, matching the Bids Builder Review | Counts pattern.
- **Tab title**: Renamed from "Supply Houses & External Subs" to "Supply Houses". Section header in SupplyHousesTab also simplified to "Supply Houses".
- **External Team section removed**: The External Team table (External Subcontractor, Sub Manager, Outstanding, Add Job Payment, Add External Subcontractor) has been removed from the Materials Supply Houses tab. Sub Labor Due data lives in Jobs Sub Labor tab (`people_labor_jobs` + `people_labor_job_payments`).
- **Dashboard pin**: "Pin Sub Labor Due to Dashboard" in Settings pins to Jobs Sub Labor tab instead. The pin shows "Sub Labor Due: $X" and links to `/jobs?tab=sub_sheet_ledger`.
- **Backup exports**: Removed `external_team_sub_managers` and `external_team_job_payments` from Jobs backup and Full backup exports.

---

## Latest Updates (v2.98)

**Date**: 2026-03-12

### Materials – Supply Houses Tab

- **Show paid invoices toggle**: Toggle in the top-right corner. When off (default), paid supply house invoices are hidden. When on, all invoices are shown.
- **Monthly payment date**: Supply house list Due column now uses `monthly_payment_day` from the supply house (e.g. "15th") instead of invoice due dates. Edit Supply House form includes "Monthly payment date" field (day 1–31). Migration: `20260311120000_add_monthly_payment_day_to_supply_houses.sql`.
- **Fallback when migration not applied**: If `monthly_payment_day` column does not exist, supply houses and invoices still load using fallback queries (id, name, etc.) so the tab works before the migration is applied.

---

## Latest Updates (v2.97)

**Date**: 2026-03-12

### Bids – Counts Tab

- **Save & Add label**: The "Save and Add" button now displays as two lines: "Save" and "& Add" for a more compact layout.
- **Cancel button styling**: Cancel button now matches Save and Save & Add styling (filled, no border): `background: #e5e7eb`, `color: #374151`, `border: none`.

### Bids – Pricing Tab

- **Price book dropdown centered**: The Price book label and version dropdown are now centered on the page, in a three-column layout: Bid name (left), Price book + dropdown (center), Print / Review / Close buttons (right).
- **Total row in price view**: The Unit Cost column in the total row no longer shows "—" when in Price Model view; the cell is empty since unit costs are not summed.

---

## Latest Updates (v2.96)

**Date**: 2026-03-11

### PWA – Auto-Update

- **Removed "New version available" banner**: The update prompt (orange banner with Later/Reload) has been removed. The app now uses `registerType: 'autoUpdate'` so when a new service worker is detected, the page reloads automatically to load the latest version.
- **Removed UpdatePromptContext and UpdatePrompt component**: Deleted `src/contexts/UpdatePromptContext.tsx` and `src/components/UpdatePrompt.tsx`. App.tsx now calls `registerSW({ immediate: true })` from `virtual:pwa-register` directly.
- **Removed "Reload to update" from Settings**: The conditional button in Settings header is gone.
- **Trade-off**: Users may lose unsaved form data if the app reloads while they have the app open during a deploy.

---

## Latest Updates (v2.95)

**Date**: 2026-03-11

### Jobs – Edit Sub Labor

- **Remove button in Edit Payment modal**: The Remove button has been moved from each payment row into the Edit Payment modal. Click Edit on a payment, then use Remove (with confirmation) in the modal footer. Cancel and Save remain on the right; Remove is on the left.
- **Number inputs blur on scroll**: Count, hrs/unit, and Rate inputs in the line-items table now blur when the user scrolls over them. This prevents the browser from incrementing/decrementing values when scrolling the modal content with the mouse wheel.

### Bids – Service Type Filter Row

- **Persistent New Bid button**: A New Bid button is now always visible on the right side of the service type filter row (in line with Plumbing, Electrical, HVAC). It uses the same `openNewBid` handler and styling as before. The duplicate New Bid button was removed from the Bid Board tab toolbar. On Builder Review tab, the button is grayed out (inherits parent opacity and pointer-events).

---

## Latest Updates (v2.94)

**Date**: 2026-03-10

### Bids – Bid Board

- **Counts column**: New column with hexagon icon between Last Contact and Edit. Clicking the icon opens that bid in the Counts tab (same as `selectBidAndSyncUrl(bid, 'counts')`). Tooltip: "Open in Counts".

### Bids – Cover Letter Tab

- **Additional Inclusions default in combined document**: When the user has not modified the Additional Inclusions field, the default "Permits" now appears in both the textarea and the Combined document (copy to send). Previously, "Permits" showed in the textarea but only appeared in the combined document after the user edited the field. Fix: use `DEFAULT_INCLUSIONS` as fallback for `inclusions` when building the combined document and PDF/print output, matching the textarea display.
- **Apply Proposed amount / Apply custom amount hidden when synced**: When `bid.bid_value` already matches the effective amount (proposed from Pricing or custom amount when "Use custom amount in document" is checked), both "Apply Proposed amount to Bid Value" and "Apply custom amount to Bid Value" buttons are hidden. The "✓ Applied successfully" toast is also hidden in that state. Buttons reappear when the proposed or custom amount changes and no longer matches the stored bid value.

---

## Latest Updates (v2.86)

**Date**: 2026-03-09

### People – Review Tab

- **Profit Before Overhead**: Renamed "Total Revenue Before Overhead" to "Profit Before Overhead".
- **Users Contribution to Profit**: Renamed "Users Contribution to Revenue" to "Users Contribution to Profit".
- **Users Profit this Day**: Renamed "Users Revenue this Day" to "Users Profit this Day".
- **Formula B for Profit**: Profit Before Overhead now uses `valueCreated - partsCost - totalJobLabor` (direct formula) instead of the proportional scaling formula.
- **Sub labor in crew-only jobs**: Fixed allocationJobsMap crew-only branch to include sub labor (`laborCostByHcp`) so Profit Before Overhead correctly subtracts Parts and Subs for all jobs.
- **Team Labor excludes Subs**: "Total Labor on Job" now shows team labor only (`otherTeammatesLabor + userTotalLaborOnJob`). Subs remain displayed separately under "Subs:" and are still subtracted in the Profit formula.

### Jobs – Job Summary Tab

- **Parts Cost from Total Parts Cost**: Job Summary Parts Cost now matches Total Parts Cost in Jobs Parts tab: Parts from Tally (including `fixture_cost` for fixture-only parts) + Invoices from Supply Houses.

### People – Review Tab (Parts Cost)

- **Parts Cost from Total Parts Cost**: People Review job dropdown "Parts:" now matches Total Parts Cost: Parts from Tally + Invoices from Supply Houses. Uses `get_invoice_amounts_for_jobs` RPC and `fixture_cost` for `part_id == null` tally parts.

### People – Team Costs Tab

- **Crew Jobs Hours column**: Added "Hours" column between Name and Crew in the Crew Jobs table. Shows each person's reported hours from `people_hours` for the selected date. Displays "—" when no hours are logged for that date.

---

## Latest Updates (v2.87)

**Date**: 2026-03-09

### Timezone Fix Across App

- **Local date formatting**: Replaced `toISOString().slice(0, 10)` with `toLocaleDateString('en-CA')` for user-facing dates across the app. Fixes timezone bugs where late-evening users (e.g. CST) saw wrong dates (e.g. Crew Jobs showing today instead of yesterday).
- **Files updated**: People.tsx, Jobs.tsx, Checklist.tsx, Prospects.tsx, Materials.tsx, Bids.tsx, SupplyHousesSection, ChecklistItemEditModal, HoursUnassignedModal, HoursSection, useCostMatrixTotal, CrewJobsSection. Settings backup filenames remain UTC.

### People Page

- **Mobile tabs**: Tabs now scroll horizontally on narrow screens (overflowX: auto, WebkitOverflowScrolling: touch). Matches Jobs page pattern.
- **Team Costs – Crew Jobs**: Removed thin grey border between header and content.

### Jobs Page

- **Search bars**: Added search to Team Labor, Sub Labor, and Jobs Summary tabs. Filter by HCP, job name, address (and contractor for Sub Labor).
- **Team Labor**: Removed "Combined Job Labor" title; search bar full width.
- **Job Summary**: Search bar full width.

### People – Review Tab

- **Last Month = last 30 days**: "Last Month" period now uses a rolling 30-day window (today minus 30 days through today) instead of the previous calendar month.

---

## Latest Updates (v2.93)

**Date**: 2026-04-10

### Bids – Primaries Full Access

- **Primaries unrestricted on Bids**: Primaries now have the same access as estimators on the Bids system. They can see all bids, create/edit/delete bids, and access all tabs: Bid Board, Builder Review, Counts, Takeoff, Cost Estimate, Pricing, Cover Letter, Submission, RFI, Change Order, Lien Release.
- **Migration**: `20260410130000_primaries_full_bids_access.sql` updates RLS policies on bids, bids_gc_builders, bids_count_rows, bids_submission_entries, cost_estimates, cost_estimate_labor_rows, bids_takeoff_template_mappings, bid_pricing_assignments, bid_count_row_custom_prices, customers; adds primary to all bid-related policies; updates `can_access_bid_for_pricing` helper; primaries see all customers (for New Bid GC picker).
- **UI**: Removed primary tab redirect, tab button restrictions, and Edit column hiding. Primaries now see Checklist, New Bid, and Edit on Bid Board; Builder Review data loads for primaries.

---

## Latest Updates (v2.92)

**Date**: 2026-04-10

### Bids – Counts Tab

- **Group/Tag column**: New column between Fixture or Tie-in and Plan Page. User can enter optional group or tag (e.g., area label) per count row. Migration `20260410120000_add_group_tag_to_bids_count_rows.sql` adds `group_tag` to `bids_count_rows`. Import supports 4-column format: Fixture, Count, Group/Tag, Plan Page (3-column format remains backward compatible).

---

## Latest Updates (v2.91)

**Date**: 2026-03-10

### Bids – Counts Tab

- **Count row move**: ▲▼ swap the clicked row with its neighbor (above/below). Migration `20250310120000_normalize_bids_count_rows_sequence_order.sql` normalizes `sequence_order`; index-based move with functional state updater; buttons disabled during persist; skip count refetch to avoid overwrite. Tooltips: "Swap with row above/below".

### Crew Jobs Shared Component

- **CrewJobsBlock**: Extracted Crew Jobs (editing table + Team Job Labor display) into a shared `CrewJobsBlock` component. Used in Quickfill and Jobs (Team Labor tab).
- **teamLabor.ts**: Added `src/utils/teamLabor.ts` with `loadTeamLaborData()` for reusable team labor aggregation.
- **Quickfill**: `CrewJobsSection` is now a thin wrapper around `CrewJobsBlock`.
- **People Team Costs tab** (removed): Previously used `CrewJobsBlock`; functionality moved to Jobs Team Labor tab and Quickfill Crew Jobs. Kept `crewJobsByDatePerson` and `loadCrewJobsRef` in People for Hours tab.
- **Jobs → Team Labor**: Replaced custom expandable table with `CrewJobsBlock`; uses `jobIdsFilter` to show only ledger jobs. Removed `teamLaborSearch`, `expandedCombinedLaborJobId`, `combinedLaborRows`.

---

## Latest Updates (v2.90)

**Date**: 2026-03-10

### Jobs – Sub Sheet Ledger / New Job Labor Modal

- **Labor rate per row**: Moved Labor rate ($/hr) from the top flex row into the Specific Work (Line Items) table. Each line item now has its own Rate ($/hr) input and Cost column (hours × rate). New rows prefill with the app default labor rate when available.
- **Migration**: `20260310180000_add_labor_rate_to_people_labor_job_items.sql` adds `labor_rate` to `people_labor_job_items` and backfills from `people_labor_jobs`. Job-level `labor_rate` remains for Sub Labor table display and is set from the first row when saving.
- **Rate ($/hr) empty when 0**: When rate is 0, the field shows empty (placeholder "0") so the user can type immediately without clearing.
- **Add Subcontractor button**: Moved to the left of the External Subs list; same height as the list.
- **Field layout**: Date of Labor and Service type moved after Distance (mi) in the top row.
- **Service type dropdown**: Width of longest option, height matches Date of Labor.
- **Top-row input heights**: HCP, Address, Distance (mi), Date of Labor, and Service type all use height 38px.
- **Date of Labor input**: Sized to fit date text (11ch width).
- **Default Rate ($/hr) $20**: New rows default to $20 when no app default is set.

---

## Latest Updates (v2.89)

**Date**: 2026-03-10

### Jobs – Team Labor Tab

- **Expandable rows**: Click a job row to expand and see per-person breakdown: Person | Crew Job Costs | Crew Man Hours. Consolidates data from People Team Costs for eventual deprecation.
- **Hidden from assistants**: Team Labor tab is not visible to assistants; direct URL redirects to Stages.

### Jobs – Job Summary Tab

- **Team Labor column fix**: Team Labor data now loads when Job Summary tab is active. Previously, the column showed "—" until the user had visited Team Labor or another tab that triggered the load.

### Prospects – Team Tab

- **Assistants can access**: Team tab is now visible to dev and assistant roles (was dev-only). Shows last 30 days of prospect activity: User | Cards Marked | Cards Updated.
- **Migration**: `20260310120000_assistants_see_prospect_timer_events.sql` adds RLS policy for assistants to SELECT all `prospect_timer_events`.

---

## Latest Updates (v2.88)

**Date**: 2026-03-10

### People – Review Tab

- **Total Labor double-count fix**: For Sub Labor jobs, "Total Labor on Job" no longer double-counts the user's crew labor. `otherTeammatesLabor` now excludes the current person's crew labor via `personCrewLaborByJobId`.
- **Labor display reorganization**: "Total Labor on Job" now shows `otherTeammatesLabor` (team crew labor); "Rest of Teams Labor" (renamed from "Teams Labor") shows Total minus User; summary totals use the new Total Labor $ per job.
- **Sub Labor source label**: Jobs from the Sub Labor tab (Jobs page) now display "Sub Labor" in the Source column instead of "Labor".
- **Rest of Teams Labor**: Renamed "Teams Labor" to "Rest of Teams Labor" in expanded job details.
- **User on Job Rev/hr and Profit/hr**: Renamed "Rev/hr" and "Profit/hr" to "User on Job Rev/hr" and "User on Job Profit/hr" in the Jobs Worked table and expanded details to clarify these are per-person, per-job metrics.

---

## Latest Updates (v2.85)

**Date**: 2026-04-09

### People – Review Tab

- **Team Summary restored**: Team Summary button opens a new window with per-person metrics (Name, Period Profit, Rev/MH, Profit/MH) for the selected period.
- **Only Count Jobs Marked Paid in Full**: Checkbox next to Team Summary. When checked, revenue and profit include only jobs with `jobs_ledger.status = 'paid'`; labor hours and cost are also excluded from non-paid jobs. Rev/MH and Profit/MH use hours-from-paid-jobs only.
- **Paid-only RPCs**: `get_jobs_ledger_by_ids_paid_only` and `get_jobs_ledger_by_hcp_numbers_paid_only` filter jobs by status; labor jobs and crew jobs are filtered to paid-only when the checkbox is enabled.
- **Migration**: `20260409120000_add_get_jobs_ledger_paid_only_rpcs.sql`

---

## Latest Updates (v2.84)

**Date**: 2026-04-08

### People – Review Tab

- **Team Summary modal removed**: The Team Summary button and modal (company-wide Profit, Revenue per Man Hour, Profit per Man Hour for the period) have been removed from the Review tab.
- **Profit for this period**: Added "Profit for this period" above Revenue per Man Hour and Profit per Man Hour in the per-person Review metrics box.

### Jobs – Tab Order

- **Team Labor before Sub Labor**: The Team Labor and Sub Labor tabs have been flipped; Team Labor now appears before Sub Labor in the tab bar.

### Database – SECURITY DEFINER RPC Hardening

- **New RPCs**: `get_jobs_ledger_office()` (Office job lookup), `get_projects_by_ids(p_ids)` (project details by ID), `get_jobs_ledger_by_status(p_status)` (jobs by status).
- **Replaced direct table access**: People pay stubs, HoursUnassignedModal, AddInspectionModal, NewReportModal, Dashboard, BilledAwaitingPaymentSection now use SECURITY DEFINER RPCs instead of direct `jobs_ledger`/`projects` reads where RLS could block display.
- **Projects search enrichment**: AddInspectionModal and NewReportModal no longer fetch projects for address enrichment; `search_jobs_for_reports` already returns address.
- **Migrations**: `20260408160000_create_get_jobs_ledger_office.sql`, `20260408170000_create_get_projects_by_ids.sql`, `20260408180000_create_get_jobs_ledger_by_status.sql`
- **Types**: `src/types/database.ts` updated with new RPC function signatures.

---

## Latest Updates (v2.83)

**Date**: 2026-03-07

### Development Tools – Sync to Testing Script

- **Sync to Testing.command**: Double-clickable macOS script at project root that clears `testing-pipetooling.github.io` and copies the full contents of `pipetooling.github.io` into it (including hidden files like `.git`).
- **Location**: `Sync to Testing.command` (in the pipetooling root folder, alongside `pipetooling.github.io` and `testing-pipetooling.github.io`).
- **Usage**: Double-click in Finder; Terminal opens, runs the sync, and waits for Enter before closing.
- **Use case**: Quickly refresh the testing site with a copy of production before deploying or testing changes.

### Settings – Archive and Restore User Flow

- **Archive instead of delete**: Replaced permanent user deletion with archive (soft delete). Archived users are hidden across the app and cannot sign in, but can be restored later.
- **Archive user**: Button and modal (email + name confirmation) now call `archive-user` edge function. Sets `archived_at` in `public.users` and `banned_until` in `auth.users`.
- **Archive User & Reassign Customers**: Same flow as before; reassigns customers to another master before archiving.
- **Archived users section**: Collapsible "Archived users (N)" table below Active Accounts. Shows email, name, role, archived date, and Restore button.
- **Restore**: `restore-user` edge function clears `archived_at` and `banned_until`; user reappears in Active Accounts and can sign in again.
- **RLS**: Non-devs see only active users (`archived_at IS NULL`); devs see all including archived.
- **Migrations**: `20260307000000_add_users_archived_at.sql`, `20260307000001_users_rls_exclude_archived.sql`
- **Edge functions**: `archive-user`, `restore-user` (replaces `delete-user`)

---

## Latest Updates (v2.82)

**Date**: 2026-03-07

### People – Person/User Duplicate Merge

- **Merge process**: When a roster person and a user share the same email (e.g., person "Jesse" and user "Jesse (Assistant)"), both can appear in the Hours tab. New merge process consolidates them into a single canonical identity (the user).
- **Detection**: On Pay tab load, detects duplicates (person_name in pay_config where person's email matches a user and names differ).
- **Merge UI**: Yellow notice above "People pay config" lists duplicates with "Merge" button. Click to consolidate person's pay config into user's, delete person's row, and cascade name change across pay tables.
- **Proactive merge on invite**: When inviting a person as user, automatically merges if a duplicate exists (e.g., user was created with different name).
- **Cascade extended**: `cascadePersonNameInPayTables` now includes `pay_stubs` and `pay_stub_days` so pay stub history stays consistent after merges.
- **Files**: `src/lib/mergePersonUserDuplicates.ts` (find + merge), `src/lib/cascadePersonName.ts` (pay_stubs, pay_stub_days), `src/pages/People.tsx` (detection, UI, invite hook).

---

## Latest Updates (v2.81)

**Date**: 2026-03-26

### Bids – Counts Tab

- **Import from /Tooling**: New button at top of Counts tab (next to Edit Bid). Reads from clipboard and imports tab-delimited rows (Fixture, Count, Plan Page). Copy from /Tooling app using "Copy to /Tooling" export, then click to auto-add rows. Format: `WC\t4\t1`, `ft of 4in PVC\t28.29\t1`, etc.

### Bids – Pricing Tab

- **partial-fill button**: In Price book entry column header. Click to pre-fill each row's search with the first 3 letters of its Fixture or Tie-in. Speeds up assigning price book entries.
- **Performance**: Parallelized fetches, deduplicated expandTemplate calls, progressive loading for per-fixture materials. Pricing tab loads faster, especially for bids with many takeoff mappings.

### Jobs – Inspections Tab

- **Inspections tab**: New tab (right of Job Summary) with Quick Links to permit portals, Inspection Schedule (calendar + Upcoming), Add Inspection modal.
- **Edit Inspection Types**: Button to manage inspection types (Plumbing Rough-In, Gas Final, etc.) in a lookup table.
- **Edit Quick Inspection Links**: Button to manage Quick Links (City of New Braunfels, Alamo Heights, etc.) in a lookup table.
- **Upcoming**: Shows date, days until, day of week (e.g. `2026-03-09 (3) Monday`). Layout: type + address on separate lines; map icon next to address opens Google Maps.
- **Dashboard**: "Upcoming inspection (3 days)" for assistants; Inspections button in Dashboard quick buttons (Settings).

### Reports – New Report

- **Address in search**: Job search shows `Suzy Wilson (HCP: 612) - 8201 Wilke Rd. Kingsbury Tx 78638`. Selected job: name on first line, address on second line.
- **Search placeholder**: "Search by HCP #, project name, or address" (all job searches).

### Add Inspection Modal

- **Address in search**: Same as New Report; job search results include address.

### RLS Fixes

- **cost_estimate_labor_rows**: Fix 500 for assistants on Bids Pricing; use `is_bid_pricing_user()` SECURITY DEFINER helper. Migration: `20260326000000_fix_cost_estimate_labor_rows_rls_assistants.sql`.
- **Estimators insert reports**: Use `is_estimator()` helper to avoid RLS recursion. Migration: `20260318000000_estimators_insert_reports_use_helper.sql`.

---

## Latest Updates (v2.80)

**Date**: 2026-03-03

### Prospects – Address Field

- **Address**: New field for all prospects. Shown in New Prospect modal, Edit modal, Prospect List (desktop table and mobile cards), Follow Up info block (below Links to Website), Convert tab summary, and Cant Reach section.
- **Convert**: When converting a prospect to a customer, address pre-fills the customer form.
- **Migration**: `20260309000000_add_address_to_prospects.sql`

### Prospects – Quick Notes (Follow Up)

- **Quick note buttons**: Below the comments textarea, above saved comments. Per-user buttons (e.g. "left voicemail") that each user can add and delete.
- **Behavior**: Clicking a quick note fills the comments box; user can then click Didn't Answer or Answered to add with that tag (or press Enter for plain comment).
- **+ Add**: Prompts for label; inserts into `user_prospect_quick_notes`. × removes a quick note.
- **Migration**: `20260310000001_create_user_prospect_quick_notes.sql`

---

## Latest Updates (v2.79)

**Date**: 2026-03-11

### Quickfill – Section Navigation and Feedback Loop

- **Section nav buttons**: Row of buttons below the title (Hours, Billing Awaiting Payments, Unpriced Fixtures, Crew Jobs / Bids, Unreachable Prospects, Supply Houses, Jobs Billing). Click to scroll to section. Each button shows "Last marked: X" and "by [user]" below.
- **Mark up to date**: Below each section, a "Mark [section] up to date!" button. When clicked: section collapses for 12 hours, nav button turns green. Button hidden when section is collapsed; re-marking collapses the section.
- **Color states**: Nav buttons green (marked within 12h), yellow (12–30h), red (>30h or never).
- **Open now**: Collapsed sections show "Open now" button to expand immediately. Collapsed message: "Marked up to date at X by [user]. Expands automatically in Yh."
- **Section order**: Hours first; then Billing Awaiting Payments, Unpriced Fixtures, Crew Jobs / Bids, Unreachable Prospects, Supply Houses, Jobs Billing last.
- **Unpriced Fixtures**: Nav button and section hidden when no unpriced fixtures.

### Quickfill – Label and Layout Updates

- **Billed Awaiting** → **Billing Awaiting Payments**
- **Can't Reach** → **Unreachable Prospects** (expanded by default).
- **Supply Houses** — Quickfill section title (Materials **Supply Houses** tab content via **`SupplyHousesSection`**)
- **Unreachable Prospects** moved after Crew Jobs / Bids.
- **Team Job Labor** (in Crew Jobs / Bids): Collapsible, collapsed by default.

### Quickfill – Database

- **quickfill_section_marks** table: `section_id`, `marked_at`, `marked_by`. RLS: dev, master_technician, assistant can SELECT and UPSERT.
- **useUnpricedFixturesCount** hook: Fetches unpriced fixtures count for conditional Unpriced Fixtures visibility.

### Prospects – Team Tab (Dev and Assistant)

- **Team tab**: Shows last 30 days of prospect activity on one scrollable page. Each day: User | Cards Marked | Cards Updated. Rows with 0/0 hidden; days with no activity hidden. Visible to dev and assistant (v2.89).
- **Migrations**: `prospect_devs_see_timer_events` allows devs to SELECT all `prospect_timer_events`; `20260310120000_assistants_see_prospect_timer_events` extends access to assistants.

### Prospects – Other Updates

- **Search bar**: Full width in Prospect List.
- **Last updated by**: Between Last Contact and Last Successful Contact, shows "Last updated by: [user]" (from most recent comment).
- **Can't reach expanded**: In Prospect List, "Can't reach (N)" section expanded by default.

**Files**: `src/pages/Quickfill.tsx`, `src/components/quickfill/CrewJobsSection.tsx`, `src/components/quickfill/CantReachSection.tsx`, `src/hooks/useUnpricedFixturesCount.ts`, `src/pages/Prospects.tsx`, `supabase/migrations/20260311000010_quickfill_section_marks.sql`, `src/types/database.ts`

---

## Latest Updates (v2.78)

**Date**: 2026-02-11

### AR Removed, Billed Awaiting Payment

- **AR tab removed from Jobs**: The Receivables tab has been removed from the Jobs page. Old URLs (`/jobs?tab=receivables`) redirect to Reports.
- **AR pin removed**: The "Pin AR to Dashboard" section has been removed from Settings. Existing AR pins were cleaned up via migration.
- **ReceivablesSection removed from Quickfill**: The AR total and Payer table have been removed from the Quickfill page.
- **Billed renamed to Billed Awaiting Payment**: In Jobs Stages, the "Billed" stage is now labeled "Billed Awaiting Payment". Dashboard pin and Settings pin use the same label.
- **Billed Dashboard pin**: Devs can pin "Billed Awaiting Payment" to masters/devs dashboards (Settings → Pin Billed to Dashboard). Pin shows live count and total, e.g. "Billed Awaiting Payment (22) - $52,326.13". Loading state shows "Billed Awaiting Payment…" to avoid flash of stale label.

### Quickfill – Billed Awaiting Payment Section

- **New section**: Quickfill now includes a "Billed Awaiting Payment" summary section (below Jobs Billing Reminder). Shows header with count and total, table with HCP, Job, Assigned, Remaining columns, and "View in Jobs Stages" link. Visible to dev, master_technician, assistant.

### Jobs Stages – Total by Name Modal

- **Total by Name button**: Next to the Billed Awaiting Payment header, a "Total by Name" button opens a modal with a breakdown of job names and their remaining totals (sorted by total descending).
- **Dashboard integration**: Clicking the Billed Awaiting Payment pin on the Dashboard navigates to Jobs Stages and opens the Total by Name modal automatically.
- **take me to Job: Stages: Billed**: In the modal footer (bottom left), a link closes the modal, expands the Billed section if collapsed, and scrolls to the Billed Awaiting Payment section on the Jobs Stages page.

**Files**: `src/pages/Jobs.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Quickfill.tsx`, `src/components/quickfill/BilledAwaitingPaymentSection.tsx`, `src/hooks/useBilledTotal.ts`, `src/lib/pinnedTabs.ts`, `src/pages/Settings.tsx`, `supabase/migrations/20260305120000_remove_ar_pins.sql`

---

## Latest Updates (v2.77)

**Date**: 2026-03-02

### Settings – Data Backup and Maintenance

- **Data backup (dev) moved to top**: The Data backup section (export projects, materials, bids) is now at the very top of the Settings page, directly below the header.
- **Maintenance: Materials prices minimizable**: The "Maintenance: Materials prices" subsection (Review orphaned material prices) is now collapsible. Click the header to expand/collapse. Minimized by default.

### Settings – Fixture Types

- **Fixture type badges**: The fixture type list now shows only the three book systems: **takeoff**, **labor**, and **price** (removed "counts"). Order: takeoff, labor, price. Takeoff badge uses purple styling; labor and price retain blue and green.

### Bids Counts – Import

- **Import button**: Next to "Add row" in the Counts tab, an **Import** button opens a modal. Paste tab- or comma-separated text (Fixture, Count, Plan Page per line) to bulk-import count rows.
- **Format**: One line per row. Columns: Fixture or Tie-in (required), Count (required), Plan Page (optional). Use tab or comma as delimiter. Supports paste from Excel.
- **Example**: `Toilet	5	A-101` or `Lavatory Sink,3,`
- **Success**: Toast shows "Imported X rows" (and "Y lines skipped" if any), modal closes, count list refreshes.

---

## Latest Updates (v2.76)

**Date**: 2026-02-27

### Prospects – Copy Templates, Mail Icon, Subject Line, Email Sent Tracking

- **Copy section** (Follow Up, below Add Notes): Three template buttons—No Response Email, Phone call Follow up Email, Just checking in Email. Each has: copy button (copies substituted text to clipboard), mail icon (opens default mail client with prospect email, subject, and body), edit icon (opens modal to edit body and subject).
- **Placeholders**: User placeholders `[User name]`, `[user email]`, `[user phone number]`, `[company name]`; prospect placeholders `[prospect phone number]`, `[prospect contact name]`, `[prospect last contact]`, `[prospect last successful contact]`; `_______` for Phone call (contact name) and Just checking in (contact info). Clickable chips in edit modal insert placeholders at cursor.
- **Subject line**: Edit modal includes Subject field; subject supports same placeholders as body. Stored per-user in `user_prospect_copy_templates.subject_text`; dev defaults in `app_settings` (e.g. `prospect_copy_no_response_email_subject`).
- **Blank-fields modal**: When copying or opening mail, if any placeholder used in the template has blank data (e.g. prospect email, user phone), a modal lists missing fields and blocks the action until dismissed.
- **Email sent tracking**: Mail icon (envelope SVG) opens `mailto:`; after click, icon changes to envelope-check (green) for that template+prospect. State persisted in `prospect_email_sent` table.
- **Dev defaults**: Settings → Prospect copy templates (dev) — devs can edit default body and subject for all three templates.

### Settings – My Profile

- **My Profile section** (all users): Form to edit own name, email, and phone. Stored in `users` table. Phone is used for `[user phone number]` in prospect copy templates.
- **Database**: `users.phone` column; RLS policy allows users to update own row.

### Prospects – UI Updates

- **Field order**: Last Contact and Last Successful Contact moved below Company Name, above Contact Name; labels no longer bolded.
- **Checkbox label**: "Automatically move to the next prospect when I click Didn't Answer" (clearer than previous text).
- **Icons**: Mail and edit buttons use Font Awesome SVG icons (envelope, envelope-check, pen-to-square).

**Files**: `src/pages/Prospects.tsx`, `src/pages/Settings.tsx`, `supabase/migrations/20260304000000_prospect_copy_templates.sql`, `20260305000000_add_users_phone.sql`, `20260306000000_prospect_copy_subject.sql`, `20260307000002_prospect_email_sent.sql`

---

## Latest Updates (v2.75)

**Date**: 2026-03-26

### Jobs – Default Tab and Tab Labels

- **Stages default**: When a user clicks Jobs, the Stages tab now opens by default (previously Billing).
- **Team Labor**: The "Labor" tab (combined-labor) is renamed to "Team Labor".
- **Sub Labor**: The "SubLabor" tab is renamed to "Sub Labor" (with space); same label in empty-state message and Team Labor table header.

**Files**: `src/pages/Jobs.tsx`

### Prospects – Option D (Hybrid): Calling Locks and Due-for-Follow-up

- **Calling lock**: When a user views a prospect in Follow Up, a row is inserted into `prospect_calling_locks` so others cannot work it. Lock is released when user clicks Next Prospect, Cant reach, or No longer fit (or when switching away).
- **Exclude locked**: `loadFollowUpProspects` excludes prospects locked by other users.
- **Sort**: Prospects sorted by `last_contact ASC NULLS FIRST` (oldest first) so overdue prospects appear first.
- **"Due X days" badge**: Amber pill badge shown near Last Contact when `last_contact` is null or more than 7 days ago.
- **handleSendBack**: Sort updated to oldest-first to match new order.

**Database**: New table `prospect_calling_locks` (prospect_id, user_id, locked_at); RLS for SELECT (all), INSERT/UPDATE/DELETE (own).

**Files**: `src/pages/Prospects.tsx`, `supabase/migrations/20260303000001_prospect_calling_locks.sql`

---

## Latest Updates (v2.74)

**Date**: 2026-02-27

### Jobs – Stages Tab Updates

- **Ready to Bill label**: Button and modal changed from "Ready for Billing" to "Ready to Bill" in Working stage.
- **Create Partial Invoice modal**: Green document icon button (to the left of Edit) in Working and Ready to Bill job rows. Opens standalone modal to create a partial invoice without opening Edit Job. Icon disabled when remaining amount is zero.
- **Open X hours centered**: "Open 4 hours" (and similar) centered in Actions column for Working, Ready to Bill, and Billed.
- **Paid in Full**: Total amount hidden; stage title shows count only, e.g. `Paid in Full (5)`.

**Files**: `src/pages/Jobs.tsx`

---

## Latest Updates (v2.73)

**Date**: 2026-03-26

### Jobs & Dashboard – Checkbox Confirmation Modals Restored

- **Ready to Bill**: Modal with checkboxes "I have reported all the Job Parts I've used" and "The customer knows the work is done and is satisfied" before moving job to Ready to Bill.
- **Mark as Billed**: Modal with checkbox "Invoice has been sent to the customer" (jobs and invoices).
- **Mark Paid**: Modal with checkbox "Payment has been received and recorded" (jobs and invoices).
- **Send back**: Modal with checkbox "I am going to call the Subcontractor and explain why" (jobs and invoices).
- **Ham mode** (Jobs page): When Ham mode is ON, modals are skipped and actions call APIs directly.
- **Dashboard**: No Ham mode; modals always show for Ready to Bill, Billed, and Paid actions.

### Jobs – Stages Tab: Unified Table & Layout

- **Unified table**: Ready to Bill and Billed now show jobs and invoices in a **single table** instead of two tables. Jobs use blue action buttons; invoices use green buttons for visual distinction.
- **Layout**: Mark Paid button moved to the left (reduced row height); Send back moved below Remaining amount; "Open X days" and "X reports" centered.

### Jobs & Dashboard – Invoice Button Styling

- **Invoice buttons**: "Mark as Billed" and "Mark Paid" for invoice rows use green background (`#16a34a`) instead of blue (`#3b82f6`) to distinguish from job buttons.

### Build Fix

- **Database types**: Added `cost_matrix_tag_colors` to `src/types/database.ts` (table existed in migration but was missing from generated types; fixes People.tsx build error).

**Files**: `src/pages/Jobs.tsx`, `src/pages/Dashboard.tsx`, `src/types/database.ts`

---

## Latest Updates (v2.72)

**Date**: 2026-03-03

### Jobs – Whole Jobs Through Stages (Alongside Partial Invoices)

- **Working**: Added "Ready for Billing" button to move jobs to Ready to Bill
- **Ready to Bill**: Now shows both **jobs** (status=ready_to_bill) and **invoices**; jobs have Mark as Billed, Send back (to working)
- **Billed**: Now shows both **jobs** and **invoices**; jobs have Mark Paid (via `mark_job_paid` RPC), Send back (to ready_to_bill)
- **Database**: New RPC `mark_job_paid(p_job_id)` adds remaining amount to payments when marking whole job paid
- **Dashboard**: Ready to Bill and Waiting for Payment now include job cards (in addition to invoice cards); same actions

**Files**: `src/pages/Jobs.tsx`, `src/pages/Dashboard.tsx`, `supabase/migrations/20260303000000_add_mark_job_paid.sql`

---

## Latest Updates (v2.71)

**Date**: 2026-03-02

### Jobs – Partial Invoices (Option A)

- **Edit Job modal**: New **Create partial invoice** section (after Remaining, before Save): amount input (validated ≤ Remaining), Create invoice button. Lists open invoices (ready_to_bill, billed) with "View in Stages".
- **Database**: `jobs_ledger_invoices` table (job_id, amount, status: ready_to_bill | billed | paid); RPC `mark_invoice_paid(p_invoice_id)` inserts payment, updates payments_made, marks invoice paid.
- **Stages tab**: **Working** unchanged (jobs). **Ready to Bill** and **Billed** now show **invoices** (not jobs): each row shows job info + invoice amount; Mark as Billed, Mark Paid, Send back. **Paid in Full** unchanged (jobs where payments_made ≥ revenue). Removed "Ready for Billing" from Working; invoices created from Edit Job only.
- **Dashboard**: Ready to Bill and Waiting for Payment sections now display **invoice rows** (job name, HCP, address, invoice amount); Mark as Billed, Mark Paid, Send back use invoice actions.

**Files**: `src/pages/Jobs.tsx`, `src/pages/Dashboard.tsx`, `supabase/migrations/20260302000000_create_jobs_ledger_invoices.sql`

---

## Latest Updates (v2.70)

**Date**: 2026-03-01

### Jobs – Payments Made, Remaining, Stages enhancements

- **New Job / Edit Job modals**: Below Total Bill ($), added **Payments Made ($)** as a table of multiple payment rows (Add Payment, Remove per row). **Remaining ($)** displays Total Bill minus sum of payments. Mirrors Other job charges pattern.
- **Database**: `jobs_ledger_payments` table (job_id, amount, sequence_order); `jobs_ledger.payments_made` kept in sync (sum) for Stages/Dashboard. Existing payments_made values migrated to jobs_ledger_payments.
- **Stages tab**: Working, Ready to Bill, Billed show **Remaining** (revenue - payments_made) instead of Revenue. **Paid in Full** (renamed from Paid) shows **Final Bill** (revenue). Stage titles include total amount, e.g. `Billed (5) - $3,250.00`.
- **Dashboard**: Ready to Bill and Waiting for Payment sections show Remaining instead of Revenue.

**Files**: `src/pages/Jobs.tsx`, `src/pages/Dashboard.tsx`, `supabase/migrations/20260226220000_add_payments_made_to_jobs_ledger.sql`, `supabase/migrations/20260301000000_create_jobs_ledger_payments.sql`

---

## Latest Updates (v2.69)

**Date**: 2026-02-26

### Prospects – Timer enhancements and time tracking

- **Follow Up timers**: Added "this time" (session timer) and "all time" (ledger + session) labels above the two timers. Session timer resets when switching prospects via No Longer a Fit, Can't reach, or Next Prospect.
- **my day**: New display to the right of "all time" showing total time prospecting today (persisted events + current session). Loaded when entering Follow Up tab; refreshed after saving timer events.
- **my time modal**: "my time" link at bottom-right of Follow Up opens a modal with: Today, Yesterday, Last 7 days, Lifetime. Includes current session in Today/Last 7/Lifetime when on Follow Up. Zero values show "—" instead of "00:00".
- **Prospect List Time column**: Added Time column (to the left of Email/Links) showing total time spent per prospect. Desktop table and mobile cards. Zero shows "—".
- **UI changes**: Set Callback Date & Time button is green; Can't reach moved left of Next Prospect; "my time" link aligned right.
- **Removed debug instrumentation**: Removed leftover fetch calls to local ingest server in Bids.tsx and Jobs.tsx (was causing ERR_BLOCKED_BY_CLIENT).
- **Meta tag**: Replaced deprecated `apple-mobile-web-app-capable` with `mobile-web-app-capable` in index.html.

**Database**: `prospect_timer_events` table (user_id, prospect_id, timer_seconds, button_name, created_at) – see migration 20260231000025.

**Files**: `src/pages/Prospects.tsx`, `src/pages/Bids.tsx`, `src/pages/Jobs.tsx`, `index.html`

---

## Latest Updates (v2.68)

**Date**: 2026-02-26

### Primary role – Bids and Projects access

- **Bids**: Primaries can now access RFI, Change Order, and Lien Release tabs in addition to Bid Board. They can view bids (from adopted masters) and generate RFI, Change Order, and Lien Release documents. Other Bids tabs (Builder Review, Counts, Takeoff, Cost Estimate, Pricing, Cover Letter, Submission) remain restricted.
- **Projects**: Projects tab and navigation link hidden from primaries. Primaries are redirected to `/dashboard` if they navigate to `/projects`.

**Files**: `src/pages/Bids.tsx`, `src/components/Layout.tsx`, `src/pages/Dashboard.tsx`, `src/lib/pinnedTabs.ts`

---

## Latest Updates (v2.67)

**Date**: 2026-02-26

### People – Team Costs tab

- **New tab**: Team Costs (same visibility as Pay: canAccessPay or canViewCostMatrixShared)
- **Crew Jobs / Bids table**: Per-day assignment of crew leads and job/bid percentages. Date picker (calendar input) + prev/next day buttons. Columns: Name (from cost matrix), Crew (dropdown to set crew lead; crew members inherit lead's job/bid breakdown), Jobs/Bids (add multiple jobs or bids with %; auto-split 100%; editable percentages).
- **Team Job Labor table**: All-time aggregate of jobs from Crew Jobs / Bids. Columns: HCP, Job name + address, People on job, Man hours (clickable → breakdown modal), Job cost (clickable → breakdown modal). Searchable by HCP, job name, address.
- **Database**: `people_crew_jobs` table; `search_jobs_ledger(search_text)` RPC. Cascade person name updates to people_crew_jobs. Crew jobs are auto-created/updated when clock sessions with `job_ledger_id` are approved (see v2.118).

**Files**: `src/pages/People.tsx`, `src/lib/cascadePersonName.ts`, `supabase/migrations/20260231000020_create_people_crew_jobs.sql`, `supabase/migrations/20260231000021_search_jobs_ledger.sql`

### Job Parts Tally – Fixture Send to Office

- **Send button**: Below "Fixture or tie-in" input: "Fill in parts or send this item to the office for them to price." Clicking send adds fixture-only entry to Parts to save list (green background).
- **Fixture entries**: Stored with part_id NULL; office enters fixture_cost in Jobs Parts tab.
- **Database**: `jobs_tally_parts.part_id` nullable; `fixture_cost` column; `list_tally_parts_with_po` returns fixture_cost, part_id; `create_po_from_job_tally` skips fixture-only entries.

**Files**: `src/pages/JobTally.tsx`, `supabase/migrations/20260231000010_add_fixture_sent_for_pricing.sql`, `supabase/migrations/20260231000011_fixture_cost_list_and_po.sql`

### Jobs – Parts tab: Fixture cost, unpriced highlight

- **Fixture rows**: part_id null rows show "Fixture (sent for pricing)" with editable cost input. Fixture cost included in parts total.
- **Red highlight**: Jobs with unpriced fixtures (part_id null and fixture_cost null/0) have red background (#fef2f2).
- **Show my jobs only**: Checkbox to right of search box (hidden for subcontractors); filters to jobs where user is in jobs_ledger_team_members.

**Files**: `src/pages/Jobs.tsx`

### Quick Fill – Crew Jobs / Bids section

- **CrewJobsSection**: Same as Jobs Team Labor tab. Placed below Hours, above Receivables. Crew Jobs / Bids table (date picker, prev/next, Name, Crew, Jobs/Bids with % and remove). Team Job Labor table (HCP, Job, People, Man hours with clickable breakdown; Job Cost column hidden). Visible to dev, pay-approved masters, assistants, cost-matrix-shared users.

**Files**: `src/components/quickfill/CrewJobsSection.tsx`, `src/pages/Quickfill.tsx`

### Quick Fill – Unpriced fixtures notice

- **UnpricedFixturesSection**: Shows "X jobs with unpriced fixtures" with link to `/jobs?tab=parts`. Visible to dev, master_technician, assistant only.

**Files**: `src/components/quickfill/UnpricedFixturesSection.tsx`, `src/pages/Quickfill.tsx`

### Job Parts Tally (/tally) – Show my jobs only

- **Checkbox**: Below Job/HCP selector: "Show my jobs only" (hidden for subcontractors). Filters job picker to jobs where user is team member.

**Files**: `src/pages/JobTally.tsx`

### Dashboard – Quick task removed

- **Removed**: Send task quick-action block (Task, Assigned To, Remind, Notify, Send) from Dashboard; already available in header for relevant roles.

**Files**: `src/pages/Dashboard.tsx`

---

## Latest Updates (v2.66)

**Date**: 2026-02-26

### Bids – iOS PWA: Open in Safari

- **Open in Google Docs / Drive / Job Plans**: When the app runs as an installed PWA on iOS, these links open in Safari (external browser) instead of the in-app browser. Uses `x-safari-https://` URL scheme. Applies to Cover Letter, RFI, Change Order, Lien Release, Submission links, Dashboard and Jobs Drive/Plans icons.

**Files**: `src/lib/openInExternalBrowser.ts`, `src/pages/Bids.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Jobs.tsx`

### Bids – RFI Tab

- **RFI tab**: Full RFI document generation (mirrors Cover Letter workflow). Search/select bid, fill form, preview combined document. Copy to clipboard or Open in Google Docs (same templates by service type).
- **Read-only from bid**: Bid was submitted date, The bid was submitted to, Company Information (Click Plumbing and Electrical).
- **Editable fields**: Project Lead Contact, Project Lead Contact Phone/Email, Response request date (1 week default), Detailed Description (with checklist), Impact Statement (with checklist).
- **Document format**: Customer/Project blocks, Bid was submitted / The bid was submitted to / Response requested by, Question/Issue, Impact, From block at end.
- **Change Order tab**: Placeholder "Coming soon".

### Bids – Submitted to field

- **New field**: "Submitted to (name, phone, email):" in Edit Bid and New Bid modals, below Bid Date Sent.
- **Database**: Migration `20260231000000_add_bids_submitted_to.sql` adds `submitted_to TEXT` to `bids` table.
- **RFI integration**: RFI "The bid was submitted to" pulls from `bid.submitted_to` (read-only; edit bid to change).

### Bids – RFI placeholders

- Project Lead Contact placeholder: `e.g. yourname@clickplumbing.com`
- Project Lead Contact Phone/Email placeholder: `e.g. 512 360 0599`

### Bids – Lien Release Combined Document

- **Paragraph layout**: Matches Change Order: `margin: 0 0 0.5em 0`, double `<br/>` between Project and Owner, spacer paragraphs between sections.
- **Claimant address**: Street + suite on one line, city/state/zip on next (e.g. `5501 Balcones Dr Ste A141` / `Austin, Texas 78731`). Same line spacing as Invoice block.
- **Pre-fill button**: Next to "Description of Work / Period Covered"; inserts template with formatted bid amount.
- **Bold formatting**: Section labels (Project, Owner, Claimant, Invoice, Lien Status Verification), header lines 1 and 3, conditional waiver phrases, amounts, 45 days, 1.5% per month, lien phone. Texas Property Code line not bolded.
- **Header spacing**: Three header lines use same spacing as Phone/Email.

**Files**: `src/pages/Bids.tsx`, `BIDS_SYSTEM.md`

---

## Latest Updates (v2.65)

**Date**: 2026-02-24

### Job Bill Details modal – Edit actions

- **Edit Job**: Button opens the Edit Job modal on the Jobs page (navigates to `/jobs?edit=jobId`).
- **Edit Job Labor**: Button navigates to Jobs → Sub Sheet Ledger and opens the Edit Job Labor modal for the job’s HCP (or New Job Labor if none exists).
- **Edit Parts**: Button shown only when the job has tally parts; navigates to Jobs → Parts tab, expands the job row, and scrolls it into view. Fixed tab navigation so it stays on Parts instead of defaulting to Stages.

### Jobs – Dashboard, Ready to Bill, Waiting for Payment – Button labels

- Two-line labels: `Mark as Billed` → `Mark as` / `Billed`; `Mark as Paid` → `Mark` / `Paid`; `Send back` → `Send` / `back`; `View Reports` → `View` / `Reports`; `View Details` → `View` / `Details`; `Ready for billing` → `Send to` / `Billing`; `Leave Report` → `Leave` / `Report`.
- **Open X days/hours**: Moved to the right of the main action buttons (Send to Billing, Mark as Billed, Mark as Paid).

### Jobs – Dashboard – Icons and layout

- **Google Drive and Job Plans icons**: Stacked vertically; each icon only shown when the corresponding link field has content.
- **Job Plans**: Link field below Google Drive in New/Edit Job; shown in Dashboard and Jobs when filled.

### Jobs – Edit button icons

- **Billing**: Edit pencil icon visible for all roles (removed primary-only restriction).
- **Stages**: Edit column added to Working, Ready to Bill, Billed, and Paid tables; pencil icon opens Edit Job modal.

### Jobs – Stages default tab

- Stages tab opens by default instead of Reports for non-primary users.

**Files**: `src/components/JobBillDetailsModal.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Jobs.tsx`

---

## Latest Updates (v2.64)

**Date**: 2026-02-24

### Jobs – New Job modal required fields

- Added required-field indicators: helper text "Required: Job Name, Job Address" and red asterisks on Job Name and Job Address labels.

### Prospect List – Links to website

- Made website links clickable; cleaned display by removing `https://`, `http://`, `www.`, and trailing slashes.
- Added `formatWebsiteDisplay()` and `getWebsiteHref()` helpers in Prospects.tsx.

### Cost estimate duplicate key fix

- In Bids.tsx, `ensureCostEstimateForBid()` now handles unique constraint violations (`cost_estimates_bid_id_key`): on duplicate key, loads the existing cost estimate and returns it instead of failing.

### Dashboard – Layout and UX

- **Job Parts Tally**: Replaced text with wrench icon only; added `title="Job Parts Tally"` for accessibility.
- **Job Report**: Placed next to wrench in a flex row; wrench is a 48×48 square on the left; both buttons same height (48px).
- **Recent Reports**: Moved below My Reports; made collapsible (collapsed by default).
- **Pins**: Moved pinned items above the Dashboard buttons.
- **Subscribed stage link**: Added `#step-${sub.step_id}` so the link scrolls to the correct step (fixes crash).

### People – Primaries in list

- Added `'primary'` to the users query in `loadPeople()`.
- Added a "Primaries" section (similar to Devs) between Devs and Assistants.
- Included primaries in `allRosterNames()` for assignment dropdowns.

### Primary user – Send task Notify list

- Migration `20260230000015_primaries_see_adopted_masters.sql`: `master_adopted_current_user()` now checks `master_primaries` (not just `master_assistants`), so primary users (e.g. Trace) can see their adopting master (e.g. Malachi) in the Dashboard Send task Notify list.

### Projects RLS optimization

- Migration `20260230000016_optimize_projects_rls.sql`: Added `can_access_project_row()` and simplified the projects RLS policy to avoid timeouts.

---

## Latest Updates (v2.63)

### Jobs Labor Distance column with inline edit

**Date**: 2026-02-23

**Overview**:
Sub Sheet Ledger table (Jobs → Labor tab) now shows a **Distance** column between Address and Labor rate. Each row displays the distance in miles (or "—" if empty) with an **Edit** button for inline editing.

**Distance column**:
- **Position**: Between Address and Labor rate
- **Display**: Value as "X mi" or "—" when empty
- **Inline edit**: Edit button opens number input; Enter or blur saves; Escape cancels
- **Persistence**: Saves to `people_labor_jobs.distance_miles`; used by Drive cost calculation

**Files**: `src/pages/Jobs.tsx`

---

## Latest Updates (v2.62)

### Prospects enhancements: New Prospect button, Convert tab, callbacks, timer, comments

**Date**: 2026-02-24

**Overview**:
Prospects page improvements: New Prospect added to Dashboard buttons; modernized Convert tab; callback notes; Call back scheduled for display; Follow Up timer; comment author attribution; Edit Prospect delete; Prospect List "No longer a fit" minimized by default.

**Dashboard buttons**:
- **New Prospect**: Added to Settings → Dashboard buttons and Dashboard quick-action buttons; links to Prospects with New Prospect modal open
- **Button list**: Job, Job Labor, Bid, Project, Part, Assembly, New Prospect

**Prospects Convert tab**:
- **Modernized UI**: Numbered sections (1. Customer details, 2. Contact persons, 3. Bids); card layout; improved empty state
- **Address**: No longer pre-filled from prospect's Links to Website; left blank
- **Date met**: Pre-filled from first interaction (earliest prospect_comment) when converting

**Prospects Follow Up**:
- **Call back scheduled for**: Displays above Last Contact when user has an upcoming callback; shows date/time and optional note, e.g. `2/24/26, 9:26 PM (discuss pricing)`
- **Set Call back modal**: Added Note field for optional callback notes; stored in `prospect_callbacks.note`
- **Timer**: Count-up timer (MM:SS) next to Next Prospect button; resets when user leaves browser tab and returns
- **Comment authors**: Each comment shows who added it (name or email) next to the timestamp

**Prospects Edit modal**:
- **Delete**: Trash icon in header to delete prospect; confirmation required

**Prospect List**:
- **No longer a fit**: Section minimized (collapsed) by default

**Files**: `src/pages/Prospects.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Settings.tsx`, `src/components/NewCustomerForm.tsx`, `src/index.css`

**Migrations**: `20260230000012_add_note_to_prospect_callbacks.sql` (adds `note` column to prospect_callbacks)

---

## Latest Updates (v2.61)

### User notes on People page, Add button styling

**Date**: 2026-02-29

**Overview**:
Masters, Assistants, and Devs can add and edit general notes on each user in People → Users. Notes appear after the user's email. Add button in People Users tab uses modern blue styling.

**User notes**:
- **People → Users**: Each user row (Devs section and KINDS sections) shows notes after email, e.g. `email@example.com — General note text`
- **Edit button**: Card/ID icon (replaces "Edit" text) opens modal to edit note; visible to dev, master_technician, assistant
- **Database**: `users.notes` (text, nullable); RLS policy allows dev/master/assistant to UPDATE users
- **Migration**: `20260229000004_add_users_notes.sql`

**People Add button**:
- **Styling**: Add button in Assistants, Master Technicians, Subcontractors, Estimators sections now uses blue background (#3b82f6), white text, rounded corners—matches other primary buttons in the app

**Files**: `src/pages/People.tsx`, `src/types/database.ts`

**Migrations**: `20260229000004_add_users_notes.sql`

---

## Latest Updates (v2.60)

### Dashboard button visibility, impersonation redirects, back-button fix

**Date**: 2026-02-22

**Overview**:
Users can configure which Dashboard quick-action buttons (Job, Job Labor, Bid, Project, Part, Assembly) are visible. Impersonation uses different redirect URLs for Settings vs People. Back-button crash when impersonating is fixed. Dev-only imitate icon on People → Users.

**Dashboard button visibility**:
- **Settings → Dashboard buttons**: Checkboxes for each button (Job, Job Labor, Bid, Project, Part, Assembly); dev, master_technician, assistant can configure
- **Table**: `user_dashboard_buttons` (user_id, button_key, visible); migration `20260228190000_create_user_dashboard_buttons.sql`
- **Dashboard**: Filters buttons by visibility; defaults to all visible when no preferences stored

**Impersonation redirect URLs**:
- **Settings imitate**: Redirects to `http://localhost:5173/dashboard` (for local dev)
- **People → Users imitate** (dev-only): Redirects to `https://pipetooling.com/dashboard` (production)

**Impersonation back-button fix**:
- Hash cleared synchronously before async `setSession` to avoid bfcache issues
- `pageshow` handler reloads when page restored from bfcache
- `popstate` handler redirects to dashboard when user hits back

**People imitate**:
- Dev-only imitate icon on People → Users table; redirects to pipetooling.com

**Files**: `src/pages/Dashboard.tsx`, `src/pages/Settings.tsx`, `src/pages/People.tsx`, `src/App.tsx`, `src/components/Layout.tsx`, `src/lib/loginAsUser.ts`

**Migrations**: `20260228190000_create_user_dashboard_buttons.sql`

---

## Latest Updates (v2.59)

### Workflow collapsible sections, notify defaults, line items total

**Date**: 2026-02-22

**Overview**:
Workflow stage card UI improvements: collapsible sections for Notify, Notes, Private Notes, and Line Items; Notify section collapsed by default; cross-step notification checkboxes default to on; consistent font sizes; removed blue boxes; Line Items shows total when collapsed.

**Notify when stage**:
- **Collapsed by default**: Section always starts collapsed (no longer expands based on in-progress or content)
- **Cross-step checkboxes default to on**: "Notify next card assignee when complete or approved" and "Notify prior card assignee when marked incomplete" are checked by default (null/undefined treated as true)
- **Expansion logic**: These two checkboxes are excluded from the "has content" check that would expand the section

**Notes, Private Notes, Line Items**:
- **Collapsible**: All three sections are collapsible; expand/collapse via click on header
- **Default expansion**: Notes, Private Notes, and Line Items expand when stage is in progress or when they have content
- **Font size**: Private Notes and Line Items headers use same font size (1rem) as Notes
- **Blue boxes removed**: Private Notes and Line Items no longer have light blue background/border; match Notes styling

**Line Items when collapsed**:
- **Total displayed**: When collapsed, header shows "Line Items (Master and Assistants only) | $3,000.00" (sum of all line item amounts for that stage)
- **Format**: Uses `formatAmount()` for currency display (commas, 2 decimals)

**Files**: `src/pages/Workflow.tsx`

---

## Latest Updates (v2.57)

### Dashboard reports modal, icons, hide, delete dev-only

**Date**: 2026-02-22

**Overview**:
Dashboard Recent Reports: click to view in modal, envelope icon on unread, hide button on read reports; Reports realtime updates; Primary Job Tally RLS; devs-only report delete on Jobs page; Settings Save report settings green confirmation toast; shared ToastContext for app-wide toasts.

**Settings Report Settings**:
- **Save confirmation**: Clicking "Save report settings" shows a green success toast ("Report settings saved.") in the top-right
- **ToastContext**: New shared toast system so any component (e.g. Settings) can trigger toasts that App displays; `useToastContext()` provides `showToast(message, type)`; types: info, warning, error, success

**Dashboard Recent Reports**:
- **ReportViewModal**: Click a report to open a modal showing full contents (template, job, created by, field values)
- **Read state**: After opening, report is grayed (light background, reduced opacity)
- **Envelope icon**: Unread reports show an envelope SVG on the left
- **Hide button**: Read reports show an X icon on the right; click to remove from dashboard (session-only; refresh restores)
- **Realtime**: Dashboard updates immediately when a report is added (reports table in supabase_realtime)

**Jobs Reports**:
- **Delete (devs only)**: Devs see a Delete button on each report; RLS restricts DELETE to dev role only

**Primary Job Tally**:
- **RLS**: Primaries can add parts in Job Tally (jobs_tally_parts policies updated)

**Files**: `src/pages/Dashboard.tsx`, `src/components/ReportViewModal.tsx`, `src/pages/Jobs.tsx`, `src/pages/Settings.tsx`, `src/App.tsx`, `src/contexts/ToastContext.tsx`

**Migrations**: `20260225000000_primary_jobs_tally_parts.sql`, `20260225000001_reports_to_realtime.sql`, `20260226000000_reports_delete_dev_only.sql`

---

## Latest Updates (v2.58)

### Subcontractor Job Tally Submit for Review RLS fix

**Date**: 2026-02-22

**Overview**:
Subcontractors (e.g. Abraham) could not submit for review in Job Tally; they saw "new row violates row-level security policy for table jobs_tally_parts". The jobs_tally_parts INSERT policy for subcontractors checks team membership via `jobs_ledger_team_members`, but subcontractors had no SELECT policy on that table, so the subquery returned no rows and the INSERT failed.

**Fix**:
- Add policy "Subcontractors can read own jobs ledger team member rows" on jobs_ledger_team_members: subcontractors can SELECT rows where user_id = auth.uid()
- Allows subs to verify they are on a job's team without exposing other team members

**Files**: `supabase/migrations/20260228100000_subcontractors_read_jobs_ledger_team_members.sql`

---

## Latest Updates (v2.56)

### Job Tally quantity, Materials abbreviations, Primary role

**Date**: 2026-02-21

**Overview**:
Job Tally quantity controls now use whole numbers with improved UX; Materials page shows abbreviated service type labels; Primary role enhancements including service type filtering and adoption-based access.

**Job Tally**:
- **Quantity arrows**: Up/down arrows increment/decrement by 1 (1 → 2 → 3 → …); minimum quantity is 1
- **Hide down arrow when 1**: Down arrow hidden when quantity is 1 (both in add-part section and in entries list)
- **Whole numbers only**: Quantity input and entry adjustments enforce integers; no fractional quantities

**Materials**:
- **Service type abbreviations**: Top service type buttons show abbreviated labels: Plumbing → PLUM, Electrical → ELEC; hover shows full name
- **Fallback**: Service types without a mapping display full name

**Primary role** (migrations and UI):
- **primary_service_type_ids**: Devs can restrict primaries to specific service types in Materials (like estimator_service_type_ids)
- **Adoption-based access**: master_primaries table; primaries see bids, projects, materials from adopting masters
- **Jobs Billing**: Edit/Delete hidden for primaries
- **Materials Price Book**: Supply house name fallback for primaries when supply house not loaded
- **Task assignees**: Primaries appear in task assignee dropdown
- **Layout**: Treat `role === null` as primary during load to avoid header flash; hide Customers/People while role loads
- **Dashboard**: Filter pinned routes by role; treat `role === null` as primary

**Files**: `src/pages/JobTally.tsx`, `src/pages/Materials.tsx`, `src/components/Layout.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Jobs.tsx`, `src/pages/Settings.tsx`

**Migrations**: `20260224000000_add_primary_service_type_ids.sql`, `20260223100000_create_master_primaries.sql`, `20260223000000_primary_add_materials_to_jobs.sql`, `20260224100000_primary_bids_bid_board_access.sql`, `20260224110000_primary_bids_adoption_access.sql`, `20260224120000_primary_projects_adoption_access.sql`, `20260224130000_allow_users_see_primaries.sql`, `20260224140000_primary_supply_houses_read.sql`, `20260224150000_primary_assembly_book_read.sql`

---

## Latest Updates (v2.55)

### Dashboard and Jobs UI label updates

**Date**: 2026-02-20

**Overview**:
Dashboard section labels updated for consistency; Jobs page header aligned with People page; Dashboard title removed.

**Dashboard**:
- **Page title removed**: "Dashboard" heading no longer displayed
- **Recently Completed Tasks (7 days)**: Renamed from "Completed (last 7 days)"
- **Projects: Assigned Stages**: Renamed from "My Assigned Stages"
- **Projects: Subscribed Stages**: Renamed from "Subscribed Stages"
- **My Notification History**: Renamed from "Notification history"

**Jobs page**:
- **Header**: "Jobs" title added on the right of the tab bar (matches People page pattern)

**Files**: `src/pages/Dashboard.tsx`, `src/pages/Jobs.tsx`

---

## Latest Updates (v2.54)

### Quickfill page, nav icon, section order

**Date**: 2026-02-21

**Overview**:
New Quickfill page at `/quickfill` combining People Hours, Jobs Receivables, and Materials Supply Houses & External Subs on one page for assistants. Nav bar shows icon-only link (heart icon) to the left of Dashboard. Access restricted to Assistants, Masters, and Devs.

**Quickfill page**:
- **Route**: `/quickfill`; pinnable from Settings.
- **Sections** (top to bottom): People Hours (timesheet with date range, HH:MM:SS inputs); Jobs Receivables (AR total, payer table, Add Payer); Materials Supply Houses & External Subs (expandable supply houses, invoices, External Team with job payments).
- **Add Payer**: Button aligned to the right in Receivables section.
- **Access**: Visible only to dev, master_technician, assistant roles.

**Navigation**:
- **Quickfill link**: Heart icon only (no text) to the left of Dashboard; `title="Quickfill"` and `aria-label="Quickfill"` for accessibility.
- **Icon alignment**: Uses `1em` size and `inline-flex` / `alignItems: center` to align with other nav text.

**Files**: `src/pages/Quickfill.tsx`, `src/components/quickfill/HoursSection.tsx`, `src/components/quickfill/ReceivablesSection.tsx`, `src/components/quickfill/SupplyHousesSection.tsx`, `src/components/Layout.tsx`, `src/App.tsx`, `src/lib/pinnedTabs.ts`, `src/lib/format.ts`

---

## Latest Updates (v2.53)

### Supply Houses & External Subs, Jobs Receivables, Dashboard pins

**Date**: 2026-02-21

**Overview**:
Materials tab renamed to Supply Houses & External Subs with full vendor/invoice management and External Team (subcontractors with job payments). Jobs Receivables tab for AR tracking. Settings sections for pinning AR, Supply Houses AP, External Team, and Cost matrix to Dashboard. People Pay "Due by Tag" renamed to "Due by Trade". Dashboard pin labels updated.

**Materials – Supply Houses & External Subs tab**:
- **Tab name**: "Supply Houses" renamed to "Supply Houses & External Subs" (hidden from estimators).
- **Supply Houses section**: Summary table at top with AP total (Supply Houses: $X); expandable rows per supply house; Add Supply House button; per-supply-house invoices (Invoice #, Date, Due Date, Amount, Link, Paid); purchase orders linked via `supply_house_id`.
- **External Team section**: Table of external subcontractors (from `people` kind='sub') with External Subcontractor, Sub Manager (User), Outstanding, Add Job Payment; expandable rows show job payments (note, amount, paid checkbox); Add External Subcontractor button; Sub Manager assignable from users dropdown.
- **Tables**: `supply_house_invoices`, `external_team_sub_managers`, `external_team_job_payments`; `purchase_orders.supply_house_id` added.

**Jobs – Receivables tab**:
- **New tab**: Receivables tab (first tab, left of Billing) for assistants to enter Payer, Point Of Contact, Account Rep (Master or Sub from dropdown), Amount to Collect.
- **AR total**: Displayed at top (AR: $X,XXX.XX).
- **Table**: `jobs_receivables` with RLS matching jobs_ledger visibility (dev, master, assistant; assistants see master's data).
- **Add Payer button**: At bottom to add new receivables entries.

**Settings – Pin to Dashboard** (dev-only):
- **Pin AR to Dashboard**: Pin Jobs Receivables total to masters/devs; label "AR | $X,XXX".
- **Pin Supply Houses AP to Dashboard**: Pin Materials Supply Houses AP total; label "Supply Houses: $X".
- **Pin External Team to Dashboard**: Pin External Team outstanding total; label "External Team: $X,XXX".
- **Pin Cost matrix / Share Cost Matrix**: Moved from People Pay to Settings; "Share Cost Matrix and Teams" and "Pin Cost matrix to Dashboard" sections below AR pin.
- **Display labels**: Internal Team: $X (Cost matrix), Supply Houses: $X, AR | $X, External Team: $X.

**People Pay**:
- **Due by Tag** renamed to **Due by Trade**.

**Files**: `src/pages/Materials.tsx`, `src/pages/Jobs.tsx`, `src/pages/Settings.tsx`, `src/pages/Dashboard.tsx`, `src/lib/pinnedTabs.ts`, `supabase/migrations/20260220190000_create_supply_house_invoices_and_po_link.sql`, `supabase/migrations/20260220200000_create_jobs_receivables.sql`, `supabase/migrations/20260220210000_create_external_team.sql`

---

## Latest Updates (v2.52)

### People Pay layout, Cost matrix mobile dates, Builder Review PIA

**Date**: 2026-02-19

**Overview**:
People Pay tab section order, Cost matrix date headers on mobile, and Builder Review PIA checkbox to exclude customers when Oldest first is selected.

**People Pay tab**:
- **Section order**: People pay config, Share Cost Matrix and Teams, and Tag colors moved to the bottom of the Pay tab. Order is now: Due by Tag → Due by Team → Cost matrix → Teams → People pay config → Share Cost Matrix and Teams → Tag colors.

**Cost matrix**:
- **Mobile date headers**: On mobile (≤640px), date column headers display on two lines (e.g. "Mon" above "2/16") instead of "Mon, 2/16" on one line. Improves readability on narrow screens.

**Builder Review**:
- **PIA checkbox**: Each customer card has a "[ ] PIA" checkbox. When checked, that customer is excluded from the list when "Oldest first" is selected. PIA = "ignore when Oldest first."
- **Persistence**: PIA selections stored per user in localStorage (`bids_builder_review_pia_${userId}`).
- **PIA (excluded) section**: When Oldest first is active and some customers are marked PIA, a section at the bottom lists them with checkboxes so users can uncheck PIA without switching to Newest first.

**Files**: `src/pages/People.tsx`, `src/index.css`, `src/pages/Bids.tsx`

---

## Latest Updates (v2.51)

### Fix app page, Cost matrix pins, Builder Review, People Pay

**Date**: 2026-02-19

**Overview**:
Fix app page for white-screen recovery, Cost matrix Pin To Dashboard with total display and Unpin All, Builder Review improvements, People Pay config collapsed by default, cost matrix comma formatting, and duplicate pin handling.

**Fix app (white screen recovery)**:
- **`/fix-cache.html`**: Standalone page (no React dependency) to recover from white screen after app updates. Unregisters service workers, clears Cache API caches, clears app localStorage keys (`pipetooling_*`, `impersonation_original`, `materials_loadAllMode_*`), then reloads. Accessible when the main app won't load. Link in Settings under "Fix app".
- **Use case**: User had phone open during deploy; app showed white screen. Navigate to `https://yoursite.com/fix-cache.html`, click "Fix app", app reloads fresh.

**Cost matrix Pin To Dashboard**:
- **Display**: Pins now show "Total | $12,354" (current week total) on Dashboard instead of "People – Cost matrix · pay". Link goes to `/people?tab=pay#cost-matrix` and scrolls to Cost matrix.
- **Unpin All**: Button next to "Pin To Dashboard" removes Cost matrix pin from all users. Requires dev RLS policy (`allow_devs_delete_user_pinned_tabs`).
- **Duplicate handling**: `addPinForUser` treats duplicate key (23505 or message containing constraint name) as success; no error shown when re-pinning.

**Builder Review**:
- **Service Types**: Grayed out (opacity 0.5, pointer-events none) when Builder Review tab is active.
- **All customers**: When Builder Review is open, loads all customers and all bids (no service type filter). Switching back to Bid Board reloads with selected service type.

**People Pay**:
- **Pay config**: "People pay config" section collapsed by default.
- **Cost matrix totals**: All dollar amounts use comma formatting (e.g. $12,354).

**Realtime for pins**: `user_pinned_tabs` added to Supabase Realtime publication; Dashboard subscribes so new pins appear immediately without refresh. `visibilitychange` listener also refreshes pins when tab becomes visible.

**Files**: `public/fix-cache.html`, `src/pages/People.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Settings.tsx`, `src/pages/Bids.tsx`, `src/lib/pinnedTabs.ts`, `supabase/migrations/20260219220000_add_user_pinned_tabs_to_realtime.sql`, `supabase/migrations/20260219230000_allow_devs_delete_user_pinned_tabs.sql`

---

## Latest Updates (v2.50)

### Jobs page: tab order, Labor user lists, HCP Jobs row alignment

**Date**: 2026-02-19

**Overview**:
Jobs page UI updates: tab order reordered, Labor/Edit job User picker split into two lists by role, HCP Jobs table actions vertically centered per row.

**Tab order**:
- **Before**: Labor | Sub Sheet Ledger | HCP Jobs | Upcoming | Teams Summary
- **After**: Labor | HCP Jobs | Sub Sheet Ledger | Upcoming | Teams Summary

**Labor tab & Edit Labor Job modal**:
- **User** picker is now two labeled lists: **Everyone else** (Masters, Assistants, Estimators, Devs) and **Subcontractors**. Each list shows radio options; selection applies to the same field. Empty lists show "None".

**HCP Jobs tab**:
- **Edit** and **Delete** buttons are vertically centered in each row (same line as Revenue value when row is single-line; centered in row when row is taller).

**Files**: `src/pages/Jobs.tsx`

---

## Latest Updates (v2.49)

### Labor and Sub Sheet Ledger moved from People to Jobs

**Date**: 2026-02-19

**Overview**:
Labor and Sub Sheet Ledger tabs were moved from the People page to the Jobs page. People now has only **Users**, **Pay**, and **Hours** (default tab: Users). Jobs has Labor, HCP Jobs, Sub Sheet Ledger, Upcoming, and Teams Summary (tab order and Labor/HCP UI refined in v2.50).

**People page** (`/people`):
- **Tabs**: Users (default), Pay, Hours. Labor and Sub Sheet Ledger tabs and all related state, handlers, and UI removed.
- No route or URL change; only which tabs appear.

**Jobs page** (`/jobs`):
- **Tabs** (in order): Labor | HCP Jobs | Sub Sheet Ledger | Upcoming | Teams Summary (see v2.50 for Labor user lists and HCP row alignment).
- **Labor tab**: User from roster (two lists: Everyone else / Subcontractors in v2.50), Address, Job #, Service type, Labor rate, Date, fixture rows, Save Job, Print for sub, collapsible Labor book. Uses `people_labor_jobs` and `people_labor_job_items`.
- **Sub Sheet Ledger tab**: Table of labor jobs; Edit modal uses same User two-list picker.
- Jobs loads roster when Labor or Sub Sheet Ledger is active; helpers include `byKind`, `rosterNamesEveryoneElse`, `rosterNamesSubcontractors`, `isAlreadyUser`.

**Cross-checks**:
- No route changes. No backend or migration changes; same RLS and tables.

**Files**: `src/pages/Jobs.tsx`, `src/pages/People.tsx`

---

## Latest Updates (v2.48)

### Checklist FWD, Estimator Dashboard, iOS Safe Area, Jobs Fix

**Date**: 2026-02-18

**Overview**:
Checklist Forward (FWD) feature for devs, estimator access to Dashboard, iOS safe-area fix for nav bar, and Jobs TypeScript build fix.

**Checklist FWD (dev-only)**:
- **FWD button**: On Checklist page (Today, Upcoming, Outstanding tabs) and Dashboard, devs see an "fwd" link/button on the far right of each task. On Checklist desktop it appears as a blue FWD button; on Dashboard it appears as a light grey "fwd" link.
- **Forward modal**: Clicking FWD opens a modal to edit the task title and assign it to another user via dropdown. Creates a new checklist item (repeat_type: once) with the edited title and assignee, copies notifications/reminders from the source, and **removes the original task**.
- **Visibility**: FWD button hidden on mobile (max-width: 640px) on Checklist; Dashboard "fwd" link always visible for devs.

**Estimator Dashboard Access**:
- Estimators can now access the Dashboard. Added `/dashboard` to `ESTIMATOR_PATHS` in Layout; Dashboard nav link shown for estimators; redirect logic updated so estimators are not redirected away from `/dashboard`.
- Dashboard sets `role` to `'estimator'` (no longer null) so estimators see Builder Review and their checklist items.

**iOS Safe Area**:
- Nav bar (menu and settings buttons) was stuck under the iOS status bar/notch on subcontractor devices. Added `padding-top: max(var(--app-nav-pad-y), env(safe-area-inset-top, 0px))` to `.appNav` in `index.css` so the nav content sits below the safe area.

**Jobs TypeScript Fix**:
- Fixed "m is possibly undefined" build errors in `Jobs.tsx` (lines 187–188, 221–222) by using `for (const [i, m] of validMaterials.entries())` instead of index access.

**Files**: `src/pages/Checklist.tsx`, `src/pages/Dashboard.tsx`, `src/components/Layout.tsx`, `src/index.css`, `src/pages/Jobs.tsx`

---

## Latest Updates (v2.47)

### Hours Update Pay Sync (Realtime)

**Date**: 2026-02-18

**Overview**:
When any user (Dev, Master, or Assistant) updates hours in the People > Hours tab, the Pay section Cost matrix now updates automatically for all users viewing it—no refresh or tab switch required.

**People > Pay / Hours**:
- **Realtime subscription**: People page subscribes to Postgres changes on `people_hours` when Pay or Hours tab is active. On INSERT/UPDATE/DELETE, clients refetch `peopleHours` for their current date range.
- **Cross-user sync**: User A edits hours; User B (viewing Pay) sees the Cost matrix update within seconds.
- **Database**: `people_hours` added to `supabase_realtime` publication so changes are broadcast to subscribers.

**Migration**: `20260218000002_add_people_hours_to_realtime.sql`

**Files**: `src/pages/People.tsx`, `supabase/migrations/20260218000002_add_people_hours_to_realtime.sql`

---

## Latest Updates (v2.46)

### Supabase Disk IO Optimizations

**Date**: 2026-02-17

**Overview**:
Reduced Supabase disk IO usage to address "Disk IO Budget" depletion. Materials page and related features now use batched queries, conditional loading, and targeted indexes.

**Materials – Price Book**:
- **Batch price fetching**: Replaced N+1 queries (one per part) with a single batch query for all prices per page. New `fetchPricesForParts()` helper fetches prices for multiple parts in one or few queries, then joins in memory.
- **Conditional Load All**: `loadAllParts` runs only when Load All mode is on. When off, only paginated `loadParts` runs—avoids redundant full-table loads on service type change.
- **Load All default off**: Default changed from on to off to reduce initial load. Users can still enable via the mountain icon; preference persists in localStorage.
- **Template items batching**: `loadTemplateItems` now batch-fetches parts, prices, and nested templates instead of N+1 queries per item.
- **Template stats filter**: `loadAllTemplateItemsForStats` now filters by selected service type (only templates for Plumbing/Electrical/HVAC) instead of loading all template items globally.

**Dashboard**:
- **Assigned steps limit**: Added `.limit(100)` to assigned workflow steps queries to cap result size.

**Settings**:
- **Export warning**: Added note that export "may take several minutes for large datasets and uses significant database resources."

**Database**:
- **Composite index**: `idx_material_parts_service_type_name` on `(service_type_id, name)` for faster Materials Price Book queries when filtering by service type and ordering by name.

**Migration**: `20260217230000_add_material_parts_service_type_name_index.sql`

**Files**: `src/pages/Materials.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Settings.tsx`, `supabase/migrations/20260217230000_add_material_parts_service_type_name_index.sql`

---

## Latest Updates (v2.45)

### Impersonation Fix, Teams Compact, Yesterday Label

**Date**: 2026-02-17

**Overview**:
Bug fix for impersonation when a reload occurs; Teams section made more compact; Yesterday label restored.

**Impersonation**:
- **Bug**: When a dev was impersonating another account and a change was pushed (Global Reload, new version reload, or service worker update), the original session was lost and the dev could not go back to their account, logout, or log back in
- **Fix**: Store original session in `localStorage` instead of `sessionStorage` (key: `impersonation_original`). localStorage persists across reloads, so "Back to my account" works after any reload

**People > Pay > Teams**:
- **Compact layout**: Reduced padding, gaps, and font sizes; cost summary on single horizontal line (Period, 7d, 3d, Yesterday)
- **Yesterday**: Restored full "Yesterday" label (was briefly "Yest")

---

## Latest Updates (v2.44)

### Share Cost Matrix and Teams, Green Dot, Cost Matrix Navigation

**Date**: 2026-02-17

**Overview**:
Dev can share Cost Matrix and Teams with selected masters and assistants (view-only). Masters and assistants can see the green dot for push notifications in People. Cost matrix has week navigation like Hours.

**Share Cost Matrix and Teams** (People > Pay):
- **Dev-only section**: Collapsible "Share Cost Matrix and Teams" above Cost matrix with checkboxes for each master and assistant
- **Shared users**: Get view-only access to Cost matrix and Teams (no People pay config, no Add team, no rename/add/remove members)
- **Database**: `cost_matrix_teams_shares` (shared_with_user_id); RLS allows dev to manage, shared users to SELECT people_pay_config, people_teams, people_team_members, people_hours

**People Page**:
- **Green dot**: Masters and assistants (in addition to devs) now see the green dot next to users with push notifications enabled in People > Users tab
- **Cost matrix**: "← last week" and "next week →" buttons added (same as Hours tab)

**Migrations**: `20260217200000_allow_masters_assistants_read_push_subscriptions.sql`, `20260217210000_create_cost_matrix_teams_shares.sql`

---

## Latest Updates (v2.43)

### Navigation, Settings, and Global Reload

**Date**: 2026-02-17

**Overview**:
Navigation and Settings reorganization: gear menu, Sign out and Hard Reload moved to Settings, Global Reload for devs.

**Gear Menu** (top-right):
- **Settings**: Link to Settings page (all users)
- **Global Reload**: Dev-only option that broadcasts a reload signal to all connected clients via Supabase Realtime; all clients clear caches and hard reload

**Settings Page** (top button row):
- **Sign out**: Moved from gear menu; now at top of Settings for all users
- **Hard Reload**: Moved from nav bar; clears caches and reloads current user only
- **Change password**: Unchanged

**Technical**:
- `ForceReloadContext`: Supabase Realtime Broadcast channel `force-reload`; all authenticated clients subscribe on mount; dev triggers broadcast via gear menu
- Layout: Gear dropdown shows Settings + Global Reload (dev-only); removed Sign out and Hard Reload from nav

**Dashboard**:
- **Notification history ledger**: Expandable section showing recent notifications (timestamp, title, channel badge, links to project/workflow/checklist)
- **Performance**: Parallel fetches (Phase 1: user, allUsers, subs, checklist; Phase 2: subscribed and assigned in parallel); progressive rendering with per-section loading flags; skeleton UI for Checklist, Assigned, Subscribed

---

## Latest Updates (v2.42)

### Checklist, Dashboard, Settings, and UI Updates

**Date**: 2026-02-17

**Overview**:
Checklist enhancements, Dashboard integration, Settings reorganization, app rebrand to PipeTooling, and various UI improvements.

**Checklist**:
- **Multiple days of week**: Add/Edit checklist item now supports selecting multiple days (checkboxes for Sun–Sat) for weekly repeats instead of a single day
- **Database**: `repeat_day_of_week` migrated to `repeat_days_of_week` (integer array)
- **Removed page title**: "Checklist" heading removed from `/checklist` page
- **Nav**: Checklist changed from button to NavLink in header (matches Bids, Calendar styling)

**Dashboard**:
- **Checklist items due today**: New section at top showing user's checklist items due today with checkboxes (complete/uncomplete), link to full checklist
- **Subscribed Stages**: Section now always visible for devs/masters/assistants; shows empty-state message when no subscriptions ("Go to a workflow and enable Notify when...")
- **Moved to Settings**: "Your role" and "How It Works" (PipeTooling helps Masters...) text moved from Dashboard to Settings

**Settings**:
- **Your role**: Now displayed under Settings heading
- **How It Works**: PipeTooling intro, Sharing, Subcontractors info moved here (visible to masters/devs)
- **Test notification**: Success feedback when test succeeds; note about iOS foreground behavior

**App**:
- **Rebrand**: Pipetooling → PipeTooling (title, PWA manifest, push notifications, email sender name)
- **Favicon**: White wrench overlay on orange gear icon

**Edge Functions**:
- **send-checklist-notification**: Deployed with `verify_jwt: false` (matches other functions; fixes 401 on test)

**Migrations**: `20260217070000_checklist_repeat_days_of_week_array.sql` (adds `repeat_days_of_week`, migrates from `repeat_day_of_week`)

---

## Latest Updates (v2.41)

### People Page: Pay and Hours Tabs

**Date**: 2026-02-13

**Overview**:
The People page now includes **Pay** and **Hours** tabs for wage configuration, cost tracking, and timesheet entry. Access is controlled via Pay Approved Masters (dev and approved masters only).

**Pay Tab**:
- **People pay config** (collapsible): Set hourly wage, Salary (8 hrs/day), Show in Hours, and Show in Cost Matrix per person. Click the header to collapse/expand.
- **Cost matrix**: Date-range table showing daily cost per person (hours × wage). First column shows `Person | $periodTotal`; bottom row shows `Total | $cumulative` with per-day sums and grand total.
- **Teams**: Add teams and assign people; view combined cost for a date range.

**Hours Tab**:
- Timesheet table: Person column, day columns (editable HH:MM:SS), two total columns (HH:MM:SS and Decimal) per person.
- Footer: Two rows—"Total (HH:MM:SS):" and "Total (Decimal):"—with per-day sums and grand total in the final column.
- Salary people show read-only hours (8 hrs/day default); hourly people can edit.

**Database**: `pay_approved_masters`, `people_pay_config`, `people_hours`, `people_hours_display_order`, `people_teams`, `people_team_members`

**Migrations**: `20260213000000_create_pay_approved_masters.sql` through `20260213000007_create_people_hours_display_order.sql`

---

## Latest Updates (v2.40)

### People Page: Labor Tab and Ledger

**Date**: 2026-02-12

**Overview**:
The People page now includes a **Labor** tab and **Ledger** tab for tracking labor jobs per person. Masters and assistants can add labor jobs with fixture rows (fixture, count, hrs/unit, fixed), and the Ledger displays all jobs in a table with Edit and Delete actions.

**Labor Tab**:
- Select a person from roster; form fields: User (assigned_to_name), Address, Job # (max 10 chars), Date, Labor rate
- Fixture rows table: Fixture, Count, hrs/unit, Fixed checkbox, Remove
- Add Row and Save create a new labor job with items
- Validation: assigned and address required; at least one valid fixture row

**Ledger Tab**:
- Table: User, Address, Job #, Date, Labor rate, Total hrs, Actions (Edit, Delete)
- **Edit button**: Opens modal with same form structure; Save updates the job and replaces all fixture items
- **Delete button**: Removes job and its items
- Print for sub: Uses job_date when set, otherwise created_at; includes Job # in output

**Database**: `people_labor_jobs` (assigned_to_name, address, job_number, job_date, labor_rate), `people_labor_job_items` (fixture, count, hrs_per_unit, is_fixed)

**Migrations**: `20260212190000_create_people_labor_jobs.sql`, `20260212200000_add_is_fixed_to_people_labor_job_items.sql`, `20260212250000_add_job_number_to_people_labor_jobs.sql`, `20260212260000_add_job_date_to_people_labor_jobs.sql`

---

### People: Master Shares RLS

**Date**: 2026-02-12

**Overview**:
When a Dev shares with another Master (e.g., Malachi), Malachi and his assistants can now see the shared people (including subs) and their labor jobs/ledger.

**Changes**:
- **people**: New SELECT policy for shared access via `master_shares` and `master_assistants`
- **people_labor_jobs** / **people_labor_job_items**: Updated SELECT policies to include shared access
- **master_shares**: Assistants can read shares where they assist the viewing master
- **users**: Viewing masters and their assistants can see sharing masters' user rows (enables "Created by [name]" instead of "Unknown")
- Uses `can_see_sharing_master()` SECURITY DEFINER function to avoid RLS recursion

**UI**: Shared people show "Created by [name]" instead of Remove button; creator names resolve correctly

**Migrations**: `20260212210000_add_master_shares_to_people.sql`, `20260212220000_allow_assistants_read_master_shares_for_viewing.sql`, `20260212230000_allow_viewing_masters_see_sharing_masters.sql`

---

### Estimators: See Masters for Customer Owner Dropdown

**Date**: 2026-02-12

**Overview**:
Estimators can now see master_technician and dev users in the Customer Owner dropdown when adding a new customer (Add Customer modal from Bids). Previously this showed "No masters found" due to RLS.

**Changes**:
- New `is_estimator()` SECURITY DEFINER function
- New policy: Estimators can SELECT users where role IN ('master_technician', 'dev')

**Migration**: `20260212240000_allow_estimators_see_masters.sql`

---

## Latest Updates (v2.39)

### Takeoff Tab: Print Breakdown

**Date**: 2026-02-13

**Overview**:
Added a **Print Breakdown** button on the Takeoff tab that produces a printable report showing what parts and assemblies make up the purchase orders per stage. The report is designed for master plumber audit.

**Location**: Takeoff tab, next to "Create purchase orders for Stages" and "Add to selected PO"

**Report Structure**:
- **Per stage** (Rough In, Top Out, Trim Set): Only stages with mappings are shown
- **Per count line item** (fixture + count): Parts are grouped by each fixture/count row
- **Parts table** for each fixture: Part name | Qty | Assembly (template the part comes from)
- Parts are not merged across assemblies; each row shows the assembly it belongs to for full traceability

**Features**:
- Disabled when no assemblies are mapped
- Shows "Preparing…" while expanding templates
- Opens print preview in new window; closes after print/cancel
- Uses same print styling as Cost Estimate (sans-serif, bordered tables, print margins)

**Implementation**: `src/pages/Bids.tsx` – `printTakeoffBreakdown()`, `expandTemplate()` from `materialPOUtils.ts`

---

## Latest Updates (v2.38)

### Estimator Cost Parameters

**Date**: 2026-02-12

**Overview**:
Added an "Estimator Cost Parameters" section to the Cost Estimate tab, allowing a per-count-type cost (default $10 per Count Type) or a flat amount to be included in Labor Total. This cost is added alongside labor and driving in all cost calculations.

**Changes**:
- **Location**: Yellow-highlighted section below "Driving Cost Parameters" on Cost Estimate tab
- **Options**: "Use flat amount" checkbox | Per count row ($) input (default $10) or Flat amount ($) when checked
- **Display**: "Estimator cost: X Count Types × $Y = $Z" or "Estimator cost: $Z" when using flat amount
- **Integration**: Included in Labor Total (Labor + Driving + Estimator) everywhere: Cost Estimate tab, Pricing cost breakdown, prints, PDFs, Submission cost
- **Database**: `estimator_cost_per_count` (default 10), `estimator_cost_flat_amount` (nullable) on `cost_estimates`

**Migration**: `20260212180000_add_estimator_cost_to_cost_estimates.sql`

---

### Pricing Tab: Price Book Section Closed by Default

**Date**: 2026-02-12

**Overview**:
The collapsible "Price book" section on the Pricing tab (containing version management and entries) is now **closed by default** to reduce visual clutter. Users can click to expand when needed.

---

## Latest Updates (v2.37)

### Add Missing Fixture Types to Labor Books

**Date**: 2026-02-12

**Overview**:
Estimators can now add new fixture types directly when applying labor book hours from the Cost Estimate tab, instead of seeing "fixture type not found" and having to create the fixture in Settings first.

**Changes**:
- **"Add missing fixture" modal**: When a count row has a free-text fixture (e.g., "Lights") that doesn't exist in `fixture_types`, clicking "Add" creates the fixture type automatically
- Uses existing `getOrCreateFixtureTypeId` helper: looks up by name, creates with `category: 'Other'` if not found
- Eliminates the need to switch to Settings to add fixture types before applying labor

---

### Driving Cost in Cost Estimate Print Preview

**Date**: 2026-02-12

**Overview**:
The cost estimate print preview now includes driving cost in the output, matching the on-screen display.

**Changes**:
- **Labor section**: Shows Manhours, Driving (with trips × $/mi × distance breakdown when applicable), and Labor total
- **Summary section**: Materials, Manhours, Driving, Labor total, and Grand total
- **Grand total**: Now includes driving cost (materials + labor + driving)

---

### Driving Cost in Pricing Tab

**Date**: 2026-02-12

**Overview**:
The Pricing tab now includes driving cost in the total cost and margin calculation, with a visible cost breakdown.

**Changes**:
- **Cost breakdown box**: Yellow box (right-aligned, fit-content width) showing Materials, Manhours, Driving, and Total cost
- **Percentage of total**: Each line shows its share of total cost (e.g., "Manhours: $330.00 | 91.3%")
- **Driving calculation**: Uses bid distance, cost estimate's driving_cost_rate and hours_per_trip
- **Margin**: Total cost (including driving) is used for margin % calculation
- **Print**: Pricing print and Review (all price books) include driving in totals

---

### Price Book Default Selection

**Date**: 2026-02-12

**Overview**:
When a bid has no saved price book version, the "Default" price book is now auto-selected (or the first version if Default doesn't exist).

**Changes**:
- **Auto-select on bid change**: When selecting a bid for pricing, Default (or first version) is selected if no version was previously saved
- **Fixed loading**: Version ID is correctly passed to load functions when auto-selecting (previously used null)

---

### Service Type Switch Closes Price Book Modals

**Date**: 2026-02-12

**Overview**:
When switching service types, any open price book modals are automatically closed.

**Changes**:
- **Modals closed**: Version form, entry form, and delete version modal
- **State reset**: Form fields and editing state cleared when service type changes

---

### Pricing Table Search Dropdown Overflow Fix

**Date**: 2026-02-12

**Overview**:
The price book entry search dropdown in the Pricing tab no longer gets cut off by the table container.

**Changes**:
- Table container `overflow` changed from `hidden` to `visible` so the dropdown can extend below the table

---

### Cover Letter: Inclusions Blank Removes Permits

**Date**: 2026-02-12

**Overview**:
When the Additional Inclusions field is blank, "Permits" no longer appears in the combined document.

**Changes**:
- **buildCoverLetterHtml / buildCoverLetterText**: When inclusions is blank, no default text is used (previously used "Permits")
- **PDF export**: Uses empty string when inclusions not set (no DEFAULT_INCLUSIONS fallback)
- Inclusions section shows "(none)" when both fixtures and inclusions are empty

---

### Cover Letter: Design Drawing Date Selected by Default

**Date**: 2026-02-12

**Overview**:
The "Include in combined document" checkbox for Design Drawings Plan Date is now checked by default.

**Changes**:
- **Checkbox default**: Checked when value is undefined or true (only unchecked when explicitly set to false)
- **Document generation**: Design date included in PDF and combined document when not explicitly unchecked
- **Toggle**: User can uncheck to exclude; checking again re-includes

---

## Latest Updates (v2.34)

### Duplicate Materials Page Enhancements

**Date**: 2026-02-12

**Overview**:
The Duplicate Materials page (Settings → Duplicate Materials, dev-only) now includes Best Price and Supply House columns, plus filters for exact name matches and service types.

**Changes**:
- **Best Price & Supply House columns**: Each duplicate group shows the lowest price and which supply house offers it
- **"Only show 100% name match"**: Checkbox to filter to groups where all parts have identical names
- **Service type filter**: Checkboxes (Plumbing, Electrical, HVAC, etc.) to show only duplicates for selected service types

---

### Materials Price Book Filter Fixes

**Date**: 2026-02-12

**Overview**:
Part Type and Manufacturer filter dropdowns in the Materials Price Book tab now work correctly in both paginated and Load All modes.

**Changes**:
- **Reset on service type change**: Filters clear when switching between Plumbing, Electrical, HVAC
- **Load All mode**: Filters apply client-side; dropdowns no longer disabled
- **Sort by #**: Part type and manufacturer filters work when "Sort by price count" is active (falls back to standard query path)
- **RPC updated**: `get_parts_ordered_by_price_count` now accepts `filter_service_type_id` so the "#" column sort respects the selected service type

---

### Material Part Type Category Removed

**Date**: 2026-02-12

**Overview**:
The optional Category field was removed from Edit Material Part Type (Settings → Material Part Types).

**Changes**:
- Category input and help text removed from the form
- Category badge removed from the Part Types list
- Part Type dropdowns (Materials, Add Part modal) no longer show category in parentheses
- Existing category values in the database are no longer displayed or editable

---

## Latest Updates (v2.33)

### Labor Section Increment Step

**Date**: 2026-02-11

**Overview**:
Rough In, Top Out, and Trim Set labor hour inputs in the Cost Estimate tab now use a step of 0.25 instead of 0.01 for the up/down arrows, making it easier to adjust labor hours in quarter-hour increments.

---

### Delete Buttons Moved to Edit Modals

**Date**: 2026-02-11

**Overview**:
In-row delete buttons were removed from Takeoff, Labor, and Pricing books. Delete actions are now only available inside the edit modal for each entry, reducing accidental deletions and keeping the table row layout cleaner.

---

### Template → Assembly Terminology

**Date**: 2026-02-11

**Overview**:
All user-facing "Template"/"Templates" labels for material templates were renamed to "Assembly"/"Assemblies" across Materials, Bids, and Settings.

**Changes**:
- **Tab**: "Templates & Purchase Orders" → "Assemblies & Purchase Orders"
- **Section**: "Material Templates" → "Material Assemblies"
- Labels, placeholders, error messages, and related copy updated throughout
- **Note**: Database tables and code still use `material_templates`; only UI text changed

---

### Bid Board Changes

**Date**: 2026-02-11

**Overview**:
The Bid Board tab was simplified and reorganized for cleaner layout and focused workflow.

**Removed columns**:
- Notes
- Win/Loss (W/L)
- Sent Date

**Lost bids**:
- Lost bids are now always hidden on the Bid Board (no toggle)
- Empty state message when all matching bids are lost: "No bids to show (all matching bids are lost)."

**Layout updates**:
- **Column headers** split across lines: Project/Folder, Job/Plans, Account/Man, Bid/Date, Last/Contact, Distance/to Office
- **Address**: Line break after first comma (e.g., street on line 1; city/state on line 2)
- **Last Contact**: Weekday and date on separate lines (e.g., "Wed" / "2/11")
- **Project Folder**: Folder SVG icon instead of "Link" text
- **Job Plans**: Document SVG icon instead of "Link" text

---

## Latest Updates (v2.32)

### Settings Renames and Category Removal

**Date**: 2026-02-11

**Overview**:
Settings section names and labels were clarified for better clarity. The category field was removed from Book Names.

**Changes**:
- **Fixture Types** → **Takeoff, Labor, and Price Book Names**
- **Part Types** → **Material Part Types**
- **Counts Quick-adds** → **Counts Quick-add Names** (label only; section was already named Counts Quick-adds)
- **Book Names**: Removed category field from form and badge; simplified display

---

### Book Names and Price Book Ordering

**Date**: 2026-02-11

**Overview**:
Items in Settings and Bids are now sorted alphabetically. Price Book entries are sorted by fixture name with `localeCompare` (alphanumeric). Move up/down buttons were removed from Book Names.

**Implementation**:
- Settings and Bids: Book names sorted alphabetically by name
- Price Book: Entries sorted by fixture name using `localeCompare`
- Removed move up/down buttons from Book Names section

---

### Email Templates Layout

**Date**: 2026-02-11

**Overview**:
Email Templates section is now collapsible and collapsed by default. Full-width layout with no border for a cleaner appearance.

---

### Materials Price Book – Load All Mode

**Date**: 2026-02-11

**Overview**:
The mountain icon (Load All) in the Materials Price Book was fixed for clickability and now persists per user. Load All mode is on by default for new users.

**Implementation**:
- **Clickability fix**: Added `pointerEvents: 'none'` to the SVG to prevent child elements from blocking clicks
- **Persistence**: Preference saved per user in `localStorage` (`materials_loadAllMode_${userId}`)
- **Default**: Load All mode is on by default for new users

---

### Cost Estimate – Update Bid Distance

**Date**: 2026-02-11

**Overview**:
Added a distance input and **Update bid distance** button next to Edit bid in the Driving Cost Parameters section. Users can quickly update the bid distance without leaving the Cost Estimate view.

**Implementation**:
- Added `[ ___ mi]` distance input and **Update bid distance** button next to Edit bid
- Shows success message ("✓ Distance updated") for 3 seconds after a successful update
- Located in the Driving Cost Parameters section of the Cost Estimate view

---

## Latest Updates (v2.31)

### Bids Pricing Tab: Takeoff-Based Our Cost and Row Breakdown

**Date**: 2026-02-11

**Overview**:
The Pricing tab "Our cost" now uses takeoff parts prices per fixture (with tax) plus labor instead of allocating total materials proportionally by labor hours. Clicking a row opens a modal showing the cost breakdown.

**Implementation**:
- **Our cost formula**: `(takeoff materials for fixture × (1 + tax%)) + labor`. Falls back to proportional allocation when fixture has no takeoff mappings.
- **Takeoff integration**: Loads `bids_takeoff_template_mappings` and PO items from Cost Estimate POs; uses `expandTemplate()` to compute per-fixture materials from templates and part prices.
- **Tax**: Uses `costEstimatePOModalTaxPercent` (default 8.25%) for takeoff-based materials.
- **Breakdown modal**: Shows Materials (from takeoff or proportional), Tax, Labor, and Our cost. Closes on backdrop click or Close button.

---

### Counts Quick-adds (formerly Counts Fixtures)

**Date**: 2026-02-11

**Overview**:
The hardcoded fixture quick-select buttons in Bids Counts (when adding a row) are now configurable per service type in Settings. Renamed from "Counts Fixtures" to "Counts Quick-adds."

**Implementation**:
- **Database**: New tables `counts_fixture_groups` and `counts_fixture_group_items`. Each service type (Plumbing, Electrical, HVAC) has its own groups and fixture names.
- **Settings**: Devs can add/edit/delete groups and fixtures per service type. One fixture per row for easier organization.
- **Bids**: NewCountRow loads the appropriate groups from the database based on the bid's service type.

---

### Settings Improvements

**Date**: 2026-02-11

**Overview**:
Multiple UX and capability improvements in Settings for devs.

**Changes**:
1. **Convert Master to Assistant/Subcontractor**: Section is now collapsible and collapsed by default.
2. **User actions**: Edit, Send email to sign in, imitate, Set password buttons display next to each other (horizontal layout).
3. **People Created by Other Users**: Devs can now edit (rename, email, phone, notes) and delete people entries created by other users. RLS policies added for devs to update/delete any people.
4. **Fixture Types**: "Remove unused" button next to "+ Add Fixture Type" removes all fixture types with 0 takeoff, 0 labor, 0 price. Useful for cleaning up the labor book fixture list. Counts are unaffected (count rows store fixture as free text).

---

## Latest Updates (v2.30)

### Estimator Service Type Filtering

**Date**: 2026-02-11

**Overview**:
Devs can restrict estimators to specific service types (Plumbing, Electrical, HVAC). Estimators with restrictions see only their allowed service types in Bids and Materials; estimators with no restriction continue to see all service types.

**Implementation**:
- **Database**: Added `estimator_service_type_ids uuid[]` to `users` (nullable). NULL or empty = all types; non-empty = only those types
- **RLS**: Helper function `estimator_can_access_service_type()` used in policies for bids, materials, books, and reference tables
- **Settings**: Manual Add User and Edit User show service type checkboxes when role is estimator
- **create-user Edge Function**: Accepts optional `service_type_ids` when creating estimators
- **Materials & Bids pages**: Filter service type tabs/selector to only show allowed types for restricted estimators

**User Flow**:
1. Dev creates or edits an estimator in Settings
2. When role is estimator, service type checkboxes appear (Plumbing, Electrical, HVAC)
3. Leave all unchecked = estimator sees all types (default)
4. Check specific types = estimator sees only those (e.g., Electrical only)
5. Restricted estimator sees only their allowed tabs in Bids and Materials

---

## Latest Updates (v2.29)

### Bids System: Price/Labor Book Enhancements and Fixed Price Feature

**Date**: 2026-02-10

**Overview**:
Enhanced the Price and Labor book entry workflows with plain text autocomplete input, automatic fixture type creation, and added a fixed price feature for flat-rate pricing in the Pricing tab. Improved Cost Estimate print output with PO summaries and split cost columns.

#### 1. Plain Text Fixture Input with Auto-Creation

**Problem**: 
- Pricing and Labor book entry modals used strict dropdowns for fixture types
- Users couldn't add entries for fixtures not already in the system
- Save button failed silently when typed names didn't match exactly

**Solution**:
- Replaced `<select>` dropdowns with `<input>` + `<datalist>` combobox
- Users can now type freely or select from autocomplete suggestions
- New fixture types are automatically created when custom names are entered
- Added error display in modals for better feedback

**Implementation**:
- Created `getOrCreateFixtureTypeId()` helper function
- Automatically assigns new fixtures to "Other" category
- Reloads fixture types after creation so suggestions update immediately
- Applied to both Pricing and Labor entry modals

**User Flow**:
1. User opens "Add entry" modal in Pricing or Labor tabs
2. Types fixture name (e.g., "Water Softener")
3. If not in system, autocomplete shows existing similar fixtures
4. On save, new fixture type is created automatically
5. All future users see the new fixture in suggestions

#### 2. Fixed Price Checkbox in Pricing Tab

**Problem**:
Revenue calculations always multiplied price book entry by count, which doesn't work for flat-rate items (e.g., permits, delivery fees, one-time charges).

**Solution**:
Added "Fixed" checkbox next to each pricing assignment that bypasses count multiplication.

**Database Changes**:
```sql
-- Migration: 20260210193624_add_fixed_price_to_pricing_assignments.sql
ALTER TABLE public.bid_pricing_assignments
ADD COLUMN is_fixed_price BOOLEAN NOT NULL DEFAULT false;
```

**Behavior**:
- **Unchecked (default)**: `Revenue = Price × Count`
- **Checked**: `Revenue = Price` (ignores count)

**Implementation Details**:
- Added `togglePricingAssignmentFixedPrice()` function
- Updated revenue calculations in 5 locations:
  - Main pricing table display
  - Single price book print
  - All price books print
  - Cover letter revenue calculation (2 locations)
- Checkbox appears inline with assignment input field

**UI Layout**:
```
[Search or assign...] [☑ Fixed] [×]
```

#### 3. Cost Estimate Print Improvements

**A. PO Summaries in Print View**

**Enhancement**: When printing Cost Estimate, each PO stage (Rough In, Top Out, Trim Set) now displays a detailed summary table showing:
- Part name
- Quantity (formatted with commas for 1,000+)
- Price per unit (formatted with commas)
- Line total (formatted with commas)
- PO subtotal

**Implementation**:
- Made `printCostEstimatePage()` async to load PO items
- Created `loadPOItems()` helper to fetch from `purchase_order_items`
- Created `generatePOSummary()` to render HTML table
- Applied `toLocaleString()` formatting for all numbers

**B. Split Cost Columns in Pricing Print**

**Enhancement**: Pricing tab print view now shows separate "Our Labor" and "Our Materials" columns instead of combined "Our cost".

**Before**:
| Fixture | Count | Entry | Our cost | Revenue | Margin % |
|---------|-------|-------|----------|---------|----------|
| Toilet  | 5     | Toilet| $2,000   | $2,500  | 20.0%    |

**After**:
| Fixture | Count | Entry | Our Labor | Our Materials | Revenue | Margin % |
|---------|-------|-------|-----------|---------------|---------|----------|
| Toilet  | 5     | Toilet| $1,250    | $750          | $2,500  | 20.0%    |

**Benefits**:
- Clear visibility into labor vs materials costs per fixture
- Separate totals row for each cost type
- Better cost analysis and margin understanding

#### 4. Cost Estimate UI Improvements

**Changes**:
- Centered "Materials" and "Labor" section headings in print view
- Centered Save button at bottom of Cost Estimate tab
- Changed "Grand total:" to "Our total cost is:" in print summary

#### 5. Settings Documentation Update

Updated Fixture Types description to reflect:
- Distinction from Part Types (Materials)
- Auto-creation capability
- Examples of fixture types (Toilet, Sink, Water Heater)
- Clarified usage across Bids and book systems

#### 6. Bug Fixes

**Issue**: Pricing assignment input showed blank after selecting entry
**Fix**: Updated value logic to check for `undefined` instead of using nullish coalescing, properly delete search state keys

#### Summary of Changes

**Database**:
- `bid_pricing_assignments.is_fixed_price` column added
- Index on `is_fixed_price` for query performance

**Frontend** (`Bids.tsx`):
- `getOrCreateFixtureTypeId()` helper function
- Replaced fixture dropdowns with text input + datalist (2 modals)
- `togglePricingAssignmentFixedPrice()` function
- Updated revenue calculations (5 locations)
- Made `printCostEstimatePage()` async with PO summaries
- Split cost columns in pricing prints (2 functions)
- Fixed pricing assignment display bug
- Centered UI elements in print views

**Settings** (`Settings.tsx`):
- Updated Fixture Types description

**Files Modified**:
- `pipetooling.github.io/src/pages/Bids.tsx`
- `pipetooling.github.io/src/pages/Settings.tsx`
- `pipetooling.github.io/supabase/migrations/20260210193624_add_fixed_price_to_pricing_assignments.sql` (new)

**User Benefits**:
- Faster data entry with autocomplete
- No more blocked workflows from missing fixtures
- Flexible pricing for flat-rate vs per-unit items
- Better cost visibility in reports
- More accurate revenue calculations

---

## Latest Updates (v2.36)

**Date**: February 13, 2026

### Assembly Types System

Added comprehensive assembly type categorization system for material assemblies/templates.

**Database Changes**:
- Created `assembly_types` table with service-type-specific categorization
- Structure mirrors `part_types`: `id`, `service_type_id`, `name`, `category`, `sequence_order`
- Added `assembly_type_id` column to `material_templates` (nullable, ON DELETE SET NULL)
- Unique constraint on `(service_type_id, name)` per assembly type
- RLS policies for authenticated viewing and authorized management
- Seeded initial assembly types for Plumbing: Bathroom, Kitchen, Utility, Commercial, Residential, Other

**Settings Page Enhancements**:
- Added "Material Assembly Types" section (dev-only)
- Service type selector for managing types per service
- CRUD operations: Create, Edit, Delete, Reorder (up/down arrows)
- Assembly count badges showing usage per type
- "Remove All Unused Assembly Types" bulk action
- Form modal for adding/editing assembly types

**Materials Page Enhancements**:
- Assembly type filter dropdown in Assemblies section
- Search now includes assembly type names
- Assembly type field in Add/Edit Assembly modal
- Templates can be categorized and filtered by type

### Assembly Book Tab

Added new dedicated "Assembly Book" tab in Materials for focused assembly management.

**Tab Navigation**:
- New tab positioned between "Price Book" and "Assemblies & Purchase Orders"
- Clear separation: Assembly Book for building/checking assemblies, Assemblies & POs for creating purchase orders

**Assembly List View**:
- Filter by assembly type dropdown
- Search by name, description, or type
- Each assembly card displays:
  - Assembly name and description
  - Assembly type badge (blue)
  - Pricing status badge:
    - Green "All Priced" - All parts have prices
    - Yellow "X Missing" - Some parts missing prices
    - Red "No Prices" - No parts have prices
    - Gray "Empty" - No parts in assembly
  - Part count and nested assembly count
  - Total estimated cost
  - Edit button
- Click assembly to view details

**Assembly Details Panel**:
- Appears on right when assembly selected
- Assembly name, description, and type displayed at top

**Parts Section**:
- Lists all parts in assembly with:
  - Part name, manufacturer, and part type
  - Quantity in assembly with inline edit capability
  - Current price (lowest available from all supply houses)
  - Line total (quantity × price)
  - Price per unit
- Click any part to expand details showing:
  - Quantity editor: View and edit quantity in assembly
  - All prices at different supply houses (sorted low to high)
  - "LOWEST" badge on cheapest option
  - "Edit Prices" button (green) - Opens price management
  - "Edit Part" button (blue) - Opens part editor
- Missing price warnings highlighted in red

**Nested Assemblies Section**:
- Lists nested assemblies with:
  - Assembly name
  - Quantity
  - Recursive part counts
  - Calculated cost (includes all nested parts)
- Blue background to distinguish from direct parts

**Cost Summary**:
- Direct parts subtotal
- Nested assemblies subtotal (if any)
- Grand total estimated cost (green, bold)
- Warning badge if any prices missing

**Cost Calculation**:
- Recursive calculation through nested assemblies
- Uses lowest available price per part
- Accounts for quantities at all levels
- Prevents infinite recursion with visited tracking

**Quick Actions**:
- "View Price Book" button to jump to pricing tab

---

## Latest Updates (v2.35)

### Service-Type-Specific Book Systems

**Date**: 2026-02-10

**Overview**:
Made price books, labor books, and takeoff books service-type-specific so each trade (Plumbing, Electrical, HVAC) has completely separate book libraries.

**Features**:
- Each service type now has its own isolated set of books
- Switching service types shows only that type's books
- Creating new book versions automatically tags them with the current service type
- All existing books (4 price books, 1 labor book, 1 takeoff book) migrated to Plumbing
- Electrical and HVAC start with empty book lists for clean setup

**Database Changes**:
- Added `service_type_id` (UUID, NOT NULL, FK to service_types) to:
  - `price_book_versions`
  - `labor_book_versions`
  - `takeoff_book_versions`
- All existing books automatically assigned to Plumbing service type
- Foreign key with CASCADE for data integrity
- Indexes added for performance

**Frontend Changes**:
- Load functions filter by `selectedServiceTypeId`:
  - `loadPriceBookVersions()`
  - `loadLaborBookVersions()`
  - `loadTakeoffBookVersions()`
- Create functions include `service_type_id` in INSERT
- Books automatically reload when switching service types
- Empty states for Electrical/HVAC until books are created

**Files Modified**:
- `src/pages/Bids.tsx` - Book filtering, creation, and reload logic
- `src/types/database.ts` - Type regeneration with service_type_id

**Migration File**:
- `supabase/migrations/20260210_add_service_type_to_book_versions.sql`

### Service-Type-Specific Google Docs Templates

**Date**: 2026-02-10

**Overview**:
Cover Letter "Open in Google Docs" button now uses different proposal templates based on the bid's service type.

**Features**:
- Electrical bids open Electrical proposal template
- Plumbing bids open Plumbing proposal template
- HVAC bids open Plumbing template (until HVAC template available)
- Document title format: `ClickProposal_YYMMDD_ProjectName`

**Template URLs**:
- Plumbing: `1Xs76a1fAZfj4GGyIQ-wH_x98rtjnfoB7RVt7cMBmPP8`
- Electrical: `1WO7egdTaavsl3YABBc7cR9va-IwmF9PTdIubxDw7ips`
- HVAC: Uses Plumbing template (TODO: update when available)

**Implementation**:
- Dynamically selects template ID based on `bid.service_type_id`
- Looks up service type name from `serviceTypes` state
- Falls back to Plumbing template if service type not found

**Files Modified**:
- `src/pages/Bids.tsx` - Google Docs URL generation (line ~7702)

### Assistant Access to Estimators

**Date**: 2026-02-10

**Overview**:
Added RLS policy allowing assistants to see estimator users in the Bids estimator and account manager dropdowns.

**Problem Fixed**:
- Previously, assistants couldn't see estimator users (like "Bryan")
- RLS policies only allowed viewing own user, assistants, and adopted masters
- Estimators were blocked from all user queries

**Solution**:
- Added new RLS policy: "Users can see all estimators"
- Allows any authenticated user to SELECT users where `role = 'estimator'`
- Follows same pattern as existing "Masters and devs can see all assistants" policy

**Database Changes**:
- New RLS policy on `public.users` table
- Read-only access (SELECT only)
- Authenticated users only

**Impact**:
- Assistants can now see and assign estimators to bids
- Estimators visible in both "Estimator" and "Account Man" dropdowns
- Enables proper bid assignment workflow for all user roles

**Migration File**:
- `supabase/migrations/20260210_allow_users_to_see_estimators.sql`

### Bug Fixes

**Materials Service Type Switching**:
- Fixed race condition where switching service types would show parts from the previous type
- Root cause: `loadParts()` and `loadAllParts()` captured stale `selectedServiceTypeId` from closure
- Solution: Pass service type ID as explicit parameter to avoid closure capture
- Now correctly filters parts immediately when switching between Plumbing/Electrical/HVAC

**Bids Count Rows Invalid Join**:
- Fixed 5 queries attempting to join `bids_count_rows` with `fixture_types`
- These joins were invalid after reverting count rows to free text
- Removed `fixture_types(name)` joins from count row queries
- Affected: Counts tab, Takeoff tab, Cost Estimate tab, Pricing tab, Submission & Followup

**Price Book Entries Invalid Column**:
- Fixed queries attempting to order by non-existent `fixture_name` column
- `price_book_entries` now use `fixture_type_id` FK (no text column)
- Removed invalid `.order('fixture_name')` clauses
- Now orders only by `sequence_order`

**Part Type Update Refresh**:
- Fixed issue where updating a part's part type didn't show immediately
- PartFormModal now includes `part_types(*)` join when fetching updated part
- UI updates immediately without requiring page refresh

**Files Modified**:
- `src/pages/Materials.tsx` - Service type switching fix
- `src/pages/Bids.tsx` - Count row joins, price book ordering
- `src/components/PartFormModal.tsx` - Part type join on update

---

## Latest Updates (v2.28)

### Part Types vs Fixture Types: Complete Domain Separation

**Date**: 2026-02-10

**Overview**:
Major architectural refactor splitting the overloaded "Fixture Type" concept into two distinct domains: Part Types (for Materials) and Fixture Types (for Bids/Books). This resolves semantic confusion and properly separates material catalog management from bid estimation workflows.

#### The Problem

The original implementation used "Fixture Type" for two unrelated purposes:
1. **Materials Price Book**: Categorizing parts like pipes, fittings, valves (should be "Part Type")
2. **Bids/Books**: Categorizing installed fixtures like toilets, sinks for labor/pricing calculations

This caused confusion and data model issues where plumbing supply parts were being treated as installed fixtures.

#### The Solution

**Created separate tables and workflows:**

1. **Part Types** (`part_types` table) - for Materials system
   - Used in Materials Price Book to categorize material parts
   - Examples: Pipe, Fitting, Valve, Coupling, Adapter
   - Foreign key: `material_parts.part_type_id`
   - Management: Settings page, Part Types section (appears first)

2. **Fixture Types** (`fixture_types` table) - for Bids/Books system
   - Used in Labor Books and Price Books for calculations
   - Examples: Toilet, Sink, Tub, Water Heater, Faucet
   - Foreign keys: `labor_book_entries.fixture_type_id`, `price_book_entries.fixture_type_id`
   - Management: Settings page, Fixture Types section (appears second)
   - Count rows usage: Count rows (`bids_count_rows`) use free text `fixture` field for flexibility

#### Database Changes

**New Tables**:
- `part_types` - Service-type-specific part categorization for materials

**Migrations**:
1. `20260210122816_create_part_types.sql` - Creates `part_types` table, copies Plumbing data from `fixture_types`
2. `20260210122817_add_part_type_id_to_material_parts.sql` - Adds `part_type_id` FK to `material_parts`, backfills data
3. `20260210122818_remove_fixture_type_from_material_parts.sql` - Removes old `fixture_type_id` from `material_parts`
4. `20260210_revert_count_rows_to_text.sql` - Reverts `bids_count_rows` from FK to free text

**Schema Summary**:
- `material_parts.part_type_id` → `part_types.id` (FK)
- `labor_book_entries.fixture_type_id` → `fixture_types.id` (FK)
- `price_book_entries.fixture_type_id` → `fixture_types.id` (FK)
- `bids_count_rows.fixture` (TEXT, not FK - free text for flexibility)

#### Frontend Refactor (47 TypeScript Errors Fixed)

**Comprehensive code updates across 8 files:**

1. **Materials.tsx** (5 errors fixed)
   - Renamed all `fixtureType` references to `partType`
   - Updated queries to use `part_types` table
   - Changed display logic to show `part_type?.name`
   - Added validation for required `part_type_id`
   - Fixed initial page load issue (added `loadParts(0)` to service type change effect)

2. **Bids.tsx** (36+ errors fixed)
   - Created extended types with joined fixture data: `LaborBookEntryWithFixture`, `PriceBookEntryWithFixture`
   - Added `fixture_types(name)` joins to all labor/price book queries
   - Updated all display logic to use `fixture_types?.name ?? ''`
   - Converted INSERT/UPDATE to use `fixture_type_id` with name lookup helper
   - Reverted count rows to use free text `fixture` field
   - Added `service_type_id` to material template and bid inserts
   - Added `loadFixtureTypes()` function and state management

3. **Settings.tsx** (4 errors fixed)
   - Duplicated fixture type management UI for part types
   - Added part count display and cleanup feature
   - Added fixture type usage counts (labor, price, count rows)
   - Fixed undefined checks in count badges
   - Reordered sections: Part Types first, Fixture Types second
   - Updated count row matching to use free text name matching

4. **Other Files** (7 errors fixed)
   - CustomerForm/NewCustomerForm: Fixed `master_user_id` null handling
   - Dashboard/Workflow: Added null coalescing for boolean fields

#### Key Technical Decisions

1. **Count Rows Stay Free Text**: 
   - `bids_count_rows.fixture` remains TEXT (not FK) for flexibility
   - Users can enter any text, not restricted to fixture types
   - Settings counts match by name for display purposes only

2. **Books Use Structured FKs**:
   - Labor and Price books need structured data for calculations
   - Forms now use fixture type lookup by name
   - Validation ensures fixture type exists before saving

3. **Helper Function Pattern**:
   - Added `getFixtureTypeIdByName()` for name-to-ID lookups
   - Preserves text-based UI while using structured database

#### Benefits

- Clear semantic separation between Materials and Bids domains
- Better data integrity with proper foreign keys
- Flexible count rows for field notes
- Structured books for reliable calculations
- Settings UI properly organized by domain
- All TypeScript errors resolved

#### Build Verification

```
npm run build
✓ built in 1.54s
```

All 47 TypeScript errors resolved and production build succeeds.

#### Files Modified (8)

- `src/pages/Materials.tsx` - Part type refactor, initial load fix
- `src/pages/Bids.tsx` - Count rows revert, fixture type joins, inserts
- `src/pages/Settings.tsx` - Dual management UI, count badges, reordering
- `src/components/NewCustomerForm.tsx` - Null handling
- `src/pages/CustomerForm.tsx` - Null handling
- `src/pages/Dashboard.tsx` - Boolean null coalescing
- `src/pages/Workflow.tsx` - Boolean null coalescing
- `src/types/database.ts` - Regenerated types

#### Migration Files (4)

- `supabase/migrations/20260210122816_create_part_types.sql`
- `supabase/migrations/20260210122817_add_part_type_id_to_material_parts.sql`
- `supabase/migrations/20260210122818_remove_fixture_type_from_material_parts.sql`
- `supabase/migrations/20260210_revert_count_rows_to_text.sql`

#### Updated Documentation

- `GLOSSARY.md` - Updated Fixture, Part Type, Count Row, Labor Book, and Price Book definitions

---

## Latest Updates (v2.27)

### Service Type System

**Date**: 2026-02-10

**Overview**:
Implemented comprehensive Service Type system for categorizing materials (parts, templates, purchase orders) and bids by trade type (Plumbing, Electrical, HVAC), with filtering UI in both Materials and Bids sections.

**Features**:
- Three initial service types: Plumbing, Electrical, HVAC
- Dev-only management interface in Settings for adding/editing/reordering service types
- Filter buttons above tabs in `/materials` to show only items of selected type
- Filter buttons above tabs in `/bids` to show only bids of selected type
- All existing data automatically assigned to Plumbing service type
- Service type displayed when adding new parts in Materials
- Service type required field for all new bids and materials
- Color-coded service type buttons for visual distinction

**UI Components**:
- Materials: Service type filter buttons above Price Book, Templates, and PO tabs
- Bids: Service type filter buttons above all bid tabs
- Settings: Service Types management section (dev-only)

**Database**:
- New table: `service_types` (id, name, description, color, sequence_order)
- New columns: `service_type_id` added to `material_parts`, `material_templates`, `purchase_orders`, `bids`
- RLS: Dev-only write access, all authenticated read access

**Bug Fix**: Fixed stale data issue where switching service types in Materials would briefly show parts from previous type

**Files Modified**:
- `src/pages/Materials.tsx`: Service type filtering and UI
- `src/pages/Bids.tsx`: Service type filtering and UI
- `src/pages/Settings.tsx`: Service type management (CRUD operations)

### Followup Sheet Print and PDF

**Date**: 2026-02-09

**Overview**:
Added print preview and downloadable PDF functionality for account manager follow-up sheets in Submission & Followup tab.

**Features**:
- Dropdown to select specific account manager or "ALL" or "UNASSIGNED"
- Print button opens printable preview window (similar to Pricing tab)
- PDF button downloads formatted PDF with clickable phone numbers and emails
- Shows projects grouped by status: "Not Yet Won or Lost" and "Won"
- Includes complete project details, builder information, and latest 3 submission entries
- Phone numbers are clickable (tel: links) in PDF for mobile devices
- Emails are clickable (mailto: links) for quick composition

**UI Location**:
Located within Submission & Followup tab, above the search bar

**Print Format**:
- Project name and address
- Builder Phone (clickable in PDF)
- Builder Address
- Builder Email (clickable in PDF)
- Project Contact name, phone, email
- Win/Loss status, Bid Date, Sent Date, Design Drawing Date
- Bid Value, Agreed Value, Distance to Office, Notes
- Latest 3 submission entries with contact method, notes, timestamp
- Builder details indented 10 spaces for visual separation

**Technical Implementation**:
- `printFollowupSheet()`: Opens print preview window with HTML generation
- `downloadFollowupSheetPdf()`: Generates downloadable PDF using jsPDF library
- Filters bids by account manager and status
- Fetches latest 3 submission entries per project
- Formats contact information with clickable links

**Files Modified**:
- `src/pages/Bids.tsx`: Print/PDF functions and UI controls

### Bid Board Display Improvements

**Date**: 2026-02-09

**Overview**:
Improved bid date display formatting in Bid Board for better readability.

**Changes**:
- Bid Date and Sent Date now display on two separate lines
- Format: "02/06" on first line, "[+4]" (days ago) on second line
- Previous format was single line: "02/06 [+4]"

**Implementation**:
- Added `formatDateYYMMDDParts()` helper function to split date and days-ago into separate strings
- Updated Bid Board table cells to render dates vertically

**Files Modified**:
- `src/pages/Bids.tsx`: Date formatting in Bid Board table

---

## Latest Updates (v2.25)

### Cost Estimate: Driving Cost Calculation and Labor Book Improvements

**Date**: 2026-02-06

**Overview**:
Enhanced the Cost Estimate tab with automated driving cost calculations based on total man-hours and distance to office, plus improved labor book application workflow.

#### Driving Cost Calculation

**Feature**: Automatic calculation of driving costs based on job parameters.

**How It Works**:
- Formula: (Total Man Hours / Hours Per Trip) × Rate Per Mile × Distance to Office
- Example: 40 hrs / 2 hrs/trip × $0.70/mi × 50 miles = $700

**Features**:
- Editable rate per mile (default: $0.70)
- Editable hours per trip (default: 2.0 hours)
- Displays distance to office from bid data
- "Edit Bid" button for quick distance updates
- Automatically included in labor total and grand total
- Appears in Summary section and PDF exports

**UI Location**:
Yellow-highlighted "Driving Cost Parameters" section appears after the labor hours table in Cost Estimate tab.

**Database**:
- Added `driving_cost_rate` column to `cost_estimates` table
- Added `hours_per_trip` column to `cost_estimates` table
- Migration: `add_cost_estimate_driving_cost_fields.sql`

**Technical Details**:
- Values persist per cost estimate
- Updates save to database with other cost estimate changes
- PDF export includes driving cost breakdown
- Submission preview calculations include driving cost in margins

#### Labor Book Application Improvements

**Enhancement**: Streamlined workflow for applying labor book templates to cost estimates.

**Features**:
- "Apply matching Labor Hours" button moved to top-right header (next to Print button)
- Auto-selects first labor book version when opening Cost Estimate tab
- One-click application (no confirmation dialogs)
- Blue button styling matches "Apply matching Fixture Templates" pattern
- Success message appears inline next to button
- Button only visible when labor book is selected

**Smart Matching**:
- Only updates fixtures that match entries in the selected labor book
- Non-matching fixtures preserve their existing hours or fall back to system defaults
- Uses fixture name and alias name matching (case-insensitive)

**Fallback Logic**:
When creating new labor rows:
1. First attempts to use hours from selected labor book
2. Falls back to `fixture_labor_defaults` table for non-matching fixtures
3. Defaults to 0 only if fixture exists in neither source

**Impact**:
- Faster workflow - button always visible and ready to use
- Consistent UX - matches takeoffs tab pattern
- Safer - preserves non-matching fixture hours
- Better discoverability - prominent header placement

#### Pricing Tab: Searchable Price Book Features

**Enhancement**: Added search functionality to price book entries and assignments for faster navigation and entry creation.

**Features Added**:

##### 1. Price Book Entries Search

**Location**: Pricing tab, price book management section (below price book dropdown)

**Features**:
- Search input field filters price book entries in real-time by fixture/tie-in name
- Case-insensitive matching
- Table updates instantly as you type
- When no matches found, displays "No entries match '{search term}'" message
- "Add to Price Book" button appears when no matches exist
- Clicking the button opens the entry form modal with fixture name pre-filled

**Usage Example**:
1. Select a price book
2. Type "toilet" in search - only "Toilet", "Toilet ADA", etc. appear
3. Type "bidet" (if not in price book) - "Add 'bidet' to Price Book" button appears
4. Click button - form opens with "bidet" already filled in

##### 2. Searchable Assignment Dropdowns

**Location**: Pricing tab, fixture assignment table (when comparing costs to price book)

**Old Behavior**: Standard dropdown requiring scrolling through all entries

**New Behavior**: Searchable input field with dropdown results

**Features**:
- Click input field to open dropdown showing all price book entries
- Type to filter entries in real-time
- Matching entries appear in dropdown below input
- Click entry to assign it to the fixture
- When assigned, entry name displays in input field
- Clear button (×) appears to remove assignment
- Dropdown closes when clicking outside

**No Matches Flow**:
- Type fixture name that doesn't exist in price book
- Shows "No matches for '{search term}'" message
- "Add '{search term}' to Price Book" button appears in dropdown
- Click button to open entry form with name pre-filled
- After saving new entry, can immediately assign it

**Technical Implementation**:
- Per-row search state tracking
- Click-outside handler to close dropdowns
- Real-time filtering with case-insensitive matching
- Hover effects on dropdown items
- Disabled state support during save operations

**Benefits**:
- Faster assignment workflow - no scrolling through long lists
- Quick creation of missing entries without leaving the assignment flow
- Consistent search experience across price book management and assignments
- Reduced errors from similar fixture names
- Better UX for price books with many entries

**Usage Tips**:
- Start typing immediately when field is focused
- Use clear button (×) to quickly reassign a fixture
- Create new entries on-the-fly when needed
- Dropdown shows all entries when field is empty

---

## Latest Updates (v2.25)

### Cost Estimate: Driving Cost Calculation and Labor Book Improvements

**Date**: 2026-02-06

**Overview**:
Enhanced the Cost Estimate tab with automated driving cost calculations and streamlined labor book application workflow.

#### Driving Cost Calculation

**Feature**: Automatic calculation of driving costs based on job parameters and editable cost factors.

**How It Works**:
- **Formula**: (Total Man Hours ÷ Hours Per Trip) × Rate Per Mile × Distance to Office
- **Example**: 40 hrs ÷ 2 hrs/trip × $0.70/mi × 50 miles = $700 driving cost

**Editable Parameters**:
- **Rate per mile**: Default $0.70, adjustable per estimate
- **Hours per trip**: Default 2.0 hours, adjustable per estimate
- Parameters persist with the cost estimate when saved

**UI Features**:
- Yellow-highlighted "Driving Cost Parameters" section after labor table
- Displays current distance to office from bid data
- "Edit Bid" button for quick access to update distance
- Real-time calculation display showing trips, rate, distance, and total cost
- Shows "Distance to office: Not set" when no distance is configured

**Summary Integration**:
- Driving cost appears as separate line item in Summary section
- Included in "Labor total" (Labor + Driving)
- Incorporated into Grand total calculation
- Format: `Driving: $700.00` (always visible, shows $0.00 if no distance)

**PDF Export**:
- Driving cost calculation included in Cost Estimate PDF
- Shows breakdown: "Driving cost: 20.0 trips × $0.70/mi × 50mi = $700.00"
- Appears in summary table with Labor and Materials totals
- Included in Submission & Followup preview calculations for margin analysis

**Database Changes**:
- Table: `cost_estimates`
- New columns: `driving_cost_rate` (NUMERIC(10,2), default 0.70), `hours_per_trip` (NUMERIC(10,2), default 2.0)
- Migration file: `supabase/archive/add_cost_estimate_driving_cost_fields.sql`

#### Labor Book Application Workflow

**Enhancement**: Streamlined labor book template application with better visibility and user experience.

**Button Placement**:
- Moved to top-right header next to Print button (previously below labor rate input)
- Renamed to "Apply matching Labor Hours" for consistency with Takeoffs tab
- Blue styling matching "Apply matching Fixture Templates" pattern
- Compact size (0.35rem × 0.75rem padding)

**Auto-Selection**:
- First labor book version automatically selected when opening Cost Estimate tab
- Preserves any previously saved labor book selection for the bid
- Button immediately clickable without manual selection

**Simplified Workflow**:
- One-click operation (no confirmation dialogs)
- Success message appears inline next to button
- Shows "Applying..." state while processing
- Green success message displays for 3 seconds after completion

**Smart Matching Behavior**:
- Only updates fixtures that exist in the selected labor book
- Matches by fixture name and alias names (case-insensitive)
- Non-matching fixtures remain unchanged

**Fallback Logic for New Fixtures**:
When adding new fixtures to cost estimate:
1. Uses hours from selected labor book if fixture matches
2. Falls back to `fixture_labor_defaults` table for non-matching fixtures (e.g., Toilet: 1/1/1 hrs)
3. Defaults to 0 only if fixture not found in either source

**Technical Details**:
- Function: `applyLaborBookHoursToEstimate()` (line 2005)
- Sync function: `loadCostEstimateLaborRowsAndSync()` (line 1082)
- Auto-selection logic in Cost Estimate tab useEffect (line 3326)
- Button only visible when labor rows exist and labor book is selected

**Benefits**:
- More discoverable - prominent header placement
- Faster workflow - auto-selection and one-click application
- Consistent UX - matches patterns from other tabs
- Safer - preserves non-matching fixture hours using fallback defaults
- Better visibility - success feedback right at the button

---

## Latest Updates (v2.24)

### Materials Price Book: Performance, Search, and Bulk Editing Enhancements

**Date**: 2026-02-05

**Overview**:
Major performance improvements and workflow enhancements for the Materials Price Book, including server-side search across all parts, infinite scroll, "Load All" mode for bulk editing, and comprehensive supply house statistics.

#### Supply House Statistics in Modal

**Enhancement**: Global materials statistics now appear at the top of the Supply Houses modal.

**Features**:
- Total parts count across entire database
- Percentage of parts with prices
- Percentage of parts with multiple prices
- Per-supply-house price coverage sorted by count (highest first)
- Stats refresh automatically every time the modal is opened

**Benefits**:
- Quick visibility into pricing coverage across all supply houses
- Identify which supply houses need more pricing data
- See comprehensive stats without leaving supply house management

**Database**:
- New SQL function: `get_supply_house_price_counts()` 
- Efficiently counts prices per supply house using LEFT JOIN
- Returns all supply houses including those with 0 prices
- Migration: `create_supply_house_stats_function.sql`

---

#### Server-Side Search Across All Parts

**Enhancement**: Search box now queries the entire database, not just the current page.

**How It Works**:
- Search queries filter parts server-side using Supabase `.ilike` (case-insensitive)
- 300ms debounce prevents excessive queries while typing
- Searches across name, manufacturer, fixture type, and notes fields
- Pagination continues to work with filtered results
- Fixture type and manufacturer filters also work server-side

**Benefits**:
- Find any part in the database instantly
- No need to paginate through pages to find a specific part
- Efficient database queries instead of loading everything

**Technical Details**:
- Modified `loadParts()` to accept search/filter options
- Applies filters before pagination with `.or()` query
- Debounced `useEffect` triggers reload on search/filter changes

---

#### Infinite Scroll Pagination

**Enhancement**: Parts automatically load as you scroll to the bottom of the page.

**Features**:
- Loads next 50 parts when within 200px of page bottom
- Shows loading indicator: "Loading more parts…" or "Scroll down to load more"
- Prevents duplicate requests when scrolling quickly
- Only active on Price Book tab
- Respects current search and filter state

**Benefits**:
- No manual button clicking needed
- Seamless browsing experience
- Faster navigation through large part lists

**Technical Details**:
- Window scroll event listener with distance calculation
- `loadingPartsRef` prevents race conditions
- Automatically disabled in "Load All" mode

---

#### Server-Side Sorting by Price Count

**Enhancement**: Clicking the "#" column header now sorts all parts in the database by price count.

**How It Works**:
- Database function counts and sorts all parts by price count
- Returns ordered part IDs to frontend
- Frontend fetches only the needed page of parts in correct order
- Maintains pagination while ensuring global sort order

**Benefits**:
- See which parts need pricing across entire database
- Quickly identify parts with 0 prices
- Efficient sorting without loading all data client-side

**Database**:
- New SQL function: `get_parts_ordered_by_price_count(ascending_order)`
- Uses LEFT JOIN and COUNT aggregation
- Migration: `create_parts_with_price_count_function.sql`

**Technical Details**:
- When sorting is active, uses RPC to get ordered part IDs
- Fetches parts by ID for current page
- Maintains sort order from database

---

#### "Load All" Mode for Bulk Editing

**Enhancement**: New toggle mode that loads all parts at once with instant client-side search.

**Features**:
- **Toggle button**: Speed icon (triangle SVG) next to filter dropdowns
- **Progressive loading**: Shows "Loading all parts... (X loaded)" with count
- **Instant search**: Client-side filtering with no network delay
- **Client-side sorting**: Click "#" to sort all loaded parts immediately
- **Visual indicators**: 
  - Button turns blue when active
  - Search box background turns light blue
  - Search placeholder changes to "Search all parts (instant)..."
- **Default mode**: Load All mode is enabled by default for optimal bulk editing workflow

**How It Works**:
- Fetches all parts from database in batches of 50
- Loads prices for each part progressively
- Stores all parts in `allParts` state array
- Search and sort happen client-side (instant)
- Toggle button switches between Load All and paginated modes

**Benefits**:
- Perfect for assistants doing bulk price updates
- Instant search across all parts (no waiting)
- No pagination interruption when editing multiple parts
- Fast sorting without server calls
- Can still toggle to paginated mode if needed

**Technical Details**:
- `loadAllParts()` function with batched loading
- Separate `clientSearchQuery` state for instant filtering
- `displayParts` computed with client-side filtering and sorting
- Fixture type/manufacturer filters disabled in Load All mode
- Infinite scroll automatically disabled in Load All mode

**Dependencies**:
- Installed `@tanstack/react-virtual` (available for future virtual scrolling optimization)

---

#### Summary of Changes

**Migrations Created (2)**:
1. `create_supply_house_stats_function.sql` - Supply house price counting and sorting
2. `create_parts_with_price_count_function.sql` - Parts sorting by price count

**Code Files Modified (2)**:
1. `src/pages/Materials.tsx` - All performance and UX enhancements
2. `src/pages/Bids.tsx` - Fixed TypeScript null checks in `formatAddressWithoutZip()`

**Key Functions Added/Modified**:
1. `loadGlobalPriceBookStats()` - Uses RPC for accurate supply house counts
2. `loadParts()` - Accepts search/filter/sort options, applies server-side
3. `loadAllParts()` - Loads all parts in batches with progress indicator
4. `openSupplyHousesModal()` - Refreshes stats when modal opens
5. `displayParts` - Smart calculation for Load All vs paginated mode

**State Variables Added**:
- `loadAllMode` - Tracks bulk editing mode
- `allParts` - Stores all parts when loaded
- `loadingAllParts` - Loading state for bulk load
- `clientSearchQuery` - Separate search for instant filtering
- `loadingPartsRef` - Prevents duplicate pagination requests

**Impact**:
- ✅ Search works across all 1000+ parts in database
- ✅ Infinite scroll eliminates manual "Load more" clicking
- ✅ Sorting by "#" works globally, not just per page
- ✅ Supply house stats show accurate counts for all supply houses
- ✅ "Load All" mode enables rapid bulk editing workflows
- ✅ Fixed bug where supply houses showed 0 prices due to row limits
- ✅ Supply houses sorted by price count (most prices first)
- ✅ All changes work seamlessly together

**Performance Characteristics**:
- Normal mode: Loads 50 parts at a time (fast initial load)
- Load All mode: Loads all parts in 10-30 seconds (instant search after)
- Server-side operations: Efficient database queries with proper indexing
- Client-side operations: Fast filtering/sorting on loaded data

**Backward Compatibility**:
All changes are backward compatible. Users can toggle between paginated and Load All modes at any time.

---

## Latest Updates (v2.23)

### Bids Submissions and Followup UI Improvements

**Date**: 2026-02-04

**Overview**:
Streamlined the Submissions and Followup section of the Bids page with more concise labels and enhanced data display for better readability and quick scanning.

#### Label Updates

**Simplified Column Headers**:
- "Time to/from bid due date" → "Bid Date"
- "Bid Due Date" → "Bid Date" (applied across all bid tables)
- "Time since last contact" → "Last Contact"
- "Estimated Job Start Date" → "Start Date"

**Benefits**:
- More concise headers save space
- Easier to scan at a glance
- Consistent naming across all tables

---

#### Compact Date Formats

**Bid Date Time Display** (Unsent and Pending Follow-up tables):

Changed from verbose text to concise +/- notation:
- **Old format**: "1 day since deadline", "2 days until due", "Due today"
- **New format**: "+1", "-2", "-0"

**Logic**:
- Negative numbers indicate days until deadline (e.g., "-15" means 15 days until bid is due)
- Positive numbers indicate days past deadline (e.g., "+5" means 5 days overdue)
- "-0" indicates due today

**Start Date Display** (Won Bids table):

Shows both the date and countdown/countup:
- **Format**: "MM/DD [±X]"
- **Examples**:
  - "04/15 [-15]" = April 15, starting in 15 days
  - "03/01 [+10]" = March 1, started 10 days ago
  - "02/05 [-0]" = February 5, starting today

**Benefits**:
- Quick visual scanning for urgency
- No mental math required to assess timelines
- Consistent format across both date columns

---

#### Bid Values in Project Names

**Enhancement**: Bid values now display in thousands next to project names across all Submissions and Followup tables.

**Format**: "Project Name (X.X)" where the number represents bid value in thousands

**Examples**:
- Bid value $3,800: "Gibbs Residence Grinder Pump (3.8)"
- Bid value $11,700: "Project Name (11)" ← No decimal for values ≥ $10k
- Bid value $500: "Project Name (0.5)"
- No bid value: "Project Name" (no suffix)

**Smart Decimal Formatting**:
- Values under $10k: Show 1 decimal (e.g., 3.8, 9.5)
- Values $10k and above: No decimal (e.g., 11, 25, 150)

**Benefits**:
- Quickly assess bid size without opening each bid
- Prioritize larger opportunities at a glance
- Cleaner display for large values

---

#### Won Bids Sorting

**Enhancement**: Won bids are now automatically sorted by start date in ascending order.

**Behavior**:
- Jobs starting soonest appear at the top
- Jobs further out appear below
- Jobs without start dates appear at the end

**Benefits**:
- Easy to identify which won projects need immediate attention
- Better scheduling visibility
- Logical ordering for project planning

---

#### Summary of Changes

**Modified Files**:
- `src/pages/Bids.tsx`

**Functions Modified/Created**:
1. `formatTimeSinceDueDate()` - Updated to return "+X" or "-X" format
2. `formatDateYYMMDD()` - Enhanced to show "MM/DD [±X]" with countdown
3. `formatBidNameWithValue()` - New function to append bid value in thousands

**Impact**:
- 9 label updates for consistency
- 3 formatting functions improved
- 5 submission tables enhanced with bid values
- 1 table sorted by relevance

All changes maintain backward compatibility and require no database modifications.

---

## Latest Updates (v2.22)

### Comprehensive Database Layer Improvements

**Date**: 2026-02-04

**Overview**:
Major systematic improvements to the database layer addressing timestamp management, data integrity, transaction handling, and error recovery. These changes make the application more robust, maintainable, and prevent data corruption.

#### 1. Automatic `updated_at` Timestamp Management

**What Changed**:
- Added database triggers to automatically set `updated_at` on all UPDATE operations
- Covers 20 tables: bids, customers, projects, material_parts, purchase_orders, workflow_steps, and 14 others
- Removed 9 manual timestamp sets from frontend code (Settings, Bids, People pages)

**Benefits**:
- Eliminates developer errors and forgotten timestamps
- Ensures consistency across all updates
- Cleaner, more maintainable code
- Automatic and transparent to application code

**Technical Details**:
- Created reusable trigger function `update_updated_at_column()`
- Applied BEFORE UPDATE triggers to all tables with `updated_at` columns
- Migration: `add_updated_at_triggers.sql`

---

#### 2. Cascading Update Triggers

**What Changed**:
- Customer master ownership changes now automatically cascade to all their projects
- Maintains data consistency between customers and projects

**Benefits**:
- No orphaned projects with wrong master assignment
- Automatic synchronization eliminates manual updates
- Prevents data integrity issues

**Technical Details**:
- Trigger function: `cascade_customer_master_to_projects()`
- Automatically updates `project.master_user_id` when `customer.master_user_id` changes
- Migration: `add_cascading_customer_master_to_projects.sql`

---

#### 3. Data Integrity Constraints

**What Changed**:
Added database-level constraints to prevent invalid data:
- **Positive quantities**: Purchase order items must have `quantity > 0`
- **Non-negative counts**: Bid count rows must have `count >= 0`
- **Non-negative prices**: Material prices and PO prices must be `>= 0`
- **Unique parts per template**: Same part cannot be added twice to a template
- **Improved cascading**: Project master user FKs now use `ON DELETE SET NULL`

**Benefits**:
- Prevents data corruption at database level
- Clear error messages for validation failures
- Enforces business rules consistently
- Catches errors before they propagate

**Technical Details**:
- 4 CHECK constraints for validation
- 1 partial unique index on `material_template_items(template_id, part_id)`
- Cleaned up 1 duplicate data entry during migration
- Migration: `add_data_integrity_constraints.sql`

---

#### 4. Atomic Transaction Functions

**What Changed**:
Created 4 database functions for complex multi-step operations with automatic rollback:

**4a. `create_project_with_template`**
- Atomically creates project, workflow, and all steps from template
- All-or-nothing operation - if any step fails, entire operation rolls back
- Parameters: name, customer_id, address, master_user_id, template_id, notes
- Returns: `{project_id, workflow_id, success}`

**4b. `duplicate_purchase_order`**
- Atomically duplicates PO with all items as a draft
- Guaranteed no orphaned PO if item copying fails
- Parameters: source_po_id, created_by
- Returns: `{new_po_id, items_copied, success}`

**4c. `copy_workflow_step`**
- Atomically copies step and updates sequence order
- No gaps or inconsistencies in sequence numbers
- Parameters: step_id, insert_after_sequence
- Returns: `{new_step_id, new_sequence, success}`

**4d. `create_takeoff_entry_with_items`**
- Atomically creates takeoff entry with multiple items
- Parameters: bid_id, page, entry_data, items
- Returns: `{entry_id, items_created, success}`

**Benefits**:
- Guaranteed all-or-nothing operations (no partial data on failures)
- Automatic rollback eliminates cleanup code
- Reduced network round-trips
- Better performance for multi-step operations

**Technical Details**:
- All functions use PL/pgSQL with EXCEPTION handlers
- SECURITY DEFINER to run with proper permissions
- Migration: `create_transaction_functions.sql`

**Usage Example**:
```typescript
// Call from frontend using Supabase RPC
const { data, error } = await supabase.rpc('create_project_with_template', {
  p_name: 'New Project',
  p_customer_id: customerId,
  p_address: '123 Main St',
  p_master_user_id: userId,
  p_template_id: templateId,
  p_notes: 'Project notes'
})
```

---

#### 5. Frontend Error Handling Improvements

**What Changed**:
- Created comprehensive error handling utilities (`src/utils/errorHandling.ts`)
- Improved error handling in ProjectForm and Workflow delete operations
- Added retry logic for transient network/database failures

**New Utilities**:
- `withRetry()`: Automatic retry with exponential backoff
- `withSupabaseRetry()`: Type-safe Supabase operations with retry
- `checkSupabaseError()`: Consistent error checking
- `executeDeleteChain()`: Multi-step delete with proper error handling
- `DatabaseError`: Structured error handling class

**Benefits**:
- Resilient to transient failures
- Clear error messages for users
- Proper error propagation and logging
- Consistent error handling patterns

**Updated Files**:
- `src/pages/ProjectForm.tsx`: Improved delete operation with comprehensive error checking
- `src/pages/Workflow.tsx`: Added proper error handling to step deletion

**Usage Example**:
```typescript
import { withSupabaseRetry } from '@/utils/errorHandling'

// Automatically retries on transient failures
const users = await withSupabaseRetry(
  () => supabase.from('users').select('*'),
  'fetch users',
  { maxRetries: 3, initialDelay: 1000 }
)
```

---

#### 6. TypeScript Type Safety

**What Changed**:
- Created TypeScript interfaces for all database functions
- Added type-safe parameter and return types
- Created helper interface for RPC calls

**New File**: `src/types/database-functions.ts`

**Benefits**:
- Type safety for database function calls
- IntelliSense support in IDE
- Compile-time error detection
- Self-documenting code

**Usage Example**:
```typescript
import type { CreateProjectWithTemplateParams } from '@/types/database-functions'

const params: CreateProjectWithTemplateParams = {
  p_name: 'Project',
  p_customer_id: customerId,
  p_address: '123 Main St',
  p_master_user_id: userId
}
```

---

#### Summary of Changes

**Migrations Created (4)**:
1. `add_updated_at_triggers.sql` - 20 automatic timestamp triggers
2. `add_cascading_customer_master_to_projects.sql` - Cascading customer updates
3. `add_data_integrity_constraints.sql` - 4 constraints + 1 unique index
4. `create_transaction_functions.sql` - 4 atomic transaction functions

**Code Files Created (2)**:
1. `src/utils/errorHandling.ts` - Error handling utilities
2. `src/types/database-functions.ts` - TypeScript types

**Code Files Modified (5)**:
1. `src/pages/ProjectForm.tsx` - Improved error handling
2. `src/pages/Workflow.tsx` - Improved error handling
3. `src/pages/Settings.tsx` - Removed manual timestamps
4. `src/pages/Bids.tsx` - Removed manual timestamps
5. `src/pages/People.tsx` - Removed manual timestamps

**Documentation Created (2)**:
1. `DATABASE_FIXES_TEST_PLAN.md` - Comprehensive test plan
2. `DATABASE_IMPROVEMENTS_SUMMARY.md` - Complete implementation summary

**Impact**:
- ✅ 20 tables with automatic timestamp management
- ✅ 4 new check constraints preventing invalid data
- ✅ 1 unique constraint preventing duplicates
- ✅ 1 cascading trigger maintaining consistency
- ✅ 4 atomic database functions eliminating partial failures
- ✅ Improved error handling preventing silent failures
- ✅ Removed 9 manual timestamp sets
- ✅ Added comprehensive retry logic

**Backward Compatibility**:
All changes are backward compatible. Existing code continues to work unchanged. The new database functions are optional enhancements available for gradual adoption.

---

## Latest Updates (v2.21)

### Materials Price Book: Fixed Missing Prices in Expanded Row

**Date**: 2026-02-04

**Issue**:
- Prices added or updated via the "Edit prices" modal were not appearing in the expanded row details
- Prices would briefly appear after closing the modal, then disappear
- The "Edit prices" modal showed all prices correctly
- Problem affected parts with prices beyond the cheapest 1,000 prices across the entire database

**Root Cause**:
- The `loadParts()` function was loading ALL prices for ALL parts in a single query
- Supabase has a default 1,000-row limit per query
- With 1,241+ total prices in the database, prices beyond row 1,000 were being truncated
- The "Edit prices" modal worked correctly because it filtered by `part_id` first, loading only that specific part's prices

**Solution**:
- Changed `loadParts()` to load prices per-part instead of loading all prices at once
- Uses `Promise.all()` to load prices for each part in parallel
- Each part's query filters by `part_id` first: `.eq('part_id', part.id)`
- Matches the same query pattern used by the working "Edit prices" modal

**Benefits**:
- No row limit issues (each part's prices are loaded separately)
- Consistent behavior between expanded row and modal
- Scales to any number of total prices in the database
- Better performance with parallel loading

**Files modified**:
- `src/pages/Materials.tsx` (lines 194-217) - Changed `loadParts()` from single bulk query to per-part parallel queries
- `src/pages/Settings.tsx` (lines 256, 280) - Fixed TypeScript errors in orphaned prices feature

---

## Latest Updates (v2.20)

### Takeoff Book: Aliases, Multiple Templates/Stages per Entry, Default Version Selection

**Date**: 2026-02-04

**Changes**:

- **Takeoff Book entries – additional names (aliases)**
  - Takeoff Book entries can include optional **additional names** (comma-separated) that match count rows’ **Fixture or Tie-in** (case-insensitive).
  - When applying the Takeoff Book, a count row matches if its Fixture or Tie-in equals the entry’s primary name or any alias.
- **Takeoff Book entries – multiple Templates & Stages per entry**
  - A single Takeoff Book entry (one Fixture or Tie-in + aliases) can now have **multiple (Template, Stage)** pairs.
  - Entry form supports adding/removing multiple Template/Stage rows.
  - Applying the Takeoff Book adds mappings for **each** Template/Stage pair on a matching entry.
- **Takeoff book version default**
  - When a bid has no takeoff book version selected, the Takeoffs tab will default to the version named **“Default”** (and persist that choice to the bid).

**Database**:
- Added `takeoff_book_entries.alias_names` (TEXT[], default `'{}'`).
- Added `takeoff_book_entry_items` (Template/Stage pairs per entry) and migrated existing `takeoff_book_entries.template_id`/`stage` into items; `template_id` and `stage` are now stored on items instead of entries.

**Files modified**:
- `src/pages/Bids.tsx` – Takeoff Book entry form supports alias names and multiple Template/Stage rows; apply logic loads entries + items; default version selection to “Default” when unset.
- `src/types/database.ts` – Updated `takeoff_book_entries`; added `takeoff_book_entry_items`.

**Files added**:
- `supabase/archive/add_takeoff_book_entries_alias_names.sql`
- `supabase/archive/add_takeoff_book_entry_items.sql`

### Materials Price Book improvements

- Price details are now visible inline when you expand a part: you see notes (SKU, etc.), a `$price SupplyHouse` list for all prices, and an **Edit prices** button directly beneath the list.
- The Best Price column hides the “No prices” label when a part has no prices (the cell is blank), making the table easier to scan.
- You can click the `#` column header to sort parts by how many prices they have (fewest first), with a small arrow indicator showing when that sort is active.
- A new **Supply house price coverage** summary at the bottom shows each supply house name and how many prices are defined for it.

### Settings cleanup

- The **Sign out** and **Change password** actions have been moved into the Settings header as buttons, instead of separate boxes.
- The dev-only **Force Check Prices** maintenance button has been removed; Materials now refreshes prices automatically after you add, edit, or delete prices in the Part Prices Manager.

---

## Latest Updates (v2.19)

### Submission & Followup: Clickable GC/Builder, All-bids Modal, Navigation Buttons

**Date**: 2026-02-04

**Changes**:

- **Clickable GC/Builder (customer) in Submission & Followup tables**
  - In **Not yet won or lost**, **Won**, and **Started or Complete**, the GC/Builder (customer) cell is clickable and opens the existing Customer / GC Builder modal.
- **Customer / GC Builder modal: “All bids” list with status**
  - The modal now includes an **All bids** section showing each bid and its computed status:
    - Unsent
    - Not yet won or lost
    - Won
    - Started or Complete
    - Lost
- **Submission & Followup navigation buttons**
  - **Up-arrow** next to the row Edit/settings button scrolls back to the selected-bid summary at the top.
  - **Down-arrow** near the Approval PDF area scrolls to the selected bid’s row in the correct table section and auto-expands that section if collapsed.
- **Copy update (PO / templates)**
  - Updated instruction text to mention staged billing: “Materials broken down by stage allows for staged billing.”

**Files modified**:
- `src/pages/Bids.tsx` – Clickable GC/Builder cells, “All bids” modal sections, status helper, up/down scroll buttons, and small copy update.

---

## Latest Updates (v2.18)

### Bid outcome: Started or Complete

**Date**: 2026-02-03

**Changes**:

- Added a new bid outcome **Started or Complete** and a dedicated collapsible section in Submission & Followup between Won and Lost.
- Bid Board Win/Loss column shows “Started or Complete” when applicable.

**Database**:
- Updated `bids.outcome` constraint via `supabase/archive/add_bids_outcome_started_or_complete.sql`.

**Files modified**:
- `src/pages/Bids.tsx`
- `src/types/database.ts`

---

## Latest Updates (v2.17)

### Labor Book: Multiple Fixture/Tie-in Names (Aliases)

**Date**: 2026-02-03

**Changes**:

- Labor Book entries can include optional **additional names** (aliases) that match count rows’ Fixture or Tie-in (case-insensitive); first match wins by entry order.

**Database**:
- Added `labor_book_entries.alias_names` via `supabase/archive/add_labor_book_entries_alias_names.sql`.

**Files modified**:
- `src/pages/Bids.tsx`
- `src/types/database.ts`

---

## Latest Updates (v2.16)

### Dev Feature: Set User Password

**Date**: 2026-02-03

**Changes**:

- Devs can set another user’s password from Settings (modal + confirmation).
- Added Edge Function `set-user-password` with dev-role enforcement and password validation.

**Files modified**:
- `src/pages/Settings.tsx`

**Files added**:
- `supabase/functions/set-user-password/index.ts`

---

## Latest Updates (v2.15)

### Cover Letter and Edit Bid Modal

**Date**: 2026-02-02

**Changes**:

- **Cover Letter tab**
  - **Default Inclusions**: Textarea and combined document are pre-filled with **"Permits"** when the user has not entered custom inclusions. Constant `DEFAULT_INCLUSIONS`.
  - **Default Exclusions**: Textarea and combined document are pre-filled with four lines when empty: concrete cutting/removal/pour back excluded; impact fees excluded; work not specifically described excluded; electrical, fire protection, fire alarm, drywall, framing, architectural finishes excluded. Constant `DEFAULT_EXCLUSIONS`.
  - **Default Terms and Warranty**: Textarea and combined document are pre-filled with the full default paragraph (workmanlike manner, one-year workmanship warranty, material warranty, no warranty on customer materials, contingencies, 30-day acceptance, Click Plumbing void option, extra charges for alterations/rock/debris). Constant `DEFAULT_TERMS_AND_WARRANTY`. When the user clears the field, the combined document still shows this default.
  - **Labels**: "Terms and Warranty (collapsible)" → **"Terms and Warranty"**; "Exclusions and Scope (one per line)" → **"Exclusions and Scope (one per line, shown as bullets)"**.
  - **Project section**: At the top of the Cover Letter (and in the combined document), **Project** shows **Project Name** then **Project Address** (two lines only). Data from `bid.project_name` and `bid.address`.
  - **Edit bid button**: When a bid is selected in the Cover Letter tab, the header now has an **"Edit bid"** button (next to Close) that opens the Edit Bid modal for that bid.

- **Edit Bid modal**
  - **Field order**: **Project Name \*** is the first field at the top of the form. **Project Address** (renamed from "Address") is the second field, directly below Project Name.
  - Remaining fields follow: Project Folder, Job Plans, GC/Builder, Project Contact Name/Phone/Email, Estimator, Bid Due Date, etc.

**Files modified**:
- `src/pages/Bids.tsx` – Cover Letter: `DEFAULT_INCLUSIONS`, `DEFAULT_EXCLUSIONS`, `DEFAULT_TERMS_AND_WARRANTY`; pre-filled textareas and combined document logic; Project section (name + address); Edit bid button. Edit Bid modal: Project Name and Project Address at top; label "Address" → "Project Address".

---

## Latest Updates (v2.14)

### Cost Estimate Tab: Labor Book and Version Prefill

**Date**: 2026-02-01

**Changes**:

- **Labor book (Cost Estimate tab)**
  - **Labor book versions**: Create, edit, and delete named labor book versions. Each version has a list of entries.
  - **Labor book entries**: Per version, add/edit/delete fixture or tie-in entries with hours per stage: Rough In, Top Out, Trim Set. Each entry has a primary name and optional **additional names** (aliases); if any name matches a count row's Fixture or Tie-in (case-insensitive), that labor rate is applied. Entries ordered by sequence and fixture name.
  - **Bid-level version selection**: Each bid can have a selected labor book version (`selected_labor_book_version_id`). A "Labor book version" dropdown on the Cost Estimate tab (when a bid is selected) lets you choose a version or "— Use defaults —".
  - **Prefill for new labor rows**: When syncing cost estimate labor rows from count rows, **new** labor rows get hours from the selected labor book version's entries (match by primary name or any alias). If no version is selected, or a fixture has no matching entry, the app uses global `fixture_labor_defaults` (or 0). Existing labor rows are not overwritten when the version changes.

**Database**:
- **`labor_book_versions`**: `id`, `name`, `created_at`. RLS: dev, master_technician, assistant, estimator (full CRUD).
- **`labor_book_entries`**: `id`, `version_id` (FK, CASCADE), `fixture_name`, `alias_names` (TEXT[], optional additional names for same rate), `rough_in_hrs`, `top_out_hrs`, `trim_set_hrs`, `sequence_order`, `created_at`. Unique `(version_id, fixture_name)`. RLS: same roles.
- **`bids.selected_labor_book_version_id`**: Nullable FK to `labor_book_versions` (ON DELETE SET NULL).

**Files modified**:
- `src/types/database.ts` – Added `labor_book_versions`, `labor_book_entries`; extended `bids` with `selected_labor_book_version_id`.
- `src/pages/Bids.tsx` – Cost Estimate tab: labor book state, loaders, version dropdown, sync prefill from labor book, Labor Book management (versions + entries CRUD, modals).
- `src/pages/Settings.tsx` – Bids backup export includes price book (`price_book_versions`, `price_book_entries`), labor book (`labor_book_versions`, `labor_book_entries`), takeoff book (`takeoff_book_versions`, `takeoff_book_entries`), and full `purchase_orders` and `purchase_order_items` (all rows under RLS, including Takeoffs-created POs).

**Files added**:
- `supabase/archive/create_labor_book_versions_and_entries.sql` – Creates `labor_book_versions` and `labor_book_entries` with RLS; seeds one "Default" version and sample entries.
- `supabase/archive/add_bids_selected_labor_book_version.sql` – Adds `bids.selected_labor_book_version_id` column.

---

## Latest Updates (v2.13)

### Pricing Tab: Price Book and Margin Comparison

**Date**: 2026-02-01

**Changes**:

- **Pricing tab – full implementation**
  - **Price book versions**: Create, edit, and delete named price book versions. Each version has a list of entries.
  - **Price book entries**: Per version, add/edit/delete fixture or tie-in entries with prices per stage: Rough In, Top Out, Trim Set, and Total. Entries ordered by sequence and fixture name.
  - **Bid margin comparison**: Select a bid and a price book version. For each count row (fixture) on the bid, assign a price book entry (dropdown). Compare our cost (labor + allocated materials) to price book revenue; show margin % and flag: red (&lt; 20%), yellow (&lt; 40%), green (≥ 40%). Totals row shows total cost, total revenue, overall margin %, and overall flag.
  - **Cost allocation**: Per-fixture labor cost from cost estimate labor rows; materials allocated to fixtures proportionally by labor hours. Margin = (revenue − cost) / revenue.
  - **Version persistence**: Selected price book version for a bid is stored on the bid (`selected_price_book_version_id`) and restored when reopening the Pricing tab.
  - **Create Cost Estimate prompt**: If the selected bid has count rows but no cost estimate, a message and "Go to Cost Estimate" button are shown so the user can create one first.

**Database**:
- **`price_book_versions`**: `id`, `name`, `created_at`. RLS: dev, master_technician, assistant, estimator (full CRUD).
- **`price_book_entries`**: `id`, `version_id` (FK, CASCADE), `fixture_name`, `rough_in_price`, `top_out_price`, `trim_set_price`, `total_price`, `sequence_order`, `created_at`. Unique `(version_id, fixture_name)`. RLS: same roles.
- **`bid_pricing_assignments`**: `id`, `bid_id` (FK, CASCADE), `count_row_id` (FK to `bids_count_rows`, CASCADE), `price_book_entry_id` (FK, CASCADE). Unique `(bid_id, count_row_id)`. RLS: same as bids (access via bid).
- **`bids.selected_price_book_version_id`**: Nullable FK to `price_book_versions` (ON DELETE SET NULL).

**Files modified**:
- `src/types/database.ts` – Added `price_book_versions`, `price_book_entries`, `bid_pricing_assignments` table types; extended `bids` Row/Insert/Update with `selected_price_book_version_id`.
- `src/pages/Bids.tsx` – Pricing tab state and loaders; price book version/entry CRUD; bid pricing assignments; margin comparison table with assignment dropdowns and flags; version dropdown and "Go to Cost Estimate" prompt.

**Files added**:
- `supabase/archive/create_price_book_versions_and_entries.sql` – Creates `price_book_versions` and `price_book_entries` with RLS.
- `supabase/archive/create_bid_pricing_assignments.sql` – Creates `bid_pricing_assignments` with RLS.
- `supabase/archive/add_bids_selected_price_book_version.sql` – Adds `bids.selected_price_book_version_id` column.

---

## Latest Updates (v2.12)

### Submissions Cost Estimate Indicator, Currency Formatting, Pricing Tab, Revert Migration

**Date**: 2026-02-01

**Changes**:

- **Submission & Followup – Cost estimate indicator and link**
  - When a bid is selected in the Submission & Followup tab, the bid preview panel now shows whether a cost estimate exists for that bid.
  - **Cost estimate:** Displays the computed grand total (materials + labor) with comma formatting (e.g. $12,345.67) when a cost estimate exists, or "Not yet created" when it does not. Loading state shows "Loading cost estimate info…".
  - **View cost estimate** / **Create cost estimate** button: Switches to the Cost Estimate tab and preselects the same bid so the user can view or create the cost estimate.

- **Cost estimate totals and Submission preview – Comma formatting**
  - Numbers over 999 now display with commas (e.g. $1,000.00, $12,345.67) in:
    - Cost Estimate tab: Rough In / Top Out / Trim Set materials, Total materials, Labor total line, Summary (Total materials, Labor total, Grand total).
    - Submission & Followup cost estimate preview (the amount shown next to "Cost estimate:").
  - New helper **`formatCurrency(n)`** in Bids.tsx uses `toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`.

- **Pricing tab**
  - New **Pricing** tab added between Cost Estimate and Cover Letter on the Bids page. Placeholder content: "Pricing – coming soon."

- **Revert migration (price book)**
  - Migration **`revert_price_book_and_bids_job_type.sql`** reverses previously applied price-book–related schema changes: drops `bid_pricing_assignments`, `price_book_entries`, `price_book_versions`, and the `bids.job_type` column. Use this if the price book feature was reverted in code but migrations had already been run.

**Files modified**:
- `src/pages/Bids.tsx` – `submissionBidHasCostEstimate` and `submissionBidCostEstimateAmount` state; `useEffect` to load cost estimate existence and amount for selected Submission bid; cost estimate indicator and View/Create button in Submission panel; `formatCurrency` helper; Cost Estimate tab and Submission preview use `formatCurrency`; Pricing tab (placeholder); `activeTab` type includes `'pricing'`.

**Files added**:
- `supabase/archive/revert_price_book_and_bids_job_type.sql` – Drops price book tables and `bids.job_type` in dependency order.

---

## Latest Updates (v2.11)

### Bids UI, Counts, Takeoff, Purchase Orders

**Date**: 2026-01-31

**Changes**:

- **Bid Board**
  - **Edit column**: Header text hidden (only gear icon visible; `title` and `aria-label` kept for accessibility). Edit button wrapper styled invisible (no background/border/padding) so only the SVG icon shows.

- **Edit Bid modal**
  - **Cancel button** moved from bottom row to **top right**, next to the modal title.

- **New Bid modal**
  - **"Save and start Counts"** button (bottom left): Saves the bid and opens it in the Counts tab (creates or updates bid, then sets `activeTab` to counts and `selectedBidForCounts` to the saved bid).
  - **Project Name required**: Label shows "Project Name *"; client-side validation prevents save when empty and shows "Project Name is required."; input has `required` and clears error on change.

- **Counts tab**
  - **Search box** moved **below** the selected-bid panel (above the bids list table). Search bar is **full width** (`boxSizing: 'border-box'`).
  - **Column header**: "Project / GC" changed to **"Project Name"**.
  - **"Edit Bid" button** in tab header (next to Close) opens the Edit Bid modal for the selected bid.
  - **NewCountRow (add row)**:
    - **Fixture quick-select**: Buttons below Fixture input (Bathrooms, Kitchen, Laundry, Plumbing Fixtures, Appliances, etc.) populate the Fixture field when clicked.
    - **Number pad** below Count: digits 0–9, **C** (all clear), **0**, **Delete** (backspace); layout 1–9 then C, 0, Delete; centered.
    - **Combined inputs**: Fixture, Count, and Plan Page in a single cell (`colSpan={3}`), arranged horizontally; table headers **Fixture\***, **Count\***, **Plan Page**, **Actions** centered.
    - **Save** (renamed from "Add") and **Save and Add**: Save and Add saves the row, clears form, refreshes counts, keeps form open for another row; styled to match "Add row" (blue).
    - Fixture and Count are required (placeholders show "Fixture*", "Count*").

- **Takeoff tab**
  - **Full implementation** (replaces "Coming soon"): Select a bid; table maps fixture counts to material templates and quantities. **Create purchase order** creates a new draft PO from current mappings; **Add to selected PO** adds items to an existing draft PO (uses shared `materialPOUtils`: `expandTemplate`, `addExpandedPartsToPO`).
  - **Multiple templates per fixture**: Each fixture can have multiple template mappings (Add template / Remove per row); each mapping has a unique `id`.
  - **Template search**: Centered filter above table ("only show templates with these words", 360px width); template dropdowns use filtered options while always including selected templates.
  - **View purchase order**: After creating or adding to a PO, a "View purchase order" link appears; it navigates to `/materials` with `state.openPOId` so the Materials page opens the Purchase Orders tab and displays that PO. Materials page clears `location.state` after handling to avoid re-opening on refresh.

- **Cover Letter tab**
  - Content: "Cover Letter – coming soon" and "Until then, please use [BidTooling.com](https://BidTooling.com)" (link opens in new tab).

- **Purchase Orders (Materials page)**
  - **Grand Total**: `colSpan` in footer set to **5** for finalized POs; totals coerce `price_at_time` and `quantity` to number with NaN fallback to 0.
  - **With Tax row**: New row below Grand Total: label "With Tax", editable tax % (default 8.25, width 6rem), and calculated total (Grand Total × (1 + tax% / 100)); state `viewedPOTaxPercent`.
  - **Column headers**: "Quantity" changed to **"Qty"** in PO tables.

- **RLS (workflow_templates)**
  - Migration `optimize_workflow_templates_rls.sql`: Replaces bare `auth.uid()`/`auth.jwt()` with `(select auth.uid())`/`(select auth.jwt())` in RLS policies on `public.workflow_templates` so they are evaluated once per query (see Supabase RLS performance best practices).

**Files modified**:
- `src/pages/Bids.tsx` – Bid Board Edit column/button, Edit Bid Cancel position, New Bid "Save and start Counts" and Project Name required, Counts search/column/Edit Bid button, NewCountRow (Fixture quick-select, number pad, Save/Save and Add, combined inputs, required labels), Takeoff (state, loaders, mappings, template search, Create PO / Add to PO, View purchase order link)
- `src/pages/Materials.tsx` – PO Grand Total colspan and NaN handling, With Tax row and `viewedPOTaxPercent`, "Qty" headers, `location.state.openPOId` handling to open PO from Bids
- `src/lib/materialPOUtils.ts` – Shared `expandTemplate`, `addExpandedPartsToPO` (used by Materials and Bids Takeoff)

**Files added**:
- `supabase/archive/optimize_workflow_templates_rls.sql` – RLS optimization for workflow_templates

---

## Latest Updates (v2.10)

### Add Customer from Edit Bid Modal, Estimator Customer Access, Quick Fill UI

**Date**: 2026-01-31

**Changes**:

- **Add Customer from Edit Bid modal**
  - In the Edit/New Bid modal, the GC/Builder (customer) dropdown now includes a **"+ Add new customer"** option at the top (for dev, master_technician, assistant, and estimator).
  - Clicking it opens an **Add Customer** modal with the same form as `/customers/new` but **without** the Quick Fill block (Name, Address, Phone, Email, Date Met, Customer Owner (Master)).
  - On save, the new customer is created, the customer list is refetched, the new customer is selected as the bid’s GC/Builder, and the Add Customer modal closes.
  - Shared component **`NewCustomerForm`** (`src/components/NewCustomerForm.tsx`) is used for both `/customers/new` (with Quick Fill) and the Add Customer modal (without Quick Fill). CustomerForm uses it for the create path; Bids renders it inside the Add Customer modal with `showQuickFill={false}`, `mode="modal"`, `onCancel`, and `onCreated`.

- **Estimators: see and add customers in Bids only**
  - **Customers RLS**: New migration `allow_estimators_select_customers.sql` lets estimators **SELECT** all customers (for the GC/Builder dropdown and joined customer data on bids) and **INSERT** into `customers` only when `master_user_id` is set to a valid master (dev or master_technician). Estimators cannot UPDATE or DELETE customers.
  - **Bids page**: Estimators now load the customer list (`loadCustomers()` is called for estimators as well as dev/master/assistant), so the GC/Builder dropdown is populated. Estimators also see the "+ Add new customer" option and can open the Add Customer modal.
  - **NewCustomerForm**: Estimator role is supported: estimators see the Customer Owner (Master) dropdown (all masters), must select a master when creating a customer, and can create customers from the Add Customer modal in Bids. Estimators still have **no access** to `/customers` or `/projects` (Layout redirects them to `/bids` for those paths).

- **Quick Fill on New Customer page**
  - On `/customers/new`, the **Quick Fill** block (paste tab-separated data to fill Name, Address, Email, Phone, Date) is now **expandable** and **collapsed by default**.
  - A **Quick Fill** button (with ▶ when collapsed, ▼ when expanded) sits **next to** the "New customer" title. Clicking it toggles the textarea and "Fill Fields" button.
  - When expanded, the label "Paste: Name	Address	Email	Phone	Date (M/D/YYYY)" and the textarea and "Fill Fields" button are shown below the title row.

**Files added**:
- `src/components/NewCustomerForm.tsx` – shared create-only customer form (used by CustomerForm for create and by Bids Add Customer modal).
- `supabase/archive/allow_estimators_select_customers.sql` – customers SELECT policy includes estimator; new INSERT policy for estimators when master is assigned.

**Files modified**:
- `src/pages/CustomerForm.tsx` – uses `NewCustomerForm` when `isNew`; edit/delete flow unchanged.
- `src/pages/Bids.tsx` – `addCustomerModalOpen` state; "+ Add new customer" in GC/Builder dropdown (all four roles); Add Customer modal with `NewCustomerForm`; `loadCustomers()` called for estimators.
- `src/components/NewCustomerForm.tsx` – `estimator` in UserRole; load all masters for estimator; require master selection for estimator; show Customer Owner dropdown for estimator; Quick Fill expandable (default collapsed), Quick Fill button next to title.

---

## Latest Updates (v2.9)

### Bids Page Enhancements

**Date**: 2026-01-31

**Changes**:
- ✅ **Estimated Job Start Date**
  - Added nullable `estimated_job_start_date` column to `public.bids` (migration: `add_bids_estimated_job_start_date.sql`).
  - New/Edit Bid modal: when outcome is "Won", a date input for "Estimated Job Start Date" is shown and saved.
  - Submission & Followup tab: Won table header is "Estimated Job Start Date"; cell shows the date (YY/MM/DD format).
  - Types updated in `src/types/database.ts` (Row, Insert, Update).

- ✅ **Collapsible Submission & Followup tables**
  - Each of the four sections (Unsent bids, Not yet won or lost, Won, Lost) has a clickable header with chevron (▼ expanded, ▶ collapsed) and item count (e.g. "Unsent bids (3)").
  - Tables are shown or hidden based on section state. "Lost" is collapsed by default.

- ✅ **Bid Board search**
  - Full-width search input on Bid Board tab. Filters bids by project name, address, customer name, or GC/builder name (case-insensitive). Empty state reflects search and "hide lost" filter.

- ✅ **Bid Board columns**
  - Removed "Agreed Value" and "Maximum Profit" columns from the Bid Board table.
  - "Win/ Loss" and "Bid Value" moved to appear after "Address" and before "Estimator".
  - "Win/ Loss" header is a button that toggles hiding/showing lost bids; when hiding lost, the label shows "(hiding lost)" and is underlined.

- ✅ **Delete Bid confirmation modal**
  - Edit Bid modal: inline delete replaced with a "Delete bid" button that opens a separate confirmation modal.
  - Confirmation modal requires typing the project name (or leaving empty if no project name) to enable Delete. Cancel closes only the delete modal. Delete uses existing `deleteBid()` and closes both modals on success.

- ✅ **Submission & Followup Edit column**
  - Each of the four Submission & Followup tables has an "Edit" column (last column) with a gear icon button per row when that row is the selected bid. Clicking it opens that bid's full edit modal; click uses `stopPropagation` so row selection does not fire.

- ✅ **Wording**
  - "X day(s) overdue" in Time to/from bid due date is now "X day(s) since deadline".

- ✅ **GC/Builder contact fields (per bid)**
  - Added nullable columns to `public.bids`: `gc_contact_name`, `gc_contact_phone`, `gc_contact_email` (migration: `add_bids_gc_contact.sql`).
  - **New/Edit Bid modal**: After the GC/Builder (customer) picker and before Project Name, three fields: **Project Contact Name**, **Project Contact Phone**, **Project Contact Email**. Saved with the bid; types updated in `src/types/database.ts`.
  - **Submission & Followup only**: When a bid is selected, the panel above the submission entries table shows Builder Name, Builder Address, **Builder Phone Number**, **Builder Email** (from customer or legacy GC/Builder), Project Name, Project Address, **Project Contact Name**, **Project Contact Phone**, **Project Contact Email**, Bid Size. Project contact fields are **not** shown on the Bid Board table.

**Files Modified**:
- `supabase/archive/add_bids_gc_contact.sql` – New migration for gc_contact_name, gc_contact_phone, gc_contact_email
- `src/types/database.ts` – `bids`: added `estimated_job_start_date`, `gc_contact_name`, `gc_contact_phone`, `gc_contact_email`
- `src/pages/Bids.tsx` – state, form field, save payload, collapsible sections, search, column order/visibility, delete modal, Edit column, Won table column, wording, GC/Builder contact state/form/panel

---

## Latest Updates (v2.8)

### Purchase Order and Price Book Enhancements

**Date**: 2026-01-26

**Changes**:
- ✅ **Supply house dropdown with active prices**
  - In the draft PO items table and in the selected PO section, each line item’s Supply House cell is now a **dropdown** instead of plain text or a generic list.
  - Options show supply houses that have a price for that part, formatted as "Supply House Name - $X.XX" (from the price book).
  - Selecting an option immediately updates the PO item’s supply house and price and recalculates the PO total (no Edit/Update step).
  - "None" option clears the supply house and sets price to 0. Options load when the dropdown is opened (on focus).

- ✅ **Finalized POs: read-only supply house and hidden Confirmed**
  - When a PO is **finalized**, the Supply House cell shows read-only text (supply house name or "—") instead of the dropdown; users cannot change prices or supply house.
  - The **Confirmed** column is **hidden** for finalized POs (header and body); the table shows Part, Quantity, Supply House, Price, Total only. Footer colspan is adjusted so Grand Total aligns correctly.

- ✅ **Update price to zero removes part from supply house**
  - In the PO modal’s supply-house price table (when "Update" is expanded), setting the New Price to **0** and clicking "Update price" now **deletes** that price record from the price book (removes the part from that supply house) instead of saving a zero price. The button label changes to "Remove from supply house" when the value is 0.

- ✅ **Price book refresh on close of Part Prices modal**
  - When the user closes the "Prices" modal (Part Prices Manager) after editing or adding prices for a part, the Price Book table now **refetches parts** so the "Best Price" and part data update without a full page refresh.

- ✅ **View purchase order inline (no modal)**
  - Viewing a purchase order no longer opens a fixed overlay modal. The selected PO details (name, notes, status, items table, Grand Total, Delete/Close/Print/Duplicate/Go to Projects) now appear in an **inline section** on the Purchase Orders tab, **above** the "Search purchase orders" bar and table. Close hides the section; the search and table remain visible.

- ✅ **Print purchase order**
  - A **Print** button appears in the selected PO section (next to Close). Clicking it opens a new window with a print-friendly document and triggers the browser print dialog.
  - **Draft POs**: Print view shows **all prices** for each part (every supply house and price from the price book for that part), plus the currently chosen supply house and price and line total. Columns: Part, Qty, All prices, Chosen, Total; Grand Total.
  - **Finalized POs**: Print view shows only the **chosen price** per line. Columns: Part, Qty, Supply House, Price, Total; Grand Total. The print window closes after the user prints or cancels.

- ✅ **Reliable refresh after "Update price" in PO modal**
  - The "Update price" action in the PO modal’s supply-house table now passes the part id from the row into the update function so the price list refreshes correctly even when selection state is stale. "Use for PO" and "Add price" are unchanged.

**Files Modified**:
- `src/pages/Materials.tsx` - Supply house dropdown state and loader, inline PO section, Print button and printPO handler, fetchPricesForPart helper, finalized read-only/hidden Confirmed, loadParts on Part Prices modal close, updatePartPriceInBook partId and zero-price delete, updatePOItemSupplyHouse for draft-only PO

---

## Latest Updates (v2.7)

### Materials Management Enhancements

**Date**: 2026-01-21

**Changes**:
- ✅ **Finalized Purchase Order Notes**
  - Added ability to add notes to finalized purchase orders (add-only, cannot be edited once added)
  - Notes display prominently at the top of the PO view modal
  - Shows user name and timestamp: "Added by [Name] on [Date]"
  - Use cases: final bill amounts, pickup difficulties, special instructions
  - Database: Added `notes_added_by` and `notes_added_at` columns to `purchase_orders` table
  - RLS: New policy allows updating notes fields on finalized POs, but only when `notes` is null (enforcing add-only behavior)

- ✅ **Duplicate as Draft Feature**
  - Added "Duplicate as Draft" button to finalized purchase order view modal
  - Creates a new draft PO with all items copied from the finalized PO
  - Name format: "Copy of [original name]"
  - Resets confirmation status (price_confirmed_at, price_confirmed_by cleared)
  - Automatically opens the new draft PO for editing in Templates & Purchase Orders tab

- ✅ **UI Improvements - Delete Buttons Moved to Modals**
  - Moved delete buttons from list views to edit/view modals for better UX
  - **Templates**: Delete button now in Edit Template modal (left side)
  - **Parts**: Delete button now in Edit Part modal (left side)
  - **Supply Houses**: Delete button now in Edit Supply House form (left side)
  - **Purchase Orders**: Delete button now in PO view modal (left side)
  - Delete buttons only appear when editing/viewing existing items (not when creating new ones)
  - Consistent styling and positioning across all modals

**Database Changes**:
- ✅ Created `add_finalized_notes_tracking.sql` migration
  - Adds `notes_added_by` (UUID) and `notes_added_at` (TIMESTAMPTZ) columns
  - Creates RLS policy for updating notes on finalized POs (add-only enforcement)
  - Index on `notes_added_by` for faster lookups

**Files Modified**:
- `supabase/archive/add_finalized_notes_tracking.sql` - New migration for notes tracking
- `supabase/archive/optimize_rls_for_master_sharing.sql` - Fixed UPDATE policy for assistants
- `src/types/database.ts` - Updated `purchase_orders` table types
- `src/pages/Materials.tsx` - Added notes functionality, duplicate feature, moved delete buttons

**Technical Details**:
- **Add-Only Enforcement**: Database RLS policy ensures notes can only be added when `notes` is null, preventing edits
- **User Name Loading**: User names are loaded and cached in `userNamesMap` for efficient display
- **Optimistic UI Updates**: Notes form updates UI immediately, with rollback on error
- **RLS Policy Fix**: Updated `project_workflow_steps` UPDATE policy to allow assistants to update steps in workflows they can access (not just steps assigned to them), fixing 400 errors when changing assignments

---

## Latest Updates (v2.6)

### Workflow Data Persistence & Performance Fixes

**Date**: 2026-01-21

**Changes**:
- ✅ **Fixed data persistence issues** for projections and workflow steps
  - **Problem**: Projections and steps added to new projects would disappear when navigating away and coming back
  - **Root Cause**: Race condition where `workflow?.id` from React state was `null` during immediate save operations, causing saves to silently fail
  - **Solution**: Modified all save/delete operations (`saveProjection`, `deleteProjection`, `saveStep`, `refreshSteps`, `createFromTemplate`, `copyStep`) to always obtain a valid `workflowId` by calling `ensureWorkflow(projectId)` if state is null
  - **Result**: Data now persists correctly on first navigation back

- ✅ **Prevented concurrent workflow creation**
  - **Problem**: Multiple workflows being created for the same project, causing duplicate entries
  - **Root Cause**: Race condition where multiple concurrent calls to `ensureWorkflow` could all pass the initial check before any stored their promise
  - **Solution**: Implemented mutex pattern using `useRef` and placeholder promises
    - Creates and stores a placeholder promise immediately before executing async logic
    - Subsequent concurrent calls await the placeholder promise, serializing workflow creation
    - Added retry logic for insert errors to handle unique constraint violations gracefully
  - **Result**: Only one workflow is created per project, even with concurrent calls

- ✅ **Optimized redundant loadSteps calls**
  - **Problem**: Excessive `loadSteps` calls (7+ times) for the same workflow_id, causing performance issues
  - **Root Cause**: `useEffect` with `workflow?.id` in dependency array re-running when workflow state updates
  - **Solution**: Added ref tracking to prevent redundant loads
    - Added `lastLoadedWorkflowId` ref to track which workflow_id has been loaded
    - `loadSteps` sets the ref after successful load
    - `useEffect` checks if we've already loaded for the workflow_id before calling `loadSteps`
    - `refreshSteps` resets tracking to force reload when explicitly called
    - Tracking resets when `projectId` changes (new project)
    - Added cleanup function to handle React Strict Mode properly
  - **Result**: Reduced to 1-2 `loadSteps` calls per page load, significantly improving performance

**Files Modified**:
- `src/pages/Workflow.tsx` - Added mutex pattern, ref tracking, workflow_id lookup pattern, and TypeScript type fixes

**Technical Details**:
- **Mutex Pattern**: Uses `useRef<Map<string, Promise<string | null>>>` to track pending `ensureWorkflow` calls per project
- **Ref Tracking**: Uses `useRef<string | null>` to track last loaded workflow_id
- **Workflow State Sync**: After `ensureWorkflow` returns, workflow state is updated to ensure consistency
- **Cleanup Function**: Added to useEffect to handle React Strict Mode double-invocation
- **TypeScript Type Fixes**: Explicitly typed `workflowId` variables as `string | null` (7 locations) to match `ensureWorkflow` return type, using `?? null` to convert `undefined` to `null`

## Latest Updates (v2.5)

### Master-to-Master Sharing

**Date**: 2026-01-21

**Changes**:
- ✅ **Added "Share with other Master" feature** in Settings
  - Masters can grant other masters assistant-level access to their customers and projects
  - Similar to "Adopt Assistants" but for master-to-master relationships
  - Shared masters can see customers, projects, workflows, and steps
  - Shared masters cannot see private notes or financial totals (same restrictions as assistants)
  - Shared masters cannot modify/delete resources (same restrictions as assistants)

**Database Changes**:
- ✅ Created `master_shares` table to track sharing relationships
- ✅ Updated RLS policies for customers, projects, workflows, steps, line items, and projections
- ✅ All policies now check for `master_shares` relationships in addition to `master_assistants`
- ✅ **Added RLS timeout fix migration** for master sharing
  - Introduces helper-function-based policies to avoid statement timeouts (`57014`)
  - File: `supabase/archive/optimize_rls_for_master_sharing.sql`

**Files Modified**:
- `supabase/archive/create_master_shares.sql` - New table
- `supabase/archive/update_*_rls_for_master_sharing.sql` - 6 legacy SQL files (archived; not CLI migrations) updating RLS policies
- `supabase/archive/optimize_rls_for_master_sharing.sql` - Fix statement timeout errors
- `src/types/database.ts` - Added master_shares table types
- `src/pages/Settings.tsx` - Added UI for master sharing

### Re-open Functionality Updates

**Date**: 2026-01-21

**Changes**:
- ✅ **Re-open button now available for completed, approved, and marked-incomplete stages**
  - Previously only available for marked-incomplete stages
  - Now available to devs, masters, and assistants (on Workflow page)
  - Button appears inline with Edit and Delete buttons (bottom right of card)
  - Removed from Dashboard (only available on Workflow page)
- ✅ **Re-open clears next step rejection notices**
  - When reopening a step, clears `next_step_rejected_notice` and `next_step_rejection_reason` if set
  - Ensures clean state when manually reopening

**Files Modified**:
- `src/pages/Workflow.tsx` - Updated re-open button visibility and location
- `src/pages/Dashboard.tsx` - Removed re-open button

### Dashboard UI Updates

**Date**: 2026-01-21

**Changes**:
- ✅ **Updated "How It Works" section**
  - Added intro line: "PipeTooling helps Masters better manage Projects with Subs. Three types of People: Masters, Assistants, Subs"
  - Updated bullets to the new “Customers/Projects/Stages” wording
- ✅ **Updated "Sharing" + Subcontractors help text**
  - Added explanation lines (→) under sharing bullets
  - Removed the separate "Access Control" section from the help box
  - Simplified Subcontractor bullets (cannot see private notes or financials)

**Files Modified**:
- `src/pages/Dashboard.tsx` - Updated help text sections

### Login-as-User Improvements

**Date**: 2026-01-21

**Changes**:
- ✅ **Fixed magic link authentication handling**
  - Added `AuthHandler` component to process authentication tokens from URL hash
  - Automatically sets session and redirects to dashboard when coming from magic link
  - Fixed redirect URL construction to use `window.location.origin`
- ✅ **Updated button text**: "Login as user" → "imitate"

**Files Modified**:
- `src/App.tsx` - Added AuthHandler component
- `src/pages/Settings.tsx` - Updated button text and redirect URL

## Latest Updates (v2.4)

### Assistant Workflow Access Improvements

**Date**: 2026-01-21

**Changes**:
- ✅ **Assistants can now see ALL stages** in workflows they have access to (via master adoption)
  - Previously, assistants were incorrectly filtered to only see assigned stages (same as subcontractors)
  - Now assistants have broader visibility while subcontractors remain restricted to assigned stages only
- ✅ **Line items update immediately** for assistants after adding/editing
  - Fixed issue where assistants couldn't see newly added line items until page refresh
  - Updated `useEffect` to include assistants in line items loading
  - Added explicit reload after save/delete operations

**Files Modified**:
- `src/pages/Workflow.tsx` - Removed assistant filtering from `loadSteps()`, updated line items loading

### Financial Tracking Updates

**Changes**:
- ✅ **Assistants can add line items** but cannot see financial totals
  - Assistants can view and edit the Ledger table (all line items)
  - Assistants cannot see "Ledger Total" or "Total Left on Job" (devs/masters only)
  - Projections section remains dev/master-only
- ✅ **Updated label**: "Line Items (You and your assistant only)" → "Line Items (Master and Assistants only)"

**Files Modified**:
- `src/pages/Workflow.tsx` - Split Projections and Ledger sections, hid totals from assistants

### Workflow Stage Status Display

**Changes**:
- ✅ **Status moved to top of card**: Now displays right below "Assigned to" line
  - Format: `Status: {status}` for all status types
  - Previous work incomplete status includes reason inline: `Status: Previous work incomplete - {rejection_reason}`
  - Previous work incomplete status shown in red (#b91c1c) with bold font
- ✅ **Removed duplicate status display** from bottom of card

**Files Modified**:
- `src/pages/Workflow.tsx` - Moved status display, removed separate rejection reason display

### Re-open Marked-Incomplete Stages

**Changes**:
- ✅ **Added "Re-open" button** for stages marked incomplete
  - Visible to devs/masters and assigned person
  - Resets stage to `pending` status
  - Clears `ended_at`, `rejection_reason`, `approved_by`, and `approved_at`
  - Records 'reopened' action in action ledger
  - Sends notifications to subscribed users

**Files Modified**:
- `src/pages/Workflow.tsx` - Added `markReopened()` function and button

### Database RLS Optimizations

**Changes**:
- ✅ **Optimized `workflow_step_line_items` RLS policies**
  - Created `can_access_project_via_step()` helper function
  - Prevents timeout errors when loading line items
  - Uses SECURITY DEFINER to bypass RLS and avoid recursion
- ✅ **Fixed `project_workflow_step_actions` RLS policies**
  - Created `can_access_step_for_action()` helper function
  - Allows authenticated users to insert actions for accessible steps
  - Fixes 403/500 errors when recording workflow actions

**Migration Files Created**:
- `supabase/archive/optimize_workflow_step_line_items_rls.sql`
- `supabase/archive/fix_project_workflow_step_actions_rls.sql`

**Key Functions**:
- `public.can_access_project_via_step(step_id_param UUID)` - Checks project access via step
- `public.can_access_step_for_action(step_id_param UUID)` - Checks step access for actions

---

## Workflow Features

### Private Notes and Line Items

**Location**: Each workflow stage card

**Features**:
- **Private Notes**: Text area visible only to owners and master technicians
- **Line Items**: Track expenses/credits per stage with memo and amount
- **Ledger**: Aggregated view of all line items across all stages, shown in the shared Projections/Ledger panel at the top of the workflow

**See**: `PRIVATE_NOTES_SETUP.md` for complete documentation

### Projections

**Location**: Shared financial panel at top of workflow page (combined with Ledger)

**Features**:
- Track projected costs for the entire workflow
- Fields: Stage name, Memo, Amount
- Supports negative numbers (for credits/adjustments)
- Amounts formatted with commas (e.g., `$1,234.56`)
- Projections Total and Ledger Total both shown
- **Total Left on Job: Projections - Ledger = ...** displayed at bottom of the panel

**Database**: `workflow_projections` table
**Migration**: `supabase/archive/create_workflow_projections.sql`

### Set Start Date/Time

**Location**: "Set Start" button on pending stages

**Features**:
- Changed from immediate start to date/time picker
- Modal opens with datetime-local input
- Pre-filled with current date/time
- Allows setting historical start times

**Implementation**: `setStartStep` state and modal

### Action Ledger

**Location**: Bottom of each workflow stage card

**Features**:
- Complete history of all actions (started, completed, approved, rejected, reopened)
- Shows who performed each action and when
- Displays action notes if provided
- Chronologically ordered (newest first)
- **Re-open functionality**: Stages marked incomplete can be reopened via "Re-open" button
  - Resets stage to `pending` status
  - Clears rejection reason and approval info
  - Records 'reopened' action in ledger
  - Sends notifications to subscribed users

**Database**: `project_workflow_step_actions` table
**RLS**: Optimized with helper function `can_access_step_for_action()` to prevent timeout errors

---

## Calendar Updates

### Central Time Zone

**Feature**: All calendar dates and times display in Central Time (America/Chicago)

**Implementation**:
- Uses `Intl.DateTimeFormat` with `timeZone: 'America/Chicago'`
- Automatically handles DST (CST/CDT)
- Converts UTC timestamps from database to Central Time before display

**Functions**:
- `getCentralDateFromUTC()` - Converts UTC to Central Time date string
- `getCentralDate()` - Gets current date in Central Time

### Two-Line Display

**Feature**: Each calendar item shows:
- **Top line**: Stage name (bold)
- **Bottom line**: Project name (smaller, gray)

**Visual**: Better organization and readability

---

## Access Control

### Assistant and Subcontractor Restrictions

**Dashboard**:
- Only shows stages assigned to the current user (by name match)
- Filters by `assigned_to_name` matching user's name

**Calendar**:
- Only shows stages assigned to the current user
- Filters by `assigned_to_name` matching user's name

**Workflow Page**:
- **Assistants**: Can see ALL stages in workflows they have access to (via master adoption)
- **Subcontractors**: Only shows stages assigned to them (by name match)
- Error message for subcontractors if no assigned stages: "You do not have access to this workflow..."
- Action buttons (Set Start, Complete, Re-open) visible if:
  - User is dev/master, OR
  - User is assigned to that specific stage
- Management buttons (Edit, Delete, Assign) only visible to owners/masters
- Notification settings:
  - "ASSIGNED" column hidden for assistants/subcontractors
  - "ME" column visible if user is assigned to the stage
  - Cross-step notifications only visible to owners/masters

### Current User in Person Assignment

**Feature**: "Add person to:" modal always shows the signed-in user first

**Implementation**:
- Current user appears at top with blue highlight
- Label: "(You)" after name
- Excluded from roster list below to prevent duplicates

---

## Email Templates

**Location**: Settings page → Email Templates section

**Features**:
- 11 template types:
  - User Management: `invitation`, `sign_in`, `login_as`
  - Workflow Notifications: 8 stage-related types
- Customizable subject and body
- Variable support (e.g., `{{name}}`, `{{email}}`, `{{link}}`)
- Test email functionality
- Integration with Resend email service

**Database**: `email_templates` table
**Edge Function**: `test-email` for sending test emails

**See**: `EMAIL_TEMPLATES_SETUP.md` and `EMAIL_TESTING.md` for complete documentation

---

## Financial Tracking

### Amount Formatting

**Feature**: All monetary amounts display with comma separators

**Examples**:
- `$1,234.56` instead of `$1234.56`
- `($1,234.56)` for negative amounts
- `$1,234,567.89` for large numbers

**Implementation**: `formatAmount()` function uses `toLocaleString('en-US')`

### Line Items

**Purpose**: Track actual expenses/credits per workflow stage

**Features**:
- Memo and amount fields
- Supports negative numbers
- Aggregated in Ledger inside the shared Projections/Ledger panel at top of workflow
- **Assistants**: Can view Ledger table and add/edit line items, but cannot see "Ledger Total" or "Total Left on Job"
- **Devs/Masters**: Can see all line items and financial totals
- Projections section remains dev/master-only
- Line items update immediately after adding/editing (no page refresh needed)

### Projections

**Purpose**: Track projected costs for entire workflow

**Features**:
- Stage name, memo, and amount
- Supports negative numbers
- Total calculation, shown alongside Ledger Total and "Total Left on Job: Projections - Ledger = ..."
- Visible only to owners and masters

**Note**: Projections are separate from Line Items - projections are workflow-level, line items are stage-level.

---

## Customer and Project Management

### Customer Delete Functionality

**Location**: Customer edit form (`CustomerForm.tsx`)

**Features**:
- **Delete button** appears below the form when editing a customer (not when creating)
- Only visible to **devs and masters**
- **Masters**: Can only delete customers they own (`master_user_id = auth.uid()`)
- **Devs**: Can delete any customer
- **Confirmation modal** requires typing the customer name to confirm deletion
- Navigates to customer list after successful deletion

**Database**: RLS policy in `supabase/archive/add_customers_delete_rls.sql`
- Masters can delete their own customers
- Devs can delete any customer

### Projects Page Enhancements

**Location**: Projects list page (`Projects.tsx`)

**Features**:
- **Stage Summary**: Shows complete workflow stage sequence with color coding
  - Green (`#059669`) for completed/approved stages
  - Red (`#b91c1c`) for stages marked incomplete
  - Orange (`#E87600`) and bold for in_progress stages
  - Gray (`#6b7280`) for pending stages
  - Displayed below project description, above plans link
- **Current Stage Display**: Shows current stage with progress indicator
  - Format: `Current stage: check subs work [3 / 5]`
  - Shows stage position (1-indexed) and total stages
  - **Position calculation**: Uses sorted step list position, not raw `sequence_order` (fixes display issues when sequence_order has gaps)
  - **Stages marked incomplete stop progress**: If any stage is marked incomplete, it's shown as the current stage (prevents progress past those stages)
- **Map Link**: Clickable map icon next to "Link to plans" (if project has address)
  - Opens Google Maps with project address
  - Same icon and styling as customer list
- **Empty State**: When filtering by customer with no projects, shows: `**[Customer Name]** has no projects yet. Add one.`
  - Customer name is bolded
  - "Add one" link includes customer parameter for pre-filling

### UI Improvements

**Customer List**:
- Removed redundant "Edit" link (clicking customer name goes to edit page)
- Clicking customer name navigates to edit form

**Projects List**:
- Removed redundant "Workflow" link (clicking project name goes to workflow page)
- Clicking project name navigates to workflow page
- Only "Edit" link remains in action area

---

## Database Migrations Required

Run these migrations in order:

1. **Private Notes**: `supabase/archive/add_private_notes_to_workflow_steps.sql`
2. **Line Items**: `supabase/archive/create_workflow_step_line_items.sql`
3. **Email Templates**: `supabase/archive/create_email_templates.sql` (see `EMAIL_TEMPLATES_SETUP.md`)
4. **Projections**: `supabase/archive/create_workflow_projections.sql`
5. **Customer Delete RLS**: `supabase/archive/add_customers_delete_rls.sql`
6. **Projects RLS for Assistants**: `supabase/archive/verify_projects_rls_for_assistants.sql` - Ensures assistants can see all projects from masters who adopted them
7. **Users RLS Fix**: `supabase/archive/fix_users_rls_for_project_masters.sql` - Fixes 406 errors when assistants try to load master information (uses SECURITY DEFINER function to avoid recursion)
8. **Line Items RLS Optimization**: `supabase/archive/optimize_workflow_step_line_items_rls.sql` - Optimizes RLS policies to prevent timeout errors when loading line items (uses helper function `can_access_project_via_step()`)
9. **Step Actions RLS Fix**: `supabase/archive/fix_project_workflow_step_actions_rls.sql` - Fixes 403/500 errors when recording workflow actions (uses helper function `can_access_step_for_action()`)

---

## UI/UX Improvements

### Visual Hierarchy
- Private Notes and Line Items: No background/border (matches Notes styling; blue boxes removed in v2.59)
- Projections & Ledger: Combined light blue financial panel (`#f0f9ff`) at top of workflow
- Inner Ledger table rows use neutral/gray backgrounds with red for negative amounts
- Collected projections: Green background highlight (future enhancement)

### Button Organization
- Action buttons grouped by function
- Management buttons (Edit, Delete, Assign) only for owners/masters
- Collected button in Projections uses green color scheme

### Error Messages
- Improved error parsing for Edge Functions
- Shows HTTP status codes and specific error messages
- Better user feedback for debugging

---

## Technical Details

### TypeScript Types
- Updated `src/types/database.ts` with all new table types
- Added type aliases: `LineItem`, `Projection`

### State Management
- Role-based state: `userRole`, `currentUserName`
- Feature-specific state: `lineItems`, `projections`, `editingLineItem`, `editingProjection`

### Functions
- `formatAmount()` - Currency formatting with commas
- `calculateLedgerTotal()` - Sum of all line items
- `calculateProjectionsTotal()` - Sum of all projections
- `getCentralDateFromUTC()` - Timezone conversion
- `loadLineItemsForSteps()` - Batch loading
- `loadProjections()` - Workflow-level projections

---

## Future Enhancements

### Email Integration
- Update `invite-user` Edge Function to use templates
- Update `login-as-user` Edge Function to use templates
- Implement workflow stage notification sending
- Connect email templates to actual notification triggers

### Financial Features
- Add "Collected" functionality to Projections (track payments received)
- Export financial reports

### Access Control
- Consider RLS policies for `private_notes` field
- Database-level filtering for assistants/subcontractors

---

## Migration Checklist

Before deploying, ensure all migrations are run:

- [ ] Private Notes field added to `project_workflow_steps`
- [ ] `workflow_step_line_items` table created
- [ ] `workflow_projections` table created
- [ ] `email_templates` table created
- [ ] Customer DELETE RLS policy configured (`add_customers_delete_rls.sql`)
- [ ] RLS policies configured for all new tables
- [ ] Edge Functions deployed (`test-email`)
- [ ] Resend API key configured as Supabase secret
- [ ] Domain verified in Resend dashboard

---

## Testing

### Manual Testing Checklist

1. **Private Notes**:
   - [ ] Owner can see and edit private notes
   - [ ] Master can see and edit private notes
   - [ ] Assistant cannot see private notes
   - [ ] Subcontractor cannot see private notes

2. **Line Items**:
   - [ ] Can add line items to stages
   - [ ] Can edit line items
   - [ ] Can delete line items
   - [ ] Negative amounts display correctly
   - [ ] Ledger shows all line items
   - [ ] Amounts have comma formatting

3. **Projections**:
   - [ ] Can add projections
   - [ ] Can edit projections
   - [ ] Can delete projections
   - [ ] Total calculates correctly
   - [ ] Amounts have comma formatting

4. **Set Start**:
   - [ ] Modal opens with date/time picker
   - [ ] Can set custom start time
   - [ ] Start time saves correctly

5. **Calendar**:
   - [ ] Dates display in Central Time
   - [ ] Two-line format (stage + project)
   - [ ] Only shows assigned stages for assistants/subcontractors

6. **Access Control**:
   - [ ] Assistants only see assigned stages
   - [ ] Subcontractors only see assigned stages
   - [ ] Current user appears first in person assignment modal

7. **Email Templates**:
   - [ ] Can create/edit templates
   - [ ] Test email function works
   - [ ] Variables replace correctly

---

## Known Issues

1. **RLS Policy for People Table**: Owners may not see all people entries due to RLS restrictions. Consider updating RLS policy to allow owners to see all entries.

2. **Email Template Integration**: Templates are stored but not yet used by Edge Functions. Need to update `invite-user` and `login-as-user` functions.

3. **Workflow Notifications**: Stage notifications are tracked but not yet sent. Need to implement email sending in workflow stage transitions.

---

## Workflow Step Assignment Enhancements

### Autocomplete with Add Person Feature

**Location**: "Add Step" modal → "Assigned to" field

**Features**:
- **Searchable autocomplete dropdown** showing all masters and subcontractors
- **Real-time filtering** as you type (case-insensitive)
- **Source indicators**: Shows "(user)" for signed-up users, "(not user)" for roster entries
- **Add new person**: If name entered doesn't match any existing person, shows "Add [name]" option
- **Add person modal**: Prompts to add name, email, phone, and notes (similar to Add Subcontractor flow)
- **Automatic selection**: After adding, automatically selects the newly added person
- **Duplicate prevention**: Checks for duplicate names (case-insensitive) before saving

**Implementation**: 
- Queries `users` table for roles `'master_technician'` and `'subcontractor'`
- Queries `people` table for kind `'master_technician'` and `'sub'`
- Combines and deduplicates by name
- New persons default to `kind: 'sub'` (subcontractor)

**See**: `src/pages/Workflow.tsx` - `StepFormModal` component

---

## Related Documentation

- `PRIVATE_NOTES_SETUP.md` - Detailed private notes and line items documentation
- `EMAIL_TEMPLATES_SETUP.md` - Email templates database setup
- `EMAIL_TESTING.md` - Email testing and integration status
- `PROJECT_DOCUMENTATION.md` - Overall project architecture and patterns
