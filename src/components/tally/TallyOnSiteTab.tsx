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
 */
import { Suspense, lazy, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToastContext } from '../../contexts/ToastContext'
import { useAddressGeocodeCoords } from '../../hooks/useAddressGeocodeCoords'
import { normalizeAddressForGeocodeKey } from '../../lib/map/normalizeAddressForGeocode'
import type { OnSiteMapPin } from '../materials/OnSiteMap'
import { requestMyLocation, type LatLng } from '../../lib/materials/myLocation'
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
import { BoxPhotos, PhotoPress } from '../materials/PhotoPress'
import { FlowRow } from '../materials/FlowRow'
import { TallyChooseJobSheet } from './TallyChooseJobSheet'
import { countWalkAt, countWalkKeys } from '../../lib/materials/countWalk'
import { containerLines, containerWords, countIsDue, groupByPlace, lastCountWords, lastCountedAt, leftWords, linesOf, nextLabel, placeName, pressLabel, searchContainers, searchLines, type Container, type ContainerLine, type MovementReason, type Place } from '../../lib/materials/onSite'
import { matchOnHandNames, onHandNames, onHandNameWords, type OnHandName } from '../../lib/materials/onSiteNames'
import { addContainer, addMovement, addPlace, listContainers, listMovements, listPhotos, listPlaces, moveContainer, pinContainer, retireContainer, setOnSiteErrorHandler, unretireContainer } from '../../lib/materials/onSiteStore'
import { broughtBackWords, retiredWords, UNDO_RETIRE_MS, undoRetireLabel, unretireVerdict } from '../../lib/materials/unretire'
import { SHORT_MAX, shortAfterWords, shortLabel, shortRefusalWords, shortRequestRow, shortToast } from '../../lib/materials/shortRequest'
import { sendShortRequest } from '../../lib/materials/shortRequestIo'
import { boxClipboardWords, copiedLabelWords } from '../../lib/materials/labels'
import { boxPagePath } from '../../lib/materials/boxPage'
import { findOnSite, otherJobsWithBoxes, otherJobsWords, type OnSiteFindHit } from '../../lib/materials/onSiteFind'
import LabelsPrintModal from '../materials/LabelsPrintModal'
import ManifestPrintModal from '../materials/ManifestPrintModal'
import ScanLabelWindow from '../materials/ScanLabelWindow'
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
  /** Goes up each time the address asks for a box, so a box asked for a second time opens again (v2.6904). */
  askSeq?: number
  /** Told which box's screen is open, null on the list, so the page can keep it on the address (v2.6904). */
  onOpenContainer?: (containerId: string | null) => void
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
/** Inline styles have no :disabled, so a dead press fades by hand. */
const dis = (off: boolean): CSSProperties => (off ? { opacity: 0.45, cursor: 'default' } : {})

type View = { kind: 'containers' } | { kind: 'container'; id: string } | { kind: 'count'; id: string; /** The walk's lines by part key, fixed when it starts (`countWalkKeys`). */ keys: string[]; index: number; corrected: number }
type Sheet =
  | null
  | { kind: 'qty'; reason: 'used' | 'cannot_find'; line: ContainerLine; container: Container }
  | { kind: 'short'; line: ContainerLine; container: Container }
  | { kind: 'move'; line: ContainerLine; container: Container }
  | { kind: 'add-part'; container: Container }
  | { kind: 'add-container'; moveAfter: { line: ContainerLine; qty: number; from: Container } | null }
  | { kind: 'retire'; container: Container }
  | { kind: 'pick-job' }
  | { kind: 'move-box'; container: Container }
  | { kind: 'places' }
  | { kind: 'map'; focusId: string | null }
  | { kind: 'pin'; container: Container }
  | { kind: 'pick-box' }

