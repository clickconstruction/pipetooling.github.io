/**
 * Materials on site, the field's tab on the Job Parts Tally (punch list #209): the job's containers
 * as big cards, a search across the site, a container's lines with four presses each (Used,
 * Move to…, Can't find, Short), Count this box one line at a time, Add a part. Every press but
 * Short writes a movement row through the store; nothing types a number over another. Short
 * (v2.6742) files the Job Parts Tally's own request for more (`lib/materials/shortRequest.ts`). The rows live in
 * the on-site tables, read and written through `lib/materials/onSiteStore.ts`.
 *
 * Since punch list #304 the tab reaches past one job: the search has *This job · Every job* (the store's desk load,
 * `useOnSiteDeskJobs`, searched by `lib/materials/onSiteFind.ts`), a job with no box names the other jobs that hold
 * one, **Scan a label** takes a typed code, and a box's label and manifest print here, where they used to open the
 * office's page and send everyone outside the office away.
 *
 * Since v2.7298 (punch list #329, PR 3) a blank sticker's scan lands here with `&sticker=<code>` and opens the
 * **Sticker is new** sheet (`StickerNewSheet.tsx`); a box's row and its header say of its stickers what carries news
 * (`useJobStickers`), and a line under the boxes counts the job's stickers not yet on a box.
 * Since v2.7396 (section 10, PR 9) a sticker printed with the box's own name says nothing beside it, one printed
 * with another name reads *sticker reads G78*, and a scan of that one says so (`stickerMarksWords`). Since v2.7438 no
 * sticker's running number is shown anywhere.
 *
 * Since v2.7824 (Take from a box) a box's screen ends in **Take from G12**, a press that stays at the bottom: it opens
 * the camera for a photo of the box as found, then the run's screen asks what was taken (`TakeScreen`, over
 * `lib/materials/takeRun.ts`), and **Take 3 from G12** writes the rows and opens the camera for the photo after.
 */
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sheet } from './OnSiteSheet'
import StickerNewSheet from './StickerNewSheet'
import StickersOnBoxes from '../materials/StickersOnBoxes'
import { ON_BOXES_LABEL } from '../../lib/materials/stickersOnBoxes'
import { useJobStickers } from '../../hooks/useJobStickers'
import { notYetOnBoxLine, stickerMarksWords, stickerReadsOtherWords, type PlaceOutcome } from '../../lib/materials/stickerPlace'
import { LOST_STICKER_TITLE, OUT_OF_REACH_STICKER_TITLE, retiredBoxStickerTitle, retiredLabelTitle, type CodeLookup } from '../../lib/materials/stickers'
import { useToastContext } from '../../contexts/ToastContext'
import { useAddressGeocodeCoords } from '../../hooks/useAddressGeocodeCoords'
import { normalizeAddressForGeocodeKey } from '../../lib/map/normalizeAddressForGeocode'
import type { OnSiteMapPin } from '../materials/OnSiteMap'
import { requestMyLocation, type LatLng, type MyFix } from '../../lib/materials/myLocation'
import { taskPlaceSheetAccuracy } from '../../lib/tasks/taskPlace'
import { WHERE_IS_IT_PRESS, boxPinShort, whereIsBoxTitle } from '../../lib/materials/whereIsBox'
import WhereIsBox from '../materials/WhereIsBox'
import PinAskStrip from '../materials/PinAskStrip'
import { useChecklistAddModal } from '../../contexts/ChecklistAddModalContext'
import { PLACE_WAY_OPEN_PRESS, PLACE_WAY_PAINT_PRESS } from '../../lib/materials/placeWay'
import { openPlaceWay, paintPlaceWay } from '../materials/placeWayPaint'
import { boxWantsPin, takePinAsk, takeScannedBox } from '../../lib/materials/pinAsk'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import { useOnSiteJob } from '../../hooks/useOnSiteStore'
import { usePaintedMapsLayer } from '../../hooks/usePaintedMapsLayer'
import { openPaintedMap } from '../../lib/paintedMap/paintedMapDoor'
import { useOnSiteDeskJobs } from '../../hooks/useOnSiteDeskJobs'
import OfflineRetryPanel from '../OfflineRetryPanel'
import BoxPhotoRefileStrip from '../materials/BoxPhotoRefileStrip'
import { EmptyState } from '../EmptyState'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import { recoveryFailureFromError } from '../../lib/offlineRecoveryState'
import { phoneFlow } from '../../lib/materials/flowRow'
import { actIsFresh } from '../../lib/materials/photo'
import { BoxPhotos, CameraGlyph, PhotoPress } from '../materials/PhotoPress'
import { shootBoxPhoto } from '../../lib/materials/boxPhotoShoot'
import { TAKE_MAX, newTakeRun, takeAddExtra, takeDoneWords, takeIsOnePart, takeLeftWords, takeLineHint, takeMark, takePhotoWords, takeQuicks, takeRemoveExtra, takeRows, takeSaveLabel, takeSaved, takeStartLabel, takeTotal, type TakePhotoKind, type TakeRun } from '../../lib/materials/takeRun'
import { forgetTakeRun, keepTakeRun, readTakeRun, readTakeRuns } from '../../lib/materials/takeRunMemory'
import type { PhotoNote } from '../../lib/materials/photo'
import { takesOf } from '../../lib/materials/takes'
import TakesPanel from '../materials/TakesPanel'
import { FlowRow } from '../materials/FlowRow'
import { TallyChooseJobSheet } from './TallyChooseJobSheet'
import { countWalkAt, countWalkCantFindWords, countWalkKeys } from '../../lib/materials/countWalk'
import { stepperKeeps, stepperTyped } from '../../lib/materials/stepperInput'
import { containerLines, containerWords, countIsDue, groupByPlace, lastCountWords, lastCountedAt, leftWords, linesOf, placeName, pressLabel, searchContainers, searchLines, type Container, type ContainerLine, type MovementReason, type Place } from '../../lib/materials/onSite'
import { addPressLabel, boxNameVerdict, nextFreeName, siteBoxesFor, type SiteBox } from '../../lib/materials/boxName'
import { BOX_LINE_FIELD_LABEL, BOX_LINE_FROM_PARTS, BOX_LINE_LATER_NOTE, BOX_LINE_MAX, BOX_LINE_SAID_NOTE, addedLineVerdict, boxLineFromParts, boxLineOf, boxLinePressLabel, boxLineSavedWords, boxLineVerdict, lineFieldValue, nameWordsNote, sayItBetterPress, sayItBetterSub, sayItBetterTitle, type BoxLine } from '../../lib/materials/boxLine'
import { readLastBoxKind, rememberBoxKind } from '../../lib/materials/boxKindMemory'
import { useSiteBoxNames } from '../../hooks/useSiteBoxNames'
import { matchOnHandNames, onHandNames, onHandNameWords, type OnHandName } from '../../lib/materials/onSiteNames'
import { addContainer, addMovement, addPlace, listContainerMoves, listContainers, listMovements, listPhotos, listPlaces, loadJob, moveContainer, newId, pinContainer, resolveBoxCode, retireContainer, sayBoxLine, setOnSiteErrorHandler, unretireContainer, refreshJob } from '../../lib/materials/onSiteStore'
import { broughtBackWords, retiredWords, UNDO_RETIRE_MS, undoRetireLabel, unretireVerdict } from '../../lib/materials/unretire'
import { BOX_KIND_CHOICES, BOX_WHERE_MAX, boxKindWords, editBoxTitle, type BoxKindChoice } from '../../lib/materials/editBox'
import BoxTabs from '../materials/BoxTabs'
import { SHORT_MAX, shortAfterWords, shortLabel, shortRefusalWords, shortRequestRow, shortToast } from '../../lib/materials/shortRequest'
import { sendShortRequest } from '../../lib/materials/shortRequestIo'
import { boxClipboardWords, copiedLabelWords } from '../../lib/materials/labels'
import { boxPagePath } from '../../lib/materials/boxPage'
import { findOnSite, otherJobsWithBoxes, otherJobsWords, type OnSiteFindHit } from '../../lib/materials/onSiteFind'
import LabelsPrintModal from '../materials/LabelsPrintModal'
import ManifestPrintModal from '../materials/ManifestPrintModal'
import ScanLabelWindow from '../materials/ScanLabelWindow'
import { ON_SITE_BOX_REFRESH_AFTER_MS } from '../../lib/materials/onSiteFresh'
import { onSiteJobWords } from '../../lib/materials/onSiteJobWords'
import { formatErrorMessage } from '../../utils/errorHandling'

/** Leaflet and its CSS load only when a map opens, so the tally stays light. */
const OnSiteMapLazy = lazy(() => import('../materials/OnSiteMap'))

export type OnSiteJob = { id: string; hcp_number: string; job_name: string; job_address: string; click_number?: string | null; customer_name?: string | null; service_type_id?: string | null }
export type OnSitePart = { id: string; name: string; manufacturer: string | null }

type Props = {
  jobs: OnSiteJob[]
  jobsLoading: boolean
  selectedJobId: string | null
  onPickJob: (id: string) => void
  byUserId: string | null
  byName: string
  searchParts: (term: string) => Promise<OnSitePart[]>
  /** `?container=<id>` from a label's QR: open that container first. */
  initialContainerId: string | null
  /** `?sticker=<code>` from a blank sticker's QR (v2.7298): open the Sticker is new sheet on it. */
  initialStickerCode?: string | null
  /** Goes up each time the address asks for a box, so a box asked for a second time opens again (v2.6904). */
  askSeq?: number
  /** Told which box's screen is open, null on the list, so the page can keep it on the address (v2.6904). */
  onOpenContainer?: (containerId: string | null) => void
  /** Told which sticker's sheet is open, null once it closes, so the page keeps it on the address (v2.7298). */
  onOpenSticker?: (code: string | null) => void
}

const TOUCH_MIN = 48
const BLUE = '#2563eb'
const GREEN = '#059669'

