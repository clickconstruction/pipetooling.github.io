/**
 * Jobs → Pipeline "Jobs on a map" card (v2.3396) — every Pipeline viewer.
 *
 * Plots the jobs the board is showing: the same filtered rows (search, GC /
 * development / account-man / contract filters), one pin per job with an
 * address, colored by Pipeline section in the board's own dot colors; a job in
 * Collections wears a red ring. Mounts under the toolbar row, above the money
 * story; renders nothing when there is no job to show. Collapsible: **Hide
 * map** (or the title itself) keeps the header line and remembers the choice
 * per device.
 *
 * Interactions: a pin selects the job — its popup (desktop) / bar (phone)
 * carries Open job (the job window), Edit and Directions — and lights the
 * job's row on the board below (`onFocusRow`, the # jump's own path). The
 * legend chips toggle sections on the map only, never on the board. Paid
 * starts off, and because the board loads Paid rows on demand, the Paid chip
 * asks the board to load them the first time it is turned on. The office
 * anchor and its 25 / 50 mile rings, the geocode cache, clustering and the
 * Google / OpenStreetMap provider rule are the Bid Board map's, shared.
 *
 * v2.3397: the rail on the right (`JobsMapRail`) — distance buckets that
 * double as pin filters with the dollars still to collect, the ask-for-money
 * list longest waiting first, the pinned total — and the row-hover pulse:
 * every Pipeline row already carries `data-stages-job-id`, so the card
 * listens once for mouse-over on the document and pulses the pin of the row
 * under the pointer. No row component changes; the three table variants get
 * it for free. Phones have no hover.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { JobsMapRail } from './JobsMapRail'
import { DEFAULT_DISTANCE_BUCKETS, jobsMapPinsInBuckets, jobsMapRail, type DistanceBucketKey, type DistanceBucketVisibility } from '../../lib/jobs/jobsMapRail'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { useAddressGeocodeCoords, type AddressToGeocode } from '../../hooks/useAddressGeocodeCoords'
import { googleMapsBrowserKey, resolveDashboardMapProvider } from '../../lib/dashboardJobsMap'
import { useOfficeAnchor } from '../../hooks/useOfficeAnchor'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { BID_BOARD_MAP_RING_MILES, bidBoardMapHomeFitPoints } from '../../lib/bids/bidBoardMap'
import { formatAddressWithoutZip } from '../../lib/bids/bidContactInfo'
import {
  JOBS_MAP_COLLECTIONS_RING_COLOR,
  JOBS_MAP_DEFAULT_SECTIONS,
  JOBS_MAP_SECTION_COLOR,
  JOBS_MAP_SECTION_LABEL,
  jobsMapDirectionsUrl,
  jobsMapDistanceLine,
  jobsMapJobs,
  jobsMapLegend,
  jobsMapOwedLine,
  jobsMapUnmappedLine,
  jobsMapVisiblePins,
  readJobsMapClustered,
  readJobsMapHidden,
  resolveJobsMapPins,
  writeJobsMapClustered,
  writeJobsMapHidden,
  type JobsMapJob,
  type JobsMapPin,
  type JobsMapSection,
  type JobsMapSectionVisibility,
} from '../../lib/jobs/jobsMap'
import type { MapCanvasAnchor, MapCanvasPin } from '../../lib/map/mapCanvasTypes'

const PinsMapCanvas = lazy(() => import('../map/PinsMapCanvas'))
const PinsMapGoogleCanvas = lazy(() => import('../map/PinsMapGoogleCanvas'))

const LINK_BUTTON_STYLE: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  fontSize: '0.875rem',
  color: 'var(--text-link)',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const POPUP_BUTTON_STYLE: React.CSSProperties = {
  flex: 1,
  padding: '0.35rem 0.6rem',
  fontSize: '0.8125rem',
  background: 'var(--surface)',
  color: 'var(--text-link)',
  border: '1px solid #2563eb',
  borderRadius: 4,
  cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
}

const MOBILE_ACTION_STYLE: React.CSSProperties = {
  flex: 1,
  minHeight: 44,
  padding: '0.4rem 0.5rem',
  fontSize: '0.9375rem',
  fontWeight: 600,
  background: 'var(--surface)',
  color: 'var(--text-link)',
  border: '1px solid #2563eb',
  borderRadius: 8,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

/** A cluster holding any job in Collections wears the red ring. */
const CLUSTER_RING_PRIORITY: readonly string[] = [JOBS_MAP_COLLECTIONS_RING_COLOR]

function PinGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s-6-5.2-6-10a6 6 0 0 1 12 0c0 4.8-6 10-6 10z" />
      <circle cx="12" cy="11" r="2.25" />
    </svg>
  )
}

function SectionChip({ section }: { section: JobsMapSection }) {
  const c = JOBS_MAP_SECTION_COLOR[section]
  return (
    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: c, border: `1px solid ${c}`, borderRadius: 999, padding: '1px 8px', whiteSpace: 'nowrap' }}>
      {JOBS_MAP_SECTION_LABEL[section]}
    </span>
  )
}

function CollectionsChip() {
  return (
    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-red-700)', border: `1px solid ${JOBS_MAP_COLLECTIONS_RING_COLOR}`, background: 'var(--bg-red-tint)', borderRadius: 999, padding: '1px 8px', whiteSpace: 'nowrap' }}>
      Collections
    </span>
  )
}

/** The popup / info-window body: the board row, compressed. */
function JobPinBody({
  pin,
  anchor,
  onOpenJob,
  onEditJob,
  onDirections,
}: {
  pin: JobsMapPin
  anchor: { lat: number; lng: number } | null
  onOpenJob: (job: JobWithDetails) => void
  onEditJob: (job: JobWithDetails) => void
  onDirections: (pin: JobsMapPin) => void
}) {
  const distance = jobsMapDistanceLine(pin, anchor)
  const owed = jobsMapOwedLine(pin)
  return (
    <div
      style={{
        fontSize: '0.8125rem',
        lineHeight: 1.4,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minWidth: 220,
        maxWidth: 300,
        color: 'var(--text-base)',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      }}
    >
      <div style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{pin.label}</div>
      {pin.payerName ? <div style={{ color: 'var(--text-muted)' }}>Bills go to {pin.payerName}</div> : null}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <SectionChip section={pin.section} />
        {pin.inCollections ? <CollectionsChip /> : null}
        {pin.pctComplete != null && (pin.section === 'working' || pin.section === 'waiting') ? <span style={{ color: 'var(--text-muted)' }}>{Math.round(pin.pctComplete)}% done</span> : null}
      </div>
      <div style={{ color: 'var(--text-muted)' }}>
        {formatAddressWithoutZip(pin.address)}
        {distance ? ` · ${distance}` : ''}
      </div>
      {owed ? <div style={{ color: 'var(--text-strong)', fontSize: '0.75rem', fontWeight: 600 }}>{owed}</div> : null}
      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
        <button type="button" onClick={() => onOpenJob(pin.row)} style={POPUP_BUTTON_STYLE}>
          Open job
        </button>
        <button type="button" onClick={() => onEditJob(pin.row)} style={POPUP_BUTTON_STYLE}>
          Edit
        </button>
        <button type="button" onClick={() => onDirections(pin)} style={POPUP_BUTTON_STYLE}>
          Directions
        </button>
      </div>
    </div>
  )
}

