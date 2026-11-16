import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { PhysicalInvoiceIssuer } from '../../lib/physicalInvoiceIssuer'
import type { LienDeskKind } from '../../lib/lien/lienDeskRoute'
import { EmptyState } from '../EmptyState'
import { LIEN_SHOW_EVERY_PILE, lienAffidavitsEmptyWords, lienListFindEmptyWords, lienPileEmptyWords } from '../../lib/jobs/lienDeskEmptyWords'
import { buildLienAffidavitBlocks, buildLienNoticeBlocks, filingDocHtml, filingLetterheadFromIssuer, type FilingDocExtras, type FilingFieldMark, type LienNoticeFields } from '../../lib/jobsDocuments/lienFilingDocuments'
import { LIEN_NOTICE_FIELD_GUIDE, LIEN_NOTICE_PREVIEW_EDIT_MESSAGE, LIEN_NOTICE_PREVIEW_MESSAGE, LIEN_NOTICE_PREVIEW_SAVE_MESSAGE, applyWordingEdits, buildLienNoticePreviewHtml, isTypedNoticeField, lienNoticePreviewPages, noticeWordingDiff, wordingLineText, type LienNoticeFieldKey } from '../../lib/jobs/lienNoticePreview'
import { demandDate, demandMoney } from '../../lib/jobsDocuments/demandLetter'
import { defaultSignoffAsk, signoffWords, type LegalSignoffState } from '../../lib/legal/legalAsks'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { LienRulesDoor } from './LienRulesDoor'
import { lienRulesJobFrom } from '../../lib/jobs/lienRulesDates'
import { LIEN_GC_PICKER_URGENT_DAYS, buildLienGcPickerOptions, lienGcPickerCloseWords } from '../../lib/jobs/lienDeskGcPicker'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { calendarYmdInAppTzFromIso, formatDenverTimeOnly } from '../../utils/dateUtils'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { lienPropertyOwnerDisplayName, resolveLienProperty } from '../../lib/jobs/lienProperty'
import { workMonthLabel, workMonthShort, type JobWorkMonths } from '../../lib/jobs/forecastWorkMonths'
import {
  LIEN_ASK_REASON_LABELS,
  LIEN_DESK_PILES, lienEmptyPileWords,
  LIEN_NOTICE_POLICIES,
  PUBLIC_OWNER_DESK_SENTENCE,
  draftReadiness,
  holdUntilFor,
  canSendLienOnWord,
  isLienLeader,
  isLienOffice,
  ruleWaitsOnFirstNotice,
  submitOutcome,
  type LienAskReason,
  type LienDeskEntry,
  type LienDeskPile,
  type LienNoticePolicy, LIEN_DESK_LEAD_DAYS } from '../../lib/jobs/lienDesk'
import { lienStandInSourceOf, lienStandInWords } from '../../lib/jobs/lienBillMonths'
import {
  holdLienDeskItem,
  pullBackLienDeskItem,
  LIEN_DRAFT_AUTOSAVE_MS,
  saveLienDeskDraft,
  sendLienDeskItemOnWord,
  setCustomerLienNoticePolicy,
  noteLienWindowMissed,
  submitLienDeskItem, tellLeaderOfLienApproval,
  noteGcAuthorizedDirectPay,
  startLetterTwo,
  noteOwnerCall,
  notePromiseOnNotice,
} from '../../lib/jobs/lienDeskIo'
import { addJobPaymentPromise } from '../../lib/jobs/paymentChaseIo'
import { defaultWordNote, wordRecordBlock, wordRecordPreview, wordRecordWords, type LienWordChannel } from '../../lib/jobs/lienWord'
import { lienFooter, type LienSignWay } from '../../lib/jobs/lienFooterMenu'
import { LienFootMenu } from './LienFootMenu'
import { penWordApproval } from '../../lib/jobs/lienPenRecord'
import { awaitingChip, heldChip, printedChip, readyChip, shortDay as footShortDay, type LienFootChip } from '../../lib/jobs/lienFootChip'
import { confirmLienPenSignature, disownLienPenSignature, lienSignCodeStatus, signLienDeskItem, signLienDeskItemWithCode, type LienDeskSignPayload } from '../../lib/jobs/lienDeskSignIo'
import { lienCodeRefusalWords, lienCodeSignerFrom, lienCodeStatusStale, lienOtherScreen, type LienCodeStatusRead } from '../../lib/jobs/lienCodeSigner'
import { lienChipSigned, lienFieldsHash, lienItemUnsigned, lienNoticeSignatureFromRow, signatureColumnsOf, toFilingSignature } from '../../lib/jobs/lienNoticeSignature'
import { LienNoticeSignLine, type LienNoticeSignLineCodeSigner, type LienNoticeSignLineFrame, type LienNoticeSignLineHandle } from './LienNoticeSignLine'
import { useLienDeskSignatureInks } from '../../hooks/useLienDeskSignatureInks'
import { LienWordRecordRow } from './LienWordRecordRow'
import { buildLienNoticeFieldsForJob, describeNoticeMonths, lienOriginalContractor, homesteadStatementApplies, parseLienDeskDraftFields, type LienDeskDraftFields } from '../../lib/jobs/lienNoticeDraft'
import type { LienDeskData, LienDeskJob } from '../../hooks/useLienDeskData'
import { useNoticePayPage } from '../../hooks/useNoticePayPage'
import { changedPayLines, payLineField, payLineInvoiceId, payPageBlocks, payPageSummary } from '../../lib/jobs/lienNoticePayPage'
import { useToastContext } from '../../contexts/ToastContext'
import { closePaidLienDeskItems } from '../../lib/jobs/lienDeskIo'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useLienJobSuppliers } from '../../hooks/useLienJobSuppliers'
import { LienJobHeading } from './LienJobNumber'
import { getBillingStripeModePref } from '../../lib/billingStripeModePref'
import { buildLienDeskRun, buildLienRetainageRun, runCoverNoteBlocks, runDoorWords } from '../../lib/jobs/lienDeskRun'
import { lienRunRowLine } from '../../lib/jobs/lienRunChecklist'
import { LIEN_RUN_NOW_TO_PRINT, lienRunActLabel } from '../../lib/jobs/lienRunWords'
import { affidavitMonthWordFor, counselCoverLetterTemplate, coverLetterKindFor, fillCoverLetter, letterTwoTemplate } from '../../lib/jobs/gcOnNotice'
import { LETTER_TWO_KINDS, letterTwoIsDue, letterTwoKindLabel, type LetterTwoKind } from '../../lib/jobs/lienLetterTwo'
import { AFFIDAVIT_PILE_WORDS, affidavitPileFor, ownerCallWords } from '../../lib/jobs/lienOwnerCall'
import { parsePaymentBond } from '../../lib/jobs/lienDeskRetainage'
import LienOwnerCallDialog from './LienOwnerCallDialog'
import LienCourtesyWindow from './LienCourtesyWindow'
import { formatErrorMessage } from '../../utils/errorHandling'
import { COURTESY_BUTTON, COURTESY_FROM_DAY, COURTESY_RECORD_AGAIN_BUTTON, PROMISE_BUTTON, courtesyFooterSentence, courtesyMaySend, courtesyOutcomeWords, courtesyUnrecordedWords, type CourtesyFacts, type CourtesyPromise, type CourtesyRecord, type CourtesySent } from '../../lib/jobs/lienCourtesyNotice'
import { courtesyByJobFrom } from '../../lib/jobs/lienCourtesyDesk'
import { loadCourtesyRecipients, sendCourtesyNotice, writeCourtesyRecord, type CourtesyRecipient } from '../../lib/jobs/lienCourtesyIo'
import { payLinkDisplay } from '../../lib/billing/payLink'
import type { LienDeskItemRow } from '../../lib/jobs/lienDesk'
import { LienCallerDoor } from './LienCallerDoor'
import LienDeskCalendarTab from './LienDeskCalendarTab'
import LienTrackingOwedEditor from './LienTrackingOwedEditor'
import { sendsTrackingOwed } from '../../lib/jobs/lienSendTracking'
import { filingMailCostWords, filingMailLines, filingMailTail, jobsWithMailPieces, mailNeedsYouRows, mailPiecesNeedingYou } from '../../lib/mail/lienMailPieces'
import LienMailPieceDoors from './LienMailPieceDoors'
import { approveLienDeskItem, clearLienDeskItemPrinted, markLienDeskItemsPrinted, redrawLienAffidavitsShort, submitLienAffidavits, takeBackLienDeskItems, tellLeaderOfLienAffidavits } from '../../lib/jobs/lienDeskIo'
import { lienAffidavitBatchToldWords, lienAffidavitTellPapers } from '../../lib/jobs/lienAffidavitApprovalTell'
import { runTakenBackOf, takenBackChipWords } from '../../lib/jobs/lienRunTakeBack'
import LienOfferBox from './LienOfferBox'
import { lienOfferChipWords, lienOfferDayProblem, lienOfferFromItem, type LienPayOffer } from '../../lib/jobs/lienPayOffer'
import { setLienDeskItemOffer } from '../../lib/jobs/lienPayOfferIo'
import { buildLienNextUp, lienRunEntriesFor, lienViewerLeadsJob, lienNextUpCount, type LienNextUpRow } from '../../lib/jobs/lienNextUp'
import { buildLienBoard, lienBoardChipFor, lienBoardDoorWords, lienBoardForLeader, lienBoardLeaderPick, lienBoardPick, lienBoardPickWords, lienBoardRiskPapers, lienBoardRiskPhrase, lienBoardRiskPick, lienBoardRowInPick, lienBoardRowBin, lienBoardRowRisk, lienBoardRowStage, type LienBoardBinKey, type LienBoardChip, type LienBoardKind, type LienBoardTileDestination } from '../../lib/jobs/lienBoard'
import { lienBinFolds } from '../../lib/jobs/lienNextUpByBin'
import { lienBoardAffidavitPrint, lienBoardNoticePrint, type LienBoardPrintSide } from '../../lib/jobs/lienBoardPrints'
import { batchOutcomeWords } from '../../lib/batchWords'
import { lienPhoneAmounts } from '../../lib/jobs/lienPhoneRows'
import { LIEN_PHONE_TAB } from '../../lib/jobs/lienPhoneLists'
import { LienPileHead, lienPileHeadCount, useLienPileHeads } from './LienPileHeads'
import LienBoard from './LienBoard'
import LienPublicPropertyWindow from './LienPublicPropertyWindow'
import LienPublicPutBackWindow from './LienPublicPutBackWindow'
import { LienPublicBinView, LienPublicBoardLineView } from './LienPublicBoardParts'
import { buildLienPublicBin, lienPublicBoardLine } from '../../lib/jobs/lienPublicProperty'
import { splitLienJobLabel } from '../../lib/jobs/lienJobLabel'
import { lienStepCard, lienStepDueWords, LIEN_STEP_LADDERS, lienStepOfRow, type LienStepFacts } from '../../lib/jobs/lienNextUpSteps'
import { lienJobScreen, lienJobScreenClosesOnAct } from '../../lib/jobs/lienPhoneJobScreen'
import { LienStepRow } from './LienDeskSteps'
import { freshHtml, gapToken, lienPaperFilledSince, lienPaperFixWindow, lienPaperGaps, paintGaps, withFreshMarks, withGapTokens, type LienPaperFacts, type LienPaperFixWindow, type LienPaperGap } from '../../lib/jobs/lienPaperGaps'
import LienPaperPropertyWindow from './LienPaperPropertyWindow'
import LienPaperGcWindow from './LienPaperGcWindow'
import LienPaperPreviewOverlay, { type LienPaperPreviewEntry } from './LienPaperPreviewOverlay'
import LienStopPaperWindow, { type LienStopPaper } from './LienStopPaperWindow'
import { affidavitStopPages, filingSnapshotPage, lienDeskAffidavitFieldsFor, retainageStopPages } from '../../lib/jobs/lienStopPaperPages'
import { lienStopPaperKind } from '../../lib/jobs/lienStopPaper'
import type { LienTimelineStep } from '../../lib/jobs/lienTimeline'
import type { JobLienFilingRow } from '../../lib/jobs/lienDeadlines'
import { LienLastWorkDayLine } from './LienLastWorkDayLine'
import { lienLastWorkAffidavitMonths } from '../../lib/jobs/lienLastWorkDayPreview'
import LienDeskNextUp from './LienDeskNextUp'
import { LIEN_DO_NOW_ROWS_SELECTOR, lienDoNowFrame, lienDoNowListTop } from '../../lib/jobs/lienDoNowFrame'
import { lienDoNowBarParts } from '../../lib/jobs/lienDoNowBar'
import { lienBoardChipCard } from '../../lib/jobs/lienBoardChipCard'
import { lienReminderOutcome, lienReminderPlan, lienReminderWords } from '../../lib/jobs/lienLeaderReminder'
import { lienNoticeToldWords, lienReminderAffidavitLabel, lienReminderTally } from '../../lib/jobs/lienLeaderTold'
import LienDoNowBar from './LienDoNowBar'
import { useLienDoNowRoom } from './useLienDoNowRoom'
import type { LienCalendarJob } from '../../lib/jobs/lienCalendar'
import { callLetterFactsFor, callerIndex, findOnDesk, practiceCallFacts, type CallerMatchInput, type CallerOwnerHit } from '../../lib/jobs/lienCallerMatch'
import LienCallScriptModal from './LienCallScriptModal'
import { genericCallFacts } from '../../lib/jobs/lienCallScript'
import { DEFAULT_CLAIMANT_NAME, lienAffidavitSwornMonths } from '../../lib/jobs/lienNoticeDraft'
import { lienAffidavitOwnerSends, lienAffidavitWorkMonths } from '../../lib/jobs/lienAffidavitNotices'
import { lienAffidavitNoticeTag, type LienRowTag } from '../../lib/jobs/lienRowWords'
import { lienNoticeNamedMonths, lienNoticeOwedConfirmWords, lienNoticeToExtend } from '../../lib/jobs/lienNoticeOwed'
import { lienAffidavitMonthsByHandCheck } from '../../lib/jobs/lienAffidavitMonthsByHand'
import { lienMonthCheckedFor, lienMonthCheckedSheetRow, parseLienMonthCheck } from '../../lib/jobs/lienMonthCheck'
import { addMonthsToLienNotice } from '../../lib/jobs/lienNoticeOwedIo'
import { buildLienDeskAffidavitFields } from '../../lib/jobs/lienDeskAffidavitFields'
import { lienAffidavitFormForItem } from '../../lib/jobs/lienAffidavitForm'
import { lienAffidavitRedrawOutcome, lienAffidavitRedrawPlan, lienAffidavitRedrawWords } from '../../lib/jobs/lienAffidavitRedraw'
import { lienAffidavitClerkOrder, lienAffidavitPrintPlan, lienAffidavitPrintRun, lienAffidavitPrintDoorWords, lienAffidavitPrintWords, lienAffidavitSendOutcome, lienAffidavitSendPlan, lienAffidavitSendWords, lienAffidavitSheetPapers, lienAffidavitShownEntries, type LienAffidavitShown, type LienAffidavitPrintPaper, LIEN_HELP_EARLIER_FORM_REASON, lienAffidavitBatchHelpSheet, lienAffidavitBatchNoticeCopies, lienAffidavitBatchNoticeCopyCount, lienAffidavitBatchNoticeRecords } from '../../lib/jobs/lienAffidavitBatch'
import { useLienHelpSheetChoice, useLienNoticeCopiesBatchChoice, useLienNoticeRecordChoice } from './lienHelpSheetChoice'
import { lienNoticeRecord } from '../../lib/jobs/lienNoticeRecord'
import { LienSigningCountyBox } from './LienSigningCountyBox'
import { LIEN_PRINT_WITH_LABEL, lienAffidavitPrintBarStatus, lienPrintWithChips } from '../../lib/jobs/lienAffidavitPrintBar'
import { useLienSigningCounty } from './lienSigningCountyChoice'
import { useLienAskPeople } from './lienAskPeopleChoice'
import { lienClerkFor } from '../../lib/jobs/lienCountyClerks'
import { lienHelpBatchRecordCode, lienHelpGuideCode } from '../../lib/jobs/lienHelpGuideCode'
import { lienAffidavitNoticeCheck, lienNoticeCheckLines, lienNoticeCheckRowLine } from '../../lib/jobs/lienAffidavitNoticeCheck'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import LienDeskRunModal from './LienDeskRunModal'
import LienDeskShare from './LienDeskShare'
import { Share } from 'lucide-react'
import { useScrollEdgeFade } from '../../hooks/useScrollEdgeFade'
import { LienEnvelopeCard } from './LienEnvelopeCard'
import { LienJobSuppliersCard, LienSupplierMarkLine } from './LienJobSuppliers'
import { LIEN_HOUSES_PARAGRAPH_READ_BY_COUNSEL, lienSupplierLetterParagraphFor, lienSupplierMark, type LienSupplierMark } from '../../lib/jobs/lienJobSuppliers'
import { LIEN_RELEASE_PARAGRAPH_READ_BY_COUNSEL, conditionalReleaseParagraph, noticeReleaseFields, noticeReleaseFormType, noticeReleasePageHtml, noticeReleaseThroughDate } from '../../lib/jobs/lienNoticeRelease'
import { createNoticeReleaseDraft, refreshNoticeReleaseDraft, voidNoticeReleaseDraft, type NoticeReleaseDraftInput } from '../../lib/jobs/lienNoticeReleaseIo'
import { useNoticeReleases } from '../../hooks/useNoticeReleases'
import { LIEN_PANE_HEAD_H, LIEN_PANE_HEAD_H_PHONE, lienNoticeFootHead, lienPaneHeadsOverPages, lienPaneSections } from '../../lib/jobs/lienPaneSections'
import { useLienPaneHeads } from './useLienPaneHeads'
import { lienPhoneFootFold, lienPhoneFootStartsFolded, lienPhonePaneOpen, lienPhonePrintBoxFold } from '../../lib/jobs/lienPhonePane'
import { lienDeskFooterHome } from '../../lib/jobs/lienDeskFooterHome'
import LienDeskAffidavitPane, { affidavitDeadlineWords } from './LienDeskAffidavitPane'
import { LienAffidavitSheetFlags } from './LienAffidavitSheetFlags'
import LienDeskRetainagePane from './LienDeskRetainagePane'
import { LIEN_RETAINAGE_PILES, contractEndedWords, retainageDeadlineWords, type LienRetainagePile } from '../../lib/jobs/lienDeskRetainage'
import { retainageInsideClaim } from '../../lib/jobs/lienNoticeDraft'
import LienDeskOwnerPane from './LienDeskOwnerPane'
import LienDeskGates, { LienGatesSentFold } from './LienDeskGates'
import LienPageExportPresses from './LienPageExportPresses'
import { isLienExportPageKey, lienExportDraftLine, lienExportFileName, lienExportFiling, lienExportTitle } from '../../lib/jobs/lienPageExport'
import { lienPageExportBlob } from '../../lib/jobs/lienPageExportIo'
import LienDeskFindBox, { LienFindHits, LienFindMarked } from './LienDeskFindBox'
import { LegendButton } from '../help/LegendButton'
import LienDeskMoreSheet from './LienDeskMoreSheet'
import LienDeskJobScreen from './LienDeskJobScreen'
import { lienDeskMoreButton, lienDeskMoreRows, type LienDeskMoreKey } from '../../lib/jobs/lienDeskPhoneMore'
import { LIEN_DESK_TITLE_BAR_ROW_GAP_PX, lienDeskPileLineFit, lienDeskTitleBarLayout, lienDeskTitleLineFit, readLienDeskPileLine, readLienDeskTitleLine, type LienDeskPileLineFit, type LienDeskTitleLineFit } from '../../lib/jobs/lienDeskTitleBar'
import { DeskLegendCard } from '../help/LegendCard'
import { LIEN_DESK_LEGEND } from '../../lib/jobs/lienDeskLegend'
import { lienFindMatch, lienFindNothingWords, lienFindSingle, lienFindWords, type LienFindFact, type LienFindFacts } from '../../lib/jobs/lienDeskFind'
import { ownerFromRollUnconfirmed } from '../../lib/jobs/ownerConfirm'
import LienDeskMonths, { type LienDeskMonthCard } from './LienDeskMonths'
import LienNoticeByHandPane from './LienNoticeByHandPane'
import LienPenSignaturePane from './LienPenSignaturePane'
import { buildLienMonthGrid } from '../../lib/jobs/lienMonthGrid'
import { buildLienTimelineFromDesk, lienRetainageClockFromDesk } from '../../lib/jobs/lienTimelineDesk'
import LienTimelineStrip, { LienTimelineViewSwitch } from './LienTimelineStrip'
import { bringLienFooterUp } from './lienFooterFocus'
import type { LienNextAct, LienNextActDoor } from '../../lib/jobs/lienNextAct'
import LienDeskTimelineTab from './LienDeskTimelineTab'
import { useLienTimelineBook } from '../../hooks/useLienTimelineBook'
import { useZzTestJobsHidden } from '../../lib/jobs/zzTestJobSwitch'
import { lienGridHtml, type LienBookShow, type LienTimelineBookRow } from '../../lib/jobs/lienTimelineBook'
import { fileSentCopy, printAndFile } from '../../lib/sent/sentCopiesIo'
import { openHtmlPrintWindow } from '../../lib/jobsDocuments/printWindow'
import { lienStripChips, type LienStripChipAct, type LienStripChipTone } from '../../lib/jobs/lienStripChips'
import { buildLienDeskGates, lienSentGatesFold, lienGateMonthLine, ownerSourceWords, propertyKindLine, propertyKindRuleWords, propertyKindSwitchWarning, sharedWithWords, type LienGate, type LienGateKey, lienFootBlockedSentence, lienGateShortWords } from '../../lib/jobs/lienDeskGates'
import { rollMailingLines } from '../../lib/jobs/rollMailingLines'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { txCountyCadPropertyUrl, txCountyCadSearchUrl } from '../../lib/txCountyLookup'
import PropertyKindSwitch from './PropertyKindSwitch'
import LienClaimBox from './LienClaimBox'
import LienClaimBills from './LienClaimBills'
import { lienBillsCountWords, lienNothingBilledWords, lienUnbilled } from '../../lib/jobs/lienClaimBills'
import { useBillCustomerModal } from '../../contexts/BillCustomerModalContext'
import { jobBillingContextFromJob } from '../../lib/jobBillingContext'
import { jobLedgerHasCustomerForBilling } from '../../lib/jobLedgerCustomerForBilling'
import { claimDeltaWords, claimSplit, claimSplitWords, correctedClaim, correctionGateWords, correctionNeedsLook, correctionSendGate, correctionSetWords } from '../../lib/jobs/lienClaimCorrection'
import { clearLienClaimCorrection, lookLienClaimCorrection, saveLienClaimCorrection } from '../../lib/jobs/lienClaimCorrectionIo'
import { jobsSharingProperty, normalizePropertyKind, propertyKindWords, type PropertyKind } from '../../lib/jobs/propertyKind'
import { savePropertyKind } from '../../lib/jobs/propertyKindWrite'
import { LIEN_AFFIDAVIT_PILES, affidavitGateMissingWord, lienOwnerIsPublic, type LienAffidavitPile } from '../../lib/jobs/lienDeskAffidavits'
import { lienGateMarks, lienGateRowParts } from '../../lib/jobs/lienGateMarks'
import { LienGateMarkStrip } from './LienGateMarkStrip'

/**
 * The Lien desk: the queue of § 53.056 notices the law says are due per
 * unpaid work month on sub jobs. The office readies (owner of record) and
 * drafts; the leader approves — once per GC with a standing rule, or per
 * item — or the office sends on his spoken word with a note; approved
 * notices go out and are recorded (the run, PR 3; until then the Lien
 * window's notice tab). A page since punch list #182 (`/lien-desk`,
 * `pages/LienDeskPage.tsx`, v2.6777; every door to it since v2.6780; the
 * window frame gone since v2.6781): the page reads the address and tells
 * the desk what to show, and the desk tells the page every change.
 */

export type LienDeskProps = {
  data: LienDeskData | null
  loading: boolean
  todayYmd: string
  authRole: string | null
  authUserId: string | null
  /** The office's display name, for the spoken-word note. */
  authName: string
  /** Evidence per job — the forecast's work-months kernel over the desk's jobs. */
  workMonths: Record<string, JobWorkMonths> | null
  issuer: PhysicalInvoiceIssuer | null
  /** The signer's "Full name and title" for a job's master (else the session name) — the notice's contact person. */
  signerNameFor: (masterUserId: string | null) => string
  /** The job's master by his plain name (v2.4856): the word row and the record say *on Malachi's word*; '' when not known. */
  leaderNameFor?: (masterUserId: string | null) => string
  /** The name a signature carries for a user (v2.7395): his full name, "Malachi Whites", where `leaderNameFor` is the short one; '' when not known. */
  signatureNameFor?: (userId: string | null) => string
  /** The signer's own phone for the cover letters' `{{phone}}` (v2.3753); the letterhead's when he has none. */
  signerPhoneFor?: (masterUserId: string | null) => string
  /** Land on this job's item when given (the forecast's Send notice…, the row icon). */
  initialJobId?: string | null
  /** Re-read after any write. */
  onChanged: () => void
  /** "Find the owner" — Edit Job → Property record. */
  /** `focus` opens Edit Job on its Property record row — where the property kind is set (v2.3667). */
  onOpenEditJob: (jobId: string, focus?: 'property-record' | 'gc' | 'lien-contract') => void
  /** A plain value's door to Settings → Company (v2.3697): the claimant's name or address, landed on and ringed. */
  onOpenCompanySettings?: (field: 'companyName' | 'addressText') => void
  /** A customer's own record, to edit (punch list #305): where a general contractor's address is typed when an affidavit holds for it. */
  onOpenCustomerRecord?: (customerId: string) => void
  /** The send door until the run ships: the Lien window on its notice tab. */
  onOpenLienInstruments: (jobId: string) => void
  /** Affidavits (v2.3412): the Lien window on its affidavit tab — print for notarization, file, record. */
  onOpenLienAffidavit?: (jobId: string) => void
  /** A filed affidavit still unpaid → the Legal desk. */
  onOpenLegalDesk?: () => void
  /** Counsel's sign-off on a sent notice (#41 PR 3): the job's state on the firm's matter, and the ask. Absent when the board has no legal matters. */
  legalSignoff?: { stateFor: (jobId: string) => LegalSignoffState | null; ask: (jobId: string, text: string) => Promise<string | null> } | null
  /** Open on the affidavit kind (the Dashboard's filing-window card), the retainage kind (v2.3753), the By job tab (v2.3768) or the Calendar (v2.4101). */
  initialKind?: 'next' | 'notice' | 'affidavit' | 'retainage' | 'timeline' | 'calendar'
  /** The Calendar kind (v2.4101, punch list #55): every billed / collections job with its runway — the Pipeline hands them in; null while it reads its billed jobs and their clocks. */
  calendarRows?: ReadonlyArray<LienCalendarJob> | null
  /** A Calendar row opens the job's Lien window. */
  onOpenCalendarJob?: (jobId: string) => void
  /** The By date grid's last-day label (v2.4735): the Lien window with the last day's line already editing. */
  onOpenCalendarLastWork?: (jobId: string) => void
  /** The title bar's door for an owner who asks for our records on their property (v2.4544). */
  onOpenOwnerRecords?: () => void
  /** A job number opens the job itself: the Job window, with its history and Edit (v2.4531 the Calendar; v2.4535 the Timeline and the three panes' headings). */
  onOpenJob?: (jobId: string) => void
  /** The Calendar's pen wrote something (v2.4153): a pay date, or a property kind — the Pipeline re-reads what changed. */
  onCalendarChanged?: (what: 'promise' | 'kind' | 'last_work') => void
  /** Open on a pile — the Dashboard's missed-window line lands on the Missed lens (v2.3679). */
  initialPile?: LienDeskPile | null
  /** Bumped by a door that re-aims an open desk (v2.4612): the tab is applied even when the job is the one already named. */
  aimKey?: number
  /** The sheet's code (v2.7328, `?run=<item id>&mail=1`): open the run, and with `mail` land on that notice's Mailed box. `key` makes a second scan open it again. */
  openRun?: { itemId: string; mail: boolean; key: number } | null
  /** Put a GC on notice (v2.3470): the header door — every owner on every job with this GC, one approved run. */
  onPutGcOnNotice?: (gcId: string) => void
  /**
   * How the desk lays out (punch list #182, PR 3): `columns` is a computer's list beside its pane; `stacked` is a phone's,
   * where the Notices list is the whole desk until a notice is open, and the open notice is the whole desk with ← Notices
   * in the page door's place. Only the page names the phone; a test or another host may stack at any width.
   */
  layout?: 'columns' | 'stacked'
  /** Stacked: a press on a notice asks the page to open it (a new history entry), with the pile the list is narrowed to. */
  onOpenNotice?: (jobId: string, pile: LienDeskPile | null) => void
  /** A zoom from the Board or a job number (v2.7333) onto a paper: the page writes the address as an entry of its own, so Back returns to To do at the Board. Absent, the desk only changes its view. */
  onZoomAddress?: (address: { kind: 'notice' | 'affidavit'; job: string; pile: LienDeskPile | null }) => void
  /** Stacked: ← Notices on an open notice asks the page for the list (back one entry when the notice came from it). */
  onShowList?: () => void
  /** The page's way back, drawn before the title. */
  backDoor?: ReactNode
  /** The page's address follows the desk: the view, and on Monthly notices the open notice and the pile (never from an empty desk). */
  onAddressChange?: (address: { kind: LienDeskKind; job: string | null; pile: LienDeskPile | null }) => void
  /** A phone: the row whose job is open as its own screen (punch list #352, PR 4). The page keeps it in the history entry, so the phone's Back closes the screen; without the two handlers the desk keeps it itself. */
  openRowKey?: string | null
  onOpenRow?: (rowKey: string) => void
  onCloseRow?: () => void
}

const PILE_ORDER: LienDeskPile[] = ['needs_owner', 'to_draft', 'awaiting', 'ready', 'printed', 'held', 'sent', 'missed']

const isLeader = isLienLeader
const isOffice = isLienOffice
const canSendOnWord = canSendLienOnWord

/** The job's number alone, as the Board's chips read it (v2.7332). */
function jobNumberOf(j: LienDeskJob | undefined, jobId: string): string {
  if (!j) return jobId.slice(0, 8)
  return effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'
}

function jobLabel(j: LienDeskJob | undefined, jobId: string): string {
  if (!j) return jobId.slice(0, 8)
  const number = effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'
  const name = (j.job_name ?? '').trim()
  return name ? `${number} · ${name}` : number
}

function severityColors(sev: LienDeskEntry['severity']): { bg: string; fg: string } {
  if (sev === 'red') return { bg: 'var(--bg-red-tint)', fg: 'var(--text-red-600)' }
  if (sev === 'amber') return { bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)' }
  return { bg: 'var(--bg-subtle)', fg: 'var(--text-muted)' }
}

function deadlineWords(e: LienDeskEntry): string {
  if (e.daysLeft == null || !e.earliestDeadline) return e.missedMonths.length ? 'window closed' : ''
  if (e.daysLeft < 0) return 'window closed'
  if (e.daysLeft === 0) return 'due today'
  if (e.daysLeft === 1) return 'due tomorrow'
  if (e.daysLeft <= 14) return `due in ${e.daysLeft}d`
  return `by ${formatYmdMonthDay(e.earliestDeadline)}`
}

const chip = (bg: string, fg: string): React.CSSProperties => ({
  display: 'inline-block',
  padding: '0 6px',
  borderRadius: 5,
  fontSize: '0.68rem',
  fontWeight: 600,
  lineHeight: '18px',
  whiteSpace: 'nowrap',
  background: bg,
  color: fg,
  verticalAlign: 'middle',
})
/** Filled buttons carry a white label, so the fill is a literal that holds in both themes — the `--text-*` tokens go pale in dark mode and the label with them. */
const FILL = { primary: '#2563eb', green: '#166534', amber: '#92400e' } as const
/** The footer's state chip (v2.4855): a few words, the old sentence on hover. */
function FootChip({ chip, ...rest }: { chip: LienFootChip } & Record<`data-${string}`, string | boolean | undefined>) {
  return (
    <span className="lienFootChip" data-tone={chip.tone} title={chip.title} {...rest}>
      {chip.tone === 'green' ? <span aria-hidden="true">✓</span> : null}
      {chip.words}
    </span>
  )
}

const btn = (kind: 'primary' | 'green' | 'amber' | 'plain' = 'plain', disabled = false): React.CSSProperties => ({
  padding: '5px 10px',
  borderRadius: 7,
  border: `1px solid ${kind === 'plain' ? 'var(--border-strong)' : 'transparent'}`,
  background: kind === 'plain' ? 'var(--surface)' : FILL[kind],
  color: kind === 'plain' ? 'var(--text-700)' : '#fff',
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.55 : 1,
  whiteSpace: 'nowrap',
})
/**
 * The title bar's doors share § Rules' height (v2.4746, the owner's ask): its 0.78rem line at the root's 1.5, 2px of
 * padding above and below, and the 1px border. Send the run, Put a GC on notice…, ☎ and Share (on a computer) take it.
 */
/** A phone's tabs and chips are a thumb tall and share the row's width (punch list #352, PR 1). */
const PHONE_TAB: React.CSSProperties = LIEN_PHONE_TAB
/** A press inside a pile's title on a phone: taller and in a size a thumb reads (punch list #352, PR 5). */
const PHONE_PILE_PRESS: React.CSSProperties = { minHeight: 30, padding: '0 10px', fontSize: '0.8125rem' }
const PHONE_CHIP: React.CSSProperties = { flex: 'none', minHeight: 40, padding: '2px 14px', fontSize: '0.875rem', whiteSpace: 'nowrap' }
const headDoor: React.CSSProperties = { height: 'calc(0.78rem * 1.5 + 6px)', boxSizing: 'border-box', paddingTop: 0, paddingBottom: 0, display: 'inline-flex', alignItems: 'center' }
const boxStyle: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 9, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.35rem', background: 'var(--surface)' }
const boxHead: React.CSSProperties = { fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }
/** The page labels (v2.4726) stack like the Notices list's pile titles (v2.4651): one bar each, as tall as the pane's heads (one number since v2.7323). */
const PAGE_LABEL_H = LIEN_PANE_HEAD_H
/** The paper stays light in both themes — `data-theme="light"` re-pins the tokens and the text color (index.css). */
// A page of the paper cannot narrow past its own letterhead, so in a pane too narrow for it the page slides inside its frame (v2.7446) and never drags the pane.
const paperStyle: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '1.1rem 1.4rem', overflowX: 'auto' }
const linkBtn: React.CSSProperties = { border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: 0, whiteSpace: 'nowrap' }
/** How far into the pane the gates scroll away and the one-line strip takes over (v2.3522). */
const STRIP_COLLAPSE_PX = 72

export default function LienDesk({
  data,
  loading,
  todayYmd,
  authRole,
  authUserId,
  authName,
  workMonths,
  issuer,
  signerNameFor,
  leaderNameFor,
  signatureNameFor,
  signerPhoneFor,
  initialJobId,
  onChanged,
  onOpenEditJob,
  onOpenLienInstruments,
  onOpenLienAffidavit,
  onOpenLegalDesk,
  legalSignoff,
  initialKind,
  calendarRows,
  onOpenCalendarJob,
  onOpenJob,
  onOpenOwnerRecords,
  onCalendarChanged,
  onOpenCalendarLastWork,
  initialPile,
  aimKey,
  openRun,
  onPutGcOnNotice,
  onOpenCompanySettings,
  onOpenCustomerRecord,
  layout = 'columns',
  onOpenNotice,
  onZoomAddress,
  onShowList,
  backDoor = null,
  onAddressChange,
  openRowKey,
  onOpenRow,
  onCloseRow,
}: LienDeskProps) {
  const stacked = layout === 'stacked'
  const isMobile = useIsMobile()
  // What the title line has room for at its end (v2.7213; measured since v2.7277): all five tools, the four presses with the
  // owner-records door under them, or none. The bar reads the line it drew; the rule is `lienDeskTitleBar.ts`. None until it is drawn.
  const titleBarRef = useRef<HTMLDivElement>(null)
  const [titleLineFit, setTitleLineFit] = useState<LienDeskTitleLineFit>('none')
  // Whether By paper's pile line holds its right span beside the piles, or the span falls under them (v2.7311). One line until measured.
  const [pileLineFit, setPileLineFit] = useState<LienDeskPileLineFit>('one_line')
  // One column (the list or the pane, never both): a phone's width, or a host that stacks the desk (punch list #182 PR 3).
  const oneColumn = isMobile || stacked
  const { showToast } = useToastContext()
  // Bill Customer over the desk (v2.4969): the same window the Pipeline's Bill button opens, above every other window; null outside its provider.
  const billCustomer = useBillCustomerModal()
  const leader = isLeader(authRole)
  const office = isOffice(authRole)
  const [gcPickerOpen, setGcPickerOpen] = useState(false)
  /** The GCs on the desk right now — the picker behind Put a GC on notice… (v2.3470; rows v2.3817: how soon, what is stuck, nothing-left last). */
  const gcPickerOptions = useMemo(() => buildLienGcPickerOptions(data?.queue.entries ?? [], data?.gcsById ?? {}), [data])
  const [pile, setPile] = useState<LienDeskPile | null>(initialPile ?? null)
  // Find on the list (v2.4721): one box, one set of words, for every list on the desk; cleared when the desk closes.
  const [find, setFind] = useState('')
  const findWords = useMemo(() => lienFindWords(find), [find])
  const finding = findWords.length > 0
  // Each open starts on the pile its door names, or on every pile (v2.4568): a pile from an earlier door no longer sticks.
  useEffect(() => {
    setPile(initialPile ?? null)
  }, [initialPile])
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [checkedMonths, setCheckedMonths] = useState<ReadonlySet<string> | null>(null)
  const [coverNote, setCoverNote] = useState(true)
  // The supply houses in the owner's letter (v2.4725): on when a house is owed, unless the draft left them out.
  const [housesInLetter, setHousesInLetter] = useState(true)
  // The conditional release enclosed with the notice (v2.4729): the draft row the tick made, kept on the item's draft fields; the ref is what the next save writes.
  const [releaseId, setReleaseId] = useState<string | null>(null)
  const releaseIdRef = useRef<string | null>(null)
  // The pay offer (v2.4713): the leader's choice, written with the approval; read back from the item when one is selected.
  const [offer, setOffer] = useState<LienPayOffer | null>(null)
  const [wordOpen, setWordOpen] = useState(false)
  // The notice's own signature line (v2.5082): read when Sign and approve ▸ or Sign ▸ is pressed.
  const signRef = useRef<LienNoticeSignLineHandle>(null)
  const [wordNote, setWordNote] = useState('')
  const [wordChannel, setWordChannel] = useState<LienWordChannel>('phone')
  // Record a notice that already went out (#35 PR 2): the paper was printed here and mailed by hand.
  const [byHandOpen, setByHandOpen] = useState(false)
  // He signed the paper ▸ (the pen train, PR 2): the office writes down the leader's pen signature on a ready, unsigned notice.
  const [penOpen, setPenOpen] = useState(false)
  // The leader's way of signing the draft (v2.7324): his typed name, unless Sign another way ▾ picked the pad or his code.
  const [signWay, setSignWay] = useState<LienSignWay>('type')
  // The pen door on the draft footer (v2.7297): the draft just saved, so the pane has a row to bind the record to before the desk re-reads.
  const [penDraft, setPenDraft] = useState<{ id: string; fields: unknown } | null>(null)
  /** Counsel's sign-off ask on a sent notice (#41 PR 3). */
  const [signoffOpen, setSignoffOpen] = useState(false)
  const [signoffText, setSignoffText] = useState('')
  const [holdOpen, setHoldOpen] = useState<'promised' | 'call_first' | null>(null)
  const [rulePick, setRulePick] = useState<LienNoticePolicy | null>(null)
  // The leader's one-screen approve on a phone (v2.4881): the facts fold under Details; Not yet opens the hold reasons.
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [notYetOpen, setNotYetOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  // Autosave (v2.7327): the draft row is written about 800 ms after a change to the months, the cover box, the wording,
  // the pay lines, the enclosed release or the claim — never on open, never when nothing changed. `draftTouch` counts
  // the changes; a forward press cancels the wait and saves first, after any save in flight, so no second row is made.
  const [draftTouch, setDraftTouch] = useState(0)
  const [draftSave, setDraftSave] = useState<'idle' | 'saving' | 'saved'>('idle')
  const draftIdRef = useRef<string | null>(null)
  const autosaveRef = useRef<Promise<void> | null>(null)
  const autosaveTimerRef = useRef<number | null>(null)
  const touchDraft = () => setDraftTouch((n) => n + 1)
  const [mobileListShown, setMobileListShown] = useState(true)
  // A phone's open paper: the footer folded to one bar so the paper has the screen (punch list #352, PR 6).
  const [footFolded, setFootFolded] = useState(false)
  // The notary's print box over the Affidavits list opens folded on a phone (punch list #352, the leftovers).
  const [affPrintFolded, setAffPrintFolded] = useState(true)
  // The pile titles stack as the Notices list scrolls (v2.4672): the list's scroller, and the pile the reader is in.
  // Wording (v2.3522): the four typed values the office may shape, layered over the draft; the paper-first pane's scroll state.
  const [wordingEdits, setWordingEdits] = useState<Partial<LienNoticeFields>>({})
  const previewWinRef = useRef<Window | null>(null)
  const [previewJobId, setPreviewJobId] = useState<string | null>(null)
  // The paper is the editor (v2.3694): the value being typed, where it sits on the paper, and the font it wears there.
  const [editing, setEditing] = useState<{ key: LienNoticeFieldKey; value: string; rect: { top: number; left: number; width: number; height: number }; font: string } | null>(null)
  const paperRef = useRef<HTMLDivElement | null>(null)
  const editInputRef = useRef<HTMLInputElement | null>(null)
  // The pay page's lines (v2.4724, Taunya's ask): typed in place like the notice's wording, kept on the draft, the bill untouched.
  const [payLineEdits, setPayLineEdits] = useState<Record<string, string>>({})
  const [payEditing, setPayEditing] = useState<{ invoiceId: string; value: string; rect: { top: number; left: number; width: number; height: number }; font: string } | null>(null)
  const payPaperRef = useRef<HTMLDivElement | null>(null)
  const payInputRef = useRef<HTMLInputElement | null>(null)
  // A plain value's door (v2.3697): remember what it read when the office left, ring it on the paper when it comes back changed.
  const sourceTripRef = useRef<{ field: LienNoticeFieldKey; before: string } | null>(null)
  const [ringField, setRingField] = useState<LienNoticeFieldKey | null>(null)
  const [claimOpenSignal, setClaimOpenSignal] = useState(0)
  const [paneScrolled, setPaneScrolled] = useState(false)
  // The page labels stick under the strip while their page scrolls (v2.4726): the strip's height is measured, since its chips can wrap.
  const stripRef = useRef<HTMLDivElement | null>(null)
  // The notice pane's footer (v2.7321): the band's press brings it up when the footer's own press is the next move and needs reading first.
  const noticeFooterRef = useRef<HTMLDivElement | null>(null)
  const [stripH, setStripH] = useState(0)
  const [litPage, setLitPage] = useState<string | null>(null)
  useEffect(() => {
    setStripH(paneScrolled ? stripRef.current?.offsetHeight ?? 0 : 0)
  }, [paneScrolled, selectedJobId])
  const paneRef = useRef<HTMLDivElement | null>(null)
  // The gate being brought up (v2.3670): a cell click or the footer's Go to gate rings the cell and its section for 4s.
  const [activeGate, setActiveGate] = useState<{ key: LienGateKey; at: number } | null>(null)
  useEffect(() => {
    if (!activeGate) return
    const t = window.setTimeout(() => setActiveGate(null), 4000)
    return () => window.clearTimeout(t)
  }, [activeGate])
  const pickGate = (key: LienGateKey) => setActiveGate({ key, at: Date.now() })
  // Gate 3 as one line (v2.4718): the chooser opens on Change › and closes on a pick, so switching the kind takes two clicks on purpose.
  const [kindOpen, setKindOpen] = useState(false)
  // Gate 3's switch writes the property's kind in place (v2.3670) — the same column the property sheet and Edit Job write.
  const [kindBusy, setKindBusy] = useState(false)
  // The run (v2.3410): every approved notice as one packet + one tracking form.
  const [runOpen, setRunOpen] = useState(false)
  // The run row's Take back… (punch list #101) opens the run on its confirm.
  const [runTakeBack, setRunTakeBack] = useState(false)
  // A To do row's Print and mail (v2.7442) opens the run on its GC's approved notices alone; null is every notice.
  const [runGcId, setRunGcId] = useState<string | null>(null)
  // The sheet's code (v2.7328): the run opens on the notice the phone scanned, its Mailed box under the cursor.
  const [runFocus, setRunFocus] = useState<string | null>(null)
  useEffect(() => {
    if (!openRun) return
    setRunTakeBack(false)
    setRunFocus(openRun.mail ? openRun.itemId : null)
    setRunOpen(true)
  }, [openRun])
  // Share where the liens stand (v2.4311): the title bar's panel; the numbers are read each time it opens.
  const [shareOpen, setShareOpen] = useState(false)
  // The kind (v2.3412): notices per month, or the one affidavit per job.
  const [kind, setKind] = useState<'next' | 'notice' | 'affidavit' | 'retainage' | 'timeline' | 'calendar'>(initialKind ?? 'notice')
  // The tab row scrolls sideways on a phone (v2.4311); its cut end fades and the picked tab is scrolled into view (v2.4441) — a door can open the desk on By job, the last tab.
  const kindTabs = useScrollEdgeFade<HTMLDivElement>()
  const kindShownRef = useRef('')
  // Every render, but it acts only when the picked tab or the row's width changed (a count loading widens a label), so it never fights a hand on the row.
  useEffect(() => {
    const row = kindTabs.ref.current
    if (!row) {
      kindShownRef.current = ''
      return
    }
    const key = `${kind}:${row.scrollWidth}`
    if (key === kindShownRef.current) return
    kindShownRef.current = key
    const picked = row.querySelector<HTMLElement>('[aria-selected="true"]')
    if (picked && typeof picked.scrollIntoView === 'function') picked.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    kindTabs.onScroll()
  })
  // The By job tab (v2.3768): the book is read the first time the tab opens and kept for the modal's life.
  const [bookOpened, setBookOpened] = useState(initialKind === 'timeline')
  // The address is the truth (punch list #182): a view word changed from outside (Back, a pasted link) moves the desk, and
  // the desk's own press writes the same word back, so this never fights it.
  useEffect(() => {
    setKind(initialKind ?? 'notice')
  }, [initialKind])
  // A door can re-aim the desk (punch list #82: the job's Lien window sends its next step back here through the address).
  // The job it names is new, so its list is applied as on a fresh open. v2.4612: `aimKey` says the door was pressed again,
  // so the same job re-aims too.
  const aimedRef = useRef(`${initialJobId ?? ''}|${aimKey ?? 0}`)
  useEffect(() => {
    const next = `${initialJobId ?? ''}|${aimKey ?? 0}`
    const prev = aimedRef.current
    aimedRef.current = next
    if (initialJobId && next !== prev) {
      setKind(initialKind ?? 'notice')
      setMobileListShown(false)
      // A door onto the Affidavits list names its paper too (v2.7180: the leader's push for one affidavit).
      if (initialKind === 'affidavit') setAffSelectedJobId(initialJobId)
    }
  }, [initialJobId, initialKind, aimKey])
  // By paper (punch list #82, PR 5; All paper until v2.4630, All filings until v2.7207): the three papers share one view; it reopens on the list last looked at.
  // Four lists until v2.7219, when the job-by-job book left the row for a view of its own, By job: it is every job's path, not a kind of paper.
  const paperShown = kind === 'notice' || kind === 'affidavit' || kind === 'retainage'
  const [lastPaperKind, setLastPaperKind] = useState<'notice' | 'affidavit' | 'retainage'>('notice')
  useEffect(() => {
    if (kind === 'notice' || kind === 'affidavit' || kind === 'retainage') setLastPaperKind(kind)
  }, [kind])
  const [bookGcId, setBookGcId] = useState<string | null>(null)
  const [bookShow, setBookShow] = useState<LienBookShow>('due')
  useEffect(() => {
    if (kind === 'timeline') setBookOpened(true)
  }, [kind])
  /** ZZ test jobs off the book for every role but a dev who shows them (punch list #61, PR 3). */
  const hideZzTestJobs = useZzTestJobsHidden(authRole)
  // v2.7463: the book's read starts with the tab, beside the desk's own, and folds once the desk's items are in hand.
  const { book, loading: bookLoading, error: bookError } = useLienTimelineBook(bookOpened, todayYmd, data?.items ?? null, hideZzTestJobs)
  const [affPile, setAffPile] = useState<LienAffidavitPile | null>(null)
  // The print bar's amber press (v2.7209): the list narrowed to the ready papers a gate holds out of the print.
  const [affHeldOnlyPicked, setAffHeldOnlyPicked] = useState(false)
  // Redraw on the short form, for every ready paper at once (punch list #305): the press in flight, and the papers that did not take with their reasons.
  const [redrawBusy, setRedrawBusy] = useState(false)
  const [redrawFailed, setRedrawFailed] = useState<Array<{ jobId: string; reason: string }>>([])
  // Send every drafted affidavit for approval, then print every ready one (punch list #305, v2.6918).
  const [affSendBusy, setAffSendBusy] = useState(false)
  const [affSendFailed, setAffSendFailed] = useState<Array<{ jobId: string; reason: string }>>([])
  const confirmDialog = useConfirmDialog()
  // The retainage kind (v2.3753): the one § 53.057 notice per job with recorded retainage.
  const [retPile, setRetPile] = useState<LienRetainagePile | null>(null)
  const [retSelectedJobId, setRetSelectedJobId] = useState<string | null>(null)
  const [retFooterEl, setRetFooterEl] = useState<HTMLDivElement | null>(null)
  // Letter two (v2.3760): the sent footer's two doors — the GC's written okay, and the second letter.
  const [letterTwoMenu, setLetterTwoMenu] = useState(false)
  const [gcOkayOpen, setGcOkayOpen] = useState(false)
  const [gcOkayNote, setGcOkayNote] = useState('')
  // What they promised for the rest (punch list #274, PR 3): the footer's inline form while they are paying it down.
  const [promiseOpen, setPromiseOpen] = useState(false)
  const [promiseYmd, setPromiseYmd] = useState('')
  const [promiseAmount, setPromiseAmount] = useState('')
  const [promiseNote, setPromiseNote] = useState('')
  // The owner's call (v2.3767): the three questions, recorded on the first packet.
  const [ownerCallOpen, setOwnerCallOpen] = useState(false)
  // The courtesy notice (punch list #231): the window over the sent footer, with the facts it was opened on, and the addresses it finds.
  const [courtesyCtx, setCourtesyCtx] = useState<{ first: LienDeskItemRow; facts: CourtesyFacts; jobId: string; jobLabel: string; gcCustomerId: string | null } | null>(null)
  const [courtesyRecipients, setCourtesyRecipients] = useState<CourtesyRecipient[] | null>(null)
  /** A courtesy press whose messages went but whose record did not take (punch list #249, row 1): the footer offers the record alone until it is written. */
  const [courtesyUnrecorded, setCourtesyUnrecorded] = useState<{ jobId: string; item: Pick<LienDeskItemRow, 'id' | 'fields'>; record: CourtesyRecord; to: CourtesySent[]; reason: string } | null>(null)
  // ☎ Someone's calling (v2.3854): the door's pick — the call sheet opens on that job without selecting it.
  const [callerJobId, setCallerJobId] = useState<string | null>(null)
  // The door's practice call (v2.4249): the same sheet on a made-up letter — no job, no item, no save.
  const [practiceCallOpen, setPracticeCallOpen] = useState(false)
  // An owner is calling (v2.4731): the ☎ button opens the words, filled with the job under the reader.
  const [callScriptOpen, setCallScriptOpen] = useState(false)
  // The ? and its card (punch list #187 PR 3): what each part of the desk holds, after § Rules.
  const [legendOpen, setLegendOpen] = useState(false)
  // A phone's header is one row (punch list #352, PR 1): the doors it held are rows of the More sheet, and § Rules,
  // whose window the door itself holds on a computer, is held here so the sheet can close behind it.
  const [moreOpen, setMoreOpen] = useState(false)
  // The row open as its own screen when no page keeps it (punch list #352, PR 4).
  const [rowLocal, setRowLocal] = useState<string | null>(null)
  const [rulesOpen, setRulesOpen] = useState(false)
  /** A job the door's search just opened: the list's selection effect leaves it alone once. */
  const doorPickedJobId = useRef<string | null>(null)
  // The address can name the affidavit to open on (v2.7180), as it names a notice: `/lien-desk?tab=affidavits&job=…`.
  const [affSelectedJobId, setAffSelectedJobId] = useState<string | null>(initialKind === 'affidavit' ? (initialJobId ?? null) : null)
  // Another paper opens with its footer showing, unless the footer would leave the paper next to no room (punch list #352, PR 6; `lienPhoneFootStartsFolded`).
  const footFoldRef = useRef<HTMLButtonElement | null>(null)
  useLayoutEffect(() => {
    const bar = footFoldRef.current
    const panel = bar?.parentElement
    const foot = bar?.nextElementSibling
    setFootFolded(Boolean(bar && panel && foot instanceof HTMLElement && lienPhoneFootStartsFolded({ panel: panel.clientHeight, header: (panel.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0, bar: bar.offsetHeight, footer: foot.offsetHeight })))
  }, [kind, selectedJobId, affSelectedJobId, retSelectedJobId, mobileListShown])
  // The pane's footer lands in the desk's one footer strip through a portal (v2.3753; the strip is the pane column's
  // bottom row on a computer since the owner's ask of 2026-11-15, `lienDeskFooterHome`). It used to be
  // handed up as state from the pane's render on a microtask, which re-rendered the desk on every paint —
  // a loop the Lien affidavits tab had spun in since v2.3412 (about one render a millisecond while it was open).
  const [affFooterEl, setAffFooterEl] = useState<HTMLDivElement | null>(null)
  // The notice's footer goes the other way on a computer (v2.7422, Taunya's ask of 2026-11-15): it is the pane's last section, under a blue
  // head, so the paper has the whole pane and the reader goes through it to sign. The pane draws the section's empty body before the footer
  // is built, and the footer lands in it through a portal. A phone keeps the desk's strip under its fold bar.
  const [noticeFootHome, setNoticeFootHome] = useState<HTMLDivElement | null>(null)

  const entries = data?.queue.entries ?? []
  // Supply houses on the desk's jobs (v2.4404): a mark on a row while a house is still owed, and the card in the pane.
  const supplierJobIds = useMemo(() => {
    const ids = new Set<string>()
    for (const e of data?.queue.entries ?? []) ids.add(e.jobId)
    for (const e of data?.affidavits.entries ?? []) ids.add(e.jobId)
    for (const e of data?.retainage.entries ?? []) ids.add(e.jobId)
    for (const r of calendarRows ?? []) ids.add(r.jobId)
    return [...ids]
  }, [data, calendarRows])
  const suppliers = useLienJobSuppliers(supplierJobIds, true)
  // The conditional releases the drafts point at (v2.4729): the pane's page and the run's packet read them by row id.
  // The drawn signatures' ink by item (v2.5082), for the pane's paper and the run's.
  const inks = useLienDeskSignatureInks(data?.items ?? null, true)
  const releaseIds = useMemo(() => (data?.items ?? []).map((it) => parseLienDeskDraftFields(it.fields)?.releaseId ?? '').filter(Boolean), [data?.items])
  const releases = useNoticeReleases(releaseIds, true)
  const supplierMarks = useMemo(() => {
    const marks = new Map<string, LienSupplierMark>()
    for (const [jobId, job] of suppliers.byJob) {
      const mark = lienSupplierMark(job)
      if (mark) marks.set(jobId, mark)
    }
    return marks
  }, [suppliers.byJob])
  // What a row offers the find (v2.4721): the words it shows, plus the street and the owner it keeps quiet.
  const findFactsFor = useCallback(
    (jobId: string, gcId: string | null, shown: ReadonlyArray<string>): LienFindFacts => {
      const j = data?.jobsById[jobId]
      const g = gcId ? data?.gcsById[gcId] : undefined
      const addr = j?.customer_address_id ? data?.addressesById[j.customer_address_id] ?? null : null
      const owner = data ? lienPropertyOwnerDisplayName(resolveLienProperty(addr, data.ownerByJob[jobId] ?? null).owner).trim() : ''
      return {
        shown: [jobLabel(j, jobId), g?.name ?? '', supplierMarks.get(jobId)?.words ?? '', ...shown],
        hidden: [
          { label: 'address', text: (j?.job_address ?? '').trim() },
          { label: 'owner', text: owner },
        ].filter((h) => h.text),
      }
    },
    [data, supplierMarks],
  )
  // The Calendar's "Draft the N" (v2.4153): the notice list narrows to those jobs until the chip is cleared.
  const [calendarJobFilter, setCalendarJobFilter] = useState<{ ymd: string; jobIds: ReadonlySet<string> } | null>(null)
  // Deliveries (the Docsmit train, 6b): the Sent pile narrowed to the notices mailed through the provider, each row's tail saying where its envelopes are.
  const [deliveriesOnly, setDeliveriesOnly] = useState(false)
  const mailedJobIds = useMemo(() => jobsWithMailPieces(entries, data?.mailPiecesByFiling ?? {}), [entries, data?.mailPiecesByFiling])
  const visibleAll = useMemo(() => {
    // Missed is a lens (v2.3679): a job in To draft with a closed month shows under it too.
    const scoped = calendarJobFilter ? entries.filter((e) => calendarJobFilter.jobIds.has(e.jobId)) : entries
    const list = pile ? scoped.filter((e) => e.pile === pile || (pile === 'missed' && e.missedMonths.length > 0)) : scoped
    const mailed = deliveriesOnly ? list.filter((e) => e.pile !== 'sent' || mailedJobIds.has(e.jobId)) : list
    return PILE_ORDER.flatMap((p) => mailed.filter((e) => e.pile === p))
  }, [entries, pile, calendarJobFilter, deliveriesOnly, mailedJobIds])
  // The find narrows the list (v2.4721); the hidden facts it landed on ride beside each row.
  const { visible, findHits } = useMemo(() => {
    const hits = new Map<string, LienFindFact[]>()
    if (!finding) return { visible: visibleAll, findHits: hits }
    const kept = visibleAll.filter((e) => {
      const m = lienFindMatch(findFactsFor(e.jobId, e.gcCustomerId, [e.dueMonths.map(workMonthShort).join(' '), e.missedMonths.map(workMonthShort).join(' '), LIEN_DESK_PILES.find((x) => x.key === e.pile)?.label ?? '']), findWords)
      if (m.ok && m.hits.length) hits.set(e.jobId, m.hits)
      return m.ok
    })
    return { visible: kept, findHits: hits }
  }, [visibleAll, finding, findWords, findFactsFor])
  // A narrowed pile that empties under an act widens by itself (v2.4854): the leader approves the last
  // awaiting notice and the list shows every pile, instead of "Nothing in this pile." A pile a door opens
  // empty stays narrowed and says so, with its own door out.
  const pileHadRowsRef = useRef<LienDeskPile | null>(null)
  useEffect(() => {
    if (!pile) {
      pileHadRowsRef.current = null
      return
    }
    if (visibleAll.length > 0) pileHadRowsRef.current = pile
    else if (pileHadRowsRef.current === pile && !loading && data) {
      pileHadRowsRef.current = null
      setPile(null)
    }
  }, [pile, visibleAll.length, loading, data])
  // One match selects itself (v2.4721).
  useEffect(() => {
    const one = lienFindSingle(visible, finding)
    if (one) setSelectedJobId(one)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finding, visible.map((e) => e.jobId).join('|')])

  // Selection follows the list: the requested job, else the first visible row (desktop). Stacked (a phone, punch list #182
  // PR 3), the address is the list or one notice: no job in it means the list, whatever was picked before.
  useEffect(() => {
    if (stacked && !initialJobId) {
      setSelectedJobId(null)
      setMobileListShown(true)
      return
    }
    if (initialJobId && entries.some((e) => e.jobId === initialJobId)) {
      setSelectedJobId(initialJobId)
      setMobileListShown(false)
      return
    }
    if (doorPickedJobId.current && visible.some((e) => e.jobId === doorPickedJobId.current)) {
      doorPickedJobId.current = null
      return
    }
    doorPickedJobId.current = null
    if (selectedJobId && visible.some((e) => e.jobId === selectedJobId)) return
    setSelectedJobId(!oneColumn && visible[0] ? visible[0].jobId : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stacked, initialJobId, visible.map((e) => e.jobId).join('|')])

  const selected = visible.find((e) => e.jobId === selectedJobId) ?? entries.find((e) => e.jobId === selectedJobId) ?? null
  useEffect(() => setStopOpen(null), [selectedJobId])
  // The page's address (punch list #182): the view, and on Monthly notices the open notice and the pile. The notice a door named
  // counts before the selection catches up to it, so a pasted `&job=` is never dropped on the way in; the callback is read
  // through a ref so a changed callback alone never rewrites the address.
  const onAddressChangeRef = useRef(onAddressChange)
  onAddressChangeRef.current = onAddressChange
  const addressJob = kind === 'notice' ? (selectedJobId ?? (initialJobId && entries.some((e) => e.jobId === initialJobId) ? initialJobId : null)) : null
  const addressPile = kind === 'notice' ? pile : null
  const hasData = data != null
  useEffect(() => {
    if (!hasData) return
    onAddressChangeRef.current?.({ kind, job: addressJob, pile: addressPile })
  }, [hasData, kind, addressJob, addressPile])
  const job = selected ? data?.jobsById[selected.jobId] : undefined
  const gc = selected?.gcCustomerId ? data?.gcsById[selected.gcCustomerId] : undefined
  const address = job?.customer_address_id ? data?.addressesById[job.customer_address_id] ?? null : null
  const ownerRow = selected ? data?.ownerByJob[selected.jobId] ?? null : null
  const property = useMemo(() => resolveLienProperty(address ?? null, ownerRow ?? null), [address, ownerRow])
  const ownerName = lienPropertyOwnerDisplayName(property.owner)
  /** "Click" — who "us" is on the phone. */
  const callerUs = ((issuer?.companyName ?? '').trim() || DEFAULT_CLAIMANT_NAME).split(/\s+/)[0] || 'us'
  const callerInput = useMemo<CallerMatchInput | null>(() => {
    if (!data) return null
    return { items: data.items, jobsById: data.jobsById, gcsById: data.gcsById, addressesById: data.addressesById, ownerByJob: data.ownerByJob, letterTwoByJob: data.letterTwoByJob, us: callerUs }
  }, [data, callerUs])
  // The find box reaches every notice the desk ever sent (v2.4731): the ☎ index, under the piles, less the jobs the list already shows.
  const sentIndex = useMemo(() => (callerInput ? callerIndex(callerInput, { day: formatYmdMonthDay }) : null), [callerInput])
  const alsoSent = useMemo<CallerOwnerHit[]>(() => {
    if (!finding || !sentIndex) return []
    const shown = new Set(visible.map((e) => e.jobId))
    return findOnDesk(find, sentIndex).sent.filter((h) => !shown.has(h.jobId))
  }, [finding, find, sentIndex, visible])
  // The courtesy notice per job with a sent notice (punch list #231): one kernel with the Accounts Receivable chips (`lienCourtesyDesk.ts`), so the row and the chip agree. No read of its own.
  const courtesyByJob = useMemo(() => (data ? courtesyByJobFrom({ todayYmd, letterTwoByJob: data.letterTwoByJob, items: data.items, entries: data.queue.entries, jobsById: data.jobsById, addressesById: data.addressesById, affidavits: data.affidavits.entries, filingsByJob: data.filingsByJob, paymentsByJob: data.paymentsByJob, promisesByJob: data.promisesByJob, repliedAtByJob: data.courtesyRepliedAtByJob }) : {}), [data, todayYmd])
  // To do (punch list #82; Next up until v2.4630, Do now until v2.7207): the queues this desk already holds, folded into one ordered list. No read of its own.
  // The REMINDERS strip (punch list #262): every sent notice's rung from the two statuses above; the To do rail draws its counts, a rung pressed lists its names. No read of its own.
  // Filed affidavits not yet served (§ 53.055): To do's record-service rows.
  const serveDue = useMemo(
    () =>
      data
        ? Object.values(data.filingsByJob)
            .flat()
            .filter((f) => f.kind === 'affidavit' && f.filed_at && !f.served_at && !f.voided_at && f.serve_due)
            .map((f) => ({ jobId: f.job_id, serveDue: f.serve_due as string }))
        : [],
    [data],
  )
  const nextUpRows = useMemo(() => {
    if (!data) return []
    return buildLienNextUp({
      notices: data.queue.entries,
      affidavits: data.affidavits.entries,
      retainage: data.retainage.entries,
      letterTwoByJob: data.letterTwoByJob,
      courtesyByJob,
      serveDue,
      role: authRole,
      todayYmd,
      jobTitle: (jobId) => jobLabel(data.jobsById[jobId], jobId),
      gcName: (gcId) => data.gcsById[gcId]?.name ?? 'A GC',
      leaderName: (jobId) => leaderNameFor?.(data.jobsById[jobId]?.master_user_id ?? null)?.trim() || null,
      userName: (userId) => leaderNameFor?.(userId)?.trim() || null,
      mailNeedsYou: mailNeedsYouRows(data.filingsByJob, data.mailPiecesByFiling ?? {}, formatYmdMonthDay),
      // The months the live notices name, by job (punch list #353, part 2): a To draft row with a notice on record names the owed month beside them.
      noticeMonthsByJob: Object.fromEntries(Object.entries(data.filingsByJob).map(([jobId, fs]) => [jobId, lienNoticeNamedMonths(fs)])),
      // v2.6734 (punch list #150): a leader's own rows are the jobs he is master of; another master's read as the office's.
      viewerUserId: authUserId,
      masterUserId: (jobId) => data.jobsById[jobId]?.master_user_id ?? null,
    })
  }, [data, authRole, authUserId, todayYmd, leaderNameFor, courtesyByJob, serveDue])
  // Whether this viewer is the leader a row's job waits on (v2.6734): the step tiles and the step card say *you* only then.
  const leadsRow = (row: LienNextUpRow): boolean => lienViewerLeadsJob({ role: authRole, viewerUserId: authUserId, masterUserId: (jobId) => data?.jobsById[jobId]?.master_user_id ?? null }, row.jobId)
  // The Board (v2.7332, the owner's ask of 2026-11-15): the month as one picture over the list, in the place of The lien
  // month strip (punch list #235) and Steps of each paper (v2.4631). The leader the tiles name is the master most of the
  // desk's jobs wait on; a pressed bin narrows the list under the Board to its jobs, as a pressed rung did.
  const boardLeaderName = useMemo(() => {
    if (!data || !leaderNameFor) return null
    const tally = new Map<string, number>()
    for (const e of [...data.queue.entries, ...data.affidavits.entries]) {
      const id = data.jobsById[e.jobId]?.master_user_id
      if (id) tally.set(id, (tally.get(id) ?? 0) + 1)
    }
    const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    return top ? leaderNameFor(top)?.trim() || null : null
  }, [data, leaderNameFor])
  const board = useMemo(
    () =>
      data
        ? buildLienBoard({
            todayYmd,
            notices: data.queue.entries,
            affidavits: data.affidavits.entries,
            retainage: data.retainage.entries,
            jobNumber: (jobId) => jobNumberOf(data.jobsById[jobId], jobId),
            jobName: (jobId) => (data.jobsById[jobId]?.job_name ?? '').trim(),
            gcName: (gcId) => data.gcsById[gcId]?.name ?? '',
            leaderName: boardLeaderName,
            publicJobIds: data.publicAskJobIds,
          })
        : null,
    [data, todayYmd, boardLeaderName],
  )
  // Public property (v2.7443, Taunya's ask of 2026-11-16): the line over the Board for the jobs on a property that reads
  // as public, unanswered, with a paper still open, and the bin for the jobs already off the lien path.
  const publicLine = useMemo(() => {
    if (!data || !board) return null
    const chips = [...board.notices, ...board.affidavits].flatMap((b) => b.chips).filter((c) => c.stage !== 'sent' && c.stage !== 'filed')
    return lienPublicBoardLine({
      askingJobIds: data.publicAskJobIds ?? new Set<string>(),
      openPaperJobIds: new Set(chips.map((c) => c.jobId)),
      unpaidOf: (jobId) => chips.find((c) => c.jobId === jobId)?.openBalance ?? 0,
      addressIdOf: (jobId) => data.jobsById[jobId]?.customer_address_id ?? null,
    })
  }, [data, board])
  const publicBin = useMemo(() => buildLienPublicBin(data?.publicJobs ?? []), [data])
  // The properties left to review, one window at a time; and the property being put back on the lien path.
  const [publicReview, setPublicReview] = useState<string[] | null>(null)
  const [publicPutBack, setPublicPutBack] = useState<string | null>(null)
  const [boardBins, setBoardBins] = useState<LienBoardBinKey[] | null>(null)
  // The leader's Board (v2.7334): a master opens on his two Awaiting Master approval bins alone, the jobs he leads, with one
  // counted press for the lot; a dev, who reads every job, opens on every bin. Session-only; the bar's press switches.
  const [boardMine, setBoardMine] = useState<boolean>(() => authRole === 'master_technician')
  const leaderView = useMemo(() => (board && leader ? lienBoardForLeader(board, { leads: (jobId) => lienViewerLeadsJob({ role: authRole, viewerUserId: authUserId, masterUserId: (id) => data?.jobsById[id]?.master_user_id ?? null }, jobId) }) : null), [board, leader, authRole, authUserId, data])
  const [approvingLot, setApprovingLot] = useState(false)
  /**
   * The leader's one press (v2.7334): approves every affidavit that waits on him inside its window, one by one, keeps
   * going past one that fails and names it after, and leaves what is held where it is with its reason (a notice takes
   * his signature on its own pane; a paper past its day sends nothing on time). Asks first with the count.
   */
  const approveTheLot = async () => {
    if (!leaderView || leaderView.press.dead || approvingLot) return
    const ready = leaderView.chips.filter((c) => c.kind === 'affidavit')
    const items = ready.map((c) => data?.affidavits.entries.find((e) => e.jobId === c.jobId)?.item?.id ?? null).filter((id): id is string => Boolean(id))
    if (items.length === 0) return
    const n = items.length
    const ok = await confirmDialog({
      title: `Approve ${n} ${n === 1 ? 'affidavit' : 'affidavits'}?`,
      message: `${ready.map((c) => c.label).join(', ')}. Each is marked approved and moves to Ready to file. ${leaderView.held.length ? `${leaderView.held.length} ${leaderView.held.length === 1 ? 'stays' : 'stay'} where ${leaderView.held.length === 1 ? 'it is' : 'they are'} with the reason.` : ''}`.trim(),
      confirmLabel: leaderView.press.button.replace(/ ·.*$/, ''),
    })
    if (!ok) return
    setApprovingLot(true)
    let done = 0
    const failed: string[] = []
    try {
      for (const [i, id] of items.entries()) {
        try {
          await approveLienDeskItem(id)
          done += 1
        } catch (e) {
          failed.push(`${ready[i]?.label ?? id}: ${formatErrorMessage(e, 'did not approve')}`)
        }
      }
      const words = batchOutcomeWords({ verb: 'approve', past: 'approved', done, failed: failed.length, noun: 'affidavit' })
      showToast(failed.length ? `${words.line} ${failed.join(' · ')}` : words.line, words.tone)
      if (done > 0) onChanged()
    } finally {
      setApprovingLot(false)
    }
  }
  // The day tile's red line, pressed (v2.7371): the list shows only the papers that will not make their day as they stand.
  const [boardRisk, setBoardRisk] = useState(false)
  // The second tile's press (v2.7448): every paper that waits on the leader, to approve or to sign, as the tile counts them.
  const [boardLeader, setBoardLeader] = useState(false)
  const boardPick = useMemo(() => (board && boardRisk ? lienBoardRiskPick(board) : board && boardLeader ? lienBoardLeaderPick(board, boardLeaderName) : board && boardBins ? lienBoardPick(board, boardBins) : null), [board, boardBins, boardRisk, boardLeader, boardLeaderName])
  // The same rule orders the list (punch list #362, step 2): a row whose paper the Board marks stands first under Needs you now.
  const riskPapers = useMemo(() => (board ? lienBoardRiskPapers(board) : new Map<string, number>()), [board])
  const rowRisk = useCallback((row: LienNextUpRow) => lienBoardRowRisk(riskPapers, row), [riskPapers])
  // A computer's row starts with its paper's bin, in the Board's words, and an affidavit row says where its notice stands (v2.7372, step 3).
  const rowStage = useCallback((row: LienNextUpRow) => (board ? lienBoardRowStage(board, row) : null), [board])
  // The bin itself, for a computer's list in the Board's order (punch list #362, step 4).
  const rowBin = useCallback((row: LienNextUpRow) => (board ? lienBoardRowBin(board, row) : null), [board])
  const rowNotice = useCallback(
    (row: LienNextUpRow): LienRowTag | null => {
      if (!data || row.kind !== 'affidavit' || !row.jobId) return null
      const entry = data.affidavits.entries.find((e) => e.jobId === row.jobId)
      if (!entry) return null
      return lienAffidavitNoticeTag({ isSub: entry.isSub, noticed: Boolean(entry.gates.find((g) => g.key === 'notice')?.ok), sentOn: lienAffidavitOwnerSends(data.filingsByJob[row.jobId]).map((send) => send.sentOn) })
    },
    [data],
  )
  // A chip pointed at says which job it is before the press takes anyone anywhere (v2.7381, Taunya's ask of 2026-11-15):
  // the job's name, address and customer, and its paper's status, with the one thing to know as its To do row says it.
  const chipCardFor = useCallback(
    (chip: LienBoardChip) => {
      if (!data || !board) return null
      const job = data.jobsById[chip.jobId]
      const gcId = chip.gcId ?? job?.gc_customer_id ?? null
      const row = nextUpRows.find((r) => r.key === `${chip.kind}:${chip.jobId}`)
      return lienBoardChipCard(chip, board, { todayYmd, jobName: job?.job_name, address: job?.job_address, customer: job?.customer_name, gc: gcId ? data.gcsById[gcId]?.name : null, detail: row ? (row.detail ?? row.sub) : null, leader: leaderNameFor?.(job?.master_user_id ?? null) })
    },
    [data, board, nextUpRows, todayYmd, leaderNameFor],
  )
  const riskLabel = useCallback(
    (n: number) => {
      const phrase = lienBoardRiskPhrase(board?.dayWords ?? null, n)
      return `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)}`
    },
    [board],
  )
  // To do on a phone scrolls the Board, the find box and the list as one page (punch list #352, PR 0): under five
  // stacked month cards a list that took what was left got a window 26 px tall, and no row could be reached. The
  // same holds wherever the Board's columns stack (the 768 px tablet, 2026-11-15): the Board is then taller than
  // the screen, so the page scrolls as one and the list is not its own scroller.
  const [boardStacked, setBoardStacked] = useState(false)
  const doNowRef = useRef<HTMLDivElement | null>(null)
  // A computer too, wherever the Board leaves the list too little room (v2.7367, punch list #362 step 1): measured
  // on 2026-11-15, the list had 91 px under the Board at 1440 x 900. There the find box pins as the list comes up
  // (`LienDoNowBar`), with the Board's numbers and the way back; a screen tall enough for both keeps the Board put.
  const doNowRoom = useLienDoNowRoom(doNowRef, kind === 'next' && Boolean(board))
  const doNow = lienDoNowFrame(oneColumn || boardStacked, doNowRoom)
  // The bar pins on the wide desk only: a phone and the stacked desk keep their find box in the page, as before.
  const doNowBarPins = doNow.mode === 'one-page' && !oneColumn && !boardStacked
  const doNowBarParts = useMemo(() => (board ? lienDoNowBarParts(board) : []), [board])
  // There a pressed bin also brings its rows up, since the Board fills the screen and the narrowed list is under it.
  const [pickBringsRows, setPickBringsRows] = useState(0)
  const pickBoardBins = useCallback((bins: LienBoardBinKey[] | null) => {
    setBoardBins((prev) => (bins && prev && prev.join('|') === bins.join('|') ? null : bins))
    setBoardRisk(false)
    setBoardLeader(false)
    if (bins) setPickBringsRows((n) => n + 1)
  }, [])
  const pickBoardRisk = () => {
    setBoardBins(null)
    setBoardLeader(false)
    setBoardRisk(!boardRisk)
    if (!boardRisk) setPickBringsRows((n) => n + 1)
  }
  const pickBoardLeader = () => {
    setBoardBins(null)
    setBoardRisk(false)
    setBoardLeader(!boardLeader)
    if (!boardLeader) setPickBringsRows((n) => n + 1)
  }
  // A tile's press, and the same count's press on the pinned find box (v2.7367): the run, the stage on both columns, or (v2.7371) the red line's papers.
  const openBoardTile = (d: LienBoardTileDestination) => {
    if (d.kind === 'risk') pickBoardRisk()
    else if (d.kind === 'leader') pickBoardLeader()
    else if (d.kind === 'run') {
      if (office) {
        setRunTakeBack(false)
        setRunOpen(true)
      }
    }
  }
  useEffect(() => {
    if (pickBringsRows === 0 || doNow.mode !== 'one-page') return
    const scroller = doNowRef.current
    if (!scroller) return
    if (!doNowBarPins) {
      scroller.querySelector<HTMLElement>(LIEN_DO_NOW_ROWS_SELECTOR)?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
      return
    }
    // Where the find box pins, the page goes to the Board's bottom edge: the narrowed list starts right under the bar.
    const boardEl = scroller.querySelector<HTMLElement>('[data-lien-board]')
    if (!boardEl) return
    const top = lienDoNowListTop({ boardBottom: boardEl.getBoundingClientRect().bottom, scrollerTop: scroller.getBoundingClientRect().top, scrollTop: scroller.scrollTop })
    if (typeof scroller.scrollTo === 'function') scroller.scrollTo({ top, behavior: 'smooth' })
    else scroller.scrollTop = top
  }, [pickBringsRows, doNow.mode, doNowBarPins])
  // The title is a door (v2.7332): from any view it opens To do scrolled to the Board.
  const [boardBring, setBoardBring] = useState(0)
  useEffect(() => {
    if (boardBring === 0 || kind !== 'next') return
    doNowRef.current?.querySelector<HTMLElement>('[data-lien-board]')?.scrollIntoView?.({ block: 'start' })
  }, [boardBring, kind])
  // The office's waiting rows (punch list #101 PR 3) close the list under the leader's name when they share one.
  const nextUpWaitingOn = useMemo(() => {
    if (!data || !leaderNameFor) return null
    const names = new Set(nextUpRows.filter((r) => r.action === 'approve' && !r.button && r.jobId).map((r) => leaderNameFor(data.jobsById[r.jobId!]?.master_user_id ?? null)?.trim() || ''))
    return names.size === 1 ? [...names][0] || null : null
  }, [data, nextUpRows, leaderNameFor])
  /**
   * The press on the waiting rows' head (v2.7371, punch list #362 step 2; Taunya's ask that *Waiting on the leader* be
   * something a person can act on): reminds the leader of every paper that waits on an approval, by the message its
   * send for approval sent. A notice is one message, the affidavits one for the lot; a paper with nothing to point at
   * stays out with its reason. Asks first, keeps going past one that fails, and names it after. Nothing is written.
   */
  const waitingRows = useMemo(() => nextUpRows.filter((r) => r.action === 'approve' && !r.button && r.jobId), [nextUpRows])
  const reminderPlan = useMemo(() => {
    if (!data) return null
    return lienReminderPlan(
      waitingRows.map((r) => {
        const notice = r.kind === 'notice' ? data.queue.entries.find((e) => e.jobId === r.jobId) : undefined
        const affidavit = r.kind === 'affidavit' ? data.affidavits.entries.find((e) => e.jobId === r.jobId) : undefined
        return { kind: r.kind, label: r.title, itemId: notice?.item?.id ?? affidavit?.item?.id ?? null, dueYmd: notice?.earliestDeadline ?? affidavit?.deadline ?? null }
      }),
    )
  }, [data, waitingRows])
  const [reminding, setReminding] = useState(false)
  // When this session last sent the reminder, and for which rows: the press then says so and is dead until the rows change.
  const [reminded, setReminded] = useState<{ at: string; keys: string } | null>(null)
  const waitingKeys = waitingRows.map((r) => r.key).join('|')
  const reminderWords = reminderPlan ? lienReminderWords(reminderPlan, nextUpWaitingOn, reminded && reminded.keys === waitingKeys ? reminded.at : null) : null
  const remindLeader = async () => {
    if (!reminderPlan || !reminderWords || reminderWords.dead || reminding) return
    if (!(await confirmDialog({ title: reminderWords.title, message: reminderWords.message, confirmLabel: reminderWords.confirmLabel }))) return
    setReminding(true)
    let done = 0
    const failed: Array<{ label: string; reason: string }> = []
    try {
      // A reminder counts only when a message went (v2.7445): the function answers 200 when it sends nothing, and the tally reads why.
      for (const p of reminderPlan.notices) {
        const t = lienReminderTally(await tellLeaderOfLienApproval(p.itemId, p.dueYmd, { remind: true }), 1)
        done += t.done
        if (t.reason) failed.push({ label: p.label, reason: t.reason })
      }
      if (reminderPlan.affidavits.length > 0) {
        const t = lienReminderTally(await tellLeaderOfLienAffidavits(reminderPlan.affidavits.map((p) => ({ itemId: p.itemId, dueYmd: p.dueYmd })), { remind: true }), reminderPlan.affidavits.length)
        done += t.done
        if (t.reason) failed.push({ label: lienReminderAffidavitLabel(reminderPlan.affidavits.map((p) => p.label), t.missed), reason: t.reason })
      }
      const said = lienReminderOutcome({ done, failed }, nextUpWaitingOn)
      showToast(said.line, said.tone)
      if (done > 0) setReminded({ at: formatDenverTimeOnly(Date.now()), keys: waitingKeys })
    } finally {
      setReminding(false)
    }
  }
  // The paper behind a To do chip (v2.4632): the notice or the affidavit as it stands, every statutory blank marked.
  const [paperOpen, setPaperOpen] = useState<number | null>(null)
  // A stop's paper (v2.4793): the index of the timeline stop whose window is open on the notice pane; null when closed.
  const [stopOpen, setStopOpen] = useState<number | null>(null)
  const paperRows = useMemo(() => nextUpRows.filter((r) => r.jobId && r.kind !== 'retainage'), [nextUpRows])
  // Fix it from the paper (v2.4719): the window stacked over the paper, and the blanks the row had when it opened.
  const [paperFix, setPaperFix] = useState<{ index: number; window: LienPaperFixWindow; gap: LienPaperGap } | null>(null)
  // The affidavit pane's gate doors open the same window over the desk (v2.4724).
  const [paneFix, setPaneFix] = useState<{ jobId: string; focus: 'owner' | 'legal' | 'homestead_answer' } | null>(null)
  const [paperFilledFrom, setPaperFilledFrom] = useState<{ key: string; gaps: ReadonlyArray<LienPaperGap> } | null>(null)
  // A fix can move the row (a whole property turns "Fix the property" into "Draft affidavit"): the paper stays on it by key.
  useEffect(() => {
    if (!paperFilledFrom) return
    const at = paperRows.findIndex((r) => r.key === paperFilledFrom.key)
    if (at >= 0) setPaperOpen((cur) => (cur == null || cur === at ? cur : at))
  }, [paperRows, paperFilledFrom])
  // A run row (punch list #101) is found by any job inside it.
  const nextUpRowsFound = useMemo(
    () =>
      finding
        ? nextUpRows.filter(
            (r) =>
              lienFindMatch(r.jobId ? findFactsFor(r.jobId, r.gcId, [r.title, r.sub]) : { shown: [r.title, r.sub], hidden: [] }, findWords).ok ||
              (r.jobs ?? []).some((j) => lienFindMatch(findFactsFor(j.jobId, null, [j.title]), findWords).ok),
          )
        : nextUpRows,
    [nextUpRows, finding, findWords, findFactsFor],
  )
  const nextUpRowsShown = useMemo(() => (boardPick ? nextUpRowsFound.filter((r) => lienBoardRowInPick(boardPick, r)) : nextUpRowsFound), [nextUpRowsFound, boardPick])
  const paperFactsFor = (row: LienNextUpRow): LienPaperFacts | null => {
    if (!data || !row.jobId) return null
    const rowJob = data.jobsById[row.jobId]
    const rowAddress = rowJob?.customer_address_id ? data.addressesById[rowJob.customer_address_id] ?? null : null
    const prop = resolveLienProperty(rowAddress, data.ownerByJob[row.jobId] ?? null)
    const rowGc = row.gcId ? data.gcsById[row.gcId] : undefined
    const affidavitEntry = row.kind === 'affidavit' ? data.affidavits.entries.find((x) => x.jobId === row.jobId) : undefined
    return {
      ownerName: lienPropertyOwnerDisplayName(prop.owner),
      ownerAddress: prop.owner.mailingAddress,
      county: prop.county,
      legalDescription: prop.legalDescription,
      // The affidavit names the original contractor by the paper's own rule: on a job contracted with the owner that is our company, so no GC is a blank to pick.
      gcName: affidavitEntry ? lienOriginalContractor({ isSub: affidavitEntry.isSub, gcName: rowGc?.name, issuer }).name : rowGc?.name ?? '',
      contactPerson: signerNameFor(rowJob?.master_user_id ?? null),
      claimantAddress: (issuer?.addressText ?? '').trim(),
      affidavitGates: affidavitEntry?.gates.map((g) => ({ key: g.key, ok: g.ok })),
    }
  }
  const paperGapCount = (row: LienNextUpRow): number | null => {
    if (row.kind === 'retainage') return null
    const f = paperFactsFor(row)
    return f ? lienPaperGaps(row.kind, f).length : null
  }
  const paperEntries = useMemo<LienPaperPreviewEntry[]>(() => {
    if (paperOpen == null || !data) return []
    return paperRows.map((row): LienPaperPreviewEntry => {
      const jobId = row.jobId as string
      const rowJob = data.jobsById[jobId]
      const rowAddress = rowJob?.customer_address_id ? data.addressesById[rowJob.customer_address_id] ?? null : null
      const prop = resolveLienProperty(rowAddress, data.ownerByJob[jobId] ?? null)
      const rowGc = row.gcId ? data.gcsById[row.gcId] : undefined
      const f = paperFactsFor(row)!
      const kind = row.kind === 'affidavit' ? 'affidavit' : 'notice'
      const gaps = lienPaperGaps(kind, f)
      const jobNo = rowJob ? effectiveJobLedgerNumber(rowJob.hcp_number, rowJob.click_number) : ''
      const letterhead = filingLetterheadFromIssuer(issuer)
      const correction = data.claimCorrectionsByJob[jobId] ?? null
      const at = lienStepOfRow(row)
      const next = (at ? LIEN_STEP_LADDERS.find((l) => l.key === at.ladder)?.steps[at.step - 1] : row.button) ?? 'the next step'
      const gapByField = (field: string) => gaps.find((g) => g.field === field)
      const filledGaps = paperFilledFrom?.key === row.key ? lienPaperFilledSince(paperFilledFrom.gaps, gaps) : []
      const filledValue = (k: LienPaperGap['key']): string => (k === 'county' ? f.county : k === 'legal' ? f.legalDescription : k === 'owner' ? [f.ownerName, f.ownerAddress].filter(Boolean).join(', ') : k === 'owner_address' ? f.ownerAddress : k === 'gc' ? f.gcName : '')
      const filled = filledGaps.map((g) => ({ key: g.key, label: g.label, value: filledValue(g.key) }))
      const filledKeys = new Set(filledGaps.map((g) => g.key))
      if (kind === 'affidavit') {
        const e = data.affidavits.entries.find((x) => x.jobId === jobId)
        const fields = buildLienDeskAffidavitFields({ job: rowJob, entry: e, gc: rowGc, ownerName: f.ownerName, ownerAddress: f.ownerAddress, county: prop.county, legalDescription: prop.legalDescription, correction, contactPerson: f.contactPerson, issuer, todayYmd, form: lienAffidavitFormForItem(e?.item), filings: data.filingsByJob[jobId] ?? [], homestead: prop.homestead, monthsByHand: data.affidavitMonthsByJob[jobId]?.months ?? null })
        const html = paintGaps(filingDocHtml(buildLienAffidavitBlocks(withGapTokens(withFreshMarks(fields, filledGaps), gaps), { letterhead, refItems: [`Job #${jobNo}`, e ? `Last work month ${e.lastMonth}` : '', demandDate(todayYmd)].filter(Boolean) })), gaps)
        return { key: row.key, title: row.title, kind, deadline: lienStepDueWords(row), envelope: null, html, gaps, next, button: row.action === 'fix_property' ? row.button : null, filled }
      }
      const e = data.queue.entries.find((x) => x.jobId === jobId)
      const stored = e?.item ? parseLienDeskDraftFields(e.item.fields) : null
      const claimed = correctedClaim(e?.openBalance ?? 0, correction)
      const defaults = buildLienNoticeFieldsForJob({
        jobName: rowJob?.job_name,
        jobAddress: rowJob?.job_address,
        homesteadStatement: homesteadStatementApplies(prop),
        originalContractorName: rowGc?.name ?? '',
        openBalance: claimed.claim,
        contactPerson: f.contactPerson,
        issuer,
        todayYmd,
        retainageHeld: rowJob?.lien_retainage_held ?? null,
        serviceTypeName: rowJob?.service_type?.name,
      })
      const fields: LienNoticeFields = { ...(stored?.notice ?? defaults), claimAmount: defaults.claimAmount }
      const months = e?.item?.months?.length ? e.item.months : e?.dueMonths ?? []
      const html = paintGaps(filingDocHtml(buildLienNoticeBlocks(withGapTokens(withFreshMarks(fields, filledGaps), gaps), { letterhead, refItems: [`Job #${jobNo}`, months.length ? `Work months ${describeNoticeMonths(months)}` : '', demandDate(todayYmd)].filter(Boolean) })), gaps)
      const ownerGap = gaps.find((g) => g.where === 'envelope')
      const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)
      const ownerWords = esc([f.ownerName, f.ownerAddress].filter(Boolean).join(', '))
      const ownerHtml = ownerGap ? paintGaps(gapToken(ownerGap.n), gaps) : filledKeys.has('owner') || filledKeys.has('owner_address') ? freshHtml(ownerWords) : ownerWords
      const gcGap = gapByField('originalContractorName')
      const gcWords = esc([rowGc?.name ?? '', rowGc?.address ?? ''].filter(Boolean).join(', '))
      const gcHtml = gcGap ? paintGaps(gapToken(gcGap.n), gaps) : filledKeys.has('gc') ? freshHtml(gcWords) : gcWords
      return { key: row.key, title: row.title, kind, deadline: lienStepDueWords(row), envelope: { ownerHtml, gcHtml }, html, gaps, next, button: row.action === 'find_owner' ? row.button : null, filled }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperOpen, paperRows, data, issuer, todayYmd, paperFilledFrom])
  /**
   * The *paper named it too* door (punch list #353, part 2): the owed months join the recorded notice's months, after the
   * office confirms the paper as mailed named them. The one write a To do row makes, and it asks first.
   */
  const correctNoticeMonths = async (jobId: string, months: string[]) => {
    const filing = lienNoticeToExtend(data?.filingsByJob[jobId] ?? [])
    if (!filing) {
      showToast('No recorded notice on this job to correct.', 'error')
      return
    }
    const words = lienNoticeOwedConfirmWords(months, filing.months_covered ?? [])
    if (!(await confirmDialog({ title: words.title, message: words.message, confirmLabel: words.confirmLabel }))) return
    try {
      const after = await addMonthsToLienNotice(filing, months)
      showToast(`The notice on record now names ${describeNoticeMonths(after)}.`, 'success')
      onChanged()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not add the months to the record.'), 'error')
    }
  }
  /** A To do row's button: the pane that already does that work, on that job and pile. Nothing is written here but the record's months, which ask first. */
  const actOnNextUp = (row: LienNextUpRow) => {
    const t = row.target
    setMobileListShown(false)
    // A held affidavit's press answers its one question (v2.7372): the property record opens at the missing line, as
    // the job's chip on the Board does. A paper whose fact is not on the property record opens its pane, as before.
    if (row.action === 'fix_property' && row.button && row.jobId && board && office) {
      const chip = lienBoardChipFor(board, row.jobId, 'affidavit')
      if (chip?.destination.kind === 'property') {
        setPaneFix({ jobId: chip.destination.jobId, focus: chip.destination.focus })
        return
      }
    }
    if (t.open === 'run') {
      setRunTakeBack(Boolean(t.takeBack))
      setRunGcId(t.gcId)
      setRunOpen(true)
    } else if (t.open === 'lien_window') {
      // Change the last day of work… (punch list #353): the window opens with the day ready to change, where the page has that door.
      if (t.openLastWork && onOpenCalendarLastWork) onOpenCalendarLastWork(t.jobId)
      else (onOpenLienAffidavit ?? onOpenLienInstruments)(t.jobId)
    } else if (t.open === 'notice_record_months') {
      void correctNoticeMonths(t.jobId, t.months)
    } else if (t.open === 'affidavit_pile') {
      // A folded row's press (punch list #362, step 4): the Affidavits list at that pile, where the batch press of the same name stands.
      setAffHeldOnlyPicked(false)
      setAffPile(t.pile)
      setKind('affidavit')
    } else if (t.open === 'affidavits') {
      setKind('affidavit')
      setAffPile(null)
      setAffHeldOnlyPicked(false)
      setAffSelectedJobId(t.jobId)
    } else if (t.open === 'retainage') {
      setKind('retainage')
      setRetPile(null)
      setRetSelectedJobId(t.jobId)
    } else {
      // The pile narrows the list to the row's state; the selection effect keeps this pick.
      doorPickedJobId.current = t.jobId
      setCalendarJobFilter(null)
      // Stacked, the notice opens through the address, as a history entry of its own (punch list #182 PR 3).
      if (stacked && onOpenNotice) onOpenNotice(t.jobId, t.pile)
      else {
        setKind('notice')
        setPile(t.pile)
        setSelectedJobId(t.jobId)
      }
      // Record what they promised (PR 3 of #274): the row's press opens the footer's form on the notice it selects.
      if (row.action === 'promise') {
        setPromiseYmd('')
        setPromiseAmount('')
        setPromiseNote('')
        setPromiseOpen(true)
      }
    }
  }
  /**
   * A chip's press on the Board, or a job number's anywhere on the desk (v2.7333): the desk's own door for the paper's
   * stage. The property record and the run open over To do, so closing them is the way back; a paper opens through the
   * page's address as an entry of its own (`onZoomAddress`), so Back returns to To do at the Board. Nothing is written.
   */
  const zoomTo = (chip: LienBoardChip) => {
    const d = chip.destination
    setMobileListShown(false)
    if (d.kind === 'property') {
      // The office fixes the record over the desk; anyone else reads the paper, whose gates name the line.
      if (office) setPaneFix({ jobId: d.jobId, focus: d.focus })
      else zoomTo({ ...chip, destination: { kind: 'paper', tab: chip.kind === 'notice' ? 'notices' : 'affidavits', jobId: d.jobId } })
    } else if (d.kind === 'run') {
      setRunTakeBack(false)
      setRunOpen(true)
    } else if (d.kind === 'lienWindow') {
      ;(onOpenLienAffidavit ?? onOpenLienInstruments)(d.jobId)
    } else if (d.tab === 'affidavits') {
      onZoomAddress?.({ kind: 'affidavit', job: d.jobId, pile: null })
      setKind('affidavit')
      setAffPile(null)
      setAffHeldOnlyPicked(false)
      setAffSelectedJobId(d.jobId)
    } else {
      const pile = chip.kind === 'notice' ? (chip.pile as LienDeskPile) : null
      doorPickedJobId.current = d.jobId
      setCalendarJobFilter(null)
      if (stacked && onOpenNotice) onOpenNotice(d.jobId, pile)
      else {
        onZoomAddress?.({ kind: 'notice', job: d.jobId, pile })
        setKind('notice')
        setPile(pile)
        setSelectedJobId(d.jobId)
      }
    }
  }
  /** A job number's zoom: the job's chip in that column (the notice's first for `either`); a job not on the Board opens as the job. */
  const zoomJob = (jobId: string, kind: LienBoardKind | 'either') => {
    const chip = board ? lienBoardChipFor(board, jobId, kind) : null
    if (chip) zoomTo(chip)
    else onOpenJob?.(jobId)
  }
  /** The number's press and hover words for a list row, or null for a job not on the Board. */
  const zoomFor = (jobId: string, kind: LienBoardKind | 'either') => {
    const chip = board ? lienBoardChipFor(board, jobId, kind) : null
    return chip ? { press: () => zoomTo(chip), words: lienBoardDoorWords(chip.destination) } : null
  }
  /** A list row's label with its number as the zoom (v2.7333): the row is a button, so the number is a focusable span that keeps the click. */
  const listLabel = (jobId: string, kind: LienBoardKind, marked: boolean) => {
    const label = jobLabel(data?.jobsById[jobId], jobId)
    const zoom = zoomFor(jobId, kind)
    const { number, name } = splitLienJobLabel(label)
    const words = (t: string) => (marked ? <LienFindMarked text={t} words={findWords} /> : t)
    if (!zoom || !name) return <strong>{words(label)}</strong>
    return (
      <strong>
        <span role="link" tabIndex={0} className="lienJobDoor" data-lien-list-zoom={jobId} title={zoom.words} onClick={(ev) => { ev.stopPropagation(); zoom.press() }} onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); zoom.press() } }} style={{ borderRadius: 3 }}>
          {words(number)}
        </span>
        {' · '}
        {words(name)}
      </strong>
    )
  }
  const pickKind = async (next: PropertyKind) => {
    if (!address || kindBusy) return
    setKindBusy(true)
    try {
      await savePropertyKind(address.id, next)
      showToast(`Property kind saved on ${address.address}: ${propertyKindWords(next)}.`, 'success')
      onChanged()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the property kind'), 'error')
    } finally {
      setKindBusy(false)
    }
  }
  const promise = selected ? data?.promisesByJob[selected.jobId] ?? null : null
  const gcHasPriorNotice = Boolean(selected?.gcCustomerId && data?.gcsWithPriorNotice.has(selected.gcCustomerId))
  /** The GC's "send" rule is live: a notice has been recorded to them before (v2.3469). */
  const ruleLive = selected ? selected.policy === 'send' && !ruleWaitsOnFirstNotice(selected.policy, gcHasPriorNotice) : false
  const wm = selected ? workMonths?.[selected.jobId] ?? null : null
  const item = selected?.item && selected.item.status !== 'sent' && selected.item.status !== 'missed' ? selected.item : null
  useEffect(() => {
    setOffer(lienOfferFromItem(item))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, item?.offer_pct, item?.offer_by])
  const storedDraft = useMemo(() => (selected?.item ? parseLienDeskDraftFields(selected.item.fields) : null), [selected?.item])

  // Months a new notice names: the draft's, else every open month, minus what the user unticked.
  const monthChoices = useMemo(() => (selected ? selected.months.map((m) => ({ ...m, closed: m.daysLeft < 0 })) : []), [selected])
  // v2.4708: every window closed unsent while the affidavit's own window is still open — the new notice names the closed months, late.
  const lateUntil = useMemo(() => {
    if (!selected || !data) return null
    const aff = data.affidavits.entries.find((e) => e.jobId === selected.jobId)
    if (!aff || aff.pile === 'filed' || !aff.deadline || aff.deadline < todayYmd) return null
    if (selected.dueMonths.length > 0 || selected.months.some((m) => m.noticed) || selected.missedMonths.length === 0) return null
    return aff.deadline
  }, [selected, data, todayYmd])
  const defaultMonths = useMemo(() => new Set(item?.months.length ? item.months : selected?.dueMonths.length ? selected.dueMonths : lateUntil && selected ? selected.missedMonths : []), [item, selected, lateUntil])
  useEffect(() => {
    setCheckedMonths(null)
    setCoverNote(selected?.item ? selected.item.cover_note : true)
    setHousesInLetter(parseLienDeskDraftFields(selected?.item?.fields)?.housesInLetter !== false)
    const storedRelease = parseLienDeskDraftFields(selected?.item?.fields)?.releaseId ?? null
    releaseIdRef.current = storedRelease
    setReleaseId(storedRelease)
    setWordOpen(false)
    setByHandOpen(false)
    setPenOpen(false)
    setPenDraft(null)
    setSignWay('type')
    setDraftTouch(0)
    setDraftSave('idle')
    draftIdRef.current = null
    setHoldOpen(null)
    setDetailsOpen(false)
    setNotYetOpen(false)
    setRulePick(null)
    setWordNote('')
    // v2.4568: these stayed open, or kept their words, on the next job.
    setWordChannel('phone')
    setGcOkayOpen(false)
    setGcOkayNote('')
    setSignoffOpen(false)
    setSignoffText('')
    setLetterTwoMenu(false)
    setWordingEdits({})
    setEditing(null)
    setPayLineEdits({})
    setPayEditing(null)
    setPaneScrolled(false)
    // jsdom has no element scrollTo; the guard keeps the render smokes honest.
    if (typeof paneRef.current?.scrollTo === 'function') paneRef.current.scrollTo({ top: 0 })
  }, [selected?.jobId])
  const months = checkedMonths ?? defaultMonths
  const monthsList = [...months].sort()

  const openBalance = selected?.openBalance ?? 0
  // The job's master by name (v2.4856): the word row, the record and the queue row say *on Malachi's word*.
  const leaderName = leaderNameFor?.(job?.master_user_id ?? null) ?? ''
  // Someone else's screen (v2.5791, punch list #150): the job has a master and he is not the one signed in here. The
  // signature line is then his — his name in cursive, his signing code or his hand — never the signed-in user's name.
  const masterId = job?.master_user_id ?? null
  const otherScreen = lienOtherScreen(masterId, authUserId)
  const [codeStatus, setCodeStatus] = useState<LienCodeStatusRead>(null)
  const [codeStatusTick, setCodeStatusTick] = useState(0)
  const [codeProblem, setCodeProblem] = useState<string | null>(null)
  useEffect(() => {
    setCodeProblem(null)
    if (!otherScreen || !masterId) {
      setCodeStatus(null)
      return
    }
    let live = true
    setCodeStatus('loading')
    lienSignCodeStatus(masterId)
      .then((s) => {
        if (live) setCodeStatus(s ?? 'not_live')
      })
      .catch(() => {
        if (live) setCodeStatus('not_live')
      })
    return () => {
      live = false
    }
  }, [otherScreen, masterId, codeStatusTick, selected?.jobId])
  const codeSigner: LienNoticeSignLineCodeSigner | null = otherScreen ? lienCodeSignerFrom(leaderName, codeStatus) : null
  const codeReady = codeSigner?.status === 'ready'
  // On someone else's screen the typed name is never a way; until the line reports its own pick, his code or his hand stands.
  const draftSignWay: LienSignWay = otherScreen && signWay === 'type' ? (codeReady ? 'code' : 'draw') : signWay
  const wordPreview = selected
    ? wordRecordPreview({ leaderName, note: wordNote, channel: wordChannel, recorderName: authName, jobLabel: jobLabel(job, selected.jobId), gcName: gc?.name ?? null, amountWords: formatUsdNoCents(openBalance) })
    : undefined
  const supplierJob = selected ? suppliers.byJob.get(selected.jobId) : undefined
  // The claim set by hand (v2.3682): an amount off the moving balance, carried until cleared; the notice claims the rest.
  const correction = selected && data ? data.claimCorrectionsByJob[selected.jobId] ?? null : null
  const lastSentAt = selected && data ? data.items.filter((i) => i.job_id === selected.jobId && i.status === 'sent' && i.sent_at).map((i) => i.sent_at as string).sort().pop() ?? null : null
  const claimed = correctedClaim(openBalance, correction)
  const claimSplitLine = claimSplitWords(claimSplit(monthsList, claimed.claim, correction?.perMonth))
  const claimGate = correctionSendGate(correction, openBalance, lastSentAt)
  const handSetClaimWords = correction ? [claimDeltaWords(claimed.delta, openBalance), correctionSetWords(correction, formatYmdMonthDay)].filter(Boolean).join(' · ') : ''
  /** The job's own answers for the nine values — what a fresh draft says, and what "edited" is measured against. */
  const jobDefaults = useMemo(
    () =>
      buildLienNoticeFieldsForJob({
        jobName: job?.job_name,
        jobAddress: job?.job_address,
        homesteadStatement: homesteadStatementApplies(property),
        originalContractorName: gc?.name ?? '',
        openBalance: claimed.claim,
        claimSplit: claimSplitLine || undefined,
        contactPerson: signerNameFor(job?.master_user_id ?? null),
        issuer,
        todayYmd,
        retainageHeld: job?.lien_retainage_held ?? null,
        serviceTypeName: job?.service_type?.name,
      }),
    [job, gc, claimed.claim, claimSplitLine, signerNameFor, issuer, todayYmd],
  )
  // The stored draft wins when there is one (the leader approves those exact values); the office's typed wording layers on top.
  // The claim is re-read live (v2.3682): the balance and a hand-set correction are sources, and the paper follows its source.
  const noticeFields = useMemo(
    () => applyWordingEdits({ ...(storedDraft?.notice ?? jobDefaults), claimAmount: jobDefaults.claimAmount, ...(jobDefaults.claimSplit ? { claimSplit: jobDefaults.claimSplit } : { claimSplit: undefined }), ...(jobDefaults.retainageIncluded ? { retainageIncluded: jobDefaults.retainageIncluded } : { retainageIncluded: undefined }) }, wordingEdits),
    [storedDraft, jobDefaults, wordingEdits],
  )
  const wordingDiff = useMemo(() => noticeWordingDiff(noticeFields, jobDefaults), [noticeFields, jobDefaults])
  const wordingTouched = Object.keys(wordingEdits).length > 0
  const wordingEditedBy = wordingDiff.length === 0 ? null : wordingTouched ? authName || null : (storedDraft?.wording?.editedBy ?? null)
  const wordingLocked = !office || (item != null && item.status !== 'drafted')
  const docExtras: FilingDocExtras = useMemo(
    () => ({
      letterhead: filingLetterheadFromIssuer(issuer),
      refItems: [`Job #${job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) : ''}`, monthsList.length ? `Work months ${describeNoticeMonths(monthsList)}` : '', demandDate(todayYmd)].filter(Boolean),
    }),
    [issuer, job, monthsList, todayYmd],
  )
  // The desk's marks on the paper (v2.3694): a shaded box on each value the office may change, a dotted one once locked, and a title on every filled-from-the-job value saying where it comes from.
  const paperMarks = useMemo(() => {
    const m: Record<string, FilingFieldMark> = {}
    for (const g of LIEN_NOTICE_FIELD_GUIDE) {
      if (g.kind === 'typed') m[g.key] = { kind: wordingLocked ? 'locked' : 'typed', changed: wordingDiff.includes(g.key), title: wordingLocked ? 'Sent for approval — pull it back to a draft to change it' : 'Click to change — on the paper', ring: ringField === g.key }
      else {
        // Every plain value says where it is filled from; the ones with a door say the click lands there (v2.3697).
        const door = g.key === 'originalContractorName' ? 'gc' : g.key === 'claimantName' || g.key === 'claimantAddress' ? 'company' : g.key === 'claimAmount' ? 'claim' : undefined
        const title =
          door === 'gc' ? 'Filled from the job · the GC — click to change it there'
          : door === 'company' ? 'Filled from Settings → Company — click to change it there'
          : door === 'claim' ? 'Set on the claim box above — click, and it opens there'
          : g.key === 'noticeDate' ? 'The day it is drafted or sent — nothing to change'
          : `Filled from ${g.source}`
        m[g.key] = { kind: 'derived', title, ...(door && (door !== 'company' || onOpenCompanySettings) ? { door } : {}), ring: ringField === g.key }
      }
    }
    return m
  }, [wordingLocked, wordingDiff, ringField, onOpenCompanySettings])
  useEffect(() => {
    const trip = sourceTripRef.current
    if (!trip) return
    const now = noticeFields[trip.field] ?? ''
    if (now === trip.before) return
    sourceTripRef.current = null
    setRingField(trip.field)
    const t = window.setTimeout(() => setRingField(null), 4000)
    return () => window.clearTimeout(t)
  }, [noticeFields])
  // The leader's signature on this notice (v2.5082), for the pane's paper and the chip: null while unsigned, or once the draft moved on after signing.
  const paneSignature = useMemo(() => {
    if (!item) return null
    const cols = signatureColumnsOf(item)
    const jobNumber = job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—' : '—'
    return lienNoticeSignatureFromRow(cols, { jobNumber, itemId: item.id, fieldsHash: lienFieldsHash(item.fields), onDeviceName: cols.signed_on_device_of ? (leaderNameFor?.(cols.signed_on_device_of) ?? null) : null, recordedByName: cols.signed_recorded_by ? (leaderNameFor?.(cols.signed_recorded_by) ?? null) : null, pngDataUrl: inks.get(item.id) ?? null })
  }, [item, job, leaderNameFor, inks])
  const paneSigned = useMemo(() => (paneSignature ? toFilingSignature(paneSignature) : null), [paneSignature])
  const docHtml = useMemo(() => filingDocHtml(buildLienNoticeBlocks(noticeFields, docExtras, { ghostOptional: !wordingLocked, signature: paneSigned }), { marks: paperMarks }), [noticeFields, docExtras, paperMarks, paneSigned, wordingLocked])
  /** Click a shaded box: the value becomes a box in its place. A Back button under a changed value puts the job's wording back. */
  const startEdit = (key: LienNoticeFieldKey) => {
    const wrap = paperRef.current
    const el = wrap?.querySelector<HTMLElement>(`[data-field="${key}"]`)
    if (!wrap || !el || wordingLocked) return
    const target = el.querySelector<HTMLElement>('[data-field-text]') ?? el
    const r = target.getBoundingClientRect()
    const w = wrap.getBoundingClientRect()
    const cs = typeof window !== 'undefined' && typeof window.getComputedStyle === 'function' ? window.getComputedStyle(target) : null
    setEditing({ key, value: noticeFields[key] ?? '', rect: { top: r.top - w.top, left: r.left - w.left, width: r.width, height: r.height }, font: cs?.font ?? '' })
  }
  const onPaperClick = (ev: React.MouseEvent<HTMLDivElement>) => {
    const t = ev.target as HTMLElement
    const reset = t.closest<HTMLElement>('[data-reset]')?.getAttribute('data-reset')
    if (reset && isTypedNoticeField(reset)) {
      if (!wordingLocked) {
        setWordingEdits((e) => ({ ...e, [reset]: jobDefaults[reset] }))
        touchDraft()
      }
      return
    }
    const el = t.closest<HTMLElement>('[data-field]')
    const key = el?.getAttribute('data-field') ?? ''
    if (!el) return
    if (!isTypedNoticeField(key)) {
      // A plain value's door (v2.3697): land where it is set, on the field, and ring it here when it comes back changed.
      const door = el.getAttribute('data-door')
      if (!door || !selected) return
      const k = key as LienNoticeFieldKey
      sourceTripRef.current = { field: k, before: noticeFields[k] ?? '' }
      if (door === 'gc') onOpenEditJob(selected.jobId, 'gc')
      else if (door === 'company') onOpenCompanySettings?.(k === 'claimantAddress' ? 'addressText' : 'companyName')
      else if (door === 'claim') {
        paneRef.current?.querySelector('[data-lien-claim-box], [data-lien-claim-editor]')?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
        setClaimOpenSignal((n) => n + 1)
      }
      return
    }
    if (wordingLocked) {
      showToast('Sent for approval — pull it back to a draft to change the wording.', 'info')
      return
    }
    startEdit(key)
  }
  const commitEdit = () => {
    setEditing((e) => {
      if (e) {
        setWordingEdits((w) => ({ ...w, [e.key]: e.value }))
        touchDraft()
      }
      return null
    })
  }
  useEffect(() => {
    if (editing) editInputRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.key])
  // The supply houses paragraph for the owner's letter (v2.4725): the same words the run prints, from the job's houses and the letter's own claim figure.
  const claimNumber = Number(String(noticeFields.claimAmount ?? '').replace(/[$,\s]/g, '')) || 0
  const supplierParagraph = useMemo(
    () => lienSupplierLetterParagraphFor(supplierJob, { propertyKind: property.propertyKind ?? '', todayYmd, payerName: gc?.name ?? noticeFields.originalContractorName, claim: claimNumber }),
    [supplierJob, property.propertyKind, todayYmd, gc?.name, noticeFields.originalContractorName, claimNumber],
  )
  // The enclosed release (v2.4729): the row the draft points at, as the run carries it; the page behind the letter.
  const noticeRelease = releaseId ? (releases.byId.get(releaseId) ?? null) : null
  const releaseHtml = useMemo(() => (noticeRelease ? noticeReleasePageHtml(noticeRelease, docExtras) : ''), [noticeRelease, docExtras])
  /** The release's draft as the notice reads now — the tick creates it, and every save of the notice's draft refreshes it. */
  const releaseDraftInput = (): NoticeReleaseDraftInput | null =>
    selected
      ? {
          jobId: selected.jobId,
          formType: noticeReleaseFormType(claimNumber, payPage.rows.reduce((s, r) => s + r.openAmount, 0)),
          fields: noticeReleaseFields({ claimantName: noticeFields.claimantName, gcName: gc?.name ?? noticeFields.originalContractorName, jobName: job?.job_name, jobAddress: job?.job_address, claim: noticeFields.claimAmount, months: monthsList, signerName: (issuer?.signerName ?? '').trim() || noticeFields.contactPerson, signerTitle: issuer?.signerTitle }),
          amount: claimNumber,
          invoiceIds: payPage.rows.map((r) => r.invoiceId),
          throughDate: noticeReleaseThroughDate(monthsList),
          signerUserId: job?.master_user_id ?? null,
          userId: authUserId,
        }
      : null
  // The cover page (v2.3540): the same page the run prints — counsel's letter for the property's kind while the box is ticked (v2.3828), or the letter the item carries.
  const coverBlocks = useMemo(() => {
    if (!selected) return []
    const jobNumber = job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '' : ''
    return runCoverNoteBlocks({
      label: jobLabel(job, selected.jobId),
      months: monthsList,
      fields: noticeFields,
      extras: docExtras,
      coverNote: null,
      release: noticeRelease,
      signature: paneSignature,
      coverLetter: coverNote || storedDraft?.coverLetter ? fillCoverLetter(counselCoverLetterTemplate({ stored: storedDraft?.coverLetter, gcName: gc?.name ?? noticeFields.originalContractorName, claimantName: noticeFields.claimantName, property }), { property: (job?.job_address ?? '').trim(), months: describeNoticeMonths(monthsList), job: jobNumber, amount: demandMoney(noticeFields.claimAmount), staleNote: storedDraft?.staleNote ?? '', contact: noticeFields.contactPerson, phone: signerPhoneFor ? signerPhoneFor(job?.master_user_id ?? null) : (issuer?.phone ?? '').trim(), affidavitMonth: affidavitMonthWordFor(property?.propertyKind), trade: job?.service_type?.name, supplyHouses: housesInLetter ? supplierParagraph : '', conditionalRelease: noticeRelease ? conditionalReleaseParagraph(demandMoney(noticeFields.claimAmount)) : '' }) : null,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.jobId, job, monthsList.join('|'), noticeFields, docExtras, coverNote, storedDraft?.coverLetter, signerPhoneFor, gc?.name, property, housesInLetter, supplierParagraph, noticeRelease, paneSignature])
  const coverHtml = useMemo(() => (coverBlocks.length ? filingDocHtml(coverBlocks) : ''), [coverBlocks])
  // The pay page (punch list #35, PR 3): the page the run prints behind the owner's copy, from the job's unpaid bills — fetched once per job while the desk is open.
  const payPage = useNoticePayPage(selected?.jobId ?? null, true)
  // The bills behind the claim (v2.4969): the desk's money is what the sent bills still owe (`lien_billed_open()`), so the
  // claim and the pay page cannot disagree; the Months card lists the bills, and the part of the job no sent bill carries.
  const claimBills = payPage.bills
  const unbilled = job ? lienUnbilled(job, openBalance) : 0
  const billFromHere = () => {
    const j = payPage.job
    if (!billCustomer || !j || !selected) return
    if (!jobLedgerHasCustomerForBilling(j.customer_id)) {
      showToast('Link this job to a customer before billing.', 'error')
      return
    }
    const reread = async () => {
      payPage.refresh()
      onChanged()
    }
    billCustomer.openBillCustomer({ payload: { kind: 'job', job: jobBillingContextFromJob(j) }, onSuccess: reread, onAfterEnsureSuccess: reread })
  }
  const billWhy = !billCustomer ? 'Billing opens from the Pipeline on this screen' : !payPage.job ? (payPage.loading ? 'Reading the job’s bills…' : 'The job’s bills could not be read') : ''
  const payLinesNow = useMemo(() => ({ ...(storedDraft?.payLines ?? {}), ...payLineEdits }), [storedDraft?.payLines, payLineEdits])
  const payChanged = useMemo(() => changedPayLines(payPage.rows, payLinesNow), [payPage.rows, payLinesNow])
  const payChangedCount = Object.keys(payChanged).length
  const payBlocks = useMemo(
    () =>
      selected && payPage.rows.length
        ? payPageBlocks({
            rows: payPage.rows,
            assets: payPage.assets,
            copy: 'owner',
            copyLabel: '',
            gcName: noticeFields.originalContractorName,
            claimantName: noticeFields.claimantName,
            contactPerson: noticeFields.contactPerson,
            phone: (issuer?.phone ?? '').trim(),
            extras: docExtras,
            offer,
            lines: payLinesNow,
          })
        : [],
    [selected, payPage, noticeFields, issuer, docExtras, offer, payLinesNow],
  )
  const payMarks = useMemo(() => {
    const m: Record<string, FilingFieldMark> = {}
    for (const r of payPage.rows) m[payLineField(r.invoiceId)] = { kind: wordingLocked ? 'locked' : 'typed', changed: r.invoiceId in payChanged, title: wordingLocked ? 'Sent for approval — pull it back to a draft to change it' : 'Click to change — on this page only, the bill keeps its own line' }
    return m
  }, [payPage.rows, payChanged, wordingLocked])
  const payHtml = useMemo(() => (payBlocks.length ? filingDocHtml(payBlocks, { marks: payMarks }) : ''), [payBlocks, payMarks])
  const onPayPaperClick = (ev: React.MouseEvent<HTMLDivElement>) => {
    const t = ev.target as HTMLElement
    const reset = payLineInvoiceId(t.closest<HTMLElement>('[data-reset]')?.getAttribute('data-reset') ?? '')
    if (reset) {
      if (!wordingLocked) {
        setPayLineEdits((e) => ({ ...e, [reset]: payPage.rows.find((r) => r.invoiceId === reset)?.description ?? '' }))
        touchDraft()
      }
      return
    }
    const el = t.closest<HTMLElement>('[data-field]')
    const id = payLineInvoiceId(el?.getAttribute('data-field') ?? '')
    const wrap = payPaperRef.current
    if (!el || !id || !wrap) return
    if (wordingLocked) {
      showToast('Sent for approval — pull it back to a draft to change the wording.', 'info')
      return
    }
    const r = el.getBoundingClientRect()
    const w = wrap.getBoundingClientRect()
    const cs = typeof window !== 'undefined' && typeof window.getComputedStyle === 'function' ? window.getComputedStyle(el) : null
    setPayEditing({ invoiceId: id, value: payLinesNow[id] ?? payPage.rows.find((x) => x.invoiceId === id)?.description ?? '', rect: { top: r.top - w.top, left: r.left - w.left, width: r.width, height: r.height }, font: cs?.font ?? '' })
  }
  const commitPayEdit = () => {
    setPayEditing((e) => {
      if (e) {
        setPayLineEdits((x) => ({ ...x, [e.invoiceId]: e.value.trim() }))
        touchDraft()
      }
      return null
    })
  }
  useEffect(() => {
    if (payEditing) payInputRef.current?.focus()
  }, [payEditing?.invoiceId])
  const pageTotal = (coverHtml ? 1 : 0) + (releaseHtml ? 1 : 0) + 1 + (payHtml ? 1 : 0)
  const noticePageNumber = (coverHtml ? 1 : 0) + (releaseHtml ? 1 : 0) + 1

  const draftFields = (): LienDeskDraftFields => ({
    notice: noticeFields,
    gcEmail: gc?.email ?? '',
    // A re-save keeps what Put a GC on notice wrote on the item (v2.3522 — these used to be dropped).
    ...(storedDraft?.batchReason ? { batchReason: storedDraft.batchReason } : {}),
    ...(storedDraft?.coverLetter ? { coverLetter: storedDraft.coverLetter } : {}),
    // The supply houses left out of the owner's letter (v2.4725) — only the leaving-out is written down.
    ...(housesInLetter ? {} : { housesInLetter: false as const }),
    // The conditional release enclosed with this notice (v2.4729).
    ...(releaseIdRef.current ? { releaseId: releaseIdRef.current } : {}),
    // The month is the job's creation month, not clock hours (v2.3747): the record says where the date came from.
    ...(selected?.datedFromCreation ? { monthsDatedFromCreation: true as const } : {}),
    ...(wordingDiff.length > 0 || payChangedCount > 0 ? { wording: wordingTouched || Object.keys(payLineEdits).length > 0 || !storedDraft?.wording ? { editedBy: authName, editedAt: new Date().toISOString() } : storedDraft.wording } : {}),
    // The pay page's typed lines (v2.4724): only those that differ from the bill; before the bills load, the stored ones stand.
    ...(payPage.rows.length ? (payChangedCount ? { payLines: payChanged } : {}) : storedDraft?.payLines ? { payLines: storedDraft.payLines } : {}),
  })
  // A closed window, written down (v2.3679): one `missed` row naming the months and who looked; the live draft is untouched.
  const noteMissed = async (months: string[]) => {
    if (!selected || !months.length) return
    await run('Note it as missed', async () => noteLienWindowMissed({ jobId: selected.jobId, months, fields: draftFields(), userId: authUserId, userName: authName }), `Noted — ${describeNoticeMonths(months)} is on the record as missed.`)
  }
  // Readiness (v2.3450 kernel): GC, owner with a mailing address, months — and never a public owner.
  const readiness = draftReadiness({ gcName: gc?.name ?? '', ownerName, ownerMailingAddress: property.owner.mailingAddress, monthsCount: monthsList.length, ownerIsPublic: lienOwnerIsPublic([property.owner.ownerName, property.owner.ownerCompany], property.publicAnswer) })
  // The fifth gate (v2.4969): nothing owed on the sent bills while money is still on the job — a notice claims what is billed, so the send waits.
  const nothingBilled = Boolean(selected) && openBalance <= 0.005 && unbilled > 0.005
  const ready = readiness.ready && !nothingBilled


  /** Why this one comes to the leader (v2.3405) — said once, in the footer, beside the button (v2.3522). */
  const askReason: LienAskReason | null = useMemo(() => {
    if (!selected || !data) return null
    if (promise) return 'promise_live'
    if (selected.gcCustomerId && data.gcsHeldBefore.has(selected.gcCustomerId)) return 'held_before'
    if (selected.gcCustomerId && !data.gcsWithPriorNotice.has(selected.gcCustomerId)) return 'first_notice'
    return 'no_rule'
  }, [selected, data, promise])

  const gcOpenTotal = useMemo(() => {
    if (!selected?.gcCustomerId) return 0
    return entries.filter((e) => e.gcCustomerId === selected.gcCustomerId).reduce((s, e) => s + e.openBalance, 0)
  }, [entries, selected])

  const run = async (label: string, fn: () => Promise<void>, done?: string): Promise<boolean> => {
    if (busy) return false
    setBusy(true)
    busyRef.current = true
    // A press saves first (v2.7327): the wait for the autosave is dropped, and its save in flight is awaited inside ensureDraft.
    if (autosaveTimerRef.current != null) {
      window.clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
    try {
      await fn()
      if (done) showToast(done, 'success')
      onChanged()
      return true
    } catch (e) {
      showToast(e instanceof Error && e.message ? `${label}: ${e.message}` : `${label} failed.`, 'error')
      return false
    } finally {
      setBusy(false)
      busyRef.current = false
    }
  }

  const ensureDraft = async (fromAutosave = false): Promise<string> => {
    if (!selected) throw new Error('nothing selected')
    // A save the autosave has in flight lands first, so the row it made is the one updated here (v2.7327).
    if (!fromAutosave && autosaveRef.current) await autosaveRef.current.catch(() => undefined)
    const id = await saveLienDeskDraft({ itemId: item?.id ?? draftIdRef.current, jobId: selected.jobId, months: monthsList, fields: draftFields(), coverNote, userId: authUserId })
    draftIdRef.current = id
    // The enclosed release follows the notice (v2.4729): a claim or a month changed here is written to its draft too; a release past a draft is left as it is.
    const rel = releaseIdRef.current
    const relInput = rel ? releaseDraftInput() : null
    if (rel && relInput) await refreshNoticeReleaseDraft(rel, relInput).catch(() => undefined)
    return id
  }
  /** Enclose a conditional release (v2.4729): on makes the draft row and points the notice's draft at it; off voids the row and forgets it. */
  const toggleRelease = (on: boolean) => {
    if (!selected) return
    if (on) {
      void run(
        'Enclose a conditional release',
        async () => {
          const input = releaseDraftInput()
          if (!input) return
          const id = await createNoticeReleaseDraft(input)
          releaseIdRef.current = id
          setReleaseId(id)
          await ensureDraft()
          releases.reload()
        },
        'The conditional release rides with the notice. It is issued when the run is recorded.',
      )
    } else {
      const id = releaseIdRef.current
      void run(
        'Leave the release out',
        async () => {
          if (id) await voidNoticeReleaseDraft(id, authUserId)
          releaseIdRef.current = null
          setReleaseId(null)
          await ensureDraft()
          releases.reload()
        },
        'The release is left out.',
      )
    }
  }

  // The autosave itself: the office's drafting notice, about 800 ms after the last change, quietly; a failure says why.
  const canAutosave = Boolean(selected) && office && monthsList.length > 0 && (!item || item.status === 'drafted')
  useEffect(() => {
    if (draftTouch === 0 || !canAutosave) return
    const t = window.setTimeout(() => {
      autosaveTimerRef.current = null
      if (busyRef.current) return
      const p = (async () => {
        setDraftSave('saving')
        try {
          await ensureDraft(true)
          setDraftSave('saved')
          onChanged()
        } catch (e) {
          setDraftSave('idle')
          showToast(formatErrorMessage(e, 'The draft did not save.'), 'error')
        }
      })()
      autosaveRef.current = p
      void p.finally(() => {
        if (autosaveRef.current === p) autosaveRef.current = null
      })
    }, LIEN_DRAFT_AUTOSAVE_MS)
    autosaveTimerRef.current = t
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the count is the signal; the save reads the latest state when it fires
  }, [draftTouch])
  useEffect(() => {
    if (draftSave !== 'saved') return
    const t = window.setTimeout(() => setDraftSave('idle'), 2500)
    return () => window.clearTimeout(t)
  }, [draftSave])
  const sendToLeader = () =>
    run(
      'Send for approval',
      async () => {
        if (!selected || !data) return
        const id = await ensureDraft()
        // A claim set by hand over the balance, or carried and not looked at since the last notice, goes to the leader whatever the rule (v2.3682).
        const outcome = claimGate
          ? ({ status: 'awaiting_approval', reason: 'claim_by_hand' } as const)
          : submitOutcome(selected, { promiseYmd: promise?.promisedYmd ?? null, gcHasPriorNotice: Boolean(selected.gcCustomerId && data.gcsWithPriorNotice.has(selected.gcCustomerId)), gcHeldBefore: Boolean(selected.gcCustomerId && data.gcsHeldBefore.has(selected.gcCustomerId)) }, todayYmd)
        await submitLienDeskItem(id, outcome)
        // His phone buzzes (v2.4872): best effort, after the write, with the mail-by day the desk knows. A tell that fails is said with its reason (v2.7445), never swallowed.
        if (outcome.status === 'awaiting_approval') {
          const told = lienNoticeToldWords(await tellLeaderOfLienApproval(id, selected.earliestDeadline), leaderName)
          showToast(told.said, told.tone)
        }
      },
      ruleLive && !promise && !claimGate ? `Approved by the standing rule. ${LIEN_RUN_NOW_TO_PRINT}` : selected?.policy === 'hold' ? 'Held by the standing rule — it re-asks before the deadline.' : undefined,
    )
  const sendOnWord = () =>
    run(
      'Send on the leader’s word',
      async () => {
        const id = await ensureDraft()
        await sendLienDeskItemOnWord(id, { note: wordNote, channel: wordChannel })
      },
      `Recorded on the leader’s word. ${LIEN_RUN_NOW_TO_PRINT}`,
    )
  // Signing (v2.5082): one press under his own sign-in places his name in the cursive face; the line may hold a drawing instead.
  // On someone else's screen (v2.5791) the name is the master's, and the press is his code or his hand, attributed to him.
  // v2.7395 (Taunya's ask): the mark carries his full name. The short names stay for the words around it.
  const signerName = otherScreen ? signatureNameFor?.(masterId)?.trim() || leaderName : signatureNameFor?.(authUserId)?.trim() || authName.trim() || leaderName
  const signPayloadOrThrow = (): LienDeskSignPayload | { mode: 'code'; code: string } => {
    const h = signRef.current
    if (h?.mode === 'code') {
      const code = h.code()
      if (code.length < 4) throw new Error(`Type ${codeSigner?.firstName ?? 'his'}’s signing code first.`)
      return { mode: 'code', code }
    }
    if (!h || h.mode === 'type') {
      if (otherScreen) throw new Error(`${codeSigner?.firstName ?? 'The leader'} signs here with his code or his hand.`)
      return { mode: 'type' }
    }
    const png = h.toDataURL()
    if (!png) throw new Error('Sign on the line first.')
    return { mode: 'draw', signaturePngBase64: png }
  }
  const signItem = async (itemId: string, fields: unknown, approveToo: boolean) => {
    const payload = signPayloadOrThrow()
    if (payload.mode === 'code') {
      const r = await signLienDeskItemWithCode({ itemId, fields, signerUserId: masterId ?? '', code: payload.code, approve: approveToo })
      if (!r.ok) {
        const words = lienCodeRefusalWords(r)
        setCodeProblem(words)
        if (lienCodeStatusStale(r.reason)) setCodeStatusTick((t) => t + 1)
        throw new Error(words)
      }
      setCodeProblem(null)
      return
    }
    const r = otherScreen
      ? await signLienDeskItem({ itemId, fields, signer: { userId: masterId, printedName: signerName }, payload, onDevice: { userId: authUserId, name: authName.trim() || null }, approve: approveToo })
      : await signLienDeskItem({ itemId, fields, signer: { userId: authUserId, printedName: signerName }, payload, onDevice: null, approve: approveToo })
    if (!r.ok) throw new Error(r.message)
  }
  const approve = () =>
    run(
      'Sign and approve',
      async () => {
        if (!item) return
        await setLienDeskItemOffer(item.id, offer)
        await signItem(item.id, item.fields, true)
      },
      offer ? `Signed and approved with a ${offer.pct}% offer. ${LIEN_RUN_NOW_TO_PRINT}` : `Signed and approved. ${LIEN_RUN_NOW_TO_PRINT}`,
    )
  const signOnly = () =>
    run(
      'Sign',
      async () => {
        if (!item) return
        await signItem(item.id, item.fields, false)
      },
      `Signed. ${LIEN_RUN_NOW_TO_PRINT}`,
    )
  const saveOffer = () => run('The pay offer', async () => void (item && (await setLienDeskItemOffer(item.id, offer))), offer ? `Offer saved: ${lienOfferChipWords(offer)}.` : 'The offer is off.')
  const hold = (reason: 'promised' | 'call_first') =>
    run('Hold', async () => void (item && selected && (await holdLienDeskItem(item.id, { reason, until: holdUntilFor(reason, selected.earliestDeadline, promise?.promisedYmd ?? null, todayYmd) }))), 'Held — the desk re-asks before the deadline.')
  const backToReady = () => run('Back to Approved · to print', async () => void (item && (await clearLienDeskItemPrinted(item.id, { userId: authUserId, userName: authName || null }))), 'Back in Approved · to print.')
  const pullBack = () => run('Pull back', async () => void (item && (await pullBackLienDeskItem(item.id, authUserId))), 'Back in the office’s drafts.')
  const saveRule = (policy: LienNoticePolicy) =>
    run('Standing rule', async () => void (selected?.gcCustomerId && (await setCustomerLienNoticePolicy(selected.gcCustomerId, policy, ''))), `Rule saved for ${gc?.name ?? 'this GC'}.`)

  // Preview (v2.3522): the notice as the packet prints it, in its own tab, with the values marked.
  // Not `noopener` — the preview posts back to this window: a field to focus, or (v2.3660) a typed value
  // it changed. The desk stays the source of truth: it layers the edit on, and the effect below posts the
  // rebuilt pages back, so the preview only ever shows what these builders print.
  const previewInput = () => ({
    blocks: buildLienNoticeBlocks(noticeFields, docExtras, { signature: paneSigned }),
    fields: noticeFields,
    defaults: jobDefaults,
    editedBy: wordingEditedBy,
    coverBlocks,
    payBlocks,
  })
  const postToPreview = (saved?: 'ok' | 'failed') => {
    const win = previewWinRef.current
    if (!win || win.closed) return
    win.postMessage(lienNoticePreviewPages(previewInput(), saved), window.location.origin)
  }
  const openPreview = () => {
    if (!selected) return
    const html = buildLienNoticePreviewHtml({ ...previewInput(), jobLabel: jobLabel(job, selected.jobId), editable: !wordingLocked, handSetClaim: handSetClaimWords || undefined })
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    const win = window.open(url, '_blank')
    if (!win) showToast('Popup blocked — allow popups to preview the notice.', 'error')
    previewWinRef.current = win
    setPreviewJobId(win ? selected.jobId : null)
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
  // A preview belongs to the job it was opened on: once the desk moves to another job its boxes must not write here.
  const previewIsThisJob = previewJobId != null && previewJobId === selected?.jobId
  const onPreviewMessageRef = useRef<(ev: MessageEvent) => void>(() => {})
  onPreviewMessageRef.current = (ev: MessageEvent) => {
    if (ev.origin !== window.location.origin) return
    const d = ev.data as { type?: unknown; field?: unknown; value?: unknown } | null
    if (!d) return
    if (d.type === LIEN_NOTICE_PREVIEW_EDIT_MESSAGE) {
      if (ev.source !== previewWinRef.current || !previewIsThisJob || wordingLocked) return
      if (typeof d.field !== 'string' || !isTypedNoticeField(d.field) || typeof d.value !== 'string') return
      const field = d.field
      const value = d.value
      setWordingEdits((e) => ({ ...e, [field]: value }))
      touchDraft()
      return
    }
    if (d.type === LIEN_NOTICE_PREVIEW_SAVE_MESSAGE) {
      if (ev.source !== previewWinRef.current || !previewIsThisJob || wordingLocked || monthsList.length === 0) {
        postToPreview('failed')
        return
      }
      void run('Save draft', async () => void (await ensureDraft()), 'Draft saved.').then((ok) => postToPreview(ok ? 'ok' : 'failed'))
      return
    }
    if (d.type !== LIEN_NOTICE_PREVIEW_MESSAGE || typeof d.field !== 'string' || !isTypedNoticeField(d.field)) return
    const field = d.field
    window.setTimeout(() => {
      paperRef.current?.querySelector<HTMLElement>(`[data-field="${field}"]`)?.scrollIntoView?.({ block: 'center' })
      startEdit(field)
    }, 0)
  }
  useEffect(() => {
    const onMessage = (ev: MessageEvent) => onPreviewMessageRef.current(ev)
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])
  // Whatever changed the pages — a box here, a box there, the cover-note tick — the open preview follows.
  useEffect(() => {
    if (!previewIsThisJob) return
    postToPreview()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the pages are a function of exactly these
  }, [previewIsThisJob, docHtml, coverHtml, payHtml, wordingDiff.length, wordingEditedBy])

  // An owner asked for our records (v2.4544): the checked packet for their property, opened over the desk. On a computer it sat on the title line
  // left of § Rules on every view (v2.4740 off By paper; v2.4786 there too, the owner's ask — the title line had the room) until v2.7311, the owner's ask of 2026-11-15:
  // it ends the second line on every view, at the right under Share, after the paper tabs and the piles on By paper. On a phone it is a row of More. Its height is the presses'
  // (`headDoor`), so the pile line is as tall beside it as beside Put a GC on notice.
  const ownerRecordsDoor = office && onOpenOwnerRecords ? (
    <button
      type="button"
      data-testid="lien-owner-records-door"
      onClick={onOpenOwnerRecords}
      title="An owner asked what we billed and what was paid on their property: the packet for that property, behind four checks"
      style={{ gap: '0.3rem', padding: '2px 10px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer', ...headDoor }}
    >
      An owner asked for records ›
    </button>
  ) : null

  // v2.4826: the § Rules window names the picked job and its two dates, and lights its row in the clock table.
  const rulesJob = selected ? lienRulesJobFrom({ label: jobLabel(job, selected.jobId), propertyKind: selected.propertyKind, isSub: !!selected.gcCustomerId, months: selected.months, earliestDeadline: selected.earliestDeadline }, todayYmd) : null

  const rulesAndCaller = (
    <>
      <LienRulesDoor where={kind === 'affidavit' ? 'desk_affidavit' : 'desk_notice'} style={headDoor} job={rulesJob} todayYmd={todayYmd} />
      {office ? <LienCallerDoor open={callScriptOpen} onOpen={() => setCallScriptOpen(true)} buttonStyle={headDoor} /> : null}
    </>
  )

  const counts = data?.queue.counts
  const affEntries = data?.affidavits.entries ?? []
  // Print every ready affidavit on the short form for the notary (v2.6918): what the press takes, and what it leaves with the reason.
  const affPrintPlanAll = lienAffidavitPrintPlan(affEntries)
  // The held papers alone (v2.7209): only while a gate holds one, so the list never narrows to nothing when the last one clears.
  const affHeldJobIds = new Set(affPrintPlanAll.gated.map((g) => g.entry.jobId))
  const affHeldOnly = affHeldOnlyPicked && affHeldJobIds.size > 0
  const affVisibleAll = LIEN_AFFIDAVIT_PILES.flatMap((p) => affEntries.filter((e) => e.pile === p.key && (affHeldOnly ? affHeldJobIds.has(e.jobId) : affPile == null || affPile === p.key)))
  const affVisible = affVisibleAll.filter((e) => !finding || lienFindMatch(findFactsFor(e.jobId, e.gcCustomerId, [workMonthShort(e.lastMonth), e.pile]), findWords).ok)
  const affSelected = affVisible.find((e) => e.jobId === affSelectedJobId) ?? (!oneColumn ? affVisible[0] : undefined) ?? null
  // While a find is typed (punch list #353, part 1) both batch presses take only the rows the list shows, and say so; with nothing typed they take every paper as before.
  const affShownKey = finding ? affVisible.map((e) => e.jobId).join('\n') : null
  const affShown = useMemo((): LienAffidavitShown | null => (affShownKey == null ? null : { jobIds: new Set(affShownKey.split('\n').filter(Boolean)) }), [affShownKey])
  const affBatchEntries = lienAffidavitShownEntries(affEntries, affShown)
  const affPrintPlan = affShown ? lienAffidavitPrintPlan(affBatchEntries) : affPrintPlanAll
  const affCount = affEntries.filter((e) => e.pile !== 'filed').length
  // Redraw every ready affidavit on the short form (punch list #305): the ready earlier-form papers, the ones left in other piles, and the words.
  const redrawPlan = lienAffidavitRedrawPlan(affEntries)
  const redrawWords = lienAffidavitRedrawWords(redrawPlan)
  const redrawReady = async () => {
    if (redrawBusy || redrawPlan.ready.length === 0) return
    if (!(await confirmDialog({ title: redrawWords.title, message: redrawWords.message, confirmLabel: redrawWords.confirmLabel }))) return
    setRedrawBusy(true)
    try {
      // Each paper is its own write and the batch keeps going past one that fails; what failed stays listed with its reason.
      const result = await redrawLienAffidavitsShort(redrawPlan.ready.flatMap((e) => (e.item ? [{ jobId: e.jobId, item: e.item }] : [])), authUserId)
      const outcome = lienAffidavitRedrawOutcome(result.done.length, result.failed.length)
      setRedrawFailed(result.failed)
      showToast(outcome.line, outcome.tone)
      if (result.done.length > 0) onChanged()
    } finally {
      setRedrawBusy(false)
    }
  }
  // Send every drafted affidavit for approval (v2.6918): each goes where its GC's rule takes it, as the pane's own press sends it.
  const affSendContext = {
    policyFor: (gcId: string | null) => (gcId ? data?.gcsById[gcId]?.policy : undefined) ?? 'ask',
    promiseYmdFor: (jobId: string) => data?.promisesByJob[jobId]?.promisedYmd ?? null,
    gcHasPriorNotice: (gcId: string) => Boolean(data?.gcsWithPriorNotice.has(gcId)),
    gcHeldBefore: (gcId: string) => Boolean(data?.gcsHeldBefore.has(gcId)),
    todayYmd,
  }
  const affSendPlanAll = lienAffidavitSendPlan(affEntries, affSendContext)
  const affSendPlan = affShown ? lienAffidavitSendPlan(affBatchEntries, affSendContext) : affSendPlanAll
  const affSendWords = lienAffidavitSendWords(affSendPlan, affShown ? { hiddenReady: affSendPlanAll.ready.length - affSendPlan.ready.length } : null)
  const sendDraftedAffidavits = async () => {
    if (affSendBusy || affSendWords.dead) return
    if (!(await confirmDialog({ title: affSendWords.title, message: affSendWords.message, confirmLabel: affSendWords.confirmLabel }))) return
    setAffSendBusy(true)
    try {
      const sent = affSendPlan.ready.flatMap((r) => (r.entry.item ? [{ jobId: r.entry.jobId, itemId: r.entry.item.id, outcome: r.outcome, dueYmd: r.entry.deadline }] : []))
      const result = await submitLienAffidavits(sent)
      const outcome = lienAffidavitSendOutcome(result.done.length, result.failed.length)
      setAffSendFailed(result.failed)
      // The leader is told once of every paper that now waits for him (punch list #305, v2.7180): one call, so twelve papers are one message. Best effort, after the writes.
      const asked = lienAffidavitTellPapers(sent, result.done)
      const told = asked.length > 0 ? await tellLeaderOfLienAffidavits(asked) : null
      showToast([outcome.line, lienAffidavitBatchToldWords(told, asked.length)].filter(Boolean).join(' '), told && !told.ok && outcome.tone === 'success' ? 'warning' : outcome.tone)
      if (result.done.length > 0) onChanged()
    } finally {
      setAffSendBusy(false)
    }
  }
  // The print itself (v2.6918): one document, each paper on its own sheet, and each job keeps its own copy.
  const [affHelpSheet, setAffHelpSheet] = useLienHelpSheetChoice()
  // The notice records (punch list #322): what was mailed before each paper, in front of the stack with the help sheet.
  const [affNoticeRecord, setAffNoticeRecord] = useLienNoticeRecordChoice()
  // A copy of each notice behind the records: off until someone ticks it, since a batch has many notices behind it.
  const [affNoticeCopies, setAffNoticeCopies] = useLienNoticeCopiesBatchChoice()
  const affPrintWords = lienAffidavitPrintWords(affPrintPlan, affShown ? { hiddenReady: affPrintPlanAll.ready.length - affPrintPlan.ready.length } : null)
  // The bar's status line and its amber press (v2.7209).
  const affPrintStatus = lienAffidavitPrintBarStatus({ ready: affPrintPlan.ready.length, gated: affPrintPlan.gated.length })
  const affHeldStrip = useRef<HTMLDivElement>(null)
  const showHeldAffidavits = (on: boolean) => {
    setAffHeldOnlyPicked(on)
    // The held papers are in Ready to file: a pile picked in the header would hide them.
    if (on) setAffPile(null)
    // The rows sit under the bars: bring the narrowed list's first line into view once it is drawn.
    if (on) window.setTimeout(() => affHeldStrip.current?.scrollIntoView?.({ block: 'nearest' }), 0)
  }
  // The county these are signed in (punch list #314): Settings' county, typed over for this print when the notary is somewhere else.
  const affSigning = useLienSigningCounty(issuer)
  // Who a help sheet says to ask (change 9): the job's lien leader, or the dev.
  const askFor = useLienAskPeople()
  const affPrintIssuer = affSigning.issuer
  const affPrintPapers = useMemo((): LienAffidavitPrintPaper[] => {
    if (!data) return []
    // In clerk order (change 7): each county clerk's papers print together, and the help sheet's rows count them as they lie in the stack.
    // The shown rows alone while a find is typed (punch list #353): a paper the find hides is not printed and not listed as held, since nobody held it.
    return lienAffidavitClerkOrder(lienAffidavitPrintPlan(lienAffidavitShownEntries(data.affidavits.entries, affShown)).ready.flatMap((e): LienAffidavitPrintPaper[] => {
      const fields = lienDeskAffidavitFieldsFor({ data, jobId: e.jobId, issuer: affPrintIssuer, signerNameFor, todayYmd })
      const job = data.jobsById[e.jobId]
      if (!fields) return []
      // What the help sheet says the app checked: the property record's own marks, and the notice behind each sworn month.
      const address = job?.customer_address_id ? data.addressesById[job.customer_address_id] ?? null : null
      const filings = data.filingsByJob[e.jobId] ?? []
      // The months set by hand (v2.7270) stand in for the record's on the paper, the check and the sheet's row.
      const byHand = data.affidavitMonthsByJob[e.jobId] ?? null
      const swornFacts = { isSub: e.isSub, workDays: job ?? null, lastMonth: e.lastMonth, todayYmd, monthsByHand: byHand?.months ?? null }
      const swornMonths = lienAffidavitSwornMonths({ ...swornFacts, filings })
      const noticeCheck = lienAffidavitNoticeCheck({ isSub: e.isSub, propertyKind: e.propertyKind, months: swornMonths, filings, work: lienAffidavitWorkMonths(swornFacts) })
      const noticeLines = lienNoticeCheckLines(noticeCheck)
      // A month from a bill or the job's creation (v2.7224) is flagged on both sheets, never held: neither reads On record for it.
      const monthStandIn = lienStandInSourceOf(e.lastMonthFromCreation, e.lastMonthFromBill)
      // A stand-in month a person confirmed (v2.7280): the sheet's row reads ✓ and the record names the check where the flag was.
      const monthChecked = lienMonthCheckedFor({ source: monthStandIn, month: e.lastMonth, check: parseLienMonthCheck(job) })
      const monthCheck = monthChecked ? lienMonthCheckedSheetRow(monthChecked, formatYmdMonthDay) : null
      // The notice record (punch list #322): the same months and the same rows, read against the paper's own two sentences.
      const noticeRecord = lienNoticeRecord({ isSub: e.isSub, propertyKind: e.propertyKind, swornMonths, filings, paperMonthsWords: fields.workMonthsWords ?? '', paperNoticesWords: fields.noticesSentWords ?? '', workStart: fields.workStart, workEnd: fields.workEnd, monthStandIn, monthCheck })
      const checked = { propertyKind: e.propertyKind, homestead: resolveLienProperty(address, data.ownerByJob[e.jobId] ?? null).homestead, noticeLines, noticeRow: lienNoticeCheckRowLine(noticeCheck), monthStandIn, monthsByHand: byHand ? lienAffidavitMonthsByHandCheck(byHand, formatYmdMonthDay) : null, monthCheck }
      return [{ jobId: e.jobId, jobNumber: job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—' : '—', fields, label: jobLabel(job, e.jobId), fileBy: e.deadline ? demandDate(e.deadline) : '', checked, clerk: lienClerkFor(issuer?.countyClerksText, fields.county), ask: askFor(job?.master_user_id ?? null), noticeRecord }]
    }))
  }, [data, affShown, affPrintIssuer, issuer?.countyClerksText, askFor, signerNameFor, todayYmd])
  // Which of them take a second sheet (v2.6930): each paper as its own Lien window lays it out, read under the press.
  const affSheetPapers = useMemo(() => lienAffidavitSheetPapers(affPrintPapers), [affPrintPapers])
  const affNoticeCopyCount = useMemo(() => lienAffidavitBatchNoticeCopyCount(affPrintPapers), [affPrintPapers])
  const printReadyAffidavits = () => {
    if (!data || affPrintWords.dead) return
    // The help sheet prints first (punch list #314): the blanks, when to stop, and a row for each paper. It is in no job's filed copy.
    const helpSheet = affHelpSheet
      ? lienAffidavitBatchHelpSheet(
          affPrintPapers,
          [
            ...affPrintPlan.held.map((e) => ({ jobLabel: jobLabel(data.jobsById[e.jobId], e.jobId), reason: LIEN_HELP_EARLIER_FORM_REASON })),
            // A ready paper a gate has closed since it was approved is not printed; the sheet names it with the gate's own reason.
            ...affPrintPlan.gated.map((g) => ({ jobLabel: jobLabel(data.jobsById[g.entry.jobId], g.entry.jobId), reason: g.reason })),
          ],
          demandDate(todayYmd),
          { guideCode: lienHelpGuideCode(), recordCode: lienHelpBatchRecordCode(), recordFollows: affNoticeRecord },
        )
      : null
    // The notice records, then a copy of each notice when its box is ticked, print behind the help sheet and in front of the stack, never between two papers (punch list #322).
    const noticeCopies = affNoticeCopies ? lienAffidavitBatchNoticeCopies(affPrintPapers, filingLetterheadFromIssuer(issuer), todayYmd) : ''
    const run = lienAffidavitPrintRun(affPrintPapers, helpSheet, affNoticeRecord ? lienAffidavitBatchNoticeRecords(affPrintPapers, demandDate(todayYmd), Boolean(noticeCopies)) : null, noticeCopies)
    if (!openHtmlPrintWindow(run.html)) {
      showToast('Popup blocked — allow popups to print.', 'error')
      return
    }
    // A print counts as a send (docs/SENT_COPIES.md): each job keeps its own paper, as its Lien window's print files it.
    for (const copy of run.copies) void fileSentCopy({ ...copy.filing, how: 'print' }, { html: copy.html })
  }
  const retEntries = data?.retainage.entries ?? []
  const retVisibleAll = LIEN_RETAINAGE_PILES.flatMap((p) => retEntries.filter((e) => e.pile === p.key && (retPile == null || retPile === p.key)))
  const retVisible = LIEN_RETAINAGE_PILES.flatMap((p) => retVisibleAll.filter((e) => e.pile === p.key && (!finding || lienFindMatch(findFactsFor(e.jobId, e.gcCustomerId, [p.label]), findWords).ok)))
  const retSelected = retVisible.find((e) => e.jobId === retSelectedJobId) ?? (!oneColumn ? retVisible[0] : undefined) ?? null
  const retCount = retEntries.filter((e) => e.pile !== 'sent').length
  const retReady = data?.retainage.counts.ready ?? 0
  /** What the run lists (v2.4568): ready and printed notices, and ready retainage. The buttons that open it count the same. */
  const runCount = (counts?.ready ?? 0) + (counts?.printed ?? 0) + retReady
  // The run's press in a phone's More sheet (v2.4823): when nothing is left to print, it says what the run will do, the mail numbers, as the printed footer already does. The title bar carried the same door on a computer until v2.7490.
  const runDoor = runDoorWords({ ready: counts?.ready ?? 0, printed: counts?.printed ?? 0, retReady })
  // The approved notices the leader has not signed yet: the Board's notices' print counts them as waiting.
  const readyWaits = (data?.queue.piles.ready ?? []).filter((e) => lienItemUnsigned(e.item)).length
  // The print at the foot of each Board column (v2.7470, punch list #362, the owner's *Yes, build this* of 2026-11-16): the
  // whole run under the notices, the batch print itself under the affidavits, counted as the run's door and By paper's
  // print bar count. The lien office's alone, as those two are.
  // Whose signature the unsigned notices wait on, by name when it is one leader's; else *the leader*.
  const unsignedLeaderIds = new Set((data?.queue.piles.ready ?? []).filter((e) => lienItemUnsigned(e.item)).map((e) => data?.jobsById[e.jobId]?.master_user_id ?? null))
  const unsignedLeaderName = unsignedLeaderIds.size === 1 ? (leaderNameFor?.([...unsignedLeaderIds][0] ?? null) ?? '') : ''
  const boardPrints =
    office && data
      ? {
          notice: lienBoardNoticePrint({ toPrint: (counts?.ready ?? 0) + retReady, waits: readyWaits, printed: counts?.printed ?? 0, leaderName: unsignedLeaderName }),
          affidavit: lienBoardAffidavitPrint({ ready: affPrintPlan.ready.length, held: affPrintPlan.gated.length, earlierForm: affPrintPlan.held.length, with: [affHelpSheet ? 'the help sheet' : '', affNoticeRecord ? 'the notice records' : '', affNoticeCopies && affNoticeCopyCount > 0 ? 'copies of the notices' : ''].filter(Boolean), shown: Boolean(affShown) }),
        }
      : null
  const openWholeRun = () => {
    setRunTakeBack(false)
    setRunGcId(null)
    setRunOpen(true)
  }
  const onBoardPrint = (side: LienBoardPrintSide) => (side.act === 'print_affidavits' ? printReadyAffidavits() : openWholeRun())
  // What a print leaves out, by its door: the approved notices on By paper, where a row says it is unsigned; the held affidavits, narrowed to them.
  const onBoardPrintLeft = (side: LienBoardPrintSide) => {
    setMobileListShown(false)
    if (side.kind === 'notice') {
      setCalendarJobFilter(null)
      setKind('notice')
      setPile('ready')
      return
    }
    setKind('affidavit')
    if (affPrintPlan.gated.length > 0) showHeldAffidavits(true)
    else {
      setAffHeldOnlyPicked(false)
      setAffPile('ready')
    }
  }
  // The pages that print in front of the stack are ticked on By paper's print bar, at Ready to file.
  const onBoardPrintNote = () => {
    setAffHeldOnlyPicked(false)
    setAffPile('ready')
    setKind('affidavit')
  }
  // The title bar's run door is retired (v2.7490, the owner's call of 2026-11-16: *Retire it everywhere*). On a computer the run opens from the Board's notices' print on To do and from By paper's pile and footers. On a phone it is still the first row of More, off Affidavits, and the More button wears its count (punch list #352, PR 1).
  const runDoorShown = kind !== 'affidavit' && office && runCount > 0
  const runDoorHint = runDoor.act === 'record' ? 'The run as a checklist: each printed notice with its Printed, Signed and Mailed ticks; type each envelope’s tracking number to record the mailing' : 'Every approved notice — monthly and retainage — as one packet, then a checklist with Printed, Signed and Mailed ticks per notice'
  const gcNoticeShown = kind === 'notice' && office && !!onPutGcOnNotice && gcPickerOptions.length > 0
  const recordsDoorShown = office && !!onOpenOwnerRecords
  useLayoutEffect(() => {
    const bar = titleBarRef.current
    if (isMobile || !bar) return
    const measure = () => {
      const line = readLienDeskTitleLine(bar)
      if (!line) return setTitleLineFit('none')
      setTitleLineFit(lienDeskTitleLineFit(line.width, line.parts))
      // The pile line (v2.7311): the span's width is the same at the line's end and under the piles, so the answer holds once the break is drawn.
      const piles = readLienDeskPileLine(bar)
      setPileLineFit(piles ? lienDeskPileLineFit(piles.width, piles.parts) : 'one_line')
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    // The bar moves with the window; the views, the paper tabs and the piles move with their words. The door and the presses keep their widths wherever they sit.
    const ro = new ResizeObserver(measure)
    ro.observe(bar)
    for (const part of ['[data-lien-desk-kinds]', '[data-lien-desk-paper-kinds]', '[data-lien-desk-piles]', '[data-lien-desk-right]']) {
      const el = bar.querySelector(part)
      if (el) ro.observe(el)
    }
    return () => ro.disconnect()
  }, [isMobile, recordsDoorShown, paperShown, gcNoticeShown, kind, titleLineFit])
  // The title bar's shape on this screen: where the tools and the door sit, whether it has a second line, and whether that line breaks before its span (v2.7213, v2.7277, v2.7311).
  const titleBar = lienDeskTitleBarLayout({ isMobile, fit: titleLineFit, pileFit: pileLineFit, recordsDoor: recordsDoorShown, paperShown, gcNotice: gcNoticeShown })
  const moreRun = runDoorShown ? { label: runDoor.label, count: runDoor.count, hint: runDoorHint } : null
  const moreRows = lienDeskMoreRows({ run: moreRun, gcNotice: gcNoticeShown, legendLabel: LIEN_DESK_LEGEND.label, caller: office, share: !!data, ownerRecords: office && !!onOpenOwnerRecords })
  const moreButton = lienDeskMoreButton(moreRun)
  const pickMore = (key: LienDeskMoreKey) => {
    setMoreOpen(false)
    if (key === 'run') setRunOpen(true)
    else if (key === 'gc_notice') setGcPickerOpen(true)
    else if (key === 'rules') setRulesOpen(true)
    else if (key === 'caller') setCallScriptOpen(true)
    else if (key === 'legend') setLegendOpen(true)
    else if (key === 'share') setShareOpen(true)
    else if (key === 'owner_records') onOpenOwnerRecords?.()
  }
  // What each row's job still owes, for a phone's rows and its days' totals (punch list #352, PR 3): the open balance each list already draws.
  // What each row's job owes. A phone's row draws it (punch list #352); since v2.7371 a computer's list orders a day's rows by it, largest first.
  const phoneAmountFor = data ? lienPhoneAmounts({ notices: data.queue.entries, affidavits: data.affidavits.entries, retainage: data.retainage.entries }) : undefined
  // What a To do row's card may say about its job (v2.4631): read from what the desk already holds, nothing new.
  const stepFactsFor = (row: LienNextUpRow): LienStepFacts => {
    const base: LienStepFacts = { readyToSend: counts?.ready ?? 0, viewerIsLeader: leader && leadsRow(row) }
    if (!data || !row.jobId) return base
    const jobId = row.jobId
    const rowJob = data.jobsById[jobId]
    const rowAddress = rowJob?.customer_address_id ? data.addressesById[rowJob.customer_address_id] ?? null : null
    const rowOwner = lienPropertyOwnerDisplayName(resolveLienProperty(rowAddress, data.ownerByJob[jobId] ?? null).owner).trim() || null
    if (row.kind === 'affidavit') {
      const e = data.affidavits.entries.find((x) => x.jobId === jobId)
      return { ...base, ownerName: rowOwner, draftedOn: e?.item?.drafted_at ?? null, approvedOn: e?.item?.approved_at ?? null, gatesMissing: e?.gates.filter((g) => !g.ok).map((g) => g.label) ?? [] }
    }
    if (row.kind === 'retainage') {
      const e = data.retainage.entries.find((x) => x.jobId === jobId)
      return { ...base, ownerName: rowOwner, draftedOn: e?.item?.drafted_at ?? null, approvedOn: e?.item?.approved_at ?? null, coverNote: e?.item?.cover_note ?? false, readyToSend: retReady }
    }
    const e = data.queue.entries.find((x) => x.jobId === jobId)
    const months = e?.item?.months?.length ? e.item.months : e?.dueMonths ?? []
    return { ...base, ownerName: rowOwner, months: months.length ? describeNoticeMonths(months) : null, draftedOn: e?.item?.drafted_at ?? null, approvedOn: e?.item?.approved_at ?? null, coverNote: e?.item?.cover_note ?? false, offer: lienOfferFromItem(e?.item) }
  }

  // The piles with rows, in order; a title per pile sticks at `i` bars from the top once passed and `n-1-i` from the bottom while ahead (v2.4672).
  // On a phone one title pins, the pile being read, and each is a thumb tall (punch list #352, PR 5; `lienPhoneLists.ts`).
  // The three By paper lists share the titles' wiring (`LienPileHeads.tsx`, the owner's ask of 2026-11-15); the rule of where a title sits stays in `lienPhoneLists.ts`.
  const pilesShown = PILE_ORDER.map((p) => ({ p, rows: visible.filter((e) => e.pile === p), total: visibleAll.filter((e) => e.pile === p).length })).filter((x) => (finding ? x.total > 0 : x.rows.length > 0))
  const noticeHeads = useLienPileHeads(pilesShown.map((x) => x.p), isMobile)
  const list = (
    <div ref={noticeHeads.listRef} onScroll={noticeHeads.onScroll} data-lien-desk-list style={{ position: 'relative', borderRight: isMobile ? 'none' : '1px solid var(--border)', overflow: 'auto', minWidth: 0 }}>
      {visible.length === 0 && finding && visibleAll.length > 0 && alsoSent.length === 0 ? (
        <div data-testid="lien-desk-find-nothing" style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8125rem', display: 'grid', gap: 4 }}>
          <strong style={{ color: 'var(--text-strong)' }}>{lienFindNothingWords(find).head}</strong>
          <span>{lienFindNothingWords(find).tryWords}</span>
          <span>{lienFindNothingWords(find).elsewhere}</span>
        </div>
      ) : visible.length === 0 && pile && !loading && data ? (
        <div data-lien-desk-empty-pile={pile} style={{ fontSize: '0.8125rem' }}>
          <EmptyState
            compact
            main={`${lienEmptyPileWords(pile, entries.length - visibleAll.length).head} ${lienEmptyPileWords(pile, entries.length - visibleAll.length).rest}`}
            next={{ label: LIEN_SHOW_EVERY_PILE, onPress: () => setPile(null) }}
          />
        </div>
      ) : visible.length === 0 ? (
        <p style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
          {loading || data == null ? 'Looking at every unpaid sub job…' : 'Nothing is due — every unpaid month on a sub job is noticed, or is more than 30 days from its deadline.'}
        </p>
      ) : null}
      {calendarJobFilter ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem 0.9rem 0', fontSize: '0.75rem' }} data-testid="lien-desk-calendar-filter">
          <span style={{ padding: '2px 8px', borderRadius: 999, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', fontWeight: 700 }}>
            {calendarJobFilter.jobIds.size} {calendarJobFilter.jobIds.size === 1 ? 'job' : 'jobs'} from the calendar · by {formatYmdMonthDay(calendarJobFilter.ymd)}
          </span>
          <button type="button" onClick={() => setCalendarJobFilter(null)} style={{ ...btn('plain'), padding: '1px 8px', fontSize: '0.72rem' }}>
            show every job
          </button>
        </div>
      ) : null}
      {pilesShown.map(({ p, rows, total }, i) => {
        const label = LIEN_DESK_PILES.find((x) => x.key === p)?.label ?? p
        return (
          <Fragment key={p}>
            <LienPileHead pile={p} label={label} count={lienPileHeadCount(rows.length, total, counts?.[p], finding)} i={i} n={pilesShown.length} phone={isMobile} on={noticeHeads.lit === p} empty={finding && rows.length === 0} onPress={() => noticeHeads.scrollToPile(p, i)} onShowEvery={pile ? () => setPile(null) : null}>
              {p === 'ready' && office && runCount > 0 ? (
                <button type="button" data-lien-pile-run onClick={() => setRunOpen(true)} title="Every approved notice as one packet" style={{ padding: '1px 8px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', font: 'inherit', fontSize: '0.66rem', fontWeight: 700, letterSpacing: 0, textTransform: 'none', cursor: 'pointer', whiteSpace: 'nowrap', ...(isMobile ? PHONE_PILE_PRESS : null) }}>
                  {lienRunActLabel('print', runCount)}
                </button>
              ) : null}
              {p === 'sent' && mailedJobIds.size > 0 ? (
                <button type="button" data-lien-pile-deliveries={deliveriesOnly ? 'on' : 'off'} onClick={() => setDeliveriesOnly((v) => !v)} title={deliveriesOnly ? 'Every sent notice' : 'Only the notices mailed through Docsmit, with where each envelope is'} style={{ padding: '1px 8px', borderRadius: 6, border: '1px solid var(--border-strong)', background: deliveriesOnly ? 'var(--bg-blue-tint)' : 'var(--surface)', color: deliveriesOnly ? 'var(--text-blue-700)' : 'var(--text-700)', font: 'inherit', fontSize: '0.62rem', fontWeight: 700, letterSpacing: 0, textTransform: 'none', cursor: 'pointer', whiteSpace: 'nowrap' , ...(isMobile ? PHONE_PILE_PRESS : null) }}>
                  {deliveriesOnly ? 'Every sent notice' : `Deliveries · ${mailedJobIds.size}`}
                </button>
              ) : null}
            </LienPileHead>
            <div data-lien-pile-rows={p}>
            {rows.map((e) => {
              const g = e.gcCustomerId ? data?.gcsById[e.gcCustomerId] : undefined
              const sel = e.jobId === selectedJobId
              const sev = severityColors(e.severity)
              const named = e.item && e.item.status !== 'sent' && e.item.status !== 'missed' && e.item.months.length ? e.item.months : e.dueMonths
              const state =
                e.pile === 'awaiting'
                  ? `awaiting approval · ${e.item?.submitted_at ? formatYmdMonthDay(calendarYmdInAppTzFromIso(e.item.submitted_at)) : ''}`
                  : e.pile === 'ready'
                    ? `${
                        e.item?.approval_mode === 'word'
                          ? wordRecordWords(e.item, leaderNameFor?.(data?.jobsById[e.jobId]?.master_user_id ?? null))
                          : e.item?.approval_mode === 'rule'
                            ? 'standing rule'
                            : 'approved'
                      }${e.item && lienChipSigned(signatureColumnsOf(e.item), lienFieldsHash(e.item.fields)) === 'unsigned' ? ' · unsigned' : ''}`
                    : e.pile === 'printed'
                      // Approved · to mail (*In the run* until v2.7434): the row names the tick it waits on, as the run's checklist does.
                      ? lienRunRowLine(true, !!e.item && lienChipSigned(signatureColumnsOf(e.item), lienFieldsHash(e.item.fields)) !== 'unsigned', false)
                    : e.pile === 'held'
                      ? `held · ${e.item?.hold_reason === 'promised' ? 'they promised' : 'call first'} · re-asks ${e.item?.hold_until ? formatYmdMonthDay(e.item.hold_until) : ''}`
                      : e.pile === 'sent'
                        ? `sent ${e.item?.sent_at ? formatYmdMonthDay(calendarYmdInAppTzFromIso(e.item.sent_at)) : ''}${(() => { const f = (data?.filingsByJob[e.jobId] ?? []).find((x) => x.id === e.item?.sent_filing_id); if (!f) return ''; const pieces = data?.mailPiecesByFiling?.[f.id] ?? []; return pieces.length ? filingMailTail(pieces, formatYmdMonthDay) : sendsTrackingOwed(f.sends).length ? ' · tracking owed' : '' })()}`
                        : e.pile === 'missed'
                          ? `window closed on ${e.missedMonths.map(workMonthShort).join(', ')}`
                          : e.pile === 'needs_owner'
                            ? 'owner of record missing'
                            : e.item
                              ? 'draft saved'
                              : ''
              // A notice that went inside thirty days on a row off the Sent pile (v2.6624, punch list #248): the day it went stays in the row's words.
              const sentWords = e.pile !== 'sent' && e.sentItem?.sent_at ? `sent ${formatYmdMonthDay(calendarYmdInAppTzFromIso(e.sentItem.sent_at))}` : ''
              return (
                <button
                  key={e.jobId}
                  type="button"
                  onClick={() => {
                    // Stacked, the notice opens through the address, as a history entry of its own (punch list #182 PR 3).
                    if (stacked && onOpenNotice) onOpenNotice(e.jobId, pile)
                    else {
                      setSelectedJobId(e.jobId)
                      setMobileListShown(false)
                    }
                  }}
                  aria-current={sel ? 'true' : undefined}
                  style={{ display: 'grid', gridTemplateColumns: '8px 1fr auto', gap: '0.2rem 0.6rem', width: '100%', textAlign: 'left', padding: '0.5rem 0.9rem', border: 'none', borderTop: '1px solid var(--border)', background: sel ? 'var(--bg-blue-tint)' : 'transparent', cursor: 'pointer', font: 'inherit', color: 'inherit', fontSize: '0.8125rem' }}
                >
                  <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 6, background: e.severity === 'red' ? 'var(--text-red-600)' : e.severity === 'amber' ? 'var(--text-amber-800)' : 'var(--border-strong)' }} />
                  <span style={{ minWidth: 0 }}>
                    {listLabel(e.jobId, 'notice', true)}
                    {g?.name ? <span style={{ color: 'var(--text-muted)' }}> · GC <LienFindMarked text={g.name} words={findWords} /></span> : null}
                  </span>
                  <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatUsdNoCents(e.openBalance)}</span>
                  <span style={{ gridColumn: '2 / 4', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {deadlineWords(e) ? <span style={chip(sev.bg, sev.fg)}>{deadlineWords(e)}</span> : null}
                    {e.pile !== 'missed' && e.missedMonths.length ? (
                      <span style={chip('var(--bg-red-tint)', 'var(--text-red-600)')} data-lien-desk-missed-chip title={e.missedUnrecorded.length ? 'The window closed with nothing recorded — the pane has the note' : 'The window closed; someone noted it'}>
                        {e.missedMonths.map(workMonthShort).join(', ')} window closed{e.missedUnrecorded.length ? ' · not noted' : ''}
                      </span>
                    ) : null}
                    <span>{named.map(workMonthShort).join(' + ')}</span>
                    {e.datedFromCreation ? <span data-lien-desk-dated-from-creation>· {lienStandInWords(e.datedFromBill === true)}</span> : null}
                    {state ? <span>· {state}</span> : null}
                    {sentWords ? <span data-lien-desk-sent-words>· {sentWords}</span> : null}
                    {(() => {
                      // Letter two (v2.3760): the second letter's clock on a sent notice, and its mark on a draft that is one.
                      const lt = data?.letterTwoByJob[e.jobId]
                      const draftTwo = e.item && e.item.status !== 'sent' ? parseLienDeskDraftFields(e.item.fields)?.letterTwo : undefined
                      if (draftTwo) return <span style={chip('var(--bg-blue-tint)', 'var(--text-blue-800)')} data-lien-letter-two="draft">the attorney’s letter · {letterTwoKindLabel(draftTwo.kind)}</span>
                      if (!lt || (e.pile !== 'sent' && !e.sentItem) || lt.state === 'none' || lt.state === 'paid') return null
                      const tone = lt.state === 'overdue' ? chip('var(--bg-red-tint)', 'var(--text-red-600)') : lt.state === 'due' ? chip('var(--bg-amber-tint)', 'var(--text-amber-800)') : lt.state === 'sent' || lt.state === 'gc_authorized' || lt.state === 'owner_called' ? chip('var(--bg-green-tint)', 'var(--text-green-800)') : chip('var(--bg-subtle)', 'var(--text-muted)')
                      return <span style={tone} data-lien-letter-two={lt.state}>{lt.words}</span>
                    })()}
                    <LienSupplierMarkLine mark={supplierMarks.get(e.jobId)} />
                    <LienFindHits hits={findHits.get(e.jobId)} words={findWords} />
                  </span>
                </button>
              )
            })}
            </div>
          </Fragment>
        )
      })}
      {alsoSent.length ? (
        <>
          <div className="lienPileHead" data-lien-pile-head="also_sent" data-on="no" style={{ position: 'static', color: 'var(--text-blue-800)', background: 'var(--bg-blue-tint)' }}>
            <span className="lienPileHeadBtn" style={{ cursor: 'default' }}>
              Also sent · every notice out
              <span className="n" data-lien-pile-count="also_sent">{alsoSent.length}</span>
            </span>
          </div>
          <div data-lien-pile-rows="also_sent">
            {alsoSent.map((h) => (
              <button
                key={h.itemId}
                type="button"
                onClick={() => setCallerJobId(h.jobId)}
                data-lien-also-sent={h.jobId}
                title="Open the owner’s call on this notice"
                style={{ display: 'grid', gap: '0.2rem', width: '100%', textAlign: 'left', padding: '0.5rem 0.9rem', border: 'none', borderTop: '1px solid var(--border)', background: 'var(--surface)', color: 'inherit', font: 'inherit', cursor: 'pointer' }}
              >
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong><LienFindMarked text={h.who} words={findWords} /></strong>
                  <span style={{ color: 'var(--text-link)', fontWeight: 600, whiteSpace: 'nowrap' }}>Open the call ›</span>
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <span style={{ padding: '0 7px', borderRadius: 999, background: 'var(--bg-green-tint)', color: 'var(--text-green-800)', fontWeight: 700 }}>Sent {formatYmdMonthDay(h.facts.mailedOn)}</span> · <LienFindMarked text={h.what} words={findWords} />
                </span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )

  // The page labels (v2.4726): the pages in the pane in order, each label a sticky bar that stacks under the strip once
  // passed and at the pane's foot while ahead (the Notices list's pile titles, v2.4651), lit for the page under the reader,
  // and a button that scrolls to its page.
  const pageKeys: string[] = [...(coverHtml ? ['cover'] : []), ...(releaseHtml ? ['release'] : []), 'notice', ...(payHtml ? ['pay'] : [])]
  // The heads over the page labels: on a computer every section head stacked, on a phone the one pinned head (punch list #352, PR 6);
  // and a label is as tall as those heads (v2.7323), so the bars in the pane are one kind on either screen. Read when a label
  // is drawn or pressed: `paneHeads` is declared after this point.
  const headsOverPages = () => (isMobile ? LIEN_PANE_HEAD_H_PHONE : lienPaneHeadsOverPages(paneHeads) * LIEN_PANE_HEAD_H)
  const pageLabelH = isMobile ? LIEN_PANE_HEAD_H_PHONE : PAGE_LABEL_H
  const relightPages = (host: HTMLElement) => {
    let on: string | null = null
    pageKeys.forEach((key, i) => {
      const label = host.querySelector<HTMLElement>(`[data-lien-desk-page-label="${key}"]`)
      if (label && label.offsetTop <= host.scrollTop + stripH + headsOverPages() + (i + 1) * pageLabelH) on = key
    })
    setLitPage((prev) => (prev === on ? prev : on))
  }
  const scrollToPage = (key: string, i: number) => {
    const host = paneRef.current
    const label = host?.querySelector<HTMLElement>(`[data-lien-desk-page-label="${key}"]`)
    if (!host || !label) return
    const top = Math.max(0, label.offsetTop - stripH - headsOverPages() - i * pageLabelH)
    if (typeof host.scrollTo === 'function') host.scrollTo({ top, behavior: 'smooth' })
    else host.scrollTop = top
    setLitPage(key)
  }
  // One page exported alone (v2.7432, Taunya's ask of 2026-11-15): Open ↗ and PDF ↓ at the bar's right end, beside the bar's own
  // button. The page is made as the run makes it; until the notice is approved its foot carries the draft line.
  const pageExport = (key: string) => {
    if (!selected || !isLienExportPageKey(key)) return null
    const named = { jobNumber: job ? jobNumberOf(job, selected.jobId) : '', jobName: job?.job_name, key }
    const title = lienExportTitle(named)
    return (
      <LienPageExportPresses
        pageKey={key}
        phone={isMobile}
        fileName={lienExportFileName(named)}
        filing={lienExportFiling({ pile: selected.pile, jobId: selected.jobId, title })}
        build={() => lienPageExportBlob(key, { coverBlocks, noticeBlocks: () => buildLienNoticeBlocks(noticeFields, docExtras, { signature: paneSigned }), payBlocks, release: noticeRelease }, { title, draftLine: lienExportDraftLine(selected.pile, todayYmd) })}
      />
    )
  }
  // A bar is one line in a pane of any width (v2.7446): the muted words after the page's name give way first and end in an ellipsis,
  // then the name itself, and the two presses at the right never do. The whole line is the cut words' `title`.
  const pageLabel = (key: string, words: string, extra: { words: string; amber?: boolean; pay?: boolean } | null) => {
    const i = pageKeys.indexOf(key)
    const on = (litPage ?? pageKeys[0]) === key
    return (
      <div className="lienPileHead" data-lien-desk-page-label={key} data-on={on ? 'yes' : 'no'} style={{ top: stripH + headsOverPages() + i * pageLabelH, bottom: 'auto', height: pageLabelH, zIndex: 1, margin: '0 -1.1rem -0.3rem', padding: '0 1.1rem', ...(isMobile ? { fontSize: '0.75rem' } : null) }}>
        <button type="button" className="lienPileHeadBtn" onClick={() => scrollToPage(key, i)} title="Go to this page" style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <span className="lienPageLabelName">{words}</span>
          {extra ? (
            <>
              {' '}
              <span className="lienPageLabelMore" title={`${words} ${extra.words}`} data-lien-desk-pay-label={extra.pay ? true : undefined} style={extra.amber ? { color: 'var(--text-amber-800)' } : undefined}>{extra.words}</span>
            </>
          ) : null}
        </button>
        {pageExport(key)}
      </div>
    )
  }
  // The letter in the caller's hand (v2.4731): the selected job's last notice, as the call sheet reads it.
  const callFactsFor = (jobId: string) => {
    if (!data) return null
    const lt = data.letterTwoByJob[jobId]
    const first =
      (lt?.firstItemId ? data.items.find((i) => i.id === lt.firstItemId) : null) ??
      data.items.filter((i) => i.job_id === jobId && i.status === 'sent' && !i.voided_at).sort((a, b) => (b.sent_at ?? '').localeCompare(a.sent_at ?? ''))[0] ??
      (selected?.jobId === jobId ? selected.item : null) ??
      null
    const cJob = data.jobsById[jobId]
    const cGc = cJob?.gc_customer_id ? data.gcsById[cJob.gc_customer_id] : undefined
    const cAddress = cJob?.customer_address_id ? data.addressesById[cJob.customer_address_id] ?? null : null
    if (!first) {
      // Nothing drafted or mailed yet: the words still read with the job's own facts, and the window says nothing has gone out.
      if (!cJob) return null
      const owner = lienPropertyOwnerDisplayName(resolveLienProperty(cAddress, data.ownerByJob[jobId] ?? null).owner).trim()
      const open = Number(cJob.revenue ?? 0) - Number(cJob.payments_made ?? 0)
      return { hasLetter: false, facts: { ...genericCallFacts(callerUs), jobLabel: jobLabel(cJob, jobId), property: (cJob.job_address ?? '').trim() || 'your property', ownerName: owner, gcName: cGc?.name ?? 'your builder', amount: open > 0 ? formatUsdNoCents(open) : '' } }
    }
    return { hasLetter: first.status === 'sent', facts: callLetterFactsFor({ item: first, job: cJob, gc: cGc, address: cAddress, owner: data.ownerByJob[jobId] ?? null, us: callerUs, phone: signerPhoneFor ? signerPhoneFor(cJob?.master_user_id ?? null) : (issuer?.phone ?? '').trim() }) }
  }

  // The find box above a list (v2.4721): one column, the box then the scrolling list.
  const withFind = (node: ReactNode, matched: number) => (
    <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', minHeight: 0, overflow: 'hidden' }} data-lien-desk-find-column>
      <LienDeskFindBox value={find} onChange={setFind} matched={matched} isMobile={isMobile} />
      {node}
    </div>
  )

  // A month is shown once: still-open months (and whatever this item names) are cards; the rest of the job's months are history.
  const monthCards: LienDeskMonthCard[] = monthChoices
    .filter((m) => months.has(m.key) || (!m.noticed && !m.closed))
    .map((m) => {
      const ev = wm?.months.find((x) => x.key === m.key)
      return {
        key: m.key,
        on: months.has(m.key),
        locked: m.noticed || m.closed || (item != null && item.status !== 'drafted'),
        hours: ev?.hours ?? m.approvedHours,
        crew: ev ? `${ev.people.length} ${ev.people.length === 1 ? 'person' : 'people'} · ${ev.dayCount} ${ev.dayCount === 1 ? 'day' : 'days'}` : '',
        deadline: m.deadline,
        daysLeft: m.daysLeft,
        noticed: m.noticed,
        closed: m.closed,
        fromCreation: m.fromCreation,
        fromBill: m.fromBill,
      }
    })

  // Months down, papers across (#38): every month the job has, every § 53.056 paper that went out, this notice as the last column.
  const monthGrid = selected && data
    ? buildLienMonthGrid({
        jobId: selected.jobId,
        months: monthChoices,
        evidence: wm?.months.map((x) => ({ key: x.key, hours: x.hours, people: x.people.length, dayCount: x.dayCount, pendingHours: x.pendingHours })) ?? [],
        items: data.items,
        filings: data.filingsByJob[selected.jobId] ?? [],
        allFilings: Object.values(data.filingsByJob).flat(),
        checked: months,
        thisItem: item ?? null,
        thisPile: selected.pile,
        propertyKind: property.propertyKind ?? '',
        todayYmd,
        lateUntil,
      })
    : null

  const { gates, verdict: gateVerdict } = buildLienDeskGates({
    ownerName,
    // Every name the record gives is asked (punch list #314): a city filed beside an attention line is still a city.
    ownerIsPublic: lienOwnerIsPublic([property.owner.ownerName, property.owner.ownerCompany], property.publicAnswer),
    ownerMailingAddress: property.owner.mailingAddress,
    gcName: gc?.name ?? '',
    gcAddress: gc?.address ?? '',
    propertyKind: property.propertyKind,
    county: property.county ?? '',
    monthLabels: (selected?.months ?? []).map((m) => workMonthShort(m.key)),
    pickedMonthsCount: monthsList.length,
    monthsOnJob: selected?.months.length ?? 0,
    pendingSessions: wm?.pendingSessions ?? 0,
    datedFromCreation: selected?.datedFromCreation ?? false,
    datedFromBill: selected?.datedFromBill ?? false,
    billedOpen: selected ? openBalance : undefined,
    unbilled,
    sentBills: claimBills.length,
  })
  const gateByKey = Object.fromEntries(gates.map((g) => [g.key, g])) as Record<LienGateKey, LienGate>
  // A sent notice with nothing due (v2.6625, punch list #248 face two, the owner's rule A): no next notice is about to go, so the
  // gates judge nothing — they fold to one line, the day it went and the owner, the GC, the kind and the months as the paper went
  // (890 read *Can't go out yet · 3 blockers* and *No month picked* over an empty grid). A Sent row with months still due keeps the four.
  const sentForFold = selected?.pile === 'sent' && selected.dueMonths.length === 0 && selected.item?.status === 'sent' ? selected.item : null
  const gatesFold = sentForFold ? lienSentGatesFold({ sentOn: sentForFold.sent_at ? formatYmdMonthDay(calendarYmdInAppTzFromIso(sentForFold.sent_at)) : '', gates, noticeMonths: sentForFold.months ?? [], monthShort: workMonthShort }) : null

  // A book row opens the job on the pane its next step belongs to; a job the desk does not list yet opens its Lien window (v2.3768).
  const openBookRow = (row: LienTimelineBookRow) => {
    const k = row.timeline.next.kind
    const onAffidavitSide = k === 'affidavit' || k === 'serve' || k === 'suit' || k === 'release'
    if (onAffidavitSide && data?.affidavits.entries.some((e) => e.jobId === row.jobId)) {
      setKind('affidavit')
      setAffSelectedJobId(row.jobId)
      setMobileListShown(false)
    } else if (data?.queue.entries.some((e) => e.jobId === row.jobId)) {
      if (stacked && onOpenNotice) onOpenNotice(row.jobId, null)
      else {
        setKind('notice')
        setSelectedJobId(row.jobId)
        setMobileListShown(false)
      }
    } else {
      onOpenLienInstruments(row.jobId)
    }
  }

  // The job's lien timeline (v2.3761): every Chapter 53 step in order, from what the desk already loaded.
  const timeline =
    selected && data
      ? buildLienTimelineFromDesk(selected.jobId, {
          rows: data.rows,
          items: data.items,
          filings: data.filingsByJob[selected.jobId] ?? [],
          entry: selected,
          affidavit: data.affidavits.entries.find((e) => e.jobId === selected.jobId) ?? null,
          retainage: lienRetainageClockFromDesk(data, selected.jobId),
          isSub: Boolean(selected.gcCustomerId),
          propertyKind: property.propertyKind,
          lastWorkDate: job?.last_work_date ?? null,
          openBalance,
          todayYmd,
          demandLetters: data.demandLettersByJob?.[selected.jobId] ?? null,
        })
      : null

  // A stop's paper (v2.4793): what the window shows for each stop of the selected job's timeline. The notice's pages are the pane's
  // own (the draft as it stands); the affidavit's and the retainage notice's come from the same builders their panes print with.
  const stopPaperFor = (step: LienTimelineStep): LienStopPaper => {
    const none: LienStopPaper = { pages: [], envelope: null, before: [], record: null, act: null }
    if (!selected || !data) return none
    const jobId = selected.jobId
    const filings = data.filingsByJob[jobId] ?? []
    const filedWords = (verb: string, ymd: string | null, iso: string) => `${verb} ${formatYmdMonthDay(ymd ?? calendarYmdInAppTzFromIso(iso))}`
    const envelope = `To ${ownerName || 'the owner of record'} and ${gc?.name || 'the original contractor'} by certified mail${gc?.email ? ` · courtesy PDF to ${gc.email}` : ''}`
    const before = gatesFold ? [] : gates.filter((g) => g.tone !== 'ok').map((g) => ({ key: g.key, words: `${g.label}: ${g.value}` }))
    const go = (k: 'affidavit' | 'retainage', label: string) => ({ label, onPress: () => { setStopOpen(null); setKind(k) } })
    const jobNo = job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) : ''
    // A stop that went out shows the paper as it went out — the filing's own snapshot — and its stored document.
    const asSent = (f: JobLienFilingRow, words: string, extra: Partial<LienStopPaper> = {}): LienStopPaper => {
      const page = filingSnapshotPage(f, { issuer, jobNumber: jobNo })
      return { ...none, pages: page ? [page] : [], record: { words, href: f.document_url || null }, note: page ? 'The paper as it went out, from the record.' : null, ...extra }
    }
    const kind = lienStopPaperKind(step)
    if (kind === 'notice') {
      const sent = step.monthKey ? filings.find((f) => f.kind === 'notice_53_056' && !f.voided_at && (f.months_covered ?? []).includes(step.monthKey!)) : undefined
      if (sent) return asSent(sent, filedWords('Mailed', sent.filed_at, sent.created_at), { envelope })
      if (step.state === 'missed' || step.fold) return { ...none, note: 'The window closed with nothing sent. The lien right on that work is gone; the money is still owed.' }
      const onDraft = step.monthKey ? months.has(step.monthKey) : false
      if (!onDraft) return { ...none, note: `${workMonthLabel(step.monthKey ?? '')} is not on the notice being drafted. Tick it under Months on this job and it joins the paper.` }
      const pages = [
        ...(coverHtml ? [{ key: 'cover', label: `Page 1 of ${pageTotal} · cover letter`, html: coverHtml }] : []),
        ...(releaseHtml ? [{ key: 'release', label: `Page ${coverHtml ? 2 : 1} of ${pageTotal} · conditional release`, html: releaseHtml }] : []),
        { key: 'notice', label: `Page ${noticePageNumber} of ${pageTotal} · the notice`, html: docHtml },
        ...(payHtml ? [{ key: 'pay', label: `Page ${pageTotal} of ${pageTotal} · pay codes`, html: payHtml }] : []),
      ]
      return { pages, envelope, before, record: null, noticeMonths: [...months], act: { label: 'Go to the paper on the desk ▾', onPress: () => { setStopOpen(null); scrollToPage('notice', pageKeys.indexOf('notice')) } } }
    }
    if (kind === 'retainage') {
      const sent = filings.find((f) => f.kind === 'retainage_53_057' && !f.voided_at)
      if (sent) return asSent(sent, filedWords('Mailed', sent.filed_at, sent.created_at), { envelope })
      const pages = retainageStopPages({ data, jobId, issuer, signerNameFor, signerPhoneFor, todayYmd }) ?? []
      return { pages, envelope: pages.length ? envelope : null, before: [], record: null, act: pages.length ? go('retainage', 'Open it on Retainage ›') : null, note: pages.length ? null : 'No retainage is recorded on this job, so there is no § 53.057 notice to show.' }
    }
    if (kind === 'affidavit' || kind === 'serve') {
      const filed = filings.filter((f) => f.kind === 'affidavit' && !f.voided_at && f.filed_at).sort((a, b) => (b.filed_at ?? '').localeCompare(a.filed_at ?? ''))[0]
      if (filed) {
        const words = kind === 'serve' ? (filed.served_at ? filedWords('Served', filed.served_at, filed.created_at) : `Filed ${formatYmdMonthDay(filed.filed_at!)} · a copy to the owner and the GC is still owed`) : `${filedWords('Filed', filed.filed_at, filed.created_at)}${filed.recording_number ? ` · ${filed.recording_number}` : ''}`
        return asSent(filed, words, { envelope: kind === 'serve' ? `A copy of the filed affidavit to ${ownerName || 'the owner of record'} and ${gc?.name || 'the original contractor'}` : null })
      }
      const pages = affidavitStopPages({ data, jobId, issuer, signerNameFor, todayYmd }) ?? []
      return { pages, envelope: kind === 'serve' ? `A copy of the filed affidavit to ${ownerName || 'the owner of record'} and ${gc?.name || 'the original contractor'}, within five days of filing` : null, before: [], record: null, act: pages.length ? go('affidavit', 'Open it on Lien affidavits ›') : null, note: pages.length ? (kind === 'serve' ? 'Served as filed: the same affidavit, a copy in each envelope.' : null) : 'The affidavit window has not opened on this job yet.' }
    }
    if (kind === 'release') {
      const filed = filings.find((f) => f.kind === 'release_of_record' && !f.voided_at)
      if (filed) return asSent(filed, filedWords('Released', filed.filed_at, filed.created_at))
      return { ...none, note: 'The release of record is made in the Release of Lien window once the job is paid.' }
    }
    if (kind === 'demand') return { ...none, note: 'The demand letter is sent from the job’s Lien window; its reply day is on the strip.' }
    if (kind === 'courtesy') return { ...none, note: 'The courtesy notice goes from the sent notice’s footer here; its record is on the notice and in the job’s History.' }
    return none
  }

  // The footer's section (v2.7422): on a computer the notice's footer is the pane's last section, `sign`, under the one blue head.
  const footInPane = !oneColumn
  // The pane's stacked heads (v2.4733): the five sections' title rows, pinned like the list's pile heads — passed ones under the strip, coming ones at the bottom, the one the reader is in lit.
  const paneHeads = selected
    ? lienPaneSections({
        nextWords: timeline?.next.words ?? null,
        gates: gatesFold ? { sentOn: gatesFold.sentOn } : { ready: gateVerdict.ready, headline: gateVerdict.headline, summary: gateVerdict.summary },
        houses: supplierJob ? { count: supplierJob.houses.length, housesOwed: supplierJob.housesOwed, owed: supplierJob.owed, paid: supplierJob.paid, asOf: formatYmdMonthDay(todayYmd) } : null,
        months: monthsList,
        claimWords: claimBills.length ? `${formatUsdNoCents(claimed.claim)} · ${lienBillsCountWords(claimBills.filter((b) => b.owed > 0).length, claimBills.length)}` : formatUsdNoCents(claimed.claim),
        pages: pageTotal,
        gcEmail: Boolean(gc?.email),
        monthShort: workMonthShort,
        money: formatUsdNoCents,
        foot: footInPane ? lienNoticeFootHead({ pile: selected.pile, signed: Boolean(paneSigned), signerFirst: (leaderName.trim().split(/\s+/)[0] ?? ''), dueMonths: selected.dueMonths.length }) : null,
      })
    : []
  // The heads' wiring is shared with the affidavit and retainage panes since v2.7320 (`useLienPaneHeads`): which section is lit from the pane's scroll, the press that lands a section under its own head, and the head itself. The strip's height is v2.4726's `stripH`, 0 while it is not pinned.
  const {
    head: paneHead,
    goTo: goToSection,
    relight: relightPane,
  } = useLienPaneHeads({ paneRef, sections: paneHeads, phone: isMobile, strip: { height: stripH, pinned: paneScrolled, foldPx: STRIP_COLLAPSE_PX, measure: () => stripRef.current?.getBoundingClientRect().height || stripH }, resetKey: selected?.jobId ?? null })

  // The scrolled strip's chips (v2.7318, the owner's rule of 2026-11-15 on JP372): only what the reader cannot see from where
  // they are, and every chip a press to the door the gate box already has. The kernel words them; this wires each act.
  const stripChips = selected
    ? lienStripChips({
        gates,
        monthWords: monthsList.map(workMonthShort).join(' + '),
        next: timeline ? { kind: timeline.next.kind, words: timeline.next.words, tone: timeline.next.tone } : null,
        claimWords: formatUsdNoCents(claimed.claim),
        claimByHand: claimed.corrected,
        wordingWords: wordingDiff.length ? wordingLineText(wordingDiff, wordingEditedBy) : '',
        fold: gatesFold,
      })
    : []
  const scrollPaneTo = (selector: string) => paneRef.current?.querySelector(selector)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  const pressStripChip = (act: LienStripChipAct) => {
    if (!selected) return
    if (act === 'top') paneRef.current?.scrollTo?.({ top: 0, behavior: 'smooth' })
    else if (act === 'ready') {
      // Down to the footer, whose primary is the send; a phone's folded footer opens so the press is on the screen.
      setFootFolded(false)
      const host = paneRef.current
      host?.scrollTo?.({ top: host.scrollHeight, behavior: 'smooth' })
      // preventScroll: the page around the desk must not move with the focus (it slid the title bar off the top on the first live press).
      window.setTimeout(() => (host?.closest('[aria-label="Lien desk"]') ?? document).querySelector<HTMLButtonElement>('[data-lien-desk-next] .lienFootActions button:last-of-type')?.focus?.({ preventScroll: true }), 80)
    } else if (act === 'gate:owner') {
      if (office) setPaneFix({ jobId: selected.jobId, focus: 'owner' })
      else pickGate('owner')
    } else if (act === 'gate:gc') onOpenEditJob(selected.jobId)
    // The month grid heads its section, so the section's own landing (the head under the strip) puts the grid in view; a plain scrollIntoView lost it under the stacked heads.
    else if (act === 'gate:months' || act === 'months') goToSection('months')
    else if (act === 'gate:kind' || act === 'gate:billed') pickGate(act === 'gate:kind' ? 'kind' : 'billed')
    else if (act === 'claim') scrollPaneTo('[data-lien-claim-box], [data-lien-claim-editor]')
    else if (act === 'wording') scrollPaneTo('[data-lien-desk-send-line]')
    else if (act === 'next') goToSection('path')
  }
  const stripChipStyle = (tone: LienStripChipTone): React.CSSProperties =>
    tone === 'red'
      ? chip('var(--bg-red-tint)', 'var(--text-red-600)')
      : tone === 'amber'
        ? chip('var(--bg-amber-tint)', 'var(--text-amber-800)')
        : tone === 'green'
          ? chip('var(--bg-green-tint)', 'var(--text-green-800)')
          : chip('var(--bg-subtle)', 'var(--text-700)')

  // The pane (v2.3522): a strip — title, gates, months, wording — then the paper, which takes the rest and is the
  // pane's own scroll. Once the gates scroll away a one-line strip sticks to the top so the facts stay one glance away.
  // The leader on a phone, on a notice waiting on him (v2.4881): three lines and two buttons; everything else under Details.
  const simpleApprove = Boolean(isMobile && leader && selected && selected.pile === 'awaiting')
  // The band's press (v2.7321): the kernel's act in this viewer's words. The leader signs what the office sends for approval;
  // the office waits on him once it is sent. A send the gates hold goes to the gate that holds it, as the footer's primary does.
  const noticeFirstBlocker = gates.find((g) => g.tone === 'blocker') ?? null
  const bandAct: LienNextAct | null = (() => {
    if (!selected || !timeline) return null
    const kernel = timeline.next.act
    if (kernel.kind !== 'footer') return null
    // Another paper is the next step: the press opens it where its own presses are.
    if (timeline.next.kind === 'affidavit') return { kind: 'footer', label: 'Open it on Lien affidavits ›' }
    if (timeline.next.kind === 'retainage') return { kind: 'footer', label: 'Open it on Retainage notices ›' }
    if (timeline.next.kind !== 'notice') return null
    const waitOnLeader: LienNextAct = { kind: 'none', waiting: null, words: `Waiting on ${leaderName || 'the leader'}` }
    switch (selected.pile) {
      case 'to_draft':
        if (!ready) return noticeFirstBlocker ? { kind: 'footer', label: `Go to gate ${noticeFirstBlocker.n} ›` } : kernel
        return leader ? { kind: 'footer', label: 'Sign and approve ›' } : office ? kernel : waitOnLeader
      case 'awaiting':
        return leader ? { kind: 'footer', label: 'Sign and approve ›' } : waitOnLeader
      case 'held':
        return leader ? { kind: 'footer', label: 'Release the hold and approve ›' } : office ? { kind: 'footer', label: 'Back to draft ›' } : waitOnLeader
      case 'ready':
      case 'printed':
        return office ? kernel : waitOnLeader
      default:
        return kernel
    }
  })()
  /** The band's doors, each the one a gate row, the footer or the desk's own tabs already hold. */
  const onBandAct = (act: LienNextActDoor) => {
    if (!selected) return
    const jobId = selected.jobId
    const fix = (focus: 'owner' | 'legal' | 'homestead_answer') => (office && data?.jobsById[jobId] ? setPaneFix({ jobId, focus }) : onOpenEditJob(jobId, 'property-record'))
    const footer = () => bringLienFooterUp(noticeFooterRef.current)
    switch (act) {
      case 'gate:owner':
        return fix('owner')
      case 'gate:legal':
        return fix('legal')
      case 'gate:homestead':
        return fix('homestead_answer')
      case 'gate:contractor':
        return onOpenCustomerRecord && selected.gcCustomerId ? onOpenCustomerRecord(selected.gcCustomerId) : onOpenEditJob(jobId)
      case 'gate:notice':
        // The notice is this pane: a late notice goes the way a drafted one does.
        return !ready && noticeFirstBlocker ? pickGate(noticeFirstBlocker.key) : office && !busy ? sendToLeader() : footer()
      case 'retainage':
        setKind('retainage')
        setRetSelectedJobId(jobId)
        return
      case 'serve':
      case 'release':
        return (onOpenLienAffidavit ?? onOpenLienInstruments)(jobId)
      case 'legal_desk':
        return onOpenLegalDesk ? onOpenLegalDesk() : footer()
      case 'footer':
        if (timeline?.next.kind === 'affidavit') {
          // The affidavit is the next paper: its own pane holds the press.
          setKind('affidavit')
          setAffSelectedJobId(jobId)
          return
        }
        if (timeline?.next.kind === 'retainage') {
          setKind('retainage')
          setRetSelectedJobId(jobId)
          return
        }
        if (busy) return footer()
        if (selected.pile === 'to_draft' && !ready) return noticeFirstBlocker ? pickGate(noticeFirstBlocker.key) : footer()
        if (selected.pile === 'to_draft') return office && !leader ? sendToLeader() : footer()
        if (selected.pile === 'awaiting' && leader) return approve()
        if (selected.pile === 'held') return leader ? approve() : office ? pullBack() : footer()
        if ((selected.pile === 'ready' || selected.pile === 'printed') && office) return setRunOpen(true)
        return footer()
    }
  }
  const pane = selected ? (
    <div
      ref={paneRef}
      data-lien-desk-pane
      data-lien-pane-phone={isMobile ? 'yes' : undefined}
      data-lien-pane-simple={simpleApprove && !detailsOpen ? 'yes' : undefined}
      onScroll={(ev) => {
        const next = ev.currentTarget.scrollTop > STRIP_COLLAPSE_PX
        setPaneScrolled((prev) => (prev === next ? prev : next))
        relightPages(ev.currentTarget)
        relightPane(ev.currentTarget)
      }}
      // The one column is held to the pane's width on every screen (a phone since punch list #352, PR 6; a computer since v2.7446), so a
      // bar's one line of words cannot set the pane's width and slide the whole paper sideways: an `auto` column is as wide as its widest word-run.
      style={{ position: 'relative', padding: '0 1.1rem', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.6rem', alignContent: 'start', overflow: 'auto', minWidth: 0 }}
    >
      {paneScrolled ? (
        <div
          ref={stripRef}
          data-lien-desk-strip
          style={{ position: 'sticky', top: 0, zIndex: 2, margin: '0 -1.1rem', padding: '0.45rem 1.1rem', background: 'var(--surface)', borderBottom: '1px solid var(--border)', boxShadow: '0 8px 14px -12px rgba(0,0,0,0.35)', display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.7rem', alignItems: 'center', fontSize: '0.8125rem' }}
        >
          <strong>{jobLabel(job, selected.jobId)}</strong>
          {/* Every chip is a press (v2.7318): a red one opens its gate's door, the green one goes to the send, the quiet ones to their sections; the Sent chip goes back up. */}
          {stripChips.map((c) => (
            <button
              key={c.key}
              type="button"
              className="lienStripChip"
              data-lien-strip-chip={c.key}
              data-tone={c.tone}
              data-lien-desk-strip-next={c.key === 'next' ? true : undefined}
              data-lien-strip-sent={c.key === 'sent' ? true : undefined}
              title={c.title}
              onClick={() => pressStripChip(c.act)}
              style={stripChipStyle(c.tone)}
            >
              {c.words}
            </button>
          ))}
          <span style={{ flex: 1 }} />
          <button type="button" onClick={() => paneRef.current?.scrollTo?.({ top: 0, behavior: 'smooth' })} style={linkBtn}>
            Show gates ▴
          </button>
        </div>
      ) : null}
      {/* A phone's way back is in the desk's header since punch list #352, PR 6 (it was a button here, a second one for a notice). */}
      <div data-lien-pane-keep style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.6rem', alignItems: 'baseline', paddingTop: isMobile ? '0.6rem' : '0.9rem' }}>
        <LienJobHeading label={jobLabel(job, selected.jobId)} onOpenJob={onOpenJob ? () => onOpenJob(selected.jobId) : undefined} />
        {storedDraft?.letterTwo && item ? (
          <span style={chip('var(--bg-blue-tint)', 'var(--text-blue-800)')} data-lien-letter-two-heading title="The second owner letter, on the same form to the same two recipients; the first packet stays on the record">
            the attorney’s letter · {letterTwoKindLabel(storedDraft.letterTwo.kind)}{storedDraft.letterTwo.afterSentAt ? ` · after the ${formatYmdMonthDay(calendarYmdInAppTzFromIso(storedDraft.letterTwo.afterSentAt))} packet` : ''}
          </span>
        ) : null}
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
          {gc?.name ? `· GC ${gc.name}` : '· no GC'} {job?.job_address ? `· ${job.job_address}` : ''}
        </span>
        {/* Steps · Windows on the title line (v2.7317): the owner's ask, out of the timeline box's corner. */}
        {!isMobile && timeline ? <span style={{ marginLeft: 'auto', alignSelf: 'center' }}><LienTimelineViewSwitch /></span> : null}
      </div>
      {simpleApprove ? (
        <div data-lien-pane-keep data-lien-approve-card style={{ display: 'grid', gap: '0.45rem', padding: '0.9rem 0.9rem 0.8rem', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-blue-tint)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Lien notice · {counts?.awaiting ?? 1} waiting on you
          </div>
          <div style={{ fontSize: '1.15rem', lineHeight: 1.25 }}>
            <strong>{formatUsdNoCents(claimed.claim)}</strong> owed by {gc?.name ?? 'the GC'}
          </div>
          <div style={{ fontSize: '1.15rem', lineHeight: 1.25 }} data-lien-approve-mail-by>
            {selected.earliestDeadline ? (
              <>
                Mail by <strong>{footShortDay(selected.earliestDeadline)}</strong>
                {selected.daysLeft != null && selected.daysLeft >= 0 ? ` · ${selected.daysLeft} ${selected.daysLeft === 1 ? 'day' : 'days'}` : selected.daysLeft != null ? ' · window closed' : ''}
              </>
            ) : (
              'No mail-by day yet'
            )}
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {item?.submitted_at ? `Sent to you ${footShortDay(item.submitted_at)}. ` : ''}
            {gateVerdict.ready ? 'All four gates clear.' : `${gateVerdict.headline}.`}
          </div>
          <LienStepRow at={{ ladder: 'notice', step: 3 }} ladder="notice" viewerIsLeader />
          <button type="button" data-lien-approve-details aria-expanded={detailsOpen} onClick={() => setDetailsOpen((v) => !v)} style={{ ...linkBtn, justifySelf: 'start', fontSize: '0.875rem', fontWeight: 600, padding: '4px 0' }}>
            {detailsOpen ? 'Hide details ▴' : 'Details ▾'}
          </button>
        </div>
      ) : null}
      {paneHead('path')}
      <div data-lien-pane-body="path" style={{ display: 'grid', gap: '0.6rem' }}>
      {timeline ? (
        <div data-lien-desk-timeline style={{ ...boxStyle, padding: isMobile ? '0.5rem 0.7rem' : '0.55rem 0.8rem 0.5rem' }}>
          <LienTimelineStrip timeline={timeline} switchOutside={!isMobile} onDoor={job && 'lien_contract_ended_on' in job ? () => onOpenEditJob(selected.jobId) : undefined} onOpenStep={(s) => setStopOpen(Math.max(0, timeline.steps.findIndex((x) => x.key === s.key)))} onAct={onBandAct} act={bandAct} />
        </div>
      ) : null}
      {timeline && stopOpen != null ? (
        <LienStopPaperWindow
          steps={timeline.steps}
          index={stopOpen}
          onIndex={setStopOpen}
          onClose={() => setStopOpen(null)}
          jobLabel={jobLabel(job, selected.jobId)}
          paperFor={stopPaperFor}
          timeline={timeline}
          holdFor={(step) => {
            // The hold line (v2.4806): the notice's first blocking gate, in the draft footer's own words, with its door.
            if (step.kind !== 'notice' || step.state === 'done' || step.state === 'missed' || step.fold) return null
            const blocker = gates.find((g) => g.tone === 'blocker') ?? null
            if (!blocker) return null
            return { words: lienFootBlockedSentence(blocker, months.size), short: lienGateShortWords(blocker), act: { label: `Go to gate ${blocker.n} ▴`, onPress: () => { setStopOpen(null); goToSection('gates') } } }
          }}
        />
      ) : null}

      {leader && selected.pile === 'awaiting' ? (
        <div style={boxStyle}>
          <div style={boxHead}>What you're deciding</div>
          {correction ? (
            <div style={{ fontSize: '0.8125rem', color: claimed.over ? 'var(--text-red-700)' : 'var(--text-amber-800)' }} data-lien-claim-leader-line>
              <strong>Claim set by hand: {formatUsdNoCents(claimed.claim)}</strong>
              {claimDeltaWords(claimed.delta, openBalance) ? `, ${claimDeltaWords(claimed.delta, openBalance)}` : ''} — {correctionSetWords(correction, formatYmdMonthDay)}.{correction.carry ? ' It carries to later notices and the affidavit.' : ' This notice only.'} The notice below carries it.
            </div>
          ) : null}
          {wordingDiff.length ? (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-amber-800)' }}>{wordingLineText(wordingDiff, wordingEditedBy)} from the job’s wording — the notice below carries it.</div>
          ) : null}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.25rem 1rem', fontSize: '0.8125rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Open with {gc?.name ?? 'this GC'}: </span>
              <strong>{formatUsdNoCents(gcOpenTotal)}</strong> on {entries.filter((e) => e.gcCustomerId === selected.gcCustomerId).length} {entries.filter((e) => e.gcCustomerId === selected.gcCustomerId).length === 1 ? 'job' : 'jobs'} in the desk
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Their word: </span>
              {promise ? (
                <span style={chip('var(--bg-subtle)', 'var(--text-green-800)')}>✓ promised {formatYmdMonthDay(promise.promisedYmd)}{promise.markedByName ? ` · ${promise.markedByName}` : ''}</span>
              ) : (
                'no promise on file'
              )}
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Months: </span>
              {monthsList.map(workMonthShort).join(' · ')}
              {wm ? ` — ${wm.totalHours.toLocaleString(undefined, { maximumFractionDigits: 1 })} h, ${new Set(wm.months.flatMap((m) => m.people)).size} people` : ''}
            </div>
            <div style={{ color: 'var(--text-red-600)' }}>
              If you hold: {monthsList[0] ? `${workMonthLabel(monthsList[0])}'s lien right ends ${selected.earliestDeadline ? demandDate(selected.earliestDeadline) : '—'}` : ''}
            </div>
          </div>
        </div>
      ) : null}

      {/* The gates (v2.3657): four numbered steps in fixed slots under a verdict headline. Every gate has its section (v2.3670): a gate that is not clear carries its sentence and its door, a clear one the fact the notice will use; a cell click brings its section up. */}
      </div>

      {paneHead('gates')}
      <div data-lien-pane-body="gates">
      {gatesFold ? (
        <LienGatesSentFold fold={gatesFold} />
      ) : (
      <LienDeskGates
        headless
        gates={gates}
        verdict={gateVerdict}
        active={activeGate?.key ?? null}
        activeAt={activeGate?.at ?? 0}
        onPick={pickGate}
        open={property.owner.source === 'property_record' && ownerFromRollUnconfirmed(address) ? ['owner'] : []}
        details={{
          owner: (
            <>
              {gateByKey.owner.tone !== 'ok' && gateByKey.owner.value !== 'Public property' ? (
                <div>
                  Owner of record with a mailing address{ownerName ? ` — ${ownerName}, mailing address missing` : ''} — the statute sends the notice to the owner, so this comes first.
                </div>
              ) : null}
              {gateByKey.owner.tone === 'ok'
                ? (() => {
                    // The owner on file as the envelope will read (the roll's shape, v2.3658), where it came from, and the doors to check or change it.
                    const mailing = rollMailingLines(property.owner.mailingAddress)
                    const county = (address?.county ?? '').trim()
                    const cadUrl = property.owner.source === 'property_record' ? txCountyCadPropertyUrl(county, (address?.parcel_id ?? '').trim()) || txCountyCadSearchUrl(county) : ''
                    return (
                      <>
                        <div className="lienGateFact" data-lien-gate-owner-fact>
                          <strong className="lienGateFactValue">{ownerName}</strong>
                          <span className="lienGateFactActions">
                            {cadUrl ? (
                              <button type="button" style={linkBtn} onClick={() => openInExternalBrowser(cadUrl)} title={`Check this owner on the ${county || 'county'} appraisal district site`}>
                                Check on {county || 'the county'} CAD ↗
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => onOpenEditJob(selected.jobId, property.owner.source === 'property_record' ? 'property-record' : undefined)}
                              style={{ ...btn('plain'), padding: '1px 8px', fontSize: '0.72rem' }}
                              title={property.owner.source === 'property_record' ? 'Edit Job → Property record: the owner of record lives on the property' : 'Edit Job: the owner set on this job'}
                            >
                              Change ›
                            </button>
                          </span>
                        </div>
                        <address className="lienOwnerRollAddress" style={{ fontStyle: 'normal' }}>{[mailing.careOf ? `c/o ${mailing.careOf}` : '', ...mailing.lines].filter(Boolean).join(', ')}</address>
                        {ownerSourceWords(property.owner.source) ? <div className="lienGateRowMeta">{ownerSourceWords(property.owner.source)}</div> : null}
                      </>
                    )
                  })()
                : null}
              {/* The roll's answer with Use, the Confirm on an unconfirmed nightly save, or the bond-claim sentence (v2.3450); renders nothing when the owner is fine. */}
              <LienDeskOwnerPane
                key={selected.jobId}
                job={job}
                jobId={selected.jobId}
                gcName={gc?.name ?? ''}
                gcCustomerId={selected.gcCustomerId}
                address={address}
                owner={property.owner}
                ownerName={ownerName}
                userId={authUserId}
                onChanged={onChanged}
                onOpenEditJob={onOpenEditJob}
              />
            </>
          ),
          gc:
            gateByKey.gc.tone !== 'ok' ? (
              <div className="lienGateFact">
                <span>The notice names the original contractor — set the GC on the job.</span>
                <span className="lienGateFactActions">
                  <button type="button" onClick={() => onOpenEditJob(selected.jobId)} style={{ ...btn('plain'), padding: '1px 8px', fontSize: '0.72rem' }}>
                    Set the GC ›
                  </button>
                </span>
              </div>
            ) : (
              // The GC as the notice names them, with the address the certified copy goes to.
              <>
                <div className="lienGateFact" data-lien-gate-gc-fact>
                  <strong className="lienGateFactValue">{gc?.name}</strong>
                  <span className="lienGateFactActions">
                    <button type="button" onClick={() => onOpenEditJob(selected.jobId)} style={{ ...btn('plain'), padding: '1px 8px', fontSize: '0.72rem' }} title="Edit Job: the GC on the job">
                      Change the GC ›
                    </button>
                  </span>
                </div>
                {gc?.address ? <div className="lienGateRowMeta">{gc.address}</div> : <div className="lienGateRowMeta" style={{ color: 'var(--text-amber-800)' }}>No mailing address on the customer.</div>}
              </>
            ),
          kind: (
            // The kind as the switch the claims row and Edit Job use (v2.3667), set right here; without a linked property there is nothing to write on, so the door stays.
            (() => {
              const kindSet = Boolean((property.propertyKind ?? '').trim())
              const chooser = address && (kindOpen || !kindSet)
              const shared = data && address ? jobsSharingProperty(selected.jobId, Object.keys(data.jobsById), (id) => data.jobsById[id]?.customer_address_id) : []
              const sharedWords = sharedWithWords(shared.map((id) => effectiveJobLedgerNumber(data?.jobsById[id]?.hcp_number ?? null, data?.jobsById[id]?.click_number ?? null) || id.slice(0, 8)))
              return (
                <>
                  <div className="lienGateFact" data-lien-gate-kind-fact data-kind-open={chooser ? 'yes' : 'no'}>
                    <strong className="lienGateFactValue">{kindBusy ? 'saving…' : propertyKindLine(property.propertyKind, property.county)}</strong>
                    <span className="lienGateFactActions">
                      {!address ? (
                        <button type="button" onClick={() => onOpenEditJob(selected.jobId, 'property-record')} style={{ ...btn('plain'), padding: '1px 8px', fontSize: '0.72rem' }} title="Edit Job → Property record: link the property, then say whether it is residential or commercial">
                          Set property kind ›
                        </button>
                      ) : chooser ? (
                        kindSet ? (
                          <button type="button" onClick={() => setKindOpen(false)} style={linkBtn} data-lien-gate-kind-cancel>
                            Cancel
                          </button>
                        ) : null
                      ) : (
                        <button type="button" onClick={() => setKindOpen(true)} style={{ ...btn('plain'), padding: '1px 8px', fontSize: '0.72rem' }} data-lien-gate-kind-change title="Switch the property kind: two clicks on purpose, since every deadline on the job moves with it">
                          Change ›
                        </button>
                      )}
                    </span>
                  </div>
                  {chooser ? (
                    <div className="lienGateFact" data-lien-gate-kind-chooser>
                      <PropertyKindSwitch value={normalizePropertyKind(property.propertyKind)} onPick={(k) => { setKindOpen(false); void pickKind(k) }} disabled={kindBusy} label={`Property kind for ${jobLabel(job, selected.jobId)}`} />
                      <span className="lienGateRowMeta" style={{ flex: '1 1 16rem', minWidth: 0 }}>{propertyKindSwitchWarning(property.propertyKind)}</span>
                    </div>
                  ) : null}
                  <div className="lienGateRowMeta">{[propertyKindRuleWords(property.propertyKind), address ? 'saved on the property record' : '', sharedWords].filter(Boolean).join(' · ')}.</div>
                </>
              )
            })()
          ),
          months: (
            <>
              {gateByKey.months.tone !== 'ok' ? (
                <div className="lienGateFact">
                  <span>{gateByKey.months.value === 'No month open' ? 'No month is open to notice — every window has closed. The notice that went out is in the grid below.' : 'Tick at least one month below — the notice has to name the work it covers.'}</span>
                  <span className="lienGateFactActions">
                    <button type="button" style={linkBtn} onClick={() => paneRef.current?.querySelector('[data-lien-desk-months]')?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })}>
                      Months and deadlines ↓
                    </button>
                  </span>
                </div>
              ) : (
                // One line per work month with approved hours — the cell's list — from the same evidence as the Months card; the ticked ones say so.
                <div className="lienGateFact" data-lien-gate-months-fact>
                  <span style={{ display: 'grid', minWidth: 0 }}>
                    {monthCards.map((c) => (
                      <span key={c.key}>
                        {lienGateMonthLine(workMonthLabel(c.key), c.hours, c.crew)}
                        {c.on ? <span className="lienGateRowMeta"> · on this notice</span> : null}
                      </span>
                    ))}
                  </span>
                  <span className="lienGateFactActions">
                    <button type="button" style={linkBtn} onClick={() => paneRef.current?.querySelector('[data-lien-desk-months]')?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })}>
                      Months and deadlines ↓
                    </button>
                  </span>
                </div>
              )}
              {wm && wm.pendingSessions > 0 ? (
                <div className="lienGateRowMeta">
                  {wm.pendingSessions} {wm.pendingSessions === 1 ? 'session' : 'sessions'} awaiting approval not counted in the hours.
                </div>
              ) : null}
            </>
          ),
          // The fifth gate (v2.4969), drawn only while it blocks: nothing owed on the sent bills, money still on the job.
          billed: (
            <div className="lienGateFact" data-lien-gate-billed-fact>
              <span style={{ minWidth: 0 }}>{lienNothingBilledWords(claimBills.length)}</span>
              <span className="lienGateFactActions">
                {office ? (
                  <button type="button" style={linkBtn} disabled={Boolean(billWhy)} title={billWhy || undefined} onClick={billFromHere} data-lien-gate-bill-from-here>
                    Bill it from here ›
                  </button>
                ) : null}
                <button type="button" style={linkBtn} onClick={() => paneRef.current?.querySelector('[data-lien-claim-bills]')?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })}>
                  The bills ↓
                </button>
              </span>
            </div>
          ),
        }}
      />
      )}
      </div>

      {/* Supply houses on this job (v2.4404): a second claim can ride the same property. Not drawn when the job bought nothing. */}
      {supplierJob ? (
        <>
        {paneHead('houses')}
        <div data-lien-pane-body="houses">
        <LienJobSuppliersCard headless job={supplierJob} propertyKind={property.propertyKind ?? ''} todayYmd={todayYmd} openBalance={openBalance} payerName={gc?.name ?? ''} jobLabel={jobLabel(job, selected.jobId)} isMobile={isMobile} word={office ? { authName, onChanged: suppliers.reload } : undefined} />
        </div>
        </>
      ) : null}

      {paneHead('months')}
      <div data-lien-pane-body="months" style={{ display: 'grid', gap: '0.6rem' }}>
      {/* A carried correction nobody has looked at since the last notice (v2.3682): the paper says so and asks before it goes. */}
      {correction && correctionNeedsLook(correction, lastSentAt) ? (
        <div data-lien-claim-carry-strip style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.3rem 0.8rem', padding: '0.5rem 0.75rem', borderRadius: 9, border: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)', fontSize: '0.8125rem' }}>
          <span style={{ color: 'var(--text-amber-800)', minWidth: 0, flex: '1 1 20rem' }}>
            <strong>Carrying {correction.setByName || 'the office'}’s correction{correction.setAt ? ` from ${formatYmdMonthDay(calendarYmdInAppTzFromIso(correction.setAt))}` : ''}:</strong> {formatUsdNoCents(correction.amountOff)} {correction.amountOff < 0 ? 'on top' : 'off'} — “{correction.reason}”. This notice claims <strong>{formatUsdNoCents(claimed.claim)}</strong>, not the app’s {formatUsdNoCents(openBalance)}.
          </span>
          {office ? (
            <>
              <button type="button" disabled={busy} style={btn('plain', busy)} onClick={() => void run('Still true', async () => lookLienClaimCorrection(selected.jobId, authName), 'Noted — the correction stands for this notice.')} data-lien-claim-still-true>
                Still true
              </button>
              <button type="button" disabled={busy} style={btn('plain', busy)} onClick={() => void run('Clear the correction', async () => clearLienClaimCorrection(selected.jobId), 'Cleared — the notice claims the job’s figure.')}>
                Clear it
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {/* Months (#38): the grid — months down, papers across, this notice as the last column. */}
      <LienDeskMonths
        headless
        grid={monthGrid!}
        lastWork={<LienLastWorkDayLine jobId={selected.jobId} job={job ?? null} todayYmd={todayYmd} canEdit={office} userId={authUserId} onSaved={() => (onCalendarChanged ? onCalendarChanged('last_work') : onChanged())} jobLabel={`${job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '' : ''} · ${(job?.job_name ?? '').trim()}`} clockMonths={selected.months.filter((m) => !m.fromCreation && !m.byHand).map((m) => m.key)} noticedMonths={selected.months.filter((m) => m.noticed).map((m) => m.key)} affidavitMonths={lienLastWorkAffidavitMonths(data?.affidavits.entries.find((a) => a.jobId === selected.jobId))} propertyKind={selected.propertyKind} />}
        claimNode={
          <LienClaimBox
            openSignal={claimOpenSignal}
            balance={openBalance}
            correction={correction}
            months={monthsList}
            office={office}
            busy={busy}
            onSave={(input) => void run('Correct the claim', async () => saveLienClaimCorrection({ jobId: selected.jobId, ...input, userId: authUserId, userName: authName }).then(touchDraft), input.amountOff > 0 ? 'The notice claims the corrected figure.' : input.amountOff < 0 ? 'Set over the balance — the leader decides this one.' : 'The notice claims the job’s figure.')}
            onClear={() => void run('Back to the job’s figure', async () => clearLienClaimCorrection(selected.jobId).then(touchDraft), 'Cleared — the notice claims the job’s figure.')}
          />
        }
        claimTail={
          // Retainage inside the claim (v2.3753, counsel): named on the form so the owner traps it now; the figure lives on the job.
          retainageInsideClaim(claimed.claim, job?.lien_retainage_held) > 0 ? (
            <span data-lien-claim-retainage="yes">
              Includes <strong style={{ color: 'var(--text-700)' }}>{formatUsdNoCents(retainageInsideClaim(claimed.claim, job?.lien_retainage_held))}</strong> unpaid retainage {gc?.name ?? 'the GC'} holds — named on the form.
              {office ? <button type="button" onClick={() => onOpenEditJob(selected.jobId, 'lien-contract')} style={{ border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.72rem', fontWeight: 600, padding: '0 0 0 4px' }}>Change ›</button> : null}
            </span>
          ) : job?.lien_retainage_held == null && office ? (
            <span data-lien-claim-retainage="unset">
              Retainage {gc?.name ?? 'the GC'} holds: not recorded.
              <button type="button" onClick={() => onOpenEditJob(selected.jobId, 'lien-contract')} style={{ border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.72rem', fontWeight: 600, padding: '0 0 0 4px' }}>Set on the job ›</button>
            </span>
          ) : null
        }
        bills={<LienClaimBills bills={claimBills} unbilled={unbilled} revenue={job?.revenue} loading={payPage.loading} onBill={office ? billFromHere : undefined} billWhy={billWhy} />}
        onNoteMissed={office ? (month) => void noteMissed([month]) : undefined}
        onRecordByHand={office ? () => setByHandOpen(true) : undefined}
        claim={formatUsdNoCents(claimed.claim)}
        onToggle={(key, on) => {
          const next = new Set(months)
          if (on) next.add(key)
          else next.delete(key)
          setCheckedMonths(next)
          touchDraft()
        }}
      />
      </div>

      {paneHead('envelope')}
      <div data-lien-pane-body="envelope" style={{ display: 'grid', gap: '0.6rem' }}>
      {/* The envelope as one card (v2.7427): who the paper goes to, what rides with the notice, the key to the shaded boxes and the preview door. */}
      <LienEnvelopeCard
        ownerName={ownerName || 'the owner of record'}
        contractorName={gc?.name || 'the original contractor'}
        courtesyEmail={gc?.email || null}
        cover={{
          checked: coverNote,
          disabled: item != null && item.status !== 'drafted',
          onChange: (on) => { setCoverNote(on); touchDraft() },
          title: `Counsel's cover letter for a ${coverLetterKindFor(property)} property (2026-09-22), filled for this job — the first page of the owner's copy; the GC's copy is the form only`,
        }}
        // The supply houses in the owner's letter (v2.4725, Taunya's ask): drawn only while the letter is on and a house is owed.
        houses={coverNote && supplierJob && supplierJob.owed > 0 ? { checked: housesInLetter, disabled: item != null && item.status !== 'drafted', onChange: setHousesInLetter, count: supplierJob.housesOwed, amount: formatUsdNoCents(supplierJob.owed), unread: housesInLetter && !LIEN_HOUSES_PARAGRAPH_READ_BY_COUNSEL } : null}
        // A conditional release of lien in the envelope (v2.4729, Stephen's addition): off until asked for; the tick makes the draft row, the run issues it.
        release={coverNote && selected && claimNumber > 0 ? { checked: releaseId != null, disabled: (item != null && item.status !== 'drafted') || busy, onChange: toggleRelease, amount: formatUsdNoCents(claimNumber), unread: releaseId != null && !LIEN_RELEASE_PARAGRAPH_READ_BY_COUNSEL } : null}
        lockedWords={wordingLocked ? (office ? 'Sent for approval — pull it back to a draft to change the wording.' : 'The values in a box were typed by the office; the rest is the statute’s form or filled from the job.') : null}
        onPreview={openPreview}
      />

      {/* What goes in the envelope (v2.3540): the cover page first while it is ticked, then the notice — the pages as the packet prints them. */}
      {coverHtml ? (
        <>
          {pageLabel('cover', `Page 1 of ${pageTotal} · cover letter`, null)}
          <div data-theme="light" data-lien-desk-cover style={paperStyle}>
            <div dangerouslySetInnerHTML={{ __html: coverHtml }} />
          </div>
        </>
      ) : null}
      {/* The conditional release (v2.4729): the § 53.284 form behind the letter, as the Release of Lien window would print it. */}
      {releaseHtml ? (
        <>
          {pageLabel('release', `Page ${coverHtml ? 2 : 1} of ${pageTotal} · conditional release`, { words: `· ${noticeRelease?.signature ? 'signed in the app' : 'the master signs it with the notice'} · change it in the Release of Lien window` })}
          <div data-theme="light" data-lien-desk-release style={paperStyle}>
            <div dangerouslySetInnerHTML={{ __html: releaseHtml }} />
          </div>
        </>
      ) : null}
      {pageLabel(
        'notice',
        `Page ${noticePageNumber} of ${pageTotal} · the notice`,
        { words: `· ${wordingDiff.length ? wordingLineText(wordingDiff, wordingEditedBy) : payHtml ? 'the pay codes and the invoice follow it in the packet' : "the job's unpaid invoice follows it in the packet"}`, amber: wordingDiff.length > 0 },
      )}
      <div data-theme="light" data-lien-desk-paper ref={paperRef} onClick={onPaperClick} style={{ ...paperStyle, position: 'relative' }}>
        <div dangerouslySetInnerHTML={{ __html: docHtml }} />
        {editing ? (
          <input
            ref={editInputRef}
            aria-label={LIEN_NOTICE_FIELD_GUIDE.find((g) => g.key === editing.key)?.label ?? editing.key}
            value={editing.value}
            onChange={(ev) => setEditing((e) => (e ? { ...e, value: ev.target.value } : e))}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter') {
                ev.preventDefault()
                commitEdit()
              } else if (ev.key === 'Escape') {
                ev.preventDefault()
                setEditing(null)
              }
            }}
            onBlur={commitEdit}
            placeholder={LIEN_NOTICE_FIELD_GUIDE.find((g) => g.key === editing.key)?.source}
            data-lien-desk-paper-input
            style={{ position: 'absolute', top: editing.rect.top, left: editing.rect.left, width: Math.max(editing.rect.width, 160), minHeight: editing.rect.height, boxSizing: 'border-box', font: editing.font || 'inherit', fontWeight: 600, color: 'var(--text-strong)', padding: '0.1em 0.5em', border: '2px solid #d97706', borderRadius: 5, background: 'var(--bg-amber-tint)', outline: 'none', zIndex: 3 }}
          />
        ) : null}
      </div>
      {/* The signing record (v2.7437, Taunya's ask): the paper prints the day alone, so the desk keeps the clock, the way and whose screen here, under the paper and outside it. */}
      {paneSignature ? (
        <p data-lien-desk-signature-record style={{ margin: '-0.2rem 0 0', fontSize: '0.72rem', lineHeight: 1.5, color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--text-700)' }}>The signing record, kept here and not printed.</strong> {paneSignature.auditLine}
        </p>
      ) : null}

      {/* The pay page (punch list #35, PR 3): one code per unpaid Stripe bill, as the run prints it behind the owner's copy. Nothing on it is typed — it is filled from the bills. */}
      {payHtml ? (
        <>
          {pageLabel('pay', `Page ${pageTotal} of ${pageTotal} · pay codes`, { words: `· ${payPageSummary(payPage.rows)} · ${payChangedCount ? `${payChangedCount} ${payChangedCount === 1 ? 'line' : 'lines'} changed on this page, the bills keep their own` : wordingLocked ? 'the lines under the codes are read from the bills' : 'a shaded line is yours to change, on this page only'}`, amber: payChangedCount > 0, pay: true })}
          <div data-theme="light" data-lien-desk-pay ref={payPaperRef} onClick={onPayPaperClick} style={{ ...paperStyle, position: 'relative' }}>
            <div dangerouslySetInnerHTML={{ __html: payHtml }} />
            {payEditing ? (
              <input
                ref={payInputRef}
                aria-label="The line under this bill's code"
                value={payEditing.value}
                onChange={(ev) => setPayEditing((e) => (e ? { ...e, value: ev.target.value } : e))}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter') {
                    ev.preventDefault()
                    commitPayEdit()
                  } else if (ev.key === 'Escape') {
                    ev.preventDefault()
                    ev.stopPropagation()
                    setPayEditing(null)
                  }
                }}
                onBlur={commitPayEdit}
                placeholder="Empty prints no line"
                data-lien-desk-pay-input
                style={{ position: 'absolute', top: payEditing.rect.top, left: payEditing.rect.left, width: Math.max(payEditing.rect.width, 260), minHeight: payEditing.rect.height, boxSizing: 'border-box', font: payEditing.font || 'inherit', fontWeight: 700, color: 'var(--text-strong)', padding: '0.1em 0.5em', border: '2px solid #d97706', borderRadius: 5, background: 'var(--bg-amber-tint)', outline: 'none', zIndex: 3 }}
              />
            ) : null}
          </div>
        </>
      ) : null}

      {leader && (selected.pile === 'awaiting' || selected.pile === 'held' || selected.pile === 'to_draft') && selected.gcCustomerId ? (
        <div style={boxStyle}>
          <div style={boxHead}>Standing rule for {gc?.name ?? 'this GC'}</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8125rem' }}>
            {LIEN_NOTICE_POLICIES.map((p) => (
              <label key={p.key} title={p.hint} style={{ display: 'inline-flex', gap: 5, alignItems: 'center', padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 6, background: (rulePick ?? selected.policy) === p.key ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)' }}>
                <input type="radio" name="lien-rule" checked={(rulePick ?? selected.policy) === p.key} onChange={() => { setRulePick(p.key); void saveRule(p.key) }} />
                {p.label}
              </label>
            ))}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>A rule sets the default for every future month on every {gc?.name ?? 'GC'} job. You still see each send in your FYI list, and a live promise always comes back to you.{gcHasPriorNotice ? '' : ' “Send” starts with the second notice — this first one comes to you either way, so the office proves the addresses on real mail first.'}</div>
        </div>
      ) : null}
      </div>
      {/* The footer's section (v2.7422): the blue head, then the empty body the footer is portalled into once it is built. */}
      {footInPane ? paneHead('sign') : null}
      {footInPane ? <div ref={setNoticeFootHome} className="lienDeskFooterInPane" data-lien-pane-body="sign" data-lien-desk-foot-home /> : null}
      {/* The pane's foot room (v2.4747): a row, not the pane's bottom padding, so a section head stuck to the bottom sits on the edge with no gap under it. */}
      <div aria-hidden data-lien-desk-pane-foot style={{ height: '0.3rem' }} />
    </div>
  ) : (
    <div style={{ padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{isMobile ? '' : 'Pick a job on the left.'}</div>
  )

  // ---------- affidavits: the list and the pane (v2.3412) ----------
  // The pile chips of Affidavits and Retainage. A pile with nothing in it draws no chip unless it is the one picked.
  const pileChip = (key: string, label: string, n: number, on: boolean, onPress: () => void) => (
    <button key={key} type="button" aria-pressed={on} onClick={onPress} style={{ padding: '2px 10px', borderRadius: 999, border: `1px solid ${on ? 'var(--bg-blue-tint)' : 'var(--border-strong)'}`, background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', color: on ? 'var(--text-blue-800)' : 'var(--text-700)', fontSize: '0.78rem', fontWeight: on ? 600 : 500, cursor: 'pointer', ...(isMobile ? PHONE_CHIP : null) }}>
      {label} · <strong>{n}</strong>
    </button>
  )
  const affPileChips = LIEN_AFFIDAVIT_PILES.flatMap((p) => {
    const n = data?.affidavits.counts[p.key] ?? 0
    if (n === 0 && affPile !== p.key) return []
    // A pile chip lifts the print bar's held-only list (v2.7209), and reads unpressed while that list is up.
    const on = affPile === p.key && !affHeldOnly
    return [pileChip(p.key, p.label, n, on, () => { setAffHeldOnlyPicked(false); setAffPile(on ? null : p.key) })]
  })
  const retPileChips = LIEN_RETAINAGE_PILES.flatMap((p) => {
    const n = data?.retainage.counts[p.key] ?? 0
    if (n === 0 && retPile !== p.key) return []
    const on = retPile === p.key
    return [pileChip(p.key, p.label, n, on, () => setRetPile(on ? null : p.key))]
  })
  // On a phone the chips are one strip that slides sideways, the first thing in the list's own scroller.
  const pileStrip = (chips: ReactNode[]) => (isMobile && chips.length > 0 ? <div data-lien-desk-piles style={{ display: 'flex', gap: 8, padding: '8px 12px', overflowX: 'auto', borderBottom: '1px solid var(--border)' }}>{chips}</div> : null)

  // Every pile with rows gets a stacked title, as the Notices list draws them (the owner's ask of 2026-11-15); the held-only list keeps the title's count to the rows it shows.
  const affPilesShown = LIEN_AFFIDAVIT_PILES.map((p) => ({ p: p.key, label: p.label, rows: affVisible.filter((e) => e.pile === p.key), total: affVisibleAll.filter((e) => e.pile === p.key).length })).filter((x) => (finding ? x.total > 0 : x.rows.length > 0))
  const affHeads = useLienPileHeads(affPilesShown.map((x) => x.p), isMobile)
  const affList = (
    <div ref={affHeads.listRef} onScroll={affHeads.onScroll} data-lien-affidavit-list style={{ position: 'relative', borderRight: isMobile ? 'none' : '1px solid var(--border)', overflow: 'auto', minWidth: 0 }}>
      {pileStrip(affPileChips)}
      {affVisible.length === 0 ? (
        loading || data == null ? (
          <p style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Looking at every unpaid job…</p>
        ) : (
          // Empty words (punch list #184, sweep C): a find clears, a pile lifts back to the list, and nothing close points at By date.
          <div data-lien-affidavit-empty={finding ? 'find' : affPile ?? 'list'} style={{ fontSize: '0.8125rem' }}>
            <EmptyState compact {...(finding ? lienListFindEmptyWords(find, () => setFind('')) : affPile ? lienPileEmptyWords(() => setAffPile(null)) : lienAffidavitsEmptyWords(() => setKind('calendar')))} />
          </div>
        )
      ) : null}
      {office && (redrawPlan.ready.length > 0 || redrawFailed.length > 0) ? (
        <div data-lien-affidavit-redraw style={{ padding: '0.6rem 0.9rem', borderBottom: '1px solid var(--border)', display: 'grid', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {redrawPlan.ready.length > 0 ? (
            <>
              <span>{redrawPlan.ready.length === 1 ? '1 ready affidavit is on the earlier form.' : `${redrawPlan.ready.length} ready affidavits are on the earlier form.`}</span>
              <button type="button" onClick={() => void redrawReady()} disabled={redrawBusy} style={{ ...btn('plain', redrawBusy), justifySelf: 'start' }}>
                {redrawBusy ? 'Redrawing…' : redrawWords.button}
              </button>
              {redrawWords.foot ? <span data-lien-affidavit-redraw-foot>{redrawWords.foot}</span> : null}
            </>
          ) : null}
          {redrawFailed.length > 0 ? (
            <div data-lien-affidavit-redraw-failed style={{ display: 'grid', gap: '0.2rem', color: 'var(--text-red-600)' }}>
              <strong>{lienAffidavitRedrawOutcome(0, redrawFailed.length).head}</strong>
              {redrawFailed.map((f) => (
                <span key={f.jobId}>
                  <button type="button" onClick={() => { setAffSelectedJobId(f.jobId); setMobileListShown(false) }} style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', fontWeight: 700, color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>
                    {jobLabel(data?.jobsById[f.jobId], f.jobId)}
                  </button>
                  {' · '}
                  {f.reason}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {office && (affSendPlan.ready.length > 0 || affSendFailed.length > 0) ? (
        <div data-lien-affidavit-send-all style={{ padding: '0.6rem 0.9rem', borderBottom: '1px solid var(--border)', display: 'grid', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {affSendPlan.ready.length > 0 ? (
            <>
              <span>{affSendWords.lead}</span>
              <button type="button" onClick={() => void sendDraftedAffidavits()} disabled={affSendBusy} style={{ ...btn('plain', affSendBusy), justifySelf: 'start' }}>
                {affSendBusy ? 'Sending…' : affSendWords.button}
              </button>
              {affSendWords.foot ? <span data-lien-affidavit-send-all-foot>{affSendWords.foot}</span> : null}
              {affSendWords.hidden ? <span data-lien-affidavit-send-all-hidden>{affSendWords.hidden}</span> : null}
            </>
          ) : null}
          {affSendFailed.length > 0 ? (
            <div data-lien-affidavit-send-all-failed style={{ display: 'grid', gap: '0.2rem', color: 'var(--text-red-600)' }}>
              <strong>{lienAffidavitSendOutcome(0, affSendFailed.length).head}</strong>
              {affSendFailed.map((f) => (
                <span key={f.jobId}>
                  <button type="button" onClick={() => { setAffSelectedJobId(f.jobId); setMobileListShown(false) }} style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', fontWeight: 700, color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>
                    {jobLabel(data?.jobsById[f.jobId], f.jobId)}
                  </button>
                  {' · '}
                  {f.reason}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {office && affPrintPlan.ready.length > 0 ? (
        <div data-lien-affidavit-print-all style={{ padding: '0.6rem 0.9rem', borderBottom: '1px solid var(--border)', display: 'grid', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {/* The status line (v2.7209): what this press prints, and beside it the one warning as a press. On a phone the press sits under the words. */}
          <div data-lien-affidavit-print-status style={{ display: 'flex', flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: '0.35rem 0.6rem' }}>
            <span data-lien-affidavit-print-ready title={affPrintStatus.readyTip} style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-strong)' }}>{affPrintStatus.ready}</span>
            {affPrintStatus.held ? (
              <button
                type="button"
                data-lien-affidavit-print-held
                aria-pressed={affHeldOnly}
                title={affPrintStatus.held.tip}
                onClick={() => showHeldAffidavits(!affHeldOnly)}
                style={{ padding: '2px 10px', borderRadius: 999, border: `1px solid ${affHeldOnly ? 'var(--text-amber-800)' : 'var(--border-amber)'}`, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', font: 'inherit', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
              >
                {affPrintStatus.held.press} <span aria-hidden>›</span>
              </button>
            ) : null}
          </div>
          {/* On a phone one bar folds the rest of the box away (punch list #352, the leftovers): the count and the held papers stay, and the print press, the chips and the county stay mounted under the bar, so a tick or a typed county is kept (`index.css`). */}
          {isMobile ? (() => {
            const fold = lienPhonePrintBoxFold(affPrintFolded)
            return (
              <button type="button" data-lien-affidavit-print-fold aria-expanded={fold.expanded} onClick={() => setAffPrintFolded((v) => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', minHeight: 44, padding: '0 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
                <span>{fold.words}</span>
                <span aria-hidden="true">{fold.mark}</span>
              </button>
            )
          })() : null}
          <button type="button" onClick={printReadyAffidavits} style={{ ...btn('plain'), justifySelf: 'start' }}>
            {affPrintWords.button}
          </button>
          {/* What prints in front of the stack, as three ticked chips under one label (v2.7209). Each is still a tick box, kept on this computer: the help sheet (punch list #314) and the notice records (punch list #322) are on until the office turns them off, and the copies of the notices are off until someone ticks them. */}
          <div role="group" aria-labelledby="lien-affidavit-print-with" data-lien-affidavit-print-with style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem 0.4rem' }}>
            <span id="lien-affidavit-print-with" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginRight: '0.1rem' }}>{LIEN_PRINT_WITH_LABEL}</span>
            {lienPrintWithChips(affNoticeCopyCount).map((c) => {
              const [on, set, hook] =
                c.key === 'help_sheet'
                  ? ([affHelpSheet, setAffHelpSheet, { 'data-lien-affidavit-help-sheet': true }] as const)
                  : c.key === 'notice_record'
                    ? ([affNoticeRecord, setAffNoticeRecord, { 'data-lien-affidavit-notice-record': true }] as const)
                    : ([affNoticeCopies, setAffNoticeCopies, { 'data-lien-affidavit-notice-copies': true }] as const)
              return (
                <label key={c.key} {...hook} style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center', padding: '2px 9px 2px 6px', borderRadius: 999, border: `1px solid ${on ? 'var(--bg-blue-tint)' : 'var(--border-strong)'}`, background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', color: on ? 'var(--text-blue-800)' : 'var(--text-700)', fontSize: '0.75rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} style={{ margin: 0 }} />
                  {c.label}
                </label>
              )
            })}
          </div>
          <LienSigningCountyBox id="lien-affidavit-signing-county" county={affSigning.county} onChange={affSigning.setCounty} />
          <LienAffidavitSheetFlags papers={affSheetPapers} labelFor={(jobId) => jobLabel(data?.jobsById[jobId], jobId)} onOpen={(jobId) => { setAffSelectedJobId(jobId); setMobileListShown(false) }} />
          {affPrintWords.foot ? <span data-lien-affidavit-print-all-foot>{affPrintWords.foot}</span> : null}
          {affPrintWords.hidden ? <span data-lien-affidavit-print-all-hidden>{affPrintWords.hidden}</span> : null}
        </div>
      ) : null}
      {/* The list narrowed to the held papers (v2.7209): how many, that each row says why, and the way back. */}
      {affHeldOnly && affPrintStatus.held ? (
        <div ref={affHeldStrip} data-lien-affidavit-held-only style={{ padding: '0.45rem 0.9rem', borderBottom: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem 0.6rem', fontSize: '0.78rem' }}>
          <span>{affPrintStatus.held.showing}</span>
          <button type="button" onClick={() => showHeldAffidavits(false)} style={{ ...btn('plain'), padding: '2px 10px', fontSize: '0.78rem' }}>
            {affPrintStatus.held.back}
          </button>
        </div>
      ) : null}
      {affPilesShown.map(({ p, label, rows, total }, i) => (
          <Fragment key={p}>
            <LienPileHead pile={p} label={label} count={lienPileHeadCount(rows.length, total, affHeldOnly ? undefined : data?.affidavits.counts[p], finding)} i={i} n={affPilesShown.length} phone={isMobile} on={affHeads.lit === p} empty={finding && rows.length === 0} onPress={() => affHeads.scrollToPile(p, i)} onShowEvery={affPile && !affHeldOnly ? () => setAffPile(null) : null} />
            <div data-lien-pile-rows={p}>
            {rows.map((e) => {
              const g = e.gcCustomerId ? data?.gcsById[e.gcCustomerId] : undefined
              const sel = e.jobId === affSelected?.jobId
              const missing = e.gates.filter((x) => !x.ok).map((x) => affidavitGateMissingWord(x.key))
              // The pane's five gates as marks on the chip line (v2.7335): in the two early piles, after *last work*; the words stay where the strip is not drawn and on a phone, which has no hover.
              const gateParts = lienGateRowParts(e.pile, isMobile)
              return (
                <button
                  key={e.jobId}
                  type="button"
                  onClick={() => {
                    setAffSelectedJobId(e.jobId)
                    setMobileListShown(false)
                  }}
                  aria-current={sel ? 'true' : undefined}
                  style={{ display: 'grid', gridTemplateColumns: '8px 1fr auto', gap: '0.2rem 0.6rem', width: '100%', textAlign: 'left', padding: '0.5rem 0.9rem', border: 'none', borderTop: '1px solid var(--border)', background: sel ? 'var(--bg-blue-tint)' : 'transparent', cursor: 'pointer', font: 'inherit', color: 'inherit', fontSize: '0.8125rem' }}
                >
                  <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 6, background: e.severity === 'red' ? 'var(--text-red-600)' : e.severity === 'amber' ? 'var(--text-amber-800)' : 'var(--border-strong)' }} />
                  <span style={{ minWidth: 0 }}>
                    {listLabel(e.jobId, 'affidavit', false)}
                    <span style={{ color: 'var(--text-muted)' }}> · {e.isSub ? `GC ${g?.name ?? ''}` : 'with the owner'}</span>
                  </span>
                  <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatUsdNoCents(e.openBalance)}</span>
                  <span style={{ gridColumn: '2 / 4', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    <span style={chip(severityColors(e.severity).bg, severityColors(e.severity).fg)}>{affidavitDeadlineWords(e)}</span>
                    {(() => {
                      // Counsel's piles (v2.3767): from the owner's answers on the sent notice.
                      const pile = affidavitPileFor(data?.ownerCallByJob[e.jobId])
                      if (!pile) return null
                      const tone = pile === 'A' ? chip('var(--bg-green-tint)', 'var(--text-green-800)') : pile === 'B' ? chip('var(--bg-amber-tint)', 'var(--text-amber-800)') : chip('var(--bg-red-tint)', 'var(--text-red-600)')
                      return <span style={tone} data-lien-affidavit-pile={pile}>{pile} · {AFFIDAVIT_PILE_WORDS[pile].short}</span>
                    })()}
                    <span>last work {workMonthShort(e.lastMonth)}</span>
                    {gateParts.strip ? <LienGateMarkStrip marks={lienGateMarks(e.gates, e.isSub)} /> : null}
                    {gateParts.words && missing.length ? <span>· missing {missing.join(', ')}</span> : null}
                    <LienSupplierMarkLine mark={supplierMarks.get(e.jobId)} />
                  </span>
                </button>
              )
            })}
            </div>
          </Fragment>
      ))}
    </div>
  )
  const affPane =
    affSelected && data ? (
      <LienDeskAffidavitPane
        key={affSelected.jobId}
        entry={affSelected}
        data={data}
        workMonths={workMonths?.[affSelected.jobId] ?? null}
        todayYmd={todayYmd}
        authRole={authRole}
        authUserId={authUserId}
        authName={authName}
        issuer={issuer}
        signerNameFor={signerNameFor}
        leaderNameFor={leaderNameFor}
        onChanged={onChanged}
        onOpenEditJob={onOpenEditJob}
        onFixProperty={office ? (jobId, focus) => setPaneFix({ jobId, focus }) : undefined}
        onFixContractor={office ? onOpenCustomerRecord : undefined}
        onOpenJob={onOpenJob}
        ownerCall={data.ownerCallByJob[affSelected.jobId] ?? null}
        bond={parsePaymentBond(data.jobsById[affSelected.jobId]?.lien_payment_bond)}
        onOpenLienContract={(jobId) => onOpenEditJob(jobId, 'lien-contract')}
        onOpenLienAffidavit={(jobId) => (onOpenLienAffidavit ?? onOpenLienInstruments)(jobId)}
        onOpenLegalDesk={onOpenLegalDesk}
        onShowNotices={(jobId) => {
          setKind('notice')
          setSelectedJobId(jobId)
        }}
        onShowRetainage={(jobId) => {
          setKind('retainage')
          setRetSelectedJobId(jobId)
        }}
        onOpenLastWork={office ? onOpenCalendarLastWork : undefined}
        footerEl={affFooterEl}
      />
    ) : (
      <div style={{ padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{isMobile ? '' : 'Pick a job on the left.'}</div>
    )

  // ---------- retainage: the list and the pane (v2.3753) ----------
  const retPilesShown = LIEN_RETAINAGE_PILES.map((p) => ({ p: p.key, label: p.label, rows: retVisible.filter((e) => e.pile === p.key), total: retVisibleAll.filter((e) => e.pile === p.key).length })).filter((x) => (finding ? x.total > 0 : x.rows.length > 0))
  const retHeads = useLienPileHeads(retPilesShown.map((x) => x.p), isMobile)
  const retList = (
    <div ref={retHeads.listRef} onScroll={retHeads.onScroll} style={{ position: 'relative', borderRight: isMobile ? 'none' : '1px solid var(--border)', overflow: 'auto', minWidth: 0 }} data-lien-retainage-list>
      {pileStrip(retPileChips)}
      {retVisible.length === 0 ? (
        !loading && data != null && (finding || retPile) ? (
          <div data-lien-retainage-empty={finding ? 'find' : retPile ?? 'list'} style={{ fontSize: '0.8125rem' }}>
            <EmptyState compact {...(finding ? lienListFindEmptyWords(find, () => setFind('')) : lienPileEmptyWords(() => setRetPile(null)))} />
          </div>
        ) : (
          <p style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            {loading || data == null ? 'Looking at every job with retainage…' : 'No job with a GC has retainage recorded. Edit Job → Our contract on this job is where it goes.'}
          </p>
        )
      ) : null}
      {retPilesShown.map(({ p, label, rows, total }, i) => (
          <Fragment key={p}>
            <LienPileHead pile={p} label={label} count={lienPileHeadCount(rows.length, total, data?.retainage.counts[p], finding)} i={i} n={retPilesShown.length} phone={isMobile} on={retHeads.lit === p} empty={finding && rows.length === 0} onPress={() => retHeads.scrollToPile(p, i)} onShowEvery={retPile ? () => setRetPile(null) : null} />
            <div data-lien-pile-rows={p}>
            {rows.map((e) => {
              const j = data?.jobsById[e.jobId]
              const g = e.gcCustomerId ? data?.gcsById[e.gcCustomerId] : undefined
              const sel = e.jobId === retSelected?.jobId
              return (
                <button
                  key={e.jobId}
                  type="button"
                  onClick={() => {
                    setRetSelectedJobId(e.jobId)
                    setMobileListShown(false)
                  }}
                  aria-current={sel ? 'true' : undefined}
                  style={{ display: 'grid', gridTemplateColumns: '8px 1fr auto', gap: '0.2rem 0.6rem', width: '100%', textAlign: 'left', padding: '0.5rem 0.9rem', border: 'none', borderTop: '1px solid var(--border)', background: sel ? 'var(--bg-blue-tint)' : 'transparent', cursor: 'pointer', font: 'inherit', color: 'inherit', fontSize: '0.8125rem' }}
                >
                  <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 6, background: e.severity === 'red' ? 'var(--text-red-600)' : e.severity === 'amber' ? 'var(--text-amber-800)' : 'var(--border-strong)' }} />
                  <span style={{ minWidth: 0 }}>
                    <strong>{jobLabel(j, e.jobId)}</strong>
                    <span style={{ color: 'var(--text-muted)' }}> · {g?.name ?? ''}</span>
                  </span>
                  <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatUsdNoCents(e.retainageHeld)}</span>
                  <span style={{ gridColumn: '2 / 4', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    <span style={chip(severityColors(e.severity).bg, severityColors(e.severity).fg)}>{retainageDeadlineWords(e, formatYmdMonthDay)}</span>
                    <span>{contractEndedWords(e.contractEndedHow, e.contractEndedOn, formatYmdMonthDay)}</span>
                    <span>· {e.inClaim ? 'in the § 53.056 claim' : 'not yet in a § 53.056 claim'}</span>
                    <LienSupplierMarkLine mark={supplierMarks.get(e.jobId)} />
                  </span>
                </button>
              )
            })}
            </div>
          </Fragment>
      ))}
    </div>
  )
  const retPane =
    retSelected && data ? (
      <LienDeskRetainagePane
        key={retSelected.jobId}
        entry={retSelected}
        data={data}
        todayYmd={todayYmd}
        authRole={authRole}
        authUserId={authUserId}
        authName={authName}
        issuer={issuer}
        signerNameFor={signerNameFor}
        leaderNameFor={leaderNameFor}
        signerPhoneFor={signerPhoneFor}
        onChanged={onChanged}
        onOpenEditJob={onOpenEditJob}
        onOpenJob={onOpenJob}
        onOpenRun={() => setRunOpen(true)}
        onShowNotices={(jobId) => {
          setKind('notice')
          setSelectedJobId(jobId)
        }}
        footerEl={retFooterEl}
      />
    ) : (
      <div style={{ padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{isMobile ? '' : 'Pick a job on the left.'}</div>
    )

  // Record a notice that already went out (#35 PR 2) — the desk passes its own claim and months; the pane writes one filing per covered job and the desk re-reads.
  // The pen pane (the pen train, PR 2) sits where the footer sits, like the by-hand pane: the one notice, its leader, the print day.
  // v2.7297: from the draft footer the pane binds to the draft just saved (`penDraft`) until the desk re-reads it, and the
  // record approves the notice on his word, since the office may not approve as the leader.
  const penItem = item ?? (penDraft ? { id: penDraft.id, fields: penDraft.fields, status: 'drafted' as const, printed_at: null } : null)
  const penApproves = penItem != null && (penItem.status === 'drafted' || penItem.status === 'awaiting_approval')
  const penPane =
    selected && penOpen && penItem ? (
      <LienPenSignaturePane
        leader={{ userId: job?.master_user_id ?? null, name: leaderName }}
        recorder={{ userId: authUserId, name: authName }}
        notices={[{ itemId: penItem.id, jobNumber: job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—' : '—', label: jobLabel(job, selected.jobId), amount: claimed.claim, fields: penItem.fields }]}
        printedYmd={(penItem as { printed_at?: string | null }).printed_at ? calendarYmdInAppTzFromIso((penItem as { printed_at?: string | null }).printed_at as string) : null}
        todayYmd={todayYmd}
        onClose={() => setPenOpen(false)}
        onRecorded={(recorded, words) => {
          setPenOpen(false)
          const first = recorded[0]
          if (penApproves && first) {
            void run(
              'Approve on the signed paper',
              () => sendLienDeskItemOnWord(first.itemId, penWordApproval({ how: first.how, dayWords: demandDate(calendarYmdInAppTzFromIso(first.signedAtIso)), recorderName: authName.trim() || null })),
              `${words} Approved on his signed paper. ${LIEN_RUN_NOW_TO_PRINT}`,
            )
            return
          }
          showToast(words)
          onChanged()
        }}
      />
    ) : null
  const byHandPane =
    selected && byHandOpen ? (
      <LienNoticeByHandPane
        job={{
          id: selected.jobId,
          label: jobLabel(job, selected.jobId),
          jobAddress: job?.job_address ?? null,
          customerAddressId: job?.customer_address_id ?? null,
          amount: claimed.claim,
          itemId: selected.item && selected.item.status !== 'sent' && selected.item.status !== 'missed' ? selected.item.id : null,
        }}
        fields={noticeFields}
        appClaim={claimed.claim}
        appClaimIsTimely={false}
        defaultMonths={monthsList}
        todayYmd={todayYmd}
        userId={authUserId}
        onClose={() => setByHandOpen(false)}
        onRecorded={() => {
          setByHandOpen(false)
          onChanged()
        }}
        // On a phone (v2.4446) the step is a sheet over the desk's card, as in the Lien window: in the footer its 120 px fields cut off their own values.
        layout={isMobile ? 'sheet' : 'box'}
        onCloseWindow={() => setByHandOpen(false)}
      />
    ) : null

  // ---------- footer by state / role ----------
  let footer: React.ReactNode = null
  if (selected) {
    const state = selected.pile
    const monthsWord = monthsList.length ? describeNoticeMonths(monthsList) : 'no months'
    // The pay offer (v2.4713): the leader's box above the footer, on a notice he can approve or has approved.
    const affidavitDueOn = timeline?.steps.find((st) => st.kind === 'affidavit')?.date || null
    const offerAmounts = payPage.rows.filter((r) => r.payable).map((r) => r.openAmount)
    const offerProblem = offer ? lienOfferDayProblem(offer.by, todayYmd, affidavitDueOn) : null
    // The notice's own signature line (v2.5082): his name waiting in cursive, or a pad; the press writes the mark and the record.
    const signLine = (compact = false, frame?: LienNoticeSignLineFrame) => (
      <LienNoticeSignLine key={`${selected.jobId}:${otherScreen ? 'other' : 'own'}`} ref={signRef} printedName={signerName} under={[noticeFields.contactPerson, noticeFields.claimantName]} signedLabel={`Signed ${demandDate(todayYmd)}`} codeSigner={codeSigner} codeProblem={codeProblem} disabled={busy} compact={compact} frame={frame} />
    )
    // The draft's line (v2.7324): his typed name needs no box, so the line is drawn only for the pad or his code, and
    // Sign another way ▾ in the footer is the way between them (the line's own toggle is off). Keyed by the way, so a
    // pick starts the line clean, as the toggle did.
    const draftSignLine = (frame?: LienNoticeSignLineFrame) => (
      <LienNoticeSignLine key={`${selected.jobId}:${otherScreen ? 'other' : 'own'}:${draftSignWay}`} ref={signRef} printedName={signerName} under={[noticeFields.contactPerson, noticeFields.claimantName]} signedLabel={`Signed ${demandDate(todayYmd)}`} codeSigner={codeSigner} codeProblem={codeProblem} disabled={busy} initialMode={draftSignWay} ownToggle={false} onModeChange={setSignWay} frame={frame} />
    )
    // v2.4745 (the owner's ask): the switch rides in the footer's bottom row; the details open above that row only while it is on.
    const offerBox = (onSave?: () => void, saved?: boolean) => (
      <LienOfferBox part="details" offer={offer} onChange={setOffer} todayYmd={todayYmd} affidavitDueOn={affidavitDueOn} amounts={offerAmounts} disabled={busy} onSave={onSave} saving={busy} saved={saved} />
    )
    const offerSwitch = () => (
      <LienOfferBox part="switch" compact offer={offer} onChange={setOffer} todayYmd={todayYmd} affidavitDueOn={affidavitDueOn} amounts={offerAmounts} disabled={busy} />
    )
    // The sent notice's facts (v2.3760), for any row whose job has one inside thirty days (v2.6624, punch list #248): the Sent
    // footer draws them all; a drafting row with new months due draws the courtesy's and the attorney's letter's doors.
    // Letter two (v2.3760): what has happened since the packet went out, and the two doors — the GC's written okay, or the second letter.
    const lt = data?.letterTwoByJob[selected.jobId]
    // The first packet's item carries the GC's okay and the owner's call; the entry's item may be a later letter two.
    // The packet that went: letter two's first item, else the entry's sent notice — the Sent pile's `item`, or a drafting row's `sentItem` (v2.6624).
    const first = (lt?.firstItemId ? data?.items.find((i) => i.id === lt.firstItemId) : null) ?? selected.sentItem ?? null
    const call = data?.ownerCallByJob[selected.jobId] ?? null
    // The courtesy notice (punch list #231): where it stands, the amount it names (what the enclosed bills still owe, else the notice's claim), and the facts the window sends with.
    const courtesy = courtesyByJob[selected.jobId] ?? null
    const courtesyDraft = first ? parseLienDeskDraftFields(first.fields) : null
    const stillOwed = payPage.rows.reduce((s, r) => s + r.openAmount, 0)
    const courtesyClaim = payPage.rows.length && stillOwed > 0 ? stillOwed : Math.max(0, Number(courtesyDraft?.notice.claimAmount ?? 0) || 0)
    const courtesyFacts: CourtesyFacts | null =
      first && courtesyDraft && courtesy?.lienDay
        ? {
            jobNumber: job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '' : '',
            jobName: (job?.job_name ?? '').trim(),
            propertyAddress: (job?.job_address ?? '').trim(),
            county: (address?.county ?? '').trim(),
            gcName: gc?.name || courtesyDraft.notice.originalContractorName,
            claimantName: courtesyDraft.notice.claimantName,
            claim: courtesyClaim,
            monthsWords: describeNoticeMonths(first.months ?? []),
            noticeSentOn: first.sent_at ? calendarYmdInAppTzFromIso(first.sent_at) : todayYmd,
            lienDay: courtesy.lienDay,
            payLinks: payPage.rows.filter((r) => r.payable && r.openAmount > 0).map((r) => ({ address: payLinkDisplay(r.invoiceId), amount: r.openAmount })),
            contactPerson: courtesyDraft.notice.contactPerson,
            phone: signerPhoneFor ? signerPhoneFor(job?.master_user_id ?? null) : (issuer?.phone ?? '').trim(),
            offer: lienOfferFromItem(first),
          }
        : null
    const openCourtesy = () => {
      if (!first || !courtesyFacts || !courtesyDraft) return
      setCourtesyRecipients(null)
      setCourtesyCtx({ first, facts: courtesyFacts, jobId: selected.jobId, jobLabel: jobLabel(job, selected.jobId), gcCustomerId: job?.gc_customer_id ?? null })
      void loadCourtesyRecipients({ gcCustomerId: job?.gc_customer_id ?? null, gcName: gc?.name || courtesyDraft.notice.originalContractorName, gcEmail: courtesyDraft.gcEmail || gc?.email || '', ownerName, ownerEmail: property.owner.email, ownerPhone: property.owner.phone }).then(setCourtesyRecipients, (e) => {
        showToast(formatErrorMessage(e, 'Their addresses could not be found.'), 'error')
        setCourtesyRecipients([])
      })
    }
    // The recorded packet (v2.4119): a certified send with no number yet gets its "add the number" door here.
    const sentFiling = (data?.filingsByJob[selected.jobId] ?? []).find((f) => f.id === (first?.sent_filing_id ?? selected.item?.sent_filing_id)) ?? null
    const trackingOwed = sentFiling ? sendsTrackingOwed(sentFiling.sends) : []
    const jobBalance = Math.max(0, Number(job?.revenue ?? 0) - Number(job?.payments_made ?? 0))
    // Counsel's sign-off (#41 PR 3, v2.3790): the memo's moment — an owner paying Click direct while the GC is silent needs
    // counsel's per-job okay. Read from the firm's matter through `legalSignoff`; no matter with the firm, no door.
    const signoff = legalSignoff?.stateFor(selected.jobId) ?? null
    const signoffLine = signoff ? signoffWords(signoff, demandDate) : ''
    const startTwo = (kind: LetterTwoKind) => {
      if (!first) return
      setLetterTwoMenu(false)
      const fields: LienDeskDraftFields = {
        notice: jobDefaults,
        gcEmail: storedDraft?.gcEmail || gc?.email || '',
        ...(storedDraft?.batchReason ? { batchReason: storedDraft.batchReason } : {}),
        ...(storedDraft?.staleNote ? { staleNote: storedDraft.staleNote } : {}),
        ...(storedDraft?.monthsDatedFromCreation ? { monthsDatedFromCreation: true as const } : {}),
        coverLetter: letterTwoTemplate(kind, { gcName: gc?.name ?? '', claimantName: jobDefaults.claimantName }),
        letterTwo: { kind, afterItemId: first.id, afterSentAt: first.sent_at ?? '' },
      }
      void run('Start the attorney’s letter', async () => void (await startLetterTwo({ first, fields, userId: authUserId })), 'The attorney’s letter drafted — read it on the paper, then send it for approval.')
    }
    // The two doors a sent notice keeps (v2.6624): on the Sent footer as before, and on a drafting footer beside Send for approval once new months are due.
    // The messages went but the record did not take (punch list #249, row 1): the Send press gives way to the record alone, so nothing goes out twice.
    const courtesyUnrecordedHere = courtesyUnrecorded && courtesyUnrecorded.jobId === selected.jobId ? courtesyUnrecorded : null
    const courtesyUnrecordedBand = courtesyUnrecordedHere ? (
      <span data-lien-courtesy-unrecorded style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: '0.8125rem', color: 'var(--text-amber-800)' }}>
        <span>{courtesyUnrecordedWords(courtesyUnrecordedHere.to, courtesyUnrecordedHere.reason)}</span>
        <button
          type="button"
          onClick={() => void run('Write the courtesy record', async () => { await writeCourtesyRecord(courtesyUnrecordedHere.item, courtesyUnrecordedHere.record) }, 'Recorded — the footer and the job’s History read it.').then((ok) => { if (ok) setCourtesyUnrecorded(null) })}
          disabled={busy}
          style={btn('amber', busy)}
          data-lien-courtesy-record-again
        >
          {COURTESY_RECORD_AGAIN_BUTTON}
        </button>
      </span>
    ) : null
    const courtesyDoor = office && first && courtesy && courtesyMaySend(courtesy) && courtesyFacts && !courtesyUnrecordedHere ? <button type="button" onClick={openCourtesy} disabled={busy} style={btn(courtesy.state === 'due' ? 'amber' : 'plain', busy)} data-lien-courtesy-door data-courtesy-state={courtesy.state} title={courtesy.state === 'sent' ? 'One courtesy went. Send it again by hand only when a channel bounced; the desk does not ask for a second.' : courtesy.state === 'affidavit_week' ? 'The affidavit comes first this week; a courtesy may still go by hand.' : 'A plain reminder by email and text: the notice stands, the day the lien goes on unless it is paid, the pay link, your number. Not a statutory paper, never certified mail.'}>{courtesy.state === 'sent' ? 'Send a courtesy notice again' : COURTESY_BUTTON} ▸</button> : null
    const letterTwoDoor = office && first && jobBalance > 0.005 && lt?.state !== 'sent' && lt?.state !== 'in_flight' ? (
      <span style={{ position: 'relative' }}>
        <button type="button" onClick={() => setLetterTwoMenu((o) => !o)} disabled={busy} aria-haspopup="menu" aria-expanded={letterTwoMenu} style={lt && letterTwoIsDue(lt) && courtesy?.state !== 'paying' ? { ...btn('amber', busy) } : btn('plain', busy)} data-lien-letter-two-door data-letter-waits={courtesy?.state === 'paying' ? 'paying' : undefined} title={courtesy?.state === 'paying' ? 'They are paying it down, so the desk does not ask for the attorney’s letter. The office may still send it when the payment was token.' : undefined}>Send the attorney’s letter ▸</button>
        {letterTwoMenu ? (
          <>
            <div onClick={() => setLetterTwoMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 5 }} />
            <div role="menu" aria-label="The attorney’s letter — pick the letter" style={{ position: 'absolute', right: 0, bottom: 'calc(100% + 4px)', zIndex: 6, minWidth: 320, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
              <div style={{ ...boxHead, padding: '0.4rem 0.75rem 0.1rem' }}>Attorney’s letter · pick the letter</div>
              {LETTER_TWO_KINDS.map((k) => (
                <button key={k.key} type="button" role="menuitem" onClick={() => startTwo(k.key)} style={{ display: 'grid', gap: 2, width: '100%', padding: '0.45rem 0.75rem', border: 'none', borderTop: '1px solid var(--border)', background: 'var(--surface)', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit', fontSize: '0.8125rem' }} data-lien-letter-two-kind={k.key}>
                  <strong>{k.label}</strong>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{k.hint}</span>
                </button>
              ))}
              <div style={{ padding: '0.35rem 0.75rem 0.5rem', borderTop: '1px solid var(--border)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>Drafts the letter on this job's notice — read it on the paper, then send it for approval as usual.</div>
            </div>
          </>
        ) : null}
      </span>
    ) : null
    if (state === 'needs_owner' || state === 'to_draft' || (state === 'missed' && selected.dueMonths.length > 0)) {
      const blocked = !ready
      // The draft footer (v2.3776, punch list #36): ONE row — the state and its verb on the left, Save draft and the primary
      // on the right (the quiet Skip left in v2.4743: a month nobody sends closes on its own and is noted as missed).
      // The envelope line sits above the paper; the why is a parenthetical, not a sentence. Blocked, the primary is the way to the gate that blocks (a dim dead button taught nothing).
      const firstBlocker = gates.find((g) => g.tone === 'blocker') ?? null
      // One press per footer (v2.7324): the kernel names the press, the line beside it and the menus; the route is
      // the office's — a live send rule puts it in the run, the hold rule parks it, a claim set by hand goes to him whatever the rule.
      const foot = lienFooter({
        role: authRole,
        paper: 'notice',
        leaderName,
        blocked,
        route: claimGate ? 'leader' : ruleLive && !promise ? 'run' : selected.policy === 'hold' && !promise ? 'hold' : 'leader',
        sign: { way: draftSignWay, otherScreen, codeReady },
        pen: monthsList.length > 0,
      })
      const pickDoor = (key: string) => {
        if (key === 'word') {
          setWordNote(defaultWordNote(leaderName, demandDate(todayYmd)))
          setWordOpen(true)
        } else if (key === 'pen') {
          // v2.7297: the pen door on the draft — the paper printed and he signed it; the record approves the notice on his word.
          void run('He signed the paper', async () => { const id = await ensureDraft(); setPenDraft({ id, fields: draftFields() }); setPenOpen(true) })
        } else if (key.startsWith('sign:')) {
          const way = key.slice(5) as LienSignWay
          setSignWay(way)
          signRef.current?.setMode(way)
        }
      }
      // Blocked, the footer says the stop and the one thing to do in plain words (v2.4797); the gate's button is the way there.
      const stateWords = blocked ? lienFootBlockedSentence(firstBlocker, monthsList.length) : foot.primary?.line ?? ''
      const stateWhy = blocked
        ? readiness.reason === 'public_owner'
          ? PUBLIC_OWNER_DESK_SENTENCE
          : ''
        : leader
          ? promise
            ? `they promised ${formatYmdMonthDay(promise.promisedYmd)} — the paper or their word`
            : askReason && askReason !== 'no_rule'
              ? LIEN_ASK_REASON_LABELS[askReason]
              : ''
          : claimGate
            ? correctionGateWords(claimGate)
            : ruleLive && !promise
              ? 'standing “send” rule'
              : selected.policy === 'send' && !promise
                ? 'first notice to this GC — the rule starts with the next one'
                : selected.policy === 'hold' && !promise
                  ? 're-asks before the deadline'
                  : promise
                    ? `they promised ${formatYmdMonthDay(promise.promisedYmd)} — the paper or their word`
                    : askReason && askReason !== 'no_rule'
                      ? LIEN_ASK_REASON_LABELS[askReason]
                      : `no standing rule for ${gc?.name ?? 'this GC'}`
      // v2.7386: with a pad or his code on the draft, the line's box holds the footer (the awaiting footer's shape, v2.7382); his typed name still needs no box.
      const draftBoxed = leader && !blocked && draftSignWay !== 'type' && foot.primary?.key === 'approve'
      const draftApprove = () => run('Sign and approve', async () => { const id = await ensureDraft(); await setLienDeskItemOffer(id, offer); await signItem(id, draftFields(), true) }, offer ? `Signed and approved with a ${offer.pct}% offer. ${LIEN_RUN_NOW_TO_PRINT}` : `Signed and approved. ${LIEN_RUN_NOW_TO_PRINT}`)
      const draftSavedWords = draftSave !== 'idle' ? <span className="lienFootWhy" data-lien-desk-saved={draftSave}> · {draftSave === 'saving' ? 'Saving…' : '✓ Saved'}</span> : null
      footer = (
        <>
          {byHandPane ? (
            byHandPane
          ) : penPane ? (
            penPane
          ) : wordOpen ? (
            <LienWordRecordRow
              note={wordNote}
              onNote={setWordNote}
              channel={wordChannel}
              onChannel={setWordChannel}
              radioName="word-channel"
              recorderName={authName}
              leaderName={leaderName}
              preview={wordPreview}
              actionLabel="Approve on his word ▸"
              onAction={sendOnWord}
              actionDisabled={busy || !wordNote.trim()}
              actionBlock={wordRecordBlock(claimGate, wordChannel)}
              onCancel={() => setWordOpen(false)}
              btn={btn}
            />
          ) : (
            <>
            {leader && !blocked ? offerBox() : null}
            {leader && !blocked && draftSignWay !== 'type' && !draftBoxed ? draftSignLine() : null}
            {selected.sentItem && first ? (
              // The notice that went (v2.6624, punch list #248): its day, letter two's clock and its two doors ride above the draft row, so the next months draft while the reminders stay one press away.
              <div className="lienFootRow" data-lien-desk-sent-doors style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                <span>
                  Sent <strong style={{ color: 'var(--text-700)' }}>{first.sent_at ? demandDate(calendarYmdInAppTzFromIso(first.sent_at)) : ''}</strong>
                  {lt?.words ? ` · ${lt.words}` : lt?.day != null ? ` · day ${lt.day}` : ''} · the next notice drafts below
                </span>
                <span className="lienFootSpacer" />
                {courtesyUnrecordedBand}
                {courtesyDoor}
                {letterTwoDoor}
              </div>
            ) : null}
            {draftBoxed ? (
              <div data-lien-desk-next data-blocked="no">
                {draftSignLine({
                  call: (
                    <>
                      <span aria-hidden="true">→</span> {stateWhy ? stateWords.replace(/\.$/, '') : stateWords}
                    </>
                  ),
                  note: (
                    <>
                      {stateWhy ? <span className="lienFootWhy"> · {stateWhy}</span> : null}
                      {draftSavedWords}
                    </>
                  ),
                  press: (
                    <button type="button" className="lienSignFramePress" onClick={draftApprove} disabled={busy || Boolean(offerProblem)} title={foot.primary?.line} data-lien-desk-approve>
                      {foot.primary?.label}
                    </button>
                  ),
                  strip: (
                    <>
                      {foot.menus.map((m) => (
                        <LienFootMenu key={m.key} menu={m} disabled={busy} style={btn('plain', busy)} onPick={pickDoor} />
                      ))}
                      <span className="lienSignFramePush">
                        {offerSwitch()}
                        {foot.links.includes('by_hand') && monthsList.length > 0 ? (
                          <button type="button" className="lienFootLink" onClick={() => setByHandOpen(true)} disabled={busy} data-lien-desk-by-hand title="The paper was printed here and went out by hand — record when, how, what it claimed, and which jobs at the property it covered">Already mailed? Record it ›</button>
                        ) : null}
                      </span>
                    </>
                  ),
                })}
              </div>
            ) : (
            <div className="lienFootRow" data-lien-desk-next data-blocked={blocked ? 'yes' : 'no'}>
              <span className="lienFootState">
                <span aria-hidden="true">{blocked ? '✗' : '→'}</span> {stateWhy ? stateWords.replace(/\.$/, '') : stateWords}
                {stateWhy ? <span className="lienFootWhy"> · {stateWhy}</span> : null}
                {draftSavedWords}
              </span>
              <span className="lienFootSpacer" />
              {leader && !blocked ? offerSwitch() : null}
              {foot.links.includes('by_hand') && monthsList.length > 0 ? (
                <button type="button" className="lienFootSkip" onClick={() => setByHandOpen(true)} disabled={busy} data-lien-desk-by-hand title="The paper was printed here and went out by hand — record when, how, what it claimed, and which jobs at the property it covered">
                  <span className="lienByHandWords">Already mailed?{' '}<br />Record it…</span>
                </button>
              ) : null}
              <div className="lienFootActions">
                {foot.menus.map((m) => (
                  <LienFootMenu key={m.key} menu={m} disabled={busy} style={btn('plain', busy)} onPick={pickDoor} />
                ))}
                {blocked ? (
                  <button type="button" onClick={() => (firstBlocker ? pickGate(firstBlocker.key) : paneRef.current?.scrollTo?.({ top: 0, behavior: 'smooth' }))} style={btn('primary')} data-lien-desk-go-to-gate>
                    {firstBlocker ? `Go to gate ${firstBlocker.n} ▴` : 'Show what is missing ▴'}
                  </button>
                ) : foot.primary?.key === 'approve' ? (
                  <button type="button" onClick={draftApprove} disabled={busy || Boolean(offerProblem)} style={btn('green', busy || Boolean(offerProblem))} title={foot.primary.line} data-lien-desk-approve>
                    {foot.primary.label}
                  </button>
                ) : (
                  <button type="button" onClick={sendToLeader} disabled={busy || !office} style={btn('primary', busy || !office)} title={foot.primary?.line} data-lien-desk-ask>
                    {foot.primary?.label}
                  </button>
                )}
              </div>
            </div>
            )}
            </>
          )}
        </>
      )
    } else if (state === 'awaiting') {
      footer = byHandPane ?? (leader ? (
        <>
          {holdOpen ? (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem' }}>
              <span>
                Holds until <strong>{formatYmdMonthDay(holdUntilFor(holdOpen, selected.earliestDeadline, promise?.promisedYmd ?? null, todayYmd))}</strong>, then asks again.{' '}
                <span style={{ color: 'var(--text-red-600)' }}>{monthsList[0] ? `${workMonthLabel(monthsList[0])}'s lien right ends ${selected.earliestDeadline ? demandDate(selected.earliestDeadline) : ''}.` : ''}</span>
              </span>
              <button type="button" onClick={() => hold(holdOpen)} disabled={busy} style={btn('amber', busy)}>Hold</button>
              <button type="button" onClick={() => setHoldOpen(null)} style={btn('plain')}>Cancel</button>
            </div>
          ) : simpleApprove ? (
            notYetOpen ? (
              <div className="lienFootRow" data-lien-desk-not-yet>
                <button type="button" onClick={() => setHoldOpen('promised')} disabled={busy} style={btn('plain', busy)}>Hold — they promised…</button>
                <button type="button" onClick={() => setHoldOpen('call_first')} disabled={busy} style={btn('plain', busy)}>Hold — I'll call first</button>
                <button type="button" onClick={pullBack} disabled={busy} style={btn('plain', busy)}>Back to the office</button>
                <button type="button" onClick={() => setNotYetOpen(false)} style={btn('plain')}>Cancel</button>
              </div>
            ) : (
              <div data-lien-desk-phone-approve style={{ display: 'grid', gap: '0.5rem' }}>
                {signLine(true)}
                {detailsOpen ? offerSwitch() : null}
                <button type="button" onClick={approve} disabled={busy || Boolean(offerProblem)} style={{ ...btn('green', busy || Boolean(offerProblem)), width: '100%', padding: '12px 14px', fontSize: '1rem' }}>Sign and approve ▸</button>
                <button type="button" onClick={() => setNotYetOpen(true)} disabled={busy} style={{ ...btn('plain', busy), width: '100%', padding: '10px 14px' }}>Not yet</button>
              </div>
            )
          ) : (
            <>
            {offerBox()}
            {/* v2.7382 (Taunya's ask): one box. The paper on the left, the call and the one press beside it with the code, the other ways out as a quiet strip. */}
            <div data-lien-desk-next data-blocked="no">
              {signLine(false, {
                call: (
                  <>
                    <span aria-hidden="true">→</span> Your call on {monthsWord}
                  </>
                ),
                note: rulePick ? <span className="lienFootWhy"> · keeps the rule “{LIEN_NOTICE_POLICIES.find((p) => p.key === rulePick)?.label}”</span> : null,
                press: (
                  <button type="button" className="lienSignFramePress" onClick={approve} disabled={busy || Boolean(offerProblem)}>Sign and approve &amp; next ▸</button>
                ),
                strip: (
                  <>
                    <span className="lienSignFrameLead">Not yet</span>
                    <button type="button" className="lienFootLink" onClick={() => setHoldOpen('promised')} disabled={busy}>Hold — they promised…</button>
                    <button type="button" className="lienFootLink" onClick={() => setHoldOpen('call_first')} disabled={busy}>Hold — I'll call first</button>
                    <button type="button" className="lienFootLink" onClick={pullBack} disabled={busy}>Back to the office</button>
                    <span className="lienSignFramePush">
                      {offerSwitch()}
                      <button type="button" className="lienFootLink" onClick={() => setByHandOpen(true)} disabled={busy} data-lien-desk-by-hand title="The paper was printed here and already went out by hand — record it instead of approving">Already mailed? Record it ›</button>
                    </span>
                  </>
                ),
              })}
            </div>
            </>
          )}
        </>
      ) : wordOpen ? (
        <LienWordRecordRow
          note={wordNote}
          onNote={setWordNote}
          channel={wordChannel}
          onChannel={setWordChannel}
          radioName="word-channel"
          recorderName={authName}
          leaderName={leaderName}
          preview={wordPreview}
          leadIn="Leader here"
          actionLabel="Approve on his word ▸"
          onAction={sendOnWord}
          actionDisabled={busy || !wordNote.trim()}
          actionBlock={wordRecordBlock(claimGate, wordChannel)}
          onCancel={() => setWordOpen(false)}
          btn={btn}
        />
      ) : (
        <>
        {otherScreen && office ? (
          // v2.5791: the master signs on the office's screen with his code or his hand; the spoken word stays the other door.
          <div data-lien-desk-office-sign style={{ marginBottom: '0.5rem' }}>
            {signLine(false, {
              call: (
                <>
                  <span aria-hidden="true">→</span> His code or his hand here
                </>
              ),
              note: <span className="lienFootWhy"> · The record names your screen.</span>,
              press: (
                <button type="button" className="lienSignFramePress" onClick={approve} disabled={busy} data-lien-desk-office-sign-press>Sign and approve ▸</button>
              ),
            })}
          </div>
        ) : null}
        <div className="lienFootRow" data-lien-desk-foot="awaiting">
          <FootChip chip={awaitingChip(selected.item)} data-lien-desk-awaiting-words />
          <span className="lienFootSpacer" />
          <button type="button" className="lienFootLink" onClick={() => setByHandOpen(true)} disabled={!office || busy} data-lien-desk-by-hand title="The paper was printed here and already went out by hand — record it, and this stops waiting">
            Already mailed? Record it ›
          </button>
          {canSendOnWord(authRole) ? (
            <button type="button" className="lienFootLink" onClick={pullBack} disabled={busy || !office}>Pull back to draft</button>
          ) : (
            <button type="button" onClick={pullBack} disabled={busy || !office} style={btn('plain', busy || !office)}>Pull back to draft</button>
          )}
          {canSendOnWord(authRole) ? (
            <button
              type="button"
              onClick={() => { setWordNote(defaultWordNote(leaderName, demandDate(todayYmd))); setWordChannel('standing_over'); setWordOpen(true) }}
              disabled={busy}
              style={btn('primary', busy)}
              data-lien-desk-leader-here
              title="The leader is beside you — write down that he is standing here or typing it in, and it goes to Approved · to print on his word. This is the approval step."
            >
              Leader here, Approve ▸
            </button>
          ) : null}
        </div>
        </>
      ))
    } else if (state === 'ready') {
      const itemOffer = lienOfferFromItem(selected.item)
      const readySignedRaw = selected.item ? lienChipSigned(signatureColumnsOf(selected.item), lienFieldsHash(selected.item.fields)) : null
      const readyDevice = selected.item ? signatureColumnsOf(selected.item).signed_on_device_of : null
      const readySigned = readySignedRaw && readySignedRaw !== 'unsigned' ? { ...readySignedRaw, recordedByName: readySignedRaw.recordedBy ? (leaderNameFor?.(readySignedRaw.recordedBy) ?? null) : null, onDeviceName: readyDevice ? (leaderNameFor?.(readyDevice) ?? null) : null } : readySignedRaw
      // The pen train, PR 3, and the code (v2.5791): a signature placed for him — by the office's pen record, or by his own code on someone else's screen — waits on his word; nothing blocks on it.
      const penAwaits = readySigned && readySigned !== 'unsigned' && (readySigned.mode === 'pen' || readySigned.mode === 'code') && !readySigned.confirmedAt
      const codeAwaits = Boolean(penAwaits && readySigned && typeof readySigned === 'object' && readySigned.mode === 'code')
      // v2.7386: an unsigned ready notice's line is the footer's box; Sign ▸ sits beside the code and the row is the box's strip.
      const readyBoxed = (leader || (office && otherScreen)) && readySigned === 'unsigned'
      const readyRow = (
        <div className="lienFootRow" data-lien-desk-foot="ready">
          <FootChip chip={readyChip(selected.item, gc?.name, itemOffer ? lienOfferChipWords(itemOffer) : null, leaderName, takenBackChipWords(runTakenBackOf(selected.item?.fields)), readySigned)} data-lien-desk-ready-words />
          {leader && selected.item?.approval_mode === 'word' ? (
            <button type="button" className="lienFootLink" onClick={pullBack} disabled={busy} title="Pull it back to the office's draft — it has not gone out">Not what I said</button>
          ) : null}
          <span className="lienFootSpacer" />
          {leader ? offerSwitch() : null}
          {office && readySigned === 'unsigned' ? (
            <button type="button" className="lienFootLink" onClick={() => setPenOpen(true)} disabled={busy} data-lien-desk-pen title="He signed the printed paper with a pen: write down who, when, how you know, and add the signed page">
              He signed the paper ›
            </button>
          ) : null}
          <button type="button" className="lienFootLink" onClick={() => setByHandOpen(true)} disabled={!office || busy} data-lien-desk-by-hand title="The paper was printed here and already went out by hand. Record it here instead of printing and mailing it again">
            Already mailed? Record it ›
          </button>
          <button type="button" className="lienFootLink" onClick={() => onOpenLienInstruments(selected.jobId)} disabled={!office} title="One notice on its own: print or email it and record the sends in the Lien window">
            Just this one ›
          </button>
          <button type="button" onClick={() => setRunOpen(true)} disabled={!office} style={btn('primary', !office)} title="Every approved notice as one packet and one tracking form">
            {lienRunActLabel('print', runCount)} ▸
          </button>
        </div>
      )
      footer = byHandPane ?? penPane ?? (
        <>
        {leader ? offerBox(saveOffer, itemOffer != null) : null}
        {/* v2.6733 (punch list #150): the office's Ready footer carries the master's line too — his code or his hand on this screen, beside the pen record. */}
        {readyBoxed
          ? signLine(false, {
              call: (
                <>
                  <span aria-hidden="true">→</span> {otherScreen ? `${codeSigner?.firstName ?? 'The leader'}’s signature` : 'Your signature'} on {monthsWord}
                </>
              ),
              press: leader ? (
                <button type="button" className="lienSignFramePress" onClick={signOnly} disabled={busy} data-lien-desk-sign title={otherScreen ? `Approved on his word; ${codeSigner?.firstName ?? 'the leader'} signs here with his code or his hand, and the record names your screen` : 'Approved on your word; your signature goes on the paper'}>Sign ▸</button>
              ) : (
                <button type="button" className="lienSignFramePress" onClick={signOnly} disabled={busy} data-lien-desk-office-sign-press title="His code or his hand here. The record names your screen">Sign ▸</button>
              ),
              strip: readyRow,
            })
          : null}
        {leader && !otherScreen && penAwaits && selected.item ? (
          // The pen train, PR 3: the office wrote down his pen signature; his word strengthens the record, his No clears it.
          // v2.6734: his word alone — on another master's job the group is not drawn, since the guard takes a confirm only from the signer's own sign-in.
          <div data-lien-desk-pen-confirm data-lien-desk-confirm-mode={codeAwaits ? 'code' : 'pen'} role="group" aria-label={codeAwaits ? 'A signature by your code, waiting on your word' : 'A pen signature recorded for you'} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', padding: '0.5rem 0.75rem', marginBottom: '0.5rem', borderRadius: 8, border: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)', fontSize: '0.8125rem' }}>
            <span style={{ flex: '1 1 16rem' }}>
              {codeAwaits ? (
                <>
                  <strong>Your signing code signed this notice</strong> on {(readySigned.onDeviceName ?? '').trim() || 'the office'}’s screen{readySigned.at ? ` · ${footShortDay(readySigned.at)}` : ''}. Nothing waits on your word; it makes the record stronger. Not you? Press Not me, then change your code under Settings, Your account.
                </>
              ) : (
                <>
                  <strong>{(readySigned.recordedByName ?? '').trim() || 'The office'} recorded your pen signature</strong> on this notice{readySigned.at ? ` · signed ${footShortDay(readySigned.at)}` : ''}. Nothing waits on your word; it makes the record stronger.
                </>
              )}
            </span>
            <button type="button" onClick={() => run(codeAwaits ? 'Confirm the code signature' : 'Confirm the pen signature', () => confirmLienPenSignature(selected.item!.id), 'Confirmed — the record carries your word too.')} disabled={busy} style={btn('green', busy)} data-lien-desk-pen-yes>{codeAwaits ? 'Yes, it was me ▸' : 'Yes, I signed it ▸'}</button>
            <button type="button" className="lienFootLink" onClick={() => run(codeAwaits ? 'Disown the code signature' : 'Disown the pen signature', () => disownLienPenSignature(selected.item!.id), 'Cleared — the notice is unsigned again and the run holds it.')} disabled={busy} data-lien-desk-pen-no title="The record is wrong: it clears, the approval stands, and the run holds the notice until it is signed again">{codeAwaits ? 'Not me' : 'Not what I signed'}</button>
          </div>
        ) : null}
        {readyBoxed ? null : readyRow}
        </>
      )
    } else if (state === 'printed') {
      // v2.4568: a printed notice had no footer at all. The run is where its tracking numbers are typed and the mailing recorded.
      const printedAt = (selected.item as { printed_at?: string | null } | null)?.printed_at ?? null
      footer = byHandPane ?? (
        <div data-lien-desk-printed-footer className="lienFootRow" data-lien-desk-foot="printed">
          <FootChip chip={printedChip({ printed_at: printedAt })} />
          <span className="lienFootSpacer" />
          <button type="button" className="lienFootLink" onClick={backToReady} disabled={!office || busy} title="It was not mailed: put it back in Approved · to print. The approval stands">
            Back to Approved · to print
          </button>
          <button type="button" className="lienFootLink" onClick={() => setByHandOpen(true)} disabled={!office || busy} data-lien-desk-by-hand title="The paper already went out by hand. Record it here instead of entering mail numbers">
            Already mailed? Record it ›
          </button>
          <button type="button" onClick={() => setRunOpen(true)} disabled={!office} style={btn('primary', !office)} title="The run as a checklist: this notice's Printed, Signed and Mailed ticks, the tracking box under Mailed">
            {lienRunActLabel('record', counts?.printed ?? runCount)} ▸
          </button>
        </div>
      )
    } else if (state === 'held') {
      const heldRow = (
        <div className="lienFootRow" data-lien-desk-foot="held">
          <FootChip chip={heldChip(selected.item, gc?.name)} data-lien-desk-held-words />
          {monthsList[0] ? <span className="lienFootRed">{`${workMonthLabel(monthsList[0])}'s lien right ends ${selected.earliestDeadline ? demandDate(selected.earliestDeadline) : ''}.`}</span> : null}
          <span className="lienFootSpacer" />
          <button type="button" className="lienFootLink" onClick={() => setByHandOpen(true)} disabled={!office || busy} data-lien-desk-by-hand title="The paper was printed here and already went out by hand — record it, and this stops waiting">
            Already mailed? Record it ›
          </button>
          {leader ? (
            <>
              <button type="button" className="lienFootLink" onClick={pullBack} disabled={busy || !office}>Back to draft</button>
            </>
          ) : (
            <button type="button" onClick={pullBack} disabled={busy || !office} style={btn('plain', busy || !office)}>Back to draft</button>
          )}
        </div>
      )
      footer = byHandPane ?? (
        <>
        {/* v2.7386: his line is the footer's box. The press that releases the hold sits beside the code and the row is the box's strip. */}
        {leader
          ? signLine(false, {
              call: (
                <>
                  <span aria-hidden="true">→</span> Your call on {monthsWord}
                </>
              ),
              press: (
                <button type="button" className="lienSignFramePress" onClick={approve} disabled={busy}>Release the hold, sign and approve ▸</button>
              ),
              strip: heldRow,
            })
          : heldRow}
        </>
      )
    } else if (state === 'sent') {
      const noteOkay = () => {
        if (!first) return
        void run('Note the GC’s okay', async () => noteGcAuthorizedDirectPay(first, { name: authName, note: gcOkayNote }), 'Noted — the attorney’s letter is off; the owner may pay us against a release.').then((ok) => {
          if (ok) {
            setGcOkayOpen(false)
            setGcOkayNote('')
          }
        })
      }
      // Record what they promised (punch list #274, PR 3): the day goes on the job, as the Stages board's promise does, so every board reads one; the amount and their words stay on the notice.
      const promiseDay = /^\d{4}-\d{2}-\d{2}$/.test(promiseYmd) ? promiseYmd : null
      const promiseAmountN = promiseAmount.replace(/[$,\s]/g, '') === '' ? null : Number(promiseAmount.replace(/[$,\s]/g, ''))
      const promiseAmountBad = promiseAmountN != null && (!Number.isFinite(promiseAmountN) || promiseAmountN <= 0)
      const recordPromise = () => {
        if (!first || promiseAmountBad) return
        const record: CourtesyPromise = { at: new Date().toISOString(), by: authName, ymd: promiseDay, amount: promiseAmountN, note: promiseNote.trim() }
        void run(
          PROMISE_BUTTON,
          async () => {
            if (promiseDay) await addJobPaymentPromise({ jobId: selected.jobId, ymd: promiseDay, saidBy: null, channel: null, note: promiseNote.trim() || null })
            await notePromiseOnNotice(first, record)
          },
          promiseDay ? `Recorded — the desk asks again ${formatYmdMonthDay(promiseDay)}.` : 'Recorded — the desk asks again a week after the payment.',
        ).then((ok) => {
          if (ok) {
            setPromiseOpen(false)
            setPromiseYmd('')
            setPromiseAmount('')
            setPromiseNote('')
          }
        })
      }
      footer = (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }} data-lien-since-sent>
            <span>Sent <strong style={{ color: 'var(--text-700)' }}>{first?.sent_at ? demandDate(calendarYmdInAppTzFromIso(first.sent_at)) : ''}</strong> · in the job's Lien window</span>
            {lt && lt.day != null ? <span>Day <strong style={{ color: 'var(--text-700)' }}>{lt.day}</strong></span> : null}
            <span>GC paid: <strong style={{ color: 'var(--text-700)' }}>{jobBalance <= 0.005 ? 'yes' : 'no'}</strong></span>
            <span>GC authorized direct pay: <strong style={{ color: 'var(--text-700)' }}>{lt?.gcAuthorized ? `yes · ${formatYmdMonthDay(calendarYmdInAppTzFromIso(lt.gcAuthorized.at))}${lt.gcAuthorized.note ? ` · ${lt.gcAuthorized.note}` : ''}` : 'no'}</strong></span>
            {sentFiling && trackingOwed.length ? <LienTrackingOwedEditor filing={sentFiling} onSaved={onChanged} /> : null}
            {sentFiling && (data?.mailPiecesByFiling?.[sentFiling.id]?.length ?? 0) > 0 ? (
              <span data-lien-mail-status style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.3rem 0.8rem' }}>
                {filingMailLines(data!.mailPiecesByFiling![sentFiling.id]!, formatYmdMonthDay).map((l) => (
                  <span key={l.id}>Through Docsmit, {l.who.toLowerCase()}: <strong style={{ color: l.tone === 'green' ? 'var(--text-green-800)' : l.tone === 'red' ? 'var(--text-red-600)' : l.tone === 'amber' ? 'var(--text-amber-700, var(--text-amber-700))' : 'var(--text-700)' }}>{l.words}</strong>{l.tracking ? <span style={{ color: 'var(--text-muted)' }}> · {l.tracking}</span> : null}{l.cost ? <span style={{ color: 'var(--text-muted)' }}> · {l.cost}</span> : null}</span>
                ))}
                {filingMailCostWords(data!.mailPiecesByFiling![sentFiling.id]!) ? <span data-lien-mail-cost>{filingMailCostWords(data!.mailPiecesByFiling![sentFiling.id]!)}</span> : null}
                {/* The doors (6b-3): under the lines, one set per envelope that came back, for the office. */}
                {office ? mailPiecesNeedingYou(data!.mailPiecesByFiling![sentFiling.id]!).map((p) => (
                  <LienMailPieceDoors key={p.id} piece={p} jobNumber={job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) : null} onChanged={onChanged} />
                )) : null}
              </span>
            ) : null}
            {lt?.letterTwo ? <span>The attorney’s letter: <strong style={{ color: 'var(--text-700)' }}>{lt.words}</strong></span> : null}
            {signoff ? <span data-lien-counsel-signoff style={signoff.state === 'signed_off' ? { color: 'var(--text-green-800)' } : signoff.state === 'declined' ? { color: 'var(--text-red-600)' } : undefined}>Counsel: <strong style={{ color: 'inherit' }}>{signoffLine || 'not asked'}</strong></span> : null}
            <span data-lien-owner-called>Owner called: <strong style={{ color: 'var(--text-700)' }}>{call ? ownerCallWords(call, formatYmdMonthDay, formatUsdNoCents) : 'not yet'}</strong>{call && affidavitPileFor(call) ? <span style={{ ...chip('var(--bg-green-tint)', 'var(--text-green-800)'), marginLeft: 6 }}>Pile {affidavitPileFor(call)}</span> : null}</span>
            {courtesy && courtesy.state !== 'none' ? <span data-lien-courtesy-state={courtesy.state}>Courtesy notice: <strong style={{ color: courtesy.state === 'held' ? 'var(--text-red-600)' : 'var(--text-700)' }}>{courtesy.state === 'due' ? (courtesy.lastSentAt ? courtesy.words : 'not yet') : courtesy.state === 'waiting' ? `from day ${COURTESY_FROM_DAY}` : courtesy.state === 'held' ? courtesy.reason : courtesy.words}</strong></span> : null}
            {courtesy?.paying?.promise ? <span data-lien-promise>They promised: <strong style={{ color: 'var(--text-700)' }}>{[courtesy.paying.promise.amount ? formatUsdNoCents(courtesy.paying.promise.amount) : '', courtesy.paying.promise.ymd ? `by ${formatYmdMonthDay(courtesy.paying.promise.ymd)}` : '', courtesy.paying.promise.note ? `“${courtesy.paying.promise.note}”` : ''].filter(Boolean).join(' · ') || 'recorded'}{courtesy.paying.promise.by ? ` · ${courtesy.paying.promise.by}` : ''}</strong></span> : null}
          </div>
          {promiseOpen && courtesy?.state === 'paying' ? (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem' }} data-lien-promise-form>
              <span>What they promised for the rest ({formatUsdNoCents(courtesy.paying?.stillOwed ?? jobBalance)} still owed):</span>
              <input type="date" value={promiseYmd} onChange={(ev) => setPromiseYmd(ev.target.value)} aria-label="The day they promised" style={{ padding: '4px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', font: 'inherit', fontSize: '0.8125rem' }} />
              <input value={promiseAmount} onChange={(ev) => setPromiseAmount(ev.target.value)} placeholder={formatUsdNoCents(courtesy.paying?.stillOwed ?? jobBalance)} aria-label="The amount they promised" inputMode="decimal" style={{ width: 110, padding: '4px 8px', border: `1px solid ${promiseAmountBad ? 'var(--text-red-600)' : 'var(--border-strong)'}`, borderRadius: 6, background: 'var(--surface)', color: 'inherit', font: 'inherit', fontSize: '0.8125rem' }} />
              <input value={promiseNote} onChange={(ev) => setPromiseNote(ev.target.value)} placeholder="their words, who said it" aria-label="Their words" style={{ flex: '1 1 180px', padding: '4px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', font: 'inherit', fontSize: '0.8125rem' }} />
              <button type="button" onClick={recordPromise} disabled={busy || promiseAmountBad || (!promiseDay && !promiseAmountN && !promiseNote.trim())} style={btn('green', busy || promiseAmountBad || (!promiseDay && !promiseAmountN && !promiseNote.trim()))} data-lien-promise-record>Record it ▸</button>
              <button type="button" onClick={() => setPromiseOpen(false)} style={btn('plain')}>Cancel</button>
              <span style={{ flexBasis: '100%', color: 'var(--text-muted)' }}>{promiseDay ? `The desk asks again ${formatYmdMonthDay(promiseDay)}. The Stages board reads the same day.` : `With no day the desk asks again ${courtesy.paying ? formatYmdMonthDay(courtesy.paying.until) : 'a week after the payment'}.`} The lien’s day does not move.</span>
            </div>
          ) : gcOkayOpen ? (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem' }}>
              <span>The GC's written okay for the owner to pay us — where it is and when:</span>
              <input value={gcOkayNote} onChange={(ev) => setGcOkayNote(ev.target.value)} placeholder="email from Harborline, Sep 15" aria-label="The GC's okay — where and when" style={{ flex: '1 1 200px', padding: '4px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', font: 'inherit', fontSize: '0.8125rem' }} />
              <button type="button" onClick={noteOkay} disabled={busy || !gcOkayNote.trim()} style={btn('green', busy || !gcOkayNote.trim())} data-lien-gc-okay-record>Record it ▸</button>
              <button type="button" onClick={() => setGcOkayOpen(false)} style={btn('plain')}>Cancel</button>
            </div>
          ) : signoffOpen ? (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem' }} data-lien-desk-signoff>
              <span style={{ color: 'var(--text-muted)' }}>Ask counsel to sign off on {gc?.name ?? 'the GC'}'s job:</span>
              <input value={signoffText} onChange={(ev) => setSignoffText(ev.target.value)} aria-label="The ask" style={{ flex: '1 1 260px', padding: '4px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', font: 'inherit', fontSize: '0.8125rem' }} />
              <button type="button" disabled={busy || !signoffText.trim()} style={btn('primary', busy || !signoffText.trim())} onClick={() => void run('Ask counsel', async () => { const err = await legalSignoff!.ask(selected.jobId, signoffText.trim()); if (err) throw new Error(err) }, 'Asked — the firm sees it on their portal; their answer lands on your Needs You list.').then((ok) => { if (ok) setSignoffOpen(false) })}>Send to the firm</button>
              <button type="button" onClick={() => setSignoffOpen(false)} style={btn('plain')}>Cancel</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              <span>
                {courtesy && (courtesy.state === 'due' || courtesy.state === 'sent' || courtesy.state === 'affidavit_week' || courtesy.state === 'paying') ? courtesyFooterSentence(courtesy, demandMoney(String(courtesyClaim))) : lt?.state === 'sent' ? 'The attorney’s letter went out. The next step is the affidavit, on its own date.' : lt?.state === 'gc_authorized' ? 'The GC said the owner may pay us — take the check against a release; no second letter.' : lt?.state === 'paid' || jobBalance <= 0.005 ? 'Paid — nothing more to send.' : lt && letterTwoIsDue(lt) ? `The attorney’s letter goes 10–14 days after the packet when the GC has neither paid nor authorized a direct payment — day ${lt.day}${lt.state === 'overdue' ? ', past the 14' : ''}. Same form, same two recipients, the GC copied by the same mail.` : `The attorney’s letter goes 10–14 days after the packet if the GC has neither paid nor authorized a direct payment${lt?.day != null ? ` — day ${lt.day} today` : ''}.`}
              </span>
              <span style={{ flex: 1 }} />
              {office && first && signoff && signoff.state !== 'asked' && jobBalance > 0.005 ? <button type="button" onClick={() => { setSignoffText(defaultSignoffAsk({ gcName: gc?.name ?? '', amount: `$${Math.round(jobBalance).toLocaleString('en-US')}` })); setSignoffOpen(true) }} disabled={busy} style={btn('plain', busy)} data-lien-desk-ask-signoff title="The owner wants to pay Click direct while the GC is silent — counsel signs off per job before the office takes the check (counsel's memo)">Ask counsel to sign off…</button> : null}
              {office && first ? <button type="button" onClick={() => setOwnerCallOpen(true)} disabled={busy} style={btn('plain', busy)} data-lien-owner-call-door>{call ? 'The owner called again…' : 'Record the owner’s call…'}</button> : null}
              {office && first && courtesy?.state === 'paying' ? <button type="button" onClick={() => setPromiseOpen(true)} disabled={busy} style={btn(courtesy.paying?.promise ? 'plain' : 'amber', busy)} data-lien-promise-door title="They are paying it down. Record the day and the amount they gave for the rest; the desk asks again on that day. The day also reads on the Stages board.">{courtesy.paying?.promise ? 'They promised again…' : `${PROMISE_BUTTON}…`}</button> : null}
              {office && first && !lt?.gcAuthorized && jobBalance > 0.005 && lt?.state !== 'sent' ? <button type="button" onClick={() => setGcOkayOpen(true)} disabled={busy} style={btn('plain', busy)} data-lien-gc-okay>The GC authorized direct pay…</button> : null}
              {courtesyUnrecordedBand}
              {courtesyDoor}
              {letterTwoDoor}
            </div>
          )}
        </>
      )
    } else if (state === 'missed') {
      footer = (
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-red-600)' }}>
          The window closed on {selected.missedMonths.map(workMonthLabel).join(', ')} with no notice — the lien right on that work is gone. {selected.item?.status === 'missed' ? `Skipped: ${parseLienDeskDraftFields(selected.item.fields)?.skipReason ?? ''}` : ''}
        </div>
      )
    }
  }

  // The tools (v2.6569): § Rules, ☎, ? and Share, with the owner-records door before them. On a computer they end the title line
  // when it has room for them (v2.7213; a 1,540 px viewport rule until v2.7277, which measures the line and puts the door under the four when the line has room for them alone) and are the tool row, the title bar's steady second line, in a narrower one (v2.4618
  // put them at the right; until v2.6569 they sat on the title line and fell under it when the window was narrower than about
  // 1,250 px, with the leader's FYI sentence under that). On a phone they keep their places. Share (v2.4311) is the last of them.
  const headerTools = (
    <span data-lien-desk-presses style={isMobile ? { position: 'absolute', right: '0.8rem', top: '0.35rem' } : { position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {isMobile ? null : rulesAndCaller}
      {isMobile ? null : <LegendButton legend={LIEN_DESK_LEGEND} open={legendOpen} onToggle={setLegendOpen} />}
      <button
        type="button"
        onClick={() => setShareOpen((o) => !o)}
        disabled={!data}
        aria-haspopup="dialog"
        aria-expanded={shareOpen}
        aria-label={isMobile ? 'Share where the liens stand' : undefined}
        data-lien-desk-share
        title="Share where the liens stand: who we are about to lien, for how much, and by when"
        style={{
          ...btn('plain', !data),
          ...(isMobile ? {} : headDoor),
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          ...(isMobile ? { width: 40, height: 40, padding: 0, borderRadius: 10 } : {}),
          ...(shareOpen ? { background: 'var(--bg-blue-tint)', borderColor: 'var(--border-blue)', color: 'var(--text-blue-800)' } : {}),
        }}
      >
        <Share size={isMobile ? 19 : 15} aria-hidden />
        {/* A desk narrower than 1,100 px shows the icon alone; the word stays the button's name. */}
        {isMobile ? null : <span className="lienDeskShareWord">Share</span>}
      </button>
      {shareOpen && data ? (
        <LienDeskShare isMobile={isMobile} data={data} calendarRows={calendarRows} suppliers={suppliers.byJob} todayYmd={todayYmd} me={{ id: authUserId, name: authName }} onClose={() => setShareOpen(false)} />
      ) : null}
    </span>
  )
  // The frame (punch list #182, PR 3: the window's overlay, ✕ and full-screen toggle are gone): the panel is the whole screen under
  // the app's chrome, a named region; the desk's own sheets and windows stand where they are.
  // A job as its own screen on a phone (punch list #352, PR 4): the first view's row, opened over the panel. It belongs to that view alone.
  const jobScreenKey = onOpenRow ? (openRowKey ?? null) : rowLocal
  const jobScreenRow = isMobile && kind === 'next' && jobScreenKey ? (nextUpRows.find((r) => r.key === jobScreenKey) ?? null) : null
  const openJobScreen = (row: LienNextUpRow) => (onOpenRow ? onOpenRow(row.key) : setRowLocal(row.key))
  const closeJobScreen = () => (onCloseRow ? onCloseRow() : setRowLocal(null))
  const panelStyle: React.CSSProperties = { position: 'relative', background: 'var(--surface)', width: '100%', height: '100%', minHeight: 0, display: 'grid', gridTemplateRows: 'auto 1fr auto', gridTemplateColumns: 'minmax(0, 1fr)', overflow: 'hidden' }
  // Stacked, an open notice is the whole desk: its door back is the list, in the page door's place (punch list #182 PR 3).
  const noticeOpenStacked = stacked && kind === 'notice' && !mobileListShown && selected != null
  // On a phone an open paper is the whole desk (punch list #352, PR 6): the header is one row with the way back to its list, and the footer folds.
  const paneOpenPhone = lienPhonePaneOpen({ oneColumn, listShown: mobileListShown, kind, picked: { notice: selected != null, affidavit: affSelected != null, retainage: retSelected != null } })
  const footFold = paneOpenPhone && !(simpleApprove && !detailsOpen) && (paneOpenPhone.kind !== 'notice' || Boolean(footer)) ? lienPhoneFootFold(footFolded) : null
  // The footer strip (the owner's ask of 2026-11-15, `lienDeskFooterHome`): on a computer it is the pane's own bottom bar, so the
  // list runs to the desk's bottom; on a phone it stays the desk's, right after the fold bar whose sibling rule folds it.
  // The affidavit's and the retainage notice's panes portal their footer into the slot (v2.3753). The notice's is drawn here on a phone;
  // on a computer it is the pane's last section since v2.7422, so the pane column's bottom row is empty for a notice.
  const footerHome = lienDeskFooterHome(oneColumn)
  // The notice's strip: the desk's on a phone, the pane's last section on a computer (v2.7422), where the blue head is its top edge.
  const noticeFooterStrip = (
    <div ref={noticeFooterRef} className="lienDeskFooterSlot" data-lien-desk-footer="notice" style={{ display: 'grid', gap: '0.5rem', padding: '0.6rem 1.25rem 0.9rem', borderTop: footInPane ? 'none' : '1px solid var(--border)', background: 'var(--bg-subtle)' }}>{footer}</div>
  )
  const paneFooter =
    kind === 'affidavit' ? <div ref={setAffFooterEl} className="lienDeskFooterSlot" data-lien-desk-footer="affidavit" />
    : kind === 'retainage' ? <div ref={setRetFooterEl} className="lienDeskFooterSlot" data-lien-desk-footer="retainage" />
    : kind === 'notice' && footer ? (footInPane ? (noticeFootHome ? createPortal(noticeFooterStrip, noticeFootHome) : null) : noticeFooterStrip)
    : null
  const paneColumn = (node: ReactNode) => (footerHome.column ? <div data-lien-desk-pane-column style={footerHome.column}>{node}{paneFooter}</div> : node)
  return (
    <section aria-label="Lien desk" data-lien-desk-page style={{ display: 'contents' }}>
      <div style={panelStyle} data-lien-desk-panel="page">
        {/* v2.4355: the spacing between the title, the tabs and the doors is the class's column gap (no margins), so a desk narrower than 1,100 px can close it up. */}
        {/* v2.7322 (the owner's three boxes of 2026-11-15): on a computer the lines sit 6 px apart by the items' own 3 px block margins (`.lienDeskTitleBar > *` in index.css, `LIEN_DESK_TITLE_BAR_ROW_GAP_PX`) and the bar's row gap is 0, since a 0-height break on a line of its own took the old 7.2 px row gap twice; the bar's padding is 1 px over and 3 under, so with those margins the way back sits 4 px under the page's own 8, as close under the app's nav as the Jobs page's tabs, and the pile line 6 px over the border. A phone keeps its own rows. */}
        <div ref={titleBarRef} className="lienDeskTitleBar" data-lien-pane-open={paneOpenPhone ? paneOpenPhone.kind : undefined} style={{ position: 'relative', display: 'flex', alignItems: 'center', flexWrap: 'wrap', padding: isMobile ? '0.15rem 0.6rem 0.5rem' : '1px 1.25rem 3px', rowGap: isMobile ? '0.4rem' : 0, borderBottom: '1px solid var(--border)' }}>
          {/* The page's way back (punch list #182), before the title; stacked, an open notice's door back is the list. */}
          {noticeOpenStacked ? (
            <button type="button" onClick={onShowList} data-lien-desk-notices aria-label="Back to the notices" style={{ ...btn('plain'), display: 'inline-flex', alignItems: 'center', gap: 6, height: isMobile ? 44 : 30, marginRight: 8 }}>
              <span aria-hidden="true">←</span> Notices
            </button>
          ) : paneOpenPhone ? (
            <button type="button" onClick={() => setMobileListShown(true)} data-lien-desk-back-to-list={paneOpenPhone.kind} aria-label={paneOpenPhone.backLabel} style={{ ...btn('plain'), display: 'inline-flex', alignItems: 'center', gap: 6, height: 44, marginRight: 8 }}>
              <span aria-hidden="true">←</span> {paneOpenPhone.back}
            </button>
          ) : backDoor}
          <h2
            // On a phone the title shares its line with the way back and More (punch list #352, PR 1); the rows under it get the card's width.
            style={{ margin: 0, fontSize: '1.125rem', ...(isMobile ? { flex: '1 1 auto', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } : {}) }}
            title="Every unpaid work month on a job with a GC needs its own § 53.056 notice — the office readies and drafts, the leader approves once per GC or per notice, the run goes out and is recorded. The help guide “send lien notices from the Lien desk” has the whole flow."
          >
            <button type="button" className="lienDeskTitleDoor" data-lien-desk-title aria-label="Lien desk: open To do at the Board" onClick={() => { setKind('next'); setBoardBring((n) => n + 1) }}>
              ⏱ Lien desk
            </button>
          </h2>
          {isMobile ? (
            <button type="button" data-lien-desk-more="door" aria-haspopup="dialog" aria-expanded={moreOpen} aria-label={moreButton.label} onClick={() => setMoreOpen(true)} style={{ position: 'relative', flex: 'none', width: 44, height: 44, display: 'inline-grid', placeItems: 'center', border: 'none', borderRadius: 10, background: 'transparent', color: 'var(--text-700)', font: 'inherit', fontSize: '1.4rem', lineHeight: 1, cursor: 'pointer' }}>
              <span aria-hidden="true">⋯</span>
              {moreButton.badge != null ? <span aria-hidden="true" data-lien-desk-more-badge style={{ position: 'absolute', top: 2, right: 0, minWidth: 18, height: 18, padding: '0 5px', boxSizing: 'border-box', borderRadius: 999, background: '#2563eb', color: '#fff', fontSize: '0.7rem', fontWeight: 700, lineHeight: '18px', textAlign: 'center' }}>{moreButton.badge}</span> : null}
            </button>
          ) : null}
          {/* v2.4311: the tab row is 375 px of labels — on a phone it scrolls sideways inside the card instead of pushing the title bar (and ×, and Share) off the screen. v2.4441: a cut end fades, so Timeline past the edge is not a secret, and the picked tab is brought into view. */}
          {/* Four views: To do, By date, By paper, By job. The first three are punch list #82, PR 5 (named Next up, Calendar, All paper until v2.4630 and Do now, Deadlines, All filings until v2.7207, the owner's pick: the first is the work, the other two the same jobs sorted two ways; only To do carries a count). By paper holds the three papers' lists as a second row. By job is the list that was Timeline in that row until v2.7219, the owner's pick of 2026-11-13: it is every job's path, not a kind of paper. */}
          <div ref={kindTabs.ref} onScroll={kindTabs.onScroll} role="tablist" aria-label="View" data-lien-desk-kinds style={{ display: isMobile ? 'flex' : 'inline-flex', ...(isMobile ? { width: '100%' } : null), maxWidth: '100%', minWidth: 0, border: '1px solid var(--border-strong)', borderRadius: isMobile ? 9 : 7, overflowX: 'auto', overflowY: 'hidden', ...kindTabs.style }}>
            {(['next', 'calendar', 'paper', 'timeline'] as const).map((v) => {
              const on = v === 'paper' ? paperShown : kind === v
              return (
                <button key={v} type="button" role="tab" aria-selected={on} data-lien-desk-view={v} onClick={() => setKind(v === 'paper' ? lastPaperKind : v)} className="lienDeskKindTab" style={{ flexShrink: 0, whiteSpace: 'nowrap', border: 'none', background: on ? FILL.primary : 'var(--surface)', color: on ? '#fff' : 'var(--text-700)', fontSize: isMobile ? '0.875rem' : '0.78rem', fontWeight: 600, cursor: 'pointer', ...(isMobile ? PHONE_TAB : null) }} title={v === 'paper' ? 'Every monthly notice, lien affidavit and retainage notice by its state' : v === 'timeline' ? 'Every billed job with money open and a lien month — the whole path, sorted by the next date; Print the grid for counsel' : undefined}>
                  {v === 'next' ? `To do${data ? ` · ${lienNextUpCount(nextUpRows)}` : ''}` : v === 'calendar' ? 'By date' : v === 'paper' ? 'By paper' : 'By job'}
                </button>
              )
            })}
          </div>
          {/* In a window wide enough for both (v2.7213, the owner's screenshot at 1,846 px) the tools end the title line, pushed right: nothing is hidden and the bar loses its half-empty second line. */}
          {/* With room for the four presses but not the door too (v2.7277, the owner's screenshot at about 1,290 px) the presses end the line and the door slides under them, the right end of the second line. */}
          {titleBar.tools === 'title_line' ? (
            <span data-lien-desk-tools style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}>
              {titleBar.door === 'with_tools' ? ownerRecordsDoor : null}
              {headerTools}
            </span>
          ) : null}
          {/* § Rules and ☎ sit at the right with Share on a computer (v2.4618, the owner's ask); on a phone they stay in the flow under the title. */}
          {isMobile ? <LienRulesDoor button={false} open={rulesOpen} onOpenChange={setRulesOpen} where={kind === 'affidavit' ? 'desk_affidavit' : 'desk_notice'} job={rulesJob} todayYmd={todayYmd} /> : null}
          {isMobile && shareOpen && data ? (
            <LienDeskShare isMobile={isMobile} data={data} calendarRows={calendarRows} suppliers={suppliers.byJob} todayYmd={todayYmd} me={{ id: authUserId, name: authName }} onClose={() => setShareOpen(false)} />
          ) : null}
          {isMobile && moreOpen ? <LienDeskMoreSheet rows={moreRows} onPick={pickMore} onClose={() => setMoreOpen(false)} /> : null}
          {/* The second line (v2.3817): on By paper the paper tabs, then the piles, then Put a GC on notice at the right (v2.4740: the run moved up to the title line; v2.4786: the owner-records door too). Off By paper it holds the tool row on a computer (v2.6569), or the door on a phone. */}
          {/* The second line is the tool row on a computer whose title line has no room for the presses (v2.6569; a 1,540 px viewport rule until v2.7277), or the door's line when it has room for the presses alone (v2.7277); on a phone, and on a computer with room for all five (v2.7213), it comes only with the paper tabs — since v2.7311 it is always there on a computer with the door, ending with it, the pile line on By paper. */}
          {titleBar.breakLine ? (
            <span aria-hidden data-lien-desk-header-break style={{ flexBasis: '100%', height: 0 }} />
          ) : null}
          {/* With the tools up on the title line (v2.7213) the paper tabs are the tallest thing some kinds have here: 2px above and below keeps this line as tall as it is with the GC door, so the bar does not move between Notices and Affidavits. */}
          {paperShown ? (
            <div role="tablist" aria-label="Kind of paper" data-lien-desk-paper-kinds style={{ display: isMobile ? 'flex' : 'inline-flex', ...(isMobile ? { width: '100%' } : null), ...(titleBar.tools === 'title_line' ? { marginBlock: 2 } : null), maxWidth: '100%', minWidth: 0, border: '1px solid var(--border)', borderRadius: isMobile ? 9 : 7, overflowX: 'auto', overflowY: 'hidden' }}>
              {(['notice', 'affidavit', 'retainage'] as const).map((k) => (
                <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className="lienDeskKindTab" style={{ flexShrink: 0, whiteSpace: 'nowrap', border: 'none', background: kind === k ? 'var(--bg-blue-tint)' : 'var(--surface)', color: kind === k ? 'var(--text-blue-700)' : 'var(--text-700)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', ...(isMobile ? PHONE_TAB : null) }} title={k === 'notice' ? 'The § 53.056 notice — one for every unpaid month of work on a job with a GC' : k === 'affidavit' ? 'The § 53.052 affidavit, which is the lien itself — one per job' : 'The § 53.057 notice of claim for unpaid retainage — one per job, 30 days after our contract on it ends'}>
                  {k === 'notice' ? `Monthly notices${counts ? ` · ${entries.filter((e) => e.pile !== 'sent').length}` : ''}` : k === 'affidavit' ? `Lien affidavits${data ? ` · ${affCount}` : ''}` : `Retainage notices${data ? ` · ${retCount}` : ''}`}
                </button>
              ))}
            </div>
          ) : null}
          {/* The pile chips: in the header on a computer, one span so the pile line can be measured (v2.7311); on a phone a strip at the top of the list, where they scroll away with it (punch list #352, PR 1). The span's own wrapped rows keep the bar's 6 px (v2.7322), since the bar's row gap is 0 now. */}
          {!isMobile && (kind === 'retainage' || kind === 'affidavit') && (kind === 'retainage' ? retPileChips : affPileChips).length > 0 ? (
            <span data-lien-desk-piles style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', rowGap: LIEN_DESK_TITLE_BAR_ROW_GAP_PX, columnGap: 'inherit', minWidth: 0 }}>{kind === 'retainage' ? retPileChips : affPileChips}</span>
          ) : null}
          {/* v2.4672: the notice piles' chips became the stacked titles inside the list; `pile` still narrows (deep links, To do doors) and the title offers *every pile* (*show every pile* until v2.7434). */}
          {/* The right end of the second line (v2.4629): Put a GC on notice, then on a computer the owner-records door (on every view's second line since v2.7311) and the tools (v2.6569), in one span pushed right — into the title bar's right padding, so the tools end under × and not a toggle's width short of it. On a phone it holds the GC picker and the door. */}
          {/* Drawn only when it holds something (v2.7213): empty, it would still take a column gap and push the title line's tools off the edge. */}
          {/* The span ends the second line with the owner-records door on every view (v2.7311, the owner's ask); a pile line too narrow for the piles and the span together breaks here, so the span falls under the piles as one piece, right-aligned, by the measured rule and not by wrapping. */}
          {titleBar.pileBreak ? <span aria-hidden data-lien-desk-pile-break style={{ flexBasis: '100%', height: 0 }} /> : null}
          {titleBar.rightSpan ? <span data-lien-desk-right style={{ marginLeft: 'auto', marginRight: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '0.4rem 0.6rem', minWidth: 0 }}>
          {gcNoticeShown && onPutGcOnNotice ? (
            <div style={{ position: 'relative' }}>
              {isMobile ? null : <button type="button" onClick={() => setGcPickerOpen((o) => !o)} aria-haspopup="menu" aria-expanded={gcPickerOpen} style={{ ...btn('plain'), ...headDoor, background: 'var(--bg-amber-tint)', borderColor: 'var(--border-amber)', color: 'var(--text-amber-800)' }} title="Every owner on every job with a failing GC gets the § 53.056 notice for every unnoticed month, in one approved run">
                ⚠ Put a GC on notice…
              </button>}
              {gcPickerOpen ? (
                <>
                  <div onClick={() => setGcPickerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 5, ...(isMobile ? { background: 'rgba(15, 23, 42, 0.35)' } : null) }} />
                  <div role="menu" aria-label="GCs with unpaid work" data-lien-gc-picker style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 6, width: 'min(420px, calc(100vw - 4rem))', ...(isMobile ? { position: 'fixed', left: '0.75rem', right: '0.75rem', top: '16vh', width: 'auto' } : null), maxHeight: '70vh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.25)' }}>
                    <div style={{ padding: '0.45rem 0.75rem 0.35rem' }}>
                      <div style={boxHead}>Put a GC on notice</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>Notices due in the next {LIEN_DESK_LEAD_DAYS} days, most money first. The run covers every unpaid job with the GC, not only these.</div>
                    </div>
                    {gcPickerOptions.map((g, i) => {
                      const firstDead = g.nothingToClaim && (i === 0 || !gcPickerOptions[i - 1]!.nothingToClaim)
                      const closes = lienGcPickerCloseWords(g, formatYmdMonthDay)
                      const soon = g.daysLeft != null && g.daysLeft <= LIEN_GC_PICKER_URGENT_DAYS
                      return (
                        <Fragment key={g.id}>
                          {firstDead ? <div style={{ ...boxHead, padding: '0.35rem 0.75rem 0.25rem', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>Nothing left to claim</div> : null}
                          <button type="button" role="menuitem" data-lien-gc-option={g.id} data-nothing-to-claim={g.nothingToClaim ? 'yes' : 'no'} onClick={() => { setGcPickerOpen(false); onPutGcOnNotice(g.id) }} title={g.nothingToClaim ? 'Every window on this GC’s jobs here has closed — a run would send no notice; the money is Collections’ now' : undefined} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '2px 0.75rem', width: '100%', padding: '0.45rem 0.75rem', border: 'none', borderTop: '1px solid var(--border)', background: 'var(--surface)', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit', fontSize: '0.8125rem', opacity: g.nothingToClaim ? 0.65 : 1 }}>
                            <strong style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</strong>
                            <strong style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right', color: g.nothingToClaim ? 'var(--text-muted)' : undefined }}>{formatUsdNoCents(g.open)}</strong>
                            <span style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '3px 6px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              <span>{g.jobs} job{g.jobs === 1 ? '' : 's'}</span>
                              {closes ? <span style={{ color: soon ? 'var(--text-red-600)' : 'var(--text-amber-800)', fontWeight: 600 }}>· {closes}</span> : null}
                              {g.nothingToClaim ? (
                                <>
                                  <span style={chip('var(--bg-red-tint)', 'var(--text-red-700)')}>{g.closedMonths.length ? `${g.closedMonths.map(workMonthShort).join(' + ')} window${g.closedMonths.length === 1 ? '' : 's'} closed` : 'every window closed'}</span>
                                  <span>the lien is gone · chase it in Collections</span>
                                </>
                              ) : null}
                              {g.needOwner > 0 ? <span style={chip('var(--bg-amber-tint)', 'var(--text-amber-800)')}>{g.jobs === 1 ? 'needs the owner' : `${g.needOwner} need${g.needOwner === 1 ? 's' : ''} the owner`}</span> : null}
                              {g.awaiting > 0 ? <span style={chip('var(--bg-blue-tint)', 'var(--text-blue-700)')}>{g.jobs === 1 ? 'awaiting approval' : `${g.awaiting} awaiting approval`}</span> : null}
                              {g.missed > 0 && !g.nothingToClaim ? <span style={chip('var(--bg-red-tint)', 'var(--text-red-700)')}>{g.missed} missed</span> : null}
                              {g.policy === 'send' ? <span style={chip('var(--bg-subtle)', 'var(--text-muted)')}>rule: send</span> : null}
                            </span>
                          </button>
                        </Fragment>
                      )
                    })}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
          {titleBar.tools === 'second_line' || titleBar.door === 'second_line' ? ownerRecordsDoor : null}
          {titleBar.tools === 'second_line' ? headerTools : null}
          </span> : null}
          {legendOpen ? <DeskLegendCard legend={LIEN_DESK_LEGEND} phone={isMobile} onClose={() => setLegendOpen(false)} style={{ flexBasis: '100%', marginTop: '0.4rem' }} /> : null}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: oneColumn || kind === 'timeline' || kind === 'calendar' || kind === 'next' ? '1fr' : '320px 1fr', overflow: 'hidden', minHeight: 0 }}>
          {paperOpen != null && paperEntries.length > 0 ? (
            <LienPaperPreviewOverlay
              entries={paperEntries}
              index={paperOpen}
              onIndex={(i) => {
                setPaperFilledFrom(null)
                setPaperOpen(i)
              }}
              onClose={() => {
                setPaperFilledFrom(null)
                setPaperOpen(null)
              }}
              onAct={(i) => {
                const row = paperRows[i]
                setPaperOpen(null)
                if (row) actOnNextUp(row)
              }}
              onFix={office ? (i, gap) => {
                const w = lienPaperFixWindow(gap)
                if (w) setPaperFix({ index: i, window: w, gap })
              } : undefined}
              paused={paperFix != null}
            />
          ) : null}
          {paneFix && data && data.jobsById[paneFix.jobId] ? (() => {
            const fixJob = data.jobsById[paneFix.jobId]!
            const fixAddress = fixJob.customer_address_id ? data.addressesById[fixJob.customer_address_id] ?? null : null
            return (
              <LienPaperPropertyWindow
                job={fixJob}
                address={fixAddress}
                ownerOnJob={resolveLienProperty(fixAddress, data.ownerByJob[fixJob.id] ?? null).owner.source === 'job_override'}
                focus={paneFix.focus}
                onClose={(saved) => {
                  setPaneFix(null)
                  if (saved) onChanged()
                }}
              />
            )
          })() : null}
          {publicReview?.[0] ? (
            <LienPublicPropertyWindow
              key={publicReview[0]}
              addressId={publicReview[0]}
              zIndex={805}
              onClose={(answered) => {
                const rest = publicReview.slice(1)
                setPublicReview(rest.length ? rest : null)
                if (answered) onChanged()
              }}
            />
          ) : null}
          {publicPutBack ? (
            <LienPublicPutBackWindow
              addressId={publicPutBack}
              zIndex={805}
              onClose={(changed) => {
                setPublicPutBack(null)
                if (changed) onChanged()
              }}
            />
          ) : null}
          {paperFix && data ? (() => {
            const entry = paperEntries[paperFix.index]
            const row = paperRows[paperFix.index]
            const fixJob = row?.jobId ? data.jobsById[row.jobId] : undefined
            if (!entry || !fixJob) return null
            const done = (saved: boolean) => {
              setPaperFix(null)
              if (!saved) return
              // Every blank this paper had since the first fix, so a second window keeps the first one's green cards.
              setPaperFilledFrom((prev) => ({ key: entry.key, gaps: prev?.key === entry.key ? [...prev.gaps, ...entry.gaps.filter((g) => !prev.gaps.some((p) => p.key === g.key))] : entry.gaps }))
              onChanged()
            }
            if (paperFix.window === 'gc') return <LienPaperGcWindow job={fixJob} knownGcs={Object.values(data.gcsById)} onClose={done} />
            const fixAddress = fixJob.customer_address_id ? data.addressesById[fixJob.customer_address_id] ?? null : null
            return <LienPaperPropertyWindow job={fixJob} address={fixAddress} ownerOnJob={resolveLienProperty(fixAddress, data.ownerByJob[fixJob.id] ?? null).owner.source === 'job_override'} focus={paperFix.gap.key} onClose={done} />
          })() : null}
          {kind === 'next' ? (
            <div ref={doNowRef} data-lien-do-now={doNow.mode} style={doNow.frame}>
            {board ? <LienBoard board={board} isMobile={isMobile} onLayout={setBoardStacked} onChip={zoomTo} cardFor={chipCardFor} leader={leaderView ? { view: leaderView, mine: boardMine, onToggleMine: () => setBoardMine((v) => !v), onApprove: () => void approveTheLot(), busy: approvingLot } : undefined} pick={boardPick} shown={nextUpRowsShown.length} onPick={(key) => pickBoardBins(key ? [key] : null)} onTile={openBoardTile} prints={boardPrints ? { ...boardPrints, onPress: onBoardPrint, onLeft: onBoardPrintLeft, onNote: onBoardPrintNote } : null} over={publicLine ? <LienPublicBoardLineView line={publicLine} isMobile={isMobile} onReview={office && publicLine.addressIds.length ? () => setPublicReview(publicLine.addressIds) : null} /> : null} underAffidavits={publicBin ? <LienPublicBinView bin={publicBin} isMobile={isMobile} onPutBack={office ? setPublicPutBack : null} /> : null} /> : <div />}
            <LienDoNowBar pins={doNowBarPins} scrollerRef={doNowRef} parts={doNowBarParts} onPart={openBoardTile} pick={boardPick ? lienBoardPickWords(boardPick, nextUpRowsShown.length) : null} onClearPick={() => pickBoardBins(null)} prints={boardPrints && !(leaderView && boardMine) ? [boardPrints.notice, boardPrints.affidavit].flatMap((side) => (side ? [{ key: side.kind, label: side.short.label, left: side.short.left, dead: side.dead, onPress: () => onBoardPrint(side) }] : [])) : undefined}>
              <LienDeskFindBox value={find} onChange={setFind} matched={nextUpRowsShown.length} isMobile={isMobile} />
            </LienDoNowBar>
            <LienDeskNextUp scrolls={doNow.listScrolls} amountFor={phoneAmountFor} rows={nextUpRowsShown} markTitle={(t) => <LienFindMarked text={t} words={findWords} />} loading={loading && !data} isMobile={isMobile} onAct={actOnNextUp} onOpenJob={onOpenJob} zoomFor={(row) => (row.jobId ? zoomFor(row.jobId, row.kind === 'affidavit' ? 'affidavit' : row.kind === 'notice' ? 'notice' : 'either') : null)} foldsOpen={finding} waitingOn={nextUpWaitingOn} risk={rowRisk} riskLabel={riskLabel} stageFor={rowStage} noticeFor={rowNotice} byBin={board && !isMobile ? { binFor: rowBin, folds: lienBinFolds({ office, printReady: affPrintPlanAll.ready.length, printButton: lienAffidavitPrintDoorWords(affPrintPlanAll), sendReady: affSendPlanAll.ready.length }), narrowed: Boolean(boardPick) } : null} trackPress={office && !isMobile && affPrintPlanAll.ready.length >= 2 ? { button: lienAffidavitPrintDoorWords(affPrintPlanAll), onPress: () => { setAffHeldOnlyPicked(false); setAffPile('ready'); setKind('affidavit') } } : null} remind={office && reminderWords && waitingRows.length > 0 ? { button: reminderWords.button, dead: reminderWords.dead, busy: reminding, onPress: () => void remindLeader() } : null} factsFor={stepFactsFor} viewerIsLeader={leader} leadsRow={leadsRow} onOpenRow={isMobile ? openJobScreen : undefined} onOpenPaper={(row) => setPaperOpen(Math.max(0, paperRows.findIndex((r) => r.key === row.key)))} gapsFor={paperGapCount} />
            </div>
          ) : kind === 'calendar' ? (
            <LienDeskCalendarTab
              rows={calendarRows ?? null}
              supplierMarks={supplierMarks}
              todayYmd={todayYmd}
              isMobile={isMobile}
              canWrite={office}
              onOpenJob={(jobId) => (onOpenCalendarJob ?? onOpenLienInstruments)(jobId)}
              onOpenLastWork={office ? onOpenCalendarLastWork : undefined}
              onOpenJobWindow={onOpenJob}
              onZoomJob={(jobId) => zoomJob(jobId, 'either')}
              onOpenEditJob={(jobId) => onOpenEditJob(jobId, 'property-record')}
              onChanged={(what) => {
                onChanged()
                onCalendarChanged?.(what)
              }}
              // Record the mailing (v2.5522): the run opens on recording for the printed notices.
              onRecord={office ? () => setRunOpen(true) : undefined}
              onDraft={(ymd, jobIds) => {
                // Draft the N (v2.4153): the notice list, To draft, narrowed to the column's jobs.
                setCalendarJobFilter({ ymd, jobIds: new Set(jobIds) })
                setPile('to_draft')
                setKind('notice')
              }}
            />
          ) : kind === 'timeline' ? (
            <LienDeskTimelineTab
              book={book}
              loading={bookLoading}
              error={bookError}
              gcId={bookGcId}
              onGcId={setBookGcId}
              show={bookShow}
              onShow={setBookShow}
              onOpenRow={openBookRow}
              onOpenJob={onOpenJob}
              phone={isMobile}
              onPrint={(rows, title) => {
                // A print counts as a send (docs/SENT_COPIES.md): counsel's grid is filed on every job in it.
                printAndFile(lienGridHtml(rows, { title, todayYmd, companyName: issuer?.companyName ?? '' }), { kind: 'lien_grid', title, recipientName: 'Counsel', jobIds: rows.map((r) => r.jobId) })
              }}
            />
          ) : kind === 'affidavit'
            ? (oneColumn ? (mobileListShown ? withFind(affList, affVisible.length) : affPane) : (
                <>
                  {withFind(affList, affVisible.length)}
                  {paneColumn(affPane)}
                </>
              ))
            : kind === 'retainage'
              ? (oneColumn ? (mobileListShown ? withFind(retList, retVisible.length) : retPane) : (
                  <>
                    {withFind(retList, retVisible.length)}
                    {paneColumn(retPane)}
                  </>
                ))
            : oneColumn ? (mobileListShown ? withFind(list, visible.length) : pane) : (
            <>
              {withFind(list, visible.length)}
              {paneColumn(pane)}
            </>
          )}
        </div>
        {/* A phone's open paper (punch list #352, PR 6): one bar folds the footer away so the paper has the screen; the footer stays mounted, so what was typed in it is kept (`index.css`). */}
        {footFold ? (
          <button ref={footFoldRef} type="button" data-lien-desk-foot-fold aria-expanded={footFold.expanded} onClick={() => setFootFolded((v) => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', minHeight: 40, padding: '0 1.1rem', border: 'none', borderRadius: 0, borderTop: '1px solid var(--border-strong)', background: 'var(--bg-muted)', color: 'var(--text-700)', font: 'inherit', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
            <span>{footFold.words}</span>
            <span aria-hidden="true">{footFold.mark}</span>
          </button>
        ) : null}
        {footerHome.in === 'desk' ? paneFooter : null}
        {jobScreenRow ? (() => {
          const row = jobScreenRow
          const card = lienStepCard(row, stepFactsFor(row))
          const screen = lienJobScreen(row, card, { amount: phoneAmountFor?.(row) ?? null, gaps: paperGapCount(row), can: { paper: true, lienWindow: true, job: Boolean(onOpenJob) } })
          // The press is the row's button: the desk goes where it always went. A run or the Lien window opens over this screen, which stays behind it.
          const act = (r: LienNextUpRow) => {
            if (!onOpenRow && lienJobScreenClosesOnAct(r.target)) setRowLocal(null)
            actOnNextUp(r)
          }
          return (
            <LienDeskJobScreen
              row={row}
              screen={screen}
              card={card}
              onClose={closeJobScreen}
              onAct={() => act(row)}
              onSecondary={row.secondary ? () => act({ ...row, target: row.secondary!.target }) : undefined}
              onMoreDoor={row.doors?.length ? (i) => { const d = row.doors?.[i]; if (d) act({ ...row, target: d.target }) } : undefined}
              onDoor={(key) => {
                if (!row.jobId) return
                if (key === 'paper') setPaperOpen(Math.max(0, paperRows.findIndex((r) => r.key === row.key)))
                else if (key === 'lien_window') onOpenLienInstruments(row.jobId)
                else onOpenJob?.(row.jobId)
              }}
              onOpenJob={onOpenJob}
            />
          )
        })() : null}
      </div>
      {(() => {
        // The owner called (v2.3767 · v2.3854): from the Sent footer on the selected job, or from ☎ Someone's calling on any job with a sent notice.
        const callJobId = callerJobId ?? (ownerCallOpen && selected ? selected.jobId : null)
        if (!callJobId || !data) return null
        const lt = data.letterTwoByJob[callJobId]
        const first =
          (lt?.firstItemId ? data.items.find((i) => i.id === lt.firstItemId) : null) ??
          (selected?.jobId === callJobId ? selected.item : null) ??
          data.items.filter((i) => i.job_id === callJobId && i.status === 'sent' && !i.voided_at).sort((a, b) => (b.sent_at ?? '').localeCompare(a.sent_at ?? ''))[0] ??
          null
        if (!first) return null
        const cJob = data.jobsById[callJobId]
        const cGc = cJob?.gc_customer_id ? data.gcsById[cJob.gc_customer_id] : undefined
        const cAddress = cJob?.customer_address_id ? data.addressesById[cJob.customer_address_id] ?? null : null
        const facts = callLetterFactsFor({ item: first, job: cJob, gc: cGc, address: cAddress, owner: data.ownerByJob[callJobId] ?? null, us: callerUs, phone: signerPhoneFor ? signerPhoneFor(cJob?.master_user_id ?? null) : (issuer?.phone ?? '').trim() })
        const closeCall = () => {
          setOwnerCallOpen(false)
          setCallerJobId(null)
        }
        return (
          <LienOwnerCallDialog
            facts={facts}
            existing={data.ownerCallByJob[callJobId] ?? null}
            takerName={authName}
            busy={busy}
            onClose={closeCall}
            onSave={(c) => void run('Record the owner’s call', async () => noteOwnerCall(first, c), 'Recorded — the affidavit pile and the grid read it.').then((ok) => { if (ok) closeCall() })}
          />
        )
      })()}
      {courtesyCtx ? (
        <LienCourtesyWindow
          jobLabel={courtesyCtx.jobLabel}
          facts={courtesyCtx.facts}
          recipients={courtesyRecipients}
          busy={busy}
          onClose={() => setCourtesyCtx(null)}
          onSend={(greeting) =>
            void run('Send the courtesy notice', async () => {
              const r = await sendCourtesyNotice({ item: courtesyCtx.first, jobId: courtesyCtx.jobId, gcCustomerId: courtesyCtx.gcCustomerId, facts: courtesyCtx.facts, greeting, recipients: courtesyRecipients ?? [], by: { userId: authUserId, name: authName } })
              if (!r.record) throw new Error(courtesyOutcomeWords(r.to))
              if (r.recordError) {
                // The messages went and the record did not take (punch list #249, row 1): the window closes with the rest, and the footer offers the record alone.
                setCourtesyUnrecorded({ jobId: courtesyCtx.jobId, item: courtesyCtx.first, record: r.record, to: r.to, reason: r.recordError })
                showToast(courtesyUnrecordedWords(r.to, r.recordError), 'error')
                return
              }
              showToast(courtesyOutcomeWords(r.to), r.to.every((t) => t.ok) ? 'success' : 'error')
            }).then((ok) => {
              if (ok) setCourtesyCtx(null)
            })
          }
        />
      ) : null}
      {callScriptOpen ? (() => {
        const sel = selected ? callFactsFor(selected.jobId) : null
        return (
          <LienCallScriptModal
            facts={sel?.facts ?? null}
            jobLabel={selected ? jobLabel(job, selected.jobId) : null}
            hasLetter={Boolean(sel?.hasLetter)}
            us={callerUs}
            onRecord={() => {
              setCallScriptOpen(false)
              if (selected) setCallerJobId(selected.jobId)
            }}
            onFindJob={() => {
              setCallScriptOpen(false)
              window.setTimeout(() => document.querySelector<HTMLInputElement>('[data-testid="lien-desk-find-input"]')?.focus(), 0)
            }}
            onPractice={() => {
              setCallScriptOpen(false)
              setPracticeCallOpen(true)
            }}
            onClose={() => setCallScriptOpen(false)}
          />
        )
      })() : null}
      {practiceCallOpen ? (
        <LienOwnerCallDialog
          practice
          facts={practiceCallFacts({ us: callerUs, todayYmd, signer: signerNameFor(null), phone: signerPhoneFor ? signerPhoneFor(null) : (issuer?.phone ?? '').trim() })}
          existing={null}
          takerName={authName}
          busy={false}
          onClose={() => setPracticeCallOpen(false)}
          onSave={() => setPracticeCallOpen(false)}
        />
      ) : null}
      {runOpen && data ? (
        <LienDeskRunModal
          onPrinted={async (ids) => {
            await markLienDeskItemsPrinted(ids, authUserId).catch(() => undefined)
            onChanged()
          }}
          onTakeBack={async (ids) => {
            const n = await takeBackLienDeskItems(ids, { userId: authUserId, userName: authName || null })
            onChanged()
            return n
          }}
          onClosePaid={async (ids) => {
            const out = await closePaidLienDeskItems(ids, { userId: authUserId, userName: authName || null })
            onChanged()
            return out
          }}
          notices={[...buildLienDeskRun(lienRunEntriesFor(data.queue.piles.ready, data.queue.piles.printed, runGcId), data, issuer, signerNameFor, todayYmd, signerPhoneFor, { suppliers: suppliers.byJob, releases: releases.byId, inks, onDeviceNameFor: (id) => leaderNameFor?.(id) ?? '', leaderFor: (id) => ({ userId: id, name: signatureNameFor?.(id)?.trim() || (leaderNameFor?.(id) ?? '') }) }), ...buildLienRetainageRun(runGcId ? [] : data.retainage.piles.ready, data, issuer, signerNameFor, todayYmd, signerPhoneFor, { inks, onDeviceNameFor: (id) => leaderNameFor?.(id) ?? '', leaderFor: (id) => ({ userId: id, name: signatureNameFor?.(id)?.trim() || (leaderNameFor?.(id) ?? '') }) })]}
          stripeMode={authRole === 'dev' ? getBillingStripeModePref() : 'live'}
          issuer={issuer}
          todayYmd={todayYmd}
          userId={authUserId}
          onClose={() => {
            setRunOpen(false)
            setRunTakeBack(false)
            setRunGcId(null)
            setRunFocus(null)
          }}
          openOnTakeBack={runTakeBack}
          focusMailItemId={runFocus}
          onRecorded={onChanged}
          viewer={{ userId: authUserId, name: authName }}
        />
      ) : null}
    </section>
  )
}
