import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { CATALOG_RPCS, CATALOG_TABLES, EDGE_FUNCTIONS } from './catalog.ts'
import { DENIED_TABLES, FILTER_OPS, ROWS_DEFAULT_LIMIT, ROWS_MAX_LIMIT, buildRowsQuery, buildRpcQuery, isSafeIdent, redactSecrets, replyText, rpcArgNames, searchNames } from '../_shared/devMcpDoor.ts'
import { mcpHandler, mcpText, type McpTool, type McpToolResult } from '../_shared/mcpJsonRpc.ts'
import { findBid, findCustomer, findJob, findPerson, getBid, getCustomer, getJob, getOnSite, type Reader, type Row, type RowsQuery } from '../_shared/devMcpComposites.ts'
import { APP_CALENDAR_TZ, calendarYmdInAppTzFromIso, todayYmdInAppTz } from '../_shared/appTimeZone.ts'
import { getPersonFile } from '../_shared/devMcpPersonFile.ts'
import { getCaseBrief } from '../_shared/devMcpCaseBrief.ts'
import { getDocumentHistory } from '../_shared/devMcpDocHistory.ts'
import { getPersonDocument } from '../_shared/devMcpDocRead.ts'
import { getMatterDocument } from '../_shared/devMcpMatterDocRead.ts'
import { searchCase } from '../_shared/devMcpCaseSearch.ts'
import { PERSON_REPORT_SELECT, personReportAppliedWords, personReportDryRun, personReportRpc, type PersonReportPayload, type PersonReportRow } from '../_shared/devMcpPersonReport.ts'
import { PERSON_MATTER_PERSON_SELECT, PERSON_MATTER_STANDING_SELECT, personMatterAppliedWords, personMatterDryRun, personMatterRpc, type PersonMatterPayload, type PersonMatterPersonRow, type PersonMatterStandingRow } from '../_shared/devMcpPersonMatter.ts'
import { EVIDENCE_MAX_FILES, WRITE_VERBS, alreadyApplied, driveFilingRefusal, isWriteVerb, planHash, planMismatch, planReply, stateGuarded, writeRpcBody } from '../_shared/devMcpWrites.ts'
import { BILL_TIE_COLUMN, billAppliedWords, billDryRun, billInput, fullyInvoiced, readBillWorld, withBillLink, type BillPayload, type BillReads, type InvoiceRow, type PaymentRow, type SendOutcome } from '../_shared/devMcpBill.ts'
import { billTextLink } from '../_shared/gcKernels/lib/billing/billTextLink.ts'
import { billDollars } from '../_shared/gcKernels/lib/billing/newestBill.ts'
import { moneyCents } from '../_shared/gcKernels/lib/billing/openLineAllocation.ts'
import { COLLECTIONS_RPC, collectionsRpcBody, contractEndedPatch, jobLabelOf, jobMarkAppliedWords, jobMarkDryRun, readMarkJob, type JobMarkPayload, type JobMarkReads } from '../_shared/devMcpJobMarks.ts'
import { propertyPatch, propertyPatchBody, propertyLienReading, propertyRecordAppliedWords, propertyRecordDryRun, readPropertyWorld, type PropertyRecordPayload, type PropertyReads } from '../_shared/devMcpPropertyRecord.ts'
import { JOB_STATUSES, jobAppliedWords, jobUpdateAppliedWords, jobUpdateDryRun, newJobDryRun, readJobUpdateWorld, readNewJobWorld, type JobReads, type JobStatus, type JobUpdatePayload, type NewJobPayload } from '../_shared/devMcpJobs.ts'
import { getSubmittals, readSubmittalWorld, submittalAppliedWords, submittalDryRun, submittalWrites, type SubmittalPayload } from '../_shared/devMcpSubmittals.ts'
import { activityNoteAppliedWords, activityNoteDryRun, activityNoteRow, readActivityNoteWorld, type ActivityNotePayload } from '../_shared/devMcpActivityNote.ts'
import { PAYMENT_LINK_RPC, PAYMENT_REMOVE_RPC, PAY_ROW_COLS, jobPaymentAppliedWords, jobStatusWords, jobPaymentDryRun, payJobLabel, paymentInsertRow, paymentLine, paymentLinkRpcBody, paymentNoteBody, paymentWordsPatch, readJobPaymentWorld, type JobPaymentPayload, type JobPaymentReads, type PayRow } from '../_shared/devMcpJobPayment.ts'
import { bidPricedTotal } from '../_shared/devMcpBidPricing.ts'
import { bidPricesAppliedWords, bidPricesDryRun, readBidPricesWorld, type BidPricesPayload, type PlanPrice, type PriceOp } from '../_shared/devMcpBidPrices.ts'
import { bidLaborAppliedWords, bidLaborDryRun, laborCostFromWorld, readBidLaborWorld, type BidLaborPayload, type LaborReads, type PlanDirect, type PlanLaborRow } from '../_shared/devMcpBidLabor.ts'
import { bidTakeoffAppliedWords, bidTakeoffDryRun, materialsTotal, readBidTakeoffWorld, type BidTakeoffPayload, type PlanLine, type PlanTakeoffRow, type TakeoffReads } from '../_shared/devMcpBidTakeoff.ts'
import { COUNTS_INSERT_ACTION, bidCountsAppliedWords, bidCountsDryRun, readBidCountsWorld, sheetSummaryWords, type BidCountsPayload, type CountsReads, type PlanRemove, type PlanRow } from '../_shared/devMcpBidCounts.ts'
import { bidUpdateAppliedWords, bidUpdateDryRun, bidUpdateLanded, outcomeNoteRow, readBidUpdateWorld, type BidChange, type BidReads, type BidUpdatePayload } from '../_shared/devMcpBidUpdate.ts'
import { COMBINE_JOB_COLS, COMBINE_RPC, combineBoxPhotos, combineRpcBody, jobCombineAppliedWords, jobCombineDryRun, readJobCombineWorld, type CombineStop, type JobCombinePayload, type JobCombineReads } from '../_shared/devMcpJobCombine.ts'
import { SHEET_COLS, SHEET_PAYMENT_REMOVE_RPC, SHEET_PAY_COLS, laborJobLabel, laborPersonFacts, readSubLaborPaymentWorld, readSubLaborWorld, sheetBalance, sheetInsertRow, sheetItemRows, sheetOwedCents, sheetPaymentInsertRow, subLaborAppliedWords, subLaborCommitment, subLaborDryRun, subLaborNoteJobId, subLaborPaymentAppliedWords, subLaborPaymentDryRun, type JobMoney, type SheetPayRow, type SheetRow, type SubLaborPayload, type SubLaborPaymentPayload, type SubLaborReads } from '../_shared/devMcpSubLabor.ts'
import { EVIDENCE_FILE_MAX_BYTES, evidenceLinkProblem, evidenceMime, evidenceStoragePath } from '../_shared/personEvidence.ts'
import { getHoursStatement, hoursStatementClockLabel, prepareHoursStatementWrite, sendHoursStatementAsDev, type HoursStatementPrepared } from '../_shared/devMcpHoursStatement.ts'
import { hoursStatementLongDate } from '../_shared/hoursStatement.ts'
import { TDLR_TIMEOUT_MS, TDLR_TIMEOUT_REASON, cleanLicenseNumber, isTimeoutError, tdlrAnswer, tdlrNumberFor, tdlrQueryUrl, tradeCheckedByTdlr, type LicenseLevel, type LicenseTrade, type TdlrRow } from '../_shared/gcKernels/lib/logbook/licenseText.ts'
import { filedPlansSetRow, filedPlansTargets, filedPlansWords, planLinkKey, planPartApply, planPartDryRun, readPlanPartWorld, type FiledPlansJob, type FiledPlansPart, type PartReads, type PartWrites, type PlanPartPayload } from '../_shared/devMcpPlanSets.ts'
import { EDGE_BOOT_BATCH, HEALTH_RPCS, edgeBootBatch, edgeBootReport, healthReading, healthRpcArgs, isBootError, isHealthVerb, type EdgeBootProbe } from '../_shared/devMcpHealth.ts'
import { LEGAL_DOCUMENT_MAX_BYTES, LEGAL_MATTER_DOCUMENTS_BUCKET, legalDocumentIsText, legalDocumentMime, legalDocumentStoragePath } from '../_shared/legalMatterDocuments.ts'
import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1'
import { findExistingFile, findOrCreateFolder, googleAccessToken, uploadBytes } from '../_shared/driveUpload.ts'
import { GmailError, gmailAttachment, gmailMessage, gmailMessageHeaders, gmailMessagePage } from '../_shared/gmail.ts'
import { googleServiceToken } from '../_shared/googleToken.ts'
import { base64UrlBytes, readGmailMessage } from '../_shared/gcKernels/lib/emailIn/gmailMessage.ts'
import { MAIL_FILE_MAX_BYTES, MAIL_FILE_SLICE_MAX_BYTES, innerVerbFor, jobApplyReply, jobCommitment, jobPlanReply, mailFileAppliedWords, mailFileArgs, mailFileChangedWords, mailFileReadArgs, mailFileReadReply, mailFileTextArgs, mailFileTextReply, mailFileWhole, pickMailFile, MAIL_FILE_TEXT_MAX_CHARS, type MailFileBytes, type MailFileJobRef, type MailFileRaw } from '../_shared/devMcpMailFile.ts'
import { sha256Hex } from '../_shared/gcTradeLink.ts'
import { driveDocArgs, driveDocChangedWords, driveDocPlanExtra, driveDocSource, readDriveDoc, serviceAccountEmail, type DriveDocFacts } from '../_shared/devMcpDriveDoc.ts'
import { docEditApplyReply, docEditPlanReply, docEditQuery, docEditStored, prepareDocEdits, type DocEditPrepared } from '../_shared/devMcpDocEdits.ts'
import { mailTagAppliedWords, mailTagArgs, mailTagChangedWords, personTagApplyReply, personTagCommitment, personTagPlanReply, tagApplyReply, tagCommitment, tagPlanReply } from '../_shared/devMcpMailTag.ts'
import type { MyMailPersonTagOk, MyMailPersonTagPlanOk, MyMailTagOk, MyMailTagPlanOk } from '../_shared/gcKernels/lib/myMail/contract.ts'
import { GMAIL_READONLY_SCOPE, MAIL_HIT_HEADERS, MAIL_SEARCH_ACCOUNTS_CAP, MAIL_SEARCH_MAX_CAP, MAIL_SEARCH_MAX_DEFAULT, inBatches, mailDomain, mailHit, mailReadArgs, mailReadReply, mailRefusal, mailSearchArgs, mailSearchReply, type MailAccount, type MailAccountOutcome } from '../_shared/devMcpMailSearch.ts'
import { ROBOT_PLANS_SHARED_DRIVE, divisionBidFolderByKey, driveFolderUrl, robotPlansDivisionFolderName, robotPlansPathWords } from '../_shared/bidPlansFolders.ts'
import { indexContext, indexFiles, jobFilesToIndex } from '../_shared/fileIndex.ts'
import { recordsDue, recordsPass } from '../_shared/fileIndexRecords.ts'
import { recordBytesWhere } from '../_shared/fileIndexRecordsKernel.ts'
import { INDEX_PDF_LIMITS, INDEX_READ_MS, SWEEP_STAMP_KEY } from '../_shared/fileIndexKernel.ts'
import { readWithin, textFromBytes } from '../_shared/fileText.ts'
import { NO_REFILE_NEEDED, moveReplyWithRefileWords, movedPhotosInDrive, refiledForSeat } from '../_shared/boxPhotoRefile.ts'
import { ACCOUNT_PERSON_SELECT, ACCOUNT_USER_SELECT, NAME_KEYED_PAY_TABLES, accountAppliedWords, accountDryRun, accountFacts, addWorkerArgs, argsWithoutPasswords, authStateOf, createLoginBody, isAccountVerb, likeTerm as accountLikeTerm, loginAppliedWords, loginDryRun, loginStateReading, passwordResetAppliedWords, passwordResetDryRun, payConfigRow, personRefKind, pickByName, salaryTemplateRow, type AccountPayload, type AccountPersonRow, type AccountStep, type AccountUserRow, type AccountWorld, type AuthState, type LoginPayload, type PasswordResetPayload } from '../_shared/devMcpAccount.ts'
import { backfillAfterFilter, backfillApplyReply, backfillBatch, backfillCommitment, backfillJobPassedReply, backfillJobsQuery, backfillPlanReply, cursorLostWords, nextBackfillJob, parseBackfillPlan, statusReading, type BackfillJob, personBackfillApplyReply, personBackfillCommitment, personBackfillPlanReply, recordsBatch, type PersonBackfillFile } from '../_shared/devMcpIndexBackfill.ts'

// dev-mcp (to-dos/mcp-servers.md, PR 4b; owner decisions 2026-09-20) — the MCP server a
// DEV's agent reads PipeTooling through. Public address: https://mcp.clicktooling.com/dev
// (the mcp-router Worker, a pass-through).
//
// It reads AS THE DEV, not as the service role. A key (X-Dev-Token, or Authorization:
// Bearer) resolves to a person in dev_mcp_credentials; the function mints that person's
// own session (generateLink + verifyOtp — no email is sent, nothing is stored) and calls
// the app's own API with it, GET ONLY. PostgREST runs GET in a read-only transaction, so
// the database refuses a write whatever an RPC is named, and RLS plus every auth.uid()
// role check apply exactly as on the screen. The service role is used for three things
// only: resolving the key, minting the session, writing the call log.
//
// Writes (PR 6, v2.3722 / 0.4.0; the narrative v2.4814 / 0.5.0; a matter's planned steps v2.5800 / 0.6.0; a document
// on a matter's Evidence tab v2.6004 / 0.7.0; an answer on a packet gap v2.6005 / 0.8.0; a History line on a development v2.6044 / 0.9.0;
// a new bid v2.6183 / 0.10.0; its plan set into Drive and onto the bid v2.6185 / 0.11.0; a sworn statement drafted onto a
// matter's Timeline v2.6244 / 0.13.0; a set of drawings or a paper on a plan part v2.6317 / 0.14.0; Materials on site's
// presses v2.6367 / 0.16.0, behind the file index's 0.15.0, punch list #209; a piece of evidence on a person's HR file
// v2.6426 / 0.18.0, behind get_person_file's 0.17.0; clock sessions — the start and the end, the description, the job, the
// approval — v2.6437 / 0.19.0; a signed hours statement made, sent and filed on a matter v2.6414 / 0.20.0, punch list #212; a waiting field report filed or dismissed v2.6430 / 0.21.0; a teammate's license added or its date changed v2.6475 / 0.24.0, punch list #255)
// a matter opened on a person's HR file v2.6582 / 0.31.0, punch list #269 PR 3b)
// are a SECOND path, not a loosening of the first: forty-seven verbs
// (_shared/devMcpWrites.ts) — thirty-seven POST one of fifteen hard-coded, dev-gated RPCs as the dev (dev_on_site_write the
// one SECURITY INVOKER wrapper, so the rows land under the dev's own RLS); the four plan-part verbs (v2.6317) write the rows
// the job window's Plans section writes (plan_sets, plan_parts, a lane's request) as the dev under the same RLS, since no
// RPC exists for them; and the two report verbs (v2.6430) POST the HR queue's own file_person_report /
// dismiss_person_report after the server's own read of the report, and the two person-matter verbs (v2.6582) POST the
// HR file's own legal_person_matter_open after the server's read of the person and of any matter standing on them —
// plan_ is a dry run, apply_ re-runs the dry run and writes only when the agent quotes the
// plan's hash. Never a generic POST, never a table the agent names, never through view_as. One more
// (v2.6187 / 0.12.0): mint_twin_setup_code asks twin-setup for a ten-minute setup code as the
// dev — the key it leads to never crosses this door. The file index (v2.6332 / 0.15.0, punch list #240 PR 2):
// read_file_index_status reads dev_file_index_status as the dev; plan_index_backfill lists the jobs a backfill
// would walk under a plan_hash, and apply_index_backfill runs the one index pass (_shared/fileIndex.ts, the
// same code under drive-link's index_job and the sweep) over one job's next files per call, as the service
// role into file_index and never into Drive — the agent loops with a cursor; an apply may run as often as the
// plan has files left, so the one-apply-per-plan rule does not hold it.
// A person's HR file whole (v2.6422 / 0.17.0, numbered behind v2.6367's 0.16.0): get_person_file reads it as the People → HR tab draws it — the
// tab's own kernel (_shared/personTimeline.ts) over the tab's sources and keys (_shared/devMcpPersonFile.ts), as the
// reader under RLS, fail-soft per source; the HR sources are dev-only, so a view_as of the office sees the papers.
// A piece of evidence on that file (v2.6426 / 0.18.0): plan_person_evidence → apply_person_evidence, the record and its
// files (content_base64, each a name, mime, size and sha256 before the dry run) through dev_person_evidence_write; apply
// stages the files in the hr-files bucket as the dev before the rows and asks hr-evidence-drive after them, fail-soft.
// A waiting field report (v2.6430 / 0.21.0): plan_person_report → apply_person_report file it onto the person's file as
// the entry it becomes, or dismiss it with a reason, through the HR queue's own file_person_report / dismiss_person_report
// — no wrapper: the dry run is this server's read of the report, hashed with the ask (_shared/devMcpPersonReport.ts).
// get_job by the one card rule (v2.6468 / 0.23.0, behind its paged reads' 0.22.0): the card charges and the profit count
// as the Job window's profit band counts them, from the window's own lookups, and the man-hours read asks the server for
// the one job — an RPC result filter, checked as read_rows' filters are (buildRpcQuery).
//
// A teammate's account, from the seat (v2.6792 / 0.50.0, punch list #260's seat door; numbered behind v2.6790's 0.49.0, which merged first): plan_account → apply_account makes a person as
// the Hire form does or renames one, changes their role or address; plan_login → apply_login attaches a login to a row with none and
// sends the sign-in email (or sets a password, or removes the login); plan_password_reset → apply_password_reset sends the app's own
// Forgot password email or sets a dictated password; get_login_state reads where getting them online stands. Every write is the edge
// function or RPC the desk itself calls, as the dev (invokeAsDev / restPost), so the functions' own dev gates hold; the dry run is
// this server's read of the users row, the roster row and the auth account's stamps (devMcpAccount.ts) — the FOURTH thing the service
// role is used for, timestamps by id and nothing else, since no other door reads auth.users. A password never comes back and never
// reaches the log (argsWithoutPasswords).
//
// 0.57.0 (v2.6808, punch list #209, numbered behind v2.6804's 0.51.0, v2.6806's 0.52.0, v2.6793's 0.53.0, v2.6822's 0.54.0, v2.6794's 0.55.0 and v2.6795's 0.56.0, which merged first): plan_materials_move → apply_materials_move — everything a job holds on site moved
// to another job, for a count recorded under the wrong job. One RPC, dev_on_site_move_job, the one on-site wrapper that
// is SECURITY DEFINER (the ledger takes no update under anyone's RLS); it runs the whole-job combine's own rule, so every
// cage and box keeps its id and printed code, and its dry run does the move, counts both jobs and unwinds.
// read_mail_file in pieces (v2.6806 / 0.52.0, numbered behind v2.6804's 0.51.0, which merged first): the door cuts a reply at 80,000 characters, so a file over about 59 KB came back as
// base64 cut mid-string. A reply now carries at most MAIL_FILE_SLICE_MAX_BYTES of the file with offset, length and next_offset, the
// size and the sha256 of the whole, and the words that name the argument that reads on (devMcpMailFile.ts → mailFileReadReply).
//
// What a person signed (v2.6820 / 0.58.0, numbered behind v2.6808's 0.57.0, which merged first): get_person_file's reply carries signed_papers — one entry per paper signed in the app
// (person_contract_documents, status signed): the paper, the day, signed as, how (electronically, on paper, recorded by the office)
// and door.to, the Contracts tab's deep link to the signed record — the same list the Timeline's signed lines now open, so an
// agent reads what was signed without walking the months (personTimeline.ts → signedPapers). Hours statements too (Diane: "Statements
// too"): the Timeline's new statement source draws each one with where it stands, and the reply's hours_statements lists them
// with their doors (statementRows).
//
// The review of marks (v2.6844 / 0.59.0): plan_theme_review → apply_theme_review keeps the proposed theme marks named and takes
// the named marks off with a reason each, through dev_theme_review_write — the same two stamps the app's Keep press and
// Take it off… write, a list at a time, so a file's proposed marks are settled in one plan the owner reads first.
//
// A mailed file's words (v2.6880 / 0.60.0, punch list #296): read_mail_file_text hands back the words of a file off a mail
// instead of its base64 — a PDF's text layer, a text file, an .eml decoded — read by the file index's own reader
// (fileText.ts → textFromBytes, the index's limits for one file in a request) and paged by character, at most
// MAIL_FILE_TEXT_MAX_CHARS a reply (devMcpMailFile.ts → mailFileTextReply). Every call parses the file again, since the
// function keeps nothing between calls: 40 written pages measured about 120 ms locally, about 350 ms on the platform,
// inside the reader's 800 ms for one file. A scan answers in words that name read_mail_file. Read-only and logged.
//
// The files follow a job that moved (v2.6885 / 0.61.0, punch list #297): after apply_materials_move's rows land, the
// server asks photo-save, as the dev, to move the box photos already filed in Drive into the new job's photo folder
// ({ refile_box_photos: to_job }), and adds the answer to the reply as photos.refiled — moved, already there, held with
// the reason each. A failed ask never undoes the move. The plan's and the apply's photo words say so
// (boxPhotoRefile.ts → movePhotoWordsWithRefile); the hash is still of the database's own reply.
//
// A file placed in the body is a file (v2.6909 / 0.62.0): Apple Mail places a PDF in the body of a mail
// (Content-Disposition: inline). read_mail listed it, and read_mail_file, read_mail_file_text and plan_mail_file could
// not pick it: "That mail carries no file". The seat now lists and picks by one rule, the mail reader's own (fileKeep,
// through devMcpMailSearch.ts → isMailFile): everything but a small picture placed in the body, a signature's logo.
//
// A large case fits the door (v2.6935 / 0.63.0): on a file of fifty documents and two hundred entries get_case_brief and
// get_person_file answered past the 80,000 characters replyText cuts at, so the brief lost every block after documents and
// the file's lines were cut mid-text. Both now shorten themselves in a fixed order (devMcpReplyFit.ts → fitReply) and name
// each shortened block in `shortened` with the call that reads it whole. get_person_file takes brief (or line_chars) for
// short lines and until to read a long Timeline on, with next_until the day to pass; the HR entries are read a page at a
// time (readAllRows), so the count is exact past 200.
//
// A payment on a job, and one job combined into another (v2.6940 / 0.65.0; the owner, 2026-11-11: "lets add verbs to do
// it"): plan_job_payment → apply_job_payment removes a payment row through the Job window's own
// remove_jobs_ledger_payment_and_reconcile with the reason left on the job's activity, records one as the payments
// table writes it, or ties one to its bank row through Accounts Receivable's apply_mercury_bank_payment_allocations
// (devMcpJobPayment.ts); plan_job_combine → apply_job_combine is Pipeline's Combine, one POST of
// migrate_job_ledger_costs_and_delete as the dev, its plan the server's read of both jobs, what would move and every
// reason it would stop, and its apply behind confirm_no_undo: true (devMcpJobCombine.ts). No wrapper RPC, no
// migration. restCount is the one new read: a GET that asks PostgREST for an exact count, as the dev.
//
// Every list past 200 rows (v2.6939 / 0.66.0): both verbs read each of their sources a page at a time — the attachments,
// the evidence, the reports, the papers, the licenses, the documents, the theme marks, the matter's steps and documents
// — and a list of ids a hundred at a time (readRowsByIds), so a record keeps its files and a theme its count on a file
// with more than 200 of them. at_cap (the file) and held (the brief) name a list only past readAllRows' own 5,000.
//
// 0.70.0 (v2.6945, the bid train's PR 1 — to-dos/mcp-servers.md → The bid train; the owner, 2026-11-11, preparing to
// enter bids for proposals sent months ago: "add verbs to not only do those things you mentioned it cannot do"):
// plan_bid_update → apply_bid_update changes a bid as Edit Bid and the Bid Board change it — the form's columns as one
// PATCH on bids under RLS as the dev, the columns that ride with an outcome, a due date or a cleared sent date written
// with it as the form writes them, then the line the form leaves on the bid's notes when the outcome moves
// (devMcpBidUpdate.ts). The decided day is outcome_at, which the database's trigger takes from an explicit write; the
// sent date lands as the Cover Letter's Mark sent lands it, with no checklist, since the three lines are a person's own
// word; on a bid with versions the bid's own Sent and Won / Lost are refused, as the form locks them. The plan says what
// the database does after: the decided day, the labor mint and the shadow score on a first sent date, the History
// lines, and that a win opens no job. No wrapper RPC, no migration.
//
// 0.72.0 (v2.6967, the bid train's PR 2): plan_bid_counts → apply_bid_counts writes a bid's count rows as the Counts
// tab writes them — a row added as the Count Sheet's quick add adds it (the active version, after the bid's last row,
// the unit pinned, tagged as the sheet's import for the bid's History), changed as the inline edit changes it, removed
// as its delete removes it, and an alternate group joined to bids.alternate_group_tags (devMcpBidCounts.ts). The key is
// the sheet's own rule, one row a fixture in a scope (the base bid or one alternate). A row with a fault is held with
// its reason and the rest goes on; a plan with nothing ready is refused. restRows takes DELETE and extra headers for it.
// No wrapper RPC, no migration.
//
// 0.74.0 (v2.6968, the bid train's PR 3): plan_bid_takeoff → apply_bid_takeoff writes what the Takeoffs tab holds on a
// count row — its part lines, each as the tab's own save writes it (the quantity for one counted unit, the book's lowest
// price and its price row when no price is given, how the part is sold snapshotted, after the row's last line), and the
// quoted materials cost each (bid_count_row_custom_costs, one a row) (devMcpBidTakeoff.ts). One line a part on a row:
// the line that carries the part is changed, a new part is added, replace rewrites the row's lines whole. The plan
// states the bid's materials before and after through the tab's own kernel (combinedMaterials, from the kernel copy).
// No wrapper RPC, no migration.
//
// 0.75.0 (v2.6976, the bid train's PR 4): plan_bid_labor → apply_bid_labor writes what the Labor tab holds — the
// estimate's boxes (cost_estimates, made when the bid has none, as the tab makes it), the hours on the labor rows of the
// counted fixtures (a row changed, or minted as the tab's sync mints it, with source typed and the queue's note so the
// database's mint on a first sent date leaves them alone; a fixture nobody counts is held), and the five direct cost
// tables' lines, found again by kind and note (devMcpBidLabor.ts). The plan states the tab's "Direct cost of this bid"
// before and after through computeBidCostBreakdown at the bid's own rate. It never teaches the labor book. No wrapper
// RPC, no migration.
//
// 0.77.0 (v2.6990, the bid train's PR 5a): get_bid.totals is no longer a sentence. It reads what the Pricing tab reads,
// picks the open pricing by the tab's own rule (pickActiveVersion, deriveActivePricingId, with nobody's last-used book) and
// states the grid's revenue total through scenarioPricingRows from the kernel copy (devMcpBidPricing.ts). Revenue never
// reads the labor rate; cost and margin stay the tab's, and the reply names the margin it last stamped.
//
// 0.78.0 (v2.6992, the bid train's PR 5b): plan_bid_pricing → apply_bid_pricing sets a count row's unit price as Bids →
// Pricing sets it (writeUnitPriceOverrideRow: the assignment's override, else a new assignment on the row's book entry,
// else a custom price), on the pricing the tab opens on (devMcpBidPrices.ts over devMcpBidPricing.ts). On a shared book
// the apply copies it to the bid FIRST (clone_price_book_version_to_bid, SECURITY INVOKER, as the dev), points the bid at
// the copy and plans again there, where the tab writes on the shared book and copies after. A sent bid needs revise: true
// (the tab's Revise press); the robots' book is refused; the margin stamp is the tab's. No wrapper RPC, no migration.
//
// Sub labor on a job (v2.6944 / 0.71.0; the owner, 2026-11-11: "Do we have the dev verbs to add sub labor?" then "Can you
// help me add those verbs?"): plan_sub_labor → apply_sub_labor makes, changes or removes a sheet as Jobs → Subs → Pay's
// New Sub Labor and Edit window write it (people_labor_jobs, its assignee row, people_labor_job_items), and
// plan_sub_labor_payment → apply_sub_labor_payment records what was paid against one as Make Payment does, or removes a
// payment through remove_labor_job_payment (devMcpSubLabor.ts). A sheet has no column for a note, a span or where its
// days came from, so the stated mark rides in the lines' words and the rest on the job's activity; a payment has none
// for a bank row, so the plan reads the row and warns when it is already allocated to a job as cost. No wrapper RPC,
// no migration. restDelete is the one new write: a DELETE by query, as the dev under RLS, for the Edit window's
// Delete, a change's old lines and a sheet whose lines were refused.
//
// 0.73.0 (v2.6950, the first of the Lien desk's verbs; the owner, 2026-11-11: "everything a user can do a dev can do",
// after a homestead found on the county's page had no verb to mark it): plan_property_record → apply_property_record
// changes a property record's lien facts as the Property record row, Edit customer's Properties and the Lien desk's
// property window save them — one PATCH on customer_addresses under RLS as the dev, the record named by a job or by its
// own id, with every job that follows the change named in the plan (devMcpPropertyRecord.ts). No wrapper RPC, no
// migration.
//
// 0.76.0 (v2.6986; the owner, 2026-11-11: "Because only devs and council can see the council only things, I think it's
// totally fine for an agent to", then "Yes, those too"): counsel-only material is read by this seat. The six restrictive
// policies and dev_matter_doc_read's refusal now also ask counsel_only_held_from_seat(), which answers false (migration
// 20261112090000), so a counsel-only evidence record, its files and indexed text, the correction links that touch one and
// a counsel-only matter document come back with the rest, each marked counsel_only. get_person_file and get_case_brief
// name a hold only for counsel-only items the count names that the read did not hand back (devMcpCounselOnly.ts), so
// they read right whichever way the switch stands. The Drive filer, the firm's portal and print, and the hr_agent key
// keep their fences.
//
// catalog.ts is GENERATED from src/types/database.ts by scripts/build-dev-mcp-catalog.mjs
// — regenerate after gen-types, then redeploy.

const SERVER_VERSION = '0.78.0'
const UUID_SHAPE = /^[0-9a-fA-F-]{36}$/

const TOOLS: McpTool[] = [
  {
    name: 'whoami',
    description: 'Who this key reads as (name, email, role) and the limits of the door. Call it first: every other verb sees exactly what this person sees in the app.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'find_rpc',
    description: "Search the app's RPCs (database functions) by name — every word must appear, e.g. 'job ledger' or 'crew day'. Returns up to 25 names with their arguments and return shape, from the generated catalog. Use it before call_read; never guess a name.",
    inputSchema: { type: 'object', properties: { text: { type: 'string', description: "Words from the name, e.g. 'search jobs'" } }, required: ['text'] },
  },
  {
    name: 'find_table',
    description: "Search tables and views by name — every word must appear, e.g. 'ledger payments'. Returns up to 25 names with their kind and column count. Then get_table for the columns.",
    inputSchema: { type: 'object', properties: { text: { type: 'string', description: "Words from the name, e.g. 'clock sessions'" } }, required: ['text'] },
  },
  {
    name: 'get_table',
    description: 'The columns and types of one table or view, from the generated catalog. Columns marked secret are redacted from every reply and cannot be filtered on.',
    inputSchema: { type: 'object', properties: { table: { type: 'string', description: 'Exact table or view name' } }, required: ['table'] },
  },
  {
    name: 'call_read',
    description: "Call any RPC as yourself, read-only. It goes over GET, which the database runs in a read-only transaction: an RPC that writes fails with 'cannot execute … in a read-only transaction' — that is the door working, not a bug; such an RPC is not a read. Arrays and objects are fine as args; omit an arg to take its SQL default. For a set-returning RPC, `limit` trims the rows.",
    inputSchema: {
      type: 'object',
      properties: {
        rpc: { type: 'string', description: 'Exact RPC name (find_rpc)' },
        args: { type: 'object', description: 'Named arguments, as find_rpc lists them' },
        limit: { type: 'number', description: `Rows to return from a set-returning RPC (1–${ROWS_MAX_LIMIT})` },
      },
      required: ['rpc'],
    },
  },
  {
    name: 'read_rows',
    description: `Read rows of a table or view as yourself — RLS applies, so an empty result can mean "not visible to you". PostgREST select syntax (embeds like 'id,job_name,customers(name)' work). Default ${ROWS_DEFAULT_LIMIT} rows, at most ${ROWS_MAX_LIMIT}.`,
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string', description: 'Exact table or view name (find_table)' },
        select: { type: 'string', description: "Columns, PostgREST syntax. Default '*'" },
        filters: {
          type: 'array',
          description: `[{ column, op, value }] — op is one of ${FILTER_OPS.join(', ')}; 'in' takes an array, 'is' takes null/true/false; like/ilike use * as the wildcard`,
          items: { type: 'object' },
        },
        order: { type: 'array', description: '[{ column, ascending? }]', items: { type: 'object' } },
        limit: { type: 'number', description: `1–${ROWS_MAX_LIMIT}, default ${ROWS_DEFAULT_LIMIT}` },
      },
      required: ['table'],
    },
  },
  {
    name: 'find_job',
    description: "Find jobs by number ('J1032', '1032'), name or address — the app's own job search. Returns ids with the label the app shows. Use the id with get_job.",
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  },
  {
    name: 'find_bid',
    description: "Find bids by number ('b482'), project or customer — the app's own bid search. Returns ids with the label the app shows.",
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  },
  {
    name: 'find_customer',
    description: 'Find customers by name (active ones). Returns ids.',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  },
  {
    name: 'find_person',
    description: 'Find people by name, as the rosters list them: active, human, not a sample account. Returns ids with role.',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  },
  {
    name: 'get_job',
    description: "What the Job window shows for one job: the header, the money (profit = revenue − the four parts buckets − sub labor, the card charges counted by the window's one card rule, and billed / open — computed by the Job window's own kernels), invoices and payments, the account strip, stages, hours, and recent activity. `job` is an id, or text that matches exactly one job. A part that could not be read says so in place.",
    inputSchema: { type: 'object', properties: { job: { type: 'string', description: "Job id, or a number like 'J1032'" } }, required: ['job'] },
  },
  {
    name: 'get_customer',
    description: "What the Customer hub shows: the profile, the money (lifetime value, open balance, aging, days-to-pay — the hub's own kernels), contacts, addresses, jobs, bids and estimates. `customer` is an id, or a name that matches exactly one customer.",
    inputSchema: { type: 'object', properties: { customer: { type: 'string' } }, required: ['customer'] },
  },
  {
    name: 'get_bid',
    description: "One bid's stored facts: the row, count rows, pricing assignments, versions, sends, the submission ledger and the account strip. Since v2.6990 `totals` is the Pricing grid's revenue total, to the cent, through the tab's own kernel (scenarioPricingRows): the pricing the tab opens on (its ★ on the active version, else its own copy, else the shared book it falls back on), the count rows priced and not, and the margin the tab last stamped. Cost and margin stay the tab's to compute. `bid` is an id, or text that matches exactly one bid.",
    inputSchema: { type: 'object', properties: { bid: { type: 'string', description: "Bid id, or a number like 'b482'" } }, required: ['bid'] },
  },
  {
    name: 'get_submittals',
    description: "Where a bid's submittals stand, in one call (v2.6804), as Bids → Submittals reads them: every revision with its line (Rev 2 · shared with the GC · 6 rows · 2 approved, 1 sent back), the working revision's rows (tag, what the plans specified, what is submitted, the status against the plans in words, the reason, lead time, supply house, cut sheet pages, their answer), and the order log from the tab's own kernels — the four steps with their counts (Waiting on the GC · To order · On order · On site), the Next line, and every line with its key, step, status, order-by, ordered, PO, expected and delivered dates. Also the review room and who opened it, the updates sent to the GC, what is missing before anything can be ordered, the log's delivered count beside Materials on site's own rows (two facts that do not write each other), and status_text: the whole status in plain words, ready to read back or paste. Reads only; nothing is sent to anyone. `bid` is an id, or text that matches exactly one bid.",
    inputSchema: { type: 'object', properties: { bid: { type: 'string', description: "Bid id, or a number like 'b398'" } }, required: ['bid'] },
  },
  {
    name: 'check_sampler',
    description: "Was the database frozen? Gaps over 90 s in the per-minute health sampler (each one is a freeze window) and the slowest sample (over ~250 ms is the early warning), over the last `hours`. Survives a restart — docs/DB_FREEZE_RUNBOOK.md Step 2. Devs only.",
    inputSchema: { type: 'object', properties: { hours: { type: 'number', description: 'Look back this many hours (1–336, default 24)' } } },
  },
  {
    name: 'check_connections',
    description: 'The newest connection sample: the total against max_connections, the breakdown by state / wait event and by database role, and how old the sample is (a stale sample means the sampler stopped). Devs only.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'check_locks',
    description: "Live, right now: every backend waiting on a lock, the backend blocking it (with how long its transaction has been open and its statement, cut at 300 characters), and transactions left idle over 60 s. Mode A's answer in the freeze runbook. It reads; it never terminates anything. Devs only.",
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'check_migration_ledger',
    description: "The newest `n` rows of the migration ledger (version + name) and the applied count. This server has no repo: hold the list against `git ls-tree origin/main supabase/migrations/` yourself. `npm run check:migration-drift` stays the authority. Devs only.",
    inputSchema: { type: 'object', properties: { n: { type: 'number', description: 'Rows to return (1–100, default 15)' } } },
  },
  {
    name: 'check_edge_boot',
    description: `OPTIONS-probes the repo's edge functions (a generated list, in name order) and names any that answers 503 BOOT_ERROR — deployed but unable to start, which the drift check cannot see. One call probes ${EDGE_BOOT_BATCH}: the platform allows a function about 60 calls a minute to other functions, so the reply carries next_after — call again with after: <that name>, about a minute later, until it is null. Sends nothing but OPTIONS. Devs only.`,
    inputSchema: { type: 'object', properties: { after: { type: 'string', description: 'Continue after this function name (the previous reply\'s next_after). Omit to start from the top.' } } },
  },
  {
    name: 'plan_cost_batch',
    description: "Dry-run a cost batch (docs/COST_BATCHES.md): moves job cost — bank allocations, supply invoices, clock sessions, ESTIMATE other-charges, thread notes — as one audited, revertible batch. Performs every write and unwinds it; replies with the summary by job, each op's before/after, and a plan_hash. Nothing is written.",
    inputSchema: { type: 'object', properties: { batch: { type: 'object', description: 'The cost_batch_apply payload: { label, reason, source_ref?, ops: [{ op, ... }] }' } }, required: ['batch'] },
  },
  {
    name: 'apply_cost_batch',
    description: 'Apply a cost batch you planned: the same batch plus the plan_hash from plan_cost_batch. Runs the dry run again first and writes only when it still matches. Replies with the batch_id (for revert_cost_batch). Written as you; refused for anyone but a dev, and in training mode.',
    inputSchema: { type: 'object', properties: { batch: { type: 'object' }, plan_hash: { type: 'string', description: 'From the plan reply — the whole 64-character value' } }, required: ['batch', 'plan_hash'] },
  },
  {
    name: 'revert_cost_batch',
    description: 'Revert an applied cost batch from its before-images, one shot, with a reason in words (written on the batch). Revert, then apply a corrected batch — never patch.',
    inputSchema: { type: 'object', properties: { batch_id: { type: 'string', description: 'cost_batches.id — the batch_id apply replied with' }, reason: { type: 'string' } }, required: ['batch_id', 'reason'] },
  },
  {
    name: 'plan_hr_entry',
    description: "Dry-run an HR file entry (docs/HR_FILES.md): entries to append to a person's file, and/or a summary or narrative rewrite. Validates like the real write and unwinds it; replies with the person, what would be filed, and a plan_hash. You are named as the author, whatever the payload says.",
    inputSchema: { type: 'object', properties: { entry: { type: 'object', description: "hr_agent_write's payload: { person_id (find_person), entries?: [{ entry_date, content, source? }], summary?, narrative? | narrative_append?, covered_through? }" } }, required: ['entry'] },
  },
  {
    name: 'apply_hr_entry',
    description: 'File the HR entry you planned: the same entry plus the plan_hash from plan_hr_entry. Runs the dry run again first and writes only when it still matches. Entries are append-only; a correction is a new entry.',
    inputSchema: { type: 'object', properties: { entry: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['entry', 'plan_hash'] },
  },
  {
    name: 'search_mail',
    description: "One Gmail search across the company's own mailboxes (v2.6565): as each login of the Workspace, under the service account's domain-wide delegation with the read-only scope alone, so a supply-house bill, a job's thread or a pattern is found wherever it landed. Each hit is the account, Gmail's ids, From, To, Cc, Subject, Date and the snippet; read_mail reads one whole. Every search is logged with its query and its accounts. Read-only: nothing is labelled, moved, trashed or deleted, and the scope Google grants cannot.",
    inputSchema: { type: 'object', properties: { q: { type: 'string', description: "The search as a person types it in Gmail's box: from:someone@supplier.com, subject:\"invoice 4471\", \"Lot 12\" has:attachment, newer_than:30d" }, accounts: { type: 'array', items: { type: 'string' }, description: 'The logins to search — an address, its local part or the name People uses; every current login when left out' }, include_archived: { type: 'boolean', description: 'Also the archived logins (when accounts is left out)' }, since: { type: 'string', description: 'YYYY-MM-DD, mail on or after' }, until: { type: 'string', description: 'YYYY-MM-DD, mail before' }, max: { type: 'number', description: `Hits an account hands back, 1 to ${MAIL_SEARCH_MAX_CAP}; ${MAIL_SEARCH_MAX_DEFAULT} when left out` } }, required: ['q'] },
  },
  {
    name: 'read_mail',
    description: "One mail whole from a search_mail hit (v2.6565): its headers, the reader's words as plain text (up to 30,000 characters), its labels and its files by name, kind and size (a file placed in the body of the mail included, as Apple Mail places a PDF; a signature's small logo left out). The bytes stay in Gmail. Read-only, under the same delegation and scope.",
    inputSchema: { type: 'object', properties: { account: { type: 'string', description: 'The address the hit names' }, id: { type: 'string', description: "The hit's Gmail id" } }, required: ['account', 'id'] },
  },
  {
    name: 'read_mail_file',
    description: `One file off a search_mail hit (server 0.29.0; in pieces since 0.52.0): read from Gmail on the server by its name as read_mail lists it, up to 10 MB, handed back as content_base64 with its mime, its size_bytes and the sha256 of the whole file. A reply carries at most ${MAIL_FILE_SLICE_MAX_BYTES} bytes, since the door cuts a reply at 80,000 characters: a file that fits comes whole, and a larger one comes a piece at a time with offset, length and next_offset. Call again with offset set to next_offset until it is null, decode each piece, join the bytes in order and check them against sha256; the reply's read_next says so in words. Read-only. When the file belongs on a job, a person's file or a matter, plan_mail_file files it there without the bytes passing through you.`,
    inputSchema: { type: 'object', properties: { account: { type: 'string', description: 'The address the hit names' }, id: { type: 'string', description: "The hit's Gmail id" }, name: { type: 'string', description: "The file's name as read_mail lists it" }, offset: { type: 'number', description: "The byte to start at: 0 when left out, then each reply's next_offset" }, length: { type: 'number', description: `How many bytes to hand back, for a caller that wants smaller pieces; at most ${MAIL_FILE_SLICE_MAX_BYTES}, which is also what a reply carries when this is left out` } }, required: ['account', 'id', 'name'] },
  },
  {
    name: 'read_mail_file_text',
    description: `The words of one file off a search_mail hit (server 0.60.0), where read_mail_file hands back its bytes: a PDF's text layer, a text file (.txt, .csv, .md) or an email (.eml) decoded, read on the server by the file index's own reader, by the file's name as read_mail lists it. This is the cheap way to read a supplier's PDF: its words cost a fraction of its base64. A reply carries at most ${MAIL_FILE_TEXT_MAX_CHARS} characters of text, ending on a line, with text_source (pdf_layer | plain), a PDF's pages and pages_read, chars (the whole text's length), the file's size_bytes and sha256, and next_offset: call again with offset set to next_offset until it is null; read_next says so in words. A scan or a picture has no text layer and is refused in words, as are a kind the reader does not read (a spreadsheet, a Word file) and a PDF it cannot open: read those with read_mail_file. Read-only.`,
    inputSchema: { type: 'object', properties: { account: { type: 'string', description: 'The address the hit names' }, id: { type: 'string', description: "The hit's Gmail id" }, name: { type: 'string', description: "The file's name as read_mail lists it" }, offset: { type: 'number', description: "The character of the text to start at: 0 when left out, then each reply's next_offset" } }, required: ['account', 'id', 'name'] },
  },
  {
    name: 'plan_mail_file',
    description: "Dry-run filing one file off a search_mail hit where it belongs (server 0.29.0): the file is read from Gmail on the server (never through you, up to 10 MB) and the plan commits to its bytes. to.kind job lands it in the job's Drive folder as the Documents tab's Add a file does (drive-link's put, as you: where top | plans | pictures | sent | photos, top when left out); person_evidence makes the evidence record plan_person_evidence makes, the file as its one file; matter_document makes the document plan_matter_document makes. Replies with the plan and a plan_hash; the evidence and document kinds reply as their own plan verbs do. Nothing is written.",
    inputSchema: { type: 'object', properties: { file: { type: 'object', description: "{ account, id, name, to: { kind: 'job', jobs_ledger_id | bid_id | project_id, where? } | { kind: 'person_evidence', person_id, dated_on, title, memo, entry_id?, counsel_only? } | { kind: 'matter_document', matter_id, title, shows, dated_on?, state?, received_on?, sent_on?, sent_how?, sent_to? } }" } }, required: ['file'] },
  },
  {
    name: 'apply_mail_file',
    description: 'File the mail file you planned: the same file plus the plan_hash from plan_mail_file. Reads the file off the mail again and writes only when the job, the landing and the bytes are what the plan saw; the evidence and document kinds run their own dry run again first. One apply per plan.',
    inputSchema: { type: 'object', properties: { file: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['file', 'plan_hash'] },
  },
  {
    name: 'plan_mail_tag',
    description: "Dry-run tagging a whole Gmail conversation onto a job (server 0.30.0): out of the box of the login named, as that person, through gmail-mine's own tag — the Messages → My email press — so every mail lands on the job's Activity and notes at its own time, a line the boxes already hold is tied instead of written twice, and later mail in the conversation follows by itself. The plan lists each mail with what the tag would do (write, tie, skip and why), the counts, and the job the conversation was on before when a tag would move it. Nothing is written. Find the conversation with search_mail (a hit's thread_id) and the job with find_job. Since server 0.42.0 (punch list #289) the target may be a person instead — tag.person: { person_id } (find_person): each mail becomes a dated entry on that person's HR file (From, To, Cc, Subject, Sent, the files by name and size, the body as plain text), on the mail's own day, as you, carrying its Gmail id, so a mail the file already holds is left and later mail follows as entries; an archived login's box may be read for it. tag.person.stop: true plans lifting that follow instead: the row goes, every entry stays.",
    inputSchema: { type: 'object', properties: { tag: { type: 'object', description: "{ account (the address the hit names), thread_id (the hit's thread_id), job: { jobs_ledger_id | bid_id | project_id } | person: { person_id, stop? } }" } }, required: ['tag'] },
  },
  {
    name: 'apply_mail_tag',
    description: "Tag the conversation you planned: the same tag plus the plan_hash from plan_mail_tag. Plans again first and tags only when the conversation and the job are as the plan saw them; writes the lines, keeps the files, changes nothing in that person's Gmail, and arms the follow. For a person target (0.42.0) it writes the entries on the HR file as you and arms the follow as entries; with stop it lifts the follow. One apply per plan.",
    inputSchema: { type: 'object', properties: { tag: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['tag', 'plan_hash'] },
  },
  {
    name: 'check_license',
    description: "A license number against the state's own record (punch list #255). Electrical and HVAC licenses are TDLR's, read from its open list on data.texas.gov: the holder, the type and the expiry of the license of this trade and level under that number (one number can belong to several types). Plumbing licenses are TSBPE's, which keeps no open list and whose search asks for a robot check, so a plumbing number is refused with the search's address for a person. Read-only. Check before plan_license, and put where the date came from in its note.",
    inputSchema: { type: 'object', properties: { trade: { type: 'string', description: 'electrical | hvac (plumbing is refused with the TSBPE search)' }, level: { type: 'string', description: 'electrical: apprentice | journeyman | master | contractor; hvac: registered_tech | certified_tech | contractor' }, number: { type: 'string', description: "As on the license: '783430', 'TACLA39079E'" } }, required: ['trade', 'level', 'number'] },
  },
  {
    name: 'plan_license',
    description: "Dry-run a teammate's license (punch list #255): add one, or change one's level, number, expiry or note. Pass license_id (read_rows on person_licenses by person_name) to change one; leave it out and name the person exactly to add one. The license's words are written for you from trade, level and number, the logbook's own way, so it reads back as the same license. Replies with the person, the license before and after, whether the new date is past, every license the person holds, and a plan_hash. A license is never deleted here. Written as you; devs only.",
    inputSchema: { type: 'object', properties: { license: { type: 'object', description: '{ license_id? (to change one), person_name? (to add one), trade (plumbing | electrical | hvac | other), level (plumbing: apprentice | tradesman | journeyman | master; electrical: apprentice | journeyman | master | contractor; hvac: registered_tech | certified_tech | contractor; not for other), other_name? (other only, such as Notary), number, expires (YYYY-MM-DD), note? }' } }, required: ['license'] },
  },
  {
    name: 'apply_license',
    description: "Write the license you planned: the same license plus the plan_hash from plan_license. Runs the dry run again first and writes only when it still matches. Dispatch hears of a license that expires within 30 days, as the Licenses tab's Save tells it; a later date arms that notice again.",
    inputSchema: { type: 'object', properties: { license: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['license', 'plan_hash'] },
  },
  {
    name: 'plan_person_evidence',
    description: "Dry-run a piece of evidence on a person's HR file (docs/HR_FILES.md → Evidence): a record — the day it is about, a title, a memo on what it shows and why it matters — and its files, sent as content_base64 (a photo, a PDF, an email as .eml, a screenshot; each under 10 MB, at most 20 files a record) or, for a file already in Drive — a recording over the cap, a file the office filed by hand — as { name, drive_url }, which is linked and never staged (v2.6541). The server turns each sent file into its name, mime, size and sha256 before the dry run, so the plan commits to the files themselves; replies with the person, the record as it would be written, where it lands in Drive (People › the person › the day · the title), whether the People folder is set, and a plan_hash. Nothing is written or stored. You are named as the author.",
    inputSchema: { type: 'object', properties: { evidence: { type: 'object', description: "{ person_id (a people.id — get_person_file resolves a login or a name), dated_on (YYYY-MM-DD, not ahead of today), title (under 160), memo (under 4,000), entry_id? (the person_file_entries.id it proves), files: [{ name (with its extension), content_base64, mime? } | { name, drive_url (a file already in Drive) }] }" } }, required: ['evidence'] },
  },
  {
    name: 'apply_person_evidence',
    description: 'Keep the evidence you planned: the same evidence plus the plan_hash from plan_person_evidence. Runs the dry run again first and writes only when it still matches. Stages each sent file in the private hr-files bucket as you, writes the record and its file rows as you (a linked file as its address alone; append-only: a correction is a new record), then asks hr-evidence-drive to file the staged ones into the People Shared Drive — fail-soft: a refusal leaves the record standing as not in Drive, and the sweep tries again every ten minutes while a file waits. A record of linked files alone never asks Drive. One apply per plan.',
    inputSchema: { type: 'object', properties: { evidence: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['evidence', 'plan_hash'] },
  },
  {
    name: 'plan_person_report',
    description: "Dry-run filing or dismissing a waiting field report (the queue at the top of People → HR and the waiting line on a person's Timeline; docs/HR_FILES.md → Pending reports). Replies with the report as it stands (its day, who wrote it, their words, the person), the HR entry as file_person_report would write it — dated the day it happened, source report unless you say otherwise, the reporter as author, the RPC's own preamble around their words unless you pass tightened content — or the dismissal with its reason, and a plan_hash. Nothing is written. A report already filed or dismissed is refused in words. The queue: read_rows on person_reports with status eq pending, oldest first; a person's waiting reports: get_person_file.",
    inputSchema: { type: 'object', properties: { report: { type: 'object', description: "{ report_id (a person_reports.id), action: 'file' | 'dismiss'; file: content? (the entry's words when you tighten them — keep the author's facts), source? (report when left out); dismiss: reason (required, kept on the report) }" } }, required: ['report'] },
  },
  {
    name: 'apply_person_report',
    description: "File or dismiss the report you planned: the same report plus the plan_hash from plan_person_report. Reads the report again first and writes only when it still stands as planned — a report filed, dismissed or edited since refuses; plan again. Filing appends the append-only HR entry and marks the report filed with the entry's id through file_person_report; dismissing keeps the report with its reason, off the queue, through dismiss_person_report. Written as you; the author sees the status on their Dashboard card. Fold a filed entry into the summary afterwards with plan_hr_entry.",
    inputSchema: { type: 'object', properties: { report: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['report', 'plan_hash'] },
  },
  {
    name: 'plan_matter_open_person',
    description: "Dry-run opening a matter on a person's HR file (v2.6582, punch list #269): the analysis for counsel — a narrative for the firm, documents with what each shows, a timeline of steps and events — standing on the person instead of a Collections payer (docs/HR_FILES.md → The tab → Matter). Replies with the person as the roster has them, the matter as legal_person_matter_open would open it (kind person, Under review, nothing released, the handling name if you gave one), what to write on it next, and a plan_hash. Nothing is written. One matter a person: when one already stands the plan is refused and names it with its matter_id and stage — write on that matter instead (plan_matter_narrative, plan_matter_document, plan_matter_plan_item, plan_theme_marks). Devs only, like the HR file.",
    inputSchema: { type: 'object', properties: { matter: { type: 'object', description: "{ person_id (a people.id, or a login's users.id as find_person lists it — get_person_file resolves a name), handling_name? (the firm's or the office's name for the matter, under 200 characters) }" } }, required: ['matter'] },
  },
  {
    name: 'apply_matter_open_person',
    description: "Open the matter you planned: the same matter plus the plan_hash from plan_matter_open_person. Reads the person and the matters standing on them again first and writes only when nothing changed — a matter opened on them since refuses; plan again. Opens it as you through legal_person_matter_open (devs only; restrictive policies keep a person matter's rows to devs on every legal table): the HR file's Matter view draws it and the file's fact strip wears Matter · Under review. Then write the narrative, the documents, the steps and the themes on its matter_id.",
    inputSchema: { type: 'object', properties: { matter: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['matter', 'plan_hash'] },
  },
  {
    name: 'get_login_state',
    description: "Where getting a teammate online stands (v2.6792, devs only): whether the users row exists, whether a login is attached, when the invite or the sign-in or reset link went and whether it was used, whether they have signed in and when, in one stage with words you can say to the person and the next press — 'the email went 3 minutes ago, not opened yet', 'signed in once, 10:14'. The row and the roster row are read as you; the auth account's stamps (invited_at, confirmation_sent_at, email_confirmed_at, recovery_sent_at, last_sign_in_at) are read by id, timestamps alone. person is a users.id, a people.id, an address or a name that matches one account.",
    inputSchema: { type: 'object', properties: { person: { type: 'string', description: 'users.id, people.id, an email address, or a name matching exactly one account' } }, required: ['person'] },
  },
  {
    name: 'plan_account',
    description: "Dry-run a teammate's app account (v2.6792, punch list #260's seat door): make a person as the Hire form does — new: { name, kind, email?, start_date?, sign_in? (email: the invite link; password: one you set, no mail; none: on the roster, a login attached later), password?, training?, phone?, notes? } with pay?: { hourly_wage, is_salary?, workday_start? } — or change one that exists — person (a users.id, a people.id, an address or a name) with rename: { name?, title?, phone? } (the name-keyed pay rows follow), role, email (refused when another row holds it). Through add_worker, invite-user, create-user and change-user-email as you, so every rule holds: a name a live row carries is refused, an archived teammate with the name or address is refused with Bring back, two accounts never share an address. Replies with what each write becomes and a plan_hash; the plan commits to the row as it reads, so a save by anyone since refuses the apply. Never the paperwork packet. A password is never printed back or logged.",
    inputSchema: { type: 'object', properties: { account: { type: 'object', description: '{ person, rename?, role?, email? } or { new: { name, kind, email?, start_date?, sign_in?, password?, training?, phone?, notes? }, pay? }' } }, required: ['account'] },
  },
  {
    name: 'apply_account',
    description: 'Make or change the account you planned: the same account plus the plan_hash from plan_account. Reads the row again first and writes only when it still matches. Each change is reported done or held with its reason; what landed stays. Then get_login_state says where they stand.',
    inputSchema: { type: 'object', properties: { account: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['account', 'plan_hash'] },
  },
  {
    name: 'plan_login',
    description: "Dry-run attaching a login to a users row with none (v2.6792; the desk's Attach a login…): login = { person, mode? (email, the default: create-user makes the login on the row's own id with an unguessable password and send-sign-in-email emails them the link; password: a password you set, at least 6 characters, no mail), password?, email? (the address to attach on when the row carries none) }. Nothing that points at the person moves — hours, Charged as, pay, paperwork. remove: true is the desk's Remove the login… through detach-login: the sign-in, any password and their push devices go, the person stays. Refused on a row that already has a login (plan_password_reset sends a link), a sample or twin, an archived person, your own row for remove. The plan commits to the row as it reads.",
    inputSchema: { type: 'object', properties: { login: { type: 'object', description: '{ person, mode?: email | password, password?, email?, remove?: true }' } }, required: ['login'] },
  },
  {
    name: 'apply_login',
    description: 'Attach or remove the login you planned: the same login plus the plan_hash from plan_login. Reads the row again first and writes only when it still matches. Then get_login_state tells when the email went and whether they have signed in.',
    inputSchema: { type: 'object', properties: { login: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['login', 'plan_hash'] },
  },
  {
    name: 'plan_password_reset',
    description: "Dry-run a password reset on a teammate's login (v2.6792): reset = { person, mode? (email, the default: the app's own Forgot password email with the reset link, as the sign-in page sends it; password: a password you set, at least 6 characters, through set-user-password, no mail), password? }. One send per address per ten minutes: the plan says when the last link went and when the next may. Refused for your own account, a sample, a twin, an archived person, and a row with no login (plan_login attaches one).",
    inputSchema: { type: 'object', properties: { reset: { type: 'object', description: '{ person, mode?: email | password, password? }' } }, required: ['reset'] },
  },
  {
    name: 'apply_password_reset',
    description: 'Send the reset email or set the password you planned: the same reset plus the plan_hash from plan_password_reset. Reads the account again first and writes only when it still matches. Then get_login_state says whether the link was used.',
    inputSchema: { type: 'object', properties: { reset: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['reset', 'plan_hash'] },
  },
  {
    name: 'plan_person_doc',
    description: "Dry-run a change to a person's HR document (v2.6608, docs/HR_FILES.md): the summary or the narrative, or since v2.6613 a named document on the file (doc_id from get_person_file's documents list, or title to make a new one; counsel_only marks it kept inside the circle, archive retires it; since v2.6713 evidence_id names the evidence record it transcribes, alone or with the text, so a search hit on a line of a call opens the call — a counsel-only record's transcript must be counsel_only too), markdown, as People → HR draws it. Send the whole text, or ops against the document's own headings — replace_section (the lines under a heading, the heading kept; '' empties it), insert_after (new lines after that section), append (at the end) — so a long document is edited a section at a time. Since v2.6949 two more ops change less than a section and resend none of it: prepend_section { heading, markdown } puts new lines straight under a heading, above the section's own lines (the op for a newest-first log; end the markdown with an empty line to leave a blank line under it), and replace_text { heading, find, replace } swaps one exact run of text inside that section ('' as replace takes it out) — refused, naming the count, when the run is absent or occurs more than once there. A call that carries either is worked out on the server from the text as it stands, so nothing of the section rides through you. Or, since v2.6712 (punch list #286), send drive_file_id (or drive_url) in place of the text: a .md, .txt or Google Doc already in Drive (a file an evidence record links, say), whose bytes the server reads itself through the service account — nothing rides through you, whatever its size up to the document limit — and the plan names the file, its size, its sha256 and its first heading; a new document takes the file's name as its title when you give none; a PDF or an image is refused with the door that takes it. Replies with the person, the text's size before and after, each change with the words removed and added (capped for a section op; whole for prepend_section and replace_text, with the line it lands on), the headings after the change with their line numbers, and a plan_hash. Nothing is written. The plan commits to the document's updated_at and, for a Drive file, to its text: a save by anyone since — the app's editor, another agent — refuses the apply, as does a file changed in Drive, and expect_updated_at refuses the plan itself. get_person_file (docs: true) reads the text; you are named as the author.",
    inputSchema: { type: 'object', properties: { doc: { type: 'object', description: "{ person_id (a people.id: find_person), one of kind: 'summary' | 'narrative' | doc_id (a named document) | title (a new named document), markdown (the whole text) — or — ops: [{ op: 'replace_section', heading, markdown } | { op: 'insert_after', heading, markdown } | { op: 'append', markdown } | { op: 'prepend_section', heading, markdown } | { op: 'replace_text', heading, find, replace }] (at most 20) — or — drive_file_id | drive_url (a .md, .txt or Google Doc in Drive, read on the server; a named document only), counsel_only?, archive? and evidence_id? (a named document; a person_file_evidence.id or null to untie; any may come alone), expect_updated_at? (the updated_at you read), covered_through? (a timestamp; now when left out, the fixed two) }" } }, required: ['doc'] },
  },
  {
    name: 'apply_person_doc',
    description: 'Save the change you planned: the same doc plus the plan_hash from plan_person_doc. Runs the dry run again first and writes only when it still matches — a save by anyone since refuses it; plan again from the fresh text. A doc from a Drive file (drive_file_id) is read from Drive again, and a file changed since the plan refuses the apply naming the bytes as they read now; the document remembers the file and its sha256 (source_drive_file_id, source_sha256). Written as you through dev_person_doc_write; the prior version is archived (person_file_revisions), and People → HR shows the new text at once.',
    inputSchema: { type: 'object', properties: { doc: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['doc', 'plan_hash'] },
  },
  {
    name: 'plan_matter_narrative',
    description: "Dry-run the narrative for the firm on a legal matter (v2.4814): the office's account in markdown, read by the law firm as the first tab of its portal and the first section of its printed packet. Send the whole text (markdown; '' clears it) or, since v2.6623, ops against the narrative's own headings — replace_section (the lines under a heading, the heading kept), insert_after, append — so one section travels, not the whole account, and since v2.6949 prepend_section { heading, markdown } (new lines straight under a heading, above the section's own) and replace_text { heading, find, replace } (one exact run of text swapped inside a section, refused when it is absent or occurs more than once there), which resend nothing of the section and show their removed and added words whole; expect_updated_at (the narrative_updated_at you read) refuses the plan when the narrative was saved since. Replies with the matter, the length before and after, each change with the words removed and added, the headings after, whether the firm reads it now, and a plan_hash. Nothing is written. Write facts the record shows, and name each document by its title under Evidence.",
    inputSchema: { type: 'object', properties: { narrative: { type: 'object', description: "{ matter_id (legal_matters.id — read_rows on legal_matters by payer_name), markdown (the whole text, at most 40,000 characters) — or — ops: [{ op: 'replace_section', heading, markdown } | { op: 'insert_after', heading, markdown } | { op: 'append', markdown } | { op: 'prepend_section', heading, markdown } | { op: 'replace_text', heading, find, replace }] (at most 20), expect_updated_at? }" } }, required: ['narrative'] },
  },
  {
    name: 'apply_matter_narrative',
    description: 'Save the narrative you planned: the same narrative plus the plan_hash from plan_matter_narrative. Runs the dry run again first and writes only when it still matches — if someone saved the narrative since, plan again. Saved as you, through legal_set_narrative; the firm sees it on its next open.',
    inputSchema: { type: 'object', properties: { narrative: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['narrative', 'plan_hash'] },
  },
  {
    name: 'plan_matter_plan_item',
    description: "Dry-run a planned step on a legal matter's timeline (v2.5800): what the office, the firm and the dev MCP plan next on a Collections account, read on the Legal desk's Timeline tab and the firm's portal. action add plans a step (matter_id, on, body, notes?); update changes one (entry_id, on?, body?, notes?); mark_done says it happened (entry_id, done_on? — today when left out — note?). Replies with the matter, the item before and after, whether the firm reads it now, and a plan_hash. Nothing is written. Marking done keeps the day it was planned for and stamps the day it was done.",
    inputSchema: { type: 'object', properties: { item: { type: 'object', description: "{ action: 'add' | 'update' | 'mark_done', matter_id? (legal_matters.id — read_rows on legal_matters by payer_name), entry_id? (a kind 'plan' row of legal_matter_entries), on? (YYYY-MM-DD, the day it is planned for), body? (what), notes?, done_on? (YYYY-MM-DD), note? }" } }, required: ['item'] },
  },
  {
    name: 'apply_matter_plan_item',
    description: 'Write the planned step you planned: the same item plus the plan_hash from plan_matter_plan_item. Runs the dry run again first and writes only when it still matches — if someone changed the step since, plan again. Written as you through legal_plan_add / legal_plan_update / legal_plan_mark_done with source mcp; the office sees it on the Timeline tab at once and the firm on its next open.',
    inputSchema: { type: 'object', properties: { item: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['item', 'plan_hash'] },
  },
  {
    name: 'plan_matter_event',
    description: "Dry-run recording what already happened on a legal matter (v2.6682, punch list #169): #167's event — a notice arriving, a supplier paid, a statement signed, a call taken — on the Legal desk's Timeline, dated the day it happened (never ahead of today; a day ahead is a planned step, plan_matter_plan_item), with notes and the matter's Evidence documents that prove it (read_rows on legal_matter_documents by matter_id; plan_matter_document files a new one first). Replies with the matter, the event as it would be written with its documents by title, how many events the matter holds, whether the firm reads it now, and a plan_hash. Nothing is written. The office sees it tagged dev MCP; it undoes a wrong one with Undo… on the desk — there is no edit and no undo verb here.",
    inputSchema: { type: 'object', properties: { event: { type: 'object', description: "{ matter_id (legal_matters.id — read_rows on legal_matters by payer_name), on (YYYY-MM-DD, the day it happened), body (what happened, under 500 characters), notes? (under 4,000), document_ids? (legal_matter_documents ids of the same matter) }" } }, required: ['event'] },
  },
  {
    name: 'apply_matter_event',
    description: 'Record the event you planned: the same event plus the plan_hash from plan_matter_event. Runs the dry run again first and writes only when it still matches — an event recorded on the matter since, or a document gone, refuses it: plan again. Written as you through legal_event_add with source mcp; the office sees it on the Timeline tab at once, tagged dev MCP, and the firm on its next open unless the office holds it.',
    inputSchema: { type: 'object', properties: { event: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['event', 'plan_hash'] },
  },
  {
    name: 'plan_matter_statement',
    description: "Dry-run a sworn statement or an unsworn declaration drafted onto a legal matter's Timeline (v2.6244, punch list #220): the affidavit the office would otherwise draft in a chat and retype — the title, the day it is about (and the span's last day), who swears it (one of our team by users.id with their full name as it reads on their ID, or a witness typed in), the form (before a notary, or under penalty of perjury), the county and the paragraphs — as a DRAFT on the Said lane the office prints, signs and files from the desk's Swear a statement… window. The robot never prints, signs or files. action add drafts one (matter_id, on, title, body, affiant, form?, incident_to?, venue_county?); update changes a draft it or the office made (entry_id and the fields that change; null clears the span or the county), refused once the signed copy is filed. Replies with the matter, the statement before and the draft as it would be written with its state words, how many statements the matter holds, whether the firm reads it now, and a plan_hash. Nothing is written. Write only what the record shows and what the affiant can swear to: the paragraphs are theirs once signed.",
    inputSchema: { type: 'object', properties: { statement: { type: 'object', description: "{ action: 'add' | 'update' (add when left out), matter_id? (legal_matters.id — read_rows on legal_matters by payer_name), entry_id? (a kind 'statement' row of legal_matter_entries), on? (YYYY-MM-DD, the day it is about), title?, body? (the paragraphs), affiant? ({ kind: 'team' | 'witness', user_id? (find_person; team only), name (their full name), role? }), form? ('notary' | 'declaration'), incident_to? (YYYY-MM-DD, or null to clear), venue_county? (or null to clear) }" } }, required: ['statement'] },
  },
  {
    name: 'apply_matter_statement',
    description: "Draft the statement you planned: the same statement plus the plan_hash from plan_matter_statement. Runs the dry run again first and writes only when it still matches — a statement added or dropped on the matter since, or a change to the draft you are updating, refuses it: plan again. Written as you through legal_statement_add / legal_statement_update with source mcp; the office sees the draft on the Timeline's Said lane at once, tagged dev MCP, and prints, signs and files it from there.",
    inputSchema: { type: 'object', properties: { statement: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['statement', 'plan_hash'] },
  },
  {
    name: 'plan_matter_document',
    description: "Dry-run a document onto a legal matter's Evidence tab (v2.6004): what the office files for the firm on a Collections account — a sent letter, a received notice, a receipt, a scan, or a text written for the firm. The file travels as content_base64 (a PDF, an image, an email as .eml, plain text or markdown, up to 10 MB); the server turns it into mime, size_bytes and sha256, which the plan hash commits to, and stores nothing. A text document (v2.6716, punch list #288) travels as markdown instead: the server makes the .md file, and the words are kept in the documents table, rendered on the desk and the portal and searched by section (search_case); a .md or .txt sent as content_base64 is kept as text too. Replies with the matter, the row as it would be written (and the text's size and sections), how many documents the matter holds, whether the firm reads it now, and a plan_hash.",
    inputSchema: { type: 'object', properties: { document: { type: 'object', description: "{ matter_id (legal_matters.id — read_rows on legal_matters by payer_name), title, shows (one line on what it shows), original_name (the file name, with its extension; <title>.md when markdown is sent without one), content_base64 (the file) or markdown (a text document's words), counsel_only? (true: for counsel alone — the firm reads it on its portal with a lock, the printed packet leaves it out, the dev seat and the agent never read the row or its words; v2.6720), dated_on? (YYYY-MM-DD, the paper's own day), state? (draft | final | sent | received; final when left out), received_on? (YYYY-MM-DD), sent_on? (YYYY-MM-DD, today when left out), sent_how? (email | certified_mail | mail | hand | other; needed when state is sent), sent_to? (who it went to; needed when state is sent) }" } }, required: ['document'] },
  },
  {
    name: 'apply_matter_document',
    description: "File the document you planned: the same document (content_base64 again) plus the plan_hash from plan_matter_document. Runs the dry run again first and files only when it still matches — a different file, title or matter, or a document added to the matter since, refuses it. Stores the file in the legal-matter-documents bucket under the matter's folder as you, then writes the legal_matter_documents row as you through dev_legal_document_write; a row that cannot be written removes the file again. The office sees it on the Evidence tab at once and the firm on its next open.",
    inputSchema: { type: 'object', properties: { document: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['document', 'plan_hash'] },
  },
  {
    name: 'plan_hours_statement',
    description: "Dry-run a signed hours statement (v2.6414, punch list #212): make one as the Hours statement window does — the job and the worker resolved, the clock and the pay reports (or the crew-days on the charged basis, or a sub's sheets) read into the paper's snapshot through the same kernel get_hours_statement uses, the record id the row would take (HS-<job>-<n>), you named as the preparer — or file a signed one's PDF onto a legal matter's Evidence tab. The plan commits to the snapshot, so a clock that moved since refuses the apply: plan again.",
    inputSchema: { type: 'object', properties: { statement: { type: 'object', description: "{ action: 'make' | 'file_on_matter' (make when left out); make: job (a jobs_ledger.id or what find_job resolves), person (a users.id or what find_person resolves), from, to (YYYY-MM-DD, not ahead of today), with_pay? (true when left out; off on the charged basis), basis? ('paid' when left out; 'charged' prices every counted hour at the rate the customer is charged, as the crew it was part of, and the row keeps the rate and the words it was charged by), kind? ('clock' | 'sheet'; left out, a sub on the job's sheets reads the sheets, always as paid), add_stated_block?, stated_days? ([{ day, hours?, note?, source? }]: days the office states from outside records — texts, bank sends — each marked as stated by you with its source), send? ({ how: 'email' | 'link' }: once the row lands, the form is drawn and the signing link emailed to the worker or handed back to you); file_on_matter: statement_id (an hours_statements.id, signed), matter_id (a legal_matters.id), title?, shows? }" } }, required: ['statement'] },
  },
  {
    name: 'apply_hours_statement',
    description: "Make or file the statement you planned: the same statement plus the plan_hash from plan_hours_statement. Re-reads the clock and re-runs the dry run first and writes only when it still matches. make writes the hours_statements row through dev_hours_statement_write as you (a draft under the job's Hours statements and on the worker's desk); with send, the server then draws the form (hours-statement-signing), mints the link (send-contract-for-signature, emailed or handed back in the reply — never in the call log) and the row reads sent. file_on_matter stores the signed PDF under the matter as you and writes the Evidence row through the document wrapper, the statement tied to it. One apply per plan.",
    inputSchema: { type: 'object', properties: { statement: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['statement', 'plan_hash'] },
  },
  {
    name: 'plan_gap_answer',
    description: "Dry-run an answer on a packet gap (v2.6005): one line the attorney reads instead of a hole in the Legal desk's \"Before this goes to an attorney\" list — for a fact that is true and known, like work done on a handshake, or a letter that went out on paper. The gaps are computed on every open and never stored; the answer is keyed by the gap's own key and shows under the gap while it fires (the desk's Answer… sheet writes the same row). action answer writes or replaces the line (matter_id, gap_key, answer, label?, document_id?); clear takes it back (matter_id, gap_key). Replies with the matter, the answer before and after, how many answers the matter holds, whether the firm reads it now, and a plan_hash. Nothing is written.",
    inputSchema: { type: 'object', properties: { gap: { type: 'object', description: "{ matter_id (legal_matters.id — read_rows on legal_matters by payer_name), gap_key (the gap's key: never_asked, demand, demand_open, worth, email, address, contact, payer, contract:<jobId>, evidence:<jobId>, subjob:<jobId>, lienfile:<jobId>, …), action? ('answer' | 'clear'; answer when left out), answer? (the one line, under 500 characters), label? (the gap's words as shown, under 300), document_id? (a legal_matter_documents.id on the same matter that shows it) }" } }, required: ['gap'] },
  },
  {
    name: 'apply_gap_answer',
    description: 'Write the answer you planned: the same gap plus the plan_hash from plan_gap_answer. Runs the dry run again first and writes only when it still matches — if someone answered or cleared that gap since, plan again. Written as you through legal_answer_gap (or legal_clear_gap_answer); the office sees it under the gap at once and the firm on its next open.',
    inputSchema: { type: 'object', properties: { gap: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['gap', 'plan_hash'] },
  },
  {
    name: 'plan_theme_marks',
    description: "Dry-run themes marked on the record (v2.6552, punch list #269): a theme from the catalog (Settings → People & teams → Themes on the record; read_rows on legal_themes) hung on something that already exists — an HR entry or a piece of evidence (get_person_file names their ids), a matter document or a matter event (read_rows on legal_matter_documents / legal_matter_entries) — with why it fits (up to 200 characters) and how it proves the theme: document, own_words, firsthand or relayed, the grade counsel's matrix asks. Up to 100 marks a call. The dry run resolves each one — ready, already (that theme is on it, live) or held with its reason (no such theme, a retired theme, no live thing with that id) — and names the person or the matter each lands on. stand: kept (the default — the owner said Apply it) or proposed (dashed in the app until a dev keeps it). Nothing is written.",
    inputSchema: { type: 'object', properties: { marks: { type: 'array', description: "[ { theme_id, target_kind (hr_entry | hr_evidence | matter_document | matter_entry), target_id, why?, proves_by? (document | own_words | firsthand | relayed) } ]" }, stand: { type: 'string', description: 'kept (default) | proposed' } }, required: ['marks'] },
  },
  {
    name: 'apply_theme_marks',
    description: 'Write the marks you planned: the same marks plus the plan_hash from plan_theme_marks. Runs the dry run again first and writes only when it still matches — a thing marked since reads as already and changes the plan, so plan again. Inserts the ready ones as you (marked_by, kept_by when kept) through dev_theme_marks_write; a held one is named and skipped, never a reason to stop the rest. Read it back with read_rows on legal_theme_marks or on the file\'s By theme view.',
    inputSchema: { type: 'object', properties: { marks: { type: 'array' }, stand: { type: 'string' }, plan_hash: { type: 'string' } }, required: ['marks', 'plan_hash'] },
  },
  {
    name: 'plan_theme_review',
    description: "Dry-run a review of theme marks already on the record (v2.6844): keep the proposed marks named and take the named marks off, each with its reason. A mark an agent proposed is dashed in the app until a dev keeps it; a mark that does not fit comes off with a reason and is made again with plan_theme_marks, since a mark is never reworded. keep is a list of mark ids (read_rows on legal_theme_marks: proposed is true and kept_at is null), take_off a list of { id, why } (why up to 200 characters); 1 to 200 marks across the two, no mark named twice. The dry run resolves each one — ready, already (kept already, or off already) or held with its reason (no mark with that id, a mark that came off cannot be kept) — with the theme, the first words of the thing it hangs on and the mark's own why and grade, and counts each list. Nothing is written.",
    inputSchema: { type: 'object', properties: { keep: { type: 'array', description: '[ mark id ] — legal_theme_marks.id of each proposed mark to keep' }, take_off: { type: 'array', description: '[ { id (a mark id), why (the reason it comes off, up to 200 characters) } ]' } } },
  },
  {
    name: 'apply_theme_review',
    description: 'Stamp the review you planned: the same keep and take_off plus the plan_hash from plan_theme_review. Runs the dry run again first and writes only when it still matches — a mark kept or taken off since changes the plan, so plan again. Stamps the ready ones as you through dev_theme_review_write (kept_at and kept_by, or removed_at, removed_by and the reason); an already or held one is named and skipped, never a reason to stop the rest. The row stays either way: a mark is never deleted. Read it back with read_rows on legal_theme_marks or on the file\'s By theme view.',
    inputSchema: { type: 'object', properties: { keep: { type: 'array' }, take_off: { type: 'array' }, plan_hash: { type: 'string' } }, required: ['plan_hash'] },
  },
  {
    name: 'get_history',
    description: "A development's history as people wrote it, every body whole (v2.6044): the lines kept in History (what happened: an email, a call, a visit, a letter, a note, each at the time it happened, by a person or a robot), the job's thread notes and the bid's thread notes, newest first, with who wrote each. The records' own lines (sends, stage moves, bills, payments) are read_rows on their tables. Narrow to one job or one bid, or to lines since a moment; 200 at most by default, 500 at most.",
    inputSchema: { type: 'object', properties: { development_id: { type: 'string', description: 'a developments.id (read_rows on developments by name)' }, job_id: { type: 'string' }, bid_id: { type: 'string' }, since: { type: 'string', description: 'an ISO timestamp: only lines at or after it' }, limit: { type: 'number' } }, required: ['development_id'] },
  },
  {
    name: 'get_case_brief',
    description: "One page that says what is where on a person's case (v2.6619, punch list #278) — the brief to read before anything else, the way a folder's README is read: your own Agent notes document first (a named document so titled, kept through plan_person_doc), the summary whole, the narrative's section index, the named documents with their section indexes and counsel marks, the entries' count and newest ten, the evidence index, the matter's narrative sections, steps and documents, the theme counts, and the developments the person's jobs sit in with their History's newest lines — every item with its id for a drill-in, the text never carried whole except the summary. Dev-only like the HR file: another role gets the person and held: dev only. read_next says which verb reads each thing further. Since 0.63.0 the brief fits the door on a large case: the small blocks come first, every list is read a page at a time (since 0.66.0 the evidence, the documents, the theme marks and the matter's steps as well as the entries, so each count is whole past 200), and a brief that would pass the door's 80,000 characters is shortened in a fixed order — the documents' section indexes first, each kept as an outline of its shallowest headings beside section_count, its whole count — with shortened naming each block, what it kept and the call that reads the rest (get_person_document for one document's whole index); shortened is null when nothing was.",
    inputSchema: { type: 'object', properties: { person: { type: 'string', description: 'people.id, users.id (find_person) or a name matching exactly one person' } }, required: ['person'] },
  },
  {
    name: 'get_document_history',
    description: "What moved on a document on a person's HR file (v2.6622, punch list #278): the revisions of a named document (doc_id) or of the summary or narrative (kind) — when each was replaced, by whom, how big it was — with the text as it stands as now; with from (an older revision's id) and to (a newer one, or left out for the text as it stands), the difference between the two as hunks of removed and added lines, each named by its first line in the older text, exact when the changed middle is under 600 lines a side and capped at 400 lines and 40,000 characters (a long line cut to fit), so the reply stays whole. Dev-only. get_person_file's documents list takes since (YYYY-MM-DD) and marks each changed_since.",
    inputSchema: { type: 'object', properties: { person: { type: 'string', description: 'people.id, users.id (find_person) or a name matching exactly one person' }, doc_id: { type: 'string', description: 'a named document (documents.id, from get_case_brief or get_person_file)' }, kind: { type: 'string', description: 'summary | narrative, instead of doc_id' }, from: { type: 'string', description: 'a revision id from the list, the older one' }, to: { type: 'string', description: 'a newer revision id; the text as it stands when left out' } }, required: ['person'] },
  },
  {
    name: 'get_person_document',
    description: "A document on a person's HR file a piece at a time (v2.6621, punch list #278): without section, the index — every heading with its number, level, line and size — of a named document (doc_id, from get_case_brief) or of the summary or narrative (kind); with section (a number as the heading carries it, or a heading's text), that section's text alone with the sections before and after named, so a 300 KB document never crosses the door whole. The sections are cut as plan_person_doc's ops name them, and read_next gives the op that changes what you read. Dev-only.",
    inputSchema: { type: 'object', properties: { person: { type: 'string', description: 'people.id, users.id (find_person) or a name matching exactly one person' }, doc_id: { type: 'string', description: 'a named document (documents.id, from get_case_brief or get_person_file)' }, kind: { type: 'string', description: 'summary | narrative, instead of doc_id' }, section: { type: 'string', description: 'a section number or heading; the index alone when left out' } }, required: ['person'] },
  },
  {
    name: 'get_matter_document',
    description: "A text document on a legal matter's Evidence tab a piece at a time (v2.6722, punch list #288): without section, the index — every heading with its number, level, line and size — of a .md or .txt the office or the seat filed on the matter (doc_id is the Evidence row, from get_case_brief's matter.documents or a search_case matter_document hit); with section (a number as the heading carries it, or a heading's text), that section's text alone with the sections before and after named. A PDF, an image or an .eml is refused with what it is; a counsel-only paper is read like any other since 0.76.0, its target marked counsel_only. Dev-only.",
    inputSchema: { type: 'object', properties: { matter_id: { type: 'string', description: 'legal_matters.id (read_rows on legal_matters by payer_name, or get_case_brief)' }, doc_id: { type: 'string', description: 'the Evidence row (legal_matter_documents.id)' }, section: { type: 'string', description: 'a section number or heading; the index alone when left out' } }, required: ['matter_id', 'doc_id'] },
  },
  {
    name: 'search_case',
    description: "One full-text search across a person's case (v2.6620, punch list #278) — the grep an agent has over a folder: the HR entries, the evidence titles and memos, the named documents and the summary and narrative a section at a time (a hit names the section it sits in), the matter standing on the person — its narrative by section, its entries' words, its documents' titles and what-it-shows lines — and, since v2.6719 (punch list #285), the files: every file on an evidence record or the matter's Evidence tab the file index has read (a transcript linked from Drive, a staged .eml or PDF, a text document), each a `file` hit that names the record it hangs on (record_kind, record_id, record_title) and the file's name. Each hit: the source, the id, the section and its number, the day, a snippet with the match marked « », the counsel-only mark (marked, never hidden from a dev), and read_next. Websearch syntax: words, \"a phrase\", -not. Dev-only.",
    inputSchema: { type: 'object', properties: { person: { type: 'string', description: 'people.id, users.id (find_person) or a name matching exactly one person' }, q: { type: 'string', description: 'the words to find — websearch syntax' }, in: { type: 'string', description: 'one source: entries | evidence | documents | summary | narrative | matter | files; every source when left out' }, limit: { type: 'number', description: 'hits to return, 1 to 100; 40 when left out' } }, required: ['person', 'q'] },
  },
  {
    name: 'get_person_file',
    description: "A person's HR file whole, as People → HR draws it (docs/HR_FILES.md): one dated line per thing on record, on the day it is ABOUT — the HR entries by source, evidence, field reports waiting to be filed, papers signed, sent or owed and their expiries, licenses on file and lapsed, write-ups, no-shows, excused lates, the start and last days — in lanes Said · Did · Paper · Missed · Ahead, by month newest first with what lies ahead on top; the fact chips (reports waiting, licenses expired, papers owed…), each naming the filter it narrows to; signed_papers (since 0.58.0), the papers they signed in the app as a list — the paper, the day, signed as, how, and door.to, which opens the signed record on People → Contracts (the same door the Timeline's signed line carries); hours_statements, each with where it stands (draft · printed, not signed back · sent · signed back) and its door, the statement source on the Timeline; the evidence records with their files and Drive state; the summary and narrative. The tab's own kernel over the tab's sources, each read as you under RLS: a source that could not be read is named in `held` and takes only itself out (the HR entries, evidence, reports and docs are dev-only). `person` is a people.id, a users.id (find_person) or a name that matches exactly one person. Narrow with lane, source, since or until; docs: false leaves the summary and narrative out of a long file. Since 0.63.0: brief: true answers each line short — the day, the lane, the kind, the first 160 characters of its words (line_chars sets another length, 40 to 2,000) with more counting the rest, who, and row, the table:id read_rows answers whole — and the docs' sizes in place of their text (docs: true keeps the text). A reply that would pass the door's 80,000 characters is shortened whether or not you asked: the docs' text first, then the evidence and the lists another verb carries, then the lines, and last the Timeline's oldest months; shortened names each block with what it kept and the call that reads the rest, and next_until is the day to pass as until to read the lines left out. Every source is read a page at a time (the HR entries since 0.63.0, the attachments, evidence, reports, papers and licenses since 0.66.0), so the counts are whole past 200 and a record keeps all its files; at_cap names a source only past 5,000 rows.",
    inputSchema: {
      type: 'object',
      properties: {
        person: { type: 'string', description: "people.id, users.id (find_person) or a name matching exactly one person" },
        lane: { type: 'string', description: 'said | did | paper | missed | planned (Ahead)' },
        source: { type: 'string', description: 'file | evidence | report | contract | statement | license | writeup | attendance | employment' },
        since: { type: 'string', description: 'YYYY-MM-DD — only lines on or after this day' },
        until: { type: 'string', description: 'YYYY-MM-DD — only lines on or before this day; pass a reply\'s next_until to read on' },
        docs: { type: 'boolean', description: 'false leaves the summary and narrative out (default true; under brief their sizes stand in unless docs is true)' },
        brief: { type: 'boolean', description: 'true answers each line short, with the row behind it, and the docs\' sizes in place of their text' },
        line_chars: { type: 'number', description: 'how many characters of a line\'s words brief keeps, 40 to 2,000 (160 when left out); asking it asks for brief' },
      },
      required: ['person'],
    },
  },
  {
    name: 'get_hours_statement',
    description: "A signed hours statement as the Hours statement window reads it (v2.6414, punch list #212): one worker's recorded hours on one job for a period — the days with in, out, hours and note by company week, each day's rate and amount, the pay lines per week (the job's share, what was paid, the reference), the gap before the app's first clock day said plainly, the stated block and the attestation — from the window's own reads handed to the shared kernel, so a number here is the number on the paper. basis: 'charged' prices every counted hour at the rate the customer is charged, as the crew it was part of (the rate card, the job's rule and the Charges window's adjustments), and carries no pay; the reply's `charge` names the rate, the words under the signature, the days the card could not price and who counts as nobody. A sub on the job's sheets reads the sheets' lines (kind: 'sheet', or left out), always as paid, one group a sheet. Opens with one line (`reading`) and ends with the statements already made for that job and person with their state. The pay is read only for the payroll roles; with_pay false leaves it off. Nothing is written.",
    inputSchema: { type: 'object', properties: { job: { type: 'string', description: 'a jobs_ledger.id, or a job number or name find_job resolves to one' }, person: { type: 'string', description: 'a users.id, or a name find_person resolves to one' }, from: { type: 'string', description: 'YYYY-MM-DD' }, to: { type: 'string', description: 'YYYY-MM-DD' }, with_pay: { type: 'boolean', description: 'the rate, the amount and what was paid; true when left out; ignored on the charged basis' }, basis: { type: 'string', enum: ['paid', 'charged'], description: 'paid (the wage and the pay reports; the default) or charged (every counted hour at the rate the customer is charged, as the crew it was part of; no pay on the paper)' }, kind: { type: 'string', enum: ['clock', 'sheet'], description: "clock (the person's punches) or sheet (a sub's sheet lines, always as paid); left out, a sub on the job's sheets reads the sheets and anyone else the clock" }, add_stated_block: { type: 'boolean', description: 'the block the worker fills in, even inside the recorded span' } }, required: ['job', 'person', 'from', 'to'] },
  },
  {
    name: 'plan_history_entry',
    description: "Dry-run a History line on a development (v2.6044): what happened, kept at the time it happened, about the site or one job, bid or customer, from a source, as a named robot. The dry run replies with the line as it will read (the development, the piece, the time, the source, the body's first words, the robot's name) under a plan_hash; nothing is written. A kept line never changes: a correction is a second line.",
    inputSchema: { type: 'object', properties: { line: { type: 'object', description: "{ development_id (developments.id — read_rows on developments by name), happened_at (an ISO timestamp with its offset: the email's time, not now), source ('email' | 'call' | 'text' | 'on_site' | 'letter' | 'note'), body (what happened, whole, under 20,000 characters), agent_label (the robot's name as the line shows it, e.g. 'the inbox robot'), job_id? | bid_id? | customer_id? (at most one; none means the site), link_url? }" } }, required: ['line'] },
  },
  {
    name: 'apply_history_entry',
    description: 'Keep the line you planned: the same line plus the plan_hash from plan_history_entry. Runs the dry run again first and writes only when it still matches. Written as you through dev_history_entry_write with via = mcp and your agent_label; the office sees it in History at once, marked via MCP.',
    inputSchema: { type: 'object', properties: { line: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['line', 'plan_hash'] },
  },
  {
    name: 'plan_clock_sessions',
    description: "Dry-run changes to clock sessions (v2.6437): the start and the end, the description, the job, or the approval of one or more sessions, as the office edits them in People → Hours. The dry run performs every op and unwinds it, replying with each session before and after, each op applied, held (an approval the guard holds: your own session, or hours you typed) or refused with its reason, under a plan_hash; nothing is written. A moved start or end on a punched session is stamped as hours you typed, for someone else's second look, as in the app.",
    inputSchema: { type: 'object', properties: { sessions: { type: 'object', description: "{ reason (words: why, kept in the call log), ops: [ { op: 'times', session_id, start, end (ISO timestamps with their offset; end after start, at most 24 hours) } | { op: 'note', session_id, note (the description; '' clears it) } | { op: 'move', session_id, job_id (jobs_ledger.id — find_job) } | { op: 'approve', session_id } ] } — at most 50 ops; a session_id is a clock_sessions.id (read_rows on clock_sessions by user_id and work_date)" } }, required: ['sessions'] },
  },
  {
    name: 'apply_clock_sessions',
    description: 'Write the clock session changes you planned: the same sessions plus the plan_hash from plan_clock_sessions. Runs the dry run again first and writes only when it still matches, so a session someone edited meanwhile refuses the apply. Replies as the plan did, with what was written.',
    inputSchema: { type: 'object', properties: { sessions: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['sessions', 'plan_hash'] },
  },
  {
    name: 'plan_bid',
    description: "Dry-run a new bid (v2.6183): the row the New Bid form would make — project name (the plans folder's name too), customer, service type (plumbing is the division the robots bid), address, development, distance from the office, due date and time, estimator (you when left out), robots allowed — as you, numbered by the database at apply. The dry run replies with the bid as it will read, the division its plans folder goes in, the live bids already wearing the name (the plan is refused unless allow_duplicate_name) and what the readiness line still needs, under a plan_hash; nothing is written.",
    inputSchema: { type: 'object', properties: { bid: { type: 'object', description: "{ project_name, customer_id (find_customer), service_type_id (read_rows on service_types), address?, development_id? (read_rows on developments), distance_from_office? (miles), bid_due_date? (YYYY-MM-DD), bid_due_time? (HH:MM), estimator_id?, notes?, robot_opt_out?, allow_duplicate_name? }" } }, required: ['bid'] },
  },
  {
    name: 'apply_bid',
    description: 'Make the bid you planned: the same bid plus the plan_hash from plan_bid. Runs the dry run again first and writes only when it still matches. Inserted as you through dev_bid_write and numbered by the database; replies with the bid number and id. The Bid Board shows it at once, with no plans yet.',
    inputSchema: { type: 'object', properties: { bid: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['bid', 'plan_hash'] },
  },
  {
    name: 'plan_file_plans',
    description: "Dry-run filing a plan set for the robots (v2.6185): the PDF you hold goes into Drive, in the PipeTooling Jobs Shared Drive under Bid plans › <Division> › <project> (since v2.6241; the office's division folders stay view-only), and becomes the set the robot reads — bids.plans_link, the folder link — with a named row on the Bid Board. The bytes never ride in a tool call: the reply carries a one-shot upload_url (two hours) into the bid's folder of the private bid-submittals bucket and the curl line to PUT the file there; the plan commits to the file's size and sha256, the bid's plans link before, its division and folder name, under a plan_hash. A live bid in plumbing, electrical or HVAC only; a bid that already has plans is refused unless replace. Nothing is written.",
    inputSchema: { type: 'object', properties: { plans: { type: 'object', description: "{ bid (bids.id — find_bid), file_name (ending .pdf), size_bytes, sha256, replace?, set_name?, memo? }" } }, required: ['plans'] },
  },
  {
    name: 'apply_file_plans',
    description: 'File the set you planned, once the PUT is done: the same plans plus the plan_hash from plan_file_plans. Runs the dry run again first and files only when it still matches; then reads the staged copy back, refuses it when its size or sha256 differ from the plan, when it is not a PDF or runs past 200 pages (CountTooling’s cap), copies it into the PipeTooling Jobs Shared Drive (Bid plans › <Division> › <project>) as the intake service account, stamps the bid through dev_bid_write (plans_link = the folder link, a bid_plan_sets row named for the set), removes the staged copy, and runs plan-fetch’s readiness probe. Replies with the Drive links, the page count, the probe and what happens next. Drive is the only place the plans stay.',
    inputSchema: { type: 'object', properties: { plans: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['plans', 'plan_hash'] },
  },
  {
    name: 'plan_job',
    description: "Dry-run a new job (v2.6790, punch list #293): the row the New Job form would make — name, address (saved in Title Case as the form saves it), customer, service type, the price (revenue), the office's numbers, the development, the project, the bid, who the bill goes to, the links, the kind — as you, under the same RLS as the form. The dry run reads the customer (its email and phone fill the job's when left out), the service type, the development, the project and the owner rule's settings, and replies with the row as it will land, who it belongs to and why, the live jobs on the customer already wearing the name (refused unless allow_duplicate_name), what a bill will still need and what the verb does not do, under a plan_hash; nothing is written.",
    inputSchema: { type: 'object', properties: { job: { type: 'object', description: '{ job_name, job_address, customer_id (find_customer), service_type_id (read_rows on service_types), revenue? (dollars), hcp_number?, click_number?, customer_name?, customer_email?, customer_phone?, development_id?, project_id?, bid_id?, kind? (service | project), bill_to_party? (customer | gc), gc_customer_id?, google_drive_link?, job_pictures_link?, job_plans_link?, allow_duplicate_name? }' } }, required: ['job'] },
  },
  {
    name: 'apply_job',
    description: 'Make the job you planned: the same job plus the plan_hash from plan_job. Reads the world again first and writes only when it still matches: one insert into jobs_ledger as you (training mode, a twin and an archived account are refused by the table, as on the screen), then the kind when you gave one. Replies with the job id, its label and the next press. The Pipeline shows it at Working at once, where a new job starts; plan_job_update moves it, plan_bill bills it.',
    inputSchema: { type: 'object', properties: { job: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['job', 'plan_hash'] },
  },
  {
    name: 'plan_job_update',
    description: "Dry-run a change to a job (v2.6793, punch list #293): the Edit Job form's columns — name, address, the office's numbers, customer, customer name / email / phone, service type, development, project, bid, who the bill goes to, the links, the account manager, the price (revenue), the percent complete, the kind — as one write under the form's own RLS, and the status as the Pipeline moves it, through update_job_status one step at a time (waiting → working → ready_to_bill → billed → paid, and each step back; a step back from Ready to Bill deletes the job's Ready to Bill lines, as the Pipeline's send-back does). The dry run reads the job and every row a new id names, and replies with each column before → after (a column already holding its value is dropped; a plan that changes nothing is refused), the status steps in order, and what the verb does not do, under a plan_hash committed to the columns' before values, the status and updated_at; nothing is written.",
    inputSchema: { type: 'object', properties: { update: { type: 'object', description: '{ job_id (find_job), set? ({ column: value }; null clears a column that may be blank), status? (waiting | working | ready_to_bill | billed | paid), reason? }' } }, required: ['update'] },
  },
  {
    name: 'apply_job_update',
    description: 'Change the job you planned: the same update plus the plan_hash from plan_job_update. Reads the job again first and writes only when it still matches — a column changed by anyone since refuses. One PATCH on jobs_ledger as you (read back to confirm it landed; a row RLS kept is said), then update_job_status once per step, stopping at the first step the database refuses and saying where the job stands. Replies with what changed, the steps and the next press.',
    inputSchema: { type: 'object', properties: { update: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['update', 'plan_hash'] },
  },
  {
    name: 'plan_bill',
    description: "Dry-run a bill (v2.6794, punch list #293): what Bill Customer and the share row do, in their order — the one primary Ready to Bill row sized to the remainder, the Stripe bill through create-stripe-invoice as you (stripe_mode test | live is required; the server bills live when it is left out), the ten-letter pay code, the job to Billed when fully invoiced, then the Billed line texted from the company number through quo-send and the share row's draft emailed through messages-email, each tied to the job. The dry run reads the job, its lines and payments, the customer, their contact and numbers, the texts switch, the office's Billed line and your signature, and replies with the amount the bill will carry, the mode and due date, the number or address picked with the text's exact words (the link a placeholder until the bill exists) and the email's subject, body and signature, and what happens after, under a plan_hash; nothing is written. Refused when the job is not at Ready to Bill (plan_job_update moves it), nothing is left to bill, the customer has no email, the job has no HCP or Click number in digits (the Stripe bill is numbered from it; plan_job_update sets one), or a send was asked for and cannot go (no number, STOP, texts off, no address). action send texts or emails the link of a billed Stripe bill that already exists.",
    inputSchema: { type: 'object', properties: { bill: { type: 'object', description: "{ job_id (find_job), stripe_mode (test | live), due_date? (YYYY-MM-DD, today when left out), memo?, send?: { text?: true | '<number>', email?: true | '<address>' } } | { action: 'send', invoice_id, send }" } }, required: ['bill'] },
  },
  {
    name: 'apply_bill',
    description: "Bill the job you planned: the same bill plus the plan_hash from plan_bill. Reads the world again first and acts only when it still matches, then runs the modal's steps in order, each outcome in the reply, never all or nothing: ensure_single_ready_to_bill_invoice_for_job (refused when its amount is not the plan's), create-stripe-invoice as you (a refusal returns its words and the Ready to Bill row stands), the pay code read back, the job to Billed when fully invoiced, the text and the email. A send that is refused leaves the bill standing and names the reason; plan_bill { action: 'send', invoice_id, send } tries again. Replies with the bill, its link, each send's outcome and where the job stands.",
    inputSchema: { type: 'object', properties: { bill: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['bill', 'plan_hash'] },
  },
  {
    name: 'plan_collections_flag',
    description: "Dry-run the Collections flag on a Billed job (v2.6795, punch list #293): the Job window's and Stages' own press, through set_job_collections_flag as you — flagged true puts the job in Collections with a note (collections_at now, collections_by you, the note on the job and in its activity), false returns it to Billed Awaiting Payment and lifts an Uncollectible mark too, as the RPC does. The dry run reads the job and replies with the mark before → after, the activity line it will write and where it shows, under a plan_hash; nothing is written. Refused when the job is not at Billed (the RPC's rule) or the flag already reads that way.",
    inputSchema: { type: 'object', properties: { flag: { type: 'object', description: '{ job_id (find_job), flagged (true | false), note? }' } }, required: ['flag'] },
  },
  {
    name: 'apply_collections_flag',
    description: 'Set the flag you planned: the same flag plus the plan_hash from plan_collections_flag. Reads the job again first and writes only when it still matches; then POSTs set_job_collections_flag as you and answers what it said.',
    inputSchema: { type: 'object', properties: { flag: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['flag', 'plan_hash'] },
  },
  {
    name: 'plan_contract_ended',
    description: "Dry-run the end of our contract on a job, as the Lien contract row on Edit Job and the Lien desk record it (v2.6795, punch list #293): the day it ended (ended_on), how (complete | terminated | abandoned), the retainage held back and whether a payment bond is on the project — one write on the job under the row's own RLS, with the moment and you stamped; clear: true takes the end off again. The Lien desk's clocks and the retainage line read from these. The dry run reads the job and replies with the columns before → after and the clocks' footing, under a plan_hash; nothing is written. Refused when the row already reads that way.",
    inputSchema: { type: 'object', properties: { contract: { type: 'object', description: '{ job_id (find_job), ended_on (YYYY-MM-DD), how (complete | terminated | abandoned), retainage_held?, payment_bond? (yes | no | unknown) } | { job_id, clear: true }' } }, required: ['contract'] },
  },
  {
    name: 'apply_contract_ended',
    description: 'Record the end you planned: the same contract plus the plan_hash from plan_contract_ended. Reads the job again first and writes only when it still matches: one PATCH on jobs_ledger as you, read back to confirm it landed (a row RLS kept is said).',
    inputSchema: { type: 'object', properties: { contract: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['contract', 'plan_hash'] },
  },
  {
    name: 'plan_property_record',
    description: "Dry-run a change to a property record's lien facts (v2.6950, the first of the Lien desk's verbs): the record the Property record row on Edit Job, Edit customer's Properties and the Lien desk's property window save — the county, the legal description, the kind (residential | commercial), the homestead answer, the owner of record (mode, name, company), where the owner's mail goes, the owner's email and phone — as one write on customer_addresses under the form's own RLS. Name the record by job_id (the job's linked property) or property_id. The form's rules hold: a typed county is marked typed by hand, a commercial kind clears homestead, homestead is asked only of a residential property, and a yes or a no stamps the answer where the record carries that column. The record is shared, so the dry run names every job that follows the change, each column before → after, what the Lien desk reads off the record before and after (the dates' footing, the homestead hold) and what the lien papers still lack, under a plan_hash; nothing is written. Refused when the job has no record linked or the record already reads that way.",
    inputSchema: { type: 'object', properties: { record: { type: 'object', description: '{ job_id (find_job) | property_id, set: { county?, legal_description?, property_kind? (residential | commercial | ""), homestead? (true | false), owner_mode? (homeowner | building_owner | ""), owner_name?, owner_company?, owner_mailing_address?, owner_email?, owner_phone? } }' } }, required: ['record'] },
  },
  {
    name: 'apply_property_record',
    description: 'Save the change you planned: the same record plus the plan_hash from plan_property_record. Reads the record again first and writes only when it still matches: one PATCH on customer_addresses as you, read back to confirm it landed (a row RLS kept is said). Replies with the columns changed and what the Lien desk reads off the record now.',
    inputSchema: { type: 'object', properties: { record: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['record', 'plan_hash'] },
  },
  {
    name: 'plan_job_payment',
    description: "Dry-run a change to a payment on a job (v2.6940), as the Job window's payments and Accounts Receivable make it, as you. Three actions. remove takes a payment row off through remove_jobs_ledger_payment_and_reconcile, the RPC behind the Job window's Remove: the paid figure is worked out again, a bill it sat on reads Billed again, a Paid job that no longer covers its total moves back to Billed, and your reason (required) lands on the job's activity as a note in your name; a row with a bank deposit behind it is refused unless unlink_bank: true (Accounts Receivable's Unlink and remove, which frees the deposit to be matched again). record adds one row as the payments table writes it (amount, paid_on, payment_type, reference_number, note); a row of the same amount on the same day refuses the plan unless duplicate_ok. link ties an existing row to its bank row (mercury_transaction_id) through apply_mercury_bank_payment_allocations, Accounts Receivable's link of a recorded payment, or changes its type, reference or note. The plan is this server's read: the job with its total, paid figure and status, every payment row on it, the row named and what stands behind it (a bank row, a typed type and reference, or nothing), the paid figure and status after, what the write sets off and the note it leaves, under a plan_hash; nothing is written. Refused for a row Stripe holds (a credit note, a bill marked paid in Stripe, a payment Stripe recorded), a deposit the bank returned, a deposit with less left than the payment, and a remove with no reason. Nothing goes to the customer.",
    inputSchema: { type: 'object', properties: { payment: { type: 'object', description: "{ action: 'remove', payment_id (get_job lists them), reason, unlink_bank? } | { action: 'record', job_id (find_job), amount, paid_on (YYYY-MM-DD), payment_type? (Cash | Check | Wire | ACH | Card (external) | Other), reference_number?, note?, reason?, duplicate_ok? } | { action: 'link', payment_id, mercury_transaction_id?, payment_type?, reference_number?, note?, reason? }" } }, required: ['payment'] },
  },
  {
    name: 'apply_job_payment',
    description: "Make the payment change you planned: the same payment plus the plan_hash from plan_job_payment. Reads the job, its payment rows and the bank row again first and writes only when they still match; then the screen's own door as you — the remove RPC, the row's insert, or the row's words and Accounts Receivable's link — and the note on the job's activity. Replies with what the door answered, the paid figure and status read back, and whether the note landed. A removed row is not restored: record it again to put it back.",
    inputSchema: { type: 'object', properties: { payment: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['payment', 'plan_hash'] },
  },
  {
    name: 'plan_job_combine',
    description: "Dry-run combining one job into another (v2.6940), as Pipeline → the tools menu → Combine / Separate… does: migrate_job_ledger_costs_and_delete as you. The source's costs, labor, schedule, reports and photos, stage lines, Materials on site, notes, messages and paper move to the target, its job total is ADDED to the target's, its HCP # and C# stay on the target as prior numbers, and the source is deleted. Bills and payments never move: with allow_billed false (the Combine tab) a source that holds either is refused; with allow_billed true (the Delete flow's Reassign to another job…) they are deleted with the source. The plan shows both jobs as they read with their payment rows and bills, a count of what would move by kind, the target's job total, paid figure and status after, the prior numbers kept, every reason the combine would stop (stops, each with its fix: the source's status, a payment or a bill on it, a payment both jobs hold, a work order, agreement or pay application on both, supply shares past 100%, two different customers) and warnings (two equal job totals that would double, a source further along than the target). It says in words when the source carries a payment the target also has: take the duplicate off with plan_job_payment first, then combine. There is no undo, and the plan says so. Nothing is written.",
    inputSchema: { type: 'object', properties: { combine: { type: 'object', description: '{ from_job_id (the job that goes away — find_job), to_job_id (the job that stays), allow_billed? (false), different_customers_ok? (false) }' } }, required: ['combine'] },
  },
  {
    name: 'apply_job_combine',
    description: 'Combine the jobs you planned: the same combine, the plan_hash from plan_job_combine and confirm_no_undo: true. Reads both jobs again first and acts only when the plan still matches and nothing stops it; then one POST of migrate_job_ledger_costs_and_delete as you, which moves everything or nothing. Replies with the note the RPC left on the target, the target read back (job total, paid figure, status, prior numbers) and the ask to move the box photos in Drive. There is no undo: what moved stays on the target and the source is deleted.',
    inputSchema: { type: 'object', properties: { combine: { type: 'object' }, plan_hash: { type: 'string' }, confirm_no_undo: { type: 'boolean' } }, required: ['combine', 'plan_hash', 'confirm_no_undo'] },
  },
  {
    name: 'plan_bid_pricing',
    description: "Dry-run prices on a bid's count rows (v2.6992), as Bids → Pricing sets them, as you under the tab's own RLS: rows = [{ fixture, group?, price }] — dollars each for one counted unit, 0 or more, or null to clear a price — on the pricing the tab opens on (its ★ on the active version, else the bid's own copy, else the shared book it falls back on). The write is the tab's one rule: a row with an assignment changes its override (null falls back to its book entry's price); a row a book entry prices by its fixture's name gets an assignment with the price, since the grid prefers an entry over a custom price; any other row gets a custom price. On a shared price book the apply first takes the bid's own copy of it, as the tab does, so the shared book never changes. A bid already sent needs revise: true, the tab's Revise press. Refused: a bid with no creator on record, no pricing to write on, the robots' book. Held, not refused: a fixture with no count row, a bad price, a row named twice. The reply lists each row's price before → after and the grid's revenue total before → after through its own kernel, under a plan_hash; nothing is written. The margin stamp stays the tab's.",
    inputSchema: { type: 'object', properties: { pricing: { type: 'object', description: '{ bid_id (find_bid), rows: [{ fixture, group?, price (dollars each, or null) }], revise? }' } }, required: ['pricing'] },
  },
  {
    name: 'apply_bid_pricing',
    description: 'Write the prices you planned: the same pricing plus the plan_hash from plan_bid_pricing. Reads the prices again first and writes only when the plan still matches. On a shared book it first takes the bid\'s own copy (clone_price_book_version_to_bid), points the bid at it and plans again there; then each row\'s write as the tab makes it. A row that fails is named with its reason and the rest still goes on. Replies with what landed, the copy it wrote on and the grid\'s total as it reads now.',
    inputSchema: { type: 'object', properties: { pricing: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['pricing', 'plan_hash'] },
  },
  {
    name: 'plan_bid_labor',
    description: "Dry-run a bid's Labor tab (v2.6976), as you under the tab's own RLS: estimate = { labor_rate, driving_cost_rate, hours_per_trip, estimator_cost_per_count, estimator_cost_flat_amount, travel_people, travel_nights, travel_meals_rate, travel_hotel_rate } (each held to the tab's own ranges), rows = [{ fixture, rough_in?, top_out?, trim_set?, kind?, unit? }] and direct = [{ kind (equipment | permit | sub | waste | other), note, rough_in?, top_out?, trim_set?, remove? }]. A labor row is keyed by the fixture's name and only a counted fixture has one, as on the tab: a fixture with a row is changed in the hours you name, a counted fixture with no row yet is minted as the tab's sync mints it, and a fixture nobody counts is held (plan_bid_counts adds it). Hours are for ONE unit; a task's hours are the whole task's (kind: task); a sub line has none (kind: sub). Hours here read as typed, as the tab's queue writes them, so the database's labor fill on a first sent date leaves them alone. A direct cost line is dollars a stage, found again by its kind and note. The estimate is made when the bid has none. The reply lists each box before → after, each row and line as mint, add, change, remove, unchanged or held with its reason, and the tab's \"Direct cost of this bid\" before and after through its own kernel at the bid's own rate; with no rate, labor dollars are left out and said. A bid with no creator on record is refused: the database lets nobody write its labor. Never teaches the labor book. Nothing is written.",
    inputSchema: { type: 'object', properties: { labor: { type: 'object', description: '{ bid_id (find_bid), estimate?, rows?: [{ fixture, rough_in?, top_out?, trim_set?, kind? (fixture | task | sub), unit? (each | per_100ft) }], direct?: [{ kind, note, rough_in?, top_out?, trim_set?, remove? }], version_id? }' } }, required: ['labor'] },
  },
  {
    name: 'apply_bid_labor',
    description: 'Write the labor you planned: the same labor plus the plan_hash from plan_bid_labor. Reads the tab again first and writes only when the plan still matches. In the tab\'s order: the estimate made when missing, its boxes, the minted rows in one insert, each changed row, then each direct cost line; a write that fails is named with its reason and the rest still goes on. Replies with what landed, what failed and the cost line as it reads now.',
    inputSchema: { type: 'object', properties: { labor: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['labor', 'plan_hash'] },
  },
  {
    name: 'plan_bid_takeoff',
    description: "Dry-run a bid's takeoff (v2.6968), as the Takeoffs tab holds it on a count row, as you under the tab's own RLS: rows = [{ fixture, group?, lines?: [{ part_id | part (its exact name in the bid's trade's parts book), quantity, unit_price? }], replace?, materials_each?, materials_from? }]. The count row is named by the Count Sheet's key (plan_bid_counts adds one). A line's quantity is for ONE counted unit: the row's count multiplies it. With no unit_price a new line takes the parts book's lowest price and remembers the price row; a part with no price lands at $0 and the plan says so; a typed price forgets the price row. The line snapshots how the part is sold (20 ft sticks, a box), so the order rounding works as on the tab. One line a part on a row: the line that already carries the part is changed (its price kept unless you give one), a part not on the row is added after its last line, and replace: true rewrites the row's lines whole (a replace with a held line holds the whole row). materials_each is a quoted materials cost for one counted unit, in dollars, with materials_from naming who quoted it; Pricing costs the row from it over the lines, and null clears it. Held, not refused: a fixture with no count row, a part not found or named by several parts, a part of another trade's book, a quantity not above zero, the same part twice in a row's lines. A plan with nothing ready is refused. The reply lists every row and line as add, change, unchanged or held with its reason, one unit's materials before and after, and the bid's materials before and after, before tax and with order rounding, through the tab's own kernel, under a plan_hash; nothing is written.",
    inputSchema: { type: 'object', properties: { takeoff: { type: 'object', description: '{ bid_id (find_bid), rows: [{ fixture, group?, lines?: [{ part_id | part, quantity, unit_price? }], replace?, materials_each?, materials_from? }], version_id? }' } }, required: ['takeoff'] },
  },
  {
    name: 'apply_bid_takeoff',
    description: 'Write the takeoff you planned: the same takeoff plus the plan_hash from plan_bid_takeoff. Reads the lines again first and writes only when the plan still matches. Row by row: a replace removes the row\'s lines, the new lines go in as one insert, each changed line is its own write, then the quoted cost is set or cleared; a row that fails is named with its reason and the next row still goes on. Replies with what landed, what failed and the bid\'s materials as they read now.',
    inputSchema: { type: 'object', properties: { takeoff: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['takeoff', 'plan_hash'] },
  },
  {
    name: 'plan_bid_counts',
    description: "Dry-run count rows onto a bid (v2.6967), as the Counts tab's Count Sheet writes them, as you under the tab's own RLS: rows = [{ fixture, count, unit?, page?, group?, alternate? }] added or changed, remove = [{ fixture, group? }]. The key is the sheet's own rule, one row a fixture in a scope, where a scope is the base bid or one alternate group: a fixture not on the sheet there is added after the bid's last row (the unit read off its name when left out, as quick add does); one already there is changed in the fields you name (count, unit, page, group); the same fixture twice in a scope is held, as quick add refuses it, so an area is the row's group and not a second row. A `[Group] ` prefix on a fixture is lifted off the name, as the sheet's import does. alternate: true joins the row's group to the bid's alternates, priced with and without. Rows land on the bid's active version (version_id names another). Held, not refused: a row with no fixture, a count that is not above zero, a unit that is not ea, ft, px or sqft, an alternate with no group, a fixture several rows already wear. A plan with nothing ready is refused. The reply lists every row as add, change, unchanged or held with its reason, every remove with the takeoff lines and prices that go with the row, the sheet's totals before and after in its own words, what follows on Labor and Pricing, and what the verb does not do, under a plan_hash; nothing is written.",
    inputSchema: { type: 'object', properties: { counts: { type: 'object', description: '{ bid_id (find_bid), rows?: [{ fixture, count, unit? (ea | ft | px | sqft), page?, group?, alternate? }], remove?: [{ fixture, group? }], version_id? }' } }, required: ['counts'] },
  },
  {
    name: 'apply_bid_counts',
    description: 'Write the count rows you planned: the same counts plus the plan_hash from plan_bid_counts. Reads the sheet again first and writes only when the plan still matches. The new rows go in as one insert tagged as the sheet\'s import, each changed row as its own edit, each remove as the row\'s delete, then the alternates onto the bid; a row that fails is named with its reason and the rest still lands. Replies with what landed, what failed and the sheet\'s totals as they read now.',
    inputSchema: { type: 'object', properties: { counts: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['counts', 'plan_hash'] },
  },
  {
    name: 'plan_bid_update',
    description: "Dry-run a change to a bid (v2.6945), as Edit Bid and the Bid Board change it: the form's columns — project name, address, the GC (customer_id), project, development, service type, estimator, account manager, due date and time, start date, drawing date, bid value, agreed value, profit, the sent date and who it went to (submitted_to), the outcome (won, lost, started_or_complete, or null for open) with the day it was decided (outcome_at) and why it was lost (loss_category, loss_reason), the GC contact, the links, distance, the robot opt-out, notes — as one write under the form's own RLS. The columns that ride with another are written with it, as the form writes them: a bid that stops being lost drops its reason, a cleared due date drops its time, a cleared sent date drops the checklist that confirmed it. The sent date lands as the Cover Letter's Mark sent lands it, with no checklist: those three lines are a person's own word. On a bid with versions, Sent and Won / Lost are per GC and are refused here, as the form locks them. The dry run reads the bid, its versions, the jobs that point at it and every row a new id names, and replies with each column before → after (a column already holding its value is dropped; a plan that changes nothing is refused), the line the form leaves on the bid's notes when the outcome moves, what the database does after the write (the decided day, the labor rows filled from the book on a first sent date, the robot shadow scored, the Board section it moves to, the History lines), warnings and what the verb does not do, under a plan_hash committed to the before values and the bid's updated_at; nothing is written.",
    inputSchema: { type: 'object', properties: { update: { type: 'object', description: '{ bid_id (find_bid), set ({ column: value }; null clears a column that may be blank) }' } }, required: ['update'] },
  },
  {
    name: 'apply_bid_update',
    description: "Change the bid you planned: the same update plus the plan_hash from plan_bid_update. Reads the bid again first and writes only when it still matches — a change by anyone since refuses. One PATCH on bids as you (read back to say what landed; a row RLS kept is said), then the outcome line on the bid's notes when the outcome moved, as Edit Bid leaves it. A win opens no job and nothing is sent to anyone. Replies with what changed, where the bid stands on the Bid Board and the next step.",
    inputSchema: { type: 'object', properties: { update: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['update', 'plan_hash'] },
  },
  {
    name: 'plan_sub_labor',
    description: "Dry-run a sub labor sheet on a job (v2.6944), as Jobs → Subs → Pay's New Sub Labor and Edit window write it, as you under RLS. Three actions. add makes a sheet for one subcontractor or primary on one job (the two the form's Subcontractors list offers): its day (date, with through when the work ran several days), its lines (each a flat amount, or hours at a rate — one way a sheet, as the form's switch holds it), a note, and stated: { source } when the days come from a record outside the app and not a punch. A sheet has no column for a note, a span or a source, so a line's day and the stated mark ride in the line's own words (\"2026-10-14 · Rough-in (stated, their own day log)\") and the note, the span and the source land on the job's activity as a note by you. change moves a sheet's day, replaces its lines whole (the Edit window's save) or moves the sheet to another job with job_id (the Edit window's change beside the job: the sheet takes that job, its number and its address, its payments go with it, and the plan shows both jobs' sub labor and profit before and after). remove deletes a sheet, held while it carries a payment (the screen would delete those without a trace). The plan is the server's read: the job and the person as they stand (refused for a teammate who is neither a subcontractor nor a primary; for an archived person, a sub on the bench, a job with no address; a primary's sheet is one the Pay ledger files under Crew pay, and the plan says so), the sheet and each line as it would land with what it owes them and what it costs the job, their other sheets on the job (a sheet of theirs on the same days refuses the plan unless second_sheet_ok), every sheet on the job, the job's sub labor before and after from the Job window's own kernel and the profit band before and after as get_job works it out, the job's allocated bank rows that may be this same pay (the same dollars would count twice: as a card charge and as sub labor), what it sets off and what it does not do. The hash commits to all of it but the profit band, so a sheet added or changed on the job since refuses the apply. It tells nobody and records no payment: plan_sub_labor_payment does that.",
    inputSchema: { type: 'object', properties: { labor: { type: 'object', description: "{ action?: 'add', job_id (find_job), person (a people.id, a users.id or one sub's whole name), date (YYYY-MM-DD, never ahead of today), through?, lines: [{ what, day?, amount } | { what, day?, hours, rate, count? }] (1 to 40, all flat or all hours at a rate), note?, stated?: { source }, second_sheet_ok? } | { action: 'change', sheet_id, job_id? (move the sheet to this job), date?, lines? (replaces every line), stated?, reason? } | { action: 'remove', sheet_id, reason }" } }, required: ['labor'] },
  },
  {
    name: 'apply_sub_labor',
    description: "Write the sheet you planned: the same labor plus the plan_hash from plan_sub_labor. Reads the job, the person and the job's sheets again first and writes only when they still match; then the screen's own rows as you — the sheet, its assignee row and its lines for an add (a sheet whose lines are refused is taken off again), the new lines then the old ones removed and the sheet's patch (its day, its rate, its job) for a change, the sheet's delete for a remove — and the note on the job's activity when the plan showed one. Replies with the sheet's id, whether it is tied to their roster row, and whether the note landed. A removed sheet is not restored: add it again.",
    inputSchema: { type: 'object', properties: { labor: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['labor', 'plan_hash'] },
  },
  {
    name: 'plan_sub_labor_payment',
    description: "Dry-run what was paid against a sub labor sheet (v2.6944), as the Pay ledger's Make Payment and a payment's Remove do, as you. record adds one payment line (amount, paid_on, and a memo made of method, reference and note — a sheet payment has no column for any of the three, and the memo shows to the sub on their portal unless hidden_from_sub). remove takes a payment off through remove_labor_job_payment with your reason, which keeps its snapshot on the payment's trace for a 30-day Undo in the app. Name the bank row that paid it as mercury_transaction_id and the plan checks it: money out, not returned, its payee and amount beside the payment's, and every job that row is already allocated to as cost — an allocated bank row counts in a job's profit as a card charge and the sheet already counts as sub labor, so the plan warns in words that the dollars would count twice and names each allocation. It never moves an allocation (plan_cost_batch does) and never writes the bank row anywhere. With no bank row named, the plan lists the job's allocated bank rows that may be this payment. The plan shows the sheet with its payments, the balance before and after (paid in full reads Paid by itself), and what it does not do: no approval step exists on a sheet payment, a backcharge and a move to another sheet stay the app's own presses, and nothing is sent. A sheet's payments move no job profit: a sheet counts for what it owes, paid or not.",
    inputSchema: { type: 'object', properties: { payment: { type: 'object', description: "{ action?: 'record', sheet_id (plan_sub_labor lists a job's sheets), amount, paid_on (YYYY-MM-DD), method?, reference?, note?, mercury_transaction_id? (the bank row that paid it, read and checked only), hidden_from_sub?, duplicate_ok? } | { action: 'remove', payment_id, reason }" } }, required: ['payment'] },
  },
  {
    name: 'apply_sub_labor_payment',
    description: "Make the payment change you planned: the same payment plus the plan_hash from plan_sub_labor_payment. Reads the sheet, its payments and the bank row's allocations again first and writes only when they still match; then one row into people_labor_job_payments as you, or the remove RPC. Replies with the row or the trace event, and the sheet's paid and open figures read back.",
    inputSchema: { type: 'object', properties: { payment: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['payment', 'plan_hash'] },
  },
  {
    name: 'plan_submittal_rows',
    description: "Dry-run submittal rows onto a bid (v2.6804): one row per fixture tag, one or many, as Bids → Submittals' Add a row and Edit write them, as you under the tab's own RLS. Rows land on the bid's newest revision while it is a draft, or on a Rev 1 the apply makes when the bid has none; a revision the GC holds refuses the plan and names the tab's press. A tag already on the draft is changed, the fields you name only (null clears one); a new tag is added after the last row. Each row takes what the plans specified, what you submit, a status (worked out from the two products by the tab's rule when left out: Proposed when the plans named nothing), a reason, a lead time, a supply house by name or id, and order_only. The plan replies with the revision, each row as add, change or unchanged with how it will read, what it holds and why (a row the GC answered, a row that carries parts, a house it cannot find) while the rest goes on, warnings (an alternate with no reason), the writes and what the verb does not do, under a plan_hash; nothing is written. get_submittals reads the bid first.",
    inputSchema: { type: 'object', properties: { submittal: { type: 'object', description: '{ bid (id or text that finds one bid), rows: [{ tag, specified?: { manufacturer?, model?, description? }, submitted?: { manufacturer?, model?, label? }, status? (as_specified | superseded | equal | alternate | design_change | missing | accessory | proposed), reason_kind? (lead_time | discontinued | in_stock | equal | cost | other), reason_note?, lead_time_days?, supply_house? (name or id), order_only? }] } — up to 100 rows' } }, required: ['submittal'] },
  },
  {
    name: 'apply_submittal_rows',
    description: 'Load the rows you planned: the same submittal plus the plan_hash from plan_submittal_rows. Reads the bid again first and writes only when it still matches: Rev 1 as a draft when the bid had no revision, the new rows in one insert into bid_submittal_items, then each changed row, all as you (training mode, a twin and an archived account are refused by the tables, as on the tab). Replies with what landed, anything that failed with its reason, and the read that shows it. Nothing is shared with the GC and nobody is told.',
    inputSchema: { type: 'object', properties: { submittal: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['submittal', 'plan_hash'] },
  },
  {
    name: 'plan_submittal_log',
    description: "Dry-run facts onto a bid's order log (v2.6804): ordered_on, po_ref, expected_on, delivered_on and the note for the GC on one line or many, as the Procure step's date boxes write them, as you under the tab's own RLS. Name a line by its key as get_submittals lists it, or by its row's tag (all_parts: true for every part line under the tag). A date is YYYY-MM-DD and null clears it; an ordered or delivered day after today is held, since it has not happened. The plan draws the log again with the facts in and replies with each line's step and status before and after (To order → On order: Arrives 11/20), the four steps' counts before and after, the Next line after, what it holds and why, warnings (a part the GC has not approved, a delivery before its order), the writes and what the verb does not do, under a plan_hash; nothing is written. A Delivered date here puts nothing in Materials on site: plan_delivery does that.",
    inputSchema: { type: 'object', properties: { log: { type: 'object', description: '{ bid (id or text that finds one bid), lines: [{ line (the key get_submittals lists) | tag (+ all_parts?), ordered_on?, po_ref?, expected_on?, delivered_on?, note? }] } — up to 100 lines' } }, required: ['log'] },
  },
  {
    name: 'apply_submittal_log',
    description: 'Write the log facts you planned: the same log plus the plan_hash from plan_submittal_log. Reads the bid again first and writes only when it still matches: each line\'s record in bid_procurement_items updated, or made with the next sort order when the line had none, as you. Replies with what landed, anything that failed with its reason, and the read that shows it. No update is sent to the GC and nobody is told.',
    inputSchema: { type: 'object', properties: { log: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['log', 'plan_hash'] },
  },
  {
    name: 'plan_activity_note',
    description: "Dry-run a note onto a job's Activity or a bid's notes (v2.6822): one line of your words where the team reads it in the app — a job's Job activity / notes (the Pipeline row's thread, the job window's Activity; the row the Note press writes) or a bid's Notes on the Bid Board (the bid's own, or about one GC on it), as you, under the same RLS as the screen. The plan names the job or the bid as it reads, shows the latest lines already there, the row as it will land and where it shows. It tells nobody: no email, text or push. Use it after a submittal or an order moved to leave the word on the job; the customer's own thread is the job window's Note · Text · Email. Replies with plan_hash.",
    inputSchema: { type: 'object', properties: { note: { type: 'object', description: '{ job (an id, or text that finds one job — find_job) OR bid (an id, or text that finds one bid — find_bid), text (the note, under 4,000 characters), on? (YYYY-MM-DD, the day it is about when not today, never ahead; stamped noon that day; left out, stamped when the apply writes it), gc_customer_id? (a bid note about one GC on the bid, a customers.id; left out, the bid\'s own note) }' } }, required: ['note'] },
  },
  {
    name: 'apply_activity_note',
    description: "Write the note you planned: the same note plus the plan_hash from plan_activity_note. Reads the job or the bid again first and writes only when it still matches (a new line on the thread since the plan moves the hash): one insert as you into jobs_ledger_thread_notes or bids_submission_entries. Replies with the row's id, where it shows and the read that lists it. One apply per plan.",
    inputSchema: { type: 'object', properties: { note: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['note', 'plan_hash'] },
  },
  {
    name: 'plan_plan_set',
    description: "Dry-run a set of drawings onto a plan part (v2.6317, punch list #239): what the job window's Plans section adds — an issued, addendum, bulletin, revised, permit, construction or assembled set, or our as-built — on the part a job builds from (part_id, or job_id for the job's own part), with its name, its source (the GC, the architect, us), the date on the sheets, a memo and its Drive link, the set it replaces and, for an as-built, the set it marks up. make_current says the part builds from it: true when the part has no set yet, false otherwise unless you pass it; never for an as-built. The dry run reads the part as you and replies with the part as it stands (its sets, what it builds from), the set as its line will read and what the part builds from after, under a plan_hash; nothing is written. A paper (a spec, a submittal, a schedule, a task list) is plan_paper.",
    inputSchema: { type: 'object', properties: { set: { type: 'object', description: '{ part_id? | job_id?, name, kind, source, dated?, memo?, link?, replaces_set_id?, marks_up_set_id?, make_current? }' } }, required: ['set'] },
  },
  {
    name: 'apply_plan_set',
    description: "Add the set you planned: the same set plus the plan_hash from plan_plan_set. Reads the part again first and writes only when it still matches — a set added to the part or a switch of what it builds from since refuses it: plan again. Written as you, under the same RLS as the Plans section: the plan_sets row and, when make_current, the part's current set (the job's old plans link follows by the database's trigger). The job's Plans section and the site's Plans look show it at once.",
    inputSchema: { type: 'object', properties: { set: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['set', 'plan_hash'] },
  },
  {
    name: 'plan_paper',
    description: "Dry-run a paper onto a plan part (v2.6317, punch list #239's papers): a spec, submittal, schedule, scope, change order, meeting notes, task list, report, sheet or other, kept beside the set it goes with (goes_with_set_id) on the part a job builds from (part_id, or job_id for the job's part, which the paper is then kept on), from the owner/GC, the architect, the engineer, a supplier or us, with the day it came (today when left out), a memo, its link, the paper it replaces, and the question it asks of us — ask { lane: estimators | dispatch, words } lands in that inbox as the Development page's Ask does. owed: true keeps a paper we are waiting on: no link, and the ask says who owes it. action came marks an owed paper landed: paper_id and its link. The dry run reads the part as you and replies with the paper as its line will read, the ask as it will land and the History line the database will write, under a plan_hash; nothing is written.",
    inputSchema: { type: 'object', properties: { paper: { type: 'object', description: '{ action?: keep | came; keep: part_id? | job_id?, kind, name, from, came_on?, memo?, link?, goes_with_set_id?, replaces_paper_id?, owed?, ask? { lane, words }; came: paper_id, link }' } }, required: ['paper'] },
  },
  {
    name: 'apply_paper',
    description: "Keep the paper you planned: the same paper plus the plan_hash from plan_paper. Reads the part again first and writes only when it still matches. Written as you, as the Plans section writes it: the question first into its lane's inbox (estimator_requests or dispatch_requests, then the lane's push), then the plan_sets row naming it; the site's History line is the database's own trigger. For action came: owed clears, the link lands and came_at is now.",
    inputSchema: { type: 'object', properties: { paper: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['paper', 'plan_hash'] },
  },
  {
    name: 'read_on_site',
    description: "Materials on site (v2.6367, punch list #209): what is in a job's stencilled cages and boxes as the phone's On site tab and the office's Jobs → Materials read it — every live box with its stencil, kind, place, QR code and lines (part, on hand, last touched, the last count's difference), Unsorted (what a delivery landed that nobody put away), the retired boxes with the screens' Bring back verdict, the boxes due a count (14 days), the last 30 days' shortfalls and Can't find presses, and the newest 15 ledger rows. The numbers come from the screens' own kernel over the whole ledger (a count resets a line; on hand is the sum). `job` is an id, or text that matches exactly one job. Read it before any plan_ verb here: a box is named by its stencil as listed.",
    inputSchema: { type: 'object', properties: { job: { type: 'string', description: "Job id, or a number like 'J1032'" } }, required: ['job'] },
  },
  {
    name: 'plan_container',
    description: "Dry-run a cage or box on a job (v2.6367): add one (its stencil, kind cage | box | loose, where it stands, its place — made when the job has none of that name), move one to another place, retire an empty one (a box with parts in it is refused, as on the phone: move them or mark them used first), or bring a retired one back (v2.6406's Bring back: refused while a live box on the job carries its stencil). The dry run replies with the box as it will read, the job, and a live row count under a plan_hash; nothing is written. Unsorted is the app's own row: never added, moved or retired here.",
    inputSchema: { type: 'object', properties: { container: { type: 'object', description: "{ job_id (find_job), action: 'add' | 'move' | 'retire' | 'bring_back' (add when left out), agent_label (the robot's name as the row shows it); add: label, kind, where?, place?; move: container (a stencil or id), place; retire: container; bring_back: container (a retired box's stencil or id — read_on_site lists them under retired); at? (an ISO timestamp with its offset for a move or retire that happened earlier) }" } }, required: ['container'] },
  },
  {
    name: 'apply_container',
    description: 'Make the container change you planned: the same container plus the plan_hash from plan_container. Runs the dry run again first and writes only when it still matches — a box added, moved, retired or brought back on the job since, plan again. Written as you through dev_on_site_write under your own RLS, the row stamped "<agent_label> · MCP as <you>"; the crew and the office see it at once. Replies with the box id and its label code.',
    inputSchema: { type: 'object', properties: { container: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['container', 'plan_hash'] },
  },
  {
    name: 'plan_delivery',
    description: "Dry-run a delivery onto a job's site (v2.6367): the lines of an invoice or a PO (a parts-book part by id, or a name typed as on site; a whole quantity; a unit) land in the job's Unsorted row — made on first use, the way the office's Deliveries panel lands them — or straight into a named box, with the invoice or PO as their source. The dry run replies with every line's on hand before and after, the box, the source and the box's live row count under a plan_hash; nothing is written.",
    inputSchema: { type: 'object', properties: { delivery: { type: 'object', description: "{ job_id (find_job), agent_label, lines: [{ part_id | part_name, manufacturer?, quantity, unit? }] (1–200), source? (INV-10422, PO-2211), to? (a stencil or id; Unsorted when left out), at? (an ISO timestamp with its offset when it came earlier) }" } }, required: ['delivery'] },
  },
  {
    name: 'apply_delivery',
    description: 'Land the delivery you planned: the same delivery plus the plan_hash from plan_delivery. Runs the dry run again first and writes only when it still matches — a press on that box since, plan again. One delivered row per line, as you, stamped "<agent_label> · MCP as <you>", with the source on each; the crew sees them in Unsorted with Put in…, the office under Deliveries so far.',
    inputSchema: { type: 'object', properties: { delivery: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['delivery', 'plan_hash'] },
  },
  {
    name: 'plan_movement',
    description: "Dry-run one press on a line of a box (v2.6367), the phone's own presses: moved (to another box — Put in… from Unsorted is this), used, returned (to the supply house, a credit due), taken (where it went, in note), cannot_find (the office reads the line amber) or damaged. The quantity is capped at what the box has, as the phone caps it; a box with none of the part refuses. The dry run replies with the press as the phone would label it (Mark 4 used, Move 10 to A1), on hand before and after on both boxes, and the box's live row count under a plan_hash; nothing is written.",
    inputSchema: { type: 'object', properties: { movement: { type: 'object', description: "{ job_id (find_job), agent_label, container (a stencil or id, or Unsorted), part_id | part_name (a line of the box, as read_on_site lists it), quantity, reason: 'moved' | 'used' | 'returned' | 'taken' | 'cannot_find' | 'damaged', to? (moved only), note? (taken needs one), at? (an ISO timestamp with its offset when it happened earlier) }" } }, required: ['movement'] },
  },
  {
    name: 'apply_movement',
    description: 'Write the press you planned: the same movement plus the plan_hash from plan_movement. Runs the dry run again first and writes only when it still matches — a press on that box since, plan again. One ledger row, as you, stamped "<agent_label> · MCP as <you>". The ledger is append-only: a wrong press is undone by the opposite press or a count, never an edit.',
    inputSchema: { type: 'object', properties: { movement: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['movement', 'plan_hash'] },
  },
  {
    name: 'plan_count',
    description: "Dry-run a count of a box (v2.6367), the phone's Count this box walk or the office's Correct…: for each line named, what is there now. A count row resets the line to the number counted and keeps the difference — a shortfall reads missing on the office's page and in read_on_site, a surplus reads found; a part not yet in the box may be counted into it. A line left out is not reset. The dry run replies with every line's expected, counted and difference in words, and the box's live row count under a plan_hash; nothing is written.",
    inputSchema: { type: 'object', properties: { count: { type: 'object', description: "{ job_id (find_job), agent_label, container (a stencil or id), lines: [{ part_id | part_name, manufacturer?, counted }] (1–200), at? (an ISO timestamp with its offset when the count was walked earlier) }" } }, required: ['count'] },
  },
  {
    name: 'apply_count',
    description: 'Save the count you planned: the same count plus the plan_hash from plan_count. Runs the dry run again first and writes only when it still matches — a press on that box since, plan again. One counted row per line, as you, stamped "<agent_label> · MCP as <you>"; the box reads counted today by that name.',
    inputSchema: { type: 'object', properties: { count: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['count', 'plan_hash'] },
  },
  {
    name: 'plan_materials_move',
    description: "Dry-run moving everything one job holds on site to another job (v2.6808, punch list #209), for a count that was recorded under the wrong job: its places, cages and boxes, the whole ledger, the boxes' own moves and their photos. Every cage and box keeps its id and the code printed on its label, and no ledger row is rewritten, only the job it sits under. The rule is the whole-job combine's own: a place of the same name becomes one, the source's Unsorted folds into the target's, and a live stencil the target already holds takes a numbered label (A1 (2)). The source job itself stays, with nothing on site. The dry run does the move, reads both jobs and unwinds it: it replies with the counts moved per table, the places that became one, every label renumbered with its code, where the photos' files are (a file already in Drive is moved into the new job's photo folder by the apply, its Drive id kept, so it still opens from its box; one still waiting is filed for the new job), the row counts and parts on hand on both jobs before and after, and the note each job will carry, under a plan_hash; nothing is written. read_on_site both jobs first. Refused when the two jobs are the same or the source holds nothing.",
    inputSchema: { type: 'object', properties: { move: { type: 'object', description: "{ from_job (the jobs_ledger.id the material is recorded under — find_job), to_job (the jobs_ledger.id it belongs on) }" } }, required: ['move'] },
  },
  {
    name: 'apply_materials_move',
    description: "Make the move you planned: the same move plus the plan_hash from plan_materials_move. Runs the dry run again first and writes only when it still matches — a press, a box, a photo or a place on either job since, plan again. Written as you through dev_on_site_move_job, with a note on both jobs in your name; the crew and the office see the boxes under the new job at once; the photos already filed in Drive are then moved into the new job's photo folder by photo-save (photos.refiled: moved, already there, held with the reason each; a failed ask never undoes the move), and a press sent from a phone that still has the old job open lands on the box's job (refused for someone who is not on the new job's team, so put the crew on it first). A second apply is refused: the source holds nothing.",
    inputSchema: { type: 'object', properties: { move: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['move', 'plan_hash'] },
  },
  {
    name: 'read_file_index_status',
    description: 'Where our own file index stands (v2.6332, punch list #240): rows, rows with text, counts by source (export, pdf_layer, plain, ocr), by why (scan, kind, big, slow, error, reading) and by folder, the jobs and bids with rows, the PDFs read only in part, the live and paid jobs with a Drive folder and how many have no row yet, the newest indexed stamp, the oldest recheck and the sweep’s last look. One call of dev_file_index_status as you. Read it before a backfill and after.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'plan_index_backfill',
    description: "Dry-run the one-time backfill of the file index (v2.6332, punch list #240): the jobs a scope would walk — live (every job with a Drive folder not Paid in Full, oldest first by created_at), paid (the back catalogue, newest first) or job (one job by jobs_ledger.id) — at most 500 a plan (after_job inside the plan starts the list after that job: the next 500, or going on past a job that left the scope), with how many already have rows and the sweep’s last look, under a plan_hash that commits to the job list. Nothing is read from Drive and nothing is written. retry: true takes held rows (slow, error, big, a stopped read) again. scope person (v2.6721, punch list #285): the files on one person’s HR file and their matter — every evidence file staged or linked, every file from before records, every document on the matter’s Evidence tab — with which have no index row yet (files_due) and which are held, under a plan_hash over the person’s whole file list; apply runs the records pass over them.",
    inputSchema: { type: 'object', properties: { plan: { type: 'object', description: '{ scope: live | paid | job | person, job_id? (with scope job), person_id? (a people.id, with scope person), limit? (jobs, at most 500), retry?, after_job? (a job id: the list starts after it) }' } }, required: ['plan'] },
  },
  {
    name: 'apply_index_backfill',
    description: "Run the backfill you planned, one job’s next files per call: the same plan plus the plan_hash from plan_index_backfill, after_job (the next_after of the last answer; leave it out to start at the first job) and batch (files this call takes, 25, at most 40). With scope person (v2.6721): the person’s next files due (no row, or held with retry) through the records pass — the staged copy from its bucket, a linked file from Drive — batch 10 (at most 25) a call, answering due, indexed, held, remaining and done; call again with the same plan while remaining is above 0, no cursor needed; a file filed or removed on the person since the plan refuses the apply. Lists the job’s Drive folders, indexes the files not in the table or changed since (one at a time inside the request’s budget: walked up to the job, the text read, the row written to file_index as the service role; never a write to Drive) and answers indexed, held with the reason, remaining, job_done and next_after. Call again with the same after_job while remaining is above 0, then with next_after; sleep a few seconds between calls. Every answer is already written, so a stopped loop loses nothing. The plan’s hash is checked on every call: a job added to the scope since refuses it, so plan again. A job whose folder Drive refuses is passed over with its reason (job_passed) and next_after moves on, so one bad folder never strands the loop. An after_job the plan does not hold is refused: plan again with that job as the plan’s own after_job.",
    inputSchema: { type: 'object', properties: { plan: { type: 'object' }, plan_hash: { type: 'string' }, after_job: { type: 'string', description: 'The job id the last answer named as next_after' }, batch: { type: 'number' } }, required: ['plan', 'plan_hash'] },
  },
  {
    name: 'mint_twin_setup_code',
    description: "Mint a ten-minute, single-use setup code for a twin (v2.6187) — the code Settings → Digital twins → Set up on this Mac makes — so the Mac your agent runs on can hold a twin key and run /bid itself. The key never comes back through this door: the reply is the code and the command that redeems it (python3 scripts/twin/redeem_setup_code.py <code>), which mints the key server-side, writes it to ~/pt-twin-digest/twin.token (mode 600), saves the kickoff beside it and prints nothing secret. Devs only (a dev may set up any twin); ten codes per ten minutes; twin_setup_codes keeps who minted it and the Mac that redeemed it, and the key is revoked by its label at Settings → Digital twins.",
    inputSchema: { type: 'object', properties: { label: { type: 'string', description: "The key's label as the fleet lists it, e.g. \"Todd's agent on todd-mbp\" — the name it is revoked by" }, twin: { type: 'string', description: "The twin's users.id or email (twin-estimator-N@twins.pipetooling.local); the first estimator twin when left out" }, rounds: { type: 'boolean', description: 'true: the redeemer gets the rounds kickoff (a Mac that stays on and makes a round every five minutes)' } }, required: ['label'] },
  },
  {
    name: 'view_as',
    description: "Run one read verb as someone else, to see what THEY see: `role` reads as that role's sample account (e.g. 'helpers', 'estimator', 'subcontractor'), `user` as a named person (id). The app's Imitate rule applies — a dev account is never a target. Both identities are logged. `verb` is any read verb of this server except view_as.",
    inputSchema: {
      type: 'object',
      properties: {
        role: { type: 'string', description: "A role with a sample account, e.g. 'helpers'" },
        user: { type: 'string', description: 'A user id (find_person)' },
        verb: { type: 'string', description: 'whoami, read_rows, call_read, find_*, get_job, get_customer, get_bid, get_submittals, get_history, read_on_site (the check_* verbs are dev-gated in the database: as anyone else they are refused; the plan_/apply_/revert_ verbs are never run as anyone else)' },
        args: { type: 'object', description: "The inner verb's arguments" },
      },
      required: ['verb'],
    },
  },
]

const INSTRUCTIONS =
  "PipeTooling dev seat — read-only, and you read AS THE DEV whose key this is: RLS and every role check apply as in the app. Call whoami first. Find names with find_rpc / find_table / get_table (a generated catalog — never guess), then call_read (any RPC, over GET: the database itself refuses writes) or read_rows (any table or view, at most 200 rows). For the common questions use the named verbs — find_job / find_bid / find_customer / find_person, then get_job / get_customer / get_bid, whose money comes from the screens' own kernels; get_person_file reads a person's HR file whole — the Timeline's lines in their lanes by month, the fact chips, the evidence records and the summary and narrative — as People → HR draws it (the HR sources are dev-only). view_as runs any of these as a role's sample account or a named person. When the app looks down, check_sampler / check_connections / check_locks say which kind of freeze it is (docs/DB_FREEZE_RUNBOOK.md — before anyone restarts), check_migration_ledger lists what is applied, check_edge_boot finds a function that cannot start. search_mail runs one Gmail search across the company's own mailboxes under the service account's delegation, as each login, read-only by scope, and read_mail reads one hit whole; every search is logged with its query and its accounts, never a mail's words, and neither verb can label, trash or delete a mail. read_mail_file hands one file off a hit back as base64, a piece at a time past 54,000 bytes (offset, then each reply's next_offset), read_mail_file_text hands back its words instead — a PDF's text layer, a text file or an .eml, 60,000 characters a reply, a scan refused in words — the cheap way to read a supplier's PDF, and plan_mail_file → apply_mail_file files one straight where it belongs — a job's Drive folder as the Documents tab's Add a file does, a person's HR file as evidence, or a matter's Evidence tab — under the same plan then apply rule, the bytes read on the server and never passing through you. plan_mail_tag → apply_mail_tag tags a whole conversation out of any login's box onto a job's Activity and notes, as that person, through the My email press's own planner, every mail at its own time and later mail following by itself — the plan shows what each mail would become before anything lands. Since 0.42.0 (punch list #289) tag.person: { person_id } lands the conversation on a person's HR file instead, one dated entry per mail with its Gmail id, written as you, later mail following as entries, and stop: true lifts that follow. Secret columns (tokens, hashes, passwords) come back redacted. Writes are ninety-seven verbs and nothing else: plan_cost_batch → apply_cost_batch (→ revert_cost_batch), plan_hr_entry → apply_hr_entry, plan_account → apply_account (a teammate's app account made as the Hire form makes it — the users row, the roster row, the pay row, the invite or a set password — or an account renamed, its role or sign-in address changed, through add_worker, invite-user, create-user and change-user-email as you), plan_login → apply_login (a login attached to a users row with none, on the row's own id, and the sign-in email sent, or a password set, or the login removed — the desk's Attach a login… and Remove the login…), plan_password_reset → apply_password_reset (the app's own Forgot password email, one per address per ten minutes, or a password you dictate; never your own account), with get_login_state reading where getting someone online stands — the row, the login, when the email went, whether they have signed in — and the next press (a password is never printed back or logged), plan_person_doc → apply_person_doc (a person's HR summary or narrative, or a named document on the file by doc_id or a new title, the whole text, a section at a time against its own headings, or since 0.69.0 a line set under a heading or one run of text swapped inside a section, or copied from a .md, .txt or Google Doc in Drive by drive_file_id with the bytes read on the server, refused when the document was saved since the plan), plan_license → apply_license (a teammate's license added, or its level, number, expiry or note changed, the words written the logbook's way; check_license reads TDLR's record of an electrical or HVAC number first, and never writes), plan_person_evidence → apply_person_evidence (a piece of evidence on a person's HR file — the day it is about, a title, a memo and its files as content_base64, or as a Drive link for one already there — staged in hr-files and filed into the People Shared Drive), plan_person_report → apply_person_report (a waiting field report filed onto a person's HR file as the entry it becomes, or dismissed with a reason, through the queue's own RPCs), plan_matter_open_person → apply_matter_open_person (a matter opened on a person's HR file — the analysis for counsel standing on the person instead of a payer, one a person, devs only — through the file's own RPC; a person who already has one is named with its stage instead), plan_matter_narrative → apply_matter_narrative, plan_matter_plan_item → apply_matter_plan_item, plan_matter_event → apply_matter_event (something that already happened on a matter — the day, what, notes and the Evidence documents that prove it — never ahead of today), plan_matter_statement → apply_matter_statement (a sworn statement or an unsworn declaration drafted onto a matter's Timeline for the office to print, sign and file), plan_matter_document → apply_matter_document (a PDF, image, .eml or text file onto a matter's Evidence tab, sent as content_base64), plan_gap_answer → apply_gap_answer (one line the attorney reads instead of a packet gap on the Legal desk), plan_theme_marks → apply_theme_marks (themes on the record: a theme from the catalog on an HR entry, a piece of evidence, a matter document or a matter event, with why it fits and how it proves the theme, up to 100 a call, kept or proposed; read_rows on legal_themes for the catalog, get_person_file for the entries and records), plan_theme_review → apply_theme_review (the review of marks already there: keep the proposed marks named and take the named marks off with a reason each, up to 200 a call; a kept mark carries your name, and a mark that came off is made again, never reworded), plan_history_entry → apply_history_entry (a History line on a development, kept at the time it happened, as a named robot; get_history reads a site's history whole), plan_job → apply_job (a new job as the New Job form makes it: one jobs_ledger row as you under the form's own RLS, the customer's email and phone filled in, the kind after; since 0.49.0, punch list #293), plan_job_update → apply_job_update (a job changed as Edit Job and the Pipeline change it: the form's columns as one write under RLS, each shown before → after, and the status through update_job_status one step at a time; since 0.53.0), plan_bill → apply_bill (a bill as Bill Customer and the share row make and hand it over: the primary Ready to Bill row, create-stripe-invoice as you with an explicit stripe_mode, the ten-letter code, the job to Billed, then the Billed line texted through quo-send and the draft emailed through messages-email, each step's outcome named; action send hands over a bill that already exists; since 0.55.0), plan_collections_flag → apply_collections_flag (a Billed job into Collections with a note, or back, through the Job window's own set_job_collections_flag; since 0.56.0) and plan_contract_ended → apply_contract_ended (the end of our contract on a job as the Lien contract row records it: the day, how it ended, the retainage held and the payment bond, or cleared; since 0.56.0), plan_property_record → apply_property_record (a property record's lien facts as the Property record row saves them: the county, the legal description, the kind, the homestead answer, the owner of record and where the owner's mail goes, named by a job or by the record, with every job that follows the change named in the plan; since 0.73.0), plan_job_payment → apply_job_payment (a payment on a job: a row removed through the Job window's own remove RPC with your reason left on the job's activity, one recorded as the payments table writes it, or one tied to its bank row as Accounts Receivable links it; the plan says what stands behind the row and what the paid figure and status read after; since 0.65.0) and plan_job_combine → apply_job_combine (one job combined into another as Pipeline's Combine does it, the source's total added to the target's and its numbers kept as prior numbers; the plan lists what moves and every reason it would stop, bills and payments never move, there is no undo and apply needs confirm_no_undo: true; take a duplicate payment off first, then combine; since 0.65.0), plan_sub_labor → apply_sub_labor (a sub labor sheet on a job, made, changed, moved to another job or removed as Jobs → Subs → Pay's New Sub Labor and Edit window write it: one subcontractor or primary, the day or the span, lines as flat amounts or hours at a rate, a note, and stated: { source } when the days come from an outside record and not a punch, the mark riding in each line's words; the plan shows the sheet, their other sheets on the job, the job's sub labor and profit before and after, and the job's allocated bank rows that may be the same pay; since 0.71.0) and plan_sub_labor_payment → apply_sub_labor_payment (what was paid against a sheet, as Make Payment writes it, or a payment removed with its trace; name the bank row that paid it and the plan says whether it is already allocated to a job as cost, where the dollars would count twice — it never moves the allocation, plan_cost_batch does; since 0.71.0), plan_submittal_rows → apply_submittal_rows (submittal rows onto a bid's draft revision, one or many, added or changed by tag, as Bids → Submittals writes them; Rev 1 is made when the bid has none) and plan_submittal_log → apply_submittal_log (the order log's facts on a line: ordered, PO, expected, delivered, a note for the GC) — get_submittals reads where every row and line stands first, with the status in plain words to read back; nothing in the three shares with the GC or tells anyone (since 0.51.0), plan_activity_note → apply_activity_note (one line of your words on a job's Job activity / notes or on a bid's Notes, as the Note press and the Bid Board write them — where the team reads what moved; it tells nobody; since 0.54.0), plan_bid → apply_bid (a new bid as the New Bid form makes it, numbered by the database), plan_bid_update → apply_bid_update (a bid changed as Edit Bid and the Bid Board change it: its value, the sent date and who it went to, the outcome with the day it was decided and why it was lost, the due date, the estimator, the GC, the development, the links, the notes; the plan shows each column before and after and what the database does next — a win opens no job, a first sent date fills the labor rows from the book; a bid with versions keeps Sent and Won / Lost per GC; plan_bid_counts → apply_bid_counts writes its count rows as the Count Sheet does, one row a fixture in the base bid or in an alternate, added, changed or removed, a faulty row held and the rest going on; plan_bid_takeoff → apply_bid_takeoff writes the part lines on a count row and the quoted materials cost each, as the Takeoffs tab holds them, a line's quantity for one counted unit, the plan stating the bid's materials before and after; plan_bid_labor → apply_bid_labor writes the Labor tab's estimate boxes, the hours on the counted fixtures' labor rows (typed, never teaching the labor book) and the direct cost lines, the plan stating the tab's direct cost of the bid before and after; plan_bid_pricing → apply_bid_pricing sets a count row's price as the Pricing tab does on the pricing it opens on, a shared book copied to the bid first, a sent bid only with revise: true, the plan stating the grid's revenue total before and after, since 0.78.0; the labor since 0.75.0; the takeoff since 0.74.0; the counts since 0.72.0; the update since 0.70.0), plan_file_plans → apply_file_plans (a plan set into the PipeTooling Jobs Shared Drive and onto the bid as the set the robot reads, from a one-shot upload URL the plan hands back; Drive is where it stays, and the set lands on the plan part of the bid's job too when the job has one), plan_plan_set → apply_plan_set (a set of drawings on the plan part a job builds from, as the job window's Plans section adds it, as you under the same RLS) and plan_paper → apply_paper (a paper — a spec, a submittal, a schedule, a task list — beside the set it goes with, with the question it asks of us and its owed state; action came marks an owed one landed), and Materials on site's four — plan_container → apply_container (a cage or box on a job: add, move, retire an empty one, bring one back), plan_delivery → apply_delivery (an invoice's or a PO's lines into Unsorted or a box), plan_movement → apply_movement (one press on a line: moved, used, returned, taken, cannot_find, damaged) and plan_count → apply_count (a box walked) — each as the phone and the office write it, every row stamped as your agent's; read_on_site first, since a box is named by its stencil; plan_materials_move → apply_materials_move (everything a job holds on site moved to another job, for a count recorded under the wrong job: places, cages and boxes, the ledger, box moves and photos, every box keeping its id and printed code, a same-name place becoming one, Unsorted folding, a stencil the target already holds renumbered; the plan counts both jobs before and after and says where the photos' files stay); plan_hours_statement → apply_hours_statement (a signed hours statement — one worker's recorded hours on one job for a period, the paper they sign for a case over an unpaid bill — made as the Hours statement window makes it from the same reads and kernel get_hours_statement answers with, you named as the preparer; send: { how: email | link } then draws the form and mints the signing link, which is handed back to you and never written to the call log; action file_on_matter copies a signed one's PDF onto a legal matter's Evidence tab as the Legal desk's Add to evidence does) — plan first, read the plan, then apply quoting its plan_hash; apply re-runs the dry run and writes only when it still matches. One more verb writes outside that grammar: mint_twin_setup_code, which asks twin-setup for a ten-minute, single-use setup code for a twin as you (the code Set up on this Mac makes), so the Mac your agent runs on can redeem it into a twin key with scripts/twin/redeem_setup_code.py — the key never comes back through this door. The file index (punch list #240) has its own three: read_file_index_status, then plan_index_backfill → apply_index_backfill, which runs the index pass over one job's next files per call into our own file_index table (never into Drive) and may run as often as files remain. plan_clock_sessions → apply_clock_sessions (v2.6437) adjusts clock sessions as the office does: the start and the end, the description, the job, and the approval, op by op in one call, each op reported applied, held or refused with its reason; the typed-hours second look and the approval guard hold as in the app, so your own session and the hours you typed wait for someone else. No other verb writes, and view_as never does. This is PRODUCTION data about real customers and employees: read what the task needs, quote it sparingly, and write only what the person asked for."

type Admin = SupabaseClient
type ResolvedDev = { credentialId: string; userId: string; email: string; name: string | null }
type Identity = { userId: string; email: string; name: string | null; role: string }

function env(name: string): string {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`${name} not configured`)
  return v
}

async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function presentedToken(req: Request): string | null {
  const header = req.headers.get('X-Dev-Token')?.trim()
  if (header) return header
  const auth = req.headers.get('Authorization')?.trim() ?? ''
  const m = auth.match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : null
}

async function resolveDev(admin: Admin, req: Request): Promise<ResolvedDev | { error: string }> {
  const token = presentedToken(req)
  if (!token) return { error: 'Missing X-Dev-Token (or Authorization: Bearer) — this server needs your dev key (Settings → Your account → Dev MCP keys).' }
  const { data: cred, error } = await admin.from('dev_mcp_credentials').select('id, user_id, revoked_at').eq('token_hash', await sha256Hex(token)).maybeSingle()
  if (error) return { error: `Key lookup failed: ${error.message}` }
  const row = cred as { id: string; user_id: string; revoked_at: string | null } | null
  if (!row || row.revoked_at) return { error: 'Unknown or revoked dev key.' }
  // Re-checked on every call: a demoted or archived dev's keys stop working on their own.
  const { data: user } = await admin.from('users').select('id, email, name, role, archived_at, is_digital_twin').eq('id', row.user_id).maybeSingle()
  const u = user as { id: string; email: string; name: string | null; role: string; archived_at: string | null; is_digital_twin: boolean | null } | null
  if (!u || u.role !== 'dev' || u.archived_at || u.is_digital_twin) return { error: 'This key belongs to an account that is not an active dev.' }
  admin.from('dev_mcp_credentials').update({ last_used_at: new Date().toISOString() }).eq('id', row.id).then(() => undefined, () => undefined)
  return { credentialId: row.id, userId: u.id, email: u.email, name: u.name }
}

// One session per person per warm instance; minted again a minute before it expires.
const sessions = new Map<string, { jwt: string; expiresAtMs: number }>()

async function sessionFor(admin: Admin, dev: { userId: string; email: string }): Promise<string> {
  const cached = sessions.get(dev.userId)
  if (cached && cached.expiresAtMs - Date.now() > 60_000) return cached.jwt
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email: dev.email })
  const tokenHash = link?.properties?.hashed_token
  if (linkErr || !tokenHash) throw new Error(`could not mint your session: ${linkErr?.message ?? 'no token returned'}`)
  const anon = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: verified, error: verifyErr } = await anon.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash })
  const session = verified?.session
  if (verifyErr || !session?.access_token) throw new Error(`could not verify your session: ${verifyErr?.message ?? 'no session returned'}`)
  sessions.set(dev.userId, { jwt: session.access_token, expiresAtMs: (session.expires_at ?? 0) * 1000 })
  return session.access_token
}

/** The only way this server reads business data: a GET against the app's own API, as the dev. */
async function restGet(jwt: string, path: string, query: string): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/${path}${query ? `?${query}` : ''}`, {
    method: 'GET',
    headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: `Bearer ${jwt}`, 'X-Dev-Seat': 'dev-mcp', Accept: 'application/json' },
  })
  const text = await res.text()
  let body: unknown = text
  try {
    body = text ? JSON.parse(text) : null
  } catch { /* a non-JSON reply is reported as text */ }
  return { ok: res.ok, status: res.status, body }
}

/** How many rows a filter matches, as the dev under RLS (v2.6940): the same GET, one row asked for and PostgREST's exact count read off Content-Range. */
async function restCount(jwt: string, table: string, query: string): Promise<number> {
  const column = query.split('=')[0] ?? 'id'
  const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/${table}?select=${column}&${query}&limit=1`, {
    method: 'GET',
    headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: `Bearer ${jwt}`, 'X-Dev-Seat': 'dev-mcp', Accept: 'application/json', Prefer: 'count=exact' },
  })
  const text = await res.text()
  if (!res.ok) {
    let body: unknown = text
    try {
      body = text ? JSON.parse(text) : null
    } catch { /* a non-JSON reply is reported as text */ }
    throw new Error(restError(res.status, body))
  }
  const total = /\/(\d+)$/.exec(res.headers.get('content-range') ?? '')
  if (!total) throw new Error(`${table} answered with no count`)
  return Number(total[1])
}

/**
 * The write path (v2.3722): a POST to one RPC named in WRITE_VERBS, as the dev — never called
 * with any other path. Each of those RPCs is a dev-gated SECURITY DEFINER function, so the
 * database also refuses anyone who is not a dev, and training mode blocks the write inside.
 */
async function restPost(jwt: string, path: string, body: Record<string, unknown>): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, {
    method: 'POST',
    headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: `Bearer ${jwt}`, 'X-Dev-Seat': 'dev-mcp', Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let parsed: unknown = text
  try {
    parsed = text ? JSON.parse(text) : null
  } catch { /* a non-JSON reply is reported as text */ }
  return { ok: res.ok, status: res.status, body: parsed }
}

/**
 * The plan-part verbs' table writes (v2.6317): a POST that returns the row, or a PATCH by query — plan_sets,
 * plan_parts, a lane's requests table — as the dev, the rows the job window's Plans section writes under the same
 * RLS. Reached only from that branch, apply_file_plans' part leg, apply_job (v2.6790) and the submittal branch
 * (v2.6804, which sends the new rows as one array); every other write is restPost to a named RPC.
 */
async function restRows(jwt: string, method: 'POST' | 'PATCH' | 'DELETE', table: string, query: string, body: Record<string, unknown> | Record<string, unknown>[] | null, prefer?: string, extra?: Record<string, string>): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/${table}${query ? `?${query}` : ''}`, {
    method,
    headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: `Bearer ${jwt}`, 'X-Dev-Seat': 'dev-mcp', Accept: 'application/json', 'Content-Type': 'application/json', Prefer: prefer ?? (method === 'POST' ? 'return=representation' : 'return=minimal'), ...(extra ?? {}) },
    ...(body === null ? {} : { body: JSON.stringify(body) }),
  })
  const text = await res.text()
  let parsed: unknown = text
  try {
    parsed = text ? JSON.parse(text) : null
  } catch { /* a non-JSON reply is reported as text */ }
  return { ok: res.ok, status: res.status, body: parsed }
}

/**
 * The sub labor verbs' deletes (v2.6944): a DELETE by query, as the dev under RLS, that says how many rows went — the
 * Edit window's Delete of a sheet, the old lines a change replaces, and a new sheet whose lines were refused.
 * Reached only from that branch, with a filter always: a DELETE with no filter is never sent.
 */
async function restDelete(jwt: string, table: string, query: string): Promise<{ ok: boolean; status: number; body: unknown; rows: number }> {
  if (!/(^|&)(id|job_id)=(eq|in)\./.test(query)) return { ok: false, status: 0, body: { message: 'a delete names its rows' }, rows: 0 }
  const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/${table}?${query}`, {
    method: 'DELETE',
    headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: `Bearer ${jwt}`, 'X-Dev-Seat': 'dev-mcp', Accept: 'application/json', Prefer: 'return=representation' },
  })
  const text = await res.text()
  let parsed: unknown = text
  try {
    parsed = text ? JSON.parse(text) : null
  } catch { /* a non-JSON reply is reported as text */ }
  return { ok: res.ok, status: res.status, body: parsed, rows: Array.isArray(parsed) ? parsed.length : 0 }
}

/** A document verb's file (v2.6004): decoded, checked against the Evidence tab's rules, digested. `args` is the input with content_base64 replaced by mime, size_bytes and sha256. */
type DocumentFile = { args: Record<string, unknown>; bytes: Uint8Array; mime: string; name: string; sha256: string }

async function documentBytes(args: Record<string, unknown>): Promise<DocumentFile | { error: string }> {
  const d = args.document && typeof args.document === 'object' && !Array.isArray(args.document) ? (args.document as Record<string, unknown>) : null
  if (!d) return { error: 'plan_matter_document needs document — { matter_id, title, shows, original_name, content_base64 | markdown, dated_on?, state?, received_on?, sent_on?, sent_how?, sent_to? }.' }
  // v2.6716 (punch list #288): a text document travels as markdown — the server makes the .md file, and the words ride on to the RPC,
  // which keeps them in documents. A .md or .txt sent as content_base64 is decoded to markdown too, so the mail door's text files are kept as text.
  const markdownIn = typeof d.markdown === 'string' ? d.markdown : null
  const title = typeof d.title === 'string' ? d.title.trim() : ''
  const name = typeof d.original_name === 'string' && d.original_name.trim() ? d.original_name.trim() : markdownIn !== null && title ? `${title.replace(/[^A-Za-z0-9._ -]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 100) || 'document'}.md` : ''
  const b64 = typeof d.content_base64 === 'string' ? d.content_base64.replace(/\s+/g, '') : ''
  if (!name) return { error: 'document.original_name is required: the file name, with its extension.' }
  if (!b64 && markdownIn === null) return { error: 'document.content_base64 is required: the file, base64-encoded — or markdown, a text document\'s words.' }
  if (b64 && markdownIn !== null) return { error: 'Send content_base64 (a file) or markdown (a text document), not both.' }
  let bytes: Uint8Array
  if (markdownIn !== null) {
    if (markdownIn.trim() === '') return { error: 'document.markdown is empty: a text document needs words.' }
    bytes = new TextEncoder().encode(markdownIn)
  } else {
    try {
      bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    } catch {
      return { error: 'document.content_base64 is not valid base64.' }
    }
  }
  if (bytes.length < 1 || bytes.length > LEGAL_DOCUMENT_MAX_BYTES) return { error: `The file must be between 1 byte and ${LEGAL_DOCUMENT_MAX_BYTES / 1024 / 1024} MB; this one is ${bytes.length} bytes.` }
  const mime = legalDocumentMime({ type: typeof d.mime === 'string' ? d.mime : '', name })
  if (!mime) return { error: `${name} is not a kind the Evidence tab takes: PDF, an image (jpg, png, webp, heic), an email as .eml, plain text or markdown.` }
  if (markdownIn !== null && !legalDocumentIsText(mime)) return { error: `markdown goes with a text file (.md or .txt); ${name} is ${mime}.` }
  let markdown = markdownIn
  if (markdown === null && legalDocumentIsText(mime)) {
    try {
      markdown = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      markdown = null // not UTF-8 text: the file is kept as bytes alone
    }
    if (markdown !== null && markdown.trim() === '') markdown = null
  }
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const sha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  const { content_base64: _content, markdown: _markdown, ...rest } = d
  return { args: { ...args, document: { ...rest, original_name: name, mime, size_bytes: bytes.length, sha256, ...(markdown !== null ? { markdown } : {}) } }, bytes, mime, name, sha256 }
}

/** A file into a private bucket as the dev (the bucket's own storage policy applies): legal-matter-documents for a matter's document, hr-files for a person's evidence (v2.6426). */
async function storagePut(jwt: string, bucket: string, path: string, bytes: Uint8Array, mime: string): Promise<string | null> {
  const res = await fetch(`${env('SUPABASE_URL')}/storage/v1/object/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'POST',
    headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: `Bearer ${jwt}`, 'X-Dev-Seat': 'dev-mcp', 'Content-Type': mime, 'x-upsert': 'false' },
    body: bytes,
  })
  if (res.ok) return null
  return `Could not store the file: ${res.status} ${(await res.text()).slice(0, 300)}`
}

async function storageRemove(jwt: string, bucket: string, path: string): Promise<void> {
  try {
    await fetch(`${env('SUPABASE_URL')}/storage/v1/object/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'DELETE',
      headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: `Bearer ${jwt}`, 'X-Dev-Seat': 'dev-mcp' },
    })
  } catch { /* the row failed; a leftover object is reported by the error already returned */ }
}

/** A function called as the dev (v2.6414): the signing functions a hours statement's send leg runs, with the dev's own session. */
async function invokeAsDev(jwt: string, fn: string, body: Record<string, unknown>): Promise<{ ok: boolean; status: number; body: unknown }> {
  try {
    const res = await fetch(`${env('SUPABASE_URL')}/functions/v1/${fn}`, { method: 'POST', headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: `Bearer ${jwt}`, 'X-Dev-Seat': 'dev-mcp', 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const text = await res.text()
    let parsed: unknown = text
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = { error: text.slice(0, 300) }
    }
    return { ok: res.ok, status: res.status, body: parsed }
  } catch (e) {
    return { ok: false, status: 0, body: { error: `${fn} could not be reached: ${e instanceof Error ? e.message : String(e)}` } }
  }
}

/** The private bucket the person file's evidence is staged in (docs/HR_FILES.md); its policies take a dev. */
const HR_FILES_BUCKET = 'hr-files'

/** An evidence verb's files (v2.6426): each decoded, checked against the panel's caps, digested. `args` is the input with every content_base64 replaced by mime, size_bytes and sha256. */
/** A file to stage (bytes), or a linked one (v2.6541: already in Drive, sent as its address alone) in the plan's order. */
type EvidenceFiles = { args: Record<string, unknown>; files: Array<{ bytes: Uint8Array; mime: string; name: string; sha256: string } | { name: string; driveUrl: string }> }

async function evidenceBytes(args: Record<string, unknown>): Promise<EvidenceFiles | { error: string }> {
  const ev = args.evidence && typeof args.evidence === 'object' && !Array.isArray(args.evidence) ? (args.evidence as Record<string, unknown>) : null
  if (!ev) return { error: 'plan_person_evidence needs evidence — { person_id, dated_on, title, memo, entry_id?, files: [{ name, content_base64, mime? } | { name, drive_url }] }.' }
  const raw = Array.isArray(ev.files) ? ev.files : []
  if (raw.length < 1) return { error: 'evidence.files needs at least one file — a photo, a PDF, an email as .eml, a screenshot — each { name, content_base64, mime? }, or one already in Drive as { name, drive_url }.' }
  if (raw.length > EVIDENCE_MAX_FILES) return { error: `evidence.files holds ${raw.length} files; a record takes at most ${EVIDENCE_MAX_FILES} — plan a second record for the rest.` }
  const files: EvidenceFiles['files'] = []
  const facts: Record<string, unknown>[] = []
  for (const r of raw) {
    const f = r && typeof r === 'object' && !Array.isArray(r) ? (r as Record<string, unknown>) : null
    const name = f && typeof f.name === 'string' ? f.name.trim() : ''
    const driveUrl = f && typeof f.drive_url === 'string' ? f.drive_url.trim() : ''
    const b64 = f && typeof f.content_base64 === 'string' ? f.content_base64.replace(/\s+/g, '') : ''
    if (!name) return { error: 'Every file in evidence.files needs a name, with its extension.' }
    if (driveUrl) {
      // A linked file: no bytes travel; the RPC holds the address to a Drive one and the row carries it alone.
      const why = evidenceLinkProblem({ name, driveUrl })
      if (why) return { error: why }
      files.push({ name, driveUrl })
      facts.push({ name, drive_url: driveUrl })
      continue
    }
    if (!b64) return { error: `${name}: content_base64 is required — the file, base64-encoded — or drive_url for a file already in Drive.` }
    let bytes: Uint8Array
    try {
      bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    } catch {
      return { error: `${name}: content_base64 is not valid base64.` }
    }
    if (bytes.length < 1 || bytes.length > EVIDENCE_FILE_MAX_BYTES) return { error: `${name} must be between 1 byte and ${EVIDENCE_FILE_MAX_BYTES / 1024 / 1024} MB; it is ${bytes.length} bytes. Put a larger file in the person's Drive folder by hand and send it as { name, drive_url }.` }
    const mime = evidenceMime({ type: typeof f.mime === 'string' ? f.mime : '', name })
    const sha256 = await sha256HexOf(bytes)
    files.push({ bytes, mime, name, sha256 })
    facts.push({ name, mime, size_bytes: bytes.length, sha256 })
  }
  return { args: { ...args, evidence: { ...ev, files: facts } }, files }
}

/** Drive for one evidence record, as the panel asks it after the rows (personEvidenceIo.ts): fail-soft, the record stands either way. */
/**
 * #285 (v2.6714): the files a write just put on a person's file or a matter, into file_index through the records pass
 * (`_shared/fileIndexRecords.ts`) as the service role — the staged copies from their bucket, a linked file from Drive —
 * so search_case finds their words at once. Fail-soft: the sweep's records step takes what this missed within ten minutes.
 */
async function indexRecordsAfterWrite(scope: { personId?: string; matterId?: string }): Promise<Record<string, unknown>> {
  try {
    const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { autoRefreshToken: false, persistSession: false } })
    const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON') ?? null
    const pass = await recordsPass(admin, { n: 20, personId: scope.personId ?? null, matterId: scope.matterId ?? null, dropGone: false, google: async () => (saJson ? await googleAccessToken(saJson) : null) })
    return { indexed: pass.indexed, held: pass.held, remaining: pass.remaining }
  } catch (e) {
    return { indexed: 0, held: [], remaining: 0, why: `the index pass failed (${e instanceof Error ? e.message : String(e)}); the sweep takes the files within ten minutes` }
  }
}

async function fileEvidenceToDrive(jwt: string, evidenceId: string): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(`${env('SUPABASE_URL')}/functions/v1/hr-evidence-drive`, {
      method: 'POST',
      headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: `Bearer ${jwt}`, 'X-Dev-Seat': 'dev-mcp', 'Content-Type': 'application/json' },
      body: JSON.stringify({ evidence_id: evidenceId }),
      signal: AbortSignal.timeout(60_000),
    })
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) return { asked: true, ok: false, why: `hr-evidence-drive answered ${res.status}: ${typeof body.error === 'string' ? body.error : JSON.stringify(body).slice(0, 200)}` }
    const failWhy = typeof body.fail_why === 'string' && body.fail_why ? body.fail_why : null
    return { asked: true, ok: !failWhy, filed: body.filed ?? 0, remaining: body.remaining ?? null, fail_why: failWhy, folder_url: body.folder_url ?? null }
  } catch (e) {
    return { asked: true, ok: false, why: `hr-evidence-drive could not be reached: ${e instanceof Error ? e.message : String(e)}` }
  }
}

function evidenceDriveNext(drive: Record<string, unknown>): string {
  if (drive.ok === true) return 'In Drive: folder_url opens the record\'s folder, and get_person_file shows the record with its state.'
  const why = typeof drive.fail_why === 'string' ? drive.fail_why : typeof drive.why === 'string' ? drive.why : 'no reason given'
  return `Kept, not in Drive yet: ${why}. The record and its files stand in the app; the sweep asks Drive again every ten minutes while a file waits, and Try Drive again on the Evidence tab asks now.`
}

/** A document's bytes never reach the log (v2.6004), nor an evidence file's (v2.6426): the base64 is replaced by its length. */
function argsForLog(name: string, args: Record<string, unknown>): Record<string, unknown> {
  // v2.6792: a password an account verb carries never reaches the log; its key reads "(set, not logged)".
  if (isAccountVerb(name)) return argsWithoutPasswords(args)
  if (name === 'plan_person_evidence' || name === 'apply_person_evidence') {
    const ev = args.evidence && typeof args.evidence === 'object' && !Array.isArray(args.evidence) ? (args.evidence as Record<string, unknown>) : null
    if (!ev || !Array.isArray(ev.files)) return args
    const files = ev.files.map((f) => (f && typeof f === 'object' && typeof (f as { content_base64?: unknown }).content_base64 === 'string' ? { ...(f as Record<string, unknown>), content_base64: `(${((f as { content_base64: string }).content_base64).length} characters, not logged)` } : f))
    return { ...args, evidence: { ...ev, files } }
  }
  if (name !== 'plan_matter_document' && name !== 'apply_matter_document') return args
  const d = args.document && typeof args.document === 'object' && !Array.isArray(args.document) ? (args.document as Record<string, unknown>) : null
  if (!d || (typeof d.content_base64 !== 'string' && typeof d.markdown !== 'string')) return args
  // v2.6716: a text document's words stay out of the log as the bytes do.
  return { ...args, document: { ...d, ...(typeof d.content_base64 === 'string' ? { content_base64: `(${d.content_base64.length} characters, not logged)` } : {}), ...(typeof d.markdown === 'string' ? { markdown: `(${d.markdown.length} characters, not logged)` } : {}) } }
}

type CallLog = { verb: string; target?: string | null; args: Record<string, unknown>; status: 'ok' | 'error' | 'refused'; rowCount?: number | null; error?: string | null; asUserId?: string | null }

async function logCall(admin: Admin, dev: ResolvedDev, startedMs: number, log: CallLog): Promise<void> {
  try {
    await admin.from('dev_mcp_calls').insert({
      credential_id: dev.credentialId,
      user_id: dev.userId,
      as_user_id: log.asUserId ?? null,
      verb: log.verb,
      target: log.target ?? null,
      args: loggableArgs(log.args),
      status: log.status,
      row_count: log.rowCount ?? null,
      duration_ms: Date.now() - startedMs,
      error: log.error ? log.error.slice(0, 1000) : null,
    })
  } catch { /* the log never fails a read */ }
}

/** Args as logged: whole when small, else a marked preview — the log is for tracing, not replay. */
function loggableArgs(args: Record<string, unknown>): Record<string, unknown> {
  const text = JSON.stringify(args ?? {})
  return text.length <= 4000 ? (args ?? {}) : { truncated: true, preview: text.slice(0, 3900) }
}

function rowCountOf(body: unknown): number | null {
  return Array.isArray(body) ? body.length : body == null ? 0 : 1
}

// v2.6185: the plan set a dev's agent files for the robots. The bytes never ride in a tool call:
// plan_file_plans hands back a one-shot upload URL into the bid's folder of the private
// bid-submittals bucket (as the dev — the bucket's own policy applies), apply_file_plans reads the
// staged copy back, checks it against the plan, copies it into Drive (since v2.6241 the PipeTooling Jobs Shared
// Drive, Bid plans › <Division> › <project>: a service account owns no file in a My Drive) and removes the
// staged copy. Drive is the only place the plans stay (the owner, 2026-09-29).
const ROBOT_PLANS_BUCKET = 'bid-submittals'
const ROBOT_PLANS_MAX_PAGES = 200
const robotPlansStagePath = (bidId: string, sha256: string) => `${bidId}/robot-plans/${sha256.slice(0, 16)}.pdf`
const stagedObjectUrl = (prefix: string, path: string) => `${env('SUPABASE_URL')}/storage/v1/object/${prefix}${ROBOT_PLANS_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`
const stagedHeaders = (jwt: string): Record<string, string> => ({ apikey: env('SUPABASE_ANON_KEY'), Authorization: `Bearer ${jwt}`, 'X-Dev-Seat': 'dev-mcp' })

async function stagedUploadUrl(jwt: string, path: string): Promise<{ url: string } | { error: string }> {
  const res = await fetch(stagedObjectUrl('upload/sign/', path), { method: 'POST', headers: { ...stagedHeaders(jwt), 'x-upsert': 'true' } })
  const body = (await res.json().catch(() => ({}))) as { url?: string }
  if (!res.ok || typeof body.url !== 'string') return { error: `Could not make the upload URL: ${res.status} ${JSON.stringify(body).slice(0, 200)}` }
  return { url: `${env('SUPABASE_URL')}/storage/v1${body.url}` }
}

async function stagedDownload(jwt: string, path: string): Promise<{ bytes: Uint8Array } | { error: string }> {
  const res = await fetch(stagedObjectUrl('authenticated/', path), { headers: stagedHeaders(jwt) })
  if (res.status === 400 || res.status === 404) return { error: 'Nothing is staged for this plan: PUT the file to the upload_url plan_file_plans gave you (the curl line in its reply), then apply. An upload URL lasts two hours; plan again for a fresh one.' }
  if (!res.ok) return { error: `Could not read the staged file: ${res.status} ${(await res.text()).slice(0, 200)}` }
  return { bytes: new Uint8Array(await res.arrayBuffer()) }
}

async function stagedRemove(jwt: string, path: string): Promise<boolean> {
  try {
    const res = await fetch(stagedObjectUrl('', path), { method: 'DELETE', headers: stagedHeaders(jwt) })
    return res.ok
  } catch {
    return false
  }
}

async function sha256HexOf(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** plan-fetch's readiness probe, as the dev: recorded on the bid, and a staff session reads the file's name and size. */
async function probePlans(jwt: string, bidId: string): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(`${env('SUPABASE_URL')}/functions/v1/plan-fetch?bid=${encodeURIComponent(bidId)}&probe=1`, { headers: stagedHeaders(jwt) })
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
    return res.ok ? body : { readable: false, note: `plan-fetch answered ${res.status}: ${JSON.stringify(body).slice(0, 200)}` }
  } catch (e) {
    return { readable: false, note: `plan-fetch could not be reached: ${e instanceof Error ? e.message : String(e)}` }
  }
}

function restError(status: number, body: unknown): string {
  const b = body as { message?: string; code?: string; hint?: string; details?: string } | null
  const msg = b && typeof b === 'object' ? [b.message, b.details, b.hint].filter(Boolean).join(' — ') : String(body)
  const readOnly = b && typeof b === 'object' && (b.code === '25006' || /read-only transaction/i.test(b.message ?? ''))
  return readOnly
    ? `Refused by the database: this RPC writes, and the door is read-only (${msg}).`
    : `The app's API answered ${status}${b && typeof b === 'object' && b.code ? ` (${b.code})` : ''}: ${msg}`
}

type Outcome = { log: Omit<CallLog, 'verb' | 'args'>; text: string; isError?: boolean }
const ok = (payload: unknown, log: Partial<CallLog> = {}): Outcome => ({ log: { status: 'ok', ...log }, text: replyText(payload) })
const refused = (text: string, log: Partial<CallLog> = {}): Outcome => ({ log: { status: 'refused', error: text, ...log }, text, isError: true })

/** A `Reader` that GETs as one person. Every composite read goes through the same two checks the generic door makes. */
function readerAs(jwt: string): Reader {
  return {
    rpc: async (name, args = {}, limit, filters) => {
      if (!isSafeIdent(name) || !CATALOG_RPCS[name]) throw new Error(`no RPC named "${name}" in the catalog`)
      const built = buildRpcQuery(args, limit, filters?.length ? { filters, argNames: rpcArgNames(CATALOG_RPCS[name]) } : undefined)
      if (!built.ok) throw new Error(built.error)
      const res = await restGet(jwt, `rpc/${name}`, built.query)
      if (!res.ok) throw new Error(restError(res.status, res.body))
      return redactSecrets(res.body)
    },
    rows: async (table: string, query: RowsQuery) => {
      const entry = CATALOG_TABLES[table]
      if (!isSafeIdent(table) || !entry || DENIED_TABLES.has(table)) throw new Error(`"${table}" is not a readable table`)
      const built = buildRowsQuery(query, new Set(Object.keys(entry.columns)))
      if (!built.ok) throw new Error(built.error)
      const res = await restGet(jwt, table, built.query)
      if (!res.ok) throw new Error(restError(res.status, res.body))
      return (Array.isArray(res.body) ? redactSecrets(res.body) : []) as Row[]
    },
  }
}

/**
 * check_edge_boot: OPTIONS one batch of edge functions, a few at a time, 5 s each. No key is
 * sent — a function that cannot boot answers 503 BOOT_ERROR before any auth would run. A batch,
 * not the lot: the platform refuses a function's calls to other functions past about 60 a minute.
 */
const EDGE_PROBE_TIMEOUT_MS = 5000
const EDGE_PROBE_CONCURRENCY = 16

async function probeEdgeBoot(name: string): Promise<EdgeBootProbe> {
  try {
    const res = await fetch(`${env('SUPABASE_URL')}/functions/v1/${name}`, { method: 'OPTIONS', signal: AbortSignal.timeout(EDGE_PROBE_TIMEOUT_MS) })
    const body = res.status === 503 ? await res.text() : ''
    if (res.status !== 503) await res.body?.cancel()
    return { name, status: res.status, bootError: isBootError(res.status, body) }
  } catch (e) {
    return { name, status: null, bootError: false, error: e instanceof Error ? e.message : String(e) }
  }
}

async function probeEdgeBoots(names: readonly string[]): Promise<EdgeBootProbe[]> {
  const probes: EdgeBootProbe[] = []
  let next = 0
  const worker = async () => {
    while (next < names.length) probes.push(await probeEdgeBoot(names[next++]))
  }
  await Promise.all(Array.from({ length: EDGE_PROBE_CONCURRENCY }, worker))
  return probes
}

const composite = (out: unknown, target: string): Outcome =>
  out && typeof out === 'object' && 'refused' in (out as object) ? refused(String((out as { refused: string }).refused), { target }) : ok(out, { target })

/** What the server knows that a verb may not read for itself: the call log, for the one-apply-per-plan rule. */
type Hooks = {
  priorApply: (verb: string, hash: string) => Promise<{ target: string | null; at: string | null } | null>
  /** v2.6792: the auth account's stamps by id (service role, timestamps alone) — the account verbs' and get_login_state's read; null where no account stands. */
  authState: (userId: string) => Promise<AuthState | null>
}
const NO_HOOKS: Hooks = { priorApply: () => Promise.resolve(null), authState: () => Promise.resolve(null) }

/**
 * v2.6792: the account named by an account verb — a users.id or a people.id (its account_user_id), an address, or a name that
 * matches one live human account — read as the dev, with its roster row. `null` user with no refusal means "no such account",
 * which a create is allowed to find.
 */
async function readAccount(jwt: string, ref: string): Promise<{ user: AccountUserRow | null; person: AccountPersonRow | null; refused?: string }> {
  const first = <T,>(body: unknown): T | null => (Array.isArray(body) ? ((body[0] as T | undefined) ?? null) : null)
  const kind = personRefKind(ref)
  const key = ref.trim()
  if (kind === 'empty') return { user: null, person: null, refused: 'person is required — a users.id, a people.id, an address or a name.' }
  let userId: string | null = null
  let person: AccountPersonRow | null = null
  if (kind === 'uuid') {
    const byId = await restGet(jwt, 'users', `select=${ACCOUNT_USER_SELECT}&id=eq.${key.toLowerCase()}&limit=1`)
    if (!byId.ok) return { user: null, person: null, refused: restError(byId.status, byId.body) }
    const u = first<AccountUserRow>(byId.body)
    if (u) userId = u.id
    else {
      const p = await restGet(jwt, 'people', `select=${ACCOUNT_PERSON_SELECT}&id=eq.${key.toLowerCase()}&limit=1`)
      if (!p.ok) return { user: null, person: null, refused: restError(p.status, p.body) }
      person = first<AccountPersonRow>(p.body)
      if (!person) return { user: null, person: null }
      if (!person.account_user_id) return { user: null, person, refused: `${person.name} is a roster row with no users row behind it (people ${person.id}); the Users tab's Create account fix links one.` }
      userId = person.account_user_id
    }
  } else if (kind === 'email') {
    const byEmail = await restGet(jwt, 'users', `select=${ACCOUNT_USER_SELECT}&email=ilike.${encodeURIComponent(key.toLowerCase().replace(/[\\%_*]/g, (c) => `\\${c}`))}&limit=2`)
    if (!byEmail.ok) return { user: null, person: null, refused: restError(byEmail.status, byEmail.body) }
    const rows = (Array.isArray(byEmail.body) ? byEmail.body : []) as AccountUserRow[]
    if (rows.length === 0) return { user: null, person: null }
    userId = rows[0]!.id
  } else {
    const byName = await restGet(jwt, 'users', `select=${ACCOUNT_USER_SELECT}&name=ilike.${encodeURIComponent(accountLikeTerm(key))}&archived_at=is.null&is_digital_twin=eq.false&is_sample=eq.false&order=name&limit=25`)
    if (!byName.ok) return { user: null, person: null, refused: restError(byName.status, byName.body) }
    const rows = (Array.isArray(byName.body) ? byName.body : []) as AccountUserRow[]
    // No account wears the name: not a refusal — get_login_state reads it as no_account, and a create may go ahead.
    if (rows.length === 0) return { user: null, person: null }
    const picked = pickByName(rows, key)
    if ('refused' in picked) return { user: null, person: null, refused: picked.refused }
    userId = picked.id
  }
  const u = await restGet(jwt, 'users', `select=${ACCOUNT_USER_SELECT}&id=eq.${userId}&limit=1`)
  if (!u.ok) return { user: null, person: null, refused: restError(u.status, u.body) }
  const user = first<AccountUserRow>(u.body)
  if (!user) return { user: null, person }
  if (!person) {
    const p = await restGet(jwt, 'people', `select=${ACCOUNT_PERSON_SELECT}&account_user_id=eq.${user.id}&order=created_at&limit=1`)
    person = p.ok ? first<AccountPersonRow>(p.body) : null
  }
  return { user, person }
}

/** v2.6792: who else holds a name or an address — the Hire form's collision reads (findNameCollision, listArchivedPeople + findArchivedMatch, the address check). */
async function readHolders(jwt: string, args: { exceptUserId: string | null; name: string | null; email: string | null }): Promise<Pick<AccountWorld, 'nameHolder' | 'emailHolder' | 'archivedMatch'>> {
  const out: Pick<AccountWorld, 'nameHolder' | 'emailHolder' | 'archivedMatch'> = { nameHolder: null, emailHolder: null, archivedMatch: null }
  const eqName = (n: string) => `name=eq.${encodeURIComponent(n)}`
  if (args.name) {
    const [u, p] = await Promise.all([
      restGet(jwt, 'users', `select=id,name&${eqName(args.name)}&archived_at=is.null&limit=5`),
      restGet(jwt, 'people', `select=id,name,account_user_id&${eqName(args.name)}&archived_at=is.null&limit=5`),
    ])
    const user = ((u.ok && Array.isArray(u.body) ? u.body : []) as { id: string; name: string }[]).find((r) => r.id !== args.exceptUserId)
    if (user) out.nameHolder = { where: 'account', id: user.id, name: user.name }
    else {
      const person = ((p.ok && Array.isArray(p.body) ? p.body : []) as { id: string; name: string; account_user_id: string | null }[]).find((r) => r.account_user_id !== args.exceptUserId || !args.exceptUserId)
      if (person) out.nameHolder = { where: 'roster', id: person.id, name: person.name }
    }
  }
  if (args.email) {
    const e = await restGet(jwt, 'users', `select=id,name&email=ilike.${encodeURIComponent(args.email.replace(/[\\%_*]/g, (c) => `\\${c}`))}&limit=5`)
    const holder = ((e.ok && Array.isArray(e.body) ? e.body : []) as { id: string; name: string | null }[]).find((r) => r.id !== args.exceptUserId)
    if (holder) out.emailHolder = { id: holder.id, name: holder.name }
  }
  // v2.6525: an archived teammate carrying the name or the address — Bring back, never a second row. Fixture accounts are not teammates.
  if (!args.exceptUserId && (args.name || args.email)) {
    const ors: string[] = []
    if (args.name) ors.push(`name.eq.${JSON.stringify(args.name)}`)
    if (args.email) ors.push(`email.ilike.${JSON.stringify(args.email.replace(/[\\%_*]/g, (c) => `\\${c}`))}`)
    const a = await restGet(jwt, 'users', `select=id,name,email,archived_at,is_sample,is_digital_twin,is_walk_tester&archived_at=not.is.null&or=(${encodeURIComponent(ors.join(','))})&limit=5`)
    const rows = ((a.ok && Array.isArray(a.body) ? a.body : []) as { id: string; name: string | null; email: string | null; archived_at: string | null; is_sample: boolean | null; is_digital_twin: boolean | null; is_walk_tester: boolean | null }[]).filter((r) => !r.is_sample && !r.is_digital_twin && !r.is_walk_tester)
    const hit = rows[0]
    if (hit) {
      const byName = !!args.name && (hit.name ?? '').trim().toLowerCase() === args.name.trim().toLowerCase()
      const byEmail = !!args.email && (hit.email ?? '').trim().toLowerCase() === args.email
      out.archivedMatch = { id: hit.id, name: hit.name, by: byName && byEmail ? 'both' : byName ? 'name' : 'email', left: hit.archived_at ? hit.archived_at.slice(0, 10) : null }
    }
  }
  return out
}

/** v2.6792: the app's origin the account emails land on (invite-user's /accept-invite, send-sign-in-email's /dashboard, the reset's /reset-password-confirm). */
function appOrigin(): string {
  return (Deno.env.get('APP_ORIGIN')?.trim() || 'https://clicktooling.com').replace(/\/+$/, '') // domain-cutover flip point (docs/DOMAIN_CUTOVER.md)
}

/** The words a function's refusal carries, for a step that was held. */
function fnWords(r: { ok: boolean; status: number; body: unknown }): string {
  const b = r.body as { error?: unknown; message?: unknown } | null
  const e = b && typeof b === 'object' ? (typeof b.error === 'string' ? b.error : typeof b.message === 'string' ? b.message : '') : ''
  return e || `answered ${r.status}`
}

/** The job a mail file lands on, in words, and whether it has a Drive folder yet (0.29.0). Read as the dev: RLS applies. */
async function jobWordsFor(reader: Reader, job: MailFileJobRef): Promise<{ label: string; folder: string } | { error: string }> {
  const folderWords = (link: unknown): string => (typeof link === 'string' && link.trim() ? 'present' : 'none yet: apply is refused until the job has one (Documents → Jobs → the job → Make the folder)')
  if ('jobs_ledger_id' in job) {
    const r = (await reader.rows('jobs_ledger', { select: 'id,job_name,click_number,hcp_number,google_drive_link', filters: [{ column: 'id', op: 'eq', value: job.jobs_ledger_id }], limit: 1 }))[0]
    if (!r) return { error: 'No Pipeline job with that jobs_ledger_id (find_job names one).' }
    const number = typeof r.click_number === 'string' && r.click_number ? r.click_number : typeof r.hcp_number === 'string' && r.hcp_number ? r.hcp_number : ''
    return { label: `${number ? `${number} ` : ''}${String(r.job_name ?? '')}`.trim() || `job ${job.jobs_ledger_id}`, folder: folderWords(r.google_drive_link) }
  }
  if ('bid_id' in job) {
    const r = (await reader.rows('bids', { select: 'id,project_name,drive_link', filters: [{ column: 'id', op: 'eq', value: job.bid_id }], limit: 1 }))[0]
    if (!r) return { error: 'No bid with that bid_id (find_bid names one).' }
    return { label: `bid ${String(r.project_name ?? job.bid_id)}`, folder: folderWords(r.drive_link) }
  }
  const r = (await reader.rows('gc_projects', { select: 'project_id,drive_folder_url', filters: [{ column: 'project_id', op: 'eq', value: job.project_id }], limit: 1 }))[0]
  if (!r) return { error: 'No GC project with that project_id.' }
  return { label: `GC project ${job.project_id}`, folder: folderWords(r.drive_folder_url) }
}

/** One read verb, as `who`. `jwt` is minted lazily: the catalog verbs never need a session. */
async function runVerb(who: Identity, jwt: () => Promise<string>, name: string, args: Record<string, unknown>, hooks: Hooks = NO_HOOKS): Promise<Outcome> {
  switch (name) {
    case 'whoami':
      return ok({
        reads_as: { name: who.name, email: who.email, role: who.role },
        door: { method: 'GET only — the database runs it in a read-only transaction', row_limit: ROWS_MAX_LIMIT, secrets: 'token / hash / password columns are redacted', never_read: [...DENIED_TABLES] },
        writes: { verbs: Object.keys(WRITE_VERBS), rule: 'plan_ first (a dry run), then apply_ quoting the plan_hash; apply re-runs the dry run and writes only when it still matches. Each is one dev-gated RPC as you — or, for a set of drawings and a paper on a plan part, the rows the Plans section writes under the same RLS — audited with your name. Never through view_as.' },
        catalog: { tables_and_views: Object.keys(CATALOG_TABLES).length, rpcs: Object.keys(CATALOG_RPCS).length },
        server: `pipetooling-dev-mcp ${SERVER_VERSION}`,
      })

    case 'find_rpc': {
      const hits = searchNames(Object.keys(CATALOG_RPCS), String(args.text ?? ''))
      return ok({ matches: hits.map((n) => ({ rpc: n, signatures: CATALOG_RPCS[n] })), note: hits.length === 0 ? 'No RPC name contains every word — try fewer or different words.' : undefined }, { rowCount: hits.length })
    }

    case 'find_table': {
      const hits = searchNames(Object.keys(CATALOG_TABLES).filter((t) => !DENIED_TABLES.has(t)), String(args.text ?? ''))
      return ok({ matches: hits.map((n) => ({ table: n, kind: CATALOG_TABLES[n].kind, columns: Object.keys(CATALOG_TABLES[n].columns).length })) }, { rowCount: hits.length })
    }

    case 'get_table': {
      const table = String(args.table ?? '')
      const entry = CATALOG_TABLES[table]
      if (!entry || DENIED_TABLES.has(table)) return refused(`No table or view named "${table}" in the catalog — find_table searches names.`, { target: table })
      return ok({ table, kind: entry.kind, columns: entry.columns }, { target: table })
    }

    case 'call_read': {
      const rpc = String(args.rpc ?? '')
      if (!isSafeIdent(rpc) || !CATALOG_RPCS[rpc]) return refused(`No RPC named "${rpc}" in the catalog — find_rpc searches names.`, { target: rpc })
      const rpcArgs = (args.args && typeof args.args === 'object' && !Array.isArray(args.args) ? args.args : {}) as Record<string, unknown>
      const built = buildRpcQuery(rpcArgs, typeof args.limit === 'number' ? args.limit : undefined)
      if (!built.ok) return refused(built.error, { target: rpc })
      const res = await restGet(await jwt(), `rpc/${rpc}`, built.query)
      if (!res.ok) {
        const message = restError(res.status, res.body)
        return { log: { status: 'error', target: rpc, error: message }, text: message, isError: true }
      }
      return ok(redactSecrets(res.body), { target: rpc, rowCount: rowCountOf(res.body) })
    }

    case 'read_rows': {
      const table = String(args.table ?? '')
      const entry = CATALOG_TABLES[table]
      if (!isSafeIdent(table) || !entry) return refused(`No table or view named "${table}" in the catalog — find_table searches names.`, { target: table })
      if (DENIED_TABLES.has(table)) return refused(`"${table}" holds credentials and is never read through this server.`, { target: table })
      const built = buildRowsQuery({ select: args.select, filters: args.filters, order: args.order, limit: args.limit }, new Set(Object.keys(entry.columns)))
      if (!built.ok) return refused(built.error, { target: table })
      const res = await restGet(await jwt(), table, built.query)
      if (!res.ok) {
        const message = restError(res.status, res.body)
        return { log: { status: 'error', target: table, error: message }, text: message, isError: true }
      }
      const rows = rowCountOf(res.body)
      return ok({ rows, note: rows === 0 ? 'No rows — nothing matches, or RLS hides it from this reader.' : undefined, data: redactSecrets(res.body) }, { target: table, rowCount: rows })
    }

    case 'find_job':
      return ok(await findJob(readerAs(await jwt()), String(args.text ?? '')), { target: 'search_jobs_ledger' })
    case 'find_bid':
      return ok(await findBid(readerAs(await jwt()), String(args.text ?? '')), { target: 'search_bids_for_clock' })
    case 'find_customer':
      return ok(await findCustomer(readerAs(await jwt()), String(args.text ?? '')), { target: 'customers' })
    case 'find_person':
      return ok(await findPerson(readerAs(await jwt()), String(args.text ?? '')), { target: 'users' })
    case 'get_job':
      return composite(await getJob(readerAs(await jwt()), String(args.job ?? ''), todayYmdInAppTz()), 'jobs_ledger')
    case 'get_customer':
      return composite(await getCustomer(readerAs(await jwt()), String(args.customer ?? ''), todayYmdInAppTz()), 'customers')
    case 'get_bid':
      return composite(await getBid(readerAs(await jwt()), String(args.bid ?? '')), 'bids')
    case 'get_submittals':
      // v2.6804: the bid's submittals as Bids → Submittals reads them, through the tab's own kernels (devMcpSubmittals.ts).
      return composite(await getSubmittals(readerAs(await jwt()), String(args.bid ?? ''), todayYmdInAppTz()), 'bid_submittals')
    case 'search_mail':
    case 'read_mail':
    case 'read_mail_file':
    case 'read_mail_file_text':
    case 'plan_mail_file':
    case 'apply_mail_file':
    case 'plan_mail_tag':
    case 'apply_mail_tag': {
      // v2.6565: the company's own mailboxes under the delegation, as each login, read-only by scope. Nothing is kept but the log.
      // 0.29.0: a file off a mail, read on the server and handed back or filed where it belongs (devMcpMailFile.ts).
      const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
      const domain = mailDomain(Deno.env.get('GMAIL_IMPERSONATE_USER'))
      if (!saJson || !domain) return refused('The mail reader is not set up on this project (GOOGLE_SERVICE_ACCOUNT_JSON and GMAIL_IMPERSONATE_USER, docs/EDGE_FUNCTIONS.md → gmail-sync).', { target: 'gmail' })
      const rows = await readerAs(await jwt()).rows('users', {
        select: 'email,name,archived_at',
        filters: [
          { column: 'email', op: 'ilike', value: `*@${domain}` },
          { column: 'is_digital_twin', op: 'eq', value: false },
          { column: 'is_sample', op: 'eq', value: false },
        ],
        order: [{ column: 'email' }],
        limit: MAIL_SEARCH_ACCOUNTS_CAP * 5,
      })
      const known: MailAccount[] = rows.map((r) => ({ email: String(r.email ?? '').toLowerCase(), name: typeof r.name === 'string' ? r.name : null, archived: r.archived_at != null }))
      const tokenFor = (account: string) => googleServiceToken(saJson, [GMAIL_READONLY_SCOPE], account)
      const reason = (e: unknown): string => (e instanceof Error ? e.message : String(e))
      if (name === 'read_mail') {
        const parsed = mailReadArgs(args, known)
        if (!parsed.ok) return refused(parsed.error, { target: 'gmail' })
        try {
          const message = await gmailMessage(await tokenFor(parsed.account.email), parsed.id)
          return ok(mailReadReply(parsed.account.email, readGmailMessage(message)), { target: parsed.account.email })
        } catch (e) {
          if (e instanceof GmailError && e.status === 404) return refused(`Gmail has no mail ${parsed.id} in ${parsed.account.email}.`, { target: parsed.account.email })
          return refused(mailRefusal(parsed.account.email, reason(e)), { target: parsed.account.email })
        }
      }
      // A file off a mail, by its name as read_mail lists it, never over the cap: the bytes come from the part itself or attachments.get.
      const fileOff = async (account: string, id: string, fileName: string): Promise<MailFileRaw | { error: string }> => {
        const token = await tokenFor(account)
        const email = readGmailMessage(await gmailMessage(token, id))
        const picked = pickMailFile(email.files, fileName)
        if (!picked.ok) return { error: picked.error }
        const f = picked.file
        const over = (n: number) => `${f.name} is ${(n / 1024 / 1024).toFixed(1)} MB; a file off a mail takes at most ${MAIL_FILE_MAX_BYTES / 1024 / 1024} MB. Save it to Drive by hand and link it.`
        if (f.size > MAIL_FILE_MAX_BYTES) return { error: over(f.size) }
        const data = f.data ?? (f.attachmentId ? ((await gmailAttachment(token, id, f.attachmentId)).data ?? '') : '')
        const bytes = base64UrlBytes(data)
        if (bytes.length < 1) return { error: `${f.name} came back empty from Gmail.` }
        if (bytes.length > MAIL_FILE_MAX_BYTES) return { error: over(bytes.length) }
        const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('')
        return { name: f.name, mime: f.mime, sha256, bytes }
      }
      if (name === 'read_mail_file') {
        const parsed = mailFileReadArgs(args, known)
        if (!parsed.ok) return refused(parsed.error, { target: 'gmail' })
        try {
          const file = await fileOff(parsed.account.email, parsed.id, parsed.name)
          if ('error' in file) return refused(file.error, { target: parsed.account.email })
          // A piece that fits the door's reply, never base64 cut mid-string: offset reads on (0.52.0).
          const piece = mailFileReadReply(parsed.account.email, parsed.id, file, { offset: parsed.offset, length: parsed.length })
          if (!piece.ok) return refused(piece.error, { target: parsed.account.email })
          return ok(piece.reply, { target: parsed.account.email })
        } catch (e) {
          if (e instanceof GmailError && e.status === 404) return refused(`Gmail has no mail ${parsed.id} in ${parsed.account.email}.`, { target: parsed.account.email })
          return refused(mailRefusal(parsed.account.email, reason(e)), { target: parsed.account.email })
        }
      }
      if (name === 'read_mail_file_text') {
        // 0.60.0 (#296): the file's words by the file index's own reader, a piece that fits the door's reply.
        const parsed = mailFileTextArgs(args, known)
        if (!parsed.ok) return refused(parsed.error, { target: 'gmail' })
        try {
          const file = await fileOff(parsed.account.email, parsed.id, parsed.name)
          if ('error' in file) return refused(file.error, { target: parsed.account.email })
          const read = await readWithin(() => textFromBytes(file.bytes, { name: file.name, mimeType: file.mime }, { limits: INDEX_PDF_LIMITS }), `${parsed.id}/${file.name}`, INDEX_READ_MS)
          const piece = mailFileTextReply(parsed.account.email, parsed.id, file, read, { offset: parsed.offset })
          if (!piece.ok) return refused(piece.error, { target: parsed.account.email })
          return ok(piece.reply, { target: parsed.account.email })
        } catch (e) {
          if (e instanceof GmailError && e.status === 404) return refused(`Gmail has no mail ${parsed.id} in ${parsed.account.email}.`, { target: parsed.account.email })
          return refused(mailRefusal(parsed.account.email, reason(e)), { target: parsed.account.email })
        }
      }
      if (name === 'plan_mail_file' || name === 'apply_mail_file') {
        if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)
        const parsed = mailFileArgs(args, known)
        if (!parsed.ok) return refused(parsed.error, { target: 'gmail' })
        const step = name === 'plan_mail_file' ? 'plan' : 'apply'
        const quoted = typeof args.plan_hash === 'string' ? args.plan_hash.trim() : ''
        if (step === 'apply' && !quoted) return refused('apply_mail_file needs plan_hash from plan_mail_file.', { target: parsed.value.target })
        let file: MailFileBytes
        try {
          const read = await fileOff(parsed.value.account.email, parsed.value.id, parsed.value.name)
          if ('error' in read) return refused(read.error, { target: parsed.value.target })
          file = mailFileWhole(read)
        } catch (e) {
          if (e instanceof GmailError && e.status === 404) return refused(`Gmail has no mail ${parsed.value.id} in ${parsed.value.account.email}.`, { target: parsed.value.target })
          return refused(mailRefusal(parsed.value.account.email, reason(e)), { target: parsed.value.target })
        }
        if (step === 'apply') {
          // One apply per plan: the outer call is the one on the log, so the outer verb is the one asked.
          const prior = await hooks.priorApply(name, quoted)
          if (prior) return refused(mailFileAppliedWords(prior), { target: parsed.value.target })
        }
        if (parsed.value.to.kind !== 'job') {
          // The evidence and document doors with the file as they take it: the plan, the hash and the refusals are theirs.
          const inner = innerVerbFor(step, parsed.value.to, file, quoted || null)
          const out = await runVerb(who, jwt, inner.verb, inner.args, hooks)
          return { ...out, log: { ...out.log, target: out.log.target ?? parsed.value.target } }
        }
        // A job: drive-link's put as the dev, the Documents tab's own door. The plan commits to the job, the landing and the bytes.
        const job = await jobWordsFor(readerAs(await jwt()), parsed.value.to.job)
        if ('error' in job) return refused(job.error, { target: parsed.value.target })
        const commitment = jobCommitment(parsed.value, job.label, file)
        const hash = await sha256Hex(JSON.stringify(commitment))
        if (step === 'plan') return ok({ ...jobPlanReply(commitment, hash), drive_folder: job.folder }, { target: parsed.value.target })
        if (hash !== quoted) return refused(mailFileChangedWords(file.name), { target: parsed.value.target })
        const put = await invokeAsDev(await jwt(), 'drive-link', { action: 'put', job: parsed.value.to.job, name: file.name, mime: file.mime, where: parsed.value.to.where, base64: file.content_base64 })
        if (!put.ok) {
          const message = restError(put.status, put.body)
          return { log: { status: 'error', target: parsed.value.target, error: message }, text: message, isError: true }
        }
        const landed = put.body as { driveFileId?: string; url?: string }
        return ok(jobApplyReply(commitment, { driveFileId: String(landed.driveFileId ?? ''), url: String(landed.url ?? '') }), { target: parsed.value.target })
      }
      if (name === 'plan_mail_tag' || name === 'apply_mail_tag') {
        // 0.30.0: a conversation onto a job through gmail-mine's own tag as that login (its seat door: `as`, `plan`).
        if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)
        const parsed = mailTagArgs(args, known)
        if (!parsed.ok) return refused(parsed.error, { target: 'gmail' })
        const target = parsed.value.target
        const step = name === 'plan_mail_tag' ? 'plan' : 'apply'
        const quoted = typeof args.plan_hash === 'string' ? args.plan_hash.trim() : ''
        if (step === 'apply' && !quoted) return refused('apply_mail_tag needs plan_hash from plan_mail_tag.', { target })
        const session = await jwt()
        const person = parsed.value.person
        // Punch list #289 (0.42.0): a person in place of the job — gmail-mine's person tag, the entries as the dev, `stop` lifts the follow.
        const ask = person
          ? { action: 'tag', threadId: parsed.value.threadId, person: { personId: person.personId }, as: parsed.value.account.email, ...(person.stop ? { stop: true } : {}) }
          : { action: 'tag', threadId: parsed.value.threadId, job: parsed.value.job, as: parsed.value.account.email }
        const mineWords = (r: { status: number; body: unknown }): string => {
          const b = r.body && typeof r.body === 'object' ? (r.body as { words?: unknown; error?: unknown }) : null
          return typeof b?.words === 'string' ? b.words : restError(r.status, r.body)
        }
        const planned = await invokeAsDev(session, 'gmail-mine', { ...ask, plan: true })
        if (!planned.ok) return refused(mineWords(planned), { target })
        if (person) {
          const preview = planned.body as MyMailPersonTagPlanOk
          if (preview?.plan !== true) return refused('gmail-mine answered without a plan; it may be a deploy behind.', { target })
          const commitment = personTagCommitment(parsed.value, preview)
          const hash = await sha256Hex(JSON.stringify(commitment))
          if (step === 'plan') return ok(personTagPlanReply(commitment, preview, hash), { target, rowCount: preview.mails.length })
          if (hash !== quoted) return refused(mailTagChangedWords('person'), { target })
          const prior = await hooks.priorApply(name, quoted)
          if (prior) return refused(mailTagAppliedWords(prior, 'person'), { target })
          const done = await invokeAsDev(session, 'gmail-mine', ask)
          if (!done.ok) {
            const message = mineWords(done)
            return { log: { status: 'error', target, error: message }, text: message, isError: true }
          }
          const tagged = done.body as MyMailPersonTagOk
          return ok(personTagApplyReply(commitment, preview, tagged), { target, rowCount: tagged.entries ?? 0 })
        }
        const preview = planned.body as MyMailTagPlanOk
        if (preview?.plan !== true) return refused('gmail-mine answered without a plan; it may be a deploy behind.', { target })
        const commitment = tagCommitment(parsed.value, preview)
        const hash = await sha256Hex(JSON.stringify(commitment))
        if (step === 'plan') return ok(tagPlanReply(commitment, preview, hash), { target, rowCount: preview.mails.length })
        if (hash !== quoted) return refused(mailTagChangedWords(), { target })
        const prior = await hooks.priorApply(name, quoted)
        if (prior) return refused(mailTagAppliedWords(prior), { target })
        const done = await invokeAsDev(session, 'gmail-mine', ask)
        if (!done.ok) {
          const message = mineWords(done)
          return { log: { status: 'error', target, error: message }, text: message, isError: true }
        }
        const tagged = done.body as MyMailTagOk
        return ok(tagApplyReply(commitment, preview, tagged), { target, rowCount: (tagged.lines ?? 0) + (tagged.tied ?? 0) })
      }
      const parsed = mailSearchArgs(args, known)
      if (!parsed.ok) return refused(parsed.error, { target: 'gmail' })
      const { q: query, max } = parsed.value
      const outcomes = await inBatches<MailAccount, MailAccountOutcome>(parsed.value.accounts, 4, async (account) => {
        try {
          const token = await tokenFor(account.email)
          const page = await gmailMessagePage(token, query, max)
          const ids = (page.messages ?? []).map((m) => m.id)
          const hits = await inBatches(ids, 8, async (id) => mailHit(account.email, await gmailMessageHeaders(token, id, MAIL_HIT_HEADERS)))
          return { account: account.email, hits, more: Boolean(page.nextPageToken), estimate: typeof page.resultSizeEstimate === 'number' ? page.resultSizeEstimate : null }
        } catch (e) {
          return { account: account.email, refused: mailRefusal(account.email, reason(e)) }
        }
      })
      const reply = mailSearchReply(query, outcomes)
      return ok(reply, { target: parsed.value.target, rowCount: reply.hits.length })
    }
    case 'check_license': {
      // Punch list #255: the state's record for one number, read from TDLR's open list. Read-only; nothing is kept.
      const trade = String(args.trade ?? '').trim().toLowerCase() as LicenseTrade
      const level = String(args.level ?? '').trim().toLowerCase() as LicenseLevel
      const number = cleanLicenseNumber(String(args.number ?? ''))
      if (trade === 'plumbing') return refused('TSBPE keeps the plumbing record, with no open list, and its search asks for a robot check: a person looks it up at https://vo.licensing.hpc.texas.gov/datamart/searchByLicNumber.do', { target: number || null })
      if (!tradeCheckedByTdlr(trade)) return refused('check_license reads TDLR, which issues electrical and HVAC licenses: trade is electrical or hvac.', { target: number || null })
      const bare = tdlrNumberFor(number)
      if (!bare) return refused(`check_license needs the license number as printed ('783430', 'TACLA39079E'); "${number}" has no number TDLR lists.`, { target: number || null })
      // v2.6485: a Socrata stall ends after TDLR_TIMEOUT_MS with the wait named, never a call that hangs.
      let res: Response
      try {
        res = await fetch(tdlrQueryUrl(bare), { signal: AbortSignal.timeout(TDLR_TIMEOUT_MS) })
      } catch (e) {
        if (isTimeoutError(e)) return refused(TDLR_TIMEOUT_REASON, { target: bare })
        throw e
      }
      if (!res.ok) return refused(`TDLR's open list answered ${res.status}. Try again in a minute.`, { target: bare })
      const rows = (await res.json()) as TdlrRow[]
      return ok({ source: tdlrQueryUrl(bare), number: bare, answer: tdlrAnswer(rows, trade, level), every_license_under_this_number: rows.map((r) => ({ type: [r.license_type, r.license_subtype].filter(Boolean).join(' '), holder: r.owner_name ?? r.business_name ?? null, expires: r.license_expiration_date_mmddccyy ?? null })) }, { target: bare })
    }
    case 'read_on_site':
      // v2.6367 (punch list #209): the job's boxes and lines through the screens' own kernel, as the reader (RLS applies).
      return composite(await getOnSite(readerAs(await jwt()), String(args.job ?? ''), new Date()), 'job_containers')
    case 'get_hours_statement':
      // v2.6414 (punch list #212): the window's reads through the door as the reader, handed to the shared kernel.
      return composite(await getHoursStatement(readerAs(await jwt()), args), 'hours_statements')

    case 'get_history': {
      // v2.6044: a site's history as people wrote it, whole, through dev_history_read as the reader (RLS applies).
      const developmentId = String(args.development_id ?? '').trim()
      if (!UUID_SHAPE.test(developmentId)) return refused('get_history needs development_id — a developments.id (read_rows on developments by name).', { target: 'development_history_entries' })
      const rpcArgs: Record<string, unknown> = { p_development_id: developmentId }
      for (const [key, arg] of [['p_job_id', 'job_id'], ['p_bid_id', 'bid_id'], ['p_since', 'since']] as const) {
        const v = typeof args[arg] === 'string' ? (args[arg] as string).trim() : ''
        if (v) rpcArgs[key] = v
      }
      if (typeof args.limit === 'number') rpcArgs.p_limit = Math.max(1, Math.min(500, Math.floor(args.limit)))
      const built = buildRpcQuery(rpcArgs, undefined)
      if (!built.ok) return refused(built.error, { target: 'development_history_entries' })
      const res = await restGet(await jwt(), 'rpc/dev_history_read', built.query)
      if (!res.ok) {
        const message = restError(res.status, res.body)
        return { log: { status: 'error', target: developmentId, error: message }, text: message, isError: true }
      }
      const body = res.body as { count?: number } | null
      return ok(redactSecrets(res.body), { target: developmentId, rowCount: typeof body?.count === 'number' ? body.count : undefined })
    }

    case 'get_case_brief': {
      // v2.6619 (punch list #278 PR 1): the orientation read — composed from the seat's own reads as `who` under RLS, each
      // fail-soft into `held` (devMcpCaseBrief.ts); the section indexes come from the two index views, never the text.
      // v2.6935: a brief too long for the door shortens itself (devMcpReplyFit.ts) and names the blocks in `shortened`.
      const out = await getCaseBrief(readerAs(await jwt()), { person: String(args.person ?? '') }, { role: who.role, todayYmd: todayYmdInAppTz() })
      if ('refused' in out) return refused(out.refused, { target: 'people' })
      return ok(out, { target: out.person.id, rowCount: out.entries.count })
    }

    case 'get_document_history': {
      // v2.6622 (punch list #278 PR 4): one GET of dev_doc_history as the dev; the two texts are diffed here and only the
      // difference goes on (devMcpDocHistory.ts); another role is refused in words.
      const out = await getDocumentHistory(readerAs(await jwt()), { person: String(args.person ?? ''), doc_id: args.doc_id, kind: args.kind, from: args.from, to: args.to }, { role: who.role })
      if ('refused' in out) return refused(out.refused, { target: 'people' })
      return ok(out, { target: out.person.id, rowCount: out.revision_count })
    }

    case 'get_person_document': {
      // v2.6621 (punch list #278 PR 3): one GET of dev_doc_read as the dev (devMcpDocRead.ts); another role is refused in words.
      const out = await getPersonDocument(readerAs(await jwt()), { person: String(args.person ?? ''), doc_id: args.doc_id, kind: args.kind, section: args.section }, { role: who.role })
      if ('refused' in out) return refused(out.refused, { target: 'people' })
      return ok(out, { target: out.person.id, rowCount: out.section ? 1 : out.sections.length })
    }

    case 'get_matter_document': {
      // v2.6722 (punch list #288 PR 3): one GET of dev_matter_doc_read as the dev (devMcpMatterDocRead.ts); another role is refused in words.
      const out = await getMatterDocument(readerAs(await jwt()), { matter_id: args.matter_id, doc_id: args.doc_id, section: args.section }, { role: who.role })
      if ('refused' in out) return refused(out.refused, { target: typeof args.matter_id === 'string' ? args.matter_id : null })
      return ok(out, { target: out.matter_id, rowCount: out.section ? 1 : out.sections.length })
    }

    case 'search_case': {
      // v2.6620 (punch list #278 PR 2): one GET of dev_case_search as the dev (devMcpCaseSearch.ts); another role is refused in words.
      const out = await searchCase(readerAs(await jwt()), { person: String(args.person ?? ''), q: args.q, in: args.in, limit: args.limit }, { role: who.role })
      if ('refused' in out) return refused(out.refused, { target: 'people' })
      return ok(out, { target: out.person.id, rowCount: out.shown })
    }

    case 'get_person_file': {
      // v2.6422: a person's HR file whole, as People → HR draws it — the tab's own kernel (_shared/personTimeline.ts)
      // over the tab's sources and keys, each read as `who` under RLS and fail-soft (devMcpPersonFile.ts). The HR
      // sources are dev-only by RLS and are not read for another role: a view_as of the office sees the papers.
      // v2.6935: brief / line_chars for short lines, until to read on; a reply past the door's cut shortens itself and says so.
      const out = await getPersonFile(readerAs(await jwt()), { person: String(args.person ?? ''), lane: args.lane, source: args.source, since: args.since, until: args.until, docs: args.docs, brief: args.brief, line_chars: args.line_chars }, { role: who.role, todayYmd: todayYmdInAppTz() })
      // The refusal is a string on every path; the `??` only keeps deno check quiet where the inferred union widens it (v2.6716).
      if ('refused' in out) return refused(out.refused ?? 'get_person_file was refused', { target: 'people' })
      return ok(out, { target: out.person.id, rowCount: out.counts.shown })
    }

    case 'check_edge_boot': {
      // Not a read as anyone: it probes the platform. view_as a non-dev has no business running it.
      if (who.role !== 'dev') return refused('check_edge_boot is for devs — it probes the platform, it does not read as a person.', { target: 'edge_functions' })
      const { batch, nextAfter } = edgeBootBatch(EDGE_FUNCTIONS, typeof args.after === 'string' ? args.after : null)
      const report = edgeBootReport(await probeEdgeBoots(batch), { total: EDGE_FUNCTIONS.length, nextAfter })
      return ok(report, { target: 'edge_functions', rowCount: report.probed })
    }

    case 'mint_twin_setup_code': {
      // v2.6187: a setup code for a twin, through twin-setup as the dev (it enforces dev-for-any-twin
      // and ten per ten minutes). The key itself never crosses this door — a tool result is
      // transcript — only the code, single-use and ten minutes, which the Mac redeems into a file.
      if (who.role !== 'dev') return refused("mint_twin_setup_code runs only as you, with a dev's own key.")
      const label = typeof args.label === 'string' ? args.label.trim().slice(0, 80) : ''
      if (!label) return refused("mint_twin_setup_code needs label — the key's name as the fleet lists it (e.g. \"Todd's agent on todd-mbp\"), so it can be revoked by name.")
      const twinRef = typeof args.twin === 'string' ? args.twin.trim() : ''
      let twinUserId: string | null = null
      if (twinRef) {
        if (UUID_SHAPE.test(twinRef)) twinUserId = twinRef
        else if (/^twin-[a-z_]+-\d+@twins\.pipetooling\.local$/i.test(twinRef)) {
          const res = await restGet(await jwt(), 'users', `select=id&email=eq.${encodeURIComponent(twinRef.toLowerCase())}&is_digital_twin=eq.true&limit=1`)
          const row = Array.isArray(res.body) ? (res.body[0] as { id?: string } | undefined) : undefined
          if (!res.ok || typeof row?.id !== 'string') return refused(`No twin reads as ${twinRef}.`)
          twinUserId = row.id
        } else return refused("twin must be the twin's users.id or its email (twin-estimator-N@twins.pipetooling.local).")
      }
      const body: Record<string, unknown> = { action: 'mint', label, ...(twinUserId ? { twin_user_id: twinUserId } : { kind: 'estimator' }) }
      const res = await fetch(`${env('SUPABASE_URL')}/functions/v1/twin-setup`, {
        method: 'POST',
        headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: `Bearer ${await jwt()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const reply = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (!res.ok || typeof reply.code !== 'string') {
        const message = `twin-setup refused the code (${res.status}): ${typeof reply.error === 'string' ? reply.error : 'no reason given'}`
        return { log: { status: 'error', target: twinUserId, error: message }, text: message, isError: true }
      }
      const rounds = args.rounds === true
      const twinEmail = typeof reply.twin_email === 'string' ? reply.twin_email : null
      return ok({
        code: reply.code,
        expires_at: reply.expires_at ?? null,
        twin_email: twinEmail,
        twin_kind: reply.twin_kind ?? null,
        label: reply.label ?? label,
        redeem: `python3 scripts/twin/redeem_setup_code.py ${reply.code}${rounds ? ' --rounds' : ''}`,
        then: 'The script mints the key server-side, writes it to ~/pt-twin-digest/twin.token (mode 600) and saves the kickoff beside it; it prints the twin, the label and the connector, never the key. After it, python3 scripts/twin/twin.py get_brief answers, /bid bNNN runs, and bash scripts/twin-session.sh starts a Code session with the twin-mcp connector live. The code is single-use and lasts ten minutes. Revoke the key by its label at Settings → Digital twins.',
      }, { target: twinEmail ?? twinUserId })
    }
    case 'plan_job':
    case 'apply_job': {
      // v2.6790 (punch list #293): a job as the New Job form makes it (JobFormModal createJob) — one jobs_ledger row
      // under RLS as the dev, then the kind (punch list #238's order). No RPC: the dry run is this server's read of the
      // customer, the service type, the development, the project, the bid, the owner rule's settings and the live jobs
      // wearing the name (devMcpJobs.ts), hashed with the payload; apply reads again and writes only when the hash
      // still matches. Never as anyone else.
      if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)
      const built = writeRpcBody(name, args)
      if (!built.ok) return refused(built.error)
      const session = await jwt()
      const p = built.body.p as NewJobPayload
      const reads: JobReads = {
        rows: async (table, query) => {
          const res = await restGet(session, table, query)
          if (!res.ok) throw new Error(restError(res.status, res.body))
          return Array.isArray(res.body) ? (res.body as Record<string, unknown>[]) : []
        },
      }
      let world
      try {
        world = await readNewJobWorld(reads, p, { userId: who.userId, name: who.name })
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        return { log: { status: 'error', target: built.target, error: message }, text: message, isError: true }
      }
      const dry = newJobDryRun(p, world)
      if (!dry.ok) return refused(dry.refused, { target: built.target })
      const fresh = await planHash(name, p, dry.reply)
      if (built.step === 'plan') return ok(planReply(name, dry.reply, fresh), { target: built.target })
      if (fresh !== built.planHash) return refused(planMismatch(name, built.planHash ?? '', fresh), { target: built.target })
      const prior = await hooks.priorApply(name, fresh)
      if (prior) return refused(alreadyApplied(name, prior), { target: built.target })
      const row = dry.reply.row as Record<string, unknown>
      const made = await restRows(session, 'POST', 'jobs_ledger', 'select=id,click_number,hcp_number,job_name', row)
      if (!made.ok) {
        const message = restError(made.status, made.body)
        return { log: { status: 'error', target: built.target, error: message }, text: message, isError: true }
      }
      const job = (Array.isArray(made.body) ? made.body[0] : made.body) as { id: string; click_number?: string | null; hcp_number?: string | null; job_name?: string | null } | null
      if (!job || typeof job.id !== 'string') return { log: { status: 'error', target: built.target, error: 'jobs_ledger returned no row' }, text: 'The insert answered with no row — RLS let nothing through. This account cannot make this job.', isError: true }
      // The kind goes on after the row, never in the insert (punch list #238): a kind the table refuses says so and the job stands.
      let kind: { asked: string | null; saved: boolean; why?: string } = { asked: p.kind ?? null, saved: false }
      if (p.kind) {
        const k = await restRows(session, 'PATCH', 'jobs_ledger', `id=eq.${job.id}`, { kind: p.kind })
        kind = k.ok ? { asked: p.kind, saved: true } : { asked: p.kind, saved: false, why: restError(k.status, k.body) }
      }
      return ok(jobAppliedWords(job, kind), { target: job.id })
    }
    case 'plan_job_update':
    case 'apply_job_update': {
      // v2.6793 / 0.52.0 (punch list #293, PR 2): a job changed as Edit Job and the Pipeline change it — the identity slice's
      // columns, the price, the percent and the kind as one PATCH under RLS as the dev, then the status through the
      // Pipeline's own update_job_status one step at a time. No wrapper RPC: the dry run is this server's read of the job
      // and of every row a new id names (devMcpJobs.ts), hashed with the payload; apply reads again and writes only when
      // the hash still matches. Never as anyone else.
      if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)
      const built = writeRpcBody(name, args)
      if (!built.ok) return refused(built.error)
      const session = await jwt()
      const p = built.body.p as JobUpdatePayload
      const reads: JobReads = {
        rows: async (table, query) => {
          const res = await restGet(session, table, query)
          if (!res.ok) throw new Error(restError(res.status, res.body))
          return Array.isArray(res.body) ? (res.body as Record<string, unknown>[]) : []
        },
      }
      const errored = (text: string): Outcome => ({ log: { status: 'error', target: built.target, error: text }, text, isError: true })
      let world
      try {
        world = await readJobUpdateWorld(reads, p)
      } catch (e) {
        return errored(e instanceof Error ? e.message : String(e))
      }
      const dry = jobUpdateDryRun(p, world)
      if (!dry.ok) return refused(dry.refused, { target: built.target })
      const fresh = await planHash(name, p, dry.reply)
      if (built.step === 'plan') return ok(planReply(name, dry.reply, fresh), { target: built.target })
      if (fresh !== built.planHash) return refused(planMismatch(name, built.planHash ?? '', fresh), { target: built.target })
      const prior = await hooks.priorApply(name, fresh)
      if (prior) return refused(alreadyApplied(name, prior), { target: built.target })
      const job = world.job!
      const patch = dry.reply.patch as Record<string, unknown>
      const planned = dry.reply.changes as Array<{ column: string; before: unknown; after: unknown }>
      let landed: { changes: Array<{ column: string; before: unknown; after: unknown }>; held: string | null } = { changes: [], held: null }
      if (Object.keys(patch).length) {
        const res = await restRows(session, 'PATCH', 'jobs_ledger', `id=eq.${job.id}`, patch)
        if (!res.ok) return errored(restError(res.status, res.body))
        // return=minimal says nothing about rows RLS kept: read the columns back and say what landed.
        const back = await restGet(session, 'jobs_ledger', `select=${Object.keys(patch).join(',')}&id=eq.${job.id}`)
        const row = (back.ok && Array.isArray(back.body) ? back.body[0] : null) as Record<string, unknown> | null
        const stuck = planned.filter((c) => row && String(row[c.column] ?? '') !== String(c.after ?? ''))
        landed = { changes: planned.filter((c) => !stuck.includes(c)), held: stuck.length ? `This account could not change ${stuck.map((c) => c.column).join(', ')} on this job (RLS let no row through).` : null }
      }
      let status: { from: JobStatus; steps: Array<{ to: JobStatus; ok: boolean; error?: string | null; deleted_ready_to_bill_invoices?: number }> } | null = null
      if (p.status) {
        const from = ((JOB_STATUSES as readonly string[]).includes(job.status ?? '') ? job.status : 'waiting') as JobStatus
        const planSteps = ((dry.reply.status as { steps?: Array<{ to: JobStatus }> } | null)?.steps ?? []).map((s) => s.to)
        status = { from, steps: [] }
        for (const to of planSteps) {
          const res = await restPost(session, 'rpc/update_job_status', { p_job_id: job.id, p_to_status: to })
          const body = (res.body && typeof res.body === 'object' ? res.body : {}) as { ok?: boolean; error?: string; deleted_ready_to_bill_invoices?: number }
          if (!res.ok || body.error) {
            status.steps.push({ to, ok: false, error: body.error ?? restError(res.status, res.body) })
            break
          }
          status.steps.push({ to, ok: true, ...(body.deleted_ready_to_bill_invoices ? { deleted_ready_to_bill_invoices: body.deleted_ready_to_bill_invoices } : {}) })
        }
      }
      return ok(jobUpdateAppliedWords(job, landed, status), { target: job.id })
    }
    case 'plan_bill':
    case 'apply_bill': {
      // v2.6794 (punch list #293, PR 3): a bill as Bill Customer and the share row make and hand it over — the app's own
      // RPCs and functions in the modal's order, as the dev. No wrapper RPC: the dry run is this server's read of the job,
      // its lines, the customer, their contact and the sends (devMcpBill.ts), hashed with the payload; apply reads again
      // and acts only when the hash still matches, each step's outcome in the reply. Never as anyone else.
      if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)
      const shaped = billInput(name, args, todayYmdInAppTz())
      if (!shaped.ok) return refused(shaped.error)
      const p = shaped.p
      const target = shaped.target
      const session = await jwt()
      const reads: BillReads = {
        rows: async (table, query) => {
          const res = await restGet(session, table, query)
          if (!res.ok) throw new Error(restError(res.status, res.body))
          return Array.isArray(res.body) ? (res.body as Record<string, unknown>[]) : []
        },
      }
      const errored = (text: string): Outcome => ({ log: { status: 'error', target, error: text }, text, isError: true })
      let world
      try {
        world = await readBillWorld(reads, p, { userId: who.userId, name: who.name })
      } catch (e) {
        return errored(e instanceof Error ? e.message : String(e))
      }
      const dry = billDryRun(p, world)
      if (!dry.ok) return refused(dry.refused, { target })
      const fresh = await planHash(name, p, dry.reply)
      if (name === 'plan_bill') return ok(planReply(name, dry.reply, fresh), { target })
      if (fresh !== shaped.planHash) return refused(planMismatch(name, shaped.planHash ?? '', fresh), { target })
      const prior = await hooks.priorApply(name, fresh)
      if (prior) return refused(alreadyApplied(name, prior), { target })
      const job = world.job!
      const jobLabel = String((dry.reply.job as { label: string }).label)
      const planned = dry.reply as { text: { channel_id: string; to: string; words: string } | null; email: { channel_id: string; to: string; subject: string; body: string; signature: string[] } | null; bill: { amount_cents?: number; amount: string } }
      let invoice: InvoiceRow
      let status: { moved: boolean; now: string | null; why?: string | null } | null = null
      if (p.action === 'make') {
        // (1) The one primary Ready to Bill row sized to the remainder — the modal's only write before the send.
        const ensured = await restPost(session, 'rpc/ensure_single_ready_to_bill_invoice_for_job', { p_job_id: job.id })
        const e = (ensured.body && typeof ensured.body === 'object' ? ensured.body : {}) as { ok?: boolean; error?: string; invoice_id?: string; amount?: number | string; fully_allocated?: boolean }
        if (!ensured.ok || e.error) return errored(e.error ?? restError(ensured.status, ensured.body))
        if (e.fully_allocated === true) return refused(`Nothing left to bill for ${jobLabel} — every dollar is already on an invoice.`, { target })
        if (e.ok !== true || typeof e.invoice_id !== 'string') return errored('ensure_single_ready_to_bill_invoice_for_job answered without an invoice_id.')
        const cents = moneyCents(e.amount)
        if (cents !== planned.bill.amount_cents) return refused(`The amount left to bill changed to ${billDollars(cents / 100)} since the plan (the plan said ${planned.bill.amount}) — review the bill, then plan again.`, { target })
        // (2) The Stripe bill, as the dev, in the mode the plan named.
        const made = await invokeAsDev(session, 'create-stripe-invoice', {
          jobs_ledger_invoice_id: e.invoice_id,
          customer_id: job.customer_id,
          amount_dollars: cents / 100,
          customer_email: (job.customer_email ?? '').trim(),
          customer_name: (job.customer_name ?? '').trim() || 'Customer',
          due_date: p.due_date,
          ...(p.memo ? { memo: p.memo } : {}),
          stripe_mode: p.stripe_mode,
        })
        const m = (made.body && typeof made.body === 'object' ? made.body : {}) as { error?: string; stripe_invoice_id?: string; hosted_invoice_url?: string }
        if (!made.ok || m.error) return errored(`create-stripe-invoice refused: ${m.error ?? restError(made.status, made.body)}. The Ready to Bill row stands, as in the app.`)
        // (3) The row as it landed, with its code.
        const back = await restGet(session, 'jobs_ledger_invoices', `select=id,job_id,status,amount,is_primary_rtb_bundle,stripe_invoice_id,hosted_invoice_url,pay_code,stripe_mode,billed_at,created_at&id=eq.${e.invoice_id}`)
        const row = (back.ok && Array.isArray(back.body) ? back.body[0] : null) as InvoiceRow | null
        if (!row) return errored(`The bill was made in Stripe (${m.stripe_invoice_id ?? 'id unknown'}) but its row could not be read back: ${back.ok ? 'no row' : restError(back.status, back.body)}.`)
        invoice = row
        // (4) The job to Billed when fully invoiced — the modal's promotion, best effort.
        const [invRes, payRes] = await Promise.all([restGet(session, 'jobs_ledger_invoices', `select=id,status,amount,is_primary_rtb_bundle&job_id=eq.${job.id}`), restGet(session, 'jobs_ledger_payments', `select=invoice_id,amount&job_id=eq.${job.id}`)])
        const invoices = (invRes.ok && Array.isArray(invRes.body) ? invRes.body : []) as InvoiceRow[]
        const payments = (payRes.ok && Array.isArray(payRes.body) ? payRes.body : []) as PaymentRow[]
        if (fullyInvoiced(job, invoices, payments)) {
          const moved = await restPost(session, 'rpc/update_job_status', { p_job_id: job.id, p_to_status: 'billed' })
          const mb = (moved.body && typeof moved.body === 'object' ? moved.body : {}) as { error?: string }
          status = moved.ok && !mb.error ? { moved: true, now: 'billed' } : { moved: false, now: job.status, why: mb.error ?? restError(moved.status, moved.body) }
        } else status = { moved: false, now: job.status, why: 'another Ready to Bill line remains' }
      } else invoice = world.invoice!
      // The code the share row mints on its first draw, when the function did not.
      if (!(invoice.pay_code ?? '').trim()) {
        const minted = await restPost(session, 'rpc/bill_pay_code', { p_invoice_id: invoice.id })
        if (minted.ok && typeof minted.body === 'string') invoice = { ...invoice, pay_code: minted.body }
      }
      const link = billTextLink({ invoiceId: invoice.id, payCode: invoice.pay_code, hostedInvoiceUrl: invoice.hosted_invoice_url ?? '' })
      // (5) and (6): the sends, each as the share row sends it, each refusal named and the bill left standing.
      let contactId = world.contactId
      const outcomes: { text: SendOutcome | null; email: SendOutcome | null } = { text: null, email: null }
      const needContact = planned.text || planned.email
      if (needContact && !contactId && job.customer_id) {
        const made = await restPost(session, 'rpc/contact_for_customer', { p_customer_id: job.customer_id })
        if (made.ok && typeof made.body === 'string') contactId = made.body
      }
      const tie = { jobId: job.id, column: BILL_TIE_COLUMN }
      if (planned.text) {
        if (!contactId) outcomes.text = { sent: false, to: planned.text.to, why: 'their contact could not be opened (contact_for_customer answered no id)' }
        else {
          const sent = await invokeAsDev(session, 'quo-send', { contactId, channelId: planned.text.channel_id, tie, body: withBillLink(planned.text.words, link), held: false })
          const b = (sent.body && typeof sent.body === 'object' ? sent.body : {}) as { ok?: boolean; messageId?: string | null; words?: string; error?: string }
          outcomes.text = sent.ok && b.ok !== false ? { sent: true, to: planned.text.to, message_id: b.messageId ?? null } : { sent: false, to: planned.text.to, why: b.words ?? b.error ?? restError(sent.status, sent.body) }
        }
      }
      if (planned.email) {
        if (!contactId) outcomes.email = { sent: false, to: planned.email.to, why: 'their contact could not be opened (contact_for_customer answered no id)' }
        else {
          const sent = await invokeAsDev(session, 'messages-email', { contactId, channelId: planned.email.channel_id, tie, subject: planned.email.subject, body: withBillLink(planned.email.body, link), signature: planned.email.signature })
          const b = (sent.body && typeof sent.body === 'object' ? sent.body : {}) as { ok?: boolean; messageId?: string | null; words?: string; error?: string }
          outcomes.email = sent.ok && b.ok !== false ? { sent: true, to: planned.email.to, message_id: b.messageId ?? null } : { sent: false, to: planned.email.to, why: b.words ?? b.error ?? restError(sent.status, sent.body) }
        }
      }
      return ok(billAppliedWords(p, jobLabel, { invoice_id: invoice.id, stripe_invoice_id: invoice.stripe_invoice_id, stripe_mode: invoice.stripe_mode, amount: billDollars(moneyCents(invoice.amount) / 100), link, pay_code: invoice.pay_code }, outcomes, status), { target: invoice.id })
    }
    case 'plan_collections_flag':
    case 'apply_collections_flag':
    case 'plan_contract_ended':
    case 'apply_contract_ended': {
      // v2.6795 (punch list #293, PR 4): two marks on a job — the Collections flag through the Job window's own
      // set_job_collections_flag, the contract's end as the Lien contract row saves it (one PATCH under RLS). No wrapper
      // RPC: the dry run is this server's read of the job (devMcpJobMarks.ts), hashed with the payload; apply reads again
      // and writes only when the hash still matches. Never as anyone else.
      if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)
      const built = writeRpcBody(name, args)
      if (!built.ok) return refused(built.error)
      const session = await jwt()
      const p = built.body.p as JobMarkPayload
      const reads: JobMarkReads = {
        rows: async (table, query) => {
          const res = await restGet(session, table, query)
          if (!res.ok) throw new Error(restError(res.status, res.body))
          return Array.isArray(res.body) ? (res.body as Record<string, unknown>[]) : []
        },
      }
      const errored = (text: string): Outcome => ({ log: { status: 'error', target: built.target, error: text }, text, isError: true })
      let job
      try {
        job = await readMarkJob(reads, p.job_id)
      } catch (e) {
        return errored(e instanceof Error ? e.message : String(e))
      }
      const dry = jobMarkDryRun(p, job, { userId: who.userId })
      if (!dry.ok) return refused(dry.refused, { target: built.target })
      const fresh = await planHash(name, p, dry.reply)
      if (built.step === 'plan') return ok(planReply(name, dry.reply, fresh), { target: built.target })
      if (fresh !== built.planHash) return refused(planMismatch(name, built.planHash ?? '', fresh), { target: built.target })
      const prior = await hooks.priorApply(name, fresh)
      if (prior) return refused(alreadyApplied(name, prior), { target: built.target })
      const label = jobLabelOf(job!)
      if (p.action === 'collections_flag') {
        const res = await restPost(session, `rpc/${COLLECTIONS_RPC}`, collectionsRpcBody(p))
        const body = (res.body && typeof res.body === 'object' ? res.body : {}) as { ok?: boolean; error?: string; flagged?: boolean }
        if (!res.ok || body.error) return errored(body.error ?? restError(res.status, res.body))
        return ok(jobMarkAppliedWords(p, label, { ok: true, detail: { rpc: body } }), { target: p.job_id })
      }
      const patch = contractEndedPatch(p, { userId: who.userId }, new Date().toISOString())
      const res = await restRows(session, 'PATCH', 'jobs_ledger', `id=eq.${p.job_id}`, patch)
      if (!res.ok) return errored(restError(res.status, res.body))
      // return=minimal says nothing about rows RLS kept: read the columns back.
      const back = await restGet(session, 'jobs_ledger', `select=${Object.keys(patch).join(',')}&id=eq.${p.job_id}`)
      const row = (back.ok && Array.isArray(back.body) ? back.body[0] : null) as Record<string, unknown> | null
      const landed = !!row && Object.entries(patch).every(([k, v]) => k === 'lien_contract_ended_set_at' || k === 'lien_retainage_held' ? row[k] != null || v == null : String(row[k] ?? '') === String(v ?? ''))
      if (!landed) return ok(jobMarkAppliedWords(p, label, { ok: false, error: 'This account could not change this job (RLS let no row through).' }), { target: p.job_id })
      return ok(jobMarkAppliedWords(p, label, { ok: true, detail: { row } }), { target: p.job_id })
    }
    case 'plan_sub_labor':
    case 'apply_sub_labor': {
      // v2.6944: a sub labor sheet through the screen's own rows as the dev under RLS — New Sub Labor's sheet, assignee
      // and line rows, the Edit window's save and its Delete. No wrapper RPC: the dry run is this server's read of the
      // job, the person, the job's sheets with their lines and payments and the job's allocated bank rows
      // (devMcpSubLabor.ts), hashed with the payload but for the profit band, which get_job's own kernels work out and
      // a cost elsewhere on the job may move. Apply reads again and writes only when the hash still matches. Never as
      // anyone else.
      if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)
      const built = writeRpcBody(name, args)
      if (!built.ok) return refused(built.error)
      const session = await jwt()
      const p = built.body.p as SubLaborPayload
      const reads: SubLaborReads = {
        rows: async (table, query) => {
          const res = await restGet(session, table, query)
          if (!res.ok) throw new Error(restError(res.status, res.body))
          return Array.isArray(res.body) ? (res.body as Record<string, unknown>[]) : []
        },
        // The profit band is shown on the plan only; the apply's hash does not hold it, so the apply skips the read.
        ...(built.step === 'plan'
          ? {
              money: async (jobId: string): Promise<JobMoney> => {
                const got = (await getJob(readerAs(session), jobId, todayYmdInAppTz())) as { refused?: string; money?: { error?: string; profit?: { laborCost: number; partsCost: number; totalBill: number; profit: number } } }
                if (got.refused) return { error: got.refused }
                if (!got.money?.profit) return { error: got.money?.error ?? 'the job\'s money could not be read' }
                return { profit: got.money.profit }
              },
            }
          : {}),
      }
      const errored = (text: string, target: string | null = built.target): Outcome => ({ log: { status: 'error', target, error: text }, text, isError: true })
      let world
      try {
        world = await readSubLaborWorld(reads, p, who.userId)
      } catch (e) {
        return errored(e instanceof Error ? e.message : String(e))
      }
      const dry = subLaborDryRun(p, world)
      if (!dry.ok) return refused(dry.refused, { target: built.target })
      const target = world.job?.id ?? built.target
      const fresh = await planHash(name, p, subLaborCommitment(dry.reply))
      if (built.step === 'plan') return ok(planReply(name, dry.reply, fresh), { target })
      if (fresh !== built.planHash) return refused(planMismatch(name, built.planHash ?? '', fresh), { target })
      const prior = await hooks.priorApply(name, fresh)
      if (prior) return refused(alreadyApplied(name, prior), { target })
      const label = world.job ? laborJobLabel(world.job) : 'no job'
      const noRow = 'RLS let no row through: this account cannot write this sheet.'
      let detail: Record<string, unknown>
      if (p.action === 'add') {
        const facts = laborPersonFacts(world.person!)
        if (!facts.ok || !world.job) return errored('The plan passed and the person or the job no longer reads. Plan again.', target)
        const made = await restRows(session, 'POST', 'people_labor_jobs', `select=${SHEET_COLS}`, sheetInsertRow(p, world.job, facts.person, world))
        if (!made.ok) return errored(restError(made.status, made.body), target)
        const sheet = (Array.isArray(made.body) ? made.body[0] : made.body) as SheetRow | null
        if (!sheet || typeof sheet.id !== 'string') return errored(`The insert answered with no row. ${noRow}`, target)
        // The form's backup to the name trigger: the assignee row by id, best effort as the form's is.
        if (facts.person.people_id) await restRows(session, 'POST', 'people_labor_job_assignees', 'on_conflict=labor_job_id,person_id', { labor_job_id: sheet.id, person_id: facts.person.people_id }, 'resolution=ignore-duplicates,return=minimal')
        const lines = await restRows(session, 'POST', 'people_labor_job_items', 'select=id', sheetItemRows(p.lines, p.stated).map((it) => ({ job_id: sheet.id, ...it })))
        if (!lines.ok || !Array.isArray(lines.body) || lines.body.length !== p.lines.length) {
          // A sheet with no lines is a $0 sheet in the ledger: take it off again, and say which way that went.
          const undone = await restDelete(session, 'people_labor_jobs', `id=eq.${sheet.id}`)
          const why = lines.ok ? noRow : restError(lines.status, lines.body)
          return errored(`${why} The lines did not land, so the sheet was ${undone.ok && undone.rows > 0 ? 'taken off again: nothing is written' : `left with no lines (${sheet.id}): take it off with plan_sub_labor { action: 'remove', sheet_id, reason }`}.`, target)
        }
        const tied = await restGet(session, 'people_labor_job_assignees', `select=person_id&labor_job_id=eq.${sheet.id}`)
        const tiedRows = tied.ok && Array.isArray(tied.body) ? tied.body.length : 0
        detail = {
          sheet_id: sheet.id,
          sheet: { who: sheet.assigned_to_name, day: sheet.job_date, job_number: sheet.job_number, stage: sheet.stage },
          lines: p.lines.length,
          tied_to_their_roster_row: tiedRows > 0,
          ...(tiedRows > 0 ? {} : { roster_warning: `No assignee row stands on the sheet: the name "${sheet.assigned_to_name}" did not resolve to one roster row. Their portal and get_hours_statement find a sheet by that row; People → Subs assigns the sheet to them.` }),
        }
      } else if (p.action === 'change') {
        const patch = (dry.reply.sheet_patch ?? {}) as Record<string, unknown>
        const landed: string[] = []
        if (dry.reply.replaces_lines === true && p.lines) {
          // The new lines first, then the old ones by id: a refusal part-way leaves the sheet's old lines standing.
          const old = world.items.filter((i) => i.job_id === p.sheet_id).map((i) => i.id)
          const made = await restRows(session, 'POST', 'people_labor_job_items', 'select=id', sheetItemRows(p.lines, p.stated).map((it) => ({ job_id: p.sheet_id, ...it })))
          if (!made.ok || !Array.isArray(made.body) || made.body.length !== p.lines.length) return errored(`${made.ok ? noRow : restError(made.status, made.body)} The new lines did not land; the sheet reads as it did.`, target)
          for (let i = 0; i < old.length; i += 80) {
            const gone = await restDelete(session, 'people_labor_job_items', `id=in.(${old.slice(i, i + 80).join(',')})`)
            if (!gone.ok) return errored(`${restError(gone.status, gone.body)} The new lines landed and the old ones are still there: the sheet reads double. Plan the change again; it replaces every line.`, target)
          }
          landed.push(`${p.lines.length} ${p.lines.length === 1 ? 'line' : 'lines'} in place of ${old.length}`)
        }
        if (Object.keys(patch).length) {
          const res = await restRows(session, 'PATCH', 'people_labor_jobs', `id=eq.${p.sheet_id}`, patch)
          if (!res.ok) return errored(`${restError(res.status, res.body)}${landed.length ? ` Written before that: ${landed.join(', ')}.` : ''}`, target)
          landed.push(`the sheet's ${Object.keys(patch).join(' and ')}`)
        }
        // return=minimal says nothing about rows RLS kept: read the sheet back.
        const back = await restGet(session, 'people_labor_jobs', `select=${SHEET_COLS}&id=eq.${p.sheet_id}`)
        const row = (back.ok && Array.isArray(back.body) ? back.body[0] : null) as SheetRow | null
        const asPlanned = !!row && Object.entries(patch).every(([k, v]) => (k === 'labor_rate' ? Number((row as unknown as Record<string, unknown>)[k]) === Number(v) : String((row as unknown as Record<string, unknown>)[k] ?? '') === String(v ?? '')))
        if (!asPlanned) return ok(subLaborAppliedWords(p, label, { ok: false, error: `${noRow}${landed.length ? ` Written before that: ${landed.join(', ')}.` : ''}` }), { target })
        detail = { sheet_id: p.sheet_id, landed, sheet: { who: row!.assigned_to_name, day: row!.job_date, sheet_rate: row!.labor_rate == null ? null : Number(row!.labor_rate) } }
      } else {
        const gone = await restDelete(session, 'people_labor_jobs', `id=eq.${p.sheet_id}`)
        if (!gone.ok) return errored(restError(gone.status, gone.body), target)
        if (gone.rows === 0) return ok(subLaborAppliedWords(p, label, { ok: false, error: noRow }), { target })
        detail = { sheet_id: p.sheet_id, removed: true }
      }
      // The note, the span and the stated mark's source where the team reads them: a note on the job's activity, as
      // plan_activity_note writes one. A note that fails never undoes the sheet; the reply says so.
      const noteBody = typeof dry.reply.note_on_activity === 'string' ? dry.reply.note_on_activity : null
      let note: { id: string } | { error: string } | null = null
      const noteJob = subLaborNoteJobId(p, world)
      if (noteBody && noteJob) {
        const made = await restRows(session, 'POST', 'jobs_ledger_thread_notes', 'select=id', { job_id: noteJob, author_user_id: who.userId, body: noteBody })
        const row = (Array.isArray(made.body) ? made.body[0] : made.body) as { id?: string } | null
        note = made.ok && row && typeof row.id === 'string' ? { id: row.id } : { error: made.ok ? 'the insert answered with no row' : restError(made.status, made.body) }
      }
      return ok(subLaborAppliedWords(p, label, { ok: true, detail, note }), { target })
    }
    case 'plan_sub_labor_payment':
    case 'apply_sub_labor_payment': {
      // v2.6944: what was paid against a sheet, through the screen's own door as the dev — Make Payment's row under RLS,
      // or the payment's Remove (remove_labor_job_payment, which keeps the trace). No wrapper RPC: the dry run is this
      // server's read of the sheet, its lines and payments, and the bank row with every job it is already allocated to
      // (devMcpSubLabor.ts), hashed with the payload. The bank row is read, never written. Never as anyone else.
      if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)
      const built = writeRpcBody(name, args)
      if (!built.ok) return refused(built.error)
      const session = await jwt()
      const p = built.body.p as SubLaborPaymentPayload
      const reads: SubLaborReads = {
        rows: async (table, query) => {
          const res = await restGet(session, table, query)
          if (!res.ok) throw new Error(restError(res.status, res.body))
          return Array.isArray(res.body) ? (res.body as Record<string, unknown>[]) : []
        },
      }
      const errored = (text: string, target: string | null = built.target): Outcome => ({ log: { status: 'error', target, error: text }, text, isError: true })
      let world
      try {
        world = await readSubLaborPaymentWorld(reads, p)
      } catch (e) {
        return errored(e instanceof Error ? e.message : String(e))
      }
      const dry = subLaborPaymentDryRun(p, world)
      if (!dry.ok) return refused(dry.refused, { target: built.target })
      const sheet = world.sheet!
      const target = sheet.id
      const fresh = await planHash(name, p, dry.reply)
      if (built.step === 'plan') return ok(planReply(name, dry.reply, fresh), { target })
      if (fresh !== built.planHash) return refused(planMismatch(name, built.planHash ?? '', fresh), { target })
      const prior = await hooks.priorApply(name, fresh)
      if (prior) return refused(alreadyApplied(name, prior), { target })
      const sheetOf = (sheet.assigned_to_name ?? '').trim() || 'this sheet'
      let detail: Record<string, unknown>
      if (p.action === 'record') {
        const made = await restRows(session, 'POST', 'people_labor_job_payments', `select=${SHEET_PAY_COLS}`, sheetPaymentInsertRow(p, world))
        if (!made.ok) return errored(restError(made.status, made.body), target)
        const row = (Array.isArray(made.body) ? made.body[0] : made.body) as SheetPayRow | null
        if (!row || typeof row.id !== 'string') return errored('The insert answered with no row — RLS let nothing through. This account cannot record a payment on this sheet.', target)
        detail = { payment: { id: row.id, amount: Number(row.amount), paid_on: row.payment_date, memo: row.memo, hidden_from_sub: row.hidden_from_sub === true } }
      } else {
        const res = await restPost(session, `rpc/${SHEET_PAYMENT_REMOVE_RPC}`, { p_payment_id: p.payment_id, p_reason: p.reason })
        if (!res.ok) return errored(restError(res.status, res.body), target)
        detail = { removed_payment_id: p.payment_id, trace_event_id: typeof res.body === 'string' ? res.body : null }
      }
      const back = await restGet(session, 'people_labor_job_payments', `select=amount&job_id=eq.${sheet.id}&limit=1000`)
      const bal = back.ok && Array.isArray(back.body) ? sheetBalance(sheetOwedCents(sheet.labor_rate, world.items), back.body as { amount: number | string }[]) : null
      return ok(subLaborPaymentAppliedWords(p, sheetOf, { ok: true, detail, after: bal ? { paid: bal.paid / 100, open: bal.open / 100 } : null }), { target })
    }
    case 'plan_property_record':
    case 'apply_property_record': {
      // v2.6950: a property record's lien facts, as the Property record row, Edit customer's Properties and the Lien
      // desk's property window save them — one PATCH on customer_addresses under RLS. No wrapper RPC: the dry run is
      // this server's read of the record, the jobs linked to it and the owner the named job keeps for itself
      // (devMcpPropertyRecord.ts), hashed with the payload; apply reads again and writes only when the hash still
      // matches. Never as anyone else.
      if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)
      const built = writeRpcBody(name, args)
      if (!built.ok) return refused(built.error)
      const session = await jwt()
      const p = built.body.p as PropertyRecordPayload
      const reads: PropertyReads = {
        rows: async (table, query) => {
          const res = await restGet(session, table, query)
          if (!res.ok) throw new Error(restError(res.status, res.body))
          return Array.isArray(res.body) ? (res.body as Record<string, unknown>[]) : []
        },
      }
      const errored = (text: string): Outcome => ({ log: { status: 'error', target: built.target, error: text }, text, isError: true })
      let world
      try {
        world = await readPropertyWorld(reads, p)
      } catch (e) {
        return errored(e instanceof Error ? e.message : String(e))
      }
      const dry = propertyRecordDryRun(p, world)
      if (!dry.ok) return refused(dry.refused, { target: built.target })
      const fresh = await planHash(name, p, dry.reply)
      if (built.step === 'plan') return ok(planReply(name, dry.reply, fresh), { target: built.target })
      if (fresh !== built.planHash) return refused(planMismatch(name, built.planHash ?? '', fresh), { target: built.target })
      const prior = await hooks.priorApply(name, fresh)
      if (prior) return refused(alreadyApplied(name, prior), { target: built.target })
      const record = world.record!
      const recordId = String(record.id)
      const address = typeof record.address === 'string' ? record.address : ''
      const patch = propertyPatch(p.set, record)
      const body = propertyPatchBody(patch, new Date().toISOString())
      const res = await restRows(session, 'PATCH', 'customer_addresses', `id=eq.${recordId}`, body)
      if (!res.ok) return errored(restError(res.status, res.body))
      // return=minimal says nothing about rows RLS kept: read the record back, whole.
      const back = await restGet(session, 'customer_addresses', `select=*&id=eq.${recordId}`)
      const row = (back.ok && Array.isArray(back.body) ? back.body[0] : null) as Record<string, unknown> | null
      const landed = !!row && patch.changes.every((c) => row[c.column] === c.after) && patch.stamps.every((stamp) => row[stamp] != null)
      if (!landed) return ok(propertyRecordAppliedWords(address, [], { ok: false, error: 'This account could not change this property record (RLS let no row through).' }), { target: recordId })
      const changed = [...patch.changes.map((c) => c.column), ...patch.stamps.filter((stamp) => stamp !== 'updated_at')]
      const shown: Record<string, unknown> = {}
      for (const column of changed) shown[column] = row![column]
      return ok(propertyRecordAppliedWords(address, changed, { ok: true, row: shown, reading: propertyLienReading(row!) }), { target: recordId })
    }
    case 'plan_job_payment':
    case 'apply_job_payment': {
      // v2.6940: a payment on a job through the screen's own doors as the dev — the remove RPC behind the Job window's
      // Remove, the payments table's own row, Accounts Receivable's link. No wrapper RPC: the dry run is this server's
      // read of the job, its payment rows, its bills and the bank row (devMcpJobPayment.ts), hashed with the payload;
      // apply reads again and writes only when the hash still matches. Never as anyone else.
      if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)
      const built = writeRpcBody(name, args)
      if (!built.ok) return refused(built.error)
      const session = await jwt()
      const p = built.body.p as JobPaymentPayload
      const reads: JobPaymentReads = {
        rows: async (table, query) => {
          const res = await restGet(session, table, query)
          if (!res.ok) throw new Error(restError(res.status, res.body))
          return Array.isArray(res.body) ? (res.body as Record<string, unknown>[]) : []
        },
      }
      const errored = (text: string, target: string | null = built.target): Outcome => ({ log: { status: 'error', target, error: text }, text, isError: true })
      let world
      try {
        world = await readJobPaymentWorld(reads, p)
      } catch (e) {
        return errored(e instanceof Error ? e.message : String(e))
      }
      const dry = jobPaymentDryRun(p, world)
      if (!dry.ok) return refused(dry.refused, { target: built.target })
      const target = world.job!.id
      const fresh = await planHash(name, p, dry.reply)
      if (built.step === 'plan') return ok(planReply(name, dry.reply, fresh), { target })
      if (fresh !== built.planHash) return refused(planMismatch(name, built.planHash ?? '', fresh), { target })
      const prior = await hooks.priorApply(name, fresh)
      if (prior) return refused(alreadyApplied(name, prior), { target })
      const label = payJobLabel(world.job!)
      const asObject = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
      let detail: Record<string, unknown>
      if (p.action === 'remove') {
        const res = await restPost(session, `rpc/${PAYMENT_REMOVE_RPC}`, { p_payment_id: p.payment_id })
        const body = asObject(res.body)
        if (!res.ok || (typeof body.error === 'string' && body.error)) return errored(typeof body.error === 'string' && body.error ? body.error : restError(res.status, res.body), target)
        detail = { rpc: body }
      } else if (p.action === 'record') {
        const made = await restRows(session, 'POST', 'jobs_ledger_payments', `select=${PAY_ROW_COLS}`, paymentInsertRow(p, world))
        if (!made.ok) return errored(restError(made.status, made.body), target)
        const row = (Array.isArray(made.body) ? made.body[0] : made.body) as PayRow | null
        if (!row || typeof row.id !== 'string') return errored('The insert answered with no row — RLS let nothing through. This account cannot record a payment on this job.', target)
        detail = { payment: paymentLine(row) }
      } else {
        const patch = paymentWordsPatch(p, world.row!)
        const landed: string[] = []
        if (Object.keys(patch).length) {
          const res = await restRows(session, 'PATCH', 'jobs_ledger_payments', `id=eq.${p.payment_id}`, patch)
          if (!res.ok) return errored(restError(res.status, res.body), target)
          landed.push(`the row's words: ${Object.keys(patch).join(', ')}`)
        }
        if (p.mercury_transaction_id) {
          const res = await restPost(session, `rpc/${PAYMENT_LINK_RPC}`, paymentLinkRpcBody(p, world.row!))
          const body = asObject(res.body)
          if (!res.ok || (typeof body.error === 'string' && body.error)) {
            const why = typeof body.error === 'string' && body.error ? body.error : restError(res.status, res.body)
            return errored(landed.length ? `${why} The link did not land; ${landed.join(', ')} had been written before it was refused.` : why, target)
          }
          landed.push('tied to the bank row')
        }
        // return=minimal says nothing about rows RLS kept: read the row back.
        const back = await restGet(session, 'jobs_ledger_payments', `select=${PAY_ROW_COLS}&id=eq.${p.payment_id}`)
        const row = (back.ok && Array.isArray(back.body) ? back.body[0] : null) as PayRow | null
        const asPlanned = !!row && Object.entries(patch).every(([k, v]) => String((row as unknown as Record<string, unknown>)[k] ?? '') === String(v ?? '')) && (!p.mercury_transaction_id || row.mercury_transaction_id === p.mercury_transaction_id)
        if (!asPlanned) return ok(jobPaymentAppliedWords(p, label, { ok: false, error: 'This account could not change this payment (RLS let no row through).' }), { target })
        detail = { payment: paymentLine(row!), landed }
      }
      // The reason where the team reads it: a note on the job's activity, as plan_activity_note writes one. A note
      // that fails never undoes the change; the reply says so.
      const noteBody = paymentNoteBody(p, world)
      let note: { id: string } | { error: string } | null = null
      if (noteBody) {
        const made = await restRows(session, 'POST', 'jobs_ledger_thread_notes', 'select=id', { job_id: target, author_user_id: who.userId, body: noteBody })
        const row = (Array.isArray(made.body) ? made.body[0] : made.body) as { id?: string } | null
        note = made.ok && row && typeof row.id === 'string' ? { id: row.id } : { error: made.ok ? 'the insert answered with no row' : restError(made.status, made.body) }
      }
      const backJob = await restGet(session, 'jobs_ledger', `select=payments_made,status&id=eq.${target}`)
      const jobRow = (backJob.ok && Array.isArray(backJob.body) ? backJob.body[0] : null) as { payments_made?: number | null; status?: string | null } | null
      return ok(jobPaymentAppliedWords(p, label, { ok: true, detail, after: jobRow ? { paid: jobRow.payments_made == null ? null : Number(jobRow.payments_made), status: jobRow.status ?? null } : null, note }), { target })
    }
    case 'plan_job_combine':
    case 'apply_job_combine': {
      // v2.6940: one job combined into another through Pipeline's own migrate_job_ledger_costs_and_delete, as the dev.
      // No wrapper RPC: the dry run is this server's read of both jobs, their payment rows and bills, the counts of what
      // would move and the RPC's holds worked out ahead (devMcpJobCombine.ts), hashed with the payload. The plan answers
      // with its stops; apply refuses while one stands, and never without confirm_no_undo. Never as anyone else.
      if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)
      const built = writeRpcBody(name, args)
      if (!built.ok) return refused(built.error)
      const session = await jwt()
      const p = built.body.p as JobCombinePayload
      const reads: JobCombineReads = {
        rows: async (table, query) => {
          const res = await restGet(session, table, query)
          if (!res.ok) throw new Error(restError(res.status, res.body))
          return Array.isArray(res.body) ? (res.body as Record<string, unknown>[]) : []
        },
        count: (table, query) => restCount(session, table, query),
      }
      const target = p.to_job_id
      const errored = (text: string): Outcome => ({ log: { status: 'error', target, error: text }, text, isError: true })
      let world
      try {
        world = await readJobCombineWorld(reads, p)
      } catch (e) {
        return errored(e instanceof Error ? e.message : String(e))
      }
      const dry = jobCombineDryRun(p, world)
      if (!dry.ok) return refused(dry.refused, { target })
      const fresh = await planHash(name, p, dry.reply)
      if (built.step === 'plan') return ok(planReply(name, dry.reply, fresh), { target })
      if (fresh !== built.planHash) return refused(planMismatch(name, built.planHash ?? '', fresh), { target })
      const stops = (dry.reply.stops as CombineStop[] | undefined) ?? []
      if (stops.length) return refused(`Nothing combined: ${stops.map((s) => `${s.words} ${s.fix}`).join(' ')} Plan again once each is put right.`, { target })
      const prior = await hooks.priorApply(name, fresh)
      if (prior) return refused(alreadyApplied(name, prior), { target })
      const labels = { source: payJobLabel(world.source.job!), target: payJobLabel(world.target.job!) }
      const res = await restPost(session, `rpc/${COMBINE_RPC}`, combineRpcBody(p))
      const body = (res.body && typeof res.body === 'object' && !Array.isArray(res.body) ? res.body : {}) as Record<string, unknown>
      if (!res.ok || body.ok !== true) {
        const why = typeof body.error === 'string' && body.error ? body.error : restError(res.status, res.body)
        return { log: { status: 'error', target, error: why }, text: replyText(jobCombineAppliedWords(labels, { ok: false, error: why })), isError: true }
      }
      const back = await restGet(session, 'jobs_ledger', `select=${COMBINE_JOB_COLS}&id=eq.${p.to_job_id}`)
      const row = (back.ok && Array.isArray(back.body) ? back.body[0] : null) as { revenue?: number | null; payments_made?: number | null; status?: string | null; pct_complete?: number | null; prior_numbers?: string[] | null } | null
      const after = row ? { job_total: Number(row.revenue ?? 0), paid: Number(row.payments_made ?? 0), status: row.status ?? null, status_words: jobStatusWords(row.status), pct_complete: row.pct_complete ?? null, prior_numbers: row.prior_numbers ?? [] } : null
      // #297: the box photos' files follow in Drive, as the Combine tab's finish asks. A failed ask never undoes the combine.
      const photos = combineBoxPhotos(world) > 0 ? refiledForSeat(p.to_job_id, await invokeAsDev(session, 'photo-save', { refile_box_photos: p.to_job_id })) : undefined
      return ok(jobCombineAppliedWords(labels, { ok: true, rpc: body, after, ...(photos ? { photos } : {}) }), { target })
    }
    case 'plan_bid_pricing':
    case 'apply_bid_pricing': {
      // v2.6992 (the bid train's PR 5b): a count row's price as the Pricing tab sets it, under RLS as the dev. The dry run
      // is this server's read of the bid's pricing (devMcpBidPrices.ts), hashed with the payload; apply reads again and
      // writes only when the hash still matches. Never as anyone else.
      if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)
      const built = writeRpcBody(name, args)
      if (!built.ok) return refused(built.error)
      const session = await jwt()
      const p = built.body.p as BidPricesPayload
      const reader = readerAs(session)
      const errored = (text: string): Outcome => ({ log: { status: 'error', target: built.target, error: text }, text, isError: true })
      let world
      try {
        world = await readBidPricesWorld(reader, p.bid_id)
      } catch (e) {
        return errored(e instanceof Error ? e.message : String(e))
      }
      const dry = bidPricesDryRun(p, world)
      if (!dry.ok) return refused(dry.refused, { target: built.target })
      const fresh = await planHash(name, p, dry.reply)
      if (built.step === 'plan') return ok(planReply(name, dry.reply, fresh), { target: built.target })
      if (fresh !== built.planHash) return refused(planMismatch(name, built.planHash ?? '', fresh), { target: built.target })
      const prior = await hooks.priorApply(name, fresh)
      if (prior) return refused(alreadyApplied(name, prior), { target: built.target })
      const label = (dry.reply.bid as { label: string }).label
      let rows = dry.reply.rows as PlanPrice[]
      let copyId: string | null = null
      const open = world.open!
      // A shared book: the bid's own copy first, as the tab takes it on its first price write, then plan again on the copy.
      if ((dry.reply.pricing as { copy_first: boolean }).copy_first) {
        const made = await restPost(session, 'rpc/clone_price_book_version_to_bid', { p_source_version_id: open.pricingId, p_bid_id: p.bid_id, p_name: open.name })
        if (!made.ok || typeof made.body !== 'string') return errored(`The bid's own copy of "${open.name}" could not be made, so nothing was written: ${made.ok ? 'the clone answered with no id' : restError(made.status, made.body)}`)
        copyId = made.body
        if (open.activeVersionId) await restRows(session, 'PATCH', 'price_book_versions', `id=eq.${copyId}`, { bid_version_id: open.activeVersionId })
        const star = await restRows(session, 'PATCH', 'bids', `id=eq.${p.bid_id}&select=id`, { selected_price_book_version_id: copyId }, 'return=representation')
        if (!star.ok || !Array.isArray(star.body) || star.body.length !== 1) return errored(`The copy ${copyId} was made, but the bid could not be pointed at it, so no price was written: ${star.ok ? 'the bid let no write through (RLS)' : restError(star.status, star.body)}. Plan again: the bid now has a copy of its own.`)
        if (open.activeVersionId) await restRows(session, 'PATCH', 'bid_versions', `id=eq.${open.activeVersionId}`, { starred_price_book_version_id: copyId })
        try {
          const again = bidPricesDryRun(p, await readBidPricesWorld(reader, p.bid_id))
          if (!again.ok) return errored(`The bid's own copy ${copyId} was made and is now its pricing, but planning on it refused: ${again.refused}`)
          rows = again.reply.rows as PlanPrice[]
        } catch (e) {
          return errored(`The bid's own copy ${copyId} was made, but it could not be read back: ${e instanceof Error ? e.message : String(e)}`)
        }
      }
      const failed: Array<{ n: number | null; what: string; why: string }> = []
      let priced = 0
      const one = (res: { ok: boolean; status: number; body: unknown }): string | null => (!res.ok ? restError(res.status, res.body) : Array.isArray(res.body) && res.body.length === 1 ? null : 'the row let no write through (RLS let no row back)')
      const dropCustom = async (id: string | null): Promise<void> => { if (id) await restRows(session, 'DELETE', 'bid_count_row_custom_prices', `id=eq.${id}`, null) }
      for (const r of rows) {
        if (r.status !== 'ready') continue
        const op = r.op as PriceOp
        let why: string | null
        if (op.kind === 'override') {
          why = one(await restRows(session, 'PATCH', 'bid_pricing_assignments', `id=eq.${op.assignment_id}&select=id`, { unit_price_override: op.value }, 'return=representation'))
          if (!why) await dropCustom(op.delete_custom_id)
        } else if (op.kind === 'assign') {
          why = one(await restRows(session, 'POST', 'bid_pricing_assignments', 'select=id', op.row))
          if (!why) await dropCustom(op.delete_custom_id)
        } else if (op.kind === 'custom_update') {
          why = one(await restRows(session, 'PATCH', 'bid_count_row_custom_prices', `id=eq.${op.custom_id}&select=id`, { unit_price: op.value }, 'return=representation'))
        } else if (op.kind === 'custom_insert') {
          why = one(await restRows(session, 'POST', 'bid_count_row_custom_prices', 'select=id', op.row))
        } else {
          why = one(await restRows(session, 'DELETE', 'bid_count_row_custom_prices', `id=eq.${op.custom_id}&select=id`, null, 'return=representation'))
        }
        if (why) failed.push({ n: r.n, what: r.reads, why })
        else priced += 1
      }
      let totalNow: string | null = null
      try {
        const now = await readBidPricesWorld(reader, p.bid_id)
        const total = now.bid ? await bidPricedTotal(reader, now.bid) : null
        if (total?.priced_revenue_usd != null) totalNow = `$${total.priced_revenue_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      } catch { /* the prices landed; the total is a courtesy */ }
      const held = (dry.reply.counts as { held: number }).held
      return ok(bidPricesAppliedWords(label, { copied: copyId, priced }, failed, held, totalNow), { target: p.bid_id })
    }
    case 'plan_bid_labor':
    case 'apply_bid_labor': {
      // v2.6976 (the bid train's PR 4): a bid's Labor tab, under RLS as the dev. No wrapper RPC: the dry run is this
      // server's read of the bid, its counts, the estimate, its rows and direct cost lines (devMcpBidLabor.ts), hashed
      // with the payload; apply reads again and writes only when the hash still matches. Never as anyone else.
      if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)
      const built = writeRpcBody(name, args)
      if (!built.ok) return refused(built.error)
      const session = await jwt()
      const p = built.body.p as BidLaborPayload
      const reads: LaborReads = {
        rows: async (table, query) => {
          const res = await restGet(session, table, query)
          if (!res.ok) throw new Error(restError(res.status, res.body))
          return Array.isArray(res.body) ? (res.body as Record<string, unknown>[]) : []
        },
      }
      const errored = (text: string): Outcome => ({ log: { status: 'error', target: built.target, error: text }, text, isError: true })
      let world
      try {
        world = await readBidLaborWorld(reads, p)
      } catch (e) {
        return errored(e instanceof Error ? e.message : String(e))
      }
      const dry = bidLaborDryRun(p, world)
      if (!dry.ok) return refused(dry.refused, { target: built.target })
      const fresh = await planHash(name, p, dry.reply)
      if (built.step === 'plan') return ok(planReply(name, dry.reply, fresh), { target: built.target })
      if (fresh !== built.planHash) return refused(planMismatch(name, built.planHash ?? '', fresh), { target: built.target })
      const prior = await hooks.priorApply(name, fresh)
      if (prior) return refused(alreadyApplied(name, prior), { target: built.target })
      const label = (dry.reply.bid as { label: string }).label
      const est = dry.reply.estimate as { id: string | null; made: boolean; patch: Record<string, unknown> }
      const failed: Array<{ what: string; why: string }> = []
      const done = { estimate_made: false, boxes: 0, rows_minted: 0, rows_changed: 0, direct_added: 0, direct_changed: 0, direct_removed: 0 }
      const rowsBack = (res: { ok: boolean; status: number; body: unknown }): number | string => (!res.ok ? restError(res.status, res.body) : Array.isArray(res.body) ? res.body.length : 0)
      // The estimate first, as the tab makes it on a counted bid: the rows below hang on its id.
      let estimateId = est.id
      if (!estimateId) {
        const made = await restRows(session, 'POST', 'cost_estimates', 'select=id', { bid_id: p.bid_id })
        const row = (Array.isArray(made.body) ? made.body[0] : null) as { id?: string } | null
        if (!made.ok || !row?.id) return errored(`The estimate could not be made, so nothing was written: ${made.ok ? 'the table let no row back (RLS)' : restError(made.status, made.body)}`)
        estimateId = row.id
        done.estimate_made = true
      }
      if (Object.keys(est.patch).length) {
        const got = rowsBack(await restRows(session, 'PATCH', 'cost_estimates', `id=eq.${estimateId}&select=id`, est.patch, 'return=representation'))
        if (got === 1) done.boxes = Object.keys(est.patch).length
        else failed.push({ what: `the estimate's boxes (${Object.keys(est.patch).join(', ')})`, why: typeof got === 'string' ? got : 'the estimate let no write through (RLS let no row back)' })
      }
      const planRows = dry.reply.rows as PlanLaborRow[]
      const mints = planRows.filter((r): r is Extract<PlanLaborRow, { status: 'mint' }> => r.status === 'mint')
      if (mints.length) {
        const got = rowsBack(await restRows(session, 'POST', 'cost_estimate_labor_rows', 'select=id', mints.map((m) => ({ ...m.row, cost_estimate_id: estimateId }))))
        if (typeof got === 'string') failed.push({ what: `${mints.length} new labor row${mints.length === 1 ? '' : 's'}`, why: got })
        else done.rows_minted = got
      }
      for (const r of planRows) {
        if (r.status !== 'change') continue
        const got = rowsBack(await restRows(session, 'PATCH', 'cost_estimate_labor_rows', `id=eq.${r.id}&select=id`, r.patch, 'return=representation'))
        if (got === 1) done.rows_changed += 1
        else failed.push({ what: r.reads, why: typeof got === 'string' ? got : 'the row let no write through (RLS let no row back)' })
      }
      for (const d of dry.reply.direct as PlanDirect[]) {
        if (d.status === 'add') {
          const got = rowsBack(await restRows(session, 'POST', d.table, 'select=id', { ...d.row, cost_estimate_id: estimateId }))
          if (got === 1) done.direct_added += 1
          else failed.push({ what: d.reads, why: typeof got === 'string' ? got : 'the table let no row back (RLS)' })
        } else if (d.status === 'change') {
          const got = rowsBack(await restRows(session, 'PATCH', d.table, `id=eq.${d.id}&select=id`, d.patch, 'return=representation'))
          if (got === 1) done.direct_changed += 1
          else failed.push({ what: d.reads, why: typeof got === 'string' ? got : 'the line let no write through (RLS let no row back)' })
        } else if (d.status === 'remove') {
          const got = rowsBack(await restRows(session, 'DELETE', d.table, `id=eq.${d.id}&select=id`, null, 'return=representation'))
          if (got === 1) done.direct_removed += 1
          else failed.push({ what: d.reads, why: typeof got === 'string' ? got : 'the line let no delete through (RLS let no row back)' })
        }
      }
      let costNow: Record<string, unknown> | null = null
      try {
        costNow = laborCostFromWorld(await readBidLaborWorld(reads, { ...p, estimate: {}, rows: [], direct: [] }))
      } catch { /* the rows landed; the cost is a courtesy */ }
      const counts = dry.reply.counts as { rows_held: number; direct_held: number }
      return ok(bidLaborAppliedWords(label, done, failed, counts.rows_held + counts.direct_held, costNow), { target: p.bid_id })
    }
    case 'plan_bid_takeoff':
    case 'apply_bid_takeoff': {
      // v2.6968 (the bid train's PR 3): a bid's takeoff as the Takeoffs tab holds it, under RLS as the dev. No wrapper RPC:
      // the dry run is this server's read of the bid, the active version's count rows and lines, the parts and their
      // lowest prices (devMcpBidTakeoff.ts), hashed with the payload; apply reads again and writes only when the hash
      // still matches. Never as anyone else.
      if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)
      const built = writeRpcBody(name, args)
      if (!built.ok) return refused(built.error)
      const session = await jwt()
      const p = built.body.p as BidTakeoffPayload
      const reads: TakeoffReads = {
        rows: async (table, query) => {
          const res = await restGet(session, table, query)
          if (!res.ok) throw new Error(restError(res.status, res.body))
          return Array.isArray(res.body) ? (res.body as Record<string, unknown>[]) : []
        },
      }
      const errored = (text: string): Outcome => ({ log: { status: 'error', target: built.target, error: text }, text, isError: true })
      let world
      try {
        world = await readBidTakeoffWorld(reads, p, { userId: who.userId })
      } catch (e) {
        return errored(e instanceof Error ? e.message : String(e))
      }
      const dry = bidTakeoffDryRun(p, world)
      if (!dry.ok) return refused(dry.refused, { target: built.target })
      const fresh = await planHash(name, p, dry.reply)
      if (built.step === 'plan') return ok(planReply(name, dry.reply, fresh), { target: built.target })
      if (fresh !== built.planHash) return refused(planMismatch(name, built.planHash ?? '', fresh), { target: built.target })
      const prior = await hooks.priorApply(name, fresh)
      if (prior) return refused(alreadyApplied(name, prior), { target: built.target })
      const planRows = dry.reply.rows as PlanTakeoffRow[]
      const label = (dry.reply.bid as { label: string }).label
      const failed: Array<{ n: number; what: string; why: string }> = []
      const done = { rows: 0, added: 0, changed: 0, removed: 0, costs_set: 0, costs_cleared: 0 }
      const rowsBack = (res: { ok: boolean; status: number; body: unknown }): number | string => (!res.ok ? restError(res.status, res.body) : Array.isArray(res.body) ? res.body.length : 0)
      // Row by row, in the tab's order of work: a replace clears the row first, then its lines, then its quoted cost.
      // A row that fails is named and the next row still goes on.
      for (const r of planRows) {
        if (r.status !== 'ready') continue
        const before = failed.length
        if (r.remove_line_ids.length) {
          const got = rowsBack(await restRows(session, 'DELETE', 'bids_takeoff_rough_part_lines', `id=in.(${r.remove_line_ids.join(',')})&select=id`, null, 'return=representation'))
          if (typeof got === 'string') {
            failed.push({ n: r.n, what: `${r.reads}: its lines were not removed, so nothing of the row was written`, why: got })
            continue
          }
          done.removed += got
        }
        const adds = r.lines.filter((l): l is Extract<PlanLine, { status: 'add' }> => l.status === 'add')
        if (adds.length) {
          const got = rowsBack(await restRows(session, 'POST', 'bids_takeoff_rough_part_lines', 'select=id', adds.map((l) => l.row)))
          if (typeof got === 'string') failed.push({ n: r.n, what: `${r.reads}: ${adds.length} new line${adds.length === 1 ? '' : 's'}`, why: got })
          else done.added += got
        }
        for (const l of r.lines) {
          if (l.status !== 'change') continue
          const got = rowsBack(await restRows(session, 'PATCH', 'bids_takeoff_rough_part_lines', `id=eq.${l.id}&select=id`, l.patch, 'return=representation'))
          if (got === 1) done.changed += 1
          else failed.push({ n: r.n, what: `${r.reads}: ${l.reads}`, why: typeof got === 'string' ? got : 'the line let no write through (RLS let no row back)' })
        }
        if (r.cost?.status === 'set') {
          const got = rowsBack(await restRows(session, 'POST', 'bid_count_row_custom_costs', 'on_conflict=bid_id,count_row_id&select=id', r.cost.row, 'resolution=merge-duplicates,return=representation'))
          if (got === 1) done.costs_set += 1
          else failed.push({ n: r.n, what: `${r.reads}: ${r.cost.reads}`, why: typeof got === 'string' ? got : 'the cost let no write through (RLS let no row back)' })
        } else if (r.cost?.status === 'clear') {
          const got = rowsBack(await restRows(session, 'DELETE', 'bid_count_row_custom_costs', `id=eq.${r.cost.id}&select=id`, null, 'return=representation'))
          if (got === 1) done.costs_cleared += 1
          else failed.push({ n: r.n, what: `${r.reads}: ${r.cost.reads}`, why: typeof got === 'string' ? got : 'the cost let no delete through (RLS let no row back)' })
        }
        if (failed.length === before) done.rows += 1
      }
      let materialsNow: string | null = null
      try {
        const now = await readBidTakeoffWorld(reads, { ...p, rows: [] }, { userId: who.userId })
        materialsNow = `$${materialsTotal(now.lines, now.countRows).total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      } catch { /* the lines landed; the total is a courtesy */ }
      const heldRows = (dry.reply.counts as { rows_held: number }).rows_held
      return ok(bidTakeoffAppliedWords(label, done, failed, heldRows, materialsNow), { target: p.bid_id })
    }
    case 'plan_bid_counts':
    case 'apply_bid_counts': {
      // v2.6967 (the bid train's PR 2): a bid's count rows as the Counts tab writes them, under RLS as the dev. No wrapper
      // RPC: the dry run is this server's read of the bid, its versions and the active version's rows (devMcpBidCounts.ts),
      // hashed with the payload; apply reads again and writes only when the hash still matches. Never as anyone else.
      if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)
      const built = writeRpcBody(name, args)
      if (!built.ok) return refused(built.error)
      const session = await jwt()
      const p = built.body.p as BidCountsPayload
      const reads: CountsReads = {
        rows: async (table, query) => {
          const res = await restGet(session, table, query)
          if (!res.ok) throw new Error(restError(res.status, res.body))
          return Array.isArray(res.body) ? (res.body as Record<string, unknown>[]) : []
        },
      }
      const errored = (text: string): Outcome => ({ log: { status: 'error', target: built.target, error: text }, text, isError: true })
      let world
      try {
        world = await readBidCountsWorld(reads, p)
      } catch (e) {
        return errored(e instanceof Error ? e.message : String(e))
      }
      const dry = bidCountsDryRun(p, world)
      if (!dry.ok) return refused(dry.refused, { target: built.target })
      const fresh = await planHash(name, p, dry.reply)
      if (built.step === 'plan') return ok(planReply(name, dry.reply, fresh), { target: built.target })
      if (fresh !== built.planHash) return refused(planMismatch(name, built.planHash ?? '', fresh), { target: built.target })
      const prior = await hooks.priorApply(name, fresh)
      if (prior) return refused(alreadyApplied(name, prior), { target: built.target })
      const planRows = dry.reply.rows as PlanRow[]
      const planRemoves = dry.reply.remove as PlanRemove[]
      const label = (dry.reply.bid as { label: string }).label
      const failed: Array<{ n: number | null; what: string; why: string }> = []
      const oneRow = (res: { ok: boolean; status: number; body: unknown }): string | null =>
        !res.ok ? restError(res.status, res.body) : Array.isArray(res.body) && res.body.length === 1 ? null : 'the row let no write through (RLS let no row back)'
      // The new rows: one insert, tagged as the sheet's own import so the bid's History reads them as one action.
      const adds = planRows.filter((r): r is Extract<PlanRow, { status: 'add' }> => r.status === 'add')
      let added = 0
      if (adds.length) {
        const res = await restRows(session, 'POST', 'bids_count_rows', 'select=id', adds.map((a) => a.row), undefined, { 'x-bid-action': COUNTS_INSERT_ACTION })
        added = res.ok && Array.isArray(res.body) ? res.body.length : 0
        if (!res.ok) for (const a of adds) failed.push({ n: a.n, what: a.reads, why: restError(res.status, res.body) })
        else if (added < adds.length) failed.push({ n: null, what: `${adds.length - added} of the new rows`, why: 'the table let them not through (RLS let no row back)' })
      }
      // Each changed row is the sheet's inline edit: its own write, so one that fails never stops the next.
      const changed: Array<{ n: number; reads: string }> = []
      for (const c of planRows) {
        if (c.status !== 'change') continue
        const why = oneRow(await restRows(session, 'PATCH', 'bids_count_rows', `id=eq.${c.id}&select=id`, c.patch, 'return=representation'))
        if (why) failed.push({ n: c.n, what: c.reads, why })
        else changed.push({ n: c.n, reads: c.reads })
      }
      const removed: Array<{ n: number; reads: string }> = []
      for (const r of planRemoves) {
        if (r.status !== 'remove') continue
        const why = oneRow(await restRows(session, 'DELETE', 'bids_count_rows', `id=eq.${r.id}&select=id`, null, 'return=representation'))
        if (why) failed.push({ n: r.n, what: r.reads, why })
        else removed.push({ n: r.n, reads: r.reads })
      }
      // The alternates join the bid's last, as the sheet's import and paste_counts write them: after the rows.
      const alt = dry.reply.alternates as { after: string[]; joined: string[] }
      let alternates: string[] = []
      if (alt.joined.length) {
        const why = oneRow(await restRows(session, 'PATCH', 'bids', `id=eq.${p.bid_id}&select=id`, { alternate_group_tags: alt.after }, 'return=representation'))
        if (why) failed.push({ n: null, what: `the alternates ${alt.joined.join(', ')}`, why })
        else alternates = alt.joined
      }
      let sheetNow: string | null = null
      try {
        const now = await readBidCountsWorld(reads, { ...p, rows: [], remove: [] })
        sheetNow = sheetSummaryWords(now.rows, now.bid?.alternate_group_tags ?? [])
      } catch { /* the rows landed; the totals are a courtesy */ }
      const heldInPlan = (dry.reply.counts as { held: number }).held
      return ok(bidCountsAppliedWords(label, { added, changed, removed, alternates }, failed, heldInPlan, sheetNow), { target: p.bid_id })
    }
    case 'plan_bid_update':
    case 'apply_bid_update': {
      // v2.6945 (the bid train's PR 1): a bid changed as Edit Bid and the Bid Board change it — the form's columns as one
      // PATCH on bids under RLS as the dev, then the line the form leaves on the bid's notes when the outcome moves. No
      // wrapper RPC: the dry run is this server's read of the bid, its versions, the jobs that point at it and every row
      // a new id names (devMcpBidUpdate.ts), hashed with the payload; apply reads again and writes only when the hash
      // still matches. Never as anyone else.
      if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)
      const built = writeRpcBody(name, args)
      if (!built.ok) return refused(built.error)
      const session = await jwt()
      const p = built.body.p as BidUpdatePayload
      const reads: BidReads = {
        rows: async (table, query) => {
          const res = await restGet(session, table, query)
          if (!res.ok) throw new Error(restError(res.status, res.body))
          return Array.isArray(res.body) ? (res.body as Record<string, unknown>[]) : []
        },
      }
      const errored = (text: string): Outcome => ({ log: { status: 'error', target: built.target, error: text }, text, isError: true })
      let world
      try {
        world = await readBidUpdateWorld(reads, p, { userId: who.userId, name: who.name, email: who.email })
      } catch (e) {
        return errored(e instanceof Error ? e.message : String(e))
      }
      const dry = bidUpdateDryRun(p, world)
      if (!dry.ok) return refused(dry.refused, { target: built.target })
      const fresh = await planHash(name, p, dry.reply)
      if (built.step === 'plan') return ok(planReply(name, dry.reply, fresh), { target: built.target })
      if (fresh !== built.planHash) return refused(planMismatch(name, built.planHash ?? '', fresh), { target: built.target })
      const prior = await hooks.priorApply(name, fresh)
      if (prior) return refused(alreadyApplied(name, prior), { target: built.target })
      const bid = world.bid!
      const patch = dry.reply.patch as Record<string, unknown>
      const planned = dry.reply.changes as BidChange[]
      const res = await restRows(session, 'PATCH', 'bids', `id=eq.${bid.id}`, patch)
      if (!res.ok) return errored(restError(res.status, res.body))
      // return=minimal says nothing about a row RLS kept: read the bid back and say what landed.
      const backColumns = [...new Set(['id', 'bid_number', 'project_name', 'outcome', 'bid_date_sent', 'loss_category', ...Object.keys(patch)])]
      const back = await restGet(session, 'bids', `select=${backColumns.join(',')}&id=eq.${bid.id}`)
      const row = (back.ok && Array.isArray(back.body) ? back.body[0] : null) as Record<string, unknown> | null
      const landed = bidUpdateLanded(planned, row)
      // The outcome line goes on after the row, as the form leaves it; a line the notes refuse never undoes the change.
      const noteLine = typeof dry.reply.note_line === 'string' ? dry.reply.note_line : null
      let note: { asked: boolean; saved: boolean; why?: string | null } = { asked: false, saved: false }
      if (noteLine && landed.changes.some((c) => c.column === 'outcome')) {
        const made = await restRows(session, 'POST', 'bids_submission_entries', 'select=id', outcomeNoteRow(bid.id, noteLine, { userId: who.userId }, new Date().toISOString()))
        note = made.ok ? { asked: true, saved: true } : { asked: true, saved: false, why: restError(made.status, made.body) }
      }
      return ok(bidUpdateAppliedWords(bid, landed, note, row), { target: bid.id })
    }
    case 'plan_submittal_rows':
    case 'apply_submittal_rows':
    case 'plan_submittal_log':
    case 'apply_submittal_log': {
      // v2.6804: submittal rows and the order log's facts, as Bids → Submittals writes them (BidsSubmittalsTab saveItem,
      // SubmittalProcurementPanel write) — rows of bid_submittals, bid_submittal_items and bid_procurement_items under
      // RLS as the dev. No RPC: the dry run is this server's read of the bid's submittal world through the tab's own
      // kernels (devMcpSubmittals.ts), hashed with the payload; apply reads again and writes only when the hash still
      // matches. The writes are rows, one at a time, as on the tab: what lands stays and what fails is named.
      if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)
      const built = writeRpcBody(name, args)
      if (!built.ok) return refused(built.error)
      const session = await jwt()
      const p = built.body.p as SubmittalPayload
      let world
      try {
        world = await readSubmittalWorld(readerAs(session), p.bid)
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        return { log: { status: 'error', target: built.target, error: message }, text: message, isError: true }
      }
      if ('refused' in world) return refused(world.refused, { target: built.target })
      const target = world.bid.id
      const dry = submittalDryRun(p, world, todayYmdInAppTz())
      if (!dry.ok) return refused(dry.refused, { target })
      const fresh = await planHash(name, p, dry.reply)
      if (built.step === 'plan') return ok(planReply(name, dry.reply, fresh), { target })
      if (fresh !== built.planHash) return refused(planMismatch(name, built.planHash ?? '', fresh), { target })
      const prior = await hooks.priorApply(name, fresh)
      if (prior) return refused(alreadyApplied(name, prior), { target })
      const landed: string[] = []
      const failed: Array<{ what: string; why: string }> = []
      let revisionId = ((dry.reply.revision as { id?: string | null } | undefined)?.id as string | null | undefined) ?? null
      for (const w of submittalWrites(dry.reply, { userId: who.userId })) {
        if (w.kind === 'make_revision') {
          const made = await restRows(session, 'POST', w.table, 'select=id,rev_number', w.body)
          const row = (Array.isArray(made.body) ? made.body[0] : made.body) as { id?: string } | null
          if (!made.ok || !row || typeof row.id !== 'string') {
            // No revision, no rows: nothing after this could land, so the apply stops here and says why.
            const message = made.ok ? 'The insert answered with no row — RLS let nothing through. This account cannot start a submittal on this bid.' : restError(made.status, made.body)
            return { log: { status: 'error', target, error: message }, text: message, isError: true }
          }
          revisionId = row.id
          landed.push('Rev 1 made as a draft')
        } else if (w.kind === 'insert_rows') {
          if (!revisionId) {
            failed.push({ what: `${w.body.length} rows`, why: 'no revision to put them on' })
            continue
          }
          const res = await restRows(session, 'POST', w.table, 'select=id,tag', w.body.map((r) => ({ ...r, submittal_id: revisionId })))
          const rows = Array.isArray(res.body) ? (res.body as Array<{ tag?: string }>) : []
          if (res.ok && rows.length === w.body.length) landed.push(`${rows.length} ${rows.length === 1 ? 'row' : 'rows'} added: ${rows.map((r) => r.tag).join(', ')}`)
          else failed.push({ what: `${w.body.length} new rows`, why: res.ok ? `the insert answered with ${rows.length} of ${w.body.length} rows — RLS let the rest through as nothing` : restError(res.status, res.body) })
        } else if (w.kind === 'insert_line') {
          const res = await restRows(session, 'POST', w.table, 'select=id', w.body)
          if (res.ok && Array.isArray(res.body) && res.body.length === 1) landed.push(`${w.what}: its line made`)
          else failed.push({ what: w.what, why: res.ok ? 'the insert answered with no row — RLS let nothing through' : restError(res.status, res.body) })
        } else {
          const res = await restRows(session, 'PATCH', w.table, `id=eq.${w.id}`, w.body)
          if (res.ok) landed.push(`${w.what}: ${Object.keys(w.body).join(', ')}`)
          else failed.push({ what: w.what, why: restError(res.status, res.body) })
        }
      }
      const words = submittalAppliedWords(dry.reply, { landed, failed, revisionId })
      if (landed.length === 0) return { log: { status: 'error', target, error: failed.map((f) => `${f.what}: ${f.why}`).join('; ') }, text: replyText(words), isError: true }
      return ok(words, { target })
    }
    case 'plan_activity_note':
    case 'apply_activity_note': {
      // v2.6822: a note where the team reads it — a job's Job activity / notes (jobs_ledger_thread_notes, as the
      // Pipeline's Note press and useJobThreadNotes write it) or a bid's notes (bids_submission_entries with notes, as
      // the Bid Board's Notes popover writes it) — one row under RLS as the dev. No RPC: the dry run is this server's
      // read of the job or the bid and its latest lines (devMcpActivityNote.ts), hashed with the payload; apply reads
      // again and writes only when the hash still matches. It tells nobody. Never as anyone else.
      if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)
      const built = writeRpcBody(name, args)
      if (!built.ok) return refused(built.error)
      const session = await jwt()
      const p = built.body.p as ActivityNotePayload
      let world
      try {
        world = await readActivityNoteWorld(readerAs(session), p)
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        return { log: { status: 'error', target: built.target, error: message }, text: message, isError: true }
      }
      if ('refused' in world) return refused(world.refused, { target: built.target })
      const target = world.on === 'job' ? world.job.id : world.bid.id
      const me = { userId: who.userId, name: who.name }
      // v2.6948: no clock goes into the dry run. An undated bid note's planned row once carried the dry run's own
      // now in occurred_at, so the apply's second dry run hashed differently and no such note could be applied.
      const dry = activityNoteDryRun(p, world, me, todayYmdInAppTz())
      if (!dry.ok) return refused(dry.refused, { target })
      const fresh = await planHash(name, p, dry.reply)
      if (built.step === 'plan') return ok(planReply(name, dry.reply, fresh), { target })
      if (fresh !== built.planHash) return refused(planMismatch(name, built.planHash ?? '', fresh), { target })
      const prior = await hooks.priorApply(name, fresh)
      if (prior) return refused(alreadyApplied(name, prior), { target })
      const write = activityNoteRow(p, world, me, new Date().toISOString())
      const made = await restRows(session, 'POST', write.table, `select=${write.select}`, write.row)
      if (!made.ok) {
        const message = restError(made.status, made.body)
        return { log: { status: 'error', target, error: message }, text: message, isError: true }
      }
      const row = (Array.isArray(made.body) ? made.body[0] : made.body) as { id?: string; created_at?: string; occurred_at?: string } | null
      if (!row || typeof row.id !== 'string') return { log: { status: 'error', target, error: `${write.table} returned no row` }, text: 'The insert answered with no row — RLS let nothing through. This account cannot write on this thread.', isError: true }
      return ok(activityNoteAppliedWords(world, { id: row.id, at: row.created_at ?? row.occurred_at ?? null }), { target })
    }
    case 'plan_plan_set':
    case 'apply_plan_set':
    case 'plan_paper':
    case 'apply_paper': {
      // v2.6317 (punch list #239): a set of drawings or a paper on a plan part — the rows the job window's Plans
      // section writes (planSetsIo addSet / keepPaper / markPaperCame), as the dev under RLS, in the seat's own
      // grammar. No RPC: the dry run is this server's read of the part (devMcpPlanSets.ts), hashed with the payload;
      // apply reads again and writes only when the hash still matches. Never as anyone else.
      if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)
      const built = writeRpcBody(name, args)
      if (!built.ok) return refused(built.error)
      const session = await jwt()
      const p = built.body.p as PlanPartPayload
      const reads: PartReads = {
        rows: async (table, query) => {
          const res = await restGet(session, table, query)
          if (!res.ok) throw new Error(restError(res.status, res.body))
          return Array.isArray(res.body) ? (res.body as Record<string, unknown>[]) : []
        },
      }
      const world = await readPlanPartWorld(reads, p)
      const dry = planPartDryRun(p, world, todayYmdInAppTz())
      if (!dry.ok) return refused(dry.refused, { target: built.target })
      const fresh = await planHash(name, p, dry.reply)
      if (built.step === 'plan') return ok(planReply(name, dry.reply, fresh), { target: built.target })
      if (fresh !== built.planHash) return refused(planMismatch(name, built.planHash ?? '', fresh), { target: built.target })
      const prior = await hooks.priorApply(name, fresh)
      if (prior) return refused(alreadyApplied(name, prior), { target: built.target })
      const writes: PartWrites = {
        insert: async (table, row) => {
          const res = await restRows(session, 'POST', table, '', row)
          if (!res.ok) throw new Error(restError(res.status, res.body))
          const made = Array.isArray(res.body) ? res.body[0] : res.body
          if (!made || typeof made !== 'object') throw new Error(`${table} returned no row`)
          return made as Record<string, unknown>
        },
        update: async (table, query, patch) => {
          const res = await restRows(session, 'PATCH', table, query, patch)
          if (!res.ok) throw new Error(restError(res.status, res.body))
        },
        invoke: async (fn, body) => {
          // The lane's push, as the app's sendAsk invokes it: a push that does not go never fails the keep.
          try {
            const res = await fetch(`${env('SUPABASE_URL')}/functions/v1/${fn}`, { method: 'POST', headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: `Bearer ${session}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
            return { ok: res.ok, error: res.ok ? null : `${fn} answered ${res.status}: ${(await res.text()).slice(0, 200)}` }
          } catch (e) {
            return { ok: false, error: `${fn} could not be reached: ${e instanceof Error ? e.message : String(e)}` }
          }
        },
      }
      try {
        const reply = await planPartApply(writes, p, dry.reply, { userId: who.userId }, new Date().toISOString())
        return ok(reply, { target: typeof reply.part_id === 'string' ? reply.part_id : built.target })
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        return { log: { status: 'error', target: built.target, error: message }, text: message, isError: true }
      }
    }
    case 'plan_person_report':
    case 'apply_person_report': {
      // v2.6430: file or dismiss a waiting field report through the HR queue's own RPCs (file_person_report /
      // dismiss_person_report, is_dev() OR hr_agent), in the seat's grammar. No wrapper RPC: the dry run is this server's
      // read of the report as the dev (devMcpPersonReport.ts), hashed with the ask; apply reads it again and POSTs the RPC
      // the kernel names only when the hash still matches — a report filed, dismissed or edited since refuses. Never as
      // anyone else.
      if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)
      const built = writeRpcBody(name, args)
      if (!built.ok) return refused(built.error)
      const session = await jwt()
      const p = built.body.p as PersonReportPayload
      const fail = (status: number, body: unknown): Outcome => {
        const message = restError(status, body)
        return { log: { status: 'error', target: built.target, error: message }, text: message, isError: true }
      }
      const res = await restGet(session, 'person_reports', `select=${PERSON_REPORT_SELECT}&id=eq.${p.report_id}&limit=1`)
      if (!res.ok) return fail(res.status, res.body)
      const report = (Array.isArray(res.body) ? res.body[0] : undefined) as PersonReportRow | undefined
      if (!report) return refused(`No report ${p.report_id} — not a person_reports.id, or RLS hides it from you. read_rows on person_reports with status eq pending lists the queue.`, { target: built.target })
      const personRes = await restGet(session, 'people', `select=id,name&id=eq.${report.subject_person_id}&limit=1`)
      const person = personRes.ok && Array.isArray(personRes.body) ? ((personRes.body[0] as { id: string; name: string } | undefined) ?? null) : null
      const dry = personReportDryRun(p, report, person, calendarYmdInAppTzFromIso)
      if (!dry.ok) return refused(dry.refused, { target: built.target })
      const fresh = await planHash(name, p, dry.reply)
      if (built.step === 'plan') return ok(planReply(name, dry.reply, fresh), { target: built.target })
      if (fresh !== built.planHash) return refused(planMismatch(name, built.planHash ?? '', fresh), { target: built.target })
      const prior = await hooks.priorApply(name, fresh)
      if (prior) return refused(alreadyApplied(name, prior), { target: built.target })
      const call = personReportRpc(p)
      const out = await restPost(session, `rpc/${call.rpc}`, call.body)
      if (!out.ok) return fail(out.status, out.body)
      const reply = (redactSecrets(out.body) ?? {}) as Record<string, unknown>
      return ok({ ...reply, action: p.action, report_id: p.report_id, person: person ?? { id: report.subject_person_id, name: '' }, next: personReportAppliedWords(p, reply, person?.name ?? '') }, { target: built.target })
    }
    case 'plan_matter_open_person':
    case 'apply_matter_open_person': {
      // v2.6582 (punch list #269 PR 3b): open a matter on a person's HR file through the file's own RPC
      // (legal_person_matter_open, devs only, one matter a person), in the seat's grammar. No wrapper RPC: the dry run is
      // this server's read of the person — by people.id, then by a login's account_user_id — and of any matter standing on
      // them (devMcpPersonMatter.ts), hashed with the ask; a standing matter is refused at the plan with its id. Apply reads
      // again and POSTs the RPC only when the hash still matches — a matter opened since refuses. Never as anyone else.
      if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)
      const built = writeRpcBody(name, args)
      if (!built.ok) return refused(built.error)
      const session = await jwt()
      const p = built.body.p as PersonMatterPayload
      const fail = (status: number, body: unknown): Outcome => {
        const message = restError(status, body)
        return { log: { status: 'error', target: built.target, error: message }, text: message, isError: true }
      }
      const first = (body: unknown) => (Array.isArray(body) ? (body[0] as PersonMatterPersonRow | undefined) ?? null : null)
      const byId = await restGet(session, 'people', `select=${PERSON_MATTER_PERSON_SELECT}&id=eq.${p.person_id}&limit=1`)
      if (!byId.ok) return fail(byId.status, byId.body)
      let person = first(byId.body)
      if (!person) {
        const byLogin = await restGet(session, 'people', `select=${PERSON_MATTER_PERSON_SELECT}&account_user_id=eq.${p.person_id}&limit=1`)
        if (!byLogin.ok) return fail(byLogin.status, byLogin.body)
        person = first(byLogin.body)
      }
      let standing: PersonMatterStandingRow | null = null
      if (person) {
        const m = await restGet(session, 'legal_matters', `select=${PERSON_MATTER_STANDING_SELECT}&person_id=eq.${person.id}&limit=1`)
        if (!m.ok) return fail(m.status, m.body)
        standing = Array.isArray(m.body) ? ((m.body[0] as PersonMatterStandingRow | undefined) ?? null) : null
      }
      const dry = personMatterDryRun(p, person, standing, calendarYmdInAppTzFromIso)
      if (!dry.ok) return refused(dry.refused, { target: built.target })
      const fresh = await planHash(name, p, dry.reply)
      if (built.step === 'plan') return ok(planReply(name, dry.reply, fresh), { target: built.target })
      if (fresh !== built.planHash) return refused(planMismatch(name, built.planHash ?? '', fresh), { target: built.target })
      const prior = await hooks.priorApply(name, fresh)
      if (prior) return refused(alreadyApplied(name, prior), { target: built.target })
      const call = personMatterRpc(p, person!.id)
      const out = await restPost(session, `rpc/${call.rpc}`, call.body)
      if (!out.ok) return fail(out.status, out.body)
      const reply = (redactSecrets(out.body) ?? {}) as Record<string, unknown>
      if (typeof reply.error === 'string' && reply.error) return refused(reply.error, { target: built.target })
      return ok({ ...reply, person: { id: person!.id, name: person!.name }, next: personMatterAppliedWords(reply, person!.name) }, { target: typeof reply.matter_id === 'string' ? reply.matter_id : built.target })
    }
    case 'get_login_state': {
      // v2.6792: where getting a teammate online stands. The row and the roster row are read as you; the auth account's
      // stamps are read by id as the service role (authStateById), so the verb is a dev's alone — never through view_as.
      if (who.role !== 'dev') return refused('get_login_state is for devs: it reads the auth account\'s stamps, which no role sees in the app.', { target: 'users' })
      const ref = String(args.person ?? '')
      const read = await readAccount(await jwt(), ref)
      if (read.refused) return refused(read.refused, { target: ref })
      let auth: AuthState | null = null
      try {
        auth = read.user?.login_attached_at ? await hooks.authState(read.user.id) : null
      } catch (e) {
        return { log: { status: 'error', target: read.user?.id ?? ref, error: e instanceof Error ? e.message : String(e) }, text: `The auth account could not be read: ${e instanceof Error ? e.message : String(e)}`, isError: true }
      }
      const reading = loginStateReading(ref, read.user, read.person, auth, new Date().toISOString())
      return ok(reading, { target: read.user?.id ?? ref })
    }
    case 'plan_account':
    case 'apply_account': {
      // v2.6792 (punch list #260's seat door): a teammate's account made as the Hire form makes it, or renamed, its role or
      // address changed — through add_worker, invite-user, create-user and change-user-email as you, so every function's own
      // dev gate and rule holds. No wrapper RPC: the dry run is this server's read of the row, its roster row and who else
      // holds the name or the address (devMcpAccount.ts), hashed with the ask. Never as anyone else.
      if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)
      const built = writeRpcBody(name, args)
      if (!built.ok) return refused(built.error)
      const session = await jwt()
      const p = built.body.p as AccountPayload
      let world: AccountWorld
      if (p.new) {
        world = { user: null, person: null, ...(await readHolders(session, { exceptUserId: null, name: p.new.name, email: p.new.email })) }
      } else {
        const read = await readAccount(session, p.person ?? '')
        if (read.refused) return refused(read.refused, { target: built.target })
        world = { user: read.user, person: read.person, ...(await readHolders(session, { exceptUserId: read.user?.id ?? null, name: p.rename?.name ?? null, email: p.email ?? null })) }
      }
      const dry = accountDryRun(p, world, { userId: who.userId })
      if (!dry.ok) return refused(dry.refused, { target: built.target })
      const fresh = await planHash(name, p, dry.reply)
      if (built.step === 'plan') return ok(planReply(name, dry.reply, fresh), { target: built.target })
      if (fresh !== built.planHash) return refused(planMismatch(name, built.planHash ?? '', fresh), { target: built.target })
      const prior = await hooks.priorApply(name, fresh)
      if (prior) return refused(alreadyApplied(name, prior), { target: built.target })
      const steps: AccountStep[] = []
      const rowsOf = (body: unknown): number => (Array.isArray(body) ? body.length : 0)
      let userId: string | null = world.user?.id ?? null
      let personId: string | null = world.person?.id ?? null
      if (p.new) {
        const n = p.new
        // The person: the Hire form's three doors, one per sign_in.
        if (n.sign_in === 'none') {
          const made = await restPost(session, 'rpc/add_worker', addWorkerArgs(n))
          const ids = made.ok && made.body && typeof made.body === 'object' ? (made.body as { user_id?: unknown; person_id?: unknown }) : null
          if (!made.ok || typeof ids?.user_id !== 'string') return refused(`Nothing made: add_worker ${made.ok ? 'answered no ids' : restError(made.status, made.body)}`, { target: built.target })
          userId = ids.user_id
          personId = typeof ids.person_id === 'string' ? ids.person_id : null
          steps.push({ step: 'person', ok: true, words: `${n.name} is on the roster with no login (users ${userId}${personId ? `, people ${personId}` : ''}).` })
          if (n.training) {
            const t = await restRows(session, 'PATCH', 'users', `id=eq.${userId}`, { read_only: true }, 'return=representation')
            steps.push({ step: 'training_mode', ok: t.ok && rowsOf(t.body) === 1, words: t.ok && rowsOf(t.body) === 1 ? 'training mode on' : `training mode not set: ${fnWords(t)}` })
          }
        } else {
          const fn = n.sign_in === 'email' ? 'invite-user' : 'create-user'
          const r = await invokeAsDev(session, fn, createLoginBody(n, `${appOrigin()}/accept-invite`))
          const b = (r.body && typeof r.body === 'object' ? r.body : {}) as { user_id?: unknown; person_id?: unknown; user?: { id?: unknown; person_id?: unknown } }
          const madeId = typeof b.user_id === 'string' ? b.user_id : typeof b.user?.id === 'string' ? b.user.id : null
          if (!r.ok || !madeId) return refused(`Nothing made: ${fn} refused — ${fnWords(r)}`, { target: built.target })
          userId = madeId
          personId = typeof b.person_id === 'string' ? b.person_id : typeof b.user?.person_id === 'string' ? b.user.person_id : null
          steps.push({ step: n.sign_in === 'email' ? 'invite' : 'login', ok: true, words: n.sign_in === 'email' ? `the login is made and the invite email went to ${n.email} (users ${userId}${personId ? `, people ${personId}` : ''}).` : `the login is made on ${n.email} with the password you set (users ${userId}${personId ? `, people ${personId}` : ''}).` })
        }
        if (p.pay) {
          const pay = await restRows(session, 'POST', 'people_pay_config', 'on_conflict=person_name', payConfigRow(p.pay, n.name, personId), 'resolution=merge-duplicates,return=representation')
          steps.push({ step: 'pay', ok: pay.ok, words: pay.ok ? `the pay row reads ${p.pay.hourly_wage.toFixed(2)}/h${p.pay.is_salary ? ', salaried' : ''}.` : `the pay row was not written: ${fnWords(pay)}` })
          if (p.pay.is_salary && p.pay.workday_start && userId) {
            const tpl = await restRows(session, 'POST', 'salary_work_schedule_templates', 'on_conflict=user_id', salaryTemplateRow(userId, p.pay.workday_start, APP_CALENDAR_TZ), 'resolution=merge-duplicates,return=representation')
            steps.push({ step: 'workday', ok: tpl.ok, words: tpl.ok ? `the salaried workday is 8 hours from ${p.pay.workday_start}, weekdays; today's sessions appear with the next sync.` : `the workday template was not written: ${fnWords(tpl)}` })
          }
        }
      } else if (world.user) {
        const u = world.user
        if (p.rename) {
          const patch: Record<string, unknown> = {}
          if (p.rename.name !== undefined) patch.name = p.rename.name
          if (p.rename.title !== undefined) patch.title = p.rename.title
          if (p.rename.phone !== undefined) patch.phone = p.rename.phone
          const r = await restRows(session, 'PATCH', 'users', `id=eq.${u.id}`, patch, 'return=representation')
          const landed = r.ok && rowsOf(r.body) === 1
          steps.push({ step: 'rename', ok: landed, words: landed ? `the account reads ${JSON.stringify(p.rename.name ?? u.name)}${p.rename.title !== undefined ? `, title ${JSON.stringify(p.rename.title ?? '')}` : ''}${p.rename.phone !== undefined ? `, phone ${JSON.stringify(p.rename.phone ?? '')}` : ''}.` : `the row did not change: ${r.ok ? 'RLS let no row through' : fnWords(r)}` })
          if (landed && p.rename.name !== undefined) {
            const newName = p.rename.name
            if (world.person && world.person.name !== newName) {
              const pr = await restRows(session, 'PATCH', 'people', `id=eq.${world.person.id}`, { name: newName }, 'return=representation')
              steps.push({ step: 'roster_row', ok: pr.ok && rowsOf(pr.body) === 1, words: pr.ok && rowsOf(pr.body) === 1 ? `the roster row reads ${JSON.stringify(newName)}.` : `the roster row did not change: ${fnWords(pr)}` })
            }
            // The desk's cascade (renameAccount → cascadePersonNameInPayTables): every name this account went by, in every name-keyed table.
            const oldNames = [...new Set([u.name ?? '', world.person?.name ?? ''].map((s) => s.trim()).filter((s) => s && s !== newName))]
            let moved = 0
            const failed: string[] = []
            for (const old of oldNames) {
              for (const table of NAME_KEYED_PAY_TABLES) {
                const c = await restRows(session, 'PATCH', table, `person_name=eq.${encodeURIComponent(old)}`, { person_name: newName }, 'return=representation')
                if (c.ok) moved += rowsOf(c.body)
                else failed.push(`${table}: ${fnWords(c)}`)
              }
            }
            steps.push({ step: 'pay_rows', ok: failed.length === 0, words: failed.length === 0 ? `${moved} name-keyed pay and hours row${moved === 1 ? '' : 's'} follow${moved === 1 ? 's' : ''} the name.` : `${moved} rows followed; held: ${failed.join('; ')}` })
          }
        }
        if (p.role) {
          const r = await restRows(session, 'PATCH', 'users', `id=eq.${u.id}`, { role: p.role }, 'return=representation')
          const landed = r.ok && rowsOf(r.body) === 1
          steps.push({ step: 'set_role', ok: landed, words: landed ? `the role is ${p.role}.` : `the role did not change: ${r.ok ? 'RLS let no row through' : fnWords(r)}` })
        }
        if (p.email) {
          if (u.login_attached_at) {
            const r = await invokeAsDev(session, 'change-user-email', { user_id: u.id, email: p.email })
            steps.push({ step: 'set_email', ok: r.ok, words: r.ok ? `the login and the app's copy read ${p.email}.` : `the address did not change: ${fnWords(r)}` })
          } else {
            const r = await restRows(session, 'PATCH', 'users', `id=eq.${u.id}`, { email: p.email }, 'return=representation')
            const landed = r.ok && rowsOf(r.body) === 1
            steps.push({ step: 'set_email', ok: landed, words: landed ? `the row reads ${p.email} (no login yet; plan_login attaches one on it).` : `the address did not change: ${r.ok ? 'RLS let no row through' : fnWords(r)}` })
            if (landed && world.person) await restRows(session, 'PATCH', 'people', `id=eq.${world.person.id}`, { email: p.email })
          }
        }
      }
      const after = userId ? await readAccount(session, userId) : { user: null, person: null }
      const ref = after.user?.id ?? built.target ?? ''
      return ok({ steps, account: after.user ? accountFacts(after.user, after.person) : null, next: accountAppliedWords(steps, String(ref)) }, { target: after.user?.id ?? built.target })
    }
    case 'plan_login':
    case 'apply_login': {
      // v2.6792: the desk's Attach a login… and Remove the login… — create-user with user_id (the auth account made ON the row's
      // own id, attachLoginDoor.ts's rules) then send-sign-in-email, or detach-login — as you, in the seat's grammar. The dry run
      // is this server's read of the row; the functions' own dev gates and refusals hold besides.
      if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)
      const built = writeRpcBody(name, args)
      if (!built.ok) return refused(built.error)
      const session = await jwt()
      const p = built.body.p as LoginPayload
      const read = await readAccount(session, p.person)
      if (read.refused) return refused(read.refused, { target: built.target })
      const email = p.action === 'attach' ? (p.email ?? ((read.user?.email ?? '').toLowerCase() || null)) : null
      const holders = email ? await readHolders(session, { exceptUserId: read.user?.id ?? null, name: null, email }) : { emailHolder: null }
      const dry = loginDryRun(p, read.user, read.person, holders.emailHolder, { userId: who.userId })
      if (!dry.ok) return refused(dry.refused, { target: read.user?.id ?? built.target })
      const fresh = await planHash(name, p, dry.reply)
      if (built.step === 'plan') return ok(planReply(name, dry.reply, fresh), { target: read.user?.id ?? built.target })
      if (fresh !== built.planHash) return refused(planMismatch(name, built.planHash ?? '', fresh), { target: read.user?.id ?? built.target })
      const prior = await hooks.priorApply(name, fresh)
      if (prior) return refused(alreadyApplied(name, prior), { target: read.user?.id ?? built.target })
      const u = read.user!
      const who_ = (u.name ?? '').trim() || u.email || u.id
      let emailSent: boolean | null = null
      let sendWhy: string | null = null
      if (p.action === 'remove') {
        const r = await invokeAsDev(session, 'detach-login', { user_id: u.id })
        if (!r.ok) return refused(`Nothing removed: detach-login refused — ${fnWords(r)}`, { target: u.id })
      } else {
        const body: Record<string, unknown> = { user_id: u.id, email }
        if (p.mode === 'password') body.password = p.password
        const r = await invokeAsDev(session, 'create-user', body)
        if (!r.ok) return refused(`Nothing attached: create-user refused — ${fnWords(r)}`, { target: u.id })
        if (p.mode === 'email') {
          const s = await invokeAsDev(session, 'send-sign-in-email', { email, redirectTo: `${appOrigin()}/dashboard` })
          emailSent = s.ok
          if (!s.ok) sendWhy = fnWords(s)
        }
      }
      const after = await readAccount(session, u.id)
      let auth: AuthState | null = null
      try {
        auth = after.user?.login_attached_at ? await hooks.authState(u.id) : null
      } catch { /* the stamps are a courtesy here; get_login_state reads them again */ }
      return ok({ action: p.action, account: after.user ? accountFacts(after.user, after.person) : null, email, email_sent: emailSent, ...(sendWhy ? { email_not_sent_why: sendWhy } : {}), auth, next: loginAppliedWords(p, who_, emailSent) }, { target: u.id })
    }
    case 'plan_password_reset':
    case 'apply_password_reset': {
      // v2.6792: the app's own Forgot password email (resetPasswordForEmail, the sign-in page's) to a teammate's login, or a
      // password you dictate through set-user-password as you. The dry run reads the row and the auth account's stamps, so the
      // ten-minute rule between sends is the seat's own, read off recovery_sent_at.
      if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)
      const built = writeRpcBody(name, args)
      if (!built.ok) return refused(built.error)
      const session = await jwt()
      const p = built.body.p as PasswordResetPayload
      const read = await readAccount(session, p.person)
      if (read.refused) return refused(read.refused, { target: built.target })
      let auth: AuthState | null = null
      try {
        auth = read.user?.login_attached_at ? await hooks.authState(read.user.id) : null
      } catch (e) {
        return { log: { status: 'error', target: read.user?.id ?? built.target, error: e instanceof Error ? e.message : String(e) }, text: `The auth account could not be read: ${e instanceof Error ? e.message : String(e)}`, isError: true }
      }
      const dry = passwordResetDryRun(p, read.user, read.person, auth, { userId: who.userId }, new Date().toISOString())
      if (!dry.ok) return refused(dry.refused, { target: read.user?.id ?? built.target })
      const fresh = await planHash(name, p, dry.reply)
      if (built.step === 'plan') return ok(planReply(name, dry.reply, fresh), { target: read.user?.id ?? built.target })
      if (fresh !== built.planHash) return refused(planMismatch(name, built.planHash ?? '', fresh), { target: read.user?.id ?? built.target })
      const prior = await hooks.priorApply(name, fresh)
      if (prior) return refused(alreadyApplied(name, prior), { target: read.user?.id ?? built.target })
      const u = read.user!
      const who_ = (u.name ?? '').trim() || u.email || u.id
      if (p.mode === 'password') {
        const r = await invokeAsDev(session, 'set-user-password', { user_id: u.id, password: p.password })
        if (!r.ok) return refused(`Nothing set: set-user-password refused — ${fnWords(r)}`, { target: u.id })
      } else {
        // The sign-in page's own call: the anon client, no session — the auth server mails the link itself through the project's SMTP.
        const anon = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { auth: { autoRefreshToken: false, persistSession: false } })
        const { error } = await anon.auth.resetPasswordForEmail(u.email!, { redirectTo: `${appOrigin()}/reset-password-confirm` })
        if (error) return refused(`Nothing sent: the auth server refused the reset email — ${error.message}`, { target: u.id })
      }
      let authAfter: AuthState | null = auth
      try {
        authAfter = await hooks.authState(u.id)
      } catch { /* the stamps are a courtesy here */ }
      return ok({ action: p.mode === 'email' ? 'send_reset_email' : 'set_password', account: accountFacts(u, read.person), email: u.email, sent_at: p.mode === 'email' ? authAfter?.recovery_sent_at ?? null : null, auth: authAfter, next: passwordResetAppliedWords(p, who_, u.email, p.mode === 'email' ? authAfter?.recovery_sent_at ?? null : null) }, { target: u.id })
    }
    case 'read_file_index_status': {
      // v2.6332 (punch list #240, PR 2): one GET of the dev-gated RPC as you; the reading line opens the reply.
      const res = await restGet(await jwt(), 'rpc/dev_file_index_status', '')
      if (!res.ok) {
        const message = restError(res.status, res.body)
        return { log: { status: 'error', target: 'dev_file_index_status', error: message }, text: message, isError: true }
      }
      const body = res.body && typeof res.body === 'object' && !Array.isArray(res.body) ? (res.body as Record<string, unknown>) : { data: res.body }
      if (typeof body.refused === 'string') return refused(body.refused, { target: 'dev_file_index_status' })
      return ok({ reading: statusReading(body), ...body }, { target: 'dev_file_index_status' })
    }
    case 'plan_index_backfill':
    case 'apply_index_backfill': {
      // v2.6332 (punch list #240, PR 2): the agent's one-time backfill of file_index. The plan lists the jobs a scope
      // walks and commits to them under a hash; the apply runs the one index pass (_shared/fileIndex.ts, the same
      // code under drive-link's index_job and the sweep) over one job's next files per call, as the service role into
      // our own table and never into Drive, and hands back the cursor. The plan's hash is checked on every apply; an
      // apply may run as often as files remain, so priorApply is not consulted here.
      if (who.role !== 'dev') return refused(`${name} runs only as you, with a dev's own key.`)
      const parsed = parseBackfillPlan(args.plan)
      if (!parsed.ok) return refused(parsed.error)
      const plan = parsed.plan
      const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { autoRefreshToken: false, persistSession: false } })
      if (plan.scope === 'person') {
        // v2.6721 (punch list #285, PR 3): one person's files through the records pass, not a Drive walk. The plan lists
        // every file the person carries (the attachments on their HR file, the documents on their matter) with which
        // the index has read, and commits to that list; the apply runs the pass over the person until the queue is empty.
        const personId = plan.person_id!
        const { data: personRow } = await admin.from('people').select('id, name').eq('id', personId).maybeSingle()
        const person = personRow as { id: string; name: string } | null
        if (!person) return refused(`No person has the id the plan names (${personId}).`)
        const [{ data: attRows, error: attErr }, { data: matterRows }] = await Promise.all([
          admin.from('person_file_attachments').select('id, filename, storage_path, drive_file_id, evidence_id, entry_id').eq('person_id', personId).order('created_at', { ascending: false }).limit(2000),
          admin.from('legal_matters').select('id').eq('person_id', personId),
        ])
        if (attErr) return refused(`The person's files did not read: ${attErr.message}`)
        const matterIds = ((matterRows ?? []) as { id: string }[]).map((m) => m.id)
        const { data: docRows } = matterIds.length > 0 ? await admin.from('legal_matter_documents').select('id, title, original_name, storage_path').in('matter_id', matterIds).is('voided_at', null).limit(2000) : { data: [] }
        const atts = (attRows ?? []) as { id: string; filename: string; storage_path: string | null; drive_file_id: string | null; evidence_id: string | null; entry_id: string | null }[]
        const docs = (docRows ?? []) as { id: string; title: string; original_name: string; storage_path: string }[]
        const allIds = [...atts.map((a) => a.id), ...docs.map((d) => d.id)]
        const hash = await sha256Hex(JSON.stringify(personBackfillCommitment(plan, allIds)))
        const target = `person:${personId}`
        if (name === 'plan_index_backfill') {
          // Which files the index has read: every row on the person, then the queue (a row held an hour on counts as held).
          const rowsById = new Map<string, { text_why: string | null }>()
          for (let from = 0; ; from += 1000) {
            const { data } = await admin.from('file_index').select('source_id, text_why').eq('person_id', personId).neq('source', 'drive').order('drive_file_id').range(from, from + 999)
            const rows = (data ?? []) as { source_id: string; text_why: string | null }[]
            for (const r of rows) rowsById.set(r.source_id, r)
            if (rows.length < 1000) break
          }
          const dueNow = (await recordsDue(admin, 500, { personId })) ?? []
          const dueIds = new Set(dueNow.map((r) => r.source_id))
          const heldIds = new Set(dueNow.filter((r) => r.held).map((r) => r.source_id))
          const titles = new Map<string, string | null>()
          const evidenceIds = [...new Set(atts.map((a) => a.evidence_id).filter((x): x is string => Boolean(x)))]
          if (evidenceIds.length > 0) {
            const { data: ev } = await admin.from('person_file_evidence').select('id, title').in('id', evidenceIds)
            for (const e of (ev ?? []) as { id: string; title: string }[]) titles.set(e.id, e.title)
          }
          const state = (id: string): PersonBackfillFile['state'] => (heldIds.has(id) ? 'held' : dueIds.has(id) ? 'due' : rowsById.has(id) ? 'read' : 'due')
          const files: PersonBackfillFile[] = [
            ...atts.map((a) => ({ id: a.id, source: 'hr_attachment' as const, name: a.filename, record_kind: a.evidence_id ? 'evidence' : a.entry_id ? 'entry' : 'file', record_title: a.evidence_id ? titles.get(a.evidence_id) ?? null : null, where: recordBytesWhere(a), state: state(a.id) })),
            ...docs.map((d) => ({ id: d.id, source: 'matter_document' as const, name: d.original_name || d.title, record_kind: 'matter_document', record_title: d.title, where: recordBytesWhere({ storage_path: d.storage_path, drive_file_id: null }), state: state(d.id) })),
          ]
          return ok({ plan_hash: hash, ...personBackfillPlanReply(plan, person, files) }, { target })
        }
        const quoted = typeof args.plan_hash === 'string' ? args.plan_hash.trim().toLowerCase() : ''
        if (!quoted) return refused('apply_index_backfill needs plan_hash — the value plan_index_backfill replied with.')
        if (quoted !== hash) return refused(`Nothing indexed: the plan you quoted (${quoted.slice(0, 12)}…) is not what this person's files give now (${hash.slice(0, 12)}…) — a file was filed or removed since. Call plan_index_backfill again and read it.`, { target })
        const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON') ?? null
        const pass = await recordsPass(admin, { n: recordsBatch(args.batch), personId, retry: plan.retry, dropGone: true, google: async () => (saJson ? await googleAccessToken(saJson) : null) })
        return ok(personBackfillApplyReply(person, pass, allIds.length), { target, rowCount: pass.indexed })
      }
      const q = backfillJobsQuery(plan)
      // The walk's order is created_at then id, a total order: a job number ties on '' for every click-only job, and a
      // tie would place the cursor differently on every read. The plan's own after_job starts the list after that job,
      // read fresh so a job that left the scope still places it.
      let jobsQuery = admin.from('jobs_ledger').select('id, hcp_number, click_number, job_name, status, created_at').not('google_drive_link', 'is', null)
      if (q.status === 'one') jobsQuery = jobsQuery.eq('id', q.jobId!)
      else if (q.status === 'paid') jobsQuery = jobsQuery.eq('status', 'paid')
      else jobsQuery = jobsQuery.or('status.is.null,status.neq.paid')
      if (q.afterJob) {
        const { data: at } = await admin.from('jobs_ledger').select('id, created_at').eq('id', q.afterJob).maybeSingle()
        const atRow = at as { id: string; created_at: string | null } | null
        if (!atRow) return refused(`No job has the id the plan's after_job names (${q.afterJob}).`)
        if (!atRow.created_at) return refused(`Job ${q.afterJob} has no created_at, so nothing sorts after it; start the plan after another job.`)
        jobsQuery = jobsQuery.or(backfillAfterFilter(atRow.created_at, atRow.id, q.ascending))
      }
      const { data: jobRows, error: jobsErr } = await jobsQuery.order('created_at', { ascending: q.ascending, nullsFirst: false }).order('id', { ascending: true }).limit(q.limit)
      if (jobsErr) return refused(`The jobs did not read: ${jobsErr.message}`)
      const jobs: BackfillJob[] = ((jobRows ?? []) as { id: string; hcp_number: string | null; click_number: string | null; job_name: string | null; status: string | null }[]).map((j) => ({
        id: j.id,
        number: j.hcp_number || j.click_number || null,
        name: j.job_name,
        status: j.status,
        rows: null,
      }))
      if (jobs.length === 0) return refused(q.status === 'one' ? 'No job with that id has a Drive folder.' : `No ${q.status} job has a Drive folder.`)
      const hash = await sha256Hex(JSON.stringify(backfillCommitment(plan, jobs)))
      const target = plan.scope === 'job' ? plan.job_id : `${plan.scope}:${jobs.length}`
      if (name === 'plan_index_backfill') {
        // Which jobs already have rows: the ids per chunk of jobs, a thousand rows a page (PostgREST's cap) until a
        // short page, so a few jobs with many files never hide the rest of the chunk.
        const withRows = new Set<string>()
        for (let i = 0; i < jobs.length; i += 100) {
          const ids = jobs.slice(i, i + 100).map((j) => j.id)
          for (let from = 0; ; from += 1000) {
            const { data } = await admin.from('file_index').select('jobs_ledger_id').in('jobs_ledger_id', ids).order('drive_file_id').range(from, from + 999)
            const rows = (data ?? []) as { jobs_ledger_id: string }[]
            for (const r of rows) withRows.add(r.jobs_ledger_id)
            if (rows.length < 1000) break
          }
        }
        for (const j of jobs) j.rows = withRows.has(j.id) ? 1 : 0
        const { data: stamp } = await admin.from('app_settings').select('value_text').eq('key', SWEEP_STAMP_KEY).maybeSingle()
        return ok({ plan_hash: hash, ...backfillPlanReply(plan, jobs, (stamp as { value_text?: string | null } | null)?.value_text ?? null) }, { target })
      }
      const quoted = typeof args.plan_hash === 'string' ? args.plan_hash.trim().toLowerCase() : ''
      if (!quoted) return refused('apply_index_backfill needs plan_hash — the value plan_index_backfill replied with.')
      if (quoted !== hash) return refused(`Nothing indexed: the plan you quoted (${quoted.slice(0, 12)}…) is not what this scope gives now (${hash.slice(0, 12)}…) — a job joined or left the scope since. Call plan_index_backfill again and read it.`, { target })
      const afterJob = typeof args.after_job === 'string' && args.after_job.trim() ? args.after_job.trim() : null
      const step = nextBackfillJob(jobs, afterJob)
      if (step.lost) return refused(cursorLostWords(afterJob!), { target })
      const { job, position } = step
      if (!job) return ok({ job: null, jobs_done: jobs.length, jobs_left: 0, next: 'Every job in the plan is done. Read read_file_index_status and write the counts into the card.' }, { target })
      const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
      if (!saJson) return refused('Drive is not set up on this project (GOOGLE_SERVICE_ACCOUNT_JSON, docs/DRIVE_INTAKE_SETUP.md).', { target })
      const google = await googleAccessToken(saJson)
      const ctx = await indexContext(admin, google, saJson)
      if ('noRoot' in ctx) return refused('The jobs root is not set yet (Documents → Where files go), so there is nothing to walk.', { target })
      let listed: Awaited<ReturnType<typeof jobFilesToIndex>>
      try {
        listed = await jobFilesToIndex(admin, google, { jobs_ledger_id: job.id })
      } catch (e) {
        // Drive refused the job's folder (a 404 on one the account cannot open): the job is passed over with the
        // reason and the cursor moves on, so one bad folder never strands the loop.
        const why = (e as { message?: string } | null)?.message ?? String(e)
        return ok(backfillJobPassedReply(job, `Drive refused its folder (${why})`, position, jobs.length), { target: `${target}:${job.number ?? job.id}` })
      }
      if (!listed) return ok(backfillJobPassedReply(job, 'no Drive folder the account can open', position, jobs.length), { target: `${target}:${job.number ?? job.id}` })
      const pass = await indexFiles(ctx, listed, { retry: plan.retry, max: backfillBatch(args.batch) })
      return ok(backfillApplyReply(job, pass, listed.length, position, jobs.length), { target: `${target}:${job.number ?? job.id}`, rowCount: pass.indexed })
    }
    case 'plan_file_plans':
    case 'apply_file_plans': {
      // v2.6185: the plan set into Drive and onto the bid — the same grammar as every write
      // (dev_bid_write, action file_plans) with the file's leg around it: plan hands back the
      // staging URL; apply reads the staged copy, checks it against the plan, copies it into Drive
      // (the Shared Drive, v2.6241), stamps the bid through the RPC with p_link, removes the staged
      // copy and probes. Never as anyone else.
      if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)
      const built = writeRpcBody(name, args)
      if (!built.ok) return refused(built.error)
      const rpcPath = `rpc/${built.rpc}`
      const session = await jwt()
      const fail = (status: number, body: unknown): Outcome => {
        const message = restError(status, body)
        return { log: { status: 'error', target: built.target, error: message }, text: message, isError: true }
      }
      const errored = (text: string): Outcome => ({ log: { status: 'error', target: built.target, error: text }, text, isError: true })
      const plans = built.body.p as { bid_id: string; file_name: string; size_bytes: number; sha256: string }
      const stagePath = robotPlansStagePath(plans.bid_id, plans.sha256)
      const dry = await restPost(session, rpcPath, built.dryRunBody ?? built.body)
      if (!dry.ok) return fail(dry.status, dry.body)
      // v2.6317 (punch list #239): the set lands on the plan part of each job the bid has too, when the job names one
      // (filedPlansTargets); the plan commits to the parts it saw, so a part made or switched since refuses the apply.
      const jobsRes = await restGet(session, 'jobs_ledger', `select=id,job_name,click_number,hcp_number,plan_part_id&bid_id=eq.${plans.bid_id}&plan_part_id=not.is.null`)
      if (!jobsRes.ok) return fail(jobsRes.status, jobsRes.body)
      const partJobs = (Array.isArray(jobsRes.body) ? jobsRes.body : []) as FiledPlansJob[]
      let parts: FiledPlansPart[] = []
      if (partJobs.length) {
        const partsRes = await restGet(session, 'plan_parts', `select=id,name,current_set_id&id=in.(${[...new Set(partJobs.map((j) => j.plan_part_id))].join(',')})`)
        if (!partsRes.ok) return fail(partsRes.status, partsRes.body)
        parts = (Array.isArray(partsRes.body) ? partsRes.body : []) as FiledPlansPart[]
      }
      const targets = filedPlansTargets(partJobs, parts)
      const committed = { ...((dry.body as Record<string, unknown> | null) ?? {}), job_parts: targets }
      const fresh = await planHash(name, built.body.p, committed)
      if (built.step === 'plan') {
        const upload = await stagedUploadUrl(session, stagePath)
        if ('error' in upload) return errored(upload.error)
        return ok({
          ...planReply(name, redactSecrets(committed), fresh),
          lands_on_parts: filedPlansWords(targets),
          upload_url: upload.url,
          staged_path: `${ROBOT_PLANS_BUCKET}/${stagePath}`,
          upload_expires_in: '2 hours',
          how: `curl -sS -X PUT "<upload_url>" -H "Content-Type: application/pdf" -H "x-upsert: true" --data-binary @"<the file>" — then apply_file_plans with the same plans and this plan_hash. The staged copy is read back and checked against size_bytes and sha256, copied into Drive, and removed.`,
        }, { target: built.target })
      }
      if (fresh !== built.planHash) return refused(planMismatch(name, built.planHash ?? '', fresh), { target: built.target })
      const prior = await hooks.priorApply(name, fresh)
      if (prior) return refused(alreadyApplied(name, prior), { target: built.target })
      const after = ((dry.body as { after?: Record<string, unknown> } | null)?.after ?? {}) as Record<string, unknown>
      const division = divisionBidFolderByKey(typeof after.division === 'string' ? after.division : null)
      const folderName = typeof after.plans_folder_name === 'string' ? after.plans_folder_name.trim() : ''
      if (!division || !folderName) return refused(`The plan names no division folder for this bid (${JSON.stringify(after.division ?? null)}) — the robots file plumbing, electrical and HVAC bids only.`, { target: built.target })
      const staged = await stagedDownload(session, stagePath)
      if ('error' in staged) return refused(staged.error, { target: built.target })
      const bytes = staged.bytes
      if (bytes.length !== plans.size_bytes) return refused(`The staged file is ${bytes.length} bytes; the plan says ${plans.size_bytes}. Plan again with the file's real size and sha256.`, { target: built.target })
      const sha = await sha256HexOf(bytes)
      if (sha !== plans.sha256) return refused(`The staged file's sha256 (${sha.slice(0, 12)}…) is not the plan's (${plans.sha256.slice(0, 12)}…). PUT the file you planned, or plan again for this one.`, { target: built.target })
      if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) return refused('The staged file is not a PDF (no %PDF header). The robots take PDF plan sets.', { target: built.target })
      let pages = 0
      try {
        pages = (await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false })).getPageCount()
      } catch (e) {
        return refused(`The staged file is not a PDF pdf-lib can open: ${e instanceof Error ? e.message : String(e)}`, { target: built.target })
      }
      if (pages < 1 || pages > ROBOT_PLANS_MAX_PAGES) return refused(`The set has ${pages} pages; CountTooling takes 1 to ${ROBOT_PLANS_MAX_PAGES}. Trim it to the sheets the robots need and plan again.`, { target: built.target })
      const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
      if (!saJson) return refused('Drive intake is not configured on this project (GOOGLE_SERVICE_ACCOUNT_JSON, docs/DRIVE_INTAKE_SETUP.md): a person drops the file into the division folder by hand and presses Find the folder on the bid form.', { target: built.target })
      let folderLink = ''
      let fileLink = ''
      let reused = false
      // v2.6241: the PipeTooling Jobs Shared Drive, Bid plans › <Division> › <project>. Each level is found or made,
      // and targetUrl follows the deepest folder reached so a refusal names where it stopped.
      const targetName = robotPlansPathWords(division.key)
      let targetUrl = driveFolderUrl(ROBOT_PLANS_SHARED_DRIVE.id)
      try {
        const token = await googleAccessToken(saJson)
        const bidPlans = await findOrCreateFolder(token, ROBOT_PLANS_SHARED_DRIVE.id, ROBOT_PLANS_SHARED_DRIVE.folderName)
        targetUrl = driveFolderUrl(bidPlans.id)
        const divisionFolder = await findOrCreateFolder(token, bidPlans.id, robotPlansDivisionFolderName(division.key))
        targetUrl = driveFolderUrl(divisionFolder.id)
        const folder = await findOrCreateFolder(token, divisionFolder.id, folderName)
        folderLink = driveFolderUrl(folder.id)
        const impersonate = Deno.env.get('DRIVE_IMPERSONATE_USER')?.trim()
        const upToken = impersonate ? await googleAccessToken(saJson, impersonate) : token
        const existing = await findExistingFile(upToken, folder.id, plans.file_name)
        const fileId = existing ?? (await uploadBytes(upToken, folder.id, bytes, plans.file_name, 'application/pdf')).id
        reused = existing !== null
        fileLink = `https://drive.google.com/file/d/${fileId}/view`
      } catch (e) {
        // v2.6239: the words name the service account, the folder and the share that fixes it (driveFilingRefusal).
        let serviceAccount: string | null = null
        try {
          const email = (JSON.parse(saJson) as { client_email?: unknown }).client_email
          serviceAccount = typeof email === 'string' && email ? email : null
        } catch {
          serviceAccount = null
        }
        return errored(driveFilingRefusal({ message: e instanceof Error ? e.message : String(e), serviceAccount, target: { name: targetName, url: targetUrl }, division, folderName }))
      }
      const res = await restPost(session, rpcPath, { ...built.body, p_link: { folder_link: folderLink, file_link: fileLink, pages } })
      if (!res.ok) return errored(`${restError(res.status, res.body)} — the set IS in Drive at ${fileLink} (folder ${folderLink}): paste the folder link on the bid form, or plan again with replace: true.`)
      // v2.6317: the same set as a plan_sets row on each part the plan named, current where the part had none. A part
      // that refuses is named with its reason and the rest go on (the bid's own row is already written).
      const partSets: Array<{ part: string; set_id: string | null; builds_from: boolean; existing?: boolean; error?: string }> = []
      for (const t of targets) {
        // A part that already holds this link keeps its row (planLinkKey, the database's plan_set_link_key): a re-filing
        // lands in the same project folder, and a job opened from the bid took the bid's set by trigger (v2.6342).
        const onPart = await restGet(session, 'plan_sets', `select=id,link&part_id=eq.${t.part_id}`)
        const same = onPart.ok && Array.isArray(onPart.body) ? (onPart.body as Array<{ id: string; link: string }>).find((r) => planLinkKey(r.link) === planLinkKey(folderLink)) : undefined
        if (same) {
          partSets.push({ part: t.part_name, set_id: same.id, builds_from: false, existing: true })
          continue
        }
        const row = filedPlansSetRow(t, { name: String(after.set_name ?? plans.file_name.replace(/\.pdf$/i, '')).slice(0, 200), link: folderLink, memo: String(after.memo ?? 'Filed by the dev seat'), file_name: plans.file_name, file_size: bytes.length, pages, createdBy: who.userId }, new Date().toISOString())
        const ins = await restRows(session, 'POST', 'plan_sets', '', row)
        const made = ins.ok && Array.isArray(ins.body) ? (ins.body[0] as { id?: string } | undefined) : undefined
        if (!ins.ok || !made?.id) {
          partSets.push({ part: t.part_name, set_id: null, builds_from: false, error: restError(ins.status, ins.body) })
          continue
        }
        let current = false
        if (t.make_current) {
          const up = await restRows(session, 'PATCH', 'plan_parts', `id=eq.${t.part_id}`, { current_set_id: made.id, current_set_by: who.userId, current_set_at: new Date().toISOString() })
          current = up.ok
        }
        partSets.push({ part: t.part_name, set_id: made.id, builds_from: current })
      }
      const stagedRemoved = await stagedRemove(session, stagePath)
      const probe = await probePlans(session, plans.bid_id)
      const reply = (redactSecrets(res.body) ?? {}) as Record<string, unknown>
      const bidTag = typeof reply.bid_number === 'string' ? `b${reply.bid_number}` : null
      return ok({
        ...reply,
        drive: { folder_link: folderLink, file_link: fileLink, folder_name: folderName, path: robotPlansPathWords(division.key, folderName), division: division.key, file_reused: reused },
        pages,
        bytes: bytes.length,
        plan_parts: { words: filedPlansWords(targets), sets: partSets },
        staged_removed: stagedRemoved,
        probe,
        next: probe.readable === true
          ? `Readable by the robots. A live plumbing bid with readable plans is claimed by the rounds within minutes; from a Mac with a twin key, /bid ${bidTag ?? ''} runs it now. The Bid Board's plans icon opens the folder, and the Plans button beside the bid's name reads it page by page.`
          : `The probe could not read the set yet: ${String(probe.note ?? 'no reason given')}. Open the folder link and check the file is there, then press Check the link on the bid form (or GET plan-fetch?bid=…&probe=1 again).`,
      }, { target: bidTag ?? built.target })
    }
    case 'plan_cost_batch':
    case 'apply_cost_batch':
    case 'revert_cost_batch':
    case 'plan_hr_entry':
    case 'apply_hr_entry':
    case 'plan_license':
    case 'apply_license':
    case 'plan_matter_narrative':
    case 'apply_matter_narrative':
    case 'plan_matter_plan_item':
    case 'apply_matter_plan_item':
    case 'plan_matter_event':
    case 'apply_matter_event':
    case 'plan_matter_statement':
    case 'apply_matter_statement':
    case 'plan_gap_answer':
    case 'apply_gap_answer':
    case 'plan_theme_marks':
    case 'apply_theme_marks':
    case 'plan_theme_review':
    case 'apply_theme_review':
    case 'plan_history_entry':
    case 'apply_history_entry':
    case 'plan_clock_sessions':
    case 'apply_clock_sessions':
    case 'plan_bid':
    case 'apply_bid':
    case 'plan_matter_document':
    case 'apply_matter_document':
    case 'plan_container':
    case 'apply_container':
    case 'plan_delivery':
    case 'apply_delivery':
    case 'plan_movement':
    case 'apply_movement':
    case 'plan_count':
    case 'apply_count':
    case 'plan_materials_move':
    case 'apply_materials_move':
    case 'plan_hours_statement':
    case 'apply_hours_statement':
    case 'plan_person_doc':
    case 'apply_person_doc':
    case 'plan_person_evidence':
    case 'apply_person_evidence': {
      // The second path: a POST to one hard-coded RPC, as the dev. Never as anyone else — view_as
      // refuses these before it gets here; this check is the belt to that suspender.
      // Every write verb's label sits HERE, above this block (v2.6244): v2.6187's mint_twin_setup_code block was
      // merged between the older labels and this branch, so for a day plan_cost_batch through apply_history_entry
      // fell through into it and answered "mint_twin_setup_code needs label".
      if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)
      // v2.6004: a document's bytes arrive as content_base64. They become mime, size_bytes and sha256
      // before the dry run (so the plan hash commits to the file) and are stored only at apply.
      const isDocument = name === 'plan_matter_document' || name === 'apply_matter_document'
      let file = isDocument ? await documentBytes(args) : null
      if (file && 'error' in file) return refused(file.error)
      // v2.6426: an evidence record's files arrive the same way, one content_base64 each; they are staged in hr-files at
      // apply, under the record's folder (evidenceStoragePath), before the rows — the RPC refuses the rows without them.
      const isEvidence = name === 'plan_person_evidence' || name === 'apply_person_evidence'
      const evidence = isEvidence ? await evidenceBytes(args) : null
      if (evidence && 'error' in evidence) return refused(evidence.error)
      // v2.6414: a hours statement's input is shaped first — the clock read into the snapshot the plan commits to, or
      // the signed PDF read through the gate into the file facts the document wrapper checks (stored only at apply).
      const isHours = name === 'plan_hours_statement' || name === 'apply_hours_statement'
      let hoursPrep: HoursStatementPrepared | null = null
      if (isHours) {
        const sessionForPrep = await jwt()
        const prepared = await prepareHoursStatementWrite(
          {
            reader: readerAs(sessionForPrep),
            signedPdf: async (contractDocumentId) => {
              const r = await invokeAsDev(sessionForPrep, 'open-contract-form-pdf', { person_contract_document_id: contractDocumentId })
              const url = r.body && typeof r.body === 'object' && typeof (r.body as { url?: unknown }).url === 'string' ? (r.body as { url: string }).url : null
              if (!r.ok || !url) return { error: `The signed PDF could not be opened: ${restError(r.status, r.body)}` }
              const res = await fetch(url)
              if (!res.ok) return { error: `The signed PDF could not be read (${res.status}).` }
              return { bytes: new Uint8Array(await res.arrayBuffer()), mime: 'application/pdf' }
            },
            sha256: async (bytes) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join(''),
          },
          args,
          { userId: who.userId, name: who.name },
          todayYmdInAppTz(),
        )
        if ('error' in prepared) return refused(prepared.error)
        hoursPrep = prepared
        if (prepared.file) file = { args: prepared.args, bytes: prepared.file.bytes, mime: prepared.file.mime, name: prepared.file.name, sha256: String((prepared.args.statement as { sha256?: string }).sha256 ?? '') }
      }
      // v2.6712 (punch list #286): a named document from a Drive file — the server reads the bytes through the service
      // account and the text rides to the RPC as markdown with the file's id and sha256 (devMcpDriveDoc.ts). The plan hash
      // commits to the text, so a file changed in Drive between plan and apply refuses the apply, naming the bytes read now.
      let driveDoc: { args: Record<string, unknown>; facts: DriveDocFacts } | null = null
      if (name === 'plan_person_doc' || name === 'apply_person_doc') {
        const doc = args.doc && typeof args.doc === 'object' && !Array.isArray(args.doc) ? (args.doc as Record<string, unknown>) : null
        const source = driveDocSource(doc)
        if (source && !source.ok) return refused(source.error)
        if (source) {
          const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
          if (!saJson) return refused('Drive is not set up on this project (GOOGLE_SERVICE_ACCOUNT_JSON, docs/DRIVE_INTAKE_SETUP.md).', { target: source.fileId })
          let token: string
          try {
            token = await googleAccessToken(saJson, Deno.env.get('DRIVE_IMPERSONATE_USER') || undefined)
          } catch (e) {
            return refused(`Drive could not be reached: ${e instanceof Error ? e.message : String(e)}`, { target: source.fileId })
          }
          const read = await readDriveDoc(token, source.fileId, serviceAccountEmail(saJson), fetch)
          if (!read.ok) return refused(read.error, { target: source.fileId })
          driveDoc = { args: driveDocArgs(args, read.facts, read.text), facts: read.facts }
        }
      }
      // v2.6949: a small edit inside a section — prepend_section, replace_text — is worked out here, not in the database
      // (devMcpDocEdits.ts): the text and its stamp are read as the dev, every op of the call is applied to it, and the
      // result rides to the same RPC as the whole markdown with expect_updated_at set to the stamp just read. The plan
      // hash commits to both, so a save between plan and apply refuses the apply, and the RPC refuses one between this
      // read and its write.
      let docEdit: DocEditPrepared | null = null
      if (!driveDoc && (name === 'plan_person_doc' || name === 'apply_person_doc' || name === 'plan_matter_narrative' || name === 'apply_matter_narrative')) {
        const sessionForEdit = await jwt()
        const prepared = await prepareDocEdits(name, args, async (target) => {
          const q = docEditQuery(target)
          const r = await restGet(sessionForEdit, q.table, q.query)
          return r.ok ? docEditStored(target, r.body) : { error: restError(r.status, r.body) }
        })
        if (prepared && !prepared.ok) return refused(prepared.error)
        docEdit = prepared
      }
      const built = writeRpcBody(name, file ? file.args : evidence ? evidence.args : hoursPrep ? hoursPrep.args : driveDoc ? driveDoc.args : docEdit ? docEdit.args : args)
      if (!built.ok) return refused(built.error)
      const rpcPath = `rpc/${built.rpc}`
      const session = await jwt()
      const fail = (status: number, body: unknown): Outcome => {
        const message = restError(status, body)
        return { log: { status: 'error', target: built.target, error: message }, text: message, isError: true }
      }
      if (built.step === 'plan') {
        const res = await restPost(session, rpcPath, built.body)
        if (!res.ok) return fail(res.status, res.body)
        // #297: the move's photo words say what the apply now does with a file already in Drive; the hash is of the database's own reply.
        const planned = planReply(name, name === 'plan_materials_move' ? moveReplyWithRefileWords(redactSecrets(res.body)) : redactSecrets(res.body), await planHash(name, built.body.p, res.body))
        return ok(driveDoc ? { ...planned, ...driveDocPlanExtra(driveDoc.facts) } : docEdit ? docEditPlanReply(planned, docEdit) : planned, { target: built.target })
      }
      let writeBody: Record<string, unknown> = built.body
      let stored: string | null = null
      const staged: string[] = []
      if (built.step === 'apply') {
        const dry = await restPost(session, rpcPath, built.dryRunBody ?? built.body)
        if (!dry.ok) return fail(dry.status, dry.body)
        const fresh = await planHash(name, built.body.p, dry.body)
        if (fresh !== built.planHash) {
          const mismatch = planMismatch(name, built.planHash ?? '', fresh)
          return refused(driveDoc ? driveDocChangedWords(driveDoc.facts, mismatch) : mismatch, { target: built.target })
        }
        // One apply per plan (v2.3730): a payload with no before-state hashes the same after it lands.
        // Materials on site's plans commit to the state their write changes, so the wrapper refuses a replay itself (v2.6367).
        const prior = stateGuarded(name) ? null : await hooks.priorApply(name, fresh)
        if (prior) return refused(alreadyApplied(name, prior), { target: built.target })
        if (file && !('error' in file)) {
          // The file first, as the dev, under the matter's folder; the RPC refuses the row unless it is there.
          const id = crypto.randomUUID()
          const path = legalDocumentStoragePath(String(built.target), id, file.name)
          const problem = await storagePut(session, LEGAL_MATTER_DOCUMENTS_BUCKET, path, file.bytes, file.mime)
          if (problem) return { log: { status: 'error', target: built.target, error: problem }, text: problem, isError: true }
          stored = path
          writeBody = { ...built.body, p_file: { id, storage_path: path } }
        }
        if (evidence && !('error' in evidence)) {
          // The files first, as the dev, under the record's folder in hr-files; the RPC refuses the rows unless every one is there.
          const evidenceId = crypto.randomUUID()
          const rows: Array<{ id: string; storage_path: string } | { id: string; drive_url: string }> = []
          for (const f of evidence.files) {
            const id = crypto.randomUUID()
            if ('driveUrl' in f) {
              // A linked file (v2.6541): nothing to stage; the RPC writes the row with its address alone.
              rows.push({ id, drive_url: f.driveUrl })
              continue
            }
            const path = evidenceStoragePath(String(built.target), evidenceId, id, f.name)
            const problem = await storagePut(session, HR_FILES_BUCKET, path, f.bytes, f.mime)
            if (problem) {
              for (const p of staged) await storageRemove(session, HR_FILES_BUCKET, p)
              return { log: { status: 'error', target: built.target, error: problem }, text: `${f.name}: ${problem}`, isError: true }
            }
            staged.push(path)
            rows.push({ id, storage_path: path })
          }
          writeBody = { ...built.body, p_files: { evidence_id: evidenceId, files: rows } }
        }
      }
      // v2.6414: the snapshot's as-of is stamped at the real write, after the hash check, so a plan and its apply hash the same.
      if (isHours && built.step === 'apply' && hoursPrep?.snapshot) {
        const p = writeBody.p as Record<string, unknown>
        const nowIso = new Date().toISOString()
        writeBody = { ...writeBody, p: { ...p, snapshot: { ...hoursPrep.snapshot, asOf: `${hoursStatementLongDate(todayYmdInAppTz())} ${hoursStatementClockLabel(nowIso)}` } } }
      }
      const res = await restPost(session, rpcPath, writeBody)
      if (!res.ok) {
        if (stored) await storageRemove(session, LEGAL_MATTER_DOCUMENTS_BUCKET, stored)
        for (const p of staged) await storageRemove(session, HR_FILES_BUCKET, p)
        return fail(res.status, res.body)
      }
      let reply = redactSecrets(res.body)
      if (docEdit && built.step === 'apply') reply = docEditApplyReply(reply, docEdit)
      if (isDocument && built.step === 'apply' && reply && typeof reply === 'object') {
        // #285 (v2.6714): the document's words into the file index at once, so search_case finds them; fail-soft, the
        // sweep's records step takes a document the pass missed within ten minutes.
        reply = { ...(reply as Record<string, unknown>), index: await indexRecordsAfterWrite({ matterId: String(built.target) }) }
      }
      if (name === 'apply_materials_move' && reply && typeof reply === 'object' && !Array.isArray(reply)) {
        // #297 (0.61.0): the rows are on the new job; the files the sweep already filed follow them. photo-save moves each
        // into the new job's photo folder as the dev, and its answer rides in the reply as photos.refiled. A failed ask
        // never undoes the move, and since v2.6915 the sweep moves what the database marked due (boxPhotoRefile.ts).
        const toJob = String((built.body.p as { to_job?: unknown }).to_job ?? '')
        const withWords = moveReplyWithRefileWords(reply) as Record<string, unknown>
        const refiled = movedPhotosInDrive(reply) > 0 ? refiledForSeat(toJob, await invokeAsDev(session, 'photo-save', { refile_box_photos: toJob })) : NO_REFILE_NEEDED
        reply = { ...withWords, photos: { ...((withWords.photos as Record<string, unknown> | undefined) ?? {}), refiled } }
      }
      if (name === 'apply_license' && reply && typeof reply === 'object') {
        // As the Licenses tab's Save: a license inside its last 30 days opened a dispatch request; the push goes now.
        const dispatchId = (reply as { dispatch_request_id?: unknown }).dispatch_request_id
        if (typeof dispatchId === 'string') {
          const sent = await invokeAsDev(session, 'notify-dispatch-request', { dispatch_request_id: dispatchId })
          reply = { ...(reply as Record<string, unknown>), dispatch_notice: sent.ok ? 'sent' : `the request is open on Dispatch; its push failed (${sent.status})` }
        }
      }
      if (isEvidence && built.step === 'apply' && reply && typeof reply === 'object') {
        // Drive after the rows, as the panel asks it: a function not deployed, a refusal or no People folder leaves the
        // record standing as not in Drive, and the cron sweep tries again while a file waits.
        const evidenceId = (reply as { evidence_id?: unknown }).evidence_id
        // v2.6554: a counsel-only record never asks Drive. Since v2.6986 this seat reads it back, marked counsel-only.
        const counselOnly = (built.body as { p?: { counsel_only?: unknown } }).p?.counsel_only === true
        if (counselOnly) {
          // #285: the Drive filer is never asked, so its index hook never runs; the files go through the records pass here, fail-soft.
          const index = await indexRecordsAfterWrite({ personId: String(built.target) })
          return ok({ ...(reply as Record<string, unknown>), drive: { asked: false, ok: true, why: null, counsel_only: true }, index, next: 'Kept here only, counsel-only: never filed in Drive and never read by the HR agent\'s key. This seat reads it back, marked counsel_only (since 0.76.0); keep its words out of open entries, open documents, job notes, Drive and the repo.' }, { target: typeof evidenceId === 'string' ? evidenceId : built.target })
        }
        const drive = typeof evidenceId === 'string' ? await fileEvidenceToDrive(session, evidenceId) : { asked: false, ok: false, why: 'the RPC answered no evidence_id' }
        return ok({ ...(reply as Record<string, unknown>), drive, next: evidenceDriveNext(drive) }, { target: typeof evidenceId === 'string' ? evidenceId : built.target })
      }
      // v2.6414: the send leg after a make lands — the form drawn, the link minted as the dev, the row marked sent. The
      // link rides in the reply to the agent and never in the call log (the log keeps args and the target alone).
      if (isHours && built.step === 'apply' && hoursPrep?.send && reply && typeof reply === 'object' && typeof (reply as { statement_id?: unknown }).statement_id === 'string') {
        const statementId = (reply as { statement_id: string }).statement_id
        const signing = await sendHoursStatementAsDev(
          (fn, body) => invokeAsDev(session, fn, body),
          async (id) => (await restPost(session, rpcPath, { p: { action: 'mark_sent', statement_id: id }, p_dry_run: false })).ok,
          { statementId, how: hoursPrep.send.how, publicOrigin: Deno.env.get('APP_ORIGIN') ?? null },
        )
        reply = { ...(reply as Record<string, unknown>), signing }
      }
      // v2.6712: the document's reply names the file it was copied from, as the plan did.
      if (driveDoc && reply && typeof reply === 'object' && !Array.isArray(reply)) reply = { ...(reply as Record<string, unknown>), source: driveDoc.facts }
      const batchId = reply && typeof reply === 'object' && typeof (reply as { batch_id?: unknown }).batch_id === 'string' ? (reply as { batch_id: string }).batch_id : null
      // v2.6183: a made bid is logged by its number, the way find_bid names it.
      const bidNumber = name === 'apply_bid' && reply && typeof reply === 'object' && typeof (reply as { bid_number?: unknown }).bid_number === 'string' ? `b${(reply as { bid_number: string }).bid_number}` : null
      return ok(reply, { target: batchId ?? bidNumber ?? built.target })
    }

    default: {
      // The health checks: fixed RPC names from this repo's migration (HEALTH_RPCS), so they answer
      // before a gen-types run puts them in the catalog. Same GET door, as `who`; each RPC is
      // gated is_dev() inside, so view_as a non-dev is refused by the database.
      if (isHealthVerb(name)) {
        const rpc = HEALTH_RPCS[name]
        const built = buildRpcQuery(healthRpcArgs(name, args))
        if (!built.ok) return refused(built.error, { target: rpc })
        const res = await restGet(await jwt(), `rpc/${rpc}`, built.query)
        if (!res.ok) {
          const message = restError(res.status, res.body)
          return { log: { status: 'error', target: rpc, error: message }, text: message, isError: true }
        }
        return ok({ reading: healthReading(name, res.body), ...(res.body && typeof res.body === 'object' && !Array.isArray(res.body) ? (res.body as Record<string, unknown>) : { data: res.body }) }, { target: rpc })
      }
      return refused(`Unknown tool: ${name}`)
    }
  }
}

/** view_as's target: a role's sample account, or a person by id. The app's Imitate rule holds — never a dev. */
async function resolveViewAsTarget(admin: Admin, args: Record<string, unknown>): Promise<Identity | { error: string }> {
  const role = typeof args.role === 'string' ? args.role.trim() : ''
  const user = typeof args.user === 'string' ? args.user.trim() : ''
  if (!!role === !!user) return { error: 'view_as needs exactly one of `role` (its sample account) or `user` (a user id).' }
  if (role && !/^[a-z_]+$/.test(role)) return { error: `"${role}" is not a role name.` }
  if (user && !/^[0-9a-f-]{36}$/i.test(user)) return { error: '`user` must be a user id — find_person resolves a name.' }
  const query = admin.from('users').select('id, email, name, role, archived_at, is_sample, login_attached_at')
  const { data, error } = role ? await query.eq('role', role).eq('is_sample', true).is('archived_at', null).limit(1).maybeSingle() : await query.eq('id', user).maybeSingle()
  if (error) return { error: `Could not look up the target: ${error.message}` }
  const u = data as { id: string; email: string; name: string | null; role: string; archived_at: string | null; login_attached_at?: string | null } | null
  if (!u) return { error: role ? `No sample account for role "${role}" — create it on Settings → People & teams → Active accounts (View as).` : `No user ${user}.` }
  if (u.archived_at) return { error: 'That account is archived.' }
  if (u.login_attached_at === null || !u.email) return { error: 'That person has no login to view the app as; a dev attaches one from their desk (punch list #260).' }
  if (u.role === 'dev') return { error: 'A dev account is never a view_as target (the same rule as Imitate).' }
  return { userId: u.id, email: u.email, name: u.name, role: u.role }
}

/**
 * Has this plan been applied already? The log (`dev_mcp_calls`) holds every ok apply_ with the
 * plan_hash it quoted, whoever's key it was; a cost batch since reverted does not count, so a
 * batch that was wrong can be reverted and the same plan applied again on purpose.
 */
async function priorApply(admin: Admin, verb: string, hash: string): Promise<{ target: string | null; at: string | null } | null> {
  const { data } = await admin.from('dev_mcp_calls').select('target, created_at').eq('verb', verb).eq('status', 'ok').eq('args->>plan_hash', hash).order('created_at', { ascending: false }).limit(5)
  const rows = (data ?? []) as { target: string | null; created_at: string }[]
  for (const row of rows) {
    if (verb === 'apply_cost_batch' && row.target) {
      const { data: batch } = await admin.from('cost_batches').select('reverted_at').eq('id', row.target).maybeSingle()
      if ((batch as { reverted_at: string | null } | null)?.reverted_at) continue
    }
    return { target: row.target, at: row.created_at }
  }
  return null
}

/**
 * v2.6792: the auth account behind a users row, by id, as the service role — the fourth thing the service role is used for.
 * Only the stamps the account verbs read (authStateOf picks them by name); a missing account is null, a failed read throws.
 */
async function authStateById(admin: Admin, userId: string): Promise<AuthState | null> {
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error) {
    if (/not found|does not exist/i.test(error.message) || (error as { status?: number }).status === 404) return null
    throw new Error(`could not read the auth account: ${error.message}`)
  }
  return authStateOf((data?.user ?? null) as unknown as Record<string, unknown> | null)
}

async function callTool(req: Request, name: string, args: Record<string, unknown>): Promise<McpToolResult> {
  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { autoRefreshToken: false, persistSession: false } })
  const dev = await resolveDev(admin, req)
  if ('error' in dev) return mcpText(`Auth failed: ${dev.error}`, true)
  const started = Date.now()
  const finish = async (out: Outcome, asUserId: string | null = null) => {
    await logCall(admin, dev, started, { verb: name, args: argsForLog(name, args), asUserId, ...out.log })
    return mcpText(out.text, out.isError === true)
  }

  try {
    if (name === 'view_as') {
      const verb = String(args.verb ?? '')
      if (!verb || verb === 'view_as') return finish(refused('view_as needs a `verb` — any read verb of this server except view_as.'))
      if (isWriteVerb(verb) || verb === 'mint_twin_setup_code' || verb === 'plan_index_backfill' || verb === 'apply_index_backfill' || verb === 'plan_mail_file' || verb === 'apply_mail_file' || verb === 'plan_mail_tag' || verb === 'apply_mail_tag') return finish(refused(`view_as never writes: ${verb} runs only as you, with your own key.`, { target: verb }))
      const target = await resolveViewAsTarget(admin, args)
      if ('error' in target) return finish(refused(target.error))
      const inner = (args.args && typeof args.args === 'object' && !Array.isArray(args.args) ? args.args : {}) as Record<string, unknown>
      const out = await runVerb(target, () => sessionFor(admin, target), verb, inner)
      return finish({ ...out, text: out.isError ? out.text : `// read as ${target.name ?? target.email} (${target.role})\n${out.text}`, log: { ...out.log, target: `${verb}${out.log.target ? `:${out.log.target}` : ''}` } }, target.userId)
    }
    const me: Identity = { userId: dev.userId, email: dev.email, name: dev.name, role: 'dev' }
    return finish(await runVerb(me, () => sessionFor(admin, me), name, args, { priorApply: (verb, hash) => priorApply(admin, verb, hash), authState: (userId) => authStateById(admin, userId) }))
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return finish({ log: { status: 'error', error: message }, text: `Tool error: ${message}`, isError: true })
  }
}

serve(mcpHandler({
  name: 'pipetooling-dev-mcp',
  version: SERVER_VERSION,
  instructions: INSTRUCTIONS,
  tools: TOOLS,
  authHeaders: ['x-dev-token'],
  callTool,
}))