function SectionChips({
  legend,
  show,
  paidLoaded,
  onToggle,
  isMobile,
}: {
  legend: { section: JobsMapSection; count: number }[]
  show: JobsMapSectionVisibility
  /** The board's Paid rows are loaded on demand — until then the Paid chip says so. */
  paidLoaded: boolean
  onToggle: (section: JobsMapSection) => void
  isMobile: boolean
}) {
  return (
    <div
      role="group"
      aria-label="Sections on the map"
      style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', overflowX: isMobile ? 'auto' : undefined, WebkitOverflowScrolling: 'touch', flexWrap: isMobile ? 'nowrap' : 'wrap' }}
    >
      {legend.map((l) => {
        const on = show[l.section]
        const c = JOBS_MAP_SECTION_COLOR[l.section]
        const label = JOBS_MAP_SECTION_LABEL[l.section]
        const paidUnloaded = l.section === 'paid' && !paidLoaded
        const title = paidUnloaded
          ? 'Paid jobs load when their section opens — tap to load them and show their pins'
          : on
            ? `Hide ${label} pins`
            : `Show ${label} pins`
        return (
          <button
            key={l.section}
            type="button"
            onClick={() => onToggle(l.section)}
            aria-pressed={on}
            title={title}
            style={{
              flex: '0 0 auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: isMobile ? '0.3rem 0.6rem' : '0.15rem 0.6rem',
              minHeight: isMobile ? 36 : undefined,
              border: '1px solid var(--border-strong)',
              borderRadius: 999,
              background: 'var(--surface)',
              color: 'var(--text-700)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              opacity: on ? 1 : 0.45,
              fontFamily: 'inherit',
            }}
          >
            <span aria-hidden style={{ width: 9, height: 9, borderRadius: 999, background: on ? c : 'var(--text-faint-300)', display: 'inline-block' }} />
            {label}
            <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{paidUnloaded ? '…' : l.count}</span>
          </button>
        )
      })}
    </div>
  )
}

