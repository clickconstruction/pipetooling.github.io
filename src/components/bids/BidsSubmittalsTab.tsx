/**
 * The Submittals tab (Submittals stage 2b — to-dos/submittals/README.md):
 * a lens on the product decisions already made on the Pricing compare. One
 * revision at a time, one row per fixture tag: the specified product from the
 * plan's schedule (`bid_specified_products`), the submitted product from the
 * picked quote line, the status, the reason and lead time typed at the pick,
 * the cut-sheet pages, and — after a second revision — what changed. Rows are
 * BUILT from the picks (`buildSubmittalRows`), never typed from scratch;
 * every cell can be edited in place; a new revision carries every row and
 * marks the diff. The package PDF (2c), the page strip (3a) and Share (4a)
 * hang off this same screen. Stage 2c adds the package: the cover table and
 * every row's sheet pages, stamped, as one PDF stored on the revision. Stage
 * 3a adds the sheet strip: the vendor PDF's pages as thumbnails, a tap per
 * page onto a row, and Done with this file — the PDF trimmed to the pages on
 * rows (`trimPdf`), the rows' page numbers rewritten from the map. Stage 4a
 * adds Share: the bid's one review room (a durable link the GC forwards),
 * the people on it, the trail, and Close; 4a-ii reads their decisions back
 * onto the rows and builds the next revision from the rows sent back.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { smallMuted, btn, btnPrimary, btnQuiet, btnGreen } from './submittalTabStyles'
import { RoadSection, type RoadStatus } from './SubmittalRoadSection'
import { SubmittalRowsTable } from './SubmittalRowsTable'
import { SubmittalRoomPanel } from './SubmittalRoomPanel'
import { SubmittalSourcesPanel } from './SubmittalSourcesPanel'
import { robotScheduleNote, scheduleReadHoldsStepOpen } from '../../lib/submittals/robotNote'
import { buildRowCutSheet, cutSheetFileName, rowCutSheetPlan } from '../../lib/submittals/rowCutSheet'
import { SubmittalTheirCallPanel } from './SubmittalTheirCallPanel'
import { SpotlightTour, spotlightTourStepsPresent, type SpotlightTourStep } from '../SpotlightTour'
import { robotSeatState, staleAsk, type RobotSeatRow, type RobotSeatState } from '../../lib/submittals/robotOffer'
import { SeeWhatTheGcSees } from './SeeWhatTheGcSees'
import { describeForReviewer, emailedRecordLine, isRoomClosed, linkViewOf } from '../../lib/submittals/seeWhatTheySee'
import { SubmittalJourneyStrip } from './SubmittalJourneyStrip'
import { SubmittalProcurementPanel } from './SubmittalProcurementPanel'
import { PlugInScheduleModal } from './PlugInScheduleModal'
import { SubmittalTakeoffPicker } from './SubmittalTakeoffPicker'
import { loadTakeoffCandidates, saveTakeoffChoices, type TakeoffCandidatesLoad } from '../../lib/submittals/takeoffCandidatesIo'
import { candidateToItemInserts, rowSplitTags, splitExplanation, type TakeoffCandidate } from '../../lib/submittals/takeoffCandidates'
import { carryPartInsert, copyPartInsert, formatPartQty, leftOutPieceKeys, partPieceKey, partsByItem, partsFromPieces, rollUpFromParts, submittedParts, type PartDraft, type SubmittalPartInsert, type SubmittalPartRow } from '../../lib/submittals/itemParts'
import { applyPartWrites, clearEnteredCallsOnParts, enterCallOnParts, insertItemParts, loadItemParts, moveProcurementLines, saveItemParts, writeRowCallFromParts } from '../../lib/submittals/itemPartsIo'
import { foldSuggestions, foldWrites, planTakeoffRefresh, takeoffRefreshWrites } from '../../lib/submittals/refreshFromTakeoff'
import { SplitRuleModal } from './SplitRuleModal'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { procurementItemsFrom } from '../../lib/submittals/procurementLogIo'
import type { ProcurementItemSource } from '../../lib/submittals/procurementLog'
import { showNextRevisionLoop, submittalJourney, type JourneyAction, type JourneyStage, type JourneyStageKey, stageGate } from '../../lib/submittals/submittalJourney'
import { SUBMITTAL_GUIDE_HREF, SUBMITTAL_STAGE_ABOUT, SUBMITTAL_TOUR_STEPS, stageAbout, hasOpenEveryStage, tourStopForStage, hasSeenSubmittalWalkthrough, markSubmittalWalkthroughSeen, rememberOpenEveryStage } from '../../lib/submittals/submittalTour'
import type { SupabaseClient } from '@supabase/supabase-js'

import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useAuth } from '../../hooks/useAuth'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import type { useBidPreview } from '../../contexts/BidPreviewModalContext'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { bidDisplayName, bidWorkflowTabHeading } from '../../lib/bids/bidFormatting'
import { bidDetailCloseXStyle } from '../../lib/bids/bidStyles'
import { bidNumberMatchesQuery } from '../../lib/ledgerDisplayPrefixes'
import { BidPickerStandardList } from './BidPickerStandardList'
import { BidPickerSearchRow } from './BidPickerSearchRow'
import { BidWorkflowTabTitleWithPreview } from './BidWorkflowTabTitleWithPreview'
import { SubmittalItemEditDialog, type SubmittalItemPatch } from './SubmittalItemEditDialog'
import { SubmittalHouseFileModal } from './SubmittalHouseFileModal'
import { SubmittalFoldModal, SubmittalScheduleGradeModal, SubmittalTakeoffRefreshModal } from './SubmittalRefreshModals'
import { gradePatch, planScheduleGrade } from '../../lib/submittals/gradeAgainstSchedule'
import { openOrSaveFromStorage, saveBlobAs, saveFromStorage } from '../../lib/storageSave'
import { matchFileToRows, pairParts, defaultFileChoice, planFileApply, readHouseFile, type FileTagChoice, type FileTagMatch, type HouseFileRead } from '../../lib/submittals/houseFileParts'
import { SubmittalApproveAllDialog, type ApproveAllChoice } from './SubmittalApproveAllDialog'
import { SubmittalAnswerDialog, type AnswerSave } from './SubmittalAnswerDialog'
import { SubmittalSheetStrip, type ThumbState } from './SubmittalSheetStrip'
import { SubmittalAssignPagesModal } from './SubmittalAssignPagesModal'
import type { ItemWrite } from '../../lib/submittals/assignPagesWalk'
import { SubmittalShareModal } from './SubmittalShareModal'
import { SubmittalResubmitChooser } from './SubmittalResubmitChooser'
import { describeRoomLine, roomLink, type SubmittalEventRow, type SubmittalPersonRow, type SubmittalRoomRow, parseRoomMessage, threadOrder } from '../../lib/submittals/submittalRoom'
import { replyToRoom } from '../../lib/submittals/replyToRoom'
import type { RoomMessage } from '../../../supabase/functions/_shared/submittalRoomPayload'
import { isReviewerAnswer, loadRevisionStandings, revisionStandings, type RevisionStanding } from '../../../supabase/functions/_shared/submittalRecord'
import { APP_CALENDAR_TZ as ROOM_TZ, todayYmdInAppTz } from '../../utils/dateUtils'
import { boughtWords, gcRows, isOrderOnlyRow, orderOnlyInsert, orderOnlyRows } from '../../lib/submittals/orderOnly'
import { revisionWasRead, rowsThatStand } from '../../lib/submittals/standingRows'
import { loadBidOrderFacts, loadPartOrderWords, loadRowOrderFacts, rememberLeftOutLines, writeRowOrderOnly } from '../../lib/submittals/orderOnlyIo'
import { planRowsAdded, planSummary, standsLine, type TakeoffPlan } from '../../lib/submittals/takeoffPicks'
import { SubmittalTakeOffDialog } from './SubmittalTakeOffDialog'
import { approvedPartsGoingOn, decisionsAsText, describeDecisions, resubmitCaption, resubmitChooser, resubmitHasChoice, resubmitLabel, resubmitNothingSent, resubmitOneKind, resubmitSplit, startDraftLabel, summarizeDecisions, type ResubmitRows } from '../../lib/submittals/reviewDecisions'
import { parseReviewerFiles, reviewerFileKind, reviewerFilePath, serializeReviewerFiles, type ReviewerFile } from '../../lib/submittals/reviewerFiles'
import { CLEAR_DECISION_PATCH, enteredDecisionAt, enteredDecisionPatch, enteredEntryBody, rowsToApproveAll } from '../../lib/submittals/enteredDecisions'
import { matchRoomPerson, type ReviewerChoice, type ReviewerSources } from '../../lib/submittals/reviewerPick'
import { newRoomToken } from '../../lib/submittals/submittalRoom'
import { confirmLabel, guessByPage, liveTask, redlinesToConfirm, sheetGuessesToConfirm, taskInput, taskStatus, type SubmittalTaskRow } from '../../lib/submittals/robotTasks'
import { describeTask, type SubmittalTaskKind } from '../../../supabase/functions/_shared/submittalRobot'
import { keptPages, remapAfterTrim } from '../../lib/submittals/sheetAssignment'
import { assignmentsFromItems } from '../../lib/submittals/sheetStripModel'
import { buildSubmittalRows, summarizeChanges, type PickInput, type SpecifiedInput } from '../../lib/submittals/buildSubmittalRows'
import { REASON_LABELS, type StatusOverride, STATUS_LABELS, STATUS_MEANINGS, type ProductStatus } from '../../lib/submittals/productStatus'
import { describeLeadTime } from '../../lib/submittals/leadTime'
import { buildCoverModel, buildSubmittalPackage, packageFileName, packageSheets, planPackage, renderCoverPdf, type PackageRowInput } from '../../lib/submittals/submittalPackage'
import { cachedTestReportSettings, fetchTestReportSettings } from '../../lib/jobs/testReportSettings'
import type { TestReportSettings } from '../../lib/jobs/testReport'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { createFirstRevisionFromPicks, loadPicksForBid, overridesByTag as overridesByTagOf, setSubmittalsNotNeeded } from '../../lib/submittals/firstRevisionClient'
import {
  asDecision,
  asReason,
  asRevisionStatus,
  asStatus,
  describeRevision, describeWhatIsLeft,
  buildPackageLabel,
  describeRevisionChip,
  revisionAnsweredAt,
  sentByEmailLine,
  rowsOwingSheet,
  sheetsToFollowConfirm,
  draftToItemInsert,
  formatShortDate,
  itemToPrevious,
  parseSourceFiles,
  revisionTiles,
  serializeSourceFiles,
  SUBMITTALS_BUCKET,
  type SourceFile,
  type SubmittalItemRow,
  type SubmittalRevisionRow, blankSubmittalItem, carriedRowInsert, NEW_ROW_ID, rowsToCarry } from '../../lib/submittals/submittalRevision'

// The stage 1–2 tables are hand-typed until the regen chore; the untyped client keeps a checkout ahead of the push honest.
const db = supabase as unknown as SupabaseClient




export type BidsSubmittalsTabProps = {
  bids: BidWithBuilder[]
  selectedBid: BidWithBuilder | null
  narrowViewport640: boolean
  bidPreview: ReturnType<typeof useBidPreview>
  onSelectBid: (bid: BidWithBuilder) => void
  onClose: () => void
  /** The door to the Pricing tab, where the fixture schedule is plugged in and the prices picked. */
  onOpenPricing?: (bid: BidWithBuilder) => void
  onlyMyBids: boolean
  setOnlyMyBids: (next: boolean) => void
  isMyBid: (bid: BidWithBuilder) => boolean
}

async function downloadFile(path: string): Promise<ArrayBuffer> {
  const { data, error } = await supabase.storage.from(SUBMITTALS_BUCKET).download(path)
  if (error || !data) throw error ?? new Error('Could not read the file.')
  return data.arrayBuffer()
}

