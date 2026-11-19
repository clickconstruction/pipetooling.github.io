import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { PhysicalInvoiceIssuer } from '../../lib/physicalInvoiceIssuer'
import type { LienDeskKind } from '../../lib/lien/lienDeskRoute'
import { buildLienAffidavitBlocks, buildLienNoticeBlocks, filingDocHtml, filingLetterheadFromIssuer, type FilingDocExtras, type FilingFieldMark, type LienNoticeFields } from '../../lib/jobsDocuments/lienFilingDocuments'
import { LIEN_NOTICE_FIELD_GUIDE, applyWordingEdits, noticeWordingDiff, wordingLineText, type LienNoticeFieldKey } from '../../lib/jobs/lienNoticePreview'
import { demandDate, demandMoney } from '../../lib/jobsDocuments/demandLetter'
import { signoffWords, type LegalSignoffState } from '../../lib/legal/legalAsks'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { LienRulesDoor } from './LienRulesDoor'
import { lienRulesJobFrom } from '../../lib/jobs/lienRulesDates'
import { buildLienGcPickerOptions } from '../../lib/jobs/lienDeskGcPicker'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { lienPropertyOwnerDisplayName, resolveLienProperty } from '../../lib/jobs/lienProperty'
import { workMonthLabel, workMonthShort, type JobWorkMonths } from '../../lib/jobs/forecastWorkMonths'
import {
  LIEN_DESK_PILES,
  draftReadiness,
  holdUntilFor,
  isLienLeader,
  isLienOffice,
  ruleWaitsOnFirstNotice,
  submitOutcome,
  type LienAskReason,
  type LienDeskPile,
  type LienNoticePolicy } from '../../lib/jobs/lienDesk'
import {
  holdLienDeskItem,
  pullBackLienDeskItem,
  LIEN_DRAFT_AUTOSAVE_MS,
  saveLienDeskDraft,
  sendLienDeskItemOnWord,
  setCustomerLienNoticePolicy,
  noteLienWindowMissed,
  submitLienDeskItem, tellLeaderOfLienApproval,
  startLetterTwo,
  noteOwnerCall,
} from '../../lib/jobs/lienDeskIo'
import { wordRecordPreview, type LienWordChannel } from '../../lib/jobs/lienWord'
import { type LienSignWay } from '../../lib/jobs/lienFooterMenu'
import { penWordApproval } from '../../lib/jobs/lienPenRecord'
import { shortDay as footShortDay } from '../../lib/jobs/lienFootChip'
import { clearLienSignatureToSignAgain, signLienDeskItem, signLienDeskItemWithCode, type LienDeskSignPayload } from '../../lib/jobs/lienDeskSignIo'
import { signAgainConfirmWords, signAgainDoneWords, signAgainHow, signAgainJobWords, signatureClearedOf, signatureClearedWords } from '../../lib/jobs/lienSignAgain'
import { lienCodeRefusalWords, lienCodeStatusStale, lienOtherScreen } from '../../lib/jobs/lienCodeSigner'
import { lienChipSigned, lienFieldsHash, lienItemUnsigned, lienNoticeSignatureFromRow, signatureColumnsOf, toFilingSignature } from '../../lib/jobs/lienNoticeSignature'
import { LienNoticeSignLine, type LienNoticeSignLineFrame, type LienNoticeSignLineHandle } from './LienNoticeSignLine'
import { useLienDeskSignatureInks } from '../../hooks/useLienDeskSignatureInks'
import { buildLienNoticeFieldsForJob, describeNoticeMonths, lienOriginalContractor, homesteadStatementApplies, parseLienDeskDraftFields, type LienDeskDraftFields } from '../../lib/jobs/lienNoticeDraft'
import type { LienDeskData } from '../../hooks/useLienDeskData'
import { useToastContext } from '../../contexts/ToastContext'
import { closePaidLienDeskItems } from '../../lib/jobs/lienDeskIo'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useLienJobSuppliers } from '../../hooks/useLienJobSuppliers'
import { getBillingStripeModePref } from '../../lib/billingStripeModePref'
import { buildLienDeskRun, buildLienRetainageRun, runCoverNoteBlocks, runDoorWords } from '../../lib/jobs/lienDeskRun'
import { lienRunProperties } from '../../lib/jobs/lienRunEnvelopeProperty'
import { LIEN_RUN_NOW_TO_PRINT } from '../../lib/jobs/lienRunWords'
import { affidavitMonthWordFor, counselCoverLetterTemplate, fillCoverLetter, letterTwoTemplate } from '../../lib/jobs/gcOnNotice'
import { LETTER_TWO_KINDS, letterTwoIsDue, type LetterTwoKind } from '../../lib/jobs/lienLetterTwo'
import { parsePaymentBond } from '../../lib/jobs/lienDeskRetainage'
import LienOwnerCallDialog from './LienOwnerCallDialog'
import LienCourtesyWindow from './LienCourtesyWindow'
import { formatErrorMessage } from '../../utils/errorHandling'
import { COURTESY_BUTTON, COURTESY_RECORD_AGAIN_BUTTON, courtesyMaySend, courtesyOutcomeWords, courtesyUnrecordedWords, type CourtesyFacts, type CourtesyRecord, type CourtesySent } from '../../lib/jobs/lienCourtesyNotice'
import { courtesyByJobFrom } from '../../lib/jobs/lienCourtesyDesk'
import { loadCourtesyRecipients, sendCourtesyNotice, writeCourtesyRecord, type CourtesyRecipient } from '../../lib/jobs/lienCourtesyIo'
import type { LienDeskItemRow } from '../../lib/jobs/lienDesk'
import { LienCallerDoor } from './LienCallerDoor'
import LienDeskCalendarTab from './LienDeskCalendarTab'
import { jobsWithMailPieces } from '../../lib/mail/lienMailPieces'
import { clearLienDeskItemPrinted, markLienDeskItemsPrinted, redrawLienDeskItem, takeBackLienDeskItems } from '../../lib/jobs/lienDeskIo'
import { takeBackNoticeConfirm, takeBackNoticeDoneWords } from '../../lib/jobs/lienRunTakeBack'
import { lienNoticeParted } from '../../lib/jobs/lienNoticeParted'
import { canRedrawItem, fieldsRedrawn, lienNoticePartedBand, lienNoticeRedrawConfirm, lienNoticeRedrawnToast, lienNoticeRedrawnWords, lienNoticeSignFields, redrawnLine, redrawnOf } from '../../lib/jobs/lienNoticeRedraw'
import LienOfferBox from './LienOfferBox'
import { lienOfferChipWords, lienOfferDayProblem, lienOfferFromItem, type LienPayOffer } from '../../lib/jobs/lienPayOffer'
import { setLienDeskItemOffer } from '../../lib/jobs/lienPayOfferIo'
import { lienRunEntriesFor, lienNextUpCount, type LienNextUpRow } from '../../lib/jobs/lienNextUp'
import { lienBoardChipFor, lienBoardDoorWords, lienBoardLeaderBinPress, lienBoardPickWords, lienBoardRowInPick, type LienBoardBinKey, type LienBoardChip, type LienBoardKind } from '../../lib/jobs/lienBoard'
import { lienBinFolds } from '../../lib/jobs/lienNextUpByBin'
import LienClosedWindow, { type LienClosedPaper } from './LienClosedWindow'
import { buildLienClosedWindow, lienClosedAnswerPress, lienClosedFacts } from '../../lib/jobs/lienClosedEnd'
import { LIEN_BOARD_USUAL_STACK, lienBoardAffidavitPrint, lienBoardMailNumbersPress, lienBoardNoticePrint, lienBoardSendDoor, lienBoardSignDoor, type LienBoardPrintSide } from '../../lib/jobs/lienBoardPrints'
import { lienPhoneAmounts } from '../../lib/jobs/lienPhoneRows'
import { useLienPileHeads } from './LienPileHeads'
import LienBoard, { type LienBoardBinPress } from './LienBoard'
import { lienScanTargetsFromDesk } from '../../lib/jobs/lienScanBatch'
import { lienServeJobsFromDesk, lienServeMailedJobsFromDesk, lienServePlan } from '../../lib/jobs/lienServePackets'
import { lienServeProofMissing } from '../../lib/jobs/lienServeNumbers'
import { lienDocKnownFromFilings } from '../../lib/jobs/lienDocNumber'
import { lienServeStage, lienServeStageCounts, lienServeStageDoorWords, type LienServeLanding } from '../../lib/jobs/lienServeStage'
import { LienPublicBinView, LienPublicBoardLineView } from './LienPublicBoardParts'
import { LienOffPathBinView } from './LienOffPathBoardParts'
import { EmptyState } from '../EmptyState'
import { lienDeskAimAddressJob, lienDeskAimFrom, lienDeskAimSpent, lienDeskOffListWords, readLienDeskAim, type LienDeskAim } from '../../lib/lien/lienDeskAim'
import { lienDeskJobLabel as jobLabel, lienDeskJobNumber as jobNumberOf, splitLienJobLabel } from '../../lib/jobs/lienJobLabel'
import { lienStepCard, lienStepDueWords, LIEN_STEP_LADDERS, lienStepOfRow, type LienStepFacts } from '../../lib/jobs/lienNextUpSteps'
import { lienJobScreen, lienJobScreenClosesOnAct } from '../../lib/jobs/lienPhoneJobScreen'
import { freshHtml, gapToken, lienPaperFilledSince, lienPaperFixWindow, lienPaperGaps, paintGaps, withFreshMarks, withGapTokens, type LienPaperFacts, type LienPaperFixWindow, type LienPaperGap } from '../../lib/jobs/lienPaperGaps'
import LienPaperPropertyWindow from './LienPaperPropertyWindow'
import LienPaperGcWindow from './LienPaperGcWindow'
import LienPaperPreviewOverlay, { type LienPaperPreviewEntry } from './LienPaperPreviewOverlay'
import { type LienStopPaper } from './LienStopPaperWindow'
import { affidavitStopPages, filingSnapshotPage, lienDeskAffidavitFieldsFor, retainageStopPages } from '../../lib/jobs/lienStopPaperPages'
import { LIEN_FILING_BATCH_WORDS, lienFilingDoorWords, lienFilingTargets } from '../../lib/jobs/lienFilingBatch'
import { lienStopPaperKind } from '../../lib/jobs/lienStopPaper'
import type { LienTimelineStep } from '../../lib/jobs/lienTimeline'
import type { JobLienFilingRow } from '../../lib/jobs/lienDeadlines'
import LienDeskNextUp from './LienDeskNextUp'
import { lienNoticeToldWords } from '../../lib/jobs/lienLeaderTold'
import LienDoNowBar from './LienDoNowBar'
import { useLienDeskBoard } from './useLienDeskBoard'
import type { LienCalendarJob } from '../../lib/jobs/lienCalendar'
import { callLetterFactsFor, callerIndex, findOnDesk, practiceCallFacts, type CallerMatchInput, type CallerOwnerHit } from '../../lib/jobs/lienCallerMatch'
import LienCallScriptModal from './LienCallScriptModal'
import { callScriptRecordsJob, genericCallFacts } from '../../lib/jobs/lienCallScript'
import { DEFAULT_CLAIMANT_NAME } from '../../lib/jobs/lienNoticeDraft'
import { lienNoticeOwedConfirmWords, lienNoticeToExtend } from '../../lib/jobs/lienNoticeOwed'
import { addMonthsToLienNotice } from '../../lib/jobs/lienNoticeOwedIo'
import { buildLienDeskAffidavitFields } from '../../lib/jobs/lienDeskAffidavitFields'
import { lienAffidavitFormForItem } from '../../lib/jobs/lienAffidavitForm'
import { lienAffidavitPrintDoorWords } from '../../lib/jobs/lienAffidavitBatch'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import LienDeskRunModal from './LienDeskRunModal'
import LienDeskShare from './LienDeskShare'
import { Share } from 'lucide-react'
import { useScrollEdgeFade } from '../../hooks/useScrollEdgeFade'
import { lienSupplierLetterParagraphFor, lienSupplierMark, type LienSupplierMark } from '../../lib/jobs/lienJobSuppliers'
import { conditionalReleaseParagraph, noticeReleaseFields, noticeReleaseFormType, noticeReleasePageHtml, noticeReleaseThroughDate } from '../../lib/jobs/lienNoticeRelease'
import { createNoticeReleaseDraft, refreshNoticeReleaseDraft, voidNoticeReleaseDraft, type NoticeReleaseDraftInput } from '../../lib/jobs/lienNoticeReleaseIo'
import { useNoticeReleases } from '../../hooks/useNoticeReleases'
import { LIEN_PANE_HEAD_H, LIEN_PANE_HEAD_H_PHONE, lienNoticeFootHead, lienPaneHeadsOverPages, lienPaneSections } from '../../lib/jobs/lienPaneSections'
import { useLienPaneHeads } from './useLienPaneHeads'
import { lienPhoneFootFold, lienPhoneFootStartsFolded, lienPhonePaneOpen, type LienPhoneFootProof } from '../../lib/jobs/lienPhonePane'
import { lienDeskFooterHome } from '../../lib/jobs/lienDeskFooterHome'
import LienDeskAffidavitPane from './LienDeskAffidavitPane'
import LienDeskRetainagePane from './LienDeskRetainagePane'
import { LienDeskAffidavitList } from './LienDeskAffidavitList'
import { LienDeskNoticeList } from './LienDeskNoticeList'
import { LienDeskNoticePane, type LienNoticePaneContext } from './LienDeskNoticePane'
import { LIEN_STRIP_COLLAPSE_PX as STRIP_COLLAPSE_PX } from './lienDeskPaneStyles'
import { LienDeskRetainageList } from './LienDeskRetainageList'
import { LIEN_HEAD_DOOR as headDoor, lienBtnStyle as btn } from './lienDeskButtonStyles'
import { LienDeskGcPicker } from './LienDeskGcPicker'
import { LienDeskPaperTabs, LienDeskViewTabs } from './LienDeskViewTabs'
import { LienDeskDraftFooter, type LienDraftFooterContext } from './LienDeskDraftFooter'
import { LienDeskAwaitingFooter, LienDeskHeldFooter, LienDeskPrintedFooter, LienDeskReadyFooter, type LienNoticeFooterContext } from './LienDeskLeaderFooters'
import { LienDeskSentFooter } from './LienDeskSentFooter'
import LienFilingMailProof from './LienFilingMailProof'
import { lienMailProof } from '../../lib/jobs/lienMailProof'
import { lienStopProof } from '../../lib/jobs/lienStopProof'
import { lienMailProofDoorPress, lienMailProofOwnerGap, lienMailProofServeLanding, type LienMailProofLanding, type LienMailProofOpeners } from '../../lib/jobs/lienMailProofDoor'
import { useLienCodeSigner } from './useLienCodeSigner'
import { useLienDeskPayPage } from './useLienDeskPayPage'
import { useLienDeskRunner } from './useLienDeskRunner'
import { useLienNoticePreview } from './useLienNoticePreview'
import { useLienWordingEditor } from './useLienWordingEditor'
import { useLienSentFooterForms } from './useLienSentFooterForms'
import { lienSentPacketFacts } from '../../lib/jobs/lienSentPacket'
import { useLienDeskTitleBarFit } from './useLienDeskTitleBarFit'
import { useLienDeskWindows } from './useLienDeskWindows'
import { LienDeskWindows } from './LienDeskWindows'
import { useLienDeskAffidavits } from './useLienDeskAffidavits'
import { lienBoxHeadStyle as boxHead, lienRowChipStyle as chip } from './lienDeskRowStyles'
import { LIEN_RETAINAGE_PILES, lienRetainageListView, type LienRetainagePile } from '../../lib/jobs/lienDeskRetainage'
import LienPageExportPresses from './LienPageExportPresses'
import { isLienExportPageKey, lienExportDraftLine, lienExportFileName, lienExportFiling, lienExportTitle } from '../../lib/jobs/lienPageExport'
import { lienPageExportBlob } from '../../lib/jobs/lienPageExportIo'
import LienDeskFindBox, { LienFindMarked } from './LienDeskFindBox'
import { LegendButton } from '../help/LegendButton'
import LienDeskMoreSheet from './LienDeskMoreSheet'
import LienDeskJobScreen from './LienDeskJobScreen'
import { lienDeskMoreButton, lienDeskMoreRows, type LienDeskMoreKey } from '../../lib/jobs/lienDeskPhoneMore'
import { LIEN_DESK_HINT, LIEN_DESK_NAME, LIEN_DESK_TITLE_BAR_ROW_GAP_PX, lienDeskFirstTab, lienDeskTitleBarLayout } from '../../lib/jobs/lienDeskTitleBar'
import { DeskLegendCard } from '../help/LegendCard'
import { LIEN_DESK_LEGEND } from '../../lib/jobs/lienDeskLegend'
import { lienFindMatch, lienFindSingle, lienFindWords, type LienFindFact, type LienFindFacts } from '../../lib/jobs/lienDeskFind'
import { type LienDeskMonthCard } from './LienDeskMonths'
import LienNoticeAlreadyWent from './LienNoticeAlreadyWent'
import LienPenSignaturePane from './LienPenSignaturePane'
import { buildLienMonthGrid } from '../../lib/jobs/lienMonthGrid'
import { buildLienTimelineFromDesk, lienRetainageClockFromDesk } from '../../lib/jobs/lienTimelineDesk'
import { bringLienFooterUp } from './lienFooterFocus'
import type { LienNextAct, LienNextActDoor } from '../../lib/jobs/lienNextAct'
import LienDeskTimelineTab from './LienDeskTimelineTab'
import { buildLienProperties } from '../../lib/jobs/lienPropertyPapers'
import type { LienBookGroup } from '../../lib/jobs/lienPropertyGroups'
import { useLienTimelineBook } from '../../hooks/useLienTimelineBook'
import { useZzTestJobsHidden } from '../../lib/jobs/zzTestJobSwitch'
import { lienGridHtml, type LienBookShow, type LienTimelineBookRow } from '../../lib/jobs/lienTimelineBook'
import { printAndFile } from '../../lib/sent/sentCopiesIo'
import { lienStripChips, type LienStripChipAct, type LienStripChipTone } from '../../lib/jobs/lienStripChips'
import { buildLienDeskGates, lienSentGatesFold, type LienGate, type LienGateKey } from '../../lib/jobs/lienDeskGates'
import { lienBillsCountWords } from '../../lib/jobs/lienClaimBills'
import { useBillCustomerModal } from '../../contexts/BillCustomerModalContext'
import { claimDeltaWords, claimSplit, claimSplitWords, correctedClaim, correctionSendGate, correctionSetWords } from '../../lib/jobs/lienClaimCorrection'
import { propertyKindWords, type PropertyKind } from '../../lib/jobs/propertyKind'
import { savePropertyKind } from '../../lib/jobs/propertyKindWrite'
import { LIEN_AFFIDAVIT_PILES, lienOwnerIsPublic, type LienAffidavitPile } from '../../lib/jobs/lienDeskAffidavits'

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
  /** A stop window's card (`lienMailProofDoor.ts`): the job's Lien window, landed on the copy that lacks its number or receipt. Absent, a card has no press for those. */
  onOpenLienProof?: (landing: LienMailProofLanding) => void
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
  /** The records window for an owner who asks for our records on their property (v2.4544): on a computer the last row of the window ☎ opens (v2.7780), on a phone a row of More. Handed the job of the paper open in By paper's pane, and none from any other view. */
  onOpenOwnerRecords?: (jobId?: string | null) => void
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
  /** The property card, opened over the desk by its address (v2.7488): `?property=<property record id>`; `key` re-opens it on the same record. */
  openProperty?: { addressId: string; key: number } | null
  /** Add the stamped scans, opened over the desk by its address (punch list #366): `?scans=1`; `key` re-opens it. */
  openScans?: { key: number } | null
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