export function JobsMapCard({
  jobs,
  isMobile,
  loading,
  paidLoaded,
  onLoadPaid,
  onOpenJob,
  onEditJob,
  onFocusRow,
}: {
  /** The board's filtered rows — the map follows the search and every filter. */
  jobs: readonly JobWithDetails[]
  isMobile: boolean
  loading: boolean
  /** Whether the board's Paid scope has been merged into `jobs` (it loads on demand). */
  paidLoaded: boolean
  /** Ask the board to load its Paid rows (the Paid chip's first tap). */
  onLoadPaid: () => void
  onOpenJob: (job: JobWithDetails) => void
  onEditJob: (job: JobWithDetails) => void
  /** A pin (or an unmapped-job link) was clicked — light the row on the board. */
  onFocusRow: (job: JobWithDetails) => void
}) {
  const [hidden, setHidden] = useState<boolean>(() => readJobsMapHidden())
  const [clustered, setClustered] = useState<boolean>(() => readJobsMapClustered())
  const toggleClustered = useCallback(() => {
    setClustered((c) => {
      writeJobsMapClustered(!c)
      return !c
    })
  }, [])
  const [show, setShow] = useState<JobsMapSectionVisibility>(() => ({ ...JOBS_MAP_DEFAULT_SECTIONS }))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [fitSignal, setFitSignal] = useState(0)
  // The map opens on the office's region (pins within the outer ring); Fit all widens to every pin.
  const [fitAll, setFitAll] = useState(false)
  // Google Maps when a browser key is configured and the API loads; OpenStreetMap otherwise.
  // A failure is sticky for this page so a bad key never flickers (v2.3145).
  const [googleFailed, setGoogleFailed] = useState(false)
  const provider = resolveDashboardMapProvider({ key: googleMapsBrowserKey(), googleFailed })
  const googleUnavailable = useCallback((reason: string) => {
    console.warn(`[jobs map] Google Maps unavailable, using OpenStreetMap — ${reason}`)
    setGoogleFailed(true)
  }, [])

  const anchor = useOfficeAnchor(!hidden)
  const canvasAnchor = useMemo<MapCanvasAnchor | null>(
    () => (anchor ? { lat: anchor.lat, lng: anchor.lng, label: 'Office', ringMiles: BID_BOARD_MAP_RING_MILES } : null),
    [anchor],
  )

  const { jobs: mapJobs, noAddress } = useMemo(() => jobsMapJobs(jobs), [jobs])
  const addresses = useMemo<AddressToGeocode[]>(() => mapJobs.map((j) => ({ key: j.addressKey, display: j.address })), [mapJobs])
  const { coords, resolving } = useAddressGeocodeCoords(addresses, !hidden, 'jobs map address_geocodes')
  const { pins, unmapped } = useMemo(() => resolveJobsMapPins(mapJobs, coords), [mapJobs, coords])
  const legend = useMemo(() => jobsMapLegend(pins), [pins])
  const sectionVisible = useMemo(() => jobsMapVisiblePins(pins, show), [pins, show])
  // The rail's distance buckets are a second filter over the section chips.
  const [bucketsOn, setBucketsOn] = useState<DistanceBucketVisibility>(() => ({ ...DEFAULT_DISTANCE_BUCKETS }))
  const toggleBucket = useCallback((key: DistanceBucketKey) => setBucketsOn((prev) => ({ ...prev, [key]: !prev[key] })), [])
  const visible = useMemo(() => jobsMapPinsInBuckets(sectionVisible, anchor, bucketsOn), [sectionVisible, anchor, bucketsOn])
  const rail = useMemo(() => jobsMapRail(sectionVisible, anchor), [sectionVisible, anchor])
  // Row hover → pin pulse, by delegation on the rows' own `data-stages-job-id` (desktop only).
  const [pulseId, setPulseId] = useState<string | null>(null)
  useEffect(() => {
    if (hidden || isMobile || typeof document === 'undefined') return
    const onOver = (e: Event) => {
      const t = e.target
      const row = t instanceof Element ? t.closest('[data-stages-job-id]') : null
      setPulseId(row?.getAttribute('data-stages-job-id') ?? null)
    }
    document.addEventListener('mouseover', onOver)
    return () => document.removeEventListener('mouseover', onOver)
  }, [hidden, isMobile])
  const paidOff = show.paid ? 0 : (legend.find((l) => l.section === 'paid')?.count ?? 0)
  const byId = useMemo(() => new Map(visible.map((p) => [p.id, p])), [visible])
  const canvasPins = useMemo<MapCanvasPin[]>(
    () =>
      visible.map((p) => ({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        color: JOBS_MAP_SECTION_COLOR[p.section],
        ringColor: p.inCollections ? JOBS_MAP_COLLECTIONS_RING_COLOR : null,
        title: p.label,
      })),
    [visible],
  )
  const fitPoints = useMemo(() => (fitAll ? null : bidBoardMapHomeFitPoints(visible, anchor)), [fitAll, visible, anchor])
  const selected = selectedId ? (byId.get(selectedId) ?? null) : null
  useEffect(() => {
    if (selectedId && !byId.has(selectedId)) setSelectedId(null)
  }, [byId, selectedId])

  const toggleHidden = useCallback(() => {
    setHidden((h) => {
      writeJobsMapHidden(!h)
      return !h
    })
  }, [])
  const toggleSection = useCallback(
    (section: JobsMapSection) => {
      if (section === 'paid' && !paidLoaded) onLoadPaid()
      setShow((prev) => ({ ...prev, [section]: !prev[section] }))
    },
    [paidLoaded, onLoadPaid],
  )
  const select = useCallback(
    (id: string | null) => {
      setSelectedId(id)
      if (!id) return
      const p = byId.get(id)
      if (p) onFocusRow(p.row)
    },
    [byId, onFocusRow],
  )
  const directions = useCallback((p: JobsMapPin) => openInExternalBrowser(jobsMapDirectionsUrl(p.address)), [])
  const renderPopup = useCallback(
    (id: string) => {
      const p = byId.get(id)
      return p ? <JobPinBody pin={p} anchor={anchor} onOpenJob={onOpenJob} onEditJob={onEditJob} onDirections={directions} /> : null
    },
    [byId, anchor, onOpenJob, onEditJob, directions],
  )

  const total = mapJobs.length + noAddress.length
  if (!loading && total === 0) return null

  const unmappedAll: JobsMapJob[] = [...unmapped, ...noAddress]
  const unmappedLine = jobsMapUnmappedLine(unmappedAll.length)
  const mapHeight = isMobile ? 220 : 300
  const hiddenSectionsWithPins = pins.length > 0 && visible.length === 0

  return (
    <section
      id="jobs-map-card"
      aria-label="Jobs on a map"
      style={{
        border: '1px solid var(--border)',
        borderRadius: isMobile ? 12 : 8,
        background: 'var(--surface)',
        padding: isMobile ? '0.6rem' : '0.6rem 0.75rem 0.55rem',
        marginBottom: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.45rem',
        scrollMarginTop: '3.25rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', color: 'var(--text-muted)', minWidth: 0 }}>
          <PinGlyph />
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-strong)' }}>
            <button
              type="button"
              onClick={toggleHidden}
              aria-expanded={!hidden}
              title={hidden ? 'Show the map' : 'Hide the map. Click a pin to see the job; its row lights up below. Rings are 25 and 50 miles from the office. Chips toggle pins only.'}
              style={{ background: 'none', border: 'none', padding: 0, margin: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', minHeight: isMobile ? 44 : undefined }}
            >
              Jobs on a map
            </button>
          </h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '0.875rem', flexWrap: 'wrap' }}>
          {!isMobile && !hidden ? <SectionChips legend={legend} show={show} paidLoaded={paidLoaded} onToggle={toggleSection} isMobile={false} /> : null}
          {!hidden && canvasPins.length > 1 && !isMobile ? (
            <button
              type="button"
              onClick={() => {
                setFitAll(true)
                setFitSignal((n) => n + 1)
              }}
              style={LINK_BUTTON_STYLE}
              title="Frame every pin, including jobs far from the office"
            >
              Fit all
            </button>
          ) : null}
          {!hidden && pins.length > 1 ? (
            <button
              type="button"
              onClick={toggleClustered}
              aria-pressed={clustered}
              title={clustered ? 'Show every pin on its own' : 'Group pins that overlap into count discs; click a disc to zoom in'}
              style={{ ...LINK_BUTTON_STYLE, minHeight: isMobile ? 44 : undefined, fontWeight: clustered ? 700 : undefined }}
            >
              {clustered ? 'Clustered ✓' : 'Cluster'}
            </button>
          ) : null}
          <button type="button" onClick={toggleHidden} aria-expanded={!hidden} style={{ ...LINK_BUTTON_STYLE, minHeight: isMobile ? 44 : undefined }}>
            {hidden ? 'Show map' : isMobile ? 'Hide' : 'Hide map'}
          </button>
        </div>
      </div>

      {hidden ? null : (
        <>
          {isMobile ? <SectionChips legend={legend} show={show} paidLoaded={paidLoaded} onToggle={toggleSection} isMobile /> : null}

          {/* Map on the left, the rail on the right — the empty land becomes numbers. Phones stack. */}
          <div style={isMobile ? { display: 'flex', flexDirection: 'column', gap: '0.5rem' } : { display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: '0.6rem', alignItems: 'stretch' }}>
          <div
            // isolation contains Leaflet's internal z-indexes (panes 200–700, controls 1000) so they can't paint over the sticky section strip
            style={{ position: 'relative', height: mapHeight, borderRadius: 4, overflow: 'hidden', isolation: 'isolate', background: 'var(--bg-muted)' }}
          >
            {canvasPins.length > 0 ? (
              <Suspense fallback={<div style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading map…</div>}>
                {provider === 'google' ? (
                  <PinsMapGoogleCanvas
                    apiKey={googleMapsBrowserKey()}
                    onUnavailable={googleUnavailable}
                    pins={canvasPins}
                    selectedId={selectedId}
                    onSelect={select}
                    renderPopup={renderPopup}
                    fitSignal={fitSignal}
                    height={mapHeight}
                    isMobile={isMobile}
                    anchor={canvasAnchor}
                    fitPoints={fitPoints}
                    cluster={clustered}
                    clusterRingPriority={CLUSTER_RING_PRIORITY}
                    pulseId={isMobile ? null : pulseId}
                    // Leaflet / Google ignore a height change after mount — remount when the form flips
                    key={isMobile ? 'phone' : 'desktop'}
                  />
                ) : (
                  <PinsMapCanvas
                    pins={canvasPins}
                    selectedId={selectedId}
                    onSelect={select}
                    renderPopup={renderPopup}
                    fitSignal={fitSignal}
                    height={mapHeight}
                    isMobile={isMobile}
                    anchor={canvasAnchor}
                    fitPoints={fitPoints}
                    cluster={clustered}
                    clusterRingPriority={CLUSTER_RING_PRIORITY}
                    pulseId={isMobile ? null : pulseId}
                    // Leaflet / Google ignore a height change after mount — remount when the form flips
                    key={isMobile ? 'phone' : 'desktop'}
                  />
                )}
              </Suspense>
            ) : (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                {hiddenSectionsWithPins
                  ? 'Every section is turned off — tap a section above to show its pins.'
                  : resolving || loading
                    ? 'Placing jobs on the map…'
                    : 'None of these jobs has a map location yet.'}
              </div>
            )}
          </div>
          {!isMobile ? (
            <JobsMapRail
              rail={rail}
              bucketsOn={bucketsOn}
              onToggleBucket={toggleBucket}
              onPickPin={(pin) => select(pin.id)}
              paidOff={paidOff}
              unmappedLine={unmappedLine}
              unmappedCount={unmappedAll.length}
              unmappedRows={unmappedAll}
              onFocusRow={onFocusRow}
              resolving={resolving}
              isMobile={false}
            />
          ) : null}
          </div>

          {isMobile && selected ? (
            <div style={{ border: '1px solid var(--border-blue)', background: 'var(--bg-blue-tint)', borderRadius: 10, padding: '0.625rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: 'var(--text-strong)', fontSize: '0.9375rem' }}>{selected.label}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 4, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  <SectionChip section={selected.section} />
                  {selected.inCollections ? <CollectionsChip /> : null}
                  <span>
                    {selected.pctComplete != null && (selected.section === 'working' || selected.section === 'waiting') ? `${Math.round(selected.pctComplete)}% · ` : ''}
                    {formatAddressWithoutZip(selected.address)}
                    {jobsMapDistanceLine(selected, anchor) ? ` · ${jobsMapDistanceLine(selected, anchor)}` : ''}
                  </span>
                  {jobsMapOwedLine(selected) ? <span style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{jobsMapOwedLine(selected)}</span> : null}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" onClick={() => onOpenJob(selected.row)} style={MOBILE_ACTION_STYLE}>
                  Open job
                </button>
                <button type="button" onClick={() => onEditJob(selected.row)} style={MOBILE_ACTION_STYLE}>
                  Edit
                </button>
                <button type="button" onClick={() => directions(selected)} style={MOBILE_ACTION_STYLE}>
                  Directions
                </button>
              </div>
            </div>
          ) : null}

          {isMobile ? (
            <JobsMapRail
              rail={rail}
              bucketsOn={bucketsOn}
              onToggleBucket={toggleBucket}
              onPickPin={(pin) => select(pin.id)}
              paidOff={paidOff}
              unmappedLine={unmappedLine}
              unmappedCount={unmappedAll.length}
              unmappedRows={unmappedAll}
              onFocusRow={onFocusRow}
              resolving={resolving}
              isMobile
            />
          ) : null}
        </>
      )}
    </section>
  )
}