export default function TallyOnSiteTab({ jobs, jobsLoading, selectedJobId, onPickJob, byUserId, byName, searchParts, initialContainerId, askSeq = 0, onOpenContainer }: Props) {
  const { showToast, showActionToast } = useToastContext()
  /** A 320 px phone: the four presses go two by two, as the mock-up drew them. */
  const narrow = useMatchMedia('(max-width: 359px)')
  const jobId = selectedJobId
  const load = useOnSiteJob(jobId)
  useEffect(() => { setOnSiteErrorHandler((m, tone) => showToast(m, tone)) }, [showToast])
  const job = jobs.find((j) => j.id === jobId) ?? null
  const containers = jobId ? listContainers(jobId).filter((c) => !c.retiredAt) : []
  const movements = jobId ? listMovements(jobId) : []
  const places = jobId ? listPlaces(jobId) : []
  const lines = containerLines(movements)
  const now = new Date()
  const [view, setView] = useState<View>({ kind: 'containers' })
  const [sheet, setSheet] = useState<Sheet>(null)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  /** The search's reach (punch list #304): this job, or every job the viewer may open. */
  const [scope, setScope] = useState<'job' | 'all'>('job')
  const [scanOpen, setScanOpen] = useState(false)
  /** A box's paper, printed here: its label or its manifest. */
  const [paper, setPaper] = useState<{ kind: 'label' | 'manifest'; id: string } | null>(null)
  /** The box to open once another job's boxes are on screen (a hit on another job was pressed). */
  const pendingContainerRef = useRef<string | null>(null)
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
  // The site map opens on the job's address, placed through the app's geocode cache, until a box is pinned.
  const addr = job?.job_address?.trim() ?? ''
  const geocodeAsk = useMemo(() => (addr ? [{ key: normalizeAddressForGeocodeKey(addr), display: addr }] : []), [addr])
  const { coords: jobCoords } = useAddressGeocodeCoords(geocodeAsk, addr.length > 0, 'on-site map')
  const jobCenter = addr ? (jobCoords.get(normalizeAddressForGeocodeKey(addr)) ?? null) : null
  // The job's painted maps (#345), under the boxes on the site map: read only while that map is open.
  const painted = usePaintedMapsLayer(jobId ? { jobId } : null, sheet?.kind === 'map')
  const mapPins: OnSiteMapPin[] = containers.filter((c) => c.lat != null && c.lng != null && !c.retiredAt).map((c) => ({ id: c.id, label: c.label, lat: c.lat as number, lng: c.lng as number, tone: countIsDue(lastCountedAt(movements, c.id), new Date()) && c.kind !== 'unsorted' ? 'amber' : 'ok' }))
  const pinnedCount = mapPins.length
  const boxCount = containers.filter((c) => c.kind !== 'unsorted' && !c.retiredAt).length
  // The map sheets: where the map should jump (Use my location), what the ring sits on while placing, and a word when the phone cannot say where it is.
  const [mapFly, setMapFly] = useState<LatLng | null>(null)
  const [locating, setLocating] = useState<string | null>(null)
  const [pinCenter, setPinCenter] = useState<LatLng | null>(null)
  const myLocation = () => { setLocating('Finding you…'); requestMyLocation((p) => { setLocating(null); setMapFly({ ...p }) }, (words) => setLocating(words)) }
  const closeSheet = () => { setSheet(null); setLocating(null); setMapFly(null) }
  /** Where is this box? The ring sits at the map's centre; the footer's button puts the pin there. Drawn from either view. */
  const pinSheet = sheet?.kind === 'pin' ? (
    <Sheet
      fill
      title={`Where is ${sheet.container.label}?`}
      sub={sheet.container.lat != null ? 'Its pin is on the map. Drag the map to move the ring, then press the button.' : 'Step 1: drag the map until the ring is on the box, or press Use my location when you stand at it. Step 2: press the button.'}
      onClose={closeSheet}
      footer={
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '0.5rem' }}>
            <button type="button" style={btn} onClick={myLocation}>Use my location</button>
            <button type="button" style={{ ...btnPrimary, minHeight: 52, ...dis(!pinCenter) }} disabled={!pinCenter} onClick={() => { if (!pinCenter) return; pinContainer(sheet.container.id, pinCenter); closeSheet(); showToast(`${sheet.container.label} pinned on the map.`, 'success') }}>Put {sheet.container.label} here</button>
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
    setView(open ? { kind: 'container', id: open } : { kind: 'containers' })
    setSheet(null)
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
    return (
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {jobButton}
        {!load.loaded && load.loading ? <p style={{ ...muted, margin: 0 }}>Loading the boxes…</p> : null}
        <OfflineRetryPanel failure={load.error ? recoveryFailureFromError(load.raw, 'The boxes on this job did not load.') : null} onRetry={load.retry} surface="materials-on-site-phone" idempotent />
        {/* #297 (v2.6927): the job's box photos still on their way to its Drive folder after a combine or a move. */}
        {jobId ? <BoxPhotoRefileStrip jobId={jobId} onToast={showToast} /> : null}
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
                    <span style={muted}>{c.kind} · {placeName(places, c.locationId)}</span>
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
                        <span style={muted}>{c.kind === 'unsorted' ? 'delivered' : c.kind}{c.where ? ` · ${c.where}` : ''}</span>
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
                      <span style={muted}>{h.container.kind === 'unsorted' ? 'delivered' : h.container.kind}{h.place ? ` · ${h.place}` : ''}{h.container.where ? ` · ${h.container.where}` : ''}</span>
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
                return (
                  <button key={c.id} type="button" onClick={() => setView({ kind: 'container', id: c.id })} style={{ ...card, textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'var(--text-strong)', borderColor: due || cannot ? 'var(--text-amber-800)' : 'var(--border)', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)', minHeight: TOUCH_MIN, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '0.02em' }}>{c.label}</span>
                      <span style={{ ...muted, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.75rem', fontWeight: 600 }}>{c.kind === 'unsorted' ? 'delivered' : c.kind}</span>
                      {c.where ? <span style={muted}>{c.where}</span> : null}
                    </div>
                    <div style={{ ...muted, marginTop: '0.15rem' }}>
                      <b style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{parts} {parts === 1 ? 'part' : 'parts'}</b>
                      {c.kind === 'unsorted' ? <> · put them in a cage</> : <> · <span style={due ? { color: 'var(--text-amber-700)', fontWeight: 600 } : undefined}>{lastCountWords(last, now)}</span></>}
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
          </>
        )}
        {sheet?.kind === 'add-container' ? <AddContainerSheet jobId={jobId} existing={containers} places={places} onClose={() => setSheet(null)} onMade={(c) => { setSheet(null); setView({ kind: 'container', id: c.id }) }} /> : null}
        {sheet?.kind === 'places' ? (
          <Sheet title="Places on this site" sub={`${boxCount} ${boxCount === 1 ? 'box' : 'boxes'} in ${places.length} ${places.length === 1 ? 'place' : 'places'}. Tap a place to see only its boxes.`} onClose={closeSheet} footer={<button type="button" style={{ ...btnPrimary, ...btnBlock }} onClick={() => setSheet({ kind: 'map', focusId: null })}>Show the site map · {pinnedCount} pinned</button>}>
            <div style={{ display: 'grid', gap: '0.35rem' }}>
              {chips.map((ch) => (
                <button key={ch.id} type="button" onClick={() => { setPlaceFilter(ch.id); closeSheet() }} style={{ ...btn, ...btnBlock, justifyContent: 'space-between', fontWeight: placeFilter === ch.id ? 700 : 500 }}>{ch.name}<span style={{ ...muted, fontWeight: 600 }}>{ch.n}</span></button>
              ))}
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
        <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{containerWords(container)}</div>
        <div style={muted}>{container.where ? `${container.where} · ` : ''}{ls.filter((l) => l.onHand > 0).length} parts · <span style={due ? { color: 'var(--text-amber-700)', fontWeight: 600 } : undefined}>{container.kind === 'unsorted' ? 'put them in a cage' : lastCountWords(last, now)}</span></div>
      </div>
    </div>
  )

  if (view.kind === 'count') {
    // The walk's own list, fixed at its start (v2.7161): a line counted to none used to leave a list re-read on every
    // step, and the walk stepped over the line after it.
    const total = view.keys.length
    const at = countWalkAt(view.keys, view.index, ls)
    const done = (corrected: number) => {
      showToast(`${container.label} counted. ${total} ${total === 1 ? 'line' : 'lines'}, ${corrected} corrected.`, 'success')
      setLastAct({ containerId: container.id, what: 'Count', at: Date.now() })
      setView({ kind: 'container', id: container.id })
    }
    if (!at) {
      done(view.corrected)
      return null
    }
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
  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      {header}
      {container.kind !== 'unsorted' ? (
        <div style={{ display: 'grid', gap: '0.35rem', ...muted }}>
          <span>At <b style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{placeName(places, container.locationId)}</b>{container.where ? `, ${container.where}` : ''}{container.lat != null ? ' · pinned on the map' : ''}</span>
          {/* Three chips on one line at 375 (v2.6229): a three-column grid and short words; the words that were cut live on the chips' aria-labels. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.4rem' }}>
            <button type="button" style={chip} aria-label={`Move ${container.label} to another place`} onClick={() => setSheet({ kind: 'move-box', container })}>Move box</button>
            <button type="button" style={{ ...chip, gap: '0.3rem' }} aria-label={container.lat != null ? `${container.label} is on the map: open it` : `Mark ${container.label} on the map`} onClick={() => setSheet({ kind: 'pin', container })}><span aria-hidden>◎</span>{container.lat != null ? 'On the map' : 'Pin on map'}</button>
            <PhotoPress jobId={jobId} containerId={container.id} containerLabel={container.label} after={after} byUserId={byUserId} byName={byName} onToast={showToast} style={{ ...chip, gap: '0.35rem', ...(after ? { borderColor: BLUE, color: BLUE } : {}) }} />
          </div>
        </div>
      ) : null}
      {photos.length > 0 ? <BoxPhotos photos={photos} canAct onToast={showToast} /> : null}
      {ls.some((l) => l.onHand > 0) && container.kind !== 'unsorted' ? <button type="button" style={{ ...btnPrimary, ...btnBlock }} onClick={() => setView({ kind: 'count', id: container.id, keys: countWalkKeys(ls), index: 0, corrected: 0 })}>Count this box</button> : null}
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
        <AddContainerSheet jobId={jobId} existing={containers} places={places} onClose={() => setSheet(null)} onMade={(c) => { const mv = sheet.moveAfter; setSheet(null); if (mv) { write('moved', mv.line, mv.qty, mv.from.id, c.id); showToast(`Moved ${mv.qty} to ${c.label}.`, 'success') } else setView({ kind: 'container', id: c.id }) }} />
      ) : null}
      {pinSheet}
      {sheet?.kind === 'move-box' ? <MoveBoxSheet jobId={jobId} container={sheet.container} places={places} byName={byName} onClose={() => setSheet(null)} onMoved={(name) => { setSheet(null); showToast(`${sheet.container.label} is now at ${name}.`, 'success') }} /> : null}
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
      {touched ? <p style={{ ...muted, fontSize: '0.75rem', margin: 0 }}>Last touched {new Date(touched.at).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })} by {touched.by}.</p> : null}
    </div>
  )
}

// ── the sheets ────────────────────────────────────────────────────────────────────────────────

function Sheet({ title, sub, children, onClose, footer, fill }: { title: string; sub?: string; children: ReactNode; onClose: () => void; /** Buttons that stay on screen under the body, whatever the body does with a drag or a wheel. */ footer?: ReactNode; /** The body fills the sheet and the sheet fills the screen: for a map, which eats the scroll. */ fill?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 800, background: 'rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-end', paddingTop: 'var(--app-top-chrome, 0px)' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} style={{ background: 'var(--surface)', color: 'var(--text-strong)', borderTopLeftRadius: 16, borderTopRightRadius: 16, ...(fill ? { flex: '1 1 auto', minHeight: 0 } : { maxHeight: '90%' }), overflow: 'hidden', display: 'flex', flexDirection: 'column', maxWidth: 480, width: '100%', margin: '0 auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ flex: 'none', padding: '0.6rem 1rem 0', display: 'grid', gap: '0.4rem' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-strong)', margin: '0 auto' }} />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)', minHeight: 36, minWidth: 36 }}>×</button>
          </div>
          {sub ? <p style={{ ...muted, margin: '-0.2rem 0 0' }}>{sub}</p> : null}
        </div>
        <div style={fill ? { flex: '1 1 auto', minHeight: 0, padding: '0.6rem 1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' } : { flex: '1 1 auto', minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '0.6rem 1rem 1rem', display: 'grid', gap: '0.75rem', alignContent: 'start' }}>
          {children}
        </div>
        {footer ? <div style={{ flex: 'none', borderTop: '1px solid var(--border)', padding: '0.6rem 1rem calc(0.75rem + env(safe-area-inset-bottom, 0px))', display: 'grid', gap: '0.5rem', background: 'var(--surface)' }}>{footer}</div> : null}
      </div>
    </div>
  )
}

function Stepper({ n, max, onChange }: { n: number; max: number; onChange: (n: number) => void }) {
  const stepBtn: CSSProperties = { ...btn, width: 56, height: 56, padding: 0, fontSize: '1.5rem', borderRadius: 12 }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.9rem' }}>
      <button type="button" aria-label="One fewer" style={{ ...stepBtn, ...dis(n <= 1) }} disabled={n <= 1} onClick={() => onChange(Math.max(1, n - 1))}>−</button>
      <input type="number" inputMode="numeric" value={n} min={1} max={max} aria-label="How many" onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onChange(Math.min(max, Math.max(1, Math.round(v)))) }} style={{ ...input, width: 96, textAlign: 'center', fontSize: '2rem', fontWeight: 800, minHeight: 56 }} />
      <button type="button" aria-label="One more" style={{ ...stepBtn, ...dis(n >= max) }} disabled={n >= max} onClick={() => onChange(Math.min(max, n + 1))}>+</button>
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

function AddPartSheet({ container, names, searchParts, onClose, onAdd }: { container: Container; /** The names this job already holds (punch list #330): offered first, so a part is not typed a second way. */ names: ReadonlyArray<OnHandName>; searchParts: (term: string) => Promise<OnSitePart[]>; onClose: () => void; onAdd: (part: { partId: string | null; partName: string; manufacturer: string | null }, n: number) => void }) {
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
    <Sheet title={`Add a part to ${container.label}`} sub={picked ? `${picked.partName}${picked.manufacturer ? ` · ${picked.manufacturer}` : ''}` : 'Pick a name this job already has, find it in the parts book, or type its name.'} onClose={onClose}>
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
          <button type="button" style={{ ...btnPrimary, ...btnBlock, minHeight: 52 }} onClick={() => onAdd(picked, n)}>Add {n} to {container.label}</button>
          <button type="button" style={{ ...quiet, justifySelf: 'start' }} onClick={() => setPicked(null)}>Pick a different part</button>
        </>
      )}
    </Sheet>
  )
}

function AddContainerSheet({ jobId, existing, places, onClose, onMade }: { jobId: string; existing: Container[]; places: Place[]; onClose: () => void; onMade: (c: Container) => void }) {
  const [kind, setKind] = useState<'cage' | 'box' | 'loose'>('cage')
  const [label, setLabel] = useState(() => nextLabel(existing, 'A'))
  const [where, setWhere] = useState('')
  const [placeId, setPlaceId] = useState<string | null>(places[0]?.id ?? null)
  const [newPlace, setNewPlace] = useState('')
  const taken = existing.some((c) => c.label.trim().toLowerCase() === label.trim().toLowerCase())
  return (
    <Sheet title="Add a container" sub="The stencil on the steel is its name. Say where it stands so the next crew finds it." onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem' }}>
        {(['cage', 'box', 'loose'] as const).map((k) => (
          <button key={k} type="button" style={{ ...btn, ...(k === kind ? { background: 'var(--text-strong)', color: 'var(--bg-page)', borderColor: 'var(--text-strong)' } : {}) }} onClick={() => setKind(k)}>{k === 'loose' ? 'Loose pile' : k[0]!.toUpperCase() + k.slice(1)}</button>
        ))}
      </div>
      <label style={{ display: 'grid', gap: '0.25rem', fontWeight: 600 }}>The stencil<input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="A1" aria-label="The stencil" style={{ ...input, fontSize: '1.4rem', fontWeight: 800, textTransform: 'uppercase' }} /></label>
      {taken ? <p style={{ margin: 0, color: 'var(--text-red-700)', fontSize: '0.85rem' }}>{label.trim().toUpperCase()} is already on this job. Pick another stencil.</p> : null}
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
      <button type="button" style={{ ...btnPrimary, ...btnBlock, minHeight: 52, ...dis(!label.trim() || taken) }} disabled={!label.trim() || taken} onClick={() => { const loc = newPlace.trim() ? addPlace({ jobId, name: newPlace }).id : placeId; onMade(addContainer({ jobId, label: label.trim().toUpperCase(), kind, where, locationId: loc })) }}>Add {label.trim().toUpperCase() || 'it'}</button>
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
            <span style={muted}>{c.kind} · {placeName(places, c.locationId)}</span>
            {c.lat != null ? <span style={{ marginLeft: 'auto', ...muted, fontWeight: 600 }}>pinned</span> : null}
          </button>
        ))}
        {matches.length === 0 ? <EmptyState compact main="No box matches that." tail="Try the first letters of its stencil." /> : null}
      </div>
    </Sheet>
  )
}