/**
 * The title bar's doors share § Rules' height (v2.4746, the owner's ask): its 0.78rem line at the root's 1.5, 2px of
 * padding above and below, and the 1px border. Send the run, Put a GC on notice…, ☎ and Share (on a computer) take it.
 */
const PHONE_CHIP: React.CSSProperties = { flex: 'none', minHeight: 40, padding: '2px 14px', fontSize: '0.875rem', whiteSpace: 'nowrap' }
/** The page labels (v2.4726) stack like the Notices list's pile titles (v2.4651): one bar each, as tall as the pane's heads (one number since v2.7323). */
const PAGE_LABEL_H = LIEN_PANE_HEAD_H
/** The paper stays light in both themes — `data-theme="light"` re-pins the tokens and the text color (index.css). */

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
  onOpenLienProof,
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
  openProperty: openPropertyDoor,
  openScans: openScansDoor,
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
  const [holdOpen, setHoldOpen] = useState<'promised' | 'call_first' | null>(null)
  const [rulePick, setRulePick] = useState<LienNoticePolicy | null>(null)
  // The leader's one-screen approve on a phone (v2.4881): the facts fold under Details; Not yet opens the hold reasons.
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [notYetOpen, setNotYetOpen] = useState(false)
  // Autosave (v2.7327): the draft row is written about 800 ms after a change to the months, the cover box, the wording,
  // the pay lines, the enclosed release or the claim — never on open, never when nothing changed. `draftTouch` counts
  // the changes; a forward press cancels the wait and saves first, after any save in flight, so no second row is made.
  const [draftTouch, setDraftTouch] = useState(0)
  const [draftSave, setDraftSave] = useState<'idle' | 'saving' | 'saved'>('idle')
  const draftIdRef = useRef<string | null>(null)
  const autosaveRef = useRef<Promise<void> | null>(null)
  const autosaveTimerRef = useRef<number | null>(null)
  // One press at a time (`useLienDeskRunner`, v2.7590): `busy` deadens every press while one is in flight.
  const { busy, busyRef, run } = useLienDeskRunner({
    onChanged,
    // A press saves first (v2.7327): the wait for the autosave is dropped, and its save in flight is awaited inside ensureDraft.
    beforeRun: () => {
      if (autosaveTimerRef.current != null) {
        window.clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
    },
  })
  const touchDraft = () => setDraftTouch((n) => n + 1)
  const [mobileListShown, setMobileListShown] = useState(true)
  // A phone's open paper: the footer folded to one bar so the paper has the screen (punch list #352, PR 6).
  const [footFolded, setFootFolded] = useState(false)
  // The pile titles stack as the Notices list scrolls (v2.4672): the list's scroller, and the pile the reader is in.
  // Wording (v2.3522): the four typed values the office may shape, layered over the draft; the paper-first pane's scroll state.
  const [wordingEdits, setWordingEdits] = useState<Partial<LienNoticeFields>>({})
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
  // A ready notice's Just this one (v2.7512) opens the run on that one notice, by its desk item; null is the run's own list.
  const [runOnlyItemId, setRunOnlyItemId] = useState<string | null>(null)
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
      // v2.7744: so does a door onto the other two lists, and the job it names is the aim, so a list that does not
      // hold it keeps the row picked before from standing under an address that names another job.
      else if (initialKind === 'retainage') setRetSelectedJobId(initialJobId)
      else if ((initialKind ?? 'notice') === 'notice') setSelectedJobId(initialJobId)
      setAim(lienDeskAimFrom(initialKind ?? 'notice', initialJobId))
    }
  }, [initialJobId, initialKind, aimKey])
  // The job the address names on a paper list (v2.7744, `lienDeskAim.ts`): kept until its list holds it, the reader
  // picks another row or leaves the list. While the list does not hold it, no job opens there.
  const [aim, setAim] = useState<LienDeskAim | null>(() => lienDeskAimFrom(initialKind ?? 'notice', initialJobId))
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
  // The book is handed the affidavits' desk items beside the notices' (v2.7488). `data.items` is the notices alone, so
  // the book built its affidavit queue with no drafted or approved paper in it and By job read *Draft the affidavit*
  // of one already approved.
  const bookItems = useMemo(() => (data ? [...data.items, ...data.affidavits.entries.flatMap((e) => (e.item ? [e.item] : []))] : null), [data])
  const { book, loading: bookLoading, error: bookError } = useLienTimelineBook(bookOpened, todayYmd, bookItems, hideZzTestJobs)
  // One property whole (v2.7488): every job at one property record, out of By job's book. The desk's own read holds
  // only what is started or inside its lead, so the card reads the book (once, kept) the first time it opens.
  // A job's entry in the desk's own queues wins over the book's (`LienPropertyDesk`): the card says what the Board says.
  const bookProperties = useMemo(() => (book ? buildLienProperties(book.rows, { notices: data?.queue.entries, affidavits: data?.affidavits.entries }) : []), [book, data])
  const [propertyCard, setPropertyCard] = useState<{ addressId: string; fromJobId: string | null } | null>(null)
  // The run's envelopes say where the other jobs at their properties stand (v2.7559), from the desk's own queues: no
  // read of the book is waited for. The card the line opens reads the book, which looks further back than the desk.
  const runProperties = useMemo(() => (data ? lienRunProperties({ jobsById: data.jobsById, addressesById: data.addressesById, notices: data.queue.entries, affidavits: data.affidavits.entries, filingsByJob: data.filingsByJob }) : null), [data])
  const [bookGroup, setBookGroup] = useState<LienBookGroup>('none')
  const openProperty = useCallback((addressId: string, fromJobId: string | null = null) => {
    setBookOpened(true)
    setPropertyCard({ addressId, fromJobId })
  }, [])
  useEffect(() => {
    if (openPropertyDoor) openProperty(openPropertyDoor.addressId)
  }, [openPropertyDoor, openProperty])
  const [affPile, setAffPile] = useState<LienAffidavitPile | null>(null)
  // The print bar's amber press (v2.7209): the list narrowed to the ready papers a gate holds out of the print.
  const [affHeldOnlyPicked, setAffHeldOnlyPicked] = useState(false)
  const confirmDialog = useConfirmDialog()
  // The retainage kind (v2.3753): the one § 53.057 notice per job with recorded retainage.
  const [retPile, setRetPile] = useState<LienRetainagePile | null>(null)
  // The address can name the retainage notice to open on (v2.7478), as it names an affidavit: `/lien-desk?tab=retainage&job=…`.
  const [retSelectedJobId, setRetSelectedJobId] = useState<string | null>(initialKind === 'retainage' ? (initialJobId ?? null) : null)
  // The job a To do row opened *Looks held · not on the job* for: its row there is ringed.
  const [retUnrecordedFocus, setRetUnrecordedFocus] = useState<string | null>(null)
  const [retFooterEl, setRetFooterEl] = useState<HTMLDivElement | null>(null)
  // Letter two (v2.3760): the sent footer's two doors — the GC's written okay, and the second letter.
  const [letterTwoMenu, setLetterTwoMenu] = useState(false)
  // The sent footer's three inline forms (`useLienSentFooterForms`, v2.7591): the GC's okay, the ask to counsel, and what they promised for the rest.
  const sentForms = useLienSentFooterForms()
  const { setSignoffOpen, setSignoffText, setGcOkayOpen, setGcOkayNote, setPromiseOpen, setPromiseYmd, setPromiseAmount, setPromiseNote } = sentForms
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
  // Where the aim stands (v2.7744): each list is every job it holds, whatever pile or find narrows what is drawn.
  const aimLists = useMemo(
    () => ({ notice: (data?.queue.entries ?? []).map((e) => e.jobId), affidavit: (data?.affidavits.entries ?? []).map((e) => e.jobId), retainage: (data?.retainage.entries ?? []).map((e) => e.jobId) }),
    [data],
  )
  const aimRead = readLienDeskAim({ aim, kind, picked: aim?.kind === 'affidavit' ? affSelectedJobId : aim?.kind === 'retainage' ? retSelectedJobId : selectedJobId, loaded: data != null, lists: aimLists })
  /** The address named a job the list in view does not hold: no job opens, and the note stands in the pane's place. */
  const offList = aimRead.state === 'off_list' ? aimRead : null
  const aimSpent = aim != null && lienDeskAimSpent(aimRead)
  useEffect(() => {
    if (aimSpent) setAim(null)
  }, [aimSpent])
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
  const [calendarJobFilter, setCalendarJobFilter] = useState<{ ymd: string; jobIds: ReadonlySet<string>; words?: string } | null>(null)
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

  const noticeOffList = offList?.kind === 'notice'
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
    // The address names a job this list does not hold (v2.7744): the first row is not opened in its place.
    if (noticeOffList) return
    if (doorPickedJobId.current && visible.some((e) => e.jobId === doorPickedJobId.current)) {
      doorPickedJobId.current = null
      return
    }
    doorPickedJobId.current = null
    if (selectedJobId && visible.some((e) => e.jobId === selectedJobId)) return
    setSelectedJobId(!oneColumn && visible[0] ? visible[0].jobId : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stacked, initialJobId, noticeOffList, visible.map((e) => e.jobId).join('|')])

  const selected = visible.find((e) => e.jobId === selectedJobId) ?? entries.find((e) => e.jobId === selectedJobId) ?? null
  useEffect(() => setStopOpen(null), [selectedJobId])
  // The page's address (punch list #182): the view, and on Monthly notices the open notice and the pile. The notice a door named
  // counts before the selection catches up to it, so a pasted `&job=` is never dropped on the way in; the callback is read
  // through a ref so a changed callback alone never rewrites the address.
  const onAddressChangeRef = useRef(onAddressChange)
  onAddressChangeRef.current = onAddressChange
  // v2.7744: while the note for a job off its list stands, the address keeps that job on any of the three lists, so a
  // reload says the same thing; a picked row or another view writes its own, as before.
  const addressJob = lienDeskAimAddressJob(aimRead) ?? (kind === 'notice' ? (selectedJobId ?? (initialJobId && entries.some((e) => e.jobId === initialJobId) ? initialJobId : null)) : null)
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
  // Which filed liens' copies were printed (`lienServeStage.ts`): the desk's read, and what the copies window printed since.
  // Every door to those copies reads its stage's name from this: *Print the copies to mail*, then *Enter mail numbers*.
  const [servePrintedNow, setServePrintedNow] = useState<string[]>([])
  const servePrintedRead = data?.servePrintedFilingIds
  const servePrinted = useMemo(() => new Set([...(servePrintedRead ?? []), ...servePrintedNow]), [servePrintedRead, servePrintedNow])
  // Filed affidavits not yet served (§ 53.055): To do's record-service rows.
  const serveDue = useMemo(
    () =>
      data
        ? Object.values(data.filingsByJob)
            .flat()
            .filter((f) => f.kind === 'affidavit' && f.filed_at && !f.served_at && !f.voided_at && f.serve_due)
            .map((f) => ({ jobId: f.job_id, serveDue: f.serve_due as string, stage: lienServeStage(f, servePrinted) }))
        : [],
    [data, servePrinted],
  )
  // The same filings with where each envelope goes today, for the window that serves them together (punch list #366). No read of its own.
  const serveJobs = useMemo(() => (data ? lienServeJobsFromDesk(data) : []), [data])
  // The mailed liens that window still shows (v2.7846): its tick saves itself, so a lien ticked on one envelope's number stays until both have a number and a receipt.
  const serveMailedJobs = useMemo(() => (data ? lienServeMailedJobsFromDesk(data, lienServeProofMissing) : []), [data])
  // Every filed lien's document number, for the check on one typed in that window (`lienDocNumber.ts`).
  const docKnown = useMemo(() => (data ? lienDocKnownFromFilings(data.filingsByJob, (jobId) => jobLabel(data.jobsById[jobId], jobId)) : []), [data])
  // Back from the clerk (v2.7856): the liens in Ready to file, each with the paper the desk draws for it, for the office that records a filing.
  const filingTargets = useMemo(
    () =>
      data && office
        ? lienFilingTargets({
            entries: data.affidavits.entries,
            jobNumber: (jobId) => jobNumberOf(data.jobsById[jobId], jobId),
            jobLabel: (jobId) => jobLabel(data.jobsById[jobId], jobId),
            fieldsFor: (jobId) => lienDeskAffidavitFieldsFor({ data, jobId, issuer, signerNameFor, todayYmd }) as Record<string, unknown> | null,
          })
        : [],
    [data, office, issuer, signerNameFor, todayYmd],
  )
  const filingsDoor = lienFilingDoorWords(filingTargets.length)
  // Every filed affidavit a scan can go to, for the window that takes several at once (punch list #366). No read of its own.
  const scanTargets = useMemo(() => (data ? lienScanTargetsFromDesk(data) : []), [data])
  // The door to that window, as the Board's bin and the list's folded row say it, named for the stage the copies are at:
  // *Print 9 liens’ copies ›* with none printed, *Enter mail numbers · 12 ›* with all, and both halves named with some of each. Null with none.
  const serveDoorAt = useMemo(() => lienServeStageDoorWords(lienServeStageCounts(lienServePlan(serveJobs, { todayYmd, phone: issuer?.phone ?? '' }), servePrinted)), [serveJobs, todayYmd, issuer?.phone, servePrinted])
  const serveDoor = serveDoorAt?.label ?? ''
  // By date (v2.7571): the To do rows, the Board, its picks, the leader's press and the reminder live in `useLienDeskBoard`.
  const {
    nextUpRows,
    leadsRow,
    board,
    publicLine,
    publicBin,
    offPathBin,
    leaderView,
    signSplit,
    approvingLot,
    approveTheLot,
    boardPick,
    rowRisk,
    rowStage,
    rowBin,
    rowNotice,
    chipCardFor,
    riskLabel,
    setBoardStacked,
    doNowRef,
    doNow,
    doNowBarPins,
    doNowBarParts,
    pickBoardBins,
    openBoardTile,
    bringBoard,
    nextUpWaitingOn,
    waitingRows,
    reminderPlan,
    reminding,
    reminderWords,
    remindLeader,
  } = useLienDeskBoard({
    data,
    todayYmd,
    authRole,
    authUserId,
    leaderNameFor,
    leader,
    office,
    shown: kind === 'next',
    oneColumn,
    courtesyByJob,
    serveDue,
    serveJobs,
    onChanged,
    onOpenRun: () => {
      setRunTakeBack(false)
      setRunOpen(true)
    },
  })
  // The windows the Board raises (v2.7588): serve, scans, the public review and its put-back, and a job's lien path.
  const windows = useLienDeskWindows(openScansDoor)
  const { setJobPath, setPublicReview, setServeOpen, setPublicPutBack } = windows
  // The paper behind a To do chip (v2.4632): the notice or the affidavit as it stands, every statutory blank marked.
  const [paperOpen, setPaperOpen] = useState<number | null>(null)
  // A stop's paper (v2.4793): the index of the timeline stop whose window is open on the notice pane; null when closed.
  const [stopOpen, setStopOpen] = useState<number | null>(null)
  const paperRows = useMemo(() => nextUpRows.filter((r) => r.jobId && r.kind !== 'retainage'), [nextUpRows])
  // Fix it from the paper (v2.4719): the window stacked over the paper, and the blanks the row had when it opened.
  const [paperFix, setPaperFix] = useState<{ index: number; window: LienPaperFixWindow; gap: LienPaperGap } | null>(null)
  // The affidavit pane's gate doors open the same window over the desk (v2.4724).
  const [paneFix, setPaneFix] = useState<{ jobId: string; focus: 'owner' | 'owner_address' | 'legal' | 'homestead_answer' } | null>(null)
  // The copy a stop window's card opened the copies window on (`lienMailProofDoor.ts`); forgotten when that window closes.
  const [serveLand, setServeLand] = useState<LienServeLanding | null>(null)
  /** The copies window from the bin's press or the folded row: opened on the half its name says. */
  const openFilings = () => windows.setFilingsOpen(true)
  const openServeAll = () => {
    // A door that names both halves opens the window at its top, where both are in reach.
    setServeLand(serveDoorAt?.stage === 'record' ? { part: 'numbers' } : serveDoorAt?.stage === 'print' ? { part: 'print' } : null)
    setServeOpen(true)
  }
  /**
   * A door to one filed lien's copies (a To do row, the band, the pane's footer), landed on the half its name says
   * (`lienServeStage.ts`). Printed: the copies window at that job's line, the cursor in its number. Still to print: the
   * copies window's print half when two or more liens are owed, since one stack serves them all (punch list #366), and
   * the job's own **Print the copies to mail** press when it is the only one. Anyone but the office opens the Lien window.
   */
  const openServeFor = (jobId: string) => {
    const lien = office ? serveJobs.find((j) => j.jobId === jobId) : undefined
    if (lien && lienServeStage(lien.filing, servePrinted) === 'record') {
      setServeLand({ part: 'numbers', jobId, recipient: 'owner', cursor: true })
      setServeOpen(true)
    } else if (lien && serveJobs.length >= 2) {
      setServeLand({ part: 'print' })
      setServeOpen(true)
    } else if (lien && onOpenLienProof) onOpenLienProof({ jobId, filingId: lien.filing.id, paper: 'affidavit', recipient: 'owner', lack: 'print' })
    else (onOpenLienAffidavit ?? onOpenLienInstruments)(jobId)
  }
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
    // Not lienable… (v2.7526): a held row's quiet door opens the window that takes this one job off the lien path. It is
    // read first, since the row it stands on is a held affidavit's, whose own press goes to the property record.
    if (t.open === 'job_path') {
      setJobPath(t.jobId)
      return
    }
    // A held affidavit's press answers its one question (v2.7372): the property record opens at the missing line, as
    // the job's chip on the Board does. A paper whose fact is not on the property record opens its pane, as before.
    if (row.action === 'fix_property' && row.button && row.jobId && board && office) {
      const chip = lienBoardChipFor(board, row.jobId, 'affidavit')
      if (chip?.destination.kind === 'property') {
        setPaneFix({ jobId: chip.destination.jobId, focus: chip.destination.focus })
        return
      }
    }
    // A filed lien's copies: the row lands on the half its press names (`openServeFor`). The folded row opens the window for them all.
    if (row.action === 'record_service' && t.open !== 'serve_copies' && row.jobId) {
      openServeFor(row.jobId)
      return
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
    } else if (t.open === 'serve_copies') {
      openServeAll()
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
    } else if (t.open === 'retainage_unrecorded') {
      // Retainage nobody recorded: the Retainage list whole, with nothing typed in the find box, at this job's row above the piles.
      setKind('retainage')
      setRetPile(null)
      setFind('')
      setRetUnrecordedFocus(t.jobId)
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
  // The closed end's window (`LienClosedWindow`): the papers it walks, and the one it opened on.
  const [closedWalk, setClosedWalk] = useState<{ jobIds: string[]; start: string } | null>(null)
  const closedBinJobs = (bin: LienBoardBinKey): string[] => (board ? [...board.notices, ...board.affidavits].find((b) => b.key === bin)?.chips.map((c) => c.jobId) ?? [] : [])
  /** One job as the window needs it, off the rows the desk holds; null once the job is at no closed end. */
  const closedPaperFor = (jobId: string): LienClosedPaper | null => {
    if (!data) return null
    const closedJob = data.jobsById[jobId]
    const notice = data.queue.entries.find((e) => e.jobId === jobId) ?? null
    const affidavit = data.affidavits.entries.find((e) => e.jobId === jobId) ?? null
    if (!closedJob || (!notice && !affidavit)) return null
    const gcId = closedJob.gc_customer_id ?? notice?.gcCustomerId ?? affidavit?.gcCustomerId ?? null
    const facts = lienClosedFacts({
      number: effectiveJobLedgerNumber(closedJob.hcp_number, closedJob.click_number) || '—',
      name: closedJob.job_name ?? '',
      gcName: gcId ? (data.gcsById[gcId]?.name ?? '') : '',
      unpaid: affidavit?.openBalance ?? notice?.openBalance ?? 0,
      notice,
      affidavit,
      collectionsSince: closedJob.collections_at,
      status: closedJob.status,
      role: authRole,
      lastWorkDoor: Boolean(onOpenCalendarLastWork),
    })
    return buildLienClosedWindow(facts) ? { jobId, facts, gcCustomerId: gcId, customerId: closedJob.customer_id ?? null } : null
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
    } else if (d.kind === 'closed') {
      // A chip at a closed end opens the window that says what closed and asks what to do; it walks its bin from this paper.
      setClosedWalk({ jobIds: closedBinJobs(chip.bin), start: d.jobId })
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
  // His signing code on someone else's screen (`useLienCodeSigner`, v2.7611).
  const { codeSigner, codeReady, codeProblem, setCodeProblem, refreshCodeStatus } = useLienCodeSigner({ otherScreen, masterId, leaderName, jobId: selected?.jobId })
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
  // The date too, until the paper is signed (v2.7520): a notice not yet signed is dated the day it is read, so the form
  // carries the day the leader signs it and never the day a draft was first made. A signed, printed or sent paper keeps its own.
  const paperDateStands = useMemo(() => {
    const it = selected?.item
    if (!it || it.status === 'drafted') return false
    if (it.status === 'sent' || it.status === 'missed' || (it as { printed_at?: string | null }).printed_at) return true
    return lienChipSigned(signatureColumnsOf(it), lienFieldsHash(it.fields)) !== 'unsigned'
  }, [selected?.item])
  const noticeFields = useMemo(
    () => applyWordingEdits({ ...(storedDraft?.notice ?? jobDefaults), ...(paperDateStands ? {} : { noticeDate: jobDefaults.noticeDate }), claimAmount: jobDefaults.claimAmount, ...(jobDefaults.claimSplit ? { claimSplit: jobDefaults.claimSplit } : { claimSplit: undefined }), ...(jobDefaults.retainageIncluded ? { retainageIncluded: jobDefaults.retainageIncluded } : { retainageIncluded: undefined }) }, wordingEdits),
    [storedDraft, jobDefaults, wordingEdits, paperDateStands],
  )
  // The stored paper beside the bills (v2.7517's rule, read on the desk since v2.7520): past a draft, the row keeps the paper
  // as it was sent for approval while this pane draws today's figures. When they differ the band over the paper says so.
  const paneParted = useMemo(
    () => (item && item.status !== 'drafted' && storedDraft ? lienNoticeParted(storedDraft.notice, jobDefaults, claimed.corrected ? 'hand' : 'bills') : null),
    [item, storedDraft, jobDefaults, claimed.corrected],
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
          : g.key === 'noticeDate' ? 'The day it is signed — nothing to change'
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
  // Sign it again (v2.7502): an approved notice with its last signature cleared says so under the paper until it is signed again.
  const signClearedLine = !paneSignature && item?.status === 'approved' ? signatureClearedWords(signatureClearedOf(item.fields)) : null
  const docHtml = useMemo(() => filingDocHtml(buildLienNoticeBlocks(noticeFields, docExtras, { ghostOptional: !wordingLocked, signature: paneSigned }), { marks: paperMarks }), [noticeFields, docExtras, paperMarks, paneSigned, wordingLocked])
  /** Click a shaded box: the value becomes a box in its place. A Back button under a changed value puts the job's wording back. */
  // The wording typed in place on the paper (`useLienWordingEditor`, v2.7614).
  const { startEdit, onPaperClick, commitEdit } = useLienWordingEditor({ selected, paperRef, editInputRef, paneRef, sourceTripRef, wordingLocked, noticeFields, jobDefaults, editing, setEditing, setWordingEdits, setClaimOpenSignal, touchDraft, onOpenEditJob, onOpenCompanySettings })
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
  // The pay page behind the notice and its lines typed in place (`useLienDeskPayPage`, v2.7611).
  const { payPage, claimBills, unbilled, billFromHere, billWhy, payChanged, payChangedCount, payBlocks, payHtml, onPayPaperClick, commitPayEdit } = useLienDeskPayPage({ selected, job, openBalance, issuer, onChanged, billCustomer, noticeFields, docExtras, storedDraft, coverBlocks, offer, wordingLocked, payLineEdits, setPayLineEdits, payEditing, setPayEditing, payPaperRef, payInputRef, touchDraft })
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
        if (lienCodeStatusStale(r.reason)) refreshCodeStatus()
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
  /**
   * The paper a signing press signs (v2.7520): the one this pane shows, dated today. When the stored paper is not that
   * (a bill changed since it was sent for approval, or it was drafted on an earlier day) the row is rewritten first, so
   * the hash the signature binds is of the pages the leader read. A printed paper is signed as it printed.
   */
  const fieldsToSign = async (): Promise<unknown> => {
    if (!item) return null
    if (!canRedrawItem(item)) return item.fields
    const fresh = lienNoticeSignFields(item.fields, noticeFields, paneParted, { at: new Date().toISOString(), by: authUserId, byName: authName })
    if (lienFieldsHash(JSON.parse(JSON.stringify(fresh))) === lienFieldsHash(item.fields)) return item.fields
    if (!(await redrawLienDeskItem(item.id, fresh))) throw new Error('This notice moved on since this screen read it. Nothing was signed. Open it again.')
    return fresh
  }
  const approve = () =>
    run(
      'Sign and approve',
      async () => {
        if (!item) return
        await setLienDeskItemOffer(item.id, offer)
        await signItem(item.id, await fieldsToSign(), true)
      },
      offer ? `Signed and approved with a ${offer.pct}% offer. ${LIEN_RUN_NOW_TO_PRINT}` : `Signed and approved. ${LIEN_RUN_NOW_TO_PRINT}`,
    )
  const signOnly = () =>
    run(
      'Sign',
      async () => {
        if (!item) return
        await signItem(item.id, await fieldsToSign(), false)
      },
      `Signed. ${LIEN_RUN_NOW_TO_PRINT}`,
    )
  // Redraw from the bills (v2.7520): the stored paper replaced by today's, dated today, the signature cleared. It asks first.
  const redrawFromBills = async () => {
    if (!item || !paneParted || !canRedrawItem(item)) return
    const signed = paneSignature != null
    const words = lienNoticeRedrawConfirm(paneParted, { signed, leaderName })
    if (!(await confirmDialog({ title: words.title, message: words.message, confirmLabel: words.confirmLabel }))) return
    await run(
      'Redraw from the bills',
      async () => {
        const fresh = fieldsRedrawn(item.fields, { ...noticeFields, noticeDate: todayYmd }, redrawnLine(storedDraft?.notice, { at: new Date().toISOString(), by: authUserId, byName: authName }))
        if (!(await redrawLienDeskItem(item.id, fresh))) throw new Error('This notice printed or moved on since this screen read it. Nothing was changed.')
      },
      lienNoticeRedrawnToast(signed, leaderName),
    )
  }
  // The band over the paper (v2.7520): what parted with both figures, what happens next, and the press. A redrawn paper keeps a quiet line saying so.
  const partedStanding = !item ? null : (item as { printed_at?: string | null }).printed_at ? ('printed' as const) : paneSignature != null ? ('signed' as const) : ('unsigned' as const)
  const partedBand = paneParted && partedStanding ? lienNoticePartedBand(paneParted, partedStanding, leaderName) : null
  const redrawnRecord = item && !paneParted ? redrawnOf(item.fields) : null
  const partedBandNode = partedBand ? (
    <div data-lien-desk-parted={partedStanding ?? undefined} role="status" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem 0.75rem', padding: '0.6rem 0.75rem', margin: '0 0 0.5rem', borderRadius: 8, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', fontSize: '0.8125rem' }}>
      <span style={{ flex: '1 1 18rem' }}>
        <strong>{partedBand.head}.</strong> {partedBand.words} {partedBand.next}
      </span>
      {(office || leader) && canRedrawItem(item) ? (
        <button type="button" onClick={() => void redrawFromBills()} disabled={busy} style={btn('amber', busy)} data-lien-desk-redraw title="Replace the stored paper with today’s figures and date. A signature on it comes off and is asked for again">
          Redraw from the bills ▸
        </button>
      ) : null}
    </div>
  ) : redrawnRecord ? (
    <div data-lien-desk-redrawn style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{lienNoticeRedrawnWords(redrawnRecord, footShortDay)}</div>
  ) : null
  const saveOffer = () => run('The pay offer', async () => void (item && (await setLienDeskItemOffer(item.id, offer))), offer ? `Offer saved: ${lienOfferChipWords(offer)}.` : 'The offer is off.')
  const hold = (reason: 'promised' | 'call_first') =>
    run('Hold', async () => void (item && selected && (await holdLienDeskItem(item.id, { reason, until: holdUntilFor(reason, selected.earliestDeadline, promise?.promisedYmd ?? null, todayYmd) }))), 'Held — the desk re-asks before the deadline.')
  // v2.7503 (the owner's call): taking a notice back clears its signature, so a signed one asks first; an unsigned one goes back as it always has.
  const backToReady = async () => {
    if (!item) return
    const sig = signatureColumnsOf(item)
    const wasSigned = lienChipSigned(sig, lienFieldsHash(item.fields)) !== 'unsigned'
    if (wasSigned) {
      const words = takeBackNoticeConfirm({ jobWords: signAgainJobWords(job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) : null, job?.job_name), signerName: sig.signer_printed_name, ownSignature: Boolean(authUserId && sig.signed_by === authUserId) })
      if (!(await confirmDialog({ title: words.title, message: words.message, confirmLabel: words.confirmLabel }))) return
    }
    await run('Back to Approved · to print', async () => void (await clearLienDeskItemPrinted(item.id, { userId: authUserId, userName: authName || null })), takeBackNoticeDoneWords(wasSigned))
  }
  const pullBack = () => run('Pull back', async () => void (item && (await pullBackLienDeskItem(item.id, authUserId))), 'Back in the office’s drafts.')
  /**
   * Sign it again (v2.7502): the signature comes off an approved notice after a confirm, and the approval stands. The
   * re-read then finds the notice unsigned, so the footer draws the signing line again. A notice that printed or went
   * in the meantime is left alone, the person is told, and the desk reads again.
   */
  const signAgain = async () => {
    if (!item) return
    const sig = signatureColumnsOf(item)
    const how = signAgainHow({ leader, otherScreen })
    const words = signAgainConfirmWords({ jobWords: signAgainJobWords(job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) : null, job?.job_name), signedAtIso: sig.signed_at, signerName: sig.signer_printed_name, ownSignature: Boolean(authUserId && sig.signed_by === authUserId), how, leaderName })
    if (!(await confirmDialog({ title: words.title, message: words.message, confirmLabel: words.confirmLabel }))) return
    await run(
      'Sign it again',
      async () => {
        const r = await clearLienSignatureToSignAgain(item.id, { userId: authUserId, userName: authName.trim() || null })
        if (r.ok) return
        onChanged()
        throw new Error(r.message)
      },
      signAgainDoneWords({ how, leaderName }),
    )
  }
  const saveRule = (policy: LienNoticePolicy) =>
    run('Standing rule', async () => void (selected?.gcCustomerId && (await setCustomerLienNoticePolicy(selected.gcCustomerId, policy, ''))), `Rule saved for ${gc?.name ?? 'this GC'}.`)

  // Preview (v2.3522): the notice as the packet prints it, in its own tab, with the values marked.
  // The notice's preview in its own window, and what it posts back (`useLienNoticePreview`, v2.7614).
  const { openPreview } = useLienNoticePreview({ selected, job, noticeFields, jobDefaults, docExtras, paneSigned, wordingEditedBy, coverBlocks, payBlocks, wordingLocked, handSetClaimWords, monthsList, setWordingEdits, touchDraft, run, ensureDraft, paperRef, startEdit, docHtml, coverHtml, payHtml, wordingDiffLength: wordingDiff.length })

  // An owner asked for our records (v2.4544): the checked packet for their property, opened over the desk. On a computer its door was a press of the title bar
  // (the title line until v2.7311, then the end of the second line on every view) until v2.7780, the owner's ask of 2026-11-18: it is the last row of the window
  // ☎ opens, so off By paper the bar is one line. On a phone it is a row of More.

  // v2.4826: the § Rules window names the picked job and its two dates, and lights its row in the clock table.
  const rulesJob = selected ? lienRulesJobFrom({ label: jobLabel(job, selected.jobId), propertyKind: selected.propertyKind, isSub: !!selected.gcCustomerId, months: selected.months, earliestDeadline: selected.earliestDeadline }, todayYmd) : null

  const rulesAndCaller = (
    <>
      <LienRulesDoor where={kind === 'affidavit' ? 'desk_affidavit' : 'desk_notice'} style={headDoor} job={rulesJob} todayYmd={todayYmd} />
      {office ? <LienCallerDoor open={callScriptOpen} onOpen={() => setCallScriptOpen(true)} buttonStyle={headDoor} /> : null}
    </>
  )

  const counts = data?.queue.counts
  // By paper → Lien affidavits (v2.7585): what the list shows and its three batch presses live in `useLienDeskAffidavits`.
  const aff = useLienDeskAffidavits({ data, todayYmd, authUserId, issuer, signerNameFor, onChanged, finding, findWords, findFactsFor, oneColumn, affPile, setAffPile, affHeldOnlyPicked, setAffHeldOnlyPicked, affSelectedJobId, openNone: offList?.kind === 'affidavit' })
  const { affPrintPlanAll, affHeldOnly, affVisible, affSelected, affShown, affPrintPlan, affCount, affPilesShown, affSendPlanAll, affHelpSheet, affNoticeRecord, affNoticeCopies, affNoticeCopyCount, printReadyAffidavits } = aff
  const retEntries = data?.retainage.entries ?? []
  // What the Retainage list shows and which row is open (`lienRetainageListView`, v2.7583).
  const { visible: retVisible, selected: retSelected, pilesShown: retPilesShown } = lienRetainageListView({ entries: retEntries, pile: retPile, finding, matches: (e, pileLabel) => lienFindMatch(findFactsFor(e.jobId, e.gcCustomerId, [pileLabel]), findWords).ok, selectedJobId: retSelectedJobId, oneColumn, openNone: offList?.kind === 'retainage' })
  const retCount = retEntries.filter((e) => e.pile !== 'sent').length + (data?.retainageUnrecorded?.length ?? 0)
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
  const boardPrints =
    office && data
      ? {
          notice: lienBoardNoticePrint({ toPrint: (counts?.ready ?? 0) + retReady, waits: readyWaits, printed: counts?.printed ?? 0 }),
          // A held paper stands in Ready to file as a marked chip (v2.7783), so the line under the bin counts only the papers in that pile on the earlier form.
          affidavit: lienBoardAffidavitPrint({ ready: affPrintPlan.ready.length, held: affPrintPlan.gated.length, earlierForm: affPrintPlan.held.filter((e) => e.pile === 'ready').length, stack: { helpSheet: affHelpSheet, noticeRecord: affNoticeRecord, noticeCopies: affNoticeCopies && affNoticeCopyCount > 0 }, shown: Boolean(affShown) }),
        }
      : null
  const openWholeRun = () => {
    setRunTakeBack(false)
    setRunGcId(null)
    setRunOnlyItemId(null)
    setRunOpen(true)
  }
  // The monthly notices a run holds, built one way for the window and for Just this one's count (v2.7512): a GC's, one notice's, or every one.
  const runSignOpts = { inks, onDeviceNameFor: (id: string | null) => leaderNameFor?.(id) ?? '', leaderFor: (id: string | null) => ({ userId: id, name: signatureNameFor?.(id)?.trim() || (leaderNameFor?.(id) ?? '') }) }
  const monthlyRunNotices = (gcId: string | null, onlyItemId: string | null) =>
    data ? buildLienDeskRun(lienRunEntriesFor(data.queue.piles.ready, data.queue.piles.printed, gcId, onlyItemId), data, issuer, signerNameFor, todayYmd, signerPhoneFor, { suppliers: suppliers.byJob, releases: releases.byId, ...runSignOpts }) : []
  // Just this one (v2.7512): the run window on one notice, so it prints as the run prints it. The Lien window's own print was one unsigned set to photocopy.
  const openRunOnOne = (itemId: string) => {
    setRunTakeBack(false)
    setRunGcId(null)
    setRunFocus(null)
    setRunOnlyItemId(itemId)
    setRunOpen(true)
  }
  const onBoardPrint = (side: LienBoardPrintSide) => (side.act === 'print_affidavits' ? printReadyAffidavits() : openWholeRun())
  // The approved notices on By paper, where a row says it is unsigned.
  const showUnsignedNotices = () => {
    setMobileListShown(false)
    setCalendarJobFilter(null)
    setKind('notice')
    setPile('ready')
  }
  // Approved · to sign's press (v2.7712): the office's reminder to the leader, the same press as To do's waiting rows carry
  // (v2.7491), or for a leader, whose own the signature is, the door to the approved notices where he signs each.
  // The door counts the notices on the jobs he leads (v2.7853), and By paper opens narrowed to those, so the press and
  // the list are one number. A leader who leads none of them, a master or a dev, reads the office's reminder.
  const signDoor = office && signSplit ? lienBoardSignDoor({ mine: signSplit.mine.length, others: signSplit.others, othersLeader: signSplit.othersLeader }) : null
  const showNoticesToSign = () => {
    showUnsignedNotices()
    if (signDoor && signSplit) setCalendarJobFilter({ ymd: todayYmd, jobIds: new Set(signSplit.mine), words: signDoor.list })
  }
  const signRemind = office && !signDoor && reminderWords && reminderPlan && reminderPlan.signatures.length > 0 ? reminderWords : null
  // The presses that stand on a bin's title line beside the two prints (v2.7708): the run again on Approved · to mail while
  // notices still wait to print, the liens' copies on Filed · copies to mail (punch list #366), and the leader's one press
  // on his Awaiting Master approval bin, which stood under his own two bins until the switch to them was retired.
  // To send for Master approval's press (v2.7714): the door to the affidavits list at that pile, where the batch send stands.
  const sendDoor = office ? lienBoardSendDoor(affSendPlanAll.ready.length) : null
  const showAffidavitsToSend = () => {
    setMobileListShown(false)
    setAffHeldOnlyPicked(false)
    setAffPile('to_draft')
    setKind('affidavit')
  }
  const mailNumbersPress = office ? lienBoardMailNumbersPress({ toPrint: (counts?.ready ?? 0) + retReady, printed: counts?.printed ?? 0 }) : null
  const leaderBinPress = leaderView ? lienBoardLeaderBinPress(leaderView) : null
  const boardBinPress: Partial<Record<LienBoardBinKey, LienBoardBinPress>> = {
    ...(signDoor ? { 'notice:to_sign': { label: signDoor.label, onPress: showNoticesToSign, filled: true, title: 'Open the approved notices on the jobs you lead. Each takes your signature on its own pane.', lines: signDoor.line ? [{ key: 'others', words: signDoor.line, marks: { 'data-lien-board-sign-others': 'yes' } }] : [], marks: { 'data-lien-board-sign': 'yes' } } } : null),
    ...(signRemind ? { 'notice:to_sign': { label: reminding ? 'Reminding…' : signRemind.dead ? signRemind.button : `${signRemind.button} ›`, onPress: () => void remindLeader(), dead: signRemind.dead || reminding, quiet: true, marks: { 'data-lien-board-remind': 'yes' } } } : null),
    ...(sendDoor ? { 'affidavit:to_send': { label: sendDoor.label, onPress: showAffidavitsToSend, title: 'Open the affidavits to send, where one press sends every paper someone has read', marks: { 'data-lien-board-send': 'yes' } } } : null),
    ...(mailNumbersPress ? { 'notice:in_mail': { label: mailNumbersPress.label, onPress: openWholeRun, title: 'Open the run to type each printed notice’s mail number' } } : null),
    ...(office && serveDoor ? { 'affidavit:filed': { label: serveDoor, onPress: openServeAll, title: 'Print the copies each filed lien owes, then enter their mail numbers' } } : null),
    // Each closed end's press: the window opens on the bin's first paper and walks the rest. `quiet`, since nothing there can be rushed.
    ...Object.fromEntries((['notice:missed', 'affidavit:missed'] as const).map((key) => [key, closedBinJobs(key)] as const).filter(([, ids]) => ids.length > 0).map(([key, ids]) => [key, { label: lienClosedAnswerPress(ids.length), onPress: () => setClosedWalk({ jobIds: ids, start: ids[0]! }), quiet: true, title: 'See what closed on each one and answer it', marks: { 'data-lien-board-closed-press': key } }])),
    // Back from the clerk (v2.7856): the press itself where no print takes the line, and a line under the print where one does.
    ...(filingsDoor
      ? {
          'affidavit:ready': {
            label: filingsDoor,
            onPress: openFilings,
            title: 'Record each filed lien with the number the County Clerk stamped on it',
            marks: { 'data-lien-board-filings': 'yes' },
            under: [{ key: 'filings', words: LIEN_FILING_BATCH_WORDS.boardAsk, tone: 'muted' as const, marks: { 'data-lien-board-filings-line': 'yes' }, doors: [{ key: 'filings', label: filingsDoor, onPress: openFilings, marks: { 'data-lien-board-filings-door': 'yes' } }] }],
          },
        }
      : null),
    ...(leaderBinPress ? { 'affidavit:awaiting': { label: approvingLot ? 'Approving…' : leaderBinPress.label, onPress: () => void approveTheLot(), filled: true, dead: leaderBinPress.dead || approvingLot, lines: leaderBinPress.line ? [{ key: 'late', words: leaderBinPress.line }] : [], marks: { 'data-lien-board-approve': 'yes' } } } : null),
  }
  // What a print leaves out, by its door: the approved notices on By paper, where a row says it is unsigned; the affidavits in
  // Ready to file, where a row on the earlier form says so. A held affidavit has no line since v2.7783: its chip is its door.
  const onBoardPrintLeft = (side: LienBoardPrintSide) => {
    if (side.kind === 'notice') return showUnsignedNotices()
    setMobileListShown(false)
    setKind('affidavit')
    setAffHeldOnlyPicked(false)
    setAffPile('ready')
  }
  // The affidavits' stack is not the usual one (the owner's call of 2026-11-18): the line's press puts the usual pages
  // back where it stands, the three ticks of By paper's print bar set as they start. The usual stack draws no line.
  const onBoardPrintNote = () => {
    aff.setAffHelpSheet(LIEN_BOARD_USUAL_STACK.helpSheet)
    aff.setAffNoticeRecord(LIEN_BOARD_USUAL_STACK.noticeRecord)
    aff.setAffNoticeCopies(LIEN_BOARD_USUAL_STACK.noticeCopies)
    showToast('The affidavits print with the help sheet and the notice records again.', 'success')
  }
  // The title bar's run door is retired (v2.7490, the owner's call of 2026-11-16: *Retire it everywhere*). On a computer the run opens from the Board's notices' print on To do and from By paper's pile and footers. On a phone it is still the first row of More, off Affidavits, and the More button wears its count (punch list #352, PR 1).
  const runDoorShown = kind !== 'affidavit' && office && runCount > 0
  const runDoorHint = runDoor.act === 'record' ? 'The run as a checklist: each printed notice with its Printed, Signed and Mailed ticks; type each envelope’s tracking number to record the mailing' : 'Every approved notice — monthly and retainage — as one packet, then a checklist with Printed, Signed and Mailed ticks per notice'
  const gcNoticeShown = kind === 'notice' && office && !!onPutGcOnNotice && gcPickerOptions.length > 0
  const recordsDoorShown = office && !!onOpenOwnerRecords
  // What the title bar has room for, measured from the bar it drew (`useLienDeskTitleBarFit`, v2.7586).
  const { titleBarRef, titleLineFit, pileLineFit, papersFit } = useLienDeskTitleBarFit({ isMobile, paperShown, kind })
  // The first tab's words (v2.7465): on a computer the page's name and the count, on a phone *To do · N* under the title's own row.
  const firstTab = lienDeskFirstTab({ isMobile, count: data ? lienNextUpCount(nextUpRows) : null })
  const moreRun = runDoorShown ? { label: runDoor.label, count: runDoor.count, hint: runDoorHint } : null
  const moreRows = lienDeskMoreRows({ run: moreRun, gcNotice: gcNoticeShown, legendLabel: LIEN_DESK_LEGEND.label, caller: office, share: !!data, ownerRecords: recordsDoorShown })
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
    <LienDeskNoticeList
      data={data}
      loading={loading}
      isMobile={isMobile}
      stacked={stacked}
      office={office}
      entries={entries}
      visible={visible}
      visibleAll={visibleAll}
      pilesShown={pilesShown}
      noticeHeads={noticeHeads}
      counts={counts}
      runCount={runCount}
      pile={pile}
      setPile={setPile}
      finding={finding}
      find={find}
      findWords={findWords}
      findHits={findHits}
      alsoSent={alsoSent}
      calendarJobFilter={calendarJobFilter}
      setCalendarJobFilter={setCalendarJobFilter}
      deliveriesOnly={deliveriesOnly}
      setDeliveriesOnly={setDeliveriesOnly}
      mailedJobIds={mailedJobIds}
      selectedJobId={selectedJobId}
      setSelectedJobId={setSelectedJobId}
      setMobileListShown={setMobileListShown}
      setRunOpen={setRunOpen}
      setCallerJobId={setCallerJobId}
      supplierMarks={supplierMarks}
      leaderNameFor={leaderNameFor}
      listLabel={listLabel}
      onOpenNotice={onOpenNotice}
    />
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
      // What the job's sent bills still owe (v2.7530), as the desk's row reads it; a job on no row keeps the job's balance.
      const open = data.queue.entries.find((x) => x.jobId === jobId)?.openBalance ?? Number(cJob.revenue ?? 0) - Number(cJob.payments_made ?? 0)
      return { hasLetter: false, facts: { ...genericCallFacts(callerUs), jobLabel: jobLabel(cJob, jobId), property: (cJob.job_address ?? '').trim() || 'your property', ownerName: owner, gcName: cGc?.name ?? 'your builder', amount: open > 0 ? formatUsdNoCents(open) : '' } }
    }
    return { hasLetter: first.status === 'sent', facts: callLetterFactsFor({ item: first, job: cJob, gc: cGc, address: cAddress, owner: data.ownerByJob[jobId] ?? null, us: callerUs, phone: signerPhoneFor ? signerPhoneFor(cJob?.master_user_id ?? null) : (issuer?.phone ?? '').trim() }) }
  }

  // The find box above a list (v2.4721): one column, the box then the scrolling list.
  const withFind = (node: ReactNode, matched: number, top: ReactNode = null) => (
    <div style={{ display: 'grid', gridTemplateRows: top ? 'auto auto minmax(0, 1fr)' : 'auto minmax(0, 1fr)', minHeight: 0, overflow: 'hidden' }} data-lien-desk-find-column>
      <LienDeskFindBox value={find} onChange={setFind} matched={matched} isMobile={isMobile} />
      {top}
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
  /** One job's paper where the desk opens it: the affidavit's pane, the notice's pane (its own page on a stacked screen), else the job's Lien window. */
  const openJobPaper = (jobId: string, paper: 'notice' | 'affidavit') => {
    if (paper === 'affidavit' && data?.affidavits.entries.some((e) => e.jobId === jobId)) {
      setKind('affidavit')
      setAffSelectedJobId(jobId)
      setMobileListShown(false)
    } else if (paper === 'notice' && data?.queue.entries.some((e) => e.jobId === jobId)) {
      if (stacked && onOpenNotice) onOpenNotice(jobId, null)
      else {
        setKind('notice')
        setSelectedJobId(jobId)
        setMobileListShown(false)
      }
    } else {
      onOpenLienInstruments(jobId)
    }
  }
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
          servePrinted,
          entry: selected,
          affidavit: data.affidavits.entries.find((e) => e.jobId === selected.jobId) ?? null,
          retainage: lienRetainageClockFromDesk(data, selected.jobId),
          isSub: Boolean(selected.gcCustomerId),
          propertyKind: property.propertyKind,
          lastWorkDate: job?.last_work_date ?? null,
          job: job ?? null,
          openBalance,
          todayYmd,
          demandLetters: data.demandLettersByJob?.[selected.jobId] ?? null,
        })
      : null

  // The press on a recipient's card in a stop's window (`lienMailProofDoor.ts`): how this desk opens each place a copy's lack is
  // entered. The office alone does those acts, so anyone else has no opener and no press. The copies window is offered for a lien in it.
  const proofOpeners = (filingId: string): LienMailProofOpeners =>
    !office
      ? {}
      : {
          property: (l) => setPaneFix({ jobId: l.jobId, focus: l.lack === 'owner_address' ? 'owner_address' : 'owner' }),
          ...(serveJobs.some((j) => j.filing.id === filingId) ? { serve: (l: LienMailProofLanding) => { setServeLand(lienMailProofServeLanding(l)); setServeOpen(true) } } : null),
          ...(onOpenLienProof ? { lien_window: onOpenLienProof } : null),
        }
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
      // What went out (`lienMailProof.ts`): the mailed files off the notice's own item, and each envelope's receipt.
      const proof = lienStopProof(f, { isSub: Boolean(selected.gcCustomerId), mailedCopies: data.items.find((it) => it.sent_filing_id === f.id)?.mailed_copies })
      const proofDoor = proof ? lienMailProofDoorPress({ jobId, filingId: f.id, paper: proof.paper, served: Boolean(f.served_at), printed: lienServeStage(f, servePrinted) === 'record', ownerGap: lienMailProofOwnerGap({ name: ownerName, mailingAddress: property.owner.mailingAddress }) }, proofOpeners(f.id), () => setStopOpen(null)) : null
      return { ...none, pages: page ? [page] : [], record: { words, href: f.document_url || null, proof, proofDoor }, note: page ? 'The paper as it went out, from the record.' : null, ...extra }
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
        return openServeFor(jobId)
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
  // The notice pane (`LienDeskNoticePane`, v2.7619) reads the desk through one object, built here on every render.
  const paneCtx: LienNoticePaneContext = { data, todayYmd, authUserId, authName, onChanged, onOpenEditJob, onOpenJob, onPutGcOnNotice, onCalendarChanged, isMobile, leader, office, setCheckedMonths, coverNote, setCoverNote, housesInLetter, setHousesInLetter, releaseId, setByHandOpen, rulePick, setRulePick, detailsOpen, setDetailsOpen, busy, run, touchDraft, editing, setEditing, paperRef, editInputRef, payEditing, setPayEditing, payPaperRef, payInputRef, claimOpenSignal, paneScrolled, setPaneScrolled, stripRef, paneRef, activeGate, pickGate, kindOpen, setKindOpen, kindBusy, setNoticeFootHome, entries, suppliers, selected, job, gc, address, property, ownerName, stopOpen, setStopOpen, pickKind, promise, gcHasPriorNotice, wm, item, storedDraft, months, monthsList, openBalance, supplierJob, correction, lastSentAt, claimed, wordingDiff, wordingEditedBy, wordingLocked, paneSignature, signClearedLine, docHtml, onPaperClick, commitEdit, claimNumber, noticeRelease, releaseHtml, coverHtml, payPage, claimBills, unbilled, billFromHere, billWhy, payChangedCount, payHtml, onPayPaperClick, commitPayEdit, pageTotal, noticePageNumber, noteMissed, gcOpenTotal, toggleRelease, partedBandNode, saveRule, openPreview, counts, relightPages, pageLabel, monthCards, monthGrid, gates, gateVerdict, gateByKey, gatesFold, timeline, stopPaperFor, footInPane, stripChips, pressStripChip, stripChipStyle, simpleApprove, bandAct, onBandAct, paneHead, goToSection, relightPane }
  // The address named a job the list in view does not hold (v2.7744): the note in the pane's place, with the list the
  // job is on and its Lien window as the ways on. On one column it tops the list, since no pane is open to hold it.
  const offListNote = offList ? (
    <div data-lien-desk-off-list={offList.kind} role="status" style={oneColumn ? { borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' } : { padding: '1.5rem' }}>
      <EmptyState
        compact={oneColumn}
        {...lienDeskOffListWords(offList, data?.jobsById[offList.jobId] ? jobLabel(data.jobsById[offList.jobId], offList.jobId) : '', {
          onOpenList: (to) => {
            const jobId = offList.jobId
            if (to === 'affidavit') setAffSelectedJobId(jobId)
            else if (to === 'retainage') setRetSelectedJobId(jobId)
            else setSelectedJobId(jobId)
            setKind(to)
            setMobileListShown(false)
          },
          onOpenLienWindow: () => (offList.kind === 'affidavit' ? (onOpenLienAffidavit ?? onOpenLienInstruments) : offList.kind === 'retainage' ? (onOpenCalendarJob ?? onOpenLienInstruments) : onOpenLienInstruments)(offList.jobId),
        })}
      />
    </div>
  ) : null
  const pane = offList?.kind === 'notice' ? offListNote : <LienDeskNoticePane ctx={paneCtx} />

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
  // The pile chips in the header on a computer: Lien affidavits' or Retainage notices', when a pile has a chip to draw.
  const headerPileChips = !isMobile && (kind === 'retainage' || kind === 'affidavit') ? (kind === 'retainage' ? retPileChips : affPileChips) : []
  // The title bar's shape on this screen: where the tools and the paper tabs sit, whether it has a second line, and whether that line breaks before its span (v2.7213, v2.7277, v2.7311; no door of its own since v2.7780; the papers up on the title line where it has room since v2.7789).
  const titleBar = lienDeskTitleBarLayout({ isMobile, fit: titleLineFit, pileFit: pileLineFit, papersFit, paperShown, piles: headerPileChips.length > 0 })
  // On a phone the chips are one strip that slides sideways, the first thing in the list's own scroller.
  const pileStrip = (chips: ReactNode[]) => (isMobile && chips.length > 0 ? <div data-lien-desk-piles style={{ display: 'flex', gap: 8, padding: '8px 12px', overflowX: 'auto', borderBottom: '1px solid var(--border)' }}>{chips}</div> : null)

  const affHeads = useLienPileHeads(affPilesShown.map((x) => x.p), isMobile)
  const affList = (
    <LienDeskAffidavitList
      aff={aff}
      heads={affHeads}
      data={data}
      loading={loading}
      isMobile={isMobile}
      office={office}
      finding={finding}
      find={find}
      onClearFind={() => setFind('')}
      affPile={affPile}
      onShowEveryPile={() => setAffPile(null)}
      onShowCalendar={() => setKind('calendar')}
      pileChips={pileStrip(affPileChips)}
      supplierMarks={supplierMarks}
      rowLabel={(jobId) => listLabel(jobId, 'affidavit', false)}
      onPick={(jobId) => {
        setAffSelectedJobId(jobId)
        setMobileListShown(false)
      }}
    />
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
        proofOpeners={proofOpeners}
        servePrinted={servePrinted}
        onServe={openServeFor}
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
        onLastWorkChanged={() => (onCalendarChanged ? onCalendarChanged('last_work') : onChanged())}
        footerEl={affFooterEl}
      />
    ) : offList?.kind === 'affidavit' ? offListNote : (
      <div style={{ padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{isMobile ? '' : 'Pick a job on the left.'}</div>
    )

  // ---------- retainage: the list and the pane (v2.3753; the list is `LienDeskRetainageList` since v2.7583) ----------
  const retHeads = useLienPileHeads(retPilesShown.map((x) => x.p), isMobile)
  const retList = (
    <LienDeskRetainageList
      data={data}
      loading={loading}
      isMobile={isMobile}
      office={office}
      pilesShown={retPilesShown}
      heads={retHeads}
      rowCount={retVisible.length}
      selectedJobId={retSelected?.jobId ?? null}
      pile={retPile}
      onShowEveryPile={() => setRetPile(null)}
      finding={finding}
      find={find}
      onClearFind={() => setFind('')}
      focusJobId={retUnrecordedFocus}
      pileChips={pileStrip(retPileChips)}
      supplierMarks={supplierMarks}
      onPick={(jobId) => {
        setRetSelectedJobId(jobId)
        setMobileListShown(false)
      }}
      onOpenLienContract={(jobId) => onOpenEditJob(jobId, 'lien-contract')}
      onChanged={onChanged}
    />
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
    ) : offList?.kind === 'retainage' ? offListNote : (
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
      <LienNoticeAlreadyWent
        // v2.7508: when the property holds a notice on record, the door first asks which paper went and applies it to this job.
        apply={{
          gcCustomerId: job?.gc_customer_id ?? null,
          jobNumber: effectiveJobLedgerNumber(job?.hcp_number, job?.click_number) || selected.jobId.slice(0, 8),
          months: monthsList,
          propertyKind: selected.propertyKind ?? '',
          lastWorkYmd: job?.lien_last_work_on ?? null,
          userName: authName,
          item: selected.item && selected.item.status !== 'sent' && selected.item.status !== 'missed' ? { id: selected.item.id, fields: selected.item.fields, months: selected.item.months ?? [] } : null,
        }}
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
  // The sent notice's mail proof, for the phone's fold bar (v2.7715): the bar names it while the footer is folded.
  let footProof: LienPhoneFootProof | null = null
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
    // The sent notice's facts (v2.3760), for any row whose job has one inside thirty days (v2.6624, punch list #248): `lienSentPacketFacts` (v2.7591).
    const sentFacts = lienSentPacketFacts({ data, jobId: selected.jobId, sentItem: selected.sentItem, entrySentFilingId: selected.item?.sent_filing_id, courtesyByJob, payRows: payPage.rows, job, address, gc, todayYmd, phone: () => (signerPhoneFor ? signerPhoneFor(job?.master_user_id ?? null) : (issuer?.phone ?? '').trim()), openBalance })
    const { lt, first, courtesy, courtesyDraft, courtesyFacts, jobBalance } = sentFacts
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
    // What the footers read (`LienNoticeFooterContext`, v2.7593): the four that wait on the leader are `LienDeskLeaderFooters.tsx`.
    const footCtx: LienNoticeFooterContext = { selected, monthsList, monthsWord, todayYmd, authRole, authName, leader, office, otherScreen, busy, leaderName, leaderNameFor, gc, codeSigner, promise, claimGate, counts, runCount, simpleApprove, detailsOpen, notYetOpen, setNotYetOpen, holdOpen, setHoldOpen, rulePick, wordOpen, setWordOpen, wordNote, setWordNote, wordChannel, setWordChannel, wordPreview, offerProblem, signLine, offerBox, offerSwitch, byHandPane, penPane, approve, signOnly, sendOnWord, pullBack, saveOffer, hold, backToReady, signAgain, setByHandOpen, setPenOpen, setRunOpen, openRunOnOne, monthlyRunNotices, run }
    if (state === 'needs_owner' || state === 'to_draft' || (state === 'missed' && selected.dueMonths.length > 0)) {
      // The draft footer (v2.3776): `LienDeskDraftFooter` over the footers' context and the draft's own (v2.7594).
      const draftCtx: LienDraftFooterContext = { ...footCtx, askReason, codeReady, draftFields, draftSave, draftSignWay, ensureDraft, gates, offer, paneRef, pickGate, readiness, ready, ruleLive, sendToLeader, setPenDraft, setSignWay, signItem, signRef, draftSignLine, first, lt, courtesyUnrecordedBand, courtesyDoor, letterTwoDoor }
      footer = <LienDeskDraftFooter ctx={draftCtx} />
    } else if (state === 'awaiting') {
      footer = <LienDeskAwaitingFooter ctx={footCtx} />
    } else if (state === 'ready') {
      footer = <LienDeskReadyFooter ctx={footCtx} />
    } else if (state === 'printed') {
      footer = <LienDeskPrintedFooter ctx={footCtx} />
    } else if (state === 'held') {
      footer = <LienDeskHeldFooter ctx={footCtx} />
    } else if (state === 'sent') {
      const sentProof = sentFacts.sentFiling ? lienMailProof({ kind: sentFacts.sentFiling.kind, sends: sentFacts.sentFiling.sends, documentUrl: sentFacts.sentFiling.document_url, documentNote: sentFacts.sentFiling.document_note, mailedCopies: sentFacts.first?.mailed_copies }) : null
      footProof = sentProof ? { chip: sentProof.chip, complete: sentProof.complete } : null
      footer = (
        <LienDeskSentFooter forms={sentForms} facts={sentFacts} signoff={signoff} signoffLine={signoffLine} legalSignoff={legalSignoff} data={data} jobId={selected.jobId} job={job} gc={gc} office={office} busy={busy} run={run} authName={authName} onChanged={onChanged} onOpenOwnerCall={() => setOwnerCallOpen(true)} doors={<>{courtesyUnrecordedBand}{courtesyDoor}{letterTwoDoor}</>} proof={sentFacts.sentFiling ? <LienFilingMailProof filing={sentFacts.sentFiling} item={sentFacts.first ? { itemId: sentFacts.first.id, copies: sentFacts.first.mailed_copies } : null} jobId={selected.jobId} jobNumber={job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) : ''} isMobile={isMobile} canEdit={office} userId={authUserId} todayYmd={todayYmd} onChanged={onChanged} /> : null} />
      )
    } else if (state === 'missed') {
      footer = (
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-red-600)' }}>
          The window closed on {selected.missedMonths.map(workMonthLabel).join(', ')} with no notice — the lien right on that work is gone. {selected.item?.status === 'missed' ? `Skipped: ${parseLienDeskDraftFields(selected.item.fields)?.skipReason ?? ''}` : ''}
        </div>
      )
    }
  }

  // The tools (v2.6569): § Rules, ☎, ? and Share (the owner-records door stood before them until v2.7780). On a computer they end the title line
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
        {/* A window under 1,280 px shows the icon alone (under 1,132 until v2.7874, `LIEN_DESK_TIGHT_BAR_MAX_PX`); the word stays the button's name. */}
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
  const footFold = paneOpenPhone && !(simpleApprove && !detailsOpen) && (paneOpenPhone.kind !== 'notice' || Boolean(footer)) ? lienPhoneFootFold(footFolded, paneOpenPhone.kind === 'notice' ? footProof : null) : null
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
  // By paper's three paper tabs, drawn on the title line or leading the second (`titleBar.papers`, v2.7789).
  const paperTabs = paperShown ? (
    <LienDeskPaperTabs isMobile={isMobile} kind={kind} toolsOnTitleLine={titleBar.tools === 'title_line'} onTitleLine={titleBar.papers === 'title_line'} noticeCount={counts ? entries.filter((e) => e.pile !== 'sent').length : null} affCount={data ? affCount : null} retCount={data ? retCount : null} onPick={setKind} />
  ) : null
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
          {/* The title is the first tab on a computer (v2.7465, the owner's pick of 2026-11-16, "A, title is the tab"): the title and To do opened the same page, so the tab carries the page's name, the count and the way home. The heading stays for a screen reader and the page's outline, out of the line (`.lienDeskOutlineHeading`), with no press of its own. A phone keeps its title on its own row, with its press; so does a one-column desk with a paper open, whose tab rows hide (`data-lien-pane-open`), so the page is never without its name. */}
          {isMobile || paneOpenPhone ? (
            <h2
              // On a phone the title shares its line with the way back and More (punch list #352, PR 1); the rows under it get the card's width.
              style={{ margin: 0, fontSize: '1.125rem', ...(isMobile ? { flex: '1 1 auto', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } : {}) }}
              title={LIEN_DESK_HINT}
            >
              <button type="button" className="lienDeskTitleDoor" data-lien-desk-title aria-label="Lien desk: open To do at the Board" onClick={() => { setKind('next'); bringBoard() }}>
                ⏱ {LIEN_DESK_NAME}
              </button>
            </h2>
          ) : (
            <h2 className="lienDeskOutlineHeading" data-lien-desk-heading="outline">{LIEN_DESK_NAME}</h2>
          )}
          {isMobile ? (
            <button type="button" data-lien-desk-more="door" aria-haspopup="dialog" aria-expanded={moreOpen} aria-label={moreButton.label} onClick={() => setMoreOpen(true)} style={{ position: 'relative', flex: 'none', width: 44, height: 44, display: 'inline-grid', placeItems: 'center', border: 'none', borderRadius: 10, background: 'transparent', color: 'var(--text-700)', font: 'inherit', fontSize: '1.4rem', lineHeight: 1, cursor: 'pointer' }}>
              <span aria-hidden="true">⋯</span>
              {moreButton.badge != null ? <span aria-hidden="true" data-lien-desk-more-badge style={{ position: 'absolute', top: 2, right: 0, minWidth: 18, height: 18, padding: '0 5px', boxSizing: 'border-box', borderRadius: 999, background: '#2563eb', color: '#fff', fontSize: '0.7rem', fontWeight: 700, lineHeight: '18px', textAlign: 'center' }}>{moreButton.badge}</span> : null}
            </button>
          ) : null}
          {/* v2.4311: the tab row is 375 px of labels — on a phone it scrolls sideways inside the card instead of pushing the title bar (and ×, and Share) off the screen. v2.4441: a cut end fades, so Timeline past the edge is not a secret, and the picked tab is brought into view. */}
          {/* Four views: To do, By date, By paper, By job. The first three are punch list #82, PR 5 (named Next up, Calendar, All paper until v2.4630 and Do now, Deadlines, All filings until v2.7207, the owner's pick: the first is the work, the other two the same jobs sorted two ways; only To do carries a count). By paper holds the three papers' lists as a second row. By job is the list that was Timeline in that row until v2.7219, the owner's pick of 2026-11-13: it is every job's path, not a kind of paper. */}
          <LienDeskViewTabs kindTabs={kindTabs} isMobile={isMobile} kind={kind} paperShown={paperShown} firstTab={firstTab} onTitle={() => { setKind('next'); bringBoard() }} onPick={(v) => setKind(v === 'paper' ? lastPaperKind : v)} />
          {/* By paper's three paper tabs ride the title line, between the views and the tools, when the measured line holds them all (v2.7789, the owner's ask of 2026-11-18: "when it can fit, I would like to move this section up into this space, but when it cant fit it should wrap like it has been"). `lienDeskPapersFit` decides, never a wrap. */}
          {titleBar.papers === 'title_line' ? paperTabs : null}
          {/* In a window wide enough for both (v2.7213, the owner's screenshot at 1,846 px) the tools end the title line, pushed right: nothing is hidden and the bar loses its half-empty second line. */}
          {/* The owner-records door was a tool here, then under the presses (v2.7277, v2.7311), until v2.7780: it is a row of the window ☎ opens. */}
          {titleBar.tools === 'title_line' ? (
            <span data-lien-desk-tools style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}>
              {headerTools}
            </span>
          ) : null}
          {/* § Rules and ☎ sit at the right with Share on a computer (v2.4618, the owner's ask); on a phone they stay in the flow under the title. */}
          {isMobile ? <LienRulesDoor button={false} open={rulesOpen} onOpenChange={setRulesOpen} where={kind === 'affidavit' ? 'desk_affidavit' : 'desk_notice'} job={rulesJob} todayYmd={todayYmd} /> : null}
          {isMobile && shareOpen && data ? (
            <LienDeskShare isMobile={isMobile} data={data} calendarRows={calendarRows} suppliers={suppliers.byJob} todayYmd={todayYmd} me={{ id: authUserId, name: authName }} onClose={() => setShareOpen(false)} />
          ) : null}
          {isMobile && moreOpen ? <LienDeskMoreSheet rows={moreRows} onPick={pickMore} onClose={() => setMoreOpen(false)} /> : null}
          {/* The second line (v2.3817): on By paper the paper tabs, then the piles, then Put a GC on notice at the right (v2.4740: the run moved up to the title line). Off By paper it holds the tool row on a computer whose title line has no room for it (v2.6569). */}
          {/* The second line is the tool row on a computer whose title line has no room for the presses (v2.6569; a 1,540 px viewport rule until v2.7277); on a phone, and on a computer with room for them (v2.7213), it comes only with the paper tabs. From v2.7311 to v2.7780 a computer with the owner-records door always had it, ending with the door. */}
          {titleBar.breakLine ? (
            <span aria-hidden data-lien-desk-header-break style={{ flexBasis: '100%', height: 0 }} />
          ) : null}
          {/* With the tools up on the title line (v2.7213) the paper tabs are the tallest thing some kinds have here: 2px above and below keeps this line as tall as it is with the GC door, so the bar does not move between Notices and Affidavits. */}
          {/* The papers lead the second line where the title line has no room for them, as since v2.3817, and always on a phone. */}
          {titleBar.papers === 'second_line' ? paperTabs : null}
          {/* The pile chips: in the header on a computer, one span so the pile line can be measured (v2.7311); on a phone a strip at the top of the list, where they scroll away with it (punch list #352, PR 1). The span's own wrapped rows keep the bar's 6 px (v2.7322), since the bar's row gap is 0 now. */}
          {headerPileChips.length > 0 ? (
            <span data-lien-desk-piles style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', rowGap: LIEN_DESK_TITLE_BAR_ROW_GAP_PX, columnGap: 'inherit', minWidth: 0 }}>{headerPileChips}</span>
          ) : null}
          {/* v2.4672: the notice piles' chips became the stacked titles inside the list; `pile` still narrows (deep links, To do doors) and the title offers *every pile* (*show every pile* until v2.7434). */}
          {/* The right end of the second line (v2.4629): Put a GC on notice, then on a computer the tools when the title line has no room for them (v2.6569), in one span pushed right — into the title bar's right padding, so the tools end under × and not a toggle's width short of it. On a phone it holds the GC picker. */}
          {/* Drawn only when it holds something (v2.7213): empty, it would still take a column gap and push the title line's tools off the edge. */}
          {/* A pile line too narrow for the piles and the span together breaks here (v2.7311), so the span falls under the piles as one piece, right-aligned, by the measured rule and not by wrapping. */}
          {titleBar.pileBreak ? <span aria-hidden data-lien-desk-pile-break style={{ flexBasis: '100%', height: 0 }} /> : null}
          {titleBar.rightSpan ? <span data-lien-desk-right style={{ marginLeft: 'auto', marginRight: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '0.4rem 0.6rem', minWidth: 0 }}>
          {/* A phone's GC picker, the sheet More opens. On a computer the door left the bar in v2.7806: the press is beside the GC's name on the job's own notice (`lienGcNoticePress`, drawn by `LienDeskNoticePane`). */}
          {isMobile && gcNoticeShown && onPutGcOnNotice ? (
            <LienDeskGcPicker open={gcPickerOpen} onClose={() => setGcPickerOpen(false)} options={gcPickerOptions} onPick={onPutGcOnNotice} />
          ) : null}
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
          <LienDeskWindows
            data={data}
            isMobile={isMobile}
            todayYmd={todayYmd}
            issuer={issuer}
            windows={windows}
            serveJobs={serveJobs}
            serveMailedJobs={serveMailedJobs}
            docKnown={docKnown}
            servePrinted={servePrinted}
            filingTargets={filingTargets}
            authUserId={authUserId}
            serveLand={serveLand}
            onServeClosed={() => setServeLand(null)}
            onServePrinted={(ids) => setServePrintedNow((cur) => [...cur, ...ids])}
            scanTargets={scanTargets}
            paneFix={paneFix}
            onClosePaneFix={() => setPaneFix(null)}
            propertyCard={propertyCard}
            setPropertyCard={setPropertyCard}
            bookProperties={bookProperties}
            bookLoading={bookLoading || !book}
            bookError={bookError}
            onChanged={onChanged}
            onOpenJob={onOpenJob}
            onOpenAffidavit={(jobId) => (onOpenLienAffidavit ?? onOpenLienInstruments)(jobId)}
            onOpenJobPaper={openJobPaper}
          />
          {closedWalk ? (
            <LienClosedWindow
              key={closedWalk.start}
              jobIds={closedWalk.jobIds}
              startJobId={closedWalk.start}
              paperFor={closedPaperFor}
              authUserId={authUserId}
              authName={authName}
              authRole={authRole}
              zIndex={805}
              onClose={() => setClosedWalk(null)}
              onChanged={onChanged}
              onSetLastWork={(jobId) => onOpenCalendarLastWork?.(jobId)}
              onRecordFiling={(jobId) => (onOpenLienAffidavit ?? onOpenLienInstruments)(jobId)}
              onDraftLateNotice={(jobId) => {
                const chip = board ? lienBoardChipFor(board, jobId, 'notice') : null
                if (chip) zoomTo({ ...chip, destination: { kind: 'paper', tab: 'notices', jobId } })
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
            {board ? <LienBoard board={board} isMobile={isMobile} binPress={boardBinPress} onLayout={setBoardStacked} onChip={zoomTo} cardFor={chipCardFor} pick={boardPick} shown={nextUpRowsShown.length} onPick={(key) => pickBoardBins(key ? [key] : null)} onTile={openBoardTile} prints={boardPrints ? { ...boardPrints, onPress: onBoardPrint, onLeft: onBoardPrintLeft, onNote: onBoardPrintNote } : null} over={publicLine ? <LienPublicBoardLineView line={publicLine} isMobile={isMobile} onReview={office && publicLine.addressIds.length ? () => setPublicReview(publicLine.addressIds) : null} /> : null} underAffidavits={publicBin || offPathBin ? <div style={{ display: 'grid', gap: 10 }}>{publicBin ? <LienPublicBinView bin={publicBin} isMobile={isMobile} onPutBack={office ? setPublicPutBack : null} /> : null}{offPathBin ? <LienOffPathBinView bin={offPathBin} isMobile={isMobile} onOpenJob={onOpenJob} onPutBack={office ? setJobPath : null} /> : null}</div> : null} /> : <div />}
            <LienDoNowBar pins={doNowBarPins} scrollerRef={doNowRef} parts={doNowBarParts} onPart={openBoardTile} pick={boardPick ? lienBoardPickWords(boardPick, nextUpRowsShown.length) : null} onClearPick={() => pickBoardBins(null)} prints={boardPrints ? [boardPrints.notice, boardPrints.affidavit].flatMap((side) => (side ? [{ key: side.kind, label: side.short.label, left: side.short.left, dead: side.dead, onPress: () => onBoardPrint(side) }] : [])) : undefined}>
              <LienDeskFindBox value={find} onChange={setFind} matched={nextUpRowsShown.length} isMobile={isMobile} />
            </LienDoNowBar>
            <LienDeskNextUp scrolls={doNow.listScrolls} amountFor={phoneAmountFor} rows={nextUpRowsShown} markTitle={(t) => <LienFindMarked text={t} words={findWords} />} loading={loading && !data} isMobile={isMobile} onAct={actOnNextUp} onOpenJob={onOpenJob} zoomFor={(row) => (row.jobId ? zoomFor(row.jobId, row.kind === 'affidavit' ? 'affidavit' : row.kind === 'notice' ? 'notice' : 'either') : null)} foldsOpen={finding} waitingOn={nextUpWaitingOn} risk={rowRisk} riskLabel={riskLabel} stageFor={rowStage} noticeFor={rowNotice} byBin={board && !isMobile ? { binFor: rowBin, folds: lienBinFolds({ office, serveOwed: serveJobs.length, serveButton: serveDoor, printReady: affPrintPlanAll.ready.length, printButton: lienAffidavitPrintDoorWords(affPrintPlanAll), sendReady: affSendPlanAll.ready.length }), narrowed: Boolean(boardPick) } : null} trackPress={office && !isMobile && affPrintPlanAll.ready.length >= 2 ? { button: lienAffidavitPrintDoorWords(affPrintPlanAll), onPress: () => { setAffHeldOnlyPicked(false); setAffPile('ready'); setKind('affidavit') } } : null} remind={office && reminderWords && waitingRows.length > 0 ? { button: reminderWords.button, dead: reminderWords.dead, busy: reminding, onPress: () => void remindLeader() } : null} factsFor={stepFactsFor} viewerIsLeader={leader} leadsRow={leadsRow} onOpenRow={isMobile ? openJobScreen : undefined} onOpenPaper={(row) => setPaperOpen(Math.max(0, paperRows.findIndex((r) => r.key === row.key)))} gapsFor={paperGapCount} />
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
              properties={bookProperties}
              onOpenProperty={openProperty}
              group={bookGroup}
              onGroup={setBookGroup}
              onSetProperty={office ? (jobId) => (data?.jobsById[jobId] ? setPaneFix({ jobId, focus: 'owner' }) : onOpenEditJob(jobId, 'property-record')) : undefined}
              phone={isMobile}
              onPrint={(rows, title) => {
                // A print counts as a send (docs/SENT_COPIES.md): counsel's grid is filed on every job in it.
                printAndFile(lienGridHtml(rows, { title, todayYmd, companyName: issuer?.companyName ?? '' }), { kind: 'lien_grid', title, recipientName: 'Counsel', jobIds: rows.map((r) => r.jobId) })
              }}
            />
          ) : kind === 'affidavit'
            ? (oneColumn ? (mobileListShown || offList ? withFind(affList, affVisible.length, offListNote) : affPane) : (
                <>
                  {withFind(affList, affVisible.length)}
                  {paneColumn(affPane)}
                </>
              ))
            : kind === 'retainage'
              ? (oneColumn ? (mobileListShown || offList ? withFind(retList, retVisible.length, offListNote) : retPane) : (
                  <>
                    {withFind(retList, retVisible.length)}
                    {paneColumn(retPane)}
                  </>
                ))
            : oneColumn ? (mobileListShown || offList ? withFind(list, visible.length, offListNote) : pane) : (
            <>
              {withFind(list, visible.length)}
              {paneColumn(pane)}
            </>
          )}
        </div>
        {/* A phone's open paper (punch list #352, PR 6): one bar folds the footer away so the paper has the screen; the footer stays mounted, so what was typed in it is kept (`index.css`). */}
        {footFold ? (
          <button ref={footFoldRef} type="button" data-lien-desk-foot-fold aria-expanded={footFold.expanded} onClick={() => setFootFolded((v) => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', minHeight: 44, padding: '0 1.1rem', border: 'none', borderRadius: 0, borderTop: '1px solid var(--border-strong)', background: 'var(--bg-muted)', color: 'var(--text-700)', font: 'inherit', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.2rem 0.6rem', minWidth: 0 }}>
              <span>{footFold.words}</span>
              {footFold.chip ? <span data-lien-desk-foot-fold-proof={footFold.chip.complete ? 'complete' : 'owed'} style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.1rem 0.5rem', borderRadius: 999, whiteSpace: 'nowrap', background: footFold.chip.complete ? 'var(--bg-green-tint)' : 'var(--bg-amber-tint)', color: footFold.chip.complete ? 'var(--text-green-800)' : 'var(--text-amber-800)' }}>{footFold.chip.chip}</span> : null}
            </span>
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
            onOwnerRecords={recordsDoorShown ? () => {
              setCallScriptOpen(false)
              // The paper open in By paper's pane, and none on a view with no pane (`callScriptRecordsJob`).
              onOpenOwnerRecords?.(callScriptRecordsJob({ kind, notice: selected?.jobId ?? null, affidavit: affSelected?.jobId ?? null, retainage: retSelected?.jobId ?? null }))
            } : undefined}
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
          notices={[...monthlyRunNotices(runGcId, runOnlyItemId), ...buildLienRetainageRun(runGcId || runOnlyItemId ? [] : data.retainage.piles.ready, data, issuer, signerNameFor, todayYmd, signerPhoneFor, runSignOpts)]}
          stripeMode={authRole === 'dev' ? getBillingStripeModePref() : 'live'}
          issuer={issuer}
          todayYmd={todayYmd}
          userId={authUserId}
          onClose={() => {
            setRunOpen(false)
            setRunTakeBack(false)
            setRunGcId(null)
            setRunOnlyItemId(null)
            setRunFocus(null)
          }}
          openOnTakeBack={runTakeBack}
          focusMailItemId={runFocus}
          onRecorded={onChanged}
          viewer={{ userId: authUserId, name: authName }}
          properties={runProperties}
          onOpenProperty={(addressId) => openProperty(addressId)}
        />
      ) : null}
    </section>
  )
}
