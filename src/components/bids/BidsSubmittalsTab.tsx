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
import { Children, Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { SpotlightTour, spotlightTourStepsPresent, type SpotlightTourStep } from '../SpotlightTour'
import { RobotOffer } from './RobotOffer'
import { robotSeatState, type RobotSeatRow, type RobotSeatState } from '../../lib/submittals/robotOffer'
import { SeeWhatTheGcSees } from './SeeWhatTheGcSees'
import { describeForReviewer } from '../../lib/submittals/seeWhatTheySee'
import { SubmittalJourneyStrip } from './SubmittalJourneyStrip'
import { SubmittalProcurementPanel } from './SubmittalProcurementPanel'
import { PlugInScheduleModal } from './PlugInScheduleModal'
import { SubmittalTakeoffPicker } from './SubmittalTakeoffPicker'
import { loadTakeoffCandidates, saveTakeoffChoices, type TakeoffCandidatesLoad } from '../../lib/submittals/takeoffCandidatesIo'
import { candidateToItemInserts, rowSplitTags, splitExplanation, type TakeoffCandidate } from '../../lib/submittals/takeoffCandidates'
import { carryPartInsert, copyPartInsert, formatPartQty, partCallsLine, partsByItem, partsFromPieces, rollUpFromParts, submittedParts, type PartDraft, type SubmittalPartInsert, type SubmittalPartRow } from '../../lib/submittals/itemParts'
import { clearEnteredCallsOnParts, enterCallOnParts, insertItemParts, loadItemParts, saveItemParts } from '../../lib/submittals/itemPartsIo'
import { SplitRuleModal } from './SplitRuleModal'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { procurementItemsFrom } from '../../lib/submittals/procurementLogIo'
import type { ProcurementItemSource } from '../../lib/submittals/procurementLog'
import { submittalJourney, type JourneyAction, type JourneyStage, type JourneyStageKey, stageGate } from '../../lib/submittals/submittalJourney'
import { SUBMITTAL_GUIDE_HREF, SUBMITTAL_STAGE_ABOUT, SUBMITTAL_TOUR_STEPS, hasOpenEveryStage, tourStopForStage, hasSeenSubmittalWalkthrough, markSubmittalWalkthroughSeen, rememberOpenEveryStage } from '../../lib/submittals/submittalTour'
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
import { ProductStatusChip } from './ProductStatusChip'
import { SubmittalItemEditDialog, type SubmittalItemPatch } from './SubmittalItemEditDialog'
import { SubmittalPartsCell } from './SubmittalPartsCell'
import { SubmittalHouseFileModal } from './SubmittalHouseFileModal'
import { matchFileToRows, pairParts, defaultFileChoice, planFileApply, readHouseFile, type FileTagChoice, type FileTagMatch, type HouseFileRead } from '../../lib/submittals/houseFileParts'
import { SubmittalApproveAllDialog, type ApproveAllChoice } from './SubmittalApproveAllDialog'
import { SubmittalSheetStrip, type ThumbState } from './SubmittalSheetStrip'
import { SubmittalAssignPagesModal } from './SubmittalAssignPagesModal'
import type { ItemWrite } from '../../lib/submittals/assignPagesWalk'
import { SubmittalShareModal } from './SubmittalShareModal'
import { anonymousOpens, asPersonHow, describeHow, describeRoomLine, describeTrail, personTrail, roomLink, ROOM_ROLE_LABELS, asRoomRole, type SubmittalEventRow, type SubmittalPersonRow, type SubmittalRoomRow, describeThreadEntry, parseRoomMessage, summarizeThread, threadOrder } from '../../lib/submittals/submittalRoom'
import { replyToRoom } from '../../lib/submittals/replyToRoom'
import type { RoomMessage } from '../../../supabase/functions/_shared/submittalRoomPayload'
import { APP_CALENDAR_TZ as ROOM_TZ, todayYmdInAppTz } from '../../utils/dateUtils'
import { DECISION_LABELS, decisionsAsText, describeDecisions, itemsSentBack, summarizeDecisions } from '../../lib/submittals/reviewDecisions'
import { describeEnteredCount, describeReviewerFile, parseReviewerFiles, reviewerFileKind, reviewerFilePath, serializeReviewerFiles, type ReviewerFile } from '../../lib/submittals/reviewerFiles'
import { CLEAR_DECISION_PATCH, enteredDecisionAt, enteredDecisionPatch, enteredEntryBody, enteredSuffix, rowsToApproveAll } from '../../lib/submittals/enteredDecisions'
import type { ReviewerChoice } from '../../lib/submittals/reviewerPick'
import { newRoomToken } from '../../lib/submittals/submittalRoom'
import { confirmLabel, guessByPage, liveTask, redlinesToConfirm, scheduleToConfirm, sheetGuessesToConfirm, taskInput, taskStatus, type SubmittalTaskRow } from '../../lib/submittals/robotTasks'
import { describeTask, type SubmittalTaskKind } from '../../../supabase/functions/_shared/submittalRobot'
import { keptPages, remapAfterTrim } from '../../lib/submittals/sheetAssignment'
import { assignmentsFromItems } from '../../lib/submittals/sheetStripModel'
import { buildSubmittalRows, changeNoteFor, summarizeChanges, type PickInput, type SpecifiedInput } from '../../lib/submittals/buildSubmittalRows'
import { needsReason, REASON_LABELS, type StatusOverride, COLUMN_HELP, STATUS_LABELS, STATUS_MEANINGS, type ProductStatus } from '../../lib/submittals/productStatus'
import { describeLeadTime } from '../../lib/submittals/leadTime'
import { buildCoverModel, buildSubmittalPackage, packageFileName, packageSheets, planPackage, renderCoverPdf, type PackageRowInput } from '../../lib/submittals/submittalPackage'
import { cachedTestReportSettings, fetchTestReportSettings } from '../../lib/jobs/testReportSettings'
import type { TestReportSettings } from '../../lib/jobs/testReport'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { fixtureKey } from '../../lib/submittals/picksFromQuotes'
import { loadPicksForBid, setSubmittalsNotNeeded } from '../../lib/submittals/firstRevisionClient'
import {
  asDecision,
  asReason,
  asRevisionStatus,
  asStatus,
  describeRevision, describeWhatIsLeft,
  describeRevisionChip,
  draftToItemInsert,
  formatPages,
  formatShortDate,
  itemToPrevious,
  needsSheet,
  parseSourceFiles,
  revisionTiles,
  serializeSourceFiles,
  SUBMITTALS_BUCKET,
  type SourceFile,
  type SubmittalItemRow,
  type SubmittalRevisionRow, blankSubmittalItem, carriedRowInsert, NEW_ROW_ID, rowsToCarry } from '../../lib/submittals/submittalRevision'

// The stage 1–2 tables are hand-typed until the regen chore; the untyped client keeps a checkout ahead of the push honest.
const db = supabase as unknown as SupabaseClient

const smallMuted: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
const btn: CSSProperties = { padding: '0.4rem 0.8rem', background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', fontWeight: 500 }
const btnPrimary: CSSProperties = { ...btn, background: '#2563eb', borderColor: '#2563eb', color: 'white', fontWeight: 600 }
const btnQuiet: CSSProperties = { background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.8125rem', color: 'var(--text-muted)', cursor: 'pointer' }
const btnGreen: CSSProperties = { ...btn, background: '#16a34a', borderColor: '#16a34a', color: 'white', fontWeight: 600 }
const th: CSSProperties = { textAlign: 'left', fontSize: '0.68rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', fontWeight: 600, whiteSpace: 'nowrap' }
const td: CSSProperties = { padding: '0.5rem 0.5rem', borderBottom: '1px solid var(--bg-muted)', verticalAlign: 'top', fontSize: '0.8125rem', color: 'var(--text-base)' }
const sub: CSSProperties = { display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }

type RoadStatus = 'done' | 'current' | 'waiting' | 'later'

/**
 * One stage of the road (v2.4090): the numbered dot on the rail, the title, a one-line
 * summary, and the body. A done stage folds to its summary line (click the title to
 * open it); the current stage is ringed; a later stage is dashed so a first-timer sees
 * the whole road. `anchor` is the `data-tour` the strip's pills and the walkthrough jump to.
 */
function RoadSection({ n, title, status, open, onToggle, onJump, anchor, summary, about, onHelp, last = false, always = false, children }: { n: number; title: ReactNode; status: RoadStatus; open: boolean; /** The caret: fold or unfold in place. */ onToggle: () => void; /** v2.4207 · the title: open the step and ring its controls, scrolling only when they would be off screen. */ onJump: () => void; anchor: string; summary?: ReactNode; about?: string; onHelp?: () => void; last?: boolean; /** v2.4201 · never out of reach (Procure): reads strong and draws a solid box even while the journey calls it later. */ always?: boolean; children?: ReactNode }) {
  const dot: CSSProperties = {
    width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '0.8125rem', flexShrink: 0,
    border: `2px solid ${status === 'done' ? '#16a34a' : status === 'current' ? '#2563eb' : status === 'waiting' ? '#d97706' : 'var(--border-strong)'}`,
    background: status === 'current' ? '#2563eb' : 'var(--surface)',
    color: status === 'done' ? 'var(--text-green-700)' : status === 'current' ? 'white' : status === 'waiting' ? 'var(--text-amber-700)' : 'var(--text-muted)',
  }
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }} aria-hidden>
        <div style={dot}>{status === 'done' ? '✓' : n}</div>
        {!last ? <div style={{ flex: 1, width: 2, minHeight: 14, background: status === 'done' ? '#16a34a' : 'var(--border)' }} /> : null}
      </div>
      <section data-tour={anchor} data-testid={`road-${n}`} data-status={status} data-open={open} style={{ padding: '0.15rem 0 1rem', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.25rem', minWidth: 0 }}>
            <button type="button" onClick={onJump} style={{ ...btnQuiet, fontSize: '0.95rem', fontWeight: 700, color: status === 'later' && !always ? 'var(--text-muted)' : 'var(--text-strong)', textAlign: 'left' }} data-testid={`road-${n}-title`}>
              {n} · {title}
            </button>
            <button type="button" onClick={onToggle} aria-expanded={open} aria-label={`${open ? 'Fold' : 'Unfold'} step ${n}`} title={open ? 'Fold this step' : 'Unfold this step'} style={{ ...btnQuiet, padding: '0.1rem 0.4rem', fontSize: '0.75rem', color: 'var(--text-faint)' }} data-testid={`road-${n}-caret`}>
              {open ? '▴' : '▾'}
            </button>
          </span>
          {summary ? <span style={{ fontSize: '0.8125rem', color: status === 'done' ? 'var(--text-green-700)' : status === 'waiting' ? 'var(--text-amber-700)' : 'var(--text-muted)', minWidth: 0 }}>{summary}</span> : null}
        </div>
        {about ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }} data-testid={`road-${n}-about`}>
            <span>{about}</span>
            {onHelp ? (
              <button type="button" onClick={onHelp} title={`Walk me through step ${n}`} aria-label={`Walk me through step ${n}`} style={{ font: 'inherit', flexShrink: 0, width: 18, height: 18, borderRadius: '50%', border: '1.5px solid #3b82f6', color: 'var(--text-blue-500)', background: 'var(--surface)', fontSize: '0.66rem', fontWeight: 700, lineHeight: 1, padding: 0, cursor: 'pointer' }}>
                ?
              </button>
            ) : null}
          </div>
        ) : null}
        {open && Children.toArray(children).some(Boolean) ? (
          <div data-testid={`road-${n}-body`} style={{ marginTop: '0.5rem', border: `1px ${status === 'later' && !always ? 'dashed' : 'solid'} ${status === 'current' ? '#2563eb' : 'var(--border)'}`, boxShadow: status === 'current' ? '0 0 0 3px var(--bg-blue-tint)' : undefined, borderRadius: 8, padding: '0.6rem 0.75rem', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {children}
          </div>
        ) : null}
      </section>
    </>
  )
}

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
  // v2.4118 · "When a row can split", opened from the rows' footer.
  const [splitRuleOpen, setSplitRuleOpen] = useState(false)
  const [sectionToggles, setSectionToggles] = useState<Partial<Record<JourneyStageKey, boolean>>>({})
  // Procure (v2.4083): the newest revision's rows as the log reads them, and the counts the strip's pill lights on.
  const [procItems, setProcItems] = useState<ProcurementItemSource[]>([])
  const [procCounts, setProcCounts] = useState<{ released: number; ordered: number; delivered: number; late: number } | null>(null)
  const [reportSettings, setReportSettings] = useState<TestReportSettings>(() => cachedTestReportSettings())
  const companyName = reportSettings.companyName
  const [prevItems, setPrevItems] = useState<SubmittalItemRow[]>([])
  const [editing, setEditing] = useState<SubmittalItemRow | null>(null)
  const [approvingAll, setApprovingAll] = useState(false)
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
  const [houses, setHouses] = useState<Array<{ id: string; name: string }>>([])
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await withSupabaseRetry(() => db.from('supply_houses').select('id, name').order('name'), 'load supply houses')
        if (!cancelled) setHouses(((data ?? []) as Array<{ id: string; name: string }>).filter((h) => h.name?.trim()))
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
  const [messageRows, setMessageRows] = useState<Array<{ id: string; submittal_id: string | null; tags: string[]; metadata: unknown; author_kind: string; kind: string }>>([])
  const [threadOpen, setThreadOpen] = useState(false)
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [replying, setReplying] = useState(false)
  const [sharing, setSharing] = useState(false)

  const bidId = selectedBid?.id ?? null
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
  const tiles = useMemo(() => revisionTiles(items), [items])
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
  const partsOf = useMemo(() => partsByItem(parts), [parts])
  const decisions = useMemo(() => summarizeDecisions(items), [items])
  // Rows one "they approved all of it" entry would cover: no call yet, and a product to approve.
  const approvableRows = useMemo(() => rowsToApproveAll(items), [items])
  useEffect(() => {
    let cancelled = false
    if (!selectedRev || newestRev?.id !== selectedRev.id) {
      setProcItems([])
      setProcCounts(null)
      return
    }
    void procurementItemsFrom(supabase, items, selectedRev.status !== 'draft', parts).then((rows) => {
      if (!cancelled) setProcItems(rows)
    })
    return () => {
      cancelled = true
    }
  }, [items, parts, selectedRev, newestRev])
  useEffect(() => {
    void fetchTestReportSettings().then(setReportSettings).catch(() => undefined)
  }, [])
  const prevById = useMemo(() => new Map(prevItems.map((p) => [p.id, p])), [prevItems])
  const overridesByTag = useMemo(() => {
    const out: Record<string, StatusOverride> = {}
    for (const s of specified) {
      const ov = overridesByFixture.get(fixtureKey(s.fixture))
      if (ov) out[s.tag] = ov
    }
    return out
  }, [specified, overridesByFixture])

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
      const { data, error } = await db.from('bid_submittals').insert({ bid_id: bidId, rev_number: 1, status: 'draft', created_by: user?.id ?? null }).select('id').single()
      if (error) throw error
      const revId = (data as { id: string }).id
      const n = await writeRows(revId, [])
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
    const on = new Set(items.map((it) => it.source_count_row_id).filter((x): x is string => !!x))
    return takeoff.candidates.map((c) => ({ ...c, alreadyOn: on.has(c.countRowId) }))
  }, [takeoff, items])
  function openTakeoffPicker() {
    if (takeoffFixtures === 0) return
    if (revisions.length === 0) setTakeoffPicker('build')
    else if (selectedRev && asRevisionStatus(selectedRev.status) === 'draft') setTakeoffPicker('add')
    else showToast('Rows from the takeoff land on a draft — start a new revision first.', 'info')
  }
  async function confirmTakeoff(rows: ReadonlyArray<TakeoffCandidate>, ticks: ReadonlyMap<string, boolean>, splits?: ReadonlyMap<string, boolean>, productKeys?: ReadonlyMap<string, ReadonlyArray<string>>) {
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
      const inserts: ReturnType<typeof candidateToItemInserts> = []
      const fromCandidate: TakeoffCandidate[] = []
      for (const c of rows) {
        const made = candidateToItemInserts(c, revId, seq + inserts.length + 1)
        inserts.push(...made)
        for (let k = 0; k < made.length; k++) fromCandidate.push(c)
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
      await saveTakeoffChoices(db, bidId, ticks, splits, productKeys)
      setTakeoffPicker(null)
      const proposed = inserts.filter((r) => r.status === 'proposed').length
      const toType = inserts.length - proposed
      const tail = `${inserts.length} row${inserts.length === 1 ? '' : 's'} from the takeoff · ${proposed} proposed${toType > 0 ? `, ${toType} to type with Edit` : ''}`
      if (takeoffPicker === 'build') {
        setSelectedRevId(revId)
        await load(bidId)
        showToast(`Rev 1 built · ${tail}.${partsNote}`, partsNote ? 'info' : 'success')
      } else {
        setItems(await loadItems(revId))
        setTakeoff(await loadTakeoffCandidates(db, bidId, { selectedVersionId: bidsRef.current.find((b) => b.id === bidId)?.selected_bid_version_id ?? null }))
        showToast(`Added · ${tail}.${partsNote}`, partsNote ? 'info' : 'success')
      }
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not build from the takeoff'), 'error')
    } finally {
      setBusy(false)
    }
  }
  /** v2.4107 · a draft row leaves; a row that came from the takeoff is unticked there too, so the choice holds. */
  async function removeRow(it: SubmittalItemRow) {
    if (!bidId || !selectedRev || asRevisionStatus(selectedRev.status) !== 'draft') return
    const ok = await confirm({ title: `Remove ${it.tag.trim() || 'this row'}`, message: it.source_count_row_id ? 'The row leaves this draft, and the fixture is unticked on the takeoff list so it stays out next time.' : 'The row leaves this draft.', confirmLabel: 'Remove', danger: true })
    if (!ok) return
    setBusy(true)
    try {
      const { error } = await db.from('bid_submittal_items').delete().eq('id', it.id)
      if (error) throw error
      if (it.source_count_row_id) await saveTakeoffChoices(db, bidId, new Map([[it.source_count_row_id, false]]))
      setItems(await loadItems(selectedRev.id))
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

  async function newRevision(onlySentBack = false) {
    if (!bidId || !newestRev) return
    const onNewest = newestRev.id === selectedRev?.id
    const previous = onNewest ? items : await loadItems(newestRev.id)
    const previousParts = onNewest ? partsOf : partsByItem(await loadItemParts(db, previous.map((p) => p.id)))
    const sentBack = itemsSentBack(previous)
    const preview = buildSubmittalRows({ specified, picks, previous: previous.map(itemToPrevious), overrides: overridesByTag })
    const kept = onlySentBack ? preview.filter((r) => sentBack.some((it) => (r.tag.trim() ? it.tag === r.tag : it.submitted_label === r.submittedLabel))) : preview
    // 2026-10-01 · the rows the picks do not rebuild (from the takeoff, typed by hand) carry as they stand.
    const carried = rowsToCarry(previous, preview)
    const carriedKept = onlySentBack ? carried.filter((it) => sentBack.some((sb) => sb.id === it.id)) : carried
    const total = kept.length + carriedKept.length
    const fromPicks = specified.length > 0 || picks.length > 0
    const ok = await confirm({
      title: onlySentBack ? `Rev ${newestRev.rev_number + 1} from the ${sentBack.length} row${sentBack.length === 1 ? '' : 's'} sent back` : fromPicks ? `Rev ${newestRev.rev_number + 1} from today's picks` : `Rev ${newestRev.rev_number + 1} from Rev ${newestRev.rev_number}`,
      message: onlySentBack
        ? `Only the rows the reviewer marked Revise or Reject on Rev ${newestRev.rev_number} carry into the new draft — ${total} row${total === 1 ? '' : 's'}. The rest stand as approved on Rev ${newestRev.rev_number}.`
        : `${preview.length > 0 ? `${summarizeChanges(preview)} against Rev ${newestRev.rev_number}. ` : ''}${carried.length > 0 ? `${carried.length} row${carried.length === 1 ? '' : 's'} from the takeoff or typed by hand carry as ${carried.length === 1 ? 'it stands' : 'they stand'}, with ${carried.length === 1 ? 'its' : 'their'} parts. ` : ''}Sheets, reasons and lead times carry where the product is unchanged.${asRevisionStatus(newestRev.status) === 'draft' ? ` Rev ${newestRev.rev_number} was never shared and will read superseded.` : ''}`,
      confirmLabel: `Build Rev ${newestRev.rev_number + 1}`,
    })
    if (!ok) return
    setBusy(true)
    try {
      const { data, error } = await db
        .from('bid_submittals')
        .insert({ bid_id: bidId, rev_number: newestRev.rev_number + 1, status: 'draft', title: newestRev.title, source_files: newestRev.source_files, created_by: user?.id ?? null })
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
        // A resubmit of the rows sent back: the parts the GC approved stand; only the parts sent back are asked again.
        await carryPartsOnto((made ?? []) as Array<{ id: string; carried_from_item_id: string | null; submitted_label: string | null }>, previous, previousParts, onlySentBack)
      }
      if (asRevisionStatus(newestRev.status) === 'draft') {
        const { error: supErr } = await db.from('bid_submittals').update({ status: 'superseded' }).eq('id', newestRev.id)
        if (supErr) throw supErr
      }
      setSelectedRevId(revId)
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
      const reads = readPages(texts, walkRowsFrom(items))
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
      const { data, error } = await supabase.storage.from(SUBMITTALS_BUCKET).createSignedUrl(f.path, 300)
      if (error || !data?.signedUrl) throw error ?? new Error('No link.')
      window.open(data.signedUrl, '_blank', 'noopener')
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
      const byTag = new Map(items.map((it) => [it.tag.trim().toUpperCase(), it]))
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
      const byTag = new Map(items.map((it) => [it.tag.trim().toUpperCase(), it]))
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
  async function buildPackage(open = true) {
    if (!bidId || !selectedRev) return
    setBusy(true)
    try {
      const settings = await fetchTestReportSettings()
      const rowsIn: PackageRowInput[] = items.map((it) => {
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

  /** A five-minute signed link to the stored package; the fresh blob as the fallback when the link cannot be minted. */
  async function openStoredPackage(path: string, revNumber: number, fallback?: Blob) {
    const name = packageFileName(revNumber, bidWorkflowTabHeading(bid, prefixMap))
    const { data } = await supabase.storage.from(SUBMITTALS_BUCKET).createSignedUrl(path, 300, { download: name })
    const url = data?.signedUrl ?? (fallback ? URL.createObjectURL(fallback) : null)
    if (!url) {
      showToast('The package is stored, but the link could not be opened right now.', 'error')
      return
    }
    window.open(url, '_blank', 'noopener')
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
   * joins it now (how = named); the room itself is minted if the bid has none yet — nothing is
   * shared by that.
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
    const { data: existing } = await db.from('bid_submittal_people').select('id, name, email').eq('room_id', theRoom.id).ilike('email', choice.email.trim()).maybeSingle()
    if (existing) return { theRoom, person: existing as { id: string; name: string; email: string | null } }
    const { data, error } = await db.from('bid_submittal_people').insert({ room_id: theRoom.id, name: choice.name, email: choice.email.trim().toLowerCase(), role: choice.role, may_decide: true, token: newRoomToken(), how: 'named', invited_by: user?.id ?? null }).select('id, name, email').single()
    if (error) throw error
    return { theRoom, person: data as { id: string; name: string; email: string | null } }
  }

  /**
   * One entry for a submittal approved whole: every row with no call yet (and a product) reads
   * Approved in the reviewer's name, on the day they said it. Rows that carry a call keep it.
   */
  async function approveAll(choice: ApproveAllChoice) {
    if (!selectedRev || !bidId) return
    const rows = rowsToApproveAll(items)
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
      showToast(`Approved on ${done.length} row${done.length === 1 ? '' : 's'} · ${person.name} · entered by ${profileName ?? 'you'}.`, 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not enter their approval'), 'error')
    } finally {
      setBusy(false)
    }
  }

  /** The row's parts as the editor left them, saved; the row's own label, house and lead time read from them (2026-10-01). */
  async function savePartsOf(itemId: string, drafts: PartDraft[] | undefined): Promise<Record<string, unknown>> {
    if (!drafts || !bidId) return {}
    const r = await saveItemParts(db, itemId, bidId, partsOf.get(itemId) ?? [], drafts)
    return { submitted_label: r.submitted_label, supply_house_id: r.supply_house_id, lead_time_days: r.lead_time_days }
  }

  async function saveItem(patch: SubmittalItemPatch) {
    if (!editing || !selectedRev || !bidId) return
    const { entered, clearDecision, parts: partDrafts, ...rowPatch } = patch
    if (editing.id === NEW_ROW_ID) {
      // v2.4105 · the row by hand lands now, with what the editor holds; a call on it is entered with Edit once it exists.
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
      if (entered) showToast('The row is in. Their call goes on it with Edit.', 'info')
      return
    }
    try {
      let write: Record<string, unknown> = { ...rowPatch, ...(await savePartsOf(editing.id, partDrafts)) }
      let enteredFor: { id: string; name: string } | null = null
      if (entered) {
        // 5b · the reviewer's call, typed from their file, on the day they made it.
        const { theRoom, person } = await roomAndReviewerFor(entered.person)
        enteredFor = person
        const callPatch = enteredDecisionPatch({ decision: entered.decision, note: entered.note, person, byUserId: user?.id ?? null, byName: profileName, now: enteredDecisionAt(entered.on, new Date(), todayYmdInAppTz()) })
        // A row with parts: the call lands on the parts picked (all the GC sees by default); the row reads the roll-up.
        const onParts = await enterCallOnParts(db, editing.id, callPatch, { partIds: entered.partIds ?? null })
        if (onParts === 0) write = { ...write, ...callPatch }
        const n = Math.max(1, onParts)
        const counts = { approved: entered.decision === 'approved' ? n : 0, revise: entered.decision === 'revise' ? n : 0, rejected: entered.decision === 'rejected' ? n : 0 }
        const { error } = await db.from('bid_submittal_items').update(write).eq('id', editing.id)
        if (error) throw error
        await db.from('bid_submittal_messages').insert({ room_id: theRoom.id, submittal_id: selectedRev.id, person_id: null, author_kind: 'system', body: enteredEntryBody(person.name, counts, 'entered', entered.on ?? null), kind: 'decision', tags: editing.tag.trim() ? [editing.tag.trim()] : [], metadata: { entered_by: user?.id ?? null, rev_number: selectedRev.rev_number, counts, person_id: person.id, ...(entered.on ? { decided_on: entered.on } : {}) } })
        await db.from('bid_submittal_events').insert({ room_id: theRoom.id, submittal_id: selectedRev.id, person_id: person.id, event_type: 'decided', metadata: { ...counts, rev_number: selectedRev.rev_number, entered: true, by: user?.id ?? null, ...(entered.on ? { decided_on: entered.on } : {}) } })
      } else {
        if (clearDecision) {
          if ((partsOf.get(editing.id) ?? []).some((p) => p.on_submittal)) await clearEnteredCallsOnParts(db, editing.id, { ...CLEAR_DECISION_PATCH })
          else write = { ...write, ...CLEAR_DECISION_PATCH }
        }
        const { error } = await db.from('bid_submittal_items').update(write).eq('id', editing.id)
        if (error) throw error
      }
      setEditing(null)
      setItems(await loadItems(selectedRev.id))
      if (enteredFor) {
        await loadRoom(bidId)
        showToast(`${DECISION_LABELS[entered!.decision]} on ${editing.tag.trim() || 'the accessory'} · ${enteredFor.name} · entered by ${profileName ?? 'you'}.`, 'success')
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
    else if (action === 'build_package') void buildPackage()
    else if (action === 'share') setSharing(true)
    else if (action === 'copy_room_link' && room) void navigator.clipboard.writeText(roomLink(window.location.origin, room.token)).then(() => showToast('Link copied.', 'success'), () => showToast(roomLink(window.location.origin, room.token), 'info'))
    else if (action === 'resubmit') void newRevision(true)
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

  // The road (v2.4090): a done stage folds to its line; the current stage and the stage it reads from stay open;
  // "Open every stage" (remembered per device) and the walkthrough open everything.
  const stageStatus = (key: JourneyStageKey): RoadStatus => journey.stages.find((st) => st.key === key)?.status ?? 'later'
  const gates = { package: stageGate(journey.stages, 'package'), share: stageGate(journey.stages, 'share'), resubmit: stageGate(journey.stages, 'resubmit') }
  const currentStageKey = journey.stages.find((st) => (st.status === 'current' || st.status === 'waiting') && st.key !== 'procure')?.key ?? null
  // What each stage reads from stays open beside it: the package reads the rows; their call and the resubmit land on the rows.
  const readsFrom: Partial<Record<JourneyStageKey, JourneyStageKey[]>> = { package: ['rows'], share: ['package'], review: ['rows'], resubmit: ['rows', 'review'] }
  const scheduleReadLive = liveTask(tasks, 'read_schedule') != null
  function sectionOpen(key: JourneyStageKey): boolean {
    const toggled = sectionToggles[key]
    if (toggled != null) return toggled
    if (openAllStages || tourOpen) return true
    if (key === 'picks' && scheduleReadLive) return true
    // v2.4169 · a stage you have not reached folds to its sentence; its controls draw only when you open it, and then held.
    if (key === 'build' && revisions.length === 0) return true
    // v2.4201 · Procure is a side track the office works at any time (long-lead items go in before a row is approved), so it never folds on its own.
    if (key === 'procure') return true
    if (stageStatus(key) === 'later') return false
    if (stageStatus(key) !== 'done') return true
    return currentStageKey != null && (readsFrom[currentStageKey] ?? []).includes(key)
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

  return (
    <div style={{ display: 'grid', gridTemplateColumns: seeGcOpen && selectedRev && isNewest && !narrowViewport640 ? 'minmax(0, 1fr) 400px' : 'minmax(0, 1fr)', gap: '1rem', alignItems: 'start' }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <BidWorkflowTabTitleWithPreview bid={bid} previewEnabled={bidPreview != null} onOpenPreview={() => bidPreview?.openBidPreviewFromBid(bid)} h2Style={{ margin: 0, fontSize: '1.15rem' }} />
            {/* v2.4067: the same "?" Pricing has beside its title — here it starts the walkthrough. */}
            <button
              type="button"
              onClick={() => startWalkThrough()}
              title="How this page works. Walk me through it"
              aria-label="How this page works"
              style={{ font: 'inherit', flexShrink: 0, width: 20, height: 20, borderRadius: '50%', border: '1.5px solid #3b82f6', color: 'var(--text-blue-500)', background: 'var(--surface)', fontSize: '0.72rem', fontWeight: 700, lineHeight: 1, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
            >
              ?
            </button>
          </div>
          <p style={{ margin: '0.2rem 0 0', ...smallMuted }} data-tour="submittals-source">
            Submittals · plumbing fixtures &amp; equipment · {takeoffFixtures > 0 ? <>{takeoffFixtures} fixture{takeoffFixtures === 1 ? '' : 's'} on the takeoff · </> : null}{specified.length === 0 ? 'no schedule yet' : `${specified.length} tag${specified.length === 1 ? '' : 's'} on the schedule`}{picks.length > 0 ? <> · {picks.length} picked line{picks.length === 1 ? '' : 's'}</> : null}
            {takeoffFixtures > 0 && specified.length === 0 && picks.length === 0 ? (
              <>
                {' · '}
                <button type="button" onClick={openTakeoffPicker} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--text-link)', textDecoration: 'underline', cursor: 'pointer' }}>
                  choose from the takeoff
                </button>
              </>
            ) : onOpenPricing ? (
              <>
                {' · '}
                <button type="button" onClick={() => (specified.length === 0 ? setPlugInOpen(true) : onOpenPricing(bid))} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--text-link)', textDecoration: 'underline', cursor: 'pointer' }}>
                  {specified.length === 0 ? 'type or paste the fixture schedule' : 'the picks on Pricing'}
                </button>
              </>
            ) : null}
          </p>
          {selectedRev ? (
            <p style={{ margin: '0.2rem 0 0', ...smallMuted }} data-testid="revision-line">
              Working on <b style={{ color: 'var(--text-strong)' }}>{describeRevisionChip(selectedRev)}</b> · {describeRevision(tiles)}
              {previousRev && isNewest && isDraft ? ` · started from Rev ${previousRev.rev_number}` : ''}
              {selectedRev.package_path ? <span style={{ color: 'var(--text-green-700)', fontWeight: 600 }}> · package built</span> : null}
              {!isNewest ? <span style={{ color: 'var(--text-amber-700)', fontWeight: 600 }}> · an older revision, the record; the newest is where the work is</span> : null}
            </p>
          ) : null}
        </div>
        {!narrowViewport640 ? (
          <button type="button" onClick={onClose} title="Close" aria-label="Close" style={bidDetailCloseXStyle}>
            ×
          </button>
        ) : null}
      </div>

      {loading ? <p style={smallMuted}>Loading…</p> : null}

      {!loading ? (
        <SubmittalJourneyStrip
          journey={journey}
          busy={busy}
          onAction={runJourneyAction}
          onGoToStage={goToStage}
          onWalkThrough={() => startWalkThrough()}
          onSeeGc={selectedRev && isNewest ? () => setSeeGcOpen((v) => !v) : undefined}
          seeGcOpen={seeGcOpen}
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
        <div className="submittal-road" data-testid="submittal-road" style={{ display: 'grid', gridTemplateColumns: '34px 1fr', columnGap: '0.6rem' }}>
          {/* 1 · Sources (Where the rows come from) — the source line is in the header; the robot's offer lives here while there is no schedule. */}
          <RoadSection n={1} about={SUBMITTAL_STAGE_ABOUT[1]} onHelp={() => startWalkThrough(1)} title="Where the rows come from" status={stageStatus('picks')} open={sectionOpen('picks')} onToggle={() => toggleSection('picks')} onJump={() => jumpToSection('picks')} anchor="submittals-schedule"
            summary={<>{takeoffFixtures > 0 ? <>{takeoffFixtures} on the takeoff · </> : null}{specified.length === 0 ? 'no schedule yet' : `${specified.length} tag${specified.length === 1 ? '' : 's'}`}{picks.length > 0 ? <> · {picks.length} picked line{picks.length === 1 ? '' : 's'}</> : null}{takeoffFixtures > 0 && specified.length === 0 && picks.length === 0 ? <> · <button type="button" onClick={openTakeoffPicker} style={{ ...btnQuiet, textDecoration: 'underline', fontSize: 'inherit' }}>choose from the takeoff</button></> : onOpenPricing ? <> · <button type="button" onClick={() => (specified.length === 0 ? setPlugInOpen(true) : onOpenPricing(bid))} style={{ ...btnQuiet, textDecoration: 'underline', fontSize: 'inherit' }}>{specified.length === 0 ? 'type or paste the fixture schedule' : 'the picks on Pricing'}</button></> : null}</>}>
            {/* v2.4107 · three sources, the takeoff first: a bid priced from a takeoff has no picks and often no schedule, yet the takeoff already names every product. */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.6rem', maxWidth: 900 }} data-testid="submittal-sources">
              <div style={{ border: `1px solid ${takeoffFixtures > 0 && specified.length === 0 && picks.length === 0 ? '#2563eb' : 'var(--border)'}`, borderRadius: 8, padding: '0.6rem 0.75rem', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }} data-testid="source-takeoff">
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)' }}>The takeoff <span style={{ ...smallMuted, fontWeight: 400 }}>· {takeoffFixtures === 0 ? 'none on this bid' : `${takeoffFixtures} fixture${takeoffFixtures === 1 ? '' : 's'}, ${takeoff?.withProduct ?? 0} with a part`}</span></div>
                <span style={smallMuted}>{takeoffFixtures === 0 ? 'Count the fixtures on Takeoffs and they show here.' : 'One row per fixture you tick. The part under it is the product.'}</span>
                <button type="button" disabled={busy || takeoffFixtures === 0} onClick={openTakeoffPicker} style={{ ...(takeoffFixtures > 0 && specified.length === 0 && picks.length === 0 ? btnPrimary : btn), alignSelf: 'flex-start', opacity: takeoffFixtures === 0 ? 0.5 : 1 }} title="Tick the fixtures you counted. Each one becomes a row, with its part as the product" data-testid="choose-from-takeoff" data-tour="submittals-takeoff">
                  {revisions.length === 0 ? 'Choose from the takeoff' : 'Add from the takeoff'}
                </button>
              </div>
              {picks.length > 0 ? (
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }} data-testid="source-picks">
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)' }}>Quotes compared <span style={{ ...smallMuted, fontWeight: 400 }}>· {picks.length} picked line{picks.length === 1 ? '' : 's'}</span></div>
                  <span style={smallMuted}>The house you picked for each line on Pricing, with the reason and lead time you gave.</span>
                  {onOpenPricing ? <button type="button" disabled={busy} onClick={() => onOpenPricing(bid)} style={{ ...btn, alignSelf: 'flex-start' }}>Open the compare</button> : null}
                </div>
              ) : null}
              {(() => {
                // v2.4109 · the robot lives in the schedule card: the offer under the typed door, the state while it works, Cancel beside it.
                // v2.4144 · the state row is two lines, not three: the sentence, then the task line with Cancel/Dismiss at its right.
                const t = liveTask(tasks, 'read_schedule')
                const st = t ? taskStatus(t) : null
                const conf = t ? scheduleToConfirm(t) : null
                return (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }} data-testid="source-schedule">
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)' }}>The plans’ schedule <span style={{ ...smallMuted, fontWeight: 400 }}>· {specified.length === 0 ? 'none yet' : `${specified.length} tag${specified.length === 1 ? '' : 's'}`}</span></div>
                    <span style={smallMuted}>{specified.length === 0 ? 'Optional. A tag is the plan’s name for a fixture, like WC-1. With the schedule, the app checks each row against the plans.' : 'Every tag here becomes a row. A row with no pick gets its product typed with Edit.'}</span>
                    {t ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', background: 'var(--bg-muted)', borderRadius: 6, padding: '0.3rem 0.55rem', fontSize: '0.8rem' }} data-testid="robot-schedule" data-tour="submittals-robot">
                        <span style={{ color: 'var(--text-strong)' }}>
                          {st === 'ready' ? (conf ? 'The robot read the schedule. Confirm the tags below.' : 'The robot read the schedule and found no tags.') : st === 'blocked' ? (t.summary || 'The robot could not read the plans.') : st === 'working' ? 'The robot is reading the fixture schedule off the plans.' : 'The robot is queued to read the fixture schedule off the plans.'}
                        </span>
                        <span style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'baseline' }}>
                          <span style={{ ...smallMuted, fontStyle: 'italic' }} data-testid="robot-line">{describeTask(t)}</span>
                          {st === 'blocked' || st === 'queued' ? (
                            <button type="button" disabled={busy} onClick={() => void markTask(t.id, 'cancelled').then(() => loadTasks(bidId as string))} style={{ ...btnQuiet, textDecoration: 'underline', fontSize: '0.78rem', flexShrink: 0 }}>{st === 'blocked' ? 'Dismiss' : 'Cancel'}</button>
                          ) : null}
                        </span>
                      </div>
                    ) : null}
                    <button type="button" disabled={busy} onClick={() => setPlugInOpen(true)} style={{ ...(specified.length === 0 && takeoffFixtures === 0 ? btnPrimary : btn), alignSelf: 'flex-start' }} title="Type or paste the tags from the plans, one per line" data-testid="plug-in-schedule" data-tour="submittals-plug-in">
                      {specified.length === 0 ? 'Type or paste the schedule' : 'Add to the schedule'}
                    </button>
                    {!t && specified.length === 0 ? <RobotOffer kind="read_schedule" seat={robotSeat} hasPlans={Boolean(selectedBid?.plans_link)} busy={busy} onAsk={() => void askRobot('read_schedule', {}, null)} testId="ask-robot-schedule" tour="submittals-robot" /> : null}
                  </div>
                )
              })()}
            </div>
        {!loading ? (() => {
          // 6b · the schedule read, ready: the tags to confirm, under the cards at full width
          const t = liveTask(tasks, 'read_schedule')
          const conf = t ? scheduleToConfirm(t) : null
          if (!t || !conf) return null
          const n = conf.sure.length + conf.look.length
          return (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '0.6rem 0.9rem', display: 'flex', flexDirection: 'column', gap: '0.45rem', maxWidth: 900, marginTop: '0.6rem' }} data-testid="robot-schedule-confirm">
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-strong)' }}>The robot read {n} tag{n === 1 ? '' : 's'} off the plans <span style={{ ...smallMuted, fontWeight: 400 }}>· confirm them and they join the schedule; the rest are dropped</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.2rem 0.6rem', fontSize: '0.8125rem', alignItems: 'baseline' }}>
                {conf.sure.map((r) => (
                  <Fragment key={r.tag}><span style={{ color: 'var(--text-green-700)', fontWeight: 600 }}>{r.tag} ✓</span><span>{[r.manufacturer, r.model].filter(Boolean).join(' ') || r.description || r.fixture || '—'}{r.fixture ? <span style={smallMuted}> · {r.fixture}</span> : null}</span></Fragment>
                ))}
                {conf.look.map((r) => (
                  <Fragment key={r.tag}>
                    <label style={{ color: 'var(--text-amber-700)', fontWeight: 600, display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                      <input type="checkbox" aria-label={`Keep ${r.tag}`} checked={!!lookChecked[r.tag]} onChange={(e) => setLookChecked((m) => ({ ...m, [r.tag]: e.target.checked }))} /> {r.tag} ?
                    </label>
                    <span>{[r.manufacturer, r.model].filter(Boolean).join(' ') || r.description || r.fixture || '—'}{r.fixture ? <span style={smallMuted}> · {r.fixture}</span> : null}<span style={smallMuted}> · want a look</span></span>
                  </Fragment>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="button" disabled={busy} onClick={() => void confirmSchedule(t, [...conf.sure.map((r) => r.tag), ...conf.look.filter((r) => lookChecked[r.tag]).map((r) => r.tag)])} style={btnGreen} data-testid="confirm-schedule">
                  {confirmLabel(conf.sure.length + conf.look.filter((r) => lookChecked[r.tag]).length, conf.look.filter((r) => !lookChecked[r.tag]).length, 'leave') || 'Confirm'}
                </button>
                <button type="button" disabled={busy} onClick={() => void confirmSchedule(t, [])} style={{ ...btn, color: 'var(--text-muted)' }}>Discard the robot's rows</button>
                <span style={smallMuted}>Confirmed tags join the schedule; the rest are dropped.</span>
              </div>
            </div>
          )
        })() : null}
          </RoadSection>

          {/* 2 · Build Rev 1 / the revision */}
          <RoadSection n={2} about={SUBMITTAL_STAGE_ABOUT[2]} onHelp={() => startWalkThrough(2)} title={revisions.length === 0 ? 'Build Rev 1' : `Rev ${selectedRev?.rev_number ?? newestRev?.rev_number ?? 1}`} status={stageStatus('build')} open={sectionOpen('build')} onToggle={() => toggleSection('build')} onJump={() => jumpToSection('build')} anchor="submittals-build"
            summary={selectedRev ? (
              <span style={{ display: 'inline-flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }} data-tour="submittals-revisions">
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }} data-testid="revision-strip" data-tour="submittals-revisions">
                  {revisions.map((r) => {
                    const on = r.id === selectedRev.id
                    return (
                      <button key={r.id} type="button" data-testid="revision-chip" aria-pressed={on} onClick={() => setSelectedRevId(r.id)} style={{ ...btn, padding: '0.25rem 0.65rem', borderRadius: 999, fontSize: '0.75rem', background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', borderColor: on ? '#2563eb' : 'var(--border-strong)', color: on ? 'var(--text-blue-700)' : 'var(--text-muted)', fontWeight: on ? 700 : 500 }}>
                        {describeRevisionChip(r)}
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
                summary={<span data-testid="submittal-tiles" data-tour="submittals-tiles" title={describeRevision(tiles)}>{describeWhatIsLeft(tiles)}</span>}>
                <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflowX: 'auto', background: 'var(--surface)' }} data-tour="submittals-rows">
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                    <thead>
                      <tr>
                        <th style={th}>Tag</th>
                        <th style={th}>Specified</th>
                        <th style={th}>Submitted</th>
                        <th style={th} title={COLUMN_HELP.status}>Status <span aria-hidden style={{ color: 'var(--text-faint)', fontWeight: 400 }}>?</span></th>
                        <th style={th} title={COLUMN_HELP.reason}>Reason <span aria-hidden style={{ color: 'var(--text-faint)', fontWeight: 400 }}>?</span></th>
                        <th style={th}>Lead time</th>
                        <th style={th} title={COLUMN_HELP.sheet}>Sheet <span aria-hidden style={{ color: 'var(--text-faint)', fontWeight: 400 }}>?</span></th>
                        {previousRev ? <th style={th}>Since Rev {previousRev.rev_number}</th> : null}
                        {decisions.decided > 0 || parts.some((p) => p.review_decision) ? <th style={th}>Their call</th> : null}
                        <th style={th} />
                      </tr>
                    </thead>
                    <tbody data-testid="submittal-rows">
                      {items.length === 0 ? (
                        <tr>
                          <td style={td} colSpan={9}>
                            <span style={smallMuted}>No rows on this revision.</span>
                          </td>
                        </tr>
                      ) : null}
                      {items.map((it) => {
                        const status = asStatus(it.status)
                        const reason = asReason(it.reason_kind)
                        const lead = describeLeadTime(it.lead_time_days)
                        const file = it.sheet_file != null ? sourceFiles[it.sheet_file] ?? null : null
                        const prev = it.carried_from_item_id ? prevById.get(it.carried_from_item_id) ?? null : null
                        const note = previousRev ? changeNoteFor(prev ? itemToPrevious(prev) : null, { submittedModel: it.submitted_model, submittedLabel: it.submitted_label, status, reasonKind: reason }) : null
                        const specText = [it.specified_manufacturer, it.specified_model].filter(Boolean).join(' ')
                        return (
                          <tr key={it.id} data-testid="submittal-row" style={{ background: status === 'design_change' ? 'var(--bg-red-tint)' : undefined }}>
                            <td style={{ ...td, fontWeight: 700, color: it.tag.trim() ? 'var(--text-strong)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{it.tag.trim() || '—'}</td>
                            <td style={td}>
                              {specText || (it.tag.trim() ? '—' : <span style={smallMuted}>not on the schedule</span>)}
                              {it.specified_description ? <span style={sub}>{it.specified_description}</span> : null}
                            </td>
                            <td style={td}>
                              {(partsOf.get(it.id) ?? []).length > 0 ? (
                                <SubmittalPartsCell parts={partsOf.get(it.id) ?? []} houseNameById={houseNameById} />
                              ) : (
                                <>
                                  {it.submitted_label ?? it.submitted_model ?? <span style={{ color: 'var(--text-faint)' }}>—</span>}
                                  {it.submitted_label && it.submitted_model && it.submitted_label !== it.submitted_model ? <span style={sub}>{it.submitted_model}</span> : null}
                                  {it.supply_house_id && houseNameById.get(it.supply_house_id) ? <span style={sub} data-testid="row-house">{houseNameById.get(it.supply_house_id)}</span> : null}
                                </>
                              )}
                            </td>
                            <td style={td}>
                              <ProductStatusChip status={status} size="md" />
                            </td>
                            <td style={td}>
                              {reason ? REASON_LABELS[reason] : needsReason(status) ? <span style={{ color: 'var(--text-amber-700)', fontWeight: 600 }}>say why</span> : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                              {it.reason_note ? <span style={sub}>{it.reason_note}</span> : null}
                            </td>
                            <td style={{ ...td, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{lead ?? <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
                            <td style={td}>
                              {file && (it.sheet_pages ?? []).length > 0 ? (
                                <span style={{ color: 'var(--text-green-700)', fontWeight: 600 }}>
                                  ✓ {formatPages(it.sheet_pages)}
                                  <span style={sub}>{file.name}</span>
                                </span>
                              ) : needsSheet(it) ? (
                                <span style={{ color: 'var(--text-amber-700)', fontWeight: 600 }}>sheet needed</span>
                              ) : (
                                <span style={{ color: 'var(--text-faint)' }}>—</span>
                              )}
                            </td>
                            {previousRev ? <td style={{ ...td, color: note ? 'var(--text-amber-700)' : 'var(--text-faint)', fontWeight: note ? 600 : 400 }}>{note ?? 'carried'}</td> : null}
                            {decisions.decided > 0 || parts.some((p) => p.review_decision) ? (
                              <td style={td} data-testid="their-call">
                                {(() => {
                                  const d = asDecision(it.review_decision)
                                  const byPart = partCallsLine(partsOf.get(it.id) ?? [])
                                  if (!d) return byPart ? <span style={{ color: 'var(--text-muted)', fontWeight: 600 }} data-testid="their-call-parts">{byPart}</span> : <span style={{ color: 'var(--text-faint)' }}>—</span>
                                  const color = d === 'approved' ? 'var(--text-green-700)' : d === 'revise' ? 'var(--text-amber-700)' : 'var(--text-red-700)'
                                  return (
                                    <span style={{ color, fontWeight: 600 }}>
                                      {DECISION_LABELS[d]}
                                      {byPart ? <span style={sub} data-testid="their-call-parts">{byPart}</span> : null}
                                      <span style={sub}>{[it.reviewed_by_name, enteredSuffix(it), formatShortDate(it.reviewed_at)].filter(Boolean).join(' · ')}</span>
                                      {it.review_note ? <span style={sub}>“{it.review_note}”</span> : null}
                                    </span>
                                  )
                                })()}
                              </td>
                            ) : null}
                            <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <button type="button" aria-label={`Edit ${it.tag.trim() || 'accessory'}`} onClick={() => setEditing(it)} style={{ ...btn, padding: '0.2rem 0.55rem', fontSize: '0.75rem' }}>
                                Edit
                              </button>
                              {isDraft && rowSplitTags(it.tag).length > 1 ? (
                                <button type="button" aria-label={`Split ${it.tag.trim()}`} disabled={busy} onClick={() => void splitRow(it)} title={`One row per tag: ${rowSplitTags(it.tag).join(', ')}`} style={{ ...btn, padding: '0.2rem 0.55rem', fontSize: '0.75rem', marginLeft: '0.3rem', borderColor: '#2563eb', color: 'var(--text-blue-700)' }} data-testid="split-row">
                                  Split
                                </button>
                              ) : null}
                              {isDraft ? (
                                <button type="button" aria-label={`Remove ${it.tag.trim() || 'accessory'}`} disabled={busy} onClick={() => void removeRow(it)} title={it.source_count_row_id ? 'Off this draft, and unticked on the takeoff list' : 'Off this draft'} style={{ ...btn, padding: '0.2rem 0.5rem', fontSize: '0.75rem', marginLeft: '0.3rem', color: 'var(--text-muted)' }}>
                                  ×
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
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
                  const r = describeForReviewer(items, asRevisionStatus(selectedRev.status) !== 'draft')
                  return (
                    <p style={{ margin: '0.45rem 0 0', fontSize: '0.8125rem', color: 'var(--text-base)', lineHeight: 1.45 }} data-testid="reviewer-line">
                      <b style={{ color: 'var(--text-strong)' }}>{r.lead}</b> {r.line} <span style={smallMuted}>{r.note}</span>
                    </p>
                  )
                })() : null}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.5rem' }}>
                  <button type="button" disabled={busy} onClick={() => fileInput.current?.click()} style={btn} title="Save the house's PDF on this version. Then put each page on its row" data-tour="submittals-drop">
                    Drop a vendor PDF
                  </button>
                  <span style={smallMuted}>A cut sheet is the maker’s page for a product. Drop the house’s whole PDF here, then put each page on its row.</span>
                  {isDraft && takeoffFixtures > 0 ? (
                    <button type="button" disabled={busy} onClick={openTakeoffPicker} style={{ ...btn, marginLeft: 'auto' }} title="Tick more fixtures from the takeoff onto this draft" data-testid="add-from-takeoff">
                      + Add from the takeoff…
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
                    items={items}
                    thumbnails={thumbs}
                    busy={busy}
                    onNeedThumbnails={(i) => void showPages(i)}
                    onAssign={(f, p, id) => void assignPageToItem(f, p, id)}
                    onUnassign={(f, p, id) => void unassignPageFromItem(f, p, id)}
                    onDone={(i) => void doneWithFile(i)}
                    onRemove={(i) => void removeFile(i)}
                    guesses={Object.fromEntries(sourceFiles.map((f, i) => { const t = liveTask(tasks, 'file_cut_sheets', (inp) => inp.file_index === i && (!inp.path || inp.path === f.path)); const g = t ? sheetGuessesToConfirm(t, f.pages) : null; return [i, g ? guessByPage(g) : new Map()] }))}
                    robotLines={Object.fromEntries(sourceFiles.map((f, i) => { const t = liveTask(tasks, 'file_cut_sheets', (inp) => inp.file_index === i && (!inp.path || inp.path === f.path)); return [i, t ? describeTask(t, f.pages) : ''] }))}
                    confirmLabels={Object.fromEntries(sourceFiles.map((f, i) => { const t = liveTask(tasks, 'file_cut_sheets', (inp) => inp.file_index === i && (!inp.path || inp.path === f.path)); const g = t ? sheetGuessesToConfirm(t, f.pages) : null; return [i, g ? confirmLabel(g.sure.length, g.unsure.length) : ''] }))}
                    robotSeat={robotSeat}
                    onAskRobot={(i) => void askRobot('file_cut_sheets', { file_index: i, path: sourceFiles[i]?.path, name: sourceFiles[i]?.name, pages: sourceFiles[i]?.pages }, selectedRev.id)}
                    onConfirmGuesses={(i) => void confirmGuesses(i)}
                    onAssignPages={(i) => setAssignFile(i)}
                    onReadParts={(i) => void readFileParts(i)}
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
                    <button type="button" disabled={busy || !gates.package.on} onClick={() => void buildPackage()} style={{ ...(selectedRev.package_path ? btn : btnPrimary), opacity: gates.package.on ? 1 : 0.5 }} data-testid="build-package"
 title="One PDF for the GC: the cover table, then every cut sheet stamped with its tag and status. Saved on this version and opened" data-tour="submittals-package">
                      {selectedRev.package_path ? 'Rebuild package' : 'Build package'}
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
                  <span style={smallMuted} data-testid="package-caption">{gates.package.on ? 'One PDF on our letterhead. The cover table first, then every cut sheet stamped with its tag and status.' : gates.package.why}</span>
                </div>
              </RoadSection>

              {/* 5 · Share — the room link and the people on it */}
              <RoadSection n={5} about={SUBMITTAL_STAGE_ABOUT[5]} onHelp={() => startWalkThrough(5)} title="Share" status={stageStatus('share')} open={sectionOpen('share')} onToggle={() => toggleSection('share')} onJump={() => jumpToSection('share')} anchor="submittals-share-section"
                summary={room ? describeRoomLine(room, events.filter((e) => e.event_type === 'view').length, ROOM_TZ) : items.length > 0 ? 'not shared yet' : 'appears once Rev 1 has rows'}>
                {items.length > 0 && isNewest ? (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: room ? '0.5rem' : 0 }}>
                    <button type="button" disabled={busy || room?.status === 'closed' || !gates.share.on} onClick={() => setSharing(true)} style={{ ...(asRevisionStatus(selectedRev.status) === 'shared' ? btn : btnPrimary), opacity: gates.share.on ? 1 : 0.5 }} data-testid="share-button" title={room ? 'Mark this revision shared; the room link shows it' : 'Mint the bid\'s review room and copy its link'} data-tour="submittals-share">
                      {asRevisionStatus(selectedRev.status) === 'shared' ? 'Shared · share again' : 'Share'}
                    </button>
                    <span style={smallMuted} data-testid="share-caption">{!gates.share.on ? gates.share.why : room ? 'The same link shows every later version.' : 'Makes the link for the GC and copies it. Paste it into your email.'}</span>
                  </div>
                ) : null}
                {room ? (
                  <div style={{ border: '1px solid var(--border-blue)', background: room.status === 'closed' ? 'var(--bg-muted)' : 'var(--bg-blue-tint)', borderRadius: 8, padding: '0.55rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }} data-testid="room-line" data-tour="submittals-room">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)' }}>{describeRoomLine(room, events.filter((e) => e.event_type === 'view').length, ROOM_TZ)}</span>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {room.status === 'open' ? (
                          <>
                            <button type="button" onClick={() => void navigator.clipboard.writeText(roomLink(window.location.origin, room.token)).then(() => showToast('Link copied.', 'success'), () => showToast(roomLink(window.location.origin, room.token), 'info'))} style={{ ...btn, padding: '0.2rem 0.55rem', fontSize: '0.75rem' }}>
                              Copy link
                            </button>
                            <button type="button" onClick={() => void closeRoom()} style={{ ...btn, padding: '0.2rem 0.55rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Close the room
                            </button>
                          </>
                        ) : (
                          <button type="button" onClick={() => void reopenRoom()} style={{ ...btn, padding: '0.2rem 0.55rem', fontSize: '0.75rem' }}>
                            Reopen
                          </button>
                        )}
                      </div>
                    </div>
                    {people.filter((p) => !p.closed_at).length > 0 || anonymousOpens(events) > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: '0.3rem 0.75rem', alignItems: 'center', fontSize: '0.78rem' }} data-testid="room-people">
                        {people.filter((p) => !p.closed_at).map((p) => {
                          const t = personTrail(p.id, events, items.filter((it) => it.reviewed_by_person_id === p.id).length)
                          return (
                            <div key={p.id} style={{ display: 'contents' }}>
                              <span><b style={{ color: 'var(--text-strong)' }}>{p.name}</b> <span style={smallMuted}>· {ROOM_ROLE_LABELS[asRoomRole(p.role)]}</span></span>
                              <span style={smallMuted}>{describeHow(asPersonHow(p.how))} · {describeTrail(t, ROOM_TZ)}</span>
                              <span style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden', fontSize: '0.7rem' }} role="group" aria-label={`${p.name} may`}>
                                <button type="button" aria-pressed={p.may_decide} onClick={() => void setMayDecide(p.id, true)} style={{ padding: '0.15rem 0.5rem', border: 'none', cursor: 'pointer', font: 'inherit', background: p.may_decide ? '#16a34a' : 'var(--surface)', color: p.may_decide ? 'white' : 'var(--text-muted)', fontWeight: p.may_decide ? 700 : 500 }}>deciding</button>
                                <button type="button" aria-pressed={!p.may_decide} onClick={() => void setMayDecide(p.id, false)} style={{ padding: '0.15rem 0.5rem', border: 'none', cursor: 'pointer', font: 'inherit', background: !p.may_decide ? 'var(--text-strong)' : 'var(--surface)', color: !p.may_decide ? 'white' : 'var(--text-muted)', fontWeight: !p.may_decide ? 700 : 500 }}>watching</button>
                              </span>
                              <span style={{ display: 'flex', gap: '0.3rem' }}>
                                {p.token ? (
                                  <button type="button" onClick={() => void navigator.clipboard.writeText(roomLink(window.location.origin, p.token as string)).then(() => showToast('Personal link copied.', 'success'), () => showToast(roomLink(window.location.origin, p.token as string), 'info'))} style={{ ...btn, padding: '0.1rem 0.45rem', fontSize: '0.7rem' }}>
                                    Personal link
                                  </button>
                                ) : null}
                                <button type="button" aria-label={`Close ${p.name}'s link`} onClick={() => void closePerson(p.id)} style={{ ...btn, padding: '0.1rem 0.45rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  ×
                                </button>
                              </span>
                            </div>
                          )
                        })}
                        {anonymousOpens(events) > 0 ? (
                          <div style={{ display: 'contents' }}>
                            <span style={smallMuted}>+ {anonymousOpens(events)} open{anonymousOpens(events) === 1 ? '' : 's'}</span>
                            <span style={smallMuted}>by people who did not say who they were</span>
                            <span />
                            <span />
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <span style={smallMuted}>Nobody has identified themselves yet. Anyone with the link can read; deciding or asking asks who they are.</span>
                    )}
                  </div>
                ) : null}
              </RoadSection>

              {/* 6 · Their call — decisions, the reviewer's own files, the thread */}
              <RoadSection n={6} about={SUBMITTAL_STAGE_ABOUT[6]} onHelp={() => startWalkThrough(6)} title={<>Their call{decisions.decided > 0 || reviewerFiles.length > 0 ? <span style={{ ...smallMuted, fontWeight: 400 }}> on Rev {selectedRev.rev_number}</span> : null}</>} status={stageStatus('review')} open={sectionOpen('review')} onToggle={() => toggleSection('review')} onJump={() => jumpToSection('review')} anchor="submittals-review"
                summary={decisions.decided > 0 ? `${describeDecisions(decisions)}${decisions.open > 0 ? ` · ${decisions.open} still open` : ''}` : room ? (room.status === 'closed' ? 'link closed' : 'no answers yet') : 'appears after you share'}>
                {decisions.decided > 0 ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-subtle)', padding: '0.4rem 0.7rem' }} data-testid="decisions-line">
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-strong)' }}>
                      <b>Their call:</b> {describeDecisions(decisions)}
                      {decisions.open > 0 ? <span style={smallMuted}> · {decisions.open} still open</span> : null}
                    </span>
                    <button type="button" onClick={() => void navigator.clipboard.writeText(decisionsAsText(items, `${describeRevisionChip(selectedRev)} · ${bidWorkflowTabHeading(bid, prefixMap)}`, ROOM_TZ)).then(() => showToast('Decisions copied as text.', 'success'), () => showToast('Could not copy.', 'error'))} style={{ ...btn, padding: '0.2rem 0.55rem', fontSize: '0.75rem' }}>
                      Copy their decisions as text
                    </button>
                  </div>
                ) : null}
                {isNewest && approvableRows.length > 0 ? (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', margin: '0.5rem 0' }}>
                    <button type="button" disabled={busy} onClick={() => setApprovingAll(true)} style={btn} data-testid="approve-all-open" title="They said yes to all of it by email, on paper or before the room existed. One entry marks every row with no call yet.">
                      They approved all of it…
                    </button>
                    <span style={smallMuted}>One entry for a submittal approved whole. You say who approved it and on what day.</span>
                  </div>
                ) : null}
                {asRevisionStatus(selectedRev.status) !== 'draft' || reviewerFiles.length > 0 ? (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', margin: '0.5rem 0' }}>
                    <button type="button" disabled={busy} onClick={() => reviewerInput.current?.click()} style={btn} title="The architect marked up the PDF or answered by email. Keep their file here and type their answers onto the rows">
                      Drop a reviewer's file
                    </button>
                    <span style={smallMuted}>A marked-up PDF or an email instead of the room; type their calls onto the rows with Edit.</span>
                  </div>
                ) : null}
                {reviewerFiles.length > 0 ? (
                  <div style={{ border: '1px solid var(--border-blue)', background: 'var(--bg-blue-tint)', borderRadius: 6, padding: '0.6rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }} data-testid="reviewer-files">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)' }}>The reviewer's own files</span>
                      <span style={smallMuted}>{describeEnteredCount(decisions.entered) || 'type their calls onto the rows with Edit — the record reads entered by you'}</span>
                    </div>
                    {reviewerFiles.map((f, i) => {
                      const t = liveTask(tasks, 'read_redlines', (inp) => inp.reviewer_index === i && (!inp.path || inp.path === f.path))
                      const r = t ? redlinesToConfirm(t) : null
                      const st = t ? taskStatus(t) : null
                      return (
                        <div key={f.path} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem' }}>
                            <span><b style={{ color: 'var(--text-strong)' }}>{f.name}</b> <span style={smallMuted}>· {describeReviewerFile(f, ROOM_TZ)}</span></span>
                            <span style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                              {f.kind === 'redline' && !t ? <RobotOffer kind="read_redlines" seat={robotSeat} busy={busy} onAsk={() => void askRobot('read_redlines', { reviewer_index: i, path: f.path, name: f.name, person_id: f.personId, person_name: f.personName }, selectedRev.id)} testId="ask-robot-redlines" /> : null}
                              <button type="button" disabled={busy} onClick={() => void openReviewerFile(f)} style={{ ...btn, padding: '0.2rem 0.55rem', fontSize: '0.75rem' }}>Open the file</button>
                              <button type="button" disabled={busy} onClick={() => void removeReviewerFile(i)} style={{ ...btn, padding: '0.2rem 0.55rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Remove this file</button>
                            </span>
                          </div>
                          {t ? (
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                              <span style={{ ...smallMuted, fontStyle: 'italic' }} data-testid="robot-line">{describeTask(t)}</span>
                              {st === 'blocked' || st === 'queued' ? <button type="button" disabled={busy} onClick={() => void markTask(t.id, 'cancelled').then(() => loadTasks(bidId as string))} style={{ ...btn, padding: '0.2rem 0.55rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{st === 'blocked' ? 'Dismiss' : 'Cancel'}</button> : null}
                            </div>
                          ) : null}
                          {r ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingLeft: '0.5rem', borderLeft: '3px solid var(--border-strong)' }} data-testid="robot-redlines">
                              {[...r.sure, ...r.unsure].map((a, k) => (
                                <span key={k} style={{ fontSize: '0.8125rem' }}>
                                  <b style={{ color: a.proposed === 'approved' ? 'var(--text-green-700)' : a.proposed === 'revise' ? 'var(--text-amber-700)' : 'var(--text-red-700)' }}>{a.tag}{a.confidence < 0.7 ? ' ?' : ''}</b> · {DECISION_LABELS[a.proposed as 'approved' | 'revise' | 'rejected']}{a.text ? <span style={smallMuted}> · “{a.text}”</span> : null}{a.page ? <span style={smallMuted}> · p.{a.page}</span> : null}
                                </span>
                              ))}
                              {r.questions.map((q, k) => (
                                <span key={`q${k}`} style={{ fontSize: '0.8125rem' }}><b style={{ color: 'var(--text-muted)' }}>{q.tag ?? 'no tag'}</b> · a question for the thread<span style={smallMuted}> · “{q.text}”</span></span>
                              ))}
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                                <button type="button" disabled={busy} onClick={() => void confirmRedlines(t as SubmittalTaskRow, false)} style={btnGreen} data-testid="confirm-redlines">{confirmLabel(r.sure.length, r.unsure.length, 'settle') || 'Confirm'}</button>
                                {r.unsure.length ? <button type="button" disabled={busy} onClick={() => void confirmRedlines(t as SubmittalTaskRow, true)} style={btn}>Take the unsure ones too</button> : null}
                                <span style={smallMuted}>Each lands as read from {f.personName ?? 'the reviewer'}'s file, confirmed by you; the questions post to the thread.</span>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                    <span style={smallMuted}>Nothing about these files shows on the room.</span>
                  </div>
                ) : null}
                {room ? (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }} data-testid="room-thread-panel">
                    <button type="button" aria-expanded={threadOpen} onClick={() => setThreadOpen((o) => !o)} style={{ ...btnQuiet, display: 'flex', justifyContent: 'space-between', width: '100%', textAlign: 'left', padding: 0 }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)' }}>Thread</span>
                      <span style={smallMuted}>{summarizeThread(messages, ROOM_TZ)} {threadOpen ? '▴' : '▾'}</span>
                    </button>
                    {threadOpen ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }} data-testid="room-thread-entries">
                        {messages.length === 0 ? <span style={smallMuted}>Nothing asked yet. Questions from the room land here and on the inbox.</span> : null}
                        {messages.map((m) => {
                          const d = describeThreadEntry(m, ROOM_TZ)
                          const askable = m.authorKind === 'reviewer' || m.authorKind === 'watcher'
                          return (
                            <div key={m.id} data-thread-kind={m.kind} style={{ fontSize: '0.8125rem', borderLeft: `3px solid ${m.authorKind === 'office' ? '#b0662f' : d.quiet ? 'var(--border)' : 'var(--border-strong)'}`, paddingLeft: 8, color: d.quiet ? 'var(--text-muted)' : 'var(--text-strong)' }}>
                              <div style={{ ...smallMuted, display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <span>{d.who ? <b>{d.who}</b> : null}{d.who && d.when ? ' · ' : ''}{d.when}{m.tags.length ? ` · ${m.tags.join(', ')}` : ''}{m.revNumber ? ` · Rev ${m.revNumber}` : ''}</span>
                                {askable && room.status === 'open' ? (
                                  <button type="button" onClick={() => { setReplyTo(m.id); setReplyBody('') }} style={{ ...btnQuiet, padding: 0, fontSize: '0.72rem', textDecoration: 'underline dotted' }}>
                                    Reply
                                  </button>
                                ) : null}
                              </div>
                              <div style={{ whiteSpace: 'pre-wrap', fontStyle: d.quiet ? 'italic' : 'normal' }}>{m.body}</div>
                              {replyTo === m.id ? (
                                <div style={{ marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }} data-testid="room-thread-reply">
                                  <textarea aria-label="Your answer" value={replyBody} onChange={(e) => setReplyBody(e.target.value)} rows={3} placeholder="The answer — the room shows it as the company; they get it by email with their own link" style={{ padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, font: 'inherit', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text-strong)', resize: 'vertical' }} />
                                  <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                                    <button type="button" style={btn} disabled={replying} onClick={() => { setReplyTo(null); setReplyBody('') }}>Cancel</button>
                                    <button type="button" style={{ ...btn, background: '#b0662f', color: 'white', borderColor: 'transparent' }} disabled={replying || !replyBody.trim()} onClick={() => void sendReply()}>
                                      {replying ? 'Sending…' : 'Send the answer'}
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </RoadSection>

              {/* 7 · Resubmit */}
              <RoadSection n={7} about={SUBMITTAL_STAGE_ABOUT[7]} onHelp={() => startWalkThrough(7)} title="Resubmit" status={stageStatus('resubmit')} open={sectionOpen('resubmit')} onToggle={() => toggleSection('resubmit')} onJump={() => jumpToSection('resubmit')} anchor="submittals-resubmit-section"
                summary={isNewest && decisions.sentBack > 0 ? `${decisions.sentBack} row${decisions.sentBack === 1 ? '' : 's'} sent back — start Rev ${selectedRev.rev_number + 1} with just ${decisions.sentBack === 1 ? 'that row' : 'those rows'}` : previousRev ? `Rev ${selectedRev.rev_number} carries what Rev ${previousRev.rev_number} sent back` : 'nothing sent back'}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {isNewest && decisions.sentBack > 0 ? (
                    <button type="button" disabled={busy} onClick={() => void newRevision(true)} style={btnGreen} title="A new version with only the rows marked Revise or Reject" data-tour="submittals-resubmit">
                      Rev {selectedRev.rev_number + 1} from the {decisions.sentBack} row{decisions.sentBack === 1 ? '' : 's'} sent back
                    </button>
                  ) : null}
                  <button type="button" disabled={busy || !isNewest || !gates.resubmit.on} onClick={() => void newRevision()} style={{ ...(decisions.sentBack > 0 || !isNewest || !gates.resubmit.on ? btn : btnGreen), opacity: !isNewest || !gates.resubmit.on ? 0.5 : 1 }} data-testid="new-revision" title={isNewest ? 'Carry every row into a new draft and mark what changed' : 'Only the newest revision can be revised'} data-tour={isNewest && decisions.sentBack > 0 ? undefined : 'submittals-resubmit'}>
                    New revision
                  </button>
                  <span style={smallMuted} data-testid="resubmit-caption">{gates.resubmit.on ? 'Fix the rows, then share again. The GC’s link shows the new version.' : gates.resubmit.why}</span>
                </div>
              </RoadSection>
            </>
          ) : null}

              {/* 8 · Procure — a side track, always open (v2.4201) and drawn with or without a revision: long-lead items go in before a row is approved; never the Next stage until every row is approved */}
            <RoadSection n={8} about={SUBMITTAL_STAGE_ABOUT[8]} onHelp={() => startWalkThrough(8)} title="Procure" status={stageStatus('procure')} open={sectionOpen('procure')} onToggle={() => toggleSection('procure')} onJump={() => jumpToSection('procure')} anchor="submittals-procure-section" last always
              summary={procCounts ? `${procCounts.released} released · ${procCounts.ordered} ordered · ${procCounts.delivered} delivered${procCounts.late > 0 ? ` · ${procCounts.late} behind schedule` : ''}` : isNewest || !selectedRev ? 'fills in as the GC approves rows · long-lead items can go in now' : 'on the newest version'}>
              {isNewest && selectedRev && approvableRows.length > 0 ? (
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'baseline', margin: '0 0 0.5rem' }} data-testid="procure-approve-all">
                  <span style={smallMuted}>{approvableRows.length} {approvableRows.length === 1 ? 'row has' : 'rows have'} no call from the reviewer yet, so {approvableRows.length === 1 ? 'it is' : 'they are'} not released. Approved outside the app?</span>
                  <button type="button" disabled={busy} onClick={() => setApprovingAll(true)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', fontSize: '0.75rem', color: 'var(--text-blue-700)', textDecoration: 'underline', textUnderlineOffset: 2 }}>
                    Enter their approval…
                  </button>
                </div>
              ) : null}
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
                />
              ) : null}
            </RoadSection>
        </div>
      ) : null}

      {assignFile != null && sourceFiles[assignFile] ? (
        <SubmittalAssignPagesModal
          file={sourceFiles[assignFile]!}
          fileIndex={assignFile}
          items={items}
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
      {editing ? <SubmittalItemEditDialog item={editing} sourceFiles={sourceFiles} people={people} houses={houses} parts={partsOf.get(editing.id) ?? []} canEnterDecision canEditProduct={isDraft} onSave={(p) => void saveItem(p)} onClose={() => setEditing(null)} /> : null}
      {approvingAll && selectedRev ? (
        <SubmittalApproveAllDialog
          revLabel={`Rev ${selectedRev.rev_number}`}
          rows={approvableRows.length}
          alreadyDecided={decisions.decided}
          missing={items.filter((it) => !asDecision(it.review_decision) && asStatus(it.status) === 'missing').length}
          people={people}
          busy={busy}
          onSave={(c) => void approveAll(c)}
          onClose={() => setApprovingAll(false)}
        />
      ) : null}
      {splitRuleOpen ? <SplitRuleModal examples={splitExplanation(takeoffCandidatesForPicker)} onClose={() => setSplitRuleOpen(false)} /> : null}
      {takeoffPicker && takeoff ? (
        <SubmittalTakeoffPicker mode={takeoffPicker} revLabel={takeoffPicker === 'build' ? 'Rev 1' : `Rev ${selectedRev?.rev_number ?? newestRev?.rev_number ?? 1}`} candidates={takeoffCandidatesForPicker} busy={busy} onConfirm={(rows, ticks, splits, productKeys) => void confirmTakeoff(rows, ticks, splits, productKeys)} onClose={() => setTakeoffPicker(null)} />
      ) : null}
      {plugInOpen && bidId && selectedBid ? <PlugInScheduleModal open onClose={() => setPlugInOpen(false)} onSaved={() => { setPlugInOpen(false); void load(bidId) }} bidId={bidId} bidLabel={bidDisplayName(selectedBid) || 'Bid'} rows={[]} /> : null}
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
        shared={asRevisionStatus(selectedRev.status) !== 'draft'}
        hasPackage={Boolean(selectedRev.package_path)}
        company={{ name: companyName, tagline: reportSettings.companyTagline, phone: reportSettings.officePhone }}
        bid={{ label: bidDisplayName(selectedBid) || 'Bid', projectName: selectedBid.project_name ?? null, address: selectedBid.address ?? null }}
        narrow={narrowViewport640}
        onClose={() => setSeeGcOpen(false)}
      />
    ) : null}
    </div>
  )
}