export function BidsSubmittalsTab({ bids, selectedBid, narrowViewport640, bidPreview, onSelectBid, onClose, onOpenPricing, onlyMyBids, setOnlyMyBids, isMyBid }: BidsSubmittalsTabProps) {
  const { showToast } = useToastContext()
  const confirm = useConfirmDialog()
  const { user, profileName } = useAuth()
  const prefixMap = useLedgerPrefixMap()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [specified, setSpecified] = useState<SpecifiedInput[]>([])
  const [picks, setPicks] = useState<PickInput[]>([])
  const [overridesByFixture, setOverridesByFixture] = useState<Map<string, StatusOverride>>(() => new Map())
  const [revisions, setRevisions] = useState<SubmittalRevisionRow[]>([])
  const [selectedRevId, setSelectedRevId] = useState<string | null>(null)
  const [items, setItems] = useState<SubmittalItemRow[]>([])
  // Parts, not assemblies (2026-10-01): each row's parts — what is bought and what the GC reviews.
  const [parts, setParts] = useState<SubmittalPartRow[]>([])
  // The road (v2.4090): "Open every stage" (remembered per device) and the per-section toggles.
  const [openAllStages, setOpenAllStages] = useState<boolean>(() => hasOpenEveryStage())
  // By hand (v2.4090): the schedule typed or pasted here, no robot and no trip to Pricing.
  const [plugInOpen, setPlugInOpen] = useState(false)
  // From the takeoff (v2.4107): the takeoff's fixtures as candidates, and the picker (build = Rev 1 from them, add = onto the draft).
  const [takeoff, setTakeoff] = useState<TakeoffCandidatesLoad | null>(null)
  const [takeoffPicker, setTakeoffPicker] = useState<'build' | 'add' | null>(null)
  /** 2026-10-02 · by count row, what the log holds for its rows on the draft ("Ordered 09/23"): such a fixture cannot be left out. */
  const [takeoffBought, setTakeoffBought] = useState<Map<string, string>>(() => new Map())
  /** By count row, then by a part's takeoff key: the same for each part of a row on the draft. */
  const [takeoffBoughtParts, setTakeoffBoughtParts] = useState<Map<string, Map<string, string>>>(() => new Map())
  // v2.4118 · "When a row can split", opened from the rows' footer.
  const [splitRuleOpen, setSplitRuleOpen] = useState(false)
  /** 2026-10-01 · a draft catching up: the takeoff's parts on its rows, a hand row folded into a fixture. */
  const [refreshOpen, setRefreshOpen] = useState(false)
  // v2.4609 · the schedule, typed after the takeoff built the rows, grades them.
  const [gradeOpen, setGradeOpen] = useState(false)
  const [foldFrom, setFoldFrom] = useState<{ fromId: string; intoId: string | null } | null>(null)
  const [sectionToggles, setSectionToggles] = useState<Partial<Record<JourneyStageKey, boolean>>>({})
  // Procure (v2.4083): the newest revision's rows as the log reads them, and the counts the strip's pill lights on.
  const [procItems, setProcItems] = useState<ProcurementItemSource[]>([])
  /** 2026-10-02 · the rows approved on an earlier shared revision whose tag the newest no longer holds (`rowsThatStand`): on the log, with their parts; nowhere else. */
  // 2026-10-03 · the newest answer on each earlier revision's rows, by revision id: a replaced draft that holds answers reads "answered", not "superseded".
  const [answeredByRev, setAnsweredByRev] = useState<Map<string, string>>(() => new Map())
  const [standing, setStanding] = useState<{ items: SubmittalItemRow[]; parts: SubmittalPartRow[]; revOf: Map<string, number> }>({ items: [], parts: [], revOf: new Map() })
  const [procCounts, setProcCounts] = useState<{ released: number; ordered: number; delivered: number; late: number; steps: { gc: number; to_order: number; on_order: number; on_site: number }; gcLabel: string } | null>(null)
  const [reportSettings, setReportSettings] = useState<TestReportSettings>(() => cachedTestReportSettings())
  const companyName = reportSettings.companyName
  const [prevItems, setPrevItems] = useState<SubmittalItemRow[]>([])
  const [editing, setEditing] = useState<SubmittalItemRow | null>(null)
  /** 2026-10-02 · the part a Procure line opened the Edit window on, or its house cell on a row with no parts; gone when the window closes. */
  const [editFocus, setEditFocus] = useState<{ itemId: string; partId: string | null; house: boolean } | null>(null)
  useEffect(() => {
    if (!editing) setEditFocus(null)
  }, [editing])
  /** 2026-10-02 · by part id, what the log holds for the parts of the row in the Edit window: an ordered part cannot be left out. */
  const [editBought, setEditBought] = useState<Map<string, string>>(() => new Map())
  const [approvingAll, setApprovingAll] = useState(false)
  /** 2026-10-02 · the row whose answer window is open: what the reviewer said, part by part. */
  const [answering, setAnswering] = useState<SubmittalItemRow | null>(null)
  /** 2026-10-02 · the part a procurement log line opened the answer window on; gone when the window closes. */
  const [answerFocus, setAnswerFocus] = useState<{ itemId: string; partId: string | null } | null>(null)
  useEffect(() => {
    if (!answering) setAnswerFocus(null)
  }, [answering])
  /** The GC's contacts the app already holds, offered as who answered. */
  const [gcContacts, setGcContacts] = useState<ReviewerSources['contacts']>([])
  const gcCustomerId = selectedBid?.customer_id ?? null
  useEffect(() => {
    setGcContacts([])
    if (!gcCustomerId) return
    let alive = true
    void (async () => {
      try {
        const data = await withSupabaseRetry(() => db.from('customer_contact_persons').select('id, name, email').eq('customer_id', gcCustomerId).order('name'), 'load the GC contacts')
        if (alive) setGcContacts(((data ?? []) as Array<{ id: string; name: string | null; email: string | null }>).filter((c) => c.name?.trim()).map((c) => ({ id: c.id, name: c.name!.trim(), email: c.email })))
      } catch {
        // The picker still offers the GC by name and a typed person.
      }
    })()
    return () => {
      alive = false
    }
  }, [gcCustomerId])
  const reviewerSources: ReviewerSources = useMemo(() => ({ gcName: selectedBid?.customers?.name ?? selectedBid?.bids_gc_builders?.name ?? null, contacts: gcContacts }), [selectedBid, gcContacts])
  /** 2026-10-02 · the × on a draft row: the row, and what the log already holds for it ("Ordered 09/23"; '' = nothing bought). */
  const [takeOff, setTakeOff] = useState<{ item: SubmittalItemRow; bought: string } | null>(null)
  const fileInput = useRef<HTMLInputElement | null>(null)
  const bidsRef = useRef(bids)
  bidsRef.current = bids
  const reviewerInput = useRef<HTMLInputElement | null>(null)
  /** Stage 3a: page thumbnails per vendor file, keyed by bucket path; drawn on demand. */
  const [thumbs, setThumbs] = useState<Record<string, ThumbState>>({})
  /** v2.4143: the file open in the Assign pages walk. */
  const [assignFile, setAssignFile] = useState<number | null>(null)
  /** 2026-10-01 · a house's file read into its parts, open in the review before anything is written. */
  const [houseFile, setHouseFile] = useState<{ fileIndex: number; read: HouseFileRead; matches: FileTagMatch[] } | null>(null)
  /** Stage 4a: the bid's review room, the people on it, the events behind the trail. */
  const [room, setRoom] = useState<SubmittalRoomRow | null>(null)
  const [people, setPeople] = useState<SubmittalPersonRow[]>([])
  const [events, setEvents] = useState<SubmittalEventRow[]>([])
  // v2.4067: the walkthrough, and the first-open offer (remembered per device).
  const [tourOpen, setTourOpen] = useState(false)
  const [tourStage, setTourStage] = useState<number | null>(null)
  const [statusLegendOpen, setStatusLegendOpen] = useState(false)
  // v2.4248 · the supply houses: the row editor's picker, and the name under each row's product. One read; a failed read hides both.
  const [houses, setHouses] = useState<Array<{ id: string; name: string; default_lead_time_days: number | null }>>([])
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        // v2.4685 · with the house's usual lead time; until the column is pushed, the names alone.
        const data = await withSupabaseRetry(() => db.from('supply_houses').select('id, name, default_lead_time_days').order('name'), 'load supply houses').catch(() => withSupabaseRetry(() => db.from('supply_houses').select('id, name').order('name'), 'load supply houses'))
        if (!cancelled) setHouses(((data ?? []) as Array<{ id: string; name: string; default_lead_time_days?: number | null }>).filter((h) => h.name?.trim()).map((h) => ({ id: h.id, name: h.name, default_lead_time_days: h.default_lead_time_days ?? null })))
      } catch {
        if (!cancelled) setHouses([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])
  const houseNameById = useMemo(() => new Map(houses.map((h) => [h.id, h.name] as const)), [houses])
  // v2.4189 · the pane beside the road that draws the GC's page from the rows as they stand (#62 Layer 2).
  const [seeGcOpen, setSeeGcOpen] = useState(false)
  // v2.4136 · whether a robot seat is live (punch list #59): no offer shows until it is. Not live until the reader answers, so nothing flashes.
  const [robotSeat, setRobotSeat] = useState<RobotSeatState>(() => robotSeatState(null, Date.now()))
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { data } = await (db.rpc as unknown as (fn: string) => PromiseLike<{ data: unknown; error: unknown }>)('submittal_robot_liveness')
        if (!cancelled) setRobotSeat(robotSeatState((data ?? null) as RobotSeatRow | null, Date.now()))
      } catch {
        if (!cancelled) setRobotSeat(robotSeatState(null, Date.now()))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])
  // v2.4134 · the stops the tour will walk: computed after the road opens every stage for the
  // tour (the anchors inside folded stages are not in the DOM before that), so a stop with no
  // `missingBody` — the robot's offer — is walked only when it is on the page.
  const [tourSteps, setTourSteps] = useState<SpotlightTourStep[] | null>(null)
  useLayoutEffect(() => {
    if (tourOpen && tourSteps == null) setTourSteps(spotlightTourStepsPresent(SUBMITTAL_TOUR_STEPS))
  }, [tourOpen, tourSteps])
  const [offerWalkThrough, setOfferWalkThrough] = useState(() => !hasSeenSubmittalWalkthrough())
  /** Stage 5a: the room's thread and the office's reply box. */
  const [messages, setMessages] = useState<RoomMessage[]>([])
  // 6b · the robot's tasks on this bid (queued · working · ready · blocked · done)
  const [tasks, setTasks] = useState<SubmittalTaskRow[]>([])
  const [lookChecked, setLookChecked] = useState<Record<string, boolean>>({})
  /** The row whose cut sheet is being cut into its own PDF. */
  const [savingSheetId, setSavingSheetId] = useState<string | null>(null)
  const [messageRows, setMessageRows] = useState<Array<{ id: string; submittal_id: string | null; tags: string[]; metadata: unknown; author_kind: string; kind: string }>>([])
  const [threadOpen, setThreadOpen] = useState(false)
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [replying, setReplying] = useState(false)
  const [sharing, setSharing] = useState(false)
  // Step 7's question, open: the next revision as planned, and which rows the owner has ticked.
  const [nextDraft, setNextDraft] = useState<Awaited<ReturnType<typeof planNextRevision>> | null>(null)
  const [nextDraftRows, setNextDraftRows] = useState<ResubmitRows>('need')

  const bidId = selectedBid?.id ?? null
  // 2026-10-06 · the GC's record: the revisions the room serves (shared, or answered by email with a package built),
  // read by the three room functions' own rule (`_shared/submittalRecord.ts`). Read again when a share, a package
  // or a typed answer changes; until it lands, the shared revisions stand in.
  const [standings, setStandings] = useState<{ bidId: string; list: RevisionStanding[] } | null>(null)
  const revisionsKey = revisions.map((r) => `${r.id}:${r.shared_at ?? ''}:${r.package_path ?? ''}`).join('|')
  const answersKey = [...items, ...parts].map((x) => `${x.id}:${x.review_decision ?? ''}:${x.decision_source ?? ''}`).join('|')
  useEffect(() => {
    if (!bidId) return
    let cancelled = false
    void loadRevisionStandings(db, bidId)
      .then((list) => { if (!cancelled) setStandings({ bidId, list }) })
      .catch(() => { if (!cancelled) setStandings(null) })
    return () => {
      cancelled = true
    }
  }, [bidId, revisionsKey, answersKey])
  const recordList = standings && standings.bidId === bidId ? standings.list : revisionStandings(revisions, new Map())
  // The won question's "not needed on this job" (4c) — local so undo reads back at once.
  const [notNeededAt, setNotNeededAt] = useState<string | null>(null)
  useEffect(() => {
    setNotNeededAt(selectedBid?.submittals_not_needed_at ?? null)
  }, [selectedBid])

  const loadRevisions = useCallback(async (id: string): Promise<SubmittalRevisionRow[]> => {
    try {
      const { data, error } = await db.from('bid_submittals').select('*').eq('bid_id', id).order('rev_number', { ascending: false })
      if (error) return []
      return (data ?? []) as SubmittalRevisionRow[]
    } catch {
      return []
    }
  }, [])

  const loadItems = useCallback(async (revId: string): Promise<SubmittalItemRow[]> => {
    try {
      const { data, error } = await db.from('bid_submittal_items').select('*').eq('submittal_id', revId).order('sequence_order')
      if (error) return []
      return (data ?? []) as SubmittalItemRow[]
    } catch {
      return []
    }
  }, [])

  const loadRoom = useCallback(async (id: string) => {
    try {
      const { data: r } = await db.from('bid_submittal_rooms').select('*').eq('bid_id', id).maybeSingle()
      const theRoom = (r as SubmittalRoomRow | null) ?? null
      setRoom(theRoom)
      if (!theRoom) {
        setPeople([])
        setEvents([])
        return
      }
      const [{ data: ps }, { data: es }, { data: ms }] = await Promise.all([
        db.from('bid_submittal_people').select('*').eq('room_id', theRoom.id).order('created_at'),
        db.from('bid_submittal_events').select('id, room_id, person_id, submittal_id, event_type, metadata, client_ip, user_agent, occurred_at').eq('room_id', theRoom.id).order('occurred_at', { ascending: false }).limit(500),
        // Stage 5a: the thread, with the person's name for the room's words. A missing table (pre-push) reads as none.
        db.from('bid_submittal_messages').select('id, created_at, author_kind, body, kind, tags, metadata, submittal_id, person_id, bid_submittal_people(name), bid_submittals(rev_number)').eq('room_id', theRoom.id).order('created_at'),
      ])
      setPeople((ps ?? []) as SubmittalPersonRow[])
      setEvents((es ?? []) as SubmittalEventRow[])
      const rows = ((ms ?? []) as Array<Record<string, unknown>>)
      setMessageRows(rows.map((m) => ({ id: String(m.id), submittal_id: typeof m.submittal_id === 'string' ? m.submittal_id : null, tags: Array.isArray(m.tags) ? (m.tags as string[]) : [], metadata: m.metadata, author_kind: String(m.author_kind), kind: String(m.kind) })))
      setMessages(
        threadOrder(
          rows
            .map((m) => {
              const p = m.bid_submittal_people as { name: string } | null
              const sub = m.bid_submittals as { rev_number: number } | null
              const kind = String(m.author_kind)
              return parseRoomMessage({ id: m.id, at: m.created_at, authorKind: kind, authorName: kind === 'office' ? 'Click Plumbing' : (p?.name ?? null), body: m.body, kind: m.kind, revNumber: sub?.rev_number ?? null, tags: m.tags })
            })
            .filter((m): m is RoomMessage => m != null),
        ),
      )
    } catch {
      setRoom(null)
    }
  }, [])

  /** Stage 5a: answer an ask from the tab — the one reply path (replyToRoom): the message, the email, the closed inbox row. */
  const sendReply = useCallback(async () => {
    if (!room || !replyTo || !replyBody.trim()) return
    const ask = messageRows.find((m) => m.id === replyTo)
    if (!ask) return
    setReplying(true)
    try {
      const r = await replyToRoom({ roomId: room.id, ask: { id: ask.id, submittalId: ask.submittal_id, tags: ask.tags, metadata: ask.metadata }, body: replyBody, authorUserId: user?.id ?? null })
      showToast(r.emailed ? `Answered${r.closedRequest ? ' — the inbox request is closed' : ''}. They have it by email too.` : `Answered on the room${r.closedRequest ? ' — the inbox request is closed' : ''}. The email did not go: ${r.emailError ?? 'unknown'}.`, r.emailed ? 'success' : 'error')
      setReplyBody('')
      setReplyTo(null)
      if (bidId) await loadRoom(bidId)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not send the answer.', 'error')
    } finally {
      setReplying(false)
    }
  }, [room, replyTo, replyBody, messageRows, user?.id, showToast, bidId, loadRoom])

  const loadTasks = useCallback(async (id: string) => {
    try {
      const { data } = await db.from('bid_submittal_tasks').select('id, bid_id, submittal_id, kind, input, result, status, requested_at, claimed_at, finished_at, reviewed_at, summary').eq('bid_id', id).order('requested_at', { ascending: false }).limit(50)
      setTasks((data ?? []) as SubmittalTaskRow[])
    } catch {
      setTasks([])
    }
  }, [])

  const load = useCallback(
    async (id: string) => {
      setLoading(true)
      try {
        // The schedule and the picks — the same read the won question makes (firstRevisionClient).
        const derived = await loadPicksForBid(db, id)
        setSpecified(derived.specified)
        setPicks(derived.picks)
        setOverridesByFixture(derived.overridesByFixture)
        const revs = await loadRevisions(id)
        setRevisions(revs)
        // v2.4107 · the takeoff's fixtures (the selected version's rows win over the base rows); none is not an error.
        try {
          setTakeoff(await loadTakeoffCandidates(db, id, { selectedVersionId: bidsRef.current.find((b) => b.id === id)?.selected_bid_version_id ?? null }))
        } catch {
          setTakeoff(null)
        }
        await loadRoom(id)
        await loadTasks(id)
        const keep = revs.find((r) => r.id === selectedRevId) ?? revs[0] ?? null
        setSelectedRevId(keep?.id ?? null)
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Could not load the submittal.', 'error')
      } finally {
        setLoading(false)
      }
    },
    // selectedRevId is read for "keep the selection", never a reason to reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadRevisions, loadRoom, loadTasks, showToast],
  )

  useEffect(() => {
    if (!bidId) {
      setRevisions([])
      setItems([])
      setPrevItems([])
      setSelectedRevId(null)
      return
    }
    void load(bidId)
  }, [bidId, load])

  const selectedRev = useMemo(() => revisions.find((r) => r.id === selectedRevId) ?? null, [revisions, selectedRevId])
  const previousRev = useMemo(() => (selectedRev ? revisions.find((r) => r.rev_number === selectedRev.rev_number - 1) ?? null : null), [revisions, selectedRev])
  const newestRev = revisions[0] ?? null

  useEffect(() => {
    let cancelled = false
    if (!selectedRev) {
      setItems([])
      setPrevItems([])
      return
    }
    void (async () => {
      const [its, prev] = await Promise.all([loadItems(selectedRev.id), previousRev ? loadItems(previousRev.id) : Promise.resolve([] as SubmittalItemRow[])])
      if (cancelled) return
      setItems(its)
      setPrevItems(prev)
    })()
    return () => {
      cancelled = true
    }
  }, [selectedRev, previousRev, loadItems])

  const sourceFiles: SourceFile[] = useMemo(() => parseSourceFiles(selectedRev?.source_files ?? null), [selectedRev])
  // The walk's inputs, stable per file (v2.4192): the modal opens the file once per path, and
  // nothing this tab re-renders for hands it a new callback or a new guesses map.
  const assignPath = assignFile != null ? sourceFiles[assignFile]?.path ?? null : null
  const assignLoadBytes = useCallback(() => (assignPath ? downloadFile(assignPath) : Promise.reject(new Error('No file.'))), [assignPath])
  const assignGuesses = useMemo(() => {
    const f = assignFile != null ? sourceFiles[assignFile] : undefined
    if (!f) return undefined
    const t = liveTask(tasks, 'file_cut_sheets', (inp) => inp.file_index === assignFile && (!inp.path || inp.path === f.path))
    const g = t ? sheetGuessesToConfirm(t, f.pages) : null
    return g ? guessByPage(g) : undefined
  }, [assignFile, sourceFiles, tasks])
  const reviewerFiles: ReviewerFile[] = useMemo(() => parseReviewerFiles((selectedRev as { reviewer_files?: unknown } | null)?.reviewer_files ?? null), [selectedRev])
  // 2026-10-02 · the rows the GC sees: an order-only row is bought, never counted, packaged or called.
  const gcItems = useMemo(() => gcRows(items), [items])
  const orderOnlyItems = useMemo(() => orderOnlyRows(items), [items])
  const tiles = useMemo(() => revisionTiles(gcItems), [gcItems])
  // The parts reload whenever the rows do (every write reloads the rows).
  useEffect(() => {
    let cancelled = false
    const ids = items.map((it) => it.id)
    if (ids.length === 0) {
      setParts([])
      return
    }
    void loadItemParts(db, ids).then((rows) => {
      if (!cancelled) setParts(rows)
    })
    return () => {
      cancelled = true
    }
  }, [items])
  // The standing rows' parts sit in the same map, so their Edit window and the bought-parts read work unchanged.
  const partsOf = useMemo(() => partsByItem(standing.parts.length > 0 ? [...parts, ...standing.parts] : parts), [parts, standing.parts])
  // 2026-10-02 · the Edit window on a draft row: which of its parts the log already holds an order for.
  useEffect(() => {
    setEditBought(new Map())
    if (!editing || !bidId || editing.id === NEW_ROW_ID || !selectedRev || asRevisionStatus(selectedRev.status) !== 'draft') return
    let cancelled = false
    const rowParts = partsOf.get(editing.id) ?? []
    if (rowParts.length === 0) return
    void loadPartOrderWords(supabase, bidId, editing.tag, boughtWords)
      .then((byKey) => {
        if (cancelled) return
        setEditBought(new Map(rowParts.filter((p) => byKey.has(p.procure_key)).map((p) => [p.id, byKey.get(p.procure_key)!])))
      })
      .catch(() => {
        // The log could not be read: every part is treated as bought, so no order is dropped unseen.
        if (!cancelled) setEditBought(new Map(rowParts.map((p) => [p.id, 'The procurement log could not be read'])))
      })
    return () => {
      cancelled = true
    }
    // The window's row decides; its parts are read as they stood when it opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id, bidId, selectedRev?.id, selectedRev?.status])
  const decisions = useMemo(() => summarizeDecisions(gcItems, partsOf), [gcItems, partsOf])
  /** Step 7's button has a choice to offer: rows were sent back, and a row or a part was approved. */
  const draftHasChoice = useMemo(() => {
    const split = resubmitSplit(gcItems)
    return split.sentBack.length > 0 && resubmitHasChoice({ approved: split.approved.length, approvedParts: approvedPartsGoingOn(gcItems, partsOf) })
  }, [gcItems, partsOf])
  // Rows one "they approved all of it" entry would cover: no call yet, and a product to approve.
  const approvableRows = useMemo(() => rowsToApproveAll(gcItems), [gcItems])
  // 2026-10-02 · "Rev N+1 from the rows sent back" leaves the approved rows on Rev N. They are released and
  // still to order, so the log reads them from there: the newest revision that asked about a tag speaks for
  // it, and a call entered by hand on a draft since superseded still counts (`rowsThatStand`). Read again
  // whenever the newest rows do, so a house or a lead time set on a standing row shows.
  useEffect(() => {
    let cancelled = false
    const earlier = selectedRev && newestRev?.id === selectedRev.id ? revisions.filter((r) => r.id !== newestRev.id) : []
    if (earlier.length === 0) {
      setStanding((cur) => (cur.items.length === 0 ? cur : { items: [], parts: [], revOf: new Map() }))
      return
    }
    void (async () => {
      const rows = await Promise.all(earlier.map((r) => loadItems(r.id)))
      const earlierIds = rows.flat().map((it) => it.id)
      const earlierParts = earlierIds.length > 0 ? await loadItemParts(db, earlierIds) : []
      // Approved whole, or part by part: a part the GC approved is released whatever the rest of its row says.
      const approvedParts = new Set(earlierParts.filter((p) => p.on_submittal && asDecision(p.review_decision) === 'approved').map((p) => p.item_id))
      const stands = rowsThatStand([{ rev: newestRev!.rev_number, rows: items }, ...earlier.map((r, i) => ({ rev: r.rev_number, rows: rows[i] ?? [], asked: revisionWasRead(r.status) }))], (it) => asDecision(it.review_decision) === 'approved' || approvedParts.has(it.id))
      if (cancelled) return
      const answered = new Map<string, string>()
      earlier.forEach((r, i) => {
        const ids = new Set((rows[i] ?? []).map((it) => it.id))
        const at = revisionAnsweredAt(rows[i] ?? [], earlierParts.filter((p) => ids.has(p.item_id)))
        if (at) answered.set(r.id, at)
      })
      setAnsweredByRev(answered)
      const standingIds = new Set(stands.map((s) => s.row.id))
      setStanding({ items: stands.map((s) => s.row), parts: earlierParts.filter((p) => standingIds.has(p.item_id)), revOf: new Map(stands.map((s) => [s.row.id, s.rev])) })
    })()
    return () => {
      cancelled = true
    }
  }, [items, revisions, selectedRev, newestRev, loadItems])
  useEffect(() => {
    let cancelled = false
    if (!selectedRev || newestRev?.id !== selectedRev.id) {
      setProcItems([])
      setProcCounts(null)
      return
    }
    void Promise.all([
      procurementItemsFrom(supabase, items, selectedRev.status !== 'draft', parts),
      standing.items.length > 0 ? procurementItemsFrom(supabase, standing.items, true, standing.parts) : Promise.resolve([] as ProcurementItemSource[]),
    ]).then(([newest, stands]) => {
      if (!cancelled) setProcItems([...newest, ...stands.map((src) => ({ ...src, standsOnRev: src.itemId ? standing.revOf.get(src.itemId) ?? null : null }))])
    })
    return () => {
      cancelled = true
    }
  }, [items, parts, selectedRev, newestRev, standing])
  useEffect(() => {
    void fetchTestReportSettings().then(setReportSettings).catch(() => undefined)
  }, [])
  const prevById = useMemo(() => new Map(prevItems.map((p) => [p.id, p])), [prevItems])
  const overridesByTag = useMemo(() => overridesByTagOf({ specified, overridesByFixture }), [specified, overridesByFixture])

  /** Build the rows for a revision from today's picks; `previous` carries sheets, reasons and the diff. */
  async function writeRows(revId: string, previous: SubmittalItemRow[]): Promise<number> {
    const rows = buildSubmittalRows({ specified, picks, previous: previous.map(itemToPrevious), overrides: overridesByTag })
    if (rows.length === 0) return 0
    const { error } = await db.from('bid_submittal_items').insert(rows.map((r) => draftToItemInsert(r, revId)))
    if (error) throw error
    return rows.length
  }

  async function toggleNotNeeded(on: boolean) {
    if (!bidId) return
    setBusy(true)
    try {
      await setSubmittalsNotNeeded(db, bidId, user?.id ?? null, on)
      setNotNeededAt(on ? new Date().toISOString() : null)
      showToast(on ? 'Marked not needed — no submittal card for this job.' : 'The question stands again.', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save that.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function createFirstRevision() {
    if (!bidId) return
    setBusy(true)
    try {
      // The one way a Rev 1 is built from picks, shared with the won question (firstRevisionClient); the picks already on the page ride along.
      const { revId, rows: n } = await createFirstRevisionFromPicks(db, { bidId, userId: user?.id ?? null, picks: { specified, picks, overridesByFixture } })
      setSelectedRevId(revId)
      await load(bidId)
      showToast(`Rev 1 built · ${n} row${n === 1 ? '' : 's'} from the picks.`, 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not build the submittal.', 'error')
    } finally {
      setBusy(false)
    }
  }

  /** v2.4107 · the takeoff's fixtures with the revision's rows already set aside; the door is Rev 1 when there is none, the draft otherwise. */
  const takeoffFixtures = takeoff?.fixtures ?? 0
  const takeoffCandidatesForPicker = useMemo<TakeoffCandidate[]>(() => {
    if (!takeoff) return []
    // How each fixture sits on the draft: a row the GC sees, an order-only row, or not on it.
    const on = new Map<string, 'gc' | 'order'>()
    for (const it of items) if (it.source_count_row_id && on.get(it.source_count_row_id) !== 'gc') on.set(it.source_count_row_id, isOrderOnlyRow(it) ? 'order' : 'gc')
    // The row's takeoff parts by their place on the takeoff, so the window shows each as it sits on the draft.
    // A row with no parts, or with parts from the house's file, has its parts set in Edit.
    const onParts = new Map<string, Array<{ key: string; onSubmittal: boolean }> | null>()
    for (const it of items) {
      if (!it.source_count_row_id || onParts.has(it.source_count_row_id)) continue
      const rowParts = partsOf.get(it.id) ?? []
      const fromTakeoff = rowParts.filter((p) => p.source === 'takeoff' && partPieceKey(p))
      onParts.set(it.source_count_row_id, rowParts.length === 0 || rowParts.some((p) => p.source === 'file') || fromTakeoff.length === 0 ? null : fromTakeoff.map((p) => ({ key: partPieceKey(p)!, onSubmittal: p.on_submittal })))
    }
    // 2026-10-03 · a fixture the GC approved on an earlier revision stands there: it is not on the draft, and it is not left out.
    const standsOn = new Map<string, { rev: number; whole: boolean }>()
    for (const it of standing.items) {
      const rev = standing.revOf.get(it.id)
      if (!it.source_count_row_id || rev == null) continue
      const whole = asDecision(it.review_decision) === 'approved'
      const was = standsOn.get(it.source_count_row_id)
      standsOn.set(it.source_count_row_id, { rev: was ? Math.max(was.rev, rev) : rev, whole: (was?.whole ?? true) && whole })
    }
    return takeoff.candidates.map((c) => ({ ...c, alreadyOn: on.has(c.countRowId), onAs: on.get(c.countRowId) ?? null, onParts: onParts.get(c.countRowId) ?? null, standsOn: on.has(c.countRowId) ? null : standsOn.get(c.countRowId) ?? null }))
  }, [takeoff, items, partsOf, standing])
  /** The takeoff's fixtures that are not on the draft: what the Left out line under the rows counts. */
  const takeoffLeftOut = takeoffCandidatesForPicker.filter((c) => !c.onAs && !c.standsOn).length
  const takeoffStandsLine = standsLine(takeoffCandidatesForPicker)
  function openTakeoffPicker() {
    if (takeoffFixtures === 0) return
    if (revisions.length === 0) setTakeoffPicker('build')
    else if (selectedRev && asRevisionStatus(selectedRev.status) === 'draft') {
      setTakeoffPicker('add')
      void readTakeoffBought()
    }
    else showToast('Rows from the takeoff land on a draft — start a new revision first.', 'info')
  }
  /** What the log holds for the fixtures on the draft and for each of their parts, so the window can hold Left out on what somebody ordered. */
  async function readTakeoffBought() {
    if (!bidId) return
    try {
      const facts = await loadBidOrderFacts(supabase, bidId)
      const rows = new Map<string, string>()
      const partsBought = new Map<string, Map<string, string>>()
      for (const it of items) {
        if (!it.source_count_row_id) continue
        const words = boughtWords(facts.byTag.get(it.tag) ?? [])
        if (words) rows.set(it.source_count_row_id, words)
        for (const p of partsOf.get(it.id) ?? []) {
          const key = partPieceKey(p)
          const w = key ? boughtWords(facts.byPartKey.get(p.procure_key) ?? []) : ''
          if (key && w) partsBought.set(it.source_count_row_id, new Map(partsBought.get(it.source_count_row_id) ?? []).set(key, w))
        }
      }
      setTakeoffBought(rows)
      setTakeoffBoughtParts(partsBought)
    } catch {
      // The log could not be read: every fixture on the draft is treated as bought.
      setTakeoffBought(new Map(items.filter((it) => it.source_count_row_id).map((it) => [it.source_count_row_id!, 'The procurement log could not be read'])))
    }
  }

  /** 2026-10-02 · the window's picks: rows come on (the GC's or order only), rows on the draft move or come off, the bid remembers every pick. */
  async function confirmTakeoff(plan: TakeoffPlan, splits?: ReadonlyMap<string, boolean>) {
    if (!bidId || !takeoffPicker) return
    setBusy(true)
    try {
      let revId: string
      let seq = 0
      if (takeoffPicker === 'build') {
        const { data, error } = await db.from('bid_submittals').insert({ bid_id: bidId, rev_number: 1, status: 'draft', created_by: user?.id ?? null }).select('id').single()
        if (error) throw error
        revId = (data as { id: string }).id
      } else {
        if (!selectedRev) return
        revId = selectedRev.id
        seq = items.reduce((m, it) => Math.max(m, it.sequence_order), 0)
      }
      // v2.4118 · a split candidate becomes one row per tag; the sequence runs on through them.
      const inserts: Array<ReturnType<typeof candidateToItemInserts>[number] & { order_only?: true }> = []
      const fromCandidate: TakeoffCandidate[] = []
      for (const a of plan.add) {
        const made = candidateToItemInserts(a.candidate, revId, seq + inserts.length + 1)
        inserts.push(...made.map((m) => (a.orderOnly ? { ...m, order_only: true as const } : m)))
        for (let k = 0; k < made.length; k++) fromCandidate.push(a.candidate)
      }
      let partsNote = ''
      if (inserts.length > 0) {
        const { data, error } = await db.from('bid_submittal_items').insert(inserts).select('id, sequence_order')
        if (error) throw error
        // Parts, not assemblies: every row carries its fixture's parts — the GC's and the order-only ones.
        const idBySeq = new Map(((data ?? []) as Array<{ id: string; sequence_order: number }>).map((r) => [r.sequence_order, r.id] as const))
        const partRows: SubmittalPartInsert[] = []
        inserts.forEach((ins, i) => {
          const itemId = idBySeq.get(ins.sequence_order)
          const c = fromCandidate[i]
          if (itemId && c && c.pieces.length > 0) partRows.push(...partsFromPieces(c.pieces, c.productKeys, itemId, bidId))
        })
        try {
          await insertItemParts(db, partRows)
        } catch (e) {
          partsNote = ` The parts under each row did not save (${formatErrorMessage(e, 'unknown')}); the rows read as before.`
        }
      }
      // Rows already on the draft: to order only, back to the GC, or off. A split fixture's rows move together.
      const rowsOf = (countRowId: string) => items.filter((it) => it.source_count_row_id === countRowId)
      for (const [ids, on] of [[plan.toOrderOnly, true], [plan.toGc, false]] as const) {
        for (const it of ids.flatMap(rowsOf)) {
          const { error } = await db.from('bid_submittal_items').update({ order_only: on }).eq('id', it.id)
          if (error) throw error
        }
      }
      for (const it of plan.remove.flatMap(rowsOf)) {
        const { error } = await db.from('bid_submittal_items').delete().eq('id', it.id)
        if (error) throw error
      }
      // Rows staying on the draft whose parts were picked differently: each takes the fixture's parts as picked.
      // A part it keeps holds its house, lead time, stage and call; one left out comes off; one brought back comes on.
      const removed = new Set(plan.remove)
      for (const pc of plan.parts) {
        if (removed.has(pc.countRowId)) continue
        for (const it of rowsOf(pc.countRowId)) await applyPartWrites(db, it.id, takeoffRefreshWrites(partsOf.get(it.id) ?? [], pc.candidate, it.id, bidId))
      }
      await saveTakeoffChoices(db, bidId, plan.ticks, splits, plan.productKeys, plan.orderOnly, plan.leftOut)
      setTakeoffPicker(null)
      const proposed = inserts.filter((r) => r.status === 'proposed').length
      const toType = inserts.length - proposed
      if (takeoffPicker === 'build') {
        setSelectedRevId(revId)
        await load(bidId)
        const tail = `${inserts.length} row${inserts.length === 1 ? '' : 's'} from the takeoff · ${proposed} proposed${toType > 0 ? `, ${toType} to type with Edit` : ''}`
        showToast(`Rev 1 built · ${tail}.${partsNote}`, partsNote ? 'info' : 'success')
      } else {
        setItems(await loadItems(revId))
        setTakeoff(await loadTakeoffCandidates(db, bidId, { selectedVersionId: bidsRef.current.find((b) => b.id === bidId)?.selected_bid_version_id ?? null }))
        showToast(`${planRowsAdded(plan) > 0 && plan.toOrderOnly.length + plan.toGc.length + plan.remove.length === 0 ? 'Added' : 'Updated'} · ${planSummary(plan, `Rev ${selectedRev?.rev_number ?? 1}`)}.${partsNote}`, partsNote ? 'info' : 'success')
      }
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not build from the takeoff'), 'error')
    } finally {
      setBusy(false)
    }
  }
  /** What the procurement log already holds for a row: "Ordered 09/23, on site 09/29", or '' when nothing is bought. */
  async function boughtOnLog(it: SubmittalItemRow): Promise<string> {
    if (!bidId) return ''
    try {
      return boughtWords(await loadRowOrderFacts(supabase, bidId, it.tag))
    } catch {
      // The log could not be read: the row is treated as bought, so nothing ordered is dropped unseen.
      return 'The procurement log could not be read'
    }
  }

  /** 2026-10-02 · the × on a row the GC sees: the window asks whether the fixture is still bought. */
  async function askTakeOff(it: SubmittalItemRow) {
    if (!bidId || !selectedRev || asRevisionStatus(selectedRev.status) !== 'draft') return
    setTakeOff({ item: it, bought: await boughtOnLog(it) })
  }

  /** Order only, or back to a row the GC sees; the bid remembers it for a row from the takeoff. */
  async function setOrderOnly(it: SubmittalItemRow, on: boolean) {
    if (!bidId || !selectedRev || asRevisionStatus(selectedRev.status) !== 'draft') return
    setBusy(true)
    try {
      await writeRowOrderOnly(supabase, bidId, it, on)
      setItems(await loadItems(selectedRev.id))
      setTakeOff(null)
      showToast(on ? `${it.tag.trim() || 'The row'} is order only. The GC will not see it; it stays on the procurement log.` : `${it.tag.trim() || 'The row'} is back on the submittal.`, 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, on ? 'Could not set the row order only' : 'Could not put the row back'), 'error')
    } finally {
      setBusy(false)
    }
  }

  /** The × on an order-only row: left out, after one question. A fixture the log holds an order for stays. */
  async function leaveOrderOnlyOut(it: SubmittalItemRow) {
    if (!bidId || !selectedRev || asRevisionStatus(selectedRev.status) !== 'draft') return
    const bought = await boughtOnLog(it)
    if (bought) {
      showToast(`${it.tag.trim() || 'The row'} cannot be left out. ${bought}.`, 'error')
      return
    }
    const ok = await confirm({ title: `Leave ${it.tag.trim() || 'this row'} out`, message: it.source_count_row_id ? 'It leaves this draft and the procurement log. The takeoff list remembers it as left out, so it stays out next time.' : 'It leaves this draft and the procurement log.', confirmLabel: 'Leave out', danger: true })
    if (!ok) return
    await removeRow(it)
  }

  /** Left out: the row leaves the draft (and so the procurement log), and the takeoff list remembers it. */
  async function removeRow(it: SubmittalItemRow) {
    if (!bidId || !selectedRev || asRevisionStatus(selectedRev.status) !== 'draft') return
    setBusy(true)
    try {
      const { error } = await db.from('bid_submittal_items').delete().eq('id', it.id)
      if (error) throw error
      if (it.source_count_row_id) await saveTakeoffChoices(db, bidId, new Map([[it.source_count_row_id, false]]))
      setItems(await loadItems(selectedRev.id))
      setTakeOff(null)
      if (it.source_count_row_id) setTakeoff(await loadTakeoffCandidates(db, bidId, { selectedVersionId: bidsRef.current.find((b) => b.id === bidId)?.selected_bid_version_id ?? null }))
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not remove the row'), 'error')
    } finally {
      setBusy(false)
    }
  }

  /** v2.4118 · a draft row whose tag lists several becomes one row per tag: same product, house, lead time and sheet pages; a takeoff row's split is remembered. */
  async function splitRow(it: SubmittalItemRow) {
    if (!bidId || !selectedRev || asRevisionStatus(selectedRev.status) !== 'draft') return
    const tags = rowSplitTags(it.tag)
    if (tags.length < 2) return
    const ok = await confirm({ title: `Split ${it.tag.trim()} into ${tags.length} rows`, message: `${tags.join(', ')} each get their own row with the same parts, house, lead time and sheet pages. Their calls stay blank until the reviewer decides each one. Nothing changes on the takeoff.`, confirmLabel: `Split into ${tags.length} rows` })
    if (!ok) return
    setBusy(true)
    try {
      // The rows after it move down to make room, so the split rows sit where the one row was.
      const shift = tags.length - 1
      for (const other of items.filter((x) => x.sequence_order > it.sequence_order).sort((a, b) => b.sequence_order - a.sequence_order)) {
        const { error } = await db.from('bid_submittal_items').update({ sequence_order: other.sequence_order + shift }).eq('id', other.id)
        if (error) throw error
      }
      const { error: delErr } = await db.from('bid_submittal_items').delete().eq('id', it.id)
      if (delErr) throw delErr
      const rowParts = partsOf.get(it.id) ?? []
      const { data: made, error } = await db.from('bid_submittal_items').insert(tags.map((tag, i) => ({
        submittal_id: it.submittal_id, tag, sequence_order: it.sequence_order + i,
        specified_manufacturer: it.specified_manufacturer, specified_model: it.specified_model, specified_description: it.specified_description,
        submitted_manufacturer: it.submitted_manufacturer, submitted_model: it.submitted_model, submitted_label: it.submitted_label,
        supply_house_id: it.supply_house_id, source_quote_line_id: it.source_quote_line_id, source_count_row_id: it.source_count_row_id,
        status: it.status, reason_kind: it.reason_kind, reason_note: it.reason_note, lead_time_days: it.lead_time_days,
        sheet_file: it.sheet_file, sheet_pages: it.sheet_pages, sheet_source: it.sheet_source,
        ...orderOnlyInsert(it),
      }))).select('id, sequence_order')
      if (error) throw error
      // Each tag's row gets the fixture's parts; each is bought on its own, so only the first keeps the procurement line.
      if (rowParts.length > 0) {
        const newRows = ((made ?? []) as Array<{ id: string; sequence_order: number }>).sort((a, b) => a.sequence_order - b.sequence_order)
        const copies: SubmittalPartInsert[] = []
        newRows.forEach((r, i) => {
          for (const p of rowParts) copies.push(i === 0 ? carryPartInsert(p, r.id) : copyPartInsert(p, r.id))
        })
        await insertItemParts(db, copies)
      }
      if (it.source_count_row_id) await saveTakeoffChoices(db, bidId, new Map([[it.source_count_row_id, true]]), new Map([[it.source_count_row_id, true]]))
      setItems(await loadItems(selectedRev.id))
      if (it.source_count_row_id) setTakeoff(await loadTakeoffCandidates(db, bidId, { selectedVersionId: bidsRef.current.find((b) => b.id === bidId)?.selected_bid_version_id ?? null }))
      showToast(`Split into ${tags.join(', ')}.`, 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not split the row'), 'error')
    } finally {
      setBusy(false)
    }
  }

  /**
   * 2026-10-01 · Refresh from the takeoff: each draft row the takeoff now reads differently takes
   * its parts (refreshFromTakeoff.ts); a part the takeoff still has keeps what was set on it.
   */
  async function refreshRowsFromTakeoff() {
    if (!bidId || !selectedRev || asRevisionStatus(selectedRev.status) !== 'draft' || !takeoff) return
    setBusy(true)
    try {
      const plan = planTakeoffRefresh(items, partsOf, takeoff.candidates)
      const byCountRow = new Map(takeoff.candidates.map((c) => [c.countRowId, c] as const))
      let n = 0
      for (const r of plan.rows) {
        const it = items.find((x) => x.id === r.itemId)
        const c = it?.source_count_row_id ? byCountRow.get(it.source_count_row_id) : undefined
        if (!it || !c) continue
        await applyPartWrites(db, it.id, takeoffRefreshWrites(partsOf.get(it.id) ?? [], c, it.id, bidId))
        n++
      }
      setRefreshOpen(false)
      setItems(await loadItems(selectedRev.id))
      showToast(`${n} row${n === 1 ? '' : 's'} took the takeoff’s parts.`, 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not refresh from the takeoff'), 'error')
    } finally {
      setBusy(false)
    }
  }
  /** v2.4609 · each Proposed row the schedule names takes the plans' product and the status the comparison gives. */
  async function gradeRowsAgainstSchedule() {
    if (!bidId || !selectedRev || asRevisionStatus(selectedRev.status) !== 'draft') return
    setBusy(true)
    try {
      let n = 0
      for (const r of gradePlan.rows) {
        const { error } = await db.from('bid_submittal_items').update(gradePatch(r)).eq('id', r.itemId)
        if (error) throw error
        n++
      }
      setGradeOpen(false)
      setItems(await loadItems(selectedRev.id))
      showToast(`${n} row${n === 1 ? '' : 's'} graded against the schedule.`, 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not grade the rows'), 'error')
    } finally {
      setBusy(false)
    }
  }
  async function openTakeoffRefresh() {
    if (!bidId) return
    // The takeoff read fresh, so the list shows what it says now.
    try {
      setTakeoff(await loadTakeoffCandidates(db, bidId, { selectedVersionId: bidsRef.current.find((b) => b.id === bidId)?.selected_bid_version_id ?? null }))
    } catch {
      // The takeoff already loaded stands.
    }
    setRefreshOpen(true)
  }

  /**
   * 2026-10-01 · Make it a part of…: a draft row typed by hand for another row's fixture (BP375's
   * carriers) becomes a part of that row; its order dates move onto the part, then the row leaves.
   */
  async function foldRowInto(fromId: string, intoId: string, replaceId: string | null = null) {
    const from = items.find((x) => x.id === fromId)
    const into = items.find((x) => x.id === intoId)
    if (!bidId || !selectedRev || asRevisionStatus(selectedRev.status) !== 'draft' || !from || !into) return
    setBusy(true)
    try {
      const plan = foldWrites(from, into, partsOf.get(into.id) ?? [], bidId, () => crypto.randomUUID(), { replaceId })
      await applyPartWrites(db, into.id, plan)
      // The row's call reads its parts: a carrier the GC has not called leaves the fixture open.
      await writeRowCallFromParts(db, into.id)
      // A tag another row still carries keeps its own line.
      const moves = plan.moveLines.filter((m) => m.tag === into.tag.trim() || !items.some((x) => x.id !== from.id && x.tag.trim() === m.tag))
      await moveProcurementLines(db, bidId, moves, into.tag.trim())
      const { error } = await db.from('bid_submittal_items').delete().eq('id', from.id)
      if (error) throw error
      setFoldFrom(null)
      setItems(await loadItems(selectedRev.id))
      showToast(`${from.tag.trim() || 'The row'} is now a part of ${into.tag.trim() || 'the row'}.`, 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not make it a part'), 'error')
    } finally {
      setBusy(false)
    }
  }

  /**
   * The parts of the rows a new revision carried: a row carried as it stood takes its parts; a row
   * the picks rebuilt takes them only while its product is the same.
   */
  async function carryPartsOnto(newRows: ReadonlyArray<{ id: string; carried_from_item_id: string | null; submitted_label: string | null }>, previous: ReadonlyArray<SubmittalItemRow>, previousParts: Map<string, SubmittalPartRow[]>, keepApprovals = false) {
    const prevById = new Map(previous.map((p) => [p.id, p] as const))
    const copies: SubmittalPartInsert[] = []
    for (const r of newRows) {
      const was = r.carried_from_item_id ? prevById.get(r.carried_from_item_id) : undefined
      if (!was || (r.submitted_label ?? '') !== (was.submitted_label ?? '')) continue
      for (const p of previousParts.get(was.id) ?? []) copies.push(carryPartInsert(p, r.id, keepApprovals))
    }
    await insertItemParts(db, copies)
  }

  /** What the next revision would hold, read once: the question counts from it and the build writes from it. */
  async function planNextRevision(newest: SubmittalRevisionRow) {
    const onNewest = newest.id === selectedRev?.id
    const previous = onNewest ? items : await loadItems(newest.id)
    const previousParts = onNewest ? partsOf : partsByItem(await loadItemParts(db, previous.map((p) => p.id)))
    // 2026-10-03 · only an approved row stays behind. A row sent back goes on to be fixed; a row nobody answered goes on to keep waiting.
    const split = resubmitSplit(gcRows(previous))
    const goOn = [...split.sentBack, ...split.noAnswer]
    const preview = buildSubmittalRows({ specified, picks, previous: previous.map(itemToPrevious), overrides: overridesByTag })
    // 2026-10-01 · the rows the picks do not rebuild (from the takeoff, typed by hand) carry as they stand.
    const carried = rowsToCarry(previous, preview)
    // 2026-10-02 · an order-only row was never the reviewer's to send back: it carries either way, so it stays on the log.
    const rowsFor = (rows: ResubmitRows) => ({
      kept: rows === 'need' ? preview.filter((r) => r.orderOnly || goOn.some((it) => (r.tag.trim() ? it.tag === r.tag : it.submitted_label === r.submittedLabel))) : preview,
      carriedKept: rows === 'need' ? carried.filter((it) => isOrderOnlyRow(it) || goOn.some((x) => x.id === it.id)) : carried,
    })
    const total = (rows: ResubmitRows) => rowsFor(rows).kept.length + rowsFor(rows).carriedKept.length
    return { newest, previous, previousParts, preview, carried, rowsFor, counts: { sentBack: split.sentBack.length, noAnswer: split.noAnswer.length, approved: split.approved.length, orderOnly: orderOnlyRows(previous).length, approvedParts: approvedPartsGoingOn(gcRows(previous), previousParts), needTotal: total('need'), everyTotal: total('every') } }
  }

  /**
   * Step 7's one button, and the strip's (2026-10-05). With rows sent back it opens the chooser:
   * the rows that need it, or every row. With none sent back, or nothing approved, there is one kind of draft, so it asks once.
   */
  async function startNextDraft() {
    if (!bidId || !newestRev) return
    const plan = await planNextRevision(newestRev)
    const next = newestRev.rev_number + 1
    if (plan.counts.sentBack > 0 && resubmitHasChoice(plan.counts)) {
      setNextDraftRows('need')
      setNextDraft(plan)
      return
    }
    // Rows sent back, nothing approved: both kinds of draft are the same one, so there is nothing to choose.
    if (plan.counts.sentBack > 0) {
      if (await confirm(resubmitOneKind(newestRev.rev_number, plan.counts))) await buildNextRevision(plan, 'need')
      return
    }
    const { preview, carried } = plan
    const fromPicks = specified.length > 0 || picks.length > 0
    const ok = await confirm({
      title: `Start a Rev ${next} draft`,
      message: `Every row goes on Rev ${next}${fromPicks ? ", built from today's picks" : ''}. ${preview.length > 0 ? `${summarizeChanges(preview)} against Rev ${newestRev.rev_number}. ` : ''}${carried.length > 0 ? `${carried.length} row${carried.length === 1 ? '' : 's'} from the takeoff or typed by hand carry as ${carried.length === 1 ? 'it stands' : 'they stand'}, with ${carried.length === 1 ? 'its' : 'their'} parts. ` : ''}Sheets, reasons and lead times carry where the product is unchanged.${asRevisionStatus(newestRev.status) === 'draft' ? ` Rev ${newestRev.rev_number} was never shared and will read superseded.` : ''} Rev ${next} starts as a draft. ${resubmitNothingSent(next)}`,
      confirmLabel: startDraftLabel(plan.counts.everyTotal),
    })
    if (ok) await buildNextRevision(plan, 'every')
  }

  async function buildNextRevision(plan: Awaited<ReturnType<typeof planNextRevision>>, rows: ResubmitRows) {
    if (!bidId) return
    const { newest, previous, previousParts } = plan
    const { kept, carriedKept } = plan.rowsFor(rows)
    const onlySentBack = rows === 'need'
    setBusy(true)
    try {
      const { data, error } = await db
        .from('bid_submittals')
        .insert({ bid_id: bidId, rev_number: newest.rev_number + 1, status: 'draft', title: newest.title, source_files: newest.source_files, created_by: user?.id ?? null })
        .select('id')
        .single()
      if (error) throw error
      const revId = (data as { id: string }).id
      const rebuilt = kept.map((r, i) => draftToItemInsert({ ...r, sequenceOrder: i + 1 }, revId))
      const carriedRows = [...carriedKept].sort((a, b) => a.sequence_order - b.sequence_order).map((it, i) => carriedRowInsert(it, revId, rebuilt.length + i + 1))
      const inserts = [...rebuilt, ...carriedRows]
      if (inserts.length > 0) {
        const { data: made, error: insErr } = await db.from('bid_submittal_items').insert(inserts).select('id, carried_from_item_id, submitted_label')
        if (insErr) throw insErr
        // A resubmit: the parts the GC approved stand; the parts sent back, and the parts with no answer, are asked again.
        await carryPartsOnto((made ?? []) as Array<{ id: string; carried_from_item_id: string | null; submitted_label: string | null }>, previous, previousParts, onlySentBack)
      }
      if (asRevisionStatus(newest.status) === 'draft') {
        const { error: supErr } = await db.from('bid_submittals').update({ status: 'superseded' }).eq('id', newest.id)
        if (supErr) throw supErr
      }
      setSelectedRevId(revId)
      setNextDraft(null)
      await load(bidId)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not build the revision.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function rebuildRows() {
    if (!bidId || !selectedRev) return
    // 2026-10-01 · the rows the picks do not build (from the takeoff, typed by hand) stay as they are, after the rebuilt ones.
    const stay = rowsToCarry(items, buildSubmittalRows({ specified, picks, previous: items.map(itemToPrevious), overrides: overridesByTag }))
    const ok = await confirm({
      title: 'Rebuild the rows from the picks',
      message: `Every row the picks built is built again from today's picks on Pricing. Sheets, reasons and lead times stay where the product did not change. A supply house you set on a row stays while its pick is the same. A row whose product changed starts over.${stay.length > 0 ? ` The ${stay.length} row${stay.length === 1 ? '' : 's'} from the takeoff or typed by hand stay as ${stay.length === 1 ? 'it is' : 'they are'}.` : ''}`,
      confirmLabel: 'Rebuild',
    })
    if (!ok) return
    setBusy(true)
    try {
      const stayIds = new Set(stay.map((it) => it.id))
      const goIds = items.filter((it) => !stayIds.has(it.id)).map((it) => it.id)
      for (let i = 0; i < goIds.length; i += 100) {
        const { error } = await db.from('bid_submittal_items').delete().in('id', goIds.slice(i, i + 100))
        if (error) throw error
      }
      const n = await writeRows(selectedRev.id, items)
      for (const [i, it] of [...stay].sort((a, b) => a.sequence_order - b.sequence_order).entries()) {
        if (it.sequence_order === n + i + 1) continue
        const { error } = await db.from('bid_submittal_items').update({ sequence_order: n + i + 1 }).eq('id', it.id)
        if (error) throw error
      }
      setItems(await loadItems(selectedRev.id))
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not rebuild the rows.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function deleteDraft() {
    if (!bidId || !selectedRev) return
    const ok = await confirm({ title: `Delete Rev ${selectedRev.rev_number}`, message: 'This draft and its rows go; files stay in the bucket until the bid is deleted.', confirmLabel: 'Delete', danger: true })
    if (!ok) return
    setBusy(true)
    try {
      const { error } = await db.from('bid_submittals').delete().eq('id', selectedRev.id)
      if (error) throw error
      setSelectedRevId(null)
      await load(bidId)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not delete the draft.', 'error')
    } finally {
      setBusy(false)
    }
  }

  /** v2.4171 · the reader's verdict on a file: how many pages name a row, and whether the file carries section stamps. */
  async function readFileAgainstRows(bytes: ArrayBuffer): Promise<{ namesRows: number; sectioned: boolean }> {
    const [{ openPdf }, { commonHeader, fileSectionTags, readPages, walkRowsFrom }] = await Promise.all([import('../../lib/submittals/pdfThumbnails'), import('../../lib/submittals/assignPagesWalk')])
    const pdf = await openPdf(bytes)
    try {
      const texts: string[] = []
      for (let p = 1; p <= pdf.numPages; p++) texts.push(await pdf.pageText(p).catch(() => ''))
      const reads = readPages(texts, walkRowsFrom(gcItems))
      const header = commonHeader(texts)
      return { namesRows: Object.values(reads).filter((r) => r.itemId !== null).length, sectioned: header ? fileSectionTags(texts, header).length > 0 : false }
    } finally {
      pdf.destroy()
    }
  }

  /** v2.4171 · the walk read the file: keep its verdict on the file record so the line can use it. */
  async function noteFileReads(fileIndex: number, reads: { namesRows: number; sectioned: boolean }) {
    if (!selectedRev) return
    const f = sourceFiles[fileIndex]
    if (!f || (f.namesRows === reads.namesRows && f.sectioned === reads.sectioned)) return
    const next = sourceFiles.map((sf, i) => (i === fileIndex ? { ...sf, ...reads } : sf))
    const { error } = await db.from('bid_submittals').update({ source_files: serializeSourceFiles(next) }).eq('id', selectedRev.id)
    if (!error && bidId) await load(bidId)
  }

  async function dropVendorPdf(file: File) {
    if (!bidId || !selectedRev) return
    if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      showToast('Drop the vendor\'s PDF — other files are not read.', 'error')
      return
    }
    setBusy(true)
    try {
      const raw = await file.arrayBuffer()
      const bytes = new Uint8Array(raw)
      const { pageCount } = await import('../../lib/submittals/trimPdf')
      const pages = await pageCount(bytes)
      const index = sourceFiles.length
      const path = `${bidId}/${selectedRev.id}/${index}.pdf`
      const up = await supabase.storage.from(SUBMITTALS_BUCKET).upload(path, bytes, { contentType: 'application/pdf', upsert: true })
      if (up.error) throw up.error
      // v2.4171 · read it against the rows now, so the line can say when no page names a row.
      const reads = await readFileAgainstRows(raw).catch(() => ({ namesRows: null, sectioned: null }))
      const next: SourceFile[] = [...sourceFiles, { path, houseId: null, houseName: null, name: file.name, pages, trimmedAt: null, droppedPages: null, ...reads }]
      const { error } = await db.from('bid_submittals').update({ source_files: serializeSourceFiles(next) }).eq('id', selectedRev.id)
      if (error) throw error
      await load(bidId)
      showToast(reads.namesRows === 0 ? `${file.name} · ${pages} page${pages === 1 ? '' : 's'} — no page names a row on this revision; is it the vendor's submittal?` : `${file.name} · ${pages} page${pages === 1 ? '' : 's'} — Assign pages… walks it, or open the arrow and tap a page and its row.`, reads.namesRows === 0 ? 'info' : 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not store the file.', 'error')
    } finally {
      setBusy(false)
    }
  }

  /** 5b · a reviewer's redlined PDF or forwarded email, stored on the revision; the room never shows it. */
  async function dropReviewerFile(file: File) {
    if (!bidId || !selectedRev) return
    const kind = reviewerFileKind(file.name, file.type)
    if (!kind) {
      showToast('Drop their redlined PDF or the forwarded email (.eml, .msg, .txt) — other files are not kept.', 'error')
      return
    }
    setBusy(true)
    try {
      const index = reviewerFiles.length
      const path = reviewerFilePath(bidId, selectedRev.id, index, file.name)
      const up = await supabase.storage.from(SUBMITTALS_BUCKET).upload(path, file, { contentType: file.type || (kind === 'redline' ? 'application/pdf' : 'application/octet-stream'), upsert: true })
      if (up.error) throw up.error
      const deciders = people.filter((p) => !p.closed_at && p.may_decide)
      const from = deciders.length === 1 ? deciders[0]! : null
      const next: ReviewerFile[] = [...reviewerFiles, { path, name: file.name, kind, droppedAt: new Date().toISOString(), droppedBy: user?.id ?? null, droppedByName: profileName, personId: from?.id ?? null, personName: from?.name ?? null }]
      const { error } = await db.from('bid_submittals').update({ reviewer_files: serializeReviewerFiles(next) }).eq('id', selectedRev.id)
      if (error) throw error
      if (room) await db.from('bid_submittal_events').insert({ room_id: room.id, submittal_id: selectedRev.id, person_id: from?.id ?? null, event_type: 'file_dropped', metadata: { name: file.name, kind, by: user?.id ?? null } })
      await load(bidId)
      showToast(`${file.name} kept on ${describeRevisionChip(selectedRev)} — type their calls onto the rows with Edit.`, 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not store the file.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function removeReviewerFile(index: number) {
    if (!bidId || !selectedRev) return
    const f = reviewerFiles[index]
    if (!f) return
    const ok = await confirm({ title: 'Remove this file', message: `${f.name} leaves the revision. The calls already entered from it stay on the rows.`, confirmLabel: 'Remove', danger: true })
    if (!ok) return
    setBusy(true)
    try {
      await supabase.storage.from(SUBMITTALS_BUCKET).remove([f.path])
      const next = reviewerFiles.filter((_, i) => i !== index)
      const { error } = await db.from('bid_submittals').update({ reviewer_files: serializeReviewerFiles(next) }).eq('id', selectedRev.id)
      if (error) throw error
      await load(bidId)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not remove the file.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function openReviewerFile(f: ReviewerFile) {
    try {
      // v2.4610 · a redlined PDF opens to be read; a forwarded email is saved, from the app's own address.
      if (!(await openOrSaveFromStorage(SUBMITTALS_BUCKET, f.path, f.name))) throw new Error('No link.')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not open the file.', 'error')
    }
  }

  // ---------- 6b · the robot ----------

  /** Queue a task for the submittal robot; a person confirms the result on this tab. */
  async function askRobot(kind: SubmittalTaskKind, input: Record<string, unknown>, submittalId: string | null) {
    if (!bidId) return
    setBusy(true)
    try {
      const { error } = await db.from('bid_submittal_tasks').insert({ bid_id: bidId, submittal_id: submittalId, kind, input, status: 'queued', requested_by: user?.id ?? null })
      if (error) throw error
      await loadTasks(bidId)
      showToast(kind === 'read_schedule' ? 'Asked. The robot reads the schedule off the plans. Its tags land here for you to tick.' : kind === 'file_cut_sheets' ? 'Asked — the robot guesses each page\'s tag; the guesses land on the strip as dashed chips.' : 'Asked — the robot reads the marks; the proposed calls land on the file card for you to confirm.', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not ask the robot.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function markTask(taskId: string, status: 'done' | 'cancelled') {
    await db.from('bid_submittal_tasks').update({ status, reviewed_at: new Date().toISOString(), reviewed_by: user?.id ?? null, updated_at: new Date().toISOString() }).eq('id', taskId)
  }

  /** read_schedule ready: keep the chosen rows (confirmed), drop the rest of the robot's unconfirmed rows. */
  async function confirmSchedule(task: SubmittalTaskRow, keepTags: string[]) {
    if (!bidId) return
    setBusy(true)
    try {
      const now = new Date().toISOString()
      if (keepTags.length) {
        const { error } = await db.from('bid_specified_products').update({ confirmed_at: now, confirmed_by: user?.id ?? null }).eq('bid_id', bidId).eq('source', 'robot').is('confirmed_at', null).in('tag', keepTags)
        if (error) throw error
      }
      await db.from('bid_specified_products').delete().eq('bid_id', bidId).eq('source', 'robot').is('confirmed_at', null)
      await markTask(task.id, keepTags.length ? 'done' : 'cancelled')
      setLookChecked({})
      await load(bidId)
      showToast(keepTags.length ? `${keepTags.length} tag${keepTags.length === 1 ? '' : 's'} confirmed on the schedule.` : 'The robot\'s rows were discarded.', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not confirm the rows.', 'error')
    } finally {
      setBusy(false)
    }
  }

  /** file_cut_sheets ready: the sure guesses become the rows' pages; unsure ones stay dashed for a tap. */
  async function confirmGuesses(fileIndex: number) {
    if (!bidId || !selectedRev) return
    const t = liveTask(tasks, 'file_cut_sheets', (i) => i.file_index === fileIndex && (!i.path || i.path === sourceFiles[fileIndex]?.path))
    const g = t ? sheetGuessesToConfirm(t, sourceFiles[fileIndex]?.pages ?? 0) : null
    if (!t || !g) return
    setBusy(true)
    try {
      const byTag = new Map(gcItems.map((it) => [it.tag.trim().toUpperCase(), it]))
      const pagesByItem = new Map<string, number[]>()
      for (const guess of g.sure) {
        const it = byTag.get(guess.tag)
        if (!it) continue
        const taken = items.some((o) => o.id !== it.id && o.sheet_file === fileIndex && (o.sheet_pages ?? []).includes(guess.page))
        if (taken) continue
        pagesByItem.set(it.id, [...(pagesByItem.get(it.id) ?? (it.sheet_file === fileIndex ? it.sheet_pages ?? [] : [])), guess.page])
      }
      for (const [itemId, pages] of pagesByItem) await writeItemPages(itemId, fileIndex, [...new Set(pages)].sort((a, b) => a - b))
      await markTask(t.id, 'done')
      setItems(await loadItems(selectedRev.id))
      await loadTasks(bidId)
      showToast(`${pagesByItem.size} row${pagesByItem.size === 1 ? '' : 's'} took the robot's pages${g.unsure.length ? ` · ${g.unsure.length} unsure page${g.unsure.length === 1 ? '' : 's'} left dashed for a tap` : ''}.`, 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not confirm the pages.', 'error')
    } finally {
      setBusy(false)
    }
  }

  /** read_redlines ready: the sure marks become entered decisions (source robot) on the rows; the questions go on the thread. */
  async function confirmRedlines(task: SubmittalTaskRow, useUnsure: boolean) {
    if (!bidId || !selectedRev) return
    const r = redlinesToConfirm(task)
    if (!r) return
    const input = taskInput(task)
    const file = input.reviewer_index != null ? reviewerFiles[input.reviewer_index] ?? null : null
    const personId = file?.personId ?? input.person_id ?? null
    const person = personId ? people.find((p) => p.id === personId) ?? null : null
    if (!person) {
      showToast('Say whose marks these are first — set the reviewer on the file (Edit a row → on behalf of), then confirm.', 'error')
      return
    }
    setBusy(true)
    try {
      let theRoom = room
      if (!theRoom) {
        const { data, error } = await db.from('bid_submittal_rooms').insert({ bid_id: bidId, token: newRoomToken(), status: 'open' }).select('*').single()
        if (error) throw error
        theRoom = data as SubmittalRoomRow
      }
      const now = new Date().toISOString()
      const byTag = new Map(gcItems.map((it) => [it.tag.trim().toUpperCase(), it]))
      const counts = { approved: 0, revise: 0, rejected: 0 }
      const marks = useUnsure ? [...r.sure, ...r.unsure] : r.sure
      for (const a of marks) {
        const it = a.tag ? byTag.get(a.tag) : null
        if (!it || a.proposed === 'question') continue
        const patch = enteredDecisionPatch({ decision: a.proposed, note: a.text || null, person: { id: person.id, name: person.name, email: person.email }, byUserId: user?.id ?? null, byName: profileName, now, source: 'robot' })
        // A row with parts takes the mark on every part the GC sees; the row reads the roll-up.
        if ((await enterCallOnParts(db, it.id, patch, { parts: partsOf.get(it.id) })) === 0) {
          const { error } = await db.from('bid_submittal_items').update(patch).eq('id', it.id)
          if (error) throw error
        }
        counts[a.proposed] += 1
      }
      const n = counts.approved + counts.revise + counts.rejected
      if (n > 0) {
        await db.from('bid_submittal_messages').insert({ room_id: theRoom.id, submittal_id: selectedRev.id, person_id: null, author_kind: 'system', body: enteredEntryBody(person.name, counts, 'robot'), kind: 'decision', tags: marks.map((a) => a.tag).filter((x): x is string => !!x), metadata: { entered_by: user?.id ?? null, rev_number: selectedRev.rev_number, counts, person_id: person.id, robot_task: task.id } })
        await db.from('bid_submittal_events').insert({ room_id: theRoom.id, submittal_id: selectedRev.id, person_id: person.id, event_type: 'decided', metadata: { ...counts, rev_number: selectedRev.rev_number, entered: true, robot: true, by: user?.id ?? null } })
      }
      for (const q of r.questions) {
        await db.from('bid_submittal_messages').insert({ room_id: theRoom.id, submittal_id: selectedRev.id, person_id: null, author_kind: 'system', body: `from ${person.name}'s file${q.tag ? ` on ${q.tag}` : ''}: “${q.text || 'a mark the robot could not read'}”`, kind: 'message', tags: q.tag ? [q.tag] : [], metadata: { robot_task: task.id, person_id: person.id, page: q.page } })
      }
      await markTask(task.id, 'done')
      setItems(await loadItems(selectedRev.id))
      await loadRoom(bidId)
      await loadTasks(bidId)
      showToast(`${n} call${n === 1 ? '' : 's'} entered from ${person.name}'s file${r.questions.length ? ` · ${r.questions.length} question${r.questions.length === 1 ? '' : 's'} on the thread` : ''}.`, 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not confirm the marks.', 'error')
    } finally {
      setBusy(false)
    }
  }

  /** 6c · file the shared package in the bid's job folder on Drive (Share does it on its own; this is the door for an older revision). */
  async function fileInDrive() {
    if (!bidId || !selectedRev) return
    setBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('file-submittal-package', { body: { submittal_id: selectedRev.id } })
      const res = (data ?? {}) as { ok?: boolean; error?: string; file_url?: string; reused?: boolean; folder_link?: string }
      if (error || !res.ok) throw new Error(res.error ?? error?.message ?? 'Drive did not take the file.')
      await load(bidId)
      showToast(res.reused ? 'Already filed in Drive — the link is on the revision.' : 'Filed in Drive under the job folder → Submittals.', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not file the package in Drive.', 'error')
    } finally {
      setBusy(false)
    }
  }

  /** The package (stage 2c): cover table + every row's sheet pages, stamped; stored at package-rev<N>.pdf and opened. */
  /** The Build package button: with cut sheets still missing it names the rows first, then builds. */
  async function askBuildPackage() {
    const owing = rowsOwingSheet(gcItems)
    if (owing.length > 0 && !(await confirm(sheetsToFollowConfirm(owing)))) return
    await buildPackage()
  }

  async function buildPackage(open = true) {
    if (!bidId || !selectedRev) return
    setBusy(true)
    try {
      const settings = await fetchTestReportSettings()
      const rowsIn: PackageRowInput[] = gcItems.map((it) => {
        const reason = asReason(it.reason_kind)
        // 2026-10-01 · a row with parts lists the parts the GC sees, one per line.
        const gcParts = submittedParts(partsOf.get(it.id) ?? [])
        return {
          tag: it.tag,
          status: asStatus(it.status),
          specified: [it.specified_manufacturer, it.specified_model].filter(Boolean).join(' ') || it.specified_description || '',
          submitted: gcParts.length > 0 ? gcParts.map((p) => `${p.label.trim()}${formatPartQty(p.quantity) ? ` (${formatPartQty(p.quantity)})` : ''}`).join('\n') : it.submitted_label ?? it.submitted_model ?? '',
          house: null,
          reason: [reason ? REASON_LABELS[reason] : '', it.reason_note ?? ''].filter(Boolean).join(' · '),
          leadTime: describeLeadTime(it.lead_time_days) ?? '',
          sheetFile: it.sheet_file != null && sourceFiles[it.sheet_file] ? it.sheet_file : null,
          sheetPages: [...(it.sheet_pages ?? [])],
          // 2026-10-01 · each part's own sheet, while the parts' pages are the row's (a later walk on the row wins).
          ...(() => {
            const withPages = gcParts.filter((p) => p.sheet_file != null && sourceFiles[p.sheet_file] && (p.sheet_pages ?? []).length > 0)
            const union = [...new Set(withPages.flatMap((p) => p.sheet_pages))].sort((a, b) => a - b)
            const rowPages = [...(it.sheet_pages ?? [])].sort((a, b) => a - b)
            const agree = withPages.length > 0 && withPages.every((p) => p.sheet_file === it.sheet_file) && union.length === rowPages.length && union.every((pg, k) => pg === rowPages[k])
            return agree ? { partSheets: withPages.map((p) => ({ fileIndex: p.sheet_file as number, pages: [...p.sheet_pages], title: p.label.trim() })) } : {}
          })(),
        }
      })
      const coverInput = {
        companyName: settings.companyName,
        companyTagline: settings.companyTagline,
        officePhone: settings.officePhone,
        bidLabel: bidWorkflowTabHeading(bid, prefixMap),
        projectAddress: bid.address ?? null,
        gcName: bid.customers?.name ?? bid.bids_gc_builders?.name ?? null,
        revNumber: selectedRev.rev_number,
        dateLabel: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: APP_CALENDAR_TZ }),
        note: selectedRev.note,
      }
      // The cover's page count decides the sheets' page numbers; render twice only if the cover ran long.
      let plan = planPackage(rowsIn, 1)
      let cover = await renderCoverPdf(buildCoverModel(coverInput, plan), settings)
      if (cover.pages !== plan.coverPages) {
        plan = planPackage(rowsIn, cover.pages)
        cover = await renderCoverPdf(buildCoverModel(coverInput, plan), settings)
      }
      const needed = new Set(packageSheets(plan).map((sh) => sh.fileIndex))
      const files: Array<Uint8Array | ArrayBuffer> = []
      for (const i of needed) {
        const f = sourceFiles[i]
        if (!f) continue
        const { data, error } = await supabase.storage.from(SUBMITTALS_BUCKET).download(f.path)
        if (error || !data) continue
        files[i] = await data.arrayBuffer()
      }
      const sheets = packageSheets(plan)
      const result = await buildSubmittalPackage(cover.blob, files, sheets)
      const path = `${bidId}/${selectedRev.id}/package-rev${selectedRev.rev_number}.pdf`
      const up = await supabase.storage.from(SUBMITTALS_BUCKET).upload(path, result.blob, { contentType: 'application/pdf', upsert: true })
      if (up.error) throw up.error
      const { error } = await db.from('bid_submittals').update({ package_path: path }).eq('id', selectedRev.id)
      if (error) throw error
      const skipped = result.skipped.length > 0 ? ` · could not read the sheet for ${result.skipped.join(', ')}` : ''
      const owed = plan.rowsWithoutSheet.length > 0 ? ` · ${plan.rowsWithoutSheet.length} row${plan.rowsWithoutSheet.length === 1 ? '' : 's'} still owe a sheet` : ''
      showToast(`Rev ${selectedRev.rev_number} package · ${result.totalPages} page${result.totalPages === 1 ? '' : 's'} · ${result.manifest.length} sheet${result.manifest.length === 1 ? '' : 's'}${owed}${skipped}`, 'success')
      if (open) await openStoredPackage(path, selectedRev.rev_number, result.blob)
      await load(bidId)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not build the package.', 'error')
    } finally {
      setBusy(false)
    }
  }

  /** v2.4579 · the dropped vendor file, saved whole under its own name (read into the page, then saved from the app's own address, v2.4610). */
  async function saveSourceFile(fileIndex: number) {
    const f = sourceFiles[fileIndex]
    if (!f) return
    const name = /\.pdf$/i.test(f.name) ? f.name : `${f.name}.pdf`
    if (!(await saveFromStorage(SUBMITTALS_BUCKET, f.path, name))) showToast(`${f.name} could not be saved right now. Try again.`, 'error')
  }

  /** The stored package, saved under its name; the fresh blob when it has just been built, so nothing is read twice (v2.4610). */
  async function openStoredPackage(path: string, revNumber: number, fallback?: Blob) {
    const name = packageFileName(revNumber, bidWorkflowTabHeading(bid, prefixMap))
    if (fallback) {
      saveBlobAs(fallback, name)
      return
    }
    if (!(await saveFromStorage(SUBMITTALS_BUCKET, path, name))) showToast('The package is stored, but it could not be read right now.', 'error')
  }

  /**
   * One row's cut sheet as a PDF of its own (2026-10-05): the row's pages cut out of the vendor's
   * file and saved to the device, to attach to an email or a text. Nothing is written or sent.
   */
  async function saveRowCutSheet(it: SubmittalItemRow) {
    const plan = rowCutSheetPlan(it, partsOf.get(it.id) ?? [])
    if (plan.length === 0 || savingSheetId) return
    setSavingSheetId(it.id)
    try {
      const out = await buildRowCutSheet(plan, async (fileIndex) => {
        const f = sourceFiles[fileIndex]
        if (!f) throw new Error('The vendor file for this cut sheet is no longer on the revision.')
        return downloadFile(f.path)
      })
      const name = cutSheetFileName(it.tag)
      saveBlobAs(new Blob([out.bytes as BlobPart], { type: 'application/pdf' }), name)
      showToast(`Saved ${name} · ${out.pages} page${out.pages === 1 ? '' : 's'}. Attach it to your email or text.`, 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save the cut sheet.', 'error')
    } finally {
      setSavingSheetId(null)
    }
  }

  // ---------- stage 3a · the sheet strip ----------

  async function showPages(fileIndex: number) {
    const f = sourceFiles[fileIndex]
    if (!f) return
    setThumbs((t) => ({ ...t, [f.path]: 'loading' }))
    try {
      const bytes = await downloadFile(f.path)
      const { renderPdfThumbnails } = await import('../../lib/submittals/pdfThumbnails')
      const urls = await renderPdfThumbnails(bytes)
      setThumbs((t) => ({ ...t, [f.path]: urls }))
    } catch {
      setThumbs((t) => ({ ...t, [f.path]: 'error' }))
      showToast('Could not draw the pages — the file may not be a readable PDF.', 'error')
    }
  }

  /** Read its parts… (2026-10-01): the file's pages read into the house's parts, set beside the rows for the review. */
  async function readFileParts(fileIndex: number) {
    const f = sourceFiles[fileIndex]
    if (!f) return
    setBusy(true)
    try {
      const bytes = await downloadFile(f.path)
      const { openPdf } = await import('../../lib/submittals/pdfThumbnails')
      const pdf = await openPdf(bytes)
      const texts: string[] = []
      try {
        for (let p = 1; p <= pdf.numPages; p++) texts.push(await pdf.pageText(p).catch(() => ''))
      } finally {
        pdf.destroy()
      }
      const read = readHouseFile(texts)
      if (!read) {
        showToast(`${f.name} has no parts list the app can read: no job line stamped on its pages. Assign pages… walks it page by page.`, 'info')
        return
      }
      setHouseFile({ fileIndex, read, matches: matchFileToRows(read, items, partsOf) })
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not read the file'), 'error')
    } finally {
      setBusy(false)
    }
  }

  /** Use the file's parts: each tag's choices written onto its rows (or a new row), then every row's roll-up. */
  async function applyHouseFile(choices: FileTagChoice[], houseId: string | null) {
    if (!houseFile || !selectedRev || !bidId) return
    const { fileIndex, read, matches } = houseFile
    setBusy(true)
    try {
      let seq = items.reduce((m, it) => Math.max(m, it.sequence_order), 0)
      const touched: string[] = []
      for (const [i, m] of matches.entries()) {
        const choice = choices[i]
        if (!choice?.use) continue
        let targets = m.itemIds
        if (targets.length === 0) {
          if (!choice.addRow) continue
          const fileParts = read.parts.filter((p) => p.tag === m.tag)
          seq += 1
          const { data, error } = await db.from('bid_submittal_items').insert({ submittal_id: selectedRev.id, tag: m.tag.replace(/\s*&\s*/g, ', '), sequence_order: seq, specified_description: fileParts[0]?.description || m.tag, status: 'proposed', sheet_pages: [] }).select('id').single()
          if (error) throw error
          targets = [(data as { id: string }).id]
        }
        for (const [k, itemId] of targets.entries()) {
          const rowParts = partsOf.get(itemId) ?? []
          // The review paired the first row; a split row of the same tag pairs on its own, with the same starting rules.
          const tagChoice = k === 0 || m.itemIds.length === 0 ? choice : { ...defaultFileChoice({ ...m, ...pairParts(read.parts.filter((p) => p.tag === m.tag), rowParts) }), rename: false }
          const tagMatch = k === 0 || m.itemIds.length === 0 ? m : { ...m, ...pairParts(read.parts.filter((p) => p.tag === m.tag), rowParts) }
          const plan = planFileApply(tagMatch, tagChoice, itemId, rowParts, { fileIndex, houseId })
          if (plan.deletes.length > 0) {
            const { error } = await db.from('bid_submittal_item_parts').delete().in('id', plan.deletes)
            if (error) throw error
          }
          const now = new Date().toISOString()
          for (const u of plan.updates) {
            const { error } = await db.from('bid_submittal_item_parts').update({ ...u.patch, updated_at: now }).eq('id', u.partId)
            if (error) throw error
          }
          for (const o of plan.keptOrderOnly) {
            const { error } = await db.from('bid_submittal_item_parts').update({ on_submittal: false, sequence_order: o.sequence_order, updated_at: now }).eq('id', o.partId)
            if (error) throw error
          }
          await insertItemParts(db, plan.inserts.map((w) => ({ ...w, item_id: itemId, bid_id: bidId })))
          const after = await loadItemParts(db, [itemId])
          const { error } = await db.from('bid_submittal_items').update({ ...plan.rowPatch, ...rollUpFromParts(after) }).eq('id', itemId)
          if (error) throw error
          touched.push(itemId)
        }
      }
      // The file is the house's: its record says so.
      if (houseId !== (sourceFiles[fileIndex]?.houseId ?? null)) {
        const next = sourceFiles.map((sf, i) => (i === fileIndex ? { ...sf, houseId, houseName: houses.find((h) => h.id === houseId)?.name ?? null } : sf))
        await db.from('bid_submittals').update({ source_files: serializeSourceFiles(next) }).eq('id', selectedRev.id)
      }
      setHouseFile(null)
      await load(bidId)
      setItems(await loadItems(selectedRev.id))
      showToast(`${touched.length} row${touched.length === 1 ? '' : 's'} took the file’s parts, each with its pages.`, 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not use the file’s parts'), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function writeItemPages(itemId: string, fileIndex: number | null, pages: number[]) {
    const { error } = await db.from('bid_submittal_items').update({ sheet_file: pages.length > 0 ? fileIndex : null, sheet_pages: pages, sheet_source: pages.length > 0 ? 'estimator' : null }).eq('id', itemId)
    if (error) throw error
  }

  /** A page joins the row's sheet; a row's sheet lives in one file, so a page from another file starts it over. */
  async function assignPageToItem(fileIndex: number, page: number, itemId: string) {
    const it = items.find((i) => i.id === itemId)
    if (!it || !selectedRev) return
    const sameFile = it.sheet_file === fileIndex
    const pages = sameFile ? [...new Set([...(it.sheet_pages ?? []), page])].sort((a, b) => a - b) : [page]
    try {
      await writeItemPages(itemId, fileIndex, pages)
      setItems(await loadItems(selectedRev.id))
      if (!sameFile && (it.sheet_pages ?? []).length > 0) showToast(`${it.tag.trim() || 'The accessory'} now reads from ${sourceFiles[fileIndex]?.name ?? 'this file'}; its earlier pages were let go.`, 'info')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save the page.', 'error')
    }
  }

  /** Assign pages · Done: every row whose pages in the file changed, written in one pass, then the rows reload. */
  async function applyAssignWrites(writes: ItemWrite[]) {
    if (!selectedRev) return
    try {
      for (const w of writes) await writeItemPages(w.itemId, w.fileIndex, w.pages)
      setItems(await loadItems(selectedRev.id))
      const rowsTouched = writes.filter((w) => w.pages.length > 0).length
      showToast(writes.length === 0 ? 'Nothing changed.' : `${rowsTouched} row${rowsTouched === 1 ? '' : 's'} updated with pages from the file.`, 'success')
      setAssignFile(null)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save the pages.', 'error')
    }
  }

  async function unassignPageFromItem(fileIndex: number, page: number, itemId: string) {
    const it = items.find((i) => i.id === itemId)
    if (!it || !selectedRev || it.sheet_file !== fileIndex) return
    const pages = (it.sheet_pages ?? []).filter((p) => p !== page)
    try {
      await writeItemPages(itemId, fileIndex, pages)
      setItems(await loadItems(selectedRev.id))
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save the page.', 'error')
    }
  }

  /**
   * Done with this file: keep the pages on rows, let the rest go, rewrite the rows' page
   * numbers. Takes the files and rows as arguments (not state) so Share can trim several
   * files in a row without a stale closure overwriting the first trim's record; returns
   * the next files and rows.
   */
  async function trimFile(files: SourceFile[], rows: SubmittalItemRow[], fileIndex: number): Promise<{ files: SourceFile[]; rows: SubmittalItemRow[] }> {
    const f = files[fileIndex]
    if (!f || !selectedRev) return { files, rows }
    const state = assignmentsFromItems(rows)
    const kept = keptPages(state, fileIndex)
    if (kept.length === 0) return { files, rows }
    const bytes = await downloadFile(f.path)
    const { trimPdf } = await import('../../lib/submittals/trimPdf')
    const result = await trimPdf(bytes, kept)
    const up = await supabase.storage.from(SUBMITTALS_BUCKET).upload(f.path, result.bytes, { contentType: 'application/pdf', upsert: true })
    if (up.error) throw up.error
    const next = remapAfterTrim(state, fileIndex, result.map)
    const nextRows: SubmittalItemRow[] = []
    for (const it of rows) {
      if (it.sheet_file !== fileIndex) {
        nextRows.push(it)
        continue
      }
      const pages = next.filter((a) => a.fileIndex === fileIndex && a.tag === it.id).map((a) => a.page)
      await writeItemPages(it.id, fileIndex, pages)
      nextRows.push({ ...it, sheet_pages: pages, sheet_file: pages.length > 0 ? fileIndex : null })
    }
    // 2026-10-01 · a part's own pages follow the trim the same way.
    for (const p of parts.filter((x) => x.sheet_file === fileIndex && (x.sheet_pages ?? []).length > 0)) {
      const kept = (p.sheet_pages ?? []).map((pg) => result.map[pg]).filter((pg): pg is number => pg !== undefined)
      await db.from('bid_submittal_item_parts').update({ sheet_pages: kept, sheet_file: kept.length > 0 ? fileIndex : null }).eq('id', p.id)
    }
    const nextFiles: SourceFile[] = files.map((sf, i) => (i === fileIndex ? { ...sf, pages: result.kept, trimmedAt: new Date().toISOString(), droppedPages: result.dropped } : sf))
    const { error } = await db.from('bid_submittals').update({ source_files: serializeSourceFiles(nextFiles) }).eq('id', selectedRev.id)
    if (error) throw error
    setThumbs((t) => {
      const copy = { ...t }
      delete copy[f.path]
      return copy
    })
    showToast(`${f.name}: ${result.kept} page${result.kept === 1 ? '' : 's'} kept on rows · ${result.dropped} let go.`, 'success')
    return { files: nextFiles, rows: nextRows }
  }

  async function doneWithFile(fileIndex: number) {
    if (!bidId || !selectedRev) return
    setBusy(true)
    try {
      await trimFile(sourceFiles, items, fileIndex)
      await load(bidId)
      setItems(await loadItems(selectedRev.id))
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not trim the file.', 'error')
    } finally {
      setBusy(false)
    }
  }

  /** Remove a file nothing landed from; later files shift down one and their rows follow. */
  async function removeFile(fileIndex: number) {
    const f = sourceFiles[fileIndex]
    if (!f || !bidId || !selectedRev) return
    const ok = await confirm({ title: `Remove ${f.name}`, message: 'Nothing from this file is on a row. The file leaves the revision.', confirmLabel: 'Remove', danger: true })
    if (!ok) return
    setBusy(true)
    try {
      await supabase.storage.from(SUBMITTALS_BUCKET).remove([f.path])
      const files = sourceFiles.filter((_, i) => i !== fileIndex)
      for (const it of items) {
        if (it.sheet_file == null) continue
        if (it.sheet_file > fileIndex) await writeItemPages(it.id, it.sheet_file - 1, it.sheet_pages ?? [])
        else if (it.sheet_file === fileIndex) await writeItemPages(it.id, null, [])
      }
      // 2026-10-01 · and the parts' own files.
      for (const p of parts) {
        if (p.sheet_file == null) continue
        if (p.sheet_file > fileIndex) await db.from('bid_submittal_item_parts').update({ sheet_file: p.sheet_file - 1 }).eq('id', p.id)
        else if (p.sheet_file === fileIndex) await db.from('bid_submittal_item_parts').update({ sheet_file: null, sheet_pages: [] }).eq('id', p.id)
      }
      const { error } = await db.from('bid_submittals').update({ source_files: serializeSourceFiles(files) }).eq('id', selectedRev.id)
      if (error) throw error
      await load(bidId)
      setItems(await loadItems(selectedRev.id))
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not remove the file.', 'error')
    } finally {
      setBusy(false)
    }
  }

  // ---------- stage 4a · the room ----------

  async function setMayDecide(personId: string, mayDecide: boolean) {
    try {
      const { error } = await db.from('bid_submittal_people').update({ may_decide: mayDecide }).eq('id', personId)
      if (error) throw error
      if (bidId) await loadRoom(bidId)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save.', 'error')
    }
  }

  async function closePerson(personId: string) {
    const p = people.find((x) => x.id === personId)
    if (!p || !bidId) return
    const ok = await confirm({ title: `Close ${p.name}'s link`, message: 'Their personal link stops working; the room link is untouched. Their decisions stay on the record.', confirmLabel: 'Close it', danger: true })
    if (!ok) return
    try {
      const { error } = await db.from('bid_submittal_people').update({ closed_at: new Date().toISOString() }).eq('id', personId)
      if (error) throw error
      await loadRoom(bidId)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not close the link.', 'error')
    }
  }

  async function closeRoom() {
    if (!room || !bidId) return
    const ok = await confirm({ title: 'Close the review room', message: 'Every link to this bid\'s submittals reads "this review is closed". The decisions and the packages stay on the record. Reopen from here if you need to.', confirmLabel: 'Close the room', danger: true })
    if (!ok) return
    try {
      const { error } = await db.from('bid_submittal_rooms').update({ status: 'closed', closed_at: new Date().toISOString(), closed_by: user?.id ?? null }).eq('id', room.id)
      if (error) throw error
      await db.from('bid_submittal_events').insert({ room_id: room.id, event_type: 'closed', metadata: { by: user?.id ?? null } })
      await loadRoom(bidId)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not close the room.', 'error')
    }
  }

  async function reopenRoom() {
    if (!room || !bidId) return
    try {
      const { error } = await db.from('bid_submittal_rooms').update({ status: 'open', closed_at: null, closed_by: null }).eq('id', room.id)
      if (error) throw error
      await loadRoom(bidId)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not reopen the room.', 'error')
    }
  }

  /** Share's "before it goes": Done with this file for every untrimmed vendor file that has pages on rows. */
  async function doneWithAllFiles() {
    if (!bidId || !selectedRev) return
    let snap = { files: sourceFiles, rows: items }
    for (let i = 0; i < snap.files.length; i++) {
      const f = snap.files[i]
      if (!f || f.trimmedAt) continue
      if (keptPages(assignmentsFromItems(snap.rows), i).length === 0) continue
      snap = await trimFile(snap.files, snap.rows, i)
    }
    await load(bidId)
    setItems(await loadItems(selectedRev.id))
  }

  /** By hand (v2.4090; v2.4105 the editor first): a row that exists only once Save is pressed — Cancel leaves nothing behind. */
  function addRowByHand() {
    if (!selectedRev || !isDraft) return
    const maxSeq = items.reduce((m, it) => Math.max(m, it.sequence_order), 0)
    setEditing(blankSubmittalItem(selectedRev.id, maxSeq + 1))
  }

  /**
   * The room and the reviewer an entered call is recorded under. The person is on the room, or
   * joins it now (how = named, with an email only when the office has one); the room itself is
   * minted if the bid has none yet — nothing is shared by that, and nothing is sent.
   */
  async function roomAndReviewerFor(choice: ReviewerChoice): Promise<{ theRoom: SubmittalRoomRow; person: { id: string; name: string; email: string | null } }> {
    if (!bidId) throw new Error('Pick a bid first.')
    let theRoom = room
    if (!theRoom) {
      const { data, error } = await db.from('bid_submittal_rooms').insert({ bid_id: bidId, token: newRoomToken(), status: 'open' }).select('*').single()
      if (error) throw error
      theRoom = data as SubmittalRoomRow
    }
    if ('id' in choice) {
      const p = people.find((x) => x.id === choice.id)
      if (!p) throw new Error('That person is no longer on the room.')
      return { theRoom, person: { id: p.id, name: p.name, email: p.email } }
    }
    // Read fresh: the person may have joined since the tab loaded. With an email they are matched by it; without one, by name among the people who have none.
    const { data: onRoom, error: readErr } = await db.from('bid_submittal_people').select('id, name, email').eq('room_id', theRoom.id).is('closed_at', null)
    if (readErr) throw readErr
    const existing = matchRoomPerson((onRoom ?? []) as Array<{ id: string; name: string; email: string | null }>, choice)
    if (existing) return { theRoom, person: existing }
    const { data, error } = await db.from('bid_submittal_people').insert({ room_id: theRoom.id, name: choice.name, email: choice.email?.trim().toLowerCase() || null, role: choice.role, may_decide: true, token: newRoomToken(), how: 'named', invited_by: user?.id ?? null }).select('id, name, email').single()
    if (error) throw error
    return { theRoom, person: data as { id: string; name: string; email: string | null } }
  }

  /**
   * One entry for a submittal approved whole: every row with no call yet (and a product) reads
   * Approved in the reviewer's name, on the day they said it. Rows that carry a call keep it.
   */
  async function approveAll(choice: ApproveAllChoice) {
    if (!selectedRev || !bidId) return
    const rows = rowsToApproveAll(gcItems)
    if (rows.length === 0) return
    setBusy(true)
    try {
      const { theRoom, person } = await roomAndReviewerFor(choice.person)
      const patch = enteredDecisionPatch({ decision: 'approved', note: choice.note, person, byUserId: user?.id ?? null, byName: profileName, now: enteredDecisionAt(choice.on, new Date(), todayYmdInAppTz()) })
      // A row the reviewer answered in the room a moment ago keeps that answer: the write takes only rows still without a call.
      const written = new Set<string>()
      // A row with parts: every part the GC sees with no call yet takes the approval; the row reads the roll-up.
      for (const r of rows) {
        if (!(partsOf.get(r.id) ?? []).some((p) => p.on_submittal)) continue
        if ((await enterCallOnParts(db, r.id, patch, { parts: partsOf.get(r.id), onlyOpen: true })) > 0) written.add(r.id)
      }
      const ids = rows.filter((r) => !(partsOf.get(r.id) ?? []).some((p) => p.on_submittal)).map((r) => r.id)
      for (let i = 0; i < ids.length; i += 100) {
        const { data, error } = await db.from('bid_submittal_items').update(patch).in('id', ids.slice(i, i + 100)).is('review_decision', null).select('id')
        if (error) throw error
        for (const r of (data ?? []) as Array<{ id: string }>) written.add(r.id)
      }
      const done = rows.filter((r) => written.has(r.id))
      if (done.length === 0) {
        setApprovingAll(false)
        setItems(await loadItems(selectedRev.id))
        showToast('Every row already has a call. Nothing was changed.', 'info')
        return
      }
      const counts = { approved: done.length, revise: 0, rejected: 0 }
      await db.from('bid_submittal_messages').insert({ room_id: theRoom.id, submittal_id: selectedRev.id, person_id: null, author_kind: 'system', body: enteredEntryBody(person.name, counts, 'entered', choice.on ?? null), kind: 'decision', tags: done.map((r) => r.tag.trim()).filter(Boolean), metadata: { entered_by: user?.id ?? null, rev_number: selectedRev.rev_number, counts, person_id: person.id, whole: true, ...(choice.on ? { decided_on: choice.on } : {}) } })
      await db.from('bid_submittal_events').insert({ room_id: theRoom.id, submittal_id: selectedRev.id, person_id: person.id, event_type: 'decided', metadata: { ...counts, rev_number: selectedRev.rev_number, entered: true, whole: true, by: user?.id ?? null, ...(choice.on ? { decided_on: choice.on } : {}) } })
      setApprovingAll(false)
      setItems(await loadItems(selectedRev.id))
      await loadRoom(bidId)
      await markSentOutside(choice.on ?? null, { onlyIfUnset: true })
      showToast(`Approved on ${done.length} row${done.length === 1 ? '' : 's'} · ${person.name} · entered by ${profileName ?? 'you'}.`, 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not enter their approval'), 'error')
    } finally {
      setBusy(false)
    }
  }

  /**
   * v2.4691 · the revision went out by email or on paper: `sent_outside_at` on the draft. Typed
   * answers set it on their day, once (`is null`); the office sets or changes it from step 5.
   */
  async function markSentOutside(ymd: string | null, opts: { onlyIfUnset?: boolean } = {}) {
    if (!selectedRev || !bidId || asRevisionStatus(selectedRev.status) !== 'draft') return
    if (opts.onlyIfUnset && selectedRev.sent_outside_at) return
    const at = enteredDecisionAt(ymd, new Date(), todayYmdInAppTz())
    let q = db.from('bid_submittals').update({ sent_outside_at: at }).eq('id', selectedRev.id)
    if (opts.onlyIfUnset) q = q.is('sent_outside_at', null)
    const { error } = await q
    if (error) {
      if (!opts.onlyIfUnset) showToast(formatErrorMessage(error, 'Could not record the day it was sent'), 'error')
      return
    }
    setRevisions(await loadRevisions(bidId))
    if (!opts.onlyIfUnset) showToast(`Rev ${selectedRev.rev_number} · sent by email. Nobody was emailed.`, 'success')
  }

  /**
   * Their answer on one row, part by part (2026-10-02): each group of lines that share an answer
   * and a note is one write in the reviewer's name, on the day they answered; lines taken back
   * are emptied. One thread line and one event for the whole save. Nothing is sent.
   */
  async function saveAnswer(save: AnswerSave) {
    if (!answering || !selectedRev || !bidId) return
    const row = answering
    const { writes } = save
    if (writes.changed === 0) return
    setBusy(true)
    try {
      let who: { id: string; name: string } | null = null
      if (writes.sets.length > 0 && save.person) {
        const { theRoom, person } = await roomAndReviewerFor(save.person)
        who = person
        const at = enteredDecisionAt(save.on, new Date(), todayYmdInAppTz())
        for (const set of writes.sets) {
          const callPatch = enteredDecisionPatch({ decision: set.decision, note: set.note, person, byUserId: user?.id ?? null, byName: profileName, now: at })
          if (set.row) {
            const { error } = await db.from('bid_submittal_items').update(callPatch).eq('id', row.id)
            if (error) throw error
          } else await enterCallOnParts(db, row.id, callPatch, { partIds: set.partIds })
        }
        const counts = writes.counts
        await db.from('bid_submittal_messages').insert({ room_id: theRoom.id, submittal_id: selectedRev.id, person_id: null, author_kind: 'system', body: enteredEntryBody(person.name, counts, 'entered', save.on ?? null), kind: 'decision', tags: row.tag.trim() ? [row.tag.trim()] : [], metadata: { entered_by: user?.id ?? null, rev_number: selectedRev.rev_number, counts, person_id: person.id, ...(save.on ? { decided_on: save.on } : {}) } })
        await db.from('bid_submittal_events').insert({ room_id: theRoom.id, submittal_id: selectedRev.id, person_id: person.id, event_type: 'decided', metadata: { ...counts, rev_number: selectedRev.rev_number, entered: true, by: user?.id ?? null, ...(save.on ? { decided_on: save.on } : {}) } })
      }
      if (writes.clearPartIds.length > 0) await clearEnteredCallsOnParts(db, row.id, { ...CLEAR_DECISION_PATCH }, writes.clearPartIds)
      if (writes.clearRow) {
        const { error } = await db.from('bid_submittal_items').update({ ...CLEAR_DECISION_PATCH }).eq('id', row.id)
        if (error) throw error
      }
      setAnswering(null)
      const fresh = await loadItems(selectedRev.id)
      setItems(fresh)
      setParts(await loadItemParts(db, fresh.map((x) => x.id)))
      if (who) await loadRoom(bidId)
      // v2.4691 · an answer typed on a draft means the draft went out by email: the header stops saying "draft".
      if (who) await markSentOutside(save.on ?? null, { onlyIfUnset: true })
      const said = [writes.counts.approved ? `${writes.counts.approved} approved` : '', writes.counts.revise ? `${writes.counts.revise} revise` : '', writes.counts.rejected ? `${writes.counts.rejected} rejected` : ''].filter(Boolean).join(' · ')
      const tag = row.tag.trim() || 'the accessory'
      showToast(who ? `${said} on ${tag} · ${who.name} · entered by ${profileName ?? 'you'}. Nobody was emailed.` : `Taken back on ${tag}.`, 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not record their answer'), 'error')
    } finally {
      setBusy(false)
    }
  }

  /** The row's parts as the editor left them, saved; the row's own label, house and lead time read from them (2026-10-01). */
  async function savePartsOf(itemId: string, drafts: PartDraft[] | undefined): Promise<Record<string, unknown>> {
    if (!drafts || !bidId) return {}
    const before = partsOf.get(itemId) ?? []
    const r = await saveItemParts(db, itemId, bidId, before, drafts)
    // 2026-10-02 · a takeoff part left out is remembered on the bid, so a refresh from the takeoff does not bring it back.
    const countRowId = items.find((it) => it.id === itemId)?.source_count_row_id ?? null
    const leftOut = leftOutPieceKeys(before, drafts)
    if (countRowId && leftOut.length > 0) {
      await rememberLeftOutLines(supabase, bidId, countRowId, leftOut)
      setTakeoff(await loadTakeoffCandidates(db, bidId, { selectedVersionId: bidsRef.current.find((b) => b.id === bidId)?.selected_bid_version_id ?? null }))
    }
    return { submitted_label: r.submitted_label, supply_house_id: r.supply_house_id, lead_time_days: r.lead_time_days }
  }

  const savingItem = useRef(false)
  async function saveItem(patch: SubmittalItemPatch) {
    if (!editing || !selectedRev || !bidId) return
    const { thenAnswer, parts: partDrafts, ...rowPatch } = patch
    // 2026-10-03 · one save at a time: the window reads Saving… and holds, so a second press cannot add the row twice.
    if (savingItem.current) return
    savingItem.current = true
    setBusy(true)
    try {
      await saveItemWrites(thenAnswer, partDrafts, rowPatch)
    } finally {
      savingItem.current = false
      setBusy(false)
    }
  }
  async function saveItemWrites(thenAnswer: boolean | undefined, partDrafts: SubmittalItemPatch['parts'], rowPatch: Omit<SubmittalItemPatch, 'thenAnswer' | 'parts'>) {
    if (!editing || !selectedRev || !bidId) return
    if (editing.id === NEW_ROW_ID) {
      // v2.4105 · the row by hand lands now, with what the editor holds; their answer goes on it once it exists.
      const { data: made, error } = await db.from('bid_submittal_items').insert({ submittal_id: selectedRev.id, sequence_order: editing.sequence_order, ...rowPatch, tag: rowPatch.tag ?? '', sheet_pages: rowPatch.sheet_pages ?? [] }).select('id').single()
      if (error) {
        showToast(formatErrorMessage(error, 'Could not add the row'), 'error')
        return
      }
      if (partDrafts && made) {
        try {
          const rollUp = await savePartsOf((made as { id: string }).id, partDrafts)
          await db.from('bid_submittal_items').update(rollUp).eq('id', (made as { id: string }).id)
        } catch (e) {
          showToast(formatErrorMessage(e, 'The row is in, but its parts did not save'), 'error')
        }
      }
      setEditing(null)
      setItems(await loadItems(selectedRev.id))
      return
    }
    try {
      const write: Record<string, unknown> = { ...rowPatch, ...(await savePartsOf(editing.id, partDrafts)) }
      const { error } = await db.from('bid_submittal_items').update(write).eq('id', editing.id)
      if (error) throw error
      const rowId = editing.id
      setEditing(null)
      const fresh = await loadItems(selectedRev.id)
      setItems(fresh)
      // "Save and enter their answer…": the row is saved, so the answer window opens on it as it now reads.
      if (thenAnswer) {
        setParts(await loadItemParts(db, fresh.map((x) => x.id)))
        setAnswering(fresh.find((x) => x.id === rowId) ?? null)
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save the row.', 'error')
    }
  }

  // v2.4067: where this submittal is — the strip reads the tab's own state, and its button
  // runs the same handler the button row calls (Wendi: "I did not know where to start").
  const journey = useMemo(
    () =>
      submittalJourney({
        scheduleTags: specified.length,
        picks: picks.length,
        rev: selectedRev
          ? {
              number: selectedRev.rev_number,
              status: asRevisionStatus(selectedRev.status),
              isNewest: newestRev != null && selectedRev.id === newestRev.id,
              rows: items.length,
              owesReason: tiles.alternatesWithoutReason + tiles.designChangesWithoutReason,
              sheetsNeeded: tiles.sheetsNeeded,
              packageBuilt: !!selectedRev.package_path,
              sentOutside: !!selectedRev.sent_outside_at,
            }
          : null,
        room: room ? { status: room.status, opens: events.filter((e) => e.event_type === 'view').length, identified: people.map((p) => p.name).filter((n): n is string => !!n) } : null,
        decisions: selectedRev ? decisions : null,
        procurement: procCounts,
        takeoff: takeoff ? { fixtures: takeoff.fixtures, withProduct: takeoff.withProduct } : null,
      }),
    [specified.length, picks.length, selectedRev, newestRev, items.length, tiles, room, events, people, decisions, procCounts, takeoff],
  )
  function runJourneyAction(action: JourneyAction) {
    if (!selectedBid) return
    if (action === 'open_pricing') onOpenPricing?.(selectedBid)
    else if (action === 'plug_in_schedule') setPlugInOpen(true)
    else if (action === 'ask_robot_schedule') void askRobot('read_schedule', {}, null)
    else if (action === 'build_rev1') void createFirstRevision()
    else if (action === 'choose_from_takeoff') openTakeoffPicker()
    else if (action === 'drop_vendor_pdf') fileInput.current?.click()
    else if (action === 'build_package') void askBuildPackage()
    else if (action === 'share') setSharing(true)
    else if (action === 'copy_room_link' && room) void navigator.clipboard.writeText(roomLink(window.location.origin, room.token)).then(() => showToast('Link copied.', 'success'), () => showToast(roomLink(window.location.origin, room.token), 'info'))
    else if (action === 'resubmit') void startNextDraft()
  }
  /** A pill click: scroll to the stage's controls and ring them for a moment. */
  /**
   * A pill jumps into its stage (v2.4201): the section opens — a later one included — then the page
   * scrolls to the stage's controls and rings them. A folded stage's controls draw on the next frame,
   * so the ring waits for it; the section itself is the fallback when a stage has no controls yet.
   * A step's title does the same (v2.4207) with `scroll: 'ifNeeded'`: the finger is already on the
   * step, so the page moves only when the controls would sit outside the viewport — and then to centre,
   * since the nearest edge is where a phone's tab bar sits.
   */
  function goToStage(stage: JourneyStage, opts: { scroll: 'center' | 'ifNeeded' } = { scroll: 'center' }) {
    setSectionToggles((m) => (m[stage.key] === true ? m : { ...m, [stage.key]: true }))
    const control = () => document.querySelector(`[data-tour="${stage.anchor}"]`)
    const ring = () => {
      const el = control() ?? document.querySelector(`[data-testid="road-${stage.number}"]`)
      if (!(el instanceof HTMLElement)) return
      const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const r = el.getBoundingClientRect()
      const offScreen = r.top < 0 || r.bottom > window.innerHeight
      if (typeof el.scrollIntoView === 'function' && (opts.scroll === 'center' || offScreen)) el.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' })
      el.classList.add('submittal-journey-flash')
      window.setTimeout(() => el.classList.remove('submittal-journey-flash'), 1600)
    }
    if (control()) ring()
    else if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(ring)
    else window.setTimeout(ring, 0)
  }
  /** The strip's button and the ? beside the bid name start at the top; a stage's ? starts at that stage's stop (v2.4125). */
  function startWalkThrough(stage?: number) {
    markSubmittalWalkthroughSeen()
    setOfferWalkThrough(false)
    setTourStage(typeof stage === 'number' ? stage : null)
    setTourSteps(null)
    setTourOpen(true)
  }

  const visibleBids = (onlyMyBids ? bids.filter(isMyBid) : bids).filter((b) => {
    const q = query.toLowerCase()
    if (!q) return true
    return bidDisplayName(b).toLowerCase().includes(q) || (b.customers?.name ?? '').toLowerCase().includes(q) || (b.bids_gc_builders?.name ?? '').toLowerCase().includes(q) || bidNumberMatchesQuery(b, query, prefixMap)
  })

  if (!selectedBid) {
    return (
      <div>
        <BidPickerSearchRow query={query} onQueryChange={setQuery} onlyMyBids={onlyMyBids} onOnlyMyBidsChange={setOnlyMyBids} />
        <BidPickerStandardList bids={visibleBids} prefixMap={prefixMap} onSelectBid={onSelectBid} searching={query.trim() !== ''} emptyMessage={bids.length === 0 ? 'No bids yet.' : onlyMyBids ? 'No bids you are the account manager or estimator for.' : 'No bids match your search.'} />
      </div>
    )
  }

  const bid = selectedBid
  const isDraft = selectedRev ? asRevisionStatus(selectedRev.status) === 'draft' : false
  // v2.4691 · step 5's line: a revision that went by email says so (until the room shares one); else the room's own words.
  const shareLine = selectedRev?.sent_outside_at && !room?.shared_at ? sentByEmailLine(selectedRev.sent_outside_at, decisions.entered) : room ? describeRoomLine(room, events.filter((e) => e.event_type === 'view').length, ROOM_TZ, decisions.entered) : ''
  // 2026-10-01 · what a draft could catch up on: rows the takeoff reads differently, hand rows that read like another row's part.
  const refreshPlan = isDraft && takeoff ? planTakeoffRefresh(items, partsOf, takeoff.candidates) : { rows: [], skipped: [] }
  const gradePlan = isDraft && specified.length > 0 ? planScheduleGrade(items, specified, partsOf) : { rows: [], skipped: [] }
  const foldHints = isDraft ? foldSuggestions(items, partsOf) : []

  // The road (v2.4090): a done stage folds to its line; the current stage and the stage it reads from stay open;
  // "Open every stage" (remembered per device) and the walkthrough open everything.
  const stageStatus = (key: JourneyStageKey): RoadStatus => journey.stages.find((st) => st.key === key)?.status ?? 'later'
  // 2026-10-04 · the newest draft's own facts: only a reason holds the package back, and a built package can be shared.
  const draftFacts = isDraft && newestRev != null && selectedRev?.id === newestRev.id ? { rows: gcItems.length, owesReason: tiles.alternatesWithoutReason + tiles.designChangesWithoutReason, packageBuilt: !!selectedRev.package_path } : null
  const gates = { package: stageGate(journey.stages, 'package', draftFacts), share: stageGate(journey.stages, 'share', draftFacts), resubmit: stageGate(journey.stages, 'resubmit') }
  // 2026-10-03 · every stage that is live, not the first alone: a draft answered by email has its rows, Their call and Resubmit live at once.
  const liveStageKeys = journey.stages.filter((st) => (st.status === 'current' || st.status === 'waiting') && st.key !== 'procure').map((st) => st.key)
  // What each stage reads from stays open beside it: the package reads the rows; their call and the resubmit land on the rows.
  // v2.4689 · step 7 opens step 6 alone: the Resubmit button's own line names the rows sent back, so the fourteen rows of
  // step 3 need not open with it (BP375 at step 7 opened 3, 6 and 8 at once — five screens before the log; punch list #89, item 7).
  const readsFrom: Partial<Record<JourneyStageKey, JourneyStageKey[]>> = { package: ['rows'], share: ['package'], review: ['rows'], resubmit: ['review'] }
  // 2026-10-05 · the robot's schedule read keeps step 1 open only while its tags wait to be confirmed; anything else it is doing rides on the folded step's line.
  const scheduleRead = liveTask(tasks, 'read_schedule')
  const scheduleReadNote = scheduleRead ? robotScheduleNote(scheduleRead, robotSeat, Date.now(), formatShortDate) : null
  function sectionOpen(key: JourneyStageKey): boolean {
    const toggled = sectionToggles[key]
    if (toggled != null) return toggled
    if (openAllStages || tourOpen) return true
    if (key === 'picks' && scheduleReadHoldsStepOpen(scheduleRead)) return true
    // v2.4169 · a stage you have not reached folds to its sentence; its controls draw only when you open it, and then held.
    if (key === 'build' && revisions.length === 0) return true
    // v2.4201 · Procure is a side track the office works at any time (long-lead items go in before a row is approved), so it never folds on its own.
    if (key === 'procure') return true
    if (stageStatus(key) === 'later') return false
    if (stageStatus(key) !== 'done') return true
    return liveStageKeys.some((live) => (readsFrom[live] ?? []).includes(key))
  }
  function toggleSection(key: JourneyStageKey) {
    const open = sectionOpen(key)
    setSectionToggles((m) => ({ ...m, [key]: !open }))
  }
  /** The step's title (v2.4207): open it and ring its controls, scrolling only when they would be off screen. */
  function jumpToSection(key: JourneyStageKey) {
    const stage = journey.stages.find((st) => st.key === key)
    if (stage) goToStage(stage, { scroll: 'ifNeeded' })
    else toggleSection(key)
  }
  const isNewest = selectedRev != null && newestRev != null && selectedRev.id === newestRev.id
  // v2.4593 · what the room's link shows now, for the line under the rows and the window: the newest revision on the GC's record
  // (2026-10-06: shared, or answered by email with its package); a closed room shows only that.
  const link = linkViewOf(recordList, isRoomClosed(room))
  /** The number the next draft takes: one past the newest revision, whichever one is on screen. */
  const nextRevNumber = (newestRev?.rev_number ?? selectedRev?.rev_number ?? 0) + 1

  return (
    // One column: What the GC sees opens in a window over the road (2026-10-02), not a pane beside it.
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '1rem', alignItems: 'start' }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <BidWorkflowTabTitleWithPreview bid={bid} previewEnabled={bidPreview != null} onOpenPreview={() => bidPreview?.openBidPreviewFromBid(bid)} h2Style={{ margin: 0, fontSize: '1.15rem' }} />
          </div>
          {/* One line (2026-10-05): which revision, and what the submittal is. Where the rows come from is step 1's to say; how many rows and sheets is step 3's. */}
          <p style={{ margin: '0.2rem 0 0', ...smallMuted }} data-tour="submittals-source" data-testid="revision-line">
            {selectedRev ? (
              <>
                <b style={{ color: 'var(--text-strong)' }}>{describeRevisionChip(selectedRev, revisionAnsweredAt(items, parts))}</b> · {selectedRev.title?.trim() || 'Plumbing fixtures & equipment'}
                {previousRev && isNewest && isDraft ? ` · started from Rev ${previousRev.rev_number}` : ''}
                {selectedRev.package_path ? <span style={{ color: 'var(--text-green-700)', fontWeight: 600 }}> · package built</span> : null}
                {!isNewest ? <span style={{ color: 'var(--text-amber-700)', fontWeight: 600 }}> · an older revision, the record; the newest is where the work is</span> : null}
              </>
            ) : (
              'Submittals · plumbing fixtures & equipment · no submittal on this bid yet'
            )}
          </p>
        </div>
        {/* The page's one help door (owner, 2026-10-05): the ? beside the ×. It starts the walkthrough, which opens with the words the page uses and links to the guide. */}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, marginLeft: 'auto' }}>
          <button
            type="button"
            onClick={() => startWalkThrough()}
            title="How this page works. Walk me through it"
            aria-label="How this page works"
            style={{ font: 'inherit', flexShrink: 0, width: 22, height: 22, borderRadius: '50%', border: '1.5px solid #3b82f6', color: 'var(--text-blue-500)', background: 'var(--surface)', fontSize: '0.78rem', fontWeight: 700, lineHeight: 1, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
            data-testid="submittal-help"
          >
            ?
          </button>
          {!narrowViewport640 ? (
            <button type="button" onClick={onClose} title="Close" aria-label="Close" style={bidDetailCloseXStyle}>
              ×
            </button>
          ) : null}
        </span>
      </div>

      {loading ? <p style={smallMuted}>Loading…</p> : null}

      {!loading ? (
        <SubmittalJourneyStrip
          journey={journey}
          busy={busy}
          onAction={runJourneyAction}
          onGoToStage={goToStage}
          onWalkThrough={() => startWalkThrough()}
          onSeeGc={selectedRev && isNewest ? () => setSeeGcOpen(true) : undefined}
          offerWalkThrough={offerWalkThrough}
          onDismissOffer={() => {
            markSubmittalWalkthroughSeen()
            setOfferWalkThrough(false)
          }}
        />
      ) : null}
      {tourOpen && tourSteps ? <SpotlightTour steps={tourSteps} startIndex={tourStage != null ? tourStopForStage(tourStage, tourSteps) : 0} onClose={() => { setTourOpen(false); setTourSteps(null) }} guideHref={SUBMITTAL_GUIDE_HREF} guideLabel="Read the full guide: build a submittal package →" /> : null}

      {/* The hidden file inputs live here so every section's button can reach them, folded or not. */}
      <input ref={fileInput} type="file" accept="application/pdf,.pdf" aria-label="Vendor PDF" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void dropVendorPdf(f) }} />
      <input ref={reviewerInput} type="file" accept="application/pdf,.pdf,.eml,.msg,.txt,.html,message/rfc822" aria-label="Reviewer's file" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void dropReviewerFile(f) }} />

      {!loading ? (
        <label style={{ ...smallMuted, display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', alignSelf: 'flex-end' }}>
          <input type="checkbox" checked={openAllStages} onChange={(e) => { setOpenAllStages(e.target.checked); setSectionToggles({}); rememberOpenEveryStage(e.target.checked) }} /> Open every stage
        </label>
      ) : null}
      {!loading ? (
        <div className="submittal-road" data-testid="submittal-road">
          {/* The loop the button on step 7 starts (punch list #84): back to step 2 as the next revision, then 3 to 6 again. Decoration: the button and its line say it in words. */}
          {showNextRevisionLoop(journey.stages, isNewest) ? (
            <div className="submittal-road-loop" data-testid="next-revision-loop" aria-hidden="true">
              <span className="submittal-road-loop__label">Next revision</span>
              <span className="submittal-road-loop__head" />
            </div>
          ) : null}
          {/* 1 · Sources (Where the rows come from) — the source line is in the header; the robot's offer lives here while there is no schedule. */}
          <RoadSection n={1} about={SUBMITTAL_STAGE_ABOUT[1]} onHelp={() => startWalkThrough(1)} title="Where the rows come from" status={stageStatus('picks')} open={sectionOpen('picks')} onToggle={() => toggleSection('picks')} onJump={() => jumpToSection('picks')} anchor="submittals-schedule"
            summaryWhenOpen={false}
            summary={<>{takeoffFixtures > 0 ? <>{takeoffFixtures} on the takeoff · </> : null}{specified.length === 0 ? 'no schedule yet' : `${specified.length} tag${specified.length === 1 ? '' : 's'}`}{picks.length > 0 ? <> · {picks.length} picked line{picks.length === 1 ? '' : 's'}</> : null}{scheduleReadNote?.chip ? <span data-testid="road-1-robot" style={{ color: scheduleReadNote.tone === 'warn' ? 'var(--text-amber-700)' : scheduleReadNote.tone === 'bad' ? 'var(--text-red-700)' : undefined, fontWeight: scheduleReadNote.tone === 'plain' ? undefined : 600 }}> · <span aria-hidden>🤖 </span>{scheduleReadNote.chip}</span> : null}</>}>
            <SubmittalSourcesPanel
              takeoffFixtures={takeoffFixtures}
              takeoffWithProduct={takeoff?.withProduct ?? 0}
              scheduleTags={specified.length}
              picks={picks.length}
              hasRevision={revisions.length > 0}
              hasPlans={Boolean(selectedBid?.plans_link)}
              tasks={tasks}
              robotSeat={robotSeat}
              lookChecked={lookChecked}
              busy={busy}
              onChooseFromTakeoff={openTakeoffPicker}
              onOpenCompare={onOpenPricing ? () => onOpenPricing(bid) : undefined}
              onPlugIn={() => setPlugInOpen(true)}
              onAskRobot={() => void askRobot('read_schedule', {}, null)}
              onCancelTask={(id) => void markTask(id, 'cancelled').then(() => loadTasks(bidId as string))}
              onLookChecked={(tag, checked) => setLookChecked((m) => ({ ...m, [tag]: checked }))}
              onConfirmSchedule={(t, tags) => void confirmSchedule(t, tags)}
            />
          </RoadSection>

          {/* 2 · Build Rev 1 / the revision */}
          <RoadSection n={2} about={stageAbout(2, selectedRev ? { number: selectedRev.rev_number, isNewest } : null)} onHelp={() => startWalkThrough(2)} title={revisions.length === 0 ? 'Build Rev 1' : `Rev ${selectedRev?.rev_number ?? newestRev?.rev_number ?? 1}`} status={stageStatus('build')} open={sectionOpen('build')} onToggle={() => toggleSection('build')} onJump={() => jumpToSection('build')} anchor="submittals-build"
            summary={selectedRev ? (
              <span style={{ display: 'inline-flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }} data-tour="submittals-revisions">
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }} data-testid="revision-strip" data-tour="submittals-revisions">
                  {revisions.map((r) => {
                    const on = r.id === selectedRev.id
                    return (
                      <button key={r.id} type="button" data-testid="revision-chip" aria-pressed={on} onClick={() => setSelectedRevId(r.id)} style={{ ...btn, padding: '0.25rem 0.65rem', borderRadius: 999, fontSize: '0.75rem', background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', borderColor: on ? '#2563eb' : 'var(--border-strong)', color: on ? 'var(--text-blue-700)' : 'var(--text-muted)', fontWeight: on ? 700 : 500 }}>
                        {describeRevisionChip(r, on ? revisionAnsweredAt(items, parts) : answeredByRev.get(r.id) ?? null)}
                      </button>
                    )
                  })}
                </div>
              </span>
            ) : 'not built yet'}>
        {!loading && revisions.length === 0 ? (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', maxWidth: 640 }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-strong)' }}>No submittal on this bid yet</h3>
            {picks.length > 0 ? (
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-base)', lineHeight: 1.45 }}>
                Rev 1 is the first version of your submittal. It is built from your picks on Pricing, one row per tag. Each row has the product you picked and the reason and lead time you gave. A pick with no tag becomes an accessory row.
              </p>
            ) : specified.length > 0 ? (
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-base)', lineHeight: 1.45 }}>
                Rev 1 is the first version of your submittal. It is built from the schedule, one row per tag. Each row starts Missing until you type its product with Edit or add it from the takeoff.
              </p>
            ) : null}
            {takeoffFixtures > 0 ? <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-base)' }} data-testid="build-from-takeoff-line">Or build it from the takeoff. One row per fixture you tick. The part under it is the product. Each row reads Proposed until the plans’ schedule says otherwise.</p> : null}
            {specified.length === 0 && takeoffFixtures === 0 ? <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-amber-700)' }}>This bid has no fixture schedule. Type or paste it under Step 1 first. Without it, Rev 1 would be accessories only.</p> : null}
            <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {takeoffFixtures > 0 && specified.length === 0 && picks.length === 0 ? (
                <button type="button" disabled={busy} onClick={openTakeoffPicker} style={btnPrimary} data-testid="build-from-takeoff">
                  Choose from the takeoff
                </button>
              ) : null}
              {specified.length > 0 || picks.length > 0 ? (
                <button type="button" disabled={busy} onClick={() => void createFirstRevision()} style={btnPrimary}>
                  {picks.length > 0 ? 'Build Rev 1 from the picks' : 'Build Rev 1 from the schedule'}
                </button>
              ) : null}
              {takeoffFixtures > 0 && (specified.length > 0 || picks.length > 0) ? (
                <button type="button" disabled={busy} onClick={openTakeoffPicker} style={btn} data-testid="build-from-takeoff">
                  …or choose from the takeoff
                </button>
              ) : null}
              {notNeededAt ? (
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }} data-testid="submittals-not-needed">
                  Not needed on this job · {new Date(notNeededAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: ROOM_TZ })} ·{' '}
                  <button type="button" disabled={busy} onClick={() => void toggleNotNeeded(false)} style={{ ...btnQuiet, textDecoration: 'underline dotted' }}>undo</button>
                </span>
              ) : (
                <button type="button" disabled={busy} onClick={() => void toggleNotNeeded(true)} style={{ ...btnQuiet, textDecoration: 'underline dotted' }} title="No submittal card for this job on the Dashboard">
                  Not needed on this job
                </button>
              )}
            </div>
          </div>
        ) : null}

            {selectedRev ? (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {isDraft && (picks.length > 0 || specified.length > 0) ? (
                  <button type="button" disabled={busy} onClick={() => void rebuildRows()} style={btn} title="Build every row again from today's picks. Your edits stay where the product did not change">
                    Rebuild rows from picks
                  </button>
                ) : null}
                {isDraft && gradePlan.rows.length > 0 ? (
                  <button type="button" disabled={busy} onClick={() => setGradeOpen(true)} style={{ ...btn, borderColor: '#2563eb', color: 'var(--text-blue-700)', fontWeight: 600 }} title="The schedule names rows that read Proposed. Each takes the plans' product and its status; nothing you typed changes" data-testid="grade-against-schedule">
                    Grade {gradePlan.rows.length} row{gradePlan.rows.length === 1 ? '' : 's'} against the schedule…
                  </button>
                ) : null}
                <span style={smallMuted}>{selectedRev.note ? selectedRev.note : isDraft ? 'A draft until you share it. Each shared version stays as the record.' : 'Shared. A new version starts when the GC sends rows back, or a product changes.'}</span>
                {isDraft && isNewest ? (
                  <button type="button" disabled={busy} onClick={() => void deleteDraft()} style={{ ...btnQuiet, color: 'var(--text-red-700)', textDecoration: 'underline dotted', marginLeft: 'auto' }}>
                    Delete draft
                  </button>
                ) : null}
              </div>
            ) : null}
          </RoadSection>

          {selectedRev ? (
            <>
              {/* 3 · Reasons & cut sheets — the rows are the work */}
              <RoadSection n={3} about={SUBMITTAL_STAGE_ABOUT[3]} onHelp={() => startWalkThrough(3)} title="Reasons & cut sheets" status={stageStatus('rows')} open={sectionOpen('rows')} onToggle={() => toggleSection('rows')} onJump={() => jumpToSection('rows')} anchor="submittals-rows-section"
                summaryWhenOpen={false}
                summary={<span data-testid="submittal-tiles" data-tour="submittals-tiles" title={describeRevision(tiles)}>{describeWhatIsLeft(tiles)}</span>}>
                <SubmittalRowsTable
                  items={items}
                  gcItems={gcItems}
                  orderOnlyItems={orderOnlyItems}
                  parts={parts}
                  partsOf={partsOf}
                  houseNameById={houseNameById}
                  sourceFiles={sourceFiles}
                  previousRev={previousRev}
                  prevById={prevById}
                  decisions={decisions}
                  scheduleTags={specified.length}
                  isDraft={isDraft}
                  busy={busy}
                  foldHints={foldHints}
                  onEdit={setEditing}
                  onAnswer={setAnswering}
                  onSplit={(it) => void splitRow(it)}
                  onFold={(fromId, intoId) => setFoldFrom({ fromId, intoId })}
                  onTakeOff={(it) => void askTakeOff(it)}
                  onPutBack={(it) => void setOrderOnly(it, false)}
                  onLeaveOut={(it) => void leaveOrderOnlyOut(it)}
                  onTypeSchedule={isDraft ? () => setPlugInOpen(true) : undefined}
                  onSaveSheet={(it) => void saveRowCutSheet(it)}
                  savingSheetId={savingSheetId}
                />
                {isDraft && (takeoffLeftOut > 0 || takeoffStandsLine) ? (
                  <div style={{ marginTop: '0.4rem', fontSize: '0.8125rem', display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }} data-testid="left-out-line">
                    {takeoffLeftOut > 0 ? <span><b style={{ color: 'var(--text-base)' }}>Left out</b><span style={{ color: 'var(--text-muted)' }}> · {takeoffLeftOut} from the takeoff · not submitted, not ordered</span></span> : null}
                    {takeoffStandsLine ? <span style={{ color: 'var(--text-green-700)', fontWeight: 600 }} data-testid="stands-line" title="Approved on an earlier revision. They stay there and on the procurement log">{takeoffStandsLine}</span> : null}
                    <button type="button" disabled={busy} onClick={openTakeoffPicker} style={{ ...btnQuiet, color: 'var(--text-link)', textDecoration: 'underline' }}>Show them</button>
                  </div>
                ) : null}
                {/* v2.4140 · the statuses explained where they are read: a quiet link under the table opens the legend. */}
                <div style={{ marginTop: '0.35rem', fontSize: '0.78rem' }}>
                  <button type="button" onClick={() => setStatusLegendOpen((v) => !v)} aria-expanded={statusLegendOpen} style={{ ...btnQuiet, textDecoration: 'underline', fontSize: 'inherit' }} data-testid="status-legend-toggle">
                    {statusLegendOpen ? 'Hide what the statuses mean' : 'What do the statuses mean?'}
                  </button>
                  {statusLegendOpen ? (
                    <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.1rem', color: 'var(--text-muted)', lineHeight: 1.5 }} data-testid="status-legend">
                      {(Object.keys(STATUS_LABELS) as ProductStatus[]).map((k) => (
                        <li key={k}><b style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{STATUS_LABELS[k]}</b> — {STATUS_MEANINGS[k]}</li>
                      ))}
                      <li><b style={{ color: 'var(--text-strong)', fontWeight: 600 }}>Cut sheet</b> — the maker’s page for the product, from the house’s PDF</li>
                    </ul>
                  ) : null}
                </div>
                {isNewest ? (() => {
                  // v2.4174 · see what they see, Layer 1 (#62): the reviewer's own headline and subline, from the rows as they stand — under the rows, where they are edited.
                  const r = describeForReviewer(items, { rev: selectedRev.rev_number, ...link })
                  return (
                    <p style={{ margin: '0.45rem 0 0', fontSize: '0.8125rem', color: 'var(--text-base)', lineHeight: 1.45 }} data-testid="reviewer-line">
                      <b style={{ color: 'var(--text-strong)' }}>{r.lead}</b> {r.line} <span style={smallMuted}>{r.note}</span>
                    </p>
                  )
                })() : null}
                {isDraft && (refreshPlan.rows.length > 0 || foldHints.length > 0) ? (
                  // 2026-10-01 · what this draft could catch up on, said where the rows are.
                  <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.7rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-blue-tint)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }} data-testid="draft-catch-up" data-tour="submittals-catch-up">
                    {refreshPlan.rows.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem 0.6rem', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-base)' }}>
                        <span style={{ flex: '1 1 16rem', minWidth: 0 }}>
                          The takeoff reads differently for <b style={{ color: 'var(--text-strong)' }}>{refreshPlan.rows.map((r) => r.tag).slice(0, 4).join(', ')}{refreshPlan.rows.length > 4 ? ` and ${refreshPlan.rows.length - 4} more` : ''}</b>.
                        </span>
                        <button type="button" disabled={busy} onClick={() => void openTakeoffRefresh()} style={{ ...btn, borderColor: '#2563eb', color: 'var(--text-blue-700)', fontWeight: 600 }} data-testid="refresh-from-takeoff">
                          Refresh from the takeoff…
                        </button>
                      </div>
                    ) : null}
                    {foldHints.map((h) => (
                      <div key={h.fromId} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem 0.6rem', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-base)' }} data-testid="fold-hint">
                        <span style={{ flex: '1 1 16rem', minWidth: 0 }}>
                          <b style={{ color: 'var(--text-strong)' }}>{h.fromTag}</b> reads like a part of <b style={{ color: 'var(--text-strong)' }}>{h.intoTag}</b>.
                        </span>
                        <button type="button" disabled={busy} onClick={() => setFoldFrom({ fromId: h.fromId, intoId: h.intoId })} style={{ ...btn, borderColor: '#2563eb', color: 'var(--text-blue-700)', fontWeight: 600 }} data-testid="fold-hint-open">
                          Make it a part…
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.5rem' }}>
                  <button type="button" disabled={busy} onClick={() => fileInput.current?.click()} style={btn} title="Save the house's PDF on this version. Then put each page on its row" data-tour="submittals-drop">
                    Drop a vendor PDF
                  </button>
                  <span style={smallMuted}>A cut sheet is the maker’s page for a product. Drop the house’s whole PDF here, then put each page on its row.</span>
                  {isDraft && takeoffFixtures > 0 ? (
                    <button type="button" disabled={busy} onClick={openTakeoffPicker} style={{ ...btn, marginLeft: 'auto', borderColor: '#2563eb', color: 'var(--text-blue-700)', fontWeight: 600 }} title="Every fixture on the takeoff: the GC sees it, order only, or left out" data-testid="add-from-takeoff">
                      Choose what the GC sees…
                    </button>
                  ) : null}
                  {isDraft ? (
                    <button type="button" disabled={busy} onClick={() => void addRowByHand()} style={{ ...btn, marginLeft: isDraft && takeoffFixtures > 0 ? undefined : 'auto' }} title="Type a row yourself: the tag, the product and the lead time" data-testid="add-row-by-hand">
                      + Add a row by hand
                    </button>
                  ) : null}
                  {isDraft && (items.some((x) => rowSplitTags(x.tag).length > 1) || takeoffCandidatesForPicker.some((c) => c.canSplit)) ? (
                    <button type="button" onClick={() => setSplitRuleOpen(true)} style={{ ...btnQuiet, textDecoration: 'underline', fontSize: '0.78rem' }} data-testid="split-rule-link-rows">when can a row split?</button>
                  ) : null}
                </div>
                {sourceFiles.length > 0 ? (
                  <SubmittalSheetStrip
                    files={sourceFiles}
                    items={gcItems}
                    thumbnails={thumbs}
                    busy={busy}
                    onNeedThumbnails={(i) => void showPages(i)}
                    onAssign={(f, p, id) => void assignPageToItem(f, p, id)}
                    onUnassign={(f, p, id) => void unassignPageFromItem(f, p, id)}
                    onDone={(i) => void doneWithFile(i)}
                    onRemove={(i) => void removeFile(i)}
                    guesses={Object.fromEntries(sourceFiles.map((f, i) => { const t = liveTask(tasks, 'file_cut_sheets', (inp) => inp.file_index === i && (!inp.path || inp.path === f.path)); const g = t ? sheetGuessesToConfirm(t, f.pages) : null; return [i, g ? guessByPage(g) : new Map()] }))}
                    robotLines={Object.fromEntries(sourceFiles.map((f, i) => { const t = liveTask(tasks, 'file_cut_sheets', (inp) => inp.file_index === i && (!inp.path || inp.path === f.path)); const stale = t && taskStatus(t) === 'queued' ? staleAsk('file_cut_sheets', t.requested_at, robotSeat, Date.now(), formatShortDate) : null; return [i, t ? `${describeTask(t, f.pages)}${stale ? ` · ${stale.suffix}` : ''}` : ''] }))}
                    confirmLabels={Object.fromEntries(sourceFiles.map((f, i) => { const t = liveTask(tasks, 'file_cut_sheets', (inp) => inp.file_index === i && (!inp.path || inp.path === f.path)); const g = t ? sheetGuessesToConfirm(t, f.pages) : null; return [i, g ? confirmLabel(g.sure.length, g.unsure.length) : ''] }))}
                    robotSeat={robotSeat}
                    onAskRobot={(i) => void askRobot('file_cut_sheets', { file_index: i, path: sourceFiles[i]?.path, name: sourceFiles[i]?.name, pages: sourceFiles[i]?.pages }, selectedRev.id)}
                    onConfirmGuesses={(i) => void confirmGuesses(i)}
                    onAssignPages={(i) => setAssignFile(i)}
                    onReadParts={(i) => void readFileParts(i)}
                    onSaveFile={(i) => void saveSourceFile(i)}
                  />
                ) : null}
              </RoadSection>

              {/* 4 · Package */}
              <RoadSection n={4} about={SUBMITTAL_STAGE_ABOUT[4]} onHelp={() => startWalkThrough(4)} title="Package" status={stageStatus('package')} open={sectionOpen('package')} onToggle={() => toggleSection('package')} onJump={() => jumpToSection('package')} anchor="submittals-package-section"
                summary={selectedRev.package_path ? (
                  <>
                    <span style={{ color: 'var(--text-green-700)', fontWeight: 600 }}>built</span>
                    {' · '}
                    <button type="button" disabled={busy} onClick={() => void openStoredPackage(selectedRev.package_path as string, selectedRev.rev_number)} style={{ ...btnQuiet, textDecoration: 'underline', fontSize: 'inherit' }}>open it</button>
                    {selectedRev.drive_file_url ? <> · <a href={selectedRev.drive_file_url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-link)', fontWeight: 600 }} data-testid="drive-link">filed in Drive ↗</a></> : null}
                  </>
                ) : items.length > 0 ? 'not built for this version yet' : 'appears once Rev 1 has rows'}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {items.length > 0 ? (
                    <button type="button" disabled={busy || !gates.package.on} onClick={() => void askBuildPackage()} style={{ ...(selectedRev.package_path ? btn : btnPrimary), opacity: gates.package.on ? 1 : 0.5 }} data-testid="build-package"
 title="One PDF for the GC: the cover table, then every cut sheet stamped with its tag and status. Saved on this version and opened" data-tour="submittals-package">
                      {buildPackageLabel(!!selectedRev.package_path, isDraft ? tiles.sheetsNeeded : 0)}
                    </button>
                  ) : null}
                  {selectedRev.package_path ? (
                    <button type="button" disabled={busy} onClick={() => void openStoredPackage(selectedRev.package_path as string, selectedRev.rev_number)} style={btn}>
                      Open package
                    </button>
                  ) : null}
                  {selectedRev.drive_file_url ? null : selectedRev.package_path && asRevisionStatus(selectedRev.status) !== 'draft' ? (
                    <button type="button" disabled={busy} onClick={() => void fileInDrive()} style={{ ...btnQuiet, textDecoration: 'underline dotted' }} title="Save this version's package PDF in the bid's job folder on Drive, under Submittals" data-testid="file-in-drive">File in Drive</button>
                  ) : null}
                  <span style={smallMuted} data-testid="package-caption">{gates.package.on ? (isDraft && tiles.sheetsNeeded > 0 ? `One PDF on our letterhead. ${tiles.sheetsNeeded} row${tiles.sheetsNeeded === 1 ? ' has' : 's have'} no cut sheet yet. The cover lists ${tiles.sheetsNeeded === 1 ? 'it' : 'them'} as cut sheets to follow.` : 'One PDF on our letterhead. The cover table first, then every cut sheet stamped with its tag and status.') : gates.package.why}</span>
                </div>
              </RoadSection>

              {/* 5 · Share — the room link and the people on it */}
              <RoadSection n={5} about={SUBMITTAL_STAGE_ABOUT[5]} onHelp={() => startWalkThrough(5)} title="Share" status={stageStatus('share')} open={sectionOpen('share')} onToggle={() => toggleSection('share')} onJump={() => jumpToSection('share')} anchor="submittals-share-section"
                summaryWhenOpen={!room}
                summary={shareLine || (items.length > 0 ? 'not shared yet' : 'appears once Rev 1 has rows')}>
                {(items.length > 0 && isNewest) || room ? (
                  <SubmittalRoomPanel
                    showShare={items.length > 0 && isNewest}
                    revisionShared={asRevisionStatus(selectedRev.status) === 'shared'}
                    shareGate={gates.share}
                    room={room}
                    roomLine={shareLine}
                    sentOutsideAt={selectedRev.sent_outside_at}
                    onSentOutside={isDraft && isNewest ? (ymd) => void markSentOutside(ymd) : undefined}
                    people={people}
                    events={events}
                    decidedBy={(personId) => items.filter((it) => it.reviewed_by_person_id === personId).length}
                    busy={busy}
                    onShare={() => setSharing(true)}
                    onCloseRoom={() => void closeRoom()}
                    onReopenRoom={() => void reopenRoom()}
                    onSetMayDecide={(personId, mayDecide) => void setMayDecide(personId, mayDecide)}
                    onClosePerson={(personId) => void closePerson(personId)}
                  />
                ) : null}
              </RoadSection>

              {/* 6 · Their call — decisions, the reviewer's own files, the thread */}
              <RoadSection n={6} about={SUBMITTAL_STAGE_ABOUT[6]} onHelp={() => startWalkThrough(6)} title={<>Their call{decisions.decided > 0 || reviewerFiles.length > 0 ? <span style={{ ...smallMuted, fontWeight: 400 }}> on Rev {selectedRev.rev_number}</span> : null}</>} status={stageStatus('review')} open={sectionOpen('review')} onToggle={() => toggleSection('review')} onJump={() => jumpToSection('review')} anchor="submittals-review"
                summaryWhenOpen={gcItems.length === 0}
                summary={decisions.decided > 0 ? `${describeDecisions(decisions)}${decisions.open > 0 ? ` · ${decisions.open} still open` : ''}` : room ? (room.status === 'closed' ? 'link closed' : 'no answers yet') : 'appears after you share'}>
                {gcItems.length > 0 || asRevisionStatus(selectedRev.status) !== 'draft' || reviewerFiles.length > 0 || room ? (
                  <SubmittalTheirCallPanel
                    items={gcItems}
                    partsOf={partsOf}
                    canEdit={isDraft && isNewest}
                    isNewest={isNewest}
                    nextRev={selectedRev.rev_number + 1}
                    sharedLine={shareLine}
                    recordLine={emailedRecordLine({ rev: selectedRev.rev_number, shared: !!selectedRev.shared_at, hasPackage: !!selectedRev.package_path, hasAnswer: items.some(isReviewerAnswer) || parts.some(isReviewerAnswer) })}
                    onEdit={setEditing}
                    onAnswer={setAnswering}
                    decisions={decisions}
                    decisionsText={() => decisionsAsText(items, `${describeRevisionChip(selectedRev)} · ${bidWorkflowTabHeading(bid, prefixMap)}`, ROOM_TZ)}
                    approvable={isNewest ? approvableRows.length : 0}
                    showDropFile={asRevisionStatus(selectedRev.status) !== 'draft' || reviewerFiles.length > 0}
                    reviewerFiles={reviewerFiles}
                    tasks={tasks}
                    robotSeat={robotSeat}
                    room={room}
                    messages={messages}
                    threadOpen={threadOpen}
                    replyTo={replyTo}
                    replyBody={replyBody}
                    replying={replying}
                    busy={busy}
                    onApproveAll={() => setApprovingAll(true)}
                    onPickFile={() => reviewerInput.current?.click()}
                    onAskRobot={(i, f) => void askRobot('read_redlines', { reviewer_index: i, path: f.path, name: f.name, person_id: f.personId, person_name: f.personName }, selectedRev.id)}
                    onOpenFile={(f) => void openReviewerFile(f)}
                    onRemoveFile={(i) => void removeReviewerFile(i)}
                    onCancelTask={(id) => void markTask(id, 'cancelled').then(() => loadTasks(bidId as string))}
                    onConfirmRedlines={(t, withUnsure) => void confirmRedlines(t, withUnsure)}
                    onToggleThread={() => setThreadOpen((o) => !o)}
                    onReplyTo={(id) => { setReplyTo(id); setReplyBody('') }}
                    onReplyBody={setReplyBody}
                    onSendReply={() => void sendReply()}
                  />
                ) : null}
              </RoadSection>

              {/* 7 · Resubmit */}
              <RoadSection n={7} about={stageAbout(7, { number: selectedRev.rev_number, isNewest })} onHelp={() => startWalkThrough(7)} title="Resubmit" status={stageStatus('resubmit')} open={sectionOpen('resubmit')} onToggle={() => toggleSection('resubmit')} onJump={() => jumpToSection('resubmit')} anchor="submittals-resubmit-section"
                summaryWhenOpen={!(isNewest && decisions.sentBack > 0)}
                summary={isNewest && decisions.sentBack > 0 ? (decisions.noAnswer > 0 ? `${decisions.sentBack} row${decisions.sentBack === 1 ? '' : 's'} sent back · ${decisions.noAnswer} with no answer go on Rev ${selectedRev.rev_number + 1} too` : `${decisions.sentBack} row${decisions.sentBack === 1 ? '' : 's'} sent back · start a Rev ${selectedRev.rev_number + 1} draft`) : previousRev ? `Rev ${selectedRev.rev_number} carries what Rev ${previousRev.rev_number} sent back` : 'nothing sent back'}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {/* One button (2026-10-05): with rows sent back and something approved it asks which rows go on the draft; the line beside it says nothing is sent. */}
                  <button type="button" disabled={busy || !isNewest || !gates.resubmit.on} onClick={() => void startNextDraft()} style={{ ...(!isNewest || !gates.resubmit.on ? btn : btnGreen), opacity: !isNewest || !gates.resubmit.on ? 0.5 : 1 }} data-testid="new-revision" title={!isNewest ? 'Only the newest revision can be revised' : draftHasChoice ? `Start a draft of Rev ${nextRevNumber}. ${resubmitCaption(nextRevNumber)}` : `Carry every row into a Rev ${nextRevNumber} draft and mark what changed. ${resubmitNothingSent(nextRevNumber)}`} data-tour="submittals-resubmit">
                    {resubmitLabel(nextRevNumber)}
                  </button>
                  <span style={smallMuted} data-testid="resubmit-caption">{!isNewest ? 'Only the newest revision can be revised.' : !gates.resubmit.on ? gates.resubmit.why : draftHasChoice ? resubmitCaption(nextRevNumber) : `The draft starts with every row. ${resubmitNothingSent(nextRevNumber)}`}</span>
                </div>
              </RoadSection>
            </>
          ) : null}

              {/* 8 · Procure — a side track, always open (v2.4201) and drawn with or without a revision: long-lead items go in before a row is approved; never the Next stage until every row is approved */}
            <RoadSection n={8} about={SUBMITTAL_STAGE_ABOUT[8]} onHelp={() => startWalkThrough(8)} title="Procure" status={stageStatus('procure')} open={sectionOpen('procure')} onToggle={() => toggleSection('procure')} onJump={() => jumpToSection('procure')} anchor="submittals-procure-section" last always
              summaryWhenOpen={!procCounts}
              summary={procCounts ? `${procCounts.steps.gc} ${procCounts.gcLabel.toLowerCase()} · ${procCounts.steps.to_order} to order · ${procCounts.steps.on_order} on order · ${procCounts.steps.on_site} on site${procCounts.late > 0 ? ` · ${procCounts.late} behind schedule` : ''}` : isNewest || !selectedRev ? 'fills in as the GC approves rows · long-lead items can go in now' : 'on the newest version'}>
              {(isNewest || !selectedRev) && bidId && selectedBid ? (
                <SubmittalProcurementPanel
                  bidId={bidId}
                  bidLabel={bidDisplayName(selectedBid) || 'Bid'}
                  companyName={companyName}
                  letterhead={{ companyName: reportSettings.companyName, tagline: reportSettings.companyTagline, phone: reportSettings.officePhone, mailingAddress: reportSettings.mailingAddress }}
                  projectAddress={selectedBid.address ?? null}
                  gcName={selectedBid.customers?.name ?? selectedBid.bids_gc_builders?.name ?? null}
                  roomUrl={room ? roomLink(window.location.origin, room.token) : null}
                  items={procItems}
                  reviewerNames={people.filter((p) => p.may_decide).map((p) => p.name)}
                  currentUser={{ id: user?.id ?? null, name: profileName ?? '' }}
                  busy={busy}
                  onCounts={setProcCounts}
                  // v2.4663 · a draft nobody has shared: its lines read Not sent yet, not Waiting on the GC.
                  draftRev={selectedRev && selectedRev.status === 'draft' ? selectedRev.rev_number : null}
                  // The Next line's door to the approve-all window, while a row still has no call (v2.4581).
                  onEnterApproval={isNewest && selectedRev && approvableRows.length > 0 ? () => setApprovingAll(true) : undefined}
                  houses={houses}
                  onLinesChanged={() => {
                    // House, lead time or stage set from the log's tick bar: the rows and their parts read again.
                    if (selectedRev) void loadItems(selectedRev.id).then(setItems)
                  }}
                  onOpenItem={({ itemId, partKey, house }) => {
                    // The row's Edit window over the log, on the part tapped: no scrolling up to the rows. A standing row opens too.
                    const it = items.find((x) => x.id === itemId) ?? standing.items.find((x) => x.id === itemId)
                    if (!it) return
                    const part = partKey ? (partsOf.get(itemId) ?? []).find((p) => p.procure_key === partKey) : undefined
                    setEditFocus({ itemId, partId: part?.id ?? null, house: house === true })
                    setEditing(it)
                  }}
                  onAnswerItem={({ itemId, partKey }) => {
                    // A line the GC still holds: the row's Their answer window over the log, on the part tapped.
                    const it = items.find((x) => x.id === itemId)
                    if (!it || isOrderOnlyRow(it)) return
                    const part = partKey ? (partsOf.get(itemId) ?? []).find((p) => p.procure_key === partKey) : undefined
                    setAnswerFocus({ itemId, partId: part?.id ?? null })
                    setAnswering(it)
                  }}
                />
              ) : null}
            </RoadSection>
        </div>
      ) : null}

      {assignFile != null && sourceFiles[assignFile] ? (
        <SubmittalAssignPagesModal
          file={sourceFiles[assignFile]!}
          fileIndex={assignFile}
          items={gcItems}
          loadBytes={assignLoadBytes}
          guesses={assignGuesses}
          busy={busy}
          onDone={applyAssignWrites}
          onReads={(reads) => void noteFileReads(assignFile, reads)}
          onClose={() => setAssignFile(null)}
        />
      ) : null}
      {houseFile && sourceFiles[houseFile.fileIndex] ? (
        <SubmittalHouseFileModal
          fileName={sourceFiles[houseFile.fileIndex]!.name}
          read={houseFile.read}
          matches={houseFile.matches}
          rows={items}
          partsByItem={partsOf}
          houses={houses}
          houseId={sourceFiles[houseFile.fileIndex]!.houseId}
          busy={busy}
          onApply={(c, h) => void applyHouseFile(c, h)}
          onClose={() => setHouseFile(null)}
        />
      ) : null}
      {editing ? <SubmittalItemEditDialog item={editing} sourceFiles={sourceFiles} houses={houses} parts={partsOf.get(editing.id) ?? []} canEnterDecision={editing.id !== NEW_ROW_ID} isNew={editing.id === NEW_ROW_ID} canEditProduct={isDraft && !standing.revOf.has(editing.id)} orderOnly={isOrderOnlyRow(editing)} boughtParts={editBought} focusPartId={editFocus?.itemId === editing.id ? editFocus.partId : null} focusHouse={editFocus?.itemId === editing.id && editFocus.house && editFocus.partId == null} busy={busy} onSave={(p) => void saveItem(p)} onClose={() => setEditing(null)} /> : null}
      {answering && selectedRev ? (
        <SubmittalAnswerDialog key={answering.id} item={answering} parts={partsOf.get(answering.id) ?? []} people={people} sources={reviewerSources} revLabel={`Rev ${selectedRev.rev_number}`} focusPartId={answerFocus?.itemId === answering.id ? answerFocus.partId : null} busy={busy} onSave={(a) => void saveAnswer(a)} onClose={() => setAnswering(null)} />
      ) : null}
      {takeOff ? (
        <SubmittalTakeOffDialog
          tag={takeOff.item.tag}
          bought={takeOff.bought}
          busy={busy}
          onOrderOnly={() => void setOrderOnly(takeOff.item, true)}
          onLeaveOut={() => void removeRow(takeOff.item)}
          onClose={() => setTakeOff(null)}
        />
      ) : null}
      {approvingAll && selectedRev ? (
        <SubmittalApproveAllDialog
          revLabel={`Rev ${selectedRev.rev_number}`}
          rows={approvableRows.length}
          alreadyDecided={decisions.decided}
          missing={items.filter((it) => !asDecision(it.review_decision) && asStatus(it.status) === 'missing').length}
          people={people}
          sources={reviewerSources}
          busy={busy}
          onSave={(c) => void approveAll(c)}
          onClose={() => setApprovingAll(false)}
        />
      ) : null}
      {gradeOpen ? <SubmittalScheduleGradeModal rows={gradePlan.rows} skipped={gradePlan.skipped} busy={busy} onConfirm={() => void gradeRowsAgainstSchedule()} onClose={() => setGradeOpen(false)} /> : null}
      {refreshOpen ? <SubmittalTakeoffRefreshModal rows={refreshPlan.rows} skipped={refreshPlan.skipped} busy={busy} onConfirm={() => void refreshRowsFromTakeoff()} onClose={() => setRefreshOpen(false)} /> : null}
      {foldFrom && items.some((x) => x.id === foldFrom.fromId) ? (
        <SubmittalFoldModal from={items.find((x) => x.id === foldFrom.fromId)!} rows={items} partsByItem={partsOf} suggestedIntoId={foldFrom.intoId} busy={busy} onConfirm={(intoId, replaceId) => void foldRowInto(foldFrom.fromId, intoId, replaceId)} onClose={() => setFoldFrom(null)} />
      ) : null}
      {splitRuleOpen ? <SplitRuleModal examples={splitExplanation(takeoffCandidatesForPicker)} onClose={() => setSplitRuleOpen(false)} /> : null}
      {takeoffPicker && takeoff ? (
        <SubmittalTakeoffPicker mode={takeoffPicker} revLabel={takeoffPicker === 'build' ? 'Rev 1' : `Rev ${selectedRev?.rev_number ?? newestRev?.rev_number ?? 1}`} candidates={takeoffCandidatesForPicker} bought={takeoffPicker === 'add' ? takeoffBought : undefined} boughtParts={takeoffPicker === 'add' ? takeoffBoughtParts : undefined} busy={busy} onConfirm={(plan, splits) => void confirmTakeoff(plan, splits)} onClose={() => setTakeoffPicker(null)} />
      ) : null}
      {plugInOpen && bidId && selectedBid ? <PlugInScheduleModal open onClose={() => setPlugInOpen(false)} onSaved={() => { setPlugInOpen(false); void load(bidId) }} bidId={bidId} bidLabel={bidDisplayName(selectedBid) || 'Bid'} rows={[]} /> : null}
      {nextDraft ? (
        <SubmittalResubmitChooser
          words={resubmitChooser(nextDraft.newest.rev_number, nextDraft.counts)}
          choice={nextDraftRows}
          busy={busy}
          onChoose={setNextDraftRows}
          onCancel={() => setNextDraft(null)}
          onConfirm={() => void buildNextRevision(nextDraft, nextDraftRows)}
        />
      ) : null}
      {sharing && selectedRev && bidId ? (
        <SubmittalShareModal
          bidId={bidId}
          revision={selectedRev}
          room={room}
          untrimmedFiles={sourceFiles.filter((f, i) => !f.trimmedAt && keptPages(assignmentsFromItems(items), i).length > 0).length}
          onClose={() => setSharing(false)}
          onDoneWithFiles={doneWithAllFiles}
          onBuildPackage={() => buildPackage(false)}
          onShared={(r) => {
            setSharing(false)
            setRoom(r)
            void load(bidId)
          }}
        />
      ) : null}
    </div>
    {seeGcOpen && selectedRev && isNewest && selectedBid ? (
      <SeeWhatTheGcSees
        items={items}
        parts={parts}
        revNumber={selectedRev.rev_number}
        revisions={recordList}
        link={link}
        roomToken={room?.token ?? null}
        hasPackage={Boolean(selectedRev.package_path)}
        company={{ name: companyName, tagline: reportSettings.companyTagline, phone: reportSettings.officePhone }}
        bid={{ label: bidDisplayName(selectedBid) || 'Bid', projectName: selectedBid.project_name ?? null, address: selectedBid.address ?? null }}
        onClose={() => setSeeGcOpen(false)}
      />
    ) : null}
    </div>
  )
}