const btn: CSSProperties = { minHeight: TOUCH_MIN, padding: '0 0.9rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }
const btnPrimary: CSSProperties = { ...btn, background: BLUE, borderColor: BLUE, color: '#fff' }
const btnGo: CSSProperties = { ...btn, background: GREEN, borderColor: GREEN, color: '#fff' }
const btnBlock: CSSProperties = { width: '100%' }
/** A box screen's chip row: three on one line at 375, so the words stay short and never wrap. */
const chip: CSSProperties = { ...btn, minHeight: 36, fontSize: '0.8rem', padding: '0 0.5rem', borderRadius: 999, fontWeight: 600, whiteSpace: 'nowrap' }
const quiet: CSSProperties = { background: 'none', border: 'none', padding: 0, minHeight: 36, color: 'var(--text-link)', textDecoration: 'underline', font: 'inherit', cursor: 'pointer' }
const card: CSSProperties = { background: 'var(--surface)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', borderRadius: 10, padding: '0.75rem 0.9rem' }
const input: CSSProperties = { width: '100%', minHeight: TOUCH_MIN, padding: '0.6rem 0.9rem', fontSize: '1rem', boxSizing: 'border-box', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-strong)' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.85rem' }
/** A print the box's page offers: a pill at thumb height with the printer glyph. It opens the print window here, on the rows the tab already holds (punch list #304). */
const paperPress: CSSProperties = { ...btn, borderRadius: 999, justifyContent: 'center', gap: '0.4rem', textDecoration: 'none', fontSize: '0.9rem', padding: '0 0.6rem', whiteSpace: 'nowrap' }
/** The search's reach: this job, or every job the viewer may open. */
const scopePill = (on: boolean): CSSProperties => ({ minHeight: 40, padding: '0 0.8rem', border: 'none', background: on ? 'var(--text-strong)' : 'var(--surface)', color: on ? 'var(--surface)' : 'var(--text-700)', font: 'inherit', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' })
function PrinterGlyph() {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
      <path d="M6 9V3h12v6" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="7" />
    </svg>
  )
}
/** Take from a box: a run left on a box, offered again. */
const leftStrip: CSSProperties = { display: 'grid', gap: '0.5rem', padding: '0.6rem 0.75rem', borderRadius: 10, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', color: 'var(--text-strong)' }
/** The press that stays at the bottom of a box's screen and of the run's, above the app's own bottom bar. */
const takeBar: CSSProperties = { position: 'sticky', bottom: 'var(--app-bottom-chrome, 0px)', zIndex: 5, display: 'grid', gap: '0.25rem', padding: '0.5rem 0 0.6rem', margin: '0 0 -1rem', background: 'var(--bg-page)', borderTop: '1px solid var(--border)' }
/** Inline styles have no :disabled, so a dead press fades by hand. */
const dis = (off: boolean): CSSProperties => (off ? { opacity: 0.45, cursor: 'default' } : {})

type View = { kind: 'containers' } | { kind: 'container'; id: string } | { kind: 'take'; id: string } | { kind: 'count'; id: string; /** The walk's lines by part key, fixed when it starts (`countWalkKeys`). */ keys: string[]; index: number; corrected: number }
type Sheet =
  | null
  | { kind: 'qty'; reason: 'used' | 'cannot_find'; line: ContainerLine; container: Container }
  | { kind: 'short'; line: ContainerLine; container: Container }
  | { kind: 'move'; line: ContainerLine; container: Container }
  | { kind: 'add-part'; container: Container }
  /** Take from a box: a part the box's list does not hold. */
  | { kind: 'take-other'; container: Container }
  | { kind: 'add-container'; moveAfter: { line: ContainerLine; qty: number; from: Container } | null }
  | { kind: 'retire'; container: Container }
  | { kind: 'edit-box'; container: Container }
  /** Say it better (punch list #351, PR 2): a person's own words for what is in the box. */
  | { kind: 'say-line'; container: Container }
  | { kind: 'pick-job' }
  | { kind: 'move-box'; container: Container }
  | { kind: 'places' }
  | { kind: 'map'; focusId: string | null }
  | { kind: 'pin'; container: Container }
  /** Where is it? (punch list #372): what the app knows about where a box stands, the way to it, and I found it. */
  | { kind: 'where'; container: Container }
  | { kind: 'pick-box' }

export default function TallyOnSiteTab({ jobs, jobsLoading, selectedJobId, onPickJob, byUserId, byName, searchParts, initialContainerId, initialStickerCode = null, askSeq = 0, onOpenContainer, onOpenSticker }: Props) {
  const { showToast, showActionToast } = useToastContext()
  // Send someone to it (punch list #372, step 5): the New task window, where the app has one mounted.
  const addTask = useChecklistAddModal()
  /** A 320 px phone: the four presses go two by two, as the mock-up drew them. */
  const narrow = useMatchMedia('(max-width: 359px)')
  const jobId = selectedJobId
  const load = useOnSiteJob(jobId)
  useEffect(() => { setOnSiteErrorHandler((m, tone) => showToast(m, tone)) }, [showToast])
  const job = jobs.find((j) => j.id === jobId) ?? null
  const containers = jobId ? listContainers(jobId).filter((c) => !c.retiredAt) : []
  // The site's boxes for the name rule (punch list #351): the other jobs' from one read, this job's from the store.
  const siteNames = useSiteBoxNames(jobId)
  const siteBoxes: SiteBox[] = jobId ? siteBoxesFor(jobId, siteNames.rows, listContainers(jobId)) : []
  // The job's stickers (punch list #329, PR 3): the numbers beside each box's name, and how many are not yet on a box.
  const jobStickers = useJobStickers(jobId, containers.map((c) => c.id))
  const stickersOn = (c: { id: string; label: string }) => stickerMarksWords(c.label, jobStickers.marksByBox.get(c.id) ?? [])
  const movements = jobId ? listMovements(jobId) : []
  const places = jobId ? listPlaces(jobId) : []
  const lines = containerLines(movements)
  const now = new Date()
  const [view, setView] = useState<View>({ kind: 'containers' })
  // Opening a box reads the job again when its last read is more than a few seconds old (v2.7177): the number on a
  // line is about to be pressed against, and another phone may have changed it.
  const openBoxId = view.kind === 'container' ? view.id : null
  useEffect(() => { if (jobId && openBoxId) refreshJob(jobId, ON_SITE_BOX_REFRESH_AFTER_MS) }, [jobId, openBoxId])
  const [sheet, setSheet] = useState<Sheet>(null)
  // Take from a box (v2.7824): the run on screen. It is kept on the phone on every change (`takeRunMemory.ts`), since
  // a phone can drop the page while its camera is open; `takeRef` is the run as the camera's answer must read it.
  const [take, setTake] = useState<TakeRun | null>(null)
  const takeRef = useRef<TakeRun | null>(null)
  const [takeBusy, setTakeBusy] = useState<string | null>(null)
  const takeShot = useRef<TakePhotoKind | null>(null)
  const onTakeFile = useRef<(f: File) => void>(() => {})
  // The run's one camera input lives outside the screens: the press that opens it also changes the screen, and an
  // input drawn by a screen would be gone before the camera answers.
  const takeInput = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    const el = document.createElement('input')
    el.type = 'file'
    el.accept = 'image/*'
    el.setAttribute('capture', 'environment')
    el.setAttribute('aria-hidden', 'true')
    el.setAttribute('data-testid', 'take-camera')
    el.tabIndex = -1
    el.style.display = 'none'
    const onChange = () => { const f = el.files?.[0]; el.value = ''; if (f) onTakeFile.current(f) }
    el.addEventListener('change', onChange)
    document.body.appendChild(el)
    takeInput.current = el
    return () => { el.removeEventListener('change', onChange); el.remove(); takeInput.current = null }
  }, [])
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  /** The search's reach (punch list #304): this job, or every job the viewer may open. */
  const [scope, setScope] = useState<'job' | 'all'>('job')
  const [scanOpen, setScanOpen] = useState(false)
  /** A box's paper, printed here: its label or its manifest. */
  const [paper, setPaper] = useState<{ kind: 'label' | 'manifest'; id: string } | null>(null)
  /** The box to open once another job's boxes are on screen (a hit on another job was pressed). */
  const pendingContainerRef = useRef<string | null>(null)
  /** The blank sticker in hand (v2.7298): its code while its sheet is open, and what the code resolved to. It outlives a change of job, so *Change* under the new box keeps the sticker. */
  const [stickerCode, setStickerCode] = useState<string | null>(null)
  /** These are on boxes (section 10, PR 10): the form that puts a range of named stickers on their boxes with no scan. */
  const [onBoxesOpen, setOnBoxesOpen] = useState(false)
  const [stickerFound, setStickerFound] = useState<CodeLookup | 'looking' | null>(null)
  useEffect(() => { if (initialStickerCode) setStickerCode(initialStickerCode) }, [initialStickerCode, askSeq])
  useEffect(() => { onOpenSticker?.(stickerCode) }, [stickerCode, onOpenSticker])
  /** A sticker that resolved to something other than a blank one: a box opens as a scan of it would, the rest is said. */
  useEffect(() => {
    if (!stickerFound || stickerFound === 'looking' || stickerFound.kind === 'blank') return
    setStickerCode(null)
    if (stickerFound.kind === 'box') {
      // A sticker whose tape reads another name than its box's says so as the box opens (section 10: G78 on a box named G78B).
      const reads = stickerFound.sticker ? stickerReadsOtherWords(stickerFound.sticker, stickerFound.container.label) : ''
      if (reads) showToast(reads, 'info')
      if (jobId && stickerFound.container.jobId === jobId) setView({ kind: 'container', id: stickerFound.container.id })
      else { pendingContainerRef.current = stickerFound.container.id; onPickJob(stickerFound.container.jobId) }
      return
    }
    showToast(stickerFound.kind === 'lost' ? `${LOST_STICKER_TITLE}.` : stickerFound.kind === 'retired' ? `${retiredBoxStickerTitle(stickerFound.sticker)}. Bring it back first.` : stickerFound.kind === 'retired_label' ? `${retiredLabelTitle(stickerFound.container)}. Bring it back first.` : stickerFound.kind === 'out_of_reach' ? `${OUT_OF_REACH_STICKER_TITLE}.` : 'That code is not a sticker or a box you can open.', 'warning')
  }, [stickerFound, jobId, onPickJob, showToast])
  useEffect(() => {
    if (!stickerCode) { setStickerFound(null); return }
    let live = true
    setStickerFound('looking')
    resolveBoxCode(stickerCode)
      .then((found) => { if (live) setStickerFound(found) })
      .catch((e: unknown) => { if (live) { setStickerFound(null); setStickerCode(null); showToast(formatErrorMessage(e, 'The sticker did not read.'), 'error') } })
    return () => { live = false }
  }, [stickerCode, showToast])
  // Every job with a box loads only when it is asked for: the search set to Every job, or a job with no box of its own.
  const emptyJob = jobId != null && load.loaded && containers.length === 0
  const desk = useOnSiteDeskJobs(scope === 'all' || emptyJob, jobs)
  // Only the jobs this tab can open: a press on another job's box has to land.
  const reachable = desk.jobs.filter((j) => jobs.some((x) => x.id === j.jobId))
  /** The place chips on a big site: 'all', a place id, or 'none' for boxes with no place yet. */
  const [placeFilter, setPlaceFilter] = useState<string>('all')
  /** The flow row's two filters (#209): the boxes Used was pressed on today, or the boxes due a count. */
  const [flowFilter, setFlowFilter] = useState<'none' | 'used' | 'due'>('none')
  /** The last thing done to a box on this screen, so the Photo press turns blue for a few minutes and the picture is named "A1 after Put in" (#209). */
  const [lastAct, setLastAct] = useState<{ containerId: string; what: string; at: number } | null>(null)
  // Pin A7 where you stand? (punch list #372, step 3): asked once a day for a box, after a count, a photo, a scan of
  // its label or its own making, when the person is known to stand at it (`pinAsk.ts`).
  const [pinAsk, setPinAsk] = useState<string | null>(null)
  const offerPin = useCallback((c: Container | null | undefined) => {
    if (c && takePinAsk(c, new Date(), todayYmdInAppTz())) setPinAsk(c.id)
  }, [])
  const scannedRef = useRef<string | null>(null)
  // The walk's line vanished under it (a fresh read dropped it, or the box lost its lines): the walk ends from an
  // effect, never while the screen is drawn, which React refuses as a state change inside a render.
  useEffect(() => {
    if (view.kind !== 'count') return
    const c = containers.find((x) => x.id === view.id)
    if (!c || countWalkAt(view.keys, view.index, linesOf(lines, c.id))) return
    showToast(`${c.label} counted. ${view.keys.length} ${view.keys.length === 1 ? 'line' : 'lines'}, ${view.corrected} corrected.`, 'success')
    setLastAct({ containerId: c.id, what: 'Count', at: Date.now() })
    offerPin(c)
    setView({ kind: 'container', id: c.id })
  }, [view, containers, lines, showToast, offerPin])
  // A label's code just opened a box (`BoxCode.tsx`): the ask waits for the box to be read, then is offered once.
  useEffect(() => {
    const id = scannedRef.current
    if (!id) return
    const c = containers.find((x) => x.id === id)
    if (!c) return
    scannedRef.current = null
    offerPin(c)
  }, [containers, offerPin])
  // The site map opens on the job's address, placed through the app's geocode cache, until a box is pinned.
  const addr = job?.job_address?.trim() ?? ''
  const geocodeAsk = useMemo(() => (addr ? [{ key: normalizeAddressForGeocodeKey(addr), display: addr }] : []), [addr])
  const { coords: jobCoords } = useAddressGeocodeCoords(geocodeAsk, addr.length > 0, 'on-site map')
  const jobCenter = addr ? (jobCoords.get(normalizeAddressForGeocodeKey(addr)) ?? null) : null
  // The job's painted maps (#345), under the boxes on the site map: read only while that map is open.
  const painted = usePaintedMapsLayer(jobId ? { jobId } : null, sheet?.kind === 'map' || sheet?.kind === 'where')
  const mapPins: OnSiteMapPin[] = containers.filter((c) => c.lat != null && c.lng != null && !c.retiredAt).map((c) => ({ id: c.id, label: c.label, lat: c.lat as number, lng: c.lng as number, tone: countIsDue(lastCountedAt(movements, c.id), new Date()) && c.kind !== 'unsorted' ? 'amber' : 'ok' }))
  const pinnedCount = mapPins.length
  const boxCount = containers.filter((c) => c.kind !== 'unsorted' && !c.retiredAt).length
  // The map sheets: where the map should jump (Use my location), what the ring sits on while placing, and a word when the phone cannot say where it is.
  const [mapFly, setMapFly] = useState<MyFix | null>(null)
  const [locating, setLocating] = useState<string | null>(null)
  const [pinCenter, setPinCenter] = useState<LatLng | null>(null)
  const myLocation = () => { setLocating('Finding you…'); requestMyLocation((p) => { setLocating(null); setMapFly({ ...p }) }, (words) => setLocating(words)) }
  const closeSheet = () => { setSheet(null); setLocating(null); setMapFly(null) }
  /** Pin a box from the site map: the ring sits at the map's centre; the footer's button puts the pin there. Drawn from either view. */
  const pinSheet = sheet?.kind === 'pin' ? (
    <Sheet
      fill
      title={`Pin ${sheet.container.label} on the map`}
      sub={sheet.container.lat != null ? 'Its pin is on the map. Drag the map to move the ring, then press the button.' : 'Step 1: drag the map until the ring is on the box, or press Use my location when you stand at it. Step 2: press the button.'}
      onClose={closeSheet}
      footer={
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '0.5rem' }}>
            <button type="button" style={btn} onClick={myLocation}>Use my location</button>
            <button type="button" style={{ ...btnPrimary, minHeight: 52, ...dis(!pinCenter) }} disabled={!pinCenter} onClick={() => { if (!pinCenter) return; /* The phone's margin stands only while the ring is still on its reading (v2.7575). */ pinContainer(sheet.container.id, pinCenter, { accuracyM: taskPlaceSheetAccuracy(mapFly, pinCenter), byName }); closeSheet(); showToast(`${sheet.container.label} pinned on the map.`, 'success') }}>Put {sheet.container.label} here</button>
          </div>
          {locating ? <p style={{ ...muted, margin: 0 }}>{locating}</p> : null}
          {sheet.container.lat != null ? <button type="button" style={{ ...quiet, justifySelf: 'start', color: 'var(--text-muted)', fontSize: '0.85rem' }} onClick={() => { pinContainer(sheet.container.id, null); closeSheet(); showToast(`${sheet.container.label}\u2019s pin removed.`, 'info') }}>Remove the pin</button> : null}
        </>
      }
    >
      <div style={{ flex: '1 1 auto', minHeight: 0 }}>
        <Suspense fallback={<p style={muted}>Loading the map…</p>}>
          <OnSiteMapLazy center={jobCenter} pins={mapPins} height="100%" focusId={sheet.container.lat != null ? sheet.container.id : null} flyTo={mapFly} placing={{ label: sheet.container.label }} onCenterChange={setPinCenter} />
        </Suspense>
      </div>
    </Sheet>
  ) : null

  useEffect(() => {
    const pending = pendingContainerRef.current
    pendingContainerRef.current = null
    const open = pending ?? initialContainerId
    const scanned = takeScannedBox()
    if (open && scanned === open) scannedRef.current = open
    setView(open ? { kind: 'container', id: open } : { kind: 'containers' })
    setSheet(null)
    takeRef.current = null
    setTake(null)
    if (open) setStickerCode(null)
    setQuery('')
    setScope('job')
    setPlaceFilter('all')
  }, [jobId, initialContainerId, askSeq])

  // The box on screen, its count walk included: the page keeps it on the address, so a reload or Back comes back to it.
  const openContainerId = view.kind === 'containers' ? null : view.id
  useEffect(() => { onOpenContainer?.(openContainerId) }, [openContainerId, onOpenContainer])

  if (jobsLoading) return <p style={muted}>Loading jobs…</p>
  if (jobs.length === 0) return <p style={muted}>No jobs assigned. Ask your supervisor to add you as a team member on a job.</p>

  const jobButton = (
    <button type="button" onClick={() => setSheet({ kind: 'pick-job' })} aria-label="Choose job" style={{ ...btn, ...btnBlock, minHeight: 40, justifyContent: 'space-between', fontWeight: 600, fontSize: '0.9rem', textAlign: 'left', background: 'var(--bg-blue-tint)', borderColor: 'transparent', color: 'var(--text-blue-700)', borderRadius: 999, padding: '0 0.9rem' }}>
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><span style={{ fontSize: '0.65rem', letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.8, marginRight: '0.5rem' }}>Job</span>{job ? onSiteJobWords(job) : 'Choose job…'}</span>
      <span style={{ fontSize: '0.8rem' }}>▾</span>
    </button>
  )
  const jobSheet = sheet?.kind === 'pick-job' ? (
    <TallyChooseJobSheet jobs={jobs} selectedJobId={jobId} viewerUserId={byUserId} onPick={(id) => { onPickJob(id); setSheet(null) }} onClose={() => setSheet(null)} />
  ) : null
  if (!jobId || !job) return <div style={{ display: 'grid', gap: '0.75rem' }}>{jobButton}{jobSheet}</div>

  const write = (reason: MovementReason, line: Pick<ContainerLine, 'partId' | 'partName' | 'manufacturer'>, quantity: number, from: string | null, to: string | null, note = '') =>
    addMovement({ jobId, partId: line.partId, partName: line.partName, manufacturer: line.manufacturer, quantity, reason, fromContainerId: from, toContainerId: to, note, byUserId, byName })

  // ── Take from a box ─────────────────────────────────────────────────────────────────────────
  const putTake = (run: TakeRun | null) => { takeRef.current = run; setTake(run); if (run) keepTakeRun(run) }
  /** Opens the phone's camera. Called inside a press, since a browser opens the camera only from a tap. */
  const openCamera = (kind: TakePhotoKind) => { takeShot.current = kind; takeInput.current?.click() }
  const endTake = (run: TakeRun, c: Container, photoAfter: boolean) => {
    forgetTakeRun(run.jobId, run.containerId)
    putTake(null)
    setSheet(null)
    showToast(takeDoneWords(run.savedCount, c.label, photoAfter), 'success')
    offerPin(c)
    setView({ kind: 'container', id: c.id })
  }
  const startTake = (c: Container) => {
    putTake(newTakeRun({ id: newId(), jobId, containerId: c.id, lines: linesOf(lines, c.id), now: new Date().toISOString() }))
    setSheet(null)
    setView({ kind: 'take', id: c.id })
    openCamera('before')
  }
  /** A run left on this box is taken up again: its marks as they were, or the photo after that is still owed. */
  const resumeTake = (c: Container, run: TakeRun) => {
    putTake(run)
    setSheet(null)
    setView({ kind: 'take', id: c.id })
    if (run.savedAt) openCamera('after')
  }
  const dropTake = (c: Container, run: TakeRun) => {
    if (run.savedAt) { endTake(run, c, false); return }
    forgetTakeRun(run.jobId, run.containerId)
    putTake(null)
    setView({ kind: 'container', id: c.id })
  }
  /** The take is saved before the photo after: the rows go through the store's outbox, then the camera opens. */
  const saveTake = (c: Container) => {
    const run = takeRef.current
    if (!run || run.savedAt) return
    const rows = takeRows(run, linesOf(lines, c.id))
    if (rows.length === 0) return
    for (const r of rows) addMovement({ jobId, partId: r.partId, partName: r.partName, manufacturer: r.manufacturer, quantity: r.quantity, reason: r.reason, fromContainerId: r.fromContainerId, toContainerId: r.toContainerId, note: r.note, byUserId, byName, takeId: run.id })
    putTake(takeSaved(run, new Date().toISOString()))
    openCamera('after')
  }
  onTakeFile.current = (f: File) => {
    const run = takeRef.current
    const kind = takeShot.current
    const c = run ? containers.find((x) => x.id === run.containerId) : null
    if (!run || !kind || !c) return
    void (async () => {
      try {
        const shot = await shootBoxPhoto(f, { jobId, containerId: c.id, containerLabel: c.label, after: null, words: takePhotoWords(c.label, kind), kind, takeId: run.id, byUserId, byName, onStage: (st) => setTakeBusy(st === 'shrinking' ? 'Shrinking the photo…' : 'Sending the photo…') })
        if (shot.kind === 'lost') { showToast(`${shot.why} This phone could not keep the photo either. Take it again.`, 'error'); return }
        if (shot.kind === 'kept') showToast(`${shot.why} The photo is kept on this phone. It sends by itself when there is signal.`, 'info')
        const now = takeRef.current
        if (kind === 'after' && now && now.id === run.id && now.savedAt) endTake(now, c, true)
      } catch (err) {
        showToast(`The photo could not be taken: ${formatErrorMessage(err)}`, 'error')
      } finally {
        setTakeBusy(null)
      }
    })()
  }

  /** The sticker's sheet said its last word: the sticker is placed, or a taken one's box is to be opened. The job is read again so a new box is there before its screen opens. */
  const stickerDone = (outcome: PlaceOutcome) => {
    setStickerCode(null)
    showToast(outcome.words, outcome.kind === 'placed' || outcome.kind === 'created' || outcome.kind === 'already' ? 'success' : 'info')
    jobStickers.refresh()
    if (!outcome.containerId) return
    const target = outcome.containerId
    if (outcome.jobId && outcome.jobId !== jobId) {
      pendingContainerRef.current = target
      onPickJob(outcome.jobId)
      return
    }
    void loadJob(jobId, { force: true }).then(() => { setSheet(null); setView({ kind: 'container', id: target }) })
  }
  const stickerSheet = stickerFound && stickerFound !== 'looking' && stickerFound.kind === 'blank' ? (
    <StickerNewSheet
      sticker={stickerFound.sticker}
      jobId={jobId}
      jobs={jobs}
      containers={containers}
      lines={lines}
      places={places}
      siteJobIds={siteNames.rows.map((r) => r.jobId)}
      siteBoxes={siteBoxes}
      stickersByBox={jobStickers.byBox}
      marksByBox={jobStickers.marksByBox}
      onClose={() => setStickerCode(null)}
      onChangeJob={() => setSheet({ kind: 'pick-job' })}
      onDone={stickerDone}
    />
  ) : null

  // ── the containers ──────────────────────────────────────────────────────────────────────────
  if (view.kind === 'containers') {
    const order = new Map(containers.map((c, i) => [c.id, i] as const))
    const hits = searchLines(lines, query).sort((a, b) => (order.get(a.containerId) ?? 99) - (order.get(b.containerId) ?? 99))
    const boxHits = searchContainers(containers, query)
    const liveBoxes = containers.filter((c) => c.kind !== 'unsorted')
    const chips = [{ id: 'all', name: 'All', n: liveBoxes.length }, ...places.map((p) => ({ id: p.id, name: p.name, n: liveBoxes.filter((c) => c.locationId === p.id).length })).filter((p) => p.n > 0), ...(liveBoxes.some((c) => !c.locationId) ? [{ id: 'none', name: 'No place yet', n: liveBoxes.filter((c) => !c.locationId).length }] : [])]
    const flow = phoneFlow(containers, movements, now)
    const flowIds = flowFilter === 'used' ? flow.usedBoxIds : flowFilter === 'due' ? flow.dueBoxIds : null
    const groups = groupByPlace(containers, places)
      .filter((g) => placeFilter === 'all' || (g.containers[0]?.kind === 'unsorted' ? placeFilter === 'all' : placeFilter === 'none' ? g.place == null : g.place?.id === placeFilter))
      .map((g) => (flowIds ? { ...g, containers: g.containers.filter((c) => flowIds.includes(c.id)) } : g))
      .filter((g) => g.containers.length > 0)
    const grouped = new Map<string, ContainerLine[]>()
    for (const h of hits) grouped.set(h.partKey, [...(grouped.get(h.partKey) ?? []), h])
    // Every job (punch list #304): the same words searched on the other jobs with a box, this job's own hits first above.
    const everyJob = scope === 'all' || emptyJob
    const otherFound = everyJob ? findOnSite(reachable.filter((j) => j.jobId !== jobId), query) : { hits: [], total: 0 }
    const otherByJob = new Map<string, OnSiteFindHit[]>()
    for (const h of otherFound.hits) otherByJob.set(h.jobId, [...(otherByJob.get(h.jobId) ?? []), h])
    const lookingElsewhere = everyJob && desk.loading && !desk.loaded
    const others = otherJobsWithBoxes(reachable, jobId)
    const openElsewhere = (h: Pick<OnSiteFindHit, 'jobId'> & { containerId: string | null }) => {
      pendingContainerRef.current = h.containerId
      setQuery('')
      onPickJob(h.jobId)
    }
    // `minmax(0, 1fr)` on the one track: a plain `1fr` grows to its widest child's min-content, and the place chips' row
    // once pushed the whole column 28 px past a 375 px phone.
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.75rem' }}>
        {jobButton}
        {!load.loaded && load.loading ? <p style={{ ...muted, margin: 0 }}>Loading the boxes…</p> : null}
        <OfflineRetryPanel failure={load.error ? recoveryFailureFromError(load.raw, 'The boxes on this job did not load.') : null} onRetry={load.retry} surface="materials-on-site-phone" idempotent />
        {/* #297 (v2.6927): the job's box photos still on their way to its Drive folder after a combine or a move. */}
        {jobId ? <BoxPhotoRefileStrip jobId={jobId} onToast={showToast} /> : null}
        {/* Take from a box: a run left on one of this job's boxes is offered again, on the list as on the box. */}
        {readTakeRuns(jobId, Date.now()).map((run) => {
          const c = containers.find((x) => x.id === run.containerId)
          if (!c) return null
          const words = takeLeftWords(run, c.label)
          return (
            <div key={run.id} role="group" aria-label={words.main} style={leftStrip} data-testid="on-site-take-left">
              <span><b>{words.main}</b> {words.sub}</span>
              <button type="button" style={{ ...btn, justifySelf: 'start' }} onClick={() => setView({ kind: 'container', id: c.id })}>Open {c.label}</button>
            </div>
          )
        })}
        {/* The flow row (#209): the three names already on this screen, in the order of a day, each with its count; a dot where the crew is needed now. */}
        {containers.length > 0 ? (
          <FlowRow
            role="filters"
            size="phone"
            wordFirst
            label="Today on this job"
            pills={[
              { key: 'unsorted', word: 'Unsorted', figure: String(flow.unsorted), tone: 'in', badge: flow.unsorted > 0 ? 'dot' : null, off: !flow.unsortedId || flow.unsorted === 0, title: flow.unsorted > 0 ? `${flow.unsorted} ${flow.unsorted === 1 ? 'part waits' : 'parts wait'} in Unsorted. Open it to put them in a cage.` : 'Nothing waiting in Unsorted.', onPress: () => { if (flow.unsortedId) setView({ kind: 'container', id: flow.unsortedId }) } },
              { key: 'used', word: 'Used', figure: String(flow.usedToday), tone: 'out', on: flowFilter === 'used', off: flow.usedToday === 0, title: flow.usedToday > 0 ? `${flow.usedToday} used today. Press to see the boxes they came from.` : 'Nothing used today.', onPress: () => setFlowFilter((f) => (f === 'used' ? 'none' : 'used')) },
              { key: 'count', word: 'Count', figure: String(flow.due), tone: 'here', badge: flow.due > 0 ? 'dot' : null, on: flowFilter === 'due', off: flow.due === 0, title: flow.due > 0 ? `${flow.due} ${flow.due === 1 ? 'box is' : 'boxes are'} due a count. Press to see just them.` : 'No box is due a count.', onPress: () => setFlowFilter((f) => (f === 'due' ? 'none' : 'due')) },
            ]}
          />
        ) : null}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <span aria-hidden style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.15rem', lineHeight: 1 }}>⌕</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={everyJob ? 'Find a part on any job' : 'Find a part on this job'} aria-label={everyJob ? 'Find a part on any job' : 'Find a part on this job'} style={{ ...input, borderRadius: 999, background: 'var(--bg-subtle)', paddingLeft: '2.4rem' }} />
        </div>
        <button type="button" aria-label="Site map" title="The site map: every pinned box" onClick={() => setSheet({ kind: 'map', focusId: null })} style={{ ...btn, borderRadius: 999, padding: '0 0.9rem', flex: '0 0 auto', gap: '0.35rem' }}><span aria-hidden>◎</span>Map</button>
        </div>
        {/* The search's reach and the scan (punch list #304): one row, so a part on another job and a label in the hand are both one press away. */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', minWidth: 0 }}>
          {/* A job with no box has no "this job" to search: the search already looks on every job, so the choice is not drawn. */}
          {emptyJob ? null : (
            <span role="group" aria-label="Where to look" style={{ display: 'inline-flex', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', borderRadius: 999, overflow: 'hidden', flex: '0 0 auto' }}>
              <button type="button" aria-pressed={!everyJob} style={scopePill(!everyJob)} onClick={() => setScope('job')}>This job</button>
              <button type="button" aria-pressed={everyJob} style={scopePill(everyJob)} onClick={() => setScope('all')}>Every job</button>
            </span>
          )}
          <button type="button" style={{ ...btn, minHeight: 40, borderRadius: 999, padding: '0 0.9rem', fontSize: '0.85rem', marginLeft: 'auto', flex: '0 0 auto', whiteSpace: 'nowrap' }} onClick={() => setScanOpen(true)} data-testid="on-site-scan-label">Scan a label</button>
        </div>
        {!query.trim() && chips.length > 2 ? (
          /* The row is a grid item, so without minWidth: 0 it takes the chips' full width and lays the whole page out wider than a phone; iOS Safari then lets a pinch zoom the app out (v2.6286). */
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', minWidth: 0 }}>
            <button type="button" aria-label="All places" title="Every place on this site" onClick={() => setSheet({ kind: 'places' })} style={{ ...btn, minHeight: 36, padding: '0 0.65rem', borderRadius: 999, fontSize: '0.85rem', flex: '0 0 auto', gap: '0.25rem' }}>Places <span aria-hidden style={{ fontSize: '0.7rem' }}>▾</span></button>
          <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.15rem', scrollbarWidth: 'none', minWidth: 0, flex: 1 }}>
            {chips.map((ch) => (
              <button key={ch.id} type="button" onClick={() => setPlaceFilter(ch.id)} style={{ ...btn, minHeight: 36, padding: '0 0.75rem', borderRadius: 999, fontSize: '0.85rem', whiteSpace: 'nowrap', flex: '0 0 auto', ...(placeFilter === ch.id ? { background: 'var(--text-strong)', color: 'var(--bg-page)', borderColor: 'var(--text-strong)' } : {}) }}>{ch.name} <span style={{ opacity: 0.7, fontWeight: 500 }}>{ch.n}</span></button>
            ))}
          </div>
          </div>
        ) : null}
        {query.trim() ? (
          <>
            {boxHits.length > 0 ? (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <div style={{ fontWeight: 600 }}>Boxes</div>
                {boxHits.slice(0, 8).map((c) => (
                  <button key={c.id} type="button" onClick={() => { setQuery(''); setView({ kind: 'container', id: c.id }) }} style={{ ...card, display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', font: 'inherit', textAlign: 'left', minHeight: TOUCH_MIN, color: 'var(--text-strong)', padding: '0.5rem 0.75rem' }}>
                    <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>{c.label}</span>
                    <span style={{ display: 'grid', minWidth: 0 }}>
                      {boxLineOf(c, lines).text ? <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} data-testid="on-site-hit-line">{boxLineOf(c, lines).text}</span> : null}
                      <span style={muted}>{boxKindWords(c.kind).toLowerCase()} · {placeName(places, c.locationId)}</span>
                    </span>
                    <span aria-hidden style={{ marginLeft: 'auto', color: 'var(--text-faint)', fontSize: '1.3rem', lineHeight: 1 }}>›</span>
                  </button>
                ))}
              </div>
            ) : null}
            {hits.length === 0 && boxHits.length === 0 ? (
              otherFound.total > 0 || lookingElsewhere ? null : (
              <div style={{ ...card, borderStyle: 'dashed', display: 'grid', gap: '0.5rem' }}>
                <EmptyState compact {...emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'parts on site', query: query.trim() }), { onPress: () => setQuery('') })} />
                {!everyJob ? <button type="button" style={{ ...btn, ...btnBlock }} onClick={() => setScope('all')} data-testid="on-site-look-everywhere">Look on every job</button> : null}
              </div>
              )
            ) : (
              [...grouped.entries()].map(([pk, ls]) => (
                <div key={pk} style={{ display: 'grid', gap: '0.5rem' }}>
                  <div style={{ fontWeight: 600 }}>{ls[0]!.partName}{ls[0]!.manufacturer ? <span style={muted}> · {ls[0]!.manufacturer}</span> : null} <span style={muted}>· {ls.reduce((s, l) => s + l.onHand, 0)} on this job</span></div>
                  {ls.map((l) => {
                    const c = containers.find((x) => x.id === l.containerId)
                    if (!c) return null
                    return (
                      <button key={l.containerId} type="button" onClick={() => { setQuery(''); setView({ kind: 'container', id: c.id }) }} style={{ ...card, display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', font: 'inherit', textAlign: 'left', minHeight: TOUCH_MIN, color: 'var(--text-strong)' }}>
                        <span style={{ fontSize: '1.35rem', fontWeight: 800 }}>{c.label}</span>
                        <span style={muted}>{c.kind === 'unsorted' ? 'delivered' : boxKindWords(c.kind).toLowerCase()}{c.where ? ` · ${c.where}` : ''}</span>
                        <span style={{ marginLeft: 'auto', fontSize: '1.5rem', fontWeight: 800 }}>{l.onHand}</span>
                      </button>
                    )
                  })}
                </div>
              ))
            )}
            {lookingElsewhere ? <p style={{ ...muted, margin: 0 }}>Looking on every job…</p> : null}
            {everyJob ? <OfflineRetryPanel failure={desk.error ? recoveryFailureFromError(desk.raw, 'The other jobs’ boxes did not load.') : null} onRetry={desk.retry} surface="materials-on-site-phone-every-job" idempotent /> : null}
            {[...otherByJob.entries()].map(([otherId, hs]) => (
              <div key={otherId} style={{ display: 'grid', gap: '0.5rem' }} data-testid="on-site-other-job">
                <div style={{ ...muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.72rem', marginTop: '0.25rem' }}>{hs[0]!.jobLabel} · another job</div>
                {hs.map((h) => (
                  <button key={`${h.container.id}:${h.line?.partKey ?? ''}`} type="button" onClick={() => openElsewhere({ jobId: h.jobId, containerId: h.container.id })} style={{ ...card, display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', font: 'inherit', textAlign: 'left', minHeight: TOUCH_MIN, color: 'var(--text-strong)' }}>
                    <span style={{ fontSize: '1.35rem', fontWeight: 800 }}>{h.container.label}</span>
                    <span style={{ display: 'grid', minWidth: 0 }}>
                      <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.line ? h.line.partName : 'The box itself'}</span>
                      <span style={muted}>{h.container.kind === 'unsorted' ? 'delivered' : boxKindWords(h.container.kind).toLowerCase()}{h.place ? ` · ${h.place}` : ''}{h.container.where ? ` · ${h.container.where}` : ''}</span>
                    </span>
                    {h.line ? <span style={{ marginLeft: 'auto', fontSize: '1.5rem', fontWeight: 800 }}>{h.line.onHand}</span> : <span aria-hidden style={{ marginLeft: 'auto', color: 'var(--text-faint)', fontSize: '1.3rem', lineHeight: 1 }}>›</span>}
                  </button>
                ))}
              </div>
            ))}
          </>
        ) : (
          <>
            {containers.length === 0 ? (
              <div style={{ ...card, display: 'grid', gap: '0.6rem' }}>
                {/* An empty job says where the boxes are (punch list #304): it used to read as if no box existed anywhere. */}
                <EmptyState compact={others.length > 0} main={others.length > 0 ? 'No containers on this job yet.' : 'No containers on this site yet.'} next={{ label: 'Add a container', onPress: () => setSheet({ kind: 'add-container', moveAfter: null }) }} tail="adds the first with its stencil. A delivery the office lands shows here as Unsorted." />
                {others.length > 0 ? (
                  <div style={{ display: 'grid', gap: '0.5rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border)' }} data-testid="on-site-other-jobs">
                    <div style={{ fontWeight: 600 }}>{otherJobsWords(others.length)}</div>
                    {others.map((o) => (
                      <button key={o.jobId} type="button" onClick={() => openElsewhere({ jobId: o.jobId, containerId: null })} style={{ ...card, display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', font: 'inherit', textAlign: 'left', minHeight: TOUCH_MIN, color: 'var(--text-strong)', padding: '0.5rem 0.75rem' }}>
                        <span style={{ display: 'grid', minWidth: 0 }}>
                          <span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
                          <span style={muted}>{o.boxes === 1 ? '1 container' : `${o.boxes} containers`}</span>
                        </span>
                        <span aria-hidden style={{ marginLeft: 'auto', color: 'var(--text-faint)', fontSize: '1.3rem', lineHeight: 1 }}>›</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              groups.map((g) => (
                <div key={g.place?.id ?? (g.containers[0]?.kind === 'unsorted' ? 'unsorted' : 'none')} style={{ display: 'grid', gap: '0.5rem' }}>
                  {places.length > 0 && g.containers[0]?.kind !== 'unsorted' ? <div style={{ ...muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.72rem', marginTop: '0.25rem' }}>{g.place?.name ?? 'No place yet'} · {g.containers.length}</div> : null}
                  {g.containers.map((c) => {
                const ls = linesOf(lines, c.id)
                const last = lastCountedAt(movements, c.id)
                const due = c.kind !== 'unsorted' && countIsDue(last, now)
                const cannot = ls.reduce((s, l) => s + l.cannotFindSinceCount, 0)
                const parts = ls.filter((l) => l.onHand > 0).length
                // What is in it (punch list #351, PR 2): a person's words, or the app's line from the parts, which already says how many.
                const line = c.kind === 'unsorted' ? ({ text: '', by: 'none' } as BoxLine) : boxLineOf(c, lines)
                return (
                  <button key={c.id} type="button" onClick={() => setView({ kind: 'container', id: c.id })} style={{ ...card, textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'var(--text-strong)', borderColor: due || cannot ? 'var(--text-amber-800)' : 'var(--border)', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)', minHeight: TOUCH_MIN, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '0.02em' }}>{c.label}</span>
                      {stickersOn(c) ? <span style={{ ...muted, fontWeight: 600 }} title="The stickers on it" data-testid="on-site-box-stickers">· {stickersOn(c)}</span> : null}
                      <span style={{ ...muted, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.75rem', fontWeight: 600 }}>{c.kind === 'unsorted' ? 'delivered' : boxKindWords(c.kind).toLowerCase()}</span>
                      {c.where ? <span style={muted}>{c.where}</span> : null}
                    </div>
                    {line.text ? <div style={{ fontWeight: 600, marginTop: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} data-testid="on-site-box-row-line" data-by={line.by}>{line.text}</div> : null}
                    <div style={{ ...muted, marginTop: '0.15rem' }}>
                      {line.by === 'app' ? null : <><b style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{parts} {parts === 1 ? 'part' : 'parts'}</b> · </>}
                      {c.kind === 'unsorted' ? <>put them in a cage</> : <span style={due ? { color: 'var(--text-amber-700)', fontWeight: 600 } : undefined}>{lastCountWords(last, now)}</span>}
                      {cannot > 0 ? <> · <span style={{ color: 'var(--text-amber-700)', fontWeight: 600 }}>{cannot} can't find</span></> : null}
                    </div>
                    </div>
                    <span aria-hidden style={{ color: 'var(--text-faint)', fontSize: '1.5rem', lineHeight: 1 }}>›</span>
                  </button>
                )
              })}
                </div>
              ))
            )}
            {containers.length > 0 ? <button type="button" style={{ ...btn, ...btnBlock, borderStyle: 'dashed', background: 'transparent', color: 'var(--text-700)' }} onClick={() => setSheet({ kind: 'add-container', moveAfter: null })}><span aria-hidden style={{ fontSize: '1.2rem', lineHeight: 1 }}>+</span> Add a container</button> : null}
            {/* The job's reserved stickers (punch list #329, PR 3; by name since v2.7487): printed, on no box yet, from its runs. */}
            {jobStickers.blank > 0 ? <p style={{ ...muted, margin: 0, textAlign: 'center' }} data-testid="on-site-stickers-blank">{notYetOnBoxLine(jobStickers.blank, jobStickers.reserved)}</p> : null}
            {/* These are on boxes (section 10, PR 10): for whoever stuck a roll of named stickers, a range of them in one press. */}
            {jobStickers.blank > 0 ? <button type="button" style={{ ...btn, ...btnBlock, background: 'transparent', color: 'var(--text-700)' }} onClick={() => setOnBoxesOpen(true)} data-testid="on-site-on-boxes">{ON_BOXES_LABEL}</button> : null}
          </>
        )}
        {stickerFound === 'looking' ? <p style={{ ...muted, margin: 0 }} data-testid="on-site-sticker-looking">Reading the sticker…</p> : null}
        {stickerSheet}
        {onBoxesOpen && jobId && job ? <StickersOnBoxes sheet jobId={jobId} jobLabel={onSiteJobWords(job)} places={places} onClose={() => setOnBoxesOpen(false)} onPlaced={() => { void loadJob(jobId, { force: true }); jobStickers.refresh() }} /> : null}
        {sheet?.kind === 'add-container' ? <AddContainerSheet jobId={jobId} siteBoxes={siteBoxes} places={places} onClose={() => setSheet(null)} onMade={(c) => { setSheet(null); offerPin(c); setView({ kind: 'container', id: c.id }) }} /> : null}
        {sheet?.kind === 'places' ? (
          <Sheet title="Places on this site" sub={`${boxCount} ${boxCount === 1 ? 'box' : 'boxes'} in ${places.length} ${places.length === 1 ? 'place' : 'places'}. Tap a place to see only its boxes.`} onClose={closeSheet} footer={<button type="button" style={{ ...btnPrimary, ...btnBlock }} onClick={() => setSheet({ kind: 'map', focusId: null })}>Show the site map · {pinnedCount} pinned</button>}>
            <div style={{ display: 'grid', gap: '0.35rem' }}>
              {chips.map((ch) => {
                // The way to a place (punch list #372, step 4): painted once, it serves every box that stands there.
                const place = places.find((p) => p.id === ch.id) ?? null
                return (
                  <div key={ch.id} style={{ display: 'grid', gap: '0.1rem' }}>
                    <button type="button" onClick={() => { setPlaceFilter(ch.id); closeSheet() }} style={{ ...btn, ...btnBlock, justifyContent: 'space-between', fontWeight: placeFilter === ch.id ? 700 : 500 }}>{ch.name}<span style={{ ...muted, fontWeight: 600 }}>{ch.n}</span></button>
                    {place ? (
                      place.wayMapId
                        ? <button type="button" style={{ ...quiet, justifySelf: 'start', fontSize: '0.85rem' }} aria-label={`${PLACE_WAY_OPEN_PRESS} to ${place.name}`} onClick={() => { closeSheet(); openPlaceWay(place, addr || null, showToast) }}>{PLACE_WAY_OPEN_PRESS}</button>
                        : <button type="button" style={{ ...quiet, justifySelf: 'start', fontSize: '0.85rem' }} aria-label={`Paint the way to ${place.name}`} onClick={() => { closeSheet(); paintPlaceWay(place, { jobId, label: job ? onSiteJobWords(job) : '', address: addr || null, center: jobCenter }, showToast) }}>{PLACE_WAY_PAINT_PRESS}</button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </Sheet>
        ) : null}
        {sheet?.kind === 'map' ? (
          <Sheet
            fill
            title="Site map"
            sub={pinnedCount ? `${pinnedCount} of ${boxCount} boxes pinned. Tap a pin to open the box.` : 'No box is pinned yet. Press Pin a box to put the first one on the map.'}
            onClose={closeSheet}
            footer={
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button type="button" style={{ ...btnPrimary, minHeight: 48 }} onClick={() => setSheet({ kind: 'pick-box' })}>Pin a box…</button>
                  <button type="button" style={{ ...btn, minHeight: 48 }} onClick={myLocation}>Use my location</button>
                </div>
                {locating ? <p style={{ ...muted, margin: 0 }}>{locating}</p> : null}
              </>
            }
          >
            <div style={{ flex: '1 1 auto', minHeight: 0 }}>
              <Suspense fallback={<p style={muted}>Loading the map…</p>}>
                <OnSiteMapLazy center={jobCenter} pins={mapPins} height="100%" focusId={sheet.focusId} flyTo={mapFly} onPinTap={(id) => { closeSheet(); setView({ kind: 'container', id }) }} painted={painted.maps} onPaintedTap={(id) => openPaintedMap(id)} />
              </Suspense>
            </div>
          </Sheet>
        ) : null}
        {sheet?.kind === 'pick-box' ? <PickBoxSheet containers={containers.filter((c) => c.kind !== 'unsorted')} places={places} onClose={closeSheet} onPick={(c) => { setPinCenter(null); setSheet({ kind: 'pin', container: c }) }} /> : null}
        {pinSheet}
        {jobSheet}
        {scanOpen ? <ScanLabelWindow onClose={() => setScanOpen(false)} onOpen={(code) => { setScanOpen(false); navigate(boxPagePath(code)) }} /> : null}
      </div>
    )
  }

  // ── a container, or its count ───────────────────────────────────────────────────────────────
  const container = containers.find((c) => c.id === view.id)
  if (!container) {
    return (
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <p style={muted}>That container is not on this job any more.</p>
        <button type="button" style={btn} onClick={() => setView({ kind: 'containers' })}>Back to the containers</button>
      </div>
    )
  }
  const ls = linesOf(lines, container.id)
  const last = lastCountedAt(movements, container.id)
  const due = container.kind !== 'unsorted' && countIsDue(last, now)
  const photos = listPhotos(jobId).filter((p) => p.containerId === container.id)
  const after = lastAct && lastAct.containerId === container.id && actIsFresh(lastAct.at, Date.now()) ? lastAct.what : null
  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
      <button type="button" aria-label="Back to the containers" onClick={() => { setSheet(null); setView({ kind: 'containers' }) }} style={{ ...btn, width: TOUCH_MIN, padding: 0, fontSize: '1.25rem' }}>‹</button>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{containerWords(container)}{stickersOn(container) ? <span style={{ ...muted, fontWeight: 600, fontSize: '1rem' }} title="The stickers on it" data-testid="on-site-box-header-stickers"> · {stickersOn(container)}</span> : null}</div>
        <div style={muted}>{container.where ? `${container.where} · ` : ''}{ls.filter((l) => l.onHand > 0).length} parts · <span style={due ? { color: 'var(--text-amber-700)', fontWeight: 600 } : undefined}>{container.kind === 'unsorted' ? 'put them in a cage' : lastCountWords(last, now)}</span></div>
      </div>
      {/* Edit a box (v2.7179): its name, its kind and its where line, from the box's own screen. Never Unsorted, the app's own row. */}
      {container.kind !== 'unsorted' ? <button type="button" style={{ ...chip, marginLeft: 'auto', flex: 'none' }} aria-label={editBoxTitle(container)} onClick={() => setSheet({ kind: 'edit-box', container })}>Edit</button> : null}
    </div>
  )

  if (view.kind === 'take') {
    const run = take && take.containerId === container.id ? take : null
    if (!run) {
      return (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {header}
          <p style={{ ...muted, margin: 0 }}>This take is closed.</p>
          <button type="button" style={btn} onClick={() => setView({ kind: 'container', id: container.id })}>Back to {container.label}</button>
        </div>
      )
    }
    const before = listPhotos(jobId).find((p) => p.takeId === run.id && p.kind === 'before') ?? null
    if (run.savedAt) {
      return <TakeAfterScreen container={container} run={run} busy={takeBusy} onShoot={() => openCamera('after')} onFinish={() => endTake(run, container, false)} />
    }
    return (
      <>
        <TakeScreen
          container={container}
          lines={ls}
          run={run}
          before={before}
          busy={takeBusy}
          narrow={narrow}
          onBack={() => setView({ kind: 'container', id: container.id })}
          onDrop={() => dropTake(container, run)}
          onShootBefore={() => openCamera('before')}
          onMark={(key, n) => putTake(takeMark(run, key, n))}
          onOther={() => setSheet({ kind: 'take-other', container })}
          onRemoveExtra={(i) => putTake(takeRemoveExtra(run, i))}
          onSave={() => saveTake(container)}
        />
        {sheet?.kind === 'take-other' ? (
          <AddPartSheet container={container} names={onHandNames(lines, containers)} searchParts={searchParts} words={{ title: 'What did you take?', sub: `It is not on ${container.label}'s list. The office will see it was there.`, press: (n) => `Add ${n} to the take` }} onClose={() => setSheet(null)} onAdd={(part, n) => { putTake(takeAddExtra(run, { ...part, n })); setSheet(null) }} />
        ) : null}
      </>
    )
  }

  if (view.kind === 'count') {
    // The walk's own list, fixed at its start (v2.7161): a line counted to none used to leave a list re-read on every
    // step, and the walk stepped over the line after it.
    const total = view.keys.length
    const at = countWalkAt(view.keys, view.index, ls)
    const done = (corrected: number) => {
      showToast(`${container.label} counted. ${total} ${total === 1 ? 'line' : 'lines'}, ${corrected} corrected.`, 'success')
      setLastAct({ containerId: container.id, what: 'Count', at: Date.now() })
      offerPin(container)
      setView({ kind: 'container', id: container.id })
    }
    if (!at) return null
    const { line, index: idx } = at
    const advance = (corrected: boolean) => {
      const sum = view.corrected + (corrected ? 1 : 0)
      if (idx + 1 >= total) done(sum)
      else setView({ kind: 'count', id: container.id, keys: view.keys, index: idx + 1, corrected: sum })
    }
    return (
      <CountWalk key={line.partKey} container={container} line={line} index={idx} total={total} onRight={() => { write('counted', line, line.onHand, container.id, null); advance(false) }} onSave={(n) => { write('counted', line, n, container.id, null); advance(n !== line.onHand) }} onSkip={() => advance(false)} onGone={() => { write('counted', line, 0, container.id, null); advance(line.onHand !== 0) }} onStop={() => setView({ kind: 'container', id: container.id })} />
    )
  }

  const others = containers.filter((c) => c.id !== container.id && c.kind !== 'unsorted')
  const unsorted = container.kind === 'unsorted'
  const touched = ls.reduce<{ at: string; by: string } | null>((best, l) => (l.lastTouchedAt && (!best || l.lastTouchedAt > best.at) ? { at: l.lastTouchedAt, by: l.lastTouchedBy ?? '' } : best), null)
  const boxLineNow = boxLineOf(container, lines)
  const leftRun = unsorted ? null : readTakeRun(jobId, container.id, Date.now())
  const loosePhotos = photos.filter((p) => !p.takeId)
  const boxTakes = takesOf(movements, listPhotos(jobId)).filter((t) => t.containerId === container.id)
  const leftRunWords = leftRun ? takeLeftWords(leftRun, container.label) : { main: '', sub: '', go: '', drop: '' }
  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      {header}
      {/* Take from a box: a run started on this box and left, offered again. After twelve hours it is forgotten. */}
      {leftRun ? (
        <div role="group" aria-label={leftRunWords.main} style={leftStrip} data-testid="on-site-take-left">
          <span><b>{leftRunWords.main}</b> {leftRunWords.sub}</span>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" style={btnPrimary} onClick={() => resumeTake(container, leftRun)}>{leftRun.savedAt ? <CameraGlyph size={16} /> : null}{leftRunWords.go}</button>
            <button type="button" style={btn} onClick={() => dropTake(container, leftRun)}>{leftRunWords.drop}</button>
          </div>
        </div>
      ) : null}
      {pinAsk === container.id && boxWantsPin(container, now) ? <PinAskStrip container={container} byName={byName} onPinned={(words) => { setPinAsk(null); showToast(words, 'success') }} onLater={() => setPinAsk(null)} /> : null}
      {/* What is in it (punch list #351, PR 2): the app's line from the parts until a person says it better. Never Unsorted, the app's own row. */}
      {container.kind !== 'unsorted' ? (
        <div style={{ display: 'grid', gap: '0.2rem' }} data-testid="on-site-box-line" data-by={boxLineNow.by}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {boxLineNow.text ? <span style={{ fontWeight: 600, fontSize: '1.05rem', minWidth: 0, overflowWrap: 'anywhere' }}>{boxLineNow.text}</span> : null}
            {boxLineNow.by === 'app' ? <span style={{ ...muted, fontSize: '0.75rem' }}>{BOX_LINE_FROM_PARTS}</span> : null}
            <button type="button" style={{ ...chip, marginLeft: boxLineNow.text ? 'auto' : 0, flex: 'none' }} aria-label={`${sayItBetterPress(boxLineNow)}: ${sayItBetterTitle(container)}`} onClick={() => setSheet({ kind: 'say-line', container })}>{sayItBetterPress(boxLineNow)}</button>
          </div>
          {boxLineNow.by === 'person' ? <span style={muted}>{BOX_LINE_SAID_NOTE}</span> : null}
        </div>
      ) : null}
      {container.kind !== 'unsorted' ? (
        <div style={{ display: 'grid', gap: '0.35rem', ...muted }}>
          <span>At <b style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{placeName(places, container.locationId)}</b>{container.where ? `, ${container.where}` : ''}{boxPinShort(container, new Date()) ? ` · ${boxPinShort(container, new Date())}` : ''}</span>
          {/* Three chips on one line at 375 (v2.6229): a three-column grid and short words; the words that were cut live on the chips' aria-labels. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.4rem' }}>
            <button type="button" style={chip} aria-label={`Move ${container.label} to another place`} onClick={() => setSheet({ kind: 'move-box', container })}>Move box</button>
            {/* Where is it? (punch list #372): one chip, pinned or not. The map to drag lives inside its sheet as Move the pin by hand. */}
            <button type="button" style={{ ...chip, gap: '0.3rem' }} aria-label={whereIsBoxTitle(container.label)} onClick={() => setSheet({ kind: 'where', container })}><span aria-hidden>◎</span>{WHERE_IS_IT_PRESS}</button>
            <PhotoPress jobId={jobId} containerId={container.id} containerLabel={container.label} after={after} byUserId={byUserId} byName={byName} onToast={showToast} onTaken={() => offerPin(container)} style={{ ...chip, gap: '0.35rem', ...(after ? { borderColor: BLUE, color: BLUE } : {}) }} />
          </div>
        </div>
      ) : null}
      {/* A take's two photos are drawn with their take, under the parts (v2.7828); the box's other photos stay here. */}
      {loosePhotos.length > 0 ? <BoxPhotos photos={loosePhotos} canAct onToast={showToast} /> : null}
      {countWalkKeys(ls).length > 0 && container.kind !== 'unsorted' ? <button type="button" style={{ ...btnPrimary, ...btnBlock }} onClick={() => setView({ kind: 'count', id: container.id, keys: countWalkKeys(ls), index: 0, corrected: 0 })}>Count this box</button> : null}
      {ls.length === 0 ? <EmptyState compact main={`Nothing in ${container.label} yet.`} next={{ label: `Add a part to ${container.label}`, onPress: () => setSheet({ kind: 'add-part', container }) }} tail="adds the first, or move one in from another container." /> : null}
      {ls.map((l) => (
        <div key={l.partKey} style={{ ...card, borderColor: l.cannotFindSinceCount > 0 || (l.lastCountDiff ?? 0) < 0 ? 'var(--text-amber-800)' : 'var(--border)', display: 'grid', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{l.partName}</div>
              <div style={muted}>
                {l.manufacturer ?? ''}
                {l.cannotFindSinceCount > 0 ? ` · ${l.cannotFindSinceCount} can't find` : ''}
                {(l.lastCountDiff ?? 0) < 0 ? ` · ${-(l.lastCountDiff ?? 0)} missing at the last count` : ''}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: '1.7rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{l.onHand}</div>
          </div>
          {l.onHand <= 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={muted}>{container.label} has none left.</span>
              {/* Short (v2.6742): a line with none left is the one most often short, so the ask stays. */}
              <button type="button" style={{ ...btn, minHeight: 40, padding: '0 0.7rem', fontSize: '0.8rem', marginLeft: 'auto', borderColor: BLUE, color: BLUE }} onClick={() => setSheet({ kind: 'short', line: l, container })}>Short</button>
            </div>
          ) : (
          <div style={{ display: 'grid', gridTemplateColumns: narrow ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: '0.3rem' }}>
            {unsorted ? <button type="button" style={{ ...btn, padding: '0 0.15rem', fontSize: '0.8rem', minWidth: 0, borderColor: BLUE, color: BLUE }} disabled={l.onHand <= 0} onClick={() => setSheet({ kind: 'move', line: l, container })}>Put in…</button> : null}
            <button type="button" style={{ ...btn, padding: '0 0.15rem', fontSize: '0.8rem', minWidth: 0 }} disabled={l.onHand <= 0} onClick={() => setSheet({ kind: 'qty', reason: 'used', line: l, container })}>Used</button>
            {!unsorted ? <button type="button" style={{ ...btn, padding: '0 0.15rem', fontSize: '0.8rem', minWidth: 0 }} disabled={l.onHand <= 0} onClick={() => setSheet({ kind: 'move', line: l, container })}>Move to…</button> : null}
            <button type="button" style={{ ...btn, padding: '0 0.15rem', fontSize: '0.8rem', minWidth: 0, color: 'var(--text-amber-800)', borderColor: 'var(--text-amber-800)' }} disabled={l.onHand <= 0} onClick={() => setSheet({ kind: 'qty', reason: 'cannot_find', line: l, container })}>Can't find</button>
            {/* Short (v2.6742): the Job Parts Tally's request for more, filed from the line, so what we have and what we need are one screen. */}
            <button type="button" style={{ ...btn, padding: '0 0.15rem', fontSize: '0.8rem', minWidth: 0, borderColor: BLUE, color: BLUE }} onClick={() => setSheet({ kind: 'short', line: l, container })}>Short</button>
          </div>
          )}
        </div>
      ))}
      <button type="button" style={{ ...btn, ...btnBlock }} onClick={() => setSheet({ kind: 'add-part', container })}>Add a part to {container.label}</button>
      {/* What was taken from this box, with its pictures (v2.7828): under the parts, which a person at the box reads first. */}
      {boxTakes.length > 0 ? <TakesPanel heading={`Taken from ${container.label}`} takes={boxTakes} labelOf={() => container.label} limit={2} /> : null}
      {container.kind !== 'unsorted' ? (
        /* The box's paper and its retirement (v2.6366): the two prints are a pair of pill presses with the printer glyph, one row under a caption, and Retire sits apart on its own line so a thumb reaching for a print never lands on it. Both print here since punch list #304: the office page they used to open is not every role's. */
        <div style={{ display: 'grid', gap: '0.5rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border)' }}>
          <span style={muted}>Paper for {container.label}</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.4rem' }}>
            <button type="button" aria-label={`Print the label for ${container.label}`} style={paperPress} onClick={() => setPaper({ kind: 'label', id: container.id })}><PrinterGlyph />Print the label</button>
            <button type="button" aria-label={`Print the manifest for ${container.label}`} style={paperPress} onClick={() => setPaper({ kind: 'manifest', id: container.id })}><PrinterGlyph />Print the manifest</button>
          </div>
          {/* v2.6800 (punch list #294): the label's address on the clipboard, for a QR typed into Brother's phone app at the cage; the printer reads the dash either way. */}
          <button type="button" aria-label={`Copy the label code for ${container.label}`} style={{ ...paperPress, width: '100%' }} onClick={() => { void navigator.clipboard.writeText(boxClipboardWords(container.id)).then(() => showToast(copiedLabelWords(container.id), 'success'), (e: unknown) => showToast(`The code did not copy: ${formatErrorMessage(e)}`, 'error')) }}>Copy the label code</button>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', ...muted }}>
            <span>Done with this {container.kind === 'cage' ? 'cage' : 'box'}?</span>
            <button type="button" style={{ ...quiet, color: 'var(--text-muted)', fontSize: '0.9rem' }} onClick={() => setSheet({ kind: 'retire', container })}>Retire {container.label}</button>
          </div>
        </div>
      ) : null}

      {sheet?.kind === 'short' ? (
        <QtySheet
          title="How many more do you need?"
          sub={`${sheet.line.partName}. The office gets the Tally's request for more, as Send to Office files it.`}
          max={SHORT_MAX}
          quick
          note={false}
          label={shortLabel}
          after={(n) => shortAfterWords(sheet.container.label, sheet.line.onHand, n)}
          onClose={() => setSheet(null)}
          onSave={(n) => {
            const { line } = sheet
            setSheet(null)
            if (!jobId || !byUserId) {
              showToast('Sign in again to ask the office for parts.', 'error')
              return
            }
            void sendShortRequest(shortRequestRow({ jobId, line, n, byUserId }))
              .then((outcome) => showToast(shortToast(n, line.partName, outcome), 'success'))
              .catch((e) => showToast(shortRefusalWords(formatErrorMessage(e, 'The request did not reach the office.'), n, line.partName), 'error'))
          }}
        />
      ) : null}
      {paper?.kind === 'label' ? <LabelsPrintModal jobLabel={onSiteJobWords(job)} containers={containers.filter((c) => c.kind !== 'unsorted')} lines={lines} places={places} only={paper.id} onClose={() => setPaper(null)} /> : null}
      {paper?.kind === 'manifest' ? <ManifestPrintModal jobLabel={onSiteJobWords(job)} site={job.job_address?.trim() ?? ''} containers={containers} lines={lines} movements={movements} places={places} only={paper.id} onClose={() => setPaper(null)} /> : null}
      {sheet?.kind === 'qty' ? (
        <QtySheet title={sheet.reason === 'used' ? 'How many did you use?' : "How many can't you find?"} sub={`${sheet.line.partName} from ${sheet.container.label}. ${sheet.container.label} has ${sheet.line.onHand}.`} max={sheet.line.onHand} quick={sheet.reason === 'used'} note label={(n) => pressLabel(sheet.reason, n)} after={(n) => leftWords(sheet.container.label, sheet.line.onHand, n)} onClose={() => setSheet(null)} onSave={(n, note) => { write(sheet.reason, sheet.line, n, sheet.container.id, null, note); setSheet(null); showToast(sheet.reason === 'used' ? `${n} used from ${sheet.container.label}. ${sheet.container.label} ${sheet.line.onHand - n <= 0 ? 'has none left' : `has ${sheet.line.onHand - n} left`}.` : `${n} marked can't find in ${sheet.container.label}. The office sees it.`, 'success') }} />
      ) : null}
      {sheet?.kind === 'move' ? (
        <MoveSheet line={sheet.line} from={sheet.container} others={others} onClose={() => setSheet(null)} onMove={(n, to) => { write('moved', sheet.line, n, sheet.container.id, to.id); setLastAct({ containerId: to.id, what: sheet.container.kind === 'unsorted' ? 'Put in' : 'Move', at: Date.now() }); setSheet(null); showToast(`Moved ${n} to ${to.label}.`, 'success') }} onTaken={(n, where) => { write('taken', sheet.line, n, sheet.container.id, null, where); setSheet(null); showToast(`Took ${n} to ${where}.`, 'success') }} onReturned={(n) => { write('returned', sheet.line, n, sheet.container.id, null); setSheet(null); showToast(`${n} going back to the supply house. The office will expect a credit.`, 'success') }} onDamaged={(n) => { write('damaged', sheet.line, n, sheet.container.id, null); setSheet(null); showToast(`${n} marked damaged.`, 'success') }} onNewContainer={(n) => setSheet({ kind: 'add-container', moveAfter: { line: sheet.line, qty: n, from: sheet.container } })} />
      ) : null}
      {sheet?.kind === 'add-part' ? (
        <AddPartSheet container={sheet.container} names={onHandNames(lines, containers)} searchParts={searchParts} onClose={() => setSheet(null)} onAdd={(part, n) => { write('delivered', part, n, null, sheet.container.id, 'added on site'); setLastAct({ containerId: sheet.container.id, what: 'Add a part', at: Date.now() }); setSheet(null); showToast(`${n} ${part.partName} added to ${sheet.container.label}.`, 'success') }} />
      ) : null}
      {sheet?.kind === 'add-container' ? (
        <AddContainerSheet jobId={jobId} siteBoxes={siteBoxes} places={places} onClose={() => setSheet(null)} onMade={(c) => { const mv = sheet.moveAfter; setSheet(null); if (mv) { write('moved', mv.line, mv.qty, mv.from.id, c.id); showToast(`Moved ${mv.qty} to ${c.label}.`, 'success') } else { offerPin(c); setView({ kind: 'container', id: c.id }) } }} />
      ) : null}
      {pinSheet}
      {stickerSheet}
      {sheet?.kind === 'where' ? (() => {
        const live = containers.find((c) => c.id === sheet.container.id) ?? sheet.container
        return (
          <Sheet title={whereIsBoxTitle(live.label)} onClose={closeSheet}>
            <WhereIsBox touch container={live} containers={containers} places={places} moves={listContainerMoves(jobId)} movements={movements} photos={listPhotos(jobId)} jobCenter={jobCenter} jobAddress={addr} painted={painted.maps} byName={byName} onMoveBox={() => { closeSheet(); setSheet({ kind: 'move-box', container: live }) }} onOpenWay={(id) => { closeSheet(); openPaintedMap(id, addr || null) }} onSendSomeone={addTask ? (task) => { closeSheet(); addTask.openAddModal({ preset: task }) } : undefined} />
          </Sheet>
        )
      })() : null}
      {sheet?.kind === 'move-box' ? <MoveBoxSheet jobId={jobId} container={sheet.container} places={places} byName={byName} onClose={() => setSheet(null)} onMoved={(name) => { setSheet(null); showToast(`${sheet.container.label} is now at ${name}.`, 'success') }} /> : null}
      {sheet?.kind === 'say-line' ? <SayLineSheet container={containers.find((c) => c.id === sheet.container.id) ?? sheet.container} line={boxLineOf(containers.find((c) => c.id === sheet.container.id) ?? sheet.container, lines)} appLine={boxLineFromParts(linesOf(lines, sheet.container.id))} onClose={() => setSheet(null)} onSaved={(words) => { setSheet(null); showToast(words, 'success') }} /> : null}
      {sheet?.kind === 'edit-box' ? (
        <Sheet title={editBoxTitle(sheet.container)} onClose={() => setSheet(null)}>
          <BoxTabs touch container={sheet.container} containers={containers} siteBoxes={siteBoxes} places={places} lines={lines} byName={byName} byUserId={byUserId} onSaved={(words) => { setSheet(null); showToast(words, 'success') }} />
        </Sheet>
      ) : null}
      {sheet?.kind === 'retire' ? (
        <Sheet title={`Retire ${sheet.container.label}?`} onClose={() => setSheet(null)}>
          {ls.some((l) => l.onHand > 0) ? (
            <p style={{ margin: 0 }}>{sheet.container.label} still has parts in it. Move them or mark them used first, then retire it.</p>
          ) : (
            <>
              <p style={{ margin: 0, ...muted }}>The {sheet.container.kind === 'cage' ? 'cage' : 'box'} leaves this job. The next job gets its own {sheet.container.label}.</p>
              <button type="button" style={{ ...btnPrimary, ...btnBlock }} onClick={() => { const box = sheet.container; retireContainer(box.id); setSheet(null); setView({ kind: 'containers' }); showActionToast(retiredWords(box), { label: undoRetireLabel, onClick: () => { const v = unretireVerdict(listContainers(jobId), box.id); if (!v.ok) { showToast(v.words, 'warning'); return } unretireContainer(box.id); showToast(broughtBackWords(box), 'success') } }, { durationMs: UNDO_RETIRE_MS }) }}>Retire {sheet.container.label}</button>
            </>
          )}
        </Sheet>
      ) : null}
      {/* Take from a box: the run's press stays under a thumb however far the box scrolls. Never Unsorted, whose parts are put away, not taken. */}
      {!unsorted && !leftRun ? (
        <div style={takeBar} data-testid="on-site-take-bar">
          <button type="button" style={{ ...btnPrimary, ...btnBlock, minHeight: 56, fontSize: '1.05rem' }} onClick={() => startTake(container)}><CameraGlyph size={18} />{takeStartLabel(container.label)}</button>
          <span style={{ ...muted, textAlign: 'center' }}>The camera opens for a photo of {container.label} as found.</span>
        </div>
      ) : null}
      {touched ? <p style={{ ...muted, fontSize: '0.75rem', margin: 0 }}>Last touched {new Date(touched.at).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })} by {touched.by}.</p> : null}
    </div>
  )
}

// ── the sheets ────────────────────────────────────────────────────────────────────────────────

function Stepper({ n, max, onChange }: { n: number; max: number; onChange: (n: number) => void }) {
  const stepBtn: CSSProperties = { ...btn, width: 56, height: 56, padding: 0, fontSize: '1.5rem', borderRadius: 12 }
  // What is in the field while it is typed in; null when it shows `n`. Clearing the field used to put the 1 back at
  // once (v2.7252), so 25 could not be typed over it. A press of − or +, a quick number or leaving the field shows `n`.
  const [typed, setTyped] = useState<string | null>(null)
  useEffect(() => { setTyped(null) }, [n])
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.9rem' }}>
      <button type="button" aria-label="One fewer" style={{ ...stepBtn, ...dis(n <= 1) }} disabled={n <= 1} onClick={() => onChange(Math.max(1, n - 1))}>−</button>
      <input type="number" inputMode="numeric" value={typed ?? n} min={1} max={max} aria-label="How many" onChange={(e) => { setTyped(stepperKeeps(e.target.value, max)); const v = stepperTyped(e.target.value, max); if (v != null) onChange(v) }} onBlur={() => setTyped(null)} style={{ ...input, width: 96, textAlign: 'center', fontSize: '2rem', fontWeight: 800, minHeight: 56 }} />
      <button type="button" aria-label="One more" style={{ ...stepBtn, ...dis(n >= max) }} disabled={n >= max} onClick={() => onChange(Math.min(max, n + 1))}>+</button>
    </div>
  )
}

/**
 * Take from a box: what was taken, between the two photos (`lib/materials/takeRun.ts`). A box with one kind of part
 * asks only how many, on the number sheet's own stepper, opened on 1. A box with more lists what it holds: a tap takes
 * one, and the quick numbers open in the row. The press at the bottom names its count and opens the camera again.
 */
function TakeScreen({ container, lines, run, before, busy, narrow, onBack, onDrop, onShootBefore, onMark, onOther, onRemoveExtra, onSave }: { container: Container; lines: ContainerLine[]; run: TakeRun; before: PhotoNote | null; busy: string | null; narrow: boolean; onBack: () => void; onDrop: () => void; onShootBefore: () => void; onMark: (partKey: string, n: number) => void; onOther: () => void; onRemoveExtra: (index: number) => void; onSave: () => void }) {
  const label = container.label
  const one = takeIsOnePart(lines)
  const only = one ? lines[0]! : null
  const total = takeTotal(run)
  const step = (on: 'done' | 'now' | 'next' | 'miss'): CSSProperties => ({ fontSize: '0.72rem', fontWeight: 700, textAlign: 'center', padding: '0.35rem 0.15rem', borderRadius: 999, borderWidth: 1, borderStyle: 'solid', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...(on === 'now' ? { background: BLUE, borderColor: BLUE, color: '#fff' } : on === 'done' ? { background: 'var(--surface)', borderColor: 'var(--text-green-700)', color: 'var(--text-green-700)' } : on === 'miss' ? { background: 'var(--surface)', borderColor: 'var(--text-amber-800)', color: 'var(--text-amber-800)' } : { background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-muted)' }) })
  const quick = (on: boolean): CSSProperties => ({ ...btn, minHeight: 44, padding: '0 0.15rem', fontSize: '0.9rem', minWidth: 0, ...(on ? { background: 'var(--text-strong)', color: 'var(--bg-page)', borderColor: 'var(--text-strong)' } : {}) })
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.75rem' }} data-testid="on-site-take">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <button type="button" aria-label={`Back to ${label}`} onClick={onBack} style={{ ...btn, width: TOUCH_MIN, padding: 0, fontSize: '1.25rem', flex: 'none' }}>‹</button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{takeStartLabel(label)}</div>
          <div style={muted}>{one ? 'Take your parts out. Then say how many.' : 'Tap a part to take one. Tap again for more.'}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.25rem' }} aria-hidden>
        <span style={step(before ? 'done' : 'miss')}>{before ? '✓ As found' : 'Photo missing'}</span>
        <span style={step('now')}>{one ? 'How many' : 'Tap what you take'}</span>
        <span style={step('next')}>Photo after</span>
      </div>
      {before ? (
        <BoxPhotos photos={[before]} canAct={false} size={64} />
      ) : busy ? (
        <p style={{ ...muted, margin: 0 }} role="status">{busy}</p>
      ) : (
        <div role="group" aria-label={`${label} has no photo as found`} style={leftStrip}>
          <span><b>{label} has no photo as found.</b> You can go on without it.</span>
          <button type="button" style={{ ...btn, justifySelf: 'start' }} onClick={onShootBefore}><CameraGlyph size={16} />Take the photo</button>
        </div>
      )}
      {lines.length === 0 && run.extras.length === 0 ? <EmptyState compact main={`Nothing is listed in ${label}.`} next={{ label: 'Something not on the list…', onPress: onOther }} tail="says what you took." /> : null}
      {only ? (() => {
        const n = run.marks[only.partKey] ?? 0
        const quicks = takeQuicks(only.onHand)
        return (
          <div style={{ ...card, display: 'grid', gap: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>How many are you taking?</div>
              <div style={muted}>{only.partName}. {label} has {Math.max(0, only.onHand)}.</div>
            </div>
            <Stepper n={Math.max(1, n)} max={TAKE_MAX} onChange={(v) => onMark(only.partKey, v)} />
            {quicks.length > 0 || only.onHand > 1 ? (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${quicks.length + (only.onHand > 1 ? 1 : 0)}, minmax(0, 1fr))`, gap: '0.35rem' }}>
                {quicks.map((q) => <button key={q} type="button" style={quick(q === n)} onClick={() => onMark(only.partKey, q)}>{q}</button>)}
                {only.onHand > 1 ? <button type="button" style={quick(n === only.onHand)} onClick={() => onMark(only.partKey, only.onHand)}>All {only.onHand}</button> : null}
              </div>
            ) : null}
            <p style={{ ...muted, margin: 0, textAlign: 'center' }} data-testid="on-site-take-hint">{takeLineHint(label, only.onHand, n)}</p>
          </div>
        )
      })() : lines.map((l) => {
        const n = run.marks[l.partKey] ?? 0
        const quicks = takeQuicks(l.onHand, [2, 5, 10])
        return (
          <div key={l.partKey} style={{ display: 'grid', gap: '0.35rem', gridTemplateColumns: 'minmax(0, 1fr)' }}>
            <button type="button" aria-label={`Take one ${l.partName}`} onClick={() => onMark(l.partKey, n + 1)} style={{ ...card, display: 'flex', alignItems: 'center', gap: '0.6rem', minHeight: 64, textAlign: 'left', font: 'inherit', cursor: 'pointer', color: 'var(--text-strong)', ...(n > 0 ? { borderColor: BLUE, background: 'var(--bg-blue-tint)', boxShadow: `inset 4px 0 0 ${BLUE}` } : {}) }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 600 }}>{l.partName}</span>
                <span style={{ display: 'block', fontSize: '0.82rem', color: n > 0 ? 'var(--text-blue-700)' : 'var(--text-muted)', fontWeight: n > 0 ? 600 : 400 }}>{takeLineHint(label, l.onHand, n)}</span>
              </span>
              {n > 0 ? <span style={{ marginLeft: 'auto', fontSize: '1.7rem', fontWeight: 800, color: 'var(--text-blue-700)', fontVariantNumeric: 'tabular-nums', flex: 'none' }}>{n}</span> : <span aria-hidden style={{ marginLeft: 'auto', width: 44, height: 44, borderRadius: 999, border: '1px dashed var(--border-strong)', color: 'var(--text-faint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flex: 'none' }}>+</span>}
            </button>
            {n > 0 ? (
              <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(0, 1fr)', gap: '0.3rem' }}>
                <button type="button" aria-label={`One fewer ${l.partName}`} style={quick(false)} onClick={() => onMark(l.partKey, n - 1)}>−</button>
                {(narrow ? quicks.slice(0, 2) : quicks).map((q) => <button key={q} type="button" aria-label={`Take ${q} ${l.partName}`} style={quick(q === n)} onClick={() => onMark(l.partKey, q)}>{q}</button>)}
                {l.onHand > 1 ? <button type="button" aria-label={`Take all ${l.onHand} ${l.partName}`} style={quick(n === l.onHand)} onClick={() => onMark(l.partKey, l.onHand)}>All {l.onHand}</button> : null}
              </div>
            ) : null}
          </div>
        )
      })}
      {run.extras.map((e, i) => (
        <div key={`${e.partName}:${i}`} style={{ ...card, display: 'flex', alignItems: 'center', gap: '0.6rem', borderColor: BLUE, background: 'var(--bg-blue-tint)' }}>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 600 }}>{e.partName}</span>
            <span style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-blue-700)', fontWeight: 600 }}>Taking {e.n}. Not on {label}&rsquo;s list.</span>
          </span>
          <button type="button" aria-label={`Take ${e.partName} off the take`} style={{ ...btn, marginLeft: 'auto', width: TOUCH_MIN, padding: 0, fontSize: '1.25rem', flex: 'none' }} onClick={() => onRemoveExtra(i)}>−</button>
        </div>
      ))}
      {lines.length > 0 || run.extras.length > 0 ? <button type="button" style={{ ...quiet, justifySelf: 'start' }} onClick={onOther}>Something not on the list…</button> : null}
      <div style={takeBar}>
        <button type="button" style={{ ...btnPrimary, ...btnBlock, minHeight: 56, fontSize: '1.05rem', ...dis(total === 0) }} disabled={total === 0} onClick={onSave} data-testid="on-site-take-save">{total > 0 ? <CameraGlyph size={18} /> : null}{takeSaveLabel(run, label, one)}</button>
        {total > 0 ? <span style={{ ...muted, textAlign: 'center' }}>The camera opens next, for the photo after.</span> : <button type="button" style={{ ...quiet, justifySelf: 'center' }} onClick={onDrop}>Close. Nothing taken.</button>}
      </div>
    </div>
  )
}

/** Take from a box: the take is saved and only the photo after is owed. Reached when the camera was closed with no shot. */
function TakeAfterScreen({ container, run, busy, onShoot, onFinish }: { container: Container; run: TakeRun; busy: string | null; onShoot: () => void; onFinish: () => void }) {
  const label = container.label
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.75rem' }} data-testid="on-site-take-after">
      <div>
        <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{run.savedCount} taken from {label}</div>
        <div style={muted}>The take is saved.</div>
      </div>
      {busy ? (
        <p style={{ ...muted, margin: 0 }} role="status">{busy}</p>
      ) : (
        <div role="group" aria-label={`${label} has no photo after`} style={leftStrip}>
          <span><b>{label} has no photo after.</b> Take it now, or finish without it.</span>
          <button type="button" style={{ ...btnPrimary, ...btnBlock, minHeight: 56, fontSize: '1.05rem' }} onClick={onShoot}><CameraGlyph size={18} />Take the photo</button>
          <button type="button" style={{ ...btn, ...btnBlock }} onClick={onFinish}>Finish without it</button>
        </div>
      )}
    </div>
  )
}

function QtySheet({ title, sub, max, quick, note, label, after, onClose, onSave }: { title: string; sub: string; max: number; quick: boolean; note: boolean; label: (n: number) => string; after: (n: number) => string; onClose: () => void; onSave: (n: number, note: string) => void }) {
  const [n, setN] = useState(Math.min(1, Math.max(1, max)))
  const [text, setText] = useState('')
  const quicks = [1, 2, 5, 10].filter((q) => q <= max)
  return (
    <Sheet title={title} sub={sub} onClose={onClose}>
      <Stepper n={n} max={max} onChange={setN} />
      {quick && quicks.length > 1 ? (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${quicks.length}, 1fr)`, gap: '0.35rem' }}>
          {quicks.map((q) => (
            <button key={q} type="button" style={{ ...btn, minHeight: 44, ...(q === n ? { background: 'var(--text-strong)', color: 'var(--bg-page)', borderColor: 'var(--text-strong)' } : {}) }} onClick={() => setN(q)}>{q}</button>
          ))}
        </div>
      ) : null}
      {note ? <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a note if you want" aria-label="A note" style={input} /> : null}
      <button type="button" style={{ ...btnPrimary, ...btnBlock, minHeight: 52 }} onClick={() => onSave(n, text)}>{label(n)}</button>
      {after(n) ? <p style={{ ...muted, margin: 0, textAlign: 'center' }}>{after(n)}</p> : null}
    </Sheet>
  )
}

function MoveSheet({ line, from, others, onClose, onMove, onTaken, onReturned, onDamaged, onNewContainer }: { line: ContainerLine; from: Container; others: Container[]; onClose: () => void; onMove: (n: number, to: Container) => void; onTaken: (n: number, where: string) => void; onReturned: (n: number) => void; onDamaged: (n: number) => void; onNewContainer: (n: number) => void }) {
  const [n, setN] = useState(Math.min(line.onHand, Math.max(1, line.onHand)))
  const dest: CSSProperties = { ...btn, ...btnBlock, justifyContent: 'space-between', fontWeight: 600, textAlign: 'left', gap: '0.75rem' }
  const small: CSSProperties = { ...muted, fontWeight: 500, textAlign: 'right', flex: '0 1 auto' }
  return (
    <Sheet title={`${from.kind === 'unsorted' ? 'Put' : 'Move'} ${n} ${from.kind === 'unsorted' ? 'in' : 'to'}…`} sub={`${line.partName}, from ${from.label}. Change the number first if it is not ${n}.`} onClose={onClose}>
      <Stepper n={n} max={line.onHand} onChange={setN} />
      <div style={{ display: 'grid', gap: '0.35rem' }}>
        {others.map((c) => (
          <button key={c.id} type="button" style={dest} onClick={() => onMove(n, c)}>{containerWords(c)}<span style={small}>{c.where}</span></button>
        ))}
        <button type="button" style={dest} onClick={() => onTaken(n, 'the truck')}>The truck</button>
        <button type="button" style={dest} onClick={() => onTaken(n, 'the shop')}>The shop</button>
        <button type="button" style={dest} onClick={() => onReturned(n)}>Back to the supply house<span style={small}>credit expected</span></button>
        <button type="button" style={dest} onClick={() => onDamaged(n)}>Damaged, scrap</button>
        <button type="button" style={{ ...quiet, justifySelf: 'start' }} onClick={() => onNewContainer(n)}>A new container…</button>
      </div>
    </Sheet>
  )
}

function AddPartSheet({ container, names, searchParts, words, onClose, onAdd }: { container: Container; /** Other words for the sheet, when the part is not being added to the box (Take from a box). */ words?: { title: string; sub: string; press: (n: number) => string }; /** The names this job already holds (punch list #330): offered first, so a part is not typed a second way. */ names: ReadonlyArray<OnHandName>; searchParts: (term: string) => Promise<OnSitePart[]>; onClose: () => void; onAdd: (part: { partId: string | null; partName: string; manufacturer: string | null }, n: number) => void }) {
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<OnSitePart[]>([])
  const [searching, setSearching] = useState(false)
  const [picked, setPicked] = useState<{ partId: string | null; partName: string; manufacturer: string | null } | null>(null)
  const [n, setN] = useState(1)
  useEffect(() => {
    if (!term.trim() || picked) {
      setResults([])
      return
    }
    let live = true
    setSearching(true)
    const t = setTimeout(() => {
      searchParts(term).then((r) => { if (live) { setResults(r); setSearching(false) } }).catch(() => { if (live) setSearching(false) })
    }, 250)
    return () => { live = false; clearTimeout(t) }
  }, [term, picked, searchParts])
  const already = picked ? [] : matchOnHandNames(names, term)
  return (
    <Sheet title={words?.title ?? `Add a part to ${container.label}`} sub={picked ? `${picked.partName}${picked.manufacturer ? ` · ${picked.manufacturer}` : ''}` : (words?.sub ?? 'Pick a name this job already has, find it in the parts book, or type its name.')} onClose={onClose}>
      {!picked ? (
        <>
          <input type="search" autoFocus value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Part name or manufacturer" aria-label="Search the parts book" style={input} />
          {already.length > 0 ? (
            <div style={{ display: 'grid', gap: '0.3rem' }} data-testid="add-part-already">
              <span style={{ ...muted, fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Already on this job</span>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, border: '1px solid var(--border)', borderRadius: 8, maxHeight: 240, overflow: 'auto' }}>
                {already.map((a) => (
                  <li key={a.key}>
                    <button type="button" onClick={() => setPicked({ partId: a.partId, partName: a.partName, manufacturer: a.manufacturer })} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'baseline', width: '100%', padding: '0.75rem 1rem', textAlign: 'left', border: 'none', borderBottom: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer', font: 'inherit', minHeight: TOUCH_MIN }}>
                      <span style={{ minWidth: 0, overflowWrap: 'anywhere', fontWeight: 600 }}>{a.partName}{a.manufacturer ? <span style={{ ...muted, marginLeft: '0.5rem', fontWeight: 400 }}>· {a.manufacturer}</span> : null}</span>
                      <span style={{ ...muted, whiteSpace: 'nowrap' }}>{onHandNameWords(a)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {searching ? <p style={{ ...muted, margin: 0 }}>Searching…</p> : null}
          {already.length > 0 && results.length > 0 ? <span style={{ ...muted, fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>In the parts book</span> : null}
          {results.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, border: '1px solid var(--border)', borderRadius: 8, maxHeight: 240, overflow: 'auto' }}>
              {results.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => setPicked({ partId: p.id, partName: p.name, manufacturer: p.manufacturer })} style={{ display: 'block', width: '100%', padding: '0.75rem 1rem', textAlign: 'left', border: 'none', borderBottom: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer', font: 'inherit', minHeight: TOUCH_MIN }}>
                    {p.name}{p.manufacturer ? <span style={{ ...muted, marginLeft: '0.5rem' }}>· {p.manufacturer}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {term.trim() ? <button type="button" style={{ ...btn, ...btnBlock, fontWeight: 500 }} onClick={() => setPicked({ partId: null, partName: term.trim(), manufacturer: null })}>Use “{term.trim()}” as typed</button> : null}
        </>
      ) : (
        <>
          <Stepper n={n} max={9999} onChange={setN} />
          <button type="button" style={{ ...btnPrimary, ...btnBlock, minHeight: 52 }} onClick={() => onAdd(picked, n)}>{words ? words.press(n) : `Add ${n} to ${container.label}`}</button>
          <button type="button" style={{ ...quiet, justifySelf: 'start' }} onClick={() => setPicked(null)}>Pick a different part</button>
        </>
      )}
    </Sheet>
  )
}

/**
 * Add a container (punch list #351, PR 1): the name is offered from the site's boxes and holds to the rule in
 * `boxName.ts`; words typed after it are split off and land on **What is in it**, the box's own line (`boxLine.ts`).
 * How it sits opens on the kind this phone added last.
 */
function AddContainerSheet({ jobId, siteBoxes, places, onClose, onMade }: { jobId: string; siteBoxes: ReadonlyArray<SiteBox>; places: Place[]; onClose: () => void; onMade: (c: Container) => void }) {
  const [kind, setKind] = useState<BoxKindChoice>(() => readLastBoxKind())
  /** What was typed into the name; null while the site's offer stands in the field. */
  const [typed, setTyped] = useState<string | null>(null)
  const [where, setWhere] = useState('')
  const [placeId, setPlaceId] = useState<string | null>(places[0]?.id ?? null)
  const [newPlace, setNewPlace] = useState('')
  const verdict = boxNameVerdict(typed ?? '', siteBoxes)
  const shown = typed ?? nextFreeName(siteBoxes) ?? ''
  /** What was typed into **What is in it**; null while untouched, when the words typed after the name stand in it. */
  const [lineTyped, setLineTyped] = useState<string | null>(null)
  const line = addedLineVerdict(lineTyped, verdict.words)
  const wordsNote = verdict.ok ? nameWordsNote(verdict.words, lineTyped) : null
  const whereSaved = where.trim()
  const longWhere = whereSaved.length > BOX_WHERE_MAX
  const dead = !verdict.ok || longWhere || !line.ok
  const add = () => {
    if (!verdict.ok || longWhere || !line.ok) return
    const loc = newPlace.trim() ? addPlace({ jobId, name: newPlace }).id : placeId
    rememberBoxKind(kind)
    onMade(addContainer({ jobId, label: verdict.name, kind, where: whereSaved, said: line.said, locationId: loc }))
  }
  return (
    <Sheet title="Add a container" sub="The next free name on this site is ready. Change it only if the paint says something else." onClose={onClose}>
      <label style={{ display: 'grid', gap: '0.25rem', fontWeight: 600 }}>Its name<input type="text" value={shown} onChange={(e) => setTyped(e.target.value)} placeholder="R1" aria-label="Its name" autoCapitalize="characters" autoComplete="off" style={{ ...input, fontSize: '1.4rem', fontWeight: 800, textTransform: 'uppercase' }} /></label>
      <p data-testid="add-box-say" role={verdict.ok ? undefined : 'alert'} style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.45, color: !verdict.ok ? 'var(--text-red-700)' : verdict.tone === 'wait' ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>{verdict.say}{wordsNote ? ` ${wordsNote}` : ''}</p>
      <div style={{ display: 'grid', gap: '0.25rem' }}>
        <span style={{ fontWeight: 600 }}>How it sits</span>
        <div role="group" aria-label="How it sits" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem' }}>
          {BOX_KIND_CHOICES.map((k) => (
            <button key={k} type="button" aria-pressed={k === kind} style={{ ...btn, ...(k === kind ? { background: 'var(--text-strong)', color: 'var(--bg-page)', borderColor: 'var(--text-strong)' } : {}) }} onClick={() => setKind(k)}>{boxKindWords(k)}</button>
          ))}
        </div>
      </div>
      {/* What is in it (punch list #351, PR 2): never asked for. Words typed after the name stand here until the field is touched. */}
      <label style={{ display: 'grid', gap: '0.25rem', fontWeight: 600 }}>{BOX_LINE_FIELD_LABEL}<input type="text" value={lineFieldValue(lineTyped, verdict.words)} onChange={(e) => setLineTyped(e.target.value)} maxLength={BOX_LINE_MAX + 20} placeholder="You can say later" aria-label={BOX_LINE_FIELD_LABEL} style={input} data-testid="add-box-line" /></label>
      {line.ok ? (line.said ? null : <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.45, color: 'var(--text-muted)' }}>{BOX_LINE_LATER_NOTE}</p>) : <p role="alert" style={{ margin: 0, color: 'var(--text-red-700)', fontSize: '0.85rem' }}>{line.words}</p>}
      <div style={{ display: 'grid', gap: '0.35rem' }}>
        <span style={{ fontWeight: 600 }}>Which place on site</span>
        {places.length > 0 ? (
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {places.map((p) => (
              <button key={p.id} type="button" onClick={() => { setPlaceId(p.id); setNewPlace('') }} style={{ ...btn, minHeight: 36, padding: '0 0.75rem', borderRadius: 999, fontSize: '0.85rem', ...(placeId === p.id && !newPlace.trim() ? { background: 'var(--text-strong)', color: 'var(--bg-page)', borderColor: 'var(--text-strong)' } : {}) }}>{p.name}</button>
            ))}
          </div>
        ) : null}
        <input type="text" value={newPlace} onChange={(e) => setNewPlace(e.target.value)} placeholder={places.length ? 'Or a new place: Laydown yard' : 'Building C · level 2'} aria-label="A new place" style={input} />
      </div>
      <label style={{ display: 'grid', gap: '0.25rem', fontWeight: 600 }}>Where exactly, if it helps<input type="text" value={where} onChange={(e) => setWhere(e.target.value)} placeholder="by the north stair" aria-label="Where exactly" style={input} /></label>
      {longWhere ? <p role="alert" style={{ margin: 0, color: 'var(--text-red-700)', fontSize: '0.85rem' }}>The where line holds {BOX_WHERE_MAX} characters. This one is {whereSaved.length}.</p> : null}
      <button type="button" style={{ ...btnPrimary, ...btnBlock, minHeight: 52, ...dis(dead) }} disabled={dead} onClick={add}>{addPressLabel(verdict)}</button>
    </Sheet>
  )
}

/**
 * Say it better (punch list #351, PR 2): a person's own words for what is in a box, over the line the app writes from
 * its parts. Cleared words hand the line back to the app. The rules and every word are `boxLine.ts`; the write is the
 * store's `sayBoxLine`, kept and sent later when there is no signal.
 */
function SayLineSheet({ container, line, appLine, onClose, onSaved }: { container: Container; line: BoxLine; /** The app's own line from the parts, shown in the empty field: what the box reads when the words are cleared. */ appLine: string; onClose: () => void; onSaved: (words: string) => void }) {
  const [typed, setTyped] = useState(container.said ?? '')
  const verdict = boxLineVerdict(container, typed)
  const save = () => {
    if (!verdict.ok) return
    sayBoxLine(container.jobId, container.id, container.label, verdict.said)
    onSaved(boxLineSavedWords(container, verdict.said))
  }
  return (
    <Sheet title={sayItBetterTitle(container)} sub={sayItBetterSub(line)} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save() }} style={{ display: 'grid', gap: '0.75rem' }} data-testid="say-line-form">
        <label style={{ display: 'grid', gap: '0.25rem', fontWeight: 600 }}>{BOX_LINE_FIELD_LABEL}<input type="text" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={BOX_LINE_MAX + 20} placeholder={appLine || 'PVC fittings, mixed'} aria-label={BOX_LINE_FIELD_LABEL} style={input} /></label>
        {!verdict.ok && verdict.words ? <p role="alert" style={{ margin: 0, color: 'var(--text-red-700)', fontSize: '0.85rem' }}>{verdict.words}</p> : null}
        <button type="submit" style={{ ...btnPrimary, ...btnBlock, minHeight: 52, ...dis(!verdict.ok) }} disabled={!verdict.ok}>{boxLinePressLabel(container, typed)}</button>
      </form>
    </Sheet>
  )
}

function CountWalk({ container, line, index, total, onRight, onSave, onSkip, onGone, onStop }: { container: Container; line: ContainerLine; index: number; total: number; onRight: () => void; onSave: (n: number) => void; onSkip: () => void; onGone: () => void; onStop: () => void }) {
  const [typed, setTyped] = useState('')
  const n = typed.trim() === '' ? null : Math.max(0, Math.round(Number(typed)))
  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <button type="button" aria-label="Stop counting" onClick={onStop} style={{ ...btn, width: TOUCH_MIN, padding: 0, fontSize: '1.1rem' }}>✕</button>
        <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>Count {container.label}</div>
        <span style={{ marginLeft: 'auto', ...muted, fontWeight: 600 }}>{index + 1} of {total}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-200)', overflow: 'hidden' }}><div style={{ width: `${Math.round(((index + 1) / total) * 100)}%`, height: '100%', background: BLUE }} /></div>
      <div style={{ ...card, padding: '1rem 0.9rem', display: 'grid', gap: '0.75rem' }}>
        <div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{line.partName}</div>
          <div style={muted}>{line.manufacturer ? `${line.manufacturer} · ` : ''}{container.label}</div>
          {line.cannotFindSinceCount > 0 ? <div data-testid="count-walk-cant-find" style={{ color: 'var(--text-amber-800)', fontWeight: 600, fontSize: '0.85rem' }}>{countWalkCantFindWords(line.cannotFindSinceCount)}</div> : null}
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ ...muted, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.75rem', fontWeight: 700 }}>The app expects</div>
          <div style={{ fontSize: '3.4rem', fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{line.onHand}</div>
        </div>
        <button type="button" style={{ ...btnGo, ...btnBlock, minHeight: 56, fontSize: '1.1rem' }} onClick={onRight}>{line.onHand} is right</button>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', alignItems: 'center' }}>
          <input type="number" inputMode="numeric" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Different? Type it" aria-label="The number you counted" style={{ ...input, textAlign: 'center', fontSize: '1.3rem', fontWeight: 800 }} />
          <button type="button" style={{ ...btnPrimary, ...dis(n == null || n === line.onHand) }} disabled={n == null || n === line.onHand} onClick={() => n != null && onSave(n)}>{n == null ? 'Save' : pressLabel('counted', n)}</button>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button type="button" style={quiet} onClick={onSkip}>Skip this line</button>
        <button type="button" style={quiet} onClick={onGone}>Not in {container.label} any more</button>
      </div>
    </div>
  )
}


/** The box itself moves to another place on site: its row changes and the move is kept. */
function MoveBoxSheet({ jobId, container, places, byName, onClose, onMoved }: { jobId: string; container: Container; places: Place[]; byName: string; onClose: () => void; onMoved: (placeName: string) => void }) {
  const [newPlace, setNewPlace] = useState('')
  const dest: CSSProperties = { ...btn, ...btnBlock, justifyContent: 'space-between', fontWeight: 600, textAlign: 'left' }
  return (
    <Sheet title={`Move ${container.label} to…`} sub={`It is at ${placeName(places, container.locationId)} now. Its parts move with it.`} onClose={onClose}>
      <div style={{ display: 'grid', gap: '0.35rem' }}>
        {places.filter((p) => p.id !== container.locationId).map((p) => (
          <button key={p.id} type="button" style={dest} onClick={() => { moveContainer(container.id, p.id, byName); onMoved(p.name) }}>{p.name}</button>
        ))}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', marginTop: '0.25rem' }}>
          <input type="text" value={newPlace} onChange={(e) => setNewPlace(e.target.value)} placeholder="A new place: Laydown yard" aria-label="A new place" style={input} />
          <button type="button" style={{ ...btnPrimary, ...dis(!newPlace.trim()) }} disabled={!newPlace.trim()} onClick={() => { const p = addPlace({ jobId, name: newPlace }); moveContainer(container.id, p.id, byName); onMoved(p.name) }}>Move</button>
        </div>
      </div>
    </Sheet>
  )
}

/** Which box to pin: the stencil typed, the matches listed with their place and whether a pin exists. */
function PickBoxSheet({ containers, places, onClose, onPick }: { containers: Container[]; places: Place[]; onClose: () => void; onPick: (c: Container) => void }) {
  const [term, setTerm] = useState('')
  const matches = term.trim() ? searchContainers(containers, term) : [...containers].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
  return (
    <Sheet title="Pin which box?" sub="Type the stencil, then tap the box. The map opens with a ring to put on it." onClose={onClose}>
      <input type="search" autoFocus value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Stencil, like B12" aria-label="Which box" style={{ ...input, position: 'sticky', top: 0, zIndex: 1 }} />
      <div style={{ display: 'grid', gap: '0.35rem' }}>
        {matches.slice(0, 40).map((c) => (
          <button key={c.id} type="button" onClick={() => onPick(c)} style={{ ...btn, ...btnBlock, justifyContent: 'flex-start', gap: '0.6rem', fontWeight: 500 }}>
            <span style={{ fontSize: '1.15rem', fontWeight: 800 }}>{c.label}</span>
            <span style={muted}>{boxKindWords(c.kind).toLowerCase()} · {placeName(places, c.locationId)}</span>
            {c.lat != null ? <span style={{ marginLeft: 'auto', ...muted, fontWeight: 600 }}>pinned</span> : null}
          </button>
        ))}
        {matches.length === 0 ? <EmptyState compact main="No box matches that." tail="Try the first letters of its stencil." /> : null}
      </div>
    </Sheet>
  )
}
